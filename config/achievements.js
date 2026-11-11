/**
 * Achievements: pure data plus a `check(player, view)` predicate.
 *
 * `view` is the small snapshot `utils/achievements.js` builds once per check:
 *   { level, kills, bosses, gathers, crafts, quests, profession: fn, maxProfession }
 *
 * `points` feed the ranking screen, so achievements are worth chasing.
 */

export const CATEGORIES = {
  level: "Level",
  combat: "Combat",
  profession: "Professions",
  quest: "Quests",
};

export const ACHIEVEMENTS = [
  // ------------------------------------------------------------------ level
  { id: "lvl_2", category: "level", name: "First Steps", description: "Reach level 2", points: 5, check: (v) => v.level >= 2 },
  { id: "lvl_5", category: "level", name: "Novice Adventurer", description: "Reach level 5", points: 10, check: (v) => v.level >= 5 },
  { id: "lvl_10", category: "level", name: "Seasoned", description: "Reach level 10", points: 20, check: (v) => v.level >= 10 },
  { id: "lvl_20", category: "level", name: "Veteran", description: "Reach level 20", points: 40, check: (v) => v.level >= 20 },

  // ----------------------------------------------------------------- combat
  { id: "kill_1", category: "combat", name: "First Blood", description: "Defeat a monster", points: 5, check: (v) => v.kills >= 1 },
  { id: "kill_10", category: "combat", name: "Hunter", description: "Defeat 10 monsters", points: 10, check: (v) => v.kills >= 10 },
  { id: "kill_50", category: "combat", name: "Slayer", description: "Defeat 50 monsters", points: 25, check: (v) => v.kills >= 50 },
  { id: "boss_1", category: "combat", name: "Giant Killer", description: "Defeat a dungeon boss", points: 30, check: (v) => v.bosses >= 1 },

  // ------------------------------------------------------------- professions
  { id: "prof_first", category: "profession", name: "Working Hands", description: "Gather for the first time", points: 5, check: (v) => v.gathers >= 1 },
  { id: "prof_any_3", category: "profession", name: "Apprentice", description: "Get any profession to level 3", points: 15, check: (v) => v.maxProfession >= 3 },
  { id: "prof_any_5", category: "profession", name: "Journeyman", description: "Get any profession to level 5", points: 25, check: (v) => v.maxProfession >= 5 },
  { id: "prof_all_2", category: "profession", name: "Jack of All Trades", description: "Get every profession to level 2", points: 40, check: (v) => v.minProfession >= 2 },
  { id: "craft_first", category: "profession", name: "Artisan", description: "Craft your first item", points: 10, check: (v) => v.crafts >= 1 },
  { id: "craft_10", category: "profession", name: "Master Craftsman", description: "Craft 10 items", points: 25, check: (v) => v.crafts >= 10 },

  // ------------------------------------------------------------------ quests
  { id: "quest_first", category: "quest", name: "Errand Runner", description: "Finish a quest", points: 10, check: (v) => v.quests >= 1 },
  { id: "quest_10", category: "quest", name: "Questmaster", description: "Finish 10 quests", points: 30, check: (v) => v.quests >= 10 },
  { id: "daily_first", category: "quest", name: "Daily Habit", description: "Finish a daily bounty", points: 20, check: (v) => v.dailies >= 1 },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const TOTAL_POINTS = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);
