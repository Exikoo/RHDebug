import Monster from "./models/Monster.js";

const MONSTER_TEMPLATES = {
  CYCLOPS: {
    name: "Cyclops",
    maxHealth: 50,
    attack: 15,
    defense: 3,
    experience: 25,
  },
  ORC: {
    name: "Orc",
    maxHealth: 30,
    attack: 12,
    defense: 4,
    experience: 15,
  },
  DRAGON: {
    name: "Red Dragon",
    maxHealth: 150,
    attack: 25,
    defense: 8,
    experience: 100,
  },
};

/** Key format used for sets of monster positions: "x,y". */
const monsterKey = (x, y) => `${x},${y}`;

class MonsterManager {
  async getOrCreateMonster(mapId, x, y, monsterType) {
    let monster = await Monster.findOne({ mapId, x, y });

    if (!monster) {
      const template = MONSTER_TEMPLATES[monsterType];
      if (!template) {
        throw new Error(`Monster template ${monsterType} not found`);
      }

      try {
        monster = await Monster.create({
          monsterType,
          ...template,
          currentHealth: template.maxHealth,
          mapId,
          x,
          y,
        });
      } catch (err) {
        // Handle the race where another player created the same monster
        // between our findOne and create (unique index on mapId+x+y).
        if (err.code === 11000) {
          monster = await Monster.findOne({ mapId, x, y });
        } else {
          throw err;
        }
      }
    }

    return monster;
  }

  async getMonsterInfo(mapId, x, y) {
    return Monster.findOne({ mapId, x, y });
  }

  async damageMonster(mapId, x, y, damage) {
    const monster = await Monster.findOne({ mapId, x, y });
    if (!monster) return null;

    monster.currentHealth = Math.max(0, monster.currentHealth - damage);

    if (monster.currentHealth <= 0) {
      monster.isDead = true;
    }

    await monster.save();
    return monster;
  }

  async isMonsterDead(mapId, x, y) {
    const monster = await Monster.findOne({ mapId, x, y });
    return monster ? monster.isDead : false;
  }

  /**
   * Positions of every dead monster on a map, in ONE query. Replaces the
   * per-tile isMonsterDead() calls that rendering used to make.
   * @param {string} mapId
   * @returns {Promise<Set<string>>} Set of "x,y" keys (see monsterKey).
   */
  async getDeadPositions(mapId) {
    const dead = await Monster.find({ mapId, isDead: true }, "x y").lean();
    return new Set(dead.map((m) => monsterKey(m.x, m.y)));
  }

  /**
   * Atomically applies damage to a monster by id. Unlike read-modify-save
   * this can't lose hits when two players attack at once, and exactly one
   * caller is told `killed: true` — so XP/gold can't be awarded twice.
   *
   * @param {import("mongoose").Types.ObjectId} monsterId
   * @param {number} damage
   * @returns {Promise<{monster: object|null, killed: boolean, alreadyDead: boolean}>}
   */
  async applyDamage(monsterId, damage) {
    const hit = await Monster.findOneAndUpdate(
      { _id: monsterId, isDead: false },
      { $inc: { currentHealth: -damage } },
      { returnDocument: "after" },
    );

    // Someone else finished it off between our read and this update.
    if (!hit) {
      return {
        monster: await Monster.findById(monsterId),
        killed: false,
        alreadyDead: true,
      };
    }

    if (hit.currentHealth > 0) {
      return { monster: hit, killed: false, alreadyDead: false };
    }

    // Lethal hit: clamp to 0 and flag dead. The isDead:false filter means
    // only one concurrent attacker can win this update.
    const finished = await Monster.findOneAndUpdate(
      { _id: monsterId, isDead: false },
      { $set: { currentHealth: 0, isDead: true } },
      { returnDocument: "after" },
    );

    return {
      monster: finished ?? (await Monster.findById(monsterId)),
      killed: Boolean(finished),
      alreadyDead: !finished,
    };
  }

  async resetAllMonsters() {
    await Monster.updateMany(
      {},
      {
        $set: { isDead: false },
        $unset: { currentHealth: 1 },
      },
    );

    const monsters = await Monster.find({});
    for (const monster of monsters) {
      monster.currentHealth = monster.maxHealth;
      await monster.save();
    }
  }

  async initializeMapMonsters(mapId, mapData) {
    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[y].length; x++) {
        const tile = mapData[y][x];

        if (MONSTER_TEMPLATES[tile]) {
          await this.getOrCreateMonster(mapId, x, y, tile);
        }
      }
    }
  }
}

const monsterManager = new MonsterManager();

export { monsterManager, MONSTER_TEMPLATES, monsterKey };
