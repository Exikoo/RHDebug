/**
 * Custom emoji IDs used by the bag screen.
 *
 * The PNGs live in `docs/emojis/` (128×128, built from `tileset/`): every
 * filled slot is the `misc/slot.png` frame with the item art inset, so one
 * emoji = one cell, exactly like the reference screen.
 *
 * To enable them:
 *   1. Discord Developer Portal → your application → Emojis → upload the
 *      files from `docs/emojis/`, keeping the file name as the emoji name.
 *   2. Paste each emoji's ID below (right-click → Copy Emoji ID).
 *
 * Anything left as `null` falls back to a unicode glyph, so the bag keeps
 * working while the uploads are pending — the startup emoji check lists
 * whatever is still missing.
 */

/** @type {Record<string, string|null>} */
export const SLOT_EMOJI_IDS = {
  // empty cell frame
  slot_empty: null,

  // one per item in config/items.js — the name must be `slot_<itemId>`
  slot_warrior_sword: null,
  slot_mage_staff: null,
  slot_ranger_bow: null,
  slot_warrior_armor: null,
  slot_mage_robe: null,
  slot_ranger_leather: null,
  slot_health_potion: null,
  slot_mana_potion: null,
  slot_bandage: null,
  slot_arrows: null,
};

/** A Discord snowflake: 17-20 digits, but be lenient about the exact length. */
const VALID_ID = /^\d{15,25}$/;

/**
 * Builds `<:name:id>` markup, or returns the fallback when the ID has not
 * been filled in yet (or is not a snowflake — a bad ID renders as raw text
 * and would push the rest of the row out of alignment).
 *
 * @param {string} name
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function customEmoji(name, fallback = null) {
  const id = SLOT_EMOJI_IDS[name];
  if (!id || !VALID_ID.test(String(id).trim())) return fallback;
  return `<:${name}:${String(id).trim()}>`;
}

/**
 * Emoji names that still need an upload/paste.
 * @returns {string[]}
 */
export function pendingSlotEmojis() {
  return Object.entries(SLOT_EMOJI_IDS)
    .filter(([, id]) => !id || !VALID_ID.test(String(id).trim()))
    .map(([name]) => name);
}
