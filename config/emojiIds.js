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
  slot_empty: "1415418095123697817",
  slot_warrior_sword: "1568277099196842054",
  slot_mage_staff: "1568278296804724836",
  slot_ranger_bow: "1568278297991712841",
  slot_warrior_armor: "1568278299052871825",
  slot_mage_robe: "1568278300814745713",
  slot_ranger_leather: "1568278302676877333",
  slot_health_potion: "1568278304052482190",
  slot_mana_potion: "1568278305025564866",
  slot_bandage: "1568278306875510824",
  slot_arrows: "1568278307877687417",
};

export const UI_EMOJI_IDS = {
  talent_node_off: "1568284077851680920",
  talent_node_available: "1568284079403704320",
  talent_node_on: "1568284080246755421",
  talent_node_max: "1568284081295196314",
  talent_node_focus: "1568284082650218551",
  talent_link_h: "1568284084172759222",
  talent_link_v: "1568284086035030106",
  talent_blank: "1568284087188463807",
  tab_talents: "1568284088417128508",
<<<<<<< HEAD
  tab_character: "1570062164654555207",
  ui_use: "1570062166885793892",
  ui_check: "1570062168798400542",
  ui_cross: "1570062170102960320",
  attr_bracket: "1570062171327696986",
  gear_icon_armor: "1570062172455960607",
  gear_icon_weapon: "1570062173667856454",
  gear_icon_accessory: "1570062174829805660",
=======
  tab_character: null,
  ui_use: null,
  ui_check: null,
  ui_cross: null,
  // character sheet decorations
  attr_bracket: null,
  gear_icon_armor: null,
  gear_icon_weapon: null,
  gear_icon_accessory: null,
  // map row: gold counter
  ui_gold: null,
  // map row: professions, quests, market, achievements, rankings
>>>>>>> b38e698d8f26e7be09317922414c71f2db8334b6
  ui_quests: null,
  ui_market: null,
  ui_trophy: null,
  ui_ranks: null,
};

/** Profession icons (gathering and crafting). */
export const PROFESSION_EMOJI_IDS = {
  prof_mining: null,
  prof_woodcutting: null,
  prof_fishing: null,
  prof_herbalism: null,
  prof_smithing: null,
  prof_crafting: null,
  prof_cooking: null,
};

export const EMOJI_GROUPS = {
  bag: SLOT_EMOJI_IDS,
  ui: UI_EMOJI_IDS,
  professions: PROFESSION_EMOJI_IDS,
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
