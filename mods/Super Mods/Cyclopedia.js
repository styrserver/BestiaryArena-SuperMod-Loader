// =======================
// Helper: Map numeric room ID to code
function getRoomCodeFromId(roomId) {
  const rooms = globalThis.state.utils.ROOMS;
  for (const [code, room] of Object.entries(rooms)) {
    if (String(room.id) === String(roomId)) {
      return code;
    }
  }
  return null;
}

// =======================
// Utility Functions (moved to top to avoid reference errors)
// =======================
function formatDate(ts) {
  if (!ts) return '-';
  try {
    const date = new Date(Number(ts));
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch (e) {
    return '-';
  }
}

// =======================
// Level Calculation Utility
// =======================
function getLevelFromExp(exp) {
  // Table of [level, totalExp]
  const expTable = [
    [5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250],
    [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750],
    [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750],
    [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500],
    [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000],
    [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500],
    [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000],
    [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]
  ];
  if (typeof exp !== 'number' || exp < expTable[0][1]) return 1;
  for (let i = expTable.length - 1; i >= 0; i--) {
    if (exp >= expTable[i][1]) return expTable[i][0];
  }
  return 1;
}

// =======================
// 0. Version & Metadata
// =======================
// Cyclopedia Mod for Bestiary Arena (Refactored)
console.log('Cyclopedia initializing...');

// =======================
// 1. Constants & Globals
// =======================
const CYCLOPEDIA_MODAL_WIDTH = 900;
const CYCLOPEDIA_MODAL_HEIGHT = 600;
const CYCLOPEDIA_CHROME_HEIGHT = 70; // If needed for extra chrome
const CYCLOPEDIA_BUTTON_ID = 'cyclopedia';

// Layout constants
const LAYOUT_CONSTANTS = {
  COLUMN_WIDTH: '252px',
  LEFT_COLUMN_WIDTH: '180px',
  MODAL_WIDTH: 900,
  MODAL_HEIGHT: 600,
  CHROME_HEIGHT: 70,
  COLORS: {
    PRIMARY: '#ffe066',
    SECONDARY: '#e6d7b0',
    BACKGROUND: '#232323',
    TEXT: '#fff',
    ERROR: '#ff6b6b',
    WARNING: '#888'
  },
  FONTS: {
    PRIMARY: "'Trebuchet MS', 'Arial Black', Arial, sans-serif"
  }
};

// Monster stat configuration
const MONSTER_STATS_CONFIG = [
  { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 700, barColor: 'rgb(96, 192, 96)' },
  { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 80, barColor: 'rgb(255, 128, 96)' },
  { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 60, barColor: 'rgb(128, 128, 255)' },
  { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 60, barColor: 'rgb(224, 224, 128)' },
  { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 60, barColor: 'rgb(192, 128, 255)' }
];

// State object to encapsulate all mod state
const cyclopediaState = {
  observer: null,
  monsterNameMap: null,
  monsterNameMapBuilt: false, // Caching flag
  monsterLocationCache: new Map(), // Caching for locations
  searchDebounceTimer: null, // For debouncing search
  lazyLoadQueue: [], // Queue for lazy loading monster data
  isProcessingQueue: false, // Flag to prevent multiple queue processing
};

// =======================
// 2. Utility Functions
// =======================
/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(cyclopediaState.searchDebounceTimer);
      func(...args);
    };
    clearTimeout(cyclopediaState.searchDebounceTimer);
    cyclopediaState.searchDebounceTimer = setTimeout(later, wait);
  };
}

/**
 * Process the lazy load queue for monster data
 */
async function processLazyLoadQueue() {
  if (cyclopediaState.isProcessingQueue || cyclopediaState.lazyLoadQueue.length === 0) {
    return;
  }
  
  cyclopediaState.isProcessingQueue = true;
  
  try {
    while (cyclopediaState.lazyLoadQueue.length > 0) {
      const { monsterId, callback } = cyclopediaState.lazyLoadQueue.shift();
      
      try {
        const monsterData = safeGetMonsterData(monsterId);
        if (callback && typeof callback === 'function') {
          callback(monsterData);
        }
      } catch (error) {
        console.error(`[Cyclopedia] Error loading monster ${monsterId}:`, error);
        if (callback && typeof callback === 'function') {
          callback(null);
        }
      }
      
      // Small delay to prevent blocking the UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally {
    cyclopediaState.isProcessingQueue = false;
  }
}

/**
 * Add monster data loading to the lazy load queue
 * @param {number} monsterId - Monster ID to load
 * @param {Function} callback - Callback function to execute when data is loaded
 */
function queueMonsterDataLoad(monsterId, callback) {
  cyclopediaState.lazyLoadQueue.push({ monsterId, callback });
  
  // Process queue if not already processing
  if (!cyclopediaState.isProcessingQueue) {
    processLazyLoadQueue();
  }
}

/**
 * Safely get monster data by ID, with robust error handling.
 * @param {number} monsterId
 * @returns {object|null}
 */
function safeGetMonsterData(monsterId) {
  try {
    if (!globalThis.state?.utils?.getMonster) {
      throw new Error('Monster API not available');
    }
    const monsterData = globalThis.state.utils.getMonster(monsterId);
    if (!monsterData?.metadata) {
      throw new Error('Invalid monster data');
    }
    return monsterData;
  } catch (error) {
    console.error(`[Cyclopedia] Error getting monster data for ID ${monsterId}:`, error);
    return null;
  }
}

function buildCyclopediaMonsterNameMap() {
  if (cyclopediaState.monsterNameMapBuilt && cyclopediaState.monsterNameMap) {
    return;
  }
  cyclopediaState.monsterNameMap = new Map();
  const utils = globalThis.state.utils;
  
  // Early termination if utils not available
  if (!utils || !utils.getMonster) {
    console.warn('[Cyclopedia] Monster API not available, skipping name map build');
    return;
  }
  
  // Try to get a reasonable upper bound for monster IDs with better error handling
  let maxId = 200; // fallback
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 10; // Stop after 10 consecutive failures
  
  try {
    // Try to find the highest valid monster ID with early termination
    for (let i = 1; i < 1000; i++) {
      try {
        const monster = utils.getMonster(i);
        if (!monster || !monster.metadata || !monster.metadata.name) {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            maxId = Math.max(1, i - maxConsecutiveFailures);
            break;
          }
        } else {
          consecutiveFailures = 0; // Reset on success
          maxId = i;
        }
      } catch (error) {
        consecutiveFailures++;
        if (consecutiveFailures >= maxConsecutiveFailures) {
          maxId = Math.max(1, i - maxConsecutiveFailures);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[Cyclopedia] Error determining monster ID range:', error);
  }
  
  // Build the map with better error handling
  for (let i = 1; i <= maxId; i++) {
    try {
      const monster = utils.getMonster(i);
      if (monster && monster.metadata && monster.metadata.name) {
        cyclopediaState.monsterNameMap.set(monster.metadata.name.toLowerCase(), { monster, index: i });
      }
    } catch (error) {
      // Silently continue for individual monster failures
      continue;
    }
  }
  cyclopediaState.monsterNameMapBuilt = true;
  // --- Runtime override for Old Giant Spider baseStats ---
  const entry = cyclopediaState.monsterNameMap.get('old giant spider');
  if (entry && entry.monster && entry.monster.metadata && entry.monster.metadata.baseStats) {
    entry.monster.metadata.baseStats = {
      hp: 1140,
      ad: 108,
      ap: 30,
      armor: 30,
      magicResist: 30
    };
  }
}

function getMonsterNameFromMenu(menuElem) {
  const group = menuElem.querySelector('div[role="group"]');
  if (!group) return null;
  const firstItem = group.querySelector('.dropdown-menu-item');
  if (!firstItem) return null;
  const match = firstItem.textContent.trim().match(/^(.*?)\s*\(/);
  return match ? match[1] : firstItem.textContent.trim();
}

function getWikiName(monsterName) {
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
    const maps = window.BestiaryModAPI.utility.maps;
    let gameId = maps.monsterNamesToGameIds.get(monsterName.toLowerCase());
    if (gameId !== undefined) {
      let canonicalName = maps.monsterGameIdsToNames.get(gameId);
      if (canonicalName) return canonicalName;
    }
  }
  return monsterName;
}

/**
 * Finds all locations where a specific monster appears
 * @param {string} monsterName - The name of the monster to search for
 * @returns {Array} Array of location objects with room info and positions
 */
function findMonsterLocations(monsterName) {
  const cacheKey = monsterName.toLowerCase();
  if (cyclopediaState.monsterLocationCache.has(cacheKey)) {
    return cyclopediaState.monsterLocationCache.get(cacheKey);
  }
  const locations = [];
  try {
    // Get the monster's game ID
    let monsterGameId = null;
    // Try to find the monster by name in the monster name map
    if (cyclopediaState.monsterNameMap) {
      const entry = cyclopediaState.monsterNameMap.get(monsterName.toLowerCase());
      if (entry) {
        monsterGameId = entry.index;
      }
    }
    // If not found, try using the utility API maps
    if (!monsterGameId) {
      if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
        const maps = window.BestiaryModAPI.utility.maps;
        monsterGameId = maps.monsterNamesToGameIds.get(monsterName.toLowerCase());
      }
    }
    if (!monsterGameId) {
      cyclopediaState.monsterLocationCache.set(cacheKey, locations);
      return locations;
    }
    // Get all rooms
    const rooms = globalThis.state.utils.ROOMS;
    const roomNames = globalThis.state.utils.ROOM_NAME;
    // Iterate through all rooms
    Object.entries(rooms).forEach(([roomId, room]) => {
      try {
        // Check if room has file data with actors
        if (!room.file || !room.file.data || !room.file.data.actors) {
          return;
        }
        const actors = room.file.data.actors;
        // Check if this monster appears in this room's actors
        const monsterInRoom = actors.filter((actor, actorIndex) => {
          if (!actor) {
            return false;
          }
          const matches = actor.id === monsterGameId;
          return matches;
        });
        if (monsterInRoom.length > 0) {
          const roomName = roomNames[roomId] || roomId;
          // Group by room and collect all positions
          const roomLocations = monsterInRoom.map((actor, index) => ({
            tileIndex: null, // Actors don't have tileIndex, they're placed dynamically
            direction: actor.direction || 'unknown',
            level: actor.level || 1,
            tier: 0, // Default tier for actors
            villain: true, // Actors are always enemies
            equipment: null, // Actors don't have equipment
            actorIndex: index // Track which actor this is
          }));
          locations.push({
            roomId: roomId,
            roomName: roomName,
            positions: roomLocations
          });
        }
      } catch (error) {
        console.error(`[DEBUG] Error processing room ${roomId}:`, error);
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error finding monster locations:', error);
  }
  cyclopediaState.monsterLocationCache.set(cacheKey, locations);
  return locations;
}

/**
 * Formats tile position for display
 * @param {number} tileIndex - The tile index
 * @returns {string} Formatted position string
 */
function formatTilePosition(tileIndex) {
  // Assuming a 10x10 grid (100 tiles), calculate row and column
  const gridSize = 10;
  const row = Math.floor(tileIndex / gridSize) + 1;
  const col = (tileIndex % gridSize) + 1;
  const result = `${row},${col}`;
  return result;
}

/**
 * Formats direction for display
 * @param {string} direction - The direction string
 * @returns {string} Formatted direction string
 */
function formatDirection(direction) {
  if (!direction) {
    return '';
  }
  
  const directionMap = {
    'north': '↑',
    'south': '↓', 
    'east': '→',
    'west': '←',
    'northeast': '↗',
    'northwest': '↖',
    'southeast': '↘',
    'southwest': '↙'
  };
  
  return directionMap[direction.toLowerCase()] || direction;
}

// =======================
// 3. DOM/CSS Injection Helpers
// =======================
function injectCyclopediaCss() {
  if (!document.getElementById('cyclopedia-css')) {
    const link = document.createElement('link');
    link.id = 'cyclopedia-css';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'https://bestiaryarena.wiki.gg/load.php?modules=mediawiki.skinning.interface|site.styles&only=styles&skin=monobook';
    document.head.appendChild(link);
  }
}

function injectCyclopediaButtonStyles() {
  if (!document.getElementById('cyclopedia-btn-css')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-btn-css';
    style.textContent = `
      .cyclopedia-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; }
      nav.cyclopedia-subnav > button.cyclopedia-btn,
      nav.cyclopedia-subnav > button.cyclopedia-btn:hover,
      nav.cyclopedia-subnav > button.cyclopedia-btn:focus {
        background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important;
        border: 6px solid transparent !important;
        border-color: #ffe066 !important;
        border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important;
        color: var(--theme-text, #e6d7b0) !important;
        font-weight: 700 !important;
        border-radius: 0 !important;
        box-sizing: border-box !important;
        transition: color 0.2s, border-image 0.1s !important;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important;
        outline: none !important;
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
        padding: 7px 24px !important;
        cursor: pointer;
        flex: 1 1 0;
        min-width: 0;
      }
      nav.cyclopedia-subnav > button.cyclopedia-btn.pressed,
      nav.cyclopedia-subnav > button.cyclopedia-btn:active {
        border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
      }
      nav.cyclopedia-subnav > button.cyclopedia-btn.active {
        border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
      }
      /* Home button specific styling - 42x42 pixels */
      nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="home"],
      nav.cyclopedia-subnav > button.cyclopedia-btn[data-tab="wiki"] {
        width: 42px !important;
        height: 42px !important;
        min-width: 42px !important;
        min-height: 42px !important;
        max-width: 42px !important;
        max-height: 42px !important;
        flex: 0 0 42px !important;
        padding: 0 !important;
        font-size: 12px !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function injectCyclopediaBoxStyles() {
  if (!document.getElementById('cyclopedia-box-css')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-box-css';
    style.textContent = `
      .cyclopedia-box { display: flex; flex-direction: column; border: none; background: none; margin-bottom: 16px; min-height: 0; height: 120px; box-sizing: border-box; }
      .cyclopedia-box-title { border: 6px solid transparent; border-image: url('https://bestiaryarena.com/_next/static/media/4-frame-top.b7a55115.png') 6 6 0 6 stretch; border-bottom: none; background: #232323; color: #ffe066; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 4px 12px; text-align: left; letter-spacing: 1px; }
      .cyclopedia-box-content { flex: 1 1 0; overflow-y: auto; background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat; padding: 8px 12px; color: #e6d7b0; font-size: 14px; font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif; min-height: 0; max-height: none; scrollbar-width: thin !important; scrollbar-color: #444 #222 !important; }
      .cyclopedia-box-content::-webkit-scrollbar { width: 12px !important; background: transparent !important; }
      .cyclopedia-box-content::-webkit-scrollbar-thumb { background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important; border-radius: 4px !important; }
      .cyclopedia-box-content::-webkit-scrollbar-corner { background: transparent !important; }
    `;
    document.head.appendChild(style);
  }
}

function injectCyclopediaSelectedCss() {
  if (!document.getElementById('cyclopedia-selected-css')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-selected-css';
    style.textContent = `
      .cyclopedia-selected {
        background: rgba(255,255,255,0.18) !important;
        color: #ffe066 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// =======================
// 4. UI Creation Functions
// =======================

// --- Move createBox to top-level scope ---
function createBox({
  title,
  items,
  extraBoxStyles = {},
  type = 'creature',
  selectedCreature,
  selectedEquipment,
  selectedInventory,
  setSelectedCreature,
  setSelectedEquipment,
  setSelectedInventory,
  updateRightCol
}) {
  const box = document.createElement('div');
  box.style.flex = '1 1 0';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.margin = '0';
  box.style.padding = '0';
  box.style.minHeight = '0'; // allow flex children to shrink
  box.style.height = '100%'; // fill parent
  Object.assign(box.style, extraBoxStyles);
  // Title
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text pixel-font-16';
  titleEl.style.margin = '0';
  titleEl.style.padding = '2px 8px';
  titleEl.style.textAlign = 'center';
  titleEl.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  const p = document.createElement('p');
  p.textContent = title;
  p.className = 'pixel-font-16';
  p.style.margin = '0';
  p.style.padding = '0';
  p.style.textAlign = 'center';
  p.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  titleEl.appendChild(p);
  box.appendChild(titleEl);
  // Content (use in-game scroll container)
  const scrollContainer = api.ui.components.createScrollContainer({
    height: '100%',
    padding: false,
    content: null
  });
  scrollContainer.element.style.flex = '1 1 0';
  scrollContainer.element.style.minHeight = '0';
  scrollContainer.element.style.overflowY = 'scroll';
  items.forEach(name => {
    const item = document.createElement('div');
    item.textContent = name;
    item.className = 'pixel-font-16';
    item.style.fontSize = '14px';
    item.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
    item.style.cursor = 'pointer';
    item.style.padding = '2px 4px';
    item.style.borderRadius = '2px';
    item.style.textAlign = 'left';
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255,255,255,0.08)';
    });
    item.addEventListener('mouseleave', () => {
      if (!item.classList.contains('cyclopedia-selected')) {
        item.style.background = 'none';
      }
    });
    item.addEventListener('mousedown', () => {
      item.style.background = 'rgba(255,255,255,0.18)';
    });
    item.addEventListener('mouseup', () => {
      if (!item.classList.contains('cyclopedia-selected')) {
        item.style.background = 'rgba(255,255,255,0.08)';
      }
    });
    item.addEventListener('click', () => {
      // Remove highlight from all items in all boxes
      document.querySelectorAll('.cyclopedia-selected').forEach(el => {
        el.classList.remove('cyclopedia-selected');
        el.style.background = 'none';
        el.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      });
      item.classList.add('cyclopedia-selected');
      item.style.background = 'rgba(255,255,255,0.18)';
      item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
      // Set selection and update right column
      if (type === 'creature') {
        if (title === 'Unobtainable') {
        }
        setSelectedCreature(name);
        setSelectedEquipment(null);
        setSelectedInventory(null);
      } else if (type === 'equipment') {
        setSelectedCreature(null);
        setSelectedEquipment(name);
        setSelectedInventory(null);
      } else if (type === 'inventory') {
        setSelectedCreature(null);
        setSelectedEquipment(null);
        setSelectedInventory(name);
      }
      updateRightCol();
    });
    scrollContainer.contentContainer.appendChild(item);
  });
  box.appendChild(scrollContainer.element);
  return box;
}

function addCyclopediaHeaderButton() {
  const tryInsert = () => {
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      setTimeout(tryInsert, 500);
      return;
    }
    if (headerUl.querySelector('.cyclopedia-header-btn')) return;
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.textContent = 'Cyclopedia';
    btn.className = 'cyclopedia-header-btn';
    btn.onclick = () => openCyclopediaModal();
    li.appendChild(btn);
    const wikiLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.textContent.includes('Wiki')
    );
    if (wikiLi && wikiLi.nextSibling) {
      headerUl.insertBefore(li, wikiLi.nextSibling);
    } else {
      headerUl.appendChild(li);
    }
  };
  tryInsert();
}

function injectCyclopediaButton(menuElem) {
  if (menuElem.querySelector('.cyclopedia-menu-item')) return;
  const monsterName = getMonsterNameFromMenu(menuElem);
  const cyclopediaItem = document.createElement('div');
  cyclopediaItem.className = 'dropdown-menu-item cyclopedia-menu-item relative flex cursor-default select-none items-center gap-2 outline-none';
  cyclopediaItem.setAttribute('role', 'menuitem');
  cyclopediaItem.setAttribute('tabindex', '-1');
  cyclopediaItem.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 19V6a2 2 0 0 1 2-2h7"></path><path d="M22 19V6a2 2 0 0 0-2-2h-7"></path><path d="M2 19a2 2 0 0 0 2 2h7"></path><path d="M22 19a2 2 0 0 1-2 2h-7"></path></svg>Cyclopedia`;
  cyclopediaItem.addEventListener('click', (e) => {
    e.stopPropagation();
    if (monsterName && typeof monsterName === 'string') {
      openCyclopediaModal(monsterName);
    } else {
      openCyclopediaModal();
    }
    if (menuElem.parentElement) menuElem.parentElement.removeChild(menuElem);
  });
  const separator = menuElem.querySelector('.separator');
  if (separator) {
    separator.parentNode.insertBefore(cyclopediaItem, separator);
  } else {
    menuElem.appendChild(cyclopediaItem);
  }
}

function addCyclopediaPressedStateListeners(btn) {
  btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
  btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
  btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
  btn.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') btn.classList.add('pressed');
  });
  btn.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') btn.classList.remove('pressed');
  });
}

// =======================
// 5. Data/Model Functions
// =======================
function startContextMenuObserver() {
  if (cyclopediaState.observer) return;
  cyclopediaState.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('div[data-radix-popper-content-wrapper]')) {
            const menu = node.querySelector('[role="menu"]');
            if (menu) injectCyclopediaButton(menu);
          } else if (node.querySelector) {
            const wrapper = node.querySelector('div[data-radix-popper-content-wrapper]');
            if (wrapper) {
              const menu = wrapper.querySelector('[role="menu"]');
              if (menu) injectCyclopediaButton(menu);
            }
          }
        }
      }
    }
  });
  cyclopediaState.observer.observe(document.body, { childList: true, subtree: true });
}

