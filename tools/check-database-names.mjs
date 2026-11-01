#!/usr/bin/env node
/**
 * Checks the hand-written name lists in database/ against the live game chunks.
 *
 * The database files get their data from the live game wherever they can (state.utils), but some
 * lists are still hand-maintained: which creatures are event-only or unobtainable, which equipment is
 * excluded from the Exaltation Chest, which maps belong to which expansion. A creature, item or map
 * the game renamed or removed stays in those lists with no error. This tool reads the lists out of
 * the database files themselves (nothing is duplicated here) and flags names the game no longer has:
 *
 *   STALE    list entry whose name is not in the game
 *   RENAMED  EVENT_TO_ROOM_MAPPING entry whose room id exists but now has a different name
 *   NOSLOT   equipment in the game that playereq-database.js cannot place in a slot (the game has no
 *            slot field; the slot is guessed from the name, see checkEquipmentSlots)
 *   LOOSE    (--verbose only, never fails) creature not in the creature table but still named in the
 *            game's text: room-script spawns (Orc Warrior, Squidgy Slime) and boss nicknames (Tentugly)
 *
 * The comparison itself is mapsDatabase.diffHardcodedNames, shared with the in-game admin check in
 * Mod_Settings.js (runAdminNameListCheck). That one reads the live registries (state.utils) and is the
 * stricter of the two; this tool exists for the terminal and for the Lua-export lists, which the page
 * does not expose.
 *
 * What counts as "in the game":
 *   creatures   the game's creature table (playable names plus every metadata entry)
 *   maps        the game's ROOM_NAME table in the chunks
 *   equipment   the name appears as a quoted string anywhere in the chunks (weak: item names are
 *               spread over many components, so a rename is caught but a name reused elsewhere is not)
 *
 * Usage:
 *   node tools/check-database-names.mjs             exit 1 on any STALE / RENAMED, 0 on OK
 *   node tools/check-database-names.mjs --verbose   also list LOOSE
 *
 * Network and parsing failures exit 2, never "OK". A list that cannot be found or is empty also exits 2.
 * Fix the lists by hand from the report.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCreatureNames, loadChunks } from './check-creature-combat.mjs';
import { objectEnd } from './check-inventory-items.mjs';
import { recordRun } from './tool-runs.mjs';

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');
const readDb = (file) => readFileSync(join(DB_DIR, file), 'utf8');

const STRING = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"`;
const unquote = (s) => s.slice(1, -1).replace(/\\(.)/g, '$1');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');

/** The `[...]` / `{...}` literal after `declaration` (quote- and comment-aware bracket matching). */
function literalAfter(text, declaration) {
  const at = text.indexOf(declaration);
  if (at < 0) throw new Error(`"${declaration}" not found`);
  let i = at + declaration.length;
  while (i < text.length && text[i] !== '[' && text[i] !== '{') i++;
  const open = i;
  let depth = 0;
  let quote = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) break; }
    else if (c === '/' && text[i + 1] === '*') i = text.indexOf('*/', i) + 1;
    else if ('[{('.includes(c)) depth++;
    else if (']})'.includes(c) && --depth === 0) return text.slice(open, i + 1);
  }
  throw new Error(`"${declaration}" is not closed`);
}

const stringsIn = (literal) => [...stripComments(literal).matchAll(new RegExp(STRING, 'g'))].map((m) => unquote(m[0]));

function pairsIn(literal) {
  const re = new RegExp(`(${STRING})\\s*:\\s*(${STRING})`, 'g');
  return [...stripComments(literal).matchAll(re)].map((m) => [unquote(m[1]), unquote(m[2])]);
}

function nonEmpty(what, list) {
  if (!list.length) throw new Error(`${what} is empty: the list shape changed, update this tool`);
  return list;
}

