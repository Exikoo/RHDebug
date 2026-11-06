import { EMOJI_MAP, PLAYER_EMOJI_BY_CLASS } from "../config/mapConfig.js";
import { SLOT_EMOJI_IDS, pendingSlotEmojis } from "../config/emojiIds.js";
import { MONSTER_TEMPLATES } from "../monsterManager.js";
import items from "../config/items.js";

/**
 * The map is made of custom emojis, so a single wrong or un-uploaded ID
 * silently breaks the screen: Discord prints the raw `<:grass:123…>` markup
 * into the grid, which pushes every following tile out of alignment.
 *
 * This check runs once at startup and reports exactly which tiles are
 * unhealthy, instead of leaving you to spot it in-game.
 */

const EMOJI_MARKUP = /^<(a?):([A-Za-z0-9_]+):(\d+)>$/;

/**
 * @typedef {Object} EmojiProblem
 * @property {string} key      Tile key (e.g. "G") or "Player.Warrior".
 * @property {string} name     Emoji name from the markup, if parseable.
 * @property {"malformed"|"missing"} reason
 */

/**
 * @param {string} value
 * @returns {{animated: boolean, name: string, id: string}|null}
 */
export function parseCustomEmoji(value) {
  const match = EMOJI_MARKUP.exec(String(value ?? "").trim());
  if (!match) return null;
  return { animated: match[1] === "a", name: match[2], id: match[3] };
}

/**
 * Validates every configured emoji against the emojis the bot can actually
 * use (i.e. the ones in its guilds).
 *
 * @param {import("discord.js").Client} client
 * @returns {{problems: EmojiProblem[], ok: number, total: number, uncoveredMonsters: string[]}}
 */
export function checkConfiguredEmojis(client) {
  /** @type {EmojiProblem[]} */
  const problems = [];
  let ok = 0;
  let total = 0;

  const entries = [
    ...Object.entries(EMOJI_MAP).map(([key, value]) => [`tile ${key}`, value]),
    ...Object.entries(PLAYER_EMOJI_BY_CLASS ?? {})
      .filter(([, value]) => value)
      .map(([key, value]) => [`player ${key}`, value]),
    ...Object.entries(SLOT_EMOJI_IDS ?? {})
      .filter(([, id]) => id)
      .map(([key, id]) => [`bag ${key}`, `<:${key}:${id}>`]),
  ];

  for (const [key, value] of entries) {
    total += 1;
    const parsed = parseCustomEmoji(value);

    if (!parsed) {
      problems.push({ key, name: String(value), reason: "malformed" });
      continue;
    }

    if (client.emojis.cache.has(parsed.id)) ok += 1;
    else problems.push({ key, name: parsed.name, reason: "missing" });
  }

  // Monsters that have no emoji at all fall back to a wall tile, which is
  // easy to mistake for a design choice rather than missing art.
  const uncoveredMonsters = Object.keys(MONSTER_TEMPLATES).filter(
    (type) => !EMOJI_MAP[type],
  );

  // Items added to config/items.js without a matching `slot_<itemId>` entry
  // have no framed art and fall back to a unicode glyph.
  const uncoveredItems = Object.keys(items).filter(
    (itemId) => !Object.hasOwn(SLOT_EMOJI_IDS, `slot_${itemId}`),
  );

  return { problems, ok, total, uncoveredMonsters, uncoveredItems };
}

/**
 * Logs a readable report. Never throws: a bad emoji must not stop the bot.
 * @param {import("discord.js").Client} client
 */
export function reportEmojiHealth(client) {
  try {
    const { problems, ok, total, uncoveredMonsters, uncoveredItems } =
      checkConfiguredEmojis(client);

    if (problems.length === 0) {
      console.log(`✅ Emoji check: ${ok}/${total} map emojis available`);
    } else {
      console.warn(
        `⚠️  Emoji check: ${problems.length}/${total} map emojis unusable — ` +
          "these tiles will render as raw text or a wall:",
      );
      for (const problem of problems) {
        const why =
          problem.reason === "malformed"
            ? "not a <:name:id> custom emoji"
            : "not in any server the bot is in";
        console.warn(`   • ${problem.key} → ${problem.name} (${why})`);
      }
    }

    const pendingBag = pendingSlotEmojis();
    if (pendingBag.length > 0) {
      console.warn(
        `⚠️  Bag emojis not configured yet: ${pendingBag.length}/${
          Object.keys(SLOT_EMOJI_IDS).length
        } (${pendingBag.join(", ")}). ` +
          "Upload docs/emojis/*.png and paste the IDs in config/emojiIds.js — " +
          "until then the bag uses unicode fallbacks.",
      );
    }

    if (uncoveredItems.length > 0) {
      console.warn(
        `⚠️  Items without a bag emoji: ${uncoveredItems.join(", ")} ` +
          "(add a slot_<itemId> entry to EMOJI_MAP)",
      );
    }

    if (uncoveredMonsters.length > 0) {
      console.warn(
        `⚠️  No map emoji for monsters: ${uncoveredMonsters.join(", ")} ` +
          "(they render as walls — add them to EMOJI_MAP)",
      );
    }
  } catch (error) {
    console.warn("Emoji check failed:", error.message);
  }
}
