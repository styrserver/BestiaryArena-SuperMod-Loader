// =======================
// Better Highscores.js - Bestiary Arena Leaderboard Display Mod
// =======================
(function() {

// =======================
// MODULE 1: Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  const DELAYS = {
    RESTORE: 100,
    UPDATE: 200,
    BATTLE_REFRESH: 500,
    MUTATION_RESTORE: 50,
    RETRY: 1000,
    MAP_CHANGE_THROTTLE: 1000,
    CONTAINER_THROTTLE_NORMAL: 500,
    CONTAINER_THROTTLE_AUTOPLAY: 200,
    UPDATE_THROTTLE: 100
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
    lastUpdateTime: 0,
    isUpdating: false,
    
    // Sandbox state preservation
    preservedContainer: null,
    wasInSandboxMode: false,
    
    // Board analysis detection
    isBoardAnalyzing: false,
    
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
    
    // Timeout tracking for cleanup
    timeouts: [],
    
    // State reset
    reset() {
      this.lastUpdateTime = 0;
      this.isUpdating = false;
      this.preservedContainer = null;
      this.wasInSandboxMode = false;
      this.consecutiveErrors = 0;
      this.lastErrorTime = 0;
      this.totalErrors = 0;
      this.leaderboardCache.clear();
      this.subscriptions = [];
      this.timeouts = [];
    },
    
    // Helper function to track timeouts for cleanup
    trackTimeout(timeoutId) {
      this.timeouts.push(timeoutId);
      return timeoutId;
    },
    
    // Helper function to clear all tracked timeouts
    clearTimeouts() {
      this.timeouts.forEach(id => clearTimeout(id));
      this.timeouts = [];
    }
  };
  
  // Local variables for state access
  let leaderboardContainer = null;
  let currentMapCode = null;
  let roomNames = null;
  
  // Helper function to schedule a timeout and track it for cleanup
  function scheduleTimeout(fn, delay) {
    return BetterHighscoresState.trackTimeout(setTimeout(fn, delay));
  }
  
  // Helper function to remove all leaderboard containers from DOM
  function removeExistingContainers() {
    const existingContainers = document.querySelectorAll('.better-highscores-container');
    existingContainers.forEach(container => container.remove());
    return existingContainers.length;
  }
  
  // Helper function to check if action should be throttled
  function shouldThrottle(lastTime, delay) {
    return Date.now() - lastTime < delay;
  }
  
  // Helper function to get player snapshot
  function getPlayerSnapshot() {
    try {
      return globalThis.state?.player?.getSnapshot();
    } catch (error) {
      console.warn('[Better Highscores] Error getting player snapshot:', error);
      return null;
    }
  }

// =======================
// MODULE 3: Error Handling
// =======================
  function handleError(error, context = 'unknown') {
    const now = Date.now();
    BetterHighscoresState.totalErrors++;
    BetterHighscoresState.lastErrorTime = now;
    BetterHighscoresState.consecutiveErrors++;
    
    console.error(`[Better Highscores] Error in ${context}:`, error);
    
    // Check if we should stop operations
    if (BetterHighscoresState.consecutiveErrors >= 3) {
      console.warn(`[Better Highscores] Stopping operations due to ${BetterHighscoresState.consecutiveErrors} consecutive errors`);
      return { shouldStop: true, reason: 'max_errors' };
    }
    
    return { shouldStop: false, reason: null };
  }
  
  function handleSuccess() {
    BetterHighscoresState.consecutiveErrors = 0;
  }

// =======================
// MODULE 4: API Functions
// =======================
  // Helper function to fetch data from TRPC API
  async function fetchTRPC(method) {
    console.log(`[Better Highscores] 🌐 API REQUEST: ${method}`);
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
      console.log('[Better Highscores] Fetching leaderboard data for map:', mapCode);
      
      const leaderboardData = await fetchTRPC('game.getRoomsHighscores');
      
      console.log('[Better Highscores] Leaderboard response:', leaderboardData);
      
      // Extract data from the correct structure
      const tickData = leaderboardData?.ticks?.[mapCode] ? [leaderboardData.ticks[mapCode]] : [];
      const rankData = leaderboardData?.rank?.[mapCode] ? [leaderboardData.rank[mapCode]] : [];
      
      console.log('[Better Highscores] Extracted tick data for map', mapCode, ':', tickData);
      console.log('[Better Highscores] Extracted rank data for map', mapCode, ':', rankData);
      
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
// MODULE 5: Utility Functions
// =======================
  // Helper to handle state transitions
  function handleStateTransition(previousState, currentState) {
    // Detect playing -> initial transitions
    if (previousState === 'playing' && currentState === 'initial') {
      if (isSandboxMode()) {
        console.log('[Better Highscores] Sandbox game ended, restoring container');
        scheduleTimeout(() => restoreContainer(), DELAYS.RESTORE);
      } else if (isAutoplayMode()) {
        console.log('[Better Highscores] Autoplay game ended, ensuring leaderboard is visible');
        scheduleTimeout(() => updateLeaderboards(), DELAYS.UPDATE);
      }
    }
    
    // Detect initial -> playing transitions
    if (previousState === 'initial' && currentState === 'playing') {
      if (isSandboxMode()) {
        console.log('[Better Highscores] Sandbox game started, preserving container');
        scheduleTimeout(() => preserveContainer(), DELAYS.RESTORE);
      } else if (isAutoplayMode()) {
        console.log('[Better Highscores] Autoplay game started, ensuring leaderboard is visible');
        scheduleTimeout(() => {
          if (!leaderboardContainer || !document.contains(leaderboardContainer)) {
            console.log('[Better Highscores] Leaderboard missing when autoplay started, restoring');
            updateLeaderboards();
          }
        }, DELAYS.UPDATE);
      }
    }
  }
  
  // Helper to handle battle completion (victory/defeat states)
  async function handleBattleCompletion() {
    if (isSandboxMode()) {
      console.log('[Better Highscores] Battle completed in sandbox mode, restoring container');
      scheduleTimeout(() => restoreContainer(), DELAYS.RESTORE);
      return;
    }
    
    if (isAutoplayMode()) {
      console.log('[Better Highscores] Battle completed in autoplay mode, ensuring leaderboard is visible');
      scheduleTimeout(() => updateLeaderboards(), DELAYS.UPDATE);
      return;
    }
    
    console.log('[Better Highscores] Battle completed, refreshing leaderboard data');
    scheduleTimeout(async () => {
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
            
            console.log('[Better Highscores] Leaderboard updated with fresh battle data');
          }
        } catch (error) {
          console.warn('[Better Highscores] Failed to refresh leaderboard after battle:', error);
        }
      }
    }, DELAYS.BATTLE_REFRESH);
  }

  // Shared handler for map changes and container updates
  function handleStateUpdate(detectedMapCode, mainContainer) {
    // Handle map changes
    if (detectedMapCode && detectedMapCode !== currentMapCode) {
      // Throttle map change updates to prevent spam
      if (shouldThrottle(BetterHighscoresState.lastMapChangeTime, DELAYS.MAP_CHANGE_THROTTLE)) {
        console.log(`[Better Highscores] Map change throttled: ${currentMapCode} to ${detectedMapCode}`);
        return;
      }
      
      console.log(`[Better Highscores] Map changed from ${currentMapCode} to ${detectedMapCode}`);
      BetterHighscoresState.lastMapChangeTime = Date.now();
      
      // Update the current map code even in sandbox mode
      currentMapCode = detectedMapCode;
      
      // Update the display regardless of sandbox mode
      updateLeaderboards();
    }
    
    // Handle container updates
    if (mainContainer && (!leaderboardContainer || !mainContainer.contains(leaderboardContainer))) {
      // More lenient throttling for autoplay mode
      const throttleDelay = isAutoplayMode() ? DELAYS.CONTAINER_THROTTLE_AUTOPLAY : DELAYS.CONTAINER_THROTTLE_NORMAL;
      
      // Throttle container updates to prevent spam
      if (shouldThrottle(BetterHighscoresState.lastContainerUpdateTime, throttleDelay)) {
        console.log('[Better Highscores] Container update throttled');
        return;
      }
      
      // Skip container re-application if in sandbox mode
      if (isSandboxMode()) {
        console.log('[Better Highscores] Main container changed in sandbox mode, skipping leaderboard re-application');
        return;
      }
      
      console.log('[Better Highscores] Main container changed, re-applying leaderboard');
      BetterHighscoresState.lastContainerUpdateTime = Date.now();
      // Immediate re-application for fastest response
      updateLeaderboards();
    }
  }

  function getMainContainer() {
    return document.querySelector('.relative.z-0.select-none') || 
           document.querySelector('[class*="relative"]') ||
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

  function isAutoplayMode() {
    try {
      // Method 1: Check player flags for autoplay
      const playerSnapshot = getPlayerSnapshot();
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
      // Use the global coordination flag set by Board Analyzer
      const isAnalyzing = window.__modCoordination?.boardAnalyzerRunning || false;
      
      // Track state changes and trigger restore when analysis ends
      if (isAnalyzing !== BetterHighscoresState.isBoardAnalyzing) {
        const wasAnalyzing = BetterHighscoresState.isBoardAnalyzing;
        BetterHighscoresState.isBoardAnalyzing = isAnalyzing;
        
        if (isAnalyzing) {
          console.log('[Better Highscores] Board analysis detected, disabling updates');
        } else if (wasAnalyzing) {
          console.log('[Better Highscores] Board analysis ended, re-enabling updates');
          
          // Restore container if we have one preserved
          if (BetterHighscoresState.preservedContainer) {
            console.log('[Better Highscores] Board analysis completed, restoring preserved container');
            scheduleTimeout(() => {
              restoreContainer();
            }, DELAYS.RESTORE);
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
      console.log('[Better Highscores] Preserving container for sandbox mode');
      BetterHighscoresState.preservedContainer = leaderboardContainer.cloneNode(true);
      BetterHighscoresState.wasInSandboxMode = true;
      console.log('[Better Highscores] Container preserved successfully');
    } else if (!leaderboardContainer) {
      console.log('[Better Highscores] No container to preserve');
    } else if (BetterHighscoresState.preservedContainer) {
      console.log('[Better Highscores] Container already preserved');
    }
  }

  // Function to restore the preserved container when exiting sandbox mode
  function restoreContainer() {
    if (!BetterHighscoresState.preservedContainer) {
      // Only log this once to avoid spam
      if (!BetterHighscoresState.lastNoContainerLog || Date.now() - BetterHighscoresState.lastNoContainerLog > 5000) {
        console.log('[Better Highscores] No preserved container to restore');
        BetterHighscoresState.lastNoContainerLog = Date.now();
      }
      return;
    }
    
    const source = BetterHighscoresState.wasInSandboxMode ? 'sandbox mode' : 'board analysis';
    console.log(`[Better Highscores] Restoring preserved container from ${source}`);
    
    // Remove any existing containers first
    removeExistingContainers();
    
    // Restore the preserved container
    const restoredContainer = BetterHighscoresState.preservedContainer.cloneNode(true);
    const mainContainer = getMainContainer();
    
    if (mainContainer) {
      mainContainer.appendChild(restoredContainer);
      leaderboardContainer = restoredContainer;
      console.log('[Better Highscores] Container restored successfully');
    } else {
      console.log('[Better Highscores] Could not find main container for restoration');
    }
    
    // Clear preserved state
    BetterHighscoresState.preservedContainer = null;
    BetterHighscoresState.wasInSandboxMode = false;
    
    // Force update to ensure correct map data is displayed
    scheduleTimeout(() => updateLeaderboards(), DELAYS.RESTORE);
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
      const playerSnapshot = getPlayerSnapshot();
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
    
    // Check if this is the current user
    const playerSnapshot = getPlayerSnapshot();
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
// MODULE 6: UI Components & Rendering
// =======================
  // Helper function to create a leaderboard section (tick or rank)
  function createLeaderboardSection(data, config, userScores, playerName) {
    const section = document.createElement('div');
    Object.assign(section.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: 'auto'
    });
    
    if (data && data.length > 0) {
      // Title
      const title = document.createElement('span');
      Object.assign(title.style, {
        fontWeight: 'bold',
        color: config.titleColor,
        fontSize: '10px'
      });
      title.textContent = config.title;
      section.appendChild(title);
      
      // Top entry
      data.slice(0, 1).forEach((entry, index) => {
        const formattedEntry = formatLeaderboardEntry(entry, index, config.isRank);
        const entrySpan = document.createElement('span');
        Object.assign(entrySpan.style, {
          fontSize: '10px',
          color: formattedEntry.color,
          fontWeight: formattedEntry.fontWeight,
          marginRight: '4px'
        });
        entrySpan.textContent = `${formattedEntry.text} ${formattedEntry.value}`;
        section.appendChild(entrySpan);
      });
      
      // User's best score (only if not world record holder)
      const userValue = config.isRank ? userScores?.bestRank : userScores?.bestTicks;
      const worldRecordValue = config.isRank ? data[0].rank : data[0].ticks;
      const userHoldsWorldRecord = data[0].userName === playerName;
      const userTiesWorldRecord = userValue === worldRecordValue;
      
      if (userValue && !userHoldsWorldRecord) {
        const userEntrySpan = document.createElement('span');
        Object.assign(userEntrySpan.style, {
          fontSize: '10px',
          color: userTiesWorldRecord ? '#00ff00' : '#ffa500',
          fontWeight: 'bold',
          marginRight: '4px'
        });
        userEntrySpan.textContent = `You: ${userValue}`;
        section.appendChild(userEntrySpan);
      }
    }
    
    return section;
  }

  // Function to create leaderboard display
  function createLeaderboardDisplay(tickData, rankData, mapName) {
    const container = document.createElement('div');
    container.className = 'better-highscores-container';
    
    // Apply container styles
    Object.assign(container.style, UI_CONFIG.CONTAINER_STYLE);
    Object.assign(container.style, UI_CONFIG.CONTAINER_POSITION);
    
    // Get user data once
    const userScores = getUserBestScores();
    const playerSnapshot = getPlayerSnapshot();
    const playerName = playerSnapshot?.context?.name;
    
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
    const tickSection = createLeaderboardSection(tickData, {
      title: 'Ticks',
      titleColor: UI_CONFIG.COLORS.TICK_TITLE,
      isRank: false
    }, userScores, playerName);
    
    // Create rank leaderboard section
    const rankSection = createLeaderboardSection(rankData, {
      title: 'Rank',
      titleColor: UI_CONFIG.COLORS.RANK_TITLE,
      isRank: true
    }, userScores, playerName);
    
    // Append all sections to container
    container.appendChild(mapSection);
    container.appendChild(tickSection);
    container.appendChild(rankSection);
    
    return container;
  }

  // Function to update leaderboards
  async function updateLeaderboards() {
    console.log('[Better Highscores] updateLeaderboards called');
    
    // Don't update if we're already updating
    if (BetterHighscoresState.isUpdating) {
      console.log('[Better Highscores] Update already in progress, skipping');
      return;
    }
    
    // Skip updates during board analysis to prevent spam
    if (isBoardAnalyzing()) {
      console.log('[Better Highscores] Board analysis in progress, skipping update');
      return;
    }
    
    const currentlyInSandbox = isSandboxMode();
    
    // Handle sandbox mode entry (preserve container when first entering)
    if (currentlyInSandbox && !BetterHighscoresState.wasInSandboxMode) {
      console.log('[Better Highscores] Just entered sandbox mode, preserving container');
      preserveContainer();
    }

    try {
      BetterHighscoresState.isUpdating = true;
      
      const mapCode = getCurrentMapCode();
      console.log('[Better Highscores] Detected map code:', mapCode);
      
      if (!mapCode) {
        console.log('[Better Highscores] No current map code found');
        return;
      }
      
      // Throttle updates to prevent spam
      if (mapCode === currentMapCode && 
          leaderboardContainer && 
          shouldThrottle(BetterHighscoresState.lastUpdateTime, DELAYS.UPDATE_THROTTLE)) {
        console.log('[Better Highscores] Skipping update - same map and recent data');
        return;
      }
      
      currentMapCode = mapCode;
      BetterHighscoresState.lastUpdateTime = Date.now();
      
      const mapName = getMapName(mapCode);
      
      // Fetch leaderboard data
      const { tickData, rankData } = await fetchLeaderboardData(mapCode, false);
      
      // Remove existing container and any duplicate containers
      if (leaderboardContainer) {
        leaderboardContainer.remove();
        leaderboardContainer = null;
      }
      
      // Also remove any other containers with the same class to prevent duplicates
      const count = removeExistingContainers();
      if (count > 0) {
        console.log(`[Better Highscores] Removing ${count} existing containers`);
      }
      
      // Create new container
      leaderboardContainer = createLeaderboardDisplay(tickData, rankData, mapName);
      console.log('[Better Highscores] Created leaderboard container:', leaderboardContainer);
      
      // Find the main game container and append
      const mainContainer = getMainContainer();
      console.log('[Better Highscores] Main container found:', mainContainer);
      
      if (mainContainer) {
        console.log('[Better Highscores] Appending leaderboard container to main container');
        mainContainer.appendChild(leaderboardContainer);
        console.log('[Better Highscores] Leaderboard container appended successfully');
      } else {
        console.error('[Better Highscores] Could not find main container for leaderboard injection');
      }
      
      console.log(`[Better Highscores] Updated leaderboards for map: ${mapName} (${mapCode})`);
      
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
// MODULE 7: Initialization & Cleanup
// =======================
  // Function to initialize the mod
  function initBetterHighscores() {
    console.log('[Better Highscores] Initializing version 1.0.0');
    
    // Wait for game state to be available
    let checkGameStateTimeout = null;
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
          
          // Handle map changes and container updates
          const detectedMapCode = getCurrentMapCode();
          const mainContainer = getMainContainer();
          handleStateUpdate(detectedMapCode, mainContainer);
          
          // Check for sandbox mode changes
          const currentMode = state.context?.mode;
          const wasInSandbox = BetterHighscoresState.wasInSandboxMode;
          const isInSandbox = currentMode === 'sandbox';
          
          if (isInSandbox && !wasInSandbox) {
            // Just entered sandbox mode
            console.log('[Better Highscores] Entered sandbox mode, preserving container');
            preserveContainer();
          } else if (!isInSandbox && wasInSandbox) {
            // Just exited sandbox mode
            console.log('[Better Highscores] Exited sandbox mode');
            
            // Always update leaderboards when exiting sandbox mode
            console.log('[Better Highscores] Exiting sandbox mode, updating leaderboards with current map');
            BetterHighscoresState.preservedContainer = null;
            BetterHighscoresState.wasInSandboxMode = false;
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
            
            // Handle map changes and container updates
            const detectedMapCode = getCurrentMapCode();
            const mainContainer = getMainContainer();
            handleStateUpdate(detectedMapCode, mainContainer);
          });
          
          // Store subscription for cleanup
          BetterHighscoresState.subscriptions.push(gameUnsubscribe);
        }
        
        // Listen for game timer changes to detect battle completion
        if (globalThis.state.gameTimer) {
          let previousState = 'initial';
          
          const gameTimerUnsubscribe = globalThis.state.gameTimer.subscribe((state) => {
            const currentState = state.context.state;
            
            // Skip updates during board analysis to prevent spam and preserve container
            if (isBoardAnalyzing()) {
              return;
            }
            
            // Check if game just ended (victory/defeat states)
            if (currentState !== 'initial' && currentState !== 'playing') {
              handleBattleCompletion();
            }
            
            // Handle state transitions
            handleStateTransition(previousState, currentState);
            
            previousState = currentState;
          });
          
          // Store subscription for cleanup
          BetterHighscoresState.subscriptions.push(gameTimerUnsubscribe);
        }
        
        // Set up MutationObserver to detect when leaderboard gets removed from DOM
        window.BetterHighscoresInternals = window.BetterHighscoresInternals || {};
        window.BetterHighscoresInternals.observer = new MutationObserver((mutations) => {
          if (!isAutoplayMode()) return;
          
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              for (const removedNode of mutation.removedNodes) {
                if (removedNode === leaderboardContainer || 
                    (removedNode.nodeType === Node.ELEMENT_NODE && 
                     removedNode.contains && removedNode.contains(leaderboardContainer))) {
                  console.log('[Better Highscores] Leaderboard removed from DOM during autoplay, restoring');
                  scheduleTimeout(() => {
                    updateLeaderboards();
                  }, DELAYS.MUTATION_RESTORE);
                  break;
                }
              }
            }
          }
        });
        
        // Observe the document body for leaderboard removal
        window.BetterHighscoresInternals.observer.observe(document.body, { 
          childList: true, 
          subtree: true 
        });
        
        console.log('[Better Highscores] Initialization complete');
      } else {
        // Retry after a short delay
        checkGameStateTimeout = scheduleTimeout(checkGameState, DELAYS.RETRY);
        window.betterHighscoresCheckGameStateTimeout = checkGameStateTimeout;
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
    console.log('[Better Highscores] Cleaning up...');
    
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
    
    // Clear cache
    BetterHighscoresState.leaderboardCache.clear();
    
    // Clear all tracked timeouts
    BetterHighscoresState.clearTimeouts();
    
    // Clear checkGameState timeout if it exists
    if (window.betterHighscoresCheckGameStateTimeout) {
      clearTimeout(window.betterHighscoresCheckGameStateTimeout);
      window.betterHighscoresCheckGameStateTimeout = null;
    }
    
    // Clean up observer
    if (window.BetterHighscoresInternals?.observer) {
      window.BetterHighscoresInternals.observer.disconnect();
      window.BetterHighscoresInternals.observer = null;
    }
    
    // Clean up global window objects
    if (window.BetterHighscores) {
      delete window.BetterHighscores;
    }
    
    if (window.BetterHighscoresInternals) {
      delete window.BetterHighscoresInternals;
    }
    
    console.log('[Better Highscores] Cleanup complete');
  }

  // =======================
  // MODULE INITIALIZATION
  // =======================
  function initializeBetterHighscores() {
    console.log('[Better Highscores] Starting initialization...');
    
    if (config.enabled) {
      initBetterHighscores();
    } else {
      console.log('[Better Highscores] Disabled in configuration');
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
        console.log('[Better Highscores] Force update triggered');
        updateLeaderboards();
      },
      forceRestore: () => {
        console.log('[Better Highscores] Force restore triggered');
        restoreContainer();
      },
      forcePreserve: () => {
        console.log('[Better Highscores] Force preserve triggered');
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
      }
    };
  }

})();

