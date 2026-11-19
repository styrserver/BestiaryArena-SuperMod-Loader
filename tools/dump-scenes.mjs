#!/usr/bin/env node
/**
 * Dumps every creature's ability scene (plain and awakened) to JSON, or compares two dumps. Use it around a refactor of
 * database/creature-database.js: dump before, dump after, diff; the scenes should be identical (ids that differ are listed).
 *
 *   node tools/dump-scenes.mjs before.json
 *   node tools/dump-scenes.mjs after.json
 *   node tools/dump-scenes.mjs --diff before.json after.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

if (args[0] === '--diff') {
  const [a, b] = [args[1], args[2]].map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const differ = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  console.log(differ.length ? `DIFFERENT: ${differ.join(', ')}` : `identical (${Object.keys(a).length} scenes)`);
  process.exit(differ.length ? 1 : 0);
}

if (!args[0]) { console.error('usage: node tools/dump-scenes.mjs <out.json> | --diff <a.json> <b.json>'); process.exit(2); }
const src = readFileSync(join(ROOT, 'database/creature-database.js'), 'utf8');
const g = { console: { log() {}, warn() {}, error() {} } };
g.window = g; g.globalThis = g;
g.document = { createElement() { return { style: {}, appendChild() {} }; }, head: { appendChild() {} }, body: null, styleSheets: [] };
g.state = { utils: {} }; g.navigator = {}; g.setTimeout = () => 0; g.setInterval = () => 0; g.BestiaryLogger = { getLevel: () => 'silent' };
new Function('window', 'globalThis', 'document', 'state', 'navigator', 'setTimeout', 'setInterval', 'console', src)(g, g, g.document, g.state, g.navigator, g.setTimeout, g.setInterval, g.console);
const out = {};
for (let id = 1; id <= 200; id++) for (const awakened of [false, true]) {
  const scene = g.creatureDatabase.getAbilityScene(id, awakened);
  if (scene) out[id + (awakened ? 'a' : '')] = scene;
}
writeFileSync(args[0], JSON.stringify(out));
console.log(`${Object.keys(out).length} scenes written to ${args[0]}`);
