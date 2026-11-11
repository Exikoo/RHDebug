import { EmbedBuilder } from "discord.js";
import {
  getItemEmoji,
  getSelectedSlotEmoji,
  EMPTY_SLOT_EMOJI,
} from "./itemDisplay.js";
import {
  COLORS,
  areaBand,
  renderGauge,
  formatNumber,
} from "./uiTheme.js";
import { xpToNextLevel } from "./progression.js";
import { customEmoji } from "../config/emojiIds.js";
import { ATTRIBUTE_EFFECTS, TALENT_BY_ID } from "../config/talents.js";
import {
  PROFESSIONS,
  PROFESSION_FALLBACK,
  xpToNextProfessionLevel,
} from "../config/professions.js";
import { QUEST_BY_ID } from "../config/quests.js";
import { professionOf } from "./professions.js";
import { getItemByKey } from "./itemCache.js";
import {
  rankOf,
  renderTalentTree,
  totalAttributes,
} from "./talents.js";

export function generateInventoryDisplay(playerProfile) {
  let desc = `**Gold:** ${formatNumber(playerProfile.gold)} 🪙\n\n`;

  if (!playerProfile.inventory || playerProfile.inventory.length === 0) {
    desc += "*Your bag is empty...*";
  } else {
    const lines = playerProfile.inventory.map((slot) => {
      const name = slot.item?.name || "Unknown Item";
      return `- **${name}** x${slot.quantity}`;
    });
    desc += lines.join("\n");
  }

  return new EmbedBuilder()
    .setTitle(`🎒 ${playerProfile.username}'s Inventory`)
    .setDescription(desc)
    .setColor(COLORS.panel);
}

/**
 * The bag screen.
 *
 * Layout copied from the reference: title, dark "Inventory" band, a row of
 * framed slot emojis (one emoji per cell, so filled and empty cells line up),
 * the slot count, then the details of the selected item under a `>` line.
 *
 * @param {Object} playerProfile
 * @param {number|null} selectedIndex - Index into playerProfile.inventory, or null for no selection.
 * @returns {EmbedBuilder}
 */
export function generateBagDisplay(playerProfile, selectedIndex = null) {
  const slots = playerProfile.inventory || [];
  const bagSlots = playerProfile.bagSlots || slots.length;
  const visibleSlots = Math.min(bagSlots, 9);

  const slotIcons = Array.from({ length: visibleSlots }, (_, i) => {
    const slot = slots[i];
    // One emoji per cell: the framed `slot_<item>` art, or the empty frame.
    // The highlighted cell gets the `_sel` variant when it has been
    // uploaded, which bakes the selection corners into the same 1-cell emoji.
    if (i === selectedIndex) return getSelectedSlotEmoji(slot?.item ?? null);
    return slot?.item ? getItemEmoji(slot.item) : EMPTY_SLOT_EMOJI;
  });

  const selectedSlot = selectedIndex !== null ? slots[selectedIndex] : null;
  const selectedItem = selectedSlot?.item;

  const details = selectedItem
    ? [
        `${selectedItem.name}${
          selectedSlot.quantity > 1 ? ` ×${selectedSlot.quantity}` : ""
        }`,
        selectedItem.description || "No description available.",
        formatStats(selectedItem),
      ]
        .filter(Boolean)
        .join("\n")
    : "*Select a slot below to inspect it.*";

  const description = [
    areaBand("Inventory"),
    slotIcons.join(""),
    "",
    "**Bag slots**",
    `${slots.length}/${bagSlots}`,
    "",
    ">Details of the item",
    details,
  ].join("\n");

  return new EmbedBuilder()
    .setTitle(`${playerProfile.username}'s bag`)
    .setDescription(description)
    .setColor(COLORS.panel);
}

/**
 * "+8 attack · -1 speed" for gear, or nothing when the item has no stats
 * (the description already explains what consumables do).
 * @param {object} item
 * @returns {string}
 */
