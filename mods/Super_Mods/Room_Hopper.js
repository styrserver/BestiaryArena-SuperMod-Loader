// Room Hopper Mod for Bestiary Arena

if (window.__roomHopperLoaded) {
    console.log('[Room Hopper] Mod already loaded, skipping execution');
    if (typeof exports !== 'undefined') {
        exports = {
            name: 'Room Hopper',
            description: 'Searchable map list with creature/equip filters and one-click teleport',
            version: '1.0',
            enabled: true
        };
    }
    (function() { return; })();
}

window.__roomHopperLoaded = true;
console.log('[Room Hopper] Initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

const MOD_ID = 'room-hopper';
const BUTTON_ID = `${MOD_ID}-button`;
const MODAL_ID = `${MOD_ID}-modal`;

const ROOM_HOPPER_MODAL_CONFIG = {
  width: 900,
  height: 700,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 280
};

let roomHopperModalLayoutCleanup = null;

function getRoomHopperModalDimensions() {
  const pad = ROOM_HOPPER_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      ROOM_HOPPER_MODAL_CONFIG.minWidth,
      Math.min(ROOM_HOPPER_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      ROOM_HOPPER_MODAL_CONFIG.minHeight,
      Math.min(ROOM_HOPPER_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function getRoomHopperDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearRoomHopperModalLayoutCleanup() {
  if (roomHopperModalLayoutCleanup) {
    roomHopperModalLayoutCleanup();
    roomHopperModalLayoutCleanup = null;
  }
}

function applyRoomHopperModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getRoomHopperDialog(modalRef);
  if (!dialog) return;

  const { width, height } = dimensions;

  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]');

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper) {
    rootWrapper.style.height = '100%';
    rootWrapper.style.display = 'flex';
    rootWrapper.style.flexDirection = 'column';
    rootWrapper.style.flex = '1 1 0';
    rootWrapper.style.minHeight = '0';
  }

  const contentContainer = dialog.querySelector('.widget-bottom');
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 0',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const tableWrap = contentRoot.querySelector(`#${MODAL_ID}-table-scroll`);
    if (tableWrap) {
      Object.assign(tableWrap.style, {
        flex: '1 1 0',
        minHeight: '0',
        height: 'auto',
        maxHeight: 'none',
        overflowY: 'scroll',
        overflowX: 'auto'
      });
    }
  }
}

