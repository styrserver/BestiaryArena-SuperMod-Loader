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
├── *-map.json        # Optional Map Editor bundles (map-editor-bundle-v1) referenced by rooms.mapFile
└── *.gif / *.png     # Icons, NPC portraits, effects (same directory as JSON)
```

| Kind | Count (approx.) | Notes |
|------|-----------------|-------|
| JSON data files | 7 + optional `*-map.json` | Each core file has a `_sections` key documenting top-level blocks (ignored at runtime) |
| Image assets | ~50 | Filenames referenced from `items.json` → `products.icon`, hardcoded in `Quests.js`, or `questLogIcons` |

**Do not split JSON into subfolders** without updating `fetchQuestJsonAsset()` in `Quests.js`. **Do not move images into subfolders** without updating every `icon` field, `getQuestItemsAssetUrl()` call, and `manifest.json` (paths are filename-only today).

---

## Map Editor → Quests export

Use **Copy export JSON** in Map Editor.

Output shape (`quest-room-export-v1`):

| Key | Paste into |
|-----|------------|
| `rooms.<roomKey>` | `rooms.json` (placement + `mapFile` + optional `sceneSpriteReplacements`) |
| `battles.<roomKey>` | `battles.json` (ally limit, allowed tiles, villains with `fallbackGameId`) |
| `mapBundle` | New file `assets/quests/<mapFile>` (full `map-editor-bundle-v1` tiles/templates) |

Do **not** paste a raw `map-editor-bundle-v1` into `rooms.json`. That file stays placement/config only; tile data lives in the separate `*-map.json` bundle.

`rooms.<key>` fields from the export:

| Field | Purpose |
|-------|---------|
| `roomName` / `roomId` | Target game room |
| `mapFile` | Filename of the saved map bundle under `assets/quests/` |
| `battleId` | Key matching the `battles.json` entry |
| `sceneSpriteReplacements` | Optional live sprite swap rules |

Still required in `Quests.js`: mission accept/hand-in flow and a battle start hook that loads `mapFile` (via Map Editor helpers or a quest apply path) when the player enters the encounter.

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

### Ordering new missions in `storyOrder`

`registry.storyOrder` is sorted by **real unlock progression**, not by when the mission was added to the file. The method (see `registry._storyOrderComment` in the JSON for the short version):

1. **Resolve the mission's gate room(s)** — the room(s) the player must have already reached to start/progress it. Use the live game data to place a room: open DevTools on the loaded game and run
   ```js
   globalThis.state.utils.REGIONS.map((r, i) => ({ i, id: r.id, rooms: r.rooms.map((room, j) => ({ j, id: room.id, name: globalThis.state.utils.ROOM_NAME[room.id] })) }))
   ```
   A room's position is `(regionIndex, roomIndexWithinRegion)` — lower is earlier. Watch for flavor text that doesn't match a real room name (e.g. "Rotworm Dungeon" isn't an actual room; check the code/`rooms.json` for the room it's actually implemented in) and for a quest's *battle* room being a reused `Sewers` reskin — the real gate is wherever the player physically travels to trigger it, not the reused battle room.
2. **Cluster by quest-giver.** All of one NPC's missions move together as a block, positioned by whichever of that NPC's own missions unlocks soonest — don't scatter one NPC's quests across the list by each quest's individual room. King Tibianus is the exception: he has no single unlock point (he's available from the very start), so his *solo* missions are NOT one cluster — each sorts by its own gate, **except** the ones with zero cross-NPC prerequisite (see step 3), which do sit together at the very top.
3. **Check for a hard cross-NPC prerequisite** (an item from another NPC's reward, or "meeting" an NPC for the first time via another mission) and pin the dependent mission/cluster immediately after whichever prerequisite it needs, even if its own room would otherwise sort earlier. Search `missions.json` for `"requires[A-Z]` and search `Quests.js` for `canOffer` / `cachedQuestItems\[` gating an NPC's offer — both patterns surface these. Known examples already in the data: `al_dee_golden_rope`→Holy Tible→`king_monks_study`; `al_dee_fishing_gold`→Light Shovel→`king_scarab_coin`; `king_scarab_coin`→meeting Tesha→`serpentine_tower`/`realm_of_dreams`; `realm_of_dreams`→Mintwallin Prison Key→`visiting_mintwallin`; `king_letter_al_dee`→"the stamped letter"→the rest of the Al Dee chain.
4. Missions with **no gate at all** (generic drops available from anywhere, e.g. `king_red_dragon`) sort with whichever no-gate cluster they narratively belong to — don't force them into a room-based position they don't have.

---

### Locking a mission behind an unlocked room

Each mission entry in `registry.missions.<id>` may declare a `"gateRooms": ["Room A", "Room B", ...]` array — an ordered list of real room display names (matching `globalThis.state.utils.ROOM_NAME` values) the player must reach, in sequence, to fully complete that mission. A single-entry array just means "must be reachable to start"; a multi-entry array is a room-hopping chain (e.g. `svenson_love_story`: Folda Boat → White Wave Cellar → Underground Lake → Awash Steamship). Omit the field (or leave it empty) for a mission with no room requirement — either it's always available, or it's gated purely by another mission's completion/item (handled by that mission's own existing code, not this map).

