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

export { monsterManager, MONSTER_TEMPLATES };
