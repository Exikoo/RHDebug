import mongoose from "mongoose";

const MonsterSchema = new mongoose.Schema(
  {
    monsterType: { type: String, required: true },
    name: { type: String, required: true },
    currentHealth: { type: Number, required: true },
    maxHealth: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    experience: { type: Number, required: true },
    mapId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    isDead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

MonsterSchema.index({ mapId: 1, x: 1, y: 1 }, { unique: true });

const Monster = mongoose.model("Monster", MonsterSchema);

export default Monster;
