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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS = [
  { file: 'check-creature-combat.mjs', fix: '/creature-snapshot' },
  { file: 'check-inventory-items.mjs', fix: '/inventory-check' },
  { file: 'check-database-names.mjs', fix: 'fix the STALE/RENAMED list entries in database/' },
  { file: 'check-room-scripts.mjs', fix: 'review ROOM_SCRIPT_NOTES, then node tools/check-room-scripts.mjs --update' }
];
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
