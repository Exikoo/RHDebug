import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true },
    class: {
      type: String,
      required: true,
      enum: ["Warrior", "Mage", "Archer"],
      index: true,
    },
    race: {
      type: String,
      required: true,
      enum: ["Human", "Orc"],
      index: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female"],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["Normal", "Permadeath"],
      default: "Normal",
    },
    bagSlots: { type: Number, default: 8 },
    level: { type: Number, default: 1, min: 1, index: true },
    experience: { type: Number, default: 0, min: 0 },
    currentHealth: {
      type: Number,
      default: function () {
        return this.baseStats.health;
      },
    },
    currentMana: {
      type: Number,
      default: function () {
        return this.baseStats.magic;
      },
    },
    baseStats: {
      health: { type: Number, required: true, min: 1 },
      attack: { type: Number, required: true, min: 1 },
      defense: { type: Number, required: true, min: 0 },
      speed: { type: Number, required: true, min: 1 },
      magic: { type: Number, default: 0, min: 0 },
    },
    gold: { type: Number, default: 50, min: 0 },
    equipped: {
      weapon: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      armor: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      accessory: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    },
    inventory: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
          required: true,
        },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],
    skills: [
      // TODO: add skills
    ],
    achievements: [
      // TODO: add achievements
    ],
    currentTarget: { type: String, default: null },
    targetProgress: { type: String, default: "0/0" },
    targetMonsterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monster",
      default: null,
    },
    targetPosition: {
      x: { type: Number, default: null },
      y: { type: Number, default: null },
    },
    lastPlayed: { type: Date, default: Date.now },
    location: {
      x: { type: Number, default: 8 },
      y: { type: Number, default: 5 },
    },
    currentMapId: {
      type: String,
      required: true,
      default: "main_city",
    },
    visitedMaps: [
      {
        mapId: String,
        firstVisited: { type: Date, default: Date.now },
        lastVisited: { type: Date, default: Date.now },
      },
    ],
    portalReturn: {
      mapId: String,
      x: Number,
      y: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

profileSchema.virtual("totalStats").get(function () {
  const stats = { ...this.baseStats };
  const equipmentSlots = ["weapon", "armor", "accessory"];

  for (const slot of equipmentSlots) {
    if (this.equipped?.[slot] && this.equipped[slot].stats) {
      const itemStats = this.equipped[slot].stats;
      for (const statKey in itemStats) {
        stats[statKey] = (stats[statKey] || 0) + itemStats[statKey];
      }
    }
  }

  return stats;
});

profileSchema.virtual("currentMap", {
  ref: "Map",
  localField: "currentMapId",
  foreignField: "mapId",
  justOne: true,
});

profileSchema.methods.addItem = async function (itemId, quantity = 1) {
  const existing = this.inventory.find((i) => i.item.equals(itemId));

  if (existing) {
    existing.quantity += quantity;
  } else {
    this.inventory.push({ item: itemId, quantity });
  }

  await this.save();
  return this;
};

profileSchema.methods.equipItem = async function (itemId) {
  const item = await mongoose.model("Item").findById(itemId);
  if (!item) throw new Error("Item not found");

  if (item.levelRequirement > this.level) {
    throw new Error("Level requirement not met");
  }

  if (item.classRestriction && !item.classRestriction.includes(this.class)) {
    throw new Error("Class restriction");
  }

  switch (item.type) {
    case "weapon":
      this.equipped.weapon = itemId;
      break;
    case "armor":
      this.equipped.armor = itemId;
      break;
    case "accessory":
      this.equipped.accessory = itemId;
      break;
    default:
      throw new Error("Item type cannot be equipped");
  }

  await this.save();
  return this;
};

profileSchema.methods.changeMap = async function (
  newMapId,
  newLocation = null,
) {
  const Map = mongoose.model("Map");
  const newMap = await Map.findOne({ mapId: newMapId });

  if (!newMap) {
    throw new Error(`Map ${newMapId} not found`);
  }

  const visitedMap = this.visitedMaps.find((v) => v.mapId === newMapId);
  if (visitedMap) {
    visitedMap.lastVisited = new Date();
  } else {
    this.visitedMaps.push({
      mapId: newMapId,
      firstVisited: new Date(),
      lastVisited: new Date(),
    });
  }

  this.currentMapId = newMapId;

  if (newLocation) {
    this.location = newLocation;
  } else {
    this.location = { ...newMap.defaultSpawnPoint };
  }

  await this.save();
  return this;
};

profileSchema.methods.initializeStats = function () {
  const classStats = {
    Warrior: { health: 100, attack: 15, defense: 10, speed: 5, magic: 0 },
    Mage: { health: 70, attack: 8, defense: 5, speed: 7, magic: 20 },
    Archer: { health: 85, attack: 12, defense: 7, speed: 10, magic: 5 },
  };

  const raceModifiers = {
    Human: { health: 5, attack: 2, defense: 2, speed: 2, magic: 2 },
    Orc: { health: 10, attack: 5, defense: 3, speed: -1, magic: -3 },
  };

  const difficultyModifiers = {
    Easy: { health: 20, attack: 5, defense: 5, speed: 5, magic: 5 },
    Normal: { health: 0, attack: 0, defense: 0, speed: 0, magic: 0 },
    Hard: { health: -10, attack: -2, defense: -2, speed: -2, magic: -2 },
  };

  const baseStats = { ...classStats[this.class] };

  for (const stat in raceModifiers[this.race]) {
    baseStats[stat] += raceModifiers[this.race][stat];
  }

  for (const stat in difficultyModifiers[this.difficulty]) {
    baseStats[stat] += difficultyModifiers[this.difficulty][stat];
  }

  baseStats.health = Math.max(1, baseStats.health);
  baseStats.attack = Math.max(1, baseStats.attack);
  baseStats.defense = Math.max(0, baseStats.defense);
  baseStats.speed = Math.max(1, baseStats.speed);
  baseStats.magic = Math.max(0, baseStats.magic);

  this.baseStats = baseStats;
  this.currentHealth = baseStats.health;
  this.currentMana = baseStats.magic;
};

export default mongoose.model("Profile", profileSchema);
