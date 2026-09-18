import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["weapon", "armor", "accessory", "consumable", "material"],
    },
    description: { type: String, default: "" },
    value: { type: Number, default: 0, min: 0 },
    stats: {
      attack: { type: Number, default: 0 },
      defense: { type: Number, default: 0 },
      health: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      magic: { type: Number, default: 0 },
    },
    rarity: {
      type: String,
      enum: ["common", "uncommon", "rare", "epic", "legendary"],
      default: "common",
    },
    classRestriction: {
      type: [String],
      default: null,
      validate: {
        validator: (arr) =>
          arr == null ||
          arr.length === 0 ||
          arr.every((v) => ["Warrior", "Mage", "Archer"].includes(v)),
        message:
          "classRestriction must be an array containing only Warrior, Mage, or Archer",
      },
    },
    levelRequirement: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true, strict: false },
);

const Item = mongoose.model("Item", itemSchema);

export default Item;
