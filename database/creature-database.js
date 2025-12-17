console.log('[creature-database.js] Loading creature database...');

// Creature database with shiny portrait support
function getAllMonsters() {
  const monsters = [];
  for (let i = 1; i < 1000; i++) {
    try {
      // Check game state is available
      if (!globalThis.state?.utils?.getMonster) {
        console.warn('[creature-database.js] state.utils.getMonster not available yet');
        break;
      }
      const monster = globalThis.state.utils.getMonster(i);
      if (monster?.metadata?.name) {
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

function buildCreatureDatabase() {
  try {
    const allMonsters = getAllMonsters();
    
    if (allMonsters.length === 0) {
      console.warn('[creature-database.js] No monsters loaded, returning empty database');
      return {
        ALL_CREATURES: [],
        UNOBTAINABLE_CREATURES: []
      };
    }
    
    const allCreatureNames = allMonsters.map(m => m.metadata.name);
    const hardcodedUnobtainable = ['Black Knight', 'Dharalion', 'Dead Tree', 'Dwarf Henchman', 'Earth Crystal', 'Energy Crystal', 'Lavahole', 'Magma Crystal', 'Monster Cauldron', 'Old Giant Spider', 'Orc', 'Regeneration Tank', 'Sweaty Cyclops', 'Tentugly', 'Willi Wasp'];
    
    const unobtainableFromMonsters = allMonsters
      .filter(m => hardcodedUnobtainable.includes(m.metadata.name))
      .map(m => m.metadata.name);
    
    const unobtainableCreatures = [...new Set([...hardcodedUnobtainable, ...unobtainableFromMonsters])]
      .sort((a, b) => a.localeCompare(b));
    
    const obtainableCreatures = allCreatureNames
      .filter(name => !hardcodedUnobtainable.includes(name))
      .sort((a, b) => a.localeCompare(b));
    
    return {
      ALL_CREATURES: obtainableCreatures,
      UNOBTAINABLE_CREATURES: unobtainableCreatures
    };
  } catch (error) {
    console.error('[creature-database.js] Error building database:', error);
    return {
      ALL_CREATURES: [],
      UNOBTAINABLE_CREATURES: []
    };
  }
}

function getMonsterPortraitUrl(monsterId, isShiny = false) {
  return `/assets/portraits/${monsterId}${isShiny ? '-shiny' : ''}.png`;
}

function getMonsterPortraitUrls(monsterId) {
  return {
    normal: getMonsterPortraitUrl(monsterId, false),
    shiny: getMonsterPortraitUrl(monsterId, true)
  };
}

function findMonsterByGameId(gameId) {
  const allMonsters = getAllMonsters();
  return allMonsters.find(monster => monster.gameId === gameId);
}

function findMonsterByName(name) {
  const allMonsters = getAllMonsters();
  return allMonsters.find(monster => 
    monster.metadata?.name?.toLowerCase() === name.toLowerCase()
  );
}

function waitForGameState(callback, retries = 0, maxRetries = 20) {
  try {
    const hasPlayerState = globalThis.state?.player?.getSnapshot;
    const hasBoardState = globalThis.state?.board?.getSnapshot;
    const hasUtils = globalThis.state?.utils?.getMonster;
    
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
  
  creatureDatabase.getMonsterPortraitUrl = getMonsterPortraitUrl;
  creatureDatabase.getMonsterPortraitUrls = getMonsterPortraitUrls;
  creatureDatabase.findMonsterByGameId = findMonsterByGameId;
  creatureDatabase.findMonsterByName = findMonsterByName;
  creatureDatabase.getAllMonstersWithPortraits = getAllMonsters;
  
  databaseInitialized = true;
  return creatureDatabase;
}

const placeholderDatabase = {
  ALL_CREATURES: [],
  UNOBTAINABLE_CREATURES: [],
  getMonsterPortraitUrl: getMonsterPortraitUrl,
  getMonsterPortraitUrls: getMonsterPortraitUrls,
  findMonsterByGameId: function(gameId) {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.findMonsterByGameId ? creatureDatabase.findMonsterByGameId(gameId) : null;
    }
    if (!databaseInitialized) {
      return null;
    }
    return findMonsterByGameId(gameId);
  },
  findMonsterByName: function(name) {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.findMonsterByName ? creatureDatabase.findMonsterByName(name) : null;
    }
    if (!databaseInitialized) {
      return null;
    }
    return findMonsterByName(name);
  },
  getAllMonstersWithPortraits: function() {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.getAllMonstersWithPortraits ? creatureDatabase.getAllMonstersWithPortraits() : [];
    }
    if (!databaseInitialized) {
      return [];
    }
    return getAllMonsters();
  }
};

const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow && !globalWindow.creatureDatabase) {
  globalWindow.creatureDatabase = placeholderDatabase;
}

waitForGameState(() => {
  initializeDatabase();
  
  if (globalWindow) {
    Object.assign(globalWindow.creatureDatabase, creatureDatabase);
    globalWindow.creatureDatabase.ALL_CREATURES = creatureDatabase.ALL_CREATURES;
    globalWindow.creatureDatabase.UNOBTAINABLE_CREATURES = creatureDatabase.UNOBTAINABLE_CREATURES;
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

