import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import Profile from "../../models/Profile.js";
import GAME_CONFIG from "../../utils/gameConfig.js";
import { COLORS, areaBand } from "../../utils/uiTheme.js";

/**
 * The only command a player needs. Everything after this happens with
 * buttons on the same screen, exactly like the original handheld layout:
 * one panel, pick your character, press Start.
 */
export default {
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Create your character and start playing RuneHero."),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const existing = await Profile.exists({ userId: interaction.user.id });

    if (existing) {
      return interaction.reply({
        content:
          "▶ You already have a character. Use `/map` to open your game screen.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.panel)
      .setTitle("RuneHero — New Game")
      .setDescription(
        [
          areaBand("Create your character"),
          "> Pick a **class**, **race** and **difficulty** below.",
          "> Then press **Start** — no other command needed.",
        ].join("\n"),
      )
      .addFields(
        { name: "Class selected", value: "Warrior", inline: true },
        { name: "Race", value: "Human", inline: true },
        { name: "Gender", value: "Male", inline: true },
        { name: "Difficulty selected", value: "Normal", inline: true },
      )
      .setFooter({ text: "Your choices are saved when you press Start" });

    const classRow = new ActionRowBuilder().addComponents(
      ...Object.entries(GAME_CONFIG.classes).map(([key, cls]) =>
        new ButtonBuilder()
          .setCustomId(`class_${key}`)
          .setLabel(cls.name)
          .setEmoji(cls.icon)
          .setStyle(key === "warrior" ? ButtonStyle.Primary : ButtonStyle.Secondary),
      ),
      new ButtonBuilder()
        .setCustomId("quit_button")
        .setLabel("Quit")
        .setStyle(ButtonStyle.Danger),
    );

    const optionRow = new ActionRowBuilder().addComponents(
      ...Object.entries(GAME_CONFIG.races).map(([key, race]) =>
        new ButtonBuilder()
          .setCustomId(`race_${key}`)
          .setLabel(race.name)
          .setEmoji(race.icon)
          .setStyle(key === "human" ? ButtonStyle.Primary : ButtonStyle.Secondary),
      ),
      new ButtonBuilder()
        .setCustomId("gender_select")
        .setEmoji(GAME_CONFIG.genders.male.icon)
        .setLabel("Gender")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("difficulty_button")
        .setEmoji(GAME_CONFIG.difficulties.normal.icon)
        .setLabel("Difficulty")
        .setStyle(ButtonStyle.Secondary),
    );

    const startRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("login_button")
        .setLabel("▶ Start")
        .setStyle(ButtonStyle.Success),
    );

    return interaction.reply({
      embeds: [embed],
      components: [classRow, optionRow, startRow],
    });
  },
};
