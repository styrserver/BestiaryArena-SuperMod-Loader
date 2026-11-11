#!/usr/bin/env node
/**
 * Checks the live game's creature ability scenes against ABILITY_SCENE_DATA in
 * database/creature-database.js.
 *
 * The Cyclopedia ability icon plays a small scene (area, projectile, effect). The game exposes none of
 * it through its API: the area masks, missile names and effect names live in each creature's class in
 * the minified bundle, and the effect sprite ids in a separate effect table. This tool extracts them
 * (parser: content/ba-combat.js, `sc` field) and flags drift, like check-creature-combat.mjs:
 *
 *   NEW      creature with a scene in the game and none in the snapshot
 *   CHANGED  mask, missile or effect differs from the snapshot
 *   REMOVED  snapshot entry for a creature that no longer has a scene
 *
 * Usage:
 *   node tools/check-ability-scenes.mjs            check; exit code 1 on any difference
 *   node tools/check-ability-scenes.mjs --update   rewrite the ABILITY_SCENE_DATA block
 *
 * Creatures with no extracted scene and no hand-written entry in ABILITY_SCENE_OVERRIDES are listed as TODO
 * (information only; it does not change the exit code).
 *
 * Network and parsing failures exit 2, never "OK".
 * Snapshot row: { n: name, sc: { m: [{ a: 'target'|'self', rows, g? }], mi: [{ n, id }], fx: [{ n, id, f, b?, w? }] } }
 * where fx.id is the /assets/EFFECT/{id}.png sheet, fx.f its frame count (square frames, as wide as the sheet, stacked vertically),
 * fx.b = 1 a one-burst effect, fx.w = 'self' an effect on the caster (default: on the target / its tiles),
 * and m.g = 1 a generic one-tile mask (the class has no area mask),
 * and mi.id is the /assets/MISSILE/{id}.png sheet (96x96: eight 32px direction frames in a 3x3 layout).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { recordRun } from './tool-runs.mjs';
import { loadChunks } from './check-creature-combat.mjs';

const { isCreatureBundle, analyze } = createRequire(import.meta.url)('../content/ba-combat.js');

const ORIGIN = 'https://bestiaryarena.com';
const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'creature-database.js');
const DATA_BLOCK = /(\/\/ BEGIN ABILITY_SCENE_DATA\r?\n)[\s\S]*?(\/\/ END ABILITY_SCENE_DATA)/;


/** Effect name -> sprite id, from the game's effect table (`{bleed:1,drown:2,...}`). */
export function extractEffectIds(chunks) {
  for (const src of chunks) {
    const m = /\{bleed:1,drown:2,[^}]*\}/.exec(src);
    if (!m) continue;
    return JSON.parse(m[0].replace(/([{,])([A-Za-z_$][\w$]*):/g, '$1"$2":'));
  }
  throw new Error('effect id table ({bleed:1,drown:2,...}) not found in the downloaded chunks');
}

/** Missile name -> sprite id, from the game's missile table (`{spear:1,bolt:2,...}`; sheet /assets/MISSILE/{id}.png). */
export function extractMissileIds(chunks) {
  for (const src of chunks) {
    const m = /\{spear:1,bolt:2,[^}]*\}/.exec(src);
    if (!m) continue;
    return JSON.parse(m[0].replace(/([{,])([A-Za-z_$][\w$]*):/g, '$1"$2":'));
  }
  throw new Error('missile id table ({spear:1,bolt:2,...}) not found in the downloaded chunks');
}