function stopContextMenuObserver() {
  if (cyclopediaState.observer) {
    cyclopediaState.observer.disconnect();
    cyclopediaState.observer = null;
  }
}

// =======================
// 6. Modal & Template Rendering
// =======================
function showCyclopediaInfoWhenReady(name) {
  if (api.ui && api.ui.components && typeof api.ui.components.createModal === 'function') {
    showCyclopediaInfo(name);
  } else {
    setTimeout(() => showCyclopediaInfoWhenReady(name), 100);
  }
}

function showCyclopediaModal(wikiUrl, title = 'Cyclopedia') {
  // Use centralized sizing constants
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';
  container.style.gap = '0';

  const iframe = document.createElement('iframe');
  iframe.src = wikiUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%'; // Fill modal content area
  iframe.style.maxHeight = '600px'; // Fixed height for iframe
  iframe.style.minHeight = '600px';
  iframe.style.height = '600px'; // Fixed height for iframe
  iframe.style.flex = '1 1 0';  // Helps with flex layouts
  iframe.style.border = 'none';
  iframe.style.background = '#181818';
  iframe.style.display = 'block';
  iframe.style.padding = '0';
  container.style.margin = '0';
  iframe.allowFullscreen = true;
  // Add sandbox attributes to handle CORS issues
  iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
  // Add error handling
  iframe.onerror = () => {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;">
        <div style="font-size:24px;margin-bottom:16px;">⚠️</div>
        <div style="font-size:16px;margin-bottom:12px;color:#e5e5e5;">Unable to load Cyclopedia content</div>
        <div style="font-size:14px;color:#999;margin-bottom:20px;">This may be due to browser security restrictions.</div>
        <a href="${wikiUrl}" target="_blank" style="color:#4a9eff;text-decoration:none;padding:8px 16px;border:1px solid #4a9eff;border-radius:4px;">
          Open in New Tab
        </a>
      </div>
    `;
  };
  container.appendChild(iframe);
  api.ui.components.createModal({
    title: title,
    width: CYCLOPEDIA_MODAL_WIDTH,
    height: CYCLOPEDIA_MODAL_HEIGHT + CYCLOPEDIA_CHROME_HEIGHT, // If chrome height is needed
    content: container,
    buttons: [{ text: 'Close', primary: true }]
  });
  // Enforce 100% height on modal content and its children after creation
  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (dialog) {
      const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body');
      if (contentElem) {
        contentElem.style.height = '600px'; // Fixed pixel height
        contentElem.style.display = 'flex';
        contentElem.style.flexDirection = 'column';
        if (contentElem.firstChild) {
          contentElem.firstChild.style.height = '100%';
          contentElem.firstChild.style.display = 'flex';
          contentElem.firstChild.style.flexDirection = 'column';
          const iframe = contentElem.firstChild.querySelector('iframe');
          if (iframe) {
            iframe.style.height = '600px'; // Fixed height for iframe
            iframe.style.maxHeight = '600px';
            iframe.style.minHeight = '600px';
          }
        }
      }
    }
  }, 100);
}

async function showCyclopediaInfo(name) {
  const wikiName = getWikiName(name);
  const wikiUrl = `https://bestiaryarena.wiki.gg/wiki/${encodeURIComponent(wikiName.replace(/ /g, '_'))}`;
  // Step 1: Open the modal with a loading message
  const modal = api.ui.components.createModal({
    title: `Cyclopedia: ${wikiName}`,
    width: CYCLOPEDIA_MODAL_WIDTH,
    height: CYCLOPEDIA_MODAL_HEIGHT,
    content: '<div id="cyclopedia-loading" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Loading cyclopedia page...</div>',
    buttons: [{ text: 'Close', primary: true }]
  });
  // Step 2: Inject the iframe after a short timeout
  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (dialog) {
      dialog.classList.remove('max-w-[300px]');
      dialog.style.width = CYCLOPEDIA_MODAL_WIDTH + 'px';
      dialog.style.minWidth = CYCLOPEDIA_MODAL_WIDTH + 'px';
      dialog.style.maxWidth = CYCLOPEDIA_MODAL_WIDTH + 'px';
      dialog.style.height = CYCLOPEDIA_MODAL_HEIGHT + 'px';
      dialog.style.minHeight = CYCLOPEDIA_MODAL_HEIGHT + 'px';
      dialog.style.maxHeight = CYCLOPEDIA_MODAL_HEIGHT + 'px';
      const widgetBottom = dialog.querySelector('.widget-bottom');
      if (widgetBottom) {
        widgetBottom.style.height = CYCLOPEDIA_MODAL_HEIGHT + 'px';
        widgetBottom.style.minHeight = CYCLOPEDIA_MODAL_HEIGHT + 'px';
        widgetBottom.style.maxHeight = CYCLOPEDIA_MODAL_HEIGHT + 'px';
      }
      const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body');
      if (contentElem) {
        contentElem.style.height = '600px'; // Fixed pixel height
        contentElem.style.display = 'flex';
        contentElem.style.flexDirection = 'column';
        contentElem.innerHTML = '';
        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.padding = '0';
        container.style.margin = '0';
        container.style.boxSizing = 'border-box';
        const iframe = document.createElement('iframe');
        iframe.src = wikiUrl;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.maxHeight = '600px';
        iframe.style.minHeight = '600px';
        iframe.style.height = '600px'; // Fixed height for iframe
        iframe.style.flex = '1 1 0';
        iframe.style.border = 'none';
        iframe.style.background = '#181818';
        iframe.style.display = 'block';
        iframe.style.padding = '0';
        iframe.style.margin = '0';
        iframe.allowFullscreen = true;
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
        iframe.onerror = () => {
          container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;">
              <div style="font-size:24px;margin-bottom:16px;">⚠️</div>
              <div style="font-size:16px;margin-bottom:12px;color:#e5e5e5;">Unable to load Cyclopedia content</div>
              <div style="font-size:14px;color:#999;margin-bottom:20px;">This may be due to browser security restrictions.</div>
              <a href="${wikiUrl}" target="_blank" style="color:#4a9eff;text-decoration:none;padding:8px 16px;border:1px solid #4a9eff;border-radius:4px;">
                Open in New Tab
              </a>
            </div>
          `;
        };
        container.appendChild(iframe);
        contentElem.appendChild(container);
      }
    }
  }, 100);
}

function openCyclopediaModal(creatureToSelect) {
  injectCyclopediaButtonStyles();
  injectCyclopediaBoxStyles();
  injectCyclopediaSelectedCss();
  addCyclopediaHeaderButton();
  startContextMenuObserver();

  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.height = '100%';
  content.style.width = '100%';

  // Tab switching logic
  let activeTab = 0;
  let selectedCreature = null; // Track selected creature
  let selectedEquipment = null;
  let selectedInventory = null;

  // List of all creatures (keep in sync with box)
  const allCreatures = [
    'Amazon', 'Banshee', 'Bear', 'Bog Raider', 'Bug', 'Corym Charlatan', 'Corym Skirmisher', 'Corym Vanguard', 'Cyclops', 'Deer', 'Demon Skeleton', 'Dragon', 'Dragon Lord',
    'Druid', 'Dwarf', 'Dwarf Geomancer', 'Dwarf Guard', 'Dwarf Soldier', 'Elf', 'Elf Arcanist', 'Elf Scout',
    'Fire Devil', 'Fire Elemental', 'Firestarter', 'Frost Troll', 'Ghost', 'Ghoul', 'Goblin', 'Goblin Assassin',
    'Goblin Scavenger', 'Knight', 'Minotaur', 'Minotaur Archer', 'Minotaur Guard', 'Minotaur Mage', 'Monk',
    'Mummy', 'Nightstalker', 'Orc Berserker', 'Orc Leader', 'Orc Rider', 'Orc Shaman', 'Orc Spearman',
    'Orc Warlord', 'Poison Spider', 'Polar Bear', 'Rat', 'Rorc', 'Rotworm', 'Scorpion', 'Sheep', 'Skeleton',
    'Slime', 'Snake', 'Spider', 'Stalker', 'Tortoise', 'Troll', 'Valkyrie', 'Warlock', 'Wasp', 'Water Elemental',
    'Witch', 'Winter Wolf', 'Wolf', 'Wyvern'
  ];
  // List of unobtainable creatures (alphabetical order)
  const unobtainableCreatures = [
    'Earth Crystal',
    'Energy Crystal',
    'Lavahole',
    'Magma Crystal',
    'Old Giant Spider',
    'Orc',
    'Sweaty Cyclops'
  ];

  // If a creature is provided and exists, select it; otherwise, leave null
  let normalizedCreature = creatureToSelect && typeof creatureToSelect === 'string' ? creatureToSelect.trim().toLowerCase() : null;
  let foundCreature = null;
  if (normalizedCreature) {
    foundCreature = allCreatures.find(c => c.toLowerCase() === normalizedCreature) ||
                   unobtainableCreatures.find(c => c.toLowerCase() === normalizedCreature);
  }
  if (foundCreature) {
    selectedCreature = foundCreature;
    activeTab = 1; // Bestiary tab  
  } else {
  }

  // Tab switching function (cyclopedia style) - defined before tab pages for access
  let setActiveTab;
  function defineSetActiveTab(tabButtons, mainContent, tabPages) {
    setActiveTab = function(idx) {
      activeTab = idx;
      tabButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
      // Remove old content
      while (mainContent.firstChild) mainContent.removeChild(mainContent.firstChild);
      // Add new tab page
      mainContent.appendChild(tabPages[idx]);
    };
  }

  const tabPages = [
    // Home page (Start Page with player profile data)
    (() => {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'column';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.padding = '20px';
      d.style.boxSizing = 'border-box';
      d.style.overflowY = 'scroll';
      
      // Loading state using UI components
      const loadingDiv = document.createElement('div');
      loadingDiv.style.display = 'flex';
      loadingDiv.style.flexDirection = 'column';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.justifyContent = 'center';
      loadingDiv.style.height = '100%';
      loadingDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      loadingDiv.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 16px;">📚</div>
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading Cyclopedia...</div>
        <div style="font-size: 14px; color: #888;">Fetching your profile data</div>
      `;
      d.appendChild(loadingDiv);
      
      // Function to fetch and display profile data
      async function loadStartPage() {
        try {
          // Get player name from game state with proper error handling
          const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
          if (!playerState?.name) {
            throw new Error('Player name not available. Please ensure you are logged into the game.');
          }
          
          const playerName = playerState.name;
          
          // Fetch profile data from API with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
          
          const response = await fetch(apiUrl, { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch profile data (HTTP ${response.status})`);
          }
          
          const data = await response.json();
          
          // Clear loading state
          d.innerHTML = '';
          
          // Create three-column layout using UI components
          const flex = document.createElement('div');
          flex.style.display = 'flex';
          flex.style.flexDirection = 'row';
          flex.style.width = '900px';
          flex.style.height = '100%';
          flex.style.margin = '0 auto';
          flex.style.gap = '0';
          flex.style.alignItems = 'center';
          
          // Left: Welcome column
          const leftColWrapper = createColumnWrapper(300);
          leftColWrapper.appendChild(renderCyclopediaWelcomeColumn(playerName));
          flex.appendChild(leftColWrapper);
          
          // Middle: Player info/stats (profile)
          const middleCol = createColumnWrapper(300);
          middleCol.style.padding = '0 12px';
          
          // Loading state for middle column
          const middleLoadingDiv = document.createElement('div');
          middleLoadingDiv.style.display = 'flex';
          middleLoadingDiv.style.flexDirection = 'column';
          middleLoadingDiv.style.alignItems = 'center';
          middleLoadingDiv.style.justifyContent = 'center';
          middleLoadingDiv.style.height = '100%';
          middleLoadingDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
          middleLoadingDiv.innerHTML = `<div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Loading player info...</div>`;
          middleCol.appendChild(middleLoadingDiv);
          flex.appendChild(middleCol);
          
          // Right: Daily context column
          const rightCol = renderDailyContextColumn();
          flex.appendChild(rightCol);
          d.appendChild(flex);
          
          // Fetch and render player info/stats asynchronously
          fetchAndRenderPlayerInfo(playerName, middleCol);
          
        } catch (error) {
          // Handle specific error types
          let errorMessage = 'An unexpected error occurred while loading the profile data.';
          
          if (error.name === 'AbortError') {
            errorMessage = 'Request timed out. Please check your internet connection and try again.';
          } else if (error.message.includes('Player name not available')) {
            errorMessage = error.message;
          } else if (error.message.includes('HTTP')) {
            errorMessage = error.message;
          }
          
          showErrorState(d, errorMessage, loadStartPage);
        }
      }
      
      // Helper function to create column wrapper
      function createColumnWrapper(width) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.height = '100%';
        wrapper.style.width = `${width}px`;
        wrapper.style.minWidth = `${width}px`;
        wrapper.style.maxWidth = `${width}px`;
        wrapper.style.borderRight = '6px solid transparent';
        wrapper.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        return wrapper;
      }
      
      // Helper function to fetch and render player info
      async function fetchAndRenderPlayerInfo(playerName, middleCol) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
          const response = await fetch(apiUrl, { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch player data (HTTP ${response.status})`);
          }
          
          const data = await response.json();
          const profileData = data && typeof data === 'object' && data[0]?.result?.data ? data[0].result.data : data;
          
          // Clear loading and render player info
          middleCol.innerHTML = '';
          middleCol.appendChild(renderCyclopediaPlayerInfo(profileData));
          
        } catch (error) {
          let errorMessage = 'Failed to load player information.';
          
          if (error.name === 'AbortError') {
            errorMessage = 'Player data request timed out.';
          } else if (error.message.includes('HTTP')) {
            errorMessage = error.message;
          }
          
          middleCol.innerHTML = `<div style='color:#ff6b6b;text-align:center;padding:24px;'>${errorMessage}</div>`;
        }
      }
      
      // Helper function to show error state
      function showErrorState(container, message, retryFunction) {
        container.innerHTML = '';
        
        const errorDiv = document.createElement('div');
        errorDiv.style.display = 'flex';
        errorDiv.style.flexDirection = 'column';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.justifyContent = 'center';
        errorDiv.style.height = '100%';
        errorDiv.style.color = LAYOUT_CONSTANTS.COLORS.ERROR;
        errorDiv.style.textAlign = 'center';
        errorDiv.style.padding = '20px';
        
        errorDiv.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">Failed to Load Profile Data</div>
          <div style="font-size: 14px; margin-bottom: 16px; color: #888;">${message}</div>
          <button id="retry-profile-load" style="
            padding: 8px 16px;
            background: #444;
            border: 1px solid #666;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-family: ${LAYOUT_CONSTANTS.FONTS.PRIMARY};
          ">Retry</button>
        `;
        
        container.appendChild(errorDiv);
        
        // Add retry functionality
        const retryButton = container.querySelector('#retry-profile-load');
        if (retryButton && retryFunction) {
          retryButton.addEventListener('click', retryFunction);
        }
      }
      
      // Start loading the profile data
      loadStartPage();
      
      return d;
    })(),
    // Cyclopedia page (Bestiary tab)
    (() => {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';
      // Right column (same as before)
      const rightCol = document.createElement('div');
      rightCol.style.flex = '1';
      rightCol.style.padding = '0';
      rightCol.style.margin = '0';
      rightCol.style.height = '100%';
      rightCol.style.borderImage = 'none';
      function updateRightCol() {
        rightCol.innerHTML = '';
        if (selectedCreature) {
          rightCol.appendChild(renderCreatureTemplate(selectedCreature));
        } else {
          const msg = document.createElement('div');
          msg.textContent = 'Select a creature from the left column to view.';
          msg.className = 'pixel-font-16';
          msg.style.display = 'flex';
          msg.style.justifyContent = 'center';
          msg.style.alignItems = 'center';
          msg.style.height = '100%';
          msg.style.width = '100%';
          msg.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
          msg.style.fontSize = '16px';
          msg.style.fontWeight = 'bold';
          msg.style.textAlign = 'center';
          rightCol.appendChild(msg);
        }
      }
      // Left column (Creatures and Unobtainable)
      const leftCol = document.createElement('div');
      leftCol.style.width = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.minWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.maxWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.padding = '0';
      leftCol.style.margin = '0';
      leftCol.style.height = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.borderRight = '6px solid transparent';
      leftCol.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';
      leftCol.style.overflowY = 'scroll';
      leftCol.style.minHeight = '0';
      // Top: Creatures (50%)
      const creaturesBox = createBox({
        title: 'Creatures',
        items: allCreatures,
        type: 'creature',
        selectedCreature,
        selectedEquipment,
        selectedInventory,
        setSelectedCreature: v => { selectedCreature = v; },
        setSelectedEquipment: v => { selectedEquipment = v; },
        setSelectedInventory: v => { selectedInventory = v; },
        updateRightCol
      });
      creaturesBox.style.flex = '1 1 0';
      creaturesBox.style.minHeight = '0';
      // Bottom: Unobtainable (50%)
      const unobtainableBox = createBox({
        title: 'Unobtainable',
        items: unobtainableCreatures,
        type: 'creature',
        selectedCreature,
        selectedEquipment,
        selectedInventory,
        setSelectedCreature: v => { selectedCreature = v; },
        setSelectedEquipment: v => { selectedEquipment = v; },
        setSelectedInventory: v => { selectedInventory = v; },
        updateRightCol
      });
      unobtainableBox.style.flex = '1 1 0';
      unobtainableBox.style.minHeight = '0';
      leftCol.appendChild(creaturesBox);
      leftCol.appendChild(unobtainableBox);
      d.appendChild(leftCol);
      d.appendChild(rightCol);
      updateRightCol();
      return d;
    })(),
    // Equipment tab
    (() => {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';
      // --- Equipment selection state ---
      let selectedEquipment = null;
      // --- Right side: two columns ---
      // Middle: Equipment Details
      const equipDetailsCol = document.createElement('div');
      equipDetailsCol.style.flex = '1 1 0';
      equipDetailsCol.style.height = '100%';
      equipDetailsCol.style.display = 'flex';
      equipDetailsCol.style.flexDirection = 'column';
      equipDetailsCol.style.alignItems = 'center';
      equipDetailsCol.style.justifyContent = 'flex-start';
      equipDetailsCol.style.fontSize = '16px';
      equipDetailsCol.style.fontWeight = 'bold';
      equipDetailsCol.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      equipDetailsCol.style.borderRight = '6px solid transparent';
      equipDetailsCol.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';
      // Add Equipment Details title (Bestiary style, dynamic)
      const equipDetailsTitle = document.createElement('h2');
      equipDetailsTitle.className = 'widget-top widget-top-text pixel-font-16';
      equipDetailsTitle.style.margin = '0';
      equipDetailsTitle.style.padding = '2px 8px';
      equipDetailsTitle.style.textAlign = 'center';
      equipDetailsTitle.style.color = 'rgb(255, 255, 255)';
      equipDetailsTitle.style.width = '100%';
      equipDetailsTitle.style.boxSizing = 'border-box';
      equipDetailsTitle.style.marginBottom = '10px';
      const equipDetailsTitleP = document.createElement('p');
      equipDetailsTitleP.className = 'pixel-font-16';
      equipDetailsTitleP.style.margin = '0';
      equipDetailsTitleP.style.padding = '0';
      equipDetailsTitleP.style.textAlign = 'center';
      equipDetailsTitleP.style.color = 'rgb(255, 255, 255)';
      equipDetailsTitleP.style.width = '100%';
      equipDetailsTitleP.style.boxSizing = 'border-box';
      function updateEquipDetailsTitle(name) {
        equipDetailsTitleP.textContent = name || 'Equipment Details';
      }
      updateEquipDetailsTitle(); // Initial
      equipDetailsTitle.appendChild(equipDetailsTitleP);
      equipDetailsCol.appendChild(equipDetailsTitle);
      // ---
      // Right: Owned Equipments
      const ownedEquipCol = document.createElement('div');
      ownedEquipCol.style.flex = '1 1 0';
      ownedEquipCol.style.height = '100%';
      ownedEquipCol.style.display = 'flex';
      ownedEquipCol.style.flexDirection = 'column';
      ownedEquipCol.style.alignItems = 'center';
      ownedEquipCol.style.justifyContent = 'flex-start';
      ownedEquipCol.style.fontSize = '16px';
      ownedEquipCol.style.fontWeight = 'bold';
      ownedEquipCol.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      // Add Owned Equipment title (Bestiary style, dynamic)
      const ownedEquipTitle = document.createElement('h2');
      ownedEquipTitle.className = 'widget-top widget-top-text pixel-font-16';
      ownedEquipTitle.style.margin = '0';
      ownedEquipTitle.style.padding = '2px 8px';
      ownedEquipTitle.style.textAlign = 'center';
      ownedEquipTitle.style.color = 'rgb(255, 255, 255)';
      ownedEquipTitle.style.width = '100%';
      ownedEquipTitle.style.boxSizing = 'border-box';
      ownedEquipTitle.style.marginBottom = '10px';
      const ownedEquipTitleP = document.createElement('p');
      ownedEquipTitleP.className = 'pixel-font-16';
      ownedEquipTitleP.style.margin = '0';
      ownedEquipTitleP.style.padding = '0';
      ownedEquipTitleP.style.textAlign = 'center';
      ownedEquipTitleP.style.color = 'rgb(255, 255, 255)';
      ownedEquipTitleP.style.width = '100%';
      ownedEquipTitleP.style.boxSizing = 'border-box';
      function updateOwnedEquipTitle(name, count) {
        if (name && count !== undefined) {
          ownedEquipTitleP.textContent = `Owned ${name} (${count})`;
        } else {
          ownedEquipTitleP.textContent = 'Owned Equipment';
        }
      }
      updateOwnedEquipTitle(); // Initial
      ownedEquipTitle.appendChild(ownedEquipTitleP);
      ownedEquipCol.appendChild(ownedEquipTitle);
      // --- Update right columns when equipment is selected ---
      function updateRightCol() {
        // Equipment Details
        equipDetailsCol.innerHTML = '';
        equipDetailsCol.appendChild(equipDetailsTitle);
        if (!selectedEquipment) {
          updateEquipDetailsTitle();
          equipDetailsCol.innerHTML += '<div class="pixel-font-16" style="text-align:center;">Select equipment to view details</div>';
        } else {
          updateEquipDetailsTitle(selectedEquipment);
          // ... existing code for showing equipment details ...
          let equipId = null;
          if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
            equipId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(selectedEquipment.toLowerCase());
          }
          if (equipId == null && globalThis.state?.utils?.getEquipment) {
            // Fallback: try to find by name
            const utils = globalThis.state.utils;
            for (let i = 1; i < 1000; i++) {
              try {
                const eq = utils.getEquipment(i);
                if (eq && eq.metadata && eq.metadata.name && eq.metadata.name.toLowerCase() === selectedEquipment.toLowerCase()) {
                  equipId = i;
                  break;
                }
              } catch (e) {}
            }
          }
          if (equipId == null) {
            equipDetailsCol.innerHTML += '<div class="pixel-font-16" style="text-align:center;">Equipment not found</div>';
          } else {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            // --- Equipment Portrait and Description ---
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center'; // vertical alignment
            wrap.style.justifyContent = 'center'; // horizontal alignment
            wrap.style.width = '100%'; // take full width of parent
            wrap.style.maxWidth = '100%'; // ensure it never exceeds parent
            // Portrait
            let portrait = api.ui.components.createItemPortrait({
              itemId: equipData?.metadata?.spriteId,
              tier: 5 // Always show tier 5 in Equipment Details
            });
            if (portrait.tagName === 'BUTTON' && portrait.firstChild) {
              portrait = portrait.firstChild;
            }
            portrait.style.display = 'block';
            portrait.style.margin = '0 auto 8px auto';
            // Description
            const tooltipDiv = document.createElement('div');
            tooltipDiv.className = 'pixel-font-14';
            tooltipDiv.style.fontSize = '14px';
            tooltipDiv.style.textAlign = 'left';
            tooltipDiv.style.color = '#e6d7b0';
            tooltipDiv.style.margin = '0 auto';
            tooltipDiv.style.maxWidth = '90%';
            tooltipDiv.style.overflowY = 'auto';
            tooltipDiv.style.maxHeight = '80px';
            tooltipDiv.style.padding = '4px 0 0 0';
            tooltipDiv.style.wordBreak = 'break-word';
            tooltipDiv.style.width = '100%';
            tooltipDiv.style.boxSizing = 'border-box';
            if (equipData?.metadata?.description) {
              tooltipDiv.innerHTML = equipData.metadata.description;
            } else if (equipData?.metadata?.EffectComponent && typeof globalThis.state.utils.createUIComponent === 'function') {
              // Render the React component into tooltipDiv
              const tooltipComponent = globalThis.state.utils.createUIComponent(tooltipDiv, equipData.metadata.EffectComponent);
              tooltipComponent.mount();
            } else {
              tooltipDiv.textContent = 'No description available.';
            }
            wrap.appendChild(portrait);
            wrap.appendChild(tooltipDiv);
            equipDetailsCol.appendChild(wrap);
          }
        }
        // Owned Equipments
        ownedEquipCol.innerHTML = '';
        ownedEquipCol.appendChild(ownedEquipTitle); // Always keep the title at the top
        if (!selectedEquipment) {
          updateOwnedEquipTitle();
          ownedEquipCol.innerHTML += '<div class="pixel-font-16" style="text-align:center;">Select equipment to view owned</div>';
        } else {
          let equipId = null;
          if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
            equipId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(selectedEquipment.toLowerCase());
          }
          if (equipId == null && globalThis.state?.utils?.getEquipment) {
            // Fallback: try to find by name
            const utils = globalThis.state.utils;
            for (let i = 1; i < 1000; i++) {
              try {
                const eq = utils.getEquipment(i);
                if (eq && eq.metadata && eq.metadata.name && eq.metadata.name.toLowerCase() === selectedEquipment.toLowerCase()) {
                  equipId = i;
                  break;
                }
              } catch (e) {}
            }
          }
          const playerEquips = globalThis.state?.player?.getSnapshot?.().context?.equips || [];
          let owned = playerEquips.filter(e => e.gameId === equipId);
          // Sort by tier (descending), then by stat (alphabetically ascending)
          owned = owned.sort((a, b) => {
            if ((b.tier || 0) !== (a.tier || 0)) return (b.tier || 0) - (a.tier || 0);
            if ((a.stat || '').toLowerCase() < (b.stat || '').toLowerCase()) return -1;
            if ((a.stat || '').toLowerCase() > (b.stat || '').toLowerCase()) return 1;
            return 0;
          });
          updateOwnedEquipTitle(selectedEquipment, owned.length);
          if (owned.length === 0) {
            ownedEquipCol.innerHTML += '<div class="pixel-font-16" style="text-align:center;">You do not own this equipment.</div>';
          } else {
            // Split owned equipment by stat type
            const statTypes = ['hp', 'ad', 'ap'];
            const statIcons = {
              hp: '/assets/icons/heal.png',
              ad: '/assets/icons/attackdamage.png',
              ap: '/assets/icons/abilitypower.png'
            };
            const columns = { hp: [], ad: [], ap: [] };
            owned.forEach(eq => {
              if (statTypes.includes(eq.stat)) {
                columns[eq.stat].push(eq);
              }
            });
            // Sort each column by tier descending
            statTypes.forEach(stat => {
              columns[stat].sort((a, b) => (b.tier || 0) - (a.tier || 0));
            });
            // --- HEADER ROW: stat icon + count + separator ---
            const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.flexDirection = 'row';
            headerRow.style.width = '100%';
            headerRow.style.gap = '0';
            statTypes.forEach(stat => {
              const col = document.createElement('div');
              col.style.flex = '1 1 0';
              col.style.display = 'flex';
              col.style.flexDirection = 'column';
              col.style.alignItems = 'center';
              col.style.justifyContent = 'flex-start';
              // Icon + count
              const labelWrap = document.createElement('div');
              labelWrap.style.display = 'flex';
              labelWrap.style.alignItems = 'center';
              labelWrap.style.justifyContent = 'center';
              labelWrap.style.marginTop = '2px';
              labelWrap.style.marginBottom = '2px';
              // Icon
              const icon = document.createElement('img');
              icon.src = statIcons[stat];
              icon.alt = stat.toUpperCase();
              icon.style.width = '22px';
              icon.style.height = '22px';
              icon.style.display = 'inline-block';
              icon.style.marginRight = '4px';
              labelWrap.appendChild(icon);
              // Count
              const countSpan = document.createElement('span');
              countSpan.className = 'pixel-font-16';
              countSpan.style.fontWeight = 'bold';
              countSpan.textContent = `(${columns[stat].length})`;
              labelWrap.appendChild(countSpan);
              col.appendChild(labelWrap);
              // Separator
              const sep = document.createElement('div');
              sep.className = 'separator my-2.5';
              sep.setAttribute('role', 'none');
              sep.style.margin = '0px 0px';
              col.appendChild(sep);
              headerRow.appendChild(col);
            });
            ownedEquipCol.appendChild(headerRow);
            // --- SCROLLABLE GRID: equipment portraits only ---
            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexDirection = 'row';
            grid.style.width = '100%';
            grid.style.gap = '0';
            grid.style.overflowY = 'auto';
            grid.style.flex = '1 1 0';
            grid.style.minHeight = '0';
            grid.style.height = 'auto';
            statTypes.forEach(stat => {
              const col = document.createElement('div');
              col.style.flex = '1 1 0';
              col.style.display = 'flex';
              col.style.flexDirection = 'column';
              col.style.alignItems = 'center';
              col.style.justifyContent = 'flex-start';
              col.style.gap = '0';
              // Only equipment portraits (no header/separator)
              columns[stat].forEach(eq => {
                let eqData = null;
                try {
                  eqData = globalThis.state.utils.getEquipment(eq.gameId);
                } catch (e) {}
                let portrait = api.ui.components.createItemPortrait({
                  itemId: eqData?.metadata?.spriteId,
                  stat: eq.stat,
                  tier: eq.tier
                });
                if (portrait.tagName === 'BUTTON' && portrait.firstChild) {
                  portrait = portrait.firstChild;
                }
                portrait.style.margin = '5px';
                portrait.style.display = 'block';
                col.appendChild(portrait);
              });
              grid.appendChild(col);
            });
            ownedEquipCol.appendChild(grid);
          }
        }
      }
      // Left column (Equipment only)
      const allEquipment = [
        'Amulet of Life', 'Bear Skin', 'Bloody Edge', 'Blue Robe', 'Bonelord Helmet', 'Boots of Haste', 'Chain Bolter', 'Cranial Basher',
        'Dwarven Helmet', 'Dwarven Legs', 'Ectoplasmic Shield', 'Epee', 'Fire Axe', 'Giant Sword', 'Glacial Rod',
        'Glass of Goo', 'Ice Rapier', 'Jester Hat', 'Medusa Shield', 'Ratana', 'Royal Scale Robe', 'Rubber Cap',
        'Skull Helmet', 'Skullcracker Armor', 'Springsprout Rod', 'Steel Boots', 'Vampire Shield', 'Wand of Decay',
        'White Skull'
      ];
      // Custom createBox for equipment with click handler
      function createEquipmentBox({ title, items }) {
        const box = document.createElement('div');
        box.style.flex = '1 1 0';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.margin = '0';
        box.style.padding = '0';
        box.style.minHeight = '0';
        box.style.height = '100%';
        // Title
        const titleEl = document.createElement('h2');
        titleEl.className = 'widget-top widget-top-text pixel-font-16';
        titleEl.style.margin = '0';
        titleEl.style.padding = '2px 8px';
        titleEl.style.textAlign = 'center';
        titleEl.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
        const p = document.createElement('p');
        p.textContent = title;
        p.className = 'pixel-font-16';
        p.style.margin = '0';
        p.style.padding = '0';
        p.style.textAlign = 'center';
        p.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
        titleEl.appendChild(p);
        box.appendChild(titleEl);
        // Content (scroll container)
        const scrollContainer = api.ui.components.createScrollContainer({
          height: '100%',
          padding: false,
          content: null
        });
        scrollContainer.element.style.flex = '1 1 0';
        scrollContainer.element.style.minHeight = '0';
        scrollContainer.element.style.overflowY = 'scroll';
        items.forEach(name => {
          const item = document.createElement('div');
          item.textContent = name;
          item.className = 'pixel-font-16';
          item.style.fontSize = '14px';
          item.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
          item.style.cursor = 'pointer';
          item.style.padding = '2px 4px';
          item.style.borderRadius = '2px';
          item.style.textAlign = 'left';
          item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(255,255,255,0.08)';
          });
          item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('cyclopedia-selected')) {
              item.style.background = 'none';
            }
          });
          item.addEventListener('mousedown', () => {
            item.style.background = 'rgba(255,255,255,0.18)';
          });
          item.addEventListener('mouseup', () => {
            if (!item.classList.contains('cyclopedia-selected')) {
              item.style.background = 'rgba(255,255,255,0.08)';
            }
          });
          item.addEventListener('click', () => {
            // Remove highlight from all items in the box
            box.querySelectorAll('.cyclopedia-selected').forEach(el => {
              el.classList.remove('cyclopedia-selected');
              el.style.background = 'none';
              el.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            });
            item.classList.add('cyclopedia-selected');
            item.style.background = 'rgba(255,255,255,0.18)';
            item.style.color = LAYOUT_CONSTANTS.COLORS.PRIMARY;
            // Set selection and update right columns
            selectedEquipment = name;
            updateRightCol();
          });
          scrollContainer.contentContainer.appendChild(item);
        });
        box.appendChild(scrollContainer.element);
        return box;
      }
      // Left column (Equipment only)
      const leftCol = document.createElement('div');
      leftCol.style.width = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.minWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.maxWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.padding = '0';
      leftCol.style.margin = '0';
      leftCol.style.height = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.borderRight = '6px solid transparent';
      leftCol.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';
      leftCol.style.overflowY = 'scroll';
      leftCol.style.minHeight = '0';
      leftCol.appendChild(createEquipmentBox({
        title: 'Equipment',
        items: allEquipment
      }));
      d.appendChild(leftCol);
      d.appendChild(equipDetailsCol);
      d.appendChild(ownedEquipCol);
      // Initial render
      updateRightCol();
      return d;
    })(),
    // Inventory tab
    (() => {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.flexDirection = 'row';
      d.style.width = '100%';
      d.style.height = '100%';
      d.style.alignItems = 'flex-start';
      d.style.justifyContent = 'center';
      d.style.gap = '0';
      // Right column (placeholder)
      const rightCol = document.createElement('div');
      rightCol.style.flex = '1';
      rightCol.style.padding = '0';
      rightCol.style.margin = '0';
      rightCol.style.height = '100%';
      rightCol.style.borderImage = 'none';
      rightCol.innerHTML = '<div class="pixel-font-16" style="display:flex;justify-content:center;align-items:center;height:100%;width:100%;color:' + LAYOUT_CONSTANTS.COLORS.TEXT + ';font-size:16px;font-weight:bold;text-align:center;">Inventory template coming soon.</div>';
      function updateRightCol() {
        // For future expansion: update rightCol for inventory selection
      }
      // Left column (Inventory only)
      const leftCol = document.createElement('div');
      leftCol.style.width = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.minWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.maxWidth = LAYOUT_CONSTANTS.LEFT_COLUMN_WIDTH;
      leftCol.style.padding = '0';
      leftCol.style.margin = '0';
      leftCol.style.height = '100%';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.borderRight = '6px solid transparent';
      leftCol.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';
      leftCol.style.overflowY = 'scroll';
      leftCol.style.minHeight = '0';
      const allInventory = [
        'Consumables', 'Currency', 'Upgrades', 'Other'
      ];
      leftCol.appendChild(createBox({
        title: 'Inventory',
        items: allInventory,
        type: 'inventory',
        selectedCreature,
        selectedEquipment,
        selectedInventory,
        setSelectedCreature: v => { selectedCreature = v; },
        setSelectedEquipment: v => { selectedEquipment = v; },
        setSelectedInventory: v => { selectedInventory = v; },
        updateRightCol
      }));
      d.appendChild(leftCol);
      d.appendChild(rightCol);
      return d;
    })(),
    (() => { const d = document.createElement('div'); d.textContent = 'Bestiary Page (test)'; d.style.padding = '32px'; d.style.fontSize = '22px'; d.style.color = LAYOUT_CONSTANTS.COLORS.TEXT; d.style.fontWeight = 'bold'; d.style.textAlign = 'center'; d.style.margin = 'auto'; return d; })(),
    (() => { const d = document.createElement('div'); d.textContent = 'Charms Page (test)'; d.style.padding = '32px'; d.style.fontSize = '22px'; d.style.color = LAYOUT_CONSTANTS.COLORS.TEXT; d.style.fontWeight = 'bold'; d.style.textAlign = 'center'; d.style.margin = 'auto'; return d; })(),
  ];

  // Cyclopedia-style tab navigation
  const tabNames = ['Home', 'Bestiary', 'Equipment', 'Inventory'];
  const tabButtons = [];
  const tabNav = document.createElement('nav');
  tabNav.className = 'cyclopedia-subnav';
  tabNames.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = 'cyclopedia-btn';
    if (i === 0) btn.classList.add('active');
    btn.type = 'button';
    // Add data-tab attribute for specific styling
    if (tab === 'Home') {
      btn.setAttribute('data-tab', 'home');
      // Use home icon instead of text
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>`;
    } else {
      btn.textContent = tab;
    }
    btn.addEventListener('click', () => setActiveTab(i));
    addCyclopediaPressedStateListeners(btn);
    tabButtons.push(btn);
    tabNav.appendChild(btn);
  });
  
  // Add Wiki button after the Home button
  const wikiBtn = document.createElement('button');
  wikiBtn.className = 'cyclopedia-btn';
  wikiBtn.setAttribute('data-tab', 'wiki');
  wikiBtn.type = 'button';
  // Use wiki icon
  wikiBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>`;
  wikiBtn.addEventListener('click', () => {
    window.open('https://bestiaryarena.wiki.gg/', '_blank');
  });
  addCyclopediaPressedStateListeners(wikiBtn);
  wikiBtn.style.marginLeft = '20px';
  // Move Wiki button to the far right (after Inventory)
  tabNav.appendChild(wikiBtn);
  content.appendChild(tabNav);

  // Add separator between header and content (match footer)
  const separator = document.createElement('div');
  separator.className = 'separator my-2.5';
  separator.setAttribute('role', 'none');
  separator.style.margin = '10px 0'; // Remove all vertical margin
  content.appendChild(separator);

  // Main flex row (no sidebar, only main content)
  const flexRow = document.createElement('div');
  flexRow.style.display = 'flex';
  flexRow.style.flexDirection = 'row';
  flexRow.style.height = '500px';
  flexRow.style.minHeight = '500px';
  flexRow.style.maxHeight = '500px';

  // Main content area (tab page container)
  const mainContent = document.createElement('div');
  mainContent.style.flex = '1 1 0';
  mainContent.style.padding = '0';
  mainContent.style.display = 'flex';
  mainContent.style.flexDirection = 'column';
  mainContent.style.minHeight = '0';
  mainContent.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
  mainContent.style.justifyContent = 'center';
  mainContent.style.alignItems = 'center';
  mainContent.style.height = '500px';
  mainContent.style.minHeight = '500px';
  mainContent.style.maxHeight = '500px';

  // Define the setActiveTab function with the required parameters
  defineSetActiveTab(tabButtons, mainContent, tabPages);

  // Assemble (no sidebar)
  flexRow.appendChild(mainContent);
  content.appendChild(flexRow);

  api.ui.components.createModal({
    title: 'Cyclopedia',
    width: CYCLOPEDIA_MODAL_WIDTH,
    height: CYCLOPEDIA_MODAL_HEIGHT,
    content: content,
    buttons: [] // We'll use our own close button
  });

  // Set initial tab
  setActiveTab(activeTab);
  
  // Add cleanup when modal is closed
  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (dialog) {
      // Listen for modal close events
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
            if (dialog.getAttribute('data-state') !== 'open') {
              // Modal is closing, cleanup tooltip components
              cleanupAbilityTooltips();
              observer.disconnect();
            }
          }
        });
      });
      
      observer.observe(dialog, { attributes: true });
    }
  }, 100);
}

/**
 * Render the monster stats panel for a given monsterData.
 * @param {object|null} monsterData
 * @returns {HTMLElement}
 */
function renderMonsterStats(monsterData) {
  const statsDiv = document.createElement('div');
  statsDiv.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2 revert-pixel-font-spacing whitespace-nowrap';
  statsDiv.style.flex = '1 1 0';
  statsDiv.style.textAlign = 'left';
  statsDiv.style.margin = '2px';
  statsDiv.style.width = '160px';
  statsDiv.style.height = '150px';
  statsDiv.style.alignSelf = 'center';
  statsDiv.style.color = '';
  statsDiv.style.fontSize = '';
  statsDiv.style.fontWeight = '';
  statsDiv.style.fontFamily = '';
  statsDiv.style.padding = '4px';
  statsDiv.style.display = 'flex';
  statsDiv.style.flexDirection = 'column';
  statsDiv.style.justifyContent = 'center';
  statsDiv.style.boxSizing = 'border-box';
  if (monsterData?.metadata?.baseStats) {
    const s = monsterData.metadata.baseStats;
    statsDiv.innerHTML = '';
    MONSTER_STATS_CONFIG.forEach(stat => {
      const value = s[stat.key] !== undefined ? s[stat.key] : 0;
      const percent = Math.max(0, Math.min(1, value / stat.max));
      const barWidth = Math.round(percent * 100);
      // Outer stat row
      const statRow = document.createElement('div');
      statRow.setAttribute('data-transparent', 'false');
      statRow.className = 'pixel-font-16 whitespace-nowrap text-whiteRegular data-[transparent=\'true\']:opacity-25';
      // Top row: icon+name left, value right
      const topRow = document.createElement('div');
      topRow.className = 'flex justify-between items-center';
      // Left: icon + name
      const left = document.createElement('span');
      left.className = 'flex items-center';
      // Reduce gap between icon and name
      left.style.gap = '2px';
      const icon = document.createElement('img');
      icon.src = stat.icon;
      icon.alt = stat.label;
      icon.style.width = '16px';
      icon.style.height = '16px';
      icon.style.marginRight = '2px';
      left.appendChild(icon);
      const nameSpan = document.createElement('span');
      nameSpan.textContent = stat.label;
      left.appendChild(nameSpan);
      // Right: value
      const valueSpan = document.createElement('span');
      valueSpan.textContent = value;
      valueSpan.className = 'text-right text-whiteExp';
      valueSpan.style.textAlign = 'right';
      valueSpan.style.minWidth = '3.5ch';
      valueSpan.style.maxWidth = '5ch';
      valueSpan.style.marginLeft = '6px'; // small gap from name
      valueSpan.style.overflow = 'hidden';
      valueSpan.style.whiteSpace = 'nowrap';
      valueSpan.style.display = 'inline-block';
      // Assemble top row
      topRow.appendChild(left);
      topRow.appendChild(valueSpan);
      // Bar row
      const barRow = document.createElement('div');
      barRow.className = 'relative';
      // Bar outer
      const barOuter = document.createElement('div');
      barOuter.className = 'h-1 w-full border border-solid border-black bg-black frame-pressed-1 relative overflow-hidden duration-300 fill-mode-forwards gene-stats-bar-filled';
      barOuter.style.animationDelay = '700ms';
      // Bar fill wrapper
      const barFillWrap = document.createElement('div');
      barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';
      // Bar fill
      const barFill = document.createElement('div');
      barFill.className = 'h-full shrink-0';
      barFill.style.width = barWidth + '%';
      barFill.style.background = stat.barColor;
      barFillWrap.appendChild(barFill);
      barOuter.appendChild(barFillWrap);
      // Bar right effect (optional, for particles)
      const barRight = document.createElement('div');
      barRight.className = 'absolute left-full top-1/2 -translate-y-1/2';
      barRight.style.display = 'block';
      const skillBar = document.createElement('div');
      skillBar.className = 'relative text-skillBar';
      const spill1 = document.createElement('div');
      spill1.className = 'spill-particles absolute left-full h-px w-0.5 bg-current';
      const spill2 = document.createElement('div');
      spill2.className = 'spill-particles-2 absolute left-full h-px w-0.5 bg-current';
      skillBar.appendChild(spill1);
      skillBar.appendChild(spill2);
      barRight.appendChild(skillBar);
      // Assemble bar row
      barRow.appendChild(barOuter);
      barRow.appendChild(barRight);
      // Add to statRow
      statRow.appendChild(topRow);
      statRow.appendChild(barRow);
      // Add to statsDiv
      statsDiv.appendChild(statRow);
    });
  } else {
    statsDiv.textContent = 'Stats not available';
  }
  return statsDiv;
}

function renderCreatureTemplate(name) {
  // --- Wait for monster data to be available ---
  let monstersArr = null;
  if (
    globalThis.state &&
    globalThis.state.player &&
    typeof globalThis.state.player.getSnapshot === 'function'
  ) {
    const playerContext = globalThis.state.player.getSnapshot().context;
    if (playerContext && Array.isArray(playerContext.monsters)) {
      monstersArr = playerContext.monsters;
    }
  }
  if (!monstersArr || monstersArr.length === 0) {
    setTimeout(() => {
      // Find the right column to re-render (must match your layout)
      // We'll use a class selector for the rightCol, which is the second child of the main flex row
      const flexRows = document.querySelectorAll('div[role="dialog"] .modal-content > div');
      let rightCol = null;
      if (flexRows && flexRows.length > 0) {
        // Try to find the rightCol by looking for a flex row with >1 child
        for (const flexRow of flexRows) {
          if (flexRow.childNodes.length > 1) {
            rightCol = flexRow.childNodes[1];
            break;
          }
        }
      }
      if (rightCol) {
        rightCol.innerHTML = '';
        rightCol.appendChild(renderCreatureTemplate(name));
      } else {
        // Fallback: just retry
        renderCreatureTemplate(name);
      }
    }, 200);
    // Return a placeholder while waiting
    const waitingDiv = document.createElement('div');
    waitingDiv.textContent = 'Loading creature data...';
    waitingDiv.style.textAlign = 'center';
    waitingDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
    waitingDiv.style.fontSize = '16px';
    waitingDiv.style.padding = '32px';
    return waitingDiv;
  }

  // Always rebuild the monster name map
  buildCyclopediaMonsterNameMap();
  // Debug: Log when rendering a creature template
  if (window && window.Cyclopedia && Array.isArray(window.Cyclopedia.unobtainableDebug)) {
    window.Cyclopedia.unobtainableDebug.push(name);
  }
  if (typeof unobtainableCreatures !== 'undefined' && unobtainableCreatures.includes(name)) {
  }
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.gap = '0';

  // Column 1: Creature Information (2 rows, 50% each, separator in the middle)
  const col1 = document.createElement('div');
  col1.style.display = 'flex';
  col1.style.flexDirection = 'column';
  col1.style.width = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col1.style.minWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col1.style.maxWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col1.style.height = '100%';
  col1.style.borderRight = '6px solid transparent';
  col1.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';
  col1.style.boxSizing = 'border-box';
  col1.style.marginRight = '0';
  col1.style.paddingRight = '0';
  // Creature Information title
  const col1Title = document.createElement('h2');
  col1Title.className = 'widget-top widget-top-text pixel-font-16';
  col1Title.style.margin = '0';
  col1Title.style.padding = '2px 0';
  col1Title.style.textAlign = 'center';
  col1Title.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col1Title.style.width = '100%';
  col1Title.style.boxSizing = 'border-box';
  col1Title.style.display = 'block';
  col1Title.style.position = 'relative';
  col1Title.style.top = '0';
  col1Title.style.left = '0';
  col1Title.style.right = '0';
  col1Title.style.marginLeft = '0';
  col1Title.style.width = '100%';
  col1Title.style.marginBottom = '5px'; // Add 5px space below
  const col1TitleP = document.createElement('p');
  col1TitleP.textContent = name || 'Creature Information';
  col1TitleP.className = 'pixel-font-16';
  col1TitleP.style.margin = '0';
  col1TitleP.style.padding = '0';
  col1TitleP.style.textAlign = 'center';
  col1TitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col1Title.appendChild(col1TitleP);
  // Picture Placeholder directly under title
  const col1Picture = document.createElement('div');
  col1Picture.style.textAlign = 'center';
  col1Picture.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col1Picture.style.fontSize = '15px';
  col1Picture.style.padding = '8px 0';
  col1Picture.style.display = 'flex';
  col1Picture.style.justifyContent = 'center';
  col1Picture.style.alignItems = 'center'; // Center vertically
  col1Picture.style.height = '110px';
  let monsterId = null;
  let monster = null;
  if (cyclopediaState.monsterNameMap && typeof name === 'string') {
    const entry = cyclopediaState.monsterNameMap.get(name.toLowerCase());
    if (entry) {
      monster = entry.monster;
      monsterId = monster.gameId !== undefined ? monster.gameId : entry.index;
      if (monsterId === undefined) {
      }
      let monsterSprite;
      if (monster && monster.metadata && monster.metadata.lookType === 'item') {
        // Render as item
        monsterSprite = api.ui.components.createItemPortrait({
          itemId: monster.metadata.spriteId,
          size: 'large'
        });
        // Set outer container size
        [monsterSprite.style.width,
         monsterSprite.style.height,
         monsterSprite.style.minWidth,
         monsterSprite.style.minHeight,
         monsterSprite.style.maxWidth,
         monsterSprite.style.maxHeight] =
         ['70px', '70px', '70px', '70px', '70px', '70px'];
        // Set inner portrait size
        const portrait = monsterSprite.querySelector('.equipment-portrait');
        if (portrait) {
          ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'].forEach(
            prop => portrait.style[prop] = '70px'
          );
        }
      } else {
        // Render as monster (works for both 'monster' and 'outfit')
        monsterSprite = api.ui.components.createFullMonster({
          monsterId: monsterId,
          tier: 1,
          starTier: 1,
          level: 1,
          size: 'small'
        });
      }
      // Force portrait size to 70x70 for both item and monster/outfit
      [monsterSprite.style.width,
       monsterSprite.style.height,
       monsterSprite.style.minWidth,
       monsterSprite.style.minHeight,
       monsterSprite.style.maxWidth,
       monsterSprite.style.maxHeight] =
       ['70px', '70px', '70px', '70px', '70px', '70px'];
      // Remove the level badge
      const levelBadge = monsterSprite.querySelector('span.pixel-font-16');
      if (levelBadge) levelBadge.remove();
      // Remove the star tier icon
      const starTierIcon = monsterSprite.querySelector('img[alt="star tier"]');
      if (starTierIcon) starTierIcon.remove();
      col1Picture.innerHTML = '';
      col1Picture.appendChild(monsterSprite);
      // Debug: log all descendant divs and their styles
      const allDivs = monsterSprite.querySelectorAll('div');
      let firstFixedDiv = null;
      allDivs.forEach((div, idx) => {
        const style = div.getAttribute('style') || '';
        // If this div has max-width or max-height set to 34px, override it
        if (style.includes('max-width: 34px') || style.includes('max-height: 34px')) {
          div.style.width = '110px';
          div.style.height = '110px';
          div.style.maxWidth = '110px';
          div.style.maxHeight = '110px';
          if (!firstFixedDiv) firstFixedDiv = div;
        }
      });
      // Also log and set for parent and grandparent of the first fixed div
      if (firstFixedDiv) {
        let parent = firstFixedDiv.parentElement;
        let step = 0;
        while (parent && step < 3) {
          parent.style.width = '110px';
          parent.style.maxWidth = '110px';
          parent = parent.parentElement;
          step++;
        }
      }
    } else {
      col1Picture.textContent = 'Picture Placeholder';
    }
  } else {
    col1Picture.textContent = 'Picture Placeholder';
  }
  // Flex container for 2 rows
  const col1FlexRows = document.createElement('div');
  col1FlexRows.style.display = 'flex';
  col1FlexRows.style.flexDirection = 'column';
  col1FlexRows.style.height = '100%';
  col1FlexRows.style.flex = '1 1 0';
  col1FlexRows.style.justifyContent = 'flex-start'; // Place content at the top

  // Top area: portrait (left) + stats (right)
  const col1TopArea = document.createElement('div');
  col1TopArea.style.display = 'flex';
  col1TopArea.style.flexDirection = 'row';
  col1TopArea.style.alignItems = 'flex-start'; // Top align portrait and stats
  col1TopArea.style.justifyContent = 'flex-start'; // Align to left
  col1TopArea.style.height = '35%'; // Set height to 35% of col1
  col1TopArea.style.marginLeft = '0';
  col1TopArea.style.paddingLeft = '0';
  col1TopArea.style.marginBottom = '5px'; // Add 5px space below
  // Portrait (left)
  col1Picture.style.marginRight = '4px'; // Small gap between portrait and stats
  col1Picture.style.flex = '0 0 auto';
  col1Picture.style.height = 'auto';
  col1Picture.style.width = '72px';
  col1Picture.style.minWidth = '72px';
  col1Picture.style.maxWidth = '72px';
  col1Picture.style.display = 'flex';
  col1Picture.style.flexDirection = 'column';
  col1Picture.style.alignItems = 'center';
  col1Picture.style.justifyContent = 'flex-start';
  col1Picture.style.margin = '0';
  col1Picture.style.padding = '0'; // Remove all vertical padding for top alignment
  // If the monster sprite exists, set its size to 72x72
  if (col1Picture.firstChild && col1Picture.firstChild.style) {
    col1Picture.firstChild.style.width = '72px';
    col1Picture.firstChild.style.height = '72px';
    col1Picture.firstChild.style.maxWidth = '72px';
    col1Picture.firstChild.style.maxHeight = '72px';
    col1Picture.firstChild.style.minWidth = '72px';
    col1Picture.firstChild.style.minHeight = '72px';
    col1Picture.firstChild.style.margin = '0';
  }

  // --- NEW: Ability icon under portrait ---
  // Add 10px margin below the portrait for the ability icon
  const abilitySpacer = document.createElement('div');
  abilitySpacer.style.height = '10px';
  abilitySpacer.style.width = '100%';
  col1Picture.appendChild(abilitySpacer);

  // Ability icon frame container
  const abilityIconFrame = document.createElement('div');
  abilityIconFrame.style.width = '70px';
  abilityIconFrame.style.height = '70px';
  abilityIconFrame.style.display = 'flex';
  abilityIconFrame.style.alignItems = 'center';
  abilityIconFrame.style.justifyContent = 'center';
  abilityIconFrame.style.backgroundImage = "url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png')";
  abilityIconFrame.style.backgroundSize = 'cover';
  abilityIconFrame.style.backgroundRepeat = 'no-repeat';
  abilityIconFrame.style.backgroundPosition = 'center';
  abilityIconFrame.style.margin = '0';

  // Get the monster's ability icon
  let abilityIconPath = null;
  try {
    const monsterData = monsterId ? safeGetMonsterData(monsterId) : null;
    if (
      monsterData &&
      monsterData.metadata &&
      monsterData.metadata.skill
    ) {
      if (monsterData.metadata.skill.icon) {
        abilityIconPath = monsterData.metadata.skill.icon;
      } else if (monsterData.metadata.skill.src) {
        abilityIconPath = `https://bestiaryarena.com/assets/spells/${monsterData.metadata.skill.src}.png`;
      } else {
      }
    }
  } catch (err) {
    console.error('[Cyclopedia][DEBUG] Error extracting ability icon for', name, err);
  }

  if (abilityIconPath) {
    const abilityImg = document.createElement('img');
    abilityImg.src = abilityIconPath;
    abilityImg.alt = 'Ability Icon';
    abilityImg.width = 48;
    abilityImg.height = 48;
    abilityImg.style.width = '48px';
    abilityImg.style.height = '48px';
    abilityImg.className = 'pixelated'; // for retro look, optional
    abilityIconFrame.appendChild(abilityImg);
  } else {
    abilityIconFrame.textContent = 'No ability icon';
  }

  col1Picture.appendChild(abilityIconFrame);

  // Stats (right) - Use lazy loading for better performance
  const statsDiv = document.createElement('div');
  statsDiv.textContent = 'Loading stats...';
  statsDiv.style.textAlign = 'center';
  statsDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  statsDiv.style.padding = '0'; // Remove all padding for top alignment
  statsDiv.style.margin = '0'; // Remove all margin for pixel-perfect alignment
  statsDiv.style.alignSelf = 'unset';
  
  // Lazy load monster data for stats
  if (monsterId) {
    queueMonsterDataLoad(monsterId, (monsterData) => {
      const actualStatsDiv = renderMonsterStats(monsterData);
      statsDiv.innerHTML = '';
      statsDiv.appendChild(actualStatsDiv);
    });
  } else {
    statsDiv.textContent = 'Stats not available';
  }
  
  // Assemble top area
  col1TopArea.appendChild(col1Picture);
  col1TopArea.appendChild(statsDiv);

  // Ability section (moved from col2)
  const abilitySection = document.createElement('div');
  abilitySection.setAttribute('data-ability-section', 'true');
  abilitySection.style.marginTop = '0';
  abilitySection.style.width = '100%';
  // Title as h2, centered, with separator
  const abilityTitle = document.createElement('h2');
  abilityTitle.className = 'widget-top widget-top-text pixel-font-16';
  abilityTitle.style.margin = '0';
  abilityTitle.style.padding = '2px 0';
  abilityTitle.style.textAlign = 'center';
  abilityTitle.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  abilityTitle.style.width = '100%';
  abilityTitle.style.boxSizing = 'border-box';
  abilityTitle.style.display = 'block';
  abilityTitle.style.position = 'relative';
  abilityTitle.style.top = '0';
  abilityTitle.style.left = '0';
  abilityTitle.style.right = '0';
  abilityTitle.style.marginLeft = '0';
  abilityTitle.style.width = '100%';
  const abilityTitleP = document.createElement('p');
  abilityTitleP.textContent = 'Ability';
  abilityTitleP.className = 'pixel-font-16';
  abilityTitleP.style.margin = '0';
  abilityTitleP.style.padding = '0';
  abilityTitleP.style.textAlign = 'center';
  abilityTitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  abilityTitle.appendChild(abilityTitleP);
  abilitySection.appendChild(abilityTitle);
  // Separator
  const abilitySeparator = document.createElement('div');
  abilitySeparator.className = 'separator my-2.5';
  abilitySeparator.setAttribute('role', 'none');
  abilitySeparator.style.margin = '10px 0';
  abilitySection.appendChild(abilitySeparator);
  // List
  const abilityList = document.createElement('ul');
  abilityList.style.listStyle = 'none';
  abilityList.style.padding = '0';
  abilityList.style.margin = '0';
  abilityList.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  abilityList.style.fontSize = '13px';
  
  // Create ability tooltip container
  const abilityContainer = document.createElement('li');
  abilityContainer.style.padding = '4px 6px';
  abilityContainer.style.margin = '0';
  abilityContainer.style.width = '100%';
  abilityContainer.style.boxSizing = 'border-box';
  
  // Try to get monster ability data
  let tooltipComponent = null;
  try {
    const abilityMonsterData = monsterId ? safeGetMonsterData(monsterId) : null;
    if (abilityMonsterData && abilityMonsterData.metadata && abilityMonsterData.metadata.skill && abilityMonsterData.metadata.skill.TooltipContent) {
      // Create root element for the tooltip
      const rootElement = document.createElement('div');
      rootElement.classList.add('tooltip-prose');
      rootElement.classList.add('pixel-font-16');
      rootElement.style.width = '100%';
      rootElement.style.height = '100%';
      rootElement.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      rootElement.style.fontSize = '11px';
      rootElement.style.lineHeight = '1.4';
      rootElement.style.fontFamily = LAYOUT_CONSTANTS.FONTS.PRIMARY;
      
      // Get the ability tooltip content
      const AbilityTooltip = abilityMonsterData.metadata.skill.TooltipContent;
      
      // Create the UI component
      if (typeof globalThis.state.utils.createUIComponent === 'function') {
        tooltipComponent = globalThis.state.utils.createUIComponent(rootElement, AbilityTooltip);
        
        // Mount the component
        if (tooltipComponent && typeof tooltipComponent.mount === 'function') {
          tooltipComponent.mount();
          abilityContainer.appendChild(rootElement);
          // Set font size for all blockquotes in the tooltip
          const blockquotes = rootElement.querySelectorAll('blockquote');
          blockquotes.forEach(bq => {
            bq.style.setProperty('font-size', '10px', 'important');
          });
          // (Blockquote removal code removed, blockquotes will now be shown)
          // --- Dynamic font size adjustment for overflow ---
          setTimeout(() => {
            let fontSize = 12;
            const minFontSize = 9;
            while ((rootElement.scrollHeight > rootElement.clientHeight || rootElement.scrollWidth > rootElement.clientWidth) && fontSize > minFontSize) {
              fontSize--;
              rootElement.style.fontSize = fontSize + 'px';
            }
          }, 0);
          // --- End dynamic font size adjustment ---
        } else {
          // Fallback if component mounting fails
          abilityContainer.textContent = 'Ability data available but could not render tooltip';
        }
      } else {
        // Fallback if createUIComponent is not available
        abilityContainer.textContent = 'Ability tooltip system not available';
      }
    } else {
      // No ability data found
      abilityContainer.textContent = 'No ability data available';
      abilityContainer.style.fontStyle = 'italic';
      abilityContainer.style.color = '#888';
    }
  } catch (error) {
    console.error('[Cyclopedia] Error rendering ability tooltip:', error);
    abilityContainer.textContent = 'Error loading ability data';
    abilityContainer.style.fontStyle = 'italic';
    abilityContainer.style.color = LAYOUT_CONSTANTS.COLORS.ERROR;
  }
  
  abilityList.appendChild(abilityContainer);
  abilitySection.appendChild(abilityList);
  
  // Store the tooltip component for cleanup later
  if (tooltipComponent) {
    abilitySection._tooltipComponent = tooltipComponent;
  }

  // Assemble flex rows
  col1FlexRows.appendChild(col1TopArea);
  col1FlexRows.appendChild(abilitySection);
  // Assemble column 1
  col1.appendChild(col1Title);
  col1.appendChild(col1FlexRows);

  // Column 2: Ability (top 50%) and Drops (bottom 50%)
  const col2 = document.createElement('div');
  col2.style.display = 'flex';
  col2.style.flexDirection = 'column';
  col2.style.width = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col2.style.minWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col2.style.maxWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col2.style.height = '100%';
  col2.style.padding = '0'; // Remove padding from the column
  col2.style.margin = '0';
  col2.style.marginLeft = '0';
  col2.style.paddingLeft = '0';
  col2.style.borderRight = '6px solid transparent';
  col2.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 6 6 6 fill stretch';

  // Drops Section (bottom 50%)
  const dropsSection = document.createElement('div');
  dropsSection.style.height = '50%';
  dropsSection.style.display = 'flex';
  dropsSection.style.flexDirection = 'column';
  dropsSection.style.fontFamily = LAYOUT_CONSTANTS.FONTS.PRIMARY;
  dropsSection.style.fontSize = '14px'; // Match statsDiv font size
  dropsSection.className = 'pixel-font-16'; // Match statsDiv font
  // Title as h2, centered, with separator
  const dropsTitle = document.createElement('h2');
  dropsTitle.className = 'widget-top widget-top-text pixel-font-16';
  dropsTitle.style.margin = '0';
  dropsTitle.style.padding = '2px 0';
  dropsTitle.style.textAlign = 'center';
  dropsTitle.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  dropsTitle.style.width = '100%';
  dropsTitle.style.boxSizing = 'border-box';
  dropsTitle.style.display = 'block';
  dropsTitle.style.position = 'relative';
  dropsTitle.style.top = '0';
  dropsTitle.style.left = '0';
  dropsTitle.style.right = '0';
  dropsTitle.style.marginLeft = '0';
  dropsTitle.style.width = '100%';
  const dropsTitleP = document.createElement('p');
  dropsTitleP.textContent = 'Location';
  dropsTitleP.className = 'pixel-font-16';
  dropsTitleP.style.margin = '0';
  dropsTitleP.style.padding = '0';
  dropsTitleP.style.textAlign = 'center';
  dropsTitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  dropsTitle.appendChild(dropsTitleP);
  dropsSection.appendChild(dropsTitle);
  // List (Cyclopedia style)
  const dropsList = document.createElement('div'); // Use a div for more control
  dropsList.style.padding = '12px 10px 12px 10px'; // Add padding under the title
  dropsList.style.display = 'flex';
  dropsList.style.flexDirection = 'column';
  dropsList.style.gap = '10px'; // Space between location groups
  dropsList.style.marginTop = '4px';
  dropsList.style.marginBottom = '4px';
  dropsList.style.fontFamily = 'var(--font-filled)';
  dropsList.style.fontSize = '16px';
  dropsList.style.lineHeight = '1';
  dropsList.style.letterSpacing = '.0625rem';
  dropsList.style.wordSpacing = '-.1875rem';
  dropsList.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  // Find monster locations
  let monsterLocations = [];
  try {
    monsterLocations = findMonsterLocations(name);
  } catch (error) {
    // No debug here
  }
  if (monsterLocations.length > 0) {
    // --- Group locations by region ---
    // Helper to capitalize region names
    function capitalizeRegionName(name) {
      if (!name) return '';
      // Manual mapping for special cases
      if (name.toLowerCase() === 'rook') return 'Rookgaard';
      if (name.toLowerCase() === 'abdendriel') return 'Ab\'Dendriel';
      // Default: Title Case
      return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    // Build a map: regionName -> [{ roomName, positions }]
    const regionMap = new Map();
    monsterLocations.forEach((location) => {
      let translatedRoomName = location.roomId;
      let regionName = 'Unknown Region';
      let regionEntry = null;
      try {
        const rooms = globalThis.state.utils.ROOMS;
        const regions = globalThis.state.utils.REGIONS;
        const roomEntry = rooms[location.roomId];
        if (roomEntry && globalThis.state.utils.ROOM_NAME[roomEntry.id]) {
          translatedRoomName = globalThis.state.utils.ROOM_NAME[roomEntry.id];
        }
        // Region lookup
        if (roomEntry && roomEntry.region) {
          if (regions && typeof regions === 'object' && !Array.isArray(regions)) {
            regionEntry = regions[roomEntry.region];
          }
          if (!regionEntry && Array.isArray(regions)) {
            regionEntry = regions.find(r => r.id === roomEntry.region);
          }
          if (regionEntry && regionEntry.name) {
            regionName = regionEntry.name;
          } else if (regionEntry && regionEntry.id) {
            regionName = regionEntry.id;
          }
        } else if (Array.isArray(regions) && roomEntry && roomEntry.id) {
          for (const reg of regions) {
            if (Array.isArray(reg.rooms)) {
              if (reg.rooms.some(r => r.id === roomEntry.id)) {
                regionEntry = reg;
                break;
              }
            }
          }
          if (regionEntry) {
            regionName = regionEntry.name || regionEntry.id;
          }
        }
      } catch (e) {}
      regionName = capitalizeRegionName(regionName);
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, []);
      }
      regionMap.get(regionName).push({ roomName: translatedRoomName, positions: location.positions });
    });
    // --- Render grouped locations ---
    if (regionMap.size > 0) {
      for (const [regionName, rooms] of regionMap.entries()) {
        // Region heading
        const regionDiv = document.createElement('div');
        regionDiv.style.fontWeight = '700'; // Match cyclopedia-subnav
        regionDiv.style.fontFamily = LAYOUT_CONSTANTS.FONTS.PRIMARY;
        regionDiv.style.fontSize = '16px'; // Was 18px
        regionDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
        regionDiv.style.background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";
        regionDiv.style.border = '6px solid transparent';
        regionDiv.style.borderColor = '#ffe066';
        regionDiv.style.borderImage = "url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch";
        regionDiv.style.color = 'var(--theme-text, #e6d7b0)';
        regionDiv.style.fontFamily = "'Trebuchet MS', 'Arial Black', Arial, sans-serif";
        regionDiv.style.fontWeight = '700';
        regionDiv.style.fontSize = '16px';
        regionDiv.style.borderRadius = '0';
        regionDiv.style.boxSizing = 'border-box';
        regionDiv.style.textAlign = 'center';
        regionDiv.style.padding = '1px 4px';
        regionDiv.style.margin = '1px 0 0 0';
        regionDiv.style.display = 'block';
        regionDiv.style.textAlign = 'center'; // Centered
        regionDiv.textContent = regionName;
        dropsList.appendChild(regionDiv);
        // Each room in this region
        rooms.forEach(({ roomName, positions }) => {
          const roomDiv = document.createElement('div');
          roomDiv.style.fontWeight = 'bold';
          roomDiv.style.fontFamily = LAYOUT_CONSTANTS.FONTS.PRIMARY;
          roomDiv.style.fontSize = '14px';
          roomDiv.style.lineHeight = '1';
          roomDiv.style.letterSpacing = '.0625rem';
          roomDiv.style.wordSpacing = '-.1875rem';
          roomDiv.style.margin = '0'; // Remove margin
          roomDiv.style.padding = '2px 6px'; // More compact padding
          roomDiv.style.borderRadius = '4px'; // Set constant border-radius
          roomDiv.style.display = 'block';
          roomDiv.style.textAlign = 'left';
          roomDiv.textContent = roomName;
          roomDiv.style.cursor = 'pointer';
          roomDiv.style.textDecoration = 'underline'; // Make room names look clickable
          // Restore click handler for room selection
          // Find the original location object for this roomName in this region
          let foundLocation = null;
          for (const loc of monsterLocations) {
            let translatedRoomName = loc.roomId;
            const roomsObj = globalThis.state.utils.ROOMS;
            if (roomsObj && roomsObj[loc.roomId] && globalThis.state.utils.ROOM_NAME[roomsObj[loc.roomId].id]) {
              translatedRoomName = globalThis.state.utils.ROOM_NAME[roomsObj[loc.roomId].id];
            }
            if (translatedRoomName === roomName) {
              foundLocation = loc;
              break;
            }
          }
          if (foundLocation) {
            roomDiv.addEventListener('mouseenter', () => {
              roomDiv.style.background = 'rgba(255,255,255,0.08)';
              roomDiv.style.color = '#4a9eff';
            });
            roomDiv.addEventListener('mouseleave', () => {
              roomDiv.style.background = 'none';
              roomDiv.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            });
            roomDiv.addEventListener('click', () => {
              const roomCode = globalThis.state.utils.ROOMS[foundLocation.roomId]?.id;
              if (roomCode) {
                globalThis.state.board.send({
                  type: 'selectRoomById',
                  roomId: roomCode
                });
                // Simulate pressing the modal Close button
                const closeBtn = Array.from(document.querySelectorAll('button.pixel-font-14')).find(
                  btn => btn.textContent.trim() === 'Close'
                );
                if (closeBtn) {
                  closeBtn.click();
                }
              } else {
                console.warn('Cyclopedia: Could not find room code for', foundLocation.roomId);
              }
            });
          }
          dropsList.appendChild(roomDiv);
          // Levels for this room
          positions.forEach((pos) => {
            const detail = document.createElement('div');
            detail.textContent = `Lv: ${pos.level}`;
            detail.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
            detail.style.fontFamily = 'var(--font-filled)';
            detail.style.fontSize = '12px'; // Was 14px
            detail.style.lineHeight = '1';
            detail.style.letterSpacing = '.0625rem';
            detail.style.wordSpacing = '-.1875rem';
            detail.style.marginLeft = '6px'; // More compact
            detail.style.marginTop = '0px'; // More compact
            dropsList.appendChild(detail);
          });
          // Always add a separator after the last Lv for this room
          const separator = document.createElement('div');
          separator.className = 'separator my-2.5';
          separator.setAttribute('role', 'none');
          separator.style.margin = '10px 0';
          dropsList.appendChild(separator);
        });
      }
    } else {
      // No locations found
      const noLocationItem = document.createElement('div');
      noLocationItem.textContent = 'No locations found';
      noLocationItem.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      noLocationItem.style.fontFamily = 'var(--font-filled)';
      noLocationItem.style.fontSize = '16px';
      noLocationItem.style.lineHeight = '1';
      noLocationItem.style.letterSpacing = '.0625rem';
      noLocationItem.style.wordSpacing = '-.1875rem';
      noLocationItem.style.fontStyle = 'italic';
      noLocationItem.className = 'pixel-font-16';
      dropsList.appendChild(noLocationItem);
    }
  } else {
    // No locations found
    const noLocationItem = document.createElement('div');
    noLocationItem.textContent = 'No locations found';
    noLocationItem.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
    noLocationItem.style.fontFamily = 'var(--font-filled)';
    noLocationItem.style.fontSize = '16px';
    noLocationItem.style.lineHeight = '1';
    noLocationItem.style.letterSpacing = '.0625rem';
    noLocationItem.style.wordSpacing = '-.1875rem';
    noLocationItem.style.fontStyle = 'italic';
    noLocationItem.className = 'pixel-font-16';
    dropsList.appendChild(noLocationItem);
  }
  dropsSection.appendChild(dropsList);

  // Add sections to col2
  col2.appendChild(dropsSection);

  // Column 3: Owned creatures (compact)
  const col3 = document.createElement('div');
  col3.style.display = 'flex';
  col3.style.flexDirection = 'column';
  col3.style.width = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col3.style.minWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col3.style.maxWidth = LAYOUT_CONSTANTS.COLUMN_WIDTH;
  col3.style.height = '100%';
  col3.style.minHeight = '0';
  col3.style.maxHeight = '100%';
  // --- NEW: Show all owned versions of the selected creature using monsterId ---
  let ownedMonsters = [];
  try {
    const playerContext = globalThis.state?.player?.getSnapshot?.().context;
    if (playerContext && Array.isArray(playerContext.monsters) && monsterId != null) {
      ownedMonsters = playerContext.monsters.filter(m => m.gameId === monsterId);
    }
  } catch (e) {}
  const col3Title = document.createElement('h2');
  col3Title.className = 'widget-top widget-top-text pixel-font-16';
  col3Title.style.margin = '0';
  col3Title.style.padding = '2px 0';
  col3Title.style.textAlign = 'center';
  col3Title.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col3Title.style.width = '100%';
  col3Title.style.boxSizing = 'border-box';
  col3Title.style.display = 'block';
  col3Title.style.position = 'relative';
  col3Title.style.top = '0';
  col3Title.style.left = '0';
  col3Title.style.right = '0';
  col3Title.style.marginLeft = '0';
  col3Title.style.width = '100%';
  const col3TitleP = document.createElement('p');
  const ownedName = name || '';
  const ownedCount = ownedMonsters.length;
  let pluralName = ownedName;
  if (ownedCount > 1 && ownedName) {
    pluralName = ownedName + 's';
  }
  col3TitleP.textContent = `Owned ${pluralName}${pluralName ? ` (${ownedCount})` : ''}`;
  col3TitleP.className = 'pixel-font-16';
  col3TitleP.style.margin = '0';
  col3TitleP.style.padding = '0';
  col3TitleP.style.textAlign = 'center';
  col3TitleP.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  col3Title.appendChild(col3TitleP);
  // No separator here
  const col3Content = document.createElement('div');
  col3Content.style.display = 'flex';
  col3Content.style.flexDirection = 'column';
  col3Content.style.flex = '1 1 0';
  col3Content.style.minHeight = '0';
  col3Content.style.height = '100%';
  col3Content.style.maxHeight = '100%';
  col3Content.style.overflowY = 'auto';
  col3Content.style.overflowX = 'hidden';
  col3Content.style.scrollbarWidth = 'thin';
  col3Content.style.scrollbarColor = '#444 #222';
  col3Content.style.marginTop = '0'; // Remove top margin
  if (ownedMonsters.length > 0) {
    // Sort by calculated level (desc), then tier (desc), then data rarity (desc)
    ownedMonsters.sort((a, b) => {
      const levelA = getLevelFromExp(a.exp);
      const levelB = getLevelFromExp(b.exp);
      if (levelB !== levelA) return levelB - levelA;
      const tierA = a.tier || 1;
      const tierB = b.tier || 1;
      if (tierB !== tierA) return tierB - tierA;
      // Calculate rarity for both
      const statSumA = (a.hp || 0) + (a.ad || 0) + (a.ap || 0) + (a.armor || 0) + (a.magicResist || 0);
      const statSumB = (b.hp || 0) + (b.ad || 0) + (b.ap || 0) + (b.armor || 0) + (b.magicResist || 0);
      let rarityA = 1;
      let rarityB = 1;
      if (statSumA >= 80) rarityA = 5;
      else if (statSumA >= 70) rarityA = 4;
      else if (statSumA >= 60) rarityA = 3;
      else if (statSumA >= 50) rarityA = 2;
      // else rarityA = 1;
      if (statSumB >= 80) rarityB = 5;
      else if (statSumB >= 70) rarityB = 4;
      else if (statSumB >= 60) rarityB = 3;
      else if (statSumB >= 50) rarityB = 2;
      // else rarityB = 1;
      return rarityB - rarityA;
    });
    ownedMonsters.forEach(monster => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'flex-start';
      row.style.gap = '20px'; // 20px gap between portrait and stats
      row.style.height = '82px'; // Tight fit: 10px larger than portrait
      row.style.margin = '8px 20px 0 20px'; // 8px top, 20px right, 0 bottom, 20px left

      // Portrait
      const portrait = api.ui.components.createFullMonster({
        monsterId: monster.gameId || monster.id,
        tier: 1,
        starTier: monster.tier ?? 0,
        level: getLevelFromExp(monster.exp),
        size: 'small'
      });
      portrait.style.margin = '0';
      // Remove the level badge from the portrait
      const levelBadge = portrait.querySelector('span.pixel-font-16');
      if (levelBadge) levelBadge.remove();

      // Stats grid
      const statsGrid = document.createElement('div');
      statsGrid.style.display = 'grid';
      statsGrid.style.gridTemplateColumns = 'auto auto';
      statsGrid.style.gridTemplateRows = 'repeat(3, auto)';
      statsGrid.style.gap = '2px 12px';
      statsGrid.style.alignSelf = 'center';
      // Font and color for readability
      statsGrid.style.fontFamily = LAYOUT_CONSTANTS.FONTS.PRIMARY;
      statsGrid.style.fontSize = '14px'; // Decreased by 1px
      statsGrid.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
      statsGrid.style.fontWeight = 'bold';
      // Prevent overflow from moving the row
      statsGrid.style.overflow = 'hidden';
      statsGrid.style.textOverflow = 'ellipsis';
      statsGrid.style.whiteSpace = 'nowrap';
      statsGrid.style.maxWidth = '120px'; // Adjust as needed for your layout

      // Helper to create icon+value or label+value
      function statCell(icon, value, isLabel) {
        const cell = document.createElement('div');
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.gap = '4px';
        cell.style.overflow = 'hidden';
        cell.style.textOverflow = 'ellipsis';
        cell.style.whiteSpace = 'nowrap';
        if (isLabel) {
          const label = document.createElement('span');
          label.textContent = icon; // e.g. 'Lv.'
          label.style.fontWeight = 'bold';
          label.style.fontSize = '12px';
          cell.appendChild(label);
        } else {
          const img = document.createElement('img');
          img.src = icon;
          img.style.width = '18px';
          img.style.height = '18px';
          img.style.display = 'inline-block';
          img.style.verticalAlign = 'middle';
          cell.appendChild(img);
        }
        const num = document.createElement('span');
        num.textContent = value;
        num.style.fontWeight = 'bold';
        num.style.fontSize = '12px';
        cell.appendChild(num);
        return cell;
      }

      const level = getLevelFromExp(monster.exp);
      // Row 1: Lv. | AP
      statsGrid.appendChild(statCell('Lv.', level, true));
      statsGrid.appendChild(statCell('/assets/icons/abilitypower.png', monster.ap));
      // Row 2: HP | Armor
      statsGrid.appendChild(statCell('/assets/icons/heal.png', monster.hp));
      statsGrid.appendChild(statCell('/assets/icons/armor.png', monster.armor));
      // Row 3: AD | MR
      statsGrid.appendChild(statCell('/assets/icons/attackdamage.png', monster.ad));
      statsGrid.appendChild(statCell('/assets/icons/magicresist.png', monster.magicResist));

      // Assemble row
      row.appendChild(portrait);
      row.appendChild(statsGrid);
      col3Content.appendChild(row);

      const statSum = (monster.hp || 0) + (monster.ad || 0) + (monster.ap || 0) + (monster.armor || 0) + (monster.magicResist || 0);
      let rarity = 1;
      if (statSum >= 80) rarity = 5;
      else if (statSum >= 70) rarity = 4;
      else if (statSum >= 60) rarity = 3;
      else if (statSum >= 50) rarity = 2;
      // else rarity = 1;
      setTimeout(() => {
        const borderElem = portrait.querySelector('.has-rarity');
        if (borderElem) {
          borderElem.setAttribute('data-rarity', rarity);
        }
      }, 0);
    });
  } else {
    // Show a different message for unobtainable creatures
    if (typeof unobtainableCreatures !== 'undefined' && unobtainableCreatures.includes(name)) {
      col3Content.textContent = 'This creature is unobtainable.';
    } else {
      col3Content.textContent = 'You do not own this creature.';
    }
  }
  // Assemble column 3
  col3.appendChild(col3Title);
  col3.appendChild(col3Content);
  // Append columns to container
  container.appendChild(col1);
  container.appendChild(col2);
  container.appendChild(col3);
  // After col3Content is created, add a unique id for targeting custom scrollbar
  col3Content.id = 'cyclopedia-owned-scroll';
  // Inject custom scrollbar CSS if not already present
  if (!document.getElementById('cyclopedia-owned-scrollbar-style')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-owned-scrollbar-style';
    style.textContent = `
      #cyclopedia-owned-scroll::-webkit-scrollbar {
        width: 12px !important;
        background: transparent !important;
      }
      #cyclopedia-owned-scroll::-webkit-scrollbar-thumb {
        background: url('https://bestiaryarena.com/_next/static/media/scrollbar-handle-vertical.962972d4.png') repeat-y !important;
        border-radius: 4px !important;
      }
      #cyclopedia-owned-scroll::-webkit-scrollbar-corner {
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }
  return container;
}

/**
 * Renders the main Cyclopedia list view.
 * @returns {HTMLElement} The DOM element for the Cyclopedia list.
 */
function renderCyclopediaList() {
  const container = document.createElement('div');
  container.className = 'cyclopedia-list-container';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.background = 'rgba(0,0,0,0.7)';
  container.style.overflowY = 'auto';
  // Title
  const title = document.createElement('h2');
  title.textContent = 'Cyclopedia';
  title.className = 'widget-top widget-top-text pixel-font-16';
  title.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  title.style.textAlign = 'center';
  title.style.margin = '8px 0 16px 0';
  container.appendChild(title);
  // Placeholder for the creature list
  const listPlaceholder = document.createElement('div');
  listPlaceholder.textContent = 'Creature List Placeholder';
  listPlaceholder.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  listPlaceholder.style.textAlign = 'center';
  listPlaceholder.style.fontSize = '15px';
  listPlaceholder.style.margin = '16px 0';
  container.appendChild(listPlaceholder);
  return container;
}

/**
 * Renders the Cyclopedia search bar.
 * @returns {HTMLElement} The DOM element for the search bar.
 */
function renderCyclopediaSearchBar() {
  const searchBar = document.createElement('div');
  searchBar.className = 'cyclopedia-search-bar';
  searchBar.style.display = 'flex';
  searchBar.style.justifyContent = 'center';
  searchBar.style.alignItems = 'center';
  searchBar.style.margin = '8px 0';
  // Input
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search creatures...';
  input.className = 'pixel-font-14';
  input.style.padding = '4px 8px';
  input.style.borderRadius = '4px';
  input.style.border = '1px solid #888';
  input.style.marginRight = '8px';
  input.style.fontSize = '14px';
  // Search button
  const button = document.createElement('button');
  button.textContent = 'Search';
  button.className = 'pixel-font-14';
  button.style.padding = '4px 12px';
  button.style.borderRadius = '4px';
  button.style.border = 'none';
  button.style.background = '#444';
  button.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  button.style.fontSize = '14px';
  // Append
  searchBar.appendChild(input);
  searchBar.appendChild(button);
  return searchBar;
}

/**
 * Renders the Cyclopedia tab navigation.
 * @returns {HTMLElement} The DOM element for the tab navigation.
 */
function renderCyclopediaTabs() {
  const tabs = document.createElement('div');
  tabs.className = 'cyclopedia-tabs';
  tabs.style.display = 'flex';
  tabs.style.justifyContent = 'center';
  tabs.style.alignItems = 'center';
  tabs.style.gap = '12px';
  tabs.style.margin = '12px 0';
  // Placeholder tab buttons
  const allTab = document.createElement('button');
  allTab.textContent = 'All Creatures';
  allTab.className = 'pixel-font-14 cyclopedia-tab-btn';
  allTab.style.padding = '6px 18px';
  allTab.style.borderRadius = '6px';
  allTab.style.border = 'none';
  allTab.style.background = '#333';
  allTab.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  allTab.style.fontSize = '14px';
  const bossesTab = document.createElement('button');
  bossesTab.textContent = 'Bosses';
  bossesTab.className = 'pixel-font-14 cyclopedia-tab-btn';
  bossesTab.style.padding = '6px 18px';
  bossesTab.style.borderRadius = '6px';
  bossesTab.style.border = 'none';
  bossesTab.style.background = '#333';
  bossesTab.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  bossesTab.style.fontSize = '14px';
  const mythsTab = document.createElement('button');
  mythsTab.textContent = 'Myths';
  mythsTab.className = 'pixel-font-14 cyclopedia-tab-btn';
  mythsTab.style.padding = '6px 18px';
  mythsTab.style.borderRadius = '6px';
  mythsTab.style.border = 'none';
  mythsTab.style.background = '#333';
  mythsTab.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  mythsTab.style.fontSize = '14px';
  // Append
  tabs.appendChild(allTab);
  tabs.appendChild(bossesTab);
  tabs.appendChild(mythsTab);
  return tabs;
}

/**
 * Renders a single Cyclopedia list item.
 * @param {Object} creature - The creature data object.
 * @returns {HTMLElement} The DOM element for the list item.
 */
function renderCyclopediaListItem(creature) {
  const item = document.createElement('div');
  item.className = 'cyclopedia-list-item';
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.style.gap = '12px';
  item.style.padding = '8px 16px';
  item.style.margin = '4px 0';
  item.style.background = '#292929';
  item.style.borderRadius = '6px';
  item.style.cursor = 'pointer';
  item.style.transition = 'background 0.2s';
  item.onmouseenter = () => { item.style.background = '#333'; };
  item.onmouseleave = () => { item.style.background = '#292929'; };
  // Placeholder for icon
  const icon = document.createElement('div');
  icon.className = 'cyclopedia-list-item-icon';
  icon.style.width = '32px';
  icon.style.height = '32px';
  icon.style.background = '#444';
  icon.style.borderRadius = '4px';
  icon.style.display = 'flex';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  icon.textContent = '🦎'; // Placeholder emoji
  // Placeholder for name
  const name = document.createElement('span');
  name.className = 'cyclopedia-list-item-name pixel-font-14';
  name.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  name.style.fontSize = '15px';
  name.textContent = creature && creature.name ? creature.name : 'Creature Name';
  // Append
  item.appendChild(icon);
  item.appendChild(name);
  return item;
}

/**
 * Renders the empty state for the Cyclopedia list.
 * @returns {HTMLElement} The DOM element for the empty state.
 */
function renderCyclopediaEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'cyclopedia-empty-state';
  empty.style.display = 'flex';
  empty.style.flexDirection = 'column';
  empty.style.alignItems = 'center';
  empty.style.justifyContent = 'center';
  empty.style.height = '100%';
  empty.style.color = LAYOUT_CONSTANTS.COLORS.WARNING;
  empty.style.fontSize = '18px';
  empty.style.padding = '32px 0';
  empty.textContent = 'No creatures found. Try a different search or tab!';
  return empty;
}

/**
 * Renders the loading state for the Cyclopedia.
 * @returns {HTMLElement} The DOM element for the loading state.
 */
function renderCyclopediaLoading() {
  const loading = document.createElement('div');
  loading.className = 'cyclopedia-loading-state';
  loading.style.display = 'flex';
  loading.style.flexDirection = 'column';
  loading.style.alignItems = 'center';
  loading.style.justifyContent = 'center';
  loading.style.height = '100%';
  loading.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
  loading.style.fontSize = '18px';
  loading.style.padding = '32px 0';
  // Spinner
  const spinner = document.createElement('div');
  spinner.className = 'cyclopedia-spinner';
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.border = '4px solid #444';
  spinner.style.borderTop = '4px solid #fff';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'cyclopedia-spin 1s linear infinite';
  spinner.style.marginBottom = '16px';
  loading.appendChild(spinner);
  // Loading message
  const message = document.createElement('div');
  message.textContent = 'Loading creatures...';
  message.style.textAlign = 'center';
  loading.appendChild(message);
  // Add spinner animation (if not already present)
  if (!document.getElementById('cyclopedia-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'cyclopedia-spinner-style';
    style.textContent = `@keyframes cyclopedia-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
  return loading;
}

