// =======================
// Bosses Mod for Bestiary Arena
// =======================
console.log('[Bosses Mod] Initializing...');

// =======================
// 1. Constants
// =======================

const BUTTON_CHECK_INTERVAL = 1000;
const BUTTON_CHECK_TIMEOUT = 10000;
const BUTTON_RETRY_MAX = 3;
const BUTTON_RETRY_DELAY = 250;
const OBSERVER_DEBOUNCE_DELAY = 250;
const OBSERVER_MIN_INTERVAL = 100;
const MODAL_WIDTH = 500;
const MODAL_HEIGHT = 180;

// Firebase configuration
const FIREBASE_CONFIG = {
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app'
};

// =======================
// Creature Products Configuration
// Maps creature gameId to their creature product drops
// =======================

const CREATURE_PRODUCTS_CONFIG = {
  // Dragon Lord (gameId: 26) - Normal creature
  26: {
    creatureName: 'Dragon Lord',
    products: [
      {
        name: 'Red Dragon Leather',
        icon: 'Red_Dragon_Leather.PNG',
        dropChance: 0.10, // 10% chance
        description: 'Obtained by defeating Dragon Lord'
      },
      {
        name: 'Red Dragon Scale',
        icon: 'Red_Dragon_Scale.PNG',
        dropChance: 0.10, // 10% chance
        description: 'Obtained by defeating Dragon Lord'
      }
    ]
  }
  // Add more creatures here in the future:
  // [gameId]: {
  //   creatureName: 'Creature Name',
  //   products: [
  //     { name: 'Product Name', icon: 'icon.gif', dropChance: 0.10, description: '...' }
  //   ]
  // }
};

// =======================
// 2. State & Observers
// =======================

