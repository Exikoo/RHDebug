import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { monsterManager, MONSTER_TEMPLATES } from "../monsterManager.js";
import { isEnterable, orthogonalNeighbours } from "./mapUtils.js";

/**
 * @param {Object} player
 * @param {Object} currentMap
 * @returns {boolean}
 */
export function isNearShop(player, currentMap) {
  const { x, y } = player.location;
  const mapData = currentMap.mapData;

  for (const pos of orthogonalNeighbours(x, y)) {
    if (mapData[pos.y]?.[pos.x] === "SHP") {
      return true;
    }
  }

  return false;
}

/**
 * @param {Object} player
 * @param {Object} currentMap
 * @param {Object} interaction
 * @returns {Promise<ActionRowBuilder[]>}
 */
export async function createNavigationButtons(player, currentMap, interaction) {
  const { x, y } = player.location;
  const mapData = currentMap.mapData;

  const hasMonsterUp = await checkTileForMonster(
    currentMap.mapId,
    mapData,
    x,
    y - 1,
  );
  const hasMonsterDown = await checkTileForMonster(
    currentMap.mapId,
    mapData,
    x,
    y + 1,
  );
  const hasMonsterLeft = await checkTileForMonster(
    currentMap.mapId,
    mapData,
    x - 1,
    y,
  );
  const hasMonsterRight = await checkTileForMonster(
    currentMap.mapId,
    mapData,
    x + 1,
    y,
  );

  const blockedUp = !isEnterable(mapData, x, y - 1);
  const blockedDown = !isEnterable(mapData, x, y + 1);
  const blockedLeft = !isEnterable(mapData, x - 1, y);
  const blockedRight = !isEnterable(mapData, x + 1, y);

  const row1 = new ActionRowBuilder();

  if (isNearShop(player, currentMap)) {
    row1.addComponents(
      createActionButtonEmoji(
        "map_action_shop",
        ButtonStyle.Success,
        "<:enter_shop:1414281517592477836>",
      ),
      createPlaceholderButton("map_placeholder_2"),
      createPlaceholderButton("map_placeholder_3"),
      createPlaceholderButton("map_placeholder_4"),
      createPlaceholderButton("map_placeholder_5"),
    );
  } else {
    row1.addComponents(
      createPlaceholderButton("map_placeholder_1"),
      createPlaceholderButton("map_placeholder_2"),
      createPlaceholderButton("map_placeholder_3"),
      createPlaceholderButton("map_placeholder_4"),
      createPlaceholderButton("map_placeholder_5"),
    );
  }

  const row2 = new ActionRowBuilder().addComponents(
    createActionButtonEmoji(
      "map_show_stats",
      ButtonStyle.Secondary,
      "<:bookstats:1415349972043563125>",
    ),
    createPlaceholderButton("map_placeholder_6"),
    createDirectionButton("map_move_up", "1", hasMonsterUp, blockedUp),
    createPlaceholderButton("map_placeholder_7"),
    createActionButtonEmoji(
      "map_show_actions",
      ButtonStyle.Secondary,
      "<:bag:1415345981200928940>",
    ),
  );

  const row3 = new ActionRowBuilder().addComponents(
    createActionButtonEmoji(
      "map_show_inventory",
      ButtonStyle.Secondary,
      "<:mini_map_icon:1415348946892623892>",
    ),
    createDirectionButton("map_move_left", "3", hasMonsterLeft, blockedLeft),
    createDirectionButton("map_move_down", "2", hasMonsterDown, blockedDown),
    createDirectionButton("map_move_right", "4", hasMonsterRight, blockedRight),
    createQuitButton(),
  );

  const row4 = new ActionRowBuilder().addComponents(
    createRequestedByButton(interaction.user.username),
  );

  return [row1, row2, row3, row4];
}

async function checkTileForMonster(mapId, mapData, x, y) {
  const tile = mapData[y]?.[x];
  if (!MONSTER_TEMPLATES[tile]) return false;
  const isDead = await monsterManager.isMonsterDead(mapId, x, y);
  return !isDead;
}

/**
 * @returns {ActionRowBuilder}
 */
export function createBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("map_back_to_map")
      .setLabel("⬅️ Back to Map")
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * @param {string} customId
 * @param {string} label
 * @param {ButtonStyle} style
 * @returns {ButtonBuilder}
 */
export function createActionButton(customId, label, style) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style);
}

/**
 * @param {string} customId
 * @param {string} label
 * @param {ButtonStyle} style
 * @returns {ButtonBuilder}
 */
export function createActionButtonDisabled(customId, label, style) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(true);
}

function createActionButtonEmoji(customId, style, emoji) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setStyle(style)
    .setEmoji(emoji);
}

/**
 * @param {string} tile
 * @returns {ActionRowBuilder|null}
 */
export function createTileActionButtons(tile) {
  if (tile === "S") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("map_action_stairs")
        .setLabel("Use Stairs ▼")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⬇️"),
    );
  }

  if (tile === "WD") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("map_action_door")
        .setLabel("Enter Door")
        .setStyle(ButtonStyle.Primary),
    );
  }

  return null;
}

function createDirectionButton(customId, label, hasMonster, isBlocked) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(hasMonster ? ButtonStyle.Danger : ButtonStyle.Primary);

  if (isBlocked) button.setDisabled(true);

  return button;
}

/**
 * @param {string} customId
 * @returns {ButtonBuilder}
 */
export function createPlaceholderButton(customId) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel("\u200B")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
}

/**
 * @returns {ButtonBuilder}
 */
export function createQuitButton() {
  return new ButtonBuilder()
    .setCustomId("quit")
    .setLabel("Quit")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(true);
}

/**
 * @param {string} username
 * @returns {ButtonBuilder}
 */
export function createRequestedByButton(username) {
  return new ButtonBuilder()
    .setCustomId("requestedby")
    .setLabel(`Requested by ${username}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
}
