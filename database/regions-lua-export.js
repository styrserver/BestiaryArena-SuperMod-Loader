/*
================================================================================
Console — open DevTools on Bestiary Arena (loader injected), then paste:

dumpRegionsWikiLua();
dumpRegionsWikiLua({ download: false, copy: true });
dumpRegionsWikiLua({ filename: 'regions.lua' });
dumpRegionsLuaTable({ wikiPage: true });
buildRegionsExportData();            // inspect the structured data, no Lua formatting

dumpRegionPageBody('ankrahmun');            // full page wikitext (infobox call + prose +
                                             // Maps/Expansion/Raids/Events tables + Yasir stub)
                                             // to paste as a region page's entire content
dumpAllRegionPageBodies();                  // same, one file, every region

================================================================================
Maintainer workflow
================================================================================
1. Reload extension + game; confirm "[regions-lua-export.js] Loading..." in console.
2. Run dumpRegionsWikiLua(); downloads regions-wiki-YYYY-MM-DD.lua.
3. Paste the whole thing into Module:RegionsData/data on the wiki (same idea as
   Module:EquipmentData/data — one shared data page, not one page per region).
4. Template:Infobox Region needs to actually read from it: right now it just formats
   whatever params are passed in (confirmed via action=raw — no {{#invoke:...}} calls).
   See the companion Module:RegionsData logic-module draft in docs (mirrors
   Module:EquipmentData's getItemData/getLocationField).
5. `expansion` is resolved automatically from maps-database.js's MAP_EXPANSIONS
   (hardcoded expansion -> map-name table, sourced from the wiki's Category:Expansions
   pages — see that file for the maintainer note on keeping it current). Only add an
   entry to REGION_EXPANSION_MAP below if a region's expansion is missing from that
   table (new expansion not hardcoded there yet) — it's checked first and overrides
   the auto-resolved value.
6. `unlock_map` / `unlock_region` ("unlocked after defeating X in Y") still have NO
   game-state source at all — sourced by hand from the wiki's own region pages into
   REGION_UNLOCK_INFO below (already filled in for all 7 current regions as of 2026-09;
   re-check when a new region ships). NOTE: despite the name, the wiki's "defeating X"
   always names a MAP (e.g. Carlin: "defeating Katana Quest in Rookgaard" — Katana Quest
   is a Rookgaard map, not a monster), not a creature — don't be misled by Ankrahmun's
   "Shadowthorn" reading ambiguously (a map AND a creature happen to share that name).
   Rookgaard has no unlock condition (starting region) — use `{ starting: true }`.
   Everything else (regular_map_count / expansion_map_count / raid_count / event_count /
   order / raids / events) is computed from real per-map data.
7. Yasir shop contents/prices still have no static source — Better_Yasir.js reads prices
   live from the DOM, per shop. Not part of this data table; document by hand.

Sync map (edit the matching source when rules change):
  REGION_UNLOCK_INFO      ↔  no game-state source; wiki/community knowledge only
  Expansion membership    ↔  maps-database.js MAP_EXPANSIONS (single source of truth)
  REGION_EXPANSION_MAP    ↔  override/gap-filler only, for expansions not yet in MAP_EXPANSIONS
  Region rune             ↔  inventory-database.js rune `obtain` field, via
                             maps-database.js getRegionRune() (single source of truth —
                             not a table in this file)
  Raid / Event detection  ↔  maps-database.js getMapType (single source, not duplicated here)
  Difficulty labels       ↔  maps-database.js getDifficultyLabel (single source, not duplicated here)
================================================================================
*/

console.log('[regions-lua-export.js] Loading regions Lua export helpers...');

