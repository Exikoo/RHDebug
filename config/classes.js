export default {
  warrior: {
    displayName: "Warrior",
    description: "A strong melee fighter with high defense",
    baseStats: { health: 120, attack: 8, defense: 6, speed: 4, magic: 0 },
    starterKit: {
      weapon: "warrior_sword",
      armor: "warrior_armor",
      items: [
        { id: "health_potion", quantity: 5 },
        { id: "bandage", quantity: 10 },
      ],
    },
    color: 0xc62828, // Red
  },
  mage: {
    displayName: "Mage",
    description: "A spellcaster with powerful magical abilities",
    baseStats: { health: 80, attack: 4, defense: 3, speed: 5, magic: 8 },
    starterKit: {
      weapon: "mage_staff",
      armor: "mage_robe",
      items: [
        { id: "health_potion", quantity: 3 },
        { id: "mana_potion", quantity: 5 },
      ],
    },
    color: 0x1565c0, // Blue
  },
  archer: {
    displayName: "Archer",
    description: "A agile ranged combatant with quick reflexes",
    baseStats: { health: 100, attack: 7, defense: 5, speed: 7, magic: 2 },
    starterKit: {
      weapon: "ranger_bow",
      armor: "ranger_leather",
      items: [
        { id: "health_potion", quantity: 4 },
        { id: "arrows", quantity: 20 },
      ],
    },
    color: 0x2e7d32, // Green
  },
};