/**
 * Renders the error state for the Cyclopedia.
 * @param {string} [messageText] - Optional error message to display.
 * @param {Function} [onRetry] - Optional callback for retry button.
 * @returns {HTMLElement} The DOM element for the error state.
 */
function renderCyclopediaError(messageText, onRetry) {
  const error = document.createElement('div');
  error.className = 'cyclopedia-error-state';
  error.style.display = 'flex';
  error.style.flexDirection = 'column';
  error.style.alignItems = 'center';
  error.style.justifyContent = 'center';
  error.style.height = '100%';
  error.style.color = LAYOUT_CONSTANTS.COLORS.ERROR;
  error.style.fontSize = '18px';
  error.style.padding = '32px 0';
  // Error message
  const message = document.createElement('div');
  message.textContent = messageText || 'An error occurred while loading creatures.';
  message.style.textAlign = 'center';
  error.appendChild(message);
  // Retry button
  if (typeof onRetry === 'function') {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.className = 'pixel-font-14';
    retryBtn.style.marginTop = '16px';
    retryBtn.style.padding = '6px 18px';
    retryBtn.style.borderRadius = '6px';
    retryBtn.style.border = 'none';
    retryBtn.style.background = '#333';
    retryBtn.style.color = LAYOUT_CONSTANTS.COLORS.TEXT;
    retryBtn.style.fontSize = '14px';
    retryBtn.style.cursor = 'pointer';
    retryBtn.onclick = onRetry;
    error.appendChild(retryBtn);
  }
  return error;
}

