// =======================
// 0. Version & Metadata
// =======================
(function() {
  console.log('Dice Roller 2.0 initializing...');
  
// =======================
// 1. Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  // Game configuration constants
  const DICE_CONFIG = {
    MIN_DICE: 1,
    MAX_DICE: 5,
    STAT_LIMIT: 20,
    ROLL_DELAY: 400,
    DICE_MANIPULATOR_ID: '35909'
  };
  
  const STAT_LABELS = [
    { key: 'hp', label: 'HP', icon: '/assets/icons/heal.png' },
    { key: 'ad', label: 'AD', icon: '/assets/icons/attackdamage.png' },
    { key: 'ap', label: 'AP', icon: '/assets/icons/abilitypower.png' },
    { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png' },
    { key: 'magicResist', label: 'MR', icon: '/assets/icons/magicresist.png' }
  ];
  
  const STAT_MAX = { ap: DICE_CONFIG.STAT_LIMIT, hp: DICE_CONFIG.STAT_LIMIT, ad: DICE_CONFIG.STAT_LIMIT, armor: DICE_CONFIG.STAT_LIMIT, magicResist: DICE_CONFIG.STAT_LIMIT };
  const STAT_BAR_COLOR = {
    ap: 'rgb(128, 128, 255)',
    hp: 'rgb(96, 192, 96)',
    ad: 'rgb(255, 128, 96)',
    armor: 'rgb(224, 224, 128)',
    magicResist: 'rgb(192, 128, 255)'
  };
  
  const EXP_TABLE = [
    [5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250],
    [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750],
    [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750],
    [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500],
    [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000],
    [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500],
    [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000],
    [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]
  ];
  
  const API_ENDPOINT = 'https://bestiaryarena.com/api/trpc/inventory.diceManipulator?batch=1';
  const FRAME_IMAGE_URL = 'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png';
  
  // API request throttling
  let lastApiCall = 0;
  const API_THROTTLE_DELAY = 200; // Minimum 200ms between API calls (increased from 100)

  // Module-scoped state instead of global pollution
  let diceRulesConfig = {};
  const STAT_KEYS = ['ap', 'hp', 'ad', 'armor', 'magicResist'];
  
  // CSS Injection for cross-browser compatibility
  function injectDiceRollerButtonStyles() {
    if (!document.getElementById('diceroller-btn-css')) {
      const style = document.createElement('style');
      style.id = 'diceroller-btn-css';
      style.textContent = `
        .diceroller-btn {
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
          cursor: pointer !important;
          flex: 1 1 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
        }
        .diceroller-btn.pressed,
        .diceroller-btn:active {
          border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Debouncing utility for status updates
  let statusUpdateTimeout = null;
  const debouncedStatusUpdate = (callback) => {
    if (statusUpdateTimeout) {
      clearTimeout(statusUpdateTimeout);
    }
    statusUpdateTimeout = setTimeout(callback, 100);
  };

  // Centralized status update function
  const updateStatusDisplays = () => {
    debouncedStatusUpdate(() => {
      if (typeof window.updateStatusDisplays === 'function') {
        window.updateStatusDisplays();
      }
    });
  };

  // DOM Caching System for Performance
  const DOMCache = {
    cache: new Map(),
    cacheTimeout: 1000,

    get: function(selector, context = document) {
      const key = `${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.element;
      }
    
      const element = context.querySelector(selector);
      this.cache.set(key, { element, timestamp: Date.now() });
      return element;
    },

    clear: function() {
      this.cache.clear();
    }
  };

  // Memoization Utilities
  const MemoizationUtils = {
    memoize: function(fn, keyFn = (...args) => JSON.stringify(args)) {
      const cache = new Map();
      return function(...args) {
        const key = keyFn(...args);
        if (cache.has(key)) {
          return cache.get(key);
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
      };
    },

    memoizeWithTTL: function(fn, ttl, keyFn = (...args) => JSON.stringify(args)) {
      const cache = new Map();
      return function(...args) {
        const key = keyFn(...args);
        const now = Date.now();
        const cached = cache.get(key);
        
        if (cached && now - cached.timestamp < ttl) {
          return cached.value;
        }
        
        const result = fn.apply(this, args);
        cache.set(key, { value: result, timestamp: now });
        return result;
      };
    }
  };

// =======================
// 2. Utility Functions
// =======================
  // Memoized level calculation for performance
  const getLevelFromExp = MemoizationUtils.memoize((exp) => {
    if (typeof exp !== 'number' || exp < EXP_TABLE[0][1]) {
      return 1;
    }
    for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
      if (exp >= EXP_TABLE[i][1]) {
        return EXP_TABLE[i][0];
      }
    }
    return 1;
  });

  function getRarityFromStats(stats) {
    const statSum = (stats.hp || 0) + (stats.ad || 0) + (stats.ap || 0) + (stats.armor || 0) + (stats.magicResist || 0);
    let rarity = 1;
    if (statSum >= 80) rarity = 5;
    else if (statSum >= 70) rarity = 4;
    else if (statSum >= 60) rarity = 3;
    else if (statSum >= 50) rarity = 2;
    return rarity;
  }

  function getCurrentStats(selectedMonsterId) {
    const { monsters } = globalThis.state.player.getSnapshot().context;
    const creature = monsters.find(c => String(c.id) === String(selectedMonsterId));
    if (!creature) return {};
    return {
      hp: creature.hp,
      ad: creature.ad,
      ap: creature.ap,
      armor: creature.armor,
      magicResist: creature.magicResist
    };
  }

  // Cached monster data access with TTL
  const safeGetMonsters = MemoizationUtils.memoizeWithTTL(() => {
    try {
      const { monsters } = globalThis.state.player.getSnapshot().context;
      return Array.isArray(monsters) ? monsters : [];
    } catch (error) {
      console.error('Failed to get monsters:', error);
      return [];
    }
  }, 500); // Cache for 500ms to avoid excessive state access

  function validateDiceSelection(dice, stats) {
    if (!Array.isArray(dice) || dice.length === 0) {
      throw new Error('No dice selected');
    }
    const minDice = Math.min(...dice);
    const maxStats = 6 - minDice;
    if (stats.length !== maxStats) {
      throw new Error(`Invalid stat/dice combination: ${stats.length} stats for dice tier ${minDice}`);
    }
  }

  function initializeDiceRulesConfig() {
    if (!diceRulesConfig || Object.keys(diceRulesConfig).length === 0) {
      diceRulesConfig = {};
      STAT_KEYS.forEach(key => {
        diceRulesConfig[key] = { active: true, target: DICE_CONFIG.STAT_LIMIT };
      });
    }
    return diceRulesConfig;
  }

  // Get original cased monster name from game ID
  function getMonsterNameFromId(gameId) {
    try {
      const monsterData = globalThis.state.utils.getMonster(gameId);
      return monsterData && monsterData.metadata ? monsterData.metadata.name : null;
    } catch (e) {
      console.error('Error getting monster name:', e);
      return null;
    }
  }

  // Utility function to update dice button states
  function updateDiceButtonStates(selectedDice) {
    // Use DOMCache for performance
    const diceButtons = DOMCache.get('.focus-style-visible') ? [ ...document.querySelectorAll('.focus-style-visible') ] : [];
    let diceButtonIndex = 0;
    diceButtons.forEach((btn) => {
      const diceSprite = btn.querySelector(`.sprite.item.relative.id-${DICE_CONFIG.DICE_MANIPULATOR_ID}`);
      if (diceSprite) {
        const diceIndex = diceButtonIndex + 1;
        const slot = btn.querySelector('.container-slot');
        if (slot && selectedDice.includes(diceIndex)) {
          btn.setAttribute('data-state', 'selected');
          slot.style.boxShadow = '0 0 0 2px #00ff00';
          slot.style.borderRadius = '0';
        } else if (slot) {
          btn.setAttribute('data-state', 'closed');
          slot.style.boxShadow = 'none';
        }
        diceButtonIndex++;
      }
    });
  }

// =======================
// 3. UI Component Creation
// =======================
  function createBox({title, content}) {
    const box = document.createElement('div');
    box.style.flex = '1 1 0';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.margin = '0';
    box.style.padding = '0';
    box.style.minHeight = '0';
    box.style.height = '100%';
    box.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
    box.style.border = '4px solid transparent';
    box.style.borderImage = `url("${FRAME_IMAGE_URL}") 6 fill stretch`;
    box.style.borderRadius = '6px';
    box.style.overflow = 'hidden';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'widget-top widget-top-text pixel-font-16';
    titleEl.style.margin = '0';
    titleEl.style.padding = '2px 8px';
    titleEl.style.textAlign = 'center';
    titleEl.style.color = 'rgb(255, 255, 255)';
    
    const p = document.createElement('p');
    p.textContent = title;
    p.className = 'pixel-font-16';
    p.style.margin = '0';
    p.style.padding = '0';
    p.style.textAlign = 'center';
    p.style.color = 'rgb(255, 255, 255)';
    titleEl.appendChild(p);
    box.appendChild(titleEl);
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'column-content-wrapper';
    contentWrapper.style.flex = '1 1 0';
    contentWrapper.style.height = '100%';
    contentWrapper.style.minHeight = '0';
    contentWrapper.style.overflowY = 'auto';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.alignItems = 'center';
    contentWrapper.style.justifyContent = 'center';
    contentWrapper.style.padding = '0';
    
    if (typeof content === 'string') {
      contentWrapper.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentWrapper.appendChild(content);
    }
    box.appendChild(contentWrapper);
    return box;
  }

// =======================
// 4. Core UI Functions
// =======================
  function getCreatureList(onSelect, selectedDice, render, updateDetailsOnly, selectedGameId, getSelectedDiceTier, getAvailableStats, lastStatusMessage) {
    const col = document.createElement('div');
    col.style.width = '100%';
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.alignItems = 'center';
    col.style.overflow = 'hidden';
    col.style.boxSizing = 'border-box';
    col.style.flex = '1 1 0';
    col.style.height = '100%';
    col.style.minHeight = '0';
    col.style.position = 'relative';
    // Modern scroll area as grid
    const scrollFlexWrapper = document.createElement('div');
    scrollFlexWrapper.style.display = 'flex';
    scrollFlexWrapper.style.flexDirection = 'row';
    scrollFlexWrapper.style.alignItems = 'stretch';
    scrollFlexWrapper.style.position = 'relative';
    scrollFlexWrapper.style.width = '100%';
    scrollFlexWrapper.style.height = '100%';

    const scrollArea = document.createElement('div');
    scrollArea.style.flex = '1 1 0';
    scrollArea.style.height = '100%';
    scrollArea.style.minHeight = '0';
    scrollArea.style.width = 'auto';
    scrollArea.style.overflowY = 'auto';
    scrollArea.style.display = 'grid';
    scrollArea.style.gridTemplateColumns = 'repeat(6, 1fr)';
    scrollArea.style.gap = '0';
    scrollArea.style.padding = '5px 20px 5px 5px'; // Right padding: 12px scrollbar + 4px spacing + 4px right margin
    scrollArea.style.background = 'rgba(40,40,40,0.96)';
    // Hide default scrollbar completely
    scrollArea.style.scrollbarWidth = 'none';
    scrollArea.style.msOverflowStyle = 'none';
    scrollArea.style.setProperty('scrollbar-width', 'none', 'important');
    scrollArea.style.setProperty('-webkit-scrollbar', 'none', 'important');
    scrollArea.style.setProperty('-webkit-scrollbar-track', 'none', 'important');
    scrollArea.style.setProperty('-webkit-scrollbar-thumb', 'none', 'important');
    scrollArea.style.setProperty('-webkit-scrollbar-corner', 'none', 'important');

    // Custom scrollbar element (static, not functional)
    const customScrollbar = document.createElement('div');
    customScrollbar.setAttribute('data-orientation', 'vertical');
    customScrollbar.className = 'scrollbar-element frame-1 surface-dark flex touch-none select-none border-0 data-[orientation="horizontal"]:h-3 data-[orientation="vertical"]:h-full data-[orientation="vertical"]:w-3 data-[orientation="horizontal"]:flex-col';
    // Position outside the scroll area with proper spacing
    customScrollbar.style.position = 'absolute';
    customScrollbar.style.top = '0';
    customScrollbar.style.right = '4px'; // Position 4px from right edge for better visual separation
    customScrollbar.style.bottom = '0';
    customScrollbar.style.width = '12px';
    customScrollbar.style.height = '100%';
    customScrollbar.style.background = 'rgba(30, 30, 30, 0.95)';
    customScrollbar.style.border = '2px solid transparent';
    customScrollbar.style.borderImage = `url("${FRAME_IMAGE_URL}") 6 fill stretch`;
    customScrollbar.style.borderRadius = '4px';
    customScrollbar.style.zIndex = '2';
    customScrollbar.style.setProperty('--radix-scroll-area-thumb-height', '82.27611940298507px');
    // Thumb
    const thumb = document.createElement('div');
    thumb.setAttribute('data-state', 'visible');
    thumb.setAttribute('data-orientation', 'vertical');
    thumb.className = 'relative flex-1 data-[orientation="vertical"]:scrollbar-vertical data-[orientation="horizontal"]:scrollbar-horizontal';
    thumb.style.width = 'var(--radix-scroll-area-thumb-width)';
    thumb.style.height = 'var(--radix-scroll-area-thumb-height)';
    thumb.style.transform = 'translate3d(0px, 0px, 0px)';
    thumb.style.backgroundRepeat = 'no-repeat';
    thumb.style.backgroundSize = 'contain';
    thumb.style.backgroundPosition = 'center center';
    thumb.style.minHeight = '24px';
    thumb.style.borderRadius = '3px';
    thumb.style.boxShadow = '0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)';
    thumb.style.border = '1px solid #555';
    thumb.style.margin = '3px 2px';
    thumb.style.background = 'linear-gradient(180deg, #444 0%, #333 50%, #222 100%)';
    thumb.style.transition = 'background 0.2s ease, box-shadow 0.2s ease';
    customScrollbar.appendChild(thumb);

    // Add hover effects
    thumb.addEventListener('mouseenter', () => {
      thumb.style.background = 'linear-gradient(180deg, #555 0%, #444 50%, #333 100%)';
      thumb.style.boxShadow = '0 3px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2)';
      thumb.style.border = '1px solid #666';
    });
    
    thumb.addEventListener('mouseleave', () => {
      thumb.style.background = 'linear-gradient(180deg, #444 0%, #333 50%, #222 100%)';
      thumb.style.boxShadow = '0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)';
      thumb.style.border = '1px solid #555';
    });

    // Add only scrollArea to wrapper
    scrollFlexWrapper.appendChild(scrollArea);

    // --- Make custom scrollbar functional ---
    function updateThumb() {
      const contentHeight = scrollArea.scrollHeight;
      const visibleHeight = scrollArea.clientHeight;
      const scrollTop = scrollArea.scrollTop;
      const trackHeight = scrollArea.offsetHeight;
      // Thumb height: proportional to visible/content
      const thumbHeight = Math.max((visibleHeight / contentHeight) * trackHeight, 24); // min 24px
      // Thumb position: proportional to scroll
      const maxScroll = contentHeight - visibleHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0;
      thumb.style.height = thumbHeight + 'px';
      thumb.style.transform = `translate3d(0px, ${thumbTop}px, 0px)`;
    }
    // Sync thumb on scroll and resize
    scrollArea.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);
    // Sync on content changes (optional, for dynamic lists)
    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(scrollArea);
    // Drag logic
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;
    thumb.addEventListener('mousedown', e => {
      isDragging = true;
      dragStartY = e.clientY;
      dragStartScroll = scrollArea.scrollTop;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const contentHeight = scrollArea.scrollHeight;
      const visibleHeight = scrollArea.clientHeight;
      const trackHeight = scrollArea.offsetHeight;
      const thumbHeight = thumb.offsetHeight;
      const maxScroll = contentHeight - visibleHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      const deltaY = e.clientY - dragStartY;
      const scrollDelta = (deltaY / maxThumbTop) * maxScroll;
      scrollArea.scrollTop = dragStartScroll + scrollDelta;
    });
    document.addEventListener('mouseup', () => {
      isDragging = false;
      document.body.style.userSelect = '';
    });
    // Track click logic
    customScrollbar.addEventListener('mousedown', e => {
      if (e.target !== thumb) {
        const rect = customScrollbar.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const trackHeight = customScrollbar.offsetHeight;
        const thumbHeight = thumb.offsetHeight;
        const maxThumbTop = trackHeight - thumbHeight;
        const thumbTop = Math.max(0, Math.min(clickY - thumbHeight / 2, maxThumbTop));
        const contentHeight = scrollArea.scrollHeight;
        const visibleHeight = scrollArea.clientHeight;
        const maxScroll = contentHeight - visibleHeight;
        const newScroll = (thumbTop / maxThumbTop) * maxScroll;
        scrollArea.scrollTop = newScroll;
      }
    });
    // Initial thumb update
    setTimeout(updateThumb, 0);
    // Creature buttons
    try {
      const monsters = safeGetMonsters();
      if (!monsters.length) {
        scrollArea.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 6;">No creatures found.</div>';
        col.appendChild(scrollFlexWrapper);
        return col;
      }
      // Optimized sorting with pre-calculated values
      const sortedMonsters = [...monsters].map(monster => ({
        ...monster,
        _level: getLevelFromExp(monster.exp),
        _statSum: (monster.hp || 0) + (monster.ad || 0) + (monster.ap || 0) + (monster.armor || 0) + (monster.magicResist || 0)
      })).sort((a, b) => {
        // Level (desc)
        if (a._level !== b._level) return b._level - a._level;
        // Tier (desc)
        const tierA = a.tier || 0;
        const tierB = b.tier || 0;
        if (tierA !== tierB) return tierB - tierA;
        // Game ID (asc, string compare)
        const gameIdCompare = String(a.gameId).localeCompare(String(b.gameId));
        if (gameIdCompare !== 0) return gameIdCompare;
        // Stat sum (desc)
        return b._statSum - a._statSum;
      });
      for (const creature of sortedMonsters) {
        // Create button
        const btn = document.createElement('button');
        btn.className = 'focus-style-visible active:opacity-70';
        btn.setAttribute('data-state', 'closed');
        btn.setAttribute('data-gameid', creature.gameId);
        btn.onclick = () => {
          const isNewCreature = selectedGameId !== creature.id;
          
          if (onSelect) onSelect(creature.id);
          
          if (typeof updateDetailsOnly === 'function') {
            updateDetailsOnly(creature.id, getSelectedDiceTier, getAvailableStats, selectedDice, lastStatusMessage);
          }
          
          // Update status displays when creature changes
          setTimeout(() => {
            updateStatusDisplays();
            // Reset autoroll count only when changing to a new creature
            if (isNewCreature && typeof window.resetRollCount === 'function') {
              window.resetRollCount();
            }
          }, 0);
        };
        // Container slot
        const slot = document.createElement('div');
        slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden';
        slot.setAttribute('data-highlighted', 'false');
        slot.setAttribute('data-recent', 'false');
        slot.setAttribute('data-multiselected', 'false');
        slot.style.width = '34px';
        slot.style.height = '34px';
        slot.style.minWidth = '34px';
        slot.style.minHeight = '34px';
        slot.style.maxWidth = '34px';
        slot.style.maxHeight = '34px';
        // Rarity border/background
        const rarity = getRarityFromStats(creature);
        const rarityDiv = document.createElement('div');
        rarityDiv.setAttribute('role', 'none');
        rarityDiv.className = 'has-rarity absolute inset-0 z-1 opacity-80';
        rarityDiv.setAttribute('data-rarity', rarity);
        slot.appendChild(rarityDiv);
        // Star tier icon
        if (creature.tier) {
          const starImg = document.createElement('img');
          starImg.alt = 'star tier';
          starImg.src = `/assets/icons/star-tier-${creature.tier}.png`;
          starImg.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
          slot.appendChild(starImg);
        }
        // Level badge
        const levelDiv = document.createElement('div');
        levelDiv.className = 'creature-level-badge';
        levelDiv.style.position = 'absolute';
        levelDiv.style.bottom = '2px';
        levelDiv.style.left = '2px';
        levelDiv.style.zIndex = '3';
        levelDiv.style.fontSize = '16px';
        levelDiv.style.color = '#fff';
        levelDiv.style.textShadow = '0 1px 2px #000, 0 0 2px #000';
        levelDiv.style.letterSpacing = '0.5px';
        levelDiv.textContent = getLevelFromExp(creature.exp);
        slot.appendChild(levelDiv);
        // Portrait image
        const img = document.createElement('img');
        img.className = 'pixelated ml-auto';
        img.alt = 'creature';
        img.width = 34;
        img.height = 34;
        img.style.width = '34px';
        img.style.height = '34px';
        img.style.minWidth = '34px';
        img.style.minHeight = '34px';
        img.style.maxWidth = '34px';
        img.style.maxHeight = '34px';
        img.style.objectFit = 'contain';
        img.src = `/assets/portraits/${creature.gameId}.png`;
        slot.appendChild(img);
        // Tooltip
        const creatureName = getMonsterNameFromId(creature.gameId) || creature.name || creature.gameId;
        btn.title = creatureName;
        // Assemble
        btn.appendChild(slot);
        scrollArea.appendChild(btn);
      }
    } catch (e) {
      scrollArea.innerHTML = '<div style="color:#f66;text-align:center;padding:16px;grid-column: span 5;">Error loading creatures.</div>';
    }
    col.appendChild(scrollFlexWrapper);
    col.appendChild(customScrollbar);
    return col;
  }

  function getCreatureDetails(selectedGameId, selectedDice) {
    // Initialize dice rules config using utility function
    const diceRulesConfig = initializeDiceRulesConfig();
    
    // Now only returns the portrait/stats row (row1), to be used in col3 row1
    if (!selectedGameId) {
      const div = document.createElement('div');
      div.innerText = 'Select a creature.';
      return div;
    }
    try {
      const monsters = safeGetMonsters();
      const creature = monsters.find(c => String(c.id) === String(selectedGameId));
      if (!creature) {
        const div = document.createElement('div');
        div.innerText = 'Creature not found.';
        return div;
      }
      const rarity = getRarityFromStats(creature);
      // Portrait above stats
      const detailsCol = document.createElement('div');
      detailsCol.style.display = 'flex';
      detailsCol.style.flexDirection = 'column';
      detailsCol.style.alignItems = 'center';
      detailsCol.style.justifyContent = 'flex-start';
      detailsCol.style.gap = '4px';
      detailsCol.style.width = '100%';
      detailsCol.style.maxWidth = '210px';
      detailsCol.style.maxHeight = '340px';
      detailsCol.style.overflow = 'auto';
      detailsCol.style.boxSizing = 'border-box';
      detailsCol.style.wordBreak = 'break-word';
      detailsCol.style.whiteSpace = 'normal';
      
      // Lock status (above portrait) - Interactive
      const lockStatusDiv = document.createElement('div');
      lockStatusDiv.style.display = 'flex';
      lockStatusDiv.style.alignItems = 'center';
      lockStatusDiv.style.justifyContent = 'center';
      lockStatusDiv.style.gap = '4px';
      lockStatusDiv.style.marginTop = '2px';
      lockStatusDiv.style.marginBottom = '2px';
      lockStatusDiv.style.padding = '1px 6px';
      lockStatusDiv.style.borderRadius = '3px';
      lockStatusDiv.style.fontSize = '10px';
      lockStatusDiv.style.fontFamily = 'Arial, sans-serif';
      lockStatusDiv.style.fontWeight = 'normal';
      lockStatusDiv.style.cursor = 'pointer';
      lockStatusDiv.style.transition = 'all 0.2s ease';
      lockStatusDiv.style.userSelect = 'none';
      
      // Add hover effect
      lockStatusDiv.addEventListener('mouseenter', () => {
        lockStatusDiv.style.background = 'rgba(255, 255, 255, 0.1)';
        lockStatusDiv.style.transform = 'scale(1.05)';
      });
      
      lockStatusDiv.addEventListener('mouseleave', () => {
        lockStatusDiv.style.background = 'transparent';
        lockStatusDiv.style.transform = 'scale(1)';
      });
      
      const lockIcon = document.createElement('span');
      lockIcon.textContent = creature.locked ? '🔒' : '🔓';
      lockIcon.style.fontSize = '12px';
      lockIcon.style.marginRight = '2px';
      
      const lockText = document.createElement('span');
      lockText.textContent = creature.locked ? 'Locked' : 'Unlocked';
      lockText.style.color = creature.locked ? '#ff6b6b' : '#6bcf7f';
      
      // Add click handler for lock/unlock functionality
      lockStatusDiv.addEventListener('click', async () => {
        try {
          // Prevent multiple clicks
          lockStatusDiv.style.pointerEvents = 'none';
          lockStatusDiv.style.opacity = '0.7';
          
          // Show loading state
          const originalIcon = lockIcon.textContent;
          const originalText = lockText.textContent;
          lockIcon.textContent = '⏳';
          lockText.textContent = 'Updating...';
          lockText.style.color = '#ffaa00';
          
          // Make API call to toggle lock status
          const response = await fetch('https://bestiaryarena.com/api/trpc/game.lockMonster?batch=1', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Game-Version': '1'
            },
            body: JSON.stringify({
              "0": {
                "json": {
                  "locked": !creature.locked,
                  "monsterId": creature.id
                }
              }
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Update local monster state
          creature.locked = !creature.locked;
          
          // Update UI
          lockIcon.textContent = creature.locked ? '🔒' : '🔓';
          lockText.textContent = creature.locked ? 'Locked' : 'Unlocked';
          lockText.style.color = creature.locked ? '#ff6b6b' : '#6bcf7f';
          
          // Show success feedback
          lockStatusDiv.style.background = creature.locked ? 'rgba(255, 107, 107, 0.2)' : 'rgba(107, 207, 127, 0.2)';
          setTimeout(() => {
            lockStatusDiv.style.background = 'transparent';
          }, 500);
          
        } catch (error) {
          console.error('Failed to toggle lock status:', error);
          
          // Revert to original state on error
          lockIcon.textContent = originalIcon;
          lockText.textContent = originalText;
          lockText.style.color = creature.locked ? '#ff6b6b' : '#6bcf7f';
          
          // Show error feedback
          lockStatusDiv.style.background = 'rgba(255, 0, 0, 0.2)';
          setTimeout(() => {
            lockStatusDiv.style.background = 'transparent';
          }, 1000);
        } finally {
          // Re-enable clicking
          lockStatusDiv.style.pointerEvents = 'auto';
          lockStatusDiv.style.opacity = '1';
        }
      });
      
      lockStatusDiv.appendChild(lockIcon);
      lockStatusDiv.appendChild(lockText);
      detailsCol.appendChild(lockStatusDiv);
      
      // Portrait and name container
      const portraitNameContainer = document.createElement('div');
      portraitNameContainer.style.display = 'flex';
      portraitNameContainer.style.flexDirection = 'row';
      portraitNameContainer.style.alignItems = 'center';
      portraitNameContainer.style.gap = '8px';
      portraitNameContainer.style.marginTop = '5px';
      portraitNameContainer.style.width = '100%';
      portraitNameContainer.style.justifyContent = 'flex-start';
      
      // Portrait
      const borderDiv = document.createElement('div');
      borderDiv.setAttribute('role', 'none');
      borderDiv.className = 'has-rarity absolute inset-0 z-1 opacity-80';
      borderDiv.setAttribute('data-rarity', rarity);
      borderDiv.style.position = 'relative';
      borderDiv.style.display = 'inline-block';
      borderDiv.style.width = '40px';
      borderDiv.style.height = '40px';
      borderDiv.style.overflow = 'hidden';
      borderDiv.style.boxSizing = 'border-box';
      borderDiv.style.flexShrink = '0';
      const img = document.createElement('img');
      img.src = `/assets/portraits/${creature.gameId}.png`;
      img.width = 40;
      img.height = 40;
      img.style.display = 'block';
      img.style.margin = '0 auto';
      img.style.borderRadius = '6px';
      img.style.position = 'relative';
      img.style.zIndex = '2';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      borderDiv.appendChild(img);
      portraitNameContainer.appendChild(borderDiv);
      
      // Name and level container
      const nameLevelContainer = document.createElement('div');
      nameLevelContainer.style.display = 'flex';
      nameLevelContainer.style.flexDirection = 'column';
      nameLevelContainer.style.alignItems = 'flex-start';
      nameLevelContainer.style.gap = '2px';
      nameLevelContainer.style.flex = '1';
      nameLevelContainer.style.minWidth = '0';
      nameLevelContainer.style.overflow = 'hidden';
      
      // Creature name
      const nameDiv = document.createElement('div');
      const creatureName = getMonsterNameFromId(creature.gameId) || creature.name || creature.gameId;
      nameDiv.textContent = creatureName;
      nameDiv.style.fontSize = '13px';
      nameDiv.style.fontWeight = 'bold';
      nameDiv.style.color = '#ffffff';
      nameDiv.style.fontFamily = 'Arial, sans-serif';
      nameDiv.style.lineHeight = '1.2';
      nameDiv.style.overflow = 'hidden';
      nameDiv.style.textOverflow = 'ellipsis';
      nameDiv.style.whiteSpace = 'nowrap';
      nameDiv.style.width = '100%';
      nameLevelContainer.appendChild(nameDiv);
      
      // Level
      const levelDiv = document.createElement('div');
      levelDiv.textContent = `Level ${getLevelFromExp(creature.exp)}`;
      levelDiv.style.fontSize = '11px';
      levelDiv.style.color = '#cccccc';
      levelDiv.style.fontFamily = 'Arial, sans-serif';
      levelDiv.style.lineHeight = '1.2';
      nameLevelContainer.appendChild(levelDiv);
      
      portraitNameContainer.appendChild(nameLevelContainer);
      detailsCol.appendChild(portraitNameContainer);
      // --- Combined stat/dice rules UI below portrait ---
      const combinedDiv = document.createElement('div');
      combinedDiv.style.display = 'flex';
      combinedDiv.style.flexDirection = 'column';
      combinedDiv.style.gap = '2px';
      combinedDiv.style.marginTop = '6px';
      combinedDiv.style.alignItems = 'stretch';
      combinedDiv.style.width = '100%';
      combinedDiv.style.maxWidth = '100%';
      combinedDiv.style.overflow = 'auto';
      combinedDiv.style.boxSizing = 'border-box';
      combinedDiv.style.padding = '0 5px';
      // --- Stat selection limit logic ---
      let maxStats = 5;
      if (Array.isArray(selectedDice) && selectedDice.length > 0) {
        const minDice = Math.min(...selectedDice);
        maxStats = 6 - minDice;
        if (maxStats < 1) maxStats = 1;
      }
      // Track all checkboxes for dynamic enable/disable
      const checkboxElements = [];
      function updateCheckboxStates() {
        const checkedCount = STAT_KEYS.filter(k => diceRulesConfig[k].active).length;
        checkboxElements.forEach(({checkbox, targetInput, key}) => {
          // Only update enabled/disabled state, never checked state
          if (!checkbox.checked && checkedCount >= maxStats) {
            checkbox.disabled = true;
            checkbox.style.opacity = '0.5';
            checkbox.style.cursor = 'not-allowed';
          } else {
            checkbox.disabled = false;
            checkbox.style.opacity = '';
            checkbox.style.cursor = '';
          }
          if (targetInput) {
            if (checkbox.checked) {
              targetInput.disabled = false;
              targetInput.style.color = 'black';
              targetInput.style.background = '';
            } else {
              targetInput.disabled = true;
              targetInput.style.color = '#888';
              targetInput.style.background = '#ddd';
            }
          }
        });
      }
      STAT_LABELS.forEach(({key, label, icon}) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'row';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '0';
        row.style.width = '100%';
        row.style.maxWidth = '100%';
        row.style.overflow = 'hidden';
        row.style.boxSizing = 'border-box';
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!diceRulesConfig[key].active;
        checkbox.setAttribute('data-stat', key);
        checkbox.style.margin = '0 2px 0 0';
        // Append elements in correct order
        row.appendChild(checkbox);
        // Icon
        const img = document.createElement('img');
        img.src = icon;
        img.alt = label;
        img.style.width = '18px';
        img.style.height = '18px';
        img.style.display = 'inline-block';
        img.style.verticalAlign = 'middle';
        img.style.flexShrink = '0';
        img.style.margin = '0 4px 0 0';
        row.appendChild(img);
        // Current stat value (dynamic)
        const statValue = document.createElement('span');
        statValue.textContent = creature[key] ?? 0;
        statValue.style.fontWeight = 'bold';
        statValue.style.fontSize = '13px';
        statValue.style.minWidth = '18px';
        statValue.style.textAlign = 'right';
        statValue.style.display = 'inline-block';
        statValue.style.overflow = 'hidden';
        statValue.style.textOverflow = 'ellipsis';
        statValue.style.whiteSpace = 'nowrap';
        statValue.style.margin = '0 4px 0 0';
        row.appendChild(statValue);
        // Stat bar (Cyclopedia style)
        const stat = creature[key] ?? 0;
        const max = STAT_MAX[key] || 100;
        const percent = Math.max(0, Math.min(1, stat / max));
        const barWidth = Math.round(percent * 100);
        const barColor = STAT_BAR_COLOR[key] || '#fff';
        const barWrapper = document.createElement('div');
        barWrapper.className = 'relative';
        barWrapper.style.flex = '1 1 0';
        barWrapper.style.minWidth = '32px';
        barWrapper.style.maxWidth = '60px';
        barWrapper.style.margin = '0 4px 0 0';
        barWrapper.style.position = 'relative';
        // Outer bar
        const barOuter = document.createElement('div');
        barOuter.className = 'h-1 w-full border border-solid border-black bg-black frame-pressed-1 relative overflow-hidden duration-300 fill-mode-forwards gene-stats-bar-filled';
        barOuter.style.height = '6px';
        barOuter.style.width = '100%';
        barOuter.style.background = '#111';
        barOuter.style.border = '1px solid #222';
        barOuter.style.borderRadius = '2px';
        barOuter.style.position = 'relative';
        // Bar fill wrapper
        const barFillWrap = document.createElement('div');
        barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';
        barFillWrap.style.height = '100%';
        barFillWrap.style.width = '100%';
        // Bar fill
        const barFill = document.createElement('div');
        barFill.className = 'h-full shrink-0';
        barFill.style.width = barWidth + '%';
        barFill.style.background = barColor;
        barFill.style.height = '100%';
        barFill.style.borderRadius = '2px';
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
        // Assemble bar
        barWrapper.appendChild(barOuter);
        barWrapper.appendChild(barRight);
        row.appendChild(barWrapper);
        // Target input
        let targetInput = document.createElement('input');
        targetInput.type = 'number';
        targetInput.min = '1';
        targetInput.max = '20';
        targetInput.value = diceRulesConfig[key].target;
        targetInput.style.width = '38px';
        targetInput.style.textAlign = 'center';
        targetInput.disabled = !checkbox.checked;
        targetInput.style.color = checkbox.checked ? 'black' : '#888';
        targetInput.style.background = checkbox.checked ? '' : '#ddd';
        targetInput.style.overflow = 'hidden';
        targetInput.style.textOverflow = 'ellipsis';
        targetInput.style.whiteSpace = 'nowrap';
        targetInput.style.boxSizing = 'border-box';
        targetInput.style.margin = '0';
        row.appendChild(targetInput);
        // Always add a checkmark container after the target input
        const checkmarkContainer = document.createElement('span');
        checkmarkContainer.className = 'dice-target-checkmark';
        checkmarkContainer.style.display = 'inline-block';
        checkmarkContainer.style.width = '20px';
        checkmarkContainer.style.height = '18px';
        checkmarkContainer.style.verticalAlign = 'middle';
        checkmarkContainer.style.marginLeft = '4px';
        row.appendChild(checkmarkContainer);
        // Add green checkmark if stat matches target (exact match only)
        function updateCheckmark() {
          // Only add if stat matches target
          const statVal = creature[key] ?? 0;
          const targetVal = Number(targetInput.value);
          if (statVal === targetVal) {
            checkmarkContainer.innerHTML = `
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="vertical-align:middle;display:inline-block;">
                <path d="M4 9.5L8 13L14 6" stroke="#28c76f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>`;
            checkmarkContainer.title = 'Stat matches target!';
          } else {
            checkmarkContainer.innerHTML = '';
            checkmarkContainer.title = '';
          }
        }
        updateCheckmark();
        targetInput.addEventListener('input', updateCheckmark);
        
        // Update status displays when target value changes
        targetInput.addEventListener('input', () => {
          setTimeout(() => {
            updateStatusDisplays();
          }, 0);
        });
        // Store both checkbox and targetInput for state updates
        checkboxElements.push({checkbox, targetInput, key, row, checkmarkContainer});
        checkbox.addEventListener('change', e => {
          // Enforce stat selection limit
          const checkedCount = STAT_KEYS.filter(k => {
            if (k === key) {
              return e.target.checked;
            } else {
              return diceRulesConfig[k].active;
            }
          }).length;
          if (e.target.checked && checkedCount > maxStats) {
            e.target.checked = false;
            return;
          }
          diceRulesConfig[key].active = e.target.checked;
          // Update input and checkmark in place
          targetInput.disabled = !checkbox.checked;
          targetInput.style.color = checkbox.checked ? 'black' : '#888';
          targetInput.style.background = checkbox.checked ? '' : '#ddd';
          updateCheckmark();
          updateCheckboxStates();
          
          // Update status displays when stat selection changes
          setTimeout(() => {
            updateStatusDisplays();
          }, 0);
        });
        combinedDiv.appendChild(row);
      });
      // After all checkboxes are created, update their states
      setTimeout(updateCheckboxStates, 0);
      detailsCol.appendChild(combinedDiv);
      return detailsCol;
    } catch (e) {
      const div = document.createElement('div');
      div.innerText = 'Error loading details.' + (e && e.message ? ('\n' + e.message) : '');
      return div;
    }
  }

  function getDiceManipulatorsRow(selectedDiceArr, onSelectDice) {
    // selectedDiceArr is now an array of activated indices
    const playerContext = globalThis.state.player.getSnapshot().context;
    const inventory = playerContext.inventory || {};
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'row';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'center';
    row.style.gap = '8px';
    row.style.marginTop = '4px';
    row.style.height = '50%';
    row.style.flex = '0 0 50%';
    for (let i = DICE_CONFIG.MIN_DICE; i <= DICE_CONFIG.MAX_DICE; i++) {
      const key = `diceManipulator${i}`;
      const count = inventory[key] || 0;
      // Wrapper for button and count
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'flex-start';
      // Button
      const btn = document.createElement('button');
      btn.className = 'focus-style-visible active:opacity-70';
      btn.setAttribute('data-state', Array.isArray(selectedDiceArr) && selectedDiceArr.includes(i) ? 'selected' : 'closed');
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.padding = '0';
      btn.style.margin = '0';
      btn.style.cursor = 'pointer';
      btn.onclick = () => {
        if (onSelectDice) onSelectDice(i);
        if (!(Array.isArray(selectedDiceArr) && selectedDiceArr.includes(i))) {
        }
        // --- Deselect all stats if first dice is now not selected ---
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            const currentDiceRulesConfig = initializeDiceRulesConfig();
            // Find the updated selectedDice (after onSelectDice)
            let updatedSelectedDice = selectedDiceArr;
            if (typeof window.DiceRollerSelectedDice === 'function') {
              updatedSelectedDice = window.DiceRollerSelectedDice();
            }
            // Fallback: try to get from closure if possible
            if (!Array.isArray(updatedSelectedDice)) {
              updatedSelectedDice = selectedDiceArr;
            }
            if (!updatedSelectedDice.includes(1)) {
              STAT_KEYS.forEach(key => {
                currentDiceRulesConfig[key].active = false;
              });
              // Try to re-render if possible
              if (typeof window.DiceRollerRender === 'function') {
                window.DiceRollerRender();
              }
            }
          }
        }, 0);
      };
      // Container slot
      const slot = document.createElement('div');
      slot.setAttribute('data-hoverable', 'true');
      slot.setAttribute('data-highlighted', 'false');
      slot.setAttribute('data-disabled', 'false');
      slot.className = "container-slot surface-darker data-[disabled='true']:dithered data-[highlighted='true']:unset-border-image data-[hoverable='true']:hover:unset-border-image";
      slot.style.overflow = 'visible';
      // Green border if activated (square, exactly around data-rarity border)
      if (Array.isArray(selectedDiceArr) && selectedDiceArr.includes(i)) {
        slot.style.boxShadow = '0 0 0 2px #00ff00';
        slot.style.borderRadius = '0';
      } else {
        slot.style.boxShadow = 'none';
      }
      // Rarity border
      const rarityDiv = document.createElement('div');
      rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
      rarityDiv.setAttribute('data-rarity', String(i)); // 1-5 for rarity
      // Sprite structure (game's way)
      const sizeSprite = document.createElement('div');
      sizeSprite.className = 'relative size-sprite';
      sizeSprite.style.overflow = 'visible';
      const spriteDiv = document.createElement('div');
      spriteDiv.className = `sprite item relative id-${DICE_CONFIG.DICE_MANIPULATOR_ID}`; // Always id-35909 for dice manipulators
      const viewportDiv = document.createElement('div');
      viewportDiv.className = 'viewport';
      viewportDiv.style.width = '32px';
      viewportDiv.style.height = '32px';
      const img = document.createElement('img');
      img.alt = DICE_CONFIG.DICE_MANIPULATOR_ID;
      img.setAttribute('data-cropped', 'false');
      img.className = 'spritesheet';
      img.style.setProperty('--cropX', '0');
      img.style.setProperty('--cropY', '0');
      viewportDiv.appendChild(img);
      spriteDiv.appendChild(viewportDiv);
      sizeSprite.appendChild(spriteDiv);
      rarityDiv.appendChild(sizeSprite);
      slot.appendChild(rarityDiv);
      btn.appendChild(slot);
      wrapper.appendChild(btn);
      // Count below icon (plain text, modern font)
      const countBelow = document.createElement('span');
      countBelow.style.display = 'block';
      countBelow.style.textAlign = 'center';
      countBelow.style.fontFamily = 'Arial, sans-serif';
      countBelow.style.fontSize = '11px';
      countBelow.style.marginTop = '4px';
      countBelow.setAttribute('translate', 'no');
      if (count === 0) {
        countBelow.textContent = '0';
        countBelow.style.color = '#888';
        countBelow.style.fontStyle = 'italic';
        countBelow.style.fontWeight = 'normal';
      } else {
        countBelow.textContent = (count >= 1000 ? (count / 1000).toFixed(1).replace('.', ',') + 'K' : count);
        countBelow.style.color = '#fff';
        countBelow.style.fontStyle = 'normal';
        countBelow.style.fontWeight = 'bold';
      }
      wrapper.appendChild(countBelow);
      // If activated, add a button below that says 'Dice manipulator X activated'
      row.appendChild(wrapper);
    }
    return row;
  }

  function getDiceRulesRow() {
    return document.createElement('div');
  }

