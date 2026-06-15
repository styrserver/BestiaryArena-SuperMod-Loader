/*
================================================================================
Console — open DevTools on Bestiary Arena (loader injected), then paste:

dumpEquipmentWikiLua();
dumpEquipmentWikiLua({ includeTiers: false });
dumpEquipmentWikiLua({ download: false, copy: true });
dumpEquipmentWikiLua({ filename: 'equipment.lua' });
dumpEquipmentLuaTable({ wikiPage: true });
buildEquipmentRoomPresenceForConsole();
diffEquipmentLuaExclusionSets();
// Optional override when mods are disabled:
// diffEquipmentLuaExclusionSets({ exaltationChest: [...], boostedMaps: [...] });

================================================================================
Maintainer workflow
================================================================================
1. Reload extension + game; confirm "[equipment-lua-export.js] Loading..." in console.
2. After mod rule changes, run diffEquipmentLuaExclusionSets() (reads live mod lists when loaded)
   and update EXALTATION_CHEST_EXCLUDED / BOOST_MAP_EXCLUDED below when out of sync.
3. After map/boost changes, update HARDCODED_BOOSTED_MAP in equipment-database.js (not here).
4. Run dumpEquipmentWikiLua(); downloads equipment-wiki-YYYY-MM-DD.lua — paste into the wiki page.
5. Spot-check rows against Cyclopedia Arsenal; use buildEquipmentRoomPresenceForConsole() for Raid/Map bugs.

Sync map (edit the matching source when rules change):
  EXALTATION_CHEST_EXCLUDED  ↔  mods/Super Mods/Better Exaltation Chest.js EXCLUDED_EQUIPMENT
  BOOST_MAP_EXCLUDED         ↔  mods/Super Mods/Better Boosted Maps.js EXCLUDED_EQUIPMENT
  HARDCODED_BOOSTED_MAP      ↔  database/equipment-database.js (shared with Cyclopedia, BBM)
  Raid/Map columns           ↔  Cyclopedia buildEquipmentCreatureCache (ROOMS actors, equip.gameId)
  RAID_FORCE_FALSE           ↔  exporter-only wiki infobox rule (no mod source)
  WIKI_DEFAULT_TIERS_BLOCK   ↔  equipment-database.js EQUIPMENT_TIER_STAT_BONUSES
================================================================================
*/

/**
 * Console-oriented helpers to emit Lua-style equipment rows with real map names.
 *
 * Usage:
 * - `dumpEquipmentLuaTable()` — one line per item (Raid/Map lists joined with ", " so wiki infoboxes split map links).
 * - `dumpEquipmentWikiLua()` — full wiki `return { ... }` block (comments, _Tiers, aligned keys);
 *   downloads a .lua file by default (`{ copy: true }` or `{ download: false }` to override).
 *   Equipment rows: live `getEquipment()` scan ∪ `ALL_EQUIPMENT` ∪ `HARDCODED_BOOSTED_MAP` keys
 *   (avoids stale equipment-database cache omitting new game items).
 *   BoostedMap uses `equipmentDatabase.HARDCODED_BOOSTED_MAP` (equipment-database.js),
 *   else today's daily boost when it matches, else false.
 * - `diffEquipmentLuaExclusionSets()` — compare local lists to live mod globals (mods must be enabled).
 */

console.log('[equipment-lua-export.js] Loading equipment Lua export helpers...');

// Better Exaltation Chest.js EXCLUDED_EQUIPMENT — keep in sync manually
const EXALTATION_CHEST_EXCLUDED = [
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
];

// Better Boosted Maps.js EXCLUDED_EQUIPMENT — keep in sync manually
const BOOST_MAP_EXCLUDED = [
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
];

const NO_EXALTATION_CHEST = new Set(EXALTATION_CHEST_EXCLUDED);
const BOOST_EXCLUDED_EQUIPMENT = new Set(BOOST_MAP_EXCLUDED);

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

/** Default _Tiers block for wiki `return { ... }` output (from equipment-database.js). */
function buildWikiDefaultTiersBlock() {
  const tiers =
    (globalThis.window || window)?.equipmentDatabase?.EQUIPMENT_TIER_STAT_BONUSES ||
    {
      Grey: { hp: 20, ad: 1, ap: 2, cost: 50 },
      Green: { hp: 40, ad: 2, ap: 5, cost: 100 },
      Blue: { hp: 60, ad: 4, ap: 10, cost: 150 },
      Purple: { hp: 90, ad: 6, ap: 15, cost: 200 },
      Yellow: { hp: 120, ad: 8, ap: 20, cost: 0 }
    };

  const rows = Object.entries(tiers).map(([label, stats]) => {
    const padded = `["${label}"]`.padEnd(11, ' ');
    return `        ${padded} = { hp = ${stats.hp},  ad = ${stats.ad}, ap = ${stats.ap},  cost = ${stats.cost} }`;
  });

  return `    -- [[ TIERS REFERENCE ]]

    ["_Tiers"] = {
${rows.join(',\n')}
    },`;
}

