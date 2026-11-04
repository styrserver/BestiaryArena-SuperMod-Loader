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
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function scripts(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) scripts(rel, out);
    else if (/\.m?js$/.test(name)) out.push(rel);
  }
  return out;
}

const files = ['background.js', ...['assets', 'content', 'database', 'mods', 'popup', 'tools'].flatMap((d) => scripts(d))];
const broken = files.filter((f) => spawnSync(process.execPath, ['--check', f], { cwd: ROOT, stdio: 'pipe' }).status !== 0);

if (broken.length) {
  console.log(`DRIFT: syntax errors in ${broken.length} file(s):`);
  broken.forEach((f) => console.log(`  - ${f}  (node --check ${f})`));
  process.exitCode = 1;
} else {
  console.log(`OK: ${files.length} scripts parse.`);
}
