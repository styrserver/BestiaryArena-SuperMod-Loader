#!/usr/bin/env node
/**
 * Checks that the live game still has the shapes the Board Analyzer "Fast simulation" relies on.
 *
 * Fast simulation (mods/Official_Mods/Board_Analyzer.js: getNativeCombat / createFastRunner) builds
 * the game's own World headless. It finds the game's minified modules by source shape and copies the
 * game's sandbox setup (spawn order, piece conversion, rank maths). A game update can rename an export
 * or change that setup. In the game this is caught at run time (the first run is compared with real
 * runs and falls back to real simulation); this tool catches it on the day of the update instead:
 *
 *   OK     the shape is still there
 *   DRIFT  the shape is gone or changed: review getNativeCombat() / createFastRunner(), update them,
 *          bump FAST_ENGINE_REVISION in Board_Analyzer.js, then re-run this tool
 *
 * It cannot prove results are identical (that is the in-game check against real runs), and it cannot
 * check what only exists at run time: the exact `expToCurrentLevel` module match and the player-monster
 * level conversion.
 *
 * Usage:
 *   node tools/check-fast-simulation.mjs     check; exit code 1 on any drift
 *
 * Network and parsing failures exit 2, never "OK". Chunks are read from the build manifest, so
 * lazily loaded chunks are included.
 */
import { loadChunks } from './check-creature-combat.mjs';
import { recordRun } from './tool-runs.mjs';

/** The module body (webpack `ID:function(...){...}`) that contains `index`, or null. */
function moduleAround(text, index) {
  const header = /[,{](\d+):function\(\w+(?:,\w+){0,2}\)\{/g;
  let start = null;
  let m;
  while ((m = header.exec(text)) && m.index < index) start = m;
  if (!start) return null;
  const open = start.index + start[0].length - 1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      return i >= index ? text.slice(open, i + 1) : null;
    }
  }
  return null;
}

/** Export names of a module, read from its `.d(t,{name:function(){return x},...})` header. */
function exportNames(body) {
  const header = /\.d\(\w+,\{((?:[\w$]+:function\(\)\{return [^}]*\},?)+)\}\)/.exec(body);
  return new Set(header ? [...header[1].matchAll(/([\w$]+):function\(\)\{return/g)].map((x) => x[1]) : []);
}

