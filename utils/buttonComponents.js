import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  monsterManager,
  MONSTER_TEMPLATES,
  monsterKey,
} from "../monsterManager.js";
import { isEnterable, orthogonalNeighbours } from "./mapUtils.js";
import { getItemEmoji, EMPTY_SLOT_EMOJI } from "./itemDisplay.js";
import { customEmoji } from "../config/emojiIds.js";

import { ATTRIBUTE_EFFECTS, ATTRIBUTE_KEYS, TALENT_ORDER, TALENT_BY_ID } from "../config/talents.js";
import { nodeEmoji, talentState } from "./talents.js";

/** The uploaded bag tile (map, bag and character buttons). */
export const BAG_EMOJI = "<:bag:1415345981200928940>";


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

const NO_DEAD_MONSTERS = new Set();

/**
 * @param {Object} player
 * @param {Object} currentMap
 * @param {Object} interaction
 * @param {Set<string>|null} [deadKeys] - "x,y" keys of dead monsters on this
 *   map (see monsterManager.getDeadPositions). Pass it when you already have
 *   it; otherwise it is fetched here — in a single query, and only if a
 *   neighbouring tile actually holds a monster.
 * @returns {Promise<ActionRowBuilder[]>}
 */
export async function createNavigationButtons(
  player,
  currentMap,
  interaction,
  deadKeys = null,
) {
  const { x, y } = player.location;
  const mapData = currentMap.mapData;

  const up = { x, y: y - 1 };
  const down = { x, y: y + 1 };
  const left = { x: x - 1, y };
  const right = { x: x + 1, y };
  const neighbours = [up, down, left, right];

  const isMonsterAt = (pos) =>
    Boolean(MONSTER_TEMPLATES[mapData[pos.y]?.[pos.x]]);

  let dead = deadKeys;
  if (!dead) {
    dead = neighbours.some(isMonsterAt)
      ? await monsterManager.getDeadPositions(currentMap.mapId)
      : NO_DEAD_MONSTERS;
  }

  const hasLiveMonster = (pos) =>
    isMonsterAt(pos) && !dead.has(monsterKey(pos.x, pos.y));

  const hasMonsterUp = hasLiveMonster(up);
  const hasMonsterDown = hasLiveMonster(down);
  const hasMonsterLeft = hasLiveMonster(left);
  const hasMonsterRight = hasLiveMonster(right);

  const blockedUp = !isEnterable(mapData, x, y - 1);
  const blockedDown = !isEnterable(mapData, x, y + 1);
  const blockedLeft = !isEnterable(mapData, x - 1, y);
  const blockedRight = !isEnterable(mapData, x + 1, y);

  const row1 = new ActionRowBuilder();

  // Row 1 is the town row: shop (when you are standing on one) and the four
  // feature screens.
  if (isNearShop(player, currentMap)) {
    row1.addComponents(
      createActionButtonEmoji(
        "map_action_shop",
        ButtonStyle.Success,
        "<:enter_shop:1414281517592477836>",
      ),
    );
  } else {
    row1.addComponents(createPlaceholderButton("map_placeholder_1"));
  }

  row1.addComponents(
    createActionButtonEmoji("map_show_professions", ButtonStyle.Secondary, ICON_PROFESSIONS()),
    createActionButtonEmoji("map_show_quests", ButtonStyle.Secondary, ICON_QUESTS()),
    createActionButtonEmoji("map_show_market", ButtonStyle.Secondary, ICON_MARKET()),
    createActionButtonEmoji("map_show_achievements", ButtonStyle.Secondary, ICON_ACHIEVEMENTS()),
  );

  const row2 = new ActionRowBuilder().addComponents(
    createActionButtonEmoji(
      "map_show_character",
      ButtonStyle.Secondary,
      "<:bookstats:1415349972043563125>",
    ),
    createActionButtonEmoji(
      "map_show_talents",
      ButtonStyle.Secondary,
      customEmoji("tab_talents", "⭐"),
    ),
    createDirectionButton("map_move_up", "⬆️", hasMonsterUp, blockedUp),
    createActionButtonEmoji("map_show_rankings", ButtonStyle.Secondary, ICON_RANKS()),
    // Stairs / tile actions. The shop gets its own button in row 1.
    createActionButtonEmoji("map_show_actions", ButtonStyle.Secondary, "🪜"),
  );

  const row3 = new ActionRowBuilder().addComponents(
    createActionButtonEmoji(
      "map_show_inventory",
      ButtonStyle.Secondary,
      BAG_EMOJI,
    ),
    createDirectionButton("map_move_left", "⬅️", hasMonsterLeft, blockedLeft),
    createDirectionButton("map_move_down", "⬇️", hasMonsterDown, blockedDown),
    createDirectionButton("map_move_right", "➡️", hasMonsterRight, blockedRight),
    createQuitButton(),
  );

  const row4 = new ActionRowBuilder().addComponents(
    createRequestedByButton(interaction.user.username),
  );

  return [row1, row2, row3, row4];
}

