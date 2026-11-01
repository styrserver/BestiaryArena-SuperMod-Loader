/**
 * Shared by the tools/check-*.mjs drift checks: records when a tool last ran and against which game
 * build, in the TOOL_RUNS block of database/tool-runs.js (the in-game admin reminder reads it).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://bestiaryarena.com';
const STAMP_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'tool-runs.js');
const STAMP_BLOCK = /(\/\/ BEGIN TOOL_RUNS\r?\n)[\s\S]*?(\/\/ END TOOL_RUNS)/;

/** Build id of the deployed game: the same value as `__NEXT_DATA__.buildId` in the page. */
export async function fetchBuildId() {
  const res = await fetch(`${ORIGIN}/`);
  if (!res.ok) throw new Error(`${ORIGIN}/ -> HTTP ${res.status}`);
  const html = await res.text();
  const id = /"buildId":"([^"]+)"/.exec(html)?.[1] ?? /\/_next\/static\/([^/"]+)\/_buildManifest\.js/.exec(html)?.[1];
  if (!id) throw new Error('build id not found on the home page');
  return id;
}

function readRuns(text) {
  const m = STAMP_BLOCK.exec(text);
  if (!m) throw new Error('TOOL_RUNS block not found in database/tool-runs.js');
  const body = m[0].replace(/^\/\/ BEGIN[^\n]*\n/, '').replace(/\n?\/\/ END[^\n]*$/, '');
  return new Function(`${body}; return TOOL_RUNS;`)();
}

/**
 * Stamps `name` (a key of TOOL_RUNS) with the current game build and time. A stamp failure only warns:
 * it must never change the tool's own exit code.
 */
export async function recordRun(name, status) {
  try {
    const text = readFileSync(STAMP_PATH, 'utf8');
    const runs = readRuns(text);
    if (!(name in runs)) throw new Error(`unknown tool "${name}"`);
    runs[name] = { buildId: await fetchBuildId(), at: new Date().toISOString(), status };
    const rows = Object.keys(runs).map((k) => `  ${k}: ${JSON.stringify(runs[k])}`);
    const block = `const TOOL_RUNS = {\n${rows.join(',\n')}\n};`;
    writeFileSync(STAMP_PATH, text.replace(STAMP_BLOCK, (_, a, b) => `${a}${block}\n${b}`));
  } catch (err) {
    console.warn(`Could not record the run in database/tool-runs.js: ${err.message}`);
  }
}
