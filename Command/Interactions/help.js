import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Help menu for RuneHero")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
          .setColor("#f53152")
          .setAuthor({
            name: "RuneHero's Help Panel",
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setThumbnail(client.user.displayAvatarURL())
          .setDescription(
            "RuneHero is a roguelike dungeon-crawler with no ending! Play all you want, level up your character and defeat monsters!",
          )
          .addFields(
            {
              name: "🆘 Support",
              value:
                "Join the [support server](https://discord.gg/dank) for help.",
            },
            {
              name: "🧱 Invite",
              value:
                "Invite RuneHero using [this link](https://discord.com/api/oauth2/authorize?client_id=865650395783364620&permissions=1945552416471&scope=bot%20applications.commands).",
            },
            {
              name: "💡 Stats",
              value: `Currently serving **${users}** users across **${guilds}** servers.`,
            },
          ),
      ],
      components: [row],
    });
  },
};
