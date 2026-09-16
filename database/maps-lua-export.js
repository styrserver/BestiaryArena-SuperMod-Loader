/*
================================================================================
Console — open DevTools on Bestiary Arena (loader injected), then paste:

dumpMapsWikiLua();
dumpMapsWikiLua({ download: false, copy: true });
dumpMapsWikiLua({ filename: 'maps.lua' });
dumpMapsLuaTable({ wikiPage: true });
buildMapsExportData();               // inspect the structured data, no Lua formatting

dumpMapPageBody('ankoas');           // full page wikitext for one map (infobox call +
                                      // intro + per-actor Creatures table + Tips &
                                      // Tricks skeleton) to paste as that map's page
dumpAllMapPageBodies();              // same, one file, EVERY map including raids/events
dumpAllMapPageBodies({ excludeRaids: true }); // opt OUT of raid/event maps

================================================================================
Maintainer workflow
================================================================================
1. Reload extension + game; confirm "[maps-lua-export.js] Loading..." in console.
2. Run dumpMapsWikiLua(); downloads maps-wiki-YYYY-MM-DD.lua.
3. Paste the whole thing into Module:MapsData/data on the wiki (same idea as
   Module:EquipmentData/data — one shared data page, not one page per map).
4. Template:Maps needs to actually read from it: right now it just formats whatever
   params are passed in (confirmed via action=raw — no {{#invoke:...}} calls). See the
   companion Module:MapsData logic-module draft in docs (mirrors Module:EquipmentData's
   getItemData/getLocationField) — add it once, then Template:Maps can pull region/
   difficulty/stamina/max_rank_points from the module instead of hardcoded params.
5. `drops` is deliberately NOT in this data table. Module:EquipmentData/data already
   stores, per item, which Map/Raid/BoostedMap it comes from (hand-verified by wiki
   editors) — Template:Maps' drops field should reverse-query THAT module live
   (Module:MapsData.getDrops in the doc below) instead of us duplicating a second,
   auto-guessed copy of the same fact that could drift out of sync.
6. `max_rank_points` uses the game's own formula (2 * maxTeamSize - 1), same as
   Better_Highscores.js "Calculate max rank points". Multi-floor quest rooms (type:
   'multi', e.g. The Annihilator Quest) have no top-level maxTeamSize/staminaCost —
   those vary per floor in room.floorRules[floorIndex] instead. `stamina` and
   `max_rank_points` for those rooms report floor 0's values (see getRoomMaxTeamSize/
   getRoomStaminaCost below); they are NOT a genuine flat cost for the whole dungeon.
7. `type` is "raid", "event", or false (regular map) — matches the wiki's own
   Raids/Events section split, same logic regions-lua-export.js already uses.
   CAVEAT: a raid room only becomes "event" if it's NOT in maps-database.js's
   EVENT_TO_ROOM_MAPPING (isDynamicEventMap). That table is manually maintained and
   can drift behind newly added raids — a raid missing from it will be misclassified
   as "event" here. Spot-check before publishing; add missing raids to
   EVENT_TO_ROOM_MAPPING in maps-database.js rather than patching here.
8. `creatures` (linked-list field) and `expansion` (string|false) exist so a
   Module:MapsData.makeRegionTable-style Lua function (mirrors Module:CreatureData's
   makeTable) can build a region's Maps/Expansion/Raids/Events wikitables LIVE from
   this data, instead of pasting a static table per region that goes stale the moment
   a map's stats change. Per-map intro prose / Tips & Tricks are still NOT here — those
   stay hand-written page content, same as Equipment pages' own "Notes" section.

Sync map (edit the matching source when rules change):
  Difficulty labels     ↔  maps-database.js getDifficultyLabel (single source, not duplicated here)
  max_rank_points        ↔  Better_Highscores.js "Calculate max rank points" (2 * maxTeamSize - 1)
  Region membership      ↔  state.utils.REGIONS[].rooms (same source as maps-database.js)
  Raid / Event split     ↔  maps-database.js getMapType (single source, not duplicated here)
  Expansion membership   ↔  maps-database.js MAP_EXPANSIONS (single source of truth)
  drops                  ↔  NOT exported here — wiki Module:EquipmentData/data is the
                             single source of truth (Map/Raid/BoostedMap fields)
================================================================================
*/

