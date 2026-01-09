console.log('[inventory-database.js] Loading inventory database...');

const inventoryTooltips = {
  // =======================
  // Consumables
  // =======================
  nicknameChange: {
    displayName: "Change Nickname",
    text: `"Your new name shall be reviewed by King Tibianus himself. He's not a fan of offensive words, trust me."`,
    icon: '/assets/icons/player-nickname.png',
    rarity: '2',
    obtain: 'Store (10,000 gold)'
  },
  diceManipulator1: {
    displayName: "Dice Manipulator (Common)",
    text: `Re-roll all gene stats.\n\n"Despite common belief, rolling a dice isn't about luck—it's about skill."`,
    icon: 'sprite://35909',
    rarity: '1',
    obtain: 'Loot'
  },
  diceManipulator2: {
    displayName: "Dice Manipulator (Uncommon)",
    text: `Re-roll 4 gene stats.\n\n"Despite common belief, rolling a dice isn't about luck—it's about skill."`,
    icon: 'sprite://35909',
    rarity: '2',
    obtain: 'Loot, Surprise Cube'
  },
  diceManipulator3: {
    displayName: "Dice Manipulator (Rare)",
    text: `Re-roll 3 gene stats.\n\n"Despite common belief, rolling a dice isn't about luck—it's about skill."`,
    icon: 'sprite://35909',
    rarity: '3',
    obtain: 'Loot, Surprise Cube, Paw and Fur Society'
  },
  diceManipulator4: {
    displayName: "Dice Manipulator (Mythic)",
    text: `Re-roll 2 gene stats.\n\n"Despite common belief, rolling a dice isn't about luck—it's about skill."`,
    icon: 'sprite://35909',
    rarity: '4',
    obtain: 'Loot, Surprise Cube'
  },
  diceManipulator5: {
    displayName: "Dice Manipulator (Legendary)",
    text: `Re-roll 1 gene stat.\n\n"Despite common belief, rolling a dice isn't about luck—it's about skill."`,
    icon: 'sprite://35909',
    rarity: '5',
    obtain: 'Loot, Surprise Cube, Store (10,000 gold), Level-up Reward'
  },
  equipChest: {
    displayName: "Exaltation Chest (Honed)",
    text: 'Contains high-tier equipment rewards.',
    icon: '/assets/icons/exaltation-chest.png',
    rarity: '5',
    obtain: 'Available from Yasir in Ankrahmun (150 dust), Daily Seashell (27th day), Level-up Reward, Reward Shop (3 hunting marks), and Store (20 Beast Coins)'
  },
  hunterOutfitBag: {
    displayName: "Hunter Outfit Bag",
    text: 'Contains a random hunter outfit.',
    icon: '/assets/icons/hunteroutfitbag.png',
    rarity: '3',
    obtain: 'Store (100 Beast Coins), Level-up Reward, Reward Shop (3 hunting marks)'
  },
  insightStone1: {
    displayName: "Stone of Insight (Glimpse)",
    text: "Instantly grants 10,000xp to a creature.",
    icon: 'sprite://21383',
    rarity: '1',
    obtain: "Obtainable from 4th mission of Rookgaard Quest"
  },
  insightStone2: {
    displayName: "Stone of Insight (Awakening)",
    text: 'Instantly grants 20,000xp to a creature.\n\n"Aha!"',
    icon: 'sprite://21383',
    rarity: '2',
    obtain: 'Level-up Reward, Daily Seashell'
  },
  insightStone3: {
    displayName: "Stone of Insight (Arcane)",
    text: 'Instantly grants 50,000xp to a creature.\n\n"Aha!"',
    icon: 'sprite://21383',
    rarity: '3',
    obtain: 'Level-up Reward, Daily Seashell'
  },
  insightStone4: {
    displayName: "Stone of Insight (Enlightenment)",
    text: 'Instantly grants 100,000xp to a creature.\n\n"Aha!"',
    icon: 'sprite://21383',
    rarity: '4',
    obtain: 'Level-up Reward, Daily Seashell'
  },
  insightStone5: {
    displayName: "Stone of Insight (Epiphany)",
    text: 'Instantly grants 500,000xp to a creature.\n\n"Aha!"',
    icon: 'sprite://21383',
    rarity: '5',
    obtain: 'Level-up Reward, Daily Seashell, Surprise Cube'
  },
  nicknameMonster: {
    displayName: "Nickname Creature",
    text: `Your creature's nickname will also be visible for other players.\n\n"This paperwork will be processed by a dead bureaucrat at the Pits of Despair. They are not in a hurry, since they have all the time in the world."`,
    icon: '/assets/icons/nickname-change.png',
    rarity: '2',
    obtain: 'Store (4,000 gold)'
  },
  outfitBag1: {
    displayName: "Outfit Bag",
    text: 'Contains a random outfit.',
    icon: 'sprite://653',
    rarity: '2',
    obtain: 'Store (125 Beast Coins for 1x OR 250 Beast Coins for 3x), Level-up Reward, Reward Shop (3 hunting marks)'
  },
  stamina1: {
    displayName: "Stamina Potion (Mini)",
    text: 'Restores 12 stamina points.\n\n"Force flows from fluid,\nfueling for further fights"',
    icon: '/assets/icons/stamina1.png',
    rarity: '1',
    obtain: 'Loot'
  },
  stamina2: {
    displayName: "Stamina Potion (Strong)",
    text: 'Restores 24 stamina points.',
    icon: '/assets/icons/stamina2.png',
    rarity: '2',
    obtain: 'Loot, Surprise Cube, Daily Seashell'
  },
  stamina3: {
    displayName: "Stamina Potion (Great)",
    text: 'Restores 48 stamina points.',
    icon: '/assets/icons/stamina3.png',
    rarity: '3',
    obtain: 'Loot, Surprise Cube, Daily Seashell'
  },
  stamina4: {
    displayName: "Stamina Potion (Ultimate)",
    text: 'Restores 96 stamina points.',
    icon: '/assets/icons/stamina4.png',
    rarity: '4',
    obtain: 'Loot, Surprise Cube, Daily Seashell'
  },
  stamina5: {
    displayName: "Stamina Potion (Supreme)",
    text: 'Restores your stamina to full.\n\n"Force flows from fluid,\nfueling for further fights"',
    icon: '/assets/icons/stamina5.png',
    rarity: '5',
    obtain: 'Surprise Cube, Daily Seashell, Store (15 Beast Coins), Level-up Reward'
  },
  summonScroll1: {
    displayName: "Summon Scroll (Crude)",
    text: 'Summon a creature with at least 40% genes.\n\nYou see a spell scroll. It reads: "utevo res".',
    icon: '/assets/icons/summonscroll1.png',
    rarity: '1',
    obtain: 'Loot'
  },
  summonScroll2: {
    displayName: "Summon Scroll (Ordinary)",
    text: 'Summon a creature with at least 50% genes.\n\nYou see a spell scroll. It reads: "utevo res".',
    icon: '/assets/icons/summonscroll2.png',
    rarity: '2',
    obtain: 'Loot, Surprise Cube, Daily Seashell'
  },
  summonScroll3: {
    displayName: "Summon Scroll (Refined)",
    text: 'Summon a creature with at least 60% genes.\n\nYou see a spell scroll. It reads: "utevo res".',
    icon: '/assets/icons/summonscroll3.png',
    rarity: '3',
    obtain: 'Loot, Surprise Cube, Daily Seashell, Paw and Fur Society'
  },
  summonScroll4: {
    displayName: "Summon Scroll (Special)",
    text: 'Summon a creature with at least 70% genes.\n\nYou see a spell scroll. It reads: "utevo res".',
    icon: '/assets/icons/summonscroll4.png',
    rarity: '4',
    obtain: 'Loot, Surprise Cube, Daily Seashell'
  },
  summonScroll5: {
    displayName: "Summon Scroll (Exceptional)",
    text: 'Summon a creature with at least 80% genes.\n\nYou see a spell scroll. It reads: "utevo res".',
    icon: '/assets/icons/summonscroll5.png',
    rarity: '5',
    obtain: 'Loot, Surprise Cube, Daily Seashell, Store (20 Beast Coins), Level-up Reward'
  },
  summonScroll6: {
    displayName: "Summon Scroll (Chromatic)",
    text: 'Summon a <img src="https://bestiaryarena.com/assets/icons/shiny-star.png" alt="✨" style="display: inline-block; width: 9px; height: 10px; vertical-align: middle; margin: 0 2px;">Shiny creature with at least 80% genes.',
    icon: '/assets/icons/summonscroll6.png',
    rarity: '5',
    obtain: 'Halloween Event'
  },
  surpriseCube1: {
    displayName: "Surprise Cube (Deformed)",
    text: 'Rolls white consumables.',
    icon: 'sprite://23488',
    rarity: '1',
    obtain: 'Unobtainable'
  },
  surpriseCube2: {
    displayName: "Surprise Cube (Irregular)",
    text: 'Rolls green consumables.',
    icon: 'sprite://23488',
    rarity: '2',
    obtain: 'Daily Seashell, First map win (difficulty dependent)'
  },
  surpriseCube3: {
    displayName: "Surprise Cube (Uniform)",
    text: 'Rolls blue consumables.',
    icon: 'sprite://23488',
    rarity: '3',
    obtain: 'Daily Seashell, First map win (difficulty dependent)'
  },
  surpriseCube4: {
    displayName: "Surprise Cube (Precise)",
    text: 'Rolls purple consumables.',
    icon: 'sprite://23488',
    rarity: '4',
    obtain: 'Daily Seashell, First map win (difficulty dependent)'
  },
  surpriseCube5: {
    displayName: "Surprise Cube (Perfect)",
    text: 'Rolls yellow consumables.',
    icon: 'sprite://23488',
    rarity: '5',
    obtain: 'Daily Seashell, Level-up Reward, First map win (difficulty dependent)'
  },

  // =======================
  // Runes
  // =======================
  runeAvarice: {
    displayName: "Avarice Rune",
    text: 'This rune can be transmuted into 2,000gp.',
    icon: '/assets/icons/rune-avarice.png',
    rarity: '2',
    obtain: 'Rookgaard'
  },
  runeHp: {
    displayName: "Hitpoints Rune",
    text: 'Raise a creature hitpoints genes by +1.',
    icon: '/assets/icons/rune-hp.png',
    rarity: '3',
    obtain: 'Ab\'Dendriel'
  },
  runeAd: {
    displayName: "Attack Damage Rune",
    text: 'Raise a creature attack damage genes by +1.',
    icon: '/assets/icons/rune-ad.png',
    rarity: '3',
    obtain: 'Venore'
  },
  runeAp: {
    displayName: "Ability Power Rune",
    text: 'Raise a creature ability power genes by +1.',
    icon: '/assets/icons/rune-ap.png',
    rarity: '3',
    obtain: 'Carlin'
  },
  runeAr: {
    displayName: "Armor Rune",
    text: 'Raise a creature armor genes by +1.',
    icon: '/assets/icons/rune-ar.png',
    rarity: '3',
    obtain: 'Kazordoon'
  },
  runeMr: {
    displayName: "Magic Resist Rune",
    text: 'Raise a creature magic resist genes by +1.',
    icon: '/assets/icons/rune-mr.png',
    rarity: '3',
    obtain: 'Folda'
  },
  runeBlank: {
    displayName: "Blank Rune",
    text: 'With this raw material you can create any random rune.',
    icon: '/assets/icons/rune-blank.png',
    rarity: '4',
    obtain: 'Paw and Fur Society, Dragon Plant'
  },
  runeRecycle: {
    displayName: "Recycle Rune",
    text: 'Recycle 3 runes into a different random rune.',
    icon: '/assets/icons/rune-recycle.png',
    rarity: '4',
    obtain: 'Obtained from Blank Rune'
  },
  runeRecycleMonster: {
    displayName: "Kaleidoscopic Rune",
    text: 'Fuse 2 shiny creatures into a Summon Scroll (Chromatic).',
    icon: '/assets/icons/rune-monster-recycle.png',
    rarity: '5',
    obtain: 'Obtained from Blank Rune'
  },
  runeConversionHp: {
    displayName: "Conversion Rune (hp)",
    text: 'For a handful of dust you can convert any equipment stat to hitpoints.',
    icon: '/assets/icons/rune-conversion-hp.png',
    rarity: '5',
    obtain: 'Obtained from Blank Rune'
  },
  runeConversionAd: {
    displayName: "Conversion Rune (ad)",
    text: 'For a handful of dust you can convert any equipment stat to attack damage.',
    icon: '/assets/icons/rune-conversion-ad.png',
    rarity: '5',
    obtain: 'Obtained from Blank Rune'
  },
  runeConversionAp: {
    displayName: "Conversion Rune (ap)",
    text: 'For a handful of dust you can convert any equipment stat to ability power.',
    icon: '/assets/icons/rune-conversion-ap.png',
    rarity: '5',
    obtain: 'Obtained from Blank Rune'
  },

  // =======================
  // Currency
  // =======================
  beastCoins: {
    displayName: "Beast Coins",
    text: `Premium currency used for special purchases and exclusive items.\n\n"These rare coins are highly valued by merchants and collectors alike."`,
    icon: '/assets/icons/beastcoin.png',
    rarity: '4',
    obtain: 'Store, Events, Achievements, Daily Rewards'
  },
  dust: {
    displayName: "Dust",
    text: `Used for crafting and upgrading equipment.\n\n"Essential material for enhancing your gear and creating powerful items."`,
    icon: '/assets/icons/dust.png',
    rarity: '2',
    obtain: 'Monster Squeezer, Quests, Loot'
  },
  gold: {
    displayName: "Gold",
    text: `Basic currency used for various in-game purchases and transactions.\n\n"The most common form of currency in the realm."`,
    icon: '/assets/icons/goldpile.png',
    rarity: '1',
    obtain: 'Loot, Quests, Events, Daily Activities'
  },
  huntingMarks: {
    displayName: "Hunting Marks",
    text: `You earn a Hunting Mark for every completed hunting task.\n\n"These can also be spent at the Jukebox, but Grizzly Adams doesn't like sharing the aux cord"`,
    icon: 'sprite://35572',
    rarity: '3',
    obtain: 'Tasks'
  },

  // =======================
  // Upgrades
  // =======================
  babyDragonPlant: {
    displayName: "Baby Dragon Plant",
    text: 'This useful pet plant can automatically swallow any freshly dropped monsters and digest them into gold!\n\nUpgrades to Dragon Plant.',
    icon: 'sprite://28689',
    rarity: '3',
    obtain: 'Store (100,000 gold)'
  },
  daycare: {
    displayName: "Daycare",
    text: 'Leave your creatures training at the daycare.\n\nDuring this time, your creatures will slowly earn xp.',
    icon: '/assets/icons/daycare.png',
    rarity: '3',
    obtain: 'Store (1,500 gold)'
  },
  dragonPlant: {
    displayName: "Dragon Plant",
    text: 'This useful pet plant can automatically swallow any freshly dropped monsters and digest them into gold!',
    icon: 'sprite://37022',
    rarity: '4',
    obtain: 'Store (100,000 gold, upgradeable 5x times)'
  },
  forge: {
    displayName: "The Sweaty Cyclop's Forge",
    text: 'Bring me two of the same thing.\n\nMe smelt, me smash, until make better thing.',
    icon: '/assets/misc/forge-mini.png',
    rarity: '5',
    obtain: 'Store (50,000 gold)'
  },
  hygenie: {
    displayName: "Hy'genie",
    text: `Need to fuse all your items at once? Your wish is my command.`,
    icon: 'sprite://42363',
    rarity: '5',
    obtain: 'Store (15,000 gold)'
  },
  monsterCauldron: {
    displayName: "Monster Cauldron",
    text: 'All sold creatures go to the cauldron. You may bring a creature back, if is not yet dissolved.',
    icon: 'sprite://43672',
    rarity: '3',
    obtain: 'Store (15,000 gold)'
  },
  mountainFortress: {
    displayName: "The Mountain Fortress",
    text: 'Upgrade a creature tier to increase its maximum level.\n\n"Nobody knows exactly what happens to those creatures..."',
    icon: '/assets/icons/mountainfortress.png',
    rarity: '4',
    obtain: 'Store (1,500 gold)'
  },
  monsterRaids: {
    displayName: "Monster Raids",
    text: 'Stay alert! At any moment, a new random monster raid may begin! Raids can drop exclusive equipments and monsters.',
    icon: 'https://bestiaryarena.com/assets/icons/raid-store.png',
    rarity: '5',
    obtain: 'Store (20,000 gold)'
  },
  monsterSqueezer: {
    displayName: "Monster Squeezer",
    text: 'Ingredients should have at most Lv. 10 and have at least 80% genes.\n\nThis is required if you want to produce 99.1% pure dust.\n\nSqueezing is easy peasy. Unsqueezing is not feasibly',
    icon: '/assets/misc/monster-squeezer-portrait-mini.png',
    rarity: '4',
    obtain: 'Store (30,000 gold)'
  },
  dailyBoostedMap: {
    displayName: "Daily Boosted Map",
    text: 'Unlocks the daily boosted map feature.\n\n"Experience enhanced rewards and challenges on specially boosted maps each day."',
    icon: '/assets/icons/boosted-map.png',
    rarity: '4',
    obtain: 'Store (10,000 gold)'
  },
  premium: {
    displayName: "Premium",
    text: 'Premium subscription that unlocks exclusive features and benefits.\n\n"Access to premium content, enhanced rewards, and exclusive features."',
    icon: '/assets/icons/premium.png',
    rarity: '5',
    obtain: 'Store (300 Beast Coins)'
  },
  yasirTradingContract: {
    displayName: "Yasir's Trading Contract",
    text: 'Unlocks trading features with Yasir.\n\n"Establish trade agreements and access exclusive trading opportunities."',
    icon: '/assets/icons/yasir-contract.png',
    rarity: '4',
    obtain: 'Store (25,000 gold)'
  },
  dungeonAscension: {
    displayName: "Dungeon Ascension",
    text: 'Ascend your way through increasingly more difficult enemies. The higher you climb, the better the loot. How high can you go?',
    icon: '/assets/icons/dungeon-ascension.png',
    rarity: '5',
    obtain: 'Store (200,000 gold)'
  }
};

