import Item from "../models/Item.js";
import { calculateCombinedStats } from "./playerUtils.js";

/**
 * Items are static templates (seeded from config/items.js at startup),
 * so there is no reason to run four `populate` queries on every button
 * press just to read a few stat numbers. Load them once, keep them as
 * plain objects, and resolve ids from memory.
 */
const EQUIP_SLOTS = ["weapon", "armor", "accessory"];
const MIN_REFRESH_MS = 30 * 1000;

/** @type {Map<string, object>} */
let items = new Map();
let loading = null;
let loadedAt = 0;

let byKey = new Map();

async function loadItems() {
  const docs = await Item.find({}).lean();
  items = new Map(docs.map((doc) => [String(doc._id), doc]));
  byKey = new Map(docs.map((doc) => [doc.itemId, doc]));
  loadedAt = Date.now();
}

/**
 * Looks an item up by its ObjectId string from the cache.
 * @param {string} id
 * @returns {object|null}
 */
export function getItemById(id) {
  return id ? (items.get(String(id)) ?? null) : null;
}

/**
 * Looks an item up by its config key (`iron_sword`) instead of its ObjectId.
 * @param {string} key
 * @returns {object|null}
 */
export function getItemByKey(key) {
  return byKey.get(key) ?? null;
}

/**
 * @returns {Promise<Map<string, object>>} Lean items keyed by _id string.
 */
export async function getItemMap() {
  if (!loading) {
    loading = loadItems().catch((error) => {
      loading = null;
      throw error;
    });
  }
  await loading;
  return items;
}

export function invalidateItemCache() {
  loading = null;
}

/** Works for both a raw ObjectId and a populated document. */
export function idOf(ref) {
  return ref ? String(ref._id ?? ref) : null;
}

/**
 * Same result as calculateCombinedStats() on a fully populated profile,
 * but resolves equipped items from the cache instead of the database.
 * @param {object} player - Profile document (populated or not).
 * @returns {Promise<object>}
 */
export async function getCombinedStats(player) {
  let map = await getItemMap();
  const ids = EQUIP_SLOTS.map((slot) => idOf(player.equipped?.[slot]));

  // An unknown id usually means an item was added after startup. Reload
  // once (rate-limited so a deleted item can't cause a query storm).
  const missing = ids.some((id) => id && !map.has(id));
  if (missing && Date.now() - loadedAt > MIN_REFRESH_MS) {
    invalidateItemCache();
    map = await getItemMap();
  }

  const equipped = {};
  EQUIP_SLOTS.forEach((slot, i) => {
    equipped[slot] = ids[i] ? (map.get(ids[i]) ?? null) : null;
  });

  return calculateCombinedStats({
    baseStats: player.baseStats,
    equipped,
    talents: player.talents,
  });
}
