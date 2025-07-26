// =======================
// 0. Version & Metadata
// =======================
(function() {
  
// =======================
// 1. Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  const PERFORMANCE = {
    DOM_CACHE_TIMEOUT: 1000,
    INVENTORY_CACHE_TIMEOUT: 200,
    API_THROTTLE_MIN: 100,
    API_THROTTLE_MAX: 2000,
    RATE_LIMIT_RETRY_DELAY: 2000,
    RATE_LIMIT_MAX_RETRIES: 5,
    ANIMATION_INTERVAL: 400
  };
  
  const SCROLL_CONFIG = {
    SUMMON_SCROLL_API_URL: 'https://bestiaryarena.com/api/trpc/inventory.summonScroll?batch=1',
    FRAME_IMAGE_URL: 'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png',
    SCROLL_RARITIES: {
      GREY: 1,
      GREEN: 2,
      BLUE: 3,
      PURPLE: 4,
      YELLOW: 5
    },
    TIER_COLORS: ['#888888', '#4ade80', '#60a5fa', '#a78bfa', '#fbbf24'],
    TIER_NAMES: ['grey', 'green', 'blue', 'purple', 'yellow'],
    DEFAULT_TIER_TARGETS: [0, 5, 4, 3, 2]
  };
  
  const SUMMON_SCROLL_API_URL = SCROLL_CONFIG.SUMMON_SCROLL_API_URL;
  const FRAME_IMAGE_URL = SCROLL_CONFIG.FRAME_IMAGE_URL;
  
  const ALL_CREATURES = [
    'Amazon', 'Banshee', 'Bear', 'Bog Raider', 'Bug', 'Corym Charlatan', 'Corym Skirmisher', 'Corym Vanguard', 'Cyclops', 'Deer', 'Demon Skeleton', 'Dragon', 'Dragon Lord',
    'Druid', 'Dwarf', 'Dwarf Geomancer', 'Dwarf Guard', 'Dwarf Soldier', 'Elf', 'Elf Arcanist', 'Elf Scout',
    'Fire Devil', 'Fire Elemental', 'Firestarter', 'Frost Troll', 'Ghost', 'Ghoul', 'Giant Spider', 'Goblin', 'Goblin Assassin',
    'Goblin Scavenger', 'Knight', 'Minotaur', 'Minotaur Archer', 'Minotaur Guard', 'Minotaur Mage', 'Monk',
    'Mummy', 'Nightstalker', 'Orc Berserker', 'Orc Leader', 'Orc Rider', 'Orc Shaman', 'Orc Spearman',
    'Orc Warlord', 'Poison Spider', 'Polar Bear', 'Rat', 'Rorc', 'Rotworm', 'Scorpion', 'Sheep', 'Skeleton',
    'Slime', 'Snake', 'Spider', 'Stalker', 'Swamp Troll', 'Tortoise', 'Troll', 'Valkyrie', 'Warlock', 'Wasp', 'Water Elemental',
    'Witch', 'Winter Wolf', 'Wolf', 'Wyvern'
  ];

// =======================
// 2. API Functions
// =======================
  async function summonScroll(rarity) {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    const throttleDelay = Math.max(userDefinedSpeed, PERFORMANCE.API_THROTTLE_MIN);
    if (timeSinceLastCall < throttleDelay) {
      await new Promise(resolve => setTimeout(resolve, throttleDelay - timeSinceLastCall));
    }
    lastApiCall = Date.now();
    
    let response;
    let retryCount = 0;
    let wasRateLimited = false;
    
    while (true) {
      if (!autoscrolling) {
        throw new Error('Autoscroll stopped by user');
      }
      
      try {
        response = await fetch(SUMMON_SCROLL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Game-Version': '1'
          },
          body: JSON.stringify({
            "0": {
              "json": {
                "rarity": rarity
              }
            }
          })
        });
      } catch (err) {
        console.error('[Autoscroller] Fetch error:', err);
        throw err;
      }
      
            if (response.status !== 429) {
        if (wasRateLimited) {
          const { autoscrollBtn } = getAutoscrollButtons();
          if (autoscrollBtn && autoscrolling) {
            if (rateLimitedInterval) {
              clearInterval(rateLimitedInterval);
              rateLimitedInterval = null;
            }
            autoscrollBtn.textContent = 'Autoscrolling...';
          }
   
        }
        break;
      }
      
      retryCount++;
      if (retryCount > PERFORMANCE.RATE_LIMIT_MAX_RETRIES) {
        const { autoscrollBtn } = getAutoscrollButtons();
        if (autoscrollBtn) {
          let dotCount = 1;
          autoscrollBtn.textContent = 'Rate-limited.';
          if (rateLimitedInterval) clearInterval(rateLimitedInterval);
          rateLimitedInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            autoscrollBtn.textContent = 'Rate-limited' + '.'.repeat(dotCount);
          }, PERFORMANCE.ANIMATION_INTERVAL);
        }
        throw new Error('Rate limit reached too many times.');
      }
      
      const waitTime = PERFORMANCE.RATE_LIMIT_RETRY_DELAY;
      
      const { autoscrollBtn } = getAutoscrollButtons();
      if (autoscrollBtn) {
        let dotCount = 1;
        autoscrollBtn.textContent = 'Rate-limited.';
        if (rateLimitedInterval) clearInterval(rateLimitedInterval);
        rateLimitedInterval = setInterval(() => {
          dotCount = (dotCount % 3) + 1;
          autoscrollBtn.textContent = 'Rate-limited' + '.'.repeat(dotCount);
        }, PERFORMANCE.ANIMATION_INTERVAL);
      }
      
      wasRateLimited = true;
      await new Promise(res => setTimeout(res, waitTime));
      lastApiCall = Date.now();
    }
    
    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.error('[Autoscroller] Non-JSON response:', err);
      throw new Error('API returned non-JSON response');
    }
    
    if (!response.ok) {
      console.error('[Autoscroller] API error response:', data);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`);
    }
    
    return data[0]?.result?.data?.json;
  }
  
  function addMonsterToLocalInventory(monsterData) {
    try {
      const player = globalThis.state?.player;
      if (!player) return;
      
      player.send({
        type: "setState",
        fn: (prev) => ({
          ...prev,
          monsters: [...prev.monsters, monsterData]
        }),
      });
    } catch (e) {
      console.warn('[Autoscroller] Failed to update local inventory:', e);
    }
  }
  
  function getMonsterNameFromGameId(gameId) {
    try {
      const utils = globalThis.state?.utils;
      if (!utils || !utils.getMonster) {
        console.warn('[Autoscroller] Monster API not available');
        return null;
      }
      
      const monster = utils.getMonster(gameId);
      return monster?.metadata?.name || null;
    } catch (error) {
      console.error('[Autoscroller] Error getting monster name:', error);
      return null;
    }
  }
  
  function calculateTierFromStats(monster) {
    if (!monster) return 1;
    
    const statSum = (monster.hp || 0) + 
                   (monster.ad || 0) + 
                   (monster.ap || 0) + 
                   (monster.armor || 0) + 
                   (monster.magicResist || 0);
    
    if (statSum >= 80) return 5;
    if (statSum >= 70) return 4;
    if (statSum >= 60) return 3;
    if (statSum >= 50) return 2;
    return 1;
  }
  
  let autoscrollStats = {
    totalScrolls: 0,
    successfulSummons: 0,
    targetCreatures: new Set(),
    foundCreatures: new Map()
  };
  let selectedScrollTier = 1;
  let selectedCreatures = [];
  let autoscrolling = false;
  
  let stopConditions = {
    useTotalCreatures: true,
    totalCreaturesTarget: 15,
    useTierSystem: false,
    tierTargets: [...SCROLL_CONFIG.DEFAULT_TIER_TARGETS]
  };
  
  let lastApiCall = 0;
  let userDefinedSpeed = 100;
  let rateLimitedInterval = null;
  
  function resetAutoscrollState() {
    autoscrollStats = {
      totalScrolls: 0,
      successfulSummons: 0,
      targetCreatures: new Set(),
      foundCreatures: new Map()
    };
    selectedScrollTier = 1;
    selectedCreatures = [];
    autoscrolling = false;
    stopConditions = {
      useTotalCreatures: true,
      totalCreaturesTarget: 15,
      useTierSystem: false,
      tierTargets: [...SCROLL_CONFIG.DEFAULT_TIER_TARGETS]
    };
    lastApiCall = 0;
    userDefinedSpeed = 100;
    if (rateLimitedInterval) {
      clearInterval(rateLimitedInterval);
      rateLimitedInterval = null;
    }
  }
  
  function setUILocked(locked) {
    const creatureItems = document.querySelectorAll('.autoscroller-creature-item');
    creatureItems.forEach(item => {
      if (locked) {
        item.style.opacity = '0.5';
        item.style.cursor = 'not-allowed';
        item.style.pointerEvents = 'none';
      } else {
        item.style.opacity = '1';
        item.style.cursor = 'pointer';
        item.style.pointerEvents = 'auto';
      }
    });
    
    const ruleInputs = document.querySelectorAll('#total-creatures-checkbox, #tier-system-checkbox, #total-creatures-input, .tier-input');
    ruleInputs.forEach(input => {
      if (locked) {
        input.disabled = true;
        input.style.opacity = '0.5';
      } else {
        input.disabled = false;
        input.style.opacity = '1';
      }
    });
    
    const speedInput = document.querySelector('#autoscroll-speed-input');
    if (speedInput) {
      if (locked) {
        speedInput.disabled = true;
        speedInput.style.opacity = '0.5';
      } else {
        speedInput.disabled = false;
        speedInput.style.opacity = '1';
      }
    }
    
    const scrollButtons = document.querySelectorAll('.autoscroller-scroll-button');
    scrollButtons.forEach(btn => {
      if (locked) {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
      } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
      }
    });
  }
  
  function getMonsterIdFromName(creatureName) {
    try {
      const utils = globalThis.state?.utils;
      if (!utils || !utils.getMonster) {
        console.warn('[Autoscroller] Monster API not available');
        return null;
      }
      
      // Search through monster IDs to find matching name
      for (let i = 1; i < 1000; i++) {
        try {
          const monster = utils.getMonster(i);
          if (monster && monster.metadata && monster.metadata.name) {
            if (monster.metadata.name.toLowerCase() === creatureName.toLowerCase()) {
              return i; // Return the monster ID
            }
          }
        } catch (error) {
          continue;
        }
      }
      return null;
    } catch (error) {
      console.error('[Autoscroller] Error getting monster ID:', error);
      return null;
    }
  }
  
  function shouldStopAutoscroll() {
          if (stopConditions.useTotalCreatures) {
        const gameState = globalThis.state?.player?.getSnapshot()?.context;
        const monsters = gameState?.monsters || [];
        
        for (const creatureName of selectedCreatures) {
          const monsterId = getMonsterIdFromName(creatureName);
          if (monsterId) {
            const creatureMonsters = monsters.filter(monster => 
              monster && monster.gameId === monsterId
            );
            const totalForThisCreature = creatureMonsters.length;
            
            if (totalForThisCreature >= stopConditions.totalCreaturesTarget) {
   
              return true;
            }
          }
        }
      }
    
          if (stopConditions.useTierSystem) {
        const gameState = globalThis.state?.player?.getSnapshot()?.context;
        const monsters = gameState?.monsters || [];
        
        function calculateTierFromStats(monster) {
          if (!monster) return 1;
          
          const statSum = (monster.hp || 0) + 
                         (monster.ad || 0) + 
                         (monster.ap || 0) + 
                         (monster.armor || 0) + 
                         (monster.magicResist || 0);
          
          if (statSum >= 80) return 5;
          if (statSum >= 70) return 4;
          if (statSum >= 60) return 3;
          if (statSum >= 50) return 2;
          return 1;
        }
        
        const tierCounts = [0, 0, 0, 0, 0];
        
        for (const creatureName of selectedCreatures) {
          const monsterId = getMonsterIdFromName(creatureName);
          if (monsterId) {
            const creatureMonsters = monsters.filter(monster => 
              monster && monster.gameId === monsterId
            );
            
            creatureMonsters.forEach(monster => {
              const tier = calculateTierFromStats(monster);
              tierCounts[tier - 1]++;
            });
            
            const autoscrollCount = autoscrollStats.foundCreatures.get(creatureName) || 0;
            if (autoscrollCount > 0) {
              tierCounts[selectedScrollTier - 1] += autoscrollCount;
            }
          }
        }
        
        for (let tier = 0; tier < 5; tier++) {
          const tierTarget = stopConditions.tierTargets[tier];
          if (tierTarget > 0 && tierCounts[tier] < tierTarget) {
            return false;
          }
        }
        
 
        return true;
      }
    
    return false;
  }
  
  async function autoscrollLoop() {
    try {
      if (shouldStopAutoscroll()) {
        const statusElement = document.getElementById('autoscroll-status');
        if (statusElement) {
          const tierNames = ['grey', 'green', 'blue', 'purple', 'yellow'];
          const tierName = tierNames[selectedScrollTier - 1] || 'unknown';
          
          // Find which creature reached the target
          const gameState = globalThis.state?.player?.getSnapshot()?.context;
          const monsters = gameState?.monsters || [];
          let reachedCreature = null;
          
          for (const creatureName of selectedCreatures) {
            const monsterId = getMonsterIdFromName(creatureName);
            if (monsterId) {
              const creatureMonsters = monsters.filter(monster => 
                monster && monster.gameId === monsterId
              );
              if (creatureMonsters.length >= stopConditions.totalCreaturesTarget) {
                reachedCreature = creatureName;
                break;
              }
            }
          }
          
          const totalFound = Array.from(autoscrollStats.foundCreatures.values()).reduce((sum, count) => sum + count, 0);
          let message;
          if (reachedCreature && autoscrollStats.totalScrolls === 0) {
            // Target was already reached before any scrolls were rolled
            message = `Target already reached: Found ${stopConditions.totalCreaturesTarget} ${reachedCreature} in inventory.`;
          } else if (reachedCreature) {
            // Target was reached after rolling some scrolls
            message = `Target reached! Found ${stopConditions.totalCreaturesTarget} ${reachedCreature}. Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls.`;
          } else {
            // No target reached
            message = `Target reached! Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls. Found ${totalFound} selected creatures.`;
          }
          statusElement.textContent = message;
        }
        stopAutoscroll();
        return;
      }
      
      const playerContext = globalThis.state.player.getSnapshot().context;
      const inventory = playerContext.inventory || {};
      const scrollKey = `summonScroll${selectedScrollTier}`;
      const availableScrolls = inventory[scrollKey] || 0;
      
      if (availableScrolls <= 0) {
        const statusElement = getAutoscrollStatusElement();
        if (statusElement) {
          statusElement.textContent = 'No scrolls available';
        }
        stopAutoscroll();
        return;
      }
      
      const result = await summonScroll(selectedScrollTier);
      
      autoscrollStats.totalScrolls++;
      
      if (result && result.summonedMonster) {
        autoscrollStats.successfulSummons++;
        
        const monsterName = getMonsterNameFromGameId(result.summonedMonster.gameId);
        
        if (monsterName && autoscrollStats.targetCreatures.has(monsterName)) {
          const currentCount = autoscrollStats.foundCreatures.get(monsterName) || 0;
          autoscrollStats.foundCreatures.set(monsterName, currentCount + 1);
          
          if (window.AutoscrollerRenderSelectedCreatures) {
            window.AutoscrollerRenderSelectedCreatures();
          }
        }
        
        addMonsterToLocalInventory(result.summonedMonster);
      }
      
          const statusElement = getAutoscrollStatusElement();
    if (statusElement) {
      const tierNames = ['grey', 'green', 'blue', 'purple', 'yellow'];
      const totalFound = Array.from(autoscrollStats.foundCreatures.values()).reduce((sum, count) => sum + count, 0);
      
      const gameState = globalThis.state?.player?.getSnapshot()?.context;
      const monsters = gameState?.monsters || [];
      let reachedCreature = null;
      
      for (const creatureName of selectedCreatures) {
        const monsterId = getMonsterIdFromName(creatureName);
        if (monsterId) {
          const creatureMonsters = monsters.filter(monster => 
            monster && monster.gameId === monsterId
          );
          if (creatureMonsters.length >= stopConditions.totalCreaturesTarget) {
            reachedCreature = creatureName;
            break;
          }
        }
      }
      
      const message = reachedCreature 
        ? `Found ${stopConditions.totalCreaturesTarget} ${reachedCreature}! Rolled ${autoscrollStats.totalScrolls} ${tierNames[selectedScrollTier - 1] || 'unknown'} summon scrolls.`
        : `Rolled ${autoscrollStats.totalScrolls} ${tierNames[selectedScrollTier - 1] || 'unknown'} summon scrolls. Found ${totalFound} selected creatures.`;
      statusElement.textContent = message;
    }
      
    } catch (error) {
      console.error('[Autoscroller] Error during autoscroll:', error);
      
      if (error.message.includes('Rate limit reached too many times')) {
        stopAutoscroll();
        return;
      }
      
      if (error.message.includes('Autoscroll stopped by user')) {
        return;
      }
    }
  }
  
  async function startAutoscroll() {
    setUILocked(true);
    
    const statusElement = getAutoscrollStatusElement();
    if (statusElement) {
      statusElement.textContent = 'Starting autoscroll...';
    }
    
    autoscrollStats = {
      totalScrolls: 0,
      successfulSummons: 0,
      targetCreatures: new Set(selectedCreatures),
      foundCreatures: new Map()
    };
    
    selectedCreatures.forEach(creature => {
      autoscrollStats.foundCreatures.set(creature, 0);
    });
    
    while (autoscrolling) {
      await autoscrollLoop();
      
      if (autoscrolling) {
        const delay = Math.max(userDefinedSpeed, PERFORMANCE.API_THROTTLE_MIN);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  function stopAutoscroll() {
    autoscrolling = false;
    
    if (rateLimitedInterval) {
      clearInterval(rateLimitedInterval);
      rateLimitedInterval = null;
    }
    
    setUILocked(false);
    
    const { autoscrollBtn, stopBtn } = getAutoscrollButtons();
    
    if (autoscrollBtn) {
      autoscrollBtn.textContent = 'Autoscroll';
      autoscrollBtn.style.display = 'block';
    }
    
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
    
    const statusElement = document.getElementById('autoscroll-status');
    if (statusElement) {
      const tierNames = ['grey', 'green', 'blue', 'purple', 'yellow'];
      const tierName = tierNames[selectedScrollTier - 1] || 'unknown';
      const totalFound = Array.from(autoscrollStats.foundCreatures.values()).reduce((sum, count) => sum + count, 0);
      
      const gameState = globalThis.state?.player?.getSnapshot()?.context;
      const monsters = gameState?.monsters || [];
      let reachedCreature = null;
      
      for (const creatureName of selectedCreatures) {
        const monsterId = getMonsterIdFromName(creatureName);
        if (monsterId) {
          const creatureMonsters = monsters.filter(monster => 
            monster && monster.gameId === monsterId
          );
          if (creatureMonsters.length >= stopConditions.totalCreaturesTarget) {
            reachedCreature = creatureName;
            break;
          }
        }
      }
      
      let message;
      if (reachedCreature && autoscrollStats.totalScrolls === 0) {
        message = `Target already reached: Found ${stopConditions.totalCreaturesTarget} ${reachedCreature} in inventory.`;
      } else if (reachedCreature) {
        message = `Finished: Found ${stopConditions.totalCreaturesTarget} ${reachedCreature}! Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls.`;
      } else {
        message = `Finished: Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls. Found ${totalFound} selected creatures.`;
      }
      statusElement.textContent = message;
    }
  }
  
  function injectAutoscrollerButtonStyles() {
    if (!document.getElementById('autoscroller-btn-css')) {
      const style = document.createElement('style');
      style.id = 'autoscroller-btn-css';
      style.textContent = `
        .autoscroller-btn {
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
        .autoscroller-btn.pressed,
        .autoscroller-btn:active {
          border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

// =======================
// 2. Utility Functions
// =======================
  const DOMCache = {
    cache: new Map(),
    cacheTimeout: PERFORMANCE.DOM_CACHE_TIMEOUT,

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

    getAll: function(selector, context = document) {
      const key = `all_${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.elements;
      }
      
      const elements = context.querySelectorAll(selector);
      this.cache.set(key, { elements, timestamp: Date.now() });
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
    }
  };

  function getAutoscrollStatusElement() {
    return DOMCache.get('#autoscroll-status');
  }

  function getAutoscrollButtons() {
    return {
      autoscrollBtn: DOMCache.get('.autoscroller-btn'),
      stopBtn: DOMCache.get('.autoscroller-btn + .autoscroller-btn')
    };
  }

  function getInventoryContainer() {
    const selector = '.container-inventory-4';
    const key = `${selector}_doc`;
    const cached = DOMCache.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < PERFORMANCE.INVENTORY_CACHE_TIMEOUT) {
      return cached.element;
    }
    
    const element = document.querySelector(selector);
    DOMCache.cache.set(key, { element, timestamp: Date.now() });
    return element;
  }

  function getSummonScrollButtons() {
    const selector = 'button.focus-style-visible.active\\:opacity-70';
    const key = `all_${selector}_doc`;
    const cached = DOMCache.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < PERFORMANCE.INVENTORY_CACHE_TIMEOUT) {
      return cached.elements;
    }
    
    const elements = document.querySelectorAll(selector);
    DOMCache.cache.set(key, { elements, timestamp: Date.now() });
    return elements;
  }

  function createCreaturesBox({title, items, selectedCreature, onSelectCreature}) {
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
    
    const scrollContainer = document.createElement('div');
    scrollContainer.style.flex = '1 1 0';
    scrollContainer.style.minHeight = '0';
    scrollContainer.style.overflowY = 'auto';
    scrollContainer.style.padding = '4px';
    
    items.forEach(name => {
      const item = document.createElement('div');
      item.textContent = name;
      item.className = 'pixel-font-14 autoscroller-creature-item';
      item.style.color = 'rgb(230, 215, 176)';
      item.style.cursor = 'pointer';
      item.style.padding = '2px 4px';
      item.style.borderRadius = '2px';
      item.style.textAlign = 'left';
      item.style.marginBottom = '1px';
      
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255,255,255,0.08)';
      });
      
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('autoscroller-selected')) {
          item.style.background = 'none';
        }
      });
      
      item.addEventListener('mousedown', () => {
        item.style.background = 'rgba(255,255,255,0.18)';
      });
      
      item.addEventListener('mouseup', () => {
        if (!item.classList.contains('autoscroller-selected')) {
          item.style.background = 'rgba(255,255,255,0.08)';
        }
      });
      
      item.addEventListener('click', () => {
        // Remove previous selection
        document.querySelectorAll('.autoscroller-selected').forEach(el => {
          el.classList.remove('autoscroller-selected');
          el.style.background = 'none';
          el.style.color = 'rgb(230, 215, 176)';
        });
        
        // Select this item
        item.classList.add('autoscroller-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = 'rgb(255, 224, 102)';
        
        if (onSelectCreature) {
          onSelectCreature(name);
        }
      });
      
      // Set initial selection if this is the selected creature
      if (selectedCreature === name) {
        item.classList.add('autoscroller-selected');
        item.style.background = 'rgba(255,255,255,0.18)';
        item.style.color = 'rgb(255, 224, 102)';
      }
      
      scrollContainer.appendChild(item);
    });
    
    box.appendChild(scrollContainer);
    return box;
  }
  
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
    contentWrapper.style.alignItems = 'stretch';
    contentWrapper.style.justifyContent = 'flex-start';
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
// 3. Modal Functions
// =======================
  function showAutoscrollerModal() {
    injectAutoscrollerButtonStyles();
    
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    setTimeout(() => {
      let selectedGameId = null;
      let lastStatusMessage = '';
      const contentDiv = document.createElement('div');
      contentDiv.style.width = '100%';
      contentDiv.style.height = '100%';
      contentDiv.style.minWidth = '750px';
      contentDiv.style.maxWidth = '750px';
      contentDiv.style.minHeight = '400px';
      contentDiv.style.maxHeight = '400px';
      contentDiv.style.boxSizing = 'border-box';
      contentDiv.style.overflow = 'hidden';
      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'row';
      contentDiv.style.gap = '8px';
      contentDiv.style.flex = '1 1 0';
      
      let availableCreatures = [...ALL_CREATURES];
      
      resetAutoscrollState();
      
      function render(statusMessage) {
        if (typeof statusMessage === 'string') {
          lastStatusMessage = statusMessage;
        }
        
        contentDiv.innerHTML = '';
        
        const col1 = document.createElement('div');
        col1.style.width = '170px';
        col1.style.minWidth = '170px';
        col1.style.maxWidth = '170px';
        col1.style.height = '100%';
        col1.style.flex = '0 0 170px';
        col1.style.display = 'flex';
        col1.style.flexDirection = 'column';
        col1.style.gap = '8px';
        
        const creaturesBox = createCreaturesBox({
          title: 'Available Creatures',
          items: availableCreatures,
          selectedCreature: selectedGameId,
          onSelectCreature: (creatureName) => {
            // Move creature from available to selected
            availableCreatures = availableCreatures.filter(c => c !== creatureName);
            selectedCreatures.push(creatureName); // Use global variable
            selectedGameId = null;
            render();
            // Update selected creatures display
            if (window.AutoscrollerRenderSelectedCreatures) {
              window.AutoscrollerRenderSelectedCreatures();
            }
          }
        });
        creaturesBox.style.flex = '1 1 0';
        creaturesBox.style.minHeight = '0';
        
        const selectedBox = createCreaturesBox({
          title: 'Selected Creatures',
          items: selectedCreatures,
          selectedCreature: null,
          onSelectCreature: (creatureName) => {
            // Move creature from selected back to available
            selectedCreatures = selectedCreatures.filter(c => c !== creatureName); // Use global variable
            availableCreatures.push(creatureName);
            render();
            // Update selected creatures display
            if (window.AutoscrollerRenderSelectedCreatures) {
              window.AutoscrollerRenderSelectedCreatures();
            }
          }
        });
        selectedBox.style.flex = '1 1 0';
        selectedBox.style.minHeight = '0';
        
        col1.appendChild(creaturesBox);
        col1.appendChild(selectedBox);
        
        const col2 = createBox({
          title: 'Rules',
          content: getRulesColumn()
        });
        col2.style.width = '250px';
        col2.style.minWidth = '250px';
        col2.style.maxWidth = '250px';
        col2.style.height = '100%';
        col2.style.flex = '0 0 250px';
        
        const col3 = createBox({
          title: 'Autoscrolling',
          content: getAutoscrollingColumn()
        });
        col3.style.width = '280px';
        col3.style.minWidth = '280px';
        col3.style.maxWidth = '280px';
        col3.style.height = '100%';
        col3.style.flex = '0 0 280px';
        
        contentDiv.appendChild(col1);
        contentDiv.appendChild(col2);
        contentDiv.appendChild(col3);
      }
      
      function getRulesColumn() {
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '12px';
        
        const totalOptionDiv = document.createElement('div');
        totalOptionDiv.style.display = 'flex';
        totalOptionDiv.style.flexDirection = 'column';
        totalOptionDiv.style.gap = '4px';
        totalOptionDiv.style.fontSize = '14px';
        
        const totalCheckboxRow = document.createElement('div');
        totalCheckboxRow.style.display = 'flex';
        totalCheckboxRow.style.alignItems = 'center';
        totalCheckboxRow.style.gap = '8px';
        
        const totalCheckbox = document.createElement('input');
        totalCheckbox.type = 'checkbox';
        totalCheckbox.id = 'total-creatures-checkbox';
        totalCheckbox.checked = stopConditions.useTotalCreatures !== false; // Preserve state, default to true
        totalCheckbox.style.width = '16px';
        totalCheckbox.style.height = '16px';
        totalCheckbox.style.margin = '0';
        
        const totalLabel = document.createElement('label');
        totalLabel.htmlFor = 'total-creatures-checkbox';
        totalLabel.textContent = 'Collect a total of';
        totalLabel.style.color = 'rgb(230, 215, 176)';
        totalLabel.style.cursor = 'pointer';
        
        totalCheckboxRow.appendChild(totalCheckbox);
        totalCheckboxRow.appendChild(totalLabel);
        totalOptionDiv.appendChild(totalCheckboxRow);
        
        const totalInputRow = document.createElement('div');
        totalInputRow.style.display = 'flex';
        totalInputRow.style.alignItems = 'center';
        totalInputRow.style.gap = '8px';
        totalInputRow.style.marginLeft = '24px';
        
        const totalInput = document.createElement('input');
        totalInput.type = 'number';
        totalInput.id = 'total-creatures-input';
        totalInput.min = '1';
        totalInput.value = stopConditions.totalCreaturesTarget || '15';
        totalInput.style.width = '50px';
        totalInput.style.height = '24px';
        totalInput.style.padding = '2px 4px';
        totalInput.style.border = '1px solid #444';
        totalInput.style.borderRadius = '2px';
        totalInput.style.background = '#2a2a2a';
        totalInput.style.color = 'rgb(230, 215, 176)';
        totalInput.style.fontSize = '12px';
        totalInput.style.textAlign = 'center';
        totalInput.disabled = !stopConditions.useTotalCreatures;
        
        const totalCreaturesText = document.createElement('span');
        totalCreaturesText.textContent = 'creatures';
        totalCreaturesText.style.color = 'rgb(230, 215, 176)';
        
        totalInputRow.appendChild(totalInput);
        totalInputRow.appendChild(totalCreaturesText);
        totalOptionDiv.appendChild(totalInputRow);
        div.appendChild(totalOptionDiv);
        
        const separator = document.createElement('div');
        separator.style.height = '1px';
        separator.style.background = '#444';
        separator.style.margin = '4px 0';
        div.appendChild(separator);
        
        const tierOptionDiv = document.createElement('div');
        tierOptionDiv.style.display = 'flex';
        tierOptionDiv.style.alignItems = 'center';
        tierOptionDiv.style.gap = '8px';
        tierOptionDiv.style.fontSize = '14px';
        
        const tierCheckbox = document.createElement('input');
        tierCheckbox.type = 'checkbox';
        tierCheckbox.id = 'tier-system-checkbox';
        tierCheckbox.checked = stopConditions.useTierSystem === true; // Preserve state, default to false
        tierCheckbox.style.width = '16px';
        tierCheckbox.style.height = '16px';
        tierCheckbox.style.margin = '0';
        
        const tierLabel = document.createElement('label');
        tierLabel.htmlFor = 'tier-system-checkbox';
        tierLabel.textContent = 'Collect by tier:';
        tierLabel.style.color = 'rgb(230, 215, 176)';
        tierLabel.style.cursor = 'pointer';
        
        tierOptionDiv.appendChild(tierCheckbox);
        tierOptionDiv.appendChild(tierLabel);
        div.appendChild(tierOptionDiv);
        
        const tierInputsContainer = document.createElement('div');
        tierInputsContainer.style.marginLeft = '24px';
        tierInputsContainer.style.display = 'flex';
        tierInputsContainer.style.flexDirection = 'column';
        tierInputsContainer.style.gap = '6px';
        
        const rarities = [
          { name: 'grey', color: '#888888' },
          { name: 'green', color: '#4ade80' },
          { name: 'blue', color: '#60a5fa' },
          { name: 'purple', color: '#a78bfa' },
          { name: 'yellow', color: '#fbbf24' }
        ];
        
        const tierInputs = [];
        
        rarities.forEach((rarity, index) => {
          const ruleDiv = document.createElement('div');
          ruleDiv.style.display = 'flex';
          ruleDiv.style.alignItems = 'center';
          ruleDiv.style.gap = '8px';
          ruleDiv.style.fontSize = '12px';
          
          const input = document.createElement('input');
          input.type = 'number';
          input.className = 'tier-input';
          input.min = '0';
          const defaultValues = [0, 5, 4, 3, 2];
          input.value = stopConditions.tierTargets[index] || defaultValues[index];
          input.style.width = '40px';
          input.style.height = '20px';
          input.style.padding = '2px 4px';
          input.style.border = '1px solid #444';
          input.style.borderRadius = '2px';
          input.style.background = '#2a2a2a';
          input.style.color = 'rgb(230, 215, 176)';
          input.style.fontSize = '11px';
          input.style.textAlign = 'center';
          
          const creatureText = document.createElement('span');
          creatureText.textContent = `${rarity.name} creatures.`;
          creatureText.style.color = rarity.color;
          creatureText.style.fontWeight = 'bold';
          
          ruleDiv.appendChild(input);
          ruleDiv.appendChild(creatureText);
          tierInputsContainer.appendChild(ruleDiv);
          tierInputs.push(input);
        });
        
        div.appendChild(tierInputsContainer);
        
        totalCheckbox.addEventListener('change', () => {
          if (totalCheckbox.checked) {
            tierCheckbox.checked = false;
            totalInput.disabled = false;
            tierInputs.forEach(input => input.disabled = true);
            // Update stop conditions
            stopConditions.useTotalCreatures = true;
            stopConditions.useTierSystem = false;
          } else {
            // Prevent unchecking if the other checkbox is also unchecked
            if (!tierCheckbox.checked) {
              totalCheckbox.checked = true;
              return;
            }
            totalInput.disabled = true;
          }
        });
        
        tierCheckbox.addEventListener('change', () => {
          if (tierCheckbox.checked) {
            totalCheckbox.checked = false;
            totalInput.disabled = true;
            tierInputs.forEach(input => input.disabled = false);
            stopConditions.useTotalCreatures = false;
            stopConditions.useTierSystem = true;
          } else {
            if (!totalCheckbox.checked) {
              tierCheckbox.checked = true;
              return;
            }
            tierInputs.forEach(input => input.disabled = true);
          }
        });
        
        totalInput.addEventListener('change', () => {
          stopConditions.totalCreaturesTarget = parseInt(totalInput.value) || 15;
          if (window.AutoscrollerRenderSelectedCreatures) {
            window.AutoscrollerRenderSelectedCreatures();
          }
        });
        
        tierInputs.forEach((input, index) => {
          input.addEventListener('change', () => {
            stopConditions.tierTargets[index] = parseInt(input.value) || 0;
            if (window.AutoscrollerRenderSelectedCreatures) {
              window.AutoscrollerRenderSelectedCreatures();
            }
          });
        });
        
        tierInputs.forEach(input => input.disabled = !stopConditions.useTierSystem);
        
        const speedWrapper = document.createElement('div');
        speedWrapper.style.display = 'flex';
        speedWrapper.style.alignItems = 'center';
        speedWrapper.style.gap = '6px';
        speedWrapper.style.marginTop = '12px';
        
        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Autoscroll Speed:';
        speedLabel.style.color = 'rgb(230, 215, 176)';
        speedLabel.style.fontSize = '14px';
        speedWrapper.appendChild(speedLabel);
        
        const speedInput = document.createElement('input');
        speedInput.type = 'number';
        speedInput.id = 'autoscroll-speed-input';
        speedInput.min = '100';
        speedInput.max = '2000';
        speedInput.step = '100';
        speedInput.value = userDefinedSpeed;
        speedInput.style.width = '60px';
        speedInput.style.padding = '2px 4px';
        speedInput.style.fontSize = '12px';
        speedInput.style.fontFamily = 'Arial, sans-serif';
        speedInput.style.fontWeight = 'bold';
        speedInput.style.textAlign = 'left';
        speedInput.style.color = '#000';
        speedInput.style.border = '1px solid #444';
        speedInput.style.borderRadius = '2px';
        speedInput.style.background = '#2a2a2a';
        speedInput.oninput = () => {
          userDefinedSpeed = Math.max(100, Math.min(2000, parseInt(speedInput.value) || 100));
          speedInput.value = userDefinedSpeed;
        };
        
        speedInput.onchange = () => {
          userDefinedSpeed = Math.max(100, Math.min(2000, parseInt(speedInput.value) || 100));
          speedInput.value = userDefinedSpeed;
        };
        speedWrapper.appendChild(speedInput);
        
        const speedUnit = document.createElement('span');
        speedUnit.textContent = 'ms';
        speedUnit.style.color = 'rgb(230, 215, 176)';
        speedUnit.style.fontSize = '14px';
        speedWrapper.appendChild(speedUnit);
        
        div.appendChild(speedWrapper);
        
        const rateLimitWarning = document.createElement('div');
        rateLimitWarning.textContent = '30 requests per 10 seconds is the rate-limit. Set 334ms or higher to avoid being rate-limited.';
        rateLimitWarning.style.fontSize = '11px';
        rateLimitWarning.style.fontStyle = 'italic';
        rateLimitWarning.style.color = '#ff9800';
        rateLimitWarning.style.marginTop = '2px';
        rateLimitWarning.style.marginLeft = '2px';
        rateLimitWarning.style.paddingLeft = '12px';
        rateLimitWarning.style.paddingRight = '12px';
        div.appendChild(rateLimitWarning);
        
        return div;
      }
      
      function getAutoscrollingColumn() {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.height = '100%';
        div.style.gap = '0';
        
        const summonScrollsRow = getSummonScrollManipulatorsRow();
        summonScrollsRow.style.flex = '0 0 15%';
        summonScrollsRow.style.minHeight = '0';
        
        const separator1 = document.createElement('div');
        separator1.className = 'separator my-2.5';
        separator1.setAttribute('role', 'none');
        separator1.style.margin = '6px 0px';
        
        const controlsRow = document.createElement('div');
        controlsRow.style.flex = '0 0 40%';
        controlsRow.style.minHeight = '0';
        controlsRow.style.display = 'flex';
        controlsRow.style.flexDirection = 'column';
        controlsRow.style.padding = '8px';
        controlsRow.style.overflow = 'hidden';
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Selected Creatures';
        title.style.margin = '0 0 8px 0';
        title.style.padding = '0';
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.color = 'rgb(255, 255, 255)';
        title.style.textAlign = 'center';
        controlsRow.appendChild(title);
        
        const gridContainer = document.createElement('div');
        gridContainer.style.flex = '1 1 0';
        gridContainer.style.minHeight = '0';
        gridContainer.style.overflowY = 'auto';
        gridContainer.style.padding = '4px 0';
        gridContainer.style.width = '100%';
        gridContainer.style.maxWidth = '100%';
        
        function renderSelectedCreatures() {
          gridContainer.innerHTML = '';
          
          if (selectedCreatures.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No creatures selected';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = '#888888';
            emptyMsg.style.fontStyle = 'italic';
            emptyMsg.style.padding = '20px 0';
            gridContainer.appendChild(emptyMsg);
            return;
          }
          

          
          selectedCreatures.forEach(creatureName => {
            const creatureRow = document.createElement('div');
            creatureRow.style.display = 'grid';
            creatureRow.style.gridTemplateColumns = '16px 30px 1fr 20px 20px 20px 20px 20px';
            creatureRow.style.gap = '1px';
            creatureRow.style.padding = '2px 4px';
            creatureRow.style.alignItems = 'center';
            creatureRow.style.borderRadius = '1px';
            creatureRow.style.background = 'rgba(255,255,255,0.02)';
            creatureRow.style.marginBottom = '1px';
            creatureRow.style.width = '100%';
            creatureRow.style.maxWidth = '100%';
            
            const gameState = globalThis.state?.player?.getSnapshot()?.context;
            const monsters = gameState?.monsters || [];
            
            function calculateTierFromStats(monster) {
              if (!monster) return 1;
              
              const statSum = (monster.hp || 0) + 
                            (monster.ad || 0) + 
                            (monster.ap || 0) + 
                            (monster.armor || 0) + 
                            (monster.magicResist || 0);
              
              if (statSum >= 80) return 5;
              if (statSum >= 70) return 4;
              if (statSum >= 60) return 3;
              if (statSum >= 50) return 2;
              return 1;
            }
            
            const monsterId = getMonsterIdFromName(creatureName);
            
            const creatureMonsters = monsters.filter(monster => 
              monster && monster.gameId === monsterId
            );
            
            const totalCount = creatureMonsters.length + (autoscrollStats.foundCreatures.get(creatureName) || 0);
            
            const tierCounts = [0, 0, 0, 0, 0];
            creatureMonsters.forEach(monster => {
              const tier = calculateTierFromStats(monster);
              tierCounts[tier - 1]++;
            });
            
            const autoscrollCount = autoscrollStats.foundCreatures.get(creatureName) || 0;
            if (autoscrollCount > 0) {
              tierCounts[selectedScrollTier - 1] += autoscrollCount;
            }
            
            let targetReached = false;
            
            if (stopConditions.useTotalCreatures) {
              targetReached = totalCount >= stopConditions.totalCreaturesTarget;
            } else if (stopConditions.useTierSystem) {
              let allTierTargetsMet = true;
              for (let tier = 0; tier < 5; tier++) {
                const tierTarget = stopConditions.tierTargets[tier];
                if (tierTarget > 0 && tierCounts[tier] < tierTarget) {
                  allTierTargetsMet = false;
                  break;
                }
              }
              targetReached = allTierTargetsMet;
            }
            
            const markerCell = document.createElement('div');
            markerCell.style.display = 'flex';
            markerCell.style.justifyContent = 'center';
            markerCell.style.alignItems = 'center';
            markerCell.style.width = '16px';
            markerCell.style.height = '14px';
            
            if (targetReached) {
              markerCell.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style="vertical-align:middle;display:inline-block;">
                  <path d="M4 9.5L8 13L14 6" stroke="#28c76f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
              markerCell.title = 'Target reached!';
            } else {
              markerCell.innerHTML = '';
              markerCell.title = '';
            }
            creatureRow.appendChild(markerCell);
            
            const totalCell = document.createElement('div');
            totalCell.textContent = totalCount;
            totalCell.style.color = 'rgb(255, 255, 255)';
            totalCell.style.fontWeight = 'bold';
            totalCell.style.fontSize = '10px';
            totalCell.style.fontFamily = 'Arial, sans-serif';
            totalCell.style.textAlign = 'center';
            creatureRow.appendChild(totalCell);
            
            const nameCell = document.createElement('div');
            nameCell.textContent = creatureName;
            nameCell.style.color = 'rgb(230, 215, 176)';
            nameCell.style.fontWeight = 'bold';
            nameCell.style.fontSize = '10px';
            nameCell.style.fontFamily = 'Arial, sans-serif';
            nameCell.style.textAlign = 'left';
            nameCell.style.overflow = 'hidden';
            nameCell.style.textOverflow = 'ellipsis';
            nameCell.style.whiteSpace = 'nowrap';
            creatureRow.appendChild(nameCell);
            
            const tierColors = ['#888888', '#4ade80', '#60a5fa', '#a78bfa', '#fbbf24'];
            tierCounts.forEach((count, index) => {
              const countCell = document.createElement('div');
              countCell.textContent = count;
              countCell.style.color = tierColors[index];
              countCell.style.fontWeight = 'bold';
              countCell.style.fontSize = '9px';
              countCell.style.fontFamily = 'Arial, sans-serif';
              countCell.style.textAlign = 'center';
              creatureRow.appendChild(countCell);
            });
            
            gridContainer.appendChild(creatureRow);
          });
                  }
          
          renderSelectedCreatures();
          
          window.AutoscrollerRenderSelectedCreatures = renderSelectedCreatures;
        
        controlsRow.appendChild(gridContainer);
        
        const separator2 = document.createElement('div');
        separator2.className = 'separator my-2.5';
        separator2.setAttribute('role', 'none');
        separator2.style.margin = '6px 0px';
        
        const statusRow = document.createElement('div');
        statusRow.style.flex = '0 0 20%';
        statusRow.style.minHeight = '0';
        statusRow.style.display = 'flex';
        statusRow.style.alignItems = 'center';
        statusRow.style.justifyContent = 'center';
        statusRow.style.padding = '4px';
        statusRow.style.fontSize = '12px';
        statusRow.style.color = 'rgb(230, 215, 176)';
        statusRow.style.textAlign = 'center';
        
        // Status text
        const statusText = document.createElement('div');
        statusText.textContent = 'Ready to autoscroll';
        statusText.id = 'autoscroll-status';
        statusRow.appendChild(statusText);
        
        const buttonRow = document.createElement('div');
        buttonRow.style.flex = '0 0 15%';
        buttonRow.style.minHeight = '0';
        buttonRow.style.display = 'flex';
        buttonRow.style.alignItems = 'center';
        buttonRow.style.justifyContent = 'center';
        buttonRow.style.padding = '10px';
        
        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.display = 'flex';
        buttonWrapper.style.flexDirection = 'row';
        buttonWrapper.style.gap = '8px';
        buttonWrapper.style.alignItems = 'center';
        
        const autoscrollBtn = document.createElement('button');
        autoscrollBtn.textContent = 'Autoscroll';
        autoscrollBtn.className = 'autoscroller-btn';
        autoscrollBtn.style.width = '120px';
        autoscrollBtn.style.padding = '6px 28px';
        autoscrollBtn.style.margin = '0 4px';
        autoscrollBtn.style.boxSizing = 'border-box';
        autoscrollBtn.style.setProperty('font-size', '12px', 'important');
        buttonWrapper.appendChild(autoscrollBtn);
        
        const stopBtn = document.createElement('button');
        stopBtn.textContent = 'Stop';
        stopBtn.className = 'autoscroller-btn';
        stopBtn.style.setProperty('width', '60px', 'important');
        stopBtn.style.setProperty('min-width', '60px', 'important');
        stopBtn.style.setProperty('max-width', '60px', 'important');
        stopBtn.style.padding = '6px 12px';
        stopBtn.style.margin = '0 4px';
        stopBtn.style.boxSizing = 'border-box';
        stopBtn.style.setProperty('font-size', '12px', 'important');
        stopBtn.style.display = 'none'; // Hidden initially
        buttonWrapper.appendChild(stopBtn);
        
        autoscrollBtn.onclick = async () => {
          if (!autoscrolling) {
            // Start autoscroll
            if (selectedCreatures.length === 0) {
              const originalText = autoscrollBtn.textContent;
              autoscrollBtn.textContent = 'Select creatures first';
              setTimeout(() => {
                autoscrollBtn.textContent = originalText;
              }, 2000);
              return;
            }
            
            const playerContext = globalThis.state.player.getSnapshot().context;
            const inventory = playerContext.inventory || {};
            const scrollKey = `summonScroll${selectedScrollTier}`;
            const availableScrolls = inventory[scrollKey] || 0;
            
            if (availableScrolls <= 0) {
              const originalText = autoscrollBtn.textContent;
              autoscrollBtn.textContent = 'No scrolls available';
              setTimeout(() => {
                autoscrollBtn.textContent = originalText;
              }, 2000);
              return;
            }
            
            if (stopConditions.useTotalCreatures) {
              if (stopConditions.totalCreaturesTarget <= 0) {
                const originalText = autoscrollBtn.textContent;
                autoscrollBtn.textContent = 'Set target > 0';
                setTimeout(() => {
                  autoscrollBtn.textContent = originalText;
                }, 2000);
                return;
              }
            } else if (stopConditions.useTierSystem) {
              const hasValidTarget = stopConditions.tierTargets.some(target => target > 0);
              if (!hasValidTarget) {
                const originalText = autoscrollBtn.textContent;
                autoscrollBtn.textContent = 'Set tier targets';
                setTimeout(() => {
                  autoscrollBtn.textContent = originalText;
                }, 2000);
                return;
              }
            } else {
              const originalText = autoscrollBtn.textContent;
              autoscrollBtn.textContent = 'Select stopping rule';
              setTimeout(() => {
                autoscrollBtn.textContent = originalText;
              }, 2000);
              return;
            }
            
            autoscrolling = true;
            autoscrollBtn.textContent = 'Autoscrolling...';
            stopBtn.style.display = 'block';
            autoscrollBtn.style.display = 'none';
            
            startAutoscroll();
          }
        };
        
        stopBtn.onclick = () => {
          if (autoscrolling) {
            if (rateLimitedInterval) {
              clearInterval(rateLimitedInterval);
              rateLimitedInterval = null;
            }
            stopAutoscroll();
          }
        };
        
        buttonRow.appendChild(buttonWrapper);
        
        div.appendChild(summonScrollsRow);
        div.appendChild(separator1);
        div.appendChild(controlsRow);
        div.appendChild(separator2);
        div.appendChild(statusRow);
        div.appendChild(buttonRow);
        return div;
      }
      
      function getSummonScrollManipulatorsRow() {
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
        
        for (let i = 1; i <= 5; i++) {
          const key = `summonScroll${i}`;
          const count = inventory[key] || 0;
          
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.alignItems = 'center';
          wrapper.style.justifyContent = 'flex-start';
          
          const btn = document.createElement('button');
          btn.className = 'focus-style-visible active:opacity-70 autoscroller-scroll-button';
          btn.setAttribute('data-state', i === 1 ? 'selected' : 'closed'); // Default to tier 1 selected
          btn.style.background = 'none';
          btn.style.border = 'none';
          btn.style.padding = '0';
          btn.style.margin = '0';
          btn.style.cursor = 'pointer';
          btn.onclick = () => {
            const currentState = btn.getAttribute('data-state');
            
            if (currentState === 'selected') {
              return;
            }
            
            const allButtons = row.querySelectorAll('button');
            allButtons.forEach(otherBtn => {
              otherBtn.setAttribute('data-state', 'closed');
              const otherSlot = otherBtn.querySelector('.container-slot');
              if (otherSlot) {
                otherSlot.style.boxShadow = 'none';
              }
            });
            
            btn.setAttribute('data-state', 'selected');
            selectedScrollTier = i;
            
            const slot = btn.querySelector('.container-slot');
            if (slot) {
              slot.style.boxShadow = '0 0 0 2px #00ff00';
              slot.style.borderRadius = '0';
            }
          };
          
          // Container slot
          const slot = document.createElement('div');
          slot.setAttribute('data-hoverable', 'true');
          slot.setAttribute('data-highlighted', 'false');
          slot.setAttribute('data-disabled', 'false');
          slot.className = "container-slot surface-darker data-[disabled='true']:dithered data-[highlighted='true']:unset-border-image data-[hoverable='true']:hover:unset-border-image";
          slot.style.overflow = 'visible';
          
          // Rarity border
          const rarityDiv = document.createElement('div');
          rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
          rarityDiv.setAttribute('data-rarity', String(i)); // 1-5 for rarity
          
          // Summon scroll image
          const img = document.createElement('img');
          img.alt = `summon scroll ${i}`;
          img.className = 'pixelated';
          img.width = '32';
          img.height = '32';
          img.src = `https://bestiaryarena.com/assets/icons/summonscroll${i}.png`;
          
          rarityDiv.appendChild(img);
          slot.appendChild(rarityDiv);
          btn.appendChild(slot);
          
          if (i === 1) {
            slot.style.boxShadow = '0 0 0 2px #00ff00';
            slot.style.borderRadius = '0';
          }
          
          wrapper.appendChild(btn);
          
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
          
          row.appendChild(wrapper);
        }
        return row;
      }
      
      render();
      
      api.ui.components.createModal({
        title: 'Auto Scroller',
        width: 750,
        height: 400,
        content: contentDiv,
        buttons: [{ text: 'Close', primary: true }],
        onClose: () => {
          if (autoscrolling) {
            stopAutoscroll();
          }
          resetAutoscrollState();
        }
      });
      setTimeout(() => {
        const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          dialog.style.width = '750px';
          dialog.style.minWidth = '750px';
          dialog.style.maxWidth = '750px';
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
        }
      }, 0);
    }, 50);
  }

