// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Outfiter] initializing...');

// =======================
// 2. Configuration & Constants
// =======================

// Cache DATA availability to avoid repeated checks
const DATA_AVAILABLE = typeof DATA !== 'undefined';

// Store original fetch for cleanup
let originalFetch = null;
let outfiterFetchWrapper = null;

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
  for (const m of table(mountSrc, 'riderOffset:{').matchAll(/\{id:(\d+),name:("(?:[^"\\]|\\.)*"),rarity:(\d)(?:,riderOffset:\{x:(-?\d+),y:(-?\d+)\})?/g)) {
    const entry = [unquoteName(m[2]), +m[3]];
    if (m[4] !== undefined && (+m[4] || +m[5])) entry.push(+m[4], +m[5]); // rider offset, only when not 0,0
    mounts[+m[1]] = entry;
  }
  const mountable = {};
  const outfitIds = [];
  for (const m of table(outfitSrc, 'mountable:!').matchAll(/\{id:(\d+),name:("(?:[^"\\]|\\.)*")([^{}]*)\}/g)) {
    outfitIds.push(+m[1]);
    if (m[3].includes('mountable:!0')) mountable[+m[1]] = unquoteName(m[2]);
  }
  if (Object.keys(mounts).length < 50 || outfitIds.length < 50) throw new Error('table sizes look wrong');
  return { mounts, mountable, outfitIds, palette: parsePalette(chunks) };
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
const ownedOutfits = new Set();
let addedOutfits = new Set();
let outfitBadgeStyle = null;

// Marks the mod-added outfits in the native "Change outfit" list with CSS only: that list is a
// React-virtualized grid whose slots are recycled while scrolling, so injected nodes would go stale.
// Each slot is `button > .container-slot > .relative > canvas[data-outfit=<id>]`.
function updateOutfitBadgeStyle() {
  const rideableIds = Object.keys(MOUNTABLE_OUTFITS);
  if (addedOutfits.size === 0 && rideableIds.length === 0) {
    outfitBadgeStyle?.remove();
    outfitBadgeStyle = null;
    stopOutfitIconHover();
    return;
  }
  if (!outfitBadgeStyle) {
    outfitBadgeStyle = document.createElement('style');
    outfitBadgeStyle.id = 'outfiter-unowned-outfit-style';
    document.head.appendChild(outfitBadgeStyle);
  }
  const slotFor = (id) => `[role="dialog"] button > .container-slot:has(> .relative > canvas[data-outfit="${id}"])`;
  const group = (ids, pseudo = '') => ids.map((id) => `${slotFor(id)}${pseudo}`).join(',');
  const added = [...addedOutfits];

  let css = '';
  if (rideableIds.length) {
    // The account dropdown's "Mount" item uses this same lucide paw-print.
    const paw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e6d6ff" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/>` +
      `<circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>` +
      `<path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;
    css += `${group(rideableIds, '::before')} { content: ''; position: absolute; left: ${ICON_PAW.inset}px; bottom: ${ICON_PAW.inset}px; z-index: 2; ` +
      `width: ${ICON_PAW.size}px; height: ${ICON_PAW.size}px; pointer-events: none; filter: drop-shadow(0 0 1px #000); ` +
      `background: url("data:image/svg+xml,${encodeURIComponent(paw)}") center / contain no-repeat; }\n`;
  }
  if (added.length) {
    // The extension's own icon, served via web_accessible_resources (assets/icons/*); the base URL
    // is set by client.js and may not exist yet, in which case a plain purple dot is used.
    const base = window.BESTIARY_EXTENSION_BASE_URL;
    const badge = base
      ? `background: url("${base}assets/icons/icon-32.png") center / contain no-repeat; image-rendering: pixelated; ` +
        'filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 2px #a56bff);'
      : 'background: #7b3fe4; border-radius: 50%;';
    css += `${group(added)} { box-shadow: inset 0 0 0 1px #a56bff; }\n` +
      `${group(added, '::after')} { content: ''; position: absolute; top: 0; right: 0; ` +
      `z-index: 2; width: ${ICON_HAT.size}px; height: ${ICON_HAT.size}px; pointer-events: none; ${badge} }\n`;
  }
  outfitBadgeStyle.textContent = css;
  startOutfitIconHover();
}

// Hover tooltips for the two icons. The icons are CSS pseudo-elements, which cannot be hovered on
// their own (hovering one hovers the whole slot), so one delegated listener checks whether the
// pointer is inside an icon's corner of the slot and shows a tooltip we own, outside React's tree.
const ICON_HAT = { size: 22 }; // top-right: outfit added by Outfiter (not owned)
const ICON_PAW = { size: 14, inset: 2 }; // bottom-left: outfit can ride mounts
let outfitIconTip = null;
let outfitIconMove = null;
let outfitIconHide = null;

function iconTipFor(event) {
  const slot = event.target?.closest?.('[role="dialog"] button > .container-slot');
  const id = slot?.querySelector(':scope > .relative > canvas[data-outfit]')?.dataset.outfit;
  if (!slot || id === undefined) return null;
  const rect = slot.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (addedOutfits.has(Number(id)) && x >= rect.width - ICON_HAT.size && y <= ICON_HAT.size) {
    return 'Not owned (added by Outfiter)';
  }
  if (id in MOUNTABLE_OUTFITS && x <= ICON_PAW.inset + ICON_PAW.size && y >= rect.height - ICON_PAW.inset - ICON_PAW.size) {
    return 'Can ride mounts';
  }
  return null;
}

function startOutfitIconHover() {
  if (outfitIconMove) return;
  outfitIconHide = () => { if (outfitIconTip) outfitIconTip.style.display = 'none'; };
  outfitIconMove = (event) => {
    const text = iconTipFor(event);
    if (!text) { outfitIconHide(); return; }
    if (!outfitIconTip) {
      outfitIconTip = document.createElement('div');
      outfitIconTip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;white-space:nowrap;' +
        'padding:2px 6px;font-size:11px;line-height:13px;color:#e6d6ff;background:rgba(20,10,40,0.95);' +
        'border:1px solid #a56bff;';
      document.body.appendChild(outfitIconTip);
    }
    outfitIconTip.textContent = text;
    outfitIconTip.style.display = 'block';
    const width = outfitIconTip.offsetWidth;
    outfitIconTip.style.left = `${Math.min(event.clientX + 12, window.innerWidth - width - 4)}px`;
    outfitIconTip.style.top = `${event.clientY + 16}px`;
  };
  document.addEventListener('mousemove', outfitIconMove, true);
  document.addEventListener('wheel', outfitIconHide, true); // the list scrolls under a still pointer
  window.addEventListener('blur', outfitIconHide);
}

function stopOutfitIconHover() {
  if (outfitIconMove) {
    document.removeEventListener('mousemove', outfitIconMove, true);
    document.removeEventListener('wheel', outfitIconHide, true);
    window.removeEventListener('blur', outfitIconHide);
  }
  outfitIconMove = null;
  outfitIconHide = null;
  outfitIconTip?.remove();
  outfitIconTip = null;
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

function refreshGameTables() {
  if (tablesAbort) return;
  const controller = new AbortController();
  tablesAbort = controller;
  loadGameTables(controller.signal).then((tables) => {
    if (controller.signal.aborted) return;
    replaceContents(MOUNTS, tables.mounts);
    replaceContents(MOUNTABLE_OUTFITS, tables.mountable);
    replaceContents(OUTFIT_IDS, tables.outfitIds);
    if (tables.palette) replaceContents(OUTFIT_PALETTE, tables.palette);
    mergeOutfitsIntoPlayer();
    console.log('[Outfiter] Loaded live game tables:', OUTFIT_IDS.length, 'outfits,', Object.keys(MOUNTS).length, 'mounts');
  }).catch((error) => {
    if (!controller.signal.aborted) {
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
  return Object.keys(MOUNTS).map(Number).sort((a, b) =>
    MOUNTS[a][1] - MOUNTS[b][1] || MOUNTS[a][0].localeCompare(MOUNTS[b][0]));
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

function interceptOutfitChangeErrors() {
  try {
    // Store original fetch if not already stored
    if (!originalFetch) {
      originalFetch = window.fetch;
    }
    
    // Hook into fetch to intercept outfit change API calls
    outfiterFetchWrapper = function(...args) {
      const [url, options] = args;

      // Check if this is an outfit change request
      if (url && url.includes('account.changeOutfit') && options && options.method === 'POST') {
        return originalFetch.apply(this, args).then(async response => {
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
                  'Outfit change failed - server error', 
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
            'Network error - outfit change may have failed', 
            'warning'
          );
          throw error; // Re-throw to maintain normal error handling
        });
      }
      
      // For non-outfit requests, use original fetch
      return originalFetch.apply(this, args);
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
    const mountOnly = await loadSprite(`/assets/playerMount/${mountId}.png`);
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
    mounted ? loadSprite(`/assets/playerMount/${mountId}.png`) : null
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
    return id in MOUNTS ? id : null;
  } catch (_) { return null; }
}

function writeLastMount(id) {
  try { localStorage.setItem(LAST_MOUNT_KEY, String(id)); } catch (_) { /* storage unavailable */ }
}

function openMountSelector() {
  if (mountModal) mountModal.close();

  const player = globalThis.state?.player?.getSnapshot?.().context;
  const initial = currentMountId();
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
      <h2 class="widget-top widget-top-text"><p>Change mount</p></h2>
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
          <button data-mount-cancel class="focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14">Cancel</button>
          <button data-mount-save class="focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14">Save</button>
        </div>
      </div>
    </div>`;
  dialog.querySelector('.pixel-font-32').textContent = player?.name || '';

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
  note.textContent = 'Outfit cannot ride: picking a mount switches it.';
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
    img.src = `/assets/playerMount/${id}.png`;
    img.alt = MOUNTS[id][0];
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
    previewRarity.setAttribute('data-rarity', selected === null ? '' : String(MOUNTS[selected][1]));
    nameEl.textContent = selected === null
      ? 'No mount'
      : MOUNTS[selected][0] + (switchTo !== null ? ` + ${MOUNTABLE_OUTFITS[switchTo]}` : '');
    rideBtn.textContent = ride ? 'Riding: On' : 'Riding: Off';
    rideBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 mt-auto ' +
      (ride ? 'frame-1-green active:frame-pressed-1-green surface-green' : 'frame-1 active:frame-pressed-1 surface-regular');
    rideBtn.disabled = selected === null;
    rideBtn.style.opacity = selected === null ? '0.5' : '';
  };

  const addSlot = (id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'group focus-style-visible';
    btn.title = id === null ? 'No mount' : `${MOUNTS[id][0]} (${id})${canRide ? '' : ' - needs a mountable outfit'}`;
    const slot = document.createElement('div');
    slot.className = 'container-slot surface-darker relative p-0.5 flex justify-end border-whiteDark pb-1 pr-1 pt-3.5';
    slot.style.cssText = 'width:79px;height:52px;box-sizing:border-box;';
    if (id !== null) {
      const rarity = document.createElement('div');
      rarity.setAttribute('role', 'none');
      rarity.className = 'has-rarity absolute inset-0 opacity-60';
      rarity.setAttribute('data-rarity', String(MOUNTS[id][1]));
      const box = document.createElement('div');
      box.className = 'relative z-1 h-sprite w-sprite';
      box.appendChild(sprite(id));
      slot.append(rarity, box);
    } else {
      // The slot's native padding is lopsided (pt-3.5 pr-1) and would push the icon off-center.
      slot.style.cssText += 'align-items:center;justify-content:center;padding:0;';
      slot.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7" ' +
        'aria-label="No mount"><circle cx="12" cy="12" r="10"></circle><path d="m4.9 4.9 14.2 14.2"></path></svg>';
    }
    btn.appendChild(slot);
    // Switching mounts keeps the Riding state. The "none" slot is just riding off (the selected mount
    // is kept); only the very first pick turns riding on, so Save does something.
    btn.addEventListener('click', () => {
      if (id === null) {
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
    Mount
  `;
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

  // Append-only: never splice into this React-owned Radix group (see CLAUDE.md).
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
    refreshGameTables();

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
        if (tablesAbort) {
          tablesAbort.abort();
          tablesAbort = null;
        }
        outfitBadgeStyle?.remove();
        outfitBadgeStyle = null;
        stopOutfitIconHover();
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
        if (originalFetch && (outfiterFetchWrapper == null || window.fetch === outfiterFetchWrapper)) {
          window.fetch = originalFetch;
        }
        originalFetch = null;
        outfiterFetchWrapper = null;
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

// Message handler for outfiter toggle changes
function handleOutfiterToggle(event) {
  if (event.source !== window) return;
  
  if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'updateOutfiterMode') {
    const enabled = event.data.enabled;
    console.log('[Outfiter] Received toggle update:', enabled);
    
    if (enabled) {
      // Re-execute when enabled
      executeOutfiter();
    } else {
      console.log('[Outfiter] Disabled via toggle - no action needed');
    }
  }
}

// Event listener is now added in init() function

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}

