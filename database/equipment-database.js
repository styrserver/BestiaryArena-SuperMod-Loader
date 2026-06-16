console.log('[equipment-database.js] Loading equipment database...');

/**
 * Wiki / infobox: comma-separated boosted map names per equipment (string).
 * Omitted items are not boosted-map equipment. Empty string = listed, boosted maps TBD.
 * Shared by equipment-lua-export.js and Cyclopedia.
 */
const HARDCODED_BOOSTED_MAP = {
  'Amulet of Loss':
    'Carlin Sewers, Labyrinth Depths, Hidden City of Demona',
  'Ancient Amulet': 'Mother of Scarabs Lair',
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
  'Djinn Blade': 'Lonesome Dragon',
  'Ectoplasmic Shield': 'Hidden City of Demona',
  'Epee':
    "Evergreen Fields, Wolf's Den, Spider Lair, Minotaur Hell, Ghostlands Library, The Orc King Hall, Robson's Isle Ruins, Mother of Scarabs Lair",
  'Fire Axe':
    "Spider Lair, Amber's Raft, Ghostlands Library, Santa Claus Home, Femor Hills, Orcish Barracks, The Orc King Hall",
  'Giant Sword': 'Honeyflower Tower, Swampy Path, Carlin Sewers',
  'Glacial Rod':
    "Ghostlands Ritual Site, Banshee's Last Room, Teleporter Trap, Wyda's House",
  'Glass of Goo': "Amber's Raft, Awash Steamship",
  'Haunted Blade': 'Awash Steamship, Cave Entrance, Minotaur Hell',
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
  'Spellbook of Ancient Arcana':
    "Putrid Chamber, Pierre's Kitchen, Serpentine Tower Basement",
  'Springsprout Rod': 'Teleporter Trap, Folda Boat, Frozen Aquifer',
  'Stealth Ring': "Banshee's Last Room, Hedge Maze, Ab'Dendriel Hive",
  'Twin Axe': 'A Secluded Herb, Shore Camp',
  'Vampire Shield':
    "Spider Lair, Ghostlands Library, Maze Gates, Ab'Dendriel Hive",
  'Vile Axe': 'Cave Entrance, Dwarven Bridge, Minotaur Hell',
  'Wand of Decay':
    "Minotaur Hell, Ghostlands Ritual Site, Banshee's Last Room, Teleporter Trap, Folda Boat, Vega Mountain, Dwarven Brewery, Robson's Isle Ruins",
  'White Skull': 'Rotten Graveyard, Katana Quest'
};

/** Seasonal / event equipment — excluded from Cyclopedia BIS progress max. */
const EVENT_EQUIPMENT = [
  'Orclops Santa',
  'Witch Hat'
];

/**
 * Equipment forge tier stat bonuses (wiki _Tiers reference).
 * Numeric tier 1–5 maps to Grey → Yellow; T5 = max catalog effect values.
 */
const EQUIPMENT_TIER_STAT_BONUSES = {
  Grey: { hp: 20, ad: 1, ap: 2, cost: 50 },
  Green: { hp: 40, ad: 2, ap: 5, cost: 100 },
  Blue: { hp: 60, ad: 4, ap: 10, cost: 150 },
  Purple: { hp: 90, ad: 6, ap: 15, cost: 200 },
  Yellow: { hp: 120, ad: 8, ap: 20, cost: 0 }
};

const EQUIPMENT_TIER_COLOR_BY_NUMBER = ['Grey', 'Green', 'Blue', 'Purple', 'Yellow'];

/** Default tier for catalog/browse tooltips (max effect values). */
const DEFAULT_EQUIPMENT_EFFECT_TIER = 5;

function clampEquipmentTier(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(5, Math.max(1, parsed));
}

function getEquipmentTierColorLabel(tier) {
  const clamped = clampEquipmentTier(tier);
  if (clamped == null) return null;
  return EQUIPMENT_TIER_COLOR_BY_NUMBER[clamped - 1] || null;
}

function parseCooldownPercentFromText(text) {
  const raw = String(text || '');
  if (!raw) return null;

  const matches = [...raw.matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g)];
  if (!matches.length) return null;

  // Prefer the strongest percentage mention in the tooltip line/component.
  let best = null;
  for (const match of matches) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const normalized = Math.abs(value) / 100;
    if (best == null || normalized > best) best = normalized;
  }
  return best;
}

