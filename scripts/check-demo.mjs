/**
 * Tests for the from-scratch demo screen (no Discord needed):
 *
 *   node scripts/check-demo.mjs
 */
import assert from "node:assert/strict";

import { applyButton } from "../demo/handler.js";
import { gameFor, resetGames, pruneGames, IDLE_MS } from "../demo/store.js";
import { PAD_IDS, renderPanel, STARTING_VITALS } from "../demo/view.js";
import {
  camera,
  createGame,
  FALLBACK,
  fieldGlyphs,
  fieldRows,
  glyph,
  grassAt,
  move,
  SPAWN,
  undo,
  VIEW,
  WORLD,
} from "../demo/world.js";
import { barGlyphs } from "../demo/view.js";
import { allEmojiNames, EMOJI_GROUPS, pendingEmojis } from "../config/emojiIds.js";
import fs from "node:fs";
import path from "node:path";

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

const fresh = () => createGame({ userId: "u1", name: "Hamzalopode#7830" });
const json = (frame) => ({
  embeds: frame.embeds.map((embed) => embed.toJSON()),
  components: frame.components.map((row) => row.toJSON().components),
});

console.log("\nemojis");
test("the demo emojis are registered and their PNGs exist", () => {
  const names = Object.keys(EMOJI_GROUPS.demo);
  assert.deepEqual(names, [
    "demo_grass_1",
    "demo_grass_2",
    "demo_player",
    "bar_hp",
    "bar_hp_empty",
    "bar_mana",
    "bar_mana_empty",
  ]);

  for (const name of names) {
    assert.ok(allEmojiNames().includes(name), `${name} is not in allEmojiNames()`);
    const file = path.resolve("docs/emojis", `${name}.png`);
    assert.ok(fs.existsSync(file), `missing ${name}.png — run npm run build:emojis`);

    // 128 x 128, straight out of the PNG header (no image library needed).
    const header = fs.readFileSync(file).subarray(0, 24);
    assert.equal(header.readUInt32BE(16), 128, `${name}.png is not 128 wide`);
    assert.equal(header.readUInt32BE(20), 128, `${name}.png is not 128 tall`);
  }

  // Nothing is uploaded yet, so every one of them is still pending.
  const pending = pendingEmojis();
  for (const name of names) assert.ok(pending.includes(name), `${name} should be pending`);
});

test("the field and bars use the configured emoji, not the fallback", () => {
  // Pretend the upload happened and the guild can see the emojis.
  for (const name of Object.keys(EMOJI_GROUPS.demo)) {
    EMOJI_GROUPS.demo[name] = "123456789012345678";
  }
  try {
    const glyphs = fieldGlyphs({ emojis: { cache: { has: () => true } } });
    assert.equal(glyphs.grass, "<:demo_grass_1:123456789012345678>");
    assert.equal(glyphs.grassDark, "<:demo_grass_2:123456789012345678>");
    assert.equal(glyphs.sprite, "<:demo_player:123456789012345678>");

    const bars = barGlyphs({ emojis: { cache: { has: () => true } } });
    assert.equal(bars.hp.filled, "<:bar_hp:123456789012345678>");
    assert.equal(bars.mana.empty, "<:bar_mana_empty:123456789012345678>");

    const [vitals] = json(renderPanel(fresh())).embeds;
    assert.ok(vitals.fields[0].value.startsWith("<:bar_hp:"), "the HP bar ignored the emoji");
    assert.ok(
      json(renderPanel(fresh())).embeds[1].description.startsWith("<:demo_grass_"),
      "the field ignored the emoji",
    );
  } finally {
    for (const name of Object.keys(EMOJI_GROUPS.demo)) EMOJI_GROUPS.demo[name] = null;
  }
});

test("a guild that is missing the emoji gets the unicode stand-in", () => {
  for (const name of Object.keys(EMOJI_GROUPS.demo)) {
    EMOJI_GROUPS.demo[name] = "123456789012345678";
  }
  try {
    const glyphs = fieldGlyphs({ emojis: { cache: { has: () => false } } });
    assert.equal(glyphs.grass, FALLBACK.grass);
    assert.equal(glyphs.sprite, FALLBACK.sprite);
    assert.equal(glyph("demo_grass_1", "x"), "<:demo_grass_1:123456789012345678>");
  } finally {
    for (const name of Object.keys(EMOJI_GROUPS.demo)) EMOJI_GROUPS.demo[name] = null;
  }
});

