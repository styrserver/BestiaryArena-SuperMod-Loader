/**
 * Effect sheet geometry and playback, read from the game stylesheet (the rules `.effect.id-N` / `.id-N .spritesheet` and the
 * `@keyframes effect-N` they name). Snapshotted into creature-database.js (EFFECT_SHEET_DATA) by
 * tools/check-ability-scenes.mjs, so the Cyclopedia scenes draw each effect the way the game does: a frame `w` x `h` px
 * (anchored bottom-right on the tile), `n` frames stacked in the sheet, played over `ms`:
 *   { from, to, steps }  `steps` equal steps from frame `from` to `to` (every frame once is from 0, to n, steps n)
 *   { keys: [[pct, frame], ...] }  frame jumps at `pct` % of `ms` (the game's step-end keyframes)
 * `sw` = sheet width when it is wider than one frame. The size rule is picked by the real PNG size (an id is also a
 * missile / item elsewhere in the CSS).
 */

export const EFFECT_SHEET_BLOCK = /(\/\/ BEGIN EFFECT_SHEET_DATA\r?\n)[\s\S]*?(\/\/ END EFFECT_SHEET_DATA)/;

/** Meta for effect `id` from the stylesheet text `css`, given its PNG size `png = { w, h }`; null when not readable. */
export function parseEffectSheetFromCss(css, id, png) {
  let size = null;
  for (const m of css.matchAll(new RegExp(String.raw`(?:\.effect)?\.id-${id}\{([^}]*--sWidth:[^}]*)\}`, 'g'))) {
    const v = Object.fromEntries([...m[1].matchAll(/--(\w+):([\d.]+)px/g)].map((x) => [x[1], Number(x[2])]));
    if (v.sWidth === png.w && v.sHeight === png.h) size = v;
  }
  if (!size) return null;
  const base = { w: size.width, h: size.height, ...(size.sWidth !== size.width ? { sw: size.sWidth } : {}) };
  const n = Math.round(size.sHeight / size.height);
  // Animation: the last `animation:` of the `.id-N .spritesheet` rules that do not load a missile / item sheet.
  let anim = null;
  for (const m of css.matchAll(new RegExp(String.raw`(?:\.effect)?\.id-${id} \.spritesheet\{([^}]*)\}`, 'g'))) {
    if (/\/assets\/(MISSILE|ITEM)\//.test(m[1])) continue;
    const a = /animation:([^;}]*)/.exec(m[1]);
    if (a) anim = a[1].trim();
  }
  if (!anim) return { ...base, n };
  const am = /^([\w-]+)\s+([\d.]+)(ms|s)\s+(steps\((\d+)[^)]*\)|step-end|linear)/.exec(anim);
  if (!am) return null;
  const [, name, dur, unit, timing, stepsN] = am;
  const out = { ...base, n, ms: Math.round(Number(dur) * (unit === 's' ? 1000 : 1)) };
  // The frame position (in frames) a translateY value stands for.
  const frameOf = (val) => {
    const px = /calc\((-?[\d.]+)px/.exec(val);
    if (px) return Math.round(-Number(px[1]) / size.height);
    const pc = /(-?[\d.]+)%/.exec(val);
    if (pc) return (-Number(pc[1]) / 100) * (size.sHeight / size.height);
    return null;
  };
  const points = [];
  const kf = new RegExp(String.raw`@keyframes ${name}\{`).exec(css);
  if (kf) {
    let depth = 0;
    let i = kf.index + kf[0].length - 1;
    const start = i;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    for (const m of css.slice(start + 1, i).matchAll(/(from|to|[\d.]+%)\{([^}]*)\}/g)) {
      const t = /transform:translateY\(([^;}]*)/.exec(m[2]);
      const f = t ? frameOf(t[1]) : null;
      const pct = m[1] === 'from' ? 0 : m[1] === 'to' ? 100 : Number(m[1].replace('%', ''));
      if (f != null) points.push([pct, f]);
    }
  }
  if (timing === 'step-end') {
    const keys = points.filter(([pct]) => pct < 99.5);
    if (!keys.length) return null;
    out.keys = keys;
    return out;
  }
  if (timing.startsWith('steps')) {
    // No own transform keyframes (the shared `disappearing-homogeneous-transition`): every frame once.
    if (!points.length || name === 'disappearing-homogeneous-transition') return { ...out, from: 0, to: n, steps: Number(stepsN) };
    return { ...out, from: points[0][1], to: points[points.length - 1][1], steps: Number(stepsN) };
  }
  return null;
}

/** The game's stylesheet text (the CSS files the home page links). */
export async function fetchGameCss(origin) {
  const html = await (await fetch(`${origin}/`)).text();
  const links = [...new Set([...html.matchAll(/\/_next\/static\/css\/[^"']+\.css/g)].map((m) => m[0]))];
  let css = '';
  for (const l of links) css += await (await fetch(`${origin}${l}`)).text();
  return css;
}

/** { data: { id: meta }, unreadable: [id] } for the effect ids that are sprite sheets. */
export async function fetchEffectSheets(origin, ids, css) {
  const data = {};
  const unreadable = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const res = await fetch(`${origin}/assets/EFFECT/${id}.png`);
    if (!res.ok) continue; // not a sprite sheet (e.g. 99005): reported with the other missing sheets
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = parseEffectSheetFromCss(css, id, { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
    if (meta) data[id] = meta; else unreadable.push(id);
  }
  return { data, unreadable };
}

export function serializeEffectSheets(data) {
  const rows = Object.keys(data).map(Number).sort((a, b) => a - b).map((id) => `  ${id}: ${JSON.stringify(data[id])}`);
  return `const EFFECT_SHEET_DATA = {\n${rows.join(',\n')}\n};`;
}

/** The snapshot currently in creature-database.js (null when the block is missing). */
export function readEffectSheetSnapshot(dbText) {
  const m = EFFECT_SHEET_BLOCK.exec(dbText);
  if (!m) return null;
  const body = m[0].replace(/^\/\/ BEGIN[^\n]*\r?\n/, '').replace(/\r?\n?\/\/ END[^\n]*$/, '')
    .replace(/^\s*const EFFECT_SHEET_DATA = /, '').replace(/;\s*$/, '').replace(/^(\s*)(\d+):/gm, '$1"$2":');
  return JSON.parse(body);
}
