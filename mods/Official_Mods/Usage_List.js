/**
 * Usage List — equipment & creature usage stats for Bestiary Arena.
 *
 * Consolidates the former Item_tier_list.js and Monster_tier_list.js into one
 * tabbed modal, styled after Highscore_Improvements.js (fixed-size responsive
 * modal, icon tab bar, frame-pressed tab panels with a stats footer).
 *
 * Data source: `globalThis.state.player.getSnapshot().context.boardConfigs` —
 * the single native "Auto-setup" layout the game itself persists per map
 * (the same one the native Auto-setup button loads). This is NOT Setup
 * Manager's own library of named setups (stored separately in
 * localStorage) — a Setup Manager setup only counts here once it has also
 * been saved as that map's Auto-setup. Usage counts are how many maps'
 * Auto-setup places a given creature/equipment, not win rate or any
 * in-battle performance data.
 *
 * Portraits are hover-only (a floating tooltip with usage stats and the
 * list of maps it's used on) — there is no click behavior.
 *
 * Required globals: globalThis.state, context.api
 *
 * Lifecycle: module load registers toolbar button → showUsageListModal() → exports.cleanup()
 *
 * SECTION INDEX (line numbers shift as code moves):
 *   1. Configuration & Constants
 *   2. Global State
 *   3. Modal Layout & Shell
 *   4. Hover Tooltip
 *   5. Usage Bucketing
 *   6. Tab Content Builders
 *   7. Tab Shell
 *   8. Modal Orchestration
 *   9. Entry Point & Exports
 */
// =======================
// 1. Configuration
// =======================

const USAGE_LIST_MODAL_CONFIG = {
  width: 500,
  height: 600,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 240
};
const USAGE_LIST_MODAL_ID = 'usage-list-modal';
const USAGE_LIST_BUTTON_ID = 'usage-list-button';

const USAGE_TIER_LABELS = ['S', 'A', 'B', 'C'];

const USAGE_TAB_ICON_SIZE = 12;
const USAGE_TAB_ICONS = {
  creatures: { src: '/assets/icons/enemy.png', alt: 'Creatures' },
  equipment: { src: '/assets/icons/equips.png', alt: 'Equipment' }
};

const USAGE_LIST_EXPLAINER = "Counts how often each creature/equipment appears across the board configurations you've saved via each map's Auto-setup.";

// =======================
// 2. Global State
// =======================

const t = (key) => api.i18n.t(key);

let activeUsageListModal = null;
let usageListModalLayoutCleanup = null;
let usageListModalTabsCleanup = null;
let activeUsageListTooltip = null;

// =======================
// 3. Modal Layout & Shell
// =======================

function tagUsageListModalElement(modalRef) {
  const dialog = getUsageListDialog(modalRef);
  if (dialog) {
    dialog.id = USAGE_LIST_MODAL_ID;
  }
  return dialog;
}

function getUsageListDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function getUsageListModalDimensions() {
  const pad = USAGE_LIST_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      USAGE_LIST_MODAL_CONFIG.minWidth,
      Math.min(USAGE_LIST_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      USAGE_LIST_MODAL_CONFIG.minHeight,
      Math.min(USAGE_LIST_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function clearUsageListModalLayoutCleanup() {
  if (usageListModalLayoutCleanup) {
    usageListModalLayoutCleanup();
    usageListModalLayoutCleanup = null;
  }
}

function clearUsageListModalTabsCleanup() {
  if (usageListModalTabsCleanup) {
    usageListModalTabsCleanup();
    usageListModalTabsCleanup = null;
  }
}

function clearUsageListModalCleanup() {
  closeUsageListTooltip();
  clearUsageListModalTabsCleanup();
  clearUsageListModalLayoutCleanup();
}

function closeUsageListModal() {
  if (activeUsageListModal?.close) {
    activeUsageListModal.close();
  }
  clearUsageListModalCleanup();
  activeUsageListModal = null;
}

function applyUsageListModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getUsageListDialog(modalRef);
  if (!dialog) return;

  const { width, height } = dimensions;

  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]', 'w-full');

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0'
    });
  }

  const widgetBottom = dialog.querySelector('.widget-bottom');
  if (widgetBottom) {
    Object.assign(widgetBottom.style, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }
}