const WIKI_DEFAULT_TIERS_BLOCK = buildWikiDefaultTiersBlock();

function formatEquipmentLuaRow(name, fields, keyColumn, wikiPage) {
  const lhs = wikiPage
    ? formatEquipmentLuaKey(name, keyColumn)
    : `["${luaEscape(name)}"]            =`;
  return `${lhs} { chest = "${fields.chest}",  Raid = ${fields.raid}, Map = ${fields.map}, BoostedMap = ${fields.boosted} },`;
}

function buildWikiLuaDocument(lines, includeTiers) {
  const tiersPart = includeTiers ? `${WIKI_DEFAULT_TIERS_BLOCK}\n\n` : '';
  return `return {

${tiersPart}    -- [[ EQUIPMENT LIST ]]
    -- chest = "Yes"/"No"
    -- Raid, Map, BoostedMap = "Location Name" or false
${lines.map((line) => `    ${line}`).join('\n')}

}`;
}

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

function scanEquipmentNamesFromGame() {
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
  return [...new Set(out)];
}

function getEquipmentNamesList() {
  const names = new Set(scanEquipmentNamesFromGame());
  for (const n of window.equipmentDatabase?.ALL_EQUIPMENT || []) {
    if (n) names.add(n);
  }
  for (const name of Object.keys(getHardcodedBoostedMapTable())) {
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function resolveModExclusionLists(modLists = {}) {
  return {
    exaltationChest:
      modLists.exaltationChest ?? window.betterExaltationChestExcludedEquipment ?? null,
    boostedMaps:
      modLists.boostedMaps ?? window.betterBoostedMapsExcludedEquipment ?? null
  };
}

/**
 * @param {string} label
 * @param {Set<string>} localSet
 * @param {string[]|null|undefined} modList
 * @param {string} modUnavailableHint
 */
function diffExclusionList(label, localSet, modList, modUnavailableHint) {
  const local = [...localSet].sort((a, b) => a.localeCompare(b));

  if (!modList) {
    console.warn(`[${label}] ${modUnavailableHint}`);
    console.log(`[${label}] Local only (${local.length}):`, local);
    return { compared: false, inSync: undefined, local, missingInExport: [], extraInExport: [] };
  }

  const modSet = new Set(modList);
  const missingInExport = [...modSet].filter((name) => !localSet.has(name)).sort((a, b) => a.localeCompare(b));
  const extraInExport = [...localSet].filter((name) => !modSet.has(name)).sort((a, b) => a.localeCompare(b));
  const inSync = missingInExport.length === 0 && extraInExport.length === 0;

  console.log(`[${label}] ${inSync ? 'IN SYNC' : 'OUT OF SYNC'} (local ${local.length}, mod ${modList.length})`);
  if (missingInExport.length) {
    console.log('  Add to equipment-lua-export.js:', missingInExport);
  }
  if (extraInExport.length) {
    console.log('  Remove from equipment-lua-export.js:', extraInExport);
  }

  return { compared: true, inSync, local, missingInExport, extraInExport };
}

/**
 * Compare local exclusion lists to mod EXCLUDED_EQUIPMENT arrays.
 * Reads window.betterExaltationChestExcludedEquipment / window.betterBoostedMapsExcludedEquipment
 * when overrides are not passed (mods must be enabled).
 * @param {{ exaltationChest?: string[], boostedMaps?: string[] }} [modLists]
 * @returns {{ exaltationChest: object, boostedMaps: object, allInSync: boolean|null }}
 */
function diffEquipmentLuaExclusionSets(modLists = {}) {
  const resolved = resolveModExclusionLists(modLists);

  const exaltationChest = diffExclusionList(
    'Exaltation chest (EXALTATION_CHEST_EXCLUDED)',
    NO_EXALTATION_CHEST,
    resolved.exaltationChest,
    'Better Exaltation Chest not loaded — enable the mod or pass { exaltationChest: [...] }.'
  );
  const boostedMaps = diffExclusionList(
    'Boosted maps (BOOST_MAP_EXCLUDED)',
    BOOST_EXCLUDED_EQUIPMENT,
    resolved.boostedMaps,
    'Better Boosted Maps not loaded — enable the mod or pass { boostedMaps: [...] }.'
  );

  const compared = exaltationChest.compared && boostedMaps.compared;
  const allInSync = compared
    ? exaltationChest.inSync && boostedMaps.inSync
    : null;

  if (compared) {
    console.log(
      `[equipment-lua-export.js] Overall: ${allInSync ? 'ALL IN SYNC' : 'DRIFT DETECTED'}`
    );
  } else {
    console.log(
      '[equipment-lua-export.js] Enable Better Exaltation Chest + Better Boosted Maps, or pass override arrays.'
    );
  }

  return { exaltationChest, boostedMaps, allInSync };
}

function getDefaultWikiLuaFilename() {
  return `equipment-wiki-${new Date().toISOString().slice(0, 10)}.lua`;
}

function downloadTextAsFile(text, filename = getDefaultWikiLuaFilename()) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    console.log(`[equipment-lua-export.js] Downloaded ${filename}`);
    return true;
  } catch (err) {
    console.warn('[equipment-lua-export.js] Download failed:', err);
    return false;
  }
}

