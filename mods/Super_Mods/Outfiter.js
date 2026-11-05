// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Outfiter] initializing...');

// =======================
// 2. Configuration & Constants
// =======================

// Translation helper (api.i18n.t returns the raw key when missing, so keys must exist in both locales)
const t = (key) => {
  if (typeof api !== 'undefined' && api.i18n && api.i18n.t) return api.i18n.t(key);
  if (typeof context !== 'undefined' && context.api && context.api.i18n && context.api.i18n.t) return context.api.i18n.t(key);
  return key;
};

// Cache DATA availability to avoid repeated checks
const DATA_AVAILABLE = typeof DATA !== 'undefined';

// Store original fetch for cleanup
let outfiterFetchWrapper = null;
let outfiterFetchRestore = null;
let outfiterFetchActive = false;

// Store timer IDs for cleanup
let restoreTimer = null;

// Store notification cleanup timers
const notificationTimers = new Set();

// Mount selector (account-menu item under "OT Mods" + modal grid)
let mountMenuObserver = null;
let mountModal = null;
const mountMenuTimers = new Set();
let tablesAbort = null; // aborts the in-flight live game-table load

// =======================
// 3. Helper Functions
// =======================

// =======================
// Game tables: live, with a bundled snapshot as fallback
// =======================
// The game keeps its outfit and mount tables inside its bundled JS (no global exposes them), so on
// startup loadGameTables() reads the game's own chunks and parses them; the three objects below are
// then replaced in place. If that fails the snapshot stays in use. Keep the snapshot current with
// `node tools/check-outfits-mounts.mjs --update`, which rewrites only the marked data block. That tool
// also runs the marked parser below against the live chunks, so it must stay self-contained.
// BEGIN OUTFIT_MOUNT_DATA
const MOUNTS = { // id -> [name, rarity] or [name, rarity, riderX, riderY]
  368: ["Widow Queen", 1],
  369: ["Racing Bird", 1],
  370: ["War Bear", 1],
  371: ["Black Sheep", 5],
  372: ["Midnight Panther", 5],
  373: ["Draptor", 5],
  374: ["Titanica", 5],
  375: ["Tin Lizzard", 5],
  376: ["Blazebringer", 4],
  377: ["Rapid Boar", 3],
  378: ["Stampor", 2],
  379: ["Undead Cavebear", 5],
  387: ["Donkey", 1],
  388: ["Tiger Slug", 1],
  389: ["Uniwheel", 4],
  390: ["Crystal Wolf", 1],
  392: ["War Horse", 2],
  401: ["Kingly Deer", 3],
  402: ["Tamed Panda", 2],
  405: ["Dromedary", 2],
  406: ["Scorpion King", 5],
  421: ["Rented Horse", 1],
  426: ["Armoured War Horse", 3],
  427: ["Shadow Draptor", 4],
  437: ["Rented Horse (Gray)", 1],
  438: ["Rented Horse (Brown)", 1],
  447: ["Lady Bug", 5],
  450: ["Manta Ray", 5],
  502: ["Ironblight", 1],
  503: ["Magma Crawler", 1],
  506: ["Dragonling", 3],
  515: ["Gnarlhound", 1],
  521: ["Crimson Ray", 5],
  522: ["Steelbeak", 5],
  526: ["Water Buffalo", 2],
  546: ["Tombstinger", 3],
  547: ["Platesaurian", 1],
  548: ["Ursagrodon", 4],
  559: ["The Hellgrip", 2],
  571: ["Noble Lion", 2],
  572: ["Desert King", 3],
  580: ["Shock Head", 5],
  606: ["Walker", 5],
  621: ["Azudocus", 1],
  622: ["Carpacosaurus", 1],
  624: ["Death Crawler", 3],
  626: ["Flamesteed", 1],
  627: ["Jade Lion", 4],
  628: ["Jade Pincer", 3],
  629: ["Nethersteed", 1],
  630: ["Tempest", 1],
  631: ["Winter King", 1],
  644: ["Doombringer", 3],
  647: ["Woodland Prince", 3],
  648: ["Hailstorm Fury", 3],
  649: ["Siegebreaker", 2],
  650: ["Poisonbane", 2],
  651: ["Blackpelt", 2],
  669: ["Golden Dragonfly", 1],
  670: ["Steel Bee", 1],
  671: ["Copper Fly", 1],
  672: ["Tundra Rambler", 4],
  673: ["Highland Yak", 4],
  674: ["Glacier Vagabond", 4],
  682: ["Glooth Glider", 1],
  685: ["Shadow Hart", 2],
  686: ["Black Stag", 2],
  687: ["Emperor Deer", 2],
  688: ["Flying Divan", 4],
  689: ["Magic Carpet", 4],
  690: ["Floating Kashmir", 4],
  691: ["Ringtail Waccoon", 5],
  692: ["Night Waccoon", 4],
  693: ["Emerald Waccoon", 4],
  726: ["Flitterkatzen", 4],
  727: ["Venompaw", 4],
  728: ["Batcat", 4],
  734: ["Sea Devil", 4],
  735: ["Coralripper", 4],
  736: ["Plumfish", 4],
  738: ["Gorongra", 3],
  739: ["Noctungra", 4],
  740: ["Silverneck", 5],
  761: ["Slagsnare", 1],
  762: ["Nightstinger", 1],
  763: ["Razorcreep", 1],
  848: ["Rift Runner", 5],
  849: ["Nightdweller", 3],
  850: ["Frostflare", 3],
  851: ["Cinderhoof", 3],
  868: ["Mouldpincer", 2],
  869: ["Bloodcurl", 2],
  870: ["Leafscuttler", 2],
  883: ["Sparkion", 3],
  886: ["Swamp Snapper", 1],
  887: ["Mould Shell", 1],
  888: ["Reed Lurker", 1],
  889: ["Neon Sparkid", 4],
  890: ["Vortexion", 5],
  901: ["Ivory Fang", 2],
  902: ["Shadow Claw", 2],
  903: ["Snow Pelt", 2],
  905: ["Jackalope", 1],
  906: ["Dreadhare", 1],
  907: ["Wolpertinger", 1],
  937: ["Stone Rhino", 5],
  950: ["Gold Sphinx", 2],
  951: ["Emerald Sphinx", 2],
  952: ["Shadow Sphinx", 2],
  959: ["Jungle Saurian", 2],
  960: ["Ember Saurian", 2],
  961: ["Lagoon Saurian", 2],
  1017: ["Blazing Unicorn", 2],
  1018: ["Arctic Unicorn", 2],
  1019: ["Prismatic unicorn", 5],
  1025: ["Cranium Spider", 2],
  1026: ["Cave Tarantula", 2],
  1027: ["Gloom Widow", 2],
  1049: ["Mole", 5],
  1052: ["Marsh Toad", 2],
  1053: ["Sanguine Frog", 2],
  1054: ["Toxic Toad", 2],
  1091: ["Ebony Tiger", 3],
  1092: ["Feral Tiger", 3],
  1093: ["Jungle Tiger", 3],
  1101: ["Fleeting Knowledge", 5],
  1104: ["Tawny Owl", 4],
  1105: ["Snowy Owl", 4],
  1106: ["Boreal Owl", 4],
  1150: ["Lacewing Moth", 4],
  1151: ["Hibernal Moth", 5],
  1163: ["Cold Percht Sleigh", 3],
  1164: ["Bright Percht Sleigh", 3],
  1165: ["Dark Percht Sleigh", 3],
  1167: ["Festive Snowman", 5],
  1168: ["Muffled Snowman", 5],
  1169: ["Caped Snowman", 5],
  1179: ["Rabbit Rickshaw", 2],
  1180: ["Bunny Dray", 2],
  1181: ["Cony Cart", 2],
  1183: ["River Crocovile", 3],
  1184: ["Swamp Crocovile", 3],
  1185: ["Nightmarish Crocovile", 3],
  1191: ["Gryphon", 3],
  1208: ["Jousting Eagle", 5],
  1209: ["Cerberus Champion", 5],
  1229: ["Cold Percht Sleigh Variant", 4],
  1230: ["Bright Percht Sleigh Variant", 4],
  1231: ["Dark Percht Sleigh Variant", 4],
  1232: ["Cold Percht Sleigh Final", 5],
  1233: ["Bright Percht Sleigh Final", 5],
  1234: ["Dark Percht Sleigh Final", 5],
  1247: ["Battle Badger", 3],
  1248: ["Ether Badger", 3],
  1249: ["Zaoan Badger", 3],
  1257: ["Blue Rolling Barrel", 3],
  1258: ["Red Rolling Barrel", 3],
  1259: ["Green Rolling Barrel", 3],
  1264: ["Floating Sage", 3],
  1265: ["Floating Scholar", 3],
  1266: ["Floating Augur", 3],
  1269: ["Haze", 3],
  1281: ["Antelope", 5],
  1284: ["Snow Strider", 3],
  1285: ["Dusk Pryer", 3],
  1286: ["Dawn Strayer", 3],
  1321: ["Phantasmal Jade", 5],
  1324: ["Savanna Ostrich", 2],
  1325: ["Coral Rhea", 2],
  1326: ["Eventide Nandu", 2],
  1333: ["Voracious Hyaena", 4],
  1334: ["Cunning Hyaena", 4],
  1335: ["Scruffy Hyaena", 4],
  1336: ["White Lion", 5],
  1379: ["Merry Mammoth", 3],
  1380: ["Holiday Mammoth", 3],
  1381: ["Festive Mammoth", 3],
  1389: ["Void Watcher", 4],
  1390: ["Rune Watcher", 4],
  1391: ["Rift Watcher", 4],
  1417: ["Phant", 5],
  1431: ["Singeing Steed", 4],
  1439: ["Hyacinth", 2],
  1440: ["Peony", 2],
  1441: ["Dandelion", 2],
  1446: ["Rustwurm", 4],
  1447: ["Bogwurm", 4],
  1448: ["Gloomwurm", 4],
  1453: ["Emerald Raven", 3],
  1454: ["Mystic Raven", 3],
  1455: ["Radiant Raven", 3],
  1459: ["Gloothomotive", 4],
  1491: ["Topaz Shrine", 2],
  1492: ["Jade Shrine", 2],
  1493: ["Obsidian Shrine", 2],
  1526: ["Poppy ibex", 3],
  1527: ["Mint ibex", 3],
  1528: ["Cinnamon ibex", 3],
  1536: ["Giant Beaver", 4],
  1577: ["Noxious Ripptor", 5],
  1578: ["Parade Horse", 4],
  1579: ["Jousting Horse", 4],
  1580: ["Tourney Horse", 4],
  1608: ["Tangerine Flecked Koi", 3, 8, 8],
  1609: ["Brass Speckled Koi", 3, 8, 8],
  1610: ["Ink Spotted Koi", 3, 8, 8],
  1615: ["Frostbringer", 3],
  1616: ["Winterstride", 3],
  1617: ["Icebreacher", 3],
  1632: ["Foxmouse", 5],
  1672: ["Boisterous Bull", 1],
  1673: ["Surly Steer", 1],
  1674: ["Obstinate Ox", 1],
  1677: ["Darkfire Devourer", 3],
  1682: ["Spirit of Purity", 5],
  1685: ["Doom Skull", 2],
  1686: ["Magma Skull", 2],
  1687: ["Corpsefire Skull", 2],
  1721: ["Mystic Jaguar", 5],
  1727: ["Dawnbringer Pegasus", 5],
  1728: ["Wrathfire Pegasus", 5],
  1729: ["Skybreaker Pegasus", 5],
  1730: ["Pegasus", 4],
  1742: ["Glacier Wyrm", 4],
  1743: ["Bog Tyrant", 4],
  1744: ["Crimson Fang", 4],
  1778: ["Bumblebee", 5],
  1833: ["Night Locust", 4],
  1834: ["Leaf Locust", 4],
  1835: ["Pearl Locust", 4],
};
const MOUNTABLE_OUTFITS = { // id -> name (base ids; each one's alt variant is mountable too)
  128: "Citizen",
  129: "Hunter",
  130: "Mage",
  131: "Knight",
  132: "Nobleman",
  133: "Summoner",
  134: "Warrior",
  143: "Barbarian",
  144: "Druid",
  145: "Wizard",
  146: "Oriental",
  151: "Pirate",
  152: "Assassin",
  153: "Beggar",
  154: "Shaman",
  251: "Norseman",
  268: "Nightmare",
  273: "Jester",
  278: "Brotherhood",
  289: "Demon Hunter",
  324: "Yalaharian",
  328: "Newly Wed",
  335: "Warmaster",
  367: "Wayfarer",
  430: "Afflicted",
  432: "Elementalist",
  463: "Deepling",
  465: "Insectoid",
  472: "Entrepreneur",
  512: "Crystal Warlord",
  516: "Soil Guardian",
  541: "Demon",
  574: "Cave Explorer",
  577: "Dream Warden",
  610: "Glooth Engineer",
  619: "Jersey",
  633: "Champion",
  634: "Conjurer",
  637: "Beastmaster",
  665: "Chaos Acolyte",
  667: "Death Herald",
  684: "Ranger",
  695: "Ceremonial Garb",
  697: "Puppeteer",
  698: "Spirit Caller",
  725: "Evoker",
  733: "Seaweaver",
  746: "Recruiter",
  750: "Sea Dog",
  760: "Royal Pumpkin",
  846: "Rift Warrior",
  853: "Winter Warden",
  873: "Philosopher",
  884: "Arena Champion",
  899: "Lupine Warden",
  908: "Grove Keeper",
  931: "Festive",
  947: "Draconian",
  955: "Pharaoh",
  957: "Trophy Hunter",
  962: "Retro Warrior",
  964: "Retro Summoner",
  966: "Retro Nobleman",
  968: "Retro Mage",
  970: "Retro Knight",
  972: "Retro Hunter",
  974: "Retro Citizen",
  1021: "Herbalist",
  1023: "Sun Priest",
  1042: "Makeshift Warrior",
  1050: "Siege Master",
  1056: "Mercenary",
  1069: "Battle Mage",
  1094: "Discoverer",
  1102: "Sinister Archer",
  1127: "Pumpkin Mummy",
  1146: "Dream Warrior",
  1161: "Percht Raider",
  1173: "Owl Keeper",
  1186: "Guidon Bearer",
  1202: "Void Master",
  1204: "Veteran Paladin",
  1206: "Lion of War",
  1210: "Golden Outfit",
  1243: "Hand of the Inquisition",
  1245: "Breezy Garb",
  1251: "Orcsoberfest Garb",
  1270: "Poltergeist",
  1279: "Herder",
  1282: "Falconer",
  1288: "Dragon Slayer",
  1292: "Trailblazer",
  1322: "Revenant",
  1331: "Jouster",
  1338: "Moth Cape",
  1371: "Rascoohan",
  1382: "Merry Garb",
  1384: "Rune Master",
  1386: "Citizen of Issavi",
  1415: "Forest Warden",
  1436: "Royal Bounacean Advisor",
  1444: "Dragon Knight",
  1449: "Arbalester",
  1457: "Royal Costume",
  1460: "Formal Dress",
  1489: "Ghost Blade",
  1500: "Nordic Chieftain",
  1568: "Fire-Fighter",
  1575: "Fencer",
  1581: "Shadowlotus Disciple",
  1597: "Ancient Aucar",
  1612: "Frost Tracer",
  1618: "Armoured Archer",
  1662: "Decaying Defender",
  1675: "Darklight Evoker",
  1680: "Flamefury Mage",
  1713: "Doom Knight",
  1722: "Draccoon Herald",
  1725: "Celestial Avenger",
  1745: "Blade Dancer",
  1774: "Rootwalker",
  1776: "Beekeeper",
  1809: "Fiend Slayer",
  1814: "Field Surgeon",
  1824: "Monk",
  1831: "Winged Druid",
  1837: "Martial Artist",
  1845: "Necromancer",
  1860: "Illuminator",
  1874: "Bat Knight",
  1936: "Aerial Disciple",
  1940: "Captains Outfit",
  1944: "Knight Alt",
  1948: "Vampire Noble",
  1973: "Illuminated Warrior",
  1976: "Moon Guardian",
  20002: "Feral Trapper (II)",
  20004: "Feral Trapper (III)",
  20006: "Phoenix Evoker (I)",
  20008: "Phoenix Evoker (II)",
  20010: "Phoenix Evoker (III)",
};
const OUTFIT_IDS = [ // every outfit id in the game's outfit table
  12, 75, 128, 129, 130, 131, 132, 133, 134, 143, 144, 145, 146, 151,
  152, 153, 154, 159, 160, 194, 226, 251, 253, 254, 255, 264, 268, 273,
  278, 289, 324, 328, 335, 367, 430, 432, 463, 465, 472, 493, 512, 516,
  532, 533, 534, 541, 574, 577, 610, 619, 633, 634, 637, 665, 667, 684,
  695, 697, 698, 725, 733, 746, 750, 760, 842, 846, 853, 862, 873, 875,
  876, 881, 884, 899, 908, 931, 932, 935, 947, 955, 957, 962, 964, 966,
  968, 970, 972, 974, 980, 1021, 1023, 1042, 1050, 1056, 1059, 1061, 1062, 1063,
  1068, 1069, 1071, 1094, 1102, 1108, 1110, 1112, 1114, 1116, 1118, 1119, 1127, 1133,
  1136, 1146, 1161, 1173, 1186, 1188, 1189, 1190, 1200, 1202, 1204, 1206, 1210, 1217,
  1219, 1221, 1222, 1223, 1243, 1245, 1251, 1255, 1268, 1270, 1279, 1282, 1288, 1292,
  1298, 1300, 1301, 1316, 1317, 1322, 1331, 1338, 1346, 1363, 1371, 1378, 1382, 1384,
  1386, 1396, 1406, 1407, 1408, 1415, 1418, 1430, 1436, 1444, 1449, 1457, 1460, 1489,
  1500, 1537, 1538, 1539, 1543, 1568, 1575, 1581, 1597, 1599, 1611, 1612, 1618, 1646,
  1647, 1648, 1662, 1675, 1680, 1713, 1722, 1724, 1725, 1737, 1740, 1745, 1747, 1774,
  1776, 1809, 1810, 1814, 1816, 1824, 1826, 1827, 1831, 1837, 1845, 1847, 1848, 1850,
  1856, 1857, 1860, 1866, 1874, 1900, 1901, 1902, 1927, 1928, 1929, 1930, 1935, 1936,
  1938, 1940, 1944, 1948, 1950, 1951, 1961, 1973, 1976, 20002, 20004, 20006, 20008, 20010,
];
const OUTFIT_PALETTE = [ // colour index -> [r, g, b] (0-255), used to tint outfits
  [255, 255, 255],
  [255, 212, 191],
  [255, 233, 191],
  [255, 255, 191],
  [233, 255, 191],
  [212, 255, 191],
  [191, 255, 191],
  [191, 255, 212],
  [191, 255, 233],
  [191, 255, 255],
  [191, 233, 255],
  [191, 212, 255],
  [191, 191, 255],
  [212, 191, 255],
  [233, 191, 255],
  [255, 191, 255],
  [255, 191, 233],
  [255, 191, 212],
  [255, 191, 191],
  [218, 218, 218],
  [191, 159, 143],
  [191, 175, 143],
  [191, 191, 143],
  [175, 191, 143],
  [159, 191, 143],
  [143, 191, 143],
  [143, 191, 159],
  [143, 191, 175],
  [143, 191, 191],
  [143, 175, 191],
  [143, 159, 191],
  [143, 143, 191],
  [159, 143, 191],
  [175, 143, 191],
  [191, 143, 191],
  [191, 143, 175],
  [191, 143, 159],
  [191, 143, 143],
  [182, 182, 181],
  [191, 127, 95],
  [191, 159, 95],
  [191, 191, 95],
  [159, 191, 95],
  [127, 191, 95],
  [95, 191, 95],
  [95, 191, 127],
  [95, 191, 159],
  [95, 191, 191],
  [95, 159, 191],
  [95, 127, 191],
  [95, 95, 191],
  [127, 95, 191],
  [159, 95, 191],
  [191, 95, 191],
  [191, 95, 159],
  [191, 95, 127],
  [191, 95, 95],
  [145, 145, 144],
  [191, 106, 63],
  [191, 148, 63],
  [191, 191, 63],
  [148, 191, 63],
  [106, 191, 63],
  [63, 191, 63],
  [63, 191, 106],
  [63, 191, 148],
  [63, 191, 191],
  [63, 148, 191],
  [63, 106, 191],
  [63, 63, 191],
  [106, 63, 191],
  [148, 63, 191],
  [191, 63, 191],
  [191, 63, 148],
  [191, 63, 106],
  [191, 63, 63],
  [109, 109, 109],
  [255, 85, 0],
  [255, 170, 0],
  [255, 255, 0],
  [170, 255, 0],
  [84, 255, 0],
  [0, 255, 0],
  [0, 255, 84],
  [0, 255, 170],
  [0, 255, 255],
  [0, 169, 255],
  [0, 85, 255],
  [0, 0, 255],
  [85, 0, 255],
  [169, 0, 255],
  [254, 0, 255],
  [255, 0, 170],
  [255, 0, 85],
  [255, 0, 0],
  [72, 72, 68],
  [191, 63, 0],
  [191, 127, 0],
  [191, 191, 0],
  [127, 191, 0],
  [63, 191, 0],
  [0, 191, 0],
  [0, 191, 63],
  [0, 191, 127],
  [0, 191, 191],
  [0, 127, 191],
  [0, 63, 191],
  [0, 0, 191],
  [63, 0, 191],
  [127, 0, 191],
  [191, 0, 191],
  [191, 0, 127],
  [191, 0, 63],
  [191, 0, 0],
  [36, 36, 36],
  [127, 42, 0],
  [127, 85, 0],
  [127, 127, 0],
  [85, 127, 0],
  [42, 127, 0],
  [0, 127, 0],
  [0, 127, 42],
  [0, 127, 85],
  [0, 127, 127],
  [0, 84, 127],
  [0, 42, 127],
  [0, 0, 127],
  [42, 0, 127],
  [84, 0, 127],
  [127, 0, 127],
  [127, 0, 85],
  [127, 0, 42],
  [127, 0, 0],
];
// END OUTFIT_MOUNT_DATA

