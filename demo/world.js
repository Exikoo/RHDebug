/**
 * The demo: a from-scratch rebuild of the very first Legends of Discord
 * prototype screen — a name panel with HP/Mana bars, a green field with a
 * walking sprite, a coordinate line and the original 4x4 number pad.
 *
 * Everything here is plain in-memory data. No database, no profiles, no
 * map documents: one small object per player, thrown away on restart.
 */
import { emojiId } from "../config/emojiIds.js";


/** Visible field, in tiles. Sixteen emojis fit an embed line comfortably. */
export const VIEW = { width: 16, height: 7 };

/** The field is bigger than the window, so the camera has to scroll. */
export const WORLD = { width: 24, height: 14 };

/** Where a new player starts — the same spot the gif opens on. */
export const SPAWN = { x: 8, y: 7 };

/** Starting vitals, exactly as printed in the gif. */
export const VITALS = { maxHp: 10, maxMana: 6 };

/**
 * The number pad *is* the compass: the layout on screen is the map.
 *
 * ```
 *  7  N  .  .      north-west, north, (spare), (spare)
 *  6  .  1  .      west,       centre, north-east, (spare)
 *  5  4  2  3      south-west, south,  south-east, east
 * ```
 *
 * `8` and `9` were never in the original pad, so north lives on the empty
 * cell above `4` — it looks blank and still walks north.
 */
export const DIRECTIONS = {
  "7": { dx: -1, dy: -1 },
  north: { dx: 0, dy: -1 },
  "6": { dx: -1, dy: 0 },
  "1": { dx: 1, dy: -1 },
  "5": { dx: -1, dy: 1 },
  "4": { dx: 0, dy: 1 },
  "2": { dx: 1, dy: 1 },
  "3": { dx: 1, dy: 0 },
};

/** Unicode stand-ins used until the emojis are uploaded (or missing in a guild). */
export const FALLBACK = {
  grass: "🟩",
  sprite: "🧍",
  hpFull: "🟥",
  hpEmpty: "⬛",
  manaFull: "🟦",
  manaEmpty: "⬛",
};

/**
 * `<:name:id>` when the emoji is configured *and* the client can see it,
 * the unicode stand-in otherwise. A client with no cache (tests, startup)
 * trusts the configuration.
 *
 * @param {string} name
 * @param {string} fallback
 * @param {import("discord.js").Client|null} [client]
 */
export function glyph(name, fallback, client = null) {
  const id = emojiId(name);
  if (!id) return fallback;

  const cache = client?.emojis?.cache;
  if (cache && typeof cache.has === "function" && !cache.has(id)) return fallback;

  return `<:${name}:${id}>`;
}

/**
 * The field's tiles, all built from the tileset art in `tileset/` (see
 * scripts/build-demo-emojis.mjs): two grass variants for the speckle and
 * the walking sprite.
 *
 * @param {import("discord.js").Client|null} [client]
 */
export function fieldGlyphs(client = null) {
  return {
    grass: glyph("demo_grass_1", FALLBACK.grass, client),
    grassDark: glyph("demo_grass_2", FALLBACK.grass, client),
    sprite: glyph("demo_player", FALLBACK.sprite, client),
  };
}

/**
 * Which grass tile a square uses. A 2D hash rather than `x + y`: it scatters
 * the dark tiles instead of drawing diagonal stripes, and it is
 * deterministic, so the same field looks the same on every render.
 * Roughly one dark tile in six.
 *
 * @param {number} x
 * @param {number} y
 */
export function grassAt(x, y) {
  const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return noise - Math.floor(noise) < 0.18 ? "grassDark" : "grass";
}

/** A brand new game for one user. */
export function createGame({ userId, name }) {
  return {
    userId,
    name,
    // The window slides only when the player reaches its edge, so walking
    // is always visible on screen.
    camera: {
      x: Math.min(Math.max(0, SPAWN.x - Math.floor(VIEW.width / 2)), WORLD.width - VIEW.width),
      y: Math.min(Math.max(0, SPAWN.y - Math.floor(VIEW.height / 2)), WORLD.height - VIEW.height),
    },
    hp: VITALS.maxHp,
    maxHp: VITALS.maxHp,
    mana: VITALS.maxMana,
    maxMana: VITALS.maxMana,
    x: SPAWN.x,
    y: SPAWN.y,
    area: "",
    history: [],
    startedAt: Date.now(),
  };
}

/** Keeps a coordinate on the field. */
function clamp(value, max) {
  return Math.min(Math.max(0, value), max - 1);
}

/**
 * Walks one step in a compass direction.
 * @returns {{moved: boolean, blocked: boolean}}
 */
export function move(game, direction) {
  const step = DIRECTIONS[direction];
  if (!step) return { moved: false, blocked: false };

  const nextX = game.x + step.dx;
  const nextY = game.y + step.dy;
  const blocked =
    nextX < 0 || nextY < 0 || nextX >= WORLD.width || nextY >= WORLD.height;

  if (blocked) return { moved: false, blocked: true };

  game.history.push({ x: game.x, y: game.y });
  if (game.history.length > 200) game.history.shift();
  game.x = nextX;
  game.y = nextY;
  follow(game);

  return { moved: true, blocked: false };
}

/**
 * The `-1` button: back to where you were.
 * @returns {{moved: boolean}}
 */
export function undo(game) {
  const previous = game.history.pop();
  if (!previous) return { moved: false };

  game.x = clamp(previous.x, WORLD.width);
  game.y = clamp(previous.y, WORLD.height);
  follow(game);
  return { moved: true };
}

/** Slide the window just enough to keep the player inside it. */
function follow(game) {
  const camera = game.camera;

  if (game.x < camera.x) camera.x = game.x;
  if (game.x >= camera.x + VIEW.width) camera.x = game.x - VIEW.width + 1;
  if (game.y < camera.y) camera.y = game.y;
  if (game.y >= camera.y + VIEW.height) camera.y = game.y - VIEW.height + 1;

  camera.x = Math.min(Math.max(0, camera.x), WORLD.width - VIEW.width);
  camera.y = Math.min(Math.max(0, camera.y), WORLD.height - VIEW.height);
}

/**
 * The slice of the world currently on screen.
 * @returns {{x: number, y: number}}
 */
export function camera(game) {
  return { x: game.camera.x, y: game.camera.y };
}

/**
 * The visible field, one string per row.
 * @param {object} game
 * @param {{grass?: string, grassDark?: string, sprite?: string}} [glyphs]
 * @returns {string[]}
 */
export function fieldRows(game, glyphs = fieldGlyphs()) {
  const view = camera(game);

  const rows = [];
  for (let row = 0; row < VIEW.height; row += 1) {
    let line = "";
    for (let column = 0; column < VIEW.width; column += 1) {
      const x = view.x + column;
      const y = view.y + row;
      line +=
        x === game.x && y === game.y
          ? glyphs.sprite ?? FALLBACK.sprite
          : glyphs[grassAt(x, y)] ?? FALLBACK.grass;
    }
    rows.push(line);
  }
  return rows;
}