function setupUsageListModalResponsiveLayout(modalRef, contentRoot) {
  clearUsageListModalLayoutCleanup();
  activeUsageListModal = modalRef;

  const apply = () => applyUsageListModalLayout(
    modalRef,
    contentRoot,
    getUsageListModalDimensions()
  );
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);

  let modalCloseObserver = null;
  const dialog = getUsageListDialog(modalRef);
  if (dialog) {
    modalCloseObserver = new MutationObserver(() => {
      if (!document.contains(dialog) || dialog.getAttribute('data-state') === 'closed') {
        clearUsageListModalCleanup();
        if (activeUsageListModal === modalRef) {
          activeUsageListModal = null;
        }
      }
    });
    modalCloseObserver.observe(dialog, { attributes: true, attributeFilter: ['data-state'] });
    modalCloseObserver.observe(document.body, { childList: true, subtree: true });
  }

  usageListModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (modalCloseObserver) {
      modalCloseObserver.disconnect();
      modalCloseObserver = null;
    }
    if (activeUsageListModal === modalRef) {
      activeUsageListModal = null;
    }
  };
}

// =======================
// 4. Hover Tooltip
// =======================

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Same rarity palette as the game's own .has-rarity[data-rarity] backgrounds (ui_components.js), brightened for text. */
const USAGE_TIER_COLORS = {
  1: '#aaaaaa',
  2: '#43c463',
  3: '#5c8dff',
  4: '#c15fe0',
  5: '#ffa733'
};

function getUsageTierColor(tier) {
  return USAGE_TIER_COLORS[tier] || USAGE_TIER_COLORS[1];
}

const USAGE_STAT_COLORS = {
  ad: '#ff6b6b',
  ap: '#5c8dff',
  hp: '#4caf50'
};

function getUsageStatColor(stat) {
  return USAGE_STAT_COLORS[stat] || USAGE_STAT_COLORS.ad;
}

/** Colored accent strip along the tooltip's top edge, giving each tier its own identity at a glance. */
function buildTooltipAccentBar(color) {
  return `<div style="height:3px; margin:-8px -10px 8px -10px; border-radius:6px 6px 0 0; background:${color};"></div>`;
}

function buildTooltipTierBadge(tier, color) {
  return `<span style="background:${color}; color:#111; font-weight:bold; font-size:10px; padding:1px 5px; border-radius:3px;">T${tier}</span>`;
}

function closeUsageListTooltip() {
  if (activeUsageListTooltip) {
    activeUsageListTooltip.remove();
    activeUsageListTooltip = null;
  }
}

function showUsageListTooltip(anchorEl, html) {
  closeUsageListTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'pixel-font-14';
  tooltip.style.cssText = `
    position: fixed;
    z-index: 10000001;
    max-width: 240px;
    background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
    border: 4px solid transparent;
    border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
    border-radius: 6px;
    padding: 8px 10px;
    color: #eee;
    font-size: 12px;
    line-height: 1.4;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  `;
  tooltip.innerHTML = html;
  document.body.appendChild(tooltip);

  const anchorRect = anchorEl.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const padding = 8;

  let left = anchorRect.right + padding;
  if (left + tooltipRect.width + padding > window.innerWidth) {
    left = anchorRect.left - tooltipRect.width - padding;
  }
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

  const top = Math.max(padding, Math.min(anchorRect.top, window.innerHeight - tooltipRect.height - padding));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  activeUsageListTooltip = tooltip;
}

function attachUsageListHoverTooltip(wrapperEl, buildHtml) {
  wrapperEl.addEventListener('mouseenter', () => showUsageListTooltip(wrapperEl, buildHtml()));
  wrapperEl.addEventListener('mouseleave', () => closeUsageListTooltip());
}

/** Renders a "Used on" section grouped by region, each region on its own line, in canonical order. */
function formatUsedOnHtml(regionGroups) {
  if (!regionGroups.length) return '<div style="color:#888;">—</div>';
  return regionGroups
    .map((group) => `<div><span style="color:#8ab4f8; font-weight:bold;">${escapeHtml(group.regionName)}:</span> <span style="color:#ddd;">${escapeHtml(group.rooms.join(', '))}</span></div>`)
    .join('');
}

