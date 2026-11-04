#!/usr/bin/env node
/**
 * Checks the live game's creature ability constants against CREATURE_COMBAT_DATA in
 * database/creature-database.js.
 *
 * Every creature's ability tooltip reads a block of UPPER_SNAKE constants (cooldowns, durations,
 * damage bases, AP ratios, caps) from the game's minified creature bundle. They cannot be read at
 * runtime, so the Cyclopedia "Combat details" panel ships a snapshot. This tool re-extracts them
 * from the chunks and flags drift (docs/game_state_api.md, "Combat engine rules"):
 *
 *   NEW      creature in the game with no snapshot entry
 *   CHANGED  a constant, or the attack delay, differs from the snapshot
 *   REMOVED  snapshot entry for a creature the game no longer has
 *
 * Usage:
 *   node tools/check-creature-combat.mjs            check; exit code 1 on any difference
 *   node tools/check-creature-combat.mjs --update   rewrite the CREATURE_COMBAT_DATA block
 *
 * Network and parsing failures exit 2, never "OK". Chunks are read from the build manifest, so
 * lazily loaded chunks are included.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { recordRun } from './tool-runs.mjs';

const { isCreatureBundle, analyze, parseNameToId } = createRequire(import.meta.url)('../content/ba-combat.js');

const ORIGIN = 'https://bestiaryarena.com';
const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'creature-database.js');
const DATA_BLOCK = /(\/\/ BEGIN CREATURE_COMBAT_DATA\r?\n)[\s\S]*?(\/\/ END CREATURE_COMBAT_DATA)/;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

export async function loadChunks() {
  const html = await fetchText(`${ORIGIN}/`);
  const paths = new Set(html.match(/\/_next\/static\/chunks\/[^"'\\\s]+?\.js/g) || []);
  const buildId = /\/_next\/static\/([^/"]+)\/_buildManifest\.js/.exec(html)?.[1];
  if (!buildId) throw new Error('build id not found on the home page');
  const manifest = await fetchText(`${ORIGIN}/_next/static/${buildId}/_buildManifest.js`);
  for (const p of manifest.match(/static\/chunks\/[^"'\\\s]+?\.js/g) || []) paths.add('/_next/' + p);
  if (paths.size === 0) throw new Error('no chunk URLs found');
  return Promise.all([...paths].map((p) => fetchText(ORIGIN + p)));
}

function findCreatureBundle(chunks) {
  const src = chunks.find(isCreatureBundle);
  if (!src) throw new Error('creature bundle not found in the downloaded chunks');
  return src;
}

/** Every creature name the game knows: playable ones (name -> id table) plus all metadata entries (bosses, summons). */
export function extractCreatureNames(chunks) {
  const src = findCreatureBundle(chunks);
  const names = new Set(Object.keys(parseNameToId(src)));
  for (const m of src.matchAll(/name:"([^"]+)",roles:\[[^\]]*\],queryTags:/g)) names.add(m[1]);
  return names;
}

/** Snapshot shape of every creature: { [gameId]: { n, ad, c } }. The parsing lives in content/ba-combat.js. */
export function extractCombatData(chunks) {
  const entries = analyze(findCreatureBundle(chunks));
  return Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, { n: e.n, ad: e.ad, c: e.c }]));
}

function readSnapshot() {
  const text = readFileSync(DB_PATH, 'utf8');
  const m = DATA_BLOCK.exec(text);
  if (!m) throw new Error('CREATURE_COMBAT_DATA block not found in creature-database.js');
  const body = m[0].replace(/^\/\/ BEGIN[^\n]*\n/, '').replace(/\n?\/\/ END[^\n]*$/, '');
  const json = body
    .replace(/^\s*const CREATURE_COMBAT_DATA = /, '')
    .replace(/;\s*$/, '')
    .replace(/^(\s*)(\d+):/gm, '$1"$2":'); // ids are written as bare numeric keys
  return { text, data: JSON.parse(json) };
}

function diff(game, snap) {
  const lines = [];
  for (const id of Object.keys(game)) {
    if (!snap[id]) { lines.push(`NEW      ${id} ${game[id].n}`); continue; }
    if (JSON.stringify(game[id]) !== JSON.stringify(snap[id])) {
      const keys = new Set([...Object.keys(game[id].c), ...Object.keys(snap[id].c)]);
      const changed = [...keys].filter((k) => game[id].c[k] !== snap[id].c[k])
        .map((k) => `${k}: ${snap[id].c[k]} -> ${game[id].c[k]}`);
      if (game[id].ad !== snap[id].ad) changed.push(`attackDelayMs: ${snap[id].ad} -> ${game[id].ad}`);
      lines.push(`CHANGED  ${id} ${game[id].n}: ${changed.join('; ') || 'name'}`);
    }
  }
  for (const id of Object.keys(snap)) if (!game[id]) lines.push(`REMOVED  ${id} ${snap[id].n}`);
  return lines;
}

function serialize(data) {
  const rows = Object.keys(data).map(Number).sort((a, b) => a - b)
    .map((id) => `  ${id}: ${JSON.stringify(data[id])}`);
  return `const CREATURE_COMBAT_DATA = {\n${rows.join(',\n')}\n};`;
}

async function main() {
  const update = process.argv.includes('--update');
  const game = extractCombatData(await loadChunks());
  const { text, data } = readSnapshot();
  const lines = diff(game, data);
  if (!lines.length) {
    console.log(`OK: ${Object.keys(game).length} creatures match the snapshot.`);
    await recordRun('creatureCombat', 'ok');
    return;
  }
  console.log(lines.join('\n'));
  if (!update) { await recordRun('creatureCombat', 'drift'); process.exitCode = 1; return; }
  const next = text.replace(DATA_BLOCK, (_, a, b) => `${a}${serialize(game)}\n${b}`);
  writeFileSync(DB_PATH, next);
  console.log(`Updated CREATURE_COMBAT_DATA (${Object.keys(game).length} creatures).`);
  await recordRun('creatureCombat', 'ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(String(err?.message || err)); process.exit(2); });
}
