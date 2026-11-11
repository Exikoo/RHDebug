import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  AttachmentBuilder,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EMOJI_GROUPS,
  allEmojiNames,
  pendingEmojis,
} from "../../config/emojiIds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMOJI_DIR = path.resolve(__dirname, "../../docs/emojis");

/** Every emoji name the bot expects, from config/emojiIds.js. */
const REQUIRED = allEmojiNames();

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
 * Builds the exact blocks to paste into config/emojiIds.js.
 * @param {Map<string, string>} idByName
 * @returns {string}
 */
function configSnippet(idByName) {
  const exportName = {
    bag: "SLOT_EMOJI_IDS",
    ui: "UI_EMOJI_IDS",
    professions: "PROFESSION_EMOJI_IDS",
    tiles: "TILE_EMOJI_IDS",
    demo: "DEMO_EMOJI_IDS",
  };

  return Object.entries(EMOJI_GROUPS)
    .map(([group, ids]) => {
      const name = exportName[group] ?? `${group.toUpperCase()}_EMOJI_IDS`;
      return [
        `export const ${name} = {`,
        ...Object.keys(ids).map(
          (key) => `  ${key}: ${idByName.has(key) ? `"${idByName.get(key)}"` : "null"},`,
        ),
        "};",
      ].join("\n");
    })
    .join("\n\n");
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
      for (const group of Object.values(EMOJI_GROUPS)) {
        if (name in group) return group[name] === idByName.get(name);
      }
      return false;
    });
    const unset = pendingEmojis();

    const summary = [
      `**Game emojis** — ${configured.length}/${REQUIRED.length} configured`,
      missing.length > 0
        ? `> Not uploaded yet: ${missing.join(", ")}`
        : `> All ${REQUIRED.length} emojis exist ✓`,
      unset.length > 0
        ? `> Not pasted into config/emojiIds.js: ${unset.length}`
        : "> config/emojiIds.js is complete ✓",
      `> PNGs found in docs/emojis: ${availableFiles().length}/${REQUIRED.length}`,
      ...notes.map((note) => `> ${note}`),
    ].join("\n");

    const snippet = configSnippet(idByName);
    const content = `${summary}\n\nPaste into \`config/emojiIds.js\` (replace both objects), then restart:\n\`\`\`js\n${snippet}\n\`\`\``;

    // Long snippets get an attached copy so nothing is cut off in chat.
    const files =
      content.length > MAX_CONTENT
        ? [new AttachmentBuilder(Buffer.from(snippet, "utf8"), { name: "emojiIds.snippet.js" })]
        : [];

    return interaction.editReply({
      content:
        content.length > MAX_CONTENT
          ? `${summary}\n\nSnippet attached (\`emojiIds.snippet.js\`) — paste both objects into \`config/emojiIds.js\`.`
          : content,
      files,
    });
  },
};
