#!/usr/bin/env node
/**
 * Release-consistency check for docs/patch-notes.json (local only, no network, read-only).
 *
 * Fails when:
 *   - manifest.json and manifest_firefox.json disagree on "version"
 *   - the first patch-notes entry is not that version (a release shipped without a note)
 *   - a version appears twice, or entries are not strictly newest-first
 *   - an entry has no changes, an unknown type, or a missing mod/text
 *   - the newest entry lists the same mod+type twice (the file's rules say to merge them)
 *
 * Usage:
 *   node tools/check-patch-notes.mjs
 *
 * Exit code: 0 OK, 1 inconsistency found, 2 a file could not be read or parsed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = new Set(['added', 'changed', 'fixed', 'removed']);

function readJson(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch (error) {
    console.error(`FAILED: cannot read ${rel}: ${error.message}`);
    process.exit(2);
  }
}

const parseVersion = (v) => String(v).split('.').map(Number);
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const chrome = readJson('manifest.json').version;
const firefox = readJson('manifest_firefox.json').version;
const notes = readJson('docs/patch-notes.json').notes;
const problems = [];

if (chrome !== firefox) problems.push(`manifest.json (${chrome}) and manifest_firefox.json (${firefox}) versions differ`);
if (!Array.isArray(notes) || !notes.length) {
  problems.push('docs/patch-notes.json has no "notes" entries');
} else {
  if (notes[0].version !== chrome) {
    problems.push(`newest patch note is ${notes[0].version} but manifest.json is ${chrome}: add an entry for ${chrome}`);
  }
  const seen = new Set();
  notes.forEach((entry, i) => {
    if (seen.has(entry.version)) problems.push(`version ${entry.version} appears more than once`);
    seen.add(entry.version);
    if (i > 0 && compareVersions(notes[i - 1].version, entry.version) <= 0) {
      problems.push(`${entry.version} is not older than the entry above it (${notes[i - 1].version})`);
    }
    if (!Array.isArray(entry.changes) || !entry.changes.length) problems.push(`${entry.version}: no changes listed`);
    (entry.changes ?? []).forEach((c, j) => {
      if (!c.mod || !c.text) problems.push(`${entry.version} change #${j + 1}: missing mod or text`);
      if (!TYPES.has(c.type)) problems.push(`${entry.version} change #${j + 1}: unknown type "${c.type}"`);
    });
  });
  const pairs = new Set();
  for (const c of notes[0].changes ?? []) {
    const key = `${c.mod}|${c.type}`;
    if (pairs.has(key)) problems.push(`${notes[0].version}: duplicate "${c.mod}" ${c.type} entries, merge them`);
    pairs.add(key);
  }
}

if (problems.length) {
  console.log('DRIFT: patch notes are inconsistent:');
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exitCode = 1;
} else {
  console.log(`OK: manifests and newest patch note agree on ${chrome} (${notes.length} entries).`);
}
