/**
 * When each tools/ drift check last ran, and against which game build.
 *
 * The block between the markers is rewritten by tools/tool-runs.mjs (recordRun) at the end of every
 * completed run of tools/check-creature-combat.mjs, check-ability-scenes.mjs, check-inventory-items.mjs,
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
  abilityScenes: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:04.748Z","status":"ok"},
  creatureCombat: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:05.207Z","status":"ok"},
  inventoryItems: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:06.583Z","status":"ok"},
  roomScripts: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:07.036Z","status":"ok"},
  databaseNames: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:05.371Z","status":"ok"},
  outfitsMounts: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:06.817Z","status":"ok"},
  fastSimulation: {"buildId":"C6U70OT_mClXC-n6LDIbI","at":"2026-11-24T20:40:05.511Z","status":"ok"}
};
// END TOOL_RUNS


if (typeof window !== 'undefined') {
  window.toolRuns = { runs: TOOL_RUNS };
}
if (typeof module !== 'undefined') {
  module.exports = { runs: TOOL_RUNS };
}
