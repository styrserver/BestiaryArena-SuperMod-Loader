#!/usr/bin/env node
/**
 * Checks the outfit and mount tables Outfiter.js bundles as a fallback snapshot against the live game.
 *
 * Outfiter.js reads these tables from the game's own chunks at runtime (the game exposes them on no
 * global), and only falls back to the snapshot between the OUTFIT_MOUNT_DATA markers when that fails.
 * This tool downloads the same chunks, runs Outfiter.js's own parser (the OUTFIT_MOUNT_PARSER block,
 * evaluated straight from the file, nothing duplicated here) and compares:
 *
 *   NEWMOUNT      mount in the game, not in the snapshot
 *   GONEMOUNT     mount in the snapshot, not in the game
 *   MOUNT         mount whose name, rarity or rider offset changed
 *   PALETTE       the outfit colour table (used to tint the rider in the mount preview) changed
 *   NEWOUTFIT     outfit in the game, not in the snapshot
 *   GONEOUTFIT    outfit in the snapshot, not in the game
 *   MOUNTABLE     outfit whose mountable flag (or name) changed
 *
 *   HOOK          a game shape Outfiter.js hooks into moved (no snapshot to update: fix Outfiter.js):
 *                 the mount module exports (`G9` id Map, `Xc` name table), the outfit table (`rP`),
 *                 the dialog reading owned ids from `codex.outfit` / `codex.mount`, and its Mounts tab
 *
 * A parser that no longer finds the tables exits 2: that also means the in-game live load is broken
 * and Outfiter.js is running on its snapshot.
 *
 * Usage:
 *   node tools/check-outfits-mounts.mjs             exit 1 on any difference, 0 on OK
 *   node tools/check-outfits-mounts.mjs --update    rewrite the snapshot block in Outfiter.js, exit 0
 *
 * Network and parsing failures exit 2, never "OK".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChunks } from './check-creature-combat.mjs';
import { recordRun } from './tool-runs.mjs';

const OUTFITER_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'mods', 'Super_Mods', 'Outfiter.js');
const DATA_BLOCK = /(\/\/ BEGIN OUTFIT_MOUNT_DATA\r?\n)([\s\S]*?)(\/\/ END OUTFIT_MOUNT_DATA)/;
const PARSER_BLOCK = /\/\/ BEGIN OUTFIT_MOUNT_PARSER\r?\n([\s\S]*?)\/\/ END OUTFIT_MOUNT_PARSER/;

const sortedIds = (obj) => Object.keys(obj).map(Number).sort((a, b) => a - b);

/** Outfiter.js's own parseGameTables, evaluated from the file. */
function loadParser(source) {
  const m = PARSER_BLOCK.exec(source);
  if (!m) throw new Error('OUTFIT_MOUNT_PARSER block not found in Outfiter.js');
  return new Function(`${m[1]}\nreturn parseGameTables;`)();
}

/** The snapshot between the DATA markers. */
function readSnapshot(source) {
  const m = DATA_BLOCK.exec(source);
  if (!m) throw new Error('OUTFIT_MOUNT_DATA block not found in Outfiter.js');
  // OUTFIT_PALETTE may be absent from a snapshot written before it existed
  return new Function(`${m[2]}\nreturn { MOUNTS, MOUNTABLE_OUTFITS, OUTFIT_IDS, OUTFIT_PALETTE: typeof OUTFIT_PALETTE === 'undefined' ? [] : OUTFIT_PALETTE };`)();
}

/** The DATA block body for a set of live tables (same shape readSnapshot reads back). */
export function renderSnapshot({ mounts, mountable, outfitIds, palette }) {
  const mountRows = sortedIds(mounts).map((id) => `  ${id}: ${JSON.stringify(mounts[id]).replace(/,/g, ', ')},`);
  const paletteRows = (palette || []).map((rgb) => `  [${rgb.join(', ')}],`);
  const mountableRows = sortedIds(mountable).map((id) => `  ${id}: ${JSON.stringify(mountable[id])},`);
  const ids = [...new Set(outfitIds)].sort((a, b) => a - b);
  const idRows = [];
  for (let i = 0; i < ids.length; i += 14) idRows.push(`  ${ids.slice(i, i + 14).join(', ')},`);
  return [
    'const MOUNTS = { // id -> [name, rarity] or [name, rarity, riderX, riderY]',
    ...mountRows,
    '};',
    'const MOUNTABLE_OUTFITS = { // id -> name (base ids; each one\'s alt variant is mountable too)',
    ...mountableRows,
    '};',
    'const OUTFIT_IDS = [ // every outfit id in the game\'s outfit table',
    ...idRows,
    '];',
    'const OUTFIT_PALETTE = [ // colour index -> [r, g, b] (0-255), used to tint outfits',
    ...paletteRows,
    '];',
    ''
  ].join('\n');
}

