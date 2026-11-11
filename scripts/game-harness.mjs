/**
 * Headless test harness: stubs the mongoose models, builds a player, and
 * "presses" panel buttons through the real interaction handler.
 *
 * Used by scripts/check-game.mjs; import it from any dev script.
 */
import assert from "node:assert/strict";

const state = { items: [], maps: new Map(), players: new Map() };

// ---------------------------------------------------------------- stubs
const Item = (await import("../models/Item.js")).default;
const MapModel = (await import("../models/Map.js")).default;
const Profile = (await import("../models/Profile.js")).default;
const Listing = (await import("../models/Listing.js")).default;

const listings = [];
Listing.create = async (doc) => {
  const record = { _id: `l${listings.length + 1}`, ...doc, createdAt: new Date() };
  listings.push(record);
  return record;
};
Listing.find = () => {
  const chain = {
    sort() { return chain; },
    limit() { return chain; },
    async lean() { return [...listings]; },
  };
  return chain;
};
Listing.countDocuments = async ({ sellerId } = {}) =>
  listings.filter((listing) => !sellerId || listing.sellerId === sellerId).length;
Listing.findById = async (id) =>
  listings.find((listing) => String(listing._id) === String(id)) ?? null;
Listing.findOneAndDelete = async ({ _id }) => {
  const index = listings.findIndex((listing) => String(listing._id) === String(_id));
  return index >= 0 ? listings.splice(index, 1)[0] : null;
};
Listing.deleteOne = async ({ _id }) => {
  const index = listings.findIndex((listing) => String(listing._id) === String(_id));
  if (index >= 0) listings.splice(index, 1);
  return { deletedCount: index >= 0 ? 1 : 0 };
};

Item.find = () => ({ lean: async () => state.items });
MapModel.findOne = ({ mapId }) => ({ lean: async () => state.maps.get(mapId) ?? null });
Profile.findOne = async ({ userId }) => state.players.get(userId) ?? null;
Profile.updateOne = async (filter, update) => {
  const target = [...state.players.values()].find((entry) => entry.userId === filter.userId);
  if (!target) return { acknowledged: true, matchedCount: 0 };
  const increment = update?.$inc?.gold ?? 0;
  target.gold = (target.gold ?? 0) + increment;
  return { acknowledged: true, modifiedCount: 1 };
};
Profile.find = () => {
  const chain = {
    sort() { return chain; },
    limit() { return chain; },
    async lean() { return [...state.players.values()]; },
  };
  return chain;
};

const { execute, match } = await import("../Events/Interaction/_mapHandler.js");

// ---------------------------------------------------------------- helpers
export function makePlayer(over = {}) {
  const player = {
    _id: "p1",
    userId: "u1",
    username: "Tester",
    class: "Warrior",
    race: "Human",
    gender: "Male",
    difficulty: "Normal",
    level: 3,
    experience: 20,
    gold: 120,
    bagSlots: 9,
    currentMapId: "main_city",
    location: { x: 1, y: 1 },
    currentHealth: 90,
    currentMana: 0,
    baseStats: { health: 120, attack: 8, defense: 6, speed: 4, magic: 0 },
    attributes: { str: 1, int: 0, vit: 0 },
    attributePoints: 2,
    talentPoints: 2,
    talents: new Map(),
    equipped: {},
    inventory: [],
    professions: {},
    counters: { kills: 0, bosses: 0, gathers: 0, crafts: 0, quests: 0, dailies: 0, deaths: 0 },
    achievements: [],
    quests: [],
    dailyQuestAt: null,
    saves: 0,
    async save() { this.saves += 1; return this; },
    async populate() { return this; },
    async deleteOne() { this.deleted = true; },
    // Model methods used by the bag / character panels.
    removeInventoryAt(index, amount = 1) {
      const slot = this.inventory[index];
      if (!slot) return;
      slot.quantity -= amount;
      if (slot.quantity <= 0) this.inventory.splice(index, 1);
    },
    async useItem(index) {
      const slot = this.inventory[index];
      if (!slot) throw new Error("That bag slot is empty");
      const item = state.items.find((it) => it._id === slot.item) ?? slot.item;
      const healed = item.stats?.health ?? 0;
      if (healed) this.currentHealth = Math.min(120, this.currentHealth + healed);
      this.removeInventoryAt(index, 1);
      return `You used ${item.name}.`;
    },
    async equipItem(itemId) {
      const item = state.items.find((it) => it._id === String(itemId) || it.itemId === itemId);
      if (!item) throw new Error("Item not found");
      this.equipped[item.type] = item._id;
      return `You equipped ${item.name}.`;
    },
    async discardItem(index, amount = 1) {
      this.removeInventoryAt(index, amount);
      return "Item discarded.";
    },
    ...over,
  };
  return player;
}

const pressed = [];
const fail = [];

function interaction(customId, userId = "u1") {
  const seen = { edits: [], follows: [], replies: [], deferred: 0 };
  return {
    customId,
    isButton: () => true,
    user: { id: userId, username: "Tester" },
    message: { interactionMetadata: { user: { id: userId } } },
    seen,
    async deferUpdate() { seen.deferred += 1; },
    async editReply(payload) { seen.edits.push(payload); return payload; },
    async followUp(payload) { seen.follows.push(payload); return payload; },
    async reply(payload) { seen.replies.push(payload); return payload; },
  };
}

