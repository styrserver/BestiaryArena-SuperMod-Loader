# Releasing

**The cycle:** work on the in-progress version (manifests ahead of `origin/main`), logging each player-visible
change in its [`patch-notes.json`](patch-notes.json) entry; when you say release, one command checks, pushes to
GitHub and submits to the Chrome Web Store and Firefox AMO, then opens the next version locally:

```bash
node tools/release.mjs
```

| Command | Effect |
|---|---|
| `node tools/release.mjs` | release the in-progress version: check, commit, push, watch the run, open the next version |
| `node tools/release.mjs 5.3.0` | same, but bump to a version you choose first (minor/major) |
| `node tools/release.mjs --dry-run` | every check, nothing changed or pushed |
| `node tools/release.mjs --start-next` | only open the next version locally (the tool already does this after a release) |
| `--full` | also run `tools/check-all.mjs` (live-game drift checks, needs network) |
| `--yes` / `--no-watch` | skip the confirmation prompt / push and stop |

## Working between releases

No commit per change. The in-progress version is the one in the manifests while it is ahead of `origin/main`;
`release.mjs` opens it for you right after each release (`--start-next` if it was skipped, for example when the run
failed). Add a line to the top `patch-notes.json` entry with each player-visible change (rules below). Nothing
publishes until a push to `main` carries the new version, so local edits, and even local commits, are safe.
Check the state any time: `git show origin/main:manifest.json` is what is live on GitHub, `manifest.json` is what
you are building.

## What happens

1. **`tools/release.mjs`** (your PC), stops at the first failure and pushes nothing:
   - on `main`, not behind `origin/main`
   - [`tools/check-syntax.mjs`](../tools/check-syntax.mjs): `node --check` on every shipped script (a syntax error would break the extension in the store)
   - [`tools/check-patch-notes.mjs`](../tools/check-patch-notes.mjs): both manifests and the newest patch note agree
   - optional `--full`: [`tools/check-all.mjs`](../tools/check-all.mjs) (creature combat, inventory, names, room scripts, outfits, fast simulation)
   - [`tools/package.mjs`](../tools/package.mjs) builds both store zips
   - the version is newer than `origin/main`'s, then you confirm, then commit `Release X.Y.Z` and push
   - after a successful push, it **opens the next patch version locally** (both manifests, plus an empty top
     entry in `patch-notes.json`), not pushed. The empty entry is a NOTE for `check-patch-notes.mjs` mid-work and
     a hard failure under `--release`, so an empty version can never be published
2. **GitHub Actions** ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) starts because
   `manifest.json`'s version changed on `main`. No tag. It rebuilds the zips and runs two independent jobs:
   - **chrome**: [`tools/cws.mjs`](../tools/cws.mjs) uploads, waits, publishes (Chrome Web Store API v2)
   - **firefox**: `web-ext sign --channel listed` submits a new version to AMO
3. The release tool watches the run and prints the result. One store can succeed while the other fails.

Pushing without changing the version in `manifest.json` never publishes. That is the guard against accidental
uploads: both stores reject a version number they have already seen.

## Patch notes

Update the top entry **with every player-visible change, in the same sitting**, not at release time: the release
check only proves an entry exists, not that it is complete.