/**
 * Region unlock prerequisite. Not exposed by client game state at all — sourced from
 * the wiki's own region pages (action=raw on each, 2026-09).
 *
 * IMPORTANT: the wiki's "unlocked after defeating X in Y" pattern names a MAP, not a
 * creature (e.g. Carlin: "defeating Katana Quest in Rookgaard" — Katana Quest is a
 * Rookgaard map in our own maps dump, not a monster). Ankrahmun's "Shadowthorn" reads
 * ambiguously creature-or-map since a map happens to share that name, which is what
 * hid this the first time round — every other entry is unambiguously a map name.
 * Field is called `map` for that reason, not `creature`.
 *
 * Rookgaard has no unlock condition (starting region) — use `{ starting: true }` instead
 * of `{ map, region }` for it.
 * @type {Record<string, { map: string, region: string } | { starting: true }>}
 */
const REGION_UNLOCK_INFO = {
  rook: { starting: true },
  carlin: { map: 'Katana Quest', region: 'Rookgaard' },
  folda: { map: "Banshee's Last Room", region: 'Carlin' },
  abdendriel: { map: 'Santa Claus Home', region: 'Folda' },
  kazordoon: { map: 'The Orc King Hall', region: "Ab'Dendriel" },
  venore: { map: "Mad Technomancer's Lab", region: 'Kazordoon' },
  ankrahmun: { map: 'Shadowthorn', region: 'Venore' }
};

/**
 * Each region's themed rune drop ("Maps in <region> drop <rune>.") — NOT duplicated
 * here. Sourced live from inventory-database.js's `obtain` field via
 * maps-database.js's getRegionRune(regionId) (single source of truth: edit the rune's
 * `obtain` field there if this is ever wrong, not a table in this file).
 * @param {string} regionId
 * @returns {string|null}
 */