/**
 * The "back to map" button on its own, so it can be dropped into a row
 * alongside other buttons (see createBagButtons) instead of always
 * taking up a full row by itself.
 * @returns {ButtonBuilder}
 */
export function createBackButtonComponent() {
  return new ButtonBuilder()
    .setCustomId("map_back_to_map")
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Danger);
}

/**
 * @returns {ActionRowBuilder}
 */
export function createBackButton() {
  return new ActionRowBuilder().addComponents(createBackButtonComponent());
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

/**
 * One arm of the D-pad. Red when a monster is next to it (so you know what
 * you are walking into), primary blue when the tile is free, greyed out when
 * the way is blocked.
 */
function createDirectionButton(customId, emoji, hasMonster, isBlocked) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setEmoji(emoji)
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
/**
 * Closes the game screen. Unlike the placeholders this one actually works:
 * it ends the session and removes the buttons, like quitting a handheld.
 */
export function createQuitButton() {
  return new ButtonBuilder()
    .setCustomId("map_quit")
    .setLabel("Quit")
    .setStyle(ButtonStyle.Danger);
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

/**
 * The bag button grid, matching the reference screen:
 *
 *   row 1  Start | Trash | [selected item] | Use | Select
 *   row 2  slot 1 | slot 2 | slot 3 | slot 4 | back
 *   row 3  slot 5 | slot 6 | slot 7 | slot 8 | Quit
 *
 * Every cell holds exactly one emoji (framed item art, or the empty-slot
 * frame), so filled and empty buttons read as the same size. Slots past the
 * eighth are not reachable from here — the default bag has 8 slots, so this
 * only matters if bagSlots is raised (pagination would be the next step).
 *
 * @param {Object} playerProfile
 * @param {number|null} selectedIndex
 * @returns {ActionRowBuilder[]}
 */
export function createBagButtons(playerProfile, selectedIndex = null) {
  const slots = playerProfile.inventory || [];
  const bagSlots = Math.min(playerProfile.bagSlots || slots.length, 8);

  const selectedSlot = selectedIndex !== null ? slots[selectedIndex] : null;
  const selectedItem = selectedSlot?.item ?? null;

  const canEquip = Boolean(
    selectedItem &&
      ["weapon", "armor", "accessory"].includes(selectedItem.type),
  );

  const row1 = new ActionRowBuilder().addComponents(
    // "Start" opens the menu (character sheet), like the console button.
    new ButtonBuilder()
      .setCustomId("map_show_stats")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("map_bag_trash")
      .setLabel("Trash")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!selectedItem),
    // Preview of the highlighted item — pressing it just refreshes the bag.
    new ButtonBuilder()
      .setCustomId("map_bag_preview")
      .setEmoji(selectedItem ? getItemEmoji(selectedItem) : EMPTY_SLOT_EMOJI)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("map_bag_use")
      .setLabel("Use")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!selectedItem),
    // "Select" equips the item (gear only); consumables go through Use.
    new ButtonBuilder()
      .setCustomId("map_bag_select")
      .setLabel("Select")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canEquip),
  );

  const slotButtons = [];
  for (let i = 0; i < bagSlots; i++) {
    const slot = slots[i];
    slotButtons.push(
      new ButtonBuilder()
        .setCustomId(`map_bag_slot_${i}`)
        .setEmoji(slot?.item ? getItemEmoji(slot.item) : EMPTY_SLOT_EMOJI)
        .setStyle(
          i === selectedIndex ? ButtonStyle.Primary : ButtonStyle.Secondary,
        )
        .setDisabled(!slot?.item),
    );
  }

  const row2 = new ActionRowBuilder().addComponents(...slotButtons.slice(0, 4));
  while (row2.components.length < 4) {
    row2.addComponents(
      createPlaceholderButton(`map_bag_pad_${row2.components.length}`),
    );
  }
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId("map_back_to_map")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder().addComponents(...slotButtons.slice(4, 8));
  while (row3.components.length < 4) {
    row3.addComponents(
      createPlaceholderButton(`map_bag_pad_b_${row3.components.length}`),
    );
  }
  row3.addComponents(createQuitButton());

  return [row1, row2, row3];
}