// =======================
// 5. Usage Bucketing
// =======================

/** Splits a usage list (sorted desc by count) into S/A/B/C buckets by save-count. */
function bucketUsageIntoTiers(list) {
  return [
    list.filter((item) => item.count >= 10), // Tier S: 10+
    list.filter((item) => item.count >= 6 && item.count <= 9), // Tier A: 6-9
    list.filter((item) => item.count >= 2 && item.count <= 5), // Tier B: 2-5
    list.filter((item) => item.count === 1) // Tier C: 1
  ];
}

/** Ties favor the higher tier (best-owned copy) since tiers are iterated ascending. */
function pickMostUsedTier(tierCounts) {
  let bestTier = 1;
  let bestCount = -1;
  for (let tier = 1; tier <= 5; tier++) {
    const count = tierCounts?.[tier] || 0;
    if (count >= bestCount) {
      bestCount = count;
      bestTier = tier;
    }
  }
  return bestTier;
}

function getUsageListRoomNames() {
  return globalThis.state.utils.ROOM_NAME || {};
}

/**
 * Event maps (dynamic raids) rotate in and out and aren't a stable part of anyone's Auto-setup
 * roster, so — same rationale as Highscore_Improvements.js's isCountedRoomForImprovements —
 * they're excluded entirely from usage counting, not just from the "Used on" list.
 */
function isUsageListCountedRoom(roomCode) {
  const db = globalThis.mapsDatabase;
  if (db && typeof db.isDynamicEventMap === 'function') {
    return !db.isDynamicEventMap(roomCode);
  }
  return true;
}

/** Room → region lookup built from state.utils.REGIONS (same source maps-database.js reads). */
function buildRoomRegionLookup() {
  const lookup = new Map();
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (Array.isArray(regions)) {
      for (const region of regions) {
        if (!Array.isArray(region?.rooms)) continue;
        for (const room of region.rooms) {
          if (room?.id) lookup.set(room.id, region.id);
        }
      }
    }
  } catch (_) { /* ignore */ }
  return lookup;
}

/** Region ids in canonical game order, via maps-database.js when available. */
function getUsageListOrderedRegionIds() {
  const db = globalThis.mapsDatabase;
  if (db && typeof db.getRegionsInOrder === 'function') {
    return db.getRegionsInOrder().map((region) => region.id);
  }
  return [];
}

function getUsageListRegionDisplayName(regionId) {
  const db = globalThis.mapsDatabase;
  if (db && typeof db.getRegionDisplayName === 'function') {
    return db.getRegionDisplayName(regionId);
  }
  return regionId || 'Unknown Region';
}

/** Sorts room codes by canonical in-game playing order (maps-database.js), falling back to alphabetical. */
function compareRoomCodesByGameOrder(a, b) {
  const db = globalThis.mapsDatabase;
  if (db && typeof db.compareMapsByGameOrder === 'function') {
    return db.compareMapsByGameOrder(a, b);
  }
  return String(a).localeCompare(String(b));
}

/**
 * Groups room codes by region and returns them region-first in canonical game order, with each
 * region's own rooms in canonical playing order too. Rooms with no known region are grouped last
 * under "Other".
 */
function groupRoomCodesByRegion(roomCodes, roomRegionLookup, roomNames) {
  const UNKNOWN_REGION = '__unknown__';
  const groups = new Map();

  for (const code of roomCodes) {
    const regionId = roomRegionLookup.get(code) || UNKNOWN_REGION;
    const bucket = groups.get(regionId) || [];
    bucket.push(code);
    groups.set(regionId, bucket);
  }

  const orderedRegionIds = [];
  const seen = new Set();
  for (const regionId of getUsageListOrderedRegionIds()) {
    if (groups.has(regionId) && !seen.has(regionId)) {
      orderedRegionIds.push(regionId);
      seen.add(regionId);
    }
  }
  for (const regionId of groups.keys()) {
    if (!seen.has(regionId)) {
      orderedRegionIds.push(regionId);
      seen.add(regionId);
    }
  }

  return orderedRegionIds.map((regionId) => ({
    regionName: regionId === UNKNOWN_REGION ? 'Other' : getUsageListRegionDisplayName(regionId),
    rooms: groups.get(regionId)
      .slice()
      .sort(compareRoomCodesByGameOrder)
      .map((code) => roomNames[code] || code)
  }));
}

