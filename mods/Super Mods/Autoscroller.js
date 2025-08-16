// =======================
// Autoscroller.js - Bestiary Arena Auto Scroll Mod
// =======================
// Version: 2.0 (Optimized)
// Features: 
// - Enhanced DOM caching and memory management
// - Advanced error handling with circuit breaker
// - API request queuing and rate limiting
// - Improved state management and cleanup
//
// MODULE INDEX:
// 1. Configuration & Constants
// 2. State Management
// 3. DOM Cache Management
// 4. Inventory Integration Variables
// 5. Error Handling & Circuit Breaker
// 6. API Functions & Request Queue
// 7. Utility Functions
// 8. Modal UI & Rendering
// 9. Inventory Integration & Button Management
// 10. Cleanup & Exports
// =======================
(function() {
  
// =======================
// MODULE 1: Configuration & Constants
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
    RATE_LIMIT_EXPONENTIAL_BACKOFF: true,
    RATE_LIMIT_BASE_DELAY: 1000,
    RATE_LIMIT_MAX_DELAY: 30000,
    ANIMATION_INTERVAL: 400,
    SELL_RETRY_DELAY: 5000,
    SELL_MAX_RETRIES: 3
  };

  // Error handling configuration
  const ERROR_HANDLING = {
    MAX_CONSECUTIVE_ERRORS: 5,
    ERROR_RECOVERY_DELAY: 5000,
    CIRCUIT_BREAKER_THRESHOLD: 10,
    CIRCUIT_BREAKER_TIMEOUT: 60000, // 1 minute
    NETWORK_ERROR_RETRY_DELAY: 2000,
    NETWORK_ERROR_MAX_RETRIES: 3
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
  
  // Pre-computed strings for better performance
  const STRING_CACHE = {
    tierNames: SCROLL_CONFIG.TIER_NAMES,
    tierColors: SCROLL_CONFIG.TIER_COLORS,
    scrollKeys: ['summonScroll1', 'summonScroll2', 'summonScroll3', 'summonScroll4', 'summonScroll5'],
    commonMessages: {
      noScrolls: 'No scrolls available',
      selectCreatures: 'Select creatures first',
      setTarget: 'Set target > 0',
      setTierTargets: 'Set tier targets',
      selectRule: 'Select stopping rule',
      ready: 'Ready to autoscroll',
      starting: 'Starting autoscroll...',
      autoscrolling: 'Autoscrolling...',
      rateLimited: 'Rate-limited',
      error: 'Error - Circuit Open'
    }
  };
  
  const SUMMON_SCROLL_API_URL = SCROLL_CONFIG.SUMMON_SCROLL_API_URL;
  const FRAME_IMAGE_URL = SCROLL_CONFIG.FRAME_IMAGE_URL;
  
  // Lazy-loaded creature list to reduce initial memory footprint
  let ALL_CREATURES_CACHE = null;
  let MONSTER_NAME_CACHE = new Map(); // Cache monster name lookups
  let MONSTER_ID_CACHE = new Map(); // Cache monster ID lookups
  
  function getAllCreatures() {
    if (!ALL_CREATURES_CACHE) {
      ALL_CREATURES_CACHE = [
        'Amazon', 'Banshee', 'Bear', 'Bog Raider', 'Bug', 'Corym Charlatan', 'Corym Skirmisher', 'Corym Vanguard', 'Cyclops', 'Deer', 'Demon Skeleton', 'Dragon', 'Dragon Lord',
        'Druid', 'Dwarf', 'Dwarf Geomancer', 'Dwarf Guard', 'Dwarf Soldier', 'Elf', 'Elf Arcanist', 'Elf Scout',
        'Fire Devil', 'Fire Elemental', 'Firestarter', 'Frost Troll', 'Ghost', 'Ghoul', 'Giant Spider', 'Goblin', 'Goblin Assassin',
        'Goblin Scavenger', 'Knight', 'Minotaur', 'Minotaur Archer', 'Minotaur Guard', 'Minotaur Mage', 'Monk',
        'Mummy', 'Nightstalker', 'Orc Berserker', 'Orc Leader', 'Orc Rider', 'Orc Shaman', 'Orc Spearman',
        'Orc Warlord', 'Poison Spider', 'Polar Bear', 'Rat', 'Rorc', 'Rotworm', 'Scorpion', 'Sheep', 'Skeleton',
        'Slime', 'Snake', 'Spider', 'Stalker', 'Swamp Troll', 'Tortoise', 'Troll', 'Valkyrie', 'Warlock', 'Wasp', 'Water Elemental',
        'Witch', 'Winter Wolf', 'Wolf', 'Wyvern'
      ];
    }
    return ALL_CREATURES_CACHE;
  }
  
  // Memory management for monster caches
  function clearMonsterCaches() {
    MONSTER_NAME_CACHE.clear();
    MONSTER_ID_CACHE.clear();
  }
  
  // Limit cache sizes to prevent memory leaks
  function limitCacheSize(cache, maxSize = 100) {
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      const toDelete = entries.slice(0, cache.size - maxSize);
      toDelete.forEach(([key]) => cache.delete(key));
    }
  }

// =======================
// MODULE 2: State Management
// =======================
  // Centralized state management
  const AutoscrollerState = {
    // Core state
    autoscrollStats: {
      totalScrolls: 0,
      successfulSummons: 0,
      targetCreatures: new Set(),
      foundCreatures: new Map(),
      soldMonsters: 0,
      soldGold: 0
    },
    
    // UI state
    selectedScrollTier: 1,
    selectedCreatures: [],
    autoscrolling: false,
    
    // Configuration state
    stopConditions: {
      useTotalCreatures: true,
      totalCreaturesTarget: 15,
      useTierSystem: false,
      tierTargets: [...SCROLL_CONFIG.DEFAULT_TIER_TARGETS]
    },
    
    // Autosell state
    autosellNonSelected: false,
    autosellGenesMin: 5,
    autosellGenesMax: 79,
    autosqueezeGenesMin: 80,
    autosqueezeGenesMax: 100,
    
    // Rate limiting state
    rateLimitedSales: new Set(),
    rateLimitedSalesRetryCount: new Map(),
    lastRateLimitTime: 0,
    consecutiveRateLimits: 0,
    lastApiCall: 0,
    userDefinedSpeed: 400,
    rateLimitedInterval: null,
    
      // State validation with caching
  validateState() {
    const errors = [];
    
    if (this.selectedScrollTier < 1 || this.selectedScrollTier > 5) {
      errors.push('Invalid scroll tier');
    }
    
    if (this.stopConditions.totalCreaturesTarget < 1) {
      errors.push('Invalid creature target');
    }
    
    if (this.userDefinedSpeed < 100 || this.userDefinedSpeed > 2000) {
      errors.push('Invalid speed setting');
    }
    
    return errors;
  },
  
  // Debounced state updates for better performance
  debouncedUpdate: null,
  
  // Update state with debouncing to prevent excessive re-renders
  debouncedUpdateState(newState, delay = 100) {
    if (this.debouncedUpdate) {
      clearTimeout(this.debouncedUpdate);
    }
    
    this.debouncedUpdate = setTimeout(() => {
      this.update(newState);
      this.debouncedUpdate = null;
    }, delay);
  },
    
    // State persistence
    saveToStorage() {
      try {
        const stateToSave = {
          selectedScrollTier: this.selectedScrollTier,
          selectedCreatures: [...this.selectedCreatures],
          stopConditions: { ...this.stopConditions },
          userDefinedSpeed: this.userDefinedSpeed,
          autosellNonSelected: this.autosellNonSelected,
          autosellGenesMin: this.autosellGenesMin,
          autosellGenesMax: this.autosellGenesMax,
          autosqueezeGenesMin: this.autosqueezeGenesMin,
          autosqueezeGenesMax: this.autosqueezeGenesMax
        };
        localStorage.setItem('autoscroller_state', JSON.stringify(stateToSave));
      } catch (error) {
        console.warn('[Autoscroller] Failed to save state:', error);
      }
    },
    
    loadFromStorage() {
      try {
        const saved = localStorage.getItem('autoscroller_state');
        if (saved) {
          const state = JSON.parse(saved);
          
                  if (state.selectedScrollTier) this.selectedScrollTier = state.selectedScrollTier;
        if (state.selectedCreatures) this.selectedCreatures = [...state.selectedCreatures];
        if (state.stopConditions) this.stopConditions = { ...this.stopConditions, ...state.stopConditions };
        if (state.userDefinedSpeed) this.userDefinedSpeed = state.userDefinedSpeed;
        if (state.autosellNonSelected !== undefined) this.autosellNonSelected = state.autosellNonSelected;
        if (state.autosellGenesMin !== undefined) this.autosellGenesMin = state.autosellGenesMin;
        if (state.autosellGenesMax !== undefined) this.autosellGenesMax = state.autosellGenesMax;
        if (state.autosqueezeGenesMin !== undefined) this.autosqueezeGenesMin = state.autosqueezeGenesMin;
        if (state.autosqueezeGenesMax !== undefined) this.autosqueezeGenesMax = state.autosqueezeGenesMax;
          
                  // State loaded from storage
      }
      } catch (error) {
        console.warn('[Autoscroller] Failed to load state:', error);
      }
    },
    
    // State reset
    reset() {
      this.autoscrollStats = {
        totalScrolls: 0,
        successfulSummons: 0,
        targetCreatures: new Set(),
        foundCreatures: new Map(),
        soldMonsters: 0,
        soldGold: 0,
        squeezedMonsters: 0,
        squeezedDust: 0
      };
      
      this.selectedScrollTier = 1;
      this.selectedCreatures = [];
      this.autoscrolling = false;
      
      this.stopConditions = {
        useTotalCreatures: true,
        totalCreaturesTarget: 15,
        useTierSystem: false,
        tierTargets: [...SCROLL_CONFIG.DEFAULT_TIER_TARGETS]
      };
      
      this.autosellNonSelected = false;
      this.autosellGenesMin = 5;
      this.autosellGenesMax = 79;
      this.autosqueezeGenesMin = 80;
      this.autosqueezeGenesMax = 100;
      this.rateLimitedSales.clear();
      this.rateLimitedSalesRetryCount.clear();
      this.lastRateLimitTime = 0;
      this.consecutiveRateLimits = 0;
      this.lastApiCall = 0;
      this.userDefinedSpeed = 400;
      
      if (this.rateLimitedInterval) {
        clearInterval(this.rateLimitedInterval);
        this.rateLimitedInterval = null;
      }
    },
    
    // State update with validation
    update(newState) {
      const oldState = { ...this };
      Object.assign(this, newState);
      
      const errors = this.validateState();
      if (errors.length > 0) {
        console.warn('[Autoscroller] State validation errors:', errors);
        Object.assign(this, oldState); // Revert on validation failure
        return false;
      }
      
      return true;
    }
  };
  
  // Legacy variable aliases for backward compatibility
  let autoscrollStats = AutoscrollerState.autoscrollStats;
  let selectedScrollTier = AutoscrollerState.selectedScrollTier;
  let selectedCreatures = AutoscrollerState.selectedCreatures;
  let autoscrolling = AutoscrollerState.autoscrolling;
  let stopConditions = AutoscrollerState.stopConditions;
  let autosellNonSelected = AutoscrollerState.autosellNonSelected;
  let autosellGenesMin = AutoscrollerState.autosellGenesMin;
  let autosellGenesMax = AutoscrollerState.autosellGenesMax;
  let autosqueezeGenesMin = AutoscrollerState.autosqueezeGenesMin;
  let autosqueezeGenesMax = AutoscrollerState.autosqueezeGenesMax;
  let rateLimitedSales = AutoscrollerState.rateLimitedSales;
  let rateLimitedSalesRetryCount = AutoscrollerState.rateLimitedSalesRetryCount;
  let lastRateLimitTime = AutoscrollerState.lastRateLimitTime;
  let consecutiveRateLimits = AutoscrollerState.consecutiveRateLimits;
  let lastApiCall = AutoscrollerState.lastApiCall;
  let userDefinedSpeed = AutoscrollerState.userDefinedSpeed;
  let rateLimitedInterval = AutoscrollerState.rateLimitedInterval;
  
  // Error handling state
  let errorState = {
    consecutiveErrors: 0,
    lastErrorTime: 0,
    circuitBreakerOpen: false,
    circuitBreakerOpenTime: 0,
    totalErrors: 0,
    errorTypes: new Map()
  };
  
  // API request queue management with batching
  let apiRequestQueue = {
    pending: [],
    processing: false,
    lastRequestTime: 0,
    batchSize: 3, // Process up to 3 requests in a batch
    maxQueueSize: 20,
    batchTimeout: 100, // Wait up to 100ms to collect requests for batching
    lastBatchTime: 0,
    
    // Add request to queue with batching logic
    addRequest(request) {
      if (this.pending.length >= this.maxQueueSize) {
        console.warn('[Autoscroller] API queue full, dropping oldest request');
        this.pending.shift(); // Remove oldest request
      }
      this.pending.push(request);
      
      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    },
    
    // Process queue with batching
    async processQueue() {
      if (this.processing || this.pending.length === 0) {
        return;
      }
      
      this.processing = true;
      
      while (this.pending.length > 0 && autoscrolling) {
        // Check if we should batch requests
        const shouldBatch = this.pending.length >= this.batchSize && 
                           (Date.now() - this.lastBatchTime) < this.batchTimeout;
        
        if (shouldBatch) {
          // Process batch of requests
          const batch = this.pending.splice(0, this.batchSize);
          await this.processBatch(batch);
        } else {
          // Process single request
          const request = this.pending.shift();
          await this.processSingleRequest(request);
        }
      }
      
      this.processing = false;
    },
    
    // Process a batch of requests
    async processBatch(batch) {
      try {
        // Ensure minimum delay between batches
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = Math.max(userDefinedSpeed, PERFORMANCE.API_THROTTLE_MIN);
        
        if (timeSinceLastRequest < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
        }
        
        // Process all requests in batch
        const promises = batch.map(request => this.executeRequest(request));
        const results = await Promise.allSettled(promises);
        
        // Handle results
        results.forEach((result, index) => {
          const request = batch[index];
          if (result.status === 'fulfilled') {
            request.resolve(result.value);
          } else {
            request.reject(result.reason);
          }
        });
        
        this.lastRequestTime = Date.now();
        this.lastBatchTime = Date.now();
        
      } catch (error) {
        console.error('[Autoscroller] Batch processing error:', error);
        // Reject all requests in batch
        batch.forEach(request => request.reject(error));
      }
    },
    
    // Process single request
    async processSingleRequest(request) {
      try {
        // Ensure minimum delay between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minDelay = Math.max(userDefinedSpeed, PERFORMANCE.API_THROTTLE_MIN);
        
        if (timeSinceLastRequest < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
        }
        
        const result = await this.executeRequest(request);
        request.resolve(result);
        this.lastRequestTime = Date.now();
        
      } catch (error) {
        request.reject(error);
      }
    },
    
    // Execute a single request
    async executeRequest(request) {
      return await request.execute();
    }
  };
  
  // Event handling management
  let eventHandlers = {
    listeners: new Map(),
    delegatedEvents: new Map(),
    
    // UI update optimization
    uiUpdateQueue: new Set(),
    uiUpdateScheduled: false,
    uiUpdateTimeout: null,
    
    // Schedule UI update with batching
    scheduleUIUpdate(updateFunction) {
      this.uiUpdateQueue.add(updateFunction);
      
      if (!this.uiUpdateScheduled) {
        this.uiUpdateScheduled = true;
        this.uiUpdateTimeout = requestAnimationFrame(() => {
          this.processUIUpdates();
        });
      }
    },
    
    // Process all queued UI updates
    processUIUpdates() {
      this.uiUpdateScheduled = false;
      
      for (const updateFunction of this.uiUpdateQueue) {
        try {
          updateFunction();
        } catch (error) {
          console.warn('[Autoscroller] UI update error:', error);
        }
      }
      
      this.uiUpdateQueue.clear();
    },
    
    // Cancel pending UI updates
    cancelUIUpdates() {
      if (this.uiUpdateTimeout) {
        cancelAnimationFrame(this.uiUpdateTimeout);
        this.uiUpdateTimeout = null;
      }
      this.uiUpdateScheduled = false;
      this.uiUpdateQueue.clear();
    },
    
    // Add event listener with cleanup tracking
    add(element, event, handler, options = {}) {
      const key = `${event}_${element.id || element.className || 'unknown'}`;
      if (!this.listeners.has(key)) {
        this.listeners.set(key, []);
      }
      this.listeners.get(key).push({ element, event, handler, options });
      element.addEventListener(event, handler, options);
    },
    
    // Remove specific event listener
    remove(element, event, handler) {
      const key = `${event}_${element.id || element.className || 'unknown'}`;
      const listeners = this.listeners.get(key);
      if (listeners) {
        const index = listeners.findIndex(l => l.element === element && l.handler === handler);
        if (index !== -1) {
          element.removeEventListener(event, handler);
          listeners.splice(index, 1);
        }
      }
    },
    
    // Add delegated event listener
    addDelegated(container, selector, event, handler) {
      const key = `${event}_${selector}`;
      if (!this.delegatedEvents.has(key)) {
        this.delegatedEvents.set(key, []);
      }
      this.delegatedEvents.get(key).push({ container, selector, event, handler });
      
      container.addEventListener(event, (e) => {
        const target = e.target.closest(selector);
        if (target && container.contains(target)) {
          handler.call(target, e, target);
        }
      });
    },
    
    // Clean up all event listeners
    cleanup() {
      // Clean up regular listeners
      for (const [key, listeners] of this.listeners) {
        for (const { element, event, handler } of listeners) {
          try {
            element.removeEventListener(event, handler);
          } catch (error) {
            console.warn('[Autoscroller] Error removing event listener:', error);
          }
        }
      }
      this.listeners.clear();
      
      // Clean up delegated events
      this.delegatedEvents.clear();
    }
  };

// =======================
// MODULE 3: DOM Cache Management
// =======================
  const DOMCache = {
    cache: new Map(),
    persistentCache: new Map(), // For elements that rarely change
    cacheTimeout: PERFORMANCE.DOM_CACHE_TIMEOUT,
    inventoryCacheTimeout: 500, // Shorter timeout for inventory elements
    maxCacheSize: 100, // Maximum number of cached items
    maxPersistentCacheSize: 50, // Maximum number of persistent cached items

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

    getPersistent: function(selector, context = document) {
      const key = `${selector}_${context === document ? 'doc' : context.id || 'ctx'}`;
      const cached = this.persistentCache.get(key);
      
      if (cached && cached.element && document.contains(cached.element)) {
        return cached.element;
      }
      
      const element = context.querySelector(selector);
      if (element) {
        this.addToPersistentCache(key, element);
      }
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
      this.persistentCache.clear();
    },

    clearSelector: function(selector) {
      for (const key of this.cache.keys()) {
        if (key.includes(selector)) {
          this.cache.delete(key);
        }
      }
      for (const key of this.persistentCache.keys()) {
        if (key.includes(selector)) {
          this.persistentCache.delete(key);
        }
      }
    },

    // New method for inventory-specific caching
    getInventoryElement: function(selector) {
      const key = `inventory_${selector}`;
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < this.inventoryCacheTimeout) {
        return cached.element;
      }
      
      const element = document.querySelector(selector);
      this.addToCache(key, element);
      return element;
    },

    // Clear inventory cache when inventory changes
    clearInventoryCache: function() {
      for (const key of this.cache.keys()) {
        if (key.startsWith('inventory_')) {
          this.cache.delete(key);
        }
      }
    },

    // Manage cache size to prevent memory leaks
    manageCacheSize: function() {
      // Manage regular cache
      if (this.cache.size > this.maxCacheSize) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
        toRemove.forEach(([key]) => this.cache.delete(key));
      }

      // Manage persistent cache
      if (this.persistentCache.size > this.maxPersistentCacheSize) {
        const entries = Array.from(this.persistentCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, this.persistentCache.size - this.maxPersistentCacheSize);
        toRemove.forEach(([key]) => this.persistentCache.delete(key));
      }
    },

    // Add cache entry with size management
    addToCache: function(key, element, timestamp = Date.now()) {
      this.cache.set(key, { element, timestamp });
      this.manageCacheSize();
    },

    addToPersistentCache: function(key, element, timestamp = Date.now()) {
      this.persistentCache.set(key, { element, timestamp });
      this.manageCacheSize();
    }
  };

