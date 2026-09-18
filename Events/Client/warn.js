import { Client } from "discord.js";

export default {
  name: "warn",
  /**
   * @param {any} info
   * @param {Client} client
   */
  async execute(info, client) {
    console.log(
      `⚠️ Warning on client ${client.user.username}` + info?.message || info,
    );
  },
};
