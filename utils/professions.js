/**
 * Profession state, gathering and crafting.
 *
 * The profile stores `professions: { <id>: { xp, level } }` as a Map; every
 * helper here also accepts a plain object so tests and old profiles work.
 */
import {
  CRAFT_IDS,
  GATHER_IDS,
  MAX_PROFESSION_LEVEL,
  PROFESSIONS,
  PROFESSION_IDS,
  xpToNextProfessionLevel,
} from "../config/professions.js";
import { getItemByKey, getItemMap, idOf } from "./itemCache.js";
import { addItem, countItem, hasItems, removeItem, slotItemKey } from "./inventory.js";

/** In-memory gather cooldowns: `${userId}:${professionId}` -> timestamp. */
const cooldowns = new Map();

function readEntry(player, id) {
  const source = player.professions;
  if (!source) return { xp: 0, level: 1 };

  if (typeof source.get === "function") {
    const entry = source.get(id);
    return { xp: entry?.xp ?? 0, level: entry?.level ?? 1 };
  }
  const entry = source[id];
  return { xp: entry?.xp ?? 0, level: entry?.level ?? 1 };
}

function writeEntry(player, id, entry) {
  if (!player.professions || typeof player.professions.set !== "function") {
    // Plain object (tests, or a profile saved before the map existed).
    player.professions = player.professions ?? {};
    if (typeof player.professions.set !== "function") {
      player.professions[id] = { xp: entry.xp, level: entry.level };
      return;
    }
  }
  player.professions.set(id, { xp: entry.xp, level: entry.level });
}

/**
 * Current profession state.
 * @param {any} player
 * @param {string} id
 * @returns {{xp: number, level: number}}
 */
export function professionOf(player, id) {
  const entry = readEntry(player, id);
  return {
    xp: Math.max(0, entry.xp),
    level: Math.min(MAX_PROFESSION_LEVEL, Math.max(1, entry.level)),
  };
}

/** Every profession as `{ id, name, level, xp, needed }`, in display order. */
export function professionList(player) {
  return PROFESSION_IDS.map((id) => {
    const state = professionOf(player, id);
    return {
      id,
      name: PROFESSIONS[id].name,
      kind: PROFESSIONS[id].kind,
      emoji: PROFESSIONS[id].emoji,
      level: state.level,
      xp: state.xp,
      needed: xpToNextProfessionLevel(state.level),
    };
  });
}

/**
 * Adds xp to a profession and levels it up as many times as the xp allows.
 * @returns {{level: number, leveled: number}}
 */
export function addProfessionXp(player, id, amount) {
  const state = professionOf(player, id);
  let xp = state.xp + Math.max(0, Math.floor(amount));
  let level = state.level;
  let leveled = 0;

  while (level < MAX_PROFESSION_LEVEL && xp >= xpToNextProfessionLevel(level)) {
    xp -= xpToNextProfessionLevel(level);
    level += 1;
    leveled += 1;
  }

  if (level >= MAX_PROFESSION_LEVEL) xp = 0;
  writeEntry(player, id, { xp, level });
  return { level, leveled };
}

/** Seconds left on a profession's cooldown (0 when ready). */
export function cooldownLeft(player, id) {
  const key = `${player.userId}:${id}`;
  const ready = cooldowns.get(key) ?? 0;
  return Math.max(0, Math.ceil((ready - Date.now()) / 1000));
}

/** Clears every cooldown (tests / a "rest" action). */
export function clearCooldowns() {
  cooldowns.clear();
}

/**
 * Gathers with a gathering profession.
 *
 * @returns {{ok: boolean, message: string, yields?: Array<{key: string, name: string, quantity: number}>, leveled?: number, cooldown?: number}}
 */
