#!/usr/bin/env node
/**
 * One command from "changes are ready" to "submitted to GitHub, Chrome Web Store and Firefox AMO".
 * Full procedure and the reasons behind each step: docs/release.md.
 *
 *   node tools/release.mjs 5.2.12            bump both manifests, check, commit, push, watch the run
 *   node tools/release.mjs                    same, for a version you already bumped by hand
 *   node tools/release.mjs --dry-run          run every check, change and push nothing
 *   node tools/release.mjs --start-next       only open the next version locally (after a release)
 *
 * Flags: --yes (no confirmation prompt), --full (also run tools/check-all.mjs: live-game drift checks,
 *        needs network), --no-watch (push and stop; do not wait for the workflow).
 *
 * What it does, in order (any failure stops it before anything is pushed):
 *   1. on main, not behind origin/main
 *   2. optional version bump in manifest.json + manifest_firefox.json
 *   3. checks: tools/check-syntax.mjs (every shipped script), tools/check-patch-notes.mjs, (--full: check-all),
 *      store zips build (tools/package.mjs)
 *   4. the version must differ from origin/main's, because a version change is what triggers the release
 *   5. commit everything pending as "Release X.Y.Z", push to main
 *   6. watch the GitHub Actions run (needs `gh`, logged in) and print the result per store
 *   7. open the next patch version locally (manifests + an empty top patch-notes entry), not pushed:
 *      that is the in-progress version until the next release. Skipped when the run failed.
 *
 * The patch-notes entry is written by hand first (docs/patch-notes.json): it is player-facing copy.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const wanted = args.find((a) => /^\d+\.\d+\.\d+$/.test(a));
const DRY = flag('--dry-run');

const fail = (msg) => { console.error(`\nSTOP: ${msg}`); process.exit(1); };
const step = (msg) => console.log(`\n== ${msg}`);

function run(cmd, cmdArgs, { allowFail = false, inherit = false } = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });
  if (r.status !== 0 && !allowFail) fail(`${cmd} ${cmdArgs.join(' ')} failed\n${r.stderr ?? ''}${r.stdout ?? ''}`);
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
}
const git = (...a) => run('git', a, { allowFail: false }).out;
const node = (script, ...a) => run(process.execPath, [join('tools', script), ...a], { allowFail: true, inherit: true }).ok;

const readManifest = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
const compare = (a, b) => {
  const x = a.split('.').map(Number); const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** Bumps both manifests to the next patch and opens an empty top patch-notes entry. Local only. */
