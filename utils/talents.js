import {
  ATTRIBUTE_EFFECTS,
  ATTRIBUTE_KEYS,
  TALENTS,
  TALENT_BY_CELL,
  TALENT_BY_ID,
  TREE_LAYOUT,
} from "../config/talents.js";
import { customEmoji } from "../config/emojiIds.js";

/**
 * Talent rules live here so the renderer, the combat maths and the button
 * handler all agree on what "available" means.
 *
 * A profile stores `talents` as `id -> rank` (Mongoose Map). Everything else
 * is derived, which keeps respecs (and future talent reworks) free.
 */

/**
 * Reads a rank from a Mongoose Map, a plain object, or undefined.
 * @param {any} player
 * @param {string} id
 * @returns {number}
 */
export function rankOf(player, id) {
  const talents = player?.talents;
  if (!talents) return 0;
  const raw =
    typeof talents.get === "function" ? talents.get(id) : talents[id];
  return Number(raw) || 0;
}

/**
 * Total flat stat bonus from every learned talent.
 * @param {any} player
 * @returns {{health:number, attack:number, defense:number, speed:number, magic:number}}
 */
export function talentBonuses(player) {
  const bonus = { health: 0, attack: 0, defense: 0, speed: 0, magic: 0 };

  for (const talent of TALENTS) {
    const rank = Math.min(rankOf(player, talent.id), talent.maxRank);
    if (rank <= 0) continue;

    for (const [stat, perRank] of Object.entries(talent.effect)) {
      bonus[stat] = (bonus[stat] ?? 0) + perRank * rank;
    }
  }

  return bonus;
}

/**
 * @param {any} player
 * @param {import("../config/talents.js").Talent} talent
 * @returns {boolean}
 */
export function prerequisitesMet(player, talent) {
  return talent.requires.every((id) => rankOf(player, id) >= 1);
}

/**
 * @param {any} player
 * @param {import("../config/talents.js").Talent} talent
 * @returns {"max"|"on"|"available"|"off"}
 */
export function talentState(player, talent) {
  const rank = rankOf(player, talent.id);
  if (rank >= talent.maxRank) return "max";
  if (rank > 0) return "on";
  return prerequisitesMet(player, talent) ? "available" : "off";
}

const STATE_EMOJI = {
  off: ["talent_node_off", "⬛"],
  available: ["talent_node_available", "🟨"],
  on: ["talent_node_on", "🟩"],
  max: ["talent_node_max", "🟦"],
};

/**
 * @param {"max"|"on"|"available"|"off"|"focus"} state
 * @returns {string}
 */
export function nodeEmoji(state) {
  if (state === "focus") return customEmoji("talent_node_focus", "⬜");
  const [name, fallback] = STATE_EMOJI[state] ?? STATE_EMOJI.off;
  return customEmoji(name, fallback);
}

/**
 * Renders the tree as rows of emojis — one emoji per cell, so the grid stays
 * aligned the same way the map does.
 *
 * @param {any} player
 * @param {string|null} selectedId Talent whose description is on screen.
 * @returns {string[]}
 */
export function renderTalentTree(player, selectedId = null) {
  const blank = customEmoji("talent_blank", "\u2800");
  const linkH = customEmoji("talent_link_h", "─");
  const linkV = customEmoji("talent_link_v", "│");

  return TREE_LAYOUT.map((line, row) =>
    [...line]
      .map((cell, col) => {
        if (cell === "-") return linkH;
        if (cell === "|") return linkV;
        if (cell !== "N") return blank;

        const talent = TALENT_BY_CELL.get(`${row},${col}`);
        if (!talent) return blank;
        return nodeEmoji(
          talent.id === selectedId ? "focus" : talentState(player, talent),
        );
      })
      .join(""),
  );
}

/**
 * Why a talent cannot be learned right now (or null when it can).
 * @param {any} player
 * @param {string} id
 * @returns {string|null}
 */
export function talentBlockReason(player, talentOrId) {
  const talent =
    typeof talentOrId === "string" ? TALENT_BY_ID.get(talentOrId) : talentOrId;
  if (!talent) return "Unknown talent.";

  const rank = rankOf(player, talent.id);
  if (rank >= talent.maxRank) return `${talent.name} is already maxed.`;
  if (!prerequisitesMet(player, talent)) {
    const missing = talent.requires
      .filter((req) => rankOf(player, req) < 1)
      .map((req) => TALENT_BY_ID.get(req)?.name ?? req);
    return `Requires ${missing.join(", ")}.`;
  }
  if ((player.talentPoints ?? 0) < 1) return "No talent points left.";
  return null;
}

/**
 * Spends one point on a talent. Mutates the profile; the caller saves.
 * @param {any} player
 * @param {string} id
 * @returns {{ok: boolean, message: string}}
 */
export function learnTalent(player, id) {
  const reason = talentBlockReason(player, id);
  if (reason) return { ok: false, message: `❌ ${reason}` };

  const talent = TALENT_BY_ID.get(id);
  const rank = rankOf(player, id);

  if (!player.talents) player.talents = new Map();
  if (typeof player.talents.set === "function") {
    player.talents.set(id, rank + 1);
  } else {
    player.talents[id] = rank + 1;
  }
  player.talentPoints -= 1;

  return {
    ok: true,
    message: `⭐ ${talent.name} → rank ${rank + 1}/${talent.maxRank}`,
  };
}

/**
 * Spends one attribute point. Attribute points are applied straight to
 * baseStats, so every existing combat formula keeps working unchanged.
 *
 * @param {any} player
 * @param {"str"|"int"|"vit"} key
 * @returns {{ok: boolean, message: string}}
 */
export function spendAttributePoint(player, key) {
  const effect = ATTRIBUTE_EFFECTS[key];
  if (!effect || !ATTRIBUTE_KEYS.includes(key)) {
    return { ok: false, message: "❌ Unknown attribute." };
  }
  if ((player.attributePoints ?? 0) < 1) {
    return { ok: false, message: "❌ No attribute points left." };
  }

  player.attributePoints -= 1;
  player.attributes = {
    str: 0,
    int: 0,
    vit: 0,
    ...(player.attributes ?? {}),
    [key]: (player.attributes?.[key] ?? 0) + 1,
  };

  for (const [stat, gain] of Object.entries(effect)) {
    if (stat === "label" || stat === "short") continue;
    player.baseStats[stat] = (player.baseStats[stat] ?? 0) + gain;
  }

  return {
    ok: true,
    message: `💠 ${effect.label} +1 (${Object.entries(effect)
      .filter(([stat]) => stat !== "label" && stat !== "short")
      .map(([stat, gain]) => `+${gain} ${stat}`)
      .join(", ")})`,
  };
}

/**
 * Total attribute values for the character sheet: class base + points spent.
 * @param {any} player
 * @param {Object} [classAttributes]
 * @returns {{str:number, int:number, vit:number}}
 */
export function totalAttributes(player, classAttributes = {}) {
  const spent = player?.attributes ?? {};
  return {
    str: (classAttributes.str ?? 0) + (spent.str ?? 0),
    int: (classAttributes.int ?? 0) + (spent.int ?? 0),
    vit: (classAttributes.vit ?? 0) + (spent.vit ?? 0),
  };
}
