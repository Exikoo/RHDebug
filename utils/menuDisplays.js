import { EmbedBuilder } from "discord.js";

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
