import { EmbedBuilder } from "discord.js";
import {
  getItemEmoji,
  toSuperscript,
  EMPTY_SLOT_EMOJI,
} from "./itemDisplay.js";
import {
  COLORS,
  areaBand,
  renderGauge,
  formatNumber,
} from "./uiTheme.js";
import { xpToNextLevel } from "./progression.js";

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
 * Builds the "bag" screen: a row of slot icons, the used/total slot
 * count, and a details block for whichever slot is currently selected.
 * Kept visually identical to the map screen so moving between them feels
 * like tabbing through one console UI.
 * @param {Object} playerProfile
 * @param {number|null} selectedIndex - Index into playerProfile.inventory, or null for no selection.
 * @returns {EmbedBuilder}
 */
export function generateBagDisplay(playerProfile, selectedIndex = null) {
  const slots = playerProfile.inventory || [];
  const bagSlots = playerProfile.bagSlots || slots.length;
  const displaySlots = Math.min(bagSlots, 9);

  const slotIcons = Array.from({ length: displaySlots }, (_, i) => {
    const slot = slots[i];
    if (!slot?.item) return EMPTY_SLOT_EMOJI;

    const emoji = getItemEmoji(slot.item);
    const badge = slot.quantity > 1 ? toSuperscript(slot.quantity) : "";
    return `${emoji}${badge}`;
  });

  let desc = areaBand(`${playerProfile.username}'s bag`);
  desc += `\n\n${slotIcons.join("  ")}\n\n`;
  desc += `**Bag slots** ${slots.length}/${bagSlots}   •   **Gold** ${formatNumber(
    playerProfile.gold,
  )} 🪙\n\n`;

  const selectedSlot = selectedIndex !== null ? slots[selectedIndex] : null;

  if (selectedSlot?.item) {
    const item = selectedSlot.item;
    desc += `>>> **${item.name}** x${selectedSlot.quantity}\n${
      item.description || "No description available."
    }`;
  } else {
    desc += ">>> *Select a slot below to inspect it.*";
  }

  return new EmbedBuilder()
    .setTitle(`🎒 Bag — ${playerProfile.username}`)
    .setDescription(desc)
    .setColor(COLORS.panel)
    .setFooter({ text: `${formatNumber(playerProfile.gold)} 🪙 gold` });
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