test("the field mixes two grass tiles deterministically", () => {
  const dark = [];
  const light = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 12; x += 1) (grassAt(x, y) === "grassDark" ? dark : light).push([x, y]);
  }
  assert.ok(dark.length > 4 && light.length > 40, `expected a speckle, got ${dark.length} dark`);
  assert.equal(grassAt(3, 5), grassAt(3, 5), "the speckle must not be random");
});

console.log("\npanel");
test("two panels: vitals, then the field", () => {
  const { embeds } = json(renderPanel(fresh()));
  assert.equal(embeds.length, 2);

  const [vitals, field] = embeds;
  assert.equal(vitals.description, "**Hamzalopode#7830**");
  assert.deepEqual(
    vitals.fields.map((row) => row.name),
    ["HP: 10/10", "Mana: 6/6"],
  );
  assert.equal(field.description.split("\n").length, VIEW.height);
  assert.equal(field.footer.text, "x: 8, y: 7, area: ");
});

test("bars are one square per point", () => {
  const [vitals] = json(renderPanel(fresh())).embeds;
  assert.equal(vitals.fields[0].value, FALLBACK.hpFull.repeat(STARTING_VITALS.maxHp));
  assert.equal(vitals.fields[1].value, FALLBACK.manaFull.repeat(STARTING_VITALS.maxMana));

  const hurt = fresh();
  hurt.hp = 4;
  const [vitalsHurt] = json(renderPanel(hurt)).embeds;
  assert.equal(
    vitalsHurt.fields[0].value,
    FALLBACK.hpFull.repeat(4) + FALLBACK.hpEmpty.repeat(6),
  );
  assert.equal(vitalsHurt.fields[0].name, "HP: 4/10");
});

test("the field is a 16 x 7 window with the sprite on it", () => {
  const rows = fieldRows(fresh());
  assert.equal(rows.length, VIEW.height);
  for (const row of rows) {
    const glyphs = row.match(/<a?:[^>]+>|\p{Extended_Pictographic}/gu) ?? [];
    assert.equal(glyphs.length, VIEW.width, `row has ${glyphs.length} tiles`);
  }
  const spriteCells = rows.join("").split(FALLBACK.sprite).length - 1;
  assert.equal(spriteCells, 1, "exactly one sprite");
});

console.log("\npad");
test("the pad is the original 4 x 4", () => {
  const rows = json(renderPanel(fresh())).components;
  assert.deepEqual(
    rows.map((row) => row.length),
    [4, 4, 4, 2],
  );
  const labels = rows.map((row) => row.map((button) => button.label));
  assert.deepEqual(labels, [
    ["7", "\u200B", "\u200B", "\u200B"],
    ["6", "\u200B", "1", "\u200B"],
    ["5", "4", "2", "3"],
    ["-1", "Hamzalopode#7830"],
  ]);
  assert.equal(rows[3][1].disabled, true, "the name plate is not a button you can press");
  assert.equal(rows[0][0].style, 2, "everything is a grey secondary button");
});

test("every pad id is handled", () => {
  const game = fresh();
  for (const id of PAD_IDS) {
    const result = applyButton(game, id);
    assert.equal(typeof result.moved, "boolean", `${id} returned nothing`);
  }
});

console.log("\nmovement");
test("3 walks east, 6 walks west, the blank cell walks north", () => {
  let game = fresh();
  applyButton(game, "demo_move_3");
  assert.deepEqual([game.x, game.y], [SPAWN.x + 1, SPAWN.y]);

  game = fresh();
  applyButton(game, "demo_move_6");
  assert.deepEqual([game.x, game.y], [SPAWN.x - 1, SPAWN.y]);

  game = fresh();
  applyButton(game, "demo_move_north");
  assert.deepEqual([game.x, game.y], [SPAWN.x, SPAWN.y - 1]);
});

