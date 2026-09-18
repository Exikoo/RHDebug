import items from "../config/items.js";
import Item from "../models/Item.js";
import classes from "../config/classes.js";

class ItemManager {
  static async initializeItems() {
    try {
      const operations = Object.entries(items).map(([id, itemData]) => ({
        updateOne: {
          filter: { itemId: id },
          update: {
            $set: {
              ...itemData,
              itemId: id,
            },
          },
          upsert: true,
        },
      }));

      const result = await Item.bulkWrite(operations);
      console.log(
        `Items initialized: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`,
      );
      return result;
    } catch (error) {
      console.error("Error initializing items:", error);
      throw error;
    }
  }

  static async getItem(itemId) {
    return Item.findOne({ itemId });
  }

  static async getStarterKit(classType) {
    const classConfig = classes[classType];
    if (!classConfig) throw new Error("Invalid class type");

    try {
      const [weapon, armor] = await Promise.all([
        this.getItem(classConfig.starterKit.weapon),
        this.getItem(classConfig.starterKit.armor),
      ]);

      if (!weapon || !armor) {
        throw new Error("Missing required starter items");
      }

      const starterItems = await Promise.all(
        classConfig.starterKit.items.map(async (item) => ({
          item: await this.getItem(item.id),
          quantity: item.quantity,
        })),
      );

      return {
        weapon,
        armor,
        items: starterItems.filter((i) => i.item !== null),
      };
    } catch (error) {
      console.error("Error getting starter kit:", error);
      throw error;
    }
  }
}

export default ItemManager;
