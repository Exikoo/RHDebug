/**
 * Button handling for the demo panel.
 *
 * `applyButton` is pure so the tests can drive the whole game without a
 * Discord client; `handleInteraction` is the thin adapter that one actually
 * uses.
 */
import { renderPanel } from "./view.js";
import { gameFor } from "./store.js";
import { move, undo } from "./world.js";

const MOVE_PREFIX = "demo_move_";
const NOOP_PREFIX = "demo_none_";

/**
 * @param {object} game
 * @param {string} customId
 * @returns {{moved: boolean, blocked: boolean}}
 */
export function applyButton(game, customId) {
  if (customId.startsWith(MOVE_PREFIX)) {
    return move(game, customId.slice(MOVE_PREFIX.length));
  }
  if (customId === "demo_undo") {
    return undo(game);
  }
  if (customId.startsWith(NOOP_PREFIX) || customId === "demo_tag") {
    // Blank cells and the name plate: nothing to do, just redraw.
    return { moved: false, blocked: false };
  }
  return { moved: false, blocked: false };
}

/** Discord renders the emoji ids; keep them when the guild has them. */
function glyphsFor(client) {
  const grass = client?.emojis?.cache?.has?.("1411386955026923550");
  const sprite = client?.emojis?.cache?.has?.("1414284867813773372");
  return {
    grass: grass === false ? "🟩" : undefined,
    sprite: sprite === false ? "🧍" : undefined,
  };
}

/**
 * @param {import("discord.js").ButtonInteraction} interaction
 */
export async function handleInteraction(interaction) {
  const game = gameFor({
    userId: interaction.user.id,
    name: interaction.user.tag ?? interaction.user.username,
  });

  applyButton(game, interaction.customId);

  return interaction.update(renderPanel(game, glyphsFor(interaction.client)));
}

/**
 * Opens (or re-opens) the panel — used by both `/demo` and `!demo`.
 * @param {import("discord.js").Interaction|import("discord.js").Message} source
 * @param {{reply: Function}} target
 */
export async function openPanel(source, target) {
  const user = source.user ?? source.author;
  const game = gameFor({
    userId: user.id,
    name: user.tag ?? user.username,
  });

  return target.reply(renderPanel(game, glyphsFor(source.client)));
}