function readEquipmentCooldownReductionPercentFromItem(item, tier = DEFAULT_EQUIPMENT_EFFECT_TIER) {
  const effectComponent = item?.metadata?.EffectComponent;
  const createUIComponent = globalThis.state?.utils?.createUIComponent;
  if (!effectComponent || typeof createUIComponent !== 'function' || !document?.createElement) return null;

  const host = document.createElement('div');
  host.style.display = 'none';
  try {
    document.body?.appendChild(host);
    const clampedTier = clampEquipmentTier(tier) ?? DEFAULT_EQUIPMENT_EFFECT_TIER;
    const component = createUIComponent(host, effectComponent, { tier: clampedTier });
    if (component && typeof component.mount === 'function') component.mount();

    // Prefer explicit cooldown spans from game tooltips.
    for (const node of host.querySelectorAll('.text-cooldown')) {
      const parsed = parseCooldownPercentFromText(node.textContent);
      if (parsed != null) return parsed;
    }
    return parseCooldownPercentFromText(host.textContent);
  } catch {
    return null;
  } finally {
    try {
      host._reactRootContainer?.unmount?.();
    } catch { /* ignore */ }
    host.remove();
  }
}

function resolveEquipmentCatalogEntry(equipment) {
  if (!equipment || typeof equipment !== 'object') return null;
  const state = globalThis.state || window.state;
  const gameId = Number(equipment.gameId);
  if (Number.isFinite(gameId) && typeof state?.utils?.getEquipment === 'function') {
    try {
      const item = state.utils.getEquipment(gameId);
      if (item?.metadata) return { gameId, item };
    } catch { /* ignore */ }
  }

  const name = equipment.name ? String(equipment.name).toLowerCase() : '';
  if (!name) return null;
  return getEquipmentNameMap().get(name) || null;
}

function getEquipmentCdrPercentByGameIdMap() {
  const out = {};
  const allEquipment = getAllEquipment();
  for (const entry of allEquipment) {
    const gameId = Number(entry?.gameId);
    if (!Number.isFinite(gameId)) continue;
    const percent = readEquipmentCooldownReductionPercentFromItem(entry, DEFAULT_EQUIPMENT_EFFECT_TIER);
    if (percent == null || !Number.isFinite(percent) || percent <= 0) continue;
    out[gameId] = percent;
  }
  return out;
}

function getEquipmentCooldownReductionPercent(equipment) {
  if (!equipment || typeof equipment !== 'object') return 0;
  const resolved = resolveEquipmentCatalogEntry(equipment);
  if (!resolved?.item) return 0;
  const tier = clampEquipmentTier(equipment.tier ?? equipment.metadata?.tier) ?? DEFAULT_EQUIPMENT_EFFECT_TIER;
  const percent = readEquipmentCooldownReductionPercentFromItem(resolved.item, tier);
  if (percent == null || !Number.isFinite(percent) || percent <= 0) return 0;
  return percent;
}

/**
 * Mount equipment EffectComponent in a tooltip host with tier-scaled effect values.
 * Game API: createUIComponent(root, EffectComponent, { tier }).
 * @returns {object|null} mounted component, or null on failure
 */
function mountEquipmentEffectComponent(root, effectComponent, tier = DEFAULT_EQUIPMENT_EFFECT_TIER) {
  const createUIComponent = globalThis.state?.utils?.createUIComponent;
  if (!root || !effectComponent || typeof createUIComponent !== 'function') return null;

  const clamped = clampEquipmentTier(tier) ?? DEFAULT_EQUIPMENT_EFFECT_TIER;
  try {
    const component = createUIComponent(root, effectComponent, { tier: clamped });
    if (component && typeof component.mount === 'function') component.mount();
    return component || null;
  } catch {
    return null;
  }
}

function isEventEquipmentName(equipmentName) {
  const norm = String(equipmentName ?? '').trim().toLowerCase();
  if (!norm) return false;
  return EVENT_EQUIPMENT.some((name) => name.toLowerCase() === norm);
}