// =====================================================================
// Tabbed screens (character / talents / bag share this navigation)
// =====================================================================

const TAB_ICONS = {
  map: "<:mini_map_icon:1415348946892623892>",
  character: "<:bookstats:1415349972043563125>",
  talents: customEmoji("tab_talents", "⭐"),
  bag: BAG_EMOJI,
};

const TABS = [
  { key: "map", customId: "map_back_to_map" },
  { key: "character", customId: "map_show_character" },
  { key: "talents", customId: "map_show_talents" },
  { key: "bag", customId: "map_show_inventory" },
];

/**
 * Row 1 of every panel: jump between map / character / talents / bag.
 * The current tab is shown selected and disabled so it reads as "you are here".
 * @param {"map"|"character"|"talents"|"bag"} active
 * @returns {ActionRowBuilder}
 */
export function createTabRow(active) {
  const buttons = TABS.map(({ key, customId }) =>
    new ButtonBuilder()
      .setCustomId(customId)
      .setEmoji(TAB_ICONS[key])
      .setStyle(key === active ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(key === active),
  );

  buttons.push(createQuitButton());
  return new ActionRowBuilder().addComponents(...buttons);
}

/**
 * Character screen controls: the tab row plus "Add an attribute" buttons.
 * @param {Object} playerProfile
 * @returns {ActionRowBuilder[]}
 */
/**
 * Emoji-only button (the panel is made of these).
 * @param {string} customId
 * @param {string} emoji
 * @param {import("discord.js").ButtonStyle} [style]
 * @param {boolean} [disabled]
 */
function emojiButton(customId, emoji, style = ButtonStyle.Secondary, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setEmoji(emoji || "▫️")
    .setStyle(style);
  if (disabled) button.setDisabled(true);
  return button;
}

/** Blank slot emoji, used when a cell has no item. */
const EMPTY_CELL = () => customEmoji("slot_empty", "▫️") ?? "▫️";

/** Tab tiles (book / star / bag / II sheet). */
const TILE_CHARACTER = () => customEmoji("tab_character", "📋") ?? "📋";
const ICON_PROFESSIONS = () => customEmoji("prof_smithing", "🧰") ?? "🧰";
const ICON_QUESTS = () => customEmoji("ui_quests", "📜") ?? "📜";
const ICON_MARKET = () => customEmoji("ui_market", "🏪") ?? "🏪";
const ICON_ACHIEVEMENTS = () => customEmoji("ui_trophy", "🏆") ?? "🏆";
const ICON_RANKS = () => customEmoji("ui_ranks", "🏅") ?? "🏅";
const TILE_TALENTS = () => customEmoji("tab_talents", "⭐") ?? "⭐";

/**
 * Character sheet panel — five rows, exactly the reference layout:
 *
 * ```
 * Start   [weapon] [armor] [accessory]   Select
 * [sheet] [talents]  ·      ·            [bag]
 * [use potion]       ·      ·            Quit
 * Add an attribute:  STR    INT   VIT
 *    ·        ·      ·      [✅]        [❌]
 * ```
 *
 * @param {Object} playerProfile
 * @param {{gear?: string[], bag?: string, use?: string}} [icons]
 * @returns {ActionRowBuilder[]}
 */
export function createCharacterButtons(playerProfile, icons = {}) {
  const points = playerProfile.attributePoints ?? 0;
  const gearIcons = icons.gear ?? [];
  const cell = (i) => gearIcons[i] || EMPTY_CELL();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("map_back_to_map")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success),
    emojiButton("map_gear_weapon", cell(0)),
    emojiButton("map_gear_armor", cell(1)),
    emojiButton("map_gear_accessory", cell(2)),
    new ButtonBuilder()
      .setCustomId("map_show_inventory")
      .setLabel("Select")
      .setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder().addComponents(
    emojiButton("map_show_character", TILE_CHARACTER(), ButtonStyle.Secondary, true),
    emojiButton("map_show_talents", TILE_TALENTS()),
    createPlaceholderButton("map_char_pad_1"),
    createPlaceholderButton("map_char_pad_2"),
    emojiButton("map_char_bag", icons.bag || BAG_EMOJI),
  );

  const row3 = new ActionRowBuilder().addComponents(
    emojiButton("map_use_potion", icons.use || "🦴"),
    createPlaceholderButton("map_char_pad_3"),
    createPlaceholderButton("map_char_pad_4"),
    createPlaceholderButton("map_char_pad_5"),
    new ButtonBuilder()
      .setCustomId("map_quit")
      .setLabel("Quit")
      .setStyle(ButtonStyle.Danger),
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("map_attr_label")
      .setLabel("Add an attribute:")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    ...ATTRIBUTE_KEYS.map((key) =>
      new ButtonBuilder()
        .setCustomId(`map_attr_${key}`)
        .setLabel(ATTRIBUTE_EFFECTS[key].short)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(points < 1),
    ),
  );

  const row5 = new ActionRowBuilder().addComponents(
    createPlaceholderButton("map_char_pad_6"),
    createPlaceholderButton("map_char_pad_7"),
    createPlaceholderButton("map_char_pad_8"),
    emojiButton("map_char_done", customEmoji("ui_check", "✅") ?? "✅"),
    emojiButton("map_char_quit", customEmoji("ui_cross", "❌") ?? "❌"),
  );

  return [row1, row2, row3, row4, row5];
}

