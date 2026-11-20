#!/usr/bin/env node
/**
 * Offline sanity check of every Cyclopedia ability scene (database/creature-database.js, `getAbilityScene`, normal and awakened).
 * It needs no network: it loads the database with stubs, asks it for each scene and checks the shape the Cyclopedia scene engine reads:
 *
 *   ERROR  a time (`at`, `ms`, `until`, `from`, `lead`, `holdMs`) that is not a finite number (or a "land" / "hit" offset on a number)
 *   ERROR  a flight without a numeric `from` / `to` tile pair, a missile id or a start time
 *   ERROR  an effect without a sprite id / frame count, or an overlay / status icon of an unknown kind
 *   ERROR  Cyclopedia.js falls back to a missile flight time that differs from SCENE_MISSILE_MS
 *   WARN   a damage / heal number 1 to 100ms away from where a flight lands (a hand-typed time that drifted off the 225ms flight)
 *
 * Usage:
 *   node tools/check-scene-data.mjs      exit code 1 on any ERROR (warnings are information only)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = { console: { log() {}, warn() {}, error() {} } };
g.window = g; g.globalThis = g;
g.document = { createElement() { return { style: {}, appendChild() {} }; }, head: { appendChild() {} }, body: null, styleSheets: [] };
g.state = { utils: {} }; g.navigator = {}; g.setTimeout = () => 0; g.setInterval = () => 0; g.BestiaryLogger = { getLevel: () => 'silent' };
new Function('window', 'globalThis', 'document', 'state', 'navigator', 'setTimeout', 'setInterval', 'console', readFileSync(join(ROOT, 'database/creature-database.js'), 'utf8'))(g, g, g.document, g.state, g.navigator, g.setTimeout, g.setInterval, g.console);
const db = g.creatureDatabase;

const errors = [];
const warns = [];
const TIME_KEYS = ['at', 'ms', 'until', 'from', 'lead', 'holdMs'];
const OVERLAY_KINDS = new Set(['aura', 'drop', 'timed', 'fall', 'ping', 'loop', 'glow', 'circle', 'rune', 'fade', 'float', 'roar', 'say', 'bonk', 'dark', 'haze', 'chipKnife', 'trap']);
const STATUS_ICONS = new Set(['poison', 'slow', 'debuff', 'heal-reduction', 'taunt', 'buff']);
const TIME_STRING = /^(land|hit)([+-]\d+(\.\d+)?)?$/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isTile = (t) => Array.isArray(t) && t.length === 2 && t.every(isNum);
const flightMs = db.SCENE_MISSILE_MS;

if (!isNum(flightMs)) errors.push('database: SCENE_MISSILE_MS is not exported as a number');
const cyclopedia = readFileSync(join(ROOT, 'mods/Super_Mods/Cyclopedia.js'), 'utf8');
const fallback = /flight: creatureDbRef\.SCENE_MISSILE_MS \?\? (\d+)/.exec(cyclopedia);
if (!fallback) errors.push('Cyclopedia.js: CYCLOPEDIA_SCENE_TIMING.flight no longer reads creatureDbRef.SCENE_MISSILE_MS');
else if (Number(fallback[1]) !== flightMs) errors.push(`Cyclopedia.js: flight fallback ${fallback[1]} differs from SCENE_MISSILE_MS ${flightMs}`);

function checkTimes(where, obj, label) {
  for (const key of TIME_KEYS) {
    const v = obj?.[key];
    if (v === undefined || v === null) continue;
    if (key === 'at' && typeof v === 'string' && TIME_STRING.test(v)) continue;
    if (key === 'at' && Array.isArray(v) && v.every(isNum)) continue;
    if (key === 'at' && v === 'hit') continue;
    if (!isNum(v)) errors.push(`${where}: ${label} has a bad ${key} (${JSON.stringify(v)})`);
  }
}

for (let id = 1; id <= 300; id++) {
  for (const awakened of [false, true]) {
    const scene = db.getAbilityScene(id, awakened);
    if (!scene) continue;
    scene.parts.forEach((p, pi) => {
      const where = `${id} ${scene.name}${awakened ? ' (awakened)' : ''} part ${pi}`;
      (p.numbers || []).forEach((n, i) => { checkTimes(where, n, `number ${i}`); if (!n.kind) errors.push(`${where}: number ${i} has no kind`); });
      (p.effects || []).forEach((e, i) => {
        checkTimes(where, e, `effect ${i} (${e.n})`);
        if (!isNum(e.id) && !e.src && !e.sz) errors.push(`${where}: effect ${i} (${e.n}) has no sprite id`);
        if (!isNum(e.f) && !e.src && !e.sz) errors.push(`${where}: effect ${i} (${e.n}) has no frame count`);
      });
      (p.overlays || []).forEach((o, i) => {
        checkTimes(where, o, `overlay ${i}`);
        if (!OVERLAY_KINDS.has(o.kind)) errors.push(`${where}: overlay ${i} has an unknown kind (${o.kind})`);
      });
      (p.statusIcons || []).forEach((s, i) => {
        checkTimes(where, s, `status icon ${i}`);
        if (!STATUS_ICONS.has(s.icon)) errors.push(`${where}: status icon ${i} is unknown (${s.icon})`);
      });
      (p.flashes || []).forEach((f, i) => checkTimes(where, f, `flash ${i}`));
      (p.stuns || []).forEach((s, i) => checkTimes(where, s, `stun ${i}`));
      (p.bars || []).forEach((b, i) => checkTimes(where, b, `bar ${i}`));
      (p.mates || []).forEach((m, i) => {
        checkTimes(where, m, `mate ${i}`);
        if (m.dx !== undefined && !isNum(m.dx)) errors.push(`${where}: mate ${i} has a bad dx`);
        if (m.dy !== undefined && !isNum(m.dy)) errors.push(`${where}: mate ${i} has a bad dy`);
      });
      checkTimes(where, p, 'part');
      // Flights, and the hits that should land with them.
      const landings = [];
      (p.flights || []).forEach((f, i) => {
        if (!isTile(f.from) || !isTile(f.to)) errors.push(`${where}: flight ${i} needs a numeric from/to tile pair`);
        if (!f.shot || !isNum(f.shot.id)) errors.push(`${where}: flight ${i} has no missile id`);
        if (!isNum(f.at)) { errors.push(`${where}: flight ${i} has no start time`); return; }
        if (f.ms !== undefined && !isNum(f.ms)) errors.push(`${where}: flight ${i} has a bad ms`);
        if (!isNum(f.ms)) landings.push({ i, land: f.at + (isNum(f.ms) ? f.ms : flightMs), tile: JSON.stringify(f.to) });
      });
      if (p.attacker && isNum(p.attacker.at)) landings.push({ i: "attacker", land: p.attacker.at + flightMs }); // the shooter (Ti) fires one missile at `at`
      const hitTimes = (p.numbers || []).map((n) => n.at).filter(isNum); // damage / heal numbers only: effects may sit on the game's 62.5ms ticks
      for (const l of landings) {
        const near = hitTimes.filter((t) => Math.abs(t - l.land) > 0 && Math.abs(t - l.land) <= 100);
        if (near.length && !hitTimes.includes(l.land)) warns.push(`${where}: flight ${l.i} lands at ${l.land}ms, a hit is at ${near[0]}ms`);
      }
    });
  }
}

for (const w of warns) console.log(`WARN   ${w}`);
for (const e of errors) console.log(`ERROR  ${e}`);
if (errors.length) { console.log(`\n${errors.length} error(s), ${warns.length} warning(s).`); process.exit(1); }
console.log(`OK: every scene is well formed (${warns.length} warning${warns.length === 1 ? '' : 's'}).`);