**Do not hand-roll `isRoomUnlockedByName(...)` checks per mission.** `Quests.js` hydrates this into `MISSION_GATE_ROOMS_MAP` (in `applyMissionRegistryMaps()`) and exposes one canonical set of helpers right next to `isRoomUnlockedByName()`:

| Function | Use |
|---|---|
| `getMissionGateRooms(mission)` | The mission's full gate-room chain (array, possibly empty) |
| `getMissionLockRoomName(mission)` | The **first** gate room only — this is what gates *starting* the mission. `null` if no gate. |
| `isMissionUnlocked(mission)` | `true` if the mission has no gate, or its first gate room has been reached — call this before letting an NPC offer/accept a mission |
| `isMissionRoomStageUnlocked(mission, stageIndex)` | Checks one specific leg of a multi-room chain (0-based index into `gateRooms`) — call this at each "now go to the next room" dialogue checkpoint in a chain mission, so the NPC can say "you're not ready for that yet" instead of pointing the player at a room they haven't unlocked yet |

**Wiring pattern for a new (or existing) mission's accept flow:**
```js
if (!isMissionUnlocked(mission)) {
  const lockRoom = getMissionLockRoomName(mission);
  showToast({ message: TOAST_MESSAGES.missionLocked(lockRoom), logPrefix: '[Quests Mod][<Your NPC>]' });
  return; // don't set accepted:true, don't advance the conversation
}
```
This is already wired into `startKingTibianusQuestForMission()`, the single chokepoint for every King-given mission — it covers `king_copper_key`, `king_monks_study`, and `king_scarab_coin` for free. **Every other NPC's own accept/offer flow (Al Dee, Costello, Wyda, Svenson, Elathriel, Tesha, Rookstayer, Santa Claus, Dane, The Oracle, Basilisk) still needs this same check added at its own accept point** — there is no single shared chokepoint for non-King NPCs today, so this is a per-NPC retrofit using the exact snippet above. Mission-triggered-by-right-clicking-a-tile-in-a-specific-room (e.g. `visiting_the_cleric`'s Green Tome pickup) does **not** need this check — the game's own room-selection already makes the tile unreachable if the room isn't unlocked, so the lock would be redundant there. It's only needed where a mission is offered purely through **chat**, regardless of where the player currently stands.

**Known gap:** the King's mission-list modal ("Missions" tab) currently only lists missions that are already `accepted` — there's no listing of not-yet-started missions to visually grey out yet. Adding one (to show upcoming/locked missions before they're accepted) is a separate, not-yet-done UI enhancement; `isMissionUnlocked()` is ready to drive it whenever that list is built.

---

### `npcs.json`

| Section | Purpose |
|---------|---------|
| `king-tibianus`, `al-dee`, … | `keywords`, `confusion`, NPC-specific extras |
| `shared` | `keywords` merged **under** every NPC's own map in `applyQuestDialogueFromAssets()` (`NPC_SHARED_KEYWORDS`) — generic transcript lines (gamemaster / isle of solitude / gm island). NPC-specific keys override. Keep keys distinctive (substring match, no bare `gm`). |
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

Map Editor quest export may add a section with `roomName`, `roomId`, `mapFile`, `battleId`, and optional `sceneSpriteReplacements`. Keep full tile data in the `mapFile` bundle — not inline in `rooms.json`.

Chat-triggered "teleport into a re-skinned room" scenes (`hellgateLibrary`, `draconiaTower`, `isleOfSolitude`) instead store the re-skin as an inline `tileMutations` map (tile-keyed `remove`/`add`/`hitbox`) applied at runtime via `startPersistentVisualSync`. `isleOfSolitude` is the **Isle of Solitude / GM Island** easter egg: ask King Tibianus about "isle of solitude" or "gm island" (`npcs.json` → `king-tibianus.keywords`; he asks for a "yes" before teleporting — wired in `sendMessageToKing()` via `awaitingIsleConfirm`), walk around the Sewers re-skin, right-click the ladder on tile 37 for a "Use the teleporter" context menu back to the room you came from. "Muhamad" stands on tile 38 wearing `GMOutfit.png` (decorative dummy + `createSignReaderSystem` green right-click line). No mission; `battles.json` → `isle_of_solitude` is an empty (villain-less) sandbox stub.

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
3. Work out the mission's gate room(s) and place it in `registry.storyOrder` per "Ordering new missions in `storyOrder`" above.
4. Add `registry.missions.<id>` (`stateKey`, `firebaseKey`, `extraFields` if needed, and `gateRooms` if it has a room requirement — see "Locking a mission behind an unlocked room" above).
5. Wire the `isMissionUnlocked(mission)` check into your NPC's accept/offer flow if the mission has a `gateRooms` entry and is offered via chat (skip if it's only triggered by right-clicking a tile in its own gate room — that's already self-gating).
6. Add `completionSummaries.<id>` if the quest log needs a custom summary.
7. Add `kingChatState` progress field in `Quests.js` if the mission uses Firebase progress (or extend code generation later).
8. Wire NPC/battle/room handlers in `Quests.js` as needed.
9. If the mission grants an item: `items.json` → `products`, drops/lifecycle/devTools as needed; add icon file to `assets/quests/`.
10. If custom battle: `battles.json` entry.
11. If new placements: `rooms.json` section.
12. Quest log icon: `items.json` → `questLogIcons` or `questLogSpriteIcons`.

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
