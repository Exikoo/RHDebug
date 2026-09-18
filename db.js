import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import ItemManager from "./utils/itemManager.js";

const { mongooseConnectionString } = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url), "utf-8"),
);

async function setupDatabase() {
  await mongoose.connect(mongooseConnectionString);
  console.log("✅ Connected to database");

  await ItemManager.initializeItems();
  console.log("✅ Items initialized");
}

export { setupDatabase };
