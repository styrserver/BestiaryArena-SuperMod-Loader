#!/usr/bin/env node
/**
 * Toast consolidation guard. Every mod should show toasts through the shared stack in
 * content/ba-shared.js (window.BAToast.show({ mod, message, type, icon })), not its own
 * `*-toast-container`. LEGACY lists files that may still carry their own copy (empty now: every mod is
 * migrated). This check fails if a file not listed grows its own container, or if a listed file no longer
 * has one (remove it from LEGACY). It also checks ba-shared.js is shipped by both manifests.
 * Local only, no network.
 *
 * Usage:
 *   node tools/check-toasts.mjs
 *
 * Exit code: 0 OK, 1 drift.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, listScripts } from './lib.mjs';
const LEGACY = new Set([]);

const problems = [];
const withContainer = new Set(
  ['content', 'database', 'mods']
    .flatMap((d) => listScripts(d))
    .filter((f) => f !== 'content/ba-shared.js')
    .filter((f) => /toast-container['"`]/.test(readFileSync(join(ROOT, f), 'utf8')))
);
for (const f of withContainer) {
  if (!LEGACY.has(f)) problems.push(`${f}: defines its own toast container - use window.BAToast.show({ mod, message })`);
}
for (const f of LEGACY) {
  if (!withContainer.has(f)) problems.push(`${f}: no longer has its own toast container - remove it from LEGACY in tools/check-toasts.mjs`);
}
// Toast mod names must be translated: no string literal for `mod:`, and every mods.<ns>.modName key a file
// references must exist in both locales.
const locales = ['en-US', 'pt-BR'].map((l) => JSON.parse(readFileSync(join(ROOT, `assets/locales/${l}.json`), 'utf8')));
for (const f of ['content', 'database', 'mods'].flatMap((d) => listScripts(d)).filter((x) => x !== 'content/ba-shared.js')) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  let i = src.indexOf('BAToast');
  while (i !== -1) {
    if (/^BAToast\??\.show\(\{[^}]{0,200}?\bmod:\s*['"`]/.test(src.slice(i, i + 260))) {
      problems.push(`${f}: BAToast.show with a literal mod name - use t('mods.<ns>.modName')`);
      break;
    }
    i = src.indexOf('BAToast', i + 7);
  }
  for (const m of src.matchAll(/mods\.(\w+)\.modName/g)) {
    const ns = m[1];
    locales.forEach((loc, n) => {
      if (typeof loc.mods?.[ns]?.modName !== 'string') problems.push(`${f}: mods.${ns}.modName missing in ${['en-US', 'pt-BR'][n]}`);
    });
  }
}
for (const manifest of ['manifest.json', 'manifest_firefox.json']) {
  if (!readFileSync(join(ROOT, manifest), 'utf8').includes('"content/ba-shared.js"')) {
    problems.push(`${manifest}: content/ba-shared.js missing from web_accessible_resources`);
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`DRIFT: ${problems.length} toast problem(s).`);
  process.exit(1);
}
console.log(`OK: toasts use content/ba-shared.js (${LEGACY.size} files still on legacy containers).`);
