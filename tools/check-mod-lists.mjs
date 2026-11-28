#!/usr/bin/env node
/**
 * Checks that the copies of the mod lists stay in sync. content/mod-registry.js is the source of truth;
 * these files carry their own copy on purpose (the popup cannot import ES modules, background.js and
 * the Orion/iOS fallback in local-mods.js cannot rely on the dynamic import) and each one says "keep in
 * sync". A mod added to one list and forgotten in another only shows up as a missing toggle or a mod
 * that is silently off, so this fails the build instead.
 *
 * Also checks that every listed mod has a file on disk (logical `Official Mods/Board Analyzer.js` ->
 * `mods/Official_Mods/Board_Analyzer.js`; database mods live in `database/`).
 * Also checks background.js HARDCODED_MOD_COUNTS against the registry list lengths, and that every visible
 * mod has a popup description in both locales.
 * Local only, no network.
 *
 * Usage:
 *   node tools/check-mod-lists.mjs
 *
 * Exit code: 0 in sync, 1 drift.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source text without comments (a comment containing an apostrophe must not break string parsing). */
function stripComments(source) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && next === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
    if (c === '/' && next === '*') { i = source.indexOf('*/', i + 2); i = i === -1 ? source.length : i + 2; continue; }
    out += c;
    i++;
  }
  return out;
}

function readList(file, name) {
  const source = stripComments(readFileSync(join(ROOT, file), 'utf8'));
  const match = new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(source);
  if (!match) throw new Error(`${file}: list ${name} not found`);
  return [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));
}

const lists = {
  registry: {
    database: readList('content/mod-registry.js', 'DATABASE_MODS'),
    official: readList('content/mod-registry.js', 'OFFICIAL_MODS'),
    super: readList('content/mod-registry.js', 'SUPER_MODS'),
    ot: readList('content/mod-registry.js', 'OT_MODS'),
    defaults: readList('content/mod-registry.js', 'DEFAULT_ENABLED_MODS'),
    hidden: readList('content/mod-registry.js', 'HIDDEN_MODS')
  }
};
const copies = [
  ['content/local-mods.js FALLBACK_DATABASE_MODS', 'content/local-mods.js', 'FALLBACK_DATABASE_MODS', 'database'],
  ['content/local-mods.js FALLBACK_OFFICIAL_MODS', 'content/local-mods.js', 'FALLBACK_OFFICIAL_MODS', 'official'],
  ['content/local-mods.js FALLBACK_SUPER_MODS', 'content/local-mods.js', 'FALLBACK_SUPER_MODS', 'super'],
  ['content/local-mods.js FALLBACK_OT_MODS', 'content/local-mods.js', 'FALLBACK_OT_MODS', 'ot'],
  ['content/local-mods.js FALLBACK_DEFAULT_ENABLED_MODS', 'content/local-mods.js', 'FALLBACK_DEFAULT_ENABLED_MODS', 'defaults'],
  ['content/local-mods.js defaultEnabledMods', 'content/local-mods.js', 'defaultEnabledMods', 'defaults'],
  ['background.js HARDCODED_DEFAULT_ENABLED_MODS', 'background.js', 'HARDCODED_DEFAULT_ENABLED_MODS', 'defaults'],
  ['popup/popup.js superModNames', 'popup/popup.js', 'superModNames', 'super'],
  ['popup/popup.js otModNames', 'popup/popup.js', 'otModNames', 'ot'],
  ['popup/popup.js hiddenMods', 'popup/popup.js', 'hiddenMods', 'hidden']
];

const problems = [];
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
for (const [label, file, name, key] of copies) {
  const copy = readList(file, name);
  const truth = lists.registry[key];
  if (sameSet(copy, truth)) continue;
  const missing = truth.filter((x) => !copy.includes(x));
  const extra = copy.filter((x) => !truth.includes(x));
  problems.push(`${label} differs from content/mod-registry.js ${key}: missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)}`);
}

// background.js answers getModCounts from HARDCODED_MOD_COUNTS (the service worker cannot import the registry)
{
  const source = stripComments(readFileSync(join(ROOT, 'background.js'), 'utf8'));
  const block = /const HARDCODED_MOD_COUNTS = \{([^}]*)\}/.exec(source);
  if (!block) {
    problems.push('background.js: HARDCODED_MOD_COUNTS not found');
  } else {
    for (const key of ['database', 'official', 'super', 'ot']) {
      const value = Number(new RegExp(`\\b${key}:\\s*(\\d+)`).exec(block[1])?.[1]);
      if (value !== lists.registry[key].length) {
        problems.push(`background.js HARDCODED_MOD_COUNTS.${key} is ${value}, mod-registry.js has ${lists.registry[key].length}`);
      }
    }
  }
}

// the popup shows a description for every visible bundled mod; it comes only from the locale files
{
  const hidden = new Set(lists.registry.hidden);
  for (const loc of ['en-US', 'pt-BR']) {
    const descriptions = JSON.parse(readFileSync(join(ROOT, `assets/locales/${loc}.json`), 'utf8')).popup?.modDescriptions || {};
    for (const key of ['official', 'super', 'ot']) {
      for (const name of lists.registry[key]) {
        if (hidden.has(name)) continue;
        const displayName = name.replace(/\.js$/, '').replaceAll('_', ' ');
        if (!descriptions[displayName]) problems.push(`assets/locales/${loc}.json popup.modDescriptions has no "${displayName}" (mod ${name})`);
      }
    }
  }
}

// every listed mod needs a file
const FOLDERS = { official: 'Official_Mods', super: 'Super_Mods', ot: 'OT_Mods' };
const onDisk = (name) => name.replaceAll(' ', '_');
for (const name of lists.registry.database) {
  if (!existsSync(join(ROOT, 'database', name))) problems.push(`database/${name} is listed in mod-registry.js but missing on disk`);
}
for (const [key, folder] of Object.entries(FOLDERS)) {
  for (const name of lists.registry[key]) {
    if (!existsSync(join(ROOT, 'mods', folder, onDisk(name)))) {
      problems.push(`mods/${folder}/${onDisk(name)} (${name}) is listed in mod-registry.js but missing on disk`);
    }
  }
}
// defaults and hidden entries must be known mods
const known = new Set([
  ...lists.registry.database.map((n) => `database/${n}`),
  ...lists.registry.official.map((n) => `Official Mods/${n}`),
  ...lists.registry.super.map((n) => `Super Mods/${n}`),
  ...lists.registry.ot.map((n) => `OT Mods/${n}`)
]);
for (const entry of lists.registry.defaults) {
  if (!known.has(entry)) problems.push(`DEFAULT_ENABLED_MODS has "${entry}", which is not in any mod list`);
}

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`DRIFT: ${problems.length} mod list problem(s). Fix content/mod-registry.js first, then the copies.`);
  process.exit(1);
}
console.log(`OK: ${copies.length} mod list copies match content/mod-registry.js and every listed mod has a file.`);
