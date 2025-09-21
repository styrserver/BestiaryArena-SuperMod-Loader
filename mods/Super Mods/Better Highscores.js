// =======================
// Better Highscores.js - Bestiary Arena Leaderboard Display Mod
// =======================
// Version: 1.0.0
// Features: 
// - Display current map's tick and rank leaderboards in bottom left
// - Real-time updates when switching maps
// - Automatic data fetching from TRPC API
// - Styled leaderboard display with medal colors
// - Manual refresh capability
// - Skips updates during sandbox mode runs (only updates in manual/autoplay mode)
//
// MODULE INDEX:
// 1. Configuration & Constants
// 2. State Management
// 3. DOM Cache Management
// 4. Error Handling
// 5. API Functions
// 6. Utility Functions
// 7. UI Components & Rendering
// 8. Initialization & Cleanup
// =======================
(function() {

// =======================
// MODULE 1: Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  const DEBUG = false;
  
  const log = DEBUG ? console.log : () => {};
  
  const PERFORMANCE = {
    DOM_CACHE_TIMEOUT: 100, // Reduced for faster cache refresh
    API_THROTTLE_MIN: 50,   // Reduced for faster API calls
    API_THROTTLE_MAX: 1000, // Reduced max throttle
    RATE_LIMIT_RETRY_DELAY: 1000, // Reduced retry delay
    RATE_LIMIT_MAX_RETRIES: 3,
    UPDATE_DELAY: 10,       // Reduced for faster updates
    REFRESH_COOLDOWN: 100   // Reduced cooldown for faster re-applications
  };

  const ERROR_HANDLING = {
    MAX_CONSECUTIVE_ERRORS: 3,
    ERROR_RECOVERY_DELAY: 5000,
    NETWORK_ERROR_RETRY_DELAY: 2000,
    NETWORK_ERROR_MAX_RETRIES: 2
  };
  
     const UI_CONFIG = {
         CONTAINER_POSITION: {
      position: 'absolute',
      top: '9px',
      left: '290px',
      width: 'auto',
      height: '30px'
    },
             CONTAINER_STYLE: {
      background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")',
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      border: '4px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 4 stretch',
      borderRadius: '4px',
      padding: '4px',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      fontSize: '11px',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px'
    },
    COLORS: {
      GOLD: '#ffd700',
      SILVER: '#c0c0c0',
      BRONZE: '#cd7f32',
      TICK_TITLE: '#87ceeb',
      RANK_TITLE: '#98fb98',
      MAP_HEADER: '#ffd700',
      SEPARATOR: '#555'
    },
    MEDAL_POSITIONS: {
      1: 'GOLD',
      2: 'SILVER', 
      3: 'BRONZE'
    }
  };

// =======================
// MODULE 2: State Management
// =======================
  const BetterHighscoresState = {
    // Core state
    leaderboardContainer: null,
    currentMapCode: null,
    roomNames: null,
    lastUpdateTime: 0,
    isUpdating: false,
    
    // Sandbox state preservation
    preservedContainer: null,
    wasInSandboxMode: false,
    
    // Board analysis detection
    isBoardAnalyzing: false,
    lastAnalysisCheck: 0,
    
    // Update throttling
    lastMapChangeTime: 0,
    lastContainerUpdateTime: 0,
    lastNoContainerLog: 0,
    
    // Error state
    consecutiveErrors: 0,
    lastErrorTime: 0,
    totalErrors: 0,
    
    // Cache state
    leaderboardCache: new Map(),
    cacheTimeout: 30000, // 30 seconds
    
    // Subscription management for cleanup
    subscriptions: [],
    
    // State validation
    validateState() {
      const errors = [];
      
      if (this.currentMapCode && typeof this.currentMapCode !== 'string') {
        errors.push('Invalid map code type');
      }
      
      return errors;
    },
    
    // State persistence
    saveToStorage() {
      try {
        const stateToSave = {
          currentMapCode: this.currentMapCode,
          lastUpdateTime: this.lastUpdateTime
        };
        localStorage.setItem('better_highscores_state', JSON.stringify(stateToSave));
      } catch (error) {
        console.warn('[Better Highscores] Failed to save state:', error);
      }
    },
    
    loadFromStorage() {
      try {
        const saved = localStorage.getItem('better_highscores_state');
        if (saved) {
          const state = JSON.parse(saved);
          
          if (state.currentMapCode) this.currentMapCode = state.currentMapCode;
          if (state.lastUpdateTime) this.lastUpdateTime = state.lastUpdateTime;
          
          log('[Better Highscores] State loaded from storage');
        }
      } catch (error) {
        console.warn('[Better Highscores] Failed to load state:', error);
      }
    },
    
    // State reset
    reset() {
      this.leaderboardContainer = null;
      this.currentMapCode = null;
      this.roomNames = null;
      this.lastUpdateTime = 0;
      this.isUpdating = false;
      this.preservedContainer = null;
      this.wasInSandboxMode = false;
      this.consecutiveErrors = 0;
      this.lastErrorTime = 0;
      this.totalErrors = 0;
      this.leaderboardCache.clear();
      this.subscriptions = [];
    },
    
    // State update with validation
    update(newState) {
      const oldState = { ...this };
      Object.assign(this, newState);
      
      const errors = this.validateState();
      if (errors.length > 0) {
        console.warn('[Better Highscores] State validation errors:', errors);
        Object.assign(this, oldState); // Revert on validation failure
        return false;
      }
      
      return true;
    }
  };
  
  // Legacy variable aliases for backward compatibility
  let leaderboardContainer = BetterHighscoresState.leaderboardContainer;
  let currentMapCode = BetterHighscoresState.currentMapCode;
  let roomNames = BetterHighscoresState.roomNames;

// =======================
// MODULE 3: DOM Cache Management
// =======================
  const DOMCache = {
    cache: new Map(),
    cacheTimeout: PERFORMANCE.DOM_CACHE_TIMEOUT,
    maxCacheSize: 50,

    get: function(selector, context = document) {
      const key = `${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.element;
      }
      
      const element = context.querySelector(selector);
      this.addToCache(key, element);
      return element;
    },

    getAll: function(selector, context = document) {
      const key = `all_${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.elements;
      }
      
      const elements = context.querySelectorAll(selector);
      this.addToCache(key, elements);
      return elements;
    },

    clear: function() {
      this.cache.clear();
    },

    clearSelector: function(selector) {
      for (const key of this.cache.keys()) {
        if (key.includes(selector)) {
          this.cache.delete(key);
        }
      }
    },

    manageCacheSize: function() {
      if (this.cache.size > this.maxCacheSize) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
        toRemove.forEach(([key]) => this.cache.delete(key));
      }
    },

    addToCache: function(key, element, timestamp = Date.now()) {
      this.cache.set(key, { element, timestamp });
      this.manageCacheSize();
    }
  };

// =======================
// MODULE 4: Error Handling
// =======================
  function handleError(error, context = 'unknown') {
    const now = Date.now();
    BetterHighscoresState.totalErrors++;
    BetterHighscoresState.lastErrorTime = now;
    BetterHighscoresState.consecutiveErrors++;
    
    console.error(`[Better Highscores] Error in ${context}:`, error);
    
    // Check if we should stop operations
    if (BetterHighscoresState.consecutiveErrors >= ERROR_HANDLING.MAX_CONSECUTIVE_ERRORS) {
      console.warn(`[Better Highscores] Stopping operations due to ${BetterHighscoresState.consecutiveErrors} consecutive errors`);
      return { shouldStop: true, reason: 'max_errors' };
    }
    
    return { shouldStop: false, reason: null };
  }
  
  function resetErrorState() {
    BetterHighscoresState.consecutiveErrors = 0;
  }
  
  function handleSuccess() {
    BetterHighscoresState.consecutiveErrors = 0;
  }

// =======================
// MODULE 5: API Functions
// =======================
  // Helper function to fetch data from TRPC API (same as Highscore_Improvements.js)
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
      console.error('[Better Highscores] Error fetching from TRPC:', error);
      throw error;
    }
  }

  // Function to get current map code using proper game state API
  function getCurrentMapCode() {
    try {
      // Method 1: Try to get from board state (most reliable)
      const boardState = globalThis.state?.board?.getSnapshot();
      if (boardState && boardState.context && boardState.context.selectedMap) {
        // Check different possible locations for the map ID
        const selectedMap = boardState.context.selectedMap;
        
        // Try selectedRoom.id first
        if (selectedMap.selectedRoom && selectedMap.selectedRoom.id) {
          return selectedMap.selectedRoom.id;
        }
        
        // Try selectedRegion.id as fallback
        if (selectedMap.selectedRegion && selectedMap.selectedRegion.id) {
          return selectedMap.selectedRegion.id;
        }
        
        // Try direct id property
        if (selectedMap.id) {
          return selectedMap.id;
        }
      }
      
      // Method 2: Try to get from game state
      const gameState = globalThis.state?.game?.getSnapshot();
      if (gameState && gameState.context && gameState.context.map) {
        return gameState.context.map;
      }
      
      // Method 3: Try to get from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const mapFromUrl = urlParams.get('map');
      if (mapFromUrl) {
        return mapFromUrl;
      }
      
      // Method 4: Try to get from current page context
      const currentPage = window.location.pathname;
      if (currentPage.includes('/room/')) {
        const pathParts = currentPage.split('/');
        const roomId = pathParts[pathParts.length - 1];
        if (roomId && roomId !== 'room') {
          return roomId;
        }
      }
      
      // Method 5: Try to get from page title or other DOM elements
      const pageTitle = document.title;
      
      // Method 6: Look for map indicators in the DOM
      const mapElements = document.querySelectorAll('[data-room], [data-map], .room-name, .map-name');
      
      return null;
    } catch (error) {
      console.error('[Better Highscores] Error getting current map code:', error);
      return null;
    }
  }

  // Function to fetch leaderboard data with caching
  async function fetchLeaderboardData(mapCode, forceRefresh = false) {
    const cacheKey = `leaderboard_${mapCode}`;
    const cached = BetterHighscoresState.leaderboardCache.get(cacheKey);
    
    if (!forceRefresh && cached && Date.now() - cached.timestamp < BetterHighscoresState.cacheTimeout) {
      return cached.data;
    }
    
         try {
       log('[Better Highscores] Fetching leaderboard data for map:', mapCode);
       
               // Both endpoints return the same data structure with both rank and tick data
        const leaderboardData = await fetchTRPC('game.getRoomsHighscores');
        
        log('[Better Highscores] Leaderboard response:', leaderboardData);
        
        // Extract data from the correct structure
        const tickData = leaderboardData?.ticks?.[mapCode] ? [leaderboardData.ticks[mapCode]] : [];
        const rankData = leaderboardData?.rank?.[mapCode] ? [leaderboardData.rank[mapCode]] : [];
        
        log('[Better Highscores] Extracted tick data for map', mapCode, ':', tickData);
        log('[Better Highscores] Extracted rank data for map', mapCode, ':', rankData);
        
        const data = {
          tickData,
          rankData
        };
      
      // Cache the data
      BetterHighscoresState.leaderboardCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      const errorResult = handleError(error, 'fetchLeaderboardData');
      if (errorResult.shouldStop) {
        throw new Error(`Failed to fetch leaderboard data: ${errorResult.reason}`);
      }
      throw error;
    }
  }

