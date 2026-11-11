import { EmbedBuilder } from "discord.js";

import { customEmoji } from "../config/emojiIds.js";

import { MONSTER_TEMPLATES } from "../monsterManager.js";
import { renderMapView } from "./mapRenderer.js";
import { xpToNextLevel } from "./progression.js";
import {
  activityLog,
  areaBand,
  areaLabel,
  colorForMap,
  formatNumber,
  renderBar,
  scoreOf,
} from "./uiTheme.js";

/**
 * The game screen, built once and reused by `/map`, `/start`'s Play
 * button and every movement press — so all three entry points always show
 * the same layout.
 */

/**
 * Cheap alternative to deep-cloning the whole map on every render: rows
 * are only copied when they contain a dead monster.
 * @param {string[][]} mapData
 * @param {Set<string>} deadKeys
 * @returns {string[][]}
 */
export function applyDeadMonsters(mapData, deadKeys) {
  if (!deadKeys || deadKeys.size === 0) return mapData;

  const display = mapData.slice();
  for (const key of deadKeys) {
    const [x, y] = key.split(",").map(Number);
    if (!MONSTER_TEMPLATES[mapData[y]?.[x]]) continue;

    if (display[y] === mapData[y]) display[y] = mapData[y].slice();
    display[y][x] = "PUDDLE";
  }
  return display;
}

/**
 * @param {Object} options
 * @param {object} options.player         Profile-like object.
 * @param {object} options.stats          Combined stats (base + equipment).
 * @param {object} options.map            Map document (mapId, name, mapData...).
 * @param {Set<string>} [options.deadKeys] "x,y" of dead monsters.
 * @param {string[]} [options.recent]     Recent activity log lines.
 * @returns {EmbedBuilder}
 */
export function buildMapEmbed({
  player,
  stats,
  map,
  deadKeys = new Set(),
  recent = [],
}) {
  const { x, y } = player.location;

  const maxHealth = Math.max(1, stats?.health ?? 1);
  const maxMana = Math.max(0, stats?.magic ?? 0);
  // `??` not `||`: 0 HP is a real state and must not render as "full".
  const currentHealth = Math.min(maxHealth, player.currentHealth ?? maxHealth);
  const currentMana = Math.min(maxMana, player.currentMana ?? maxMana);

  const inventoryUsed = player.inventory?.length ?? 0;
  const nextXp = xpToNextLevel(player.level);
  const area = areaLabel(map, map?.depth);

  const embed = new EmbedBuilder()
    .setColor(colorForMap(map))
    .setTitle(`${player.username}'s score: ${formatNumber(scoreOf(player))}`)
    .setFooter({ text: `${area} • (${x}, ${y})` });

  // The screen: one custom emoji per tile, rows joined by newlines. The
  // renderer picks a camera window that fits Discord's 4096-character
  // description limit, so wide/water-heavy maps cannot break the render.
  const view = renderMapView(applyDeadMonsters(map.mapData, deadKeys), player.location, {
    playerClass: player.class,
  });
  embed.setDescription(`${areaBand(area)}\n${view.rows.join("\n")}`);

  // Three inline fields per line, values in italics — the reference prints
  // `Lv. 1 / HP / MP` across one line and `Bag slots / gold` on the next.
  embed.addFields(
    {
      name: `Lv. ${player.level}`,
      value: `*${player.experience ?? 0} / ${nextXp}*`,
      inline: true,
    },
    { name: "HP", value: `*${currentHealth} / ${maxHealth}*`, inline: true },
    { name: "MP", value: `*${currentMana} / ${maxMana}*`, inline: true },
    {
      name: "Bag slots",
      value: `*${inventoryUsed}/${player.bagSlots ?? 9}*`,
      inline: true,
    },
    {
      name: "Gold",
      value: `*${formatNumber(player.gold)}* ${customEmoji("ui_gold", "🪙")}`,
      inline: true,
    },
  );

  if (player.currentTarget) {
    const [targetHealth, targetMax] = String(player.targetProgress || "0/0")
      .split("/")
      .map(Number);
    embed.addFields({
      name: `⚔️ ${player.currentTarget}`,
      value: `\`${renderBar(targetHealth, targetMax, 12)}\` ${
        player.targetProgress
      } HP`,
    });
  }

  // Always four lines, like the log strip of the original screen, so the
  // panel never changes height between renders.
  embed.addFields({
    name: "\u200b",
    value: activityLog(recent),
  });

  return embed;
}