function setupRoomHopperModalResponsiveLayout(modalRef, contentRoot) {
  clearRoomHopperModalLayoutCleanup();
  const apply = () => applyRoomHopperModalLayout(modalRef, contentRoot, getRoomHopperModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  roomHopperModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
}

function resolveRegionName(regionId) {
    if (!regionId) return 'Unknown';
    if (typeof globalThis.mapsDatabase?.getRegionDisplayName === 'function') {
        return globalThis.mapsDatabase.getRegionDisplayName(regionId);
    }
    const fromGame = globalThis.state?.utils?.REGION_NAME?.[regionId]
        || globalThis.state?.utils?.regionIdsToNames?.[regionId];
    if (fromGame) return fromGame;
    const key = String(regionId).toLowerCase();
    const mapped = globalThis.mapsDatabase?.REGION_NAME_MAP?.[key];
    if (mapped) return mapped;
    return String(regionId).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// ============================================================================
// 2. STATE
// ============================================================================

let roomIndex = null;        // Array<RoomEntry> | null
let buildRetryTimer = null;  // setTimeout handle for build retry
let modalEl = null;          // currently-open modal root

// ============================================================================
// 3. CLEANUP (extended in later phases)
// ============================================================================

function cleanupRoomHopper() {
    try {
        clearRoomHopperModalLayoutCleanup();
        if (buildRetryTimer) {
            clearTimeout(buildRetryTimer);
            buildRetryTimer = null;
        }
        if (modalEl && typeof modalEl.close === 'function') {
            modalEl.close();
            modalEl = null;
        }
        if (api && api.ui && api.ui.removeButton) {
            api.ui.removeButton(BUTTON_ID);
        }
        delete window.__roomHopperLoaded;
        delete window.__roomHopperOpen;
        delete window.__roomHopperIndex;
        console.log('[Room Hopper] Cleanup completed');
    } catch (e) {
        console.error('[Room Hopper] Error during cleanup:', e);
    }
}

// ============================================================================
// 4. INDEX BUILD
// ============================================================================

// Creatures present in maps (NPCs, decorative, boss minions) but that do NOT grant XP.
// Mirrors export-maps-study.js so XP/stamina figures match the standalone study script.
const UNOBTAINABLE_FOR_XP = new Set(['beer barrel', 'orc', 'sweaty cyclops']);

function buildRoomIndex() {
    const utils = globalThis.state?.utils;
    if (!utils?.REGIONS || typeof utils.getBoardMonstersFromRoomId !== 'function') {
        return null;
    }

    const regions = utils.REGIONS || [];
    const roomNames = utils.ROOM_NAME || {};
    const getMonster = utils.getMonster;
    const getBoard = utils.getBoardMonstersFromRoomId;
    const getEquipment = utils.getEquipment;
    const mapsDb = window.mapsDatabase;

    const monsterMetaCache = new Map();
    const resolveMonsterName = (gameId) => {
        if (monsterMetaCache.has(gameId)) return monsterMetaCache.get(gameId);
        let name = `#${gameId}`;
        try {
            const m = typeof getMonster === 'function' ? getMonster(gameId) : null;
            if (m?.metadata?.name) name = m.metadata.name;
        } catch (_) {}
        monsterMetaCache.set(gameId, name);
        return name;
    };

    const equipMetaCache = new Map();
    // Returns { name, spriteId } — spriteId is what `.sprite.item.id-{N}` and /assets/ITEM/{N}.png expect.
    const resolveEquipMeta = (gameId) => {
        if (equipMetaCache.has(gameId)) return equipMetaCache.get(gameId);
        let meta = { name: `#${gameId}`, spriteId: gameId };
        try {
            const eq = typeof getEquipment === 'function' ? getEquipment(gameId) : null;
            if (eq?.metadata) {
                meta = {
                    name: eq.metadata.name || `#${gameId}`,
                    spriteId: Number(eq.metadata.spriteId ?? gameId)
                };
            }
        } catch (_) {}
        equipMetaCache.set(gameId, meta);
        return meta;
    };

    const index = [];
    for (const region of regions) {
        const regionId = region?.id;
        if (!regionId) continue;
        const regionName = resolveRegionName(regionId);

        for (const room of (region.rooms || [])) {
            const roomId = room?.id;
            if (!roomId) continue;

            const name = roomNames[roomId] || roomId;
            const raid = room.raid === true;
            const dynamicEvent = mapsDb?.isDynamicEventMap?.(roomId) === true;

            let villains = [];
            try {
                const board = getBoard(roomId);
                if (Array.isArray(board)) {
                    villains = board.filter(p => p?.villain === true);
                }
            } catch (_) {}

            const creatureMap = new Map(); // gameId -> { gameId, name, count }
            const equipMap = new Map();    // `${gameId}|${stat}|${tier}` -> { gameId, name, stat, tier }
            let levelSumCapped = 0;
            for (const v of villains) {
                const gid = Number(v.gameId);
                const lvl = Number(v.level || 0);
                if (Number.isFinite(gid)) {
                    if (!creatureMap.has(gid)) {
                        creatureMap.set(gid, { gameId: gid, name: resolveMonsterName(gid), count: 0 });
                    }
                    creatureMap.get(gid).count += 1;
                    // XP only counts villains that actually grant experience on kill.
                    const lowerName = String(creatureMap.get(gid).name).toLowerCase();
                    if (!UNOBTAINABLE_FOR_XP.has(lowerName)) {
                        levelSumCapped += Math.min(lvl, 50);
                    }
                }
                if (v.equip && Number.isFinite(Number(v.equip.gameId))) {
                    const eGid = Number(v.equip.gameId);
                    const stat = String(v.equip.stat || '');
                    const tier = Number(v.equip.tier || 0);
                    const key = `${eGid}|${stat}|${tier}`;
                    if (!equipMap.has(key)) {
                        const meta = resolveEquipMeta(eGid);
                        equipMap.set(key, {
                            gameId: eGid,
                            spriteId: meta.spriteId,
                            name: meta.name,
                            stat,
                            tier
                        });
                    }
                }
            }

            const staminaCost = Number(room.staminaCost ?? 0);
            const expAvg = Math.round(levelSumCapped * 562.5);
            const expPerStamina = staminaCost > 0 ? expAvg / staminaCost : 0;

            index.push({
                id: roomId,
                name,
                regionId,
                regionName,
                raid,
                dynamicEvent,
                difficulty: room.difficulty ?? null,
                staminaCost,
                maxTeamSize: room.maxTeamSize ?? null,
                creatures: Array.from(creatureMap.values()),
                equips: Array.from(equipMap.values()),
                expAvg,
                expPerStamina
            });
        }
    }

    return index;
}

const BUILD_RETRY_MS = 500;
const BUILD_MAX_DURATION_MS = 30000;

function tryBuildIndex(startedAt = Date.now()) {
    const idx = buildRoomIndex();
    if (idx && idx.length > 0) {
        roomIndex = idx;
        window.__roomHopperIndex = idx; // for console inspection
        console.log(`[Room Hopper] Index built with ${idx.length} rooms`);
        return;
    }
    if (Date.now() - startedAt > BUILD_MAX_DURATION_MS) {
        console.warn('[Room Hopper] Gave up building index — state.utils never became ready');
        return;
    }
    buildRetryTimer = setTimeout(() => tryBuildIndex(startedAt), BUILD_RETRY_MS);
}

// Kick off the build at mod load
tryBuildIndex();

// ============================================================================
// 5. UI
// ============================================================================

function createOpenButton() {
    if (!api || !api.ui || !api.ui.addButton) {
        console.error('[Room Hopper] api.ui.addButton unavailable');
        return;
    }
    api.ui.addButton({
        id: BUTTON_ID,
        text: 'Room Hopper',
        modId: MOD_ID,
        tooltip: 'Search all rooms by name, creature, or equip',
        primary: false,
        onClick: () => openModal()
    });
}

const CREATURES_MIN_VISIBLE = 6;
const ROW_HOVER_BG = '#3a3a4a';
const ROW_SELECTED_BG = '#4a4a6a';

function renderCreatureCell(td, creatures) {
    if (!creatures || creatures.length === 0) return;
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    // Show as many portraits as fit in the creatures column before falling back to +N.
    // When width is not measurable yet, use a safe fallback based on current modal layout.
    const measuredWidth = td.getBoundingClientRect().width || td.clientWidth || 340;
    const maxVisibleByWidth = Math.max(1, Math.floor((measuredWidth - 28) / 36));
    const maxVisible = Math.min(creatures.length, Math.max(CREATURES_MIN_VISIBLE, maxVisibleByWidth));
    const visible = creatures.slice(0, maxVisible);
    for (const c of visible) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position: relative; width: 32px; height: 32px; flex: none;';
        const img = document.createElement('img');
        if (window.creatureDatabase?.getMonsterPortraitUrl) {
            img.src = window.creatureDatabase.getMonsterPortraitUrl(c.gameId);
        }
        img.alt = c.name;
        img.title = c.name;
        img.className = 'pixelated';
        img.style.cssText = 'width: 100%; height: 100%; display: block;';
        img.onerror = () => { img.style.visibility = 'hidden'; };
        wrap.appendChild(img);
        if (c.count > 1) {
            const badge = document.createElement('span');
            badge.textContent = c.count;
            badge.style.cssText = 'position: absolute; bottom: -3px; right: -3px; background: #000; color: #fff; font-size: 10px; font-weight: bold; padding: 0 3px; line-height: 1.3; border-radius: 3px; border: 1px solid #888; pointer-events: none;';
            wrap.appendChild(badge);
        }
        row.appendChild(wrap);
    }
    if (creatures.length > maxVisible) {
        const more = document.createElement('span');
        more.textContent = `+${creatures.length - maxVisible}`;
        more.style.cssText = 'color: #aaa; font-size: 11px; margin-left: 4px;';
        more.title = creatures.slice(maxVisible).map(c => c.name).join(', ');
        row.appendChild(more);
    }
    td.appendChild(row);
}

function renderEquipCell(td, equips) {
    if (!equips || equips.length === 0) return;
    const row = document.createElement('div');
    row.style.cssText = 'display: inline-flex; gap: 2px; align-items: center; justify-content: flex-end;';
    for (const e of equips) {
        const spriteId = e.spriteId ?? e.gameId;
        let portraitEl = null;
        try {
            portraitEl = api.ui.components.createItemPortrait({
                itemId: spriteId,
                stat: e.stat || 'ad',
                tier: e.tier || 1
            });
        } catch (_) {
            portraitEl = null;
        }
        if (portraitEl) {
            portraitEl.title = `${e.name}${e.stat ? ` (${e.stat.toUpperCase()} T${e.tier})` : ''}`;
            // The in-game `.sprite.item.id-{N}` CSS rule does not always apply inside
            // our modal. Apply the asset as a background-image on the viewport instead
            // of setting <img>.src — this naturally renders animated spritesheets
            // (128×96) showing only the top-left 32×32 frame, while static 32×32
            // assets render unchanged.
            const spriteImg = portraitEl.querySelector('img.spritesheet');
            const viewport = spriteImg?.parentElement;
            if (viewport) {
                viewport.style.backgroundImage = `url(/assets/ITEM/${spriteId}.png)`;
                viewport.style.backgroundSize = 'auto';
                viewport.style.backgroundPosition = '0 0';
                viewport.style.backgroundRepeat = 'no-repeat';
                viewport.style.width = '32px';
                viewport.style.height = '32px';
                viewport.style.imageRendering = 'pixelated';
            }
            if (spriteImg) {
                spriteImg.style.display = 'none';
            }
            row.appendChild(portraitEl);
        } else {
            const fallback = document.createElement('span');
            fallback.textContent = e.name;
            fallback.style.cssText = 'font-size: 10px; color: #aaa; padding: 0 4px;';
            row.appendChild(fallback);
        }
    }
    td.appendChild(row);
}

function showInlineToast(rootEl, message) {
    let toast = rootEl.querySelector('.room-hopper-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'room-hopper-toast';
        toast.style.cssText = 'position: absolute; top: 8px; right: 8px; background: #511; color: #fff; padding: 4px 8px; border-radius: 3px; font-size: 11px; z-index: 5; pointer-events: none; transition: opacity 0.3s;';
        rootEl.style.position = 'relative';
        rootEl.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { if (toast) toast.style.opacity = '0'; }, 1800);
    setTimeout(() => { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); }, 2200);
}

