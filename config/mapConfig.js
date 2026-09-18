export const EMOJI_MAP = {
  D: "<:floor:1393658990449262822>", // floor
  W: "<:stone_brick_1:1414280361885827213>", // wall
  P: "<:player:1414284867813773372>", // player on grass
  G: "<:grass:1411386955026923550>", // grass
  T: "<:tree_on_grass:1414283682579091466>", // tree on grass
  S: "<:stairs:1393659058946441297>", // stairs
  WT: "<:shoals_deep_water_1_shape:1414281044554809354>", // water
  WD: "<:enter_shop:1414281517592477836>", // door
  PORTAL: "<:portal_on_grass:1415433564601843783>", // portal
  SHOP: "<:enter_shop:1414281517592477836>", // shop
  CYCLOPS: "<:cyclops_new:1414985794313261156>", // cyclops
  PUDDLE: "<:blood_puddle_red_4:1417102581406236713>", // blood puddle
};

export const LEGEND = {
  W: { walkable: false },
  T: { walkable: false },
  WT: { walkable: false },
  WD: { walkable: false },
  G: { walkable: true },
  D: { walkable: true },
  S: { walkable: true, event: "stairs" },
  P: { walkable: true },
  SHP: { walkable: false, event: "shop" },
  CYCLOPS: { walkable: false, event: "monster" },
  PUDDLE: { walkable: true },
};

export const VIEW_WIDTH = 16;
export const VIEW_HEIGHT = 7;
export const DUNGEON_WIDTH = 16;
export const DUNGEON_HEIGHT = 7;
