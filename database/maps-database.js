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
 * Get maps by maximum team size
 * @param {number} teamSize - The maximum team size
 * @returns {Array} Array of maps with the specified max team size
 */
function getMapsByMaxTeamSize(teamSize) {
  const allMaps = getAllMaps();
  return allMaps.filter(map => map.maxTeamSize === teamSize);
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

/** Region id → display name fallback when game state names are unavailable. */
const REGION_NAME_MAP = {
  rook: 'Rookgaard',
  carlin: 'Carlin',
  folda: 'Folda',
  abdendriel: 'Ab\'Dendriel',
  kazordoon: 'Kazordoon',
  venore: 'Venore',
  ankrahmun: 'Ankrahmun'
};

function titleCaseRegionId(regionId) {
  const raw = String(regionId ?? '').trim();
  if (!raw) return 'Unknown Region';
  return raw.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Resolve a region id to its display name.
 * Priority: static REGION_NAME_MAP → state.utils.REGION_NAME → REGIONS[].name → title case.
 * @param {string} regionId
 * @returns {string}
 */
function getRegionDisplayName(regionId) {
  if (regionId == null || regionId === '') return 'Unknown Region';
  const key = String(regionId).toLowerCase();

  if (REGION_NAME_MAP[key]) return REGION_NAME_MAP[key];
  if (REGION_NAME_MAP[regionId]) return REGION_NAME_MAP[regionId];

  try {
    const regionNames = globalThis.state?.utils?.REGION_NAME;
    if (regionNames && typeof regionNames === 'object') {
      if (regionNames[regionId]) return regionNames[regionId];
      if (regionNames[key]) return regionNames[key];
    }
  } catch (_) { /* ignore */ }

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
 * Comprehensive raid check (ROOMS, REGIONS scan, active raids list).
 * @param {string} mapId
 * @returns {boolean}
 */
function isMapRaidComprehensive(mapId) {
  if (!mapId) return false;

  try {
    const roomData = globalThis.state?.utils?.ROOMS?.[mapId];
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
  'An Arcanist Ritual': 'vdhar'
};

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
mapsDatabase.REGION_NAME_MAP = { ...REGION_NAME_MAP };
mapsDatabase.getRegionDisplayName = getRegionDisplayName;
mapsDatabase.getRegionDisplayNameFromRegion = getRegionDisplayNameFromRegion;
mapsDatabase.EVENT_TO_ROOM_MAPPING = { ...EVENT_TO_ROOM_MAPPING };

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

