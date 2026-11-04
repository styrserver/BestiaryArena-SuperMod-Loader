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
 * Also a warning (never a failure): mods under mods/ changed since origin/main that no line of the newest
 * entry names (file Board_Analyzer.js matches mod "Board Analyzer"). A heuristic against forgotten notes.
 *
 * An empty newest entry (the next version, just opened after a release) is only a NOTE mid-work; with
 * --release (used by tools/release.mjs) it fails, so an empty version can never be published.
 *
 * Usage:
 *   node tools/check-patch-notes.mjs [--release]
 *
 * Exit code: 0 OK, 1 inconsistency found, 2 a file could not be read or parsed.
 */
import { spawnSync } from 'node:child_process';
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
const RELEASE = process.argv.includes('--release');
const problems = [];
const notesOnly = [];

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
    if (!Array.isArray(entry.changes) || !entry.changes.length) {
      (i === 0 && !RELEASE ? notesOnly : problems).push(`${entry.version}: no changes listed${i === 0 ? ' yet (add them as you work; a release needs at least one)' : ''}`);
    }
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

// Heuristic: changed mod files vs mods named in the newest entry (skipped silently without git/origin).
function changedMods() {
  const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  const diff = git('diff', '--name-only', 'origin/main');
  if (diff.status !== 0) return [];
  const untracked = git('ls-files', '--others', '--exclude-standard').stdout ?? '';
  const lines = `${diff.stdout}\n${untracked}`.split(/\r?\n/);
  return [...new Set(lines.map((f) => /^mods\/[^/]+\/([^/]+)\.js$/.exec(f)?.[1]).filter(Boolean))];
}
if (Array.isArray(notes) && notes[0]) {
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const named = new Set((notes[0].changes ?? []).map((c) => norm(c.mod)));
  const missing = changedMods().filter((m) => !named.has(norm(m)));
  if (missing.length) notesOnly.push(`mods changed since origin/main with no ${notes[0].version} line: ${missing.join(', ')}`);
}

if (problems.length) {
  console.log('DRIFT: patch notes are inconsistent:');
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exitCode = 1;
} else {
  notesOnly.forEach((n) => console.log(`NOTE: ${n}`));
  console.log(`OK: manifests and newest patch note agree on ${chrome} (${notes.length} entries).`);
}
