// =======================
// Quests Mod for Bestiary Arena
// =======================
console.log('[Quests Mod] Initializing...');

// =======================
// 1. Constants
// =======================

const BUTTON_CHECK_INTERVAL = 1000;
const BUTTON_CHECK_TIMEOUT = 10000;
const BUTTON_RETRY_MAX = 3;
const BUTTON_RETRY_DELAY = 250;
const OBSERVER_DEBOUNCE_DELAY = 250;
const OBSERVER_MIN_INTERVAL = 100;
const KING_TIBI_MODAL_WIDTH = 450;
const KING_TIBI_MODAL_HEIGHT = 500;
const QUEST_ITEMS_MODAL_WIDTH = 500;
const QUEST_ITEMS_MODAL_HEIGHT = 180;
const KING_GUILD_COIN_REWARD = 50;

const KING_COPPER_KEY_MISSION = {
  id: 'king_copper_key',
  title: 'Retrieve King Tibianus belongings',
  prompt: 'Glad you asked! One of my guards lost my precious copper key down in the mines. Would you be able to help me get it back?',
  accept: 'Thank you! Let me know when you\'ve retrieved it!',
  askForKey: 'Have you found my key?',
  complete: 'Splendid! You found my key. The mission is complete.',
  missingKey: 'You claim yes but carry no key? Begone!',
  keepSearching: 'Then keep searching and return when you have it.',
  answerYesNo: 'Answer yes or no: have you found my key?',
  alreadyCompleted: 'You already completed this mission. Excellent work, my subject.',
  alreadyActive: 'You are already on this mission. Bring me back the copper key!',
  objectiveLine1: 'A guard lost the king\'s copper key deep in the mines.',
  objectiveLine2: 'Find the copper key and return it to King Tibianus.',
  hint: 'It seems as I must steal it from the angry Dwarfs as they probably won\'t let me have it without resistance.',
  rewardCoins: KING_GUILD_COIN_REWARD
};

const KING_RED_DRAGON_MISSION = {
  id: 'king_red_dragon',
  title: 'Stock the Royal Forge',
  prompt: 'Brave subject, I need supplies for my smiths: bring me 100 red dragon scales and 100 red dragon leathers.',
  accept: 'Excellent. Return once you have the materials.',
  askForItems: 'Have you brought the red dragon materials?',
  complete: 'Well done! The royal forge will thrive with these materials.',
  missingItems: 'You claim yes but lack the materials. Do not waste my time.',
  keepSearching: 'Then keep hunting dragons and return when you have them.',
  answerYesNo: 'Answer yes or no: have you brought the materials?',
  alreadyCompleted: 'You already completed this task. Impressive work.',
  alreadyActive: 'You are already on this task. Bring me the materials.',
  objectiveLine1: 'Gather 100 red dragon scales.',
  objectiveLine2: 'Gather 100 red dragon leathers.',
  hint: 'Hunt red dragons and skin them for scales and leather.',
  rewardCoins: 0
};

// Firebase configuration
const FIREBASE_CONFIG = {
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app'
};

// =======================
// Quest Items Configuration
// Maps creature gameId to their quest item drops
// =======================

