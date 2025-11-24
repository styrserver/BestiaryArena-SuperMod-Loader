console.log('[creature-database.js] Loading creature database...');

/**
 * Enhanced Creature Database with Shiny Portrait Support
 * 
 * Usage Examples:
 * 
 * // Get portrait URLs for a monster
 * const normalUrl = creatureDatabase.getMonsterPortraitUrl(1, false);
 * const shinyUrl = creatureDatabase.getMonsterPortraitUrl(1, true);
 * 
 * // Get both portrait URLs at once
 * const portraits = creatureDatabase.getMonsterPortraitUrls(1);
 * // portraits.normal = "/assets/portraits/1.png"
 * // portraits.shiny = "/assets/portraits/1-shiny.png"
 * 
 * // Find monster data with portrait information
 * const monster = creatureDatabase.findMonsterByGameId(1);
 * // monster.portraits.normal and monster.portraits.shiny are available
 * 
 * // Get all monsters with portrait data
 * const allMonsters = creatureDatabase.getAllMonstersWithPortraits();
 * 
 * // Display shiny portrait if creature is shiny
 * const portraitUrl = creature.isShiny ? 
 *   creatureDatabase.getMonsterPortraitUrl(creature.gameId, true) : 
 *   creatureDatabase.getMonsterPortraitUrl(creature.gameId, false);
 */

// Function to dynamically fetch all monsters with enhanced portrait data
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
        // Enhanced monster data with portrait information
        monsters.push({ 
          gameId: i, 
          ...monster,
          portraits: {
            normal: `/assets/portraits/${i}.png`,
            shiny: `/assets/portraits/${i}-shiny.png`
          }
        });
      }
    } catch (e) { break; }
  }
  return monsters;
}

// Function to build creature lists from dynamic data
function buildCreatureDatabase() {
  try {
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
    const hardcodedUnobtainable = ['Black Knight', 'Dharalion', 'Dead Tree', 'Dwarf Henchman', 'Earth Crystal', 'Energy Crystal', 'Lavahole', 'Magma Crystal', 'Monster Cauldron', 'Old Giant Spider', 'Orc', 'Regeneration Tank', 'Sweaty Cyclops', 'Tentugly', 'Willi Wasp'];
    
    // Get unobtainable creatures from allMonsters that match the hardcoded list
    const unobtainableFromMonsters = allMonsters
      .filter(m => hardcodedUnobtainable.includes(m.metadata.name))
      .map(m => m.metadata.name);
    
    // Ensure all hardcoded unobtainable creatures are included, even if not in allMonsters
    // This handles cases like "Dwarf Henchman" which may not be loaded in the initial game state
    const unobtainableCreatures = [...new Set([...hardcodedUnobtainable, ...unobtainableFromMonsters])]
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
        'magma crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
        'regeneration tank': { baseStats: { hp: 8352, ad: 0, ap: 0, armor: 126, magicResist: 696 }, level: 99 },
        'monster cauldron': { baseStats: { hp: 1114, ad: 92, ap: 112, armor: 45, magicResist: 42 }, level: 99 }
      }
    };
  } catch (error) {
    console.error('[creature-database.js] Error building database:', error);
    return {
      ALL_CREATURES: [],
      UNOBTAINABLE_CREATURES: [],
      HARDCODED_MONSTER_STATS: {}
    };
  }
}

// Portrait utility functions for shiny creature support
/**
 * Get the portrait URL for a monster
 * @param {number} monsterId - The game ID of the monster
 * @param {boolean} isShiny - Whether to get the shiny variant (default: false)
 * @returns {string} The portrait URL
 */
function getMonsterPortraitUrl(monsterId, isShiny = false) {
  return `/assets/portraits/${monsterId}${isShiny ? '-shiny' : ''}.png`;
}

/**
 * Get both normal and shiny portrait URLs for a monster
 * @param {number} monsterId - The game ID of the monster
 * @returns {Object} Object with normal and shiny portrait URLs
 */
function getMonsterPortraitUrls(monsterId) {
  return {
    normal: getMonsterPortraitUrl(monsterId, false),
    shiny: getMonsterPortraitUrl(monsterId, true)
  };
}

/**
 * Find a monster by its game ID
 * @param {number} gameId - The game ID to search for
 * @returns {Object|null} The monster object or null if not found
 */
function findMonsterByGameId(gameId) {
  const allMonsters = getAllMonsters();
  return allMonsters.find(monster => monster.gameId === gameId);
}

/**
 * Find a monster by its name (case-insensitive)
 * @param {string} name - The monster name to search for
 * @returns {Object|null} The monster object or null if not found
 */
function findMonsterByName(name) {
  const allMonsters = getAllMonsters();
  return allMonsters.find(monster => 
    monster.metadata?.name?.toLowerCase() === name.toLowerCase()
  );
}

