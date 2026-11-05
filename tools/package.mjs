#!/usr/bin/env node
/**
 * Builds the two store uploads into dist/: dist/chrome-<version>.zip and dist/firefox-<version>.zip.
 * No dependencies. Run `node tools/check-patch-notes.mjs` first (this script runs it for you).
 *
 *   - Chrome zip:  manifest.json as is.
 *   - Firefox zip: manifest_firefox.json written into the zip as manifest.json (the repo files are
 *     untouched, so sideloading keeps working).
 *
 * Only runtime files ship: see INCLUDE. Every path a manifest names (icons, popup, background,
 * content scripts, web_accessible_resources) must exist, or the build fails.
 *
 * Usage:
 *   node tools/package.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
// Runtime files only. docs/patch-notes.json is read by the popup; the rest of docs/ is not shipped.
const INCLUDE = ['assets', 'content', 'database', 'mods', 'popup', 'background.js', 'docs/patch-notes.json'];

const check = spawnSync(process.execPath, [join(ROOT, 'tools', 'check-patch-notes.mjs')], { stdio: 'inherit' });
if (check.status !== 0) {
  console.error('Refusing to package: fix the patch-notes check first.');
  process.exit(1);
}

function walk(rel, out) {
  const abs = join(ROOT, rel);
  if (statSync(abs).isDirectory()) {
    for (const name of readdirSync(abs).sort()) walk(posix.join(rel.replaceAll('\\', '/'), name), out);
  } else {
    out.push(rel.replaceAll('\\', '/'));
  }
}

const files = [];
for (const entry of INCLUDE) walk(entry, files);
const fileSet = new Set(files);

/** Every file path a manifest references (strings that look like package paths, globs skipped). */
function manifestPaths(manifest) {
  const found = new Set();
  const visit = (v) => {
    if (typeof v === 'string') {
      if (/^(?!https?:|\*)[\w./-]+\.(js|mjs|json|html|css|png|gif|svg|woff2?)$/i.test(v)) found.add(v);
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(manifest);
  return [...found];
}

// --- minimal zip writer (deflate, no zip64) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const dosTime = 0; // fixed timestamp: identical input gives identical zips
  const dosDate = (1 << 5) | 1 | ((2000 - 1980) << 9);
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

rmSync(DIST, { recursive: true, force: true }); // drop zips from older versions
mkdirSync(DIST, { recursive: true });
let failed = false;
for (const target of [
  { id: 'chrome', manifest: 'manifest.json' },
  { id: 'firefox', manifest: 'manifest_firefox.json' }
]) {
  const manifestText = readFileSync(join(ROOT, target.manifest), 'utf8');
  const manifest = JSON.parse(manifestText);
  const missing = manifestPaths(manifest).filter((p) => !fileSet.has(p) && !existsSync(join(ROOT, p)));
  const notShipped = manifestPaths(manifest).filter((p) => !fileSet.has(p) && existsSync(join(ROOT, p)));
  if (missing.length) {
    console.error(`${target.manifest}: missing files: ${missing.join(', ')}`);
    failed = true;
    continue;
  }
  if (notShipped.length) {
    console.error(`${target.manifest}: exists but is not in INCLUDE: ${notShipped.join(', ')}`);
    failed = true;
    continue;
  }
  const entries = [
    { name: 'manifest.json', data: Buffer.from(manifestText, 'utf8') },
    ...files.map((name) => ({ name, data: readFileSync(join(ROOT, name)) }))
  ];
  const out = join(DIST, `${target.id}-${manifest.version}.zip`);
  writeFileSync(out, buildZip(entries));
  console.log(`${target.id}: ${entries.length} files, ${(statSync(out).size / 1024 / 1024).toFixed(1)} MB -> ${out}`);
}
process.exitCode = failed ? 1 : 0;
