console.log('[maps-database.js] Loading maps database...');

/**
 * Maps Database
 * 
 * Usage Examples:
 * 
 * // Get all maps
 * const allMaps = mapsDatabase.getAllMaps();
 * 
 * // Get only raid maps
 * const raids = mapsDatabase.getRaidMaps();
 * 
 * // Get non-raid maps
 * const normalMaps = mapsDatabase.getNonRaidMaps();
 * 
 * // Find a specific map by ID
 * const centipede = mapsDatabase.getMapById('rkcent');
 * 
 * // Get maps by difficulty
 * const difficulty3Maps = mapsDatabase.getMapsByDifficulty(3);
 * 
 * // Get maps by team size
 * const soloMaps = mapsDatabase.getMapsByMaxTeamSize(1);
 */

// Function to dynamically fetch all maps
function getAllMaps() {
  try {
    const state = globalThis.state || window.state;
    if (!state?.utils?.ROOMS) {
      console.warn('[maps-database.js] state.utils.ROOMS not available yet');
      return [];
    }
    return state.utils.ROOMS;
  } catch (e) {
    console.error('[maps-database.js] Error fetching maps:', e);
    return [];
  }
}

// Function to build maps database
function buildMapsDatabase() {
  const allMaps = getAllMaps();
  
  if (allMaps.length === 0) {
    console.warn('[maps-database.js] No maps loaded, returning empty database');
    return {
      ALL_MAPS: [],
      RAID_MAPS: [],
      NON_RAID_MAPS: [],
      MAPS_BY_DIFFICULTY: { 1: [], 2: [], 3: [] }
    };
  }
  
  // Separate raid and non-raid maps
  const raidMaps = allMaps.filter(map => map.raid === true);
  const nonRaidMaps = allMaps.filter(map => !map.raid);
  
  // Group maps by difficulty
  const mapsByDifficulty = {
    1: allMaps.filter(map => map.difficulty === 1),
    2: allMaps.filter(map => map.difficulty === 2),
    3: allMaps.filter(map => map.difficulty === 3)
  };
  
  return {
    ALL_MAPS: allMaps,
    RAID_MAPS: raidMaps,
    NON_RAID_MAPS: nonRaidMaps,
    MAPS_BY_DIFFICULTY: mapsByDifficulty
  };
}

/**
 * Get a map by its ID
 * @param {string} mapId - The map ID to search for
 * @returns {Object|null} The map object or null if not found
 */
function getMapById(mapId) {
  const allMaps = getAllMaps();
  return allMaps.find(map => map.id === mapId) || null;
}

/**
 * Get maps by difficulty level
 * @param {number} difficulty - The difficulty level (1, 2, or 3)
 * @returns {Array} Array of maps with the specified difficulty
 */
function getMapsByDifficulty(difficulty) {
  const allMaps = getAllMaps();
  return allMaps.filter(map => map.difficulty === difficulty);
}

/**
 * Get maps by maximum team size.
 * NOTE: multi-floor quest rooms (type: 'multi', e.g. The Annihilator Quest) have no
 * top-level maxTeamSize — it varies per floor in room.floorRules[floorIndex] instead —
 * so they never match here and are silently excluded, not misreported.
 * @param {number} teamSize - The maximum team size
 * @returns {Array} Array of maps with the specified max team size
 */
function getMapsByMaxTeamSize(teamSize) {
  const allMaps = getAllMaps();
  return allMaps.filter(map => map.maxTeamSize === teamSize);
}

/**
 * Room ids for multi-floor quest rooms (type: 'multi', e.g. The Annihilator Quest, The
 * Behemoth Quest) — rooms whose data lives per-floor in floorFiles/floorRules instead of
 * a flat file/maxTeamSize/staminaCost. Authoritative live scan of state.utils.ROOMS,
 * not a hardcoded list, since new ones could ship later.
 * @returns {string[]} room ids
 */
