console.log('[creature-database.js] Loading creature database...');

/** Gazer species: only Mystic Gazer (97) has a shiny portrait; shiny displays as Albino Gazer in Cyclopedia. */
const MYSTIC_GAZER_GAME_ID = 97;
const GAZER_GAME_IDS_WITHOUT_SHINY = new Set([93, 94, 95, 96]);
const ALL_GAZER_GAME_IDS = new Set([93, 94, 95, 96, MYSTIC_GAZER_GAME_ID]);
const SHINY_ALIAS_CREATURES = [
  {
    displayName: 'Albino Gazer',
    gameId: MYSTIC_GAZER_GAME_ID,
    baseSpecies: 'Mystic Gazer',
    shinyOnly: true
  }
];
const CYCLOPEDIA_EXTRA_CREATURES = SHINY_ALIAS_CREATURES.map((entry) => entry.displayName);

function getShinyAliasByDisplayName(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return null;
  return SHINY_ALIAS_CREATURES.find((entry) => entry.displayName.toLowerCase() === norm) ?? null;
}

function resolveCreatureDisplay(creatureName) {
  const alias = getShinyAliasByDisplayName(creatureName);
  if (alias) {
    return {
      displayName: alias.displayName,
      gameId: alias.gameId,
      baseSpecies: alias.baseSpecies,
      forceShiny: true,
      shinyOnly: true,
      nonShinyOnly: false
    };
  }

  const monster = findMonsterByName(creatureName);
  const gameId = monster?.gameId ?? null;
  const speciesName = monster?.metadata?.name ?? String(creatureName ?? '').trim();

  return {
    displayName: speciesName,
    gameId,
    baseSpecies: speciesName,
    forceShiny: false,
    shinyOnly: false,
    // Mystic Gazer shiny copies are listed as Albino Gazer in Cyclopedia.
    nonShinyOnly: gameId === MYSTIC_GAZER_GAME_ID
  };
}

function filterMonstersForCreatureDisplay(creatureName, monsters) {
  const query = resolveCreatureDisplay(creatureName);
  if (query.gameId == null || !Array.isArray(monsters)) return [];
  let filtered = monsters.filter((m) => m && m.gameId === query.gameId);
  if (query.shinyOnly) {
    filtered = filtered.filter((m) => m.shiny === true);
  } else if (query.nonShinyOnly) {
    filtered = filtered.filter((m) => m.shiny !== true);
  }
  return filtered;
}

function creatureHasShinyVariant(creatureName) {
  const resolved = resolveCreatureDisplay(creatureName);
  if (!resolved?.gameId) return true;
  if (resolved.shinyOnly) return false;
  if (GAZER_GAME_IDS_WITHOUT_SHINY.has(resolved.gameId)) return false;
  if (resolved.gameId === MYSTIC_GAZER_GAME_ID) return false;
  return true;
}

/** Creatures hidden from Cyclopedia lists only (still in game data). */
const CYCLOPEDIA_HIDDEN_CREATURES = ['Tentugly', 'Dwarf Henchman'];

/** Hardcoded stats for unobtainable creatures that differ on maps. Keys are lowercase names. */
const HARDCODED_MAP_MONSTER_STATS = {
  'old giant spider': { baseStats: { hp: 1140, ad: 108, ap: 30, armor: 30, magicResist: 30 }, level: 300 },
  'willi wasp': { baseStats: { hp: 924, ad: 0, ap: 0, armor: 26, magicResist: 45 }, level: 100 },
  'black knight': { baseStats: { hp: 4800, ad: 66, ap: 0, armor: 975, magicResist: 975 }, level: 300 },
  'dharalion': { baseStats: { hp: 2200, ad: 33, ap: 25, armor: 60, magicResist: 66 }, level: 200 },
  'dead tree': { baseStats: { hp: 7000, ad: 0, ap: 0, armor: 700, magicResist: 700 }, level: 100 },
  'earth crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
  'energy crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 150, magicResist: 30 }, level: 50 },
  'magma crystal': { baseStats: { hp: 350, ad: 0, ap: 0, armor: 350, magicResist: 350 }, level: 50 },
  'regeneration tank': { baseStats: { hp: 8352, ad: 0, ap: 0, armor: 126, magicResist: 696 }, level: 99 },
  'monster cauldron': { baseStats: { hp: 1114, ad: 92, ap: 112, armor: 45, magicResist: 42 }, level: 99 },
  'grynch clan mastermind': { baseStats: { hp: 220, ad: 0, ap: 0, armor: 66, magicResist: 66 }, level: 200 }
};

