# Quest‑item ↔ progression audit (backpack reconciliation)

> **Status: applied in 4.9.12.** All three passes were extended (`whenField` on
> `staleCleanupOnComplete`; `grantWhenField` + `removedByProgressFlag` on
> `soulCoreGrantOnComplete`; `requiredProgressFlag` + `clearedByProgressFlag` on
> `cleanupRules`) and every gap row below now has a rule in `assets/quests/items.json`.
> The tables are kept as the reference for what each rule is guarding.
>
> **Gappy-save hardening:** `removedByProgressFlag` and stale `whenField` also count the
> consumer mission's own `.completed`; `removedByMissionId` accepts an array and stale rules
> take `alsoWhenMissionDone: [ids]` — so a downstream chain mission being accepted/completed
> (e.g. `realm_of_dreams` done ⇒ the Elathriel-chain carry items are gone) resolves the item
> even when the direct consumer mission's sub-flag was never persisted.

Goal: on init, derive the **exact** quest‑item backpack a player *should* hold from their
mission progress, and add/remove to match. This audits every quest item in
`assets/quests/items.json → products` against where `Quests.js` grants and consumes it.

## How reconciliation works today

`loadQuestItemsOnInit()` (Quests.js:8671) runs, after mission‑progress hydrate:

| Function | Rule list (`itemLifecycle.*`) | Direction | Keys off |
|---|---|---|---|
| `cleanupInvalidQuestItems()` (37680) | `cleanupRules` | **remove** item if mission not at `requiredStatus`; `removeWhenCompleted` also strips it once done | mission `accepted` / `completed` only |
| `cleanupStaleQuestItemsAfterCompletedMissions()` (9115) | `staleCleanupOnComplete` | **remove** item once its linked mission is `completed` | mission `completed` (via `MISSION_FIREBASE_KEY_MAP`) only |
| `backfillSoulCoresFromCompletedMissions()` (8967) | `soulCoreGrantOnComplete` | **add** item if mission `completed` and count 0; optional `removedByMissionId` stops the backfill once a follow‑up is accepted/completed | mission `completed`; follow‑up `accepted`/`completed` |

`backfillSoulCoresFromCompletedMissions()` is already fully generic (it just calls
`addQuestItem`) — the "soul core" name is historical. It is the natural home for **every**
"you earned this, you don't have it, here it is" rule.

### Two structural limitations

1. **Nothing keys off sub‑progress flags.** `staleCleanupOnComplete` and `removedByMissionId`
   only see `accepted` / `completed`. Several items are consumed at an *extra field*
   (`orbExchanged`, `plankDelivered`, `bookGiven`, `dragonfetishReceived`, `portalOpened`, …)
   while the mission is still open, so no rule removes them if a write desynced.
2. **`backfillSoulCoreGrantOnComplete` only re‑grants; `cleanupRules` only removes.** For a
   reward item consumed by a later quest you need *both* a grant rule (window: earned →
   consumed) and a removal rule (after consumed) — today most have neither, or only one.

Recommended additions (implementation sketch at the end):

- Generalise `soulCoreGrantOnComplete` → treat it as `rewardGrantOnComplete`; add the missing
  reward items with `removedByMissionId` **or** a new `removedByProgressFlag`
  (`{ firebaseKey, field }`) guard.
- Extend `staleCleanupOnComplete` rows to accept an optional `whenField` so an item can be
  stripped at a sub‑flag, not only at full `completed`.
- Add `cleanupRules` (`requiredStatus: "completed"`) for the consumed‑later reward items that
  lack one, so an illegitimately‑held copy is stripped when the source quest isn't done.

---

## Per‑item findings

Legend: **G** = grant site, **C** = consume site, **W** = window the item should be in the
bag, ✅ covered, ⚠️ partial, ❌ missing.

### King Tibianus main line