// Wait for game state to be ready before building database
// This prevents crashes from accessing game state too early
function waitForGameState(callback, retries = 0, maxRetries = 20) {
  try {
    const state = globalThis.state || window.state;
    const hasPlayerState = state?.player?.getSnapshot;
    const hasBoardState = state?.board?.getSnapshot;
    const hasUtils = state?.utils?.getMonster;
    
    if (hasPlayerState && hasBoardState && hasUtils) {
      callback();
    } else if (retries < maxRetries) {
      setTimeout(() => waitForGameState(callback, retries + 1, maxRetries), 250);
    } else {
      console.warn('[creature-database.js] Game state not ready after max retries, building database anyway');
      callback();
    }
  } catch (error) {
    console.error('[creature-database.js] Error checking game state:', error);
    if (retries < maxRetries) {
      setTimeout(() => waitForGameState(callback, retries + 1, maxRetries), 250);
    } else {
      console.warn('[creature-database.js] Building database despite errors');
      callback();
    }
  }
}

// Initialize database with lazy loading
let creatureDatabase = null;
let databaseInitialized = false;

function initializeDatabase() {
  if (databaseInitialized) return creatureDatabase;
  
  creatureDatabase = buildCreatureDatabase();
  
  // Add portrait utilities to the database
  creatureDatabase.getMonsterPortraitUrl = getMonsterPortraitUrl;
  creatureDatabase.getMonsterPortraitUrls = getMonsterPortraitUrls;
  creatureDatabase.findMonsterByGameId = findMonsterByGameId;
  creatureDatabase.findMonsterByName = findMonsterByName;
  creatureDatabase.getAllMonstersWithPortraits = getAllMonsters;
  
  databaseInitialized = true;
  return creatureDatabase;
}

// Create a placeholder object immediately so other mods don't break
// It will be replaced with the real database once initialized
const placeholderDatabase = {
  ALL_CREATURES: [],
  UNOBTAINABLE_CREATURES: [],
  HARDCODED_MONSTER_STATS: {},
  getMonsterPortraitUrl: getMonsterPortraitUrl,
  getMonsterPortraitUrls: getMonsterPortraitUrls,
  findMonsterByGameId: function(gameId) {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.findMonsterByGameId ? creatureDatabase.findMonsterByGameId(gameId) : null;
    }
    if (!databaseInitialized) {
      // Database not ready yet, return null to avoid triggering early access
      return null;
    }
    return findMonsterByGameId(gameId);
  },
  findMonsterByName: function(name) {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.findMonsterByName ? creatureDatabase.findMonsterByName(name) : null;
    }
    if (!databaseInitialized) {
      // Database not ready yet, return null to avoid triggering early access
      return null;
    }
    return findMonsterByName(name);
  },
  getAllMonstersWithPortraits: function() {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.getAllMonstersWithPortraits ? creatureDatabase.getAllMonstersWithPortraits() : [];
    }
    if (!databaseInitialized) {
      // Database not ready yet, return empty array to avoid triggering early access
      return [];
    }
    return getAllMonsters();
  }
};

// Export placeholder immediately for mods that need early access
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow && !globalWindow.creatureDatabase) {
  globalWindow.creatureDatabase = placeholderDatabase;
}

// Wait for game state before initializing
waitForGameState(() => {
  initializeDatabase();
  
  // Replace placeholder with real database
  if (globalWindow) {
    Object.assign(globalWindow.creatureDatabase, creatureDatabase);
    // Ensure all properties are copied
    globalWindow.creatureDatabase.ALL_CREATURES = creatureDatabase.ALL_CREATURES;
    globalWindow.creatureDatabase.UNOBTAINABLE_CREATURES = creatureDatabase.UNOBTAINABLE_CREATURES;
    globalWindow.creatureDatabase.HARDCODED_MONSTER_STATS = creatureDatabase.HARDCODED_MONSTER_STATS;
    globalWindow.creatureDatabase.findMonsterByGameId = findMonsterByGameId;
    globalWindow.creatureDatabase.findMonsterByName = findMonsterByName;
    globalWindow.creatureDatabase.getAllMonstersWithPortraits = getAllMonsters;
    
    console.log(`[creature-database.js] Loaded ${creatureDatabase.ALL_CREATURES.length} creatures dynamically (cached for all mods)`);
    console.log('[creature-database.js] ALL_CREATURES length:', creatureDatabase.ALL_CREATURES?.length);
    console.log('[creature-database.js] UNOBTAINABLE_CREATURES length:', creatureDatabase.UNOBTAINABLE_CREATURES?.length);
    console.log('[creature-database.js] Portrait utilities added for shiny creature support');
  }
  if (typeof module !== 'undefined') {
    module.exports = creatureDatabase;
  }
});

