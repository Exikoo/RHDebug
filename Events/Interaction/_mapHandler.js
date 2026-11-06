import {
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import Profile from "../../models/Profile.js";

import { getMap } from "../../utils/mapCache.js";
import { getCombinedStats, getItemMap, idOf } from "../../utils/itemCache.js";
import { buildMapEmbed } from "../../utils/screen.js";
import combatManager from "../../utils/combatManager.js";
import {
  monsterManager,
  MONSTER_TEMPLATES,
  monsterKey,
} from "../../monsterManager.js";
import { isEnterable, tileAt } from "../../utils/mapUtils.js";
import { replyError } from "../../utils/errorHandler.js";

import {
  generateBagDisplay,
  generateCharacterDisplay,
  generateTalentDisplay,
} from "../../utils/menuDisplays.js";

import {
  createNavigationButtons,
  createBackButton,
  createBagButtons,
  createCharacterButtons,
  createTalentButtons,
  createTileActionButtons,
  isNearShop,
  createPlaceholderButton,
  createQuitButton,
  BAG_EMOJI,
  createActionButtonDisabled,
  createRequestedByButton,
} from "../../utils/buttonComponents.js";

import { LEGEND } from "../../config/mapConfig.js";
import classes from "../../config/classes.js";
import { TALENT_BY_ID } from "../../config/talents.js";
import { customEmoji } from "../../config/emojiIds.js";
import {
  learnTalent,
  spendAttributePoint,
} from "../../utils/talents.js";
import { getItemEmoji, EMPTY_SLOT_EMOJI } from "../../utils/itemDisplay.js";
import { addExperience, clampVitals } from "../../utils/progression.js";
import { COLORS } from "../../utils/uiTheme.js";

/*
 * Performance notes
 * -----------------
 * Every button press used to cost ~8+ database queries, most of them
 * sequential: 1 profile + 4 populates + 2 map reads + 1 query per monster
 * tile (twice: once for rendering, once for the buttons).
 *
 *  - The profile is loaded WITHOUT populate. Equipment stats and bag
 *    contents come from an in-memory item cache (utils/itemCache.js).
 *  - Maps come from an in-memory cache (utils/mapCache.js).
 *  - Dead monsters are fetched with ONE query per render, and skipped
 *    entirely on maps that contain no monsters.
 *  - The deferUpdate() ack and the profile query run concurrently, and
 *    the profile save overlaps the dead-monster query.
 *  - Combat does a single atomic update instead of read-modify-save.
 */

const EPHEMERAL = MessageFlags.Ephemeral;
const EMPTY_SET = new Set();

const COMBAT_MESSAGE_TTL = 10 * 60 * 1000;
const COMBAT_MESSAGE_MAX = 20;
const COMBAT_MESSAGE_DISPLAY = 4;
const BAG_SELECTION_TTL = 10 * 60 * 1000;

const MOVES = {
  map_move_up: { dx: 0, dy: -1 },
  map_move_down: { dx: 0, dy: 1 },
  map_move_left: { dx: -1, dy: 0 },
  map_move_right: { dx: 1, dy: 0 },
};

/** Paths model methods (useItem / discardItem) need populated. */
const ITEM_ACTION_POPULATE = [
  "inventory.item",
  "equipped.weapon",
  "equipped.armor",
  "equipped.accessory",
];

/** @type {Map<string, {messages: string[], lastTouched: number}>} */
const combatMessagesMap = new Map();

/**
 * Which bag slot each user has selected while the bag view is open.
 * @type {Map<string, {index: number, touched: number}>}
 */
const bagSelectionMap = new Map();

const getBagSelection = (userId) => bagSelectionMap.get(userId)?.index ?? null;

/**
 * Which talent node the user is looking at on the talent screen.
 * @type {Map<string, {id: string, touched: number}>}
 */
const talentSelectionMap = new Map();
const getTalentSelection = (userId) => talentSelectionMap.get(userId)?.id ?? null;
const setTalentSelection = (userId, id) =>
  talentSelectionMap.set(userId, { id, touched: Date.now() });
const clearBagSelection = (userId) => bagSelectionMap.delete(userId);
const setBagSelection = (userId, index) =>
  bagSelectionMap.set(userId, { index, touched: Date.now() });

/**
 * @typedef {Object} Ctx
 * @property {import("discord.js").ButtonInteraction} interaction
 * @property {any} player  Profile document, NOT populated.
 * @property {any} map     Cached lean map document. Never mutate it.
 * @property {string} userId
 * @property {() => Promise<any>} stats  Combined stats (memoized per press).
 */

// =====================================================================
// Entry point
// =====================================================================

/**
 * @param {import("discord.js").Interaction} interaction
 * @returns {boolean}
 */
export function match(interaction) {
  return interaction.isButton() && interaction.customId.startsWith("map_");
}

/**
 * @param {import("discord.js").ButtonInteraction} interaction
 */
export async function execute(interaction) {
  try {
    const originalUserId =
      interaction.message.interactionMetadata?.user?.id ??
      interaction.message.interaction?.user?.id;

    if (!originalUserId || interaction.user.id !== originalUserId) {
      return interaction.reply({
        content: "❌ Only the original member can use these buttons.",
        flags: EPHEMERAL,
      });
    }

    const handler = resolveHandler(interaction.customId);
    if (!handler) return interaction.deferUpdate(); // e.g. disabled placeholders

    // Acknowledge and fetch the profile at the same time.
    const [, player] = await Promise.all([
      interaction.deferUpdate(),
      Profile.findOne({ userId: interaction.user.id }),
    ]);

    if (!player || !player.currentMapId) return sendSessionExpired(interaction);

    const map = await getMap(player.currentMapId);
    if (!map) {
      return sendMapError(interaction, `Map ${player.currentMapId} not found`);
    }

    return await handler(createContext(interaction, player, map));
  } catch (error) {
    await replyError(interaction, error, {
      logPrefix: "Map interaction error:",
    });
  }
}

/** @returns {Ctx} */
function createContext(interaction, player, map) {
  let statsPromise = null;
  return {
    interaction,
    player,
    map,
    userId: player.userId,
    stats: () => (statsPromise ??= getCombinedStats(player)),
  };
}

// =====================================================================
// Routing
// =====================================================================

const EXACT_HANDLERS = new Map([
  ["map_open", showMap],
  ["map_back_to_map", showMap],
  ["map_action_shop_leave", showMap],
  ["map_quit", quitGame],
  ["map_show_inventory", openBag],
  ["map_bag_use", (ctx) => runBagAction(ctx, "✅", useSelected)],
  ["map_bag_select", (ctx) => runBagAction(ctx, "🛡️", equipSelected)],
  ["map_bag_preview", showSelectedBagSlot],
  ["map_bag_trash", (ctx) => runBagAction(ctx, "🗑️", trashSelected)],
  ["map_show_stats", showCharacter],
  ["map_show_character", showCharacter],
  ["map_show_talents", showTalents],
  ["map_talent_learn", learnSelectedTalent],
  ["map_use_potion", usePotion],
  ["map_show_actions", showActions],
  ["map_action_stairs", useStairs],
  ["map_action_shop", openShop],
]);

const PREFIX_HANDLERS = [
  ["map_move_", handleMove],
  ["map_bag_slot_", selectBagSlot],
  ["map_talent_", selectTalent],
  ["map_attr_", spendAttribute],
  ["map_gear_", showGearItem],
];

function resolveHandler(customId) {
  const exact = EXACT_HANDLERS.get(customId);
  if (exact) return exact;

  for (const [prefix, handler] of PREFIX_HANDLERS) {
    if (customId.startsWith(prefix)) return handler;
  }
  return null;
}

// =====================================================================
// Map view
// =====================================================================

/** Dead-monster keys for a map; no query at all if it has no monsters. */
function loadDeadKeys(map) {
  return map.hasMonsters
    ? monsterManager.getDeadPositions(map.mapId)
    : EMPTY_SET;
}

/**
 * @param {Ctx} ctx
 * @param {object} map
 * @param {Set<string>|Promise<Set<string>>} [deadKeys] Fetched if omitted.
 */
async function renderMap(ctx, map, deadKeys) {
  const [stats, dead] = await Promise.all([
    ctx.stats(),
    deadKeys ?? loadDeadKeys(map),
  ]);

  return ctx.interaction.editReply({
    embeds: [
      buildMapEmbed({
        player: ctx.player,
        stats,
        map,
        deadKeys: dead,
        recent: getRecentCombatMessages(ctx.player.userId),
      }),
    ],
    components: await createNavigationButtons(
      ctx.player,
      map,
      ctx.interaction,
      dead,
    ),
  });
}

/** @param {Ctx} ctx */
async function showMap(ctx) {
  clearBagSelection(ctx.userId);
  return renderMap(ctx, ctx.map);
}

// =====================================================================
// Movement
// =====================================================================

/** Starts the dead-monster lookup; safe to leave un-awaited on early exits. */
function startDeadLookup(map) {
  const lookup = Promise.resolve(loadDeadKeys(map));
  lookup.catch(() => {}); // still throws when awaited; avoids an unhandled rejection otherwise
  return lookup;
}

/** @param {Ctx} ctx */
async function handleMove(ctx) {
  const { interaction, player, userId } = ctx;
  let map = ctx.map;
  clearBagSelection(userId);

  const move = MOVES[interaction.customId];
  const next = move
    ? { x: player.location.x + move.dx, y: player.location.y + move.dy }
    : null;
  const tile = next ? tileAt(map.mapData, next.x, next.y) : null;
  const isMonster = tile !== null && Boolean(MONSTER_TEMPLATES[tile]);
  const canStep =
    tile !== null && !isMonster && isEnterable(map.mapData, next.x, next.y);
  const connection = canStep ? findConnection(map, next) : null;

  // Start the dead-monster lookup now so it overlaps with the save below —
  // unless we are about to leave this map, in which case it would be wasted.
  let deadKeys = connection ? undefined : startDeadLookup(map);

  if (isMonster) {
    const dead = await deadKeys;

    if (!dead.has(monsterKey(next.x, next.y))) {
      return handleCombat(ctx, next, tile, dead);
    }

    // Walk over the remains.
    player.location = next;
    clearTarget(player);
    await player.save();
  } else if (canStep) {
    applyStep(player, next);
    await Promise.all([player.save(), deadKeys]);

    if (connection) {
      const arrived = await transition(ctx, connection);
      if (arrived)
        map = arrived; // renderMap fetches the new map's own lookup
      else deadKeys = startDeadLookup(ctx.map); // transition failed: still here
    }
  }

  return renderMap(ctx, map, deadKeys);
}

function clearTarget(player) {
  player.currentTarget = null;
  player.targetProgress = "0/0";
  player.targetPosition = null;
}

/** Moves the player and drops their combat target if they walk away from it. */
function applyStep(player, next) {
  const oldPosition = { x: player.location.x, y: player.location.y };
  player.location = next;

  if (player.currentTarget && player.targetPosition) {
    const oldDistance = calculateDistance(oldPosition, player.targetPosition);
    const newDistance = calculateDistance(
      player.location,
      player.targetPosition,
    );

    if (newDistance > oldDistance && newDistance > 1) {
      clearTarget(player);
      combatManager.endCombat(player.userId);
    }
  }
}

function calculateDistance(pos1, pos2) {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// =====================================================================
// Map transitions
// =====================================================================

function findConnection(map, position) {
  return map.connections?.find(
    (conn) =>
      conn.fromPosition?.x === position.x &&
      conn.fromPosition?.y === position.y,
  );
}

/** Fire-and-forget ephemeral message; never blocks or breaks the render. */
function notify(interaction, content) {
  interaction
    .followUp({ content, flags: EPHEMERAL })
    .catch((error) => console.error("Follow-up failed:", error));
}

/**
 * @param {Ctx} ctx
 * @returns {Promise<object|null>} The new map, or null if the move failed.
 */
async function transition(ctx, connection) {
  const { interaction, player } = ctx;

  try {
    await player.changeMap(
      connection.targetMapId,
      connection.targetPosition || null,
    );
  } catch (error) {
    console.error("Map transition error:", error);
    notify(
      interaction,
      "❌ Could not transition to the new area. Report this problem to the developers.",
    );
    return null;
  }

  notify(interaction, "🚪 You have entered a new area...");
  return getMap(player.currentMapId);
}

// =====================================================================
// Combat
// =====================================================================

/**
 * @param {Ctx} ctx
 * @param {{x: number, y: number}} position
 * @param {string} monsterType
 * @param {Set<string>} deadKeys
 */
async function handleCombat(ctx, position, monsterType, deadKeys) {
  const { interaction, player, map } = ctx;

  try {
    const [stats, monster] = await Promise.all([
      ctx.stats(),
      monsterManager.getOrCreateMonster(
        map.mapId,
        position.x,
        position.y,
        monsterType,
      ),
    ]);

    const playerDamage = Math.max(1, stats.attack - monster.defense);
    const monsterDamage = Math.max(1, monster.attack - stats.defense);

    const {
      monster: updated,
      killed,
      alreadyDead,
    } = await monsterManager.applyDamage(monster._id, playerDamage);

    let nextDead = deadKeys;

    if (alreadyDead) {
      // Another player finished it first: no hit, no reward.
      addCombatMessage(player.userId, `${monster.name} was already defeated.`);
      clearTarget(player);
      nextDead = new Set(deadKeys).add(monsterKey(position.x, position.y));
    } else {
      addCombatMessage(
        player.userId,
        `You hit ${monster.name} for ${playerDamage} HP!`,
      );

      player.currentHealth = Math.max(0, player.currentHealth - monsterDamage);
      player.currentTarget = monster.name;
      player.targetProgress = `${updated.currentHealth}/${updated.maxHealth}`;
      player.targetPosition = position;

      if (killed) {
        const { levelsGained } = addExperience(
          player,
          monster.experience,
          stats,
        );
        player.gold += Math.floor(monster.experience / 2);
        clearTarget(player);
        addCombatMessage(
          player.userId,
          `You defeated ${monster.name}! +${monster.experience} XP`,
        );
        nextDead = new Set(deadKeys).add(monsterKey(position.x, position.y));

        if (levelsGained > 0) {
          addCombatMessage(
            player.userId,
            `⭐ Level up! You are now Lv. ${player.level} (fully healed).`,
          );
        }
      } else {
        addCombatMessage(
          player.userId,
          `${monster.name} hit you for ${monsterDamage} HP!`,
        );
      }
    }

    clampVitals(player, stats);

    if (player.currentHealth <= 0) {
      const { lost } = await respawnAfterDeath(player, stats);
      addCombatMessage(
        player.userId,
        `💀 ${monster.name} defeated you!`,
      );
      addCombatMessage(
        player.userId,
        `You wake up in the city${lost > 0 ? ` (-${lost} gold)` : ""}.`,
      );

      const respawnMap = await getMap(player.currentMapId);
      return await renderMap(ctx, respawnMap ?? map, EMPTY_SET);
    }

    await player.save();
    return await renderMap(ctx, map, nextDead);
  } catch (error) {
    console.error("Combat error:", error);
    await interaction.followUp({
      content:
        "❌ Something went wrong with the combat. Please report this problem to the developers.",
      flags: EPHEMERAL,
    });
  }
}

const RESPAWN_MAP_ID = "main_city";
const RESPAWN_POINT = { x: 8, y: 5 };
/** Share of gold lost when a monster knocks the player out. */
const DEATH_GOLD_PENALTY = 0.1;

/**
 * Sends the player back to the city at full health after a defeat.
 * Death is a setback, not a dead end: the run continues, the town is safe.
 * @param {any} player Profile document.
 * @param {{health:number, magic:number}} stats Combined stats.
 * @returns {Promise<{lost: number}>} Gold lost.
 */
async function respawnAfterDeath(player, stats) {
  const lost = Math.floor((player.gold || 0) * DEATH_GOLD_PENALTY);

  player.gold = Math.max(0, (player.gold || 0) - lost);
  player.currentHealth = Math.max(1, stats.health ?? 1);
  player.currentMana = Math.max(0, stats.magic ?? 0);
  clearTarget(player);
  combatManager.endCombat(player.userId);

  try {
    await player.changeMap(RESPAWN_MAP_ID, RESPAWN_POINT);
  } catch (error) {
    console.error("Respawn failed, forcing city spawn:", error);
    player.currentMapId = RESPAWN_MAP_ID;
    player.location = { ...RESPAWN_POINT };
    await player.save();
  }

  return { lost };
}

// =====================================================================
// Combat message log
// =====================================================================

function addCombatMessage(userId, message) {
  const now = Date.now();
  const entry = combatMessagesMap.get(userId) ?? {
    messages: [],
    lastTouched: now,
  };

  entry.messages.unshift(message);
  if (entry.messages.length > COMBAT_MESSAGE_MAX) {
    entry.messages.length = COMBAT_MESSAGE_MAX;
  }
  entry.lastTouched = now;

  combatMessagesMap.set(userId, entry);
}

function getRecentCombatMessages(userId) {
  const entry = combatMessagesMap.get(userId);
  return entry ? entry.messages.slice(0, COMBAT_MESSAGE_DISPLAY) : [];
}

// =====================================================================
// Stats / actions / stairs / shop
// =====================================================================

/**
 * Character screen: attributes, talents, gear, bags and vitals.
 *
 * Everything it needs comes from the item cache plus the memoized combined
 * stats, so a press costs one profile read and no populates.
 *
 * @param {Ctx} ctx
 */
async function showCharacter(ctx) {
  const { player, interaction } = ctx;

  const [stats, items] = await Promise.all([ctx.stats(), getItemMap()]);

  const itemFor = (ref) => items.get(idOf(ref)) ?? null;
  const emojiFor = (item) => (item ? getItemEmoji(item) : EMPTY_SLOT_EMOJI);

  const weapon = itemFor(player.equipped?.weapon);
  const armor = itemFor(player.equipped?.armor);
  const accessory = itemFor(player.equipped?.accessory);

  const inventory = (player.inventory ?? []).map((slot) => ({
    item: itemFor(slot.item),
    quantity: slot.quantity ?? 1,
  }));
  const healers = inventory.filter(
    (slot) => slot.item?.type === "consumable" && (slot.item.stats?.health ?? 0) > 0,
  );
  const potions = healers.reduce((total, slot) => total + slot.quantity, 0);

  // Top strip = the first four things in the bag, padded so the row is stable.
  const quick = Array.from({ length: 4 }, (_, i) =>
    inventory[i]?.item ? getItemEmoji(inventory[i].item) : EMPTY_SLOT_EMOJI,
  );

  return interaction.editReply({
    embeds: [
      generateCharacterDisplay({
        player,
        stats,
        gear: {
          armor: [emojiFor(armor), EMPTY_SLOT_EMOJI, EMPTY_SLOT_EMOJI, EMPTY_SLOT_EMOJI],
          weapon: [emojiFor(weapon), EMPTY_SLOT_EMOJI],
          accessory: [emojiFor(accessory), EMPTY_SLOT_EMOJI, EMPTY_SLOT_EMOJI, EMPTY_SLOT_EMOJI],
        },
        bags: inventory.map((slot) => (slot.item ? getItemEmoji(slot.item) : EMPTY_SLOT_EMOJI)),
        quickBar: quick,
        classAttributes:
          classes[String(player.class ?? "").toLowerCase()]?.attributes ?? {},
        potions,
      }),
    ],
    components: createCharacterButtons(player, {
      gear: [emojiFor(weapon), emojiFor(armor), emojiFor(accessory)],
      bag: BAG_EMOJI,
      use: customEmoji("ui_use", "🦴"),
    }),
  });
}

/**
 * Gear button: shows what is equipped in that slot without leaving the sheet.
 * @param {Ctx} ctx
 */
async function showGearItem(ctx) {
  const slot = ctx.interaction.customId.slice("map_gear_".length);
  if (!["weapon", "armor", "accessory"].includes(slot)) {
    return ctx.interaction.followUp({ content: "❌ Unknown slot.", flags: EPHEMERAL });
  }

  const items = await getItemMap();
  const item = items.get(idOf(ctx.player.equipped?.[slot]));
  if (!item) {
    return ctx.interaction.followUp({
      content: `❌ Nothing equipped in your ${slot} slot.`,
      flags: EPHEMERAL,
    });
  }

  const stats = Object.entries(item.stats ?? {})
    .map(([key, value]) => `+${value} ${key}`)
    .join(", ");

  return ctx.interaction.followUp({
    content: [
      `**${item.name}** (${slot})`,
      item.description ?? "*No description.*",
      stats ? `> ${stats}` : "> No stat bonus",
    ].join("\n"),
    flags: EPHEMERAL,
  });
}

/**
 * The bone button: drinks the first healing potion in the bag.
 * @param {Ctx} ctx
 */
async function usePotion(ctx) {
  const { player, interaction } = ctx;

  // Resolve the potion from the item cache (no populate); `useItem` loads the
  // document itself when the slot still holds a raw id.
  const items = await getItemMap();
  const index = (player.inventory ?? []).findIndex((slot) => {
    const item = items.get(idOf(slot.item));
    return item?.type === "consumable" && (item.stats?.health ?? 0) > 0;
  });

  if (index === -1) {
    return interaction.followUp({
      content: "❌ You have no healing potion left.",
      flags: EPHEMERAL,
    });
  }

  try {
    const message = await player.useItem(index);
    await player.save();
    return Promise.all([
      showCharacter(ctx),
      interaction.followUp({ content: `🧪 ${message}`, flags: EPHEMERAL }),
    ]);
  } catch (error) {
    return interaction.followUp({
      content: `❌ Error: ${error.message}`,
      flags: EPHEMERAL,
    });
  }
}

/**
 * Talent screen. The highlighted node is kept per user so the description
 * survives re-renders (and so "Learn" knows what to spend on).
 * @param {Ctx} ctx
 */
async function showTalents(ctx) {
  const selectedId = getTalentSelection(ctx.userId);
  const items = await getItemMap();
  const emojiFor = (ref) => {
    const item = items.get(idOf(ref));
    return item ? getItemEmoji(item) : EMPTY_SLOT_EMOJI;
  };

  return ctx.interaction.editReply({
    embeds: [
      generateTalentDisplay({
        player: ctx.player,
        selectedId,
        quickBar: Array.from({ length: 4 }, (_, i) =>
          (ctx.player.inventory ?? [])[i]
            ? emojiFor(ctx.player.inventory[i].item)
            : EMPTY_SLOT_EMOJI,
        ),
      }),
    ],
    components: createTalentButtons(ctx.player, selectedId),
  });
}

/** @param {Ctx} ctx */
async function selectTalent(ctx) {
  const id = ctx.interaction.customId.slice("map_talent_".length);

  if (TALENT_BY_ID.has(id)) setTalentSelection(ctx.userId, id);
  return showTalents(ctx);
}

/** @param {Ctx} ctx */
async function learnSelectedTalent(ctx) {
  const id = getTalentSelection(ctx.userId);
  if (!id) return showTalents(ctx);

  const result = learnTalent(ctx.player, id);
  if (result.ok) await ctx.player.save();

  return Promise.all([
    showTalents(ctx),
    ctx.interaction.followUp({ content: result.message, flags: EPHEMERAL }),
  ]);
}

/** @param {Ctx} ctx */
async function spendAttribute(ctx) {
  const key = ctx.interaction.customId.slice("map_attr_".length);
  const result = spendAttributePoint(ctx.player, key);
  if (result.ok) await ctx.player.save();

  // The stats memo is per-press; rebuild it so the new point shows up now.
  const fresh = {
    ...ctx,
    stats: () => getCombinedStats(ctx.player),
  };

  return Promise.all([
    showCharacter(fresh),
    ctx.interaction.followUp({ content: result.message, flags: EPHEMERAL }),
  ]);
}

/** @param {Ctx} ctx */
async function showActions(ctx) {
  const { player, map, interaction } = ctx;
  const { x, y } = player.location;

  const tile = map.mapData[y]?.[x];
  let desc = "*No special actions here.*";

  if (LEGEND[tile]?.event === "stairs") desc = "You see stairs leading down.";
  const mapEvent = map.events?.find(
    (e) => e.position?.x === x && e.position?.y === y,
  );
  if (mapEvent) desc = getEventDescription(mapEvent);

  const actionsEmbed = new EmbedBuilder()
    .setColor(0x99aab5)
    .setTitle("🛠️ Available Actions")
    .setDescription(desc);

  const tileButtons = createTileActionButtons(tile);
  return interaction.editReply({
    embeds: [actionsEmbed],
    components: tileButtons
      ? [tileButtons, createBackButton()]
      : [createBackButton()],
  });
}

function getEventDescription(event) {
  switch (event.eventType) {
    case "npc":
      return `You see ${event.eventData.name} here.`;
    case "treasure":
      return "You notice something glinting in the distance.";
    case "portal":
      return "A mysterious portal swirls before you.";
    default:
      return "Something interesting is here.";
  }
}

/** @param {Ctx} ctx */
async function useStairs(ctx) {
  return ctx.interaction.followUp({
    content: "Descending into the dungeon…",
    flags: EPHEMERAL,
  });
}

/** @param {Ctx} ctx */
async function openShop(ctx) {
  const { player, map, interaction } = ctx;

  if (!isNearShop(player, map)) {
    return interaction.followUp({
      content: "❌ You are no longer near a shop!",
      flags: EPHEMERAL,
    });
  }

  return interaction.editReply(buildShopReply(player, interaction));
}

function buildShopReply(player, interaction) {
  const inventoryUsed = player.inventory?.length ?? 0;
  const shopEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(
      `${player.username}'s shop | COMING SOON\n\`\`\`            Shop            \`\`\``,
    )
    .setDescription(
      Array(5)
        .fill(
          "<:slot_apple:1415419000745099324> **|** An Apple **|** Price: 10 gold.",
        )
        .join("\n"),
    )
    .addFields(
      { name: "Gold", value: `${player.gold}`, inline: true },
      {
        name: "Bag slots",
        value: `${inventoryUsed}/${player.bagSlots}`,
        inline: true,
      },
    )
    .setFooter({ text: ">Details of the item \nPlaceholder\nPlaceholder" });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("map_action_shop_leave")
      .setEmoji("<:enter_shop:1414281517592477836>")
      .setStyle(ButtonStyle.Danger),
    createActionButtonDisabled(
      "map_action_shop_sell",
      "Sell",
      ButtonStyle.Secondary,
    ),
    createActionButtonDisabled(
      "map_action_shop_ok",
      "OK",
      ButtonStyle.Secondary,
    ),
    createActionButtonDisabled(
      "map_action_shop_buy",
      "Buy",
      ButtonStyle.Secondary,
    ),
    createPlaceholderButton("map_placeholder_1"),
  );

  const row2 = new ActionRowBuilder().addComponents(
    ...Array.from({ length: 5 }, (_, i) =>
      createPlaceholderButton(`map_placeholder_${i + 2}`),
    ),
  );

  const row3 = new ActionRowBuilder().addComponents(
    ...Array.from({ length: 4 }, (_, i) =>
      createPlaceholderButton(`map_placeholder_${i + 7}`),
    ),
    createQuitButton(),
  );

  const row4 = new ActionRowBuilder().addComponents(
    createRequestedByButton(interaction.user.username),
  );

  return {
    embeds: [shopEmbed],
    components: [row1, row2, row3, row4],
  };
}

// =====================================================================
// Bag
// =====================================================================

/**
 * Display-only snapshot of the bag with items resolved from the cache
 * (so opening / browsing the bag needs no populate queries).
 */
function buildBagView(player, items) {
  return {
    username: player.username,
    gold: player.gold,
    bagSlots: player.bagSlots,
    inventory: player.inventory.map((slot) => ({
      // Prefer the cached item: same data, already in memory, and it works
      // whether or not this slot has been populated.
      item: items.get(idOf(slot.item)) ?? (slot.item?.name ? slot.item : null),
      quantity: slot.quantity,
    })),
  };
}

/** @param {Ctx} ctx */
async function showBag(ctx, selected = null) {
  const view = buildBagView(ctx.player, await getItemMap());

  return ctx.interaction.editReply({
    embeds: [generateBagDisplay(view, selected)],
    components: createBagButtons(view, selected),
  });
}

/** @param {Ctx} ctx */
async function openBag(ctx) {
  clearBagSelection(ctx.userId);
  return showBag(ctx, null);
}

/** @param {Ctx} ctx */
async function selectBagSlot(ctx) {
  const index = Number(ctx.interaction.customId.slice("map_bag_slot_".length));

  if (ctx.player.inventory[index]) setBagSelection(ctx.userId, index);
  else clearBagSelection(ctx.userId);

  return showBag(ctx, getBagSelection(ctx.userId));
}

const useSelected = (player, index) => player.useItem(index);
const trashSelected = (player, index) => player.discardItem(index, 1);

/**
 * The bag's "Select" button: puts the highlighted gear on. Consumables
 * cannot be equipped, so they stay on the "Use" button.
 * @param {any} player Populated profile.
 * @param {number} index
 * @returns {Promise<string>}
 */
async function equipSelected(player, index) {
  const item = player.inventory[index]?.item;
  if (!item) throw new Error("That bag slot is empty.");

  if (!["weapon", "armor", "accessory"].includes(item.type)) {
    throw new Error(`${item.name} can't be equipped — press Use instead.`);
  }

  await player.equipItem(item._id);
  return `You equipped ${item.name}.`;
}

/** The item preview button: re-renders the bag without changing anything. */
function showSelectedBagSlot(ctx) {
  return showBag(ctx, getBagSelection(ctx.userId));
}

/**
 * Shared flow for Use/Equip and Trash. These call model methods that need
 * populated items, so the profile is populated here — only on these
 * clicks, not on every press.
 * @param {Ctx} ctx
 */
async function runBagAction(ctx, icon, action) {
  const { interaction, player, userId } = ctx;
  const index = getBagSelection(userId);

  if (index === null || !player.inventory[index]) {
    clearBagSelection(userId);
    return showBag(ctx, null);
  }

  try {
    await player.populate(ITEM_ACTION_POPULATE);
    const message = await action(player, index);
    clearBagSelection(userId);

    await Promise.all([
      showBag(ctx, null),
      interaction.followUp({ content: `${icon} ${message}`, flags: EPHEMERAL }),
    ]);
  } catch (error) {
    await interaction.followUp({
      content: `❌ Error: ${error.message}`,
      flags: EPHEMERAL,
    });
  }
}

// =====================================================================
// Quit
// =====================================================================

/**
 * Closes the screen the way the handheld "Quit" button does: the message
 * keeps the final panel, but every control disappears.
 * @param {Ctx} ctx
 */
async function quitGame(ctx) {
  clearBagSelection(ctx.userId);

  return ctx.interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.panel)
        .setTitle("Game saved")
        .setDescription(
          `👋 See you soon, **${ctx.player.username}**!\n> Your progress is saved — use \`/map\` to jump back in at any time.`,
        ),
    ],
    components: [],
  });
}

// =====================================================================
// Error / session messages
// =====================================================================

async function sendMapError(interaction, message) {
  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(`❌ Map Error: ${message}`),
    ],
    components: [],
  });
}

async function sendSessionExpired(interaction) {
  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(
          "❌ Your map session expired. Use `/map` again to reinitiate it. If you think this is an error, please report the problem to the developers.",
        ),
    ],
    components: [],
  });
}

// =====================================================================
// Periodic cleanup
// =====================================================================

setInterval(() => {
  const now = Date.now();

  combatManager.cleanupOldCombats();

  for (const [userId, entry] of combatMessagesMap) {
    if (now - entry.lastTouched > COMBAT_MESSAGE_TTL) {
      combatMessagesMap.delete(userId);
    }
  }

  for (const [userId, entry] of bagSelectionMap) {
    if (now - entry.touched > BAG_SELECTION_TTL) bagSelectionMap.delete(userId);
  }

  for (const [userId, entry] of talentSelectionMap) {
    if (now - entry.touched > BAG_SELECTION_TTL) talentSelectionMap.delete(userId);
  }
}, 300000).unref();
