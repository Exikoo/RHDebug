/**
 * Quest board: accepting, advancing and completing quests.
 *
 * A profile holds `quests: [{ id, progress, goal, type, target, daily }]`
 * (max `MAX_QUESTS`) plus `counters.quests` / `counters.dailies` and the
 * `dailyQuestAt` timestamp used for the daily bounty.
 */
import {
  DAILY_COOLDOWN_HOURS,
  DAILY_TEMPLATE,
  MAX_QUESTS,
  QUEST_BY_ID,
  pickQuest,
} from "../config/quests.js";
import { addExperience } from "./progression.js";

/** Quests currently held. */
export function activeQuests(player) {
  return player.quests ?? [];
}

/** Progress line for the screen: `Mine 5 copper ore  3/5`. */
export function questLine(entry) {
  const template = QUEST_BY_ID.get(entry.id);
  const title = template?.title ?? entry.id;
  const text = template?.text ?? "";
  return { title, text, progress: entry.progress ?? 0, goal: entry.goal ?? 1 };
}

/**
 * Accepts a new quest from the board.
 * @returns {{ok: boolean, message: string, entry?: object}}
 */
export function acceptQuest(player, exclude = []) {
  player.quests = player.quests ?? [];
  if (player.quests.length >= MAX_QUESTS) {
    return { ok: false, message: `You can only hold ${MAX_QUESTS} quests at once.` };
  }

  const held = player.quests.map((entry) => entry.id);
  const template = pickQuest([...held, ...exclude]);

  const entry = {
    id: template.id,
    progress: 0,
    goal: template.goal,
    type: template.type,
    target: template.target,
    daily: false,
  };

  player.quests.push(entry);
  return { ok: true, message: `📜 New quest: ${template.title} — ${template.text}`, entry };
}

/** True when the daily bounty can be taken again. */
export function dailyAvailable(player) {
  if (!player.dailyQuestAt) return true;
  const cooldown = DAILY_COOLDOWN_HOURS * 60 * 60 * 1000;
  return Date.now() - new Date(player.dailyQuestAt).getTime() >= cooldown;
}

/**
 * Takes the daily bounty (if the cooldown is over and there is room).
 * @returns {{ok: boolean, message: string}}
 */
export function acceptDaily(player) {
  player.quests = player.quests ?? [];

  if (!dailyAvailable(player)) {
    return { ok: false, message: "The daily bounty is not available yet." };
  }
  if (player.quests.some((entry) => entry.daily)) {
    return { ok: false, message: "You already have a daily bounty." };
  }
  if (player.quests.length >= MAX_QUESTS) {
    return { ok: false, message: `You can only hold ${MAX_QUESTS} quests at once.` };
  }

  player.quests.push({
    id: DAILY_TEMPLATE.id,
    progress: 0,
    goal: DAILY_TEMPLATE.goal,
    type: DAILY_TEMPLATE.type,
    target: DAILY_TEMPLATE.target,
    daily: true,
  });
  player.dailyQuestAt = new Date();

  return { ok: true, message: `🌙 Daily bounty taken: ${DAILY_TEMPLATE.text}` };
}

function matches(entry, type, target) {
  if (entry.type !== type) return false;
  if (!entry.target) return true;
  return entry.target === target;
}

/**
 * Advances every matching quest and pays out the finished ones.
 *
 * @param {any} player
 * @param {"gather"|"craft"|"kill"} type
 * @param {string|null} target item key or monster type
 * @param {number} [amount]
 * @returns {Array<{id: string, title: string, gold: number, xp: number}>}
 */
export function progressQuests(player, type, target = null, amount = 1) {
  const completed = [];
  const remaining = [];
  player.counters = player.counters ?? {};

  for (const entry of player.quests ?? []) {
    if (!matches(entry, type, target)) {
      remaining.push(entry);
      continue;
    }

    entry.progress = Math.min(entry.goal, (entry.progress ?? 0) + amount);
    if (entry.progress < entry.goal) {
      remaining.push(entry);
      continue;
    }

    const template = QUEST_BY_ID.get(entry.id) ?? DAILY_TEMPLATE;
    player.gold = (player.gold ?? 0) + (template.gold ?? 0);
    const { levels } = addExperience(player, template.xp ?? 0);

    player.counters.quests = (player.counters.quests ?? 0) + 1;
    if (entry.daily) {
      player.counters.dailies = (player.counters.dailies ?? 0) + 1;
      player.dailyQuestAt = new Date();
    }

    completed.push({
      id: entry.id,
      title: template.title,
      gold: template.gold ?? 0,
      xp: template.xp ?? 0,
      levels: levels.length,
    });
  }

  player.quests = remaining;
  return completed;
}

/** Abandons the quest at `index`. */
export function abandonQuest(player, index) {
  const entry = (player.quests ?? [])[index];
  if (!entry) return { ok: false, message: "No such quest." };

  const template = QUEST_BY_ID.get(entry.id);
  player.quests.splice(index, 1);
  return { ok: true, message: `Abandoned ${template?.title ?? entry.id}.` };
}
