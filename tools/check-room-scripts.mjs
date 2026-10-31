#!/usr/bin/env node
/**
 * Checks the live game's room scripts against database/maps-database.js ROOM_SCRIPT_NOTES.
 *
 * The game runs `scripts[floorFile.name]` when a room is set up (see docs/game_state_api.md,
 * "Villain / room-script creature mechanics"). Those scripts are code in a minified bundle, so
 * their effects can't be read at runtime; the notes are written by hand. This tool flags when
 * the game and the notes drift apart (the extraction and comparison live in maps-database.js,
 * shared with the in-game admin check in Mod_Settings.js):
 *
 *   NEW      script exists in the game but has no ROOM_SCRIPT_NOTES entry
 *   CHANGED  script's constants differ from the fingerprint stored when its note was reviewed
 *            (e.g. a number in "up to 12 clones" changed)
 *   REMOVED  ROOM_SCRIPT_NOTES entry for a script the game no longer has
 *
 * Usage:
 *   node tools/check-room-scripts.mjs            check; exit code 1 on any difference
 *   node tools/check-room-scripts.mjs --update   re-record ROOM_SCRIPT_FINGERPRINTS in
 *                                                 maps-database.js (run only after you have
 *                                                 reviewed/updated the notes for every flagged script)
 *
 * Network and parsing failures exit 2, never "OK". Only the chunks the home page references are
 * scanned (lazily loaded chunks are not).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://bestiaryarena.com';
const MAPS_DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'maps-database.js');
const FINGERPRINT_BLOCK = /(\/\/ BEGIN ROOM_SCRIPT_FINGERPRINTS\r?\n)[\s\S]*?(\/\/ END ROOM_SCRIPT_FINGERPRINTS)/;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function loadChunks() {
  const html = await fetchText(`${ORIGIN}/`);
  const paths = [...new Set(html.match(/\/_next\/static\/chunks\/[^"'\\\s]+?\.js/g) || [])];
  if (paths.length === 0) throw new Error('no chunk URLs found on the home page');
  return Promise.all(paths.map((p) => fetchText(ORIGIN + p)));
}

function loadMapsDatabase() {
  // maps-database.js is a browser script; give it the globals it reads and mute its logging.
  globalThis.window = globalThis;
  globalThis.state = { utils: { ROOMS: [] } };
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    return createRequire(import.meta.url)(MAPS_DB_PATH);
  } finally {
    Object.assign(console, { log, warn });
  }
}

function writeFingerprints(game) {
  const source = readFileSync(MAPS_DB_PATH, 'utf8');
  if (!FINGERPRINT_BLOCK.test(source)) throw new Error('ROOM_SCRIPT_FINGERPRINTS markers not found in maps-database.js');
  const eol = source.includes('\r\n') ? '\r\n' : '\n'; // keep the file's own line endings
  const body = Object.entries(game).map(([name, fp]) => `  ${name}: '${fp}'`).join(`,${eol}`);
  const block = `const ROOM_SCRIPT_FINGERPRINTS = {${eol}${body}${eol}};${eol}`;
  writeFileSync(MAPS_DB_PATH, source.replace(FINGERPRINT_BLOCK, (_, begin, end) => `${begin}${block}${end}`));
}

async function main() {
  const update = process.argv.includes('--update');
  const db = loadMapsDatabase();
  const game = await db.extractRoomScripts(await loadChunks());
  const names = Object.keys(game);
  console.log(`Game has ${names.length} room scripts: ${names.join(', ')}`);

  const problems = db.diffRoomScripts(game);
  if (update) {
    writeFingerprints(game);
    console.log(`Updated ROOM_SCRIPT_FINGERPRINTS in ${MAPS_DB_PATH}`);
    const unresolved = problems.filter((p) => p.kind !== 'CHANGED');
    if (unresolved.length) console.log(`Still unresolved:\n${unresolved.map((p) => `${p.kind.padEnd(8)} ${p.message}`).join('\n')}`);
    return;
  }
  if (problems.length) {
    console.log(`\n${problems.map((p) => `${p.kind.padEnd(8)} ${p.message}`).join('\n')}\n\nReview the flagged scripts, update ROOM_SCRIPT_NOTES, then run with --update.`);
    process.exitCode = 1;
    return;
  }
  console.log('OK: every room script has a note and none changed since it was reviewed.');
}

main().catch((err) => {
  console.error(`check-room-scripts failed: ${err.message}`);
  process.exitCode = 2;
});
