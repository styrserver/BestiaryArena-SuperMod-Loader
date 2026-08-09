# Quest mod data (`assets/quests`)

Data-driven content for the **Quests** mod (`mods/OT_Mods/Quests.js`). Runtime logic stays in JavaScript; copy, numbers, placements, and item definitions live here.

Loaded once at startup via `loadQuestDialogueAssets()` (parallel `fetch` of all JSON files). Images are resolved with `getQuestItemsAssetUrl(filename)` — paths are **flat** under `/assets/quests/`.

---

## Folder layout (current)

```
assets/quests/
├── config.json       # Timing, modal sizes, UI chrome, Firebase URL
├── missions.json     # Missions, registry, completion summaries, seal transcripts
├── npcs.json         # NPC keyword/confusion dialogue, quest-item chat
├── items.json        # Products, drops, quest log icons, dev tools, lifecycle rules
├── battles.json      # Custom battle setups (tiles, villains, spawn rules)
├── rooms.json        # Room/tile/NPC placement, fishing/mining/seals, arena ranks
├── toasts.json       # Toast copy, builders, variant styling, battle log prefixes
└── *.gif / *.png     # Icons, NPC portraits, effects (same directory as JSON)
```

| Kind | Count (approx.) | Notes |
|------|-----------------|-------|
| JSON data files | 7 | Each has a `_sections` key documenting top-level blocks (ignored at runtime) |
| Image assets | ~50 | Filenames referenced from `items.json` → `products.icon`, hardcoded in `Quests.js`, or `questLogIcons` |

**Do not split JSON into subfolders** without updating `fetchQuestJsonAsset()` in `Quests.js`. **Do not move images into subfolders** without updating every `icon` field, `getQuestItemsAssetUrl()` call, and `manifest.json` (paths are filename-only today).

---

## File reference

### `config.json`

Mod tuning that is not quest-specific.

| Section | Purpose |
|---------|---------|
| `timing` | Button polling, observer debounce, NPC chat delays |
| `modal` | Quest modal dimensions (King, NPC chat, quest items, arena leaderboard) |
| `ui` | Frame URLs, cursor/title strings, king chat row height |
| `firebase` | Realtime Database base URL for mission progress |

Applied by `applyQuestConfigFromAssets()`.

---

### `missions.json`

| Section | Purpose |
|---------|---------|
| `common` | Shared dialogue lines (`errorGeneric`, etc.) |
| `missions` | Per-mission objects keyed by mission id |
| `completionSummaries` | Quest log “completed” blurbs |
| `sealTranscripts` | Costello diary seal incomplete/complete lines |
| `registry` | `storyOrder`, `missions` → `stateKey`, `firebaseKey`, `extraFields` |

**Mission object fields (common):**

| Field | Use |
|-------|-----|
| `id`, `title` | Identity and UI labels |
| `prompt`, `accept`, `complete`, … | NPC dialogue (use `{coins}` in `complete` when paying guild coins) |
| `objectiveLine1`, `objectiveLine2`, `hint` | Quest log |
| `rewardCoins` | Guild coins granted at completion (when applicable) |
| `rewardItemName`, `rewardProductId`, `rewardIcon` | Item reward (links to `items.json` → `products`) |
| `rewardSummary` | Quest log reward line (preferred display text) |
| `questItemName` | Mid-quest item macguffin (not a completion reward; e.g. Lost Oracle) |

Hydrated into `MISSION_BY_ID` via `applyQuestDialogueFromAssets()`. Registry drives `MISSION_STATE_MAP`, Firebase keys, and quest log order.

---

### `npcs.json`

| Section | Purpose |
|---------|---------|
| `king-tibianus`, `al-dee`, … | `keywords`, `confusion`, NPC-specific extras |
| `costello` | Includes `sealPatterns` and `sealGuidanceFallback` |
| `questItems` | Per-NPC lines when player mentions a quest item |
| `questItemUninvolvedTemplates` | `{item}` template when NPC has no specific line |

---

### `items.json`

| Section | Purpose |
|---------|---------|
| `products` | Canonical `productName`, `icon`, `description`, `rarity`, `maxCount` |
| `creatureDrops` | Creature gameId → drop tables |
| `rookgaardGlobal` | Shared Rookgaard drop pool |
| `questItemChatEntries` | Keyword → quest item id for chat matching |
| `questLogIcons` / `questLogSpriteIcons` | Mission id → icon filename or board sprite id |
| `devTools.items` | Quest Dev Tools grant list (story order) |
| `itemLifecycle` | `cleanupRules`, `staleCleanupOnComplete`, `devCompleteRewards` |

