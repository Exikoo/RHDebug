/**
 * The demo bot: a standalone client that does nothing but the first
 * Legends-of-Discord prototype screen.
 *
 *   npm run demo
 *
 * It reuses the same DISCORD_TOKEN as the main bot, so only run one of them
 * at a time (a token can hold a single gateway session per shard).
 */
import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";

import { handleInteraction, openPanel } from "./handler.js";
import { pruneGames } from "./store.js";

const PREFIX = "!demo";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (ready) => {
  console.log(`Demo ready as ${ready.user.tag}`);

  try {
    await ready.application.commands.create({
      name: "demo",
      description: "Open the original prototype screen",
    });
    console.log("Registered /demo");
  } catch (error) {
    console.error("Could not register /demo:", error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "demo") {
      return openPanel(interaction, interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith("demo_")) {
      return handleInteraction(interaction);
    }
  } catch (error) {
    console.error("Demo interaction failed:", error);
    const payload = { content: "The panel broke. Try again.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(payload).catch(() => {});
    }
    return interaction.reply(payload).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.toLowerCase().startsWith(PREFIX)) return;
  return openPanel(message, message);
});

// Idle games are dropped once an hour.
setInterval(() => {
  const removed = pruneGames();
  if (removed > 0) console.log(`Dropped ${removed} idle game(s)`);
}, 10 * 60 * 1000).unref();

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to start the demo:", error.message);
  process.exit(1);
});
