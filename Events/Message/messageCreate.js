export default {
  name: "messageCreate",
  /**
   * @param {import("discord.js").Message} message
   * @param {import("discord.js").Client} client
   */
  async execute(message, client) {
    if (message.author?.bot) return;
    if (message.channel?.type === "DM") return;
  },
};