export async function press(customId, { quiet = false } = {}) {
  const i = interaction(customId);
  assert.equal(match(i), true, `${customId} is not routed to the map handler`);
  await execute(i);

  const label = customId;
  const payload = i.seen.edits.at(-1);

  try {
    assert.deepEqual(i.seen.replies, [], `${label}: replied with an error`);

    // Some buttons answer with an ephemeral follow-up instead of re-rendering.
    const follow = i.seen.follows.at(-1);
    if (!payload && follow) {
      const content = String(follow.content ?? "");
      // "❌ Nothing equipped" is a valid answer; "❌ Error" is not.
      assert.ok(!content.includes("Error"), `${label}: ${content}`);
      assert.ok(!content.startsWith("❌ Unknown"), `${label}: ${content}`);
      if (!quiet) console.log(`  ${label.padEnd(26)} (ephemeral) ${content.slice(0, 48)}`);
      pressed.push(label);
      return { interaction: i, payload: null, embed: null };
    }

    assert.ok(payload, `${label}: no editReply`);
    assert.ok((payload.components ?? []).length <= 5, `${label}: more than 5 rows`);

    const ids = (payload.components ?? []).flatMap((row) => {
      const comps = row.toJSON().components;
      assert.ok(comps.length <= 5, `${label}: row with ${comps.length} buttons`);
      return comps.map((c) => c.custom_id);
    });
    const dupes = [...new Set(ids.filter((id, i2) => ids.indexOf(id) !== i2))];
    assert.deepEqual(dupes, [], `${label}: duplicated custom id`);

    const embed = payload.embeds?.[0]?.toJSON?.();
    if (embed) {
      assert.ok(!String(embed.description ?? "").includes("undefined"), `${label}: undefined in description`);
      if (!quiet) console.log(`  ${label.padEnd(26)} rows=${(payload.components ?? []).length} chars=${String(embed.description ?? "").length}`);
    }
  } catch (error) {
    fail.push(error.message);
    console.log(`  ❌ ${label}: ${error.message}`);
  }

  pressed.push(label);
  return { interaction: i, payload, embed: payload?.embeds?.[0]?.toJSON?.() };
}

// ---------------------------------------------------------------- fixture
state.items = [
  { _id: "1", itemId: "warrior_sword", name: "Broadsword", type: "weapon", emoji: "⚔️", description: "A heavy sword", stats: { attack: 8 }, value: 40, rarity: "common" },
  { _id: "2", itemId: "warrior_armor", name: "Plate Armor", type: "armor", emoji: "🛡️", description: "Heavy plate", stats: { defense: 5 }, value: 50, rarity: "common" },
  { _id: "3", itemId: "health_potion", name: "Health Potion", type: "consumable", emoji: "🧪", description: "Restores 30 health", stats: { health: 30 }, value: 10, rarity: "common" },
  { _id: "4", itemId: "mana_potion", name: "Mana Potion", type: "consumable", emoji: "🔵", description: "Restores 20 mana", stats: { magic: 20 }, value: 12, rarity: "common" },
  { _id: "5", itemId: "copper_ore", name: "Copper Ore", type: "material", emoji: "🪨", description: "Raw copper", value: 4, rarity: "common" },
  { _id: "6", itemId: "oak_log", name: "Oak Log", type: "material", emoji: "🪵", description: "A log", value: 3, rarity: "common" },
  { _id: "7", itemId: "river_fish", name: "River Fish", type: "material", emoji: "🐟", description: "Fresh fish", value: 5, rarity: "common" },
  { _id: "8", itemId: "bloodroot", name: "Bloodroot", type: "material", emoji: "🌿", description: "A herb", value: 6, rarity: "common" },
  { _id: "9", itemId: "iron_sword", name: "Iron Sword", type: "weapon", emoji: "🗡️", description: "Forged", stats: { attack: 14 }, value: 90, rarity: "uncommon" },
];

state.maps.set("main_city", {
  mapId: "main_city", width: 5, height: 5, areaLabel: "The City of RuneHero", depth: 0,
  mapData: [
    ["grass", "stone_brick_1", "grass", "grass", "grass"],
    ["grass", "SHOP", "grass", "T", "grass"],
    ["grass", "stone_brick_1", "grass", "grass", "grass"],
    ["grass", "grass", "grass", "grass", "grass"],
    ["grass", "grass", "grass", "grass", "grass"],
  ],
});

const player = makePlayer({
  equipped: { weapon: "1" },
  inventory: [
    { item: "3", quantity: 2 },
    { item: "1", quantity: 1 },
  ],
});
state.players.set("u1", player);

// A second profile so the ranking screen has something to sort.
const rival = makePlayer({
  _id: "p2",
  userId: "u2",
  username: "Rival",
  level: 8,
  professions: { mining: { xp: 0, level: 4 }, fishing: { xp: 0, level: 2 } },
  achievements: ["lvl_2", "lvl_5", "kill_1"],
});
state.players.set("u2", rival);

export { player, rival, state, pressed, fail, listings };
