/**
 * Screen-by-screen smoke test, no Discord connection needed:
 *
 *   node scripts/check-game.mjs
 *
 * Every panel button is pressed through the real interaction handler with
 * stubbed models. The run fails on a thrown error, a missing embed, more than
 * 5 rows/buttons, a duplicated custom id, or `undefined` leaking into text.
 */
import assert from "node:assert/strict";
import { makePlayer, press, state, fail, player } from "./game-harness.mjs";

const sections = [];
const section = (name) => { sections.push(name); console.log(`\n${name}`); };

section("map");
await press("map_back_to_map");
await press("map_show_actions");
await press("map_move_up");
await press("map_move_down");
await press("map_move_left");
await press("map_move_right");

section("character sheet");
const char = await press("map_show_character");
await press("map_gear_weapon");
await press("map_gear_armor");
await press("map_gear_accessory");
await press("map_attr_str");
await press("map_attr_int");
await press("map_attr_vit");
await press("map_use_potion");

section("talents");
await press("map_show_talents");
await press("map_talent_resolve");
await press("map_talent_learn");
await press("map_talent_brute_force");
await press("map_talent_learn");

section("bag");
await press("map_show_inventory");
await press("map_bag_slot_0");
await press("map_bag_preview");
await press("map_bag_use");
await press("map_bag_select");
await press("map_bag_trash");

section("professions");
await press("map_show_professions");
await press("map_gather_mining");
await press("map_gather_mining"); // cooldown should answer softly
await press("map_gather_woodcutting");
await press("map_gather_fishing");
await press("map_gather_herbalism");
await press("map_craft_smithing");
await press("map_craft_crafting");
await press("map_craft_cooking");

section("quests");
await press("map_show_quests");
await press("map_quest_new");
await press("map_quest_new");
await press("map_quest_daily");
await press("map_quest_drop_0");

section("achievements");
await press("map_show_achievements");
for (const category of ["level", "combat", "profession", "quest", "all"]) {
  await press(`map_ach_${category}`);
}

section("rankings");
await press("map_show_rankings");
await press("map_rank_professions");
await press("map_rank_achievements");
await press("map_rank_level");

section("market");
await press("map_show_market");
await press("map_bag_slot_1");
await press("map_market_sell");
const board = await press("map_show_market");
if (board.embed.description.includes("empty")) {
  console.error("  ❌ market: the listing we just created is not on the board");
  fail.push("market listing missing");
}
const listingId = /map_market_buy_(\w+)/.exec(
  JSON.stringify(board.payload.components.map((row) => row.toJSON())),
)?.[1];
await press(`map_market_buy_${listingId ?? "missing"}`);

section("navigation aliases");
await press("map_char_bag");
await press("map_char_done");

console.log("\n---------------------------------------------");
if (fail.length > 0) {
  console.error(`❌ ${fail.length} failure(s):`);
  for (const message of fail) console.error("   •", message);
  process.exit(1);
}
console.log(`✅ ${sections.length} sections, ${(await import("./game-harness.mjs")).pressed.length} button presses, no failures`);

// sanity: the sheet really renders the reference layout
const description = char.embed.description;
for (const needle of ["Character screen", "Attributes", "Talents", "Gear", "Bags", "Bag slots max"]) {
  assert.ok(description.includes(needle), `character sheet is missing "${needle}"`);
}
console.log("✅ character sheet contains every reference section");