export function gather(player, id) {
  const profession = PROFESSIONS[id];
  if (!profession || profession.kind !== "gather") {
    return { ok: false, message: "That is not a gathering profession." };
  }

  const waiting = cooldownLeft(player, id);
  if (waiting > 0) {
    return { ok: false, message: `${profession.name} is on cooldown for ${waiting}s.`, cooldown: waiting };
  }

  const yielded = new Map();
  for (const roll of profession.yields ?? []) {
    if (Math.random() > roll.chance) continue;
    const quantity =
      roll.min + Math.floor(Math.random() * Math.max(1, roll.max - roll.min + 1));
    yielded.set(roll.id, (yielded.get(roll.id) ?? 0) + quantity);
  }

  if (yielded.size === 0 && profession.yields?.length > 0) {
    // Never let a full cooldown come back empty: the first table entry is the
    // guaranteed find, the rest are bonus rolls.
    const base = profession.yields[0];
    const quantity = Math.max(1, base.min ?? 1);
    yielded.set(base.id, quantity);
  }

  const items = [];
  for (const [key, quantity] of yielded) {
    if (!addItem(player, key, quantity)) continue;
    const doc = getItemByKey(key);
    items.push({ key, name: doc?.name ?? key, quantity });
  }

  const { leveled } = addProfessionXp(player, id, profession.xpGain ?? 10);
  cooldowns.set(`${player.userId}:${id}`, Date.now() + profession.cooldownMs);

  const summary = items
    .map((entry) => `${entry.name} ×${entry.quantity}`)
    .join(", ");

  return {
    ok: true,
    message: `${profession.verb} and get ${summary}.${leveled > 0 ? ` ⭐ ${profession.name} level up!` : ""}`,
    yields: items,
    leveled,
  };
}

/**
 * Crafts one recipe.
 *
 * @param {any} player
 * @param {string} professionId
 * @param {string} recipeId
 * @returns {{ok: boolean, message: string, output?: {key: string, quantity: number}}}
 */
export function craft(player, professionId, recipeId) {
  const profession = PROFESSIONS[professionId];
  if (!profession || profession.kind !== "craft") {
    return { ok: false, message: "That is not a crafting profession." };
  }

  const recipe = (profession.recipes ?? []).find((entry) => entry.id === recipeId);
  if (!recipe) return { ok: false, message: "Unknown recipe." };

  const state = professionOf(player, professionId);
  if (state.level < (recipe.requiresLevel ?? 1)) {
    return {
      ok: false,
      message: `${profession.name} level ${recipe.requiresLevel} required (you are ${state.level}).`,
    };
  }

  if (!hasItems(player, recipe.cost)) {
    const missing = Object.entries(recipe.cost)
      .filter(([key, quantity]) => countItem(player, key) < quantity)
      .map(([key, quantity]) => {
        const doc = getItemByKey(key);
        return `${doc?.name ?? key} ×${quantity}`;
      });
    return { ok: false, message: `You still need ${missing.join(", ")}.` };
  }

  for (const [key, quantity] of Object.entries(recipe.cost)) {
    removeItem(player, key, quantity);
  }

  const outputKey = recipe.output?.id ?? recipe.id;
  const outputQuantity = recipe.output?.quantity ?? 1;
  addItem(player, outputKey, outputQuantity);

  const { leveled } = addProfessionXp(player, professionId, recipe.xp ?? 10);
  const doc = getItemByKey(outputKey);

  return {
    ok: true,
    message: `You craft ${doc?.name ?? outputKey} ×${outputQuantity}.${leveled > 0 ? ` ⭐ ${profession.name} level up!` : ""}`,
    output: { key: outputKey, quantity: outputQuantity },
    leveled,
  };
}

/** True when the recipe can be made right now (used to grey out buttons). */
export function canCraft(player, recipe, items) {
  return hasItems(player, recipe.cost, items);
}

/** Gear the bag icons need: item id -> doc, for a list of keys. */
export function itemDocsFor(keys) {
  return keys
    .map((key) => getItemByKey(key))
    .filter(Boolean)
    .map((doc) => ({ key: doc.itemId, id: idOf(doc) }));
}

export { CRAFT_IDS, GATHER_IDS };
export { slotItemKey };