// =======================
// MODULE 6: Utility Functions
// =======================
  function getMainContainer() {
    // Clear cache to ensure we get the latest container
    DOMCache.clearSelector('.relative.z-0.select-none');
    DOMCache.clearSelector('[class*="relative"]');
    
    return DOMCache.get('.relative.z-0.select-none') || 
           DOMCache.get('[class*="relative"]') ||
           document.body;
  }

  function getMapName(mapCode) {
    // Use the proper game state API to get room names
    if (!roomNames) {
      roomNames = globalThis.state?.utils?.ROOM_NAME || {};
    }
    return roomNames[mapCode] || mapCode;
  }

  function isSandboxMode() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      return boardContext?.mode === 'sandbox';
    } catch (error) {
      console.warn('[Better Highscores] Error checking sandbox mode:', error);
      return false;
    }
  }

  // NEW: Function to detect autoplay mode
  function isAutoplayMode() {
    try {
      // Method 1: Check player flags for autoplay
      const playerSnapshot = globalThis.state?.player?.getSnapshot();
      if (playerSnapshot?.context?.flags) {
        const flags = new globalThis.state.utils.Flags(playerSnapshot.context.flags);
        if (flags.isSet("autoplay")) {
          return true;
        }
      }
      
      // Method 2: Check for autoplay UI elements
      const autoplayContainer = document.querySelector(".widget-bottom[data-minimized='false']");
      if (autoplayContainer) {
        return true;
      }
      
      // Method 3: Check for autoplay controls
      const autoplayControls = document.querySelector('[data-autoplay], .autoplay-controls, .autoplay-panel');
      if (autoplayControls) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('[Better Highscores] Error checking autoplay mode:', error);
      return false;
    }
  }

  function isBoardAnalyzing() {
    try {
      const now = Date.now();
      
      // Check if we should update the analysis state (every 500ms to avoid spam)
      if (now - BetterHighscoresState.lastAnalysisCheck > 500) {
        BetterHighscoresState.lastAnalysisCheck = now;
        
        // Look for board analysis indicators in the DOM
        const analysisIndicators = [
          'Run 1', 'Run 2', 'Run 3', 'Run 4', 'Run 5', 'Run 6', 'Run 7', 'Run 8', 'Run 9', 'Run 10',
          'Run 11', 'Run 12', 'Run 13', 'Run 14', 'Run 15', 'Run 16', 'Run 17', 'Run 18', 'Run 19', 'Run 20'
        ];
        
        const pageText = document.body.textContent || '';
        const isAnalyzing = analysisIndicators.some(indicator => pageText.includes(indicator));
        
        // NEW: Don't treat autoplay as board analysis
        if (isAutoplayMode() && isAnalyzing) {
          log('[Better Highscores] Autoplay mode detected, ignoring board analysis indicators');
          return false;
        }
        
        if (isAnalyzing !== BetterHighscoresState.isBoardAnalyzing) {
          const wasAnalyzing = BetterHighscoresState.isBoardAnalyzing;
          BetterHighscoresState.isBoardAnalyzing = isAnalyzing;
          
          if (isAnalyzing) {
            log('[Better Highscores] Board analysis detected, disabling updates');
          } else if (wasAnalyzing) {
            // Only log and restore if we were actually analyzing before
            log('[Better Highscores] Board analysis ended, re-enabling updates');
            
            // If we were analyzing and now we're not, restore the container if we have one
            if (BetterHighscoresState.preservedContainer) {
              log('[Better Highscores] Board analysis completed, restoring preserved container');
              setTimeout(() => {
                restoreContainer();
              }, 100);
            }
          }
        }
      }
      
      return BetterHighscoresState.isBoardAnalyzing;
    } catch (error) {
      console.warn('[Better Highscores] Error checking board analysis:', error);
      return false;
    }
  }

  // Function to preserve the current container when entering sandbox mode
  function preserveContainer() {
    if (leaderboardContainer && !BetterHighscoresState.preservedContainer) {
      log('[Better Highscores] Preserving container for sandbox mode');
      BetterHighscoresState.preservedContainer = leaderboardContainer.cloneNode(true);
      BetterHighscoresState.wasInSandboxMode = true;
      log('[Better Highscores] Container preserved successfully');
    } else if (!leaderboardContainer) {
      log('[Better Highscores] No container to preserve');
    } else if (BetterHighscoresState.preservedContainer) {
      log('[Better Highscores] Container already preserved');
    }
  }

  // Function to restore the preserved container when exiting sandbox mode
  function restoreContainer() {
    if (BetterHighscoresState.preservedContainer && BetterHighscoresState.wasInSandboxMode) {
      log('[Better Highscores] Restoring preserved container after sandbox mode');
      
      // Remove any existing containers first
      const existingContainers = document.querySelectorAll('.better-highscores-container');
      existingContainers.forEach(container => container.remove());
      
      // Restore the preserved container
      const restoredContainer = BetterHighscoresState.preservedContainer.cloneNode(true);
      const mainContainer = getMainContainer();
      
      if (mainContainer) {
        mainContainer.appendChild(restoredContainer);
        leaderboardContainer = restoredContainer;
        log('[Better Highscores] Container restored successfully');
      } else {
        log('[Better Highscores] Could not find main container for restoration');
      }
      
      // Clear preserved state
      BetterHighscoresState.preservedContainer = null;
      BetterHighscoresState.wasInSandboxMode = false;
      
      // Force update to ensure correct map data is displayed
      setTimeout(() => updateLeaderboards(), 100);
    } else if (BetterHighscoresState.preservedContainer) {
      // We have a preserved container but not in sandbox mode (probably from board analysis)
      log('[Better Highscores] Restoring preserved container from board analysis');
      
      // Remove any existing containers first
      const existingContainers = document.querySelectorAll('.better-highscores-container');
      existingContainers.forEach(container => container.remove());
      
      // Restore the preserved container
      const restoredContainer = BetterHighscoresState.preservedContainer.cloneNode(true);
      const mainContainer = getMainContainer();
      
      if (mainContainer) {
        mainContainer.appendChild(restoredContainer);
        leaderboardContainer = restoredContainer;
        log('[Better Highscores] Container restored successfully');
      } else {
        log('[Better Highscores] Could not find main container for restoration');
      }
      
      // Clear preserved state
      BetterHighscoresState.preservedContainer = null;
      
      // Force update to ensure correct map data is displayed after board analysis
      setTimeout(() => updateLeaderboards(), 100);
    } else {
      // Only log this once to avoid spam
      if (!BetterHighscoresState.lastNoContainerLog || Date.now() - BetterHighscoresState.lastNoContainerLog > 5000) {
        log('[Better Highscores] No preserved container to restore');
        BetterHighscoresState.lastNoContainerLog = Date.now();
      }
    }
  }

  function getMedalColor(position) {
    const medalType = UI_CONFIG.MEDAL_POSITIONS[position];
    return medalType ? UI_CONFIG.COLORS[medalType] : 'white';
  }

  function getMaxRankPoints() {
    try {
      // Get current map code
      const mapCode = getCurrentMapCode();
      if (!mapCode) {
        return null;
      }
      
      // Get room data from utils
      const rooms = globalThis.state.utils.ROOMS;
      if (!rooms) {
        return null;
      }
      
      // Find the current room by ID
      const currentRoom = rooms.find(room => room.id === mapCode);
      if (!currentRoom || !currentRoom.maxTeamSize) {
        return null;
      }
      
      // Calculate max rank points: rankPoints = (2 * maxTeamSize) - 1
      const maxRankPoints = (2 * currentRoom.maxTeamSize) - 1;
      
      return maxRankPoints;
    } catch (error) {
      console.error('[Better Highscores] Error calculating max rank points:', error);
      return null;
    }
  }

  function getUserBestScores() {
    try {
      // Get current map code
      const mapCode = getCurrentMapCode();
      if (!mapCode) {
        return null;
      }
      
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
      console.error('[Better Highscores] Error getting user best scores:', error);
      return null;
    }
  }

  function formatLeaderboardEntry(entry, index, isRankLeaderboard = false) {
    const medalColor = getMedalColor(index + 1);
    const isMedal = index < 3;
    
    // Check if this is the current user
    const playerSnapshot = globalThis.state.player.getSnapshot();
    const currentUserName = playerSnapshot?.context?.name;
    const isCurrentUser = currentUserName && entry.userName === currentUserName;
    
    let value = entry.ticks || entry.rank;
    if (isRankLeaderboard && entry.rank !== undefined) {
      value = `${entry.rank}`;
    }
    
    return {
      color: isCurrentUser ? '#00ff00' : medalColor, // Green for current user
      fontWeight: 'bold',
      text: `${isCurrentUser ? 'You' : 'Top:'}`,
      value: value
    };
  }