// =======================
// MODULE 4: Inventory Integration Variables
// =======================
  // Variables moved to MODULE 9 for optimization

// =======================
// MODULE 5: Error Handling & Circuit Breaker
// =======================
  function handleError(error, context = 'unknown') {
    // Don't count "Autoscroll stopped by user" as an error
    if (error.message && error.message.includes('Autoscroll stopped by user')) {
      return { shouldStop: false, reason: null };
    }
    
    const now = Date.now();
    errorState.totalErrors++;
    errorState.lastErrorTime = now;
    errorState.consecutiveErrors++;
    
    // Track error types
    const errorType = error.name || 'Unknown';
    errorState.errorTypes.set(errorType, (errorState.errorTypes.get(errorType) || 0) + 1);
    
    console.error(`[Autoscroller] Error in ${context}:`, error);
    
    // Check circuit breaker
    if (errorState.consecutiveErrors >= ERROR_HANDLING.CIRCUIT_BREAKER_THRESHOLD) {
      errorState.circuitBreakerOpen = true;
      errorState.circuitBreakerOpenTime = now;
      console.warn(`[Autoscroller] Circuit breaker opened due to ${errorState.consecutiveErrors} consecutive errors`);
      
      const { autoscrollBtn } = getAutoscrollButtons();
      if (autoscrollBtn) {
        autoscrollBtn.textContent = 'Error - Circuit Open';
        autoscrollBtn.style.color = '#ff6b6b';
      }
      
      return { shouldStop: true, reason: 'circuit_breaker' };
    }
    
    // Check if we should stop autoscroll
    if (errorState.consecutiveErrors >= ERROR_HANDLING.MAX_CONSECUTIVE_ERRORS) {
      console.warn(`[Autoscroller] Stopping autoscroll due to ${errorState.consecutiveErrors} consecutive errors`);
      return { shouldStop: true, reason: 'max_errors' };
    }
    
    return { shouldStop: false, reason: null };
  }
  
  function resetErrorState() {
    errorState.consecutiveErrors = 0;
    errorState.circuitBreakerOpen = false;
    errorState.circuitBreakerOpenTime = 0;
    
    const { autoscrollBtn } = getAutoscrollButtons();
    if (autoscrollBtn) {
      autoscrollBtn.style.color = '';
    }
  }
  
  function isCircuitBreakerOpen() {
    if (!errorState.circuitBreakerOpen) return false;
    
    const now = Date.now();
    if (now - errorState.circuitBreakerOpenTime >= ERROR_HANDLING.CIRCUIT_BREAKER_TIMEOUT) {
      errorState.circuitBreakerOpen = false;
              return false;
    }
    
    return true;
  }
  
  function handleSuccess() {
    errorState.consecutiveErrors = 0;
    if (errorState.circuitBreakerOpen) {
      errorState.circuitBreakerOpen = false;
      // Circuit breaker closed due to successful operation
    }
  }
  
  // API Queue Management with batching
  function addToApiQueue(request) {
    apiRequestQueue.addRequest(request);
  }
  
  // Flag to prevent operations during queue clearing
  let isQueueClearing = false;
  
  function clearApiQueue() {
    isQueueClearing = true;
    apiRequestQueue.pending.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    apiRequestQueue.pending = [];
    apiRequestQueue.processing = false;
    apiRequestQueue.lastBatchTime = 0;
    // Reset flag after a short delay to allow cleanup
    setTimeout(() => {
      isQueueClearing = false;
    }, 100);
  }

