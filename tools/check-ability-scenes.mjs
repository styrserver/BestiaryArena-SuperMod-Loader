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
 *   node tools/check-ability-scenes.mjs --assets   also list the real game assets (effects, item sprites) each creature
 *                                                  refers to that its scene does not draw (information only)
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
import { EFFECT_SHEET_BLOCK, fetchGameCss, fetchEffectSheets, serializeEffectSheets, readEffectSheetSnapshot } from './effect-sheets.mjs';
import { loadChunks } from './check-creature-combat.mjs';

const { isCreatureBundle, analyze, sceneRowFrom } =createRequire(import.meta.url)('../content/ba-combat.js');

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

/** Every effect sheet id the scenes can draw: the snapshot's, plus the hand-written overrides and templates in creature-database.js. */
function usedEffectIds(snapshotScenes, dbText) {
  const used = new Set();
  Object.values(snapshotScenes).forEach((r) => (r.sc.fx || []).forEach((x) => used.add(x.id)));
  for (const m of dbText.matchAll(/id:\s*(\d+),\s*f:\s*\d+/g)) used.add(Number(m[1]));
  for (const m of dbText.matchAll(/"id":(\d+),"f":\d+/g)) used.add(Number(m[1]));
  return used;
}

/**
 * Real game assets each creature refers to by name (`entry.refs`, see content/ba-combat.js) that its scene does not
 * already draw: effect sheets from the effect table, item sprites from the sprite enum. Information for building or
 * reviewing templates, e.g. Behemoth: effect floorSpike(294), item spikesA(388).
 */
export function findCreatureAssets(chunks, scenes) {
  const effects = extractEffectIds(chunks);
  const itemIds = new Map();
  const itemId = (name) => {
    if (itemIds.has(name)) return itemIds.get(name);
    const re = new RegExp(`[,{]${name}:(\\d+)[,}]`);
    let id = null;
    for (const src of chunks) { const m = re.exec(src); if (m) { id = Number(m[1]); break; } }
    itemIds.set(name, id);
    return id;
  };
  const out = {};
  for (const [id, e] of Object.entries(analyze(chunks.find(isCreatureBundle)))) {
    const used = new Set([...(scenes[id]?.sc.fx || []).map((x) => x.n), ...(scenes[id]?.sc.mi || []).map((x) => x.n)]);
    const found = [];
    for (const name of e.refs || []) {
      if (used.has(name) || /^[A-Z]/.test(name) || name.length < 4) continue; // capitalised names are creature sprites, short ones are not assets
      if (effects[name] != null) found.push(`effect ${name}(${effects[name]})`);
      else if (itemId(name) != null) found.push(`item ${name}(${itemId(name)})`);
    }
    if (found.length) out[id] = { n: e.n, assets: found };
  }
  return out;
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
    // Same row the live Cyclopedia builds (content/ba-combat.js sceneRowFrom); here the sheets are also checked.
    const row = sceneRowFrom(e, effectIds, missileIds);
    if (!row) continue;
    row.unknown.forEach((u) => unknown.add(u));
    const fx = [];
    for (const { n: name, id: sheet, ...rest } of row.fx) {
      if (!frames.has(sheet)) frames.set(sheet, await fetchFrameCount(sheet));
      if (frames.get(sheet) == null) { unknown.add(`${name}(${sheet})`); continue; }
      fx.push({ n: name, id: sheet, f: frames.get(sheet), ...rest });
    }
    const mi = [];
    for (const { n: name, id: sheet } of row.mi) {
      if (!missileSheets.has(sheet)) {
        missileSheets.set(sheet, (await fetch(`${ORIGIN}/assets/MISSILE/${sheet}.png`, { method: 'HEAD' })).ok);
      }
      if (!missileSheets.get(sheet)) unknown.add(`missile ${name}(${sheet})`);
      else mi.push({ n: name, id: sheet });
    }
    out[id] = { n: e.n, sc: { m: row.m, mi, fx, ...(row.t ? { t: row.t } : {}) } };
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
  if (process.argv.includes('--assets')) {
    const assets = findCreatureAssets(chunks, game);
    Object.values(assets).forEach((a) => console.log(`ASSETS   ${a.n}: ${a.assets.join(', ')}`));
    console.log(`ASSETS   ${Object.keys(assets).length} creatures refer to game assets their scene does not draw`);
  }
  const { text, data } = readSnapshot();
  // Frame size and playback of every effect the scenes draw, from the game's stylesheet (see tools/effect-sheets.mjs).
  const css = await fetchGameCss(ORIGIN);
  const { data: sheets, unreadable } = await fetchEffectSheets(ORIGIN, usedEffectIds(game, text), css);
  if (unreadable.length) console.log(`WARN     effect sheets with no readable rule in the game stylesheet (drawn as square frames): ${unreadable.join(', ')}`);
  const oldSheets = readEffectSheetSnapshot(text) || {};
  const sheetDrift = [];
  for (const id of Object.keys(sheets)) {
    if (!oldSheets[id]) sheetDrift.push(`NEW      effect sheet ${id}`);
    else if (JSON.stringify(sheets[id]) !== JSON.stringify(oldSheets[id])) sheetDrift.push(`CHANGED  effect sheet ${id}`);
  }
  for (const id of Object.keys(oldSheets)) if (!sheets[id]) sheetDrift.push(`REMOVED  effect sheet ${id}`);
  sheetDrift.forEach((l) => console.log(l));
  if (sheetDrift.length && process.argv.includes('--update')) {
    const eol0 = text.includes('\r\n') ? '\r\n' : '\n';
    writeFileSync(DB_PATH, readFileSync(DB_PATH, 'utf8').replace(EFFECT_SHEET_BLOCK, (_, x, y) => `${x}${serializeEffectSheets(sheets).replace(/\n/g, eol0)}${eol0}${y}`));
    console.log(`Updated EFFECT_SHEET_DATA (${Object.keys(sheets).length} effects).`);
  } else if (sheetDrift.length) process.exitCode = 1;
  const overrides = readOverrideIds(text);
  const uncovered = Object.keys(names).filter((id) => !game[id] && !overrides.has(id)).map((id) => names[id]);
  const handWritten = [...overrides].filter((id) => !game[id]).length;
  console.log(`COVERAGE ${Object.keys(game).length} extracted + ${handWritten} hand-written of ${Object.keys(names).length} creatures`);
  if (uncovered.length) console.log(`TODO     no scene and no override (add to ABILITY_SCENE_OVERRIDES): ${uncovered.join(', ')}`);
  const lines = diff(game, data);
  if (!lines.length) {
    console.log(`OK: ${Object.keys(game).length} creatures with scenes match the snapshot.`);
    await recordRun('abilityScenes', sheetDrift.length && !process.argv.includes('--update') ? 'drift' : 'ok');
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
