import { customEmoji } from "../config/emojiIds.js";

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
 * Emoji shown for an empty bag slot: the `slot_empty` frame from the
 * tileset (docs/emojis/slot_empty.png). Falls back to a unicode square
 * until that emoji's ID is pasted into config/emojiIds.js.
 */
export const EMPTY_SLOT_EMOJI = customEmoji("slot_empty", "▫️");

/**
 * Returns the emoji to display for an item. Prefers the item's own
 * `emoji` field (set in config/items.js) so it can later be swapped
 * for a real custom Discord emoji, and falls back to a generic icon
 * based on the item's type.
 * @param {Object} item - A populated Item document (or plain object).
 * @returns {string}
 */
export function getItemEmoji(item) {
  // Preferred: the framed `slot_<itemId>` emoji, which already includes the
  // bag frame so a filled cell and an empty cell take the same width.
  if (item?.itemId) {
    const slotEmoji = customEmoji(`slot_${item.itemId}`);
    if (slotEmoji) return slotEmoji;
  }

  return item?.emoji || TYPE_FALLBACK_EMOJI[item?.type] || "❓";
}

/**
 * Variant of an item's slot emoji with the selection corners baked in
 * (`slot_<itemId>_sel`), used for the highlighted cell of the bag row.
 * Optional: falls back to the normal slot emoji when that emoji has not
 * been uploaded.
 *
 * @param {object|null} item
 * @returns {string|null}
 */
export function getSelectedSlotEmoji(item) {
  if (item?.itemId) {
    const selected = customEmoji(`slot_${item.itemId}_sel`);
    if (selected) return selected;
  }
  if (!item) return customEmoji("slot_empty_sel", EMPTY_SLOT_EMOJI);
  return getItemEmoji(item);
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
