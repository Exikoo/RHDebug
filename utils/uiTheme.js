/**
 * Shared look & feel for every screen of the game.
 *
 * The goal is the "handheld console" layout Legends of Discord uses:
 *   score title -> area band -> screen -> compact stat row -> activity log
 * with one set of accent colours and matching bar/typography helpers, so the
 * map, the bag, the character sheet and the shop all feel like the same game.
 */

export const COLORS = {
  /** Dark neutral panel, like the console screen bezel. */
  panel: 0x1e1f22,
  /** Overworld / safe areas. */
  world: 0x3b7a57,
  /** Dungeon / combat. */
  dungeon: 0x71368a,
  /** Success (buy, equip, heal). */
  success: 0x3ba55d,
  /** Danger (quit, trash, low HP). */
  danger: 0xed4245,
  /** Interactive (movement, selection). */
  primary: 0x5865f2,
  /** Muted / informational. */
  muted: 0x4e5058,
  /** Currency. */
  gold: 0xd4a017,
};

/** Width (in monospace characters) used for the centred area band. */
const BAND_WIDTH = 34;

/**
 * Picks the accent colour for a map.
 * @param {object} map
 * @returns {number}
 */
export function colorForMap(map) {
  if (!map) return COLORS.panel;
  return map.mapType === "dungeon" || map.mapType === "building"
    ? COLORS.dungeon
    : COLORS.world;
}

/**
 * Centred, code-block area name — the dark strip under the score title in
 * the original screen.
 * @param {string} name
 * @returns {string}
 */
export function areaBand(name) {
  const text = String(name ?? "").slice(0, BAND_WIDTH - 2);
  const left = Math.max(0, Math.floor((BAND_WIDTH - text.length) / 2));
  const right = Math.max(0, BAND_WIDTH - text.length - left);
  return "```\n" + " ".repeat(left) + text + " ".repeat(right) + "\n```";
}

/**
 * The map name plus the run depth, e.g. `The City of RuneHero`.
 * @param {object} map
 * @param {number} [depth]
 * @returns {string}
 */
export function areaLabel(map, depth) {
  const name = map?.name ?? "Unknown Area";
  return depth ? `${name} — Depth ${depth}` : name;
}

/**
 * LoD draws progress as a filled bar of blocks; this is the same idea in
 * text so it survives any font.
 * @param {number} current
 * @param {number} max
 * @param {number} [size]
 * @returns {string}
 */
export function renderBar(current, max, size = 10) {
  const safeMax = Math.max(1, max || 1);
  const ratio = Math.min(1, Math.max(0, (current || 0) / safeMax));
  const filled = Math.round(ratio * size);
  return "█".repeat(filled) + "░".repeat(size - filled);
}

/**
 * Colours a bar emoji so HP/MP/XP read at a glance.
 * @param {"hp"|"mp"|"xp"} kind
 * @param {number} current
 * @param {number} max
 * @param {number} [size]
 * @returns {string}
 */
export function renderGauge(kind, current, max, size = 10) {
  const icon = kind === "hp" ? "❤️" : kind === "mp" ? "🔷" : "⭐";
  // A character with no mana (Warrior) genuinely has 0/0, not 0/1.
  const safeMax = Math.max(0, Math.floor(max || 0));
  const safeCurrent = Math.min(safeMax, Math.max(0, Math.floor(current || 0)));
  return `${icon} \`${renderBar(safeCurrent, safeMax, size)}\` ${safeCurrent}/${safeMax}`;
}

/**
 * The four log lines under the stats, always exactly `count` lines so the
 * panel never changes height between renders (a LoD screen trait).
 * @param {string[]} messages
 * @param {number} [count]
 * @returns {string}
 */
export function activityLog(messages = [], count = 4) {
  const lines = messages.slice(0, count);
  while (lines.length < count) lines.push("");
  return lines.map((line) => `> ${line || "\u200b"}`).join("\n");
}

/**
 * "Score" is what the original screen puts in the title — total experience
 * earned plus gold, so exploring and selling both move the number.
 * @param {object} player
 * @returns {number}
 */
export function scoreOf(player) {
  return (player?.experience || 0) + (player?.gold || 0);
}

/**
 * Number formatting with thousands separators, used for gold/score.
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}
