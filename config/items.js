export default {
  // Weapons
  warrior_sword: {
    name: "Warrior's Broadsword",
    type: "weapon",
    description: "A heavy sword perfect for frontline combat",
    stats: { attack: 8 },
    value: 35,
    rarity: "common",
    classRestriction: ["Warrior"],
  },
  mage_staff: {
    name: "Apprentice's Staff",
    type: "weapon",
    description: "A wooden staff imbued with magical energy",
    stats: { magic: 10, attack: 2 },
    value: 30,
    rarity: "common",
    classRestriction: ["Mage"],
  },
  ranger_bow: {
    name: "Hunter's Bow",
    type: "weapon",
    description: "A well-balanced bow with excellent range",
    stats: { attack: 7, speed: 1 },
    value: 40,
    rarity: "common",
    classRestriction: ["Archer"],
  },

  // Armor
  warrior_armor: {
    name: "Plate Armor",
    type: "armor",
    description: "Heavy metal armor offering superior protection",
    stats: { defense: 6, speed: -1 },
    value: 50,
    rarity: "common",
  },
  mage_robe: {
    name: "Enchanted Robe",
    type: "armor",
    description: "Robe woven with magical enhancement threads",
    stats: { defense: 2, magic: 3 },
    value: 25,
    rarity: "common",
  },
  ranger_leather: {
    name: "Ranger's Leathers",
    type: "armor",
    description: "Lightweight leather allowing free movement",
    stats: { defense: 4, speed: 2 },
    value: 35,
    rarity: "common",
  },

  // Consumables
  health_potion: {
    name: "Health Potion",
    type: "consumable",
    description: "Restores 30 health points",
    stats: { health: 30 },
    value: 10,
    rarity: "common",
  },
  mana_potion: {
    name: "Mana Potion",
    type: "consumable",
    description: "Restores 25 mana points",
    stats: { magic: 25 },
    value: 15,
    rarity: "common",
  },
  bandage: {
    name: "Bandage",
    type: "consumable",
    description: "Basic medical dressing that stops bleeding",
    stats: { health: 15 },
    value: 5,
    rarity: "common",
  },
  arrows: {
    name: "Arrows",
    type: "material",
    description: "Standard arrows for bows (20 count)",
    value: 1,
    rarity: "common",
  },
};