/**
 * Talent screen panel — the same chrome as the character sheet, with one
 * button per talent and the green "Learn" on the right.
 *
 * ```
 * Start   [t1] [t2] [t3]   Learn
 * [t4] [t5] [t6] [t7]      [sheet]
 *    ·      ·     ·        Quit
 * ```
 *
 * @param {Object} playerProfile
 * @param {string|null} selectedId
 * @param {{bag?: string}} [icons]
 * @returns {ActionRowBuilder[]}
 */
export function createTalentButtons(playerProfile, selectedId = null, icons = {}) {
  const talentButtons = TALENT_ORDER.map(
    (id) =>
      new ButtonBuilder()
        .setCustomId(`map_talent_${id}`)
        .setLabel(TALENT_BY_ID.get(id)?.short ?? id)
        .setEmoji(
          nodeEmoji(
            id === selectedId
              ? "focus"
              : talentState(playerProfile, TALENT_BY_ID.get(id)),
          ),
        )
        .setStyle(id === selectedId ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const learn = new ButtonBuilder()
    .setCustomId("map_talent_learn")
    .setLabel("Learn")
    .setStyle(ButtonStyle.Success)
    .setDisabled(!selectedId || (playerProfile.talentPoints ?? 0) < 1);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("map_back_to_map")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success),
    ...talentButtons.slice(0, 3),
    learn,
  );

  const row2 = new ActionRowBuilder().addComponents(
    ...talentButtons.slice(3, 7),
    emojiButton("map_show_character", TILE_CHARACTER()),
  );

  const row3 = new ActionRowBuilder().addComponents(
    createPlaceholderButton("map_talent_pad_1"),
    createPlaceholderButton("map_talent_pad_2"),
    createPlaceholderButton("map_talent_pad_3"),
    createPlaceholderButton("map_talent_pad_4"),
    new ButtonBuilder()
      .setCustomId("map_quit")
      .setLabel("Quit")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2, row3];
}

// =====================================================================
// Professions / quests / achievements / rankings / market panels
// =====================================================================

/** Icon-only navigation button back to the map. */
function backTile(emoji) {
  return emojiButton("map_back_to_map", emoji ?? "<:mini_map_icon:1415348946892623892>");
}

/**
 * Professions hub: the four gathering buttons, the three crafting benches,
 * and the way out.
 * @returns {ActionRowBuilder[]}
 */
export function createProfessionButtons() {
  return [
    new ActionRowBuilder().addComponents(
      emojiButton("map_gather_mining", "⛏️"),
      emojiButton("map_gather_woodcutting", "🪓"),
      emojiButton("map_gather_fishing", "🎣"),
      emojiButton("map_gather_herbalism", "🌿"),
      backTile(),
    ),
    new ActionRowBuilder().addComponents(
      emojiButton("map_craft_smithing", "🔨"),
      emojiButton("map_craft_crafting", "🧵"),
      emojiButton("map_craft_cooking", "🍳"),
      emojiButton("map_show_quests", "📜"),
      new ButtonBuilder().setCustomId("map_quit").setLabel("Quit").setStyle(ButtonStyle.Danger),
    ),
  ];
}

/**
 * One button per recipe (max 4) plus navigation.
 * @param {string} professionId
 * @param {Array<{id: string, name: string, affordable: boolean}>} recipes
 */