/** Equipment that counts toward BIS collection progress (catalog minus event items). */
function getBisProgressEquipmentNames(allEquipmentNames) {
  const base = Array.isArray(allEquipmentNames)
    ? allEquipmentNames
    : (equipmentDatabase?.ALL_EQUIPMENT || []);
  return base.filter((name) => !isEventEquipmentName(name));
}

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
      EVENT_EQUIPMENT,
      EQUIPMENT_TIER_STAT_BONUSES,
      EQUIPMENT_TIER_COLOR_BY_NUMBER,
      DEFAULT_EQUIPMENT_EFFECT_TIER,
      getEquipmentCdrPercentByGameIdMap,
      getEquipmentCooldownReductionPercent,
      isEventEquipmentName,
      getBisProgressEquipmentNames,
      getEquipmentNameMap,
      clampEquipmentTier,
      getEquipmentTierColorLabel,
      mountEquipmentEffectComponent
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
    EVENT_EQUIPMENT,
    EQUIPMENT_TIER_STAT_BONUSES,
    EQUIPMENT_TIER_COLOR_BY_NUMBER,
    DEFAULT_EQUIPMENT_EFFECT_TIER,
    getEquipmentCdrPercentByGameIdMap,
    getEquipmentCooldownReductionPercent,
    isEventEquipmentName,
    getBisProgressEquipmentNames,
    getEquipmentNameMap,
    clampEquipmentTier,
    getEquipmentTierColorLabel,
    mountEquipmentEffectComponent
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
  EVENT_EQUIPMENT,
  EQUIPMENT_TIER_STAT_BONUSES,
  EQUIPMENT_TIER_COLOR_BY_NUMBER,
  DEFAULT_EQUIPMENT_EFFECT_TIER,
  getEquipmentCdrPercentByGameIdMap,
  getEquipmentCooldownReductionPercent,
  isEventEquipmentName,
  getBisProgressEquipmentNames,
  getEquipmentNameMap,
  clampEquipmentTier,
  getEquipmentTierColorLabel,
  mountEquipmentEffectComponent
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
    globalWindow.equipmentDatabase.EVENT_EQUIPMENT = EVENT_EQUIPMENT;
    globalWindow.equipmentDatabase.EQUIPMENT_TIER_STAT_BONUSES = EQUIPMENT_TIER_STAT_BONUSES;
    globalWindow.equipmentDatabase.EQUIPMENT_TIER_COLOR_BY_NUMBER = EQUIPMENT_TIER_COLOR_BY_NUMBER;
    globalWindow.equipmentDatabase.DEFAULT_EQUIPMENT_EFFECT_TIER = DEFAULT_EQUIPMENT_EFFECT_TIER;
    globalWindow.equipmentDatabase.getEquipmentCdrPercentByGameIdMap = getEquipmentCdrPercentByGameIdMap;
    globalWindow.equipmentDatabase.getEquipmentCooldownReductionPercent = getEquipmentCooldownReductionPercent;
    globalWindow.equipmentDatabase.isEventEquipmentName = isEventEquipmentName;
    globalWindow.equipmentDatabase.getBisProgressEquipmentNames = getBisProgressEquipmentNames;
    globalWindow.equipmentDatabase.getEquipmentNameMap = getEquipmentNameMap;
    globalWindow.equipmentDatabase.clampEquipmentTier = clampEquipmentTier;
    globalWindow.equipmentDatabase.getEquipmentTierColorLabel = getEquipmentTierColorLabel;
    globalWindow.equipmentDatabase.mountEquipmentEffectComponent = mountEquipmentEffectComponent;

    console.log(`[equipment-database.js] Loaded ${equipmentDatabase.ALL_EQUIPMENT.length} equipment items dynamically (cached for all mods)`);
    console.log('[equipment-database.js] ALL_EQUIPMENT length:', equipmentDatabase.ALL_EQUIPMENT?.length);
    console.log('[equipment-database.js] Equipment by stat:', Object.keys(equipmentDatabase.EQUIPMENT_BY_STAT).map(stat => `${stat}: ${equipmentDatabase.EQUIPMENT_BY_STAT[stat].length}`).join(', '));
    console.log('[equipment-database.js] HARDCODED_BOOSTED_MAP entries:', Object.keys(equipmentDatabase.HARDCODED_BOOSTED_MAP || {}).length);
  }
  if (typeof module !== 'undefined') {
    module.exports = equipmentDatabase;
  }
});

