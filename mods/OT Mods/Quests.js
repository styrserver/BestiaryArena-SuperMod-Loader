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

// Toast duration constants (in milliseconds)
const TOAST_DURATION_DEFAULT = 5000;      // 5 seconds - general notifications
const TOAST_DURATION_IMPORTANT = 10000;   // 10 seconds - important quest milestones

const SILVER_TOKEN_CONFIG = {
  productName: 'Silver Token',
  icon: 'Silver_Token.gif',
  description: 'A small silver coin used to greet King Tibianus.',
  rarity: 4
};

// Fishing system configuration
const FISHING_CONFIG = {
  SPRITE_IDS: ['12706', '622', '4597', '4609', '4598'], 
  ANIMATION_SIZE: 64,
  ANIMATION_DURATION: 500, // milliseconds
  MAP_SWITCH_DELAY: 500 // milliseconds
};

const KING_COPPER_KEY_MISSION = {
  id: 'king_copper_key',
  title: 'Retrieve King Tibianus belongings',
  prompt: 'Glad you asked! One of my guards lost my precious copper key down in the mines. Would you be able to help me get it back?',
  accept: 'Thank you! Take this map to help guide you to the mines. Let me know when you\'ve retrieved it!',
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
  prompt: 'Brave subject, I need supplies for my smiths: bring me 30 red dragon scales and 30 red dragon leathers. Will you help me?',
  accept: 'Excellent. Return once you have the materials.',
  askForItems: 'Have you brought the red dragon materials?',
  complete: 'Well done! The royal forge will thrive with these materials.',
  missingItems: 'You claim yes but lack the materials. Do not waste my time.',
  keepSearching: 'Then keep hunting dragons and return when you have them.',
  answerYesNo: 'Answer yes or no: have you brought the materials?',
  alreadyCompleted: 'You already completed this task. Impressive work.',
  alreadyActive: 'You are already on this task. Bring me the materials.',
  objectiveLine1: 'Gather 30 red dragon scales.',
  objectiveLine2: 'Gather 30 red dragon leathers.',
  hint: 'Hunt red dragons and skin them for scales and leather.',
  rewardCoins: 0
};

const KING_LETTER_MISSION = {
  id: 'king_letter_al_dee',
  title: 'Letter from Al Dee',
  prompt: 'Ah, a letter from Al Dee! That old rope merchant has been trying to get my attention for weeks. Can you return this letter to him when you visit him?',
  accept: 'Take this letter back to Al Dee. He usually hangs around somewhere in Rookgaard. Good luck on your adventure!',
  askForLetter: 'Have you returned the letter to Al Dee?',
  complete: 'Well done! Al Dee was most pleased. Perhaps you\'ll find him useful in your future adventures.',
  missingLetter: 'You claim to have returned it but I see no proof. Find Al Dee and complete his task!',
  keepSearching: 'Then find Al Dee in Rookgaard and return his letter.',
  answerYesNo: 'Answer yes or no: have you returned the letter to Al Dee?',
  alreadyCompleted: 'You already helped Al Dee. Perhaps you should visit his shop again.',
  alreadyActive: 'You are already on this task. Find Al Dee and return his letter!',
  objectiveLine1: 'Find Al Dee in Rookgaard.',
  objectiveLine2: 'Return the letter to Al Dee.',
  hint: 'Al Dee is a rope merchant. Search Rookgaard for his shop.',
  rewardCoins: KING_GUILD_COIN_REWARD
};

const AL_DEE_FISHING_MISSION = {
  id: 'al_dee_fishing_gold',
  title: 'Fishing for gold',
  prompt: 'Ah, adventurer! I dropped my Small Axe in the waters of a cave while being hunted by minotaurs and goblins. Will you help me retrieve it?',
  accept: 'Thank you! I\'ll be waiting here for my Small Axe.',
  askForItem: 'Have you found my Small Axe?',
  complete: 'My Small Axe! You found it! Here\'s a Dwarven Pickaxe as a reward for your help.',
  missingItem: 'You claim yes but I see no Small Axe. Return when you have it!',
  keepSearching: 'Then keep searching for my axe and return when you find it.',
  answerYesNo: 'Answer yes or no: have you found my Small Axe?',
  alreadyCompleted: 'You already helped me find my Small Axe. Thank you again!',
  alreadyActive: 'You\'re already helping me find my Small Axe. Bring it back when you find it!',
  objectiveLine1: 'Find Al Dee\'s Small Axe in the waters of a cave.',
  objectiveLine2: 'Return the Small Axe to Al Dee.',
  hint: 'Search underwater areas or caves where minotaurs and goblins roam.',
  rewardCoins: 0
};

const KING_ARENA_RANKS = [
  'Scout of the Arena',      // 0 missions
  'Sentinel of the Arena',   // 1 mission
  'Steward of the Arena',    // 2 missions
  'Warden of the Arena',     // 3 missions
  'Squire of the Arena',     // 4 missions
  'Warrior of the Arena',    // 5 missions
  'Keeper of the Arena',     // 6 missions
  'Guardian of the Arena',   // 7 missions
  'Sage of the Arena',       // 8 missions
  'Savant of the Arena',     // 9 missions
  'Enlightened of the Arena' // 10+ missions
];

// Firebase configuration
const FIREBASE_CONFIG = {
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app'
};

// Al Dee standard responses (non-mission related)
const AL_DEE_RESPONSES = {
  'hi': 'Hello, hello, Player! Please come in, look, and buy! I\'m a specialist for all sorts of tools. Just ask me for a trade to see my offers!',
  'hello': 'Hello, hello, Player! Please come in, look, and buy! I\'m a specialist for all sorts of tools. Just ask me for a trade to see my offers!',
  'how are you': 'I\'m fine. I\'m so glad to have you here as my customer.',
  'tools': 'As an adventurer, you should always have at least a backpack, a rope, a shovel, a weapon, an armor and a shield.',
  'offer': 'Just ask me for a trade to see my offers.',
  'trade': 'Take a look in the trade window to your right.',
  'gold': 'Well, no gold, no deal. Earn gold by fighting monsters and picking up the things they carry. Sell it to merchants to make profit!',
  'money': 'Well, no gold, no deal. Earn gold by fighting monsters and picking up the things they carry. Sell it to merchants to make profit!',
  'backpack': 'Yes, I am selling that. Simply ask me for a trade to view all my offers.',
  'rope': 'Yes, I am selling that. Simply ask me for a trade to view all my offers.',
  'ropes': 'Yes, I am selling that. Simply ask me for a trade to view all my offers.',
  'shovel': 'Yes, I am selling that. Simply ask me for a trade to view all my offers.',
  'weapon': 'Oh, I\'m sorry, but I don\'t deal with weapons. That\'s Obi\'s or Lee\'Delle\'s business. I could offer you a pick in exchange for a small axe if you should happen to own one.',
  'armor': 'Armor and shields can be bought at Dixi\'s or at Lee\'Delle\'s. Dixi runs that shop near Obi\'s.',
  'shield': 'Armor and shields can be bought at Dixi\'s or at Lee\'Delle\'s. Dixi runs that shop near Obi\'s.',
  'food': 'Hmm, the best address to look for food might be Willie or Billy. Norma also has some snacks for sale.',
  'potions': 'Sorry, I don\'t sell potions. You should visit Lily for that.',
  'cookies': 'I you want to find someone who may want to buy your cookies, you should meet Lily.',
  'fishing': 'I sell fishing rods and worms if you want to fish. Simply ask me for a trade.',
  'cooking': 'I you want to find someone who may want to buy your cookies, you should meet Lily.',
  'fish': 'No thanks. I don\'t like fish.',
  'torch': 'No thank you. I can already overstock the market with torches.',
  'worms': 'I have enough worms myself and don\'t want any more. Use them for fishing.',
  'bone': 'You better put that bone back there where you dug it out.',
  'help': 'If you need general equipment, just ask me for a trade. I can also provide you with some general hints about the game.',
  'information': 'If you need general equipment, just ask me for a trade. I can also provide you with some general hints about the game.',
  'iron ore': 'Hmm.. King Tibianus might be interested in this Iron Ore...',
  'job': 'I\'m a merchant. Just ask me for a trade to see my offers.',
  'name': 'My name is Al Dee, but you can call me Al. Can I interest you in a trade?',
  'time': 'It\'s about 0:00 am. I\'m so sorry, I have no watches to sell. Do you want to buy something else?',
  'premium': 'As a premium adventurer you have many advantages. You really should check them out!',
  'king': 'The king encouraged salesmen to travel here, but only I dared to take the risk, and a risk it was!',
  'sell': 'Just ask me for a trade to see what I buy from you.',
  'wares': 'Just ask me for a trade to see my offers.',
  'stuff': 'Just ask me for a trade to see my offers.',
  'pick': 'Picks are hard to come by. I trade them only in exchange for high quality small axes. Would you like to make that deal?',
  'small axe': 'Picks are hard to come by. I trade them only in exchange for high quality small axes. Would you like to make that deal?',
  'dungeon': 'If you want to explore the dungeons such as the sewers, you have to equip yourself with the vital stuff I am selling. It\'s vital in the deepest sense of the word.',
  'sewers': 'Oh, our sewer system is very primitive - it\'s so primitive that it\'s overrun by rats. But the stuff I sell is safe from them. Just ask me for a trade to see it!',
  'vital': 'Well, vital means - necessary for you to survive!',
  'rats': 'Rats plague our sewers. You can sell fresh rat corpses to Seymour or Tom the tanner.',
  'monsters': 'If you want to challenge monsters in the dungeons, you need some weapons and armor from the local merchants.',
  'merchants': 'To view the offers of a merchant, simply talk to him or her and ask for a trade. They will gladly show you their offers and also the things they buy from you.',
  'tibia': 'One day I will return to the continent as a rich, a very rich man!',
  'rookgaard': 'On the island of Rookgaard you can gather important experiences to prepare yourself for mainland.',
  'mainland': 'Have you ever wondered what that \'main\' is people are talking about? Well, once you\'ve reached level 8, you should talk to the oracle. You can choose a profession afterwards and explore much more of Tibia.',
  'profession': 'You will learn everything you need to know about professions once you\'ve reached the Island of Destiny.',
  'island of destiny': 'The Island of Destiny can be reached via the oracle once you are level 8. This trip will help you choose your profession!',
  'thais': 'Thais is a crowded town.',
  'academy': 'The big building in the centre of Rookgaard. They have a library, a training centre, a bank and the room of the oracle. Seymour is the teacher there.',
  'bank': 'A bank is quite useful. You can deposit your money safely there. This way you don\'t have to carry it around with you all the time. You could also invest your money in my wares!',
  'oracle': 'You can find the oracle on the top floor of the academy, just above Seymour. Go there when you are level 8.',
  'temple': 'The monk Cipfried takes care of our temple. He can heal you if you\'re badly injured or poisoned.',
  'citizen': 'If you tell me the name of a citizen, I\'ll tell you what I know about him or her.',
  'dallheim': 'Some call him a hero. He protects the town from monsters.',
  'zerbrus': 'Some call him a hero. He protects the town from monsters.',
  'al dee': 'Yep, that\'s me. Smart of you to notice that!',
  'amber': 'She\'s currently recovering from her travels in the academy. It\'s always nice to chat with her!',
  'billy': 'This is a local farmer. If you need fresh food to regain your health, it\'s a good place to go. He\'s only trading with premium adventurers though.',
  'cipfried': 'He is just an old monk. However, he can heal you if you are badly injured or poisoned.',
  'dixi': 'She\'s Obi\'s granddaughter and deals with armors and shields. Her shop is south west of town, close to the temple.',
  'hyacinth': 'He mostly stays by himself. He\'s a hermit outside of town - good luck finding him.',
  'lee delle': 'If you are a premium adventurer, you should check out Lee\'Delle\'s shop. She lives in the western part of town, just across the bridge.',
  'lily': 'She sells health potions and antidote potions. Also, she buys blueberries and cookies in case you find any.',
  'loui': 'No idea who that is.',
  'norma': 'She used to sell equipment, but I think she has opened a small bar now. Talks about changing her name to \'Mary\' and such, strange girl.',
  'obi': 'He sells weapons. His shop is south west of town, close to the temple.',
  'paulie': 'He\'s the local bank clerk.',
  'santiago': 'He dedicated his life to welcome newcomers to this island.',
  'seymour': 'Seymour is a teacher running the academy. He has many important information about Tibia.',
  'tom': 'He\'s the local tanner. You could try selling fresh corpses or leather to him.',
  'willie': 'This is a local farmer. If you need fresh food to regain your health, it\'s a good place to go. However, many monsters also carry food such as meat or cheese. Or you could simply pick blueberries.',
  'zirella': 'Poor old woman, her son Tom never visits her.',
  'bye': 'Bye, bye Player.',
  'mission': 'I have a task for you if you\'re willing to help. Would you like to hear about my lost Small Axe?',
  'missions': 'I have a task for you if you\'re willing to help. Would you like to hear about my lost Small Axe?',
  'quest': 'I have a task for you if you\'re willing to help. Would you like to hear about my lost Small Axe?',
  'task': 'I have a task for you if you\'re willing to help. Would you like to hear about my lost Small Axe?',
  'help': 'I could use some help retrieving my Small Axe from the waters. Would you like to hear about it?',
  'axe': 'Ah, my Small Axe! It fell into the cave waters while I was fleeing from minotaurs and goblins.',
  'small axe': 'Ah, my Small Axe! It fell into the cave waters while I was fleeing from minotaurs and goblins.'
};

