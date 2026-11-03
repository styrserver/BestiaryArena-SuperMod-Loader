/**
 * Live creature ability-constant access (Map Editor -> creature -> Native combat constants).
 *
 * The ability numbers (damage bases, AP ratios, durations, caps) are plain objects inside one
 * minified webpack module of the game, out of reach of any mod. This MAIN-world script runs at
 * document_start, before the game's own scripts (manifest `world: "MAIN"`), wraps the
 * `webpackChunk_N_E` push, and instruments that module's factory before webpack registers it, so
 * each constant object registers itself (`self.__baCT`) when the module first runs. The rewrite is
 * content/ba-combat-chunk.js; it changes no value, it only exposes the objects.
 *
 * `window.BestiaryCombatOverrides.applyLive(overrides)` then sets values on those objects and
 * `restoreLive()` puts every original back. Nothing is stored here: the Map Editor keeps the numbers
 * on each placed creature and applies them only while its test battle runs.
 */
(function () {
  'use strict';
  if (globalThis.BestiaryCombatOverrides) return;

  const CHUNK_GLOBAL = 'webpackChunk_N_E';
  const lib = globalThis.BestiaryCombatChunk;

  /** table id -> the game's constant object, filled when the instrumented module runs. */
  const tables = new Map();
  /** gameId -> snapshot key -> { table, rawKey, ms, isTicks } (from the instrumented module). */
  let creatures = {};
  /** `${table}:${rawKey}` -> { object, rawKey, original } for every value currently overridden. */
  const changed = new Map();
  let patchedModules = 0;

  Object.defineProperty(self, '__baCT', {
    configurable: true,
    enumerable: false,
    value: (id, object) => { tables.set(id, object); return object; }
  });

  /** Instruments `chunk[1]`'s creature module factory in place. */
  function patchChunk(chunk) {
    const modules = chunk && chunk[1];
    if (!modules || typeof modules !== 'object') return;
    Object.keys(modules).forEach((id) => {
      const factory = modules[id];
      if (typeof factory !== 'function' || factory.__baCombatPatched) return;
      let src;
      try {
        src = Function.prototype.toString.call(factory);
      } catch (_) {
        return;
      }
      if (!lib.isCreatureBundle(src)) return;
      try {
        const result = lib.instrument(src);
        const patched = (0, eval)(`(${result.src})\n//# sourceURL=${location.origin}/bestiary-mod/Combat_Constants_${id}.js`);
        patched.__baCombatPatched = true;
        modules[id] = patched;
        creatures = result.creatures;
        patchedModules += 1;
      } catch (error) {
        // Leave the original factory in place: the game runs unmodified.
        console.error('[CombatOverrides] Could not instrument creature module', id, error);
      }
    });
  }

  /**
   * Webpack's runtime replaces `chunkLoadingGlobal.push` with its own callback, which registers
   * modules before calling the old push, so patching in a plain push would be too late. Intercept
   * the assignment instead and wrap whatever push is installed so every chunk is seen first.
   */
  function installHook() {
    let array = self[CHUNK_GLOBAL];
    if (!Array.isArray(array)) array = self[CHUNK_GLOBAL] = [];
    const wrap = (push) => function (...chunks) {
      chunks.forEach(patchChunk);
      return push.apply(this, chunks);
    };
    let wrapped = wrap(array.push);
    Object.defineProperty(array, 'push', {
      configurable: true,
      enumerable: false,
      get: () => wrapped,
      set: (push) => { wrapped = wrap(push); }
    });
  }

  if (lib) {
    try {
      installHook();
    } catch (error) {
      console.error('[CombatOverrides] Could not hook the webpack chunk loader', error);
    }
  }

  /** Puts one overridden value back as a plain data property (drops the read counter). */
  function restoreSlot(entry) {
    Object.defineProperty(entry.object, entry.rawKey, {
      value: entry.original, writable: true, enumerable: true, configurable: true
    });
  }

  function restoreLive() {
    changed.forEach(restoreSlot);
    changed.clear();
  }

  globalThis.BestiaryCombatOverrides = {
    /** True once the creature module was instrumented and ran (its constant tables registered). */
    isReady() {
      return !!lib && patchedModules > 0 && tables.size > 0;
    },
    /**
     * Sets constants on the game's objects. `overrides`: { [gameId]: { SNAPSHOT_KEY: number } } in
     * snapshot units (ms for times). The result matches `overrides` exactly: values no longer listed
     * are restored, unchanged ones are left alone (so read counts survive repeated calls).
     * Creatures that share one constant object share edits: the last one wins.
     * Each overridden property counts how often the game reads it (see getReport).
     * Returns { applied: number, missed: ['gameId.KEY', ...] }.
     */
    applyLive(overrides) {
      const desired = new Map();
      const missed = [];
      Object.entries(overrides || {}).forEach(([gameId, keys]) => {
        Object.entries(keys || {}).forEach(([key, value]) => {
          const loc = creatures[gameId]?.[key];
          const object = loc && tables.get(loc.table);
          const num = Number(value);
          if (!object || value === '' || value == null || !Number.isFinite(num)) {
            missed.push(`${gameId}.${key}`);
            return;
          }
          desired.set(`${loc.table}:${loc.rawKey}`, { gameId, key, object, loc, value: lib.tableValue(loc, num) });
        });
      });
      changed.forEach((entry, slot) => {
        if (!desired.has(slot)) { restoreSlot(entry); changed.delete(slot); }
      });
      desired.forEach((want, slot) => {
        const entry = changed.get(slot);
        if (entry) {
          entry.gameId = want.gameId;
          entry.key = want.key;
          entry.current = want.value;
          return;
        }
        const created = {
          object: want.object,
          rawKey: want.loc.rawKey,
          original: want.object[want.loc.rawKey],
          gameId: want.gameId,
          key: want.key,
          current: want.value,
          reads: 0
        };
        Object.defineProperty(want.object, want.loc.rawKey, {
          configurable: true,
          enumerable: true,
          get() { created.reads += 1; return created.current; },
          set(v) { created.current = v; }
        });
        changed.set(slot, created);
      });
      return { applied: desired.size, missed };
    },
    /** Every overridden constant: { gameId, key, original, value, reads }. reads = game reads since it was set. */
    getReport() {
      return [...changed.values()].map((e) => ({
        gameId: e.gameId, key: e.key, original: e.original, value: e.current, reads: e.reads
      }));
    },
    restoreLive
  };
})();