// Inventory item categories for organizing items in the UI
const INVENTORY_CATEGORIES = {
  'Consumables': ['Change Nickname', 'Dice Manipulators', 'Exaltation Chests', 'Nickname Creature', 'Outfit Bags', 'Stamina Potions', 'Stones of Insight', 'Summon Scrolls', 'Surprise Cubes'],
  'Currency': ['Beast Coins', 'Dust', 'Gold', 'Hunting Marks'],
  'Runes': ['Avarice Rune', 'Hitpoints Rune', 'Attack Damage Rune', 'Ability Power Rune', 'Armor Rune', 'Magic Resist Rune', 'Blank Rune', 'Recycle Rune', 'Kaleidoscopic Rune', 'Conversion Rune (hp)', 'Conversion Rune (ad)', 'Conversion Rune (ap)'],
  'Upgrades': ['Baby Dragon Plant', 'Daily Boosted Map', 'Daycare', 'Dungeon Ascension', 'Dragon Plant', 'Hy\'genie', 'Monster Cauldron', 'Monster Raids', 'Monster Squeezer', 'Mountain Fortress', 'Premium', 'The Sweaty Cyclop\'s Forge', 'Yasir\'s Trading Contract']
};

const INVENTORY_VARIANTS = {
  'Change Nickname': ['nicknameChange'],
  'Dice Manipulators': ['diceManipulator1', 'diceManipulator2', 'diceManipulator3', 'diceManipulator4', 'diceManipulator5'],
  'Exaltation Chests': ['equipChest'], 'Nickname Creature': ['nicknameMonster'], 'Outfit Bags': ['hunterOutfitBag', 'outfitBag1'],
  'Stamina Potions': ['stamina1', 'stamina2', 'stamina3', 'stamina4', 'stamina5'],
  'Stones of Insight': ['insightStone1', 'insightStone2', 'insightStone3', 'insightStone4', 'insightStone5'],
  'Summon Scrolls': ['summonScroll1', 'summonScroll2', 'summonScroll3', 'summonScroll4', 'summonScroll5', 'summonScroll6'],
  'Surprise Cubes': ['surpriseCube1', 'surpriseCube2', 'surpriseCube3', 'surpriseCube4', 'surpriseCube5'],
  'Beast Coins': ['beastCoins'], 'Dust': ['dust'], 'Gold': ['gold'], 'Hunting Marks': ['huntingMarks'],
  'Avarice Rune': ['runeAvarice'], 'Hitpoints Rune': ['runeHp'], 'Attack Damage Rune': ['runeAd'], 'Ability Power Rune': ['runeAp'], 'Armor Rune': ['runeAr'], 'Magic Resist Rune': ['runeMr'],
  'Blank Rune': ['runeBlank'], 'Recycle Rune': ['runeRecycle'],
  'Kaleidoscopic Rune': ['runeRecycleMonster'], 'Conversion Rune (hp)': ['runeConversionHp'], 'Conversion Rune (ad)': ['runeConversionAd'], 'Conversion Rune (ap)': ['runeConversionAp'],
  'Baby Dragon Plant': ['babyDragonPlant'], 'Daily Boosted Map': ['dailyBoostedMap'], 'Daycare': ['daycare'], 'Dungeon Ascension': ['dungeonAscension'], 'Dragon Plant': ['dragonPlant'], 'Hy\'genie': ['hygenie'],
  'Monster Cauldron': ['monsterCauldron'], 'Monster Raids': ['monsterRaids'], 'Monster Squeezer': ['monsterSqueezer'], 'Mountain Fortress': ['mountainFortress'],
  'Premium': ['premium'], 'The Sweaty Cyclop\'s Forge': ['forge'], 'Yasir\'s Trading Contract': ['yasirTradingContract']
};