function getAlDeeResponse(message, playerName = 'Player') {
  const lowerMessage = message.toLowerCase().trim();

  // Check for exact matches first (longer phrases first)
  const sortedKeys = Object.keys(AL_DEE_RESPONSES).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeys) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      let response = AL_DEE_RESPONSES[keyword];
      // Replace "Player" with actual player name in responses that contain it
      if (response.includes('Player')) {
        response = response.replace(/Player/g, playerName);
      }
      return response;
    }
  }

  // Default response if no match found - also replace Player with actual name
  let defaultResponse = 'Hello, hello, Player! Please come in, look, and buy! I\'m a specialist for all sorts of tools. Just ask me for a trade to see my offers!';
  return defaultResponse.replace(/Player/g, playerName);
}

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
        description: 'Obtained by defeating Dragon Lord',
        rarity: 4
      },
      {
        name: 'Red Dragon Scale',
        icon: 'Red_Dragon_Scale.PNG',
        dropChance: 0.50, // 50% chance
        description: 'Obtained by defeating Dragon Lord',
        rarity: 4
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

// Rookgaard region drop configuration - applies to ANY creature defeated in Rookgaard
const ROOKGAARD_GLOBAL_DROPS = [
  {
    name: 'Letter from Al Dee',
    icon: 'Scroll.gif',
    dropChance: 0.01, // 1% chance from any creature in Rookgaard
    description: 'Feeling lost?\nWould you give all your gold for a rope now?\nAl Dee\'s shop - come to where the ropes are!',
    rarity: 1
  },
  {
    name: 'Iron Ore',
    icon: 'Iron_Ore.gif',
    dropChance: 0.01, // 1% chance from any creature in Rookgaard
    description: 'A chunk of iron ore, useful for crafting and forging.',
    rarity: 2
  }
];

// =======================
// Copper Key Configuration
// =======================

const COPPER_KEY_CONFIG = {
  productName: 'Copper Key',
  icon: 'Copper_Key.PNG',
  targetRoomName: 'Mine Hub',
  targetMonsterName: 'Corym Charlatan',
  targetTileIndex: 69,
  description: 'A very ornate key, made of solid copper.',
  rarity: 2
};

const MAP_COLOUR_CONFIG = {
  productName: 'Map to the Mines',
  icon: 'Map_(Colour).PNG',
  description: 'The map shows the way to the mines in Kazoordoon.',
  rarity: 1
};


const KING_TIBIANUS_TAB_ID = 'quests-mod-king-tibianus-tab';
const KING_MISSIONS_BUTTON_ID = 'quests-mod-missions-btn';

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
  let kingModeActive = false;
  let lastQuestLogContainer = null;
  let missionsToggleButton = null;

  // King Tibianus chat state
  const kingChatState = {
    progressCopper: { accepted: false, completed: false },
    progressDragon: { accepted: false, completed: false },
    progressLetter: { accepted: false, completed: false },
    progressAlDeeFishing: { accepted: false, completed: false },
    missionOffered: false,
    offeredMission: null,
    awaitingKeyConfirm: false,
    starterCoinThanked: false
  };

  // Tile 79 right-click system state
  let tile79RightClickEnabled = false;
  let tile79ContextMenu = null;
  let tile79BoardSubscription = null;
  let tile79PlayerSubscription = null;

  // Fishing system state - consolidated for better organization
  const fishingState = {
    enabled: false,
    manuallyDisabled: false, // Track if user manually disabled fishing (prevents automatic re-enabling)
    contextMenu: null,
    subscriptions: {
      board: null,
      player: null
    },
    tiles: new Set(), // Track water tiles that are currently enabled
    clickedTile: null, // Store the tile that was right-clicked for animation positioning
    currentRoomId: null, // Track current room to avoid unnecessary rescanning
    alDeeMissionAttempts: 0, // Track fishing attempts in Goblin Bridge during Al Dee mission
    // King Tibianus Iron Ore quest state
    ironOreQuestActive: false,
    ironOreQuestStartTime: null,
    ironOreQuestCompleted: false,
    ironOreQuestExpired: false // True when timer expired but reward not yet claimed
  };

  // Legacy aliases for backward compatibility
  const waterFishingEnabled = fishingState.enabled;
  const waterFishingContextMenu = fishingState.contextMenu;
  const waterFishingBoardSubscription = fishingState.subscriptions.board;
  const waterFishingPlayerSubscription = fishingState.subscriptions.player;
  const waterTiles = fishingState.tiles;
  const clickedWaterTile = fishingState.clickedTile;

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
      // Attempting to add copper key text bubble
      
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
      
      // Copper key text bubble added
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


  // Helper function to find all water tiles on the current map
  function findWaterTiles() {
    console.log('[Quests Mod][Water Fishing] findWaterTiles called - scanning for sprites');

    // Generate selector from configuration
    const waterSelector = FISHING_CONFIG.SPRITE_IDS
      .map(id => `.sprite.item.relative.id-${id}`)
      .join(', ');

    console.log('[Quests Mod][Water Fishing] Using selector:', waterSelector);

    // Find all water sprites using configuration
    const allWaterSprites = document.querySelectorAll(waterSelector);
    const waterTileContainers = [];

    console.log('[Quests Mod][Water Fishing] Found water sprite elements:', allWaterSprites.length);
    console.log('[Quests Mod][Water Fishing] Total sprites on page:', document.querySelectorAll('.sprite.item.relative').length);

    // Debug all water sprites
    console.log('[Quests Mod][Water Fishing] Water sprites details:');
    allWaterSprites.forEach((sprite, index) => {
      const tileId = sprite.closest('[id^="tile-index-"]')?.id;
      console.log(`  [${index}] classes: "${sprite.className}", parent tile: "${tileId}"`);
    });

    // Process all water sprites in a single loop
    for (const sprite of allWaterSprites) {
      let tileContainer = sprite.closest('[id^="tile-index-"]');
      if (tileContainer && !waterTileContainers.includes(tileContainer)) {
        waterTileContainers.push(tileContainer);
        console.log('[Quests Mod][Water Fishing] Added water tile:', tileContainer.id, `(sprite: ${sprite.className.split(' ').pop()})`);
      }
    }

    console.log('[Quests Mod][Water Fishing] Found water tiles:', waterTileContainers.length);
    console.log('[Quests Mod][Water Fishing] Tile containers:', waterTileContainers.map(t => t.id));
    return waterTileContainers;
  }

  // Helper function to get tile container from water sprite
  function getWaterTileContainer(waterSprite) {
    return waterSprite.closest('[id^="tile-index-"]');
  }

  // Helper function to set pointer events on tiles
  function setTilePointerEvents(tiles, enabled) {
    tiles.forEach(tile => {
      tile.style.pointerEvents = enabled ? 'auto' : '';
      console.log(`[Quests Mod][Water Fishing] ${enabled ? 'Enabled' : 'Disabled'} fishing on tile:`, tile.id);
    });
  }

  // Enable right-clicking on all water tiles
  function enableWaterTileRightClick() {
    const waterTileElements = findWaterTiles();
    waterTileElements.forEach(tile => {
      if (!fishingState.tiles.has(tile)) {
        tile.style.pointerEvents = 'auto';
        fishingState.tiles.add(tile);
        console.log('[Quests Mod][Water Fishing] Enabled right-click on water tile:', tile.id);
      }
    });
  }

  // Disable right-clicking on all water tiles
  function disableWaterTileRightClick() {
    setTilePointerEvents(fishingState.tiles, false);
    fishingState.tiles.clear();
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
      
      // Explosion effect created
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
        description: COPPER_KEY_CONFIG.description,
        rarity: COPPER_KEY_CONFIG.rarity
      };
      if (!productDefinitions.find(p => p.name === copperKeyDef.name)) {
        productDefinitions.push(copperKeyDef);
      }
    }

    // Add Silver Token (starter coin)
    const silverTokenDef = {
      name: SILVER_TOKEN_CONFIG.productName,
      icon: SILVER_TOKEN_CONFIG.icon,
      description: SILVER_TOKEN_CONFIG.description,
      rarity: SILVER_TOKEN_CONFIG.rarity
    };
    if (!productDefinitions.find(p => p.name === silverTokenDef.name)) {
      productDefinitions.push(silverTokenDef);
    }

    // Add Map (Colour) to product definitions
    const mapColourDef = {
      name: MAP_COLOUR_CONFIG.productName,
      icon: MAP_COLOUR_CONFIG.icon,
      description: MAP_COLOUR_CONFIG.description,
      rarity: MAP_COLOUR_CONFIG.rarity
    };
    if (!productDefinitions.find(p => p.name === mapColourDef.name)) {
      productDefinitions.push(mapColourDef);
    }

    // Add Fishing Rod (shop item)
    const fishingRodDef = {
      name: 'Fishing Rod',
      icon: 'Fishing_Rod.gif',
      description: 'A sturdy fishing rod perfect for catching fish in local waters.',
      rarity: 2
    };
    if (!productDefinitions.find(p => p.name === fishingRodDef.name)) {
      productDefinitions.push(fishingRodDef);
    }

    // Add Obsidian Knife (for active red dragon mission only)
    if (includeObsidianKnife) {
      const obsidianKnifeDef = {
        name: 'Obsidian Knife',
        icon: 'Obsidian_Knife.gif',
        description: 'Sharp and light, this is a useful tool for tanners, doctors and assassins.',
        rarity: 3
      };
      if (!productDefinitions.find(p => p.name === obsidianKnifeDef.name)) {
        productDefinitions.push(obsidianKnifeDef);
      }
    }

    if (includeDragonClaw) {
      const dragonClawDef = {
        name: 'Dragon Claw',
        icon: 'Dragon_Claw.gif',
        description: 'It is the claw of Demodras.',
        rarity: 5
      };
      if (!productDefinitions.find(p => p.name === dragonClawDef.name)) {
        productDefinitions.push(dragonClawDef);
      }
    }

    // Add Stamped Letter (reward for letter mission)
    const stampedLetterDef = {
      name: 'Stamped Letter',
      icon: 'Stamped_Letter.gif',
      description: 'A letter stamped by King Tibianus himself, ready for delivery.',
      rarity: 1
    };
    if (!productDefinitions.find(p => p.name === stampedLetterDef.name)) {
      productDefinitions.push(stampedLetterDef);
    }

    // Add Small Axe (for Al Dee fishing mission)
    const smallAxeDef = {
      name: 'Small Axe',
      icon: 'Small_Axe.gif',
      description: 'A small but sturdy axe, useful for chopping wood and combat.',
      rarity: 2
    };
    if (!productDefinitions.find(p => p.name === smallAxeDef.name)) {
      productDefinitions.push(smallAxeDef);
    }

    // Add Magnet (reward for Iron Ore quest)
    const magnetDef = {
      name: 'Magnet',
      icon: 'Magnet.gif',
      description: 'A powerful magnet that can attract metal objects from afar.',
      rarity: 3
    };
    if (!productDefinitions.find(p => p.name === magnetDef.name)) {
      productDefinitions.push(magnetDef);
    }

    // Add Dwarven Pickaxe (reward for returning Small Axe to Al Dee)
    const dwarvenPickaxeDef = {
      name: 'Dwarven Pickaxe',
      icon: 'Dwarven_Pickaxe.gif',
      description: 'It is a masterpiece of dwarvish smithery and made of especially hard steel.',
      rarity: 4
    };
    if (!productDefinitions.find(p => p.name === dwarvenPickaxeDef.name)) {
      productDefinitions.push(dwarvenPickaxeDef);
    }

    // Add global Rookgaard drops to product definitions
    for (const globalDrop of ROOKGAARD_GLOBAL_DROPS) {
      if (!productDefinitions.find(p => p.name === globalDrop.name)) {
        productDefinitions.push(globalDrop);
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

  function getLetterFromAlDeeFirebasePath() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/letter-al-dee-rewards`;
  }

  function getIronOreFirebasePath() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/iron-ore-rewards`;
  }

  function getAlDeeShopPurchasesPath() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/al-dee-shop-purchases`;
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

  // Check if current battle is in Rookgaard region
  function isInRookgaard() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
      if (!boardContext?.selectedMap?.selectedRegion) {
        return false;
      }

      const regionId = boardContext.selectedMap.selectedRegion.id;
      return regionId === 'rook'; // 'rook' = Rookgaard region
    } catch (error) {
      console.error('[Quests Mod] Error checking Rookgaard region:', error);
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

  // Check if player has already received the Letter from Al Dee
  async function hasReceivedLetterFromAlDee(playerName) {
    if (!playerName) {
      return false;
    }

    const hashedPlayer = await hashUsername(playerName);
    const data = await fetchFirebaseData(
      `${getLetterFromAlDeeFirebasePath()}/${hashedPlayer}`,
      'check Letter from Al Dee status',
      null
    );

    return data && data.received === true;
  }

  // Mark Letter from Al Dee as received in Firebase
  async function markLetterFromAlDeeReceived(playerName) {
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
        `${getLetterFromAlDeeFirebasePath()}/${hashedPlayer}`,
        'PUT',
        data,
        'mark Letter from Al Dee as received'
      );

      console.log('[Quests Mod][Letter from Al Dee] Marked as received for player:', hashedPlayer);
    } catch (error) {
      console.error('[Quests Mod][Letter from Al Dee] Error marking as received:', error);
      throw error;
    }
  }

  async function hasReceivedIronOre(playerName) {
    if (!playerName) {
      return false;
    }

    const hashedPlayer = await hashUsername(playerName);
    const data = await fetchFirebaseData(
      `${getIronOreFirebasePath()}/${hashedPlayer}`,
      'check Iron Ore status',
      null
    );

    return data && data.received === true;
  }

  // Mark Iron Ore as received in Firebase
  async function markIronOreReceived(playerName) {
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
        `${getIronOreFirebasePath()}/${hashedPlayer}`,
        'PUT',
        data,
        'mark Iron Ore received'
      );

      console.log('[Quests Mod] Iron Ore marked as received for player:', playerName);
    } catch (error) {
      console.error('[Quests Mod] Error marking Iron Ore as received:', error);
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
      'copper key': COPPER_KEY_CONFIG.productName,
      'obsidian knife': 'Obsidian Knife',
      'dragon claw': 'Dragon Claw',
      'dragon_claw': 'Dragon Claw',
      'letter from al dee': 'Letter from Al Dee',
      'letter_from_al_dee': 'Letter from Al Dee',
      'letter': 'Letter from Al Dee',
      'stamped letter': 'Stamped Letter',
      'stamped_letter': 'Stamped Letter',
      'small axe': 'Small Axe',
      'small_axe': 'Small Axe',
      'magnet': 'Magnet'
    };
    const normalized = {};
    for (const [key, value] of Object.entries(products)) {
      const lower = key.toLowerCase();
      const canonical = canonicalMap[lower] || key;
      normalized[canonical] = (normalized[canonical] || 0) + (value || 0);
    }
    return normalized;
  }

  // Dev helper to grant/remove quest items for testing (exposed to console)
  // Use positive numbers to grant items, negative numbers to remove items
  function registerDevGrantHelper() {
    globalThis.questsDevGrant = async function ({ leather = 0, scale = 0, letter = 0, ironOre = 0, smallAxe = 0, copperKey = 0, stampedLetter = 0 } = {}) {
      try {
        const actions = [];

        // Helper function to handle both granting and removing
        const processItem = async (itemName, amount, displayName) => {
          if (amount > 0) {
            await addQuestItem(itemName, amount);
            actions.push(`+${amount} ${displayName}`);
          } else if (amount < 0) {
            const removed = await consumeQuestItem(itemName, Math.abs(amount));
            if (removed) {
              actions.push(`-${Math.abs(amount)} ${displayName}`);
            } else {
              actions.push(`Failed to remove ${Math.abs(amount)} ${displayName} (insufficient quantity)`);
            }
          }
        };

        await processItem('Red Dragon Leather', leather, 'Red Dragon Leather');
        await processItem('Red Dragon Scale', scale, 'Red Dragon Scale');
        await processItem('Letter from Al Dee', letter, 'Letter from Al Dee');
        await processItem('Iron Ore', ironOre, 'Iron Ore');
        await processItem('Small Axe', smallAxe, 'Small Axe');
        await processItem('Copper Key', copperKey, 'Copper Key');
        await processItem('Stamped Letter', stampedLetter, 'Stamped Letter');

        console.log('[Quests Mod][Dev] Quest items modified:', actions.join(', '));
        console.log('[Quests Mod][Dev] Parameters used:', { leather, scale, letter, ironOre, smallAxe, copperKey, stampedLetter });
      } catch (err) {
        console.error('[Quests Mod][Dev] Operation failed:', err);
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
      return { accepted: false, completed: false, __isEmpty: true };
    }
    const hashedPlayer = await hashUsername(playerName);
    const data = await fetchFirebaseData(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      'fetch King Tibianus progress',
      null
    );
    if (!data || Object.keys(data).length === 0) {
      return { accepted: false, completed: false, __isEmpty: true };
    }
    // New shape preferred: nested copper/dragon/letter/alDeeFishing/ironOre
    if (data.copper || data.dragon || data.letter || data.alDeeFishing || data.ironOre) {
      return {
        copper: {
          accepted: !!(data.copper && data.copper.accepted),
          completed: !!(data.copper && data.copper.completed)
        },
        dragon: {
          accepted: !!(data.dragon && data.dragon.accepted),
          completed: !!(data.dragon && data.dragon.completed)
        },
        letter: {
          accepted: !!(data.letter && data.letter.accepted),
          completed: !!(data.letter && data.letter.completed)
        },
        alDeeFishing: {
          accepted: !!(data.alDeeFishing && data.alDeeFishing.accepted),
          completed: !!(data.alDeeFishing && data.alDeeFishing.completed)
        },
        ironOre: {
          active: !!(data.ironOre && data.ironOre.active),
          startTime: data.ironOre && data.ironOre.startTime ? data.ironOre.startTime : null,
          completed: !!(data.ironOre && data.ironOre.completed)
        },
        __isEmpty: false
      };
    }
    // Backward compatibility: flat accepted/completed
    const emptyFlat = (data.accepted === undefined && data.completed === undefined);
    return {
      accepted: data.accepted === true,
      completed: data.completed === true,
      __isEmpty: emptyFlat
    };
  }

  async function saveKingTibianusProgress(playerName, progress) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    const normalized = (progress && (progress.copper || progress.dragon || progress.letter || progress.alDeeFishing || progress.ironOre))
      ? {
          copper: {
            accepted: !!(progress.copper && progress.copper.accepted),
            completed: !!(progress.copper && progress.copper.completed)
          },
          dragon: {
            accepted: !!(progress.dragon && progress.dragon.accepted),
            completed: !!(progress.dragon && progress.dragon.completed)
          },
          letter: {
            accepted: !!(progress.letter && progress.letter.accepted),
            completed: !!(progress.letter && progress.letter.completed)
          },
          alDeeFishing: {
            accepted: !!(progress.alDeeFishing && progress.alDeeFishing.accepted),
            completed: !!(progress.alDeeFishing && progress.alDeeFishing.completed)
          },
          ironOre: {
            active: !!(progress.ironOre && progress.ironOre.active),
            startTime: progress.ironOre && progress.ironOre.startTime ? progress.ironOre.startTime : null,
            completed: !!(progress.ironOre && progress.ironOre.completed)
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

  async function deleteKingTibianusProgress(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await firebaseRequest(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      'DELETE',
      null,
      'delete King Tibianus progress'
    );
    console.log('[Quests Mod][King Tibianus] Progress deleted for player:', playerName);
  }

  async function deleteQuestItems(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await firebaseRequest(
      `${getQuestItemsApiUrl()}/${hashedPlayer}`,
      'DELETE',
      null,
      'delete quest items'
    );
    console.log('[Quests Mod][Quest Items] All quest items deleted for player:', playerName);
  }

  async function deleteAlDeeShopPurchases(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await firebaseRequest(
      `${getAlDeeShopPurchasesPath()}/${hashedPlayer}`,
      'DELETE',
      null,
      'delete Al Dee shop purchases'
    );
    console.log('[Quests Mod][Al Dee Shop] All shop purchases deleted for player:', playerName);
  }

  async function deleteCopperKeyReceived(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await firebaseRequest(
      `${getCopperKeyFirebasePath()}/${hashedPlayer}`,
      'DELETE',
      null,
      'delete Copper Key received status'
    );
    console.log('[Quests Mod][Copper Key] Copper Key received status deleted for player:', playerName);
  }

  async function deleteLetterFromAlDeeReceived(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await firebaseRequest(
      `${getLetterFromAlDeeFirebasePath()}/${hashedPlayer}`,
      'DELETE',
      null,
      'delete Letter from Al Dee received status'
    );
    console.log('[Quests Mod][Letter from Al Dee] Letter from Al Dee received status deleted for player:', playerName);
  }

  async function getAlDeeShopPurchases(playerName) {
    if (!playerName) return {};
    const hashedPlayer = await hashUsername(playerName);
    try {
      const response = await firebaseRequest(
        `${getAlDeeShopPurchasesPath()}/${hashedPlayer}`,
        'GET',
        null,
        'get Al Dee shop purchases'
      );
      return response || {};
    } catch (error) {
      console.warn('[Quests Mod][Al Dee Shop] Error getting purchases:', error);
      return {};
    }
  }

  async function saveAlDeeShopPurchase(playerName, itemId, purchased = true) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    const purchases = await getAlDeeShopPurchases(playerName);
    purchases[itemId] = purchased;
    await firebaseRequest(
      `${getAlDeeShopPurchasesPath()}/${hashedPlayer}`,
      'PUT',
      purchases,
      'save Al Dee shop purchase'
    );
    console.log('[Quests Mod][Al Dee Shop] Purchase saved:', itemId);
  }

  function getCompletedMissionsCount(progress) {
    if (!progress || progress.__isEmpty) return 0;

    let count = 0;

    // Handle new nested structure
    if (progress.copper) {
      if (progress.copper.completed) count++;
    }
    if (progress.dragon) {
      if (progress.dragon.completed) count++;
    }
    if (progress.letter) {
      if (progress.letter.completed) count++;
    }
    if (progress.alDeeFishing) {
      if (progress.alDeeFishing.completed) count++;
    }

    // Handle legacy flat structure for backward compatibility
    if (progress.completed === true) {
      count = 1; // Assume at least one mission completed in old format
    }

    return count;
  }

  function getCurrentArenaRank(completedMissions) {
    // Cap at the highest rank (10+ missions = Enlightened)
    const rankIndex = Math.min(completedMissions, KING_ARENA_RANKS.length - 1);
    return KING_ARENA_RANKS[rankIndex];
  }

  function getRankColor(completedMissions) {
    // Rarity-based color progression: grey → green → blue → purple → gold
    if (completedMissions <= 1) return 'rgb(150, 150, 150)'; // Grey (Scout, Sentinel)
    if (completedMissions <= 3) return 'rgb(100, 200, 100)'; // Green (Steward, Warden)
    if (completedMissions <= 5) return 'rgb(100, 150, 255)'; // Blue (Squire, Warrior)
    if (completedMissions <= 7) return 'rgb(150, 100, 255)'; // Purple (Keeper, Guardian)
    return 'rgb(255, 215, 0)'; // Gold (Sage, Savant, Enlightened)
  }

  async function updateArenaRankDisplay() {
    const rankElement = document.getElementById('king-tibianus-rank-display');
    if (!rankElement) return;

    try {
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        rankElement.textContent = 'Rank: Scout of the Arena';
        rankElement.style.color = 'rgb(150, 150, 150)'; // Grey for default
        return;
      }

      const progress = await getKingTibianusProgress(currentPlayer);
      const completedCount = getCompletedMissionsCount(progress);
      const currentRank = getCurrentArenaRank(completedCount);

      rankElement.textContent = `Rank: ${currentRank}`;
      rankElement.style.color = getRankColor(completedCount);
    } catch (error) {
      console.error('[Quests Mod] Error updating arena rank display:', error);
      rankElement.textContent = 'Rank: Scout of the Arena';
      rankElement.style.color = 'rgb(150, 150, 150)'; // Grey for error case
    }
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
      try {
        const playerName = getCurrentPlayerName();
        const kingProgress = await getKingTibianusProgress(playerName);
        await grantStarterSilverTokenIfNeeded(kingProgress, playerName);
      } catch (err) {
        console.warn('[Quests Mod] Could not grant starter Silver Token on init:', err);
      }
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

  async function isAlDeeFishingMissionActive() {
    try {
      const missionProgress = getMissionProgress(AL_DEE_FISHING_MISSION);
      return missionProgress && missionProgress.accepted && !missionProgress.completed;
    } catch (error) {
      console.warn('[Quests Mod][Quest Items] Error checking Al Dee fishing mission:', error);
      return false;
    }
  }

  // Get gameIds for Al Dee's dwarf monsters
  async function getAlDeeDwarfGameIds() {
    const dwarfNames = ['Dwarf', 'Dwarf Guard', 'Dwarf Soldier', 'Dwarf Geomancer', 'Sweaty Cyclops'];
    const gameIds = [];

    for (const name of dwarfNames) {
      // Try multiple methods to find the gameId
      let gameId = null;

      if (window.BestiaryModAPI?.utility?.maps?.monsterNamesToGameIds) {
        gameId = window.BestiaryModAPI.utility.maps.monsterNamesToGameIds.get(name.toLowerCase());
      }

      if (!gameId && window.creatureDatabase?.findMonsterByName) {
        const monster = window.creatureDatabase.findMonsterByName(name);
        if (monster) gameId = monster.gameId;
      }

      if (!gameId && globalThis.state?.utils?.getMonster) {
        // Fallback: search through all monsters
        for (let i = 1; i < 1000 && !gameId; i++) {
          try {
            const monster = globalThis.state.utils.getMonster(i);
            if (monster?.metadata?.name === name) {
              gameId = i;
            }
          } catch (e) { break; }
        }
      }

      if (gameId) {
        gameIds.push(gameId);
        console.log(`[Quests Mod][Al Dee Fishing] Found ${name} gameId: ${gameId}`);
      } else {
        console.warn(`[Quests Mod][Al Dee Fishing] Could not find gameId for ${name}`);
      }
    }

    return gameIds;
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
    console.log('[Quests Mod][Quest Items] addQuestItem called:', productName, amount);
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
      // Cap various quest items to 1, red dragon materials at 30, iron ore at 2
      const isRedDragonMaterial = productName === 'Red Dragon Scale' || productName === 'Red Dragon Leather';
      const isIronOre = productName === 'Iron Ore';
      const isUniqueItem = [
        'Copper Key',
        'Map to the Mines',
        'Silver Token',
        'Dragon Claw',
        'Obsidian Knife',
        'Letter from Al Dee',
        'Stamped Letter',
        'Small Axe',
        'Magnet',
        'Dwarven Pickaxe'
      ].includes(productName);

      const newCount = isRedDragonMaterial ? Math.min(30, currentCount + amount) :
                      isIronOre ? Math.min(1, currentCount + amount) :
                      isUniqueItem ? Math.min(1, currentCount + amount) :
                      currentCount + amount;
      
      const updatedProducts = {
        ...currentProducts,
        [productName]: newCount
      };
      
      const encrypted = await encryptQuestItems(updatedProducts, currentPlayer);
      const hashedPlayer = await hashUsername(currentPlayer);
      
      console.log('[Quests Mod][Quest Items] Saving to Firebase', { hashedPlayer, productName, amount, newCount });
      console.log('[Quests Mod][Quest Items] About to make Firebase request...');
      const firebaseResult = await firebaseRequest(
        `${getQuestItemsApiUrl()}/${hashedPlayer}`,
        'PUT',
        { encrypted },
        'save quest items'
      );
      console.log('[Quests Mod][Quest Items] Firebase request completed:', firebaseResult);
      
      // Update cache
      cachedQuestItems = updatedProducts;
      
      // Quest item added to inventory
      return updatedProducts;
    } catch (error) {
      console.error('[Quests Mod][Quest Items] Error adding quest item:', error);
      throw error;
    }
  }

  async function consumeQuestItem(productName, amount) {
    try {
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        throw new Error('Player name not available');
      }
      if (amount <= 0) {
        return false;
      }

      const currentProducts = await getQuestItems(false);
      const currentCount = currentProducts[productName] || 0;
      if (currentCount < amount) {
        return false;
      }

      const newCount = currentCount - amount;
      const updatedProducts = { ...currentProducts };
      if (newCount > 0) {
        updatedProducts[productName] = newCount;
      } else {
        delete updatedProducts[productName];
      }

      const encrypted = await encryptQuestItems(updatedProducts, currentPlayer);
      const hashedPlayer = await hashUsername(currentPlayer);

      console.log('[Quests Mod][Quest Items] Consuming from Firebase', { hashedPlayer, productName, amount, newCount });
      await firebaseRequest(
        `${getQuestItemsApiUrl()}/${hashedPlayer}`,
        'PUT',
        { encrypted },
        'save quest items'
      );

      cachedQuestItems = updatedProducts;
      return true;
    } catch (error) {
      console.error('[Quests Mod][Quest Items] Error consuming quest item:', error);
      return false;
    }
  }

  async function hasSilverToken() {
    try {
      // Prefer cached items if available to avoid races just after grant
      if (cachedQuestItems && cachedQuestItems[SILVER_TOKEN_CONFIG.productName] > 0) {
        return true;
      }
      const items = await getQuestItems(true);
      return (items && items[SILVER_TOKEN_CONFIG.productName] > 0);
    } catch (error) {
      console.error('[Quests Mod] Error checking Silver Token:', error);
      return false;
    }
  }

  async function grantStarterSilverTokenIfNeeded(progress, playerName) {
    try {
      if (!progress || !progress.__isEmpty || !playerName) {
        return;
      }
      const hasToken = await hasSilverToken();
      if (hasToken) {
        return;
      }
      await addQuestItem(SILVER_TOKEN_CONFIG.productName, 1);
      await saveKingTibianusProgress(playerName, {
        copper: { accepted: false, completed: false },
        dragon: { accepted: false, completed: false }
      });
      console.log('[Quests Mod] Granted starter Silver Token to new player (no King progress)');
    } catch (error) {
      console.error('[Quests Mod] Error granting starter Silver Token:', error);
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

  // Get stamina spent from serverResults (based on Hunt Analyzer implementation)
  function getStaminaSpent(serverResults) {
    if (!serverResults) {
      return 0;
    }

    // Use the same method as Hunt Analyzer: serverResults.next.playerExpDiff
    // This represents the experience/stamina cost of the battle
    if (serverResults.next && typeof serverResults.next.playerExpDiff === 'number') {
      return serverResults.next.playerExpDiff;
    }

    // Fallback to other possible locations if the main one doesn't work
    if (typeof serverResults.staminaSpent === 'number') {
      return serverResults.staminaSpent;
    }

    if (serverResults.rewardScreen && typeof serverResults.rewardScreen.staminaSpent === 'number') {
      return serverResults.rewardScreen.staminaSpent;
    }

    if (serverResults.battleData && typeof serverResults.battleData.staminaSpent === 'number') {
      return serverResults.battleData.staminaSpent;
    }

    // Default to 0 if not found
    return 0;
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
        
        // Get creature config (may be null if no specific quest items)
        const creatureConfig = getQuestItemsConfig(creatureGameId);

        // Get stamina spent for dynamic drop chance calculation
        const staminaSpent = getStaminaSpent(serverResults);

        // Always run drop logic async (even for creatures with no specific quest items)
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

          // If this is a dwarf loot source for Al Dee fishing, require the mission to be active
          const alDeeDwarfGameIds = await getAlDeeDwarfGameIds();
          const isAlDeeDwarfLoot = alDeeDwarfGameIds.includes(creatureGameId);
          if (isAlDeeDwarfLoot) {
            const alDeeFishingActive = await isAlDeeFishingMissionActive();
            if (!alDeeFishingActive) {
              console.log('[Quests Mod][Quest Items] Al Dee dwarf loot skipped; mission not active');
              return;
            }
          }

          // Get creature name for logging (fallback if no config)
          const creatureName = creatureConfig ? creatureConfig.creatureName : `Creature ${creatureGameId}`;
          console.log(`[Quests Mod][Quest Items] ${creatureName} victory detected (gameId: ${creatureGameId}), seed:`, seed, `, stamina spent: ${staminaSpent}`);

          // Process creature-specific drops (if any)
          if (creatureConfig && creatureConfig.products.length > 0) {
            console.log(`[Quests Mod][Quest Items] Processing ${creatureConfig.products.length} creature-specific drops`);
            for (let productIndex = 0; productIndex < creatureConfig.products.length; productIndex++) {
              const product = creatureConfig.products[productIndex];
              const roll = deterministicRandom(seed, creatureGameId, productIndex);
              // Drop roll calculated
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
          } else {
            console.log(`[Quests Mod][Quest Items] No creature-specific drops configured for ${creatureName}`);
          }

          // Process Al Dee fishing Iron Ore drops from dwarves
          if (isAlDeeDwarfLoot) {
            console.log(`[Quests Mod][Quest Items] Processing Al Dee fishing Iron Ore drop from ${creatureName} (gameId: ${creatureGameId}), seed:`, seed);

            // Check if player has already received Iron Ore (one-time per account)
            const currentPlayer = getCurrentPlayerName();
            const hasReceived = await hasReceivedIronOre(currentPlayer);
            if (hasReceived) {
              console.log('[Quests Mod][Quest Items] Iron Ore already received by this account, skipping drop');
            } else {
              // Use a unique productIndex (9999) for Iron Ore to avoid conflicts
              const roll = deterministicRandom(seed, creatureGameId, 9999);
              // Drop roll calculated
              console.log(`[Quests Mod][Quest Items] Iron Ore roll: ${(roll * 100).toFixed(1)}% (need ≤ 1.0% | creature: ${creatureName})`);
              if (roll <= 0.01) { // 1% chance
                try {
                  await addQuestItem('Iron Ore', 1);
                  showQuestItemNotification('Iron Ore', 1);
                  console.log(`[Quests Mod][Quest Items] Iron Ore awarded from ${creatureName} (Al Dee fishing mission)`);

                  // Mark as received for one-time item
                  await markIronOreReceived(currentPlayer);
                } catch (error) {
                  console.error(`[Quests Mod][Quest Items] Error adding Iron Ore:`, error);
                }
              }
            }
          }

          // Process global Rookgaard drops (applies to ANY creature defeated in Rookgaard)
          if (isInRookgaard()) {
            console.log('[Quests Mod][Quest Items] Checking global Rookgaard drops');
            for (let globalIndex = 0; globalIndex < ROOKGAARD_GLOBAL_DROPS.length; globalIndex++) {
              const globalDrop = ROOKGAARD_GLOBAL_DROPS[globalIndex];

              // Check if player has already received this item (one-time per account)
              if (globalDrop.name === 'Letter from Al Dee') {
                const currentPlayer = getCurrentPlayerName();
                const hasReceived = await hasReceivedLetterFromAlDee(currentPlayer);
                if (hasReceived) {
                  console.log('[Quests Mod][Quest Items] Letter from Al Dee already received by this account, skipping drop');
                  continue;
                }
              }

              // Calculate dynamic drop chance based on stamina spent: 1% per 3 stamina
              const baseDropChance = (staminaSpent / 3) * 0.01;
              const actualDropChance = Math.min(baseDropChance, 1.0); // Cap at 100%

              // Use fixed seed (999) for all Rookgaard drops - only depends on battle seed and victory
              const roll = deterministicRandom(seed, 999, globalIndex);
              console.log(`[Quests Mod][Quest Items] ${globalDrop.name} roll: ${(roll * 100).toFixed(1)}% (need ≤ ${(actualDropChance * 100).toFixed(1)}% | ${staminaSpent} stamina = ${(staminaSpent / 3).toFixed(1)}% base chance)`);
              if (roll <= actualDropChance) {
                try {
                  await addQuestItem(globalDrop.name, 1);
                  showQuestItemNotification(globalDrop.name, 1);
                  console.log(`[Quests Mod][Quest Items] ${globalDrop.name} awarded from ${creatureName} (Rookgaard global drop)`);

                  // Mark as received for one-time items
                  if (globalDrop.name === 'Letter from Al Dee') {
                    const currentPlayer = getCurrentPlayerName();
                    await markLetterFromAlDeeReceived(currentPlayer);
                  }
                } catch (error) {
                  console.error(`[Quests Mod][Quest Items] Error adding ${globalDrop.name}:`, error);
                }
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

  // Toast timer management helpers - removed, using simple setTimeout instead

  // Generic toast notification function
  function showToast({ productName, message, duration = TOAST_DURATION_DEFAULT, logPrefix = '[Quests Mod]' }) {
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

      // Add click event listener for dismissal
      toast.addEventListener('click', () => {
        if (flexContainer && flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateToastPositions(mainContainer);
        }
      });

      // Auto-remove after duration
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
      duration: TOAST_DURATION_DEFAULT
    });
  }

  function showCopperKeyFoundToast() {
    showToast({
      message: 'Found Copper Key!',
      duration: TOAST_DURATION_IMPORTANT,
      logPrefix: '[Quests Mod][Copper Key]'
    });
  }

  function showMapReceivedToast() {
    showToast({
      productName: MAP_COLOUR_CONFIG.productName,
      message: 'Received Map!',
      duration: TOAST_DURATION_IMPORTANT,
      logPrefix: '[Quests Mod][King Tibianus]'
    });
  }

  function showCoinReceivedToast() {
    showToast({
      productName: SILVER_TOKEN_CONFIG.productName,
      message: 'King Tibianus took your coin!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][King Tibianus]'
    });
  }

  function showMineNavigationToast() {
    showToast({
      productName: MAP_COLOUR_CONFIG.productName,
      message: 'Navigated to the mines!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][Map Navigation]'
    });
  }

  function showDragonClawReceivedToast() {
    showToast({
      productName: 'Dragon Claw',
      message: 'Received Dragon Claw!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][King Tibianus]'
    });
  }

  function showObsidianKnifeReceivedToast() {
    showToast({
      productName: 'Obsidian Knife',
      message: 'Received Obsidian Knife!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][King Tibianus]'
    });
  }

  function showStampedLetterReceivedToast() {
    showToast({
      productName: 'Stamped Letter',
      message: 'Received Stamped Letter!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][King Tibianus]'
    });
  }

  function showStampedLetterDeliveredToast() {
    showToast({
      productName: 'Stamped Letter',
      message: 'Delivered to Al Dee!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][Al Dee]'
    });
  }

  function showSmallAxeReturnedToast() {
    showToast({
      productName: 'Small Axe',
      message: 'Returned to Al Dee!',
      duration: TOAST_DURATION_DEFAULT,
      logPrefix: '[Quests Mod][Al Dee]'
    });
  }

  function clearAllTimeouts() {
    clearTimeoutOrInterval(buttonCheckInterval);
    clearTimeoutOrInterval(buttonRetryTimeout);
    clearTimeoutOrInterval(observerDebounceTimeout);
    clearTimeoutOrInterval(modalTimeout);
    clearTimeoutOrInterval(dialogTimeout);
    // clearAllToastTimers(); - removed, no longer needed
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
    
    // Find the equipment container button
    const allButtons = Array.from(inventoryContainer.querySelectorAll('button.focus-style-visible.active\\:opacity-70'));
    const equipmentContainerButton = allButtons.find(button => {
      const equipmentImg = button.querySelector('img[alt="equipments"][src*="/assets/icons/equipment-container.png"]');
      return equipmentImg !== null && !button.classList.contains('quest-items-inventory-button');
    });

    if (!equipmentContainerButton) {
      failedAttempts++;
      return false;
    }

    // Check if equipment container button is still connected to DOM
    if (!isInDOM(equipmentContainerButton)) {
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
      if (isInDOM(equipmentContainerButton)) {
        equipmentContainerButton.insertAdjacentElement('afterend', questItemsButton);
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

  async function refreshQuestItemsModal() {
    // Check if quest items modal is currently open
    const existingModal = document.querySelector('div[role="dialog"][data-state="open"] h2.widget-top-text p');
    if (existingModal && existingModal.textContent === 'Quest Items') {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        const contentDiv = dialog.querySelector('.widget-bottom');
        if (contentDiv) {
          // Clear existing content and reload
          contentDiv.innerHTML = '';

          // Rebuild the modal content (similar to showQuestItemsModal but without creating new modal)
          try {
            clearQuestItemsCache();
            const products = await getQuestItems(false);
            const hideCopperKey = await isCopperKeyMissionCompleted();
            const redDragonActive = await isRedDragonMissionActive();
            const redDragonCompleted = await isRedDragonMissionCompleted();
            const displayProducts = { ...products };
            console.log('[Quests Mod][Quest Items] Refreshing display products:', displayProducts);

            if (hideCopperKey) {
              delete displayProducts[COPPER_KEY_CONFIG.productName];
              delete displayProducts[MAP_COLOUR_CONFIG.productName];
            }
            if (redDragonCompleted) {
              delete displayProducts['Red Dragon Leather'];
              delete displayProducts['Red Dragon Scale'];
            }

            const productDefinitions = buildProductDefinitions({
              includeCopperKey: !hideCopperKey,
              includeObsidianKnife: redDragonActive,
              includeDragonClaw: redDragonCompleted || (displayProducts['Dragon Claw'] > 0)
            });

            // Recreate the modal layout
            const mainContainer = document.createElement('div');
            mainContainer.style.cssText = 'width: 100%; height: 100%; max-width: 500px; min-height: 180px; max-height: 180px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: row; justify-content: flex-start; align-items: flex-start; gap: 8px; color: rgb(230, 215, 176);';

            // Left column: Products list
            const productsListContainer = document.createElement('div');
            productsListContainer.style.cssText = 'flex: 1 0 0px; display: flex; flex-direction: column; margin: 0px; padding: 0px; min-height: 0px; height: 100%; background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat; border-width: 4px; border-style: solid; border-color: transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill / 1 / 0 stretch; border-radius: 6px; overflow: hidden; width: 180px;';

            const leftHeader = document.createElement('h2');
            leftHeader.className = 'widget-top widget-top-text pixel-font-16';
            leftHeader.style.cssText = 'margin: 0px; padding: 2px 8px; text-align: center; color: rgb(255, 255, 255);';
            const leftHeaderP = document.createElement('p');
            leftHeaderP.className = 'pixel-font-16';
            leftHeaderP.style.cssText = 'margin: 0px; padding: 0px; text-align: center; color: rgb(255, 255, 255);';
            leftHeaderP.textContent = 'Quest Items';
            leftHeader.appendChild(leftHeaderP);
            productsListContainer.appendChild(leftHeader);

            const leftContent = document.createElement('div');
            leftContent.className = 'column-content-wrapper';
            leftContent.style.cssText = 'flex: 1 1 0px; height: 100%; min-height: 0px; overflow-y: auto; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 8px;';

            const productGrid = document.createElement('div');
            productGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, 34px); gap: 2px; overflow: hidden auto; height: 100%; align-content: start;';

            // Add products to grid
            let hasAnyProducts = false;
            for (const productDef of productDefinitions) {
              const count = displayProducts[productDef.name] || 0;

              // Skip products the user doesn't own
              if (count <= 0) {
                continue;
              }

              hasAnyProducts = true;

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
              const containerSlot = createProductSlot(productDef, count, false, productDef.rarity || 5);
              productItem.appendChild(containerSlot);

              productGrid.appendChild(productItem);
            }

            leftContent.appendChild(productGrid);
            productsListContainer.appendChild(leftContent);
            mainContainer.appendChild(productsListContainer);

            // Right column: Details
            const detailsContainer = document.createElement('div');
            detailsContainer.style.cssText = 'flex: 1 0 0px; display: flex; flex-direction: column; margin: 0px; padding: 0px; min-height: 0px; height: 100%; background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat; border-width: 4px; border-style: solid; border-color: transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill / 1 / 0 stretch; border-radius: 6px; overflow: hidden; width: 280px;';

            const rightHeader = document.createElement('h2');
            rightHeader.className = 'widget-top widget-top-text pixel-font-16';
            rightHeader.style.cssText = 'margin: 0px; padding: 2px 8px; text-align: center; color: rgb(255, 255, 255);';
            const rightHeaderP = document.createElement('p');
            rightHeaderP.className = 'pixel-font-16';
            rightHeaderP.style.cssText = 'margin: 0px; padding: 0px; text-align: center; color: rgb(255, 255, 255);';
            rightHeaderP.textContent = 'Details';
            rightHeader.appendChild(rightHeaderP);
            detailsContainer.appendChild(rightHeader);

            const rightContent = document.createElement('div');
            rightContent.className = 'column-content-wrapper';
            rightContent.style.cssText = 'flex: 1 1 0px; height: 100%; min-height: 0px; overflow-y: auto; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 8px;';

            const detailsWrapper = document.createElement('div');
            detailsWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 8px; overflow-y: auto; height: 100%;';

            // Selected item display
            const selectedItemDisplay = document.createElement('div');
            selectedItemDisplay.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;';
            const selectedItemSlot = document.createElement('div');
            selectedItemSlot.className = 'container-slot surface-darker';
            selectedItemSlot.style.cssText = 'width: 34px; height: 34px;';
            selectedItemSlot.setAttribute('data-hoverable', 'false');
            selectedItemSlot.setAttribute('data-highlighted', 'false');
            selectedItemSlot.setAttribute('data-disabled', 'false');
            selectedItemDisplay.appendChild(selectedItemSlot);

            const selectedItemInfo = document.createElement('div');
            selectedItemInfo.style.cssText = 'flex: 1 1 0%;';
            selectedItemDisplay.appendChild(selectedItemInfo);

            // Description box
            const descriptionBox = document.createElement('div');
            descriptionBox.style.cssText = 'min-height: 72px; padding: 2px 4px; width: 100%; box-sizing: border-box; background: url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat; border-width: 4px; border-style: solid; border-color: transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill / 1 / 0 stretch;';

            detailsWrapper.appendChild(selectedItemDisplay);
            detailsWrapper.appendChild(descriptionBox);
            rightContent.appendChild(detailsWrapper);
            detailsContainer.appendChild(rightContent);
            mainContainer.appendChild(detailsContainer);

            contentDiv.appendChild(mainContainer);

            // Add separator and close button
            const separator = document.createElement('div');
            separator.className = 'separator my-2.5';
            separator.setAttribute('role', 'none');
            contentDiv.appendChild(separator);

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex justify-end gap-2';
            const closeButton = document.createElement('button');
            closeButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
            closeButton.textContent = 'Close';
            buttonContainer.appendChild(closeButton);
            contentDiv.appendChild(buttonContainer);

          } catch (error) {
            console.error('[Quests Mod][Quest Items] Error refreshing modal:', error);
          }
        }
      }
    }
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
          console.log('[Quests Mod][Quest Items] Display products:', displayProducts);
          if (hideCopperKey) {
            delete displayProducts[COPPER_KEY_CONFIG.productName];
            delete displayProducts[MAP_COLOUR_CONFIG.productName];
          }
          // Obsidian Knife is now awarded when accepting the mission, so it will be in displayProducts if owned
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

          // Make the container clickable for navigation if it's the map
          if (productDef.name === MAP_COLOUR_CONFIG.productName) {
            iconNameContainer.style.cursor = 'pointer';
            iconNameContainer.title = 'Click to navigate to the mines';

            // Add navigation function
            const navigateToMineHub = () => {
              const roomNames = globalThis.state?.utils?.ROOM_NAME;
              if (!roomNames) return false;

              // Try to find Mine Hub or Kazordoon in the room names
              const targetNames = ['Mine Hub', 'Kazordoon'];
              let targetRoomId = null;

              for (const targetName of targetNames) {
                for (const [roomId, displayName] of Object.entries(roomNames)) {
                  if (displayName === targetName) {
                    targetRoomId = roomId;
                    break;
                  }
                }
                if (targetRoomId) break;
              }

              if (targetRoomId && globalThis.state?.board) {
                // Close modal first by finding and clicking the close button
                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                if (dialog) {
                  const closeButton = Array.from(dialog.querySelectorAll('button')).find(
                    btn => btn.textContent.trim() === 'Close'
                  );
                  if (closeButton) {
                    closeButton.click();
                  }
                }

                // Navigate after modal is closed
                setTimeout(() => {
                  globalThis.state.board.send({
                    type: 'selectRoomById',
                    roomId: targetRoomId
                  });

                  // Set floor to 0 after navigation
                  try {
                    globalThis.state.board.trigger.setState({ fn: (prev) => ({ ...prev, floor: 0 }) });
                  } catch (error) {
                    console.warn('[Quests Mod][Map Navigation] Error setting floor to 0:', error);
                  }

                  // Show navigation toast
                  showMineNavigationToast();
                }, 200);

                return true;
              }
              return false;
            };

            iconNameContainer.addEventListener('click', (e) => {
              e.stopPropagation();
              navigateToMineHub();
            });
          }

          // Icon on the left
          const productSlot = createProductSlot(productDef, count, false, productDef.rarity || 5);
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

          // Add toggle button for Fishing Rod inside the description frame
          if (productDef.name === 'Fishing Rod') {
            // Create the toggle button
            const toggleButton = document.createElement('button');
            toggleButton.type = 'button';
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-3 py-1 pixel-font-12';
            toggleButton.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; height: 28px; font-size: 12px; margin-top: 8px; display: block; margin-left: auto; margin-right: auto;';

            // Function to update button appearance based on fishing state
            const updateButtonState = () => {
              if (fishingState.enabled) {
                toggleButton.textContent = 'Fishing Enabled';
                toggleButton.style.setProperty('background-image', 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")', 'important');
                toggleButton.style.setProperty('background-repeat', 'repeat', 'important');
                toggleButton.style.setProperty('border-color', '#4CAF50', 'important'); // Green border
              } else {
                toggleButton.textContent = 'Fishing Disabled';
                toggleButton.style.setProperty('background-image', 'url("https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png")', 'important');
                toggleButton.style.setProperty('background-repeat', 'repeat', 'important');
                toggleButton.style.setProperty('border-color', '#f44336', 'important'); // Red border
              }
            };

            // Initialize button state
            updateButtonState();

            // Add click handler to toggle fishing
            toggleButton.addEventListener('click', () => {
              fishingState.enabled = !fishingState.enabled;
              // Track manual preference - if user disables, remember it
              fishingState.manuallyDisabled = !fishingState.enabled;
              updateButtonState();

              // Update fishing functionality based on new state (manual toggle)
              updateWaterFishingState(true);

              // Show toast notification
              const toastMessage = fishingState.enabled ? 'Fishing enabled!' : 'Fishing disabled!';
              const toastType = fishingState.enabled ? 'success' : 'info';

              if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.showToast) {
                api.ui.components.showToast({
                  message: toastMessage,
                  type: toastType,
                  duration: TOAST_DURATION_DEFAULT
                });
              }
            });

            descFrame.appendChild(toggleButton);
          }

          // Drop chance removed from display
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
          const containerSlot = createProductSlot(productDef, count, selectedProductElement === productItem, productDef.rarity || 5);
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
    'sell': 'Sell? Sell what? My kingdom isn\'t for sale!',
    'tbi': 'This organisation is important in holding our enemies in check. Its headquarter is located in the bastion in the northwall.',
    'tibia': 'Soon the whole land will be ruled by me once again!',
    'time': 'It\'s a time for heroes, that\'s for sure!',
    'noodles': 'The royal poodle Noodles is my greatest treasure!',
    'treasure': 'The royal poodle Noodles is my greatest treasure!',
    'castle': 'Rain Castle is my home.',
    'dungeon': 'Dungeons are no places for kings.',
  'help': 'Visit Quentin the monk for help.',
  'iron ore': async () => {
    try {
      const currentPlayer = getCurrentPlayerName();
      if (!currentPlayer) {
        return 'Yes.. Iron Ore! Let me know if you find one!';
      }

      const currentProducts = await getQuestItems(false);
      const ironOreCount = currentProducts['Iron Ore'] || 0;

      // Check if Al Dee fishing mission is completed - if so, Iron Ore quests shouldn't be claimable
      if (kingChatState.progressAlDeeFishing.completed) {
        return 'I appreciate your continued interest, but our business with iron ore is concluded.';
      }

      // Check if quest timer has expired and reward is ready to be claimed
      if (fishingState.ironOreQuestExpired && !fishingState.ironOreQuestCompleted) {
        // Quest timer expired - award Magnet reward now that player is talking to us
        console.log('[Quests Mod][King Tibianus] Awarding Magnet reward for expired Iron Ore quest');
        try {
          console.log('[Quests Mod][King Tibianus] Calling addQuestItem for Magnet...');
          const result = await addQuestItem('Magnet', 1);
          console.log('[Quests Mod][King Tibianus] addQuestItem result:', result);
          showQuestItemNotification('Magnet', 1);
          fishingState.ironOreQuestExpired = false;
          fishingState.ironOreQuestCompleted = true;
          console.log('[Quests Mod][King Tibianus] Magnet reward awarded successfully');

          // Refresh quest items modal if it's open
          setTimeout(() => {
            refreshQuestItemsModal();
            console.log('[Quests Mod][King Tibianus] Refreshed quest items modal');
          }, 500);

          // Save completed quest progress to Firebase
          const currentPlayer = getCurrentPlayerName();
          if (currentPlayer) {
            const currentProgress = await getKingTibianusProgress(currentPlayer);
            await saveKingTibianusProgress(currentPlayer, {
              ...currentProgress,
              ironOre: {
                active: false,
                startTime: null,
                completed: true
              }
            });
          }

          return 'Thank you for giving me an Iron Ore! Here\'s a small gift for you.';
        } catch (err) {
          console.error('[Quests Mod][King Tibianus] Error awarding Magnet:', err);
          return 'Thank you for giving me an Iron Ore! Here\'s a small gift for you.';
        }
      }

      // Check if quest is active and timer is still running
      if (fishingState.ironOreQuestActive && fishingState.ironOreQuestStartTime) {
        // Quest active but timer not expired
        return 'Come back in a minute.';
      }

      // Check inventory for Iron Ore - this takes precedence over completion status
      if (ironOreCount > 0) {
        // Check if Al Dee fishing mission is active and not completed - only take Iron Ore if mission is accepted but not finished
        if (!kingChatState.progressAlDeeFishing.accepted) {
          return 'Thats a fine looking rock you have there.';
        }
        if (kingChatState.progressAlDeeFishing.completed) {
          return 'I appreciate the rock, but I have no further use for iron ore now that our business is concluded.';
        }

        // Player has Iron Ore and mission is active - take it and start timer
        try {
          await consumeQuestItem('Iron Ore', 1);
          fishingState.ironOreQuestActive = true;
          fishingState.ironOreQuestExpired = false; // Reset expired flag when starting new quest
          fishingState.ironOreQuestStartTime = Date.now();

          // Save quest progress to Firebase
          const currentProgress = await getKingTibianusProgress(currentPlayer);
          await saveKingTibianusProgress(currentPlayer, {
            ...currentProgress,
            ironOre: {
              active: true,
              startTime: fishingState.ironOreQuestStartTime,
              completed: false
            }
          });

          return 'Thank you! I\'ll give this to my guard... come back in a minute and I\'ll have something for you.';
        } catch (err) {
          console.error('[Quests Mod][King Tibianus] Error consuming Iron Ore:', err);
          return 'Yes.. Iron Ore! Let me know if you find one!';
        }
      } else {
        // Player has no Iron Ore - check if quest was ever completed
        if (fishingState.ironOreQuestCompleted) {
          return 'Another thank you for this ore, hope you enjoy the small gift I gave you!';
        } else {
          return 'Yes.. Iron Ore! Let me know if you find one!';
        }
      }
    } catch (err) {
      console.error('[Quests Mod][King Tibianus] Error in iron ore response:', err);
      return 'Yes.. Iron Ore! Let me know if you find one!';
    }
  },
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
    'letter': KING_LETTER_MISSION.prompt,
    'scroll': KING_LETTER_MISSION.prompt,
    'al dee': 'Al Dee is a rope merchant in Rookgaard. If you have a letter from him, you should return it to him directly.',
    'bye': 'Good bye, Player!'
  };

  async function getKingTibianusResponse(message, playerName = 'Player') {
    const lowerMessage = message.toLowerCase().trim();

    // Check for exact matches first (longer phrases first)
    const sortedKeys = Object.keys(KING_TIBIANUS_RESPONSES).sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeys) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        let response = KING_TIBIANUS_RESPONSES[keyword];

        // Handle async function responses
        if (typeof response === 'function') {
          try {
            response = await response();
          } catch (err) {
            console.error('[Quests Mod][King Tibianus] Error getting dynamic response:', err);
            response = 'I greet thee, my loyal subject.';
          }
        }

        // Replace "Player" with actual player name in responses that contain it
        if (response && response.includes && response.includes('Player')) {
          response = response.replace(/Player/g, playerName);
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
      
      // If the starter coin was already spent (no token in inventory), greet normally
      (async () => {
        try {
          const hasToken = await hasSilverToken();
          if (!hasToken) {
            addMessageToConversation('King Tibianus', 'I greet thee, my loyal subject.', true);
          }
        } catch (err) {
          console.warn('[Quests Mod] Could not check token for initial greeting:', err);
          addMessageToConversation('King Tibianus', 'I greet thee, my loyal subject.', true);
        }
      })();
      
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

      function setRow2Disabled(disabled) {
        if (!row2) return;
        row2.style.pointerEvents = disabled ? 'none' : 'auto';
        row2.style.filter = disabled ? 'grayscale(1) brightness(0.6)' : 'none';
        row2.style.opacity = disabled ? '0.6' : '1';
      }

      // kingChatState is now defined globally
      // King Tibianus missions and Al Dee fishing mission
      const MISSIONS = [KING_COPPER_KEY_MISSION, KING_RED_DRAGON_MISSION, KING_LETTER_MISSION, AL_DEE_FISHING_MISSION];

      // Random responses when Tibianus doesn't understand the player's input
      const CONFUSION_RESPONSES = [
        'I do not understand what you mean, my subject.',
        'Speak clearly, for I cannot comprehend your words.',
        'Your meaning eludes me. Pray, explain yourself.',
        'I am confused by your statement. What do you wish to convey?',
        'These words make no sense to me. Clarify your intent.'
      ];

      function getRandomConfusionResponse() {
        return CONFUSION_RESPONSES[Math.floor(Math.random() * CONFUSION_RESPONSES.length)];
      }

      function getMissionById(id) {
        return MISSIONS.find(m => m.id === id);
      }

      // getMissionProgress and setMissionProgress are defined globally for Tile 79 functionality

      function areAllMissionsCompleted() {
        return MISSIONS.every(mission => getMissionProgress(mission).completed);
      }

      function currentMission() {
        // Return the first incomplete mission, or null if all are completed
        for (const mission of MISSIONS) {
          if (!getMissionProgress(mission).completed) {
            return mission;
          }
        }
        // All missions completed, no more missions available
        return null;
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
        // Handle case where all missions are completed (mission is null)
        if (!mission) {
          return {
            missionPrompt: 'All missions have been completed. Come back later for more tasks.',
            thankYou: 'All missions have been completed.',
            keyQuestion: 'All missions have been completed.',
            keyComplete: 'All missions have been completed.',
            keyScoldNoKey: 'All missions have been completed.',
            keyKeepSearching: 'All missions have been completed.',
            keyAnswerYesNo: 'All missions have been completed.',
            missionCompleted: 'All missions have been completed.',
            missionActive: 'All missions have been completed.'
          };
        }

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
          } else if (selectedMission.id === AL_DEE_FISHING_MISSION.id) {
            line2.textContent = 'Reward: Dwarven Pickaxe.';
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
          await grantStarterSilverTokenIfNeeded(progress, playerName);
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
          if (progress && progress.letter) {
            kingChatState.progressLetter = {
              accepted: !!progress.letter.accepted,
              completed: !!progress.letter.completed
            };
          }
          if (progress && progress.alDeeFishing) {
            kingChatState.progressAlDeeFishing = {
              accepted: !!progress.alDeeFishing.accepted,
              completed: !!progress.alDeeFishing.completed
            };
          }
          if (progress && progress.alDeeFishing) {
            kingChatState.progressAlDeeFishing = {
              accepted: !!progress.alDeeFishing.accepted,
              completed: !!progress.alDeeFishing.completed
            };
          }
          // Grey out missions/log until starter coin is handed in
          try {
            const tokenHeld = await hasSilverToken();
            setRow2Disabled(tokenHeld && !kingChatState.starterCoinThanked);
          } catch (err) {
            console.warn('[Quests Mod] Could not set row2 disabled state:', err);
          }
          activeMission = currentMission();
          selectedMissionId = null;
          kingStrings = buildStrings(activeMission);
          renderKingQuestUI();
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error loading progress:', error);
        }
      }

      async function startKingTibianusQuestForMission(mission) {
        try {
          const playerName = getCurrentPlayerName();
          if (!playerName) {
            console.warn('[Quests Mod][King Tibianus] Player name not available, cannot start quest');
            return;
          }
          if (!mission) {
            console.warn('[Quests Mod][King Tibianus] No mission specified');
            return;
          }
          const currentProgress = getMissionProgress(mission);
          const nextProgress = {
            accepted: true,
            completed: !!currentProgress.completed
          };
          setMissionProgress(mission, nextProgress);
          // Update the corresponding progress state
          if (mission.id === KING_COPPER_KEY_MISSION.id) {
            kingChatState.progressCopper.accepted = true;
          } else if (mission.id === KING_RED_DRAGON_MISSION.id) {
            kingChatState.progressDragon.accepted = true;
          } else if (mission.id === KING_LETTER_MISSION.id) {
            kingChatState.progressLetter.accepted = true;
          }
          activeMission = currentMission();
          selectedMissionId = null;
          kingStrings = buildStrings(activeMission);
          await saveKingTibianusProgress(playerName, {
            copper: kingChatState.progressCopper,
            dragon: kingChatState.progressDragon,
            letter: kingChatState.progressLetter,
            alDeeFishing: kingChatState.progressAlDeeFishing
          });

          // Add map to inventory when copper key mission is accepted
          if (mission.id === KING_COPPER_KEY_MISSION.id) {
            try {
              await addQuestItem(MAP_COLOUR_CONFIG.productName, 1);
              showMapReceivedToast();
              console.log('[Quests Mod][King Tibianus] Awarded Map (Colour) for copper key mission');
            } catch (err) {
              console.error('[Quests Mod][King Tibianus] Error awarding Map (Colour):', err);
            }
          }

          // Add Obsidian Knife to inventory when red dragon mission is accepted
          if (mission.id === KING_RED_DRAGON_MISSION.id) {
            try {
              await addQuestItem('Obsidian Knife', 1);
              showObsidianKnifeReceivedToast();
              console.log('[Quests Mod][King Tibianus] Awarded Obsidian Knife for red dragon mission');
            } catch (err) {
              console.error('[Quests Mod][King Tibianus] Error awarding Obsidian Knife:', err);
            }
          }

          // Exchange Letter from Al Dee for Stamped Letter when letter mission is accepted
          if (mission.id === KING_LETTER_MISSION.id) {
            try {
              // Get current quest items
              const currentProducts = await getQuestItems(false);
              console.log('[Quests Mod][Letter Exchange] Current products:', currentProducts);
              const currentLetterCount = currentProducts['Letter from Al Dee'] || 0;
              console.log('[Quests Mod][Letter Exchange] Letter count:', currentLetterCount);

              // Remove one letter (if player has any)
              if (currentLetterCount > 0) {
                const updatedProducts = {
                  ...currentProducts,
                  'Letter from Al Dee': Math.max(0, currentLetterCount - 1),
                  'Stamped Letter': (currentProducts['Stamped Letter'] || 0) + 1
                };
                console.log('[Quests Mod][Letter Exchange] Updated products:', updatedProducts);

                // Save the updated products
                const encrypted = await encryptQuestItems(updatedProducts, playerName);
                const hashedPlayer = await hashUsername(playerName);

                await firebaseRequest(
                  `${getQuestItemsApiUrl()}/${hashedPlayer}`,
                  'PUT',
                  { encrypted },
                  'exchange Letter from Al Dee for Stamped Letter'
                );

                // Update cache
                cachedQuestItems = updatedProducts;

                showStampedLetterReceivedToast();
                console.log('[Quests Mod][King Tibianus] Exchanged Letter from Al Dee for Stamped Letter');

                // Check if player is in sewers and enable Tile 79 immediately
                setTimeout(() => {
                  if (shouldEnableTile79RightClick()) {
                    updateTile79RightClickState();
                    console.log('[Quests Mod][King Tibianus] Tile 79 enabled immediately after letter exchange (player in sewers)');
                  }
                }, 500); // Small delay to ensure UI updates
              } else {
                console.warn('[Quests Mod][King Tibianus] Player has no Letter from Al Dee to exchange');
              }
            } catch (err) {
              console.error('[Quests Mod][King Tibianus] Error exchanging letter:', err);
            }
          }

          renderKingQuestUI();
        } catch (error) {
          console.error('[Quests Mod][King Tibianus] Error starting quest:', error);
        }
      }

      async function completeKingTibianusQuest() {
        try {
          const playerName = getCurrentPlayerName();
          if (!playerName) return;
          if (!activeMission) {
            console.warn('[Quests Mod][King Tibianus] No active mission to complete');
            return;
          }
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
            dragon: kingChatState.progressDragon,
            letter: kingChatState.progressLetter,
            alDeeFishing: kingChatState.progressAlDeeFishing
          });
          if (shouldAwardDragonClaw) {
            try {
              await addQuestItem('Dragon Claw', 1);
              showDragonClawReceivedToast();
              console.log('[Quests Mod][King Tibianus] Awarded Dragon Claw for dragon mission completion');
            } catch (err) {
              console.error('[Quests Mod][King Tibianus] Error awarding Dragon Claw:', err);
            }
          }
          renderKingQuestUI();
          console.log('[Quests Mod][King Tibianus] Quest marked as completed');

          // Update rank display after quest completion
          setTimeout(() => updateArenaRankDisplay(), 1000);
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
          return scales >= 30 && leathers >= 30;
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

      // Helper function to check if text is a valid hail phrase (case-insensitive)
      function isValidHailPhrase(text) {
        const trimmed = text.trim().toLowerCase();
        return trimmed === 'hail' || trimmed === 'hail king' || trimmed === 'hail the king';
      }

      async function maybeHandleStarterCoin(lowerText) {
        if (kingChatState.starterCoinThanked) {
          return null;
        }
        if (!isValidHailPhrase(lowerText)) {
          return null;
        }
        let hasToken = await hasSilverToken();
        if (!hasToken) {
          // Edge case: user sent hail before starter token grant completed; grant now if eligible
          try {
            const playerName = getCurrentPlayerName();
            const progress = await getKingTibianusProgress(playerName);
            await grantStarterSilverTokenIfNeeded(progress, playerName);
            hasToken = await hasSilverToken();
          } catch (err) {
            console.warn('[Quests Mod] Could not grant starter token during hail:', err);
          }
        }
        if (!hasToken) {
          return null;
        }
        const consumed = await consumeQuestItem(SILVER_TOKEN_CONFIG.productName, 1);
        if (consumed) {
          kingChatState.starterCoinThanked = true;
          setRow2Disabled(false);
          return 'I thank thee for the coin.';
        }
        return null;
      }

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
        
        // If the king has not received the starter coin yet, only accept valid hail phrases
        const tokenHeld = await hasSilverToken();
        if (tokenHeld && !kingChatState.starterCoinThanked) {
          if (!isValidHailPhrase(lowerText)) {
            // Do not respond; awaiting correct hail to hand over coin
            textarea.value = '';
            textarea.style.height = '27px';
            return;
          }
        }

        // Refresh mission context (in case first mission just completed)
        activeMission = currentMission();
        kingStrings = buildStrings(activeMission);
        const currentProgress = getMissionProgress(activeMission);

        const mentionsKey = lowerText.includes('key') || lowerText.includes('copper key');
        const mentionsDragon = lowerText.includes('dragon') || lowerText.includes('scale') || lowerText.includes('leather');
        const mentionsLetter = lowerText.includes('letter') || lowerText.includes('scroll');

        // Determine target mission based on what player mentioned
        let targetMission = activeMission;
        if (mentionsLetter && !areAllMissionsCompleted()) {
          targetMission = MISSIONS.find(m => m.id === KING_LETTER_MISSION.id) || activeMission;
        } else if (mentionsKey && !areAllMissionsCompleted()) {
          targetMission = MISSIONS.find(m => m.id === KING_COPPER_KEY_MISSION.id) || activeMission;
        } else if (mentionsDragon && !areAllMissionsCompleted()) {
          targetMission = MISSIONS.find(m => m.id === KING_RED_DRAGON_MISSION.id) || activeMission;
        }

        // Use target mission's strings and progress for responses
        const targetStrings = buildStrings(targetMission);
        const targetProgress = getMissionProgress(targetMission);

        // Handle pending key confirmation (yes/no after "Have you found my key?")
        if (kingChatState.awaitingKeyConfirm && currentProgress.accepted && !currentProgress.completed && activeMission) {
          if (lowerText.includes('yes')) {
            let hasItems = false;
            if (activeMission.id === KING_COPPER_KEY_MISSION.id) {
              hasItems = await hasCopperKeyInInventory();
            } else if (activeMission.id === KING_RED_DRAGON_MISSION.id) {
              hasItems = await hasRedDragonMaterials();
            } else if (activeMission.id === KING_LETTER_MISSION.id) {
              // For letter mission, check if letter has been delivered to Al Dee
              // TODO: Implement proper letter delivery tracking
              hasItems = false; // Placeholder - letter delivery not yet implemented
            } else {
              hasItems = false;
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
        if (kingChatState.missionOffered && kingChatState.offeredMission && lowerText.includes('yes')) {
          const offeredProgress = getMissionProgress(kingChatState.offeredMission);
          if (!offeredProgress.accepted && !offeredProgress.completed) {
            kingChatState.missionOffered = false;
            const offeredMissionToStart = kingChatState.offeredMission;
            const offeredStrings = buildStrings(offeredMissionToStart);
            queueKingReply(offeredStrings.thankYou, { onDone: async () => {
              // Start the offered mission
              await startKingTibianusQuestForMission(offeredMissionToStart);
              kingChatState.offeredMission = null;
            } });
            latestMessage = null;
            pendingResponseTimeout = null;
            textarea.value = '';
            textarea.style.height = '27px';
            return;
          }
        }

        let kingResponse = '';
        
        const starterCoinResponse = await maybeHandleStarterCoin(lowerText);

        if (starterCoinResponse) {
          kingResponse = starterCoinResponse;
          kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
          showCoinReceivedToast();
        } else if (areAllMissionsCompleted() && (mentionsKey || mentionsDragon || lowerText.includes('mission') || lowerText.includes('quest'))) {
          // All missions completed, tell player to come back later
          kingResponse = 'All missions have been completed. Come back later for more tasks.';
          kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
        } else if (mentionsKey || mentionsDragon || mentionsLetter) {
          if (targetProgress.completed) {
            kingResponse = targetStrings.missionCompleted;
            kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
            kingChatState.offeredMission = null;
          } else if (targetProgress.accepted) {
            kingChatState.awaitingKeyConfirm = true;
            kingChatState.offeredMission = targetMission;
            queueKingReply(targetStrings.keyQuestion);
            textarea.value = '';
            textarea.style.height = '27px';
            return;
          } else {
            kingResponse = targetStrings.missionPrompt;
            kingChatState.missionOffered = true;
            kingChatState.offeredMission = targetMission;
          }
        } else if (lowerText.includes('mission') || lowerText.includes('quest')) {
          if (areAllMissionsCompleted()) {
            // All missions completed, tell player to come back later
            kingResponse = 'All missions have been completed. Come back later for more tasks.';
            kingChatState.missionOffered = false;
            kingChatState.offeredMission = null;
          } else if (currentProgress.completed) {
            kingResponse = kingStrings.missionCompleted;
            kingChatState.missionOffered = false;
            kingChatState.offeredMission = null;
          } else if (currentProgress.accepted) {
            kingResponse = kingStrings.missionActive;
            kingChatState.missionOffered = false;
            kingChatState.offeredMission = null;
          } else {
            kingResponse = kingStrings.missionPrompt;
            kingChatState.missionOffered = true;
            kingChatState.offeredMission = activeMission;
          }
        } else if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText.includes('greetings') || lowerText.includes('good day')) {
          kingResponse = 'I greet thee, my loyal subject.';
          kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
        } else {
          // Check transcript responses before falling back to confusion
          const transcriptResponse = await getKingTibianusResponse(text, playerName);
          if (transcriptResponse && transcriptResponse !== 'I greet thee, my loyal subject.') {
            // If we got a meaningful transcript response, use it
            kingResponse = transcriptResponse;
          } else {
            // Fall back to confusion responses for truly unrecognized input
            kingResponse = getRandomConfusionResponse();
          }
          kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
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
      loadKingTibianusProgress().then(() => {
        renderKingQuestUI();
        updateGuildCoinDisplay();
      });
      
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

  // Al Dee Modal (similar to King Tibianus modal)
  function showAlDeeModal() {
    // Clear any pending modal timeouts
    clearTimeoutOrInterval(modalTimeout);
    clearTimeoutOrInterval(dialogTimeout);

    // Close any existing modals first
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }

    modalTimeout = setTimeout(() => {
      const contentDiv = document.createElement('div');
      applyModalContentStyles(contentDiv, KING_TIBI_MODAL_WIDTH, KING_TIBI_MODAL_HEIGHT);

      const alDeeIconUrl = getQuestItemsAssetUrl('Al_Dee.gif');

      // Create modal content with greeting message
      const modalContent = document.createElement('div');
      modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 0; height: 100%;';

      // Row 1: Top row with image and message
      const row1 = document.createElement('div');
      row1.className = 'grid gap-3 sm:grid-cols-[min-content_1fr]';
      row1.style.cssText = 'align-self: center;';

      const imageContainer = document.createElement('div');
      imageContainer.className = 'container-slot surface-darker grid place-items-center overflow-hidden';
      imageContainer.style.cssText = 'width: 110px; min-width: 110px; height: 100%; padding: 0; align-self: stretch;';

      const alDeeImgWrapper = document.createElement('div');
      alDeeImgWrapper.style.cssText = 'width: 110px; height: 100%; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box;';

      const alDeeImg = document.createElement('img');
      alDeeImg.src = alDeeIconUrl;
      alDeeImg.alt = 'Al Dee';
      alDeeImg.className = 'pixelated';
      alDeeImg.style.cssText = 'width: 96px; height: 64px; object-fit: contain; image-rendering: pixelated;';
      alDeeImgWrapper.appendChild(alDeeImg);
      imageContainer.appendChild(alDeeImgWrapper);

      const messageContainer = document.createElement('div');
      messageContainer.className = 'tooltip-prose pixel-font-16 frame-pressed-1 surface-dark flex w-full flex-col gap-1 p-2 text-whiteRegular';
      messageContainer.style.width = '290px';
      messageContainer.style.height = '90px';
      messageContainer.style.maxHeight = '90px';
      messageContainer.style.overflowY = 'auto';
      messageContainer.id = 'al-dee-messages';

      // Confusion responses for Al Dee (merchant style)
      const AL_DEE_CONFUSION_RESPONSES = [
        'I\'m just a rope merchant, not a mind reader. What do you want?',
        'These words mean nothing to me. Speak of ropes or tools!',
        'I deal in ropes and equipment, not riddles. Be clearer!',
        'Your meaning escapes me. Perhaps you need some rope to tie your thoughts together?',
        'I don\'t understand that gibberish. Ask about my wares instead!'
      ];

      function getRandomAlDeeConfusionResponse() {
        return AL_DEE_CONFUSION_RESPONSES[Math.floor(Math.random() * AL_DEE_CONFUSION_RESPONSES.length)];
      }

      // Al Dee mission chat state
      const alDeeChatState = {
        offeringFishingMission: false,
        awaitingAxeConfirm: false
      };

      // Function to add message to conversation
      function addMessageToConversation(sender, text, isAlDee = false) {
        const messageP = document.createElement('p');

        if (isAlDee) {
          // Al Dee messages use the same style as initial greeting
          messageP.className = 'inline text-monster';
          messageP.style.color = 'rgb(135, 206, 250)';
          messageP.textContent = sender + ': ' + text;
        } else {
          // Player messages - same font style as Al Dee, lavender/purple color
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

      // Add welcome message
      const playerName = getCurrentPlayerName() || 'Player';
      const welcomeMessage = 'Hello, hello, ' + playerName + '! Please come in, look, and buy! I\'m a specialist for all sorts of tools. Just ask me for a trade to see my offers!';
      addMessageToConversation('Al Dee', welcomeMessage, true);

      row1.appendChild(imageContainer);
      row1.appendChild(messageContainer);

      // Row 2: Shop interface
      const row2 = document.createElement('div');
      row2.style.cssText = 'display: grid; grid-template-rows: repeat(auto-fill, 60px); align-items: start; gap: 8px; padding: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; flex: 1 1 0; min-height: 0; overflow-y: auto;';

      // Function to create a shop item
      function createShopItem(iconName, itemName, price, displayName, itemId) {
        const shopItem = document.createElement('div');
        shopItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 2px; height: 60px; box-sizing: border-box;';

        // Item icon container
        const itemIconContainer = document.createElement('div');
        itemIconContainer.className = 'container-slot surface-darker grid place-items-center overflow-hidden';
        itemIconContainer.style.cssText = 'width: 34px; height: 34px; flex-shrink: 0;';

        const itemIcon = document.createElement('img');
        itemIcon.src = getQuestItemsAssetUrl(iconName);
        itemIcon.alt = itemName;
        itemIcon.className = 'pixelated';
        itemIcon.style.cssText = 'width: 32px; height: 32px; object-fit: contain; image-rendering: pixelated;';
        itemIconContainer.appendChild(itemIcon);

        // Item name and price container
        const infoContainer = document.createElement('div');
        infoContainer.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-width: 0;';

        const itemNameDisplay = document.createElement('div');
        itemNameDisplay.className = 'pixel-font-12 text-whiteRegular';
        itemNameDisplay.textContent = displayName;
        itemNameDisplay.style.cssText = 'font-weight: bold; margin-bottom: 2px;';

        const priceDisplay = document.createElement('div');
        priceDisplay.className = 'pixel-font-12 text-whiteRegular';
        priceDisplay.textContent = price + ' guild coins';
        priceDisplay.style.cssText = 'display: flex; align-items: center; gap: 2px;';

        // Guild coin icon for price
        const coinIcon = document.createElement('img');
        coinIcon.src = cachedExtensionBaseUrl ? constructUrl(cachedExtensionBaseUrl, '/assets/guild/Guild_Coin.PNG') : '/assets/guild/Guild_Coin.PNG';
        coinIcon.alt = 'Guild Coin';
        coinIcon.className = 'pixelated';
        coinIcon.style.cssText = 'width: 12px; height: 12px; object-fit: contain; image-rendering: pixelated;';
        priceDisplay.insertBefore(coinIcon, priceDisplay.firstChild);

        infoContainer.appendChild(itemNameDisplay);
        infoContainer.appendChild(priceDisplay);

        // Buy button
        const buyButton = document.createElement('button');
        buyButton.type = 'button';
        buyButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pixel-font-12';
        buyButton.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; height: 24px; font-size: 12px; flex-shrink: 0;';

        // Check if item has been purchased
        const playerName = getCurrentPlayerName();
        let isPurchased = false;
        if (playerName) {
          getAlDeeShopPurchases(playerName).then(purchases => {
            isPurchased = purchases[itemId] === true;
            updateButtonState();
          }).catch(() => {
            updateButtonState();
          });
        }

        function updateButtonState() {
          if (isPurchased) {
            buyButton.textContent = 'Bought';
            buyButton.disabled = true;
            buyButton.style.filter = 'grayscale(100%)';
            buyButton.style.opacity = '0.6';
          } else {
            buyButton.textContent = 'Buy';
            buyButton.disabled = false;
            buyButton.style.filter = '';
            buyButton.style.opacity = '';
          }
        }

        // Initialize button state
        updateButtonState();

        // Buy button click handler
        buyButton.addEventListener('click', async () => {
          try {
            // Check if player has enough guild coins
            const coinsGetter = globalThis.getGuildCoins ||
              (globalThis.Guilds && globalThis.Guilds.getGuildCoins) ||
              (globalThis.BestiaryModAPI && globalThis.BestiaryModAPI.guilds && globalThis.BestiaryModAPI.guilds.getGuildCoins) ||
              (typeof getGuildCoins === 'function' ? getGuildCoins : null);

            if (!coinsGetter) {
              addMessageToConversation('Al Dee', 'Sorry, I cannot check your guild coins right now.', true);
              return;
            }

            const currentCoins = await coinsGetter();
            if (currentCoins < price) {
              addMessageToConversation('Al Dee', `You don't have enough guild coins! You need ${price} guild coins to buy ${displayName.toLowerCase()}.`, true);
              return;
            }

            // Deduct coins and give item
            const coinsDeduct = globalThis.deductGuildCoins ||
              (globalThis.Guilds && globalThis.Guilds.deductGuildCoins) ||
              (globalThis.BestiaryModAPI && globalThis.BestiaryModAPI.guilds && globalThis.BestiaryModAPI.guilds.deductGuildCoins) ||
              (typeof deductGuildCoins === 'function' ? deductGuildCoins : null);

            if (coinsDeduct) {
              await coinsDeduct(price); // Deduct coins

              // Add item to quest items inventory
              try {
                await addQuestItem(displayName, 1);
                console.log('[Al Dee Shop] Added', displayName, 'to quest items inventory');
              } catch (inventoryError) {
                console.error('[Al Dee Shop] Error adding item to inventory:', inventoryError);
              }

              // Mark as purchased in Firebase
              await saveAlDeeShopPurchase(playerName, itemId, true);

              // Update button state
              isPurchased = true;
              updateButtonState();

              addMessageToConversation('Al Dee', `Thank you for your business! Here's your ${displayName.toLowerCase()}.`, true);

              // Update guild coin display
              updateGuildCoinDisplay();

              // Refresh quest items modal if it's open
              refreshQuestItemsModal();
            } else {
              addMessageToConversation('Al Dee', 'Sorry, there seems to be an issue with deducting guild coins.', true);
            }
          } catch (error) {
            console.error('[Al Dee Shop] Error processing purchase:', error);
            addMessageToConversation('Al Dee', 'Sorry, something went wrong with the purchase.', true);
          }
        });

        // Assemble the shop item
        shopItem.appendChild(itemIconContainer);
        shopItem.appendChild(infoContainer);
        shopItem.appendChild(buyButton);

        return shopItem;
      }

      // Add shop items to the grid
      row2.appendChild(createShopItem('Fishing_Rod.gif', 'Fishing Rod', 100, 'Fishing Rod', 'fishing_rod'));

      // Row 3: Chat input area (matches King Tibianus exactly)
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
      textarea.placeholder = 'Type your message to Al Dee...';
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

      // Handle Enter key and focus/blur events like King Tibianus
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessageToAlDee();
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
      // Handle Enter key
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessageToAlDee();
        }
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

      async function sendMessageToAlDee() {
        const text = textarea.value.trim();
        if (!text || text.length === 0) {
          return;
        }

        // Get player name
        const playerName = getCurrentPlayerName() || 'Player';
        const lowerText = text.toLowerCase();

        // Add player message to conversation
        addMessageToConversation(playerName, text, false);

        // Clear input
        textarea.value = '';

        // Check for stamped letter delivery mission
        let missionCompleted = false;
        if (lowerText.includes('letter') || lowerText.includes('deliver') || lowerText.includes('king') || lowerText.includes('tibianus')) {
          try {
            const currentProducts = await getQuestItems();
            const hasStampedLetter = (currentProducts['Stamped Letter'] || 0) > 0;

            if (hasStampedLetter) {
              // Remove the stamped letter from inventory
              await consumeQuestItem('Stamped Letter', 1);
              console.log('[Quests Mod][Al Dee] Stamped Letter delivered, consuming from inventory');

              // Show delivery toast
              showStampedLetterDeliveredToast();

              // Award guild coins
              const coinsAdder = globalThis.addGuildCoins ||
                (globalThis.Guilds && globalThis.Guilds.addGuildCoins) ||
                (globalThis.BestiaryModAPI && globalThis.BestiaryModAPI.guilds && globalThis.BestiaryModAPI.guilds.addGuildCoins) ||
                (typeof addGuildCoins === 'function' ? addGuildCoins : null);

              if (coinsAdder) {
                await coinsAdder(50);
                console.log('[Quests Mod][Al Dee] Awarded 50 guild coins for letter delivery');
              } else {
                console.warn('[Quests Mod][Al Dee] addGuildCoins not available, skipping guild coin reward');
              }

              // Mark the letter mission as completed
              setMissionProgress(KING_LETTER_MISSION, { accepted: true, completed: true });
              console.log('[Quests Mod][Al Dee] Letter delivery mission completed');

              // Save progress to Firebase
              const playerName = getCurrentPlayerName();
              if (playerName) {
                await saveKingTibianusProgress(playerName, {
                  copper: kingChatState.progressCopper,
                  dragon: kingChatState.progressDragon,
                  letter: kingChatState.progressLetter
                });
                console.log('[Quests Mod][Al Dee] Letter mission progress saved to Firebase');
              }

              // Update guild coin display
              updateGuildCoinDisplay();

              // Mark mission as completed
              missionCompleted = true;

              // Queue special mission completion response
              setTimeout(() => {
                addMessageToConversation('Al Dee', 'Ah, finally! The king\'s stamped letter. Thank you for delivering it, ' + playerName + '. Here\'s 50 guild coins as a reward for your service.', true);
              }, 1000);

              return; // Exit early, don't show regular transcript response
            }
          } catch (error) {
            console.error('[Quests Mod][Al Dee] Error checking/delivering stamped letter:', error);
          }
        }

        // Check for fishing mission keywords and Small Axe return
        if (lowerText.includes('small axe') || lowerText.includes('axe') ||
            (lowerText.includes('yes') && alDeeChatState.awaitingAxeConfirm)) {
          try {
            const currentProducts = await getQuestItems();
            const hasSmallAxe = (currentProducts['Small Axe'] || 0) > 0;

            if (hasSmallAxe) {
              // Remove the Small Axe from inventory
              await consumeQuestItem('Small Axe', 1);
              showSmallAxeReturnedToast();
              console.log('[Quests Mod][Al Dee] Small Axe returned, consuming from inventory');

              // Award Dwarven Pickaxe
              try {
                await addQuestItem('Dwarven Pickaxe', 1);
                showQuestItemNotification('Dwarven Pickaxe', 1);
                console.log('[Quests Mod][Al Dee] Awarded Dwarven Pickaxe for axe return');
              } catch (error) {
                console.error('[Quests Mod][Al Dee] Error awarding Dwarven Pickaxe:', error);
              }

              // Mark mission as completed
              setMissionProgress(AL_DEE_FISHING_MISSION, { accepted: true, completed: true });
              console.log('[Quests Mod][Al Dee] Fishing mission completed');

              // Save progress to Firebase
              if (playerName) {
                await saveKingTibianusProgress(playerName, {
                  copper: kingChatState.progressCopper,
                  dragon: kingChatState.progressDragon,
                  letter: kingChatState.progressLetter,
                  alDeeFishing: kingChatState.progressAlDeeFishing
                });
                console.log('[Quests Mod][Al Dee] Fishing mission progress saved to Firebase');
              }

              // Update guild coin display
              updateGuildCoinDisplay();

              // Queue special mission completion response
              setTimeout(() => {
                addMessageToConversation('Al Dee', AL_DEE_FISHING_MISSION.complete.replace('Player', playerName), true);
              }, 1000);

              return; // Exit early, don't show regular transcript response
            } else if (alDeeChatState.awaitingAxeConfirm) {
              // Player said yes but has no Small Axe
              setTimeout(() => {
                addMessageToConversation('Al Dee', AL_DEE_FISHING_MISSION.missingItem, true);
              }, 1000);
              alDeeChatState.awaitingAxeConfirm = false;
              return;
            }
          } catch (error) {
            console.error('[Quests Mod][Al Dee] Error handling fishing mission:', error);
          }
        }

        // Check for mission acceptance
        if (lowerText.includes('yes') && alDeeChatState.offeringFishingMission) {
          // Start the fishing mission
          setMissionProgress(AL_DEE_FISHING_MISSION, { accepted: true, completed: false });
          setTimeout(() => {
            addMessageToConversation('Al Dee', AL_DEE_FISHING_MISSION.accept, true);
          }, 1000);
          alDeeChatState.offeringFishingMission = false;

          // Save progress
          if (playerName) {
            await saveKingTibianusProgress(playerName, {
              copper: kingChatState.progressCopper,
              dragon: kingChatState.progressDragon,
              letter: kingChatState.progressLetter,
              alDeeFishing: kingChatState.progressAlDeeFishing
            });
            console.log('[Quests Mod][Al Dee] Fishing mission accepted, progress saved to Firebase');
          }

          return;
        }

        // Check for mission offer trigger
        if (lowerText.includes('mission') || lowerText.includes('missions') ||
            lowerText.includes('task') || lowerText.includes('quest') || lowerText.includes('help')) {
          // Al Dee's missions only (can be expanded in the future)
          const AL_DEE_MISSIONS = [AL_DEE_FISHING_MISSION];

          function currentAlDeeMission() {
            // Return the first incomplete mission, or null if all are completed
            for (const mission of AL_DEE_MISSIONS) {
              if (!getMissionProgress(mission).completed) {
                return mission;
              }
            }
            // All missions completed, no more missions available
            return null;
          }

          function buildAlDeeStrings(mission) {
            // Handle case where all missions are completed (mission is null)
            if (!mission) {
              return {
                missionPrompt: 'All my tasks have been completed. Come back later for more tasks!',
                thankYou: 'All my tasks have been completed.',
                keyQuestion: 'All my tasks have been completed.',
                keyComplete: 'All my tasks have been completed.',
                keyScoldNoKey: 'All my tasks have been completed.',
                keyKeepSearching: 'All my tasks have been completed.',
                keyAnswerYesNo: 'All my tasks have been completed.',
                missionCompleted: 'All my tasks have been completed.',
                missionActive: 'All my tasks have been completed.'
              };
            }

            return {
              missionPrompt: mission.prompt,
              thankYou: mission.accept,
              keyQuestion: mission.askForItem || 'Have you found what I asked for?',
              keyComplete: mission.complete,
              keyScoldNoKey: mission.missingItem || 'You claim yes but lack what I asked for.',
              keyKeepSearching: mission.keepSearching,
              keyAnswerYesNo: mission.answerYesNo,
              missionCompleted: mission.alreadyCompleted,
              missionActive: mission.alreadyActive
            };
          }

          const activeMission = currentAlDeeMission();
          const strings = buildAlDeeStrings(activeMission);

          if (!activeMission) {
            // All Al Dee missions completed
            setTimeout(() => {
              addMessageToConversation('Al Dee', strings.missionPrompt, true);
            }, 1000);
          } else {
            const missionProgress = getMissionProgress(activeMission);

            if (missionProgress.accepted) {
              setTimeout(() => {
                addMessageToConversation('Al Dee', strings.missionActive, true);
              }, 1000);
            } else {
              // Offer the mission with a 1 second delay
              setTimeout(() => {
                addMessageToConversation('Al Dee', strings.missionPrompt, true);
              }, 1000);
              alDeeChatState.offeringFishingMission = true;
            }
          }
          return;
        }

        // Get transcript response (handles all standard Al Dee dialogue)
        let alDeeResponse = getAlDeeResponse(text, playerName);

        // Only use confusion response for messages that are truly nonsensical
        // The default greeting response should be preserved for unrecognized but reasonable messages
        // Confusion should only be used for messages that don't make any sense in context

        // Check if this is a bye message to close the modal
        const isBye = lowerText.includes('bye');
        if (isBye) {
          // Close modal after a short delay
          setTimeout(() => {
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
          }, 2000);
        }

        // Queue Al Dee's response with a delay
        setTimeout(() => {
          addMessageToConversation('Al Dee', alDeeResponse, true);
        }, 1000);
      }

      sendButton.addEventListener('click', sendMessageToAlDee);

      inputRow.appendChild(textarea);
      inputRow.appendChild(sendButton);
      row3.appendChild(inputRow);

      modalContent.appendChild(row1);
      modalContent.appendChild(row2);
      modalContent.appendChild(row3);

      // Footer with guild coins display and close button (same structure as King Tibianus)
      let customFooter = null;
      let customSeparator = null;
      let guildCoinAmountSpan = null;

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
          console.warn('[Quests Mod][Al Dee] Could not remove default modal footer:', error);
        }
      }

      const footer = document.createElement('div');
      footer.className = 'flex justify-end gap-2 items-center';
      footer.style.cssText = 'width: 100%;';
      customFooter = footer;

      // Guild coin display
      const guildCoinIconUrl = cachedExtensionBaseUrl ? constructUrl(cachedExtensionBaseUrl, '/assets/guild/Guild_Coin.PNG') : '/assets/guild/Guild_Coin.PNG';
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

      const footerContainer = document.createElement('div');
      footerContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0; width: 100%;';

      const separator = document.createElement('div');
      separator.className = 'separator my-2.5';
      separator.setAttribute('role', 'none');
      customSeparator = separator;
      footerContainer.appendChild(separator);

      footerContainer.appendChild(footer);
      modalContent.appendChild(footerContainer);

      // Function to update guild coin display
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
            console.error('[Quests Mod][Al Dee] getGuildCoins not available; cannot show guild coins.');
            guildCoinAmountSpan.textContent = '?';
            return;
          }
          const amount = await coinsGetter();
          guildCoinAmountSpan.textContent = Number.isFinite(amount) ? amount : '?';
        } catch (error) {
          console.error('[Quests Mod][Al Dee] Error updating guild coins display:', error);
          guildCoinAmountSpan.textContent = '?';
        }
      }

      contentDiv.appendChild(modalContent);

      // Update guild coin display
      updateGuildCoinDisplay();

      const modal = api.ui.components.createModal({
        title: 'Al Dee',
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
        // Only log on first successful find to reduce spam
        if (!window.questsModLoggedContainer) {
          console.log(`[Quests Mod] Found quest log container with selector: ${selector}`);
          window.questsModLoggedContainer = true;
        }
        return container;
      }
    }
    
    return null;
  }

  function findQuestLogFooter() {
    const selectors = [
      '.widget-bottom .flex.justify-end.gap-2',
      '.flex.justify-end.gap-2'
    ];

    for (const selector of selectors) {
      const footer = document.querySelector(selector);
      if (footer && footer.closest('div[role="dialog"]')) {
        return footer;
      }
    }

    return null;
  }

  function getKingTabElement() {
    const kingTab = document.getElementById(KING_TIBIANUS_TAB_ID);
    return kingTab && isInDOM(kingTab) ? kingTab : null;
  }

  function updateMissionsButtonState() {
    if (!missionsToggleButton) return;
    missionsToggleButton.setAttribute('aria-pressed', kingModeActive ? 'true' : 'false');
    missionsToggleButton.textContent = kingModeActive ? 'Back' : 'Missions';
  }

  function showAllQuestLogWidgets(questLogContainer, kingTab) {
    if (!questLogContainer) return;

    const children = Array.from(questLogContainer.children);
    children.forEach(child => {
      if (child === kingTab) {
        if (!child.dataset.questsOriginalDisplay) {
          child.dataset.questsOriginalDisplay = child.style.display || '';
        }
        child.style.display = 'none';
      } else {
        if (child.dataset && child.dataset.questsOriginalDisplay !== undefined) {
          child.style.display = child.dataset.questsOriginalDisplay;
        } else {
          child.style.display = '';
        }
      }

      if (child?.dataset?.questsOriginalDisplay !== undefined) {
        delete child.dataset.questsOriginalDisplay;
      }
    });
  }

  function hideQuestLogWidgetsExceptKing(questLogContainer, kingTab) {
    if (!questLogContainer || !kingTab) return;

    const children = Array.from(questLogContainer.children);
    children.forEach(child => {
      if (!child.dataset) return;

      if (!child.dataset.questsOriginalDisplay) {
        child.dataset.questsOriginalDisplay = child.style.display || '';
      }
      child.style.display = child === kingTab ? '' : 'none';
    });
  }

  function resetQuestLogView(questLogContainer = findQuestLogContainer()) {
    const kingTab = getKingTabElement();
    if (!questLogContainer) {
      kingModeActive = false;
      updateMissionsButtonState();
      if (kingTab) {
        kingTab.style.display = 'none';
      }
      return;
    }

    showAllQuestLogWidgets(questLogContainer, kingTab);
    kingModeActive = false;
    if (kingTab) {
      kingTab.style.display = 'none';
    }
    updateMissionsButtonState();
  }

  function toggleKingQuestLogView() {
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer) return;

    if (!getKingTabElement()) {
      createKingTibianusTab();
    }
    const kingTab = getKingTabElement();
    if (!kingTab) return;

    verifyKingTibianusTabPosition();

    if (!kingModeActive) {
      hideQuestLogWidgetsExceptKing(questLogContainer, kingTab);
      kingModeActive = true;
    } else {
      resetQuestLogView(questLogContainer);
    }
    updateMissionsButtonState();
  }

  function ensureMissionsFooterButton() {
    const footer = findQuestLogFooter();
    if (!footer) return;

    let missionsButton = document.getElementById(KING_MISSIONS_BUTTON_ID);
    if (!missionsButton) {
      missionsButton = document.createElement('button');
      missionsButton.id = KING_MISSIONS_BUTTON_ID;
      missionsButton.type = 'button';
      missionsButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      missionsButton.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
      missionsButton.textContent = 'Missions';
      missionsButton.addEventListener('click', toggleKingQuestLogView);

      const closeButton = Array.from(footer.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Close');
      if (closeButton) {
        footer.insertBefore(missionsButton, closeButton);
      } else {
        footer.appendChild(missionsButton);
      }
    }

    missionsToggleButton = missionsButton;
    updateMissionsButtonState();
  }

  function handleQuestLogReady(questLogContainer) {
    if (!questLogContainer) return;

    ensureMissionsFooterButton();
    const kingTab = getKingTabElement();

    if (lastQuestLogContainer !== questLogContainer) {
      lastQuestLogContainer = questLogContainer;
      kingModeActive = false;
      if (kingTab) {
        kingTab.style.display = 'none';
      }
      showAllQuestLogWidgets(questLogContainer, kingTab);
      updateMissionsButtonState();
    }
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
    
    // Container found, proceeding with creation

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
          <div class="mt-1 text-center">
            <p id="king-tibianus-rank-display" class="text-sm pixel-font-16 italic" style="color: rgb(150, 150, 150);">Rank: Scout of the Arena</p>
          </div>
        </div>
      </div>
    `;
    tabElement.dataset.questsOriginalDisplay = tabElement.style.display || '';
    tabElement.style.display = 'none';

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
      // Tab placed at top
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
          // Repositioned tab on retry
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

    // Initialize rank display
    updateArenaRankDisplay();

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
        // Repositioned tab to top
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
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer) {
      return false;
    }

    // Final verification - check for the exact Quest Log header structure
    const questLogHeader = document.querySelector('h2[id*="radix-"][class*="widget-top"] p[id*="radix-"]');
    if (!questLogHeader || questLogHeader.textContent !== 'Quest Log') {
      console.log('[Quests Mod] Quest Log verification failed');
      return false; // Not the actual Quest Log, abort
    }

    const existingTab = document.getElementById(KING_TIBIANUS_TAB_ID);
    if (existingTab) {
      // Tab exists, verify its position
      verifyKingTibianusTabPosition();
      handleQuestLogReady(questLogContainer);
      return false;
    }
    
    console.log('[Quests Mod] Quest Log verified');
    createKingTibianusTab();
    handleQuestLogReady(questLogContainer);
    return true;
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
            // Tab created successfully, continue monitoring for future reopenings
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

  // Helper functions for mission progress
  function getMissionProgress(mission) {
    if (!mission) return { accepted: false, completed: false };
    if (mission.id === KING_COPPER_KEY_MISSION.id) return kingChatState.progressCopper;
    if (mission.id === KING_RED_DRAGON_MISSION.id) return kingChatState.progressDragon;
    if (mission.id === KING_LETTER_MISSION.id) return kingChatState.progressLetter;
    if (mission.id === AL_DEE_FISHING_MISSION.id) return kingChatState.progressAlDeeFishing;
    return { accepted: false, completed: false };
  }

  function setMissionProgress(mission, progress) {
    if (!mission) return;
    if (mission.id === KING_COPPER_KEY_MISSION.id) kingChatState.progressCopper = progress;
    if (mission.id === KING_RED_DRAGON_MISSION.id) kingChatState.progressDragon = progress;
    if (mission.id === KING_LETTER_MISSION.id) kingChatState.progressLetter = progress;
    if (mission.id === AL_DEE_FISHING_MISSION.id) kingChatState.progressAlDeeFishing = progress;
  }

  // =======================
  // Tile 79 Right-Click System
  // =======================

  // Debug functions for quest testing and development:
  // - checkMissionState(): Check current mission state in console
  // - setMissionAccepted(missionId): Set a mission as accepted (default: king_letter_al_dee)
  // - resetQuest(missionId): Reset a quest to not accepted/not completed
  //   Available mission IDs: 'king_copper_key', 'king_red_dragon', 'king_letter_al_dee', 'al_dee_fishing_gold'
  // - resetAlDeeFishing(): Convenience function to reset Al Dee fishing mission specifically
  // - resetAllQuests(): Reset ALL quests, quest items, Al Dee shop purchases, Copper Key received status, DELETE all Firebase entries, and grant Silver Token

  // Debug function to check Firebase mission state
  window.checkMissionState = async function() {
    console.log('[Quests Mod][Dev] Checking current mission state...');
    try {
      const playerName = getCurrentPlayerName();
      console.log('[Quests Mod][Dev] Player name:', playerName);
      console.log('[Quests Mod][Dev] Local kingChatState:', kingChatState);

      if (playerName) {
        // Try to fetch from Firebase
        const progress = await getKingTibianusProgress(playerName);
        console.log('[Quests Mod][Dev] Firebase progress:', progress);
      }

      const currentProgress = getMissionProgress(KING_LETTER_MISSION);
      console.log('[Quests Mod][Dev] Current mission progress:', currentProgress);
    } catch (error) {
      console.error('[Quests Mod][Dev] Error checking mission state:', error);
    }
  };

  // Debug function to manually set mission progress (for testing)
  window.setMissionAccepted = async function(missionId = 'king_letter_al_dee') {
    console.log('[Quests Mod][Dev] Manually setting mission as accepted:', missionId);
    try {
      if (missionId === 'king_letter_al_dee') {
        setMissionProgress(KING_LETTER_MISSION, { accepted: true, completed: false });
        console.log('[Quests Mod][Dev] KING_LETTER_MISSION set to accepted locally');

        // Save to Firebase
        const playerName = getCurrentPlayerName();
        if (playerName) {
          const progress = {
            copper: kingChatState.progressCopper,
            dragon: kingChatState.progressDragon,
            letter: kingChatState.progressLetter
          };
          await saveKingTibianusProgress(playerName, progress);
          console.log('[Quests Mod][Dev] Mission progress saved to Firebase');
        }
      }
      // Force update tile 79 state
      updateTile79RightClickState();
    } catch (error) {
      console.error('[Quests Mod][Dev] Error setting mission progress:', error);
    }
  };

  // Debug function to manually test tile 79 functionality
  window.debugTile79 = function() {
    console.log('[Quests Mod][Tile 79] Manual debug check');
    console.log('[Quests Mod][Tile 79] Subscription status:', {
      boardSubscription: !!tile79BoardSubscription,
      playerSubscription: !!tile79PlayerSubscription,
      rightClickEnabled: tile79RightClickEnabled
    });
    console.log('[Quests Mod][Tile 79] Current game state:', {
      roomId: globalThis.state?.selectedMap?.selectedRoom?.id,
      roomName: globalThis.state?.utils?.ROOM_NAME?.[globalThis.state?.selectedMap?.selectedRoom?.id],
      missionProgress: getMissionProgress(KING_LETTER_MISSION),
      questItems: cachedQuestItems,
      tileElement: !!getTileElement(79)
    });
    updateTile79RightClickState();
  };

  // Debug function to reset quest progress (for testing)
  window.resetQuest = async function(missionId) {
    console.log('[Quests Mod][Dev] Resetting quest:', missionId);
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) {
        console.error('[Quests Mod][Dev] No player name found');
        return;
      }

      // Map mission IDs to their state properties
      const missionMap = {
        'king_copper_key': 'progressCopper',
        'king_red_dragon': 'progressDragon',
        'king_letter_al_dee': 'progressLetter',
        'al_dee_fishing_gold': 'progressAlDeeFishing'
      };

      const stateKey = missionMap[missionId];
      if (!stateKey) {
        console.error('[Quests Mod][Dev] Unknown mission ID. Available IDs:', Object.keys(missionMap));
        return;
      }

      // Reset local state
      kingChatState[stateKey] = { accepted: false, completed: false };
      console.log('[Quests Mod][Dev] Local state reset for', missionId);

      // Save to Firebase
      const progress = {
        copper: kingChatState.progressCopper,
        dragon: kingChatState.progressDragon,
        letter: kingChatState.progressLetter,
        alDeeFishing: kingChatState.progressAlDeeFishing
      };

      await saveKingTibianusProgress(playerName, progress);
      console.log('[Quests Mod][Dev] Quest reset saved to Firebase for', missionId);

      // Force update UI state
      updateTile79RightClickState();
      console.log('[Quests Mod][Dev] UI state updated');
    } catch (error) {
      console.error('[Quests Mod][Dev] Error resetting quest:', error);
    }
  };

  // Debug function to reset Al Dee fishing mission specifically
  window.resetAlDeeFishing = async function() {
    console.log('[Quests Mod][Dev] Resetting Al Dee fishing mission');
    await resetQuest('al_dee_fishing_gold');
  };

  // Debug function to reset ALL quests and quest items
  window.resetAllQuests = async function() {
    console.log('[Quests Mod][Dev] Resetting ALL quests and quest items');
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) {
        console.error('[Quests Mod][Dev] No player name found');
        return;
      }

      // Reset local state for all quests
      kingChatState.progressCopper = { accepted: false, completed: false };
      kingChatState.progressDragon = { accepted: false, completed: false };
      kingChatState.progressLetter = { accepted: false, completed: false };
      kingChatState.progressAlDeeFishing = { accepted: false, completed: false };
      console.log('[Quests Mod][Dev] Local quest state reset');

      // Delete quest progress from Firebase
      await deleteKingTibianusProgress(playerName);
      console.log('[Quests Mod][Dev] Quest progress deleted from Firebase');

      // Delete all quest items from Firebase
      await deleteQuestItems(playerName);
      console.log('[Quests Mod][Dev] Quest items deleted from Firebase');

      // Delete Al Dee shop purchases from Firebase
      await deleteAlDeeShopPurchases(playerName);
      console.log('[Quests Mod][Dev] Al Dee shop purchases deleted from Firebase');

      // Delete Copper Key received status from Firebase
      await deleteCopperKeyReceived(playerName);
      console.log('[Quests Mod][Dev] Copper Key received status deleted from Firebase');

      // Delete Letter from Al Dee received status from Firebase
      await deleteLetterFromAlDeeReceived(playerName);
      console.log('[Quests Mod][Dev] Letter from Al Dee received status deleted from Firebase');

      // Clear local quest items cache
      clearQuestItemsCache();
      console.log('[Quests Mod][Dev] Local quest items cache cleared');

      // Grant Silver Token so player can talk to King Tibianus
      await addQuestItem(SILVER_TOKEN_CONFIG.productName, 1);
      console.log('[Quests Mod][Dev] Granted Silver Token for King access');

      // Force update UI state
      updateTile79RightClickState();
      console.log('[Quests Mod][Dev] UI state updated');

      console.log('[Quests Mod][Dev] All quests and quest items reset complete');
    } catch (error) {
      console.error('[Quests Mod][Dev] Error resetting all quests and quest items:', error);
    }
  };

  // Set up event-driven subscriptions for Tile 79 right-click functionality
  function setupTile79Observer() {
    // Subscribe to board state changes to detect room changes
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      tile79BoardSubscription = globalThis.state.board.subscribe(({ context: boardContext }) => {
        console.log('[Quests Mod][Tile 79] Board state changed, checking conditions');
        updateTile79RightClickState(boardContext);
      });
      console.log('[Quests Mod][Tile 79] Board subscription set up');
    }

    // Subscribe to player state changes to detect inventory changes (Stamped Letter)
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player && globalThis.state.player.subscribe) {
      tile79PlayerSubscription = globalThis.state.player.subscribe((playerState) => {
        console.log('[Quests Mod][Tile 79] Player state changed, checking conditions');
        updateTile79RightClickState();
      });
      console.log('[Quests Mod][Tile 79] Player subscription set up');
    }

    // Initial check when subscriptions are set up
    setTimeout(() => {
      console.log('[Quests Mod][Tile 79] Initial state check');
      updateTile79RightClickState();
    }, 500);

    console.log('[Quests Mod][Tile 79] Event-driven subscriptions set up');
    console.log('[Quests Mod][Tile 79] Will respond to: room changes (board state) and inventory changes (player state)');
  }

  // Helper function to get current room ID from board context or global state
  function getCurrentRoomId(boardContext = null) {
    const context = boardContext || globalThis.state?.board?.getSnapshot()?.context;
    return context?.selectedMap?.selectedRoom?.id || globalThis.state?.selectedMap?.selectedRoom?.id;
  }

  // Set up event-driven subscriptions for fishing functionality
  function setupWaterFishingObserver() {
    // Subscribe to board state changes to detect map changes and new tiles/sprites being loaded
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      fishingState.subscriptions.board = globalThis.state.board.subscribe(({ context: boardContext }) => {
        const newRoomId = getCurrentRoomId(boardContext);

        // Only rescan if the room has actually changed
        if (fishingState.currentRoomId !== newRoomId) {
          console.log('[Quests Mod][Water Fishing] Room changed from', fishingState.currentRoomId, 'to', newRoomId, '- cleaning up and rescanning for water tiles');

          // Update current room ID
          fishingState.currentRoomId = newRoomId;

          // Reset Al Dee mission fishing attempts counter when changing rooms
          fishingState.alDeeMissionAttempts = 0;
          console.log('[Quests Mod][Water Fishing] Reset Al Dee mission fishing attempts counter due to room change');

          // Clean up existing water tiles on map change
          if (fishingState.enabled) {
            disableWaterTileRightClick();
            fishingState.tiles.clear();
            fishingState.enabled = false; // Reset enabled flag so it can be re-enabled
            console.log('[Quests Mod][Water Fishing] Cleaned up existing water tiles and reset enabled flag');
          }

          // Wait for new map sprites to load, then scan for water tiles
          setTimeout(() => {
            console.log('[Quests Mod][Water Fishing] Scanning for water tiles after map change delay - executing callback');
            console.log('[Quests Mod][Water Fishing] Current DOM state - total sprites found:', document.querySelectorAll('.sprite.item.relative').length);
            updateWaterFishingState();
            console.log('[Quests Mod][Water Fishing] Callback execution completed');
          }, FISHING_CONFIG.MAP_SWITCH_DELAY);
        } else {
          console.log('[Quests Mod][Water Fishing] Board state changed but room is still', newRoomId, '- skipping rescan');
        }
      });
      console.log('[Quests Mod][Water Fishing] Board subscription set up');
    }

    // Subscribe to player state changes to detect Fishing Rod acquisition/loss
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player && globalThis.state.player.subscribe) {
      fishingState.subscriptions.player = globalThis.state.player.subscribe((playerState) => {
        console.log('[Quests Mod][Water Fishing] Player state changed, checking Fishing Rod');
        updateWaterFishingState();
      });
      console.log('[Quests Mod][Water Fishing] Player subscription set up');
    }

    // Initial check when subscriptions are set up
    setTimeout(() => {
      console.log('[Quests Mod][Water Fishing] Initial state check');
      // Initialize current room ID
      fishingState.currentRoomId = getCurrentRoomId();
      console.log('[Quests Mod][Water Fishing] Initial room ID set to:', fishingState.currentRoomId);
      updateWaterFishingState();
    }, 500);

    console.log('[Quests Mod][Water Fishing] Event-driven subscriptions set up');
    console.log('[Quests Mod][Water Fishing] Will respond to: board changes and inventory changes (player state)');
  }

  // Update Tile 79 right-click state based on current conditions
  function updateTile79RightClickState(boardContext = null) {
    console.log('[Quests Mod][Tile 79] updateTile79RightClickState called');
    try {
      const shouldBeEnabled = shouldEnableTile79RightClick(boardContext);
      const tile79Element = getTileElement(79);

      console.log('[Quests Mod][Tile 79] Checking conditions:', {
        shouldBeEnabled,
        tile79ElementExists: !!tile79Element,
        tile79RightClickEnabled
      });

      if (shouldBeEnabled && tile79Element && !tile79RightClickEnabled) {
        // Enable right-click - add to document with capture to intercept events before they reach the tile
        document.addEventListener('contextmenu', handleTile79RightClickDocument, true); // Use capture phase on document

        // Temporarily enable pointer events on the tile
        tile79Element.style.pointerEvents = 'auto';

        tile79RightClickEnabled = true;
        console.log('[Quests Mod][Tile 79] Right-click enabled - document listener added and pointer events enabled');
      } else if (!shouldBeEnabled && tile79RightClickEnabled) {
        // Disable right-click - remove document listener and restore tile pointer events
        document.removeEventListener('contextmenu', handleTile79RightClickDocument, true);

        // Restore pointer events on tile 79
        if (tile79Element) {
          tile79Element.style.pointerEvents = ''; // Remove inline style to restore CSS default
        }

        tile79RightClickEnabled = false;
        console.log('[Quests Mod][Tile 79] Right-click disabled - document listener removed and pointer events restored');
      }
    } catch (error) {
      console.error('[Quests Mod][Tile 79] Error updating right-click state:', error);
    }
  }

  // Handle right-click on Tile 79
  function handleTile79RightClick(event) {
    console.log('[Quests Mod][Tile 79] Right-click detected - showing Visit Al Dee menu!', event);

    // Be very aggressive about preventing the browser context menu
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    // Create our custom context menu
    createTile79ContextMenu(event.clientX, event.clientY);

    return false;
  }

  // Handle right-click events on document and check if they originated from Tile 79
  function handleTile79RightClickDocument(event) {
    const tile79Element = getTileElement(79);
    if (!tile79Element) return;

    // Check if the event target is inside the tile 79 element
    if (tile79Element.contains(event.target)) {
      console.log('[Quests Mod][Tile 79] Right-click detected on tile 79 via document listener!', event);

      // Be very aggressive about preventing the browser context menu
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      // Create our custom context menu
      createTile79ContextMenu(event.clientX, event.clientY);

      return false;
    }
  }

  // Handle right-click on water tiles
  function handleWaterFishingRightClick(event) {
    console.log('[Quests Mod][Water Fishing] Right-click detected - showing Use Fishing Rod menu!', event);

    // Be very aggressive about preventing the browser context menu
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    // Create our custom context menu
    createWaterFishingContextMenu(event.clientX, event.clientY);

    return false;
  }

  // Handle right-click events on document and check if they originated from water tiles
  function handleWaterFishingRightClickDocument(event) {
    // Check if the event target is inside any water tile
    for (const waterTile of fishingState.tiles) {
      if (waterTile.contains(event.target)) {
        console.log('[Quests Mod][Water Fishing] Right-click detected on water tile via document listener!', event);

        // Store the clicked tile for animation positioning
        fishingState.clickedTile = waterTile;

        // Be very aggressive about preventing the browser context menu
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();

        // Create our custom context menu
        createWaterFishingContextMenu(event.clientX, event.clientY);

        return false;
      }
    }
  }

  // Update water fishing state based on current conditions
  function updateWaterFishingState(manualToggle = false) {
    console.log('[Quests Mod][Water Fishing] updateWaterFishingState called', manualToggle ? '(manual)' : '(auto)');
    try {
      // If this is a manual toggle, apply the current fishingState.enabled directly
      if (manualToggle) {
        if (fishingState.enabled) {
          // Enable fishing - add document listener and enable pointer events
          document.addEventListener('contextmenu', handleWaterFishingRightClickDocument, true); // Use capture phase on document
          enableWaterTileRightClick();
          console.log('[Quests Mod][Water Fishing] Fishing manually enabled - document listener added and pointer events enabled');
        } else {
          // Disable fishing - remove document listener and restore tile pointer events
          document.removeEventListener('contextmenu', handleWaterFishingRightClickDocument, true);
          disableWaterTileRightClick();

          // Close any open context menu
          if (fishingState.contextMenu && fishingState.contextMenu.closeMenu) {
            fishingState.contextMenu.closeMenu();
          }
          console.log('[Quests Mod][Water Fishing] Fishing manually disabled - document listener removed and pointer events restored');
        }
        return;
      }

      // Automatic logic (original behavior) - but respect manual preferences
      const shouldBeEnabled = shouldEnableWaterFishing();

      console.log('[Quests Mod][Water Fishing] Checking conditions:', {
        shouldBeEnabled,
        waterFishingEnabled,
        manuallyDisabled: fishingState.manuallyDisabled
      });

      // Don't automatically enable if user manually disabled it
      const canEnable = shouldBeEnabled && !fishingState.manuallyDisabled;

      if (canEnable && !fishingState.enabled) {
        // Enable fishing - add document listener and enable pointer events
        document.addEventListener('contextmenu', handleWaterFishingRightClickDocument, true); // Use capture phase on document
        enableWaterTileRightClick();

        fishingState.enabled = true;
        console.log('[Quests Mod][Water Fishing] Fishing enabled - document listener added and pointer events enabled');
      } else if (!shouldBeEnabled && fishingState.enabled) {
        // Disable fishing - remove document listener and restore tile pointer events
        document.removeEventListener('contextmenu', handleWaterFishingRightClickDocument, true);
        disableWaterTileRightClick();

        // Close any open context menu
        if (fishingState.contextMenu && fishingState.contextMenu.closeMenu) {
          fishingState.contextMenu.closeMenu();
        }

        fishingState.enabled = false;
        // Clear manual preference if automatically disabled (e.g., fishing rod lost)
        if (!shouldBeEnabled) {
          fishingState.manuallyDisabled = false;
        }
        console.log('[Quests Mod][Water Fishing] Fishing disabled - document listener removed and pointer events restored');
      }
    } catch (error) {
      console.error('[Quests Mod][Water Fishing] Error updating water fishing state:', error);
    }
  }

  // Check if Tile 79 should be right-clickable
  function shouldEnableTile79RightClick(boardContext = null) {
    try {
      // Use provided board context or get from global state
      const context = boardContext || globalThis.state?.board?.getSnapshot()?.context;
      const currentRoomId = context?.selectedMap?.selectedRoom?.id || globalThis.state?.selectedMap?.selectedRoom?.id;
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      const isInSewers = roomNames && currentRoomId && roomNames[currentRoomId] === 'Sewers';

      console.log('[Quests Mod][Tile 79] Room check:', {
        currentRoomId,
        roomName: roomNames?.[currentRoomId],
        isInSewers
      });

      if (!isInSewers) return false;

      // Check if KING_LETTER_MISSION is active or completed (source of truth: Firebase-loaded kingChatState)
      const letterMissionProgress = getMissionProgress(KING_LETTER_MISSION);
      const isMissionAccessible = letterMissionProgress.accepted || letterMissionProgress.completed;

      console.log('[Quests Mod][Tile 79] Mission check:', {
        state: letterMissionProgress,
        accessible: isMissionAccessible
      });

      if (!isMissionAccessible) {
        return false;
      }

      // For completed missions, always allow access. For active missions, require stamped letter.
      if (letterMissionProgress.completed) {
        console.log('[Quests Mod][Tile 79] Mission completed - allowing permanent access');
        return true;
      }

      // Check if user has Stamped Letter in quest items (not regular player inventory)
      const currentProducts = cachedQuestItems || {};
      const hasStampedLetter = (currentProducts['Stamped Letter'] || 0) > 0;

      console.log('[Quests Mod][Tile 79] Quest items check:', {
        questItems: currentProducts,
        hasStampedLetter
      });

      return hasStampedLetter;
    } catch (error) {
      console.error('[Quests Mod][Tile 79] Error checking right-click conditions:', error);
      return false;
    }
  }

  // Check if water fishing should be enabled (player has Fishing Rod)
  function shouldEnableWaterFishing() {
    try {
      // Check if user has Fishing Rod in quest items
      const currentProducts = cachedQuestItems || {};
      const hasFishingRod = (currentProducts['Fishing Rod'] || 0) > 0;

      console.log('[Quests Mod][Water Fishing] Quest items check:', {
        questItems: currentProducts,
        hasFishingRod
      });

      return hasFishingRod;
    } catch (error) {
      console.error('[Quests Mod][Water Fishing] Error checking fishing conditions:', error);
      return false;
    }
  }

  // Check if user has Stamped Letter in quest items
  function hasStampedLetter() {
    try {
      const currentProducts = cachedQuestItems || {};
      return (currentProducts['Stamped Letter'] || 0) > 0;
    } catch (error) {
      console.error('[Quests Mod][Tile 79] Error checking for Stamped Letter:', error);
      return false;
    }
  }

  // Create context menu for Tile 79 with "Visit Al Dee" button
  function createTile79ContextMenu(x, y) {
    console.log('[Quests Mod][Tile 79] Creating context menu at', x, y);

    // Close any existing context menu
    if (tile79ContextMenu && tile79ContextMenu.closeMenu) {
      tile79ContextMenu.closeMenu();
    }

    // Create overlay to close menu on outside click
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9998';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.pointerEvents = 'auto';
    overlay.style.cursor = 'default';

    // Create menu container
    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.zIndex = '9999';
    menu.style.minWidth = '120px';
    menu.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
    menu.style.border = '4px solid transparent';
    menu.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
    menu.style.borderRadius = '6px';
    menu.style.padding = '8px';
    menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';

    // Minimal design - no title or description, just the button

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';

    // "Visit Al Dee" button
    const visitAlDeeButton = document.createElement('button');
    visitAlDeeButton.className = 'pixel-font-14';
    visitAlDeeButton.textContent = 'Visit Al Dee';
    visitAlDeeButton.style.width = '120px';
    visitAlDeeButton.style.height = '28px';
    visitAlDeeButton.style.fontSize = '12px';
    visitAlDeeButton.style.backgroundColor = '#2a4a2a';
    visitAlDeeButton.style.color = '#4CAF50';
    visitAlDeeButton.style.border = '1px solid #4CAF50';
    visitAlDeeButton.style.borderRadius = '4px';
    visitAlDeeButton.style.cursor = 'pointer';
    visitAlDeeButton.style.textShadow = '1px 1px 0px rgba(0,0,0,0.8)';
    visitAlDeeButton.style.fontWeight = 'bold';

    // Add hover effects
    visitAlDeeButton.addEventListener('mouseenter', () => {
      visitAlDeeButton.style.backgroundColor = '#1a2a1a';
      visitAlDeeButton.style.borderColor = '#66BB6A';
    });
    visitAlDeeButton.addEventListener('mouseleave', () => {
      visitAlDeeButton.style.backgroundColor = '#2a4a2a';
      visitAlDeeButton.style.borderColor = '#4CAF50';
    });

    // Handle click - show Al Dee modal
    visitAlDeeButton.addEventListener('click', () => {
      showAlDeeModal();
      closeMenu();
    });

    buttonContainer.appendChild(visitAlDeeButton);
    menu.appendChild(buttonContainer);

    // Event handlers
    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        closeMenu();
      }
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    // Close menu function
    function closeMenu() {
      // Remove event listeners
      overlay.removeEventListener('mousedown', overlayClickHandler);
      overlay.removeEventListener('click', overlayClickHandler);
      document.removeEventListener('keydown', escHandler);

      // Remove from DOM
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }

      // Clear reference
      tile79ContextMenu = null;
    }

    // Add event listeners
    overlay.addEventListener('mousedown', overlayClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', escHandler);

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    console.log('[Quests Mod][Tile 79] Visit Al Dee context menu created and added to DOM');

    // Store reference
    tile79ContextMenu = { overlay, menu, closeMenu };

    return tile79ContextMenu;
  }

  // Create water fishing context menu at specified coordinates
  function createWaterFishingContextMenu(x, y) {
    console.log('[Quests Mod][Water Fishing] Creating context menu at', x, y);

    // Close any existing context menu
    if (waterFishingContextMenu && waterFishingContextMenu.closeMenu) {
      waterFishingContextMenu.closeMenu();
    }

    // Create overlay to close menu on outside click
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9998';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.pointerEvents = 'auto';
    overlay.style.cursor = 'default';

    // Create menu container
    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.zIndex = '9999';
    menu.style.minWidth = '120px';
    menu.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
    menu.style.border = '4px solid transparent';
    menu.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
    menu.style.borderRadius = '6px';
    menu.style.padding = '8px';
    menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';

    // "Use Fishing Rod" button
    const useFishingRodButton = document.createElement('button');
    useFishingRodButton.className = 'pixel-font-14';
    useFishingRodButton.textContent = 'Use Fishing Rod';
    useFishingRodButton.style.width = '140px';
    useFishingRodButton.style.height = '28px';
    useFishingRodButton.style.fontSize = '12px';
    useFishingRodButton.style.backgroundColor = '#2a4a7a'; // Blue-ish color for water
    useFishingRodButton.style.color = '#4FC3F7';
    useFishingRodButton.style.border = '1px solid #4FC3F7';
    useFishingRodButton.style.borderRadius = '4px';
    useFishingRodButton.style.cursor = 'pointer';
    useFishingRodButton.style.textShadow = '1px 1px 0px rgba(0,0,0,0.8)';
    useFishingRodButton.style.fontWeight = 'bold';

    // Add hover effects
    useFishingRodButton.addEventListener('mouseenter', () => {
      useFishingRodButton.style.backgroundColor = '#1a2a4a';
      useFishingRodButton.style.borderColor = '#81D4FA';
    });
    useFishingRodButton.addEventListener('mouseleave', () => {
      useFishingRodButton.style.backgroundColor = '#2a4a7a';
      useFishingRodButton.style.borderColor = '#4FC3F7';
    });

    // Handle click - for now just show a message, can be expanded later
    useFishingRodButton.addEventListener('click', async () => {
      console.log('[Quests Mod][Water Fishing] Fishing rod used!');

      // Get the water tile position for the animation (instead of menu position)
      let animationX, animationY;
      if (fishingState.clickedTile) {
        const tileRect = fishingState.clickedTile.getBoundingClientRect();
        animationX = tileRect.left + tileRect.width / 2;
        animationY = tileRect.top + tileRect.height / 2;
      } else {
        // Fallback to menu position if tile not found
        const rect = menu.getBoundingClientRect();
        animationX = rect.left + rect.width / 2;
        animationY = rect.top + rect.height / 2;
      }

      // Create the circular fishing animation
      createFishingAnimation(animationX, animationY);

      // Emit fishing action event for Guilds mod skill tracking
      const playerName = getCurrentPlayerName();
      if (playerName && window.ModCoordination) {
        console.log('[Quests Mod][Water Fishing] Emitting fishing action for skill tracking');
        window.ModCoordination.emit('fishingAction', { playerName });
      }

      // Check if player is on Al Dee Fishing Mission and in Goblin Bridge
      const alDeeMissionProgress = getMissionProgress(AL_DEE_FISHING_MISSION);
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      const currentRoomId = getCurrentRoomId();
      const isInGoblinBridge = roomNames && currentRoomId && roomNames[currentRoomId] === 'Goblin Bridge';
      const isOnAlDeeMission = alDeeMissionProgress.accepted && !alDeeMissionProgress.completed;

      let toastMessage = 'You found nothing.';

      // Special handling for Al Dee Fishing Mission in Goblin Bridge
      if (isOnAlDeeMission && isInGoblinBridge) {
        fishingState.alDeeMissionAttempts++;
        console.log(`[Quests Mod][Water Fishing] Al Dee mission fishing attempt #${fishingState.alDeeMissionAttempts} in Goblin Bridge`);

        if (fishingState.alDeeMissionAttempts > 3) {
          toastMessage = 'Seems as a magnet will help here.';
        }
      } else {
        // Reset attempt counter when not on mission or not in Goblin Bridge
        fishingState.alDeeMissionAttempts = 0;
      }

      // Implement fishing logic here
      try {
        // Check if player has Magnet and is in Goblin Bridge
        const currentProducts = await getQuestItems();
        const hasMagnet = (currentProducts['Magnet'] || 0) > 0;

        if (hasMagnet && isInGoblinBridge) {
          // Consume Magnet and add Small Axe
          await consumeQuestItem('Magnet', 1);
          await addQuestItem('Small Axe', 1);

          toastMessage = 'You found a Small Axe with your Magnet!';
          console.log('[Quests Mod][Water Fishing] Small Axe obtained using Magnet in Goblin Bridge');
        } else if (isInGoblinBridge && !hasMagnet) {
          toastMessage = 'You found nothing. Maybe a magnet would help?';
          console.log('[Quests Mod][Water Fishing] No Magnet available for fishing in Goblin Bridge');
        } else {
          toastMessage = 'You found nothing.';
          console.log('[Quests Mod][Water Fishing] Fishing in non-Goblin Bridge water');
        }
      } catch (error) {
        console.error('[Quests Mod][Water Fishing] Error during fishing:', error);
        toastMessage = 'Something went wrong while fishing.';
      }

      // Show fishing result toast
      showToast({
        message: toastMessage,
        duration: TOAST_DURATION_DEFAULT,
        logPrefix: '[Quests Mod][Water Fishing]'
      });
      closeMenu();
    });

    buttonContainer.appendChild(useFishingRodButton);
    menu.appendChild(buttonContainer);

    // Event handlers
    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        closeMenu();
      }
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    // Close menu function
    function closeMenu() {
      // Remove event listeners
      overlay.removeEventListener('mousedown', overlayClickHandler);
      overlay.removeEventListener('click', overlayClickHandler);
      document.removeEventListener('keydown', escHandler);

      // Remove from DOM
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }

      // Clear reference
      fishingState.contextMenu = null;
    }

    // Add event listeners
    overlay.addEventListener('mousedown', overlayClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', escHandler);

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    console.log('[Quests Mod][Water Fishing] Use Fishing Rod context menu created and added to DOM');

    // Store reference
    fishingState.contextMenu = { overlay, menu, closeMenu };

    return fishingState.contextMenu;
  }

  // Create circular fishing animation at the specified coordinates
  function createFishingAnimation(x, y) {
    const animationContainer = document.createElement('div');
    animationContainer.style.position = 'fixed';
    animationContainer.style.left = `${x - FISHING_CONFIG.ANIMATION_SIZE / 2}px`; // Center the animation
    animationContainer.style.top = `${y - FISHING_CONFIG.ANIMATION_SIZE / 2}px`;
    animationContainer.style.width = `${FISHING_CONFIG.ANIMATION_SIZE}px`;
    animationContainer.style.height = `${FISHING_CONFIG.ANIMATION_SIZE}px`;
    animationContainer.style.pointerEvents = 'none';
    animationContainer.style.zIndex = '10000'; // Above the context menu

    // Create the circular animation element
    const circle = document.createElement('div');
    circle.style.width = '100%';
    circle.style.height = '100%';
    circle.style.borderRadius = '50%';
    circle.style.border = '2px solid #4FC3F7'; // Water-blue color to match the button
    circle.style.animation = `fishingRipple ${FISHING_CONFIG.ANIMATION_DURATION}ms ease-out forwards`;

    // Add CSS animation if it doesn't exist
    if (!document.getElementById('fishing-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'fishing-animation-styles';
      style.textContent = `
        @keyframes fishingRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          50% {
            transform: scale(0.8);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    animationContainer.appendChild(circle);
    document.body.appendChild(animationContainer);

    // Remove the animation after it completes
    setTimeout(() => {
      if (animationContainer.parentNode) {
        animationContainer.parentNode.removeChild(animationContainer);
      }
    }, FISHING_CONFIG.ANIMATION_DURATION); // Match the animation duration
  }


  // Teleport to Al Dee's location
  function teleportToAlDee() {
    try {
      console.log('[Quests Mod][Tile 79] Teleporting to Al Dee...');

      // Al Dee is located in Rookgaard. We need to navigate to his location.
      // Based on the quest description, Al Dee is a rope merchant in Rookgaard.
      // From the game documentation, Al Dee is located north in Rookgaard.
      // Since we don't have the exact room ID, we'll try to navigate to the main Rookgaard area.
      // This may need to be updated with the correct room ID for Al Dee's shop

      // Try to find the main Rookgaard room ID
      const roomNames = globalThis.state?.utils?.ROOM_NAME;
      let alDeeRoomId = null;

      if (roomNames) {
        // Look for a room that might be the main Rookgaard area
        for (const [roomId, name] of Object.entries(roomNames)) {
          if (name && name.toLowerCase().includes('rookgaard') && !name.toLowerCase().includes('sewers')) {
            alDeeRoomId = roomId;
            break;
          }
        }
      }

      // Fallback to a common pattern if we can't find it
      if (!alDeeRoomId) {
        alDeeRoomId = 'rk'; // Fallback assumption
        console.warn('[Quests Mod][Tile 79] Could not find Rookgaard room ID, using fallback:', alDeeRoomId);
      }

      // Use the same navigation method as Better Tasker
      globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: alDeeRoomId
      });

      // Show success message
      showToast('Teleported to Al Dee!', 'success');

      console.log('[Quests Mod][Tile 79] Teleported to Al Dee successfully');
    } catch (error) {
      console.error('[Quests Mod][Tile 79] Error teleporting to Al Dee:', error);
      showToast('Failed to teleport to Al Dee', 'error');
    }
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

    // Cleanup Tile 79 system
    cleanupTile79System();

    // Cleanup water fishing system
    cleanupWaterFishingSystem();

    // Cleanup Iron Ore quest timer
    if (ironOreQuestTimer) {
      clearInterval(ironOreQuestTimer);
      ironOreQuestTimer = null;
      console.log('[Quests Mod][Iron Ore Quest] Timer stopped');
    }
  }

  function cleanupTile79System() {
    // Remove event listener from document and restore tile pointer events
    if (tile79RightClickEnabled) {
      document.removeEventListener('contextmenu', handleTile79RightClickDocument, true);

      // Restore pointer events on tile 79
      const tile79Element = getTileElement(79);
      if (tile79Element) {
        tile79Element.style.pointerEvents = ''; // Remove inline style to restore CSS default
      }

      tile79RightClickEnabled = false;
    }

    // Close any open context menu
    if (tile79ContextMenu && tile79ContextMenu.closeMenu) {
      tile79ContextMenu.closeMenu();
    }

    // Unsubscribe from board state
    if (tile79BoardSubscription) {
      try {
        tile79BoardSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Tile 79] Error unsubscribing from board:', e);
      }
      tile79BoardSubscription = null;
    }

    // Unsubscribe from player state
    if (tile79PlayerSubscription) {
      try {
        tile79PlayerSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Tile 79] Error unsubscribing from player:', e);
      }
      tile79PlayerSubscription = null;
    }

    console.log('[Quests Mod][Tile 79] System cleaned up');
  }

  function cleanupWaterFishingSystem() {
    // Remove event listener from document and restore tile pointer events
    if (waterFishingEnabled) {
      document.removeEventListener('contextmenu', handleWaterFishingRightClickDocument, true);
      disableWaterTileRightClick();
      waterFishingEnabled = false;
    }

    // Close any open context menu
    if (waterFishingContextMenu && waterFishingContextMenu.closeMenu) {
      waterFishingContextMenu.closeMenu();
    }

    // Unsubscribe from board state
    if (fishingState.subscriptions.board) {
      try {
        fishingState.subscriptions.board.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Water Fishing] Error unsubscribing from board:', e);
      }
      fishingState.subscriptions.board = null;
    }

    // Unsubscribe from player state
    if (fishingState.subscriptions.player) {
      try {
        fishingState.subscriptions.player.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Water Fishing] Error unsubscribing from player:', e);
      }
      fishingState.subscriptions.player = null;
    }

    console.log('[Quests Mod][Water Fishing] System cleaned up');
  }

  // Initialize
  observeInventory();
  setupQuestItemsDropSystem();
  setupCopperKeySystem();
  setupEquipmentSlotObserver();
  
  // Load quest items from Firebase on initialization
  loadQuestItemsOnInit();

  // Load mission progress from Firebase on initialization
  loadMissionProgressOnInit();

  async function loadMissionProgressOnInit() {
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) {
        console.log('[Quests Mod] No player name available for mission progress loading');
        return;
      }

      const progress = await getKingTibianusProgress(playerName);

      // Update kingChatState with loaded progress
      if (progress) {
        // Backward compatibility: old shape {accepted, completed}
        if (progress.accepted !== undefined) {
          kingChatState.progressCopper = {
            accepted: progress.accepted,
            completed: progress.completed
          };
        }
        // New shape {copper:{}, dragon:{}, letter:{}}
        if (progress.copper) {
          kingChatState.progressCopper = {
            accepted: !!progress.copper.accepted,
            completed: !!progress.copper.completed
          };
        }
        if (progress.dragon) {
          kingChatState.progressDragon = {
            accepted: !!progress.dragon.accepted,
            completed: !!progress.dragon.completed
          };
        }
        if (progress.letter) {
          kingChatState.progressLetter = {
            accepted: !!progress.letter.accepted,
            completed: !!progress.letter.completed
          };
        }
        if (progress.alDeeFishing) {
          kingChatState.progressAlDeeFishing = {
            accepted: !!progress.alDeeFishing.accepted,
            completed: !!progress.alDeeFishing.completed
          };
        }
        if (progress.ironOre) {
          fishingState.ironOreQuestActive = !!progress.ironOre.active;
          fishingState.ironOreQuestStartTime = progress.ironOre.startTime;
          fishingState.ironOreQuestCompleted = !!progress.ironOre.completed;
          // If quest was started but not completed and not active, it means timer expired
          fishingState.ironOreQuestExpired = !progress.ironOre.active &&
                                             !progress.ironOre.completed &&
                                             !!progress.ironOre.startTime;
        }

        // If Al Dee fishing mission is completed, mark Iron Ore quest as completed
        // since Iron Ore was part of that mission and the overall quest line is now done
        if (kingChatState.progressAlDeeFishing.completed) {
          if (fishingState.ironOreQuestActive) {
            console.log('[Quests Mod] Al Dee fishing mission completed - marking active Iron Ore quest as completed');
            fishingState.ironOreQuestActive = false;
            fishingState.ironOreQuestExpired = false;
            fishingState.ironOreQuestCompleted = true;
            fishingState.ironOreQuestStartTime = null;
          } else if (!fishingState.ironOreQuestCompleted) {
            console.log('[Quests Mod] Al Dee fishing mission completed - marking Iron Ore quest as completed');
            fishingState.ironOreQuestCompleted = true;
          }

          // Save the completed state to Firebase
          const currentPlayer = getCurrentPlayerName();
          if (currentPlayer) {
            try {
              const currentProgress = await getKingTibianusProgress(currentPlayer);
              await saveKingTibianusProgress(currentPlayer, {
                ...currentProgress,
                ironOre: {
                  active: false,
                  startTime: null,
                  completed: true
                }
              });
              console.log('[Quests Mod] Iron Ore quest marked as completed and saved to Firebase');
            } catch (err) {
              console.error('[Quests Mod] Error marking Iron Ore quest as completed:', err);
            }
          }
        }

        console.log('[Quests Mod] Mission progress loaded from Firebase:', {
          copper: kingChatState.progressCopper,
          dragon: kingChatState.progressDragon,
          letter: kingChatState.progressLetter,
          alDeeFishing: kingChatState.progressAlDeeFishing,
          ironOre: progress.ironOre ? {
            active: fishingState.ironOreQuestActive,
            expired: fishingState.ironOreQuestExpired,
            completed: fishingState.ironOreQuestCompleted
          } : null
        });
      } else {
        console.log('[Quests Mod] No mission progress found in Firebase');
      }
    } catch (error) {
      console.error('[Quests Mod] Error loading mission progress on init:', error);
    }
  }

  // Start monitoring for quest log
  startQuestLogMonitoring();

  // Iron Ore quest timer - checks every 5 seconds for completed quests
  let ironOreQuestTimer = null;
  function startIronOreQuestTimer() {
    if (ironOreQuestTimer) {
      clearInterval(ironOreQuestTimer);
    }

    ironOreQuestTimer = setInterval(async () => {
      try {
        // Check if Iron Ore quest is active and timer has expired
        if (fishingState.ironOreQuestActive &&
            fishingState.ironOreQuestStartTime &&
            !fishingState.ironOreQuestCompleted) {

          const elapsedTime = Date.now() - fishingState.ironOreQuestStartTime;
          if (elapsedTime >= 60000) { // 1 minute = 60000ms
            // Timer expired - mark as ready for reward (don't award yet)
            fishingState.ironOreQuestActive = false;
            fishingState.ironOreQuestExpired = true; // New state: ready for reward
            fishingState.ironOreQuestStartTime = null;

            // Save progress to Firebase (active: false, but not completed yet)
            const currentPlayer = getCurrentPlayerName();
            if (currentPlayer) {
              try {
                const currentProgress = await getKingTibianusProgress(currentPlayer);
                await saveKingTibianusProgress(currentPlayer, {
                  ...currentProgress,
                  ironOre: {
                    active: false,
                    startTime: null,
                    completed: false // Not completed yet - waiting for player to claim reward
                  }
                });
                console.log('[Quests Mod][Iron Ore Quest] Timer expired - ready for reward pickup');
              } catch (err) {
                console.error('[Quests Mod][Iron Ore Quest] Error saving expired timer state:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Quests Mod][Iron Ore Quest] Error in timer check:', err);
      }
    }, 5000); // Check every 5 seconds

    console.log('[Quests Mod][Iron Ore Quest] Timer started');
  }

  // Load mission progress from Firebase on initialization and then setup systems
  loadMissionProgressOnInit().then(() => {
    // Always start with fishing disabled after reload
    fishingState.enabled = false;
    fishingState.manuallyDisabled = true; // Start disabled and prevent automatic re-enabling
    updateWaterFishingState(true);

    // Set up Tile 79 right-click system after mission progress is loaded
    setupTile79Observer();
    // Set up water fishing system
    setupWaterFishingObserver();
  }).catch(error => {
    console.error('[Quests Mod] Failed to load mission progress, setting up systems anyway:', error);

    // Always start with fishing disabled after reload
    fishingState.enabled = false;
    fishingState.manuallyDisabled = true; // Start disabled and prevent automatic re-enabling
    updateWaterFishingState(true);

    setupTile79Observer();
    setupWaterFishingObserver();
  });

  // Start Iron Ore quest timer
  startIronOreQuestTimer();

  // Cleanup on mod unload
  if (typeof context !== 'undefined' && context.exports) {
    const originalCleanup = context.exports.cleanup;
    context.exports.cleanup = function() {
      cleanup();
      if (originalCleanup) originalCleanup();
    };
  }
})();
