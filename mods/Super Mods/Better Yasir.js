// =======================
// 0. Version & Metadata
// =======================
(function() {
  
// =======================
// 1. Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  // Performance constants
  const CONSTANTS = {
    DEBOUNCE_DELAY: 50, // Reduced from 100ms for faster response
    RETRY_MAX_ATTEMPTS: 5,
    RETRY_BASE_DELAY: 100,
    RETRY_DELAY: 500,
    ERROR_DISPLAY_DURATION: 5000,
    MAX_INPUT_WIDTH: 50
  };
  
  // DOM selectors cache
  const SELECTORS = {
    YASIR_MODAL: '.widget-bottom',
    SHOP_TABLE: 'table',
    SHOP_ROW: 'tbody tr',
    ITEM_SLOT: '.container-slot',
    BUY_BUTTON: 'button',
    SELL_BUTTON: 'button',
    SECTION_HEADER: '.widget-top',
    SECTION_CONTENT: '.widget-bottom',
    SECTIONS: '.w-full',
    DICE_MANIPULATOR_SPRITE: '.sprite.item',
    RARITY_ELEMENT: '[data-rarity]',
    EXALTATION_CHEST_IMG: 'img[src*="exaltation-chest"]',
    DUST_IMG: 'img[src*="dust-large"]',
    STONE_OF_INSIGHT_SPRITE: '.sprite.item'
  };
  
  // DOM cache for frequently accessed elements
  const domCache = new Map();
  const CACHE_TTL = 15000; // 15 seconds cache time (reduced from 30s for better responsiveness)
  
  // DOM cache management
  function getCachedElement(selector, context = document) {
    const cacheKey = `${selector}-${context.uid || 'document'}`;
    const cached = domCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.element;
    }
    
    const element = context.querySelector(selector);
    if (element) {
      domCache.set(cacheKey, { element, timestamp: Date.now() });
    }
    return element;
  }
  
  function getCachedElements(selector, context = document) {
    const cacheKey = `${selector}-all-${context.uid || 'document'}`;
    const cached = domCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.elements;
    }
    
    const elements = Array.from(context.querySelectorAll(selector));
    domCache.set(cacheKey, { elements, timestamp: Date.now() });
    return elements;
  }
  
  function clearDomCache() {
    domCache.clear();
  }
  
  function invalidateCacheForElement(element) {
    // Remove any cache entries that reference this element
    for (const [key, value] of domCache.entries()) {
      if (value.element === element || (value.elements && value.elements.includes(element))) {
        domCache.delete(key);
      }
    }
  }
  
  // Event listener management
  const eventListeners = new Map();
  let confirmationOutsideHandler = null;
  let observer = null;
  let observerTimeout = null;
  
  // Track processed elements to prevent re-processing
  const processedElements = new WeakSet();
  
  // Cache item key detection results
  let itemKeyCache = new WeakMap();
  
  // Centralized event listener management
  function addManagedEventListener(element, event, handler, options = {}) {
    const key = `${element.uid || Math.random()}-${event}`;
    eventListeners.set(key, { element, event, handler, options });
    element.addEventListener(event, handler, options);
    return key;
  }
  
  function removeManagedEventListener(key) {
    const listener = eventListeners.get(key);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      eventListeners.delete(key);
    }
  }
  
  function cleanupAllEventListeners() {
    eventListeners.forEach((listener, key) => {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
    });
    eventListeners.clear();
  }
  
  // Cleanup confirmation handler
  function cleanupConfirmationHandler() {
    if (confirmationOutsideHandler) {
      document.removeEventListener('click', confirmationOutsideHandler, true);
      confirmationOutsideHandler = null;
    }
  }
  
  // Cleanup observer and timeouts
  function cleanupObservers() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (observerTimeout) {
      clearTimeout(observerTimeout);
      observerTimeout = null;
    }
  }
  
  // CSS styles for the quantity input and action buttons
  const QUANTITY_INPUT_STYLES = `
    .better-yasir-quantity-input {
      width: 100%;
      max-width: ${CONSTANTS.MAX_INPUT_WIDTH}px;
      height: 20px;
      background-image: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png');
      background-size: auto;
      background-repeat: repeat;
      background-position: center;
      border: none;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      text-align: center;
      padding: 2px;
      margin-bottom: 1px;
      border-radius: 2px;
      display: block;
      position: relative;
    }
    
    .better-yasir-quantity-input::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center;
      z-index: -1;
      border-radius: 4px;
    }
    .better-yasir-quantity-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(106, 106, 106, 0.5);
    }
    .better-yasir-quantity-input::-webkit-inner-spin-button,
    .better-yasir-quantity-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .better-yasir-action-button {
      /* Only override specific behaviors, let original classes handle styling */
      transition: all 0.1s ease !important;
    }
    
    /* Confirmation highlight */
    .better-yasir-action-button.confirm {
      background-image: url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') !important;
      border: 1px solid #32cd32 !important;
      box-shadow: 0 0 8px rgba(50, 205, 50, 0.6) !important;
    }

  `;
  