**Adding a grantable dev item:** define `products.<id>`, add to `devTools.items`, and optionally `devCompleteRewards`.

---

### `battles.json`

Keyed by battle id (matches mission or encounter id). Defines ally limits, allowed tiles, villain spawns, nicknames, and battle-specific messages. Consumed by `getQuestBattleConfig(battleId)`.

---

### `rooms.json`

World placement and minigame config: fishing, mining, desert dig, room names, tile indices, sprite ids, board NPC positions, seven seals, ghazbaran hideout, `kingArenaRanks`, tile success effect URLs.

Hydrated by `applyQuestRoomsFromAssets()` into module-level variables used by observers and tile handlers.

---

### `toasts.json`

| Section | Purpose |
|---------|---------|
| `messages` | Template strings (`{title}`, `{coins}`, `{name}`, …) |
| `messageBuilders` | Which keys are functions vs static (`[]` = static, `["title"]` = interpolated) |
| `variants` | Message key → toast variant id |
| `styling` | `defaultDuration`, `variantColors`, `variantDurations` |
| `battleLog` | Console log prefixes per battle |
| `mornenionDefeated` | One-off sealed-cave message |

---

## What stays in `Quests.js`

Keep in code (not JSON):

- DOM/modal layout application, observers, Firebase sync
- Mission accept/hand-in state machines and yes/no flows
- Battle hooks, tile right-click handlers, board NPC overlays
- `kingChatState` initial shape (per-progress-field defaults)
- Helpers: `getMissionCompleteLine`, `getMissionRewardItemName`, `buildMissionRewardSummary`, etc.

Rule of thumb: **if it is player-facing text or a tunable number**, prefer JSON; **if it is control flow or DOM**, keep JavaScript.

---

## Adding a new mission (checklist)

1. Add mission id to `QUEST_MISSION_IDS` in `Quests.js` (or rely on registry after JSON load).
2. Add full entry under `missions.json` → `missions.<id>`.
3. Add `registry.storyOrder` entry and `registry.missions.<id>` (`stateKey`, `firebaseKey`, `extraFields` if needed).
4. Add `completionSummaries.<id>` if the quest log needs a custom summary.
5. Add `kingChatState` progress field in `Quests.js` if the mission uses Firebase progress (or extend code generation later).
6. Wire NPC/battle/room handlers in `Quests.js` as needed.
7. If the mission grants an item: `items.json` → `products`, drops/lifecycle/devTools as needed; add icon file to `assets/quests/`.
8. If custom battle: `battles.json` entry.
9. If new placements: `rooms.json` section.
10. Quest log icon: `items.json` → `questLogIcons` or `questLogSpriteIcons`.

Quest Dev Tools picks up missions automatically from the registry (no separate mission list).

---

## Organization recommendations

### Keep as-is (recommended)

- **Flat JSON at folder root** — only seven files; splitting adds loader complexity for little gain.
- **Flat images** — `icon` fields and `getQuestItemsAssetUrl('King_Tibianus.gif')` assume no subdirectory.

Each JSON file already documents itself with `_sections`. This file is the cross-file map.

### Optional future cleanup (requires migration)

If the image count grows significantly, consider:

```
assets/quests/
├── data/           # *.json (update fetchQuestJsonAsset paths)
├── icons/          # product & quest log gifs
├── npcs/           # dialogue portraits & idle sheets
└── effects/        # tile highlight, tutorial arrow, loot effect
```

Migration steps: update all `icon` values and hardcoded filenames in `Quests.js`, add optional `subpath` to `getQuestItemsAssetUrl`, verify `manifest.json` → `web_accessible_resources` includes `assets/quests/**`.

**Not recommended now** — cost outweighs benefit at current size.

---

## Related docs

- [Mod Development Guide](mod_development_guide.md) — Quest mod data is under [Further Resources → Quest mod data](mod_development_guide.md#quest-mod-data-assetsquests)
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Documentation section (item 6)
- Mission registry comments in `Quests.js` (search for `HOW TO ADD A NEW MISSION`)
- `manifest.json` → `web_accessible_resources` includes `assets/quests/*`
