# Ability scenes: manual update

Hovering a creature's ability icon in the Cyclopedia shows a small scene: numbered tiles, the creature's
own sprite as caster, a projectile, the hit area flashing, and the game's effect animation. The scene
shows at once and starts playing after 0.5 seconds, from the beginning, every hover.

The game exposes none of this through its API. It lives in each creature's class in the minified creature
bundle (area masks like `"\nOOXOO\nXX+XX\n..."`, `missile:"fire"`, `effect:"largeFireExplosion"`), and the
effect sprite ids in a separate effect table (`{bleed:1,...,largeFireExplosion:7,...}`). So the mod ships a
snapshot, same idea as `docs/creature_combat_snapshot.md`:

- **Live first.** The page-start hook (`BestiaryCombatOverrides.getLiveScenes()` in `content/ba-combat.js`) already
  holds the creature module; it parses the scenes and the effect / missile id tables from the running game, so a game
  update needs no snapshot refresh. `getAbilityScene` order: hand-written `ABILITY_SCENE_OVERRIDES`, then live data,
  then the snapshot (used when the hook is absent or the game is not loaded). Cooldown constants are live too. The
  row builder `sceneRowFrom` is shared with the tool. Effect frame counts come from the snapshot, else are measured
  from the sheet on first use (the effect is omitted until it has loaded); missile sheets are probed the same way.
  Verbose log: `[CreatureDB][ability-scene] source` says `live game data` or `snapshot`.
- `ABILITY_SCENE_DATA` (now the fallback, and the check that live parsing still matches) in `database/creature-database.js`, between the `// BEGIN ABILITY_SCENE_DATA` and
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

## Mechanic tags and templates

Some abilities have no area to draw (a push, a sleep then charge). The parser tags them by code shape (`sc.t`, in
`content/ba-combat.js`): `push` = the auto attack calls `displaceTarget` (Ancient Scarab; the Wyvern's screech also
displaces, but over an area, so it keeps its extracted scene) and `sleep` = `sleepPassiveTicker` (Bear), `arena` = `tryCreateArena` (Behemoth). Tags travel in
the snapshot row (`"t":["push"]`, written by the tool) and the live row. `getAbilityScene` replaces the extracted area
by the tag's template in `ABILITY_SCENE_TEMPLATES` (`database/creature-database.js`), drawn against a dummy by
`createCyclopediaPushGrid` (modes `push`, `charge`). A new mechanic = a tag regex, a template, and (if it moves
actors) a renderer mode; creatures that match nothing keep the generic area scene or are listed as TODO by the tool.
Hand-written `ABILITY_SCENE_OVERRIDES` still win over tags.

## Effect sheets: frame size and playback come from the game's stylesheet

Every effect (`/assets/EFFECT/N.png`) has its frame size, frame order and timing in the game CSS (`.effect.id-N`,
`@keyframes effect-N`): e.g. `floorSpike` (294) is 64x64 frames over 1.2s (frame jumps at 0/17/25/67/75/83/92%), `smoke` (242)
is 12 frames of 32x64 and plays frames 6-11 in 0.6s. A frame sits with its bottom-right on the tile (so a 64px frame spills one
tile up and left). Nothing of this is hardcoded in the scenes:

- `creatureDatabase.getEffectSheet(id)` reads it **live**: it puts an element with the game's own markup (`sprite effect id-N`)
  in the page and lets the browser's CSS cascade resolve the size and animation, then reads the named `@keyframes`.
- `EFFECT_SHEET_DATA` in `creature-database.js` is only the fallback (when the page has no rule). `node tools/check-ability-scenes.mjs`
  reads the same rules from the live site's stylesheet (`tools/effect-sheets.mjs`) and fails on drift; `--update` rewrites the fallback.