/**
 * Renders the Cyclopedia modal footer.
 * @returns {HTMLElement} The DOM element for the modal footer.
 */
function renderCyclopediaFooter() {
  const footer = document.createElement('div');
  footer.className = 'cyclopedia-modal-footer';
  footer.style.width = '100%';
  footer.style.textAlign = 'center';
  footer.style.color = LAYOUT_CONSTANTS.COLORS.WARNING;
  footer.style.fontSize = '13px';
  footer.style.marginTop = '24px';
  footer.style.padding = '8px 0 0 0';
  footer.textContent = 'Cyclopedia v1.0 • Powered by Bestiary Arena API'; // Placeholder
  return footer;
}

function renderCyclopediaWelcomeColumn(playerName) {
  const div = document.createElement('div');
  div.style.flex = '1';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.justifyContent = 'center';
  div.style.alignItems = 'center'; // Center the column content horizontally
  div.style.padding = '24px';
  div.style.width = '100%';
  // Headline
  const headline = document.createElement('h2');
  headline.style.color = '#ffe066';
  headline.style.fontSize = '22px';
  headline.style.marginBottom = '12px';
  headline.style.marginTop = '0';
  headline.style.textAlign = 'center'; // Center the headline
  headline.style.width = '100%';
  headline.textContent = `Welcome${playerName ? ' ' + playerName : ''}!`;
  div.appendChild(headline);
  // Description
  const desc = document.createElement('p');
  desc.style.color = '#e6d7b0';
  desc.style.fontSize = '15px';
  desc.style.textAlign = 'left'; // Left align the rest of the text
  desc.style.margin = '0';
  desc.style.width = '100%';
  desc.innerHTML = `
    This is the <b>Cyclopedia</b> mod for Bestiary Arena.<br>
    Here you can view your player profile, browse creatures, and explore game data.<br>
    Use the tabs above to navigate, and click on creatures for detailed info.<br><br>
    <i>Enjoy your adventure!</i>
  `;
  div.appendChild(desc);
  return div;
}

