import { Client, GatewayIntentBits, Collection } from "discord.js";
import { loadEvents } from "./handlers/eventHandler.js";
import "dotenv/config";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: {
    parse: [],
    repliedUser: false,
  },
});

client.commands = new Collection();
client.subCommands = new Collection();
client.events = new Collection();

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to start the bot:", error);
  process.exit(1);
});

await loadEvents(client);

await process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
