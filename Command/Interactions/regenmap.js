import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import MapManager from "../../utils/mapManager.js";
import { GENERATED_MAPS } from "../../config/mapGeneration.js";

export default {
  developer: true,
  data: new SlashCommandBuilder()
    .setName("regenmap")
    .setDescription("Re-roll a generated map's random decorations (dev only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("map")
        .setDescription("Which map to regenerate")
        .setRequired(true)
        .addChoices(
          ...Object.entries(GENERATED_MAPS).map(([id, def]) => ({
            name: def.name,
            value: id,
          })),
        ),
    ),
  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mapId = interaction.options.getString("map", true);

    try {
      const { seed, changed } = await MapManager.regenerateMap(mapId);
      await interaction.editReply(
        `✅ Regenerated **${mapId}** (seed \`${seed}\`, ${changed} tiles changed). Monsters on that map were reset.`,
      );
    } catch (error) {
      console.error("regenmap error:", error);
      await interaction.editReply(`❌ ${error.message}`);
    }
  },
};