// =======================
// MODULE 6: API Functions & Request Queue
// =======================
  async function summonScroll(rarity) {
    return new Promise((resolve, reject) => {
      const request = {
        execute: async () => {
          // Check circuit breaker
          if (isCircuitBreakerOpen()) {
            throw new Error('Circuit breaker is open - too many consecutive errors');
          }
          
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
              const errorResult = handleError(err, 'summonScroll_network');
              if (errorResult.shouldStop) {
                throw new Error(`Network error: ${errorResult.reason}`);
              }
              
              retryCount++;
              if (retryCount > ERROR_HANDLING.NETWORK_ERROR_MAX_RETRIES) {
                throw new Error('Network error after max retries');
              }
              await new Promise(resolve => setTimeout(resolve, ERROR_HANDLING.NETWORK_ERROR_RETRY_DELAY));
              continue;
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
            // Reset rate limit tracking on success
            consecutiveRateLimits = 0;
            lastRateLimitTime = 0;
          }
          break;
        }
        
        // Handle rate limiting
        consecutiveRateLimits++;
        lastRateLimitTime = Date.now();
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
          
          // Instead of throwing, return a rate limit indicator
          return { rateLimited: true, retryCount };
        }
        
        // Calculate wait time with exponential backoff
        let waitTime = PERFORMANCE.RATE_LIMIT_BASE_DELAY;
        if (PERFORMANCE.RATE_LIMIT_EXPONENTIAL_BACKOFF) {
          waitTime = Math.min(
            PERFORMANCE.RATE_LIMIT_BASE_DELAY * Math.pow(2, retryCount - 1),
            PERFORMANCE.RATE_LIMIT_MAX_DELAY
          );
        }
        
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
        const errorResult = handleError(err, 'summonScroll_json_parse');
        if (errorResult.shouldStop) {
          throw new Error(`JSON parse error: ${errorResult.reason}`);
        }
        throw new Error('API returned non-JSON response');
      }
      
      if (!response.ok) {
        const errorResult = handleError(new Error(`HTTP ${response.status}: ${response.statusText}`), 'summonScroll_http');
        if (errorResult.shouldStop) {
          throw new Error(`HTTP error: ${errorResult.reason}`);
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`);
      }
      
      // Success - reset error state
      handleSuccess();
      
      return data[0]?.result?.data?.json;
        },
        resolve,
        reject
      };
      
      addToApiQueue(request);
    });
  }
  
  /**
   * Update the local inventory state using inventoryDiff from API response
   */
  function updateLocalInventoryAfterRoll(inventoryDiff) {
    try {
      const player = globalThis.state?.player;
      if (!player) return;
      
      if (!inventoryDiff || Object.keys(inventoryDiff).length === 0) return;
      
      player.send({
        type: 'setState',
        fn: (prev) => {
          const newState = { ...prev };
          // Ensure nested inventory exists
          newState.inventory = { ...prev.inventory };
          
          Object.entries(inventoryDiff).forEach(([itemKey, change]) => {
            if (change === 0) return;
            if (!newState.inventory[itemKey]) newState.inventory[itemKey] = 0;
            newState.inventory[itemKey] = Math.max(0, newState.inventory[itemKey] + change);
            // Mirror on root for compatibility
            newState[itemKey] = newState.inventory[itemKey];
          });
          
          return newState;
        }
      });
    } catch (error) {
      console.warn('[Autoscroller] Error updating local inventory:', error);
    }
  }
  
  /**
   * Update the summon scroll counts in the UI to reflect current inventory
   */
  function updateSelectedScrollTierBorder() {
    const scrollButtons = document.querySelectorAll('.autoscroller-scroll-button');
    scrollButtons.forEach((btn, index) => {
      const tier = index + 1;
      const slot = btn.querySelector('.container-slot');
      if (slot) {
        if (tier === selectedScrollTier) {
          btn.setAttribute('data-state', 'selected');
          slot.style.boxShadow = '0 0 0 2px #00ff00';
          slot.style.borderRadius = '0';
        } else {
          btn.setAttribute('data-state', 'closed');
          slot.style.boxShadow = 'none';
          slot.style.borderRadius = '0';
        }
      }
    });
  }

  function updateSummonScrollCounts() {
    try {
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      if (!playerContext) return;
      
      const inventory = playerContext.inventory || {};
      
      // Find all summon scroll count elements in the modal
      const scrollButtons = document.querySelectorAll('.autoscroller-scroll-button');
      
      scrollButtons.forEach((btn, index) => {
        const tier = index + 1; // 1-5 for summon scroll tiers
        const key = STRING_CACHE.scrollKeys[index]; // Use cached key
        const count = inventory[key] || 0;
        
        // Find the count element below the button
        const countElement = btn.parentElement?.querySelector('span[translate="no"]');
        if (countElement) {
          if (count === 0) {
            countElement.textContent = '0';
            countElement.style.color = '#888';
            countElement.style.fontStyle = 'italic';
            countElement.style.fontWeight = 'normal';
          } else {
            // Optimized number formatting
            const formattedCount = count >= 1000 ? `${(count / 1000).toFixed(1).replace('.', ',')}K` : count.toString();
            countElement.textContent = formattedCount;
            countElement.style.color = '#fff';
            countElement.style.fontStyle = 'normal';
            countElement.style.fontWeight = 'bold';
          }
        }
      });
    } catch (error) {
      console.warn('[Autoscroller] Error updating summon scroll counts:', error);
    }
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
  
  function removeMonsterFromLocalInventory(monsterId) {
    try {
      const player = globalThis.state?.player;
      if (!player) return;
      
      player.send({
        type: "setState",
        fn: (prev) => ({
          ...prev,
          monsters: prev.monsters.filter(m => m.id !== monsterId)
        }),
      });
    } catch (e) {
      console.warn('[Autoscroller] Failed to remove monster from local inventory:', e);
    }
  }

  function updateLocalInventoryGoldDust(goldChange = 0, dustChange = 0) {
    try {
      const player = globalThis.state?.player;
      if (!player) return;
      
      player.send({
        type: "setState",
        fn: (prev) => {
          const newState = { ...prev };
          // Ensure nested inventory exists
          newState.inventory = { ...prev.inventory };
          
          // Get current values from both possible locations
          const currentGold = prev.inventory?.gold ?? prev.gold ?? 0;
          const currentDust = prev.inventory?.dust ?? prev.dust ?? 0;
          
          // Update inventory values by ADDING to current values
          if (goldChange !== 0) {
            newState.inventory.gold = currentGold + goldChange;
            // Mirror on root for compatibility (like updateLocalInventoryAfterRoll does)
            newState.gold = newState.inventory.gold;
          }
          
          if (dustChange !== 0) {
            newState.inventory.dust = currentDust + dustChange;
            // Mirror on root for compatibility
            newState.dust = newState.inventory.dust;
          }
          
          return newState;
        },
      });
    } catch (e) {
      console.warn('[Autoscroller] Failed to update local inventory gold/dust:', e);
    }
  }
  
  function getMonsterNameFromGameId(gameId) {
    // Check cache first
    if (MONSTER_NAME_CACHE.has(gameId)) {
      return MONSTER_NAME_CACHE.get(gameId);
    }
    
    try {
      const utils = globalThis.state?.utils;
      if (!utils || !utils.getMonster) {
        console.warn('[Autoscroller] Monster API not available');
        return null;
      }
      
      const monster = utils.getMonster(gameId);
      const name = monster?.metadata?.name || null;
      
      // Cache the result
      if (name) {
        MONSTER_NAME_CACHE.set(gameId, name);
        limitCacheSize(MONSTER_NAME_CACHE, 200); // Limit cache size
      }
      
      return name;
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
  
  function resetAutoscrollState() {
    // Use centralized state management
    AutoscrollerState.reset();
    
    // Reset error state
    resetErrorState();
    
    // Clear API queue
    clearApiQueue();
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
    
    const ruleInputs = document.querySelectorAll('#total-creatures-checkbox, #tier-system-checkbox, #total-creatures-input, .tier-input, #autosell-checkbox');
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
    const lowerName = creatureName.toLowerCase();
    
    // Check cache first
    if (MONSTER_ID_CACHE.has(lowerName)) {
      return MONSTER_ID_CACHE.get(lowerName);
    }
    
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
            if (monster.metadata.name.toLowerCase() === lowerName) {
              // Cache the result
              MONSTER_ID_CACHE.set(lowerName, i);
              limitCacheSize(MONSTER_ID_CACHE, 200); // Limit cache size
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
            
            // Note: tierCounts already includes all monsters in inventory, including those added during this session
            // No need to add autoscrollCount again as it would double-count
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
  
  /**
   * Squeeze monsters by their IDs using the same API as Autoseller
   * @param {Array<number>} monsterIds - Array of monster IDs to squeeze
   * @returns {Promise<Object>} API response
   */
  async function squeezeMonsters(monsterIds, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const request = {
        execute: async () => {
          try {
            const url = 'https://bestiaryarena.com/api/trpc/inventory.monsterSqueezer?batch=1';
            const body = { "0": { json: monsterIds } };
            
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Game-Version': '1'
              },
              body: JSON.stringify(body)
            });
            
            if (!response.ok) {
              if (response.status === 404) {
                console.log(`[Autoscroller] Monsters not found (already squeezed or removed)`);
                return { success: false, status: 404, message: 'Monsters not found' };
              }
              if (response.status === 429) {
                console.log(`[Autoscroller] Rate limited while squeezing monsters - will retry later`);
                return { success: false, status: 429, message: 'Rate limited' };
              }
              throw new Error(`Squeeze API failed: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const apiResponse = data[0]?.result?.data?.json;
            
            if (apiResponse && apiResponse.dustDiff != null) {
              return { success: true, dustDiff: apiResponse.dustDiff };
            } else {
              console.warn(`[Autoscroller] Unexpected squeeze API response format:`, apiResponse);
              return { success: false, message: 'Unexpected response format' };
            }
          } catch (error) {
            console.error(`[Autoscroller] Error squeezing monsters:`, error);
            return { success: false, error: error.message };
          }
        },
        resolve,
        reject
      };
      
      addToApiQueue(request);
    });
  }

  /**
   * Sell a monster by its ID using the same API as Autoseller
   * @param {number} monsterId - The monster ID to sell
   * @returns {Promise<Object>} API response
   */
  async function sellMonster(monsterId, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const request = {
        execute: async () => {
          try {
            const url = 'https://bestiaryarena.com/api/trpc/game.sellMonster?batch=1';
            const body = { "0": { json: monsterId } };
            
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Game-Version': '1'
              },
              body: JSON.stringify(body)
            });
            
            if (!response.ok) {
              if (response.status === 404) {
                console.log(`[Autoscroller] Monster ${monsterId} not found (already sold or removed)`);
                return { success: false, status: 404, message: 'Monster not found' };
              }
              if (response.status === 429) {
                console.log(`[Autoscroller] Rate limited while selling monster ${monsterId} - will retry later`);
                
                // Add to retry queue if we haven't exceeded max retries
                if (retryCount < PERFORMANCE.SELL_MAX_RETRIES) {
                  rateLimitedSales.add(monsterId);
                  rateLimitedSalesRetryCount.set(monsterId, retryCount + 1);
                  
                  // Schedule retry
                  setTimeout(() => {
                    if (rateLimitedSales.has(monsterId)) {
                      console.log(`[Autoscroller] Retrying sale of monster ${monsterId} (attempt ${retryCount + 2})`);
                      sellMonster(monsterId, retryCount + 1).then(result => {
                        if (result.success) {
                          rateLimitedSales.delete(monsterId);
                          rateLimitedSalesRetryCount.delete(monsterId);
                          console.log(`[Autoscroller] Successfully sold monster ${monsterId} on retry`);
                        } else if (result.status === 429 && retryCount + 1 < PERFORMANCE.SELL_MAX_RETRIES) {
                          // Keep in retry queue for another attempt
                          console.log(`[Autoscroller] Still rate limited for monster ${monsterId}, will retry again`);
                        } else {
                          // Remove from retry queue if max retries reached or other error
                          rateLimitedSales.delete(monsterId);
                          rateLimitedSalesRetryCount.delete(monsterId);
                          console.warn(`[Autoscroller] Failed to sell monster ${monsterId} after ${retryCount + 2} attempts`);
                        }
                      });
                    }
                  }, PERFORMANCE.SELL_RETRY_DELAY);
                }
                
                return { success: false, status: 429, message: 'Rate limited' };
              }
              throw new Error(`Sell API failed: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const apiResponse = data[0]?.result?.data?.json;
            
            if (apiResponse && apiResponse.goldValue != null) {
                      return { success: true, goldValue: apiResponse.goldValue };
            } else {
              console.warn(`[Autoscroller] Unexpected sell API response format:`, apiResponse);
              return { success: false, message: 'Unexpected response format' };
            }
          } catch (error) {
            console.error(`[Autoscroller] Error selling monster ${monsterId}:`, error);
            return { success: false, error: error.message };
          }
        },
        resolve,
        reject
      };
      
      addToApiQueue(request);
    });
  }
  
  /**
   * Calculate total genes for a monster
   * @param {Object} monster - Monster object
   * @returns {number} Total gene percentage
   */
  function getMonsterGenes(monster) {
    if (!monster) return 0;
    return (monster.hp || 0) + (monster.ad || 0) + (monster.ap || 0) + (monster.armor || 0) + (monster.magicResist || 0);
  }

  /**
   * Check if a monster should be sold (not in selected creatures list)
   * @param {Object} monster - Monster object from summon result
   * @returns {Object} Object with action: 'sell', 'squeeze', or 'keep'
   */
  function shouldProcessMonster(monster) {
    if (!autosellNonSelected || !monster || !monster.gameId) {
      return { action: 'keep' };
    }
    
    const monsterName = getMonsterNameFromGameId(monster.gameId);
    if (!monsterName) {
      console.warn('[Autoscroller] Could not determine monster name for gameId:', monster.gameId);
      return { action: 'keep' };
    }
    
    // Check if the monster is in the selected creatures list
    const isSelected = selectedCreatures.includes(monsterName);
    
    // Keep if selected
    if (isSelected) {
      return { action: 'keep' };
    }
    
    // Calculate genes for non-selected monsters
    const genes = getMonsterGenes(monster);
    
    // Squeeze if genes are 80-100%
    if (genes >= autosqueezeGenesMin && genes <= autosqueezeGenesMax) {
      return { action: 'squeeze', genes };
    }
    
    // Sell if genes are 5-79%
    if (genes >= autosellGenesMin && genes <= autosellGenesMax) {
      return { action: 'sell', genes };
    }
    
    // Keep if genes are outside both ranges
    return { action: 'keep', genes };
  }
  
  async function autoscrollLoop() {
    try {
      // Check if queue is being cleared - if so, stop operations
      if (isQueueClearing) {
        console.log('[Autoscroller] Queue is being cleared, stopping operations');
        return;
      }
      
      // Check if modal is still open - if not, stop autoscrolling
      if (!DOM_ELEMENTS.isModalOpen()) {
        autoscrolling = false;
        return;
      }
      
      // Update UI first to ensure we have the latest inventory state
      if (window.AutoscrollerRenderSelectedCreatures) {
        window.AutoscrollerRenderSelectedCreatures();
      }
      
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
            message = `Target reached of ${stopConditions.totalCreaturesTarget} ${reachedCreature}! Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls.`;
          } else {
            // No target reached
            message = `Finished: Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls. Found ${totalFound} selected creatures in this session.`;
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
          statusElement.textContent = STRING_CACHE.commonMessages.noScrolls;
        }
        stopAutoscroll();
        return;
      }
      
      const result = await summonScroll(selectedScrollTier);
      
      // Handle rate limiting response
      if (result && result.rateLimited) {
        // Wait a bit longer before continuing
        await new Promise(resolve => setTimeout(resolve, PERFORMANCE.RATE_LIMIT_BASE_DELAY * 2));
        return; // Return to allow the loop in startAutoscroll to continue
      }
      
      autoscrollStats.totalScrolls++;
      
      // Update local inventory using inventoryDiff from API response
      if (result && result.inventoryDiff) {
        updateLocalInventoryAfterRoll(result.inventoryDiff);
        
        // Add a small delay to ensure state update is processed
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
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
        
        // Check if we should process this monster (if it's not in selected creatures)
        const processResult = shouldProcessMonster(result.summonedMonster);
        if (processResult.action !== 'keep') {
          // Get the monster ID from the summoned monster
          const monsterId = result.summonedMonster.id;
          if (monsterId) {
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
              if (processResult.action === 'sell') {
                const sellResult = await sellMonster(monsterId);
                
                if (sellResult.success) {
                  // Update statistics
                  autoscrollStats.soldMonsters++;
                  autoscrollStats.soldGold += sellResult.goldValue;
                  // Update local inventory with gold received
                  updateLocalInventoryGoldDust(sellResult.goldValue, 0);
                  // Remove from local inventory since it was sold
                  removeMonsterFromLocalInventory(monsterId);
                } else if (sellResult.status === 404) {
                  // Remove from local inventory since it doesn't exist on server
                  removeMonsterFromLocalInventory(monsterId);
                } else if (sellResult.status === 429) {
                  // Track this monster for potential retry later
                  rateLimitedSales.add(monsterId);
                  // Don't remove from local inventory, let it stay and try again later
                  // This prevents the monster from disappearing if we can't sell it due to rate limits
                } else {
                  console.warn(`[Autoscroller] Failed to sell monster:`, sellResult.message || sellResult.error);
                  // For other errors, don't remove from inventory to be safe
                }
              } else if (processResult.action === 'squeeze') {
                const squeezeResult = await squeezeMonsters([monsterId]);
                
                if (squeezeResult.success) {
                  // Update statistics
                  autoscrollStats.squeezedMonsters = (autoscrollStats.squeezedMonsters || 0) + 1;
                  autoscrollStats.squeezedDust = (autoscrollStats.squeezedDust || 0) + squeezeResult.dustDiff;
                  // Update local inventory with dust received
                  updateLocalInventoryGoldDust(0, squeezeResult.dustDiff);
                  // Remove from local inventory since it was squeezed
                  removeMonsterFromLocalInventory(monsterId);
                } else if (squeezeResult.status === 404) {
                  // Remove from local inventory since it doesn't exist on server
                  removeMonsterFromLocalInventory(monsterId);
                } else if (squeezeResult.status === 429) {
                  // Track this monster for potential retry later
                  rateLimitedSales.add(monsterId);
                  // Don't remove from local inventory, let it stay and try again later
                } else {
                  console.warn(`[Autoscroller] Failed to squeeze monster:`, squeezeResult.message || squeezeResult.error);
                  // For other errors, don't remove from inventory to be safe
                }
              }
            } catch (error) {
              console.error(`[Autoscroller] Error during autosell/autosqueeze:`, error);
              // Don't let autosell errors stop the autoscroll
            }
          }
        }
      }
      
      // Update summon scroll counts to reflect current inventory
      updateSummonScrollCounts();
      
          updateStatusDisplay();
      
    } catch (error) {
      // Handle "Autoscroll stopped by user" separately - not an error
      if (error.message.includes('Autoscroll stopped by user')) {
        console.log('[Autoscroller] Autoscroll stopped by user');
        return;
      }
      
      const errorResult = handleError(error, 'autoscrollLoop');
      
      // Handle specific error types
      if (error.message.includes('Circuit breaker is open')) {
        console.warn('[Autoscroller] Circuit breaker is open, pausing autoscroll');
        const statusElement = getAutoscrollStatusElement();
        if (statusElement) {
          statusElement.textContent = 'Paused - Too many errors. Will resume in 1 minute.';
        }
        await new Promise(resolve => setTimeout(resolve, ERROR_HANDLING.ERROR_RECOVERY_DELAY));
        return;
      }
      
      if (errorResult.shouldStop) {
        console.warn(`[Autoscroller] Stopping autoscroll due to errors: ${errorResult.reason}`);
        const statusElement = getAutoscrollStatusElement();
        if (statusElement) {
          statusElement.textContent = `Stopped - ${errorResult.reason === 'circuit_breaker' ? 'Too many errors' : 'Error limit reached'}`;
        }
        stopAutoscroll();
        return;
      }
      
      // For recoverable errors, log and continue
      console.warn('[Autoscroller] Recoverable error occurred, continuing autoscroll:', error.message);
      await new Promise(resolve => setTimeout(resolve, ERROR_HANDLING.ERROR_RECOVERY_DELAY));
    }
  }
  
  async function startAutoscroll() {
    setUILocked(true);
    
    // Update summon scroll counts to reflect current inventory before starting
    updateSummonScrollCounts();
    
    const statusElement = getAutoscrollStatusElement();
    if (statusElement) {
      statusElement.textContent = 'Starting autoscroll...';
    }
    
    autoscrollStats = {
      totalScrolls: 0,
      successfulSummons: 0,
      targetCreatures: new Set(selectedCreatures),
      foundCreatures: new Map(),
      soldMonsters: 0,
      soldGold: 0
    };
    
    selectedCreatures.forEach(creature => {
      autoscrollStats.foundCreatures.set(creature, 0);
    });
    
    // Clear rate-limited sales tracking
    rateLimitedSales.clear();
    rateLimitedSalesRetryCount.clear();
    lastRateLimitTime = 0;
    consecutiveRateLimits = 0;
    
    while (autoscrolling) {
      try {
        // Check if modal is still open
        if (!DOM_ELEMENTS.isModalOpen()) {
                  autoscrolling = false;
        break;
        }
        
        await autoscrollLoop();
        
        // Periodically retry failed sales
        if (rateLimitedSales.size > 0 && autoscrolling) {
          await retryFailedSales();
        }
        
        if (autoscrolling) {
          const delay = Math.max(userDefinedSpeed, PERFORMANCE.API_THROTTLE_MIN);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('[Autoscroller] Error in autoscroll loop:', error);
        
        // Handle specific error types
        if (error.message.includes('Autoscroll stopped by user')) {
          console.log('[Autoscroller] Autoscroll stopped by user');
          break;
        }
        
        if (error.message.includes('Rate limit reached too many times')) {
          console.warn('[Autoscroller] Rate limit reached too many times, pausing temporarily');
          // Wait longer before continuing
          await new Promise(resolve => setTimeout(resolve, PERFORMANCE.RATE_LIMIT_MAX_DELAY));
          continue;
        }
        
        // For other errors, log and continue
        console.warn('[Autoscroller] Non-critical error, continuing:', error.message);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
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
    
    // Maintain scroll tier border
    updateSelectedScrollTierBorder();
    
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
        message = `Finished: Target reached of ${stopConditions.totalCreaturesTarget} ${reachedCreature}! Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls.`;
      } else {
        message = `Finished: Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls. Found ${totalFound} selected creatures in this session.`;
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
// MODULE 7: Utility Functions
// =======================
  // Cached DOM elements for better performance
  const DOM_ELEMENTS = {
    autoscrollStatus: null,
    autoscrollBtn: null,
    stopBtn: null,
    inventoryContainer: null,
    summonScrollButtons: null,
    modal: null,
    lastCacheTime: 0,
    cacheTimeout: 2000, // Cache for 2 seconds
    
    // Clear all cached elements
    clear() {
      this.autoscrollStatus = null;
      this.autoscrollBtn = null;
      this.stopBtn = null;
      this.inventoryContainer = null;
      this.summonScrollButtons = null;
      this.modal = null;
      this.lastCacheTime = 0;
    },
    
    // Check if cache is still valid
    isCacheValid() {
      return Date.now() - this.lastCacheTime < this.cacheTimeout;
    },
    
    // Get modal with caching
    getModal() {
      if (!this.modal || !this.isCacheValid()) {
        this.modal = document.querySelector('div[role="dialog"][data-state="open"]');
        this.lastCacheTime = Date.now();
      }
      return this.modal;
    },
    
    // Check if modal is open and has autoscroll button
    isModalOpen() {
      const modal = this.getModal();
      return modal && modal.querySelector('.autoscroller-btn');
    }
  };

  function getAutoscrollStatusElement() {
    if (!DOM_ELEMENTS.autoscrollStatus || !DOM_ELEMENTS.isCacheValid()) {
      DOM_ELEMENTS.autoscrollStatus = DOMCache.get('#autoscroll-status');
      DOM_ELEMENTS.lastCacheTime = Date.now();
    }
    return DOM_ELEMENTS.autoscrollStatus;
  }

  function getAutoscrollButtons() {
    if (!DOM_ELEMENTS.isCacheValid()) {
      DOM_ELEMENTS.autoscrollBtn = DOMCache.get('.autoscroller-btn');
      DOM_ELEMENTS.stopBtn = DOMCache.get('.autoscroller-btn + .autoscroller-btn');
      DOM_ELEMENTS.lastCacheTime = Date.now();
    }
    return {
      autoscrollBtn: DOM_ELEMENTS.autoscrollBtn,
      stopBtn: DOM_ELEMENTS.stopBtn
    };
  }

  function getInventoryContainer() {
    if (!DOM_ELEMENTS.inventoryContainer || !DOM_ELEMENTS.isCacheValid()) {
      DOM_ELEMENTS.inventoryContainer = DOMCache.getInventoryElement('.container-inventory-4');
      DOM_ELEMENTS.lastCacheTime = Date.now();
    }
    return DOM_ELEMENTS.inventoryContainer;
  }

  function getSummonScrollButtons() {
    if (!DOM_ELEMENTS.summonScrollButtons || !DOM_ELEMENTS.isCacheValid()) {
      DOM_ELEMENTS.summonScrollButtons = DOMCache.getAll('button.focus-style-visible.active\\:opacity-70');
      DOM_ELEMENTS.lastCacheTime = Date.now();
    }
    return DOM_ELEMENTS.summonScrollButtons;
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
      
      // Use event delegation for better performance
      const handleMouseEnter = () => {
        item.style.background = 'rgba(255,255,255,0.08)';
      };
      
      const handleMouseLeave = () => {
        if (!item.classList.contains('autoscroller-selected')) {
          item.style.background = 'none';
        }
      };
      
      const handleMouseDown = () => {
        item.style.background = 'rgba(255,255,255,0.18)';
      };
      
      const handleMouseUp = () => {
        if (!item.classList.contains('autoscroller-selected')) {
          item.style.background = 'rgba(255,255,255,0.08)';
        }
      };
      
      const handleClick = () => {
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
      };
      
      // Add event listeners with tracking
      eventHandlers.add(item, 'mouseenter', handleMouseEnter);
      eventHandlers.add(item, 'mouseleave', handleMouseLeave);
      eventHandlers.add(item, 'mousedown', handleMouseDown);
      eventHandlers.add(item, 'mouseup', handleMouseUp);
      eventHandlers.add(item, 'click', handleClick);
      
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
// MODULE 8: Modal UI & Rendering
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
      
      let availableCreatures = [...getAllCreatures()];
      
      resetAutoscrollState();
      // Always default to grey scroll (tier 1) when opening modal
      selectedScrollTier = 1;
      // Always default autosell to OFF
      autosellNonSelected = false;
      
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
            // Maintain scroll tier border
            updateSelectedScrollTierBorder();
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
            // Maintain scroll tier border
            updateSelectedScrollTierBorder();
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
        speedWrapper.style.marginTop = '8px';
        
        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Autoscroll Speed:';
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
        speedInput.onchange = () => {
          userDefinedSpeed = Math.max(100, Math.min(2000, parseInt(speedInput.value) || 400));
          speedInput.value = userDefinedSpeed;
          
          // Update text color based on speed
          if (userDefinedSpeed < 400) {
            speedInput.style.color = '#ff6b6b';
          } else {
            speedInput.style.color = '#000';
          }
        };
        
        // Set initial color based on default speed
        if (userDefinedSpeed < 400) {
          speedInput.style.color = '#ff6b6b';
        }
        speedWrapper.appendChild(speedInput);
        
        const speedUnit = document.createElement('span');
        speedUnit.textContent = 'ms';
        speedUnit.style.color = '#fff';
        speedWrapper.appendChild(speedUnit);
        
        div.appendChild(speedWrapper);
        
        // Add rate-limit warning below speed input
        const rateLimitWarning = document.createElement('div');
        rateLimitWarning.textContent = '30 requests per 10 seconds is the rate-limit. Set 400ms or higher to avoid being rate-limited.';
        rateLimitWarning.style.fontSize = '11px';
        rateLimitWarning.style.fontStyle = 'italic';
        rateLimitWarning.style.color = '#ff9800';
        rateLimitWarning.style.marginTop = '2px';
        rateLimitWarning.style.marginLeft = '2px';
        rateLimitWarning.style.paddingLeft = '12px';
        rateLimitWarning.style.paddingRight = '12px';
        div.appendChild(rateLimitWarning);
        
        // Add autosell checkbox below warning text
        const autosellDiv = document.createElement('div');
        autosellDiv.style.display = 'flex';
        autosellDiv.style.alignItems = 'center';
        autosellDiv.style.gap = '8px';
        autosellDiv.style.marginTop = '8px';
        autosellDiv.style.fontSize = '14px';
        
        const autosellCheckbox = document.createElement('input');
        autosellCheckbox.type = 'checkbox';
        autosellCheckbox.id = 'autosell-checkbox';
        autosellCheckbox.checked = autosellNonSelected; // Use the preserved state
        autosellCheckbox.style.width = '16px';
        autosellCheckbox.style.height = '16px';
        autosellCheckbox.style.margin = '0';
        
        const autosellLabel = document.createElement('label');
        autosellLabel.htmlFor = 'autosell-checkbox';
        autosellLabel.textContent = 'Autosell and autosqueeze non-selected creatures';
        autosellLabel.style.color = 'rgb(230, 215, 176)';
        autosellLabel.style.cursor = 'pointer';
        
        autosellDiv.appendChild(autosellCheckbox);
        autosellDiv.appendChild(autosellLabel);
        div.appendChild(autosellDiv);
        
        // Add event listener for autosell checkbox
        autosellCheckbox.addEventListener('change', () => {
          autosellNonSelected = autosellCheckbox.checked;
          // Autosell setting updated
        });
        

        
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
            
            const totalCount = creatureMonsters.length;
            
            // Inventory vs session count tracking (debug info removed for production)
            
            const tierCounts = [0, 0, 0, 0, 0];
            creatureMonsters.forEach(monster => {
              const tier = calculateTierFromStats(monster);
              tierCounts[tier - 1]++;
            });
            
            // Note: tierCounts already includes all monsters in inventory, including those added during this session
            // No need to add autoscrollCount again as it would double-count
            
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
        
        const handleAutoscrollClick = async () => {
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
            
            // Maintain scroll tier border
            updateSelectedScrollTierBorder();
            
            startAutoscroll();
          }
        };
        
        const handleStopClick = () => {
          if (autoscrolling) {
            if (rateLimitedInterval) {
              clearInterval(rateLimitedInterval);
              rateLimitedInterval = null;
            }
            stopAutoscroll();
          }
        };
        
        // Add event listeners with tracking
        eventHandlers.add(autoscrollBtn, 'click', handleAutoscrollClick);
        eventHandlers.add(stopBtn, 'click', handleStopClick);
        
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
          btn.setAttribute('data-state', i === selectedScrollTier ? 'selected' : 'closed'); // Use selectedScrollTier
          btn.style.background = 'none';
          btn.style.border = 'none';
          btn.style.padding = '0';
          btn.style.margin = '0';
          btn.style.cursor = 'pointer';
          const handleScrollTierClick = () => {
            const currentState = btn.getAttribute('data-state');
            
            if (currentState === 'selected') {
              return;
            }
            
            // Clear all button states and borders
            const allButtons = row.querySelectorAll('button');
            allButtons.forEach(otherBtn => {
              otherBtn.setAttribute('data-state', 'closed');
              const otherSlot = otherBtn.querySelector('.container-slot');
              if (otherSlot) {
                otherSlot.style.boxShadow = 'none';
                otherSlot.style.borderRadius = '0';
              }
            });
            
            // Set this button as selected
            btn.setAttribute('data-state', 'selected');
            selectedScrollTier = i;
            
            const slot = btn.querySelector('.container-slot');
            if (slot) {
              slot.style.boxShadow = '0 0 0 2px #00ff00';
              slot.style.borderRadius = '0';
            }
          };
          
          eventHandlers.add(btn, 'click', handleScrollTierClick);
          
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
          
          if (i === selectedScrollTier) {
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
      
      // Update summon scroll counts to reflect current inventory
      setTimeout(() => {
        updateSummonScrollCounts();
        updateSelectedScrollTierBorder();
      }, 100);
      
      api.ui.components.createModal({
        title: 'Auto Scroller',
        width: 750,
        height: 400,
        content: contentDiv,
        buttons: [{ text: 'Close', primary: true }],
        onClose: () => {
          // Force stop autoscrolling when modal is closed
          if (autoscrolling) {
            autoscrolling = false; // Force stop the loop
            stopAutoscroll();
          }
          
          // Clear modal cache since modal is closing
          DOM_ELEMENTS.modal = null;
          
          // Save state before resetting
          AutoscrollerState.saveToStorage();
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
// MODULE 9: Inventory Integration & Button Management
// =======================
  // Optimized inventory observer with debouncing and filtering
  let inventoryObserver = null;
  let buttonCheckInterval = null;
  let lastButtonCheck = 0;
  let failedAttempts = 0;
  let hasLoggedInventoryNotFound = false;
  let observerDebounceTimeout = null;
  let lastObserverCheck = 0;
  const BUTTON_CHECK_INTERVAL = 1000;
  const BUTTON_CHECK_TIMEOUT = 10000;
  const LOG_AFTER_ATTEMPTS = 3;
  const OBSERVER_DEBOUNCE_DELAY = 250; // Debounce observer calls
  const OBSERVER_MIN_INTERVAL = 100; // Minimum time between observer checks

  function observeInventory() {
    if (inventoryObserver) {
      try { inventoryObserver.disconnect(); } catch (e) {}
      inventoryObserver = null;
    }
    
    if (buttonCheckInterval) {
      clearInterval(buttonCheckInterval);
      buttonCheckInterval = null;
    }
    
    if (observerDebounceTimeout) {
      clearTimeout(observerDebounceTimeout);
      observerDebounceTimeout = null;
    }
    
    lastButtonCheck = Date.now();
    buttonCheckInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastButtonCheck > BUTTON_CHECK_TIMEOUT) {
        clearInterval(buttonCheckInterval);
        buttonCheckInterval = null;
        return;
      }
      
      // Clear caches and add button
      clearCachesAndAddButton();
    }, BUTTON_CHECK_INTERVAL);
    
    inventoryObserver = new MutationObserver((mutations) => {
      const now = Date.now();
      
      // Debounce observer calls
      if (now - lastObserverCheck < OBSERVER_MIN_INTERVAL) {
        if (observerDebounceTimeout) {
          clearTimeout(observerDebounceTimeout);
        }
        observerDebounceTimeout = setTimeout(() => {
          processInventoryMutations(mutations);
        }, OBSERVER_DEBOUNCE_DELAY);
        return;
      }
      
      lastObserverCheck = now;
      processInventoryMutations(mutations);
    });
    
    inventoryObserver.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    addAutoscrollerButton();
  }
  
  // Process inventory mutations with optimized filtering
  function processInventoryMutations(mutations) {
    let shouldCheck = false;
    
    // Use a more efficient mutation filter
    for (const mutation of mutations) {
      // Skip if no added nodes
      if (mutation.addedNodes.length === 0) continue;
      
      // Check if any added node is relevant
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Use more specific checks to reduce false positives
          if (node.classList?.contains('container-inventory-4') ||
              (node.querySelector && (
                node.querySelector('.container-inventory-4') ||
                node.querySelector('button.focus-style-visible')
              ))) {
            shouldCheck = true;
            break;
          }
        }
      }
      
      if (shouldCheck) break;
    }
    
    if (shouldCheck) {
      clearCachesAndAddButton();
    }
  }
  
  // Centralized cache clearing and button adding
  function clearCachesAndAddButton() {
    DOMCache.clearInventoryCache();
    DOM_ELEMENTS.clear();
    addAutoscrollerButton();
  }
  
  function addAutoscrollerButton() {
    if (document.querySelector('.autoscroller-inventory-button')) {
      failedAttempts = 0;
      hasLoggedInventoryNotFound = false;
      return;
    }
    
    // Clear DOM cache when attempting to add button to ensure fresh lookups
    DOM_ELEMENTS.clear();
    
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
        hasLoggedInventoryNotFound = true;
      }
      return;
    }
    
    const autoButton = document.createElement('button');
    autoButton.className = 'focus-style-visible active:opacity-70 autoscroller-inventory-button';
    autoButton.innerHTML = `<div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image"><div class="has-rarity relative grid h-full place-items-center"><img alt="summon scroll" class="pixelated" width="32" height="32" src="https://bestiaryarena.com/assets/icons/summonscroll5.png"><div class="revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5"><span class="relative" style="line-height: 1; font-size: 16px; color: #fff; font-family: inherit;" translate="no">Auto</span></div></div></div>`;
        const handleAutoButtonClick = () => { showAutoscrollerModal(); };
    eventHandlers.add(autoButton, 'click', handleAutoButtonClick);
    
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
// MODULE 10: Cleanup & Exports
// =======================
  function cleanup() {
    if (autoscrolling) {
      stopAutoscroll();
    }
    
    if (buttonCheckInterval) {
      clearInterval(buttonCheckInterval);
      buttonCheckInterval = null;
    }
    
    if (observerDebounceTimeout) {
      clearTimeout(observerDebounceTimeout);
      observerDebounceTimeout = null;
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
    
    // Clear all caches
    DOMCache.clear();
    DOM_ELEMENTS.clear(); // Clear DOM element cache
    ALL_CREATURES_CACHE = null;
    clearMonsterCaches(); // Clear monster caches
    
    // Clear API queue
    clearApiQueue();
    
    // Clean up event handlers and UI updates
    eventHandlers.cleanup();
    eventHandlers.cancelUIUpdates();
  }
  
  // =======================
  // MODULE INITIALIZATION
  // =======================
  function initializeAutoscroller() {
    console.log('[Autoscroller] Initializing version 2.0 (Optimized)');
    
    // Load saved state from storage
    AutoscrollerState.loadFromStorage();
    
    // Initialize modules
    resetAutoscrollState();
    DOMCache.clear();
    clearApiQueue();
    
    if (config.enabled) {
      observeInventory();
          // Initialization complete
  } else {
    // Disabled in configuration
  }
  }
  
  // Start initialization
  initializeAutoscroller();
  
  // Clean up console logs for production
  if (typeof window !== 'undefined' && window.location.hostname === 'bestiaryarena.com') {
    // Override console.log to suppress non-essential logs in production
    const originalLog = console.log;
    console.log = function(...args) {
      // Only allow initialization and essential logs
      const message = args[0];
      if (typeof message === 'string' && (
        message.includes('[Autoscroller] Initializing') ||
        message.includes('[Autoscroller] Initialization complete') ||
        message.includes('[Autoscroller] Disabled in configuration') ||
        message.includes('[Autoscroller] State loaded from storage') ||
        message.includes('[Autoscroller] Modal closed') ||
        message.includes('[Autoscroller] Autoscroll stopped by user') ||
        message.includes('[Autoscroller] Error') ||
        message.includes('[Autoscroller] Failed to')
      )) {
        originalLog.apply(console, args);
      }
    };
  }
  
  if (typeof exports !== 'undefined') {
    exports.cleanup = cleanup;
  }
  
  if (typeof window !== 'undefined') {
    window.Autoscroller = window.Autoscroller || {};
    window.Autoscroller.cleanup = cleanup;
  }
  
  exports = {};
  
  /**
   * Retry selling monsters that failed due to rate limiting
   */
  async function retryFailedSales() {
    // Check if queue is being cleared - if so, stop operations
    if (isQueueClearing) {
      console.log('[Autoscroller] Queue is being cleared, stopping retry operations');
      return;
    }
    
    if (rateLimitedSales.size === 0) return;
    
            const monstersToRetry = Array.from(rateLimitedSales);
    
    for (const monsterId of monstersToRetry) {
      const retryCount = rateLimitedSalesRetryCount.get(monsterId) || 0;
      if (retryCount >= PERFORMANCE.SELL_MAX_RETRIES) {
        console.warn(`[Autoscroller] Removing monster ${monsterId} from retry queue - max retries exceeded`);
        rateLimitedSales.delete(monsterId);
        rateLimitedSalesRetryCount.delete(monsterId);
        continue;
      }
      
      try {
        const result = await sellMonster(monsterId, retryCount);
        if (result.success) {
          rateLimitedSales.delete(monsterId);
          rateLimitedSalesRetryCount.delete(monsterId);
          // Update statistics
          autoscrollStats.soldMonsters++;
          autoscrollStats.soldGold += result.goldValue;
          // Update local inventory with gold received
          updateLocalInventoryGoldDust(result.goldValue, 0);
          removeMonsterFromLocalInventory(monsterId);
      } else if (result.status === 429) {
        // Keep in retry queue
      } else {
        console.warn(`[Autoscroller] Failed to sell monster ${monsterId} on retry:`, result.message);
        rateLimitedSales.delete(monsterId);
        rateLimitedSalesRetryCount.delete(monsterId);
      }
      } catch (error) {
        console.error(`[Autoscroller] Error retrying sale of monster ${monsterId}:`, error);
        rateLimitedSales.delete(monsterId);
        rateLimitedSalesRetryCount.delete(monsterId);
      }
      
      // Small delay between retries
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  /**
   * Update the status display with comprehensive information
   */
  function updateStatusDisplay() {
    eventHandlers.scheduleUIUpdate(() => {
      const statusElement = getAutoscrollStatusElement();
      if (!statusElement) return;
      
      const tierName = STRING_CACHE.tierNames[selectedScrollTier - 1] || 'unknown';
      const totalFound = Array.from(autoscrollStats.foundCreatures.values()).reduce((sum, count) => sum + count, 0);
      
      // Session summary tracking (debug info removed for production)
      
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
      
      // Build message parts for better performance
      const messageParts = [];
      
      if (reachedCreature) {
        messageParts.push(`Found ${stopConditions.totalCreaturesTarget} ${reachedCreature}! Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls.`);
      } else {
        messageParts.push(`Rolled ${autoscrollStats.totalScrolls} ${tierName} summon scrolls. Found ${totalFound} selected creatures in this session.`);
      }
      
      // Add autosell statistics if any monsters were sold
      if (autosellNonSelected && autoscrollStats.soldMonsters > 0) {
        messageParts.push(` Sold ${autoscrollStats.soldMonsters} non-selected creatures for ${autoscrollStats.soldGold} gold.`);
      }
      
      // Add autosqueeze statistics if any monsters were squeezed
      if (autosellNonSelected && autoscrollStats.squeezedMonsters > 0) {
        messageParts.push(` Squeezed ${autoscrollStats.squeezedMonsters} non-selected creatures for ${autoscrollStats.squeezedDust} dust.`);
      }
      
      // Add rate limit information if there are pending sales
      if (autosellNonSelected && rateLimitedSales.size > 0) {
        messageParts.push(` (${rateLimitedSales.size} operations pending due to rate limits)`);
      }
      
      // Add rate limiting status
      if (consecutiveRateLimits > 0) {
        const timeSinceLastRateLimit = Date.now() - lastRateLimitTime;
        if (timeSinceLastRateLimit < 30000) { // Show for 30 seconds after rate limit
          messageParts.push(` [Rate limited ${consecutiveRateLimits}x]`);
        }
      }
      
      const message = messageParts.join('');
      
      statusElement.textContent = message;
    });
  }
})(); 