/** One report line per difference between the snapshot and the live tables. */
export function diffTables(snapshot, live) {
  const lines = [];
  const snapMounts = snapshot.MOUNTS;
  for (const id of sortedIds(live.mounts)) {
    if (!(id in snapMounts)) lines.push(`NEWMOUNT   ${id} ${live.mounts[id][0]} (rarity ${live.mounts[id][1]})`);
    else if (JSON.stringify(snapMounts[id]) !== JSON.stringify(live.mounts[id])) {
      lines.push(`MOUNT      ${id} ${JSON.stringify(snapMounts[id])} -> ${JSON.stringify(live.mounts[id])} (name, rarity[, rider offset])`);
    }
  }
  for (const id of sortedIds(snapMounts)) {
    if (!(id in live.mounts)) lines.push(`GONEMOUNT  ${id} ${snapMounts[id][0]}`);
  }

  const snapIds = new Set(snapshot.OUTFIT_IDS);
  const liveIds = new Set(live.outfitIds);
  for (const id of [...liveIds].sort((a, b) => a - b)) if (!snapIds.has(id)) lines.push(`NEWOUTFIT  ${id}`);
  for (const id of [...snapIds].sort((a, b) => a - b)) if (!liveIds.has(id)) lines.push(`GONEOUTFIT ${id}`);

  const snapMountable = snapshot.MOUNTABLE_OUTFITS;
  for (const id of new Set([...sortedIds(snapMountable), ...sortedIds(live.mountable)])) {
    const was = snapMountable[id];
    const now = live.mountable[id];
    if (was === now) continue;
    lines.push(`MOUNTABLE  ${id} ${was === undefined ? 'now mountable' : now === undefined ? 'no longer mountable' : `renamed ${was} -> ${now}`}`);
  }
  if (JSON.stringify(snapshot.OUTFIT_PALETTE) !== JSON.stringify(live.palette ?? [])) {
    lines.push(`PALETTE    outfit colour table differs (snapshot ${snapshot.OUTFIT_PALETTE.length} entries, game ${live.palette?.length ?? 'not found'})`);
  }
  return lines;
}

/** Game shapes Outfiter.js writes into or reads from at runtime. One line per shape that is gone. */
export function checkHooks(chunks) {
  const src = chunks.join('\n');
  const lines = [];
  const need = (ok, what) => { if (!ok) lines.push('HOOK       ' + what); };
  need(/G9:function\(\)\{return \w+\}/.test(src) && /Xc:function\(\)\{return \w+\}/.test(src) && src.includes('"Widow Queen":{id:368'),
    'mount module no longer exports G9 (id Map) + Xc (name table) with "Widow Queen": update findNativeMountMap()');
  need(/rP:function\(\)\{return \w+\}/.test(src) && src.includes('"Golden Outfit":{id:'),
    'outfit table rP / "Golden Outfit" not found: update findNativeOutfitTable()');
  need(/=>(\w+)\((\w+)\.outfit\),\w+=\w+=>\1\(\2\.mount\)/.test(src),
    'owned outfits/mounts are no longer read from codex.outfit / codex.mount: update mergeOutfitsIntoPlayer() / mergeMountsIntoPlayer()');
  need(/value:"mounts",disabled:0===\w+\.length/.test(src),
    'Change outfit dialog has no Mounts tab shaped like before: check the mount badges (updateOutfitBadgeStyle)');
  need(/"data-mount":\w+,width:64,height:64/.test(src),
    'mount slot is no longer img[data-mount=id]: update the mount badge selector in updateOutfitBadgeStyle()');
  return lines;
}

async function main() {
  const update = process.argv.includes('--update');
  const source = readFileSync(OUTFITER_PATH, 'utf8');
  const chunks = await loadChunks();
  const live = loadParser(source)(chunks);
  const hookLines = checkHooks(chunks);
  const lines = diffTables(readSnapshot(source), live);

  if (lines.length === 0 && hookLines.length === 0) {
    await recordRun('outfitsMounts', 'ok');
    console.log(`OK: Outfiter.js snapshot matches the game (${Object.keys(live.mounts).length} mounts, ${live.outfitIds.length} outfits, ${Object.keys(live.mountable).length} mountable).`);
    return;
  }
  console.log([...lines, ...hookLines].join('\n'));
  if (hookLines.length) {
    await recordRun('outfitsMounts', 'drift');
    console.log('\n' + hookLines.length + ' HOOK line(s): the game moved something Outfiter.js depends on. No --update for these: fix Outfiter.js, then re-run.');
    process.exitCode = 1;
    return;
  }
  if (!update) {
    await recordRun('outfitsMounts', 'drift');
    console.log(`\n${lines.length} difference(s). Run: node tools/check-outfits-mounts.mjs --update`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(OUTFITER_PATH, source.replace(DATA_BLOCK, (_, begin, __, end) => `${begin}${renderSnapshot(live)}${end}`));
  await recordRun('outfitsMounts', 'ok');
  console.log(`\nUpdated the snapshot in Outfiter.js (${lines.length} difference(s)).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(String(err?.message || err)); process.exit(2); });
}