| Item (`productId`) | G / C | Should‑hold window | Rules today | Gap → proposed rule |
|---|---|---|---|---|
| **Map to the Mines** `mapColour` | G: `king_copper_key` accepted (13:12979) · C: on `king_copper_key` complete (9070) | accepted && !completed | cleanup ✅ (`accepted`, removeWhenComplete) · stale ✅ | none |
| **Copper Key** `copperKey` | G: tile drop while `king_copper_key` accepted (9767) · C: on complete (9069) | accepted && !completed | cleanup ✅ · stale ✅ | none |
| **Honeyflower** `honeyflower` | G: tile pickup, `king_honeyflower` accepted (23066) · C: on complete (9093) | accepted && !completed && honeyflowerPicked | cleanup ✅ · stale ✅ | none |
| **Obsidian Knife** `obsidianKnife` | G: `king_red_dragon` accepted (12992) · C: on complete (9083) | accepted && !completed | cleanup ✅ · stale ✅ | none |
| **Red Dragon Scale / Leather** `redDragonScale` `redDragonLeather` | G: creature drops while `king_red_dragon` accepted · C: on complete (9081‑82) | accepted && !completed | cleanup ✅ · stale ✅ | none |
| **Dragon Claw** `dragonClaw` | G: **on `king_red_dragon` complete** (13072) · C: **on `dragonmother` complete** (4369) | `king_red_dragon` completed && !(`dragonmother` accepted/completed) | cleanup ⚠️ (`king_red_dragon` completed — strips illegit copy, good) · stale ✅ (`→dragonmother`) · **backfill ❌** | add `soulCoreGrantOnComplete`: `{ productId:"dragonClaw", missionId:"king_red_dragon", removedByMissionId:"dragonmother" }` |
| **Map/Letter from Al Dee** `letterFromAlDee` | G: Rookgaard global drop (independent) · C: stamped exchange / on `king_letter_al_dee` complete (14618) | has letter && !`king_letter_al_dee` completed | cleanup ✅ (independentDrop, removeWhenComplete) · stale ✅ | none |
| **Stamped Letter** `stampedLetter` | G: King stamps letter on `king_letter_al_dee` accept (stampAlDeeLetterForKing) · C: delivered to Al Dee (14590) | accepted && !completed | cleanup ✅ · stale ✅ | none |
| **The Holy Tible** `holyTible` | G: **on `al_dee_golden_rope` complete** (14769) · C: **on `king_monks_study` complete** (15727) | `al_dee_golden_rope` completed && !(`king_monks_study` accepted/completed) | cleanup ⚠️ (`al_dee_golden_rope` completed) · **stale ❌** · **backfill ❌** | add stale `{ productId:"holyTible", missionId:"king_monks_study" }` **and** backfill `{ productId:"holyTible", missionId:"al_dee_golden_rope", removedByMissionId:"king_monks_study" }` |
| **Light Shovel** `lightShovel` | G: axe returned, `al_dee_fishing_gold` complete (14680) · never consumed (permanent tool) | `al_dee_fishing_gold` completed | cleanup ✅ (`completed`) · **backfill ❌** | add backfill `{ productId:"lightShovel", missionId:"al_dee_fishing_gold" }` (no `removedBy`) |
| **Magnet / Small Axe** `magnet` `smallAxe` | G/C inside `al_dee_fishing_gold` (11684, 37000, 14673) · C: on complete | accepted && !completed | cleanup ✅ · stale ✅ | none |
| **Iron Ore** `ironOre` | G: dwarf / global drop (independent) · C: handed to King, or on `al_dee_fishing_gold` complete | has ore && !fishing concluded | cleanup ✅ (independentDrop) · stale ✅ | none |
| **Scarab Coin** `scarabCoin` | G: desert dig, `king_scarab_coin` accepted (5286) · C: given to Tesha on complete (16523) | accepted && !completed | cleanup ✅ · stale ✅ · cap ✅ | none |

### Al Dee side line

