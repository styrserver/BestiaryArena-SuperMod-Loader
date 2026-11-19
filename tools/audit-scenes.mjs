#!/usr/bin/env node
/**
 * Audit of the Cyclopedia ability scenes against the game's own creature classes (read-only; it never changes the database).
 *
 * For every creature it reads the class from the live game bundle and lists what the class does (effects, missiles, stuns, summons, invisibility, fleeing, taunts, shields,
 * revives, cooldown bars, awakened behaviour) and what the creature's scene (database/creature-database.js, `getAbilityScene`) draws, then reports the gaps:
 *
 *   status      "hand" a hand-written scene (ABILITY_SCENE_OVERRIDES), "data" the one extracted from the game, "none" no scene, "skip" left out on purpose (`null` override)
 *   effects     effect names in the class that the scene never plays
 *   missiles    missile names in the class that the scene never flies
 *   features    mechanics the class has and the scene has no field for (a stun with no `stuns`, a summon with no `mates`, ...)
 *
 * Usage:
 *   node tools/audit-scenes.mjs [--from 59] [--to 132] [--md docs/scene-audit.md]
 *
 * It reads code, not pixels: a wrong position, size or timing still needs a look at the scene in the Cyclopedia.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChunks } from './check-creature-combat.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const FROM = Number(arg('--from', 1));
const TO = Number(arg('--to', 999));
const MD = arg('--md', null);

// the database, loaded with stubs
const dbSource = readFileSync(join(ROOT, 'database/creature-database.js'), 'utf8');
const g = { console: { log() {}, warn() {}, error() {} } };
g.window = g; g.globalThis = g;
g.document = { createElement() { return { style: {}, appendChild() {} }; }, head: { appendChild() {} }, body: null, styleSheets: [] };
g.state = { utils: {} }; g.navigator = {}; g.setTimeout = () => 0; g.setInterval = () => 0; g.BestiaryLogger = { getLevel: () => 'silent' };
new Function('window', 'globalThis', 'document', 'state', 'navigator', 'setTimeout', 'setInterval', 'console', dbSource)(g, g, g.document, g.state, g.navigator, g.setTimeout, g.setInterval, g.console);
const db = g.creatureDatabase;
const overrideBlock = dbSource.slice(dbSource.indexOf('// BEGIN ABILITY_SCENE_OVERRIDES'), dbSource.indexOf('// END ABILITY_SCENE_OVERRIDES'));
const isNull = (id) => new RegExp(`^  ${id}: null`, 'm').test(overrideBlock); // a scene left out on purpose (a quote only, a creature that is not fought)
const isHand = (id) => new RegExp(`^  ${id}: \\{`, 'm').test(overrideBlock);

// the game's classes
const chunks = await loadChunks();
const big = chunks.find((s) => s.includes('cf={1:{constructor:'));
const start = big.indexOf('cf={1:{constructor:');
const idClass = {};
for (const m of big.slice(start, start + 12000).matchAll(/(\d+):\{constructor:([A-Za-z0-9_$]+),metadata:/g)) idClass[m[1]] = m[2];

function classBody(cls) {
  for (const s of chunks) {
    const i = s.indexOf('class ' + cls + ' extends');
    if (i < 0) continue;
    const cuts = [s.indexOf('}class ', i + 10), s.indexOf('}function', i + 10), s.indexOf('}let ', i + 10)].filter((x) => x > 0);
    return s.slice(i, Math.min(...cuts, i + 24000));
  }
  return null;
}

const FEATURES = [
  ['stun', /addNonStackingStunTicks|stun\.add\w*/, (p) => (p.stuns || []).length > 0, 'stun bar (`stuns`)'],
  ['summon', /onSummon\.publish|spawnMonster/, (p) => (p.mates || []).length > 0, 'summoned creature (`mates`)'],
  ['invisible', /setInvisible|cancelInvisibility/, (p) => !!p.transform || (p.mates || []).some((m) => m.dies), 'invisibility (`transform`)'],
  ['flee', /fleeFrom|\bD\(this,/, (p) => !!p.casterFlee, 'fleeing (`casterFlee`)'],
  ['taunt', /setTauntedBy/, (p) => (p.statusIcons || []).some((i) => i.icon === 'taunt'), 'taunt icon (`statusIcons`)'],
  ['shield', /incrementHealthPool|addFlatModifier\(-?\w+\.ARMOR|shieldCounter/, (p) => (p.bars || []).length > 0 || (p.overlays || []).length > 0, 'shield / armor (`bars`, `overlays`)'],
  ['revive', /setWasRevived|onRevive|\.revive\(/, (p) => !!p.transform || (p.mates || []).some((m) => m.dies), 'revive (`transform`, `mates.dies`)'],
  ['heal', /healHp\(/, (p) => (p.numbers || []).some((n) => n.kind === 'heal'), 'heal numbers'],
  ['poison', /poison|Poison/, (p) => (p.statusIcons || []).some((i) => i.icon === 'poison') || !!p.dummyTint, 'poison icon / tint'],
  ['knockback', /displaceTarget|push(?:ed|ing)?\b|getNextPushedPositions/, (p) => !!p.push || (p.mates || []).some((m) => m.walk), 'push / displacement'],
  ['aoe', /scanCoordinates\(/, (p) => (p.masks || []).some((m) => (m.rows || []).some((r) => r.length > 1)) || (p.flashes || []).length > 0, 'area (`masks` / `flashes`)'],
  ['awaken', /this\.awaken/, null, 'awakened variant']
];

const rows = [];
for (const [id, cls] of Object.entries(idClass)) {
  const n = Number(id);
  if (n < FROM || n > TO) continue;
  const body = classBody(cls);
  const scene = db.getAbilityScene(n, false);
  const awakened = db.getAbilityScene(n, true);
  const name = scene?.name || db.getCreatureCombatData?.(n)?.name || `#${n}`;
  if (!body) { rows.push({ id: n, name, status: scene ? (isHand(n) ? 'hand' : 'data') : isNull(n) ? 'skip' : 'none', note: 'class not found' }); continue; }
  const classFx = [...new Set([...body.matchAll(/effect:"(\w+)"/g)].map((m) => m[1]))];
  const classMissiles = [...new Set([...body.matchAll(/missile:"(\w+)"/g)].map((m) => m[1]))];
  const parts = scene?.parts || [];
  const sceneFx = new Set(parts.flatMap((p) => [...(p.effects || []), ...(p.overlays || [])].map((e) => e.n || e.kind)));
  const sceneMissiles = new Set(parts.flatMap((p) => [...(p.missiles || []), ...(p.flights || []).map((f) => f.shot)].map((m) => m?.n)));
  const missingFx = classFx.filter((e) => !sceneFx.has(e));
  const missingMissiles = classMissiles.filter((m) => !sceneMissiles.has(m));
  const gaps = [];
  for (const [key, re, drawn, label] of FEATURES) {
    if (!re.test(body)) continue;
    if (key === 'awaken') {
      if (!awakened || JSON.stringify(awakened) === JSON.stringify(scene)) gaps.push('awakened differs in the class, the scene is the same');
      continue;
    }
    if (!parts.length || !parts.some(drawn)) gaps.push(label);
  }
  if (/renderCooldownBars\.add/.test(body) && parts.length && !parts.some((p) => p.cooldownBar || (p.bars || []).length)) gaps.push('cooldown bar (none drawn: no cooldown length known)');
  const status = scene ? (isHand(n) ? 'hand' : 'data') : isNull(n) ? 'skip' : 'none';
  const score = (status === 'skip' ? -99 : status === 'none' ? 6 : status === 'data' ? 2 : 0) + missingFx.length + missingMissiles.length + gaps.length * 2;
  rows.push({ id: n, name, status, missingFx, missingMissiles, gaps, score });
}
rows.sort((a, b) => a.id - b.id);

const line = (r) => `${String(r.id).padStart(3)} ${r.name.padEnd(26)} ${r.status.padEnd(5)} score ${String(r.score ?? '?').padStart(2)}`
  + `${r.missingFx?.length ? `  fx: ${r.missingFx.join(', ')}` : ''}${r.missingMissiles?.length ? `  missiles: ${r.missingMissiles.join(', ')}` : ''}${r.gaps?.length ? `  features: ${r.gaps.join('; ')}` : ''}${r.note ? `  ${r.note}` : ''}`;
console.log(rows.map(line).join('\n'));
console.log(`\n${rows.length} creatures, ${rows.filter((r) => r.status === 'hand').length} hand-written, ${rows.filter((r) => r.status === 'data').length} from the game's data, ${rows.filter((r) => r.status === 'none').length} without a scene, ${rows.filter((r) => r.status === 'skip').length} left out on purpose.`);
if (MD) {
  const md = ['# Ability scene audit', '', `Creatures ${FROM} to ${TO}. Generated by \`node tools/audit-scenes.mjs\`; it reads the game's classes, not pixels.`, '',
    '| id | creature | scene | score | effects missing | missiles missing | features missing |', '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.name} | ${r.status} | ${r.score ?? ''} | ${(r.missingFx || []).join(', ')} | ${(r.missingMissiles || []).join(', ')} | ${(r.gaps || []).join('; ')}${r.note || ''} |`)];
  writeFileSync(join(ROOT, MD), md.join('\n') + '\n');
  console.log(`written ${MD}`);
}