// =======================
// 5. Autoroll Logic
// =======================
  async function autoroll(selectedGameId, requiredDiceTier, availableStats, updateRollStatus, rerenderDetails) {
    // Validate dice selection using utility function
    try {
      validateDiceSelection([requiredDiceTier], availableStats);
    } catch (error) {
      updateRollStatus(error.message);
      throw error;
    }
    updateRollStatus(`Rolling ${availableStats.join(', ')} with tier ${requiredDiceTier} dice...`);
    // Throttle API calls to prevent overwhelming the server
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < API_THROTTLE_DELAY) {
      await new Promise(resolve => setTimeout(resolve, API_THROTTLE_DELAY - timeSinceLastCall));
    }
    lastApiCall = Date.now();
    const requestBody = {
      "0": {
        "json": {
          "rarity": requiredDiceTier,
          "manipStats": availableStats,
          "monsterId": selectedGameId
        }
      }
    };
    let response;
    let retryCount = 0;
    let wasRateLimited = false;
    // Add a variable to hold the rate-limited animation interval
    let rateLimitedInterval = null;
    while (true) {
      try {
        response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-game-version": "1"
          },
          body: JSON.stringify(requestBody)
        });
      } catch (err) {
        console.error('[Stats Roller] Fetch error:', err);
        throw err;
      }
      if (response.status !== 429) {
        // If we were rate-limited before, restore button text to 'Autorolling...'
        if (wasRateLimited && typeof window !== 'undefined') {
          const autoRollBtn = document.querySelector('div[role="dialog"][data-state="open"] .diceroller-btn');
          if (autoRollBtn) {
            autoRollBtn.textContent = 'Autorolling...';
            if (rateLimitedInterval) {
              clearInterval(rateLimitedInterval);
              rateLimitedInterval = null;
            }
          }
          wasRateLimited = false;
        }
        break;
      }
      // Handle 429 Too Many Requests
      retryCount++;
      if (retryCount > 5) {
        // Update autoroll button to show rate limit
        if (typeof window !== 'undefined') {
          const autoRollBtn = document.querySelector('div[role="dialog"][data-state="open"] .diceroller-btn');
          if (autoRollBtn) {
            let dotCount = 1;
            autoRollBtn.textContent = 'Rate-limited.';
            if (rateLimitedInterval) clearInterval(rateLimitedInterval);
            rateLimitedInterval = setInterval(() => {
              dotCount = (dotCount % 3) + 1;
              autoRollBtn.textContent = 'Rate-limited' + '.'.repeat(dotCount);
            }, 400);
          }
        }
        throw new Error('Rate limit reached too many times.');
      }
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000; // fallback 2s
      // Update autoroll button to show rate limit
      if (typeof window !== 'undefined') {
        const autoRollBtn = document.querySelector('div[role="dialog"][data-state="open"] .diceroller-btn');
        if (autoRollBtn) {
          let dotCount = 1;
          autoRollBtn.textContent = 'Rate-limited.';
          if (rateLimitedInterval) clearInterval(rateLimitedInterval);
          rateLimitedInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            autoRollBtn.textContent = 'Rate-limited' + '.'.repeat(dotCount);
          }, 400);
        }
      }
      wasRateLimited = true;
      await new Promise(res => setTimeout(res, waitTime));
    }
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.error('[Stats Roller] Non-JSON response:', text);
      throw new Error('API returned non-JSON response: ' + text);
    }
    if (!response.ok) {
      console.error('[Stats Roller] API error response:', data);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`);
    }
    // Update local monster state with new stats from API
    const newStats = data[0]?.result?.data?.json?.manipulatingMonster;
    if (newStats && newStats.id) {
      const monsters = globalThis.state.player.getSnapshot().context.monsters;
      const idx = monsters.findIndex(m => String(m.id) === String(newStats.id));
      if (idx !== -1) {
        Object.assign(monsters[idx], newStats);
      }
      if (typeof rerenderDetails === 'function') rerenderDetails();
    }
    // Check if the API returned an error
    if (data[0]?.error) {
      throw new Error(`API Error: ${data[0].error.message || 'Unknown error'}`);
    }
    // Update the UI with the new stats
    // If we were rate-limited before, restore button text to 'Autorolling...'
    if (wasRateLimited && typeof window !== 'undefined') {
      const autoRollBtn = document.querySelector('div[role="dialog"][data-state="open"] .diceroller-btn');
      if (autoRollBtn) {
        autoRollBtn.textContent = 'Autorolling...';
        if (rateLimitedInterval) {
          clearInterval(rateLimitedInterval);
          rateLimitedInterval = null;
        }
      }
      wasRateLimited = false;
    }
    updateRollStatus('Roll complete!');
    return data;
  }

  function getCreatureDetailsCol(selectedGameId, getSelectedDiceTier, getAvailableStats, render, selectedDice, statusMessage) {
    // Returns a column with 3 rows: row1 = creature details, row2 = Autoroll/Stop buttons, row3 = status
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.height = '100%';
    col.style.width = '100%';
    col.style.justifyContent = 'stretch';
    col.style.alignItems = 'center';
    // Row 1: creature details (50%)
    let row1 = getCreatureDetails(selectedGameId, selectedDice);
    row1.style.flex = '0 0 50%';
    row1.style.height = '50%';
    row1.style.maxHeight = '50%';
    row1.style.overflow = 'auto';
    row1.style.minHeight = '0';
    col.appendChild(row1);
    
    // Separator 1
    const separator1 = document.createElement('div');
    separator1.className = 'separator my-2.5';
    separator1.setAttribute('role', 'none');
    separator1.style.margin = '8px 0px';
    col.appendChild(separator1);
    
    // Row 2: Status messages (25%) - MOVED FROM ROW 3
    const row2 = document.createElement('div');
    row2.style.flex = '0 0 25%';
    row2.style.height = '25%';
    row2.style.maxHeight = '25%';
    row2.style.minHeight = '0';
    row2.style.display = 'flex';
    row2.style.flexDirection = 'column';
    row2.style.alignItems = 'flex-start';
    row2.style.justifyContent = 'center';
    row2.style.width = '100%';
    row2.style.boxSizing = 'border-box';
    row2.style.gap = '4px';
    row2.style.padding = '0 8px';
    
    // Dice Manipulator status
    const diceStatusDiv = document.createElement('div');
    diceStatusDiv.style.fontSize = '10px';
    diceStatusDiv.style.color = '#ffffff';
    diceStatusDiv.style.textAlign = 'left';
    diceStatusDiv.style.padding = '2px 0';
    diceStatusDiv.style.minHeight = '16px';
    diceStatusDiv.style.fontFamily = 'Arial, sans-serif';
    diceStatusDiv.style.fontWeight = 'normal';
    diceStatusDiv.style.lineHeight = '1.2';
    diceStatusDiv.textContent = 'Dice Manipulator: 0';
    row2.appendChild(diceStatusDiv);
    
    // Autoroll count status
    const rollCountDiv = document.createElement('div');
    rollCountDiv.style.fontSize = '10px';
    rollCountDiv.style.color = '#ffffff';
    rollCountDiv.style.textAlign = 'left';
    rollCountDiv.style.padding = '2px 0';
    rollCountDiv.style.minHeight = '16px';
    rollCountDiv.style.fontFamily = 'Arial, sans-serif';
    rollCountDiv.style.fontWeight = 'normal';
    rollCountDiv.style.lineHeight = '1.2';
    rollCountDiv.textContent = 'Autorolled (0)';
    row2.appendChild(rollCountDiv);
    
    // Stats being rolled status
    const statsStatusDiv = document.createElement('div');
    statsStatusDiv.className = 'dice-roller-status-area';
    statsStatusDiv.style.fontSize = '10px';
    statsStatusDiv.style.color = '#ffffff';
    statsStatusDiv.style.textAlign = 'left';
    statsStatusDiv.style.padding = '2px 0';
    statsStatusDiv.style.minHeight = '16px';
    statsStatusDiv.style.fontFamily = 'Arial, sans-serif';
    statsStatusDiv.style.fontWeight = 'normal';
    statsStatusDiv.style.lineHeight = '1.2';
    statsStatusDiv.textContent = 'Stats: None';
    row2.appendChild(statsStatusDiv);
    
    // Function to update status displays
    function updateStatusDisplays() {
      // Use debouncing to prevent excessive updates during autoroll
      debouncedStatusUpdate(() => {
        // Update dice manipulator name and count
        const playerContext = globalThis.state.player.getSnapshot().context;
        const inventory = playerContext.inventory || {};
        const selectedDiceTier = getSelectedDiceTier();
        const diceKey = `diceManipulator${selectedDiceTier}`;
        const diceCount = inventory[diceKey] || 0;
        
        // Get dice manipulator name based on tier
        const diceNames = {
          1: '(Common)',
          2: '(Uncommon)', 
          3: '(Rare)',
          4: '(Mythic)',
          5: '(Legendary)'
        };
        const rarityColors = {
          1: '#888888', // Grey for Common
          2: '#4CAF50', // Green for Uncommon
          3: '#2196F3', // Blue for Rare
          4: '#9C27B0', // Purple for Mythic
          5: '#FF9800'  // Orange/Gold for Legendary
        };
        const rarityName = diceNames[selectedDiceTier] || '(Unknown)';
        const rarityColor = rarityColors[selectedDiceTier] || '#888888';
        diceStatusDiv.innerHTML = `Dice Manipulator <span style="color: ${rarityColor};">${rarityName}</span>`;
        
        // Update stats being rolled
        const availableStats = getAvailableStats();
        const statLabels = {
          'hp': 'HP',
          'ad': 'AD', 
          'ap': 'AP',
          'armor': 'ARM',
          'magicResist': 'MR'
        };
        const statText = availableStats.map(stat => statLabels[stat] || stat).join(', ');
        statsStatusDiv.textContent = `Stats: ${statText || 'None'}`;
      });
    }
    
    // Make updateStatusDisplays available globally for this modal
    window.updateStatusDisplays = updateStatusDisplays;
    
    // Make resetRollCount available globally for this modal
    window.resetRollCount = () => {
      if (rollCountDiv) {
        rollCountDiv.textContent = 'Autorolled (0)';
      }
    };
    
    // Initial update
    updateStatusDisplays();
    
    col.appendChild(row2);
    
    // Separator 2
    const separator2 = document.createElement('div');
    separator2.className = 'separator my-2.5';
    separator2.setAttribute('role', 'none');
    separator2.style.margin = '8px 0px';
    col.appendChild(separator2);
    
    // Row 3: Autoroll/Stop buttons (15%) - MOVED FROM ROW 2
    const row3 = document.createElement('div');
    row3.style.flex = '0 0 15%';
    row3.style.height = '15%';
    row3.style.maxHeight = '15%';
    row3.style.minHeight = '0';
    row3.style.display = 'flex';
    row3.style.alignItems = 'center';
    row3.style.justifyContent = 'center';
    row3.style.width = '100%';
    row3.style.boxSizing = 'border-box';
    // Wrapper for buttons only
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.display = 'flex';
    buttonWrapper.style.flexDirection = 'row';
    buttonWrapper.style.gap = '8px';
    buttonWrapper.style.alignItems = 'center';
    
    // Autoroll button
    const autoRollBtn = document.createElement('button');
    autoRollBtn.textContent = 'Autoroll';
    autoRollBtn.className = 'diceroller-btn';
    autoRollBtn.style.width = '120px';
    autoRollBtn.style.padding = '6px 28px';
    autoRollBtn.style.margin = '0 4px';
    autoRollBtn.style.boxSizing = 'border-box';
    autoRollBtn.style.setProperty('font-size', '12px', 'important');
    buttonWrapper.appendChild(autoRollBtn);
    
    // Stop button
    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.className = 'diceroller-btn';
    stopBtn.style.setProperty('width', '60px', 'important');
    stopBtn.style.setProperty('min-width', '60px', 'important');
    stopBtn.style.setProperty('max-width', '60px', 'important');
    stopBtn.style.padding = '6px 12px';
    stopBtn.style.margin = '0 4px';
    stopBtn.style.boxSizing = 'border-box';
    stopBtn.style.setProperty('font-size', '12px', 'important');
    stopBtn.style.display = 'none'; // Hidden initially
    buttonWrapper.appendChild(stopBtn);
    
    row3.appendChild(buttonWrapper);
    col.appendChild(row3);
    
    // Autoroll button logic
    let autorolling = false;
    let autorollAttempt = 0;
    
    autoRollBtn.onclick = async () => {
      if (!autorolling) {
        // Start autoroll
        if (!selectedGameId) {
          // Show error in stats area temporarily
          const originalText = statsStatusDiv.textContent;
          statsStatusDiv.textContent = 'Select a creature first.';
          setTimeout(() => {
            statsStatusDiv.textContent = originalText;
          }, 2000);
          return;
        }
        
        // Check if creature is locked
        const monsters = safeGetMonsters();
        const creature = monsters.find(c => String(c.id) === String(selectedGameId));
        if (creature && creature.locked) {
          // Show error in stats area temporarily
          const originalText = statsStatusDiv.textContent;
          statsStatusDiv.textContent = 'Cannot autoroll locked creatures. Unlock first.';
          setTimeout(() => {
            statsStatusDiv.textContent = originalText;
          }, 3000);
          return;
        }
        let lastDiceSelection = selectedDice.slice(); // Track dice selection at start
        const originalDiceSelection = selectedDice.slice(); // Save original user dice selection
        const getCheckboxState = () => ({
          stopWhenChangingDice: typeof render.stopWhenChangingDice === 'undefined' ? true : render.stopWhenChangingDice,
          continuouslyChangeDice: typeof render.continuouslyChangeDice === 'undefined' ? false : render.continuouslyChangeDice
        });
        let selectedDiceTier = getSelectedDiceTier();
        let availableStats = getAvailableStats();
        // --- Add validation for stat/dice combination ---
        if (!Array.isArray(selectedDice) || selectedDice.length === 0) {
          // Show error in stats area temporarily
          const originalText = statsStatusDiv.textContent;
          statsStatusDiv.textContent = 'Please select at least one dice to roll.';
          setTimeout(() => {
            statsStatusDiv.textContent = originalText;
          }, 2000);
          return;
        }
        const minDice = Math.min(...selectedDice);
        const maxStats = 6 - minDice;
        const currentDiceRulesConfig = initializeDiceRulesConfig();
        const selectedStats = Object.keys(currentDiceRulesConfig).filter(key => currentDiceRulesConfig[key].active);
        if (selectedStats.length === 0) {
          // Show error in stats area temporarily
          const originalText = statsStatusDiv.textContent;
          statsStatusDiv.textContent = 'Select at least one stat to roll for.';
          setTimeout(() => {
            statsStatusDiv.textContent = originalText;
          }, 2000);
          return;
        }
        if (selectedStats.length !== maxStats) {
          // Show error in stats area temporarily
          const originalText = statsStatusDiv.textContent;
          statsStatusDiv.textContent = `Select exactly ${maxStats} stats for dice ${minDice}.`;
          setTimeout(() => {
            statsStatusDiv.textContent = originalText;
          }, 2000);
          return;
        }
        // Determine if any target is set for selected stats
        const targetsSet = availableStats.some(stat => currentDiceRulesConfig[stat].target > 0);
        autorolling = true;
        autorollCancel = false;
        autorollAttempt = 0;
        autoRollBtn.textContent = 'Autorolling...';
        autoRollBtn.disabled = true;
        stopBtn.style.display = 'inline-block';
        // Only reset count if this is a new autoroll (not continuing)
        if (autorollAttempt === 0) {
          rollCountDiv.textContent = 'Autorolled (0)';
        }
                  if (targetsSet) {
            // Autoroll loop
            while (autorolling) {
              autorollAttempt++;
              // Update roll count
              rollCountDiv.textContent = `Autorolled (${autorollAttempt})`;
              
              // Check for dice selection change
              if (JSON.stringify(selectedDice) !== JSON.stringify(lastDiceSelection)) {
                const { stopWhenChangingDice, continuouslyChangeDice } = getCheckboxState();
                if (stopWhenChangingDice) {
                  // Show message in stats area temporarily
                  const originalText = statsStatusDiv.textContent;
                  statsStatusDiv.textContent = 'Autoroll stopped: dice selection changed.';
                  setTimeout(() => {
                    statsStatusDiv.textContent = originalText;
                  }, 2000);
                  autorolling = false;
                  break;
                } else if (continuouslyChangeDice) {
                  // Update to new dice selection and continue
                  lastDiceSelection = selectedDice.slice();
                  selectedDiceTier = getSelectedDiceTier();
                  availableStats = getAvailableStats();
                  // Update status displays
                  updateStatusDisplays();
                  // Show message in stats area temporarily
                  const originalText = statsStatusDiv.textContent;
                  statsStatusDiv.textContent = 'Dice selection changed, continuing with new dice.';
                  setTimeout(() => {
                    statsStatusDiv.textContent = originalText;
                  }, 2000);
                }
              }
              try {
                await autoroll(selectedGameId, selectedDiceTier, availableStats, msg => { 
                                  // Update status displays after each roll
                updateStatusDisplays();
              }, () => {
                // Optimized rerender - only update if modal is still open
                const modal = DOMCache.get('div[role="dialog"][data-state="open"]');
                if (modal && modal.contains(col)) {
                  const newRow1 = getCreatureDetails(selectedGameId, selectedDice);
                  newRow1.style.flex = '0 0 50%';
                  newRow1.style.height = '50%';
                  newRow1.style.maxHeight = '50%';
                  newRow1.style.overflow = 'auto';
                  newRow1.style.minHeight = '0';
                  col.replaceChild(newRow1, row1);
                  row1 = newRow1;
                }
              });
              } catch (err) {
                // Show error in stats area temporarily
                const originalText = statsStatusDiv.textContent;
                statsStatusDiv.textContent = 'Error: ' + err.message;
                setTimeout(() => {
                  statsStatusDiv.textContent = originalText;
                }, 3000);
                autorolling = false;
                break;
              }
            // Check if target met (for each stat)
            const monsters = safeGetMonsters();
            const creature = monsters.find(c => String(c.id) === String(selectedGameId));
            let allMet = true;
            let reachedTargets = [];
            for (let i = 0; i < availableStats.length; i++) {
              const stat = availableStats[i];
              const target = currentDiceRulesConfig[stat].target;
              if (target > 0 && (creature[stat] || 0) >= target) {
                reachedTargets.push({ stat, diceIndex: i });
              } else if (target > 0 && (creature[stat] || 0) < target) {
                allMet = false;
              }
            }
            // If in stopWhenChangingDice mode and any target is reached, stop, deselect dice/stat, and print message
            // If in continuouslyChangeDice mode and any target is reached, continue with new stats/dice
            const { stopWhenChangingDice, continuouslyChangeDice } = getCheckboxState();
            if (reachedTargets.length > 0) {
              // Deselect dice and stats for reached targets
              let msg = 'Target(s) reached: ' + reachedTargets.map(rt => rt.stat).join(', ');
              // Only uncheck the stat(s) whose target was reached
              for (const { stat } of reachedTargets) {
                if (currentDiceRulesConfig[stat]) {
                  currentDiceRulesConfig[stat].active = false;
                }
              }
              // After unchecking, update dice selection to match checked stats
              const checkedStats = Object.keys(currentDiceRulesConfig).filter(key => currentDiceRulesConfig[key].active);
              const diceNeeded = checkedStats.length;
              
              const minDiceNeeded = 6 - diceNeeded;
              
              selectedDice.length = 0;
              for (const originalDice of originalDiceSelection) {
                if (originalDice >= minDiceNeeded) {
                  selectedDice.push(originalDice);
                }
              }
              
                              if (stopWhenChangingDice) {
                  // Show message in stats area temporarily
                const originalText = statsStatusDiv.textContent;
                statsStatusDiv.textContent = msg + '. Autoroll stopped.';
                setTimeout(() => {
                  statsStatusDiv.textContent = originalText;
                }, 3000);
                
                // Update UI to reflect the changes (uncheck reached stats and update dice selection)
                setTimeout(() => {
                  // Update stat checkboxes
                  STAT_KEYS.forEach(statKey => {
                    const checkbox = document.querySelector(`input[type="checkbox"][data-stat="${statKey}"]`);
                    if (checkbox) {
                      checkbox.checked = currentDiceRulesConfig[statKey].active;
                    }
                  });
                  
                  // Update dice manipulator buttons
                  updateDiceButtonStates(selectedDice);
                  
                  // Update status displays
                  updateStatusDisplays();
                }, 0);
                
                autorolling = false;
                break;
              } else if (continuouslyChangeDice) {
                // Show message in stats area temporarily
                const originalText = statsStatusDiv.textContent;
                statsStatusDiv.textContent = msg + '. Continuing with new stats...';
                setTimeout(() => {
                  statsStatusDiv.textContent = originalText;
                }, 2000);
                // Update the current dice selection and stats for the next iteration
                selectedDiceTier = getSelectedDiceTier();
                availableStats = getAvailableStats();
                // Update status displays
                updateStatusDisplays();
                // If no more stats to roll for, stop
                if (availableStats.length === 0) {
                  // Show message in stats area temporarily
                  statsStatusDiv.textContent = 'All targets reached!';
                  setTimeout(() => {
                    statsStatusDiv.textContent = originalText;
                  }, 3000);
                  autorolling = false;
                  break;
                }
                // Refresh the UI to show updated dice selection (but don't call full render to avoid disrupting autoroll)
                setTimeout(() => {
                  // Find and update only the dice manipulators in col2 (not creature buttons)
                  updateDiceButtonStates(selectedDice);
                }, 0);
                // Continue with the next iteration
                continue;
              }
            }
            if (allMet) {
              // Show message in stats area temporarily
              const originalText = statsStatusDiv.textContent;
              statsStatusDiv.textContent = 'Target met!';
              setTimeout(() => {
                statsStatusDiv.textContent = originalText;
              }, 3000);
              
              // Update UI to reflect that all targets are met
              setTimeout(() => {
                // Update status displays
                updateStatusDisplays();
              }, 0);
              
              autorolling = false;
              break;
            }
            // Wait a bit before next roll
            await new Promise(res => setTimeout(res, render.autorollSpeed || DICE_CONFIG.ROLL_DELAY));
          }
        } else {
          // Single roll
          autoRollBtn.disabled = true;
          try {
            await autoroll(selectedGameId, selectedDiceTier, availableStats, msg => { 
              // Update status displays after roll
              updateStatusDisplays();
            }, () => {
              const newRow1 = getCreatureDetails(selectedGameId, selectedDice);
              newRow1.style.flex = '0 0 50%';
              newRow1.style.height = '50%';
              newRow1.style.maxHeight = '50%';
              newRow1.style.overflow = 'auto';
              newRow1.style.minHeight = '0';
              col.replaceChild(newRow1, row1);
              row1 = newRow1;
            });
            // Update roll count for single roll (only if not already counting)
            if (autorollAttempt === 0) {
              rollCountDiv.textContent = 'Autorolled (1)';
            }
          } catch (err) {
            // Show error in stats area temporarily
            const originalText = statsStatusDiv.textContent;
            statsStatusDiv.textContent = 'Error: ' + err.message;
            setTimeout(() => {
              statsStatusDiv.textContent = originalText;
            }, 3000);
          } finally {
            autoRollBtn.disabled = false;
            autoRollBtn.textContent = 'Autoroll';
            stopBtn.style.display = 'none';
          }
        }
        autorolling = false;
        autoRollBtn.textContent = 'Autoroll';
        autoRollBtn.disabled = false;
        stopBtn.style.display = 'none';
        
        // Update status displays after autoroll ends
        setTimeout(() => {
          updateStatusDisplays();
        }, 0);
      }
    };
    
    // Stop button logic
    stopBtn.onclick = () => {
      if (autorolling) {
        autorolling = false;
        autoRollBtn.textContent = 'Autoroll';
        autoRollBtn.disabled = false;
        stopBtn.style.display = 'none';
        // Show message in stats area temporarily
        const originalText = statsStatusDiv.textContent;
        statsStatusDiv.textContent = 'Autoroll stopped by user.';
        setTimeout(() => {
          statsStatusDiv.textContent = originalText;
        }, 2000);
        
        // Update status displays after stopping
        setTimeout(() => {
          updateStatusDisplays();
        }, 0);
        if (typeof window !== 'undefined' && rateLimitedInterval) {
          clearInterval(rateLimitedInterval);
          rateLimitedInterval = null;
        }
      }
    };
    return col;
  }

  function updateDetailsOnly(selectedGameId, getSelectedDiceTier, getAvailableStats, selectedDice, lastStatusMessage) {
    const allH2s = document.querySelectorAll('div[role="dialog"][data-state="open"] h2');
    let detailsH2 = null;
    for (const h2 of allH2s) {
      if (h2.textContent && h2.textContent.includes('Details')) {
        detailsH2 = h2;
        break;
      }
    }
    
    if (!detailsH2) {
      return;
    }
    
    const detailsBox = detailsH2.closest('div[style*="flex: 0 0"]');
    if (!detailsBox) {
      return;
    }
    
    const newContent = getCreatureDetailsCol(selectedGameId, getSelectedDiceTier, getAvailableStats, null, selectedDice, lastStatusMessage);
    
    const contentWrapper = detailsBox.querySelector('.column-content-wrapper');
    if (contentWrapper) {
      contentWrapper.innerHTML = '';
      contentWrapper.appendChild(newContent);
    } else {
      detailsBox.innerHTML = '';
      detailsBox.appendChild(newContent);
    }
  }

// =======================
// 6. Modal Management
// =======================
  function showAutoDiceModal() {
    // Inject CSS styles for cross-browser compatibility
    injectDiceRollerButtonStyles();
    
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    setTimeout(() => {
      let selectedGameId = null;
      let selectedDice = [1, 2, 3, 4, 5]; // Start with all activated
      let lastStatusMessage = '';
      const contentDiv = document.createElement('div');
      contentDiv.style.width = '100%';
      contentDiv.style.height = '100%';
      contentDiv.style.minWidth = '700px';
      contentDiv.style.maxWidth = '700px';
      contentDiv.style.minHeight = '400px';
      contentDiv.style.maxHeight = '400px';
      contentDiv.style.boxSizing = 'border-box';
      contentDiv.style.overflow = 'hidden';
      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'row';
      contentDiv.style.gap = '0';
      contentDiv.style.flex = '1 1 0';
      function getSelectedDiceTier() {
        // Return the minimum selected dice manipulator as the tier (or null)
        return selectedDice.length > 0 ? Math.min(...selectedDice) : null;
      }
      function getAvailableStats() {
        const currentDiceRulesConfig = initializeDiceRulesConfig();
        return Object.keys(currentDiceRulesConfig).filter(key => currentDiceRulesConfig[key].active);
      }
      
      // Create updateDetailsOnly closure that captures current state - moved outside render
      let updateDetailsOnlyClosure = null;
      
      function render(statusMessage) {
        if (typeof statusMessage === 'string') {
          lastStatusMessage = statusMessage;
        }
        // --- Enforce stat checkbox logic based on dice selection and selected creature ---
        // Remove all logic in render that force-checks or force-unchecks stats based on dice selection or maxStats
        // --- Preserve scroll position ---
        let oldScrollTop = 0;
        // Try to find the scroll area in the current DOM before clearing
        const oldScrollArea = contentDiv.querySelector('.column-content-wrapper > div[style*="overflow-y: auto"]');
        if (oldScrollArea) {
          oldScrollTop = oldScrollArea.scrollTop;
        }
        contentDiv.innerHTML = '';
        
        // Update the closure with current state
        updateDetailsOnlyClosure = () => {
          updateDetailsOnly(selectedGameId, getSelectedDiceTier, getAvailableStats, selectedDice, lastStatusMessage);
        };
        
        // Create a separate function for creature selection that doesn't trigger full render
        const selectCreature = (gameId) => {
          selectedGameId = gameId;
          // Use updateDetailsOnlyClosure instead of render to preserve scroll position
          if (typeof updateDetailsOnlyClosure === 'function') {
            updateDetailsOnlyClosure();
          } else {
            render();
          }
        };
        
        // Only update details for the selected creature
        const col1 = createBox({
          title: 'Creatures',
          content: getCreatureList(selectCreature, selectedDice, render, updateDetailsOnlyClosure, selectedGameId, getSelectedDiceTier, getAvailableStats, lastStatusMessage)
        });
        col1.style.width = '240px';
        col1.style.minWidth = '240px';
        col1.style.maxWidth = '240px';
        col1.style.height = '100%';
        col1.style.flex = '0 0 240px';
        // col2: dice manipulators (row1), dice rules (row2), and checkboxes (row3)
        const col2 = createBox({
          title: 'Dices & Rules',
          content: (() => {
            const col = document.createElement('div');
            col.style.display = 'flex';
            col.style.flexDirection = 'column';
            col.style.height = '100%';
            col.style.width = '100%';
            col.style.justifyContent = 'stretch';
            col.style.alignItems = 'center';
            // Row 1: dice manipulators
            const row1 = document.createElement('div');
            row1.style.display = 'flex';
            row1.style.flexDirection = 'column';
            row1.style.alignItems = 'center';
            row1.style.justifyContent = 'flex-start';
            row1.style.gap = '8px';
            row1.style.height = '150px';
            row1.style.flex = '0 0 150px';
            
            // Descriptive text above dice
            const descriptionText = document.createElement('div');
            descriptionText.textContent = 'Select dice(s) to roll with.\nThese will be marked with a green border.';
            descriptionText.style.color = '#888888';
            descriptionText.style.fontStyle = 'italic';
            descriptionText.style.fontSize = '11px';
            descriptionText.style.fontFamily = 'Arial, sans-serif';
            descriptionText.style.textAlign = 'center';
            descriptionText.style.lineHeight = '1.3';
            descriptionText.style.padding = '4px 8px';
            descriptionText.style.maxWidth = '200px';
            descriptionText.style.marginTop = '10px';
            row1.appendChild(descriptionText);
            
            // Dice manipulators
            const diceRow = getDiceManipulatorsRow(selectedDice, i => {
              if (selectedDice.includes(i)) {
                selectedDice = selectedDice.filter(x => x !== i); // Remove if already selected
              } else {
                selectedDice = [...selectedDice, i]; // Add if not selected
              }
              render();
              // Update status displays when dice selection changes
              setTimeout(() => {
                updateStatusDisplays();
              }, 0);
            });
            row1.appendChild(diceRow);
            
            col.appendChild(row1);
            
            // Separator 1
            const separator1 = document.createElement('div');
            separator1.className = 'separator my-2.5';
            separator1.setAttribute('role', 'none');
            separator1.style.margin = '0px 0px';
            col.appendChild(separator1);
            
            // Row 2: Dice Rules (checkboxes)
            // --- Add state for the checkboxes and speed ---
            if (typeof render.stopWhenChangingDice === 'undefined') render.stopWhenChangingDice = true;
            if (typeof render.continuouslyChangeDice === 'undefined') render.continuouslyChangeDice = false;
            if (typeof render.autorollSpeed === 'undefined') render.autorollSpeed = 100;
            const row2 = document.createElement('div');
            row2.style.display = 'flex';
            row2.style.flexDirection = 'column';
            row2.style.alignItems = 'flex-start';
            row2.style.justifyContent = 'flex-start';
            row2.style.gap = '4px';
            row2.style.marginTop = '12px';
            // Checkbox 1: Stop when changing dice
            const stopCheckboxWrapper = document.createElement('label');
            stopCheckboxWrapper.style.display = 'flex';
            stopCheckboxWrapper.style.alignItems = 'center';
            stopCheckboxWrapper.style.gap = '6px';
            const stopCheckbox = document.createElement('input');
            stopCheckbox.type = 'checkbox';
            stopCheckbox.checked = !!render.stopWhenChangingDice;
            stopCheckbox.onchange = () => {
              if (!stopCheckbox.checked && !contCheckbox.checked) {
                // Prevent both from being unchecked
                stopCheckbox.checked = true;
                // Visual cue: flash background
                stopCheckboxWrapper.style.background = '#ffcccc';
                setTimeout(() => { stopCheckboxWrapper.style.background = ''; }, 200);
                return;
              }
              if (stopCheckbox.checked) {
                render.stopWhenChangingDice = true;
                render.continuouslyChangeDice = false;
                contCheckbox.checked = false;
              } else {
                render.stopWhenChangingDice = false;
              }
            };
            stopCheckboxWrapper.appendChild(stopCheckbox);
            stopCheckboxWrapper.appendChild(document.createTextNode('Stop when changing dice'));
            row2.appendChild(stopCheckboxWrapper);
            // Checkbox 2: Continuously change dice
            const contCheckboxWrapper = document.createElement('label');
            contCheckboxWrapper.style.display = 'flex';
            contCheckboxWrapper.style.alignItems = 'center';
            contCheckboxWrapper.style.gap = '6px';
            const contCheckbox = document.createElement('input');
            contCheckbox.type = 'checkbox';
            contCheckbox.checked = !!render.continuouslyChangeDice;
            contCheckbox.onchange = () => {
              if (!contCheckbox.checked && !stopCheckbox.checked) {
                // Prevent both from being unchecked
                contCheckbox.checked = true;
                contCheckboxWrapper.style.background = '#ffcccc';
                setTimeout(() => { contCheckboxWrapper.style.background = ''; }, 200);
                return;
              }
              if (contCheckbox.checked) {
                render.continuouslyChangeDice = true;
                render.stopWhenChangingDice = false;
                stopCheckbox.checked = false;
              } else {
                render.continuouslyChangeDice = false;
              }
            };
            contCheckboxWrapper.appendChild(contCheckbox);
            contCheckboxWrapper.appendChild(document.createTextNode('Continuously change dice'));
            row2.appendChild(contCheckboxWrapper);
            
            // Speed control
            const speedWrapper = document.createElement('div');
            speedWrapper.style.display = 'flex';
            speedWrapper.style.alignItems = 'center';
            speedWrapper.style.gap = '6px';
            speedWrapper.style.marginTop = '8px';
            
            const speedLabel = document.createElement('span');
            speedLabel.textContent = 'Autoroll Speed:';
            speedWrapper.appendChild(speedLabel);
            
            const speedInput = document.createElement('input');
            speedInput.type = 'number';
            speedInput.min = '100';
            speedInput.max = '2000';
            speedInput.step = '100';
            speedInput.value = render.autorollSpeed;
            speedInput.style.width = '60px';
            speedInput.style.padding = '2px 4px';
            speedInput.style.fontSize = '12px';
            speedInput.style.fontFamily = 'Arial, sans-serif';
            speedInput.style.fontWeight = 'bold';
            speedInput.style.textAlign = 'left';
            speedInput.style.color = '#000';
            speedInput.onchange = () => {
              render.autorollSpeed = Math.max(100, Math.min(2000, parseInt(speedInput.value) || 100));
              speedInput.value = render.autorollSpeed;
            };
            speedWrapper.appendChild(speedInput);
            
            const speedUnit = document.createElement('span');
            speedUnit.textContent = 'ms';
            speedUnit.style.color = '#fff';
            speedWrapper.appendChild(speedUnit);
            
            row2.appendChild(speedWrapper);
            
            // Add rate-limit warning below speed input
            const rateLimitWarning = document.createElement('div');
            rateLimitWarning.textContent = '30 requests per 10 seconds is the rate-limit. Set 334ms or higher to avoid being rate-limited.';
            rateLimitWarning.style.fontSize = '11px';
            rateLimitWarning.style.fontStyle = 'italic';
            rateLimitWarning.style.color = '#ff9800';
            rateLimitWarning.style.marginTop = '2px';
            rateLimitWarning.style.marginLeft = '2px';
            rateLimitWarning.style.paddingLeft = '12px';
            rateLimitWarning.style.paddingRight = '12px';
            row2.appendChild(rateLimitWarning);
            
            col.appendChild(row2);
            return col;
          })()
        });
        col2.style.width = '220px';
        col2.style.minWidth = '220px';
        col2.style.maxWidth = '220px';
        col2.style.height = '100%';
        col2.style.flex = '0 0 220px';
        // col3: creature details (row1), placeholder (row2)
        const col3 = createBox({
          title: 'Details',
          content: getCreatureDetailsCol(selectedGameId, getSelectedDiceTier, getAvailableStats, render, selectedDice, lastStatusMessage)
        });
        col3.style.width = '205px';
        col3.style.minWidth = '205px';
        col3.style.maxWidth = '205px';
        col3.style.height = '100%';
        col3.style.flex = '0 0 205px';
        // Create a wrapper for the columns without centering to avoid extra spacing
        const columnsWrapper = document.createElement('div');
        columnsWrapper.style.display = 'flex';
        columnsWrapper.style.flexDirection = 'row';
        columnsWrapper.style.justifyContent = 'flex-start';
        columnsWrapper.style.alignItems = 'center';
        columnsWrapper.style.width = '100%';
        columnsWrapper.style.height = '100%';
        columnsWrapper.appendChild(col1);
        columnsWrapper.appendChild(col2);
        columnsWrapper.appendChild(col3);
        contentDiv.appendChild(columnsWrapper);
        // --- Restore scroll position ---
        // Wait for the new scroll area to be in the DOM
        setTimeout(() => {
          const newScrollArea = contentDiv.querySelector('.column-content-wrapper > div[style*="overflow-y: auto"]');
          if (newScrollArea) {
            newScrollArea.scrollTop = oldScrollTop;
          }
        }, 0);
      }
      render();
      api.ui.components.createModal({
        title: 'Auto Dice Roller',
        width: 700,
        height: 400,
        content: contentDiv,
        buttons: [{ text: 'Close', primary: true }]
      });
      setTimeout(() => {
        const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          dialog.style.width = '700px';
          dialog.style.minWidth = '700px';
          dialog.style.maxWidth = '700px';
          dialog.style.height = '400px';
          dialog.style.minHeight = '400px';
          dialog.style.maxHeight = '400px';
          dialog.classList.remove('max-w-[300px]');
          let contentWrapper = null;
          const children = Array.from(dialog.children);
          for (const child of children) {
            if (child !== dialog.firstChild && child.tagName === 'DIV') {
              contentWrapper = child;
              break;
            }
          }
          if (!contentWrapper) {
            contentWrapper = dialog.querySelector(':scope > div');
          }
          if (contentWrapper) {
            contentWrapper.style.height = '100%';
            contentWrapper.style.display = 'flex';
            contentWrapper.style.flexDirection = 'column';
            contentWrapper.style.flex = '1 1 0';
          }
          // Add version display
          // versionDiv.textContent = 'v1.1.1';
          // ... existing code ...
        }
      }, 0);
    }, 50);
  }
// =======================
// 7. Inventory Integration
// =======================
  let inventoryObserver = null;
  
  function cleanup() {
    if (inventoryObserver) {
      try { inventoryObserver.disconnect(); } catch (e) {}
      inventoryObserver = null;
    }
    const autoButtons = document.querySelectorAll('.auto-inventory-button');
    autoButtons.forEach(btn => btn.remove());
    
    // Clear caches and timeouts
    DOMCache.clear();
    if (statusUpdateTimeout) {
      clearTimeout(statusUpdateTimeout);
      statusUpdateTimeout = null;
    }
    
    // Clear any global references
    if (typeof window !== 'undefined') {
      delete window.updateStatusDisplays;
      delete window.resetRollCount;
      delete window.DiceRollerSelectedDice;
      delete window.DiceRollerRender;
    }
  }
  function observeInventory() {
    if (inventoryObserver) {
      try { inventoryObserver.disconnect(); } catch (e) {}
      inventoryObserver = null;
    }
    inventoryObserver = new MutationObserver(() => { addAutoDiceButton(); });
    inventoryObserver.observe(document.body, { childList: true, subtree: true });
    addAutoDiceButton();
  }
  function addAutoDiceButton() {
    // Use DOMCache for inventory container
    const inventoryContainer = DOMCache.get('.container-inventory-4');
    if (!inventoryContainer) return;
    if (inventoryContainer.querySelector('.auto-inventory-button')) return;
    const spriteItems = inventoryContainer.querySelectorAll(`.sprite.item.relative.id-${DICE_CONFIG.DICE_MANIPULATOR_ID}`);
    if (!spriteItems.length) return;
    const lastSprite = spriteItems[spriteItems.length - 1];
    const targetButton = lastSprite.closest('button');
    if (!targetButton) return;
    const autoButton = document.createElement('button');
    autoButton.className = 'focus-style-visible active:opacity-70 auto-inventory-button';
    autoButton.innerHTML = `<div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image"><div class="has-rarity relative grid h-full place-items-center"><div class="sprite item relative id-${DICE_CONFIG.DICE_MANIPULATOR_ID}"><div class="viewport"><img alt="${DICE_CONFIG.DICE_MANIPULATOR_ID}" data-cropped="false" class="spritesheet" style="--cropX: 0; --cropY: 0;"></div></div><div class="revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5"><span class="relative" style="line-height: 1; font-size: 16px; color: #fff; font-family: inherit;" translate="no">Auto</span></div></div></div>`;
    autoButton.addEventListener('click', () => { showAutoDiceModal(); });
    targetButton.insertAdjacentElement('afterend', autoButton);
  }
// =======================
// 8. Cleanup & Exports
// =======================
  if (config.enabled) {
    observeInventory();
  }
  if (typeof exports !== 'undefined') {
    exports.cleanup = cleanup;
  }
  if (typeof window !== 'undefined') {
    window.DiceRoller = window.DiceRoller || {};
    window.DiceRoller.cleanup = cleanup;
  }
  exports = {};
  
  console.log('Dice Roller 2.0 initialization complete');
})(); 