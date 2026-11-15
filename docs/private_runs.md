# Private runs (Firebase admins only)

Best-run suggestions and automatic setups from a **private GitHub repository** of analysed board solutions.
Nothing is shipped: the admin types the repository name and their own token in Mod Settings. Everyone who is
not in Firebase `config/admins` sees none of it (no section, no buttons, no labels, no patch-note lines).

| Piece | File | What it does |
|---|---|---|
| Data layer + settings UI | `mods/Super_Mods/Mod_Settings.js` (section 4.4, `initRunsSiteSettings`) | Reads the repository, picks runs, exposes `window.BestiaryRunsSite` |
| Fetch | `background.js` (`fetchRunsRepoFile`), `content/client.js` (`util.fetchRunsRepoFile`) | One file from the repo through the GitHub contents API |
| Highscore list | `mods/Official_Mods/Highscore_Improvements.js` (section 11b) | Faster runs than yours per map, with **Apply** and **Copy run** |
| Automatic setups | `mods/Super_Mods/Better_Setups.js` (section 9b) | Three native saved setups per map: Private ticks / rank / floor |
| Admin patch notes | `popup/popup.js`, `content/injector.js`, `docs/patch-notes.json` | Lines with `"admin": true` are hidden from non-admins |

## Connection

Mod Settings → **Private runs repository (admin)** (visible to admins only): `owner/name` (a pasted
`https://github.com/...` URL is accepted) and a read-only token, then **Save & test connection**. The values live in the
`better-ui-config` localStorage entry (`runsSiteEnabled`, `runsSiteRepo`, `runsSiteToken`) and the token is redacted in
the config log lines (`redactedConfigForLog`).

`background.js` `fetchRunsRepoFile(repo, path, token)` calls
`https://api.github.com/repos/<repo>/contents/<path>` with `Accept: application/vnd.github.raw+json` and
`cache: 'no-cache'` (an unchanged file is an ETag `304`). It accepts only `owner/name`, rejects `..` in the path, and
never stores the token. The page cannot call GitHub with the token itself, so it goes
`BestiaryModAPI.util.fetchRunsRepoFile` → injector → background. `api.github.com` already allows CORS and needs no
extra host permission.

## Repository data

- `solution-index.json` (~3.4 MB): `solutions[path]` = `{ map, region, floor, teamSize, runs, victories, minTicks,
  rankPoints, rankCount, floors: [[floor, runs, victories]], combos: [[monster, item, stat]], maintenance }`, plus
  `categories` keyed by floor set. It is fetched once and re-read every 10 minutes.
- One file per solution (`config.board` = `[{ tile, monster, equipment }]`, plus `credits`), fetched only for the few
  runs that are shown or checked.
- **Floor sets.** A category key is `<map>` or, for maps whose floors differ in enemies, tiles or team size,
  `<map> floors 0–5` / `<map> floor 3`. Seven maps have several (Stonehome Cave, Halloween Mansion, Amazon.com
  Warehouse, Mamma Longlegs Nest, Bloody Crypt, The Behemoth Quest, The Annihilator Quest). A solution belongs to the
  set that contains its `floor`.
- Odds come from the simulation: `victories / runs` on the floor a run was **made for**; a run made for floor 0 also has
  odds for higher floors in `floors`. Rank and high-floor solutions have no `floors` tuples: their own numbers describe
  their own floor.

## What "best" means

The game's own ordering, the same one the Cyclopedia runs tables use, with **no odds thresholds** (the best run is the
best run, however rarely it comes off). `RUNS_SITE_GOALS` in Mod_Settings holds it once; the automatic setups and the
Highscore list both use it.

| Goal | Order | Floor |
|---|---|---|
| ticks | fewest ticks | floor 0 (in a later floor set: the highest floor its runs were made for) |
| rank | most S+ points, then fewest ticks | floor 0 (later sets: only if the repository has S+ points there) |
| floor | highest floor with a usable run, then fewest ticks | within the floor set on screen |