// =======================
// 6. Tab Content Builders
// =======================

function createUsageListScrollContainer() {
  const scrollContainer = api.ui.components.createScrollContainer({
    height: '100%',
    padding: true,
    content: ''
  });
  Object.assign(scrollContainer.element.style, {
    flex: '1 1 0',
    minHeight: '0',
    height: 'auto',
    width: '100%',
    position: 'relative',
    overflow: 'hidden'
  });
  return scrollContainer;
}

function createUsageListEmptyState(message) {
  const emptyEl = document.createElement('div');
  emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
  emptyEl.textContent = message;
  return emptyEl;
}

/**
 * createItemPortrait() (real and fallback) returns a <button>, meant for click handling we no
 * longer use here (portraits are hover-only). Unwraps it into a plain <div> with the same
 * children so it doesn't carry button semantics/focus outline/active-state styling.
 */
function unwrapPortraitButton(portraitEl) {
  if (!(portraitEl instanceof HTMLElement) || portraitEl.tagName !== 'BUTTON') return portraitEl;
  const replacement = document.createElement('div');
  while (portraitEl.firstChild) {
    replacement.appendChild(portraitEl.firstChild);
  }
  return replacement;
}

function buildCreaturesTabContent() {
  const { monsters, boardConfigs } = globalThis.state.player.getSnapshot().context;
  const monsterLookup = new Map(monsters.map((m) => [m.id, m.gameId]));
  const roomNames = getUsageListRoomNames();
  const roomRegionLookup = buildRoomRegionLookup();

  const countMap = new Map();
  const tierUsageMap = new Map();
  const roomUsageMap = new Map();

  monsters.forEach((monster) => {
    if (!tierUsageMap.has(monster.gameId)) {
      tierUsageMap.set(monster.gameId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    }
  });

  Object.entries(boardConfigs).forEach(([roomCode, cfgs]) => {
    if (!isUsageListCountedRoom(roomCode)) return;

    cfgs.forEach(({ monsterId }) => {
      if (monsterId == null) return;
      const gid = monsterLookup.get(monsterId);
      if (gid == null) return;

      countMap.set(gid, (countMap.get(gid) || 0) + 1);

      const monster = monsters.find((m) => m.id === monsterId);
      if (monster && Number.isFinite(monster.tier)) {
        const tierCounts = tierUsageMap.get(gid) || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const clampedTier = Math.min(5, Math.max(1, monster.tier));
        tierCounts[clampedTier]++;
        tierUsageMap.set(gid, tierCounts);
      }

      const rooms = roomUsageMap.get(gid) || new Set();
      rooms.add(roomCode);
      roomUsageMap.set(gid, rooms);
    });
  });

  const total = Array.from(countMap.values()).reduce((a, b) => a + b, 0);
  const list = Array.from(countMap.entries())
    .map(([gameId, cnt]) => ({
      gameId,
      count: cnt,
      tier: pickMostUsedTier(tierUsageMap.get(gameId)),
      regionGroups: groupRoomCodesByRegion(Array.from(roomUsageMap.get(gameId) || []), roomRegionLookup, roomNames)
    }))
    .sort((a, b) => b.count - a.count);

  const tiers = bucketUsageIntoTiers(list);
  const scrollContainer = createUsageListScrollContainer();

  if (list.length > 0) {
    tiers.forEach((chunk, idx) => {
      if (chunk.length === 0) return;

      const tierHeader = document.createElement('h3');
      tierHeader.textContent = `Tier ${USAGE_TIER_LABELS[idx] || idx + 1}`;
      tierHeader.style.cssText = 'margin: 8px 0 4px; font-size: 1.2rem; border-bottom: 1px solid #444; padding-bottom: 2px; color: white;';

      const monsterContainer = document.createElement('div');
      monsterContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;';

      chunk.forEach((monster) => {
        let monsterName = `Monster #${monster.gameId}`;
        try {
          const monsterData = globalThis.state.utils.getMonster(monster.gameId);
          if (monsterData?.metadata?.name) monsterName = monsterData.metadata.name;
        } catch (e) { /* ignore */ }

        const monsterWrapper = document.createElement('div');
        monsterWrapper.style.cssText = 'position: relative; width: 34px; height: 34px;';

        const monsterPortrait = api.ui.components.createMonsterPortrait({
          monsterId: monster.gameId,
          level: monster.count,
          tier: monster.tier
        });

        attachUsageListHoverTooltip(monsterWrapper, () => {
          const tierColor = getUsageTierColor(monster.tier);
          return `
            ${buildTooltipAccentBar(tierColor)}
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
              <span style="font-weight:bold; color:#fff;">${escapeHtml(monsterName)}</span>
              ${buildTooltipTierBadge(monster.tier, tierColor)}
            </div>
            <div style="color:#ffd54f;">Used <strong>${monster.count}</strong> times</div>
            <div style="margin-top:6px; color:#aaa;">Used on:</div>
            ${formatUsedOnHtml(monster.regionGroups)}
          `;
        });

        monsterWrapper.appendChild(monsterPortrait);
        monsterContainer.appendChild(monsterWrapper);
      });

      scrollContainer.addContent(tierHeader);
      scrollContainer.addContent(monsterContainer);
    });
  } else {
    scrollContainer.addContent(createUsageListEmptyState('No creature usage data yet. Save at least one map\'s board layout as its Auto-setup first.'));
  }

  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  statsContainer.innerHTML = `
    <div>Distinct creatures tracked: ${list.length}</div>
    <div>Total creature placements: ${total}</div>
    <div style="color: #999; font-size: 11px; margin-top: 4px;">${USAGE_LIST_EXPLAINER}</div>
  `;

  return { scrollContainer, statsContainer };
}

/** Equipment usage is split per stat variant, so "Fire Axe (AD)" and "Fire Axe (AP)" are tracked separately. */
function buildEquipmentEntryKey(gameId, stat) {
  return `${gameId}::${stat || 'none'}`;
}

function buildEquipmentTabContent() {
  const { equips, boardConfigs } = globalThis.state.player.getSnapshot().context;
  const equipById = new Map(equips.map((equip) => [equip.id, equip]));
  const roomNames = getUsageListRoomNames();
  const roomRegionLookup = buildRoomRegionLookup();

  const entries = new Map();

  const getOrCreateEntry = (gameId, stat) => {
    const key = buildEquipmentEntryKey(gameId, stat);
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        gameId,
        stat: stat || null,
        count: 0,
        tierCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        rooms: new Set()
      };
      entries.set(key, entry);
    }
    return entry;
  };

  Object.entries(boardConfigs).forEach(([roomCode, cfgs]) => {
    if (!isUsageListCountedRoom(roomCode)) return;

    cfgs.forEach(({ equipId }) => {
      if (equipId == null) return;
      const equip = equipById.get(equipId);
      if (!equip) return;

      const entry = getOrCreateEntry(equip.gameId, equip.stat);
      entry.count++;
      if (Number.isFinite(equip.tier)) {
        const clampedTier = Math.min(5, Math.max(1, equip.tier));
        entry.tierCounts[clampedTier]++;
      }
      entry.rooms.add(roomCode);
    });
  });

  const total = Array.from(entries.values()).reduce((sum, entry) => sum + entry.count, 0);
  const list = Array.from(entries.values())
    .map((entry) => ({
      gameId: entry.gameId,
      stat: entry.stat,
      count: entry.count,
      tier: pickMostUsedTier(entry.tierCounts),
      regionGroups: groupRoomCodesByRegion(Array.from(entry.rooms), roomRegionLookup, roomNames)
    }))
    .sort((a, b) => b.count - a.count);

  const tiers = bucketUsageIntoTiers(list);
  const scrollContainer = createUsageListScrollContainer();

  if (list.length > 0) {
    tiers.forEach((chunk, idx) => {
      if (chunk.length === 0) return;

      const tierHeader = document.createElement('h3');
      tierHeader.textContent = `Tier ${USAGE_TIER_LABELS[idx] || idx + 1}`;
      tierHeader.style.cssText = 'margin: 8px 0 4px; font-size: 1.2rem; border-bottom: 1px solid #444; padding-bottom: 2px; color: white;';

      const itemContainer = document.createElement('div');
      itemContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;';

      chunk.forEach((item) => {
        let spriteId;
        let equipName = 'Unknown Item';
        try {
          const equipData = globalThis.state.utils.getEquipment(item.gameId);
          spriteId = equipData.metadata.spriteId;
          equipName = equipData.metadata.name;
        } catch (e) {
          spriteId = '';
        }

        const displayStat = item.stat || 'ad';

        const itemWrapper = document.createElement('div');
        itemWrapper.style.cssText = 'position: relative; width: 32px; height: 32px;';

        const itemPortrait = unwrapPortraitButton(api.ui.components.createItemPortrait({
          itemId: spriteId,
          stat: displayStat,
          tier: item.tier
        }));

        attachUsageListHoverTooltip(itemWrapper, () => {
          const tierColor = getUsageTierColor(item.tier);
          const statColor = getUsageStatColor(displayStat);
          return `
            ${buildTooltipAccentBar(tierColor)}
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
              <span style="font-weight:bold; color:#fff;">${escapeHtml(equipName)}</span>
              <span style="background:${statColor}; color:#111; font-weight:bold; font-size:10px; padding:1px 5px; border-radius:3px;">${displayStat.toUpperCase()}</span>
              ${buildTooltipTierBadge(item.tier, tierColor)}
            </div>
            <div style="color:#ffd54f;">Used <strong>${item.count}</strong> times</div>
            <div style="margin-top:6px; color:#aaa;">Used on:</div>
            ${formatUsedOnHtml(item.regionGroups)}
          `;
        });

        const countBadge = document.createElement('div');
        countBadge.textContent = item.count;
        countBadge.style.cssText = 'position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.7); color: white; font-size: 10px; padding: 1px 2px; z-index: 3; border-radius: 2px; line-height: 1;';

        itemWrapper.appendChild(itemPortrait);
        itemWrapper.appendChild(countBadge);
        itemContainer.appendChild(itemWrapper);
      });

      scrollContainer.addContent(tierHeader);
      scrollContainer.addContent(itemContainer);
    });
  } else {
    scrollContainer.addContent(createUsageListEmptyState('No equipment usage data yet. Save at least one map\'s board layout as its Auto-setup first.'));
  }

  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  statsContainer.innerHTML = `
    <div>Distinct equipment variants tracked: ${list.length}</div>
    <div>Total equipment placements: ${total}</div>
    <div style="color: #999; font-size: 11px; margin-top: 4px;">${USAGE_LIST_EXPLAINER}</div>
  `;

  return { scrollContainer, statsContainer };
}

