import { talentBonuses } from "./talents.js";

/**
 * Calculate combined stats from base stats, equipment and talents
 * @param {Object} player - The player object
 * @returns {Object} - Combined stats
 */
export function calculateCombinedStats(player) {
  const combined = { ...player.baseStats };

  for (const slot of ["weapon", "armor", "accessory"]) {
    const item = player.equipped?.[slot];
    if (item?.stats) {
      for (const [k, v] of Object.entries(item.stats)) {
        combined[k] = (combined[k] || 0) + v;
      }
    }
  }

  // Talents are derived, never baked into baseStats, so a respec is free.
  for (const [stat, value] of Object.entries(talentBonuses(player))) {
    if (!value) continue;
    combined[stat] = (combined[stat] || 0) + value;
  }

  return combined;
}