// =======================
// MODULE 7: UI Components & Rendering
// =======================
  // Function to create leaderboard display
  function createLeaderboardDisplay(tickData, rankData, mapName) {
    const container = document.createElement('div');
    container.className = 'better-highscores-container';
    
    // Apply container styles
    Object.assign(container.style, UI_CONFIG.CONTAINER_STYLE);
    Object.assign(container.style, UI_CONFIG.CONTAINER_POSITION);
    
    // Get current rank points record and max rank points
    const maxRankPoints = getMaxRankPoints();
    const currentRankRecord = rankData && rankData.length > 0 ? rankData[0].rank : null;
    
         // Create map name section
     const mapSection = document.createElement('div');
     Object.assign(mapSection.style, {
       fontWeight: 'bold',
       fontSize: '11px',
       color: UI_CONFIG.COLORS.MAP_HEADER,
       minWidth: 'auto',
       textAlign: 'left',
       wordSpacing: '-1px',
       lineHeight: '1.1'
     });
     
     let mapText = mapName || 'Unknown Map';
     if (maxRankPoints && currentRankRecord) {
       const isMaxRankAchieved = currentRankRecord === maxRankPoints;
       const rankPointsColor = isMaxRankAchieved ? '#00ff00' : '#ff4444';
       mapSection.innerHTML = `${mapName || 'Unknown Map'} <span style="color: ${rankPointsColor}">(${currentRankRecord}/${maxRankPoints})</span>`;
     } else {
       mapSection.textContent = mapText;
     }
    
         // Create tick leaderboard section
     const tickSection = document.createElement('div');
     Object.assign(tickSection.style, {
       display: 'flex',
       alignItems: 'center',
       gap: '8px',
       minWidth: 'auto'
     });
     
     if (tickData && tickData.length > 0) {
       const tickTitle = document.createElement('span');
       Object.assign(tickTitle.style, {
         fontWeight: 'bold',
         color: UI_CONFIG.COLORS.TICK_TITLE,
         fontSize: '10px'
       });
       tickTitle.textContent = 'Ticks';
       tickSection.appendChild(tickTitle);
       
       // Show top tick entry
       tickData.slice(0, 1).forEach((entry, index) => {
         const formattedEntry = formatLeaderboardEntry(entry, index, false);
         const entrySpan = document.createElement('span');
         Object.assign(entrySpan.style, {
           fontSize: '10px',
           color: formattedEntry.color,
           fontWeight: formattedEntry.fontWeight,
           marginRight: '4px'
         });
         entrySpan.textContent = `${formattedEntry.text} ${formattedEntry.value}`;
         tickSection.appendChild(entrySpan);
       });
       
       // Add user's best tick (only if user doesn't hold the world record)
       const userScores = getUserBestScores();
       const playerSnapshot = globalThis.state.player.getSnapshot();
       const currentUserName = playerSnapshot?.context?.name;
       const userHoldsWorldRecord = tickData.length > 0 && tickData[0].userName === currentUserName;
       const userTiesWorldRecord = tickData.length > 0 && userScores && userScores.bestTicks === tickData[0].ticks;
       
       if (userScores && userScores.bestTicks && !userHoldsWorldRecord) {
         const userEntrySpan = document.createElement('span');
         Object.assign(userEntrySpan.style, {
           fontSize: '10px',
           color: userTiesWorldRecord ? '#00ff00' : '#ffa500', // Green if ties world record, orange otherwise
           fontWeight: 'bold',
           marginRight: '4px'
         });
         userEntrySpan.textContent = `You: ${userScores.bestTicks}`;
         tickSection.appendChild(userEntrySpan);
       }
     }
    
         // Create rank leaderboard section
     const rankSection = document.createElement('div');
     Object.assign(rankSection.style, {
       display: 'flex',
       alignItems: 'center',
       gap: '8px',
       minWidth: 'auto'
     });
     
     if (rankData && rankData.length > 0) {
       const rankTitle = document.createElement('span');
       Object.assign(rankTitle.style, {
         fontWeight: 'bold',
         color: UI_CONFIG.COLORS.RANK_TITLE,
         fontSize: '10px'
       });
       rankTitle.textContent = 'Rank';
       rankSection.appendChild(rankTitle);
       
       // Show top rank entry
       rankData.slice(0, 1).forEach((entry, index) => {
         const formattedEntry = formatLeaderboardEntry(entry, index, true);
         const entrySpan = document.createElement('span');
         Object.assign(entrySpan.style, {
           fontSize: '10px',
           color: formattedEntry.color,
           fontWeight: formattedEntry.fontWeight,
           marginRight: '4px'
         });
         entrySpan.textContent = `${formattedEntry.text} ${formattedEntry.value}`;
         rankSection.appendChild(entrySpan);
       });
       
       // Add user's best rank (only if user doesn't hold the world record)
       const userScores = getUserBestScores();
       const playerSnapshot = globalThis.state.player.getSnapshot();
       const currentUserName = playerSnapshot?.context?.name;
       const userHoldsWorldRecord = rankData.length > 0 && rankData[0].userName === currentUserName;
       const userTiesWorldRecord = rankData.length > 0 && userScores && userScores.bestRank === rankData[0].rank;
       
       if (userScores && userScores.bestRank && !userHoldsWorldRecord) {
         const userEntrySpan = document.createElement('span');
         Object.assign(userEntrySpan.style, {
           fontSize: '10px',
           color: userTiesWorldRecord ? '#00ff00' : '#ffa500', // Green if ties world record, orange otherwise
           fontWeight: 'bold',
           marginRight: '4px'
         });
         userEntrySpan.textContent = `You: ${userScores.bestRank}`;
         rankSection.appendChild(userEntrySpan);
       }
     }
    
    // Append all sections to container
    container.appendChild(mapSection);
    container.appendChild(tickSection);
    container.appendChild(rankSection);
    
    return container;
  }



  // Function to update leaderboards
  async function updateLeaderboards() {
    log('[Better Highscores] updateLeaderboards called');
    
    // Don't update if we're already updating
    if (BetterHighscoresState.isUpdating) {
      log('[Better Highscores] Update already in progress, skipping');
      return;
    }
    
    // Skip updates during board analysis to prevent spam
    if (isBoardAnalyzing()) {
      log('[Better Highscores] Board analysis in progress, skipping update');
      return;
    }
    
    const currentlyInSandbox = isSandboxMode();
    const currentlyInAutoplay = isAutoplayMode();
    
    // Handle sandbox mode entry (preserve container when first entering)
    if (currentlyInSandbox && !BetterHighscoresState.wasInSandboxMode) {
      log('[Better Highscores] Just entered sandbox mode, preserving container');
      preserveContainer();
    }

    try {
      BetterHighscoresState.isUpdating = true;
      
      const mapCode = getCurrentMapCode();
      log('[Better Highscores] Detected map code:', mapCode);
      
      if (!mapCode) {
        log('[Better Highscores] No current map code found');
        return;
      }
      
      // NEW: More lenient throttling for autoplay mode
      const now = Date.now();
      const throttleDelay = currentlyInAutoplay ? 100 : PERFORMANCE.REFRESH_COOLDOWN;
      
      if (mapCode === currentMapCode && 
          leaderboardContainer && 
          now - BetterHighscoresState.lastUpdateTime < throttleDelay) {
        log('[Better Highscores] Skipping update - same map and recent data');
        return;
      }
      
      currentMapCode = mapCode;
      BetterHighscoresState.lastUpdateTime = now;
      
      const mapName = getMapName(mapCode);
      
      // Fetch leaderboard data
      const { tickData, rankData } = await fetchLeaderboardData(mapCode, false);
      
      // Remove existing container and any duplicate containers
      if (leaderboardContainer) {
        leaderboardContainer.remove();
        leaderboardContainer = null;
      }
      
      // Also remove any other containers with the same class to prevent duplicates
      const existingContainers = document.querySelectorAll('.better-highscores-container');
      if (existingContainers.length > 0) {
        log(`[Better Highscores] Removing ${existingContainers.length} existing containers`);
        existingContainers.forEach(container => container.remove());
      }
      
      // Create new container
      leaderboardContainer = createLeaderboardDisplay(tickData, rankData, mapName);
      log('[Better Highscores] Created leaderboard container:', leaderboardContainer);
      
      // Find the main game container and append
      const mainContainer = getMainContainer();
      log('[Better Highscores] Main container found:', mainContainer);
      
      if (mainContainer) {
        log('[Better Highscores] Appending leaderboard container to main container');
        mainContainer.appendChild(leaderboardContainer);
        log('[Better Highscores] Leaderboard container appended successfully');
      } else {
        console.error('[Better Highscores] Could not find main container for leaderboard injection');
      }
      
      log(`[Better Highscores] Updated leaderboards for map: ${mapName} (${mapCode})`);
      
      // Success - reset error state
      handleSuccess();
      
    } catch (error) {
      const errorResult = handleError(error, 'updateLeaderboards');
      
      if (errorResult.shouldStop) {
        console.warn(`[Better Highscores] Stopping leaderboard updates: ${errorResult.reason}`);
        return;
      }
      
      // For recoverable errors, log and continue
      console.warn('[Better Highscores] Recoverable error occurred:', error.message);
    } finally {
      BetterHighscoresState.isUpdating = false;
    }
  }

