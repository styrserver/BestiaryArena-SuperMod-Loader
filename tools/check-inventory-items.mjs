#!/usr/bin/env node
/**
 * Read-only drift check of database/inventory-database.js against the live game chunks.
 *
 * The tooltip text, display names and `obtain` sources are JSX inside the game's minified bundle (no
 * data table to read), so inventory-database.js stays hand-written. Two things ARE plain data in the
 * chunks, and this tool compares them:
 *
 *   NEW      item key in the game's item icon map with no entry in inventoryTooltips
 *   PRICE    gold price in the game's store price table differs from the `Store (N gold)` in `obtain`
 *   NOPRICE  priced in the game, but the entry's `obtain` has no `Store (N gold)`
 *   UNMATCHED (--verbose only, never fails) store price key with no same-named inventoryTooltips entry;
 *             the database names several store items differently (dragonPlant, hygenie, ...)
 *
 * Usage:
 *   node tools/check-inventory-items.mjs             exit 1 on NEW / PRICE / NOPRICE, 0 on OK
 *   node tools/check-inventory-items.mjs --verbose   also list UNMATCHED
 *
 * Network and parsing failures exit 2, never "OK". Edit inventory-database.js by hand from the report.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChunks } from './check-creature-combat.mjs';
import { recordRun } from './tool-runs.mjs';

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'inventory-database.js');

/** Index just past the `}` closing the object literal that opens at `start`. */
export function objectEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unterminated object literal');
}

/** Item keys of the `{diceManipulator1:()=>jsx,...}` icon map. */
export function extractItemKeys(chunks) {
  const src = chunks.find((c) => c.includes('{diceManipulator1:()=>'));
  if (!src) throw new Error('item icon map not found in the downloaded chunks');
  const start = src.indexOf('{diceManipulator1:()=>');
  const body = src.slice(start, objectEnd(src, start));
  // top-level `key:()=>` only; nested jsx objects never contain `:()=>`
  const keys = [...body.matchAll(/[{,]([A-Za-z0-9_]+):\(\)=>/g)].map((m) => m[1]);
  if (keys.length < 30) throw new Error(`only ${keys.length} item keys found`);
  return keys;
}

/** Gold prices of the `{monsterNickname:4e3,...}` store price table. */
export function extractPrices(chunks) {
  const src = chunks.find((c) => c.includes('{monsterNickname:'));
  if (!src) throw new Error('store price table not found in the downloaded chunks');
  const start = src.indexOf('{monsterNickname:');
  const body = src.slice(start, objectEnd(src, start));
  const prices = {};
  for (const m of body.matchAll(/([A-Za-z0-9_]+):([\d.]+(?:e\d+)?)(?=[,}])/g)) prices[m[1]] = Number(m[2]);
  if (Object.keys(prices).length < 10) throw new Error(`only ${Object.keys(prices).length} prices found`);
  return prices;
}

function loadDatabase() {
  globalThis.window = globalThis.window || {};
  const origLog = console.log;
  console.log = () => {}; // the database logs on load
  try {
    return createRequire(import.meta.url)(DB_PATH);
  } finally {
    console.log = origLog;
  }
}

