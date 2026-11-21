/**
 * Helpers shared by the tools/*.mjs scripts. Not a tool itself.
 *
 * fetchText / loadChunks: every drift check downloads the same game page and chunks. Each tool is its own
 * process (check-all.mjs spawns them), so the downloads are cached on disk for CACHE_TTL_MS: one
 * `check-all` run fetches each URL once. A stale copy would hide a game update, so the TTL is short;
 * set BA_TOOLS_NO_CACHE=1 to always fetch fresh.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://bestiaryarena.com';

const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_DIR = join(tmpdir(), 'ba-tools-cache');

export async function fetchText(url) {
  const noCache = process.env.BA_TOOLS_NO_CACHE === '1';
  const file = join(CACHE_DIR, createHash('sha1').update(url).digest('hex'));
  if (!noCache) {
    try {
      if (Date.now() - statSync(file).mtimeMs < CACHE_TTL_MS) return readFileSync(file, 'utf8');
    } catch { /* not cached */ }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, text);
  } catch { /* the cache is an optimisation only */ }
  return text;
}

/**
 * Source of the game's JS chunks. By default the chunks the home page references plus the ones in the
 * build manifest (lazily loaded ones included); `{ manifest: false }` keeps only the home page's.
 */
export async function loadChunks({ manifest = true } = {}) {
  const html = await fetchText(`${ORIGIN}/`);
  const paths = new Set(html.match(/\/_next\/static\/chunks\/[^"'\\\s]+?\.js/g) || []);
  if (manifest) {
    const buildId = /\/_next\/static\/([^/"]+)\/_buildManifest\.js/.exec(html)?.[1];
    if (!buildId) throw new Error('build id not found on the home page');
    const text = await fetchText(`${ORIGIN}/_next/static/${buildId}/_buildManifest.js`);
    for (const p of text.match(/static\/chunks\/[^"'\\\s]+?\.js/g) || []) paths.add('/_next/' + p);
  }
  if (paths.size === 0) throw new Error('no chunk URLs found');
  return Promise.all([...paths].map((p) => fetchText(ORIGIN + p)));
}

/** Repo-relative paths of every .js/.mjs file under `dir` (recursive). */
export function listScripts(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) listScripts(rel, out);
    else if (/\.m?js$/.test(name)) out.push(rel);
  }
  return out;
}

/** database/maps-database.js is a browser script: give it the globals it reads and mute its logging. */
export function loadMapsDatabase() {
  globalThis.window = globalThis;
  globalThis.state = { utils: { ROOMS: [] } };
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    return createRequire(import.meta.url)(join(ROOT, 'database', 'maps-database.js'));
  } finally {
    Object.assign(console, { log, warn });
  }
}
