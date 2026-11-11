import mongoose from "mongoose";
import { calculateCombinedStats } from "../utils/playerUtils.js";
import classes from "../config/classes.js";

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
    // Attribute points spent (class base values live in config/classes.js).
    attributes: {
      str: { type: Number, default: 0, min: 0 },
      int: { type: Number, default: 0, min: 0 },
      vit: { type: Number, default: 0, min: 0 },
    },
    attributePoints: { type: Number, default: 3, min: 0 },
    talentPoints: { type: Number, default: 1, min: 0 },
    // talentId -> rank; everything else about talents is derived.
    talents: { type: Map, of: Number, default: () => new Map() },

    // professionId -> { xp, level } (see config/professions.js)
    professions: {
      type: Map,
      of: new mongoose.Schema(
        {
          xp: { type: Number, default: 0, min: 0 },
          level: { type: Number, default: 1, min: 1 },
        },
        { _id: false },
      ),
      default: () => new Map(),
    },

    // Lifetime counters used by achievements, quests and rankings.
    counters: {
      kills: { type: Number, default: 0, min: 0 },
      bosses: { type: Number, default: 0, min: 0 },
      gathers: { type: Number, default: 0, min: 0 },
      crafts: { type: Number, default: 0, min: 0 },
      quests: { type: Number, default: 0, min: 0 },
      dailies: { type: Number, default: 0, min: 0 },
      deaths: { type: Number, default: 0, min: 0 },
    },

    achievements: { type: [String], default: [] },

    quests: [
      {
        id: { type: String, required: true },
        progress: { type: Number, default: 0, min: 0 },
        goal: { type: Number, default: 1, min: 1 },
        type: { type: String, required: true },
        target: { type: String, default: null },
        daily: { type: Boolean, default: false },
        _id: false,
      },
    ],
    dailyQuestAt: { type: Date, default: null },
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

/**
 * Removes `quantity` of the item sitting at the given inventory index,
 * deleting the slot entirely once its quantity reaches zero. Does not
 * save — callers that only call this should save afterwards.
 * @param {number} inventoryIndex
 * @param {number} [quantity]
 */
profileSchema.methods.removeInventoryAt = function (
  inventoryIndex,
  quantity = 1,
) {
  const slot = this.inventory[inventoryIndex];
  if (!slot) return;

  slot.quantity -= quantity;
  if (slot.quantity <= 0) {
    this.inventory.splice(inventoryIndex, 1);
  }
};

/**
 * Uses or equips the item sitting in the given bag slot.
 * - Consumables restore health/magic (capped at the player's current
 *   max, including equipment bonuses) and are consumed one at a time.
 * - Weapons/armor/accessories are equipped via `equipItem`.
 * - Anything else (e.g. materials) throws, since it has no bag action.
 * @param {number} inventoryIndex
 * @returns {Promise<string>} A human-readable summary of what happened.
 */
profileSchema.methods.useItem = async function (inventoryIndex) {
  const slot = this.inventory[inventoryIndex];
  if (!slot) throw new Error("That bag slot is empty");

  const ItemModel = mongoose.model("Item");
  const item =
    slot.item && slot.item.type
      ? slot.item
      : await ItemModel.findById(slot.item);
  if (!item) throw new Error("Item not found");

  let message;

  if (item.type === "consumable") {
    const combined = calculateCombinedStats(this);
    let healed = 0;
    let restored = 0;

    if (item.stats?.health) {
      const before = this.currentHealth;
      this.currentHealth = Math.min(
        combined.health,
        this.currentHealth + item.stats.health,
      );
      healed = this.currentHealth - before;
    }

    if (item.stats?.magic) {
      const before = this.currentMana;
      this.currentMana = Math.min(
        combined.magic,
        this.currentMana + item.stats.magic,
      );
      restored = this.currentMana - before;
    }

    const parts = [];
    if (healed > 0) parts.push(`+${healed} HP`);
    if (restored > 0) parts.push(`+${restored} MP`);

    message = parts.length
      ? `You used ${item.name} (${parts.join(", ")}).`
      : `You used ${item.name}, but nothing happened.`;

    this.removeInventoryAt(inventoryIndex, 1);
  } else if (["weapon", "armor", "accessory"].includes(item.type)) {
    await this.equipItem(item._id);
    message = `You equipped ${item.name}.`;
  } else {
    throw new Error(`${item.name} can't be used.`);
  }

  await this.save();
  return message;
};

/**
 * Discards `quantity` of the item in the given bag slot.
 * @param {number} inventoryIndex
 * @param {number} [quantity]
 * @returns {Promise<string>}
 */
profileSchema.methods.discardItem = async function (
  inventoryIndex,
  quantity = 1,
) {
  const slot = this.inventory[inventoryIndex];
  if (!slot) throw new Error("That bag slot is empty");

  const itemName = slot.item?.name || "item";
  const removed = Math.min(quantity, slot.quantity);

  this.removeInventoryAt(inventoryIndex, removed);
  await this.save();

  return `You discarded ${removed}x ${itemName}.`;
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

/**
 * Builds the starting stats for a freshly created character.
 *
 * config/classes.js is the single source of truth for class stats (the
 * character-creation panel and /help quote the same numbers), so this only
 * applies the race modifier on top of the class base.
 */
profileSchema.methods.initializeStats = function () {
  const classCfg = classes[String(this.class || "").toLowerCase()];
  const baseStats = {
    health: 100,
    attack: 10,
    defense: 5,
    speed: 5,
    magic: 0,
    ...(classCfg?.baseStats ?? {}),
  };

  const raceModifiers = {
    Human: { health: 5, attack: 2, defense: 2, speed: 2, magic: 2 },
    Orc: { health: 10, attack: 5, defense: 3, speed: -1, magic: -3 },
  };

  // Permadeath changes the rules, not the numbers: the run ends when you
  // die, so it does not need a stat penalty on top.
  const difficultyModifiers = {
    Normal: {},
    Permadeath: {},
  };

  for (const stat in raceModifiers[this.race] ?? {}) {
    baseStats[stat] = (baseStats[stat] ?? 0) + raceModifiers[this.race][stat];
  }

  for (const stat in difficultyModifiers[this.difficulty] ?? {}) {
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