function goldPrice(obtain) {
  const m = /Store \(([\d,]+) gold/.exec(obtain || '');
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

export function diff(gameKeys, prices, db) {
  const { tooltips, itemKeyAliases = {} } = db;
  const lines = [];
  // the game's API key can differ from the database key (itemKeyAliases: game key -> database key)
  for (const k of gameKeys) if (!tooltips[k] && !tooltips[itemKeyAliases[k]]) lines.push(`NEW      ${k}`);
  for (const [k, price] of Object.entries(prices)) {
    if (!tooltips[k]) { lines.push(`UNMATCHED ${k} (${price} gold)`); continue; }
    const ours = goldPrice(tooltips[k].obtain);
    if (ours === null) lines.push(`NOPRICE  ${k}: game ${price} gold, obtain "${tooltips[k].obtain}"`);
    else if (ours !== price) lines.push(`PRICE    ${k}: ${ours} -> ${price} gold`);
  }
  return lines;
}

/** Lowercase letters and digits only, so quotes, dashes, whitespace and JSX string splits don't matter. */
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Every chunk squashed into one searchable string (JS escapes like \xf3 / ’ dropped first). */
export function buildGameText(chunks) {
  return squash(chunks.join('\n').replace(/\\(?:u[0-9a-f]{4}|x[0-9a-f]{2})/gi, ''));
}

/**
 * Text lines of an entry to look for. The display name is not searched: a name like "Rune" or "Gold"
 * appears all over the game, so finding it would make an entry look partly matched.
 */
function textSegments(entry) {
  return String(entry.text || '').split(/\n+/).filter((line) => squash(line).length >= 12);
}

const MAX_PIECES = 5; // JSX splits one sentence around inline spans and values; more pieces than this is a mismatch
const MIN_ANCHOR = 10; // at least one piece this long (squashed); short words alone match anywhere and prove nothing

/**
 * A line is present when it appears whole, or when it can be covered by a few consecutive runs of
 * words that each appear in the game text (`t("Restores")`, `n`, `"."`). Words without letters
 * (numbers, "%") are values the game fills in at runtime and end a run.
 */
function segmentPresent(gameText, seg) {
  if (gameText.includes(squash(seg))) return true;
  const words = seg.split(/\s+/).map((w) => (/[a-z]/i.test(w) ? squash(w) : '')).filter((w, i, a) => w || a[i - 1]);
  let pieces = 0;
  let anchored = false;
  for (let i = 0; i < words.length; ) {
    if (!words[i]) { i++; continue; }
    let j = i;
    let run = words[i];
    while (j + 1 < words.length && words[j + 1] && gameText.includes(run + words[j + 1])) run += words[++j];
    if (!gameText.includes(run) || ++pieces > MAX_PIECES) return false;
    anchored ||= run.length >= MIN_ANCHOR;
    i = j + 1;
  }
  return anchored;
}

/**
 * TEXT   entry whose name/text is only partly in the game: some lines still match, others no longer do
 * Entries with no segment found are counted as unverified (the game builds that tooltip from pieces
 * this check can't see), not reported as drift.
 */
export function checkText(gameText, tooltips) {
  const lines = [];
  const unverified = [];
  let verified = 0;
  for (const [k, entry] of Object.entries(tooltips)) {
    const segs = textSegments(entry);
    const missing = segs.filter((s) => !segmentPresent(gameText, s));
    if (missing.length === segs.length) unverified.push(k);
    else if (missing.length) lines.push(`TEXT     ${k}: not in game: ${missing.map((s) => JSON.stringify(s.slice(0, 60))).join(', ')}`);
    else verified++;
  }
  return { lines, unverified, verified };
}

async function main() {
  const verbose = process.argv.includes('--verbose');
  const chunks = await loadChunks();
  const gameKeys = extractItemKeys(chunks);
  const prices = extractPrices(chunks);
  const db = loadDatabase();
  const lines = diff(gameKeys, prices, db);
  const text = checkText(buildGameText(chunks), db.tooltips);
  const failing = [...lines.filter((l) => !l.startsWith('UNMATCHED')), ...text.lines];
  const shown = verbose ? [...lines, ...text.lines] : failing;
  if (shown.length) console.log(shown.join('\n'));
  if (verbose) console.log(`unverified text (${text.unverified.length}): ${text.unverified.join(' ')}`);
  await recordRun('inventoryItems', failing.length ? 'drift' : 'ok');
  if (failing.length) { process.exitCode = 1; return; }
  console.log(`OK: ${gameKeys.length} item keys and ${Object.keys(prices).length} prices checked; `
    + `text matches the game for ${text.verified} entries, ${text.unverified.length} unverified (--verbose lists them).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(String(err?.message || err)); process.exit(2); });
}
