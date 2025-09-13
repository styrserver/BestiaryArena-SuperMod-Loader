// =======================
// BOARD ADVISOR MOD
// =======================
// Advanced board analysis and recommendations for Bestiary Arena
// Features: Room-based data storage, pattern analysis, performance predictions
// =======================

console.log('Board Advisor Mod initializing...');

// =======================
// 0. CONFIGURATION
// =======================

// Configuration with defaults
const defaultConfig = {
  enabled: true,
  analysisDepth: 50, // Number of simulations to run for analysis
  learningEnabled: true, // Enable pattern learning from successful runs
  recommendationThreshold: 0.1, // Minimum improvement threshold for recommendations
  showPredictions: true, // Show performance predictions
  autoAnalyze: true, // Automatically analyze when board changes
  autoAnalyzeOnBoardChange: true, // Auto-analyze when board setup changes
  autoAnalyzeOnPanelOpen: true, // Auto-analyze when panel opens
  autoAnalyzeAfterRun: true, // Auto-analyze after successful runs
  autoRefreshPanel: true, // Automatically refresh panel data
  focusArea: 'ticks' // Focus area: 'ticks' for speed optimization, 'ranks' for points optimization
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Debouncing mechanism to prevent analysis loops
let analysisTimeout = null;
let lastAnalysisTime = 0;
const ANALYSIS_DEBOUNCE_TIME = 1000; // 1 second debounce
let pendingAnalysisRequest = null; // Track pending analysis to prevent duplicates

// Helper function to generate board hash for duplicate detection
function generateBoardHash(boardSetup) {
  if (!boardSetup || boardSetup.length === 0) return 'empty';
  
  return boardSetup
    .map(piece => `${piece.tileIndex}-${piece.monsterName || 'empty'}-${piece.equipmentName || 'empty'}`)
    .sort()
    .join('|');
}

// Constants
const MOD_ID = 'board-advisor';
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

// Analysis Engine state
let analysisState = {
  isAnalyzing: false,
  isDataLoading: false,
  currentAnalysis: null,
  historicalData: [],
  patterns: {},
  recommendations: null,
  lastBoardHash: null,
  lastDataLoadTime: 0
};

// Performance optimization caches
let performanceCache = {
  lastRoomDetection: null,
  lastRoomDetectionTime: 0,
  roomDetectionCache: new Map(),
  patternMatchingCache: new Map(),
  dataLoadingCache: new Map()
};

// State-based refresh system
let stateRefreshSystem = {
  lastRefreshTime: 0,
  subscriptions: [],
  isEnabled: false
};

// Performance tracking
let performanceTracker = {
  runs: [],
  patterns: new Map(),
  optimalSetups: new Map(),
  roomStats: new Map()
};

// Helper function to add run if not already exists (deduplication)
function addRunIfNotExists(newRun) {
  const exists = performanceTracker.runs.some(r => 
    r.roomId === newRun.roomId && 
    r.ticks === newRun.ticks && 
    r.timestamp === newRun.timestamp &&
    r.source === newRun.source
  );
  if (!exists) {
    performanceTracker.runs.push(newRun);
    updatePatterns(newRun);
    return true;
  }
  return false;
}

// RunTracker integration
let runTrackerData = null;

// Sandbox run storage using IndexedDB - Room-based structure for optimal performance
const SANDBOX_DB_NAME = 'BestiaryArena_SandboxRuns';
const ROOM_METADATA_STORE = 'roomMetadata';
const MAX_RUNS_PER_ROOM = 500;

// Room-based object store naming convention
const getRoomStoreName = (roomId) => `room_${roomId}`;

// IndexedDB instance
let sandboxDB = null;
let isDBReady = false;

// Tile highlighting constants
const TILE_HIGHLIGHT_OVERLAY_ID = 'board-advisor-tile-highlight';
const TILE_HIGHLIGHT_STYLE_ID = 'board-advisor-highlight-styles';

// Smart cleanup tracking
let currentRecommendedSetup = null;
let placedRecommendedPieces = new Set();



// =======================
// 1. INDEXEDDB IMPLEMENTATION
// =======================

// Initialize IndexedDB
async function initSandboxDB() {
  return new Promise((resolve, reject) => {
    if (isDBReady && sandboxDB) {
      resolve(sandboxDB);
      return;
    }

    const request = indexedDB.open(SANDBOX_DB_NAME, 1);

    request.onerror = () => {
      console.error('[Board Advisor] IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = async () => {
      sandboxDB = request.result;
      isDBReady = true;
      console.log('[Board Advisor] IndexedDB initialized successfully');
      
      // Check for missing room stores and create them if needed
      try {
        await ensureAllRoomStoresExist();
      } catch (error) {
        console.warn('[Board Advisor] Failed to ensure room stores exist:', error);
      }
      
      resolve(sandboxDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[Board Advisor] Creating IndexedDB structure...');
      
      // Create room metadata store
      if (!db.objectStoreNames.contains(ROOM_METADATA_STORE)) {
        const metadataStore = db.createObjectStore(ROOM_METADATA_STORE, { 
          keyPath: 'roomId' 
        });
        
        // Create indexes for room metadata
        metadataStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        metadataStore.createIndex('totalRuns', 'totalRuns', { unique: false });
        metadataStore.createIndex('bestTicks', 'bestTicks', { unique: false });
        metadataStore.createIndex('bestRankPoints', 'bestRankPoints', { unique: false });
        
        console.log('[Board Advisor] Room metadata store created');
      }
      
      // Get all room IDs from the game state
      const roomIds = [];
      try {
        if (globalThis.state?.utils?.ROOMS) {
          const rooms = globalThis.state.utils.ROOMS;
          if (Array.isArray(rooms)) {
            // If ROOMS is an array, extract room IDs from each room object
            rooms.forEach(room => {
              if (room && room.id) {
                roomIds.push(room.id);
              }
            });
          } else {
            // If ROOMS is an object, use the keys
            Object.keys(rooms).forEach(roomId => {
              roomIds.push(roomId);
            });
          }
          console.log(`[Board Advisor] Found ${roomIds.length} rooms from game state:`, roomIds.slice(0, 5), '...');
        } else {
          console.error('[Board Advisor] Game state not available - cannot create room stores');
          return;
        }
      } catch (error) {
        console.error('[Board Advisor] Could not access game state:', error);
        return;
      }
      
      // Create object stores for each room
      roomIds.forEach(roomId => {
        const storeName = getRoomStoreName(roomId);
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('ticks', 'ticks', { unique: false });
          store.createIndex('rankPoints', 'rankPoints', { unique: false });
          store.createIndex('success', 'success', { unique: false });
          
          console.log(`[Board Advisor] Created object store for room: ${roomId}`);
        }
      });
      
      console.log(`[Board Advisor] Created ${roomIds.length} room-based object stores`);
    };
  });
}

// Ensure all room stores exist by creating them if they don't
async function ensureAllRoomStoresExist() {
  if (!isDBReady || !sandboxDB) {
    return;
  }
  
  // Get all room IDs from the game state
  const roomIds = [];
  try {
    if (globalThis.state?.utils?.ROOMS) {
      const rooms = globalThis.state.utils.ROOMS;
      if (Array.isArray(rooms)) {
        // If ROOMS is an array, extract room IDs from each room object
        rooms.forEach(room => {
          if (room && room.id) {
            roomIds.push(room.id);
          }
        });
      } else {
        // If ROOMS is an object, use the keys
        Object.keys(rooms).forEach(roomId => {
          roomIds.push(roomId);
        });
      }
      console.log(`[Board Advisor] Found ${roomIds.length} rooms from game state:`, roomIds.slice(0, 5), '...');
    } else {
      console.error('[Board Advisor] Game state not available - cannot create room stores');
      return;
    }
  } catch (error) {
    console.error('[Board Advisor] Could not access game state:', error);
    return;
  }
  
  // Check which stores are missing
  const missingStores = [];
  roomIds.forEach(roomId => {
    const storeName = getRoomStoreName(roomId);
    if (!sandboxDB.objectStoreNames.contains(storeName)) {
      missingStores.push({ roomId, storeName });
    }
  });
  
  if (missingStores.length > 0) {
    console.log(`[Board Advisor] Found ${missingStores.length} missing room stores, creating them individually...`);
    
    // Create missing stores without deleting existing data
    return new Promise((resolve, reject) => {
      // Close current connection
      sandboxDB.close();
      isDBReady = false;
      
      // Open with version increment to trigger upgrade
      const currentVersion = sandboxDB ? sandboxDB.version : 1;
      const newVersion = currentVersion + 1;
      const createRequest = indexedDB.open(SANDBOX_DB_NAME, newVersion);
        
        createRequest.onupgradeneeded = (event) => {
          const db = event.target.result;
          console.log('[Board Advisor] Creating missing room stores...');
          
          // Create room metadata store if missing
          if (!db.objectStoreNames.contains(ROOM_METADATA_STORE)) {
            const metadataStore = db.createObjectStore(ROOM_METADATA_STORE, { 
              keyPath: 'roomId' 
            });
            
            metadataStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            metadataStore.createIndex('totalRuns', 'totalRuns', { unique: false });
            metadataStore.createIndex('bestTicks', 'bestTicks', { unique: false });
            metadataStore.createIndex('bestRankPoints', 'bestRankPoints', { unique: false });
            console.log('[Board Advisor] Created room metadata store');
          }
          
          // Create only missing room stores
          missingStores.forEach(({ roomId, storeName }) => {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { 
                keyPath: 'id', 
                autoIncrement: true 
              });
              
              store.createIndex('timestamp', 'timestamp', { unique: false });
              store.createIndex('ticks', 'ticks', { unique: false });
              store.createIndex('rankPoints', 'rankPoints', { unique: false });
              store.createIndex('success', 'success', { unique: false });
              
              console.log(`[Board Advisor] Created missing object store for room: ${roomId}`);
            }
          });
          
          console.log(`[Board Advisor] Created ${missingStores.length} missing room stores`);
        };
        
        createRequest.onsuccess = () => {
          sandboxDB = createRequest.result;
          isDBReady = true;
          console.log(`[Board Advisor] Database upgraded with ${missingStores.length} missing room stores`);
          resolve();
        };
        
        createRequest.onerror = () => {
          console.error('[Board Advisor] Failed to upgrade database:', createRequest.error);
          reject(createRequest.error);
        };
      });
  } else {
    console.log('[Board Advisor] All room stores already exist');
  }
}

// Get room store name - all stores are created during initialization
async function ensureRoomStoreExists(roomId) {
  if (!isDBReady || !sandboxDB) {
    await initSandboxDB();
  }
  
  const storeName = getRoomStoreName(roomId);
  
  // Check if store exists
  if (sandboxDB.objectStoreNames.contains(storeName)) {
    return storeName;
  }
  
  // If store doesn't exist, log error and return null
  console.error(`[Board Advisor] Room store ${storeName} not found.`);
  return null;
}


// Validate run data before saving
function validateRunData(runData) {
  if (!runData) {
    throw new Error('Run data is required');
  }
  if (!runData.roomId) {
    throw new Error('Room ID is required');
  }
  if (runData.ticks === undefined || runData.ticks === null) {
    throw new Error('Ticks value is required');
  }
  if (runData.rankPoints === undefined || runData.rankPoints === null) {
    throw new Error('Rank points value is required');
  }
  return true;
}

// Safe database operation wrapper with fallback handling
async function safeDBOperation(operation, fallback = null) {
  try {
    return await operation();
  } catch (error) {
    console.error('[Board Advisor] Database operation failed:', error);
    if (fallback !== null) {
      console.warn('[Board Advisor] Using fallback value:', fallback);
      return fallback;
    }
    throw error;
  }
}

