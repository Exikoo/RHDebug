/**
 * Achievement checks.
 *
 * Achievements are purely derived: the profile only stores the ids that were
 * earned (`achievements: [String]`), everything else comes from level,
 * counters and profession levels — so nothing can drift out of sync.
 */
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, TOTAL_POINTS } from "../config/achievements.js";
import { PROFESSION_IDS } from "../config/professions.js";
import { professionOf } from "./professions.js";

/** Snapshot handed to every `check()` predicate. */
export function achievementView(player) {
  const counters = player.counters ?? {};
  const levels = PROFESSION_IDS.map((id) => professionOf(player, id).level);

  return {
    level: player.level ?? 1,
    kills: counters.kills ?? 0,
    bosses: counters.bosses ?? 0,
    gathers: counters.gathers ?? 0,
    crafts: counters.crafts ?? 0,
    quests: counters.quests ?? 0,
    dailies: counters.dailies ?? 0,
    maxProfession: Math.max(...levels, 1),
    minProfession: Math.min(...levels, 1),
    profession: (id) => professionOf(player, id).level,
  };
}

/** Ids the player has earned so far (stored list stays authoritative for old profiles). */
export function earnedIds(player) {
  return new Set(player.achievements ?? []);
}

/**
 * Grants every achievement whose condition is now met.
 * Mutates the profile; the caller saves.
 *
 * @param {any} player
 * @returns {Array<{id: string, name: string, points: number}>} newly earned
 */
export function awardAchievements(player) {
  const view = achievementView(player);
  player.achievements = player.achievements ?? [];
  const owned = new Set(player.achievements);
  const earned = [];

  for (const achievement of ACHIEVEMENTS) {
    if (owned.has(achievement.id)) continue;
    let met = false;
    try {
      met = Boolean(achievement.check(view));
    } catch {
      met = false;
    }
    if (!met) continue;

    owned.add(achievement.id);
    player.achievements.push(achievement.id);
    earned.push({
      id: achievement.id,
      name: achievement.name,
      points: achievement.points,
    });
  }

  return earned;
}

/** `{ earned, total, points, maxPoints }` for the screen header. */
export function achievementProgress(player) {
  const owned = earnedIds(player);
  const points = ACHIEVEMENTS.filter((a) => owned.has(a.id)).reduce(
    (sum, a) => sum + a.points,
    0,
  );

  return {
    earned: owned.size,
    total: ACHIEVEMENTS.length,
    points,
    maxPoints: TOTAL_POINTS,
  };
}

/** Achievements grouped for display, earned first. */
export function achievementGroups(player) {
  const owned = earnedIds(player);
  const view = achievementView(player);

  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    earned: owned.has(achievement.id),
    ready: !owned.has(achievement.id) && safeCheck(achievement, view),
  }));
}

function safeCheck(achievement, view) {
  try {
    return Boolean(achievement.check(view));
  } catch {
    return false;
  }
}

export { ACHIEVEMENT_BY_ID };
