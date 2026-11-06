/**
 * Talent tree.
 *
 * Nine columns/rows are rendered as an emoji grid on the Talent screen, so
 * every node needs a fixed cell. `TREE_LAYOUT` is that grid:
 *
 *   '.' empty cell      'N' talent node
 *   '|' vertical link   '-' horizontal link
 *
 * Node positions are looked up by (row, column) through the `row`/`col`
 * fields below, so the layout can be rearranged without touching the code.
 */

export const TREE_ROW_COUNT = 5;
export const TREE_COL_COUNT = 7;

export const TREE_LAYOUT = [
  "...N...",
  "...|...",
  ".N-N-N.",
  ".|.|.|.",
  ".N.N.N.",
];

/**
 * @typedef {Object} Talent
 * @property {string} id
 * @property {string} name
 * @property {string} short        Button label (<= 15 chars).
 * @property {string} description  What one rank gives.
 * @property {"str"|"int"|"vit"} branch
 * @property {number} row
 * @property {number} col
 * @property {string[]} requires   Talent ids that must be at rank 1 first.
 * @property {number} maxRank
 * @property {Object<string, number>} effect  Stat gain per rank.
 */

/** @type {Talent[]} */
export const TALENTS = [
  {
    id: "resolve",
    name: "Adventurer's Resolve",
    short: "Resolve",
    description: "+6 max health per rank.",
    branch: "vit",
    row: 0,
    col: 3,
    requires: [],
    maxRank: 5,
    effect: { health: 6 },
  },
  {
    id: "brute_force",
    name: "Brute Force",
    short: "Brute Force",
    description: "+2 attack per rank.",
    branch: "str",
    row: 2,
    col: 1,
    requires: ["resolve"],
    maxRank: 5,
    effect: { attack: 2 },
  },
  {
    id: "arcane_study",
    name: "Arcane Study",
    short: "Arcane",
    description: "+2 magic per rank.",
    branch: "int",
    row: 2,
    col: 3,
    requires: ["resolve"],
    maxRank: 5,
    effect: { magic: 2 },
  },
  {
    id: "toughness",
    name: "Toughness",
    short: "Toughness",
    description: "+2 defense per rank.",
    branch: "vit",
    row: 2,
    col: 5,
    requires: ["resolve"],
    maxRank: 5,
    effect: { defense: 2 },
  },
  {
    id: "cleave",
    name: "Cleave",
    short: "Cleave",
    description: "+4 attack per rank.",
    branch: "str",
    row: 4,
    col: 1,
    requires: ["brute_force"],
    maxRank: 3,
    effect: { attack: 4 },
  },
  {
    id: "mana_well",
    name: "Mana Well",
    short: "Mana Well",
    description: "+4 magic per rank.",
    branch: "int",
    row: 4,
    col: 3,
    requires: ["arcane_study"],
    maxRank: 3,
    effect: { magic: 4 },
  },
  {
    id: "iron_skin",
    name: "Iron Skin",
    short: "Iron Skin",
    description: "+5 max health per rank.",
    branch: "vit",
    row: 4,
    col: 5,
    requires: ["toughness"],
    maxRank: 3,
    effect: { health: 5 },
  },
];

/** @type {Map<string, Talent>} */
export const TALENT_BY_ID = new Map(TALENTS.map((t) => [t.id, t]));

/** (row,col) -> talent, for the grid renderer. */
export const TALENT_BY_CELL = new Map(
  TALENTS.map((t) => [`${t.row},${t.col}`, t]),
);

/** Display order of the node buttons (1..n). */
export const TALENT_ORDER = TALENTS.map((t) => t.id);

/** Points needed per talent point, and attribute points per level. */
export const POINTS_PER_LEVEL = {
  attribute: 1,
  /** One talent point every N levels. */
  talentEvery: 2,
};

/** Attribute points: what one point of each does. */
export const ATTRIBUTE_EFFECTS = {
  str: { attack: 2, label: "Strength", short: "STR" },
  int: { magic: 2, label: "Intelligence", short: "INT" },
  vit: { health: 5, label: "Vitality", short: "VIT" },
};

/** @type {Array<"str"|"int"|"vit">} */
export const ATTRIBUTE_KEYS = ["str", "int", "vit"];
