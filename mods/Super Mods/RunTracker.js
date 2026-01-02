// =======================
// RunTracker Super Mod
// =======================

'use strict';

// Prevent multiple executions of the entire mod
if (window.RunTrackerAPI && window.RunTrackerAPI._initialized) {
  console.log('[RunTracker] Mod already loaded, skipping execution');
  // Exit early if already initialized
  if (typeof exports !== 'undefined') {
    exports = {
      name: 'RunTracker',
      description: 'Tracks and stores local run data for Bestiary Arena',
      version: '1.0',
      author: 'Bestiary Arena Mod Loader',
      enabled: true,
      hidden: true
    };
  }
  // Early exit - wrap in IIFE to avoid return outside function
  (function() { return; })();
}

// =======================
// 1. Configuration
// =======================
const RUN_STORAGE_KEY = 'ba_local_runs';
const MAX_RUNS_PER_MAP = 5; // Keep top 5 runs per map/category

// Debounce times
const RUN_DEBOUNCE_TIME = 2000; // 2 seconds
const BOARD_DEBOUNCE_TIME = 1000; // 1 second
const NETWORK_DEBOUNCE_TIME = 1000; // 1 second

// =======================
// 2. Global State & Storage
// =======================
// Check if RunTracker is enabled (default: true)
function isRunTrackerEnabled() {
  try {
    const modSettingsConfig = localStorage.getItem('mod-settings-config');
    if (modSettingsConfig) {
      const parsed = JSON.parse(modSettingsConfig);
      return parsed.enableRunTracker !== false; // Default to true if not set
    }
  } catch (error) {
    console.warn('[RunTracker] Error checking enable state:', error);
  }
  return true; // Default to enabled
}

// Run storage structure
let runStorage = {
  lastUpdated: Date.now(),
  runs: {},
  replays: {}, // Store replay data separately
  metadata: {
    totalRuns: 0,
    totalMaps: 0,
    totalReplays: 0
  }
};

// Initialize when mod loads
let isInitializing = false;
let hasInitialized = false;
let initializationPromise = null;

// Cleanup tracking for memory leak prevention
let boardUnsubscribe = null;
let gameTimerUnsubscribe = null;
let originalFetch = null;
let originalConsoleLog = null;
let retryInterval = null;

// Cleanup function (defined early so it can be called from disable method)
async function performCleanup() {
  try {
    console.log('[RunTracker] Cleaning up mod resources...');
    
    // Unsubscribe from game state listeners
    if (boardUnsubscribe && typeof boardUnsubscribe === 'function') {
      boardUnsubscribe();
      boardUnsubscribe = null;
      console.log('[RunTracker] Unsubscribed from board state');
    }
    
    if (gameTimerUnsubscribe && typeof gameTimerUnsubscribe === 'function') {
      gameTimerUnsubscribe();
      gameTimerUnsubscribe = null;
      console.log('[RunTracker] Unsubscribed from game timer state');
    }
    
    // Clear retry interval
    if (retryInterval) {
      clearInterval(retryInterval);
      retryInterval = null;
      console.log('[RunTracker] Cleared retry interval');
    }
    
    // Restore original global functions
    if (originalFetch) {
      console.log('[RunTracker] Restoring original fetch function');
      window.fetch = originalFetch;
      originalFetch = null;
    }
    
    if (originalConsoleLog) {
      console.log('[RunTracker] Restoring original console.log function');
      console.log = originalConsoleLog;
      originalConsoleLog = null;
    }
    
    // Clear all pending debouncer timers
    if (Utils && Utils.debouncer && Utils.debouncer.timers) {
      Utils.debouncer.timers.forEach(timer => clearTimeout(timer));
      Utils.debouncer.timers.clear();
      console.log('[RunTracker] Cleared all debouncer timers');
    }
    
    // Flush any pending storage operations
    if (StorageManager) {
      await StorageManager.flushSaves();
      console.log('[RunTracker] Flushed pending storage operations');
      
      // Clear StorageManager state
      StorageManager.pendingSaves.clear();
      if (StorageManager.saveTimeout) {
        clearTimeout(StorageManager.saveTimeout);
        StorageManager.saveTimeout = null;
      }
    }
    
    // Reset initialization state for clean reinitialization
    hasInitialized = false;
    isInitializing = false;
    initializationPromise = null;
    
    console.log('[RunTracker] Cleanup completed successfully');
  } catch (error) {
    console.error('[RunTracker] Error during cleanup:', error);
  }
}

// =======================
// 3. Utility Functions
// =======================
// Unified utilities
const Utils = {
  // Debouncing utility
  debouncer: {
    timers: new Map(),
    debounce(key, delay, fn) {
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      this.timers.set(key, setTimeout(() => {
        fn();
        this.timers.delete(key);
      }, delay));
    },
    isDebounced(key) {
      return this.timers.has(key);
    }
  },
  
  // Error handling utility
  handleError: (error, context, fallback = null) => {
    console.error(`[RunTracker] Error in ${context}:`, error);
    return fallback;
  },
  
  // Safe JSON operations
  safeJsonParse: (str, fallback = null) => {
    try {
      return JSON.parse(str);
    } catch (error) {
      console.warn('[RunTracker] JSON parse error:', error);
      return fallback;
    }
  },
  
  // Safe localStorage operations
  safeLocalStorage: {
    get: (key, fallback = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? Utils.safeJsonParse(item, fallback) : fallback;
      } catch (error) {
        console.warn('[RunTracker] localStorage get error:', error);
        return fallback;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('[RunTracker] localStorage set error:', error);
        return false;
      }
    }
  }
};

// =======================
// 3.1. Monster & Equipment Name Resolution
// =======================

// Helper function to resolve map ID to map name
function resolveMapName(mapId) {
  try {
    if (!mapId) return null;
    
    // Try to get the name from the API utility maps
    if (window.mapIdsToNames && window.mapIdsToNames.has(mapId)) {
      return window.mapIdsToNames.get(mapId);
    }
    
    // Fallback to the game state utils
    if (globalThis.state?.utils?.ROOM_NAME && globalThis.state.utils.ROOM_NAME[mapId]) {
      return globalThis.state.utils.ROOM_NAME[mapId];
    }
    
    // If all else fails, return the ID
    return mapId;
  } catch (error) {
    console.warn('[RunTracker] Error resolving map name:', error);
    return mapId;
  }
}

// Get monster name from database ID by looking up in player's monster inventory
function getMonsterNameFromDatabaseId(databaseId) {
  try {
    const { monsters } = globalThis.state.player.getSnapshot().context;
    
    if (Array.isArray(monsters)) {
      const monster = monsters.find(m => String(m.id) === String(databaseId));
      
      if (monster) {
        try {
          const monsterData = globalThis.state.utils.getMonster(monster.gameId);
          const name = monsterData && monsterData.metadata ? monsterData.metadata.name : null;
          if (name) {
            console.log(`[RunTracker] Resolved monster: ${name} (databaseId: ${databaseId}, gameId: ${monster.gameId})`);
          }
          return name;
        } catch (utilsError) {
          console.error(`[RunTracker] Error resolving monster gameId ${monster.gameId}:`, utilsError);
          return monster.name || null;
        }
      }
    }
    
    // Fallback: try to use the databaseId directly as a gameId
    try {
      const monsterData = globalThis.state.utils.getMonster(databaseId);
      return monsterData && monsterData.metadata ? monsterData.metadata.name : null;
    } catch (utilsError) {
      return null;
    }
  } catch (e) {
    console.error('[RunTracker] Error getting monster name from database ID:', e);
    return null;
  }
}

// Get monster name from monster ID (helper function)
function getMonsterNameFromId(monsterId) {
  try {
    const monsterData = globalThis.state.utils.getMonster(monsterId);
    const name = monsterData && monsterData.metadata ? monsterData.metadata.name : null;
    if (name) {
      console.log(`[RunTracker] Resolved monster: ${name} (monsterId: ${monsterId})`);
    }
    return name;
  } catch (e) {
    return null;
  }
}