(function() {
  let inventoryObserver = null;
  let buttonCheckInterval = null;
  let lastButtonCheck = 0;
  let failedAttempts = 0;
  let cachedExtensionBaseUrl = null;
  let observerDebounceTimeout = null;
  let lastObserverCheck = 0;
  let buttonRetryTimeout = null;
  let modalTimeout = null;
  let dialogTimeout = null;
  const buttonEventListeners = new Map(); // Track event listeners for cleanup
  
  // Creature products drop system state
  let creatureProductsBoardSubscription = null;
  let lastProcessedCreatureProductsSeed = null;

  // =======================
  // 3. Helper Functions
  // =======================

  // Translation helpers (same pattern as Mod Settings.js)
  const t = (key) => {
    if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
      return api.i18n.t(key);
    }
    return key;
  };

  const tReplace = (key, replacements) => {
    let text = t(key);
    Object.entries(replacements).forEach(([placeholder, value]) => {
      text = text.replace(`{${placeholder}}`, value);
    });
    return text;
  };

  // Helper to construct URL from base and path
  function constructUrl(base, path) {
    const normalizedBase = base.endsWith('/') ? base : base + '/';
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    return normalizedBase + normalizedPath;
  }

  // Helper function to get creature products asset URL
  function getCreatureProductsAssetUrl(filename) {
    const imagePath = '/assets/creatureproducts/' + filename;
    
    // Use cached base URL if available
    if (cachedExtensionBaseUrl) {
      return constructUrl(cachedExtensionBaseUrl, imagePath);
    }
    
    // Try multiple methods to get extension runtime URL
    try {
      const api = window.browserAPI || window.chrome || window.browser;
      if (api?.runtime?.id && api.runtime.id !== 'invalid' && api.runtime.getURL) {
        const url = api.runtime.getURL(imagePath);
        if (url?.includes('://') && !url.includes('://invalid')) {
          const baseUrlMatch = url.match(/^(chrome-extension|moz-extension):\/\/[^/]+\//);
          if (baseUrlMatch) {
            cachedExtensionBaseUrl = baseUrlMatch[0];
          }
          return url;
        }
      }
    } catch (e) {
      console.warn('[Bosses Mod] Error getting URL from browser API:', e);
    }
    
    // Try window.BESTIARY_EXTENSION_BASE_URL
    if (typeof window !== 'undefined' && window.BESTIARY_EXTENSION_BASE_URL) {
      cachedExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
    }
    
    if (cachedExtensionBaseUrl) {
      return constructUrl(cachedExtensionBaseUrl, imagePath);
    }
    
    // Last resort: return path
    console.warn('[Bosses Mod] Could not determine extension runtime URL, using relative path:', imagePath);
    return imagePath;
  }

  // Helper to clear timeouts/intervals
  function clearTimeoutOrInterval(value) {
    if (value) {
      clearTimeout(value);
      clearInterval(value);
    }
  }

  // Helper to check if element is in DOM
  function isInDOM(element) {
    return element && document.contains(element) && element.parentNode;
  }

  // Helper to create product icon image
  function createProductIcon(productDef, size = 32) {
    const iconImg = document.createElement('img');
    iconImg.src = getCreatureProductsAssetUrl(productDef.icon);
    iconImg.alt = productDef.name;
    iconImg.className = 'pixelated';
    iconImg.style.cssText = `width: ${size}px; height: ${size}px; image-rendering: pixelated;`;
    return iconImg;
  }

  // Helper to create count overlay
  function createCountOverlay(count) {
    const countOverlay = document.createElement('div');
    countOverlay.className = 'pointer-events-none absolute';
    countOverlay.style.cssText = 'position: absolute; bottom: 2px; right: 2px; pointer-events: none; display: flex; align-items: center;';
    const countSpan = document.createElement('span');
    countSpan.setAttribute('translate', 'no');
    countSpan.style.cssText = 'line-height: 1; font-size: 11px; font-family: Arial, Helvetica, sans-serif; color: white; font-weight: bold; text-shadow: 0px 0px 2px black;';
    countSpan.textContent = count.toLocaleString();
    countOverlay.appendChild(countSpan);
    return countOverlay;
  }

  // Helper to create empty placeholder slot
  function createEmptyPlaceholderSlot() {
    const containerSlot = document.createElement('div');
    containerSlot.className = 'container-slot surface-darker';
    containerSlot.setAttribute('data-hoverable', 'false');
    containerSlot.setAttribute('data-highlighted', 'false');
    containerSlot.setAttribute('data-disabled', 'false');
    containerSlot.style.cssText = 'width: 34px; height: 34px;';
    
    const rarityDiv = document.createElement('div');
    rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
    
    containerSlot.appendChild(rarityDiv);
    return containerSlot;
  }

  // Helper to create product slot container
  function createProductSlot(productDef, count, isSelected = false, rarity = 5) {
    const containerSlot = document.createElement('div');
    containerSlot.className = 'container-slot surface-darker';
    containerSlot.setAttribute('data-hoverable', 'true');
    containerSlot.setAttribute('data-highlighted', isSelected ? 'true' : 'false');
    containerSlot.setAttribute('data-disabled', 'false');
    containerSlot.style.cssText = 'width: 34px; height: 34px;';
    
    const rarityDiv = document.createElement('div');
    rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
    rarityDiv.setAttribute('data-rarity', String(rarity));
    
    const iconImg = createProductIcon(productDef, 32);
    rarityDiv.appendChild(iconImg);
    
    const countOverlay = createCountOverlay(count);
    rarityDiv.appendChild(countOverlay);
    
    containerSlot.appendChild(rarityDiv);
    return containerSlot;
  }

  // Helper to build product definitions from config
  function buildProductDefinitions() {
    const productDefinitions = [];
    for (const [creatureGameId, creatureConfig] of Object.entries(CREATURE_PRODUCTS_CONFIG)) {
      for (const product of creatureConfig.products) {
        if (!productDefinitions.find(p => p.name === product.name)) {
          productDefinitions.push(product);
        }
      }
    }
    productDefinitions.sort((a, b) => a.name.localeCompare(b.name));
    return productDefinitions;
  }

  // Helper to apply modal content div styles
  function applyModalContentStyles(element, width, height) {
    Object.assign(element.style, {
      width: '100%',
      height: '100%',
      maxWidth: `${width}px`,
      minHeight: `${height}px`,
      maxHeight: `${height}px`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      gap: '8px',
      color: 'rgb(230, 215, 176)'
    });
  }

  // =======================
  // Firebase API Functions
  // =======================

  function getApiUrl(endpoint) {
    return `${FIREBASE_CONFIG.firebaseUrl}/bosses/${endpoint}`;
  }

  function getCreatureProductsApiUrl() {
    return getApiUrl('creature-products');
  }

  // Get current player name
  function getCurrentPlayerName() {
    try {
      const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
      if (playerState?.name) {
        return playerState.name;
      }
      // Fallback methods
      if (window.gameState && window.gameState.player && window.gameState.player.name) {
        return window.gameState.player.name;
      }
      if (window.api && window.api.gameState && window.api.gameState.getPlayerName) {
        return window.api.gameState.getPlayerName();
      }
    } catch (error) {
      console.error('[Bosses Mod] Error getting current player name:', error);
    }
    return null;
  }

  // Hash username for Firebase key
  async function hashUsername(username) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(username.toLowerCase());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 32);
    } catch (error) {
      console.warn('[Bosses Mod] Username hashing failed, using fallback:', error);
      return username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
  }

  // =======================
  // Encryption Functions
  // =======================

  async function deriveCreatureProductsKey(username) {
    try {
      const encoder = new TextEncoder();
      const password = encoder.encode(username.toLowerCase());
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        password,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const salt = encoder.encode('creature-products-salt');
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      return key;
    } catch (error) {
      console.error('[Bosses Mod] Error deriving creature products key:', error);
      throw error;
    }
  }

  async function encryptCreatureProducts(productsObject, username) {
    try {
      const key = await deriveCreatureProductsKey(username);
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(productsObject));
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('[Bosses Mod] Error encrypting creature products:', error);
      throw error;
    }
  }

  async function decryptCreatureProducts(encryptedText, username) {
    try {
      if (!encryptedText || typeof encryptedText !== 'string') {
        return {};
      }
      
      let combined;
      try {
        combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      } catch (e) {
        return {};
      }
      
      if (combined.length < 13) {
        return {};
      }
      
      const key = await deriveCreatureProductsKey(username);
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(decrypted);
      const products = JSON.parse(jsonStr);
      return products || {};
    } catch (error) {
      console.warn('[Bosses Mod] Error decrypting creature products:', error);
      return {};
    }
  }

  // =======================
  // Firebase Request Helpers
  // =======================

  async function handleFirebaseResponse(response, errorContext, defaultReturn = null) {
    if (!response.ok) {
      if (response.status === 404) {
        return defaultReturn;
      }
      throw new Error(`Failed to ${errorContext}: ${response.status}`);
    }
    return await response.json();
  }

  async function firebaseRequest(endpoint, method, data = null, errorContext, defaultReturn = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data !== null) {
      options.body = JSON.stringify(data);
    }
    const response = await fetch(`${endpoint}.json`, options);
    return await handleFirebaseResponse(response, errorContext, defaultReturn);
  }

  // =======================
  // Creature Products Storage Functions
  // =======================

  async function getCreatureProducts() {
    try {
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        return {};
      }
      
      const hashedPlayer = await hashUsername(currentPlayer);
      const response = await fetch(`${getCreatureProductsApiUrl()}/${hashedPlayer}.json`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return {};
        }
        throw new Error(`Failed to fetch creature products: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || !data.encrypted) {
        return {};
      }
      
      return await decryptCreatureProducts(data.encrypted, currentPlayer);
    } catch (error) {
      console.error('[Bosses Mod] Error getting creature products:', error);
      return {};
    }
  }

  async function addCreatureProduct(productName, amount) {
    try {
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        throw new Error('Player name not available');
      }
      
      if (amount <= 0) {
        return;
      }
      
      const currentProducts = await getCreatureProducts();
      const currentCount = currentProducts[productName] || 0;
      const newCount = currentCount + amount;
      
      const updatedProducts = {
        ...currentProducts,
        [productName]: newCount
      };
      
      const encrypted = await encryptCreatureProducts(updatedProducts, currentPlayer);
      const hashedPlayer = await hashUsername(currentPlayer);
      
      console.log('[Bosses Mod][Creature Products] Saving to Firebase', { hashedPlayer, productName, amount, newCount });
      await firebaseRequest(
        `${getCreatureProductsApiUrl()}/${hashedPlayer}`,
        'PUT',
        { encrypted },
        'save creature products'
      );
      
      console.log(`[Bosses Mod][Creature Products] Added ${amount} ${productName}. New total: ${newCount}`);
      return updatedProducts;
    } catch (error) {
      console.error('[Bosses Mod][Creature Products] Error adding creature product:', error);
      throw error;
    }
  }

  // =======================
  // Deterministic Drop Calculation
  // =======================

  // Deterministic random function using seed (produces consistent results)
  // This makes drops verifiable and prevents manipulation
  function deterministicRandom(seed, creatureGameId, productIndex) {
    // Combine seed with creature and product identifiers for uniqueness
    const combined = seed + creatureGameId * 1000 + productIndex;
    
    // Simple hash function to create pseudo-random value
    let hash = 0;
    const str = combined.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Normalize to 0-1 range
    return Math.abs(hash) % 10000 / 10000;
  }

  // =======================
  // Creature Detection (serverResults ONLY)
  // =======================

  // Get creature gameId from serverResults (from monsterDrop)
  function getCreatureGameId(serverResults) {
    if (!serverResults || !serverResults.rewardScreen) {
      return null;
    }

    const rewardScreen = serverResults.rewardScreen;
    
    // Check monsterDrop.gameId in rewardScreen
    if (rewardScreen.monsterDrop && typeof rewardScreen.monsterDrop.gameId === 'number') {
      return rewardScreen.monsterDrop.gameId;
    }
    
    // Also check serverResults.monsterDrop (might be at top level)
    if (serverResults.monsterDrop && typeof serverResults.monsterDrop.gameId === 'number') {
      return serverResults.monsterDrop.gameId;
    }
    
    return null;
  }

  // Check if defeated creature has creature product drops configured
  function getCreatureProductsConfig(creatureGameId) {
    if (!creatureGameId || !CREATURE_PRODUCTS_CONFIG[creatureGameId]) {
      return null;
    }
    return CREATURE_PRODUCTS_CONFIG[creatureGameId];
  }

  // =======================
  // Drop System
  // =======================

  function setupCreatureProductsDropSystem() {
    if (creatureProductsBoardSubscription) {
      return; // Already set up
    }
    
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      console.log('[Bosses Mod] Setting up creature products drop system...');
      creatureProductsBoardSubscription = globalThis.state.board.subscribe(({ context }) => {
        const serverResults = context.serverResults;
        if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
          return;
        }
        
        // Only drop on victories
        if (!serverResults.rewardScreen.victory) {
          return;
        }
        
        const seed = serverResults.seed;
        
        // Skip duplicate seeds
        if (seed === lastProcessedCreatureProductsSeed) {
          return;
        }
        
        lastProcessedCreatureProductsSeed = seed;
        
        // Get creature gameId from serverResults (from monsterDrop)
        const creatureGameId = getCreatureGameId(serverResults);
        
        if (!creatureGameId) {
          console.log('[Bosses Mod][Creature Products] Victory detected but no creature gameId found, seed:', seed);
          return;
        }
        
        // Check if this creature has creature product drops configured
        const creatureConfig = getCreatureProductsConfig(creatureGameId);
        
        if (!creatureConfig) {
          console.log(`[Bosses Mod][Creature Products] Victory detected but creature (gameId: ${creatureGameId}) has no creature products configured, seed:`, seed);
          return;
        }
        
        console.log(`[Bosses Mod][Creature Products] ${creatureConfig.creatureName} victory detected (gameId: ${creatureGameId}), seed:`, seed);
        
        // Process each product drop for this creature using deterministic calculation
        creatureConfig.products.forEach((product, productIndex) => {
          const roll = deterministicRandom(seed, creatureGameId, productIndex);
          console.log(`[Bosses Mod][Creature Products] ${product.name} roll: ${roll.toFixed(4)} (chance: ${product.dropChance})`);
          if (roll <= product.dropChance) {
            addCreatureProduct(product.name, 1).then(() => {
              showCreatureProductNotification(product.name, 1);
              console.log(`[Bosses Mod][Creature Products] ${product.name} awarded from ${creatureConfig.creatureName}`);
            }).catch((error) => {
              console.error(`[Bosses Mod][Creature Products] Error adding ${product.name}:`, error);
            });
          }
        });
      });
    }
  }

  // =======================
  // Notification System
  // =======================

  function showCreatureProductNotification(productName, amount) {
    try {
      // Get or create the main toast container
      let mainContainer = document.getElementById('creature-products-toast-container');
      if (!mainContainer) {
        mainContainer = document.createElement('div');
        mainContainer.id = 'creature-products-toast-container';
        mainContainer.style.cssText = `
          position: fixed;
          z-index: 9999;
          inset: 16px 16px 64px;
          pointer-events: none;
        `;
        document.body.appendChild(mainContainer);
      }
      
      // Count existing toasts to calculate stacking position
      const existingToasts = mainContainer.querySelectorAll('.toast-item');
      const stackOffset = existingToasts.length * 46;
      
      // Create the flex container for this specific toast
      const flexContainer = document.createElement('div');
      flexContainer.className = 'toast-item';
      flexContainer.style.cssText = `
        left: 0px;
        right: 0px;
        display: flex;
        position: absolute;
        transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1);
        transform: translateY(-${stackOffset}px);
        bottom: 0px;
        justify-content: flex-end;
      `;
      
      // Create toast button
      const toast = document.createElement('button');
      toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
      
      // Create widget structure
      const widgetTop = document.createElement('div');
      widgetTop.className = 'widget-top h-2.5';
      
      const widgetBottom = document.createElement('div');
      widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
      
      // Add product icon
      const productDef = buildProductDefinitions().find(p => p.name === productName);
      if (productDef) {
        const iconImg = createProductIcon(productDef, 16);
        widgetBottom.appendChild(iconImg);
      }
      
      // Add message
      const messageDiv = document.createElement('div');
      messageDiv.className = 'text-left';
      messageDiv.textContent = tReplace('mods.bosses.productObtained', { productName, amount });
      widgetBottom.appendChild(messageDiv);
      
      // Assemble toast
      toast.appendChild(widgetTop);
      toast.appendChild(widgetBottom);
      flexContainer.appendChild(toast);
      mainContainer.appendChild(flexContainer);
      
      console.log(`[Bosses Mod] Toast shown: ${tReplace('mods.bosses.productObtained', { productName, amount })}`);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (flexContainer && flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          
          // Update positions of remaining toasts
          const toasts = mainContainer.querySelectorAll('.toast-item');
          toasts.forEach((toast, index) => {
            const offset = index * 46;
            toast.style.transform = `translateY(-${offset}px)`;
          });
        }
      }, 3000);
      
    } catch (error) {
      console.error('[Bosses Mod] Error showing creature product toast:', error);
    }
  }

  function clearAllTimeouts() {
    clearTimeoutOrInterval(buttonCheckInterval);
    clearTimeoutOrInterval(buttonRetryTimeout);
    clearTimeoutOrInterval(observerDebounceTimeout);
    clearTimeoutOrInterval(modalTimeout);
    clearTimeoutOrInterval(dialogTimeout);
    buttonCheckInterval = null;
    buttonRetryTimeout = null;
    observerDebounceTimeout = null;
    modalTimeout = null;
    dialogTimeout = null;
  }

  // Helper to remove event listener from button
  function removeButtonEventListener(button) {
    if (!button) return;
    const listener = buttonEventListeners.get(button);
    if (listener) {
      try {
        button.removeEventListener('click', listener);
      } catch (e) {
        // Silently ignore if button is already removed
      }
      buttonEventListeners.delete(button);
    }
  }

  // =======================
  // 4. DOM Observation & Mutation Handling
  // =======================

  function observeInventory() {
    if (inventoryObserver) {
      try { inventoryObserver.disconnect(); } catch (e) {}
      inventoryObserver = null;
    }
    
    clearAllTimeouts();
    
    lastButtonCheck = Date.now();
    buttonCheckInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastButtonCheck > BUTTON_CHECK_TIMEOUT) {
        clearInterval(buttonCheckInterval);
        buttonCheckInterval = null;
        return;
      }
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
    
    addCreatureProductsButton();
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
  function clearCachesAndAddButton(retry = 0) {
    if (buttonRetryTimeout) {
      clearTimeout(buttonRetryTimeout);
      buttonRetryTimeout = null;
    }
    const added = addCreatureProductsButton();
    if (!added && retry < BUTTON_RETRY_MAX) {
      buttonRetryTimeout = setTimeout(() => {
        clearCachesAndAddButton(retry + 1);
      }, BUTTON_RETRY_DELAY);
    }
  }

  // =======================
  // 5. Button Management
  // =======================

  function addCreatureProductsButton() {
    const existingButton = document.querySelector('.creature-products-inventory-button');
    if (existingButton) {
      // If button exists but listener is missing, re-add it
      if (!buttonEventListeners.has(existingButton)) {
        const clickHandler = () => {
          showCreatureProductsModal();
        };
        existingButton.addEventListener('click', clickHandler);
        buttonEventListeners.set(existingButton, clickHandler);
      }
      failedAttempts = 0;
      return true;
    }
    
    // Clean up any orphaned listeners (buttons removed by framework)
    for (const [button, listener] of buttonEventListeners.entries()) {
      if (!document.contains(button)) {
        buttonEventListeners.delete(button);
      }
    }
    
    const isOnInventoryPage = document.querySelector('.container-inventory-4') || 
                             document.querySelector('[data-page="inventory"]') ||
                             window.location.pathname.includes('inventory');
    
    if (!isOnInventoryPage) {
      return false;
    }
    
    const inventoryContainer = document.querySelector('.container-inventory-4');
    if (!inventoryContainer) {
      failedAttempts++;
      return false;
    }
    
    // Find the backpack button with item ID 10327
    const allButtons = Array.from(inventoryContainer.querySelectorAll('button.focus-style-visible.active\\:opacity-70'));
    const backpackButton = allButtons.find(button => {
      const spriteDiv = button.querySelector('.id-10327');
      return spriteDiv !== null && !button.classList.contains('creature-products-inventory-button');
    });
    
    if (!backpackButton) {
      failedAttempts++;
      return false;
    }
    
    // Check if backpack button is still connected to DOM
    if (!isInDOM(backpackButton)) {
      return false;
    }
    
    const creatureProductsButton = document.createElement('button');
    creatureProductsButton.className = 'focus-style-visible active:opacity-70 creature-products-inventory-button';
    
    const inventoryBorderStyle = window.betterUIConfig?.inventoryBorderStyle || 'Original';
    const borderDiv = window.getInventoryBorderStyle ? window.getInventoryBorderStyle(inventoryBorderStyle) : '';
    
    const imageUrl = getCreatureProductsAssetUrl('Fur_Backpack.gif');
    
    creatureProductsButton.innerHTML = `
      <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image">
        <div class="relative grid h-full place-items-center">
          ${borderDiv}
          <img alt="creature products" class="pixelated" width="32" height="32" src="${imageUrl}">
        </div>
      </div>
    `;
    
    // Store event listener reference for cleanup
    const clickHandler = () => {
      showCreatureProductsModal();
    };
    creatureProductsButton.addEventListener('click', clickHandler);
    buttonEventListeners.set(creatureProductsButton, clickHandler);
    
    try {
      // Double-check target is still in DOM before inserting
      if (isInDOM(backpackButton)) {
        backpackButton.insertAdjacentElement('afterend', creatureProductsButton);
        failedAttempts = 0;
        clearAllTimeouts();
      } else {
        return false;
      }
    } catch (error) {
      console.error('[Bosses Mod] Error adding creature products button:', error);
      return false;
    }
    
    return true;
  }

  // =======================
  // 6. Modal Management
  // =======================

  function applyDialogStyles(dialog, width, height) {
    dialog.style.width = `${width}px`;
    dialog.style.minWidth = `${width}px`;
    dialog.style.maxWidth = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.minHeight = `${height}px`;
    dialog.style.maxHeight = `${height}px`;
    
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
    box.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
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
    contentWrapper.style.padding = '8px';
    
    if (typeof content === 'string') {
      contentWrapper.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentWrapper.appendChild(content);
    }
    box.appendChild(contentWrapper);
    return box;
  }

  async function showCreatureProductsModal() {
    // Clear any pending modal timeouts
    clearTimeoutOrInterval(modalTimeout);
    clearTimeoutOrInterval(dialogTimeout);
    
    // Close any existing modals first (like Autoscroller does)
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    
    modalTimeout = setTimeout(async () => {
      const contentDiv = document.createElement('div');
      applyModalContentStyles(contentDiv, MODAL_WIDTH, MODAL_HEIGHT);
      
      // Show loading state
      const loadingDiv = document.createElement('div');
      loadingDiv.textContent = t('mods.bosses.loading');
      loadingDiv.style.cssText = 'width: 100%; text-align: center; padding: 20px; color: rgb(230, 215, 176);';
      contentDiv.appendChild(loadingDiv);
      
      api.ui.components.createModal({
        title: t('mods.bosses.modalTitle'),
        width: MODAL_WIDTH,
        height: MODAL_HEIGHT,
        content: contentDiv,
        buttons: [{ text: t('mods.bosses.close'), primary: true }]
      });
      
      dialogTimeout = setTimeout(() => {
        const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          applyDialogStyles(dialog, MODAL_WIDTH, MODAL_HEIGHT);
        }
        dialogTimeout = null;
      }, 0);
      
      // Fetch and display creature products
      try {
        const products = await getCreatureProducts();
        
        // Clear loading message
        contentDiv.innerHTML = '';
        applyModalContentStyles(contentDiv, MODAL_WIDTH, MODAL_HEIGHT);
        
        // Build product definitions from configuration
        const productDefinitions = buildProductDefinitions();
        
        // Left column: Product list container
        const productsListContainer = document.createElement('div');
        productsListContainer.style.cssText = `
          display: grid;
          grid-template-columns: repeat(auto-fill, 34px);
          gap: 2px;
          overflow-y: auto;
          overflow-x: hidden;
          height: 100%;
          align-content: start;
        `;
        
        // Right column: Product details container
        const detailsContainer = document.createElement('div');
        detailsContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 8px;
          overflow-y: auto;
          height: 100%;
        `;
        
        let selectedProduct = null;
        let selectedProductElement = null;
        
        // Function to show placeholder
        const showPlaceholder = () => {
          detailsContainer.innerHTML = '';
          
          // Icon and name in horizontal layout (same structure as selected product)
          const iconNameContainer = document.createElement('div');
          iconNameContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;';
          
          // Empty placeholder slot on the left
          const placeholderSlot = createEmptyPlaceholderSlot();
          iconNameContainer.appendChild(placeholderSlot);
          
          // Empty space on the right (to match layout)
          const emptySpace = document.createElement('div');
          emptySpace.style.cssText = 'flex: 1;';
          iconNameContainer.appendChild(emptySpace);
          
          detailsContainer.appendChild(iconNameContainer);
          
          // Empty description frame (same structure as selected product)
          const descFrame = document.createElement('div');
          descFrame.style.cssText = `
            min-height: 72px;
            padding: 2px 4px;
            width: 100%;
            box-sizing: border-box;
            background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat;
            border: 4px solid transparent;
            border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch;
          `;
          detailsContainer.appendChild(descFrame);
        };

        // Function to update details panel
        const updateDetailsPanel = (productDef) => {
          const count = products[productDef.name] || 0;
          
          detailsContainer.innerHTML = '';
          
          // Icon and name in horizontal layout
          const iconNameContainer = document.createElement('div');
          iconNameContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;';
          
          // Icon on the left
          const productSlot = createProductSlot(productDef, count, false);
          iconNameContainer.appendChild(productSlot);
          
          // Name on the right
          const nameDiv = document.createElement('div');
          nameDiv.textContent = productDef.name;
          nameDiv.style.cssText = 'font-size: 14px; font-weight: bold; color: rgb(230, 215, 176); flex: 1;';
          iconNameContainer.appendChild(nameDiv);
          
          detailsContainer.appendChild(iconNameContainer);
          
          // Description in frame
          const descFrame = document.createElement('div');
          descFrame.style.cssText = `
            min-height: 72px;
            padding: 2px 4px;
            width: 100%;
            box-sizing: border-box;
            background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat;
            border: 4px solid transparent;
            border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch;
          `;
          const descDiv = document.createElement('div');
          descDiv.textContent = productDef.description;
          descDiv.style.cssText = 'font-size: 11px; color: rgb(150, 150, 150); font-style: italic; text-align: center;';
          descFrame.appendChild(descDiv);
          
          // Drop chance inside description frame
          const chanceDiv = document.createElement('div');
          chanceDiv.textContent = `Drop Chance: ${(productDef.dropChance * 100).toFixed(1)}%`;
          chanceDiv.style.cssText = 'font-size: 11px; color: rgb(180, 180, 180); text-align: center;';
          descFrame.appendChild(chanceDiv);
          detailsContainer.appendChild(descFrame);
        };
        
        // Create product items for left column
        let hasAnyProducts = false;
        
        for (const productDef of productDefinitions) {
          const count = products[productDef.name] || 0;
          
          // Create clickable product item button
          const productItem = document.createElement('button');
          productItem.style.cssText = `
            padding: 0;
            border: none;
            background: none;
            cursor: pointer;
            width: 34px;
            height: 34px;
          `;
          
          // Create container-slot structure like item portraits
          const containerSlot = createProductSlot(productDef, count, selectedProductElement === productItem);
          productItem.appendChild(containerSlot);
          
          // Click handler
          productItem.addEventListener('click', () => {
            // If clicking the already selected product, deselect it
            if (selectedProductElement === productItem) {
              containerSlot.setAttribute('data-highlighted', 'false');
              containerSlot.style.border = '';
              selectedProduct = null;
              selectedProductElement = null;
              showPlaceholder();
              return;
            }
            
            // Update selected state - clear white border from previous selection
            if (selectedProductElement) {
              const prevSlot = selectedProductElement.querySelector('[data-highlighted]');
              if (prevSlot) {
                prevSlot.setAttribute('data-highlighted', 'false');
                prevSlot.style.border = '';
              }
            }
            
            selectedProduct = productDef;
            selectedProductElement = productItem;
            containerSlot.setAttribute('data-highlighted', 'true');
            containerSlot.style.border = '1px solid white';
            containerSlot.style.boxSizing = 'border-box';
            
            // Update details panel
            updateDetailsPanel(productDef);
          });
          
          // Hover effects
          productItem.addEventListener('mouseenter', () => {
            if (productItem !== selectedProductElement) {
              containerSlot.setAttribute('data-hoverable', 'true');
            }
          });
          
          productsListContainer.appendChild(productItem);
          hasAnyProducts = true;
        }
        
        // Create boxes with titles and backgrounds
        if (hasAnyProducts) {
          const productsBox = createBox({
            title: 'Products',
            content: productsListContainer
          });
          productsBox.style.width = '180px';
          productsBox.style.flexShrink = '0';
          
          const detailsBox = createBox({
            title: 'Details',
            content: detailsContainer
          });
          detailsBox.style.width = '280px';
          detailsBox.style.flexShrink = '0';
          
          contentDiv.appendChild(productsBox);
          contentDiv.appendChild(detailsBox);
          
          // Show initial placeholder
          showPlaceholder();
        } else {
          const emptyBox = createBox({
            title: 'Products',
            content: `<div style="text-align: center; padding: 40px 20px; color: rgb(150, 150, 150); font-style: italic;">${t('mods.bosses.emptyState')}</div>`
          });
          emptyBox.style.width = '100%';
          contentDiv.appendChild(emptyBox);
        }
        
      } catch (error) {
        console.error('[Bosses Mod] Error loading creature products:', error);
        contentDiv.innerHTML = '';
        const errorBox = createBox({
          title: 'Products',
          content: `<div style="text-align: center; padding: 20px; color: rgb(255, 100, 100);">${t('mods.bosses.errorLoading')}</div>`
        });
        errorBox.style.width = '100%';
        contentDiv.appendChild(errorBox);
      }
      
      modalTimeout = null;
    }, 50);
  }

  // =======================
  // 7. Cleanup & Initialization
  // =======================

  function cleanup() {
    if (inventoryObserver) {
      try { 
        inventoryObserver.disconnect(); 
      } catch (e) {
        console.warn('[Bosses Mod] Error disconnecting inventory observer:', e);
      }
      inventoryObserver = null;
    }
    
    // Cleanup creature products drop system
    if (creatureProductsBoardSubscription) {
      try {
        creatureProductsBoardSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Bosses Mod] Error unsubscribing from board:', e);
      }
      creatureProductsBoardSubscription = null;
    }
    lastProcessedCreatureProductsSeed = null;
    
    clearAllTimeouts();
    failedAttempts = 0;
    
    // Remove event listeners and buttons
    const buttons = document.querySelectorAll('.creature-products-inventory-button');
    buttons.forEach(btn => {
      try {
        // Remove event listener first
        removeButtonEventListener(btn);
        // Then remove button from DOM
        if (isInDOM(btn)) {
          btn.remove();
        }
      } catch (e) {
        // Silently ignore - button may have already been removed by framework
      }
    });
    
    // Clear event listener map
    buttonEventListeners.clear();
  }

  // Initialize
  observeInventory();
  setupCreatureProductsDropSystem();
  
  // Cleanup on mod unload
  if (typeof context !== 'undefined' && context.exports) {
    const originalCleanup = context.exports.cleanup;
    context.exports.cleanup = function() {
      cleanup();
      if (originalCleanup) originalCleanup();
    };
  }
})();
