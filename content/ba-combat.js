/**
 * Reads and rewrites the ability-constant objects inside the game's minified creature bundle.
 *
 * Every creature's ability numbers live in plain objects like `sV={STONE_TOSS_MS:1e3,BASE_HEAL:15,...}`
 * in one webpack module, read at runtime as `sV.BASE_HEAL`. This file finds those objects, ties them
 * to creature ids, and can instrument the module source so each object registers itself when the
 * module runs (`sV=self.__baCT(1234,{...})`), letting a page script change a value live.
 *
 * Two parts in one file:
 *   1. Parser (`BestiaryCombatChunk`): pure string work, no DOM or game access. Browser:
 *      `globalThis.BestiaryCombatChunk`; Node: `require` (tools/check-creature-combat.mjs uses it for
 *      the drift check + CREATURE_COMBAT_DATA snapshot).
 *   2. Live overrides (`BestiaryCombatOverrides`), below: the page (MAIN world) side. It does nothing
 *      under Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BestiaryCombatChunk = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MS_PER_TICK = 62.5;

  /** Whether `src` is the module holding the creature metadata and the name -> id table. */
  function isCreatureBundle(src) {
    return src.includes('queryTags:') && src.includes('Rat:1,Minotaur:2');
  }

  /** Splits the `{...}` literal opening at `open` on top-level commas -> [{start, end}] (absolute offsets). */
  function splitTopLevel(src, open, limit = 4000) {
    let depth = 0;
    let partStart = open + 1;
    const parts = [];
    for (let i = open; i < src.length && i - open < limit; i++) {
      const c = src[i];
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') {
        depth--;
        if (depth === 0) { parts.push({ start: partStart, end: i }); return parts; }
      } else if (c === ',' && depth === 1) { parts.push({ start: partStart, end: i }); partStart = i + 1; }
    }
    return null;
  }

  /** Every `var={UPPER_KEY:...}` constant object: minified var -> [{ at, open, close, obj: key -> {raw, start, end} }]. */
  function indexConstantObjects(src) {
    const byVar = new Map();
    const re = /(?:^|[,;{ ])([A-Za-z_$][\w$]{0,5})=\{(?=[A-Z][A-Z0-9_]+:)/g;
    let m;
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1;
      const parts = splitTopLevel(src, open);
      if (!parts) continue;
      const obj = {};
      let ok = true;
      for (const p of parts) {
        const text = src.slice(p.start, p.end);
        const km = /^([A-Z][A-Z0-9_]+):/.exec(text);
        if (!km) { ok = false; break; }
        obj[km[1]] = { raw: text.slice(km[0].length), start: p.start + km[0].length, end: p.end };
      }
      if (!ok || !Object.keys(obj).length) continue;
      if (!byVar.has(m[1])) byVar.set(m[1], []);
      byVar.get(m[1]).push({ at: m.index, open, close: parts[parts.length - 1].end, obj });
    }
    return byVar;
  }

  /** Returns { v, ms } (ms: already milliseconds, i.e. wrapped in the game's ms->ticks `HX()`). */
  function scalar(raw) {
    const v = String(raw).trim();
    const ms = /^\(0,[A-Za-z_$][\w$]*\.HX\)\(([\d.e+-]+)\)$/.exec(v);
    if (ms) return { v: Number(ms[1]), ms: true };
    if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(v)) return { v: Number(v), ms: false };
    return undefined; // nested objects, fractions, references: not shown
  }

  /** Index just past the `}` that closes the object literal opening at `start` (capped at 20000 chars). */
  function objectEnd(src, start) {
    let depth = 0;
    const limit = Math.min(src.length, start + 20000);
    for (let i = start; i < limit; i++) {
      const c = src[i];
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    return limit;
  }

  function parseNameToId(src) {
    const anchor = src.indexOf('Rat:1,Minotaur:2,"Minotaur Mage":3');
    if (anchor < 0) throw new Error('creature name -> id table not found');
    const open = src.lastIndexOf('{', anchor);
    const close = src.indexOf('}', anchor);
    const json = src.slice(open, close + 1).replace(/([{,])([A-Za-z_$][\w$]*):/g, '$1"$2":');
    return JSON.parse(json);
  }

  /**
   * Every creature's combat numbers from the creature module source:
   *   { [gameId]: { n: name, ad: attack delay ms | null, c: { SNAPSHOT_KEY: number },
   *                 loc: { SNAPSHOT_KEY: { table, rawKey, ms, isTicks } } } }
   * `c` is the shape stored in CREATURE_COMBAT_DATA; `loc` says which constant object (`table`: the
   * source offset of its `{`) and key hold the value, and how the game wrote it (see tableValue).
   */
  function analyze(src) {
    return analyzeFull(src).entries;
  }

  function analyzeFull(src) {
    const nameToId = parseNameToId(src);
    const objects = indexConstantObjects(src);
    const metas = [...src.matchAll(/name:"([^"]+)",roles:\[[^\]]*\],queryTags:/g)];
    if (metas.length < 100) throw new Error(`only ${metas.length} creature entries found`);

    /** Constants and attack delay read from the metadata text starting at `from`. */
    const readEntry = (from, to) => {
      const seg = src.slice(from, Math.min(to, from + 14000));
      const constants = {};
      const loc = {};
      for (const r of seg.matchAll(/\b([A-Za-z_$][\w$]{0,5})\.([A-Z][A-Z0-9_]{2,})\b/g)) {
        const defs = objects.get(r[1]);
        if (!defs) continue;
        let def = null;
        for (const d of defs) if (d.at <= from + 14000) def = d; // nearest preceding
        const field = def && r[2] in def.obj ? def.obj[r[2]] : undefined;
        const val = field ? scalar(field.raw) : undefined;
        if (!val) continue;
        // *_TICKS constants are stored in milliseconds under a *_MS name, so the panel has one unit.
        // A raw tick count is converted; an HX() value is already milliseconds.
        const isTicks = r[2].endsWith('_TICKS');
        const msName = r[2].replace(/_TICKS$/, '_MS');
        const name = isTicks && !(msName in def.obj) ? msName : r[2];
        constants[name] = isTicks && !val.ms ? val.v * MS_PER_TICK : val.v;
        loc[name] = { table: def.open, rawKey: r[2], ms: val.ms, isTicks };
      }
      const delay = /attackDelayTicks:(?:\(0,[\w$]+\.HX\)\(([\d.e+-]+)\)|(\d+))/.exec(seg);
      return {
        ad: delay ? (delay[1] ? Number(delay[1]) : Number(delay[2]) * MS_PER_TICK) : null,
        c: constants,
        loc
      };
    };

    const out = {};
    const byVar = new Map(); // minified variable of a metadata object -> its entry
    metas.forEach((m, k) => {
      const end = k + 1 < metas.length ? metas[k + 1].index : src.length;
      const entry = { n: m[1], ...readEntry(m.index, end) };
      const owner = /(?:^|[,;{ ])([A-Za-z_$][\w$]*)=\{$/.exec(src.slice(Math.max(0, m.index - 24), m.index));
      if (owner) byVar.set(owner[1], entry);
      const id = nameToId[m[1]];
      if (id && !out[id]) out[id] = entry; // summons have no id; later duplicates are variants
    });

    // Two metadata objects can share a name (the "Old Minotaur Archer" boss reuses "Minotaur Archer"
    // with other numbers), so the first one is not always the playable creature. The registry
    // `34:{constructor:rH,metadata:rX}` says which one the game actually builds for each id.
    for (const reg of src.matchAll(/[,{ ](\d+):\{constructor:[\w$]+,metadata:([\w$]+)\}/g)) {
      const entry = byVar.get(reg[2]);
      if (entry && nameToId[entry.n] === Number(reg[1])) out[reg[1]] = entry;
    }

    // Event variants are written as `X={...Base,queryTags:[...],skill:{...}}` (Clot = Slime, Reindeer =
    // Deer B, ...): they inherit Base's numbers and override whatever their own tooltip reads. The
    // variant's id comes from its own `name:"..."`, else from the first creature name its tooltip prints.
    const spreads = [...src.matchAll(/(?:^|[,;{ ])([A-Za-z_$][\w$]*)=\{\.\.\.([A-Za-z_$][\w$]*),queryTags:/g)];
    for (const sp of spreads) {
      const base = byVar.get(sp[2]);
      if (!base) continue;
      const objStart = src.indexOf('{', sp.index);
      const from = sp.index + sp[0].length - 'queryTags:'.length;
      const objEnd = objectEnd(src, objStart); // the variant's own object, not the code after it
      const head = src.slice(from, objEnd);
      const ownName = /^[^]{0,400}?\bname:"([^"]+)"/.exec(head)?.[1]
        ?? /className:"text-monster",children:"([^"]+?)(?:'s)?"/.exec(head)?.[1]; // "Gummy Raider's"
      const id = nameToId[ownName];
      if (!id || out[id]) continue;
      const own = readEntry(from, objEnd);
      out[id] = { n: ownName, ad: own.ad ?? base.ad, c: { ...base.c, ...own.c }, loc: { ...base.loc, ...own.loc } };
    }
    return { entries: out, objects };
  }

  /**
   * The number the game's constant object holds for a snapshot-unit value (ms for times): `HX(ms)`
   * literals hold ticks, raw `*_TICKS` literals hold ticks, everything else holds the number itself.
   */
  function tableValue(loc, value) {
    if (loc.ms) return Math.round(0.016 * value);
    if (loc.isTicks) return value / MS_PER_TICK;
    return value;
  }

  /**
   * Wraps every creature constant object so it registers itself when the module runs:
   * `sV={...}` becomes `sV=self.__baCT(<table id>,{...})` (same object, same identity).
   * Returns { src, creatures: { [gameId]: { SNAPSHOT_KEY: { table, rawKey, ms, isTicks } } } }.
   */
  function instrument(src) {
    const { entries, objects } = analyzeFull(src);
    const creatures = {};
    const tables = new Set();
    Object.entries(entries).forEach(([id, entry]) => {
      creatures[id] = entry.loc;
      Object.values(entry.loc).forEach((loc) => tables.add(loc.table));
    });
    const edits = [];
    objects.forEach((defs) => defs.forEach((def) => {
      if (!tables.has(def.open)) return;
      edits.push({ at: def.open, text: `self.__baCT(${def.open},` }, { at: def.close + 1, text: ')' });
    }));
    let next = src;
    edits.sort((a, b) => b.at - a.at).forEach((e) => { next = next.slice(0, e.at) + e.text + next.slice(e.at); });
    return { src: next, creatures };
  }

  return { MS_PER_TICK, isCreatureBundle, analyze, instrument, tableValue, parseNameToId };
});

// ---- Part 2: live overrides (browser MAIN world only; skipped when required from Node) ----
/**
 * Live creature ability-constant access (Map Editor -> creature -> Native combat constants).
 *
 * The ability numbers (damage bases, AP ratios, durations, caps) are plain objects inside one
 * minified webpack module of the game, out of reach of any mod. This MAIN-world script runs at
 * document_start, before the game's own scripts (manifest `world: "MAIN"`), wraps the
 * `webpackChunk_N_E` push, and instruments that module's factory before webpack registers it, so
 * each constant object registers itself (`self.__baCT`) when the module first runs. The rewrite is
 * the parser above (`BestiaryCombatChunk.instrument`); it changes no value, it only exposes the objects.
 *
 * `window.BestiaryCombatOverrides.applyLive(overrides)` then sets values on those objects and
 * `restoreLive()` puts every original back. Nothing is stored here: the Map Editor keeps the numbers
 * on each placed creature and applies them only while its test battle runs.
 */
(function () {
  'use strict';
  const lib = globalThis.BestiaryCombatChunk;
  // Under Node the parser lives on module.exports, not a global: nothing to hook.
  if (!lib || globalThis.BestiaryCombatOverrides) return;

  const CHUNK_GLOBAL = 'webpackChunk_N_E';

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

  try {
    installHook();
  } catch (error) {
    console.error('[CombatOverrides] Could not hook the webpack chunk loader', error);
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
      return patchedModules > 0 && tables.size > 0;
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