// Add a sandbox run to IndexedDB
async function addSandboxRunToDB(runData) {
  return safeDBOperation(async () => {
    // Validate data before processing
    validateRunData(runData);
    
    if (!isDBReady) {
      await initSandboxDB();
    }

    const roomId = runData.roomId;
    
    // Get room store name
    const storeName = await ensureRoomStoreExists(roomId);
    
    if (!storeName) {
      throw new Error(`Room store for ${roomId} not found`);
    }
    
    return new Promise((resolve, reject) => {
      const transaction = sandboxDB.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Add timestamp if not present
      if (!runData.timestamp) {
        runData.timestamp = Date.now();
      }
      
      // Create unique ID for the run
      const roomRunData = {
        ...runData,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      const request = store.add(roomRunData);
      
      request.onsuccess = async () => {
        console.log('[Board Advisor] Sandbox run added to IndexedDB:', roomId, runData.ticks);
        
        // Check if we need to cleanup old runs for this room
        try {
          await cleanupRoomRunsIfNeeded(roomId);
        } catch (error) {
          console.warn('[Board Advisor] Failed to cleanup room runs:', error);
          // Don't fail the entire operation if cleanup fails
        }
        
        // Update room metadata with error handling
        try {
          await updateRoomMetadataAfterRun(roomId, roomRunData);
        } catch (error) {
          console.warn('[Board Advisor] Failed to update room metadata:', error);
          // Don't fail the entire operation if metadata update fails
        }
        
        // CACHE FIX: Clear caches and refresh data immediately after saving
        try {
          console.log('[Board Advisor] Clearing caches and refreshing data after sandbox run save...');
          await invalidateCachesAndRefreshData(roomId);
        } catch (error) {
          console.warn('[Board Advisor] Failed to refresh data after sandbox run save:', error);
          // Don't fail the entire operation if refresh fails
        }
        
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error('[Board Advisor] Error adding sandbox run to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }, false); // Return false on failure
}

// Update room metadata after adding a new run
async function updateRoomMetadataAfterRun(roomId, runData) {
  return new Promise((resolve, reject) => {
    const transaction = sandboxDB.transaction([ROOM_METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(ROOM_METADATA_STORE);
    
    const request = store.get(roomId);
    request.onsuccess = () => {
      const metadata = request.result || {
        roomId: roomId,
        totalRuns: 0,
        bestTicks: Infinity,
        bestRankPoints: 0,
        lastUpdated: 0,
        createdAt: Date.now()
      };
      
      // Update statistics
      metadata.totalRuns += 1;
      if (runData.ticks !== undefined && runData.ticks !== null) {
        metadata.bestTicks = Math.min(metadata.bestTicks, runData.ticks);
      }
      metadata.bestRankPoints = Math.max(metadata.bestRankPoints, runData.rankPoints || 0);
      metadata.lastUpdated = Math.max(metadata.lastUpdated, runData.timestamp || Date.now());
      
      const updateRequest = store.put(metadata);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Cleanup room runs if they exceed the limit, keeping the best runs
async function cleanupRoomRunsIfNeeded(roomId) {
  try {
    // Get current run count for this room
    const currentRuns = await getSandboxRunsForRoom(roomId, MAX_RUNS_PER_ROOM + 1);
    
    if (currentRuns.length <= MAX_RUNS_PER_ROOM) {
      return; // No cleanup needed
    }
    
    console.log(`[Board Advisor] Room ${roomId} has ${currentRuns.length} runs, cleaning up to ${MAX_RUNS_PER_ROOM}`);
    
    // Sort runs by priority (best runs first)
    const sortedRuns = currentRuns.sort((a, b) => {
      // 1. Failed runs go to the end (lowest priority)
      if (a.completed !== b.completed) {
        return a.completed ? -1 : 1;
      }
      
      // 2. Among completed runs, sort by ticks (best time first)
      if (a.completed && b.completed) {
        return a.ticks - b.ticks;
      }
      
      // 3. Among failed runs, keep more recent ones
      return b.timestamp - a.timestamp;
    });
    
    // Keep only the best runs
    const runsToKeep = sortedRuns.slice(0, MAX_RUNS_PER_ROOM);
    const runsToRemove = currentRuns.length - MAX_RUNS_PER_ROOM;
    
    // Clear the room store and re-add only the best runs
    const storeName = await ensureRoomStoreExists(roomId);
    if (!storeName) return;
    
    const transaction = sandboxDB.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Clear all runs for this room
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Add back only the best runs
    for (const run of runsToKeep) {
      await new Promise((resolve, reject) => {
        const addRequest = store.add(run);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }
    
    console.log(`[Board Advisor] Room cleanup complete: removed ${runsToRemove} runs (kept ${runsToKeep.filter(r => r.completed).length} completed, ${runsToKeep.filter(r => !r.completed).length} failed)`);
    
  } catch (error) {
    console.error('[Board Advisor] Error during room cleanup:', error);
    throw error;
  }
}

// Get sandbox runs for a specific room (optimized for room-based structure)
async function getSandboxRunsForRoom(roomId, limit = MAX_RUNS_PER_ROOM) {
  try {
    if (!isDBReady) {
      await initSandboxDB();
    }

    const storeName = getRoomStoreName(roomId);
    
    // Check if room store exists
    if (!sandboxDB.objectStoreNames.contains(storeName)) {
      console.log(`[Board Advisor] No room store found for ${roomId}, returning empty array`);
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = sandboxDB.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');
      
      // Query runs ordered by timestamp (newest first)
      const request = index.openCursor(null, 'prev');
      
      const runs = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && runs.length < limit) {
          runs.push(cursor.value);
          cursor.continue();
        } else {
          // Runs are already sorted by timestamp descending
          resolve(runs);
        }
      };
      
      request.onerror = () => {
        console.error('[Board Advisor] Error getting sandbox runs for room:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Board Advisor] Error in getSandboxRunsForRoom:', error);
    return [];
  }
}

// Get room metadata for a specific room
async function getRoomMetadata(roomId) {
  try {
    if (!isDBReady) {
      await initSandboxDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = sandboxDB.transaction([ROOM_METADATA_STORE], 'readonly');
      const store = transaction.objectStore(ROOM_METADATA_STORE);
      const request = store.get(roomId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        console.error('[Board Advisor] Error getting room metadata:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Board Advisor] Error in getRoomMetadata:', error);
    return null;
  }
}

// Get all room metadata (for statistics)
async function getAllRoomMetadata() {
  try {
    if (!isDBReady) {
      await initSandboxDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = sandboxDB.transaction([ROOM_METADATA_STORE], 'readonly');
      const store = transaction.objectStore(ROOM_METADATA_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        console.error('[Board Advisor] Error getting all room metadata:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Board Advisor] Error in getAllRoomMetadata:', error);
    return [];
  }
}



// Transform stored run data to $replay format
function transformRunToReplay(runData) {
  try {
    if (!runData || !runData.boardSetup || !Array.isArray(runData.boardSetup)) {
      console.warn('[Board Advisor] Invalid run data for replay transformation:', runData);
      return null;
    }

    // Get map and region info
    const roomId = runData.roomId;
    const mapName = globalThis.state?.utils?.ROOM_NAME?.[roomId] || roomId;
    const regionName = getRegionNameFromRoomId(roomId);

    // Transform board setup to replay format
    const board = runData.boardSetup.map(piece => {
      const replayPiece = {
        tile: piece.tile || piece.tileIndex
      };

      // Add monster data - only if we have complete monster information
      if (piece.monsterName && piece.monsterStats && 
          piece.monsterStats.hp !== undefined && 
          piece.monsterStats.ad !== undefined && 
          piece.monsterStats.ap !== undefined && 
          piece.monsterStats.armor !== undefined && 
          piece.monsterStats.magicResist !== undefined) {
        replayPiece.monster = {
          name: piece.monsterName,
          hp: piece.monsterStats.hp,
          ad: piece.monsterStats.ad,
          ap: piece.monsterStats.ap,
          armor: piece.monsterStats.armor,
          magicResist: piece.monsterStats.magicResist
        };
      }

      // Add equipment data - only if we have complete equipment information
      if (piece.equipmentName && piece.equipmentStat && piece.equipmentTier !== undefined) {
        replayPiece.equipment = {
          name: piece.equipmentName,
          stat: piece.equipmentStat,
          tier: piece.equipmentTier
        };
      }

      return replayPiece;
    }).filter(piece => piece.monster || piece.equipment); // Only include pieces with valid data

    // Create replay data structure
    const replayData = {
      region: regionName,
      map: mapName,
      board: board,
      seed: runData.seed
    };

    return replayData;
  } catch (error) {
    console.error('[Board Advisor] Error transforming run to replay:', error);
    return null;
  }
}

// Generate $replay link from stored run data
function generateReplayLink(runData) {
  try {
    const replayData = transformRunToReplay(runData);
    if (!replayData) {
      return null;
    }

    return '$replay(' + JSON.stringify(replayData) + ')';
  } catch (error) {
    console.error('[Board Advisor] Error generating replay link:', error);
    return null;
  }
}

// Helper function to get region name from room ID
function getRegionNameFromRoomId(roomId) {
  try {
    const rooms = globalThis.state?.utils?.ROOMS;
    const regions = globalThis.state?.utils?.REGIONS;
    
    if (!rooms || !regions) {
      return 'Unknown';
    }

    // Find room entry
    let roomEntry = rooms[roomId];
    if (!roomEntry) {
      // Try to find by searching through room names
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      if (roomNames) {
        const foundId = Object.keys(roomNames).find(id => roomNames[id] === roomId);
        if (foundId) {
          roomEntry = rooms[foundId];
        }
      }
    }

    if (!roomEntry) {
      return 'Unknown';
    }

    // Find which region contains this room
    if (Array.isArray(regions)) {
      for (const region of regions) {
        if (region.rooms && Array.isArray(region.rooms)) {
          const roomInRegion = region.rooms.find(room => room.id === roomEntry.id);
          if (roomInRegion) {
            return region.name || region.id || 'Unknown';
          }
        }
      }
    } else if (typeof regions === 'object') {
      for (const [regionId, region] of Object.entries(regions)) {
        if (region.rooms && Array.isArray(region.rooms)) {
          const roomInRegion = region.rooms.find(room => room.id === roomEntry.id);
          if (roomInRegion) {
            return region.name || region.id || 'Unknown';
          }
        }
      }
    }

    return 'Unknown';
  } catch (error) {
    console.warn('[Board Advisor] Error getting region name:', error);
    return 'Unknown';
  }
}

// Helper function to get equipment name from ID
function getEquipmentName(equipId) {
  try {
    if (!equipId) return 'Unknown';
    
    // Try to get from player context first (this is the correct approach)
    const playerContext = globalThis.state?.player?.getSnapshot()?.context;
    if (playerContext?.equips) {
      const equipment = playerContext.equips.find(e => String(e.id) === String(equipId));
      if (equipment) {
        // Use the utility API to get the equipment name from gameId
        if (window.BestiaryModAPI?.utility?.maps?.equipmentGameIdsToNames) {
          const equipmentName = window.BestiaryModAPI.utility.maps.equipmentGameIdsToNames.get(equipment.gameId);
          if (equipmentName) {
            return equipment.tier ? `${equipmentName} (T${equipment.tier})` : equipmentName;
          }
        }
        
        // Fallback to game state utils
        if (globalThis.state?.utils?.getEquipment) {
          try {
            const equipmentData = globalThis.state.utils.getEquipment(equipment.gameId);
            if (equipmentData?.metadata?.name) {
              return equipment.tier ? `${equipmentData.metadata.name} (T${equipment.tier})` : equipmentData.metadata.name;
            }
          } catch (e) {
            // Equipment not found in utils
          }
        }
        
        // If we have the equipment but can't get the name, return a descriptive fallback
        return `Equipment ID ${equipment.gameId}`;
      }
    }
    
    // Try to get from game state utils using getEquipment (direct ID lookup)
    if (globalThis.state?.utils?.getEquipment) {
      try {
        const equipmentData = globalThis.state.utils.getEquipment(equipId);
        if (equipmentData?.metadata?.name) {
          return equipmentData.metadata.name;
        }
      } catch (e) {
        // getEquipment might not work with string IDs, try as number
        const numericId = parseInt(equipId);
        if (!isNaN(numericId)) {
          const equipmentData = globalThis.state.utils.getEquipment(numericId);
          if (equipmentData?.metadata?.name) {
            return equipmentData.metadata.name;
          }
        }
      }
    }
    
    // Try to get from equipment names mapping
    if (globalThis.state?.utils?.EQUIPMENT_NAMES && globalThis.state.utils.EQUIPMENT_NAMES[equipId]) {
      return globalThis.state.utils.EQUIPMENT_NAMES[equipId];
    }
    
    // Try to get from equipment game IDs to names mapping
    if (globalThis.state?.utils?.equipmentGameIdsToNames && globalThis.state.utils.equipmentGameIdsToNames.has(equipId)) {
      return globalThis.state.utils.equipmentGameIdsToNames.get(equipId);
    }
    
    // Fallback to ID if no name found
    return equipId;
  } catch (error) {
    console.warn('[Board Advisor] Error looking up equipment name:', error);
    return equipId || 'Unknown';
  }
}

// =======================
// TILE HIGHLIGHTING SYSTEM
// =======================

// Highlight recommended tiles on empty board
function highlightRecommendedTiles(recommendedSetup) {
  if (!recommendedSetup || !Array.isArray(recommendedSetup) || recommendedSetup.length === 0) {
    return;
  }
  
  console.log('[Board Advisor] Highlighting recommended tiles:', recommendedSetup);
  
  // Clean up any existing highlights
  cleanupTileHighlights();
  
  // Track the new recommended setup
  currentRecommendedSetup = recommendedSetup;
  placedRecommendedPieces.clear();
  
  // Create highlight overlay
  createTileHighlightOverlay(recommendedSetup);
}

// Create overlay to highlight recommended tiles
function createTileHighlightOverlay(recommendedSetup) {
  try {
    // Find the tiles container
    const tilesContainer = document.getElementById('tiles');
    if (!tilesContainer) {
      console.error('[Board Advisor] Could not find #tiles container for highlighting');
      return;
    }
    
    // Create overlay container
    const overlayContainer = document.createElement('div');
    overlayContainer.id = TILE_HIGHLIGHT_OVERLAY_ID;
    overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 200;
    `;
    
    // Create highlight styles
    const styleElement = document.createElement('style');
    styleElement.id = TILE_HIGHLIGHT_STYLE_ID;
    styleElement.textContent = `
      .board-advisor-tile-highlight {
        position: absolute;
        width: calc(32px * var(--zoomFactor));
        height: calc(32px * var(--zoomFactor));
        border: 3px solid #ff6b35;
        background-color: rgba(255, 107, 53, 0.2);
        border-radius: 4px;
        pointer-events: none;
        animation: board-advisor-pulse 2s ease-in-out infinite;
        box-shadow: 0 0 10px #ff6b35, inset 0 0 10px rgba(255, 107, 53, 0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      
      .board-advisor-tile-info {
        position: absolute;
        top: calc(100% + 2px);
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.95);
        color: #fff;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-family: "Press Start 2P", "VT323", monospace;
        white-space: nowrap;
        border: 2px solid #ff6b35;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8), 0 0 8px rgba(255, 107, 53, 0.5);
        z-index: 1000;
        max-width: 250px;
        text-align: center;
        line-height: 1.3;
        pointer-events: none;
        min-width: 120px;
      }
      
      .board-advisor-tile-info .monster-name {
        color: #4CAF50;
        font-weight: bold;
        font-size: 12px;
        text-shadow: 0 0 4px rgba(76, 175, 80, 0.8);
      }
      
      .board-advisor-tile-info .equipment-name {
        color: #2196F3;
        font-size: 11px;
        text-shadow: 0 0 4px rgba(33, 150, 243, 0.8);
        margin-top: 2px;
      }
      
      /* Tile number CSS removed - no longer needed */
      
      @keyframes board-advisor-pulse {
        0%, 100% { 
          border-color: #ff6b35;
          box-shadow: 0 0 10px #ff6b35, inset 0 0 10px rgba(255, 107, 53, 0.3);
        }
        50% { 
          border-color: #ff8c42;
          box-shadow: 0 0 15px #ff8c42, inset 0 0 15px rgba(255, 140, 66, 0.4);
        }
      }
    `;
    document.head.appendChild(styleElement);
    
    // Process each recommended tile
    recommendedSetup.forEach((piece, index) => {
      if (!piece.tileIndex && piece.tileIndex !== 0) {
        console.warn('[Board Advisor] Piece missing tileIndex:', piece);
        return;
      }
      
      const tileId = piece.tileIndex;
      const tileElement = document.getElementById(`tile-index-${tileId}`);
      
      if (!tileElement) {
        console.warn(`[Board Advisor] Could not find tile element for index ${tileId}`);
        return;
      }
      
      // Get positioning from the tile element
      const style = tileElement.getAttribute('style');
      let rightValue = '';
      let bottomValue = '';
      
      // Extract the right, bottom values using regex (same as Custom Display)
      const rightMatch = /right:\s*calc\(([^)]+)\)/.exec(style);
      if (rightMatch) rightValue = rightMatch[1];
      
      const bottomMatch = /bottom:\s*calc\(([^)]+)\)/.exec(style);
      if (bottomMatch) bottomValue = bottomMatch[1];
      
      if (!rightValue || !bottomValue) {
        console.warn(`[Board Advisor] Could not extract positioning for tile ${tileId}`);
        return;
      }
      
      // Create highlight overlay
      const highlightOverlay = document.createElement('div');
      highlightOverlay.classList.add('board-advisor-tile-highlight');
      highlightOverlay.setAttribute('data-tile-index', tileId);
      highlightOverlay.setAttribute('data-piece-index', index);
      
      // Position the highlight overlay
      highlightOverlay.style.position = 'absolute';
      highlightOverlay.style.right = `calc(${rightValue})`;
      highlightOverlay.style.bottom = `calc(${bottomValue})`;
      
      // Create info display
      const monsterName = piece.monsterName || 'Unknown Monster';
      const equipmentName = piece.equipmentName || (piece.equipId ? 'Equipment' : '');
      
      console.log(`[Board Advisor] Creating info box for tile ${tileId}: ${monsterName} + ${equipmentName}`);
      
      // Create the info box
      const infoBox = document.createElement('div');
      infoBox.classList.add('board-advisor-tile-info');
      
      // Add monster name
      const monsterSpan = document.createElement('div');
      monsterSpan.classList.add('monster-name');
      monsterSpan.textContent = monsterName;
      infoBox.appendChild(monsterSpan);
      
      // Add equipment name if available
      if (equipmentName) {
        const equipSpan = document.createElement('div');
        equipSpan.classList.add('equipment-name');
        equipSpan.textContent = equipmentName;
        infoBox.appendChild(equipSpan);
      }
      
      // Tile number removed - redundant since tile is already highlighted
      
      highlightOverlay.appendChild(infoBox);
      
      // Add a simple text overlay directly on the tile as a fallback
      const tileText = document.createElement('div');
      tileText.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #fff;
        font-size: 8px;
        font-family: monospace;
        text-align: center;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        pointer-events: none;
        z-index: 10;
        line-height: 1.1;
      `;
      tileText.innerHTML = `
        <div style="color: #4CAF50; font-weight: bold; font-size: 10px;">${monsterName}</div>
        <div style="color: #2196F3; font-size: 9px;">${equipmentName}</div>
      `;
      highlightOverlay.appendChild(tileText);
      
      // Add tooltip as backup
      highlightOverlay.title = `Recommended: ${monsterName}${equipmentName ? ' + ' + equipmentName : ''} (Tile ${tileId})`;
      
      overlayContainer.appendChild(highlightOverlay);
    });
    
    // Add the overlay container to the tiles container
    tilesContainer.appendChild(overlayContainer);
    
    console.log(`[Board Advisor] Created highlights for ${recommendedSetup.length} recommended tiles`);
    
  } catch (error) {
    console.error('[Board Advisor] Error creating tile highlight overlay:', error);
  }
}

// Smart cleanup function that checks if all recommended pieces are placed
function smartCleanupTileHighlights() {
  if (!currentRecommendedSetup || currentRecommendedSetup.length === 0) {
    cleanupTileHighlights();
    return;
  }
  
  // Get current board state
  const currentBoard = dataCollector.getCurrentBoardData();
  if (!currentBoard || !currentBoard.boardSetup) {
    cleanupTileHighlights();
    return;
  }
  
  // Check which recommended pieces have been placed
  const currentPieces = new Set();
  currentBoard.boardSetup.forEach(piece => {
    if (piece.tileIndex !== undefined) {
      currentPieces.add(piece.tileIndex);
    }
  });
  
  // Check if all recommended pieces are placed
  const allRecommendedPlaced = currentRecommendedSetup.every(rec => 
    currentPieces.has(rec.tileIndex)
  );
  
  if (allRecommendedPlaced) {
    console.log('[Board Advisor] All recommended pieces placed, cleaning up highlights');
    cleanupTileHighlights();
    currentRecommendedSetup = null;
    placedRecommendedPieces.clear();
  } else {
    console.log('[Board Advisor] Not all recommended pieces placed yet, keeping/restoring highlights');
    
    // Re-highlight missing recommended pieces
    const missingPieces = currentRecommendedSetup.filter(rec => 
      !currentPieces.has(rec.tileIndex)
    );
    
    if (missingPieces.length > 0) {
      console.log('[Board Advisor] Re-highlighting missing pieces:', missingPieces);
      highlightRecommendedTiles(missingPieces);
    }
  }
}

// Clean up tile highlights
function cleanupTileHighlights() {
  // Remove the overlay container
  const overlayContainer = document.getElementById(TILE_HIGHLIGHT_OVERLAY_ID);
  if (overlayContainer) {
    overlayContainer.remove();
  }
  
  // Remove the style element
  const styleElement = document.getElementById(TILE_HIGHLIGHT_STYLE_ID);
  if (styleElement) {
    styleElement.remove();
  }
  
  // Remove any stray highlight elements
  const highlightElements = document.querySelectorAll('.board-advisor-tile-highlight');
  highlightElements.forEach(el => el.remove());
}

// =======================
// 2. DATA COLLECTION SYSTEM
// =======================

// Helper function to create a pattern key from board setup
function createPatternKey(boardSetup) {
  if (!boardSetup || !Array.isArray(boardSetup)) {
    return 'unknown';
  }
  
  // Sort pieces by tile for consistent comparison
  const sortedPieces = [...boardSetup].sort((a, b) => a.tile - b.tile);
  return JSON.stringify(sortedPieces);
}

// Helper function to format monster stats display
function formatMonsterStats(monsterStats) {
  if (!monsterStats) return '';
  
  const { hp, ad, ap, armor, magicResist } = monsterStats;
  
  // Check if all stats are 20 (maxed)
  if (hp === 20 && ad === 20 && ap === 20 && armor === 20 && magicResist === 20) {
    return '(maxed)';
  }
  
  // Show only stats that are below 20
  const lowStats = [];
  if (hp < 20) lowStats.push(`HP: ${hp}`);
  if (ad < 20) lowStats.push(`AD: ${ad}`);
  if (ap < 20) lowStats.push(`AP: ${ap}`);
  if (armor < 20) lowStats.push(`Armor: ${armor}`);
  if (magicResist < 20) lowStats.push(`MR: ${magicResist}`);
  
  return lowStats.length > 0 ? `(${lowStats.join(', ')})` : '';
}

// Helper function to get monster name from ID
function getMonsterName(monsterId) {
  try {
    if (!monsterId) return 'Unknown';
    
    // Try to get from player context first
    const playerContext = globalThis.state?.player?.getSnapshot()?.context;
    if (playerContext?.monsters) {
      const monster = playerContext.monsters.find(m => m.id === monsterId);
      if (monster?.name) return monster.name;
    }
    
    // Try to get from game state utils using getMonster
    if (globalThis.state?.utils?.getMonster) {
      try {
        const monsterData = globalThis.state.utils.getMonster(monsterId);
        if (monsterData?.metadata?.name) {
          return monsterData.metadata.name;
        }
      } catch (e) {
        // getMonster might not work with string IDs, try as number
        const numericId = parseInt(monsterId);
        if (!isNaN(numericId)) {
          const monsterData = globalThis.state.utils.getMonster(numericId);
          if (monsterData?.metadata?.name) {
            return monsterData.metadata.name;
          }
        }
      }
    }
    
    // Try to get from monster names mapping
    if (globalThis.state?.utils?.MONSTER_NAMES && globalThis.state.utils.MONSTER_NAMES[monsterId]) {
      return globalThis.state.utils.MONSTER_NAMES[monsterId];
    }
    
    // Try to get from monster game IDs to names mapping
    if (globalThis.state?.utils?.monsterGameIdsToNames && globalThis.state.utils.monsterGameIdsToNames.has(monsterId)) {
      return globalThis.state.utils.monsterGameIdsToNames.get(monsterId);
    }
    
    // Fallback to ID if no name found
    return monsterId;
  } catch (error) {
    console.warn('[Board Advisor] Error looking up monster name:', error);
    return monsterId || 'Unknown';
  }
}


// Helper function to get monster stats from stored run data
function getMonsterStats(monsterId, runData) {
  try {
    if (!monsterId || !runData?.setup?.pieces) {
      return null; // No hardcoded fallbacks
    }
    
    // Find the piece with matching monsterId
    const piece = runData.setup.pieces.find(p => 
      p.monsterId === monsterId || 
      p.monster?.id === monsterId || 
      p.monster?.name === monsterId
    );
    
    if (piece?.monsterStats) {
      return {
        hp: piece.monsterStats.hp,
        ad: piece.monsterStats.ad,
        ap: piece.monsterStats.ap,
        armor: piece.monsterStats.armor,
        magicResist: piece.monsterStats.magicResist
      };
    }
    
    return null; // No hardcoded fallbacks
  } catch (error) {
    console.warn('[Board Advisor] Error looking up monster stats:', error);
    return null; // No hardcoded fallbacks
  }
}

// Helper function to get equipment stats from stored run data
function getEquipmentStats(equipId, runData) {
  try {
    if (!equipId || !runData?.setup?.pieces) {
      return null; // No hardcoded fallbacks
    }
    
    // Find the piece with matching equipId
    const piece = runData.setup.pieces.find(p => 
      p.equipId === equipId || 
      p.equipment?.id === equipId || 
      p.equipment?.name === equipId
    );
    
    if (piece?.equipmentStat && piece?.equipmentTier) {
      return {
        stat: piece.equipmentStat,
        tier: piece.equipmentTier
      };
    }
    
    return null; // No hardcoded fallbacks
  } catch (error) {
    console.warn('[Board Advisor] Error looking up equipment stats:', error);
    return null; // No hardcoded fallbacks
  }
}

// Function to copy replay link (called from onclick handlers)
async function loadRecommendedSetup(setup) {
  console.log('[Board Advisor] loadRecommendedSetup called with:', setup);
  try {
    // Check if autosetup is enabled (required for loading setups)
    const playerContext = globalThis.state.player.getSnapshot().context;
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check autosetup mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("autosetup")) {
      alert('Autosetup mode is required to load setups. Please enable Autosetup in your game settings.');
      return;
    }
    
    if (!setup || !Array.isArray(setup) || setup.length === 0) {
      console.warn('[Board Advisor] Invalid setup data provided:', setup);
      alert('Invalid setup data provided');
      return;
    }
    
    // Setup is already in Setup_Manager.js format (monsterId, equipId, tileIndex)
    // Filter out any pieces without monsterId OR equipId (invalid pieces)
    const boardSetup = setup.filter(piece => piece.monsterId || piece.equipId);
    
    if (boardSetup.length === 0) {
      console.warn('[Board Advisor] No valid player pieces in setup');
      alert('No valid player pieces found in this setup');
      return;
    }
    
    console.log('[Board Advisor] Loading recommended setup:', boardSetup);
    
    // Load the setup using the same method as Setup Manager
    globalThis.state.board.send({
      type: "autoSetupBoard",
      setup: boardSetup
    });
    
    // Update button text to show success
    // Note: Button reference will be handled by the calling click handler
    console.log('[Board Advisor] Setup loaded successfully - button feedback will be handled by click handler');
    
    console.log('[Board Advisor] Setup loaded successfully');
  } catch (error) {
    console.error('[Board Advisor] Error loading setup:', error);
    alert('Error loading setup: ' + error.message);
  }
}

// Keep the old function for backward compatibility but rename it
async function copyReplayLink(setup) {
  // Redirect to the new load function
  return loadRecommendedSetup(setup);
}

// Make lookup functions available globally for button onclick handlers
window.getMonsterName = getMonsterName;
window.getEquipmentName = getEquipmentName;
window.loadRecommendedSetup = loadRecommendedSetup;
window.getMonsterStats = getMonsterStats;
window.formatMonsterStats = formatMonsterStats;
window.getEquipmentStats = getEquipmentStats;
window.copyReplayLink = copyReplayLink;

// Add a simple test function to check button status
window.testLoadSetupButton = function() {
  console.log('[Board Advisor] === TESTING LOAD SETUP BUTTON ===');
  
  // Check if recommendations display exists
  const recommendationsDisplay = document.getElementById('recommendations-display');
  console.log('[Board Advisor] Recommendations display found:', !!recommendationsDisplay);
  
  if (recommendationsDisplay) {
    console.log('[Board Advisor] Recommendations display innerHTML length:', recommendationsDisplay.innerHTML.length);
    console.log('[Board Advisor] Recommendations display innerHTML preview:', recommendationsDisplay.innerHTML.substring(0, 200));
  }
  
  // Find all load setup buttons
  const buttons = document.querySelectorAll('.copy-replay-btn');
  console.log('[Board Advisor] Found', buttons.length, 'buttons with class copy-replay-btn');
  
  buttons.forEach((button, index) => {
    console.log(`[Board Advisor] Button ${index}:`, button);
    console.log(`[Board Advisor] Button ${index} textContent:`, button.textContent);
    console.log(`[Board Advisor] Button ${index} data-setup-index:`, button.getAttribute('data-setup-index'));
    console.log(`[Board Advisor] Button ${index} classes:`, button.classList.toString());
  });
  
  // Check global setups
  console.log('[Board Advisor] window.boardAdvisorSetups:', window.boardAdvisorSetups);
  console.log('[Board Advisor] window.boardAdvisorSetups length:', window.boardAdvisorSetups ? window.boardAdvisorSetups.length : 'undefined');
  
  return {
    recommendationsDisplay: !!recommendationsDisplay,
    buttonCount: buttons.length,
    setupsAvailable: window.boardAdvisorSetups ? window.boardAdvisorSetups.length : 0
  };
};

// Add a manual test function to test setup loading directly
window.testLoadSetupManually = function() {
  console.log('[Board Advisor] === MANUAL SETUP LOAD TEST ===');
  
  if (!window.boardAdvisorSetups || window.boardAdvisorSetups.length === 0) {
    console.log('[Board Advisor] No setup data available');
    return false;
  }
  
  const setupData = window.boardAdvisorSetups[0];
  console.log('[Board Advisor] Testing with setup data:', setupData);
  
  if (setupData) {
    console.log('[Board Advisor] Calling loadRecommendedSetup directly...');
    return window.loadRecommendedSetup(setupData);
  }
  
  return false;
};

// Wait for utility API to be ready for better equipment name lookups
document.addEventListener('utility-api-ready', () => {
  console.log('[Board Advisor] Utility API is ready, equipment lookups should work better now');
});

// Force-update all data sources when panel opens
async function forceUpdateAllData() {
  try {
    const now = Date.now();
    const timeSinceLastLoad = now - analysisState.lastDataLoadTime;
    const MIN_LOAD_INTERVAL = 2000; // 2 seconds minimum between loads
    
    // Skip force-update if data was recently loaded, but still trigger analysis
    if (timeSinceLastLoad < MIN_LOAD_INTERVAL) {
      console.log(`[Board Advisor] Skipping force-update - data loaded ${timeSinceLastLoad}ms ago`);
      
      // Still trigger analysis even if we skip the force-update
      console.log('[Board Advisor] Triggering analysis after skipped force-update...');
      setTimeout(() => {
        debouncedAnalyzeCurrentBoard();
      }, 100);
      return;
    }
    
    console.log('[Board Advisor] Starting force-update of all data sources...');
    
    // 1. Force-update RunTracker data
    console.log('[Board Advisor] Force-updating RunTracker data...');
    await loadRunTrackerData(false); // Don't trigger analysis yet
    
    // 2. Force-update Board Analyzer data
    console.log('[Board Advisor] Force-updating Board Analyzer data...');
    await loadBoardAnalyzerData(false); // Don't trigger analysis yet
    
    // Update last load time
    analysisState.lastDataLoadTime = now;
    
    // 4. Current map data is already refreshed by the data loading above
    
    // 5. Force refresh panel display after all data is loaded
    console.log('[Board Advisor] Force-refreshing panel display...');
    if (panelState.isOpen) {
      await refreshPanelData();
    }
    
    console.log('[Board Advisor] Force-update completed');
    
    // Trigger analysis after force-update completes
    console.log('[Board Advisor] Triggering analysis after force-update...');
    setTimeout(() => {
      debouncedAnalyzeCurrentBoard();
    }, 100);
  } catch (error) {
    console.error('[Board Advisor] Error during force-update:', error);
  }
}

// Data loading coordinator to ensure proper order of operations
async function loadAllDataSources(triggerAnalysis = true) {
  console.log('[Board Advisor] Starting coordinated data loading...');
  
  // Prevent duplicate data loading
  if (analysisState.isDataLoading) {
    console.log('[Board Advisor] Data loading already in progress, skipping...');
    return false;
  }
  
  // Set data loading state to prevent analysis from running
  analysisState.isDataLoading = true;
  
  try {
    // Ensure IndexedDB is ready first
    if (!isDBReady) {
      console.log('[Board Advisor] Initializing IndexedDB before data loading...');
      await initSandboxDB();
    }
    
    // Load all data sources in parallel but wait for completion
    const loadPromises = [];
    
    // Load RunTracker data
    if (window.RunTrackerAPI && window.RunTrackerAPI._initialized) {
      loadPromises.push(loadRunTrackerData(false));
    } else {
      console.log('[Board Advisor] RunTracker not available yet');
    }
    
    // Load Board Analyzer data
    loadPromises.push(loadBoardAnalyzerData(false));
    
    // Wait for all data loading to complete
    const results = await Promise.allSettled(loadPromises);
    
    console.log('[Board Advisor] Data loading completed:', {
      runTracker: results[0]?.status === 'fulfilled' ? 'success' : 'failed',
      boardAnalyzer: results[1]?.status === 'fulfilled' ? 'success' : 'failed'
    });
    
    // Update last load time and clear data loading state
    analysisState.lastDataLoadTime = Date.now();
    analysisState.isDataLoading = false;
    
    // Only trigger analysis after all data is loaded
    if (triggerAnalysis) {
      setTimeout(() => {
        console.log('[Board Advisor] All data loaded, triggering analysis...');
        debouncedAnalyzeCurrentBoard();
      }, 200);
    }
    
    return true;
  } catch (error) {
    console.error('[Board Advisor] Error in coordinated data loading:', error);
    analysisState.isDataLoading = false; // Clear state on error
    return false;
  }
}

// Load RunTracker data
function loadRunTrackerData(triggerAnalysis = true) {
  try {
    if (window.RunTrackerAPI && window.RunTrackerAPI._initialized) {
      runTrackerData = window.RunTrackerAPI.getAllRuns();
      console.log('[Board Advisor] Loaded RunTracker data:', {
        totalRuns: runTrackerData.metadata?.totalRuns || 0,
        totalMaps: runTrackerData.metadata?.totalMaps || 0,
        maps: Object.keys(runTrackerData.runs || {}).length
      });
      
      // Convert RunTracker data to our format
      convertRunTrackerData();
      
      // Only trigger automatic analysis if explicitly requested and panel is open
      if (triggerAnalysis && panelState.isOpen) {
        setTimeout(() => {
          console.log('[Board Advisor] Auto-analyzing board after RunTracker data conversion...');
          debouncedAnalyzeCurrentBoard();
        }, 200);
      }
      
      return true;
    } else {
      console.log('[Board Advisor] RunTracker not available yet');
      return false;
    }
  } catch (error) {
    console.error('[Board Advisor] Error loading RunTracker data:', error);
    return false;
  }
}


// =======================
// 3. BOARD ANALYZER RUN STORAGE (IndexedDB)
// =======================


// Add a Board Analyzer run to storage (IndexedDB) - ONLY Board Analyzer runs are saved
async function addBoardAnalyzerRun(runData) {
  try {
    if (!runData || !runData.roomId) {
      console.warn('[Board Advisor] Invalid run data:', runData);
      return false;
    }
    
    // ONLY accept Board Analyzer runs
    if (runData.source !== 'board_analyzer') {
      console.log('[Board Advisor] Skipping non-Board Analyzer run - only Board Analyzer runs are saved to IndexedDB');
      return false;
    }
    
    const roomId = runData.roomId;
    
    // Validate that we have basic required data
    if (!runData.ticks && !runData.rankPoints) {
      console.warn('[Board Advisor] Skipping Board Analyzer run - no performance data (ticks or rankPoints)');
      return false;
    }
    
    // Validate that we have a seed (required for accurate replays)
    if (!runData.seed) {
      console.warn('[Board Advisor] Skipping Board Analyzer run - no seed data');
      return false;
    }
    
    // Prepare the Board Analyzer run data
    const boardAnalyzerRun = {
      timestamp: runData.timestamp || Date.now(),
      seed: runData.seed,
      roomId: runData.roomId,
      ticks: runData.ticks,
      rankPoints: runData.rankPoints,
      completed: runData.completed,
      playerMonsters: runData.playerMonsters || [],
      playerEquipment: runData.playerEquipment || [],
      boardSetup: runData.boardSetup,
      date: new Date().toISOString().split('T')[0],
      source: 'board_analyzer' // Keep the source as board_analyzer
    };
    
    // Add to IndexedDB
    await addSandboxRunToDB(boardAnalyzerRun);
    
    console.log(`[Board Advisor] Added Board Analyzer run for ${roomId}: ${runData.ticks} ticks, ${runData.rankPoints} points`);
    
    return true;
  } catch (error) {
    console.error('[Board Advisor] Error adding Board Analyzer run:', error);
    return false;
  }
}

// Convert Board Analyzer data to performance tracker format (IndexedDB)
async function convertBoardAnalyzerData() {
  try {
    const currentBoard = dataCollector.getCurrentBoardData();
    if (!currentBoard) {
      console.log('[Board Advisor] No current board data available, skipping Board Analyzer conversion');
      return false;
    }
    
    const roomId = currentBoard.roomId;
    
    // Get Board Analyzer runs for current room from IndexedDB
    const boardAnalyzerRunsForRoom = await getSandboxRunsForRoom(roomId);
    
    if (!boardAnalyzerRunsForRoom || boardAnalyzerRunsForRoom.length === 0) {
      console.log(`[Board Advisor] No Board Analyzer data for current room ${roomId}`);
      return false;
    }
    
    // console.log(`[Board Advisor] Converting ${boardAnalyzerRunsForRoom.length} Board Analyzer runs for room: ${roomId}`);
    
    // Note: We can convert Board Analyzer data even without a current board setup
    // The Board Analyzer data contains its own board setups that we can analyze
    
    // Convert all Board Analyzer runs for this room
    console.log(`[Board Advisor] Converting ${boardAnalyzerRunsForRoom.length} runs from IndexedDB for room ${roomId}`);
    let convertedCount = 0;
    let skippedCount = 0;
    
    boardAnalyzerRunsForRoom.forEach((run, index) => {
      const convertedRun = {
        id: `sandbox_${run.timestamp}_${index}`,
        timestamp: run.timestamp,
        seed: run.seed,
        roomId: run.roomId,
        mapName: currentBoard.mapName,
        ticks: run.ticks,
        rankPoints: run.rankPoints,
        completed: run.completed,
        winner: 'nonVillains',
        boardSetup: run.boardSetup ? dataCollector.serializeBoardSetup(run.boardSetup) : (currentBoard.boardSetup || []),
        playerMonsters: run.playerMonsters,
        playerEquipment: run.playerEquipment,
        source: 'sandbox',
        isSandbox: true
      };
      
      // Use deduplication function
      if (addRunIfNotExists(convertedRun)) {
        convertedCount++;
      } else {
        skippedCount++;
      }
    });
    
    console.log(`[Board Advisor] Converted ${convertedCount} runs, skipped ${skippedCount} duplicates`);
    
    // console.log(`[Board Advisor] Converted ${boardAnalyzerRunsForRoom.length} Board Analyzer runs for ${roomId}`);
    return true;
  } catch (error) {
    console.error('[Board Advisor] Error converting sandbox data:', error);
    return false;
  }
}

// Load Board Analyzer data from IndexedDB
async function loadBoardAnalyzerData(triggerAnalysis = true) {
  try {
    console.log('[Board Advisor] Loading Board Analyzer data...');
    const success = await convertBoardAnalyzerData();
    
    // Only trigger automatic analysis if explicitly requested and panel is open
    if (triggerAnalysis && panelState.isOpen) {
      setTimeout(() => {
        console.log('[Board Advisor] Auto-analyzing board after sandbox data conversion...');
        debouncedAnalyzeCurrentBoard();
      }, 200);
    }
    
    return success;
  } catch (error) {
    console.error('[Board Advisor] Error loading sandbox data:', error);
    return false;
  }
}

// Convert Board Analyzer results to our analysis format
function convertBoardAnalyzerResults(boardAnalyzerResults) {
  try {
    if (!boardAnalyzerResults || !boardAnalyzerResults.results || !Array.isArray(boardAnalyzerResults.results)) {
      console.log('[Board Advisor] Invalid Board Analyzer results format');
      return;
    }

    const currentBoard = dataCollector.getCurrentBoardData();
    if (!currentBoard) {
      console.log('[Board Advisor] No current board data to match against');
      return;
    }

    const roomId = currentBoard.roomId;
    const roomName = currentBoard.mapName;
    
    console.log(`[Board Advisor] Current board data:`, {
      roomId: roomId,
      roomName: roomName,
      boardSetup: currentBoard.boardSetup
    });
    
    console.log(`[Board Advisor] Converting Board Analyzer data for room: ${roomName} (${roomId})`);

    // Process each result from Board Analyzer
    boardAnalyzerResults.results.forEach((result, index) => {
      if (!result || typeof result.ticks !== 'number') return;

      // Skip if no seed (required for accurate replays)
      if (!result.seed) {
        console.warn(`[Board Advisor] Skipping Board Analyzer result ${index + 1} - no seed data`);
        return;
      }
      

      // Serialize the board setup
      const serializedBoardSetup = dataCollector.serializeBoardSetup(currentBoard.boardSetup);

      const runData = {
        id: `board_analyzer_${Date.now()}_${index}`,
        timestamp: Date.now(),
        seed: result.seed,
        roomId: roomId,
        mapName: roomName,
        completed: result.completed,
        winner: result.completed ? 'nonVillains' : 'villains',
        ticks: result.ticks,
        rankPoints: result.rankPoints,
        boardSetup: serializedBoardSetup,
        playerMonsters: currentBoard.playerMonsters,
        playerEquipment: currentBoard.playerEquipment,
        source: 'board_analyzer'
      };

      // Add to performance tracker
      performanceTracker.runs.push(runData);

      // Also save as Board Analyzer run to IndexedDB
      addBoardAnalyzerRun(runData).then(boardAnalyzerSaved => {
      if (boardAnalyzerSaved) {
        console.log(`[Board Advisor] Board Analyzer run ${index + 1} saved to IndexedDB`);
      } else {
        console.warn(`[Board Advisor] Failed to save Board Analyzer run ${index + 1} to IndexedDB`);
      }
      }).catch(error => {
        console.error(`[Board Advisor] Error saving Board Analyzer run ${index + 1} to IndexedDB:`, error);
      });

      // Create pattern key for this setup
      const patternKey = createPatternKey(currentBoard.boardSetup);
      if (!performanceTracker.patterns.has(roomId)) {
        performanceTracker.patterns.set(roomId, new Map());
      }

      const roomPatterns = performanceTracker.patterns.get(roomId);
      if (!roomPatterns.has(patternKey)) {
        roomPatterns.set(patternKey, {
          setup: currentBoard.boardSetup,
          runs: [],
          averageTime: 0,
          averagePoints: 0,
          successRate: 0,
          bestTime: Infinity,
          bestPoints: 0
        });
      }

      const pattern = roomPatterns.get(patternKey);
      pattern.runs.push(runData);
      
      // Update pattern statistics
      const completedRuns = pattern.runs.filter(r => r.completed);
      pattern.averageTime = pattern.runs.reduce((sum, r) => sum + r.ticks, 0) / pattern.runs.length;
      pattern.averagePoints = pattern.runs.reduce((sum, r) => sum + r.rankPoints, 0) / pattern.runs.length;
      pattern.successRate = completedRuns.length / pattern.runs.length;
      pattern.bestTime = Math.min(pattern.bestTime, ...pattern.runs.map(r => r.ticks));
      pattern.bestPoints = Math.max(pattern.bestPoints, ...pattern.runs.map(r => r.rankPoints));

      console.log(`[Board Advisor] Added Board Analyzer run ${index + 1}: ${result.ticks} ticks, ${result.rankPoints} points, Completed: ${result.completed}`);
    });

    console.log(`[Board Advisor] Converted ${boardAnalyzerResults.results.length} Board Analyzer runs to performance tracker for ${roomName}`);

    // Clear Board Analyzer results to avoid duplicate processing
    window.__boardAnalyzerResults = null;

    // Update room statistics
    if (!performanceTracker.roomStats.has(roomId)) {
      performanceTracker.roomStats.set(roomId, {
        totalRuns: 0,
        completedRuns: 0,
        averageTime: 0,
        bestTime: Infinity,
        successRate: 0,
        setups: []
      });
    }

    const roomStats = performanceTracker.roomStats.get(roomId);
    const roomRuns = performanceTracker.runs.filter(r => r.roomId === roomId);
    const completedRoomRuns = roomRuns.filter(r => r.completed);
    
    roomStats.totalRuns = roomRuns.length;
    roomStats.completedRuns = completedRoomRuns.length;
    roomStats.averageTime = roomRuns.reduce((sum, r) => sum + r.ticks, 0) / roomRuns.length;
    roomStats.bestTime = Math.min(...roomRuns.map(r => r.ticks));
    roomStats.successRate = completedRoomRuns.length / roomRuns.length;

    console.log(`[Board Advisor] Updated room stats for ${roomName}: ${roomStats.totalRuns} runs, ${roomStats.completedRuns} completed, ${roomStats.successRate.toFixed(2)} success rate`);

  } catch (error) {
    console.error('[Board Advisor] Error converting Board Analyzer data:', error);
  }
}

// Convert RunTracker data to our analysis format
function convertRunTrackerData() {
  if (!runTrackerData || !runTrackerData.runs) return;
  
  try {
    // Get current board to only process relevant runs
    const currentBoard = dataCollector.getCurrentBoardData();
    if (!currentBoard) {
      console.log('[Board Advisor] No current board data available, skipping RunTracker conversion');
      return;
    }
    
    const currentRoomId = currentBoard.roomId;
    const currentMapName = currentBoard.mapName;
    
    console.log(`[Board Advisor] Converting RunTracker data for current board: ${currentMapName} (${currentRoomId})`);
    
    // First, try to find the map key that corresponds to the current room
    let targetMapKey = null;
    const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
    
    // Look for a map key that matches the current room
    for (const [mapKey, mapData] of Object.entries(runTrackerData.runs)) {
      const mapName = mapKey.replace('map_', '').replace(/_/g, ' ');
      let roomId = 'unknown';
      
      // Find room ID by map name
      for (const [id, name] of Object.entries(roomNames)) {
        if (name.toLowerCase() === mapName.toLowerCase()) {
          roomId = id;
          break;
        }
      }
      
      // If not found by exact name, try partial match
      if (roomId === 'unknown') {
        for (const [id, name] of Object.entries(roomNames)) {
          if (name.toLowerCase().includes(mapName.toLowerCase()) || 
              mapName.toLowerCase().includes(name.toLowerCase())) {
            roomId = id;
            break;
          }
        }
      }
      
      // If still unknown, try to use the mapKey directly as room ID
      if (roomId === 'unknown') {
        roomId = mapKey.replace('map_', '');
      }
      
      // If this matches our current room, we found our target
      if (roomId === currentRoomId) {
        targetMapKey = mapKey;
        console.log(`[Board Advisor] Found matching map key: ${mapKey} for room ${currentRoomId}`);
        break;
      }
    }
    
    // If we found a matching map, process only that one
    if (targetMapKey && runTrackerData.runs[targetMapKey]) {
      const mapData = runTrackerData.runs[targetMapKey];
      // console.log(`[Board Advisor] Processing runs for current room: ${currentRoomId}`);
      
      // Process speedrun data
      if (mapData.speedrun && Array.isArray(mapData.speedrun)) {
        mapData.speedrun.forEach(run => {
          if (run.time && run.setup) {
            const convertedRun = {
              id: run.timestamp || Date.now(),
              roomId: currentRoomId,
              ticks: run.time,
              rankPoints: run.points,
              completed: true,
              boardSetup: convertRunTrackerSetup(run.setup),
              seed: run.seed,
              timestamp: run.timestamp || Date.now(),
              source: 'run_tracker'
            };
            
            addRunIfNotExists(convertedRun);
          }
        });
      }
      
      // Process rank data
      if (mapData.rank && Array.isArray(mapData.rank)) {
        mapData.rank.forEach(run => {
          if (run.points > 0 && run.setup) {
            const convertedRun = {
              id: run.timestamp || Date.now(),
              roomId: currentRoomId,
              ticks: run.time,
              rankPoints: run.points,
              completed: true,
              boardSetup: convertRunTrackerSetup(run.setup),
              seed: run.seed,
              timestamp: run.timestamp || Date.now(),
              source: 'run_tracker'
            };
            
            addRunIfNotExists(convertedRun);
          }
        });
      }
    } else {
      console.log(`[Board Advisor] No RunTracker data found for current room: ${currentMapName} (${currentRoomId})`);
    }
    
    // Count runs for current room only
    const currentRoomRuns = performanceTracker.runs.filter(r => r.roomId === currentRoomId);
    const totalAvailableRuns = runTrackerData.metadata?.totalRuns || 0;
    
    console.log('[Board Advisor] Converted RunTracker data (optimized for current board):', {
      currentRoom: currentMapName,
      currentRoomId: currentRoomId,
      runsForCurrentRoom: currentRoomRuns.length,
      totalAvailableRuns: totalAvailableRuns,
      optimizationRatio: totalAvailableRuns > 0 ? Math.min(currentRoomRuns.length / totalAvailableRuns * 100, 100).toFixed(1) + '%' : 'N/A'
    });
    
    if (currentRoomRuns.length > 0) {
      console.log('[Board Advisor] Sample runs for current room:', currentRoomRuns.slice(0, 3).map(r => ({
        roomId: r.roomId,
        ticks: r.ticks,
        completed: r.completed,
        rankPoints: r.rankPoints
      })));
    } else {
      console.log(`[Board Advisor] No runs found for current room: ${currentMapName} (${currentRoomId})`);
    }
  } catch (error) {
    console.error('[Board Advisor] Error converting RunTracker data:', error);
  }
}

// Convert RunTracker setup format to our format
function convertRunTrackerSetup(setup) {
  if (!setup || !setup.pieces) return [];
  
  return setup.pieces.map(piece => ({
    tileIndex: piece.tile,
    monsterId: piece.monsterId,
    equipId: piece.equipId,
    gameId: piece.monsterId, // Use monsterId as gameId
    tier: piece.tier,
    level: piece.level,
    villain: false // RunTracker only tracks player pieces
  }));
}

// Update patterns from converted data
function updatePatterns(runData) {
  const roomId = runData.roomId;
  const setupHash = dataCollector.hashBoardSetup(runData.boardSetup);
  
  if (!performanceTracker.patterns.has(roomId)) {
    performanceTracker.patterns.set(roomId, new Map());
  }
  
  const roomPatterns = performanceTracker.patterns.get(roomId);
  
  if (!roomPatterns.has(setupHash)) {
    roomPatterns.set(setupHash, {
      setup: runData.boardSetup,
      runs: [],
      bestTime: Infinity,
      averageTime: 0,
      successRate: 0
    });
  }
  
  const pattern = roomPatterns.get(setupHash);
  pattern.runs.push(runData);
  
  // Update pattern statistics
  if (runData.ticks < pattern.bestTime) {
    pattern.bestTime = runData.ticks;
  }
  
  const completedRuns = pattern.runs.filter(r => r.completed);
  pattern.successRate = completedRuns.length / pattern.runs.length;
  
  if (completedRuns.length > 0) {
    pattern.averageTime = completedRuns.reduce((sum, r) => sum + r.ticks, 0) / completedRuns.length;
  }
  
  // Grade tracking removed - we only use ticks and rank points
  
  // Update room statistics
  if (!performanceTracker.roomStats.has(roomId)) {
    performanceTracker.roomStats.set(roomId, {
      totalRuns: 0,
      completedRuns: 0,
      bestTime: Infinity,
      averageTime: 0,
      setups: []
    });
  }
  
  const stats = performanceTracker.roomStats.get(roomId);
  stats.totalRuns++;
  
  if (runData.completed) {
    stats.completedRuns++;
    if (runData.ticks < stats.bestTime) {
      stats.bestTime = runData.ticks;
    }
    stats.setups.push(runData.boardSetup);
  }
  
  // Calculate average time for completed runs
  const roomCompletedRuns = performanceTracker.runs.filter(r => r.roomId === roomId && r.completed);
  if (roomCompletedRuns.length > 0) {
    stats.averageTime = roomCompletedRuns.reduce((sum, r) => sum + r.ticks, 0) / roomCompletedRuns.length;
  }
}

class DataCollector {
  constructor() {
    this.currentRun = null;
    this.isTracking = false;
  }

  // Resolve map ID to map name (same logic as RunTracker)
  resolveMapName(mapId) {
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
      console.warn('[Board Advisor] Error resolving map name:', error);
      return mapId;
    }
  }

  startTracking() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    console.log('[Board Advisor] Started data collection');
    
    // Listen for new games
    globalThis.state.board.on('newGame', (event) => {
      this.onGameStart(event);
    });

    // Listen for board changes to trigger automatic analysis
    globalThis.state.board.subscribe(({ context }) => {
      if (context.boardConfig && context.boardConfig.length > 0) {
        this.onBoardChange(context);
      }
    });

    // Listen for server results like RunTracker does
    this.setupServerResultsListener();
  }

  setupServerResultsListener() {
    try {
      // Listen for Board Analyzer results (primary method for sandbox mode)
      this.setupBoardAnalyzerListener();
      
      // Listen for game board subscription (fallback for non-sandbox mode)
      if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
        globalThis.state.board.subscribe(({ context }) => {
          const serverResults = context.serverResults;
          if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
            return;
          }
          
          // Create a unique key for this board update
          const boardKey = `${serverResults.seed}_${serverResults.rewardScreen.roomId || 'unknown'}`;
          
          // Check if we've recently processed this board update
          if (this.debouncedKeys && this.debouncedKeys.has(boardKey)) {
            console.log('[Board Advisor] Skipping duplicate server results (debounced):', boardKey);
            return;
          }
          
          // Debounce this board update
          if (!this.debouncedKeys) this.debouncedKeys = new Set();
          this.debouncedKeys.add(boardKey);
          setTimeout(() => this.debouncedKeys.delete(boardKey), 2000);
          
          // Parse and store the run data
          const runData = this.parseServerResults(serverResults);
          if (runData) {
            // All Board Analyzer runs are saved to IndexedDB
            addBoardAnalyzerRun(runData).catch(error => {
              console.error('[Board Advisor] Error saving Board Analyzer run:', error);
            });
            
            // Trigger automatic analysis if panel is open
            if (config.autoAnalyzeAfterRun && panelState.isOpen) {
              setTimeout(() => {
                console.log('[Board Advisor] Auto-analyzing board after server results...');
                debouncedAnalyzeCurrentBoard();
              }, 500);
            }
            
            // Trigger immediate panel refresh after run completion
            if (panelState.isOpen) {
              setTimeout(() => {
                refreshPanelData();
              }, 1000); // Wait 1 second for data to be processed
            }
          }
        });
        console.log('[Board Advisor] Server results listener set up');
      }
    } catch (error) {
      console.error('[Board Advisor] Error setting up server results listener:', error);
    }
  }

  setupBoardAnalyzerListener() {
    try {
      // Poll for Board Analyzer results (since Board Analyzer stores them globally)
      const checkForBoardAnalyzerResults = () => {
        if (window.__boardAnalyzerResults && window.__boardAnalyzerResults.results) {
          console.log('[Board Advisor] Found Board Analyzer results:', window.__boardAnalyzerResults);
          
          // Get current board data for missing fields
          const currentBoard = this.getCurrentBoardData();
          
          // Process each result
          window.__boardAnalyzerResults.results.forEach((result, index) => {
            console.log(`[Board Advisor] Processing Board Analyzer result ${index + 1}:`, result);
            
            // Convert Board Analyzer result to Board Advisor format
            const runData = {
              id: Date.now() + index,
              timestamp: Date.now(),
              seed: result.seed,
              roomId: result.roomId || currentBoard?.roomId || 'unknown',
              mapName: result.mapName || currentBoard?.mapName || 'Unknown Map',
              completed: result.completed,
              winner: result.completed ? 'nonVillains' : 'villains',
              ticks: result.ticks,
              rankPoints: result.rankPoints,
              boardSetup: result.boardSetup || currentBoard?.boardSetup || [],
              playerMonsters: result.playerMonsters || currentBoard?.playerMonsters || [],
              playerEquipment: result.playerEquipment || currentBoard?.playerEquipment || [],
              source: 'board_analyzer'
            };
            
            // Save to IndexedDB
            addBoardAnalyzerRun(runData).then(saved => {
              if (saved) {
                console.log(`[Board Advisor] Board Analyzer run ${index + 1} saved to IndexedDB: ${runData.ticks} ticks, ${runData.rankPoints} points`);
              } else {
                console.warn(`[Board Advisor] Failed to save Board Analyzer run ${index + 1} to IndexedDB`);
              }
            }).catch(error => {
              console.error(`[Board Advisor] Error saving Board Analyzer run ${index + 1} to IndexedDB:`, error);
            });
          });
          
          // Clear the results to avoid reprocessing
          window.__boardAnalyzerResults = null;
        }
      };
      
      // Check for results every 500ms
      setInterval(checkForBoardAnalyzerResults, 500);
      console.log('[Board Advisor] Board Analyzer results listener set up');
    } catch (error) {
      console.error('[Board Advisor] Error setting up Board Analyzer listener:', error);
    }
  }

  parseServerResults(serverResults) {
    try {
      if (!serverResults || !serverResults.rewardScreen) {
        return null;
      }
      
      // Check if this is a sandbox run
      const isSandbox = this.detectSandboxRun(serverResults);
      
      // Extract basic run info
      const runData = {
        id: Date.now(),
        timestamp: Date.now(),
        seed: serverResults.seed,
        roomId: serverResults.rewardScreen.roomId || 'unknown',
        mapName: this.resolveMapName(serverResults.rewardScreen.roomId),
        completed: serverResults.rewardScreen.victory === true,
        winner: serverResults.rewardScreen.victory ? 'nonVillains' : 'villains',
        isSandbox: isSandbox,
        source: 'board_analyzer'
      };
      
      // Extract ticks from server results (like RunTracker)
      if (serverResults.rewardScreen.gameTicks !== undefined && serverResults.rewardScreen.gameTicks !== null) {
        runData.ticks = serverResults.rewardScreen.gameTicks;
      } else if (serverResults.time !== undefined && serverResults.time !== null) {
        runData.ticks = serverResults.time;
      }
      
      // Extract rank points from server results (like RunTracker)
      if (serverResults.rewardScreen.rank !== undefined && serverResults.rewardScreen.rank !== null) {
        runData.rankPoints = serverResults.rewardScreen.rank;
      } else if (serverResults.rankPoints !== undefined && serverResults.rankPoints !== null) {
        runData.rankPoints = serverResults.rankPoints;
      }
      
      // Get current board setup
      const currentBoard = this.getCurrentBoardData();
      if (currentBoard) {
        runData.boardSetup = currentBoard.boardSetup;
        runData.playerMonsters = currentBoard.playerMonsters;
        runData.playerEquipment = currentBoard.playerEquipment;
      }
      
      console.log('[Board Advisor] Parsed server results:', {
        roomId: runData.roomId,
        ticks: runData.ticks,
        rankPoints: runData.rankPoints,
        completed: runData.completed,
        isSandbox: runData.isSandbox,
        source: runData.source
      });
      
      return runData;
    } catch (error) {
      console.error('[Board Advisor] Error parsing server results:', error);
      return null;
    }
  }

  // Detect if a run is from sandbox mode
  detectSandboxRun(serverResults) {
    try {
      // Check various indicators that suggest sandbox mode
      
      // 1. Check if there's a sandbox flag in the server results
      if (serverResults.sandbox === true || serverResults.isSandbox === true) {
        return true;
      }
      
      // 2. Check if the game state indicates sandbox mode
      const gameState = globalThis.state?.player?.getSnapshot()?.context;
      if (gameState?.isSandbox === true || gameState?.sandboxMode === true) {
        return true;
      }
      
      // 3. Check if we're in a sandbox room (some rooms are sandbox-only)
      const roomId = serverResults.rewardScreen?.roomId;
      if (roomId && this.isSandboxRoom(roomId)) {
        return true;
      }
      
      // 4. Check for sandbox-specific patterns in the data
      // Sandbox runs often have certain characteristics
      if (serverResults.rewardScreen) {
        // Check if there are no network calls or if it's a local simulation
        if (serverResults.localSimulation === true || serverResults.offline === true) {
          return true;
        }
        
        // Check if the seed is a sandbox-specific pattern
        if (serverResults.seed && this.isSandboxSeed(serverResults.seed)) {
          return true;
        }
      }
      
      // 5. Check board context for sandbox indicators
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      if (boardContext?.isSandbox === true || boardContext?.sandboxMode === true) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('[Board Advisor] Error detecting sandbox run:', error);
      return false;
    }
  }

  // Check if a room ID corresponds to a sandbox room
  isSandboxRoom(roomId) {
    try {
      // Define known sandbox room IDs or patterns
      const sandboxRooms = [
        'sandbox',
        'test',
        'practice',
        'tutorial'
      ];
      
      const roomName = this.resolveMapName(roomId);
      if (!roomName) return false;
      
      const lowerRoomName = roomName.toLowerCase();
      return sandboxRooms.some(sandboxRoom => lowerRoomName.includes(sandboxRoom));
    } catch (error) {
      console.warn('[Board Advisor] Error checking sandbox room:', error);
      return false;
    }
  }

  // Check if a seed suggests sandbox mode
  isSandboxSeed(seed) {
    try {
      // Sandbox seeds often have specific patterns
      // This is a heuristic - adjust based on actual sandbox behavior
      if (typeof seed !== 'number') return false;
      
      // Check for common sandbox seed patterns
      // (This would need to be adjusted based on how the game generates sandbox seeds)
      return seed < 1000000 || seed > 2000000000; // Example patterns
    } catch (error) {
      console.warn('[Board Advisor] Error checking sandbox seed:', error);
      return false;
    }
  }

  onBoardChange(boardContext) {
    try {
      // Use smart cleanup that waits for all recommended pieces to be placed
      smartCleanupTileHighlights();
      
      // Debounce board changes to avoid excessive analysis
      if (this.boardChangeTimeout) {
        clearTimeout(this.boardChangeTimeout);
      }
      
      this.boardChangeTimeout = setTimeout(() => {
        this.triggerAutomaticAnalysis();
        this.refreshDataForCurrentMap();
      }, 1000); // Wait 1 second after board stops changing
    } catch (error) {
      console.error('[Board Advisor] Error in onBoardChange:', error);
    }
  }
  
  refreshDataForCurrentMap() {
    try {
      const currentBoard = this.getCurrentBoardData();
      if (!currentBoard) return;
      
      const roomId = currentBoard.roomId;
      const roomName = currentBoard.mapName;
      
      console.log(`[Board Advisor] Refreshing data for current map: ${roomName} (${roomId})`);
      
      // Load all data sources in coordinated manner and wait for completion
      loadAllDataSources(false).then(() => {
        // After all data is loaded, check if we have data for this room
        const roomRuns = performanceTracker.runs.filter(r => r.roomId === roomId);
        const roomPatterns = performanceTracker.patterns.get(roomId);
        
        // Count sandbox runs for this room
        const sandboxRunsForRoom = roomRuns.filter(r => r.source === 'sandbox');
        const runTrackerRunsForRoom = roomRuns.filter(r => r.source === 'runTracker');
        
        console.log(`[Board Advisor] Current map data:`, {
          roomId: roomId,
          roomName: roomName,
          runs: roomRuns.length,
          patterns: roomPatterns ? roomPatterns.size : 0,
          sandboxRuns: sandboxRunsForRoom.length,
          runTrackerRuns: runTrackerRunsForRoom.length,
          totalAvailableRuns: runTrackerData?.metadata?.totalRuns || 0
        });
        
        // If we have data for this room, trigger analysis
        if (roomPatterns && roomPatterns.size > 0) {
          console.log(`[Board Advisor] Found data for ${roomName}, triggering analysis...`);
          debouncedAnalyzeCurrentBoard();
        } else {
          console.log(`[Board Advisor] No data found for ${roomName}, showing no-data analysis...`);
          // Create and display no-data analysis
          const noDataAnalysis = boardAnalyzer.createNoDataAnalysis(roomId, performanceTracker.runs.length);
          updatePanelWithNoDataAnalysis(noDataAnalysis);
        }
      }).catch(error => {
        console.error('[Board Advisor] Error loading data for current map:', error);
        // Show error state in panel
        updatePanelStatus('Error loading data. Please try again.', 'error');
      });
    } catch (error) {
      console.error('[Board Advisor] Error refreshing data for current map:', error);
    }
  }

  triggerAutomaticAnalysis() {
    try {
      if (!config.autoAnalyzeOnBoardChange) return;
      
      const currentBoard = this.getCurrentBoardData();
      if (!currentBoard || !currentBoard.boardSetup.length) return;

      // Check if we have data for this room
      const roomId = currentBoard.roomId;
      const hasData = performanceTracker.patterns.has(roomId) && 
                     performanceTracker.patterns.get(roomId).size > 0;

      // Only auto-analyze if we have data and panel is open
      if (hasData && panelState.isOpen) {
        console.log('[Board Advisor] Auto-analyzing board due to change...');
        debouncedAnalyzeCurrentBoard();
      }
    } catch (error) {
      console.error('[Board Advisor] Error in triggerAutomaticAnalysis:', error);
    }
  }

  stopTracking() {
    this.isTracking = false;
    console.log('[Board Advisor] Stopped data collection');
  }

  onGameStart(event) {
    try {
      const boardContext = globalThis.state.board.getSnapshot().context;
      const playerContext = globalThis.state.player.getSnapshot().context;
      
      // Use same room ID detection logic as RunTracker
      let roomId = 'unknown';
      let mapName = 'unknown';
      
      // Try to get room ID from board context (same as RunTracker)
      if (boardContext.selectedMap?.selectedRoom?.id) {
        roomId = boardContext.selectedMap.selectedRoom.id;
        mapName = this.resolveMapName(roomId);
      } else if (boardContext.selectedMap?.id) {
        roomId = boardContext.selectedMap.id;
        mapName = this.resolveMapName(roomId);
      } else if (boardContext.area?.id) {
        roomId = boardContext.area.id;
        mapName = this.resolveMapName(roomId);
      } else if (playerContext.currentRoomId) {
        roomId = playerContext.currentRoomId;
        mapName = this.resolveMapName(roomId);
      }
      
      this.currentRun = {
        id: Date.now(),
        startTime: performance.now(),
        boardSetup: this.serializeBoardSetup(boardContext.boardConfig),
        playerMonsters: playerContext.monsters,
        playerEquipment: playerContext.equips,
        roomId: roomId,
        mapName: mapName,
        seed: event.world?.RNG?.seed || null,
        world: event.world
      };
      
      console.log('[Board Advisor] Game started:', {
        roomId: this.currentRun.roomId,
        mapName: this.currentRun.mapName,
        boardSetup: this.currentRun.boardSetup.length,
        seed: this.currentRun.seed
      });

      // Game end is now handled by server results listener
    } catch (error) {
      console.error('[Board Advisor] Error in onGameStart:', error);
    }
  }

  // onGameEnd is now handled by server results listener
  // This method is kept for compatibility but not used

  serializeBoardSetup(boardConfig) {
    if (!boardConfig) return [];
    
    // Reduced logging - only log when debugging is needed
    // console.log('[Board Advisor] serializeBoardSetup called with boardConfig:', boardConfig);
    
    // Filter for player pieces - be more flexible with the type check
    const playerPieces = boardConfig.filter(piece => {
      // Accept pieces with type 'player' or pieces without a type (assuming they're player pieces)
      return piece.type === 'player' || !piece.type || piece.type === 'custom';
    });
    
    // console.log('[Board Advisor] Player pieces after filtering:', playerPieces);
    
    return playerPieces.map(piece => {
      // console.log('[Board Advisor] Processing piece in serializeBoardSetup:', piece);
      
      // Check if the piece has monster data directly
      if (piece.monster) {
        // console.log('[Board Advisor] Piece has monster data:', piece.monster);
      }
      
      // Extract monster ID from multiple possible locations (like RunTracker does)
      let monsterId = piece.databaseId || piece.monsterId || piece.gameId;
      let originalMonsterId = monsterId; // Keep the original for lookup
      
      // If we still don't have a monster ID, try to get it from the monster object
      if (!monsterId && piece.monster) {
        monsterId = piece.monster.id || piece.monster.databaseId || piece.monster.gameId;
        originalMonsterId = monsterId;
      }
      
      // Strip INITIAL_ prefix if present, but keep originalMonsterId for lookup
      if (monsterId && monsterId.startsWith('INITIAL_')) {
        originalMonsterId = monsterId; // Keep the full ID with prefix for lookup
        monsterId = monsterId.substring(8); // Remove 'INITIAL_' (8 characters) for display
        // console.log('[Board Advisor] Stripped INITIAL_ prefix, real monster ID:', monsterId);
      }
      
      // console.log('[Board Advisor] Extracted monsterId:', monsterId, 'from piece:', piece);
      
      // Get monster name and stats from player's inventory
      let monsterName = null;
      let monsterStats = null;
      
      if (monsterId) {
        // Get monster from player's inventory
        const playerContext = globalThis.state?.player?.getSnapshot()?.context;
        if (playerContext?.monsters) {
          
          // Look for monster using the original ID (with prefix) first, then fall back to stripped ID
          let monster = playerContext.monsters.find(m => m.id === originalMonsterId);
          if (!monster) {
            monster = playerContext.monsters.find(m => m.id === monsterId);
          }
          
          if (monster) {
            // Get monster name from game metadata using gameId
            if (monster.gameId && globalThis.state?.utils?.getMonster) {
              try {
                const monsterData = globalThis.state.utils.getMonster(monster.gameId);
                if (monsterData?.metadata?.name) {
                  monsterName = monsterData.metadata.name;
                }
              } catch (e) {
                // getMonster might fail, continue without name
              }
            }
            
            // Get monster stats from the monster object
            monsterStats = {
              hp: monster.hp,
              ad: monster.ad,
              ap: monster.ap,
              armor: monster.armor,
              magicResist: monster.magicResist
            };
          } else {
            // Fallback: try to get monster data from the piece itself
            if (piece.monster) {
              monsterName = piece.monster.name;
              monsterStats = {
                hp: piece.monster.hp,
                ad: piece.monster.ad,
                ap: piece.monster.ap,
                armor: piece.monster.armor,
                magicResist: piece.monster.magicResist
              };
            }
          }
        }
      }
      
      // Get equipment name if equipment exists
      let equipmentName = null;
      if (piece.equipId) {
        // Try to get equipment name from player's inventory
        const playerContext = globalThis.state?.player?.getSnapshot()?.context;
        
        if (playerContext?.equips) {
          const equipment = playerContext.equips.find(e => e.id === piece.equipId);
          
          if (equipment && equipment.gameId && globalThis.state?.utils?.getEquipment) {
            try {
              const equipmentData = globalThis.state.utils.getEquipment(equipment.gameId);
              if (equipmentData?.metadata?.name) {
                equipmentName = equipmentData.metadata.name;
              }
            } catch (e) {
              // getEquipment might fail, continue without name
            }
          }
        }
      }
      
      // Save essential data using names as primary identifiers
      const serializedPiece = {
        tileIndex: piece.tileIndex,
        monsterName: monsterName, // Primary identifier
        equipmentName: equipmentName, // Primary identifier
        villain: piece.villain || false,
        monsterStats: monsterStats,
        // Keep IDs as fallback for compatibility
        monsterId: monsterId,
        equipId: piece.equipId
      };
      
      // console.log('[Board Advisor] Final serialized piece:', serializedPiece);
      return serializedPiece;
    });
  }

  // Resolve monster name from monsterId (like Setup_Manager's getMonsterInfo)
  getMonsterInfo(monsterId) {
    try {
      const playerSnapshot = globalThis.state.player.getSnapshot();
      if (!playerSnapshot || !playerSnapshot.context || !playerSnapshot.context.monsters) {
        return null;
      }
      
      const monster = playerSnapshot.context.monsters.find(m => m.id === monsterId);
      if (!monster) {
        return null;
      }
      
      // Calculate tier based on stats sum
      const statSum = (monster.hp || 0) + 
                      (monster.ad || 0) + 
                      (monster.ap || 0) + 
                      (monster.armor || 0) + 
                      (monster.magicResist || 0);
      
      let displayTier = 1;
      if (statSum >= 80) displayTier = 5;
      else if (statSum >= 70) displayTier = 4;
      else if (statSum >= 60) displayTier = 3;
      else if (statSum >= 50) displayTier = 2;
      
      // Get monster name from game metadata if not available in monster object
      let monsterName = monster.name;
      if (!monsterName && monster.gameId && globalThis.state?.utils?.getMonster) {
        try {
          const monsterData = globalThis.state.utils.getMonster(monster.gameId);
          if (monsterData?.metadata?.name) {
            monsterName = monsterData.metadata.name;
          }
        } catch (e) {
          // getMonster might fail, continue without name
        }
      }
      
      return {
        gameId: monster.gameId,
        tier: displayTier,
        actualTier: monster.tier,
        level: globalThis.state.utils.expToCurrentLevel(monster.exp),
        name: monsterName,
        stats: {
          hp: monster.hp,
          ad: monster.ad,
          ap: monster.ap,
          armor: monster.armor,
          magicResist: monster.magicResist
        }
      };
    } catch (error) {
      console.error('[Board Advisor] Error getting monster info:', error);
      return null;
    }
  }

  storeRunData(runData) {
    performanceTracker.runs.push(runData);
    
    // Smart cleanup: prioritize keeping best runs when we exceed 1000 runs
    if (performanceTracker.runs.length > 1000) {
      this.cleanupRuns();
    }

    // Update room statistics
    this.updateRoomStats(runData);
  }

  // Smart cleanup function that prioritizes keeping the best runs
  cleanupRuns() {
    const maxRuns = 1000;
    const currentRuns = performanceTracker.runs.length;
    
    if (currentRuns <= maxRuns) return;
    
    console.log(`[Board Advisor] Cleaning up runs: ${currentRuns} -> ${maxRuns}`);
    
    // Sort runs by priority (best runs first)
    const sortedRuns = [...performanceTracker.runs].sort((a, b) => {
      // 1. Failed runs go to the end (lowest priority)
      if (a.completed !== b.completed) {
        return a.completed ? -1 : 1;
      }
      
      // 2. Among completed runs, sort by ticks (best time first)
      if (a.completed && b.completed) {
        return a.ticks - b.ticks;
      }
      
      // 3. Among failed runs, keep more recent ones
      return b.timestamp - a.timestamp;
    });
    
    // Keep the best runs
    const runsToKeep = sortedRuns.slice(0, maxRuns);
    const runsToRemove = currentRuns - maxRuns;
    
    performanceTracker.runs = runsToKeep;
    
    console.log(`[Board Advisor] Cleanup complete: removed ${runsToRemove} runs (${runsToKeep.filter(r => !r.completed).length} failed, ${runsToKeep.filter(r => r.completed).length} completed)`);
  }

  // Update room statistics
  updateRoomStats(runData) {
    console.log('[Board Advisor] Stored run data:', {
      roomId: runData.roomId,
      ticks: runData.ticks,
      completed: runData.completed
    });
  }

  updateRoomStats(runData) {
    const roomId = runData.roomId;
    if (!performanceTracker.roomStats.has(roomId)) {
      performanceTracker.roomStats.set(roomId, {
        totalRuns: 0,
        completedRuns: 0,
        bestTime: Infinity,
        averageTime: 0,
        setups: []
      });
    }

    const stats = performanceTracker.roomStats.get(roomId);
    stats.totalRuns++;
    
    if (runData.completed) {
      stats.completedRuns++;
      if (runData.ticks < stats.bestTime) {
        stats.bestTime = runData.ticks;
      }
      stats.setups.push(runData.boardSetup);
    }
    
    // Calculate average time for completed runs
    const roomCompletedRuns = performanceTracker.runs.filter(r => r.roomId === roomId && r.completed);
    if (roomCompletedRuns.length > 0) {
      stats.averageTime = roomCompletedRuns.reduce((sum, r) => sum + r.ticks, 0) / roomCompletedRuns.length;
    }
  }

  updatePatterns(runData) {
    const roomId = runData.roomId;
    const setupHash = this.hashBoardSetup(runData.boardSetup);
    
    // console.log('[Board Advisor] updatePatterns called with:', {
    //   roomId,
    //   setupHash,
    //   boardSetup: runData.boardSetup,
    //   boardSetupLength: runData.boardSetup?.length
    // });
    
    if (!performanceTracker.patterns.has(roomId)) {
      performanceTracker.patterns.set(roomId, new Map());
    }
    
    const roomPatterns = performanceTracker.patterns.get(roomId);
    
    if (!roomPatterns.has(setupHash)) {
      roomPatterns.set(setupHash, {
        setup: runData.boardSetup,
        runs: [],
        bestTime: Infinity,
        averageTime: 0,
        successRate: 0
      });
      // console.log('[Board Advisor] Created new pattern with hash:', setupHash);
    } else {
      // console.log('[Board Advisor] Pattern already exists with hash:', setupHash);
    }
    
    const pattern = roomPatterns.get(setupHash);
    pattern.runs.push(runData);
    
    // Update pattern statistics
    if (runData.ticks < pattern.bestTime) {
      pattern.bestTime = runData.ticks;
    }
    
    const completedRuns = pattern.runs.filter(r => r.completed);
    pattern.successRate = completedRuns.length / pattern.runs.length;
    
    if (completedRuns.length > 0) {
      pattern.averageTime = completedRuns.reduce((sum, r) => sum + r.ticks, 0) / completedRuns.length;
    }
    
    // Grade tracking removed - we only use ticks and rank points
  }

  hashBoardSetup(setup) {
    if (!setup || !Array.isArray(setup) || setup.length === 0) {
      return 'empty';
    }
    return setup
      .map(piece => `${piece.tileIndex}-${piece.monsterName || piece.monsterId}-${piece.equipmentName || piece.equipId}-${piece.tier}`)
      .sort()
      .join('|');
  }

  getCurrentBoardData() {
    try {
      const now = Date.now();
      const CACHE_DURATION = 1000; // Cache for 1 second
      
      // Check cache first
      if (performanceCache.lastRoomDetection && 
          (now - performanceCache.lastRoomDetectionTime) < CACHE_DURATION) {
        return performanceCache.lastRoomDetection;
      }
      
      const boardContext = globalThis.state.board.getSnapshot().context;
      const playerContext = globalThis.state.player.getSnapshot().context;
      
      // Use same room ID detection logic as RunTracker
      let roomId = 'unknown';
      let mapName = 'unknown';
      let detectionMethod = 'none';
      
      if (boardContext.selectedMap?.selectedRoom?.id) {
        roomId = boardContext.selectedMap.selectedRoom.id;
        mapName = this.resolveMapName(roomId);
        detectionMethod = 'selectedMap.selectedRoom.id';
      } else if (boardContext.selectedMap?.id) {
        roomId = boardContext.selectedMap.id;
        mapName = this.resolveMapName(roomId);
        detectionMethod = 'selectedMap.id';
      } else if (boardContext.area?.id) {
        roomId = boardContext.area.id;
        mapName = this.resolveMapName(roomId);
        detectionMethod = 'area.id';
      } else if (playerContext.currentRoomId) {
        roomId = playerContext.currentRoomId;
        mapName = this.resolveMapName(roomId);
        detectionMethod = 'playerContext.currentRoomId (fallback)';
      }
      
      const result = {
        boardSetup: this.serializeBoardSetup(boardContext.boardConfig),
        playerMonsters: playerContext.monsters,
        playerEquipment: playerContext.equips,
        roomId: roomId,
        mapName: mapName,
        gameStarted: boardContext.gameStarted,
        detectionMethod: detectionMethod
      };
      
      // Cache the result
      performanceCache.lastRoomDetection = result;
      performanceCache.lastRoomDetectionTime = now;
      
      return result;
    } catch (error) {
      console.error('[Board Advisor] Error getting current board data:', error);
      return null;
    }
  }

  // Force refresh room detection by clearing any cached data
  forceRefreshRoomDetection() {
    console.log('[Board Advisor] Forcing room detection refresh...');
    
    // Clear all performance caches
    performanceCache.lastRoomDetection = null;
    performanceCache.lastRoomDetectionTime = 0;
    performanceCache.roomDetectionCache.clear();
    performanceCache.patternMatchingCache.clear();
    performanceCache.dataLoadingCache.clear();
    
    // Clear any cached analysis data
    analysisState.currentAnalysis = null;
    analysisState.lastBoardHash = null;
    
    // Force a fresh room detection
    const currentBoard = this.getCurrentBoardData();
    if (currentBoard) {
      console.log('[Board Advisor] Fresh room detection result:', {
        roomId: currentBoard.roomId,
        mapName: currentBoard.mapName,
        detectionMethod: currentBoard.detectionMethod
      });
    }
    
    return currentBoard;
  }
  
  // Clear pattern matching cache when board changes significantly
  clearPatternMatchingCache() {
    console.log('[Board Advisor] Clearing pattern matching cache due to board changes...');
    performanceCache.patternMatchingCache.clear();
  }
}

// CACHE FIX: Invalidate caches and refresh data after sandbox run saves
async function invalidateCachesAndRefreshData(roomId) {
  try {
    console.log(`[Board Advisor] Invalidating caches for room ${roomId} after sandbox run save...`);
    
    // 1. Clear all performance caches
    dataCollector.forceRefreshRoomDetection();
    
    // 2. Clear data loading cache specifically for this room
    const roomCacheKey = `room_${roomId}`;
    performanceCache.dataLoadingCache.delete(roomCacheKey);
    performanceCache.dataLoadingCache.delete('all_rooms');
    
    // 3. Clear pattern matching cache for current setup
    performanceCache.patternMatchingCache.clear();
    
    // 4. Clear analysis state to force fresh analysis
    analysisState.currentAnalysis = null;
    analysisState.lastBoardHash = null;
    
    // 5. Force refresh the data for the current room
    console.log('[Board Advisor] Force-refreshing data for current room...');
    await loadBoardAnalyzerData(false); // Don't trigger analysis yet
    
    // 6. If panel is open, refresh the display immediately
    if (panelState.isOpen) {
      console.log('[Board Advisor] Panel is open, refreshing display with fresh data...');
      setTimeout(async () => {
        try {
          await refreshPanelData();
          // Trigger fresh analysis with new data
          debouncedAnalyzeCurrentBoard();
        } catch (error) {
          console.warn('[Board Advisor] Error refreshing panel after cache invalidation:', error);
        }
      }, 100); // Small delay to ensure data is loaded
    }
    
    console.log('[Board Advisor] Cache invalidation and data refresh completed');
  } catch (error) {
    console.error('[Board Advisor] Error during cache invalidation:', error);
    throw error;
  }
}

// =======================
// 3. LEADERBOARD ANALYZER
// =======================

class LeaderboardAnalyzer {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  // Fetch leaderboard data using same methods as Cyclopedia
  async fetchLeaderboardData() {
    try {
      // Check cache first
      const cached = this.cache.get('leaderboard-data');
      if (cached && Date.now() - cached.timestamp < 600000) { // 10 minute cache
        return cached.data;
      }

      // Check if request is already pending
      if (this.pendingRequests.has('leaderboard-data')) {
        return await this.pendingRequests.get('leaderboard-data');
      }

      const requestPromise = this._fetchLeaderboardData();
      this.pendingRequests.set('leaderboard-data', requestPromise);

      try {
        const data = await requestPromise;
        this.cache.set('leaderboard-data', { data, timestamp: Date.now() });
        return data;
      } finally {
        this.pendingRequests.delete('leaderboard-data');
      }
    } catch (error) {
      console.error('[Board Advisor] Error fetching leaderboard data:', error);
      return null;
    }
  }

  async _fetchLeaderboardData() {
    try {
      // Use the same TRPC methods as Cyclopedia
      const [best, lbs, roomsHighscores] = await Promise.all([
        this._makeTRPCRequest('game.getTickHighscores'),
        this._makeTRPCRequest('game.getTickLeaderboards'),
        this._makeTRPCRequest('game.getRoomsHighscores')
      ]);

      return {
        best,
        lbs,
        roomsHighscores,
        ROOM_NAME: globalThis.state.utils.ROOM_NAME
      };
    } catch (error) {
      console.error('[Board Advisor] Error in _fetchLeaderboardData:', error);
      throw error;
    }
  }

  async _makeTRPCRequest(method) {
    try {
      const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
      const response = await fetch(`/api/trpc/${method}?batch=1&input=${inp}`, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'X-Game-Version': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data[0].result.data.json;
    } catch (error) {
      console.error(`[Board Advisor] TRPC request failed for ${method}:`, error);
      throw error;
    }
  }

  // Get leaderboard data for a specific room
  getRoomLeaderboard(leaderboardData, roomId) {
    if (!leaderboardData || !leaderboardData.roomsHighscores) return null;

    const roomName = leaderboardData.ROOM_NAME?.[roomId];
    if (!roomName) return null;

    // Handle the correct data structure from game.getRoomsHighscores
    // It returns {ticks: {roomId: data}, rank: {roomId: data}}
    const tickData = leaderboardData.roomsHighscores.ticks?.[roomId];
    const rankData = leaderboardData.roomsHighscores.rank?.[roomId];

    if (!tickData && !rankData) return null;

    return {
      roomId,
      roomName,
      tickData: tickData || [],
      rankData: rankData || []
    };
  }

  // Compare current run with leaderboard
  compareWithLeaderboard(currentRun, leaderboardData) {
    if (!currentRun || !leaderboardData) return null;

    const roomLeaderboard = this.getRoomLeaderboard(leaderboardData, currentRun.roomId);
    if (!roomLeaderboard) return null;

    const comparison = {
      roomId: currentRun.roomId,
      roomName: leaderboardData.ROOM_NAME?.[currentRun.roomId] || 'Unknown',
      currentTime: currentRun.ticks,
      currentPoints: currentRun.rankPoints,
      leaderboard: {
        speedrun: roomLeaderboard.tickData || [],
        rank: roomLeaderboard.rankData || []
      },
      analysis: {
        speedrunGap: null,
        rankGap: null,
        speedrunRank: null,
        rankPosition: null,
        recommendations: []
      }
    };

    // Analyze speedrun performance
    if (currentRun.ticks && comparison.leaderboard.speedrun.length > 0) {
      const bestTime = Math.min(...comparison.leaderboard.speedrun.map(r => r.ticks));
      comparison.analysis.speedrunGap = currentRun.ticks - bestTime;
      comparison.analysis.speedrunRank = comparison.leaderboard.speedrun
        .sort((a, b) => a.ticks - b.ticks)
        .findIndex(r => r.ticks >= currentRun.ticks) + 1;

      if (comparison.analysis.speedrunGap > 0) {
        comparison.analysis.recommendations.push({
          type: 'speedrun',
          priority: 'high',
          message: `You're ${comparison.analysis.speedrunGap} ticks behind the best time (${bestTime} ticks)`,
          suggestion: 'Focus on faster monster positioning and equipment optimization'
        });
      }
    }

    // Analyze rank performance
    if (currentRun.rankPoints && comparison.leaderboard.rank.length > 0) {
      const bestPoints = Math.max(...comparison.leaderboard.rank.map(r => r.rank));
      comparison.analysis.rankGap = bestPoints - currentRun.rankPoints;
      comparison.analysis.rankPosition = comparison.leaderboard.rank
        .sort((a, b) => b.rank - a.rank)
        .findIndex(r => r.rank <= currentRun.rankPoints) + 1;

      if (comparison.analysis.rankGap > 0) {
        comparison.analysis.recommendations.push({
          type: 'rank',
          priority: 'high',
          message: `You're ${comparison.analysis.rankGap} points behind the best score (${bestPoints} points)`,
          suggestion: 'Optimize monster selection and positioning for maximum damage output'
        });
      }
    }

    return comparison;
  }
}

// =======================
// 4. ANALYSIS ENGINE
// =======================

class AnalysisEngine {
  constructor(dataCollector, leaderboardAnalyzer) {
    this.dataCollector = dataCollector;
    this.leaderboardAnalyzer = leaderboardAnalyzer;
  }

  async analyzeCurrentBoard() {
    if (analysisState.isAnalyzing) {
      console.log('[Board Advisor] Analysis already in progress');
      return null;
    }
    
    if (analysisState.isDataLoading) {
      console.log('[Board Advisor] Data is still loading, skipping analysis');
      return null;
    }

    analysisState.isAnalyzing = true;
    // console.log('[Board Advisor] Starting board analysis...');

    try {
      const currentBoard = this.dataCollector.getCurrentBoardData();
      // console.log('[Board Advisor] Current board data:', currentBoard);
      // console.log('[Board Advisor] Current board setup length:', currentBoard?.boardSetup?.length);
      
      if (!currentBoard || !currentBoard.boardSetup.length) {
        // Board is empty - recommend best run from available data
        console.log('[Board Advisor] Board is empty, recommending best run from available data');
        return this.createEmptyBoardRecommendation();
      }

      // Board is not empty - use smart cleanup for tile highlights
      smartCleanupTileHighlights();

      const roomId = currentBoard.roomId;
      const roomPatterns = performanceTracker.patterns.get(roomId);
      
      // Only log detailed info if we have patterns or if debugging is needed
      if (roomPatterns && roomPatterns.size > 0) {
        console.log(`[Board Advisor] Looking for patterns for room: ${roomId}`);
        console.log(`[Board Advisor] Room patterns found: ${roomPatterns.size}`);
        
        // Check if we have patterns but they're empty or in old format
        const hasValidPatterns = Array.from(roomPatterns.values()).some(pattern => 
          pattern.setup && pattern.setup.length > 0 && 
          pattern.setup.some(piece => piece.monsterName || piece.equipmentName)
        );
        
        if (!hasValidPatterns) {
          console.log(`[Board Advisor] Patterns exist but are empty or in old format, clearing them`);
          performanceTracker.patterns.delete(roomId);
        }
      }
      
      // If no patterns for this room, try loading data from other sources
      if (!roomPatterns || roomPatterns.size === 0) {
        const totalRuns = performanceTracker.runs.length;
        
        // Data should have been loaded before analysis - no need to load here
        if (totalRuns === 0) {
          console.log('[Board Advisor] No data found after coordinated loading. This indicates insufficient data for this room.');
          return this.createNoDataAnalysis(roomId, totalRuns);
        } else {
          console.log(`[Board Advisor] No data for room "${roomId}". Total runs recorded: ${totalRuns}`);
          return this.createNoDataAnalysis(roomId, totalRuns);
        }
      }

      // Final check: if we still don't have roomPatterns data, return no-data analysis
      if (!roomPatterns || roomPatterns.size === 0) {
        console.log('[Board Advisor] No room patterns available after data loading attempts');
        return this.createNoDataAnalysis(roomId, performanceTracker.runs.length);
      }

      // Proceed with analysis since we have data

      // Fetch leaderboard data for comparison
      let leaderboardComparison = null;
      try {
        const leaderboardData = await this.leaderboardAnalyzer.fetchLeaderboardData();
        if (leaderboardData) {
          // Create a mock current run for comparison
          // Only create comparison if we have actual pattern data
          if (roomPatterns && roomPatterns.size > 0) {
            const firstPattern = Array.from(roomPatterns.values())[0];
            if (firstPattern && firstPattern.averageTime && firstPattern.averagePoints) {
              const currentRun = {
                roomId: roomId,
                ticks: firstPattern.averageTime,
                rankPoints: firstPattern.averagePoints
              };
              leaderboardComparison = this.leaderboardAnalyzer.compareWithLeaderboard(currentRun, leaderboardData);
            }
          }
        }
      } catch (error) {
        console.warn('[Board Advisor] Could not fetch leaderboard data:', error);
      }

      // Find similar setups
      const similarSetups = this.findSimilarSetups(currentBoard.boardSetup, roomPatterns);
      
      // Analyze current setup
      const currentAnalysis = this.analyzeSetup(currentBoard.boardSetup, roomPatterns);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        currentBoard, 
        similarSetups, 
        currentAnalysis,
        leaderboardComparison
      );

      // Predict performance
      const prediction = this.predictPerformance(currentBoard, similarSetups);

      analysisState.currentAnalysis = {
        roomId: currentBoard.roomId,
        currentBoard,
        similarSetups,
        currentAnalysis,
        recommendations,
        prediction,
        leaderboard: leaderboardComparison,
        timestamp: Date.now()
      };
      
      // Update board hash to prevent duplicate analysis
      analysisState.lastBoardHash = generateBoardHash(currentBoard.boardSetup);
      analysisState.lastAnalysisTime = Date.now();

      console.log('[Board Advisor] Analysis completed');
      console.log('[Board Advisor] Analysis result structure:', {
        hasRecommendations: !!recommendations,
        recommendationsCount: recommendations?.length || 0,
        hasSimilarSetups: !!similarSetups,
        similarSetupsCount: similarSetups?.length || 0,
        hasCurrentAnalysis: !!currentAnalysis,
        hasPrediction: !!prediction
      });
      return analysisState.currentAnalysis;

    } catch (error) {
      console.error('[Board Advisor] Analysis failed:', error);
      return null;
    } finally {
      analysisState.isAnalyzing = false;
    }
  }

  createNoDataAnalysis(roomId, totalRuns) {
    console.log('[Board Advisor] Creating no-data analysis for room:', roomId);
    
    const roomName = globalThis.state?.utils?.ROOM_NAME?.[roomId] || roomId;
    const hasAnyData = totalRuns > 0;
    
    
    const recommendations = [];
    
    
    // Add the standard no-data recommendation
    recommendations.push({
      type: 'info',
      title: '📊 No Data Available',
      description: hasAnyData 
        ? `No data found for ${roomName}. You have ${totalRuns} total runs recorded, but none in this specific room.`
        : 'No historical data available for analysis.',
      priority: 'high',
      actions: [
        {
          text: 'Play some games in this room',
          description: 'Complete a few runs in this room to build data for analysis'
        },
        {
          text: 'Run Board Analyzer',
          description: 'Use the Board Analyzer mod to collect detailed performance data'
        },
        {
          text: 'Check other rooms',
          description: hasAnyData ? `You have ${totalRuns} runs in other rooms - try analyzing those instead` : 'Start playing to build your first dataset'
        }
      ]
    });
    
    return {
      roomId,
      roomName,
      hasData: false,
      totalRuns,
      recommendations,
      similarSetups: [],
      currentAnalysis: {
        estimatedTime: 'N/A',
        confidence: 0,
        notes: ['No data available for analysis']
      },
      leaderboardComparison: null,
      patterns: new Map(),
      summary: {
        totalRuns: 0,
        averageTime: 'N/A',
        successRate: 'N/A',
        bestTime: 'N/A',
        worstTime: 'N/A',
        dataQuality: 'No data'
      },
      prediction: {
        confidence: 0,
        predictedTime: null,
        predictedPoints: null,
        successRate: null
      }
    };
  }

  async createEmptyBoardRecommendation() {
    console.log('[Board Advisor] Creating empty board recommendation');
    
    try {
      // Get best runs from all available data sources
      const bestRuns = await this.getBestRunsFromAllSources();
      
      if (bestRuns.length === 0) {
        return {
          roomId: 'empty',
          roomName: 'Empty Board',
          hasData: false,
          totalRuns: 0,
          recommendations: [{
            type: 'info',
            title: '📊 No Data Available',
            description: 'No runs found in IndexedDB or localStorage. Play some games to build data.',
            priority: 'high',
            actions: [{
              text: 'Start Playing',
              description: 'Complete some runs to build your first dataset'
            }]
          }],
          similarSetups: [],
          currentAnalysis: {
            estimatedTime: 'N/A',
            confidence: 0,
            notes: ['No data available for analysis']
          },
          leaderboardComparison: null,
          patterns: new Map(),
          summary: {
            totalRuns: 0,
            averageTime: 'N/A',
            successRate: 'N/A',
            bestTime: 'N/A',
            worstTime: 'N/A',
            dataQuality: 'No data'
          },
          prediction: {
            confidence: 0,
            predictedTime: null,
            predictedPoints: null,
            successRate: null
          }
        };
      }

      // Sort by performance (best time first for ticks focus)
      console.log('[Board Advisor] Found', bestRuns.length, 'runs from all sources');
      console.log('[Board Advisor] Focus area:', config.focusArea);
      
      if (config.focusArea === 'ticks') {
        console.log('[Board Advisor] Sorting by ticks (lowest first = best)');
        bestRuns.sort((a, b) => (a.ticks || Infinity) - (b.ticks || Infinity));
      } else {
        console.log('[Board Advisor] Sorting by points (highest first = best)');
        bestRuns.sort((a, b) => {
          // Primary sort: rank points (highest first)
          const pointsDiff = (b.points || 0) - (a.points || 0);
          if (pointsDiff !== 0) return pointsDiff;
          
          // Secondary sort: ticks (lowest first) as tiebreaker
          return (a.ticks || Infinity) - (b.ticks || Infinity);
        });
      }
      
      const bestRun = bestRuns[0];
      console.log('[Board Advisor] Best run found:', {
        roomId: bestRun.roomId,
        ticks: bestRun.ticks,
        points: bestRun.points,
        source: bestRun.source,
        setupPieces: bestRun.boardSetup?.length || 0
      });
      
      // Log the complete best run data to see what's in IndexedDB
      console.log('[Board Advisor] Complete best run data from IndexedDB:', bestRun);
      console.log('[Board Advisor] Best run boardSetup:', bestRun.boardSetup);
      
      // Debug: Show top 5 runs to see if 130-tick run is there
      console.log('[Board Advisor] Top 5 runs by ticks:');
      bestRuns.slice(0, 5).forEach((run, index) => {
        console.log(`  ${index + 1}. ${run.ticks} ticks (${run.source}, ${run.roomId})`);
        console.log(`     Setup pieces: ${run.boardSetup?.length || 0}`);
        if (run.boardSetup && run.boardSetup.length > 0) {
          run.boardSetup.forEach((piece, pieceIndex) => {
            console.log(`       Piece ${pieceIndex}: tile=${piece.tileIndex}, monsterId=${piece.monsterId}, equipId=${piece.equipId}`);
          });
        }
      });
      
      // Check if any runs have monsters
      console.log('[Board Advisor] Checking for runs with monsters...');
      const runsWithMonsters = bestRuns.filter(run => 
        run.boardSetup && run.boardSetup.some(piece => piece.monsterId)
      );
      console.log(`[Board Advisor] Found ${runsWithMonsters.length} runs with monsters out of ${bestRuns.length} total runs`);
      
      if (runsWithMonsters.length > 0) {
        console.log('[Board Advisor] First run with monster:', runsWithMonsters[0]);
        console.log('[Board Advisor] Monster pieces:', runsWithMonsters[0].boardSetup.filter(p => p.monsterId));
      }
      
      const roomName = globalThis.state?.utils?.ROOM_NAME?.[bestRun.roomId] || bestRun.roomId;
      
      // Convert setup to Setup_Manager.js format
      console.log('[Board Advisor] Original setup data:', bestRun.boardSetup);
      const setupManagerFormat = bestRun.boardSetup ? bestRun.boardSetup.map(piece => {
        console.log('[Board Advisor] Processing piece:', piece);
        console.log('[Board Advisor] Piece monster data:', {
          monsterId: piece.monsterId,
          gameId: piece.gameId,
          monster: piece.monster,
          monsterName: piece.monster?.name,
          monsterIdFromMonster: piece.monster?.id
        });
        
        // Try multiple ways to get monster ID
        const monsterId = piece.monsterId || 
                         piece.gameId || 
                         piece.monster?.id || 
                         piece.monster?.name;
        
        const convertedPiece = {
          monsterId: monsterId,
          equipId: piece.equipId,
          tileIndex: piece.tileIndex || piece.tile,
          tier: piece.tier,
          level: piece.level,
          monsterName: piece.monsterName,
          equipmentName: piece.equipmentName,
          monsterStats: piece.monsterStats
        };
        console.log('[Board Advisor] Converted piece:', convertedPiece);
        return convertedPiece;
      }).filter(convertedPiece => {
        // Include pieces that have either monsterId OR equipId (equipment-only pieces)
        const hasMonsterId = !!convertedPiece.monsterId;
        const hasEquipId = !!convertedPiece.equipId;
        const isValid = hasMonsterId || hasEquipId;
        console.log('[Board Advisor] Piece validation:', { hasMonsterId, hasEquipId, isValid }, convertedPiece);
        return isValid;
      }) : [];
      
      console.log('[Board Advisor] Converted setup format:', setupManagerFormat);
      
      // Highlight recommended tiles on the board
      if (setupManagerFormat.length > 0) {
        setTimeout(() => {
          highlightRecommendedTiles(setupManagerFormat);
        }, 500); // Small delay to ensure DOM is ready
      }
      
      return {
        roomId: bestRun.roomId,
        roomName: roomName,
        hasData: true,
        totalRuns: bestRuns.length,
        recommendations: [{
          type: 'improvement',
          title: '🏆 Best Available Setup',
          description: `Recommended setup from ${roomName} with ${bestRun.ticks} ticks`,
          priority: 'high',
          expectedImprovement: null,
          setup: setupManagerFormat, // Use Setup_Manager.js format
          bestRun: bestRun
        }],
        similarSetups: [],
        currentAnalysis: {
          estimatedTime: bestRun.ticks,
          confidence: 100,
          notes: ['Best run from available data']
        },
        leaderboardComparison: null,
        patterns: new Map(),
        summary: {
          totalRuns: bestRuns.length,
          averageTime: Math.round(bestRuns.reduce((sum, run) => sum + (run.ticks || 0), 0) / bestRuns.length),
          successRate: '100%',
          bestTime: bestRun.ticks,
          worstTime: bestRuns[bestRuns.length - 1]?.ticks || 'N/A',
          dataQuality: 'Good'
        },
        prediction: {
          confidence: 0,
          predictedTime: null,
          predictedPoints: null,
          successRate: null
        }
      };
    } catch (error) {
      console.error('[Board Advisor] Error creating empty board recommendation:', error);
      return this.createNoDataAnalysis('empty', 0);
    }
  }

  async getBestRunsFromAllSources() {
    const allRuns = [];
    
    // Get current room ID to filter runs
    const currentBoard = this.dataCollector.getCurrentBoardData();
    if (!currentBoard || !currentBoard.roomId) {
      console.warn('[Board Advisor] No current room detected, cannot filter runs');
      return [];
    }
    
    const currentRoomId = currentBoard.roomId;
    console.log(`[Board Advisor] Filtering runs for current room: ${currentRoomId} (${currentBoard.mapName})`);
    
    try {
      // Get runs from IndexedDB (sandbox data) - ONLY for current room
      console.log('[Board Advisor] Getting runs from IndexedDB...');
      const roomRuns = await getSandboxRunsForRoom(currentRoomId, 50); // Get top 50 runs for current room only
      console.log(`[Board Advisor] Got ${roomRuns.length} runs from current room ${currentRoomId}`);
      
      // Debug: Show ticks range for this room
      if (roomRuns.length > 0) {
        const ticks = roomRuns.map(run => run.ticks).filter(t => t > 0).sort((a, b) => a - b);
        console.log(`[Board Advisor] Room ${currentRoomId} ticks range: ${ticks[0]} - ${ticks[ticks.length - 1]} (best: ${ticks[0]})`);
      }
      
      allRuns.push(...roomRuns);
    } catch (error) {
      console.warn(`[Board Advisor] Could not get runs for current room ${currentRoomId}:`, error);
    }
    
    try {
      // Get runs from RunTracker (localStorage) - ONLY for current room
      console.log('[Board Advisor] Getting runs from RunTracker...');
      if (window.RunTrackerAPI && window.RunTrackerAPI.getAllRuns) {
        const runTrackerData = window.RunTrackerAPI.getAllRuns();
        if (runTrackerData.runs) {
          let runTrackerCount = 0;
          
          // Find runs for the current room only
          const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
          const currentRoomName = roomNames[currentRoomId] || currentRoomId;
          
          // Look for map keys that match the current room
          for (const [mapKey, mapData] of Object.entries(runTrackerData.runs)) {
            const mapName = mapKey.replace('map_', '').replace(/_/g, ' ');
            
            // Check if this map key corresponds to our current room
            if (mapName.toLowerCase().includes(currentRoomName.toLowerCase()) || 
                mapKey.includes(currentRoomId)) {
              console.log(`[Board Advisor] Found RunTracker data for current room: ${mapKey}`);
              
              if (mapData.speedrun) {
                allRuns.push(...mapData.speedrun);
                runTrackerCount += mapData.speedrun.length;
              }
              if (mapData.rank) {
                allRuns.push(...mapData.rank);
                runTrackerCount += mapData.rank.length;
              }
            }
          }
          
          console.log(`[Board Advisor] Got ${runTrackerCount} runs from RunTracker for room ${currentRoomId}`);
        }
      }
    } catch (error) {
      console.warn('[Board Advisor] Could not get RunTracker data:', error);
    }
    
    console.log('[Board Advisor] Total runs collected:', allRuns.length);
    
    // Filter out runs without valid board setups
    const validRuns = allRuns.filter(run => 
      run.boardSetup && 
      Array.isArray(run.boardSetup) && 
      run.boardSetup.length > 0 &&
      run.ticks > 0
    );
    
    console.log('[Board Advisor] Valid runs after filtering:', validRuns.length);
    return validRuns;
  }

  findSimilarSetups(currentSetup, roomPatterns) {
    const similar = [];
    const exactMatches = [];
    
    // Create cache key for current setup
    const setupKey = this.createSetupKey(currentSetup);
    
    // Check cache first
    if (performanceCache.patternMatchingCache.has(setupKey)) {
      const cached = performanceCache.patternMatchingCache.get(setupKey);
      console.log(`[Board Advisor] Using cached pattern matching results for setup: ${setupKey}`);
      return cached;
    }
    
    console.log(`[Board Advisor] Finding similar setups for current setup:`, currentSetup);
    console.log(`[Board Advisor] Available patterns:`, roomPatterns.size);
    
    // Pre-filter patterns by monster/equipment combinations for better performance
    const currentMonsters = new Set(currentSetup.map(p => p.monsterName || p.monsterId));
    const currentEquipment = new Set(currentSetup.map(p => p.equipmentName || p.equipId));
    const relevantPatterns = new Map();
    
    for (const [hash, pattern] of roomPatterns) {
      const patternMonsters = new Set(pattern.setup.map(p => p.monsterName || p.monsterId));
      const patternEquipment = new Set(pattern.setup.map(p => p.equipmentName || p.equipId));
      
      // Consider patterns that share at least one monster OR equipment combination
      if (this.setsIntersect(currentMonsters, patternMonsters) || 
          this.setsIntersect(currentEquipment, patternEquipment)) {
        relevantPatterns.set(hash, pattern);
      }
    }
    
    console.log(`[Board Advisor] Filtered to ${relevantPatterns.size} relevant patterns (from ${roomPatterns.size} total) based on monster/equipment combinations`);
    
    for (const [hash, pattern] of relevantPatterns) {
      const similarity = this.calculateSimilarity(currentSetup, pattern.setup);
      
      // Check if this is an exact creature match
      const isExactMatch = this.isExactCreatureMatch(currentSetup, pattern.setup);
      
      if (similarity > 0.1) { // 10% similarity threshold (more lenient)
        const setupData = {
          pattern,
          similarity,
          hash,
          isExactMatch
        };
        
        if (isExactMatch) {
          exactMatches.push(setupData);
        } else {
          similar.push(setupData);
        }
      }
    }
    
    // Prioritize exact matches first, then other similar setups
    const result = [...exactMatches.sort((a, b) => b.similarity - a.similarity), 
                   ...similar.sort((a, b) => b.similarity - a.similarity)];
    
    // Cache the result
    performanceCache.patternMatchingCache.set(setupKey, result);
    
    return result;
  }
  
  createSetupKey(setup) {
    return setup.map(p => `${p.tileIndex}-${p.monsterName || p.monsterId}-${p.equipmentName || p.equipId}`).sort().join('|');
  }
  
  setsIntersect(set1, set2) {
    for (const item of set1) {
      if (set2.has(item)) return true;
    }
    return false;
  }

  isExactCreatureMatch(setup1, setup2) {
    if (!setup1 || !setup2) return false;
    if (setup1.length !== setup2.length) return false;
    
    // Check if all creatures match exactly
    for (let i = 0; i < setup1.length; i++) {
      const piece1 = setup1[i];
      const piece2 = setup2[i];
      
      // Must have same tile, monster name, and equipment name
      if (piece1.tileIndex !== piece2.tileIndex) {
        return false;
      }
      
      // Monster matching: prioritize name over ID
      if (piece1.monsterName && piece2.monsterName) {
        if (piece1.monsterName !== piece2.monsterName) {
          return false;
        }
      } else if (piece1.monsterId !== piece2.monsterId) {
        return false;
      }
      
      // Equipment matching: prioritize name over ID
      if (piece1.equipmentName && piece2.equipmentName) {
        if (piece1.equipmentName !== piece2.equipmentName) {
          return false;
        }
      } else if (piece1.equipId !== piece2.equipId) {
        return false;
      }
      
      // Tier matching is flexible - undefined tier matches any tier
      if (piece1.tier !== undefined && piece2.tier !== undefined && piece1.tier !== piece2.tier) {
        return false;
      }
    }
    
    return true;
  }

  calculateSimilarity(setup1, setup2) {
    if (!setup1 || !setup2) return 0;
    
    const maxLength = Math.max(setup1.length, setup2.length);
    if (maxLength === 0) return 1;
    
    let matches = 0;
    let tileMatches = 0;
    const used = new Set();
    
    for (const piece1 of setup1) {
      for (let i = 0; i < setup2.length; i++) {
        if (used.has(i)) continue;
        
        const piece2 = setup2[i];
        if (this.piecesMatch(piece1, piece2)) {
          matches++;
          used.add(i);
          
          // Check if tiles also match for confidence calculation
          if (piece1.tileIndex === piece2.tileIndex) {
            tileMatches++;
          }
          break;
        }
      }
    }
    
    const baseSimilarity = matches / maxLength;
    
    // Reduce confidence if tiles don't match (but still allow the match)
    const tileMatchRatio = matches > 0 ? tileMatches / matches : 0;
    const tilePenalty = 1 - tileMatchRatio; // 0 if all tiles match, 1 if no tiles match
    
    // Apply tile penalty: reduce similarity by up to 30% for tile mismatches
    const adjustedSimilarity = baseSimilarity * (1 - (tilePenalty * 0.3));
    
    return adjustedSimilarity;
  }

  piecesMatch(piece1, piece2) {
    // Monster matching: prioritize monster name over ID
    // If either piece has no monster name, fall back to ID matching
    let monsterMatch = false;
    if (piece1.monsterName && piece2.monsterName) {
      // Both have monster names - they must match exactly
      monsterMatch = piece1.monsterName === piece2.monsterName;
    } else if (!piece1.monsterName && !piece2.monsterName) {
      // Neither has monster name - fall back to ID matching
      monsterMatch = piece1.monsterId === piece2.monsterId;
    } else {
      // One has monster name, one doesn't - try ID matching as fallback
      monsterMatch = piece1.monsterId === piece2.monsterId;
    }
    
    if (!monsterMatch) {
      return false;
    }
    
    // Equipment matching: prioritize equipment name over ID
    // If either piece has no equipment name, fall back to ID matching
    let equipmentMatch = false;
    if (piece1.equipmentName && piece2.equipmentName) {
      // Both have equipment names - they must match exactly
      equipmentMatch = piece1.equipmentName === piece2.equipmentName;
    } else if (!piece1.equipmentName && !piece2.equipmentName) {
      // Neither has equipment name - fall back to ID matching
      equipmentMatch = piece1.equipId === piece2.equipId;
    } else {
      // One has equipment name, one doesn't - try ID matching as fallback
      equipmentMatch = piece1.equipId === piece2.equipId;
    }
    
    if (!equipmentMatch) {
      return false;
    }
    
    // Tier matching is flexible - undefined tier matches any tier
    const tierMatch = piece1.tier === undefined || piece2.tier === undefined || piece1.tier === piece2.tier;
    
    return tierMatch;
  }

  analyzeSetup(setup, roomPatterns) {
    const setupHash = this.dataCollector.hashBoardSetup(setup);
    const pattern = roomPatterns.get(setupHash);
    
    if (pattern) {
      return {
        hasHistoricalData: true,
        bestTime: pattern.bestTime,
        averageTime: pattern.averageTime,
        successRate: pattern.successRate,
        totalRuns: pattern.runs.length
      };
    }
    
    // If no exact pattern but we have room patterns, we still have historical data
    if (roomPatterns && roomPatterns.size > 0) {
      // Calculate aggregate stats from all patterns in this room
      const allRuns = [];
      let bestTime = Infinity;
      let totalRuns = 0;
      
      for (const [hash, roomPattern] of roomPatterns) {
        allRuns.push(...roomPattern.runs);
        totalRuns += roomPattern.runs.length;
        if (roomPattern.bestTime < bestTime) {
          bestTime = roomPattern.bestTime;
        }
      }
      
      const completedRuns = allRuns.filter(r => r.completed);
      const averageTime = completedRuns.length > 0 ? 
        completedRuns.reduce((sum, r) => sum + r.ticks, 0) / completedRuns.length : 0;
      const successRate = completedRuns.length / allRuns.length;
      
      return {
        hasHistoricalData: true,
        bestTime: bestTime === Infinity ? null : bestTime,
        averageTime: averageTime,
        successRate: successRate,
        totalRuns: totalRuns
      };
    }
    
    return {
      hasHistoricalData: false,
      bestTime: null,
      averageTime: null,
      successRate: null,
      totalRuns: 0
    };
  }

  generateRecommendations(currentBoard, similarSetups, currentAnalysis, leaderboardComparison = null) {
    const recommendations = [];
    
    if (similarSetups.length === 0) {
      return [{
        type: 'info',
        title: 'No Historical Data',
        message: 'No similar setups found. Try running some games to build data.',
        priority: 'low'
      }];
    }

    // Add leaderboard-based recommendations first (highest priority)
    if (leaderboardComparison && leaderboardComparison.analysis) {
      const leaderboardRecs = leaderboardComparison.analysis.recommendations || [];
      recommendations.push(...leaderboardRecs.map(rec => ({
        type: 'leaderboard',
        title: `Leaderboard ${rec.type === 'speedrun' ? 'Speedrun' : 'Rank'} Analysis`,
        message: rec.message,
        suggestion: rec.suggestion,
        priority: rec.priority || 'high'
      })));

      // Add specific leaderboard insights
      if (leaderboardComparison.analysis.speedrunGap > 0) {
        recommendations.push({
          type: 'leaderboard',
          title: 'Speedrun Gap Analysis',
          message: `You're ${leaderboardComparison.analysis.speedrunGap} ticks behind the world record`,
          suggestion: 'Focus on optimizing monster movement patterns and reducing idle time',
          priority: 'high'
        });
      }

      if (leaderboardComparison.analysis.rankGap > 0) {
        recommendations.push({
          type: 'leaderboard',
          title: 'Rank Points Gap Analysis',
          message: `You're ${leaderboardComparison.analysis.rankGap} points behind the best score`,
          suggestion: 'Optimize for maximum damage output and efficient enemy clearing',
          priority: 'high'
        });
      }
    }

    // Find best performing similar setup with exact creature matches
    const exactMatches = similarSetups.filter(similar => {
      const currentSetup = currentBoard.boardSetup;
      const similarSetup = similar.pattern.setup;
      
      // Must have same number of pieces
      if (currentSetup.length !== similarSetup.length) return false;
      
      // Check if all creatures match exactly
      for (let i = 0; i < currentSetup.length; i++) {
        const currentPiece = currentSetup[i];
        const similarPiece = similarSetup[i];
        
        // Must have same monster ID and tier
        if (currentPiece.monsterId !== similarPiece.monsterId || 
            currentPiece.tier !== similarPiece.tier) {
          return false;
        }
      }
      
      return true;
    });

    const bestSimilar = exactMatches
      .filter(s => s.pattern.bestTime !== Infinity && s.pattern.bestTime > 0)
      .sort((a, b) => a.pattern.bestTime - b.pattern.bestTime)[0];

    if (bestSimilar && currentAnalysis.bestTime && 
        bestSimilar.pattern.bestTime < currentAnalysis.bestTime) {
      recommendations.push({
        type: 'improvement',
        title: 'Better Setup Available',
        message: `Found a similar setup that performed ${Math.round(currentAnalysis.bestTime - bestSimilar.pattern.bestTime)} ticks faster`,
        priority: 'high',
        expectedImprovement: currentAnalysis.bestTime - bestSimilar.pattern.bestTime,
        setup: bestSimilar.pattern.setup
      });
    }

    // Analyze monster positioning
    const positioningTips = this.analyzePositioning(currentBoard.boardSetup, similarSetups);
    recommendations.push(...positioningTips);

    // Equipment recommendations
    const equipmentTips = this.analyzeEquipment(currentBoard, similarSetups);
    recommendations.push(...equipmentTips);

    // Creature recommendations
    const creatureTips = this.analyzeCreatures(currentBoard, similarSetups);
    recommendations.push(...creatureTips);

    // Board Analyzer specific recommendations
    const boardAnalyzerTips = this.generateBoardAnalyzerRecommendations(currentBoard, similarSetups, currentAnalysis);
    recommendations.push(...boardAnalyzerTips);

    return recommendations;
  }

  analyzePositioning(currentSetup, similarSetups) {
    const tips = [];
    
    // Find common positioning patterns in successful setups
    const successfulSetups = similarSetups
      .filter(s => s.pattern.successRate > 0.7)
      .map(s => s.pattern.setup);

    if (successfulSetups.length > 0) {
      // Analyze tile usage patterns
      const tileUsage = this.analyzeTileUsage(successfulSetups);
      const currentTileUsage = this.getCurrentTileUsage(currentSetup);
      
      for (const [tile, usage] of tileUsage) {
        if (usage.frequency > 0.8 && !currentTileUsage.has(tile)) {
          tips.push({
            type: 'positioning',
            title: 'Consider Using Tile ' + tile,
            message: `${Math.round(usage.frequency * 100)}% of successful setups use this tile`,
            priority: 'medium',
            tile: tile
          });
        }
      }
    }

    return tips;
  }

  analyzeEquipment(currentBoard, similarSetups) {
    const tips = [];
    
    // Get performance data for current room
    const currentRoomId = currentBoard.roomId;
    const roomRuns = performanceTracker.runs.filter(r => r.roomId === currentRoomId);
    
    if (roomRuns.length === 0) return tips;
    
    // Sort runs by performance (best first)
    const sortedRuns = roomRuns.sort((a, b) => {
      if (config.focusArea === 'ticks') {
        return a.ticks - b.ticks;
      } else {
        return b.rankPoints - a.rankPoints;
      }
    });
    
    // Get top 10% of runs as "best performing"
    const topRunsCount = Math.max(1, Math.floor(sortedRuns.length * 0.1));
    const bestRuns = sortedRuns.slice(0, topRunsCount);
    const worstRuns = sortedRuns.slice(-topRunsCount);
    
    // Analyze equipment differences between best and worst runs
    const bestEquipment = this.analyzeEquipmentPatterns(bestRuns.map(r => r.boardSetup));
    const worstEquipment = this.analyzeEquipmentPatterns(worstRuns.map(r => r.boardSetup));
    
    // Find equipment that appears more in best runs than worst runs
    for (const [equipId, bestPattern] of bestEquipment) {
      const worstPattern = worstEquipment.get(equipId);
      const worstFrequency = worstPattern ? worstPattern.frequency : 0;
      const frequencyDifference = bestPattern.frequency - worstFrequency;
      
      // If this equipment appears significantly more in best runs
      if (frequencyDifference > 0.3 && bestPattern.frequency > 0.5) {
        const avgBestTime = config.focusArea === 'ticks' ? 
          Math.round(bestRuns.reduce((sum, r) => sum + r.ticks, 0) / bestRuns.length) :
          Math.round(bestRuns.reduce((sum, r) => sum + r.rankPoints, 0) / bestRuns.length);
        
        const equipmentName = getEquipmentName(equipId);
        
        tips.push({
          type: 'equipment',
          title: 'High-Performance Equipment',
          message: `${Math.round(bestPattern.frequency * 100)}% of your best runs use this equipment (vs ${Math.round(worstFrequency * 100)}% of slower runs)`,
          suggestion: `Consider using ${equipmentName} to achieve better times like your ${avgBestTime} ${config.focusArea === 'ticks' ? 'tick' : 'rank point'} runs`,
          priority: 'high',
          equipmentId: equipId,
          stat: bestPattern.stat,
          tier: bestPattern.tier
        });
      }
    }
    
    // Also check for equipment that appears in worst runs but not best runs (avoid these)
    for (const [equipId, worstPattern] of worstEquipment) {
      const bestPattern = bestEquipment.get(equipId);
      const bestFrequency = bestPattern ? bestPattern.frequency : 0;
      const frequencyDifference = worstPattern.frequency - bestFrequency;
      
      // If this equipment appears significantly more in worst runs
      if (frequencyDifference > 0.3 && worstPattern.frequency > 0.5) {
        const equipmentName = getEquipmentName(equipId);
        
        tips.push({
          type: 'equipment',
          title: 'Performance Impact Equipment',
          message: `${Math.round(worstPattern.frequency * 100)}% of your slower runs use this equipment (vs ${Math.round(bestFrequency * 100)}% of best runs)`,
          suggestion: `Consider replacing ${equipmentName} with equipment from your faster runs`,
          priority: 'medium',
          equipmentId: equipId,
          stat: worstPattern.stat,
          tier: worstPattern.tier
        });
      }
    }
    
    // Fallback to general popular equipment if no performance-based recommendations
    if (tips.length === 0) {
    const successfulSetups = similarSetups
      .filter(s => s.pattern.successRate > 0.7)
      .map(s => s.pattern.setup);

    if (successfulSetups.length > 0) {
      const equipmentPatterns = this.analyzeEquipmentPatterns(successfulSetups);
      
      for (const [equipId, pattern] of equipmentPatterns) {
        if (pattern.frequency > 0.6) {
          tips.push({
            type: 'equipment',
            title: 'Popular Equipment',
            message: `${Math.round(pattern.frequency * 100)}% of successful setups use this equipment`,
            priority: 'medium',
            equipmentId: equipId,
            stat: pattern.stat,
            tier: pattern.tier
          });
          }
        }
      }
    }

    return tips;
  }

  analyzeCreatures(currentBoard, similarSetups) {
    const tips = [];
    
    // Get performance data for current room
    const currentRoomId = currentBoard.roomId;
    const roomRuns = performanceTracker.runs.filter(r => r.roomId === currentRoomId);
    
    if (roomRuns.length === 0) return tips;
    
    // Sort runs by performance (best first)
    const sortedRuns = roomRuns.sort((a, b) => {
      if (config.focusArea === 'ticks') {
        return a.ticks - b.ticks;
      } else {
        return b.rankPoints - a.rankPoints;
      }
    });
    
    // Get top 10% of runs as "best performing"
    const topRunsCount = Math.max(1, Math.floor(sortedRuns.length * 0.1));
    const bestRuns = sortedRuns.slice(0, topRunsCount);
    const worstRuns = sortedRuns.slice(-topRunsCount);
    
    // Analyze creature differences between best and worst runs
    const bestCreatures = this.analyzeCreaturePatterns(bestRuns.map(r => r.boardSetup));
    const worstCreatures = this.analyzeCreaturePatterns(worstRuns.map(r => r.boardSetup));
    
    // Find creatures that appear more in best runs than worst runs
    for (const [monsterId, bestPattern] of bestCreatures) {
      const worstPattern = worstCreatures.get(monsterId);
      const worstFrequency = worstPattern ? worstPattern.frequency : 0;
      const frequencyDifference = bestPattern.frequency - worstFrequency;
      
      // If this creature appears significantly more in best runs
      if (frequencyDifference > 0.3 && bestPattern.frequency > 0.5) {
        const avgBestTime = config.focusArea === 'ticks' ? 
          Math.round(bestRuns.reduce((sum, r) => sum + r.ticks, 0) / bestRuns.length) :
          Math.round(bestRuns.reduce((sum, r) => sum + r.rankPoints, 0) / bestRuns.length);
        
        tips.push({
          type: 'creature',
          title: 'High-Performance Creature',
          message: `${Math.round(bestPattern.frequency * 100)}% of your best runs use this creature (vs ${Math.round(worstFrequency * 100)}% of slower runs)`,
          suggestion: `Consider using ${bestPattern.monsterName} to achieve better times like your ${avgBestTime} ${config.focusArea === 'ticks' ? 'tick' : 'rank point'} runs`,
          priority: 'high',
          monsterId: monsterId,
          monsterName: bestPattern.monsterName,
          tier: bestPattern.tier
        });
      }
    }
    
    // Also check for creatures that appear in worst runs but not best runs (avoid these)
    for (const [monsterId, worstPattern] of worstCreatures) {
      const bestPattern = bestCreatures.get(monsterId);
      const bestFrequency = bestPattern ? bestPattern.frequency : 0;
      const frequencyDifference = worstPattern.frequency - bestFrequency;
      
      // If this creature appears significantly more in worst runs
      if (frequencyDifference > 0.3 && worstPattern.frequency > 0.5) {
        tips.push({
          type: 'creature',
          title: 'Performance Impact Creature',
          message: `${Math.round(worstPattern.frequency * 100)}% of your slower runs use this creature (vs ${Math.round(bestFrequency * 100)}% of best runs)`,
          suggestion: `Consider replacing ${worstPattern.monsterName} with creatures from your faster runs`,
          priority: 'medium',
          monsterId: monsterId,
          monsterName: worstPattern.monsterName,
          tier: worstPattern.tier
        });
      }
    }
    
    // Fallback to general popular creatures if no performance-based recommendations
    if (tips.length === 0) {
      const successfulSetups = similarSetups
        .filter(s => s.pattern.successRate > 0.7)
        .map(s => s.pattern.setup);

      if (successfulSetups.length > 0) {
        const creaturePatterns = this.analyzeCreaturePatterns(successfulSetups);
        
        for (const [monsterId, pattern] of creaturePatterns) {
          if (pattern.frequency > 0.6) {
            tips.push({
              type: 'creature',
              title: 'Popular Creature',
              message: `${Math.round(pattern.frequency * 100)}% of successful setups use this creature`,
              priority: 'medium',
              monsterId: monsterId,
              monsterName: pattern.monsterName,
              tier: pattern.tier
            });
          }
        }
      }
    }

    return tips;
  }

  // Generate recommendations based on Board Analyzer data
  generateBoardAnalyzerRecommendations(currentBoard, similarSetups, currentAnalysis) {
    const recommendations = [];
    
    // Check if we have Board Analyzer or sandbox data
    const boardAnalyzerRuns = performanceTracker.runs.filter(r => r.source === 'board_analyzer');
    const sandboxRuns = performanceTracker.runs.filter(r => r.source === 'sandbox');
    const allRuns = [...boardAnalyzerRuns, ...sandboxRuns];
    
    if (allRuns.length === 0) {
      return recommendations;
    }

    // Check if we have a better setup recommendation available or generate one
    // Use available data source (prefer boardAnalyzerRuns if available, otherwise use allRuns)
    const currentRoomRuns = boardAnalyzerRuns.length > 0 
      ? boardAnalyzerRuns.filter(r => r.roomId === currentBoard.roomId)
      : allRuns.filter(r => r.roomId === currentBoard.roomId);
    const sortedRuns = currentRoomRuns.sort((a, b) => a.ticks - b.ticks);
    const bestOverallRun = sortedRuns[0];
    const currentPredictedTime = currentAnalysis?.prediction?.predictedTime || 366;
    
    if (bestOverallRun && bestOverallRun.ticks < currentPredictedTime) {
      const timeImprovement = currentPredictedTime - bestOverallRun.ticks;
      
      console.log(`[Board Advisor] Adding best setup recommendation: ${bestOverallRun.ticks} ticks (improvement: ${timeImprovement})`);
      
      // Ensure setup data has proper monster names
      const setupWithNames = bestOverallRun.boardSetup ? bestOverallRun.boardSetup.map(piece => {
        // Strip INITIAL_ prefix if present for proper name resolution
        let monsterId = piece.monsterId;
        if (monsterId && monsterId.startsWith('INITIAL_')) {
          monsterId = monsterId.substring(8); // Remove 'INITIAL_' (8 characters)
        }
        
        // Try to resolve monster name from multiple sources
        let monsterName = piece.monsterName;
        
        // If no monster name or it's the same as monster ID, try to resolve it
        if (!monsterName || monsterName === piece.monsterId || monsterName.startsWith('INITIAL_')) {
          // Try to get from player context first (same as IndexedDB data)
          const playerContext = globalThis.state?.player?.getSnapshot()?.context;
          if (playerContext?.monsters) {
            const monster = playerContext.monsters.find(m => m.id === monsterId);
            if (monster?.name) {
              monsterName = monster.name;
            }
          }
          
          // Try to get from game state utils
          if (!monsterName && globalThis.state?.utils?.getMonster) {
            try {
              const monsterData = globalThis.state.utils.getMonster(monsterId);
              if (monsterData?.metadata?.name) {
                monsterName = monsterData.metadata.name;
              }
            } catch (e) {
              // Try as numeric ID
              const numericId = parseInt(monsterId);
              if (!isNaN(numericId)) {
                const monsterData = globalThis.state.utils.getMonster(numericId);
                if (monsterData?.metadata?.name) {
                  monsterName = monsterData.metadata.name;
                }
              }
            }
          }
          
          // Fallback to getMonsterName function
          if (!monsterName) {
            monsterName = getMonsterName(monsterId);
          }
        }
        
        return {
          ...piece,
          monsterName: monsterName
        };
      }) : [];
      
      recommendations.push({
        type: 'improvement',
        title: '🏆 Best Available Setup',
        message: `Use this setup to achieve ${bestOverallRun.ticks} ticks (${timeImprovement} ticks faster than current prediction)`,
        suggestion: `This setup achieved your best time of ${bestOverallRun.ticks} ticks`,
        priority: 'high',
        setup: setupWithNames,
        expectedImprovement: timeImprovement,
        focusArea: config.focusArea || 'ticks'
      });
    }
    
    console.log(`[Board Advisor] Generating recommendations based on ${boardAnalyzerRuns.length} board_analyzer runs and ${sandboxRuns.length} sandbox runs`);
    console.log(`[Board Advisor] Total runs in performance tracker: ${performanceTracker.runs.length}`);
    console.log(`[Board Advisor] Run sources in performance tracker:`, [...new Set(performanceTracker.runs.map(r => r.source))]);
    
    // Analyze performance patterns from all available data
    const completedRuns = allRuns.filter(r => r.completed);
    const failedRuns = boardAnalyzerRuns.filter(r => !r.completed);
    
    // Generate recommendations based on selected focus area
    if (config.focusArea === 'ticks') {
      const ticksRecommendations = this.generateTicksRecommendations(completedRuns, similarSetups, currentBoard);
      recommendations.push(...ticksRecommendations);
    } else if (config.focusArea === 'ranks') {
      const ranksRecommendations = this.generateRanksRecommendations(completedRuns, similarSetups, currentBoard);
      recommendations.push(...ranksRecommendations);
    }
    
    // General reliability analysis (applies to both)
    if (failedRuns.length > 0) {
      const failureRate = failedRuns.length / boardAnalyzerRuns.length;
      
      if (failureRate > 0.3) {
        recommendations.push({
          type: 'reliability',
          title: 'Improve Success Rate',
          message: `${Math.round(failureRate * 100)}% of your runs fail.`,
          suggestion: 'Strengthen your setup with more defensive monsters or better positioning.',
          priority: 'high',
          focusArea: 'both'
        });
      }
    }
    
    return recommendations;
  }

  // Generate recommendations focused on time optimization
  generateTicksRecommendations(completedRuns, similarSetups, currentBoard) {
    const recommendations = [];
    
    if (completedRuns.length === 0) return recommendations;
    
    // Calculate average from top 10 best runs instead of all runs
    const sortedRuns = [...completedRuns].sort((a, b) => a.ticks - b.ticks);
    const top10Runs = sortedRuns.slice(0, Math.min(10, sortedRuns.length));
    const avgTime = top10Runs.reduce((sum, r) => sum + r.ticks, 0) / top10Runs.length;
    const bestTime = Math.min(...completedRuns.map(r => r.ticks));
    const worstTime = Math.max(...completedRuns.map(r => r.ticks));
    
    // Debug logging
    console.log('[Board Advisor] generateTicksRecommendations - completedRuns length:', completedRuns.length);
    console.log('[Board Advisor] generateTicksRecommendations - top10Runs length:', top10Runs.length);
    console.log('[Board Advisor] generateTicksRecommendations - avgTime (top 10):', Math.round(avgTime));
    console.log('[Board Advisor] generateTicksRecommendations - bestTime:', bestTime);
    console.log('[Board Advisor] generateTicksRecommendations - top10Runs ticks:', top10Runs.map(r => r.ticks));
    
    // Time consistency analysis - only for current setup
    const currentSetupRuns = completedRuns.filter(run => {
      if (!run.boardSetup || run.boardSetup.length !== currentBoard.boardSetup.length) return false;
      
      // Check if all pieces match exactly (monster, equipment, tile)
      for (let i = 0; i < currentBoard.boardSetup.length; i++) {
        const currentPiece = currentBoard.boardSetup[i];
        const runPiece = run.boardSetup[i];
        
        if (currentPiece.monsterId !== runPiece.monsterId || 
            currentPiece.equipId !== runPiece.equipId ||
            currentPiece.tileIndex !== runPiece.tileIndex) {
          return false;
        }
      }
      return true;
    });
    
    // Only analyze consistency if we have multiple runs with the current setup
    if (currentSetupRuns.length >= 3) {
      const currentSetupAvgTime = currentSetupRuns.reduce((sum, r) => sum + r.ticks, 0) / currentSetupRuns.length;
      const currentSetupBestTime = Math.min(...currentSetupRuns.map(r => r.ticks));
      const currentSetupWorstTime = Math.max(...currentSetupRuns.map(r => r.ticks));
      
      const currentSetupTimeVariance = currentSetupRuns.reduce((sum, r) => sum + Math.pow(r.ticks - currentSetupAvgTime, 2), 0) / currentSetupRuns.length;
      const currentSetupTimeStdDev = Math.sqrt(currentSetupTimeVariance);
      const currentSetupConsistencyRatio = currentSetupTimeStdDev / currentSetupAvgTime;
      
      if (currentSetupConsistencyRatio > 0.15) {
      recommendations.push({
        type: 'consistency',
        title: 'Improve Time Consistency',
          message: `Your runs with this setup vary significantly (${Math.round(currentSetupConsistencyRatio * 100)}% variation). Best: ${currentSetupBestTime}, Worst: ${currentSetupWorstTime}`,
          suggestion: 'Focus on consistent positioning and strategy to reduce time variance with this specific setup.',
        priority: 'medium',
        focusArea: 'ticks'
      });
      }
    }
    
    // Speed optimization suggestions
    const timeDifference = avgTime - bestTime;
    const improvementRatio = timeDifference / bestTime;
    
    // Only show speed optimization if there's meaningful room for improvement (at least 5% difference)
    if (improvementRatio > 0.05) {
      recommendations.push({
        type: 'speed',
        title: 'Optimize for Speed',
        message: `Your best time (${bestTime}) is ${Math.round(improvementRatio * 100)}% better than your average (${Math.round(avgTime)}). Room for improvement.`,
        suggestion: 'Focus on faster monster movement patterns and efficient positioning.',
        priority: 'high',
        focusArea: 'ticks'
      });
    } else if (improvementRatio > 0 && improvementRatio <= 0.05) {
      recommendations.push({
        type: 'speed',
        title: 'Consistent Performance',
        message: `Your best time (${bestTime}) is very close to your average (${Math.round(avgTime)}). Great consistency!`,
        suggestion: 'Try experimenting with different setups to find even better strategies.',
        priority: 'medium',
        focusArea: 'ticks'
      });
    }
    
    // Setup optimization for speed
    if (similarSetups && similarSetups.length > 1) {
      const currentSetup = similarSetups.find(s => s.setup === currentBoard.boardSetup);
      const fasterSetups = similarSetups.filter(s => s.pattern.averageTime < currentSetup?.pattern.averageTime);
      
      if (fasterSetups.length > 0) {
        const bestAlternative = fasterSetups[0];
        const improvement = Math.round((currentSetup.pattern.averageTime - bestAlternative.pattern.averageTime) / currentSetup.pattern.averageTime * 100);
        
        recommendations.push({
          type: 'optimization',
          title: 'Faster Setup Available',
          message: `Found ${fasterSetups.length} faster setups. Best improvement: ${improvement}% faster.`,
          suggestion: 'Consider testing alternative monster combinations for better speed.',
          priority: 'high',
          focusArea: 'ticks'
        });
      }
    }
    
    return recommendations;
  }

  // Generate recommendations focused on rank points optimization
  generateRanksRecommendations(completedRuns, similarSetups, currentBoard) {
    const recommendations = [];
    
    if (completedRuns.length === 0) return recommendations;
    
    // Rank points analysis
    const highPointRuns = completedRuns.filter(r => r.rankPoints >= 1000);
    const highPointRate = highPointRuns.length / completedRuns.length;
    
    if (highPointRate < 0.5) {
      recommendations.push({
        type: 'points',
        title: 'Improve High Point Rate',
        message: `Only ${Math.round(highPointRate * 100)}% of your runs achieve 1000+ points.`,
        suggestion: 'Optimize monster stats and positioning to increase high point success rate.',
        priority: 'high',
        focusArea: 'ranks'
      });
    }
    
    // Rank points analysis
    const maxPoints = Math.max(...completedRuns.map(r => r.rankPoints));
    const avgPoints = completedRuns.reduce((sum, r) => sum + r.rankPoints, 0) / completedRuns.length;
    
    if (avgPoints < maxPoints * 0.8) {
      recommendations.push({
        type: 'points',
        title: 'Maximize Rank Points',
        message: `Your average points (${Math.round(avgPoints)}) are below your best (${maxPoints}).`,
        suggestion: 'Focus on strategies that consistently achieve higher rank points.',
        priority: 'medium',
        focusArea: 'ranks'
      });
    }
    
    // High rank points consistency
    const highRankRuns = completedRuns.filter(r => r.rankPoints >= maxPoints * 0.9);
    const highRankRate = highRankRuns.length / completedRuns.length;
    
    if (highRankRate < 0.3) {
      recommendations.push({
        type: 'consistency',
        title: 'Improve High Rank Consistency',
        message: `Only ${Math.round(highRankRate * 100)}% of runs achieve 90%+ of your best rank points.`,
        suggestion: 'Focus on consistent high-damage strategies and optimal monster positioning.',
        priority: 'medium',
        focusArea: 'ranks'
      });
    }
    
    // Setup optimization for ranks
    if (similarSetups && similarSetups.length > 1) {
      const currentSetup = similarSetups.find(s => s.setup === currentBoard.boardSetup);
      const betterRankSetups = similarSetups.filter(s => s.pattern.averagePoints > currentSetup?.pattern.averagePoints);
      
      if (betterRankSetups.length > 0) {
        const bestAlternative = betterRankSetups[0];
        const improvement = Math.round((bestAlternative.pattern.averagePoints - currentSetup.pattern.averagePoints) / currentSetup.pattern.averagePoints * 100);
        
        recommendations.push({
          type: 'optimization',
          title: 'Better Rank Setup Available',
          message: `Found ${betterRankSetups.length} setups with better rank performance. Best improvement: ${improvement}% more points.`,
          suggestion: 'Consider testing alternative monster combinations for better rank performance.',
          priority: 'high',
          focusArea: 'ranks'
        });
      }
    }
    
    return recommendations;
  }

  analyzeTileUsage(setups) {
    const tileUsage = new Map();
    
    for (const setup of setups) {
      for (const piece of setup) {
        if (!tileUsage.has(piece.tileIndex)) {
          tileUsage.set(piece.tileIndex, { count: 0, total: 0 });
        }
        tileUsage.get(piece.tileIndex).count++;
      }
    }
    
    for (const [tile, usage] of tileUsage) {
      usage.total = setups.length;
      usage.frequency = usage.count / usage.total;
    }
    
    return tileUsage;
  }

  getCurrentTileUsage(setup) {
    return new Set(setup.map(piece => piece.tileIndex));
  }

  analyzeEquipmentPatterns(setups) {
    const patterns = new Map();
    
    for (const setup of setups) {
      for (const piece of setup) {
        if (piece.equipId) {
          const key = piece.equipId;
          if (!patterns.has(key)) {
            patterns.set(key, { count: 0, total: 0, stat: piece.stat, tier: piece.tier });
          }
          patterns.get(key).count++;
        }
      }
    }
    
    for (const [equipId, pattern] of patterns) {
      pattern.total = setups.length;
      pattern.frequency = pattern.count / pattern.total;
    }
    
    return patterns;
  }

  analyzeCreaturePatterns(setups) {
    const patterns = new Map();
    
    for (const setup of setups) {
      for (const piece of setup) {
        if (piece.monsterId) {
          const key = piece.monsterId;
          if (!patterns.has(key)) {
            patterns.set(key, { 
              count: 0, 
              total: 0, 
              monsterName: piece.monsterName || piece.name,
              tier: piece.tier 
            });
          }
          patterns.get(key).count++;
        }
      }
    }
    
    for (const [monsterId, pattern] of patterns) {
      pattern.total = setups.length;
      pattern.frequency = pattern.count / pattern.total;
    }
    
    return patterns;
  }
  
  
  predictPerformance(currentBoard, similarSetups) {
    if (similarSetups.length === 0) {
      return {
        confidence: 0,
        predictedTime: null,
        predictedGrade: null,
        predictedPoints: null,
        estimatedGrade: null,
        successRate: null
      };
    }

    // First, try to find the actual best run for this exact setup
    const currentRoomRuns = performanceTracker.runs.filter(r => r.roomId === currentBoard.roomId);
    const exactSetupRuns = currentRoomRuns.filter(run => {
      if (!run.boardSetup || run.boardSetup.length !== currentBoard.boardSetup.length) return false;
      
      // Check if all pieces match exactly (monster, equipment, tile)
      for (let i = 0; i < currentBoard.boardSetup.length; i++) {
        const currentPiece = currentBoard.boardSetup[i];
        const runPiece = run.boardSetup[i];
        
        if (currentPiece.monsterId !== runPiece.monsterId || 
            currentPiece.equipId !== runPiece.equipId ||
            currentPiece.tileIndex !== runPiece.tileIndex) {
          return false;
        }
      }
      return true;
    });

    // If we have exact setup runs, use the best one for prediction
    if (exactSetupRuns.length > 0) {
      const bestRun = exactSetupRuns.reduce((best, current) => 
        (current.ticks < best.ticks) ? current : best
      );
      
      console.log(`[Board Advisor] Found ${exactSetupRuns.length} exact setup runs, using best: ${bestRun.ticks} ticks`);
      
      // Check if there are better runs available
      const currentRoomRuns = performanceTracker.runs.filter(r => r.roomId === currentBoard.roomId);
      const sortedRuns = currentRoomRuns.sort((a, b) => a.ticks - b.ticks);
      const bestOverallRun = sortedRuns[0];
      
      if (bestOverallRun && bestOverallRun.ticks < bestRun.ticks) {
        console.log(`[Board Advisor] Found better run available: ${bestOverallRun.ticks} vs current setup ${bestRun.ticks}`);
      }
      
      return {
        confidence: 1.0,
        predictedTime: bestRun.ticks,
        predictedPoints: bestRun.rankPoints || null,
        successRate: 100
      };
    }

    // Fallback to pattern-based prediction for similar setups
    const exactMatches = similarSetups.filter(similar => {
      const currentSetup = currentBoard.boardSetup;
      const similarSetup = similar.pattern.setup;
      
      // Must have same number of pieces
      if (currentSetup.length !== similarSetup.length) return false;
      
      // Check if all creatures match exactly
      for (let i = 0; i < currentSetup.length; i++) {
        const currentPiece = currentSetup[i];
        const similarPiece = similarSetup[i];
        
        // Must have same monster ID and tier
        if (currentPiece.monsterId !== similarPiece.monsterId || 
            currentPiece.tier !== similarPiece.tier) {
          return false;
        }
      }
      
      return true;
    });

    // If no exact matches, return null prediction
    if (exactMatches.length === 0) {
      return {
        confidence: 0,
        predictedTime: null,
        predictedGrade: null,
        predictedPoints: null,
        estimatedGrade: null,
        successRate: null
      };
    }

    // Calculate weighted average based on similarity for exact matches only
    let totalWeight = 0;
    let weightedTime = 0;
    let weightedSuccess = 0;
    let weightedPoints = 0;

    for (const similar of exactMatches) {
      const weight = similar.similarity;
      totalWeight += weight;
      
      // For predictions, prioritize best time over average time
      // This gives more accurate predictions for tile-specific setups
      let timeToUse = similar.pattern.averageTime;
      
      // If we have runs in this pattern, use the best time instead of average
      if (similar.pattern.runs && similar.pattern.runs.length > 0) {
        const bestTime = Math.min(...similar.pattern.runs.map(r => r.ticks || Infinity));
        if (bestTime !== Infinity) {
          timeToUse = bestTime;
        }
      }
      
      if (timeToUse > 0) {
        weightedTime += timeToUse * weight;
      }
      
      if (similar.pattern.averagePoints > 0) {
        weightedPoints += similar.pattern.averagePoints * weight;
      }
      
      weightedSuccess += similar.pattern.successRate * weight;
    }

    const predictedTime = totalWeight > 0 ? weightedTime / totalWeight : null;
    const predictedPoints = totalWeight > 0 ? weightedPoints / totalWeight : null;
    const predictedSuccessRate = totalWeight > 0 ? weightedSuccess / totalWeight : null;
    
    return {
      confidence: Math.min(totalWeight, 1),
      predictedTime: predictedTime ? Math.round(predictedTime) : null,
      predictedPoints: predictedPoints ? Math.round(predictedPoints) : null,
      successRate: predictedSuccessRate ? Math.round(predictedSuccessRate * 100) : null
    };
  }
}

// =======================
// 5. USER INTERFACE
// =======================

// Panel constants
const PANEL_ID = "board-advisor-panel";

// Panel state
let panelState = {
  isOpen: false,
  position: { x: 10, y: 40 },
  size: { width: 350, height: 800 }
};

// =======================
// IMMEDIATE INITIALIZATION
// =======================
// Create panel UI elements immediately on mod load to ensure they exist
// for recommendation execution during initialization
console.log('[Board Advisor] Creating panel UI elements during initialization...');
createPanel();

// Hide the panel initially (it will be shown when user clicks the button)
const panel = document.getElementById(PANEL_ID);
if (panel) {
  panel.style.display = 'none';
  panelState.isOpen = false;
  console.log('[Board Advisor] Panel created and hidden during initialization');
} else {
  console.warn('[Board Advisor] Failed to create panel during initialization');
}

function createUI() {
  // Create clickable icon in bottom left corner
  createClickableIcon();

  // Create config panel
  api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: 'Board Advisor Settings',
    content: createConfigContent(),
    buttons: [
      {
        text: 'Save',
        primary: true,
        onClick: saveConfig
      }
    ]
  });
}

function createClickableIcon() {
  // Check if icon already exists
  const existingIcon = document.getElementById(`${MOD_ID}-icon`);
  if (existingIcon) {
    return existingIcon;
  }

  // Create the icon element
  const icon = document.createElement('div');
  icon.id = `${MOD_ID}-icon`;
  icon.innerHTML = '🤖';
  icon.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 40px;
    height: 40px;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid #3A404A;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
    z-index: 10000;
    transition: all 0.2s ease;
    user-select: none;
  `;

  // Add hover effects
  icon.addEventListener('mouseenter', () => {
    icon.style.background = 'rgba(0, 0, 0, 0.9)';
    icon.style.borderColor = '#4A5568';
    icon.style.transform = 'scale(1.1)';
  });

  icon.addEventListener('mouseleave', () => {
    icon.style.background = 'rgba(0, 0, 0, 0.8)';
    icon.style.borderColor = '#3A404A';
    icon.style.transform = 'scale(1)';
  });

  // Add click handler
  icon.addEventListener('click', togglePanel);

  // Add tooltip
  icon.title = 'Board Advisor - Click to open';

  // Append to body
  document.body.appendChild(icon);

  return icon;
}

function updateIconStatus() {
  const icon = document.getElementById(`${MOD_ID}-icon`);
  if (!icon) return;

  const autoStatus = config.autoAnalyze ? ' (Auto)' : '';
  const statusText = panelState.isOpen ? ' (Open)' : '';
  icon.title = `Board Advisor${autoStatus}${statusText} - Click to ${panelState.isOpen ? 'close' : 'open'}`;
  
  // Update visual state
  if (panelState.isOpen) {
    icon.style.borderColor = '#4A5568';
    icon.style.background = 'rgba(0, 0, 0, 0.9)';
  } else {
    icon.style.borderColor = '#3A404A';
    icon.style.background = 'rgba(0, 0, 0, 0.8)';
  }
}

async function togglePanel() {
  if (panelState.isOpen) {
    closePanel();
  } else {
    await openPanel();
  }
}

async function openPanel() {
  if (panelState.isOpen) return;
  
  // Show the panel (it was created during initialization)
  const panel = document.getElementById(PANEL_ID);
  if (panel) {
    panel.style.display = 'block';
    panelState.isOpen = true;
  } else {
    // Fallback: create panel if it doesn't exist
    createPanel();
    panelState.isOpen = true;
  }
  
  // Update icon status
  updateIconStatus();

  // Start state-based refresh when panel opens
  startStateRefresh();

  // Force-update everything when panel opens
  console.log('[Board Advisor] Force-updating all data sources on panel open...');
  await forceUpdateAllData();

  // Trigger automatic analysis when panel opens
  if (config.autoAnalyzeOnPanelOpen) {
    setTimeout(() => {
      const currentBoard = dataCollector.getCurrentBoardData();
      if (currentBoard && currentBoard.boardSetup.length > 0) {
        const roomId = currentBoard.roomId;
        const hasData = performanceTracker.patterns.has(roomId) && 
                       performanceTracker.patterns.get(roomId).size > 0;
        
        if (hasData) {
          console.log('[Board Advisor] Auto-analyzing board on panel open...');
          debouncedAnalyzeCurrentBoard();
        } else {
          // Try to load all data sources and then analyze
          loadAllDataSources(true).then(() => {
            console.log('[Board Advisor] Auto-analyzing board after loading all data sources...');
          }).catch(error => {
            console.error('[Board Advisor] Error loading data for analysis:', error);
          });
        }
      }
    }, 100);
  }
}

function closePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) {
    panel.style.display = 'none';
  }
  panelState.isOpen = false;
  
  // Clean up tile highlights when panel closes
  cleanupTileHighlights();
  
  // Stop state-based refresh when panel closes
  stopStateRefresh();
  
  // Update icon status
  updateIconStatus();
}

function createPanel() {
  // Remove existing panel if any
  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel) {
    existingPanel.remove();
  }
  
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = `
    position: fixed;
    top: ${panelState.position.y}px;
    left: ${panelState.position.x}px;
    width: ${panelState.size.width}px;
    height: ${panelState.size.height}px;
    background: #282C34;
    border: 1px solid #3A404A;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 10001;
    display: flex;
    flex-direction: column;
    font-family: 'Inter', sans-serif;
    color: #ABB2BF;
    overflow: hidden;
  `;
  
  // Header
  const header = createPanelHeader();
  panel.appendChild(header);
  
  // Content area
  const content = createPanelContent();
  panel.appendChild(content);
  
  // Footer
  const footer = createPanelFooter();
  panel.appendChild(footer);
  
  // Make draggable
  makeDraggable(panel, header);
  
  // Make resizable
  makeResizable(panel);
  
  document.body.appendChild(panel);
  
  // Load initial data
  loadPanelData();
}

function createPanelHeader() {
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: move;
    user-select: none;
    flex-shrink: 0;
  `;
  
  const title = document.createElement('h3');
  title.textContent = '🤖 Board Advisor';
  title.style.cssText = `
    margin: 0;
    font-size: 16px;
    font-weight: bold;
  `;
  
  const controls = document.createElement('div');
  controls.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255,255,255,0.2);
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });
  
  controls.appendChild(closeBtn);
  
  header.appendChild(title);
  header.appendChild(controls);
  
  return header;
}

function createPanelContent() {
  const content = document.createElement('div');
  content.id = 'advisor-content';
  content.style.cssText = `
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background: #282C34;
  `;
  
  // Focus areas section
  const focusSection = createFocusAreasSection();
  content.appendChild(focusSection);
  
  // Analysis section
  const analysisSection = createAnalysisSection();
  content.appendChild(analysisSection);
  
  // Recommendations section
  const recommendationsSection = createRecommendationsSection();
  content.appendChild(recommendationsSection);
  
  
  return content;
}


function createAnalysisSection() {
  const section = document.createElement('div');
  section.style.cssText = `
    margin-bottom: 12px;
    padding: 8px 10px;
    background: #3A404A;
    border-radius: 4px;
    border-left: 3px solid #98C379;
  `;
  
  const title = document.createElement('h4');
  title.textContent = '🧠 Comprehensive Analysis';
  title.style.cssText = `
    margin: 0 0 6px 0;
    color: #98C379;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  
  // Add collapse/expand indicator
  const collapseIcon = document.createElement('span');
  collapseIcon.textContent = '▲';
  collapseIcon.style.cssText = `
    font-size: 10px;
    transition: transform 0.2s ease;
  `;
  title.appendChild(collapseIcon);
  
  const analysis = document.createElement('div');
  analysis.id = 'analysis-display';
  analysis.style.cssText = `
    display: block;
    font-size: 11px;
    line-height: 1.3;
  `;
  
  // Add click handler for collapse/expand
  title.addEventListener('click', () => {
    const isCollapsed = analysis.style.display === 'none';
    analysis.style.display = isCollapsed ? 'block' : 'none';
    collapseIcon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
  });
  
  section.appendChild(title);
  section.appendChild(analysis);
  
  return section;
}

function createFocusAreasSection() {
  const section = document.createElement('div');
  section.style.cssText = `
    margin-bottom: 12px;
    padding: 8px 10px;
    background: #3A404A;
    border-radius: 4px;
    border-left: 3px solid #FF9800;
  `;
  
  const title = document.createElement('h4');
  title.textContent = '🎯 Focus Areas';
  title.style.cssText = `
    margin: 0 0 8px 0;
    color: #FF9800;
    font-size: 13px;
    font-weight: 600;
  `;
  
  const toggleContainer = document.createElement('div');
  toggleContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `;
  
  const ticksLabel = document.createElement('span');
  ticksLabel.textContent = '⏱️ Ticks';
  ticksLabel.style.cssText = `
    color: #61AFEF;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  `;
  
  const ranksLabel = document.createElement('span');
  ranksLabel.textContent = '🏆 Rank Points';
  ranksLabel.style.cssText = `
    color: #E5C07B;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  `;
  
  // Toggle switch container
  const toggleSwitchContainer = document.createElement('div');
  toggleSwitchContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  // Toggle switch
  const toggleSwitch = document.createElement('label');
  toggleSwitch.className = 'toggle-switch';
  toggleSwitch.style.cssText = `
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
  `;
  
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'focus-area-toggle';
  toggleInput.checked = config.focusArea === 'ranks';
  toggleInput.style.cssText = `
    opacity: 0;
    width: 0;
    height: 0;
  `;
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'slider';
  toggleSlider.style.cssText = `
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #313244;
    transition: .4s;
    border-radius: 20px;
  `;
  
  // Add CSS for toggle switch
  const style = document.createElement('style');
  style.textContent = `
    .toggle-switch .slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 2px;
      bottom: 2px;
      background-color: #cdd6f4;
      transition: .4s;
      border-radius: 50%;
    }
    .toggle-switch input:checked + .slider {
      background-color: #a6e3a1;
    }
    .toggle-switch input:checked + .slider:before {
      transform: translateX(20px);
    }
  `;
  document.head.appendChild(style);
  
  // Function to update label colors based on current focus area
  const updateToggleLabels = () => {
    if (config.focusArea === 'ticks') {
      ticksLabel.style.color = '#61AFEF';
      ticksLabel.style.fontWeight = '600';
      ranksLabel.style.color = '#777';
      ranksLabel.style.fontWeight = '400';
    } else {
      ticksLabel.style.color = '#777';
      ticksLabel.style.fontWeight = '400';
      ranksLabel.style.color = '#E5C07B';
      ranksLabel.style.fontWeight = '600';
    }
  };
  
  // Add event listener for toggle changes
  toggleInput.addEventListener('change', async (e) => {
    config.focusArea = e.target.checked ? 'ranks' : 'ticks';
    updateToggleLabels();
    
    
    // Update panel display immediately if panel is open
    if (panelState.isOpen) {
      if (analysisState.currentAnalysis) {
        await updatePanelWithAnalysis(analysisState.currentAnalysis);
      } else {
        const currentBoard = dataCollector.getCurrentBoardData();
        if (currentBoard) {
          await updatePanelWithBasicAnalysis(currentBoard);
        }
      }
      // Update recommendation sections based on focus area
      
      // Trigger re-analysis for fresh data
      setTimeout(() => {
        debouncedAnalyzeCurrentBoard();
      }, 100);
    }
  });
  
  // Add click handlers for labels
  ticksLabel.addEventListener('click', async () => {
    toggleInput.checked = false;
    config.focusArea = 'ticks';
    updateToggleLabels();
    
    // Update recommendation section visibility
    const ticksSection = document.getElementById('ticks-recommendations-section');
    const ranksSection = document.getElementById('ranks-recommendations-section');
    
    if (ticksSection && ranksSection) {
      ticksSection.style.display = 'block';
      ranksSection.style.display = 'none';
    }
    
    if (panelState.isOpen) {
      if (analysisState.currentAnalysis) {
        updatePanelWithAnalysis(analysisState.currentAnalysis);
      } else {
        const currentBoard = dataCollector.getCurrentBoardData();
        if (currentBoard) {
          updatePanelWithBasicAnalysis(currentBoard);
        }
      }
      // Update recommendation sections based on focus area
      
      setTimeout(() => {
        debouncedAnalyzeCurrentBoard();
      }, 100);
    }
  });
  
  ranksLabel.addEventListener('click', async () => {
    toggleInput.checked = true;
    config.focusArea = 'ranks';
    updateToggleLabels();
    
    // Update recommendation section visibility
    const ticksSection = document.getElementById('ticks-recommendations-section');
    const ranksSection = document.getElementById('ranks-recommendations-section');
    
    if (ticksSection && ranksSection) {
      ticksSection.style.display = 'none';
      ranksSection.style.display = 'block';
    }
    
    if (panelState.isOpen) {
      if (analysisState.currentAnalysis) {
        updatePanelWithAnalysis(analysisState.currentAnalysis);
      } else {
        const currentBoard = dataCollector.getCurrentBoardData();
        if (currentBoard) {
          updatePanelWithBasicAnalysis(currentBoard);
        }
      }
      // Update recommendation sections based on focus area
      
      setTimeout(() => {
        debouncedAnalyzeCurrentBoard();
      }, 100);
    }
  });
  
  // Initialize label colors
  updateToggleLabels();
  
  toggleSwitch.appendChild(toggleInput);
  toggleSwitch.appendChild(toggleSlider);
  toggleSwitchContainer.appendChild(toggleSwitch);
  
  toggleContainer.appendChild(ticksLabel);
  toggleContainer.appendChild(toggleSwitchContainer);
  toggleContainer.appendChild(ranksLabel);
  
  section.appendChild(title);
  section.appendChild(toggleContainer);
  
  return section;
}


function createRecommendationsSection() {
  const section = document.createElement('div');
  section.style.cssText = `
    margin-bottom: 12px;
    padding: 8px 10px;
    background: #3A404A;
    border-radius: 4px;
    border-left: 3px solid #E5C07B;
  `;
  
  const title = document.createElement('h4');
  title.textContent = '🎯 Tips & Strategies';
  title.style.cssText = `
    margin: 0 0 6px 0;
    color: #E5C07B;
    font-size: 13px;
    font-weight: 600;
  `;
  
  const recommendations = document.createElement('div');
  recommendations.id = 'recommendations-display';
  recommendations.style.cssText = `
    font-size: 11px;
    line-height: 1.3;
  `;
  
  section.appendChild(title);
  section.appendChild(recommendations);
  
  return section;
}

function createPanelFooter() {
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 8px 16px;
    background: #3A404A;
    border-top: 1px solid #4B5563;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
  `;
  
  // Auto-refresh status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'auto-status';
  statusIndicator.style.cssText = `
    font-size: 11px;
    color: #61AFEF;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  
  // Update status based on config
  const updateStatus = () => {
    if (config.autoRefreshPanel && config.autoAnalyze) {
      statusIndicator.innerHTML = `
        <span>🔄</span>
        <span>Auto-refresh & analysis active</span>
      `;
    } else if (config.autoRefreshPanel) {
      statusIndicator.innerHTML = `
        <span>🔄</span>
        <span>Auto-refresh active</span>
      `;
    } else if (config.autoAnalyze) {
      statusIndicator.innerHTML = `
        <span>🤖</span>
        <span>Auto-analysis active</span>
      `;
    } else {
      statusIndicator.innerHTML = `
        <span>⚙️</span>
        <span>Manual mode</span>
      `;
    }
  };
  
  updateStatus();
  footer.appendChild(statusIndicator);
  
  // Update status when config changes
  const originalSaveConfig = saveConfig;
  saveConfig = function() {
    originalSaveConfig.apply(this, arguments);
    updateStatus();
  };
  
  return footer;
}

function makeDraggable(panel, header) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(panel.style.left);
    startTop = parseInt(panel.style.top);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newLeft = startLeft + deltaX;
    let newTop = startTop + deltaY;
    
    // Keep panel within viewport
    newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, newTop));
    
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
    
    panelState.position.x = newLeft;
    panelState.position.y = newTop;
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  });
}

function makeResizable(panel) {
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    background: #4B5563;
    cursor: se-resize;
    border-radius: 0 0 8px 0;
  `;
  
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = panel.offsetWidth;
    startHeight = panel.offsetHeight;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(300, startWidth + deltaX);
    const newHeight = Math.max(200, startHeight + deltaY);
    
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    
    panelState.size.width = newWidth;
    panelState.size.height = newHeight;
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
    }
  });
  
  panel.appendChild(resizeHandle);
}


function loadPanelData() {
  const analysisDisplay = document.getElementById('analysis-display');
  const recommendationsDisplay = document.getElementById('recommendations-display');
  
  if (!analysisDisplay || !recommendationsDisplay) return;
  
  // Load analysis
  if (analysisState.currentAnalysis) {
    analysisDisplay.innerHTML = `
      <div><strong>Predicted Time:</strong> ${analysisState.currentAnalysis.prediction?.estimatedTime || 'N/A'}</div>
      <div><strong>Predicted Points:</strong> ${analysisState.currentAnalysis.prediction?.predictedPoints || 'N/A'}</div>
      <div><strong>Success Rate:</strong> ${analysisState.currentAnalysis.prediction?.successRate || 'N/A'}%</div>
      <div><strong>Similar Setups:</strong> ${analysisState.currentAnalysis.prediction?.similarSetups || 0}</div>
    `;
  } else {
    analysisDisplay.innerHTML = '<div style="color: #E06C75;">No analysis available. Play some games to build data for automatic analysis.</div>';
  }
  
  // Load recommendations
  if (analysisState.currentAnalysis?.recommendations?.length > 0) {
    const recs = analysisState.currentAnalysis.recommendations.map(rec => 
      `<div style="margin: 4px 0; padding: 4px; background: #4B5563; border-radius: 4px;">
        <strong>${rec.type}:</strong> ${rec.description}
        <div style="font-size: 10px; color: #ABB2BF;">Impact: ${rec.impact}</div>
      </div>`
    ).join('');
    recommendationsDisplay.innerHTML = recs;
  } else {
    recommendationsDisplay.innerHTML = '<div style="color: #E06C75;">No recommendations available. Play some games to build data.</div>';
  }
}

function createConfigContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="enabled" ${config.enabled ? 'checked' : ''}>
        Enable Board Advisor
      </label>
      
      <label style="display: flex; flex-direction: column; gap: 4px;">
        Analysis Depth (simulations):
        <input type="number" id="analysisDepth" value="${config.analysisDepth}" min="10" max="200">
      </label>
      
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="learningEnabled" ${config.learningEnabled ? 'checked' : ''}>
        Enable Pattern Learning
      </label>
      
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="showPredictions" ${config.showPredictions ? 'checked' : ''}>
        Show Performance Predictions
      </label>
      
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="autoAnalyze" ${config.autoAnalyze ? 'checked' : ''}>
        Auto-analyze on Board Changes
      </label>
      
      <div style="border-top: 1px solid #4B5563; padding-top: 12px; margin-top: 8px;">
        <h4 style="margin: 0 0 8px 0; color: #61AFEF; font-size: 14px;">Auto-Refresh Settings</h4>
        
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="autoRefreshPanel" ${config.autoRefreshPanel ? 'checked' : ''}>
          Enable Auto-Refresh Panel
        </label>
        
        <div style="font-size: 11px; color: #ABB2BF; margin-top: 4px;">
          Panel refreshes automatically when game state changes (max once per second)
        </div>
      </div>
    </div>
  `;
}

function saveConfig() {
  const enabled = document.getElementById('enabled').checked;
  const analysisDepth = parseInt(document.getElementById('analysisDepth').value);
  const learningEnabled = document.getElementById('learningEnabled').checked;
  const showPredictions = document.getElementById('showPredictions').checked;
  const autoAnalyze = document.getElementById('autoAnalyze').checked;
  const autoRefreshPanel = document.getElementById('autoRefreshPanel').checked;

  config.enabled = enabled;
  config.analysisDepth = analysisDepth;
  config.learningEnabled = learningEnabled;
  config.showPredictions = showPredictions;
  config.autoAnalyze = autoAnalyze;
  config.autoRefreshPanel = autoRefreshPanel;

  // Save to mod config
  api.service.updateScriptConfig(context.hash, config);
  
  // Update auto-refresh if panel is open
  if (panelState.isOpen) {
    if (config.autoRefreshPanel) {
      startStateRefresh();
    } else {
      stopStateRefresh();
    }
  }
  
  // Update icon status
  updateIconStatus();

  console.log('[Board Advisor] Config saved');
}

function showBasicAnalysis(currentBoard) {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 16px; max-height: 500px; overflow-y: auto;';

  // Current setup info
  const setupInfo = document.createElement('div');
  setupInfo.innerHTML = `
    <h3 style="margin: 0 0 8px 0; color: #4CAF50;">Current Setup Analysis</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
      <div>Room: ${currentBoard.roomId}</div>
      <div>Pieces: ${currentBoard.boardSetup.length}</div>
      <div>Monsters: ${currentBoard.playerMonsters.length}</div>
      <div>Equipment: ${currentBoard.playerEquipment.length}</div>
    </div>
  `;
  content.appendChild(setupInfo);


  // Basic recommendations
  const recommendations = document.createElement('div');
  recommendations.innerHTML = `
    <h3 style="margin: 0 0 8px 0; color: #FF5722;">Getting Started</h3>
    <div style="font-size: 14px;">
      <div style="padding: 8px; margin: 4px 0; border-left: 3px solid #2196F3; background: rgba(0,0,0,0.05); border-radius: 4px;">
        <div style="font-weight: bold; color: #2196F3;">Play Some Games</div>
        <div style="font-size: 13px; margin-top: 4px;">Complete a few games to start building data for analysis</div>
      </div>
      <div style="padding: 8px; margin: 4px 0; border-left: 3px solid #4CAF50; background: rgba(0,0,0,0.05); border-radius: 4px;">
        <div style="font-weight: bold; color: #4CAF50;">Try Different Setups</div>
        <div style="font-size: 13px; margin-top: 4px;">Experiment with different monster and equipment combinations</div>
      </div>
    </div>
  `;
  content.appendChild(recommendations);

  api.showModal({
    title: '📊 Board Advisor - Basic Analysis',
    width: 500,
    content: content,
    buttons: [
      {
        text: 'Analyze Again',
        primary: false,
        onClick: () => {
          showAnalysisModal();
        }
      },
      {
        text: 'Close',
        primary: true
      }
    ]
  });
}

// Debounced analysis function to prevent loops
function debouncedAnalyzeCurrentBoard() {
  const now = Date.now();
  
  // Clear any existing timeout
  if (analysisTimeout) {
    clearTimeout(analysisTimeout);
    analysisTimeout = null;
  }
  
  // Check if we're already analyzing or if it's too soon since last analysis
  if (analysisState.isAnalyzing) {
    console.log('[Board Advisor] Analysis already in progress, skipping duplicate request');
    return;
  }
  
  // Check if we have a pending analysis request for the same board state
  const currentBoard = dataCollector.getCurrentBoardData();
  const currentBoardHash = currentBoard ? generateBoardHash(currentBoard.boardSetup) : null;
  
  if (pendingAnalysisRequest === currentBoardHash) {
    console.log('[Board Advisor] Analysis already pending for this board state, skipping');
    return;
  }
  
  if (now - lastAnalysisTime < ANALYSIS_DEBOUNCE_TIME) {
    console.log('[Board Advisor] Analysis too soon, debouncing request');
    pendingAnalysisRequest = currentBoardHash;
    analysisTimeout = setTimeout(() => {
      pendingAnalysisRequest = null;
      debouncedAnalyzeCurrentBoard();
    }, ANALYSIS_DEBOUNCE_TIME - (now - lastAnalysisTime));
    return;
  }
  
  // Proceed with analysis
  pendingAnalysisRequest = currentBoardHash;
  analyzeCurrentBoard().finally(() => {
    pendingAnalysisRequest = null;
  });
}

async function analyzeCurrentBoard() {
  if (!config.enabled) {
    updatePanelStatus('Board Advisor is disabled. Enable it in the config panel.', 'error');
    return Promise.resolve(null);
  }

  if (analysisState.isAnalyzing) {
    console.log('[Board Advisor] Analysis already in progress, skipping');
    return Promise.resolve(null);
  }

  // Check if we're analyzing the same board state
  const currentBoard = dataCollector.getCurrentBoardData();
  const currentBoardHash = currentBoard ? generateBoardHash(currentBoard.boardSetup) : null;
  
  // Check if RunTracker data has been updated since last analysis
  let shouldForceAnalysis = false;
  if (window.RunTrackerAPI && window.RunTrackerAPI._initialized) {
    const runTrackerData = window.RunTrackerAPI.getAllRuns();
    const runTrackerLastUpdated = runTrackerData?.lastUpdated || 0;
    const lastAnalysisTime = analysisState.lastAnalysisTime || 0;
    
    if (runTrackerLastUpdated > lastAnalysisTime) {
      console.log('[Board Advisor] RunTracker data updated since last analysis, forcing refresh');
      shouldForceAnalysis = true;
    }
  }
  
  if (currentBoardHash && currentBoardHash === analysisState.lastBoardHash && !shouldForceAnalysis) {
    console.log('[Board Advisor] Board state unchanged, skipping duplicate analysis');
    return Promise.resolve(analysisState.currentAnalysis);
  }

  // If we're forcing analysis due to RunTracker data update, refresh the data first
  if (shouldForceAnalysis) {
    console.log('[Board Advisor] Refreshing RunTracker data before analysis...');
    await loadRunTrackerData(false); // Don't trigger analysis yet
  }

  lastAnalysisTime = Date.now();
  
  // Update panel with loading state
  updatePanelStatus('Analyzing board setup automatically...', 'loading');
  
  // Run analysis and return the promise
  return boardAnalyzer.analyzeCurrentBoard().then(async (analysis) => {
    console.log('[Board Advisor] Analysis result received:', analysis);
    
    if (!analysis) {
      console.log('[Board Advisor] No analysis result, showing basic analysis');
      // Show basic analysis even without historical data
      const currentBoard = dataCollector.getCurrentBoardData();
      if (currentBoard) {
        await updatePanelWithBasicAnalysis(currentBoard);
      } else {
        updatePanelStatus('Analysis failed. Make sure you have a board setup and some historical data.', 'error');
      }
      return null;
    }

    // Check if this is a no-data analysis
    if (analysis.hasData === false) {
      console.log('[Board Advisor] No-data analysis, updating panel');
      updatePanelWithNoDataAnalysis(analysis);
    } else {
      console.log('[Board Advisor] Regular analysis, updating panel with recommendations:', analysis.recommendations?.length || 0);
      await updatePanelWithAnalysis(analysis);
    }
    
    return analysis;
  }).catch(error => {
    console.error('[Board Advisor] Analysis error:', error);
    updatePanelStatus('Analysis failed: ' + error.message, 'error');
    return null;
  });
}

function updatePanelStatus(message, type = 'info') {
  const analysisDisplay = document.getElementById('analysis-display');
  if (!analysisDisplay) return;
  
  // Get current map information if available
  let mapInfo = '';
  try {
    const currentBoard = dataCollector.getCurrentBoardData();
    if (currentBoard && currentBoard.roomId) {
      const roomName = globalThis.state?.utils?.ROOM_NAME?.[currentBoard.roomId] || currentBoard.roomId;
      mapInfo = ` (${roomName})`;
    }
  } catch (e) {
    // Ignore errors getting current board data
  }
  
  const color = type === 'error' ? '#E06C75' : type === 'loading' ? '#FF9800' : '#61AFEF';
  
  // For temporary status messages, add them as overlays instead of replacing content
  if (type === 'loading' || type === 'error') {
    // Create a temporary status overlay
    const statusOverlay = document.createElement('div');
    statusOverlay.id = 'temp-status-overlay';
    statusOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(40, 44, 52, 0.95);
      color: ${color};
      padding: 8px 12px;
      font-size: 11px;
      z-index: 1000;
      border-bottom: 1px solid #4B5563;
    `;
    statusOverlay.innerHTML = `${message}${mapInfo}`;
    
    // Remove any existing overlay
    const existingOverlay = document.getElementById('temp-status-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Add the new overlay
    analysisDisplay.style.position = 'relative';
    analysisDisplay.appendChild(statusOverlay);
    
    // Auto-remove loading messages after a short delay
    if (type === 'loading') {
      setTimeout(() => {
        if (statusOverlay.parentNode) {
          statusOverlay.remove();
        }
      }, 2000);
    }
  } else {
    // For info messages, still replace content but preserve footer
    analysisDisplay.innerHTML = `<div style="color: ${color};">${message}${mapInfo}</div>`;
  }
}

async function updatePanelWithBasicAnalysis(currentBoard) {
  const analysisDisplay = document.getElementById('analysis-display');
  const recommendationsDisplay = document.getElementById('recommendations-display');
  
  if (!analysisDisplay || !recommendationsDisplay) return;
  
  // Get room name for display
  const roomName = globalThis.state?.utils?.ROOM_NAME?.[currentBoard.roomId] || currentBoard.roomId;
  
  // Check if board is empty
  const isBoardEmpty = !currentBoard.boardSetup || currentBoard.boardSetup.length === 0;
  
  // Check if we have historical data for this room
  const roomRuns = performanceTracker.runs.filter(r => r.roomId === currentBoard.roomId);
  const hasHistoricalData = roomRuns.length > 0;
  
  // Update analysis section with comprehensive basic info
  analysisDisplay.innerHTML = `
    <div style="margin-bottom: 12px; padding: 8px; background: #1F2937; border-radius: 6px; border-left: 4px solid #98C379;">
      <div style="font-weight: bold; color: #98C379; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span>🗺️</span>
        <span>Current Map: ${roomName}</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Pieces: ${currentBoard.boardSetup.length} | Monsters: ${currentBoard.playerMonsters.length} | Equipment: ${currentBoard.playerEquipment.length}
      </div>
    </div>
    
    ${isBoardEmpty ? `
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #E5C07B;">
      <div style="font-weight: bold; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>🎯</span>
        <span>Empty Board</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Place creatures on the board to get analysis and recommendations for your setup.
      </div>
    </div>
    ` : hasHistoricalData ? `
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #98C379;">
      <div style="font-weight: bold; color: #98C379; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>📊</span>
        <span>Historical Data Available</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Found ${roomRuns.length} runs for this map. Analysis and recommendations are being processed.
      </div>
    </div>
    ` : `
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
      <div style="font-weight: bold; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>⚠️</span>
        <span>No Historical Data</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Play some games with this setup to build data for analysis and personalized recommendations.
      </div>
    </div>
    `}
    
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #61AFEF;">
      <div style="font-weight: bold; color: #61AFEF; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>🎯</span>
        <span>Analysis Status</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        <div>• Data Collection: <span style="color: #98C379;">Active</span></div>
        <div>• Pattern Learning: <span style="color: #98C379;">Enabled</span></div>
        <div>• Leaderboard Integration: <span style="color: #98C379;">Ready</span></div>
        <div>• Recommendations: <span style="color: #FF9800;">Pending Data</span></div>
      </div>
    </div>
  `;
  
  // Update recommendations section with comprehensive tips
  recommendationsDisplay.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold; color: #2196F3; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>🚀</span>
        <span>Getting Started</span>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #2196F3;">
        <div style="font-weight: bold; color: #2196F3; font-size: 11px;">Play Some Games</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Complete 3-5 games with this setup to start building data for analysis</div>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #4CAF50;">
        <div style="font-weight: bold; color: #4CAF50; font-size: 11px;">Try Different Setups</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Experiment with different monster and equipment combinations for better data</div>
      </div>
    </div>
    
    <div style="margin-bottom: 12px;">
      <div style="font-weight: bold; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>💡</span>
        <span>Advanced Features Coming Soon</span>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: bold; color: #E5C07B; font-size: 11px;">Performance Predictions</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Will predict your expected time and success rate</div>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: bold; color: #E5C07B; font-size: 11px;">Optimization Tips</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Personalized recommendations for monster positioning and equipment</div>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: bold; color: #E5C07B; font-size: 11px;">Leaderboard Analysis</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Compare your performance against world records and rankings</div>
      </div>
    </div>
  `;
}

async function updatePanelWithAnalysis(analysis) {
  console.log('[Board Advisor] updatePanelWithAnalysis called with:', analysis);
  console.log('[Board Advisor] Recommendations in analysis:', analysis.recommendations?.length || 0);
  
  const analysisDisplay = document.getElementById('analysis-display');
  const recommendationsDisplay = document.getElementById('recommendations-display');
  if (!analysisDisplay || !recommendationsDisplay) {
    console.log('[Board Advisor] Missing UI elements:', {
      analysisDisplay: !!analysisDisplay,
      recommendationsDisplay: !!recommendationsDisplay
    });
    return;
  }
  
  // Get room name for display
  const roomName = globalThis.state?.utils?.ROOM_NAME?.[analysis.roomId] || analysis.roomId;
  
  // Check if board is empty
  const isBoardEmpty = !analysis.currentBoard || !analysis.currentBoard.boardSetup || analysis.currentBoard.boardSetup.length === 0;
    
  // Update analysis section with comprehensive information
  let analysisHTML = `
    <div style="margin-bottom: 8px; padding: 6px 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #98C379;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="font-weight: 600; color: #98C379; font-size: 12px;">🗺️ ${roomName}</span>
        <span style="font-size: 10px; color: #61AFEF;">${analysis.similarSetups?.length || 0} patterns</span>
      </div>
      <div style="font-size: 10px; color: #9CA3AF;">
        ${analysis.currentBoard ? analysis.currentBoard.boardSetup.length : 0} pieces
      </div>
    </div>
  `;
  
  // Add performance prediction as the main focus (filtered by focus area)
  // Only show if board has creatures and predictions are enabled
  if (config.showPredictions && analysis.prediction && !isBoardEmpty) {
    const confidence = Math.round(analysis.prediction.confidence * 100);
    const confidenceColor = confidence >= 80 ? '#98C379' : confidence >= 60 ? '#E5C07B' : '#E06C75';
    
    // Show different prediction info based on focus area
    let predictionContent = '';
    if (config.focusArea === 'ticks') {
      predictionContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div><strong>Predicted Time:</strong> <span style="color: #98C379;">${analysis.prediction.predictedTime || 'Unknown'} ticks</span></div>
          <div><strong>Confidence:</strong> <span style="color: ${confidenceColor};">${confidence}%</span></div>
          <div><strong>Success Rate:</strong> <span style="color: #98C379;">${analysis.prediction.successRate || 'Unknown'}%</span></div>
          <div><strong>Similar Setups:</strong> <span style="color: #61AFEF;">${analysis.similarSetups?.length || 0} found</span></div>
        </div>
      `;
    } else if (config.focusArea === 'ranks') {
      predictionContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div><strong>Predicted Time:</strong> <span style="color: #98C379;">${analysis.prediction.predictedTime || 'Unknown'}</span></div>
          <div><strong>Predicted Points:</strong> <span style="color: #98C379;">${analysis.prediction.predictedPoints || 'Unknown'}</span></div>
          <div><strong>Success Rate:</strong> <span style="color: #98C379;">${analysis.prediction.successRate || 'Unknown'}%</span></div>
          <div><strong>Similar Setups:</strong> <span style="color: #61AFEF;">${analysis.similarSetups?.length || 0} found</span></div>
        </div>
      `;
    }
    
    analysisHTML += `
      <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #3B82F6;">
        <div style="font-weight: bold; color: #3B82F6; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>🎯</span>
          <span>Performance Prediction (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
        </div>
        ${predictionContent}
      </div>
    `;
  }
  
  // Add leaderboard comparison with real WR data (filtered by focus area)
  try {
    const currentBoard = dataCollector.getCurrentBoardData();
    if (currentBoard && currentBoard.roomId) {
      const wrData = await fetchLeaderboardWRData(currentBoard.roomId);
      const roomName = globalThis.state?.utils?.ROOM_NAME?.[currentBoard.roomId] || currentBoard.roomId;
      
      let leaderboardContent = `<div><strong>Room:</strong> ${roomName}</div>`;
      
      // Show only relevant leaderboard info based on focus area
      if (config.focusArea === 'ticks' && wrData.tickData && wrData.tickData.length > 0) {
        const wr = wrData.tickData[0];
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: bold;">${wr.ticks} ticks</span></div>`;
        leaderboardContent += `<div><strong>Holder:</strong> <span style="color: #61AFEF;">${wr.userName}</span></div>`;
        
        // Show user's best if available
        const userScores = getUserBestScores();
        if (userScores && userScores.bestTicks) {
          const gap = userScores.bestTicks - wr.ticks;
          const gapColor = gap <= 0 ? '#98C379' : gap <= 10 ? '#E5C07B' : '#E06C75';
          const gapText = gap <= 0 ? 'WR' : gap === 1 ? '+1 tick' : `+${gap} ticks`;
          leaderboardContent += `<div><strong>Your Best:</strong> <span style="color: ${gapColor};">${userScores.bestTicks} (${gapText})</span></div>`;
        }
      } else if (config.focusArea === 'ranks' && wrData.rankData && wrData.rankData.length > 0) {
        const wr = wrData.rankData[0];
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: bold;">${wr.rank} points</span></div>`;
        leaderboardContent += `<div><strong>Holder:</strong> <span style="color: #61AFEF;">${wr.userName}</span></div>`;
        
        // Show user's best if available
        const userScores = getUserBestScores();
        if (userScores && userScores.bestRank) {
          const gap = wr.rank - userScores.bestRank;
          const gapColor = gap <= 0 ? '#98C379' : gap <= 10 ? '#E5C07B' : '#E06C75';
          const gapText = gap <= 0 ? 'WR' : gap === 1 ? '-1 point' : `-${gap} points`;
          leaderboardContent += `<div><strong>Your Best:</strong> <span style="color: ${gapColor};">${userScores.bestRank} (${gapText})</span></div>`;
        }
      } else {
        leaderboardContent += `<div style="color: #9CA3AF;">No ${config.focusArea === 'ticks' ? 'speed' : 'rank'} data available</div>`;
      }
      
      analysisHTML += `
        <div style="margin-bottom: 8px; padding: 6px 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #3B82F6;">
          <div style="font-weight: 600; color: #3B82F6; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
            <span>🏆</span>
            <span>Leaderboard Comparison (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
          </div>
          <div style="font-size: 11px; line-height: 1.3;">
            ${leaderboardContent}
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.warn('[Board Advisor] Error fetching leaderboard data:', error);
    // Fallback to basic room info
    const currentBoard = dataCollector.getCurrentBoardData();
    const roomName = currentBoard ? (globalThis.state?.utils?.ROOM_NAME?.[currentBoard.roomId] || currentBoard.roomId) : 'Unknown';
    
    analysisHTML += `
      <div style="margin-bottom: 8px; padding: 6px 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: 600; color: #E5C07B; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
          <span>🏆</span>
          <span>Leaderboard Comparison (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
        </div>
        <div style="font-size: 11px; color: #9CA3AF; line-height: 1.3;">
          Room: ${roomName}
        </div>
      </div>
    `;
  }
  
  // Add historical data analysis (filtered by focus area)
  if (analysis.currentAnalysis.hasHistoricalData) {
    const successRate = Math.round(analysis.currentAnalysis.successRate * 100);
    const successColor = successRate >= 80 ? '#98C379' : successRate >= 60 ? '#E5C07B' : '#E06C75';
    
    // Show different historical data based on focus area
    let historicalContent = '';
    if (config.focusArea === 'ticks') {
      historicalContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div><strong>Best Time:</strong> <span style="color: #98C379;">${analysis.currentAnalysis.bestTime} ticks</span></div>
          <div><strong>Success Rate:</strong> <span style="color: ${successColor};">${successRate}%</span></div>
          <div><strong>Average Time:</strong> <span style="color: #61AFEF;">${Math.round(analysis.currentAnalysis.averageTime)} ticks</span></div>
          <div><strong>Total Runs:</strong> <span style="color: #61AFEF;">${analysis.currentAnalysis.totalRuns}</span></div>
        </div>
      `;
    } else if (config.focusArea === 'ranks') {
      historicalContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div><strong>Best Time:</strong> <span style="color: #98C379;">${analysis.currentAnalysis.bestTime || 'Unknown'}</span></div>
          <div><strong>Success Rate:</strong> <span style="color: ${successColor};">${successRate}%</span></div>
          <div><strong>Best Points:</strong> <span style="color: #61AFEF;">${analysis.currentAnalysis.bestPoints || 'Unknown'}</span></div>
          <div><strong>Total Runs:</strong> <span style="color: #61AFEF;">${analysis.currentAnalysis.totalRuns}</span></div>
        </div>
      `;
    }
    
    analysisHTML += `
      <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #E5C07B;">
        <div style="font-weight: bold; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>📊</span>
          <span>Historical Performance (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
        </div>
        ${historicalContent}
      </div>
    `;
  } else {
    if (isBoardEmpty) {
      analysisHTML += `
        <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #E5C07B;">
          <div style="font-weight: bold; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span>
            <span>Empty Board</span>
          </div>
          <div style="font-size: 11px; color: #ABB2BF;">
            Place creatures on the board to get analysis and recommendations for your setup.
          </div>
        </div>
      `;
    } else {
      analysisHTML += `
        <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
          <div style="font-weight: bold; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span>
            <span>No Historical Data</span>
          </div>
          <div style="font-size: 11px; color: #ABB2BF;">
            Play some games with this setup to build data for better analysis and recommendations.
          </div>
        </div>
      `;
    }
  }
  
  analysisDisplay.innerHTML = analysisHTML;
  
  // Update separate recommendation sections
  
  // Update recommendations section with enhanced display (filtered by focus area)
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    // Filter recommendations by focus area
    const filteredRecommendations = analysis.recommendations.filter(rec => {
      // Always show leaderboard recommendations
      if (rec.type === 'leaderboard') return true;
      // Show recommendations that match the current focus area or are for both
      return rec.focusArea === config.focusArea || rec.focusArea === 'both' || !rec.focusArea;
    });
    
    // Store setup data in global variable for button access
    window.boardAdvisorSetups = [];
    filteredRecommendations.forEach((rec, index) => {
      if (rec.setup) {
        window.boardAdvisorSetups[index] = rec.setup;
        rec.setupIndex = index; // Add index to recommendation object
      }
    });
    
    // Group recommendations by type for better organization
    const groupedRecs = {
      leaderboard: [],
      improvement: [],
      positioning: [],
      equipment: [],
      creature: [],
      other: []
    };
    
    filteredRecommendations.forEach(rec => {
      if (rec.type === 'leaderboard') {
        groupedRecs.leaderboard.push(rec);
      } else if (rec.type === 'improvement') {
        groupedRecs.improvement.push(rec);
      } else if (rec.type === 'positioning') {
        groupedRecs.positioning.push(rec);
      } else if (rec.type === 'equipment') {
        groupedRecs.equipment.push(rec);
      } else if (rec.type === 'creature') {
        groupedRecs.creature.push(rec);
      } else {
        groupedRecs.other.push(rec);
      }
    });
    
    let recsHTML = '';
    
    // Leaderboard recommendations (highest priority)
    if (groupedRecs.leaderboard.length > 0) {
      recsHTML += '<div style="margin-bottom: 12px;">';
      recsHTML += '<div style="font-weight: bold; color: #3B82F6; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">';
      recsHTML += '<span>🏆</span><span>Leaderboard Insights</span></div>';
      
      groupedRecs.leaderboard.forEach(rec => {
        recsHTML += `<div style="margin: 6px 0; padding: 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #3B82F6;">
          <div style="font-weight: bold; color: #3B82F6; font-size: 11px;">${rec.title}</div>
          <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">${rec.description || rec.message}</div>
          ${rec.suggestion ? `<div style="font-size: 9px; color: #98C379; margin-top: 3px; font-style: italic;">💡 ${rec.suggestion}</div>` : ''}
        </div>`;
      });
      recsHTML += '</div>';
    }
    
    // Compact Tips & Strategies section
    const hasRecommendations = groupedRecs.improvement.length > 0 || groupedRecs.equipment.length > 0 || groupedRecs.creature.length > 0 || groupedRecs.other.length > 0;
    
    if (hasRecommendations) {
      recsHTML += '<div style="margin-bottom: 8px;">';
      
      // Best setup recommendation (highest priority)
      if (groupedRecs.improvement.length > 0) {
      groupedRecs.improvement.forEach(rec => {
          if (rec.title.includes('Best Available Setup') && rec.setup) {
            recsHTML += `<div style="margin: 3px 0; padding: 6px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E06C75;">
          <div style="font-weight: bold; color: #E06C75; font-size: 11px;">${rec.title}</div>
              <div style="font-size: 10px; margin-top: 2px; color: #ABB2BF;">${rec.description || rec.message || 'Use this setup to achieve better performance'}</div>
              <div style="font-size: 9px; color: #98C379; margin-top: 2px;">💡 ${rec.setup.map(piece => {
                  const tile = piece.tileIndex || piece.tile || '?';
                // Strip INITIAL_ prefix if present for proper name resolution
                let monsterId = piece.monsterId;
                if (monsterId && monsterId.startsWith('INITIAL_')) {
                  monsterId = monsterId.substring(8); // Remove 'INITIAL_' (8 characters)
                }
                
                // Prioritize existing monster name from piece data
                let monster = piece.monsterName;
                if (!monster || monster === piece.monsterId || monster.startsWith('INITIAL_')) {
                  monster = piece.monster?.name || piece.name || 
                           (monsterId ? getMonsterName(monsterId) : null) ||
                           'Unknown';
                }
                const equipment = piece.equipmentName || (piece.equipId ? getEquipmentName(piece.equipId) : 'No Equipment');
                return `Tile ${tile}: ${monster} + ${equipment}`;
              }).join(' | ')}</div>
            </div>`;
          }
        });
      }
      
      // Equipment and creature suggestions (based on top 10 runs from IndexedDB)
      const equipmentSuggestions = [];
      const creatureSuggestions = [];
      
      // Get top 10 runs for this room from IndexedDB (same source as Best Available Setup)
      const currentRoomId = analysis.currentBoard?.roomId || dataCollector.getCurrentBoardData()?.roomId;
      if (!currentRoomId) return;
      
      // Use IndexedDB data instead of performanceTracker.runs for consistent monster names
      const currentRoomRuns = analysis.runs || [];
      const top10Runs = currentRoomRuns.sort((a, b) => a.ticks - b.ticks).slice(0, 10);
      
      if (top10Runs.length > 0) {
        // Analyze equipment patterns in top 10 runs
        const equipmentPatterns = new Map();
        const creaturePatterns = new Map();
        
        top10Runs.forEach(run => {
          if (run.boardSetup) {
            run.boardSetup.forEach(piece => {
              // Equipment analysis
              if (piece.equipId) {
                const key = piece.equipId;
                if (!equipmentPatterns.has(key)) {
                  equipmentPatterns.set(key, { count: 0, equipmentName: piece.equipmentName || getEquipmentName(piece.equipId) });
                }
                equipmentPatterns.get(key).count++;
              }
              
              // Creature analysis - prioritize existing monster name from piece data
              if (piece.monsterId) {
                const key = piece.monsterId;
                let monsterName = piece.monsterName;
                
                // Only try to resolve name if we don't have one or it's the same as monsterId
                if (!monsterName || monsterName === piece.monsterId) {
                  try {
                    // Try to get from player context
                    const playerContext = globalThis.state?.player?.getSnapshot()?.context;
                    if (playerContext?.monsters) {
                      const monster = playerContext.monsters.find(m => m.id === piece.monsterId);
                      if (monster?.name) {
                        monsterName = monster.name;
                      }
                    }
                    
                    // Try to get from game state utils
                    if (!monsterName && globalThis.state?.utils?.getMonster) {
                      try {
                        const monsterData = globalThis.state.utils.getMonster(piece.monsterId);
                        if (monsterData?.metadata?.name) {
                          monsterName = monsterData.metadata.name;
                        }
                      } catch (e) {
                        // Try as numeric ID
                        const numericId = parseInt(piece.monsterId);
                        if (!isNaN(numericId)) {
                          const monsterData = globalThis.state.utils.getMonster(numericId);
                          if (monsterData?.metadata?.name) {
                            monsterName = monsterData.metadata.name;
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('[Board Advisor] Error resolving monster name:', error);
                  }
                }
                
                // Final fallback to monster ID if no name found
                if (!monsterName) {
                  monsterName = piece.monsterId;
                }
                
                if (!creaturePatterns.has(key)) {
                  creaturePatterns.set(key, { count: 0, monsterName: monsterName });
                }
                creaturePatterns.get(key).count++;
              }
            });
          }
        });
        
        // Get most popular equipment (appearing in 60%+ of top runs)
        for (const [equipId, pattern] of equipmentPatterns) {
          const frequency = pattern.count / top10Runs.length;
          if (frequency >= 0.6) {
            equipmentSuggestions.push(`${pattern.equipmentName} (${Math.round(frequency * 100)}%)`);
          }
        }
        
        // Get most popular creatures (appearing in 60%+ of top runs)
        for (const [monsterId, pattern] of creaturePatterns) {
          const frequency = pattern.count / top10Runs.length;
          if (frequency >= 0.6) {
            creatureSuggestions.push(`${pattern.monsterName} (${Math.round(frequency * 100)}%)`);
          }
        }
      }
      
      if (equipmentSuggestions.length > 0 || creatureSuggestions.length > 0) {
        recsHTML += `<div style="margin: 3px 0; padding: 6px; background: #4B5563; border-radius: 4px; border-left: 3px solid #61AFEF;">
          <div style="font-weight: bold; color: #61AFEF; font-size: 11px;">⚔️ Popular Choices</div>
          ${equipmentSuggestions.length > 0 ? `<div style="font-size: 10px; color: #ABB2BF; margin-top: 2px;">Equipment: ${equipmentSuggestions.join(', ')}</div>` : ''}
          ${creatureSuggestions.length > 0 ? `<div style="font-size: 10px; color: #ABB2BF; margin-top: 2px;">Creatures: ${creatureSuggestions.join(', ')}</div>` : ''}
        </div>`;
      }
      
      // Other recommendations (consolidated)
      const otherRecs = [...groupedRecs.improvement.filter(r => !r.title.includes('Best Available Setup')), ...groupedRecs.other];
      if (otherRecs.length > 0) {
        otherRecs.forEach(rec => {
          recsHTML += `<div style="margin: 3px 0; padding: 6px; background: #4B5563; border-radius: 4px; border-left: 3px solid #98C379;">
            <div style="font-weight: bold; color: #98C379; font-size: 11px;">${rec.title}</div>
            <div style="font-size: 10px; margin-top: 2px; color: #ABB2BF;">${rec.description || rec.message}</div>
            ${rec.suggestion ? `<div style="font-size: 9px; color: #61AFEF; margin-top: 2px;">💡 ${rec.suggestion}</div>` : ''}
        </div>`;
      });
      }
      
      recsHTML += '</div>';
    }
    
    
    try {
      recommendationsDisplay.innerHTML = recsHTML;
      console.log('[Board Advisor] Recommendations HTML set successfully');
    } catch (error) {
      console.error('[Board Advisor] Error setting recommendations HTML:', error);
      console.error('[Board Advisor] HTML content that caused error:', recsHTML);
      recommendationsDisplay.innerHTML = '<div style="color: #E06C75;">Error displaying recommendations</div>';
    }
  } else {
    recommendationsDisplay.innerHTML = `
      <div style="padding: 12px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
        <div style="font-weight: bold; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>⚠️</span>
          <span>No Tips Available</span>
        </div>
        <div style="font-size: 11px; color: #ABB2BF;">
          Play some games to build data for personalized recommendations and strategies.
        </div>
      </div>
    `;
  }
}

async function updatePanelWithNoDataAnalysis(analysis) {
  const analysisDisplay = document.getElementById('analysis-display');
  const recommendationsDisplay = document.getElementById('recommendations-display');
  if (!analysisDisplay || !recommendationsDisplay) return;
  
  // Get room name for display
  const roomName = globalThis.state?.utils?.ROOM_NAME?.[analysis.roomId] || analysis.roomId;
  
  // Update analysis section with no-data information
  let analysisHTML = `
    <div style="margin-bottom: 12px; padding: 8px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
      <div style="font-weight: bold; color: #FF9800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span>🗺️</span>
        <span>Current Map: ${roomName}</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Total Runs: ${analysis.totalRuns} | Room Data: 0
      </div>
    </div>
  `;
  
  // Add no-data information
  analysisHTML += `
    <div style="margin-bottom: 12px; padding: 15px; background: #1F2937; border-radius: 8px; border-left: 4px solid #FF9800;">
      <div style="font-weight: bold; color: #FF9800; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <span>📊</span>
        <span>No Data Available</span>
      </div>
      <div style="font-size: 12px; color: #ABB2BF; margin-bottom: 12px;">
        ${analysis.totalRuns > 0 
          ? `No data found for ${roomName}. You have ${analysis.totalRuns} total runs recorded, but none in this specific room.`
          : 'No historical data available for analysis. Start playing to build your first dataset!'
        }
      </div>
      <div style="font-size: 11px; color: #98C379;">
        💡 <strong>Tip:</strong> Play some games in this room or use the Board Analyzer mod to collect data for better analysis.
      </div>
    </div>
  `;
  
  // Add performance prediction section - only show if board has creatures
  if (config.showPredictions && analysis.prediction) {
    // Check if board is empty
    const currentBoard = dataCollector.getCurrentBoardData();
    const isBoardEmpty = !currentBoard || !currentBoard.boardSetup || currentBoard.boardSetup.length === 0;
    
    // Only show prediction section if board is not empty
    if (!isBoardEmpty) {
      let predictionContent = '';
      if (config.focusArea === 'ticks') {
        predictionContent = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
            <div><strong>Predicted Time:</strong> <span style="color: #98C379;">${analysis.prediction.predictedTime || 'Unknown'} ticks</span></div>
            <div><strong>Confidence:</strong> <span style="color: #E06C75;">0%</span></div>
            <div><strong>Success Rate:</strong> <span style="color: #98C379;">${analysis.prediction.successRate || 'Unknown'}%</span></div>
            <div><strong>Similar Setups:</strong> <span style="color: #61AFEF;">0 found</span></div>
          </div>
        `;
      } else if (config.focusArea === 'ranks') {
        predictionContent = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
            <div><strong>Predicted Time:</strong> <span style="color: #98C379;">${analysis.prediction.predictedTime || 'Unknown'}</span></div>
            <div><strong>Predicted Points:</strong> <span style="color: #98C379;">${analysis.prediction.predictedPoints || 'Unknown'}</span></div>
            <div><strong>Success Rate:</strong> <span style="color: #98C379;">${analysis.prediction.successRate || 'Unknown'}%</span></div>
            <div><strong>Similar Setups:</strong> <span style="color: #61AFEF;">0 found</span></div>
          </div>
        `;
      }
      
      analysisHTML += `
        <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #3B82F6;">
          <div style="font-weight: bold; color: #3B82F6; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span>
            <span>Performance Prediction (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
          </div>
          ${predictionContent}
        </div>
      `;
    }
  }
  
  // Add leaderboard comparison section with real WR data
  try {
    const currentBoard = dataCollector.getCurrentBoardData();
    if (currentBoard && currentBoard.roomId) {
      const wrData = await fetchLeaderboardWRData(currentBoard.roomId);
      
      let leaderboardContent = `<div><strong>Room:</strong> ${roomName}</div>`;
      
      // Show only relevant leaderboard info based on focus area
      if (config.focusArea === 'ticks' && wrData.tickData && wrData.tickData.length > 0) {
        const wr = wrData.tickData[0];
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: bold;">${wr.ticks} ticks</span></div>`;
        leaderboardContent += `<div><strong>Holder:</strong> <span style="color: #61AFEF;">${wr.userName}</span></div>`;
        
        // Show user's best if available
        const userScores = getUserBestScores();
        if (userScores && userScores.bestTicks) {
          const gap = userScores.bestTicks - wr.ticks;
          const gapColor = gap <= 0 ? '#98C379' : gap <= 10 ? '#E5C07B' : '#E06C75';
          const gapText = gap <= 0 ? 'WR' : gap === 1 ? '+1 tick' : `+${gap} ticks`;
          leaderboardContent += `<div><strong>Your Best:</strong> <span style="color: ${gapColor};">${userScores.bestTicks} (${gapText})</span></div>`;
        }
      } else if (config.focusArea === 'ranks' && wrData.rankData && wrData.rankData.length > 0) {
        const wr = wrData.rankData[0];
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: bold;">${wr.rank} points</span></div>`;
        leaderboardContent += `<div><strong>Holder:</strong> <span style="color: #61AFEF;">${wr.userName}</span></div>`;
        
        // Show user's best if available
        const userScores = getUserBestScores();
        if (userScores && userScores.bestRank) {
          const gap = wr.rank - userScores.bestRank;
          const gapColor = gap <= 0 ? '#98C379' : gap <= 10 ? '#E5C07B' : '#E06C75';
          const gapText = gap <= 0 ? 'WR' : gap === 1 ? '-1 point' : `-${gap} points`;
          leaderboardContent += `<div><strong>Your Best:</strong> <span style="color: ${gapColor};">${userScores.bestRank} (${gapText})</span></div>`;
        }
      } else {
        leaderboardContent += `<div style="color: #9CA3AF;">No ${config.focusArea === 'ticks' ? 'speed' : 'rank'} data available</div>`;
      }
      
      analysisHTML += `
        <div style="margin-bottom: 8px; padding: 6px 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #3B82F6;">
          <div style="font-weight: 600; color: #3B82F6; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
            <span>🏆</span>
            <span>Leaderboard Comparison (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
          </div>
          <div style="font-size: 11px; line-height: 1.3;">
            ${leaderboardContent}
          </div>
        </div>
      `;
    } else {
      // Fallback for no board data
      analysisHTML += `
        <div style="margin-bottom: 8px; padding: 6px 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #E5C07B;">
          <div style="font-weight: 600; color: #E5C07B; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
            <span>🏆</span>
            <span>Leaderboard Comparison (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
          </div>
          <div style="font-size: 11px; color: #9CA3AF; line-height: 1.3;">
            Room: ${roomName}
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.warn('[Board Advisor] Error fetching leaderboard data in basic analysis:', error);
    // Fallback to basic room info
    analysisHTML += `
      <div style="margin-bottom: 8px; padding: 6px 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: 600; color: #E5C07B; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
          <span>🏆</span>
          <span>Leaderboard Comparison (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
        </div>
        <div style="font-size: 11px; color: #9CA3AF; line-height: 1.3;">
          Room: ${roomName}
        </div>
      </div>
    `;
  }
  
  // Check if we actually have historical data before showing warning
  const currentBoard = dataCollector.getCurrentBoardData();
  if (currentBoard) {
    const roomRuns = performanceTracker.runs.filter(r => r.roomId === currentBoard.roomId);
    const isBoardEmpty = !currentBoard.boardSetup || currentBoard.boardSetup.length === 0;
    
    if (roomRuns.length > 0) {
      // Show data available message instead of no data warning
      analysisHTML += `
        <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #98C379;">
          <div style="font-weight: bold; color: #98C379; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>📊</span>
            <span>Historical Data Available</span>
          </div>
          <div style="font-size: 11px; color: #ABB2BF;">
            Found ${roomRuns.length} runs for this map. Analysis and recommendations are being processed.
          </div>
        </div>
      `;
    } else if (isBoardEmpty) {
      // Show empty board message
      analysisHTML += `
        <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #E5C07B;">
          <div style="font-weight: bold; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span>
            <span>Empty Board</span>
          </div>
          <div style="font-size: 11px; color: #ABB2BF;">
            Place creatures on the board to get analysis and recommendations for your setup.
          </div>
        </div>
      `;
    } else {
      // Show no data warning only when there's actually no data
      analysisHTML += `
        <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #E5C07B;">
          <div style="font-weight: bold; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span>
            <span>No Historical Data</span>
          </div>
          <div style="font-size: 11px; color: #ABB2BF;">
            Play some games with this setup to build data for better analysis and recommendations.
          </div>
        </div>
      `;
    }
  }
  
  analysisDisplay.innerHTML = analysisHTML;
  
  // Update recommendation sections based on focus area
  
  // Update recommendations section with helpful guidance
  let recsHTML = '';
  
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    analysis.recommendations.forEach(rec => {
      const priorityColor = rec.priority === 'high' ? '#FF9800' : rec.priority === 'medium' ? '#E5C07B' : '#61AFEF';
      
      // Special handling for setup recommendations and improvement recommendations with setup
      if ((rec.type === 'setup' && rec.setup) || (rec.type === 'improvement' && rec.setup)) {
        recsHTML += `
          <div style="margin: 8px 0; padding: 12px; background: #1F2937; border-radius: 6px; border-left: 4px solid ${priorityColor};">
            <div style="font-weight: bold; color: ${priorityColor}; font-size: 12px; margin-bottom: 6px;">
              ${rec.title}
            </div>
            <div style="font-size: 11px; color: #ABB2BF; margin-bottom: 8px;">
              ${rec.description || rec.message || 'Recommended setup from your best performing run'}
            </div>
            ${rec.bestRun ? `
              <div style="margin: 8px 0; padding: 8px; background: #2D3748; border-radius: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px;">
                  <div><strong style="color: #98C379;">Best Time:</strong> <span style="color: #ffd700;">${rec.bestRun.ticks} ticks</span></div>
                  <div><strong style="color: #98C379;">Room:</strong> <span style="color: #61AFEF;">${rec.bestRun.roomId}</span></div>
                  <div><strong style="color: #98C379;">Source:</strong> <span style="color: #E5C07B;">${rec.bestRun.source || 'Unknown'}</span></div>
                  <div><strong style="color: #98C379;">Completed:</strong> <span style="color: #98C379;">${rec.bestRun.completed ? 'Yes' : 'No'}</span></div>
                </div>
              </div>
            ` : rec.setup.bestTime ? `
              <div style="margin: 8px 0; padding: 8px; background: #2D3748; border-radius: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px;">
                  <div><strong style="color: #98C379;">Best Time:</strong> <span style="color: #ffd700;">${rec.setup.bestTime} ticks</span></div>
                  <div><strong style="color: #98C379;">Average Time:</strong> <span style="color: #61AFEF;">${rec.setup.averageTime} ticks</span></div>
                  <div><strong style="color: #98C379;">Total Runs:</strong> <span style="color: #E5C07B;">${rec.setup.totalRuns}</span></div>
                  <div><strong style="color: #98C379;">Success Rate:</strong> <span style="color: #98C379;">${rec.setup.successRate}%</span></div>
                </div>
              </div>
            ` : ''}
            ${rec.setup && Array.isArray(rec.setup) ? `
              <div style="margin: 8px 0; padding: 6px; background: #2D3748; border-radius: 4px;">
                <div style="font-size: 11px; color: #61AFEF; margin-bottom: 4px; font-weight: bold;">📋 Recommended Setup:</div>
                <div style="font-size: 10px; color: #ABB2BF; line-height: 1.3; margin-bottom: 6px;">
                  ${rec.setup.map((piece, index) => {
                    const tile = piece.tileIndex || piece.tile || '?';
                    const monsterId = piece.monsterId || piece.monster?.id || piece.monster?.name;
                    
                    // Use stored monster name, fall back to ID if not available
                    const monster = piece.monsterName || monsterId;
                    
                    // Get monster stats for display
                    const statsDisplay = piece.monsterStats ? formatMonsterStats(piece.monsterStats) : '';
                    
                    // Use stored equipment name, fall back to ID lookup if not available
                    const equipment = piece.equipmentName || (piece.equipId ? getEquipmentName(piece.equipId) : null);
                    const stat = piece.stat || piece.equipment?.stat || '';
                    
                    // Handle equipment-only pieces (no monster)
                    const displayText = monster && monster !== 'Unknown' 
                      ? `Tile ${tile}: ${monster} ${statsDisplay}${equipment ? ` + ${equipment}${stat ? ` (${stat})` : ''}` : ''}`
                      : `Tile ${tile}: ${equipment}${stat ? ` (${stat})` : ''}`;
                    
                    return `<div style="margin: 2px 0; padding: 2px 4px; background: #1F2937; border-radius: 2px; display: inline-block; margin-right: 4px;">
                      ${displayText}
                    </div>`;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        // Standard recommendation display
        recsHTML += `
          <div style="margin: 8px 0; padding: 12px; background: #1F2937; border-radius: 6px; border-left: 4px solid ${priorityColor};">
            <div style="font-weight: bold; color: ${priorityColor}; font-size: 12px; margin-bottom: 6px;">
              ${rec.title}
            </div>
            <div style="font-size: 11px; color: #ABB2BF; margin-bottom: 8px;">
              ${rec.description}
            </div>
          </div>
        `;
      }
    });
  }
  
  console.log('[Board Advisor] About to set innerHTML with recsHTML length:', recsHTML?.length || 0);
  console.log('[Board Advisor] recsHTML preview:', recsHTML?.substring(0, 200) || 'empty');
  try {
    recommendationsDisplay.innerHTML = recsHTML || `
    <div style="text-align: center; color: #777; font-style: italic; padding: 20px;">
      No recommendations available. Play some games to build data for analysis.
    </div>
  `;
  } catch (error) {
    console.error('[Board Advisor] Error setting final HTML:', error);
    console.error('[Board Advisor] HTML content that caused error:', recsHTML);
    recommendationsDisplay.innerHTML = '<div style="color: #E06C75;">Error displaying recommendations</div>';
  }
  
  // Add event listeners for load setup buttons
  console.log('[Board Advisor] HTML content set, looking for buttons...');
  console.log('[Board Advisor] HTML content:', recommendationsDisplay.innerHTML.substring(0, 500));
  
  // Use setTimeout to ensure DOM is fully updated before attaching event handlers
  setTimeout(() => {
    const copyButtons = recommendationsDisplay.querySelectorAll('.copy-replay-btn');
    console.log('[Board Advisor] Found', copyButtons.length, 'load setup buttons');
    console.log('[Board Advisor] Available setups in window.boardAdvisorSetups:', window.boardAdvisorSetups);
    
    if (copyButtons.length === 0) {
      console.warn('[Board Advisor] No load setup buttons found in DOM');
      return;
    }
    
    copyButtons.forEach((button, index) => {
      console.log(`[Board Advisor] Attaching event handler to button ${index}`);
      console.log(`[Board Advisor] Button ${index} data-setup-index:`, button.getAttribute('data-setup-index'));
      
      // Add a test click handler first
      button.addEventListener('click', (e) => {
        console.log('[Board Advisor] TEST: Button clicked!', e.target);
      });
      
      button.addEventListener('click', async (event) => {
        console.log('[Board Advisor] Load setup button clicked');
        try {
          // Get setup data from global variable using index
          const setupIndex = parseInt(button.getAttribute('data-setup-index'));
          console.log('[Board Advisor] Setup index:', setupIndex);
          const setupData = window.boardAdvisorSetups[setupIndex];
          console.log('[Board Advisor] Setup data:', setupData);
          
          if (!setupData) {
            throw new Error('Setup data not found for index: ' + setupIndex);
          }
          
          await window.loadRecommendedSetup(setupData);
          
          // Update button text to show success
          const originalText = button.textContent;
          button.textContent = 'Loaded!';
          button.style.backgroundColor = '#10B981';
          setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '#10B981';
          }, 2000);
        } catch (error) {
          console.error('[Board Advisor] Error parsing setup data:', error);
          alert('Error loading setup: ' + error.message);
        }
      });
    });
  }, 0);
  
  // Also add event delegation as a fallback
  console.log('[Board Advisor] Adding click event listener to recommendations display');
  recommendationsDisplay.addEventListener('click', async (event) => {
    console.log('[Board Advisor] *** ANY CLICK DETECTED ***');
    console.log('[Board Advisor] Click detected on:', event.target);
    console.log('[Board Advisor] Click target classes:', event.target.classList.toString());
    console.log('[Board Advisor] Click target tagName:', event.target.tagName);
    console.log('[Board Advisor] Click target textContent:', event.target.textContent);
    
    if (event.target.classList.contains('copy-replay-btn')) {
      console.log('[Board Advisor] Load setup button clicked via delegation');
      try {
        // Get setup data from global variable using index
        const setupIndex = parseInt(event.target.getAttribute('data-setup-index'));
        console.log('[Board Advisor] Setup index (delegation):', setupIndex);
        const setupData = window.boardAdvisorSetups[setupIndex];
        console.log('[Board Advisor] Setup data (delegation):', setupData);
        
        if (!setupData) {
          throw new Error('Setup data not found for index: ' + setupIndex);
        }
        
        await window.loadRecommendedSetup(setupData);
        
        // Update button text to show success
        const originalText = event.target.textContent;
        event.target.textContent = 'Loaded!';
        event.target.style.backgroundColor = '#10B981';
        setTimeout(() => {
          event.target.textContent = originalText;
          event.target.style.backgroundColor = '#10B981';
        }, 2000);
      } catch (error) {
        console.error('[Board Advisor] Error parsing setup data (delegation):', error);
        alert('Error loading setup: ' + error.message);
      }
    }
  });
  
  // Test if button is clickable at all
  setTimeout(() => {
    const testButtons = recommendationsDisplay.querySelectorAll('.copy-replay-btn');
    console.log('[Board Advisor] Test: Found', testButtons.length, 'buttons after timeout');
    testButtons.forEach((button, index) => {
      console.log('[Board Advisor] Test: Button', index, 'has data-setup:', button.getAttribute('data-setup'));
      // Add a simple test click handler
      button.addEventListener('click', () => {
        console.log('[Board Advisor] Test: Button clicked!');
      });
    });
  }, 100);
  
}


function getPriorityColor(priority) {
  switch (priority) {
    case 'high': return '#E06C75';
    case 'medium': return '#E5C07B';
    case 'low': return '#61AFEF';
    default: return '#ABB2BF';
  }
}

// =======================
// 6. AUTO-REFRESH SYSTEM
// =======================

// Start state-based panel refresh
function startStateRefresh() {
  if (stateRefreshSystem.isEnabled) {
    stopStateRefresh();
  }
  
  // Check if globalThis.state is available
  if (!globalThis.state) {
    console.warn('[Board Advisor] Global state not available, cannot start state refresh');
    return;
  }
  
  // Initialize IndexedDB if not already done
  if (!isDBReady) {
    initSandboxDB().catch(error => {
      console.error('[Board Advisor] Failed to initialize IndexedDB:', error);
    });
  }
  
  if (config.autoRefreshPanel && panelState.isOpen) {
    stateRefreshSystem.isEnabled = true;
    
    // Subscribe to board state changes (game setup, mode changes, etc.)
    const boardSubscription = globalThis.state.board.subscribe((state) => {
      handleStateChange('board', state);
    });
    stateRefreshSystem.subscriptions.push(boardSubscription);
    
    // Subscribe to game timer changes (game progress, results)
    const timerSubscription = globalThis.state.gameTimer.subscribe((state) => {
      handleStateChange('gameTimer', state);
    });
    stateRefreshSystem.subscriptions.push(timerSubscription);
    
    // Subscribe to player state changes (inventory, monsters, equipment)
    const playerSubscription = globalThis.state.player.subscribe((state) => {
      handleStateChange('player', state);
    });
    stateRefreshSystem.subscriptions.push(playerSubscription);
    
    // Subscribe to daily state changes (boosted maps, special events)
    const dailySubscription = globalThis.state.daily.subscribe((state) => {
      handleStateChange('daily', state);
    });
    stateRefreshSystem.subscriptions.push(dailySubscription);
    
    // Subscribe to menu state changes (UI state, selections)
    const menuSubscription = globalThis.state.menu.subscribe((state) => {
      handleStateChange('menu', state);
    });
    stateRefreshSystem.subscriptions.push(menuSubscription);
    
    console.log('[Board Advisor] State-based refresh started');
  }
}

// Stop state-based panel refresh
function stopStateRefresh() {
  stateRefreshSystem.subscriptions.forEach(subscription => {
    if (subscription && typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
    }
  });
  stateRefreshSystem.subscriptions = [];
  stateRefreshSystem.isEnabled = false;
  console.log('[Board Advisor] State-based refresh stopped');
}

// Handle state changes with rate limiting
function handleStateChange(source, state) {
  if (!stateRefreshSystem.isEnabled || !panelState.isOpen) return;
  
  // Check if globalThis.state is still available
  if (!globalThis.state) {
    console.warn('[Board Advisor] Global state not available, stopping state refresh');
    stopStateRefresh();
    return;
  }
  
  const now = Date.now();
  const timeSinceLastRefresh = now - stateRefreshSystem.lastRefreshTime;
  
  // Rate limit: maximum once per second
  if (timeSinceLastRefresh < 1000) return;
  
  stateRefreshSystem.lastRefreshTime = now;
  
  console.log(`[Board Advisor] State change detected from ${source}, refreshing panel`);
  refreshPanelData();
}

// Refresh panel data
async function refreshPanelData() {
  if (!panelState.isOpen) return;
  
  
  // If we have current analysis, refresh it
  if (analysisState.currentAnalysis) {
    await updatePanelWithAnalysis(analysisState.currentAnalysis);
  } else {
    // Try to get fresh analysis if panel is open
    const currentBoard = dataCollector.getCurrentBoardData();
    if (currentBoard && currentBoard.boardSetup.length > 0) {
      await updatePanelWithBasicAnalysis(currentBoard);
    }
  }
  
  console.log('[Board Advisor] Panel data refreshed automatically');
}


// =======================
// 8. LEADERBOARD DATA FUNCTIONS
// =======================

// Helper function to fetch data from TRPC API (same as Better Highscores.js)
async function fetchTRPC(method) {
  try {
    const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
    const res = await fetch(`/pt/api/trpc/${method}?batch=1&input=${inp}`, {
      headers: { 
        'Accept': '*/*', 
        'Content-Type': 'application/json', 
        'X-Game-Version': '1' 
      }
    });
    
    if (!res.ok) {
      throw new Error(`${method} → ${res.status}`);
    }
    
    const json = await res.json();
    return json[0].result.data.json;
  } catch (error) {
    console.error('[Board Advisor] Error fetching from TRPC:', error);
    throw error;
  }
}

// Function to fetch leaderboard WR data for a specific map
async function fetchLeaderboardWRData(mapCode) {
  try {
    const leaderboardData = await fetchTRPC('game.getRoomsHighscores');
    
    // Extract data from the correct structure
    const tickData = leaderboardData?.ticks?.[mapCode] ? [leaderboardData.ticks[mapCode]] : [];
    const rankData = leaderboardData?.rank?.[mapCode] ? [leaderboardData.rank[mapCode]] : [];
    
    return {
      tickData,
      rankData
    };
  } catch (error) {
    console.error('[Board Advisor] Error fetching leaderboard data:', error);
    return { tickData: [], rankData: [] };
  }
}

// Function to get user's best scores for current map
function getUserBestScores() {
  try {
    const currentBoard = dataCollector.getCurrentBoardData();
    if (!currentBoard || !currentBoard.roomId) {
      return null;
    }
    
    const mapCode = currentBoard.roomId;
    
    // Get player data
    const playerSnapshot = globalThis.state.player.getSnapshot();
    if (!playerSnapshot || !playerSnapshot.context || !playerSnapshot.context.rooms) {
      return null;
    }
    
    // Get user's data for current map
    const userMapData = playerSnapshot.context.rooms[mapCode];
    if (!userMapData) {
      return null;
    }
    
    return {
      bestTicks: userMapData.ticks || null,
      bestRank: userMapData.rank || null
    };
  } catch (error) {
    console.error('[Board Advisor] Error getting user best scores:', error);
    return null;
  }
}

// =======================
// 9. INITIALIZATION
// =======================

// Initialize components
const dataCollector = new DataCollector();
const leaderboardAnalyzer = new LeaderboardAnalyzer();
const boardAnalyzer = new AnalysisEngine(dataCollector, leaderboardAnalyzer);

// Initialize sandbox storage
initSandboxDB();

// Create UI
createUI();

// Start data collection
if (config.enabled) {
  dataCollector.startTracking();
  
  // Try to load all data sources on initialization with proper coordination
  setTimeout(async () => {
    console.log('[Board Advisor] Starting initialization data loading...');
    await loadAllDataSources(true); // Trigger analysis after loading
  }, 2000); // Wait 2 seconds for RunTracker to initialize
}

// =======================
// 10. PUBLIC API
// =======================

// Make Board Advisor API available globally for manual testing
if (!window.BoardAdvisorAPI) {
  window.BoardAdvisorAPI = {
    // Add a Board Analyzer run manually (for testing)
    addBoardAnalyzerRun: async (runData) => {
      console.log('[Board Advisor] Manually adding Board Analyzer run:', runData);
      return await addBoardAnalyzerRun(runData);
    },
    
    // Get sandbox run statistics
    getSandboxStats: async () => {
      try {
        const allMetadata = await getAllRoomMetadata();
        const roomStats = {};
        let totalRuns = 0;
        
        // Convert metadata to stats format
        allMetadata.forEach(metadata => {
          roomStats[metadata.roomId] = {
            totalRuns: metadata.totalRuns || 0,
            bestTime: metadata.bestTicks || 0,
            bestRank: metadata.bestRankPoints || 0,
            averageTime: 0, // Not stored in metadata
            successRate: 0  // Not stored in metadata
          };
          totalRuns += metadata.totalRuns || 0;
        });
        
        return {
          totalRuns: totalRuns,
          totalMaps: Object.keys(roomStats).length,
          lastUpdated: Date.now(),
          roomStats: roomStats
        };
      } catch (error) {
        console.error('[Board Advisor] Error getting sandbox stats:', error);
        return {
          totalRuns: 0,
          totalMaps: 0,
          lastUpdated: 0,
          roomStats: {}
        };
      }
    },
    
    // Clear all sandbox runs
    clearSandboxRuns: async () => {
      try {
        // Clear all room stores
        if (!isDBReady) {
          await initSandboxDB();
        }
        
        const roomIds = [];
        try {
          if (globalThis.state?.utils?.ROOMS) {
            Object.keys(globalThis.state.utils.ROOMS).forEach(roomId => {
              roomIds.push(roomId);
            });
            console.log(`[Board Advisor] Found ${roomIds.length} rooms from game state for clearing`);
          } else {
            console.warn('[Board Advisor] No game state available for room detection, skipping room-specific clearing');
            // Instead of hardcoded fallback, clear all existing object stores
            const existingStores = Array.from(sandboxDB.objectStoreNames);
            const roomStores = existingStores.filter(storeName => storeName.startsWith('room_'));
            roomStores.forEach(storeName => {
              const roomId = storeName.replace('room_', '');
              roomIds.push(roomId);
            });
            console.log(`[Board Advisor] Found ${roomIds.length} existing room stores to clear`);
          }
        } catch (error) {
          console.warn('[Board Advisor] Error getting room IDs, using existing stores:', error);
          // Fallback: clear all existing room stores
          const existingStores = Array.from(sandboxDB.objectStoreNames);
          const roomStores = existingStores.filter(storeName => storeName.startsWith('room_'));
          roomStores.forEach(storeName => {
            const roomId = storeName.replace('room_', '');
            roomIds.push(roomId);
          });
          console.log(`[Board Advisor] Using ${roomIds.length} existing room stores for clearing`);
        }
        
        // Clear each room store
        for (const roomId of roomIds) {
          const storeName = getRoomStoreName(roomId);
          if (sandboxDB.objectStoreNames.contains(storeName)) {
            const transaction = sandboxDB.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await new Promise((resolve, reject) => {
              const request = store.clear();
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          }
        }
        
        // Clear room metadata
        const metadataTransaction = sandboxDB.transaction([ROOM_METADATA_STORE], 'readwrite');
        const metadataStore = metadataTransaction.objectStore(ROOM_METADATA_STORE);
        await new Promise((resolve, reject) => {
          const request = metadataStore.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        console.log('[Board Advisor] All sandbox runs cleared');
        return true;
      } catch (error) {
        console.error('[Board Advisor] Error clearing sandbox runs:', error);
        return false;
      }
    },
    
    // Load Board Analyzer data
    loadBoardAnalyzerData: async () => {
      return await loadBoardAnalyzerData(true);
    },
    
    // Get sandbox runs for a specific room
    getSandboxRunsForRoom: async (roomId, limit = MAX_RUNS_PER_ROOM) => {
      return await getSandboxRunsForRoom(roomId, limit);
    },
    
    // Room-based metadata functions
    getRoomMetadata: async (roomId) => {
      return await getRoomMetadata(roomId);
    },
    
    getAllRoomMetadata: async () => {
      return await getAllRoomMetadata();
    },
    
    // Get optimized room statistics
    getRoomStatistics: async (roomId) => {
      try {
        const [metadata, runs] = await Promise.all([
          getRoomMetadata(roomId),
          getSandboxRunsForRoom(roomId, 10) // Get recent runs for additional stats
        ]);
        
        if (!metadata) {
          return null;
        }
        
        return {
          roomId: roomId,
          totalRuns: metadata.totalRuns,
          bestTicks: metadata.bestTicks === Infinity ? 0 : metadata.bestTicks,
          bestRankPoints: metadata.bestRankPoints,
          lastUpdated: metadata.lastUpdated,
          recentRuns: runs.length,
          averageTicks: runs.length > 0 ? runs.reduce((sum, run) => sum + (run.ticks || 0), 0) / runs.length : 0,
          averageRankPoints: runs.length > 0 ? runs.reduce((sum, run) => sum + (run.rankPoints || 0), 0) / runs.length : 0
        };
      } catch (error) {
        console.error('[Board Advisor] Error getting room statistics:', error);
        return null;
      }
    },
    
    // Get all run data (performance tracker + sandbox + runtracker)
    getAllRunData: async () => {
      try {
        const allSandboxRuns = await getAllSandboxRuns();
      return {
        performanceTracker: performanceTracker.runs,
          sandbox: allSandboxRuns,
          runTracker: runTrackerData
        };
      } catch (error) {
        console.error('[Board Advisor] Error getting all run data:', error);
        return {
          performanceTracker: performanceTracker.runs,
          sandbox: [],
        runTracker: runTrackerData
      };
    }
    },
    
    // Initialize IndexedDB
    initializeDB: async () => {
      try {
        await initSandboxDB();
        console.log('[Board Advisor] IndexedDB initialized');
        return true;
      } catch (error) {
        console.error('[Board Advisor] Error initializing IndexedDB:', error);
        return false;
      }
    },
    
    // Transform stored run data to $replay format
    transformRunToReplay: (runData) => {
      return transformRunToReplay(runData);
    },
    
    // Generate $replay link from stored run data
    generateReplayLink: (runData) => {
      return generateReplayLink(runData);
    },
    
    // Get best run for a room and generate replay link
    getBestRunReplayLink: async (roomId) => {
      try {
        const runs = await getSandboxRunsForRoom(roomId, 1); // Get only the best run
        if (runs.length === 0) {
          return null;
        }
        
        const bestRun = runs[0]; // Should be the best run
        return generateReplayLink(bestRun);
      } catch (error) {
        console.error('[Board Advisor] Error getting best run replay link:', error);
        return null;
      }
    },
    
    // Example: Get all runs for a room and show their replay links
    getRoomReplayLinks: async (roomId, limit = 5) => {
      try {
        const runs = await getSandboxRunsForRoom(roomId, limit);
        return runs.map(run => {
          const replayLink = generateReplayLink(run);
          return {
            ticks: run.ticks,
            rankPoints: run.rankPoints,
            completed: run.completed,
            replayLink: replayLink,
            hasCompleteData: !!replayLink, // true if replay link was generated successfully
            timestamp: run.timestamp
          };
        });
      } catch (error) {
        console.error('[Board Advisor] Error getting room replay links:', error);
        return [];
      }
    },
    
    // Check if current board setup has complete data for replay generation
    validateCurrentBoardData: () => {
      try {
        const currentBoard = dataCollector.getCurrentBoardData();
        if (!currentBoard || !currentBoard.boardSetup || currentBoard.boardSetup.length === 0) {
          return { valid: false, reason: 'No board setup found' };
        }
        
        const incompletePieces = [];
        currentBoard.boardSetup.forEach((piece, index) => {
          const hasMonsterData = piece.monsterName && piece.monsterStats && 
            piece.monsterStats.hp !== undefined && 
            piece.monsterStats.ad !== undefined && 
            piece.monsterStats.ap !== undefined && 
            piece.monsterStats.armor !== undefined && 
            piece.monsterStats.magicResist !== undefined;
          
          const hasEquipmentData = piece.equipmentName && piece.equipmentStat && piece.equipmentTier !== undefined;
          
          if (!hasMonsterData || !hasEquipmentData) {
            incompletePieces.push({
              index: index,
              tile: piece.tileIndex,
              missingMonsterData: !hasMonsterData,
              missingEquipmentData: !hasEquipmentData
            });
          }
        });
        
        if (incompletePieces.length > 0) {
          return { 
            valid: false, 
            reason: 'Incomplete monster/equipment data', 
            incompletePieces: incompletePieces 
          };
        }
        
        return { valid: true, reason: 'Complete data available' };
      } catch (error) {
        console.error('[Board Advisor] Error validating board data:', error);
        return { valid: false, reason: 'Validation error' };
      }
    }
  };
}

// Export functionality
exports = {
  analyzeBoard: () => boardAnalyzer.analyzeCurrentBoard(),
  getRecommendations: () => analysisState.currentAnalysis?.recommendations || [],
  getPrediction: () => analysisState.currentAnalysis?.prediction || null,
  getHistoricalData: () => performanceTracker.runs,
  loadRunTrackerData: () => loadRunTrackerData(),
  loadBoardAnalyzerData: () => loadBoardAnalyzerData(),
  loadAllDataSources: () => loadAllDataSources(),
  refreshData: async () => {
    // Clear current data and reload from all sources
    performanceTracker.runs = [];
    performanceTracker.patterns.clear();
    performanceTracker.optimalSetups.clear();
    performanceTracker.roomStats.clear();
    
  // CACHE FIX: Also clear all performance caches
  dataCollector.forceRefreshRoomDetection();
  performanceCache.dataLoadingCache.clear();
  // Don't clear pattern matching cache on refresh - it's expensive to rebuild
  // performanceCache.patternMatchingCache.clear();
  analysisState.currentAnalysis = null;
  analysisState.lastBoardHash = null;
    
    await loadAllDataSources(false); // Don't trigger analysis automatically
    console.log('[Board Advisor] Data refreshed from all sources with cache invalidation');
  },
  clearData: () => {
    performanceTracker.runs = [];
    performanceTracker.patterns.clear();
    performanceTracker.optimalSetups.clear();
    performanceTracker.roomStats.clear();
    console.log('[Board Advisor] Historical data cleared');
  },
  
  // CACHE FIX: Manual cache invalidation function
  invalidateCaches: async (roomId = null) => {
    try {
      console.log('[Board Advisor] Manual cache invalidation requested...');
      
      if (roomId) {
        // Invalidate caches for specific room
        await invalidateCachesAndRefreshData(roomId);
      } else {
        // Invalidate all caches
        dataCollector.forceRefreshRoomDetection();
        performanceCache.dataLoadingCache.clear();
        // Only clear pattern matching cache when explicitly requested
        performanceCache.patternMatchingCache.clear();
        analysisState.currentAnalysis = null;
        analysisState.lastBoardHash = null;
        
        // Refresh data from all sources
        await loadAllDataSources(false);
        
        // If panel is open, refresh display
        if (panelState.isOpen) {
          setTimeout(async () => {
            try {
              await refreshPanelData();
              debouncedAnalyzeCurrentBoard();
            } catch (error) {
              console.warn('[Board Advisor] Error refreshing panel after manual cache invalidation:', error);
            }
          }, 100);
        }
      }
      
      console.log('[Board Advisor] Manual cache invalidation completed');
      return true;
    } catch (error) {
      console.error('[Board Advisor] Error during manual cache invalidation:', error);
      return false;
    }
  },
  cleanup: () => {
    // Cleanup function for when mod is disabled
    stopStateRefresh();
    
    // Clear all caches and timeouts
    analysisTimeout = null;
    
    console.log('[Board Advisor] Cleanup completed');
  }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopStateRefresh();
});
