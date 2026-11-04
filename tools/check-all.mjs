#!/usr/bin/env node
/**
 * Runs every tools/check-*.mjs drift check against the live game, one after another, and prints one
 * summary. Read-only: it never passes --update. Each tool still stamps database/tool-runs.js itself.
 *
 * Usage:
 *   node tools/check-all.mjs
 *
 * Exit code: 0 all OK, 1 at least one tool reported drift, 2 at least one tool failed to run
 * (network or parsing; 2 wins over 1). Each tool's own output is printed in full above the summary.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
// Every tools/check-*.mjs runs automatically (a new check needs no edit here). FIXES only supplies
// a hint; a check without an entry falls back to its own --update / output.
const FIXES = {
  'check-creature-combat.mjs': 'follow /check-game-update step "creature combat" (--update rewrites the snapshot)',
  'check-inventory-items.mjs': 'edit database/inventory-database.js by hand (see /check-game-update)',
  'check-database-names.mjs': 'fix the STALE/RENAMED list entries in database/',
  'check-room-scripts.mjs': 'review ROOM_SCRIPT_NOTES, then node tools/check-room-scripts.mjs --update',
  'check-outfits-mounts.mjs': 'node tools/check-outfits-mounts.mjs --update (Outfiter.js snapshot)',
  'check-patch-notes.mjs': 'add/fix the top entry in docs/patch-notes.json so it matches the manifest version',
  'check-fast-simulation.mjs': 'update getNativeCombat()/createFastRunner() in Board_Analyzer.js, bump FAST_ENGINE_REVISION, re-run'
};
const TOOLS = readdirSync(DIR)
  .filter((f) => /^check-.+\.mjs$/.test(f) && f !== 'check-all.mjs')
  .sort()
  .map((file) => ({ file, fix: FIXES[file] ?? 'read the tool output; see its --help / --update' }));
const VERDICT = { 0: 'OK', 1: 'DRIFT', 2: 'FAILED' };

const results = TOOLS.map((tool) => {
  console.log(`\n=== ${tool.file}`);
  const run = spawnSync(process.execPath, [join(DIR, tool.file)], { stdio: 'inherit' });
  return { ...tool, code: run.status ?? 2 };
});

console.log('\n=== Summary');
for (const r of results) {
  console.log(`${(VERDICT[r.code] ?? 'FAILED').padEnd(7)} ${r.file}${r.code === 0 ? '' : `  -> ${r.fix}`}`);
}
process.exitCode = results.some((r) => r.code !== 0 && r.code !== 1) ? 2 : results.some((r) => r.code === 1) ? 1 : 0;
