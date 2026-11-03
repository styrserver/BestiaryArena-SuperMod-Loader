# Board Analyzer: Fast simulation

Optional mode of `mods/Official_Mods/Board_Analyzer.js` (setting `fastSimulation`, off by default,
checkbox "Fast simulation" under Analysis). The engine code is adapted from Orw's Better Board
Analyzer (https://bestiaryarena.com/profile/orw).

## What it is

The game's own `World` class (see "Combat engine rules" in `docs/game_state_api.md`) run headless. It is
not a second combat implementation: the rules, RNG (`xoroshiro128plus(seed)`) and tick loop are the
game's. Fast mode only skips what real mode needs the board for.

| | Real mode (default) | Fast mode |
|---|---|---|
| How a run is played | Sets `customSandboxSeed` and `gameStarted` on the board; the game plays it | `new World(...)`, then `tickEngine._advanceTick()` in a loop, like `serverPlay()` |
| Board | Sandbox mode, hidden, turbo, restored afterwards | Never driven |
| Speed | About 2 to 4 ms per tick at turbo | About 0.2 to 0.5 ms per tick (measured on one board: roughly 7 times faster) |

## Where it lives in `Board_Analyzer.js`

- `getNativeCombat()`: finds the game's minified modules by source shape (via `webpackChunk_N_E`) and
  returns `capture()` (live board to plain setup data), `createWorld()` and `result()` (ticks, grade,
  rank points). Uses the exports `aD` (rooms), `DG` (tiers), `yk` / `tE` (rank), and `Fc`, `B$`, `tt`,
  `nb`, `js` (rules). Those names are minified and can change in any game build.
- `createFastRunner()`: runs one seed, yielding to the page every `FAST_YIELD_BUDGET_MS`. An exception
  counts as a villain win, like `serverPlay()`.
- `prepareFastEngine()` / `finishFastEngine()`: build the engine, verify it, hand it to the run loop.

`capture()` and `createWorld()` copy the game's own sandbox setup: pieces spawn villains first then by
`tileIndex`, every piece is tagged `playerMonster`, `file` pieces get genes `Fc + B$ * floor`, and the
rank counts survivors that are not spawned villains, alive and tagged. If the game changes any of that,
fast results drift from real ones.

## How it stays correct

1. **Verification at run time (automatic).** The first fast run on a room and floor plays 3 seeds through
   the real game and through the engine and compares `ticks`, win or loss, and `rankPoints` on wins.
   Each comparison is logged (`Fast check 1/3 seed N: real ... | fast ... | match`). Any mismatch, or
   any error building the engine, shows a toast and uses real simulation.
2. **Remembered result.** A passing room/floor is kept in `localStorage`
   (`board-analyzer-fast-verified`) for 24 hours, keyed by the game's build id
   (`__NEXT_DATA__.buildId`), `FAST_ENGINE_REVISION` and the room/floor. A game update or a bumped
   revision forces a new check. Without a build id only the current session is trusted.
3. **Verified rooms leave the board alone.** When the board is in sandbox mode and the room/floor is
   verified, the analysis skips sandbox switching, turbo and the board restore. It still hides the
   board if "Hide game board during analysis" is on. If the board is not in sandbox mode, or the room
   is not verified, the normal preparation runs, the board is captured again afterwards and
   verification happens on that board.
4. **Early warning after a game update:** `node tools/check-fast-simulation.mjs` (also run by
   `tools/check-all.mjs`). It downloads the game chunks and checks that the module markers, export names
   and the sandbox/rank setup above still exist. Exit 1 means review `getNativeCombat()` and
   `createFastRunner()`, bump `FAST_ENGINE_REVISION`, and run it again. It stamps
   `database/tool-runs.js` (key `fastSimulation`) like the other checks.

The tool cannot prove results are identical. It also cannot check what only exists at run time: the
`expToCurrentLevel` module match, the `ROOMS` match for the maps module, and the player-monster level
conversion (`min(expToCurrentLevel(exp), maxByTier[tier])`). Only the run-time verification covers those.

## Logging

At the default log level only errors print. At Info or Verbose: the per-seed verification lines, `Fast
simulation verified` or `already verified`, and one line per analysis with the average world setup and
tick time (`Fast engine: N runs, world setup X ms/run, ticks Y ms/run`).

## Limits

- Experience is still an estimate (random), as in real mode.
- Piece types other than `player`, `custom` and `file` throw `unsupportedPiece` and fall back to real mode.
- Rooms changed by other mods are not covered unless the game's room lookup returns them.
- Edits made while an analysis is running (for example in Hero Editor) are not picked up: the setup is
  captured once at the start.
- The 3-seed check can pass by luck on a rare divergence. Compare victory and S+ rates between the two
  modes on a few rooms if in doubt.

## After a game update

1. `node tools/check-all.mjs`.
2. If `check-fast-simulation.mjs` reports DRIFT: compare `getNativeCombat()` / `createFastRunner()` with
   the game's chunks (the chunk-reading approach is in `.claude/CLAUDE.md`, "Debugging native-code
   crashes"), update them, bump `FAST_ENGINE_REVISION`, re-run the tool.
3. In the game, run Fast simulation once on a room. The log should show `Fast simulation verified: 3/3`.