| Item | G / C | Window | Rules | Gap |
|---|---|---|---|---|
| **Elvenhair Rope** `elvenhairRope` | G: Mornenion victory (2978) · C: returned to Al Dee on `al_dee_golden_rope` complete (14761) | Mornenion defeated && !`al_dee_golden_rope` completed | cleanup ✅ (`accepted`, removeWhenComplete) · stale ✅ | none |
| **Fishing Rod** `fishingRod` | Al Dee shop purchase (14443), not progression‑driven | owned | — | out of scope (not quest progress) |
| **Knarknaknork Soul Core** `knarknaknorkSoulCore` | G: `al_dee_rookie_guard` complete (14842) | completed | backfill ✅ | none |
| **Mornenion Soul Core** `mornenionSoulCore` | G: Mornenion victory (2983) | `al_dee_golden_rope` completed (proxy) | backfill ✅ | none |

### Costello / Wyda line

| Item | G / C | Window | Rules | Gap |
|---|---|---|---|---|
| **Costello's diary** `costelloDiary` | G: `costello_queen_banshees` accept (15682) · C: on complete (15628) | accepted && !completed | cleanup ✅ · stale ✅ | none |
| **Blessed Ankh** `blessedAnkh` | G: **on `costello_queen_banshees` complete** (15627) · C: **on `follower_of_zathroth` complete** (15974) | `costello_queen_banshees` completed && !(`follower_of_zathroth` accepted/completed) | **cleanup ❌ · stale ❌ · backfill ❌** | add cleanup `{ productId:"blessedAnkh", missionId:"costello_queen_banshees", requiredStatus:"completed" }` · stale `{ productId:"blessedAnkh", missionId:"follower_of_zathroth" }` · backfill `{ productId:"blessedAnkh", missionId:"costello_queen_banshees", removedByMissionId:"follower_of_zathroth" }` |
| **Spider Silk** `spiderSilk` | G: Old Widow victory (4022) · C: given to Wyda on `mother_of_all_spiders` complete (15948) | widow defeated && !completed | cleanup ✅ · stale ✅ | none |
| **The Old Widow Soul Core** `oldWidowSoulCore` | G: Old Widow victory (4026) | `mother_of_all_spiders` completed (proxy) | backfill ✅ + `syncBosstiaryCollectionFromProgress` | none |
| **Spool of Yarn** `spoolOfYarn` | G: **on `mother_of_all_spiders` complete** (15950, `rewardItemName`) · C: **`svenson_love_story` `awashYarnDelivered`** (32660) | `mother_of_all_spiders` completed && !`svenson` awashYarnDelivered | cleanup ❌ · stale ⚠️ (`→svenson_love_story` — only fires at full completion) · **backfill ❌** | add cleanup `{...,"requiredStatus":"completed"}` · change stale to `whenField:"awashYarnDelivered"` · backfill `{ productId:"spoolOfYarn", missionId:"mother_of_all_spiders", removedByProgressFlag:{firebaseKey:"svensonLoveStory", field:"awashYarnDelivered"} }` |
| **Stuffed Toad** `stuffedToad` | G: **on `jakundaf_desert` complete** (16019) · C: **`tainted_souls` `portalOpened`** (24938) | `jakundaf_desert` completed && !`tainted_souls` portalOpened | **cleanup ❌ · stale ❌ · backfill ❌** | cleanup `{ productId:"stuffedToad", missionId:"jakundaf_desert", requiredStatus:"completed" }` · stale `{ productId:"stuffedToad", missionId:"tainted_souls", whenField:"portalOpened" }` · backfill `{ productId:"stuffedToad", missionId:"jakundaf_desert", removedByProgressFlag:{firebaseKey:"taintedSouls", field:"portalOpened"} }` |
| **Ekatrix Soul Core** `ekatrixSoulCore` | G: `tainted_souls` complete (16069) | completed | cleanup ✅ · backfill ✅ | none |