const INVENTORY_STATIC_ITEMS = {
  'beastCoins': { name: 'Beast Coins', rarity: '1' }, 'dust': { name: 'Dust', rarity: '2' },
  'gold': { name: 'Gold', rarity: '3' }, 'huntingMarks': { name: 'Hunting Marks', rarity: '4' },
  'runeAvarice': { name: 'Avarice Rune', rarity: '2' }, 'runeHp': { name: 'Hitpoints Rune', rarity: '3' }, 'runeAd': { name: 'Attack Damage Rune', rarity: '3' }, 'runeAp': { name: 'Ability Power Rune', rarity: '3' }, 
  'runeAr': { name: 'Armor Rune', rarity: '3' }, 'runeMr': { name: 'Magic Resist Rune', rarity: '3' },
  'runeBlank': { name: 'Blank Rune', rarity: '4' }, 'runeRecycle': { name: 'Recycle Rune', rarity: '4' },
  'runeRecycleMonster': { name: 'Kaleidoscopic Rune', rarity: '5' }, 'runeConversionHp': { name: 'Conversion Rune (hp)', rarity: '5' }, 'runeConversionAd': { name: 'Conversion Rune (ad)', rarity: '5' }, 'runeConversionAp': { name: 'Conversion Rune (ap)', rarity: '5' },
  'nicknameMonster': { name: 'Nickname Creature', rarity: '3' }, 'nicknameChange': { name: 'Change Nickname', rarity: '2' },
  'nicknamePlayer': { name: 'Player Nickname', rarity: '2' }, 'equipChest': { name: 'Exaltation Chest', rarity: '5' },
  'hunterOutfitBag': { name: 'Hunter Outfit Bag', rarity: '3' }, 'outfitBag1': { name: 'Outfit Bag', rarity: '2' },
  'babyDragonPlant': { name: 'Baby Dragon Plant', rarity: '3' }, 'dailyBoostedMap': { name: 'Daily Boosted Map', rarity: '4' }, 'daycare': { name: 'Daycare', rarity: '3' },
  'dungeonAscension': { name: 'Dungeon Ascension', rarity: '5' }, 'dragonPlant': { name: 'Dragon Plant', rarity: '4' }, 'hygenie': { name: 'Hy\'genie', rarity: '5' }, 'monsterCauldron': { name: 'Monster Cauldron', rarity: '4' },
  'monsterRaids': { name: 'Monster Raids', rarity: '4' }, 'monsterSqueezer': { name: 'Monster Squeezer', rarity: '3' }, 'mountainFortress': { name: 'Mountain Fortress', rarity: '4' },
  'premium': { name: 'Premium', rarity: '5' }, 'forge': { name: 'The Sweaty Cyclop\'s Forge', rarity: '5' },
  'yasirTradingContract': { name: 'Yasir\'s Trading Contract', rarity: '4' }
};

