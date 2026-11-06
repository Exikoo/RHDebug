/**
 * Level / experience curve.
 *
 * Legends of Discord shows `Lv. 1` over `0/10` at the start of a run, so the
 * first level is cheap and each one after that costs progressively more.
 */

export const MAX_LEVEL = 99;

/** Stat gain applied to baseStats each time the player levels up. */
export const LEVEL_UP_GAIN = {
  health: 5,
  attack: 1,
  defense: 1,
  magic: 1,
};

/**
 * XP required to go from `level` to `level + 1`.
 * Lv 1 -> 10 XP, Lv 2 -> 25, Lv 3 -> 40, ...
 * @param {number} level
 * @returns {number}
 */
export function xpToNextLevel(level) {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  return 10 + (safeLevel - 1) * 15;
}

/**
 * Adds experience, applies any level-ups and heals the player on level up.
 * Mutates the profile; the caller is responsible for saving it.
 *
 * @param {object} player Profile document (baseStats / level / experience).
 * @param {number} amount
 * @param {{health:number, magic:number}} [max] Combined stats, so the free
 *   heal on level up tops up to the equipment-boosted maximum.
 * @returns {{levelsGained: number, levels: number[]}}
 */
export function addExperience(player, amount, max = null) {
  const gained = Math.max(0, Math.floor(amount || 0));
  const levels = [];

  player.experience = Math.max(0, (player.experience || 0) + gained);
  player.level = Math.max(1, player.level || 1);

  while (
    player.level < MAX_LEVEL &&
    player.experience >= xpToNextLevel(player.level)
  ) {
    player.experience -= xpToNextLevel(player.level);
    player.level += 1;
    levels.push(player.level);

    if (player.baseStats) {
      for (const [stat, gain] of Object.entries(LEVEL_UP_GAIN)) {
        // Melee classes have 0 magic; do not hand them a stray mana pool.
        if (stat === "magic" && (player.baseStats.magic || 0) === 0) continue;
        player.baseStats[stat] = (player.baseStats[stat] || 0) + gain;
      }
    }
  }

  if (player.level >= MAX_LEVEL) player.experience = 0;

  if (levels.length > 0) {
    // Level ups are a free heal, so the level-up message actually matters.
    player.currentHealth =
      max?.health ?? player.baseStats?.health ?? player.currentHealth;
    player.currentMana = max?.magic ?? player.baseStats?.magic ?? player.currentMana;
  }

  return { levelsGained: levels.length, levels };
}

/**
 * Clamps current health/mana into [0, max] and repairs profiles saved
 * before those fields existed.
 * @param {object} player
 * @param {{health:number, magic:number}} max
 */
export function clampVitals(player, max) {
  const maxHealth = Math.max(1, max?.health ?? 1);
  const maxMana = Math.max(0, max?.magic ?? 0);

  const health = Number.isFinite(player.currentHealth)
    ? player.currentHealth
    : maxHealth;
  const mana = Number.isFinite(player.currentMana)
    ? player.currentMana
    : maxMana;

  player.currentHealth = Math.min(maxHealth, Math.max(0, health));
  player.currentMana = Math.min(maxMana, Math.max(0, mana));

  return player;
}
