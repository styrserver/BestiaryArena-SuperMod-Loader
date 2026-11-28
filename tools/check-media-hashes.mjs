#!/usr/bin/env node
/**
 * Read-only drift check of the game's hashed media images (`/_next/static/media/<name>.<hash>.png`: frames,
 * backgrounds, scrollbar handles). The hash changes when the game rebuilds an image, and a hardcoded URL then
 * 404s without any error. Reads every media url from the live game's stylesheets and reports:
 *
 *   FALLBACK  a content/ba-shared.js FALLBACK entry whose hash is not the game's (or whose image is gone)
 *   HARDCODED a shipped script that pastes a media url instead of window.BAAssets.url('<name>')
 *   MISSING   a BAAssets.url('<name>') call whose name is not in the FALLBACK table
 *
 * Usage:
 *   node tools/check-media-hashes.mjs
 *
 * Exit code: 0 OK, 1 FALLBACK / HARDCODED / MISSING, 2 network or parse failure. Fix: update FALLBACK in content/ba-shared.js
 * and replace each HARDCODED url with window.BAAssets.url('<name>').
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORIGIN, ROOT, fetchText, listScripts } from './lib.mjs';

const MEDIA = /\/_next\/static\/media\/([a-z0-9-]+)\.([0-9a-f]{8})\.(png|webp)/g;

try {
  const html = await fetchText(`${ORIGIN}/`);
  const sheets = [...new Set([...html.matchAll(/\/_next\/static\/css\/[a-z0-9]+\.css/g)].map((m) => m[0]))];
  if (!sheets.length) throw new Error('no stylesheet found on the home page');

  const live = new Map(); // name -> `<name>.<hash>.<ext>`
  for (const sheet of sheets) {
    const css = await fetchText(`${ORIGIN}${sheet}`);
    for (const m of css.matchAll(MEDIA)) live.set(m[1], m[0].slice('/_next/static/media/'.length));
  }
  if (live.size < 20) throw new Error(`only ${live.size} media images found in the game stylesheets`);

  const problems = [];

  const assets = readFileSync(join(ROOT, 'content/ba-shared.js'), 'utf8');
  const block = /var FALLBACK = \{([\s\S]*?)\};/.exec(assets)?.[1];
  if (!block) throw new Error('FALLBACK table not found in content/ba-shared.js');
  const fallback = new Set();
  for (const m of block.matchAll(/'([a-z0-9-]+)':\s*'([^']+)'/g)) {
    const [, name, file] = m;
    fallback.add(name);
    if (!live.has(name)) problems.push(`FALLBACK  ${name}: the game no longer has this image`);
    else if (live.get(name) !== file) problems.push(`FALLBACK  ${name}: ${file} -> ${live.get(name)}`);
  }

  for (const f of ['content', 'database', 'mods'].flatMap((d) => listScripts(d))) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(MEDIA)) {
      const file = m[0].slice('/_next/static/media/'.length);
      problems.push(`HARDCODED ${f}: ${file} -> window.BAAssets.url('${m[1]}')${live.get(m[1]) === file ? '' : ' (and the hash is stale)'}`);
    }
    for (const m of src.matchAll(/BAAssets\??\.(?:url|css)\('([a-z0-9-]+)'\)/g)) {
      if (!fallback.has(m[1])) problems.push(`MISSING   ${f}: '${m[1]}' is not in FALLBACK of content/ba-shared.js`);
      else if (!live.has(m[1])) problems.push(`MISSING   ${f}: '${m[1]}' is no longer in the game`);
    }
  }

  if (problems.length) {
    console.log([...new Set(problems)].join('\n'));
    console.log(`DRIFT: ${new Set(problems).size} media url(s) differ from the game (${live.size} images live).`);
    process.exit(1);
  }
  console.log(`OK: ba-shared.js fallbacks match the game and no script hardcodes a media url (${live.size} images live).`);
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exit(2);
}