### Tesha line (Serpentine / Realm of Dreams)

| Item | G / C | Window | Rules | Gap |
|---|---|---|---|---|
| **Destroy Field Rune** `destroyFieldRune` | G: tile pickup, `serpentine_tower` accepted (22688) · C: Putrid Chamber (4591) / on complete | accepted && !putridChamberComplete | cleanup ✅ (removeWhenComplete + removeWhenPutridChamberComplete) · stale ✅ · cap ✅ | none |
| **Compass** `scorpionSceptre` | G: **on `serpentine_tower` complete** (4634) · C: **`svenson_love_story` `undergroundCompassDelivered`** (32681) | `serpentine_tower` completed && !`svenson` undergroundCompassDelivered | cleanup ⚠️ (`serpentine_tower` completed) · stale ⚠️ (`→svenson_love_story` full completion only) · **backfill ❌** | stale → `whenField:"undergroundCompassDelivered"` · backfill `{ productId:"scorpionSceptre", missionId:"serpentine_tower", removedByProgressFlag:{firebaseKey:"svensonLoveStory", field:"undergroundCompassDelivered"} }` |
| **Key to Magic (Book)** `keyToMagicBook` | G: **on `draconia_quest` complete** (grantDraconiaQuestReward, 28995) · C: **`realm_of_dreams` battle victory** (`battleCompleted`, 29355) | `draconia_quest` completed && !`realm_of_dreams` battleCompleted | cleanup ❌ · stale ⚠️ (`→realm_of_dreams` completed — but item is spent at `battleCompleted`, one step earlier) · **backfill ❌** | cleanup `{...,"requiredStatus":"completed"}` (mission `draconia_quest`) · stale `whenField:"battleCompleted"` · backfill `{ productId:"keyToMagicBook", missionId:"draconia_quest", removedByProgressFlag:{firebaseKey:"realmOfDreams", field:"battleCompleted"} }` |
| **Mintwallin Prison Key** `mintwallinPrisonKey` | G: `realm_of_dreams` complete (grantRealmOfDreamsReward) · never consumed (permanent key; `visiting_mintwallin` does not consume it — 13557 only reads it) | `realm_of_dreams` completed | backfill ✅ | none — confirm no consume path is intended |

### Rookstayer / Santa / Svenson

| Item | G / C | Window | Rules | Gap |
|---|---|---|---|---|
| **Wooden Plank** `minotaurTrophy` | G: **on `apprentice_sheng` complete** (31731) · C: **`svenson_love_story` `plankDelivered`** (32639) | `apprentice_sheng` completed && !`svenson` plankDelivered | cleanup ⚠️ (`apprentice_sheng` completed) · stale ⚠️ (`→svenson_love_story` full completion) · **backfill ❌** | stale → `whenField:"plankDelivered"` · backfill `{ productId:"minotaurTrophy", missionId:"apprentice_sheng", removedByProgressFlag:{firebaseKey:"svensonLoveStory", field:"plankDelivered"} }` |
| **Apprentice Sheng Soul Core** `apprenticeShengSoulCore` | G: `apprentice_sheng` complete (31735) | completed | backfill ✅ | none |
| **Wishlist** `wishlist` | G: Goblin drop (independent), auto‑accepts `christmas_miracle` (9508) · C: on Present grant (32216) | has wishlist && !present claimed | cleanup ✅ (independentDrop, removeWhenComplete) · stale ✅ | none |
| **Present** `present` | G: from Santa, `christmas_miracle` accepted (32210) · C: opened → Bunny Slippers (9143) | accepted && !opened | cleanup ✅ · stale ✅ | none |
| **Bunny Slippers** `bunnySlippers` | G: **open Present, `christmas_miracle` complete** (9145) · C: **`svenson_love_story` `whiteWaveSlippersDelivered`** (32702) | `christmas_miracle` completed && !`svenson` whiteWaveSlippersDelivered | **cleanup ❌** · stale ⚠️ (`→svenson_love_story` full completion) · **backfill ❌** | cleanup `{ productId:"bunnySlippers", missionId:"christmas_miracle", requiredStatus:"completed" }` · stale `whenField:"whiteWaveSlippersDelivered"` · backfill `{ productId:"bunnySlippers", missionId:"christmas_miracle", removedByProgressFlag:{firebaseKey:"svensonLoveStory", field:"whiteWaveSlippersDelivered"} }` |

