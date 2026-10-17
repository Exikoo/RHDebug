import { EmbedBuilder } from "discord.js";
import {
  getItemEmoji,
  toSuperscript,
  EMPTY_SLOT_EMOJI,
} from "./itemDisplay.js";

export function generateInventoryDisplay(playerProfile) {
  let desc = `**Gold:** ${playerProfile.gold} 🪙\n\n`;

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
    .setColor(0x5865f2);
}

/**
 * Builds the "bag" embed: a row of slot icons, the used/total slot
 * count, and a details block for whichever slot is currently selected.
 * This is the display used by the interactive bag opened via the 🎒
 * button on the map (see createBagButtons in buttonComponents.js).
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

  let desc = "```            Inventory            ```\n";
  desc += slotIcons.join("  ") + "\n\n";
  desc += `**Bag slots**\n${slots.length}/${bagSlots}\n\n`;

  const selectedSlot = selectedIndex !== null ? slots[selectedIndex] : null;

  if (selectedSlot?.item) {
    const item = selectedSlot.item;
    desc += `>>> Details of the item\n**${item.name}**\n${
      item.description || "No description available."
    }`;
  } else {
    desc += ">>> Details of the item\n*Select a slot below to inspect it.*";
  }

  return new EmbedBuilder()
    .setTitle(`🎒 ${playerProfile.username}'s bag`)
    .setDescription(desc)
    .setColor(0xe67e22)
    .setFooter({ text: `${playerProfile.gold} 🪙 gold` });
}

export function generateStatsDisplay(playerProfile) {
  const stats = playerProfile.totalStats;

  let desc = `**XP:** ${playerProfile.experience}\n\n`;
  desc += `❤️ **Health:** ${stats.health}\n`;
  desc += `⚔️ **Attack:** ${stats.attack}\n`;
  desc += `🛡️ **Defense:** ${stats.defense}\n`;
  desc += `💨 **Speed:** ${stats.speed}\n`;
  desc += `✨ **Magic:** ${stats.magic}`;

  return new EmbedBuilder()
    .setTitle(
      `📊 ${playerProfile.username} - Level ${playerProfile.level} ${playerProfile.class}`,
    )
    .setDescription(desc)
    .setColor(0x5865f2);
}