// =======================
// MODULE 8: Initialization & Cleanup
// =======================
  // Function to initialize the mod
  function initBetterHighscores() {
    console.log('[Better Highscores] Initializing version 1.0.0');
    
    // Load saved state from storage
    BetterHighscoresState.loadFromStorage();
    
    // Wait for game state to be available
    const checkGameState = () => {
      if (globalThis.state && globalThis.state.board) {
        // Initial update
        updateLeaderboards();
        
                 // Set up observer for map changes using board state
         const boardState = globalThis.state.board;
         const boardUnsubscribe = boardState.subscribe((state) => {
           // Skip updates during board analysis to prevent spam
           if (isBoardAnalyzing()) {
             return;
           }
           
           // Always check for map changes on every board state update
           const detectedMapCode = getCurrentMapCode();
           
           if (detectedMapCode && detectedMapCode !== currentMapCode) {
             const now = Date.now();
             
             // Throttle map change updates to prevent spam
             if (now - BetterHighscoresState.lastMapChangeTime < 1000) {
               log(`[Better Highscores] Map change throttled: ${currentMapCode} to ${detectedMapCode}`);
               return;
             }
             
             log(`[Better Highscores] Map changed from ${currentMapCode} to ${detectedMapCode}`);
             BetterHighscoresState.lastMapChangeTime = now;
             
             // Update the current map code even in sandbox mode
             currentMapCode = detectedMapCode;
             
             // Update the display regardless of sandbox mode
             updateLeaderboards();
           }
           
           // Check for sandbox mode changes
           const currentMode = state.context?.mode;
           const wasInSandbox = BetterHighscoresState.wasInSandboxMode;
           const isInSandbox = currentMode === 'sandbox';
           
           if (isInSandbox && !wasInSandbox) {
             // Just entered sandbox mode
             log('[Better Highscores] Entered sandbox mode, preserving container');
             preserveContainer();
           } else if (!isInSandbox && wasInSandbox) {
             // Just exited sandbox mode
             log('[Better Highscores] Exited sandbox mode');
             
             // Always update leaderboards when exiting sandbox mode
             // The currentMapCode should already be updated from the map change detection above
             log('[Better Highscores] Exiting sandbox mode, updating leaderboards with current map');
             BetterHighscoresState.preservedContainer = null;
             BetterHighscoresState.wasInSandboxMode = false;
             updateLeaderboards();
           }
           
           // Check if the main container has changed (board re-render)
           const mainContainer = getMainContainer();
           if (mainContainer && (!leaderboardContainer || !mainContainer.contains(leaderboardContainer))) {
             const now = Date.now();
             
             // NEW: More lenient throttling for autoplay mode
             const throttleDelay = isAutoplayMode() ? 200 : 500;
             
             // Throttle container updates to prevent spam
             if (now - BetterHighscoresState.lastContainerUpdateTime < throttleDelay) {
               log('[Better Highscores] Container update throttled');
               return;
             }
             
             // Skip container re-application if in sandbox mode
             if (isSandboxMode()) {
               log('[Better Highscores] Main container changed in sandbox mode, skipping leaderboard re-application');
               return;
             }
             
             log('[Better Highscores] Main container changed, re-applying leaderboard');
             BetterHighscoresState.lastContainerUpdateTime = now;
             // Immediate re-application for fastest response
             updateLeaderboards();
           }
         });
         
         // Store subscription for cleanup
         BetterHighscoresState.subscriptions.push(boardUnsubscribe);
        
                // Also listen for game state changes as backup
        if (globalThis.state.game) {
          const gameUnsubscribe = globalThis.state.game.subscribe((state) => {
            // Skip updates during board analysis to prevent spam
            if (isBoardAnalyzing()) {
              return;
            }
            
            // Always check for map changes on every game state update
            const detectedMapCode = getCurrentMapCode();
            
            if (detectedMapCode && detectedMapCode !== currentMapCode) {
              const now = Date.now();
              
              // Throttle map change updates to prevent spam
              if (now - BetterHighscoresState.lastMapChangeTime < 1000) {
                log(`[Better Highscores] Game map change throttled: ${currentMapCode} to ${detectedMapCode}`);
                return;
              }
              
              log(`[Better Highscores] Game map changed from ${currentMapCode} to ${detectedMapCode}`);
              BetterHighscoresState.lastMapChangeTime = now;
              
              // Update the current map code even in sandbox mode
              currentMapCode = detectedMapCode;
              
              // Update the display regardless of sandbox mode
              updateLeaderboards();
            }
            
            // Check if the main container has changed (game re-render)
            const mainContainer = getMainContainer();
            if (mainContainer && (!leaderboardContainer || !mainContainer.contains(leaderboardContainer))) {
              const now = Date.now();
              
              // NEW: More lenient throttling for autoplay mode
              const throttleDelay = isAutoplayMode() ? 200 : 500;
              
              // Throttle container updates to prevent spam
              if (now - BetterHighscoresState.lastContainerUpdateTime < throttleDelay) {
                log('[Better Highscores] Game container update throttled');
                return;
              }
              
              // Skip container re-application if in sandbox mode
              if (isSandboxMode()) {
                log('[Better Highscores] Main container changed (game state) in sandbox mode, skipping leaderboard re-application');
                return;
              }
              
              log('[Better Highscores] Main container changed (game state), re-applying leaderboard');
              BetterHighscoresState.lastContainerUpdateTime = now;
              // Immediate re-application for fastest response
              updateLeaderboards();
            }
          });
          
          // Store subscription for cleanup
          BetterHighscoresState.subscriptions.push(gameUnsubscribe);
        }
        
                 // Listen for game timer changes to detect battle completion
         if (globalThis.state.gameTimer) {
           let previousState = 'initial';
           
           const gameTimerUnsubscribe = globalThis.state.gameTimer.subscribe((state) => {
             const { currentTick, gameState } = state.context;
             const currentState = state.context.state;
             
             // Skip updates during board analysis to prevent spam and preserve container
             if (isBoardAnalyzing()) {
               return;
             }
             
             // Check if game just ended (state changed from 'playing' to 'victory'/'defeat')
             if (currentState !== 'initial' && currentState !== 'playing') {
               // Handle sandbox mode battle completion
               if (isSandboxMode()) {
                 log('[Better Highscores] Battle completed in sandbox mode, restoring container');
                 
                 // Small delay to ensure game state is fully updated
                 setTimeout(() => {
                   restoreContainer();
                 }, 100);
                 return;
               }
               
               // NEW: Handle autoplay mode battle completion
               if (isAutoplayMode()) {
                 log('[Better Highscores] Battle completed in autoplay mode, ensuring leaderboard is visible');
                 
                 // Small delay to ensure game state is fully updated
                 setTimeout(() => {
                   // Check if leaderboard is missing and restore it
                   if (!leaderboardContainer || !document.contains(leaderboardContainer)) {
                     log('[Better Highscores] Leaderboard missing after autoplay battle, restoring');
                     updateLeaderboards();
                   } else {
                     // Just refresh the data
                     log('[Better Highscores] Refreshing leaderboard data after autoplay battle');
                     updateLeaderboards();
                   }
                 }, 200);
                 return;
               }
               
               log('[Better Highscores] Battle completed, refreshing leaderboard data');
               
               // Force refresh with fresh data
               setTimeout(async () => {
                 const mapCode = getCurrentMapCode();
                 if (mapCode) {
                   try {
                     const { tickData, rankData } = await fetchLeaderboardData(mapCode, true);
                     
                     // Update the existing container if it exists
                     if (leaderboardContainer) {
                       const mapName = getMapName(mapCode);
                       const newContainer = createLeaderboardDisplay(tickData, rankData, mapName);
                       
                       // Replace the old container with the new one
                       leaderboardContainer.replaceWith(newContainer);
                       leaderboardContainer = newContainer;
                       
                       log('[Better Highscores] Leaderboard updated with fresh battle data');
                     }
                   } catch (error) {
                     console.warn('[Better Highscores] Failed to refresh leaderboard after battle:', error);
                   }
                 }
               }, 500); // Small delay to ensure game state is fully updated
             }
             
             // NEW: Detect transition from 'playing' to 'initial' (sandbox game ended)
             if (previousState === 'playing' && currentState === 'initial' && isSandboxMode()) {
               log('[Better Highscores] Sandbox game ended, restoring container');
               
               // Small delay to ensure game state is fully updated
               setTimeout(() => {
                 restoreContainer();
               }, 100);
             }
             
             // NEW: Detect transition from 'initial' to 'playing' (sandbox game started)
             if (previousState === 'initial' && currentState === 'playing' && isSandboxMode()) {
               log('[Better Highscores] Sandbox game started, preserving container');
               
               // Small delay to ensure game state is fully updated
               setTimeout(() => {
                 preserveContainer();
               }, 100);
             }
             
             // NEW: Detect transition from 'playing' to 'initial' (autoplay game ended)
             if (previousState === 'playing' && currentState === 'initial' && isAutoplayMode()) {
               log('[Better Highscores] Autoplay game ended, ensuring leaderboard is visible');
               
               // Small delay to ensure game state is fully updated
               setTimeout(() => {
                 // Check if leaderboard is missing and restore it
                 if (!leaderboardContainer || !document.contains(leaderboardContainer)) {
                   log('[Better Highscores] Leaderboard missing after autoplay game ended, restoring');
                   updateLeaderboards();
                 } else {
                   // Just refresh the data
                   log('[Better Highscores] Refreshing leaderboard data after autoplay game ended');
                   updateLeaderboards();
                 }
               }, 200);
             }
             
             // NEW: Detect transition from 'initial' to 'playing' (autoplay game started)
             if (previousState === 'initial' && currentState === 'playing' && isAutoplayMode()) {
               log('[Better Highscores] Autoplay game started, ensuring leaderboard is visible');
               
               // Small delay to ensure game state is fully updated
               setTimeout(() => {
                 // Ensure leaderboard is visible when autoplay starts
                 if (!leaderboardContainer || !document.contains(leaderboardContainer)) {
                   log('[Better Highscores] Leaderboard missing when autoplay started, restoring');
                   updateLeaderboards();
                 }
               }, 200);
             }
             
             previousState = currentState;
           });
           
           // Store subscription for cleanup
           BetterHighscoresState.subscriptions.push(gameTimerUnsubscribe);
         }
        
        // NEW: Set up periodic check for autoplay mode to ensure leaderboard stays visible
        window.betterHighscoresInterval = setInterval(() => {
          if (isAutoplayMode() && (!leaderboardContainer || !document.contains(leaderboardContainer))) {
            log('[Better Highscores] Periodic check: Leaderboard missing in autoplay mode, restoring');
            updateLeaderboards();
          }
        }, 5000); // Check every 5 seconds
        
        // NEW: Set up MutationObserver to detect when leaderboard gets removed from DOM
        window.betterHighscoresObserver = new MutationObserver((mutations) => {
          if (!isAutoplayMode()) return;
          
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              for (const removedNode of mutation.removedNodes) {
                if (removedNode === leaderboardContainer || 
                    (removedNode.nodeType === Node.ELEMENT_NODE && 
                     removedNode.contains && removedNode.contains(leaderboardContainer))) {
                  log('[Better Highscores] Leaderboard removed from DOM during autoplay, restoring');
                  setTimeout(() => {
                    updateLeaderboards();
                  }, 100);
                  break;
                }
              }
            }
          }
        });
        
        // Observe the document body for leaderboard removal
        window.betterHighscoresObserver.observe(document.body, { 
          childList: true, 
          subtree: true 
        });
        
        log('[Better Highscores] Initialization complete');
      } else {
        // Retry after a short delay
        setTimeout(checkGameState, 1000);
      }
    };
    
    checkGameState();
    
    return {
      name: context.modName,
      version: context.modVersion,
      description: context.modDescription,
      status: 'active'
    };
  }

  function cleanup() {
    log('[Better Highscores] Cleaning up...');
    
    // Remove leaderboard container
    if (leaderboardContainer) {
      try {
        leaderboardContainer.remove();
      } catch (error) {
        console.warn('[Better Highscores] Error removing leaderboard container:', error);
      }
    }
    
    // Clean up state subscriptions
    BetterHighscoresState.subscriptions.forEach(unsubscribe => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        console.warn('[Better Highscores] Error unsubscribing:', error);
      }
    });
    
    // Reset state
    BetterHighscoresState.reset();
    
    // Clear caches
    DOMCache.clear();
    BetterHighscoresState.leaderboardCache.clear();
    
    // Clean up observers and intervals
    if (window.betterHighscoresInterval) {
      clearInterval(window.betterHighscoresInterval);
      window.betterHighscoresInterval = null;
    }
    
    if (window.betterHighscoresObserver) {
      window.betterHighscoresObserver.disconnect();
      window.betterHighscoresObserver = null;
    }
    
    // Clean up global window object
    if (window.BetterHighscores) {
      delete window.BetterHighscores;
    }
    
    log('[Better Highscores] Cleanup complete');
  }

  // =======================
  // MODULE INITIALIZATION
  // =======================
  function initializeBetterHighscores() {
    log('[Better Highscores] Starting initialization...');
    
    if (config.enabled) {
      initBetterHighscores();
    } else {
      log('[Better Highscores] Disabled in configuration');
    }
  }
  
  // Start initialization
  initializeBetterHighscores();
  
  // Export control functions
  if (typeof exports !== 'undefined') {
    exports.cleanup = cleanup;
    exports.updateLeaderboards = updateLeaderboards;
    exports.restoreContainer = restoreContainer;
    exports.preserveContainer = preserveContainer;
    exports.modName = context.modName;
    exports.modVersion = context.modVersion;
  }
  
  if (typeof window !== 'undefined') {
    window.BetterHighscores = window.BetterHighscores || {};
    window.BetterHighscores.cleanup = cleanup;
    window.BetterHighscores.updateLeaderboards = updateLeaderboards;
    window.BetterHighscores.restoreContainer = restoreContainer;
    window.BetterHighscores.preserveContainer = preserveContainer;
    window.BetterHighscores.debug = {
      getCurrentMapCode: getCurrentMapCode,
      getMapName: getMapName,
      getMainContainer: getMainContainer,
      isSandboxMode: isSandboxMode,
      forceUpdate: () => {
        log('[Better Highscores] Force update triggered');
        updateLeaderboards();
      },
      forceRestore: () => {
        log('[Better Highscores] Force restore triggered');
        restoreContainer();
      },
      forcePreserve: () => {
        log('[Better Highscores] Force preserve triggered');
        preserveContainer();
      },
      getState: () => {
        return {
          leaderboardContainer: !!leaderboardContainer,
          preservedContainer: !!BetterHighscoresState.preservedContainer,
          wasInSandboxMode: BetterHighscoresState.wasInSandboxMode,
          isSandboxMode: isSandboxMode(),
          isBoardAnalyzing: isBoardAnalyzing(),
          currentMapCode: currentMapCode,
          detectedMapCode: getCurrentMapCode()
        };
      },
      debugMapDetection: () => {
        console.log('[Better Highscores] Debug map detection:');
        console.log('- Current map code:', currentMapCode);
        console.log('- Detected map code:', getCurrentMapCode());
        console.log('- Board state:', globalThis.state?.board?.getSnapshot());
        console.log('- Game state:', globalThis.state?.game?.getSnapshot());
        console.log('- URL:', window.location.href);
        console.log('- Pathname:', window.location.pathname);
        console.log('- Search params:', window.location.search);
      },
      debugAutoplay: () => {
        console.log('[Better Highscores] Debug autoplay detection:');
        console.log('- Is autoplay mode:', isAutoplayMode());
        console.log('- Is sandbox mode:', isSandboxMode());
        console.log('- Is board analyzing:', isBoardAnalyzing());
        console.log('- Player flags:', globalThis.state?.player?.getSnapshot()?.context?.flags);
        console.log('- Autoplay container:', !!document.querySelector(".widget-bottom[data-minimized='false']"));
        console.log('- Autoplay controls:', !!document.querySelector('[data-autoplay], .autoplay-controls, .autoplay-panel'));
        console.log('- Leaderboard container exists:', !!leaderboardContainer);
        console.log('- Preserved container exists:', !!BetterHighscoresState.preservedContainer);
        console.log('- Leaderboard in DOM:', !!document.contains(leaderboardContainer));
        console.log('- Periodic check interval:', !!window.betterHighscoresInterval);
        console.log('- DOM observer:', !!window.betterHighscoresObserver);
      },
      forceRestoreAutoplay: () => {
        console.log('[Better Highscores] Force restoring leaderboard for autoplay');
        if (isAutoplayMode()) {
          updateLeaderboards();
        } else {
          console.log('[Better Highscores] Not in autoplay mode');
        }
      }
    };
  }

})(); 