function getMultiFloorRoomIds() {
  try {
    const rooms = globalThis.state?.utils?.ROOMS;
    if (!Array.isArray(rooms)) return [];
    return rooms.filter(r => r?.type === 'multi').map(r => r.id);
  } catch (_) {
    return [];
  }
}

/**
 * Get maps by stamina cost
 * @param {number} staminaCost - The stamina cost
 * @returns {Array} Array of maps with the specified stamina cost
 */
function getMapsByStaminaCost(staminaCost) {
  const allMaps = getAllMaps();
  return allMaps.filter(map => map.staminaCost === staminaCost);
}

/**
 * Get only raid maps
 * @returns {Array} Array of raid maps
 */
function getRaidMaps() {
  const allMaps = getAllMaps();
  return allMaps.filter(map => map.raid === true);
}

/**
 * Get only non-raid maps
 * @returns {Array} Array of non-raid maps
 */
function getNonRaidMaps() {
  const allMaps = getAllMaps();
  return allMaps.filter(map => !map.raid);
}

/**
 * Check if a map is a raid
 * @param {string} mapId - The map ID to check
 * @returns {boolean} True if the map is a raid, false otherwise
 */
function isRaid(mapId) {
  const map = getMapById(mapId);
  return map ? map.raid === true : false;
}

function titleCaseRegionId(regionId) {
  const raw = String(regionId ?? '').trim();
  if (!raw) return 'Unknown Region';
  return raw.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Resolve a region id to its display name.
 * Priority: state.utils.REGIONS[].name → title case.
 * Note: state.utils has no REGION_NAME map (verified against a live dump) —
 * REGIONS is the only source for region display names.
 * @param {string} regionId
 * @returns {string}
 */
function getRegionDisplayName(regionId) {
  if (regionId == null || regionId === '') return 'Unknown Region';
  const key = String(regionId).toLowerCase();

  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (Array.isArray(regions)) {
      const region = regions.find(
        (r) => r?.id === regionId || String(r?.id ?? '').toLowerCase() === key
      );
      if (region?.name) return region.name;
    }
  } catch (_) { /* ignore */ }

  return titleCaseRegionId(regionId);
}

/**
 * Resolve display name from a region object (state.utils.REGIONS entry).
 * @param {{ id?: string, name?: string }|null|undefined} region
 * @returns {string}
 */
function getRegionDisplayNameFromRegion(region) {
  if (!region) return 'Unknown Region';
  if (region.id) return getRegionDisplayName(region.id);
  if (region.name) return region.name;
  return 'Unknown Region';
}

/**
 * A region's themed rune (e.g. Carlin -> "Ability Power Rune"), derived from
 * inventory-database.js's `obtain` field — NOT duplicated here. Each region rune's
 * `obtain` is set to exactly that region's display name (single source, no list to
 * keep in sync); every other item's `obtain` is a multi-source description ("Loot,
 * Surprise Cube", "Obtained from Blank Rune", ...) that never matches a bare region
 * name, so the exact-equality check below naturally excludes everything but the six
 * themed runes without needing an explicit allowlist.
 * @param {string} regionId
 * @returns {string|null} Rune display name, or null if this region has none documented.
 */