function startNextVersion() {
  const current = readManifest('manifest.json').version;
  const [a, b, c] = current.split('.').map(Number);
  const next = `${a}.${b}.${c + 1}`;
  const notesPath = join(ROOT, 'docs', 'patch-notes.json');
  const notes = readFileSync(notesPath, 'utf8');
  if (notes.includes(`"version": "${next}"`)) fail(`patch-notes.json already has ${next}`);
  const top = JSON.parse(notes).notes[0];
  if (!top.changes.length) fail(`${top.version} is already open with no changes yet: add to it instead of opening another version`);
  for (const file of ['manifest.json', 'manifest_firefox.json']) {
    const p = join(ROOT, file);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${next}"`));
  }
  const open = /"notes": \[(\r?\n)/.exec(notes);
  if (!open) fail('could not find the "notes" array in patch-notes.json');
  const nl = open[1];
  const entry = ['    {', `      "version": "${next}",`, '      "changes": []', '    },', ''].join(nl);
  const at = open.index + open[0].length;
  writeFileSync(notesPath, notes.slice(0, at) + entry + notes.slice(at));
  console.log(`\nNext version ${next} opened locally (not pushed). Add each player-visible change to its patch-notes entry.`);
}
if (flag('--start-next')) { startNextVersion(); process.exit(0); }

// 1. git state
step('Git state');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('not on branch main');
git('fetch', '--quiet', 'origin', 'main');
if (Number(git('rev-list', '--count', 'HEAD..origin/main')) > 0) fail('origin/main has commits you do not have: run git pull first');
const remoteVersion = JSON.parse(git('show', 'origin/main:manifest.json')).version;
console.log(`origin/main is at ${remoteVersion}`);

// 2. version bump
let version = readManifest('manifest.json').version;
if (wanted) {
  if (compare(wanted, remoteVersion) <= 0) fail(`${wanted} is not newer than ${remoteVersion} on origin/main`);
  if (DRY) console.log(`(dry run) would bump ${version} -> ${wanted}`);
  else {
    for (const file of ['manifest.json', 'manifest_firefox.json']) {
      const p = join(ROOT, file);
      const text = readFileSync(p, 'utf8');
      if (!/"version": "\d+\.\d+\.\d+"/.test(text)) fail(`no "version" line found in ${file}`);
      writeFileSync(p, text.replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${wanted}"`));
    }
    console.log(`bumped ${version} -> ${wanted}`);
  }
  version = wanted;
}

// 3. checks
step('Checks');
if (!node('check-syntax.mjs')) fail('fix the syntax errors above: a broken shipped file breaks the extension for everyone');
if (!DRY && wanted === undefined && compare(version, remoteVersion) === 0) fail(`version is still ${version} (same as origin/main): bump it, or run: node tools/release.mjs <new version>`);
if (!node('check-patch-notes.mjs', '--release')) fail(`add the ${version} entry to docs/patch-notes.json first (it is player-facing copy, write it by hand)`);
if (flag('--full') && !node('check-all.mjs')) fail('check-all found drift or a failure: fix it (see /check-game-update), then re-run');
if (!node('package.mjs')) fail('store zips did not build');

// 4. summary + confirmation
step('Ready');
const changed = git('status', '--porcelain');
console.log(`version ${version} (origin/main: ${remoteVersion})\n${changed || '(no uncommitted changes)'}`);
if (DRY) { console.log('\nDry run: nothing committed or pushed.'); process.exit(0); }
if (!flag('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\nCommit all of the above and push ${version} to main (publishes to both stores)? [y/N] `)).trim().toLowerCase();
  rl.close();
  if (answer !== 'y') fail('cancelled, nothing pushed');
}

// 5. commit + push
step('Commit and push');
git('add', '-A');
if (git('status', '--porcelain')) git('commit', '-q', '-m', `Release ${version}`);
git('push', 'origin', 'main');
const sha = git('rev-parse', 'HEAD');
console.log(`pushed ${sha.slice(0, 7)}`);

// 6. watch the workflow
if (flag('--no-watch')) { startNextVersion(); process.exit(0); }
const GH_PATHS = ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe'];
const gh = GH_PATHS.find((p) => spawnSync(p, ['--version'], { stdio: 'ignore' }).status === 0);
if (!gh) { console.log('\n`gh` not found: follow the run at https://github.com/styrserver/BestiaryArena-SuperMod-Loader/actions'); startNextVersion(); process.exit(0); }

step('GitHub Actions (Chrome + Firefox)');
let runId = '';
for (let i = 0; i < 12 && !runId; i++) {
  runId = run(gh, ['run', 'list', '--workflow', 'release.yml', '--commit', sha, '--json', 'databaseId', '-q', '.[0].databaseId'], { allowFail: true }).out;
  if (!runId) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},5000)']);
}
if (!runId) fail('the workflow did not start: check the Actions tab (a version change in manifest.json is what starts it)');
const watched = run(gh, ['run', 'watch', runId, '--exit-status'], { allowFail: true, inherit: true }).ok;
console.log(run(gh, ['run', 'view', runId], { allowFail: true }).out.split('\n').slice(0, 8).join('\n'));
if (!watched) fail(`the release run failed: gh run view ${runId} --log-failed   (one store can succeed while the other fails)`);
console.log(`\nSubmitted ${version}. Chrome now reviews it (pending until Google approves); AMO lists it as soon as it is approved.`);
startNextVersion();