// Get equipment name from equipment ID
function getEquipmentNameFromId(equipId) {
  try {
    const { equips } = globalThis.state.player.getSnapshot().context;
    
    if (Array.isArray(equips)) {
      const equip = equips.find(e => String(e.id) === String(equipId));
      
      if (equip) {
        try {
          const equipmentData = globalThis.state.utils.getEquipment(equip.gameId);
          const name = equipmentData && equipmentData.metadata ? equipmentData.metadata.name : null;
          if (name) {
            console.log(`[RunTracker] Resolved equipment: ${name} (equipId: ${equipId}, gameId: ${equip.gameId}, tier: ${equip.tier}, stat: ${equip.stat})`);
          }
          return name;
        } catch (utilsError) {
          console.error(`[RunTracker] Error resolving equipment gameId ${equip.gameId}:`, utilsError);
          return `Equipment ${equip.gameId}`;
        }
      }
    }
    
    // Fallback: try to use the equipId directly as a gameId
    try {
      const equipmentData = globalThis.state.utils.getEquipment(equipId);
      return equipmentData && equipmentData.metadata ? equipmentData.metadata.name : null;
    } catch (utilsError) {
      return null;
    }
  } catch (e) {
    console.error('[RunTracker] Error getting equipment name:', e);
    return null;
  }
}

// Storage manager for batch operations
const StorageManager = {
  pendingSaves: new Set(),
  saveTimeout: null,
  
  queueSave() {
    this.pendingSaves.add('runs');
    if (!this.saveTimeout) {
      this.saveTimeout = setTimeout(() => this.flushSaves(), 1000);
    }
  },
  
  async flushSaves() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    
    if (this.pendingSaves.size > 0) {
      await this.saveStorage();
      this.pendingSaves.clear();
    }
  },
  
  async saveStorage() {
    return Utils.safeLocalStorage.set(RUN_STORAGE_KEY, runStorage);
  }
};

// Legacy function for backward compatibility
async function saveStorage() {
  return StorageManager.saveStorage();
}

// =======================
// 4. Storage Management
// =======================
// Initialize storage
async function initializeStorage() {
  try {
    // Use safe localStorage operations
    const storedData = Utils.safeLocalStorage.get(RUN_STORAGE_KEY);
    if (storedData && storedData.lastUpdated) {
      runStorage = storedData;
      console.log('[RunTracker] Loaded existing run data from localStorage:', runStorage.metadata);
    } else {
      // No existing data found, start fresh
      console.log('[RunTracker] No existing run data found, starting fresh');
    }
    
    // Ensure runStorage has all required properties
    if (!runStorage) {
      runStorage = {
        lastUpdated: Date.now(),
        runs: {},
        replays: {},
        metadata: {
          totalRuns: 0,
          totalMaps: 0,
          totalReplays: 0
        }
      };
    }
    
    // Ensure all required properties exist
    if (!runStorage.runs) runStorage.runs = {};
    if (!runStorage.replays) runStorage.replays = {};
    if (!runStorage.metadata) {
      runStorage.metadata = {
        totalRuns: 0,
        totalMaps: 0,
        totalReplays: 0
      };
    }
    
    // Ensure all maps have floor category
    for (const mapKey in runStorage.runs) {
      if (runStorage.runs[mapKey] && !runStorage.runs[mapKey].floor) {
        runStorage.runs[mapKey].floor = [];
      }
    }
    
    // Migrate existing runs to add floor: 0 fallback if missing
    let migratedCount = 0;
    for (const mapKey in runStorage.runs) {
      const mapData = runStorage.runs[mapKey];
      if (mapData) {
        // Check speedrun category
        if (Array.isArray(mapData.speedrun)) {
          mapData.speedrun.forEach(run => {
            if (run.floor === undefined || run.floor === null) {
              run.floor = 0;
              migratedCount++;
            }
          });
        }
        // Check rank category
        if (Array.isArray(mapData.rank)) {
          mapData.rank.forEach(run => {
            if (run.floor === undefined || run.floor === null) {
              run.floor = 0;
              migratedCount++;
            }
          });
        }
        // Check floor category
        if (Array.isArray(mapData.floor)) {
          mapData.floor.forEach(run => {
            if (run.floor === undefined || run.floor === null) {
              run.floor = 0;
              migratedCount++;
            }
          });
        }
      }
    }
    if (migratedCount > 0) {
      console.log(`[RunTracker] Migrated ${migratedCount} runs to add floor: 0 fallback`);
    }
    
    // Save the properly structured storage
    await saveStorage();
  } catch (error) {
    Utils.handleError(error, 'initializing storage');
    // Create a fallback storage structure
    runStorage = {
      lastUpdated: Date.now(),
      runs: {},
      replays: {},
      metadata: {
        totalRuns: 0,
        totalMaps: 0,
        totalReplays: 0
      }
    };
  }
}

// Helper function to find existing run with same setup (monsters, placement, equipment)
function findExistingRun(runData) {
  try {
    if (!runStorage || !runStorage.runs) {
      return null;
    }
    
    if (!runStorage.runs[runData.mapKey]) {
      return null;
    }
    
    // Check all categories for runs with identical setup
    const speedrunRuns = runStorage.runs[runData.mapKey].speedrun || [];
    const rankRuns = runStorage.runs[runData.mapKey].rank || [];
    const floorRuns = runStorage.runs[runData.mapKey].floor || [];
    
    // Helper function to compare setups
    const compareSetups = (run1, run2) => {
      if (!run1.setup || !run2.setup) return false;
      
      const pieces1 = run1.setup.pieces || [];
      const pieces2 = run2.setup.pieces || [];
      
      if (pieces1.length !== pieces2.length) return false;
      
      // Sort pieces by tile for consistent comparison
      const sortedPieces1 = [...pieces1].sort((a, b) => a.tile - b.tile);
      const sortedPieces2 = [...pieces2].sort((a, b) => a.tile - b.tile);
      
      return JSON.stringify(sortedPieces1) === JSON.stringify(sortedPieces2);
    };
    
    // Look for runs with identical setup
    const existingSpeedrun = speedrunRuns.find(run => compareSetups(run, runData));
    const existingRank = rankRuns.find(run => compareSetups(run, runData));
    const existingFloor = floorRuns.find(run => compareSetups(run, runData));
    
    // Return the first found match (speedrun, rank, or floor)
    return existingSpeedrun || existingRank || existingFloor || null;
  } catch (error) {
    console.warn('[RunTracker] Error finding existing run:', error);
    return null;
  }
}