/** Stat bar display config for creature wiki templates. */
const MONSTER_STAT_DISPLAY_CONFIG = [
  { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 1000, barColor: 'rgb(96, 192, 96)' },
  { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 110, barColor: 'rgb(255, 128, 96)' },
  { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 90, barColor: 'rgb(128, 128, 255)' },
  { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 60, barColor: 'rgb(224, 224, 128)' },
  { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 60, barColor: 'rgb(192, 128, 255)' },
  { key: 'speed', label: 'Speed', icon: '/assets/icons/speed.png', max: 200, barColor: 'rgb(255, 200, 100)' }
];

function getCyclopediaCreatureNames(obtainableCreatures) {
  const base = Array.isArray(obtainableCreatures) ? obtainableCreatures : [];
  const filtered = base.filter((name) => !CYCLOPEDIA_HIDDEN_CREATURES.includes(name));
  return [...new Set([...filtered, ...CYCLOPEDIA_EXTRA_CREATURES])].sort((a, b) => a.localeCompare(b));
}

/** Same list as Cyclopedia bestiary — use for creature pickers across mods. */
function getCreaturePickerNames(obtainableCreatures) {
  if (Array.isArray(obtainableCreatures)) {
    return getCyclopediaCreatureNames(obtainableCreatures);
  }
  return getCyclopediaCreatureNames(creatureDatabase?.ALL_CREATURES || []);
}

/** Seasonal / event creatures — cannot awaken (see NON_AWAKENABLE). */
const EVENT_CREATURES = [
  'Dwarf Merrymancer',
  'Goblin Gumslinger',
  'Goblin Saboteur',
  'Gummy Raider',
  'Reindeer',
  'Unionized Goblin'
];

function isEventCreatureName(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return false;
  return EVENT_CREATURES.some((name) => name.toLowerCase() === norm);
}

/** True for any gazer species or Albino Gazer (shiny Mystic). */
function isGazerCreatureName(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return false;
  if (norm.includes('gazer')) return true;
  const alias = getShinyAliasByDisplayName(creatureName);
  if (alias) return true;
  const monster = findMonsterByName(creatureName);
  return monster?.gameId != null && ALL_GAZER_GAME_IDS.has(Number(monster.gameId));
}

/** Creature pickers for Autoscroller / Autoseller (no gazers or event creatures). */
function getAutoscrollAutosellerCreaturePickerNames(obtainableCreatures) {
  return getCreaturePickerNames(obtainableCreatures).filter(
    (name) => !isGazerCreatureName(name) && !isEventCreatureName(name)
  );
}

/** Display name for an owned monster (shiny Mystic Gazer → Albino Gazer). */
function getDisplayNameForOwnedMonster(monster) {
  if (!monster || monster.gameId == null) return null;
  if (Number(monster.gameId) === MYSTIC_GAZER_GAME_ID) {
    return monster.shiny === true ? 'Albino Gazer' : 'Mystic Gazer';
  }
  const data = findMonsterByGameId(monster.gameId);
  return data?.metadata?.name ?? null;
}

/** Whether an inventory monster belongs to a Cyclopedia/display creature name. */
function monsterMatchesCreatureDisplay(displayName, monster) {
  const query = resolveCreatureDisplay(displayName);
  if (query.gameId == null || !monster) return false;
  if (Number(monster.gameId) !== Number(query.gameId)) return false;
  if (query.shinyOnly) return monster.shiny === true;
  if (query.nonShinyOnly) return monster.shiny !== true;
  return true;
}

