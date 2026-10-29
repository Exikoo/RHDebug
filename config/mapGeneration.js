import { plains1Map } from "../data/plains1.js";

/**
 * Maps that get randomly decorated on top of a hand-made base layout.
 * Keyed by the map's `mapId` in the database.
 *
 * Rules (see utils/mapGenerator.js):
 *   replace - the tile to look for
 *   with    - tile (or array of tiles, one picked at random) to swap in
 *   oneIn   - each matching tile has a 1-in-N chance of being swapped
 *
 * Add more maps here (e.g. a dungeon floor) and they will be generated
 * on startup and become available to the /regenmap developer command.
 */
export const GENERATED_MAPS = {
  plains1: {
    name: "Plains",
    base: plains1Map,
    rules: [{ replace: "G", with: "T", oneIn: 12 }],
  },
};