function renderCyclopediaProfileColumn(profileData) {
  const div = document.createElement('div');
  div.style.flex = '2';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.justifyContent = 'center';
  div.style.alignItems = 'center';
  div.style.padding = '24px';
  div.style.background = 'rgba(255,255,255,0.02)';
  div.style.borderRadius = '8px';
  div.style.marginLeft = '16px';

  if (!profileData) {
    div.innerHTML = `<span style="color: #ff6b6b;">No profile data found.</span>`;
    return div;
  }

  // Example: Show player name and some stats if available
  div.innerHTML = `
    <h2 style="color: #ffe066; font-size: 20px; margin-bottom: 10px;">${profileData.name || "Player"}</h2>
    <div style="color: #e6d7b0; font-size: 15px;">
      <b>Level:</b> ${profileData.level || "?"}<br>
      <b>XP:</b> ${profileData.xp || "?"}<br>
      <b>Other info:</b> (customize as needed)
    </div>
  `;
  return div;
}

// Move static config outside the function
const CYCLOPEDIA_MAX_VALUES = {
  perfectCreatures: 66,
  bisEquipments: 87,
  exploredMaps: 62,
  bagOutfits: 192
};
const CYCLOPEDIA_PROGRESS_STATS = [
  { key: 'perfectCreatures', icon: '/assets/icons/enemy.png', max: CYCLOPEDIA_MAX_VALUES.perfectCreatures },
  { key: 'bisEquipments', icon: '/assets/icons/equips.png', max: CYCLOPEDIA_MAX_VALUES.bisEquipments },
  { key: 'exploredMaps', icon: '/assets/icons/map.png', max: CYCLOPEDIA_MAX_VALUES.exploredMaps },
  { key: 'bagOutfits', icon: '/assets/icons/mini-outfitbag.png', max: CYCLOPEDIA_MAX_VALUES.bagOutfits }
];
const CYCLOPEDIA_TRANSLATION = {
  shell: { label: 'Daily Seashell', value: d => d.shell },
  tasks: { label: 'Hunting tasks', value: d => d.tasks },
  playCount: { label: 'Total runs', value: d => d.playCount },
  perfectCreatures: { label: 'Perfect Creatures', value: d => d.perfectMonsters },
  bisEquipments: { label: 'BIS Equipments', value: d => d.bisEquips },
  exploredMaps: { label: 'Explored maps', value: d => d.maps },
  bagOutfits: { label: 'Bag Outfits', value: d => d.ownedOutfits },
  rankPoints: { label: 'Rank points', value: d => d.rankPoints },
  timeSum: { label: 'Time sum', value: d => d.ticks },
  createdAt: { label: 'Created at', value: d => formatDate(d.createdAt) },
  level: { label: 'Level', value: d => (typeof d.exp === 'number' ? Math.floor(d.exp / 400) + 1 : '?') },
  xp: { label: 'XP', value: d => d.exp },
  name: { label: 'Player', value: d => d.name },
  premium: { label: 'Status', value: d => d.premium ? 'Premium' : 'Free' },
};

