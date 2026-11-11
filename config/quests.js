/**
 * Quest templates. A profile holds up to `MAX_QUESTS` accepted quests; progress
 * is advanced by `utils/quests.js` from gathering, crafting, kills and quests.
 *
 * `type` decides what counts:
 *   gather - the item id that was gathered
 *   craft  - the item id that was crafted
 *   kill   - any monster (`target` null) or one monster type
 *   level  - reaching a level
 */

export const MAX_QUESTS = 3;

export const QUEST_TEMPLATES = [
  {
    id: "q_copper",
    title: "Quarry Run",
    type: "gather",
    target: "copper_ore",
    goal: 5,
    gold: 40,
    xp: 35,
    text: "Mine 5 copper ore in the hills",
  },
  {
    id: "q_logs",
    title: "Timber!",
    type: "gather",
    target: "oak_log",
    goal: 4,
    gold: 30,
    xp: 30,
    text: "Cut 4 oak logs",
  },
  {
    id: "q_fish",
    title: "Dinner Plans",
    type: "gather",
    target: "river_fish",
    goal: 3,
    gold: 30,
    xp: 25,
    text: "Catch 3 river fish",
  },
  {
    id: "q_herbs",
    title: "The Healer's Errand",
    type: "gather",
    target: "bloodroot",
    goal: 3,
    gold: 35,
    xp: 30,
    text: "Gather 3 bloodroot",
  },
  {
    id: "q_hunt",
    title: "Thin the Herd",
    type: "kill",
    target: null,
    goal: 3,
    gold: 45,
    xp: 40,
    text: "Defeat 3 monsters",
  },
  {
    id: "q_smith",
    title: "Forgemaster",
    type: "craft",
    target: "iron_sword",
    goal: 1,
    gold: 60,
    xp: 50,
    text: "Forge an iron sword",
  },
  {
    id: "q_cook",
    title: "Camp Cook",
    type: "craft",
    target: "cooked_fish",
    goal: 2,
    gold: 35,
    xp: 30,
    text: "Cook 2 river fish",
  },
];

/** Daily quest: bigger reward, refreshed every 20 hours. */
export const DAILY_ID = "q_daily_kill";

export const DAILY_TEMPLATE = {
  id: DAILY_ID,
  title: "Daily Bounty",
  type: "kill",
  target: null,
  goal: 5,
  gold: 120,
  xp: 90,
  daily: true,
  text: "Defeat 5 monsters today",
 };

/** Hours before the daily can be taken again. */
export const DAILY_COOLDOWN_HOURS = 20;

/** `QUEST_BY_ID` lookup for the renderer and the completion notices. */
export const QUEST_BY_ID = new Map(
  [...QUEST_TEMPLATES, DAILY_TEMPLATE].map((quest) => [quest.id, quest]),
);

/** A random non-daily quest the player is not holding yet. */
export function pickQuest(excludeIds = []) {
  const pool = QUEST_TEMPLATES.filter((quest) => !excludeIds.includes(quest.id));
  const list = pool.length > 0 ? pool : QUEST_TEMPLATES;
  return list[Math.floor(Math.random() * list.length)];
}