// Helper function to get current board setup
function getCurrentBoardSetup() {
  try {
    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
    if (!boardContext || !boardContext.boardConfig) {
      return null;
    }
    
    // Extract player pieces (monsters and equipment)
    const playerPieces = boardContext.boardConfig
      .filter(piece => piece.type === 'player' || piece.type === 'custom')
      .map(piece => {
        const boardPiece = {
          tile: piece.tileIndex,
          monsterId: piece.monsterId || piece.gameId || piece.databaseId,
          level: piece.level || 50, // Default to level 50 if not specified
          genes: piece.genes || {}
        };
        
        // Get monster name and stats - try multiple possible locations
        if (piece.monster) {
          boardPiece.monsterName = piece.monster.name;
          boardPiece.monsterStats = {
            hp: piece.monster.hp || 20,
            ad: piece.monster.ad || 20,
            ap: piece.monster.ap || 20,
            armor: piece.monster.armor || 20,
            magicResist: piece.monster.magicResist || 20
          };
        } else if (piece.monsterName) {
          boardPiece.monsterName = piece.monsterName;
        } else if (piece.name) {
          boardPiece.monsterName = piece.name;
        } else if (piece.databaseId) {
          // Try to get monster name from databaseId using the new helper function
          const resolvedName = getMonsterNameFromDatabaseId(piece.databaseId);
          // Convert to lowercase for replay compatibility
          boardPiece.monsterName = resolvedName ? resolvedName.toLowerCase() : piece.databaseId;
        } else if (piece.monsterId) {
          // Try to get monster name from monsterId
          const resolvedName = getMonsterNameFromId(piece.monsterId);
          boardPiece.monsterName = resolvedName || piece.monsterId;
        }
        
        // Get monster stats from various possible locations
        if (piece.hp !== undefined || piece.ad !== undefined || piece.ap !== undefined || piece.armor !== undefined || piece.magicResist !== undefined) {
          boardPiece.monsterStats = {
            hp: piece.hp || 20,
            ad: piece.ad || 20,
            ap: piece.ap || 20,
            armor: piece.armor || 20,
            magicResist: piece.magicResist || 20
          };
        }
        
        // FIXED: Get actual monster stats and level from player inventory
        if (piece.databaseId) {
          try {
            const playerSnapshot = globalThis.state.player.getSnapshot();
            if (playerSnapshot && playerSnapshot.context && playerSnapshot.context.monsters) {
              const monster = playerSnapshot.context.monsters.find(m => m.id === piece.databaseId);
              if (monster) {
                // Get actual level from experience
                const actualLevel = globalThis.state.utils.expToCurrentLevel(monster.exp);
                boardPiece.level = actualLevel;
                
                // Get actual stats from monster data
                boardPiece.monsterStats = {
                  hp: monster.hp,
                  ad: monster.ad,
                  ap: monster.ap,
                  armor: monster.armor,
                  magicResist: monster.magicResist
                };
                
                // Get genes if available
                if (monster.genes) {
                  boardPiece.genes = monster.genes;
                }
              }
            }
          } catch (error) {
            console.warn('[RunTracker] Error getting actual monster stats:', error);
          }
        }
        
        // Get equipment information - try multiple possible locations
        if (piece.equip) {
          boardPiece.equipId = piece.equip.gameId;
          boardPiece.equipmentName = piece.equip.name;
          boardPiece.equipmentStat = piece.equip.stat || 'ap';
          boardPiece.equipmentTier = piece.equip.tier || 5;
        } else if (piece.equipment) {
          boardPiece.equipId = piece.equipment.gameId;
          boardPiece.equipmentName = piece.equipment.name;
          boardPiece.equipmentStat = piece.equipment.stat || 'ap';
          boardPiece.equipmentTier = piece.equipment.tier || 5;
        } else if (piece.equipId) {
          boardPiece.equipId = piece.equipId;
          // Try to get equipment name from equipId using the new helper function
          const resolvedName = getEquipmentNameFromId(piece.equipId);
          // Convert to lowercase for replay compatibility
          boardPiece.equipmentName = resolvedName ? resolvedName.toLowerCase() : piece.equipId;
          // Store equipment stat and tier for replay compatibility
          // Get equipment object from inventory to access stat and tier
          const { equips } = globalThis.state.player.getSnapshot().context;
          if (Array.isArray(equips)) {
            const equipment = equips.find(e => String(e.id) === String(piece.equipId));
            if (equipment && equipment.stat) {
              boardPiece.equipmentStat = equipment.stat;
            }
            if (equipment && equipment.tier) {
              boardPiece.equipmentTier = equipment.tier;
            }
          }
        } else if (piece.equipmentName) {
          boardPiece.equipmentName = piece.equipmentName;
        }
        
        // Consolidated log: show key info only
        const monName = boardPiece.monsterName || 'unknown';
        const equipName = boardPiece.equipmentName || 'none';
        const tier = boardPiece.equipmentTier || '?';
        const stat = boardPiece.equipmentStat || '?';
        console.log(`[RunTracker] Board piece [tile ${boardPiece.tile}]: ${monName} (lvl ${boardPiece.level}) + ${equipName} (T${tier} ${stat.toUpperCase()})`);
        return boardPiece;
      })
      .sort((a, b) => a.tile - b.tile); // Sort by tile position for consistency
    
    const result = {
      pieces: playerPieces,
      mapId: boardContext.selectedMap?.selectedRoom?.id,
      mapName: resolveMapName(boardContext.selectedMap?.selectedRoom?.id),
      timestamp: Date.now()
    };
    
    console.log('[RunTracker] Final board setup:', result);
    return result;
  } catch (error) {
    console.warn('[RunTracker] Error getting current board setup:', error);
    return null;
  }
}

// =======================
// 5. Data Parsing
// =======================
// Parse server results to extract run data
function parseServerResults(serverResults) {
  try {
    if (!serverResults || !serverResults.rewardScreen) return null;
    
    // Extract basic run info
    const runData = {
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      seed: serverResults.seed,
      isLocal: true
    };
    
    // Extract map information from rewardScreen.roomId
    if (serverResults.rewardScreen.roomId) {
      // Store the original map ID for boosted map checking
      runData.mapId = serverResults.rewardScreen.roomId;
      // Resolve the map ID to the proper map name
      const resolvedMapName = resolveMapName(serverResults.rewardScreen.roomId);
      runData.mapName = resolvedMapName;
      runData.mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
      console.log(`[RunTracker] Resolved map ID "${serverResults.rewardScreen.roomId}" to name "${resolvedMapName}"`);
    } else if (serverResults.mapName) {
      runData.mapName = serverResults.mapName;
      runData.mapKey = `map_${serverResults.mapName.toLowerCase().replace(/\s+/g, '_')}`;
      // Try to get map ID if available
      if (serverResults.mapId) {
        runData.mapId = serverResults.mapId;
      }
    } else {
      // Try to extract from other sources
      const gameState = globalThis.state?.player?.getSnapshot()?.context;
      if (gameState?.currentMap) {
        runData.mapName = gameState.currentMap;
        runData.mapKey = `map_${gameState.currentMap.toLowerCase().replace(/\s+/g, '_')}`;
      } else {
        console.warn('[RunTracker] Could not determine map name from server results');
        return null;
      }
    }
    
          // Resolve region name for the map
      try {
        const rooms = globalThis.state.utils.ROOMS;
        const regions = globalThis.state.utils.REGIONS;
        const roomNames = globalThis.state.utils.ROOM_NAME;
        const roomIds = globalThis.state.utils.ROOM_ID;
        
        // Try to find room entry by name first, then by ID
        let roomEntry = rooms[runData.mapName];
        
        // If not found by name, try to find the room ID first
        if (!roomEntry && roomIds && roomIds[runData.mapName]) {
          roomEntry = rooms[roomIds[runData.mapName]];
        }
        
        // If still not found, try to find by searching through roomNames
        if (!roomEntry && roomNames) {
          const roomId = Object.keys(roomNames).find(id => roomNames[id] === runData.mapName);
          if (roomId) {
            roomEntry = rooms[roomId];
          }
        }
        
        // If still not found, try to search through all rooms for a matching ID
        if (!roomEntry && rooms) {
          for (const [key, room] of Object.entries(rooms)) {
            if (room && room.id === runData.mapName) {
              roomEntry = room;
              break;
            }
          }
        }
        
        // Find which region contains this room
        if (roomEntry && regions) {
          let regionEntry = null;
          
          // Search through regions to find which one contains this room
          if (Array.isArray(regions)) {
            for (const region of regions) {
              if (region.rooms && Array.isArray(region.rooms)) {
                const roomInRegion = region.rooms.find(room => room.id === roomEntry.id);
                if (roomInRegion) {
                  regionEntry = region;
                  break;
                }
              }
            }
          } else if (typeof regions === 'object') {
            for (const [regionId, region] of Object.entries(regions)) {
              if (region.rooms && Array.isArray(region.rooms)) {
                const roomInRegion = region.rooms.find(room => room.id === roomEntry.id);
                if (roomInRegion) {
                  regionEntry = region;
                  break;
                }
              }
            }
          }
          
          if (regionEntry) {
            // Use region name if available, otherwise use region ID
            if (regionEntry.name) {
              runData.regionName = regionEntry.name;
            } else if (regionEntry.id) {
              runData.regionName = regionEntry.id;
            }
            
            // Capitalize region name
            if (runData.regionName) {
              runData.regionName = runData.regionName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
              console.log(`[RunTracker] Resolved region: ${runData.regionName} (map: ${runData.mapName})`);
            }
          }
        }
      } catch (error) {
        // Silently fail region resolution - it's optional metadata
      }
    

    
    // Extract player name
    const gameState = globalThis.state?.player?.getSnapshot()?.context;
    if (gameState?.playerName) {
      runData.player = gameState.playerName;
    } else {
      runData.player = 'You'; // Fallback
    }
    
    // Extract speedrun time from rewardScreen.gameTicks
    if (serverResults.rewardScreen.gameTicks !== undefined && serverResults.rewardScreen.gameTicks !== null) {
      runData.time = serverResults.rewardScreen.gameTicks;
    } else if (serverResults.time !== undefined && serverResults.time !== null) {
      runData.time = serverResults.time;
    }
    
    // Extract rank points from rewardScreen.rank
    if (serverResults.rewardScreen.rank !== undefined && serverResults.rewardScreen.rank !== null) {
      runData.points = serverResults.rewardScreen.rank;
    } else if (serverResults.rankPoints !== undefined && serverResults.rankPoints !== null) {
      runData.points = serverResults.rankPoints;
    }
    
    // Extract floor data from rewardScreen
    if (serverResults.rewardScreen.floor !== undefined && serverResults.rewardScreen.floor !== null) {
      runData.floor = serverResults.rewardScreen.floor;
      console.log(`[RunTracker] Extracted floor from rewardScreen.floor: ${runData.floor}`);
    } else if (serverResults.floor !== undefined && serverResults.floor !== null) {
      runData.floor = serverResults.floor;
      console.log(`[RunTracker] Extracted floor from serverResults.floor: ${runData.floor}`);
    } else {
      // Fallback: set floor to 0 if not present
      runData.floor = 0;
      console.log(`[RunTracker] No floor data found in server results, defaulting to 0`);
    }
    
    // Extract floor ticks (time to reach floor)
    if (serverResults.rewardScreen.floorTicks !== undefined && serverResults.rewardScreen.floorTicks !== null) {
      runData.floorTicks = serverResults.rewardScreen.floorTicks;
    } else if (serverResults.floorTicks !== undefined && serverResults.floorTicks !== null) {
      runData.floorTicks = serverResults.floorTicks;
    }
    
    // Extract additional info
    if (serverResults.rewardScreen.victory !== undefined) {
      runData.victory = serverResults.rewardScreen.victory;
    }
    if (serverResults.rewardScreen.defeatedEnemies !== undefined) {
      runData.defeatedEnemies = serverResults.rewardScreen.defeatedEnemies;
    }
    if (serverResults.rewardScreen.expReward !== undefined) {
      runData.expReward = serverResults.rewardScreen.expReward;
    }
    
    // Validate we have required data
    if (!runData.mapKey || (!runData.time && !runData.points && !runData.floor)) {
      console.warn('[RunTracker] Missing required run data:', runData);
      return null;
    }
    
    // Log that floor attribute is present (for debugging)
    console.log(`[RunTracker] Parsed run data - floor: ${runData.floor}, time: ${runData.time}, points: ${runData.points}, map: ${runData.mapName}`);
    
    return runData;
  } catch (error) {
    console.error('[RunTracker] Error parsing server results:', error);
    return null;
  }
}