/** Frame count of an effect sheet: PNG height / width (read from the IHDR chunk, no image decoder needed). */
async function fetchFrameCount(id) {
  const res = await fetch(`${ORIGIN}/assets/EFFECT/${id}.png`);
  if (res.status === 404) return null; // not every effect id is a sprite sheet (e.g. 99005)
  if (!res.ok) throw new Error(`effect sheet ${id} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Frames are squares as wide as the sheet (64px for most, 32px for some, e.g. energy), stacked vertically.
  return Math.max(1, Math.round(buf.readUInt32BE(20) / buf.readUInt32BE(16)));
}

export async function extractSceneData(chunks) {
  const bundle = chunks.find(isCreatureBundle);
  if (!bundle) throw new Error('creature bundle not found in the downloaded chunks');
  const effectIds = extractEffectIds(chunks);
  const missileIds = extractMissileIds(chunks);
  const frames = new Map();
  const out = {};
  const unknown = new Set();
  const names = {};
  const unresolvedScans = [];
  const missileSheets = new Map(); // missile id -> whether /assets/MISSILE/{id}.png exists
  for (const [id, e] of Object.entries(analyze(bundle))) {
    names[id] = e.n;
    if (!e.sc) continue;
    // The class scans an area through a mask the parser could not resolve: a generic one-tile scene would be wrong,
    // so it is left out (listed as TODO) until the parser or an override covers it.
    if (e.sc.u?.length) unresolvedScans.push(`${e.n} (${e.sc.u.join(', ')})`);
    if (e.sc.u?.length && !e.sc.m.length) continue;
    // No area mask in the class (single-target hits, buffs): a one-tile scene, around the target when the ability
    // throws a missile or plays an effect elsewhere, around the caster when every effect is on itself. g: 1 marks it.
    let masks = e.sc.m;
    if (!masks.length) {
      if (e.sc.mi.length || e.sc.fx.some((x) => x.w === 'target')) masks = [{ a: 'target', rows: ['+'], g: 1 }];
      else if (e.sc.fx.length) masks = [{ a: 'self', rows: ['+'], g: 1 }];
      else continue;
    }
    const fx = [];
    for (const { n: name, w } of e.sc.fx) {
      const sheet = effectIds[name];
      if (sheet == null) { unknown.add(name); continue; }
      if (!frames.has(sheet)) frames.set(sheet, await fetchFrameCount(sheet));
      if (frames.get(sheet) == null) { unknown.add(`${name}(${sheet})`); continue; }
      // b: 1 = one big burst on the origin tile (the game's "large*" effects); otherwise it covers every hit tile.
      fx.push({ n: name, id: sheet, f: frames.get(sheet), ...(/^large/i.test(name) ? { b: 1 } : {}), ...(w === 'self' ? { w: 'self' } : {}) });
    }
    const mi = [];
    for (const name of e.sc.mi) {
      const sheet = missileIds[name];
      if (sheet != null && !missileSheets.has(sheet)) {
        missileSheets.set(sheet, (await fetch(`${ORIGIN}/assets/MISSILE/${sheet}.png`, { method: 'HEAD' })).ok);
      }
      if (sheet == null || !missileSheets.get(sheet)) unknown.add(`missile ${name}${sheet != null ? `(${sheet})` : ''}`);
      else mi.push({ n: name, id: sheet });
    }
    out[id] = { n: e.n, sc: { m: masks, mi, fx } };
  }
  return { data: out, unknownEffects: [...unknown], names, unresolvedScans };
}

/** Creature ids with a hand-written entry in ABILITY_SCENE_OVERRIDES (never rewritten by this tool). */
function readOverrideIds(text) {
  const m = /\/\/ BEGIN ABILITY_SCENE_OVERRIDES\r?\n([\s\S]*?)\/\/ END ABILITY_SCENE_OVERRIDES/.exec(text);
  if (!m) throw new Error('ABILITY_SCENE_OVERRIDES block not found in creature-database.js');
  return new Set([...m[1].matchAll(/^\s*(\d+):/gm)].map((x) => x[1]));
}

function readSnapshot() {
  const text = readFileSync(DB_PATH, 'utf8');
  const m = DATA_BLOCK.exec(text);
  if (!m) throw new Error('ABILITY_SCENE_DATA block not found in creature-database.js');
  const body = m[0].replace(/^\/\/ BEGIN[^\n]*\n/, '').replace(/\n?\/\/ END[^\n]*$/, '');
  const json = body
    .replace(/^\s*const ABILITY_SCENE_DATA = /, '')
    .replace(/;\s*$/, '')
    .replace(/^(\s*)(\d+):/gm, '$1"$2":');
  return { text, data: JSON.parse(json) };
}

function diff(game, snap) {
  const lines = [];
  for (const id of Object.keys(game)) {
    if (!snap[id]) { lines.push(`NEW      ${id} ${game[id].n}`); continue; }
    if (JSON.stringify(game[id]) !== JSON.stringify(snap[id])) {
      const parts = ['m', 'mi', 'fx']
        .filter((k) => JSON.stringify(game[id].sc[k]) !== JSON.stringify(snap[id].sc[k]))
        .map((k) => ({ m: 'area mask', mi: 'missile', fx: 'effect' }[k]));
      lines.push(`CHANGED  ${id} ${game[id].n}: ${parts.join(', ') || 'name'}`);
    }
  }
  for (const id of Object.keys(snap)) if (!game[id]) lines.push(`REMOVED  ${id} ${snap[id].n}`);
  return lines;
}

function serialize(data) {
  const rows = Object.keys(data).map(Number).sort((a, b) => a - b)
    .map((id) => `  ${id}: ${JSON.stringify(data[id])}`);
  return `const ABILITY_SCENE_DATA = {\n${rows.join(',\n')}\n};`;
}

async function main() {
  const update = process.argv.includes('--update');
  const chunks = await loadChunks();
  const { data: game, unknownEffects, names, unresolvedScans } = await extractSceneData(chunks);
  if (unresolvedScans.length) console.log(`WARN     area scans with a mask the parser cannot resolve (area may be wrong): ${unresolvedScans.join('; ')}`);
  if (unknownEffects.length) console.log(`WARN     effects or missiles with no sprite sheet (left out): ${unknownEffects.join(', ')}`);
  const { text, data } = readSnapshot();
  const overrides = readOverrideIds(text);
  const uncovered = Object.keys(names).filter((id) => !game[id] && !overrides.has(id)).map((id) => names[id]);
  const handWritten = [...overrides].filter((id) => !game[id]).length;
  console.log(`COVERAGE ${Object.keys(game).length} extracted + ${handWritten} hand-written of ${Object.keys(names).length} creatures`);
  if (uncovered.length) console.log(`TODO     no scene and no override (add to ABILITY_SCENE_OVERRIDES): ${uncovered.join(', ')}`);
  const lines = diff(game, data);
  if (!lines.length) {
    console.log(`OK: ${Object.keys(game).length} creatures with scenes match the snapshot.`);
    await recordRun('abilityScenes', 'ok');
    return;
  }
  console.log(lines.join('\n'));
  if (!update) { await recordRun('abilityScenes', 'drift'); process.exitCode = 1; return; }
  const eol = text.includes('\r\n') ? '\r\n' : '\n'; // keep the file's own line endings
  writeFileSync(DB_PATH, text.replace(DATA_BLOCK, (_, a, b) => `${a}${serialize(game).replace(/\n/g, eol)}${eol}${b}`));
  console.log(`Updated ABILITY_SCENE_DATA (${Object.keys(game).length} creatures).`);
  await recordRun('abilityScenes', 'ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(String(err?.message || err)); process.exit(2); });
}
