console.log('[equipment-database.js] Loading equipment database...');

/**
 * Wiki / infobox: comma-separated boosted map names per equipment (string).
 * Omitted items are not boosted-map equipment. Shared by equipment-lua-export.js and Cyclopedia.
 */
const HARDCODED_BOOSTED_MAP = {
  'Amulet of Loss':
    'Carlin Sewers, Labyrinth Depths, Hidden City of Demona',
  'Bear Skin': 'Honeyflower Tower, Bear Room',
  'Bloody Edge':
    'Evergreen Fields, City Boardgames, Carlin Sewers, Ghostlands Surface, Demon Skeleton Hell, Demonrage Seal, Elvenbane, The Orc King Hall',
  'Blue Robe':
    "Ghostlands Library, Zathroth's Throne, Cave Entrance, Vega Mountain, Ab'Dendriel Hive, Femor Hills, Elvenbane",
  'Bonelord Helmet':
    "Swampy Path, Carlin Sewers, Hidden City of Demona, Cave Entrance, Dwarven Brewery",
  'Boots of Haste':
    "Honeyflower Tower, City Boardgames, Vega Mountain, Hedge Maze, Ab'Dendriel Hive, Orc Fortress Outskirts, Dwarven Brewery",
  'Chain Bolter': 'Goblin Bridge, Labyrinth Depths, Vega Stronghold, Hedge Maze',
  'Cranial Basher': 'Isle of Kings, The Farms',
  'Dwarven Helmet': 'Goblin Temple, City Boardgames, Isle of Kings',
  'Dwarven Legs': 'Minotaur Mage Room, Minotaur Hell, Orc Fortress Outskirts',
  'Ectoplasmic Shield': 'Hidden City of Demona',
  'Epee':
    "Evergreen Fields, Wolf's Den, Spider Lair, Minotaur Hell, Ghostlands Library, The Orc King Hall, Robson's Isle Ruins",
  'Fire Axe':
    "Spider Lair, Amber's Raft, Ghostlands Library, Santa Claus Home, Femor Hills, Orcish Barracks, The Orc King Hall",
  'Giant Sword': 'Honeyflower Tower, Swampy Path, Carlin Sewers',
  'Glacial Rod':
    "Ghostlands Ritual Site, Banshee's Last Room, Teleporter Trap, Wyda's House",
  'Glass of Goo': "Amber's Raft, Awash Steamship",
  'Ice Rapier': 'Minotaur Hell, Carlin Sewers',
  'Medusa Shield':
    "Rotten Graveyard, Zathroth's Throne, Teleporter Trap, Frozen Aquifer",
  'Ratana':
    'Evergreen Fields, Ghostlands Surface, Orcish Barracks, Underground Lake',
  'Royal Scale Robe': 'Rotten Graveyard, Katana Quest, Isle of Kings, Shadowthorn',
  'Skull Helmet': 'Rotten Graveyard, Katana Quest',
  'Skullcracker Armor':
    "Demonrage Seal, Alawar's Vault, Elvenbane, A Shamanic Ritual",
  'Soft Boots': 'Darama Oasis',
  'Spellbook of Ancient Arcana': 'Putrid Chamber',
  'Springsprout Rod': 'Teleporter Trap, Folda Boat, Frozen Aquifer',
  'Stealth Ring': "Banshee's Last Room, Hedge Maze, Ab'Dendriel Hive",
  'Vampire Shield':
    "Spider Lair, Ghostlands Library, Maze Gates, Ab'Dendriel Hive",
  'Wand of Decay':
    "Minotaur Hell, Ghostlands Ritual Site, Banshee's Last Room, Teleporter Trap, Folda Boat, Vega Mountain, Dwarven Brewery, Robson's Isle Ruins",
  'White Skull': 'Rotten Graveyard, Katana Quest'
};

// Function to dynamically fetch all equipment
function getAllEquipment() {
  const equipment = [];
  for (let i = 1; i < 1000; i++) {
    try {
      // Use multiple fallbacks to access the game state
      const state = globalThis.state || window.state || (typeof state !== 'undefined' ? state : null);
      if (!state?.utils?.getEquipment) {
        console.warn('[equipment-database.js] state.utils.getEquipment not available yet');
        break;
      }
      const item = state.utils.getEquipment(i);
      if (item?.metadata?.name) {
        equipment.push({ gameId: i, ...item });
      }
    } catch (e) { break; }
  }
  return equipment;
}

let equipmentNameMapCache = null;

/** Cached lowercase name → { gameId, item } for O(1) equipment lookups. */
function getEquipmentNameMap() {
  if (equipmentNameMapCache) return equipmentNameMapCache;

  equipmentNameMapCache = new Map();
  const allEquipment = getAllEquipment();
  for (const item of allEquipment) {
    const name = item?.metadata?.name;
    if (name) {
      equipmentNameMapCache.set(name.toLowerCase(), { gameId: item.gameId, item });
    }
  }
  return equipmentNameMapCache;
}