// =======================
// 2. Utility Functions
// =======================

  // Centralized error handling with different severity levels
  function handleError(error, context = '', severity = 'error') {
    const prefix = '[Better Yasir]';
    const message = context ? `${prefix} ${context}:` : prefix;
    
    switch (severity) {
      case 'warn':
        console.warn(message, error);
        break;
      case 'info':
        console.info(message, error);
        break;
      default:
        console.error(message, error);
    }
  }
  
  // Safe execution wrapper for functions that might throw
  function safeExecute(fn, context = '', fallback = null) {
    try {
      return fn();
    } catch (error) {
      handleError(error, context);
      return fallback;
    }
  }
  
  // Common DOM query utilities
  const domUtils = {
    // Find Yasir modal with multiple fallback strategies
    findYasirModal() {
      // Method 1: Look for enhanced modal
      let modal = document.querySelector(`${SELECTORS.YASIR_MODAL}[data-better-yasir-enhanced]`);
      if (modal) return modal;
      
      // Method 2: Look for any widget-bottom containing Yasir content
      const widgetBottoms = document.querySelectorAll('.widget-bottom');
      for (const widget of widgetBottoms) {
        const text = widget.textContent || '';
        if (text.includes('Yasir') && (text.includes('Buy') || text.includes('Sell') || text.includes('Exchange'))) {
          return widget;
        }
      }
      
      // Method 3: Look for any element with our custom inputs
      const inputs = document.querySelectorAll('.better-yasir-quantity-input');
      if (inputs.length > 0) {
        return inputs[0].closest('.widget-bottom') || inputs[0].closest('[role="dialog"]') || document.body;
      }
      
      return null;
    },
    
    // Find flex containers that need enhancement
    findFlexContainers() {
      return document.querySelectorAll('div.flex.items-center.gap-1\\.5.dithered.px-1, div.flex.items-center.gap-1\\.5');
    },
    
    // Check if element is already processed
    isProcessed(element) {
      return processedElements.has(element) || 
             element.querySelector('.better-yasir-quantity-input') ||
             element.dataset.betterYasirWrapper;
    },
    
    // Get table context information
    getTableContext(container) {
      const tableRow = container.closest('tr');
      const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
      const isExchangeSection = tableHeader?.textContent?.includes('Exchange') || 
                               tableHeader?.textContent?.includes('Sell');
      
      return { tableRow, tableHeader, isExchangeSection };
    }
  };

  // Generic cache manager
  const cacheManager = {
    caches: new Map(),
    
    get(key, ttl = 1000) {
      const cached = this.caches.get(key);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
      return null;
    },
    
    set(key, data, ttl = 1000) {
      this.caches.set(key, { data, timestamp: Date.now() });
    },
    
    clear() {
      this.caches.clear();
    }
  };
  
  // Safe game state access with caching
  function getGameState() {
    // Only load if Yasir modal is present or likely to be present
    if (!document.querySelector('.widget-bottom') && 
        !document.querySelector('h2 p')?.textContent?.includes('Yasir')) {
      return null;
    }
    
    const cached = cacheManager.get('gameState', 1000);
    if (cached) return cached;
    
    try {
      const playerState = globalThis.state?.player?.getSnapshot()?.context;
      const dailyState = globalThis.state?.daily?.getSnapshot()?.context;
      const globalState = globalThis.state?.global?.getSnapshot()?.context;
      
      const stateData = { playerState, dailyState, globalState };
      cacheManager.set('gameState', stateData, 1000);
      
      return stateData;
    } catch (error) {
      handleError(error, 'Error accessing game state');
      return null;
    }
  }
  
  // Get Yasir's shop data from daily state
  function getYasirShopData() {
    // Only load if Yasir modal is present
    if (!document.querySelector('.widget-bottom')) {
      return {};
    }
    
    const cached = cacheManager.get('yasirShopData', 3000);
    if (cached) return cached;
    
    try {
      const gameState = getGameState();
      const yasirData = gameState?.dailyState?.yasir || {};
      
      cacheManager.set('yasirShopData', yasirData, 3000);
      return yasirData;
    } catch (error) {
      handleError(error, 'Error accessing Yasir shop data');
      return {};
    }
  }
  
  // Get inventory specifically
  function getInventoryState() {
    const cached = cacheManager.get('inventoryState', 1000);
    if (cached) return cached;
    
    try {
      const gameState = getGameState();
      const inventory = gameState?.playerState?.inventory || {};
      
      cacheManager.set('inventoryState', inventory, 1000);
      return inventory;
    } catch (error) {
      handleError(error, 'Error accessing inventory state');
      return {};
    }
  }

  // Get player's dust amount with caching
  function getPlayerDust() {
    const cached = cacheManager.get('playerDust', 500);
    if (cached !== null) return cached;
    
    try {
      const gameState = getGameState();
      const dust = gameState?.playerState?.dust || 0;
      
      cacheManager.set('playerDust', dust, 500);
      return dust;
    } catch (error) {
      handleError(error, 'Error accessing player dust');
      return 0;
    }
  }
  
  // Get player's gold amount with caching
  function getPlayerGold() {
    const cached = cacheManager.get('playerGold', 500);
    if (cached !== null) return cached;
    
    try {
      const gameState = getGameState();
      const gold = gameState?.playerState?.gold || 0;
      
      cacheManager.set('playerGold', gold, 500);
      return gold;
    } catch (error) {
      handleError(error, 'Error accessing player gold');
      return 0;
    }
  }
  
  // Get minimum quantity from DOM for an item
  function getMinimumQuantityFromDOM(itemSlot) {
    return safeExecute(() => {
      if (!itemSlot) return 1;
      
      // Look for the quantity indicator in the item slot
      const quantityIndicator = itemSlot.querySelector('.revert-pixel-font-spacing');
      if (quantityIndicator) {
        const quantitySpan = quantityIndicator.querySelector('span');
        if (quantitySpan) {
          const quantityText = quantitySpan.textContent;
          const match = quantityText.match(/(\d+)x/);
          if (match) {
            const minQuantity = parseInt(match[1]);
            return minQuantity;
          }
        }
      }
      
      return 1; // Default to 1 if no quantity found
    }, 'Error getting minimum quantity from DOM', 1);
  }
  
  // Get item price from Yasir API data
  function getItemPriceFromAPI(itemKey) {
    try {
      const yasirData = getYasirShopData();
      
      // For dice manipulators, use the diceCost from API
      if (itemKey && itemKey.startsWith('diceManipulator')) {
        const diceCost = yasirData?.diceCost;
        if (diceCost !== undefined) {
          return diceCost;
        }
      }
      
      // For exaltation chest, we need to check if it's available and get its price
      if (itemKey === 'exaltationChest') {
        // Check if exaltation chest is available in the API data
        // For now, return a default price or check if it's in stock
        return null; // Will fall back to DOM method
      }
      
      return null; // Will fall back to DOM method
    } catch (error) {
      handleError(error, 'Error getting item price from API');
      return null;
    }
  }
  
  // Get item price with API fallback to DOM
  function getItemPriceWithFallback(itemKey, container = null) {
    // For dice manipulators, always use API data to ensure correct currency icon
    if (itemKey && itemKey.startsWith('diceManipulator')) {
      const yasirData = getYasirShopData();
      const diceCost = yasirData?.diceCost || 0;
      let minQuantity = 10; // Default minimum quantity
      if (container) {
        const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
        minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
      } else {
        // Try to find the item slot in the document if no container provided
        const itemSlot = document.querySelector(`[data-item-key="${itemKey}"]`);
        if (itemSlot) {
          minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
        }
      }
      const totalPrice = diceCost * minQuantity;
      return totalPrice;
    }
    
    // Try API first for other items
    const apiPrice = getItemPriceFromAPI(itemKey);
    if (apiPrice !== null) {
      return apiPrice;
    }
    
    // Fall back to DOM method if container is provided
    if (container) {
      const domPrice = getItemPriceFromNextCell(container);
      return domPrice;
    }
    
    return 0;
  }
  
  // Update local inventory based on API response (write into playerContext.inventory)
  function updateLocalInventory(inventoryDiff) {
    try {
      queueStateUpdate(inventoryDiff);
    } catch (error) {
      handleError(error, 'Failed to queue inventory update');
    }
  }
  
  // Calculate max quantity for buy items based on available resources
  function calculateMaxQuantity(itemKey, itemPrice, itemSlot, currentDust, currentGold) {
    if (itemKey && itemKey.startsWith('diceManipulator')) {
      // For dice manipulators, use gold
      const yasirData = getYasirShopData();
      const diceCost = yasirData?.diceCost || 0;
      const minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
      const pricePerQuantityUnit = diceCost * minQuantity;
      return pricePerQuantityUnit > 0 ? Math.floor(currentGold / pricePerQuantityUnit) : 0;
    } else {
      // For other items, use dust
      return itemPrice > 0 ? Math.floor(currentDust / itemPrice) : 0;
    }
  }
  
  // Inject CSS styles
  function injectStyles() {
    if (document.getElementById('better-yasir-styles')) return;
    
    // Only inject if Yasir modal is present or likely to be present
    if (!document.querySelector('.widget-bottom') && 
        !document.querySelector('h2 p')?.textContent?.includes('Yasir')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'better-yasir-styles';
    style.textContent = QUANTITY_INPUT_STYLES;
    document.head.appendChild(style);
  }
  
  // Get the quantity from an item slot using game state only
  function getItemQuantity(itemSlot) {
    // Check if itemSlot is null or undefined
    if (!itemSlot) {
      return 0;
    }
    
    const inventory = getInventoryState();
    
    const itemKey = getItemKeyFromSlot(itemSlot);
    if (!itemKey) {
      return 0;
    }
    
    const quantity = inventory[itemKey] || 0;
    return quantity;
  }
  
  // Determine item key from the slot
  function getItemKeyFromSlot(itemSlot) {
    return safeExecute(() => {
      if (!itemSlot) return null;
      
      // Check cache first
      if (itemKeyCache.has(itemSlot)) {
        return itemKeyCache.get(itemSlot);
      }
      
      // Fast path – return cached value if we already resolved this slot
      if (itemSlot.dataset.itemKey) {
        const cachedKey = itemSlot.dataset.itemKey;
        itemKeyCache.set(itemSlot, cachedKey);
        return cachedKey;
      }

      // Single query for all elements we need
      const elements = {
        spriteItem: itemSlot.querySelector(SELECTORS.STONE_OF_INSIGHT_SPRITE),
        rarityElement: itemSlot.querySelector(SELECTORS.RARITY_ELEMENT),
        exaltationChestImg: itemSlot.querySelector(SELECTORS.EXALTATION_CHEST_IMG),
        dustImg: itemSlot.querySelector(SELECTORS.DUST_IMG),
        summonScrollImg: itemSlot.querySelector('img[src*="summonscroll"]')
      };

      let detectedKey = null;

      // Check for sprite items first (highest priority)
      if (elements.spriteItem) {
        const classMatch = elements.spriteItem.className.match(/id-(\d+)/);
        const spriteId = classMatch?.[1];
        
        if (spriteId) {
          const spriteMapping = {
            '35909': 'diceManipulator',
            '21383': 'insightStone',
            '653': 'outfitBag1',
            '43672': 'monsterCauldron',
            '42363': 'hygenie'
          };
          
          const baseKey = spriteMapping[spriteId];
          if (baseKey) {
            if ((baseKey === 'diceManipulator' || baseKey === 'insightStone') && elements.rarityElement) {
              const rarity = elements.rarityElement.getAttribute('data-rarity');
              detectedKey = `${baseKey}${rarity}`;
            } else {
              detectedKey = baseKey;
            }
          } else {
            detectedKey = `sprite_${spriteId}`;
          }
        }
      }
      // Check for Exaltation Chest
      else if (elements.exaltationChestImg) {
        detectedKey = 'exaltationChest';
      }
      // Check for Summon Scroll
      else if (elements.summonScrollImg) {
        const srcMatch = elements.summonScrollImg.src.match(/summonscroll(\d+)\.png/);
        const tier = srcMatch?.[1] || '1';
        detectedKey = `summonScroll${tier}`;
      }
      // Check for Dust (lowest priority)
      else if (elements.dustImg) {
        detectedKey = 'dust';
      }

      if (detectedKey) {
        itemSlot.dataset.itemKey = detectedKey;
        itemKeyCache.set(itemSlot, detectedKey);
        return detectedKey;
      }

      return null;
    }, 'Error getting item key from slot', null);
  }
  
  // Unified price calculation utility
  const priceUtils = {
    // Extract price from button text
    extractPriceFromText(text) {
      const priceMatch = text.match(/(\d+)/);
      return priceMatch ? parseInt(priceMatch[1]) : 0;
    },
    
    // Check if button indicates out of stock
    isOutOfStock(button) {
      const text = button.textContent.trim();
      return text === '' || text.includes('Out of stock') || button.disabled;
    }
  };
  
  // Get item price from the shop row
  function getItemPrice(shopRow) {
    return safeExecute(() => {
      const priceButton = shopRow.querySelector('button');
      if (priceButton && !priceUtils.isOutOfStock(priceButton)) {
        return priceUtils.extractPriceFromText(priceButton.textContent);
      }
      return 0;
    }, 'Error getting item price', 0);
  }

  // Get item price from the original button in the next cell
  function getItemPriceFromNextCell(container) {
    return safeExecute(() => {
      const currentCell = container.closest('td');
      if (currentCell) {
        const nextCell = currentCell.nextElementSibling;
        if (nextCell) {
          const originalButton = nextCell.querySelector('button');
          if (originalButton && !priceUtils.isOutOfStock(originalButton)) {
            return priceUtils.extractPriceFromText(originalButton.textContent);
          }
        }
      }
      return 0;
    }, 'Error getting item price from next cell', 0);
  }
  
  // Check if item is out of stock
  function isItemOutOfStock(shopRow) {
    return safeExecute(() => {
      return shopRow.textContent.includes('Out of stock');
    }, 'Error checking if item is out of stock', false);
  }
  
  // Create custom action button
  function createCustomActionButton(actionType) {
    const button = document.createElement('button');
    // Use the same classes as the original buttons for consistent sizing and styling
    button.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 [_svg]:size-[11px] [_svg]:mb-[2px] [_svg]:mt-[3px] w-full text-whiteHighlight better-yasir-action-button';
    // Don't set text content here - it will be set by updateActionButtonText
    return button;
  }

  // Create quantity input element
  function createQuantityInput(maxQuantity, defaultValue = 1, minQuantity = 1) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'better-yasir-quantity-input';
    input.placeholder = minQuantity.toString();
    input.value = defaultValue.toString();
    input.max = maxQuantity; // Set initial max attribute
    
    // Handle input validation
    input.addEventListener('input', function() {
      const value = this.value.trim();
      
      // Allow empty input (user can delete all numbers)
      if (value === '') {
        return;
      }
      
      // Get current max value from the input's max attribute (which gets updated)
      const currentMax = parseInt(this.max) || maxQuantity;
      
      // Check if it's a valid number
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < minQuantity) {
        this.value = minQuantity.toString();
      } else if (numValue > currentMax) {
        this.value = currentMax.toString();
      }
      
      // Removed hard limit of 100 items
    });
    
    // Handle blur event to set default value when input loses focus
    input.addEventListener('blur', function() {
      const value = this.value.trim();
      
      // If empty, set to minimum quantity
      if (value === '') {
        this.value = minQuantity.toString();
      }
    });
    
    return input;
  }
  
  // Update action button text based on quantity and price
  function updateActionButtonText(button, quantity, actionType, itemPrice = 0, itemKey = null) {
    let actionText;
    
    // Create the button content similar to original buttons
    if (actionType === 'buy') {
      let totalPrice;
      
      // For dice manipulators, we need to calculate based on API price per "quantity unit" (10 dice)
      if (itemKey && itemKey.startsWith('diceManipulator')) {
        const yasirData = getYasirShopData();
        const diceCost = yasirData?.diceCost || 0;
        const minQuantity = getMinimumQuantityFromDOM(document.querySelector(`[data-item-key="${itemKey}"]`)) || 10;
        const pricePerQuantityUnit = diceCost * minQuantity; // 4732 × 10 = 47320
        totalPrice = pricePerQuantityUnit * quantity; // Use price per quantity unit × visual quantity
      } else {
        // For other items, use the provided itemPrice (which is already total price)
        totalPrice = itemPrice * quantity;
      }
      
      // Determine the correct currency icon based on item type
      let currencyIcon = '/assets/icons/dust.png';
      let currencyAlt = 'dust';
      
      if (itemKey === 'exaltationChest') {
        // Exaltation chest uses dust
        currencyIcon = '/assets/icons/dust.png';
        currencyAlt = 'dust';
      } else if (itemKey && itemKey.startsWith('diceManipulator')) {
        // Dice manipulators use gold
        currencyIcon = '/assets/icons/goldpile.png'; // Use the correct gold icon
        currencyAlt = 'gold';
      } else {
        // Default to dust for other items
        currencyIcon = '/assets/icons/dust.png';
        currencyAlt = 'dust';
      }
      
      button.innerHTML = `<img alt="${currencyAlt}" src="${currencyIcon}" class="pixelated" width="11" height="12">${totalPrice.toLocaleString()}`;
    } else if (actionType === 'sell') {
      // For sell buttons (exchange section), show dust icon and quantity
      const dustAmount = itemPrice * quantity;
      button.innerHTML = `<img alt="dust" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${dustAmount.toLocaleString()}`;
    } else {
      // For other trade buttons, show dust icon and quantity
      const dustAmount = itemPrice * quantity;
      button.innerHTML = `<img alt="dust" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${dustAmount.toLocaleString()}`;
    }
  }
  
  // Show confirmation prompt inside Yasir tooltip
  function getItemDisplayName(itemKey) {
    if (itemKey === 'exaltationChest') {
      return 'Exaltation Chest';
    }
    if (itemKey === 'dust') {
      return 'Dust';
    }
    if (itemKey === 'stoneOfInsight' || itemKey.startsWith('insightStone')) {
      return 'Stone of Insight';
    }
    if (itemKey.startsWith('summonScroll')) {
      return 'Summon Scroll';
    }
    if (itemKey.startsWith('diceManipulator')) {
      const tier = parseInt(itemKey.replace('diceManipulator',''));
      const names = {
        1: 'Common dice manipulators',
        2: 'Uncommon dice manipulators',
        3: 'Rare dice manipulators',
        4: 'Mythic dice manipulators',
        5: 'Legendary dice manipulators'
      };
      return names[tier] || 'dice manipulators';
    }
    return 'items';
  }

  function showConfirmationPrompt(quantity, itemKey, actionButton, actionType) {
    try {
      const tooltip = getCachedElement('.tooltip-prose');
      if (!tooltip) return;
      const paragraphs = tooltip.querySelectorAll('p');
      if (paragraphs.length < 2) return;
      const msgElem = paragraphs[1];
      if (!tooltip.dataset.originalText) {
        tooltip.dataset.originalText = msgElem.textContent;
      }
      // remove any previous confirmation
      getCachedElements('.better-yasir-action-button.confirm').forEach(btn=>{
        btn.classList.remove('confirm');
        delete btn.dataset.confirm;
      });

      const itemName = getItemDisplayName(itemKey);
      const actionText = actionType === 'buy' ? 'buy' : 'sell';
      
      // Calculate the total cost
      let totalCost = 0;
      let currency = '';
      
      if (actionType === 'buy') {
        // For dice manipulators, calculate based on API price per "quantity unit" (10 dice)
        if (itemKey && itemKey.startsWith('diceManipulator')) {
          const yasirData = getYasirShopData();
          const diceCost = yasirData?.diceCost || 0;
          const minQuantity = getMinimumQuantityFromDOM(document.querySelector(`[data-item-key="${itemKey}"]`)) || 10;
          const pricePerQuantityUnit = diceCost * minQuantity;
          totalCost = pricePerQuantityUnit * quantity;
          currency = 'gold';
        } else if (itemKey === 'exaltationChest') {
          // For exaltation chest, get price from DOM
          const container = actionButton.closest('td')?.previousElementSibling?.querySelector('div.flex.items-center.gap-1\\.5');
          if (container) {
            totalCost = getItemPriceWithFallback(itemKey, container) * quantity;
          }
          currency = 'dust';
        } else {
          // For other items, get price from DOM
          const container = actionButton.closest('td')?.previousElementSibling?.querySelector('div.flex.items-center.gap-1\\.5');
          if (container) {
            totalCost = getItemPriceWithFallback(itemKey, container) * quantity;
          }
          currency = 'dust';
        }
      } else if (actionType === 'sell') {
        // For sell actions, calculate dust received
        totalCost = 10 * quantity; // Exchange rate is 10 dust per item
        currency = 'dust';
      }
      
      const costText = totalCost > 0 ? ` for ${totalCost.toLocaleString()} ${currency}` : '';
      msgElem.textContent = `Are you sure you want to ${actionText} ${quantity} ${itemName}${costText}?`;
      msgElem.style.color = '#ff4d4d';
      actionButton.dataset.confirm = 'pending';
      actionButton.classList.add('confirm');
      // Attach outside click handler to reset confirmation when clicking elsewhere
      if (!confirmationOutsideHandler) {
        confirmationOutsideHandler = (ev) => {
          if (!ev.target.closest('.better-yasir-action-button.confirm')) {
            removeConfirmationPrompt();
          }
        };
        document.addEventListener('click', confirmationOutsideHandler, true);
      }
    } catch (e) {}
  }
  
  function removeConfirmationPrompt() {
    try {
      const tooltip = getCachedElement('.tooltip-prose');
      if (!tooltip || !tooltip.dataset.originalText) return;
      const paragraphs = tooltip.querySelectorAll('p');
      if (paragraphs.length < 2) return;
      const msgElem = paragraphs[1];
      msgElem.textContent = tooltip.dataset.originalText;
      msgElem.style.color = '';
      delete tooltip.dataset.originalText;
      // remove confirm class from any button
      // Remove pending confirmation from all action buttons
      getCachedElements('.better-yasir-action-button').forEach(b=>{
        b.classList.remove('confirm');
        delete b.dataset.confirm;
      });
      cleanupConfirmationHandler();
    } catch (e) {}
  }
  
  // Helper function to convert rarity number to name for different item types
  function getRarityName(rarity) {
    const rarityNames = {
      '1': 'Common',
      '2': 'Uncommon', 
      '3': 'Rare',
      '4': 'Mythic',
      '5': 'Legendary'
    };
    return rarityNames[rarity] || 'Unknown';
  }
  
  // Helper function to convert rarity number to name for Stone of Insight
  function getInsightStoneRarityName(rarity) {
    const insightStoneRarityNames = {
      '1': 'Glimpse',
      '2': 'Awakening', 
      '3': 'Arcane',
      '4': 'Enlightenment',
      '5': 'Epiphany'
    };
    return insightStoneRarityNames[rarity] || 'Unknown';
  }
  
  // Helper function to convert rarity number to name for Summon Scroll
  function getSummonScrollRarityName(rarity) {
    const summonScrollRarityNames = {
      '1': 'Crude',
      '2': 'Ordinary', 
      '3': 'Refined',
      '4': 'Special',
      '5': 'Exceptional'
    };
    return summonScrollRarityNames[rarity] || 'Unknown';
  }
  
  // Helper function to convert rarity number to name for Dice Manipulator
  function getDiceManipulatorRarityName(rarity) {
    const diceManipulatorRarityNames = {
      '1': 'Common',
      '2': 'Uncommon', 
      '3': 'Rare',
      '4': 'Mythic',
      '5': 'Legendary'
    };
    return diceManipulatorRarityNames[rarity] || 'Unknown';
  }
  
  // Unified function to get rarity name based on item type
  function getItemRarityName(itemKey, rarity) {
    if (itemKey && itemKey.startsWith('insightStone')) {
      return getInsightStoneRarityName(rarity);
    } else if (itemKey && itemKey.startsWith('summonScroll')) {
      return getSummonScrollRarityName(rarity);
    } else if (itemKey && itemKey.startsWith('diceManipulator')) {
      return getDiceManipulatorRarityName(rarity);
    } else {
      return getRarityName(rarity);
    }
  }
  
  // Create a proper Stone of Insight sprite with complete container structure
  function createStoneOfInsightSprite(quantity = 1) {
    // Create the main container slot with proper attributes
    const containerSlot = document.createElement('div');
    containerSlot.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
    containerSlot.setAttribute('data-hoverable', 'false');
    containerSlot.setAttribute('data-highlighted', 'false');
    containerSlot.setAttribute('data-disabled', 'false');
    
    // Create the has-rarity container
    const hasRarityContainer = document.createElement('div');
    hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
    hasRarityContainer.setAttribute('data-rarity', '5');
    
    // Create the sprite container with proper positioning
    const spriteContainer = document.createElement('div');
    spriteContainer.className = 'sprite item relative id-21383';
    
    // Create the viewport
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    
    // Create the spritesheet image
    const img = document.createElement('img');
    img.alt = 'Stone of Insight';
    img.setAttribute('data-cropped', 'false');
    img.className = 'spritesheet';
    img.src = 'https://bestiaryarena.com/assets/ITEM/21383.png'; // Add the spritesheet source
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
    
    // Create the quantity indicator
    const quantityIndicator = document.createElement('div');
    quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
    
    const quantitySpan = document.createElement('span');
    quantitySpan.className = 'relative font-outlined-fill text-white';
    quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
    quantitySpan.setAttribute('translate', 'no');
    quantitySpan.textContent = `${quantity}x`;
    
    // Assemble the structure
    quantityIndicator.appendChild(quantitySpan);
    viewport.appendChild(img);
    spriteContainer.appendChild(viewport);
    hasRarityContainer.appendChild(spriteContainer);
    hasRarityContainer.appendChild(quantityIndicator);
    containerSlot.appendChild(hasRarityContainer);
    
    return containerSlot;
  }
  
  // Show a temporary tooltip message (error/info)
  function showTooltipMessage(message, color = '#ff4d4d', duration = CONSTANTS.ERROR_DISPLAY_DURATION) {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip) return;
      const paragraphs = tooltip.querySelectorAll('p');
      if (paragraphs.length < 2) return;
      const msgElem = paragraphs[1];
      if (!tooltip.dataset.originalText) {
        tooltip.dataset.originalText = msgElem.textContent;
      }
      msgElem.textContent = message;
      msgElem.style.color = color;
      setTimeout(() => {
        if (!tooltip.dataset.originalText) return;
        msgElem.textContent = tooltip.dataset.originalText;
        msgElem.style.color = '';
        delete tooltip.dataset.originalText;
      }, duration);
    } catch (e) {}
  }
  
  // Update visible resource displays (gold/dust)
  function updateResourceDisplays(playerGold, playerDust) {
    try {
      // Find and update gold display - look for the specific gold display in the Yasir modal
      const yasirModal = document.querySelector('.widget-bottom[data-better-yasir-enhanced]');
      if (yasirModal) {
        // Look for gold display within the modal - try multiple selectors
        const goldDisplays = yasirModal.querySelectorAll('img[src*="goldpile"], img[alt*="gold"], img[src*="gold"]');
        goldDisplays.forEach(goldImg => {
          const goldContainer = goldImg.closest('div');
          if (goldContainer) {
            // Find the text element that contains the gold amount
            const goldTextElement = goldContainer.querySelector('span, div') || goldContainer;
            if (goldTextElement) {
              const goldText = goldTextElement.textContent;
              if (goldText && goldText.match(/\d+/)) {
                // Update the text content with new gold amount
                const newText = goldText.replace(/\d+(?:,\d+)*/, playerGold.toLocaleString());
                goldTextElement.textContent = newText;
              }
            }
          }
        });
        
        // Also try to find gold displays by looking for the specific pattern in the bottom bar
        const bottomBar = yasirModal.querySelector('.flex.items-center.justify-between, .flex.items-center.gap-4');
        if (bottomBar) {
          const goldElements = bottomBar.querySelectorAll('img[src*="gold"], img[alt*="gold"]');
          goldElements.forEach(goldImg => {
            const goldContainer = goldImg.closest('div');
            if (goldContainer) {
              const goldTextElement = goldContainer.querySelector('span, div') || goldContainer;
              if (goldTextElement) {
                const goldText = goldTextElement.textContent;
                if (goldText && goldText.match(/\d+/)) {
                  const newText = goldText.replace(/\d+(?:,\d+)*/, playerGold.toLocaleString());
                  goldTextElement.textContent = newText;
                }
              }
            }
          });
        }
      }
      
      // Find and update dust display - look for the specific dust display in the Yasir modal
      if (yasirModal) {
        const dustDisplays = yasirModal.querySelectorAll('img[src*="dust"], img[alt*="dust"]');
        dustDisplays.forEach(dustImg => {
          const dustContainer = dustImg.closest('div');
          if (dustContainer) {
            // Find the text element that contains the dust amount
            const dustTextElement = dustContainer.querySelector('span, div') || dustContainer;
            if (dustTextElement) {
              const dustText = dustTextElement.textContent;
              if (dustText && dustText.match(/\d+/)) {
                // Update the text content with new dust amount
                const newText = dustText.replace(/\d+(?:,\d+)*/, playerDust.toLocaleString());
                dustTextElement.textContent = newText;
              }
            }
          }
        });
      }
    } catch (error) {
      handleError(error, 'Error updating resource displays');
    }
  }
  
  // Refresh UI after action to show updated inventory counts
  function refreshUIAfterAction() {
    try {
      // Set flag to prevent multiple refresh cycles
      document.body.dataset.betterYasirRefreshing = 'true';
      
      // Clear the flag after a delay
      setTimeout(() => {
        delete document.body.dataset.betterYasirRefreshing;
      }, 1000);
      
      // Use utility function to find the Yasir modal
      const modal = domUtils.findYasirModal();
      
      if (!modal) {
        console.warn('[Better Yasir] Could not find Yasir modal for UI refresh');
        return;
      }
      
      // Force a fresh read of the game state (no caching)
      // Clear the cache first to ensure we get fresh data
      clearCaches();
      const gameState = getGameState();
      const inventory = gameState?.playerState?.inventory || {};
      const playerDust = gameState?.playerState?.dust || 0;
      const playerGold = gameState?.playerState?.gold || 0;
      

      
      if (!inventory) {
        console.warn('[Better Yasir] No inventory state available for UI refresh');
        return;
      }
      
      // Update visible inventory counts in the UI
      updateVisibleInventoryCounts(modal, inventory);
      
      // Find all quantity inputs and update their max values
      const quantityInputs = modal.querySelectorAll('.better-yasir-quantity-input');
      quantityInputs.forEach((input, inputIndex) => {
        const container = input.closest('div.flex.items-center.gap-1\\.5');
        if (!container) return;
        
        const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
        if (!itemSlot) return;
        
        const itemKey = getItemKeyFromSlot(itemSlot);
        const currentQuantity = inventory[itemKey] || 0;
        
        // Update max value and current value based on action type
        // Find the action button by looking in the same table row
        const tableRow = container.closest('tr');
        let actionButton = null;
        let isBuyAction = false;
        
        if (tableRow) {
          // Look for the action button in the same row
          actionButton = tableRow.querySelector('.better-yasir-action-button');
          
          if (actionButton) {
            // More reliable way to determine action type: check the table section first
            const tableHeader = tableRow.closest('table')?.querySelector('thead th');
            const isExchangeSection = tableHeader?.textContent?.includes('Exchange') || tableHeader?.textContent?.includes('Sell');
            
            if (isExchangeSection) {
              // If we're in the exchange/sell section, it's definitely a sell action
              isBuyAction = false;
            } else {
              // If we're in the buy section, it's definitely a buy action
              isBuyAction = true;
            }
          } else {
            // Fallback: determine action type by looking at the table header
            const tableHeader = tableRow.closest('table')?.querySelector('thead th');
            const isExchangeSection = tableHeader?.textContent?.includes('Exchange') || tableHeader?.textContent?.includes('Sell');
            isBuyAction = !isExchangeSection;
          }
        }
        
                  if (actionButton) {
            let itemPrice = 0;
            let newValue = 1; // Initialize newValue
            
            if (isBuyAction) {
              // For buy actions, recalculate max based on available resources
              itemPrice = getItemPriceWithFallback(itemKey, container);
              const maxQuantity = calculateMaxQuantity(itemKey, itemPrice, itemSlot, playerDust, playerGold);
              
              input.max = maxQuantity;
              const currentValue = parseInt(input.value) || 1;
              newValue = Math.min(currentValue, Math.max(1, maxQuantity));
              input.value = newValue.toString();
              
              // Trigger input validation to ensure the value is within bounds
              input.dispatchEvent(new Event('input'));
            } else {
              // For sell actions, use available quantity
              itemPrice = 10; // Exchange rate is 10 dust per item
              input.max = currentQuantity;
              const currentValue = parseInt(input.value) || 1;
              newValue = Math.min(currentValue, Math.max(1, currentQuantity));
              input.value = newValue.toString();
              
              // Trigger input validation to ensure the value is within bounds
              input.dispatchEvent(new Event('input'));
            }
            
            // Update button text
            updateActionButtonText(actionButton, newValue, isBuyAction ? 'buy' : 'sell', itemPrice, itemKey);
          }
      });
      
      // Also update any visible resource displays (gold/dust)
      updateResourceDisplays(playerGold, playerDust);
      
    } catch (error) {
      handleError(error, 'Error refreshing UI after action');
    }
  }
  
  // Update visible inventory counts in the UI
  function updateVisibleInventoryCounts(modal, inventory) {
    try {
      // Find all container slots and update their quantity displays
      const containerSlots = modal.querySelectorAll('.container-slot');
      
      containerSlots.forEach((slot, index) => {
        const itemKey = getItemKeyFromSlot(slot);
        if (!itemKey) {
          return;
        }
        
        // Check if this slot is in the Buy section or Sell section
        const tableRow = slot.closest('tr');
        const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
        const isSellSection = tableHeader?.textContent?.includes('Sell') || tableHeader?.textContent?.includes('Exchange');
        
        // Only update quantities for items in the Sell section
        // For Buy section items (like dice manipulators), preserve the original quantity display
        if (isSellSection) {
          const currentQuantity = inventory[itemKey] || 0;
          
          // Find the quantity indicator (the "444x" text)
          const quantityIndicator = slot.querySelector('.revert-pixel-font-spacing');
          if (quantityIndicator) {
            const quantitySpan = quantityIndicator.querySelector('span');
            if (quantitySpan) {
              quantitySpan.textContent = `${currentQuantity}x`;
              // Ensure the text is visible
              quantitySpan.style.color = 'transparent';
              quantitySpan.style.textShadow = '1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000';
            }
          }
        }
        // For Buy section items, do NOT update the quantity display
        // This preserves the original "10x" for dice manipulators which represents the purchase quantity, not inventory
      });
      
      // Also try a more direct approach for specific items (only in Sell section)
      updateSpecificItemQuantities(modal, inventory);
      
    } catch (error) {
      handleError(error, 'Error updating visible inventory counts');
    }
  }
  
  // Update specific item quantities with direct selectors (only for Sell section)
  function updateSpecificItemQuantities(modal, inventory) {
    try {
      // Update Stone of Insight specifically (only in Sell section)
      if (inventory.insightStone5 !== undefined) {
        const insightStoneSlots = modal.querySelectorAll('.container-slot[data-item-key="insightStone5"]');
        
        insightStoneSlots.forEach((slot, index) => {
          // Check if this slot is in the Sell section
          const tableRow = slot.closest('tr');
          const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
          const isSellSection = tableHeader?.textContent?.includes('Sell') || tableHeader?.textContent?.includes('Exchange');
          
          if (isSellSection) {
            const quantitySpan = slot.querySelector('.revert-pixel-font-spacing span');
            if (quantitySpan) {
              quantitySpan.textContent = `${inventory.insightStone5}x`;
            }
          }
        });
      }
      
      // Update dice manipulators specifically (only in Sell section)
      Object.entries(inventory).forEach(([itemKey, quantity]) => {
        if (itemKey.startsWith('diceManipulator')) {
          const slots = modal.querySelectorAll(`.container-slot[data-item-key="${itemKey}"]`);
          if (slots.length > 0) {
            slots.forEach((slot, index) => {
              // Check if this slot is in the Sell section
              const tableRow = slot.closest('tr');
              const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
              const isSellSection = tableHeader?.textContent?.includes('Sell') || tableHeader?.textContent?.includes('Exchange');
              
              if (isSellSection) {
                const quantitySpan = slot.querySelector('.revert-pixel-font-spacing span');
                if (quantitySpan) {
                  quantitySpan.textContent = `${quantity}x`;
                  // Use the same styling as Stone of Insight for consistent appearance
                  quantitySpan.className = 'relative font-outlined-fill text-white';
                  quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                }
              }
            });
          }
        }
      });
      
      // Update other items as needed (only in Sell section)
      Object.entries(inventory).forEach(([itemKey, quantity]) => {
        if (itemKey === 'insightStone5' || itemKey.startsWith('diceManipulator')) return; // Already handled above
        
        const slots = modal.querySelectorAll(`.container-slot[data-item-key="${itemKey}"]`);
        if (slots.length > 0) {
          slots.forEach((slot, index) => {
            // Check if this slot is in the Sell section
            const tableRow = slot.closest('tr');
            const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
            const isSellSection = tableHeader?.textContent?.includes('Sell') || tableHeader?.textContent?.includes('Exchange');
            
            if (isSellSection) {
              const quantitySpan = slot.querySelector('.revert-pixel-font-spacing span');
              if (quantitySpan) {
                quantitySpan.textContent = `${quantity}x`;
                // Use the same styling as Stone of Insight for consistent appearance
                quantitySpan.className = 'relative font-outlined-fill text-white';
                quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
              }
            }
          });
        }
      });
      
    } catch (error) {
      handleError(error, 'Error updating specific item quantities');
    }
  }
  
  // Perform the actual purchase/trade via API call
  async function performAction(itemKey, quantity, actionType) {
    // Create unique request key for deduplication
    const requestKey = `${actionType}-${itemKey}-${quantity}-${Date.now()}`;
    
    return deduplicateRequest(requestKey, async () => {
      try {
        if (!itemKey || quantity <= 0) {
          handleError(new Error('Invalid action parameters'), { itemKey, quantity, actionType });
          return;
        }
        
        // For dice manipulators, convert visual quantity to actual quantity
        let actualQuantity = quantity;
        if (itemKey && itemKey.startsWith('diceManipulator')) {
          const minQuantity = getMinimumQuantityFromDOM(document.querySelector(`[data-item-key="${itemKey}"]`)) || 10;
          actualQuantity = quantity * minQuantity; // Convert visual quantity to actual dice quantity
        }
        
        // Re-validate current inventory before proceeding
        const gameState = getGameState();
        if (gameState && gameState.playerState?.inventory) {
          const currentQuantity = gameState.playerState.inventory[itemKey] || 0;
          
          // Check if user has sufficient items for trade
          if (actionType === 'sell') {
            if (currentQuantity < quantity) {
              handleError(new Error('Insufficient items for trade'), { requested: quantity, available: currentQuantity, itemKey });
              return;
            }
          }
        }
        
        // Re-validate player resources for buy actions
        if (actionType === 'buy') {
          let playerResource = 0;
          let resourceType = '';
          
          if (itemKey && itemKey.startsWith('diceManipulator')) {
            // Dice manipulators use gold
            playerResource = getPlayerGold();
            resourceType = 'gold';
          } else {
            // Other items use dust
            playerResource = getPlayerDust();
            resourceType = 'dust';
          }
          
          const itemPrice = getItemPriceWithFallback(itemKey);
          const totalCost = itemPrice * quantity;
          
          if (playerResource < totalCost) {
            handleError(new Error(`Insufficient ${resourceType} for purchase`), { requested: totalCost, available: playerResource });
            return;
          }
        }
        
        // Get Yasir's current location from the daily state
        const yasirData = getYasirShopData();
        const yasirLocation = yasirData?.location;
        
        if (!yasirLocation) {
          handleError(new Error('Could not determine Yasir location'), { yasirData });
          return;
        }
        
        // Determine the endpoint and payload based on action type and item
        let endpoint = '';
        let payload = {};
        
        if (actionType === 'buy') {
          // Based on HAR analysis, the buy API endpoint is:
          endpoint = '/api/trpc/store.yasirDailyStock?batch=1';
          
          // Updated payload with new required parameters
          payload = {
            "0": {
              "json": {
                "itemKey": itemKey,
                "amount": actualQuantity,  // Use actual quantity (visual quantity × 10 for dice manipulators)
                "location": yasirLocation  // Added location parameter
              }
            }
          };
          
        } else if (actionType === 'sell') {
          // Use a different API endpoint for dust exchange
          endpoint = '/api/trpc/store.yasirDustExchange?batch=1';
          payload = {
            "0": {
              "json": {
                "itemKey": itemKey,
                "amount": actualQuantity,  // Use actual quantity (visual quantity × 10 for dice manipulators)
                "location": yasirLocation  // Added location parameter
              }
            }
          };
        }
        
        // Log the API call for debugging
        console.log(`[Better Yasir] Making ${actionType} request:`, {
          endpoint,
          payload,
          itemKey,
          quantity,
          actualQuantity
        });
        
        // Make the actual API call
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Content-Type': 'application/json',
            'X-Game-Version': '1',
            'Origin': 'https://bestiaryarena.com',
            'Referer': 'https://bestiaryarena.com/game',
            'Sec-GPC': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        
        // Handle API response
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Better Yasir] Server response:`, errorText);
          
          // Handle specific error cases
          if (response.status === 403) {
            try {
              const errorData = JSON.parse(errorText);
              if (errorData[0]?.error?.json?.message) {
                throw new Error(errorData[0].error.json.message);
              }
            } catch (parseError) {
              // If we can't parse the error, use the generic message
            }
          }
          
          // Log the full error for debugging
          console.error(`[Better Yasir] Full error response:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: errorText
          });
          
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update local inventory based on API response
        if (result && Array.isArray(result) && result[0]?.result?.data?.json) {
          const responseData = result[0].result.data.json;
          
          // Create inventory diff from the response
          const inventoryDiff = {};
          
          // Handle inventory changes
          if (responseData.inventoryDiff) {
            Object.assign(inventoryDiff, responseData.inventoryDiff);
          }
          
          // Handle dust changes
          if (responseData.dustDiff !== undefined) {
            inventoryDiff.dust = responseData.dustDiff;
          }
          
          // Handle gold changes (for selling dice manipulators)
          if (responseData.goldDiff !== undefined) {
            inventoryDiff.gold = responseData.goldDiff;
          }
          
          if (Object.keys(inventoryDiff).length > 0) {
            updateLocalInventory(inventoryDiff);
          }
        }
        
        // Show success message
        removeConfirmationPrompt();
        const actionText = actionType === 'buy' ? 'purchased' : 'traded for';
        // Ensure quantity is a safe number
        const safeQuantity = parseInt(quantity) || 1;
        const itemName = getItemDisplayName(itemKey);
        
        showTooltipMessage(`Successfully ${actionText} ${safeQuantity} ${itemName}!`, '#32cd32', 5000);
        
        // Clear caches immediately after successful action to get fresh state
        clearCaches();
        
        // Single consolidated UI update with fresh state
        setTimeout(() => {
          // Clear caches and get fresh state
          clearCaches();
          
          // Get fresh state using optimized functions
          const currentDust = getPlayerDust();
          const currentGold = getPlayerGold();
          const currentInventory = getInventoryState();
          
          // Update resource displays first
          updateResourceDisplays(currentGold, currentDust);
          
          // Update visible inventory counts
          const modal = domUtils.findYasirModal();
          if (modal) {
            updateVisibleInventoryCounts(modal, currentInventory);
          }
          
          // Update quantity inputs and buttons
          const inputs = document.querySelectorAll('.better-yasir-quantity-input');
          
          inputs.forEach((input, index) => {
            const container = input.closest('div.flex.items-center.gap-1\\.5');
            if (!container) return;
            
            const itemSlot = container.querySelector('.container-slot');
            if (!itemSlot) return;
            
            const slotItemKey = getItemKeyFromSlot(itemSlot);
            if (!slotItemKey) return;
            
            const actionButton = container.querySelector('.better-yasir-action-button');
            
            // Improved buy/sell detection
            let isBuyAction = false;
            if (actionButton) {
              // More reliable way to determine action type: check the table section first
              const tableRow = container.closest('tr');
              if (tableRow) {
                const tableHeader = tableRow.closest('table')?.querySelector('thead th');
                const isExchangeSection = tableHeader?.textContent?.includes('Exchange') || tableHeader?.textContent?.includes('Sell');
                isBuyAction = !isExchangeSection;
              } else {
                // Fallback: determine by item type (Exaltation Chest is always buy)
                isBuyAction = slotItemKey === 'exaltationChest';
              }
            } else {
              // Fallback: determine by table section
              const tableRow = container.closest('tr');
              if (tableRow) {
                const tableHeader = tableRow.closest('table')?.querySelector('thead th');
                const isExchangeSection = tableHeader?.textContent?.includes('Exchange') || tableHeader?.textContent?.includes('Sell');
                isBuyAction = !isExchangeSection;
              } else {
                // Second fallback: determine by item type (Exaltation Chest is always buy)
                isBuyAction = slotItemKey === 'exaltationChest';
              }
            }
            
            if (isBuyAction) {
              // For buy items, recalculate max based on available resources
              const itemPrice = getItemPriceWithFallback(slotItemKey, container);
              const maxQuantity = calculateMaxQuantity(slotItemKey, itemPrice, itemSlot, currentDust, currentGold);
              
              // Ensure max is at least 1
              const safeMax = Math.max(1, maxQuantity);
              input.max = safeMax;
              
              // Get current value and ensure it's valid
              const currentValue = parseInt(input.value) || 1;
              const newValue = Math.min(currentValue, safeMax);
              input.value = newValue.toString();
              
              // Update the action button text
              if (actionButton) {
                updateActionButtonText(actionButton, newValue, 'buy', itemPrice, slotItemKey);
              }
            } else {
              // For sell items, use available inventory quantity
              const currentQuantity = currentInventory[slotItemKey] || 0;
              const safeMax = Math.max(1, currentQuantity);
              input.max = safeMax;
              
              // Get current value and ensure it's valid
              const currentValue = parseInt(input.value) || 1;
              const newValue = Math.min(currentValue, safeMax);
              input.value = newValue.toString();
              
              // Update the action button text
              if (actionButton) {
                updateActionButtonText(actionButton, newValue, 'sell', 10, slotItemKey);
              }
            }
          });
        }, 100);
        
      } catch (error) {
        handleError(error, `${actionType} action failed`);
        
        // Show user-friendly error message
        let errorMessage = `${actionType} failed. Please try again.`;
        if (error.message.includes('Insufficient')) {
          errorMessage = error.message;
        } else if (error.message.includes('HTTP error! Status: 403')) {
          errorMessage = 'Not enough resources for this action.';
        }
        
        // Show error state briefly
        showTooltipMessage(errorMessage);
        throw error; // Re-throw to be handled by the calling function
      }
    });
  }
  
