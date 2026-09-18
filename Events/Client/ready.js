import { Client } from "discord.js";
import { loadCommands } from "../../handlers/commandHandler.js";
import { setupDatabase } from "../../db.js";

export default {
  name: "clientReady",
  once: true,
  /**
   * @param {Client} client
   */
  async execute(client) {
    try {
      console.log(`Client logged in as ${client.user.tag}`);

      await loadCommands(client);

      await setupDatabase().catch((err) => {
        console.error("Setup failed:", err);
        process.exit(1);
      });
    } catch (error) {
      console.error("Error during ready event:", error);
    }
  },
};