const QUEST_ITEMS_CONFIG = {
  // Dragon Lord (gameId: 26) - Normal creature
  26: {
    creatureName: 'Dragon Lord',
    products: [
      {
        name: 'Red Dragon Leather',
        icon: 'Red_Dragon_Leather.PNG',
        dropChance: 0.50, // 50% chance
        description: 'Obtained by defeating Dragon Lord'
      },
      {
        name: 'Red Dragon Scale',
        icon: 'Red_Dragon_Scale.PNG',
        dropChance: 0.50, // 50% chance
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
// Copper Key Configuration
// =======================

const COPPER_KEY_CONFIG = {
  productName: 'Copper Key',
  icon: 'Copper_Key.PNG',
  targetRoomName: 'Mine Hub',
  targetMonsterName: 'Corym Charlatan',
  targetTileIndex: 69,
  description: 'A very ornate key, made of solid copper.'
};


const KING_TIBIANUS_TAB_ID = 'quests-mod-king-tibianus-tab';

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
  
  // Quest items drop system state
  let questItemsBoardSubscription = null;
  let lastProcessedQuestItemsSeed = null;
  
  // Copper Key system state
  let copperKeyBoardSubscription = null;
  let lastProcessedCopperKeySeed = null;
  let trackedBoardConfig = null; // Track boardConfig before battle for verification
  let equipmentSlotObserver = null; // Observer for equipment slot display
  
  // Quest items cache
  let cachedQuestItems = null; // Cache for loaded quest items
  
  // Quest log monitoring state
  let questLogObserver = null;
  let questLogMonitorInterval = null;
  let questLogObserverTimeout = null;

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

  // Helper function to get quest items asset URL
  function getQuestItemsAssetUrl(filename) {
    const imagePath = '/assets/quests/' + filename;
    
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
      console.warn('[Quests Mod] Error getting URL from browser API:', e);
    }
    
    // Try window.BESTIARY_EXTENSION_BASE_URL
    if (typeof window !== 'undefined' && window.BESTIARY_EXTENSION_BASE_URL) {
      cachedExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
    }
    
    if (cachedExtensionBaseUrl) {
      return constructUrl(cachedExtensionBaseUrl, imagePath);
    }
    
    // Last resort: return path
    console.warn('[Quests Mod] Could not determine extension runtime URL, using relative path:', imagePath);
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
    iconImg.src = getQuestItemsAssetUrl(productDef.icon);
    iconImg.alt = productDef.name;
    iconImg.className = 'pixelated';
    iconImg.style.cssText = `width: ${size}px; height: ${size}px; image-rendering: pixelated;`;
    return iconImg;
  }

  // =======================
  // Copper Key Equipment Slot Display
  // =======================

  // Helper to find Corym Charlatan element in a tile
  function findCorymCharlatanElement(tileElement) {
    if (!tileElement) return null;
    
    const creatureNameElements = tileElement.querySelectorAll('span[translate="no"]');
    for (const nameEl of creatureNameElements) {
      const text = nameEl.textContent || '';
      if (text.includes('Corym') && text.includes('Charlatan')) {
        let parent = nameEl.parentElement;
        let depth = 0;
        while (parent && !parent.querySelector('.h-1') && depth < 10) {
          parent = parent.parentElement;
          depth++;
        }
        if (parent && parent.querySelector('.h-1')) {
          return parent;
        }
      }
    }
    return null;
  }

  // Add "Found Copper Key!" text bubble above Corym Charlatan
  async function addCopperKeyTextBubble(tileIndex) {
    try {
      console.log('[Quests Mod][Copper Key] Attempting to add text bubble for tile', tileIndex);
      
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        console.log('[Quests Mod][Copper Key] No player name, skipping text bubble');
        return;
      }
      
      const hasReceived = await hasReceivedCopperKey(currentPlayer);
      if (hasReceived) {
        console.log('[Quests Mod][Copper Key] Player already received key, skipping text bubble');
        return;
      }
      
      const tileElement = getTileElement(tileIndex);
      if (!tileElement) {
        console.log('[Quests Mod][Copper Key] Tile element not found for tile', tileIndex);
        return;
      }
      
      const corymElement = findCorymCharlatanElement(tileElement);
      if (!corymElement) {
        console.log('[Quests Mod][Copper Key] Corym Charlatan element not found in DOM');
        return;
      }
      
      if (corymElement.querySelector('.copper-key-text-bubble')) {
        console.log('[Quests Mod][Copper Key] Text bubble already exists');
        return;
      }
      
      const textBubble = document.createElement('div');
      textBubble.className = 'copper-key-text-bubble';
      textBubble.style.cssText = `
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid rgb(230, 215, 176);
        border-radius: 4px;
        padding: 4px 8px;
        white-space: nowrap;
        z-index: 20001;
        pointer-events: none;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        color: rgb(230, 215, 176);
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      `;
      textBubble.textContent = 'Found Copper Key!';
      
      corymElement.style.position = 'relative';
      corymElement.appendChild(textBubble);
      
      console.log('[Quests Mod][Copper Key] ✅ Added text bubble for tile', tileIndex);
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error adding text bubble:', error);
    }
  }

  // Remove Copper Key text bubble
  function removeCopperKeyTextBubble(tileIndex) {
    try {
      const tileElement = getTileElement(tileIndex);
      if (!tileElement) {
        return;
      }
      
      const existingBubble = tileElement.querySelector('.copper-key-text-bubble');
      if (existingBubble && existingBubble.parentNode) {
        existingBubble.parentNode.removeChild(existingBubble);
        console.log('[Quests Mod][Copper Key] ✅ Removed text bubble for tile', tileIndex);
        return;
      }
      
      const corymElement = findCorymCharlatanElement(tileElement);
      if (corymElement) {
        const textBubble = corymElement.querySelector('.copper-key-text-bubble');
        if (textBubble && textBubble.parentNode) {
          textBubble.parentNode.removeChild(textBubble);
          console.log('[Quests Mod][Copper Key] ✅ Removed text bubble for tile', tileIndex);
        }
      }
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error removing text bubble:', error);
    }
  }

  // Helper function to get tile element by index
  function getTileElement(tileIndex) {
    return document.querySelector(`[id^="tile-index-${tileIndex}"]`) || 
           document.querySelector(`[id="tile-index-${tileIndex}"]`);
  }
  
  // Helper function to find the key sprite (id-2970) within a tile element
  function findKeySprite(tileElement) {
    if (!tileElement) return null;
    
    // Try direct selectors first
    let spriteDiv = tileElement.querySelector('.sprite.item.id-2970') ||
                   tileElement.querySelector('.sprite.item.relative.id-2970');
    
    if (spriteDiv) return spriteDiv;
    
    // Fallback: search all sprites by class list
    const allSprites = tileElement.querySelectorAll('.sprite.item');
    for (const sprite of allSprites) {
      if (sprite.classList.contains('id-2970')) {
        return sprite;
      }
    }
    
    return null;
  }
  
  // Animate the key sprite with a funky animation
  function animateCopperKey(tileIndex) {
    try {
      const tileElement = getTileElement(tileIndex);
      if (!tileElement) {
        return null;
      }
      
      const spriteDiv = findKeySprite(tileElement);
      if (!spriteDiv) {
        return null;
      }
      
      // Store original styles
      const originalTransform = spriteDiv.style.transform || '';
      const originalTransition = spriteDiv.style.transition || '';
      
      // Add funky animation: spin, bounce, pulse, and glow
      spriteDiv.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      spriteDiv.style.transformOrigin = 'center center';
      spriteDiv.style.zIndex = '10001';
      
      // Create keyframe animations
      const animationKeyframes = `
        @keyframes copperKeyFunky {
          0% {
            transform: rotate(0deg) scale(1);
            filter: brightness(1) drop-shadow(0 0 0px rgba(255, 215, 0, 0));
          }
          25% {
            transform: rotate(180deg) scale(1.3);
            filter: brightness(1.5) drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
          }
          50% {
            transform: rotate(360deg) scale(0.9);
            filter: brightness(1.2) drop-shadow(0 0 15px rgba(255, 215, 0, 1));
          }
          75% {
            transform: rotate(540deg) scale(1.2);
            filter: brightness(1.4) drop-shadow(0 0 12px rgba(255, 215, 0, 0.9));
          }
          100% {
            transform: rotate(720deg) scale(1);
            filter: brightness(1) drop-shadow(0 0 0px rgba(255, 215, 0, 0));
          }
        }
        
        @keyframes copperKeyExplode {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
            filter: brightness(1) drop-shadow(0 0 0px rgba(255, 215, 0, 0));
          }
          50% {
            transform: scale(1.5) rotate(180deg);
            opacity: 0.8;
            filter: brightness(2) drop-shadow(0 0 20px rgba(255, 215, 0, 1));
          }
          100% {
            transform: scale(2.5) rotate(360deg);
            opacity: 0;
            filter: brightness(3) drop-shadow(0 0 30px rgba(255, 215, 0, 0));
          }
        }
        
        @keyframes explosionParticle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }
      `;
      
      // Inject keyframes if not already present
      let styleSheet = document.getElementById('copper-key-animation-styles');
      if (!styleSheet) {
        styleSheet = document.createElement('style');
        styleSheet.id = 'copper-key-animation-styles';
        styleSheet.textContent = animationKeyframes;
        document.head.appendChild(styleSheet);
      }
      
      // Apply initial animation
      spriteDiv.style.animation = 'copperKeyFunky 2s ease-in-out';
      
      console.log('[Quests Mod][Copper Key] Started funky animation on key sprite');
      
      return spriteDiv;
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error animating key:', error);
      return null;
    }
  }
  
  // Create explosion effect with particles
  function createExplosionEffect(spriteDiv, tileElement) {
    try {
      if (!spriteDiv || !tileElement) return;
      
      // Get sprite position
      const rect = spriteDiv.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Create explosion container
      const explosionContainer = document.createElement('div');
      explosionContainer.style.cssText = `
        position: fixed;
        left: ${centerX}px;
        top: ${centerY}px;
        width: 0;
        height: 0;
        pointer-events: none;
        z-index: 10002;
      `;
      document.body.appendChild(explosionContainer);
      
      // Create particles (golden sparkles)
      const particleCount = 12;
      for (let i = 0; i < particleCount; i++) {
        const angle = (360 / particleCount) * i;
        const distance = 40 + Math.random() * 20;
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        
        const particle = document.createElement('div');
        particle.style.cssText = `
          position: absolute;
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, rgba(255, 215, 0, 1) 0%, rgba(255, 165, 0, 0.8) 50%, transparent 100%);
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(255, 215, 0, 0.8);
          --tx: ${tx}px;
          --ty: ${ty}px;
          animation: explosionParticle 0.6s ease-out forwards;
        `;
        explosionContainer.appendChild(particle);
      }
      
      // Create central flash
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: absolute;
        left: -30px;
        top: -30px;
        width: 60px;
        height: 60px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 215, 0, 0.6) 50%, transparent 100%);
        border-radius: 50%;
        animation: explosionParticle 0.4s ease-out forwards;
        --tx: 0px;
        --ty: 0px;
      `;
      explosionContainer.appendChild(flash);
      
      // Remove explosion container after animation
      setTimeout(() => {
        if (explosionContainer.parentNode) {
          explosionContainer.parentNode.removeChild(explosionContainer);
        }
      }, 600);
      
      console.log('[Quests Mod][Copper Key] Created explosion effect');
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error creating explosion effect:', error);
    }
  }
  
  // Trigger explosion animation on the key sprite
  function explodeCopperKey(spriteDiv, tileElement) {
    try {
      if (!spriteDiv) return;
      
      // Apply explosion animation
      spriteDiv.style.animation = 'copperKeyExplode 0.5s ease-out forwards';
      
      // Create particle explosion effect
      createExplosionEffect(spriteDiv, tileElement);
      
      console.log('[Quests Mod][Copper Key] Started explosion animation');
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error exploding key:', error);
    }
  }
  
  // Helper function to remove key from a specific element
  // removeSprite: if true, removes the actual game sprite div (id-2970). Only use this after serverResults verification!
  function removeKeyFromElement(element, tileIndex, removeSprite = false) {
    try {
      // Only remove the actual sprite div if explicitly requested (after serverResults verification)
      if (removeSprite) {
        const spriteDiv = findKeySprite(element);
        if (spriteDiv) {
          spriteDiv.remove();
          console.log('[Quests Mod][Copper Key] Removed sprite div (id-2970) and all children for tile', tileIndex);
        }
      }
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error removing key from element:', error);
    }
  }

  // Setup observer for text bubble display
  // NOTE: Text bubble is now only shown AFTER server results confirm the key was awarded
  // This function is kept for cleanup purposes but doesn't actively monitor board state
  function setupEquipmentSlotObserver() {
    // Observer disabled - text bubble only appears after server results confirm key award
    console.log('[Quests Mod][Copper Key] Text bubble observer set up (disabled - only shows after server results)');
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
  function buildProductDefinitions(options = {}) {
    const {
      includeCopperKey = true,
      includeObsidianKnife = false,
      includeDragonClaw = false
    } = options;
    const productDefinitions = [];
    for (const [creatureGameId, creatureConfig] of Object.entries(QUEST_ITEMS_CONFIG)) {
      for (const product of creatureConfig.products) {
        if (!productDefinitions.find(p => p.name === product.name)) {
          productDefinitions.push(product);
        }
      }
    }
    
    // Add Copper Key to product definitions (optional)
    if (includeCopperKey) {
      const copperKeyDef = {
        name: COPPER_KEY_CONFIG.productName,
        icon: COPPER_KEY_CONFIG.icon,
        description: 'Obtained by placing Corym Charlatan on tile 69 in Mine Hub and achieving victory'
      };
      if (!productDefinitions.find(p => p.name === copperKeyDef.name)) {
        productDefinitions.push(copperKeyDef);
      }
    }

    // Add Obsidian Knife (for active red dragon mission only)
    if (includeObsidianKnife) {
      const obsidianKnifeDef = {
        name: 'Obsidian Knife',
        icon: 'Obsidian_Knife.gif',
        description: 'Sharp and light, this is a useful tool for tanners, doctors and assassins.'
      };
      if (!productDefinitions.find(p => p.name === obsidianKnifeDef.name)) {
        productDefinitions.push(obsidianKnifeDef);
      }
    }

    if (includeDragonClaw) {
      const dragonClawDef = {
        name: 'Dragon Claw',
        icon: 'Dragon_Claw.gif',
        description: 'It is the claw of Demodras.'
      };
      if (!productDefinitions.find(p => p.name === dragonClawDef.name)) {
        productDefinitions.push(dragonClawDef);
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

  function getQuestItemsApiUrl() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/quest-items`;
  }

  function getCopperKeyFirebasePath() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/copper-key-rewards`;
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
      console.error('[Quests Mod] Error getting current player name:', error);
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
      console.warn('[Quests Mod] Username hashing failed, using fallback:', error);
      return username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
  }

  // =======================
  // Copper Key Helper Functions
  // =======================

  // Get Corym Charlatan gameId
  function getCorymCharlatanGameId() {
    try {
      const monsterName = COPPER_KEY_CONFIG.targetMonsterName.toLowerCase();
      
      // Try BestiaryModAPI utility first
      if (window.BestiaryModAPI?.utility?.maps?.monsterNamesToGameIds) {
        const gameId = window.BestiaryModAPI.utility.maps.monsterNamesToGameIds.get(monsterName);
        if (gameId) {
          return gameId;
        }
      }
      
      // Try creature database
      if (window.creatureDatabase?.findMonsterByName) {
        const monster = window.creatureDatabase.findMonsterByName(COPPER_KEY_CONFIG.targetMonsterName);
        if (monster?.gameId) {
          return monster.gameId;
        }
      }
      
      // Try searching through all monsters using game state API
      if (globalThis.state?.utils?.getMonster) {
        // Try common gameIds first (Corym Charlatan is likely in a specific range)
        for (let gameId = 1; gameId <= 200; gameId++) {
          try {
            const monsterData = globalThis.state.utils.getMonster(gameId);
            if (monsterData?.metadata?.name?.toLowerCase() === monsterName) {
              return gameId;
            }
          } catch (e) {
            // Continue searching
          }
        }
      }
      
      console.warn('[Quests Mod][Copper Key] Could not find Corym Charlatan gameId');
      return null;
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error getting Corym Charlatan gameId:', error);
      return null;
    }
  }

  // Get Mine Hub room ID
  function getMineHubRoomId() {
    try {
      const roomName = COPPER_KEY_CONFIG.targetRoomName;
      
      // Try ROOM_NAME reverse lookup
      if (globalThis.state?.utils?.ROOM_NAME) {
        const roomNames = globalThis.state.utils.ROOM_NAME;
        for (const [roomId, name] of Object.entries(roomNames)) {
          if (name === roomName) {
            return roomId;
          }
        }
      }
      
      // Try ROOM_ID if it exists as a direct mapping
      if (globalThis.state?.utils?.ROOM_ID) {
        // Check if there's a property matching the name
        const roomIdObj = globalThis.state.utils.ROOM_ID;
        for (const [key, value] of Object.entries(roomIdObj)) {
          if (typeof value === 'string') {
            // Check if the value matches room name via ROOM_NAME
            if (globalThis.state?.utils?.ROOM_NAME?.[value] === roomName) {
              return value;
            }
          }
        }
      }
      
      console.warn('[Quests Mod][Copper Key] Could not find Mine Hub room ID');
      return null;
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error getting Mine Hub room ID:', error);
      return null;
    }
  }

  // Check if user is on Mine Hub
  function isOnMineHub() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
      if (!boardContext) {
        return false;
      }
      
      const currentRoomId = boardContext.selectedMap?.selectedRoom?.id;
      if (!currentRoomId) {
        return false;
      }
      
      const mineHubRoomId = getMineHubRoomId();
      if (!mineHubRoomId) {
        return false;
      }
      
      return currentRoomId === mineHubRoomId;
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error checking if on Mine Hub:', error);
      return false;
    }
  }

  // Check if Corym Charlatan (ally) is on tile 69 in boardConfig
  function hasCorymCharlatanOnTile69(boardConfig, serverResults = null) {
    try {
      if (!boardConfig || !Array.isArray(boardConfig)) {
        return false;
      }
      
      const corymGameId = getCorymCharlatanGameId();
      if (!corymGameId) {
        return false;
      }
      
      const targetTileIndex = COPPER_KEY_CONFIG.targetTileIndex;
      
      // Check for ally pieces (type: 'player' or type: 'custom' with villain: false)
      return boardConfig.some(piece => {
        if (!piece) return false;
        
        // Must be an ally (not villain)
        const isAlly = piece.type === 'player' || (piece.type === 'custom' && piece.villain === false);
        if (!isAlly) return false;
        
        // Must be on tile 69
        if (piece.tileIndex !== targetTileIndex) return false;
        
        // Check gameId directly first
        let pieceGameId = piece.gameId || piece.monsterId;
        
        // If no gameId but has databaseId, try to look it up
        if (!pieceGameId && piece.databaseId) {
          // Try to get gameId from player's monsters
          try {
            const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
            if (playerContext?.monsters) {
              const monster = playerContext.monsters.find(m => m.id === piece.databaseId);
              if (monster?.gameId) {
                pieceGameId = monster.gameId;
              }
            }
          } catch (e) {
            // Ignore errors
          }
          
          // Also try serverResults.party if available
          if (!pieceGameId && serverResults?.rewardScreen?.party) {
            const partyMember = serverResults.rewardScreen.party.find(p => p.id === piece.databaseId);
            if (partyMember?.gameId) {
              pieceGameId = partyMember.gameId;
            }
          }
        }
        
        // Must be Corym Charlatan
        return pieceGameId === corymGameId;
      });
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error checking Corym Charlatan on tile 69:', error);
      return false;
    }
  }

  // Generic Firebase fetch helper with error handling
  async function fetchFirebaseData(url, errorContext, defaultReturn = null) {
    try {
      const response = await fetch(`${url}.json`);
      if (!response.ok) {
        if (response.status === 404) {
          return defaultReturn;
        }
        throw new Error(`Failed to ${errorContext}: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[Quests Mod] Error ${errorContext}:`, error);
      return defaultReturn;
    }
  }

  // Check if player has received Copper Key
  async function hasReceivedCopperKey(playerName) {
    if (!playerName) {
      return false;
    }
    
    const hashedPlayer = await hashUsername(playerName);
    const data = await fetchFirebaseData(
      `${getCopperKeyFirebasePath()}/${hashedPlayer}`,
      'check Copper Key status',
      null
    );
    
    return data && data.received === true;
  }

  // Mark Copper Key as received in Firebase
  async function markCopperKeyReceived(playerName) {
    try {
      if (!playerName) {
        throw new Error('Player name not available');
      }
      
      const hashedPlayer = await hashUsername(playerName);
      const data = {
        received: true,
        timestamp: Date.now()
      };
      
      await firebaseRequest(
        `${getCopperKeyFirebasePath()}/${hashedPlayer}`,
        'PUT',
        data,
        'mark Copper Key as received'
      );
      
      console.log('[Quests Mod][Copper Key] Marked as received for player:', hashedPlayer);
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error marking as received:', error);
      throw error;
    }
  }

  // =======================
  // Encryption Functions
  // =======================

  async function deriveQuestItemsKey(username) {
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
      console.error('[Quests Mod] Error deriving quest items key:', error);
      throw error;
    }
  }

  async function encryptQuestItems(productsObject, username) {
    try {
      const key = await deriveQuestItemsKey(username);
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
      console.error('[Quests Mod] Error encrypting quest items:', error);
      throw error;
    }
  }

  async function decryptQuestItems(encryptedText, username) {
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
      
      const key = await deriveQuestItemsKey(username);
      
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
      console.warn('[Quests Mod] Error decrypting quest items:', error);
      return {};
    }
  }

  // Normalize quest item keys to canonical names to avoid variant keys
  function normalizeQuestItems(products) {
    if (!products || typeof products !== 'object') return {};
    const canonicalMap = {
      'red dragon leather': 'Red Dragon Leather',
      'red_dragon_leather': 'Red Dragon Leather',
      'red dragon scale': 'Red Dragon Scale',
      'red_dragon_scale': 'Red Dragon Scale',
      'copper key': COPPER_KEY_CONFIG.productName.toLowerCase(),
      'obsidian knife': 'Obsidian Knife',
      'dragon claw': 'Dragon Claw',
      'dragon_claw': 'Dragon Claw'
    };
    const normalized = {};
    for (const [key, value] of Object.entries(products)) {
      const lower = key.toLowerCase();
      const canonical = canonicalMap[lower] || key;
      normalized[canonical] = (normalized[canonical] || 0) + (value || 0);
    }
    return normalized;
  }

  // Dev helper to grant quest items for testing (exposed to console)
  function registerDevGrantHelper() {
    globalThis.questsDevGrant = async function ({ leather = 0, scale = 0 } = {}) {
      try {
        if (leather > 0) {
          await addQuestItem('Red Dragon Leather', leather);
        }
        if (scale > 0) {
          await addQuestItem('Red Dragon Scale', scale);
        }
        console.log('[Quests Mod][Dev] Granted', { leather, scale });
      } catch (err) {
        console.error('[Quests Mod][Dev] Grant failed:', err);
      }
    };
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

  // King Tibianus quest progress helpers
  function getKingTibianusProgressPath() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/king-tibianus/progress`;
  }

  async function getKingTibianusProgress(playerName) {
    if (!playerName) {
      return { accepted: false, completed: false };
    }
    const hashedPlayer = await hashUsername(playerName);
    const data = await fetchFirebaseData(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      'fetch King Tibianus progress',
      null
    );
    if (!data) {
      return { accepted: false, completed: false };
    }
    // New shape preferred: nested copper/dragon
    if (data.copper || data.dragon) {
      return {
        copper: {
          accepted: !!(data.copper && data.copper.accepted),
          completed: !!(data.copper && data.copper.completed)
        },
        dragon: {
          accepted: !!(data.dragon && data.dragon.accepted),
          completed: !!(data.dragon && data.dragon.completed)
        }
      };
    }
    // Backward compatibility: flat accepted/completed
    return {
      accepted: data.accepted === true,
      completed: data.completed === true
    };
  }

  async function saveKingTibianusProgress(playerName, progress) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    const normalized = (progress && (progress.copper || progress.dragon))
      ? {
          copper: {
            accepted: !!(progress.copper && progress.copper.accepted),
            completed: !!(progress.copper && progress.copper.completed)
          },
          dragon: {
            accepted: !!(progress.dragon && progress.dragon.accepted),
            completed: !!(progress.dragon && progress.dragon.completed)
          }
        }
      : {
          accepted: !!progress.accepted,
          completed: !!progress.completed
        };
    await firebaseRequest(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      'PUT',
      normalized,
      'save King Tibianus progress'
    );
    console.log('[Quests Mod][King Tibianus] Progress saved', normalized);
  }

  // =======================
  // Quest Items Storage Functions
  // =======================

  async function getQuestItems(useCache = true) {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return {};
    }
    
    if (useCache && cachedQuestItems !== null) {
      return cachedQuestItems;
    }
    
    const hashedPlayer = await hashUsername(currentPlayer);
    const data = await fetchFirebaseData(
      `${getQuestItemsApiUrl()}/${hashedPlayer}`,
      'fetch quest items',
      null
    );
    
    if (!data || !data.encrypted) {
      cachedQuestItems = {};
      return {};
    }
    
    const decrypted = await decryptQuestItems(data.encrypted, currentPlayer);
    const normalized = normalizeQuestItems(decrypted);
    cachedQuestItems = normalized;
    return normalized;
  }
  
  // Clear quest items cache
  function clearQuestItemsCache() {
    cachedQuestItems = null;
    console.log('[Quests Mod] Quest items cache cleared');
  }
  
  // Load quest items from Firebase on initialization
  async function loadQuestItemsOnInit() {
    try {
      console.log('[Quests Mod] Loading quest items from Firebase on initialization...');
      // Clear cache first to ensure fresh data
      clearQuestItemsCache();
      const products = await getQuestItems(false); // Force fetch, don't use cache
      console.log('[Quests Mod] Quest items loaded:', products);
    } catch (error) {
      console.error('[Quests Mod] Error loading quest items on init:', error);
    }
  }

  async function isCopperKeyMissionCompleted() {
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) return false;
      const progress = await getKingTibianusProgress(playerName);
      if (!progress) return false;
      if (progress.copper && progress.copper.completed) return true;
      if (progress.completed !== undefined) return !!progress.completed;
      return false;
    } catch (error) {
      console.warn('[Quests Mod][Quest Items] Error checking Copper Key completion:', error);
      return false;
    }
  }

  async function isRedDragonMissionActive() {
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) return false;
      const progress = await getKingTibianusProgress(playerName);
      if (progress?.dragon) {
        return !!progress.dragon.accepted && !progress.dragon.completed;
      }
      return false;
    } catch (error) {
      console.warn('[Quests Mod][Quest Items] Error checking red dragon mission:', error);
      return false;
    }
  }

  async function isRedDragonMissionCompleted() {
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) return false;
      const progress = await getKingTibianusProgress(playerName);
      if (progress?.dragon) {
        return !!progress.dragon.completed;
      }
      return false;
    } catch (error) {
      console.warn('[Quests Mod][Quest Items] Error checking red dragon mission (completed):', error);
      return false;
    }
  }

  async function addQuestItem(productName, amount) {
    try {
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        throw new Error('Player name not available');
      }
      
      if (amount <= 0) {
        return;
      }
      
      const currentProducts = await getQuestItems(false); // Force fetch to get latest (normalized)
      const currentCount = currentProducts[productName] || 0;
      // Cap red dragon materials at 100
      const isRedDragonMaterial = productName === 'Red Dragon Scale' || productName === 'Red Dragon Leather';
      const newCount = isRedDragonMaterial ? Math.min(100, currentCount + amount) : currentCount + amount;
      
      const updatedProducts = {
        ...currentProducts,
        [productName]: newCount
      };
      
      const encrypted = await encryptQuestItems(updatedProducts, currentPlayer);
      const hashedPlayer = await hashUsername(currentPlayer);
      
      console.log('[Quests Mod][Quest Items] Saving to Firebase', { hashedPlayer, productName, amount, newCount });
      await firebaseRequest(
        `${getQuestItemsApiUrl()}/${hashedPlayer}`,
        'PUT',
        { encrypted },
        'save quest items'
      );
      
      // Update cache
      cachedQuestItems = updatedProducts;
      
      console.log(`[Quests Mod][Quest Items] Added ${amount} ${productName}. New total: ${newCount}`);
      return updatedProducts;
    } catch (error) {
      console.error('[Quests Mod][Quest Items] Error adding quest item:', error);
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

  // Check if defeated creature has quest item drops configured
  function getQuestItemsConfig(creatureGameId) {
    if (!creatureGameId || !QUEST_ITEMS_CONFIG[creatureGameId]) {
      return null;
    }
    return QUEST_ITEMS_CONFIG[creatureGameId];
  }

  // =======================
  // Drop System
  // =======================

  function setupQuestItemsDropSystem() {
    if (questItemsBoardSubscription) {
      return; // Already set up
    }
    
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      console.log('[Quests Mod] Setting up quest items drop system...');
      questItemsBoardSubscription = globalThis.state.board.subscribe(({ context }) => {
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
        if (seed === lastProcessedQuestItemsSeed) {
          return;
        }
        
        lastProcessedQuestItemsSeed = seed;
        
        // Get creature gameId from serverResults (from monsterDrop)
        const creatureGameId = getCreatureGameId(serverResults);
        
        if (!creatureGameId) {
          console.log('[Quests Mod][Quest Items] Victory detected but no creature gameId found, seed:', seed);
          return;
        }
        
        // Check if this creature has quest item drops configured
        const creatureConfig = getQuestItemsConfig(creatureGameId);
        
        if (!creatureConfig) {
          console.log(`[Quests Mod][Quest Items] Victory detected but creature (gameId: ${creatureGameId}) has no quest items configured, seed:`, seed);
          return;
        }

        // Run mission-gated drop logic async
        (async () => {
          // If this is the red dragon loot source, require the mission to be active
          const isDragonLoot = creatureGameId === 26;
          if (isDragonLoot) {
            const dragonActive = await isRedDragonMissionActive();
            if (!dragonActive) {
              console.log('[Quests Mod][Quest Items] Red dragon loot skipped; mission not active');
              return;
            }
          }

          console.log(`[Quests Mod][Quest Items] ${creatureConfig.creatureName} victory detected (gameId: ${creatureGameId}), seed:`, seed);
          
          // Process each product drop for this creature using deterministic calculation (sequential to avoid overwrite races)
          for (let productIndex = 0; productIndex < creatureConfig.products.length; productIndex++) {
            const product = creatureConfig.products[productIndex];
            const roll = deterministicRandom(seed, creatureGameId, productIndex);
            console.log(`[Quests Mod][Quest Items] ${product.name} roll: ${roll.toFixed(4)} (chance: ${product.dropChance})`);
            if (roll <= product.dropChance) {
              try {
                await addQuestItem(product.name, 1);
                showQuestItemNotification(product.name, 1);
                console.log(`[Quests Mod][Quest Items] ${product.name} awarded from ${creatureConfig.creatureName}`);
              } catch (error) {
                console.error(`[Quests Mod][Quest Items] Error adding ${product.name}:`, error);
              }
            }
          }
        })();
      });
    }
  }

  // =======================
  // Copper Key Board Tracking & Verification
  // =======================

  // Track boardConfig before battle starts
  async function trackBoardConfigForCopperKey() {
    try {
      // Check if on Mine Hub
      if (!isOnMineHub()) {
        trackedBoardConfig = null;
        return;
      }
      
      // Check if player already owns the Copper Key
      const currentPlayer = getCurrentPlayerName();
      if (currentPlayer) {
        const hasReceived = await hasReceivedCopperKey(currentPlayer);
        if (hasReceived) {
          console.log('[Quests Mod][Copper Key] Player already owns Copper Key, skipping tracking');
          trackedBoardConfig = null;
          return;
        }
      }
      
      // Get current boardConfig
      const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
      if (!boardContext || !boardContext.boardConfig) {
        trackedBoardConfig = null;
        return;
      }
      
      // Check if Corym Charlatan is on tile 69
      if (hasCorymCharlatanOnTile69(boardContext.boardConfig)) {
        // Store a deep copy of boardConfig for verification
        trackedBoardConfig = JSON.parse(JSON.stringify(boardContext.boardConfig));
      } else {
        trackedBoardConfig = null;
      }
    } catch (error) {
      console.error('[Quests Mod][Copper Key] Error tracking boardConfig:', error);
      trackedBoardConfig = null;
    }
  }

  // Setup Copper Key verification system
  function setupCopperKeySystem() {
    if (copperKeyBoardSubscription) {
      return; // Already set up
    }
    
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      console.log('[Quests Mod][Copper Key] Setting up Copper Key system...');
      
      // Single subscription for both tracking and verification
      copperKeyBoardSubscription = globalThis.state.board.subscribe(async ({ context }) => {
        // Track boardConfig before battle starts
        if (context.boardConfig && !context.serverResults) {
          await trackBoardConfigForCopperKey();
        }
        
        // Monitor serverResults for victory verification
        const serverResults = context.serverResults;
        if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
          return;
        }
        
        // Only process on victories
        if (!serverResults.rewardScreen.victory) {
          return;
        }
        
        const seed = serverResults.seed;
        
        // Skip duplicate seeds
        if (seed === lastProcessedCopperKeySeed) {
          return;
        }
        
        lastProcessedCopperKeySeed = seed;
        
        try {
          console.log('[Quests Mod][Copper Key] Victory detected, checking conditions, seed:', seed);
          
          // Verify conditions
          // 1. Check if on Mine Hub
          const roomId = serverResults.rewardScreen?.roomId;
          const mineHubRoomId = getMineHubRoomId();
          // Room check
          if (!mineHubRoomId || roomId !== mineHubRoomId) {
            return; // Not on Mine Hub
          }
          
          // 2. Verify Corym Charlatan was on tile 69
          // Use tracked boardConfig if available, otherwise check current boardConfig
          let boardConfigToCheck = trackedBoardConfig;
          if (!boardConfigToCheck) {
            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
            boardConfigToCheck = boardContext?.boardConfig;
            // Using current boardConfig
          } else {
            // Using tracked boardConfig
          }
          
          // Debug: Check what pieces are on tile 69
          if (boardConfigToCheck && Array.isArray(boardConfigToCheck)) {
            // minimal debug: presence check is enough
          }
          
          const hasCorymOnTile69 = hasCorymCharlatanOnTile69(boardConfigToCheck, serverResults);
          if (!hasCorymOnTile69) {
            return; // Corym Charlatan was not on tile 69
          }
          
          // 3. Check if player has already received the key
          const currentPlayer = getCurrentPlayerName();
          if (!currentPlayer) {
            logCopper('[Quests Mod][Copper Key] Player name not available, skipping');
            return;
          }
          
          const hasReceived = await hasReceivedCopperKey(currentPlayer);
          if (hasReceived) {
            return; // Already received
          }
          
          // All conditions met! Award the key
          console.log('[Quests Mod][Copper Key] Awarding Copper Key');
          
          await addQuestItem(COPPER_KEY_CONFIG.productName, 1);
          await markCopperKeyReceived(currentPlayer);
          
          // Show special "Found Copper Key!" toast
          showCopperKeyFoundToast();
          
          // Animate the key sprite with funky animation, then explode it, then remove
          setTimeout(() => {
            const tileElement = getTileElement(COPPER_KEY_CONFIG.targetTileIndex);
            const animatedSprite = animateCopperKey(COPPER_KEY_CONFIG.targetTileIndex);
            
            if (animatedSprite && tileElement) {
              // After funky animation completes (2 seconds), trigger explosion
              setTimeout(() => {
                explodeCopperKey(animatedSprite, tileElement);
                
                // After explosion completes (0.5 seconds), remove the sprite
                setTimeout(() => {
                  removeKeyFromElement(tileElement, COPPER_KEY_CONFIG.targetTileIndex, true); // removeSprite = true
                }, 600); // 0.5s explosion + 100ms buffer
              }, 2000); // Wait for funky animation to complete
            } else {
              // If animation failed, just remove it normally
              if (tileElement) {
                removeKeyFromElement(tileElement, COPPER_KEY_CONFIG.targetTileIndex, true);
              }
            }
          }, 100);
          
          console.log('[Quests Mod][Copper Key] Copper Key awarded');
        } catch (error) {
          console.error('[Quests Mod][Copper Key] Error processing Copper Key:', error);
        }
      });
      
      console.log('[Quests Mod][Copper Key] Copper Key system set up');
    }
  }

  // =======================
  // Notification System
  // =======================

  // Helper to get or create toast container
  function getToastContainer() {
    let mainContainer = document.getElementById('quest-items-toast-container');
    if (!mainContainer) {
      mainContainer = document.createElement('div');
      mainContainer.id = 'quest-items-toast-container';
      mainContainer.style.cssText = `
        position: fixed;
        z-index: 9999;
        inset: 16px 16px 64px;
        pointer-events: none;
      `;
      document.body.appendChild(mainContainer);
    }
    return mainContainer;
  }

  // Helper to update toast positions after removal
  function updateToastPositions(container) {
    const toasts = container.querySelectorAll('.toast-item');
    toasts.forEach((toast, index) => {
      const offset = index * 46;
      toast.style.transform = `translateY(-${offset}px)`;
    });
  }

  // Generic toast notification function
  function showToast({ productName, message, duration = 3000, logPrefix = '[Quests Mod]' }) {
    try {
      const mainContainer = getToastContainer();
      const existingToasts = mainContainer.querySelectorAll('.toast-item');
      const stackOffset = existingToasts.length * 46;
      
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
      
      const toast = document.createElement('button');
      toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
      
      const widgetTop = document.createElement('div');
      widgetTop.className = 'widget-top h-2.5';
      
      const widgetBottom = document.createElement('div');
      widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
      
      // Add product icon if productName provided
      if (productName) {
        const productDef = buildProductDefinitions().find(p => p.name === productName);
        if (productDef) {
          const iconImg = createProductIcon(productDef, 16);
          widgetBottom.appendChild(iconImg);
        }
      }
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'text-left';
      messageDiv.textContent = message;
      widgetBottom.appendChild(messageDiv);
      
      toast.appendChild(widgetTop);
      toast.appendChild(widgetBottom);
      flexContainer.appendChild(toast);
      mainContainer.appendChild(flexContainer);
      
      console.log(`${logPrefix} Toast shown: ${message}`);
      
      setTimeout(() => {
        if (flexContainer && flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateToastPositions(mainContainer);
        }
      }, duration);
      
    } catch (error) {
      console.error(`${logPrefix} Error showing toast:`, error);
    }
  }

  function showQuestItemNotification(productName, amount) {
    showToast({
      productName,
      message: tReplace('mods.quests.productObtained', { productName, amount }),
      duration: 3000
    });
  }

  function showCopperKeyFoundToast() {
    showToast({
      productName: COPPER_KEY_CONFIG.productName,
      message: 'Found Copper Key!',
      duration: 10000,
      logPrefix: '[Quests Mod][Copper Key]'
    });
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
    
    // Dev helper registration
    registerDevGrantHelper();
    
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
    
    addQuestItemsButton();
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
    const added = addQuestItemsButton();
    if (!added && retry < BUTTON_RETRY_MAX) {
      buttonRetryTimeout = setTimeout(() => {
        clearCachesAndAddButton(retry + 1);
      }, BUTTON_RETRY_DELAY);
    }
  }

  // =======================
  // 5. Button Management
  // =======================

  function addQuestItemsButton() {
    const existingButton = document.querySelector('.quest-items-inventory-button');
    if (existingButton) {
      // If button exists but listener is missing, re-add it
      if (!buttonEventListeners.has(existingButton)) {
        const clickHandler = () => {
          showQuestItemsModal();
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
      return spriteDiv !== null && !button.classList.contains('quest-items-inventory-button');
    });
    
    if (!backpackButton) {
      failedAttempts++;
      return false;
    }
    
    // Check if backpack button is still connected to DOM
    if (!isInDOM(backpackButton)) {
      return false;
    }
    
    const questItemsButton = document.createElement('button');
    questItemsButton.className = 'focus-style-visible active:opacity-70 quest-items-inventory-button';
    
    const inventoryBorderStyle = window.betterUIConfig?.inventoryBorderStyle || 'Original';
    const borderDiv = window.getInventoryBorderStyle ? window.getInventoryBorderStyle(inventoryBorderStyle) : '';
    
    const imageUrl = getQuestItemsAssetUrl('Fur_Backpack.gif');
    
    questItemsButton.innerHTML = `
      <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image">
        <div class="relative grid h-full place-items-center">
          ${borderDiv}
          <img alt="quest items" class="pixelated" width="32" height="32" src="${imageUrl}">
        </div>
      </div>
    `;
    
    // Store event listener reference for cleanup
    const clickHandler = () => {
      showQuestItemsModal();
    };
    questItemsButton.addEventListener('click', clickHandler);
    buttonEventListeners.set(questItemsButton, clickHandler);
    
    try {
      // Double-check target is still in DOM before inserting
      if (isInDOM(backpackButton)) {
        backpackButton.insertAdjacentElement('afterend', questItemsButton);
        failedAttempts = 0;
        clearAllTimeouts();
      } else {
        return false;
      }
    } catch (error) {
      console.error('[Quests Mod] Error adding quest items button:', error);
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

  async function showQuestItemsModal() {
    // Clear any pending modal timeouts
    clearTimeoutOrInterval(modalTimeout);
    clearTimeoutOrInterval(dialogTimeout);
    
    // Close any existing modals first (like Autoscroller does)
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    
    modalTimeout = setTimeout(async () => {
      const contentDiv = document.createElement('div');
      applyModalContentStyles(contentDiv, QUEST_ITEMS_MODAL_WIDTH, QUEST_ITEMS_MODAL_HEIGHT);
      
      // Show loading state
      const loadingDiv = document.createElement('div');
      loadingDiv.textContent = t('mods.quests.loading');
      loadingDiv.style.cssText = 'width: 100%; text-align: center; padding: 20px; color: rgb(230, 215, 176);';
      contentDiv.appendChild(loadingDiv);
      
      api.ui.components.createModal({
        title: 'Quest Items',
        width: QUEST_ITEMS_MODAL_WIDTH,
        height: QUEST_ITEMS_MODAL_HEIGHT,
        content: contentDiv,
        buttons: [{ text: 'Close', primary: true }]
      });
      
      dialogTimeout = setTimeout(() => {
        const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          applyDialogStyles(dialog, QUEST_ITEMS_MODAL_WIDTH, QUEST_ITEMS_MODAL_HEIGHT);
        }
        dialogTimeout = null;
      }, 0);
      
      // Fetch and display quest items (always fetch fresh from Firebase)
      try {
        // Clear cache before fetching to ensure we get the latest data
        clearQuestItemsCache();
          const products = await getQuestItems(false); // Force fresh fetch, don't use cache
          const hideCopperKey = await isCopperKeyMissionCompleted();
          const redDragonActive = await isRedDragonMissionActive();
          const redDragonCompleted = await isRedDragonMissionCompleted();
          const displayProducts = { ...products };
          if (hideCopperKey) {
            delete displayProducts[COPPER_KEY_CONFIG.productName];
          }
          if (redDragonActive) {
            displayProducts['Obsidian Knife'] = Math.max(displayProducts['Obsidian Knife'] || 0, 1);
          }
          if (redDragonCompleted) {
            delete displayProducts['Red Dragon Leather'];
            delete displayProducts['Red Dragon Scale'];
          }
        
        // Clear loading message
        contentDiv.innerHTML = '';
        applyModalContentStyles(contentDiv, QUEST_ITEMS_MODAL_WIDTH, QUEST_ITEMS_MODAL_HEIGHT);
        
        // Build product definitions from configuration
          const productDefinitions = buildProductDefinitions({
            includeCopperKey: !hideCopperKey,
            includeObsidianKnife: redDragonActive,
            includeDragonClaw: redDragonCompleted || (displayProducts['Dragon Claw'] > 0)
          });
        
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
          const count = displayProducts[productDef.name] || 0;
          
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
          
          // Drop chance inside description frame (if available)
          if (typeof productDef.dropChance === 'number') {
            const chanceDiv = document.createElement('div');
            chanceDiv.textContent = `Drop Chance: ${(productDef.dropChance * 100).toFixed(1)}%`;
            chanceDiv.style.cssText = 'font-size: 11px; color: rgb(180, 180, 180); text-align: center;';
            descFrame.appendChild(chanceDiv);
          }
          detailsContainer.appendChild(descFrame);
        };
        
        // Create product items for left column
        let hasAnyProducts = false;
        
        for (const productDef of productDefinitions) {
          const count = displayProducts[productDef.name] || 0;
          
          // Skip products the user doesn't own
          if (count <= 0) {
            continue;
          }
          
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
            title: 'Quest Items',
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
          // Show placeholder instead of empty state message
          const detailsBox = createBox({
            title: 'Details',
            content: detailsContainer
          });
          detailsBox.style.width = '280px';
          detailsBox.style.flexShrink = '0';
          
          const productsBox = createBox({
            title: 'Quest Items',
            content: productsListContainer
          });
          productsBox.style.width = '180px';
          productsBox.style.flexShrink = '0';
          
          contentDiv.appendChild(productsBox);
          contentDiv.appendChild(detailsBox);
          
          // Show placeholder
          showPlaceholder();
        }
        
      } catch (error) {
        console.error('[Quests Mod] Error loading quest items:', error);
        contentDiv.innerHTML = '';
        const errorBox = createBox({
          title: 'Quest Items',
          content: `<div style="text-align: center; padding: 20px; color: rgb(255, 100, 100);">${t('mods.quests.errorLoading')}</div>`
        });
        errorBox.style.width = '100%';
        contentDiv.appendChild(errorBox);
      }
      
      modalTimeout = null;
    }, 50);
  }

  // =======================
  // 6. King Tibianus Modal
  // =======================

  // King Tibianus responses based on keywords
  const KING_TIBIANUS_RESPONSES = {
    'hail': 'I greet thee, my loyal subject.',
    'how are you': 'Thank you, I\'m fine.',
    'good': 'The forces of good are hard pressed in these dark times.',
    'name': 'Preposterous! You must know the name of your own king!',
    'enemies': 'Our enemies are numerous. The evil minotaurs, Ferumbras, and the renegade city of Carlin to the north are just some of them.',
    'gods': 'Honor the gods and pay your taxes.',
    'job': 'I am your sovereign, King Tibianus III, and its my duty to provide justice and guidance for my subjects.',
    'king': 'I am the king, so mind your words!',
    'mission': 'Glad you asked! One of my guards lost my precious copper key down in the mines. Would you be able to help me get it back?',
    'quest': 'Glad you asked! One of my guards lost my precious copper key down in the mines. Would you be able to help me get it back?',
    'sell': 'Sell? Sell what? My kingdom isn\'t for sale!',
    'tbi': 'This organisation is important in holding our enemies in check. Its headquarter is located in the bastion in the northwall.',
    'tibia': 'Soon the whole land will be ruled by me once again!',
    'time': 'It\'s a time for heroes, that\'s for sure!',
    'noodles': 'The royal poodle Noodles is my greatest treasure!',
    'treasure': 'The royal poodle Noodles is my greatest treasure!',
    'castle': 'Rain Castle is my home.',
    'dungeon': 'Dungeons are no places for kings.',
    'help': 'Visit Quentin the monk for help.',
    'druids': 'We need the druidic healing powers to fight evil.',
    'sorcerers': 'The magic of the sorcerers is a powerful tool to smite our enemies.',
    'paladins': 'The paladins are great protectors for Thais.',
    'knights': 'The brave knights are necessary for human survival in Thais.',
    'heroes': 'It\'s a time for heroes, that\'s for sure!',
    'monsters': 'Go and hunt them! For king and country!',
    'excalibug': 'It\'s the sword of the kings. If you could return this weapon to me I would reward you beyond your dreams.',
    'ferumbras': 'He is a follower of the evil god Zathroth and responsible for many attacks on us. Kill him on sight!',
    'order': 'We need order to survive!',
    'zathroth': 'Please ask a priest about the gods.',
    'carlin': 'They dare to reject my reign over the whole continent!',
    'eremo': 'It is said that he lives on a small island near Edron. Maybe the people there know more about him.',
    'thais': 'Our beloved city has some fine shops, guildhouses, and a modern sytem of sewers.',
    'sewers': 'What a disgusting topic!',
    'shops': 'Visit the shops of our merchants and craftsmen.',
    'guilds': 'The four major guilds are the knights, the paladins, the druids, and the sorcerers.',
    'merchants': 'Ask around about them.',
    'harkath': 'Harkath Bloodblade is the general of our glorious army.',
    'bloodblade': 'Harkath Bloodblade is the general of our glorious army.',
    'general': 'Harkath Bloodblade is the general of our glorious army.',
    'army': 'Ask the soldiers about that topic.',
    'evil': 'We need all strength we can muster to smite evil!',
    'minotaurs': 'Vile monsters, but I must admit they are strong and sometimes even cunning ... in their own bestial way.',
    'taxes': 'To pay your taxes, visit the royal tax collector.',
    'royal tax collector': 'He has been lazy lately. I bet you have not payed any taxes at all.',
    'reward': 'Well, if you want a reward, go on a quest to bring me Excalibug!',
    'benjamin': 'He was once my greatest general. Now he is very old and senile but we entrusted him with work for the Royal Tibia Mail.',
    'bozo': 'He is my royal jester and cheers me up now and then.',
    'chester': 'A very competent person. A little nervous but very competent.',
    'elane': 'The paladins are great protectors for Thais.',
    'frodo': 'He is the owner of Frodo\'s Hut and a faithful tax-payer.',
    'gorn': 'He was once one of Tibia\'s greatest fighters. Now he is selling equipment.',
    'gregor': 'The brave knights are necessary for human survival in Thais.',
    'muriel': 'The magic of the sorcerers is a powerful tool to smite our enemies.',
    'sam': 'He is a skilled blacksmith and a loyal subject.',
    'bye': 'Good bye, Player!'
  };

  function getKingTibianusResponse(message, playerName = 'Player') {
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for exact matches first (longer phrases first)
    const sortedKeys = Object.keys(KING_TIBIANUS_RESPONSES).sort((a, b) => b.length - a.length);
    
    for (const keyword of sortedKeys) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        let response = KING_TIBIANUS_RESPONSES[keyword];
        // Replace "Player" with actual player name in bye response
        if (keyword === 'bye') {
          response = response.replace('Player', playerName);
        }
        return response;
      }
    }
    
    // Default response if no match found
    return 'I greet thee, my loyal subject.';
  }

  function showKingTibianusModal() {
    // Clear any pending modal timeouts
    clearTimeoutOrInterval(modalTimeout);
    clearTimeoutOrInterval(dialogTimeout);
    
    // Close any existing modals first (like Autoscroller does)
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    
    modalTimeout = setTimeout(() => {
      const contentDiv = document.createElement('div');
      applyModalContentStyles(contentDiv, KING_TIBI_MODAL_WIDTH, KING_TIBI_MODAL_HEIGHT);
      
      const kingTibianusIconUrl = getQuestItemsAssetUrl('King_Tibianus.gif');
      
      // Create modal content with 3 rows
      const modalContent = document.createElement('div');
      modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 0; height: 100%;';
      
      // Row 1: Top row with image and message
      const row1 = document.createElement('div');
      row1.className = 'grid gap-3 sm:grid-cols-[min-content_1fr]';
      row1.style.cssText = 'align-self: center;';
      
      const imageContainer = document.createElement('div');
      imageContainer.className = 'container-slot surface-darker grid place-items-center overflow-hidden';
      imageContainer.style.cssText = 'width: 110px; min-width: 110px; height: 100%; padding: 0; align-self: stretch;';
      
      const kingImgWrapper = document.createElement('div');
      kingImgWrapper.style.cssText = 'width: 110px; height: 100%; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box;';
      
      const kingImg = document.createElement('img');
      kingImg.src = kingTibianusIconUrl;
      kingImg.alt = 'King Tibianus';
      kingImg.className = 'pixelated';
      kingImg.style.cssText = 'width: 96px; height: 64px; object-fit: contain; image-rendering: pixelated;';
      kingImgWrapper.appendChild(kingImg);
      imageContainer.appendChild(kingImgWrapper);
      
      const messageContainer = document.createElement('div');
      messageContainer.className = 'tooltip-prose pixel-font-16 frame-pressed-1 surface-dark flex w-full flex-col gap-1 p-2 text-whiteRegular';
      messageContainer.style.width = '290px';
      messageContainer.style.height = '90px';
      messageContainer.style.maxHeight = '90px';
      messageContainer.style.overflowY = 'auto';
      messageContainer.id = 'king-tibianus-messages';
      
      // Initial greeting
      const greetingP = document.createElement('p');
      greetingP.className = 'inline text-monster';
      greetingP.style.color = 'rgb(135, 206, 250)'; // Light blue/cyan color
      greetingP.textContent = 'King Tibianus: I greet thee, my loyal subject.';
      messageContainer.appendChild(greetingP);
      
      // Function to add message to conversation
      function addMessageToConversation(sender, text, isKing = false) {
        const messageP = document.createElement('p');
        
        if (isKing) {
          // King Tibianus messages use the same style as initial greeting
          messageP.className = 'inline text-monster';
          messageP.style.color = 'rgb(135, 206, 250)';
          messageP.textContent = sender + ': ' + text;
        } else {
          // Player messages - same font style as King Tibianus, lavender/purple color
          messageP.className = 'inline text-monster';
          messageP.style.color = 'rgb(200, 180, 255)'; // Lavender/light purple color
          messageP.textContent = sender + ': ' + text;
        }
        
        messageContainer.appendChild(messageP);
        
        // Scroll to bottom
        setTimeout(() => {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }, 0);
      }
      
      row1.appendChild(imageContainer);
      row1.appendChild(messageContainer);
      
      // Row 2: Middle row split into 2 columns
      const row2 = document.createElement('div');
      row2.style.cssText = 'width: 410px; height: 300px; display: flex; gap: 12px; margin: auto 0; align-self: center;';
      
      // Column 1: First column (150px wide) using same background/frame as row1
      const col1 = document.createElement('div');
      col1.style.cssText = `
        width: 170px;
        min-width: 170px;
        max-width: 170px;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-sizing: border-box;
      `;
      
      // Column 2: Plain container (Mission Log will provide its own frame)
      const col2 = document.createElement('div');
      col2.style.cssText = `
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
        box-sizing: border-box;
      `;
      
      row2.appendChild(col1);
      row2.appendChild(col2);

      const kingChatState = {
        progressCopper: { accepted: false, completed: false },
        progressDragon: { accepted: false, completed: false },
        missionOffered: false,
        awaitingKeyConfirm: false
      };
      const MISSIONS = [KING_COPPER_KEY_MISSION, KING_RED_DRAGON_MISSION];

      function getMissionById(id) {
        return MISSIONS.find(m => m.id === id);
      }

      function getMissionProgress(mission) {
        if (!mission) return { accepted: false, completed: false };
        if (mission.id === KING_COPPER_KEY_MISSION.id) return kingChatState.progressCopper;
        if (mission.id === KING_RED_DRAGON_MISSION.id) return kingChatState.progressDragon;
        return { accepted: false, completed: false };
      }

      function setMissionProgress(mission, progress) {
        if (!mission) return;
        if (mission.id === KING_COPPER_KEY_MISSION.id) kingChatState.progressCopper = progress;
        if (mission.id === KING_RED_DRAGON_MISSION.id) kingChatState.progressDragon = progress;
      }

      function currentMission() {
        // If copper incomplete, that's the current mission; else red dragon
        if (!kingChatState.progressCopper.completed) return KING_COPPER_KEY_MISSION;
        return KING_RED_DRAGON_MISSION;
      }

      let activeMission = currentMission();
      let selectedMissionId = null; // none selected by default
      let kingQuestDetailsVisible = false;
      let kingQuestDescEl = null;
      let kingQuestDescBody = null;
      let customFooter = null;
      let customSeparator = null;
      let modalRef = null;

      function buildStrings(mission) {
        return {
          missionPrompt: mission.prompt,
          thankYou: mission.accept,
          keyQuestion: mission.askForKey || mission.askForItems || 'Have you found what I asked for?',
          keyComplete: mission.complete,
          keyScoldNoKey: mission.missingKey || mission.missingItems || 'You claim yes but lack what I asked for.',
          keyKeepSearching: mission.keepSearching,
          keyAnswerYesNo: mission.answerYesNo,
          missionCompleted: mission.alreadyCompleted,
          missionActive: mission.alreadyActive
        };
      }
      let kingStrings = buildStrings(activeMission);

      function closeDialogWithFallback(delayMs = 0, escRepeats = 3, escSpacingMs = 50) {
        setTimeout(() => {
          const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
          if (dialog) {
            const buttons = dialog.querySelectorAll('button');
            let closeButton = null;
            for (const btn of buttons) {
              if (btn.textContent && btn.textContent.trim().toLowerCase() === 'close') {
                closeButton = btn;
                break;
              }
            }
            if (closeButton) {
              closeButton.click();
              return;
            }
          }
          for (let i = 0; i < escRepeats; i++) {
            setTimeout(() => {
              document.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Escape', 
                keyCode: 27, 
                which: 27, 
                bubbles: true,
                cancelable: true
              }));
            }, i * escSpacingMs);
          }
        }, delayMs);
      }

      function removeDefaultModalFooter(dialog) {
        try {
          if (!dialog) return;
          const separators = dialog.querySelectorAll('.separator');
          separators.forEach(el => {
            if (el !== customSeparator) {
              el.remove();
            }
          });
          const buttonRows = dialog.querySelectorAll('.flex.justify-end.gap-2');
          buttonRows.forEach(row => {
            if (row !== customFooter && !row.querySelector('.guild-coins-display')) {
              row.remove();
            }
          });
        } catch (error) {
          console.warn('[Quests Mod][King Tibianus] Could not remove default modal footer:', error);
        }
      }

      function queueKingReply(text, { onDone = null, closeAfterMs = null } = {}) {
        setTimeout(() => {
          addMessageToConversation('King Tibianus', text, true);
          if (onDone) onDone();
          if (typeof closeAfterMs === 'number') {
            closeDialogWithFallback(closeAfterMs);
          }
        }, 1000);
      }

      async function awardGuildCoins(amount) {
        try {
          const coinsAdder =
            globalThis.addGuildCoins ||
            (globalThis.Guilds && globalThis.Guilds.addGuildCoins) ||
            (globalThis.BestiaryModAPI &&
             globalThis.BestiaryModAPI.guilds &&
             globalThis.BestiaryModAPI.guilds.addGuildCoins) ||
            (typeof addGuildCoins === 'function' ? addGuildCoins : null);

          if (!coinsAdder) {
            console.warn('[Quests Mod][King Tibianus] addGuildCoins not available, skipping guild coin reward');
            return;
          }

          await coinsAdder(amount);
          console.log('[Quests Mod][King Tibianus] Awarded guild coins:', amount);
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error awarding guild coins:', error);
        }
      }

      // Guild coin display
      const guildCoinIconUrl = cachedExtensionBaseUrl ? constructUrl(cachedExtensionBaseUrl, '/assets/guild/Guild_Coin.PNG') : '/assets/guild/Guild_Coin.PNG';
      let guildCoinAmountSpan = null;

      async function updateGuildCoinDisplay() {
        if (!guildCoinAmountSpan) return;
        guildCoinAmountSpan.textContent = '...';
        try {
          const coinsGetter =
            globalThis.getGuildCoins ||
            (globalThis.Guilds && globalThis.Guilds.getGuildCoins) ||
            (globalThis.BestiaryModAPI &&
             globalThis.BestiaryModAPI.guilds &&
             globalThis.BestiaryModAPI.guilds.getGuildCoins) ||
            (typeof getGuildCoins === 'function' ? getGuildCoins : null);
          if (!coinsGetter) {
            console.error('[Quests Mod][King Tibianus] getGuildCoins not available; cannot show guild coins.');
            guildCoinAmountSpan.textContent = '?';
            return;
          }
          const amount = await coinsGetter();
          guildCoinAmountSpan.textContent = Number.isFinite(amount) ? amount : '?';
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error updating guild coins display:', error);
          guildCoinAmountSpan.textContent = '?';
        }
      }

      function renderKingQuestUI() {
        if (!col1 || !col2) return;
        col1.innerHTML = '';
        col2.innerHTML = '';

        const missionStates = MISSIONS.map(mission => ({
          mission,
          progress: getMissionProgress(mission)
        }));

        // Keep selection valid; allow no selection (null)
        const selectedMission = selectedMissionId ? getMissionById(selectedMissionId) : null;
        const selectedProgress = selectedMission ? getMissionProgress(selectedMission) : { accepted: false, completed: false };

        const handleMissionClick = (missionId) => {
          if (selectedMissionId === missionId) {
            // Deselect
            selectedMissionId = null;
            kingQuestDetailsVisible = false;
          } else {
            kingQuestDetailsVisible = true;
            selectedMissionId = missionId;
          }
          renderKingQuestUI();
        };

        function createFramedBox(titleText, bodyContent) {
          const box = document.createElement('div');
          box.style.display = 'flex';
          box.style.flexDirection = 'column';
          box.style.margin = '0';
          box.style.padding = '0';
          box.style.minHeight = '0';
          box.style.height = '100%';
          box.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat';
          box.style.border = '4px solid transparent';
          box.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
          box.style.borderRadius = '6px';
          box.style.overflow = 'hidden';

          const header = document.createElement('h2');
          header.className = 'widget-top widget-top-text pixel-font-16';
          header.style.margin = '0';
          header.style.padding = '2px 8px';
          header.style.textAlign = 'center';
          header.style.color = 'rgb(255, 255, 255)';
          const p = document.createElement('p');
          p.className = 'pixel-font-16';
          p.style.margin = '0';
          p.style.padding = '0';
          p.style.textAlign = 'center';
          p.style.color = 'rgb(255, 255, 255)';
          p.textContent = titleText;
          header.appendChild(p);
          box.appendChild(header);

          const body = document.createElement('div');
          body.style.flex = '1 1 0';
          body.style.minHeight = '0';
          body.style.overflowY = 'auto';
          body.style.padding = '8px';
          if (bodyContent instanceof HTMLElement) {
            body.appendChild(bodyContent);
          }
          box.appendChild(body);
          return box;
        }

        const missionsBody = document.createElement('div');
        missionsBody.style.display = 'flex';
        missionsBody.style.flexDirection = 'column';
        missionsBody.style.gap = '6px';

        const currentMissions = missionStates.filter(ms => ms.progress.accepted && !ms.progress.completed);
        if (currentMissions.length > 0) {
          currentMissions.forEach(({ mission }) => {
            const missionEntry = document.createElement('p');
            missionEntry.className = 'text-whiteHighlight';
            missionEntry.textContent = mission.title;
            missionEntry.style.cursor = 'pointer';
            missionEntry.style.userSelect = 'none';
            missionEntry.style.margin = '0';
            missionEntry.style.color = selectedMissionId === mission.id ? '#e6d7b0' : '#ffffff';
            missionEntry.addEventListener('click', () => handleMissionClick(mission.id));
            missionsBody.appendChild(missionEntry);
          });
        } else {
          const noneEntry = document.createElement('p');
          noneEntry.style.margin = '0';
          noneEntry.style.color = '#888';
          noneEntry.style.fontStyle = 'italic';
          noneEntry.textContent = 'No active mission';
          missionsBody.appendChild(noneEntry);
          kingQuestDetailsVisible = false;
        }

        const completedBody = document.createElement('div');
        completedBody.style.display = 'flex';
        completedBody.style.flexDirection = 'column';
        completedBody.style.gap = '6px';
        const completedMissions = missionStates.filter(ms => ms.progress.completed);
        if (completedMissions.length > 0) {
          completedMissions.forEach(({ mission }) => {
            const completedItem = document.createElement('p');
            completedItem.style.margin = '0';
            completedItem.textContent = mission.title;
            completedItem.style.color = selectedMissionId === mission.id ? '#e6d7b0' : '#ffffff';
            completedItem.style.fontStyle = 'normal';
            completedItem.style.cursor = 'pointer';
            completedItem.style.userSelect = 'none';
            completedItem.style.textDecoration = 'none';
            completedItem.addEventListener('click', () => handleMissionClick(mission.id));
            completedBody.appendChild(completedItem);
          });
        } else {
          const noneItem = document.createElement('p');
          noneItem.style.margin = '0';
          noneItem.textContent = 'No completed missions';
          noneItem.style.color = '#888';
          noneItem.style.fontStyle = 'italic';
          completedBody.appendChild(noneItem);
        }

        const missionsBox = createFramedBox('Missions', missionsBody);
        missionsBox.style.flex = '1 1 0';
        missionsBox.style.minHeight = '0';

        const completedBox = createFramedBox('Completed', completedBody);
        completedBox.style.flex = '1 1 0';
        completedBox.style.minHeight = '0';

        // Use two separate boxes stacked in column
        const col1Container = document.createElement('div');
        col1Container.style.display = 'flex';
        col1Container.style.flexDirection = 'column';
        col1Container.style.gap = '8px';
        col1Container.style.height = '100%';

        col1Container.appendChild(missionsBox);
        col1Container.appendChild(completedBox);

        col1.appendChild(col1Container);

        const descContent = document.createElement('div');
        descContent.className = 'flex flex-col gap-1';
        descContent.style.padding = '0';

        const descBlock = document.createElement('div');
        descBlock.className = 'flex flex-col gap-1';
        const hintBlock = document.createElement('div');
        hintBlock.className = 'flex flex-col gap-1';

        if (!selectedMission) {
          const line1 = document.createElement('p');
          line1.textContent = 'No mission selected.';
          line1.style.color = '#888';
          line1.style.fontStyle = 'italic';
          descBlock.appendChild(line1);
        } else if (!selectedProgress.accepted) {
          const line1 = document.createElement('p');
          line1.textContent = 'No active mission.';
          line1.style.color = '#888';
          line1.style.fontStyle = 'italic';
          descBlock.appendChild(line1);
        } else if (selectedProgress.completed) {
          const line1 = document.createElement('p');
          line1.textContent = 'Completed: ' + selectedMission.title;
          const line2 = document.createElement('p');
          if (selectedMission.id === KING_RED_DRAGON_MISSION.id) {
            line2.textContent = 'Reward: Dragon Claw.';
          } else {
            line2.textContent = `Reward: ${selectedMission.rewardCoins} guild coins.`;
          }
          descBlock.appendChild(line1);
          descBlock.appendChild(line2);
          // Hide hint on completion
        } else {
          const line1 = document.createElement('p');
          line1.textContent = selectedMission.objectiveLine1;
          const line2 = document.createElement('p');
          line2.textContent = selectedMission.objectiveLine2;
          descBlock.appendChild(line1);
          descBlock.appendChild(line2);

          const line3 = document.createElement('p');
          line3.style.color = '#b0b0b0';
          line3.style.fontStyle = 'italic';
          line3.style.marginTop = '6px';
          line3.textContent = selectedMission.hint;
          hintBlock.appendChild(line3);
        }

        const descBodyWrapper = document.createElement('div');
        descBodyWrapper.className = 'flex flex-col gap-1';
        descBodyWrapper.style.padding = '0';
        descBodyWrapper.appendChild(descBlock);
        descBodyWrapper.appendChild(hintBlock);

        // Start hidden until a mission is clicked
        // Always show details when a mission is selected; hide only when none selected
        descBodyWrapper.style.display = selectedMission ? 'block' : 'none';

        const missionLogBox = createFramedBox('Mission Log', descBodyWrapper);
        missionLogBox.style.flex = '1 1 0';
        missionLogBox.style.minHeight = '0';

        col2.appendChild(missionLogBox);
        kingQuestDescEl = missionLogBox;
        kingQuestDescBody = descBodyWrapper;
      }

      async function loadKingTibianusProgress() {
        try {
          const playerName = getCurrentPlayerName();
          const progress = await getKingTibianusProgress(playerName);
          // Backward compatibility: old shape {accepted, completed}
          if (progress && progress.accepted !== undefined) {
            kingChatState.progressCopper = {
              accepted: progress.accepted,
              completed: progress.completed
            };
          }
          // New shape {copper:{}, dragon:{}}
          if (progress && progress.copper) {
            kingChatState.progressCopper = {
              accepted: !!progress.copper.accepted,
              completed: !!progress.copper.completed
            };
          }
          if (progress && progress.dragon) {
            kingChatState.progressDragon = {
              accepted: !!progress.dragon.accepted,
              completed: !!progress.dragon.completed
            };
          }
          activeMission = currentMission();
          selectedMissionId = null;
          kingStrings = buildStrings(activeMission);
          renderKingQuestUI();
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error loading progress:', error);
        }
      }

      async function startKingTibianusQuest() {
        try {
          const playerName = getCurrentPlayerName();
          if (!playerName) {
            console.warn('[Quests Mod][King Tibianus] Player name not available, cannot start quest');
            return;
          }
          const currentProgress = getMissionProgress(activeMission);
          const nextProgress = {
            accepted: true,
            completed: !!currentProgress.completed
          };
          setMissionProgress(activeMission, nextProgress);
          activeMission = currentMission();
          selectedMissionId = null;
          kingStrings = buildStrings(activeMission);
          await saveKingTibianusProgress(playerName, {
            copper: kingChatState.progressCopper,
            dragon: kingChatState.progressDragon
          });
          renderKingQuestUI();
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error starting quest:', error);
        }
      }

      async function completeKingTibianusQuest() {
        try {
          const playerName = getCurrentPlayerName();
          if (!playerName) return;
          const currentProgress = getMissionProgress(activeMission);
          const shouldAwardDragonClaw =
            activeMission.id === KING_RED_DRAGON_MISSION.id && !currentProgress.completed;
          const nextProgress = { accepted: true, completed: true };
          setMissionProgress(activeMission, nextProgress);
          activeMission = currentMission();
          selectedMissionId = null;
          kingStrings = buildStrings(activeMission);
          await saveKingTibianusProgress(playerName, {
            copper: kingChatState.progressCopper,
            dragon: kingChatState.progressDragon
          });
          if (shouldAwardDragonClaw) {
            try {
              await addQuestItem('Dragon Claw', 1);
              console.log('[Quests Mod][King Tibianus] Awarded Dragon Claw for dragon mission completion');
            } catch (err) {
              console.error('[Quests Mod][King Tibianus] Error awarding Dragon Claw:', err);
            }
          }
          renderKingQuestUI();
          console.log('[Quests Mod][King Tibianus] Quest marked as completed');
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error completing quest:', error);
        }
      }

      async function hasCopperKeyInInventory() {
        try {
          const items = await getQuestItems(false);
          return (items && items[COPPER_KEY_CONFIG.productName] > 0);
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error checking Copper Key in inventory:', error);
          return false;
        }
      }

      async function hasRedDragonMaterials() {
        try {
          const items = await getQuestItems(false);
          const scales = (items && items['Red Dragon Scale']) || 0;
          const leathers = (items && items['Red Dragon Leather']) || 0;
          return scales >= 100 && leathers >= 100;
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error checking red dragon materials:', error);
          return false;
        }
      }

      // Row 3: Chat input area
      const row3 = document.createElement('div');
      row3.style.cssText = `
        padding: 0;
        border-top: 0;
        margin: 0;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex-shrink: 0;
      `;
      
      const inputRow = document.createElement('div');
      inputRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';
      
      const textarea = document.createElement('textarea');
      textarea.className = 'king-tibianus-chat-input';
      textarea.setAttribute('wrap', 'off');
      textarea.placeholder = 'Type your message to King Tibianus...';
      textarea.style.cssText = `
        flex: 1;
        height: 28px;
        max-height: 28px;
        min-height: 28px;
        padding: 4px 6px;
        background-color: #333;
        border: 4px solid transparent;
        border-image: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
        color: rgb(255, 255, 255);
        font-family: inherit;
        font-size: 13px;
        line-height: 18px;
        resize: none;
        box-sizing: border-box;
        line-height: 1.2;
        white-space: nowrap;
        overflow-x: hidden;
        overflow-y: hidden;
        outline: none;
      `;
      
      // Handle Enter key
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessageToKing();
        }
      });
      
      // Remove focus outline/border
      textarea.addEventListener('focus', () => {
        textarea.style.outline = 'none';
        textarea.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill';
      });
      
      textarea.addEventListener('blur', () => {
        textarea.style.outline = 'none';
        textarea.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill';
      });
      
      const sendButton = document.createElement('button');
      sendButton.textContent = 'Send';
      sendButton.className = 'primary';
      sendButton.style.cssText = `
        height: 28px;
        padding: 4px 10px;
        white-space: nowrap;
        font-size: 13px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') center center / cover;
        border: 4px solid transparent;
        border-image: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
        color: rgb(255, 255, 255);
        cursor: pointer;
        font-family: inherit;
      `;
      
      // Track pending response timeout
      let pendingResponseTimeout = null;
      let latestMessage = null;
      const thankYouText = kingStrings.thankYou;
      
      // Send message function
      async function sendMessageToKing() {
        const text = textarea.value.trim();
        if (!text || text.length === 0) {
          return;
        }
        
        // Get player name
        const playerName = getCurrentPlayerName() || 'Player';
        const lowerText = text.toLowerCase();
        
        // Add player message to conversation
        addMessageToConversation(playerName, text, false);
        
        // Clear any pending response timeout
        if (pendingResponseTimeout) {
          clearTimeout(pendingResponseTimeout);
          pendingResponseTimeout = null;
        }
        
        // Refresh mission context (in case first mission just completed)
        activeMission = currentMission();
        kingStrings = buildStrings(activeMission);
        const currentProgress = getMissionProgress(activeMission);

        const mentionsKey = lowerText.includes('key') || lowerText.includes('copper key');
        const mentionsDragon = lowerText.includes('dragon') || lowerText.includes('scale') || lowerText.includes('leather');

        // Handle pending key confirmation (yes/no after "Have you found my key?")
        if (kingChatState.awaitingKeyConfirm && currentProgress.accepted && !currentProgress.completed) {
          if (lowerText.includes('yes')) {
            let hasItems = false;
            if (activeMission.id === KING_COPPER_KEY_MISSION.id) {
              hasItems = await hasCopperKeyInInventory();
            } else {
              hasItems = await hasRedDragonMaterials();
            }
            if (hasItems) {
              queueKingReply(kingStrings.keyComplete, { onDone: async () => {
                if (activeMission.rewardCoins > 0) {
                  await awardGuildCoins(activeMission.rewardCoins);
                  await updateGuildCoinDisplay();
                }
                await completeKingTibianusQuest();
              } });
            } else {
              queueKingReply(kingStrings.keyScoldNoKey, { closeAfterMs: 2000 });
            }
            kingChatState.awaitingKeyConfirm = false;
            textarea.value = '';
            textarea.style.height = '27px';
            return;
          }
          if (lowerText.includes('no')) {
            queueKingReply(kingStrings.keyKeepSearching);
            kingChatState.awaitingKeyConfirm = false;
            textarea.value = '';
            textarea.style.height = '27px';
            return;
          }
          queueKingReply(kingStrings.keyAnswerYesNo);
          textarea.value = '';
          textarea.style.height = '27px';
          return;
        }

        // Mission acceptance handler
        if (kingChatState.missionOffered && !currentProgress.accepted && !currentProgress.completed && lowerText.includes('yes')) {
          kingChatState.missionOffered = false;
          queueKingReply(thankYouText, { onDone: async () => {
            await startKingTibianusQuest();
          } });
          await startKingTibianusQuest();
          latestMessage = null;
          pendingResponseTimeout = null;
          textarea.value = '';
          textarea.style.height = '27px';
          return;
        }

        let kingResponse = '';
        
        if (mentionsKey || mentionsDragon) {
          if (currentProgress.completed) {
            kingResponse = kingStrings.missionCompleted;
            kingChatState.missionOffered = false;
          } else if (currentProgress.accepted) {
            kingChatState.awaitingKeyConfirm = true;
            queueKingReply(kingStrings.keyQuestion);
            textarea.value = '';
            textarea.style.height = '27px';
            return;
          } else {
            kingResponse = kingStrings.missionPrompt;
            kingChatState.missionOffered = true;
          }
        } else if (lowerText.includes('mission') || lowerText.includes('quest')) {
          if (currentProgress.completed) {
            kingResponse = kingStrings.missionCompleted;
            kingChatState.missionOffered = false;
          } else if (currentProgress.accepted) {
            kingResponse = kingStrings.missionActive;
            kingChatState.missionOffered = false;
          } else {
            kingResponse = kingStrings.missionPrompt;
            kingChatState.missionOffered = true;
          }
        } else {
          kingResponse = getKingTibianusResponse(text, playerName);
          kingChatState.missionOffered = false;
        }
        
        // Store the latest message
        latestMessage = {
          text: text,
          playerName: playerName,
          response: kingResponse
        };
        
        // Set new timeout for response (1 second delay)
        pendingResponseTimeout = setTimeout(() => {
          // Only respond if this is still the latest message
          if (latestMessage && latestMessage.text === text) {
            addMessageToConversation('King Tibianus', latestMessage.response, true);
            
            // Check if message contains "bye" (keyword matching like response system)
            const isBye = text.toLowerCase().includes('bye');
            if (isBye) {
              setTimeout(() => {
                // Close modal by finding the dialog and closing it
                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                if (dialog) {
                  // Try to find and click the close button (primary button with "Close" text)
                  const buttons = dialog.querySelectorAll('button');
                  let closeButton = null;
                  for (const btn of buttons) {
                    if (btn.textContent && btn.textContent.trim().toLowerCase() === 'close') {
                      closeButton = btn;
                      break;
                    }
                  }
                  
                  if (closeButton) {
                    closeButton.click();
                  } else {
                    // Fallback: dispatch ESC key events
                    for (let i = 0; i < 3; i++) {
                      setTimeout(() => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { 
                          key: 'Escape', 
                          keyCode: 27, 
                          which: 27, 
                          bubbles: true,
                          cancelable: true
                        }));
                      }, i * 50);
                    }
                  }
                } else {
                  // If dialog not found, try ESC events anyway
                  for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                      document.dispatchEvent(new KeyboardEvent('keydown', { 
                        key: 'Escape', 
                        keyCode: 27, 
                        which: 27, 
                        bubbles: true,
                        cancelable: true
                      }));
                    }, i * 50);
                  }
                }
              }, 1000); // Wait 1 extra second after response
            }
            
            latestMessage = null;
          }
          pendingResponseTimeout = null;
        }, 1000);
        
        // Clear input
        textarea.value = '';
        textarea.style.height = '27px';
        
      }
      
      sendButton.addEventListener('click', sendMessageToKing);
      
      inputRow.appendChild(textarea);
      inputRow.appendChild(sendButton);
      row3.appendChild(inputRow);
      
      // Footer with guild coins display
      const footer = document.createElement('div');
      footer.className = 'flex justify-end gap-2 items-center';
      footer.style.cssText = 'width: 100%;';
      customFooter = footer;

      const coinDisplay = document.createElement('div');
      coinDisplay.className = 'pixel-font-16 frame-pressed-1 surface-darker flex items-center justify-end gap-1 px-1.5 pb-px text-right text-whiteRegular mr-auto guild-coins-display';
      coinDisplay.style.cssText = 'box-sizing: border-box;';

      const coinImg = document.createElement('img');
      coinImg.src = guildCoinIconUrl;
      coinImg.alt = 'Guild Coins';
      coinImg.style.cssText = 'width: 16px; height: 16px;';

      guildCoinAmountSpan = document.createElement('span');
      guildCoinAmountSpan.className = 'guild-coins-amount';
      guildCoinAmountSpan.textContent = '...';

      coinDisplay.appendChild(coinImg);
      coinDisplay.appendChild(guildCoinAmountSpan);
      footer.appendChild(coinDisplay);

      const footerCloseBtn = document.createElement('button');
      footerCloseBtn.type = 'button';
      footerCloseBtn.textContent = 'Close';
      footerCloseBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
      footerCloseBtn.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
      footerCloseBtn.addEventListener('click', () => {
        if (modalRef?.close) {
          modalRef.close();
        } else {
          const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
          if (dialog && dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
          } else {
            closeDialogWithFallback(0);
          }
        }
      });
      footer.appendChild(footerCloseBtn);

      modalContent.appendChild(row1);
      modalContent.appendChild(row2);
      modalContent.appendChild(row3);

      const footerContainer = document.createElement('div');
      footerContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0; width: 100%;';

      const separator = document.createElement('div');
      separator.className = 'separator my-2.5';
      separator.setAttribute('role', 'none');
      customSeparator = separator;
      footerContainer.appendChild(separator);

      footerContainer.appendChild(footer);
      modalContent.appendChild(footerContainer);

      // Load existing progress when modal opens
      renderKingQuestUI();
      loadKingTibianusProgress();
      updateGuildCoinDisplay();
      
      contentDiv.appendChild(modalContent);
      
      const modal = api.ui.components.createModal({
        title: 'King Tibianus',
        width: KING_TIBI_MODAL_WIDTH,
        height: KING_TIBI_MODAL_HEIGHT,
        content: contentDiv,
        buttons: []
      });
      modalRef = modal;
      
      dialogTimeout = setTimeout(() => {
        const dialog = modal?.element || document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          applyDialogStyles(dialog, KING_TIBI_MODAL_WIDTH, KING_TIBI_MODAL_HEIGHT);
          removeDefaultModalFooter(dialog);
        }
        dialogTimeout = null;
      }, 0);
      
      modalTimeout = null;
    }, 50);
  }

  // =======================
  // 7. Quest Log Tab Functions
  // =======================

  function findQuestLogContainer() {
    const selectors = [
      '.widget-bottom .grid.h-\\[260px\\].items-start.gap-1', // Most specific
      '[data-radix-scroll-area-viewport] .grid.h-\\[260px\\].items-start.gap-1',
      '.grid.h-\\[260px\\].items-start.gap-1',
      '.widget-bottom .grid.items-start.gap-1',
      '[data-radix-scroll-area-viewport] .grid.items-start.gap-1',
      '.grid.items-start.gap-1'
    ];
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const container = document.querySelector(selector);
      
      if (container) {
        console.log(`[Quests Mod] Found potential quest log container with selector ${i + 1}: ${selector}`);
        return container;
      }
    }
    
    return null;
  }

  function findRaidHunterTab() {
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer) return null;
    
    // Find Raid Hunter tab by its ID
    const raidHunterTab = document.getElementById('raid-hunter-raid-clock');
    if (raidHunterTab && questLogContainer.contains(raidHunterTab)) {
      return raidHunterTab;
    }
    
    // Fallback: Find by text content
    const allElements = questLogContainer.querySelectorAll('.frame-1');
    for (const element of allElements) {
      const text = element.textContent || '';
      if (text.includes('Raid Monitor') || text.includes('Next raid check in:')) {
        return element;
      }
    }
    
    return null;
  }

  function createKingTibianusTab() {
    console.log('[Quests Mod] Creating King Tibianus tab');
    
    const existingTab = document.getElementById(KING_TIBIANUS_TAB_ID);
    if (existingTab) {
      console.log('[Quests Mod] King Tibianus tab already exists, skipping');
      return;
    }

    const questLogContainer = findQuestLogContainer();
    
    if (!questLogContainer) {
      console.log('[Quests Mod] Quest log container not found, aborting');
      return;
    }
    
    console.log('[Quests Mod] Quest log container found, proceeding with creation...');

    const tabElement = document.createElement('div');
    tabElement.id = KING_TIBIANUS_TAB_ID;
    tabElement.className = 'frame-1 surface-regular relative grid gap-2 p-1.5 text-left data-[disabled=\'true\']:order-last md:data-[highlighted=\'true\']:brightness-[1.2]';
    tabElement.setAttribute('data-highlighted', 'false');
    tabElement.setAttribute('data-disabled', 'false');
    tabElement.style.order = '-2'; // Place before Raid Hunter (which has order: -1)

    const kingTibianusIconUrl = getQuestItemsAssetUrl('King_Tibianus.gif');
    
    tabElement.innerHTML = `
      <div class="flex justify-between gap-2">
        <div class="container-slot surface-darker grid place-items-center relative" style="width: 106px; height: 64px; min-width: 106px; min-height: 64px; padding: 0;">
          <div class="relative flex items-center justify-center" style="width: 106px; height: 64px;">
            <img alt="King Tibianus" class="pixelated" src="${kingTibianusIconUrl}" style="width: 106px; height: 64px; object-fit: contain; image-rendering: pixelated;">
          </div>
        </div>
        <div class="flex w-full flex-col">
          <p class="flex w-fit cursor-pointer items-center gap-1 text-whiteHighlight">King Tibianus</p>
          <div class="flex gap-1 mt-1">
            <button class="focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 flex-1 text-whiteHighlight" id="king-tibianus-open-btn">
              Hail the King!
            </button>
          </div>
        </div>
      </div>
    `;

    // Find Raid Hunter tab and place before it (at the top)
    const raidHunterTab = findRaidHunterTab();
    if (raidHunterTab) {
      // Check if tab is already in the DOM and in wrong position
      const existingTab = document.getElementById(KING_TIBIANUS_TAB_ID);
      if (existingTab && existingTab.parentNode === questLogContainer) {
        // Remove from current position if it exists
        existingTab.remove();
      }
      
      // Insert before Raid Hunter tab (at the top)
      questLogContainer.insertBefore(tabElement, raidHunterTab);
      console.log('[Quests Mod] King Tibianus tab placed at top (before Raid Hunter)');
    } else {
      // If Raid Hunter not found, try to find it again after a short delay
      setTimeout(() => {
        const retryRaidHunter = findRaidHunterTab();
        if (retryRaidHunter) {
          // Remove from current position if already in DOM
          if (tabElement.parentNode) {
            tabElement.remove();
          }
          
          // Insert before Raid Hunter tab
          questLogContainer.insertBefore(tabElement, retryRaidHunter);
          console.log('[Quests Mod] King Tibianus tab repositioned at top (before Raid Hunter, retry)');
        } else if (!tabElement.parentNode) {
          // If still not found and tab not in DOM, insert at the beginning
          questLogContainer.insertBefore(tabElement, questLogContainer.firstChild);
          console.log('[Quests Mod] King Tibianus tab placed at top (Raid Hunter not found after retry)');
        }
      }, 100);
      
      // Initial placement if Raid Hunter not found immediately - place at top
      if (!tabElement.parentNode) {
        questLogContainer.insertBefore(tabElement, questLogContainer.firstChild);
        console.log('[Quests Mod] King Tibianus tab placed at top (Raid Hunter not found, will retry)');
      }
    }

    // Add event listener for Open button
    const openButton = tabElement.querySelector('#king-tibianus-open-btn');
    if (openButton) {
      openButton.addEventListener('click', () => {
        console.log('[Quests Mod] King Tibianus button clicked');
        showKingTibianusModal();
      });
    }
    
    console.log('[Quests Mod] King Tibianus tab created successfully!');
  }

  function getNextElementSibling(element) {
    let sibling = element.nextSibling;
    while (sibling && sibling.nodeType !== Node.ELEMENT_NODE) {
      sibling = sibling.nextSibling;
    }
    return sibling;
  }

  function verifyKingTibianusTabPosition() {
    const tabElement = document.getElementById(KING_TIBIANUS_TAB_ID);
    if (!tabElement) return;
    
    const raidHunterTab = findRaidHunterTab();
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer || tabElement.parentNode !== questLogContainer) return;
    
    // Ensure order style is set
    if (tabElement.style.order !== '-2') {
      tabElement.style.order = '-2';
    }
    
    if (raidHunterTab) {
      // Check if tab is positioned correctly (before Raid Hunter)
      const tabIndex = Array.from(questLogContainer.children).indexOf(tabElement);
      const raidHunterIndex = Array.from(questLogContainer.children).indexOf(raidHunterTab);
      
      if (tabIndex >= raidHunterIndex) {
        // Tab is not before Raid Hunter, fix it
        console.log('[Quests Mod] King Tibianus tab is in wrong position, repositioning...');
        console.log('[Quests Mod] Current tab position:', tabIndex);
        console.log('[Quests Mod] Raid Hunter position:', raidHunterIndex);
        
        tabElement.remove();
        questLogContainer.insertBefore(tabElement, raidHunterTab);
        console.log('[Quests Mod] King Tibianus tab repositioned at top (before Raid Hunter)');
      }
    } else {
      // If Raid Hunter not found, place at the beginning
      const firstChild = questLogContainer.firstElementChild;
      if (firstChild !== tabElement) {
        console.log('[Quests Mod] Raid Hunter not found, placing King Tibianus at top...');
        tabElement.remove();
        questLogContainer.insertBefore(tabElement, questLogContainer.firstChild);
        console.log('[Quests Mod] King Tibianus tab placed at top');
      }
    }
  }

  function tryImmediateKingTibianusCreation() {
    const existingTab = document.getElementById(KING_TIBIANUS_TAB_ID);
    if (existingTab) {
      // Tab exists, verify its position
      verifyKingTibianusTabPosition();
      return false;
    }
    
    const questLogContainer = findQuestLogContainer();
    if (questLogContainer) {
      // Final verification - check for the exact Quest Log header structure
      const questLogHeader = document.querySelector('h2[id*="radix-"][class*="widget-top"] p[id*="radix-"]');
      if (!questLogHeader || questLogHeader.textContent !== 'Quest Log') {
        console.log('[Quests Mod] Quest Log verification failed');
        return false; // Not the actual Quest Log, abort
      }
      
      console.log('[Quests Mod] Quest Log verified');
      createKingTibianusTab();
      return true;
    }
    
    return false;
  }

  function checkForQuestLogContent(node) {
    return node.textContent?.includes('Quest Log') || 
           (node.querySelector?.('*') && 
            Array.from(node.querySelectorAll('*')).some(el => 
              el.textContent?.includes('Quest Log')
            )) ||
           // Check for quest log container structure
           (node.classList?.contains('grid') && 
            node.classList?.contains('items-start') && 
            node.classList?.contains('gap-1')) ||
           // Check for widget-bottom that might contain quest log
           node.classList?.contains('widget-bottom') ||
           // Check for any element with quest log related classes
           (node.querySelector && node.querySelector('.grid.h-\\[260px\\].items-start.gap-1'));
  }

  function handleQuestLogDetection(mutations) {
    try {
      let hasQuestLogContent = false;
      
      // Process mutations for quest log content
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && !document.getElementById(KING_TIBIANUS_TAB_ID)) {
              hasQuestLogContent = checkForQuestLogContent(node);
              if (hasQuestLogContent) break;
            }
          }
        }
        if (hasQuestLogContent) break;
      }
      
      // Handle quest log detection
      if (hasQuestLogContent) {
        console.log('[Quests Mod] Quest log content detected!');
        
        // Clear any existing timeout
        if (questLogObserverTimeout) {
          clearTimeout(questLogObserverTimeout);
        }
        
        // Try immediate detection first
        if (tryImmediateKingTibianusCreation()) {
          console.log('[Quests Mod] King Tibianus tab created successfully!');
          return;
        }
        
        // Verify position if tab already exists
        verifyKingTibianusTabPosition();
        
        // Fallback with minimal delay
        questLogObserverTimeout = setTimeout(() => {
          if (!document.getElementById(KING_TIBIANUS_TAB_ID) && tryImmediateKingTibianusCreation()) {
            console.log('[Quests Mod] King Tibianus tab created via delayed detection!');
          } else {
            // Verify position after delay as well
            verifyKingTibianusTabPosition();
          }
        }, 50);
      }
    } catch (error) {
      console.error('[Quests Mod] Error in handleQuestLogDetection:', error);
    }
  }

  function monitorQuestLogVisibility() {
    // Skip if observer already exists
    if (questLogObserver) {
      console.log('[Quests Mod] monitorQuestLogVisibility: Observer already exists, skipping');
      return;
    }
    
    // MutationObserver for quest log detection
    questLogObserver = new MutationObserver(handleQuestLogDetection);
    
    questLogObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[Quests Mod] MutationObserver set up for quest log detection');
  }

  function startQuestLogMonitoring() {
    console.log('[Quests Mod] startQuestLogMonitoring: Starting quest log monitoring...');
    
    // Clear any existing monitoring first
    if (questLogMonitorInterval) {
      console.log('[Quests Mod] startQuestLogMonitoring: Clearing existing interval');
      clearInterval(questLogMonitorInterval);
      questLogMonitorInterval = null;
    }
    
    if (questLogObserver) {
      console.log('[Quests Mod] startQuestLogMonitoring: Disconnecting existing observer');
      questLogObserver.disconnect();
      questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection
    monitorQuestLogVisibility();
    
    // Simple interval monitoring as backup
    questLogMonitorInterval = setInterval(() => {
      try {
        // Check if quest log is visible
        const questLogHeader = document.querySelector('h2[id*="radix-"][class*="widget-top"] p[id*="radix-"]');
        const isQuestLogOpen = questLogHeader && questLogHeader.textContent === 'Quest Log';
        
        if (isQuestLogOpen) {
          // Try immediate detection
          if (tryImmediateKingTibianusCreation()) {
            console.log('[Quests Mod] Quest log monitoring: King Tibianus tab created, continuing monitoring for future reopenings');
            // Don't stop monitoring - keep it running for future quest log reopenings
          } else {
            // Verify position even if tab already exists (more frequently when quest log is open)
            verifyKingTibianusTabPosition();
          }
        }
      } catch (error) {
        console.error('[Quests Mod] Error in quest log monitoring interval:', error);
      }
    }, 2000); // Check every 2 seconds when quest log is open
  }

  function stopQuestLogMonitoring() {
    // Clear interval
    if (questLogMonitorInterval) {
      clearInterval(questLogMonitorInterval);
      questLogMonitorInterval = null;
    }
    
    // Disconnect observer
    if (questLogObserver) {
      questLogObserver.disconnect();
      questLogObserver = null;
    }
    
    // Clear timeout
    if (questLogObserverTimeout) {
      clearTimeout(questLogObserverTimeout);
      questLogObserverTimeout = null;
    }
    
    // Remove tab element if it exists
    const tabElement = document.getElementById(KING_TIBIANUS_TAB_ID);
    if (tabElement && isInDOM(tabElement)) {
      tabElement.remove();
    }
    
    console.log('[Quests Mod] Quest log monitoring stopped');
  }

  // =======================
  // 7. Cleanup & Initialization
  // =======================

  function cleanup() {
    if (inventoryObserver) {
      try { 
        inventoryObserver.disconnect(); 
      } catch (e) {
        console.warn('[Quests Mod] Error disconnecting inventory observer:', e);
      }
      inventoryObserver = null;
    }
    
    // Cleanup quest items drop system
    if (questItemsBoardSubscription) {
      try {
        questItemsBoardSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod] Error unsubscribing from board:', e);
      }
      questItemsBoardSubscription = null;
    }
    lastProcessedQuestItemsSeed = null;
    
    // Cleanup Copper Key system
    if (copperKeyBoardSubscription) {
      try {
        copperKeyBoardSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Copper Key] Error unsubscribing from board:', e);
      }
      copperKeyBoardSubscription = null;
    }
    if (equipmentSlotObserver) {
      try {
        equipmentSlotObserver.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Copper Key] Error unsubscribing equipment slot observer:', e);
      }
      equipmentSlotObserver = null;
    }
    lastProcessedCopperKeySeed = null;
    trackedBoardConfig = null;
    
    // Remove text bubbles
    removeCopperKeyTextBubble(COPPER_KEY_CONFIG.targetTileIndex);
    
    clearAllTimeouts();
    failedAttempts = 0;
    
    // Remove event listeners and buttons
    const buttons = document.querySelectorAll('.quest-items-inventory-button');
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
    
    // Cleanup quest log monitoring
    stopQuestLogMonitoring();
  }

  // Initialize
  observeInventory();
  setupQuestItemsDropSystem();
  setupCopperKeySystem();
  setupEquipmentSlotObserver();
  
  // Load quest items from Firebase on initialization
  loadQuestItemsOnInit();
  
  // Start monitoring for quest log
  startQuestLogMonitoring();
  
  // Cleanup on mod unload
  if (typeof context !== 'undefined' && context.exports) {
    const originalCleanup = context.exports.cleanup;
    context.exports.cleanup = function() {
      cleanup();
      if (originalCleanup) originalCleanup();
    };
  }
})();