// =======================
// 7. Tab Shell
// =======================

function getUsageListTabButtonClassName(isActive) {
  return isActive
    ? 'frame-pressed-1 surface-regular px-2 py-1 flex-1 tab-active pixel-font-14'
    : 'frame-pressed-1 surface-dark px-2 py-1 flex-1 pixel-font-14';
}

function setUsageListTabButtonLabel(button, iconDef, label) {
  button.replaceChildren();

  const iconWrap = document.createElement('span');
  iconWrap.style.display = 'inline-flex';
  iconWrap.style.alignItems = 'center';
  iconWrap.style.justifyContent = 'center';
  iconWrap.style.width = `${USAGE_TAB_ICON_SIZE}px`;
  iconWrap.style.height = `${USAGE_TAB_ICON_SIZE}px`;
  iconWrap.style.flexShrink = '0';

  const img = document.createElement('img');
  img.src = iconDef.src;
  img.alt = iconDef.alt || label;
  img.className = 'pixelated';
  img.style.width = `${USAGE_TAB_ICON_SIZE}px`;
  img.style.height = `${USAGE_TAB_ICON_SIZE}px`;
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  iconWrap.appendChild(img);
  button.appendChild(iconWrap);

  const text = document.createElement('span');
  text.textContent = label;
  text.style.lineHeight = '1';
  button.appendChild(text);
}

