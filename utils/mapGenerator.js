import { isEnterable } from "./mapUtils.js";

/**
 * Small seeded PRNG (mulberry32). Same seed => same map, which makes
 * generated maps reproducible and easy to debug.
 * @param {number} seed
 * @returns {() => number} Function returning a float in [0, 1).
 */
function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x, y) => `${x},${y}`;
const ORTHOGONAL = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/**
 * Positions that must never be replaced: every `protect` point plus its
 * four neighbours, so spawn points, portals, etc. always have room.
 */
function buildProtectedSet(protect) {
  const set = new Set();
  for (const { x, y } of protect) {
    set.add(key(x, y));
    for (const [dx, dy] of ORTHOGONAL) set.add(key(x + dx, y + dy));
  }
  return set;
}

/**
 * One decoration pass. For each tile matching a rule's `replace`, roll
 * 1..oneIn; on a 1 the tile is swapped. If `with` is an array, a second
 * roll 1..with.length picks which variant to use.
 */
function applyRules(baseMap, rules, protectedSet, rng) {
  return baseMap.map((row, y) =>
    row.map((tile, x) => {
      if (protectedSet.has(key(x, y))) return tile;

      for (const rule of rules) {
        if (rule.replace !== tile) continue;

        const roll = Math.floor(rng() * rule.oneIn) + 1;
        if (roll !== 1) continue;

        const options = Array.isArray(rule.with) ? rule.with : [rule.with];
        return options[Math.floor(rng() * options.length)];
      }

      return tile;
    }),
  );
}

/**
 * Flood-fills from the first protect point and confirms every other
 * protect point can still be reached. Protect points themselves count as
 * passable (a portal tile may not be "walkable" in LEGEND, but it's still
 * a destination).
 */
function allReachable(map, protect) {
  if (protect.length <= 1) return true;

  const targets = new Set(protect.map(({ x, y }) => key(x, y)));
  const passable = (x, y) => targets.has(key(x, y)) || isEnterable(map, x, y);

  const start = protect[0];
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (seen.has(k) || !passable(nx, ny)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }

  return [...targets].every((k) => seen.has(k));
}

/**
 * Returns a decorated copy of `baseMap` (the original is not mutated).
 *
 * @param {string[][]} baseMap - A hand-made layout, e.g. plains1Map.
 * @param {Array<{replace: string, with: string|string[], oneIn: number}>} rules
 *   `oneIn: 12` means each matching tile has a 1-in-12 chance of changing.
 * @param {Object} [options]
 * @param {number} [options.seed] - Fixed seed for reproducible output.
 * @param {Array<{x: number, y: number}>} [options.protect] - Spawn point,
 *   portals, connection tiles, etc. The first entry is the flood-fill origin.
 * @param {number} [options.maxAttempts] - Re-rolls allowed if a roll
 *   disconnects a protected point.
 * @returns {string[][]}
 */
export function decorateMap(baseMap, rules, options = {}) {
  const { seed = Date.now(), protect = [], maxAttempts = 20 } = options;
  const protectedSet = buildProtectedSet(protect);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = mulberry32(seed + attempt);
    const candidate = applyRules(baseMap, rules, protectedSet, rng);
    if (allReachable(candidate, protect)) return candidate;
  }

  throw new Error(
    `decorateMap: no valid layout found in ${maxAttempts} attempts. Lower the replacement rate or loosen the protected points.`,
  );
}