function getRegionRune(regionId) {
  try {
    const tooltips = (globalThis.window || window)?.inventoryDatabase?.tooltips;
    if (!tooltips) return null;
    const regionName = getRegionDisplayName(regionId);
    for (const entry of Object.values(tooltips)) {
      if (entry?.displayName?.endsWith('Rune') && entry.obtain === regionName) {
        return entry.displayName;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Comprehensive raid check (ROOMS, REGIONS scan, active raids list).
 * @param {string} mapId
 * @returns {boolean}
 */
function isMapRaidComprehensive(mapId) {
  if (!mapId) return false;

  try {
    // ROOMS is a plain array, not keyed by id — ROOMS?.[mapId] never resolves for a
    // string id (getMapById below is the correct, already-array-aware lookup).
    const roomData = getMapById(mapId);
    if (roomData?.raid === true) return true;

    const regions = globalThis.state?.utils?.REGIONS;
    if (regions && Array.isArray(regions)) {
      for (const region of regions) {
        if (region.rooms && Array.isArray(region.rooms)) {
          const room = region.rooms.find((r) => r.id === mapId);
          if (room && room.raid === true) return true;
        }
      }
    }

    const raidState = globalThis.state?.raids?.getSnapshot?.();
    const activeRaids = raidState?.context?.list || [];
    if (activeRaids.some((raid) => raid.roomId === mapId)) return true;
  } catch (error) {
    console.warn('[maps-database.js] Error checking if map is raid:', error);
  }

  return false;
}

/** Difficulty id -> wiki display label. Single source — maps-lua-export.js and
 * regions-lua-export.js both call this instead of keeping their own copy. */
const DIFFICULTY_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

function getDifficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] || `Difficulty ${difficulty}`;
}

/**
 * "raid" | "event" | false — single source for the wiki's Raids/Events section split
 * (matches EVENT_TO_ROOM_MAPPING above: a raid room not in that static list is a
 * dynamic/seasonal event).
 * @param {string} mapId
 * @returns {'raid'|'event'|false}
 */
function getMapType(mapId) {
  if (!isMapRaidComprehensive(mapId)) return false;
  return isDynamicEventMap(mapId) ? 'event' : 'raid';
}

// Static event-name to room-id mapping for backward compatibility fallbacks.
// This is the single source of truth for static raid events.
const EVENT_TO_ROOM_MAPPING = {
  'Rat Plague': 'rkcent',
  'Buzzing Madness': 'crwasp',
  'Monastery Catacombs': 'crcat',
  'Ghostlands Boneyard': 'crghst4',
  'Permafrosted Hole': 'fhole',
  'Jammed Mailbox': 'fbox',
  'Frosted Bunker': 'fscave',
  'Hedge Maze Trap': 'abmazet',
  'Tower of Whitewatch (Shield)': 'aborca',
  'Tower of Whitewatch (Helmet)': 'aborcb',
  'Tower of Whitewatch (Armor)': 'aborcc',
  'Orcish Barricade': 'ofbar',
  'Poacher Cave (Bear)': 'kpob',
  'Poacher Cave (Wolf)': 'kpow',
  'Dwarven Bank Heist': 'vbank',
  'An Arcanist Ritual': 'vdhar',
  'Botham II': 'ankuh',
  'Esuph IV': 'anksqr'
};

/**
 * Static store/achievement expansion -> map-name mapping. Not derivable from
 * state.utils.ROOMS/REGIONS at all (no "expansion" field exists anywhere in game
 * state) — this is the single source of truth, sourced from the wiki's own
 * Category:Expansions pages. Keyed by expansion display name (matches the wiki
 * page title, so `[[<key>]]` always links correctly).
 *
 * Map ids are intentionally NOT hardcoded here (unlike EVENT_TO_ROOM_MAPPING above) —
 * they weren't verified against a live session when this table was written. Room ids
 * are resolved from `mapNames` at call time via state.utils.ROOM_NAME (see
 * getExpansionMapIds). If a resolution ever comes up short, hardcode the id directly
 * as a same-shape `{ id: 'roomId' }` alternative to the name string for that entry.
 */
const MAP_EXPANSIONS = {
  'Maze of the Lost Souls': {
    unlockType: 'store',
    mapNames: ['Maze Gates', 'Labyrinth Depths', 'Hidden City of Demona', 'Teleporter Trap']
  },
  'Orc Fortress Expansion': {
    unlockType: 'achievement',
    achievement: 'War at Ulderek\'s Rock',
    mapNames: ['A Shamanic Ritual', 'Shore Camp', 'Orcsmith Orcshop']
  },
  'Pharaoh\'s Sarcophagus': {
    unlockType: 'store',
    mapNames: ['Omruc\'s Hide and Sneak', 'Mirror Arena', 'Two on Two', 'Putrid Chamber']
  },
  'Robson\'s Isle': {
    unlockType: 'achievement',
    achievement: 'Technomancer\'s Beard',
    mapNames: ['Awash Steamship', 'Robson\'s Isle Ruins']
  },
  'Rookgaard Expansion': {
    unlockType: 'store',
    mapNames: ['Bear Room', 'Minotaur Hell', 'Amber\'s Raft', 'Swampy Path', 'Lonesome Dragon']
  },
  'Villains Hideout': {
    unlockType: 'store',
    cost: '40,000 gold',
    mapNames: ['Vega Stronghold', 'Eclipse']
  }
};

/**
 * Reverse-lookup a room id from its display name (state.utils.ROOM_NAME).
 * @param {string} mapName
 * @returns {string|null}
 */
function getMapIdByDisplayName(mapName) {
  try {
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    if (!roomNames) return null;
    for (const id of Object.keys(roomNames)) {
      if (roomNames[id] === mapName) return id;
    }
  } catch (_) {}
  return null;
}

/**
 * Resolve an expansion's map names to live room ids. Names that don't currently
 * resolve (renamed map, ROOM_NAME not loaded yet, etc.) are skipped, not nulled,
 * so callers don't have to filter.
 * @param {string} expansionName
 * @returns {string[]}
 */
function getExpansionMapIds(expansionName) {
  const expansion = MAP_EXPANSIONS[expansionName];
  if (!expansion) return [];
  return expansion.mapNames
    .map((name) => getMapIdByDisplayName(name))
    .filter(Boolean);
}

/**
 * Which expansion (if any) a given room id belongs to.
 * @param {string} mapId
 * @returns {string|null} Expansion display name, or null.
 */
function getExpansionNameForMapId(mapId) {
  if (!mapId) return null;
  for (const expansionName of Object.keys(MAP_EXPANSIONS)) {
    if (getExpansionMapIds(expansionName).includes(mapId)) return expansionName;
  }
  return null;
}

/**
 * Which expansion (if any) a region's rooms belong to, resolved by checking
 * whether any of that expansion's maps live in this region.
 * @param {string} regionId
 * @returns {{ name: string, mapIds: string[] }|null}
 */
function getExpansionForRegion(regionId) {
  if (!regionId) return null;
  const regions = globalThis.state?.utils?.REGIONS;
  if (!Array.isArray(regions)) return null;
  const region = regions.find((r) => r?.id === regionId);
  const regionRoomIds = new Set(
    Array.isArray(region?.rooms) ? region.rooms.map((r) => r?.id).filter(Boolean) : []
  );
  if (!regionRoomIds.size) return null;

  for (const expansionName of Object.keys(MAP_EXPANSIONS)) {
    const mapIds = getExpansionMapIds(expansionName).filter((id) => regionRoomIds.has(id));
    if (mapIds.length) return { name: expansionName, mapIds };
  }
  return null;
}

/**
 * Check if a map is a dynamic event map.
 * Dynamic event maps are raids not present in the static raid list.
 * @param {string} mapId - The map ID to check
 * @returns {boolean} True if the map is a dynamic event map
 */
function isDynamicEventMap(mapId) {
  if (!mapId) return false;
  if (!isRaid(mapId)) return false;

  const state = globalThis.state || window.state;
  const mapName = state?.utils?.ROOM_NAME?.[mapId];
  if (!mapName) return false;

  return !Object.prototype.hasOwnProperty.call(EVENT_TO_ROOM_MAPPING, mapName);
}

const MAP_ORDER_UNKNOWN = Number.MAX_SAFE_INTEGER;

/**
 * Canonical in-game map order: regions via getRegionsInOrder(), then each region's rooms array.
 * Maps missing from REGIONS are appended in getAllMaps() order.
 * @returns {Map<string, number>} mapId → ascending sort index
 */
function buildMapOrderIndex() {
  const index = new Map();
  const state = globalThis.state || window.state;
  const regions = state?.utils?.REGIONS;

  if (Array.isArray(regions)) {
    const regionById = new Map();
    for (const region of regions) {
      if (region?.id) regionById.set(region.id, region);
    }

    const orderedRegionIds = [];
    const seenRegionIds = new Set();
    for (const region of getRegionsInOrder()) {
      const id = region?.id;
      if (!id || seenRegionIds.has(id)) continue;
      seenRegionIds.add(id);
      orderedRegionIds.push(id);
    }
    for (const region of regions) {
      const id = region?.id;
      if (!id || seenRegionIds.has(id)) continue;
      seenRegionIds.add(id);
      orderedRegionIds.push(id);
    }

    let order = 0;
    for (const regionId of orderedRegionIds) {
      const rooms = regionById.get(regionId)?.rooms;
      if (!Array.isArray(rooms)) continue;
      for (const room of rooms) {
        const mapId = room?.id;
        if (!mapId || index.has(mapId)) continue;
        index.set(mapId, order++);
      }
    }
  }

  const allMaps = getAllMaps();
  const roomList = Array.isArray(allMaps) ? allMaps : Object.values(allMaps || {});
  let order = index.size;
  for (const room of roomList) {
    const mapId = room?.id;
    if (!mapId || index.has(mapId)) continue;
    index.set(mapId, order++);
  }

  return index;
}

/**
 * Sort index for a map in canonical game order (lower = earlier).
 * @param {string} mapId
 * @returns {number}
 */
function getMapOrderIndex(mapId) {
  if (mapId == null || mapId === '') return MAP_ORDER_UNKNOWN;
  const index = buildMapOrderIndex();
  return index.has(mapId) ? index.get(mapId) : MAP_ORDER_UNKNOWN;
}

/**
 * Comparator helper for sorting map ids by canonical game order.
 * @param {string} mapIdA
 * @param {string} mapIdB
 * @returns {number}
 */
function compareMapsByGameOrder(mapIdA, mapIdB) {
  const orderA = getMapOrderIndex(mapIdA);
  const orderB = getMapOrderIndex(mapIdB);
  if (orderA !== orderB) return orderA - orderB;
  return String(mapIdA).localeCompare(String(mapIdB));
}

/**
 * Regions in game display order (state.utils.REGIONS iteration order).
 * @returns {Array<{ id: string, name?: string }>}
 */
function getRegionsInOrder() {
  const state = globalThis.state || window.state;
  const regions = state?.utils?.REGIONS;
  if (!Array.isArray(regions)) return [];
  const seen = new Set();
  const out = [];
  for (const region of regions) {
    const id = region?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: region?.name });
  }
  return out;
}

