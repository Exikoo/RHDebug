import MapModel from "../models/Map.js";
import { MONSTER_TEMPLATES } from "../monsterManager.js";

/**
 * Maps almost never change at runtime (only on generation/seeding), but
 * the map handler used to re-read them from MongoDB several times per
 * button press. This keeps them in memory as plain (lean) objects.
 *
 * - Concurrent requests for the same map share one in-flight query.
 * - Entries expire after TTL_MS as a safety net for manual DB edits.
 * - MapManager calls invalidateMap() after (re)generating a map.
 *
 * Returned objects are shared: treat them as read-only.
 */
const TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, {promise: Promise<object|null>, expires: number}>} */
const cache = new Map();

function containsMonster(mapData) {
  return mapData.some((row) => row.some((tile) => MONSTER_TEMPLATES[tile]));
}

async function loadMap(mapId) {
  const doc = await MapModel.findOne({ mapId }).lean();
  if (!doc) return null;

  // Lets callers skip the dead-monster query on maps with no monsters.
  doc.hasMonsters = containsMonster(doc.mapData);
  return doc;
}

/**
 * @param {string} mapId
 * @returns {Promise<(object & {hasMonsters: boolean})|null>}
 */
export function getMap(mapId) {
  const hit = cache.get(mapId);
  if (hit && hit.expires > Date.now()) return hit.promise;

  const entry = { promise: null, expires: Date.now() + TTL_MS };
  const forget = () => {
    if (cache.get(mapId) === entry) cache.delete(mapId);
  };

  entry.promise = loadMap(mapId).then(
    (map) => {
      if (!map) forget(); // don't cache "not found"
      return map;
    },
    (error) => {
      forget(); // don't cache failures
      throw error;
    },
  );

  cache.set(mapId, entry);
  return entry.promise;
}

/**
 * Drops a cached map (or all of them when called without an id).
 * @param {string} [mapId]
 */
export function invalidateMap(mapId) {
  if (mapId === undefined) cache.clear();
  else cache.delete(mapId);
}