// Parse replay data from $replay calls
function parseReplayData(replayMessage) {
  try {
    // Extract the JSON part from $replay(...)
    const match = replayMessage.match(/\$replay\((\{.*\})\)/);
    if (!match) {
      console.warn('[RunTracker] Could not extract replay data from message');
      return null;
    }
    
    const replayJson = match[1];
    const replayData = Utils.safeJsonParse(replayJson);
    if (!replayData) {
      console.warn('[RunTracker] Invalid replay JSON data');
      return null;
    }
    
    if (!replayData || !replayData.seed) {
      console.warn('[RunTracker] Invalid replay data structure');
      return null;
    }
    
    // Create replay data structure
    const parsedReplay = {
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      seed: replayData.seed,
      region: replayData.region,
      map: replayData.map,
      board: replayData.board || [],
      isReplay: true
    };
    
    // Extract map key - resolve map name if it's an ID
    if (replayData.map) {
      const resolvedMapName = resolveMapName(replayData.map);
      parsedReplay.map = resolvedMapName; // Update the map name to the resolved version
      parsedReplay.mapKey = `map_${resolvedMapName.toLowerCase().replace(/\s+/g, '_')}`;
      console.log(`[RunTracker] Resolved replay map ID "${replayData.map}" to name "${resolvedMapName}"`);
    }
    
    // Check if this map is currently boosted
    try {
      const dailyContext = globalThis.state?.daily?.getSnapshot()?.context;
      if (dailyContext?.boostedMap?.roomId) {
        // Check if the current map matches the boosted map (compare map IDs)
        if (dailyContext.boostedMap.roomId.toLowerCase() === replayData.map.toLowerCase()) {
          console.log(`[RunTracker] Skipping boosted map replay: ${replayData.map} (ID: ${replayData.map})`);
          return null; // Don't track replays on boosted maps
        }
      }
    } catch (error) {
      // If we can't check boosted status, continue with the replay
      console.log('[RunTracker] Could not check boosted map status for replay, continuing');
    }
    
    // Extract monster and equipment info
    if (replayData.board && Array.isArray(replayData.board)) {
      parsedReplay.monsters = replayData.board.map(tile => ({
        tile: tile.tile,
        monster: tile.monster,
        equipment: tile.equipment
      }));
      
      parsedReplay.monsterCount = replayData.board.length;
    }
    
    console.log('[RunTracker] Parsed replay data:', {
      map: parsedReplay.map,
      seed: parsedReplay.seed,
      monsters: parsedReplay.monsterCount
    });
    
    return parsedReplay;
  } catch (error) {
    console.error('[RunTracker] Error parsing replay data:', error);
    return null;
  }
}

