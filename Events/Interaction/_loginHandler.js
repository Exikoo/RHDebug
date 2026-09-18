import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import Profile from "../../models/Profile.js";
import ItemManager from "../../utils/itemManager.js";
import classes from "../../config/classes.js";
import GAME_CONFIG from "../../utils/gameConfig.js";
import { replyError } from "../../utils/errorHandler.js";

const VALID_BUTTON_PREFIXES = ["class_", "race_"];
const VALID_BUTTON_IDS = new Set([
  "gender_select",
  "difficulty_button",
  "quit_button",
  "login_button",
]);

const FIELD_DEFAULTS = {
  "Difficulty selected": "Normal",
  "Class selected": "Warrior",
  Race: "Human",
  Gender: "Male",
};

const CLASS_MAP = new Map(
  Object.entries(GAME_CONFIG.classes).map(([k, v]) => [k, v.name]),
);
const RACE_MAP = new Map(
  Object.entries(GAME_CONFIG.races).map(([k, v]) => [k, v.name]),
);

const QUIT_RESPONSE = {
  content: "👋 Thanks for checking out RuneHero!",
  embeds: [],
  components: [],
};

const ERROR_RESPONSE = {
  content: "❌ Failed to create your character. Please try again.",
  embeds: [],
  components: [],
};

/**
 * Determines whether this handler should process the interaction.
 * @param {import("discord.js").Interaction} interaction
 * @returns {boolean}
 */
export function match(interaction) {
  if (!interaction.isButton()) return false;
  const { customId } = interaction;
  return (
    VALID_BUTTON_IDS.has(customId) ||
    VALID_BUTTON_PREFIXES.some((prefix) => customId.startsWith(prefix))
  );
}

/**
 * @param {import("discord.js").Interaction} interaction
 */
export async function execute(interaction) {
  const { customId, message } = interaction;

  await interaction.deferUpdate();

  const originalEmbed = message.embeds[0];
  const currentSelections = extractSelections(originalEmbed);

  const handler = getButtonHandler(customId);
  if (handler) {
    const result = await handler(interaction, currentSelections, customId);
    if (result) return result;
  }

  const [updatedEmbed, components] = updateEmbed(
    originalEmbed,
    message.components,
    currentSelections,
  );

  return interaction.editReply({ embeds: [updatedEmbed], components });
}

function extractSelections(embed) {
  const selections = { ...FIELD_DEFAULTS };

  for (const field of embed.fields || []) {
    if (Object.prototype.hasOwnProperty.call(selections, field.name)) {
      selections[field.name] = field.value;
    }
  }

  return selections;
}

function getButtonHandler(customId) {
  if (customId.startsWith("class_")) return handleClass;
  if (customId.startsWith("race_")) return handleRace;
  if (customId === "gender_select") return handleGender;
  if (customId === "difficulty_button") return handleDifficulty;
  if (customId === "quit_button") return handleQuit;
  if (customId === "login_button") return handleLogin;
  return null;
}

function handleClass(interaction, selections, customId) {
  const className = CLASS_MAP.get(customId.slice(6));
  if (className) selections["Class selected"] = className;
}

function handleRace(interaction, selections, customId) {
  const raceName = RACE_MAP.get(customId.slice(5));
  if (raceName) selections["Race"] = raceName;
}

function handleGender(interaction, selections) {
  selections["Gender"] = selections["Gender"] === "Male" ? "Female" : "Male";
}

function handleDifficulty(interaction, selections) {
  selections["Difficulty selected"] =
    selections["Difficulty selected"] === "Normal" ? "Permadeath" : "Normal";
}

function handleQuit(interaction) {
  return interaction.editReply(QUIT_RESPONSE);
}

async function handleLogin(interaction, selections) {
  try {
    await createProfile(interaction, selections);
    return interaction.editReply({
      content: `🎮 Welcome to RuneHero, ${interaction.user.globalName}! Your ${selections["Class selected"]} character has been created!`,
      embeds: [],
      components: [],
    });
  } catch (err) {
    await replyError(interaction, err, {
      logPrefix: "Profile creation error:",
    });
    return interaction.editReply(ERROR_RESPONSE);
  }
}

function updateEmbed(originalEmbed, originalComponents, selections) {
  const embed = EmbedBuilder.from(originalEmbed);
  const newFields = [];

  for (const field of originalEmbed.fields || []) {
    const newValue = selections[field.name];
    newFields.push({
      name: field.name,
      value: newValue !== undefined ? newValue : field.value,
      inline: true,
    });
  }

  embed.setFields(newFields);

  const components = originalComponents.map((row) => {
    const newRow = new ActionRowBuilder();

    for (const comp of row.components) {
      if (comp.type !== 2) continue;

      const btn = ButtonBuilder.from(comp);
      updateButtonState(btn, comp.customId, selections);
      newRow.addComponents(btn);
    }

    return newRow;
  });

  return [embed, components];
}

function updateButtonState(btn, customId, selections) {
  if (customId?.startsWith("class_")) {
    const isSelected =
      CLASS_MAP.get(customId.slice(6)) === selections["Class selected"];
    btn.setStyle(isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary);
  } else if (customId?.startsWith("race_")) {
    const isSelected = RACE_MAP.get(customId.slice(5)) === selections["Race"];
    btn.setStyle(isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary);
  } else if (customId === "gender_select") {
    btn.setEmoji(selections["Gender"] === "Male" ? "♂️" : "♀️");
  } else if (customId === "difficulty_button") {
    btn.setEmoji(
      selections["Difficulty selected"] === "Normal"
        ? "<:friendly:1416397814346551436>"
        : "<:nasty:1416397708486250527>",
    );
  }
}

async function createProfile(interaction, selections) {
  const { id: userId, username } = interaction.user;
  const classKey = selections["Class selected"].toLowerCase();
  const classCfg = classes[classKey];

  if (!classCfg) {
    throw new Error(`Invalid class: ${selections["Class selected"]}`);
  }

  const existing = await Profile.exists({ userId });
  if (existing) throw new Error("Profile already exists");

  const starterKit = await ItemManager.getStarterKit(classKey);
  if (!starterKit.weapon || !starterKit.armor) {
    throw new Error("Starter kit incomplete");
  }

  const inventory = [
    { item: starterKit.weapon._id, quantity: 1 },
    { item: starterKit.armor._id, quantity: 1 },
    ...starterKit.items.map(({ item, quantity }) => ({
      item: item._id,
      quantity,
    })),
  ];

  const profileData = {
    userId,
    username,
    class: selections["Class selected"],
    race: selections["Race"],
    gender: selections["Gender"],
    difficulty: selections["Difficulty selected"],
    level: 1,
    experience: 0,
    baseStats: classCfg.baseStats,
    currentHealth: classCfg.baseStats.health,
    currentMana: classCfg.baseStats.magic || 0,
    gold: classCfg.startingGold || 50,
    equipped: {
      weapon: starterKit.weapon._id,
      armor: starterKit.armor._id,
      accessory: null,
    },
    inventory,
    skills: [],
    achievements: [],
    currentTarget: null,
    targetProgress: "0/0",
    lastPlayed: new Date(),
    location: classCfg.startingLocation || { x: 8, y: 5 },
    currentWorldMap: classCfg.startingMap || [],
    portalReturn: { map: null, x: 0, y: 0 },
  };

  const newProfile = new Profile(profileData);
  if (newProfile.initializeStats) newProfile.initializeStats();

  await newProfile.save();
  return newProfile;
}