// Add CSS class for maxed stats if not present
if (!document.getElementById('cyclopedia-maxed-style')) {
  const style = document.createElement('style');
  style.id = 'cyclopedia-maxed-style';
  style.textContent = `.stat-maxed { color: #3ecf4a !important; }`;
  document.head.appendChild(style);
}

function renderCyclopediaPlayerInfo(profileData) {
  if (profileData && profileData.json) profileData = profileData.json;
  if (!profileData) {
    const div = document.createElement('div');
    div.innerHTML = `<span style="color: #ff6b6b;">No profile data found.</span>`;
    return div;
  }

  function formatNumber(n) {
    return n !== undefined ? n.toLocaleString() : '-';
  }
  function getProfileValue(key) {
    if (CYCLOPEDIA_TRANSLATION[key] && typeof CYCLOPEDIA_TRANSLATION[key].value === 'function') {
      return CYCLOPEDIA_TRANSLATION[key].value(profileData);
    }
    return profileData[key] !== undefined ? profileData[key] : '-';
  }

  // Refactored addRow to use options object
  function addRow({ label, icon, value, highlight, colspan, title, extraIcon, tooltip, valueClass }) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-highlight', highlight ? 'true' : 'false');
    tr.className = 'group/row odd:bg-grayBrightest even:bg-grayHighlight hover:bg-whiteDarkest hover:text-whiteBrightest data-[highlight=\'true\']:bg-whiteDarkest data-[highlight=\'true\']:text-whiteBrightest';
    if (colspan) {
      const td = document.createElement('td');
      td.className = highlight ? 'bg-grayDark px-1 text-whiteHighlight table-frame-bottom' : 'bg-grayDark px-1 text-whiteHighlight table-frame-y';
      td.colSpan = colspan;
      td.textContent = label;
      tr.appendChild(td);
    } else {
      const td1 = document.createElement('td');
      td1.className = 'bg-grayRegular px-1 text-whiteRegular group-hover/row:bg-grayHighlight';
      if (icon) {
        const img = document.createElement('img');
        img.alt = label;
        img.src = icon;
        img.className = 'pixelated mr-1 inline-block -translate-y-0.5';
        img.width = 11;
        img.height = 11;
        td1.appendChild(img);
      }
      td1.appendChild(document.createTextNode(label));
      const td2 = document.createElement('td');
      td2.className = 'px-1 align-middle [&:not(:first-child)]:table-frame-left text-center';
      if (title) td2.title = title;
      td2.textContent = value;
      if (valueClass) td2.classList.add(valueClass);
      if (extraIcon) {
        const extraImg = document.createElement('img');
        extraImg.alt = extraIcon.alt;
        extraImg.src = extraIcon.src;
        extraImg.width = extraIcon.width || 11;
        extraImg.height = extraIcon.height || 11;
        extraImg.className = extraIcon.className || 'pixelated inline-block -translate-y-0.5';
        td2.appendChild(extraImg);
      }
      if (tooltip) {
        td2.title = tooltip;
      }
      tr.appendChild(td1);
      tr.appendChild(td2);
    }
    tbody.appendChild(tr);
  }

  // Main container
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '0';

  // Player information box
  const infoBox = document.createElement('div');
  infoBox.className = 'widget-top widget-top-text flex items-center gap-1';
  infoBox.style.marginBottom = '0';
  const infoIcon = document.createElement('img');
  infoIcon.alt = 'Account';
  infoIcon.src = '/assets/icons/migrate.png';
  infoIcon.className = 'pixelated inline-block translate-y-px';
  infoIcon.width = 13;
  infoIcon.height = 13;
  infoBox.appendChild(infoIcon);
  const infoTitle = document.createElement('span');
  infoTitle.textContent = 'Player information';
  infoBox.appendChild(infoTitle);
  container.appendChild(infoBox);

  // Player info content
  const infoContent = document.createElement('div');
  infoContent.className = 'widget-bottom';
  // Top row: avatar + name + level
  const topGrid = document.createElement('div');
  topGrid.className = 'grid grid-cols-[min-content_1fr] items-center gap-2';
  const avatarSlot = document.createElement('div');
  avatarSlot.className = 'container-slot surface-darker relative p-0.5';
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'relative z-1 h-sprite w-sprite';
  // Insert the static logo image (32x32)
  const avatarImg = document.createElement('img');
  avatarImg.src = 'https://bestiaryarena.com/assets/logo.png';
  avatarImg.alt = 'Player Icon';
  avatarImg.width = 32;
  avatarImg.height = 32;
  avatarImg.style.width = '32px';
  avatarImg.style.height = '32px';
  avatarImg.style.display = 'block';
  avatarImg.style.margin = 'auto';
  avatarImg.className = 'pixelated';
  avatarWrap.appendChild(avatarImg);
  avatarSlot.appendChild(avatarWrap);
  topGrid.appendChild(avatarSlot);
  const nameCol = document.createElement('div');
  nameCol.className = 'truncate pb-px pr-0.5';
  const nameP = document.createElement('p');
  nameP.className = 'line-clamp-1 text-whiteExp animate-in fade-in';
  nameP.textContent = getProfileValue('name') || 'Player';
  nameCol.appendChild(nameP);
  const levelRow = document.createElement('div');
  levelRow.className = 'flex justify-between gap-2';
  levelRow.title = formatNumber(getProfileValue('xp')) + ' exp';
  const levelLabel = document.createElement('span');
  levelLabel.className = 'pixel-font-14 text-whiteRegular';
  levelLabel.textContent = 'Level';
  const levelValue = document.createElement('span');
  levelValue.className = 'text-whiteExp animate-in fade-in';
  levelValue.textContent = formatNumber(getProfileValue('level'));
  levelRow.appendChild(levelLabel);
  levelRow.appendChild(levelValue);
  nameCol.appendChild(levelRow);
  const expBarWrap = document.createElement('div');
  expBarWrap.className = 'frame-pressed-1';
  const expBarOuter = document.createElement('div');
  expBarOuter.className = 'relative h-1 w-full bg-black';
  const expBarInnerWrap = document.createElement('div');
  expBarInnerWrap.className = 'absolute left-0 top-0 flex h-full w-full';
  const expBarFill = document.createElement('div');
  expBarFill.className = 'h-full shrink-0 bg-expBar';
  let exp = getProfileValue('xp');
  let expBarWidth = 0;
  if (typeof exp === 'number' && exp > 0) {
    expBarWidth = Math.min(100, Math.round((exp % 400) / 400 * 100));
  }
  expBarFill.style.width = expBarWidth + '%';
  expBarInnerWrap.appendChild(expBarFill);
  expBarOuter.appendChild(expBarInnerWrap);
  expBarWrap.appendChild(expBarOuter);
  nameCol.appendChild(expBarWrap);
  topGrid.appendChild(nameCol);
  infoContent.appendChild(topGrid);
  const sep1 = document.createElement('div');
  sep1.setAttribute('role', 'none');
  sep1.className = 'separator mb-1';
  infoContent.appendChild(sep1);
  const grid2 = document.createElement('div');
  grid2.className = 'grid grid-cols-2 gap-1';
  const createdDiv = document.createElement('div');
  const createdLabel = document.createElement('div');
  createdLabel.className = 'pixel-font-14';
  createdLabel.textContent = CYCLOPEDIA_TRANSLATION.createdAt.label;
  const createdValue = document.createElement('div');
  createdValue.className = 'text-whiteHighlight';
  createdValue.textContent = getProfileValue('createdAt');
  createdDiv.appendChild(createdLabel);
  createdDiv.appendChild(createdValue);
  grid2.appendChild(createdDiv);
  const statusDiv = document.createElement('div');
  const statusLabel = document.createElement('div');
  statusLabel.className = 'pixel-font-14';
  statusLabel.textContent = CYCLOPEDIA_TRANSLATION.premium.label;
  const statusGrid = document.createElement('div');
  statusGrid.className = 'grid grid-cols-[min-content_1fr] gap-1 text-whiteHighlight';
  const statusIconWrap = document.createElement('div');
  statusIconWrap.className = 'relative h-full w-[22px]';
  const statusIcon = document.createElement('img');
  statusIcon.alt = 'Premium pass';
  statusIcon.src = '/assets/icons/premium-yes.png';
  statusIcon.className = 'pixelated absolute -bottom-0.5 left-0';
  statusIcon.width = 22;
  statusIcon.height = 19;
  statusIconWrap.appendChild(statusIcon);
  statusGrid.appendChild(statusIconWrap);
  const statusText = document.createElement('span');
  statusText.className = 'text-ally';
  statusText.textContent = getProfileValue('premium');
  statusGrid.appendChild(statusText);
  statusDiv.appendChild(statusLabel);
  statusDiv.appendChild(statusGrid);
  grid2.appendChild(statusDiv);
  infoContent.appendChild(grid2);
  container.appendChild(infoContent);

  // Player stats box
  const statsBox = document.createElement('div');
  statsBox.className = 'widget-top widget-top-text flex items-center gap-1 whitespace-nowrap';
  const statsIcon = document.createElement('img');
  statsIcon.alt = 'Account';
  statsIcon.src = '/assets/icons/progress.png';
  statsIcon.className = 'pixelated inline-block translate-y-px';
  statsIcon.width = 12;
  statsIcon.height = 12;
  statsBox.appendChild(statsIcon);
  const statsTitle = document.createElement('span');
  statsTitle.textContent = 'Player stats';
  statsBox.appendChild(statsTitle);
  container.appendChild(statsBox);

  // Stats table
  const statsTableWrap = document.createElement('div');
  statsTableWrap.className = 'widget-bottom';
  const statsTable = document.createElement('table');
  statsTable.className = 'pixel-font-16 frame-pressed-1 w-full caption-bottom border-separate border-spacing-0 text-whiteRegular';
  const tbody = document.createElement('tbody');
  tbody.className = 'whitespace-nowrap';

  // Current total
  addRow({ label: 'Current total', highlight: true, colspan: 2 });
  addRow({ label: CYCLOPEDIA_TRANSLATION.shell.label, icon: '/assets/icons/shell-count.png', value: (getProfileValue('shell') !== undefined ? formatNumber(getProfileValue('shell')) + 'x' : '-') });
  addRow({ label: CYCLOPEDIA_TRANSLATION.tasks.label, icon: '/assets/icons/task-count.png', value: (getProfileValue('tasks') !== undefined ? formatNumber(getProfileValue('tasks')) + 'x' : '-') });
  addRow({ label: CYCLOPEDIA_TRANSLATION.playCount.label, icon: '/assets/icons/match-count.png', value: (getProfileValue('playCount') !== undefined ? formatNumber(getProfileValue('playCount')) + 'x' : '-') });

  // Progress
  addRow({ label: 'Progress', highlight: true, colspan: 2 });
  CYCLOPEDIA_PROGRESS_STATS.forEach(stat => {
    const val = getProfileValue(stat.key);
    const isMax = val === stat.max;
    const valueStr = `${formatNumber(val)}/${stat.max}`;
    addRow({
      label: CYCLOPEDIA_TRANSLATION[stat.key].label,
      icon: stat.icon,
      value: valueStr,
      valueClass: isMax ? 'stat-maxed' : undefined
    });
  });

  // Rankings
  addRow({ label: 'Rankings', highlight: true, colspan: 2 });
  addRow({
    label: CYCLOPEDIA_TRANSLATION.rankPoints.label,
    icon: '/assets/icons/star-tier.png',
    value: (getProfileValue('rankPoints') !== undefined ? formatNumber(getProfileValue('rankPoints')) : '-'),
    title: profileData.rankPointsPosition !== undefined ? 'Position: ' + profileData.rankPointsPosition : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  addRow({
    label: CYCLOPEDIA_TRANSLATION.timeSum.label,
    icon: '/assets/icons/speed.png',
    value: (getProfileValue('timeSum') !== undefined ? formatNumber(getProfileValue('timeSum')) : '-'),
    title: profileData.ticksPosition !== undefined ? 'Position: ' + profileData.ticksPosition : undefined,
    extraIcon: { alt: 'Highscore', src: '/assets/icons/highscore.png' }
  });
  statsTable.appendChild(tbody);
  statsTableWrap.appendChild(statsTable);
  container.appendChild(statsTableWrap);
  return container;
}

// =======================
// Daily Context Column Refactor
// =======================

function renderYasirBox(yasir, utils, msUntilNextEpochDay, formatTime) {
  let yasirLoc = yasir.location;
  if (utils?.ROOM_NAME && yasirLoc && utils.ROOM_NAME[yasirLoc]) {
    yasirLoc = utils.ROOM_NAME[yasirLoc];
  } else if (yasirLoc) {
    yasirLoc = yasirLoc.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }
  const yasirDiv = document.createElement('div');
  yasirDiv.style.display = 'flex';
  yasirDiv.style.alignItems = 'center';
  yasirDiv.style.justifyContent = 'center';
  yasirDiv.style.height = '60px';
  yasirDiv.style.maxHeight = '60px';
  yasirDiv.style.width = '100%';
  yasirDiv.style.overflow = 'hidden';

  const yasirFrame = document.createElement('div');
  yasirFrame.className = 'frame-1 surface-regular grid gap-2 p-1.5 text-left';
  yasirFrame.style.width = '100%';
  yasirFrame.style.height = '60px';
  yasirFrame.style.maxHeight = '60px';

  const yasirRow = document.createElement('div');
  yasirRow.className = 'flex justify-between gap-2';

  // Yasir icon
  const yasirIconWrap = document.createElement('div');
  yasirIconWrap.className = 'container-slot surface-darker grid place-items-center px-3.5 py-0.5';
  const yasirIconRel = document.createElement('div');
  yasirIconRel.className = 'relative size-sprite';
  const yasirImg = document.createElement('img');
  yasirImg.alt = 'Yasir';
  yasirImg.className = 'pixelated absolute -bottom-0.5 -right-0.5';
  yasirImg.width = 34;
  yasirImg.height = 37;
  yasirImg.src = '/assets/icons/yasir.png';
  yasirIconRel.appendChild(yasirImg);
  yasirIconWrap.appendChild(yasirIconRel);

  // Yasir info
  const yasirInfo = document.createElement('div');
  yasirInfo.className = 'flex w-full flex-col';
  // Title
  const yasirTitle = document.createElement('p');
  yasirTitle.className = 'text-whiteHighlight';
  yasirTitle.textContent = 'Yasir';
  // Location + map pin
  const yasirLocP = document.createElement('p');
  yasirLocP.className = 'pixel-font-14';
  yasirLocP.textContent = 'Current location: ';
  const yasirLocSpan = document.createElement('span');
  yasirLocSpan.className = 'action-link focus-within:focused-highlight whitespace-nowrap';
  yasirLocSpan.textContent = yasirLoc || '-';
  // Map pin SVG
  const mapPinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mapPinSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  mapPinSvg.setAttribute('width', '24');
  mapPinSvg.setAttribute('height', '24');
  mapPinSvg.setAttribute('viewBox', '0 0 24 24');
  mapPinSvg.setAttribute('fill', 'none');
  mapPinSvg.setAttribute('stroke', 'currentColor');
  mapPinSvg.setAttribute('stroke-width', '2');
  mapPinSvg.setAttribute('stroke-linecap', 'round');
  mapPinSvg.setAttribute('stroke-linejoin', 'round');
  mapPinSvg.classList.add('lucide', 'lucide-map-pin', 'ml-0.5', 'inline-block', 'size-3', '-translate-y-0.5');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '3');
  mapPinSvg.appendChild(path);
  mapPinSvg.appendChild(circle);
  yasirLocSpan.appendChild(mapPinSvg);
  yasirLocP.appendChild(yasirLocSpan);
  // Timer row: clock icon + timer
  const yasirTimeP = document.createElement('p');
  yasirTimeP.className = 'pixel-font-14 text-right';
  // Clock SVG
  const clockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  clockSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clockSvg.setAttribute('width', '24');
  clockSvg.setAttribute('height', '24');
  clockSvg.setAttribute('viewBox', '0 0 24 24');
  clockSvg.setAttribute('fill', 'none');
  clockSvg.setAttribute('stroke', 'currentColor');
  clockSvg.setAttribute('stroke-width', '2');
  clockSvg.setAttribute('stroke-linecap', 'round');
  clockSvg.setAttribute('stroke-linejoin', 'round');
  clockSvg.classList.add('lucide', 'lucide-clock', 'mr-1', 'inline-block', 'size-2', '-translate-y-px');
  const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  clockCircle.setAttribute('cx', '12');
  clockCircle.setAttribute('cy', '12');
  clockCircle.setAttribute('r', '10');
  const clockPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  clockPolyline.setAttribute('points', '12 6 12 12 16 14');
  clockSvg.appendChild(clockCircle);
  clockSvg.appendChild(clockPolyline);
  yasirTimeP.appendChild(clockSvg);
  // Timer text
  const yasirTimerSpan = document.createElement('span');
  yasirTimerSpan.className = 'yasir-timer';
  yasirTimerSpan.textContent = formatTime(msUntilNextEpochDay) + 'h';
  yasirTimeP.appendChild(yasirTimerSpan);
  // Assemble info column
  yasirInfo.appendChild(yasirTitle);
  yasirInfo.appendChild(yasirLocP);
  yasirInfo.appendChild(yasirTimeP);
  yasirRow.appendChild(yasirIconWrap);
  yasirRow.appendChild(yasirInfo);
  yasirFrame.appendChild(yasirRow);
  yasirDiv.appendChild(yasirFrame);
  return yasirDiv;
}