// =======================
// 4. Inventory Integration
// =======================
  let inventoryObserver = null;
  let buttonCheckInterval = null;
  let lastButtonCheck = 0;
  let failedAttempts = 0;
  let hasLoggedInventoryNotFound = false;
  const BUTTON_CHECK_INTERVAL = 1000;
  const BUTTON_CHECK_TIMEOUT = 10000;
  const LOG_AFTER_ATTEMPTS = 3;
  
  function observeInventory() {
    if (inventoryObserver) {
      try { inventoryObserver.disconnect(); } catch (e) {}
      inventoryObserver = null;
    }
    
    if (buttonCheckInterval) {
      clearInterval(buttonCheckInterval);
      buttonCheckInterval = null;
    }
    
    lastButtonCheck = Date.now();
    buttonCheckInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastButtonCheck > BUTTON_CHECK_TIMEOUT) {
        clearInterval(buttonCheckInterval);
        buttonCheckInterval = null;
        return;
      }
      
      DOMCache.clearSelector('.container-inventory-4');
      DOMCache.clearSelector('button.focus-style-visible');
      
      addAutoscrollerButton();
    }, BUTTON_CHECK_INTERVAL);
    
    inventoryObserver = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('container-inventory-4') ||
                node.querySelector?.('.container-inventory-4') ||
                node.querySelector?.('button.focus-style-visible')) {
              shouldCheck = true;
              break;
            }
          }
        }
        
        if (shouldCheck) break;
      }
      
      if (shouldCheck) {
        DOMCache.clearSelector('.container-inventory-4');
        DOMCache.clearSelector('button.focus-style-visible');
        addAutoscrollerButton();
      }
    });
    
    inventoryObserver.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    addAutoscrollerButton();
  }
  
  function addAutoscrollerButton() {
    if (document.querySelector('.autoscroller-inventory-button')) {
      failedAttempts = 0;
      hasLoggedInventoryNotFound = false;
      return;
    }
    
    // Check if we're on the inventory page
    const isOnInventoryPage = document.querySelector('.container-inventory-4') || 
                             document.querySelector('[data-page="inventory"]') ||
                             window.location.pathname.includes('inventory');
    
    if (!isOnInventoryPage) {
      return; // Don't try to add button if not on inventory page
    }
    
    let inventoryContainer = getInventoryContainer();
    if (!inventoryContainer) {
      inventoryContainer = document.querySelector('.container-inventory-4');
    }
    
    if (!inventoryContainer) {
      failedAttempts++;
      if (failedAttempts >= LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
        console.log('[Autoscroller] Inventory container not found, will retry...');
        hasLoggedInventoryNotFound = true;
      }
      return;
    }
    
    let summonScrollButtons = getSummonScrollButtons();
    if (!summonScrollButtons || summonScrollButtons.length === 0) {
      summonScrollButtons = inventoryContainer.querySelectorAll('button.focus-style-visible.active\\:opacity-70');
    }
    
    if (!summonScrollButtons || summonScrollButtons.length === 0) {
      failedAttempts++;
      if (failedAttempts >= LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
        console.log('[Autoscroller] Summon scroll buttons not found, will retry...');
        hasLoggedInventoryNotFound = true;
      }
      return;
    }
    
    let targetButton = null;
    
    for (const button of summonScrollButtons) {
      const img = button.querySelector('img[alt*="summon scroll"]');
      if (img && img.src && img.src.includes('summonscroll5.png')) {
        targetButton = button;
        break;
      }
    }
    
    if (!targetButton) {
      for (const button of summonScrollButtons) {
        const img = button.querySelector('img[alt*="summon scroll"]');
        if (img && img.src && img.src.includes('summonscroll')) {
          targetButton = button;
          break;
        }
      }
    }
    
    if (!targetButton && summonScrollButtons.length > 0) {
      const lastButton = summonScrollButtons[summonScrollButtons.length - 1];
      const img = lastButton.querySelector('img[alt*="summon scroll"]');
      if (img && img.src && img.src.includes('summonscroll')) {
        targetButton = lastButton;
      }
    }
    
    if (!targetButton) {
      failedAttempts++;
      if (failedAttempts >= LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
        console.log('[Autoscroller] Target button not found, will retry...');
        hasLoggedInventoryNotFound = true;
      }
      return;
    }
    
    const autoButton = document.createElement('button');
    autoButton.className = 'focus-style-visible active:opacity-70 autoscroller-inventory-button';
    autoButton.innerHTML = `<div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image"><div class="has-rarity relative grid h-full place-items-center"><img alt="summon scroll" class="pixelated" width="32" height="32" src="https://bestiaryarena.com/assets/icons/summonscroll5.png"><div class="revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5"><span class="relative" style="line-height: 1; font-size: 16px; color: #fff; font-family: inherit;" translate="no">Auto</span></div></div></div>`;
        autoButton.addEventListener('click', () => { showAutoscrollerModal(); });
    
    try {
      targetButton.insertAdjacentElement('afterend', autoButton);
      failedAttempts = 0;
      hasLoggedInventoryNotFound = false;
      
      if (buttonCheckInterval) {
        clearInterval(buttonCheckInterval);
        buttonCheckInterval = null;
      }
    } catch (error) {
      console.error('[Autoscroller] Error adding button:', error);
    }
  }
  


