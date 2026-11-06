import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { COLORS, areaBand, formatNumber } from "../../utils/uiTheme.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to play RuneHero."),
  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  execute(interaction, client) {
    const users = client.users.cache.size;
    const guilds = client.guilds.cache.size;

    const row = new ActionRowBuilder().addComponents([
      new ButtonBuilder()
        .setLabel("Join the Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/dank"),
      new ButtonBuilder()
        .setLabel("Add the Bot")
        .setStyle(ButtonStyle.Link)
        .setURL(
          "https://discord.com/api/oauth2/authorize?client_id=865650395783364620&permissions=1945552416471&scope=bot%20applications.commands",
        ),
    ]);

    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.panel)
          .setTitle("RuneHero — Help")
          .setDescription(
            [
              areaBand("How to play"),
              "> **1.** Run `/start` and build your character with buttons.",
              "> **2.** Press **Play** — the whole game happens on one screen.",
              "> **3.** Move with the D-pad, open the bag, gear up, fight monsters.",
              "",
              "No other command needed. Your progress saves automatically.",
            ].join("\n"),
          )
          .setThumbnail(client.user.displayAvatarURL())
          .addFields(
            {
              name: "🕹️ Controls",
              value:
                "**⬆️⬇️⬅️➡️** Move • **📖** Stats • **🎒** Bag • **🗺️** Map • **Quit** ends the screen",
            },
            {
              name: "⚔️ Combat",
              value:
                "Walk into a monster to attack. Monsters drop XP and gold; level ups fully heal you.",
            },
            {
              name: "💡 Stats",
              value: `Serving **${formatNumber(users)}** users across **${formatNumber(
                guilds,
              )}** servers.`,
            },
            {
              name: "🆘 Support",
              value: "Join the [support server](https://discord.gg/dank) for help.",
            },
          )
          .setFooter({ text: "RuneHero — a roguelike that never ends" }),
      ],
      components: [row],
    });
  },
};
