export default {
  name: "interactionCreate",
  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command)
      return interaction.reply({
        content: "❌ This command is outdated.",
        ephemeral: true,
      });

    if (command.developer && interaction.user.id !== "597806191472672788")
      return interaction.reply({
        content: "❌ This command is only available to the developer.",
        ephemeral: true,
      });

    command.execute(interaction, client);
  },
};