function buildChecks(chunks) {
  const first = (re) => {
    for (const text of chunks) {
      const m = re.exec(text);
      if (m) return { text, m };
    }
    return null;
  };
  /** Modules (body strings) whose body contains every marker and none of `without`. */
  const modules = (markers, without = []) => {
    const found = [];
    for (const text of chunks) {
      const at = text.indexOf(markers[0]);
      if (at === -1) continue;
      const body = moduleAround(text, at);
      if (body && markers.every((s) => body.includes(s)) && !without.some((s) => body.includes(s))) found.push(body);
    }
    return found;
  };
  const exportsInclude = (bodies, names) => bodies.some((body) => names.every((n) => exportNames(body).has(n)));
  const checks = [];
  const check = (name, ok, hint = '') => checks.push({ name, ok: Boolean(ok), hint });

  // World class: the module getNativeCombat() finds by source.
  const worldModules = modules(['this.serverPlay=', 'this.spawnMonster=', 'this.tickEngine=']);
  const world = worldModules[0] ?? '';
  check('World module found (serverPlay + spawnMonster + tickEngine)', worldModules.length > 0);
  check('World constructor takes { maxDurationTicks, seed, perfMode, sandbox, floor }',
    /constructor\(\{[^}]*maxDurationTicks:[^}]*seed:[^}]*perfMode:[^}]*sandbox:[^}]*floor:[^}]*\}\)/.test(world));
  check('serverPlay publishes onGameStart and loops tickEngine._advanceTick()',
    /this\.serverPlay=\(\)=>\{[^]*?onGameStart\.publish\(\)[^]*?_advanceTick\(\)/.test(world));
  check('getWinner: villains win on wipe or maxDurationTicks, nonVillains first',
    /this\.getWinner=\w+=>this\.gameEndCondition\.villains\.every\(\w+=>!\w+\.hp\.isAlive\)\?"nonVillains":this\.gameEndCondition\.nonVillains\.every\(\w+=>!\w+\.hp\.isAlive\)\|\|\w+>=this\.maxDurationTicks\?"villains":void 0/.test(world));
  check('setupGameMap sets hitboxes and runs the room script by name',
    /this\.setupGameMap=\(\w+,\w+\)=>\{[^]*?\.data\.hitboxes\.forEach[^]*?\[\w+\.name\]/.test(world));
  const spawn = /this\.spawnMonster=\w+=>\{let\{([^}]*)\}=\w+/.exec(world)?.[1] ?? '';
  check('spawnMonster reads gameId, direction, tileIndex, villain, level, genes, tier, nickname, equip, shiny, awaken',
    ['gameId', 'direction', 'tileIndex', 'villain', 'level', 'genes', 'tier', 'nickname', 'equip', 'shiny', 'awaken'].every((k) => spawn.includes(`${k}:`)));
  check('World exposes calculateExtraRankPoints and onGameEnd', /this\.calculateExtraRankPoints=\(\)=>0/.test(world) && /this\.onGameEnd=/.test(world));

  // Exports getNativeCombat() reads by name.
  check('maps module exports aD (room + floor lookup)',
    exportsInclude(modules(['floorFiles:', 'maxGameDurationTicks:']), ['aD']));
  check('rank module exports yk and tE (points and grade)',
    exportsInclude(modules(['aliveCount:', 'maxTeamSize:', '"S+"'], ['onGameEnd']), ['yk', 'tE']));
  check('tier module exports DG', exportsInclude(modules(['sacrificeCount:', 'Invalid current tier']), ['DG']));
  const rules = first(/\bFc:function\(\)\{return/);
  const rulesBody = rules ? moduleAround(rules.text, rules.m.index) : null;
  check('rules module exports Fc, B$, tt, nb and js', rulesBody !== null && ['Fc', 'B$', 'tt', 'nb', 'js'].every((n) => exportNames(rulesBody).has(n)));
  check('rules.nb still has maxByTier', rulesBody !== null && rulesBody.includes('maxByTier'));

  // The game's own sandbox setup, which createWorld()/capture() copy.
  check('sandbox world: seed from customSandboxSeed, sandbox:!0, floor',
    first(/seed:null!==\(\w+=\w+\.customSandboxSeed\)&&void 0!==\w+\?\w+:\w+\.\w+\.getSeed\(\),maxDurationTicks:[^,]+,sandbox:!0,floor:\w+\.floor/));
  check('sandbox spawn order: villains first, then tileIndex',
    first(/toSorted\(\((\w+),(\w+)\)=>\+\2\.villain-\+\1\.villain\|\|\1\.tileIndex-\2\.tileIndex\)/));
  check('every spawned piece is tagged "playerMonster"',
    first(/of \w+\)\w+\.spawnMonster\(\w+\)\.tags\.add\("playerMonster"\)/));
  check('"file" pieces: tier from DG, genes from Fc + B$*floor, awaken from floor >= tt',
    first(/"file"===\w+\.type\)return\{\.\.\.\w+,tier:\(0,\w+\.DG\)\(\{floor:\w+,level:\w+\.level\}\),genes:\w+\(\{baseGenes:\w+\.Fc,floor:\w+\}\),[^]*?awaken:\w+>=\w+\.tt\}/)
      && first(/baseGenes:\w+,floor:\w+\}=\w+,\w+=\w+\.B\$\*\w+;return\{hp:\w+\.hp\+\w+,ap:\w+\.ap\+\w+,ad:\w+\.ad\+\w+,armor:\w+\.armor\+\w+,magicResist:\w+\.magicResist\+\w+\}/));
  check('"custom" pieces keep their fields and only rewrite equip',
    first(/"custom"===\w+\.type\)return\{\.\.\.\w+,equip:\w+\.equip\?\{\.\.\.\w+\.equip,id:/));
  check('player pieces: gameId, genes, level, tier, shiny, direction "south", awaken from js(tier)',
    first(/gameId:\w+\.gameId,tileIndex:\w+\.tileIndex,villain:\w+\.villain,genes:\w+\.genes,level:\w+\.level,tier:\w+\.tier,shiny:\w+\.shiny,direction:"south"[^]*?awaken:\(0,\w+\.js\)\(\w+\.tier\)/));

  // Rank maths the game applies at the end of a battle.
  check('rank: survivors are non-villain, alive and tagged "playerMonster"',
    first(/!\w+\.villany\.wasSpawnVillain&&\w+\.hp\.isAlive&&\w+\.tags\.has\("playerMonster"\)/));
  check('rank: 0 on a villain win, else yk(...) + calculateExtraRankPoints(), grade F on a loss',
    first(/"villains"===\w+,\w+=\w+\?0:\(0,\w+\.yk\)\(\{aliveCount:[^]*?\}\)\+\w+\.calculateExtraRankPoints\(\),\w+=\w+\?"F":\(0,\w+\.tE\)\(\{rank:\w+,maxTeamSize:\w+\}\)/));
  check('rank points formula: 2*maxTeamSize - (playerTeamSize - aliveCount) - playerTeamSize',
    first(/let\{maxTeamSize:\w+,playerTeamSize:\w+,aliveCount:\w+\}=\w+,\w+=2\*\w+;return \w+-=\w+-\w+,\w+-=\w+\}/));
  return checks;
}

async function main() {
  const chunks = await loadChunks();
  const checks = buildChecks(chunks);
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'OK   ' : 'DRIFT'} ${c.name}`);
  if (failed.length) {
    await recordRun('fastSimulation', 'drift');
    console.log(`\n${failed.length} of ${checks.length} checks drifted. Review getNativeCombat() / createFastRunner() in`
      + ' mods/Official_Mods/Board_Analyzer.js against the game, update them, bump FAST_ENGINE_REVISION,'
      + ' then re-run this tool.');
    process.exitCode = 1;
    return;
  }
  console.log(`\nOK: all ${checks.length} shapes Fast simulation relies on are still in the game.`);
  await recordRun('fastSimulation', 'ok');
}

main().catch((err) => {
  console.error(`check-fast-simulation failed: ${err.message}`);
  process.exitCode = 2;
});