console.log('[maps-lua-export.js] Loading maps Lua export helpers...');

/** Wiki keys that differ from in-game ROOM_NAME. */
const WIKI_MAP_KEY_ALIASES = {};

/** Single source: maps-database.js. Not duplicated here — see that file for the maintainer note. */
function getDifficultyLabel(difficulty) {
  return window.mapsDatabase?.getDifficultyLabel?.(difficulty) || `Difficulty ${difficulty}`;
}

function luaEscape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function luaStringLiteral(value) {
  if (value == null || value === '' || value === false) return 'false';
  return `"${luaEscape(value)}"`;
}

function formatLuaStringArray(items) {
  if (!Array.isArray(items) || items.length === 0) return '{}';
  return `{ ${items.map((item) => luaStringLiteral(item)).join(', ')} }`;
}

/** Pad `["Name"]` so `=` lines up for wiki-style tables. */
function formatMapLuaKey(name, targetBracketEndCol = 31) {
  const key = `["${luaEscape(name)}"]`;
  const spaces = Math.max(1, targetBracketEndCol - key.length);
  return `${key}${' '.repeat(spaces)}=`;
}

function getWikiKeyForMapId(mapId) {
  return WIKI_MAP_KEY_ALIASES[mapId] || getRoomDisplayName(mapId);
}

function getRoomDisplayName(mapId) {
  try {
    return globalThis.state?.utils?.ROOM_NAME?.[mapId] || mapId;
  } catch (_) {
    return mapId;
  }
}

/**
 * Reverse-lookup the region containing a room id.
 * @param {string} mapId
 * @returns {{ id: string, name?: string }|null}
 */
function findRegionForMap(mapId) {
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (!Array.isArray(regions)) return null;
    for (const region of regions) {
      if (Array.isArray(region.rooms) && region.rooms.some((r) => r?.id === mapId)) {
        return region;
      }
    }
  } catch (_) {}
  return null;
}

function getRegionDisplayName(region) {
  if (!region) return null;
  try {
    if (window.mapsDatabase?.getRegionDisplayNameFromRegion) {
      return window.mapsDatabase.getRegionDisplayNameFromRegion(region);
    }
  } catch (_) {}
  return region.name || region.id || null;
}

/**
 * Multi-floor quest rooms (type: 'multi', e.g. The Annihilator Quest) carry no top-level
 * maxTeamSize/staminaCost at all — those live per-floor in room.floorRules[floorIndex]
 * instead (confirmed live: The Annihilator Quest is maxTeamSize 4 on floors 0-14, 6 on
 * floor 15, staminaCost 12 vs 18). A flat room.maxTeamSize/staminaCost read silently comes
 * back undefined for these and previously collapsed to a misleading "0" via `?? 0` below.
 * We report floor 0's values (the cost/limit a player commits to on entry) rather than
 * inventing a single number across floors that differ — see docs/game_state_api.md's
 * multi-floor room shape note for the full floorRules structure.
 */
function getRoomEntryFloorRule(room) {
  if (room?.type === 'multi' && Array.isArray(room.floorRules)) {
    return room.floorRules[0] || null;
  }
  return null;
}

function getRoomMaxTeamSize(room) {
  const floorRule = getRoomEntryFloorRule(room);
  if (floorRule && typeof floorRule.maxTeamSize === 'number') return floorRule.maxTeamSize;
  return typeof room?.maxTeamSize === 'number' ? room.maxTeamSize : null;
}

function getRoomStaminaCost(room) {
  const floorRule = getRoomEntryFloorRule(room);
  if (floorRule && typeof floorRule.staminaCost === 'number') return floorRule.staminaCost;
  return typeof room?.staminaCost === 'number' ? room.staminaCost : null;
}