/** ROOM_NAME: room id -> map name, from the `{rkswrs:"Sewers",...}` table in the chunks. */
export function extractRoomNames(chunks) {
  const src = chunks.find((c) => c.includes('{rkswrs:"Sewers"'));
  if (!src) throw new Error('room name table not found in the downloaded chunks');
  const start = src.indexOf('{rkswrs:"Sewers"');
  const names = {};
  for (const m of src.slice(start, objectEnd(src, start)).matchAll(/([A-Za-z0-9_$]+):"((?:[^"\\]|\\.)*)"/g)) {
    names[m[1]] = JSON.parse(`"${m[2]}"`);
  }
  if (Object.keys(names).length < 50) throw new Error(`only ${Object.keys(names).length} rooms found`);
  return names;
}

/** maps-database.js is a browser script; give it the globals it reads and mute its logging. */
function loadMapsDatabase() {
  globalThis.window = globalThis;
  globalThis.state = { utils: { ROOMS: [] } };
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    return createRequire(import.meta.url)(join(DB_DIR, 'maps-database.js'));
  } finally {
    Object.assign(console, { log, warn });
  }
}

/** Equipment names from the chunks: each item is `{spriteId:..,name:"..",[type/compareName,]EffectComponent`. */
export function extractEquipmentNames(chunks) {
  const re = /spriteId:[^,{}]+,name:"([^"]+)",(?:[A-Za-z]+:"[^"]*",)*EffectComponent/g;
  const names = [...new Set([...chunks.join('\n').matchAll(re)].map((m) => m[1]))];
  if (names.length < 40) throw new Error(`only ${names.length} equipment names found`);
  return names;
}

/**
 * The game has no equipment slot field, so playereq-database.js guesses the slot from the name. Runs
 * that script against the game's equipment names and flags every item it cannot place (slot
 * `unknown`). Fix by adding the item to specificMappings there ('unknown' acknowledges an item
 * whose slot is not confirmed).
 */
export function checkEquipmentSlots(names) {
  globalThis.window = globalThis;
  globalThis.state = {
    player: { getSnapshot: () => ({}) },
    board: { getSnapshot: () => ({}) },
    utils: { getEquipment: (i) => (names[i - 1] ? { metadata: { name: names[i - 1] } } : undefined) }
  };
  const { log, warn } = console;
  console.log = console.warn = () => {};
  let db;
  try {
    db = createRequire(import.meta.url)(join(DB_DIR, 'playereq-database.js'));
  } finally {
    Object.assign(console, { log, warn });
  }
  const bySlot = db?.EQUIPMENT_BY_SLOT;
  if (!bySlot) throw new Error('playereq-database.js did not build EQUIPMENT_BY_SLOT');
  const acknowledged = new Set(
    [...readDb('playereq-database.js').matchAll(/'([^']+)':\s*'unknown'/g)].map((m) => m[1])
  );
  return (bySlot.unknown || [])
    .filter((n) => !acknowledged.has(n.toLowerCase()))
    .map((n) => `NOSLOT   ${n}: playereq-database.js cannot place this item in an equipment slot (add it to specificMappings)`);
}

/**
 * Reads the hand-written lists out of the database source files and hands them, with the game's
 * names, to mapsDatabase.diffHardcodedNames (the same comparison the in-game admin check runs).
 */
