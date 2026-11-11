/**
 * The seven professions, Legends-of-Discord style.
 *
 * Four gathering professions produce materials on a short cooldown, three
 * crafting professions turn those materials into gear and food. Nothing here
 * touches the database: `utils/professions.js` does the work and the screens
 * only render.
 */

/** Gathering: press the button, get materials (one cooldown per profession). */
export const GATHER_IDS = ["mining", "woodcutting", "fishing", "herbalism"];

/** Crafting: pick a recipe, pay the materials, get the item. */
export const CRAFT_IDS = ["smithing", "crafting", "cooking"];

export const PROFESSION_IDS = [...GATHER_IDS, ...CRAFT_IDS];

/**
 * @typedef {Object} Profession
 * @property {string} name
 * @property {string} short   short label for buttons
 * @property {"gather"|"craft"} kind
 * @property {string} emoji   custom emoji name (see config/emojiIds.js)
 * @property {string} verb    what a successful action prints
 * @property {number} [cooldownMs]
 * @property {number} [xpGain]
 * @property {Array<{id: string, min: number, max: number, chance: number}>} [yields]
 * @property {Array<Object>} [recipes]
 */

/** @type {Record<string, Profession>} */
export const PROFESSIONS = {
  mining: {
    name: "Mining",
    short: "Mining",
    kind: "gather",
    emoji: "prof_mining",
    verb: "You swing your pick at the seam",
    cooldownMs: 20_000,
    xpGain: 12,
    yields: [
      { id: "copper_ore", min: 1, max: 2, chance: 0.9 },
      { id: "copper_ore", min: 1, max: 1, chance: 0.35 },
    ],
  },
  woodcutting: {
    name: "Woodcutting",
    short: "Wood",
    kind: "gather",
    emoji: "prof_woodcutting",
    verb: "You chop into the trunk",
    cooldownMs: 20_000,
    xpGain: 12,
    yields: [
      { id: "oak_log", min: 1, max: 2, chance: 0.9 },
      { id: "oak_log", min: 1, max: 1, chance: 0.35 },
    ],
  },
  fishing: {
    name: "Fishing",
    short: "Fishing",
    kind: "gather",
    emoji: "prof_fishing",
    verb: "You cast your line",
    cooldownMs: 25_000,
    xpGain: 14,
    yields: [
      { id: "river_fish", min: 1, max: 1, chance: 0.8 },
      { id: "river_fish", min: 1, max: 2, chance: 0.3 },
    ],
  },
  herbalism: {
    name: "Herbalism",
    short: "Herbs",
    kind: "gather",
    emoji: "prof_herbalism",
    verb: "You search the undergrowth",
    cooldownMs: 25_000,
    xpGain: 14,
    yields: [
      { id: "bloodroot", min: 1, max: 1, chance: 0.75 },
      { id: "bloodroot", min: 1, max: 2, chance: 0.3 },
    ],
  },

  smithing: {
    name: "Smithing",
    short: "Smith",
    kind: "craft",
    emoji: "prof_smithing",
    verb: "You work the forge",
    recipes: [
      {
        id: "iron_sword",
        name: "Iron Sword",
        cost: { copper_ore: 3, oak_log: 1 },
        xp: 30,
        requiresLevel: 1,
        description: "+14 attack",
      },
      {
        id: "bandage",
        name: "Bandage ×2",
        cost: { bloodroot: 1, oak_log: 1 },
        output: { id: "bandage", quantity: 2 },
        xp: 18,
        requiresLevel: 1,
        description: "+15 health each",
      },
    ],
  },
  crafting: {
    name: "Crafting",
    short: "Craft",
    kind: "craft",
    emoji: "prof_crafting",
    verb: "You work the leather",
    recipes: [
      {
        id: "hunter_cloak",
        name: "Hunter's Cloak",
        cost: { river_fish: 2, oak_log: 2 },
        xp: 30,
        requiresLevel: 1,
        description: "+7 defense, +2 speed",
      },
      {
        id: "health_potion",
        name: "Health Potion",
        cost: { bloodroot: 1, river_fish: 1 },
        xp: 16,
        requiresLevel: 1,
        description: "+30 health",
      },
    ],
  },
  cooking: {
    name: "Cooking",
    short: "Cook",
    kind: "craft",
    emoji: "prof_cooking",
    verb: "You cook over the fire",
    recipes: [
      {
        id: "cooked_fish",
        name: "Cooked Fish",
        cost: { river_fish: 1 },
        xp: 14,
        requiresLevel: 1,
        description: "+45 health",
      },
      {
        id: "herb_tonic",
        name: "Herb Tonic",
        cost: { bloodroot: 2, river_fish: 1 },
        xp: 22,
        requiresLevel: 2,
        description: "+30 health, +15 mana",
      },
    ],
  },
};

/** Unicode stand-ins used until the custom emojis are uploaded. */
export const PROFESSION_FALLBACK = {
  mining: "⛏️",
  woodcutting: "🪓",
  fishing: "🎣",
  herbalism: "🌿",
  smithing: "🔨",
  crafting: "🧵",
  cooking: "🍳",
};

/** Recipes of a crafting profession, in display order. */
export function recipesOf(professionId) {
  return PROFESSIONS[professionId]?.recipes ?? [];
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNextProfessionLevel(level) {
  const safe = Math.max(1, Math.floor(level || 1));
  return 60 + (safe - 1) * 40;
}

export const MAX_PROFESSION_LEVEL = 99;

/** Profession level for a raw xp total (used when the level is not stored). */
export function levelFromProfessionXp(xp) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp || 0));
  while (level < MAX_PROFESSION_LEVEL && remaining >= xpToNextProfessionLevel(level)) {
    remaining -= xpToNextProfessionLevel(level);
    level += 1;
  }
  return level;
}
