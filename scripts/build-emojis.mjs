/**
 * Builds the game's emoji PNGs from the tileset in `tileset/`.
 *
 *   npm run build:emojis
 *
 * The output lands in `docs/emojis/` next to the bag emojis, so `/emojis
 * upload` picks the files up by name and the demo bot can use them as soon
 * as the IDs are pasted into `config/emojiIds.js`.
 *
 * Tiles are scaled 32 -> 128 with nearest-neighbour so the pixel art stays
 * crisp; the bar segments are drawn in the tileset palette because the DCSS
 * tileset has no health/mana bar of its own.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "emojis");
const TILES = path.join(ROOT, "tileset");

/** Discord renders emoji small; 128px keeps the sprites sharp. */
const SIZE = 128;

/** Tileset art copied straight into an emoji. */
const COPIES = [
  // demo screen
  ["dngn/floor/grass/grass0.png", "demo_grass_1", "grass, the field's base tile"],
  ["dngn/floor/grass/grass-dark0.png", "demo_grass_2", "darker grass, the field's speckle"],
  ["player/base/human_m.png", "demo_player", "the walking sprite"],
  // map tiles that were still unicode
  ["item/misc/misc_stone.png", "tile_rock", "boulder on the plain"],
  ["item/misc/misc_box_of_beasts.png", "tile_chest", "treasure chest (closest chest art in the set)"],
];

/**
 * One segment of the HP/Mana bars: dark frame, filled body, lit top edge and
 * a shaded bottom, matching the segmented bars of the gif.
 */
function barSvg(fill, highlight, shadow) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <rect width="32" height="32" fill="#121316"/>
    <rect x="2" y="2" width="28" height="28" fill="${fill}"/>
    <rect x="2" y="2" width="28" height="9" fill="${highlight}"/>
    <rect x="2" y="25" width="28" height="5" fill="${shadow}"/>
    <rect x="2" y="2" width="28" height="28" fill="none" stroke="#0b0c0e" stroke-width="2"/>
  </svg>`;
}

/** Full and empty segments, in the gif's red and blue. */
const BARS = [
  ["bar_hp", barSvg("#b3382f", "#e0574c", "#7a1f19"), "HP segment"],
  ["bar_hp_empty", barSvg("#2a2c31", "#34363c", "#1b1c20"), "spent HP segment"],
  ["bar_mana", barSvg("#2f6fd0", "#5a95e8", "#1a3f78"), "Mana segment"],
  ["bar_mana_empty", barSvg("#2a2c31", "#34363c", "#1b1c20"), "spent Mana segment"],
];

/** Scale a tile up without smoothing it. */
async function upscaleTile(relative, name) {
  const source = path.join(TILES, relative);
  if (!fs.existsSync(source)) throw new Error(`missing tileset file: ${relative}`);

  const file = path.join(OUT, `${name}.png`);
  await sharp(source)
    .resize(SIZE, SIZE, { kernel: "nearest", fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(file);

  return file;
}

/** Draw one bar segment. */
async function drawBar(name, svg) {
  const file = path.join(OUT, `${name}.png`);
  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE, { kernel: "nearest", fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(file);

  return file;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const written = [];
  for (const [relative, name, note] of COPIES) {
    const file = await upscaleTile(relative, name);
    written.push([path.basename(file), name, note]);
  }

  for (const [name, svg, note] of BARS) {
    const file = await drawBar(name, svg);
    written.push([path.basename(file), name, note]);
  }

  console.log(`Wrote ${written.length} emoji PNGs to docs/emojis:`);
  for (const [file, name, note] of written) {
    console.log(`  ${file.padEnd(22)} <:${name}>`.padEnd(48) + note);
  }
  console.log("\nNext: /emojis upload, then paste the printed block into config/emojiIds.js.");
}

await main();
