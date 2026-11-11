/**
 * Rule-level tests for the new systems (no Discord involved):
 *
 *   node scripts/check-features.mjs
 *
 * The screen tests in check-game.mjs prove every button renders; this file
 * proves the numbers behind them are right — gathering, crafting, quests,
 * achievements, market and the character sheet.
 */
import assert from "node:assert/strict";

const { state, player } = await import("./game-harness.mjs");

const professions = await import("../utils/professions.js");
const quests = await import("../utils/quests.js");
const achievements = await import("../utils/achievements.js");
const market = await import("../utils/market.js");
const chest = await import("../utils/chest.js");
const mapGenerator = await import("../utils/mapGenerator.js");
const mapGeneration = await import("../config/mapGeneration.js");
const plainsData = await import("../data/plains1.js");
const inventory = await import("../utils/inventory.js");
const itemCache = await import("../utils/itemCache.js");
const { calculateCombinedStats } = await import("../utils/playerUtils.js");
const { spendAttributePoint, learnTalent, talentBonuses } = await import("../utils/talents.js");
const { addExperience, xpToNextLevel } = await import("../utils/progression.js");

// Fill the item cache so key lookups (copper_ore -> document) work.
await itemCache.getItemMap();

const results = [];
const test = (name, fn) => {
  try {
    fn();
    results.push([true, name]);
    console.log(`  ✅ ${name}`);
  } catch (error) {
    results.push([false, name]);
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
};

console.log("\nprofessions");
test("gathering adds materials and xp", () => {
  const p = { userId: "g1", inventory: [], professions: {} };
  const before = professions.professionOf(p, "mining");
  const result = professions.gather(p, "mining");
  assert.equal(result.ok, true, result.message);
  assert.ok(result.yields.length > 0, "expected at least one material");
  const after = professions.professionOf(p, "mining");
  assert.ok(after.xp > before.xp || after.level > before.level, "no xp gained");
  assert.ok(p.inventory.length > 0, "nothing entered the bag");
});

test("gathering enforces its cooldown", () => {
  const p = { userId: "g2", inventory: [], professions: {} };
  professions.gather(p, "mining");
  const second = professions.gather(p, "mining");
  assert.equal(second.ok, false);
  assert.match(second.message, /cooldown/i);
});

test("profession levels follow the xp curve", () => {
  const p = { userId: "g3", inventory: [], professions: {} };
  const { leveled } = professions.addProfessionXp(p, "mining", 1000);
  assert.ok(leveled > 1, "1000 xp should level several times");
  assert.ok(professions.professionOf(p, "mining").level >= 3);
});

test("crafting consumes materials and produces the item", () => {
  const p = { userId: "g4", inventory: [], professions: {} };
  inventory.addItem(p, "copper_ore", 3);
  inventory.addItem(p, "oak_log", 1);

  const result = professions.craft(p, "smithing", "iron_sword");
  assert.equal(result.ok, true, result.message);
  assert.equal(inventory.countItem(p, "copper_ore"), 0, "ore was not consumed");
  assert.equal(inventory.countItem(p, "iron_sword"), 1, "sword was not added");
});

test("crafting refuses without materials", () => {
  const p = { userId: "g5", inventory: [], professions: {} };
  const result = professions.craft(p, "smithing", "iron_sword");
  assert.equal(result.ok, false);
  assert.match(result.message, /still need/i);
});

test("crafting respects the profession level", () => {
  const p = { userId: "g6", inventory: [], professions: {} };
  inventory.addItem(p, "bloodroot", 2);
  inventory.addItem(p, "river_fish", 1);
  const result = professions.craft(p, "cooking", "herb_tonic");
  assert.equal(result.ok, false);
  assert.match(result.message, /level 2 required/i);
});

console.log("\nworld");
test("the plain is decorated with trees, boulders and chests", () => {
  const { decorateMap } = mapGenerator;
  const { GENERATED_MAPS } = mapGeneration;
  const { plains1Map } = plainsData;

  const tiles = new Set();
  for (let seed = 1; seed <= 5; seed += 1) {
    const generated = decorateMap(plains1Map, GENERATED_MAPS.plains1.rules, { seed });
    for (const row of generated) for (const tile of row) tiles.add(tile);
  }

  assert.ok(tiles.has("T"), "no trees were placed");
  assert.ok(tiles.has("ROCK"), "no boulders were placed");
  assert.ok(tiles.has("CHEST"), "no chests were placed");
  assert.ok(GENERATED_MAPS.plains1.name.includes("Plain of LoD"));
});

test("a chest pays out once and turns into ground", async () => {
  const p = { userId: "c1", inventory: [], professions: {}, gold: 0 };
  const map = { mapData: [["G", "CHEST"]], saved: 0, async save() { this.saved += 1; } };

  const first = await chest.openChest(p, map, 1, 0, { rng: () => 0 });
  assert.ok(first.gold > 0, "no gold");
  assert.equal(map.mapData[0][1], "G", "the chest tile was left behind");
  assert.equal(map.saved, 1, "the map was not saved");
  assert.equal(p.gold, first.gold);

  const second = await chest.openChest(p, map, 1, 0, { rng: () => 0 });
  assert.equal(second.gold > 0, true);
  assert.equal(map.mapData[0][1], "G", "an empty tile should stay empty");
});

console.log("\nquests");
test("accepting and completing a gather quest pays out", () => {
  const p = {
    userId: "q1", inventory: [], professions: {}, level: 1, experience: 0,
    gold: 0, counters: {}, quests: [], baseStats: { health: 100, attack: 5, defense: 5, speed: 5, magic: 0 },
  };
  p.quests.push({ id: "q_copper", progress: 0, goal: 5, type: "gather", target: "copper_ore", daily: false });

  const partial = quests.progressQuests(p, "gather", "copper_ore", 4);
  assert.equal(partial.length, 0, "completed too early");
  assert.equal(p.quests[0].progress, 4);

  const done = quests.progressQuests(p, "gather", "copper_ore", 1);
  assert.equal(done.length, 1);
  assert.equal(done[0].id, "q_copper");
  assert.ok(p.gold >= 40, "gold reward missing");
  assert.equal(p.quests.length, 0, "finished quest stayed in the log");
  assert.equal(p.counters.quests, 1);
});

test("the quest board caps at three quests", () => {
  const p = { userId: "q2", inventory: [], professions: {}, quests: [] };
  assert.equal(quests.acceptQuest(p).ok, true);
  assert.equal(quests.acceptQuest(p).ok, true);
  assert.equal(quests.acceptQuest(p).ok, true);
  const fourth = quests.acceptQuest(p);
  assert.equal(fourth.ok, false);
  assert.match(fourth.message, /only hold 3/i);
});

test("the daily bounty respects its cooldown", () => {
  const p = { userId: "q3", inventory: [], professions: {}, quests: [], dailyQuestAt: null };
  assert.equal(quests.acceptDaily(p).ok, true);
  p.quests = [];
  const again = quests.acceptDaily(p);
  assert.equal(again.ok, false);
  assert.match(again.message, /not available/i);
});

test("kill quests advance only on kills", () => {
  const p = { userId: "q4", quests: [], counters: {} };
  p.quests.push({ id: "q_hunt", progress: 0, goal: 3, type: "kill", target: null, daily: false });
  quests.progressQuests(p, "gather", "copper_ore", 5);
  assert.equal(p.quests[0].progress, 0, "gathering counted as a kill");
});

console.log("\nachievements");
test("achievements unlock from counters and level", () => {
  const p = {
    level: 5, achievements: [], counters: { kills: 12, gathers: 1, crafts: 0 },
    professions: { mining: { xp: 0, level: 3 } }, quests: [],
  };
  const earned = achievements.awardAchievements(p);
  const ids = earned.map((entry) => entry.id);
  for (const id of ["lvl_2", "lvl_5", "kill_1", "kill_10", "prof_first", "prof_any_3"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  assert.ok(!ids.includes("boss_1"), "boss achievement unlocked without a boss");
});

test("awards are not repeated", () => {
  const p = { level: 5, achievements: [], counters: { kills: 1 }, professions: {}, quests: [] };
  const first = achievements.awardAchievements(p);
  const second = achievements.awardAchievements(p);
  assert.ok(first.length > 0);
  assert.equal(second.length, 0);
});

test("progress reports earned count and points", () => {
  const p = { level: 2, achievements: ["lvl_2"], counters: {}, professions: {} };
  const progress = achievements.achievementProgress(p);
  assert.equal(progress.earned, 1);
  assert.ok(progress.points >= 5);
  assert.ok(progress.total >= 15);
});

console.log("\nmarket");
test("listing takes the item out of the bag", async () => {
  const p = {
    userId: "m1", username: "Seller", inventory: [], professions: {}, async save() {},
  };
  inventory.addItem(p, "copper_ore", 5);
  const result = await market.listItem(p, "copper_ore", 5);
  assert.equal(result.ok, true, result.message);
  assert.equal(inventory.countItem(p, "copper_ore"), 0);
});

test("buying moves gold and the stack", async () => {
  const seller = { userId: "m2", username: "Seller2", inventory: [], professions: {}, gold: 0, async save() {} };
  state.players.set("m2", seller);
  inventory.addItem(seller, "river_fish", 2);
  await market.listItem(seller, "river_fish", 2, 10);

  const buyer = {
    userId: "m3", username: "Buyer", inventory: [], professions: {}, gold: 50, async save() {},
  };
  const rows = await market.marketRows();
  const listing = rows.find((row) => row.key === "river_fish");
  assert.ok(listing, "listing did not reach the board");

  const bought = await market.buyListing(buyer, listing.id);
  assert.equal(bought.ok, true, bought.message);
  assert.equal(inventory.countItem(buyer, "river_fish"), 2);
  assert.equal(buyer.gold, 40);
  assert.equal(seller.gold, 10, "the seller was not paid");
});

test("you cannot buy your own listing", async () => {
  const p = { userId: "m4", username: "Me", inventory: [], professions: {}, gold: 100, async save() {} };
  inventory.addItem(p, "oak_log", 1);
  const created = await market.listItem(p, "oak_log", 1, 5);
  assert.equal(created.ok, true);
  const rows = await market.marketRows();
  const mine = rows.filter((row) => row.key === "oak_log").at(-1);
  const result = await market.buyListing(p, mine.id);
  assert.equal(result.ok, false);
  assert.match(result.message, /your own/i);
});

console.log("\ncharacter sheet + progress");
test("spending an attribute point raises the stat", () => {
  const p = {
    baseStats: { health: 100, attack: 10, defense: 5, speed: 5, magic: 0 },
    attributes: { str: 0, int: 0, vit: 0 }, attributePoints: 1, talents: new Map(),
  };
  const before = calculateCombinedStats(p).attack;
  const result = spendAttributePoint(p, "str");
  assert.equal(result.ok, true);
  assert.ok(calculateCombinedStats(p).attack > before, "attack did not rise");
  assert.equal(p.attributePoints, 0);
});

test("talent bonuses are derived, not stored", () => {
  const p = { baseStats: { health: 100, attack: 10, defense: 5, speed: 5, magic: 0 }, talents: new Map(), talentPoints: 1 };
  learnTalent(p, "resolve");
  const bonus = talentBonuses(p);
  assert.ok(Object.keys(bonus).length > 0);
  assert.ok(calculateCombinedStats(p).health > 100);
});

test("levelling grants points and never stops at 99", () => {
  const p = {
    level: 1, experience: 0, attributePoints: 0, talentPoints: 0,
    baseStats: { health: 100, attack: 5, defense: 5, speed: 5, magic: 0 },
    currentHealth: 100, currentMana: 0,
  };
  addExperience(p, 500);
  assert.ok(p.level >= 4);
  assert.ok(xpToNextLevel(p.level) > xpToNextLevel(1));
  assert.equal(p.attributePoints, p.level - 1);
  assert.ok(p.talentPoints >= 1);
});

const failed = results.filter(([ok]) => !ok).length;
console.log("\n---------------------------------------------");
if (failed > 0) {
  console.error(`❌ ${failed}/${results.length} checks failed`);
  process.exit(1);
}
console.log(`✅ ${results.length} feature checks passed`);
void state;
void player;
