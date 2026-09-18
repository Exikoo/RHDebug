/**
 * Calculate combined stats from base stats and equipment
 * @param {Object} player - The player object
 * @returns {Object} - Combined stats
 */
export function calculateCombinedStats(player) {
  const combined = { ...player.baseStats };

  for (const slot of ["weapon", "armor", "accessory"]) {
    const item = player.equipped[slot];
    if (item?.stats) {
      for (const [k, v] of Object.entries(item.stats)) {
        combined[k] = (combined[k] || 0) + v;
      }
    }
  }

  return combined;
}
