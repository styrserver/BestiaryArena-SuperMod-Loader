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

