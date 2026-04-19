/*
================================================================================
Console — open DevTools on Bestiary Arena (loader injected), then paste:

dumpEquipmentLuaTable();
dumpEquipmentLuaTable({ wikiPage: true });
dumpEquipmentLuaTable({ wikiPage: true, includeTiers: false });
dumpEquipmentLuaTable({ wikiPage: true, copy: false });
buildEquipmentRoomPresenceForConsole();

================================================================================
*/

/**
 * Console-oriented helpers to emit Lua-style equipment rows with real map names.
 *
 * Usage:
 * - `dumpEquipmentLuaTable()` — one line per item (Raid/Map lists joined with ", " so wiki infoboxes split map links).
 * - `dumpEquipmentLuaTable({ wikiPage: true })` — full `return { ... }` block for wiki
 *   (comments, _Tiers, aligned keys). BoostedMap uses `equipmentDatabase.HARDCODED_BOOSTED_MAP`
 *   (equipment-database.js), else today's daily boost when it matches, else false.
 *
 * Sources (keep constants in sync when those mods change):
 * - Cyclopedia.js: buildEquipmentCreatureCache (ROOMS actors with equip.gameId)
 * - Better Boosted Maps.js: EXCLUDED_EQUIPMENT (boost column when not featured today)
 * - Better Exaltation Chest.js: EXCLUDED_EQUIPMENT (chest)
 */

console.log('[equipment-lua-export.js] Loading equipment Lua export helpers...');

// Better Exaltation Chest — equipment that cannot come from exaltation chests
const NO_EXALTATION_CHEST = new Set([
  'Amazon Armor',
  'Amazon Helmet',
  'Amazon Shield',
  'Earthborn Titan Armor',
  'Fireborn Giant Armor',
  'Hailstorm Rod',
  'Orclops Santa',
  'Paladin Armor',
  'Windborn Colossus Armor',
  'Witch Hat'
]);

// Better Boosted Maps — equipment that can never be the daily boosted drop
const BOOST_EXCLUDED_EQUIPMENT = new Set([
  'Amazon Armor',
  'Amazon Helmet',
  'Amazon Shield',
  'Earthborn Titan Armor',
  'Fireborn Giant Armor',
  'Hailstorm Rod',
  'Jester Hat',
  'Orclops Santa',
  'Paladin Armor',
  'Rubber Cap',
  'Steel Boots',
  'Windborn Colossus Armor',
  'Witch Hat'
]);

function isRaidRoomId(roomId) {
  try {
    if (typeof window.mapsDatabase?.isRaid === 'function') {
      return window.mapsDatabase.isRaid(roomId);
    }
  } catch (_) {}
  try {
    return globalThis.state?.utils?.ROOMS?.[roomId]?.raid === true;
  } catch (_) {
    return false;
  }
}

function getRoomDisplayName(roomId) {
  const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
  return roomNames[roomId] || roomId;
}

/**
 * @returns {Map<number, { raidNames: Set<string>, mapNames: Set<string> }>}
 */
function buildEquipmentRoomPresence() {
  const byEquipId = new Map();
  const rooms = globalThis.state?.utils?.ROOMS;
  if (!rooms) {
    console.warn('[equipment-lua-export.js] state.utils.ROOMS missing');
    return byEquipId;
  }

  const addEquipOnRoom = (equipGameId, roomId) => {
    if (!equipGameId || !roomId) return;
    if (!byEquipId.has(equipGameId)) {
      byEquipId.set(equipGameId, { raidNames: new Set(), mapNames: new Set() });
    }
    const display = getRoomDisplayName(roomId);
    const bucket = byEquipId.get(equipGameId);
    if (isRaidRoomId(roomId)) {
      bucket.raidNames.add(display);
    } else {
      bucket.mapNames.add(display);
    }
  };

  const scanRoom = (room) => {
    try {
      const roomId = room?.id;
      const actors = room?.file?.data?.actors;
      if (!roomId || !actors || !Array.isArray(actors)) return;
      actors.forEach((actor) => {
        const gid = actor?.equip?.gameId;
        if (gid) addEquipOnRoom(gid, roomId);
      });
    } catch (e) {
      console.warn('[equipment-lua-export.js] scanRoom error', e);
    }
  };

  if (Array.isArray(rooms)) {
    rooms.forEach(scanRoom);
  } else {
    Object.values(rooms).forEach(scanRoom);
  }

  return byEquipId;
}

