import {
  EMOJI_MAP,
  PLAYER_EMOJI_BY_CLASS,
  VIEW_WIDTH,
  VIEW_HEIGHT,
} from "../config/mapConfig.js";

/**
 * Renders the map as a grid of custom emojis — one emoji per visible tile,
 * rows joined by newlines. This is the "screen" of the game: the 32px tile
 * art comes from the emoji themselves, so nothing is uploaded.
 *
 * Two constraints drive this file, both inherited from Discord:
 *   1. An embed description is capped at 4096 characters, and every custom
 *      emoji costs 30-48 characters of markup (`<:shoals_deep_water_1_shape:…>`).
 *      A full 16x7 screen of wide water tiles already costs ~5.4k characters,
 *      so the viewport has to shrink until it fits, or `setDescription`
 *      throws and the whole screen fails to render.
 *   2. The screen should stay a fixed size while the player walks around, so
 *      the map scrolls like a camera instead of resizing on every step.
 */

/** Discord's hard limit for embed descriptions. */
const MAX_DESCRIPTION = 4096;

/** Space kept free for the area band and separators added around the grid. */
const DESCRIPTION_RESERVE = 120;

const MAX_VIEW = { width: VIEW_WIDTH, height: VIEW_HEIGHT };
const MIN_VIEW = { width: 8, height: 4 };

/** Safe respawn point used when a position is outside the map. */
const SPAWN = { x: 8, y: 5 };

/**
 * Emoji for a tile, falling back to a wall glyph so an unknown/new tile is
 * still visible instead of breaking the row alignment.
 * @param {string} tile
 * @returns {string}
 */
function emojiFor(tile) {
  return EMOJI_MAP[tile] ?? EMOJI_MAP.W ?? "⬛";
}

/**
 * Player tile emoji. Classes can get their own avatar emoji by filling in
 * PLAYER_EMOJI_BY_CLASS in config/mapConfig.js; everyone else shares `P`.
 * @param {string} [playerClass]
 * @returns {string}
 */
function playerEmoji(playerClass) {
  return (
    (playerClass && PLAYER_EMOJI_BY_CLASS?.[playerClass]) ??
    EMOJI_MAP.P ??
    "❓"
  );
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Camera window centred on the player and clamped to the map edges, so the
 * grid never scrolls past the last row/column.
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @param {{x: number, y: number}} pos
 * @param {number} width
 * @param {number} height
 */
function centredView(mapWidth, mapHeight, pos, width, height) {
  return {
    x: clamp(pos.x - Math.floor(width / 2), 0, Math.max(0, mapWidth - width)),
    y: clamp(pos.y - Math.floor(height / 2), 0, Math.max(0, mapHeight - height)),
    width,
    height,
  };
}

function buildRows(mapData, view, pos, playerClass) {
  const rows = [];

  for (let y = view.y; y < view.y + view.height; y++) {
    let row = "";
    for (let x = view.x; x < view.x + view.width; x++) {
      const isPlayer = x === pos.x && y === pos.y;
      row += isPlayer ? playerEmoji(playerClass) : emojiFor(mapData[y][x]);
    }
    rows.push(row);
  }

  return rows;
}

/**
 * @typedef {Object} MapView
 * @property {string[]} rows          One string per visible map row.
 * @property {{x:number,y:number,width:number,height:number}} viewport
 * @property {{width:number,height:number}} mapSize
 * @property {boolean} clamped        Player position had to be corrected.
 * @property {boolean} windowed       Only part of the map is visible.
 */

/**
 * Builds the visible screen for a map.
 * @param {string[][]} mapData
 * @param {{x: number, y: number}} playerPos
 * @param {Object} [options]
 * @param {string} [options.playerClass] Used to pick the avatar emoji.
 * @param {number} [options.maxWidth]
 * @param {number} [options.maxHeight]
 * @param {number} [options.charBudget] Max characters for the joined grid.
 * @returns {MapView}
 */
export function renderMapView(mapData, playerPos, options = {}) {
  if (!Array.isArray(mapData) || mapData.length === 0) {
    console.error("Invalid map data:", mapData);
    return {
      rows: ["❌ Map data is invalid"],
      viewport: { x: 0, y: 0, width: 0, height: 0 },
      mapSize: { width: 0, height: 0 },
      clamped: false,
      windowed: false,
    };
  }

  const mapHeight = mapData.length;
  const mapWidth = mapData[0]?.length ?? 0;

  const requested = {
    x: Number.isFinite(playerPos?.x) ? playerPos.x : SPAWN.x,
    y: Number.isFinite(playerPos?.y) ? playerPos.y : SPAWN.y,
  };

  const inBounds =
    requested.x >= 0 &&
    requested.x < mapWidth &&
    requested.y >= 0 &&
    requested.y < mapHeight;

  // Never mutate the caller's position: clamping is a display concern, and
  // a mutate-in-place render used to leave the profile and the screen out of
  // sync.
  const pos = inBounds
    ? requested
    : { x: clamp(SPAWN.x, 0, mapWidth - 1), y: clamp(SPAWN.y, 0, mapHeight - 1) };

  if (!inBounds) {
    console.warn(
      `Player position (${requested.x},${requested.y}) is outside map bounds ` +
        `(${mapWidth}x${mapHeight}); drawing at (${pos.x},${pos.y}).`,
    );
  }

  const maxWidth = Math.max(1, options.maxWidth ?? MAX_VIEW.width);
  const maxHeight = Math.max(1, options.maxHeight ?? MAX_VIEW.height);
  const budget = Math.max(
    500,
    (options.charBudget ?? MAX_DESCRIPTION) - DESCRIPTION_RESERVE,
  );

  let width = Math.min(maxWidth, mapWidth);
  let height = Math.min(maxHeight, mapHeight);

  let view;
  let rows;

  // Shrink the window until the emoji markup fits the description budget.
  // Wide tiles (water, shops) are ~48 characters each, so this can matter a
  // lot on water-heavy maps.
  for (;;) {
    view = centredView(mapWidth, mapHeight, pos, width, height);
    rows = buildRows(mapData, view, pos, options.playerClass);

    if (rows.join("\n").length <= budget) break;

    if (width > MIN_VIEW.width) width -= 1;
    else if (height > MIN_VIEW.height) height -= 1;
    else break;
  }

  return {
    rows,
    viewport: view,
    mapSize: { width: mapWidth, height: mapHeight },
    clamped: !inBounds,
    windowed: view.width < mapWidth || view.height < mapHeight,
  };
}

/**
 * Backwards-compatible helper: just the rows of the map.
 * @param {string[][]} worldMap
 * @param {{x: number, y: number}} playerPos
 * @param {string} [playerClass]
 * @returns {string[]}
 */
export function generateMapRows(worldMap, playerPos, playerClass) {
  return renderMapView(worldMap, playerPos, { playerClass }).rows;
}
