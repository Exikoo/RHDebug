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
