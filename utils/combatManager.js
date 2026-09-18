class CombatManager {
  constructor() {
    this.activeCombats = new Map(); // playerId -> combat data
  }

  startCombat(playerId, monsterData) {
    const combatData = {
      monster: { ...monsterData },
      playerId,
      startTime: Date.now(),
      lastAction: Date.now(),
    };

    this.activeCombats.set(playerId, combatData);
    return combatData;
  }

  getCombat(playerId) {
    return this.activeCombats.get(playerId);
  }

  updateCombat(playerId, updates) {
    const combat = this.activeCombats.get(playerId);
    if (combat) {
      Object.assign(combat, updates);
      combat.lastAction = Date.now();
    }
    return combat;
  }

  endCombat(playerId) {
    const combat = this.activeCombats.get(playerId);
    this.activeCombats.delete(playerId);
    return combat;
  }

  cleanupOldCombats(maxAge = 300000) {
    // 5 minutes
    const now = Date.now();
    for (const [playerId, combat] of this.activeCombats.entries()) {
      if (now - combat.lastAction > maxAge) {
        this.activeCombats.delete(playerId);
      }
    }
  }
}

const combatManager = new CombatManager();

export default combatManager;