/** Max rank points: same formula as Better_Highscores.js ("Calculate max rank points"). */
function getMaxRankPoints(room) {
  const maxTeamSize = getRoomMaxTeamSize(room);
  if (typeof maxTeamSize !== 'number' || !Number.isFinite(maxTeamSize)) return null;
  return (2 * maxTeamSize) - 1;
}

/**
 * "raid" | "event" | false — matches the wiki's own Raids/Events section split.
 * Single source: maps-database.js getMapType(). Not duplicated here.
 */
function getMapType(mapId, room) {
  try {
    const type = window.mapsDatabase?.getMapType?.(mapId);
    if (type !== undefined) return type;
  } catch (_) {}
  return room?.raid === true ? 'raid' : false;
}

/** Diagnostic counters for the "creatures" field, printed once at the end of a dump. */
const creatureDiagnostics = {
  mapsWithNoActors: [],
  mapsWithUnresolvedActors: []
};

function resetCreatureDiagnostics() {
  creatureDiagnostics.mapsWithNoActors = [];
  creatureDiagnostics.mapsWithUnresolvedActors = [];
}

function getMonsterName(monsterId) {
  try {
    return globalThis.state?.utils?.getMonster?.(monsterId)?.metadata?.name || null;
  } catch (_) {
    return null;
  }
}

/**
 * Distinct creature names on a room's actors, deduped and sorted. Records diagnostics
 * (not just a silent []) so a blank Creatures column has a traceable cause the next
 * time dumpMapsWikiLua() runs, instead of needing an ad-hoc console check.
 */
