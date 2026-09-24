# Quest mod data (`assets/quests`) — single source of truth

This is the **one** reference for the **Quests** mod (`mods/OT_Mods/Quests.js`): the JSON schema for
every file in this folder, the reusable Board-NPC / teleport-battle-quest patterns, the item-lifecycle
reconciliation system, and checklists for adding new content. It replaces the former
`docs/quests_data.md` and `docs/quest_item_backpack_audit.md` (both retired/merged in here) — link here,
not to those.

Runtime logic stays in JavaScript; copy, numbers, placements, and item definitions live here. Everything
is loaded once at startup via `loadQuestDialogueAssets()` (parallel `fetch` of all JSON files, one
`apply*FromAssets()` function per file). Images are resolved with `getQuestItemsAssetUrl(filename)` —
paths are **flat** under `/assets/quests/`, no subfolders.

## Contents

1. [Folder layout](#folder-layout-current)
2. [Map Editor → Quests export](#map-editor--quests-export)
3. [Adding a talking-only Board NPC](#a-a-talking-only-board-npc-no-quest-yet-or-a-permanent-side-npc)
4. [Adding a Sewers-reskin teleport-battle quest](#b-a-sewers-reskin-teleport-battle-quest-walk-around-room-or-actual-fight)
5. [File reference](#file-reference) (`config`, `missions`, `npcs`, `items`, `battles`, `rooms`, `toasts`)
6. [Ordering new missions in `storyOrder`](#ordering-new-missions-in-storyorder)
7. [Locking a mission behind an unlocked room](#locking-a-mission-behind-an-unlocked-room)
8. [Item icons: sprite id vs. gif](#item-icons-sprite-id-vs-gif)
9. [Item-lifecycle reconciliation](#item-lifecycle-reconciliation-quest-item--progression-audit)
10. [What stays in `Quests.js`](#what-stays-in-questsjs)
11. [Adding a new mission (checklist)](#adding-a-new-mission-checklist)
12. [Gotchas learned the hard way](#gotchas-learned-the-hard-way)
13. [Organization recommendations](#organization-recommendations)
14. [Related docs](#related-docs)

---

## Folder layout (current)

```
assets/quests/
├── config.json       # Timing, modal sizes, UI chrome, Firebase URL
├── missions.json     # Missions, registry, completion summaries, seal transcripts
├── npcs.json         # NPC keyword/confusion dialogue, quest-item chat
├── items.json        # Products, drops, quest log icons, dev tools, lifecycle rules
├── battles.json      # Custom battle setups (tiles, villains, spawn rules)
├── rooms.json        # Room/tile/NPC placement, fishing/mining/seals, tile mutations
├── toasts.json       # Toast copy, builders, variant styling, battle log prefixes
├── README.md          # This file
└── *.gif / *.png     # Icons, NPC portraits, effects (same directory as JSON)
```

| Kind | Count (approx.) | Notes |
|------|-----------------|-------|
| JSON data files | 7 | Each core file has a `_sections` key documenting top-level blocks (ignored at runtime) |
| Image assets | ~50 | Filenames referenced from `items.json` → `products.icon`, hardcoded in `Quests.js`, or `questLogIcons` |

**Do not split JSON into subfolders** without updating `fetchQuestJsonAsset()` in `Quests.js`. **Do not move
images into subfolders** without updating every `icon` field, `getQuestItemsAssetUrl()` call, and
`manifest.json` (paths are filename-only today).

---

## Map Editor → Quests export

Use **Copy export JSON** in Map Editor. Output shape (`map-editor-bundle-v1` wrapped in a
`questExport` block with a `_howto` array of next steps generated for you). For a **tile-mutation reskin**
(the common case — most quest areas reuse the `Sewers` room, `roomId: 'rkswrs'`), the export's
`questExport.rooms.<key>.tileMutations` is already in the exact shape `rooms.json` expects — paste it in
directly, no separate map-bundle file needed (see [Adding a teleport-battle quest](#b-a-sewers-reskin-teleport-battle-quest-walk-around-room-or-actual-fight)
below for the full checklist). `questExport.battles.<key>` similarly pastes straight into `battles.json`.

**Always rename the generated key.** The Map Editor guesses a generic key like `"sewers"` from the room's
display name — check `battles.json`/`rooms.json` first (`grep -n '"<name>"' assets/quests/*.json`) since
the Sewers room hosts many unrelated quests and key collisions silently overwrite each other's config.

If the export includes a placeable "ally" creature standing in for an NPC you actually want to be a fixed
talking character (not player-controlled), replace it with a [Board NPC](#a-a-talking-only-board-npc-no-quest-yet-or-a-permanent-side-npc)
entry instead — see the `avarTar` NPC for a worked example of exactly this substitution.

---

## A. A talking-only Board NPC (no quest yet, or a permanent side-NPC)

This is a small overlay (native outfit sprite, custom sprite sheet, or a plain gif) placed on a specific
tile, with a keyword-driven chat modal. Reference implementations: `oldrak`, `basilisk`, `bonelord`,
`a-prisoner`, `avarTar`. Everything is driven by one shared array, `BOARD_NPC_CONFIGS` (Quests.js), and
one shared modal, `showBoardNpcKeywordModal()` — you are adding *data* and *one dispatch branch*, not new
placement/DOM code.

Checklist (mirrors how Avar Tar was added):

1. **`rooms.json` → `boardNpcs.<key>`**: `{ id, name, roomName, roomId, tileIndex, outfitSpriteId?, dialogueIconUrl? }`.
   Set `outfitSpriteId` to render the NPC as a native game outfit (e.g. `73` = the generic "hero" outfit,
   used by Avar Tar; `57` = Oldrak's old-man outfit) — this is what most NPCs use. Omit it entirely only
   for a pure-GIF NPC with no matching native outfit (board sprite = `imageUrl`, set directly in the
   `BOARD_NPC_CONFIGS` entry, not hydrated from JSON).
2. **Quests.js — module constants**: add `BOARD_NPC_<X>_ID`, `<X>_NPC_NAME`, `<X>_TILE_INDEX`,
   `<X>_OUTFIT_SPRITE_ID` (if using an outfit), `<X>_OVERLAY_CLASS` (a unique CSS class per NPC),
   `<X>_DIALOGUE_ICON_URL`, `<X>_RESPONSES = {}`, `<X>_CONFUSION_RESPONSES = []`, near the other
   `let`/`const` NPC blocks.
3. **Quests.js — hydration block**: add an `if (board.<key>) { ... }` block inside the `boardNpcs`
   section of `applyQuestRoomsFromAssets()` (mirrors `board.oldrak`/`board.avarTar`), including
   `if (board.<key>.outfitSpriteId != null) <X>_OUTFIT_SPRITE_ID = board.<key>.outfitSpriteId;` if used.
4. **Quests.js — `BOARD_NPC_CONFIGS` entry**: push a new object (`id`, `name`, `tileIndex`, `roomId`,
   `roomName`, `overlayClass`, `outfitSpriteId` *and/or* `imageUrl: getQuestItemsAssetUrl('<X>.gif')`,
   `dialogueIconUrl`, `logPrefix`, `chatMode: 'keywords'`, `isUnlocked`, `isInteractable`, `chat: {}`,
   `hpBarColor`/`nameColor`). When both `outfitSpriteId` and `imageUrl` are set, the outfit wins for the
   **board** sprite and `imageUrl` wins for the **chat modal portrait** — see Gotcha #2 below.
   `isInteractable` only toggles the small fight.png-style badge on the name tag — return `false` if the
   NPC has no quest action yet.
5. **`npcs.json` → `<key>`**: `{ keywords: {...}, confusion: [...], boardChat: { welcomeMessage, placeholder } }`.
   `keywords` values may be a string or a `string[]` (multi-line reply). The literal word `Player` in any
   line is auto-replaced with the real player name (`matchKeywordResponsesSync`).
6. **Quests.js — `npcBindings`** (inside `applyQuestDialogueFromAssets()`): add
   `['<key>', (npc) => { <X>_RESPONSES = {...(npc.keywords||{})}; <X>_CONFUSION_RESPONSES = [...(npc.confusion||[])]; }]`,
   **and** add the shared-keyword merge line right after the `npcBindings` loop:
   `<X>_RESPONSES = { ...NPC_SHARED_KEYWORDS, ...<X>_RESPONSES };` (lets every NPC answer common lines
   like "gamemaster"/"isle of solitude" without repeating them).
7. **Quests.js — `patchBoardNpcChatFromDialogue()`**: add `patch('<key>', <X>_OVERLAY_CLASS, BOARD_NPC_<X>_ID);`
   so `boardChat.welcomeMessage`/`placeholder` actually reach the modal.
8. **Quests.js — keyword wrapper + dispatch branch**: add
   `function get<X>KeywordResponse(message, playerName) { return matchKeywordResponsesSync(<X>_RESPONSES, message, playerName, { defaultResponse: null, lowercaseKeys: true }); }`
   near the other `get*KeywordResponse` functions, **and** a dispatch branch inside
   `showBoardNpcKeywordModal()`'s `reply()` function:
   ```js
   if (npcConfig.id === BOARD_NPC_<X>_ID) {
     let line = get<X>KeywordResponse(text, playerName);
     if (line == null) line = getRandomNpcConfusionResponse(<X>_CONFUSION_RESPONSES, playerName);
     cooldown.queueResponse(text, line, addMessageToConversation, npcConfig.name,
       isNpcFarewellMessage(text) ? ModalHelpers.getFarewellCloseCallback(text) : undefined);
     return;
   }
   ```
   **This step is not optional** — see Gotcha #1 below.

## B. A Sewers-reskin "teleport battle quest" (walk-around room or actual fight)

Most quest areas reuse the same `Sewers` room (`roomId: 'rkswrs'`) redecorated with a `tileMutations` map,
reached by right-clicking an arrow tile somewhere else. Reference implementations: `visitingTheCleric`
(Oldrak's temple, no battle), `hellgateTreasureRoom`/`hellgateLibrary`/`draconiaTower` (actual fights),
`avarTarHideout` (no battle, general transcripts only). The shared factories are
`createTeleportBattleQuest()` (tile-mutation apply/restore/scene-sync) and `createArrowTileMenuAction()`
(arrow overlay + right-click "go here" menu) — you wire config into these, not new DOM/observer code.

Checklist:

1. **Get the `tileMutations` map** from the Map Editor export (see above). Per-tile shape:
   `{ remove: [spriteId,...], add: [{spriteId, cropX?, cropY?, cropped?, bank?, offsetX?, offsetY?}], hitbox?: bool, floorBelow?: [...] }`.
   `remove` hides original sprites, `add` injects new ones as native `sprite item relative id-N` markup,
   `hitbox` overwrites walkability for that tile, `floorBelow` draws under the tile.
2. **Pick a unique `battleId`** (see the key-collision warning above).
3. **`rooms.json` → `<roomKey>`**: `{ _comment, battleRoomName: "Sewers", battleRoomId: "rkswrs", battleId, battleDisplayName, tileMutations }`.
4. **`battles.json` → `<battleId>`**: `{ allyLimit, preventVillainMovement: true, hideVillainSprites: true,
   villains: [...] (empty for a walk-around), allowedTiles?, allowedTilesMessage? }`. Real villains follow
   the `spider_lair`/`hellgate_treasure_room` shape (`nickname`, `tileIndex`, `fallbackGameId`, `level`,
   `direction`, `genes`, optional `equip`).
5. **Quests.js — the whole quest block**, mirroring `visitingTheCleric`/`avarTarHideout` end to end:
   - module constants (`<X>_ROOM_NAME/ID`, `<X>_BATTLE_ID`, `<X>_DISPLAY_NAME`, `<X>_TILE_MUTATIONS = null`,
     `playerEntered<X> = false`, `<x>Battle = null`, `<x>SceneSub = null`) + hydration block,
   - `const <x>Quest = createTeleportBattleQuest({ logPrefix, addedAttr, hiddenTag, mutationKeyAttr, floorBelowKeyAttr, getTileMutations, isEntered, getBattle, getSceneSub, setSceneSub, roomName })`,
   - thin wrappers: `apply<X>TileMutations` (also clears `boardConfig` — see `clearAvarTarHideoutBoardPieces`),
     `restore<X>TileMutations`, `stop<X>SceneSync`, `start<X>SceneSync`, `restoreBoardSetup<X>`,
   - a board-clear watcher (`setup<X>BoardClearWatcher`/`cleanup<X>BoardClearWatcher`) — covers the gap
     before any CustomBattle instance exists,
   - `create<X>BattleInstance(roomId)` / `initialize<X>Battle(roomId)` (uses `getHydratedQuestBattleSpawn`,
     `window.CustomBattles.create`, `activationCheck: (isSandbox, inBattleArea) => isSandbox && inBattleArea && playerEntered<X>`),
   - `setup<X>PreBattle(battle)` (calls `.setup()`, `.resetSandboxBattleState()`, `.setupAllyLimit?.()`, and
     **`.startPersistentVisualSync(apply<X>TileMutations, { isActiveCheck: () => playerEntered<X> })`** — do
     not hand-roll a retry burst or your own `board.subscribe()` for repainting, this call already does it),
   - `enter<X>(...)` (sets the entry flag, `selectRoomById`, starts scene sync, inits the battle, shows a toast),
   - `cleanup<X>Quest()` (mirrors `cleanupVisitingTheClericQuest`/`cleanupAvarTarHideoutQuest`).
6. **Arrow entry point** (if reached by right-clicking a tile elsewhere): a `shouldEnable<X>Arrow()` guard
   + `const <x>ArrowTileAction = createArrowTileMenuAction({ id, roomName, tileIndex, shouldEnable, buttonText, onClick: () => enter<X>(), arrowClass, imageFilename? })`,
   then `setup<X>ArrowObserver = <x>ArrowTileAction.setupObserver` / `cleanup<X>ArrowSystem = <x>ArrowTileAction.cleanup`.
   `imageFilename` is optional — omit it for the default `Tutorial_Arrow_Effect.gif`, or pass a
   different filename (e.g. `'Tile_Highlight_Effect.gif'`, used by the Parchment Room's hole tile)
   for a different visual. Or pass `glowTarget: (tile) => element` to make an object already on the tile
   (e.g. an injected door sprite) glow in rainbow colours in place (`.quests-rainbow-glow`), with no
   overlay at all. The Demon Helmet gate door (tile 52) uses this.
7. **Leaving via the room picker** (not a dedicated exit tile): add a branch to the big "Overlay Hider"
   room-change watcher in Quests.js (search `Leaving Visiting the Cleric temple` for the exact spot):
   `if (lastOverlayHiderRoomName === <X>_ROOM_NAME && currentRoomName !== <X>_ROOM_NAME && (playerEntered<X> || <x>Battle) && !<x>Battle?.isRoomReloadInProgress?.()) cleanup<X>Quest();`
8. **Wire into the master init/cleanup lists** — both `setup<X>ArrowObserver()`/`setup<X>BoardClearWatcher()`
   (init) and `cleanup<X>ArrowSystem()`/`cleanup<X>Quest()`/`cleanup<X>BoardClearWatcher()` (cleanup) must
   be added to the two big lists near the bottom of Quests.js (search `setupClericArrowObserver()` /
   `cleanupClericArrowSystem()` for the exact spot). Forgetting this means your quest silently never arms
   on a soft reload / mod re-enable.

**Variant — "win the fight, then loot something in the same room" (Parchment Room Quest):** by
default, `victoryDefeat.onClose` should call the real `cleanup<X>Quest()` and navigate elsewhere
(see `enterNecromantHouse`'s `onClose`). If instead the player needs to stay in the reskinned
room after winning — to right-click a tile for a reward, e.g. a coffin — do NOT tear the quest
down from `onClose` at all:
- `onVictory`: persist `battleCompleted: true`, then despawn the villains **properly** —
  ```js
  if (myBattle) {
    myBattle.config.villains = [];
    myBattle.resetSandboxBattleState();
    myBattle.forceImmediateBoardRewrite();
  }
  ```
  **Do NOT** use a raw `globalThis.state.board.send({ type: 'setState', fn: (prev) => ({ ...prev, boardConfig: [] }) })`
  wipe — villain *and* ally pieces both live in the same `boardConfig` array, so a blunt wipe
  also deletes the player's own team (breaks the "Creatures allowed: N/M" status toast, which
  counts `boardConfig`), **and it doesn't even stick**: the engine's own villain-resync watchers
  (`syncCustomVillainsIfNeeded` / `autoSetupVillainSyncHandler`, `content/custom-battles.js`)
  rebuild villains from `config.villains` the instant `gameStarted` flips back to `false`.
  Mutating `config.villains` to `[]` *first* means that same rebuild path produces nothing —
  `resetSandboxBattleState()` (clears `gameStarted`, required since `removeOriginalVillains()`
  early-returns while a battle is active) then `forceImmediateBoardRewrite()` (wraps
  `removeOriginalVillains()`, which filters `boardConfig` down to non-villain entities and
  re-adds whatever's now in `config.villains` — nothing) does it via the engine's own path,
  leaving ally pieces untouched.
- `onClose`: just a light `updateAllBoardNpcStates(...)` refresh, nothing else — `playerEntered<X>`
  stays `true`, `startPersistentVisualSync` (set up separately in `setup<X>PreBattle`, not part of
  `victoryDefeat`) keeps repainting the reskin regardless of the modal closing.
- Add a `createRoomTileMenuAction({...})` for the reward tile, gated on
  `playerEntered<X> && progress.battleCompleted && !progress.<itemFlag>`, granting the item via
  `addQuestItem` + `playRightClickLootEffect` + persisting `<itemFlag>: true`.
- **Persist the "villains are gone" state, don't just clear it for this session**: in
  `create<X>BattleInstance(roomId)`, read `getMissionProgress(mission)?.battleCompleted` and pass
  `villains: alreadyCleared ? [] : spawn.villains` — otherwise leaving and re-entering (down the
  same hole/arrow) respawns a fresh set of villains even though the player already won.
- The *real* teardown only happens via the normal room-picker Overlay Hider branch (step 7) when
  the player actually leaves — same as any other teleport-battle quest.
- `reloadRoomOnClose: true` (used by Apprentice Sheng / The Lost Oracle) is a DIFFERENT thing — it
  bounce-bomb-reloads the room right after `onClose` runs full teardown, purely to force a clean
  DOM refresh. It does not keep villains cleared while leaving the reskin/quest state alive, so
  it is not what you want for this pattern.

**Variant — "gate behind a real room, don't auto-teleport on accept" (also Parchment Room Quest):**
if the quest should only be offered/enterable after the player has cleared some real, already-existing
room (not a Sewers reskin), add `"gateRooms": ["<real room display name>"]` to the mission's
`registry.missions.<id>` entry (see [Locking a mission behind an unlocked room](#locking-a-mission-behind-an-unlocked-room))
and check `isMissionUnlocked(mission)` right before arming the `awaiting<X>Confirm` prompt — same
wiring as any other chat-offered, room-gated mission. Separately, if accepting shouldn't teleport
the player in immediately (they should walk to/interact with an entry point themselves first, even
one inside the quest-giver's own room): don't call `enter<X>()` from the "yes" branch at all — instead
arm a `createArrowTileMenuAction({..., imageFilename: 'Your_Effect.gif'})` on the entry tile (pass
`imageFilename` to use something other than the default `Tutorial_Arrow_Effect.gif`), gated on
`progress.accepted && !progress.completed`, with `onClick: () => enter<X>()`. Call
`<x>EntryTileAction.update(...)` right after persisting `accepted: true` so it appears without
waiting for the next unrelated board-state change.

---

## File reference

### `config.json`

Mod tuning that is not quest-specific. Applied by `applyQuestConfigFromAssets()`.

| Section | Purpose |
|---------|---------|
| `timing` | Button polling, observer debounce, NPC chat delays |
| `modal` | Quest modal dimensions (King, NPC chat, quest items, arena leaderboard) |
| `ui` | Frame URLs, cursor/title strings, king chat row height |
| `firebase` | Realtime Database base URL for mission progress |

### `missions.json`

| Section | Purpose |
|---------|---------|
| `common` | Shared dialogue lines (`errorGeneric`, etc.) |
| `missions` | Per-mission objects keyed by mission id |
| `completionSummaries` | Quest log "completed" blurbs |
| `sealTranscripts` | Costello diary seal incomplete/complete lines |
| `registry` | `storyOrder`, `missions` → `stateKey`, `firebaseKey`, `extraFields`, `gateRooms` |

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

Hydrated into `MISSION_BY_ID` via `applyQuestDialogueFromAssets()`. Registry drives `MISSION_STATE_MAP`,
Firebase keys, and quest log order.

### `npcs.json`

| Section | Purpose |
|---------|---------|
| `king-tibianus`, `al-dee`, …, `avarTar` | `keywords`, `confusion`, NPC-specific extras |
| `shared` | `keywords` merged **under** every NPC's own map in `applyQuestDialogueFromAssets()` (`NPC_SHARED_KEYWORDS`) — generic transcript lines (gamemaster / isle of solitude / gm island). NPC-specific keys override. Keep keys distinctive (substring match, no bare `gm`). |
| `costello` | Includes `sealPatterns` and `sealGuidanceFallback` |
| `questItems` | Per-NPC lines when player mentions a quest item |
| `questItemUninvolvedTemplates` | `{item}` template when NPC has no specific line |

**The "time" keyword is a code interception, not a JSON line.** `getCurrentClockTimeString()` (Quests.js,
outside the mod's main IIFE so both the older King-chat NPCs and the newer Board NPCs can call it) formats
the player's real local clock time ("9:45 am"). NPCs that actually answer with a clock value (Oldrak, Avar
Tar, Al Dee) intercept `message.includes('time')` in their `get<X>KeywordResponse`/`get<X>Response`
wrapper *before* falling through to the JSON keyword map, and have **no `"time"` key in `npcs.json`** —
adding one would be dead code, shadowed by the interception. NPCs whose personality is to deliberately
*not* answer with a time (Wyda, Tesha, Dane, Elathriel, A Prisoner, King Tibianus) keep a plain static
`"time"` line in JSON instead — don't convert those, the non-answer is the joke.

### `items.json`

| Section | Purpose |
|---------|---------|
| `products` | Canonical `productName`, `icon`/`spriteId`, `description`, `rarity`, `maxCount` |
| `creatureDrops` | Creature gameId → drop tables |
| `rookgaardGlobal` | Shared Rookgaard drop pool |
| `questItemChatEntries` | Keyword → quest item id for chat matching |
| `questLogIcons` / `questLogSpriteIcons` | Mission id → icon filename or board sprite id |
| `devTools.items` | Quest Dev Tools grant list (story order) |
| `itemLifecycle` | `cleanupRules`, `staleCleanupOnComplete`, `soulCoreGrantOnComplete` — see [Item-lifecycle reconciliation](#item-lifecycle-reconciliation-quest-item--progression-audit) |

**Adding a grantable dev item:** define `products.<id>`, add to `devTools.items`, and optionally
`itemLifecycle.soulCoreGrantOnComplete`. See [Item icons](#item-icons-sprite-id-vs-gif) for `icon` vs
`spriteId`.

### `battles.json`

Keyed by battle id (matches mission or encounter id). Defines ally limits, allowed tiles, villain spawns,
nicknames, and battle-specific messages. Consumed by `getQuestBattleConfig(battleId)` /
`getHydratedQuestBattleSpawn(battleId)`.

### `rooms.json`

World placement and minigame config: fishing, mining, desert dig, room names, tile indices, sprite ids,
Board NPC positions (`boardNpcs.<key>`), seven seals, ghazbaran hideout, `kingArenaRanks`, tile success
effect URLs, and every quest area's `tileMutations` reskin map. Hydrated by `applyQuestRoomsFromAssets()`
into module-level variables used by observers and tile handlers.

Chat/arrow-triggered "teleport into a re-skinned room" scenes (`hellgateLibrary`, `draconiaTower`,
`isleOfSolitude`, `visitingTheCleric`, `avarTarHideout`) store the re-skin as an inline `tileMutations` map
(tile-keyed `remove`/`add`/`hitbox`/`floorBelow`) applied at runtime via `startPersistentVisualSync` — see
[section B](#b-a-sewers-reskin-teleport-battle-quest-walk-around-room-or-actual-fight) above. `isleOfSolitude`
is the **Isle of Solitude / GM Island** easter egg: ask King Tibianus about "isle of solitude" or "gm
island" (`npcs.json` → `king-tibianus.keywords`; he asks for a "yes" before teleporting — wired in
`sendMessageToKing()` via `awaitingIsleConfirm`), walk around the Sewers re-skin, right-click the ladder on
tile 37 for a "Use the teleporter" context menu back to the room you came from. "Muhamad" stands on tile 38
wearing `GMOutfit.png` (decorative dummy + `createSignReaderSystem` green right-click line). No mission;
`battles.json` → `isle_of_solitude` is an empty (villain-less) sandbox stub.

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

## Ordering new missions in `storyOrder`

`registry.storyOrder` is sorted by **real unlock progression**, not by when the mission was added to the
file. The method (see `registry._storyOrderComment` in the JSON for the short version):

1. **Resolve the mission's gate room(s)** — the room(s) the player must have already reached to
   start/progress it. Use the live game data to place a room: open DevTools on the loaded game and run
   ```js
   globalThis.state.utils.REGIONS.map((r, i) => ({ i, id: r.id, rooms: r.rooms.map((room, j) => ({ j, id: room.id, name: globalThis.state.utils.ROOM_NAME[room.id] })) }))
   ```
   A room's position is `(regionIndex, roomIndexWithinRegion)` — lower is earlier. Watch for flavor text
   that doesn't match a real room name (e.g. "Rotworm Dungeon" isn't an actual room; check the code/
   `rooms.json` for the room it's actually implemented in) and for a quest's *battle* room being a reused
   `Sewers` reskin — the real gate is wherever the player physically travels to trigger it, not the reused
   battle room.
2. **Cluster by quest-giver.** All of one NPC's missions move together as a block, positioned by whichever
   of that NPC's own missions unlocks soonest — don't scatter one NPC's quests across the list by each
   quest's individual room. King Tibianus is the exception: he has no single unlock point (he's available
   from the very start), so his *solo* missions are NOT one cluster — each sorts by its own gate,
   **except** the ones with zero cross-NPC prerequisite (see step 3), which do sit together at the very top.
3. **Check for a hard cross-NPC prerequisite** (an item from another NPC's reward, or "meeting" an NPC for
   the first time via another mission) and pin the dependent mission/cluster immediately after whichever
   prerequisite it needs, even if its own room would otherwise sort earlier. Search `missions.json` for
   `"requires[A-Z]` and search `Quests.js` for `canOffer` / `cachedQuestItems\[` gating an NPC's offer —
   both patterns surface these. Known examples already in the data: `al_dee_golden_rope`→Holy Tible→
   `king_monks_study`; `al_dee_fishing_gold`→Light Shovel→`king_scarab_coin`; `king_scarab_coin`→meeting
   Tesha→`serpentine_tower`/`realm_of_dreams`; `realm_of_dreams`→Mintwallin Prison Key→
   `visiting_mintwallin`; `king_letter_al_dee`→"the stamped letter"→the rest of the Al Dee chain.
4. Missions with **no gate at all** (generic drops available from anywhere, e.g. `king_red_dragon`) sort
   with whichever no-gate cluster they narratively belong to — don't force them into a room-based position
   they don't have.

## Locking a mission behind an unlocked room

Each mission entry in `registry.missions.<id>` may declare a `"gateRooms": ["Room A", "Room B", ...]`
array — an ordered list of real room display names (matching `globalThis.state.utils.ROOM_NAME` values)
the player must reach, in sequence, to fully complete that mission. A single-entry array just means "must
be reachable to start"; a multi-entry array is a room-hopping chain (e.g. `svenson_love_story`: Folda Boat
→ White Wave Cellar → Underground Lake → Awash Steamship). Omit the field (or leave it empty) for a
mission with no room requirement — either it's always available, or it's gated purely by another mission's
completion/item (handled by that mission's own existing code, not this map).

**Do not hand-roll `isRoomUnlockedByName(...)` checks per mission.** `Quests.js` hydrates this into
`MISSION_GATE_ROOMS_MAP` (in `applyMissionRegistryMaps()`) and exposes one canonical set of helpers right
next to `isRoomUnlockedByName()`:

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
This is already wired into `startKingTibianusQuestForMission()`, the single chokepoint for every
King-given mission — it covers `king_copper_key`, `king_monks_study`, and `king_scarab_coin` for free.
**Every other NPC's own accept/offer flow (Al Dee, Costello, Wyda, Svenson, Elathriel, Tesha, Rookstayer,
Santa Claus, Dane, The Oracle, Basilisk) still needs this same check added at its own accept point** —
there is no single shared chokepoint for non-King NPCs today, so this is a per-NPC retrofit using the
exact snippet above. Mission-triggered-by-right-clicking-a-tile-in-a-specific-room (e.g.
`visiting_the_cleric`'s Green Tome pickup) does **not** need this check — the game's own room-selection
already makes the tile unreachable if the room isn't unlocked, so the lock would be redundant there. It's
only needed where a mission is offered purely through **chat**, regardless of where the player currently
stands.

**Known gap:** the King's mission-list modal ("Missions" tab) currently only lists missions that are
already `accepted` — there's no listing of not-yet-started missions to visually grey out yet. Adding one
(to show upcoming/locked missions before they're accepted) is a separate, not-yet-done UI enhancement;
`isMissionUnlocked()` is ready to drive it whenever that list is built.

---

## Item icons: sprite id vs. gif

Prefer a **native atlas sprite** (`"spriteId": N, "iconUrl": "https://bestiaryarena.com/assets/ITEM/N.png"`)
over a hand-made gif when the item already exists as an in-game sprite — see `destroyFieldRune`,
`honeyflower`, `scarabCoin` in `items.json`. `createProductIcon()` (Quests.js) automatically renders the
correct markup: a `<div class="sprite item relative id-N">` shell at ≥32px, or the flat `iconUrl` PNG at
smaller sizes (atlas crop math doesn't scale down cleanly). Only fall back to a gif (`"icon": "X.gif"`, no
`spriteId`) for something with no native sprite (a custom drawn item/portrait).

The **Quest Log mission-card icon** is a *separate* lookup (`items.json` → `questLogIcons` for a gif
filename, or `questLogSpriteIcons` for a sprite id — sprite id wins if both would apply). A product's own
`spriteId` does **not** automatically become its mission's quest-log icon; set `questLogSpriteIcons.<missionId>`
too if you want that.

---

## Item-lifecycle reconciliation (quest-item ↔ progression audit)

> **Status: applied in 4.9.12.** Every gap identified in the original audit now has a rule in
> `assets/quests/items.json` → `itemLifecycle`. This section is the durable reference for **how the
> reconciliation system works** and **what each existing rule guards** — read it before adding a new
> consumable/rewarded quest item so you add the matching rule(s) instead of leaving a gap.

**Goal:** on init, derive the **exact** quest-item backpack a player *should* hold from their mission
progress, and add/remove to match.

### How reconciliation works

`loadQuestItemsOnInit()` (Quests.js) runs, after mission-progress hydrate:

| Function | Rule list (`itemLifecycle.*`) | Direction | Keys off |
|---|---|---|---|
| `cleanupInvalidQuestItems()` | `cleanupRules` | **remove** item if mission not at `requiredStatus`; `removeWhenCompleted` also strips it once done | mission `accepted` / `completed` only (or `requiredProgressFlag`) |
| `cleanupStaleQuestItemsAfterCompletedMissions()` | `staleCleanupOnComplete` | **remove** item once its linked mission is `completed`, or (with `whenField`) once a specific sub-flag is set | mission `completed`, or `whenField` sub-progress (via `MISSION_FIREBASE_KEY_MAP`) |
| `backfillSoulCoresFromCompletedMissions()` | `soulCoreGrantOnComplete` | **add** item if mission `completed` (or `grantWhenField` sub-flag) and count 0; `removedByMissionId` / `removedByProgressFlag` stops the backfill once a follow-up is accepted/completed or a sub-flag fires | mission `completed`/`grantWhenField`; follow-up `accepted`/`completed`/flag |

`backfillSoulCoresFromCompletedMissions()` is fully generic (it just calls `addQuestItem`) — the "soul
core" name is historical. It is the natural home for **every** "you earned this, you don't have it, here
it is" rule.

**Order matters**: `cleanupInvalidQuestItems` → stale → backfill, backfill last, so a rule that both strips
(wrong source state) and grants (right state) can't fight itself in one pass.

`reconcileQuestItemsFromProgress({ label })` (Quests.js, right after `backfillSoulCoresFromCompletedMissions`)
runs all three passes plus a modal/tab refresh. It runs automatically at the end of every
progress-mutating dev command: `QuestsDev.complete`, `.setAccepted`, `.reset`, `.resetAll`, `.completeAll`,
`.resetSanta`, `.setProgressFlag` (the per-mission "Progress flags" toggles), and `.grant(...)` **when the call changed only mission/seal progress** (a `grant` that also
set item counts skips it and logs a hint, so deliberate item edits survive). `QuestsDev.reconcile()` (alias
`questsDevReconcile`) runs it on demand.

- `completeAll` lands on the true "everything finished" bag: `buildDevCompletedMissionProgress` sets every
  consume sub-flag (`orbExchanged`, `bookGiven`, `portalOpened`, `dragonfetishReceived`, …), so reconcile
  strips all consumed items and keeps only permanents. Use `QuestsDev.grant({...})` to put a specific
  consumed item back for testing.
- `reset("<mission>")` + reconcile re-grants a follow-up-consumed item (e.g. resetting `lost_oracle` /
  `king_monks_study` / `dragonmother` re-grants the Orb / Holy Tible / Dragon Claw), so a quest can be
  replayed from a correct bag state.
- Not covered: accept-time items that quest handlers grant inline (Map to the Mines, Obsidian Knife,
  Costello's diary, the Stamped Letter exchange). `setAccepted` won't reproduce those.

### Two structural limitations (now covered by the rule extensions below — kept as the "why")

1. **Sub-progress flags**: `staleCleanupOnComplete` and `removedByMissionId`/backfill originally only saw
   `accepted`/`completed`. Several items are consumed at an *extra field* (`orbExchanged`,
   `plankDelivered`, `bookGiven`, `dragonfetishReceived`, `portalOpened`, …) while the mission is still
   open — `whenField` (stale) and `grantWhenField`/`removedByProgressFlag` (backfill) now cover this.
2. **Grant vs. removal only, not both**: a reward item consumed by a later quest needs *both* a grant rule
   (window: earned → consumed) and a removal rule (after consumed) — `removedByProgressFlag` on
   `soulCoreGrantOnComplete` closes this.

**Gappy-save hardening:** `removedByProgressFlag` and stale `whenField` also count the consumer mission's
own `.completed`; `removedByMissionId` accepts an array and stale rules take `alsoWhenMissionDone: [ids]`
— so a downstream chain mission being accepted/completed (e.g. `realm_of_dreams` done ⇒ the
Elathriel-chain carry items are gone) resolves the item even when the direct consumer mission's sub-flag
was never persisted.

### Rule-shape reference (for adding a new item)

When you add a mission that grants or consumes a quest item, work out its "should-hold window"
(`grant condition && !consume condition`) and add the matching rule(s):

- **Consumed at full mission completion** (simple case): `cleanupRules` entry (`requiredStatus`) +
  `staleCleanupOnComplete` entry (plain `completed`) — see any `none` row in the per-item tables below for
  the pattern.
- **Granted at completion of mission A, consumed at a sub-flag of mission B** (the common "carry item
  between two quest-givers" case):
  - `soulCoreGrantOnComplete`: `{ productId, missionId: "A", removedByProgressFlag: { firebaseKey: "B", field: "subFlag" } }`
  - `staleCleanupOnComplete`: `{ productId, missionId: "B", whenField: "subFlag" }`
  - `cleanupRules`: `{ productId, missionId: "A", requiredStatus: "completed" }` (strip an illegitimate
    copy if mission A isn't actually done)
- **Granted at a sub-flag of mission A** (e.g. `dragonfetishReceived`), not full completion: use
  `grantWhenField` on the `soulCoreGrantOnComplete` rule instead of relying on `completed`.

### Per-item findings (reference — reflects state as of the 4.9.12 audit)

Legend: **G** = grant site, **C** = consume site, **W** = window the item should be in the bag.

<details>
<summary>King Tibianus main line</summary>

| Item (`productId`) | G / C | Should-hold window | Rules |
|---|---|---|---|
| **Map to the Mines** `mapColour` | G: `king_copper_key` accepted · C: on complete | accepted && !completed | cleanup ✅, stale ✅ |
| **Copper Key** `copperKey` | G: tile drop while `king_copper_key` accepted · C: on complete | accepted && !completed | cleanup ✅, stale ✅ |
| **Honeyflower** `honeyflower` | G: tile pickup, `king_honeyflower` accepted · C: on complete | accepted && !completed && honeyflowerPicked | cleanup ✅, stale ✅ |
| **Obsidian Knife** `obsidianKnife` | G: `king_red_dragon` accepted · C: on complete | accepted && !completed | cleanup ✅, stale ✅ |
| **Red Dragon Scale / Leather** `redDragonScale`/`redDragonLeather` | G: creature drops while `king_red_dragon` accepted · C: on complete | accepted && !completed | cleanup ✅, stale ✅ |
| **Dragon Claw** `dragonClaw` | G: on `king_red_dragon` complete · C: on `dragonmother` complete | `king_red_dragon` completed && !(`dragonmother` accepted/completed) | cleanup ✅, stale ✅ (→`dragonmother`), backfill ✅ (`removedByMissionId:"dragonmother"`) |
| **Map/Letter from Al Dee** `letterFromAlDee` | G: Rookgaard global drop · C: stamped exchange / on `king_letter_al_dee` complete | has letter && !completed | cleanup ✅, stale ✅ |
| **Stamped Letter** `stampedLetter` | G: King stamps letter on accept · C: delivered to Al Dee | accepted && !completed | cleanup ✅, stale ✅ |
| **The Holy Tible** `holyTible` | G: on `al_dee_golden_rope` complete · C: on `king_monks_study` complete | `al_dee_golden_rope` completed && !(`king_monks_study` accepted/completed) | cleanup ✅, stale ✅, backfill ✅ (`removedByMissionId:"king_monks_study"`) |
| **Light Shovel** `lightShovel` | G: axe returned, `al_dee_fishing_gold` complete · never consumed (permanent tool) | `al_dee_fishing_gold` completed | cleanup ✅, backfill ✅ (no `removedBy`) |
| **Magnet / Small Axe** `magnet`/`smallAxe` | G/C inside `al_dee_fishing_gold` | accepted && !completed | cleanup ✅, stale ✅ |
| **Iron Ore** `ironOre` | G: dwarf / global drop · C: handed to King, or on `al_dee_fishing_gold` complete | has ore && !fishing concluded | cleanup ✅, stale ✅ |
| **Scarab Coin** `scarabCoin` | G: desert dig, `king_scarab_coin` accepted · C: given to Tesha on complete | accepted && !completed | cleanup ✅, stale ✅, cap ✅ |

</details>

<details>
<summary>Al Dee side line</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Elvenhair Rope** `elvenhairRope` | G: Mornenion victory · C: returned to Al Dee on `al_dee_golden_rope` complete | Mornenion defeated && !completed | cleanup ✅, stale ✅ |
| **Fishing Rod** `fishingRod` | Al Dee shop purchase, not progression-driven | owned | out of scope (not quest progress) |
| **Knarknaknork Soul Core** `knarknaknorkSoulCore` | G: `al_dee_rookie_guard` complete | completed | backfill ✅ |
| **Mornenion Soul Core** `mornenionSoulCore` | G: Mornenion victory | `al_dee_golden_rope` completed (proxy) | backfill ✅ |

</details>

<details>
<summary>Costello / Wyda line</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Costello's diary** `costelloDiary` | G: `costello_queen_banshees` accept · C: on complete | accepted && !completed | cleanup ✅, stale ✅ |
| **Blessed Ankh** `blessedAnkh` | G: on `costello_queen_banshees` complete · C: on `follower_of_zathroth` complete | `costello_queen_banshees` completed && !(`follower_of_zathroth` accepted/completed) | cleanup ✅, stale ✅, backfill ✅ |
| **Spider Silk** `spiderSilk` | G: Old Widow victory · C: given to Wyda on `mother_of_all_spiders` complete | widow defeated && !completed | cleanup ✅, stale ✅ |
| **The Old Widow Soul Core** `oldWidowSoulCore` | G: Old Widow victory | `mother_of_all_spiders` completed (proxy) | backfill ✅ + `syncBosstiaryCollectionFromProgress` |
| **Spool of Yarn** `spoolOfYarn` | G: on `mother_of_all_spiders` complete · C: `svenson_love_story` `awashYarnDelivered` | completed && !awashYarnDelivered | cleanup ✅, stale ✅ (`whenField:"awashYarnDelivered"`), backfill ✅ (`removedByProgressFlag`) |
| **Stuffed Toad** `stuffedToad` | G: on `jakundaf_desert` complete · C: `tainted_souls` `portalOpened` | completed && !portalOpened | cleanup ✅, stale ✅, backfill ✅ |
| **Ekatrix Soul Core** `ekatrixSoulCore` | G: `tainted_souls` complete | completed | cleanup ✅, backfill ✅ |

</details>

<details>
<summary>Tesha line (Serpentine / Realm of Dreams)</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Destroy Field Rune** `destroyFieldRune` | G: tile pickup, `serpentine_tower` accepted · C: Putrid Chamber / on complete | accepted && !putridChamberComplete | cleanup ✅, stale ✅, cap ✅ |
| **Compass** `scorpionSceptre` | G: on `serpentine_tower` complete · C: `svenson_love_story` `undergroundCompassDelivered` | completed && !delivered | cleanup ✅, stale ✅ (`whenField`), backfill ✅ |
| **Key to Magic (Book)** `keyToMagicBook` | G: on `draconia_quest` complete · C: `realm_of_dreams` battle victory (`battleCompleted`) | completed && !battleCompleted | cleanup ✅, stale ✅ (`whenField:"battleCompleted"`), backfill ✅ |
| **Mintwallin Prison Key** `mintwallinPrisonKey` | G: `realm_of_dreams` complete · never consumed (permanent key) | `realm_of_dreams` completed | backfill ✅ |

</details>

<details>
<summary>Rookstayer / Santa / Svenson</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Wooden Plank** `minotaurTrophy` | G: on `apprentice_sheng` complete · C: `svenson_love_story` `plankDelivered` | completed && !delivered | cleanup ✅, stale ✅ (`whenField`), backfill ✅ |
| **Apprentice Sheng Soul Core** `apprenticeShengSoulCore` | G: `apprentice_sheng` complete | completed | backfill ✅ |
| **Wishlist** `wishlist` | G: Goblin drop, auto-accepts `christmas_miracle` · C: on Present grant | has wishlist && !claimed | cleanup ✅, stale ✅ |
| **Present** `present` | G: from Santa, `christmas_miracle` accepted · C: opened → Bunny Slippers | accepted && !opened | cleanup ✅, stale ✅ |
| **Bunny Slippers** `bunnySlippers` | G: open Present, `christmas_miracle` complete · C: `svenson_love_story` `whiteWaveSlippersDelivered` | completed && !delivered | cleanup ✅, stale ✅ (`whenField`), backfill ✅ |

</details>

<details>
<summary>Dane / Oracle line (the Orb chain)</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Orb** `orb` | G: on `weakened_archdemon` complete · C: `lost_oracle` `orbExchanged` → Luminous Orb | completed && !orbExchanged | cleanup ✅, stale ✅ (`whenField`), backfill ✅ |
| **Ghazbaran Soul Core** `ghazbaranSoulCore` | G: `weakened_archdemon` complete | completed | backfill ✅ |
| **Luminous Orb** `luminousOrb` | G: `lost_oracle` `orbExchanged` · C: `lost_oracle` `spectralStoneReceived` → Spectral Stone | orbExchanged && !spectralStoneReceived | stale ✅ (`whenField`), flag-based cleanup/backfill ✅ |
| **Spectral Stone** `spectralStone` | G: `lost_oracle` `spectralStoneReceived` · C: `lost_oracle` `oracleEnraged` (offered to Oracle) | spectralStoneReceived && !oracleEnraged | stale ✅ (`whenField`), same flag pattern ✅ |

</details>

<details>
<summary>Elathriel line (Hellgate → Library → Draconia)</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Key 3012** `key3012` | G: `hellgate_part_1` accept · C: on `draconia_quest` complete | accepted && !completed | stale ✅ (`→draconia_quest`); no `removeWhenComplete` (chain keeps it) |
| **Beware of the Bonelords (Book)** `bewareOfTheBonelordsBook` | G: on `hellgate_part_1` complete · C: `hellgate_library` `bookGiven` | completed && !bookGiven | cleanup ✅, stale ✅ (`whenField`), backfill ✅ |
| **White Mushroom** `whiteMushroom` | G: on `hellgate_library` complete · C: `draconia_tower` `dragonfetishReceived` | completed && !dragonfetishReceived | cleanup ✅, stale ✅ (`whenField` — `draconia_tower` may never reach full `completed`), backfill ✅ |
| **Dragonfetish** `dragonfetish` | G: `draconia_tower` `dragonfetishReceived` · C: `draconia_quest` battle return / complete | dragonfetishReceived && !completed | stale ✅, backfill ✅ (`grantWhenField` + `removedByProgressFlag`) |

</details>

<details>
<summary>Avar Tar line (Parchment Room → Demon Helmet)</summary>

| Item | G / C | Window | Rules |
|---|---|---|---|
| **Golden Key** `goldenKey` | G: `parchment_room` `keyReceived` (coffin) · C: `demon_helmet` `keyUsed` (door on tile 52 of the gate room, after the Fire Elemental fight) | keyReceived && !demonHelmet.keyUsed | cleanup ✅ (`requiredProgressFlag`), stale ✅ (`whenField:"keyUsed"`), backfill ✅ (`grantWhenField` + `removedByProgressFlag`) |

</details>

<details>
<summary>Non-progression / handled elsewhere</summary>

| Item | Note |
|---|---|
| `silverToken` | Starter — `grantStarterSilverTokenIfNeeded()` + spent check. OK. |
| `bosstiary` | `syncBosstiaryCollectionFromProgress()` / `ensureBosstiaryOwned()`. OK. |
| `goldenMug` (Demodras Soul Core) | G on `dragonmother` complete. cleanup ✅ + backfill ✅. OK. |
| `lootEffect` | Cosmetic drop, not tied to a mission. OK. |

</details>

### Test matrix

For a new item's rules, set the relevant Firebase progress by hand (`QuestsDev.grant({...})`), clear the
bag, run `QuestsDev.reconcile()` (or reload), and confirm the bag ends in exactly the "should-hold window"
state. Pay special attention to mid-chain states: `lost_oracle` at each of `orbExchanged` /
`spectralStoneReceived` / `oracleEnraged`; `svenson_love_story` at each `*Delivered` flag; `draconia_tower`
at `dragonfetishReceived` with `draconia_quest` not yet started.

---

## What stays in `Quests.js`

Keep in code (not JSON):

- DOM/modal layout application, observers, Firebase sync
- Mission accept/hand-in state machines and yes/no flows
- Battle hooks, tile right-click handlers, board NPC overlays
- `kingChatState` initial shape (per-progress-field defaults)
- Helpers: `getMissionCompleteLine`, `getMissionRewardItemName`, `buildMissionRewardSummary`, etc.

Rule of thumb: **if it is player-facing text or a tunable number**, prefer JSON; **if it is control flow or
DOM**, keep JavaScript.

---

## Adding a new mission (checklist)

1. Add mission id to `QUEST_MISSION_IDS` in `Quests.js` (or rely on registry after JSON load).
2. Add full entry under `missions.json` → `missions.<id>`.
3. Work out the mission's gate room(s) and place it in `registry.storyOrder` per
   [Ordering new missions in `storyOrder`](#ordering-new-missions-in-storyorder) above.
4. Add `registry.missions.<id>` (`stateKey`, `firebaseKey`, `extraFields` if needed, and `gateRooms` if it
   has a room requirement — see [Locking a mission behind an unlocked room](#locking-a-mission-behind-an-unlocked-room) above).
5. Wire the `isMissionUnlocked(mission)` check into your NPC's accept/offer flow if the mission has a
   `gateRooms` entry and is offered via chat (skip if it's only triggered by right-clicking a tile in its
   own gate room — that's already self-gating).
6. Add `completionSummaries.<id>` if the quest log needs a custom summary.
7. Add `kingChatState` progress field in `Quests.js` if the mission uses Firebase progress (or extend code
   generation later).
8. Wire NPC/battle/room handlers in `Quests.js` as needed (see [section A](#a-a-talking-only-board-npc-no-quest-yet-or-a-permanent-side-npc)/[B](#b-a-sewers-reskin-teleport-battle-quest-walk-around-room-or-actual-fight) above).
9. If the mission grants an item: `items.json` → `products`, drops/lifecycle/devTools as needed (see
   [Item-lifecycle reconciliation](#item-lifecycle-reconciliation-quest-item--progression-audit)); add icon
   file to `assets/quests/` (or prefer a `spriteId`, see [Item icons](#item-icons-sprite-id-vs-gif)).
10. If custom battle: `battles.json` entry.
11. If new placements: `rooms.json` section.
12. Quest log icon: `items.json` → `questLogIcons` or `questLogSpriteIcons`.

Quest Dev Tools picks up missions automatically from the registry (no separate mission list).

---

## Gotchas learned the hard way

1. **A Board NPC with `chatMode: 'keywords'` and no dispatch branch in `showBoardNpcKeywordModal()`
   silently falls through to whatever NPC's branch happens to sit last in the `if/else if` chain** (every
   branch ends in `return`; the trailing code after the last one is the de-facto "no branch matched"
   fallback, not a real default). Always add your own `if (npcConfig.id === BOARD_NPC_<X>_ID) { ... }`
   block — even a "just keywords, no mission logic yet" NPC needs one (see the `avarTar` branch, a 12-line
   minimal example).
2. **`imageUrl`/`outfitSpriteId` and `dialogueIconUrl` are unrelated fields.** The board sprite (and the
   chat modal portrait, which prefers `imageUrl` over `outfitSpriteId` when both are set) is one thing;
   `dialogueIconUrl` is only the small badge icon on the name tag, shown while `isInteractable()` is true —
   changing it has zero visible effect on an NPC whose `isInteractable` currently returns `false`. Don't
   assume the shared default (`https://bestiaryarena.com/assets/icons/fight.png`) needs overriding unless
   the NPC actually has an active quest badge to show.
3. **`.subscribe()` returns two different unsubscribe shapes** — `state.board.subscribe(cb)` returns
   `{ unsubscribe }`, but `state.X.select(fn).subscribe(cb)` returns a bare function. Use
   `context.api.util.unsubscribe(sub)` in cleanup, or `typeof s === 'function' ? s() : s?.unsubscribe?.()`.
4. **Tile-indexed layers (`actors`, `floorBelowTiles`, `blocked`) must stay sparse or empty-array, never
   `null`/dense-with-`null`/deleted** — see the top-level project `CLAUDE.md` for the full explanation;
   this bites any code that writes to `room.file.data` directly (not the `tileMutations` factory above,
   which already handles it).
5. **A brand-new room name typed into `rooms.json`/Quests.js (e.g. an overworld arrow-tile entry point)
   is not verified by anything at edit time** — `getRoomIdByRoomName()`/`isOnRoomByName()` resolve against
   the *live* game's `state.utils.ROOMS` at runtime and fail closed (arrow just never appears) if the name
   is wrong, rather than crashing. Double-check the exact display name in-game before assuming it's right.
6. **Every NPC's own accept/offer flow needs its own `isMissionUnlocked(mission)` gate check** if the
   mission is offered purely through chat and has `gateRooms` — there is no shared chokepoint outside King
   Tibianus's missions. See [Locking a mission behind an unlocked room](#locking-a-mission-behind-an-unlocked-room).
7. **A reward item consumed by a later quest needs both a grant rule and a removal rule** in
   `itemLifecycle` — a `soulCoreGrantOnComplete` entry alone will re-grant a duplicate forever once the
   item is already spent. See [Item-lifecycle reconciliation](#item-lifecycle-reconciliation-quest-item--progression-audit).

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

Migration steps: update all `icon` values and hardcoded filenames in `Quests.js`, add optional `subpath` to
`getQuestItemsAssetUrl`, verify `manifest.json` → `web_accessible_resources` includes `assets/quests/**`.

**Not recommended now** — cost outweighs benefit at current size.

**Custom creature/sprite definitions** (e.g. Weakened Ghazbaran, Kraknaknork's Demon) currently live in
`content/custom-battles.js` → `CUSTOM_MAP_SPRITES`, not here — that array is pure data (sprite/animation
config) but `custom-battles.js` has no JSON-loading infrastructure today, so extracting it would mean
adding a small fetch/hydration path for what is currently only 3 entries. Revisit if that table grows past
~8-10; the boss-specific *behavioral* JS (actor-matching, aura CSS, HP-bar wiring) would stay in
`Quests.js`/`custom-battles.js` regardless of where the sprite table lives.

---

## Related docs

- [Mod Development Guide](../../docs/mod_development_guide.md) — cleanup/`.subscribe()`/leak rules that
  apply to every mod, not just Quests.js; responsive-modal helpers.
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — Documentation section.
- Mission registry comments in `Quests.js` (search for `HOW TO ADD A NEW MISSION`).
- `manifest.json` → `web_accessible_resources` includes `assets/quests/*`.
- Top-level `CLAUDE.md` — the sparse-array and React-DOM-safety rules referenced in "Gotchas" above.
