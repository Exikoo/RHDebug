import { SlashCommandBuilder, MessageFlags } from "discord.js";
import Profile from "../../models/Profile.js";
import Map from "../../models/Map.js";
import { createNavigationButtons } from "../../utils/buttonComponents.js";
import { calculateCombinedStats } from "../../utils/playerUtils.js";
import { monsterManager } from "../../monsterManager.js";
import { buildMapEmbed } from "../../utils/screen.js";

const mapCommand = {
  data: new SlashCommandBuilder()
    .setName("map")
    .setDescription("Open your game screen (city, plains or dungeon)."),
  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    const player = await Profile.findOne({ userId: interaction.user.id })
      .populate("inventory.item")
      .populate("equipped.weapon")
      .populate("equipped.armor")
      .populate("equipped.accessory");

    if (!player) {
      return interaction.reply({
        content:
          "❌ You don't have a character yet. Run `/start` to create one — it takes one click.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!player.currentMapId) {
      player.currentMapId = "main_city";
      player.location = { x: 8, y: 5 };
      await player.save();
    }

    const currentMap = await Map.findOne({ mapId: player.currentMapId });
    if (!currentMap) {
      return interaction.reply({
        content: `❌ Map error: ${player.currentMapId} not found. Please contact an administrator.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const combinedStats = calculateCombinedStats(player);

    // One query for the whole map: dead monsters are drawn as blood
    // stains by the sprite renderer, and the D-pad uses the same set.
    const deadKeys = await monsterManager.getDeadPositions(currentMap.mapId);

    const mapEmbed = buildMapEmbed({
      player,
      stats: combinedStats,
      map: currentMap,
      deadKeys,
    });

    const components = await createNavigationButtons(
      player,
      currentMap,
      interaction,
      deadKeys,
    );

    await interaction.reply({ embeds: [mapEmbed], components });
  },
};

export default mapCommand;