function getRoomCreatureNames(room, mapId) {
  const actors = room?.file?.data?.actors;
  const realActors = Array.isArray(actors) ? actors.filter(Boolean) : [];

  if (realActors.length === 0) {
    creatureDiagnostics.mapsWithNoActors.push(mapId);
    return [];
  }

  const names = new Set();
  const unresolvedIds = [];
  realActors.forEach((actor) => {
    const name = getMonsterName(actor.id);
    if (name) {
      names.add(name);
    } else {
      unresolvedIds.push(actor.id);
    }
  });

  if (names.size === 0 && unresolvedIds.length > 0) {
    creatureDiagnostics.mapsWithUnresolvedActors.push({ mapId, ids: unresolvedIds });
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function getExpansionName(mapId) {
  try {
    return window.mapsDatabase?.getExpansionNameForMapId?.(mapId) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Canonical in-game map order (region unlock order, then each region's own room
 * order) — single source: maps-database.js getMapOrderIndex(). Lets Module:MapsData's
 * makeRegionTable sort by real game order instead of alphabetically.
 */
function getMapOrder(mapId) {
  try {
    const order = window.mapsDatabase?.getMapOrderIndex?.(mapId);
    return typeof order === 'number' && Number.isFinite(order) ? order : null;
  } catch (_) {
    return null;
  }
}

/**
 * Build the structured export data for every map, grouped by region.
 * @returns {{ regions: Array<{ id: string, name: string, mapIds: string[] }>, byMapId: Map<string, object> }}
 */
function buildMapsExportData() {
  resetCreatureDiagnostics();
  const allMaps = window.mapsDatabase?.getAllMaps?.() || [];
  const byMapId = new Map();

  allMaps.forEach((room) => {
    const mapId = room?.id;
    if (!mapId) return;
    const region = findRegionForMap(mapId);
    const regionName = getRegionDisplayName(region);
    byMapId.set(mapId, {
      mapId,
      wikiKey: getWikiKeyForMapId(mapId),
      region: regionName,
      difficulty: getDifficultyLabel(room.difficulty),
      stamina: getRoomStaminaCost(room),
      maxRankPoints: getMaxRankPoints(room),
      type: getMapType(mapId, room),
      expansion: getExpansionName(mapId),
      creatures: getRoomCreatureNames(room, mapId),
      order: getMapOrder(mapId)
    });
  });

  const orderedRegions = window.mapsDatabase?.getRegionsInOrder?.() || [];
  const regions = orderedRegions.map((r) => ({
    id: r.id,
    name: getRegionDisplayName(r) || r.name || r.id,
    mapIds: allMaps.filter((room) => findRegionForMap(room.id)?.id === r.id).map((room) => room.id)
  }));

  const placed = new Set(regions.flatMap((r) => r.mapIds));
  const unplaced = allMaps.map((room) => room.id).filter((id) => id && !placed.has(id));
  if (unplaced.length) {
    regions.push({ id: null, name: 'UNLISTED (no region match)', mapIds: unplaced });
  }

  return { regions, byMapId };
}

function formatMapLuaRow(entry, keyColumn, wikiPage) {
  const lhs = wikiPage
    ? formatMapLuaKey(entry.wikiKey, keyColumn)
    : `["${luaEscape(entry.wikiKey)}"]            =`;
  const parts = [
    `region = ${luaStringLiteral(entry.region)}`,
    `difficulty = ${luaStringLiteral(entry.difficulty)}`,
    `stamina = ${entry.stamina ?? 0}`,
    `max_rank_points = ${entry.maxRankPoints ?? 0}`,
    `type = ${luaStringLiteral(entry.type)}`,
    `expansion = ${luaStringLiteral(entry.expansion)}`,
    `creatures = ${formatLuaStringArray(entry.creatures)}`,
    `order = ${entry.order ?? 999999}`
  ];
  return `${lhs} { ${parts.join(', ')} },`;
}

function buildWikiLuaDocument(sectionBlocks) {
  const body = sectionBlocks
    .map(({ title, lines }) => {
      const header = `    -- =========================================================\n    -- ${title}\n    -- =========================================================`;
      return `${header}\n${lines.map((line) => `    ${line}`).join('\n')}`;
    })
    .join('\n\n');

  return `return {

${body}

}`;
}

/*
================================================================================
Page-body builder — the actual page content for ONE map, NOT the
Module:MapsData/data table
================================================================================
Template:Maps only ever renders the small infobox box — pulling region/difficulty/
stamina/max_rank_points/drops from Module:MapsData/Module:EquipmentData once it's
wired (see docs). It was never going to write the intro sentence, the per-actor
Creatures table, or the Tips & Tricks skeleton — those are ordinary page content,
same as how Equipment pages hand-write their own "Notes" section below the
module-fed infobox. dumpMapPageBody() builds that page content.

The Creatures table here is DELIBERATELY per-actor (one row per enemy instance on
the map, e.g. 4 rows for 4 Nomads with different equipment), not the deduped species
list Module:MapsData/data's `creatures` field stores — that field is a compact summary
for the region overview tables; a map's own page documents its actual team composition.
This means it reads room.file.data.actors directly, live, same as the creatures-field
scan, but does NOT dedupe.

Still NOT automatable, left blank in the output:
  - Tips & Tricks / First-time battling / Speedrun subsections — pure player-written
    advice, no source at all.
================================================================================
*/

/** Wiki creature-portrait variant suffixes (e.g. "Nomad" -> "Nomad (Basic)"), only
 * when the wiki actually uses one for that creature — fill in as discovered. Left
 * empty by default rather than guessed, since which creatures need a suffix (and
 * which variant) isn't derivable from game state. */
const CREATURE_GIF_VARIANT_SUFFIX = {};

/**
 * Known seasonal/event name for dynamic event maps (type === 'event'), used in the
 * intro sentence "X is a [[page|label]] [[Events|event]] map...". No game-state source
 * for this at all — fill in as discovered. Keyed by display name (not room id) since
 * that's what you already know when documenting a map, sidestepping guessing an
 * internal room id. `page` and `label` can differ (e.g. a yearly event page like
 * "World Cup 2026" vs. the shorter "World Cup" you actually want shown). A map left
 * out here still gets a correct, generic "X is an [[Events|event]] map..." sentence.
 * @type {Record<string, { page: string, label: string }>}
 */
const MAP_EVENT_NAME = {
  // Christmas 2025 (Christmas Pass): Jolly Axeman Tavern was the active raid; the other
  // three rotated in randomly.
  'Jolly Axeman Tavern': { page: 'Christmas 2025', label: 'Christmas' },
  'Dog Raceway': { page: 'Christmas 2025', label: 'Christmas' },
  "Ruprecht's Hut": { page: 'Christmas 2025', label: 'Christmas' },
  'White Wave Cellar': { page: 'Christmas 2025', label: 'Christmas' },
  // Halloween 2025 (Halloween Pass)
  'Halloween Mansion': { page: 'Halloween 2025', label: 'Halloween' },
  // World Cup 2026
  'Three on Three': { page: 'World Cup 2026', label: 'World Cup' },
  'Tibia Ball League': { page: 'World Cup 2026', label: 'World Cup' }
};

function creatureGifFileName(creatureName) {
  const suffix = CREATURE_GIF_VARIANT_SUFFIX[creatureName];
  return suffix ? `${creatureName} (${suffix})` : creatureName;
}

function getEquipmentName(equipGameId) {
  try {
    return globalThis.state?.utils?.getEquipment?.(equipGameId)?.metadata?.name || null;
  } catch (_) {
    return null;
  }
}

/** One row per actor instance (not deduped) — a map's real team composition. */
function buildCreatureTableRows(room) {
  const actors = room?.file?.data?.actors;
  const realActors = Array.isArray(actors) ? actors.filter(Boolean) : [];
  if (realActors.length === 0) return null;

  const rows = realActors.map((actor) => {
    const name = getMonsterName(actor.id) || `Unknown (${actor.id})`;
    const gifName = creatureGifFileName(name);
    const equipName = actor.equip?.gameId != null ? getEquipmentName(actor.equip.gameId) : null;
    const equipCell = equipName ? `[[File:${equipName}.gif|center|frameless]]` : '';
    return `|[[${name}]]\n|[[File:${gifName}.gif|center|frameless]]\n|${actor.level ?? ''}\n|${equipCell}`;
  });

  return `{| class="wikitable"\n!Creature\n!\n!Level\n!Equipment\n|-\n${rows.join('\n|-\n')}\n|}`;
}

/**
 * Build one map's full page wikitext: minimal infobox call (relies on Module:MapsData/
 * Module:EquipmentData once wired, same as regions) + intro prose + per-actor Creatures
 * table + Tips & Tricks skeleton + Rank points prose + categories.
 * @param {string} mapId
 * @returns {string|null}
 */
function buildMapPageBody(mapIdOrName) {
  let mapId = mapIdOrName;
  let room = window.mapsDatabase?.getMapById?.(mapId);

  // Accept a display name too (e.g. dumpMapPageBody('Three on Three')) — room ids are
  // internal short codes ("ankthree" is a guess, not something you can reliably know
  // in advance) and reusing the same resolver the expansion feature already needed
  // beats guessing.
  if (!room) {
    const resolvedId = window.mapsDatabase?.getMapIdByDisplayName?.(mapIdOrName);
    if (resolvedId) {
      mapId = resolvedId;
      room = window.mapsDatabase?.getMapById?.(mapId);
    }
  }

  if (!room) {
    console.warn(`[maps-lua-export.js] Unknown map "${mapIdOrName}" — not a room id (mapsDatabase.getMapById) or a known display name (mapsDatabase.getMapIdByDisplayName).`);
    return null;
  }

  const title = getWikiKeyForMapId(mapId);
  const region = findRegionForMap(mapId);
  const regionName = getRegionDisplayName(region) || 'Unknown Region';
  const difficulty = getDifficultyLabel(room.difficulty);
  const maxRankPoints = getMaxRankPoints(room);
  const type = getMapType(mapId, room);

  let firstSentence;
  if (type === 'raid') {
    firstSentence = `${title} is a monster [[Raids|raid]] you can challenge, located in [[${regionName}]].`;
  } else if (type === 'event') {
    const eventInfo = MAP_EVENT_NAME[title];
    const eventLink = eventInfo ? `[[${eventInfo.page}|${eventInfo.label}]] ` : '';
    firstSentence = `${title} is a ${eventLink}[[Events|event]] map located in [[${regionName}]].`;
  } else {
    firstSentence = `${title} is a map located in [[${regionName}]].`;
  }

  const infoboxLine = `{{Maps|image1=${mapId}.png}}`;
  const intro = `${firstSentence} The [[difficulty]] is ${difficulty.toLowerCase()} and you spend ${getRoomStaminaCost(room) ?? '?'} [[stamina]] for each battle.`;

  const creatureTable = buildCreatureTableRows(room)
    || '(No creatures found — check state.utils.ROOMS actors for this map.)';

  const sections = [
    `== Creatures ==\n${creatureTable}`,
    `== Tips & Tricks ==\n-\n\n==== First-time battling ====\n-\n\n==== Speedrun ====\n-\n\n==== Rank points ====\nThis map grants you maximum [[rank points]] of ${maxRankPoints ?? '?'}.\n[[Category:Maps]]\n[[Category:${regionName}]]`
  ];

  return `${infoboxLine}\n\n${intro}\n\n${sections.join('\n\n')}`;
}

/**
 * Dump one map's full page body. Downloads a .wiki file by default.
 * @param {string} mapId
 * @param {{ copy?: boolean, download?: boolean, filename?: string }} [options]
 * @returns {string|null}
 */
function dumpMapPageBody(mapId, options = {}) {
  const text = buildMapPageBody(mapId);
  if (text == null) return null;

  console.log(text);
  if (options.download !== false) {
    downloadTextAsFile(text, options.filename || `${mapId}-page-${new Date().toISOString().slice(0, 10)}.wiki`);
  }
  if (options.copy === true) {
    void copyTextToClipboard(text);
  }
  return text;
}

/**
 * Dump every map's full page body into one file, separated by a divider comment.
 * "All" means all — raid and event maps are included by default, same as
 * dumpMapsWikiLua() already does for Module:MapsData/data. Pass excludeRaids to opt
 * OUT (e.g. if you only document raids/events on the region page's Raids/Events
 * tables and don't want a standalone page generated for them here).
 * @param {{ copy?: boolean, download?: boolean, filename?: string, excludeRaids?: boolean }} [options]
 * @returns {string}
 */
function dumpAllMapPageBodies(options = {}) {
  const allMaps = window.mapsDatabase?.getAllMaps?.() || [];
  const excludeRaids = options.excludeRaids === true;
  const pages = allMaps
    .filter((room) => !excludeRaids || room.raid !== true)
    .map((room) => buildMapPageBody(room.id))
    .filter(Boolean);
  const text = pages.join('\n\n<!-- ============================================================ -->\n\n');

  console.log(text);
  if (options.download !== false) {
    downloadTextAsFile(text, options.filename || `all-map-pages-${new Date().toISOString().slice(0, 10)}.wiki`);
  }
  if (options.copy === true) {
    void copyTextToClipboard(text);
  }
  return text;
}

function getDefaultWikiLuaFilename() {
  return `maps-wiki-${new Date().toISOString().slice(0, 10)}.lua`;
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
    console.log(`[maps-lua-export.js] Downloaded ${filename}`);
    return true;
  } catch (err) {
    console.warn('[maps-lua-export.js] Download failed:', err);
    return false;
  }
}

function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => {
          console.log('[maps-lua-export.js] Copied to clipboard.');
          return true;
        },
        (err) => {
          console.warn('[maps-lua-export.js] Clipboard copy failed:', err);
          return false;
        }
      );
    }
  } catch (err) {
    console.warn('[maps-lua-export.js] Clipboard copy failed:', err);
  }
  return Promise.resolve(false);
}

