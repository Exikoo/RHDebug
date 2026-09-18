import mongoose from "mongoose";

const mapSchema = new mongoose.Schema(
  {
    mapId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    mapData: {
      type: [[String]],
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    defaultSpawnPoint: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    mapType: {
      type: String,
      enum: [
        "overworld",
        "dungeon",
        "building",
        "special",
        "event",
        "guild-base",
      ],
      default: "overworld",
    },
    connections: [
      {
        direction: {
          type: String,
          enum: ["north", "south", "east", "west", "up", "down", "portal"],
        },
        targetMapId: String,
        targetPosition: {
          x: Number,
          y: Number,
        },
        fromPosition: {
          x: Number,
          y: Number,
        },
      },
    ],
    events: [
      {
        position: {
          x: Number,
          y: Number,
        },
        eventType: String,
        eventData: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  {
    timestamps: true,
  },
);

mapSchema.methods.getTile = function (x, y) {
  if (
    y >= 0 &&
    y < this.mapData.length &&
    x >= 0 &&
    x < this.mapData[y].length
  ) {
    return this.mapData[y][x];
  }
  return null; // Out of bounds
};

mapSchema.methods.setTile = function (x, y, tileType) {
  if (
    y >= 0 &&
    y < this.mapData.length &&
    x >= 0 &&
    x < this.mapData[y].length
  ) {
    this.mapData[y][x] = tileType;
    return true;
  }
  return false; // Out of bounds
};

mapSchema.statics.createMap = async function (mapId, name, mapData) {
  const height = mapData.length;
  const width = mapData[0] ? mapData[0].length : 0;

  return this.create({
    mapId,
    name,
    mapData,
    width,
    height,
    defaultSpawnPoint: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
  });
};

const Map = mongoose.model("Map", mapSchema);

export default Map;