// =======================
// 3. UI Component Creation
// =======================
  
  // Add quantity inputs to shop rows
  function addQuantityInputsToShopRows(shopTable) {
    // Check if this table has already been processed
    if (shopTable.dataset.betterYasirTableProcessed) {
      return;
    }
    
    // Mark table as being processed to prevent duplicates
    shopTable.dataset.betterYasirTableProcessed = 'processing';
    
    // Find all shop rows
    const shopRows = shopTable.querySelectorAll(SELECTORS.SHOP_ROW);
    
    let processedCount = 0;
    
    shopRows.forEach((shopRow, index) => {
      const itemSlot = shopRow.querySelector(SELECTORS.ITEM_SLOT);
      const originalButton = shopRow.querySelector(SELECTORS.BUY_BUTTON);
      
      if (!itemSlot || !originalButton) {
        return;
      }
      
      // Check if we've already added our custom UI to this row
      if (shopRow.querySelector('.better-yasir-quantity-input')) {
        return;
      }
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      if (!itemKey) {
        return;
      }
      
      // Check if item is out of stock
      if (isItemOutOfStock(shopRow)) {
        return;
      }
      
      // Determine action type based on table context
      const tableHeader = shopTable.querySelector('thead th');
      const isExchangeTable = tableHeader && tableHeader.textContent.includes('Exchange');
      const actionType = isExchangeTable ? 'trade' : 'buy';
      
      // Get item price and available quantity
      const itemPrice = getItemPrice(shopRow);
      const availableQuantity = getItemQuantity(itemSlot);
      
      // For buying, use a reasonable default max quantity based on available resources
      // For trading, use the available quantity
      const maxQuantity = actionType === 'buy' ? Math.floor(10000 / itemPrice) : availableQuantity;
      
      // Create quantity input
      const quantityInput = createQuantityInput(maxQuantity);
      
      // Create our custom action button
      const customActionButton = createCustomActionButton(actionType);
      
      // Insert our custom UI before the original button
      originalButton.parentNode.insertBefore(quantityInput, originalButton);
      originalButton.parentNode.insertBefore(customActionButton, originalButton);
      
      // Hide the original button now that we have our custom UI
      originalButton.style.display = 'none';
      
      // Set initial value
      const initialQuantity = Math.min(1, maxQuantity);
      quantityInput.value = initialQuantity.toString();
      
      // Update button text with price
      updateActionButtonText(customActionButton, initialQuantity, actionType, itemPrice, itemKey);
      
      // Add event listeners
      addEventListenersToInput(quantityInput, customActionButton, itemKey, maxQuantity, index, itemSlot, actionType, itemPrice);
      
      processedCount++;
    });
    
    // Mark table as processed if we successfully processed any rows
    if (processedCount > 0) {
      shopTable.dataset.betterYasirTableProcessed = 'true';
    } else {
      // If no rows were processed, remove the processing marker
      delete shopTable.dataset.betterYasirTableProcessed;
    }
  }

  // Helper functions for flex container processing
  const flexContainerHelpers = {
    // Check if container should be skipped
    shouldSkipContainer(container) {
      if (processedElements.has(container)) return true;
      if (container.querySelector('.better-yasir-quantity-input')) return true;
      if (container.dataset.betterYasirWrapper) return true;
      
      const tableRow = container.closest('tr');
      if (tableRow && tableRow.dataset.betterYasirProcessed) return true;
      
      return false;
    },
    
    // Check if item is out of stock
    isItemOutOfStock(container) {
      const containerText = container.textContent || '';
      if (containerText.includes('Out of stock')) return true;
      
      const currentCell = container.closest('td');
      if (currentCell) {
        const nextCell = currentCell.nextElementSibling;
        if (nextCell) {
          const nextCellText = nextCell.textContent || '';
          if (nextCellText.includes('Out of stock')) return true;
        }
      }
      
      return false;
    },
    
    // Get target item information for exchange section
    getTargetItemInfo(container, tableRow, isExchangeSection) {
      let targetContainer = container;
      let targetItemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
      let targetItemKey = getItemKeyFromSlot(targetItemSlot);
      
      if (isExchangeSection) {
        const tableCells = tableRow.querySelectorAll('td');
        if (tableCells.length >= 2) {
          const secondCell = tableCells[1];
          
          // Check Yasir location for location-specific replacements
          const yasirData = getYasirShopData();
          const yasirLocation = yasirData?.location;
          
          // Handle Carlin-specific replacement (Dust -> Summon Scroll)
          if (yasirLocation === 'carlin' && targetItemKey === 'dust') {
            // Look for Summon Scroll in the second cell (price cell)
            const summonScrollImg = secondCell.querySelector('img[src*="summonscroll"]');
            if (summonScrollImg) {
              const srcMatch = summonScrollImg.src.match(/summonscroll(\d+)\.png/);
              const tier = srcMatch ? srcMatch[1] : '5'; // Default to tier 5 for Carlin
              targetItemKey = `summonScroll${tier}`;
              
              // Replace the Dust item with Summon Scroll in the first cell
              const firstCell = tableCells[0];
              const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
              if (firstCellContainer) {
                const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
                if (dustSlot) {
                  // Create Summon Scroll container
                  const summonScrollContainer = document.createElement('div');
                  summonScrollContainer.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
                  summonScrollContainer.setAttribute('data-hoverable', 'false');
                  summonScrollContainer.setAttribute('data-highlighted', 'false');
                  summonScrollContainer.setAttribute('data-disabled', 'false');
                  summonScrollContainer.setAttribute('data-item-key', targetItemKey);
                  
                  // Create the has-rarity container
                  const hasRarityContainer = document.createElement('div');
                  hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
                  hasRarityContainer.setAttribute('data-rarity', '5');
                  
                  // Create the Summon Scroll image
                  const img = document.createElement('img');
                  img.src = `https://bestiaryarena.com/assets/icons/summonscroll${tier}.png`;
                  img.className = 'pixelated';
                  img.width = '32';
                  img.height = '32';
                  img.alt = 'Summon Scroll';
                  
                  // Create the quantity indicator
                  const quantityIndicator = document.createElement('div');
                  quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
                  
                  const quantitySpan = document.createElement('span');
                  quantitySpan.className = 'relative font-outlined-fill text-white';
                  quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                  quantitySpan.setAttribute('translate', 'no');
                  
                  // Get quantity from inventory
                  const inventory = getInventoryState();
                  const quantity = inventory[targetItemKey] || 0;
                  quantitySpan.textContent = `${quantity}x`;
                  
                  // Assemble the structure
                  quantityIndicator.appendChild(quantitySpan);
                  hasRarityContainer.appendChild(img);
                  hasRarityContainer.appendChild(quantityIndicator);
                  summonScrollContainer.appendChild(hasRarityContainer);
                  
                                 // Replace Dust with Summon Scroll
               dustSlot.parentNode.replaceChild(summonScrollContainer, dustSlot);
               targetItemSlot = summonScrollContainer;
               
               // Remove the Summon Scroll icon from the price cell (second cell)
               const secondCell = tableCells[1];
               const summonScrollIconInPrice = secondCell.querySelector('img[src*="summonscroll"]');
               if (summonScrollIconInPrice) {
                 const iconContainer = summonScrollIconInPrice.closest('.container-slot');
                 if (iconContainer) {
                   iconContainer.remove();
                 }
               }
               
               // Update text content
               this.updateExchangeText(firstCellContainer, summonScrollContainer, targetItemKey);
                }
              }
            }
          }
          // Handle Ankrahmun-specific replacement (Dust -> Stone of Insight)
          else if (yasirLocation === 'ankrahmun' && targetItemKey === 'dust') {
            // Look for Stone of Insight first
            let insightStoneSlot = secondCell.querySelector('.sprite.item.id-21383');
            if (insightStoneSlot) {
              targetItemKey = 'insightStone5';
              targetItemSlot = insightStoneSlot.closest('.container-slot');
              this.handleInsightStoneExchange(tableCells, targetItemKey);
            }
          }
          // Handle Liberty Bay-specific replacement (Dust -> Legendary Dice Manipulator)
          else if (yasirLocation === 'libertyBay' && targetItemKey === 'dust') {
            // Look for Legendary Dice Manipulator in the second cell
            let legendaryDiceSlot = secondCell.querySelector('.sprite.item.id-35909');
            if (legendaryDiceSlot) {
              // Check if it's the legendary version (tier 5)
              const rarityElement = legendaryDiceSlot.closest('[data-rarity]');
              const rarity = rarityElement ? rarityElement.getAttribute('data-rarity') : '';
              if (rarity === '5') {
                targetItemKey = 'diceManipulator5';
                targetItemSlot = legendaryDiceSlot.closest('.container-slot');
                this.handleDiceManipulatorExchange(tableCells, targetItemKey);
              }
            }
          }
          // Handle other locations (default behavior)
          else {
            // Look for Stone of Insight first
            let insightStoneSlot = secondCell.querySelector('.sprite.item.id-21383');
            if (insightStoneSlot) {
              targetItemKey = 'insightStone5';
              targetItemSlot = insightStoneSlot.closest('.container-slot');
              this.handleInsightStoneExchange(tableCells, targetItemKey);
            } else {
              // Look for other items
              const itemSlot = secondCell.querySelector('.sprite.item');
              if (itemSlot) {
                targetItemKey = getItemKeyFromSlot(itemSlot);
                targetItemSlot = itemSlot.closest('.container-slot');
              } else {
                const summonScrollImg = secondCell.querySelector('img[src*="summonscroll"]');
                if (summonScrollImg) {
                  const srcMatch = summonScrollImg.src.match(/summonscroll(\d+)\.png/);
                  const tier = srcMatch ? srcMatch[1] : '1';
                  targetItemKey = `summonScroll${tier}`;
                  targetItemSlot = summonScrollImg.closest('.container-slot');
                }
              }
            }
          }
        }
      }
      
      return { targetContainer, targetItemSlot, targetItemKey };
    },
    
    // Handle Stone of Insight exchange section
    handleInsightStoneExchange(tableCells, targetItemKey) {
      const firstCell = tableCells[0];
      const secondCell = tableCells[1];
      const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
      
      if (firstCellContainer) {
        const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
        if (dustSlot) {
          const dailyItemSlot = secondCell.querySelector('.container-slot');
          if (dailyItemSlot) {
            const inventory = getInventoryState();
            const insightStoneQuantity = inventory.insightStone5 || 1;
            const stoneOfInsightContainer = createStoneOfInsightSprite(insightStoneQuantity);
            
            dustSlot.parentNode.replaceChild(stoneOfInsightContainer, dustSlot);
            stoneOfInsightContainer.setAttribute('data-item-key', 'insightStone5');
            dailyItemSlot.remove();
            
            this.updateExchangeText(firstCellContainer, dailyItemSlot, targetItemKey);
          }
        }
      }
    },
    
    // Handle Dice Manipulator exchange section (for Liberty Bay)
    handleDiceManipulatorExchange(tableCells, targetItemKey) {
      const firstCell = tableCells[0];
      const secondCell = tableCells[1];
      const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
      
      if (firstCellContainer) {
        const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
        if (dustSlot) {
          const dailyItemSlot = secondCell.querySelector('.container-slot');
          if (dailyItemSlot) {
            const inventory = getInventoryState();
            const diceManipulatorQuantity = inventory.diceManipulator5 || 1;
            
            // Create Dice Manipulator container similar to Stone of Insight
            const diceManipulatorContainer = document.createElement('div');
            diceManipulatorContainer.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
            diceManipulatorContainer.setAttribute('data-hoverable', 'false');
            diceManipulatorContainer.setAttribute('data-highlighted', 'false');
            diceManipulatorContainer.setAttribute('data-disabled', 'false');
            diceManipulatorContainer.setAttribute('data-item-key', targetItemKey);
            
            // Create the has-rarity container
            const hasRarityContainer = document.createElement('div');
            hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
            hasRarityContainer.setAttribute('data-rarity', '5');
            
            // Create the sprite container
            const spriteContainer = document.createElement('div');
            spriteContainer.className = 'sprite item relative id-35909';
            
            // Create the viewport
            const viewport = document.createElement('div');
            viewport.className = 'viewport';
            
            // Create the spritesheet image
            const img = document.createElement('img');
            img.alt = 'Dice Manipulator';
            img.setAttribute('data-cropped', 'false');
            img.className = 'spritesheet';
            img.src = 'https://bestiaryarena.com/assets/ITEM/35909.png';
            img.style.setProperty('--cropX', '0');
            img.style.setProperty('--cropY', '0');
            
            // Create the quantity indicator
            const quantityIndicator = document.createElement('div');
            quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
            
            const quantitySpan = document.createElement('span');
            quantitySpan.className = 'relative font-outlined-fill text-white';
            quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
            quantitySpan.setAttribute('translate', 'no');
            quantitySpan.textContent = `${diceManipulatorQuantity}x`;
            
            // Assemble the structure
            quantityIndicator.appendChild(quantitySpan);
            viewport.appendChild(img);
            spriteContainer.appendChild(viewport);
            hasRarityContainer.appendChild(spriteContainer);
            hasRarityContainer.appendChild(quantityIndicator);
            diceManipulatorContainer.appendChild(hasRarityContainer);
            
            dustSlot.parentNode.replaceChild(diceManipulatorContainer, dustSlot);
            dailyItemSlot.remove();
            
            this.updateExchangeText(firstCellContainer, dailyItemSlot, targetItemKey);
          }
        }
      }
    },
    
    // Update text content for exchange section
    updateExchangeText(firstCellContainer, dailyItemSlot, targetItemKey) {
      const textDivs = firstCellContainer.querySelectorAll('div:not(.container-slot):not(.better-yasir-right-side-wrapper):not(.has-rarity):not(.revert-pixel-font-spacing)');
      
      if (textDivs.length > 0) {
        const rarityElement = dailyItemSlot.querySelector('[data-rarity]');
        const rarity = rarityElement ? rarityElement.getAttribute('data-rarity') : '';
        
        let itemName = 'Daily Item';
        const spriteImg = dailyItemSlot.querySelector('.sprite.item img');
        if (spriteImg && spriteImg.alt) {
          itemName = spriteImg.alt;
        } else if (targetItemKey) {
          if (targetItemKey.startsWith('insightStone')) {
            itemName = 'Stone of Insight';
          } else if (targetItemKey.startsWith('diceManipulator')) {
            itemName = 'Dice Manipulator';
          } else if (targetItemKey.startsWith('summonScroll')) {
            itemName = 'Summon Scroll';
          } else {
            itemName = targetItemKey.charAt(0).toUpperCase() + targetItemKey.slice(1);
          }
        }
        
        const rarityClass = rarity ? `text-rarity-${rarity}` : 'text-whiteRegular';
        
        textDivs.forEach((textDiv) => {
          if (!textDiv.querySelector('.sprite, .viewport, .spritesheet') && !textDiv.classList.contains('revert-pixel-font-spacing')) {
            const rarityText = getItemRarityName(targetItemKey, rarity);
            textDiv.innerHTML = `${itemName}<p class="pixel-font-14 -mt-0.5 ${rarityClass}">${rarityText}</p>`;
          }
        });
      }
    },
    
    // Calculate max quantity based on action type and resources
    calculateMaxQuantity(targetItemKey, actionType, itemPrice, targetItemSlot, availableQuantity) {
      if (actionType === 'buy') {
        if (targetItemKey && targetItemKey.startsWith('diceManipulator')) {
          const yasirData = getYasirShopData();
          const diceCost = yasirData?.diceCost || 0;
          const playerGold = getPlayerGold();
          const minQuantity = getMinimumQuantityFromDOM(targetItemSlot);
          const pricePerQuantityUnit = diceCost * minQuantity;
          const maxFromGold = pricePerQuantityUnit > 0 ? Math.floor(playerGold / pricePerQuantityUnit) : 0;
          return Math.max(1, maxFromGold);
        } else {
          const playerDust = getPlayerDust();
          return itemPrice > 0 ? Math.floor(playerDust / itemPrice) : 0;
        }
      } else {
        return availableQuantity;
      }
    },
    
    // Create and position UI elements
    createUIElements(targetContainer, targetItemKey, maxQuantity, initialQuantity, actionType, itemPrice) {
      const quantityInput = createQuantityInput(maxQuantity, initialQuantity, 1);
      
      const rightSideWrapper = document.createElement('div');
      rightSideWrapper.className = 'better-yasir-right-side-wrapper';
      rightSideWrapper.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: auto;
        min-width: 60px;
      `;
      
      rightSideWrapper.appendChild(quantityInput);
      targetContainer.appendChild(rightSideWrapper);
      
      return { quantityInput, rightSideWrapper };
    },
    
    // Find target cell for button placement
    findTargetCell(container, tableRow, isExchangeSection) {
      if (isExchangeSection) {
        const tableCells = tableRow.querySelectorAll('td');
        return tableCells.length >= 2 ? tableCells[1] : null;
      } else {
        const currentCell = container.closest('td');
        return currentCell ? currentCell.nextElementSibling : null;
      }
    }
  };
  
  // Add quantity inputs to flex container divs (new function for the specific div structure)
  function addQuantityInputsToFlexContainers() {
    const flexContainers = domUtils.findFlexContainers();
    
    flexContainers.forEach((container, index) => {
      // Skip if already processed
      if (flexContainerHelpers.shouldSkipContainer(container)) {
        return;
      }
      
      // Find the item slot within this container
      const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
      if (!itemSlot) return;
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      if (!itemKey) return;
      
      // Check if item is out of stock
      if (flexContainerHelpers.isItemOutOfStock(container)) {
        return;
      }
      
      // Get table context and determine action type
      const tableRow = container.closest('tr');
      const { tableHeader, isExchangeSection } = domUtils.getTableContext(container);
      
      // Get target item information
      const { targetContainer, targetItemSlot, targetItemKey } = flexContainerHelpers.getTargetItemInfo(container, tableRow, isExchangeSection);
      
      // Determine action type
      const priceButton = container.querySelector('button');
      const buttonText = priceButton?.textContent?.trim() || '';
      const isTradeButton = buttonText === 'Trade';
      const actionType = (isExchangeSection || isTradeButton) ? 'sell' : 'buy';
      
      // Get item price
      let itemPrice = 0;
      if (isExchangeSection) {
        itemPrice = 10; // Exchange rate is 10 dust per item
      } else {
        // Use targetItemKey for price calculation, not the original itemKey
        itemPrice = getItemPriceWithFallback(targetItemKey, container);
        // For dice manipulators, don't skip if price is 0 initially - let retry mechanism handle it
        if (itemPrice === 0 && !targetItemKey.startsWith('diceManipulator')) {
          return; // Skip items with 0 price (out of stock), except dice manipulators
        }
      }
      
      // Validate target item
      if (!targetItemSlot || !targetItemKey) return;
      
      const availableQuantity = getItemQuantity(targetItemSlot);
      
      // Calculate quantities
      const maxQuantity = flexContainerHelpers.calculateMaxQuantity(targetItemKey, actionType, itemPrice, targetItemSlot, availableQuantity);
      const initialQuantity = targetItemKey.startsWith('diceManipulator') ? Math.max(1, Math.min(1, maxQuantity)) : Math.min(1, maxQuantity);
      
      // Create UI elements
      const { quantityInput } = flexContainerHelpers.createUIElements(targetContainer, targetItemKey, maxQuantity, initialQuantity, actionType, itemPrice);
      
      // Find target cell and add button
      const targetCell = flexContainerHelpers.findTargetCell(container, tableRow, isExchangeSection);
      
      if (targetCell) {
        const customActionButton = createCustomActionButton(actionType);
        quantityInput.value = initialQuantity.toString();
        updateActionButtonText(customActionButton, initialQuantity, actionType, itemPrice, targetItemKey);
        
        targetCell.appendChild(customActionButton);
        
        // Hide existing button
        const existingButton = targetCell.querySelector('button');
        if (existingButton) {
          existingButton.style.display = 'none';
        }
        
        // Add event listeners
        addEventListenersToInput(quantityInput, customActionButton, targetItemKey, maxQuantity, index, targetItemSlot, actionType, itemPrice);
        
        // Mark as processed
        if (tableRow) tableRow.dataset.betterYasirProcessed = 'true';
        processedElements.add(container);
        
        // Retry price if needed
        if ((itemPrice === 0 && !isExchangeSection) || targetItemKey.startsWith('diceManipulator')) {
          setTimeout(() => {
            const retryPrice = getItemPriceWithFallback(targetItemKey, container);
            if (retryPrice > 0) {
              updateActionButtonText(customActionButton, parseInt(quantityInput.value) || 1, actionType, retryPrice, targetItemKey);
            }
          }, 100);
        }
      }
    });
    
    // Update section titles and add price headers AFTER processing containers
    const modal = document.querySelector('.widget-bottom');
    if (modal) {
      updateSectionTitles(modal);
      addPriceColumnHeaders(modal);
    }
  }
  
  // Add event listeners to input and button
  function addEventListenersToInput(quantityInput, actionButton, itemKey, maxQuantity, index, itemSlot, actionType, itemPrice = 0) {
    // Debounce timer for input validation
    let validationTimeout = null;
    
    // Store references for cleanup
    const inputHandler = function() {
      const value = this.value.trim();
      let quantity;
      
      // Clear existing timeout
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
      
      // Basic validation for all input types
      if (value === '') {
        quantity = 1;
        this.value = '1';
      } else {
        quantity = parseInt(value) || 1;
        const currentMax = parseInt(this.max) || maxQuantity;
        
        // Only force correction if the value is way out of bounds
        if (quantity > currentMax && currentMax > 0) {
          quantity = currentMax;
          this.value = quantity.toString();
        } else if (quantity < 1) {
          quantity = 1;
          this.value = '1';
        }
      }
      
      // Update button text immediately - get the correct price for this item
      let correctItemPrice = itemPrice;
      if (itemKey && itemKey.startsWith('diceManipulator')) {
        // For dice manipulators, get the price from API data
        const yasirData = getYasirShopData();
        const diceCost = yasirData?.diceCost || 0;
        const minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
        correctItemPrice = diceCost * minQuantity; // Price per quantity unit
      }
      updateActionButtonText(actionButton, quantity, actionType, correctItemPrice, itemKey);
      
      // For buy actions, do a delayed validation to update max if needed
      if (actionType === 'buy') {
        validationTimeout = setTimeout(() => {
          // Get fresh resource data
          const currentDust = getPlayerDust();
          const currentGold = getPlayerGold();
          
          // Recalculate max based on current resources
          const newMax = calculateMaxQuantity(itemKey, itemPrice, itemSlot, currentDust, currentGold);
          
          // Only update max if it's significantly different
          if (Math.abs(newMax - parseInt(this.max)) > 1) {
            this.max = newMax;
            
            // Only force correction if current value is way out of bounds
            const currentValue = parseInt(this.value) || 1;
            if (currentValue > newMax && newMax > 0) {
              this.value = newMax.toString();
              // Get the correct price for this item
              let correctItemPrice = itemPrice;
              if (itemKey && itemKey.startsWith('diceManipulator')) {
                const yasirData = getYasirShopData();
                const diceCost = yasirData?.diceCost || 0;
                const minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
                correctItemPrice = diceCost * minQuantity;
              }
              updateActionButtonText(actionButton, newMax, actionType, correctItemPrice, itemKey);
            }
          }
        }, 100); // Longer delay to avoid interfering with typing
      }
    };
    
    // Store button click handler for cleanup
    const buttonHandler = async function(e) {
      e.stopPropagation();
      // Prevent multiple simultaneous clicks
      if (actionButton.disabled) {
        return;
      }
      
      const value = quantityInput.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Ensure quantity doesn't exceed the maximum (use current max attribute)
        const currentMax = parseInt(quantityInput.max) || maxQuantity;
        if (quantity > currentMax) {
          quantity = currentMax;
        }
      }
      
      // Confirmation after validations pass
      if (actionButton.dataset.confirm !== 'pending') {
        showConfirmationPrompt(quantity, itemKey, actionButton, actionType);
        return; // wait for second click
      } else {
        removeConfirmationPrompt();
        delete actionButton.dataset.confirm;
      }
      
      // Show loading state and disable button
      const originalText = actionButton.innerHTML;
      actionButton.innerHTML = actionType === 'buy' ? 'Buying...' : 'Exchanging...';
      removeConfirmationPrompt();
      actionButton.disabled = true;
      
      try {
        // Implement actual action logic
        await performAction(itemKey, quantity, actionType);
      } catch (error) {
        handleError(error, `${itemKey} ${actionType} failed`);
        
        // Show error state briefly
        actionButton.innerHTML = 'Error!';
        showTooltipMessage(`${actionType} failed. Please try again.`);
        setTimeout(() => {
          actionButton.innerHTML = originalText;
          actionButton.disabled = false;
        }, CONSTANTS.ERROR_DISPLAY_DURATION);
        return;
      } finally {
        // Restore button state
        actionButton.innerHTML = originalText;
        actionButton.disabled = false;
      }
    };
    
    // Add event listeners with stored references
    quantityInput.addEventListener('input', inputHandler);
    actionButton.addEventListener('click', buttonHandler);
    
    // Store references for cleanup
    quantityInput.dataset.betterYasirInputHandler = inputHandler;
    actionButton.dataset.betterYasirButtonHandler = buttonHandler;
  }
  
// =======================
// 4. Core UI Functions
// =======================
  
  // Main function to enhance the Yasir modal
  function enhanceYasirModal() {
    // Inject styles only when enhancing modal
    injectStyles();
    
    // Try multiple ways to find the Yasir modal
    let modal = null;
    
    // Method 1: Look for h2 with p containing "Yasir" and find the correct widget-bottom
    const yasirTitle = document.querySelector('h2 p');
    if (yasirTitle && yasirTitle.textContent.includes('Yasir')) {
      // Look for the widget-bottom that contains both the title and the tables
      const widgetBottom = yasirTitle.closest('.widget-bottom');
      if (widgetBottom && widgetBottom.textContent.includes('Current stock')) {
        modal = widgetBottom;
      }
    }
    
    // Method 2: Look for any widget-bottom containing both "Yasir" and the tables
    if (!modal) {
      const widgetBottoms = document.querySelectorAll('.widget-bottom');
      for (const widget of widgetBottoms) {
        const text = widget.textContent || '';
        if (text.includes('Yasir') && text.includes('Current stock') && text.includes('Exchange items for dust')) {
          modal = widget;
          break;
        }
      }
    }
    
    if (!modal) {
      return false;
    }
    
    // Check if we've already enhanced this modal
    if (modal.dataset.betterYasirEnhanced) {
      return true;
    }
    
    // Check if modal is currently being processed
    if (modal.dataset.betterYasirProcessing) {
      return false;
    }
    
    // Mark modal as being processed
    modal.dataset.betterYasirProcessing = 'true';
    
    // Process flex containers (for the new div structure) - this handles everything now
    addQuantityInputsToFlexContainers();
    
    // Mark as enhanced
    modal.dataset.betterYasirEnhanced = 'true';
    
    // Remove processing marker
    delete modal.dataset.betterYasirProcessing;
    
    return true;
  }
  
// =======================
// 5. Main Logic
// =======================
  
  // Update section titles in the Yasir modal
  function updateSectionTitles(modal) {
    try {
      // Find all table header cells in the entire document
      const sectionHeaders = document.querySelectorAll('th');
      
      sectionHeaders.forEach((header, index) => {
        const text = header.textContent?.trim();
        
        if (text === 'Current stock') {
          header.textContent = 'Buy';
          header.style.textAlign = 'center';
          header.style.color = '#32cd32'; // Green color
        } else if (text === 'Exchange items for dust') {
          header.textContent = 'Sell';
          header.style.textAlign = 'center';
          header.style.color = '#ff4d4d'; // Red color
        }
      });
    } catch (e) {
      console.log('[Better Yasir] Error updating section titles:', e);
    }
  }
  
  // Add price column headers to tables
  function addPriceColumnHeaders(modal) {
    try {
      // Find all tables in the entire document
      const tables = document.querySelectorAll('table');
      
      tables.forEach((table, tableIndex) => {
        // Check if this table already has a price header
        if (table.querySelector('.better-yasir-price-header')) {
          return;
        }
        
        // Find the table header row
        const thead = table.querySelector('thead');
        if (thead) {
          const headerRow = thead.querySelector('tr');
          if (headerRow) {
            // Check if the header already spans 2 columns (colspan="2")
            const existingHeader = headerRow.querySelector('th');
            if (existingHeader && existingHeader.getAttribute('colspan') === '2') {
              // Keep the original section title (Selling/Buying) instead of changing to "Item"
              const originalText = existingHeader.textContent;
              existingHeader.removeAttribute('colspan');
              // Don't change the text - keep it as "Selling" or "Buying"
              
              // Add price column header
              const priceHeader = document.createElement('th');
              priceHeader.textContent = 'Price';
              priceHeader.className = 'bg-grayRegular px-1 font-normal first:table-frame-bottom [&:not(:first-child)]:table-frame-bottom-left text-left better-yasir-price-header';
              priceHeader.style.textAlign = 'center';
              headerRow.appendChild(priceHeader);
            }
          }
        }
      });
    } catch (e) {
      console.log('[Better Yasir] Error adding price headers:', e);
    }
  }
  
  // Utility to transform Yasir tooltip title to activation text
  function transformYasirTooltip() {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip) return;
      const titleElem = tooltip.querySelector('p'); // first <p> is title
      if (titleElem && titleElem.textContent.includes("Yasir") && titleElem.textContent !== "Better Yasir activated!") {
        titleElem.textContent = "Better Yasir activated!";
        titleElem.style.color = '#32cd32';
      }
    } catch (e) { /* silent */ }
  }

  // Clear all caches to force fresh data
  function clearCaches() {
    cacheManager.clear();
    clearDomCache(); // Clear DOM cache
    // WeakMap doesn't have clear() method, so we create a new one
    itemKeyCache = new WeakMap();
  }
  
  // Clean up event listeners for better memory management
  function cleanupEventListeners() {
    const inputs = document.querySelectorAll('.better-yasir-quantity-input');
    inputs.forEach(input => {
      if (input.dataset.betterYasirInputHandler) {
        input.removeEventListener('input', input.dataset.betterYasirInputHandler);
        delete input.dataset.betterYasirInputHandler;
      }
    });
    
    const buttons = document.querySelectorAll('.better-yasir-action-button');
    buttons.forEach(button => {
      if (button.dataset.betterYasirButtonHandler) {
        button.removeEventListener('click', button.dataset.betterYasirButtonHandler);
        delete button.dataset.betterYasirButtonHandler;
      }
    });
  }

  // API request deduplication
  const pendingRequests = new Map();
  const REQUEST_TIMEOUT = 10000; // 10 seconds timeout
  
  // Request deduplication helper
  function deduplicateRequest(requestKey, requestFn) {
    // Check if there's already a pending request for this key
    if (pendingRequests.has(requestKey)) {
      const pending = pendingRequests.get(requestKey);
      if (Date.now() - pending.timestamp < REQUEST_TIMEOUT) {
        return pending.promise;
      } else {
        // Request timed out, remove it
        pendingRequests.delete(requestKey);
      }
    }
    
    // Create new request
    const promise = requestFn();
    pendingRequests.set(requestKey, {
      promise,
      timestamp: Date.now()
    });
    
    // Clean up when request completes
    promise.finally(() => {
      pendingRequests.delete(requestKey);
    });
    
    return promise;
  }
  
  // Batch state update helper
  const stateUpdateQueue = new Map();
  let stateUpdateTimeout = null;
  
  function queueStateUpdate(updates) {
    // Merge updates into queue
    Object.entries(updates).forEach(([key, value]) => {
      stateUpdateQueue.set(key, value);
    });
    
    // Schedule batch update if not already scheduled
    if (!stateUpdateTimeout) {
      stateUpdateTimeout = setTimeout(() => {
        flushStateUpdates();
      }, 50); // Batch updates every 50ms
    }
  }
  
  function flushStateUpdates() {
    if (stateUpdateQueue.size === 0) return;
    
    try {
      const player = globalThis.state?.player;
      if (!player) {
        console.warn('[Better Yasir] Player state not available for batch update');
        return;
      }
      
      const updates = Object.fromEntries(stateUpdateQueue);
      
      player.send({
        type: 'setState',
        fn: (prev) => {
          const newState = { ...prev };
          // Ensure nested inventory exists
          newState.inventory = { ...prev.inventory };
          
          Object.entries(updates).forEach(([itemKey, change]) => {
            if (change === 0) return;
            
            // Handle dust separately from inventory items
            if (itemKey === 'dust') {
              newState.dust = Math.max(0, (newState.dust || 0) + change);
              return;
            }
            
            // Handle gold separately from inventory items
            if (itemKey === 'gold') {
              newState.gold = Math.max(0, (newState.gold || 0) + change);
              return;
            }
            
            // Handle inventory items
            if (!newState.inventory[itemKey]) newState.inventory[itemKey] = 0;
            newState.inventory[itemKey] = Math.max(0, newState.inventory[itemKey] + change);
            // Mirror on root for compatibility
            newState[itemKey] = newState.inventory[itemKey];
          });
          
          return newState;
        }
      });
      
      // Force UI refresh after state update with a longer delay to ensure state propagation
      setTimeout(() => {
        // Clear caches first to force fresh data
        clearCaches();
        refreshUIAfterAction();
      }, 200);
      
      // Also try an immediate update for the specific item that was just changed
      const pendingUpdates = Object.fromEntries(stateUpdateQueue);
      if (pendingUpdates.insightStone5 !== undefined) {
        setTimeout(() => {
          // Update quantity display
          const modal = document.querySelector('.widget-bottom');
          if (modal) {
            const insightStoneSlot = modal.querySelector('.container-slot[data-item-key="insightStone5"]');
            if (insightStoneSlot) {
              const quantitySpan = insightStoneSlot.querySelector('.revert-pixel-font-spacing span');
              if (quantitySpan) {
                // Calculate the new quantity based on the pending update
                const currentQuantity = parseInt(quantitySpan.textContent.replace('x', '')) || 0;
                const change = pendingUpdates.insightStone5 || 0;
                const newQuantity = Math.max(0, currentQuantity + change);
                quantitySpan.textContent = `${newQuantity}x`;
              }
            }
          }
          
          // Also update input max values immediately
          refreshUIAfterAction();
        }, 50);
      }
      
      // Immediate gold update if gold changed
      if (pendingUpdates.gold !== undefined) {
        setTimeout(() => {
          // Get fresh gold amount and update displays immediately
          const currentGold = getPlayerGold();
          const currentDust = getPlayerDust();
          updateResourceDisplays(currentGold, currentDust);
        }, 25);
      }
      
    } catch (error) {
      handleError(error, 'Failed to batch update state');
    } finally {
      stateUpdateQueue.clear();
      stateUpdateTimeout = null;
    }
  }

  // Debounced function for processing mutations
  function debouncedProcessMutations(mutations) {
    // Quick check: if no Yasir-related content, skip processing entirely
    const hasYasirContent = mutations.some(mutation => 
      mutation.addedNodes.length > 0 && 
      Array.from(mutation.addedNodes).some(node => 
        node.nodeType === Node.ELEMENT_NODE && 
        (node.textContent?.includes('Yasir') || 
         node.querySelector?.('*') && 
         Array.from(node.querySelectorAll('*')).some(el => 
           el.textContent?.includes('Yasir')
         ))
      )
    );
    
    if (!hasYasirContent) return;
    
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }
    
    observerTimeout = setTimeout(() => {
      // Always attempt tooltip transform
      transformYasirTooltip();
      
      // Check for flex containers that might need enhancement
      // Only process if we're not currently in a UI refresh cycle
      if (!document.body.dataset.betterYasirRefreshing) {
        const flexContainers = document.querySelectorAll('div.flex.items-center.gap-1\\.5.dithered.px-1, div.flex.items-center.gap-1\\.5');
        if (flexContainers.length > 0) {
          addQuantityInputsToFlexContainers();
        }
      }
      
      // Check if already processing to avoid duplicate work
      const existingModal = document.querySelector(`${SELECTORS.YASIR_MODAL}[data-better-yasir-enhanced]`);
      if (existingModal) {
        return;
      }
      
      // Clear caches when modal changes
      clearCaches();
      
      // Find and process the modal
      const widgetBottoms = document.querySelectorAll(SELECTORS.YASIR_MODAL);
      for (const widget of widgetBottoms) {
        if (widget.querySelector('table') && 
            !widget.dataset.betterYasirProcessing && 
            !widget.dataset.betterYasirEnhanced) {
          widget.dataset.betterYasirProcessing = 'true';
          enhanceYasirModal();
          if (widget.dataset.betterYasirProcessing) {
            delete widget.dataset.betterYasirProcessing;
          }
          break; // Only process one modal at a time
        }
      }
    }, CONSTANTS.DEBOUNCE_DELAY);
  }
  
  // Retry mechanism for modal enhancement
  function retryEnhanceYasirModal(maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS, baseDelay = CONSTANTS.RETRY_BASE_DELAY) {
    let attempts = 0;
    
    const tryEnhance = () => {
      attempts++;
      if (enhanceYasirModal()) {
        return; // Success, stop retrying
      }
      
      if (attempts < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
        setTimeout(tryEnhance, delay);
      } else {
        console.warn('[Better Yasir] Failed to enhance modal after maximum retry attempts');
      }
    };
    
    tryEnhance();
  }
  
  function initializeBetterYasir() {
    // Set up observer to watch for DOM changes
    observer = new MutationObserver(debouncedProcessMutations);
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Run initial tooltip transform
    transformYasirTooltip();

    // Check for flex containers on startup
    addQuantityInputsToFlexContainers();

    // Use retry mechanism instead of multiple timeouts
    retryEnhanceYasirModal();
  }
  
  function cleanup() {
    // Cleanup all event listeners
    cleanupAllEventListeners();
    
    // Cleanup confirmation handler
    cleanupConfirmationHandler();
    
    // Cleanup observers and timeouts
    cleanupObservers();
    
    // Cleanup state update timeout
    if (stateUpdateTimeout) {
      clearTimeout(stateUpdateTimeout);
      stateUpdateTimeout = null;
    }
    
    // Flush any pending state updates
    flushStateUpdates();
    
    // Clear pending requests
    pendingRequests.clear();
    
    // Remove styles
    const styleElement = document.getElementById('better-yasir-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    // Remove enhanced markers
    document.querySelectorAll('[data-better-yasir-enhanced]').forEach(element => {
      delete element.dataset.betterYasirEnhanced;
    });
    
    // Remove table processing markers
    document.querySelectorAll('[data-better-yasir-table-processed]').forEach(element => {
      delete element.dataset.betterYasirTableProcessed;
    });
    
    // Remove modal processing markers
    document.querySelectorAll('[data-better-yasir-processing]').forEach(element => {
      delete element.dataset.betterYasirProcessing;
    });
    
    // Remove quantity inputs and custom buttons
    document.querySelectorAll('.better-yasir-quantity-input, .better-yasir-action-button').forEach(element => {
      element.remove();
    });
    
    // Show original buttons that were hidden
    document.querySelectorAll('button[style*="display: none"]').forEach(button => {
      if (button.parentNode.querySelector('.better-yasir-action-button')) {
        button.style.display = '';
      }
    });
  }
  
  // Initialize the mod
  console.log('[Better Yasir] initializing...');
  initializeBetterYasir();
  
  // Export cleanup function for the mod loader
  if (typeof context !== 'undefined') {
    context.exports = {
      cleanup: cleanup,
      refreshUI: refreshUIAfterAction,
      debugInventory: () => {
        const gameState = getGameState();
        console.log('[Better Yasir] Current inventory:', gameState?.playerState?.inventory);
        console.log('[Better Yasir] insightStone5 quantity:', gameState?.playerState?.inventory?.insightStone5);
      },
      fixInputMax: () => {
        const gameState = getGameState();
        const currentQuantity = gameState?.playerState?.inventory?.insightStone5 || 0;
        console.log('[Better Yasir] Fixing input max for insightStone5, current quantity:', currentQuantity);
        
        const inputs = document.querySelectorAll('.better-yasir-quantity-input');
        inputs.forEach((input, index) => {
          const container = input.closest('div.flex.items-center.gap-1\\.5');
          if (container) {
            const itemSlot = container.querySelector('.container-slot');
            if (itemSlot) {
              const itemKey = getItemKeyFromSlot(itemSlot);
              if (itemKey === 'insightStone5') {
                console.log(`[Better Yasir] Found insightStone5 input ${index}, updating max from ${input.max} to ${currentQuantity}`);
                input.max = currentQuantity;
                const currentValue = parseInt(input.value) || 1;
                const newValue = Math.min(currentValue, Math.max(1, currentQuantity));
                input.value = newValue.toString();
                console.log(`[Better Yasir] Updated input value from ${currentValue} to ${newValue}`);
              }
            }
          }
        });
      }
    };
  }
  
})(); 