/**
 * Build Lua assignment lines for all maps, grouped into region sections.
 * @param {{
 *   copy?: boolean,
 *   download?: boolean,
 *   filename?: string,
 *   wikiPage?: boolean,
 *   keyColumn?: number
 * }} options
 * @returns {string}
 */
/**
 * Print what happened with the "creatures" field this run — every dump run clears
 * and refills creatureDiagnostics (see getRoomCreatureNames), so this always reflects
 * the current call, not a stale run.
 */
function logCreatureDiagnostics() {
  const { mapsWithNoActors, mapsWithUnresolvedActors } = creatureDiagnostics;
  if (mapsWithNoActors.length === 0 && mapsWithUnresolvedActors.length === 0) {
    console.log('[maps-lua-export.js] Creatures: resolved for every map with actors data.');
    return;
  }
  if (mapsWithNoActors.length > 0) {
    console.warn(
      `[maps-lua-export.js] Creatures: ${mapsWithNoActors.length} map(s) had NO actors data at all ` +
      `(room.file.data.actors missing/empty) — Creatures column will be blank for these. ` +
      `First few: ${mapsWithNoActors.slice(0, 10).join(', ')}`
    );
  }
  if (mapsWithUnresolvedActors.length > 0) {
    console.warn(
      `[maps-lua-export.js] Creatures: ${mapsWithUnresolvedActors.length} map(s) HAD actors but ` +
      `state.utils.getMonster() resolved 0 names from their ids — check whether actor.id is really ` +
      `a monster id on this build, or getMonster needs different args. Sample:`,
      mapsWithUnresolvedActors.slice(0, 5)
    );
  }
}