// =======================
// 6. Run Management
// =======================
// Add a new run to storage
async function addRun(runData) {
  try {
    // Check if RunTracker is enabled
    if (!window.RunTrackerAPI || !window.RunTrackerAPI._initialized) {
      return false;
    }
    
    if (!runData || !runData.mapKey) {
      console.warn('[RunTracker] Invalid run data:', runData);
      return false;
    }
    
    // Ensure runStorage is properly initialized
    if (!runStorage) {
      console.warn('[RunTracker] runStorage is undefined, reinitializing');
      await initializeStorage();
    }
    
    if (!runStorage.runs) {
      console.warn('[RunTracker] runStorage.runs is undefined, initializing');
      runStorage.runs = {};
    }
    
    // Create a unique key for this run
    const runKey = `${runData.seed}_${runData.mapKey}`;
    
    // Check if we've recently processed this run
    if (Utils.debouncer.isDebounced(runKey)) {
      console.log('[RunTracker] Skipping duplicate run (debounced):', runKey);
      return false;
    }
    
    // Get current board setup for comparison
    const currentSetup = getCurrentBoardSetup();
    runData.setup = currentSetup;
    
    // Check if this map is currently boosted - SKIP BOOSTED MAPS
    try {
      const dailyContext = globalThis.state?.daily?.getSnapshot()?.context;
      
      if (dailyContext?.boostedMap?.roomId) {
        // Check if the run's map matches the boosted map (compare map IDs from server results, not board setup)
        const runMapId = runData.mapId || runData.setup?.mapId;
        if (runMapId && dailyContext.boostedMap.roomId.toLowerCase() === runMapId.toLowerCase()) {
          console.log(`[RunTracker] Skipping boosted map: ${runData.mapName} (ID: ${runMapId})`);
          return false; // Don't track runs on boosted maps
        }
      }
    } catch (error) {
      // If we can't check boosted status, continue with the run
    }
    
    // Fallback: Check if we can get boosted map info from other sources
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      const runMapId = runData.mapId || runData.setup?.mapId;
      if (boardContext?.selectedMap?.boosted && runMapId && boardContext.selectedMap.id === runMapId) {
        console.log(`[RunTracker] Skipping boosted map (board context): ${runData.mapName} (ID: ${runMapId})`);
        return false;
      }
    } catch (fallbackError) {
      // Silently continue if fallback check fails
    }
    
    // Check if we have an existing run with the same setup
    const existingRun = findExistingRun(runData);
    if (existingRun) {
      console.log('[RunTracker] Found existing run with same setup, checking if new run is better');
      
      // Check if the new run is better than the existing one in any category
      let shouldUpdate = false;
      let updateReason = [];
      
      // For speedrun: check if new time is faster
      if (runData.time !== undefined && runData.time !== null && existingRun.time !== undefined && existingRun.time !== null) {
        if (runData.time < existingRun.time) {
          shouldUpdate = true;
          updateReason.push(`faster time (${runData.time} vs ${existingRun.time})`);
        }
      }
      
      // For rank: check if new points are higher or same points with faster time
      if (runData.points !== undefined && runData.points !== null && existingRun.points !== undefined && existingRun.points !== null) {
        if (runData.points > existingRun.points) {
          shouldUpdate = true;
          updateReason.push(`higher points (${runData.points} vs ${existingRun.points})`);
        } else if (runData.points === existingRun.points && runData.time < existingRun.time) {
          shouldUpdate = true;
          updateReason.push(`same points but faster time (${runData.time} vs ${existingRun.time})`);
        }
      }
      
      // For floor: check if new floor is higher or same floor with faster floorTicks
      if (runData.floor !== undefined && runData.floor !== null && runData.floor > 0 && existingRun.floor !== undefined && existingRun.floor !== null) {
        if (runData.floor > existingRun.floor) {
          shouldUpdate = true;
          updateReason.push(`higher floor (${runData.floor} vs ${existingRun.floor})`);
        } else if (runData.floor === existingRun.floor && runData.floorTicks && existingRun.floorTicks && runData.floorTicks < existingRun.floorTicks) {
          shouldUpdate = true;
          updateReason.push(`same floor but faster floorTicks (${runData.floorTicks} vs ${existingRun.floorTicks})`);
        }
      }
      
      if (shouldUpdate) {
        console.log(`[RunTracker] Updating existing run: ${updateReason.join(', ')}`);
        // Continue with the update process
      } else {
        // Don't return early - let each category check independently
        // A run might not be better overall but could still be better in a specific category
        console.log('[RunTracker] New run is not better than existing run in checked categories, but will check each category independently');
      }
    }
    
    // Debounce this run
    Utils.debouncer.debounce(runKey, RUN_DEBOUNCE_TIME, () => {});
    
    // Initialize map if it doesn't exist
    if (!runStorage.runs[runData.mapKey]) {
      runStorage.runs[runData.mapKey] = {
        speedrun: [],
        rank: [],
        floor: []
      };
    }
    
    let speedrunUpdated = false;
    let rankUpdated = false;
    let floorUpdated = false;
    
    // Skip failed runs entirely - only track victories
    // Check both victory flag and points (0 points = defeat)
    // Note: Floor runs can still be tracked even if defeated, as they represent progress
    if (runData.victory === false || runData.points === 0) {
      // Only skip if we don't have floor data (floor runs can be tracked even on defeat)
      if (!runData.floor) {
        console.log(`[RunTracker] Skipping failed run for ${runData.mapName} (victory: ${runData.victory}, points: ${runData.points})`);
        return false;
      }
    }
    
    // Check both categories independently - a run can qualify for both speedrun and rank
    if (runData.time !== undefined && runData.time !== null) {
      speedrunUpdated = await checkAndUpdateSpeedruns(runData);
    }
    
    // Check rank category independently - same run can be in both categories
    // Skip runs with 0 rank points as they represent defeats
    if (runData.points !== undefined && runData.points !== null && runData.points > 0) {
      rankUpdated = await checkAndUpdateRankRuns(runData);
    } else if (runData.points === 0) {
      console.log(`[RunTracker] Skipping defeated run with 0 rank points for ${runData.mapName}`);
    }
    
    // Check floor category independently - tracks highest floor reached
    // Only track floor runs if floor > 0 (floor: 0 is just a fallback for missing data)
    if (runData.floor !== undefined && runData.floor !== null && runData.floor > 0) {
      floorUpdated = await checkAndUpdateFloorRuns(runData);
    } else {
      console.log(`[RunTracker] Skipping floor tracking for ${runData.mapName} - floor is ${runData.floor} (must be > 0 to track)`);
    }
    
    // Update metadata only if there were changes
    if (speedrunUpdated || rankUpdated || floorUpdated) {
      runStorage.lastUpdated = Date.now();
      runStorage.metadata.totalRuns = Object.values(runStorage.runs).reduce((total, map) => {
        return total + map.speedrun.length + map.rank.length + (map.floor?.length || 0);
      }, 0);
      runStorage.metadata.totalMaps = Object.keys(runStorage.runs).length;
      
      // Queue save instead of immediate save
      StorageManager.queueSave();
    }
    
    return speedrunUpdated || rankUpdated || floorUpdated;
  } catch (error) {
    return Utils.handleError(error, 'adding run', false);
  }
}

// Check and update speedrun category
async function checkAndUpdateSpeedruns(runData) {
  const speedrunRuns = runStorage.runs[runData.mapKey].speedrun;
  
  // Check if time is faster or equal to existing runs
  const qualifyingRuns = speedrunRuns.filter(run => run.time >= runData.time);
  
  if (qualifyingRuns.length === 0 && speedrunRuns.length >= MAX_RUNS_PER_MAP) {
    // No qualifying runs and already at max capacity
    console.log(`[RunTracker] Skipping speedrun - time ${runData.time} not fast enough for ${runData.mapName}`);
    return false;
  }
  
  // Check for same setup (more robust comparison)
  const sameSetupRun = speedrunRuns.find(run => {
    if (!run.setup || !runData.setup) return false;
    
    // Compare pieces array
    const runPieces = run.setup.pieces || [];
    const dataPieces = runData.setup.pieces || [];
    
    if (runPieces.length !== dataPieces.length) return false;
    
    // Sort pieces by tile for consistent comparison
    const sortedRunPieces = [...runPieces].sort((a, b) => a.tile - b.tile);
    const sortedDataPieces = [...dataPieces].sort((a, b) => a.tile - b.tile);
    
    return JSON.stringify(sortedRunPieces) === JSON.stringify(sortedDataPieces);
  });
  
  if (sameSetupRun) {
    // Same setup found - update with new data while preserving category-specific info
    const existingIndex = speedrunRuns.indexOf(sameSetupRun);
    const updatedRun = { ...sameSetupRun, ...runData };
    speedrunRuns[existingIndex] = updatedRun;
    
    console.log(`[RunTracker] Updated speedrun for ${runData.mapName} with same setup: ${runData.time} (was ${sameSetupRun.time})`);
  } else {
    // Unique setup - add to top 5 in correct order
    speedrunRuns.push(runData);
    
    // Sort by time (fastest first)
    speedrunRuns.sort((a, b) => (a.time || Infinity) - (b.time || Infinity));
    
    // Keep only top 5
    if (speedrunRuns.length > MAX_RUNS_PER_MAP) {
      speedrunRuns.splice(MAX_RUNS_PER_MAP);
    }
    
    console.log(`[RunTracker] Added new speedrun for ${runData.mapName} with unique setup: ${runData.time}`);
  }
  
  return true;
}

