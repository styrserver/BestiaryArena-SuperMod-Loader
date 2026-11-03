/**
 * When each tools/ drift check last ran, and against which game build.
 *
 * The block between the markers is rewritten by tools/tool-runs.mjs (recordRun) at the end of every
 * completed run of tools/check-creature-combat.mjs, check-inventory-items.mjs,
 * check-room-scripts.mjs, check-database-names.mjs, check-outfits-mounts.mjs and check-fast-simulation.mjs.
 * Never edit it by hand.
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
  creatureCombat: {"buildId":"G63aArHsrfaeZKknNhxai","at":"2026-11-03T10:37:55.561Z","status":"ok"},
  inventoryItems: {"buildId":"G63aArHsrfaeZKknNhxai","at":"2026-11-03T10:37:58.262Z","status":"ok"},
  roomScripts: {"buildId":"G63aArHsrfaeZKknNhxai","at":"2026-11-03T10:37:59.588Z","status":"ok"},
  databaseNames: {"buildId":"G63aArHsrfaeZKknNhxai","at":"2026-11-03T10:37:56.232Z","status":"ok"},
  outfitsMounts: {"buildId":"G63aArHsrfaeZKknNhxai","at":"2026-11-03T10:37:58.906Z","status":"ok"},
  fastSimulation: {"buildId":"G63aArHsrfaeZKknNhxai","at":"2026-11-03T10:37:56.729Z","status":"ok"}
};
// END TOOL_RUNS


if (typeof window !== 'undefined') {
  window.toolRuns = { runs: TOOL_RUNS };
}
if (typeof module !== 'undefined') {
  module.exports = { runs: TOOL_RUNS };
}
