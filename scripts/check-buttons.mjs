/**
 * Button panel linter.
 *
 * Discord rejects a message that repeats a `custom_id`, has more than five
 * buttons in a row, or more than five rows — and it only tells you at the
 * moment a player clicks a button (50035 Invalid Form Body), which is how the
 * character sheet shipped broken once.
 *
 * Run it after touching utils/buttonComponents.js:
 *
 *   node scripts/check-buttons.mjs
 */
import assert from "node:assert/strict";

import {
  createBagButtons,
  createCharacterButtons,
  createNavigationButtons,
  createTalentButtons,
} from "../utils/buttonComponents.js";
import { createActionButton, createActionButtonDisabled } from "../utils/buttonComponents.js";
import { ButtonStyle } from "discord.js";

const player = {
  userId: "u1",
  username: "Tester",
  class: "Warrior",
  race: "Human",
  level: 1,
  location: { x: 1, y: 1 },
  bagSlots: 8,
  attributePoints: 1,
  talentPoints: 1,
  talents: new Map(),
  equipped: {},
  inventory: [
    { item: { itemId: "warrior_sword", name: "Broadsword", type: "weapon", emoji: "⚔️" }, quantity: 1 },
    { item: { itemId: "health_potion", name: "Health Potion", type: "consumable", emoji: "🧪" }, quantity: 2 },
  ],
};

const map = {
  mapId: "main_city",
  mapData: [
    ["grass", "grass", "grass"],
    ["grass", "grass", "grass"],
    ["grass", "grass", "grass"],
  ],
};

const panels = {
  character: createCharacterButtons(player, { gear: ["⚔️", "🛡️", "💍"] }),
  talents: createTalentButtons(player, "resolve"),
  bag: createBagButtons(player, 0),
  map: await createNavigationButtons(player, map, { user: { username: "Tester" } }),
};

let failures = 0;

for (const [name, rows] of Object.entries(panels)) {
  const ids = [];

  if (rows.length > 5) {
    console.error(`❌ ${name}: ${rows.length} rows (Discord allows 5)`);
    failures += 1;
  }

  rows.forEach((row, index) => {
    const components = row.toJSON().components;

    if (components.length > 5) {
      console.error(`❌ ${name} row ${index + 1}: ${components.length} buttons (Discord allows 5)`);
      failures += 1;
    }

    for (const component of components) ids.push(component.custom_id);
  });

  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (duplicates.length > 0) {
    console.error(`❌ ${name}: duplicated custom_id ${duplicates.join(", ")}`);
    failures += 1;
  } else {
    console.log(`✅ ${name}: ${rows.length} rows, ${ids.length} buttons, ids unique`);
  }
}

// The map's directional buttons must exist in both enabled and disabled form.
createActionButton("map_move_up", "Up", ButtonStyle.Secondary);
createActionButtonDisabled("map_move_up", "Up", ButtonStyle.Secondary);

assert.equal(failures, 0, "button panels failed validation");
console.log("\nAll panels are valid.");