// Check and update rank points category
async function checkAndUpdateRankRuns(runData) {
  // Additional safety check: skip defeated runs with 0 rank points
  if (runData.points === 0) {
    console.log(`[RunTracker] Skipping defeated run with 0 rank points for ${runData.mapName}`);
    return false;
  }
  
  const rankRuns = runStorage.runs[runData.mapKey].rank;
  
  // Check if it has higher rank points OR same rank points with better time
  // For rank runs, we prioritize rank points over time
  const qualifyingRuns = rankRuns.filter(run => 
    (run.points < runData.points) || (run.points === runData.points && run.time >= runData.time)
  );
  
  if (qualifyingRuns.length === 0 && rankRuns.length >= MAX_RUNS_PER_MAP) {
    // No qualifying runs and already at max capacity
    console.log(`[RunTracker] Skipping rank run - points ${runData.points} and time ${runData.time} not good enough for ${runData.mapName}`);
    return false;
  }
  
  // Check for same setup (more robust comparison)
  const sameSetupRun = rankRuns.find(run => {
    if (!run.setup || !runData.setup) return false;
    
    // Compare pieces array
    const runPieces = run.setup.pieces || [];
    const dataPieces = runData.setup.pieces || [];
    
    if (runPieces.length !== dataPieces.length) return false;
    
    // Sort pieces by tile for consistent comparison
    const sortedRunPieces = [...runPieces].sort((a, b) => a.tile - b.tile);
    const sortedDataPieces = [...dataPieces].sort((a, b) => a.tile - b.tile);
    
    return JSON.stringify(sortedRunPieces) === JSON.stringify(sortedDataPieces);
  });
  
  if (sameSetupRun) {
    // Same setup found - update with new data while preserving category-specific info
    const existingIndex = rankRuns.indexOf(sameSetupRun);
    const updatedRun = { ...sameSetupRun, ...runData };
    rankRuns[existingIndex] = updatedRun;
    
    console.log(`[RunTracker] Updated rank run for ${runData.mapName} with same setup: ${runData.points} points, ${runData.time} time (was ${sameSetupRun.points} points, ${sameSetupRun.time} time)`);
  } else {
    // Unique setup - add to top 5 in correct order
    rankRuns.push(runData);
    
    // Sort by points (highest first), then by time (fastest first) for tiebreakers
    rankRuns.sort((a, b) => {
      if (a.points !== b.points) {
        return (b.points || 0) - (a.points || 0);
      }
      return (a.time || Infinity) - (b.time || Infinity);
    });
    
    // Keep only top 5
    if (rankRuns.length > MAX_RUNS_PER_MAP) {
      rankRuns.splice(MAX_RUNS_PER_MAP);
    }
    
    console.log(`[RunTracker] Added new rank run for ${runData.mapName} with unique setup: ${runData.points} points, ${runData.time} time`);
  }
  
  return true;
}

// Check and update floor category
async function checkAndUpdateFloorRuns(runData) {
  const floorRuns = runStorage.runs[runData.mapKey].floor;
  
  // Check if floor is higher or equal to existing runs
  // For same floor, prefer faster floorTicks (if available)
  const qualifyingRuns = floorRuns.filter(run => 
    (run.floor < runData.floor) || 
    (run.floor === runData.floor && run.floorTicks && runData.floorTicks && run.floorTicks >= runData.floorTicks) ||
    (run.floor === runData.floor && !run.floorTicks && runData.floorTicks)
  );
  
  if (qualifyingRuns.length === 0 && floorRuns.length >= MAX_RUNS_PER_MAP) {
    // Check if this run is better than the worst run
    const worstRun = floorRuns[floorRuns.length - 1];
    if (runData.floor < worstRun.floor || 
        (runData.floor === worstRun.floor && runData.floorTicks && worstRun.floorTicks && runData.floorTicks >= worstRun.floorTicks)) {
      console.log(`[RunTracker] Skipping floor run - floor ${runData.floor} not high enough for ${runData.mapName}`);
      return false;
    }
  }
  
  // Check for same setup (more robust comparison)
  const sameSetupRun = floorRuns.find(run => {
    if (!run.setup || !runData.setup) return false;
    
    // Compare pieces array
    const runPieces = run.setup.pieces || [];
    const dataPieces = runData.setup.pieces || [];
    
    if (runPieces.length !== dataPieces.length) return false;
    
    // Sort pieces by tile for consistent comparison
    const sortedRunPieces = [...runPieces].sort((a, b) => a.tile - b.tile);
    const sortedDataPieces = [...dataPieces].sort((a, b) => a.tile - b.tile);
    
    return JSON.stringify(sortedRunPieces) === JSON.stringify(sortedDataPieces);
  });
  
  if (sameSetupRun) {
    // Same setup found - update if new floor is higher, or same floor with better floorTicks
    let shouldUpdate = false;
    if (runData.floor > sameSetupRun.floor) {
      shouldUpdate = true;
    } else if (runData.floor === sameSetupRun.floor && runData.floorTicks && sameSetupRun.floorTicks) {
      if (runData.floorTicks < sameSetupRun.floorTicks) {
        shouldUpdate = true;
      }
    } else if (runData.floor === sameSetupRun.floor && runData.floorTicks && !sameSetupRun.floorTicks) {
      shouldUpdate = true;
    }
    
    if (shouldUpdate) {
      const existingIndex = floorRuns.indexOf(sameSetupRun);
      const updatedRun = { ...sameSetupRun, ...runData };
      floorRuns[existingIndex] = updatedRun;
      
      console.log(`[RunTracker] Updated floor run for ${runData.mapName} with same setup: floor ${runData.floor} (was ${sameSetupRun.floor})${runData.floorTicks ? `, floorTicks ${runData.floorTicks}` : ''}`);
    } else {
      console.log(`[RunTracker] New floor run is not better than existing run for same setup`);
      return false;
    }
  } else {
    // Unique setup - add to top 5 in correct order
    floorRuns.push(runData);
    
    // Sort by floor (highest first), then by floorTicks (fastest first) for tiebreakers
    floorRuns.sort((a, b) => {
      if (a.floor !== b.floor) {
        return (b.floor || 0) - (a.floor || 0);
      }
      // Same floor - prefer faster floorTicks, or runs with floorTicks over those without
      if (a.floorTicks && b.floorTicks) {
        return (a.floorTicks || Infinity) - (b.floorTicks || Infinity);
      }
      if (a.floorTicks && !b.floorTicks) return -1;
      if (!a.floorTicks && b.floorTicks) return 1;
      return 0;
    });
    
    // Keep only top 5
    if (floorRuns.length > MAX_RUNS_PER_MAP) {
      floorRuns.splice(MAX_RUNS_PER_MAP);
    }
    
    console.log(`[RunTracker] Added new floor run for ${runData.mapName} with unique setup: floor ${runData.floor}${runData.floorTicks ? `, floorTicks ${runData.floorTicks}` : ''}`);
  }
  
  return true;
}

// Add replay data to storage
async function addReplayData(replayData) {
  try {
    // Check if RunTracker is enabled
    if (!window.RunTrackerAPI || !window.RunTrackerAPI._initialized) {
      return false;
    }
    
    if (!replayData || !replayData.seed || !replayData.mapKey) {
      console.warn('[RunTracker] Invalid replay data:', replayData);
      return false;
    }
    
    // Ensure runStorage and replays are properly initialized
    if (!runStorage) {
      console.warn('[RunTracker] runStorage is undefined, reinitializing');
      await initializeStorage();
    }
    
    if (!runStorage.replays) {
      console.warn('[RunTracker] runStorage.replays is undefined, initializing');
      runStorage.replays = {};
    }
    
    // Initialize replays if it doesn't exist
    if (!runStorage.replays[replayData.mapKey]) {
      runStorage.replays[replayData.mapKey] = [];
    }
    
    // Check for duplicate replays (same seed)
    const existingIndex = runStorage.replays[replayData.mapKey].findIndex(replay => replay.seed === replayData.seed);
    if (existingIndex !== -1) {
      console.log('[RunTracker] Duplicate replay found, updating existing entry');
      runStorage.replays[replayData.mapKey][existingIndex] = replayData;
    } else {
      // Add new replay
      runStorage.replays[replayData.mapKey].push(replayData);
      console.log(`[RunTracker] Added new replay for ${replayData.map}: ${replayData.monsterCount} monsters, seed ${replayData.seed}`);
    }
    
    // Sort replays by timestamp (newest first)
    runStorage.replays[replayData.mapKey].sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only recent replays (last 10 per map)
    if (runStorage.replays[replayData.mapKey].length > 10) {
      runStorage.replays[replayData.mapKey].splice(10);
    }
    
    // Update metadata
    runStorage.lastUpdated = Date.now();
    runStorage.metadata.totalReplays = Object.values(runStorage.replays).reduce((total, map) => {
      return total + map.length;
    }, 0);
    
    // Queue save instead of immediate save
    StorageManager.queueSave();
    
    return true;
  } catch (error) {
    console.error('[RunTracker] Error adding replay data:', error);
    return false;
  }
}