// Function to build equipment lists from dynamic data
function buildEquipmentDatabase() {
  const allEquipment = getAllEquipment();
  
  // If no equipment was loaded, return empty database
  if (allEquipment.length === 0) {
    console.warn('[equipment-database.js] No equipment loaded, returning empty database');
    return {
      ALL_EQUIPMENT: [],
      EQUIPMENT_BY_STAT: {
        ad: [],
        ap: [],
        hp: [],
        armor: [],
        magicResist: []
      },
      HARDCODED_BOOSTED_MAP,
      getEquipmentNameMap
    };
  }
  
  // Extract just the names and sort alphabetically
  const allEquipmentNames = allEquipment
    .map(e => e.metadata.name)
    .sort((a, b) => a.localeCompare(b));
  
  // Group equipment by stat type for easier filtering
  const equipmentByStat = {
    ad: allEquipment.filter(e => e.stat === 'ad').map(e => e.metadata.name),
    ap: allEquipment.filter(e => e.stat === 'ap').map(e => e.metadata.name),
    hp: allEquipment.filter(e => e.stat === 'hp').map(e => e.metadata.name),
    armor: allEquipment.filter(e => e.stat === 'armor').map(e => e.metadata.name),
    magicResist: allEquipment.filter(e => e.stat === 'magicResist').map(e => e.metadata.name)
  };
  
  return {
    ALL_EQUIPMENT: allEquipmentNames,
    EQUIPMENT_BY_STAT: equipmentByStat,
    HARDCODED_BOOSTED_MAP,
    getEquipmentNameMap
  };
}

function waitForGameState(callback, retries = 0, maxRetries = 20) {
  try {
    const state = globalThis.state || window.state;
    const hasPlayerState = state?.player?.getSnapshot;
    const hasBoardState = state?.board?.getSnapshot;
    const hasUtils = state?.utils?.getEquipment;

    if (hasPlayerState && hasBoardState && hasUtils) {
      callback();
    } else if (retries < maxRetries) {
      setTimeout(() => waitForGameState(callback, retries + 1, maxRetries), 250);
    } else {
      console.warn('[equipment-database.js] Game state not ready after max retries, building database anyway');
      callback();
    }
  } catch (error) {
    console.error('[equipment-database.js] Error checking game state:', error);
    if (retries < maxRetries) {
      setTimeout(() => waitForGameState(callback, retries + 1, maxRetries), 250);
    } else {
      console.warn('[equipment-database.js] Building database despite errors');
      callback();
    }
  }
}

let equipmentDatabase = null;
let databaseInitialized = false;

function initializeDatabase() {
  if (databaseInitialized) return equipmentDatabase;

  equipmentNameMapCache = null;
  equipmentDatabase = buildEquipmentDatabase();
  equipmentDatabase.getEquipmentNameMap = getEquipmentNameMap;
  databaseInitialized = true;
  return equipmentDatabase;
}

const emptyEquipmentByStat = {
  ad: [],
  ap: [],
  hp: [],
  armor: [],
  magicResist: []
};

const placeholderDatabase = {
  ALL_EQUIPMENT: [],
  EQUIPMENT_BY_STAT: emptyEquipmentByStat,
  HARDCODED_BOOSTED_MAP,
  getEquipmentNameMap
};

const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow && !globalWindow.equipmentDatabase) {
  globalWindow.equipmentDatabase = placeholderDatabase;
}

waitForGameState(() => {
  initializeDatabase();

  if (globalWindow) {
    Object.assign(globalWindow.equipmentDatabase, equipmentDatabase);
    globalWindow.equipmentDatabase.ALL_EQUIPMENT = equipmentDatabase.ALL_EQUIPMENT;
    globalWindow.equipmentDatabase.EQUIPMENT_BY_STAT = equipmentDatabase.EQUIPMENT_BY_STAT;
    globalWindow.equipmentDatabase.HARDCODED_BOOSTED_MAP = equipmentDatabase.HARDCODED_BOOSTED_MAP;
    globalWindow.equipmentDatabase.getEquipmentNameMap = getEquipmentNameMap;

    console.log(`[equipment-database.js] Loaded ${equipmentDatabase.ALL_EQUIPMENT.length} equipment items dynamically (cached for all mods)`);
    console.log('[equipment-database.js] ALL_EQUIPMENT length:', equipmentDatabase.ALL_EQUIPMENT?.length);
    console.log('[equipment-database.js] Equipment by stat:', Object.keys(equipmentDatabase.EQUIPMENT_BY_STAT).map(stat => `${stat}: ${equipmentDatabase.EQUIPMENT_BY_STAT[stat].length}`).join(', '));
    console.log('[equipment-database.js] HARDCODED_BOOSTED_MAP entries:', Object.keys(equipmentDatabase.HARDCODED_BOOSTED_MAP || {}).length);
  }
  if (typeof module !== 'undefined') {
    module.exports = equipmentDatabase;
  }
});