function getEquipmentGameIdByName(equipmentName) {
  const lower = equipmentName.toLowerCase();
  try {
    if (window.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds) {
      const id = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get(lower);
      if (id != null) return id;
    }
  } catch (_) {}
  const utils = globalThis.state?.utils;
  if (!utils?.getEquipment) return null;
  for (let i = 1; i < 2000; i++) {
    try {
      const eq = utils.getEquipment(i);
      if (eq?.metadata?.name?.toLowerCase() === lower) return i;
    } catch {
      break;
    }
  }
  return null;
}

function luaEscape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function luaStringLiteral(value) {
  if (value == null || value === '') return 'nil';
  return `"${luaEscape(value)}"`;
}

/** Comma-space: MediaWiki / infobox parsers here split map names on commas, not on ";". */
const LIST_SEPARATOR = ', ';

function sortedJoin(set, separator = LIST_SEPARATOR) {
  return [...set].sort((a, b) => a.localeCompare(b)).join(separator);
}

/** Pad `["Name"]` so `=` lines up for wiki-style tables. */
function formatEquipmentLuaKey(name, targetBracketEndCol = 31) {
  const key = `["${luaEscape(name)}"]`;
  const spaces = Math.max(1, targetBracketEndCol - key.length);
  return `${key}${' '.repeat(spaces)}=`;
}

/** Default _Tiers block for wiki `return { ... }` output (edit in this file if stats change). */
const WIKI_DEFAULT_TIERS_BLOCK = `    -- [[ TIERS REFERENCE ]]
    ["_Tiers"] = {
        ["Grey"]   = { hp = 20,  ad = 1, ap = 2,  cost = 50 },
        ["Green"]  = { hp = 40,  ad = 2, ap = 5,  cost = 100 },
        ["Blue"]   = { hp = 60,  ad = 4, ap = 10, cost = 150 },
        ["Purple"] = { hp = 90,  ad = 6, ap = 15, cost = 200 },
        ["Yellow"] = { hp = 120, ad = 8, ap = 20, cost = 0 }
    },`;

/** Raid = false for these rows (infobox: hide raid icon; e.g. Jester Hat is not a raid drop). */
const RAID_FORCE_FALSE = new Set(['Jester Hat']);

function getHardcodedBoostedMapTable() {
  try {
    return (globalThis.window || window)?.equipmentDatabase?.HARDCODED_BOOSTED_MAP || {};
  } catch (_) {
    return {};
  }
}

/**
 * BoostedMap column:
 * - equipmentDatabase.HARDCODED_BOOSTED_MAP (see equipment-database.js): string or false when listed.
 * - Else excluded from daily boost (Better Boosted Maps list): false.
 * - Else today's daily.boostedMap when equipId matches: room display name.
 * - Else false.
 */
function getBoostedMapLuaValue(equipGameId, equipmentName) {
  const HARDCODED_BOOSTED_MAP = getHardcodedBoostedMapTable();
  if (Object.prototype.hasOwnProperty.call(HARDCODED_BOOSTED_MAP, equipmentName)) {
    const v = HARDCODED_BOOSTED_MAP[equipmentName];
    if (v === false || v == null || v === '') {
      return 'false';
    }
    return luaStringLiteral(v);
  }

  if (BOOST_EXCLUDED_EQUIPMENT.has(equipmentName)) {
    return 'false';
  }

  let boosted = null;
  try {
    boosted = globalThis.state?.daily?.getSnapshot?.()?.context?.boostedMap || null;
  } catch (_) {}

  if (!boosted || boosted.equipId == null || equipGameId == null) {
    return 'false';
  }

  if (String(boosted.equipId) !== String(equipGameId)) {
    return 'false';
  }

  return luaStringLiteral(getRoomDisplayName(boosted.roomId));
}