// Clean up old runs (disabled - keeping runs forever)
async function cleanupRuns() {
  try {
    // Cleanup is disabled to keep runs forever
    console.log('[RunTracker] Cleanup disabled - keeping all runs');
    return;
  } catch (error) {
    console.error('[RunTracker] Error in cleanup function:', error);
  }
}

// Clean up defeated runs with 0 rank points
async function cleanupDefeatedRuns() {
  try {
    if (!runStorage || !runStorage.runs) {
      console.log('[RunTracker] No runs to clean up');
      return;
    }
    
    let totalRemoved = 0;
    
    for (const [mapKey, mapData] of Object.entries(runStorage.runs)) {
      if (mapData.rank && Array.isArray(mapData.rank)) {
        const originalCount = mapData.rank.length;
        mapData.rank = mapData.rank.filter(run => run.points > 0);
        const removedCount = originalCount - mapData.rank.length;
        if (removedCount > 0) {
          console.log(`[RunTracker] Removed ${removedCount} defeated runs from ${mapKey}`);
          totalRemoved += removedCount;
        }
      }
      
      // Ensure floor category exists
      if (!mapData.floor) {
        mapData.floor = [];
      }
    }
    
    if (totalRemoved > 0) {
      console.log(`[RunTracker] Cleaned up ${totalRemoved} total defeated runs`);
      // Update metadata
      runStorage.metadata.totalRuns = Object.values(runStorage.runs).reduce((total, map) => {
        return total + map.speedrun.length + map.rank.length + (map.floor?.length || 0);
      }, 0);
      // Queue save
      StorageManager.queueSave();
    }
  } catch (error) {
    console.error('[RunTracker] Error cleaning up defeated runs:', error);
  }
}

// =======================
// 7. Event Listeners
// =======================
// Set up server results listener
function setupResultsListener() {
  try {
    // Try to set up listeners immediately
    function setupListeners() {
      // Listen for game board subscription (like Hunt Analyzer)
      if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
        boardUnsubscribe = globalThis.state.board.subscribe(({ context }) => {
          // Check if RunTracker is enabled before processing
          if (!window.RunTrackerAPI || !window.RunTrackerAPI._initialized) {
            return;
          }
          
          const serverResults = context.serverResults;
          if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') return;
          
          // Create a unique key for this board update
          const boardKey = `${serverResults.seed}_${serverResults.rewardScreen.roomId || 'unknown'}`;
          
          // Check if we've recently processed this board update
          if (Utils.debouncer.isDebounced(boardKey)) {
            console.log('[RunTracker] Skipping duplicate board update (debounced):', boardKey);
            return;
          }
          
          // Debounce this board update
          Utils.debouncer.debounce(boardKey, BOARD_DEBOUNCE_TIME, () => {});
          
          // Parse and store the run
          const runData = parseServerResults(serverResults);
          if (runData) {
            addRun(runData);
          }
        });
        console.log('[RunTracker] Server results listener set up');
        return true;
      }
      
      // Alternative: Listen for game timer subscription
      if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.gameTimer && globalThis.state.gameTimer.subscribe) {
        gameTimerUnsubscribe = globalThis.state.gameTimer.subscribe((data) => {
          const { readableGrade, rankPoints } = data.context;
          if ((readableGrade !== undefined && readableGrade !== null) || (rankPoints !== undefined && rankPoints !== null)) {
            // This might be a game end event, but we need server results for full data
            console.log('[RunTracker] Game end detected, but waiting for server results');
          }
        });
      }
      
      return false;
    }
    
    // Try immediately, then retry a few times if needed
    if (!setupListeners()) {
      let attempts = 0;
      const maxAttempts = 10;
      retryInterval = setInterval(() => {
        attempts++;
        if (setupListeners() || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (attempts >= maxAttempts) {
            console.log('[RunTracker] Game state not available, will retry when available');
          }
        }
      }, 100);
    }
  } catch (error) {
    console.error('[RunTracker] Error setting up results listener:', error);
  }
}

// Set up network listener to catch server results and replay data
function setupNetworkListener() {
  try {
    // Monitor fetch requests for server results
    originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      
      // Check if RunTracker is enabled before processing
      if (!window.RunTrackerAPI || !window.RunTrackerAPI._initialized) {
        return response;
      }
      
      // Check if this is a server results request
      const url = args[0];
      if (typeof url === 'string' && (url.includes('gameServer?batch=1') || url.includes('game.gameServer?batch=1'))) {
        try {
          // Clone the response to read it
          const clonedResponse = response.clone();
          const responseData = await clonedResponse.json();
          
          // Handle tRPC response format
          let data = responseData;
          if (Array.isArray(responseData) && responseData[0] && responseData[0].result && responseData[0].result.data) {
            data = responseData[0].result.data.json;
          }
          
          // Check if this contains server results
          if (data && data.rewardScreen && typeof data.seed !== 'undefined') {
            // Skip if Board Analyzer or Manual Runner is running
            if (window.__modCoordination?.boardAnalyzerRunning || window.__modCoordination?.manualRunnerActive) {
              return response;
            }
            
            // Create a unique key for this request
            const requestKey = `${data.seed}_${data.rewardScreen.roomId || 'unknown'}`;
            
            // Check if we've recently processed this request
            if (Utils.debouncer.isDebounced(requestKey)) {
              console.log('[RunTracker] Skipping duplicate network request (debounced):', requestKey);
              return response;
            }
            
            // Debounce this network request
            Utils.debouncer.debounce(requestKey, NETWORK_DEBOUNCE_TIME, () => {});
            
            console.log('[RunTracker] Detected server results via network request');
            const runData = parseServerResults(data);
            if (runData) {
              addRun(runData);
            }
          }
        } catch (error) {
          // Ignore errors when trying to parse response
        }
      }
      
      return response;
    };
    
    // Monitor console.log calls for replay data
    originalConsoleLog = console.log;
    console.log = function(...args) {
      // Call original console.log
      originalConsoleLog.apply(console, args);
      
      // Check if RunTracker is enabled before processing
      if (!window.RunTrackerAPI || !window.RunTrackerAPI._initialized) {
        return;
      }
      
      // Check for replay data (but avoid recursive calls from RunTracker itself)
      const message = args.join(' ');
      if (message.includes('$replay(') && !message.includes('[RunTracker]')) {
        try {
          // Extract the replay data to create a unique key
          const replayData = parseReplayData(message);
          if (replayData) {
            // Create a unique key for this replay
            const replayKey = `replay_${replayData.seed}_${replayData.map}`;
            
            // Check if we've recently processed this replay
            if (Utils.debouncer.isDebounced(replayKey)) {
              console.log('[RunTracker] Skipping duplicate replay (debounced):', replayKey);
              return;
            }
            
            // Debounce this replay
            Utils.debouncer.debounce(replayKey, RUN_DEBOUNCE_TIME, () => {});
            
            originalConsoleLog('[RunTracker] Detected replay data');
            addReplayData(replayData);
          }
        } catch (error) {
          originalConsoleLog('[RunTracker] Error parsing replay data:', error);
        }
      }
    };
    
    console.log('[RunTracker] Network and replay listeners set up');
  } catch (error) {
    console.error('[RunTracker] Error setting up network listener:', error);
  }
}

// =======================
// 8. Initialization
// =======================
// Initialize the mod
async function initialize() {
  try {
    await initializeStorage();
    setupResultsListener();
    setupNetworkListener();
    
    // Clean up any existing defeated runs with 0 rank points
    await cleanupDefeatedRuns();
    
    // Periodic cleanup disabled - keeping runs forever
    // setInterval(cleanupRuns, 60 * 60 * 1000); // Clean up every hour
    
    console.log('[RunTracker] Mod initialized successfully');
  } catch (error) {
    console.error('[RunTracker] Error initializing mod:', error);
  }
}

