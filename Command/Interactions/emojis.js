import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SLOT_EMOJI_IDS } from "../../config/emojiIds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMOJI_DIR = path.resolve(__dirname, "../../docs/emojis");

/** Names the bot expects, derived from config/emojiIds.js. */
const REQUIRED = Object.keys(SLOT_EMOJI_IDS);

/** Safe message length for an ephemeral reply. */
const MAX_CONTENT = 1900;

/** Uploadable files present in docs/emojis (preview/mock PNGs excluded). */
function availableFiles() {
  try {
    return fs
      .readdirSync(EMOJI_DIR)
      .filter((file) => file.endsWith(".png"))
      .map((file) => file.replace(/\.png$/, ""))
      .filter((name) => REQUIRED.includes(name));
  } catch {
    return [];
  }
}

/**
 * Builds the exact block to paste into config/emojiIds.js.
 * @param {Map<string, string>} idByName
 * @returns {string}
 */
function configSnippet(idByName) {
  const lines = REQUIRED.map((name) => {
    const id = idByName.get(name);
    return `  ${name}: ${id ? `"${id}"` : "null"},`;
  });

  return [
    "export const SLOT_EMOJI_IDS = {",
    ...lines,
    "};",
  ].join("\n");
}

export default {
  data: new SlashCommandBuilder()
    .setName("emojis")
    .setDescription("Upload or list the bag emojis (administrator only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName("upload")
        .setDescription(
          "Upload any missing docs/emojis/*.png to this application's emojis",
        ),
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const upload = interaction.options.getBoolean("upload") ?? false;
    const manager = client.application?.emojis;

    if (!manager) {
      return interaction.editReply(
        "❌ `client.application` is not ready yet — try again in a moment.",
      );
    }

    const notes = [];

    // --- upload anything missing that exists on disk
    if (upload) {
      const existing = await manager.fetch();
      const uploaded = [];
      const failed = [];

      for (const name of REQUIRED) {
        if (existing.some((emoji) => emoji.name === name)) continue;

        const file = path.join(EMOJI_DIR, `${name}.png`);
        if (!fs.existsSync(file)) {
          failed.push(`${name} (no PNG in docs/emojis)`);
          continue;
        }

        try {
          await manager.create({
            attachment: fs.readFileSync(file),
            name,
          });
          uploaded.push(name);
        } catch (error) {
          failed.push(`${name} (${error.message})`);
        }
      }

      if (uploaded.length > 0) notes.push(`✅ Uploaded: ${uploaded.join(", ")}`);
      if (failed.length > 0) notes.push(`⚠️ Failed: ${failed.join(", ")}`);
      if (uploaded.length === 0 && failed.length === 0) {
        notes.push("✅ Nothing to upload — every emoji already exists.");
      }
    }

    // --- report what the application can actually use
    const emojis = await manager.fetch();
    const idByName = new Map(emojis.map((emoji) => [emoji.name, emoji.id]));

    const missing = REQUIRED.filter((name) => !idByName.has(name));
    const configured = REQUIRED.filter((name) => {
      const id = SLOT_EMOJI_IDS[name];
      return id && id === idByName.get(name);
    });

    const summary = [
      `**Bag emojis** — ${configured.length}/${REQUIRED.length} configured`,
      missing.length > 0
        ? `> Missing from the application: ${missing.join(", ")}`
        : "> All 11 emojis exist ✓",
      `> PNGs found in docs/emojis: ${availableFiles().length}/${REQUIRED.length}`,
      ...notes.map((note) => `> ${note}`),
    ].join("\n");

    const snippet = `\`\`\`js\n${configSnippet(idByName)}\n\`\`\``;
    const content = `${summary}\n\nPaste into \`config/emojiIds.js\`, then restart:\n${snippet}`;

    return interaction.editReply({
      content:
        content.length > MAX_CONTENT
          ? `${content.slice(0, MAX_CONTENT)}…`
          : content,
    });
  },
};