// =======================
// 5. Cleanup & Exports
// =======================
  function cleanup() {
    if (autoscrolling) {
      stopAutoscroll();
    }
    
    if (buttonCheckInterval) {
      clearInterval(buttonCheckInterval);
      buttonCheckInterval = null;
    }
    
    failedAttempts = 0;
    hasLoggedInventoryNotFound = false;
    
    if (inventoryObserver) {
      try { 
        inventoryObserver.disconnect(); 
      } catch (e) {
        console.warn('[Autoscroller] Error disconnecting inventory observer:', e);
      }
      inventoryObserver = null;
    }
    
    const autoButtons = document.querySelectorAll('.autoscroller-inventory-button');
    autoButtons.forEach(btn => {
      try {
        btn.remove();
      } catch (e) {
        console.warn('[Autoscroller] Error removing button:', e);
      }
    });
    
    resetAutoscrollState();
    
    if (window.AutoscrollerRenderSelectedCreatures) {
      delete window.AutoscrollerRenderSelectedCreatures;
    }
    
    DOMCache.clear();
  }
  
  if (config.enabled) {
    observeInventory();
  }
  
  if (typeof exports !== 'undefined') {
    exports.cleanup = cleanup;
  }
  
  if (typeof window !== 'undefined') {
    window.Autoscroller = window.Autoscroller || {};
    window.Autoscroller.cleanup = cleanup;
  }
  
  exports = {};
  
})(); 