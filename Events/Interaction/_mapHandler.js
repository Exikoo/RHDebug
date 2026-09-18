import {
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import Profile from "../../models/Profile.js";
import Map from "../../models/Map.js";

import { generateMapRows } from "../../utils/mapRenderer.js";
import combatManager from "../../utils/combatManager.js";
import { monsterManager, MONSTER_TEMPLATES } from "../../monsterManager.js";
import { isEnterable, tileAt } from "../../utils/mapUtils.js";
import { replyError } from "../../utils/errorHandler.js";

import {
  generateInventoryDisplay,
  generateStatsDisplay,
} from "../../utils/menuDisplays.js";

import {
  createNavigationButtons,
  createBackButton,
  createTileActionButtons,
  isNearShop,
  createPlaceholderButton,
  createQuitButton,
  createActionButtonDisabled,
  createRequestedByButton,
} from "../../utils/buttonComponents.js";

import { calculateCombinedStats } from "../../utils/playerUtils.js";
import { LEGEND } from "../../config/mapConfig.js";

const COMBAT_MESSAGE_TTL = 10 * 60 * 1000;
const COMBAT_MESSAGE_MAX = 20;
const COMBAT_MESSAGE_DISPLAY = 4;

/** @type {Map<string, {messages: string[], lastTouched: number}>} */
const combatMessagesMap = new Map();

/**
 * @param {import("discord.js").Interaction} interaction
 * @returns {boolean}
 */
export function match(interaction) {
  return interaction.isButton() && interaction.customId.startsWith("map_");
}

/**
 * @param {import("discord.js").Interaction} interaction
 * @param {import("discord.js").Client} client
 */
export async function execute(interaction, client) {
  try {
    const originalUserId = interaction.message.interaction?.user?.id;
    if (!originalUserId || interaction.user.id !== originalUserId) {
      return interaction.reply({
        content: "❌ Only the original adventurer can use these buttons.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate();

    const player = await Profile.findOne({ userId: interaction.user.id })
      .populate("inventory.item")
      .populate("equipped.weapon")
      .populate("equipped.armor")
      .populate("equipped.accessory");

    if (!player || !player.currentMapId) return sendSessionExpired(interaction);

    const currentMap = await Map.findOne({ mapId: player.currentMapId });
    if (!currentMap) {
      return sendMapError(interaction, `Map ${player.currentMapId} not found`);
    }

    const combinedStats = calculateCombinedStats(player);
    const id = interaction.customId;
    const mapData = currentMap.mapData;
    const { x, y } = player.location;

    // === MOVEMENT ===
    if (id.startsWith("map_move_")) {
      const next = { x, y };
      if (id === "map_move_up") next.y--;
      if (id === "map_move_down") next.y++;
      if (id === "map_move_left") next.x--;
      if (id === "map_move_right") next.x++;

      const tile = tileAt(mapData, next.x, next.y);
      if (tile !== null) {
        if (MONSTER_TEMPLATES[tile]) {
          const dead = await monsterManager.isMonsterDead(
            player.currentMapId,
            next.x,
            next.y,
          );

          if (dead) {
            player.location = next;
            player.currentTarget = null;
            player.targetProgress = "0/0";
            player.targetPosition = null;
            await player.save();
          } else {
            await handleCombat(player, currentMap, next, tile, interaction);
            return;
          }
        } else if (isEnterable(mapData, next.x, next.y)) {
          const oldPosition = { ...player.location };
          player.location = next;

          if (player.currentTarget && player.targetPosition) {
            const oldDistance = calculateDistance(
              oldPosition,
              player.targetPosition,
            );
            const newDistance = calculateDistance(
              player.location,
              player.targetPosition,
            );

            if (newDistance > oldDistance && newDistance > 1) {
              player.currentTarget = null;
              player.targetProgress = "0/0";
              player.targetPosition = null;
              combatManager.endCombat(player.userId);
            }
          }

          await player.save();
          await checkForMapEvents(player, currentMap, next, interaction);
        }
      }
    }

    // === REFRESH MAP ===
    if (id.startsWith("map_move_") || id === "map_back_to_map") {
      const refreshedMap = await Map.findOne({ mapId: player.currentMapId });
      return interaction.editReply({
        embeds: [await createMainMapEmbed(player, combinedStats, refreshedMap)],
        components: await createNavigationButtons(
          player,
          refreshedMap,
          interaction,
        ),
      });
    }

    // === INVENTORY ===
    if (id === "map_show_inventory") {
      return interaction.editReply({
        embeds: [generateInventoryDisplay(player)],
        components: [createBackButton()],
      });
    }

    // === STATS ===
    if (id === "map_show_stats") {
      player.totalStats = combinedStats;
      return interaction.editReply({
        embeds: [generateStatsDisplay(player)],
        components: [createBackButton()],
      });
    }

    // === ACTIONS MENU ===
    if (id === "map_show_actions") {
      const tile = mapData[y][x];
      let desc = "*No special actions here.*";

      if (LEGEND[tile]?.event === "stairs")
        desc = "You see stairs leading down.";
      const mapEvent = currentMap.events?.find(
        (e) => e.position.x === x && e.position.y === y,
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

    // === STAIRS ===
    if (id === "map_action_stairs") {
      return interaction.followUp({
        content: "Descending into the dungeon…",
        flags: MessageFlags.Ephemeral,
      });
    }

    // === SHOP ===
    if (id === "map_action_shop") {
      if (!isNearShop(player, currentMap)) {
        return interaction.followUp({
          content: "❌ You are no longer near a shop!",
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.editReply(buildShopReply(player, interaction));
    }

    if (id === "map_action_shop_leave") {
      const refreshedMap = await Map.findOne({ mapId: player.currentMapId });
      return interaction.editReply({
        embeds: [await createMainMapEmbed(player, combinedStats, refreshedMap)],
        components: await createNavigationButtons(
          player,
          refreshedMap,
          interaction,
        ),
      });
    }
  } catch (error) {
    await replyError(interaction, error, {
      logPrefix: "Map interaction error:",
    });
  }
}

// =====================================================================
// Embed / display
// =====================================================================

async function createMainMapEmbed(player, combinedStats, currentMap) {
  const { x, y } = player.location;

  const displayMapData = await getDisplayMapData(currentMap);
  const rows = generateMapRows(displayMapData, player.location);

  const inventoryUsed = player.inventory?.length ?? 0;
  const currentHealth = player.currentHealth || combinedStats.health;
  const currentMana = player.currentMana || combinedStats.magic;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(
      `${player.username}'s score: ${
        player.experience || 0
      }\n\`\`\`        The City of RuneHero        \`\`\``,
    )
    .setDescription(rows.join("\n"))
    .addFields(
      {
        name: `Lv. ${player.level} | ${combinedStats.health} / ${combinedStats.health}`,
        value: `HP: ${currentHealth} / ${combinedStats.health}\nMP: ${currentMana} / ${combinedStats.magic}`,
        inline: true,
      },
      {
        name: "Bag slots",
        value: `${inventoryUsed}/${player.bagSlots}`,
        inline: true,
      },
      { name: `Position (${x},${y})`, value: "Path: [nswe]", inline: true },
    );

  if (player.currentTarget) {
    embed.addFields({
      name: `Target: ${player.currentTarget}`,
      value: player.targetProgress,
    });
  }

  const recent = getRecentCombatMessages(player.userId);
  if (recent.length > 0) {
    embed.addFields({
      name: "📜 Activity",
      value: recent
        .map((m) => `> ${m}`)
        .join("\n")
        .slice(0, 1024),
    });
  }

  return embed;
}

async function getDisplayMapData(currentMap) {
  const displayMapData = JSON.parse(JSON.stringify(currentMap.mapData));

  for (let y = 0; y < displayMapData.length; y++) {
    for (let x = 0; x < displayMapData[y].length; x++) {
      const tile = displayMapData[y][x];

      if (MONSTER_TEMPLATES[tile]) {
        const dead = await monsterManager.isMonsterDead(currentMap.mapId, x, y);
        if (dead) displayMapData[y][x] = "PUDDLE";
      }
    }
  }

  return displayMapData;
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

  return { embeds: [shopEmbed], components: [row1, row2, row3, row4] };
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

function cleanupOldCombatMessages() {
  const now = Date.now();
  for (const [userId, entry] of combatMessagesMap.entries()) {
    if (now - entry.lastTouched > COMBAT_MESSAGE_TTL) {
      combatMessagesMap.delete(userId);
    }
  }
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
        .setDescription("❌ Your map session expired. Use `/map` again."),
    ],
    components: [],
  });
}

// =====================================================================
// Map transitions
// =====================================================================

async function checkForMapEvents(player, currentMap, position, interaction) {
  const connection = currentMap.connections?.find(
    (conn) =>
      conn.fromPosition.x === position.x && conn.fromPosition.y === position.y,
  );

  if (connection) await handleMapTransition(player, connection, interaction);
}

async function handleMapTransition(player, connection, interaction) {
  try {
    await player.changeMap(
      connection.targetMapId,
      connection.targetPosition || null,
    );
    await interaction.followUp({
      content: "🚪 You have entered a new area...",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Map transition error:", error);
    await interaction.followUp({
      content: "❌ Could not transition to the new area.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

// =====================================================================
// Combat
// =====================================================================

async function handleCombat(
  player,
  currentMap,
  position,
  monsterType,
  interaction,
) {
  try {
    const combinedStats = calculateCombinedStats(player);

    const monster = await monsterManager.getOrCreateMonster(
      player.currentMapId,
      position.x,
      position.y,
      monsterType,
    );

    const playerDamage = Math.max(1, combinedStats.attack - monster.defense);
    const monsterDamage = Math.max(1, monster.attack - combinedStats.defense);

    const updatedMonster = await monsterManager.damageMonster(
      player.currentMapId,
      position.x,
      position.y,
      playerDamage,
    );

    addCombatMessage(
      player.userId,
      `You hit ${monster.name} for ${playerDamage} HP!`,
    );

    player.currentHealth = Math.max(0, player.currentHealth - monsterDamage);
    player.currentTarget = monster.name;
    player.targetProgress = `${updatedMonster.currentHealth}/${updatedMonster.maxHealth}`;
    player.targetPosition = position;

    if (updatedMonster.isDead) {
      player.experience += monster.experience;
      player.gold += Math.floor(monster.experience / 2);
      player.currentTarget = null;
      player.targetProgress = "0/0";
      player.targetPosition = null;
      addCombatMessage(player.userId, `You defeated ${monster.name}!`);
    } else {
      addCombatMessage(
        player.userId,
        `${monster.name} hit you for ${monsterDamage} HP!`,
      );
    }

    await player.save();

    const refreshedMap = await Map.findOne({ mapId: player.currentMapId });
    const refreshedStats = calculateCombinedStats(player);

    await interaction.editReply({
      embeds: [await createMainMapEmbed(player, refreshedStats, refreshedMap)],
      components: await createNavigationButtons(
        player,
        refreshedMap,
        interaction,
      ),
    });
  } catch (error) {
    console.error("Combat error:", error);
    await interaction.followUp({
      content: "❌ Something went wrong with the combat.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

function calculateDistance(pos1, pos2) {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

// =====================================================================
// Periodic cleanup
// =====================================================================

setInterval(() => {
  combatManager.cleanupOldCombats();
  cleanupOldCombatMessages();
}, 300000);