/**
 * Canonical teleporter table row keys: region headers then rooms per buildMapOrderIndex().
 * Keys match Better Teleporter snapshot format: `region:<id>` and `room:<mapId>`.
 * @returns {string[]}
 */
function getCanonicalTableRowOrder() {
  const state = globalThis.state || window.state;
  const regions = state?.utils?.REGIONS;
  if (!Array.isArray(regions) || !regions.length) return [];

  const regionById = new Map();
  for (const region of regions) {
    if (region?.id) regionById.set(region.id, region);
  }

  const orderedRegionIds = [];
  const seenRegionIds = new Set();
  for (const region of getRegionsInOrder()) {
    const id = region?.id;
    if (!id || seenRegionIds.has(id)) continue;
    seenRegionIds.add(id);
    orderedRegionIds.push(id);
  }
  for (const region of regions) {
    const id = region?.id;
    if (!id || seenRegionIds.has(id)) continue;
    seenRegionIds.add(id);
    orderedRegionIds.push(id);
  }

  const keys = [];
  const placedRooms = new Set();

  for (const regionId of orderedRegionIds) {
    keys.push(`region:${regionId}`);
    const rooms = regionById.get(regionId)?.rooms;
    if (!Array.isArray(rooms)) continue;
    for (const room of rooms) {
      const mapId = room?.id;
      if (!mapId || placedRooms.has(mapId)) continue;
      keys.push(`room:${mapId}`);
      placedRooms.add(mapId);
    }
  }

  const allMaps = getAllMaps();
  const roomList = Array.isArray(allMaps) ? allMaps : Object.values(allMaps || {});
  for (const room of roomList) {
    const mapId = room?.id;
    if (!mapId || placedRooms.has(mapId)) continue;
    keys.push(`room:${mapId}`);
    placedRooms.add(mapId);
  }

  return keys;
}

