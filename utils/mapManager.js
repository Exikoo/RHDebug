import MapModel from "../models/Map.js";
import Monster from "../models/Monster.js";
import Profile from "../models/Profile.js";
import { GENERATED_MAPS } from "../config/mapGeneration.js";
import { decorateMap } from "./mapGenerator.js";
import { isEnterable, tileAt } from "./mapUtils.js";
import { invalidateMap } from "./mapCache.js";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function isPoint(p) {
  return p && Number.isInteger(p.x) && Number.isInteger(p.y);
}

/**
 * Everything on this map the generator must not block: its connection
 * tiles, event tiles, and the arrival points other maps send players to.
 * Read from the database so existing portals keep working.
 */
async function collectProtectedPoints(mapId, existing) {
  const points = [];
  const add = (p) => {
    if (isPoint(p)) points.push({ x: p.x, y: p.y });
  };

  if (existing) {
    for (const conn of existing.connections ?? []) add(conn.fromPosition);
    for (const event of existing.events ?? []) add(event.position);
  }

  const incoming = await MapModel.find({ "connections.targetMapId": mapId });
  for (const other of incoming) {
    for (const conn of other.connections ?? []) {
      if (conn.targetMapId === mapId) add(conn.targetPosition);
    }
  }

  return points;
}

function countChangedTiles(before, after) {
  let changed = 0;
  for (let y = 0; y < before.length; y++) {
    for (let x = 0; x < before[y].length; x++) {
      if (before[y][x] !== after[y][x]) changed++;
    }
  }
  return changed;
}

class MapManager {
  /**
   * Generates every map in GENERATED_MAPS that hasn't been generated yet
   * (missing from the DB, or saved without a generation seed). Maps that
   * already have a seed are left alone so layouts stay stable across
   * restarts. One failing map is logged and skipped, not fatal.
   */
  static async initializeMaps() {
    for (const mapId of Object.keys(GENERATED_MAPS)) {
      try {
        const existing = await MapModel.findOne({ mapId });
        if (existing?.generationSeed != null) continue;

        const { seed, changed } = await this.regenerateMap(mapId);
        console.log(
          `Map "${mapId}" generated (seed ${seed}, ${changed} tiles changed)`,
        );
      } catch (error) {
        console.error(`Failed to generate map "${mapId}":`, error);
      }
    }
  }

  /**
   * Re-rolls a generated map's decorations and saves it. Only `mapData`,
   * its size and its seed are touched — spawn point, connections and
   * events on an existing map are preserved (and protected from the
   * generator). Also resets monsters on that map and moves any player
   * left standing on a blocked tile back to the spawn point.
   * @param {string} mapId
   * @returns {Promise<{seed: number, changed: number}>}
   */
  static async regenerateMap(mapId) {
    const def = GENERATED_MAPS[mapId];
    if (!def) throw new Error(`No generation config for map "${mapId}"`);

    const height = def.base.length;
    const width = def.base[0].length;
    const existing = await MapModel.findOne({ mapId });

    const spawn = existing
      ? { x: existing.defaultSpawnPoint.x, y: existing.defaultSpawnPoint.y }
      : { x: Math.floor(width / 2), y: Math.floor(height / 2) };

    const protect = [
      spawn,
      ...(await collectProtectedPoints(mapId, existing)),
    ].filter((p) => tileAt(def.base, p.x, p.y) !== null);

    const seed = newSeed();
    const mapData = decorateMap(def.base, def.rules, { seed, protect });

    if (existing) {
      existing.mapData = mapData;
      existing.markModified("mapData");
      existing.width = width;
      existing.height = height;
      existing.generationSeed = seed;
      await existing.save();
    } else {
      await MapModel.create({
        mapId,
        name: def.name,
        mapData,
        width,
        height,
        defaultSpawnPoint: spawn,
        generationSeed: seed,
      });
    }

    // The map handler serves maps from memory; make it pick up the new layout.
    invalidateMap(mapId);

    // Monster rows are keyed by coordinates, so old ones are stale now.
    await Monster.deleteMany({ mapId });

    const players = await Profile.find({ currentMapId: mapId });
    for (const player of players) {
      if (!isEnterable(mapData, player.location.x, player.location.y)) {
        await Profile.updateOne(
          { _id: player._id },
          { $set: { location: { ...spawn } } },
        );
      }
    }

    return { seed, changed: countChangedTiles(def.base, mapData) };
  }
}

export default MapManager;
