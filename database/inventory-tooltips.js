console.log('[inventory-tooltips.js] Loading inventory tooltips data...');

const inventoryTooltips = {
  // =======================
  // Consumables
  // =======================
  nicknameChange: {
    displayName: "Change Nickname",
    text: `"Your new name shall be reviewed by King Tibianus himself. He's not a fan of offensive words, trust me."`,
    icon: '/assets/icons/player-nickname.png',
    rarity: '2',
    obtain: 'Store'
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
    obtain: 'Loot, Surprise Cube, Store, Level-up Reward'
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
    obtain: 'Store, Level-up Reward, Reward Shop (3 hunting marks)'
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
    obtain: 'Store'
  },
  outfitBag1: {
    displayName: "Outfit Bag",
    text: 'Contains a random outfit.',
    icon: 'sprite://653',
    rarity: '2',
    obtain: 'Store, Level-up Reward, Reward Shop (3 hunting marks)'
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
    obtain: 'Surprise Cube, Daily Seashell, Store, Level-up Reward'
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
    obtain: 'Loot, Surprise Cube, Daily Seashell, Store, Level-up Reward'
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
    obtain: 'Store'
  },
  daycare: {
    displayName: "Daycare",
    text: 'Leave your creatures training at the daycare.\n\nDuring this time, your creatures will slowly earn xp.',
    icon: '/assets/icons/daycare.png',
    rarity: '3',
    obtain: 'Store'
  },
  dragonPlant: {
    displayName: "Dragon Plant",
    text: 'This useful pet plant can automatically swallow any freshly dropped monsters and digest them into gold!',
    icon: 'sprite://37022',
    rarity: '4',
    obtain: 'Store'
  },
  forge: {
    displayName: "The Sweaty Cyclop's Forge",
    text: 'Bring me two of the same thing.\n\nMe smelt, me smash, until make better thing.',
    icon: '/assets/misc/forge-mini.png',
    rarity: '5',
    obtain: 'Store'
  },
  hygenie: {
    displayName: "Hy'genie",
    text: `Need to fuse all your items at once? Your wish is my command.`,
    icon: 'sprite://42363',
    rarity: '5',
    obtain: 'Store'
  },
  monsterCauldron: {
    displayName: "Monster Cauldron",
    text: 'All sold creatures go to the cauldron. You may bring a creature back, if is not yet dissolved.',
    icon: 'sprite://43672',
    rarity: '3',
    obtain: 'Store'
  },
  mountainFortress: {
    displayName: "The Mountain Fortress",
    text: 'Upgrade a creature tier to increase its maximum level.\n\n"Nobody knows exactly what happens to those creatures..."',
    icon: '/assets/icons/mountainfortress.png',
    rarity: '4',
    obtain: 'Store'
  },
  monsterRaids: {
    displayName: "Monster Raids",
    text: 'Stay alert! At any moment, a new random monster raid may begin! Raids can drop exclusive equipments and monsters.',
    icon: 'https://bestiaryarena.com/assets/icons/raid-store.png',
    rarity: '5',
    obtain: 'Store'
  },
  monsterSqueezer: {
    displayName: "Monster Squeezer",
    text: 'Ingredients should have at most Lv. 10 and have at least 80% genes.\n\nThis is required if you want to produce 99.1% pure dust.\n\nSqueezing is easy peasy. Unsqueezing is not feasibly',
    icon: '/assets/misc/monster-squeezer-portrait-mini.png',
    rarity: '4',
    obtain: 'Store'
  },
  dailyBoostedMap: {
    displayName: "Daily Boosted Map",
    text: 'Unlocks the daily boosted map feature.\n\n"Experience enhanced rewards and challenges on specially boosted maps each day."',
    icon: '/assets/icons/boosted-map.png',
    rarity: '4',
    obtain: 'Store'
  },
  premium: {
    displayName: "Premium",
    text: 'Premium subscription that unlocks exclusive features and benefits.\n\n"Access to premium content, enhanced rewards, and exclusive features."',
    icon: '/assets/icons/premium.png',
    rarity: '5',
    obtain: 'Store'
  },
  yasirTradingContract: {
    displayName: "Yasir's Trading Contract",
    text: 'Unlocks trading features with Yasir.\n\n"Establish trade agreements and access exclusive trading opportunities."',
    icon: '/assets/icons/yasir-contract.png',
    rarity: '4',
    obtain: 'Store'
  }
};
// Export for use in Cyclopedia.js or elsewhere
if (typeof window !== 'undefined') {
  window.inventoryTooltips = inventoryTooltips;
  console.log(`[inventory-tooltips.js] Loaded ${Object.keys(inventoryTooltips).length} inventory tooltip entries`);
}
if (typeof module !== 'undefined') {
  module.exports = inventoryTooltips;
}

// Cleanup function for inventory tooltips
window.cleanupdatabaseinventorytooltipsjs = function(periodic = false) {
  console.log('[inventory-tooltips.js] Running cleanup...');
  
  // Clear any cached data
  if (window.inventoryTooltips) {
    // Reset to empty state
    window.inventoryTooltips = {};
  }
  
  console.log('[inventory-tooltips.js] Cleanup completed');
}; 