export function createCraftButtons(professionId, recipes) {
  const recipeButtons = recipes.slice(0, 4).map((recipe) =>
    new ButtonBuilder()
      .setCustomId(`map_recipe_${professionId}_${recipe.id}`)
      .setLabel(recipe.name.slice(0, 18))
      .setEmoji(recipe.affordable ? "✅" : "❌")
      .setStyle(recipe.affordable ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!recipe.affordable),
  );

  while (recipeButtons.length < 4) {
    recipeButtons.push(createPlaceholderButton(`map_recipe_pad_${recipeButtons.length}`));
  }

  return [
    new ActionRowBuilder().addComponents(
      ...recipeButtons,
      emojiButton("map_show_professions", "🧰"),
    ),
    new ActionRowBuilder().addComponents(
      backTile(),
      createPlaceholderButton("map_craft_pad_1"),
      createPlaceholderButton("map_craft_pad_2"),
      createPlaceholderButton("map_craft_pad_3"),
      new ButtonBuilder().setCustomId("map_char_quit").setLabel("Quit").setStyle(ButtonStyle.Danger),
    ),
  ];
}

/**
 * Quest board controls.
 * @param {Array<object>} quests
 * @param {boolean} dailyReady
 */
export function createQuestButtons(quests, dailyReady) {
  const drops = [0, 1, 2].map((index) =>
    quests[index]
      ? new ButtonBuilder()
          .setCustomId(`map_quest_drop_${index}`)
          .setLabel(`Drop ${index + 1}`)
          .setStyle(ButtonStyle.Secondary)
      : new ButtonBuilder()
          .setCustomId(`map_quest_none_${index}`)
          .setLabel("\u200B")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
  );

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("map_quest_new").setLabel("New quest").setStyle(ButtonStyle.Primary).setEmoji("📜"),
      new ButtonBuilder()
        .setCustomId("map_quest_daily")
        .setLabel("Daily")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🌙")
        .setDisabled(!dailyReady),
      ...drops,
    ),
    new ActionRowBuilder().addComponents(
      backTile(),
      createPlaceholderButton("map_quest_pad_1"),
      createPlaceholderButton("map_quest_pad_2"),
      createPlaceholderButton("map_quest_pad_3"),
      new ButtonBuilder().setCustomId("map_char_quit").setLabel("Quit").setStyle(ButtonStyle.Danger),
    ),
  ];
}

/** Achievement category filter row. */
export function createAchievementButtons(filter = "all") {
  const categories = [
    ["all", "All", "🏆"],
    ["level", "Level", "📈"],
    ["combat", "Combat", "⚔️"],
    ["profession", "Jobs", "🧰"],
    ["quest", "Quests", "📜"],
  ];

  return [
    new ActionRowBuilder().addComponents(
      ...categories.map(([key, label, emoji]) =>
        new ButtonBuilder()
          .setCustomId(`map_ach_${key}`)
          .setLabel(label)
          .setEmoji(emoji)
          .setStyle(key === filter ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(key === filter),
      ),
    ),
    new ActionRowBuilder().addComponents(
      backTile(),
      createPlaceholderButton("map_ach_pad_1"),
      createPlaceholderButton("map_ach_pad_2"),
      createPlaceholderButton("map_ach_pad_3"),
      new ButtonBuilder().setCustomId("map_char_quit").setLabel("Quit").setStyle(ButtonStyle.Danger),
    ),
  ];
}

/** Ranking sort row. */
export function createRankingButtons(sort = "level") {
  const sorts = [
    ["level", "Level"],
    ["professions", "Jobs"],
    ["achievements", "Points"],
  ];

  return [
    new ActionRowBuilder().addComponents(
      ...sorts.map(([key, label]) =>
        new ButtonBuilder()
          .setCustomId(`map_rank_${key}`)
          .setLabel(label)
          .setEmoji("🏅")
          .setStyle(key === sort ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(key === sort),
      ),
      backTile(),
      new ButtonBuilder().setCustomId("map_char_quit").setLabel("Quit").setStyle(ButtonStyle.Danger),
    ),
  ];
}

/**
 * Market rows: one buy button per listing plus sell / leave.
 * @param {Array<{id: string, name: string, price: number}>} listings
 */
export function createMarketButtons(listings = []) {
  const buys = [0, 1, 2, 3].map((index) => {
    const listing = listings[index];
    if (!listing) return createPlaceholderButton(`map_market_pad_${index}`);
    return new ButtonBuilder()
      .setCustomId(`map_market_buy_${listing.id}`)
      .setLabel(`${listing.price} 🪙`.slice(0, 18))
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success);
  });

  return [
    new ActionRowBuilder().addComponents(...buys, emojiButton("map_market_sell", "🏷️")),
    new ActionRowBuilder().addComponents(
      backTile(),
      createPlaceholderButton("map_market_nav_1"),
      createPlaceholderButton("map_market_nav_2"),
      createPlaceholderButton("map_market_nav_3"),
      new ButtonBuilder().setCustomId("map_char_quit").setLabel("Quit").setStyle(ButtonStyle.Danger),
    ),
  ];
}
