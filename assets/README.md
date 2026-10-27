# Extension `assets/`

Static files shipped with the SuperMod Loader extension and listed in `web_accessible_resources`.

**Do not confuse** this folder with game-site paths such as `https://bestiaryarena.com/assets/...` or page-relative `/assets/icons/...` used by mods and `ui_components.js` when injected into the game page. Those resolve on the live site and are not files in this repo.

## Layout

| Path | Purpose |
|------|---------|
| `icons/` | Extension toolbar icons (`icon-16` … `icon-128`) and popup language flags |
| `js/` | Shared scripts: `localization.js`, `ui_components.js` |
| `locales/` | `en-US.json`, `pt-BR.json` |
| `ot/` | OT-mod art: `Depot_Chest.gif`, `Guild_Coin.png`, `equipment/`, `skills/` |
| `quests/` | Quest mod JSON (`missions`, `items`, …) plus flat item/NPC media |

## Notes

- Prefer game CDN / hashed `_next/static/media/` frames for UI chrome; do not re-copy game frames into this tree.
- Quest media filenames are referenced from `quests/*.json` (and some Quests.js hardcodes). Keep extensions lowercase (`.png`, `.gif`).
- After adding or moving files, update `manifest.json` and `manifest_firefox.json` `web_accessible_resources` as needed.