- The scene draws effects through `cyclopediaSceneEffectPlan` / `...Css` / `...Keyframes` in `Cyclopedia.js`.
  Only hand-sized bursts (`sz`, e.g. Blue Djinn) and the Elf/Geomancer rune and stone sprites use their own code.

## Writing a hand-built scene (the `scene<Creature>()` functions)

Most creatures from id 1 on have a function in `database/creature-database.js` (`sceneKnight()`, `sceneCyclopsSmith(awaken)`, ...) wired in `ABILITY_SCENE_OVERRIDES`, and a second entry in `ABILITY_SCENE_AWAKENED` when the awakened class differs. Build one from the creature's **class in the game bundle** (`loadChunks()` in `tools/check-creature-combat.mjs`), not from the tooltip: colours, sizes, timings and effect ids all come from the code.

- **Shared helpers** (next to `SCENE_FX`): `sceneSelf()` (the caster alone), `sceneDmg(at, on, how, crit, dtype)` / `sceneHeal(at, on, crit)` / `sceneTaunt` / `sceneArea(mask)`, `SCENE_FX` (`heal`, `poof`, `magicPoof`, `teleportBlue`, `haste`, `moe`, `raiseStat`), `SCENE_BAR` (cooldown blue, ability power purple), `SCENE_TICK_MS` (62.5), `walkStepMs(speed)`, `sceneInvisibleLoops(at, count, where)` (the looping `heal` that stands in for an invisible creature), `SCENE_MISSILE_MS` (225: every missile flies that long) and `SCENE_VILLAIN_TI` (the villain Ti attacker). Reuse them; do not retype an effect id.
- **Coordinates:** effect `tiles` count from the TARGET tile (the caster in a self-anchored scene); `to`, status icon / bar / stun / number `on` count from the CASTER; `anchor: 'target'` for mates and overlays placed from the target; flight `from` / `to` are relative to the scene centre.
- **Things that move:** a number, bar, stun or status icon whose `on` is `'self'` follows the walking caster (`casterFlee`), and one whose `on` is the tile a walking mate STARTS on follows that mate (`cyclopediaMateWalkKeys`). An `on` that is already the tile it ends on stays where it is.
- **Cooldown bar:** automatic from the class (`cb` / `cv` in the snapshot, drawn over `cooldownMs` from the cast, `cooldownCastAt` to move the cast). `noCooldownBar: true` when the scene draws its own `bars`.
- **Normal attacks:** a generic attack loop is added for creatures with a ranged or melee auto attack; `noAutoAttack: true` (and the `SCENE_NO_AUTO_ATTACK` list) when the scene already draws its own hits.
- **Which parts show:** `getAbilityScene` drops a part that animates nothing. A part counts when it has `mi`, `fx`, `overlays`, `flights`, `mates` or `passives` (or an `X` in a mask); a scene with only `numbers` / `bars` is dropped.
- **Left out on purpose:** effects and missiles with no sprite sheet (`corymVanguardFx`, `thalasArrow`, `hunterTrap`), the Monster Cauldron head transformation, awakened-only buffs that change nothing visible. Say so in the function's comment.
- **Always write the function comment first:** one paragraph with what the class does (numbers, timings, ids) and what the preview shows.

### Checking a scene

```
node tools/check-ability-scenes.mjs        # snapshot + effect sheets vs the live game
node tools/check-scene-data.mjs            # every scene is well formed (kinds, ranges, timings; warns on numbers 1-100 ms from a landing)
node tools/audit-scenes.mjs --from 59 --md docs/scene-audit.md   # what each class does that its scene does not
```

The five `check-scene-data` warnings for Elf Scout, Magma Crystal and Cake Drake are intentional (the game schedules those hits just before or after the missile lands). The audit reads code, not pixels: a wrong position or timing still needs a look in the Cyclopedia. After a refactor of `creature-database.js`, run `node tools/dump-scenes.mjs before.json` and again after, then `node tools/dump-scenes.mjs --diff before.json after.json`: the scenes must be identical.