function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => {
          console.log('[equipment-lua-export.js] Copied to clipboard.');
          return true;
        },
        (err) => {
          console.warn('[equipment-lua-export.js] Clipboard copy failed:', err);
          return false;
        }
      );
    }
  } catch (err) {
    console.warn('[equipment-lua-export.js] Clipboard copy failed:', err);
  }
  return Promise.resolve(false);
}

/**
 * Build Lua assignment lines for all equipment (Cyclopedia-style map presence + BBM rules).
 * @param {{
 *   copy?: boolean,
 *   download?: boolean,
 *   filename?: string,
 *   wikiPage?: boolean,
 *   includeTiers?: boolean,
 *   keyColumn?: number
 * }} options
 * - wikiPage: wrap in `return { ... }`, wiki comments, comma-separated Raid/Map lists (for per-map links), aligned keys.
 * - includeTiers: when wikiPage, include WIKI_DEFAULT_TIERS_BLOCK (default true).
 * - download: when wikiPage, save a .lua file (default true). Set false to skip.
 * - copy: clipboard copy (default true for plain export, false for wiki export unless set).
 * - filename: download filename when download is enabled (default equipment-wiki-YYYY-MM-DD.lua).
 * @returns {string}
 */
function dumpEquipmentLuaTable(options = {}) {
  const wikiPage = options.wikiPage === true;
  const shouldDownload = wikiPage && options.download !== false;
  const shouldCopy = wikiPage ? options.copy === true : options.copy !== false;
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

    return formatEquipmentLuaRow(
      name,
      { chest, raid: raidLua, map: mapLua, boosted: boostedLua },
      keyColumn,
      wikiPage
    );
  });

  const text = wikiPage ? buildWikiLuaDocument(lines, includeTiers) : lines.join('\n');

  console.log(text);
  if (shouldDownload) {
    downloadTextAsFile(text, options.filename || getDefaultWikiLuaFilename());
  }
  if (shouldCopy) {
    void copyTextToClipboard(text);
  }
  return text;
}

/** Wiki-ready `return { ... }` export; downloads a .lua file by default. */
function dumpEquipmentWikiLua(options = {}) {
  return dumpEquipmentLuaTable({ ...options, wikiPage: true });
}

const globalWindow = globalThis.window || window;
if (globalWindow) {
  globalWindow.dumpEquipmentLuaTable = dumpEquipmentLuaTable;
  globalWindow.dumpEquipmentWikiLua = dumpEquipmentWikiLua;
  globalWindow.buildEquipmentRoomPresenceForConsole = buildEquipmentRoomPresence;
  globalWindow.diffEquipmentLuaExclusionSets = diffEquipmentLuaExclusionSets;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dumpEquipmentLuaTable,
    dumpEquipmentWikiLua,
    buildEquipmentRoomPresence,
    buildWikiLuaDocument,
    buildWikiDefaultTiersBlock,
    formatEquipmentLuaRow,
    diffEquipmentLuaExclusionSets,
    resolveModExclusionLists,
    copyTextToClipboard,
    downloadTextAsFile,
    getDefaultWikiLuaFilename,
    getHardcodedBoostedMapTable,
    EXALTATION_CHEST_EXCLUDED,
    BOOST_MAP_EXCLUDED,
    NO_EXALTATION_CHEST,
    BOOST_EXCLUDED_EQUIPMENT
  };
}
