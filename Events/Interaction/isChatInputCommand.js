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
        content: "❌ This command is outdated. Wait a bit then try again.",
        ephemeral: true,
      });

    if (command.developer && interaction.user.id !== "597806191472672788")
      return interaction.reply({
        content: "❌ This command is only available to the developers.",
        ephemeral: true,
      });

    try {
      await command.execute(interaction, client);
    } catch (error) {
      // A throwing command used to leave the interaction with no reply at
      // all, which Discord reports as "the application did not respond".
      console.error(`/${interaction.commandName} failed:`, error);
      const payload = {
        content: `❌ \`/${interaction.commandName}\` failed: ${error?.message ?? error}`,
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload).catch(() => {});
      }
      return interaction.reply(payload).catch(() => {});
    }
  },
};
