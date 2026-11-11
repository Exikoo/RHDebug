/**
 * One game per player, kept in memory. Nothing is persisted: restart the bot
 * and everyone is back at `x: 8, y: 7`.
 */
import { createGame } from "./world.js";

/** Games idle for longer than this are dropped. */
export const IDLE_MS = 60 * 60 * 1000;

/** @type {Map<string, object>} */
const games = new Map();

/**
 * @param {{userId: string, name: string}} player
 * @returns {object} The existing game, or a fresh one.
 */
export function gameFor({ userId, name }) {
  const existing = games.get(userId);
  if (existing) {
    existing.lastSeen = Date.now();
    if (name && name !== existing.name) existing.name = name;
    return existing;
  }

  const game = createGame({ userId, name });
  game.lastSeen = Date.now();
  games.set(userId, game);
  return game;
}

/** Forgets every game that has been idle for too long. */
export function pruneGames(now = Date.now()) {
  let removed = 0;
  for (const [userId, game] of games) {
    if (now - (game.lastSeen ?? now) > IDLE_MS) {
      games.delete(userId);
      removed += 1;
    }
  }
  return removed;
}

/** Test hook. */
export function resetGames() {
  games.clear();
}

export function gameCount() {
  return games.size;
}
