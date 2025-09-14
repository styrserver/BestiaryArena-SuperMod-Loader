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

// Constants
const MOD_ID = 'board-advisor';
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;
const ANALYSIS_DEBOUNCE_TIME = 1000;
const BOARD_CHANGE_DEBOUNCE_TIME = 2000; // Increased debounce for board changes
const SANDBOX_DB_NAME = 'BestiaryArena_SandboxRuns';
const ROOM_METADATA_STORE = 'roomMetadata';
const MAX_RUNS_PER_ROOM = 500;
const TILE_HIGHLIGHT_OVERLAY_ID = 'board-advisor-tile-highlight';
const TILE_HIGHLIGHT_STYLE_ID = 'board-advisor-highlight-styles';
const PANEL_ID = "board-advisor-panel";

// Configuration
const defaultConfig = {
  enabled: true,
  analysisDepth: 50,
  learningEnabled: true,
  recommendationThreshold: 0.1,
  showPredictions: true,
  autoAnalyze: true,
  autoAnalyzeOnBoardChange: true,
  autoAnalyzeOnPanelOpen: true,
  autoAnalyzeAfterRun: true,
  autoRefreshPanel: true,
  focusArea: 'ticks',
  enableTileRecommendations: true
};

let config = Object.assign({}, defaultConfig, context.config);

// Runtime State
let analysisTimeout = null;
let lastAnalysisTime = 0;
let pendingAnalysisRequest = null;
let runTrackerData = null;
let sandboxDB = null;
let isDBReady = false;
let currentRecommendedSetup = null;
let placedRecommendedPieces = new Set();
let previousRoomId = null;
let previousBoardPieceCount = 0;

// Analysis State
let analysisState = {
  isAnalyzing: false,
  isDataLoading: false,
  currentAnalysis: null,
  historicalData: [],
  patterns: {},
  recommendations: null,
  lastBoardHash: null,
  lastDataLoadTime: 0,
  isUILoading: false,
  pendingBoardChange: null,
  lastBoardChangeTime: 0
};

// Performance Cache
let performanceCache = {
  lastRoomDetection: null,
  lastRoomDetectionTime: 0
};

// State Management
let stateRefreshSystem = {
  lastRefreshTime: 0,
  subscriptions: [],
  isEnabled: false
};

// Track active subscriptions for cleanup
let activeSubscriptions = [];

// Track document event listeners for cleanup
let documentListeners = [];

let performanceTracker = {
  runs: [],
  patterns: new Map(),
  optimalSetups: new Map(),
  roomStats: new Map()
};

// UI State
let panelState = {
  isOpen: false,
  position: { x: 10, y: 70 },
    size: { width: 350, height: 820 }
};

// Utility Functions
function generateBoardHash(boardSetup) {
  if (!boardSetup || boardSetup.length === 0) return 'empty';
  
  return boardSetup
    .map(piece => `${piece.tileIndex}-${piece.monsterName || 'empty'}-${piece.equipmentName || 'empty'}`)
    .sort()
    .join('|');
}

// Loading State Management
function setUILoadingState(isLoading, reason = '') {
  // Prevent setting loading to false if there are pending operations
  if (!isLoading && analysisState.pendingBoardChange) {
    console.log(`[Board Advisor] UI loading completion delayed - board change still pending`);
    return;
  }
  
  analysisState.isUILoading = isLoading;
  if (isLoading) {
    console.log(`[Board Advisor] UI loading started: ${reason}`);
    // Show loading indicator in panel if open
    if (panelState.isOpen) {
      showLoadingIndicator();
    }
  } else {
    console.log(`[Board Advisor] UI loading completed: ${reason}`);
    // Hide loading indicator
    if (panelState.isOpen) {
      hideLoadingIndicator();
    }
  }
}

function showLoadingIndicator() {
  const recommendationsDisplay = document.getElementById('recommendations-display');
  if (recommendationsDisplay && !recommendationsDisplay.querySelector('.loading-indicator')) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-indicator';
    loadingDiv.style.cssText = `
      margin: 8px 0; 
      padding: 12px; 
      background: #1F2937; 
      border-radius: 6px; 
      border-left: 4px solid #3B82F6;
      text-align: center;
    `;
    loadingDiv.innerHTML = `
      <div style="font-weight: 600; color: #3B82F6; font-size: 12px; margin-bottom: 6px;">
        🔄 Loading Analysis...
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Please wait while we analyze the current board
      </div>
    `;
    recommendationsDisplay.appendChild(loadingDiv);
  }
}

