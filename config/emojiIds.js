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
  tab_character: "1570062164654555207",
  ui_use: "1570062166885793892",
  ui_check: "1570062168798400542",
  ui_cross: "1570062170102960320",
  attr_bracket: "1570062171327696986",
  gear_icon_armor: "1570062172455960607",
  gear_icon_weapon: "1570062173667856454",
  gear_icon_accessory: "1570062174829805660",
  ui_quests: "1570071476315627521",
  ui_market: "1570071477481373706",
  ui_trophy: "1570071478945194036",
  ui_ranks: "1570071479973060700",
};

export const PROFESSION_EMOJI_IDS = {
  prof_mining: "1570071481872818276",
  prof_woodcutting: "1570071483026505738",
  prof_fishing: "1570071484041265275",
  prof_herbalism: "1570071485370867814",
  prof_smithing: "1570071486637539368",
  prof_crafting: "1570071488319590462",
  prof_cooking: "1570071490093781002",
};

export const TILE_EMOJI_IDS = {
  tile_rock: "1570071491381297184",
  tile_chest: "1570071492568555521",
};

export const DEMO_EMOJI_IDS = {
  demo_grass_1: "1570071493302558752",
  demo_grass_2: "1570071494992859326",
  demo_player: "1570071495906959396",
  bar_hp: "1570071496997605582",
  bar_hp_empty: "1570071498834583582",
  bar_mana: "1570071499640012911",
  bar_mana_empty: "1570071501179453540",
};

export const EMOJI_GROUPS = {
  bag: SLOT_EMOJI_IDS,
  ui: UI_EMOJI_IDS,
  professions: PROFESSION_EMOJI_IDS,
  tiles: TILE_EMOJI_IDS,
  demo: DEMO_EMOJI_IDS,
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
 * The configured ID for a name, or null.
 * @param {string} name
 * @returns {string|null}
 */
export function emojiId(name) {
  for (const group of Object.values(EMOJI_GROUPS)) {
    if (Object.hasOwn(group, name) && isValidId(group[name]))
      return String(group[name]);
  }
  return null;
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