function dumpMapsLuaTable(options = {}) {
  const wikiPage = options.wikiPage === true;
  const shouldDownload = wikiPage && options.download !== false;
  const shouldCopy = wikiPage ? options.copy === true : options.copy !== false;

  const { regions, byMapId } = buildMapsExportData();
  logCreatureDiagnostics();
  const allEntries = regions.flatMap((r) => r.mapIds.map((id) => byMapId.get(id)).filter(Boolean));

  let keyColumn = typeof options.keyColumn === 'number' ? options.keyColumn : null;
  if (wikiPage && keyColumn == null) {
    keyColumn = 31;
    for (const entry of allEntries) {
      keyColumn = Math.max(keyColumn, `["${luaEscape(entry.wikiKey)}"]`.length + 1);
    }
  }
  if (keyColumn == null) keyColumn = 31;

  const sectionBlocks = regions
    .filter((r) => r.mapIds.length)
    .map((r) => ({
      title: r.name.toUpperCase(),
      lines: r.mapIds
        .map((id) => byMapId.get(id))
        .filter(Boolean)
        .map((entry) => formatMapLuaRow(entry, keyColumn, wikiPage))
    }));

  const text = wikiPage
    ? buildWikiLuaDocument(sectionBlocks)
    : sectionBlocks.flatMap((block) => block.lines).join('\n');

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
function dumpMapsWikiLua(options = {}) {
  return dumpMapsLuaTable({ ...options, wikiPage: true });
}

const globalWindow = globalThis.window || window;
if (globalWindow) {
  globalWindow.dumpMapsLuaTable = dumpMapsLuaTable;
  globalWindow.dumpMapsWikiLua = dumpMapsWikiLua;
  globalWindow.buildMapsExportData = buildMapsExportData;
  globalWindow.dumpMapPageBody = dumpMapPageBody;
  globalWindow.dumpAllMapPageBodies = dumpAllMapPageBodies;
  globalWindow.buildMapPageBody = buildMapPageBody;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dumpMapsLuaTable,
    dumpMapsWikiLua,
    buildMapsExportData,
    getDifficultyLabel,
    getMaxRankPoints,
    findRegionForMap,
    formatMapLuaRow,
    buildWikiLuaDocument,
    copyTextToClipboard,
    downloadTextAsFile,
    getDefaultWikiLuaFilename,
    logCreatureDiagnostics,
    creatureDiagnostics,
    dumpMapPageBody,
    dumpAllMapPageBodies,
    buildMapPageBody,
    CREATURE_GIF_VARIANT_SUFFIX,
    MAP_EVENT_NAME,
    WIKI_MAP_KEY_ALIASES
  };
}