function createUsageListTabButton(iconDef, label, isActive) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = getUsageListTabButtonClassName(isActive);
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.gap = '4px';
  setUsageListTabButtonLabel(button, iconDef, label);
  return button;
}

function createUsageListTabPanel(content) {
  const panel = document.createElement('div');
  panel.style.display = 'none';
  panel.style.flexDirection = 'column';
  panel.style.flex = '1 1 0';
  panel.style.minHeight = '0';
  panel.appendChild(content.scrollContainer.element);

  const separator = document.createElement('div');
  separator.setAttribute('role', 'none');
  separator.className = 'separator my-2.5';
  panel.appendChild(separator);
  content.statsContainer.style.flexShrink = '0';
  panel.appendChild(content.statsContainer);

  return panel;
}

function createUsageListTabs(creaturesContent, equipmentContent) {
  const container = document.createElement('div');
  container.className = 'flex flex-col usage-list-modal-content';
  container.style.height = '100%';
  container.style.minHeight = '0';

  const tabButtons = document.createElement('div');
  tabButtons.className = 'flex mb-2';

  const tabDefs = [
    { label: t('mods.usageList.tabCreatures'), icon: USAGE_TAB_ICONS.creatures, content: creaturesContent },
    { label: t('mods.usageList.tabEquipment'), icon: USAGE_TAB_ICONS.equipment, content: equipmentContent }
  ];

  const buttons = tabDefs.map((tab, index) => {
    const button = createUsageListTabButton(tab.icon, tab.label, index === 0);
    tabButtons.appendChild(button);
    return button;
  });

  const panels = tabDefs.map((tab, index) => {
    const panel = createUsageListTabPanel(tab.content);
    if (index === 0) panel.style.display = 'flex';
    return panel;
  });

  const activateTab = (index) => {
    closeUsageListTooltip();
    buttons.forEach((button, i) => {
      button.className = getUsageListTabButtonClassName(i === index);
      panels[i].style.display = i === index ? 'flex' : 'none';
    });
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activateTab(index));
  });

  container.appendChild(tabButtons);
  panels.forEach((panel) => container.appendChild(panel));

  return {
    element: container,
    cleanup: () => closeUsageListTooltip()
  };
}