function renderBoostedBox(boosted, utils, formatTime, msUntilNextEpochDay) {
  let boostedRoomName = boosted.roomId;
  if (utils?.ROOM_NAME && boostedRoomName && utils.ROOM_NAME[boostedRoomName]) {
    boostedRoomName = utils.ROOM_NAME[boostedRoomName];
  } else if (boostedRoomName) {
    boostedRoomName = boostedRoomName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }
  const boostedDiv = document.createElement('div');
  boostedDiv.style.display = 'flex';
  boostedDiv.style.alignItems = 'center';
  boostedDiv.style.justifyContent = 'center';
  boostedDiv.style.height = '60px';
  boostedDiv.style.maxHeight = '60px';
  boostedDiv.style.width = '100%';
  boostedDiv.style.overflow = 'hidden';

  const boostedFrame = document.createElement('div');
  boostedFrame.className = 'frame-1 surface-regular grid gap-2 p-1.5 text-left';
  boostedFrame.style.width = '100%';
  boostedFrame.style.height = '60px';
  boostedFrame.style.maxHeight = '60px';

  const boostedRow = document.createElement('div');
  boostedRow.className = 'flex justify-between gap-2';

  // Left: Equipment portrait
  const boostedIconWrap = document.createElement('div');
  boostedIconWrap.className = 'container-slot surface-darker grid place-items-center px-3.5 py-0.5 equipment-portrait relative';
  boostedIconWrap.innerHTML = '';
  if (boosted.equipId && api?.ui?.components?.createItemPortrait) {
    let spriteId = boosted.equipId;
    try {
      const equipData = globalThis.state.utils.getEquipment(boosted.equipId);
      if (equipData && equipData.metadata && equipData.metadata.spriteId) {
        spriteId = equipData.metadata.spriteId;
      }
    } catch (e) {}
    let equipPortrait = api.ui.components.createItemPortrait({
      itemId: spriteId,
      stat: boosted.equipStat,
      tier: boosted.equipTier || 1,
    });
    equipPortrait.style.background = 'unset';
    // Remove button wrapper if present
    if (equipPortrait.tagName === 'BUTTON' && equipPortrait.firstChild) {
      equipPortrait = equipPortrait.firstChild;
    }
    boostedIconWrap.appendChild(equipPortrait);
  }

  // Right: Info column
  const boostedInfo = document.createElement('div');
  boostedInfo.className = 'flex w-full flex-col';

  // Title
  const boostedTitle = document.createElement('p');
  boostedTitle.className = 'text-whiteHighlight';
  boostedTitle.textContent = 'Daily boosted map';

  // Room name + map pin icon
  const boostedRoomP = document.createElement('span');
  boostedRoomP.className = 'action-link focus-within:focused-highlight pixel-font-14 mt-1 !text-boosted no-underline';
  boostedRoomP.textContent = boostedRoomName || '-';
  // Map pin SVG
  const mapPinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mapPinSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  mapPinSvg.setAttribute('width', '24');
  mapPinSvg.setAttribute('height', '24');
  mapPinSvg.setAttribute('viewBox', '0 0 24 24');
  mapPinSvg.setAttribute('fill', 'none');
  mapPinSvg.setAttribute('stroke', 'currentColor');
  mapPinSvg.setAttribute('stroke-width', '2');
  mapPinSvg.setAttribute('stroke-linecap', 'round');
  mapPinSvg.setAttribute('stroke-linejoin', 'round');
  mapPinSvg.classList.add('lucide', 'lucide-map-pin', 'ml-0.5', 'inline-block', 'size-3', '-translate-y-0.5');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '3');
  mapPinSvg.appendChild(path);
  mapPinSvg.appendChild(circle);
  boostedRoomP.appendChild(mapPinSvg);

  // Timer row: clock icon + timer
  const boostedTimeP = document.createElement('p');
  boostedTimeP.className = 'pixel-font-14 text-right';
  // Clock SVG
  const clockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  clockSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clockSvg.setAttribute('width', '24');
  clockSvg.setAttribute('height', '24');
  clockSvg.setAttribute('viewBox', '0 0 24 24');
  clockSvg.setAttribute('fill', 'none');
  clockSvg.setAttribute('stroke', 'currentColor');
  clockSvg.setAttribute('stroke-width', '2');
  clockSvg.setAttribute('stroke-linecap', 'round');
  clockSvg.setAttribute('stroke-linejoin', 'round');
  clockSvg.classList.add('lucide', 'lucide-clock', 'mr-1', 'inline-block', 'size-2', '-translate-y-px');
  const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  clockCircle.setAttribute('cx', '12');
  clockCircle.setAttribute('cy', '12');
  clockCircle.setAttribute('r', '10');
  const clockPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  clockPolyline.setAttribute('points', '12 6 12 12 16 14');
  clockSvg.appendChild(clockCircle);
  clockSvg.appendChild(clockPolyline);
  boostedTimeP.appendChild(clockSvg);
  // Timer text
  const boostedTimerSpan = document.createElement('span');
  boostedTimerSpan.className = 'boosted-timer';
  boostedTimerSpan.textContent = formatTime(msUntilNextEpochDay) + 'h';
  boostedTimeP.appendChild(boostedTimerSpan);

  // Make only the map name clickable if roomId is present
  if (boosted.roomId) {
    boostedRoomP.style.cursor = 'pointer';
    boostedRoomP.title = 'Go to this map';
    boostedRoomP.addEventListener('click', (e) => {
      e.stopPropagation();
      // Use boosted.roomId directly as the string code
      globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: boosted.roomId
      });
      // Try to close the modal if present
      const closeBtn = Array.from(document.querySelectorAll('button.pixel-font-14')).find(
        btn => btn.textContent.trim() === 'Close'
      );
      if (closeBtn) {
        closeBtn.click();
      }
    });
  }

  // Assemble info column
  boostedInfo.appendChild(boostedTitle);
  boostedInfo.appendChild(boostedRoomP);
  boostedInfo.appendChild(boostedTimeP);

  // Assemble row
  boostedRow.appendChild(boostedIconWrap);
  boostedRow.appendChild(boostedInfo);
  boostedFrame.appendChild(boostedRow);
  boostedDiv.appendChild(boostedFrame);
  // Remove data-rarity="1" overlays only in the boosted map portrait
  boostedIconWrap.querySelectorAll('.has-rarity[data-rarity="1"]').forEach(el => el.remove());
  return boostedDiv;
}