export function checkNames(game, files = { creature: readDb('creature-database.js'), creatureLua: readDb('creature-lua-export.js'),
  equipment: readDb('equipment-database.js'), equipmentLua: readDb('equipment-lua-export.js'), maps: readDb('maps-database.js') }) {
  const lists = [];
  const add = (source, list, kind, names) => lists.push({ source, list, kind, names: nonEmpty(list, names) });
  const listed = (source, text, declaration, list, kind) => add(source, list, kind, stringsIn(literalAfter(text, declaration)));

  listed('creature-database.js', files.creature, 'const EVENT_CREATURES =', 'EVENT_CREATURES', 'creature');
  listed('creature-database.js', files.creature, 'const NON_SCROLL_CREATURES =', 'NON_SCROLL_CREATURES', 'creature');
  listed('creature-database.js', files.creature, 'const CYCLOPEDIA_HIDDEN_CREATURES =', 'CYCLOPEDIA_HIDDEN_CREATURES', 'creature');
  listed('creature-database.js', files.creature, 'const hardcodedUnobtainable =', 'hardcodedUnobtainable', 'creature');
  listed('creature-lua-export.js', files.creatureLua, 'const WIKI_EXTRA_UNOBTAINABLE =', 'WIKI_EXTRA_UNOBTAINABLE', 'creature');
  for (const alias of ['SHINY_ALIAS_CREATURES', 'BOSS_ALIAS_CREATURES']) {
    const species = [...literalAfter(files.creature, `const ${alias} =`).matchAll(/baseSpecies:\s*(['"])(.*?)\1/g)].map((m) => m[2]);
    add('creature-database.js', `${alias}.baseSpecies`, 'creature', species);
  }

  listed('equipment-database.js', files.equipment, 'const EVENT_EQUIPMENT =', 'EVENT_EQUIPMENT', 'equipment');
  listed('equipment-lua-export.js', files.equipmentLua, 'const EXALTATION_CHEST_EXCLUDED =', 'EXALTATION_CHEST_EXCLUDED', 'equipment');
  listed('equipment-lua-export.js', files.equipmentLua, 'const BOOST_MAP_EXCLUDED =', 'BOOST_MAP_EXCLUDED', 'equipment');
  listed('equipment-lua-export.js', files.equipmentLua, 'const RAID_FORCE_FALSE =', 'RAID_FORCE_FALSE', 'equipment');
  const boosted = nonEmpty('HARDCODED_BOOSTED_MAP', pairsIn(literalAfter(files.equipment, 'const HARDCODED_BOOSTED_MAP =')));
  add('equipment-database.js', 'HARDCODED_BOOSTED_MAP', 'equipment', boosted.map(([item]) => item));
  add('equipment-database.js', 'HARDCODED_BOOSTED_MAP maps', 'map', boosted.flatMap(([, maps]) => maps.split(/,\s*/).filter(Boolean)));

  const eventRooms = nonEmpty('EVENT_TO_ROOM_MAPPING', pairsIn(literalAfter(files.maps, 'const EVENT_TO_ROOM_MAPPING =')));
  const expansions = literalAfter(files.maps, 'const MAP_EXPANSIONS =');
  add('maps-database.js', 'MAP_EXPANSIONS', 'map', [...expansions.matchAll(/mapNames:\s*\[([^\]]*)\]/g)].flatMap((m) => stringsIn(m[1])));

  const roomNames = new Set(Object.values(game.rooms));
  return loadMapsDatabase().diffHardcodedNames(lists, {
    hasCreature: (n) => game.creatures.has(n),
    mentionsCreature: game.mentioned,
    hasEquipment: game.hasString,
    hasMap: (n) => roomNames.has(n),
    rooms: game.rooms,
    eventRooms
  }).map((p) => `${p.kind.padEnd(8)} ${p.message}`);
}

async function main() {
  const chunks = await loadChunks();
  const allText = chunks.join('\n');
  const game = {
    creatures: extractCreatureNames(chunks),
    rooms: extractRoomNames(chunks),
    mentioned: (name) => allText.includes(name),
    hasString: (name) => allText.includes(JSON.stringify(name)) || allText.includes(`'${name}'`)
  };
  if (game.creatures.size < 100) throw new Error(`only ${game.creatures.size} creature names found`);
  const lines = [...checkNames(game), ...checkEquipmentSlots(extractEquipmentNames(chunks))];
  const failing = lines.filter((l) => !l.startsWith('LOOSE'));
  const shown = process.argv.includes('--verbose') ? lines : failing;
  await recordRun('databaseNames', failing.length ? 'drift' : 'ok');
  if (shown.length) console.log(shown.join('\n'));
  if (failing.length) {
    process.exitCode = 1;
    return;
  }
  console.log(`OK: hardcoded name lists match the game (${game.creatures.size} creatures, ${Object.keys(game.rooms).length} maps).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(String(err?.message || err)); process.exit(2); });
}
