/**
 * ba-wait.js — Bestiary Arena SuperMod Loader
 *
 * `window.BAWait.gameState(callback, options)` runs `callback` once the game's state is ready. database/*.js read
 * `globalThis.state.utils.*` at load time, and on a slow or cold page load those accessors can still be undefined;
 * they build their cache from this callback (see the "Modules that read state.utils.* at load time must retry"
 * note in .claude/CLAUDE.md for what to do with the result).
 *
 *   BAWait.gameState(build, { label: 'x-database.js', ready: (state) => !!state?.utils?.getEquipment })
 *
 * Options:
 *   label        prefix of the console warnings
 *   ready        (state) => boolean; default: player, board and utils.getEquipment exist
 *   retries      fast checks, `interval` ms apart (default 20 x 250ms)
 *   slowRetries  extra checks `slowInterval` ms apart after the fast ones (default 0; 60 x 2000ms for a cold load)
 *   buildAnyway  true (default): after the last check run `callback` anyway; false: give up and leave the cache empty
 *
 * Loaded in the page (MAIN) world by injector.js right after ba-assets.js, before any database or mod runs.
 */
(function () {
  if (window.BAWait) return;

  function defaultReady(state) {
    return !!(state && state.player && state.player.getSnapshot && state.board && state.board.getSnapshot &&
      state.utils && state.utils.getEquipment);
  }

  function gameState(callback, options) {
    var o = options || {};
    var label = o.label ? '[' + o.label + '] ' : '[BAWait] ';
    var ready = o.ready || defaultReady;
    var fast = o.retries == null ? 20 : o.retries;
    var slow = o.slowRetries || 0;
    var interval = o.interval || 250;
    var slowInterval = o.slowInterval || 2000;
    var buildAnyway = o.buildAnyway !== false;
    var attempt = 0;

    function check() {
      var ok = false;
      try {
        ok = !!ready(globalThis.state || window.state);
      } catch (error) {
        console.error(label + 'Error checking game state:', error);
      }
      if (ok) { callback(); return; }
      if (attempt < fast + slow) {
        var delay = attempt < fast ? interval : slowInterval;
        attempt++;
        setTimeout(check, delay);
      } else if (buildAnyway) {
        console.warn(label + 'Game state not ready after max retries, building anyway');
        callback();
      } else {
        console.warn(label + 'Game state never became ready; left empty');
      }
    }
    check();
  }

  window.BAWait = { gameState: gameState };
})();
