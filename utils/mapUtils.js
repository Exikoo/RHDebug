import { MONSTER_TEMPLATES } from "../monsterManager.js";
import { LEGEND } from "../config/mapConfig.js";

/**
 * Returns the tile at (x, y) or null if out of bounds.
 * @param {Array} mapData
 * @param {number} x
 * @param {number} y
 * @returns {string|null}
 */
export function tileAt(mapData, x, y) {
  if (!Array.isArray(mapData[y])) return null;
  if (x < 0 || x >= mapData[y].length) return null;
  return mapData[y][x];
}

/**
 * @param {string} tile
 * @returns {boolean}
 */
export function isMonsterTile(tile) {
  return Boolean(MONSTER_TEMPLATES[tile]);
}

/**
 * @param {string} tile
 * @returns {boolean}
 */
export function isWalkable(tile) {
  return Boolean(LEGEND[tile]?.walkable);
}

/**
 * Returns true if a player can step onto the tile at (x, y).
 * Monster tiles are enterable (they trigger combat).
 * @param {Array} mapData
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isEnterable(mapData, x, y) {
  const tile = tileAt(mapData, x, y);
  if (tile === null) return false;
  if (isMonsterTile(tile)) return true;
  return isWalkable(tile);
}

/**
 * Iterates the four orthogonal neighbours of (x, y).
 * @param {number} x
 * @param {number} y
 * @returns {Array<{x: number, y: number, dir: string}>}
 */
export function orthogonalNeighbours(x, y) {
  return [
    { x, y: y - 1, dir: "up" },
    { x, y: y + 1, dir: "down" },
    { x: x - 1, y, dir: "left" },
    { x: x + 1, y, dir: "right" },
  ];
}
