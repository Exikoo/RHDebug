/**
 * The two panels and the number pad, exactly as they appear in the demo gif.
 *
 * Panel 1  name, HP bar, Mana bar
 * Panel 2  the field, with `x: 8, y: 7, area:` in the footer
 * Pad      7 . . . / 6 . 1 . / 5 4 2 3 / -1 <tag>
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import { DIRECTIONS, FALLBACK, fieldGlyphs, fieldRows, glyph, VITALS } from "./world.js";

/** Discord's dark panel colour, so the embeds blend with the client. */
const PANEL = 0x2b2d31;

/** Zero-width label: the pad's empty cells are still real buttons. */
const BLANK = "\u200B";

/**
 * Bar glyphs, one emoji per point. Both come from docs/emojis (built by
 * scripts/build-demo-emojis.mjs) and fall back to coloured squares.
 * @param {import("discord.js").Client|null} [client]
 */
export function barGlyphs(client = null) {
  return {
    hp: {
      filled: glyph("bar_hp", FALLBACK.hpFull, client),
      empty: glyph("bar_hp_empty", FALLBACK.hpEmpty, client),
    },
    mana: {
      filled: glyph("bar_mana", FALLBACK.manaFull, client),
      empty: glyph("bar_mana_empty", FALLBACK.manaEmpty, client),
    },
  };
}

/** One square per point, filled then empty. */
export function bar(current, max, glyphs) {
  const filled = Math.max(0, Math.min(max, Math.round(current)));
  const empty = Math.max(0, max - filled);
  return glyphs.filled.repeat(filled) + glyphs.empty.repeat(empty);
}

/** The name + vitals panel. */
export function vitalsEmbed(game, bars = barGlyphs()) {
  return new EmbedBuilder()
    .setColor(PANEL)
    .setDescription(`**${game.name}**`)
    .addFields(
      {
        name: `HP: ${game.hp}/${game.maxHp}`,
        value: bar(game.hp, game.maxHp, bars.hp),
        inline: true,
      },
      {
        name: `Mana: ${game.mana}/${game.maxMana}`,
        value: bar(game.mana, game.maxMana, bars.mana),
        inline: true,
      },
    );
}

/** The field panel; the coordinate line rides in the footer. */
export function fieldEmbed(game, glyphs = fieldGlyphs()) {
  return new EmbedBuilder()
    .setColor(PANEL)
    .setDescription(fieldRows(game, glyphs).join("\n"))
    .setFooter({ text: `x: ${game.x}, y: ${game.y}, area: ${game.area}` });
}

/**
 * @param {string} customId
 * @param {string} label
 * @param {object} [options]
 */
function padButton(customId, label, options = {}) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary);

  if (options.disabled) button.setDisabled(true);
  return button;
}

/**
 * The 4 x 4 pad. Empty cells are blank buttons, exactly like the original:
 * the one above `4` walks north, the rest do nothing.
 * @returns {ActionRowBuilder[]}
 */
export function padRows(game) {
  return [
    new ActionRowBuilder().addComponents(
      padButton("demo_move_7", "7"),
      padButton("demo_move_north", BLANK),
      padButton("demo_none_a", BLANK),
      padButton("demo_none_b", BLANK),
    ),
    new ActionRowBuilder().addComponents(
      padButton("demo_move_6", "6"),
      padButton("demo_none_c", BLANK),
      padButton("demo_move_1", "1"),
      padButton("demo_none_d", BLANK),
    ),
    new ActionRowBuilder().addComponents(
      padButton("demo_move_5", "5"),
      padButton("demo_move_4", "4"),
      padButton("demo_move_2", "2"),
      padButton("demo_move_3", "3"),
    ),
    new ActionRowBuilder().addComponents(
      padButton("demo_undo", "-1"),
      padButton("demo_tag", game.name, { disabled: true }),
    ),
  ];
}

/**
 * Everything needed to draw one frame.
 * @param {object} game
 * @param {{grass?: string, sprite?: string}} [glyphs]
 */
export function renderPanel(game, glyphs = fieldGlyphs(), bars = barGlyphs()) {
  return {
    embeds: [vitalsEmbed(game, bars), fieldEmbed(game, glyphs)],
    components: padRows(game),
  };
}

/** Exported for the tests: every id the pad can send. */
export const PAD_IDS = [
  ...Object.keys(DIRECTIONS).map((key) => `demo_move_${key}`),
  "demo_none_a",
  "demo_none_b",
  "demo_none_c",
  "demo_none_d",
  "demo_undo",
  "demo_tag",
];

/** Vitals are fixed in this demo; exported so a test can assert the default. */
export const STARTING_VITALS = { ...VITALS };
