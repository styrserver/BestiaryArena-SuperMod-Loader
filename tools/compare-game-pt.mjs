#!/usr/bin/env node
/**
 * Compare our pt-BR strings with the game's own Portuguese.
 *
 * The game ships its translations inline as `t("English", "Português")` calls in its JS chunks (no message
 * catalogue). This downloads the chunks of https://bestiaryarena.com/pt/game, collects every en/pt pair, and
 * reports each of OUR en-US values that the game also has when our pt-BR text differs. Report only: it never
 * edits a locale and always exits 0 (a difference can be a deliberate choice, e.g. grammar or context), so
 * it is not part of check-all.
 *
 * Usage:
 *   node tools/compare-game-pt.mjs            # list differences
 *   node tools/compare-game-pt.mjs --all      # also list matches
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://bestiaryarena.com';
const showAll = process.argv.includes('--all');

const unescapeJs = (s) => s
  .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\(["'\\])/g, '$1');

const html = await (await fetch(`${BASE}/pt/game`)).text();
const chunkUrls = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"]+\.js/g)].map((m) => m[0]))];
if (!chunkUrls.length) {
  console.error('FAILED: no chunks found on /pt/game');
  process.exit(2);
}

const pairRe = /[A-Za-z_$][\w$]*\("((?:[^"\\]|\\.)+)","((?:[^"\\]|\\.)+)"\)/g;
const pairs = new Map();
for (const url of chunkUrls) {
  const src = await (await fetch(BASE + url)).text();
  for (const m of src.matchAll(pairRe)) {
    const en = unescapeJs(m[1]);
    const pt = unescapeJs(m[2]);
    if (en === pt || en.length < 3) continue;
    if (!pairs.has(en)) pairs.set(en, new Set());
    pairs.get(en).add(pt);
  }
}

const flat = (o, p = '', r = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const q = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object') flat(v, q, r);
    else r[q] = v;
  }
  return r;
};
const load = (l) => flat(JSON.parse(readFileSync(join(ROOT, `assets/locales/${l}.json`), 'utf8')));
const en = load('en-US');
const pt = load('pt-BR');

let found = 0;
const diffs = [];
for (const [key, value] of Object.entries(en)) {
  if (typeof value !== 'string') continue;
  const game = pairs.get(value);
  if (!game) continue;
  found++;
  if (game.has(pt[key])) {
    if (showAll) console.log(`OK    ${key}: ${pt[key]}`);
    continue;
  }
  diffs.push({ key, en: value, ours: pt[key], game: [...game].join(' | ') });
}

console.log(`Game pairs: ${pairs.size}. Our en-US strings the game also has: ${found}. Differences: ${diffs.length}.`);
for (const d of diffs) console.log(`\n${d.key}\n  en:   ${d.en}\n  ours: ${d.ours}\n  game: ${d.game}`);
