/**
 * Fallback emoji used when an item has no `emoji` field of its own,
 * keyed by item type. Extend this as new item types are added.
 */
const TYPE_FALLBACK_EMOJI = {
  weapon: "⚔️",
  armor: "🛡️",
  accessory: "💍",
  consumable: "🧪",
  material: "📦",
};

/**
 * Emoji shown for an empty bag slot. Replace the ID below with your
 * own `:bg:` custom emoji's ID — enable Developer Mode in Discord,
 * right-click the emoji, "Copy Emoji ID", and paste it in here. Same
 * `<:name:id>` format used throughout config/mapConfig.js.
 */
export const EMPTY_SLOT_EMOJI = "<:bg:1550517511718436905>";

/**
 * Returns the emoji to display for an item. Prefers the item's own
 * `emoji` field (set in config/items.js) so it can later be swapped
 * for a real custom Discord emoji, and falls back to a generic icon
 * based on the item's type.
 * @param {Object} item - A populated Item document (or plain object).
 * @returns {string}
 */
export function getItemEmoji(item) {
  return item?.emoji || TYPE_FALLBACK_EMOJI[item?.type] || "❓";
}

const SUPERSCRIPT_DIGITS = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
};

/**
 * Converts a number to unicode superscript digits, used as a compact
 * stack-count badge next to an item's emoji (e.g. "🧪³").
 * @param {number} n
 * @returns {string}
 */
export function toSuperscript(n) {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
    .join("");
}
