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

/** How many names a single reply lists before it says "and N more". */
const MAX_LIST = 12;

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

/** `name (and 4 more)`, for replies. */
function listNames(names, limit = MAX_LIST) {
  if (names.length === 0) return "none";
  const shown = names.slice(0, limit).join(", ");
  return names.length > limit ? `${shown} (+${names.length - limit} more)` : shown;
}

/** One line for a failed upload: the Discord error code says most of it. */
function describeError(error) {
  const code = error?.code ?? error?.status ?? error?.rawError?.code;
  const message = String(error?.message ?? error).split("\n")[0];
  return code ? `${message} [${code}]` : message;
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

/**
 * The bot's application emojis, or null when this discord.js/user cannot
 * reach them. Application emojis are app-wide (usable in every guild the bot
 * is in), which is why they are tried first.
 *
 * @param {import("discord.js").Client} client
 */
function applicationEmojiManager(client) {
  return client?.application?.emojis ?? null;
}

/** Everything the application already has, as `name -> id`. */
async function applicationEmojiIds(client) {
  const manager = applicationEmojiManager(client);
  if (!manager) return new Map();

  try {
    const collection = await manager.fetch();
    return new Map([...collection.values()].map((emoji) => [emoji.name, emoji.id]));
  } catch {
    return new Map();
  }
}

/** Everything the guild already has, as `name -> id`. */
function guildEmojiIds(guild) {
  if (!guild?.emojis?.cache) return new Map();
  return new Map([...guild.emojis.cache.values()].map((emoji) => [emoji.name, emoji.id]));
}

/**
 * Uploads one PNG: application emoji first, guild emoji as a fallback.
 *
 * Application emojis normally work, but they are the newer API and fail
 * outright (403/404) when the bot's application cannot use it — in that case
 * a guild emoji is still perfectly usable in the screens, so we do not stop.
 *
 * @param {object} options
 * @param {import("discord.js").Client} options.client
 * @param {import("discord.js").Guild|null} options.guild
 * @param {string} options.name
 * @param {Buffer} options.buffer
 * @returns {Promise<{ok: boolean, via?: "application"|"guild", id?: string, error?: string}>}
 */
async function uploadOne({ client, guild, name, buffer }) {
  const manager = applicationEmojiManager(client);
  let applicationError = null;

  if (manager) {
    try {
      const emoji = await manager.create({ attachment: buffer, name });
      return { ok: true, via: "application", id: emoji.id };
    } catch (error) {
      applicationError = describeError(error);
    }
  } else {
    applicationError = "application emojis unavailable (this discord.js/client)";
  }

  if (guild?.emojis?.create) {
    try {
      const emoji = await guild.emojis.create({ attachment: buffer, name });
      return { ok: true, via: "guild", id: emoji.id };
    } catch (error) {
      return { ok: false, error: `${applicationError} / guild: ${describeError(error)}` };
    }
  }

  return { ok: false, error: applicationError };
}

export default {
  data: new SlashCommandBuilder()
    .setName("emojis")
    .setDescription("Upload or list the game emojis (administrator only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName("upload")
        .setDescription("Upload every missing docs/emojis/*.png to this application"),
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const upload = interaction.options.getBoolean("upload") ?? false;
    const notes = [];

    try {
      // --- upload anything missing that exists on disk
      if (upload) {
        const application = await applicationEmojiIds(client);
        const guild = interaction.guild ? guildEmojiIds(interaction.guild) : new Map();
        const existing = new Map([...guild, ...application]);

        const uploaded = [];
        const failed = [];
        let viaApplication = 0;
        let viaGuild = 0;

        for (const name of REQUIRED) {
          if (existing.has(name)) continue;

          const file = path.join(EMOJI_DIR, `${name}.png`);
          if (!fs.existsSync(file)) {
            failed.push(`${name} (no PNG in docs/emojis)`);
            continue;
          }

          const result = await uploadOne({
            client,
            guild: interaction.guild,
            name,
            buffer: fs.readFileSync(file),
          });

          if (result.ok) {
            uploaded.push(name);
            if (result.via === "guild") viaGuild += 1;
            else viaApplication += 1;
          } else {
            failed.push(`${name} (${result.error})`);
          }
        }

        if (uploaded.length > 0) {
          notes.push(
            `✅ Uploaded ${uploaded.length} (${viaApplication} application, ${viaGuild} guild): ${listNames(uploaded)}`,
          );
        }
        if (failed.length > 0) {
          notes.push(`⚠️ Failed ${failed.length}: ${listNames(failed)}`);
        }
        if (uploaded.length === 0 && failed.length === 0) {
          notes.push("✅ Nothing to upload — every emoji already exists.");
        }
      }

      // --- report what the bot can actually use
      const application = await applicationEmojiIds(client);
      const guild = interaction.guild ? guildEmojiIds(interaction.guild) : new Map();
      const idByName = new Map([...guild, ...application]);

      const missing = REQUIRED.filter((name) => !idByName.has(name));
      const configured = REQUIRED.filter((name) => {
        for (const group of Object.values(EMOJI_GROUPS)) {
          if (name in group) return group[name] === idByName.get(name);
        }
        return false;
      });
      const unset = pendingEmojis();

      const summary = [
        `**Game emojis** — ${configured.length}/${REQUIRED.length} configured ` +
          `(${application.size} application, ${guild.size} guild)`,
        missing.length > 0
          ? `> Not uploaded yet (${missing.length}): ${listNames(missing)}`
          : `> All ${REQUIRED.length} emojis exist ✓`,
        unset.length > 0
          ? `> Not pasted into config/emojiIds.js: ${unset.length}`
          : "> config/emojiIds.js is complete ✓",
        `> PNGs found in docs/emojis: ${availableFiles().length}/${REQUIRED.length}`,
        ...notes.map((note) => `> ${note}`),
      ].join("\n");

      const snippet = configSnippet(idByName);
      const content = `${summary}\n\nPaste into \`config/emojiIds.js\` (replace every object), then restart:\n\`\`\`js\n${snippet}\n\`\`\``;

      // Long snippets get an attached copy so nothing is cut off in chat.
      const files =
        content.length > MAX_CONTENT
          ? [new AttachmentBuilder(Buffer.from(snippet, "utf8"), { name: "emojiIds.snippet.js" })]
          : [];

      return interaction.editReply({
        content:
          content.length > MAX_CONTENT
            ? `${summary}\n\nSnippet attached (\`emojiIds.snippet.js\`) — paste every object into \`config/emojiIds.js\`.`
            : content,
        files,
      });
    } catch (error) {
      console.error("Emoji command failed:", error);
      return interaction.editReply(
        `❌ \`/emojis\` failed: ${describeError(error)}\n` +
          "> Run it again to see whether it got part-way; uploads already made are skipped.",
      );
    }
  },
};

export { uploadOne, describeError, listNames, configSnippet };