function getRegionRune(regionId) {
  try {
    return window.mapsDatabase?.getRegionRune?.(regionId) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Store expansion product per region (name + the room ids it unlocks). Resolved
 * automatically from maps-database.js MAP_EXPANSIONS (see getRegionExpansion below) —
 * only add an entry here for a region whose expansion isn't in that table yet
 * (new expansion the maintainer hasn't hardcoded there). Entries here win over the
 * auto-resolved value.
 * @type {Record<string, { name: string, mapIds: string[] }>}
 */
const REGION_EXPANSION_MAP = {};

/**
 * Resolve a region's expansion: manual override first, else maps-database.js
 * MAP_EXPANSIONS (single source of truth for expansion -> map membership).
 * @param {string} regionId
 * @returns {{ name: string, mapIds: string[] }|null}
 */
function getRegionExpansion(regionId) {
  if (REGION_EXPANSION_MAP[regionId]) return REGION_EXPANSION_MAP[regionId];
  try {
    return window.mapsDatabase?.getExpansionForRegion?.(regionId) || null;
  } catch (_) {
    return null;
  }
}

function luaEscape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function luaStringLiteral(value) {
  if (value == null || value === '') return 'false';
  return `"${luaEscape(value)}"`;
}

function formatLuaStringArray(items) {
  if (!Array.isArray(items) || items.length === 0) return '{}';
  return `{ ${items.map((item) => luaStringLiteral(item)).join(', ')} }`;
}

/** Pad `["Name"]` so `=` lines up for wiki-style tables. */
function formatRegionLuaKey(name, targetBracketEndCol = 31) {
  const key = `["${luaEscape(name)}"]`;
  const spaces = Math.max(1, targetBracketEndCol - key.length);
  return `${key}${' '.repeat(spaces)}=`;
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
 * state.utils.ROOMS is a plain array in the live game, not an object keyed by room id
 * (maps-database.js's own getAllMaps()/getMapById() treat it that way — they .find() by
 * .id, never index it directly). `ROOMS?.[mapId]` silently resolves to undefined for a
 * string id, so always go through mapsDatabase.getMapById() here instead.
 */
function getRoomData(mapId) {
  try {
    return window.mapsDatabase?.getMapById?.(mapId) || null;
  } catch (_) {
    return null;
  }
}

function getRoomDisplayName(mapId) {
  try {
    return globalThis.state?.utils?.ROOM_NAME?.[mapId] || mapId;
  } catch (_) {
    return mapId;
  }
}

/**
 * "raid" | "event" | false — single source: maps-database.js getMapType(). Not
 * duplicated here (was two near-identical isRaidRoom/isEventRoom checks before).
 */
function getMapType(mapId) {
  try {
    const type = window.mapsDatabase?.getMapType?.(mapId);
    if (type !== undefined) return type;
  } catch (_) {}
  return getRoomData(mapId)?.raid === true ? 'raid' : false;
}

function getRegionById(regionId) {
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (!Array.isArray(regions)) return null;
    return regions.find((r) => r?.id === regionId) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Shared grouping logic: a region's rooms split into regular / expansion / raid / event
 * buckets. Used by both the Lua data export (counts + linked lists) and the page-body
 * builder (needs the actual id lists to build wikitables).
 * @param {string} regionId
 * @returns {{
 *   region: object|null, name: string,
 *   regularIds: string[], expansionIds: string[], raidIds: string[], eventIds: string[],
 *   expansion: { name: string, mapIds: string[] }|null
 * }}
 */
function buildRegionMapGroups(regionId) {
  const region = getRegionById(regionId);
  const name = getRegionDisplayName(region) || regionId;
  const allRoomIds = Array.isArray(region?.rooms) ? region.rooms.map((room) => room?.id).filter(Boolean) : [];

  const expansion = getRegionExpansion(regionId);
  const expansionIdSet = new Set(expansion?.mapIds || []);

  const typeById = new Map(allRoomIds.map((id) => [id, getMapType(id)]));
  const pureRaidIds = allRoomIds.filter((id) => typeById.get(id) === 'raid');
  const eventIds = allRoomIds.filter((id) => typeById.get(id) === 'event');
  const regularIds = allRoomIds.filter((id) => !typeById.get(id) && !expansionIdSet.has(id));
  const expansionIds = allRoomIds.filter((id) => expansionIdSet.has(id));

  return { region, name, regularIds, expansionIds, raidIds: pureRaidIds, eventIds, expansion };
}

/**
 * Build the structured export data for every region.
 * @returns {Array<object>}
 */
function buildRegionsExportData() {
  const orderedRegions = window.mapsDatabase?.getRegionsInOrder?.() || [];

  return orderedRegions.map((r, idx) => {
    const groups = buildRegionMapGroups(r.id);
    const unlock = REGION_UNLOCK_INFO[r.id] || null;

    return {
      regionId: r.id,
      wikiKey: groups.name,
      order: idx + 1,
      unlockStarting: unlock?.starting === true,
      unlockMap: unlock?.map || null,
      unlockRegion: unlock?.region || null,
      rune: getRegionRune(r.id),
      expansionName: groups.expansion?.name || null,
      regularMapCount: groups.regularIds.length,
      expansionMapCount: groups.expansionIds.length,
      raidCount: groups.raidIds.length,
      eventCount: groups.eventIds.length,
      // Linked-list fields (for Template:Infobox Region's `raids=` data source, via getLocationField).
      raids: groups.raidIds.map(getRoomDisplayName).sort((a, b) => a.localeCompare(b)),
      events: groups.eventIds.map(getRoomDisplayName).sort((a, b) => a.localeCompare(b))
    };
  });
}

function formatRegionLuaRow(entry, keyColumn, wikiPage) {
  const lhs = wikiPage
    ? formatRegionLuaKey(entry.wikiKey, keyColumn)
    : `["${luaEscape(entry.wikiKey)}"]            =`;
  const parts = [
    `order = ${entry.order}`,
    `unlock_starting = ${entry.unlockStarting ? 'true' : 'false'}`,
    `unlock_map = ${luaStringLiteral(entry.unlockMap)}`,
    `unlock_region = ${luaStringLiteral(entry.unlockRegion)}`,
    `rune = ${luaStringLiteral(entry.rune)}`,
    `expansion = ${luaStringLiteral(entry.expansionName)}`,
    `regular_map_count = ${entry.regularMapCount}`,
    `expansion_map_count = ${entry.expansionMapCount}`,
    `raid_count = ${entry.raidCount}`,
    `event_count = ${entry.eventCount}`,
    `raids = ${formatLuaStringArray(entry.raids)}`,
    `events = ${formatLuaStringArray(entry.events)}`
  ];
  return `${lhs} { ${parts.join(', ')} },`;
}

function buildWikiLuaDocument(lines) {
  return `return {

    -- =========================================================
    -- REGIONS (in game unlock order)
    -- =========================================================
${lines.map((line) => `    ${line}`).join('\n')}

}`;
}

/*
================================================================================
Page-body builder — the actual page content, NOT the Module:RegionsData/data table
================================================================================
{{Infobox Region}} only ever renders the small infobox box (title/image/maps count/
expansion/raids) — it was never going to produce the intro prose, the Maps/Expansion/
Raids/Events wikitables, or the Yasir section below it. Those are ordinary page content,
same as how an Equipment page still hand-writes its own "Notes" section below the
module-fed infobox. dumpRegionPageBody() reintroduces that generation (dropped when this
file was rewritten to the flat Module:RegionsData/data shape) — it scans live room actors
directly for the Creatures columns, it does NOT read that back from Module:RegionsData/data
(which deliberately doesn't store per-map creature lists).

The Maps/Expansion/Raids/Events TABLES are no longer built here at all — Module:MapsData's
makeRegionTable(frame) renders them live on the wiki from Module:MapsData/data, so this
just emits the one-line {{#invoke:MapsData|makeRegionTable|...}} call per section. That
table will always be current, even without re-running this dump, as long as
Module:MapsData/data itself is current.

Still NOT automatable, left as a stub in the output:
  - The unlock sentence's [[???]] placeholders, until REGION_UNLOCK_INFO is filled below —
    not in game state, and no wiki table to reuse either.
  - Yasir section — no static source, Better_Yasir.js reads shop prices live from the DOM.
================================================================================
*/

/** Single source: maps-database.js. Not duplicated here — see that file for the maintainer note. */
function getDifficultyLabel(difficulty) {
  return window.mapsDatabase?.getDifficultyLabel?.(difficulty) || `Difficulty ${difficulty}`;
}

/** One-line live table invoke — replaces a hand-built wikitable that would go stale. */
function buildMapsTableInvoke(regionName, filterType) {
  return `{{#invoke:MapsData|makeRegionTable|${regionName}${filterType ? `|${filterType}` : ''}}}`;
}

/** Wiki convention spells ordinals out ("second region", not "2nd region"). */
const ORDINAL_WORDS = [
  null, 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'
];

function ordinal(n) {
  if (n == null) return '?';
  if (ORDINAL_WORDS[n]) return ORDINAL_WORDS[n];
  // Fallback past the hardcoded word list (no region count is close to this today).
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  if (rem10 === 1) return `${n}st`;
  if (rem10 === 2) return `${n}nd`;
  if (rem10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** "A" / "A and B" / "A, B and C" — a plain comma join has no conjunction before the
 * final item ("A, B, C." reads as a run-on), which was a real grammar bug here. */
function joinEnglishList(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function buildIntroParagraph(name, order, unlock, groups) {
  let unlockClause;
  if (unlock?.starting) {
    unlockClause = 'your starting point';
  } else if (unlock) {
    unlockClause = `unlocked after defeating [[${unlock.map}]] in [[${unlock.region}]]`;
  } else {
    unlockClause = 'unlocked after defeating [[???]] in [[???]]<!-- TODO: fill REGION_UNLOCK_INFO, not in game state -->';
  }

  const countByDifficultyLabel = (ids) => {
    const counts = {};
    ids.forEach((id) => {
      const label = getDifficultyLabel(getRoomData(id)?.difficulty).toLowerCase();
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => `${count} ${label}`).join(', ');
  };

  const clauses = [];
  const regularSummary = countByDifficultyLabel(groups.regularIds);
  if (regularSummary) clauses.push(`${regularSummary} [[:Category:Maps|maps]]`);
  if (groups.expansion) {
    const expSummary = countByDifficultyLabel(groups.expansionIds);
    clauses.push(`an [[${groups.expansion.name}|expansion]] from the [[store]]${expSummary ? ` with ${expSummary} maps` : ''}`);
  }
  if (groups.raidIds.length) clauses.push(`${groups.raidIds.length} [[Raids|raid]] map${groups.raidIds.length === 1 ? '' : 's'}`);
  if (groups.eventIds.length) clauses.push(`also ${groups.eventIds.length} [[Events|event]] map${groups.eventIds.length === 1 ? '' : 's'}`);

  const offerSentence = clauses.length ? `${name} offers ${joinEnglishList(clauses)}.` : '';
  return `${name} is the ${ordinal(order)} region and ${unlockClause}. ${offerSentence}`.trim();
}

/**
 * Build one region's full page wikitext: infobox call + intro prose + Maps/Expansion/
 * Raids/Events tables + a Yasir stub + category. Ready to paste as the page's entire
 * content (or drop the first line if you already have the infobox call in place).
 * @param {string} regionId
 * @returns {string|null}
 */
function buildRegionPageBody(regionId) {
  const groups = buildRegionMapGroups(regionId);
  if (!groups.region) {
    console.warn(`[regions-lua-export.js] Unknown region id "${regionId}" (state.utils.REGIONS)`);
    return null;
  }

  const orderedRegions = window.mapsDatabase?.getRegionsInOrder?.() || [];
  const order = orderedRegions.findIndex((r) => r.id === regionId) + 1 || null;
  const unlock = REGION_UNLOCK_INFO[regionId] || null;

  // ImageMapPicker has no <default> in Template:Infobox Region (unlike maps/expansion/
  // raids), so it must be passed explicitly or the infobox renders with no image at all.
  // "<Name>.png" is a guess matching the convention seen on existing region pages
  // (e.g. Ankrahmun.png) — verify the actual uploaded filename before publishing.
  const infoboxLine = `{{Infobox Region|title1=${groups.name}|ImageMapPicker=${groups.name}.png}}`;
  const intro = buildIntroParagraph(groups.name, order, unlock, groups);
  const rune = getRegionRune(regionId);
  const runeParagraph = rune ? `Maps in ${groups.name} drop [[${rune}]].` : null;

  const sections = [
    `== Maps ==\nFollowing maps are placed in ${groups.name}.\n${buildMapsTableInvoke(groups.name)}`
  ];
  if (groups.expansion) {
    sections.push(`=== Expansion maps ===\n[[${groups.expansion.name}]] unlocks following maps:\n${buildMapsTableInvoke(groups.name, 'expansion')}`);
  }
  if (groups.raidIds.length) {
    sections.push(`=== Raids ===\n${buildMapsTableInvoke(groups.name, 'raid')}`);
  }
  if (groups.eventIds.length) {
    sections.push(`=== Events ===\n${buildMapsTableInvoke(groups.name, 'event')}`);
  }
  sections.push(
    `== Yasir ==\n<!-- TODO: no static Yasir price data — Better_Yasir.js reads prices live from the DOM.\n     Open ${groups.name}'s Yasir shop and fill in sell/buy items and prices by hand. -->\n[[Category:Region]]`
  );

  const introBlock = runeParagraph ? `${intro}\n\n${runeParagraph}` : intro;
  return `${infoboxLine}\n\n${introBlock}\n\n${sections.join('\n\n')}`;
}

/**
 * Dump one region's full page body. Downloads a .wiki file by default.
 * @param {string} regionId
 * @param {{ copy?: boolean, download?: boolean, filename?: string }} [options]
 * @returns {string|null}
 */
function dumpRegionPageBody(regionId, options = {}) {
  const text = buildRegionPageBody(regionId);
  if (text == null) return null;

  console.log(text);
  if (options.download !== false) {
    downloadTextAsFile(text, options.filename || `${regionId}-page-${new Date().toISOString().slice(0, 10)}.wiki`);
  }
  if (options.copy === true) {
    void copyTextToClipboard(text);
  }
  return text;
}

/**
 * Dump every region's full page body into one file, separated by a divider comment.
 * @param {{ copy?: boolean, download?: boolean, filename?: string }} [options]
 * @returns {string}
 */
function dumpAllRegionPageBodies(options = {}) {
  const regions = window.mapsDatabase?.getRegionsInOrder?.() || [];
  const pages = regions.map((r) => buildRegionPageBody(r.id)).filter(Boolean);
  const text = pages.join('\n\n<!-- ============================================================ -->\n\n');

  console.log(text);
  if (options.download !== false) {
    downloadTextAsFile(text, options.filename || `all-region-pages-${new Date().toISOString().slice(0, 10)}.wiki`);
  }
  if (options.copy === true) {
    void copyTextToClipboard(text);
  }
  return text;
}

function getDefaultWikiLuaFilename() {
  return `regions-wiki-${new Date().toISOString().slice(0, 10)}.lua`;
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
    console.log(`[regions-lua-export.js] Downloaded ${filename}`);
    return true;
  } catch (err) {
    console.warn('[regions-lua-export.js] Download failed:', err);
    return false;
  }
}

function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => {
          console.log('[regions-lua-export.js] Copied to clipboard.');
          return true;
        },
        (err) => {
          console.warn('[regions-lua-export.js] Clipboard copy failed:', err);
          return false;
        }
      );
    }
  } catch (err) {
    console.warn('[regions-lua-export.js] Clipboard copy failed:', err);
  }
  return Promise.resolve(false);
}

/**
 * Build Lua assignment lines for all regions.
 * @param {{
 *   copy?: boolean,
 *   download?: boolean,
 *   filename?: string,
 *   wikiPage?: boolean,
 *   keyColumn?: number
 * }} options
 * @returns {string}
 */
function dumpRegionsLuaTable(options = {}) {
  const wikiPage = options.wikiPage === true;
  const shouldDownload = wikiPage && options.download !== false;
  const shouldCopy = wikiPage ? options.copy === true : options.copy !== false;

  const entries = buildRegionsExportData();

  let keyColumn = typeof options.keyColumn === 'number' ? options.keyColumn : null;
  if (wikiPage && keyColumn == null) {
    keyColumn = 31;
    for (const entry of entries) {
      keyColumn = Math.max(keyColumn, `["${luaEscape(entry.wikiKey)}"]`.length + 1);
    }
  }
  if (keyColumn == null) keyColumn = 31;

  const lines = entries.map((entry) => formatRegionLuaRow(entry, keyColumn, wikiPage));
  const text = wikiPage ? buildWikiLuaDocument(lines) : lines.join('\n');

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
function dumpRegionsWikiLua(options = {}) {
  return dumpRegionsLuaTable({ ...options, wikiPage: true });
}

const globalWindow = globalThis.window || window;
if (globalWindow) {
  globalWindow.dumpRegionsLuaTable = dumpRegionsLuaTable;
  globalWindow.dumpRegionsWikiLua = dumpRegionsWikiLua;
  globalWindow.buildRegionsExportData = buildRegionsExportData;
  globalWindow.dumpRegionPageBody = dumpRegionPageBody;
  globalWindow.dumpAllRegionPageBodies = dumpAllRegionPageBodies;
  globalWindow.buildRegionPageBody = buildRegionPageBody;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dumpRegionsLuaTable,
    dumpRegionsWikiLua,
    buildRegionsExportData,
    formatRegionLuaRow,
    buildWikiLuaDocument,
    copyTextToClipboard,
    downloadTextAsFile,
    getDefaultWikiLuaFilename,
    dumpRegionPageBody,
    dumpAllRegionPageBodies,
    buildRegionPageBody,
    buildRegionMapGroups,
    REGION_UNLOCK_INFO,
    REGION_EXPANSION_MAP
  };
}
