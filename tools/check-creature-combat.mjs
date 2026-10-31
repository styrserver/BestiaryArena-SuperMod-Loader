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

const ORIGIN = 'https://bestiaryarena.com';
const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'creature-database.js');
const DATA_BLOCK = /(\/\/ BEGIN CREATURE_COMBAT_DATA\r?\n)[\s\S]*?(\/\/ END CREATURE_COMBAT_DATA)/;
const MS_PER_TICK = 62.5;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function loadChunks() {
  const html = await fetchText(`${ORIGIN}/`);
  const paths = new Set(html.match(/\/_next\/static\/chunks\/[^"'\\\s]+?\.js/g) || []);
  const buildId = /\/_next\/static\/([^/"]+)\/_buildManifest\.js/.exec(html)?.[1];
  if (!buildId) throw new Error('build id not found on the home page');
  const manifest = await fetchText(`${ORIGIN}/_next/static/${buildId}/_buildManifest.js`);
  for (const p of manifest.match(/static\/chunks\/[^"'\\\s]+?\.js/g) || []) paths.add('/_next/' + p);
  if (paths.size === 0) throw new Error('no chunk URLs found');
  return Promise.all([...paths].map((p) => fetchText(ORIGIN + p)));
}

/** Reads a `{...}` literal starting at `start`, splitting on top-level commas. */
function readTopLevel(src, start, limit = 4000) {
  let depth = 0;
  let cur = '';
  const parts = [];
  for (let i = start; i < src.length && i - start < limit; i++) {
    const c = src[i];
    if (c === '{' || c === '(' || c === '[') {
      depth++;
      if (depth > 1) cur += c;
    } else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) { parts.push(cur); return parts; }
      cur += c;
    } else if (c === ',' && depth === 1) { parts.push(cur); cur = ''; }
    else cur += c;
  }
  return null;
}

function indexConstantObjects(src) {
  const byVar = new Map();
  const re = /(?:^|[,;{ ])([A-Za-z_$][\w$]{0,5})=\{(?=[A-Z][A-Z0-9_]+:)/g;
  let m;
  while ((m = re.exec(src))) {
    const parts = readTopLevel(src, m.index + m[0].length - 1);
    if (!parts) continue;
    const obj = {};
    let ok = true;
    for (const kv of parts) {
      const km = /^([A-Z][A-Z0-9_]+):([\s\S]*)$/.exec(kv);
      if (!km) { ok = false; break; }
      obj[km[1]] = km[2];
    }
    if (!ok || !Object.keys(obj).length) continue;
    if (!byVar.has(m[1])) byVar.set(m[1], []);
    byVar.get(m[1]).push({ at: m.index, obj });
  }
  return byVar;
}

/** Returns { v, ms } (ms: already milliseconds, i.e. wrapped in the game's ms->ticks `HX()`). */
function scalar(raw) {
  const v = String(raw).trim();
  const ms = /^\(0,[A-Za-z_$][\w$]*\.HX\)\(([\d.e+-]+)\)$/.exec(v);
  if (ms) return { v: Number(ms[1]), ms: true };
  if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(v)) return { v: Number(v), ms: false };
  return undefined; // nested objects, fractions, references: not shown
}

/** Index just past the `}` that closes the object literal opening at `start` (capped at 20000 chars). */
function objectEnd(src, start) {
  let depth = 0;
  const limit = Math.min(src.length, start + 20000);
  for (let i = start; i < limit; i++) {
    const c = src[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return limit;
}

function parseNameToId(src) {
  const anchor = src.indexOf('Rat:1,Minotaur:2,"Minotaur Mage":3');
  if (anchor < 0) throw new Error('creature name -> id table not found');
  const open = src.lastIndexOf('{', anchor);
  const close = src.indexOf('}', anchor);
  const json = src.slice(open, close + 1).replace(/([{,])([A-Za-z_$][\w$]*):/g, '$1"$2":');
  return JSON.parse(json);
}

export function extractCombatData(chunks) {
  const src = chunks.find((c) => c.includes('queryTags:') && c.includes('Rat:1,Minotaur:2'));
  if (!src) throw new Error('creature bundle not found in the downloaded chunks');
  const nameToId = parseNameToId(src);
  const objects = indexConstantObjects(src);
  const metas = [...src.matchAll(/name:"([^"]+)",roles:\[[^\]]*\],queryTags:/g)];
  if (metas.length < 100) throw new Error(`only ${metas.length} creature entries found`);

  /** Constants and attack delay read from the metadata text starting at `from`. */
  const readEntry = (from, to) => {
    const seg = src.slice(from, Math.min(to, from + 14000));
    const constants = {};
    for (const r of seg.matchAll(/\b([A-Za-z_$][\w$]{0,5})\.([A-Z][A-Z0-9_]{2,})\b/g)) {
      const defs = objects.get(r[1]);
      if (!defs) continue;
      let def = null;
      for (const d of defs) if (d.at <= from + 14000) def = d; // nearest preceding
      const val = def && r[2] in def.obj ? scalar(def.obj[r[2]]) : undefined;
      if (!val) continue;
      // *_TICKS constants are stored in milliseconds under a *_MS name, so the panel has one unit.
      // A raw tick count is converted; an HX() value is already milliseconds.
      const isTicks = r[2].endsWith('_TICKS');
      const msName = r[2].replace(/_TICKS$/, '_MS');
      const name = isTicks && !(msName in def.obj) ? msName : r[2];
      constants[name] = isTicks && !val.ms ? val.v * MS_PER_TICK : val.v;
    }
    const delay = /attackDelayTicks:(?:\(0,[\w$]+\.HX\)\(([\d.e+-]+)\)|(\d+))/.exec(seg);
    return {
      ad: delay ? (delay[1] ? Number(delay[1]) : Number(delay[2]) * MS_PER_TICK) : null,
      c: constants
    };
  };

  const out = {};
  const byVar = new Map(); // minified variable of a metadata object -> its entry
  metas.forEach((m, k) => {
    const end = k + 1 < metas.length ? metas[k + 1].index : src.length;
    const entry = { n: m[1], ...readEntry(m.index, end) };
    const owner = /(?:^|[,;{ ])([A-Za-z_$][\w$]*)=\{$/.exec(src.slice(Math.max(0, m.index - 24), m.index));
    if (owner) byVar.set(owner[1], entry);
    const id = nameToId[m[1]];
    if (id && !out[id]) out[id] = entry; // summons have no id; later duplicates are variants
  });

  // Event variants are written as `X={...Base,queryTags:[...],skill:{...}}` (Clot = Slime, Reindeer =
  // Deer B, ...): they inherit Base's numbers and override whatever their own tooltip reads. The
  // variant's id comes from its own `name:"..."`, else from the first creature name its tooltip prints.
  const spreads = [...src.matchAll(/(?:^|[,;{ ])([A-Za-z_$][\w$]*)=\{\.\.\.([A-Za-z_$][\w$]*),queryTags:/g)];
  for (const sp of spreads) {
    const base = byVar.get(sp[2]);
    if (!base) continue;
    const objStart = src.indexOf('{', sp.index);
    const from = sp.index + sp[0].length - 'queryTags:'.length;
    const objEnd = objectEnd(src, objStart); // the variant's own object, not the code after it
    const head = src.slice(from, objEnd);
    const ownName = /^[^]{0,400}?\bname:"([^"]+)"/.exec(head)?.[1]
      ?? /className:"text-monster",children:"([^"]+?)(?:'s)?"/.exec(head)?.[1]; // "Gummy Raider's"
    const id = nameToId[ownName];
    if (!id || out[id]) continue;
    const own = readEntry(from, objEnd);
    out[id] = { n: ownName, ad: own.ad ?? base.ad, c: { ...base.c, ...own.c } };
  }
  return out;
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
  if (!lines.length) { console.log(`OK: ${Object.keys(game).length} creatures match the snapshot.`); return; }
  console.log(lines.join('\n'));
  if (!update) { process.exitCode = 1; return; }
  const next = text.replace(DATA_BLOCK, (_, a, b) => `${a}${serialize(game)}\n${b}`);
  writeFileSync(DB_PATH, next);
  console.log(`Updated CREATURE_COMBAT_DATA (${Object.keys(game).length} creatures).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(String(err?.message || err)); process.exit(2); });
}
