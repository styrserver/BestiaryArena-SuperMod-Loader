/**
 * When each tools/ drift check last ran, and against which game build.
 *
 * The block between the markers is rewritten by tools/tool-runs.mjs (recordRun) at the end of every
 * completed run of tools/check-creature-combat.mjs, check-inventory-items.mjs,
 * check-room-scripts.mjs, check-database-names.mjs and check-outfits-mounts.mjs. Never edit it by hand.
 *
 *   buildId  Next.js build id of the game when the tool ran (changes on every deploy)
 *   at       ISO time of the run
 *   status   'ok' (nothing to do) or 'drift' (the tool reported differences)
 *
 * Mod_Settings.js compares these with the live game's build id and reminds Firebase admins to re-run
 * the tools when the game has been redeployed since.
 */
// BEGIN TOOL_RUNS
const TOOL_RUNS = {
  creatureCombat: {"buildId":"gxMbrIpi9uHTuJKWB80ae","at":"2026-11-01T08:20:12.460Z","status":"ok"},
  inventoryItems: {"buildId":"gxMbrIpi9uHTuJKWB80ae","at":"2026-11-01T08:20:13.878Z","status":"ok"},
  roomScripts: {"buildId":"gxMbrIpi9uHTuJKWB80ae","at":"2026-11-01T08:20:14.700Z","status":"ok"},
  databaseNames: {"buildId":"gxMbrIpi9uHTuJKWB80ae","at":"2026-11-01T08:40:20.053Z","status":"ok"},
  outfitsMounts: {"buildId":"gxMbrIpi9uHTuJKWB80ae","at":"2026-11-01T15:41:16.947Z","status":"ok"}
};
// END TOOL_RUNS


if (typeof window !== 'undefined') {
  window.toolRuns = { runs: TOOL_RUNS };
}
if (typeof module !== 'undefined') {
  module.exports = { runs: TOOL_RUNS };
}
