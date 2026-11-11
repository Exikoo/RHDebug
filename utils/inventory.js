/**
 * Inventory helpers that work on a (possibly plain) profile object.
 *
 * The profile stores `inventory: [{ item: ObjectId | doc, quantity }]`. Every
 * lookup goes through the item cache so nothing here needs a populate.
 */
import { getItemByKey, getItemById, getItemMap, idOf } from "./itemCache.js";

/**
 * Item id (config key) of a bag slot, e.g. `iron_sword`.
 * @param {any} slot
 * @param {Map<string, object>} items by-ObjectId map from getItemMap()
 * @returns {string|null}
 */
export function slotItemKey(slot, items) {
  const id = idOf(slot?.item);
  if (!id) return null;
  const doc = items ? items.get(id) : getItemById(id);
  return doc?.itemId ?? null;
}

/**
 * How many of `key` the player holds.
 * @param {any} player
 * @param {string} key
 * @param {Map<string, object>} [items]
 */
export function countItem(player, key, items) {
  return (player.inventory ?? []).reduce((total, slot) => {
    const slotKey = slotItemKey(slot, items);
    return slotKey === key ? total + (slot.quantity ?? 0) : total;
  }, 0);
}

/**
 * Adds `quantity` of a config item key to the bag. Merges with an existing
 * stack; mutates the profile, the caller saves.
 *
 * @param {any} player
 * @param {string} key
 * @param {number} [quantity]
 * @param {Map<string, object>} [items]
 * @returns {boolean} false when the item is not in the cache
 */
export function addItem(player, key, quantity = 1, items) {
  const doc = getItemByKey(key);
  if (!doc) return false;

  const id = String(doc._id);
  const map = items ?? new Map();
  const existing = (player.inventory ?? []).find(
    (slot) => idOf(slot.item) === id,
  );

  if (existing) {
    existing.quantity = (existing.quantity ?? 1) + quantity;
  } else {
    player.inventory = player.inventory ?? [];
    player.inventory.push({ item: id, quantity });
  }

  // Keep the passed map honest if it was built before the item existed.
  if (items && !items.has(id)) items.set(id, doc);
  return true;
}

/**
 * Removes `quantity` of a config item key. All-or-nothing: returns false and
 * changes nothing when the player does not have enough.
 *
 * @param {any} player
 * @param {string} key
 * @param {number} quantity
 * @param {Map<string, object>} [items]
 * @returns {boolean}
 */
export function removeItem(player, key, quantity, items) {
  if (countItem(player, key, items) < quantity) return false;

  let left = quantity;
  const inventory = player.inventory ?? [];

  for (let i = inventory.length - 1; i >= 0 && left > 0; i -= 1) {
    const slot = inventory[i];
    if (slotItemKey(slot, items) !== key) continue;

    const take = Math.min(left, slot.quantity ?? 0);
    slot.quantity -= take;
    left -= take;
    if (slot.quantity <= 0) inventory.splice(i, 1);
  }

  return true;
}

/** True when every entry of `{ itemKey: quantity }` is available. */
export function hasItems(player, cost, items) {
  return Object.entries(cost).every(
    ([key, quantity]) => countItem(player, key, items) >= quantity,
  );
}

/** Loads the cache and returns it, for callers that do not have it yet. */
export async function loadItemMap() {
  return getItemMap();
}