function getEquipmentNamesList() {
  if (window.equipmentDatabase?.ALL_EQUIPMENT?.length) {
    return [...window.equipmentDatabase.ALL_EQUIPMENT].sort((a, b) => a.localeCompare(b));
  }
  const out = [];
  const utils = globalThis.state?.utils;
  if (!utils?.getEquipment) return out;
  for (let i = 1; ; i++) {
    try {
      const n = utils.getEquipment(i)?.metadata?.name;
      if (n) out.push(n);
      else break;
    } catch {
      break;
    }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

/**
 * Build Lua assignment lines for all equipment (Cyclopedia-style map presence + BBM rules).
 * @param {{
 *   copy?: boolean,
 *   wikiPage?: boolean,
 *   includeTiers?: boolean,
 *   keyColumn?: number
 * }} options
 * - wikiPage: wrap in `return { ... }`, wiki comments, comma-separated Raid/Map lists (for per-map links), aligned keys.
 * - includeTiers: when wikiPage, include WIKI_DEFAULT_TIERS_BLOCK (default true).
 * @returns {string}
 */
function dumpEquipmentLuaTable(options = {}) {
  const copy = options.copy !== false;
  const wikiPage = options.wikiPage === true;
  const includeTiers = options.includeTiers !== false;

  const presence = buildEquipmentRoomPresence();
  const names = getEquipmentNamesList();

  let keyColumn = typeof options.keyColumn === 'number' ? options.keyColumn : null;
  if (wikiPage && keyColumn == null) {
    keyColumn = 31;
    for (const name of names) {
      keyColumn = Math.max(keyColumn, `["${luaEscape(name)}"]`.length + 1);
    }
  }
  if (keyColumn == null) {
    keyColumn = 31;
  }

  const lines = names.map((name) => {
    const gid = getEquipmentGameIdByName(name);
    const p = gid != null ? presence.get(gid) : null;

    const chest = NO_EXALTATION_CHEST.has(name) ? 'No' : 'Yes';
    const raidLua = (() => {
      if (RAID_FORCE_FALSE.has(name)) {
        return 'false';
      }
      if (p && p.raidNames.size > 0) {
        return luaStringLiteral(sortedJoin(p.raidNames));
      }
      return 'false';
    })();
    const mapLua =
      p && p.mapNames.size > 0 ? luaStringLiteral(sortedJoin(p.mapNames)) : 'false';
    const boostedLua = getBoostedMapLuaValue(gid, name);

    const lhs = wikiPage ? formatEquipmentLuaKey(name, keyColumn) : `["${luaEscape(name)}"]            =`;
    return `${lhs} { chest = "${chest}",  Raid = ${raidLua}, Map = ${mapLua}, BoostedMap = ${boostedLua} },`;
  });

  let text;
  if (wikiPage) {
    const tiersPart = includeTiers ? `${WIKI_DEFAULT_TIERS_BLOCK}\n\n` : '';
    text = `return {
${tiersPart}    -- [[ EQUIPMENT LIST ]]
    -- chest = "Yes"/"No"
    -- Raid, Map, BoostedMap = "Location Name" or false
${lines.map((line) => `    ${line}`).join('\n')}
}`;
  } else {
    text = lines.join('\n');
  }

  console.log(text);
  if (copy && typeof copy === 'function') {
    try {
      copy(text);
    } catch (_) {}
  }
  return text;
}

const globalWindow = globalThis.window || window;
if (globalWindow) {
  globalWindow.dumpEquipmentLuaTable = dumpEquipmentLuaTable;
  globalWindow.buildEquipmentRoomPresenceForConsole = buildEquipmentRoomPresence;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dumpEquipmentLuaTable,
    buildEquipmentRoomPresence,
    getHardcodedBoostedMapTable,
    NO_EXALTATION_CHEST,
    BOOST_EXCLUDED_EQUIPMENT
  };
}