test("all eight directions line up with the pad layout", () => {
  const map = {
    demo_move_7: [-1, -1],
    demo_move_north: [0, -1],
    demo_move_1: [1, -1],
    demo_move_6: [-1, 0],
    demo_move_3: [1, 0],
    demo_move_5: [-1, 1],
    demo_move_4: [0, 1],
    demo_move_2: [1, 1],
  };

  for (const [id, [dx, dy]] of Object.entries(map)) {
    const game = fresh();
    applyButton(game, id);
    assert.deepEqual(
      [game.x - SPAWN.x, game.y - SPAWN.y],
      [dx, dy],
      `${id} walked the wrong way`,
    );
  }
});

test("-1 steps back one move", () => {
  // The demo always opens on the spawn tile, so walk back to it.
  const game = fresh();
  move(game, "3");
  move(game, "4");
  undo(game);
  assert.deepEqual([game.x, game.y], [SPAWN.x + 1, SPAWN.y]);
  undo(game);
  assert.deepEqual([game.x, game.y], [SPAWN.x, SPAWN.y]);
  const further = applyButton(game, "demo_undo");
  assert.equal(further.moved, false, "nothing left to undo");
  assert.deepEqual([game.x, game.y], [SPAWN.x, SPAWN.y]);
});

test("the field edges block instead of wrapping", () => {
  const game = fresh();
  game.x = 0;
  game.y = 0;
  assert.deepEqual(move(game, "7"), { moved: false, blocked: true });
  assert.deepEqual([game.x, game.y], [0, 0]);

  game.x = WORLD.width - 1;
  game.y = WORLD.height - 1;
  assert.deepEqual(move(game, "3"), { moved: false, blocked: true });
  assert.deepEqual(move(game, "2"), { moved: false, blocked: true });
});

test("the window slides only when the player reaches its edge", () => {
  const game = fresh();
  assert.deepEqual(camera(game), { x: SPAWN.x - 8, y: SPAWN.y - 3 });

  // Eight steps east: the player ends on the window's last column and the
  // window moves with them.
  for (let step = 0; step < 9; step += 1) applyButton(game, "demo_move_3");
  assert.equal(game.x, SPAWN.x + 9);
  assert.equal(camera(game).x, game.x - VIEW.width + 1);

  // Walking back west keeps the window where it is until the player hits
  // its left edge, then it drags along.
  const parked = camera(game).x;
  for (let step = 0; step < 9; step += 1) applyButton(game, "demo_move_6");
  assert.equal(game.x, SPAWN.x);
  assert.equal(camera(game).x, parked, "the window should not recentre");

  for (let step = 0; step < 8; step += 1) applyButton(game, "demo_move_6");
  assert.equal(camera(game).x, game.x, "the window follows at the left edge");

  // And it never leaves the world.
  const corner = fresh();
  corner.x = 0;
  corner.y = 0;
  corner.camera = { x: 0, y: 0 };
  assert.deepEqual(camera(corner), { x: 0, y: 0 });
});

test("the sprite moves on the field, the field scrolls", () => {
  const game = fresh();
  const before = fieldRows(game);
  applyButton(game, "demo_move_3");
  const after = fieldRows(game);
  assert.notDeepEqual(before, after, "the screen did not change");
});

console.log("\nstate");
test("each player gets their own game", () => {
  resetGames();
  const a = gameFor({ userId: "a", name: "A#0001" });
  const b = gameFor({ userId: "b", name: "B#0002" });
  move(a, "3");

  assert.notEqual(a.x, b.x);
  assert.equal(gameFor({ userId: "a", name: "A#0001" }), a, "same game on re-open");
});

test("idle games are pruned", () => {
  resetGames();
  const game = gameFor({ userId: "old", name: "Old#0001" });
  game.lastSeen = Date.now() - IDLE_MS - 1;
  assert.equal(pruneGames(), 1);
  assert.equal(gameFor({ userId: "old", name: "Old#0001" }).x, SPAWN.x);
});

const failed = results.filter(([ok]) => !ok).length;
console.log("\n---------------------------------------------");
if (failed > 0) {
  console.error(`❌ ${failed}/${results.length} demo checks failed`);
  process.exit(1);
}
console.log(`✅ ${results.length} demo checks passed`);