function teleportToRoom(roomId) {
    if (!globalThis.state?.board) return false;
    try {
        globalThis.state.board.send({ type: 'selectRoomById', roomId });
        return true;
    } catch (e) {
        console.warn('[Room Hopper] selectRoomById failed:', e);
        return false;
    }
}

function createRegionHeaderRow(regionName, mapCount) {
    const tr = document.createElement('tr');
    tr.dataset.regionHeader = 'true';
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'pixel-font-16';
    Object.assign(td.style, {
        position: 'sticky',
        top: '0',
        left: '0',
        zIndex: '5',
        padding: '6px 8px',
        textAlign: 'center',
        color: '#eee',
        fontWeight: 'normal',
        background: '#1a1a1a',
        borderBottom: '1px solid #2a2a2a',
        boxSizing: 'border-box',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.35)'
    });
    td.textContent = `${regionName} (${mapCount} maps)`;
    tr.appendChild(td);
    return tr;
}

function renderRows(filteredIndex, tbodyEl, { groupByRegion = false, selectedRoomId = null } = {}) {
    tbodyEl.innerHTML = '';
    if (filteredIndex.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="padding: 16px; text-align: center; color: #888;">No rooms match the current filters.</td>`;
        tbodyEl.appendChild(tr);
        return;
    }

    let rowIdx = 0;
    let currentRegionId = null;
    const regionCounts = groupByRegion ? new Map() : null;
    if (groupByRegion) {
        for (const room of filteredIndex) {
            regionCounts.set(room.regionId, (regionCounts.get(room.regionId) || 0) + 1);
        }
    }

    for (const room of filteredIndex) {
        if (groupByRegion && room.regionId !== currentRegionId) {
            currentRegionId = room.regionId;
            tbodyEl.appendChild(createRegionHeaderRow(
                room.regionName,
                regionCounts.get(room.regionId)
            ));
        }

        const tr = document.createElement('tr');
        tr.dataset.roomId = room.id;
        const baseBg = rowIdx % 2 === 0 ? '#2a2a2a' : '#1f1f1f';
        tr.dataset.baseBg = baseBg;
        const isSelected = selectedRoomId === room.id;
        if (isSelected) tr.classList.add('room-hopper-selected');
        tr.style.cssText = `cursor: pointer; border-bottom: 1px solid #111; background: ${isSelected ? ROW_SELECTED_BG : baseBg};`;

        tr.addEventListener('mouseenter', () => { tr.style.background = ROW_HOVER_BG; });
        tr.addEventListener('mouseleave', () => {
            tr.style.background = tr.classList.contains('room-hopper-selected') ? ROW_SELECTED_BG : tr.dataset.baseBg;
        });
        tr.addEventListener('click', () => {
            if (boardIsInRun()) {
                showInlineToast(tbodyEl.closest('div'), 'Finish the current run first');
                return;
            }
            if (teleportToRoom(room.id) && modalEl && typeof modalEl.close === 'function') {
                modalEl.close();
                modalEl = null;
            }
        });

        // Column 1: Room (thumbnail + name)
        const tdRoom = document.createElement('td');
        tdRoom.style.cssText = 'padding: 4px 8px; vertical-align: middle; max-width: 250px; overflow: hidden;';
        const thumbWrap = document.createElement('span');
        thumbWrap.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-width: 0;';
        const thumb = document.createElement('img');
        thumb.src = `/assets/room-thumbnails/${room.id}.png`;
        thumb.alt = room.name;
        thumb.className = 'pixelated';
        thumb.style.cssText = 'width: 32px; height: 32px; object-fit: cover;';
        thumb.onerror = () => {
            // Fallback to first creature portrait if thumbnail missing
            thumb.onerror = null;
            const firstCreature = room.creatures[0];
            if (firstCreature && window.creatureDatabase?.getMonsterPortraitUrl) {
                thumb.src = window.creatureDatabase.getMonsterPortraitUrl(firstCreature.gameId);
            } else {
                thumb.style.visibility = 'hidden';
            }
        };
        const nameSpan = document.createElement('span');
        nameSpan.textContent = room.name;
        nameSpan.style.cssText = 'white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.2; min-width: 0;';
        thumbWrap.appendChild(thumb);
        thumbWrap.appendChild(nameSpan);
        tdRoom.appendChild(thumbWrap);
        tr.appendChild(tdRoom);

        // Column 2: Creatures
        const tdCreatures = document.createElement('td');
        tdCreatures.style.cssText = 'padding: 4px 8px; vertical-align: middle;';
        tdCreatures.dataset.col = 'creatures';
        renderCreatureCell(tdCreatures, room.creatures);
        tr.appendChild(tdCreatures);

        // Column 3: XP / Stam
        const tdXp = document.createElement('td');
        tdXp.className = 'pixel-font-14';
        tdXp.style.cssText = 'padding: 4px 8px; vertical-align: middle; text-align: center; color: #ccc; white-space: nowrap; line-height: 1.3; max-width: 100px;';
        tdXp.dataset.col = 'xp';
        if (room.expAvg > 0) {
            const xpFmt = room.expAvg.toLocaleString('pt-BR');
            const effFmt = Math.round(room.expPerStamina).toLocaleString('pt-BR');
            tdXp.innerHTML = `
                <div>${xpFmt} <span style="color:#888;">xp</span></div>
                <div>${effFmt} <span style="color:#888;">/ stam</span></div>
            `;
        } else {
            tdXp.innerHTML = `<span style="color:#666;">—</span>`;
        }
        tr.appendChild(tdXp);

        // Column 4: Equips
        const tdEquips = document.createElement('td');
        tdEquips.style.cssText = 'padding: 4px 8px; vertical-align: middle; text-align: right; max-width: 200px; overflow: hidden;';
        tdEquips.dataset.col = 'equips';
        renderEquipCell(tdEquips, room.equips);
        tr.appendChild(tdEquips);

        tbodyEl.appendChild(tr);
        rowIdx++;
    }
}

