/**
 * Treasure chests.
 *
 * A chest is a tile: you walk onto it and it pays out once, then the tile
 * turns back into the ground it stood on. The payout lives in the map
 * document, so it survives restarts the same way the layout does.
 */
import { getItemByKey } from "./itemCache.js";
import { addItem } from "./inventory.js";

/** What a chest can give: gold range plus one optional item. */
export const CHEST_TABLE = {
  gold: { min: 12, max: 48 },
  itemChance: 0.45,
  items: ["health_potion", "mana_potion", "copper_ore", "oak_log", "river_fish", "bloodroot"],
};

/**
 * Rolls a chest's contents.
 * @param {() => number} [rng]
 * @returns {{gold: number, item: string|null, quantity: number}}
 */
export function rollChest(rng = Math.random) {
  const { min, max } = CHEST_TABLE.gold;
  const gold = min + Math.floor(rng() * (max - min + 1));

  if (rng() > CHEST_TABLE.itemChance) return { gold, item: null, quantity: 0 };

  const item = CHEST_TABLE.items[Math.floor(rng() * CHEST_TABLE.items.length)];
  return { gold, item, quantity: 1 };
}

/**
 * Opens the chest at `(x, y)`: pays the player, swaps the tile back to
 * `ground` and saves the map.
 *
 * @param {any} player
 * @param {any} map - Map document (`mapData`, `save()`).
 * @param {number} x
 * @param {number} y
 * @param {Object} [options]
 * @param {string} [options.ground] - tile to leave behind, defaults to grass.
 * @param {() => number} [options.rng]
 * @returns {Promise<{gold: number, itemKey: string|null, itemName: string|null}>}
 */
export async function openChest(player, map, x, y, options = {}) {
  const { ground = "G", rng = Math.random } = options;
  const loot = rollChest(rng);

  player.gold = (player.gold ?? 0) + loot.gold;

  let itemName = null;
  if (loot.item) {
    const doc = getItemByKey(loot.item);
    if (doc && addItem(player, loot.item, loot.quantity)) {
      itemName = doc.name;
    }
  }

  // The chest is gone from this position from now on.
  if (map?.mapData?.[y]?.[x] === "CHEST") {
    map.mapData[y][x] = ground;
    await map.save?.();
  }

  return { gold: loot.gold, itemKey: loot.item, itemName };
}
