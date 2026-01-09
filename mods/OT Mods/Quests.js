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
const QUEST_ITEMS_MODAL_HEIGHT = 190;
const KING_GUILD_COIN_REWARD = 50;

// Toast duration constants (in milliseconds)
const TOAST_DURATION_DEFAULT = 5000;      // 5 seconds - general notifications
const TOAST_DURATION_IMPORTANT = 10000;   // 10 seconds - important quest milestones

// Mornenion quest messages
const MORNENION_DEFEATED_MESSAGE = 'The cave entrance is sealed. Mornenion has been defeated.';

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

// Digging system configuration
const MINING_CONFIG = {
  TARGET_TILE_ID: '82', // Tile 82 on Hedge Maze
  TARGET_MAP: "Hedge Maze", // Map name where mining is available
  SPRITE_TRANSFORM: {
    from: '1822', // Original sprite ID (the one to replace)
    to: '385'    // Transformed sprite ID
  },
  ANIMATION_SIZE: 64,
  ANIMATION_DURATION: 500 // milliseconds
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
  complete: 'My Small Axe! You found it! Here\'s a Light Shovel as a reward for your help.',
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

const AL_DEE_GOLDEN_ROPE_MISSION = {
  id: 'al_dee_golden_rope',
  title: 'The search for the Light',
  prompt: 'Ah, adventurer! I\'ve lost my precious elvenhair rope to those tricky elves. It\'s said to have magical properties that can lead one to great treasures. Will you help me find it?',
  accept: 'Excellent! I\'ll be waiting here for my elvenhair rope. Please return it when you find it!',
  askForItem: 'Have you found my elvenhair rope?',
  complete: 'My elvenhair rope! You found it! Thank you for your help. Here, take this Holy Tible as a reward for your bravery!',
  missingItem: 'You claim yes but I see no elvenhair rope. Return when you have it!',
  keepSearching: 'Then keep searching for my rope and return when you find it.',
  answerYesNo: 'Answer yes or no: have you found my elvenhair rope?',
  alreadyCompleted: 'You already helped me find my elvenhair rope. Thank you again!',
  alreadyActive: 'You\'re already helping me find my elvenhair rope. Bring it back when you find it!',
  objectiveLine1: 'Find Al Dee\'s elvenhair rope that was taken by elves.',
  objectiveLine2: 'Return the elvenhair rope to Al Dee.',
  hint: 'Search areas where elves are known to roam.',
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
  'trade': 'Take a look in the trade window below.',
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
// 2. NPC Conversation Cooldown Manager
// =======================

/**
 * Creates a reusable cooldown manager for NPC conversations.
 * Prevents multiple rapid messages from causing multiple responses.
 * @param {number} cooldownMs - Cooldown delay in milliseconds (default: 1000)
 * @returns {Object} Cooldown manager with methods to handle message responses
 */
function createNPCCooldownManager(cooldownMs = 1000) {
  let pendingResponseTimeout = null;
  let latestMessage = null;

  return {
    /**
     * Clears any pending response timeout (call when a new message arrives)
     */
    clearPendingResponse() {
      if (pendingResponseTimeout) {
        clearTimeout(pendingResponseTimeout);
        pendingResponseTimeout = null;
      }
    },

    /**
     * Queues an NPC response with cooldown protection.
     * Only responds if this is still the latest message after the cooldown period.
     * @param {string} messageText - The original player message text
     * @param {string} responseText - The NPC's response text
     * @param {Function} addMessageCallback - Function to add message to conversation (npcName, text, isNPC)
     * @param {string} npcName - Name of the NPC
     * @param {Function} [onResponseCallback] - Optional callback to execute after response is shown
     */
    queueResponse(messageText, responseText, addMessageCallback, npcName, onResponseCallback = null) {
      // Clear any pending response
      this.clearPendingResponse();

      // Store the latest message
      latestMessage = {
        text: messageText,
        response: responseText
      };

      // Set timeout for response
      pendingResponseTimeout = setTimeout(() => {
        // Only respond if this is still the latest message
        if (latestMessage && latestMessage.text === messageText) {
          addMessageCallback(npcName, latestMessage.response, true);
          
          // Execute optional callback (e.g., for closing modal on "bye")
          if (onResponseCallback) {
            onResponseCallback();
          }
          
          latestMessage = null;
        }
        pendingResponseTimeout = null;
      }, cooldownMs);
    },

    /**
     * Resets the cooldown manager (useful when closing modal)
     */
    reset() {
      this.clearPendingResponse();
      latestMessage = null;
    }
  };
}

// =======================
// 3. State & Observers
// =======================

(function() {
  // =======================
  // General/UI State
  // =======================
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
  
  // =======================
  // Quest Items System State
  // =======================
  let questItemsBoardSubscription = null;
  let lastProcessedQuestItemsSeed = null;
  let cachedQuestItems = null; // Cache for loaded quest items
  
  // =======================
  // Copper Key System State
  // =======================
  let copperKeyBoardSubscription = null;
  let lastProcessedCopperKeySeed = null;
  let trackedBoardConfig = null; // Track boardConfig before battle for verification
  let equipmentSlotObserver = null; // Observer for equipment slot display
  
  // =======================
  // King Tibianus System State
  // =======================
  const kingChatState = {
    progressCopper: { accepted: false, completed: false },
    progressDragon: { accepted: false, completed: false },
    progressLetter: { accepted: false, completed: false },
    progressAlDeeFishing: { accepted: false, completed: false },
    progressAlDeeGoldenRope: { accepted: false, completed: false },
    missionOffered: false,
    offeredMission: null,
    awaitingKeyConfirm: false,
    starterCoinThanked: false
  };
  
  // =======================
  // Mining/Digging System State
  // =======================
  const miningState = {
    enabled: false,
    manuallyDisabled: false, // Track if user manually disabled mining (prevents automatic re-enabling)
    contextMenu: null,
    subscriptions: {
      board: null,
      player: null
    },
    tiles: new Set(), // Track mining tiles that are currently enabled
    clickedTile: null, // Store the tile that was right-clicked for animation positioning
    currentRoomId: null // Track current room to avoid unnecessary rescanning
  };
  
  // =======================
  // Water Fishing System State
  // =======================
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
  
  // =======================
  // Tile 79 System State
  // =======================
  let tile79RightClickEnabled = false;
  let tile79ContextMenu = null;
  let tile79BoardSubscription = null;
  let tile79PlayerSubscription = null;
  
  // =======================
  // Quest Log System State
  // =======================
  let questLogObserver = null;
  let questLogMonitorInterval = null;
  let questLogObserverTimeout = null;
  let kingModeActive = false;
  let lastQuestLogContainer = null;
  let missionsToggleButton = null;
  
  // =======================
  // Quest Overlay Hider System State
  // =======================
  let questOverlayHider = null;
  let abDendrielMutationObserver = null; // MutationObserver for continuous cleanup in Ab'Dendriel
  let gameTimerSubscription = null; // Subscription for game timer to detect battle completion in sandbox
  let playerUsedHoleToAbDendriel = false; // Track if player used hole to enter Ab'Dendriel
  let villainSetupDone = false; // Track if villain setup has been done for current Ab'Dendriel session
  let overlayHidingDone = false; // Track if overlay hiding has been done for current Ab'Dendriel session
  let currentlyInAbDendriel = false; // Track if we're currently in Ab'Dendriel area
  let isAddingVillains = false; // Flag to prevent rapid re-additions of Mornenion/Elves
  let lastVillainAddTime = 0; // Timestamp of last villain addition attempt
  let justRemovedVillains = false; // Flag to skip Mornenion check immediately after removal
  
  // =======================
  // Mornenion System State
  // =======================
  let playerUsedHoleToMornenion = false; // Track if player used hole to enter Mornenion
  let mornenionBattle = null; // CustomBattle instance for Mornenion


  // Initialize Mornenion CustomBattle configuration
  // This is called when the quest triggers (player uses hole to enter Mornenion area)
  function initializeMornenionBattle() {
    if (!window.CustomBattles) {
      console.warn('[Quests Mod][Mornenion] CustomBattles system not available when quest triggered, waiting...');
      // Check if script tag exists (means script is loading)
      const scriptCheck = document.querySelector('script[src*="custom-battles.js"]');
      if (!scriptCheck) {
        console.error('[Quests Mod][Mornenion] custom-battles.js script tag NOT found - script may not be injected');
        return null;
      }
      
      // Script is loading but CustomBattles not ready yet - wait for it
      // This can happen if the quest triggers very early, before the script finishes loading
      let retries = 0;
      const maxRetries = 40; // 40 * 50ms = 2 seconds
      
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          retries++;
          if (window.CustomBattles) {
            clearInterval(checkInterval);
            console.log('[Quests Mod][Mornenion] CustomBattles became available after', retries * 50, 'ms - creating battle instance');
            resolve(createMornenionBattleInstance());
          } else if (retries >= maxRetries) {
            clearInterval(checkInterval);
            console.error('[Quests Mod][Mornenion] CustomBattles not available after', maxRetries * 50, 'ms - giving up');
            resolve(null);
          }
        }, 50);
      });
    }
    
    // CustomBattles is available - create instance synchronously
    return createMornenionBattleInstance();
  }
  
  // Create the actual Mornenion battle instance
  function createMornenionBattleInstance() {
    if (!window.CustomBattles) {
      console.error('[Quests Mod][Mornenion] CustomBattles still not available');
      return null;
    }
    

    // Verify Elf Scout ID exists
    let elfScoutGameId = 40;
    try {
      const monster = globalThis.state.utils.getMonster(elfScoutGameId);
      if (!monster || !monster.metadata) {
        console.log('[Quests Mod][Mornenion] Elf Scout ID 40 not found, using fallback');
        elfScoutGameId = 4; // Orc Spearman fallback
      }
    } catch (e) {
      console.log('[Quests Mod][Mornenion] Error with Elf Scout ID 40, using fallback');
      elfScoutGameId = 4;
    }

    const mornenionConfig = {
      name: 'Mornenion',
      roomId: 'abwasp',
      floor: 15, // Set floor to 15 for Ab'Dendriel Hive
      villains: [
        {
          nickname: 'Mornenion',
          keyPrefix: 'mornenion-tile-19-',
          tileIndex: 19,
          gameId: elfScoutGameId,
          level: 100,
          tier: 0,
          direction: 'south',
          genes: {
            hp: 100,
            ad: 50,
            ap: 20,
            armor: 50,
            magicResist: 50
          }
        },
        {
          nickname: 'Elf',
          keyPrefix: 'elf-tile-2-',
          tileIndex: 2,
          gameId: 39,
          level: 1,
          tier: 0,
          direction: 'south',
          genes: {
            hp: 1,
            ad: 1,
            ap: 1,
            armor: 1,
            magicResist: 1
          }
        },
        {
          nickname: 'Elf',
          keyPrefix: 'elf-tile-11-',
          tileIndex: 11,
          gameId: 39,
          level: 1,
          tier: 0,
          direction: 'south',
          genes: {
            hp: 1,
            ad: 1,
            ap: 1,
            armor: 1,
            magicResist: 1
          }
        },
        {
          nickname: 'Elf',
          keyPrefix: 'elf-tile-137-',
          tileIndex: 137,
          gameId: 39,
          level: 1,
          tier: 0,
          direction: 'south',
          genes: {
            hp: 1,
            ad: 1,
            ap: 1,
            armor: 1,
            magicResist: 1
          }
        },
        {
          nickname: 'Elf',
          keyPrefix: 'elf-tile-146-',
          tileIndex: 146,
          gameId: 39,
          level: 1,
          tier: 0,
          direction: 'south',
          genes: {
            hp: 1,
            ad: 1,
            ap: 1,
            armor: 1,
            magicResist: 1
          }
        }
      ],
      allyLimit: 5,
      tileRestrictions: {
        allowedTiles: [67, 81, 97],
        message: 'Ally creatures can only be placed on tiles 67, 81, and 97 in Mornenion!'
      },
      hideVillainSprites: true,
      activationCheck: (isSandbox, inBattleArea) => {
        return isSandbox && inBattleArea && playerUsedHoleToMornenion;
      },
      victoryDefeat: {
        onVictory: async (gameData) => {
          console.log('[Quests Mod][Mornenion] Mornenion victory! Adding Elvenhair Rope to inventory');
          await addQuestItem('Elvenhair Rope', 1).catch(error => {
            console.error('[Quests Mod][Mornenion] Error adding Elvenhair Rope:', error);
          });
          
          // Set Mornenion defeated flag
          try {
            const playerName = getCurrentPlayerName();
            if (playerName) {
              console.log('[Quests Mod][Mornenion] Mornenion victory detected! Setting defeated flag...');
              const existingProgress = await getKingTibianusProgress(playerName);
              const mergedProgress = {
                ...existingProgress,
                mornenion: {
                  defeated: true
                }
              };
              await saveKingTibianusProgress(playerName, mergedProgress);
              console.log('[Quests Mod][Mornenion] Mornenion defeated flag saved to Firebase');
            }
          } catch (error) {
            console.error('[Quests Mod][Mornenion] Error setting Mornenion defeated flag:', error);
          }
        },
        onDefeat: (gameData) => {
          // Nothing special on defeat
        },
        onClose: (isVictory, gameData) => {
          // Cleanup all Mornenion quest state
          cleanupMornenionQuest();
          // Navigate to Hedge Maze after closing modal
          setTimeout(() => {
            navigateToHedgeMaze();
          }, 100);
        },
        victoryTitle: 'Victory!',
        defeatTitle: 'Defeat',
        victoryMessage: 'Mornenion was slain. You found Elvenhair Rope.',
        defeatMessage: 'Mornenions powers were too strong for you.',
        showItems: false,
        items: [{ name: 'Elvenhair Rope', amount: 1 }]
      }
    };

    return window.CustomBattles.create(mornenionConfig);
  }

  // =======================
  // Creature Placement Tracker
  // =======================
  let previousBoardConfig = null;
  let creaturePlacementSubscription = null;


  // =======================
  // Digging system observer setup
  // =======================

  // Clean up mining subscriptions
  function cleanupMiningObserver() {
    if (miningState.subscriptions.board) {
      miningState.subscriptions.board.unsubscribe();
      miningState.subscriptions.board = null;
    }
    if (miningState.subscriptions.player) {
      miningState.subscriptions.player.unsubscribe();
      miningState.subscriptions.player = null;
    }
  }

  // Set up event-driven subscriptions for digging functionality (only when Light Shovel is owned)
  function setupMiningObserver() {
    // Only set up if Light Shovel is owned
    if (!hasLightShovelInInventory()) {
      return;
    }

    // Clean up any existing subscriptions first
    cleanupMiningObserver();

    // Subscribe to board state changes to detect map changes and new tiles/sprites being loaded
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      miningState.subscriptions.board = globalThis.state.board.subscribe(({ context: boardContext }) => {
        const newRoomId = getCurrentRoomId(boardContext);

        // Only rescan if the room has actually changed
        if (miningState.currentRoomId !== newRoomId) {
          // Update current room ID
          miningState.currentRoomId = newRoomId;

          // Rescan for mining tiles if mining is enabled
          if (miningState.enabled) {
            setTimeout(() => updateMiningState(), MINING_CONFIG.ANIMATION_DURATION);
          }
        }
      });
    }

    // Subscribe to player state changes to check shovel ownership
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player && globalThis.state.player.subscribe) {
      miningState.subscriptions.player = globalThis.state.player.subscribe(() => {
        // Check if Light Shovel is still owned, cleanup if not
        if (!hasLightShovelInInventory()) {
          cleanupMiningObserver();
          updateMiningState();
          return;
        }
        updateMiningState();
      });
    }
    
    // Initial check for Mornenion defeat status
    updateMiningState();
  }

  // =======================
  // Digging system functions
  // =======================

  // Helper function to find digging tiles (tile 82 on Hedge Maze)
  function findMiningTiles() {
    // Only enable mining on Ab'Dendriel Hive
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    const currentRoomId = getCurrentRoomId();
    const currentMapName = roomNames && currentRoomId ? roomNames[currentRoomId] : null;

    if (currentMapName !== MINING_CONFIG.TARGET_MAP) {
      return [];
    }

    // Find tile 82 specifically
    const targetTile = document.getElementById(`tile-index-${MINING_CONFIG.TARGET_TILE_ID}`);
    if (!targetTile) {
      return [];
    }

    // Check if the tile contains the target sprite (id-1822) - not the transformed one (id-385)
    const targetSprite = targetTile.querySelector(`.sprite.item.relative.id-${MINING_CONFIG.SPRITE_TRANSFORM.from}`);
    if (!targetSprite) {
      return [];
    }

    return [targetTile];
  }

  // Enable right-clicking on digging tiles
  function enableMiningTileRightClick() {
    const miningTileElements = findMiningTiles();
    miningTileElements.forEach(tile => {
      if (!miningState.tiles.has(tile)) {
        tile.style.pointerEvents = 'auto';
        miningState.tiles.add(tile);
      }
    });
  }

  // Disable right-clicking on all digging tiles
  function disableMiningTileRightClick() {
    setTilePointerEvents(miningState.tiles, false);
    miningState.tiles.clear();
  }

  // Update digging functionality based on state
  async function updateMiningState(manualToggle = false) {
    try {
      // Update current room ID for room change detection
      miningState.currentRoomId = getCurrentRoomId();

      // Check if Light Shovel is owned
      const hasLightShovel = hasLightShovelInInventory();

      // Set up or clean up subscriptions based on Light Shovel ownership
      if (hasLightShovel && !miningState.subscriptions.board) {
        setupMiningObserver();
      } else if (!hasLightShovel && miningState.subscriptions.board) {
        cleanupMiningObserver();
      }

      // Digging is only available when player has Light Shovel
      // The Light Shovel is obtained from completing Al Dee's fishing mission
      const isMissionActive = hasLightShovel;

      // Determine if mining should be enabled
      const shouldBeEnabled = miningState.enabled && hasLightShovel && isMissionActive;
      
      // Check if mining is currently active (has listeners/tiles)
      const isCurrentlyActive = miningState.tiles.size > 0;

      // Digging state is controlled manually by the toggle button
      if (shouldBeEnabled) {
        // Only enable if not already enabled (avoid duplicate listeners)
        if (!isCurrentlyActive) {
          // Enable digging - add document listener and enable pointer events
          document.addEventListener('contextmenu', handleMiningRightClickDocument, true); // Use capture phase on document
          enableMiningTileRightClick();
          console.log('[Quests Mod][Digging] Mining enabled - document listener added and pointer events enabled');
        }
      } else {
        // Only disable if currently enabled (avoid duplicate logs)
        if (isCurrentlyActive) {
          // Disable digging - remove document listener and restore tile pointer events
          document.removeEventListener('contextmenu', handleMiningRightClickDocument, true);
          disableMiningTileRightClick();

          // Close any open context menu
          if (miningState.contextMenu && miningState.contextMenu.closeMenu) {
            miningState.contextMenu.closeMenu();
          }

          console.log('[Quests Mod][Digging] Mining disabled - document listener removed and pointer events disabled');
        }
      }
    } catch (error) {
      console.error('[Quests Mod][Digging] Error in updateMiningState:', error);
    }
  }

  // Handle right-click on digging tiles
  function handleMiningRightClick(event) {
    console.log('[Quests Mod][Digging] Right-click detected - showing Use Shovel menu!', event);

    // Be very aggressive about preventing the browser context menu
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    // Create our custom context menu
    createMiningContextMenu(event.clientX, event.clientY);

    return false;
  }

  // Handle right-click events on document and check if they originated from digging tiles
  function handleMiningRightClickDocument(event) {
    // Check if the event target is inside any mining tile
    for (const miningTile of miningState.tiles) {
      if (miningTile.contains(event.target)) {
        // Store the clicked tile for animation positioning
        miningState.clickedTile = miningTile;

        // Be very aggressive about preventing the browser context menu
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();

        // Create our custom context menu
        createMiningContextMenu(event.clientX, event.clientY);

        return false;
      }
    }
  }

  // Create digging context menu
  function createMiningContextMenu(x, y) {

    // Close any existing context menu
    if (miningState.contextMenu && miningState.contextMenu.closeMenu) {
      miningState.contextMenu.closeMenu();
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

    // "Use Shovel" button
    const useShovelButton = document.createElement('button');
    useShovelButton.className = 'pixel-font-14';
    useShovelButton.textContent = 'Use Shovel';
    useShovelButton.style.width = '140px';
    useShovelButton.style.height = '28px';
    useShovelButton.style.fontSize = '12px';
    useShovelButton.style.backgroundColor = '#4a3c28'; // Brown-ish color for digging
    useShovelButton.style.color = '#D4AF37';
    useShovelButton.style.border = '1px solid #D4AF37';
    useShovelButton.style.borderRadius = '4px';
    useShovelButton.style.cursor = 'pointer';
    useShovelButton.style.textShadow = '1px 1px 0px rgba(0,0,0,0.8)';
    useShovelButton.style.fontWeight = 'bold';

    // Note: We don't disable the button here - we check when the button is clicked
    // and when accessing the hole, to allow normal digging but prevent Mornenion access

    // Add hover effects (only if not disabled)
    useShovelButton.addEventListener('mouseenter', () => {
      if (!useShovelButton.disabled) {
        useShovelButton.style.backgroundColor = '#2a1c08';
        useShovelButton.style.borderColor = '#F4C430';
      }
    });
    useShovelButton.addEventListener('mouseleave', () => {
      if (!useShovelButton.disabled) {
        useShovelButton.style.backgroundColor = '#4a3c28';
        useShovelButton.style.borderColor = '#D4AF37';
      }
    });

    // Handle click - transform the sprite
    useShovelButton.addEventListener('click', async () => {
      // Note: We allow the shovel to be used normally, but check when accessing the hole

      // Get the digging tile position for the animation
      let animationX, animationY;
      if (miningState.clickedTile) {
        const tileRect = miningState.clickedTile.getBoundingClientRect();
        animationX = tileRect.left + tileRect.width / 2;
        animationY = tileRect.top + tileRect.height / 2;
      } else {
        // Fallback to menu position if tile not found
        const rect = menu.getBoundingClientRect();
        animationX = rect.left + rect.width / 2;
        animationY = rect.top + rect.height / 2;
      }

      // Create the circular digging animation
      createMiningAnimation(animationX, animationY);

      // Transform the sprite from id-355 to id-385
      if (miningState.clickedTile) {
        const oldSprite = miningState.clickedTile.querySelector(`.sprite.item.relative.id-${MINING_CONFIG.SPRITE_TRANSFORM.from}`);
        if (oldSprite) {
          // Change the sprite ID by updating the class
          oldSprite.classList.remove(`id-${MINING_CONFIG.SPRITE_TRANSFORM.from}`);
          oldSprite.classList.add(`id-${MINING_CONFIG.SPRITE_TRANSFORM.to}`);

          // Update the sprite image attributes to match the new sprite
          const imgElement = oldSprite.querySelector('img');
          if (imgElement) {
            imgElement.alt = MINING_CONFIG.SPRITE_TRANSFORM.to;
            imgElement.setAttribute('data-cropped', 'false');
            imgElement.style.setProperty('--cropX', '0');
            imgElement.style.setProperty('--cropY', '0');
          }


          // Add right-click navigation to Ab'Dendriel Hive for the transformed sprite
          const transformedSprite = miningState.clickedTile.querySelector(`.sprite.item.relative.id-${MINING_CONFIG.SPRITE_TRANSFORM.to}`);
          if (transformedSprite) {
            transformedSprite.addEventListener('contextmenu', async (event) => {
              event.preventDefault();
              event.stopPropagation();

              // Check if golden rope mission is accepted - if not, prevent navigation
              const playerName = getCurrentPlayerName();
              if (playerName) {
                const progress = await getKingTibianusProgress(playerName);
                const goldenRopeAccepted = progress?.alDeeGoldenRope?.accepted;
                if (!goldenRopeAccepted) {
                  console.log('[Quests Mod][Digging] Golden rope mission not accepted - hole access disabled');
                  showToast({ message: 'You feel frightened and unprepared to go down the hole.', type: 'error' });
                  return;
                }
              }

              // Check if Mornenion has been defeated - if so, prevent navigation
              const mornenionDefeated = await isMornenionDefeated();
              if (mornenionDefeated) {
                showToast({ message: MORNENION_DEFEATED_MESSAGE, type: 'error' });
                return;
              }

              // Find Ab'Dendriel Hive room ID
              const roomNames = globalThis.state?.utils?.ROOM_NAME;
              if (roomNames) {
                for (const [roomId, name] of Object.entries(roomNames)) {
                  if (name === "Ab'Dendriel Hive") {
                    // Set flag to indicate player used hole to enter Ab'Dendriel Hive BEFORE navigation
                    playerUsedHoleToAbDendriel = true;
                    // Also set Mornenion flag since abwasp is repurposed as Mornenion quest area
                    playerUsedHoleToMornenion = true;
                    
                    // Clean up any existing battle instance to ensure fresh state
                    if (mornenionBattle) {
                      console.log('[Quests Mod][Mining] Cleaning up existing Mornenion battle before creating new instance');
                      mornenionBattle.cleanup(restoreBoardSetup, showQuestOverlays);
                      mornenionBattle = null;
                    }
                    
                    // Initialize Mornenion battle (always create fresh instance)
                    const initResult = initializeMornenionBattle();
                    if (initResult && initResult.then) {
                      // Async initialization - CustomBattles not ready yet, wait for it
                      initResult.then((battle) => {
                        if (battle) {
                          mornenionBattle = battle;
                          mornenionBattle.setup(
                            () => playerUsedHoleToMornenion,
                            (toastData) => {
                              showToast({ 
                                message: toastData.message, 
                                duration: toastData.duration || 3000, 
                                logPrefix: '[Quests Mod][Mornenion]' 
                              });
                            }
                          );
                          setupMornenionTileRestrictions();
                          console.log('[Quests Mod][Mining] Mornenion battle initialized successfully');
                        } else {
                          console.error('[Quests Mod][Mining] Failed to initialize Mornenion battle after waiting');
                        }
                      }).catch((error) => {
                        console.error('[Quests Mod][Mining] Error initializing Mornenion battle:', error);
                      });
                    } else if (initResult) {
                      // Synchronous initialization - CustomBattles was ready immediately
                      mornenionBattle = initResult;
                      mornenionBattle.setup(
                        () => playerUsedHoleToMornenion,
                        (toastData) => {
                          showToast({ 
                            message: toastData.message, 
                            duration: toastData.duration || 3000, 
                            logPrefix: '[Quests Mod][Mornenion]' 
                          });
                        }
                      );
                      setupMornenionTileRestrictions();
                      console.log('[Quests Mod][Mining] Mornenion battle initialized successfully');
                    } else {
                      console.error('[Quests Mod][Mining] Failed to initialize Mornenion battle - CustomBattles not available');
                    }

                    globalThis.state.board.send({
                      type: 'selectRoomById',
                      roomId: roomId
                    });

                    // Show navigation message
                    if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.showToast) {
                      api.ui.components.showToast({
                        message: 'Traveling to Ab\'Dendriel Hive...',
                        type: 'info',
                        duration: TOAST_DURATION_DEFAULT
                      });
                    }
                    break;
                  }
                }
              }

              return false;
            });
          }

          // Remove this tile from the mining tiles set so it can't be clicked again
          miningState.tiles.delete(miningState.clickedTile);
        }
      }

      // Close the menu
      if (miningState.contextMenu && miningState.contextMenu.closeMenu) {
        miningState.contextMenu.closeMenu();
      }

      // Show success message
      if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.showToast) {
        api.ui.components.showToast({
          message: 'You mined some ore!',
          type: 'success',
          duration: TOAST_DURATION_DEFAULT
        });
      }
    });

    // Add button to container
    buttonContainer.appendChild(useShovelButton);
    menu.appendChild(buttonContainer);

    // ESC key handler
    const escHandler = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    // Close menu function
    const closeMenu = () => {
      console.log('[Quests Mod][Digging] Closing mining context menu');
      
      // Remove event listeners
      overlay.removeEventListener('mousedown', closeMenu);
      overlay.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', escHandler);
      
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }

      // Clear reference
      miningState.contextMenu = null;
    };

    // Add event listeners
    overlay.addEventListener('mousedown', closeMenu);
    overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', escHandler);

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    // Store reference
    miningState.contextMenu = { overlay, menu, closeMenu };

    return miningState.contextMenu;
  }

  // Create circular digging animation at the specified coordinates
  function createMiningAnimation(x, y) {
    const animationContainer = document.createElement('div');
    animationContainer.style.position = 'fixed';
    animationContainer.style.left = `${x - MINING_CONFIG.ANIMATION_SIZE / 2}px`;
    animationContainer.style.top = `${y - MINING_CONFIG.ANIMATION_SIZE / 2}px`;
    animationContainer.style.width = `${MINING_CONFIG.ANIMATION_SIZE}px`;
    animationContainer.style.height = `${MINING_CONFIG.ANIMATION_SIZE}px`;
    animationContainer.style.pointerEvents = 'none';
    animationContainer.style.zIndex = '10000';
    animationContainer.style.background = 'radial-gradient(circle, rgba(139,69,19,0.8) 0%, rgba(160,82,45,0.6) 50%, transparent 70%)';
    animationContainer.style.borderRadius = '50%';
    animationContainer.style.animation = `diggingPulse ${MINING_CONFIG.ANIMATION_DURATION}ms ease-out forwards`;

    // Add keyframes for the animation
    if (!document.getElementById('digging-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'digging-animation-styles';
      style.textContent = `
        @keyframes diggingPulse {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(animationContainer);

    // Remove animation after it completes
    setTimeout(() => {
      if (animationContainer.parentNode) {
        animationContainer.parentNode.removeChild(animationContainer);
      }
    }, MINING_CONFIG.ANIMATION_DURATION);
  }

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
    // Generate selector from configuration
    const waterSelector = FISHING_CONFIG.SPRITE_IDS
      .map(id => `.sprite.item.relative.id-${id}`)
      .join(', ');

    // Find all water sprites using configuration
    const allWaterSprites = document.querySelectorAll(waterSelector);
    const waterTileContainers = [];

    // Process all water sprites in a single loop
    for (const sprite of allWaterSprites) {
      let tileContainer = sprite.closest('[id^="tile-index-"]');
      if (tileContainer && !waterTileContainers.includes(tileContainer)) {
        waterTileContainers.push(tileContainer);
      }
    }

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
    });
  }

  // Enable right-clicking on all water tiles
  function enableWaterTileRightClick() {
    const waterTileElements = findWaterTiles();
    waterTileElements.forEach(tile => {
      if (!fishingState.tiles.has(tile)) {
        tile.style.pointerEvents = 'auto';
        fishingState.tiles.add(tile);
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

    // Add Light Shovel (reward for returning Small Axe to Al Dee)
    const lightShovelDef = {
      name: 'Light Shovel',
      icon: 'Light_Shovel.gif',
      description: 'Lighter than a shovel.',
      rarity: 4
    };

    // Add Elvenhair Rope (quest item for Al Dee's golden rope mission)
    const elvenhairRopeDef = {
      name: 'Elvenhair Rope',
      icon: 'Elvenhair_Rope.gif',
      description: 'A magical rope made from elven hair, said to lead to great treasures.',
      rarity: 5
    };
    if (!productDefinitions.find(p => p.name === lightShovelDef.name)) {
      productDefinitions.push(lightShovelDef);
    }
    if (!productDefinitions.find(p => p.name === elvenhairRopeDef.name)) {
      productDefinitions.push(elvenhairRopeDef);
    }

    // Add The Holy Tible (reward for completing Al Dee's golden rope mission)
    const holyTibleDef = {
      name: 'The Holy Tible',
      icon: 'The_Holy_Tible.png',
      description: 'A sacred tome containing ancient wisdom and divine knowledge.',
      rarity: 5
    };
    if (!productDefinitions.find(p => p.name === holyTibleDef.name)) {
      productDefinitions.push(holyTibleDef);
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

  // Check if player has received Copper Key
  async function hasReceivedCopperKey(playerName) {
    if (!playerName) {
      return false;
    }
    
    const hashedPlayer = await hashUsername(playerName);
    const data = await FirebaseService.get(
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

      await FirebaseService.put(
        `${getCopperKeyFirebasePath()}/${hashedPlayer}`,
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
    const data = await FirebaseService.get(
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

      await FirebaseService.put(
        `${getLetterFromAlDeeFirebasePath()}/${hashedPlayer}`,
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
    const data = await FirebaseService.get(
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

      await FirebaseService.put(
        `${getIronOreFirebasePath()}/${hashedPlayer}`,
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
    globalThis.questsDevGrant = async function ({ leather = 0, scale = 0, letter = 0, ironOre = 0, smallAxe = 0, copperKey = 0, stampedLetter = 0, elvenhairRope = 0, holyTible = 0 } = {}) {
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
        await processItem('Elvenhair Rope', elvenhairRope, 'Elvenhair Rope');
        await processItem('The Holy Tible', holyTible, 'The Holy Tible');

        console.log('[Quests Mod][Dev] Quest items modified:', actions.join(', '));
        console.log('[Quests Mod][Dev] Parameters used:', { leather, scale, letter, ironOre, smallAxe, copperKey, stampedLetter, elvenhairRope, holyTible });
      } catch (err) {
        console.error('[Quests Mod][Dev] Operation failed:', err);
      }
    };
  }

  // =======================
  // Firebase Service
  // =======================
  
  const FirebaseService = {
    /**
     * Handle Firebase response with standardized error handling
     * @param {Response} response - Fetch response object
     * @param {string} errorContext - Context for error messages
     * @param {*} defaultReturn - Default value to return on 404 or error
     * @returns {Promise<*>} Parsed JSON response or defaultReturn
     */
    async handleResponse(response, errorContext, defaultReturn = null) {
      if (!response.ok) {
        if (response.status === 404) {
          return defaultReturn;
        }
        throw new Error(`Failed to ${errorContext}: ${response.status}`);
      }
      return await response.json();
    },

    /**
     * Make a GET request to Firebase
     * @param {string} path - Firebase path (without .json extension)
     * @param {string} errorContext - Context for error messages
     * @param {*} defaultReturn - Default value to return on 404 or error
     * @returns {Promise<*>} Parsed JSON response or defaultReturn
     */
    async get(path, errorContext, defaultReturn = null) {
      try {
        const response = await fetch(`${path}.json`);
        return await this.handleResponse(response, errorContext, defaultReturn);
      } catch (error) {
        console.error(`[Quests Mod] Error ${errorContext}:`, error);
        return defaultReturn;
      }
    },

    /**
     * Make a PUT request to Firebase
     * @param {string} path - Firebase path (without .json extension)
     * @param {*} data - Data to send
     * @param {string} errorContext - Context for error messages
     * @returns {Promise<*>} Parsed JSON response
     */
    async put(path, data, errorContext) {
      const options = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
      const response = await fetch(`${path}.json`, options);
      return await this.handleResponse(response, errorContext);
    },

    /**
     * Make a DELETE request to Firebase
     * @param {string} path - Firebase path (without .json extension)
     * @param {string} errorContext - Context for error messages
     * @returns {Promise<*>} Parsed JSON response
     */
    async delete(path, errorContext) {
      const options = {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      };
      const response = await fetch(`${path}.json`, options);
      return await this.handleResponse(response, errorContext);
    }
  };

  // =======================
  // Mission Registry
  // =======================
  // Centralized mapping of mission IDs to state properties and Firebase keys
  // 
  // HOW TO ADD A NEW MISSION:
  // 1. Define the mission constant at the top of the file (e.g., const NEW_MISSION = {...})
  // 2. Add to kingChatState object: progressNewMission: { accepted: false, completed: false }
  // 3. Add to MISSIONS array in showKingTibianusModal() function
  // 4. Add entries to these two maps below:
  //    - MISSION_STATE_MAP: maps mission.id to kingChatState property name
  //    - MISSION_FIREBASE_KEY_MAP: maps mission.id to Firebase property name
  //
  // That's it! The registry automatically handles:
  // - MissionManager.getProgress() and setProgress()
  // - getKingTibianusProgress() loading
  // - saveKingTibianusProgress() saving
  // - loadMissionProgressOnInit() initialization
  //
  // Example for a new mission with id 'new_mission':
  //   MISSION_STATE_MAP: { 'new_mission': 'progressNewMission' }
  //   MISSION_FIREBASE_KEY_MAP: { 'new_mission': 'newMission' }
  //
  const MISSION_STATE_MAP = {
    [KING_COPPER_KEY_MISSION.id]: 'progressCopper',
    [KING_RED_DRAGON_MISSION.id]: 'progressDragon',
    [KING_LETTER_MISSION.id]: 'progressLetter',
    [AL_DEE_FISHING_MISSION.id]: 'progressAlDeeFishing',
    [AL_DEE_GOLDEN_ROPE_MISSION.id]: 'progressAlDeeGoldenRope'
  };

  const MISSION_FIREBASE_KEY_MAP = {
    [KING_COPPER_KEY_MISSION.id]: 'copper',
    [KING_RED_DRAGON_MISSION.id]: 'dragon',
    [KING_LETTER_MISSION.id]: 'letter',
    [AL_DEE_FISHING_MISSION.id]: 'alDeeFishing',
    [AL_DEE_GOLDEN_ROPE_MISSION.id]: 'alDeeGoldenRope'
  };

  // Helper: Get all mission progress from kingChatState using registry
  // This ensures all registered missions are included when saving
  // Future-proof: automatically includes any new missions added to registry
  function getAllMissionProgress() {
    const result = {};
    for (const [missionId, firebaseKey] of Object.entries(MISSION_FIREBASE_KEY_MAP)) {
      const stateKey = MISSION_STATE_MAP[missionId];
      if (stateKey) {
        // Always include the mission, even if it's default values
        // This ensures new missions are saved even if not yet initialized
        result[firebaseKey] = kingChatState[stateKey] || { accepted: false, completed: false };
      } else {
        // Registry inconsistency detected - log warning in development
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[Quests Mod] Registry inconsistency: mission ${missionId} has Firebase key ${firebaseKey} but no state key mapping`);
        }
      }
    }
    return result;
  }

  // Validation: Ensure registry consistency at initialization
  // This helps catch configuration errors early
  (function validateMissionRegistry() {
    const stateKeys = Object.values(MISSION_STATE_MAP);
    const firebaseKeys = Object.values(MISSION_FIREBASE_KEY_MAP);
    const missionIds = Object.keys(MISSION_STATE_MAP);
    
    // Check that all mission IDs have both state and Firebase mappings
    for (const missionId of missionIds) {
      if (!MISSION_STATE_MAP[missionId]) {
        console.error(`[Quests Mod] Registry error: Mission ${missionId} missing state key mapping`);
      }
      if (!MISSION_FIREBASE_KEY_MAP[missionId]) {
        console.error(`[Quests Mod] Registry error: Mission ${missionId} missing Firebase key mapping`);
      }
    }
    
    // Check that state keys exist in kingChatState (warn only, as they may be added later)
    for (const stateKey of stateKeys) {
      if (!kingChatState.hasOwnProperty(stateKey)) {
        console.warn(`[Quests Mod] Registry warning: State key '${stateKey}' not found in kingChatState. Ensure it's added to kingChatState object.`);
      }
    }
  })();

  // King Tibianus quest progress helpers
  function getKingTibianusProgressPath() {
    return `${FIREBASE_CONFIG.firebaseUrl}/quests/king-tibianus/progress`;
  }

  async function getKingTibianusProgress(playerName) {
    if (!playerName) {
      return { accepted: false, completed: false, __isEmpty: true };
    }
    const hashedPlayer = await hashUsername(playerName);
    const data = await FirebaseService.get(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      'fetch King Tibianus progress',
      null
    );
    if (!data || Object.keys(data).length === 0) {
      return { accepted: false, completed: false, __isEmpty: true };
    }
    // New shape preferred: nested format with all missions from registry
    // Check if any registered mission field exists in data
    const hasAnyMissionField = Object.values(MISSION_FIREBASE_KEY_MAP).some(key => data[key]) || data.ironOre || data.mornenion;
    
    if (hasAnyMissionField) {
      const result = {};
      
      // Build mission progress from registry
      for (const [missionId, firebaseKey] of Object.entries(MISSION_FIREBASE_KEY_MAP)) {
        result[firebaseKey] = data[firebaseKey] ? {
          accepted: !!data[firebaseKey].accepted,
          completed: !!data[firebaseKey].completed
        } : {
          accepted: false,
          completed: false
        };
      }
      
      // Add ironOre (special case - not a regular mission)
      result.ironOre = data.ironOre ? {
        active: !!data.ironOre.active,
        startTime: data.ironOre.startTime || null,
        completed: !!data.ironOre.completed
      } : {
        active: false,
        startTime: null,
        completed: false
      };
      
      // Add mornenion (special case - not a regular mission)
      result.mornenion = data.mornenion ? {
        defeated: !!data.mornenion.defeated
      } : {
        defeated: false
      };
      
      result.__isEmpty = false;
      return result;
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
    
    // Check if progress has any registered mission fields, ironOre, or mornenion
    const hasNestedFormat = progress && (
      Object.values(MISSION_FIREBASE_KEY_MAP).some(key => progress[key]) || 
      progress.ironOre ||
      progress.mornenion
    );
    
    const normalized = hasNestedFormat
      ? (() => {
          const result = {};
          
          // Build normalized mission progress from registry
          for (const [missionId, firebaseKey] of Object.entries(MISSION_FIREBASE_KEY_MAP)) {
            result[firebaseKey] = progress[firebaseKey] ? {
              accepted: !!progress[firebaseKey].accepted,
              completed: !!progress[firebaseKey].completed
            } : {
              accepted: false,
              completed: false
            };
          }
          
          // Add ironOre (special case - not a regular mission)
          result.ironOre = progress.ironOre ? {
            active: !!progress.ironOre.active,
            startTime: progress.ironOre.startTime || null,
            completed: !!progress.ironOre.completed
          } : {
            active: false,
            startTime: null,
            completed: false
          };
          
          // Add mornenion (special case - not a regular mission)
          result.mornenion = progress.mornenion ? {
            defeated: !!progress.mornenion.defeated
          } : {
            defeated: false
          };
          
          return result;
        })()
      : {
          accepted: !!progress?.accepted,
          completed: !!progress?.completed
        };
    await FirebaseService.put(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      normalized,
      'save King Tibianus progress'
    );
    console.log('[Quests Mod][King Tibianus] Progress saved', normalized);
  }

  async function deleteKingTibianusProgress(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await FirebaseService.delete(
      `${getKingTibianusProgressPath()}/${hashedPlayer}`,
      'delete King Tibianus progress'
    );
    console.log('[Quests Mod][King Tibianus] Progress deleted for player:', playerName);
  }

  async function deleteQuestItems(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await FirebaseService.delete(
      `${getQuestItemsApiUrl()}/${hashedPlayer}`,
      'delete quest items'
    );
    console.log('[Quests Mod][Quest Items] All quest items deleted for player:', playerName);
  }

  async function deleteAlDeeShopPurchases(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await FirebaseService.delete(
      `${getAlDeeShopPurchasesPath()}/${hashedPlayer}`,
      'delete Al Dee shop purchases'
    );
    console.log('[Quests Mod][Al Dee Shop] All shop purchases deleted for player:', playerName);
  }

  async function deleteCopperKeyReceived(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await FirebaseService.delete(
      `${getCopperKeyFirebasePath()}/${hashedPlayer}`,
      'delete Copper Key received status'
    );
    console.log('[Quests Mod][Copper Key] Copper Key received status deleted for player:', playerName);
  }

  async function deleteLetterFromAlDeeReceived(playerName) {
    if (!playerName) return;
    const hashedPlayer = await hashUsername(playerName);
    await FirebaseService.delete(
      `${getLetterFromAlDeeFirebasePath()}/${hashedPlayer}`,
      'delete Letter from Al Dee received status'
    );
    console.log('[Quests Mod][Letter from Al Dee] Letter from Al Dee received status deleted for player:', playerName);
  }

  async function getAlDeeShopPurchases(playerName) {
    if (!playerName) return {};
    const hashedPlayer = await hashUsername(playerName);
    try {
      const response = await FirebaseService.get(
        `${getAlDeeShopPurchasesPath()}/${hashedPlayer}`,
        'get Al Dee shop purchases',
        {}
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
    const data = await FirebaseService.get(
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

  async function isMornenionDefeated() {
    try {
      const playerName = getCurrentPlayerName();
      if (!playerName) return false;
      
      const progress = await getKingTibianusProgress(playerName);
      if (!progress) return false;
      
      // First check: If golden rope mission is completed, Mornenion was defeated
      if (progress.alDeeGoldenRope && progress.alDeeGoldenRope.completed) {
        console.log('[Quests Mod][Mornenion] Golden rope mission completed - Mornenion was defeated');
        return true;
      }
      
      // Second check: If Elvenhair Rope is in inventory, Mornenion was defeated
      const questItems = await getQuestItems(false); // Force fresh fetch
      if (questItems && questItems['Elvenhair Rope'] && questItems['Elvenhair Rope'] > 0) {
        console.log('[Quests Mod][Mornenion] Elvenhair Rope found in inventory - Mornenion was defeated');
        return true;
      }

      // Third check: Firebase flag
      if (progress.mornenion && progress.mornenion.defeated) {
        console.log('[Quests Mod][Mornenion] Mornenion defeated flag found in Firebase');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[Quests Mod][Mornenion] Error checking Mornenion defeat status:', error);
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
      // Cap various quest items to 1, red dragon materials at 30, iron ore at 1
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
        'Light Shovel',
        'Elvenhair Rope',
        'The Holy Tible'
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
      const firebaseResult = await FirebaseService.put(
        `${getQuestItemsApiUrl()}/${hashedPlayer}`,
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
      await FirebaseService.put(
        `${getQuestItemsApiUrl()}/${hashedPlayer}`,
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
              if (globalDrop.name === 'Iron Ore') {
                const currentPlayer = getCurrentPlayerName();
                const hasReceived = await hasReceivedIronOre(currentPlayer);
                if (hasReceived) {
                  console.log('[Quests Mod][Quest Items] Iron Ore already received by this account, skipping drop');
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
                  if (globalDrop.name === 'Iron Ore') {
                    const currentPlayer = getCurrentPlayerName();
                    await markIronOreReceived(currentPlayer);
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

  // Clean up Copper Key subscriptions
  function cleanupCopperKeySystem() {
    if (copperKeyBoardSubscription) {
      copperKeyBoardSubscription.unsubscribe();
      copperKeyBoardSubscription = null;
    }
    if (equipmentSlotObserver) {
      equipmentSlotObserver.unsubscribe();
      equipmentSlotObserver = null;
    }
  }

  // Setup Copper Key verification system (only when mission is active)
  function setupCopperKeySystem() {
    // Only set up if Copper Key mission is active or completed
    const copperMissionProgress = kingChatState.progressCopper || { accepted: false, completed: false };
    if (!copperMissionProgress.accepted && !copperMissionProgress.completed) {
      // Mission not active - cleanup if subscriptions exist
      if (copperKeyBoardSubscription) {
        cleanupCopperKeySystem();
      }
      return;
    }

    if (copperKeyBoardSubscription) {
      return; // Already set up
    }
    
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      console.log('[Quests Mod][Copper Key] Setting up Copper Key system...');
      
      // Single subscription for both tracking and verification
      copperKeyBoardSubscription = globalThis.state.board.subscribe(async ({ context }) => {
        // Check if mission is still active, cleanup if not
        const copperMissionProgress = kingChatState.progressCopper || { accepted: false, completed: false };
        if (!copperMissionProgress.accepted && !copperMissionProgress.completed) {
          cleanupCopperKeySystem();
          return;
        }
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
  // Notification Service
  // =======================
  
  const NotificationService = {
    /**
     * Get or create toast container
     * @returns {HTMLElement} Toast container element
     */
    getContainer() {
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
    },

    /**
     * Update toast positions after removal
     * @param {HTMLElement} container - Toast container
     */
    updatePositions(container) {
      const toasts = container.querySelectorAll('.toast-item');
      toasts.forEach((toast, index) => {
        const offset = index * 46;
        toast.style.transform = `translateY(-${offset}px)`;
      });
    },

    /**
     * Show a generic toast notification
     * @param {Object} options - Toast options
     * @param {string} [options.productName] - Product name for icon
     * @param {string} options.message - Message to display
     * @param {number} [options.duration=5000] - Duration in milliseconds
     * @param {string} [options.logPrefix='[Quests Mod]'] - Log prefix
     */
    show({ productName, message, duration = TOAST_DURATION_DEFAULT, logPrefix = '[Quests Mod]' }) {
      try {
        const mainContainer = this.getContainer();
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
            this.updatePositions(mainContainer);
          }
        });

        // Auto-remove after duration
        setTimeout(() => {
          if (flexContainer && flexContainer.parentNode) {
            flexContainer.parentNode.removeChild(flexContainer);
            this.updatePositions(mainContainer);
          }
        }, duration);

      } catch (error) {
        console.error(`${logPrefix} Error showing toast:`, error);
      }
    },

    /**
     * Show quest item notification
     * @param {string} productName - Product name
     * @param {number} amount - Amount obtained
     */
    showQuestItem(productName, amount) {
      this.show({
        productName,
        message: tReplace('mods.quests.productObtained', { productName, amount }),
        duration: TOAST_DURATION_DEFAULT
      });
    },

    /**
     * Show mission completion notification
     * @param {Object} mission - Mission object
     */
    showMissionComplete(mission) {
      this.show({
        message: `Mission completed: ${mission.title}`,
        duration: TOAST_DURATION_IMPORTANT
      });
    }
  };

  // =======================
  // Notification System (Legacy Functions)
  // =======================

  // Helper to get or create toast container
  function getToastContainer() {
    return NotificationService.getContainer();
  }

  // Helper to update toast positions after removal
  function updateToastPositions(container) {
    NotificationService.updatePositions(container);
  }

  // Generic toast notification function
  function showToast({ productName, message, duration = TOAST_DURATION_DEFAULT, logPrefix = '[Quests Mod]' }) {
    NotificationService.show({ productName, message, duration, logPrefix });
  }

  function showQuestItemNotification(productName, amount) {
    NotificationService.showQuestItem(productName, amount);
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

  // =======================
  // Event Manager
  // =======================
  
  const EventManager = {
    // Track all event listeners for cleanup
    _listeners: new Map(), // Map<element, Map<event, Set<handler>>>

    /**
     * Add event listener with tracking
     * @param {HTMLElement|Document|Window} element - Element to attach listener to
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {Object|boolean} [options] - Event options (useCapture, etc.)
     * @returns {Function} Cleanup function to remove listener
     */
    addEventListener(element, event, handler, options = false) {
      if (!element || !event || !handler) {
        console.warn('[Quests Mod][EventManager] Invalid parameters for addEventListener');
        return () => {};
      }

      // Initialize tracking structure
      if (!this._listeners.has(element)) {
        this._listeners.set(element, new Map());
      }
      const elementListeners = this._listeners.get(element);
      
      if (!elementListeners.has(event)) {
        elementListeners.set(event, new Set());
      }
      const eventHandlers = elementListeners.get(event);

      // Add handler if not already tracked
      if (!eventHandlers.has(handler)) {
        element.addEventListener(event, handler, options);
        eventHandlers.add(handler);
      }

      // Return cleanup function
      return () => this.removeEventListener(element, event, handler);
    },

    /**
     * Remove tracked event listener
     * @param {HTMLElement|Document|Window} element - Element to remove listener from
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    removeEventListener(element, event, handler) {
      if (!element || !event || !handler) return;

      const elementListeners = this._listeners.get(element);
      if (!elementListeners) return;

      const eventHandlers = elementListeners.get(event);
      if (!eventHandlers || !eventHandlers.has(handler)) return;

      try {
        element.removeEventListener(event, handler);
        eventHandlers.delete(handler);

        // Clean up empty sets/maps
        if (eventHandlers.size === 0) {
          elementListeners.delete(event);
        }
        if (elementListeners.size === 0) {
          this._listeners.delete(element);
        }
      } catch (e) {
        console.warn('[Quests Mod][EventManager] Error removing event listener:', e);
      }
    },

    /**
     * Remove all tracked listeners
     */
    cleanupAll() {
      for (const [element, elementListeners] of this._listeners.entries()) {
        for (const [event, eventHandlers] of elementListeners.entries()) {
          for (const handler of eventHandlers) {
            try {
              element.removeEventListener(event, handler);
            } catch (e) {
              console.warn('[Quests Mod][EventManager] Error cleaning up listener:', e);
            }
          }
        }
      }
      this._listeners.clear();
    }
  };

  // =======================
  // Error Handler
  // =======================
  
  const ErrorHandler = {
    /**
     * Handle error with standardized logging and optional user message
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     * @param {string} [userMessage] - Optional user-friendly message
     */
    handleError(error, context, userMessage = null) {
      this.logError(error, context);
      
      if (userMessage && typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
        try {
          api.ui.components.createModal({
            title: 'Error',
            content: `<p>${userMessage}</p>`,
            buttons: [{ text: 'OK', primary: true }]
          });
        } catch (modalError) {
          console.error('[Quests Mod][ErrorHandler] Error showing error modal:', modalError);
        }
      }
    },

    /**
     * Log error with consistent format
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    logError(error, context) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`[Quests Mod] Error in ${context}:`, errorMessage);
      if (errorStack) {
        console.error('[Quests Mod] Stack trace:', errorStack);
      }
    }
  };

  // =======================
  // Context Menu Helper
  // =======================
  
  /**
   * Create a generic game-styled context menu
   * @param {Object} options - Context menu options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {Array<Object>} options.buttons - Array of button configs: {text, onClick, style?, hoverStyle?}
   * @param {Function} [options.onClose] - Callback when menu closes
   * @param {string} [options.logPrefix='[Quests Mod]'] - Log prefix
   * @returns {Object} Menu object with {overlay, menu, closeMenu}
   */
  function createContextMenu({ x, y, buttons, onClose = null, logPrefix = '[Quests Mod]' }) {
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
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.gap = '4px';

    // Create buttons
    buttons.forEach((buttonConfig) => {
      const button = document.createElement('button');
      button.className = 'pixel-font-14';
      button.textContent = buttonConfig.text;
      button.style.width = buttonConfig.width || '140px';
      button.style.height = buttonConfig.height || '28px';
      button.style.fontSize = buttonConfig.fontSize || '12px';
      button.style.backgroundColor = buttonConfig.backgroundColor || '#2a4a7a';
      button.style.color = buttonConfig.color || '#4FC3F7';
      button.style.border = buttonConfig.border || '1px solid #4FC3F7';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.textShadow = '1px 1px 0px rgba(0,0,0,0.8)';
      button.style.fontWeight = 'bold';

      // Add hover effects
      const hoverBg = buttonConfig.hoverBackgroundColor || '#1a2a4a';
      const hoverBorder = buttonConfig.hoverBorderColor || '#81D4FA';
      const defaultBg = button.style.backgroundColor;
      const defaultBorder = button.style.borderColor;

      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = hoverBg;
        button.style.borderColor = hoverBorder;
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = defaultBg;
        button.style.borderColor = defaultBorder;
      });

      // Add click handler
      button.addEventListener('click', () => {
        if (buttonConfig.onClick) {
          buttonConfig.onClick();
        }
      });

      buttonContainer.appendChild(button);
    });

    menu.appendChild(buttonContainer);

    // Close menu function
    const closeMenu = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }
      if (onClose) {
        onClose();
      }
    };

    // Add event listeners
    overlay.addEventListener('mousedown', closeMenu);
    overlay.addEventListener('click', closeMenu);
    
    // ESC key handler (consistent with other mods)
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', escHandler);

    // Store cleanup function for ESC handler
    const cleanupEsc = () => {
      document.removeEventListener('keydown', escHandler);
    };

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    // Return menu object with cleanup
    return {
      overlay,
      menu,
      closeMenu: () => {
        closeMenu();
        cleanupEsc();
      }
    };
  }

  // =======================
  // Mission Manager
  // =======================
  
  const MissionManager = {
    /**
     * Get mission progress
     * @param {Object} mission - Mission object with id property
     * @returns {Object} Progress object {accepted: boolean, completed: boolean}
     */
    getProgress(mission) {
      if (!mission) return { accepted: false, completed: false };
      const stateKey = MISSION_STATE_MAP[mission.id];
      if (stateKey) {
        // Return from state if exists, otherwise return default (future-proof)
        return kingChatState[stateKey] || { accepted: false, completed: false };
      }
      // Mission not in registry - return default
      return { accepted: false, completed: false };
    },

    /**
     * Set mission progress
     * @param {Object} mission - Mission object with id property
     * @param {Object} progress - Progress object {accepted: boolean, completed: boolean}
     */
    setProgress(mission, progress) {
      if (!mission) return;
      const stateKey = MISSION_STATE_MAP[mission.id];
      if (stateKey) {
        kingChatState[stateKey] = progress;
      }
    },

    /**
     * Check if mission is active (accepted but not completed)
     * @param {Object} mission - Mission object
     * @returns {boolean}
     */
    isActive(mission) {
      const progress = this.getProgress(mission);
      return progress.accepted && !progress.completed;
    },

    /**
     * Check if mission is completed
     * @param {Object} mission - Mission object
     * @returns {boolean}
     */
    isCompleted(mission) {
      const progress = this.getProgress(mission);
      return progress.completed;
    },

    /**
     * Get current (next available) mission from a list
     * @param {Array<Object>} missions - Array of mission objects
     * @returns {Object|null} First incomplete mission or null
     */
    getCurrentMission(missions) {
      for (const mission of missions) {
        if (!this.isCompleted(mission)) {
          return mission;
        }
      }
      return null;
    }
  };

  // Legacy function wrappers for backward compatibility
  function getMissionProgress(mission) {
    return MissionManager.getProgress(mission);
  }

  function setMissionProgress(mission, progress) {
    MissionManager.setProgress(mission, progress);
  }

  // =======================
  // Modal Helpers
  // =======================
  
  const ModalHelpers = {
    /**
     * Create a modal row container
     * @param {string} [justifyContent='flex-start'] - CSS justify-content value
     * @param {string} [gap='8px'] - Gap between items
     * @returns {HTMLElement} Row container element
     */
    createRow(justifyContent = 'flex-start', gap = '8px') {
      const row = document.createElement('div');
      row.style.cssText = `display: flex; flex-direction: row; justify-content: ${justifyContent}; gap: ${gap}; align-items: center; width: 100%;`;
      return row;
    },

    /**
     * Create a modal column container
     * @param {string} [alignItems='flex-start'] - CSS align-items value
     * @param {string} [gap='8px'] - Gap between items
     * @returns {HTMLElement} Column container element
     */
    createColumn(alignItems = 'flex-start', gap = '8px') {
      const column = document.createElement('div');
      column.style.cssText = `display: flex; flex-direction: column; align-items: ${alignItems}; gap: ${gap}; width: 100%;`;
      return column;
    },

    /**
     * Create a framed box element (common game UI pattern)
     * @param {Object} [options] - Options object
     * @param {string} [options.background] - Background image URL
     * @param {string} [options.borderImage] - Border image URL
     * @param {string} [options.padding] - Padding value
     * @param {string} [options.minHeight] - Minimum height
     * @returns {HTMLElement} Framed box element
     */
    createFramedBox({ 
      background = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat",
      borderImage = "url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch",
      padding = '2px 4px',
      minHeight = '80px'
    } = {}) {
      const frame = document.createElement('div');
      frame.style.cssText = `
        min-height: ${minHeight};
        padding: ${padding};
        width: 100%;
        box-sizing: border-box;
        background: ${background};
        border: 4px solid transparent;
        border-image: ${borderImage};
      `;
      return frame;
    },

    /**
     * Create a chat input textarea with auto-resize
     * @param {Function} onSend - Callback when message is sent
     * @param {Function} [onKeyDown] - Optional keydown handler
     * @returns {Object} Object with {textarea, sendButton, container}
     */
    createChatInput(onSend, onKeyDown = null) {
      const container = this.createRow('flex-start', '4px');
      
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Type your message...';
      textarea.style.cssText = `
        flex: 1;
        min-height: 27px;
        max-height: 100px;
        resize: none;
        padding: 4px 8px;
        font-size: 12px;
        font-family: inherit;
        background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
        border: 2px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch;
        color: rgb(230, 215, 176);
        overflow-y: auto;
      `;
      
      // Auto-resize textarea
      textarea.addEventListener('input', () => {
        textarea.style.height = '27px';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
      });
      
      // Handle Enter key (send) and Shift+Enter (new line)
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (onSend) {
            onSend();
          }
        }
        if (onKeyDown) {
          onKeyDown(e);
        }
      });
      
      const sendButton = document.createElement('button');
      sendButton.textContent = 'Send';
      sendButton.className = 'pixel-font-14';
      sendButton.style.cssText = `
        padding: 4px 12px;
        height: 27px;
        font-size: 12px;
        background: url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat;
        border: 2px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch;
        color: rgb(230, 215, 176);
        cursor: pointer;
      `;
      
      sendButton.addEventListener('click', () => {
        if (onSend) {
          onSend();
        }
      });
      
      container.appendChild(textarea);
      container.appendChild(sendButton);
      
      return { textarea, sendButton, container };
    },

    /**
     * Close a modal dialog by finding and clicking the close button
     * @param {number} [delay=0] - Delay before closing (ms)
     */
    closeModal(delay = 0) {
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
        }
      }, delay);
    }
  };

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
            mainContainer.style.cssText = 'width: 100%; height: 100%; max-width: 500px; min-height: 190px; max-height: 190px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: row; justify-content: flex-start; align-items: flex-start; gap: 8px; color: rgb(230, 215, 176);';

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
            descriptionBox.style.cssText = 'min-height: 80px; padding: 2px 4px; width: 100%; box-sizing: border-box; background: url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat; border-width: 4px; border-style: solid; border-color: transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill / 1 / 0 stretch;';

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
            min-height: 80px;
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
            min-height: 80px;
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

          // Add toggle button for Fishing Rod or Light Shovel inside the description frame
          if (productDef.name === 'Fishing Rod' || productDef.name === 'Light Shovel') {
            // Create the toggle button
            const toggleButton = document.createElement('button');
            toggleButton.type = 'button';
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-3 py-1 pixel-font-12';
            toggleButton.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; height: 28px; font-size: 12px; margin-top: 8px; display: block; margin-left: auto; margin-right: auto;';

            // Function to update button appearance based on state
            const updateButtonState = () => {
              const isEnabled = productDef.name === 'Fishing Rod' ? fishingState.enabled : miningState.enabled;
              const itemName = productDef.name === 'Fishing Rod' ? 'Fishing' : 'Shovel';

              if (isEnabled) {
                toggleButton.textContent = `${itemName} Enabled`;
                toggleButton.style.setProperty('background-image', 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")', 'important');
                toggleButton.style.setProperty('background-repeat', 'repeat', 'important');
                toggleButton.style.setProperty('border-color', '#4CAF50', 'important'); // Green border
              } else {
                toggleButton.textContent = `Enable ${itemName}`;
                toggleButton.style.setProperty('background-image', 'url("https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png")', 'important');
                toggleButton.style.setProperty('background-repeat', 'repeat', 'important');
                toggleButton.style.setProperty('border-color', '#f44336', 'important'); // Red border
              }
            };

            // Initialize button state
            updateButtonState();

            // Add click handler to toggle
            toggleButton.addEventListener('click', () => {
              if (productDef.name === 'Fishing Rod') {
                fishingState.enabled = !fishingState.enabled;
                fishingState.manuallyDisabled = !fishingState.enabled;
                updateButtonState();

                // Update fishing functionality based on new state (manual toggle)
                updateWaterFishingState(true);

                // Show toast notification
                const toastMessage = fishingState.enabled ? 'Fishing enabled!' : 'Fishing disabled!';
                const toastType = fishingState.enabled ? 'success' : 'info';
              } else if (productDef.name === 'Light Shovel') {
                miningState.enabled = !miningState.enabled;
                miningState.manuallyDisabled = !miningState.enabled;
                updateButtonState();

                // Update mining functionality based on new state (manual toggle)
                updateMiningState(true);

                // Show toast notification
                const toastMessage = miningState.enabled ? 'Shovel enabled!' : 'Shovel disabled!';
                const toastType = miningState.enabled ? 'success' : 'info';
              }

              if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.showToast) {
                api.ui.components.showToast({
                  message: toastMessage,
                  type: toastType,
                  duration: TOAST_DURATION_DEFAULT
                });
              }
            });

            // Add the button to the description frame
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
    'al dee': 'I haven\'t seen Al Dee for a while and don\'t know where he holds house. Let me know if you have any information about him!',
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
            response = 'I greet thee, my loyal subject.'; // Valid response for error case
          }
        }

        // Replace "Player" with actual player name in responses that contain it
        if (response && response.includes && response.includes('Player')) {
          response = response.replace(/Player/g, playerName);
        }
        return response;
      }
    }

    // Default response if no match found - return null to indicate no keyword match
    return null;
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
      // King Tibianus missions and Al Dee missions
      const MISSIONS = [KING_COPPER_KEY_MISSION, KING_RED_DRAGON_MISSION, KING_LETTER_MISSION, AL_DEE_FISHING_MISSION, AL_DEE_GOLDEN_ROPE_MISSION];

      // Mission Registry: Maps mission IDs to their state property names in kingChatState
      // This centralizes mission-to-state mapping for easier maintenance
      const MISSION_STATE_MAP = {
        [KING_COPPER_KEY_MISSION.id]: 'progressCopper',
        [KING_RED_DRAGON_MISSION.id]: 'progressDragon',
        [KING_LETTER_MISSION.id]: 'progressLetter',
        [AL_DEE_FISHING_MISSION.id]: 'progressAlDeeFishing',
        [AL_DEE_GOLDEN_ROPE_MISSION.id]: 'progressAlDeeGoldenRope'
      };

      // Mission Firebase Key Map: Maps mission IDs to their Firebase property names
      const MISSION_FIREBASE_KEY_MAP = {
        [KING_COPPER_KEY_MISSION.id]: 'copper',
        [KING_RED_DRAGON_MISSION.id]: 'dragon',
        [KING_LETTER_MISSION.id]: 'letter',
        [AL_DEE_FISHING_MISSION.id]: 'alDeeFishing',
        [AL_DEE_GOLDEN_ROPE_MISSION.id]: 'alDeeGoldenRope'
      };

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

      // Create cooldown manager for Tibianus conversation
      const tibianusCooldown = createNPCCooldownManager(1000);

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

      function closeDialogWithFallback(delayMs = 0) {
        ModalHelpers.closeModal(delayMs);
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
          guildCoinAmountSpan.textContent = Number.isFinite(amount) ? amount.toLocaleString('en-US') : '?';
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
            line2.textContent = 'Reward: Light Shovel.';
          } else if (selectedMission.id === AL_DEE_GOLDEN_ROPE_MISSION.id) {
            line2.textContent = 'Reward: The Holy Tible.';
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
          // New shape: Load all missions from registry dynamically
          if (progress) {
            for (const [missionId, firebaseKey] of Object.entries(MISSION_FIREBASE_KEY_MAP)) {
              const stateKey = MISSION_STATE_MAP[missionId];
              if (stateKey && progress[firebaseKey]) {
                kingChatState[stateKey] = {
                  accepted: !!progress[firebaseKey].accepted,
                  completed: !!progress[firebaseKey].completed
                };
              }
            }
          }
          
          // Auto-accept Al Dee golden rope mission if player has Elvenhair Rope but mission not accepted
          try {
            const goldenRopeProgress = kingChatState.progressAlDeeGoldenRope;
            if (!goldenRopeProgress.accepted && !goldenRopeProgress.completed) {
              const questItems = await getQuestItems(false);
              if (questItems && questItems['Elvenhair Rope'] && questItems['Elvenhair Rope'] > 0) {
                console.log('[Quests Mod][King Tibianus] Auto-accepting Al Dee golden rope mission - player has Elvenhair Rope');
                kingChatState.progressAlDeeGoldenRope.accepted = true;
                // Save to Firebase
                const playerName = getCurrentPlayerName();
                if (playerName) {
                  const currentProgress = await getKingTibianusProgress(playerName);
                  await saveKingTibianusProgress(playerName, {
                    ...currentProgress,
                    alDeeGoldenRope: {
                      accepted: true,
                      completed: false
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.warn('[Quests Mod][King Tibianus] Error auto-accepting golden rope mission:', error);
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
          // Use registry to get all mission progress (future-proof)
          const allProgress = getAllMissionProgress();
          // Include ironOre if it exists in fishingState
          if (fishingState.ironOreQuestActive !== undefined || fishingState.ironOreQuestCompleted) {
            allProgress.ironOre = {
              active: fishingState.ironOreQuestActive || false,
              startTime: fishingState.ironOreQuestStartTime || null,
              completed: fishingState.ironOreQuestCompleted || false
            };
          }
          await saveKingTibianusProgress(playerName, allProgress);

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
          // Use registry to get all mission progress (future-proof)
          const allProgress = getAllMissionProgress();
          // Include ironOre if it exists in fishingState
          if (fishingState.ironOreQuestActive !== undefined || fishingState.ironOreQuestCompleted) {
            allProgress.ironOre = {
              active: fishingState.ironOreQuestActive || false,
              startTime: fishingState.ironOreQuestStartTime || null,
              completed: fishingState.ironOreQuestCompleted || false
            };
          }
          await saveKingTibianusProgress(playerName, allProgress);
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

      // Helper: Clear textarea input
      function clearTextarea() {
        textarea.value = '';
        textarea.style.height = '27px';
      }

      // Helper: Determine target mission based on message content
      function determineTargetMission(lowerText, activeMission) {
        const mentionsKey = lowerText.includes('key') || lowerText.includes('copper key');
        const mentionsDragon = lowerText.includes('dragon') || lowerText.includes('scale') || lowerText.includes('leather');
        const mentionsLetter = lowerText.includes('letter') || lowerText.includes('scroll');

        if (areAllMissionsCompleted()) {
          return activeMission;
        }

        if (mentionsLetter) {
          return MISSIONS.find(m => m.id === KING_LETTER_MISSION.id) || activeMission;
        } else if (mentionsKey) {
          return MISSIONS.find(m => m.id === KING_COPPER_KEY_MISSION.id) || activeMission;
        } else if (mentionsDragon) {
          return MISSIONS.find(m => m.id === KING_RED_DRAGON_MISSION.id) || activeMission;
        }
        return activeMission;
      }

      // Helper: Handle key confirmation response (yes/no after "Have you found my key?")
      async function handleKeyConfirmation(lowerText, activeMission, kingStrings) {
        if (!kingChatState.awaitingKeyConfirm || !activeMission) {
          return false;
        }

        const currentProgress = getMissionProgress(activeMission);
        if (!currentProgress.accepted || currentProgress.completed) {
          return false;
        }

        if (lowerText.includes('yes')) {
          let hasItems = false;
          if (activeMission.id === KING_COPPER_KEY_MISSION.id) {
            hasItems = await hasCopperKeyInInventory();
          } else if (activeMission.id === KING_RED_DRAGON_MISSION.id) {
            hasItems = await hasRedDragonMaterials();
          } else if (activeMission.id === KING_LETTER_MISSION.id) {
            // TODO: Implement proper letter delivery tracking
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
          clearTextarea();
          return true;
        }

        if (lowerText.includes('no')) {
          queueKingReply(kingStrings.keyKeepSearching);
          kingChatState.awaitingKeyConfirm = false;
          clearTextarea();
          return true;
        }

        queueKingReply(kingStrings.keyAnswerYesNo);
        clearTextarea();
        return true;
      }

      // Helper: Handle mission acceptance
      function handleMissionAcceptance(lowerText) {
        if (!kingChatState.missionOffered || !kingChatState.offeredMission || !lowerText.includes('yes')) {
          return false;
        }

        const offeredProgress = getMissionProgress(kingChatState.offeredMission);
        if (offeredProgress.accepted || offeredProgress.completed) {
          return false;
        }

        kingChatState.missionOffered = false;
        const offeredMissionToStart = kingChatState.offeredMission;
        const offeredStrings = buildStrings(offeredMissionToStart);
        queueKingReply(offeredStrings.thankYou, { onDone: async () => {
          await startKingTibianusQuestForMission(offeredMissionToStart);
          kingChatState.offeredMission = null;
        } });
        tibianusCooldown.reset();
        clearTextarea();
        return true;
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
        tibianusCooldown.clearPendingResponse();
        
        // If the king has not received the starter coin yet, only accept valid hail phrases
        const tokenHeld = await hasSilverToken();
        if (tokenHeld && !kingChatState.starterCoinThanked) {
          if (!isValidHailPhrase(lowerText)) {
            clearTextarea();
            return;
          }
        }

        // Refresh mission context (in case first mission just completed)
        activeMission = currentMission();
        kingStrings = buildStrings(activeMission);
        const currentProgress = getMissionProgress(activeMission);

        // Check for mission-related keywords
        const mentionsKey = lowerText.includes('key') || lowerText.includes('copper key');
        const mentionsDragon = lowerText.includes('dragon') || lowerText.includes('scale') || lowerText.includes('leather');
        const mentionsLetter = lowerText.includes('letter') || lowerText.includes('scroll');

        // Determine target mission based on what player mentioned
        const targetMission = determineTargetMission(lowerText, activeMission);
        const targetStrings = buildStrings(targetMission);
        const targetProgress = getMissionProgress(targetMission);

        // Handle pending key confirmation (yes/no after "Have you found my key?")
        if (await handleKeyConfirmation(lowerText, activeMission, kingStrings)) {
          return;
        }

        // Mission acceptance handler
        if (handleMissionAcceptance(lowerText)) {
          return;
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
            clearTextarea();
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
        } else if (/\b(hi|hello|hey|greetings|good day)\b/.test(lowerText)) {
          kingResponse = 'I greet thee, my loyal subject.';
          kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
        } else {
          // Check transcript responses before falling back to confusion
          const transcriptResponse = await getKingTibianusResponse(text, playerName);
          if (transcriptResponse !== null) {
            // If we got a meaningful transcript response, use it
            kingResponse = transcriptResponse;
          } else {
            // Fall back to confusion responses for truly unrecognized input
            kingResponse = getRandomConfusionResponse();
          }
          kingChatState.missionOffered = false;
          kingChatState.offeredMission = null;
        }
        
        // Queue response with cooldown
        const isBye = text.toLowerCase().includes('bye');
        tibianusCooldown.queueResponse(
          text,
          kingResponse,
          addMessageToConversation,
          'King Tibianus',
          isBye ? () => ModalHelpers.closeModal(1000) : null
        );
        
        // Clear input
        clearTextarea();
        
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

  // Shared inventory check functions for both King Tibianus and Al Dee handlers
  async function hasLightShovelInInventory() {
    try {
      const items = await getQuestItems(false);
      return (items && items['Light Shovel'] > 0);
    } catch (error) {
      console.error('[Quests Mod] Error checking Light Shovel in inventory:', error);
      return false;
    }
  }

  async function hasElvenhairRopeInInventory() {
    try {
      const items = await getQuestItems(false);
      return (items && items['Elvenhair Rope'] > 0);
    } catch (error) {
      console.error('[Quests Mod] Error checking Elvenhair Rope in inventory:', error);
      return false;
    }
  }

  // Migration function to convert old Dwarven Pickaxe to Light Shovel
  async function migrateDwarvenPickaxeToLightShovel() {
    try {
      console.log('[Quests Mod] Checking for Dwarven Pickaxe migration...');
      const items = await getQuestItems(false);

      if (items && items['Dwarven Pickaxe'] > 0) {
        console.log('[Quests Mod] Found Dwarven Pickaxe, migrating to Light Shovel...');

        // Consume the old Dwarven Pickaxe
        await consumeQuestItem('Dwarven Pickaxe', items['Dwarven Pickaxe']);

        // Add the new Light Shovel
        await addQuestItem('Light Shovel', items['Dwarven Pickaxe']);

        console.log('[Quests Mod] Successfully migrated', items['Dwarven Pickaxe'], 'Dwarven Pickaxe to Light Shovel');
      } else {
        console.log('[Quests Mod] No Dwarven Pickaxe found, no migration needed');
      }
    } catch (error) {
      console.error('[Quests Mod] Error during Dwarven Pickaxe migration:', error);
    }
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

      // Create cooldown manager for Al Dee conversation
      const alDeeCooldown = createNPCCooldownManager(1000);

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

        // Clear any pending response timeout
        alDeeCooldown.clearPendingResponse();

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

              // Queue response with cooldown
              alDeeCooldown.queueResponse(
                text,
                'Ah, finally! The king\'s stamped letter. Thank you for delivering it, ' + playerName + '. Here\'s 50 guild coins as a reward for your service.',
                addMessageToConversation,
                'Al Dee'
              );

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

              // Award Light Shovel
              try {
                await addQuestItem('Light Shovel', 1);
                showQuestItemNotification('Light Shovel', 1);
                console.log('[Quests Mod][Al Dee] Awarded Light Shovel for axe return');
              } catch (error) {
                console.error('[Quests Mod][Al Dee] Error awarding Light Shovel:', error);
              }

              // Mark mission as completed
              setMissionProgress(AL_DEE_FISHING_MISSION, { accepted: true, completed: true });
              console.log('[Quests Mod][Al Dee] Fishing mission completed');

              // Save progress to Firebase
              if (playerName) {
                // Fetch existing progress to preserve mornenion field
                const existingProgress = await getKingTibianusProgress(playerName);
                await saveKingTibianusProgress(playerName, {
                  copper: kingChatState.progressCopper,
                  dragon: kingChatState.progressDragon,
                  letter: kingChatState.progressLetter,
                  alDeeFishing: kingChatState.progressAlDeeFishing,
                  mornenion: existingProgress.mornenion || { defeated: false } // Preserve Mornenion defeat status
                });
                console.log('[Quests Mod][Al Dee] Fishing mission progress saved to Firebase');
              }

              // Update guild coin display
              updateGuildCoinDisplay();

              // Queue response with cooldown
              alDeeCooldown.queueResponse(
                text,
                AL_DEE_FISHING_MISSION.complete.replace('Player', playerName),
                addMessageToConversation,
                'Al Dee'
              );

              return; // Exit early, don't show regular transcript response
            } else if (alDeeChatState.awaitingAxeConfirm) {
              // Player said yes but has no Small Axe
              alDeeCooldown.queueResponse(
                text,
                AL_DEE_FISHING_MISSION.missingItem,
                addMessageToConversation,
                'Al Dee'
              );

              alDeeChatState.awaitingAxeConfirm = false;
              return;
            }
          } catch (error) {
            console.error('[Quests Mod][Al Dee] Error handling fishing mission:', error);
          }
        }

        // Handle golden rope mission completion
          // Check for "yes" when awaiting rope confirmation (must be checked before other "yes" handlers)
          if (lowerText.includes('yes') && alDeeChatState.awaitingRopeConfirm) {
            try {
              // Player claims to have the elvenhair rope
              const currentProducts = await getQuestItems();
              const hasRope = (currentProducts['Elvenhair Rope'] || 0) > 0;

              if (hasRope) {
                // Verify that Mornenion was defeated before allowing completion
                const mornenionDefeated = await isMornenionDefeated();
                if (!mornenionDefeated) {
                  console.log('[Quests Mod][Al Dee] Player has rope but Mornenion not defeated');
                  alDeeCooldown.queueResponse(
                    text,
                    'You have the rope, but you must first defeat Mornenion in the depths below!',
                    addMessageToConversation,
                    'Al Dee'
                  );
                  alDeeChatState.awaitingRopeConfirm = false;
                  return;
                }

                console.log('[Quests Mod][Al Dee] Elvenhair rope returned, consuming from inventory');

                // Consume elvenhair rope from inventory
                try {
                  await consumeQuestItem('Elvenhair Rope', 1);
                  console.log('[Quests Mod][Al Dee] Elvenhair rope consumed from inventory');
                } catch (error) {
                  console.error('[Quests Mod][Al Dee] Error consuming elvenhair rope:', error);
                }

                // Award The Holy Tible as reward
                try {
                  await addQuestItem('The Holy Tible', 1);
                  showQuestItemNotification('The Holy Tible', 1);
                  console.log('[Quests Mod][Al Dee] Awarded The Holy Tible for golden rope mission completion');
                } catch (error) {
                  console.error('[Quests Mod][Al Dee] Error awarding The Holy Tible:', error);
                }

                // Mark mission as completed
                setMissionProgress(AL_DEE_GOLDEN_ROPE_MISSION, { accepted: true, completed: true });
                console.log('[Quests Mod][Al Dee] Golden rope mission completed');

                // Save progress to Firebase using registry (future-proof)
                if (playerName) {
                  // Fetch existing progress to preserve mornenion field
                  const existingProgress = await getKingTibianusProgress(playerName);
                  const allProgress = getAllMissionProgress();
                  
                  // Include ironOre if it exists in fishingState
                  if (fishingState.ironOreQuestActive !== undefined || fishingState.ironOreQuestCompleted) {
                    allProgress.ironOre = {
                      active: fishingState.ironOreQuestActive || false,
                      startTime: fishingState.ironOreQuestStartTime || null,
                      completed: fishingState.ironOreQuestCompleted || false
                    };
                  }
                  
                  // Set Mornenion as defeated when golden rope mission is completed
                  // (completing this mission means Mornenion was defeated to obtain the rope)
                  allProgress.mornenion = { defeated: true };
                  console.log('[Quests Mod][Al Dee] Mornenion marked as defeated - golden rope mission completed');
                  
                  await saveKingTibianusProgress(playerName, allProgress);
                  console.log('[Quests Mod][Al Dee] Golden rope mission progress saved to Firebase');
                }

                // Update guild coin display
                updateGuildCoinDisplay();

                // Queue response with cooldown
                alDeeCooldown.queueResponse(
                  text,
                  AL_DEE_GOLDEN_ROPE_MISSION.complete.replace('Player', playerName),
                  addMessageToConversation,
                  'Al Dee'
                );

                alDeeChatState.awaitingRopeConfirm = false;
                return; // Exit early, don't show regular transcript response
              } else {
                // Player said yes but has no elvenhair rope
                alDeeCooldown.queueResponse(
                  text,
                  AL_DEE_GOLDEN_ROPE_MISSION.missingItem,
                  addMessageToConversation,
                  'Al Dee'
                );

                alDeeChatState.awaitingRopeConfirm = false;
                return;
              }
            } catch (error) {
              console.error('[Quests Mod][Al Dee] Error handling golden rope mission:', error);
            }
          }

        // Check for mission acceptance
        if (lowerText.includes('yes') && alDeeChatState.offeringFishingMission) {
          // Start the fishing mission
          setMissionProgress(AL_DEE_FISHING_MISSION, { accepted: true, completed: false });
          
          // Queue response with cooldown
          alDeeCooldown.queueResponse(
            text,
            AL_DEE_FISHING_MISSION.accept,
            addMessageToConversation,
            'Al Dee'
          );

          alDeeChatState.offeringFishingMission = false;

          // Save progress
          if (playerName) {
            await saveKingTibianusProgress(playerName, {
              copper: kingChatState.progressCopper,
              dragon: kingChatState.progressDragon,
              letter: kingChatState.progressLetter,
              alDeeFishing: kingChatState.progressAlDeeFishing,
              alDeeGoldenRope: kingChatState.progressAlDeeGoldenRope
            });
            console.log('[Quests Mod][Al Dee] Fishing mission accepted, progress saved to Firebase');
          }

          return;
        }

        // Check for golden rope mission acceptance
        if (lowerText.includes('yes') && alDeeChatState.offeringRopeMission) {
          // Start the golden rope mission
          setMissionProgress(AL_DEE_GOLDEN_ROPE_MISSION, { accepted: true, completed: false });
          
          // Queue response with cooldown
          alDeeCooldown.queueResponse(
            text,
            AL_DEE_GOLDEN_ROPE_MISSION.accept,
            addMessageToConversation,
            'Al Dee'
          );

          alDeeChatState.offeringRopeMission = false;

          // Save progress - fetch current progress first to preserve all fields, then merge
          if (playerName) {
            try {
              const currentProgress = await getKingTibianusProgress(playerName);
              await saveKingTibianusProgress(playerName, {
                copper: kingChatState.progressCopper,
                dragon: kingChatState.progressDragon,
                letter: kingChatState.progressLetter,
                alDeeFishing: kingChatState.progressAlDeeFishing,
                alDeeGoldenRope: kingChatState.progressAlDeeGoldenRope, // This should now have accepted: true
                mornenion: currentProgress.mornenion || { defeated: false } // Preserve Mornenion defeat status
              });
              console.log('[Quests Mod][Al Dee] Golden rope mission accepted, progress saved to Firebase', {
                saved: {
                  alDeeGoldenRope: kingChatState.progressAlDeeGoldenRope
                },
                currentProgress: currentProgress
              });
            } catch (error) {
              console.error('[Quests Mod][Al Dee] Error saving golden rope mission progress:', error);
            }
          }

          return;
        }

        // Check for golden rope mission keywords (rope/elvenhair rope)
        // If mission is active, player has rope, and Mornenion is defeated, ask if they want to return it
        if ((lowerText.includes('elvenhair rope') || lowerText.includes('rope')) && 
            !lowerText.includes('yes') && !alDeeChatState.awaitingRopeConfirm) {
          try {
            const missionProgress = getMissionProgress(AL_DEE_GOLDEN_ROPE_MISSION);
            // Only handle if mission is accepted but not completed
            if (missionProgress.accepted && !missionProgress.completed) {
              const currentProducts = await getQuestItems();
              const hasRope = (currentProducts['Elvenhair Rope'] || 0) > 0;
              
              if (hasRope) {
                const mornenionDefeated = await isMornenionDefeated();
                // If player has the rope, they must have defeated Mornenion (rope is only obtained from victory)
                // So we can proceed to ask if they want to return it
                // However, we still verify the flag is set for proper quest tracking
                if (mornenionDefeated) {
                  // Ask if they want to return the rope
                  alDeeChatState.awaitingRopeConfirm = true;
                  alDeeCooldown.queueResponse(
                    text,
                    AL_DEE_GOLDEN_ROPE_MISSION.askForItem.replace('Player', playerName),
                    addMessageToConversation,
                    'Al Dee'
                  );
                  return; // Exit early, don't show regular transcript response
                } else {
                  // Player has rope but flag not set - this shouldn't happen normally
                  // But if it does (e.g., dev command), set the flag and proceed
                  console.warn('[Quests Mod][Al Dee] Player has rope but Mornenion flag not set - setting flag and proceeding');
                  const playerNameForFlag = getCurrentPlayerName();
                  if (playerNameForFlag) {
                    try {
                      const existingProgress = await getKingTibianusProgress(playerNameForFlag);
                      const mergedProgress = {
                        ...existingProgress,
                        mornenion: {
                          defeated: true
                        }
                      };
                      await saveKingTibianusProgress(playerNameForFlag, mergedProgress);
                      console.log('[Quests Mod][Al Dee] Mornenion defeated flag set retroactively');
                    } catch (error) {
                      console.error('[Quests Mod][Al Dee] Error setting Mornenion flag:', error);
                    }
                  }
                  // Now ask if they want to return the rope
                  alDeeChatState.awaitingRopeConfirm = true;
                  alDeeCooldown.queueResponse(
                    text,
                    AL_DEE_GOLDEN_ROPE_MISSION.askForItem.replace('Player', playerName),
                    addMessageToConversation,
                    'Al Dee'
                  );
                  return; // Exit early, don't show regular transcript response
                }
              }
            }
          } catch (error) {
            console.error('[Quests Mod][Al Dee] Error handling rope keyword:', error);
          }
        }

        // Check for mission offer trigger
        if (lowerText.includes('mission') || lowerText.includes('missions') ||
            lowerText.includes('task') || lowerText.includes('quest') || lowerText.includes('help')) {
          // Al Dee's missions only (can be expanded in the future)
          const AL_DEE_MISSIONS = [AL_DEE_FISHING_MISSION, AL_DEE_GOLDEN_ROPE_MISSION];

          async function currentAlDeeMission() {
            // Return the first incomplete mission, or null if all are completed
            for (const mission of AL_DEE_MISSIONS) {
              // Check prerequisites for golden rope mission
              if (mission.id === AL_DEE_GOLDEN_ROPE_MISSION.id) {
                // Must have completed fishing mission AND have Light Shovel
                if (!kingChatState.progressAlDeeFishing.completed) {
                  continue; // Skip this mission if fishing mission not completed
                }
                const hasShovel = await hasLightShovelInInventory();
                if (!hasShovel) {
                  continue; // Skip this mission if no Light Shovel
                }
              }

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

          const activeMission = await currentAlDeeMission();
          const strings = buildAlDeeStrings(activeMission);

          let responseText = '';
          if (!activeMission) {
            // All Al Dee missions completed
            responseText = strings.missionPrompt;
          } else {
            const missionProgress = getMissionProgress(activeMission);

            if (missionProgress.accepted) {
              responseText = strings.missionActive;
            } else {
              // Offer the mission
              responseText = strings.missionPrompt;

              // Set appropriate offering flag based on mission
              if (activeMission.id === AL_DEE_FISHING_MISSION.id) {
                alDeeChatState.offeringFishingMission = true;
              } else if (activeMission.id === AL_DEE_GOLDEN_ROPE_MISSION.id) {
                alDeeChatState.offeringRopeMission = true;
              }
            }
          }

          // Queue response with cooldown
          alDeeCooldown.queueResponse(
            text,
            responseText,
            addMessageToConversation,
            'Al Dee'
          );

          return;
        }

        // Get transcript response (handles all standard Al Dee dialogue)
        let alDeeResponse = getAlDeeResponse(text, playerName);

        // Only use confusion response for messages that are truly nonsensical
        // The default greeting response should be preserved for unrecognized but reasonable messages
        // Confusion should only be used for messages that don't make any sense in context

        // Check if this is a bye message to close the modal
        const isBye = lowerText.includes('bye');
        
        // Queue response with cooldown
        alDeeCooldown.queueResponse(
          text,
          alDeeResponse,
          addMessageToConversation,
          'Al Dee',
          isBye ? () => ModalHelpers.closeModal(1000) : null
        );
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

      function closeDialogWithFallback(delayMs = 0) {
        ModalHelpers.closeModal(delayMs);
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
          guildCoinAmountSpan.textContent = Number.isFinite(amount) ? amount.toLocaleString('en-US') : '?';
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

    // Check if title says "Quest Log"
    const dialog = footer.closest('div[role="dialog"]');
    const titleElement = dialog?.querySelector('.widget-top-text, .widget-top');
    const hasQuestLogTitle = titleElement?.textContent?.trim().includes('Quest Log');

    let missionsButton = document.getElementById(KING_MISSIONS_BUTTON_ID);
    
    // Remove button if it exists but title doesn't match
    if (missionsButton && !hasQuestLogTitle) {
      missionsButton.remove();
      missionsToggleButton = null;
      return;
    }

    // Only add button if title says "Quest Log"
    if (!hasQuestLogTitle) {
      return;
    }
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

  // Helper functions for mission progress (wrappers around MissionManager)
  // Note: MissionManager is defined earlier in the file - these functions delegate to it
  // Keeping function declarations here for backward compatibility and closure access
  function getMissionProgress(mission) {
    return MissionManager.getProgress(mission);
  }

  function setMissionProgress(mission, progress) {
    MissionManager.setProgress(mission, progress);
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
        'al_dee_fishing_gold': 'progressAlDeeFishing',
        'al_dee_golden_rope': 'progressAlDeeGoldenRope'
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
        alDeeFishing: kingChatState.progressAlDeeFishing,
        alDeeGoldenRope: kingChatState.progressAlDeeGoldenRope
      };

      await saveKingTibianusProgress(playerName, progress);
      console.log('[Quests Mod][Dev] Quest reset saved to Firebase for', missionId);

      // If resetting golden rope quest and it's not accepted/completed, remove Elvenhair Rope from inventory
      if (missionId === 'al_dee_golden_rope') {
        const goldenRopeProgress = kingChatState.progressAlDeeGoldenRope;
        if (!goldenRopeProgress.accepted && !goldenRopeProgress.completed) {
          // Get current quest items to check if player has Elvenhair Rope
          const questItems = await getQuestItems(false);
          const elvenhairRopeCount = questItems['Elvenhair Rope'] || 0;
          if (elvenhairRopeCount > 0) {
            // Remove all Elvenhair Rope from inventory
            await consumeQuestItem('Elvenhair Rope', elvenhairRopeCount);
            console.log('[Quests Mod][Dev] Removed Elvenhair Rope from inventory (count:', elvenhairRopeCount, ')');
          }
        }
      }

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
      kingChatState.progressAlDeeGoldenRope = { accepted: false, completed: false };
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
        updateTile79RightClickState(boardContext);
      });
      console.log('[Quests Mod][Tile 79] Board subscription set up');
    }

    // Subscribe to player state changes to detect inventory changes (Stamped Letter)
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player && globalThis.state.player.subscribe) {
      tile79PlayerSubscription = globalThis.state.player.subscribe((playerState) => {
        updateTile79RightClickState();
      });
      console.log('[Quests Mod][Tile 79] Player subscription set up');
    }

    // Initial check when subscriptions are set up
    setTimeout(() => {
      updateTile79RightClickState();
    }, 500);

    console.log('[Quests Mod][Tile 79] Event-driven subscriptions set up');
    console.log('[Quests Mod][Tile 79] Will respond to: room changes (board state) and inventory changes (player state)');
  }

  // Start MutationObserver for continuous cleanup in Ab'Dendriel area
  function startAbDendrielMutationObserver() {
    // Clean up existing observer first to ensure fresh state
    if (abDendrielMutationObserver) {
      stopAbDendrielMutationObserver();
    }

    abDendrielMutationObserver = new MutationObserver((mutations) => {
      let needsCleanup = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for quest overlays
            if (node.textContent && node.textContent.includes('Ab\'Dendriel') && node.textContent.includes('Monsters')) {
              needsCleanup = true;
            }
            // Check for game mode selector buttons
            if (node.querySelector && node.querySelector('img[alt="Sandbox"], img[alt="Manual"], img[alt="Autoplay"]')) {
              needsCleanup = true;
            }
            // Check within added element for these elements
            const questOverlays = node.querySelectorAll ? node.querySelectorAll('*') : [];
            questOverlays.forEach(el => {
              if (el.textContent && el.textContent.includes('Ab\'Dendriel') && el.textContent.includes('Monsters')) {
                needsCleanup = true;
              }
            });
          }
        });
      });

      if (needsCleanup) {
        console.log('[Quests Mod][Overlay Hider] MutationObserver detected new elements - cleaning up');
        hideQuestOverlays();
        hideHeroEditorButton();

        // Re-hide game mode selector buttons
        const modeButtons = document.querySelectorAll('button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]');
        modeButtons.forEach(button => {
          const btn = button.closest('button');
          if (btn) {
            btn.style.display = 'none';
          }
        });
      }
    });

    abDendrielMutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Quests Mod][Overlay Hider] MutationObserver started for Ab\'Dendriel area');
  }

  // Start game timer subscription for sandbox mode battle detection
  function startGameTimerSubscription() {
    // Clean up existing subscription first to ensure fresh state
    if (gameTimerSubscription) {
      stopGameTimerSubscription();
    }

    gameTimerSubscription = globalThis.state.gameTimer.subscribe((timerState) => {
      const { state } = timerState.context;

      // Check if battle just completed (state changed from 'initial' to victory/defeat)
      if (state !== 'initial') {
        // Only perform villain cleanup if we're in Ab'Dendriel area
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentRoomId = getCurrentRoomId(boardContext);
        const roomNames = globalThis.state?.utils?.ROOM_NAME;
        const currentRoomName = roomNames?.[currentRoomId];

        if (!(currentRoomName && currentRoomName.toLowerCase().includes('ab\'dendriel') && playerUsedHoleToAbDendriel)) {
          // Not in Ab'Dendriel area or didn't use the hole - skip villain cleanup
          return;
        }

        console.log('[Quests Mod][Overlay Hider] Battle completed in Ab\'Dendriel area - ensuring proper board state');

        // Ensure Mornenion is still on the board and original villains are removed after battle
        const boardConfig = boardContext.boardConfig || [];

        // Skip cleanup if board is empty (fresh entry state)
        if (boardConfig.length === 0) {
          console.log('[Quests Mod][Overlay Hider] Board is empty after battle - skipping cleanup (fresh entry)');
          return;
        }

        let needsUpdate = false;
        const updatedConfig = [...boardConfig];

        // Check if Mornenion exists
        const mornenionExists = updatedConfig.some(entity =>
          entity.key && entity.key.startsWith('mornenion-tile-19-')
        );

        // Only add if missing and not currently adding (prevent rapid re-additions)
        // Also check if player actually used hole to Mornenion (battle should be initialized)
        const now = Date.now();
        const timeSinceLastAdd = now - lastVillainAddTime;
        if (!mornenionExists && !isAddingVillains && timeSinceLastAdd > 500 && playerUsedHoleToMornenion && mornenionBattle) {
          console.log('[Quests Mod][Overlay Hider] Mornenion missing after battle - re-adding');
          isAddingVillains = true;
          lastVillainAddTime = now;
          
          // Add Mornenion back by calling the function that handles this
          setTimeout(() => {
            addSpecificVillains();
            // Reset flag after a delay
            setTimeout(() => {
              isAddingVillains = false;
            }, 300);
          }, 100);
          return; // Skip the rest of this cycle since board state changed
        } else if (!mornenionExists && (isAddingVillains || timeSinceLastAdd <= 500)) {
          // Silently skip if already adding or too soon
          return;
        }

        // Only filter if we detect original villains that shouldn't be there
        const hasOriginalVillains = updatedConfig.some(entity => 
          entity.type === 'file' && entity.villain === true &&
          !(entity.key && (entity.key.startsWith('mornenion-tile-19-') || entity.key.startsWith('lavahole-tile-')))
        );

        if (hasOriginalVillains) {
          console.log('[Quests Mod][Overlay Hider] Detected original villains after battle - filtering them out');
          
          // Remove any original villains that reappeared (like the Wasp)
          const filteredConfig = updatedConfig.filter(entity => {
            // Keep Mornenion and Lavaholes
            if (entity.key && (entity.key.startsWith('mornenion-tile-19-') || entity.key.startsWith('lavahole-tile-'))) {
              return true;
            }
            // Keep custom entities that are allies (our Lavaholes)
            if (entity.type === 'custom' && entity.villain === false && entity.gameId === 70) {
              return true;
            }
            // Remove original file-based entities that are villains (like the Wasp)
            if (entity.type === 'file' && entity.villain === true) {
              console.log('[Quests Mod][Overlay Hider] Removing reappeared villain after battle:', entity.key);
              needsUpdate = true;
              return false;
            }
            // Keep everything else (allies, etc.)
            return true;
          });

          if (needsUpdate) {
            globalThis.state.board.send({
              type: 'setState',
              fn: (prev) => ({
                ...prev,
                boardConfig: filteredConfig
              })
            });
          }
        }
      }
    });

    console.log('[Quests Mod][Overlay Hider] GameTimer subscription started');
  }

  // Stop game timer subscription
  function stopGameTimerSubscription() {
    if (gameTimerSubscription) {
      console.log('[Quests Mod][Overlay Hider] Stopping GameTimer subscription');
      gameTimerSubscription.unsubscribe();
      gameTimerSubscription = null;
    }
  }

  // Stop MutationObserver when leaving Ab'Dendriel area
  function stopAbDendrielMutationObserver() {
    if (abDendrielMutationObserver) {
      console.log('[Quests Mod][Overlay Hider] Stopping MutationObserver');
      abDendrielMutationObserver.disconnect();
      abDendrielMutationObserver = null;
    }
  }

  // Set up quest overlay hider to hide quest overlays in specific areas
  function setupQuestOverlayHider() {
    if (questOverlayHider) return;

    // Subscribe to board state changes to detect room/map changes
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      questOverlayHider = globalThis.state.board.subscribe(({ context: boardContext }) => {
        try {
          const currentRoomId = getCurrentRoomId(boardContext);
          const roomNames = globalThis.state?.utils?.ROOM_NAME;
          const currentRoomName = roomNames?.[currentRoomId];

          // Get current board config
          const boardConfig = boardContext.boardConfig || [];

          // Check if battle has started (serverResults present) and we're in Ab'Dendriel area - re-cleanup
          if (boardContext.serverResults && playerUsedHoleToAbDendriel && currentRoomName && currentRoomName.toLowerCase().includes('ab\'dendriel')) {
            console.log('[Quests Mod][Overlay Hider] Battle started in Ab\'Dendriel area - re-hiding overlays and cleaning up');
            hideQuestOverlays();
            removeVillainsFromBoard();
            // Hide Hero Editor button
            hideHeroEditorButton();

            // Re-hide game mode selector buttons
            const modeButtons = document.querySelectorAll('button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]');
            modeButtons.forEach(button => {
              const btn = button.closest('button');
              if (btn) {
                btn.style.display = 'none';
              }
            });
            console.log('[Quests Mod][Overlay Hider] Re-hidden game mode selector buttons after battle start');
          }

          // Check if we're leaving Ab'Dendriel area
          if (currentRoomName && !currentRoomName.toLowerCase().includes('ab\'dendriel') && currentlyInAbDendriel) {
            console.log('[Quests Mod][Overlay Hider] Leaving Ab\'Dendriel area - resetting state');
            currentlyInAbDendriel = false;
            stopAbDendrielMutationObserver();
            stopGameTimerSubscription();
            overlayHidingDone = false;
            villainSetupDone = false;
          }

          // Check if we're in Ab'Dendriel Hive or related areas
          if (currentRoomName && currentRoomName.toLowerCase().includes('ab\'dendriel') && playerUsedHoleToAbDendriel) {
            // Initialize Mornenion battle if not already initialized (called when quest triggers)
            // Note: Battle is usually initialized in mining handler before navigation, but this is a fallback
            if (!mornenionBattle && playerUsedHoleToMornenion) {
              console.log('[Quests Mod][Overlay Hider] Initializing Mornenion battle (fallback - should already be initialized)');
              const initResult = initializeMornenionBattle();
              if (initResult && initResult.then) {
                // Async initialization - CustomBattles not ready yet, wait for it
                initResult.then((battle) => {
                  if (battle) {
                    mornenionBattle = battle;
                    mornenionBattle.setup(
                      () => playerUsedHoleToMornenion,
                      (toastData) => {
                        showToast({ 
                          message: toastData.message, 
                          duration: toastData.duration || 3000, 
                          logPrefix: '[Quests Mod][Mornenion]' 
                        });
                      }
                    );
                    setupMornenionTileRestrictions();
                    console.log('[Quests Mod][Overlay Hider] Mornenion battle initialized successfully');
                  } else {
                    console.error('[Quests Mod][Overlay Hider] Failed to initialize Mornenion battle after waiting');
                  }
                }).catch((error) => {
                  console.error('[Quests Mod][Overlay Hider] Error initializing Mornenion battle:', error);
                });
              } else if (initResult) {
                // Synchronous initialization - CustomBattles was ready immediately
                mornenionBattle = initResult;
                mornenionBattle.setup(
                  () => playerUsedHoleToMornenion,
                  (toastData) => {
                    showToast({ 
                      message: toastData.message, 
                      duration: toastData.duration || 3000, 
                      logPrefix: '[Quests Mod][Mornenion]' 
                    });
                  }
                );
                setupMornenionTileRestrictions();
                console.log('[Quests Mod][Overlay Hider] Mornenion battle initialized successfully');
              } else {
                console.error('[Quests Mod][Overlay Hider] Failed to initialize Mornenion battle - CustomBattles not available');
              }
            }
            
            // We're entering/staying in Ab'Dendriel area
            // Reset flags when transitioning into the area (entering for the first time)
            if (!currentlyInAbDendriel) {
              console.log('[Quests Mod][Overlay Hider] Entering Ab\'Dendriel area via hole - resetting flags and setting up special mode');
              currentlyInAbDendriel = true;
              // Reset flags to ensure fresh initialization
              overlayHidingDone = false;
              villainSetupDone = false;
              isAddingVillains = false;
              lastVillainAddTime = 0;
              justRemovedVillains = false;
              
              // Start MutationObserver for continuous cleanup (only once when entering)
              startAbDendrielMutationObserver();
              // Start game timer subscription for sandbox battle detection (only once when entering)
              startGameTimerSubscription();
              // Hide Hero Editor button when entering hole area (only once when entering)
              hideHeroEditorButton();
            }

            // Only log and perform setup once per session
            if (!overlayHidingDone || !villainSetupDone) {
              console.log('[Quests Mod][Overlay Hider] In Ab\'Dendriel area via hole - hiding overlays and removing villains');
            }
            // Look for and hide quest overlay elements (only once per session)
            if (!overlayHidingDone) {
              hideQuestOverlays();
              overlayHidingDone = true;
            }
            // Remove all villains from the board (only once per session)
            if (!villainSetupDone) {
              removeVillainsFromBoard();
              villainSetupDone = true;
              // Set flag to skip Mornenion check immediately after removal
              justRemovedVillains = true;
              // Add villains immediately after removal (don't wait for subscription check)
              isAddingVillains = true;
              lastVillainAddTime = Date.now();
              setTimeout(() => {
                addSpecificVillains();
                // Reset flags after a delay to allow board state to fully update
                setTimeout(() => {
                  isAddingVillains = false;
                  justRemovedVillains = false;
                }, 500); // Longer delay to prevent refresh loop
              }, 50); // Very short delay to allow board state to settle
            }

            // Ensure Mornenion stays on the board and original villains stay removed throughout the session
            // Skip check immediately after removing villains to prevent refresh loop
            if (!justRemovedVillains && !isAddingVillains) {
              // Check if Mornenion and Elves already exist BEFORE attempting to add
              const mornenionExists = boardConfig.some(entity =>
                entity.key && entity.key.startsWith('mornenion-tile-19-')
              );
              
              const elvesExist = [2, 11, 137, 146].every(tileIndex =>
                boardConfig.some(entity =>
                  entity.key && entity.key.startsWith(`elf-tile-${tileIndex}-`)
                )
              );
              
              // If all creatures are already correctly placed, skip entirely
              if (mornenionExists && elvesExist) {
                // Creatures are already present, no need to do anything
                return;
              }
              
              // Only check if we're not currently adding villains and enough time has passed since last attempt
              const now = Date.now();
              const timeSinceLastAdd = now - lastVillainAddTime;
              
              // Consistent debounce delay for all entries
              const minDelay = 300;
              
              // Only add if Mornenion is missing AND enough time has passed since last attempt
              if (!mornenionExists && timeSinceLastAdd > minDelay) {
                isAddingVillains = true;
                lastVillainAddTime = now;
                
                // Use setTimeout to allow board state to settle before checking again
                setTimeout(() => {
                  addSpecificVillains();
                  // Reset flag after a longer delay to allow board state to fully update
                  setTimeout(() => {
                    isAddingVillains = false;
                  }, 500);
                }, 100);
              }
              // Silently skip if too soon since last attempt or if already adding
            }

            // Only filter if board is not empty and we detect original villains that shouldn't be there
            if (boardConfig.length > 0) {
              // Check if there are any original file-based villains that need to be removed
              const hasOriginalVillains = boardConfig.some(entity => 
                entity.type === 'file' && entity.villain === true &&
                !(entity.key && (entity.key.startsWith('mornenion-tile-19-') || entity.key.startsWith('lavahole-tile-')))
              );

              // Only filter if we detect original villains that shouldn't be there
              if (hasOriginalVillains) {
                // Remove any original villains that shouldn't be there (like the Wasp)
                const filteredConfig = boardConfig.filter(entity => {
                  // Keep Mornenion and Lavaholes
                  if (entity.key && (entity.key.startsWith('mornenion-tile-19-') || entity.key.startsWith('lavahole-tile-'))) {
                    return true;
                  }
                  // Keep custom entities that are allies (our Lavaholes)
                  if (entity.type === 'custom' && entity.villain === false && entity.gameId === 70) {
                    return true;
                  }
                  // Remove original file-based entities that are villains (like the Wasp)
                  if (entity.type === 'file' && entity.villain === true) {
                    return false;
                  }
                  // Keep everything else (allies, etc.)
                  return true;
                });

                // Update board config if we filtered anything out
                if (filteredConfig.length !== boardConfig.length) {
                  globalThis.state.board.send({
                    type: 'setState',
                    fn: (prev) => ({
                      ...prev,
                      boardConfig: filteredConfig
                    })
                  });
                }
              }
            }
          } else if (currentRoomName && currentRoomName.toLowerCase().includes('ab\'dendriel') && !playerUsedHoleToAbDendriel) {
            console.log('[Quests Mod][Overlay Hider] In Ab\'Dendriel area manually - NOT applying special mode');
            // Don't hide overlays or remove villains for manual navigation
          } else {
            // We're leaving Ab'Dendriel area (or were never in it)
            if (currentlyInAbDendriel) {
              console.log('[Quests Mod][Overlay Hider] Leaving Ab\'Dendriel area, restoring original board setup');
              // Stop MutationObserver when leaving
              stopAbDendrielMutationObserver();
              // Stop game timer subscription when leaving
              stopGameTimerSubscription();
              // Show Hero Editor button when leaving hole area
              showHeroEditorButton();
              // Cleanup all Mornenion quest state (includes restoreBoardSetup and showQuestOverlays)
              cleanupMornenionQuest();
              // Reset the flags when leaving
              playerUsedHoleToAbDendriel = false;
              villainSetupDone = false;
              overlayHidingDone = false;
              currentlyInAbDendriel = false;
              // Reset villain addition flag
              isAddingVillains = false;
              lastVillainAddTime = 0;
              // Reset just removed flag
              justRemovedVillains = false;
            }
            // If we were never in Ab'Dendriel, do nothing
          }
        } catch (error) {
          console.error('[Quests Mod][Overlay Hider] Error checking room:', error);
        }
      });
      console.log('[Quests Mod][Overlay Hider] Quest overlay hider set up');
    }
  }

  function hideQuestOverlays() {
    // Look for elements with the classes from the HTML example
    const overlays = document.querySelectorAll('.pointer-events-none.absolute.right-0.top-0.z-1');
    overlays.forEach((overlay) => {
      if (overlay.textContent.includes('Ab\'Dendriel') || overlay.textContent.includes('Monsters')) {
        overlay.style.display = 'none';
      }
    });

    // Alternative: look for elements containing the specific text
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      if (element.textContent &&
          element.textContent.includes('Ab\'Dendriel') &&
          element.textContent.includes('Monsters') &&
          element.classList.contains('absolute')) {
        element.style.display = 'none';
      }
    });

    // Hide the floor selector UI (the vertical floor slider)
    const floorContainers = document.querySelectorAll('.absolute.right-0.z-3');
    floorContainers.forEach((container) => {
      const hasFloorImages = container.querySelector('img[alt="Floor"]');
      const hasRangeInput = container.querySelector('input[type="range"]');
      const hasDataFloor = container.querySelector('[data-floor]');

      if (hasFloorImages || hasRangeInput || hasDataFloor) {
        container.style.display = 'none';
      }
    });

    // Also try the specific data attribute approach as fallback
    const dataFloorSelectors = document.querySelectorAll('[data-floor]');
    dataFloorSelectors.forEach((selector) => {
      const parentContainer = selector.closest('.absolute.right-0.z-3');
      if (parentContainer && parentContainer.style.display !== 'none') {
        parentContainer.style.display = 'none';
      }
    });

    // Add a delayed check in case the floor selector appears after initial hiding
    setTimeout(() => {
      const delayedFloorContainers = document.querySelectorAll('.absolute.right-0.z-3');
      delayedFloorContainers.forEach((container) => {
        if (container.style.display !== 'none') {
          const hasFloorImages = container.querySelector('img[alt="Floor"]');
          const hasRangeInput = container.querySelector('input[type="range"]');

          if (hasFloorImages || hasRangeInput) {
            container.style.display = 'none';
          }
        }
      });
    }, 500); // Check again after 500ms

    // Set game mode to sandbox using the Game State API
    setTimeout(() => {
      try {
        globalThis.state.board.send({ type: "setPlayMode", mode: "sandbox" });
        // Hide the mode selector buttons in the UI to prevent user changes during quest events
        const modeButtons = document.querySelectorAll('button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]');
        modeButtons.forEach(button => {
          const btn = button.closest('button');
          if (btn) {
            btn.style.display = 'none';
          }
        });
      } catch (error) {
        console.error('[Quests Mod][Game Mode] Failed to set sandbox mode:', error);
      }
    }, 1000); // Wait 1 second for state to be ready
  }

  function showQuestOverlays() {
    // Restore visibility when leaving the area (if you want this behavior)
    const overlays = document.querySelectorAll('.pointer-events-none.absolute.right-0.top-0.z-1');
    overlays.forEach(overlay => {
      overlay.style.display = '';
    });

    // Restore floor selector visibility
    const floorSelectorContainers = document.querySelectorAll('.absolute.right-0.z-3');
    floorSelectorContainers.forEach(container => {
      container.style.display = '';
    });

    // No need to restore Elf Scout name since we don't modify global metadata anymore
    console.log('[Quests Mod][Villain Adder] Elf Scout global name unchanged (Mornenion was only a villain nickname)');

    // Restore game mode selector when leaving Ab'Dendriel Hive
    try {
      // Show all mode selector buttons
      const modeButtons = document.querySelectorAll('button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]');
      modeButtons.forEach(button => {
        const btn = button.closest('button');
        if (btn) {
          btn.style.display = '';
        }
      });
      console.log('[Quests Mod][Game Mode] Restored game mode selector when leaving Ab\'Dendriel Hive');
    } catch (e) {
      console.warn('[Quests Mod][Game Mode] Error restoring game mode selector:', e);
    }
  }

  // Hide Hero Editor and Team Copier buttons when entering hole area
  function hideHeroEditorButton() {
    try {
      // Try to use exposed function from Hero Editor mod if available
      if (window.heroEditor && typeof window.heroEditor.hideButton === 'function') {
        window.heroEditor.hideButton();
        console.log('[Quests Mod][Hero Editor] Hidden Hero Editor button via mod API');
      } else {
        // Fallback: DOM manipulation for Hero Editor
        const heroButton = document.getElementById('hero-editor-button');
        if (heroButton) {
          heroButton.style.display = 'none';
          console.log('[Quests Mod][Hero Editor] Hidden Hero Editor button via DOM');
        }
      }

      // Try to use exposed function from Team Copier mod if available
      if (window.teamCopier && typeof window.teamCopier.hideButton === 'function') {
        window.teamCopier.hideButton();
        console.log('[Quests Mod][Team Copier] Hidden Team Copier button via mod API');
      } else {
        // Fallback: DOM manipulation for Team Copier
        const teamButton = document.getElementById('team-copier-button');
        if (teamButton) {
          teamButton.style.display = 'none';
          console.log('[Quests Mod][Team Copier] Hidden Team Copier button via DOM');
        }
      }

      // Last resort: try to find by icon
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes('✏️')) {
          btn.style.display = 'none';
          console.log('[Quests Mod][Hero Editor] Hidden Hero Editor button (found by icon)');
        }
        if (btn.textContent && btn.textContent.includes('📋')) {
          btn.style.display = 'none';
          console.log('[Quests Mod][Team Copier] Hidden Team Copier button (found by icon)');
        }
      }
    } catch (error) {
      console.error('[Quests Mod][Hero Editor] Error hiding Hero Editor button:', error);
    }
  }

  // Show Hero Editor and Team Copier buttons when leaving hole area
  function showHeroEditorButton() {
    try {
      // Try to use exposed function from Hero Editor mod if available
      if (window.heroEditor && typeof window.heroEditor.showButton === 'function') {
        window.heroEditor.showButton();
        console.log('[Quests Mod][Hero Editor] Shown Hero Editor button via mod API');
      } else {
        // Fallback: DOM manipulation for Hero Editor
        const heroButton = document.getElementById('hero-editor-button');
        if (heroButton) {
          heroButton.style.display = '';
          console.log('[Quests Mod][Hero Editor] Shown Hero Editor button via DOM');
        }
      }

      // Try to use exposed function from Team Copier mod if available
      if (window.teamCopier && typeof window.teamCopier.showButton === 'function') {
        window.teamCopier.showButton();
        console.log('[Quests Mod][Team Copier] Shown Team Copier button via mod API');
      } else {
        // Fallback: DOM manipulation for Team Copier
        const teamButton = document.getElementById('team-copier-button');
        if (teamButton) {
          teamButton.style.display = '';
          console.log('[Quests Mod][Team Copier] Shown Team Copier button via DOM');
        }
      }

      // Last resort: try to find by icon
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes('✏️')) {
          btn.style.display = '';
          console.log('[Quests Mod][Hero Editor] Shown Hero Editor button (found by icon)');
        }
        if (btn.textContent && btn.textContent.includes('📋')) {
          btn.style.display = '';
          console.log('[Quests Mod][Team Copier] Shown Team Copier button (found by icon)');
        }
      }
    } catch (error) {
      console.error('[Quests Mod][Hero Editor] Error showing Hero Editor button:', error);
    }
  }

  // Restore the original board setup by removing custom villains (delegates to CustomBattle)
  function restoreBoardSetup() {
    if (mornenionBattle) {
      mornenionBattle.restoreBoardSetup();
    } else {
      console.warn('[Quests Mod][Villain Remover] Mornenion battle not initialized');
    }
  }

  // Remove villains from the board (delegates to CustomBattle)
  function removeVillainsFromBoard() {
    if (mornenionBattle) {
      mornenionBattle.removeOriginalVillains();
    } else {
      console.warn('[Quests Mod][Villain Remover] Mornenion battle not initialized');
    }
  }

  // Mornenion area detection
  function isInMornenionArea() {
    if (mornenionBattle) {
      return mornenionBattle.isInBattleArea();
    }
    // Fallback if CustomBattle not initialized
    try {
      const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
      if (!boardContext?.selectedMap) return false;
      const currentRoomId = boardContext.selectedMap.roomId || boardContext.selectedMap.selectedRoom?.id;
      return currentRoomId === 'abwasp';
    } catch (error) {
      console.error('[Quests Mod][Mornenion] Error checking Mornenion area:', error);
      return false;
    }
  }

  // Function to count ally creatures on board
  function countAllyCreatures() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      const boardConfig = boardContext?.boardConfig || [];
      
      const isAlly = (piece) => 
        piece?.type === 'player' || 
        (piece?.type === 'custom' && piece?.villain === false);
      
      return boardConfig.filter(isAlly).length;
    } catch (error) {
      console.error('[Quests Mod][Mornenion] Error counting allies:', error);
      return 0;
    }
  }

  // Function to check if restrictions should be active
  function shouldMornenionAllyLimitBeActive() {
    if (mornenionBattle) {
      return mornenionBattle.shouldRestrictionsBeActive(() => playerUsedHoleToMornenion);
    }
    // Fallback
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      const isSandbox = boardContext?.mode === 'sandbox';
      const inMornenionArea = isInMornenionArea();
      return isSandbox && inMornenionArea && playerUsedHoleToMornenion;
    } catch (error) {
      console.error('[Quests Mod][Mornenion] Error checking limit activation:', error);
      return false;
    }
  }

  // Function to enforce ally creature limit (delegates to CustomBattle)
  function enforceMornenionAllyLimit() {
    if (mornenionBattle) {
      mornenionBattle.enforceAllyLimit(
        () => playerUsedHoleToMornenion,
        (toastData) => {
          // Use existing showToast (ignores 'type' parameter)
          showToast({ 
            message: toastData.message, 
            duration: toastData.duration || 3000, 
            logPrefix: '[Quests Mod][Mornenion]' 
          });
        }
      );
    }
  }

  // Setup ally limit monitoring (delegates to CustomBattle)
  function setupMornenionAllyLimit() {
    if (mornenionBattle) {
      mornenionBattle.setupAllyLimit(
        () => playerUsedHoleToMornenion,
        (toastData) => {
          // Use existing showToast (ignores 'type' parameter)
          showToast({ 
            message: toastData.message, 
            duration: toastData.duration || 3000, 
            logPrefix: '[Quests Mod][Mornenion]' 
          });
        }
      );
    }
  }

  // Function to get creature type name
  function getCreatureTypeName(piece) {
    try {
      if (piece?.gameId && globalThis.state?.utils?.getMonster) {
        const monster = globalThis.state.utils.getMonster(piece.gameId);
        return monster?.metadata?.name || `Monster ID ${piece.gameId}`;
      }
      return piece?.nickname || `Unknown (ID: ${piece?.gameId || 'N/A'})`;
    } catch (error) {
      return piece?.nickname || `Unknown (ID: ${piece?.gameId || 'N/A'})`;
    }
  }

  // Function to check if we should track placements (Mornenion area + sandbox mode + entered via hole)
  function shouldTrackPlacements() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      const isSandbox = boardContext?.mode === 'sandbox';
      const inMornenionArea = isInMornenionArea();
      const enteredViaHole = playerUsedHoleToMornenion;
      // Only track if entered via hole, not manual navigation
      const shouldTrack = isSandbox && inMornenionArea && enteredViaHole;
      
      // Debug logging (only log when conditions change)
      if (shouldTrack && !window._mornenionTrackingWasActive) {
        console.log('[Quests Mod][Creature Placement] Tracking activated:', {
          isSandbox,
          inMornenionArea,
          enteredViaHole,
          roomId: boardContext?.selectedMap?.roomId
        });
        window._mornenionTrackingWasActive = true;
      } else if (!shouldTrack && window._mornenionTrackingWasActive) {
        console.log('[Quests Mod][Creature Placement] Tracking deactivated');
        window._mornenionTrackingWasActive = false;
      }
      
      return shouldTrack;
    } catch (error) {
      console.error('[Quests Mod][Creature Placement] Error checking tracking activation:', error);
      return false;
    }
  }

  // Function to track creature placements (only when in Mornenion quest context)
  function trackCreaturePlacements() {
    if (creaturePlacementSubscription) {
      creaturePlacementSubscription.unsubscribe();
    }

    // Initialize previous board config
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      previousBoardConfig = boardContext?.boardConfig || [];
    } catch (error) {
      previousBoardConfig = [];
    }

    creaturePlacementSubscription = globalThis.state.board.subscribe((state) => {
      try {
        const currentBoardConfig = state.context?.boardConfig || [];
        const shouldTrack = shouldTrackPlacements();
        
        // Debug: Log when board state changes and we're in abwasp
        const roomId = state.context?.selectedMap?.roomId || state.context?.selectedMap?.selectedRoom?.id;
        if (roomId === 'abwasp') {
          const boardContext = globalThis.state?.board?.getSnapshot()?.context;
          const isSandbox = boardContext?.mode === 'sandbox';
          const inMornenionArea = isInMornenionArea();
          const enteredViaHole = playerUsedHoleToMornenion;
          
          // Log when conditions change or when board config changes (creature placed)
          const configChanged = JSON.stringify(previousBoardConfig) !== JSON.stringify(currentBoardConfig);
          const stateKey = `${isSandbox}-${inMornenionArea}-${enteredViaHole}-${shouldTrack}`;
          
          if (configChanged || !window._lastPlacementCheck || window._lastPlacementCheck !== stateKey) {
            window._lastPlacementCheck = stateKey;
          }
        }
        
        // Only track when in Mornenion area + sandbox mode
        if (!shouldTrack) {
          // Reset previous config when not in Mornenion context to avoid false positives
          previousBoardConfig = currentBoardConfig;
          return;
        }

        // Skip if no previous config (initial load)
        if (!previousBoardConfig || previousBoardConfig.length === 0) {
          previousBoardConfig = currentBoardConfig;
          return;
        }

        // Create maps of previous pieces by key for quick lookup
        const previousPiecesMap = new Map();
        previousBoardConfig.forEach(piece => {
          if (piece?.key) {
            previousPiecesMap.set(piece.key, piece);
          }
        });

        // Find newly placed creatures (exclude system-added villains like Mornenion and Lavaholes)
        const newPieces = currentBoardConfig.filter(piece => {
          if (!piece?.key) return false;
          // Skip if this piece was already in previous config
          if (previousPiecesMap.has(piece.key)) return false;
          // Skip system-added villains (Mornenion and Lavaholes)
          if (piece?.key?.startsWith('mornenion-tile-') || piece?.key?.startsWith('lavahole-tile-')) {
            return false;
          }
          return true;
        });

        // Log each newly placed creature
        if (newPieces.length > 0) {
          newPieces.forEach(piece => {
            const creatureName = getCreatureTypeName(piece);
            const creatureType = piece?.villain ? 'Enemy' : 'Ally';
            const tileIndex = piece?.tileIndex ?? 'Unknown';
            const level = piece?.level ?? 'N/A';
            const tier = piece?.tier ?? 'N/A';
            
            console.log(`[Quests Mod][Creature Placement] ${creatureType} placed: ${creatureName} on tile ${tileIndex} (Level: ${level}, Tier: ${tier})`, piece);
          });
        }

        // Update previous config for next comparison
        previousBoardConfig = currentBoardConfig;
      } catch (error) {
        console.error('[Quests Mod][Creature Placement] Error tracking placements:', error);
      }
    });

    console.log('[Quests Mod][Creature Placement] Placement tracking set up (Mornenion area + sandbox mode)');
  }


  // Cleanup all Mornenion quest state
  function cleanupMornenionQuest() {
    try {
      console.log('[Quests Mod][Mornenion] Cleaning up Mornenion quest state');
      
      // Reset Mornenion flags
      playerUsedHoleToMornenion = false;
      
      // Cleanup CustomBattle instance
      if (mornenionBattle) {
        mornenionBattle.cleanup(
          restoreBoardSetup,
          showQuestOverlays
        );
        mornenionBattle = null;
      }
      
      // Cleanup observers/subscriptions
      stopAbDendrielMutationObserver();
      stopGameTimerSubscription();
      
      // Reset state flags for fresh entry next time
      currentlyInAbDendriel = false;
      overlayHidingDone = false;
      villainSetupDone = false;
      isAddingVillains = false;
      lastVillainAddTime = 0;
      justRemovedVillains = false;
      
      console.log('[Quests Mod][Mornenion] Mornenion quest cleanup completed');
    } catch (error) {
      console.error('[Quests Mod][Mornenion] Error cleaning up Mornenion quest:', error);
    }
  }

  // Navigate to Hedge Maze
  function navigateToHedgeMaze() {
    try {
      console.log('[Quests Mod][Victory/Defeat] Navigating to Hedge Maze');
      globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: 'abmaze'
      });
    } catch (error) {
      console.error('[Quests Mod][Victory/Defeat] Error navigating to Hedge Maze:', error);
    }
  }


  // Setup Mornenion tile restrictions (delegates to CustomBattle)
  function setupMornenionTileRestrictions() {
    if (mornenionBattle) {
      mornenionBattle.setupTileRestrictions(
        () => playerUsedHoleToMornenion,
        (toastData) => {
          // Use existing showToast (ignores 'type' parameter)
          showToast({ 
            message: toastData.message, 
            duration: toastData.duration || 3000, 
            logPrefix: '[Quests Mod][Mornenion]' 
          });
        }
      );
      // Also set up ally limit monitoring
      setupMornenionAllyLimit();
    } else {
      console.warn('[Quests Mod][Mornenion] Mornenion battle not initialized');
    }
  }

  // Prevent villain movement (delegates to CustomBattle)
  function preventVillainMovement() {
    if (mornenionBattle) {
      mornenionBattle.preventVillainMovement();
    }
  }

  // Add specific villains to the board (delegates to CustomBattle)
  function addSpecificVillains() {
    if (mornenionBattle) {
      mornenionBattle.addVillains();
    } else {
      console.warn('[Quests Mod][Villain Adder] Mornenion battle not initialized');
    }
  }

  // Restore the original board setup
  function restoreBoardSetup() {
    try {
      console.log('[Quests Mod][Villain Remover] Restoring original board setup');

      const currentRoomId = getCurrentRoomId();

      if (!currentRoomId) {
        console.log('[Quests Mod][Villain Remover] No current room ID found');
        return;
      }

      // Get the original board setup for this room
      const originalSetup = globalThis.state.utils.getBoardMonstersFromRoomId(currentRoomId);

      if (!originalSetup || !Array.isArray(originalSetup)) {
        console.log('[Quests Mod][Villain Remover] No original setup found for room:', currentRoomId);
        return;
      }

      // Send the original setup back to the board
      globalThis.state.board.send({
        type: 'autoSetupBoard',
        setup: originalSetup
      });

      console.log('[Quests Mod][Villain Remover] Original board setup restored');
    } catch (error) {
      console.error('[Quests Mod][Villain Remover] Error restoring board setup:', error);
    }
  }

  function cleanupQuestOverlayHider() {
    if (questOverlayHider) {
      try {
        questOverlayHider.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Overlay Hider] Error unsubscribing:', e);
      }
      questOverlayHider = null;
    }

    // Restore any hidden overlays
    showQuestOverlays();
  }

  // Helper function to get current room ID from board context or global state
  function getCurrentRoomId(boardContext = null) {
    const context = boardContext || globalThis.state?.board?.getSnapshot()?.context;
    return context?.selectedMap?.selectedRoom?.id || globalThis.state?.selectedMap?.selectedRoom?.id;
  }

  // Clean up water fishing subscriptions
  function cleanupWaterFishingObserver() {
    if (fishingState.subscriptions.board) {
      fishingState.subscriptions.board.unsubscribe();
      fishingState.subscriptions.board = null;
    }
    if (fishingState.subscriptions.player) {
      fishingState.subscriptions.player.unsubscribe();
      fishingState.subscriptions.player = null;
    }
  }

  // Set up event-driven subscriptions for fishing functionality (only when Fishing Rod is owned)
  function setupWaterFishingObserver() {
    // Only set up if Fishing Rod is owned
    if (!shouldEnableWaterFishing()) {
      return;
    }

    // Clean up any existing subscriptions first
    cleanupWaterFishingObserver();

    // Subscribe to board state changes to detect map changes and new tiles/sprites being loaded
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      fishingState.subscriptions.board = globalThis.state.board.subscribe(({ context: boardContext }) => {
        const newRoomId = getCurrentRoomId(boardContext);

        // Only rescan if the room has actually changed
        if (fishingState.currentRoomId !== newRoomId) {
          // Update current room ID
          fishingState.currentRoomId = newRoomId;

          // Reset Al Dee mission fishing attempts counter when changing rooms
          fishingState.alDeeMissionAttempts = 0;

          // Clean up existing water tiles on map change
          if (fishingState.enabled) {
            disableWaterTileRightClick();
            fishingState.tiles.clear();
            fishingState.enabled = false; // Reset enabled flag so it can be re-enabled
          }

          // Wait for new map sprites to load, then scan for water tiles
          setTimeout(() => {
            updateWaterFishingState();
          }, FISHING_CONFIG.MAP_SWITCH_DELAY);
        }
      });
    }

    // Subscribe to player state changes to detect Fishing Rod acquisition/loss
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player && globalThis.state.player.subscribe) {
      fishingState.subscriptions.player = globalThis.state.player.subscribe((playerState) => {
        // Check if Fishing Rod is still owned, cleanup if not
        if (!shouldEnableWaterFishing()) {
          cleanupWaterFishingObserver();
          updateWaterFishingState();
          return;
        }
        updateWaterFishingState();
      });
    }

    // Initial check when subscriptions are set up
    setTimeout(() => {
      // Initialize current room ID
      fishingState.currentRoomId = getCurrentRoomId();
      updateWaterFishingState();
    }, 500);
  }

  // Clean up Tile 79 subscriptions
  function cleanupTile79Observer() {
    if (tile79BoardSubscription) {
      tile79BoardSubscription.unsubscribe();
      tile79BoardSubscription = null;
    }
    if (tile79PlayerSubscription) {
      tile79PlayerSubscription.unsubscribe();
      tile79PlayerSubscription = null;
    }
  }

  // Check if Tile 79 mission is active (regardless of location)
  function isTile79MissionActive() {
    try {
      // Check if KING_LETTER_MISSION is active or completed (source of truth: Firebase-loaded kingChatState)
      const letterMissionProgress = kingChatState.progressLetter || { accepted: false, completed: false };
      return letterMissionProgress.accepted || letterMissionProgress.completed;
    } catch (error) {
      console.error('[Quests Mod][Tile 79] Error checking mission status:', error);
      return false;
    }
  }

  // Set up Tile 79 subscriptions (only when mission is active)
  function setupTile79Observer() {
    // Only set up if mission is accessible (regardless of location)
    if (!isTile79MissionActive()) {
      return;
    }

    // Clean up any existing subscriptions first
    cleanupTile79Observer();

    // Subscribe to board state changes
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
      tile79BoardSubscription = globalThis.state.board.subscribe(({ context: boardContext }) => {
        // Check if mission is still active, cleanup if not
        if (!isTile79MissionActive()) {
          cleanupTile79Observer();
          updateTile79RightClickState(boardContext);
          return;
        }
        updateTile79RightClickState(boardContext);
      });
    }

    // Subscribe to player state changes (for quest items changes)
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player && globalThis.state.player.subscribe) {
      tile79PlayerSubscription = globalThis.state.player.subscribe(() => {
        // Check if mission is still active, cleanup if not
        if (!isTile79MissionActive()) {
          cleanupTile79Observer();
          updateTile79RightClickState();
          return;
        }
        updateTile79RightClickState();
      });
    }

    // Initial state check
    updateTile79RightClickState();
  }

  // Update Tile 79 right-click state based on current conditions
  function updateTile79RightClickState(boardContext = null) {
    try {
      // Set up or clean up subscriptions based on mission status (regardless of location)
      const missionActive = isTile79MissionActive();
      if (missionActive && !tile79BoardSubscription) {
        setupTile79Observer();
      } else if (!missionActive && tile79BoardSubscription) {
        cleanupTile79Observer();
      }

      // Only proceed if mission is active (subscriptions handle this, but double-check here)
      if (!missionActive) {
        // Mission not active - disable if currently enabled
        if (tile79RightClickEnabled) {
          document.removeEventListener('contextmenu', handleTile79RightClickDocument, true);
          const tile79Element = getTileElement(79);
          if (tile79Element) {
            tile79Element.style.pointerEvents = '';
          }
          tile79RightClickEnabled = false;
        }
        return; // Don't proceed if mission is not active
      }

      // Check if we're in Sewers and have correct mission progress
      const shouldBeEnabled = shouldEnableTile79RightClick(boardContext);
      const tile79Element = getTileElement(79);

      if (shouldBeEnabled && tile79Element && !tile79RightClickEnabled) {
        // Enable right-click - add to document with capture to intercept events before they reach the tile
        document.addEventListener('contextmenu', handleTile79RightClickDocument, true); // Use capture phase on document

        // Temporarily enable pointer events on the tile
        tile79Element.style.pointerEvents = 'auto';

        tile79RightClickEnabled = true;
        console.log('[Quests Mod][Tile 79] Right-click enabled - document listener added and pointer events enabled');
      } else if (shouldBeEnabled && !tile79Element) {
        // In Sewers with correct mission but tile not found yet, retry after a short delay
        setTimeout(() => updateTile79RightClickState(boardContext), 200);
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
    try {
      // Set up or clean up subscriptions based on Fishing Rod ownership
      const hasFishingRod = shouldEnableWaterFishing();
      if (hasFishingRod && !fishingState.subscriptions.board) {
        setupWaterFishingObserver();
      } else if (!hasFishingRod && fishingState.subscriptions.board) {
        cleanupWaterFishingObserver();
      }

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

      if (!isInSewers) return false;

      // Check if KING_LETTER_MISSION is active or completed (source of truth: Firebase-loaded kingChatState)
      const letterMissionProgress = kingChatState.progressLetter || { accepted: false, completed: false };
      const isMissionAccessible = letterMissionProgress.accepted || letterMissionProgress.completed;

      if (!isMissionAccessible) {
        return false;
      }

      // For completed missions, always allow access. For active missions, require stamped letter.
      if (letterMissionProgress.completed) {
        return true;
      }

      // Check if user has Stamped Letter in quest items (not regular player inventory)
      const currentProducts = cachedQuestItems || {};
      const hasStampedLetter = (currentProducts['Stamped Letter'] || 0) > 0;

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

    // Close any existing context menu
    if (fishingState.contextMenu && fishingState.contextMenu.closeMenu) {
      fishingState.contextMenu.closeMenu();
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
        } else if (isInGoblinBridge && !hasMagnet) {
          toastMessage = 'You found nothing. Maybe a magnet would help?';
        } else {
          toastMessage = 'You found nothing.';
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

    // Cleanup mining/digging system
    cleanupMiningSystem();

    // Cleanup Mornenion ally limit subscription
    if (mornenionAllyLimitSubscription) {
      try {
        mornenionAllyLimitSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Mornenion] Error unsubscribing ally limit:', e);
      }
      mornenionAllyLimitSubscription = null;
    }

    // Cleanup creature placement tracking
    if (creaturePlacementSubscription) {
      try {
        creaturePlacementSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Creature Placement] Error unsubscribing:', e);
      }
      creaturePlacementSubscription = null;
    }
    previousBoardConfig = null;

    // Cleanup stop button disabler
    if (stopButtonObserver) {
      try {
        stopButtonObserver.disconnect();
      } catch (e) {
        console.warn('[Quests Mod][Stop Button] Error disconnecting observer:', e);
      }
      stopButtonObserver = null;
    }
    if (startButtonClickHandler) {
      try {
        document.removeEventListener('click', startButtonClickHandler, true);
      } catch (e) {
        console.warn('[Quests Mod][Stop Button] Error removing click handler:', e);
      }
      startButtonClickHandler = null;
    }
    stopButtonDisabled = false;

    // Cleanup victory/defeat detection
    if (victoryDefeatSubscription) {
      try {
        victoryDefeatSubscription.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Victory/Defeat] Error unsubscribing:', e);
      }
      victoryDefeatSubscription = null;
    }
    if (victoryDefeatModal) {
      try {
        if (typeof victoryDefeatModal.close === 'function') {
          victoryDefeatModal.close();
        } else if (victoryDefeatModal.element && typeof victoryDefeatModal.element.remove === 'function') {
          victoryDefeatModal.element.remove();
        }
      } catch (e) {
        console.warn('[Quests Mod][Victory/Defeat] Error closing modal:', e);
      }
      victoryDefeatModal = null;
    }
    lastGameState = 'initial';

    // Cleanup Iron Ore quest timer
    if (ironOreQuestTimer) {
      clearInterval(ironOreQuestTimer);
      ironOreQuestTimer = null;
      console.log('[Quests Mod][Iron Ore Quest] Timer stopped');
    }

    // Cleanup quest overlay hider
    cleanupQuestOverlayHider();

    // Cleanup all tracked event listeners
    EventManager.cleanupAll();
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
    if (fishingState.enabled) {
      document.removeEventListener('contextmenu', handleWaterFishingRightClickDocument, true);
      disableWaterTileRightClick();
      fishingState.enabled = false;
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

  function cleanupMiningSystem() {
    // Remove event listener from document and restore tile pointer events
    if (miningState.enabled) {
      document.removeEventListener('contextmenu', handleMiningRightClickDocument, true);
      disableMiningTileRightClick();
      miningState.enabled = false;
    }

    // Close any open context menu
    if (miningState.contextMenu && miningState.contextMenu.closeMenu) {
      miningState.contextMenu.closeMenu();
    }

    // Unsubscribe from board state
    if (miningState.subscriptions.board) {
      try {
        miningState.subscriptions.board.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Digging] Error unsubscribing from board:', e);
      }
      miningState.subscriptions.board = null;
    }

    // Unsubscribe from player state
    if (miningState.subscriptions.player) {
      try {
        miningState.subscriptions.player.unsubscribe();
      } catch (e) {
        console.warn('[Quests Mod][Digging] Error unsubscribing from player:', e);
      }
      miningState.subscriptions.player = null;
    }

    // Clear tiles set
    miningState.tiles.clear();
    miningState.clickedTile = null;
    miningState.currentRoomId = null;

    console.log('[Quests Mod][Digging] System cleaned up');
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

  // Cleanup function to remove items that shouldn't exist if missions aren't completed
  async function cleanupInvalidQuestItems(progress) {
    try {
      const questItems = await getQuestItems(false);
      if (!questItems || Object.keys(questItems).length === 0) {
        return;
      }

      // Map items to their required mission completion status
      // Format: { itemName: { missionId, requiredStatus: 'accepted' | 'completed' } }
      const itemMissionMap = {
        'Map to the Mines': { missionId: KING_COPPER_KEY_MISSION.id, requiredStatus: 'accepted' },
        'Obsidian Knife': { missionId: KING_RED_DRAGON_MISSION.id, requiredStatus: 'accepted' },
        'Stamped Letter': { missionId: KING_LETTER_MISSION.id, requiredStatus: 'accepted' },
        'Dragon Claw': { missionId: KING_RED_DRAGON_MISSION.id, requiredStatus: 'completed' },
        'Light Shovel': { missionId: AL_DEE_FISHING_MISSION.id, requiredStatus: 'completed' },
        'The Holy Tible': { missionId: AL_DEE_GOLDEN_ROPE_MISSION.id, requiredStatus: 'completed' }
      };

      for (const [itemName, { missionId, requiredStatus }] of Object.entries(itemMissionMap)) {
        const itemCount = questItems[itemName] || 0;
        if (itemCount > 0) {
          // Get mission progress from registry
          const firebaseKey = MISSION_FIREBASE_KEY_MAP[missionId];
          if (!firebaseKey) {
            console.warn(`[Quests Mod] No Firebase key found for mission ${missionId}`);
            continue;
          }

          const missionProgress = progress?.[firebaseKey];
          if (!missionProgress) {
            // Mission not started - remove item
            console.log(`[Quests Mod] Removing ${itemName} (mission not started)`);
            await consumeQuestItem(itemName, itemCount);
            continue;
          }

          const hasRequiredStatus = requiredStatus === 'accepted' 
            ? missionProgress.accepted 
            : missionProgress.completed;

          if (!hasRequiredStatus) {
            // Mission doesn't have required status - remove item
            console.log(`[Quests Mod] Removing ${itemName} (mission ${requiredStatus} status not met)`);
            await consumeQuestItem(itemName, itemCount);
          }
        }
      }
    } catch (error) {
      console.error('[Quests Mod] Error cleaning up invalid quest items:', error);
    }
  }

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
        
        // New shape: Load all missions from registry dynamically
        for (const [missionId, firebaseKey] of Object.entries(MISSION_FIREBASE_KEY_MAP)) {
          const stateKey = MISSION_STATE_MAP[missionId];
          if (stateKey) {
            // Always initialize state, even if Firebase data is missing
            kingChatState[stateKey] = progress[firebaseKey] ? {
              accepted: !!progress[firebaseKey].accepted,
              completed: !!progress[firebaseKey].completed
            } : {
              accepted: false,
              completed: false
            };
          }
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
              // Use registry to get all mission progress (future-proof)
              const allProgress = getAllMissionProgress();
              allProgress.ironOre = {
                active: false,
                startTime: null,
                completed: true
              };
              await saveKingTibianusProgress(currentPlayer, allProgress);
              console.log('[Quests Mod] Iron Ore quest marked as completed and saved to Firebase');
            } catch (err) {
              console.error('[Quests Mod] Error marking Iron Ore quest as completed:', err);
            }
          }
        }

        // Clean up any remaining Iron Ore from inventory since quest is completed
        if (fishingState.ironOreQuestCompleted) {
          try {
            const questItems = await getQuestItems(false);
            if (questItems['Iron Ore'] && questItems['Iron Ore'] > 0) {
              console.log('[Quests Mod] Removing leftover Iron Ore from inventory (quest completed)');
              await consumeQuestItem('Iron Ore', questItems['Iron Ore']);
            }
          } catch (err) {
            console.error('[Quests Mod] Error cleaning up Iron Ore on init:', err);
          }
        }

        // Clean up quest items that shouldn't exist if missions aren't completed
        await cleanupInvalidQuestItems(progress);

        // Log all mission progress using registry (future-proof)
        const loggedProgress = getAllMissionProgress();
        if (progress.ironOre) {
          loggedProgress.ironOre = {
            active: fishingState.ironOreQuestActive,
            expired: fishingState.ironOreQuestExpired,
            completed: fishingState.ironOreQuestCompleted
          };
        }
        console.log('[Quests Mod] Mission progress loaded from Firebase:', loggedProgress);
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
  loadMissionProgressOnInit().then(async () => {
    // Migrate any existing Dwarven Pickaxe items to Light Shovel
    await migrateDwarvenPickaxeToLightShovel();
    // Always start with fishing disabled after reload
    fishingState.enabled = false;
    fishingState.manuallyDisabled = true; // Start disabled and prevent automatic re-enabling
    updateWaterFishingState(true);

    // Set up quest overlay hider (always active)
    setupQuestOverlayHider();
    // Set up systems conditionally (only when items/missions are active)
    // These will set up subscriptions when items/missions are detected
    updateTile79RightClickState();
    updateWaterFishingState();
    updateMiningState();
    // Set up Copper Key system conditionally (only when mission is active)
    setupCopperKeySystem();
    // Note: Mornenion tile restrictions are set up when battle is initialized (after entering hole)
    // Set up creature placement tracking
    trackCreaturePlacements();
    // Note: Stop button disabler and victory/defeat detection are now handled by CustomBattle system
  }).catch(async error => {
    console.error('[Quests Mod] Failed to load mission progress, setting up systems anyway:', error);

    // Migrate any existing Dwarven Pickaxe items to Light Shovel (even if mission progress failed to load)
    await migrateDwarvenPickaxeToLightShovel();

    // Always start with fishing disabled after reload
    fishingState.enabled = false;
    fishingState.manuallyDisabled = true; // Start disabled and prevent automatic re-enabling
    updateWaterFishingState(true);

    // Set up quest overlay hider (always active)
    setupQuestOverlayHider();
    // Set up systems conditionally (only when items/missions are active)
    // These will set up subscriptions when items/missions are detected
    updateTile79RightClickState();
    updateWaterFishingState();
    updateMiningState();
    // Set up Copper Key system conditionally (only when mission is active)
    setupCopperKeySystem();
    // Note: Mornenion tile restrictions are set up when battle is initialized (after entering hole)
    // Set up creature placement tracking
    trackCreaturePlacements();
    // Note: Stop button disabler and victory/defeat detection are now handled by CustomBattle system
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