function boardIsInRun() {
    try {
        const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
        if (!ctx) return false;
        return ctx.gameStarted === true;
    } catch (_) {
        return false;
    }
}

function applyFilters(index, { searchText, regionId, hideRaids }) {
    const needle = (searchText || '').trim().toLowerCase();
    return index.filter(room => {
        if (regionId && room.regionId !== regionId) return false;
        if (hideRaids && (room.raid || room.dynamicEvent)) return false;
        if (!needle) return true;
        if (room.name.toLowerCase().includes(needle)) return true;
        if (room.regionName.toLowerCase().includes(needle)) return true;
        if (room.creatures.some(c => c.name.toLowerCase().includes(needle))) return true;
        if (room.equips.some(e => e.name.toLowerCase().includes(needle))) return true;
        return false;
    });
}

function openModal() {
    if (!roomIndex) {
        alert('Room Hopper: room data is still loading. Try again in a moment.');
        return;
    }

    clearRoomHopperModalLayoutCleanup();
    const modalDimensions = getRoomHopperModalDimensions();

    // Build content container before passing to createModal
    const root = document.createElement('div');
    root.id = `${MODAL_ID}-root`;
    root.className = 'room-hopper-modal-root';
    root.style.cssText = 'display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; min-height: 0; flex: 1 1 0; box-sizing: border-box; overflow: hidden;';

    // Filter bar (populated in Task 12)
    const filterBar = document.createElement('div');
    filterBar.id = `${MODAL_ID}-filters`;
    filterBar.style.cssText = 'display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap;';
    root.appendChild(filterBar);

    // -- Search input --
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = `${MODAL_ID}-search`;
    searchInput.placeholder = 'Search by map, creature, equip, region…';
    searchInput.autocomplete = 'off';
    searchInput.autocapitalize = 'off';
    searchInput.spellcheck = false;
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('name', `room-hopper-search-${Date.now()}`);
    searchInput.className = 'pixel-font-14';
    searchInput.style.cssText = 'flex: 1; padding: 4px 8px; background: #111; color: #eee; border: 1px solid #2a2a2a; border-radius: 3px;';
    filterBar.appendChild(searchInput);

    // -- Region dropdown --
    const regionSelect = document.createElement('select');
    regionSelect.id = `${MODAL_ID}-region`;
    regionSelect.className = 'pixel-font-14';
    regionSelect.style.cssText = 'padding: 4px 8px; background: #111; color: #eee; border: 1px solid #2a2a2a; border-radius: 3px;';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'All regions';
    regionSelect.appendChild(optAll);

    const seenRegions = new Map();
    for (const r of roomIndex) {
        if (!seenRegions.has(r.regionId)) seenRegions.set(r.regionId, r.regionName);
    }
    const sortedRegions = [];
    const ordered = globalThis.mapsDatabase?.getRegionsInOrder?.();
    if (Array.isArray(ordered)) {
        for (const region of ordered) {
            const label = seenRegions.get(region.id);
            if (label !== undefined) {
                sortedRegions.push([region.id, label]);
                seenRegions.delete(region.id);
            }
        }
    }
    for (const [id, label] of seenRegions.entries()) {
        sortedRegions.push([id, label]);
    }
    for (const [id, label] of sortedRegions) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = label;
        regionSelect.appendChild(opt);
    }
    filterBar.appendChild(regionSelect);

    // -- Hide-raids toggle button --
    const hideRaidsBtn = document.createElement('button');
    hideRaidsBtn.id = `${MODAL_ID}-hide-raids`;
    hideRaidsBtn.type = 'button';
    hideRaidsBtn.textContent = 'Hide raids';
    hideRaidsBtn.dataset.active = 'false';
    hideRaidsBtn.className = 'pixel-font-14';
    const applyHideRaidsStyle = () => {
        const active = hideRaidsBtn.dataset.active === 'true';
        hideRaidsBtn.style.cssText = `
            padding: 4px 10px;
            background: ${active ? '#3a3a4a' : '#111'};
            color: ${active ? '#fff' : '#bbb'};
            border: 1px solid ${active ? '#5a5a7a' : '#2a2a2a'};
            border-radius: 3px;
            cursor: pointer;
        `;
    };
    applyHideRaidsStyle();
    filterBar.appendChild(hideRaidsBtn);

    // Table shell: fixed column headers + scrollable body (reliable sticky region titles)
    const tableShell = document.createElement('div');
    tableShell.id = `${MODAL_ID}-table`;
    tableShell.style.cssText = `
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        border: 1px solid #2a2a2a;
        overflow: hidden;
    `;

    const tableScroll = document.createElement('div');
    tableScroll.id = `${MODAL_ID}-table-scroll`;
    tableScroll.style.cssText = `
        flex: 1 1 0;
        min-height: 0;
        overflow-y: scroll;
        overflow-x: auto;
        scrollbar-width: auto;
        scrollbar-color: #555 #1a1a1a;
    `;

    const scrollStyle = document.createElement('style');
    scrollStyle.textContent = `
        #${MODAL_ID}-table-scroll::-webkit-scrollbar { width: 12px; }
        #${MODAL_ID}-table-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
        #${MODAL_ID}-table-scroll::-webkit-scrollbar-thumb { background: #555; border: 2px solid #1a1a1a; border-radius: 6px; }
        #${MODAL_ID}-table-scroll::-webkit-scrollbar-thumb:hover { background: #777; }
        #${MODAL_ID}-table-scroll tr[data-region-header="true"] td {
            position: sticky;
            top: 0;
        }
    `;
    root.appendChild(scrollStyle);

    const tableBaseStyle = 'width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed;';
    const colgroupHtml = `
        <colgroup>
            <col style="width: 250px; max-width: 250px;">
            <col>
            <col style="width: 100px; max-width: 100px;">
            <col style="width: 200px; max-width: 200px;">
        </colgroup>
    `;
    const thBase = 'background: #1a1a1a; padding: 6px 8px; border-bottom: 1px solid #2a2a2a; font-weight: normal; color: #bbb;';

    const headerTable = document.createElement('table');
    headerTable.className = 'pixel-font-16 text-whiteRegular';
    headerTable.style.cssText = tableBaseStyle;
    headerTable.innerHTML = `
        ${colgroupHtml}
        <thead class="pixel-font-14">
            <tr>
                <th data-sort="name" style="${thBase} max-width: 250px; text-align: center; cursor: pointer; user-select: none;">Room <span class="sort-arrow"></span></th>
                <th style="${thBase} text-align: center;">Creatures</th>
                <th data-sort="expPerStamina" style="${thBase} max-width: 100px; text-align: center; cursor: pointer; user-select: none; white-space: nowrap;">XP / Stam <span class="sort-arrow"></span></th>
                <th style="${thBase} max-width: 200px; text-align: center;">Equipments</th>
            </tr>
        </thead>
    `;

    const bodyTable = document.createElement('table');
    bodyTable.className = 'pixel-font-16 text-whiteRegular';
    bodyTable.style.cssText = tableBaseStyle;
    bodyTable.innerHTML = `
        ${colgroupHtml}
        <tbody id="${MODAL_ID}-tbody"></tbody>
    `;

    tableScroll.appendChild(bodyTable);
    tableShell.appendChild(headerTable);
    tableShell.appendChild(tableScroll);
    root.appendChild(tableShell);

    const table = headerTable;

    let selectedRoomId = null;
    let currentFilteredRooms = roomIndex;
    let keydownHandler = null;

    const handleModalClose = () => {
        clearRoomHopperModalLayoutCleanup();
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler);
            keydownHandler = null;
        }
        modalEl = null;
    };

    const modalInstance = api.ui.components.createModal({
        title: 'Room Hopper',
        width: modalDimensions.width,
        height: modalDimensions.height,
        content: root,
        buttons: [
            { text: 'Close', primary: false }
        ],
        onClose: handleModalClose
    });

    // Keep the modal handle so cleanup/teleport can close it (removes modal + overlay)
    if (modalInstance && typeof modalInstance.close === 'function') {
        modalEl = modalInstance;
    } else if (typeof modalInstance === 'function') {
        modalEl = { close: modalInstance };
    } else {
        modalEl = modalInstance;
    }

    const originalClose = modalEl?.close?.bind(modalEl);
    if (originalClose) {
        modalEl.close = () => {
            handleModalClose();
            originalClose();
        };
    }

    setupRoomHopperModalResponsiveLayout(modalInstance, root);

    // Inject credits into the modal button row (same pattern as Mod Settings)
    setTimeout(() => {
        const modalElement = document.querySelector('div[role="dialog"][data-state="open"]')
            || modalEl?.element
            || document.querySelector('div[role="dialog"]');
        if (!modalElement) return;

        let footer = modalElement.querySelector('.flex.justify-end.gap-2');
        if (!footer) {
            const closeButton = Array.from(modalElement.querySelectorAll('button')).find(
                btn => btn.textContent.trim() === 'Close'
            );
            if (closeButton) footer = closeButton.closest('.flex');
        }
        if (!footer || footer.querySelector('.room-hopper-credits')) return;

        const credits = document.createElement('div');
        credits.className = 'room-hopper-credits pixel-font-16';
        credits.style.cssText = `
            font-size: 11px;
            color: #bbb;
            margin-right: auto;
        `;
        credits.innerHTML = 'Credits: <a href="https://bestiaryarena.com/profile/tinhozin" target="_blank" rel="noopener noreferrer" style="color: #c9a227; text-decoration: none;">tinhozin</a>';

        footer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 2px;
        `;
        footer.insertBefore(credits, footer.firstChild);
    }, 100);

    const tbody = root.querySelector(`#${MODAL_ID}-tbody`);

    const setSelectedRoom = (roomId) => {
        selectedRoomId = roomId || null;
        tbody.querySelectorAll('tr[data-room-id]').forEach(tr => {
            const selected = tr.dataset.roomId === roomId;
            tr.classList.toggle('room-hopper-selected', selected);
            tr.style.background = selected ? ROW_SELECTED_BG : tr.dataset.baseBg;
        });
        if (!roomId) return;
        const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(roomId) : roomId;
        const row = tbody.querySelector(`tr[data-room-id="${escapedId}"]`);
        if (row) {
            if (tableScroll && typeof tableScroll.scrollTop === 'number') {
                const rowTop = row.offsetTop;
                const rowBottom = rowTop + row.offsetHeight;
                const viewTop = tableScroll.scrollTop;
                const viewBottom = viewTop + tableScroll.clientHeight;
                if (rowTop < viewTop) {
                    tableScroll.scrollTop = rowTop;
                } else if (rowBottom > viewBottom) {
                    tableScroll.scrollTop = rowBottom - tableScroll.clientHeight;
                }
            } else {
                row.scrollIntoView({ block: 'nearest' });
            }
        }
    };

    const goToRoom = (roomId) => {
        if (boardIsInRun()) {
            showInlineToast(root, 'Finish the current run first');
            return;
        }
        if (teleportToRoom(roomId) && modalEl && typeof modalEl.close === 'function') {
            modalEl.close();
        }
    };

    const moveSelection = (direction) => {
        const ids = currentFilteredRooms.map(room => room.id);
        if (ids.length === 0) return;
        let idx = selectedRoomId ? ids.indexOf(selectedRoomId) : -1;
        if (direction === 'down') {
            idx = idx < ids.length - 1 ? idx + 1 : 0;
        } else {
            idx = idx > 0 ? idx - 1 : ids.length - 1;
        }
        setSelectedRoom(ids[idx]);
    };

    keydownHandler = (e) => {
        if (!modalEl) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (modalEl && typeof modalEl.close === 'function') {
                modalEl.close();
            }
            return;
        }

        if (e.target === regionSelect) return;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveSelection(e.key === 'ArrowDown' ? 'down' : 'up');
            return;
        }

        if (e.key === 'Enter') {
            if (e.target.tagName === 'BUTTON') return;
            const targetId = selectedRoomId || currentFilteredRooms[0]?.id;
            if (!targetId) return;
            e.preventDefault();
            goToRoom(targetId);
        }
    };
    document.addEventListener('keydown', keydownHandler);

    renderRows(roomIndex, tbody, { groupByRegion: true });

    let searchDebounceTimer = null;
    let sortKey = null;     // 'name' | 'expPerStamina' | null (natural order)
    let sortDir = 'asc';    // 'asc' | 'desc'

    const updateSortArrows = () => {
        table.querySelectorAll('th[data-sort]').forEach(th => {
            const arrow = th.querySelector('.sort-arrow');
            if (!arrow) return;
            if (th.dataset.sort === sortKey) {
                arrow.textContent = sortDir === 'desc' ? ' ↓' : ' ↑';
                arrow.style.color = '#fff';
            } else {
                arrow.textContent = '';
            }
        });
    };

    const recompute = () => {
        let filtered = applyFilters(roomIndex, {
            searchText: searchInput.value,
            regionId: regionSelect.value || null,
            hideRaids: hideRaidsBtn.dataset.active === 'true'
        });
        if (sortKey) {
            const mul = sortDir === 'desc' ? -1 : 1;
            filtered = [...filtered].sort((a, b) => {
                const va = a[sortKey];
                const vb = b[sortKey];
                if (typeof va === 'string' && typeof vb === 'string') {
                    return va.localeCompare(vb) * mul;
                }
                return ((va ?? 0) - (vb ?? 0)) * mul;
            });
        }
        currentFilteredRooms = filtered;
        if (selectedRoomId && !filtered.some(room => room.id === selectedRoomId)) {
            selectedRoomId = null;
        }
        renderRows(filtered, tbody, {
            groupByRegion: sortKey === null,
            selectedRoomId
        });
    };

    searchInput.addEventListener('input', () => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(recompute, 150);
    });
    regionSelect.addEventListener('change', recompute);
    hideRaidsBtn.addEventListener('click', () => {
        hideRaidsBtn.dataset.active = hideRaidsBtn.dataset.active === 'true' ? 'false' : 'true';
        applyHideRaidsStyle();
        recompute();
    });
    table.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            const initialDir = key === 'expPerStamina' ? 'desc' : 'asc';
            if (sortKey !== key) {
                sortKey = key;
                // First click: Room asc, XP/Stam desc.
                sortDir = initialDir;
            } else if (sortDir === initialDir) {
                // Second click: opposite direction.
                sortDir = initialDir === 'asc' ? 'desc' : 'asc';
            } else {
                // Third click: return to default order (region-grouped with sticky headers).
                sortKey = null;
                sortDir = 'asc';
            }
            updateSortArrows();
            recompute();
        });
    });

    const focusSearchInput = () => {
        try {
            searchInput.focus({ preventScroll: true });
        } catch (_) {}
    };
    requestAnimationFrame(() => requestAnimationFrame(focusSearchInput));
}

// Boot the button after the API is ready
createOpenButton();

window.__roomHopperOpen = openModal;

if (typeof context !== 'undefined') {
    context.exports = {
        cleanup: cleanupRoomHopper,
        open: openModal
    };
}
