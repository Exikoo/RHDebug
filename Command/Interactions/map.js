import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import Profile from "../../models/Profile.js";
import Map from "../../models/Map.js";
import { generateMapRows } from "../../utils/mapRenderer.js";
import { createNavigationButtons } from "../../utils/buttonComponents.js";
import { calculateCombinedStats } from "../../utils/playerUtils.js";

const mapCommand = {
  data: new SlashCommandBuilder()
    .setName("map")
    .setDescription("Show your current map (city or dungeon).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  /**
   * @param {ChatInputCommandInteraction} interaction
   * @param {Client} client
   */
  async execute(interaction, client) {
    const player = await Profile.findOne({ userId: interaction.user.id })
      .populate("inventory.item")
      .populate("equipped.weapon")
      .populate("equipped.armor")
      .populate("equipped.accessory");

    if (!player) {
      return interaction.reply({
        content: "❌ You don't have a profile yet. Use `/login` first.",
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

    const { x, y } = player.location;
    const rows = generateMapRows(
      currentMap.mapData,
      player.location,
      player.currentMapId,
    );
    const inventoryUsed = player.inventory?.length || 0;

    const currentHealth = player.currentHealth || combinedStats.health;
    const currentMana = player.currentMana || combinedStats.magic;

    const mapEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(
        `${player.username}'s score: ${
          player.experience || 0
        }\n\`\`\`            Screen Menu            \`\`\``,
      )
      .setDescription(`${rows.join("\n")}`)
      .addFields(
        {
          name: `Lv. ${player.level} | ${combinedStats.health} / ${combinedStats.health}`,
          value: `HP: ${currentHealth} / ${combinedStats.health}\nMP: ${currentMana} / ${combinedStats.magic}`,
          inline: true,
        },
        {
          name: "Bag slots",
          value: `${inventoryUsed}/${player.bagSlots}`,
          inline: true,
        },
        {
          name: `miniMap (${x},${y})`,
          value: "Path: [nswe]",
          inline: true,
        },
      )
      .setFooter({
        text: `
        >\n>\n>\n>
        `,
      });

    const components = await createNavigationButtons(
      player,
      currentMap,
      interaction,
    );

    await interaction.reply({
      embeds: [mapEmbed],
      components,
    });
  },
};

export default mapCommand;
