export default {
  name: "interactionCreate",
  /**
   * @param {import("discord.js").ModalSubmitInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;
  },
};
