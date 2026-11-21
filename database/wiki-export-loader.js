// Wiki export helpers on demand.
//
// creature-lua-export.js, equipment-lua-export.js, maps-lua-export.js and regions-lua-export.js (~100 KB)
// only define DevTools helpers for wiki editors (dumpCreatureWikiLua(), dumpMapsWikiLua(), ...). No mod
// uses them, so they are not loaded at startup. This small file defines the same global names as stubs;
// the first call loads the real file through the mod loader, which replaces the stubs, then runs the call.
//
// The helpers now return a Promise (the first call has to load a file). They still download or copy as
// before once the file is loaded.
(function () {
  const HELPERS = {
    'database/creature-lua-export.js': [
      'dumpCreatureLuaTable', 'dumpCreatureWikiLua', 'getCreatureExportSections'
    ],
    'database/equipment-lua-export.js': [
      'dumpEquipmentLuaTable', 'dumpEquipmentWikiLua', 'buildEquipmentRoomPresenceForConsole', 'diffEquipmentLuaExclusionSets'
    ],
    'database/maps-lua-export.js': [
      'dumpMapsLuaTable', 'dumpMapsWikiLua', 'buildMapsExportData', 'dumpMapPageBody', 'dumpAllMapPageBodies', 'buildMapPageBody'
    ],
    'database/regions-lua-export.js': [
      'dumpRegionsLuaTable', 'dumpRegionsWikiLua', 'buildRegionsExportData', 'dumpRegionPageBody', 'dumpAllRegionPageBodies', 'buildRegionPageBody'
    ]
  };

  const loads = new Map();
  const stubs = new Map();

  function loadHelperFile(file) {
    if (!loads.has(file)) {
      const run = window.executeLocalMod;
      if (typeof run !== 'function') {
        return Promise.reject(new Error('The mod loader is not ready yet'));
      }
      loads.set(file, Promise.resolve(run(file, true)).then((result) => {
        if (!result) throw new Error('Could not load ' + file);
      }).catch((error) => {
        loads.delete(file);
        throw error;
      }));
    }
    return loads.get(file);
  }

  Object.entries(HELPERS).forEach(([file, names]) => {
    names.forEach((name) => {
      if (typeof window[name] === 'function') return;
      const stub = async function (...args) {
        await loadHelperFile(file);
        const real = window[name];
        if (typeof real !== 'function' || real === stub) {
          throw new Error(file + ' did not define ' + name);
        }
        return real.apply(this, args);
      };
      stubs.set(name, stub);
      window[name] = stub;
    });
  });

  exports = {
    cleanup() {
      // Remove stubs that were never replaced by the real helpers
      stubs.forEach((stub, name) => {
        if (window[name] === stub) delete window[name];
      });
      stubs.clear();
      loads.clear();
    }
  };
})();