// id -> animal-family tag ("equine", "bovine", ...). Live only: filled from the game's chunk by
// refreshGameTables, not part of the snapshot, so it is empty until that load succeeds.
const MOUNT_GROUPS = {};

function getOutfitIds() {
  return OUTFIT_IDS;
}

// BEGIN OUTFIT_MOUNT_PARSER
// Index of the `{` that opens the `levels`-th object enclosing position `idx`.
function openerBefore(src, idx, levels) {
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { if (--levels === 0) return i; } else depth--;
    }
  }
  return -1;
}

// Index just past the `}` that closes the object opening at `open`.
function closerAfter(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

const unquoteName = (raw) => { try { return JSON.parse(raw); } catch (_) { return raw.slice(1, -1); } };

// Reads the outfit table (entries carry `mountable:!0|!1`) and the mount table (entries carry
// `riderOffset:{...}` for some mounts) out of the game's chunk sources.
//
// Mount table entry shape in the game bundle (read from minified source, name of the table not
// confirmed): `{ id, name, rarity, group, riderOffset? }`.
//   - `rarity`: 1-5 (kept in MOUNTS).
//   - `group`: animal-family tag, apparently for grouping/filtering in the game UI. Values seen:
//     equine, bovine, monkey, canine, bird, aquatic, scaled, mythological, machine, voidling,
//     christmas. Parsed into MOUNT_GROUPS (live only, not in the snapshot) and shown in the mount
//     picker's tooltip. `group` also appears as this file's own `'sleqqus'` marker on injected
//     custom mounts (see nativeMountMap).
function parseGameTables(chunks) {
  const table = (src, marker) => {
    const at = src.indexOf(marker);
    const open = at < 0 ? -1 : openerBefore(src, at, 2);
    const end = open < 0 ? -1 : closerAfter(src, open);
    if (end < 0) throw new Error(`table around "${marker}" not found`);
    return src.slice(open, end);
  };
  const outfitSrc = chunks.find((c) => c.includes('mountable:!') && c.includes('rarity:'));
  const mountSrc = chunks.find((c) => c.includes('riderOffset:{'));
  if (!outfitSrc || !mountSrc) throw new Error('outfit/mount chunk not found');

  const mounts = {};
  const mountGroups = {};
  for (const m of table(mountSrc, 'riderOffset:{').matchAll(/\{id:(\d+),name:("(?:[^"\\]|\\.)*"),rarity:(\d)(?:,riderOffset:\{x:(-?\d+),y:(-?\d+)\})?(?:,group:"([^"]*)")?/g)) {
    const entry = [unquoteName(m[2]), +m[3]];
    if (m[4] !== undefined && (+m[4] || +m[5])) entry.push(+m[4], +m[5]); // rider offset, only when not 0,0
    mounts[+m[1]] = entry;
    if (m[6]) mountGroups[+m[1]] = m[6];
  }
  const mountable = {};
  const outfitIds = [];
  for (const m of table(outfitSrc, 'mountable:!').matchAll(/\{id:(\d+),name:("(?:[^"\\]|\\.)*")([^{}]*)\}/g)) {
    outfitIds.push(+m[1]);
    if (m[3].includes('mountable:!0')) mountable[+m[1]] = unquoteName(m[2]);
  }
  if (Object.keys(mounts).length < 50 || outfitIds.length < 50) throw new Error('table sizes look wrong');
  return { mounts, mountGroups, mountable, outfitIds, palette: parsePalette(chunks) };
}

// The outfit colour palette (head/body/legs/feet index -> RGB), as 0-255 triples. null if not found.
function parsePalette(chunks) {
  const marker = '[[1,1,1],[1,.8313725490196079';
  const src = chunks.find((c) => c.includes(marker));
  if (!src) return null;
  const start = src.indexOf(marker);
  let depth = 0;
  let end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']' && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0) return null;
  const rows = [...src.slice(start, end).matchAll(/\[([\d.]+),([\d.]+),([\d.]+)\]/g)]
    .map((m) => [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255)));
  return rows.length >= 100 ? rows : null;
}
// END OUTFIT_MOUNT_PARSER

// Mounts the game has no sprite for, taken from the Sleqqus Tibia LookType Generator (sleqqus.com/tlg).
// Each image is a 64x64 mount-only sprite rebuilt from TLG renders with different riders (a pixel one rider
// covers is read from the others; magenta background made transparent), so it composites with the player
// outfit like a native one. The rider offset is 0,0 for all of them. A mount the game later ships natively
// (an id in MOUNTS) wins over its entry here. id -> [name, rarity, image]
const SLEQQUS_MOUNTS = {
  1363: ["Krakoloss", 3,
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADtUlEQVR42u2ZwWpTQRSG79KFBr2irYZSpUYCLaJSIdAgIooLFxIQcVEiuHLpWn0AF65cCULfou/gC/gKvsaU/9R//HM6IW6EOXEOHHKT3Jb7f/PPOTOTrmvRokWLFi1atGjRokWLFi1atGjRokWLFiEi/c7/TrDlfD5Ps9lsbSEknxsbzyyHw6ElxE+nU/tsHd2Qfv04Sscf76QHo0tpPP5gSeF4hfDt7bklrvt+slYg0s/vLwwCXgEBub9/ZKlAkIAAALiGK6JDMNE71y/kxHu6AYkRLzkCEMbjcWgAJhSiv87uWn5+vpeF47svh1t2jXsAQacAcjDYtYwKwcRR+PuHI0teEwQgvH28aRBYHFkg+76PDYBiX9/bSgc3LufEe35OEIRAF7AGRIaQRx1CCYHX/A6fKQB1AWpAVABJASiEVQB2rlzMLmBrBACAiAQhF0CFQBCsBXQFAezd7NOj3VsGAckiCPGYDpG6golH72f7g2BNzn0dfYg/fDJNn968sleCYEtEXYgAILc2AOAqUNcC2gYpfvP8uZyEgKQjItWBLFBXgJoeCHv/qd0nGQSdAAiRlsZWuBRCSTgrvd8DcN7jM7pBAMQogFzeEgLtzj7PPYAueAhh0Q29QYgCQB8yb3K81bnpAQSI5h4AYukIXKsbACEEACx7CYIjTZF+00MXcArQATwb4AIo2iLIIFwddJZqd4rU97wPydFnvw8LAGLePe3S7Wt/IPhRpnjcNxmdvfd0CqwEUGVnMCEqCqOtx2CsD7xP79V7lojPNebby/s65eqyPwR5AJoEwPsUAIofrglTINgKkuJrG317KD4g5zXFY73PV14Tgq8BdIZOIw+gtpHPALDJod0hRked33EDxE6httfaoPXB/w+CqOrgA6PCB/QJ0XzlFpgQ/HG5rw0CoPNOqAoAt7cq2I+c3wbrtODfsAYUxHcqviYIC0dfOudLANQpvE+PyBRCSXyN02DhwMMvidUR+F6LJQHoYan+DwWpByrVAfBHXCpcHtTe85TYg+Hn3k0luOqEauqAQtCTH293fq/i1B36G4IvquqUGpfHxUNPLXil+a7tkRCYCsMDrXY7rOf/vt35dujtrAemPhVahDOBYhcAjNKCyNtdHeSE1w+ABc3bV0dcBflRX7aYcoUwxi9CJfv6hZDWjGWW1wVUmCngfxHStuiEnPnN0Le8KOI7ne8lC3NkpTAurR1LukiMUyFujnwLWyEm+VYapfCtXBgVBP1tJwkdpanQosU/jBNigF7UYDMyKQAAAABJRU5ErkJggg=="],
  1430: ["Shellodon", 3,
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEXElEQVR42u1aPWtUQRR9FoIYArIEknQuCMYsFpLChCzaiEGIhXamEIWAoJWWFqKFkEIsBDsLf4GVhQiKvT/ARkt/x8iZ5EzOu5n3dmzcu2YGLu/ty8vdOWfu58w2TR111FFHHXXUUUcdddRRRx111FFHHXV4G+FAji8BXz6/z5FwbIgJ441zFmwXKf+dece/f7i3EXYvD/lueLX3oAS8e4LC9vZ23yTjKhMsSLh+fjFnDZ36d3Z23JIQJwcZjUZdkwxmFcPb25eiJYCISZZToN8HAePxOBSaa1z9F1urloRQqN+f+WOCdIMJK5XcgSTg2hMLjuh36waYIFYJBExyB4DG6oOACW4Qdap+t1agEyyYaARfQEBWv7/8Ph4fIaDPCubmhi0pJUB0+rQCJcCQ0JK1tXdJVlefh+FwNz4/uzRIkiO4gFw/BOjnvYd3kty/OgpnTp6IwCEK+vevH1G+f/vUSpsk1H6PKxfQSWoceHLrSrixshBlZeF0JAEEYNUBGmAJ3FhAS5dnElqT0yyA1QZoXCn4DFJAwsunj1urj+tgsB4tYzAYtHTpd8T78kry35DAyebA0wIg+pwkwAoIHoLYoASoXtYQhX3EdEhQAhS8JQH3IEHBIyuAAFytFWj36LWLTBP9GwJg8kyJ++a/np5l0l4wV5+tMfzcEkDg6hoMiAS/vHwzCj4zPc7k3gCjvw2AeMYgCCFggMWVrkASZoGA7BYX0p2uPlOgZgBmAZJA8CQA1w7zd7sZEiM6gNkCiPmfQY/gbQbQ1TcW4HJjRCcVBfkcV5JA0JDNzY8H0X29lfuVBPV/3Ktu811+CNAKkASwnGVKg4CAwxR3SAIJoNmzEIJQL/cFCvYcptMJaq5maYt7gAFogqeQFFaCdAn8j83/BK/VpsteQCcNQFxNksDuj8LUx76ALqFFle0DMp2mn9SnVsAYkCMAgFWYBRgP9skbHNE5E5sjegBigUI02mvUJwHqCpnUF3V7bIZaJLBRsStMl7DWoGSQhK7dJM/NUGvnl9ag4AH2wuJ8lKX5U0lYCkvpGybp9n6kFjKHIoGboTwiw4YoBCTw77SEvrMCz81Qy3etr1sSLAE2JthCyH1PoJO29b0Sg9VXK7AWox2hNkuuTd4GPJ18rmFCHOg5H2zp0CziMvWxqlMScv7P97n6IKEvXpAIBsnCc4TpADf9ewL19VkTHm016XcB9H97OIp7vIf3X989BN9D7nTBs8LTFJaZYPj5Zp8AAMaK5wjgc7yH90EC3Yq6tW7wQEIqZuiXmJSSQkvAal672LSAUkgAsgCueA/v0wJUFwsoo3+6FmAmktpfS4IKT4V5MErw9j0CVv2eLCDFgMxqJBK6Chk1/UwWyIFvxRw3BAB8B9DO52hktPKT+4n/6zEV2tUKHVVh5x5i5pcfvVblyQUa2++XNDNmIyPX13fGFVNf+KoCMxmgKSWhY3cn6fQKPNcEFf/2r8RdZqkRmvr4A4gzBHZ3Z5CbAAAAAElFTkSuQmCC"],
  1599: ["Mutated Abomination", 3,
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE30lEQVR42u2avWtTURjGQ9PSktTU1DS0TUpKkwqW2sFKW8QPlFJLlQpWKlhwsIiO1cXNDxwUCqKLk4MIBUHEVdzEQTcnZ8F/QBxcXI48pzyn7z09N0mX3nuTc+Dl3I9z0zy/9+skaSrlhx9++OGHH3744Ycffvjhhx9++BHvoYS1n/iFhQU1OzurisWiakcYWmw2mzUQpqamVK1Wa7uI8BAIoVqtGgjlcrm90gEAZE1opyjQohkBpVJJ5fP5tokCLR7CYYRAAK0eBVowC6AEIKOgVQGoQqGgcx6CeQwQEN/qaRDwtsv7sFZqiapZo3hEBIDgWtLTQD06P6EF/P64FWpyHcUTBkEkUvzW2owR/2tlVNvPZ3eN4ZzrrkyV1NnagJJ7AgkiiZ8TjFc3yt1q63CPgUDDNa6TACCe3meLpCUOAoQRQpjhvvQ+N0aYYQDCLgFLUjSYNztSLtQ1QmIxlF0C4ldXV03bTFJt0KEOgXOVfh3qd86MB2Zc5zrMz4fnzQaJ+U8QbJkEgIIZdwjq3+ZFAwDpYBsBYB2gsBPIL0kIBNel+CQAMHVAet0VAawB44MptZyb0GbtBJ1tMkoAzRQjLfD4SN7pfRkBtOmxbQgE4dgJauHcNkcFYNdGJmzdem5apwAguPIf97AGuQ/xV0+k1LnJHRC45wIgC+J+Q9Ci/3z/YjY0DgiK4uHF96du6hCn13Fui6fX710KQrCizAjmnmC/9wZaLEQDAEy9W9cbGrYwWH//rBobu6WKxXk9QyDbHY4BBcJhP9aeGAAQ/+q2E4Cdeq55/6o6DMIBAMcE8Pj+A/2GIbpUWjEzQEAkBOMYgCAckSC9L1OA55jjVOm1WEKgeBsAw59RQBg4zmRGA8YUwEzRFC5rgSvFIoPALaxLPMIbMzwMUTIS4PnOzgMBA4Tu7gGTGoSA1wAAGREUPnQw2sjQYiUEnC8vLhrPd3Rs1wOEOERRfC43GTAAwDpCYNGUYgGAECg+DqmhRX/6/E29efvBiIfgdDprWheiQAIYHLygKpXrqlA4rQH09Aw7Ich9AYRKABAfdQRoAF1deWP2NzuZTCUAALkPg2iIlwBcEOx8Z1pAOIzpEVkKQGChcFINDS2r3t6aNhzjGsUfG8gF9gIy/6V4GM/rFDdnVEQVBVro0qGs7gKIAOQ8jnEN97Dm8pHKLgB9fUd3FcEQCM6/y2LI7rCxFGEUQCwMx3jz8pzi2RUgnMbrEgJTok4kaLH0OoX/fbkeHQDu+IKf1La9v7k4Z65BNHu+PCYEV13APSsapFj1eman7nydL0aTBvTyw6cvdCdAR5C5j24gC5vc/OCcxY4Q0CFc3UH+TYoFDCE8uk6wcu2GqmbS2uOYAYJvigAolKKleBprgGyRsAafAyLfHusogHgYjmESgsx3xw8hgdciBEQCC6P9STB+P3Fl0gEDAKaALHSWoLqvKdujhNDk8/sLAGLpeRggCAApCcLKa9UMhDr1IJ4QLPGBdbLNNQBh1oUUxfilQoPvB403pSDmetgzWCs7g6wPift1KER0w1TAej4rukKyxKO1MacJgN7EvXpbX6aBnBMHQHrd8mLDFLCjpglo8QNgb2khwrGhUWHQLMHJjAIpgCnRKPTlM4iGuO0C9wpgV1FsVADreL0l/mFqr15sev1/b+WZYf+RrRcAAAAASUVORK5CYII="],
  1724: ["Gorgon Hydra", 3,
    "data:image/png;base64,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"],
  1810: ["Primal Demonosaur", 3,
    "data:image/png;base64,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"],
};
const SLEQQUS_ICON = "data:image/png;base64,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";

// Entry for any mount id: the game's own table first, then the Sleqqus extras.
function mountEntry(id) { return MOUNTS[id] ?? SLEQQUS_MOUNTS[id]; }
function isSleqqusMount(id) { return !(id in MOUNTS) && id in SLEQQUS_MOUNTS; }
function mountSpriteUrl(id) { return isSleqqusMount(id) ? SLEQQUS_MOUNTS[id][2] : `/assets/playerMount/${id}.png`; }

// Makes the game itself draw the Sleqqus mounts (profile, board): its outfit canvas only rides a mount
// whose id is in the game's mount Map, and loads the sprite with `new Image().src = '/assets/playerMount/<id>.png'`.
// So (1) add the ids to that Map, found in webpack's module cache by shape (an exported `G` Map holding
// mount 368 plus an `X` name table), and (2) answer those sprite URLs from SLEQQUS_MOUNTS.
const NATIVE_MOUNT_PATH = /^\/assets\/playerMount\/(\d+)\.png(?:[?#].*)?$/;
let nativeMountMap = null;
let nativeMountsTimer = null;
let nativeMountsTries = 0;
let imageSrcDescriptor = null;
let imageSrcPatch = null;

function findNativeMountMap() {
  const registry = window.webpackChunk_N_E;
  if (!Array.isArray(registry) || typeof registry.push !== 'function') return null;
  let webpackRequire = null;
  try { registry.push([['ba-outfiter-mounts-probe'], {}, (req) => { webpackRequire = req; }]); } catch (_) { /* not ready */ }
  if (typeof webpackRequire !== 'function') return null;
  const isMountTable = (exp) => exp?.G instanceof Map && exp.G.has(368) && exp.X && typeof exp.X === 'object';
  for (const mod of Object.values(webpackRequire.c || {})) {
    if (isMountTable(mod?.exports)) return mod.exports.G;
  }
  // Not in the module cache (not loaded yet, or the cache is not exposed): find the module by its
  // source and require it.
  for (const [id, factory] of Object.entries(webpackRequire.m || {})) {
    if (typeof factory !== 'function' || !String(factory).includes('"Widow Queen"')) continue;
    try {
      const exp = webpackRequire(id);
      if (isMountTable(exp)) return exp.G;
    } catch (_) { /* try the next candidate */ }
  }
  return null;
}

// The game's outfit canvas re-reads the mount table only when its props change, so a player already
// wearing a Sleqqus mount needs a state nudge once the table knows it.
function refreshWornSleqqusMount() {
  const mountId = currentMountId();
  if (mountId === null || !isSleqqusMount(mountId)) return;
  globalThis.state.player.trigger.setState({ fn: (p) => ({ ...p, mountId: null }) });
  nativeMountsTimer = setTimeout(() => {
    nativeMountsTimer = null;
    globalThis.state.player.trigger.setState({ fn: (p) => ({ ...p, mountId }) });
  }, 100);
}

function installSleqqusMounts() {
  if (!imageSrcPatch) {
    const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (desc?.set && desc.configurable) {
      imageSrcDescriptor = desc;
      imageSrcPatch = {
        ...desc,
        set(value) {
          const match = typeof value === 'string' ? NATIVE_MOUNT_PATH.exec(value) : null;
          desc.set.call(this, match && isSleqqusMount(Number(match[1])) ? SLEQQUS_MOUNTS[match[1]][2] : value);
        }
      };
      Object.defineProperty(HTMLImageElement.prototype, 'src', imageSrcPatch);
    }
  }
  if (nativeMountMap || nativeMountsTimer) return;
  const attempt = () => {
    nativeMountsTimer = null;
    nativeMountMap = findNativeMountMap();
    if (nativeMountMap) {
      for (const id of Object.keys(SLEQQUS_MOUNTS).map(Number)) {
        if (isSleqqusMount(id) && !nativeMountMap.has(id)) {
          nativeMountMap.set(id, { id, name: SLEQQUS_MOUNTS[id][0], rarity: SLEQQUS_MOUNTS[id][1], group: 'sleqqus' });
        }
      }
      console.log('[Outfiter] Sleqqus mounts registered in the game mount table:',
        Object.keys(SLEQQUS_MOUNTS).filter((id) => nativeMountMap.get(Number(id))?.group === 'sleqqus').join(', ') || 'none (all native)',
        '| image src patch:', imageSrcPatch ? 'on' : 'FAILED');
      refreshWornSleqqusMount();
      return;
    }
    if (++nativeMountsTries < 40) nativeMountsTimer = setTimeout(attempt, 500);
    else console.warn('[Outfiter] Game mount table not found; Sleqqus mounts show only in the Outfiter picker');
  };
  attempt();
}

function uninstallSleqqusMounts() {
  if (nativeMountsTimer) clearTimeout(nativeMountsTimer);
  nativeMountsTimer = null;
  nativeMountsTries = 0;
  if (nativeMountMap) {
    for (const id of Object.keys(SLEQQUS_MOUNTS).map(Number)) {
      if (nativeMountMap.get(id)?.group === 'sleqqus') nativeMountMap.delete(id);
    }
    nativeMountMap = null;
  }
  // Only restore if nobody patched on top of us.
  if (imageSrcPatch && Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')?.set === imageSrcPatch.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', imageSrcDescriptor);
  }
  imageSrcPatch = null;
  imageSrcDescriptor = null;
}

function replaceContents(target, source) {
  if (Array.isArray(target)) {
    target.length = 0;
    target.push(...source);
  } else {
    Object.keys(target).forEach((k) => delete target[k]);
    Object.assign(target, source);
  }
}

async function loadGameTables(signal) {
  const urls = new Set();
  document.querySelectorAll('script[src]').forEach((s) => urls.add(s.src));
  performance.getEntriesByType('resource').forEach((r) => urls.add(r.name));
  const chunkUrls = [...urls].filter((u) => /\/_next\/static\/chunks\/[^?#]+\.js/.test(u));
  const texts = await Promise.all(chunkUrls.map((u) =>
    fetch(u, { signal }).then((r) => (r.ok ? r.text() : '')).catch(() => '')));
  return parseGameTables(texts);
}

// Outfits the account really has, versus the ones this mod adds locally. Whatever is in the player
// state that we did not add ourselves counts as owned (so an outfit bought later stays unmarked).
// Only the native "Change outfit" dialog: it is the one dialog with the Customize button (lucide
// palette icon). Other dialogs (Store, ...) also list outfit canvases and must stay untouched.
const OUTFIT_DIALOG = '[role="dialog"]:has(svg.lucide-palette)';
const ownedOutfits = new Set();
let addedOutfits = new Set();
let outfitBadgeStyle = null;

// ---- Corner badges (outfit list + mount picker) ----------------------------------------------
// One look for every "not owned / imported" marker: the icon on a soft dark glow, in a slot corner.
// The outfit list's slots are React-virtualized, so its badges are CSS pseudo-elements; the mount
// picker is ours, so its badges are real elements. Both use badgeDeclarations().
const BADGE = { size: 28, icon: 18 };
const BADGE_GLOW = 'radial-gradient(circle at center, rgba(8,4,18,0.9) 0%, rgba(8,4,18,0.8) 40%, rgba(8,4,18,0) 72%)';

// The extension's own icon, served via web_accessible_resources (assets/icons/*); the base URL is set
// by client.js and may not exist yet, in which case the badge is just the glow.
function outfiterIconUrl() {
  const base = window.BESTIARY_EXTENSION_BASE_URL;
  return base ? `${base}assets/icons/icon-32.png` : null;
}

// CSS declarations for a corner badge showing `icon` (null: glow only). corner: 'left' | 'right'.
function badgeDeclarations(icon, corner) {
  return `position:absolute;top:0;${corner}:0;z-index:2;width:${BADGE.size}px;height:${BADGE.size}px;image-rendering:pixelated;` +
    'background-repeat:no-repeat;background-position:center;' +
    (icon
      ? `background-image:url("${icon}"),${BADGE_GLOW};background-size:${BADGE.icon}px ${BADGE.icon}px,100% 100%;`
      : `background-image:${BADGE_GLOW};background-size:100% 100%;`);
}

// Marks the mod-added outfits in the native "Change outfit" list with CSS only: that list is a
// React-virtualized grid whose slots are recycled while scrolling, so injected nodes would go stale.
// Each slot is `button > .container-slot > .relative > canvas[data-outfit=<id>]`.
function updateOutfitBadgeStyle() {
  const rideableIds = Object.keys(MOUNTABLE_OUTFITS);
  if (addedOutfits.size === 0 && rideableIds.length === 0) {
    outfitBadgeStyle?.remove();
    outfitBadgeStyle = null;
    stopIconHover();
    return;
  }
  if (!outfitBadgeStyle) {
    outfitBadgeStyle = document.createElement('style');
    outfitBadgeStyle.id = 'outfiter-unowned-outfit-style';
    document.head.appendChild(outfitBadgeStyle);
  }
  const slotFor = (id) => `${OUTFIT_DIALOG} button > .container-slot:has(> .relative > canvas[data-outfit="${id}"])`;
  const group = (ids, pseudo = '') => ids.map((id) => `${slotFor(id)}${pseudo}`).join(',');
  const added = [...addedOutfits];

  let css = '';
  if (rideableIds.length) {
    // The account dropdown's "Mounts" item uses this same lucide paw-print.
    const paw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e6d6ff" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/>` +
      `<circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>` +
      `<path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;
    css += `${group(rideableIds, '::before')} { content: ''; position: absolute; left: ${ICON_PAW.inset}px; bottom: ${ICON_PAW.inset}px; z-index: 2; ` +
      `width: ${ICON_PAW.size}px; height: ${ICON_PAW.size}px; pointer-events: none; filter: drop-shadow(0 0 1px #000); ` +
      `background: url("data:image/svg+xml,${encodeURIComponent(paw)}") center / contain no-repeat; }\n`;
  }
  if (added.length) {
    css += `${group(added, '::after')} { content: ''; pointer-events: none; ${badgeDeclarations(outfiterIconUrl(), OUTFIT_BADGE_CORNER)} }
`;
  }
  outfitBadgeStyle.textContent = css;
  startIconHover();
}

// Hover tooltips. One delegated listener shows a tooltip we own, outside React's tree. A real badge
// carries its text in data-outfiter-tip (mount picker). The outfit list's icons are CSS
// pseudo-elements, which cannot be hovered on their own (hovering one hovers the whole slot), so
// there the listener checks whether the pointer is inside an icon's corner of the slot.
const OUTFIT_BADGE_CORNER = 'right'; // outfit added by Outfiter (not owned); the left holds the native star tier
const ICON_PAW = { size: 14, inset: 2 }; // bottom-left: outfit can ride mounts
let iconTip = null;
let iconMove = null;
let iconHide = null;

function iconTipFor(event) {
  const badge = event.target?.closest?.('[data-outfiter-tip]');
  if (badge) return badge.dataset.outfiterTip;
  const slot = event.target?.closest?.(`${OUTFIT_DIALOG} button > .container-slot`);
  const id = slot?.querySelector(':scope > .relative > canvas[data-outfit]')?.dataset.outfit;
  if (!slot || id === undefined) return null;
  const rect = slot.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (addedOutfits.has(Number(id)) && x >= rect.width - BADGE.size && y <= BADGE.size) {
    return t('mods.outfiter.tooltipNotOwned');
  }
  if (id in MOUNTABLE_OUTFITS && x <= ICON_PAW.inset + ICON_PAW.size && y >= rect.height - ICON_PAW.inset - ICON_PAW.size) {
    return t('mods.outfiter.tooltipCanRide');
  }
  return null;
}

function startIconHover() {
  if (iconMove) return;
  iconHide = () => { if (iconTip) iconTip.style.display = 'none'; };
  iconMove = (event) => {
    const text = iconTipFor(event);
    if (!text) { iconHide(); return; }
    if (!iconTip) {
      iconTip = document.createElement('div');
      iconTip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;white-space:nowrap;' +
        'padding:2px 6px;font-size:11px;line-height:13px;color:#e6d6ff;background:rgba(20,10,40,0.95);' +
        'border:1px solid #a56bff;';
      document.body.appendChild(iconTip);
    }
    iconTip.textContent = text;
    iconTip.style.display = 'block';
    const width = iconTip.offsetWidth;
    iconTip.style.left = `${Math.min(event.clientX + 12, window.innerWidth - width - 4)}px`;
    iconTip.style.top = `${event.clientY + 16}px`;
  };
  document.addEventListener('mousemove', iconMove, true);
  document.addEventListener('wheel', iconHide, true); // the list scrolls under a still pointer
  window.addEventListener('blur', iconHide);
}

function stopIconHover() {
  if (iconMove) {
    document.removeEventListener('mousemove', iconMove, true);
    document.removeEventListener('wheel', iconHide, true);
    window.removeEventListener('blur', iconHide);
  }
  iconMove = null;
  iconHide = null;
  iconTip?.remove();
  iconTip = null;
}

function mergeOutfitsIntoPlayer() {
  globalThis.state.player.trigger.setState({
    fn: (prev) => {
      prev.outfits.forEach((id) => { if (!addedOutfits.has(id)) ownedOutfits.add(id); });
      const ids = getOutfitIds();
      addedOutfits = new Set([...addedOutfits, ...ids.filter((id) => !ownedOutfits.has(id))]);
      return {
        ...prev,
        outfits: [...new Set([...prev.outfits, ...ids])], // Merge and deduplicate
      };
    },
  });
  updateOutfitBadgeStyle();
}

// The game rewrites player.outfits from server data (login hydration, account mutations), which drops
// the outfits merged in above. Re-merge whenever any are missing while the toggle is on, so enabling
// at runtime does not depend on the merge having happened after the game's last sync.
let playerGuardSub = null;

function startOutfitGuard() {
  if (playerGuardSub) return;
  playerGuardSub = globalThis.state.player.subscribe(() => {
    try {
      if (localStorage.getItem('outfiter-enabled') !== 'true') return;
      const have = new Set(globalThis.state.player.getSnapshot().context.outfits);
      if (getOutfitIds().some((id) => !have.has(id))) mergeOutfitsIntoPlayer();
    } catch (_) { /* storage or state unavailable */ }
  });
}

function stopOutfitGuard() {
  const sub = playerGuardSub;
  playerGuardSub = null;
  if (typeof sub === 'function') sub();
  else sub?.unsubscribe?.();
}

// Reading the tables re-downloads and scans every game chunk (seconds of main-thread work), so it
// runs once per page load; later toggles reuse MOUNTS/OUTFIT_IDS as they stand (live or snapshot).
let tablesSettled = false;

function refreshGameTables() {
  if (tablesAbort || tablesSettled) return;
  const controller = new AbortController();
  tablesAbort = controller;
  loadGameTables(controller.signal).then((tables) => {
    if (controller.signal.aborted) return;
    tablesSettled = true;
    replaceContents(MOUNTS, tables.mounts);
    replaceContents(MOUNT_GROUPS, tables.mountGroups);
    replaceContents(MOUNTABLE_OUTFITS, tables.mountable);
    replaceContents(OUTFIT_IDS, tables.outfitIds);
    if (tables.palette) replaceContents(OUTFIT_PALETTE, tables.palette);
    mergeOutfitsIntoPlayer();
    console.log('[Outfiter] Loaded live game tables:', OUTFIT_IDS.length, 'outfits,', Object.keys(MOUNTS).length, 'mounts');
  }).catch((error) => {
    if (!controller.signal.aborted) {
      tablesSettled = true;
      console.warn('[Outfiter] Live game tables unavailable, using bundled snapshot:', error.message);
    }
  }).finally(() => {
    if (tablesAbort === controller) tablesAbort = null;
  });
}

// Mountable outfit to switch to when the current one cannot ride a mount;
// null when the current outfit already can. Prefers outfits the player owns.
function pickMountableOutfit(ctx) {
  if (ctx?.outfitId in MOUNTABLE_OUTFITS) return null;
  const owned = ctx?.outfits || [];
  return owned.find(id => id in MOUNTABLE_OUTFITS) ?? Number(Object.keys(MOUNTABLE_OUTFITS)[0]);
}

// Sorted by rarity, then name.
function getMountIds() {
  return [...new Set([...Object.keys(MOUNTS), ...Object.keys(SLEQQUS_MOUNTS)])].map(Number).sort((a, b) =>
    mountEntry(a)[1] - mountEntry(b)[1] || mountEntry(a)[0].localeCompare(mountEntry(b)[0]));
}

function saveOutfitToStorage(outfitId, colors = null, mountId) {
  try {
    const outfitData = {
      outfitId: outfitId,
      colors: colors || {},
      timestamp: Date.now()
    };
    if (mountId !== undefined) outfitData.mountId = mountId;
    localStorage.setItem('outfiter-current-outfit', JSON.stringify(outfitData));
    console.log('[Outfiter] Saved outfit to localStorage:', outfitData);
  } catch (error) {
    console.error('[Outfiter] Error saving outfit to localStorage:', error);
  }
}

function loadOutfitFromStorage() {
  try {
    const saved = localStorage.getItem('outfiter-current-outfit');
    if (saved) {
      const outfitData = JSON.parse(saved);
      console.log('[Outfiter] Loaded outfit from localStorage:', outfitData);
      return outfitData;
    }
  } catch (error) {
    console.error('[Outfiter] Error loading outfit from localStorage:', error);
  }
  return null;
}

function forceOutfitChangeLocally(outfitId, colors = null, mountId) {
  try {
    console.log('[Outfiter] Forcing local outfit change for ID:', outfitId, 'mount:', mountId);

    globalThis.state.player.trigger.setState({
      fn: (prev) => ({
        ...prev,
        outfitId: outfitId,
        ...(mountId !== undefined && { mountId: mountId }),
        // Update colors if provided
        ...(colors && {
          head: colors.head || prev.head,
          body: colors.body || prev.body,
          legs: colors.legs || prev.legs,
          feet: colors.feet || prev.feet,
        }),
      }),
    });
    
    // Save to localStorage for persistence
    saveOutfitToStorage(outfitId, colors, mountId);

    console.log('[Outfiter] Successfully forced local outfit change');
    return true;
  } catch (error) {
    console.error('[Outfiter] Error forcing local outfit change:', error);
    return false;
  }
}

function restoreSavedOutfit() {
  try {
    const savedOutfit = loadOutfitFromStorage();
    if (savedOutfit && savedOutfit.outfitId) {
      console.log('[Outfiter] Restoring saved outfit:', savedOutfit.outfitId);
      
      // Apply the saved outfit
      globalThis.state.player.trigger.setState({
        fn: (prev) => ({
          ...prev,
          outfitId: savedOutfit.outfitId,
          ...('mountId' in savedOutfit && { mountId: savedOutfit.mountId }),
          // Restore colors if they exist
          ...(savedOutfit.colors && {
            head: savedOutfit.colors.head || prev.head,
            body: savedOutfit.colors.body || prev.body,
            legs: savedOutfit.colors.legs || prev.legs,
            feet: savedOutfit.colors.feet || prev.feet,
          }),
        }),
      });
      
      console.log('[Outfiter] Successfully restored saved outfit');
      return true;
    }
  } catch (error) {
    console.error('[Outfiter] Error restoring saved outfit:', error);
  }
  return false;
}

function showOutfitChangeNotification(message, type = 'success') {
  try {
    // Create a subtle notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : '#FF9800'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remove after 3 seconds
    const fadeTimer = setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      const removeTimer = setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        // Clean up timer references
        notificationTimers.delete(removeTimer);
      }, 300);
      notificationTimers.add(removeTimer);
    }, 3000);
    
    // Store timer for cleanup
    notificationTimers.add(fadeTimer);
    
  } catch (error) {
    console.error('[Outfiter] Error showing notification:', error);
  }
}

// Stop intercepting. Unhook only if we are still the top of the fetch chain; otherwise the wrapper
// stays installed as a pass-through (removing it would break the mods wrapped on top of it).
function releaseOutfitChangeErrors() {
  outfiterFetchActive = false;
  if (outfiterFetchWrapper && window.fetch === outfiterFetchWrapper) {
    outfiterFetchRestore?.();
    outfiterFetchWrapper = null;
    outfiterFetchRestore = null;
  }
}

function interceptOutfitChangeErrors() {
  try {
    outfiterFetchActive = true;
    // An earlier wrapper may still be in the fetch chain (other mods wrapped on top of it, so it
    // could not be unhooked); re-arm it instead of stacking a second one on itself.
    if (outfiterFetchWrapper) return true;

    // Hook into fetch to intercept outfit change API calls. `next` is the fetch this wrapper
    // delegates to; it is fixed at install time so it can never loop back into the wrapper.
    const next = window.fetch;
    outfiterFetchRestore = () => { window.fetch = next; };
    outfiterFetchWrapper = function(...args) {
      const [url, options] = args;
      if (!outfiterFetchActive) return next.apply(this, args);

      // Check if this is an outfit change request
      if (url && url.includes('account.changeOutfit') && options && options.method === 'POST') {
        return next.apply(this, args).then(async response => {
          // Extract outfit data from request
          let outfitId = null;
          let colors = null;
          let mountId; // undefined = request didn't carry a mount

          try {
            const requestBody = JSON.parse(options.body);
            if (requestBody['0'] && requestBody['0'].json) {
              const outfitData = requestBody['0'].json;
              outfitId = outfitData.outfitId;
              colors = outfitData.colors;
              mountId = outfitData.mountId;
            }
          } catch (parseError) {
            console.error('[Outfiter] Error parsing request body:', parseError);
          }
          
          // Check if the response indicates an error
          if (!response.ok || response.status >= 400) {
            try {
              const data = await response.clone().json();
              
              // Check if it's an outfit/mount not owned error
              const errMessage = data?.[0]?.error?.json?.message;
              if (typeof errMessage === 'string' &&
                  (errMessage.includes('does not have outfit') ||
                   errMessage.includes('does not have mount'))) {

                console.log('[Outfiter] Detected outfit/mount ownership error, forcing local change');

                // Force the outfit (and mount) change locally
                forceOutfitChangeLocally(outfitId, colors, mountId);
                
                // Return a successful response to prevent UI errors
                return new Response(JSON.stringify([{
                  result: {
                    data: {
                      success: true,
                      outfitId: outfitId,
                      colors: colors
                    }
                  }
                }]), {
                  status: 200,
                  statusText: 'OK',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
              } else {
                // Other types of errors - show warning but don't override
                console.warn('[Outfiter] Outfit change failed with error:', data);
                showOutfitChangeNotification(
                  t('mods.outfiter.outfitChangeFailed'),
                  'warning'
                );
              }
            } catch (error) {
              console.error('[Outfiter] Error reading response:', error);
            }
          } else {
            // Success case - save the outfit change
            console.log('[Outfiter] Successful outfit change, saving to localStorage');
            saveOutfitToStorage(outfitId, colors, mountId);
          }

          return response;
        }).catch(error => {
          console.error('[Outfiter] Network error during outfit change:', error);
          showOutfitChangeNotification(
            t('mods.outfiter.networkError'),
            'warning'
          );
          throw error; // Re-throw to maintain normal error handling
        });
      }
      
      // For non-outfit requests, use original fetch
      return next.apply(this, args);
    };
    window.fetch = outfiterFetchWrapper;

    console.log('[Outfiter] Successfully set up outfit change error interception');
    return true;
  } catch (error) {
    console.error('[Outfiter] Error setting up error interception:', error);
    return false;
  }
}

// =======================
// Mount selector
// =======================

function currentMountId() {
  return globalThis.state?.player?.getSnapshot?.().context?.mountId ?? null;
}

// ---- Outfit / mount preview ------------------------------------------------------------------
// Mirrors how the game's own outfit canvas draws a player: the outfit sprite is 2 frames wide (left =
// the sprite, right = a colour mask whose red/green/blue channels pick head/body/legs/feet), tinted
// by the palette; a mounted outfit uses /assets/playerOutfitMounted and is drawn over the mount
// sprite, shifted by the mount's rider offset.
const OUTFIT_SPRITE_OVERRIDES = new Set([145, 149, 1210, 1211]); // use /assets/playerOutfitOverride
const spriteImages = new Map();

function loadSprite(url) {
  if (!spriteImages.has(url)) {
    spriteImages.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    }).catch((error) => { spriteImages.delete(url); throw error; }));
  }
  return spriteImages.get(url);
}

function tintOutfit(data, width, height, colors) {
  const [head, body, legs, feet] = ['head', 'body', 'legs', 'feet']
    .map((part) => (OUTFIT_PALETTE[colors?.[part]] || [255, 255, 255]).map((v) => v / 255));
  const half = width / 2;
  const maskOffset = 4 * half;
  for (let y = 0; y < height; y++) {
    const row = 4 * y * width;
    for (let x = 0; x < half; x++) {
      const px = row + 4 * x;
      const r = data[px + maskOffset];
      const g = data[px + 1 + maskOffset];
      const b = data[px + 2 + maskOffset];
      let tint;
      if (r && g) tint = head;
      else if (r) tint = body;
      else if (g) tint = legs;
      else if (b) tint = feet;
      else continue;
      data[px] *= tint[0];
      data[px + 1] *= tint[1];
      data[px + 2] *= tint[2];
    }
  }
}

// Draws into `canvas`: the outfit alone (mountId null), the outfit riding the mount, or the mount
// alone (outfitId null).
async function renderOutfit(canvas, outfitId, colors, mountId) {
  if (outfitId === null) {
    const mountOnly = await loadSprite(mountSpriteUrl(mountId));
    canvas.width = mountOnly.width;
    canvas.height = mountOnly.height;
    canvas.getContext('2d').drawImage(mountOnly, 0, 0);
    return;
  }
  const mounted = mountId !== null && mountId !== undefined;
  const riderUrl = mounted
    ? `/assets/playerOutfitMounted/${outfitId}.png`
    : `/assets/${OUTFIT_SPRITE_OVERRIDES.has(outfitId) ? 'playerOutfitOverride' : 'playerOutfit'}/${outfitId}.png`;
  const [rider, mount] = await Promise.all([
    loadSprite(riderUrl),
    mounted ? loadSprite(mountSpriteUrl(mountId)) : null
  ]);

  const work = document.createElement('canvas');
  work.width = rider.width;
  work.height = rider.height;
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  workCtx.drawImage(rider, 0, 0);
  const pixels = workCtx.getImageData(0, 0, work.width, work.height);
  tintOutfit(pixels.data, work.width, work.height, colors);
  workCtx.putImageData(pixels, 0, 0);

  const half = rider.width / 2;
  if (!mount) {
    canvas.width = half;
    canvas.height = rider.height;
    canvas.getContext('2d').drawImage(work, 0, 0, half, rider.height, 0, 0, half, rider.height);
    return;
  }
  const [, , offsetX = 0, offsetY = 0] = MOUNTS[mountId] || [];
  canvas.width = mount.width;
  canvas.height = mount.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(mount, 0, 0);
  ctx.drawImage(work, 0, 0, half, rider.height,
    mount.width - half + offsetX, mount.height - rider.height + offsetY, half, rider.height);
}

// The mount you last rode, so riding can be switched off and back on without picking again.
const LAST_MOUNT_KEY = 'outfiter-last-mount';

function readLastMount() {
  try {
    const id = Number(localStorage.getItem(LAST_MOUNT_KEY));
    return mountEntry(id) ? id : null;
  } catch (_) { return null; }
}

function writeLastMount(id) {
  try { localStorage.setItem(LAST_MOUNT_KEY, String(id)); } catch (_) { /* storage unavailable */ }
}

function openMountSelector() {
  if (mountModal) mountModal.close();

  const player = globalThis.state?.player?.getSnapshot?.().context;
  const initial = currentMountId();
  const ownedMounts = new Set(player?.mounts || []);
  let selected = initial ?? readLastMount();
  let ride = initial !== null; // the toggle: ride the selected mount, or not

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-modals';
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.pointerEvents = 'auto'; // Radix sets body pointer-events:none while a menu is open

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.style.pointerEvents = 'auto';
  dialog.className = 'auto-centered fixed z-modals w-full shadow-lg outline-none max-w-[300px]';
  dialog.innerHTML = `
    <div>
      <h2 class="widget-top widget-top-text"><p data-mount-title></p></h2>
      <div class="widget-bottom pixel-font-16 p-3 text-whiteRegular">
        <div class="grid gap-3">
          <div class="grid grid-cols-[min-content_1fr] gap-2">
            <div class="container-slot surface-darker relative p-0.5 size-[76px]">
              <div role="none" class="has-rarity absolute inset-0 opacity-60" data-mount-preview-rarity></div>
              <div class="relative z-1 h-sprite w-sprite"><div class="absolute bottom-[-23px] right-[-23px] size-full" data-mount-preview></div></div>
            </div>
            <div class="flex flex-col overflow-hidden">
              <p class="pixel-font-32 line-clamp-1 text-whiteExp"></p>
              <p class="line-clamp-1" data-mount-name></p>
              <button type="button" data-mount-ride class="focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 mt-auto"></button>
            </div>
          </div>
          <div class="relative overflow-hidden frame-pressed-1 surface-dark h-[230px] px-1 pb-0" style="height:230px;">
            <div data-mount-grid style="height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;display:grid;grid-template-columns:repeat(3,79px);grid-auto-rows:52px;gap:4px;padding:4px 0;justify-content:center;align-content:start;"></div>
          </div>
          <p class="pixel-font-14 opacity-70" data-mount-note hidden></p>
        </div>
        <div role="none" class="separator my-2.5"></div>
        <div class="flex justify-end gap-2">
          <button data-mount-cancel class="focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14"></button>
          <button data-mount-save class="focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14"></button>
        </div>
      </div>
    </div>`;
  dialog.querySelector('.pixel-font-32').textContent = player?.name || '';
  dialog.querySelector('[data-mount-title]').textContent = t('mods.outfiter.changeMount');
  dialog.querySelector('[data-mount-cancel]').textContent = t('common.cancel');
  dialog.querySelector('[data-mount-save]').textContent = t('common.save');

  const grid = dialog.querySelector('[data-mount-grid]');
  const preview = dialog.querySelector('[data-mount-preview]');
  const previewRarity = dialog.querySelector('[data-mount-preview-rarity]');
  const nameEl = dialog.querySelector('[data-mount-name]');
  const rideBtn = dialog.querySelector('[data-mount-ride]');
  const cells = new Map();

  // Mounts only draw on a mountable outfit; otherwise grey them out (picking one still works and
  // switches the outfit on Save, see pickMountableOutfit).
  const canRide = player?.outfitId in MOUNTABLE_OUTFITS;
  const note = dialog.querySelector('[data-mount-note]');
  note.textContent = t('mods.outfiter.cannotRideNote');
  note.hidden = canRide;

  // The preview is your own outfit, riding the selected mount when riding is on (like the game's canvas).
  const previewCanvas = document.createElement('canvas');
  previewCanvas.height = 64;
  previewCanvas.className = 'pixelated absolute bottom-0 right-0 brightness-110';
  preview.appendChild(previewCanvas);
  let previewToken = 0;
  const paintPreview = (outfitId, mountId) => {
    const token = ++previewToken;
    if (mountId === null) previewCanvas.removeAttribute('data-mount');
    else previewCanvas.setAttribute('data-mount', String(mountId));
    renderOutfit(previewCanvas, outfitId, player, mountId).catch((error) => {
      if (token === previewToken) console.warn('[Outfiter] Preview failed:', error.message);
    });
  };

  const sprite = (id) => {
    const img = document.createElement('img');
    img.src = mountSpriteUrl(id);
    img.alt = mountEntry(id)[0];
    img.className = 'pixelated pointer-events-none absolute bottom-0 right-0';
    return img;
  };

  const refresh = () => {
    cells.forEach((el, id) => {
      const slot = el.firstChild;
      const greyed = !canRide && id !== null && id !== selected;
      const highlighted = id === null ? !ride : id === selected; // "none" lights up when riding is off
      slot.setAttribute('data-highlighted', String(highlighted));
      slot.style.filter = [greyed ? 'grayscale(1)' : '', highlighted ? 'brightness(1.25)' : ''].filter(Boolean).join(' ');
      slot.style.opacity = greyed ? '0.5' : '';
    });
    const riding = ride && selected !== null;
    const switchTo = riding ? pickMountableOutfit(player) : null;
    // Riding on: you on the mount. Riding off: the mount alone. No mount picked: just you.
    if (selected === null) paintPreview(player?.outfitId, null);
    else paintPreview(riding ? (switchTo ?? player?.outfitId) : null, selected);
    previewRarity.setAttribute('data-rarity', selected === null ? '' : String(mountEntry(selected)[1]));
    nameEl.textContent = selected === null
      ? t('mods.outfiter.noMount')
      : mountEntry(selected)[0] + (switchTo !== null ? ` + ${MOUNTABLE_OUTFITS[switchTo]}` : '');
    rideBtn.textContent = ride ? t('mods.outfiter.ridingOn') : t('mods.outfiter.ridingOff');
    rideBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 mt-auto ' +
      (ride ? 'frame-1-green active:frame-pressed-1-green surface-green' : 'frame-1 active:frame-pressed-1 surface-regular');
    rideBtn.disabled = selected === null;
    rideBtn.style.opacity = selected === null ? '0.5' : '';
  };

  const addSlot = (id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'group focus-style-visible';
    btn.title = id === null ? t('mods.outfiter.noMount') : `${mountEntry(id)[0]} (${id})${MOUNT_GROUPS[id] ? ` - ${MOUNT_GROUPS[id]}` : ''}${canRide ? '' : ` - ${t('mods.outfiter.needsMountableOutfit')}`}`;
    const slot = document.createElement('div');
    slot.className = 'container-slot surface-darker relative p-0.5 flex justify-end border-whiteDark pb-1 pr-1 pt-3.5';
    slot.style.cssText = 'width:79px;height:52px;box-sizing:border-box;';
    if (id !== null) {
      const rarity = document.createElement('div');
      rarity.setAttribute('role', 'none');
      rarity.className = 'has-rarity absolute inset-0 opacity-60';
      rarity.setAttribute('data-rarity', String(mountEntry(id)[1]));
      const box = document.createElement('div');
      box.className = 'relative z-1 h-sprite w-sprite';
      box.appendChild(sprite(id));
      slot.append(rarity, box);
      // One badge per slot, top-left, like the native outfit list's: the Sleqqus icon on a mount whose
      // image comes from sleqqus.com, else the Outfiter icon on any other mount the account does not own.
      const imported = isSleqqusMount(id);
      if (imported || !ownedMounts.has(id)) {
        const mark = document.createElement('span');
        mark.dataset.outfiterTip = t(imported ? 'mods.outfiter.tooltipMountSleqqus' : 'mods.outfiter.tooltipMountNotOwned');
        mark.style.cssText = badgeDeclarations(imported ? SLEQQUS_ICON : outfiterIconUrl(), 'left');
        slot.append(mark);
      }
    } else {
      // The slot's native padding is lopsided (pt-3.5 pr-1) and would push the icon off-center.
      slot.style.cssText += 'align-items:center;justify-content:center;padding:0;';
      slot.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7" ' +
        `aria-label="${t('mods.outfiter.noMount')}"><circle cx="12" cy="12" r="10"></circle><path d="m4.9 4.9 14.2 14.2"></path></svg>`;
    }
    btn.appendChild(slot);
    // Switching mounts keeps the Riding state. The "none" slot deselects the mount (preview shows just
    // the outfit); only the first pick after that turns riding on, so Save does something.
    btn.addEventListener('click', () => {
      if (id === null) {
        selected = null;
        ride = false;
      } else {
        if (selected === null) ride = true;
        selected = id;
      }
      refresh();
    });
    cells.set(id, btn);
    grid.appendChild(btn);
  };

  addSlot(null);
  getMountIds().forEach(addSlot);
  refresh();

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    dialog.remove();
    if (mountModal && mountModal.close === close) mountModal = null;
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', close);
  dialog.querySelector('[data-mount-cancel]').addEventListener('click', close);
  rideBtn.addEventListener('click', () => {
    if (selected === null) return;
    ride = !ride;
    refresh();
  });
  dialog.querySelector('[data-mount-save]').addEventListener('click', () => {
    const target = ride ? selected : null;
    if (selected !== null) writeLastMount(selected);
    const needsOutfit = target !== null && pickMountableOutfit(player) !== null;
    if (target !== initial || needsOutfit) window.Outfiter.setMount(target);
    close();
  });

  document.body.append(overlay, dialog);
  startIconHover();
  mountModal = { close };
}

function injectMountMenuItem(menu) {
  const text = (menu.textContent || '').toLowerCase();
  if (!text.includes('my account') && !text.includes('minha conta')) return;
  if (menu.querySelector('.outfiter-mount-menu-item')) return;

  const group = menu.querySelector('div[role="group"]');
  if (!group) return;

  const item = document.createElement('div');
  item.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none text-whiteRegular outfiter-mount-menu-item';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('data-orientation', 'vertical');
  item.setAttribute('data-radix-collection-item', '');
  item.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paw-print" aria-hidden="true">
      <circle cx="11" cy="4" r="2"></circle><circle cx="18" cy="8" r="2"></circle><circle cx="20" cy="16" r="2"></circle>
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"></path>
    </svg>
    <span data-outfiter-mounts-label></span>
  `;
  item.querySelector('[data-outfiter-mounts-label]').textContent = t('mods.outfiter.mountsMenuItem');
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close the account menu first; opening the dialog before the Escape lands
    // would let that same keypress cancel the dialog via its own Esc handler.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    const timer = setTimeout(() => {
      mountMenuTimers.delete(timer);
      openMountSelector();
    }, 100);
    mountMenuTimers.add(timer);
  });

  // Append-only: never splice into this React-owned Radix group (see CLAUDE.md). To show the item
  // right under the native "Outfits" entry, reorder visually with CSS `order` instead: the entries up
  // to and including "Outfits" get negative orders, ours lands just after, and everything else (incl.
  // items other mods append later) keeps order 0 in DOM order.
  const natives = [...group.children].filter((el) => el !== item);
  const outfitsIdx = natives.findIndex((el) => /outfit|traje/i.test(el.textContent || ''));
  if (outfitsIdx >= 0) {
    if (!/flex|grid/.test(getComputedStyle(group).display)) {
      group.style.display = 'flex';
      group.style.flexDirection = 'column';
    }
    natives.slice(0, outfitsIdx + 1).forEach((el, i) => { el.style.order = String((i - 1000) * 2); });
    item.style.order = String((outfitsIdx - 1000) * 2 + 1);
    group.appendChild(item);
    return;
  }

  // Another OT Mods item may already have added the shared section title.
  if (!group.querySelector('.ot-mods-menu-title')) {
    const sep = () => {
      const s = document.createElement('div');
      s.setAttribute('role', 'none');
      s.setAttribute('aria-orientation', 'horizontal');
      s.className = 'separator my-1';
      return s;
    };
    const title = document.createElement('div');
    title.className = 'dropdown-menu-item text-whiteExp ot-mods-menu-title';
    title.textContent = 'OT Mods';
    group.append(sep(), title, sep());
  }
  group.appendChild(item);
}

function startMountMenuObserver() {
  if (mountMenuObserver) return;

  const schedule = (menu) => {
    const timer = setTimeout(() => {
      mountMenuTimers.delete(timer);
      injectMountMenuItem(menu);
    }, 100);
    mountMenuTimers.add(timer);
  };

  mountMenuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const menu = node.getAttribute?.('role') === 'menu' ? node : node.querySelector?.('[role="menu"]');
        if (menu) schedule(menu);
      }
    }
  });
  mountMenuObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('[role="menu"]').forEach(schedule);
}

function stopMountMenuObserver() {
  if (mountMenuObserver) {
    mountMenuObserver.disconnect();
    mountMenuObserver = null;
  }
  mountMenuTimers.forEach(clearTimeout);
  mountMenuTimers.clear();
  if (mountModal) {
    mountModal.close?.();
    mountModal = null;
  }
  document.querySelectorAll('.outfiter-mount-menu-item').forEach(el => el.remove());
}

// =======================
// 3. Main Execution
// =======================

function executeOutfiter() {
  try {
    // Check if Outfiter is enabled via localStorage
    const outfiterEnabled = localStorage.getItem('outfiter-enabled') === 'true';
    
    if (!outfiterEnabled) {
      console.log('[Outfiter] Disabled - skipping execution');
      return false;
    }
    
    console.log('[Outfiter] Enabled - executing outfit operations');

    // Check if player state is available
    if (!globalThis.state?.player) {
      console.warn('[Outfiter] Player state not available yet');
      return false;
    }

    // Set outfits in player state (merge with existing outfits); the snapshot is used
    // until refreshGameTables() swaps in the live list.
    mergeOutfitsIntoPlayer();
    startOutfitGuard();
    refreshGameTables();
    installSleqqusMounts();

    // Define excluded items from bag pool (only if DATA is available)
    if (DATA_AVAILABLE) {
      const EXCLUDE_FROM_BAG_POOL = [
        DATA.Newcomer.id,
        DATA.Gamemaster.id,
        DATA.Citizen.id, // tutorial reward
        DATA["Golden Outfit"].id, // store gold sink
        DATA.Poof.id,
        DATA.Jester.id, // april fools
        DATA["Newly Wed"].id, // valentines day
        DATA["Ceremonial Garb"].id, // carnival
        DATA.Festive.id, // carnival
        DATA["Royal Pumpkin"].id, // halloween
        DATA["Pumpkin Mummy"].id, // halloween
        DATA["Sinister Archer"].id, // halloween
        DATA["Merry Garb"].id, // christmas
        DATA.Elven.id, // christmas
        DATA["Bat Knight"].id, // oathkeeper amazon achievement
        DATA["Crusader"].id, // black knight achievement
      ];
      console.log('[Outfiter] EXCLUDE_FROM_BAG_POOL defined with', EXCLUDE_FROM_BAG_POOL.length, 'items');
    } else {
      console.log('[Outfiter] DATA object not available, skipping EXCLUDE_FROM_BAG_POOL definition');
    }
    
    // Set up error interception for outfit changes
    interceptOutfitChangeErrors();
    startMountMenuObserver();

    // Restore saved outfit after a short delay to ensure state is ready
    restoreTimer = setTimeout(() => {
      restoreSavedOutfit();
    }, 1000);
    
    console.log('[Outfiter] Successfully executed outfit operations');
    return true;
  } catch (error) {
    console.error('[Outfiter] Error executing outfit operations:', error);
    return false;
  }
}

// =======================
// 3. Exports & Lifecycle Management
// =======================

exports = {
  init: function() {
    try {
      executeOutfiter();
      
      // Add event listener for outfiter toggle changes
      window.addEventListener('message', handleOutfiterToggle);
      
      return true;
    } catch (error) {
      console.error('[Outfiter] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      // Check if window exists before cleanup
      if (typeof window !== 'undefined') {
        // Remove event listener to prevent memory leaks
        window.removeEventListener('message', handleOutfiterToggle);
        
        // Clear any pending timers
        if (restoreTimer) {
          clearTimeout(restoreTimer);
          restoreTimer = null;
        }
        
        stopMountMenuObserver();
        stopOutfitGuard();
        uninstallSleqqusMounts();
        tablesSettled = false;
        if (tablesAbort) {
          tablesAbort.abort();
          tablesAbort = null;
        }
        outfitBadgeStyle?.remove();
        outfitBadgeStyle = null;
        stopIconHover();
        ownedOutfits.clear();
        addedOutfits = new Set();

        // Clear all notification timers
        notificationTimers.forEach(timer => {
          clearTimeout(timer);
        });
        notificationTimers.clear();
        
        // Clean up any remaining notifications
        const notifications = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        notifications.forEach(notification => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        });
        
        // Restore original fetch — only if our wrapper is still the current one
        // (don't clobber a mod that patched fetch on top of us).
        releaseOutfitChangeErrors();
        outfiterFetchWrapper = null;
        outfiterFetchRestore = null;
      }
      
      console.log('[Outfiter] Cleaned up successfully');
      return true;
    } catch (error) {
      console.error('[Outfiter] Cleanup error:', error);
      return false;
    }
  }
};

// Legacy window object for backward compatibility
if (typeof window !== 'undefined') {
  window.Outfiter = {
    init: exports.init,
    cleanup: exports.cleanup,
    get mountIds() { return getMountIds(); },
    // Live-apply the "Unlock all outfits and mounts" toggle; true when verified in the player state.
    setEnabled: applyEnabled,
    // Local-only mount: pass a mountIds entry, or null to dismount. Persists across reloads.
    setMount: function(mountId) {
      if (mountId !== null && !getMountIds().includes(mountId)) {
        console.warn('[Outfiter] Unknown mount ID:', mountId);
        return false;
      }
      const prev = loadOutfitFromStorage();
      const state = globalThis.state?.player?.getSnapshot?.().context;
      // A mount only draws on a mountable outfit, so switch to one if needed.
      const switchTo = mountId === null ? null : pickMountableOutfit(state);
      const outfitId = switchTo ?? prev?.outfitId ?? state?.outfitId;
      globalThis.state.player.trigger.setState({
        fn: (p) => ({ ...p, mountId, ...(switchTo !== null && { outfitId: switchTo }) })
      });
      saveOutfitToStorage(outfitId, prev?.colors, mountId);
      return true;
    }
  };
}

// True when every outfit this mod manages is in the player state right now.
function outfitsApplied() {
  const have = new Set(globalThis.state?.player?.getSnapshot?.().context.outfits || []);
  return getOutfitIds().every((id) => have.has(id));
}

// Undo executeOutfiter(): drop the outfits this mod added (owned ones stay), and remove its UI/hooks.
function revertOutfiter() {
  stopOutfitGuard();
  uninstallSleqqusMounts();
  stopMountMenuObserver();
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
  const added = addedOutfits;
  globalThis.state.player.trigger.setState({
    fn: (prev) => {
      const outfits = prev.outfits.filter((id) => !added.has(id));
      // Wearing an outfit we added: fall back to one the account really owns.
      const outfitId = outfits.includes(prev.outfitId) ? prev.outfitId : (outfits[0] ?? prev.outfitId);
      return { ...prev, outfits, outfitId };
    },
  });
  addedOutfits = new Set();
  outfitBadgeStyle?.remove();
  outfitBadgeStyle = null;
  stopIconHover();
  releaseOutfitChangeErrors();
}

// Apply the toggle to the running page. Returns true only if the result is verified in the player
// state, so the caller can warn that a page refresh is still needed.
function applyEnabled(enabled) {
  try {
    // Mod Settings calls this directly and also posts a message; the second call is a no-op.
    if (enabled && playerGuardSub && outfitsApplied()) return true;
    if (!enabled && !playerGuardSub && addedOutfits.size === 0) return true;
    if (enabled) {
      if (restoreTimer) clearTimeout(restoreTimer);
      const ran = executeOutfiter();
      const applied = ran && outfitsApplied();
      console.log('[Outfiter] applyEnabled(true):', { ran, applied, outfits: globalThis.state?.player?.getSnapshot?.().context.outfits?.length });
      return applied;
    }
    revertOutfiter();
    const cleared = !getOutfitIds().some((id) => addedOutfits.has(id)) &&
      (globalThis.state.player.getSnapshot().context.outfits || []).every((id) => ownedOutfits.has(id));
    console.log('[Outfiter] applyEnabled(false):', { cleared });
    return cleared;
  } catch (error) {
    console.error('[Outfiter] applyEnabled failed:', error);
    return false;
  }
}

// Message handler for outfiter toggle changes
function handleOutfiterToggle(event) {
  if (event.source !== window) return;

  if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'updateOutfiterMode') {
    console.log('[Outfiter] Received toggle update:', event.data.enabled);
    applyEnabled(!!event.data.enabled);
  }
}

// Event listener is now added in init() function

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}

