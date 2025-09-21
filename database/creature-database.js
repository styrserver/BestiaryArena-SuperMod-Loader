console.log('[creature-database.js] Loading creature database...');

// Function to dynamically fetch all monsters
function getAllMonsters() {
  const monsters = [];
  for (let i = 1; i < 1000; i++) {
    try {
      // Use multiple fallbacks to access the game state
      const state = globalThis.state || window.state || (typeof state !== 'undefined' ? state : null);
      if (!state?.utils?.getMonster) {
        console.warn('[creature-database.js] state.utils.getMonster not available yet');
        break;
      }
      const monster = state.utils.getMonster(i);
      if (monster?.metadata?.name) {
        monsters.push({ gameId: i, ...monster });
      }
    } catch (e) { break; }
  }
  return monsters;
}

// Function to build creature lists from dynamic data
function buildCreatureDatabase() {
  const allMonsters = getAllMonsters();
  
  // If no monsters were loaded, return empty database
  if (allMonsters.length === 0) {
    console.warn('[creature-database.js] No monsters loaded, returning empty database');
    return {
      ALL_CREATURES: [],
      UNOBTAINABLE_CREATURES: [],
      HARDCODED_MONSTER_STATS: {}
    };
  }
  
  // Extract just the names for the ALL_CREATURES array
  const allCreatureNames = allMonsters.map(m => m.metadata.name);
  
  // Check against hardcoded list of known unobtainable creatures
  const hardcodedUnobtainable = ['Black Knight', 'Dharalion', 'Dead Tree', 'Earth Crystal', 'Energy Crystal', 'Lavahole', 'Magma Crystal', 'Old Giant Spider', 'Orc', 'Sweaty Cyclops', 'Willi Wasp'];
  const unobtainableCreatures = allMonsters
    .filter(m => hardcodedUnobtainable.includes(m.metadata.name))
    .map(m => m.metadata.name)
    .sort((a, b) => a.localeCompare(b));
  
  // Remove unobtainable creatures from ALL_CREATURES and sort alphabetically
  const obtainableCreatures = allCreatureNames
    .filter(name => !hardcodedUnobtainable.includes(name))
    .sort((a, b) => a.localeCompare(b));
  
  return {
    ALL_CREATURES: obtainableCreatures,
    UNOBTAINABLE_CREATURES: unobtainableCreatures,
    // Hardcoded monster stats for special creatures that don't follow normal patterns
    HARDCODED_MONSTER_STATS: {
      'old giant spider': { baseStats: { hp: 1140, ad: 108, ap: 30, armor: 30, magicResist: 30 }, level: 300 },
      'willi wasp': { baseStats: { hp: 924, ad: 0, ap: 0, armor: 26, magicResist: 45 }, level: 100 },
      'black knight': { baseStats: { hp: 4800, ad: 66, ap: 0, armor: 975, magicResist: 975 }, level: 300 },
      'dharalion': { baseStats: { hp: 2200, ad: 33, ap: 25, armor: 60, magicResist: 66 }, level: 200 },
      'dead tree': { baseStats: { hp: 7000, ad: 0, ap: 0, armor: 700, magicResist: 700 }, level: 100 },
      'earth crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
      'energy crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 150, magicResist: 30 }, level: 50 },
      'magma crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 }
    }
  };
}

// Build the database dynamically
const creatureDatabase = buildCreatureDatabase();

// Export for use in other mods
// Use multiple fallbacks to ensure the database is available globally
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow) {
  globalWindow.creatureDatabase = creatureDatabase;
  console.log(`[creature-database.js] Loaded ${creatureDatabase.ALL_CREATURES.length} creatures dynamically (cached for all mods)`);
  console.log('[creature-database.js] ALL_CREATURES length:', creatureDatabase.ALL_CREATURES?.length);
  console.log('[creature-database.js] UNOBTAINABLE_CREATURES length:', creatureDatabase.UNOBTAINABLE_CREATURES?.length);
}
if (typeof module !== 'undefined') {
  module.exports = creatureDatabase;
}