// =======================
// 8. Modal Orchestration
// =======================

function showUsageListModal() {
  console.log('Showing Usage List modal...');
  clearUsageListModalCleanup();

  try {
    const creaturesContent = buildCreaturesTabContent();
    const equipmentContent = buildEquipmentTabContent();
    const tabbedContent = createUsageListTabs(creaturesContent, equipmentContent);

    const modalDims = getUsageListModalDimensions();
    const modalRef = api.ui.components.createModal({
      title: t('mods.usageList.title'),
      width: modalDims.width,
      height: modalDims.height,
      content: tabbedContent.element,
      buttons: [
        {
          text: 'Close',
          primary: true,
          onClick: () => clearUsageListModalCleanup()
        }
      ]
    });

    tagUsageListModalElement(modalRef);
    usageListModalTabsCleanup = tabbedContent.cleanup;
    setupUsageListModalResponsiveLayout(modalRef, tabbedContent.element);

    console.log('Usage List modal displayed successfully');
  } catch (error) {
    console.error('Error showing Usage List modal:', error);

    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to generate the usage list. Make sure you are in the game and have access to creature/equipment data.</p>',
      buttons: [{ text: 'OK', primary: true }]
    });
  }
}

// =======================
// 9. Entry Point & Exports
// =======================

console.log('Usage List mod initializing...');

if (api) {
  console.log('BestiaryModAPI available in Usage List mod');

  window.usageListButton = api.ui.addButton({
    id: USAGE_LIST_BUTTON_ID,
    text: t('mods.usageList.buttonText'),
    tooltip: t('mods.usageList.buttonTooltip'),
    primary: false,
    onClick: showUsageListModal
  });

  console.log('Usage List button added');
} else {
  console.error('BestiaryModAPI not available in Usage List mod');
}

console.log('Usage List mod initialization complete');

exports = {
  showUsageList: showUsageListModal
};

exports.cleanup = function() {
  console.log('[Usage List] Running cleanup...');

  closeUsageListModal();

  if (api?.ui?.removeButton) {
    api.ui.removeButton(USAGE_LIST_BUTTON_ID);
  }
  if (typeof window.usageListButton !== 'undefined') {
    delete window.usageListButton;
  }

  console.log('[Usage List] Cleanup completed');
};
