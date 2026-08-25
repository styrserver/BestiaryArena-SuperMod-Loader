// Better Daycare Mod for Bestiary Arena
(function () {
  if (window.__betterDaycareLoaded) return;
  window.__betterDaycareLoaded = true;

  console.log('[Better Daycare] initializing...');

  const MOD_NAME = 'Better Daycare';
  const SETTINGS_BUTTON_ID = 'better-daycare-settings-button';
  const t = (key) => api?.i18n?.t(key) || key;

  // =======================
  // 1. Configuration
  // =======================

  const defaultConfig = {
    autoHandleDaycare: false,
    queue: [] // array of owned monster ids (globalThis.state.player.getSnapshot().context.monsters[].id), in fill order
  };
  const config = Object.assign({}, defaultConfig, context?.config);
  if (!Array.isArray(config.queue)) config.queue = [];

  function saveConfig() {
    try {
      api.service.updateScriptConfig(context.hash, {
        autoHandleDaycare: config.autoHandleDaycare,
        queue: config.queue
      });
    } catch (error) {
      console.error('[Better Daycare] Error saving config:', error);
    }
    refreshOpenDaycareTooltip();
  }

  // Defined below (function declarations are hoisted within this IIFE).
  function refreshOpenDaycareTooltip() {
    const dialog = findOpenDaycareDialog();
    if (dialog) updateDaycareTooltip(dialog);
  }

  if (window.ModCoordination) {
    window.ModCoordination.registerMod(MOD_NAME, {
      priority: 50,
      metadata: { description: 'Automates Daycare level-ups/ejections and fills empty slots from a queue.' }
    });
    window.ModCoordination.updateModState(MOD_NAME, { enabled: true });
  }

  // =======================
  // 2. Maxed-creature logic
  // =======================

  // Non-awakened level cap by tier (game rule). Awakened creatures use tier 6 internally and cap at 99.
  const TIER_LEVEL_CAP = { 1: 30, 2: 35, 3: 40, 4: 45, 5: 50 };
  const AWAKENED_TIER = 6;
  const AWAKENED_MAX_LEVEL = 99;

  // context.monsters[].level isn't always populated directly — fall back to computing it from exp,
  // same as other bundled mods (e.g. Awaken Tracker) do.
  function getMonsterLevel(monster) {
    const rawLevel = Number(monster?.level);
    if (Number.isFinite(rawLevel) && rawLevel > 0) return rawLevel;
    try {
      const expToLevel = globalThis.state?.utils?.expToCurrentLevel;
      if (typeof expToLevel === 'function' && monster?.exp != null) {
        const computed = Math.floor(expToLevel(Number(monster.exp)));
        if (Number.isFinite(computed) && computed > 0) return computed;
      }
    } catch (_) {}
    return 1;
  }

  function getMonsterName(monster) {
    if (monster?.metadata?.name) return monster.metadata.name;
    try {
      const species = globalThis.state?.utils?.getMonster?.(monster?.gameId);
      if (species?.metadata?.name) return species.metadata.name;
    } catch (_) {}
    return 'Unknown';
  }

  // Gazers can't be awakened and shouldn't be sent to Daycare (same convention as Awaken Tracker's
  // isNonAwakenableName check).
  function isGazer(monster) {
    return getMonsterName(monster).toLowerCase().includes('gazer');
  }

  function isMonsterMaxed(monster) {
    if (!monster) return false;
    const level = getMonsterLevel(monster);
    // The game omits `tier` entirely for tier-1 creatures (saves payload space) — default to 1, not 0.
    const tier = Number(monster.tier) || 1;
    if (tier === AWAKENED_TIER) {
      return level >= AWAKENED_MAX_LEVEL;
    }
    const cap = TIER_LEVEL_CAP[tier] || 50;
    return level >= cap;
  }

  function getOwnedMonsters() {
    try {
      const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
      return Array.isArray(monsters) ? monsters : [];
    } catch (error) {
      console.error('[Better Daycare] getOwnedMonsters error:', error);
      return [];
    }
  }

  // e.g. daycareSlots: [{ id: '0', leftAt, monsterId }, { id: '1' }, ...] — empty slots have no monsterId.
  function getDaycareSlots() {
    const slots = globalThis.state?.player?.getSnapshot?.()?.context?.daycareSlots;
    return Array.isArray(slots) ? slots : [];
  }

  function getMonsterIdsCurrentlyInDaycare() {
    try {
      return new Set(
        getDaycareSlots().filter((slot) => slot?.monsterId != null).map((slot) => String(slot.monsterId))
      );
    } catch (error) {
      console.error('[Better Daycare] getMonsterIdsCurrentlyInDaycare error:', error);
      return new Set();
    }
  }

  // The queue is persisted config, so entries can go stale between sessions — a creature gets
  // fused/evolved away, matures past its level cap, or gets manually placed in Daycare while we
  // weren't running. fillEmptySlotsFromQueue already drops one stale front-of-queue entry at a time
  // during automation, but that only happens lazily when there's an empty slot to fill; this runs
  // once on load so the picker/queue view is accurate immediately, without waiting on automation.
  function cleanupInvalidQueueEntries() {
    if (!config.queue.length) return;
    try {
      const byId = new Map(getOwnedMonsters().map((m) => [String(m.id), m]));
      const inDaycare = getMonsterIdsCurrentlyInDaycare();
      const before = config.queue.length;
      config.queue = config.queue.filter((id) => {
        const monster = byId.get(String(id));
        if (!monster) return false;
        if (isMonsterMaxed(monster)) return false;
        if (isGazer(monster)) return false;
        if (inDaycare.has(String(id))) return false;
        return true;
      });
      const removedCount = before - config.queue.length;
      if (removedCount > 0) {
        console.log('[Better Daycare] Cleanup: removed', removedCount, 'invalid queue entr' + (removedCount === 1 ? 'y' : 'ies'));
        saveConfig();
      }
    } catch (error) {
      console.error('[Better Daycare] cleanupInvalidQueueEntries error:', error);
    }
  }

  // =======================
  // 3. Automation helpers (ported from Bestiary Automator)
  // =======================

  const sleep = (timeout = 500) => new Promise((resolve) => setTimeout(resolve, timeout));

  const isBoardAnalyzerRunning = () => window.ModCoordination?.isModActive('Board Analyzer') || false;

  const isBattleRewardScreenOpen = () => {
    try {
      const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
      return !!(ctx && ctx.openRewards);
    } catch (_) {
      return false;
    }
  };

  const shouldDeferForBattleRewards = () => {
    if (isBattleRewardScreenOpen()) return true;
    try {
      const manualRunner = window.ModCoordination?.getModState('Manual Runner');
      if (manualRunner?.active && manualRunner?.metadata?.handlingRewardScreen) return true;
      const boardAnalyzer = window.ModCoordination?.getModState('Board Analyzer');
      if (boardAnalyzer?.active && boardAnalyzer?.metadata?.handlingRewardScreen) return true;
    } catch (_) {}
    return false;
  };

  const simulateEscKey = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
    }));
  };

  const clickButtonWithText = (text) => {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const buttonText = button.textContent.trim();
      if (buttonText === text || buttonText.includes(text)) {
        button.click();
        return true;
      }
    }
    return false;
  };

  // Icon-based, not text-based — the nav button's label is localized ("Inventário" in Portuguese),
  // while the icon's file path isn't (same convention used elsewhere in this codebase, e.g.
  // Mod_Settings.js's img[src*="inventory.png"] lookups). Falls back to the English text match for
  // older/unexpected builds where the icon markup might differ.
  const clickInventoryButton = () => {
    const btn = document.querySelector('button img[src*="inventory.png"]')?.closest('button');
    if (btn) {
      btn.click();
      return true;
    }
    return clickButtonWithText('Inventory');
  };

  const clickAllCloseButtons = () => {
    if (isBoardAnalyzerRunning()) return false;
    const buttons = document.querySelectorAll('button');
    let clickedCount = 0;
    for (const button of buttons) {
      const text = button.textContent.trim();
      if (text === 'Close' || text === 'Fechar') {
        button.click();
        clickedCount++;
      }
    }
    return clickedCount > 0;
  };

  const handleScrollLockCheck = async () => {
    if (isBoardAnalyzerRunning()) return false;
    try {
      const body = document.body;
      const scrollLockValue = body.getAttribute('data-scroll-locked');
      if (scrollLockValue && parseInt(scrollLockValue, 10) > 0) {
        simulateEscKey();
        await sleep(150);
      }
    } catch (error) {
      console.error('[Better Daycare] Error handling scroll lock:', error);
    }
    return false;
  };

  // =======================
  // 4. Daycare automation cycle
  // =======================

  let lastQueueFillAttempt = 0;
  const QUEUE_FILL_THROTTLE_MS = 30000;

  // Same tRPC endpoint the game's own "Add creature" flow calls — hitting it directly is far more
  // reliable than clicking through the native picker (no DOM matching by portrait src/level text
  // required, no dependency on the dialog even being open).
  const ADD_TO_DAYCARE_TRPC_URL = 'https://bestiaryarena.com/api/trpc/inventory.addToDaycare?batch=1';

  const getTrpcGamePostHeaders = () => ({
    accept: '*/*',
    'content-type': 'application/json',
    Referer: 'https://bestiaryarena.com/game',
    'X-Game-Version': '1'
  });

  async function addMonsterToDaycareViaApi(slotId, monsterId) {
    const response = await fetch(ADD_TO_DAYCARE_TRPC_URL, {
      method: 'POST',
      headers: getTrpcGamePostHeaders(),
      credentials: 'include',
      body: JSON.stringify({ '0': { json: { slotId, monsterId } } })
    });
    if (!response.ok) {
      throw new Error(`addToDaycare HTTP ${response.status}`);
    }
    const data = await response.json();
    // Slot additions are logged once, with full detail, by the daycareSlots state watcher below —
    // no need to also log the raw API response here.
    return data?.[0]?.result?.data?.json;
  }

  // Our raw fetch() bypasses the game's own tRPC/react-query mutation client, so neither the native
  // Daycare UI nor globalThis.state.player ever learn the slot was filled — the store just goes
  // stale until a full page reload. Patch it manually the same way the docs show for editing
  // monsters/equips (`globalThis.state.player.send({ type: 'setState', fn })`), using the exact
  // slotAddedTo the server returned, so both the native UI and our own state reads stay in sync.
  function patchLocalDaycareSlot(slotAddedTo) {
    if (!slotAddedTo?.id) return;
    try {
      globalThis.state.player.send({
        type: 'setState',
        fn: (prev) => {
          const daycareSlots = Array.isArray(prev.daycareSlots) ? prev.daycareSlots : [];
          const nextSlots = daycareSlots.map((slot) =>
            String(slot.id) === String(slotAddedTo.id) ? { ...slot, ...slotAddedTo } : slot
          );
          return { ...prev, daycareSlots: nextSlots };
        }
      });
    } catch (error) {
      console.error('[Better Daycare] patchLocalDaycareSlot error:', error);
    }
  }

  // `excludeSlotIds` covers slots we've already filled earlier in this same pass — calling our raw
  // fetch directly (bypassing the game's own mutation/query client) means globalThis.state.player
  // may not reflect a just-added monster yet, so re-reading daycareSlots alone can hand back a slot
  // we already filled a moment ago and get a 400 from the server on the retry.
  function findEmptyDaycareSlotId(excludeSlotIds) {
    const emptySlot = getDaycareSlots().find(
      (s) => s?.monsterId == null && !excludeSlotIds.has(String(s.id))
    );
    return emptySlot?.id ?? null;
  }

  function hasEmptyDaycareSlot() {
    return getDaycareSlots().some((s) => s?.monsterId == null);
  }

  // Shared by the initial ready/maxed scan and the level-up loop below — both need to classify the
  // same blip icon (the little daycare status marker on a creature's board tile).
  function classifyDaycareBlip(blipElement) {
    const daycareImg = blipElement.querySelector('img[alt="daycare"], img[alt="Daycare"]');
    if (!daycareImg) return null;
    const isRedBlip = !!blipElement.querySelector('.text-invalid');
    const isGreenBlip = !!blipElement.querySelector('.text-expBar');
    const isMaxText = !!blipElement.querySelector('span[data-state="closed"]')?.textContent?.includes('Max');
    if (isGreenBlip && !isRedBlip && !isMaxText) return 'ready';
    if (isRedBlip || isMaxText) return 'maxed';
    return null;
  }

  async function fillEmptySlotsFromQueue() {
    const monsters = getOwnedMonsters();
    const byId = new Map(monsters.map((m) => [String(m.id), m]));
    const filledSlotIdsThisPass = new Set();
    let guard = 0;

    while (config.queue.length > 0 && guard < 4) {
      guard++;

      const slotId = findEmptyDaycareSlotId(filledSlotIdsThisPass);
      if (slotId == null) break;

      const queuedId = config.queue[0];
      const monster = byId.get(String(queuedId));
      if (!monster || isMonsterMaxed(monster) || isGazer(monster) || getMonsterIdsCurrentlyInDaycare().has(String(queuedId))) {
        console.log('[Better Daycare] Dropping stale/maxed/gazer/already-placed queue entry:', queuedId);
        config.queue.shift();
        saveConfig();
        refreshPanelContent();
        continue;
      }

      try {
        const result = await addMonsterToDaycareViaApi(slotId, String(queuedId));
        if (result?.slotAddedTo) {
          patchLocalDaycareSlot(result.slotAddedTo);
        }
        filledSlotIdsThisPass.add(String(slotId));
      } catch (error) {
        console.error('[Better Daycare] addToDaycare API call failed, stopping auto-fill:', error);
        break;
      }

      // Update the queue (and the tooltip's "In queue" count) immediately once the creature is
      // actually placed — don't wait on the throttle below, which only paces the *next* API call.
      config.queue.shift();
      saveConfig();
      refreshPanelContent();

      // Throttle between consecutive addToDaycare calls so we don't hammer the endpoint and risk
      // getting rate-limited.
      await sleep(500);
    }
  }

  // 'closed' — no Daycare dialog open, we'll need to open (and later close) it ourselves.
  // 'native' — already open showing the native slots view (e.g. user opened it manually) — act on
  //            it in place, but don't close it out from under them when we're done.
  // 'panel'  — already open showing our Queue tab — the native elements we scrape are hidden behind
  //            it, and closing/reopening while they're looking at the Queue would be jarring, so
  //            skip this cycle entirely.
  function getDaycareDialogState() {
    if (!findOpenDaycareDialog()) return 'closed';
    return panelVisible ? 'panel' : 'native';
  }

  async function runDaycareCycle() {
    if (!config.autoHandleDaycare) return;
    if (shouldDeferForBattleRewards()) return;
    if (isBoardAnalyzerRunning()) return;
    if (getDaycareDialogState() === 'panel') return;

    const setHandlingDaycareCoordination = (busy) => {
      try {
        window.ModCoordination?.updateModState(MOD_NAME, { metadata: { handlingDaycare: busy } });
      } catch (_) {}
    };

    try {
      const blipElements = document.querySelectorAll('[data-blip="true"]');
      let foundReadyCreature = false;
      let foundMaxedCreature = false;

      for (const blipElement of blipElements) {
        if (!blipElement.querySelector('img[alt="creature"]')) continue;
        const status = classifyDaycareBlip(blipElement);
        if (status === 'ready') foundReadyCreature = true;
        else if (status === 'maxed') foundMaxedCreature = true;
      }

      const allDaycareImages = document.querySelectorAll('img[alt="daycare"], img[alt="Daycare"]');
      for (const daycareImg of allDaycareImages) {
        if (daycareImg.closest('[data-blip="true"]')) continue;
        const container = daycareImg.closest('.container-slot');
        if (!container) continue;
        const creatureImg = container.querySelector('img[alt="creature"]');
        if (!creatureImg) continue;
        const maxLevelText = container.querySelector('span[data-state="closed"]');
        if (!maxLevelText?.textContent?.includes('Max')) {
          foundReadyCreature = true;
        } else {
          foundMaxedCreature = true;
        }
      }

      const now = Date.now();
      const shouldProactivelyFillQueue =
        config.queue.length > 0 &&
        now - lastQueueFillAttempt >= QUEUE_FILL_THROTTLE_MS &&
        hasEmptyDaycareSlot();

      if (!foundReadyCreature && !foundMaxedCreature && !shouldProactivelyFillQueue) {
        return;
      }
      if (shouldProactivelyFillQueue) lastQueueFillAttempt = now;

      setHandlingDaycareCoordination(true);

      const dialogAlreadyOpen = getDaycareDialogState() === 'native';

      if (!dialogAlreadyOpen) {
        clickInventoryButton();
        await sleep(500);

        const dayCareButton = document.querySelector('button:has(img[alt="daycare"]), button:has(img[alt="Daycare"])');
        if (!dayCareButton) {
          clickAllCloseButtons();
          return;
        }
        dayCareButton.click();
        await sleep(500);
      }

      // Level up every ready creature
      let levelUpCount = 0;
      while (levelUpCount < 4) {
        const ready = Array.from(document.querySelectorAll('[data-blip="true"]')).some(
          (creature) => classifyDaycareBlip(creature) === 'ready'
        );
        if (!ready) break;
        if (!clickButtonWithText('Level up')) break;
        levelUpCount++;
        await sleep(1000);
      }

      // Eject every maxed creature
      if (foundMaxedCreature) {
        let ejectionCount = 0;
        while (ejectionCount < 4) {
          const daycareSlots = document.querySelectorAll('div.relative.flex.items-center.gap-2');
          let withdrawButton = null;
          for (const slot of daycareSlots) {
            const maxLevelText = slot.querySelector('span[data-state="closed"]');
            // Match by icon, not the button's title attribute — that's localized too (e.g.
            // "Retirar" in Portuguese instead of "Withdraw"), while the arrow-up-right icon isn't.
            const btn = slot.querySelector('button:has(svg.lucide-arrow-up-right)');
            if (maxLevelText?.textContent?.includes('Max') && btn) {
              withdrawButton = btn;
              break;
            }
          }
          if (!withdrawButton) break;
          withdrawButton.click();
          ejectionCount++;
          await sleep(1000);
        }
      }

      // Fill any empty slots from the queue
      if (config.queue.length > 0) {
        await fillEmptySlotsFromQueue();
      }

      if (!dialogAlreadyOpen) {
        clickAllCloseButtons();
        await sleep(500);
        // Verify the Close click actually landed — if the dialog is still there (e.g. its footer
        // re-rendered mid-click and our button reference went stale), fall back to Escape rather
        // than leaving it open until the next automation pass.
        if (findOpenDaycareDialog()) {
          console.warn('[Better Daycare] Daycare dialog still open after Close click, falling back to Escape');
          simulateEscKey();
          await sleep(300);
        }
        await handleScrollLockCheck();
      }
    } catch (error) {
      console.error('[Better Daycare] Error handling daycare:', error);
    } finally {
      setHandlingDaycareCoordination(false);
    }
  }

  let automationTimer = null;

  function getAutomationInterval() {
    return document.hidden ? 10000 : 5000;
  }

  function runLoop() {
    runDaycareCycle().finally(() => {
      automationTimer = setTimeout(runLoop, getAutomationInterval());
    });
  }

  function startAutomationLoop() {
    if (automationTimer) return;
    runLoop();
  }

  function stopAutomationLoop() {
    if (automationTimer) {
      clearTimeout(automationTimer);
      automationTimer = null;
    }
  }

  // =======================
  // 5. Native Daycare dialog: Settings tab
  // =======================

  let panelVisible = false;
  let panelElement = null;
  let pickerHolderEl = null;
  let queueListHolderEl = null;

  function isDaycareDialog(dialog) {
    if (!dialog) return false;
    // Icon-based match, not title text — the dialog's title is localized (e.g. "Creche" in
    // Portuguese instead of "Daycare"), but the info-row icon's alt stays "Daycare" in every locale
    // we've seen. The Inventory dialog also contains a "Daycare" icon (the nav button that opens
    // this dialog), so we additionally require it NOT be inside a <button> — the real Daycare
    // dialog shows the icon as a plain, non-clickable image in its own info-row.
    const daycareIcon = dialog.querySelector('img[alt="Daycare"], img[alt="daycare"]');
    return !!daycareIcon && !daycareIcon.closest('button');
  }

  function findOpenDaycareDialog() {
    const dialogs = document.querySelectorAll('div[role="dialog"][data-state="open"]');
    for (const dialog of dialogs) {
      if (isDaycareDialog(dialog)) return dialog;
    }
    return null;
  }

  function isNativeCreaturePickerActive(footer) {
    return Array.from(footer.querySelectorAll('button')).some(
      (btn) => btn.textContent?.trim() === 'Add to Daycare'
    );
  }

  function applyDialogTitle(dialog) {
    // Always rebrand the title, regardless of whether the Settings panel is open. Keep the game's
    // native title color — don't override it.
    const titleEls = dialog.querySelectorAll('h2.widget-top-text p, .widget-top-text p');
    titleEls.forEach((p) => {
      if (p.textContent !== 'Better Daycare') {
        p.textContent = 'Better Daycare';
      }
      if (p.style.color) {
        p.style.removeProperty('color');
      }
    });
  }

  function updateDaycareTooltip(dialog) {
    const tooltip = dialog.querySelector('.tooltip-prose');
    if (!tooltip) return;

    // Icon-based, not text/title-based — both the Withdraw button's title attribute and the empty
    // slot's "Add creature" label are localized (e.g. "Retirar" / "Adicionar criatura" in
    // Portuguese), while the arrow-up-right and plus icons are the same in every locale.
    const occupiedCount = dialog.querySelectorAll('button:has(svg.lucide-arrow-up-right)').length;
    const emptySlotCount = dialog.querySelectorAll('button:has(svg.lucide-plus)').length;
    const totalSlots = occupiedCount + emptySlotCount;

    const locale = api?.i18n?.getLocale?.() || 'en-US';
    const signature = JSON.stringify([config.autoHandleDaycare, occupiedCount, totalSlots, config.queue.length, locale]);
    if (tooltip.dataset.betterDaycareSignature === signature) return;
    tooltip.dataset.betterDaycareSignature = signature;

    tooltip.innerHTML = '';

    const titleP = document.createElement('p');
    titleP.className = 'inline text-monster';
    titleP.style.color = '#32cd32';
    titleP.textContent = t('mods.betterDaycare.activated');
    tooltip.appendChild(titleP);

    const statusP = document.createElement('p');
    statusP.className = 'inline flex items-center gap-1';
    const statusLabel = document.createElement('span');
    statusLabel.textContent = t('mods.betterDaycare.autohandleLabel');
    statusP.appendChild(statusLabel);
    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.textContent = config.autoHandleDaycare ? t('mods.betterDaycare.statusActive') : t('mods.betterDaycare.statusInactive');
    statusBtn.title = t('mods.betterDaycare.statusButtonTitle');
    const statusColorClass = config.autoHandleDaycare
      ? 'frame-1-green active:frame-pressed-1-green surface-green'
      : 'frame-1-red active:frame-pressed-1-red surface-red';
    statusBtn.className = `focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 ${statusColorClass} gap-1 px-2 py-0.5 pb-[3px] pixel-font-14`;
    statusBtn.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
    statusBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      config.autoHandleDaycare = !config.autoHandleDaycare;
      console.log('[Better Daycare] Autohandle Daycare', config.autoHandleDaycare ? 'ENABLED' : 'DISABLED');
      saveConfig();
    });
    statusP.appendChild(statusBtn);
    tooltip.appendChild(statusP);

    const slotsP = document.createElement('p');
    slotsP.className = 'inline';
    slotsP.textContent = t('mods.betterDaycare.creaturesInDaycareLabel');
    const slotsCountSpan = document.createElement('span');
    if (totalSlots > 0) {
      slotsCountSpan.textContent = `${occupiedCount}/${totalSlots}`;
      slotsCountSpan.style.color = occupiedCount >= totalSlots ? '#32cd32' : '#ff4d4d';
    } else {
      slotsCountSpan.textContent = String(occupiedCount);
    }
    slotsP.appendChild(slotsCountSpan);
    tooltip.appendChild(slotsP);

    const queueP = document.createElement('p');
    queueP.className = 'inline';
    queueP.textContent = t('mods.betterDaycare.inQueueLabel');
    const queueCountSpan = document.createElement('span');
    queueCountSpan.textContent = String(config.queue.length);
    if (config.queue.length === 0) {
      queueCountSpan.style.color = '#ff4d4d';
    }
    queueP.appendChild(queueCountSpan);
    tooltip.appendChild(queueP);
  }

  // Shared by renderQueuePicker and renderQueueList — both render a wrapped flex grid of portraits,
  // backed by the UI Components scroll container when available, and both need their "nothing here"
  // message centered (both axes) within that grid's fixed-height box instead of stuck top-left.
  function showEmptyStateInGrid(grid, text) {
    grid.style.cssText += 'width: 100%; height: 100%; justify-content: center; align-items: center;';
    const p = document.createElement('p');
    p.className = 'text-whiteDark';
    p.style.textAlign = 'center';
    p.textContent = text;
    grid.appendChild(p);
  }

  function appendScrollableGrid(container, grid, height) {
    if (api?.ui?.components?.createScrollContainer) {
      const scroll = api.ui.components.createScrollContainer({ height, padding: true, content: grid });
      container.appendChild(scroll.element);
    } else {
      grid.style.maxHeight = `${height}px`;
      grid.style.overflowY = 'auto';
      container.appendChild(grid);
    }
  }

  function removeQueueItem(index) {
    config.queue.splice(index, 1);
    saveConfig();
    refreshPanelContent();
  }

  // Builds a portrait matching the native sprite-based look (same markup the game itself uses for
  // occupied Daycare slots / Cyclopedia's owned-creature cards), instead of going through
  // api.ui.components.createMonsterPortrait — which falls back to a crude gray-square placeholder
  // (wrong level, no sprite) whenever window.BestiaryUIComponents hasn't finished loading yet, and
  // since we only build this panel once and cache it, a bad render at that moment stuck permanently.
  // Real rarity/tier coloring isn't `monster.tier` (that field tracks awaken state, not gene
  // quality) — it's computed from the summed gene stats, same formula Cyclopedia.js uses for its
  // owned-creature rarity borders.
  function computeStatRarity(monster) {
    const statSum = (Number(monster.hp) || 0) + (Number(monster.ad) || 0) + (Number(monster.ap) || 0)
      + (Number(monster.armor) || 0) + (Number(monster.magicResist) || 0);
    if (statSum >= 80) return 5;
    if (statSum >= 70) return 4;
    if (statSum >= 60) return 3;
    if (statSum >= 50) return 2;
    return 1;
  }

  // Small static-portrait style, matching the native inventory/creature-picker button markup
  // (container-slot + portrait image), rather than the larger animated full-monster sprite.
  function buildMonsterPortraitElement(monster, onClick, badgeNumber) {
    const level = getMonsterLevel(monster);
    const isShiny = monster.shiny === true;
    const isAwakened = Number(monster.tier) === AWAKENED_TIER;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'focus-style-visible relative touch-none select-none';
    button.style.cssText = 'width: 34px; height: 34px;';

    const slot = document.createElement('div');
    slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden pointer-events-none';
    button.appendChild(slot);

    if (isShiny) {
      const starIcon = document.createElement('img');
      starIcon.alt = 'star tier';
      starIcon.src = '/assets/icons/star-tier-shiny.png';
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.style.cssText = 'filter: drop-shadow(black 0px 0px 1px);';
      slot.appendChild(starIcon);
    }

    const rarityBg = document.createElement('div');
    rarityBg.setAttribute('role', 'none');
    if (isShiny) {
      rarityBg.className = 'absolute inset-0 z-1 opacity-80 rarity-shiny';
    } else if (isAwakened) {
      rarityBg.className = 'absolute inset-0 z-1 opacity-80 rarity-awaken';
    } else {
      rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
      rarityBg.setAttribute('data-rarity', String(computeStatRarity(monster)));
    }
    slot.appendChild(rarityBg);

    const levelContainer = document.createElement('div');
    levelContainer.className = 'pixel-font-16 absolute bottom-0 left-0 z-1 flex size-full items-end pl-0.5 text-whiteExp';
    levelContainer.style.cssText = 'line-height: 0.8; background: radial-gradient(circle at left bottom, rgba(0, 0, 0, 0.5) 6px, transparent 24px);';
    // Native buttons draw this number via a transparent span + canvas that the game's own
    // font-outline renderer paints into — since we can't trigger that renderer, use plain visible
    // text instead (the transparent+canvas combo would otherwise render nothing at all).
    const levelSpan = document.createElement('span');
    levelSpan.className = 'relative revert-pixel-font-spacing -translate-x-px';
    levelSpan.style.cssText = 'line-height: 0.9; font-size: 16px; color: #fff; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;';
    levelSpan.textContent = String(level);
    levelContainer.appendChild(levelSpan);
    slot.appendChild(levelContainer);

    const portraitImg = document.createElement('img');
    portraitImg.className = 'pixelated ml-auto';
    portraitImg.alt = 'creature';
    portraitImg.width = 32;
    portraitImg.height = 32;
    portraitImg.src = `/assets/portraits/${monster.gameId}${isShiny ? '-shiny' : ''}.png`;
    slot.appendChild(portraitImg);

    if (isShiny) {
      const heart = document.createElement('div');
      heart.className = 'favorite-heart pixelated';
      heart.style.cssText = 'position: absolute; bottom: 1px; right: 0px; z-index: 3; width: 12px; height: 12px; pointer-events: none;';
      const heartImg = document.createElement('img');
      heartImg.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
      heartImg.width = 12;
      heartImg.height = 12;
      heartImg.alt = 'Shiny';
      heartImg.style.imageRendering = 'pixelated';
      heart.appendChild(heartImg);
      slot.appendChild(heart);
    }

    if (badgeNumber != null) {
      const badge = document.createElement('span');
      badge.className = 'pixel-font-14 absolute left-0.5 top-0 z-4';
      badge.style.cssText = 'color: #fff; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; line-height: 1;';
      badge.textContent = String(badgeNumber);
      slot.appendChild(badge);
    }

    button.title = `${getMonsterName(monster)} (Lv. ${level})`;
    if (onClick) {
      button.style.cursor = 'pointer';
      button.addEventListener('click', onClick);
      button.draggable = true;
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(monster.id));
        // 'copy' when dragging from the picker (add), 'move' when reordering within the queue
        // (see renderQueueList's dragover) — both must be allowed here, or the browser silently
        // refuses to fire 'drop' when the dropEffect doesn't match effectAllowed.
        event.dataTransfer.effectAllowed = 'copyMove';
        button.style.opacity = '0.5';
      });
      button.addEventListener('dragend', () => {
        button.style.opacity = '';
      });
    }

    wrapper.appendChild(button);
    return wrapper;
  }

  function renderQueuePicker(container) {
    container.innerHTML = '';

    const monsterIdsInDaycare = getMonsterIdsCurrentlyInDaycare();
    const monsters = getOwnedMonsters().filter(
      (m) => !isMonsterMaxed(m) && !isGazer(m)
        && !monsterIdsInDaycare.has(String(m.id))
        && !config.queue.some((id) => String(id) === String(m.id))
    );

    // Same ordering Cyclopedia.js uses for its owned-creature list: level desc, then tier desc,
    // then gene-stat rarity desc.
    monsters.sort((a, b) => {
      const levelDiff = getMonsterLevel(b) - getMonsterLevel(a);
      if (levelDiff !== 0) return levelDiff;

      const tierDiff = (Number(b.tier) || 1) - (Number(a.tier) || 1);
      if (tierDiff !== 0) return tierDiff;

      return computeStatRarity(b) - computeStatRarity(a);
    });

    const grid = document.createElement('div');
    grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

    if (monsters.length === 0) {
      showEmptyStateInGrid(grid, t('mods.betterDaycare.noEligibleCreatures'));
    } else {
      monsters.forEach((monster) => {
        const portrait = buildMonsterPortraitElement(monster, () => {
          config.queue.push(String(monster.id));
          saveConfig();
          refreshPanelContent();
        });
        grid.appendChild(portrait);
      });
    }

    appendScrollableGrid(container, grid, 130);
  }

  // A dedicated dataTransfer key for reordering within the queue grid, separate from the plain
  // monster-id payload used to add a creature from the picker — keeps the two drag interactions
  // (add vs. reorder) from colliding when a queue chip is dropped onto another queue chip.
  const QUEUE_REORDER_DND_TYPE = 'application/x-better-daycare-queue-index';

  function renderQueueList(container) {
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

    if (!config.queue.length) {
      showEmptyStateInGrid(grid, t('mods.betterDaycare.queueEmpty'));
    }

    const monsters = getOwnedMonsters();
    const byId = new Map(monsters.map((m) => [String(m.id), m]));

    config.queue.forEach((id, index) => {
      const monster = byId.get(String(id));

      let chip;
      if (monster) {
        chip = buildMonsterPortraitElement(monster, () => removeQueueItem(index), index + 1);
      } else {
        chip = document.createElement('div');
        chip.className = 'flex';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = t('mods.betterDaycare.removeUnavailableTitle');
        btn.className = 'focus-style-visible relative touch-none select-none';
        btn.style.cssText = 'width: 34px; height: 34px; cursor: pointer; opacity: 0.4;';
        const slot = document.createElement('div');
        slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden';
        slot.textContent = '?';
        btn.appendChild(slot);
        btn.addEventListener('click', () => removeQueueItem(index));
        chip.appendChild(btn);
      }

      const chipButton = chip.querySelector('button');
      chipButton.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData(QUEUE_REORDER_DND_TYPE, String(index));
      });
      chipButton.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
      });
      chipButton.addEventListener('drop', (event) => {
        const draggedIndexRaw = event.dataTransfer.getData(QUEUE_REORDER_DND_TYPE);
        if (draggedIndexRaw === '') return; // not a reorder drag (e.g. dropped from the picker) — let it bubble
        event.preventDefault();
        event.stopPropagation();
        const draggedIndex = Number(draggedIndexRaw);
        if (Number.isNaN(draggedIndex) || draggedIndex === index) return;
        const [item] = config.queue.splice(draggedIndex, 1);
        config.queue.splice(index, 0, item);
        saveConfig();
        refreshPanelContent();
      });

      grid.appendChild(chip);
    });

    appendScrollableGrid(container, grid, 110);
  }

  function refreshPanelContent() {
    // Rendering into a detached node is fine — it'll show correctly once ensureDaycareDialogState
    // (re-)inserts the panel. Requiring attachment here used to skip the very first render after
    // reopening the Queue tab, since the "Queue" button's click handler calls this before the panel
    // is re-inserted into the dialog, leaving the eligible-creature list stale until toggled again.
    if (!pickerHolderEl || !queueListHolderEl) return;
    renderQueuePicker(pickerHolderEl);
    renderQueueList(queueListHolderEl);
  }

  function buildBetterDaycarePanel() {
    const panel = document.createElement('div');
    panel.className = 'better-daycare-panel flex flex-col';

    const pickerLabel = document.createElement('p');
    pickerLabel.className = 'mb-1';
    pickerLabel.textContent = t('mods.betterDaycare.selectCreatureLabel');
    panel.appendChild(pickerLabel);

    pickerHolderEl = document.createElement('div');
    pickerHolderEl.style.cssText = 'border: 2px dashed transparent; border-radius: 4px; transition: border-color 0.1s;';
    // Dropping a queued creature back onto the picker removes it from the queue — the mirror of
    // dragging a picker creature into the queue box to add it.
    pickerHolderEl.addEventListener('dragover', (event) => {
      if (!event.dataTransfer.types.includes(QUEUE_REORDER_DND_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      pickerHolderEl.style.borderColor = '#ff4d4d';
    });
    pickerHolderEl.addEventListener('dragleave', () => {
      pickerHolderEl.style.borderColor = 'transparent';
    });
    pickerHolderEl.addEventListener('drop', (event) => {
      pickerHolderEl.style.borderColor = 'transparent';
      const draggedIndexRaw = event.dataTransfer.getData(QUEUE_REORDER_DND_TYPE);
      if (draggedIndexRaw === '') return; // not a queue chip being dragged
      event.preventDefault();
      const draggedIndex = Number(draggedIndexRaw);
      if (Number.isNaN(draggedIndex)) return;
      removeQueueItem(draggedIndex);
    });
    panel.appendChild(pickerHolderEl);

    const separator = document.createElement('div');
    separator.setAttribute('role', 'none');
    separator.className = 'separator my-2.5';
    panel.appendChild(separator);

    const queueListLabel = document.createElement('p');
    queueListLabel.className = 'mb-1';
    queueListLabel.textContent = t('mods.betterDaycare.queueOrderLabel');
    panel.appendChild(queueListLabel);

    queueListHolderEl = document.createElement('div');
    queueListHolderEl.style.cssText = 'min-height: 40px; border: 2px dashed transparent; border-radius: 4px; transition: border-color 0.1s;';
    queueListHolderEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      queueListHolderEl.style.borderColor = '#32cd32';
    });
    queueListHolderEl.addEventListener('dragleave', () => {
      queueListHolderEl.style.borderColor = 'transparent';
    });
    queueListHolderEl.addEventListener('drop', (event) => {
      event.preventDefault();
      queueListHolderEl.style.borderColor = 'transparent';
      const droppedId = event.dataTransfer.getData('text/plain');
      if (!droppedId) return;
      if (config.queue.some((id) => String(id) === String(droppedId))) return;
      config.queue.push(String(droppedId));
      saveConfig();
      refreshPanelContent();
    });
    panel.appendChild(queueListHolderEl);

    const footerSeparator = document.createElement('div');
    footerSeparator.setAttribute('role', 'none');
    footerSeparator.className = 'separator my-2.5';
    panel.appendChild(footerSeparator);

    renderQueuePicker(pickerHolderEl);
    renderQueueList(queueListHolderEl);

    return panel;
  }

  function settingsButtonLabel() {
    return panelVisible ? t('mods.betterDaycare.backButton') : t('mods.betterDaycare.queueButton');
  }

  function ensureSettingsButton(footer) {
    if (footer.querySelector('#' + SETTINGS_BUTTON_ID)) return;

    const btn = document.createElement('button');
    btn.id = SETTINGS_BUTTON_ID;
    btn.type = 'button';
    btn.textContent = settingsButtonLabel();
    btn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
    btn.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const liveDialog = btn.closest('div[role="dialog"]');
      if (!liveDialog) return;
      panelVisible = !panelVisible;
      btn.textContent = settingsButtonLabel();
      if (panelVisible) refreshPanelContent();
      ensureDaycareDialogState(liveDialog);
    });

    // Same bilingual text match clickAllCloseButtons uses — the native Close button reads "Fechar"
    // in Portuguese, and this lookup was still English-only, so it silently failed to find the
    // button in PT and fell through to appendChild, landing our button *after* Close instead of
    // before it.
    const closeButton = Array.from(footer.querySelectorAll('button')).find((b) => {
      const text = b.textContent.trim();
      return text === 'Close' || text === 'Fechar';
    });
    if (closeButton) {
      footer.insertBefore(btn, closeButton);
    } else {
      footer.appendChild(btn);
    }
  }

  function ensureDaycareDialogState(dialog) {
    try {
      const widgetBottom = dialog.querySelector('.widget-bottom');
      if (!widgetBottom) {
        console.warn('[Better Daycare] ensureDaycareDialogState: no .widget-bottom found on dialog', dialog);
        return;
      }
      const footer = Array.from(widgetBottom.children).find((el) => el.classList.contains('justify-end'));
      if (!footer) {
        console.warn('[Better Daycare] ensureDaycareDialogState: no footer (.justify-end) found', widgetBottom);
        return;
      }

      if (isNativeCreaturePickerActive(footer)) {
        // The game's own "Add creature" picker is showing — our Settings/Back toggle doesn't apply here.
        const existingBtn = footer.querySelector('#' + SETTINGS_BUTTON_ID);
        if (existingBtn) existingBtn.remove();
      } else {
        ensureSettingsButton(footer);
      }

      applyDialogTitle(dialog);
      updateDaycareTooltip(dialog);

      if (!panelElement) {
        panelElement = buildBetterDaycarePanel();
      }

      if (panelVisible) {
        if (panelElement.parentElement !== widgetBottom || panelElement.nextElementSibling !== footer) {
          widgetBottom.insertBefore(panelElement, footer);
        }
        Array.from(widgetBottom.children).forEach((el) => {
          if (el !== panelElement && el !== footer) el.style.display = 'none';
        });
        panelElement.style.display = '';
      } else {
        Array.from(widgetBottom.children).forEach((el) => {
          if (el !== panelElement && el !== footer) el.style.display = '';
        });
        if (panelElement.parentElement === widgetBottom) {
          panelElement.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('[Better Daycare] ensureDaycareDialogState error:', error);
    }
  }

  let daycareDialogWasOpen = false;

  function scanForDaycareDialog() {
    try {
      const found = findOpenDaycareDialog();

      if (!!found !== daycareDialogWasOpen) {
        console.log('[Better Daycare] scanForDaycareDialog: daycareFound changed to', !!found);
      }

      if (found) {
        daycareDialogWasOpen = true;
        ensureDaycareDialogState(found);
      } else if (daycareDialogWasOpen) {
        daycareDialogWasOpen = false;
        panelVisible = false;
        panelElement = null;
        pickerHolderEl = null;
        queueListHolderEl = null;
      }
    } catch (error) {
      console.error('[Better Daycare] scanForDaycareDialog error:', error);
    }
  }

  let dialogObserver = null;

  function startDialogWatcher() {
    scanForDaycareDialog();
    dialogObserver = new MutationObserver(() => scanForDaycareDialog());
    dialogObserver.observe(document.body, { childList: true, subtree: true });
    console.log('[Better Daycare] Dialog watcher started');
  }

  function stopDialogWatcher() {
    if (dialogObserver) {
      dialogObserver.disconnect();
      dialogObserver = null;
    }
  }

  // =======================
  // 5b. Daycare slot watcher — logs whenever a creature actually lands in a slot
  // (manually or via automation), keyed off context.daycareSlots rather than DOM/click success.
  // =======================

  let knownDaycareMonsterIds = new Set();
  let playerStateUnsubscribe = null;

  function logDaycareSlotAdditions(playerContext) {
    try {
      const slots = playerContext?.daycareSlots;
      if (!Array.isArray(slots)) return;
      const currentIds = new Set(slots.filter((s) => s?.monsterId != null).map((s) => String(s.monsterId)));

      for (const id of currentIds) {
        if (knownDaycareMonsterIds.has(id)) continue;
        const monster = (playerContext.monsters || []).find((m) => String(m.id) === id);
        const slot = slots.find((s) => String(s.monsterId) === id);
        console.log('[Better Daycare] Creature added to daycare:', {
          slotId: slot?.id,
          monsterId: id,
          name: monster ? getMonsterName(monster) : undefined,
          level: monster ? getMonsterLevel(monster) : undefined,
          gameId: monster?.gameId,
          leftAt: slot?.leftAt
        });
      }

      knownDaycareMonsterIds = currentIds;
    } catch (error) {
      console.error('[Better Daycare] logDaycareSlotAdditions error:', error);
    }
  }

  function startDaycareSlotWatcher() {
    try {
      knownDaycareMonsterIds = new Set(
        getDaycareSlots().filter((s) => s?.monsterId != null).map((s) => String(s.monsterId))
      );
      playerStateUnsubscribe = globalThis.state?.player?.subscribe?.((snap) => {
        logDaycareSlotAdditions(snap?.context);
      }) || null;
    } catch (error) {
      console.error('[Better Daycare] startDaycareSlotWatcher error:', error);
    }
  }

  function stopDaycareSlotWatcher() {
    if (typeof playerStateUnsubscribe === 'function') {
      playerStateUnsubscribe();
      playerStateUnsubscribe = null;
    }
  }

  // =======================
  // 6. Init
  // =======================

  function init() {
    cleanupInvalidQueueEntries();
    startAutomationLoop();
    startDialogWatcher();
    startDaycareSlotWatcher();
    console.log('[Better Daycare] Initialization complete');
  }

  init();

  exports = {
    getQueue: () => config.queue.slice(),
    updateConfig: (newConfig) => {
      if ('autoHandleDaycare' in newConfig && newConfig.autoHandleDaycare !== config.autoHandleDaycare) {
        console.log('[Better Daycare] Autohandle Daycare', newConfig.autoHandleDaycare ? 'ENABLED' : 'DISABLED', '(via updateConfig)');
      }
      Object.assign(config, newConfig);
      saveConfig();
      refreshPanelContent();
    },
    cleanup: () => {
      stopAutomationLoop();
      stopDialogWatcher();
      stopDaycareSlotWatcher();
      try {
        window.ModCoordination?.unregisterMod(MOD_NAME);
      } catch (_) {}
      panelElement = null;
      pickerHolderEl = null;
      queueListHolderEl = null;
      // Allow a fresh init() to run if the mod gets reloaded/re-enabled without a full page refresh
      // (same convention as Better Bestiary / Awaken Tracker) — otherwise the guard at the top of
      // this file permanently no-ops every future load.
      window.__betterDaycareLoaded = false;
    }
  };
})();
