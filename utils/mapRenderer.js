import { EMOJI_MAP } from "../config/mapConfig.js";

// Fixed safe respawn point used whenever a player's position ends up
// outside the map bounds (e.g. from a bug elsewhere, or manual DB edits).
const SPAWN_X = 8;
const SPAWN_Y = 5;

export function generateMapRows(worldMap, playerPos) {
  if (!worldMap || !Array.isArray(worldMap) || worldMap.length === 0) {
    console.error("Invalid worldMap data:", worldMap);
    return ["❌ Map data is invalid"];
  }

  if (
    !playerPos ||
    typeof playerPos.x !== "number" ||
    typeof playerPos.y !== "number"
  ) {
    console.error("Invalid player position:", playerPos);
    return ["❌ Player position is invalid"];
  }

  if (playerPos.y >= worldMap.length || playerPos.x >= worldMap[0].length) {
    console.error(
      `Player position (${playerPos.x}, ${playerPos.y}) is outside map bounds (${worldMap[0].length}, ${worldMap.length})`,
    );

    // Reset player to the fixed safe respawn point
    playerPos.x = SPAWN_X;
    playerPos.y = SPAWN_Y;

    console.log(`Reset player position to (${SPAWN_X}, ${SPAWN_Y})`);
  }

  return worldMap.map((row, y) => {
    return row
      .map((tile, x) => {
        if (x === playerPos.x && y === playerPos.y) {
          return EMOJI_MAP["P"] || "❓";
        }
        return EMOJI_MAP[tile] || EMOJI_MAP["W"] || "⬛";
      })
      .join("");
  });
}