[`patch-notes.json`](patch-notes.json) is the only changelog. The popup's version label and arrows read it
(`popup/popup.js` fetches it from the extension package). Rules (also in the file's `_meta._comment`):

- New entry on top, same version as the manifests. `check-patch-notes.mjs` fails the release otherwise.
- Types: `added`, `changed`, `fixed`, `removed`. Within an entry sort by mod name, then type.
- One entry per mod + type: merge duplicates (the check enforces this for the newest entry).
- Short, player-facing sentences. **No quest spoilers**: no NPC names, map/room names, rewards or hints.
- Keep the entry optimized, simple and concise: no implementation detail, and when merging into an existing
  line reword it shorter instead of appending clauses.
- Internal-only changes (packaging, tooling, refactors with no player-visible effect, such as merging
  `ba-combat-chunk.js` into `ba-combat.js`) get no entry.
- Game-update drift fixes (the `/check-game-update` skill) add a line to the newest entry only when players should hear about it.

## Automatic checks

| Where | When | What |
|---|---|---|
| `tools/release.mjs` | your release | git state, `check-syntax`, `check-patch-notes --release`, zip build, optional `--full` |
| `.github/workflows/pr-check.yml` | every pull request into `main` | `check-syntax`, `check-patch-notes`, and **fails if the PR changes `version`** in either manifest |
| `.github/workflows/release.yml` | a push to `main` that changes `manifest.json`'s version | rebuilds the zips (runs `check-patch-notes`), then uploads to both stores |

`check-patch-notes.mjs` also prints a NOTE (never a failure) when mods under `mods/` changed since `origin/main`
but no line of the newest entry names them (file `Board_Analyzer.js` matches mod "Board Analyzer"). It is a
heuristic against forgotten notes: ignore it for changes with no player-visible effect.

`.gitignore` keeps `dist/`, `.env*`, `*.xpi`, `web-ext-artifacts/` and `.claude/settings.local.json` out of the
repo, because `release.mjs` stages everything with `git add -A` and the repo is public.

## Rollback and recovery

A published version cannot be un-published or re-uploaded under the same number. Ship a fixed next patch.

1. **Bad release found:** fix it, add the patch-notes line (`fixed`), `node tools/release.mjs`. This is the normal and
   fastest path for both stores.
2. **Firefox only:** a bad version can also be disabled in the AMO developer hub (the add-on's *Manage Status &
   Versions*), so users stop receiving it until the fixed version is approved.
3. **Chrome only:** if the bad version is still `PENDING_REVIEW`, cancel the review in the Developer Dashboard
   (*Package → Cancel review*), fix, and re-run the workflow with *publish*. Chrome also refuses a new upload while
   a review is open.
4. **Run failed halfway:** `gh run view <id> --log-failed`. One store can succeed while the other fails. Fix the cause
   and re-run only what failed: the workflow's *Run workflow* with *publish* re-submits both, so do that only for a
   store that does not already have the version (a duplicate is rejected harmlessly). `release.mjs` does not open the
   next version after a failed run; `node tools/release.mjs --start-next` does it once you are done.
5. **Pipeline itself broken:** build with `node tools/package.mjs` and upload `dist/chrome-X.zip` and
   `dist/firefox-X.zip` by hand in the two developer dashboards.

## Version bump checklist

1. `docs/patch-notes.json` entry (above).
2. `manifest.json` and `manifest_firefox.json` `version`: `release.mjs <version>` writes both.
3. If you changed permissions or network hosts: [`privacy_policy.md`](../privacy_policy.md),
   [`README.md`](../README.md) and [`Wikitext.wikitext`](../Wikitext.wikitext) must still match (see CONTRIBUTING).
4. A new file the extension loads: add it to the manifest `content_scripts` / `web_accessible_resources`
   (Chrome) and to `manifest_firefox.json`. `tools/package.mjs` fails if a manifest names a missing file or one
   outside its `INCLUDE` list.

## One-time setup (already done for this repo)

**GitHub secrets** (repo Settings, Secrets and variables, Actions). They are write-only: GitHub never shows a
saved value again, so keep your own copy of anything you cannot regenerate.

| Secret | Where it comes from |
|---|---|
| `CWS_PUBLISHER_ID` | Chrome Web Store developer dashboard, Account |
| `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` | Google Cloud, APIs & Services, Credentials, OAuth client of type **Desktop app** |
| `CWS_REFRESH_TOKEN` | `node tools/get-cws-refresh-token.mjs` (asks for the two values above and a browser sign-in) |
| `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` | `addons.mozilla.org/developers/addon/api/key/` (the secret is shown once) |

The Chrome extension ID is in `tools/cws.mjs` (it is public). The Firefox add-on ID is
`bestiaryarena-supermodloader@private.local` in `manifest_firefox.json`; it must equal the AMO listing's
ID (`curl https://addons.mozilla.org/api/v5/addons/addon/bestiaryarena-supermod-loader/` and read `guid`).

`gh` (GitHub CLI) is optional but lets `release.mjs` and Claude watch the run: `winget install GitHub.cli`, then
`gh auth login --web --scopes repo,workflow`.

## Lessons and gotchas

- **OAuth client type matters.** A *Web application* client rejects the `http://127.0.0.1` redirect
  (`invalid_client` / "OAuth client was not found"). Use **Desktop app**.
- **Publish the OAuth consent screen** ("In production"). In "Testing" mode only listed test users can sign in
  (`403 access_denied`) and the refresh token expires after 7 days, which silently breaks later releases.
- **Chrome allows one version in review at a time.** If the previous release is still `PENDING_REVIEW`, the next
  upload may be refused: wait for approval (check `node tools/cws.mjs status`), then re-run the workflow with *publish*.
- **Chrome review is asynchronous.** `publish` returns `PENDING_REVIEW`; users keep the old version until Google
  approves. `node tools/cws.mjs status` (needs the `CWS_*` env vars) shows the state; the workflow's dry run does
  the same in CI.
- **Firefox listed versions can go live quickly.** `web-ext sign --channel listed` waits through validation and
  approval; AMO may still hold a version for manual review, so check
  `https://addons.mozilla.org/en-US/developers/addons`.
- **Dry run first after changing the pipeline.** Actions tab, Release, Run workflow with *publish* off: builds
  zips and checks the Chrome login without uploading. With *publish* on it re-releases the current version
  (use it only when the stores do not already have that version).
- **GitHub 502 on workflow dispatch** is transient: retry, then check `gh run list` so you do not start two runs.
- **A locked GitHub account blocks every Actions job** ("account is locked due to a billing issue"), even for
  public repos. Fix it at `github.com/settings/billing`; nothing in the repo is wrong.
- **Fallback with no GitHub**: `node tools/package.mjs` and upload `dist/chrome-X.zip` / `dist/firefox-X.zip` by hand
  in the two developer dashboards.
- **Line endings**: `.gitattributes` has `* text=auto`; the LF to CRLF warnings on Windows are harmless.
- **Never put store credentials in the repo or a chat.** They live only in GitHub secrets.