// Creature database with shiny portrait support
function getAllMonsters() {
  const monsters = [];
  for (let i = 1; i < 1000; i++) {
    try {
      const state = globalThis.state || window.state || (typeof state !== 'undefined' ? state : null);
      if (!state?.utils?.getMonster) {
        console.warn('[creature-database.js] state.utils.getMonster not available yet');
        break;
      }
      const monster = state.utils.getMonster(i);
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
        UNOBTAINABLE_CREATURES: [],
        NON_AWAKENABLE_CREATURES: [],
        CYCLOPEDIA_EXTRA_CREATURES,
        getCyclopediaCreatureNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
        resolveCreatureDisplay,
        creatureHasShinyVariant,
        filterMonstersForCreatureDisplay,
        getCreaturePickerNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
        getAutoscrollAutosellerCreaturePickerNames: () => [],
        EVENT_CREATURES,
        isEventCreatureName,
        isGazerCreatureName,
        getDisplayNameForOwnedMonster,
        monsterMatchesCreatureDisplay
      };
    }
    
    const allCreatureNames = allMonsters.map(m => m.metadata.name);
    const hardcodedUnobtainable = ['Black Knight', 'Beer Barrel', 'Dharalion', 'Dead Tree', 'Dwarf Henchman', 'Earth Crystal', 'Energy Crystal', 'Grynch Clan Commander', 'Grynch Clan Mastermind', 'Lavahole', 'Magma Crystal', 'Monster Cauldron', 'Old Giant Spider', 'Orc', 'Regeneration Tank', 'Sweaty Cyclops', 'Tentugly', 'Willi Wasp', 'The Percht Queen'];
    const hardcodedNonAwakenable = [...EVENT_CREATURES];
    
    const unobtainableFromMonsters = allMonsters
      .filter(m => hardcodedUnobtainable.includes(m.metadata.name))
      .map(m => m.metadata.name);
    
    const unobtainableCreatures = [...new Set([...hardcodedUnobtainable, ...unobtainableFromMonsters])]
      .sort((a, b) => a.localeCompare(b));
    
    const nonAwakenableCreatures = [...new Set([
      ...hardcodedNonAwakenable,
      ...allMonsters
        .filter(m => m.metadata.name.toLowerCase().includes('gazer'))
        .map(m => m.metadata.name),
      ...CYCLOPEDIA_EXTRA_CREATURES
    ])].sort((a, b) => a.localeCompare(b));

    const obtainableCreatures = allCreatureNames
      .filter(name => !hardcodedUnobtainable.includes(name))
      .sort((a, b) => a.localeCompare(b));
    
    return {
      ALL_CREATURES: obtainableCreatures,
      UNOBTAINABLE_CREATURES: unobtainableCreatures,
      NON_AWAKENABLE_CREATURES: nonAwakenableCreatures,
      CYCLOPEDIA_EXTRA_CREATURES,
      MYSTIC_GAZER_GAME_ID,
      SHINY_ALIAS_CREATURES,
      getCyclopediaCreatureNames: () => getCyclopediaCreatureNames(obtainableCreatures),
      getCreaturePickerNames: () => getCyclopediaCreatureNames(obtainableCreatures),
      getAutoscrollAutosellerCreaturePickerNames: () => getAutoscrollAutosellerCreaturePickerNames(obtainableCreatures),
      EVENT_CREATURES,
      isEventCreatureName,
      isGazerCreatureName,
      resolveCreatureDisplay,
      creatureHasShinyVariant,
      filterMonstersForCreatureDisplay,
      getDisplayNameForOwnedMonster,
      monsterMatchesCreatureDisplay
    };
  } catch (error) {
    console.error('[creature-database.js] Error building database:', error);
    return {
      ALL_CREATURES: [],
      UNOBTAINABLE_CREATURES: [],
      NON_AWAKENABLE_CREATURES: [],
      CYCLOPEDIA_EXTRA_CREATURES,
      getCyclopediaCreatureNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
      resolveCreatureDisplay,
      creatureHasShinyVariant,
      filterMonstersForCreatureDisplay,
      getCreaturePickerNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
      getAutoscrollAutosellerCreaturePickerNames: () => [],
      EVENT_CREATURES,
      isEventCreatureName,
      isGazerCreatureName,
      getDisplayNameForOwnedMonster,
      monsterMatchesCreatureDisplay
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
  const id = Number(gameId);
  const map = getMonsterNameMap();
  for (const entry of map.values()) {
    const entryId = entry.gameId ?? entry.index;
    if (entryId === id && entry.monster) {
      return { gameId: entryId, ...entry.monster };
    }
  }
  return findMonsterByGameIdUncached(gameId);
}

function findMonsterByGameIdUncached(gameId) {
  const allMonsters = getAllMonsters();
  return allMonsters.find((monster) => monster.gameId === gameId);
}

let monsterNameMapCache = null;

/** Cached lowercase name → { monster, gameId, index } for O(1) lookups. */
function getMonsterNameMap() {
  if (monsterNameMapCache) return monsterNameMapCache;

  monsterNameMapCache = new Map();
  const state = globalThis.state || window.state;
  if (!state?.utils?.getMonster) return monsterNameMapCache;

  const maxSearchId = 1000;
  const maxConsecutiveFailures = 10;
  let maxId = 200;
  let consecutiveFailures = 0;

  try {
    for (let i = 1; i < maxSearchId; i++) {
      try {
        const monster = state.utils.getMonster(i);
        if (!monster?.metadata?.name) {
          if (++consecutiveFailures >= maxConsecutiveFailures) {
            maxId = Math.max(1, i - maxConsecutiveFailures);
            break;
          }
        } else {
          consecutiveFailures = 0;
          maxId = i;
        }
      } catch (error) {
        if (++consecutiveFailures >= maxConsecutiveFailures) {
          maxId = Math.max(1, i - maxConsecutiveFailures);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[creature-database.js] Error probing monster ids:', error);
  }

  for (let i = 1; i <= maxId; i++) {
    try {
      const monster = state.utils.getMonster(i);
      if (monster?.metadata?.name) {
        monsterNameMapCache.set(monster.metadata.name.toLowerCase(), { monster, gameId: i, index: i });
      }
    } catch (error) { /* skip */ }
  }

  return monsterNameMapCache;
}

function findMonsterByName(name) {
  const alias = getShinyAliasByDisplayName(name);
  if (alias) {
    return findMonsterByGameId(alias.gameId);
  }
  const entry = getMonsterNameMap().get(String(name).toLowerCase());
  if (entry?.monster) {
    return { gameId: entry.gameId ?? entry.index, ...entry.monster };
  }
  const allMonsters = getAllMonsters();
  return allMonsters.find((monster) =>
    monster.metadata?.name?.toLowerCase() === String(name).toLowerCase()
  );
}

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
  
  creatureDatabase.getMonsterPortraitUrl = getMonsterPortraitUrl;
  creatureDatabase.getMonsterPortraitUrls = getMonsterPortraitUrls;
  creatureDatabase.findMonsterByGameId = findMonsterByGameId;
  creatureDatabase.findMonsterByName = findMonsterByName;
  creatureDatabase.getAllMonstersWithPortraits = getAllMonsters;
  creatureDatabase.getCyclopediaCreatureNames = creatureDatabase.getCyclopediaCreatureNames || (() => getCyclopediaCreatureNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.resolveCreatureDisplay = resolveCreatureDisplay;
  creatureDatabase.creatureHasShinyVariant = creatureHasShinyVariant;
  creatureDatabase.filterMonstersForCreatureDisplay = filterMonstersForCreatureDisplay;
  creatureDatabase.getCreaturePickerNames = creatureDatabase.getCreaturePickerNames || (() => getCyclopediaCreatureNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.getAutoscrollAutosellerCreaturePickerNames = creatureDatabase.getAutoscrollAutosellerCreaturePickerNames || (() => getAutoscrollAutosellerCreaturePickerNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.EVENT_CREATURES = EVENT_CREATURES;
  creatureDatabase.isEventCreatureName = isEventCreatureName;
  creatureDatabase.isGazerCreatureName = isGazerCreatureName;
  creatureDatabase.getDisplayNameForOwnedMonster = getDisplayNameForOwnedMonster;
  creatureDatabase.monsterMatchesCreatureDisplay = monsterMatchesCreatureDisplay;
  creatureDatabase.CYCLOPEDIA_EXTRA_CREATURES = CYCLOPEDIA_EXTRA_CREATURES;
  creatureDatabase.CYCLOPEDIA_HIDDEN_CREATURES = CYCLOPEDIA_HIDDEN_CREATURES;
  creatureDatabase.HARDCODED_MAP_MONSTER_STATS = HARDCODED_MAP_MONSTER_STATS;
  creatureDatabase.MONSTER_STAT_DISPLAY_CONFIG = MONSTER_STAT_DISPLAY_CONFIG;
  creatureDatabase.getMonsterNameMap = getMonsterNameMap;
  
  databaseInitialized = true;
  return creatureDatabase;
}

const placeholderDatabase = {
  ALL_CREATURES: [],
  UNOBTAINABLE_CREATURES: [],
  NON_AWAKENABLE_CREATURES: [],
  CYCLOPEDIA_EXTRA_CREATURES,
  CYCLOPEDIA_HIDDEN_CREATURES,
  HARDCODED_MAP_MONSTER_STATS,
  MONSTER_STAT_DISPLAY_CONFIG,
  MYSTIC_GAZER_GAME_ID,
  SHINY_ALIAS_CREATURES,
  getCyclopediaCreatureNames: () => getCyclopediaCreatureNames([]),
  getMonsterNameMap,
  resolveCreatureDisplay,
  creatureHasShinyVariant,
  filterMonstersForCreatureDisplay,
  getCreaturePickerNames: () => getCyclopediaCreatureNames([]),
  getAutoscrollAutosellerCreaturePickerNames: () => [],
  EVENT_CREATURES,
  isEventCreatureName,
  isGazerCreatureName,
  getDisplayNameForOwnedMonster,
  monsterMatchesCreatureDisplay,
  CYCLOPEDIA_HIDDEN_CREATURES,
  HARDCODED_MAP_MONSTER_STATS,
  MONSTER_STAT_DISPLAY_CONFIG,
  getMonsterNameMap,
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
    globalWindow.creatureDatabase.NON_AWAKENABLE_CREATURES = creatureDatabase.NON_AWAKENABLE_CREATURES;
    globalWindow.creatureDatabase.CYCLOPEDIA_EXTRA_CREATURES = creatureDatabase.CYCLOPEDIA_EXTRA_CREATURES;
    globalWindow.creatureDatabase.getCyclopediaCreatureNames = creatureDatabase.getCyclopediaCreatureNames;
    globalWindow.creatureDatabase.resolveCreatureDisplay = resolveCreatureDisplay;
    globalWindow.creatureDatabase.creatureHasShinyVariant = creatureHasShinyVariant;
    globalWindow.creatureDatabase.filterMonstersForCreatureDisplay = filterMonstersForCreatureDisplay;
    globalWindow.creatureDatabase.getCreaturePickerNames = creatureDatabase.getCreaturePickerNames;
    globalWindow.creatureDatabase.getAutoscrollAutosellerCreaturePickerNames = creatureDatabase.getAutoscrollAutosellerCreaturePickerNames;
    globalWindow.creatureDatabase.EVENT_CREATURES = EVENT_CREATURES;
    globalWindow.creatureDatabase.isEventCreatureName = isEventCreatureName;
    globalWindow.creatureDatabase.isGazerCreatureName = isGazerCreatureName;
    globalWindow.creatureDatabase.getDisplayNameForOwnedMonster = getDisplayNameForOwnedMonster;
    globalWindow.creatureDatabase.monsterMatchesCreatureDisplay = monsterMatchesCreatureDisplay;
    globalWindow.creatureDatabase.CYCLOPEDIA_HIDDEN_CREATURES = CYCLOPEDIA_HIDDEN_CREATURES;
    globalWindow.creatureDatabase.HARDCODED_MAP_MONSTER_STATS = HARDCODED_MAP_MONSTER_STATS;
    globalWindow.creatureDatabase.MONSTER_STAT_DISPLAY_CONFIG = MONSTER_STAT_DISPLAY_CONFIG;
    globalWindow.creatureDatabase.getMonsterNameMap = getMonsterNameMap;
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

