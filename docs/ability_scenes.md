# Ability scenes: manual update

Hovering a creature's ability icon in the Cyclopedia shows a small scene: numbered tiles, the creature's
own sprite as caster, a projectile, the hit area flashing, and the game's effect animation. The scene
shows at once and starts playing after 0.5 seconds, from the beginning, every hover.

The game exposes none of this through its API. It lives in each creature's class in the minified creature
bundle (area masks like `"\nOOXOO\nXX+XX\n..."`, `missile:"fire"`, `effect:"largeFireExplosion"`), and the
effect sprite ids in a separate effect table (`{bleed:1,...,largeFireExplosion:7,...}`). So the mod ships a
snapshot, same idea as `docs/creature_combat_snapshot.md`:

- `ABILITY_SCENE_DATA` in `database/creature-database.js`, between the `// BEGIN ABILITY_SCENE_DATA` and
  `// END ABILITY_SCENE_DATA` markers. Never edit it by hand: `tools/check-ability-scenes.mjs` writes it.
- Read through `creatureDatabase.getAbilityScene(gameId)` -> `{ name, masks, missiles, effects }`.
- Parser: the `sc` field in `content/ba-combat.js` (`sceneFields`), shared with the combat snapshot parser.
- Renderer: `createCyclopediaAbilityScene` in `mods/Super_Mods/Cyclopedia.js`.

## Data shape

```
128: {"n":"Orshabaal","sc":{
  "m":  [{ "a": "target", "rows": ["OOOOOXOOOOO", ..., "XXXXX+XXXXX", ...] }],
  "mi": [{ "n": "fire", "id": 4 }],
  "fx": [{ "n": "largeFireExplosion", "id": 7, "f": 14, "b": 1 }]
}}
```

- `m`: one entry per area mask the class uses. `rows`: `+` origin tile, `X` hit, `O` not hit. `a`:
  `target` (mask centred on the enemy, caster in the corner, projectile flies over) or `self` (mask
  centred on the caster, no projectile). Several masks render side by side. The grid is a square window sized to the ability (farthest hit tile + 1 tile of padding, at least 5 x 5, origin in the middle); tile numbers are the game board's (15 x 11, row by row, origin 82), blank outside the board.