function initializeMod() {
  // Prevent duplicate initialization
  if (isInitializing) {
    return initializationPromise;
  }
  
  if (hasInitialized) {
    console.log('[RunTracker] Already initialized, skipping');
    return Promise.resolve();
  }
  
  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log('[RunTracker] Initializing...');
      await initialize();
      hasInitialized = true;
    } catch (error) {
      console.error('[RunTracker] Error during initialization:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();
  
  return initializationPromise;
}

// =======================
// 9. Public API
// =======================
// Make RunTracker API available globally immediately
if (!window.RunTrackerAPI) {
  window.RunTrackerAPI = {
  _initialized: false, // Track initialization state
  // Core functions
  addRun,
  addReplayData,
  getRuns: (mapKey, category = null) => {
    try {
      if (!runStorage || !runStorage.runs || !runStorage.runs[mapKey]) {
        return category ? [] : { speedrun: [], rank: [], floor: [] };
      }
      
      if (category) {
        return runStorage.runs[mapKey][category] || [];
      }
      
      return runStorage.runs[mapKey];
    } catch (error) {
      console.error('[RunTracker] Error getting runs:', error);
      return category ? [] : { speedrun: [], rank: [], floor: [] };
    }
  },
  getReplays: (mapKey = null) => {
    try {
      if (!runStorage || !runStorage.replays) {
        return mapKey ? [] : {};
      }
      
      if (mapKey) {
        return runStorage.replays[mapKey] || [];
      }
      
      return runStorage.replays;
    } catch (error) {
      console.error('[RunTracker] Error getting replays:', error);
      return mapKey ? [] : {};
    }
  },
  getAllRuns: () => {
    try {
      return runStorage || { lastUpdated: Date.now(), runs: {}, replays: {}, metadata: { totalRuns: 0, totalMaps: 0, totalReplays: 0 } };
    } catch (error) {
      console.error('[RunTracker] Error getting all runs:', error);
      return { lastUpdated: Date.now(), runs: {}, replays: {}, metadata: { totalRuns: 0, totalMaps: 0, totalReplays: 0 } };
    }
  },
  getRunStats: () => {
    try {
      if (!runStorage) {
        return { totalRuns: 0, totalMaps: 0, totalReplays: 0, lastUpdated: 0, maps: {} };
      }
      
      const stats = {
        totalRuns: runStorage.metadata?.totalRuns || 0,
        totalMaps: runStorage.metadata?.totalMaps || 0,
        totalReplays: runStorage.metadata?.totalReplays || 0,
        lastUpdated: runStorage.lastUpdated || Date.now(),
        maps: {}
      };
      
      if (runStorage.runs) {
        Object.keys(runStorage.runs).forEach(mapKey => {
          const map = runStorage.runs[mapKey];
          stats.maps[mapKey] = {
            speedrun: map.speedrun?.length || 0,
            rank: map.rank?.length || 0,
            floor: map.floor?.length || 0,
            replays: runStorage.replays?.[mapKey]?.length || 0,
            total: (map.speedrun?.length || 0) + (map.rank?.length || 0) + (map.floor?.length || 0)
          };
        });
      }
      
      return stats;
    } catch (error) {
      console.error('[RunTracker] Error getting run stats:', error);
      return { totalRuns: 0, totalMaps: 0, totalReplays: 0, lastUpdated: 0, maps: {} };
    }
  },
  clearAllRuns: async () => {
    try {
      runStorage = {
        lastUpdated: Date.now(),
        runs: {},
        replays: {},
        metadata: {
          totalRuns: 0,
          totalMaps: 0,
          totalReplays: 0
        }
      };
      await StorageManager.flushSaves();
      await StorageManager.saveStorage();
      console.log('[RunTracker] All runs and replays cleared');
      return true;
    } catch (error) {
      console.error('[RunTracker] Error clearing runs:', error);
      return false;
    }
  },
  
  // Import/Export for Mod Settings (Backup tab)
  exportRuns: () => {
    return {
      version: '1.0',
      timestamp: Date.now(),
      data: runStorage,
      stats: window.RunTrackerAPI.getRunStats()
    };
  },
  importRuns: async (importData) => {
    try {
      if (!importData || !importData.data || !importData.data.runs) {
        throw new Error('Invalid import data format');
      }
      
      runStorage = importData.data;
      await StorageManager.flushSaves();
      await StorageManager.saveStorage();
      console.log('[RunTracker] Runs imported successfully');
      return true;
    } catch (error) {
      console.error('[RunTracker] Error importing runs:', error);
      return false;
    }
  },
  
  // Utility functions
  parseServerResults,
  cleanupRuns,
  cleanupDefeatedRuns,
  

  
  // Delete a specific run by index
  deleteRun: async (mapKey, category, index) => {
    try {
      if (!runStorage || !runStorage.runs || !runStorage.runs[mapKey]) {
        return false;
      }
      
      const categoryRuns = runStorage.runs[mapKey][category];
      if (!categoryRuns || index < 0 || index >= categoryRuns.length) {
        return false;
      }
      
      // Remove the run at the specified index
      categoryRuns.splice(index, 1);
      
      // Update metadata
      runStorage.lastUpdated = Date.now();
      runStorage.metadata.totalRuns = Object.values(runStorage.runs).reduce((total, map) => {
        return total + map.speedrun.length + map.rank.length + (map.floor?.length || 0);
      }, 0);
      
      // Save immediately for deletions to ensure persistence
      await StorageManager.saveStorage();
      
      console.log(`[RunTracker] Deleted ${category} run at index ${index} for ${mapKey}`);
      return true;
    } catch (error) {
      console.error('[RunTracker] Error deleting run:', error);
      return false;
    }
  },
  
  // Enable/Disable RunTracker
  enable: async () => {
    if (window.RunTrackerAPI._initialized) {
      console.log('[RunTracker] Already enabled');
      return true;
    }
    try {
      await initializeMod();
      window.RunTrackerAPI._initialized = true;
      console.log('[RunTracker] Enabled successfully');
      return true;
    } catch (error) {
      console.error('[RunTracker] Error enabling:', error);
      return false;
    }
  },
  
  disable: async () => {
    if (!window.RunTrackerAPI._initialized) {
      console.log('[RunTracker] Already disabled');
      return true;
    }
    try {
      await performCleanup();
      window.RunTrackerAPI._initialized = false;
      console.log('[RunTracker] Disabled successfully');
      return true;
    } catch (error) {
      console.error('[RunTracker] Error disabling:', error);
      return false;
    }
  },
  
  isEnabled: () => {
    return window.RunTrackerAPI._initialized === true;
  }

  };
}

  console.log('[RunTracker] API loaded immediately');

// Start initialization only if enabled
if (isRunTrackerEnabled()) {
  initializeMod().then(() => {
    // Mark as fully initialized
    window.RunTrackerAPI._initialized = true;
    console.log('[RunTracker] Mod fully initialized and ready');
  }).catch(error => {
    console.error('[RunTracker] Initialization failed:', error);
  });
} else {
  console.log('[RunTracker] Mod disabled in settings, skipping initialization');
  window.RunTrackerAPI._initialized = false;
}

// =======================
// 10. Module Exports
// =======================
// Export for mod system
exports = {
  name: 'RunTracker',
  description: 'Tracks and stores local run data for Bestiary Arena',
  version: '1.0',
  author: 'Bestiary Arena Mod Loader',
  enabled: true,
  hidden: true, // This prevents it from showing in the UI
  
  // Cleanup function to prevent memory leaks
  cleanup: async () => {
    await performCleanup();
    // Remove global API to prevent memory leaks (only when mod is unloaded, not when disabled)
    if (window.RunTrackerAPI) {
      delete window.RunTrackerAPI;
      console.log('[RunTracker] Removed global API');
    }
  }
};