function renderDailyContextColumn() {
  // Get daily context from game state
  const dailyContext = globalThis.state?.daily?.getSnapshot?.().context || {};
  const utils = globalThis.state?.utils;
  const yasir = dailyContext.yasir || {};
  const boosted = dailyContext.boostedMap || {};
  const initialMsUntilNextEpochDay = dailyContext.msUntilNextEpochDay;

  // Helper: Format ms to HH:MM:SS
  function formatTime(ms) {
    if (!ms || isNaN(ms) || ms < 0) return '--:--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60) % 60;
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  }

  // Main container
  const col = document.createElement('div');
  col.style.display = 'flex';
  col.style.flexDirection = 'column';
  col.style.height = '100%';
  col.style.width = '300px';
  col.style.minWidth = '300px';
  col.style.maxWidth = '300px';
  col.style.padding = '0 12px';
  col.style.boxSizing = 'border-box';
  col.style.justifyContent = 'center';
  col.style.alignItems = 'center';

  // Yasir and Boosted sections
  const yasirDiv = renderYasirBox(yasir, utils, initialMsUntilNextEpochDay, formatTime);
  const boostedDiv = renderBoostedBox(boosted, utils, formatTime, initialMsUntilNextEpochDay);

  // Separator
  const separator = document.createElement('div');
  separator.className = 'separator my-2.5';
  separator.setAttribute('role', 'none');
  separator.style.margin = '10px 0';

  // Real-time countdown timer logic
  let ms = initialMsUntilNextEpochDay;
  let lastUpdate = Date.now();
  let timerInterval = setInterval(() => {
    const now = Date.now();
    ms -= (now - lastUpdate);
    lastUpdate = now;
    const t = formatTime(ms);
    const yasirTimer = col.querySelector('.yasir-timer');
    const boostedTimer = col.querySelector('.boosted-timer');
    if (yasirTimer) yasirTimer.textContent = t + 'h';
    if (boostedTimer) boostedTimer.textContent = t + 'h';
  }, 1000);
  // Attach cleanup to the column for modal close
  col._cleanup = () => clearInterval(timerInterval);

  // Assemble
  col.appendChild(yasirDiv);
  col.appendChild(separator);
  col.appendChild(boostedDiv);

  return col;
}

// =======================
// 7. Initialization & Event Binding
// =======================

// Event handler references for cleanup
const cyclopediaEventHandlers = [];

/**
 * Initializes the Cyclopedia mod and sets up event listeners.
 */
function initCyclopedia() {
  // Add Cyclopedia button to the UI (assume a helper exists)
  addCyclopediaHeaderButton();
  // Inject selected CSS
  injectCyclopediaSelectedCss();
  // Start context menu observer
  startContextMenuObserver();
  // Listen for Cyclopedia button click to open modal
  const headerClickHandler = function (e) {
    if (e.target && e.target.classList.contains('cyclopedia-header-btn')) {
      openCyclopediaModal();
    }
  };
  document.addEventListener('click', headerClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: headerClickHandler });

  // Tab switching event (placeholder)
  const tabClickHandler = function (e) {
    if (e.target && e.target.classList.contains('cyclopedia-tab-btn')) {
      // TODO: Handle tab switching
    }
  };
  document.addEventListener('click', tabClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: tabClickHandler });

  // Search event (placeholder)
  const searchClickHandler = function (e) {
    if (e.target && e.target.textContent === 'Search' && e.target.parentElement.classList.contains('cyclopedia-search-bar')) {
      // TODO: Handle search
    }
  };
  document.addEventListener('click', searchClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: searchClickHandler });

  // List item click event (placeholder)
  const listItemClickHandler = function (e) {
    if (e.target && e.target.classList.contains('cyclopedia-list-item')) {
      // TODO: Handle list item click
    }
  };
  document.addEventListener('click', listItemClickHandler);
  cyclopediaEventHandlers.push({ type: 'click', handler: listItemClickHandler });
}

/**
 * Removes all Cyclopedia event listeners (for cleanup).
 */
function removeCyclopediaEventListeners() {
  cyclopediaEventHandlers.forEach(({ type, handler }) => {
    document.removeEventListener(type, handler);
  });
  cyclopediaEventHandlers.length = 0;
}

// =======================
// 8. Cleanup/Exports
// =======================

/**
 * Cleans up ability tooltip components to prevent memory leaks
 */
function cleanupAbilityTooltips() {
  // Find all ability sections with tooltip components
  const abilitySections = document.querySelectorAll('.cyclopedia-box, [role="dialog"]');
  abilitySections.forEach(section => {
    if (section._tooltipComponent && typeof section._tooltipComponent.unmount === 'function') {
      try {
        section._tooltipComponent.unmount();
      } catch (error) {
        console.error('[Cyclopedia] Error unmounting tooltip component:', error);
      }
      section._tooltipComponent = null;
    }
  });
}

/**
 * Cleans up Cyclopedia mod resources (if needed).
 * Call this if the mod is unloaded or reloaded.
 */
function cleanupCyclopedia() {
  stopContextMenuObserver();
  cleanupAbilityTooltips();
  removeCyclopediaEventListeners();
  // Remove Cyclopedia header button if present
  const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
  if (headerUl) {
    const btnLi = headerUl.querySelector('li:has(.cyclopedia-header-btn)');
    if (btnLi) btnLi.remove();
  }
}

// Add exports for mod loader compatibility
if (typeof window !== 'undefined') {
  window.Cyclopedia = {
    init: initCyclopedia,
    cleanup: cleanupCyclopedia,
    show: openCyclopediaModal,
    close: cleanupCyclopedia
  };
}

// =======================
// 9. Initialization Calls
// =======================
addCyclopediaHeaderButton();
startContextMenuObserver();
// (END OF FILE) 