// Items that can be upgraded multiple times
const INVENTORY_UPGRADEABLE_ITEMS = [
  'dragonPlant'
];

// Rarity configuration for items and equipment
const RARITY_CONFIG = {
  text: { '1': 'Common', '2': 'Uncommon', '3': 'Rare', '4': 'Epic', '5': 'Legendary' },
  colors: { '1': '#9d9d9d', '2': '#1eff00', '3': '#0070dd', '4': '#a335ee', '5': '#ff8000' }
};

// Combined inventory database
const inventoryDatabase = {
  tooltips: inventoryTooltips,
  categories: INVENTORY_CATEGORIES,
  variants: INVENTORY_VARIANTS,
  staticItems: INVENTORY_STATIC_ITEMS,
  upgradeableItems: INVENTORY_UPGRADEABLE_ITEMS,
  rarityText: RARITY_CONFIG.text,
  rarityColors: RARITY_CONFIG.colors
};

// Export for use in other mods
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow) {
  globalWindow.inventoryTooltips = inventoryTooltips; // Keep for backward compatibility
  globalWindow.inventoryDatabase = inventoryDatabase;
  console.log(`[inventory-database.js] Loaded ${Object.keys(inventoryTooltips).length} inventory tooltip entries`);
  console.log(`[inventory-database.js] Loaded inventory database with categories, variants, and static items`);
}
if (typeof module !== 'undefined') {
  module.exports = inventoryDatabase;
}

