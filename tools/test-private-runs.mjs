// Private runs: credits check against the world record + the player's own RunTracker runs as candidates.
// Loads the real code of Mod_Settings.js section 4.4 (up to runsSiteApplyRun) with stubbed game state.
// Run: node tools/test-private-runs.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../mods/Super_Mods/Mod_Settings.js', import.meta.url), 'utf8');
const start = src.indexOf('const RUNS_REPO_INDEX_PATH');
const end = src.indexOf('// Self-contained on purpose: the same function is applied by the mod');
assert.ok(start > 0 && end > start, 'section 4.4 markers not found');
const region = src.slice(start, end);

const ME = 'Dan';
function build({ solutions, boards, wr, own, season }) {
  const window = {
    BestiaryModAPI: { util: { fetchTrophyRoomData: async () => ({ highscores: wr }), getCurrentSeason: () => season } },
    RunTrackerAPI: { getRuns: () => own || { speedrun: [], rank: [], floor: [] } }
  };
  const globalThis_ = {
    state: {
      player: { getSnapshot: () => ({ context: { name: ME, monsters: [], equips: [] } }) },
      utils: { ROOM_NAME: { room1: 'Test Map' }, ROOMS: [], REGIONS: [] }
    }
  };
  const body = `${region}
    runsSiteLoadIndex = async () => ({ byMap: new Map([['Test Map', SOLUTIONS]]), floorSets: new Map([['Test Map', [{ from: 0, to: Infinity }]]]) });
    runsSiteFetchFile = async (path) => JSON.stringify({ config: { board: [] }, credits: BOARDS[path] });
    runsSiteRosterCovers = () => true;
    function runsSiteApplyRun() { return { ok: true, setup: [], substituted: [] }; }
    return { runsSiteSuggest, runsSiteBestFor };`;
  const factory = new Function('window', 'globalThis', 'console', 'SOLUTIONS', 'BOARDS', body);
  return factory(window, globalThis_, { log() {}, warn() {}, error() {} }, solutions, boards);
}

const sol = (path, minTicks, extra = {}) => ({ path, map: 'Test Map', region: 'R', floor: 0, runs: 100, victories: 100, minTicks, rankPoints: 0, rankCount: 0, floors: [], combos: [], ...extra });
const solutions = [sol('a.json', 50), sol('b.json', 60), sol('c.json', 70), sol('d.json', 80)];
const boards = { 'a.json': 'Alice', 'b.json': 'Bob & Dan', 'c.json': 'Dan', 'd.json': 'Daniel' };
let failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n    ', e.message); }
};

await test('beats WR + not credited -> skipped, next credited run wins', async () => {
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 100, userName: 'Zed' } } } });
  const r = await runsSiteBestFor('room1', 'ticks');
  assert.equal(r.run.path, 'b.json'); // a (Alice) skipped, b lists "Bob & Dan"
});
await test('does not beat WR -> credits ignored', async () => {
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 40 } } } });
  assert.equal((await runsSiteBestFor('room1', 'ticks')).run.path, 'a.json');
});
await test('tie with WR is not a record, no credit needed', async () => {
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 50 } } } });
  assert.equal((await runsSiteBestFor('room1', 'ticks')).run.path, 'a.json');
});
await test('"Daniel" does not match "Dan"', async () => {
  const only = [sol('d.json', 80)];
  const { runsSiteBestFor } = build({ solutions: only, boards, wr: { tick: { room1: { ticks: 100 } } } });
  assert.equal(await runsSiteBestFor('room1', 'ticks'), null);
});
await test('WR fetch fails -> fail closed', async () => {
  const api = build({ solutions, boards, wr: null });
  // wr null -> highscores {} -> no record entry -> every run counts as record-breaking
  assert.equal((await api.runsSiteBestFor('room1', 'ticks')).run.path, 'b.json');
});
await test('Highscore list: only credited record-breakers, up to 3', async () => {
  const { runsSiteSuggest } = build({ solutions, boards, wr: { tick: { room1: { ticks: 100 } } } });
  const picked = await runsSiteSuggest('room1', { ticks: 999 });
  assert.deepEqual(picked.ticks.map((r) => r.path), ['b.json', 'c.json']);
});
await test('own RunTracker run with fewer ticks beats the repository best', async () => {
  const own = { speedrun: [{ floor: 0, time: 45, setup: { pieces: [{ tile: 1, monsterName: 'Dragon', level: 50, monsterStats: { hp: 1, ad: 2, ap: 3, armor: 4, magicResist: 5 }, equipmentName: 'Sword', equipmentStat: 'ad', equipmentTier: 4 }] } }], rank: [], floor: [] };
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 100 } } }, own });
  const r = await runsSiteBestFor('room1', 'ticks');
  assert.ok(r.run.path.startsWith('own:'), r.run.path);
  assert.equal(r.run.ticks, 45);
  assert.equal(r.run.board[0].monster.name, 'dragon');
  assert.equal(r.run.credit, ME); // own runs pass the credits check even when they set a record
});
await test('own run slower than the repository best does not replace it', async () => {
  const own = { speedrun: [{ floor: 0, time: 90, setup: { pieces: [{ tile: 1, monsterName: 'Dragon', level: 50, monsterStats: { hp: 1, ad: 2, ap: 3, armor: 4, magicResist: 5 } }] } }], rank: [], floor: [] };
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 40 } } }, own });
  assert.equal((await runsSiteBestFor('room1', 'ticks')).run.path, 'a.json');
});
await test('own runs by another player or from another season are not treated as yours', async () => {
  const piece = { tile: 1, monsterName: 'Dragon', level: 50, monsterStats: { hp: 1, ad: 2, ap: 3, armor: 4, magicResist: 5 } };
  const own = { speedrun: [
    { floor: 0, time: 10, player: 'Zed', season: 2, setup: { pieces: [piece] } },
    { floor: 0, time: 11, player: ME, season: 1, setup: { pieces: [piece] } }
  ], rank: [], floor: [] };
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 100 } } }, own, season: 2 });
  assert.equal((await runsSiteBestFor('room1', 'ticks')).run.path, 'b.json');
});
await test('own run from this season by "You" counts', async () => {
  const own = { speedrun: [{ floor: 0, time: 10, player: 'You', season: 2, setup: { pieces: [{ tile: 1, monsterName: 'Dragon', level: 50, monsterStats: { hp: 1, ad: 2, ap: 3, armor: 4, magicResist: 5 } }] } }], rank: [], floor: [] };
  const { runsSiteBestFor } = build({ solutions, boards, wr: { tick: { room1: { ticks: 100 } } }, own, season: 2 });
  assert.ok((await runsSiteBestFor('room1', 'ticks')).run.path.startsWith('own:'));
});

console.log(failed ? `\n${failed} test(s) failed` : '\nAll private-runs tests passed');
process.exit(failed ? 1 : 0);