function formatStats(item) {
  const stats = Object.entries(item?.stats || {}).filter(([, value]) => value);
  if (stats.length === 0) return "";
  return stats
    .map(([stat, value]) => `${value > 0 ? "+" : ""}${value} ${stat}`)
    .join(" · ");
}

/**
 * Character sheet. Mirrors the handheld layout: identity + XP gauge on
 * top, vitals as gauges, then the paper doll of equipped gear.
 *
 * @param {Object} view
 * @param {string} view.username
 * @param {number} view.level
 * @param {string} view.class
 * @param {number} view.experience
 * @param {Object} view.totalStats
 * @param {string} [view.race]
 * @param {string} [view.gender]
 * @param {string} [view.difficulty]
 * @param {number} [view.gold]
 * @param {number} [view.currentHealth]
 * @param {number} [view.currentMana]
 * @param {Array<{slot: string, item: object|null}>} [view.equipment]
 * @param {object} [view.interaction]
 * @returns {EmbedBuilder}
 */
export function generateStatsDisplay(view) {
  const stats = view.totalStats || {};
  const maxHealth = Math.max(1, stats.health ?? 1);
  const maxMana = Math.max(0, stats.magic ?? 0);
  const health = view.currentHealth ?? maxHealth;
  const mana = view.currentMana ?? maxMana;
  const nextXp = xpToNextLevel(view.level);

  // Plain text: markdown does not render inside the code-block band.
  const identity = [
    view.difficulty ?? null,
    view.race ?? null,
    view.gender === "Female" ? "♀" : view.gender === "Male" ? "♂" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const desc = [
    areaBand(`${view.class}${identity ? ` • ${identity}` : ""}`),
    "",
    `**Lv. ${view.level}**   ${renderGauge("xp", view.experience, nextXp)}`,
    "",
    renderGauge("hp", health, maxHealth),
    renderGauge("mp", mana, maxMana),
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`📊 ${view.username}`)
    .setDescription(desc)
    .addFields({
      name: "Attributes",
      value: [
        `⚔️ Attack **${stats.attack ?? 0}**`,
        `🛡️ Defense **${stats.defense ?? 0}**`,
        `💨 Speed **${stats.speed ?? 0}**`,
        `✨ Magic **${stats.magic ?? 0}**`,
      ].join("   "),
    });

  if (Array.isArray(view.equipment)) {
    embed.addFields({
      name: "Equipment",
      value: view.equipment
        .map(({ slot, item }) => {
          const icon = { weapon: "⚔️", armor: "🛡️", accessory: "💍" }[slot];
          if (!item) return `${icon} **${slot}** — *empty*`;
          const bonus = Object.entries(item.stats || {})
            .filter(([, value]) => value)
            .map(([stat, value]) => `${value > 0 ? "+" : ""}${value} ${stat}`)
            .join(", ");
          return `${icon} **${item.name}**${bonus ? ` (${bonus})` : ""}`;
        })
        .join("\n"),
    });
  }

  if (view.gold !== undefined) {
    embed.setFooter({ text: `${formatNumber(view.gold)} 🪙 gold` });
  }

  return embed;
}

/**
 * Character sheet, laid out like the reference:
 * identity, attributes (+ points to spend), talents, gear row, bags row,
 * then level / XP / HP / MP and the bag capacity.
 *
 * @param {Object} view
 * @param {any} view.player              Profile document.
 * @param {any} view.stats               Combined stats (gear + talents).
 * @param {Array<{slot: string, item: object|null}>} view.gear
 * @param {string[]} view.bagIcons       One emoji per bag slot.
 * @param {Object} [view.classAttributes] Class base STR/INT/VIT.
 * @returns {EmbedBuilder}
 */
/** Em space: the one padding Discord renders identically in every font. */
const EM = "\u2003";

/** Custom emoji or a unicode stand-in, never null. */
const chrome = (name, fallback) => customEmoji(name, fallback) ?? fallback;

/**
 * Character sheet: the Legends-of-Discord layout, one emoji per cell.
 *
 * ```
 * Character screen
 * [quick bar: 4 item tiles]
 * 🧍 Name Race
 * Attributes - Point left: 3
 * [bracket] STR: ...
 * Talents - Point left: 0
 * Gear
 *   [armor] [weapon] [amulet]
 *   ▫️▫️ ▫️ ▫️▫️
 * Bags
 * ▫️▫️▫️▫️▫️
 * Hp 1.0
 * Lv. 1  HP  MP
 * ```
 *
 * @param {Object} view
 * @param {any} view.player
 * @param {any} view.stats            Combined stats (gear + talents applied)
 * @param {{armor: string[], weapon: string[], accessory: string[]}} view.gear
 *        One emoji per gear cell; index 0 is the equipped item.
 * @param {string[]} [view.bags]      Bag cell emoji (5 by default).
 * @param {string[]} [view.quickBar]  Four item tiles under the band.
 * @param {Object} [view.classAttributes]
 * @param {number} [view.potions]     Health potions in the bag (the `Hp 1.0` line).
 * @returns {EmbedBuilder}
 */
export function generateCharacterDisplay({
  player,
  stats,
  gear,
  bags = [],
  quickBar = [],
  classAttributes = {},
  potions = 0,
}) {
  const attributes = totalAttributes(player, classAttributes);
  const maxHealth = Math.max(1, stats.health ?? 1);
  const maxMana = Math.max(0, stats.magic ?? 0);
  const health = Math.min(maxHealth, player.currentHealth ?? maxHealth);
  const mana = Math.min(maxMana, player.currentMana ?? maxMana);

  const learned = [...(player.talents?.entries?.() ?? [])]
    .map(([id, rank]) => {
      const talent = TALENT_BY_ID.get(id);
      return talent && rank > 0 ? `${talent.name} ${rank}` : null;
    })
    .filter(Boolean);

  const empty = EMPTY_SLOT_EMOJI;
  const cells = (list, count) =>
    Array.from({ length: count }, (_, i) => list?.[i] ?? empty);

  const armor = cells(gear?.armor, 4);
  const weapon = cells(gear?.weapon, 2);
  const accessory = cells(gear?.accessory, 4);

  // Three panels side by side: 2x2, 2x1 and 2x2 cells, exactly like the game.
  const gearLine = (row) =>
    [armor[row * 2], armor[row * 2 + 1]].join("") +
    " " +
    weapon[row] +
    " " +
    [accessory[row * 2], accessory[row * 2 + 1]].join("");

  const bagCells = Array.from({ length: 5 }, (_, i) => bags[i] ?? empty);
  const bracket = chrome("attr_bracket", " ");

  const description = [
    areaBand("Character screen"),
    quickBar.slice(0, 4).join(""),
    `🧍 ${player.username} ${player.race ?? ""}`.trimEnd(),
    `**Attributes** - Point left: ${player.attributePoints ?? 0}`,
    `${bracket}STR:    ${attributes.str}`,
    `${bracket}INT:    ${attributes.int}`,
    `${bracket}VIT:    ${attributes.vit}`,
    `${bracket}DMG:    ${stats.attack ?? 0}`,
    `**Talents** - Point left: ${player.talentPoints ?? 0}`,
    learned.length > 0 ? learned.join(" · ") : "Nothing",
    "**Gear**",
    `${chrome("gear_icon_armor", "🛡")} ${chrome("gear_icon_weapon", "⚔")} ${chrome(
      "gear_icon_accessory",
      "💍",
    )}`,
    gearLine(0),
    gearLine(1),
    "**Bags**",
    bagCells.join(""),
    "",
    `**Hp** ${Math.max(0, potions)}.0`,
    `**Lv. ${player.level}**${EM}${EM}**HP**${EM}${EM}${EM}**MP**`,
    `_${player.experience ?? 0} / ${xpToNextLevel(player.level)}_${EM}${EM}_${health} / ${maxHealth}_${EM}_${mana} / ${maxMana}_`,
    "",
    "**Bag slots max**",
    `${player.bagSlots ?? 8}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s character`)
    .setDescription(description);
}

/**
 * Talent screen: same chrome as the character sheet, the tree as an emoji
 * grid with the tier number on the left of each row, and the description of
 * the highlighted node.
 *
 * @param {Object} view
 * @param {any} view.player
 * @param {string|null} view.selectedId
 * @param {string[]} [view.quickBar]
 * @returns {EmbedBuilder}
 */
export function generateTalentDisplay({ player, selectedId = null, quickBar = [] }) {
  const tree = renderTalentTree(player, selectedId, { tiers: true });
  const talent = selectedId ? TALENT_BY_ID.get(selectedId) : null;

  let details = "*Nothing selected*";
  if (talent) {
    const rank = rankOf(player, talent.id);
    const effect = Object.entries(talent.effect)
      .map(([stat, perRank]) => `+${perRank} ${stat} per rank`)
      .join(", ");
    details = [
      `**${talent.name}** — rank ${rank}/${talent.maxRank}`,
      effect,
      talent.requires.length > 0
        ? `*Requires ${talent.requires
            .map((id) => TALENT_BY_ID.get(id)?.name ?? id)
            .join(", ")}*`
        : "*No prerequisite*",
    ].join("\n");
  }

  const description = [
    areaBand("Talent screen"),
    quickBar.slice(0, 4).join(""),
    `**Point left:** ${player.talentPoints ?? 0}`,
    "",
    tree.join("\n"),
    "",
    "**Talent description**",
    details,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s character`)
    .setDescription(description);
}

// =====================================================================
// Professions / quests / achievements / rankings / market
// =====================================================================

/** Profession icon, falling back to a unicode glyph until it is uploaded. */
export function professionEmoji(id) {
  return customEmoji(PROFESSIONS[id]?.emoji ?? `prof_${id}`, PROFESSION_FALLBACK[id] ?? "❔");
}

/** Small progress bar that survives Discord's font (`▰▱`). */
function bar(value, max, width = 8) {
  const filled = Math.max(0, Math.min(width, Math.round((value / Math.max(1, max)) * width)));
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}

/**
 * Professions screen: one line per profession with level and xp bar.
 * @param {{player: any, professions: Array<object>}} view
 */
export function generateProfessionDisplay({ player, professions }) {
  const gather = professions.filter((p) => p.kind === "gather");
  const craft = professions.filter((p) => p.kind === "craft");

  const line = (entry) =>
    `${professionEmoji(entry.id)} **${entry.name}** Lv. ${entry.level} ${bar(entry.xp, entry.needed)} ${entry.xp}/${entry.needed}`;

  const description = [
    areaBand("Professions"),
    `🧍 ${player.username} · Lv. ${player.level}`,
    "",
    "**Gathering**",
    ...gather.map(line),
    "",
    "**Crafting**",
    ...craft.map(line),
    "",
    "*Gathering has a short cooldown. Crafting spends the materials in your bag.*",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s professions`)
    .setDescription(description);
}

/**
 * Crafting screen for one profession.
 * @param {{player: any, professionId: string, recipes: Array<object>}} view
 *   each recipe carries `{ id, name, cost, stock, affordable, requiresLevel, level }`
 */
export function generateCraftDisplay({ player, professionId, recipes }) {
  const profession = PROFESSIONS[professionId];
  const emoji = professionEmoji(professionId);
  const state = professionOf(player, professionId);

  const lines = recipes.map((recipe) => {
    const cost = Object.entries(recipe.cost)
      .map(([key, quantity]) => {
        const doc = getItemByKey(key);
        const held = recipe.stock?.[key] ?? 0;
        return `${doc?.name ?? key} ${held}/${quantity}`;
      })
      .join(" · ");
    const status = recipe.affordable ? "✅" : "❌";
    return `${status} **${recipe.name}** — ${recipe.description ?? ""}\n> ${cost}`;
  });

  const description = [
    areaBand(`${profession.name} bench`),
    `${emoji} **${profession.name}** Lv. ${state.level} ${bar(state.xp, xpToNextProfessionLevel(state.level))} ${state.xp}/${xpToNextProfessionLevel(state.level)}`,
    "",
    ...lines,
    "",
    "*Press a recipe to craft it.*",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s ${profession.name.toLowerCase()}`)
    .setDescription(description);
}

/**
 * Quest board.
 * @param {{player: any, quests: Array<object>, dailyReady: boolean}} view
 */
export function generateQuestDisplay({ player, quests, dailyReady }) {
  const lines = quests.map((quest) => {
    const template = QUEST_BY_ID.get(quest.id);
    const goal = quest.goal ?? template?.goal ?? 1;
    const progress = Math.min(goal, quest.progress ?? 0);
    const done = progress >= goal;
    return `${done ? "✅" : "▫️"} **${template?.title ?? quest.id}**${quest.daily ? " 🌙" : ""}\n> ${template?.text ?? ""} — ${progress}/${goal}`;
  });

  const description = [
    areaBand("Quest board"),
    `🧍 ${player.username} · 🪙 ${player.gold ?? 0}`,
    "",
    quests.length > 0 ? lines.join("\n") : "*No quests taken yet.*",
    "",
    `**Daily bounty** — ${dailyReady ? "available" : "already taken today"}`,
    `**Completed** — ${player.counters?.quests ?? 0}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s quests`)
    .setDescription(description);
}

/**
 * Achievements screen.
 * @param {{player: any, groups: Array<object>, filter: string, progress: object}} view
 */
export function generateAchievementDisplay({ player, groups, filter, progress }) {
  const shown = filter === "all" ? groups : groups.filter((a) => a.category === filter);
  const lines = shown.map((achievement) => {
    const icon = achievement.earned ? "🏆" : achievement.ready ? "⭐" : "▫️";
    return `${icon} **${achievement.name}** — ${achievement.description} *(${achievement.points} pts)*`;
  });

  const description = [
    areaBand("Achievements"),
    `**${progress.earned}/${progress.total}** earned · **${progress.points}/${progress.maxPoints}** points`,
    "",
    lines.length > 0 ? lines.join("\n") : "*Nothing in this category yet.*",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s achievements`)
    .setDescription(description);
}

/**
 * Rankings screen.
 * @param {{player: any, rows: Array<object>, sort: string}} view
 *   rows: `{ name, level, value, unit }`
 */
export function generateRankingDisplay({ player, rows, sort }) {
  const titles = {
    level: "Top by level",
    professions: "Top by profession levels",
    achievements: "Top by achievement points",
  };

  const lines = rows.map(
    (row, index) => `**${index + 1}.** ${row.name} — Lv. ${row.level} · ${row.value} ${row.unit}`,
  );

  const description = [
    areaBand("Rankings"),
    `**${titles[sort] ?? titles.level}**`,
    "",
    lines.length > 0 ? lines.join("\n") : "*No ranked players yet.*",
    "",
    `*Your rank: #${rows.findIndex((row) => row.id === player.userId) + 1 || "—"}*`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle("Hall of fame")
    .setDescription(description);
}

/**
 * Market board.
 * @param {{player: any, listings: Array<object>, myCount: number}} view
 */
export function generateMarketDisplay({ player, listings, myCount = 0 }) {
  const lines = listings.map(
    (row) => `**${row.name}** ×${row.quantity} — ${row.price} 🪙 *(${row.sellerName})*`,
  );

  const description = [
    areaBand("Market"),
    `🪙 **${player.gold ?? 0}** · your listings: **${myCount}**`,
    "",
    lines.length > 0 ? lines.join("\n") : "*The market is empty — list something!*",
    "",
    "*Buy takes the gold from you and pays the seller. Sell lists the item you picked in the bag.*",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle("Player market")
    .setDescription(description);
}