function hideLoadingIndicator() {
  const loadingIndicator = document.querySelector('.loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

function isBoardChangeInProgress() {
  const now = Date.now();
  return analysisState.pendingBoardChange && 
         (now - analysisState.lastBoardChangeTime) < BOARD_CHANGE_DEBOUNCE_TIME;
}

function addRunIfNotExists(newRun) {
  const exists = performanceTracker.runs.some(r => 
    r.roomId === newRun.roomId && 
    r.ticks === newRun.ticks && 
    r.timestamp === newRun.timestamp &&
    r.source === newRun.source
  );
  if (!exists) {
    performanceTracker.runs.push(newRun);
    dataCollector.updatePatterns(newRun);
    return true;
  }
  return false;
}

const getRoomStoreName = (roomId) => `room_${roomId}`;



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
// 1.5. TILE HIGHLIGHTING SYSTEM
// =======================

// Highlight recommended tiles on empty board
function highlightRecommendedTiles(recommendedSetup) {
  if (!recommendedSetup || !Array.isArray(recommendedSetup) || recommendedSetup.length === 0) {
    return;
  }
  
  console.log('[Board Advisor] Highlighting recommended tiles:', recommendedSetup);
  
  // Check if this is the same setup as already highlighted
  // Only skip if we're highlighting the exact same full setup
  const isSameFullSetup = currentRecommendedSetup && 
    currentRecommendedSetup.length === recommendedSetup.length &&
    currentRecommendedSetup.every((rec, index) => 
      rec.tileIndex === recommendedSetup[index]?.tileIndex &&
      rec.monsterName === recommendedSetup[index]?.monsterName &&
      rec.equipmentName === recommendedSetup[index]?.equipmentName
    );
  
  if (isSameFullSetup) {
    console.log('[Board Advisor] Same full setup already highlighted, skipping cleanup');
    return;
  }
  
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
        background-color: rgba(255, 107, 53, 0.4);
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
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
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
        font-weight: 600;
        font-size: 13px;
        text-shadow: 0 0 4px rgba(76, 175, 80, 0.8);
      }
      
      .board-advisor-tile-info .equipment-name {
        color: #2196F3;
        font-size: 13px;
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
        font-size: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        text-align: center;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        pointer-events: none;
        z-index: 10;
        line-height: 1.1;
      `;
      tileText.innerHTML = `
        <div style="color: #4CAF50; font-weight: 600; font-size: 11px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.9), 1px -1px 2px rgba(0, 0, 0, 0.9), -1px 1px 2px rgba(0, 0, 0, 0.9); opacity: 0.95;">${monsterName}</div>
        <div style="color: #2196F3; font-size: 10px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.9), 1px -1px 2px rgba(0, 0, 0, 0.9), -1px 1px 2px rgba(0, 0, 0, 0.9); opacity: 0.95;">${equipmentName}</div>
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
    console.log('[Board Advisor] Not all recommended pieces placed yet, checking for new recommendations');
    
    // Check if pieces were removed (board has fewer pieces than before)
    const hasRemovedPieces = currentBoard.boardSetup.length < previousBoardPieceCount;
    console.log('[Board Advisor] Board piece count check:', {
      current: currentBoard.boardSetup.length,
      previous: previousBoardPieceCount,
      hasRemovedPieces: hasRemovedPieces
    });
    
    if (hasRemovedPieces) {
      console.log('[Board Advisor] Pieces removed, regenerating recommendations for available tiles');
      // Clear current recommendations and trigger new analysis
      cleanupTileHighlights();
      currentRecommendedSetup = null;
      placedRecommendedPieces.clear();
      
      // Clear any pending analysis request to allow new analysis
      pendingAnalysisRequest = null;
      lastAnalysisTime = 0; // Reset debounce timer
      
      // Trigger new analysis to generate updated recommendations
      if (dataCollector && typeof dataCollector.triggerAutomaticAnalysis === 'function') {
        setTimeout(() => {
          dataCollector.triggerAutomaticAnalysis();
        }, 100); // Small delay to ensure board state is stable
      }
      return;
    }
    
    // Re-highlight missing recommended pieces
    const missingPieces = currentRecommendedSetup.filter(rec => 
      !currentPieces.has(rec.tileIndex)
    );
    
    if (missingPieces.length > 0) {
      console.log('[Board Advisor] Re-highlighting missing pieces:', missingPieces);
      // Clean up existing highlights first
      cleanupTileHighlights();
      // Re-highlight only the missing pieces
      createTileHighlightOverlay(missingPieces);
    }
  }
  
  // Update the previous board piece count for next comparison
  previousBoardPieceCount = currentBoard.boardSetup.length;
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

function createPatternKey(boardSetup) {
  if (!boardSetup || !Array.isArray(boardSetup)) {
    return 'unknown';
  }
  
  // Sort pieces by tile for consistent comparison
  const sortedPieces = [...boardSetup].sort((a, b) => a.tile - b.tile);
  return JSON.stringify(sortedPieces);
}

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

function getMonsterName(monsterId) {
  try {
    if (!monsterId) return 'Unknown';
    
    console.log('[Board Advisor] getMonsterName called with:', monsterId);
    
    // Try to get from player context first
    const playerContext = globalThis.state?.player?.getSnapshot()?.context;
    console.log('[Board Advisor] Player context available:', !!playerContext);
    console.log('[Board Advisor] Player monsters available:', !!playerContext?.monsters);
    if (playerContext?.monsters) {
      console.log('[Board Advisor] Player monsters count:', playerContext.monsters.length);
      console.log('[Board Advisor] Sample monster data:', playerContext.monsters[0]);
      console.log('[Board Advisor] Looking for monster ID:', monsterId);
      
      // Try different ID fields
      const monster = playerContext.monsters.find(m => 
        m.id === monsterId || 
        m.id === `INITIAL_${monsterId}` ||
        m.monsterId === monsterId || 
        m.gameId === monsterId ||
        m.creatureId === monsterId
      );
      console.log('[Board Advisor] Found monster in player context:', !!monster);
      if (monster) {
        console.log('[Board Advisor] Monster data:', monster);
        console.log('[Board Advisor] Monster data keys:', Object.keys(monster));
        
        // Use the monster's gameId to get the proper name from utils
        console.log('[Board Advisor] Checking if monster has gameId:', monster.gameId);
        if (monster.gameId) {
          console.log('[Board Advisor] Using gameId to get monster name:', monster.gameId);
          try {
            const monsterData = globalThis.state.utils.getMonster(monster.gameId);
            console.log('[Board Advisor] Monster data from utils:', monsterData);
            const name = monsterData && monsterData.metadata ? monsterData.metadata.name : null;
            console.log('[Board Advisor] Resolved name for gameId', monster.gameId, ':', name);
            if (name) {
              console.log('[Board Advisor] Returning resolved name:', name);
              return name;
            }
          } catch (utilsError) {
            console.error('[Board Advisor] Error getting monster data for gameId', monster.gameId, ':', utilsError);
          }
        } else {
          console.log('[Board Advisor] Monster has no gameId, skipping utils lookup');
        }
        
        // Fallback to monster's own name property
        if (monster?.name) {
          console.log('[Board Advisor] Found monster name in player context:', monster.name);
          return monster.name;
        }
      }
      
      // Try searching by name if ID doesn't match
      const monsterByName = playerContext.monsters.find(m => 
        m.name && m.name.toLowerCase().includes('spearman')
      );
      if (monsterByName) {
        console.log('[Board Advisor] Found spearman monster by name search:', monsterByName);
      }
    }
    
    // Try to get from game state utils using getMonster
    if (globalThis.state?.utils?.getMonster) {
      try {
        const monsterData = globalThis.state.utils.getMonster(monsterId);
        if (monsterData?.metadata?.name) {
          console.log('[Board Advisor] Found monster name in getMonster:', monsterData.metadata.name);
          return monsterData.metadata.name;
        }
      } catch (e) {
        console.log('[Board Advisor] getMonster failed, trying numeric ID');
        // getMonster might not work with string IDs, try as number
        const numericId = parseInt(monsterId);
        if (!isNaN(numericId)) {
          const monsterData = globalThis.state.utils.getMonster(numericId);
          if (monsterData?.metadata?.name) {
            console.log('[Board Advisor] Found monster name in getMonster (numeric):', monsterData.metadata.name);
            return monsterData.metadata.name;
          }
        }
      }
    }
    
    // Try to get from monster names mapping
    console.log('[Board Advisor] Checking MONSTER_NAMES mapping...');
    if (globalThis.state?.utils?.MONSTER_NAMES && globalThis.state.utils.MONSTER_NAMES[monsterId]) {
      console.log('[Board Advisor] Found monster name in MONSTER_NAMES:', globalThis.state.utils.MONSTER_NAMES[monsterId]);
      return globalThis.state.utils.MONSTER_NAMES[monsterId];
    }
    
    // Try to get from monster game IDs to names mapping
    console.log('[Board Advisor] Checking monsterGameIdsToNames mapping...');
    if (globalThis.state?.utils?.monsterGameIdsToNames && globalThis.state.utils.monsterGameIdsToNames.has(monsterId)) {
      const name = globalThis.state.utils.monsterGameIdsToNames.get(monsterId);
      console.log('[Board Advisor] Found monster name in monsterGameIdsToNames:', name);
      return name;
    }
    
    // Fallback to ID if no name found
    console.log('[Board Advisor] No monster name found, falling back to ID:', monsterId);
    return monsterId;
  } catch (error) {
    console.warn('[Board Advisor] Error looking up monster name:', error);
    return monsterId || 'Unknown';
  }
}


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


// Make lookup functions available globally for button onclick handlers
window.getMonsterName = getMonsterName;
window.getEquipmentName = getEquipmentName;
window.loadRecommendedSetup = loadRecommendedSetup;
window.getMonsterStats = getMonsterStats;
window.formatMonsterStats = formatMonsterStats;
window.getEquipmentStats = getEquipmentStats;

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
addDocumentListener('utility-api-ready', () => {
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
    console.log('[Board Advisor] addBoardAnalyzerRun called with:', runData);
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
      boardSetup: runData.boardSetup ? runData.boardSetup.map(piece => {
        console.log('[Board Advisor] Processing piece for storage:', piece);
        const resolvedName = piece.monsterName || (piece.monsterId ? getMonsterName(piece.monsterId) : null);
        console.log('[Board Advisor] Resolved name for storage:', resolvedName);
        return {
          ...piece,
          monsterName: resolvedName
        };
      }) : [],
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
    const boardSubscription = globalThis.state.board.subscribe(({ context }) => {
      // Always trigger board change detection, not just when boardConfig has length > 0
      // This ensures we detect when auto-setup places/removes creatures
      this.onBoardChange(context);
    });
    activeSubscriptions.push(boardSubscription);

    // Listen for server results like RunTracker does
    this.setupServerResultsListener();
  }

  setupServerResultsListener() {
    try {
      // Listen for Board Analyzer results (primary method for sandbox mode)
      this.setupBoardAnalyzerListener();
      
      // Listen for game board subscription (fallback for non-sandbox mode)
      if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
        const fallbackSubscription = globalThis.state.board.subscribe(({ context }) => {
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
        activeSubscriptions.push(fallbackSubscription);
        console.log('[Board Advisor] Server results listener set up');
      }
    } catch (error) {
      console.error('[Board Advisor] Error setting up server results listener:', error);
    }
  }

  setupBoardAnalyzerListener() {
    try {
      // Store board state when runs start
      let capturedBoardState = null;
      
      // Listen for game start to capture board state
      console.log('[Board Advisor] Setting up onGameStart listener');
      const originalGameStart = window.onGameStart;
      window.onGameStart = (...args) => {
        console.log('[Board Advisor] onGameStart called!');
        // Capture board state at the start of the run
        capturedBoardState = this.getCurrentBoardData();
        console.log('[Board Advisor] Captured board state at run start:', capturedBoardState);
        
        // Call original function if it exists
        if (originalGameStart) {
          originalGameStart.apply(window, args);
        }
      };
      
      // Poll for Board Analyzer results (since Board Analyzer stores them globally)
      const checkForBoardAnalyzerResults = () => {
        if (window.__boardAnalyzerResults && window.__boardAnalyzerResults.results) {
          console.log('[Board Advisor] Found Board Analyzer results:', window.__boardAnalyzerResults);
          
          // Use captured board state instead of current board state
          const boardStateToUse = capturedBoardState || this.getCurrentBoardData();
          
          // Process each result
          window.__boardAnalyzerResults.results.forEach((result, index) => {
            console.log(`[Board Advisor] Processing Board Analyzer result ${index + 1}:`, result);
            
            // Convert Board Analyzer result to Board Advisor format
            const runData = {
              id: Date.now() + index,
              timestamp: Date.now(),
              seed: result.seed,
              roomId: result.roomId || boardStateToUse?.roomId || 'unknown',
              mapName: result.mapName || boardStateToUse?.mapName || 'Unknown Map',
              completed: result.completed,
              winner: result.completed ? 'nonVillains' : 'villains',
              ticks: result.ticks,
              rankPoints: result.rankPoints,
              boardSetup: result.boardSetup || (boardStateToUse?.boardSetup ? boardStateToUse.boardSetup.map(piece => ({
                ...piece,
                monsterName: piece.monsterName || (piece.monsterId ? getMonsterName(piece.monsterId) : null)
              })) : []),
              playerMonsters: result.playerMonsters || boardStateToUse?.playerMonsters || [],
              playerEquipment: result.playerEquipment || boardStateToUse?.playerEquipment || [],
              source: 'board_analyzer'
            };
            
            // Save to IndexedDB
            console.log(`[Board Advisor] About to call addBoardAnalyzerRun for run ${index + 1} with data:`, runData);
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
          
          // Clear captured board state after processing
          capturedBoardState = null;
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
        // Ensure monster names are preserved in board setup
        runData.boardSetup = currentBoard.boardSetup.map(piece => ({
          ...piece,
          monsterName: piece.monsterName || (piece.monsterId ? getMonsterName(piece.monsterId) : null)
        }));
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
      const now = Date.now();
      
      // Get fresh room ID from context first
      const newRoomId = this.extractRoomIdFromContext(boardContext);
      
      // Get current board data
      const currentBoard = this.getCurrentBoardData();
      
      console.log('[Board Advisor] Board change detected:', {
        previousRoomId: previousRoomId,
        currentRoomId: currentBoard?.roomId,
        currentMapName: currentBoard?.mapName,
        newRoomId: newRoomId,
        boardSetupLength: currentBoard?.boardSetup?.length || 0,
        boardConfigLength: boardContext?.boardConfig?.length || 0,
        boardContext: boardContext
      });
      
      // Check if this is just a run start (same room, same board setup) vs actual map/board change
      const isRunStart = previousRoomId === newRoomId && 
                        currentBoard?.boardSetup && 
                        currentBoard.boardSetup.length > 0;
      
      // Check if this is an auto-setup change (same room, but board setup changed)
      const isAutoSetupChange = previousRoomId === newRoomId && 
                               currentBoard?.boardSetup && 
                               currentBoard.boardSetup.length > 0 &&
                               boardContext?.boardConfig && 
                               boardContext.boardConfig.length > 0;
      
      if (!isRunStart && !isAutoSetupChange) {
        // Only clear highlights on actual map/board changes, not run starts or auto-setup
        console.log(`[Board Advisor] Board/map change detected, clearing highlights immediately`);
        clearRecommendationsInstantly();
      } else if (isAutoSetupChange) {
        console.log(`[Board Advisor] Auto-setup change detected, updating analysis`);
      } else {
        console.log(`[Board Advisor] Run start detected (same room/board), keeping UI stable`);
      }
      
      // Only trigger analysis for actual map changes, not run starts
      if (previousRoomId && newRoomId && previousRoomId !== newRoomId) {
        console.log(`[Board Advisor] Map change detected: ${previousRoomId} -> ${newRoomId}`);
        
        // Clear any existing timeout
        if (this.boardChangeTimeout) {
          clearTimeout(this.boardChangeTimeout);
        }
        
        // Start analysis immediately for map changes (no debounce)
        this.triggerAutomaticAnalysis();
        this.refreshDataForCurrentMap();
      } else if (!isRunStart || isAutoSetupChange) {
        // For same-room board changes (not run starts) or auto-setup changes, use debounce to avoid excessive analysis
        if (this.boardChangeTimeout) {
          clearTimeout(this.boardChangeTimeout);
        }
        
        // Immediately check if highlighted tiles should be removed when pieces are placed
        smartCleanupTileHighlights();
        
        this.boardChangeTimeout = setTimeout(() => {
          this.triggerAutomaticAnalysis();
          this.refreshDataForCurrentMap();
        }, isAutoSetupChange ? 500 : BOARD_CHANGE_DEBOUNCE_TIME); // Faster response for auto-setup
      }
      // For run starts (same room, same board), do nothing - keep UI stable
      
      // Update previous room ID for next comparison
      previousRoomId = newRoomId;
    } catch (error) {
      console.error('[Board Advisor] Error in onBoardChange:', error);
      setUILoadingState(false, 'Error in board change handler');
    }
  }
  
  refreshDataForCurrentMap() {
    try {
      const currentBoard = this.getCurrentBoardData();
      if (!currentBoard) {
        setUILoadingState(false, 'No current board data');
        return;
      }
      
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
        
        // Clear pending board change first, then loading state
        analysisState.pendingBoardChange = null;
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }
        setUILoadingState(false, 'Data loading completed');
        
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
        // Clear loading state on error
        setUILoadingState(false, 'Error loading data');
        analysisState.pendingBoardChange = null;
        // Show error state in panel
        updatePanelStatus('Error loading data. Please try again.', 'error');
      });
    } catch (error) {
      console.error('[Board Advisor] Error refreshing data for current map:', error);
      setUILoadingState(false, 'Error in refreshDataForCurrentMap');
      analysisState.pendingBoardChange = null;
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
    
    // Filter for player pieces - be more flexible with the type check
    const playerPieces = boardConfig.filter(piece => {
      // Accept pieces with type 'player' or pieces without a type (assuming they're player pieces)
      const isPlayerPiece = piece.type === 'player' || !piece.type || piece.type === 'custom';
      console.log('[Board Advisor] Piece type check:', {
        type: piece.type,
        isPlayerPiece: isPlayerPiece,
        hasMonsterId: !!(piece.databaseId || piece.monsterId || piece.gameId),
        hasEquipId: !!piece.equipId
      });
      return isPlayerPiece;
    });
    
    
    return playerPieces.map(piece => {
      
      // Check if the piece has monster data directly
      if (piece.monster) {
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
      if (monsterId && typeof monsterId === 'string' && monsterId.startsWith('INITIAL_')) {
        originalMonsterId = monsterId; // Keep the full ID with prefix for lookup
        monsterId = monsterId.substring(8); // Remove 'INITIAL_' (8 characters) for display
      }
      
      
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
    // Ensure monster names are preserved in board setup
    if (runData.boardSetup) {
      runData.boardSetup = runData.boardSetup.map(piece => ({
        ...piece,
        monsterName: piece.monsterName || (piece.monsterId ? getMonsterName(piece.monsterId) : null)
      }));
    }
    
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
    } else {
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
      
      return {
        boardSetup: this.serializeBoardSetup(boardContext.boardConfig),
        playerMonsters: playerContext.monsters,
        playerEquipment: playerContext.equips,
        roomId: roomId,
        mapName: mapName,
        gameStarted: boardContext.gameStarted,
        detectionMethod: detectionMethod
      };
    } catch (error) {
      console.error('[Board Advisor] Error getting current board data:', error);
      return null;
    }
  }

  extractRoomIdFromContext(boardContext) {
    try {
      const playerContext = globalThis.state.player.getSnapshot().context;
      
      // Use same room ID detection logic as getCurrentBoardData
      if (boardContext.selectedMap?.selectedRoom?.id) {
        return boardContext.selectedMap.selectedRoom.id;
      } else if (boardContext.selectedMap?.id) {
        return boardContext.selectedMap.id;
      } else if (boardContext.area?.id) {
        return boardContext.area.id;
      } else if (playerContext.currentRoomId) {
        return playerContext.currentRoomId;
      }
      
      return null;
    } catch (error) {
      console.error('[Board Advisor] Error extracting room ID from context:', error);
      return null;
    }
  }

  // Force refresh room detection by clearing any cached data
  forceRefreshRoomDetection() {
    console.log('[Board Advisor] Forcing room detection refresh...');
    
    // Clear performance cache
    performanceCache.lastRoomDetection = null;
    performanceCache.lastRoomDetectionTime = 0;
    
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
    console.log('[Board Advisor] Pattern matching cache cleared due to board changes...');
    // Cache removed - no action needed
  }
}

// CACHE FIX: Invalidate caches and refresh data after sandbox run saves
async function invalidateCachesAndRefreshData(roomId) {
  try {
    console.log(`[Board Advisor] Invalidating caches for room ${roomId} after sandbox run save...`);
    
    // 1. Clear all performance caches
    dataCollector.forceRefreshRoomDetection();
    
    // 2. Clear data loading cache specifically for this room
    // Cache removed - no action needed
    
    // 3. Clear pattern matching cache for current setup
    // Cache removed - no action needed
    
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
    console.log('[Board Advisor] getRoomLeaderboard called for roomId:', roomId);
    console.log('[Board Advisor] leaderboardData structure:', leaderboardData ? Object.keys(leaderboardData) : 'null');
    if (!leaderboardData || !leaderboardData.roomsHighscores) {
      console.log('[Board Advisor] Missing leaderboardData or roomsHighscores');
      return null;
    }

    const roomName = leaderboardData.ROOM_NAME?.[roomId];
    console.log('[Board Advisor] Room name for', roomId, ':', roomName);
    if (!roomName) return null;

    // Handle the correct data structure from game.getRoomsHighscores
    // It returns {ticks: {roomId: data}, rank: {roomId: data}}
    console.log('[Board Advisor] roomsHighscores structure:', leaderboardData.roomsHighscores);
    console.log('[Board Advisor] Looking for roomId', roomId, 'in ticks:', leaderboardData.roomsHighscores.ticks);
    console.log('[Board Advisor] Looking for roomId', roomId, 'in rank:', leaderboardData.roomsHighscores.rank);
    
    const tickData = leaderboardData.roomsHighscores.ticks?.[roomId];
    const rankData = leaderboardData.roomsHighscores.rank?.[roomId];
    
    console.log('[Board Advisor] Found tickData:', tickData ? 'yes' : 'no');
    console.log('[Board Advisor] Found rankData:', rankData ? 'yes' : 'no');

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
    console.log('[Board Advisor] compareWithLeaderboard called with:', { currentRun, leaderboardData: leaderboardData ? 'present' : 'null' });
    if (!currentRun || !leaderboardData) {
      console.log('[Board Advisor] Missing currentRun or leaderboardData');
      return null;
    }

    const roomLeaderboard = this.getRoomLeaderboard(leaderboardData, currentRun.roomId);
    console.log('[Board Advisor] Room leaderboard for', currentRun.roomId, ':', roomLeaderboard ? 'found' : 'not found');
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
        yourBestTime: null, // Add user's best time from leaderboard
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

      // Find user's best time from leaderboard data
      const userRuns = comparison.leaderboard.speedrun.filter(r => r.userName === globalThis.state?.user?.name);
      if (userRuns.length > 0) {
        comparison.analysis.yourBestTime = Math.min(...userRuns.map(r => r.ticks));
      }

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

    try {
      const currentBoard = this.dataCollector.getCurrentBoardData();
      
      // Initialize previous board piece count if not set
      if (previousBoardPieceCount === 0 && currentBoard && currentBoard.boardSetup) {
        previousBoardPieceCount = currentBoard.boardSetup.length;
      }
      
      if (!currentBoard || !currentBoard.boardSetup.length) {
        // Board is empty - recommend best run from available data
        console.log('[Board Advisor] Board is empty, recommending best run from available data');
        return this.createEmptyBoardRecommendation(currentBoard);
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

      // Get leaderboard data using existing functions
      let leaderboardComparison = null;
      try {
        console.log('[Board Advisor] Getting leaderboard data using existing functions...');
        const userScores = getUserBestScores();
        if (userScores && userScores.bestTicks) {
          console.log('[Board Advisor] Found user best time:', userScores.bestTicks);
          
          // Create simple leaderboard comparison with user's best time
          leaderboardComparison = {
            roomId: roomId,
            roomName: globalThis.state?.utils?.ROOM_NAME?.[roomId] || 'Unknown',
            analysis: {
              yourBestTime: userScores.bestTicks
            }
          };
          console.log('[Board Advisor] Created leaderboard comparison:', leaderboardComparison);
        } else {
          console.log('[Board Advisor] No user best time found');
        }
      } catch (error) {
        console.warn('[Board Advisor] Could not get user best scores:', error);
      }

      // Find similar setups
      const similarSetups = this.findSimilarSetups(currentBoard.boardSetup, roomPatterns);
      
      // Analyze current setup
      const currentAnalysis = this.analyzeSetup(currentBoard.boardSetup, roomPatterns);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(
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

  async createEmptyBoardRecommendation(currentBoard = null) {
    console.log('[Board Advisor] Creating empty board recommendation');
    
    try {
      // Get best runs from all available data sources
      const bestRuns = await this.getBestRunsFromAllSources();
      
      // Use current board room info
      const roomId = currentBoard?.roomId;
      const roomName = currentBoard?.mapName;
      
      if (bestRuns.length === 0) {
        return {
          roomId: roomId,
          roomName: roomName,
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
      
      // Use current board room name if available, otherwise use best run room name
      const displayRoomName = currentBoard?.mapName || globalThis.state?.utils?.ROOM_NAME?.[bestRun.roomId] || bestRun.roomId;
      
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
        roomId: roomId,
        roomName: displayRoomName,
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
          totalRuns: Math.min(50, bestRuns.length),
          averageTime: Math.round(bestRuns.slice(0, 50).reduce((sum, run) => sum + (run.ticks || 0), 0) / Math.min(50, bestRuns.length)),
          successRate: '100%',
          bestTime: bestRun.ticks,
          worstTime: bestRuns[Math.min(49, bestRuns.length - 1)]?.ticks || 'N/A',
          bestPoints: Math.max(...bestRuns.map(r => r.rankPoints || 0)),
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
    const creatureCountMatches = [];
    
    // Create cache key for current setup
    const setupKey = this.createSetupKey(currentSetup);
    
    // Cache removed - always calculate fresh results
    
    console.log(`[Board Advisor] Finding similar setups for current setup:`, currentSetup);
    console.log(`[Board Advisor] Available patterns:`, roomPatterns.size);
    
    const currentCreatureCount = currentSetup.length;
    console.log(`[Board Advisor] Current setup has ${currentCreatureCount} creatures`);
    
    // Pre-filter patterns by monster/equipment combinations for better performance
    const currentMonsters = new Set(currentSetup.map(p => p.monsterName || p.monsterId));
    const currentEquipment = new Set(currentSetup.map(p => p.equipmentName || p.equipId));
    const relevantPatterns = new Map();
    const creatureCountPatterns = new Map();
    
    for (const [hash, pattern] of roomPatterns) {
      const patternMonsters = new Set(pattern.setup.map(p => p.monsterName || p.monsterId));
      const patternEquipment = new Set(pattern.setup.map(p => p.equipmentName || p.equipId));
      const patternCreatureCount = pattern.setup.length;
      
      // Group by creature count for cross-map learning
      if (!creatureCountPatterns.has(patternCreatureCount)) {
        creatureCountPatterns.set(patternCreatureCount, []);
      }
      creatureCountPatterns.get(patternCreatureCount).push({ hash, pattern });
      
      // Consider patterns that share at least one monster OR equipment combination
      if (this.setsIntersect(currentMonsters, patternMonsters) || 
          this.setsIntersect(currentEquipment, patternEquipment)) {
        relevantPatterns.set(hash, pattern);
      }
    }
    
    console.log(`[Board Advisor] Filtered to ${relevantPatterns.size} relevant patterns (from ${roomPatterns.size} total) based on monster/equipment combinations`);
    console.log(`[Board Advisor] Found patterns for creature counts:`, Array.from(creatureCountPatterns.keys()).sort());
    
    // First, find exact and similar matches from same room
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
    
    // Then, find patterns from other maps with same creature count for cross-map learning
    const sameCreatureCountPatterns = creatureCountPatterns.get(currentCreatureCount) || [];
    for (const { hash, pattern } of sameCreatureCountPatterns) {
      // Skip if already processed in relevantPatterns
      if (relevantPatterns.has(hash)) continue;
      
      const similarity = this.calculateSimilarity(currentSetup, pattern.setup);
      
      if (similarity > 0.05) { // Lower threshold for cross-map learning
        const setupData = {
          pattern,
          similarity,
          hash,
          isExactMatch: false,
          isCrossMap: true,
          creatureCount: currentCreatureCount
        };
        
        creatureCountMatches.push(setupData);
      }
    }
    
    // Prioritize exact matches first, then similar setups, then cross-map creature count matches
    const result = [
      ...exactMatches.sort((a, b) => b.similarity - a.similarity), 
      ...similar.sort((a, b) => b.similarity - a.similarity),
      ...creatureCountMatches.sort((a, b) => b.similarity - a.similarity)
    ];
    
    console.log(`[Board Advisor] Found ${exactMatches.length} exact matches, ${similar.length} similar setups, ${creatureCountMatches.length} cross-map creature count matches`);
    
    // Cache removed - no caching needed
    
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
    // Always return room-wide historical data, ignoring current board setup
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
      
      // Sort by ticks (best first) and limit to top 50 runs
      const sortedRuns = completedRuns.sort((a, b) => a.ticks - b.ticks);
      const top50Runs = sortedRuns.slice(0, 50);
      
      const averageTime = top50Runs.length > 0 ? 
        top50Runs.reduce((sum, r) => sum + r.ticks, 0) / top50Runs.length : 0;
      const successRate = completedRuns.length / allRuns.length;
      
      return {
        hasHistoricalData: true,
        bestTime: bestTime === Infinity ? null : bestTime,
        averageTime: averageTime,
        successRate: successRate,
        totalRuns: Math.min(50, totalRuns)
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

  async generateRecommendations(currentBoard, similarSetups, currentAnalysis, leaderboardComparison = null) {
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
    const boardAnalyzerTips = await this.generateBoardAnalyzerRecommendations(currentBoard, similarSetups, currentAnalysis, leaderboardComparison);
    recommendations.push(...boardAnalyzerTips);

    // Add map-based learning insights
    const mapLearningTips = this.generateMapLearningInsights(currentBoard, similarSetups);
    recommendations.push(...mapLearningTips);

    // Add tile highlighting for positioning recommendations (if enabled)
    if (config.enableTileRecommendations) {
      const tileRecommendations = recommendations.filter(r => r.type === 'positioning' && r.tile);
      if (tileRecommendations.length > 0) {
        highlightRecommendedTiles(tileRecommendations);
      }
    }

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
      
      // Get performance data for tile recommendations
      const tilePerformance = this.analyzeTilePerformance(successfulSetups);
      
      // Find optimal tiles that aren't currently used
      const optimalTiles = this.findOptimalTiles(tileUsage, tilePerformance, currentTileUsage);
      
      for (const tileData of optimalTiles) {
        tips.push({
          type: 'positioning',
          title: `Optimal Tile: ${tileData.tile}`,
          message: `${Math.round(tileData.frequency * 100)}% of successful setups use this tile (avg: ${tileData.avgTime} ticks)`,
          suggestion: `Try placing a monster on tile ${tileData.tile} - it's frequently used in faster runs`,
          priority: tileData.priority,
          tileIndex: tileData.tile,
          avgTime: tileData.avgTime,
          frequency: tileData.frequency,
          isOptimal: true
        });
      }
      
      // Also suggest avoiding poorly performing tiles
      const poorTiles = this.findPoorTiles(tileUsage, tilePerformance, currentTileUsage);
      for (const tileData of poorTiles) {
        tips.push({
          type: 'positioning',
          title: `Avoid Tile: ${tileData.tile}`,
          message: `This tile appears in slower runs (avg: ${tileData.avgTime} ticks)`,
          suggestion: `Consider moving monsters away from tile ${tileData.tile} for better performance`,
          priority: 'low',
          tileIndex: tileData.tile,
          avgTime: tileData.avgTime,
          isAvoid: true
        });
      }
    }

    return tips;
  }

  analyzeTilePerformance(setups) {
    const tilePerformance = new Map();
    
    for (const setup of setups) {
      for (const piece of setup) {
        const tile = piece.tileIndex;
        if (!tile) continue;
        
        if (!tilePerformance.has(tile)) {
          tilePerformance.set(tile, {
            tile: tile,
            times: [],
            avgTime: 0,
            count: 0
          });
        }
        
        // Get performance data for this setup
        const performance = this.getSetupPerformance(setup);
        if (performance) {
          tilePerformance.get(tile).times.push(performance);
          tilePerformance.get(tile).count++;
        }
      }
    }
    
    // Calculate average times for each tile
    for (const [tile, data] of tilePerformance) {
      if (data.times.length > 0) {
        data.avgTime = Math.round(data.times.reduce((sum, time) => sum + time, 0) / data.times.length);
      }
    }
    
    return tilePerformance;
  }

  getSetupPerformance(setup) {
    // Try to find performance data for this setup
    const setupHash = this.createSetupKey(setup);
    
    // Look in performance tracker
    for (const run of performanceTracker.runs) {
      if (run.boardSetup && this.createSetupKey(run.boardSetup) === setupHash) {
        return run.ticks || run.rankPoints || null;
      }
    }
    
    return null;
  }

  findOptimalTiles(tileUsage, tilePerformance, currentTileUsage) {
    const optimalTiles = [];
    
    for (const [tile, usage] of tileUsage) {
      // Skip if tile is already used
      if (currentTileUsage.has(tile)) continue;
      
      const performance = tilePerformance.get(tile);
      if (!performance || performance.avgTime === 0) continue;
      
      // Calculate priority based on frequency and performance
      let priority = 'medium';
      if (usage.frequency > 0.8 && performance.avgTime < 100) priority = 'high';
      else if (usage.frequency > 0.6 && performance.avgTime < 120) priority = 'medium';
      else if (usage.frequency > 0.4) priority = 'low';
      else continue;
      
      optimalTiles.push({
        tile: tile,
        frequency: usage.frequency,
        avgTime: performance.avgTime,
        priority: priority
      });
    }
    
    // Sort by priority and performance
    return optimalTiles.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.avgTime - b.avgTime; // Lower time is better
    });
  }

  findPoorTiles(tileUsage, tilePerformance, currentTileUsage) {
    const poorTiles = [];
    
    for (const [tile, usage] of tileUsage) {
      // Only consider tiles that are currently used
      if (!currentTileUsage.has(tile)) continue;
      
      const performance = tilePerformance.get(tile);
      if (!performance || performance.avgTime === 0) continue;
      
      // Consider it poor if it has low frequency and high average time
      if (usage.frequency < 0.3 && performance.avgTime > 150) {
        poorTiles.push({
          tile: tile,
          frequency: usage.frequency,
          avgTime: performance.avgTime
        });
      }
    }
    
    return poorTiles.sort((a, b) => b.avgTime - a.avgTime); // Higher time is worse
  }


  findTileElement(tileIndex) {
    // Try to find the tile element in the game board
    // This might need to be adjusted based on the actual game's DOM structure
    const selectors = [
      `[data-tile-index="${tileIndex}"]`,
      `[data-tile="${tileIndex}"]`,
      `.tile-${tileIndex}`,
      `#tile-${tileIndex}`
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    
    // Fallback: try to find by position if tile index corresponds to grid position
    const gameBoard = document.querySelector('.game-board, .board, [class*="board"]');
    if (gameBoard) {
      const tiles = gameBoard.querySelectorAll('[class*="tile"], [data-tile], [class*="cell"]');
      if (tiles[tileIndex]) {
        return tiles[tileIndex];
      }
    }
    
    return null;
  }

  clearTileHighlights() {
    const existingHighlights = document.querySelectorAll(`[id^="${TILE_HIGHLIGHT_OVERLAY_ID}"]`);
    existingHighlights.forEach(highlight => {
      if (highlight.parentNode) {
        highlight.parentNode.removeChild(highlight);
      }
    });
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
    
    // Add creature-equipment pairing recommendations
    const creatureEquipmentTips = this.generateCreatureEquipmentRecommendations(currentBoard, similarSetups);
    tips.push(...creatureEquipmentTips);
    
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
    const currentCreatureCount = currentBoard.boardSetup.length;
    
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
    
    // Add cross-map creature recommendations based on creature count
    const crossMapTips = this.generateCrossMapCreatureRecommendations(currentBoard, similarSetups);
    tips.push(...crossMapTips);
    
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

  generateCreatureEquipmentRecommendations(currentBoard, similarSetups) {
    const tips = [];
    const currentSetup = currentBoard.boardSetup;
    
    // Analyze creature-equipment patterns from similar setups
    const successfulSetups = similarSetups
      .filter(s => s.pattern.successRate > 0.6)
      .map(s => s.pattern.setup);
    
    if (successfulSetups.length === 0) return tips;
    
    // Analyze creature-equipment pairings
    const creatureEquipmentPairs = this.analyzeCreatureEquipmentPairs(successfulSetups);
    
    // Check current setup for missing optimal equipment
    for (const piece of currentSetup) {
      const creatureName = piece.monsterName || piece.monsterId;
      const currentEquipment = piece.equipmentName || piece.equipId;
      
      // Find optimal equipment for this creature
      const optimalEquipment = creatureEquipmentPairs.get(creatureName);
      
      if (optimalEquipment && optimalEquipment.frequency > 0.5) {
        const bestEquipment = optimalEquipment.equipment[0]; // Most frequent equipment
        
        if (bestEquipment.equipId !== currentEquipment) {
          const equipmentName = getEquipmentName(bestEquipment.equipId);
          const currentEquipmentName = getEquipmentName(currentEquipment);
          
          const strength = this.getPatternStrength(bestEquipment.frequency, bestEquipment.count);
          
          tips.push({
            type: 'equipment',
            title: `Optimal Equipment for ${creatureName}`,
            message: `${Math.round(bestEquipment.frequency * 100)}% of successful setups use ${equipmentName} with ${creatureName} (${strength})`,
            suggestion: `Consider changing ${currentEquipmentName} to ${equipmentName} for better performance`,
            priority: 'high',
            creatureName: creatureName,
            currentEquipment: currentEquipment,
            recommendedEquipment: bestEquipment.equipId,
            equipmentName: equipmentName,
            currentEquipmentName: currentEquipmentName,
            strength: strength
          });
        }
      }
    }
    
    // Suggest equipment combinations that work well together
    const equipmentCombinations = this.analyzeEquipmentCombinations(successfulSetups);
    
    for (const combination of equipmentCombinations) {
      if (combination.frequency > 0.4) {
        const currentEquipment = new Set(currentSetup.map(p => p.equipmentName || p.equipId));
        const missingEquipment = combination.equipment.filter(eq => !currentEquipment.has(eq.equipId));
        
        if (missingEquipment.length > 0 && missingEquipment.length < combination.equipment.length) {
          const equipmentNames = missingEquipment.map(eq => getEquipmentName(eq.equipId)).join(', ');
          
          tips.push({
            type: 'equipment',
            title: 'Effective Equipment Combination',
            message: `${Math.round(combination.frequency * 100)}% of successful setups use this equipment combination`,
            suggestion: `Consider adding ${equipmentNames} to complete this effective equipment combination`,
            priority: 'medium',
            combination: combination.equipment
          });
        }
      }
    }
    
    return tips;
  }

  analyzeCreatureEquipmentPairs(setups) {
    const pairs = new Map();
    
    for (const setup of setups) {
      for (const piece of setup) {
        const creatureName = piece.monsterName || piece.monsterId;
        const equipmentId = piece.equipId;
        const equipmentName = piece.equipmentName;
        
        if (!creatureName || !equipmentId) continue;
        
        if (!pairs.has(creatureName)) {
          pairs.set(creatureName, {
            creatureName: creatureName,
            equipment: new Map(),
            totalCount: 0
          });
        }
        
        const creatureData = pairs.get(creatureName);
        creatureData.totalCount++;
        
        if (!creatureData.equipment.has(equipmentId)) {
          creatureData.equipment.set(equipmentId, {
            equipId: equipmentId,
            equipmentName: equipmentName,
            count: 0,
            frequency: 0
          });
        }
        
        creatureData.equipment.get(equipmentId).count++;
      }
    }
    
    // Calculate frequencies for each creature's equipment
    for (const [creatureName, creatureData] of pairs) {
      for (const [equipId, equipmentData] of creatureData.equipment) {
        equipmentData.frequency = equipmentData.count / creatureData.totalCount;
      }
      
      // Sort equipment by frequency
      creatureData.equipment = new Map(
        Array.from(creatureData.equipment.entries())
          .sort((a, b) => b[1].frequency - a[1].frequency)
      );
    }
    
    return pairs;
  }

  analyzeEquipmentCombinations(setups) {
    const combinations = new Map();
    
    for (const setup of setups) {
      const equipment = setup
        .map(p => ({
          equipId: p.equipId,
          equipmentName: p.equipmentName || p.equipId,
          stat: p.stat,
          tier: p.tier
        }))
        .filter(eq => eq.equipId)
        .sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));
      
      if (equipment.length < 2) continue;
      
      const key = equipment.map(eq => eq.equipId).join('+');
      
      if (!combinations.has(key)) {
        combinations.set(key, {
          equipment: equipment,
          count: 0,
          frequency: 0
        });
      }
      
      combinations.get(key).count++;
    }
    
    // Calculate frequencies
    const totalSetups = setups.length;
    for (const [key, combination] of combinations) {
      combination.frequency = combination.count / totalSetups;
    }
    
    return Array.from(combinations.values()).sort((a, b) => b.frequency - a.frequency);
  }

  getPatternStrength(frequency, count) {
    if (frequency >= 0.8 && count >= 10) return 'Very Strong';
    if (frequency >= 0.7 && count >= 8) return 'Strong';
    if (frequency >= 0.6 && count >= 5) return 'Moderate';
    if (frequency >= 0.4 && count >= 3) return 'Weak';
    return 'Very Weak';
  }

  generateCrossMapCreatureRecommendations(currentBoard, similarSetups) {
    const tips = [];
    const currentCreatureCount = currentBoard.boardSetup.length;
    
    // Find cross-map setups with same creature count
    const crossMapSetups = similarSetups.filter(s => s.isCrossMap && s.creatureCount === currentCreatureCount);
    
    if (crossMapSetups.length === 0) return tips;
    
    console.log(`[Board Advisor] Found ${crossMapSetups.length} cross-map setups with ${currentCreatureCount} creatures`);
    
    // Analyze creatures from cross-map successful setups
    const successfulCrossMapSetups = crossMapSetups
      .filter(s => s.pattern.successRate > 0.6)
      .map(s => s.pattern.setup);
    
    if (successfulCrossMapSetups.length === 0) return tips;
    
    // Get current creatures
    const currentCreatures = new Set(currentBoard.boardSetup.map(p => p.monsterName || p.monsterId));
    
    // Analyze creature patterns from cross-map setups
    const crossMapCreaturePatterns = this.analyzeCreaturePatterns(successfulCrossMapSetups);
    
    // Find creatures that work well in similar creature count maps but aren't in current setup
    for (const [monsterId, pattern] of crossMapCreaturePatterns) {
      const creatureName = pattern.monsterName || monsterId;
      
      // Skip if creature is already in current setup
      if (currentCreatures.has(creatureName) || currentCreatures.has(monsterId)) continue;
      
      // Only recommend if it appears frequently in successful cross-map setups
      if (pattern.frequency > 0.4) {
        const avgPerformance = this.calculateAveragePerformance(crossMapSetups, pattern);
        
        tips.push({
          type: 'creature',
          title: `Cross-Map Learning: ${creatureName}`,
          message: `${Math.round(pattern.frequency * 100)}% of successful ${currentCreatureCount}-creature maps use this creature`,
          suggestion: `Based on data from other ${currentCreatureCount}-creature maps, ${creatureName} performs well in similar setups`,
          priority: 'medium',
          monsterId: monsterId,
          monsterName: creatureName,
          tier: pattern.tier,
          isCrossMap: true,
          avgPerformance: avgPerformance
        });
      }
    }
    
    // Also suggest creature combinations that work well together
    const combinationAnalysis = this.analyzeCreatureCombinations(successfulCrossMapSetups, currentCreatureCount);
    
    // Suggest creature pairs that work well together
    for (const pair of combinationAnalysis.creaturePairs) {
      if (pair.frequency > 0.4) { // High frequency threshold for pairs
        const creature1InCurrent = currentCreatures.has(pair.creature1.monsterName) || currentCreatures.has(pair.creature1.monsterId);
        const creature2InCurrent = currentCreatures.has(pair.creature2.monsterName) || currentCreatures.has(pair.creature2.monsterId);
        
        // If only one creature from the pair is in current setup
        if (creature1InCurrent !== creature2InCurrent) {
          const missingCreature = creature1InCurrent ? pair.creature2 : pair.creature1;
          
          const strength = this.getPatternStrength(pair.frequency, pair.count);
          
          tips.push({
            type: 'creature',
            title: `Strong Creature Pair: ${pair.creature1.monsterName} + ${pair.creature2.monsterName}`,
            message: `${Math.round(pair.frequency * 100)}% of successful ${currentCreatureCount}-creature maps use this pair together (${strength})`,
            suggestion: `Consider adding ${missingCreature.monsterName} - it pairs well with ${creature1InCurrent ? pair.creature1.monsterName : pair.creature2.monsterName}`,
            priority: 'high',
            isCrossMap: true,
            pair: pair,
            strength: strength
          });
        }
      }
    }
    
    // Suggest full combinations
    for (const combination of combinationAnalysis.fullCombinations) {
      if (combination.frequency > 0.3 && combination.creatures.length <= currentCreatureCount) {
        const missingCreatures = combination.creatures.filter(creature => 
          !currentCreatures.has(creature.monsterName) && !currentCreatures.has(creature.monsterId)
        );
        
        if (missingCreatures.length > 0 && missingCreatures.length < combination.creatures.length) {
          const creatureNames = missingCreatures.map(c => c.monsterName).join(', ');
          
          tips.push({
            type: 'creature',
            title: `Effective Creature Combination`,
            message: `${Math.round(combination.frequency * 100)}% of successful ${currentCreatureCount}-creature maps use this combination`,
            suggestion: `Consider adding ${creatureNames} to complete this effective creature combination`,
            priority: 'medium',
            isCrossMap: true,
            combination: combination.creatures
          });
        }
      }
    }
    
    return tips;
  }

  calculateAveragePerformance(crossMapSetups, pattern) {
    const relevantSetups = crossMapSetups.filter(s => 
      s.pattern.setup.some(p => (p.monsterName || p.monsterId) === pattern.monsterName)
    );
    
    if (relevantSetups.length === 0) return null;
    
    const totalTime = relevantSetups.reduce((sum, s) => sum + (s.pattern.bestTime || 0), 0);
    return Math.round(totalTime / relevantSetups.length);
  }

  analyzeCreatureCombinations(setups, creatureCount) {
    const combinations = new Map();
    const creaturePairs = new Map();
    
    for (const setup of setups) {
      if (setup.length !== creatureCount) continue;
      
      const creatures = setup.map(p => ({
        monsterId: p.monsterId,
        monsterName: p.monsterName || p.monsterId,
        tier: p.tier
      })).sort((a, b) => a.monsterName.localeCompare(b.monsterName));
      
      // Track full combinations
      const key = creatures.map(c => c.monsterName).join('+');
      
      if (!combinations.has(key)) {
        combinations.set(key, {
          creatures: creatures,
          frequency: 0,
          count: 0,
          avgPerformance: 0,
          totalPerformance: 0
        });
      }
      
      const combination = combinations.get(key);
      combination.count++;
      
      // Track creature pairs (any 2 creatures that appear together)
      for (let i = 0; i < creatures.length; i++) {
        for (let j = i + 1; j < creatures.length; j++) {
          const pairKey = [creatures[i].monsterName, creatures[j].monsterName].sort().join('+');
          
          if (!creaturePairs.has(pairKey)) {
            creaturePairs.set(pairKey, {
              creature1: creatures[i],
              creature2: creatures[j],
              count: 0,
              frequency: 0,
              avgPerformance: 0,
              totalPerformance: 0
            });
          }
          
          creaturePairs.get(pairKey).count++;
        }
      }
    }
    
    // Calculate frequencies and performance metrics
    const totalSetups = setups.length;
    for (const [key, combination] of combinations) {
      combination.frequency = combination.count / totalSetups;
    }
    
    for (const [key, pair] of creaturePairs) {
      pair.frequency = pair.count / totalSetups;
    }
    
    return {
      fullCombinations: Array.from(combinations.values()).sort((a, b) => b.frequency - a.frequency),
      creaturePairs: Array.from(creaturePairs.values()).sort((a, b) => b.frequency - a.frequency)
    };
  }

  generateMapLearningInsights(currentBoard, similarSetups) {
    const insights = [];
    const currentCreatureCount = currentBoard.boardSetup.length;
    
    // Count different types of similar setups
    const exactMatches = similarSetups.filter(s => s.isExactMatch).length;
    const similarSetupsCount = similarSetups.filter(s => !s.isExactMatch && !s.isCrossMap).length;
    const crossMapSetups = similarSetups.filter(s => s.isCrossMap).length;
    
    // Provide learning insights based on available data
    if (crossMapSetups > 0) {
      insights.push({
        type: 'learning',
        title: 'Cross-Map Learning Active',
        message: `Learning from ${crossMapSetups} similar ${currentCreatureCount}-creature map configurations`,
        suggestion: 'The Board Advisor is analyzing patterns from other maps with the same creature count to suggest optimal strategies',
        priority: 'low'
      });
    }
    
    if (exactMatches === 0 && similarSetupsCount === 0 && crossMapSetups > 0) {
      insights.push({
        type: 'learning',
        title: 'Learning from Similar Map Types',
        message: `No exact matches found, but learning from ${crossMapSetups} other ${currentCreatureCount}-creature maps`,
        suggestion: 'Try different creature combinations based on what works well in similar map configurations',
        priority: 'medium'
      });
    }
    
    // Analyze creature count patterns across all runs
    const allRuns = performanceTracker.runs;
    const creatureCountStats = new Map();
    
    for (const run of allRuns) {
      const count = run.boardSetup ? run.boardSetup.length : 0;
      if (!creatureCountStats.has(count)) {
        creatureCountStats.set(count, { total: 0, successful: 0, bestTime: Infinity });
      }
      
      const stats = creatureCountStats.get(count);
      stats.total++;
      if (run.success) stats.successful++;
      if (run.ticks && run.ticks < stats.bestTime) stats.bestTime = run.ticks;
    }
    
    // Find the most successful creature count
    let bestCreatureCount = null;
    let bestSuccessRate = 0;
    
    for (const [count, stats] of creatureCountStats) {
      const successRate = stats.successful / stats.total;
      if (successRate > bestSuccessRate && stats.total >= 3) {
        bestSuccessRate = successRate;
        bestCreatureCount = count;
      }
    }
    
    if (bestCreatureCount && bestCreatureCount !== currentCreatureCount) {
      const currentStats = creatureCountStats.get(currentCreatureCount);
      const bestStats = creatureCountStats.get(bestCreatureCount);
      
      if (currentStats && bestStats) {
        const currentSuccessRate = currentStats.successful / currentStats.total;
        const improvement = bestSuccessRate - currentSuccessRate;
        
        if (improvement > 0.1) {
          insights.push({
            type: 'learning',
            title: 'Map Configuration Insights',
            message: `${bestCreatureCount}-creature maps have ${Math.round(bestSuccessRate * 100)}% success rate vs ${Math.round(currentSuccessRate * 100)}% for ${currentCreatureCount}-creature maps`,
            suggestion: `Consider trying ${bestCreatureCount}-creature maps for better success rates based on your historical data`,
            priority: 'medium'
          });
        }
      }
    }
    
    return insights;
  }

  // Generate recommendations based on Board Analyzer data
  async generateBoardAnalyzerRecommendations(currentBoard, similarSetups, currentAnalysis, leaderboardComparison = null) {
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
    const currentPredictedTime = currentAnalysis?.prediction?.predictedTime || currentAnalysis?.currentAnalysis?.predictedTime;
    
    console.log(`[Board Advisor] Current prediction values:`, {
      prediction: currentAnalysis?.prediction?.predictedTime,
      currentAnalysis: currentAnalysis?.currentAnalysis?.predictedTime,
      final: currentPredictedTime,
      bestRun: bestOverallRun?.ticks
    });
    
    if (bestOverallRun && currentPredictedTime && bestOverallRun.ticks < currentPredictedTime) {
      const timeImprovement = currentPredictedTime - bestOverallRun.ticks;
      
      console.log(`[Board Advisor] Adding best setup recommendation: ${bestOverallRun.ticks} ticks (improvement: ${timeImprovement})`);
      
      // Ensure setup data has proper monster names
      const setupWithNames = bestOverallRun.boardSetup ? bestOverallRun.boardSetup.map(piece => {
        // Strip INITIAL_ prefix if present for proper name resolution
        let monsterId = piece.monsterId;
        if (monsterId && typeof monsterId === 'string' && monsterId.startsWith('INITIAL_')) {
          monsterId = monsterId.substring(8); // Remove 'INITIAL_' (8 characters)
        }
        
        // Try to resolve monster name from multiple sources
        let monsterName = piece.monsterName;
        
        console.log('[Board Advisor] setupWithNames - Original piece:', {
          monsterId: piece.monsterId,
          monsterName: piece.monsterName,
          equipmentName: piece.equipmentName,
          equipId: piece.equipId
        });
        
        // If no monster name or it's the same as monster ID, try to resolve it
        if (!monsterName || monsterName === piece.monsterId || monsterName.startsWith('INITIAL_') || monsterName === null) {
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
            console.log('[Board Advisor] setupWithNames - getMonsterName result:', {
              monsterId,
              resolvedName: monsterName
            });
          }
        }
        
        const result = {
          ...piece,
          monsterName: monsterName
        };
        
        console.log('[Board Advisor] setupWithNames - Final result:', {
          monsterId: result.monsterId,
          monsterName: result.monsterName,
          equipmentName: result.equipmentName,
          equipId: result.equipId
        });
        
        return result;
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
      const ticksRecommendations = await this.generateTicksRecommendations(completedRuns, similarSetups, currentBoard, leaderboardComparison);
      recommendations.push(...ticksRecommendations);
    } else if (config.focusArea === 'ranks') {
      const ranksRecommendations = await this.generateRanksRecommendations(completedRuns, similarSetups, currentBoard, leaderboardComparison);
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
  async generateTicksRecommendations(completedRuns, similarSetups, currentBoard, leaderboardComparison = null) {
    const recommendations = [];
    
    if (completedRuns.length === 0) return recommendations;
    
    // Calculate average from top 10 best runs instead of all runs
    const sortedRuns = [...completedRuns].sort((a, b) => a.ticks - b.ticks);
    const top10Runs = sortedRuns.slice(0, Math.min(10, sortedRuns.length));
    const avgTime = top10Runs.reduce((sum, r) => sum + r.ticks, 0) / top10Runs.length;
    
    // Use leaderboard data for best time if available, otherwise use local data
    let bestTime = Math.min(...completedRuns.map(r => r.ticks));
    if (leaderboardComparison && leaderboardComparison.analysis && leaderboardComparison.analysis.yourBestTime) {
      bestTime = leaderboardComparison.analysis.yourBestTime;
    }
    
    const worstTime = Math.max(...completedRuns.map(r => r.ticks));
    
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
    } else if (improvementRatio >= 0 && improvementRatio <= 0.05) {
      const roundedBestTime = Math.round(bestTime);
      const roundedAvgTime = Math.round(avgTime);
      const isEqual = roundedBestTime === roundedAvgTime;
      
      console.log(`[Board Advisor] Consistent Performance logic:`, {
        improvementRatio: improvementRatio,
        bestTime: bestTime,
        avgTime: avgTime,
        roundedBestTime: roundedBestTime,
        roundedAvgTime: roundedAvgTime,
        isEqual: isEqual
      });
      
      // Check if we have world record data for comparison
      let worldRecordTime = null;
      let worldRecordHolder = null;
      
      // Try to get leaderboard data from the comparison first
      if (leaderboardComparison && leaderboardComparison.leaderboard && leaderboardComparison.leaderboard.speedrun) {
        const speedrunData = leaderboardComparison.leaderboard.speedrun;
        if (speedrunData.length > 0) {
          worldRecordTime = speedrunData[0].ticks;
          worldRecordHolder = speedrunData[0].userName;
        }
      } else {
        // Fallback: try to fetch leaderboard data directly if not available in comparison
        try {
          const leaderboardData = await fetchLeaderboardWRData(currentBoard.roomId);
          if (leaderboardData && leaderboardData.tickData && leaderboardData.tickData.length > 0) {
            worldRecordTime = leaderboardData.tickData[0].ticks;
            worldRecordHolder = leaderboardData.tickData[0].userName;
          }
        } catch (error) {
          console.log('[Board Advisor] Could not fetch leaderboard data for WR comparison:', error);
        }
      }
      
      let message, suggestion;
      if (worldRecordTime !== null) {
        const gapToWR = roundedBestTime - worldRecordTime;
        
        // Check if current user is the WR holder
        const playerSnapshot = globalThis.state?.player?.getSnapshot?.();
        const currentUserName = playerSnapshot?.context?.name;
        const isCurrentUserWR = currentUserName && worldRecordHolder && currentUserName === worldRecordHolder;
        
        if (gapToWR <= 0) {
          if (isCurrentUserWR) {
            message = `Your best time (${roundedBestTime}) is the world record! You hold the record!`;
            suggestion = 'You\'re the world record holder! Maintain this incredible performance and keep pushing the limits!';
          } else {
            message = `Your best time (${roundedBestTime}) equals the world record! You're tied with ${worldRecordHolder}!`;
            suggestion = 'You\'ve achieved perfection! Try to maintain this level of consistency.';
          }
        } else if (gapToWR <= 5) {
          message = `Your best time (${roundedBestTime}) is very close to the world record (${worldRecordTime} by ${worldRecordHolder}). Only ${gapToWR} tick${gapToWR === 1 ? '' : 's'} away!`;
          suggestion = 'Focus on micro-optimizations: faster monster positioning, reduced idle time, and perfect timing.';
        } else {
          message = `Your best time (${roundedBestTime}) is ${gapToWR} ticks behind the world record (${worldRecordTime} by ${worldRecordHolder}).`;
          suggestion = 'Focus on major optimizations: better monster placement, equipment choices, and movement patterns. The Board Advisor will learn from your runs and suggest improvements based on similar map configurations.';
        }
      } else {
        message = isEqual
          ? `Your best time (${roundedBestTime}) equals your average (${roundedAvgTime}). Perfect consistency!`
          : `Your best time (${roundedBestTime}) is very close to your average (${roundedAvgTime}). Great consistency!`;
        suggestion = 'Try experimenting with different setups to find even better strategies.';
      }
      
      console.log(`[Board Advisor] Generated message:`, message);
      
      recommendations.push({
        type: 'speed',
        title: 'Consistent Performance',
        message: message,
        suggestion: suggestion,
        priority: worldRecordTime !== null ? 'high' : 'medium',
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
  generateRanksRecommendations(completedRuns, similarSetups, currentBoard, leaderboardComparison = null) {
    const recommendations = [];
    
    if (completedRuns.length === 0) return recommendations;
    
    // Rank points analysis - adjust thresholds based on actual data
    const maxPoints = Math.max(...completedRuns.map(r => r.rankPoints));
    const highPointThreshold = Math.max(3, Math.round(maxPoints * 0.8)); // Use 80% of max points as threshold
    const highPointRuns = completedRuns.filter(r => r.rankPoints >= highPointThreshold);
    const highPointRate = highPointRuns.length / completedRuns.length;
    
    if (highPointRate < 0.5 && maxPoints > 1) {
      recommendations.push({
        type: 'points',
        title: 'Improve High Point Rate',
        message: `Only ${Math.round(highPointRate * 100)}% of your runs achieve ${highPointThreshold}+ points.`,
        suggestion: 'Optimize monster stats and positioning to increase high point success rate.',
        priority: 'high',
        focusArea: 'ranks'
      });
    }
    
    // Rank points analysis
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

// =======================
// 5.5. IMMEDIATE INITIALIZATION
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
  
  // Set panel state to closed BEFORE stopping state refresh to prevent timing issues
  panelState.isOpen = false;
  
  // Stop state-based refresh when panel closes
  stopStateRefresh();
  
  // Clear tile highlights when panel is closed
  if (window.boardAdvisorInstance) {
    window.boardAdvisorInstance.clearTileHighlights();
  }
  
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
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
    font-size: 18px;
    font-weight: 600;
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
    font-size: 18px;
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
    font-size: 14px;
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
        font-size: 11px;
    transition: transform 0.2s ease;
  `;
  title.appendChild(collapseIcon);
  
  const analysis = document.createElement('div');
  analysis.id = 'analysis-display';
  analysis.style.cssText = `
    display: block;
    font-size: 13px;
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
    font-size: 14px;
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
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  `;
  
  const ranksLabel = document.createElement('span');
  ranksLabel.textContent = '🏆 Rank Points';
  ranksLabel.style.cssText = `
    color: #E5C07B;
    font-size: 14px;
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
  section.id = 'recommendations-section';
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
    font-size: 14px;
    font-weight: 600;
  `;
  
  const recommendations = document.createElement('div');
  recommendations.id = 'recommendations-display';
  recommendations.style.cssText = `
    font-size: 13px;
    line-height: 1.3;
  `;
  
  section.appendChild(title);
  section.appendChild(recommendations);
  
  return section;
}

// Function to show/hide recommendations section
function setRecommendationsSectionVisibility(visible) {
  const recommendationsSection = document.getElementById('recommendations-section');
  if (recommendationsSection) {
    recommendationsSection.style.display = visible ? 'block' : 'none';
  }
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
    font-size: 13px;
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
  
  // Settings button
  const settingsButton = document.createElement('button');
  settingsButton.innerHTML = '⚙️';
  settingsButton.title = 'Open Settings';
  settingsButton.style.cssText = `
    background: #4B5563;
    border: 1px solid #6B7280;
    color: #E5E7EB;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    margin-left: 8px;
    transition: background-color 0.2s;
  `;
  
  // Hover effects
  settingsButton.addEventListener('mouseenter', () => {
    settingsButton.style.background = '#6B7280';
  });
  settingsButton.addEventListener('mouseleave', () => {
    settingsButton.style.background = '#4B5563';
  });
  
  // Click handler to open settings
  settingsButton.addEventListener('click', () => {
    openSettingsModal();
  });
  
  footer.appendChild(settingsButton);
  
  // Update status when config changes
  const originalSaveConfig = saveConfig;
  saveConfig = function() {
    originalSaveConfig.apply(this, arguments);
    updateStatus();
  };
  
  return footer;
}

function openSettingsModal() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const settingsPanel = document.createElement('div');
  settingsPanel.style.cssText = `
    background: #2D3748;
    border: 1px solid #4A5568;
    border-radius: 8px;
    padding: 24px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  `;
  
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #4A5568;
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'Board Advisor Settings';
  title.style.cssText = `
    margin: 0;
    color: #E2E8F0;
    font-size: 20px;
    font-weight: 600;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: #A0AEC0;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
  `;
  
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.background = '#4A5568';
  });
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.background = 'none';
  });
  
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;
  
  // Board Advisor Settings Section
  const boardAdvisorSection = document.createElement('div');
  boardAdvisorSection.style.cssText = `
    padding: 16px;
    background: #1A202C;
    border-radius: 6px;
    border: 1px solid #4A5568;
    margin-bottom: 16px;
  `;
  
  const boardAdvisorTitle = document.createElement('h4');
  boardAdvisorTitle.textContent = 'Board Advisor Settings';
  boardAdvisorTitle.style.cssText = `
    margin: 0 0 12px 0;
    color: #E2E8F0;
    font-size: 16px;
    font-weight: 600;
  `;
  
  // Create settings container
  const settingsContainer = document.createElement('div');
  settingsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;
  
  // Show Predictions
  const predictionsLabel = document.createElement('label');
  predictionsLabel.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const showPredictionsCheckbox = document.createElement('input');
  showPredictionsCheckbox.type = 'checkbox';
  showPredictionsCheckbox.id = 'showPredictions';
  showPredictionsCheckbox.checked = config.showPredictions;
  
  console.log('[Board Advisor] Creating showPredictions checkbox, config value:', config.showPredictions, 'checkbox checked:', showPredictionsCheckbox.checked);
  
  const showPredictionsText = document.createTextNode('Show Performance Predictions');
  
  predictionsLabel.appendChild(showPredictionsCheckbox);
  predictionsLabel.appendChild(showPredictionsText);
  
  const showPredictionsDesc = document.createElement('div');
  showPredictionsDesc.textContent = 'Displays predicted completion times, success rates, and performance metrics in the panel';
  showPredictionsDesc.style.cssText = 'font-size: 11px; color: #ABB2BF; margin-top: -8px; margin-bottom: 8px;';
  
  // Enable Tile Recommendations
  const tileRecommendationsLabel = document.createElement('label');
  tileRecommendationsLabel.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const enableTileRecommendationsCheckbox = document.createElement('input');
  enableTileRecommendationsCheckbox.type = 'checkbox';
  enableTileRecommendationsCheckbox.id = 'enableTileRecommendations';
  enableTileRecommendationsCheckbox.checked = config.enableTileRecommendations;
  
  console.log('[Board Advisor] Creating enableTileRecommendations checkbox, config value:', config.enableTileRecommendations, 'checkbox checked:', enableTileRecommendationsCheckbox.checked);
  
  // Add change listeners that save immediately
  showPredictionsCheckbox.addEventListener('change', () => {
    console.log('[Board Advisor] showPredictions checkbox changed to:', showPredictionsCheckbox.checked);
    config.showPredictions = showPredictionsCheckbox.checked;
    api.service.updateScriptConfig(context.hash, config);
    console.log('[Board Advisor] showPredictions saved:', config.showPredictions);
    
    // Refresh the panel to show/hide predictions
    console.log('[Board Advisor] Checking panel state:', {
      isOpen: panelState.isOpen
    });
    
    if (panelState.isOpen) {
      console.log('[Board Advisor] Refreshing panel, showPredictions is now:', config.showPredictions);
      refreshPanelData();
    } else {
      console.log('[Board Advisor] Panel not open, skipping refresh');
    }
  });
  
  enableTileRecommendationsCheckbox.addEventListener('change', () => {
    console.log('[Board Advisor] enableTileRecommendations checkbox changed to:', enableTileRecommendationsCheckbox.checked);
    config.enableTileRecommendations = enableTileRecommendationsCheckbox.checked;
    api.service.updateScriptConfig(context.hash, config);
    
    // Clear tile highlights if disabled
    if (!config.enableTileRecommendations) {
      console.log('[Board Advisor] Clearing tile highlights because enableTileRecommendations is disabled');
      boardAnalyzer.clearTileHighlights();
    }
    
    console.log('[Board Advisor] enableTileRecommendations saved:', config.enableTileRecommendations);
    
    // Refresh the panel to update tile recommendations
    console.log('[Board Advisor] Checking panel state for tile recommendations:', {
      isOpen: panelState.isOpen
    });
    
    if (panelState.isOpen) {
      console.log('[Board Advisor] Refreshing panel, enableTileRecommendations is now:', config.enableTileRecommendations);
      refreshPanelData();
    } else {
      console.log('[Board Advisor] Panel not open, skipping refresh for tile recommendations');
    }
  });
  
  const enableTileRecommendationsText = document.createTextNode('Enable Tile Recommendations');
  
  tileRecommendationsLabel.appendChild(enableTileRecommendationsCheckbox);
  tileRecommendationsLabel.appendChild(enableTileRecommendationsText);
  
  const tileRecommendationsDesc = document.createElement('div');
  tileRecommendationsDesc.textContent = 'Highlights optimal tile positions on the game board for monster placement';
  tileRecommendationsDesc.style.cssText = 'font-size: 11px; color: #ABB2BF; margin-top: -8px; margin-bottom: 8px;';
  
  // Add all settings to container
  settingsContainer.appendChild(predictionsLabel);
  settingsContainer.appendChild(showPredictionsDesc);
  settingsContainer.appendChild(tileRecommendationsLabel);
  settingsContainer.appendChild(tileRecommendationsDesc);
  
  boardAdvisorSection.appendChild(boardAdvisorTitle);
  boardAdvisorSection.appendChild(settingsContainer);
  content.appendChild(boardAdvisorSection);
  
  const resetSection = document.createElement('div');
  resetSection.style.cssText = `
    padding: 16px;
    background: #1A202C;
    border-radius: 6px;
    border: 1px solid #4A5568;
  `;
  
  const resetTitle = document.createElement('h4');
  resetTitle.textContent = 'Database Management';
  resetTitle.style.cssText = `
    margin: 0 0 12px 0;
    color: #E2E8F0;
    font-size: 16px;
    font-weight: 600;
  `;
  
  const resetDescription = document.createElement('p');
  resetDescription.textContent = 'Clear all stored analysis data and start fresh. This will remove all historical run data, patterns, and recommendations.';
  resetDescription.style.cssText = `
    margin: 0 0 16px 0;
    color: #A0AEC0;
    font-size: 14px;
    line-height: 1.4;
  `;
  
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset IndexedDB';
  resetButton.style.cssText = `
    background: #E53E3E;
    border: 1px solid #C53030;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;
  
  resetButton.addEventListener('mouseenter', () => {
    resetButton.style.background = '#C53030';
  });
  resetButton.addEventListener('mouseleave', () => {
    resetButton.style.background = '#E53E3E';
  });
  
  resetButton.addEventListener('click', () => {
    showResetConfirmation(resetSection, resetButton);
  });
  
  // Close modal handlers
  const closeModal = () => modal.remove();
  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // ESC key handler
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  addDocumentListener('keydown', handleKeyDown);
  modal.addEventListener('remove', () => {
    // Remove from tracking array
    documentListeners = documentListeners.filter(listener => listener.handler !== handleKeyDown);
    document.removeEventListener('keydown', handleKeyDown);
  });
  
  // Assemble the modal
  header.appendChild(title);
  header.appendChild(closeButton);
  
  resetSection.appendChild(resetTitle);
  resetSection.appendChild(resetDescription);
  resetSection.appendChild(resetButton);
  
  content.appendChild(resetSection);
  
  settingsPanel.appendChild(header);
  settingsPanel.appendChild(content);
  modal.appendChild(settingsPanel);
  
  document.body.appendChild(modal);
}


function showResetConfirmation(resetSection, resetButton) {
  // Hide the original button
  resetButton.style.display = 'none';
  
  // Create confirmation container
  const confirmationContainer = document.createElement('div');
  confirmationContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: #2D3748;
    border-radius: 6px;
    border: 1px solid #E53E3E;
  `;
  
  // Warning message
  const warningMessage = document.createElement('div');
  warningMessage.style.cssText = `
    color: #FED7D7;
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 8px;
  `;
  warningMessage.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span style="font-size: 16px;">⚠️</span>
      <strong>Warning: This action cannot be undone!</strong>
    </div>
    <div>This will permanently delete all stored analysis data, patterns, and recommendations from all rooms.</div>
  `;
  
  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  `;
  
  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: #4A5568;
    border: 1px solid #6B7280;
    color: #E2E8F0;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;
  
  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.background = '#6B7280';
  });
  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.background = '#4A5568';
  });
  
  cancelButton.addEventListener('click', () => {
    // Restore original button
    resetButton.style.display = 'block';
    confirmationContainer.remove();
  });
  
  // Confirm button
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Reset Database';
  confirmButton.style.cssText = `
    background: #E53E3E;
    border: 1px solid #C53030;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;
  
  confirmButton.addEventListener('mouseenter', () => {
    confirmButton.style.background = '#C53030';
  });
  confirmButton.addEventListener('mouseleave', () => {
    confirmButton.style.background = '#E53E3E';
  });
  
  confirmButton.addEventListener('click', async () => {
    // Show loading state
    confirmButton.disabled = true;
    confirmButton.textContent = 'Resetting...';
    confirmButton.style.background = '#9CA3AF';
    
    try {
      await resetIndexedDB();
      
      // Show success message
      confirmationContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: #065F46;
        border-radius: 6px;
        border: 1px solid #10B981;
      `;
      confirmationContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">✅</span>
          <div style="color: #D1FAE5; font-size: 13px;">
            <strong>Success!</strong> IndexedDB has been reset and UI reloaded.
          </div>
        </div>
      `;
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        // Find and close the modal
        const modal = confirmationContainer.closest('[style*="position: fixed"]');
        if (modal) {
          modal.remove();
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error resetting IndexedDB:', error);
      
      // Show error message
      confirmationContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: #7F1D1D;
        border-radius: 6px;
        border: 1px solid #DC2626;
      `;
      confirmationContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">❌</span>
          <div style="color: #FED7D7; font-size: 13px;">
            <strong>Error:</strong> Failed to reset IndexedDB. Please try again.
          </div>
        </div>
      `;
      
      // Restore original button after 3 seconds
      setTimeout(() => {
        resetButton.style.display = 'block';
        confirmationContainer.remove();
      }, 3000);
    }
  });
  
  // Assemble confirmation dialog
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);
  
  confirmationContainer.appendChild(warningMessage);
  confirmationContainer.appendChild(buttonContainer);
  
  // Insert after the reset section
  resetSection.parentNode.insertBefore(confirmationContainer, resetSection.nextSibling);
}

async function resetIndexedDB() {
  return new Promise(async (resolve, reject) => {
    try {
      // If database is not open, open it first
      if (!sandboxDB || !isDBReady) {
        await initializeDatabase();
      }
      
      if (!sandboxDB) {
        reject(new Error('Failed to open database for reset'));
        return;
      }
      
      console.log('[Board Advisor] Starting IndexedDB reset...');
      
      // Get all existing store names
      const storeNames = Array.from(sandboxDB.objectStoreNames);
      console.log('[Board Advisor] Found stores:', storeNames);
      
      const clearPromises = [];
      
      // Clear each store individually
      for (const storeName of storeNames) {
        clearPromises.push(
          new Promise((resolve, reject) => {
            const transaction = sandboxDB.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
              console.log(`[Board Advisor] Cleared store: ${storeName}`);
              resolve();
            };
            clearRequest.onerror = () => {
              console.error(`[Board Advisor] Failed to clear store ${storeName}:`, clearRequest.error);
              reject(clearRequest.error);
            };
          })
        );
      }
      
      // Wait for all clear operations to complete
      await Promise.all(clearPromises);
      
      console.log('[Board Advisor] IndexedDB stores successfully cleared');
      
      // Reset runtime state
      runTrackerData = null;
      currentRecommendedSetup = null;
      placedRecommendedPieces = new Set();
      analysisState = {
        isAnalyzing: false,
        isDataLoading: false,
        currentAnalysis: null,
        historicalData: [],
        patterns: {},
        recommendations: null,
        lastBoardHash: null,
        lastDataLoadTime: 0
      };
      performanceCache = {
        lastRoomDetection: null,
        lastRoomDetectionTime: 0
      };
      
      // Reload UI to show clean state
      reloadUI();
      
      resolve();
      
    } catch (error) {
      console.error('[Board Advisor] Error during IndexedDB reset:', error);
      reject(error);
    }
  });
}

function reloadUI() {
  console.log('[Board Advisor] Reloading UI after reset...');
  
  // Clear any existing tile highlights
  cleanupTileHighlights();
  
  // Reset panel content to show clean state
  const panel = document.getElementById(PANEL_ID);
  if (panel) {
    // Update the analysis display to show no data
    updatePanelStatus('Database cleared. Start playing to build new analysis data.', 'info');
    
    // Clear recommendations section
    const recommendationsDisplay = document.getElementById('recommendations-display');
    if (recommendationsDisplay) {
      recommendationsDisplay.innerHTML = '<div style="color: #A0AEC0; font-style: italic;">No recommendations available. Play some games to build data.</div>';
    }
    
    // Clear any analysis results
    const analysisDisplay = document.getElementById('analysis-display');
    if (analysisDisplay) {
      analysisDisplay.innerHTML = '<div style="color: #A0AEC0; text-align: center; padding: 20px;">No analysis data available. Play some games to start building recommendations.</div>';
    }
    
    // Reset historical data display
    const historicalSection = panel.querySelector('.historical-data');
    if (historicalSection) {
      historicalSection.style.display = 'none';
    }
  }
  
  // Clear any cached recommendations
  currentRecommendedSetup = null;
  placedRecommendedPieces.clear();
  
  console.log('[Board Advisor] UI reloaded successfully');
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
  
  const handleMouseMove = (e) => {
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
  };
  
  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  };
  
  addDocumentListener('mousemove', handleMouseMove);
  addDocumentListener('mouseup', handleMouseUp);
}

function makeResizable(panel) {
  // Create resize handles for Windows-like resizing
  const resizeHandles = {
    right: createResizeHandle('right'),
    bottom: createResizeHandle('bottom'),
    corner: createResizeHandle('corner')
  };
  
  function createResizeHandle(type) {
    const handle = document.createElement('div');
    const isCorner = type === 'corner';
    
    handle.style.cssText = `
      position: absolute;
      background: transparent;
      z-index: 10002;
      ${isCorner ? `
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        cursor: se-resize;
      ` : type === 'right' ? `
        top: 0;
        right: 0;
        width: 4px;
        height: 100%;
        cursor: e-resize;
      ` : `
        bottom: 0;
        left: 0;
        width: 100%;
        height: 4px;
        cursor: s-resize;
      `}
    `;
    
    // Add hover effect
    handle.addEventListener('mouseenter', () => {
      handle.style.background = isCorner ? '#61AFEF' : '#4B5563';
    });
    
    handle.addEventListener('mouseleave', () => {
      handle.style.background = 'transparent';
    });
    
    return handle;
  }
  
  let isResizing = false;
  let resizeType = '';
  let startX, startY, startWidth, startHeight;
  
  function startResize(e, type) {
    isResizing = true;
    resizeType = type;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = panel.offsetWidth;
    startHeight = panel.offsetHeight;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = getCursorForType(type);
    e.preventDefault();
    e.stopPropagation();
  }
  
  function getCursorForType(type) {
    switch(type) {
      case 'right': return 'e-resize';
      case 'bottom': return 's-resize';
      case 'corner': return 'se-resize';
      default: return 'default';
    }
  }
  
  // Add event listeners to handles
  resizeHandles.right.addEventListener('mousedown', (e) => startResize(e, 'right'));
  resizeHandles.bottom.addEventListener('mousedown', (e) => startResize(e, 'bottom'));
  resizeHandles.corner.addEventListener('mousedown', (e) => startResize(e, 'corner'));
  
  const handleResizeMouseMove = (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    // Allow width resizing
    if (resizeType === 'right' || resizeType === 'corner') {
      newWidth = Math.max(300, Math.min(600, startWidth + deltaX));
    }
    
    // Allow height resizing
    if (resizeType === 'bottom' || resizeType === 'corner') {
      newHeight = Math.max(200, Math.min(1200, startHeight + deltaY));
    }
    
    // Update panel size
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    
    // Update state
    panelState.size.width = newWidth;
    panelState.size.height = newHeight;
  };
  
  const handleResizeMouseUp = () => {
    if (isResizing) {
      isResizing = false;
      resizeType = '';
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  };
  
  addDocumentListener('mousemove', handleResizeMouseMove);
  addDocumentListener('mouseup', handleResizeMouseUp);
  
  // Add handles to panel
  panel.appendChild(resizeHandles.right);
  panel.appendChild(resizeHandles.bottom);
  panel.appendChild(resizeHandles.corner);
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
    setRecommendationsSectionVisibility(true);
  } else {
    recommendationsDisplay.innerHTML = '<div style="color: #E06C75;">No recommendations available. Play some games to build data.</div>';
    setRecommendationsSectionVisibility(false);
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
      
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="enableTileRecommendations" ${config.enableTileRecommendations ? 'checked' : ''}>
        Enable Tile Recommendations
      </label>
      
      <div style="font-size: 11px; color: #ABB2BF; margin-top: -8px; margin-bottom: 8px;">
        Highlights optimal tile positions on the game board for monster placement
      </div>
      
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
  const enableTileRecommendations = document.getElementById('enableTileRecommendations').checked;
  const autoRefreshPanel = document.getElementById('autoRefreshPanel').checked;

  config.enabled = enabled;
  config.analysisDepth = analysisDepth;
  config.learningEnabled = learningEnabled;
  config.showPredictions = showPredictions;
  config.autoAnalyze = autoAnalyze;
  config.enableTileRecommendations = enableTileRecommendations;
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
  
  // Clear tile highlights if tile recommendations are disabled
  if (!config.enableTileRecommendations && window.boardAdvisorInstance) {
    window.boardAdvisorInstance.clearTileHighlights();
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
        <div style="font-weight: 600; color: #2196F3;">Play Some Games</div>
        <div style="font-size: 13px; margin-top: 4px;">Complete a few games to start building data for analysis</div>
      </div>
      <div style="padding: 8px; margin: 4px 0; border-left: 3px solid #4CAF50; background: rgba(0,0,0,0.05); border-radius: 4px;">
        <div style="font-weight: 600; color: #4CAF50;">Try Different Setups</div>
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
  
  // Don't start analysis if UI is loading
  if (analysisState.isUILoading) {
    console.log('[Board Advisor] Analysis skipped - UI loading in progress');
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

  // Don't start analysis if UI is loading
  if (analysisState.isUILoading) {
    console.log('[Board Advisor] Analysis skipped - UI loading in progress');
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
      font-size: 13px;
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

function clearRecommendationsInstantly() {
  const recommendationsDisplay = document.getElementById('recommendations-display');
  const analysisDisplay = document.getElementById('analysis-display');
  
  // Clear any existing tile highlights immediately
  cleanupTileHighlights();
  
  // Reset recommended setup tracking variables
  currentRecommendedSetup = null;
  placedRecommendedPieces.clear();
  
  if (recommendationsDisplay) {
    recommendationsDisplay.innerHTML = `
      <div style="text-align: center; color: #777; font-style: italic; padding: 20px;">
        Loading recommendations for new map...
      </div>
    `;
  }
  
  if (analysisDisplay) {
    analysisDisplay.innerHTML = `
      <div style="text-align: center; color: #777; font-style: italic; padding: 20px;">
        Analyzing new map...
      </div>
    `;
  }
  
  // Clear any existing analysis state to prevent stale data
  if (window.analysisState) {
    window.analysisState.currentAnalysis = null;
    window.analysisState.lastBoardHash = null;
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
      <div style="font-weight: 600; color: #98C379; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span>🗺️</span>
        <span>Current Map: ${roomName}</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Pieces: ${currentBoard.boardSetup.length} | Monsters: ${currentBoard.playerMonsters.length} | Equipment: ${currentBoard.playerEquipment.length}
      </div>
    </div>
    
    ${hasHistoricalData ? `
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #98C379;">
      <div style="font-weight: 600; color: #98C379; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>📊</span>
        <span>Historical Data Available</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Found ${roomRuns.length} runs for this map. Analysis and recommendations are being processed.
      </div>
    </div>
    ` : `
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
      <div style="font-weight: 600; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>⚠️</span>
        <span>No Historical Data</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Play some games to build data for analysis and personalized recommendations.
      </div>
    </div>
    `}
    
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #61AFEF;">
      <div style="font-weight: 600; color: #61AFEF; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
      <div style="font-weight: 600; color: #2196F3; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>🚀</span>
        <span>Getting Started</span>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #2196F3;">
        <div style="font-weight: 600; color: #2196F3; font-size: 11px;">Play Some Games</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Complete 3-5 games with this setup to start building data for analysis</div>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #4CAF50;">
        <div style="font-weight: 600; color: #4CAF50; font-size: 11px;">Try Different Setups</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Experiment with different monster and equipment combinations for better data</div>
      </div>
    </div>
    
    <div style="margin-bottom: 12px;">
      <div style="font-weight: 600; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>💡</span>
        <span>Advanced Features Coming Soon</span>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: 600; color: #E5C07B; font-size: 11px;">Performance Predictions</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Will predict your expected time and success rate</div>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: 600; color: #E5C07B; font-size: 11px;">Optimization Tips</div>
        <div style="font-size: 10px; margin-top: 4px; color: #ABB2BF;">Personalized recommendations for monster positioning and equipment</div>
      </div>
      
      <div style="margin: 6px 0; padding: 8px; background: #4B5563; border-radius: 4px; border-left: 3px solid #E5C07B;">
        <div style="font-weight: 600; color: #E5C07B; font-size: 11px;">Leaderboard Analysis</div>
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
  
  // Show recommendations section when there's data
  setRecommendationsSectionVisibility(true);
  
  // Get room name for display
  const roomName = globalThis.state?.utils?.ROOM_NAME?.[analysis.roomId] || analysis.roomId;
  
  // Check if board is empty
  const isBoardEmpty = !analysis.currentBoard || !analysis.currentBoard.boardSetup || analysis.currentBoard.boardSetup.length === 0;
    
  // Update analysis section with comprehensive information
  const similarSetupsCount = analysis.similarSetups?.length || 0;
  const patternsText = similarSetupsCount === 1 ? 'setup' : 'setups';
  
  let analysisHTML = `
    <div style="margin-bottom: 8px; padding: 8px 10px; background: #1F2937; border-radius: 4px; border-left: 3px solid #98C379;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; color: #98C379; font-size: 13px;">🗺️ ${roomName}</span>
        <span style="font-size: 11px; color: #61AFEF; font-weight: 500;">${similarSetupsCount} ${patternsText}</span>
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
        <div style="font-weight: 600; color: #3B82F6; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
      
      let leaderboardContent = '';
      
      // Show only relevant leaderboard info based on focus area
      if (config.focusArea === 'ticks' && wrData.tickData && wrData.tickData.length > 0) {
        const wr = wrData.tickData[0];
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: 600;">${wr.ticks} ticks</span> <span style="color: #61AFEF;">(${wr.userName})</span></div>`;
        
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
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: 600;">${wr.rank} points</span> <span style="color: #61AFEF;">(${wr.userName})</span></div>`;
        
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
          No leaderboard data available
        </div>
      </div>
    `;
  }
  
  // Add historical data analysis (filtered by focus area) - always show when available
  console.log('[Board Advisor] Checking historical data:', {
    hasData: analysis.hasData,
    currentAnalysis: analysis.currentAnalysis,
    hasHistoricalData: analysis.currentAnalysis?.hasHistoricalData
  });
  
  if (analysis.currentAnalysis?.hasHistoricalData || analysis.hasData) {
    // Use data from currentAnalysis if available, otherwise fall back to top-level data
    const historicalData = analysis.currentAnalysis?.hasHistoricalData ? analysis.currentAnalysis : {
      bestTime: analysis.summary?.bestTime || 'Unknown',
      averageTime: analysis.summary?.averageTime || 0,
      successRate: analysis.summary?.successRate || 1.0, // Default to 100% if not available
      totalRuns: analysis.totalRuns || 0,
      bestPoints: analysis.summary?.bestPoints || 'Unknown'
    };
    
    // Ensure successRate is a valid number between 0 and 1
    const rawSuccessRate = historicalData.successRate;
    const validSuccessRate = (typeof rawSuccessRate === 'number' && !isNaN(rawSuccessRate)) ? rawSuccessRate : 1.0;
    const successRate = Math.round(validSuccessRate * 100);
    const successColor = successRate >= 80 ? '#98C379' : successRate >= 60 ? '#E5C07B' : '#E06C75';
    
    console.log('[Board Advisor] Historical data values:', {
      rawSuccessRate,
      validSuccessRate,
      successRate,
      historicalData
    });
    
    // Show different historical data based on focus area
    let historicalContent = '';
    if (config.focusArea === 'ticks') {
      historicalContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div><strong>Best Time:</strong> <span style="color: #98C379;">${historicalData.bestTime} ticks</span></div>
          <div><strong>Success Rate:</strong> <span style="color: ${successColor};">${successRate}%</span></div>
          <div><strong>Average Time:</strong> <span style="color: #61AFEF;">${Math.round(historicalData.averageTime)} ticks</span></div>
          <div><strong>Total Runs:</strong> <span style="color: #61AFEF;">${historicalData.totalRuns}</span></div>
        </div>
      `;
    } else if (config.focusArea === 'ranks') {
      historicalContent = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div><strong>Best Time:</strong> <span style="color: #98C379;">${historicalData.bestTime || 'Unknown'}</span></div>
          <div><strong>Success Rate:</strong> <span style="color: ${successColor};">${successRate}%</span></div>
          <div><strong>Best Points:</strong> <span style="color: #61AFEF;">${historicalData.bestPoints || 'Unknown'}</span></div>
          <div><strong>Total Runs:</strong> <span style="color: #61AFEF;">${historicalData.totalRuns}</span></div>
        </div>
      `;
    }
    
    analysisHTML += `
      <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #E5C07B;">
        <div style="font-weight: 600; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>📊</span>
          <span>Historical Performance (${config.focusArea === 'ticks' ? 'Speed' : 'Rank Points'})</span>
        </div>
        ${historicalContent}
      </div>
    `;
  } else {
    // Only show empty board message if there's no historical data at all
    analysisHTML += `
      <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
        <div style="font-weight: 600; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>⚠️</span>
          <span>No Historical Data</span>
        </div>
        <div style="font-size: 11px; color: #ABB2BF;">
          Play some games to build data for analysis and recommendations.
        </div>
      </div>
    `;
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
      recsHTML += '<div style="font-weight: 600; color: #3B82F6; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">';
      recsHTML += '<span>🏆</span><span>Leaderboard Insights</span></div>';
      
      groupedRecs.leaderboard.forEach(rec => {
        recsHTML += `<div style="margin: 6px 0; padding: 8px; background: #1F2937; border-radius: 4px; border-left: 3px solid #3B82F6;">
          <div style="font-weight: 600; color: #3B82F6; font-size: 11px;">${rec.title}</div>
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
          <div style="font-weight: 600; color: #E06C75; font-size: 11px;">${rec.title}</div>
              <div style="font-size: 10px; margin-top: 2px; color: #ABB2BF;">${rec.description || rec.message || 'Use this setup to achieve better performance'}</div>
              <div style="font-size: 9px; color: #98C379; margin-top: 2px;">💡 ${rec.setup.map(piece => {
                  const tile = piece.tileIndex || piece.tile || '?';
                // Strip INITIAL_ prefix if present for proper name resolution
                let monsterId = piece.monsterId;
                if (monsterId && typeof monsterId === 'string' && monsterId.startsWith('INITIAL_')) {
                  monsterId = monsterId.substring(8); // Remove 'INITIAL_' (8 characters)
                }
                
                // Prioritize existing monster name from piece data
                let monster = piece.monsterName;
                console.log('[Board Advisor] Piece data for display:', {
                  monsterId: piece.monsterId,
                  monsterName: piece.monsterName,
                  equipmentName: piece.equipmentName,
                  equipId: piece.equipId
                });
                
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
          <div style="font-weight: 600; color: #61AFEF; font-size: 11px;">⚔️ Popular Choices</div>
          ${equipmentSuggestions.length > 0 ? `<div style="font-size: 10px; color: #ABB2BF; margin-top: 2px;">Equipment: ${equipmentSuggestions.join(', ')}</div>` : ''}
          ${creatureSuggestions.length > 0 ? `<div style="font-size: 10px; color: #ABB2BF; margin-top: 2px;">Creatures: ${creatureSuggestions.join(', ')}</div>` : ''}
        </div>`;
      }
      
      // Other recommendations (consolidated)
      const otherRecs = [...groupedRecs.improvement.filter(r => !r.title.includes('Best Available Setup')), ...groupedRecs.other];
      if (otherRecs.length > 0) {
        otherRecs.forEach(rec => {
          recsHTML += `<div style="margin: 3px 0; padding: 6px; background: #4B5563; border-radius: 4px; border-left: 3px solid #98C379;">
            <div style="font-weight: 600; color: #98C379; font-size: 11px;">${rec.title}</div>
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
        <div style="font-weight: 600; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
  
  // Hide recommendations section when there's no data
  setRecommendationsSectionVisibility(false);
  
  // Get room name for display
  const roomName = globalThis.state?.utils?.ROOM_NAME?.[analysis.roomId] || analysis.roomId;
  
  // Update analysis section with no-data information (consistent with data UI)
  let analysisHTML = `
    <div style="margin-bottom: 12px; padding: 8px; background: #1F2937; border-radius: 6px; border-left: 4px solid #98C379;">
      <div style="font-weight: 600; color: #98C379; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <span>🗺️</span>
        <span>Current Map: ${roomName}</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Total Runs: ${analysis.totalRuns} | Room Data: 0
      </div>
    </div>
  `;
  
  // Add no-data information (consistent with data UI structure)
  analysisHTML += `
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #FF9800;">
      <div style="font-weight: 600; color: #FF9800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>⚠️</span>
        <span>No Historical Data</span>
      </div>
      <div style="font-size: 11px; color: #ABB2BF;">
        Play some games to build data for analysis and personalized recommendations.
      </div>
    </div>
    
    <div style="margin-bottom: 12px; padding: 10px; background: #1F2937; border-radius: 6px; border-left: 4px solid #61AFEF;">
      <div style="font-weight: 600; color: #61AFEF; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
          <div style="font-weight: 600; color: #3B82F6; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
      
      let leaderboardContent = '';
      
      // Show only relevant leaderboard info based on focus area
      if (config.focusArea === 'ticks' && wrData.tickData && wrData.tickData.length > 0) {
        const wr = wrData.tickData[0];
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: 600;">${wr.ticks} ticks</span> <span style="color: #61AFEF;">(${wr.userName})</span></div>`;
        
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
        leaderboardContent += `<div><strong>World Record:</strong> <span style="color: #ffd700; font-weight: 600;">${wr.rank} points</span> <span style="color: #61AFEF;">(${wr.userName})</span></div>`;
        
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
          No leaderboard data available
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
          <div style="font-weight: 600; color: #98C379; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
          <div style="font-weight: 600; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
          <div style="font-weight: 600; color: #E5C07B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
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
            <div style="font-weight: 600; color: ${priorityColor}; font-size: 12px; margin-bottom: 6px;">
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
                <div style="font-size: 11px; color: #61AFEF; margin-bottom: 4px; font-weight: 600;">📋 Recommended Setup:</div>
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
            <div style="font-weight: 600; color: ${priorityColor}; font-size: 12px; margin-bottom: 6px;">
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
  
  setTimeout(() => {
    const testButtons = recommendationsDisplay.querySelectorAll('.copy-replay-btn');
    console.log('[Board Advisor] Test: Found', testButtons.length, 'buttons after timeout');
    testButtons.forEach((button, index) => {
      console.log('[Board Advisor] Test: Button', index, 'has data-setup:', button.getAttribute('data-setup'));
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
  
  // Don't refresh if UI is already loading or board change is in progress
  if (analysisState.isUILoading || isBoardChangeInProgress()) {
    console.log(`[Board Advisor] Skipping state refresh - UI loading or board change in progress`);
    return;
  }
  
  stateRefreshSystem.lastRefreshTime = now;
  
  console.log(`[Board Advisor] State change detected from ${source}, refreshing panel`);
  refreshPanelData();
}

// Refresh panel data
async function refreshPanelData() {
  if (!panelState.isOpen) return;
  
  // Don't refresh if UI is already loading
  if (analysisState.isUILoading) {
    console.log('[Board Advisor] Skipping panel refresh - UI loading in progress');
    return;
  }
  
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

// Initialize previous room ID for change detection
previousRoomId = dataCollector.getCurrentBoardData()?.roomId || null;

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
  // Cache removed - no action needed
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
        // Cache removed - no action needed
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


// Helper function to add document listeners with tracking
function addDocumentListener(event, handler) {
  document.addEventListener(event, handler);
  documentListeners.push({ event, handler });
}

// Cleanup function for subscriptions
function cleanupSubscriptions() {
  activeSubscriptions.forEach(subscription => {
    if (subscription && typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
    }
  });
  activeSubscriptions = [];
  console.log('[Board Advisor] All subscriptions cleaned up');
}

// Cleanup function for document listeners
function cleanupDocumentListeners() {
  documentListeners.forEach(({ event, handler }) => {
    document.removeEventListener(event, handler);
  });
  documentListeners = [];
  console.log('[Board Advisor] All document listeners cleaned up');
}

// Cleanup function for database connection
function cleanupDatabase() {
  if (sandboxDB) {
    sandboxDB.close();
    sandboxDB = null;
    isDBReady = false;
    console.log('[Board Advisor] Database connection closed');
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanupSubscriptions();
  cleanupDocumentListeners();
  cleanupDatabase();
  stopStateRefresh();
});
