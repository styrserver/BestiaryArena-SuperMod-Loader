#!/usr/bin/env node
/**
 * Syntax check (`node --check`) of every script the extension ships plus the tools. A syntax error in a
 * shipped file would break the extension for everyone, so release.mjs and the PR workflow both run this.
 * Local only, no network.
 *
 * Usage:
 *   node tools/check-syntax.mjs
 *
 * Exit code: 0 all parse, 1 at least one file has a syntax error.
 */
import { spawnSync } from 'node:child_process';
import { ROOT, listScripts } from './lib.mjs';

const files = ['background.js', ...['assets', 'content', 'database', 'mods', 'popup', 'tools'].flatMap((d) => listScripts(d))];
const broken = files.filter((f) => spawnSync(process.execPath, ['--check', f], { cwd: ROOT, stdio: 'pipe' }).status !== 0);

if (broken.length) {
  console.log(`DRIFT: syntax errors in ${broken.length} file(s):`);
  broken.forEach((f) => console.log(`  - ${f}  (node --check ${f})`));
  process.exitCode = 1;
} else {
  console.log(`OK: ${files.length} scripts parse.`);
}
