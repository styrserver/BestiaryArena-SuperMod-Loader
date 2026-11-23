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
import { loadChunks } from './lib.mjs';

const { isCreatureBundle, analyze, analyzeFull, parseNameToId } = createRequire(import.meta.url)('../content/ba-combat.js');

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'creature-database.js');
/** Snapshot fields read from the creature class, not from constants: range, ranged flag, first-cast delay (ms). */
const OPTIONAL_FIELDS = ['r', 'rc', 'ic', 's', 'am', 'aa', 'cb', 'cv', 'v'];
const DATA_BLOCK = /(\/\/ BEGIN CREATURE_COMBAT_DATA\r?\n)[\s\S]*?(\/\/ END CREATURE_COMBAT_DATA)/;

// the other tools import loadChunks from here; it lives in lib.mjs
export { loadChunks };

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

/** Summons the parser found but could not tie to an owner creature (not in the snapshot). */
export function findUnlinkedSummons(chunks) {
  return analyzeFull(findCreatureBundle(chunks)).unlinkedSummons;
}

/** Snapshot shape of every creature: { [gameId]: { n, ad, c, r?, rc?, ic? } } (class-level range, ranged flag, first-cast delay). The parsing lives in content/ba-combat.js. */
export function extractCombatData(chunks) {
  const entries = analyze(findCreatureBundle(chunks));
  return Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, { n: e.n, ad: e.ad, c: e.c, ...Object.fromEntries(OPTIONAL_FIELDS.filter((k) => e[k] != null).map((k) => [k, e[k]])) }]));
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

/** The hand-written CREATURE_COMBAT_EXTRA rows: { [gameId]: { KEY: number } } (numbers the extractor cannot read). */
function readExtras(text) {
  const body = /const CREATURE_COMBAT_EXTRA = \{([\s\S]*?)\n\};/.exec(text)?.[1];
  if (body == null) throw new Error('CREATURE_COMBAT_EXTRA block not found in creature-database.js');
  const rows = {};
  for (const m of body.matchAll(/(\d+): \{([^}]*)\}/g)) {
    rows[m[1]] = Object.fromEntries([...m[2].matchAll(/([A-Z0-9_]+): (-?[\d.]+)/g)].map((x) => [x[1], Number(x[2])]));
  }
  return rows;
}

/** The ways the game's minified code can write a number: 4000 / 4e3, 0.35 / .35, 24000 / 24e3. */
function numberSpellings(value) {
  const forms = new Set([String(value), String(value).replace(/^0\./, '.'), String(value).replace(/^-0\./, '-.')]);
  const m = /^(\d+?)(0+)$/.exec(String(value));
  if (m) forms.add(`${m[1]}e${m[2].length}`);
  return [...forms];
}

/**
 * Each hand-written extra must still exist in its creature's text in the game bundle (any spelling of the number). The
 * value cannot be re-read automatically (it sits in an unnamed variable), but a number that vanished means the game changed it.
 */
function diffExtras(chunks, extras) {
  const src = findCreatureBundle(chunks);
  const nameToId = parseNameToId(src);
  const metas = [...src.matchAll(/name:"([^"]+)",roles:\[[^\]]*\],queryTags:/g)];
  const lines = [];
  for (const [id, row] of Object.entries(extras)) {
    const k = metas.findIndex((m) => String(nameToId[m[1]]) === id);
    if (k < 0) { lines.push(`EXTRA    ${id}: creature not found in the game`); continue; }
    const seg = src.slice(metas[k].index, Math.min(k + 1 < metas.length ? metas[k + 1].index : src.length, metas[k].index + 30000));
    for (const [key, value] of Object.entries(row)) {
      const found = numberSpellings(value).some((s) => new RegExp(String.raw`(?<![\w$.])${s.replace(/\./g, '\\.')}(?![\w$.])`).test(seg));
      if (!found) lines.push(`EXTRA    ${id} ${metas[k][1]}: ${key} = ${value} no longer appears in the game's code, re-read it`);
    }
  }
  return lines;
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
      for (const k of OPTIONAL_FIELDS) {
        if (JSON.stringify(game[id][k]) !== JSON.stringify(snap[id][k])) {
          changed.push(k === 's' ? 'summons changed' : `${k}: ${JSON.stringify(snap[id][k])} -> ${JSON.stringify(game[id][k])}`);
        }
      }
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
  const chunks = await loadChunks();
  const game = extractCombatData(chunks);
  const unlinked = findUnlinkedSummons(chunks);
  if (unlinked.length) console.log(`WARN     summons with no owner link (not in the snapshot): ${unlinked.join(', ')}`);
  const { text, data } = readSnapshot();
  const lines = [...diff(game, data), ...diffExtras(chunks, readExtras(text))];
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
