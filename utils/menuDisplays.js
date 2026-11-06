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
export function generateCharacterDisplay({
  player,
  stats,
  gear = [],
  bagIcons = [],
  classAttributes = {},
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

  const attributeTable = [
    `STR: ${String(attributes.str).padStart(4)}`,
    `INT: ${String(attributes.int).padStart(4)}`,
    `VIT: ${String(attributes.vit).padStart(4)}`,
    `DMG: ${String(stats.attack ?? 0).padStart(4)}`,
  ].join("\n");

  const description = [
    areaBand("Character screen"),
    `🧍 **${player.username}** — ${player.race}`,
    "",
    `**Attributes** · Point left: ${player.attributePoints ?? 0}`,
    "```",
    attributeTable,
    "```",
    `**Talents** · Point left: ${player.talentPoints ?? 0}`,
    learned.length > 0 ? learned.join(" · ") : "Nothing",
    "",
    "**Gear**",
    gear.map(({ item }) => (item ? getItemEmoji(item) : EMPTY_SLOT_EMOJI)).join(" "),
    "",
    `**Bags** ${player.inventory?.length ?? 0}/${player.bagSlots ?? 8}`,
    bagIcons.slice(0, 8).join(" "),
    "",
    `**Lv. ${player.level}**   **HP** ${health}/${maxHealth}   **MP** ${mana}/${maxMana}`,
    `XP ${player.experience ?? 0}/${xpToNextLevel(player.level)}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s character`)
    .setDescription(description)
    .setFooter({
      text: `ATK ${stats.attack ?? 0} • DEF ${stats.defense ?? 0} • SPD ${
        stats.speed ?? 0
      } • MAG ${stats.magic ?? 0}`,
    });
}

/**
 * Talent screen: the tree as an emoji grid, the points left, and the
 * description of whichever node is selected.
 *
 * @param {Object} view
 * @param {any} view.player
 * @param {string|null} view.selectedId
 * @returns {EmbedBuilder}
 */
export function generateTalentDisplay({ player, selectedId = null }) {
  const tree = renderTalentTree(player, selectedId);
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
    `**Points left:** ${player.talentPoints ?? 0}`,
    "",
    tree.join("\n"),
    "",
    "**Talent description**",
    details,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.panel)
    .setTitle(`${player.username}'s character`)
    .setDescription(description)
    .setFooter({
      text: `Attribute points: ${player.attributePoints ?? 0} • ${Object.keys(
        ATTRIBUTE_EFFECTS,
      )
        .map((key) => ATTRIBUTE_EFFECTS[key].short)
        .join(" / ")} on the character screen`,
    });
}