// Build the database dynamically
const mapsDatabase = buildMapsDatabase();

// Add utility functions to the database
mapsDatabase.getAllMaps = getAllMaps;
mapsDatabase.getMapById = getMapById;
mapsDatabase.getMapsByDifficulty = getMapsByDifficulty;
mapsDatabase.getMapsByMaxTeamSize = getMapsByMaxTeamSize;
mapsDatabase.getMultiFloorRoomIds = getMultiFloorRoomIds;
mapsDatabase.getMapsByStaminaCost = getMapsByStaminaCost;
mapsDatabase.getRaidMaps = getRaidMaps;
mapsDatabase.getNonRaidMaps = getNonRaidMaps;
mapsDatabase.isRaid = isRaid;
mapsDatabase.isMapRaidComprehensive = isMapRaidComprehensive;
mapsDatabase.isDynamicEventMap = isDynamicEventMap;
mapsDatabase.getRegionsInOrder = getRegionsInOrder;
mapsDatabase.getCanonicalTableRowOrder = getCanonicalTableRowOrder;
mapsDatabase.buildMapOrderIndex = buildMapOrderIndex;
mapsDatabase.getMapOrderIndex = getMapOrderIndex;
mapsDatabase.compareMapsByGameOrder = compareMapsByGameOrder;
mapsDatabase.MAP_ORDER_UNKNOWN = MAP_ORDER_UNKNOWN;
mapsDatabase.getRegionDisplayName = getRegionDisplayName;
mapsDatabase.getRegionDisplayNameFromRegion = getRegionDisplayNameFromRegion;
mapsDatabase.EVENT_TO_ROOM_MAPPING = { ...EVENT_TO_ROOM_MAPPING };
mapsDatabase.MAP_EXPANSIONS = MAP_EXPANSIONS;
mapsDatabase.getMapIdByDisplayName = getMapIdByDisplayName;
mapsDatabase.getExpansionMapIds = getExpansionMapIds;
mapsDatabase.getExpansionNameForMapId = getExpansionNameForMapId;
mapsDatabase.getExpansionForRegion = getExpansionForRegion;
mapsDatabase.getRegionRune = getRegionRune;
mapsDatabase.DIFFICULTY_LABELS = { ...DIFFICULTY_LABELS };
mapsDatabase.getDifficultyLabel = getDifficultyLabel;
mapsDatabase.getMapType = getMapType;

// Export for use in other mods
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow) {
  globalWindow.mapsDatabase = mapsDatabase;
  console.log(`[maps-database.js] Loaded ${mapsDatabase.ALL_MAPS.length} maps dynamically (cached for all mods)`);
  console.log(`[maps-database.js] Raid maps: ${mapsDatabase.RAID_MAPS.length}, Non-raid maps: ${mapsDatabase.NON_RAID_MAPS.length}`);
  console.log('[maps-database.js] Maps by difficulty:', Object.keys(mapsDatabase.MAPS_BY_DIFFICULTY).map(d => `D${d}: ${mapsDatabase.MAPS_BY_DIFFICULTY[d].length}`).join(', '));
}
if (typeof module !== 'undefined') {
  module.exports = mapsDatabase;
}