### Dane / Oracle line (the Orb chain — the reported bug)

| Item | G / C | Window | Rules | Gap |
|---|---|---|---|---|
| **Orb** `orb` | G: **on `weakened_archdemon` complete** (32904, with Ghazbaran Soul Core) · C: **`lost_oracle` `orbExchanged`** → Luminous Orb (32553) | `weakened_archdemon` completed && !`lost_oracle` orbExchanged | cleanup ⚠️ (`weakened_archdemon` completed — strips illegit, but **does not** strip a stale Orb after `orbExchanged`) · **stale ❌ · backfill ❌** | stale `{ productId:"orb", missionId:"lost_oracle", whenField:"orbExchanged" }` · backfill `{ productId:"orb", missionId:"weakened_archdemon", removedByProgressFlag:{firebaseKey:"lostOracle", field:"orbExchanged"} }` |
| **Ghazbaran Soul Core** `ghazbaranSoulCore` | G: `weakened_archdemon` complete (32906) | completed | backfill ✅ | none |
| **Luminous Orb** `luminousOrb` | G: **`lost_oracle` `orbExchanged`** (32555) · C: **`lost_oracle` `spectralStoneReceived`** → Spectral Stone (32572) | orbExchanged && !spectralStoneReceived | **none at all** | stale `{ productId:"luminousOrb", missionId:"lost_oracle", whenField:"spectralStoneReceived" }` · cleanup: strip unless `lost_oracle` accepted && orbExchanged && !spectralStoneReceived · backfill `removedByProgressFlag lostOracle/spectralStoneReceived`, granted when `orbExchanged && !spectralStoneReceived` |
| **Spectral Stone** `spectralStone` | G: **`lost_oracle` `spectralStoneReceived`** (32574) · C: **`lost_oracle` `oracleEnraged`** (offered to Oracle, 32591) | spectralStoneReceived && !oracleEnraged | **none at all** | stale `{ productId:"spectralStone", missionId:"lost_oracle", whenField:"oracleEnraged" }` · same flag‑based cleanup/backfill pattern |

> The Orb chain is entirely driven by `lostOracle` extra‑field flags, none of which any current
> rule understands. This is exactly the reported failure: player finished `weakened_archdemon`
> (Orb should have been granted — backfill missing) and later held a stale **Holy Tible**
> (`king_monks_study` done — stale rule missing).

### Elathriel line (Hellgate → Library → Draconia)