- `mi`: missiles `{ n, id }`. `id` is the sheet `/assets/MISSILE/{id}.png` (96x96: eight 32px direction frames in a 3x3 layout); the scene picks the frame facing from caster to target.
- `fx`: effects the class publishes. `b: 1` (set by the tool for the game's `large*` effects) means one big burst on the origin
  tile; any other effect (fire, ...) plays on every tile the mask covers. `id` is the sheet `/assets/EFFECT/{id}.png`; `f` its frame count
  (PNG height / width: square frames, 64px wide for most sheets, 32px for some like `energy`, stacked vertically). Effect ids that have no sheet (for example
  99005 `corymVanguardFx`) are left out and printed as a `WARN`.
- `fx.w: 'self'`: the effect plays on the caster (buffs); without it, on the target / the hit tiles. The tool reads
  this from the emitter in the class (`this.fxEmitter` = self, anything else = target).
- `m.g: 1`: generic one-tile mask. When a class has no area mask (single-target hits, buffs), the tool writes
  `['+']` around the target if the ability throws a missile or plays an effect elsewhere, around the caster if
  every effect is on itself. A creature with no mask, missile or effect has no extracted scene.

- `m.line: 1` (hand-written only): the hit tiles are the straight run from the caster to the target (electric chains,
  Dark Apprentice / Dark Magician); the mask only sizes the grid.

## Hand-written overrides

`ABILITY_SCENE_OVERRIDES` in `database/creature-database.js` (between its own BEGIN / END markers) holds scenes for
creatures the tool cannot read: abilities in shared components (Dragon's fireball), pulses on neighbouring tiles
(Ghoul), buffs (Tortoise). Same row shape as the generated data; an entry wins over the extracted row. The tool
never rewrites this block. An entry of `null` means "no scene on purpose" (a quote-only ability, a match rule).
Single-target and passive/buff entries were read from the ability text and only place the ability (target tile or
caster), not its exact area. The tool prints a `COVERAGE` line and lists creatures with neither an extracted scene nor an
override as `TODO` (information only, exit code unchanged); read the creature's class in the bundle, then add an
entry.

## Floor tiles

Each tile is the game's own ground sprite (`CYCLOPEDIA_SCENE_FLOOR` in Cyclopedia.js: sprite id 351, 4 x 4 crop variants),
the same markup the Map Editor places (`.sprite.item.id-N > .viewport > img.spritesheet` with `--cropX` / `--cropY`).
The game's stylesheet paints it; the variant per tile is picked deterministically so the floor looks varied but
stable. If the page cannot paint the sprite the tile keeps a dark fallback colour; the `floor sprite` debug line
reports `painted`.

## When to run it

After a game update, or when a scene looks wrong (wrong area, missing effect). `check-all.mjs` and the
`/check-game-update` skill run the check automatically.

```bash
node tools/check-ability-scenes.mjs            # read-only; exit 1 on NEW / CHANGED / REMOVED
node tools/check-ability-scenes.mjs --update   # rewrite the data block
```

| Output / exit code | Meaning |
|---|---|
| `OK: N creatures with scenes match the snapshot.` (0) | Current. |
| `NEW` / `CHANGED` / `REMOVED` (1) | Snapshot differs from the game; review, then `--update`. |
| error message (2) | Download or parsing failed. Not "OK". |

## Hint marker

A creature with a scene gets a small play badge (▶) in the top-right corner of its ability icon (`data-ability-scene-hint`), so the
player knows there is something to see on hover.

## Several abilities, timing and placement

- **Parts:** a creature with several abilities lists them under `sc.p` (hand-written rows only; Demon: energy beam +
  great fireball). `getAbilityScene` returns `{ name, parts }`, one part per ability with `label`, `masks`, `missiles`,
  `effects` and `cooldownMs`; parts render side by side with a caption each. A row without `p` is one part.
- **Timing:** one loop is the ability's real cooldown from `CREATURE_COMBAT_DATA` (`cd` names the constant, default
  `COOLDOWN_MS` / `BASE_COOLDOWN_MS`, clamped to 1.5 - 8 s). The projectile flies about 70 ms per tile, effects play
  about 60 ms per frame (500 ms at least), the area flash lasts a little longer than the projectile.
- **Placement:** the scene shows in a fixed panel appended to `<body>`, right of the ability icon and top-aligned with
  it, the same place for every creature, kept inside the window; it ignores the mouse so the hover stays stable. It is
  removed on mouse-leave, or when the creature view is replaced while hovering (a 300 ms guard interval).

## Reading the game live

Prefer extracting over hand-writing, so a game update fixes scenes by itself:
- The scene class is found through `super({...t,...<metaVar>})`, also for classes with fields before the constructor.
- Masks are read both as `var=(0,K.fO)("...")` and as object properties (`tx={inner:...,outer:...}` -> `tx.inner`).
- A `scanCoordinates(<mask>(...))` whose mask the parser cannot resolve is printed as `WARN area scans with a mask the
  parser cannot resolve`; such a creature gets no generic one-tile scene (it shows as TODO) until the parser or an
  override covers it.
- A missile or effect name whose sprite sheet does not exist (`oldFire`, `oldFireFx`, ...) is left out and printed
  as a `WARN`.
Add a hand-written override only when the class cannot be read (shared components, `tile.neighbors`, buffs).

## Lifecycle

The scene is built on the first hover of the ability icon (not when the creature view renders) and reused for
later hovers. Sprite sizes (floor, caster) are measured when it is first shown, inside the hover handler. Timing
constants live in `CYCLOPEDIA_SCENE_TIMELINE`. Each asset URL is probed (size check) once per page.

## Debugging

Set the popup **Log Level** to `verbose` and filter the console for `[Cyclopedia][ability-scene]`: it logs
the scene build, each grid's size, every missile and effect (name, id, URL, size) and an `asset ok` / `SIZE MISMATCH` line per image (a failed load is a `console.error`), the caster sprite fit, and hover start,
play and end. A creature without scene data logs `hasSceneData: false`.

If the parser stops finding masks, check the regexes in `sceneFields` against the live bundle first (the
mask is `<var>=(0,<mod>.<fn>)("\n...")`, used as `<var>(t.position)` or `<var>(this.position)`).