The only requirement is evidence the run can happen: a simulated win (and for rank a run that reached its points). Ticks
are only compared between runs **made for that floor** (`designed`); a run made for another floor only has odds there.
The odds break ties and are shown next to every run in the Highscore list (green = wins ≥ 90% and hits its ticks ≥ 50%).

## Automatic setups (Better Setups)

For the room and floor on screen, three goals are written as the **game's own saved setups** under reserved labels
`Private ticks`, `Private rank`, `Private floor`. The game then shows its normal green `Setup (Private …)` button, and
Raid Hunter, Better Boosted Maps and Better Tasker (which pick a setup by label text) use them with no changes.

- **Stored value.** The game keeps a saved setup in `localStorage["<label>-<roomId>"]` = its board config: the room's
  non-player pieces plus `{ type: 'player', key, tileIndex, villain: false, databaseId, equipId }` per player piece (what
  its `autoSetupBoard` builds). There is no floor in the key, so values are rewritten on room, floor and roster change
  (a roster signature + debounce; one pass per change).
- **Nothing to offer** is stored as `[]` (what the game's trash button stores), never removed: the game's storage hook
  ignores `storage` events whose `newValue` is null, so a removed key would leave the previous floor's setup loadable.
- **Ticks and floor on the same run** show it once, on Floor.
- **Fieldable only.** A candidate is checked against your roster (a cheap name/item pre-check from the index `combos`,
  then the exact check in `runsSiteApplyRun`) before a board is downloaded; the first fieldable one wins.
- **Reserved labels.** The label editors never list them; the edit button is not added; the trash button is hidden;
  `Save` is dimmed and every click on it or the trash is swallowed by a capture-phase guard. Only `Setup` works.
- **Captions** (`Ticks (46 ticks)`, `Rank S+4 (337 ticks)`, `Floor 15 (204 ticks)`) are drawn over the game's fixed
  `Setup (<label>)` text with a CSS `::after` from a `data-private-runs-title` attribute. The original text stays in
  the DOM (mods match on it; React owns it). Localised in `mods.betterSetups.privateRuns.*`.
- Disconnecting (or disabling Better Setups) removes the labels and every stored setup.

## `window.BestiaryRunsSite`

`isEnabled()` (admin + toggle + repo + token), `isAdmin()`, `suggest(roomCode, yours)` (Highscore list),
`bestFor(roomCode, goal, floor)` (automatic setups; resolves to `{ run, floor, winrate, setup, substituted }` or null),
`check(roomCode, run)` / `apply(roomCode, run)` (dry run / apply), `buildSnippet(roomCode, run)` (self-contained
console snippet), `isReliable(run)`, `test()`, `reset()`.

## Admin patch notes

A line with `"admin": true` in `docs/patch-notes.json` (text starts with "Private (admins only):") is shown only to
admins. Mod Settings mirrors the admin status (`BA_ADMIN_STATUS` message → injector → `ba-is-admin` in extension
storage); the popup reads it. Cosmetic, not an access check. `tools/check-patch-notes.mjs` requires `admin` to be a
boolean.

## Logging

At Info/Verbose level each pick logs one line: `[Mod Settings] Private runs <room> <goal>: picked <path> for floor N
(… solutions, … suitable, … covered by your roster)` or `none (…): <why>` (map not in the repository, roster lacks every
suitable run, no run in this floor set, …).

## Gotchas

- **Declare state above early init.** Better Setups calls `processSetupInterface()` while its file is still being
  evaluated; that reaches `lockPrivateRunsControls`, which reads `privateRunsTitles`. The section 9b state is therefore
  declared at the top of the file, not next to its code (a `let` further down is still in its temporal dead zone and
  the whole mod throws on load).
- **No `removeItem` for "none".** See above.
- Never edit or remove the React-owned button text or nodes; hide with CSS and keep the text for mods that match on it.
- Only slices of a mod file can be unit-tested with a fake `document`; load the **whole** file once with stubs to catch
  load-order errors.