| Item | G / C | Window | Rules | Gap |
|---|---|---|---|---|
| **Key 3012** `key3012` | G: `hellgate_part_1` accept (35769) · C: on `draconia_quest` complete (29022) | `hellgate_part_1` accepted && !`draconia_quest` completed | cleanup ❌ (accept‑gated, low risk) · stale ✅ (`→draconia_quest`) | optional: cleanup `{ productId:"key3012", missionId:"hellgate_part_1", requiredStatus:"accepted" }` (no removeWhenComplete — chain keeps it) |
| **Beware of the Bonelords (Book)** `bewareOfTheBonelordsBook` | G: **on `hellgate_part_1` complete** (26160) · C: **`hellgate_library` `bookGiven`** (36100) | `hellgate_part_1` completed && !`hellgate_library` bookGiven | **cleanup ❌ · stale ❌ · backfill ❌** | cleanup `{...,"requiredStatus":"completed"}` (`hellgate_part_1`) · stale `{ productId:"bewareOfTheBonelordsBook", missionId:"hellgate_library", whenField:"bookGiven" }` · backfill `removedByProgressFlag hellgateLibrary/bookGiven` |
| **White Mushroom** `whiteMushroom` | G: **on `hellgate_library` complete** (26952) · C: **`draconia_tower` `dragonfetishReceived`** (36198) | `hellgate_library` completed && !`draconia_tower` dragonfetishReceived | **cleanup ❌ · stale ❌ · backfill ❌** (`draconia_tower` may never reach `completed`, so a `staleCleanupOnComplete` on it can't fire — must use `whenField`) | cleanup `{...,"requiredStatus":"completed"}` (`hellgate_library`) · stale `{ productId:"whiteMushroom", missionId:"draconia_tower", whenField:"dragonfetishReceived" }` · backfill `removedByProgressFlag draconiaTower/dragonfetishReceived` |
| **Dragonfetish** `dragonfetish` | G: **`draconia_tower` `dragonfetishReceived`** (36200) · C: **`draconia_quest` battle return / complete** (29021/29037) | draconiaTower.dragonfetishReceived && !`draconia_quest` completed | cleanup ❌ · stale ✅ (`→draconia_quest`) · backfill ❌ | stale is OK. Add backfill `{ productId:"dragonfetish", missionId:"draconia_tower"? }` — needs `whenField` grant guard (`draconiaTower.dragonfetishReceived`) + `removedByProgressFlag draconiaQuest/battleCompleted` |
| **Key to Magic (Book)** | see Tesha line above | | | |

### Non‑progression / handled elsewhere

| Item | Note |
|---|---|
| `silverToken` | Starter — `grantStarterSilverTokenIfNeeded()` (8684) + spent check (13253). OK. |
| `bosstiary` | `syncBosstiaryCollectionFromProgress()` / `ensureBosstiaryOwned()`. OK. |
| `goldenMug` (Demodras Soul Core) | G on `dragonmother` complete (4375). cleanup ✅ + backfill ✅. OK. |
| `lootEffect` | Cosmetic drop, not tied to a mission. OK. |

---

## Summary of gaps

**Missing backfill (player finished the quest, lost/never got the reward):**
`orb`, `holyTible`, `blessedAnkh`, `stuffedToad`, `spoolOfYarn`, `minotaurTrophy`,
`scorpionSceptre`, `bunnySlippers`, `dragonClaw`, `lightShovel`, `whiteMushroom`,
`bewareOfTheBonelordsBook`, `dragonfetish`, `keyToMagicBook`, `luminousOrb`, `spectralStone`.

**Missing stale cleanup (player advanced past the consume point, still holds the item):**
`holyTible` (→`king_monks_study`), `blessedAnkh` (→`follower_of_zathroth`),
`stuffedToad` (→`tainted_souls`/`portalOpened`), `bewareOfTheBonelordsBook`
(→`hellgate_library`/`bookGiven`), `whiteMushroom` (→`draconia_tower`/`dragonfetishReceived`),
`orb` `luminousOrb` `spectralStone` (→`lost_oracle` flags).

**Stale rule fires too late (only at full `completed`, item spent at a sub‑flag):**
`spoolOfYarn`, `minotaurTrophy`, `scorpionSceptre`, `bunnySlippers` (all →`svenson_love_story`
sub‑hand‑ins), `keyToMagicBook` (→`realm_of_dreams`/`battleCompleted`).

**Missing `cleanupRules` guard (illegitimate copy not stripped when source quest not done):**
`blessedAnkh`, `stuffedToad`, `spoolOfYarn`, `bunnySlippers`, `bewareOfTheBonelordsBook`,
`whiteMushroom`, `luminousOrb`, `spectralStone`.

---

## Implementation sketch

1. **`staleCleanupOnComplete` — add optional `whenField`.**
   In `cleanupStaleQuestItemsAfterCompletedMissions()` (9115) / `isCleanupRuleCompleted()` (9101):
   ```js
   const fbKey = MISSION_FIREBASE_KEY_MAP[rule.missionId];
   const p = progress?.[fbKey];
   const done = rule.whenField ? !!p?.[rule.whenField] : !!p?.completed;
   ```

2. **`soulCoreGrantOnComplete` — add `grantWhenField` + `removedByProgressFlag`.**
   In `backfillSoulCoresFromCompletedMissions()` (8967):
   ```js
   const srcKey = MISSION_FIREBASE_KEY_MAP[rule.missionId];
   const src = allProgress?.[srcKey];
   const earned = rule.grantWhenField ? !!src?.[rule.grantWhenField] : !!src?.completed;
   if (!earned) continue;
   if (rule.removedByProgressFlag) {
     const g = allProgress?.[rule.removedByProgressFlag.firebaseKey];
     if (g?.[rule.removedByProgressFlag.field]) continue;
   }
   if (rule.removedByMissionId) { /* existing check */ }
   ```
   Rename the list to `rewardGrantOnComplete` (keep `soulCoreGrantOnComplete` as an alias in
   the loader at 887 for back‑compat), or just keep the name and add rows.

3. **`cleanupRules` — add `requiredStatus:"completed"` rows** for the consumed‑later reward
   items listed above. No `removeWhenCompleted` (the item is legitimately held *after*
   completion until the follow‑up consumes it; the new grant/stale rules manage that edge).
   For flag‑chain items (`luminousOrb`, `spectralStone`) add an `allowedWhileProgressFlag`
   escape so the `completed`‑guard doesn't strip them mid‑`lost_oracle`.

4. **Order in `loadQuestItemsOnInit()`**: keep `cleanupInvalidQuestItems` → stale → backfill.
   Backfill last so a rule that both strips (wrong source state) and grants (right state)
   can't fight itself in one pass.

### QuestsDev integration (4.9.12)

`reconcileQuestItemsFromProgress({ label })` (Quests.js, right after
`backfillSoulCoresFromCompletedMissions`) runs all three passes + a modal/tab refresh. It is
called automatically at the end of every progress-mutating dev command:
`QuestsDev.complete`, `.setAccepted`, `.reset`, `.resetAll`, `.completeAll`, `.resetSanta`, and
`.grant(...)` **when the call changed only mission/seal progress** (a `grant` that also set item
counts skips it and logs a hint, so deliberate item edits survive). `QuestsDev.reconcile()`
(alias `questsDevReconcile`) runs it on demand.

- `completeAll` now lands on the true "everything finished" bag: `buildDevCompletedMissionProgress`
  sets every consume sub-flag (`orbExchanged`, `bookGiven`, `portalOpened`,
  `dragonfetishReceived`, …), so reconcile strips all consumed items and keeps only permanents.
  Use `QuestsDev.grant({...})` to put a specific consumed item back for testing.
- `reset("<mission>")` + reconcile is genuinely useful: resetting `lost_oracle` /
  `king_monks_study` / `dragonmother` re-grants the Orb / Holy Tible / Dragon Claw the follow-up
  had consumed, so the quest can be replayed from a correct bag state.
- Not covered: accept-time items that quest handlers grant inline (Map to the Mines, Obsidian
  Knife, Costello's diary, the Stamped Letter exchange). `setAccepted` won't reproduce those.

### Test matrix

For each row above, set the relevant Firebase progress by hand (`QuestsDev.grant({...})`),
clear the bag, run `QuestsDev.reconcile()` (or reload), and confirm the bag ends in exactly the
"Should‑hold window" state. Pay special attention to the mid‑chain states: `lost_oracle` at each
of `orbExchanged` / `spectralStoneReceived` / `oracleEnraged`; `svenson_love_story` at each
`*Delivered` flag; `draconia_tower` at `dragonfetishReceived` with `draconia_quest` not yet
started.
