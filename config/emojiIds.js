/**
 * Custom emoji IDs used by the game screens.
 *
 * The PNGs live in `docs/emojis/` and are generated from `tileset/` (bag
 * cells) or drawn as UI chrome (talent tree). Every lookup falls back to a
 * unicode glyph, so screens keep working before the uploads are done.
 *
 * To enable them:
 *   1. `/emojis upload` (administrator) — uploads everything in docs/emojis
 *      and prints this file's contents, or upload them by hand in the
 *      Developer Portal → your application → Emojis.
 *   2. Paste the printed block below.
 */

/** Bag cells: `slot_empty` + one `slot_<itemId>` per item in config/items.js. */
export const SLOT_EMOJI_IDS = {
  slot_empty: null,

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

/** Talent tree + navigation chrome. */
export const UI_EMOJI_IDS = {
  talent_node_off: null,
  talent_node_available: null,
  talent_node_on: null,
  talent_node_max: null,
  talent_node_focus: null,
  talent_link_h: null,
  talent_link_v: null,
  talent_blank: null,
  tab_talents: null,
};

export const EMOJI_GROUPS = {
  bag: SLOT_EMOJI_IDS,
  ui: UI_EMOJI_IDS,
};

/** A Discord snowflake: 17-20 digits, but be lenient about the exact length. */
const VALID_ID = /^\d{15,25}$/;

/**
 * @param {string|null|undefined} id
 * @returns {boolean}
 */
function isValidId(id) {
  return Boolean(id) && VALID_ID.test(String(id).trim());
}

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
  for (const group of Object.values(EMOJI_GROUPS)) {
    if (!Object.hasOwn(group, name)) continue;
    const id = group[name];
    if (!isValidId(id)) return fallback;
    return `<:${name}:${String(id).trim()}>`;
  }
  return fallback;
}

/** Every emoji name the code knows about (upload list). */
export function allEmojiNames() {
  return Object.values(EMOJI_GROUPS).flatMap((group) => Object.keys(group));
}

/**
 * Emoji names that still need an upload/ID.
 * @param {"bag"|"ui"|"all"} [scope]
 * @returns {string[]}
 */
export function pendingEmojis(scope = "all") {
  const groups =
    scope === "all"
      ? Object.values(EMOJI_GROUPS)
      : [EMOJI_GROUPS[scope]].filter(Boolean);

  return groups.flatMap((group) =>
    Object.entries(group)
      .filter(([, id]) => !isValidId(id))
      .map(([name]) => name),
  );
}

/** Kept for the bag-specific startup warning. */
export function pendingSlotEmojis() {
  return pendingEmojis("bag");
}
