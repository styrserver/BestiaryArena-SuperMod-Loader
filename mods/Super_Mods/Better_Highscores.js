// =======================
// Better Highscores.js - Bestiary Arena Leaderboard Display Mod
// =======================
(function() {

// =======================
// MODULE 1: Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  const STORAGE_KEY = 'better-highscores-settings';
  const LEGACY_BETTER_UI_STORAGE_KEY = 'better-ui-config';
  const CONTEXT_MENU_COLORS = {
    accent: '#e5c07b',
    white: '#ffffff',
    darkGray: '#232323'
  };

  const DEFAULT_SETTINGS = {
    backgroundOpacity: 1.0,
    scale: 1.0,
    placement: 'top',
    hidden: false,
    showNavButton: true,
    showTime: true,
    showRank: true,
    showFloor: true
  };

  const t = (key, params) => {
    let value = key;
    if (typeof context !== 'undefined' && context.api && context.api.i18n && context.api.i18n.t) {
      value = context.api.i18n.t(key);
    }
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    return value;
  };

  function normalizeSettings(settings) {
    const normalized = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    normalized.backgroundOpacity = typeof normalized.backgroundOpacity === 'number'
      ? Math.min(1, Math.max(0, normalized.backgroundOpacity))
      : DEFAULT_SETTINGS.backgroundOpacity;
    normalized.scale = typeof normalized.scale === 'number'
      ? Math.min(1.2, Math.max(0.8, normalized.scale))
      : DEFAULT_SETTINGS.scale;
    normalized.placement = normalized.placement === 'bottom' ? 'bottom' : 'top';
    normalized.hidden = normalized.hidden === true;
    normalized.showNavButton = normalized.showNavButton !== false;
    normalized.showTime = normalized.showTime !== false;
    normalized.showRank = normalized.showRank !== false;
    normalized.showFloor = normalized.showFloor !== false;
    return normalized;
  }

  function migrateLegacySettings(defaults) {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_BETTER_UI_STORAGE_KEY);
      if (!legacyRaw) {
        return null;
      }

      const legacy = JSON.parse(legacyRaw);
      const migrated = normalizeSettings(Object.assign({}, defaults, {
        backgroundOpacity: legacy.betterHighscoresBackgroundOpacity,
        scale: legacy.betterHighscoresScale,
        placement: legacy.betterHighscoresPlacement,
        hidden: legacy.betterHighscoresHidden
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      console.log('[Better Highscores] Migrated settings from Mod Settings storage');
      return migrated;
    } catch (error) {
      console.warn('[Better Highscores] Error migrating legacy settings:', error);
      return null;
    }
  }

  function loadSettings() {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.showNavButton === false && parsed.showNavButtonUserDisabled !== true) {
          parsed.showNavButton = true;
          const normalized = normalizeSettings(Object.assign({}, DEFAULT_SETTINGS, parsed));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }
        return normalizeSettings(Object.assign({}, DEFAULT_SETTINGS, parsed));
      }
    } catch (error) {
      console.warn('[Better Highscores] Error loading settings:', error);
    }

    const migrated = migrateLegacySettings(DEFAULT_SETTINGS);
    return migrated || normalizeSettings(DEFAULT_SETTINGS);
  }

  let modSettings = loadSettings();
  let openContextMenu = null;
  let restoreButton = null;
  let modDisposed = false;

  function saveSettings() {
    modSettings = normalizeSettings(modSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modSettings));
      window.betterHighscoresSettings = modSettings;
    } catch (error) {
      console.warn('[Better Highscores] Error saving settings:', error);
    }
  }

  function resetSettingsToDefault() {
    modSettings = normalizeSettings(Object.assign({}, DEFAULT_SETTINGS));
    saveSettings();
    applyNavButtonVisibility();
    removeRestoreButton();
    updateLeaderboards();
    if (leaderboardContainer && document.contains(leaderboardContainer)) {
      updateOpacity(modSettings.backgroundOpacity);
      applyContainerStyles(leaderboardContainer);
    }
    console.log('[Better Highscores] Settings reset to defaults');
  }

  window.betterHighscoresSettings = modSettings;

  function isBetterHighscoresHidden() {
    return modSettings.hidden === true;
  }

  function getBackgroundOpacity() {
    return modSettings.backgroundOpacity;
  }

  function getBetterHighscoresPlacement() {
    return modSettings.placement === 'bottom' ? 'bottom' : 'top';
  }

  function getBetterHighscoresScale() {
    return modSettings.scale;
  }

  function isSectionVisible(sectionType) {
    if (sectionType === 'time') {
      return modSettings.showTime !== false;
    }
    if (sectionType === 'rank') {
      return modSettings.showRank !== false;
    }
    if (sectionType === 'floor') {
      return modSettings.showFloor !== false;
    }
    return true;
  }

  function applySectionVisibility(contentDiv) {
    if (!contentDiv) {
      return;
    }

    const sections = [
      { el: contentDiv.children[0], visible: isSectionVisible('time') },
      { el: contentDiv.children[1], visible: isSectionVisible('rank') },
      { el: contentDiv.children[2], visible: isSectionVisible('floor') }
    ];

    let visibleIndex = 0;
    sections.forEach(({ el, visible }) => {
      if (!el) {
        return;
      }

      el.style.display = visible ? 'flex' : 'none';
      if (!visible) {
        return;
      }

      if (visibleIndex > 0) {
        el.style.borderLeft = '1px solid rgba(255, 255, 255, 0.2)';
        el.style.paddingLeft = '6px';
      } else {
        el.style.borderLeft = '';
        el.style.paddingLeft = '';
      }
      visibleIndex++;
    });
  }

  function getVisibleSectionCount(settings = modSettings) {
    let count = 0;
    if (settings.showTime !== false) count++;
    if (settings.showRank !== false) count++;
    if (settings.showFloor !== false) count++;
    return count;
  }

  function setAllSectionsVisible(sectionCheckboxes) {
    modSettings.showTime = true;
    modSettings.showRank = true;
    modSettings.showFloor = true;
    sectionCheckboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
  }

  function handleSectionVisibilityToggle(settingKey, checked, sectionCheckboxes) {
    modSettings[settingKey] = checked;
    if (getVisibleSectionCount() === 0) {
      setAllSectionsVisible(sectionCheckboxes);
    }
    saveSettings();
    updateLeaderboards();
  }

  function getContainerPositionStyles() {
    const placement = getBetterHighscoresPlacement();
    const base = {
      position: 'absolute',
      left: '50%',
      right: 'auto',
      display: 'inline-block',
      width: 'fit-content',
      height: 'fit-content'
    };

    if (placement === 'bottom') {
      return Object.assign({}, base, { bottom: '9px', top: 'auto' });
    }

    return Object.assign({}, base, { top: '9px', bottom: 'auto' });
  }

  function getContainerTransform(scale = getBetterHighscoresScale()) {
    return scale === 1 ? 'translateX(-50%)' : `translateX(-50%) scale(${scale})`;
  }

  function getContainerTransformOrigin() {
    return getBetterHighscoresPlacement() === 'bottom' ? 'bottom center' : 'top center';
  }

  function applyContainerStyles(container) {
    if (!container) {
      return;
    }

    Object.assign(container.style, getContainerPositionStyles(), {
      transform: getContainerTransform(),
      transformOrigin: getContainerTransformOrigin()
    });
    applyContentContainerStyles(container._contentDiv);
    resetBackgroundSizing(container);
  }

  function resetBackgroundSizing(container) {
    if (!container?._backgroundDiv) {
      return;
    }

    const backgroundDiv = container._backgroundDiv;
    backgroundDiv.style.width = '';
    backgroundDiv.style.height = '';
    backgroundDiv.style.top = '0';
    backgroundDiv.style.left = '0';
    backgroundDiv.style.right = '0';
    backgroundDiv.style.bottom = '0';
  }

  function getContentContainerStyles() {
    return {
      position: 'relative',
      boxSizing: 'border-box',
      border: '4px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 4 stretch',
      borderRadius: '4px',
      padding: '4px',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      fontSize: '11px',
      zIndex: '1',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      gap: '6px',
      width: 'auto',
      background: 'transparent',
      cursor: 'context-menu'
    };
  }

  function applyContentContainerStyles(contentDiv) {
    if (!contentDiv) {
      return;
    }

    Object.assign(contentDiv.style, getContentContainerStyles());
  }

  function closeBetterHighscoresContextMenu() {
    if (openContextMenu && openContextMenu.closeMenu) {
      openContextMenu.closeMenu();
    }
  }

  function createSettingsRow(labelText) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;';
    const label = document.createElement('span');
    label.className = 'pixel-font-14';
    label.textContent = labelText;
    label.style.cssText = `color: ${CONTEXT_MENU_COLORS.white}; font-size: 13px; min-width: 110px;`;
    row.appendChild(label);
    return { row, label };
  }

  function createSettingsSliderRow(labelText, min, max, value, onInput) {
    const { row } = createSettingsRow(labelText);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = '1';
    slider.value = String(value);
    slider.style.cssText = 'flex: 1; min-width: 120px; cursor: pointer; accent-color: #e5c07b;';
    const valueLabel = document.createElement('span');
    valueLabel.className = 'pixel-font-14';
    valueLabel.style.cssText = `color: ${CONTEXT_MENU_COLORS.white}; font-size: 13px; min-width: 42px; text-align: right;`;
    valueLabel.textContent = `${value}%`;
    slider.addEventListener('input', () => {
      valueLabel.textContent = `${slider.value}%`;
      onInput(parseInt(slider.value, 10));
    });
    row.appendChild(slider);
    row.appendChild(valueLabel);
    return row;
  }

  function createSettingsCheckboxRow(labelText, checked, onChange) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 10px;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 18px; height: 18px; accent-color: #e5c07b; cursor: pointer;';

    const label = document.createElement('label');
    label.className = 'pixel-font-14';
    label.textContent = labelText;
    label.style.cssText = `color: ${CONTEXT_MENU_COLORS.white}; font-size: 13px; cursor: pointer; flex: 1;`;

    checkbox.addEventListener('change', () => onChange(checkbox.checked));
    label.addEventListener('click', (e) => {
      e.preventDefault();
      checkbox.checked = !checkbox.checked;
      onChange(checkbox.checked);
    });

    row.appendChild(checkbox);
    row.appendChild(label);
    return { row, checkbox };
  }

  function positionContextMenuForAnchor(menu, anchorEl, clientX, clientY) {
    const menuRect = menu.getBoundingClientRect();
    const anchorRect = anchorEl?.getBoundingClientRect?.();
    const gap = 8;
    const padding = 8;

    let left = clientX - (menuRect.width / 2);
    let top;

    if (getBetterHighscoresPlacement() === 'bottom') {
      top = anchorRect
        ? anchorRect.top - menuRect.height - gap
        : clientY - menuRect.height - gap;
    } else {
      top = anchorRect
        ? anchorRect.bottom + gap
        : clientY + gap;
    }

    if (anchorRect) {
      left = anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2);
    }

    left = Math.max(padding, Math.min(left, window.innerWidth - menuRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - menuRect.height - padding));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function createBetterHighscoresContextMenu(anchorEl, x, y) {
    closeBetterHighscoresContextMenu();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000000; background: transparent; pointer-events: auto;';

    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      z-index: 10000001;
      min-width: 280px;
      background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
      border: 4px solid transparent;
      border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
      border-radius: 6px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;

    const title = document.createElement('div');
    title.className = 'pixel-font-16';
    title.textContent = t('mods.betterUI.betterHighscoresSettingsTitle');
    title.style.cssText = `color: ${CONTEXT_MENU_COLORS.accent}; font-weight: bold; margin-bottom: 12px; text-align: center;`;
    menu.appendChild(title);

    menu.appendChild(createSettingsSliderRow(
      t('mods.betterUI.betterHighscoresBackgroundOpacity'),
      0,
      100,
      Math.round(modSettings.backgroundOpacity * 100),
      (value) => {
        modSettings.backgroundOpacity = value / 100;
        saveSettings();
        updateOpacity(modSettings.backgroundOpacity);
      }
    ));

    menu.appendChild(createSettingsSliderRow(
      t('mods.betterUI.betterHighscoresScale'),
      80,
      120,
      Math.round(modSettings.scale * 100),
      (value) => {
        modSettings.scale = value / 100;
        saveSettings();
        updateScale();
      }
    ));

    const placementRow = document.createElement('div');
    placementRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;';
    const placementLabel = document.createElement('label');
    placementLabel.className = 'pixel-font-14';
    placementLabel.textContent = t('mods.betterUI.betterHighscoresPlacement');
    placementLabel.style.cssText = `color: ${CONTEXT_MENU_COLORS.white}; font-size: 13px; font-weight: bold;`;
    const placementSelect = document.createElement('select');
    placementSelect.className = 'pixel-font-14';
    placementSelect.style.cssText = `
      width: 100%;
      padding: 6px;
      background: ${CONTEXT_MENU_COLORS.darkGray};
      border: 1px solid ${CONTEXT_MENU_COLORS.accent};
      color: ${CONTEXT_MENU_COLORS.white};
      border-radius: 3px;
      font-size: 13px;
      cursor: pointer;
      box-sizing: border-box;
    `;
    const topOption = document.createElement('option');
    topOption.value = 'top';
    topOption.textContent = t('mods.betterUI.betterHighscoresPlacementTop');
    const bottomOption = document.createElement('option');
    bottomOption.value = 'bottom';
    bottomOption.textContent = t('mods.betterUI.betterHighscoresPlacementBottom');
    placementSelect.appendChild(topOption);
    placementSelect.appendChild(bottomOption);
    placementSelect.value = modSettings.placement;
    placementSelect.addEventListener('change', () => {
      modSettings.placement = placementSelect.value === 'bottom' ? 'bottom' : 'top';
      saveSettings();
      updatePlacement();
      if (openContextMenu?.repositionMenu) {
        openContextMenu.repositionMenu();
      }
    });
    placementRow.appendChild(placementLabel);
    placementRow.appendChild(placementSelect);
    menu.appendChild(placementRow);

    menu.appendChild(createSettingsCheckboxRow(
      t('mods.betterUI.betterHighscoresShowNavButton'),
      modSettings.showNavButton !== false,
      (checked) => {
        modSettings.showNavButton = checked;
        modSettings.showNavButtonUserDisabled = !checked;
        saveSettings();
        applyNavButtonVisibility();
      }
    ).row);

    const sectionCheckboxes = [];
    const appendSectionCheckbox = (label, settingKey, checked) => {
      const { row, checkbox } = createSettingsCheckboxRow(label, checked, (value) => {
        handleSectionVisibilityToggle(settingKey, value, sectionCheckboxes);
      });
      sectionCheckboxes.push(checkbox);
      menu.appendChild(row);
    };

    appendSectionCheckbox(
      t('mods.betterUI.betterHighscoresShowTime'),
      'showTime',
      modSettings.showTime !== false
    );
    appendSectionCheckbox(
      t('mods.betterUI.betterHighscoresShowRank'),
      'showRank',
      modSettings.showRank !== false
    );
    appendSectionCheckbox(
      t('mods.betterUI.betterHighscoresShowFloor'),
      'showFloor',
      modSettings.showFloor !== false
    );

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;';

    const resetButton = document.createElement('button');
    resetButton.className = 'pixel-font-14';
    resetButton.textContent = t('mods.betterUI.betterHighscoresReset');
    resetButton.style.cssText = `
      min-width: 70px;
      height: 28px;
      padding: 0 8px;
      background: #3a2a1a;
      color: #e5c07b;
      border: 1px solid #555;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    resetButton.addEventListener('click', () => {
      resetSettingsToDefault();
      closeMenu();
    });

    const closeButton = document.createElement('button');
    closeButton.className = 'pixel-font-14';
    closeButton.textContent = t('mods.betterUI.betterHighscoresContextMenuClose');
    closeButton.style.cssText = `
      width: 70px;
      height: 28px;
      background: #1a1a1a;
      color: #888888;
      border: 1px solid #555;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    closeButton.addEventListener('click', closeMenu);

    buttonContainer.appendChild(resetButton);
    buttonContainer.appendChild(closeButton);
    menu.appendChild(buttonContainer);

    function closeMenu() {
      overlay.removeEventListener('mousedown', overlayClickHandler);
      overlay.removeEventListener('click', overlayClickHandler);
      document.removeEventListener('keydown', escHandler);
      overlay.remove();
      menu.remove();
      if (openContextMenu && (openContextMenu.overlay === overlay || openContextMenu.menu === menu)) {
        openContextMenu = null;
      }
    }

    const overlayClickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    };
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    menu.addEventListener('mousedown', (e) => e.stopPropagation());
    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('contextmenu', (e) => e.preventDefault());

    document.body.appendChild(overlay);
    document.body.appendChild(menu);
    overlay.addEventListener('mousedown', overlayClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', escHandler);

    const repositionMenu = () => {
      positionContextMenuForAnchor(menu, anchorEl, x, y);
    };
    repositionMenu();

    openContextMenu = { overlay, menu, closeMenu, repositionMenu };

    return menu;
  }

  function removeRestoreButton() {
    if (restoreButton) {
      restoreButton.remove();
      restoreButton = null;
    }
    document.querySelectorAll('.better-highscores-restore-btn').forEach((el) => el.remove());
  }

  function showRestoreButton() {
    removeRestoreButton();
    if (!isBetterHighscoresHidden()) {
      return;
    }

    if (document.querySelector('.better-highscores-nav-btn')) {
      return;
    }

    const mainContainer = getMainContainer();
    if (!mainContainer) {
      return;
    }

    restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'better-highscores-restore-btn';
    restoreButton.title = t('mods.betterUI.betterHighscoresShowPanel');
    restoreButton.innerHTML = `<img src="https://bestiaryarena.com/assets/icons/achievement.png" alt="${t('mods.betterUI.betterHighscoresButton')}" width="12" height="12" class="pixelated"><span>${t('mods.betterUI.betterHighscoresShowPanel')}</span>`;
    Object.assign(restoreButton.style, {
      position: 'absolute',
      zIndex: '999999',
      cursor: 'pointer',
      padding: '4px 8px',
      background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")',
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      border: '4px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 4 stretch',
      borderRadius: '4px',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      fontSize: '11px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    });
    applyContainerStyles(restoreButton);
    restoreButton.addEventListener('click', (e) => {
      e.stopPropagation();
      setHighscoresHidden(false);
    });
    mainContainer.appendChild(restoreButton);
  }
  
  const DELAYS = {
    RESTORE: 100,
    UPDATE: 200,
    BATTLE_REFRESH: 500,
    MUTATION_RESTORE: 50,
    RETRY: 1000,
    MAP_CHANGE_DEBOUNCE: 50,
    CONTAINER_DEBOUNCE_NORMAL: 100,
    CONTAINER_DEBOUNCE_AUTOPLAY: 50,
    UPDATE_THROTTLE: 100,
    POST_BATTLE_FRESH_WINDOW: 8000,
    HIGHSCORE_RETRY: 2500
  };
  
  const UI_CONFIG = {
         CONTAINER_POSITION: {
      position: 'absolute',
      top: '9px',
      left: '290px',
      width: 'auto',
      height: 'auto'
    },
             CONTAINER_STYLE: {
      background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")',
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      border: '4px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 4 stretch',
      borderRadius: '4px',
      padding: '4px',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      fontSize: '11px',
      zIndex: '999999',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '6px'
    },
    COLORS: {
      GOLD: '#ffd700',
      SILVER: '#c0c0c0',
      BRONZE: '#cd7f32',
      TICK_TITLE: '#87ceeb',
      RANK_TITLE: '#98fb98',
      FLOOR_TITLE: '#ff69b4',
      MAP_HEADER: '#ffd700',
      LEGACY: '#ff6b6b',
    },
    MEDAL_POSITIONS: {
      1: 'GOLD',
      2: 'SILVER', 
      3: 'BRONZE'
    }
  };

  const ASSETS = {
    ACHIEVEMENT_ICON: 'https://bestiaryarena.com/assets/icons/achievement.png',
    HIGHSCORE_ICON: 'https://bestiaryarena.com/assets/icons/highscore.png',
    BACKGROUND: 'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png',
    FRAME: 'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png'
  };

  const SECTION_WRAPPER_STYLE = {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    minWidth: 'auto',
    flexShrink: '0',
    whiteSpace: 'nowrap'
  };

  const ENTRY_SPAN_STYLE = {
    fontSize: '10px',
    fontWeight: 'bold',
    marginRight: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px'
  };

  const SCORE_ICON_STYLE = {
    width: '11px',
    height: '11px',
    verticalAlign: 'middle',
    display: 'inline-block'
  };

  const LEADERBOARD_SECTION_CONFIG = {
    time: {
      title: 'Ticks',
      displayName: 'Time',
      titleColor: UI_CONFIG.COLORS.TICK_TITLE,
      isRank: false,
      isFloor: false
    },
    rank: {
      title: 'Rank',
      displayName: 'Rank',
      titleColor: UI_CONFIG.COLORS.RANK_TITLE,
      isRank: true,
      isFloor: false
    },
    floor: {
      title: 'Floor',
      displayName: 'Floor',
      titleColor: UI_CONFIG.COLORS.FLOOR_TITLE,
      isRank: false,
      isFloor: true
    }
  };

// =======================
// MODULE 1b: Tibia Ball League (wcfield) floor-ticks community leaderboard
// =======================
  const TBL_ROOM_ID = 'wcfield';
  const TBL_FIREBASE_BASE = 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app/events';
  // Event competition data is retained in Firebase after the event ends; never auto-deleted.
  // Leaderboard: /events/scores/{floor}/{playerHash} — name, ticks, date, updatedAt (lean)
  // Rank board: /events/rank-scores/{floor}/{playerHash} — name, rank, ticks, date, updatedAt
  // Replays (admin): /events/replays/{floor}/{playerHash} — replay ($replay string) + metadata
  // Participants: /events/participants/{playerHash} — name, joinedAt, highscoreFloorTicks {0, 15} for tiebreaker
  const TBL_JOIN_STORAGE_KEY = 'better-highscores-tbl-joined';
  const TBL_LEADERBOARD_TOP = 10;
  const TBL_MIN_FLOOR = 0;
  const TBL_MAX_FLOOR = 15;
  const TBL_FIREBASE_FLOOR_MIN = 1;
  const TBL_FIREBASE_FLOOR_MAX = 14;
  const TBL_HIGHSCORE_FLOORS = new Set([0, 15]);
  const TBL_HIGHSCORE_RANK_FLOORS = new Set([0]);
  const TBL_MISSING_FLOOR_TICKS = 9600;
  const TBL_COMPETITION_TAB = { RANK: 'rank', FLOOR: 'floor' };
  const TBL_EVENT_TIMER_INTERVAL_MS = 1000;
  const TBL_EVENT_PRIZE_BEAST_COINS = 500;
  const TBL_SUBMIT_MIN_INTERVAL_MS = 2000;
  const TBL_FETCH_CACHE_TTL_MS = 60000;
  const TBL_FETCH_MIN_INTERVAL_MS = 15000;
  const TBL_JOIN_STATE_CACHE_TTL_MS = 120000;
  const TBL_PARTICIPANTS_CACHE_TTL_MS = 60000;
  const TBL_PARTICIPANT_SYNC_MIN_INTERVAL_MS = 60000;
  const TBL_PARTICIPANTS_PATH = `${TBL_FIREBASE_BASE}/participants`;
  const TBL_SCORES_PATH = `${TBL_FIREBASE_BASE}/scores`;
  const TBL_RANK_SCORES_PATH = `${TBL_FIREBASE_BASE}/rank-scores`;

  const TBL_MODAL_ID = 'better-highscores-tbl-modal';
  const TBL_STYLES_ID = 'better-highscores-tbl-styles';
  const TBL_MODAL_WIDTH = 550;
  const TBL_MODAL_HEIGHT = 550;
  const TBL_MODAL_VIEWPORT_PADDING = 16;
  const TBL_MODAL_MIN_WIDTH = 280;
  const TBL_MODAL_MIN_HEIGHT = 320;
  const TBL_TOAST_DURATION_MS = 10000;
  const TBL_TOAST_CONTAINER_ID = 'better-highscores-tbl-toast-container';
  // Matches /assets/UI/floor-{n}.png accent colors (mint → green → gold → red).
  const TBL_FLOOR_SCALE_COLORS = [
    '#97f7bc', '#65f19b', '#3acb71', '#4dcb7e', '#28d269',
    '#27b45d', '#9b8a41', '#c2ad51', '#c3a937', '#b99e22',
    '#ae900a', '#b85151', '#c74848', '#cc2e2e', '#d01616', '#e80202'
  ];
  const TBL_LEAGUE_TAB_ICON_SIZE = 12;
  const TBL_LEAGUE_TAB_ICONS = {
    rank: { src: '/assets/icons/star-tier.png', alt: 'Rank' },
    floor: { src: '/assets/icons/speed.png', alt: 'Ticks' }
  };

  const TblFloorLeagueState = {
    joined: false,
    joinChecked: false,
    joinedAt: 0,
    playerHash: null,
    modalRef: null,
    layoutCleanup: null,
    lastSubmitAt: 0,
    lastRankSubmitAt: 0,
    lastProcessedSeed: null,
    myEventScores: {},
    myEventRankScores: {},
    myEventRankTicks: {},
    boardUnsubscribe: null,
    fetchRestore: null,
    runTrackerTrigger: null,
    eventTimerInterval: null,
    raidsUnsubscribe: null,
    eventNextCheckEndTime: null,
    floorBarRows: null,
    floorBarCacheAt: 0,
    rankBarRows: null,
    rankBarCacheAt: 0,
    activeModalTab: TBL_COMPETITION_TAB.FLOOR,
    lastBarFloor: null,
    trackedBattleSetup: null,
    playerTotalTicks: null,
    playerTotalRanks: null,
    playerTotalRankTicks: null,
    eventWasActive: false,
    participantCount: 0,
    fetchCache: new Map(),
    fetchInFlight: new Map(),
    fullLoadInFlight: null,
    rankFullLoadInFlight: null,
    lastFullLoadAt: 0,
    lastRankFullLoadAt: 0,
    lastParticipantSyncAt: 0,
    joinStateCachedAt: 0
  };

  const TblFirebase = {
    get(path, defaultReturn = null) {
      return fetch(`${path}.json`).then((r) => {
        if (!r.ok) return r.status === 404 ? defaultReturn : Promise.reject(new Error(`GET ${r.status}`));
        return r.json();
      }).catch((err) => {
        console.warn('[Better Highscores][TBL] Firebase GET error:', err);
        return defaultReturn;
      });
    },
    put(path, data) {
      return fetch(`${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then((r) => {
        if (!r.ok) return Promise.reject(new Error(`PUT ${r.status}`));
        return r.json();
      });
    }
  };

  function tblFirebaseGetCached(path, options = {}) {
    const {
      ttl = TBL_FETCH_CACHE_TTL_MS,
      defaultReturn = null,
      force = false
    } = options;
    const now = Date.now();

    if (!force) {
      const cached = TblFloorLeagueState.fetchCache.get(path);
      if (cached && now - cached.at < ttl) {
        return Promise.resolve(cached.data);
      }
      const inFlight = TblFloorLeagueState.fetchInFlight.get(path);
      if (inFlight) {
        return inFlight;
      }
    }

    const request = TblFirebase.get(path, defaultReturn)
      .then((data) => {
        TblFloorLeagueState.fetchCache.set(path, { data, at: Date.now() });
        return data;
      })
      .finally(() => {
        TblFloorLeagueState.fetchInFlight.delete(path);
      });

    TblFloorLeagueState.fetchInFlight.set(path, request);
    return request;
  }

  function invalidateTblFetchCache(paths) {
    if (!paths) {
      TblFloorLeagueState.fetchCache.clear();
      invalidateTblFloorBarCache();
      return;
    }
    const pathList = Array.isArray(paths) ? paths : [paths];
    pathList.forEach((path) => {
      TblFloorLeagueState.fetchCache.delete(path);
    });
    invalidateTblFloorBarCache();
  }

  function buildTblParticipantHighscoreMap(participants) {
    const tickMap = new Map();
    const rankMap = new Map();
    const rankTickMap = new Map();
    if (!participants || typeof participants !== 'object') {
      return { tickMap, rankMap, rankTickMap };
    }
    Object.values(participants).forEach((participant) => {
      if (!participant?.name) {
        return;
      }
      const highscores = { 0: null, 15: null };
      const highscoreRanks = { 0: null };
      const highscoreRankTicks = { 0: null };
      const stored = participant.highscoreFloorTicks;
      if (stored && typeof stored === 'object') {
        if (Number.isFinite(Number(stored[0]))) {
          highscores[0] = Number(stored[0]);
        }
        if (Number.isFinite(Number(stored[15]))) {
          highscores[15] = Number(stored[15]);
        }
      }
      const storedRanks = participant.highscoreFloorRanks;
      if (storedRanks && typeof storedRanks === 'object' && Number.isFinite(Number(storedRanks[0]))) {
        highscoreRanks[0] = Number(storedRanks[0]);
      }
      const storedRankTicks = participant.highscoreFloorRankTicks;
      if (storedRankTicks && typeof storedRankTicks === 'object' && Number.isFinite(Number(storedRankTicks[0]))) {
        highscoreRankTicks[0] = Number(storedRankTicks[0]);
      }
      tickMap.set(participant.name, highscores);
      rankMap.set(participant.name, highscoreRanks);
      rankTickMap.set(participant.name, highscoreRankTicks);
    });
    return { tickMap, rankMap, rankTickMap };
  }

  async function loadTblParticipantsBundle(force = false) {
    const participants = await tblFirebaseGetCached(TBL_PARTICIPANTS_PATH, {
      ttl: TBL_PARTICIPANTS_CACHE_TTL_MS,
      defaultReturn: {},
      force
    });
    const count = !participants || typeof participants !== 'object'
      ? 0
      : Object.values(participants).filter((entry) => entry && entry.name).length;
    const { tickMap, rankMap, rankTickMap } = buildTblParticipantHighscoreMap(participants);
    return {
      participants: participants && typeof participants === 'object' ? participants : {},
      count,
      highscoreMap: tickMap,
      highscoreRankMap: rankMap,
      highscoreRankTickMap: rankTickMap
    };
  }

  function tblScoresPath(floor) {
    return `${TBL_SCORES_PATH}/${floor}`;
  }

  function tblRankScoresPath(floor) {
    return `${TBL_RANK_SCORES_PATH}/${floor}`;
  }

  function isTblMapActive(mapCode = getCurrentMapCode()) {
    return mapCode === TBL_ROOM_ID;
  }

  function getTblPlayerName() {
    const snapshot = getPlayerSnapshot();
    return snapshot?.context?.name || snapshot?.context?.playerName || null;
  }

  async function hashTblPlayerName(username) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(username).toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function getTblPlayerHash() {
    if (TblFloorLeagueState.playerHash) {
      return TblFloorLeagueState.playerHash;
    }
    const name = getTblPlayerName();
    if (!name) {
      return null;
    }
    TblFloorLeagueState.playerHash = await hashTblPlayerName(name);
    return TblFloorLeagueState.playerHash;
  }

  function readTblJoinedLocal() {
    try {
      return localStorage.getItem(TBL_JOIN_STORAGE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function writeTblJoinedLocal(joined) {
    try {
      if (joined) {
        localStorage.setItem(TBL_JOIN_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(TBL_JOIN_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('[Better Highscores][TBL] Could not persist join state:', error);
    }
  }

  async function refreshTblJoinState(force = false) {
    const name = getTblPlayerName();
    if (!name) {
      TblFloorLeagueState.joined = false;
      TblFloorLeagueState.joinChecked = true;
      return false;
    }
    const hash = await getTblPlayerHash();
    if (!hash) {
      TblFloorLeagueState.joined = false;
      TblFloorLeagueState.joinChecked = true;
      return false;
    }

    const now = Date.now();
    if (
      !force &&
      TblFloorLeagueState.joinChecked &&
      now - TblFloorLeagueState.joinStateCachedAt < TBL_JOIN_STATE_CACHE_TTL_MS
    ) {
      return TblFloorLeagueState.joined;
    }

    const participantPath = `${TBL_PARTICIPANTS_PATH}/${hash}`;
    const remote = await tblFirebaseGetCached(participantPath, {
      ttl: TBL_JOIN_STATE_CACHE_TTL_MS,
      defaultReturn: null,
      force
    });
    const joined = Boolean(remote && remote.name);
    TblFloorLeagueState.joined = joined;
    TblFloorLeagueState.joinedAt = joined ? (Number(remote.joinedAt) || 0) : 0;
    TblFloorLeagueState.joinChecked = true;
    TblFloorLeagueState.joinStateCachedAt = now;
    writeTblJoinedLocal(joined);
    return joined;
  }

  async function joinTblFloorLeague() {
    const name = getTblPlayerName();
    if (!name) {
      console.warn('[Better Highscores][TBL] Cannot join without player name');
      return false;
    }
    const hash = await getTblPlayerHash();
    if (!hash) {
      return false;
    }
    const joinedAt = Date.now();
    await TblFirebase.put(
      `${TBL_PARTICIPANTS_PATH}/${hash}`,
      buildTblParticipantRecord(null, name, joinedAt)
    );
    invalidateTblFetchCache(TBL_PARTICIPANTS_PATH);
    invalidateTblFetchCache(`${TBL_PARTICIPANTS_PATH}/${hash}`);
    TblFloorLeagueState.joined = true;
    TblFloorLeagueState.joinedAt = joinedAt;
    TblFloorLeagueState.joinChecked = true;
    writeTblJoinedLocal(true);
    invalidateTblFloorBarCache();
    refreshTblFloorBarSection().catch(() => {});
    await refreshTblFloorLeagueModalIfOpen();
    updateLeaderboards();
    return true;
  }

  function getTblRoomIdFromServerResults(serverResults) {
    return serverResults?.rewardScreen?.roomId || serverResults?.roomId || null;
  }

  function getTblFloorTicksFromServerResults(serverResults) {
    const reward = serverResults?.rewardScreen;
    if (!reward) {
      return null;
    }
    const candidates = [
      reward.floorTicks,
      serverResults.floorTicks,
      reward.gameTicks,
      serverResults.time
    ];
    for (const value of candidates) {
      const ticks = Number(value);
      if (Number.isFinite(ticks) && ticks > 0) {
        return ticks;
      }
    }
    return null;
  }

  function getTblRankFromServerResults(serverResults) {
    const reward = serverResults?.rewardScreen;
    if (!reward) {
      return null;
    }
    const rank = Number(reward.rank);
    if (!Number.isFinite(rank) || rank <= 0) {
      return null;
    }
    return rank;
  }

  function isTblFirebaseRankFloor(floor) {
    return floor >= 1 && floor <= TBL_MAX_FLOOR;
  }

  function isTblHighscoreRankFloor(floor) {
    return TBL_HIGHSCORE_RANK_FLOORS.has(floor);
  }

  function isTblRankScoreBetter(candidateRank, candidateTicks, existing) {
    if (!existing || !Number.isFinite(Number(existing.rank))) {
      return true;
    }
    const previousRank = Number(existing.rank);
    const previousTicks = Number.isFinite(Number(existing.ticks)) ? Number(existing.ticks) : null;
    if (candidateRank > previousRank) {
      return true;
    }
    if (candidateRank < previousRank) {
      return false;
    }
    if (candidateTicks === null || candidateTicks === undefined) {
      return false;
    }
    if (previousTicks === null || previousTicks === undefined) {
      return true;
    }
    return candidateTicks < previousTicks;
  }

  function isTblPlayerBoardPiece(piece) {
    return piece?.type === 'player' || piece?.type === 'custom';
  }

  function getTblInventoryMonster(databaseId) {
    if (!databaseId) {
      return null;
    }
    const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
    if (!Array.isArray(monsters)) {
      return null;
    }
    return monsters.find((monster) => monster.id === databaseId) || null;
  }

  function getTblInventoryEquipment(equipId) {
    if (equipId === null || equipId === undefined) {
      return null;
    }
    const equips = globalThis.state?.player?.getSnapshot?.()?.context?.equips;
    if (!Array.isArray(equips)) {
      return null;
    }
    return equips.find((equip) => String(equip.id) === String(equipId)) || null;
  }

  function serializeTblBoardPiece(piece) {
    const boardPiece = {
      tile: piece.tileIndex,
      monsterId: piece.monsterId || piece.gameId || piece.databaseId || null,
      databaseId: piece.databaseId || null,
      level: piece.level || 50
    };

    if (piece.monster?.name) {
      boardPiece.monsterName = piece.monster.name;
      boardPiece.monsterStats = {
        hp: piece.monster.hp ?? 20,
        ad: piece.monster.ad ?? 20,
        ap: piece.monster.ap ?? 20,
        armor: piece.monster.armor ?? 20,
        magicResist: piece.monster.magicResist ?? 20
      };
    } else if (piece.monsterName) {
      boardPiece.monsterName = piece.monsterName;
    } else if (piece.name) {
      boardPiece.monsterName = piece.name;
    }

    const inventoryMonster = getTblInventoryMonster(piece.databaseId);
    if (inventoryMonster) {
      if (globalThis.state?.utils?.expToCurrentLevel) {
        boardPiece.level = globalThis.state.utils.expToCurrentLevel(inventoryMonster.exp);
      }
      boardPiece.monsterStats = {
        hp: inventoryMonster.hp,
        ad: inventoryMonster.ad,
        ap: inventoryMonster.ap,
        armor: inventoryMonster.armor,
        magicResist: inventoryMonster.magicResist
      };
      if (inventoryMonster.genes) {
        boardPiece.genes = inventoryMonster.genes;
      }
    } else if (
      piece.hp !== undefined ||
      piece.ad !== undefined ||
      piece.ap !== undefined ||
      piece.armor !== undefined ||
      piece.magicResist !== undefined
    ) {
      boardPiece.monsterStats = {
        hp: piece.hp ?? 20,
        ad: piece.ad ?? 20,
        ap: piece.ap ?? 20,
        armor: piece.armor ?? 20,
        magicResist: piece.magicResist ?? 20
      };
    }

    const equipSource = piece.equip || piece.equipment;
    if (equipSource) {
      boardPiece.equipId = equipSource.gameId ?? equipSource.id ?? piece.equipId ?? null;
      boardPiece.equipmentName = equipSource.name || null;
      boardPiece.equipmentStat = equipSource.stat || 'ap';
      boardPiece.equipmentTier = equipSource.tier || 5;
    } else if (piece.equipId) {
      boardPiece.equipId = piece.equipId;
      const inventoryEquip = getTblInventoryEquipment(piece.equipId);
      if (inventoryEquip) {
        boardPiece.equipmentStat = inventoryEquip.stat || 'ap';
        boardPiece.equipmentTier = inventoryEquip.tier || 5;
      }
    }

    return boardPiece;
  }

  function buildTblSetupFromBoardConfig(boardConfig) {
    if (!Array.isArray(boardConfig)) {
      return null;
    }

    const pieces = boardConfig
      .filter(isTblPlayerBoardPiece)
      .map(serializeTblBoardPiece)
      .sort((a, b) => a.tile - b.tile);

    if (!pieces.length) {
      return null;
    }

    return {
      mapId: TBL_ROOM_ID,
      pieces
    };
  }

  function getTblSetupFromCurrentBoard() {
    const boardConfig = globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig;
    return buildTblSetupFromBoardConfig(boardConfig);
  }

  function trackTblBattleSetup(context) {
    if (!isTblMapActive() || context?.serverResults?.rewardScreen) {
      return;
    }

    const setup = buildTblSetupFromBoardConfig(context?.boardConfig);
    if (setup?.pieces?.length) {
      TblFloorLeagueState.trackedBattleSetup = setup;
    }
  }

  function getTblSetupForSubmission() {
    const setup = TblFloorLeagueState.trackedBattleSetup || getTblSetupFromCurrentBoard();
    TblFloorLeagueState.trackedBattleSetup = null;
    return setup?.pieces?.length ? setup : null;
  }

  function parseTblSerializedBoard() {
    if (typeof window.$serializeBoard === 'function') {
      try {
        return JSON.parse(window.$serializeBoard());
      } catch (error) {
        // Fall through to BestiaryModAPI
      }
    }
    if (window.BestiaryModAPI?.utility?.serializeBoard) {
      try {
        return JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function buildTblReplayBoardFromSetup(setup) {
    if (!setup?.pieces?.length) {
      return [];
    }

    return setup.pieces.map((piece) => {
      const boardPiece = {
        tile: piece.tile || 0
      };
      const level = piece.level || 1;
      const stats = piece.monsterStats || {};
      const monster = {
        name: String(piece.monsterName || piece.monsterId || 'unknown').toLowerCase(),
        level,
        hp: stats.hp ?? 20,
        ad: stats.ad ?? 20,
        ap: stats.ap ?? 20,
        armor: stats.armor ?? 20,
        magicResist: stats.magicResist ?? 20
      };
      if (level > 50) {
        monster.awakened = true;
      }
      boardPiece.monster = monster;

      if (piece.equipmentName || piece.equipId) {
        boardPiece.equipment = {
          name: String(piece.equipmentName || piece.equipId || 'unknown').toLowerCase(),
          stat: piece.equipmentStat || 'ap',
          tier: piece.equipmentTier || 5
        };
      }

      return boardPiece;
    });
  }

  function buildTblReplayString(serverResults, floor, setup) {
    if (!serverResults || serverResults.seed === undefined || serverResults.seed === null) {
      return '';
    }

    const boardJson = parseTblSerializedBoard();
    const replayData = {};

    if (boardJson?.board) {
      if (boardJson.region) {
        replayData.region = boardJson.region;
      }
      replayData.map = boardJson.map || TBL_ROOM_ID;
      replayData.floor = Number.isFinite(floor) ? floor : (boardJson.floor ?? 0);
      replayData.board = boardJson.board;
    } else if (setup?.pieces?.length) {
      replayData.map = TBL_ROOM_ID;
      replayData.floor = Number.isFinite(floor) ? floor : 0;
      replayData.board = buildTblReplayBoardFromSetup(setup);
    } else {
      return '';
    }

    if (!replayData.region) {
      const boardSnapshot = globalThis.state?.board?.getSnapshot?.()?.context;
      const regionName = boardSnapshot?.selectedMap?.selectedRegion?.name
        || boardSnapshot?.selectedMap?.selectedRegion?.id;
      if (regionName) {
        replayData.region = regionName;
      }
    }

    replayData.seed = serverResults.seed;
    return `$replay(${JSON.stringify(replayData)})`;
  }

  async function buildTblReplayStringWithRetry(serverResults, floor, setup, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const replay = buildTblReplayString(serverResults, floor, setup);
      if (replay) {
        return replay;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => scheduleTimeout(resolve, (attempt + 1) * 200));
      }
    }
    return '';
  }

  function getTblToastContainer() {
    if (typeof document === 'undefined') {
      return null;
    }
    let container = document.getElementById(TBL_TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TBL_TOAST_CONTAINER_ID;
      container.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
      document.body.appendChild(container);
    }
    return container;
  }

  function updateTblToastPositions(container) {
    if (!container) {
      return;
    }
    container.querySelectorAll('.tbl-event-toast-item').forEach((toast, index) => {
      toast.style.transform = `translateY(-${index * 46}px)`;
    });
  }

  function showTblEventToast(message, options = {}) {
    const safeMessage = message != null && message !== '' ? String(message).replace(/</g, '&lt;') : '';
    if (!safeMessage) {
      return;
    }

    try {
      const container = getTblToastContainer();
      if (!container) {
        return;
      }

      const duration = typeof options.duration === 'number' && options.duration > 0
        ? options.duration
        : TBL_TOAST_DURATION_MS;
      const existingToasts = container.querySelectorAll('.tbl-event-toast-item');
      const stackOffset = existingToasts.length * 46;
      const flexContainer = document.createElement('div');
      flexContainer.className = 'tbl-event-toast-item';
      flexContainer.style.cssText = `display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-${stackOffset}px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;`;

      const toast = document.createElement('button');
      toast.type = 'button';
      toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
      toast.style.pointerEvents = 'auto';

      const widgetTop = document.createElement('div');
      widgetTop.className = 'widget-top h-2.5';
      const widgetBottom = document.createElement('div');
      widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

      const messageDiv = document.createElement('div');
      messageDiv.className = 'text-left';
      messageDiv.style.flex = '1 1 auto';
      if (safeMessage.indexOf('\n') !== -1) {
        messageDiv.style.whiteSpace = 'pre-line';
      }
      if (options.messageColor) {
        messageDiv.style.color = options.messageColor;
      }
      messageDiv.textContent = safeMessage;
      widgetBottom.appendChild(messageDiv);

      toast.appendChild(widgetTop);
      toast.appendChild(widgetBottom);
      flexContainer.appendChild(toast);
      container.appendChild(flexContainer);

      const removeToast = () => {
        if (flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateTblToastPositions(container);
        }
      };

      toast.addEventListener('click', removeToast);
      scheduleTimeout(removeToast, duration);
    } catch (error) {
      console.warn('[Better Highscores][TBL] Toast failed:', error);
    }
  }

  function getTblEventRaidEntry() {
    const list = globalThis.state?.raids?.getSnapshot?.()?.context?.list || [];
    return list.find((raid) => raid.roomId === TBL_ROOM_ID) || null;
  }

  function isTblEventCompetitionActive() {
    return getTblEventTimerState().active;
  }

  function getTblEventTimerState() {
    const now = Date.now();
    const raid = getTblEventRaidEntry();
    if (raid?.expiresAt && Number(raid.expiresAt) > now) {
      TblFloorLeagueState.eventNextCheckEndTime = null;
      return {
        active: true,
        msRemaining: Number(raid.expiresAt) - now
      };
    }

    const raidContext = globalThis.state?.raids?.getSnapshot?.()?.context;
    const willUpdateAt = Number(raidContext?.willUpdateAt) || 0;
    const msUntilUpdate = Number(raidContext?.msUntilNextUpdate) || 0;

    if (willUpdateAt > now) {
      TblFloorLeagueState.eventNextCheckEndTime = willUpdateAt;
    } else if (msUntilUpdate > 0) {
      if (!TblFloorLeagueState.eventNextCheckEndTime || TblFloorLeagueState.eventNextCheckEndTime <= now) {
        TblFloorLeagueState.eventNextCheckEndTime = now + msUntilUpdate;
      }
    } else {
      TblFloorLeagueState.eventNextCheckEndTime = null;
    }

    return {
      active: false,
      msRemaining: TblFloorLeagueState.eventNextCheckEndTime
        ? Math.max(0, TblFloorLeagueState.eventNextCheckEndTime - now)
        : 0
    };
  }

  function formatTblEventTimer(msRemaining) {
    const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  function getTblEventTimerColor(msRemaining, active) {
    if (!active) {
      return '#ccc';
    }
    if (msRemaining < 60000) {
      return '#f88';
    }
    if (msRemaining < 300000) {
      return '#ff8';
    }
    return '#8f8';
  }

  function updateTblEventTimerDisplay() {
    if (modDisposed) {
      return;
    }
    const valueEls = document.querySelectorAll('.tbl-event-timer-value');
    if (!valueEls.length) {
      return;
    }

    const { active, msRemaining } = getTblEventTimerState();
    if (active) {
      TblFloorLeagueState.eventWasActive = true;
    }
    valueEls.forEach((valueEl) => {
      if (active && msRemaining > 0) {
        valueEl.textContent = t('mods.betterUI.tblLeagueEventEndsIn', {
          time: formatTblEventTimer(msRemaining)
        });
        valueEl.style.color = getTblEventTimerColor(msRemaining, true);
        return;
      }

      if (TblFloorLeagueState.eventWasActive) {
        valueEl.textContent = t('mods.betterUI.tblLeagueEventEnded');
        valueEl.style.color = '#ccc';
        return;
      }

      if (msRemaining > 0) {
        valueEl.textContent = t('mods.betterUI.tblLeagueEventInactiveCheck', {
          time: formatTblEventTimer(msRemaining)
        });
        valueEl.style.color = '#ccc';
        return;
      }

      valueEl.textContent = t('mods.betterUI.tblLeagueEventInactive');
      valueEl.style.color = '#ccc';
    });
  }

  function unsubscribeTblSubscription(subscription) {
    if (!subscription) {
      return;
    }
    if (typeof subscription === 'function') {
      subscription();
      return;
    }
    if (typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
    }
  }

  function clearTblEventTimerUpdates() {
    if (TblFloorLeagueState.eventTimerInterval) {
      clearInterval(TblFloorLeagueState.eventTimerInterval);
      TblFloorLeagueState.eventTimerInterval = null;
    }
    unsubscribeTblSubscription(TblFloorLeagueState.raidsUnsubscribe);
    TblFloorLeagueState.raidsUnsubscribe = null;
  }

  function setupTblEventTimerUpdates() {
    clearTblEventTimerUpdates();
    TblFloorLeagueState.eventNextCheckEndTime = null;
    updateTblEventTimerDisplay();
    TblFloorLeagueState.eventTimerInterval = setInterval(
      updateTblEventTimerDisplay,
      TBL_EVENT_TIMER_INTERVAL_MS
    );
    if (globalThis.state?.raids?.subscribe) {
      TblFloorLeagueState.raidsUnsubscribe = globalThis.state.raids.subscribe(() => {
        TblFloorLeagueState.eventNextCheckEndTime = null;
        updateTblEventTimerDisplay();
      });
    }
  }

  function createTblEventCompetitionButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = [
      'tbl-event-competition-btn',
      'focus-style-visible',
      'flex',
      'items-center',
      'justify-center',
      'tracking-wide',
      'text-whiteRegular',
      'frame-1',
      'active:frame-pressed-1',
      'surface-regular',
      'gap-1',
      'px-1',
      'py-0',
      'pb-[2px]',
      'pixel-font-14'
    ].join(' ');
    button.title = t('mods.betterUI.tblLeagueOpenHint');
    Object.assign(button.style, {
      marginLeft: '2px',
      cursor: 'pointer',
      flexShrink: '0',
      lineHeight: '1'
    });

    const icon = document.createElement('img');
    icon.src = 'https://bestiaryarena.com/assets/icons/wc-mini-icon.png';
    icon.alt = '';
    icon.className = 'pixelated';
    Object.assign(icon.style, {
      width: '11px',
      height: '11px',
      objectFit: 'contain',
      flexShrink: '0'
    });
    button.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tbl-event-competition-btn-label';
    label.style.whiteSpace = 'nowrap';
    label.textContent = TblFloorLeagueState.joined
      ? t('mods.betterUI.tblLeagueBoard')
      : t('mods.betterUI.tblLeagueJoin');
    if (!TblFloorLeagueState.joined) {
      label.style.color = '#ffd700';
    }
    button.appendChild(label);

    return button;
  }

  function getSelectedBoardFloor() {
    const raw = globalThis.state?.board?.getSnapshot?.()?.context?.floor;
    const floor = Number(raw);
    if (!Number.isFinite(floor)) {
      return TBL_MIN_FLOOR;
    }
    return Math.min(TBL_MAX_FLOOR, Math.max(TBL_MIN_FLOOR, floor));
  }

  function getTblFloorBarRow(floor) {
    return TblFloorLeagueState.floorBarRows?.find((row) => row.floor === floor) || null;
  }

  function invalidateTblFloorBarCache() {
    TblFloorLeagueState.floorBarCacheAt = 0;
    TblFloorLeagueState.floorBarRows = null;
    TblFloorLeagueState.rankBarCacheAt = 0;
    TblFloorLeagueState.rankBarRows = null;
  }

  async function ensureTblFloorBarData(force = false) {
    const rows = await loadTblAllFloorData(force);
    TblFloorLeagueState.floorBarRows = rows;
    TblFloorLeagueState.floorBarCacheAt = Date.now();
    return rows;
  }

  async function refreshTblFloorBarSection(force = false) {
    if (modDisposed || !isTblMapActive() || !leaderboardContainer?.isConnected) {
      return;
    }

    await ensureTblFloorBarData(force);

    const contentDiv = leaderboardContainer._contentDiv
      || leaderboardContainer.querySelector('div[style*="position: relative"]');
    if (!contentDiv || contentDiv.children.length < 3) {
      return;
    }

    const selectedFloor = getSelectedBoardFloor();
    TblFloorLeagueState.lastBarFloor = selectedFloor;
    const oldSection = contentDiv.children[2];
    const newSection = createTblFloorLeaderboardSection();
    oldSection.replaceWith(newSection);
    applySectionVisibility(contentDiv);
  }

  function scheduleTblFloorBarRefresh() {
    if (modDisposed || !isTblMapActive()) {
      return;
    }
    ensureTblFloorBarData().then(() => {
      if (modDisposed || !isTblMapActive()) {
        return;
      }
      refreshTblFloorBarSection();
    }).catch(() => {});
  }

  function removeTblBoardSubscription() {
    if (!TblFloorLeagueState.boardUnsubscribe) {
      return;
    }
    const subscription = TblFloorLeagueState.boardUnsubscribe;
    TblFloorLeagueState.boardUnsubscribe = null;
    unsubscribeTblSubscription(subscription);
    const index = BetterHighscoresState.subscriptions.indexOf(subscription);
    if (index >= 0) {
      BetterHighscoresState.subscriptions.splice(index, 1);
    }
  }

  function cleanupTblToastContainer() {
    if (typeof document === 'undefined') {
      return;
    }
    const container = document.getElementById(TBL_TOAST_CONTAINER_ID);
    if (container) {
      container.remove();
    }
  }

  function appendTblSelectedFloorUserEntry(section, floor, yourTicks, youLead) {
    const userEntrySpan = document.createElement('span');
    const hasTicks = yourTicks !== null && yourTicks !== undefined;
    Object.assign(userEntrySpan.style, ENTRY_SPAN_STYLE, {
      color: youLead ? '#00ff00' : (hasTicks ? '#ffa500' : '#888'),
      cursor: 'default'
    });
    userEntrySpan.appendChild(createScoreIcon(
      ASSETS.ACHIEVEMENT_ICON,
      'You',
      'Your time on this floor'
    ));

    const valueText = document.createElement('span');
    valueText.textContent = hasTicks
      ? `${floor} (${yourTicks})`
      : `${floor} (${TBL_MISSING_FLOOR_TICKS})`;
    userEntrySpan.appendChild(valueText);
    section.appendChild(userEntrySpan);
  }

  function appendTblSelectedFloorLeaderEntry(section, floor, leader, playerName) {
    const isYou = Boolean(playerName && leader?.name === playerName);
    const entry = {
      userName: leader.name,
      floor,
      floorTicks: leader.ticks,
      ticks: leader.ticks
    };
    const formattedEntry = formatLeaderboardEntry(entry, 0, false, true, null);
    const entrySpan = document.createElement('span');
    Object.assign(entrySpan.style, ENTRY_SPAN_STYLE, {
      color: isYou ? '#00ff00' : formattedEntry.color,
      fontWeight: formattedEntry.fontWeight
    });

    entrySpan.appendChild(createScoreIcon(
      isYou ? ASSETS.ACHIEVEMENT_ICON : ASSETS.HIGHSCORE_ICON,
      isYou ? 'You' : 'Top',
      isYou ? 'You lead this floor' : 'Floor leader'
    ));

    const valueText = document.createElement('span');
    valueText.textContent = formattedEntry.value;
    entrySpan.appendChild(valueText);
    section.appendChild(entrySpan);
  }

  function shouldShowTblFloorLeaderEntry(row, yourTicks, playerName) {
    if (!row?.leader || row.leaderTicks === null || row.leaderTicks === undefined) {
      return false;
    }
    const samePlayer = Boolean(playerName && row.leader?.name === playerName);
    const sameTicks = yourTicks !== null && yourTicks !== undefined && Number(yourTicks) === Number(row.leaderTicks);
    // Avoid duplicate "You" entries when the user is also the floor leader.
    if (samePlayer && sameTicks) {
      return false;
    }
    return true;
  }

  function createTblFloorLeaderboardSection() {
    const config = LEADERBOARD_SECTION_CONFIG.floor;
    const section = document.createElement('div');
    section.className = 'tbl-dynamic-floor-section';
    Object.assign(section.style, SECTION_WRAPPER_STYLE);

    const titleText = document.createElement('span');
    Object.assign(titleText.style, {
      fontWeight: 'bold',
      color: config.titleColor,
      fontSize: '10px'
    });
    titleText.textContent = config.displayName || config.title;
    section.appendChild(titleText);

    const selectedFloor = getSelectedBoardFloor();
    TblFloorLeagueState.lastBarFloor = selectedFloor;
    const row = getTblFloorBarRow(selectedFloor);
    const userScores = getTblUserScoresForMap();
    const playerName = getTblPlayerName();
    const yourTicks = row?.yourTicks ?? getTblYourTicksForFloor(
      selectedFloor,
      TblFloorLeagueState.myEventScores,
      userScores
    );

    const maxDisplay = document.createElement('span');
    Object.assign(maxDisplay.style, {
      fontSize: '10px',
      fontWeight: 'bold',
      ...buildTblFloorScaleTextStyle(selectedFloor)
    });
    maxDisplay.textContent = `${selectedFloor}`;
    section.appendChild(maxDisplay);

    appendTblSelectedFloorUserEntry(section, selectedFloor, yourTicks, row?.youLead);

    const hasLeaderData = Boolean(row?.leader && row.leaderTicks !== null && row.leaderTicks !== undefined);
    if (shouldShowTblFloorLeaderEntry(row, yourTicks, playerName)) {
      appendTblSelectedFloorLeaderEntry(section, selectedFloor, row.leader, playerName);
    } else if (!hasLeaderData) {
      appendWorldRecordPlaceholder(section);
    }

    decorateTblFloorSection(section, getUserBestScores());

    if (!TblFloorLeagueState.floorBarRows) {
      scheduleTblFloorBarRefresh();
    }

    return section;
  }

  function isTblFirebaseFloor(floor) {
    return floor >= TBL_FIREBASE_FLOOR_MIN && floor <= TBL_FIREBASE_FLOOR_MAX;
  }

  function isTblHighscoreFloor(floor) {
    return TBL_HIGHSCORE_FLOORS.has(floor);
  }

  function getTblUserScoresForMap() {
    const room = getPlayerSnapshot()?.context?.rooms?.[TBL_ROOM_ID];
    if (!room) {
      return null;
    }
    return {
      bestTicks: room.ticks ?? null,
      bestRank: room.rank ?? null,
      bestRankTicks: room.rankTicks ?? null,
      bestFloor: room.floor !== undefined && room.floor !== null ? room.floor : 0,
      bestFloorTicks: room.floorTicks ?? null
    };
  }

  function hasTblYourRun(yourTicks) {
    return yourTicks !== null && yourTicks !== undefined;
  }

  function getTblEffectiveYourTicks(yourTicks) {
    return hasTblYourRun(yourTicks) ? yourTicks : TBL_MISSING_FLOOR_TICKS;
  }

  function getTblBestCompletedFloor() {
    const room = getPlayerSnapshot()?.context?.rooms?.[TBL_ROOM_ID];
    if (!room) {
      return null;
    }
    if (room.floor !== undefined && room.floor !== null && Number.isFinite(Number(room.floor))) {
      return Math.min(TBL_MAX_FLOOR, Math.max(TBL_MIN_FLOOR, Number(room.floor)));
    }
    if (room.ticks !== undefined && room.ticks !== null && Number.isFinite(Number(room.ticks))) {
      return 0;
    }
    return -1;
  }

  function getTblMaxUnlockedFloor() {
    const bestCompleted = getTblBestCompletedFloor();
    if (bestCompleted === null) {
      return null;
    }
    if (bestCompleted < 0) {
      return TBL_MIN_FLOOR;
    }
    return Math.min(TBL_MAX_FLOOR, bestCompleted + 1);
  }

  function isTblFloorUnlocked(floor) {
    const maxUnlocked = getTblMaxUnlockedFloor();
    if (maxUnlocked === null) {
      return false;
    }
    return floor <= maxUnlocked;
  }

  function getTblYourTicksForFloor(floor, myEventScores, userScores) {
    if (floor === 0) {
      if (userScores?.bestFloor === 0) {
        return userScores.bestFloorTicks ?? userScores.bestTicks ?? null;
      }
      return userScores?.bestTicks ?? null;
    }
    if (floor === 15) {
      if (userScores?.bestFloor === 15) {
        return userScores.bestFloorTicks ?? null;
      }
      return null;
    }
    return myEventScores[floor] ?? null;
  }

  function getTblYourRankForFloor(floor, myEventRankScores, userScores) {
    if (floor === 0) {
      return userScores?.bestRank ?? null;
    }
    return myEventRankScores[floor] ?? null;
  }

  function getTblYourRankTicksForFloor(floor, myEventRankTicks, userScores) {
    if (floor === 0) {
      return userScores?.bestRankTicks ?? null;
    }
    return myEventRankTicks[floor] ?? null;
  }

  function getTblParticipantHighscoreTicksByFloor() {
    const userScores = getTblUserScoresForMap();
    if (!userScores) {
      return { 0: null, 15: null };
    }
    return {
      0: getTblYourTicksForFloor(0, {}, userScores),
      15: getTblYourTicksForFloor(15, {}, userScores)
    };
  }

  function getTblParticipantHighscoreRanksByFloor() {
    const userScores = getTblUserScoresForMap();
    if (!userScores) {
      return { 0: null };
    }
    return {
      0: getTblYourRankForFloor(0, {}, userScores)
    };
  }

  function getTblParticipantHighscoreRankTicksByFloor() {
    const userScores = getTblUserScoresForMap();
    if (!userScores) {
      return { 0: null };
    }
    return {
      0: getTblYourRankTicksForFloor(0, {}, userScores)
    };
  }

  function buildTblParticipantRecord(existing, name, joinedAt) {
    const highscoreFloorTicks = getTblParticipantHighscoreTicksByFloor();
    const highscoreFloorRanks = getTblParticipantHighscoreRanksByFloor();
    const highscoreFloorRankTicks = getTblParticipantHighscoreRankTicksByFloor();
    return {
      ...(existing || {}),
      name,
      joinedAt: existing?.joinedAt || joinedAt || Date.now(),
      highscoreFloorTicks: {
        0: highscoreFloorTicks[0],
        15: highscoreFloorTicks[15]
      },
      highscoreFloorRanks: {
        0: highscoreFloorRanks[0]
      },
      highscoreFloorRankTicks: {
        0: highscoreFloorRankTicks[0]
      }
    };
  }

  function tblParticipantRecordMatches(existing, name) {
    if (!existing) {
      return false;
    }
    const nextTicks = getTblParticipantHighscoreTicksByFloor();
    const nextRanks = getTblParticipantHighscoreRanksByFloor();
    const nextRankTicks = getTblParticipantHighscoreRankTicksByFloor();
    const prevTicks = existing.highscoreFloorTicks || {};
    const prevRanks = existing.highscoreFloorRanks || {};
    const prevRankTicks = existing.highscoreFloorRankTicks || {};
    const floor0Match = (prevTicks[0] ?? null) === (nextTicks[0] ?? null);
    const floor15Match = (prevTicks[15] ?? null) === (nextTicks[15] ?? null);
    const rank0Match = (prevRanks[0] ?? null) === (nextRanks[0] ?? null);
    const rankTick0Match = (prevRankTicks[0] ?? null) === (nextRankTicks[0] ?? null);
    return floor0Match && floor15Match && rank0Match && rankTick0Match && existing.name === name;
  }

  async function updateTblParticipantHighscoreTicks(force = false) {
    const hash = await getTblPlayerHash();
    const name = getTblPlayerName();
    if (!hash || !name) {
      return;
    }
    const now = Date.now();
    if (
      !force &&
      now - TblFloorLeagueState.lastParticipantSyncAt < TBL_PARTICIPANT_SYNC_MIN_INTERVAL_MS
    ) {
      return;
    }
    const participantPath = `${TBL_PARTICIPANTS_PATH}/${hash}`;
    const existing = await tblFirebaseGetCached(participantPath, {
      ttl: TBL_PARTICIPANTS_CACHE_TTL_MS,
      defaultReturn: null,
      force
    });
    if (tblParticipantRecordMatches(existing, name)) {
      TblFloorLeagueState.lastParticipantSyncAt = now;
      return;
    }
    await TblFirebase.put(
      participantPath,
      buildTblParticipantRecord(existing, name, existing?.joinedAt)
    );
    TblFloorLeagueState.lastParticipantSyncAt = now;
    invalidateTblFetchCache([TBL_PARTICIPANTS_PATH, participantPath]);
  }

  async function loadTblHighscoreFloorLeaders() {
    try {
      // Event competition highscores (floor 0 and 15) should always come from a fresh game API fetch.
      const { tickData, floorData } = await fetchLeaderboardData(TBL_ROOM_ID, true);
      const tickEntry = tickData?.[0] || null;
      const floorEntry = getBestLeaderboardEntry(floorData, { isFloor: true });
      const leaders = {};

      if (tickEntry?.userName && Number.isFinite(Number(tickEntry.ticks))) {
        leaders[0] = {
          name: tickEntry.userName,
          ticks: Number(tickEntry.ticks)
        };
      }

      if (floorEntry?.userName && Number(floorEntry.floor) >= 15) {
        const ticks = getEntryFloorTicks(floorEntry);
        if (Number.isFinite(ticks)) {
          leaders[15] = {
            name: floorEntry.userName,
            ticks
          };
        }
      }

      return leaders;
    } catch (error) {
      console.warn('[Better Highscores][TBL] Failed to load highscore floors:', error);
      return {};
    }
  }

  async function loadTblHighscoreRankLeaders() {
    try {
      const { rankData } = await fetchLeaderboardData(TBL_ROOM_ID, true);
      const rankEntry = getBestLeaderboardEntry(rankData, { isRank: true });
      const leaders = {};

      if (rankEntry?.userName && Number.isFinite(Number(rankEntry.rank))) {
        leaders[0] = {
          name: rankEntry.userName,
          rank: Number(rankEntry.rank),
          ticks: Number.isFinite(Number(rankEntry.ticks)) ? Number(rankEntry.ticks) : null
        };
      }

      return leaders;
    } catch (error) {
      console.warn('[Better Highscores][TBL] Failed to load highscore rank floor:', error);
      return {};
    }
  }

  function buildTblFloorRow(floor, entries, myEventScores, userScores, playerName) {
    const leader = entries[0] || null;
    const yourTicks = getTblYourTicksForFloor(floor, myEventScores, userScores);
    const leaderTicks = leader ? Number(leader.ticks) : null;
    const youLead = Boolean(
      playerName &&
      yourTicks !== null &&
      (
        leaderTicks === null ||
        yourTicks < leaderTicks ||
        (leader?.name === playerName && yourTicks === leaderTicks)
      )
    );
    let gap = null;
    if (yourTicks !== null && leaderTicks !== null && !youLead) {
      gap = yourTicks - leaderTicks;
    }
    return {
      floor,
      ascension: tblFloorToAscensionPercent(floor),
      yourTicks,
      leader,
      leaderTicks,
      entries,
      youLead,
      gap,
      fromHighscores: isTblHighscoreFloor(floor),
      unlocked: isTblFloorUnlocked(floor)
    };
  }

  function parseTblFloorRunFromServerResults(serverResults) {
    if (!serverResults?.rewardScreen) {
      return null;
    }

    const roomId = getTblRoomIdFromServerResults(serverResults);
    if (roomId !== TBL_ROOM_ID) {
      return null;
    }

    if (!serverResults.rewardScreen.victory) {
      return null;
    }

    const floor = Number(serverResults.rewardScreen.floor ?? serverResults.floor);
    const floorTicks = getTblFloorTicksFromServerResults(serverResults);
    if (!Number.isFinite(floor) || !isTblFirebaseFloor(floor) || floorTicks === null) {
      return null;
    }

    return {
      floor,
      floorTicks,
      date: new Date().toISOString().slice(0, 10)
    };
  }

  async function submitTblFloorScoreIfBetter(floor, ticks, date, runMeta = {}) {
    if (!TblFloorLeagueState.joined || !isTblFirebaseFloor(floor)) {
      return false;
    }
    if (!isTblEventCompetitionActive()) {
      return false;
    }
    if (!Number.isFinite(ticks) || ticks <= 0) {
      return false;
    }
    const now = Date.now();
    if (now - TblFloorLeagueState.lastSubmitAt < TBL_SUBMIT_MIN_INTERVAL_MS) {
      return false;
    }
    const hash = await getTblPlayerHash();
    const name = getTblPlayerName();
    if (!hash || !name) {
      return false;
    }
    const scorePath = `${TBL_FIREBASE_BASE}/scores/${floor}/${hash}`;
    const existing = await tblFirebaseGetCached(scorePath, {
      defaultReturn: null,
      force: true
    });
    const previousTicks = existing && Number.isFinite(Number(existing.ticks))
      ? Number(existing.ticks)
      : null;
    if (previousTicks !== null && previousTicks <= ticks) {
      return false;
    }
    const scoreDate = date || new Date().toISOString().slice(0, 10);
    const scorePayload = {
      name,
      ticks,
      date: scoreDate,
      updatedAt: now
    };
    const writes = [TblFirebase.put(scorePath, scorePayload)];
    if (typeof runMeta.replay === 'string' && runMeta.replay.startsWith('$replay(')) {
      writes.push(TblFirebase.put(`${TBL_FIREBASE_BASE}/replays/${floor}/${hash}`, {
        name,
        ticks,
        date: scoreDate,
        updatedAt: now,
        replay: runMeta.replay
      }));
    }
    await Promise.all(writes);
    await updateTblParticipantHighscoreTicks(true);
    invalidateTblFetchCache([TBL_SCORES_PATH, tblScoresPath(floor), scorePath, TBL_PARTICIPANTS_PATH]);
    TblFloorLeagueState.lastSubmitAt = now;
    TblFloorLeagueState.myEventScores[floor] = ticks;
    invalidateTblFloorBarCache();
    console.log(`[Better Highscores][TBL] Submitted floor ${floor}: ${ticks} ticks`);
    refreshTblFloorBarSection(true).catch(() => {});
    return true;
  }

  function buildTblRankRow(floor, entries, myEventRankScores, myEventRankTicks, userScores, playerName) {
    const leader = entries[0] || null;
    const yourRank = getTblYourRankForFloor(floor, myEventRankScores, userScores);
    const yourTicks = getTblYourRankTicksForFloor(floor, myEventRankTicks, userScores);
    const leaderRank = leader && Number.isFinite(Number(leader.rank)) ? Number(leader.rank) : null;
    const leaderTicks = leader && Number.isFinite(Number(leader.ticks)) ? Number(leader.ticks) : null;
    const youLead = Boolean(
      playerName &&
      yourRank !== null &&
      (
        leaderRank === null ||
        yourRank > leaderRank ||
        (
          yourRank === leaderRank &&
          yourTicks !== null &&
          leaderTicks !== null &&
          yourTicks < leaderTicks
        ) ||
        (
          leader?.name === playerName &&
          yourRank === leaderRank &&
          yourTicks === leaderTicks
        )
      )
    );
    let gap = null;
    let gapType = 'rank';
    if (yourRank !== null && leaderRank !== null && !youLead) {
      if (yourRank < leaderRank) {
        gap = leaderRank - yourRank;
        gapType = 'rank';
      } else if (
        yourRank === leaderRank &&
        yourTicks !== null &&
        leaderTicks !== null &&
        yourTicks > leaderTicks
      ) {
        gap = yourTicks - leaderTicks;
        gapType = 'ticks';
      } else if (yourRank === leaderRank) {
        gap = 0;
        gapType = 'rank';
      }
    }
    return {
      floor,
      ascension: tblFloorToAscensionPercent(floor),
      yourRank,
      yourTicks,
      leader,
      leaderRank,
      leaderTicks,
      entries,
      youLead,
      gap,
      gapType,
      fromHighscores: isTblHighscoreRankFloor(floor),
      unlocked: isTblFloorUnlocked(floor)
    };
  }

  function parseTblRankRunFromServerResults(serverResults) {
    if (!serverResults?.rewardScreen) {
      return null;
    }

    const roomId = getTblRoomIdFromServerResults(serverResults);
    if (roomId !== TBL_ROOM_ID) {
      return null;
    }

    if (!serverResults.rewardScreen.victory) {
      return null;
    }

    const floor = Number(serverResults.rewardScreen.floor ?? serverResults.floor);
    const rank = getTblRankFromServerResults(serverResults);
    const ticks = getTblFloorTicksFromServerResults(serverResults);
    if (!Number.isFinite(floor) || !isTblFirebaseRankFloor(floor) || rank === null) {
      return null;
    }

    return {
      floor,
      rank,
      ticks,
      date: new Date().toISOString().slice(0, 10)
    };
  }

  async function submitTblRankScoreIfBetter(floor, rank, ticks, date, runMeta = {}) {
    if (!TblFloorLeagueState.joined || !isTblFirebaseRankFloor(floor)) {
      return false;
    }
    if (!isTblEventCompetitionActive()) {
      return false;
    }
    if (!Number.isFinite(rank) || rank <= 0) {
      return false;
    }
    const now = Date.now();
    if (now - TblFloorLeagueState.lastRankSubmitAt < TBL_SUBMIT_MIN_INTERVAL_MS) {
      return false;
    }
    const hash = await getTblPlayerHash();
    const name = getTblPlayerName();
    if (!hash || !name) {
      return false;
    }
    const scorePath = `${TBL_RANK_SCORES_PATH}/${floor}/${hash}`;
    const existing = await tblFirebaseGetCached(scorePath, {
      defaultReturn: null,
      force: true
    });
    if (!isTblRankScoreBetter(rank, ticks, existing)) {
      return false;
    }
    const scoreDate = date || new Date().toISOString().slice(0, 10);
    const scorePayload = {
      name,
      rank,
      ticks: Number.isFinite(ticks) ? ticks : null,
      date: scoreDate,
      updatedAt: now
    };
    const writes = [TblFirebase.put(scorePath, scorePayload)];
    if (typeof runMeta.replay === 'string' && runMeta.replay.startsWith('$replay(')) {
      writes.push(TblFirebase.put(`${TBL_FIREBASE_BASE}/rank-replays/${floor}/${hash}`, {
        name,
        rank,
        ticks: scorePayload.ticks,
        date: scoreDate,
        updatedAt: now,
        replay: runMeta.replay
      }));
    }
    await Promise.all(writes);
    await updateTblParticipantHighscoreTicks(true);
    invalidateTblFetchCache([TBL_RANK_SCORES_PATH, tblRankScoresPath(floor), scorePath, TBL_PARTICIPANTS_PATH]);
    TblFloorLeagueState.lastRankSubmitAt = now;
    TblFloorLeagueState.myEventRankScores[floor] = rank;
    if (Number.isFinite(ticks)) {
      TblFloorLeagueState.myEventRankTicks[floor] = ticks;
    }
    invalidateTblFloorBarCache();
    console.log(`[Better Highscores][TBL] Submitted rank floor ${floor}: ${rank} points`);
    return true;
  }

  async function handleTblServerResults(serverResults, seed) {
    if (!TblFloorLeagueState.joined || isSandboxMode()) {
      return false;
    }

    if (seed === TblFloorLeagueState.lastProcessedSeed) {
      return false;
    }

    const floorRun = parseTblFloorRunFromServerResults(serverResults);
    const rankRun = parseTblRankRunFromServerResults(serverResults);
    if (!floorRun && !rankRun) {
      return false;
    }

    TblFloorLeagueState.lastProcessedSeed = seed;
    const setup = getTblSetupForSubmission();
    const replayFloor = floorRun?.floor ?? rankRun?.floor;
    const replay = await buildTblReplayStringWithRetry(serverResults, replayFloor, setup);
    if (!replay) {
      console.warn('[Better Highscores][TBL] Could not build $replay for submitted run');
    }

    let submitted = false;
    if (floorRun) {
      const floorSubmitted = await submitTblFloorScoreIfBetter(
        floorRun.floor,
        floorRun.floorTicks,
        floorRun.date,
        { replay }
      );
      if (floorSubmitted) {
        showTblEventToast(
          t('mods.betterUI.tblLeagueScoreSubmitted', { floor: floorRun.floor, ticks: floorRun.floorTicks })
        );
        submitted = true;
      }
    }
    if (rankRun) {
      const rankSubmitted = await submitTblRankScoreIfBetter(
        rankRun.floor,
        rankRun.rank,
        rankRun.ticks,
        rankRun.date,
        { replay }
      );
      if (rankSubmitted) {
        showTblEventToast(
          t('mods.betterUI.tblLeagueRankScoreSubmitted', { floor: rankRun.floor, points: rankRun.rank })
        );
        submitted = true;
      }
    }
    if (submitted) {
      refreshTblFloorBarSection(true).catch(() => {});
    }
    return submitted;
  }

  function getTblServerResultsFromBoard() {
    return globalThis.state?.board?.getSnapshot?.()?.context?.serverResults || null;
  }

  async function trySubmitTblAfterBattle(maxAttempts = 6) {
    if (!TblFloorLeagueState.joined || !isTblMapActive() || isSandboxMode()) {
      return;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => scheduleTimeout(resolve, attempt * 250));
      }

      const serverResults = getTblServerResultsFromBoard();
      if (!serverResults?.rewardScreen || typeof serverResults.seed === 'undefined') {
        continue;
      }

      const submitted = await handleTblServerResults(serverResults, serverResults.seed);
      if (submitted || serverResults.seed === TblFloorLeagueState.lastProcessedSeed) {
        return;
      }
    }
  }

  async function processTblNetworkServerResults(responseData) {
    if (modDisposed || !TblFloorLeagueState.joined || isSandboxMode()) {
      return;
    }

    let data = responseData;
    if (Array.isArray(responseData) && responseData[0]?.result?.data) {
      data = responseData[0].result.data.json ?? responseData[0].result.data;
    }

    if (!data?.rewardScreen || typeof data.seed === 'undefined') {
      return;
    }

    await handleTblServerResults(data, data.seed);
  }

  function setupTblNetworkListener() {
    if (TblFloorLeagueState.fetchRestore) {
      return;
    }

    const previousFetch = window.fetch.bind(window);
    TblFloorLeagueState.fetchRestore = previousFetch;

    window.fetch = async function tblFloorLeagueFetch(...args) {
      const response = await previousFetch(...args);
      if (modDisposed) {
        return response;
      }
      const url = args[0];
      if (typeof url === 'string' && (url.includes('gameServer?batch=1') || url.includes('game.gameServer?batch=1'))) {
        try {
          const cloned = response.clone();
          const responseData = await cloned.json();
          processTblNetworkServerResults(responseData).catch((err) => {
            console.warn('[Better Highscores][TBL] Network results handling failed:', err);
          });
        } catch (error) {
          // Ignore parse errors on unrelated responses
        }
      }
      return response;
    };
  }

  function sanitizeTblLeaderboardEntry(entry) {
    if (!entry || !Number.isFinite(Number(entry.ticks))) {
      return null;
    }
    return {
      name: entry.name,
      ticks: Number(entry.ticks),
      date: entry.date,
      updatedAt: entry.updatedAt
    };
  }

  function parseTblFirebaseScoresBundle(allScores, playerHash) {
    const rawEntriesByFloor = new Map();
    const myScores = {};

    for (let floor = TBL_FIREBASE_FLOOR_MIN; floor <= TBL_FIREBASE_FLOOR_MAX; floor++) {
      const entries = [];
      const floorData = allScores?.[floor];
      if (floorData && typeof floorData === 'object') {
        Object.entries(floorData).forEach(([entryHash, entry]) => {
          const sanitized = sanitizeTblLeaderboardEntry(entry);
          if (!sanitized) {
            return;
          }
          entries.push(sanitized);
          if (playerHash && entryHash === playerHash) {
            myScores[floor] = sanitized.ticks;
          }
        });
      }
      rawEntriesByFloor.set(floor, entries);
    }

    return { rawEntriesByFloor, myScores };
  }

  async function loadTblAllFirebaseScores(force = false) {
    const allScores = await tblFirebaseGetCached(TBL_SCORES_PATH, {
      defaultReturn: {},
      force
    });
    return allScores && typeof allScores === 'object' ? allScores : {};
  }

  function sanitizeTblRankLeaderboardEntry(entry) {
    if (!entry || !Number.isFinite(Number(entry.rank))) {
      return null;
    }
    const rank = Number(entry.rank);
    if (rank <= 0) {
      return null;
    }
    return {
      name: entry.name,
      rank,
      ticks: Number.isFinite(Number(entry.ticks)) ? Number(entry.ticks) : null,
      date: entry.date,
      updatedAt: entry.updatedAt
    };
  }

  function parseTblFirebaseRankScoresBundle(allScores, playerHash) {
    const rawEntriesByFloor = new Map();
    const myScores = {};
    const myTicks = {};

    for (let floor = 1; floor <= TBL_MAX_FLOOR; floor++) {
      const entries = [];
      const floorData = allScores?.[floor];
      if (floorData && typeof floorData === 'object') {
        Object.entries(floorData).forEach(([entryHash, entry]) => {
          const sanitized = sanitizeTblRankLeaderboardEntry(entry);
          if (!sanitized) {
            return;
          }
          entries.push(sanitized);
          if (playerHash && entryHash === playerHash) {
            myScores[floor] = sanitized.rank;
            if (sanitized.ticks !== null) {
              myTicks[floor] = sanitized.ticks;
            }
          }
        });
      }
      rawEntriesByFloor.set(floor, entries);
    }

    return { rawEntriesByFloor, myScores, myTicks };
  }

  async function loadTblAllFirebaseRankScores(force = false) {
    const allScores = await tblFirebaseGetCached(TBL_RANK_SCORES_PATH, {
      defaultReturn: {},
      force
    });
    return allScores && typeof allScores === 'object' ? allScores : {};
  }

  function buildTblPlayerTotalRanks(
    entriesByFloor,
    participantHighscoreRanksByName = new Map(),
    highscoreRankLeaders = {}
  ) {
    const players = new Set();
    const floorRanksByPlayer = new Map();

    const ensurePlayer = (name) => {
      if (!name) {
        return null;
      }
      players.add(name);
      if (!floorRanksByPlayer.has(name)) {
        floorRanksByPlayer.set(name, new Map());
      }
      return floorRanksByPlayer.get(name);
    };

    const setFloorRank = (name, floor, rank) => {
      if (!name || !Number.isFinite(rank)) {
        return;
      }
      const floors = ensurePlayer(name);
      if (!floors) {
        return;
      }
      const existing = floors.get(floor);
      if (existing === undefined || rank > existing) {
        floors.set(floor, rank);
      }
    };

    participantHighscoreRanksByName.forEach((_, name) => {
      ensurePlayer(name);
    });

    for (let floor = 1; floor <= TBL_MAX_FLOOR; floor++) {
      (entriesByFloor.get(floor) || []).forEach((entry) => {
        setFloorRank(entry.name, floor, Number(entry.rank));
      });
    }

    participantHighscoreRanksByName.forEach((highscores, name) => {
      if (Number.isFinite(highscores[0])) {
        setFloorRank(name, 0, highscores[0]);
      }
    });

    const floor0Leader = highscoreRankLeaders[0];
    if (floor0Leader?.name && Number.isFinite(Number(floor0Leader.rank))) {
      setFloorRank(floor0Leader.name, 0, Number(floor0Leader.rank));
    }

    const totals = new Map();
    players.forEach((name) => {
      const floors = floorRanksByPlayer.get(name) || new Map();
      let total = 0;
      for (let floor = TBL_MIN_FLOOR; floor <= TBL_MAX_FLOOR; floor++) {
        const rank = floors.get(floor);
        total += Number.isFinite(rank) ? rank : 0;
      }
      totals.set(name, total);
    });

    return totals;
  }

  function buildTblPlayerTotalRankTicks(
    entriesByFloor,
    participantHighscoreRankTicksByName = new Map(),
    highscoreRankLeaders = {}
  ) {
    const players = new Set();
    const floorRankTicksByPlayer = new Map();

    const ensurePlayer = (name) => {
      if (!name) {
        return null;
      }
      players.add(name);
      if (!floorRankTicksByPlayer.has(name)) {
        floorRankTicksByPlayer.set(name, new Map());
      }
      return floorRankTicksByPlayer.get(name);
    };

    const setFloorRankTicks = (name, floor, ticks) => {
      if (!name || !Number.isFinite(ticks)) {
        return;
      }
      const floors = ensurePlayer(name);
      if (!floors) {
        return;
      }
      const existing = floors.get(floor);
      if (existing === undefined || ticks < existing) {
        floors.set(floor, ticks);
      }
    };

    participantHighscoreRankTicksByName.forEach((_, name) => {
      ensurePlayer(name);
    });

    for (let floor = 1; floor <= TBL_MAX_FLOOR; floor++) {
      (entriesByFloor.get(floor) || []).forEach((entry) => {
        if (Number.isFinite(Number(entry.ticks))) {
          setFloorRankTicks(entry.name, floor, Number(entry.ticks));
        }
      });
    }

    participantHighscoreRankTicksByName.forEach((highscoreRankTicks, name) => {
      if (Number.isFinite(highscoreRankTicks[0])) {
        setFloorRankTicks(name, 0, highscoreRankTicks[0]);
      }
    });

    const floor0Leader = highscoreRankLeaders[0];
    if (floor0Leader?.name && Number.isFinite(Number(floor0Leader.ticks))) {
      setFloorRankTicks(floor0Leader.name, 0, Number(floor0Leader.ticks));
    }

    const totals = new Map();
    players.forEach((name) => {
      const floors = floorRankTicksByPlayer.get(name) || new Map();
      let total = 0;
      for (let floor = TBL_MIN_FLOOR; floor <= TBL_MAX_FLOOR; floor++) {
        const ticks = floors.get(floor);
        total += Number.isFinite(ticks) ? ticks : TBL_MISSING_FLOOR_TICKS;
      }
      totals.set(name, total);
    });

    return totals;
  }

  function compareTblRankLeaderboardEntries(a, b, playerTotalRankTicks) {
    if (a.rank !== b.rank) {
      return b.rank - a.rank;
    }
    const ticksA = Number.isFinite(a.ticks) ? a.ticks : Number.POSITIVE_INFINITY;
    const ticksB = Number.isFinite(b.ticks) ? b.ticks : Number.POSITIVE_INFINITY;
    if (ticksA !== ticksB) {
      return ticksA - ticksB;
    }
    const totalA = playerTotalRankTicks.get(a.name)
      ?? ((TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS);
    const totalB = playerTotalRankTicks.get(b.name)
      ?? ((TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS);
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    return String(a.name).localeCompare(String(b.name));
  }

  function rankTblRankLeaderboardEntries(entries, playerTotalRankTicks) {
    return [...entries]
      .sort((a, b) => compareTblRankLeaderboardEntries(a, b, playerTotalRankTicks))
      .slice(0, TBL_LEADERBOARD_TOP);
  }

  function buildTblPlayerTotalTicks(
    entriesByFloor,
    participantHighscoresByName = new Map(),
    highscoreFloorLeaders = {}
  ) {
    const players = new Set();
    const floorTicksByPlayer = new Map();

    const ensurePlayer = (name) => {
      if (!name) {
        return null;
      }
      players.add(name);
      if (!floorTicksByPlayer.has(name)) {
        floorTicksByPlayer.set(name, new Map());
      }
      return floorTicksByPlayer.get(name);
    };

    const setFloorTick = (name, floor, ticks) => {
      if (!name || !Number.isFinite(ticks)) {
        return;
      }
      const floors = ensurePlayer(name);
      if (!floors) {
        return;
      }
      const existing = floors.get(floor);
      if (existing === undefined || ticks < existing) {
        floors.set(floor, ticks);
      }
    };

    participantHighscoresByName.forEach((_, name) => {
      ensurePlayer(name);
    });

    for (let floor = TBL_FIREBASE_FLOOR_MIN; floor <= TBL_FIREBASE_FLOOR_MAX; floor++) {
      (entriesByFloor.get(floor) || []).forEach((entry) => {
        setFloorTick(entry.name, floor, Number(entry.ticks));
      });
    }

    participantHighscoresByName.forEach((highscores, name) => {
      if (Number.isFinite(highscores[0])) {
        setFloorTick(name, 0, highscores[0]);
      }
      if (Number.isFinite(highscores[15])) {
        setFloorTick(name, 15, highscores[15]);
      }
    });

    [0, 15].forEach((floor) => {
      const leader = highscoreFloorLeaders[floor];
      if (leader?.name && Number.isFinite(Number(leader.ticks))) {
        setFloorTick(leader.name, floor, Number(leader.ticks));
      }
    });

    const totals = new Map();
    players.forEach((name) => {
      const floors = floorTicksByPlayer.get(name) || new Map();
      let total = 0;
      for (let floor = TBL_MIN_FLOOR; floor <= TBL_MAX_FLOOR; floor++) {
        const ticks = floors.get(floor);
        total += Number.isFinite(ticks) ? ticks : TBL_MISSING_FLOOR_TICKS;
      }
      totals.set(name, total);
    });

    return totals;
  }

  function compareTblLeaderboardEntries(a, b, playerTotalTicks) {
    if (a.ticks !== b.ticks) {
      return a.ticks - b.ticks;
    }
    const totalA = playerTotalTicks.get(a.name)
      ?? ((TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS);
    const totalB = playerTotalTicks.get(b.name)
      ?? ((TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS);
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    return String(a.name).localeCompare(String(b.name));
  }

  function rankTblLeaderboardEntries(entries, playerTotalTicks) {
    return [...entries]
      .sort((a, b) => compareTblLeaderboardEntries(a, b, playerTotalTicks))
      .slice(0, TBL_LEADERBOARD_TOP);
  }

  function getTblApi() {
    return typeof context !== 'undefined' ? context.api : null;
  }

  function escapeTblHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tblFloorToAscensionPercent(floor) {
    if (!Number.isFinite(Number(floor))) {
      return null;
    }
    return 100 + Number(floor) * 20;
  }

  function getTblFloorScaleColor(floor) {
    const index = Math.min(TBL_MAX_FLOOR, Math.max(TBL_MIN_FLOOR, Math.round(Number(floor) || 0)));
    return TBL_FLOOR_SCALE_COLORS[index] || TBL_FLOOR_SCALE_COLORS[0];
  }

  function buildTblFloorScaleTextStyle(floor) {
    const color = getTblFloorScaleColor(floor);
    return {
      color,
      textShadow: floor >= 11
        ? `0 0 3px ${color}80, 0 1px 2px #000`
        : '0 1px 2px #000'
    };
  }

  function formatTblFloorRowTitleHtml(floor, ascension) {
    const text = t('mods.betterUI.tblLeagueFloorRowTitle', { floor, ascension });
    const style = buildTblFloorScaleTextStyle(floor);
    return `<span style="color:${style.color};text-shadow:${style.textShadow};">${escapeTblHtml(text)}</span>`;
  }

  function formatTblProfileLink(playerName) {
    const safeName = escapeTblHtml(playerName || 'Unknown');
    const profileUrl = `https://bestiaryarena.com/profile/${encodeURIComponent(String(playerName || '').trim())}`;
    return `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="color:#ff8;text-decoration:underline;cursor:pointer;">${safeName}</a>`;
  }

  function formatTblTicksComparison(yourTicks, leaderTicks, leaderName, youLead = false) {
    const hasRun = hasTblYourRun(yourTicks);
    const displayTicks = getTblEffectiveYourTicks(yourTicks);
    const youPart = hasRun
      ? `<span>${displayTicks} ticks</span>`
      : `<span style="color:#888;">${displayTicks} ticks</span>`;
    if (youLead) {
      return youPart;
    }
    if (leaderTicks === null || leaderTicks === undefined) {
      return `${youPart} <span style="color:#888;">${escapeTblHtml(t('mods.betterUI.tblLeagueNoLeaderYet'))}</span>`;
    }
    return `${youPart} → <span>${leaderTicks} ticks</span> (${formatTblProfileLink(leaderName)})`;
  }

  function formatTblRankComparison(yourRank, yourTicks, leaderRank, leaderTicks, leaderName, youLead = false) {
    const hasRun = yourRank !== null && yourRank !== undefined;
    const tickSuffix = hasRun && yourTicks !== null && yourTicks !== undefined ? ` (${yourTicks} ticks)` : '';
    const youPart = hasRun
      ? `<span>${yourRank} points${tickSuffix}</span>`
      : `<span style="color:#888;">0 points</span>`;
    if (youLead) {
      return youPart;
    }
    if (leaderRank === null || leaderRank === undefined) {
      return `${youPart} <span style="color:#888;">${escapeTblHtml(t('mods.betterUI.tblLeagueNoLeaderYet'))}</span>`;
    }
    const leaderTickSuffix = leaderTicks !== null && leaderTicks !== undefined ? ` (${leaderTicks} ticks)` : '';
    return `${youPart} → <span>${leaderRank} points${leaderTickSuffix}</span> (${formatTblProfileLink(leaderName)})`;
  }

  function ensureTblLeagueStyles() {
    if (document.getElementById(TBL_STYLES_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = TBL_STYLES_ID;
    style.textContent = `
      .tbl-league-item--empty {
        opacity: 0.55;
      }
      .tbl-league-item--locked {
        opacity: 0.5;
        filter: grayscale(0.8);
        position: relative;
        cursor: not-allowed;
      }
      .tbl-league-item--locked::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
        background-size: 6px 6px;
        z-index: 2;
      }
      .tbl-league-item--clickable {
        cursor: pointer;
      }
      .tbl-league-item--clickable:hover {
        filter: brightness(1.08);
      }
      .tbl-league-floor-thumb {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
      }
      .tbl-league-floor-thumb-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .tbl-league-floor-thumb-overlay {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.42);
      }
      .tbl-league-modal-content {
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .tbl-league-summary-grid {
        display: grid;
        grid-template-columns: minmax(0, 35%) auto minmax(0, 60%);
        gap: 8px;
        align-items: center;
      }
      .tbl-league-summary-col {
        min-width: 0;
        overflow: hidden;
      }
      .tbl-league-standings-col {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 0;
        overflow: hidden;
      }
      .tbl-league-top-players {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        margin: 0 auto;
      }
      .tbl-league-top-players-title {
        color: #ccc;
        text-align: center;
        margin-bottom: 4px;
        font-size: 14px;
      }
      .tbl-league-summary-separator {
        width: 1px;
        align-self: stretch;
        background: rgba(255, 255, 255, 0.2);
      }
      .tbl-league-top-grid {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 13px;
      }
      .tbl-league-top-grid th,
      .tbl-league-top-grid td {
        border: 1px solid rgba(255, 255, 255, 0.22);
        padding: 3px 5px;
        text-align: center;
        vertical-align: middle;
        min-width: 0;
      }
      .tbl-league-top-grid-corner,
      .tbl-league-top-grid-label {
        color: #999;
        background: rgba(0, 0, 0, 0.28);
        text-align: left;
        white-space: nowrap;
        width: 58px;
      }
      .tbl-league-top-grid-header {
        color: #ccc;
        background: rgba(0, 0, 0, 0.28);
        font-weight: normal;
      }
      .tbl-league-top-grid-medal-header {
        padding: 4px 2px;
      }
      .tbl-league-top-grid-medal {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        line-height: 1;
      }
      .tbl-league-top-grid-medal-icon {
        display: block;
        filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.65));
      }
      .tbl-league-top-grid-cell {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .tbl-league-top-grid-name a {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      .tbl-league-top-grid-you-cell {
        color: #8f8;
      }
      .tbl-league-top-grid-footer td,
      .tbl-league-top-grid-footer th {
        color: #8f8;
        background: rgba(0, 0, 0, 0.18);
      }
      .tbl-league-top-grid-footer .tbl-league-top-grid-cell {
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tbl-league-top-grid-footer a {
        display: inline-block;
        max-width: 38%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: bottom;
      }
      .tbl-league-list-panel {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  function getTblModalDialog(modalRef) {
    if (modalRef?.element) {
      return modalRef.element;
    }
    if (modalRef instanceof HTMLElement) {
      return modalRef;
    }
    return document.getElementById(TBL_MODAL_ID)
      || document.querySelector('div[role="dialog"][data-state="open"]');
  }

  function getTblModalDimensions() {
    const pad = TBL_MODAL_VIEWPORT_PADDING * 2;
    return {
      width: Math.max(TBL_MODAL_MIN_WIDTH, Math.min(TBL_MODAL_WIDTH, window.innerWidth - pad)),
      height: Math.max(TBL_MODAL_MIN_HEIGHT, Math.min(TBL_MODAL_HEIGHT, window.innerHeight - pad))
    };
  }

  function clearTblModalLayoutCleanup() {
    if (TblFloorLeagueState.layoutCleanup) {
      TblFloorLeagueState.layoutCleanup();
      TblFloorLeagueState.layoutCleanup = null;
    }
  }

  function applyTblModalLayout(modalRef, contentRoot) {
    const dialog = getTblModalDialog(modalRef);
    if (!dialog) {
      return;
    }

    const { width, height } = getTblModalDimensions();
    dialog.id = TBL_MODAL_ID;
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
        maxHeight: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      });
    }
  }

  function setupTblModalResponsiveLayout(modalRef, contentRoot) {
    clearTblModalLayoutCleanup();
    const apply = () => applyTblModalLayout(modalRef, contentRoot);
    apply();
    requestAnimationFrame(() => apply());
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    TblFloorLeagueState.layoutCleanup = () => {
      window.removeEventListener('resize', onResize);
    };
  }

  function createTblScrollContainer() {
    const api = getTblApi();
    if (api?.ui?.components?.createScrollContainer) {
      const scrollContainer = api.ui.components.createScrollContainer({
        height: '100%',
        padding: true,
        content: ''
      });
      Object.assign(scrollContainer.element.style, {
        flex: '1 1 0',
        minHeight: '0',
        height: 'auto',
        overflow: 'hidden'
      });
      scrollContainer.contentContainer.classList.add('highscores-list');
      return scrollContainer;
    }

    const fallback = document.createElement('div');
    fallback.className = 'highscores-list';
    Object.assign(fallback.style, {
      flex: '1 1 0',
      minHeight: '0',
      overflowY: 'auto',
      padding: '4px'
    });
    return {
      element: fallback,
      contentContainer: fallback,
      addContent(node) {
        fallback.appendChild(node);
      }
    };
  }

  function createTblStatsPanel(html) {
    const statsContainer = document.createElement('div');
    statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
    statsContainer.style.flexShrink = '0';
    statsContainer.innerHTML = html;
    return statsContainer;
  }

  function sortTblOverallStandings(standings, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    if (competitionMode === TBL_COMPETITION_TAB.RANK) {
      const playerTotalRanks = TblFloorLeagueState.playerTotalRanks || new Map();
      const playerTotalRankTicks = TblFloorLeagueState.playerTotalRankTicks || new Map();
      const missingRankTicks = (TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS;
      return [...standings].sort((a, b) => {
        const totalA = playerTotalRanks.get(a.name) ?? 0;
        const totalB = playerTotalRanks.get(b.name) ?? 0;
        if (totalB !== totalA) {
          return totalB - totalA;
        }
        const rankTicksA = playerTotalRankTicks.get(a.name) ?? missingRankTicks;
        const rankTicksB = playerTotalRankTicks.get(b.name) ?? missingRankTicks;
        if (rankTicksA !== rankTicksB) {
          return rankTicksA - rankTicksB;
        }
        if (b.floorsLed !== a.floorsLed) {
          return b.floorsLed - a.floorsLed;
        }
        return String(a.name).localeCompare(String(b.name));
      });
    }

    const playerTotalTicks = TblFloorLeagueState.playerTotalTicks || new Map();
    const missingTotal = (TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS;

    return [...standings].sort((a, b) => {
      const totalA = playerTotalTicks.get(a.name) ?? missingTotal;
      const totalB = playerTotalTicks.get(b.name) ?? missingTotal;
      if (totalA !== totalB) {
        return totalA - totalB;
      }
      if (b.floorsLed !== a.floorsLed) {
        return b.floorsLed - a.floorsLed;
      }
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function buildTblOverallStandings(rows, ensurePlayerName = null, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    const standings = new Map();
    const playerTotals = competitionMode === TBL_COMPETITION_TAB.RANK
      ? (TblFloorLeagueState.playerTotalRanks || new Map())
      : (TblFloorLeagueState.playerTotalTicks || new Map());

    playerTotals.forEach((_, name) => {
      if (!name) {
        return;
      }
      standings.set(name, {
        name,
        floorsLed: 0
      });
    });

    rows.forEach((row) => {
      const leaderName = row.leader?.name;
      if (!leaderName) {
        return;
      }

      const existing = standings.get(leaderName) || {
        name: leaderName,
        floorsLed: 0
      };
      existing.floorsLed += 1;
      standings.set(leaderName, existing);
    });

    if (ensurePlayerName && !standings.has(ensurePlayerName)) {
      standings.set(ensurePlayerName, {
        name: ensurePlayerName,
        floorsLed: 0
      });
    }

    return sortTblOverallStandings(Array.from(standings.values()), competitionMode);
  }

  function getTblOverallLeaderName(rows, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    const standings = buildTblOverallStandings(rows, null, competitionMode);
    return standings[0]?.name || null;
  }

  function buildTblLeagueCurrentLeaderRowHtml(rows, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    const leaderName = getTblOverallLeaderName(rows, competitionMode);
    const viewerName = getTblPlayerName();
    let nameHtml;
    if (!leaderName) {
      nameHtml = `<span style="color:#888;">${escapeTblHtml(t('mods.betterUI.tblLeagueNoCurrentLeader'))}</span>`;
    } else if (viewerName && leaderName === viewerName) {
      nameHtml = `<span style="color:#8f8;">${escapeTblHtml(leaderName)}</span>`;
    } else {
      nameHtml = formatTblProfileLink(leaderName);
    }
    return `${escapeTblHtml(t('mods.betterUI.tblLeagueCurrentLeaderLabel'))} ${nameHtml}`;
  }

  function getTblPlayerTotalTicks(playerName) {
    return (TblFloorLeagueState.playerTotalTicks || new Map()).get(playerName)
      ?? (TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS;
  }

  function getTblPlayerTotalRankPoints(playerName) {
    return (TblFloorLeagueState.playerTotalRanks || new Map()).get(playerName) ?? 0;
  }

  function getTblPlayerTotalRankTicks(playerName) {
    return (TblFloorLeagueState.playerTotalRankTicks || new Map()).get(playerName)
      ?? (TBL_MAX_FLOOR - TBL_MIN_FLOOR + 1) * TBL_MISSING_FLOOR_TICKS;
  }

  function formatTblTopGridNameCell(player, viewerName) {
    if (!player?.name) {
      return '<td class="tbl-league-top-grid-cell">—</td>';
    }
    const isYou = Boolean(viewerName && player.name === viewerName);
    const nameHtml = isYou
      ? escapeTblHtml(player.name)
      : formatTblProfileLink(player.name);
    const nameTitle = escapeTblHtml(player.name);
    const youClass = isYou ? ' tbl-league-top-grid-you-cell' : '';
    return `<td class="tbl-league-top-grid-cell tbl-league-top-grid-name${youClass}" title="${nameTitle}">${nameHtml}</td>`;
  }

  function formatTblTopGridValueCell(value, viewerName, playerName, { isYou: forceYou = false } = {}) {
    const isYou = forceYou || Boolean(viewerName && playerName && viewerName === playerName);
    const youClass = isYou ? ' tbl-league-top-grid-you-cell' : '';
    const display = value === null || value === undefined ? '—' : escapeTblHtml(String(value));
    return `<td class="tbl-league-top-grid-cell${youClass}">${display}</td>`;
  }

  function formatTblTopGridMedalHeader(position) {
    const rank = Math.min(3, Math.max(1, Number(position) || 1));
    const medalColor = getMedalColor(rank);
    const label = `#${rank}`;
    return `<th class="tbl-league-top-grid-header tbl-league-top-grid-medal-header" title="${label}" aria-label="${label}">
      <span class="tbl-league-top-grid-medal" style="color:${medalColor};">
        <svg class="tbl-league-top-grid-medal-icon" viewBox="0 0 20 24" width="16" height="19" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M5.5 1.5 7.8 9.2 10 2.2 12.2 9.2 14.5 1.5H5.5z"/>
          <circle cx="10" cy="15.5" r="7" fill="currentColor"/>
          <circle cx="10" cy="15.5" r="5.6" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
          <text x="10" y="17.1" text-anchor="middle" fill="rgba(0,0,0,0.55)" font-size="7" font-weight="bold" font-family="monospace">${rank}</text>
        </svg>
      </span>
    </th>`;
  }

  function buildTblLeagueTopPlayersGridHtml(topThree, competitionMode, viewerName, yourRow = null) {
    const slots = [0, 1, 2].map((index) => topThree[index] || null);
    const isRank = competitionMode === TBL_COMPETITION_TAB.RANK;

    let html = '<table class="tbl-league-top-grid"><thead><tr>';
    html += `<th class="tbl-league-top-grid-corner"></th>`;
    slots.forEach((entry, index) => {
      const position = entry?.rank ?? (index + 1);
      html += formatTblTopGridMedalHeader(position);
    });
    html += '</tr></thead><tbody>';

    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(t('mods.betterUI.tblLeagueGridName'))}</th>`;
    slots.forEach((entry) => {
      html += entry
        ? formatTblTopGridNameCell(entry.player, viewerName)
        : '<td class="tbl-league-top-grid-cell">—</td>';
    });
    html += '</tr>';

    if (isRank) {
      html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(t('mods.betterUI.tblLeagueGridPoints'))}</th>`;
      slots.forEach((entry) => {
        html += entry
          ? formatTblTopGridValueCell(
            getTblPlayerTotalRankPoints(entry.player.name),
            viewerName,
            entry.player.name
          )
          : '<td class="tbl-league-top-grid-cell">—</td>';
      });
      html += '</tr>';
    }

    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(t('mods.betterUI.tblLeagueGridTicks'))}</th>`;
    slots.forEach((entry) => {
      if (!entry) {
        html += '<td class="tbl-league-top-grid-cell">—</td>';
        return;
      }
      const ticks = isRank
        ? getTblPlayerTotalRankTicks(entry.player.name)
        : getTblPlayerTotalTicks(entry.player.name);
      html += formatTblTopGridValueCell(ticks, viewerName, entry.player.name);
    });
    html += '</tr>';

    if (!isRank) {
      html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(t('mods.betterUI.tblLeagueGridRecords'))}</th>`;
      slots.forEach((entry) => {
        html += entry
          ? formatTblTopGridValueCell(entry.player.floorsLed, viewerName, entry.player.name)
          : '<td class="tbl-league-top-grid-cell">—</td>';
      });
      html += '</tr>';
    }

    if (yourRow?.player) {
      html += formatTblOverallStandingGridFooterRow(
        yourRow.player,
        yourRow.rank,
        viewerName,
        competitionMode
      );
    }

    html += '</tbody></table>';
    return html;
  }

  function formatTblOverallStandingGridFooterRow(player, rank, viewerName, competitionMode) {
    const isYou = Boolean(viewerName && player.name === viewerName);
    const nameHtml = isYou
      ? escapeTblHtml(player.name)
      : formatTblProfileLink(player.name);
    const standingLabel = escapeTblHtml(formatTblOverallStandingStats(player, competitionMode));
    const nameTitle = escapeTblHtml(player.name);
    const rankLabel = rank ? `#${rank}` : '—';
    return `<tr class="tbl-league-top-grid-footer">
      <th class="tbl-league-top-grid-label">${rankLabel}</th>
      <td class="tbl-league-top-grid-cell" colspan="3" title="${nameTitle}">${nameHtml} — ${standingLabel}</td>
    </tr>`;
  }

  function formatTblOverallStandingStats(player, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    return competitionMode === TBL_COMPETITION_TAB.RANK
      ? t('mods.betterUI.tblLeaguePlayerStandingRank', {
        points: getTblPlayerTotalRankPoints(player.name),
        ticks: getTblPlayerTotalRankTicks(player.name)
      })
      : t('mods.betterUI.tblLeaguePlayerStanding', {
        count: player.floorsLed,
        ticks: getTblPlayerTotalTicks(player.name)
      });
  }

  function computeTblOverallTopPlayers(floorRows, limit = 3) {
    return buildTblOverallStandings(floorRows).slice(0, limit);
  }

  async function loadTblAllFloorData(force = false) {
    if (modDisposed) {
      return TblFloorLeagueState.floorBarRows || [];
    }

    const now = Date.now();
    if (
      !force &&
      TblFloorLeagueState.floorBarRows &&
      now - TblFloorLeagueState.floorBarCacheAt < TBL_FETCH_CACHE_TTL_MS
    ) {
      return TblFloorLeagueState.floorBarRows;
    }
    if (
      !force &&
      TblFloorLeagueState.floorBarRows &&
      now - TblFloorLeagueState.lastFullLoadAt < TBL_FETCH_MIN_INTERVAL_MS
    ) {
      return TblFloorLeagueState.floorBarRows;
    }
    if (TblFloorLeagueState.fullLoadInFlight) {
      return TblFloorLeagueState.fullLoadInFlight;
    }

    TblFloorLeagueState.fullLoadInFlight = (async () => {
      try {
        if (modDisposed) {
          return TblFloorLeagueState.floorBarRows || [];
        }

        const userScores = getTblUserScoresForMap();
        const playerName = getTblPlayerName();
        const playerHash = await getTblPlayerHash();
        if (TblFloorLeagueState.joined) {
          await updateTblParticipantHighscoreTicks(force);
        }

        const allScores = await loadTblAllFirebaseScores(force);
        const { rawEntriesByFloor, myScores: loadedMyScores } = parseTblFirebaseScoresBundle(
          allScores,
          playerHash
        );
        const myScores = { ...TblFloorLeagueState.myEventScores, ...loadedMyScores };

        const [highscoreLeaders, participantBundle] = await Promise.all([
          loadTblHighscoreFloorLeaders(),
          loadTblParticipantsBundle(force)
        ]);

        if (modDisposed) {
          return TblFloorLeagueState.floorBarRows || [];
        }

        TblFloorLeagueState.myEventScores = myScores;
        TblFloorLeagueState.participantCount = participantBundle.count;

        const playerTotalTicks = buildTblPlayerTotalTicks(
          rawEntriesByFloor,
          participantBundle.highscoreMap,
          highscoreLeaders
        );
        TblFloorLeagueState.playerTotalTicks = playerTotalTicks;

        const firebaseByFloor = new Map();
        for (let floor = TBL_FIREBASE_FLOOR_MIN; floor <= TBL_FIREBASE_FLOOR_MAX; floor++) {
          firebaseByFloor.set(
            floor,
            rankTblLeaderboardEntries(rawEntriesByFloor.get(floor) || [], playerTotalTicks)
          );
        }

        const floorRows = [];
        for (let floor = TBL_MIN_FLOOR; floor <= TBL_MAX_FLOOR; floor++) {
          let entries = [];
          if (isTblHighscoreFloor(floor)) {
            const leader = highscoreLeaders[floor];
            entries = leader ? [leader] : [];
          } else {
            entries = firebaseByFloor.get(floor) || [];
          }
          floorRows.push(buildTblFloorRow(floor, entries, myScores, userScores, playerName));
        }

        TblFloorLeagueState.lastFullLoadAt = Date.now();
        return floorRows;
      } finally {
        TblFloorLeagueState.fullLoadInFlight = null;
      }
    })();

    return TblFloorLeagueState.fullLoadInFlight;
  }

  async function loadTblAllRankData(force = false) {
    if (modDisposed) {
      return TblFloorLeagueState.rankBarRows || [];
    }

    const now = Date.now();
    if (
      !force &&
      TblFloorLeagueState.rankBarRows &&
      now - TblFloorLeagueState.rankBarCacheAt < TBL_FETCH_CACHE_TTL_MS
    ) {
      return TblFloorLeagueState.rankBarRows;
    }
    if (
      !force &&
      TblFloorLeagueState.rankBarRows &&
      now - TblFloorLeagueState.lastRankFullLoadAt < TBL_FETCH_MIN_INTERVAL_MS
    ) {
      return TblFloorLeagueState.rankBarRows;
    }
    if (TblFloorLeagueState.rankFullLoadInFlight) {
      return TblFloorLeagueState.rankFullLoadInFlight;
    }

    TblFloorLeagueState.rankFullLoadInFlight = (async () => {
      try {
        if (modDisposed) {
          return TblFloorLeagueState.rankBarRows || [];
        }

        const userScores = getTblUserScoresForMap();
        const playerName = getTblPlayerName();
        const playerHash = await getTblPlayerHash();
        if (TblFloorLeagueState.joined) {
          await updateTblParticipantHighscoreTicks(force);
        }

        const allScores = await loadTblAllFirebaseRankScores(force);
        const {
          rawEntriesByFloor,
          myScores: loadedMyScores,
          myTicks: loadedMyTicks
        } = parseTblFirebaseRankScoresBundle(allScores, playerHash);
        const myRankScores = { ...TblFloorLeagueState.myEventRankScores, ...loadedMyScores };
        const myRankTicks = { ...TblFloorLeagueState.myEventRankTicks, ...loadedMyTicks };

        const [highscoreRankLeaders, participantBundle] = await Promise.all([
          loadTblHighscoreRankLeaders(),
          loadTblParticipantsBundle(force)
        ]);

        if (modDisposed) {
          return TblFloorLeagueState.rankBarRows || [];
        }

        TblFloorLeagueState.myEventRankScores = myRankScores;
        TblFloorLeagueState.myEventRankTicks = myRankTicks;

        const playerTotalRanks = buildTblPlayerTotalRanks(
          rawEntriesByFloor,
          participantBundle.highscoreRankMap,
          highscoreRankLeaders
        );
        const playerTotalRankTicks = buildTblPlayerTotalRankTicks(
          rawEntriesByFloor,
          participantBundle.highscoreRankTickMap,
          highscoreRankLeaders
        );
        TblFloorLeagueState.playerTotalRanks = playerTotalRanks;
        TblFloorLeagueState.playerTotalRankTicks = playerTotalRankTicks;

        const firebaseByFloor = new Map();
        for (let floor = 1; floor <= TBL_MAX_FLOOR; floor++) {
          firebaseByFloor.set(
            floor,
            rankTblRankLeaderboardEntries(rawEntriesByFloor.get(floor) || [], playerTotalRankTicks)
          );
        }

        const rankRows = [];
        for (let floor = TBL_MIN_FLOOR; floor <= TBL_MAX_FLOOR; floor++) {
          let entries = [];
          if (isTblHighscoreRankFloor(floor)) {
            const leader = highscoreRankLeaders[floor];
            entries = leader ? [leader] : [];
          } else {
            entries = firebaseByFloor.get(floor) || [];
          }
          rankRows.push(buildTblRankRow(
            floor,
            entries,
            myRankScores,
            myRankTicks,
            userScores,
            playerName
          ));
        }

        TblFloorLeagueState.lastRankFullLoadAt = Date.now();
        return rankRows;
      } finally {
        TblFloorLeagueState.rankFullLoadInFlight = null;
      }
    })();

    return TblFloorLeagueState.rankFullLoadInFlight;
  }

  function createTblLeagueSummaryPanel(rows, participantCount = 0, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    const leftCol = buildTblLeagueSummaryLeftColHtml(participantCount, competitionMode);
    const rightCol = buildTblLeagueSummaryStandingsHtml(rows, competitionMode);
    const html = `<div class="tbl-league-summary-grid">
      <div class="tbl-league-summary-col">${leftCol}</div>
      <div class="tbl-league-summary-separator" role="none"></div>
      <div class="tbl-league-summary-col tbl-league-standings-col">${rightCol}</div>
    </div>`;

    return createTblStatsPanel(html);
  }

  function getTblLeaguePrizeText(competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    return competitionMode === TBL_COMPETITION_TAB.RANK
      ? t('mods.betterUI.tblLeagueRankPrize', { amount: TBL_EVENT_PRIZE_BEAST_COINS })
      : t('mods.betterUI.tblLeagueFloorPrize', { amount: TBL_EVENT_PRIZE_BEAST_COINS });
  }

  function buildTblLeagueSummaryLeftColHtml(participantCount = 0, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    let leftCol = `<div class="tbl-event-timer-row pixel-font-14" style="margin-bottom:6px;"><span class="tbl-event-timer-value" style="color:#ccc;">—</span></div>`;
    leftCol += `<div style="margin-bottom:6px;">${escapeTblHtml(t('mods.betterUI.tblLeagueParticipants', { count: participantCount }))}</div>`;
    leftCol += `<div class="tbl-event-prize-row pixel-font-14" style="margin-bottom:6px;display:flex;align-items:center;gap:4px;color:#ffd700;">
      <span class="tbl-league-prize-label">${escapeTblHtml(getTblLeaguePrizeText(competitionMode))}</span>
      <img src="/assets/icons/beastcoin.png" alt="Beast Coins" class="pixelated" style="width:12px;height:12px;object-fit:contain;flex-shrink:0;" />
    </div>`;
    leftCol += `<div class="tbl-league-current-leader-row pixel-font-14" style="margin-bottom:6px;">${buildTblLeagueCurrentLeaderRowHtml([], competitionMode)}</div>`;
    return leftCol;
  }

  function updateTblLeagueSummaryPrize(prizeEl, competitionMode) {
    if (!prizeEl) {
      return;
    }
    prizeEl.textContent = getTblLeaguePrizeText(competitionMode);
  }

  function updateTblLeagueSummaryCurrentLeader(leaderEl, rows, competitionMode) {
    if (!leaderEl) {
      return;
    }
    leaderEl.innerHTML = buildTblLeagueCurrentLeaderRowHtml(rows, competitionMode);
  }

  function buildTblLeagueSummaryStandingsHtml(rows, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    const playerName = getTblPlayerName();
    const standings = buildTblOverallStandings(rows, playerName, competitionMode);

    let rightCol = `<div class="tbl-league-top-players"><div class="tbl-league-top-players-title">${escapeTblHtml(
      competitionMode === TBL_COMPETITION_TAB.RANK
        ? t('mods.betterUI.tblLeagueTopRankPlayers')
        : t('mods.betterUI.tblLeagueTopFloorPlayers')
    )}</div>`;
    if (standings.length > 0) {
      const standingsWithRank = standings.map((player, index) => ({ player, rank: index + 1 }));
      const topThree = standingsWithRank.slice(0, 3);
      const yourRow = playerName
        ? standingsWithRank.find((entry) => entry.player?.name === playerName) || null
        : null;

      rightCol += buildTblLeagueTopPlayersGridHtml(
        topThree,
        competitionMode,
        playerName,
        yourRow && yourRow.rank > 3 ? yourRow : null
      );
    } else {
      rightCol += competitionMode === TBL_COMPETITION_TAB.RANK
        ? `<div style="color:#888;margin-top:4px;text-align:center;">${escapeTblHtml(t('mods.betterUI.tblLeagueRankNoRuns'))}</div>`
        : `<div style="color:#888;margin-top:4px;text-align:center;">${escapeTblHtml(t('mods.betterUI.tblLeagueNoRuns', { ticks: TBL_MISSING_FLOOR_TICKS }))}</div>`;
    }
    rightCol += '</div>';
    return rightCol;
  }

  function updateTblLeagueSummaryStandings(standingsCol, rows, competitionMode) {
    if (!standingsCol) {
      return;
    }
    standingsCol.innerHTML = buildTblLeagueSummaryStandingsHtml(rows, competitionMode);
  }

  function createTblLeagueSharedSummary(participantCount) {
    const html = `<div class="tbl-league-summary-grid">
      <div class="tbl-league-summary-col">${buildTblLeagueSummaryLeftColHtml(participantCount)}</div>
      <div class="tbl-league-summary-separator" role="none"></div>
      <div class="tbl-league-summary-col tbl-league-standings-col"></div>
    </div>`;
    const panel = createTblStatsPanel(html);
    panel.style.flexShrink = '0';
    return {
      panel,
      standingsCol: panel.querySelector('.tbl-league-standings-col'),
      prizeLabel: panel.querySelector('.tbl-league-prize-label'),
      leaderRow: panel.querySelector('.tbl-league-current-leader-row')
    };
  }

  function getTblLeagueTabButtonClassName(isActive) {
    return isActive
      ? 'frame-pressed-1 surface-regular px-2 py-1 flex-1 tab-active pixel-font-14'
      : 'frame-pressed-1 surface-dark px-2 py-1 flex-1 pixel-font-14';
  }

  function setTblLeagueTabButtonLabel(button, iconDef, label) {
    button.replaceChildren();

    const iconWrap = document.createElement('span');
    Object.assign(iconWrap.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${TBL_LEAGUE_TAB_ICON_SIZE}px`,
      height: `${TBL_LEAGUE_TAB_ICON_SIZE}px`,
      flexShrink: '0'
    });

    const img = document.createElement('img');
    img.src = iconDef.src;
    img.alt = iconDef.alt || label;
    img.className = 'pixelated';
    Object.assign(img.style, {
      width: `${TBL_LEAGUE_TAB_ICON_SIZE}px`,
      height: `${TBL_LEAGUE_TAB_ICON_SIZE}px`,
      objectFit: 'contain',
      display: 'block'
    });
    iconWrap.appendChild(img);
    button.appendChild(iconWrap);

    const text = document.createElement('span');
    text.textContent = label;
    text.style.lineHeight = '1';
    button.appendChild(text);
  }

  function createTblLeagueTabButton(iconDef, label, tabId, isActive, onTabChange) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = tabId;
    button.className = getTblLeagueTabButtonClassName(isActive);
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      cursor: 'pointer'
    });
    setTblLeagueTabButtonLabel(button, iconDef, label);
    button.addEventListener('click', () => onTabChange(tabId));
    return button;
  }

  function createTblLeagueTabBar(activeTab, onTabChange) {
    const bar = document.createElement('div');
    bar.className = 'flex mb-2';
    bar.style.flexShrink = '0';

    const tabDefs = [
      { id: TBL_COMPETITION_TAB.FLOOR, label: t('mods.betterUI.tblLeagueTabFloor'), icon: TBL_LEAGUE_TAB_ICONS.floor },
      { id: TBL_COMPETITION_TAB.RANK, label: t('mods.betterUI.tblLeagueTabRank'), icon: TBL_LEAGUE_TAB_ICONS.rank }
    ];

    const buttons = tabDefs.map(({ id, label, icon }) => {
      const button = createTblLeagueTabButton(icon, label, id, id === activeTab, onTabChange);
      bar.appendChild(button);
      return button;
    });

    return { bar, buttons, tabDefs };
  }

  function createTblLeagueListPanel(scrollContainer) {
    const panel = document.createElement('div');
    panel.className = 'tbl-league-list-panel';
    panel.appendChild(scrollContainer.element);
    return panel;
  }

  async function navigateTblToFloor(floor) {
    const targetFloor = Math.min(TBL_MAX_FLOOR, Math.max(TBL_MIN_FLOOR, Number(floor)));
    if (!Number.isFinite(targetFloor) || !globalThis.state?.board?.send) {
      return;
    }
    if (!isTblFloorUnlocked(targetFloor)) {
      return;
    }

    try {
      const mapCode = getCurrentMapCode();
      if (mapCode !== TBL_ROOM_ID) {
        globalThis.state.board.send({
          type: 'selectRoomById',
          roomId: TBL_ROOM_ID
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      globalThis.state?.board?.trigger?.setState?.({
        fn: (prev) => ({ ...prev, floor: targetFloor })
      });

      TblFloorLeagueState.lastBarFloor = targetFloor;
      closeTblFloorLeagueModal();
      setTimeout(() => {
        refreshTblFloorBarSection().catch(() => {});
      }, 100);
    } catch (error) {
      console.warn('[Better Highscores][TBL] Failed to navigate to floor:', error);
    }
  }

  function buildTblImprovementText(row) {
    if (!row.unlocked) {
      return t('mods.betterUI.tblLeagueFloorLocked');
    }
    if (row.youLead) {
      return t('mods.betterUI.tblLeagueYouLead');
    }
    if (row.yourTicks === null || row.yourTicks === undefined) {
      const penaltyTicks = TBL_MISSING_FLOOR_TICKS;
      if (row.fromHighscores) {
        return row.leaderTicks !== null
          ? t('mods.betterUI.tblLeagueNoPersonalBest', { ticks: penaltyTicks })
          : t('mods.betterUI.tblLeagueNoRuns', { ticks: penaltyTicks });
      }
      return row.leaderTicks !== null
        ? t('mods.betterUI.tblLeagueNoRunYet', { ticks: penaltyTicks })
        : t('mods.betterUI.tblLeagueNoRuns', { ticks: penaltyTicks });
    }
    if (row.gap !== null && row.gap > 0) {
      return t('mods.betterUI.tblLeagueTicksBehind', { ticks: row.gap });
    }
    if (row.gap === 0) {
      return t('mods.betterUI.tblLeagueTied');
    }
    return t('mods.betterUI.tblLeagueNoRuns', { ticks: TBL_MISSING_FLOOR_TICKS });
  }

  function buildTblRankImprovementText(row) {
    if (!row.unlocked) {
      return t('mods.betterUI.tblLeagueFloorLocked');
    }
    if (row.youLead) {
      return t('mods.betterUI.tblLeagueYouLead');
    }
    if (row.yourRank === null || row.yourRank === undefined) {
      if (row.fromHighscores) {
        return row.leaderRank !== null
          ? t('mods.betterUI.tblLeagueRankNoPersonalBest')
          : t('mods.betterUI.tblLeagueRankNoRuns');
      }
      return row.leaderRank !== null
        ? t('mods.betterUI.tblLeagueRankNoRunYet')
        : t('mods.betterUI.tblLeagueRankNoRuns');
    }
    if (row.gap !== null && row.gap > 0) {
      if (row.gapType === 'ticks') {
        return t('mods.betterUI.tblLeagueTicksBehind', { ticks: row.gap });
      }
      return t('mods.betterUI.tblLeaguePointsBehind', { points: row.gap });
    }
    if (row.gap === 0) {
      return t('mods.betterUI.tblLeagueTied');
    }
    return t('mods.betterUI.tblLeagueRankNoRuns');
  }

  function buildTblLeagueRowList(rows, competitionMode) {
    const scrollContainer = createTblScrollContainer();
    const isRankMode = competitionMode === TBL_COMPETITION_TAB.RANK;

    rows.forEach((row) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      const hasYourScore = isRankMode
        ? (row.yourRank !== null && row.yourRank !== undefined)
        : (row.yourTicks !== null && row.yourTicks !== undefined);

      if (!row.unlocked) {
        itemEl.classList.add('tbl-league-item--locked');
      } else {
        itemEl.classList.add('tbl-league-item--clickable');
        if (!hasYourScore) {
          itemEl.classList.add('tbl-league-item--empty');
        }
        itemEl.addEventListener('click', () => {
          navigateTblToFloor(row.floor);
        });
      }
      itemEl.title = row.unlocked
        ? t('mods.betterUI.tblLeagueGoToFloor', { floor: row.floor })
        : t('mods.betterUI.tblLeagueFloorLocked');
      const statusColor = row.unlocked ? '#8f8' : '#888';
      const comparisonHtml = isRankMode
        ? formatTblRankComparison(
          row.yourRank,
          row.yourTicks,
          row.leaderRank,
          row.leaderTicks,
          row.leader?.name,
          row.youLead
        )
        : formatTblTicksComparison(row.yourTicks, row.leaderTicks, row.leader?.name, row.youLead);
      const statusText = isRankMode
        ? buildTblRankImprovementText(row)
        : buildTblImprovementText(row);

      itemEl.innerHTML = `
        ${buildTblLeagueThumbHtml(row.floor, competitionMode)}
        <div class="grid w-full gap-1">
          <div>${formatTblFloorRowTitleHtml(row.floor, row.ascension)}</div>
          <div class="pixel-font-14">${comparisonHtml}</div>
          <div class="pixel-font-14" style="color:${statusColor};">${escapeTblHtml(statusText)}</div>
        </div>
      `;
      scrollContainer.addContent(itemEl);
    });

    return scrollContainer;
  }

  function buildTblLeagueThumbHtml(floor, competitionMode = TBL_COMPETITION_TAB.FLOOR) {
    const floorIndex = Math.min(TBL_MAX_FLOOR, Math.max(TBL_MIN_FLOOR, Math.round(Number(floor) || 0)));
    const floorStyle = buildTblFloorScaleTextStyle(floorIndex);
    const isRankMode = competitionMode === TBL_COMPETITION_TAB.RANK;
    const overlayIcon = isRankMode
      ? `<img src="/assets/icons/star-tier.png" alt="Rank" class="pixelated" width="18" height="20" style="filter:drop-shadow(rgb(255,255,255) 0px 0px 2px);object-fit:contain;" />`
      : `<img src="/assets/icons/speed.png" alt="Ticks" class="pixelated" width="22" height="22" style="filter:drop-shadow(0 0 2px #fff);object-fit:contain;" />`;
    return `
      <div class="tbl-league-floor-thumb frame-pressed-1 shrink-0">
        <img
          src="/assets/room-thumbnails/${TBL_ROOM_ID}.png"
          alt="Tibia Ball League"
          class="pixelated tbl-league-floor-thumb-bg" />
        <div class="tbl-league-floor-thumb-overlay">
          ${overlayIcon}
          <span class="pixel-font-14" style="line-height:1;color:${floorStyle.color};text-shadow:${floorStyle.textShadow};">${floorIndex}</span>
        </div>
      </div>
    `;
  }

  function createTblLeagueModalContent(floorRows, rankRows, participantCount = 0) {
    const activeTab = TblFloorLeagueState.activeModalTab || TBL_COMPETITION_TAB.FLOOR;
    const { panel: summaryPanel, standingsCol, prizeLabel, leaderRow } = createTblLeagueSharedSummary(participantCount);
    const rankListPanel = createTblLeagueListPanel(buildTblLeagueRowList(rankRows, TBL_COMPETITION_TAB.RANK));
    const floorListPanel = createTblLeagueListPanel(buildTblLeagueRowList(floorRows, TBL_COMPETITION_TAB.FLOOR));

    const container = document.createElement('div');
    container.className = 'flex flex-col tbl-league-modal-content';
    Object.assign(container.style, {
      height: '100%',
      minHeight: '0',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      overflow: 'hidden'
    });

    let tabButtons = [];

    const setActiveTab = (tab) => {
      TblFloorLeagueState.activeModalTab = tab;
      const isRank = tab === TBL_COMPETITION_TAB.RANK;
      updateTblLeagueSummaryStandings(
        standingsCol,
        isRank ? rankRows : floorRows,
        isRank ? TBL_COMPETITION_TAB.RANK : TBL_COMPETITION_TAB.FLOOR
      );
      updateTblLeagueSummaryPrize(
        prizeLabel,
        isRank ? TBL_COMPETITION_TAB.RANK : TBL_COMPETITION_TAB.FLOOR
      );
      updateTblLeagueSummaryCurrentLeader(
        leaderRow,
        isRank ? rankRows : floorRows,
        isRank ? TBL_COMPETITION_TAB.RANK : TBL_COMPETITION_TAB.FLOOR
      );
      rankListPanel.style.display = isRank ? 'flex' : 'none';
      floorListPanel.style.display = isRank ? 'none' : 'flex';
      tabButtons.forEach((button) => {
        button.className = getTblLeagueTabButtonClassName(button.dataset.tab === tab);
      });
    };

    const { bar: tabBar, buttons } = createTblLeagueTabBar(activeTab, setActiveTab);
    tabButtons = buttons;

    container.appendChild(summaryPanel);
    container.appendChild(tabBar);
    container.appendChild(floorListPanel);
    container.appendChild(rankListPanel);
    setActiveTab(activeTab);

    return { element: container };
  }

  function closeTblFloorLeagueModal() {
    clearTblModalLayoutCleanup();
    clearTblEventTimerUpdates();
    if (TblFloorLeagueState.modalRef?.close) {
      TblFloorLeagueState.modalRef.close();
    } else {
      getTblModalDialog()?.remove();
    }
    TblFloorLeagueState.modalRef = null;
  }

  async function refreshTblFloorLeagueModalIfOpen() {
    if (!TblFloorLeagueState.modalRef) {
      return;
    }
    closeTblFloorLeagueModal();
    await openTblFloorLeagueModal(true);
  }

  async function openTblFloorLeagueModal(forceRefresh = false) {
    const api = getTblApi();
    if (!api?.ui?.components?.createModal) {
      console.warn('[Better Highscores][TBL] Modal API unavailable');
      return;
    }

    closeTblFloorLeagueModal();
    ensureTblLeagueStyles();

    if (!TblFloorLeagueState.joinChecked) {
      await refreshTblJoinState(forceRefresh);
    }

    let dismissLoading = null;
    try {
      dismissLoading = api.showModal?.({
        title: t('mods.betterUI.tblLeagueTitle'),
        content: `<div style="text-align:center;padding:20px;">${escapeTblHtml(t('mods.betterUI.tblLeagueLoading'))}</div>`,
        buttons: []
      });

      const [floorRows, rankRows] = await Promise.all([
        loadTblAllFloorData(forceRefresh),
        loadTblAllRankData(forceRefresh)
      ]);
      if (modDisposed) {
        return;
      }
      TblFloorLeagueState.floorBarRows = floorRows;
      TblFloorLeagueState.floorBarCacheAt = Date.now();
      TblFloorLeagueState.rankBarRows = rankRows;
      TblFloorLeagueState.rankBarCacheAt = Date.now();
      const modalContent = createTblLeagueModalContent(
        floorRows,
        rankRows,
        TblFloorLeagueState.participantCount || 0
      );

      if (typeof dismissLoading === 'function') {
        dismissLoading();
        dismissLoading = null;
      }

      const modalButtons = [
        {
          text: t('mods.betterUI.betterHighscoresContextMenuClose'),
          primary: true,
          onClick: () => closeTblFloorLeagueModal()
        }
      ];
      if (!TblFloorLeagueState.joined) {
        modalButtons.unshift({
          text: t('mods.betterUI.tblLeagueJoin'),
          primary: false,
          onClick: () => joinTblFloorLeague()
        });
      }

      const modalDimensions = getTblModalDimensions();
      const modalRef = api.ui.components.createModal({
        title: t('mods.betterUI.tblLeagueTitle'),
        width: modalDimensions.width,
        height: modalDimensions.height,
        content: modalContent.element,
        buttons: modalButtons
      });

      TblFloorLeagueState.modalRef = modalRef;
      setupTblModalResponsiveLayout(modalRef, modalContent.element);
      setupTblEventTimerUpdates();

      const originalClose = modalRef.close?.bind(modalRef);
      if (originalClose) {
        modalRef.close = () => {
          closeTblFloorLeagueModal();
          originalClose();
        };
      }
    } catch (error) {
      console.warn('[Better Highscores][TBL] Failed to open league modal:', error);
      api.ui?.components?.createModal?.({
        title: t('common.error'),
        content: `<p>${escapeTblHtml(t('mods.betterUI.tblLeagueLoadError'))}</p>`,
        buttons: [{ text: t('controls.ok'), primary: true }]
      });
    } finally {
      if (typeof dismissLoading === 'function') {
        dismissLoading();
      }
    }
  }

  function decorateTblFloorSection(section, userScores) {
    if (!isTblMapActive()) {
      return;
    }

    section.style.cursor = 'pointer';
    section.title = t('mods.betterUI.tblLeagueOpenHint');

    const existingBtn = section.querySelector('.tbl-event-competition-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    const eventBtn = createTblEventCompetitionButton();
    eventBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!TblFloorLeagueState.joined) {
        joinTblFloorLeague().then((joined) => {
          if (joined) {
            openTblFloorLeagueModal();
          }
        });
        return;
      }
      openTblFloorLeagueModal();
    });
    section.appendChild(eventBtn);

    section.addEventListener('click', (e) => {
      if (e.target.closest('button')) {
        return;
      }
      openTblFloorLeagueModal();
    });
  }

  function setupTblBoardListener() {
    if (TblFloorLeagueState.boardUnsubscribe || !globalThis.state?.board?.subscribe) {
      return;
    }

    TblFloorLeagueState.boardUnsubscribe = globalThis.state.board.subscribe(({ context }) => {
      if (modDisposed) {
        return;
      }
      if (isTblMapActive()) {
        const selectedFloor = getSelectedBoardFloor();
        if (selectedFloor !== TblFloorLeagueState.lastBarFloor) {
          TblFloorLeagueState.lastBarFloor = selectedFloor;
          refreshTblFloorBarSection().catch(() => {});
        }
        trackTblBattleSetup(context);
      }

      const serverResults = context?.serverResults;
      if (!serverResults?.rewardScreen || typeof serverResults.seed === 'undefined') {
        return;
      }

      const seed = serverResults.seed;
      if (seed === TblFloorLeagueState.lastProcessedSeed) {
        return;
      }

      scheduleTimeout(() => {
        const freshResults = getTblServerResultsFromBoard();
        if (!freshResults?.rewardScreen || freshResults.seed !== seed) {
          trySubmitTblAfterBattle();
          return;
        }
        handleTblServerResults(freshResults, seed).catch((err) => {
          console.warn('[Better Highscores][TBL] Server results handling failed:', err);
        });
      }, 0);
    });
    BetterHighscoresState.subscriptions.push(TblFloorLeagueState.boardUnsubscribe);
  }

  function setupTblRunTrackerTrigger() {
    if (TblFloorLeagueState.runTrackerTrigger) {
      return;
    }
    TblFloorLeagueState.runTrackerTrigger = () => {
      trySubmitTblAfterBattle(4);
    };
    window.addEventListener('runtracker:runsUpdated', TblFloorLeagueState.runTrackerTrigger);
  }

  function initTblFloorLeague() {
    TblFloorLeagueState.joined = readTblJoinedLocal();
    refreshTblJoinState().catch(() => {});
    setupTblNetworkListener();
    setupTblBoardListener();
    setupTblRunTrackerTrigger();
  }

  function cleanupTblFloorLeague() {
    closeTblFloorLeagueModal();
    clearTblModalLayoutCleanup();
    clearTblEventTimerUpdates();
    cleanupTblToastContainer();
    removeTblBoardSubscription();
    if (TblFloorLeagueState.fetchRestore) {
      window.fetch = TblFloorLeagueState.fetchRestore;
      TblFloorLeagueState.fetchRestore = null;
    }
    if (TblFloorLeagueState.runTrackerTrigger) {
      window.removeEventListener('runtracker:runsUpdated', TblFloorLeagueState.runTrackerTrigger);
      TblFloorLeagueState.runTrackerTrigger = null;
    }
    TblFloorLeagueState.joined = false;
    TblFloorLeagueState.joinChecked = false;
    TblFloorLeagueState.joinedAt = 0;
    TblFloorLeagueState.playerHash = null;
    TblFloorLeagueState.lastProcessedSeed = null;
    TblFloorLeagueState.myEventScores = {};
    TblFloorLeagueState.myEventRankScores = {};
    TblFloorLeagueState.myEventRankTicks = {};
    TblFloorLeagueState.eventNextCheckEndTime = null;
    TblFloorLeagueState.eventWasActive = false;
    TblFloorLeagueState.floorBarRows = null;
    TblFloorLeagueState.floorBarCacheAt = 0;
    TblFloorLeagueState.rankBarRows = null;
    TblFloorLeagueState.rankBarCacheAt = 0;
    TblFloorLeagueState.activeModalTab = TBL_COMPETITION_TAB.FLOOR;
    TblFloorLeagueState.lastBarFloor = null;
    TblFloorLeagueState.trackedBattleSetup = null;
    TblFloorLeagueState.playerTotalTicks = null;
    TblFloorLeagueState.playerTotalRanks = null;
    TblFloorLeagueState.playerTotalRankTicks = null;
    TblFloorLeagueState.participantCount = 0;
    TblFloorLeagueState.fetchCache.clear();
    TblFloorLeagueState.fetchInFlight.clear();
    TblFloorLeagueState.fullLoadInFlight = null;
    TblFloorLeagueState.rankFullLoadInFlight = null;
    TblFloorLeagueState.lastFullLoadAt = 0;
    TblFloorLeagueState.lastRankFullLoadAt = 0;
    TblFloorLeagueState.lastParticipantSyncAt = 0;
    TblFloorLeagueState.joinStateCachedAt = 0;
  }

// =======================
// MODULE 2: State Management
// =======================
  const BetterHighscoresState = {
    // Core state
    lastUpdateTime: 0,
    isUpdating: false,
    
    // Sandbox state preservation
    preservedContainer: null,
    wasInSandboxMode: false,
    
    // Board analysis detection
    isBoardAnalyzing: false,
    
    // Debounced update scheduling
    pendingMapCode: null,
    mapChangeDebounceTimeout: null,
    containerDebounceTimeout: null,
    pendingUpdateAfterCurrent: false,
    lastNoContainerLog: 0,
    
    // Error state
    consecutiveErrors: 0,
    lastErrorTime: 0,
    totalErrors: 0,
    
    // Cache state
    leaderboardCache: new Map(),
    cacheTimeout: 30000, // 30 seconds
    lastBattleCompletionAt: 0,
    
    // Subscription management for cleanup
    subscriptions: [],
    
    // Timeout tracking for cleanup
    timeouts: [],
    
    // State reset
    reset() {
      this.lastUpdateTime = 0;
      this.isUpdating = false;
      this.preservedContainer = null;
      this.wasInSandboxMode = false;
      this.consecutiveErrors = 0;
      this.lastErrorTime = 0;
      this.totalErrors = 0;
      this.leaderboardCache.clear();
      this.lastBattleCompletionAt = 0;
      this.subscriptions = [];
      this.timeouts = [];
      this.pendingMapCode = null;
      this.mapChangeDebounceTimeout = null;
      this.containerDebounceTimeout = null;
      this.pendingUpdateAfterCurrent = false;
    },
    
    // Helper function to track timeouts for cleanup
    trackTimeout(timeoutId) {
      this.timeouts.push(timeoutId);
      return timeoutId;
    },

    untrackTimeout(timeoutId) {
      this.timeouts = this.timeouts.filter((id) => id !== timeoutId);
    },
    
    // Helper function to clear all tracked timeouts
    clearTimeouts() {
      this.timeouts.forEach(id => clearTimeout(id));
      this.timeouts = [];
    }
  };
  
  // Local variables for state access
  let leaderboardContainer = null;
  let currentMapCode = null;
  let roomNames = null;
  let lastTrackedMapCode = null;
  let lastTrackedUserScores = null;
  
  // Helper function to schedule a timeout and track it for cleanup
  function scheduleTimeout(fn, delay) {
    const timeoutId = setTimeout(() => {
      BetterHighscoresState.untrackTimeout(timeoutId);
      if (modDisposed) {
        return;
      }
      fn();
    }, delay);
    return BetterHighscoresState.trackTimeout(timeoutId);
  }
  
  // Helper function to remove all leaderboard containers from DOM
  function removeExistingContainers() {
    const existingContainers = document.querySelectorAll('.better-highscores-container');
    existingContainers.forEach((container) => detachLeaderboardContainer(container));
    return existingContainers.length;
  }
  
  // Helper function to check if action should be throttled
  function shouldThrottle(lastTime, delay) {
    return Date.now() - lastTime < delay;
  }
  
  // Helper function to get player snapshot
  function getPlayerSnapshot() {
    try {
      return globalThis.state?.player?.getSnapshot();
    } catch (error) {
      console.warn('[Better Highscores] Error getting player snapshot:', error);
      return null;
    }
  }

// =======================
// MODULE 3: Error Handling
// =======================
  function handleError(error, context = 'unknown') {
    const now = Date.now();
    BetterHighscoresState.totalErrors++;
    BetterHighscoresState.lastErrorTime = now;
    BetterHighscoresState.consecutiveErrors++;
    
    console.error(`[Better Highscores] Error in ${context}:`, error);
    
    // Check if we should stop operations
    if (BetterHighscoresState.consecutiveErrors >= 3) {
      console.warn(`[Better Highscores] Stopping operations due to ${BetterHighscoresState.consecutiveErrors} consecutive errors`);
      return { shouldStop: true, reason: 'max_errors' };
    }
    
    return { shouldStop: false, reason: null };
  }
  
  function handleSuccess() {
    BetterHighscoresState.consecutiveErrors = 0;
  }

// =======================
// MODULE 4: API Functions
// =======================
  // Helper function to fetch data from TRPC API
  async function fetchTRPC(method) {
    console.log(`[Better Highscores] 🌐 API REQUEST: ${method}`);
    try {
      const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
      const res = await fetch(`/pt/api/trpc/${method}?batch=1&input=${inp}`, {
        headers: { 
          'Accept': '*/*', 
          'Content-Type': 'application/json', 
          'X-Game-Version': '1' 
        }
      });
      
      if (!res.ok) {
        throw new Error(`${method} → ${res.status}`);
      }
      
      const json = await res.json();
      return json[0].result.data.json;
    } catch (error) {
      console.error('[Better Highscores] Error fetching from TRPC:', error);
      throw error;
    }
  }

  // Function to get current map code using proper game state API
  function getCurrentMapCode() {
    try {
      // Method 1: Try to get from board state (most reliable)
      const boardState = globalThis.state?.board?.getSnapshot();
      if (boardState && boardState.context && boardState.context.selectedMap) {
        // Check different possible locations for the map ID
        const selectedMap = boardState.context.selectedMap;
        
        // Try selectedRoom.id first
        if (selectedMap.selectedRoom && selectedMap.selectedRoom.id) {
          return selectedMap.selectedRoom.id;
        }
        
        // Try selectedRegion.id as fallback
        if (selectedMap.selectedRegion && selectedMap.selectedRegion.id) {
          return selectedMap.selectedRegion.id;
        }
        
        // Try direct id property
        if (selectedMap.id) {
          return selectedMap.id;
        }
      }
      
      // Method 2: Try to get from game state
      const gameState = globalThis.state?.game?.getSnapshot();
      if (gameState && gameState.context && gameState.context.map) {
        return gameState.context.map;
      }
      
      // Method 3: Try to get from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const mapFromUrl = urlParams.get('map');
      if (mapFromUrl) {
        return mapFromUrl;
      }
      
      // Method 4: Try to get from current page context
      const currentPage = window.location.pathname;
      if (currentPage.includes('/room/')) {
        const pathParts = currentPage.split('/');
        const roomId = pathParts[pathParts.length - 1];
        if (roomId && roomId !== 'room') {
          return roomId;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Better Highscores] Error getting current map code:', error);
      return null;
    }
  }

  // Function to fetch leaderboard data with caching
  async function fetchLeaderboardData(mapCode, forceRefresh = false) {
    const cacheKey = `leaderboard_${mapCode}`;
    const cached = BetterHighscoresState.leaderboardCache.get(cacheKey);
    
    if (!forceRefresh && cached && Date.now() - cached.timestamp < BetterHighscoresState.cacheTimeout) {
      return cached.data;
    }
    
    try {
      console.log('[Better Highscores] Fetching leaderboard data for map:', mapCode);
      
      const [roomsHighscores, tickHighscores] = await Promise.all([
        fetchTRPC('game.getRoomsHighscores'),
        fetchTRPC('game.getTickHighscores')
      ]);
      
      console.log('[Better Highscores] Leaderboard response:', { roomsHighscores, tickHighscores });
      
      // Speedrun WR uses getTickHighscores; rank/floor use getRoomsHighscores
      const tickEntry = tickHighscores?.[mapCode] || roomsHighscores?.ticks?.[mapCode];
      const tickData = tickEntry ? [tickEntry] : [];
      const rankData = roomsHighscores?.rank?.[mapCode] ? [roomsHighscores.rank[mapCode]] : [];
      const floorData = roomsHighscores?.floor?.[mapCode] ? [roomsHighscores.floor[mapCode]] : [];
      
      console.log('[Better Highscores] Extracted tick data for map', mapCode, ':', tickData);
      console.log('[Better Highscores] Extracted rank data for map', mapCode, ':', rankData);
      console.log('[Better Highscores] Extracted floor data for map', mapCode, ':', floorData);
      
      const data = {
        tickData,
        rankData,
        floorData
      };
      
      // Avoid poisoning cache with potentially stale immediate post-battle snapshots.
      if (!forceRefresh) {
        BetterHighscoresState.leaderboardCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      
      return data;
    } catch (error) {
      const errorResult = handleError(error, 'fetchLeaderboardData');
      if (errorResult.shouldStop) {
        throw new Error(`Failed to fetch leaderboard data: ${errorResult.reason}`);
      }
      throw error;
    }
  }

// =======================
// MODULE 5: Utility Functions
// =======================
  // Helper to handle state transitions
  function handleStateTransition(previousState, currentState) {
    // Detect playing -> initial transitions
    if (previousState === 'playing' && currentState === 'initial') {
      if (isSandboxMode()) {
        console.log('[Better Highscores] Sandbox game ended, restoring container');
        scheduleTimeout(() => restoreContainer(), DELAYS.RESTORE);
      } else if (isAutoplayMode()) {
        console.log('[Better Highscores] Autoplay game ended, ensuring leaderboard is visible');
        scheduleTimeout(() => updateLeaderboards(), DELAYS.UPDATE);
      }
    }
    
    // Detect initial -> playing transitions
    if (previousState === 'initial' && currentState === 'playing') {
      if (isSandboxMode()) {
        console.log('[Better Highscores] Sandbox game started, preserving container');
        scheduleTimeout(() => preserveContainer(), DELAYS.RESTORE);
      } else if (isAutoplayMode()) {
        console.log('[Better Highscores] Autoplay game started, ensuring leaderboard is visible');
        scheduleTimeout(() => {
          if (!leaderboardContainer || !document.contains(leaderboardContainer)) {
            console.log('[Better Highscores] Leaderboard missing when autoplay started, restoring');
            updateLeaderboards();
          }
        }, DELAYS.UPDATE);
      }
    }
  }
  
  async function refreshLeaderboardForMap(mapCode) {
    if (modDisposed || isBetterHighscoresHidden() || !mapCode || isBoardAnalyzing()) {
      return false;
    }

    try {
      const { tickData, rankData, floorData } = await fetchLeaderboardData(mapCode, true);

      if (modDisposed) {
        return false;
      }

      if (leaderboardContainer && document.contains(leaderboardContainer)) {
        const updated = updateLeaderboardData(tickData, rankData, floorData);
        if (updated) {
          BetterHighscoresState.lastUpdateTime = Date.now();
          console.log('[Better Highscores] Leaderboard updated in place with fresh data');
          return true;
        }
      }

      const mapName = getMapName(mapCode);
      const newContainer = createLeaderboardDisplay(tickData, rankData, floorData, mapName);
      if (leaderboardContainer && document.contains(leaderboardContainer)) {
        leaderboardContainer.replaceWith(newContainer);
      } else {
        const mainContainer = getMainContainer();
        if (mainContainer) {
          mainContainer.appendChild(newContainer);
        }
      }
      leaderboardContainer = newContainer;
      currentMapCode = mapCode;
      BetterHighscoresState.lastUpdateTime = Date.now();
      console.log('[Better Highscores] Leaderboard refreshed with fresh data');
      return true;
    } catch (error) {
      console.warn('[Better Highscores] Failed to refresh leaderboard:', error);
      return false;
    }
  }

  function scheduleLeaderboardRefresh(mapCode, reason = 'refresh') {
    if (!mapCode || isBetterHighscoresHidden()) {
      return;
    }

    console.log(`[Better Highscores] Scheduling leaderboard refresh (${reason}) for map: ${mapCode}`);
    BetterHighscoresState.lastBattleCompletionAt = Date.now();
    BetterHighscoresState.leaderboardCache.delete(`leaderboard_${mapCode}`);

    scheduleTimeout(() => {
      refreshLeaderboardForMap(mapCode);
    }, DELAYS.BATTLE_REFRESH);

    scheduleTimeout(() => {
      BetterHighscoresState.leaderboardCache.delete(`leaderboard_${mapCode}`);
      refreshLeaderboardForMap(mapCode);
    }, DELAYS.HIGHSCORE_RETRY);
  }

  function handlePlayerScoreUpdate() {
    if (isBoardAnalyzing() || isBetterHighscoresHidden()) {
      return;
    }

    const mapCode = getCurrentMapCode();
    if (!mapCode) {
      return;
    }

    const currentScores = snapshotUserScoresForMap(mapCode);
    if (mapCode !== lastTrackedMapCode) {
      resetTrackedUserScores(mapCode);
      return;
    }

    if (hasUserScoreImproved(lastTrackedUserScores, currentScores)) {
      console.log('[Better Highscores] Personal best improved, refreshing world records');
      scheduleLeaderboardRefresh(mapCode, 'personal-best');
    }

    lastTrackedUserScores = currentScores;
  }

  // Helper to handle battle completion (victory/defeat states)
  async function handleBattleCompletion() {
    if (isBetterHighscoresHidden()) {
      return;
    }

    if (isSandboxMode()) {
      console.log('[Better Highscores] Battle completed in sandbox mode, restoring container');
      scheduleTimeout(() => restoreContainer(), DELAYS.RESTORE);
    } else if (isAutoplayMode()) {
      console.log('[Better Highscores] Battle completed in autoplay mode, ensuring leaderboard is visible');
    }

    const mapCode = getCurrentMapCode();
    if (mapCode) {
      console.log('[Better Highscores] Battle completed, refreshing leaderboard data');
      scheduleLeaderboardRefresh(mapCode, 'battle-complete');
    }

    trySubmitTblAfterBattle();
  }

  function clearDebounceTimeout(timeoutKey) {
    const timeoutId = BetterHighscoresState[timeoutKey];
    if (timeoutId) {
      clearTimeout(timeoutId);
      BetterHighscoresState.untrackTimeout(timeoutId);
      BetterHighscoresState[timeoutKey] = null;
    }
  }

  function scheduleMapChangeUpdate(mapCode) {
    BetterHighscoresState.pendingMapCode = mapCode;

    clearDebounceTimeout('mapChangeDebounceTimeout');

    BetterHighscoresState.mapChangeDebounceTimeout = scheduleTimeout(() => {
      BetterHighscoresState.mapChangeDebounceTimeout = null;

      const targetMap = getCurrentMapCode() || BetterHighscoresState.pendingMapCode;
      BetterHighscoresState.pendingMapCode = null;

      if (!targetMap) {
        return;
      }

      console.log(`[Better Highscores] Map changed from ${currentMapCode} to ${targetMap}`);
      resetTrackedUserScores(targetMap);
      updateLeaderboards();
    }, DELAYS.MAP_CHANGE_DEBOUNCE);
  }

  function scheduleContainerUpdate() {
    if (isSandboxMode()) {
      console.log('[Better Highscores] Main container changed in sandbox mode, skipping leaderboard re-application');
      return;
    }

    const debounceDelay = isAutoplayMode()
      ? DELAYS.CONTAINER_DEBOUNCE_AUTOPLAY
      : DELAYS.CONTAINER_DEBOUNCE_NORMAL;

    clearDebounceTimeout('containerDebounceTimeout');

    BetterHighscoresState.containerDebounceTimeout = scheduleTimeout(() => {
      BetterHighscoresState.containerDebounceTimeout = null;

      const mainContainer = getMainContainer();
      if (!mainContainer || (leaderboardContainer && mainContainer.contains(leaderboardContainer))) {
        return;
      }

      console.log('[Better Highscores] Main container changed, re-applying leaderboard');
      updateLeaderboards();
    }, debounceDelay);
  }

  // Shared handler for map changes and container updates
  function handleStateUpdate(detectedMapCode, mainContainer) {
    if (detectedMapCode && detectedMapCode !== currentMapCode) {
      scheduleMapChangeUpdate(detectedMapCode);
      return;
    }

    if (mainContainer && (!leaderboardContainer || !mainContainer.contains(leaderboardContainer))) {
      scheduleContainerUpdate();
    }
  }

  function getMainContainer() {
    return document.querySelector('.relative.z-0.select-none') || 
           document.querySelector('[class*="relative"]') ||
           document.body;
  }

  function getMapName(mapCode) {
    // Use the proper game state API to get room names
    if (!roomNames) {
      roomNames = globalThis.state?.utils?.ROOM_NAME || {};
    }
    return roomNames[mapCode] || mapCode;
  }

  function isSandboxMode() {
    try {
      const boardContext = globalThis.state?.board?.getSnapshot()?.context;
      return boardContext?.mode === 'sandbox';
    } catch (error) {
      console.warn('[Better Highscores] Error checking sandbox mode:', error);
      return false;
    }
  }

  function isAutoplayMode() {
    try {
      // Method 1: Check player flags for autoplay
      const playerSnapshot = getPlayerSnapshot();
      if (playerSnapshot?.context?.flags) {
        const flags = new globalThis.state.utils.Flags(playerSnapshot.context.flags);
        if (flags.isSet("autoplay")) {
          return true;
        }
      }
      
      // Method 2: Check for autoplay UI elements
      const autoplayContainer = document.querySelector(".widget-bottom[data-minimized='false']");
      if (autoplayContainer) {
        return true;
      }
      
      // Method 3: Check for autoplay controls
      const autoplayControls = document.querySelector('[data-autoplay], .autoplay-controls, .autoplay-panel');
      if (autoplayControls) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('[Better Highscores] Error checking autoplay mode:', error);
      return false;
    }
  }

  function isBoardAnalyzing() {
    try {
      // Use the global coordination flag set by Board Analyzer
      const isAnalyzing = window.ModCoordination?.isModActive('Board Analyzer') || false;
      
      // Track state changes and trigger restore when analysis ends
      if (isAnalyzing !== BetterHighscoresState.isBoardAnalyzing) {
        const wasAnalyzing = BetterHighscoresState.isBoardAnalyzing;
        BetterHighscoresState.isBoardAnalyzing = isAnalyzing;
        
        if (isAnalyzing) {
          console.log('[Better Highscores] Board analysis detected, disabling updates');
        } else if (wasAnalyzing) {
          console.log('[Better Highscores] Board analysis ended, re-enabling updates');
          
          // Restore container if we have one preserved
          if (BetterHighscoresState.preservedContainer) {
            console.log('[Better Highscores] Board analysis completed, restoring preserved container');
            scheduleTimeout(() => {
              restoreContainer();
            }, DELAYS.RESTORE);
          }
        }
      }
      
      return BetterHighscoresState.isBoardAnalyzing;
    } catch (error) {
      console.warn('[Better Highscores] Error checking board analysis:', error);
      return false;
    }
  }

  // Function to preserve the current container when entering sandbox mode
  function preserveContainer() {
    if (leaderboardContainer && !BetterHighscoresState.preservedContainer) {
      console.log('[Better Highscores] Preserving container for sandbox mode');
      BetterHighscoresState.preservedContainer = leaderboardContainer.cloneNode(true);
      BetterHighscoresState.wasInSandboxMode = true;
      console.log('[Better Highscores] Container preserved successfully');
    } else if (!leaderboardContainer) {
      console.log('[Better Highscores] No container to preserve');
    } else if (BetterHighscoresState.preservedContainer) {
      console.log('[Better Highscores] Container already preserved');
    }
  }

  // Function to restore the preserved container when exiting sandbox mode
  function restoreContainer() {
    if (isBetterHighscoresHidden()) {
      return;
    }

    if (!BetterHighscoresState.preservedContainer) {
      // Only log this once to avoid spam
      if (!BetterHighscoresState.lastNoContainerLog || Date.now() - BetterHighscoresState.lastNoContainerLog > 5000) {
        console.log('[Better Highscores] No preserved container to restore');
        BetterHighscoresState.lastNoContainerLog = Date.now();
      }
      return;
    }
    
    const source = BetterHighscoresState.wasInSandboxMode ? 'sandbox mode' : 'board analysis';
    console.log(`[Better Highscores] Restoring preserved container from ${source}`);
    
    // Remove any existing containers first
    removeExistingContainers();
    
    // Restore the preserved container
    const restoredContainer = BetterHighscoresState.preservedContainer.cloneNode(true);
    const mainContainer = getMainContainer();
    
    if (mainContainer) {
      mainContainer.appendChild(restoredContainer);
      leaderboardContainer = restoredContainer;
      applyContainerStyles(leaderboardContainer);
      console.log('[Better Highscores] Container restored successfully');
    } else {
      console.log('[Better Highscores] Could not find main container for restoration');
    }
    
    // Clear preserved state
    BetterHighscoresState.preservedContainer = null;
    BetterHighscoresState.wasInSandboxMode = false;
    
    // Force update to ensure correct map data is displayed
    scheduleTimeout(() => updateLeaderboards(), DELAYS.RESTORE);
  }

  function getMedalColor(position) {
    const medalType = UI_CONFIG.MEDAL_POSITIONS[position];
    return medalType ? UI_CONFIG.COLORS[medalType] : 'white';
  }

  function getMaxRankPoints() {
    try {
      // Get current map code
      const mapCode = getCurrentMapCode();
      if (!mapCode) {
        return null;
      }
      
      // Get room data from utils
      const rooms = globalThis.state.utils.ROOMS;
      if (!rooms) {
        return null;
      }
      
      // Find the current room by ID
      const currentRoom = rooms.find(room => room.id === mapCode);
      if (!currentRoom || !currentRoom.maxTeamSize) {
        return null;
      }
      
      // Calculate max rank points: rankPoints = (2 * maxTeamSize) - 1
      const maxRankPoints = (2 * currentRoom.maxTeamSize) - 1;
      
      return maxRankPoints;
    } catch (error) {
      console.error('[Better Highscores] Error calculating max rank points:', error);
      return null;
    }
  }

  function getMaxFloor() {
    // Max floor is always 15
    return 15;
  }

  function getUserBestScores() {
    try {
      // Get current map code
      const mapCode = getCurrentMapCode();
      if (!mapCode) {
        return null;
      }
      
      // Get player data
      const playerSnapshot = getPlayerSnapshot();
      if (!playerSnapshot || !playerSnapshot.context || !playerSnapshot.context.rooms) {
        return null;
      }
      
      // Get user's data for current map
      const userMapData = playerSnapshot.context.rooms[mapCode];
      if (!userMapData) {
        return null;
      }
      
      return {
        bestTicks: userMapData.ticks || null,
        bestRank: userMapData.rank || null,
        bestRankTicks: userMapData.rankTicks !== undefined && userMapData.rankTicks !== null ? userMapData.rankTicks : null,
        bestFloor: userMapData.floor !== undefined && userMapData.floor !== null ? userMapData.floor : 0,
        bestFloorTicks: userMapData.floorTicks !== undefined && userMapData.floorTicks !== null ? userMapData.floorTicks : null
      };
    } catch (error) {
      console.error('[Better Highscores] Error getting user best scores:', error);
      return null;
    }
  }

  function snapshotUserScoresForMap(mapCode) {
    const playerSnapshot = getPlayerSnapshot();
    const room = playerSnapshot?.context?.rooms?.[mapCode];
    if (!room) {
      return null;
    }

    return {
      ticks: room.ticks ?? null,
      rank: room.rank ?? null,
      rankTicks: room.rankTicks ?? null,
      floor: room.floor ?? null,
      floorTicks: room.floorTicks ?? null
    };
  }

  function resetTrackedUserScores(mapCode) {
    lastTrackedMapCode = mapCode || null;
    lastTrackedUserScores = mapCode ? snapshotUserScoresForMap(mapCode) : null;
  }

  function hasUserScoreImproved(previous, current) {
    if (!current) {
      return false;
    }
    if (!previous) {
      return (
        (current.ticks !== null && current.ticks !== undefined) ||
        (current.rank !== null && current.rank !== undefined) ||
        (current.floor !== null && current.floor !== undefined && current.floor > 0)
      );
    }

    if (current.ticks !== null && current.ticks !== undefined &&
        (previous.ticks === null || previous.ticks === undefined || current.ticks < previous.ticks)) {
      return true;
    }

    const rankImproved = isRankBetterOrEqual(
      current.rank,
      current.rankTicks,
      previous.rank,
      previous.rankTicks
    ) && (
      previous.rank === null ||
      previous.rank === undefined ||
      current.rank !== previous.rank ||
      current.rankTicks !== previous.rankTicks
    );
    if (rankImproved) {
      return true;
    }

    const floorImproved = isFloorBetterOrEqual(
      current.floor,
      current.floorTicks,
      previous.floor,
      previous.floorTicks
    ) && (
      previous.floor === null ||
      previous.floor === undefined ||
      current.floor !== previous.floor ||
      current.floorTicks !== previous.floorTicks
    );
    return floorImproved;
  }

  function getEntryFloorTicks(entry) {
    if (!entry) {
      return null;
    }
    if (entry.floorTicks !== null && entry.floorTicks !== undefined) {
      return entry.floorTicks;
    }
    if (entry.ticks !== null && entry.ticks !== undefined) {
      return entry.ticks;
    }
    return null;
  }

  function isTicksBetterOrEqual(userTicks, wrTicks) {
    if (userTicks === null || userTicks === undefined) {
      return false;
    }
    if (wrTicks === null || wrTicks === undefined) {
      return true;
    }
    return userTicks <= wrTicks;
  }

  function isRankBetterOrEqual(userRank, userTicks, wrRank, wrTicks) {
    if (userRank === null || userRank === undefined) {
      return false;
    }
    if (wrRank === null || wrRank === undefined) {
      return true;
    }
    if (userRank > wrRank) {
      return true;
    }
    if (userRank < wrRank) {
      return false;
    }
    return isTicksBetterOrEqual(userTicks, wrTicks);
  }

  function isFloorBetterOrEqual(userFloor, userFloorTicks, wrFloor, wrFloorTicks) {
    const normalizedUserFloor = userFloor !== null && userFloor !== undefined ? userFloor : 0;
    if (wrFloor === null || wrFloor === undefined) {
      return true;
    }
    if (normalizedUserFloor > wrFloor) {
      return true;
    }
    if (normalizedUserFloor < wrFloor) {
      return false;
    }
    return isTicksBetterOrEqual(userFloorTicks, wrFloorTicks);
  }

  function getBestLeaderboardEntry(data, config) {
    if (!data || data.length === 0) {
      return null;
    }
    if (data.length === 1) {
      return data[0];
    }

    return data.reduce((best, entry) => {
      if (!best) {
        return entry;
      }
      if (config.isFloor) {
        return isFloorBetterOrEqual(
          entry.floor,
          getEntryFloorTicks(entry),
          best.floor,
          getEntryFloorTicks(best)
        ) ? entry : best;
      }
      if (config.isRank) {
        return isRankBetterOrEqual(
          entry.rank,
          entry.ticks,
          best.rank,
          best.ticks
        ) ? entry : best;
      }
      return isTicksBetterOrEqual(entry.ticks, best.ticks) ? entry : best;
    }, null);
  }

  function userBeatsOrTiesWorldRecord(userScores, wrEntry, config) {
    if (!wrEntry) {
      return false;
    }
    if (config.isFloor) {
      return isFloorBetterOrEqual(
        userScores?.bestFloor,
        userScores?.bestFloorTicks,
        wrEntry.floor,
        getEntryFloorTicks(wrEntry)
      );
    }
    if (config.isRank) {
      return isRankBetterOrEqual(
        userScores?.bestRank,
        userScores?.bestRankTicks,
        wrEntry.rank,
        wrEntry.ticks
      );
    }
    return isTicksBetterOrEqual(userScores?.bestTicks, wrEntry.ticks);
  }

  function buildTopDisplayEntry(wrEntry, userScores, config, playerName) {
    if (!wrEntry || !userBeatsOrTiesWorldRecord(userScores, wrEntry, config)) {
      return wrEntry;
    }

    if (config.isFloor) {
      return {
        userName: playerName,
        floor: userScores?.bestFloor !== null && userScores?.bestFloor !== undefined ? userScores.bestFloor : 0,
        floorTicks: userScores?.bestFloorTicks,
        ticks: userScores?.bestFloorTicks
      };
    }
    if (config.isRank) {
      return {
        userName: playerName,
        rank: userScores?.bestRank,
        ticks: userScores?.bestRankTicks
      };
    }
    return {
      userName: playerName,
      ticks: userScores?.bestTicks
    };
  }

  function getUserProgressValue(userScores, wrEntry, config) {
    if (config.isFloor) {
      if (userScores?.bestFloor !== null && userScores?.bestFloor !== undefined) {
        return userScores.bestFloor;
      }
      return wrEntry?.floor ?? null;
    }
    if (config.isRank) {
      if (userScores?.bestRank !== null && userScores?.bestRank !== undefined) {
        return userScores.bestRank;
      }
      return wrEntry?.rank ?? null;
    }
    return null;
  }

  function scoresAreEqual(userScores, wrEntry, config) {
    if (!wrEntry) {
      return false;
    }
    if (config.isFloor) {
      const userFloor = userScores?.bestFloor !== null && userScores?.bestFloor !== undefined ? userScores.bestFloor : 0;
      return userFloor === wrEntry.floor &&
        userScores?.bestFloorTicks === getEntryFloorTicks(wrEntry);
    }
    if (config.isRank) {
      return userScores?.bestRank === wrEntry.rank &&
        userScores?.bestRankTicks === wrEntry.ticks;
    }
    return userScores?.bestTicks === wrEntry.ticks;
  }

  function isServerWorldRecordHolder(wrEntry, playerUserId) {
    return Boolean(
      wrEntry &&
      playerUserId !== null &&
      playerUserId !== undefined &&
      wrEntry.userId === playerUserId
    );
  }

  function userStrictlyBeatsWorldRecord(userScores, wrEntry, config) {
    if (!wrEntry || !userScores) {
      return false;
    }
    return userBeatsOrTiesWorldRecord(userScores, wrEntry, config) &&
      !scoresAreEqual(userScores, wrEntry, config);
  }

  function hasLocalScoreWithoutPublicRecord(config, userScores) {
    if (!userScores) {
      return false;
    }
    if (config.isFloor) {
      const floor = userScores.bestFloor;
      return floor !== null && floor !== undefined && floor > 0;
    }
    if (config.isRank) {
      return userScores.bestRank !== null && userScores.bestRank !== undefined;
    }
    return userScores.bestTicks !== null && userScores.bestTicks !== undefined;
  }

  /** Local profile still has stats after a dev reset that cleared the public board (or beat a stale WR). */
  function isLegacyHighscore(userScores, wrEntry, config, playerUserId) {
    if (!wrEntry) {
      return hasLocalScoreWithoutPublicRecord(config, userScores);
    }
    return userStrictlyBeatsWorldRecord(userScores, wrEntry, config) &&
      !isServerWorldRecordHolder(wrEntry, playerUserId);
  }

  function formatLeaderboardEntry(entry, index, isRankLeaderboard = false, isFloorLeaderboard = false, fallbackTick = null) {
    const medalColor = getMedalColor(index + 1);
    
    // Check if this is the current user
    const playerSnapshot = getPlayerSnapshot();
    const currentUserName = playerSnapshot?.context?.name;
    const isCurrentUser = currentUserName && entry.userName === currentUserName;
    
    let value = entry.ticks || entry.rank;
    if (isRankLeaderboard && entry.rank !== undefined) {
      value = `${entry.rank}`;
      if (entry.ticks !== undefined && entry.ticks !== null) {
        value += ` (${entry.ticks})`;
      }
    } else if (isFloorLeaderboard && entry.floor !== undefined) {
      // Always show floor value, even if 0
      value = `${entry.floor}`;
      if (entry.floorTicks !== undefined && entry.floorTicks !== null) {
        value += ` (${entry.floorTicks})`;
      } else if (entry.floor === 0 && fallbackTick !== null && fallbackTick !== undefined) {
        // When floor is 0, use best tick from tick leaderboard as fallback
        value += ` (${fallbackTick})`;
      } else if (entry.ticks !== undefined && entry.ticks !== null) {
        value += ` (${entry.ticks})`;
      }
    }
    
    return {
      color: isCurrentUser ? '#00ff00' : medalColor, // Green for current user
      fontWeight: 'bold',
      isCurrentUser: isCurrentUser,
      value: value
    };
  }

// =======================
// MODULE 6: UI Components & Rendering
// =======================
  function createScoreIcon(src, alt, title, opacity = 1) {
    const icon = document.createElement('img');
    icon.src = src;
    icon.alt = alt;
    icon.title = title;
    Object.assign(icon.style, SCORE_ICON_STYLE, opacity < 1 ? { opacity: String(opacity) } : {});
    return icon;
  }

  function getLeaderboardRenderContext(tickData, rankData, floorData) {
    const userScores = getUserBestScores();
    const playerName = getPlayerSnapshot()?.context?.name;
    const maxRankPoints = getMaxRankPoints();
    const maxFloor = getMaxFloor();
    const bestRankEntry = getBestLeaderboardEntry(rankData, { isRank: true });
    const bestFloorEntry = getBestLeaderboardEntry(floorData, { isFloor: true });

    return {
      userScores,
      playerName,
      maxRankPoints,
      maxFloor,
      currentRankRecord: getUserProgressValue(userScores, bestRankEntry, { isRank: true }),
      currentFloorRecord: getUserProgressValue(userScores, bestFloorEntry, { isFloor: true })
    };
  }

  function createLeaderboardSections(tickData, rankData, floorData) {
    const ctx = getLeaderboardRenderContext(tickData, rankData, floorData);

    return {
      tickSection: createLeaderboardSection(
        tickData,
        LEADERBOARD_SECTION_CONFIG.time,
        ctx.userScores,
        ctx.playerName
      ),
      rankSection: createLeaderboardSection(
        rankData,
        LEADERBOARD_SECTION_CONFIG.rank,
        ctx.userScores,
        ctx.playerName,
        ctx.maxRankPoints,
        ctx.currentRankRecord
      ),
      floorSection: createLeaderboardSection(
        floorData,
        LEADERBOARD_SECTION_CONFIG.floor,
        ctx.userScores,
        ctx.playerName,
        ctx.maxFloor,
        ctx.currentFloorRecord,
        tickData
      )
    };
  }

  function getSectionUserValue(config, userScores) {
    if (config.isFloor) {
      return userScores?.bestFloor !== null && userScores?.bestFloor !== undefined
        ? userScores.bestFloor
        : 0;
    }
    if (config.isRank) {
      return userScores?.bestRank;
    }
    return userScores?.bestTicks;
  }

  function createLegacyWarningIcon() {
    const warningIcon = document.createElement('span');
    warningIcon.innerHTML = '⚠️';
    warningIcon.title = 'Legacy';
    Object.assign(warningIcon.style, {
      cursor: 'help',
      fontSize: '10px',
      lineHeight: '1',
      flexShrink: '0'
    });
    return warningIcon;
  }

  function appendUserScoreEntry(section, config, userScores, { isLegacy, userTiesWorldRecord, userValue }) {
    const userEntrySpan = document.createElement('span');
    Object.assign(userEntrySpan.style, ENTRY_SPAN_STYLE, {
      color: isLegacy ? UI_CONFIG.COLORS.LEGACY : (userTiesWorldRecord ? '#00ff00' : '#ffa500'),
      cursor: isLegacy ? 'help' : 'default'
    });
    if (isLegacy) {
      userEntrySpan.title = 'Legacy';
      userEntrySpan.appendChild(createLegacyWarningIcon());
    } else {
      userEntrySpan.appendChild(createScoreIcon(
        ASSETS.ACHIEVEMENT_ICON,
        'You',
        'Your personal best record'
      ));
    }

    let userDisplayValue = userValue;
    if (config.isFloor && userScores?.bestFloorTicks !== null && userScores?.bestFloorTicks !== undefined) {
      userDisplayValue += ` (${userScores.bestFloorTicks})`;
    } else if (config.isRank && userScores?.bestRankTicks !== null && userScores?.bestRankTicks !== undefined) {
      userDisplayValue += ` (${userScores.bestRankTicks})`;
    }
    const valueText = document.createElement('span');
    valueText.textContent = userDisplayValue;
    userEntrySpan.appendChild(valueText);

    section.appendChild(userEntrySpan);
  }

  function appendWorldRecordEntry(section, entry, config, tickData, index = 0) {
    const bestTickEntry = tickData && tickData.length > 0 ? getBestLeaderboardEntry(tickData, {}) : null;
    const fallbackTick = (config.isFloor && entry.floor === 0 && bestTickEntry)
      ? bestTickEntry.ticks
      : null;
    const formattedEntry = formatLeaderboardEntry(entry, index, config.isRank, config.isFloor, fallbackTick);
    const entrySpan = document.createElement('span');
    Object.assign(entrySpan.style, ENTRY_SPAN_STYLE, {
      color: formattedEntry.color,
      fontWeight: formattedEntry.fontWeight
    });

    entrySpan.appendChild(createScoreIcon(
      formattedEntry.isCurrentUser ? ASSETS.ACHIEVEMENT_ICON : ASSETS.HIGHSCORE_ICON,
      formattedEntry.isCurrentUser ? 'You' : 'Top',
      formattedEntry.isCurrentUser ? 'Your personal best record' : 'World record holder'
    ));

    const valueText = document.createElement('span');
    valueText.textContent = formattedEntry.value;
    entrySpan.appendChild(valueText);

    section.appendChild(entrySpan);
  }

  function appendWorldRecordPlaceholder(section) {
    const entrySpan = document.createElement('span');
    Object.assign(entrySpan.style, ENTRY_SPAN_STYLE, { color: '#888' });

    entrySpan.appendChild(createScoreIcon(
      ASSETS.HIGHSCORE_ICON,
      'Top',
      'No public world record yet',
      0.45
    ));

    const valueText = document.createElement('span');
    valueText.textContent = '—';
    entrySpan.appendChild(valueText);

    section.appendChild(entrySpan);
  }

  // Helper function to create a leaderboard section (tick, rank, or floor)
  function createLeaderboardSection(data, config, userScores, playerName, maxValue = null, currentValue = null, tickData = null) {
    if (config.isFloor && isTblMapActive()) {
      return createTblFloorLeaderboardSection();
    }

    const section = document.createElement('div');
    Object.assign(section.style, SECTION_WRAPPER_STYLE);

    const titleText = document.createElement('span');
    Object.assign(titleText.style, {
      fontWeight: 'bold',
      color: config.titleColor,
      fontSize: '10px'
    });
    titleText.textContent = config.displayName || config.title;
    section.appendChild(titleText);

    const shouldShowMax = maxValue !== null && currentValue !== null;
    if (shouldShowMax) {
      const maxDisplay = document.createElement('span');
      const isMaxAchieved = currentValue === maxValue;
      Object.assign(maxDisplay.style, {
        fontSize: '10px',
        color: isMaxAchieved ? '#00ff00' : '#ff4444',
        fontWeight: 'bold'
      });
      maxDisplay.textContent = `(${currentValue}/${maxValue})`;
      section.appendChild(maxDisplay);
    }

    const wrEntry = data && data.length > 0 ? getBestLeaderboardEntry(data, config) : null;
    const userValue = getSectionUserValue(config, userScores);
    const playerUserId = getPlayerSnapshot()?.context?.userId;
    const isLegacy = isLegacyHighscore(userScores, wrEntry, config, playerUserId);

    if (wrEntry) {
      const userHoldsWorldRecord = userBeatsOrTiesWorldRecord(userScores, wrEntry, config) && !isLegacy;
      const userTiesWorldRecord = scoresAreEqual(userScores, wrEntry, config);
      const shouldShowUserValue = config.isFloor
        ? (!userHoldsWorldRecord || isLegacy)
        : (userValue !== null && userValue !== undefined && (!userHoldsWorldRecord || isLegacy));

      if (shouldShowUserValue) {
        appendUserScoreEntry(section, config, userScores, { isLegacy, userTiesWorldRecord, userValue });
      }

      const topEntry = isLegacy
        ? wrEntry
        : buildTopDisplayEntry(wrEntry, userScores, config, playerName);
      if (topEntry) {
        appendWorldRecordEntry(section, topEntry, config, tickData);
      } else {
        appendWorldRecordPlaceholder(section);
      }
    } else {
      const shouldShowUserValue = config.isFloor
        ? true
        : (userValue !== null && userValue !== undefined);

      if (shouldShowUserValue) {
        appendUserScoreEntry(section, config, userScores, {
          isLegacy,
          userTiesWorldRecord: false,
          userValue
        });
      }

      appendWorldRecordPlaceholder(section);
    }

    if (config.isFloor) {
      decorateTblFloorSection(section, userScores);
    }

    return section;
  }

  // Function to update existing leaderboard display with new data (no flickering)
  function updateLeaderboardData(tickData, rankData, floorData) {
    if (!leaderboardContainer || !leaderboardContainer.isConnected) {
      return false; // No container to update
    }
    
    const contentDiv = leaderboardContainer._contentDiv || 
                       leaderboardContainer.querySelector('div[style*="position: relative"]');
    if (!contentDiv || !contentDiv.isConnected) {
      return false; // Can't find content container
    }

    const renderCtx = getLeaderboardRenderContext(tickData, rankData, floorData);
    const sectionPayloads = [
      { key: 'time', data: tickData, config: LEADERBOARD_SECTION_CONFIG.time, maxValue: null, currentValue: null, tickFallback: null },
      { key: 'rank', data: rankData, config: LEADERBOARD_SECTION_CONFIG.rank, maxValue: renderCtx.maxRankPoints, currentValue: renderCtx.currentRankRecord, tickFallback: null },
      { key: 'floor', data: floorData, config: LEADERBOARD_SECTION_CONFIG.floor, maxValue: renderCtx.maxFloor, currentValue: renderCtx.currentFloorRecord, tickFallback: tickData }
    ];
    
    // Get the three sections (tick, rank, floor)
    const sections = contentDiv.children;
    if (sections.length < 3) {
      return false; // Structure doesn't match
    }
    
    // Helper to update a section
    const updateSection = (section, visible, payload) => {
      if (!section || !section.isConnected) {
        return;
      }

      if (!visible) {
        section.style.display = 'none';
        while (section.firstChild) {
          section.removeChild(section.firstChild);
        }
        return;
      }

      // Clear existing content except structure markers
      // Guard against concurrent DOM ownership changes (Next/React + mod updates)
      while (section.firstChild) {
        const child = section.firstChild;
        if (!child || child.parentNode !== section) {
          break;
        }
        section.removeChild(child);
      }

      const newSection = createLeaderboardSection(
        payload.data || [],
        payload.config,
        renderCtx.userScores,
        renderCtx.playerName,
        payload.maxValue,
        payload.currentValue,
        payload.tickFallback
      );

      // Copy children from new section to existing section
      while (newSection.firstChild) {
        section.appendChild(newSection.firstChild);
      }

      Object.assign(section.style, SECTION_WRAPPER_STYLE);
    };
    
    sectionPayloads.forEach((payload, index) => {
      updateSection(sections[index], isSectionVisible(payload.key), payload);
    });

    applySectionVisibility(contentDiv);
    applyContentContainerStyles(contentDiv);
    resetBackgroundSizing(leaderboardContainer);
    
    return true;
  }

  // Function to create leaderboard display
  function createLeaderboardDisplay(tickData, rankData, floorData, mapName) {
    // Get opacity from config
    const opacity = getBackgroundOpacity();
    
    // Create wrapper container for positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'better-highscores-container';
    applyContainerStyles(wrapper);
    // Ensure wrapper has highest z-index to always be on top
    wrapper.style.zIndex = UI_CONFIG.CONTAINER_STYLE.zIndex || '999999';
    
    // Create background div with opacity
    const backgroundDiv = document.createElement('div');
    Object.assign(backgroundDiv.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")',
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      opacity: opacity,
      borderRadius: '4px',
      zIndex: '0',
      pointerEvents: 'none'
    });
    wrapper.appendChild(backgroundDiv);
    
    // Create content container
    const container = document.createElement('div');
    applyContentContainerStyles(container);

    const onContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      createBetterHighscoresContextMenu(wrapper, e.clientX, e.clientY);
    };
    container.addEventListener('contextmenu', onContextMenu);
    
    // Store references for opacity updates
    wrapper._backgroundDiv = backgroundDiv;
    wrapper._contentDiv = container;
    wrapper._contextMenuHandler = onContextMenu;
    
    const { tickSection, rankSection, floorSection } = createLeaderboardSections(tickData, rankData, floorData);
    
    // Append all sections to container
    container.appendChild(tickSection);
    container.appendChild(rankSection);
    container.appendChild(floorSection);
    applySectionVisibility(container);
    
    // Append content container to wrapper
    wrapper.appendChild(container);
    resetBackgroundSizing(wrapper);
    
    return wrapper;
  }

  // Function to update leaderboards
  async function updateLeaderboards() {
    if (modDisposed) {
      return;
    }

    console.log('[Better Highscores] updateLeaderboards called');

    if (isBetterHighscoresHidden()) {
      if (leaderboardContainer) {
        detachLeaderboardContainer(leaderboardContainer);
        leaderboardContainer = null;
      }
      removeExistingContainers();
      showRestoreButton();
      return;
    }

    removeRestoreButton();
    
    if (BetterHighscoresState.isUpdating) {
      BetterHighscoresState.pendingUpdateAfterCurrent = true;
      return;
    }
    
    // Skip updates during board analysis to prevent spam
    if (isBoardAnalyzing()) {
      console.log('[Better Highscores] Board analysis in progress, skipping update');
      return;
    }
    
    const currentlyInSandbox = isSandboxMode();
    
    // Handle sandbox mode entry (preserve container when first entering)
    if (currentlyInSandbox && !BetterHighscoresState.wasInSandboxMode) {
      console.log('[Better Highscores] Just entered sandbox mode, preserving container');
      preserveContainer();
    }

    try {
      BetterHighscoresState.isUpdating = true;
      
      const mapCode = getCurrentMapCode();
      console.log('[Better Highscores] Detected map code:', mapCode);
      
      if (!mapCode) {
        console.log('[Better Highscores] No current map code found');
        return;
      }

      const shouldForceRefresh =
        Date.now() - BetterHighscoresState.lastBattleCompletionAt < DELAYS.POST_BATTLE_FRESH_WINDOW;
      
      // Throttle updates to prevent spam, but never skip when fresh world-record data is needed.
      if (mapCode === currentMapCode && 
          leaderboardContainer && 
          !shouldForceRefresh &&
          shouldThrottle(BetterHighscoresState.lastUpdateTime, DELAYS.UPDATE_THROTTLE)) {
        console.log('[Better Highscores] Skipping update - same map and recent data');
        return;
      }
      
      const mapName = getMapName(mapCode);
      
      const { tickData, rankData, floorData } = await fetchLeaderboardData(mapCode, shouldForceRefresh);

      if (modDisposed) {
        return;
      }

      const latestMapCode = getCurrentMapCode();
      if (latestMapCode && latestMapCode !== mapCode) {
        console.log(`[Better Highscores] Map changed during fetch (${mapCode} -> ${latestMapCode}), scheduling retry`);
        BetterHighscoresState.pendingUpdateAfterCurrent = true;
        return;
      }
      
      // Check if we can update in place (same map, container exists in DOM)
      const mapChanged = mapCode !== currentMapCode;
      const canUpdateInPlace = !mapChanged && 
                                leaderboardContainer && 
                                document.contains(leaderboardContainer);
      
      if (canUpdateInPlace) {
        // Update existing container in place (no flickering)
        console.log('[Better Highscores] Updating existing container in place');
        const updated = updateLeaderboardData(tickData, rankData, floorData);
        if (updated) {
          applyContainerStyles(leaderboardContainer);
          currentMapCode = mapCode;
          BetterHighscoresState.lastUpdateTime = Date.now();
          if (isTblMapActive()) {
            scheduleTblFloorBarRefresh();
          }
          handleSuccess();
          return;
        }
        // If update failed, fall through to recreate
        console.log('[Better Highscores] In-place update failed, recreating container');
      }
      
      // Map changed or container doesn't exist - recreate container
      currentMapCode = mapCode;
      BetterHighscoresState.lastUpdateTime = Date.now();
      
      // Remove existing container and any duplicate containers
      if (leaderboardContainer) {
        detachLeaderboardContainer(leaderboardContainer);
        leaderboardContainer = null;
      }
      
      // Also remove any other containers with the same class to prevent duplicates
      const count = removeExistingContainers();
      if (count > 0) {
        console.log(`[Better Highscores] Removing ${count} existing containers`);
      }
      
      // Create new container
      leaderboardContainer = createLeaderboardDisplay(tickData, rankData, floorData, mapName);
      console.log('[Better Highscores] Created leaderboard container:', leaderboardContainer);
      
      // Find the main game container and append
      const mainContainer = getMainContainer();
      console.log('[Better Highscores] Main container found:', mainContainer);
      
      if (mainContainer) {
        console.log('[Better Highscores] Appending leaderboard container to main container');
        mainContainer.appendChild(leaderboardContainer);
        console.log('[Better Highscores] Leaderboard container appended successfully');
      } else {
        console.error('[Better Highscores] Could not find main container for leaderboard injection');
      }
      
      console.log(`[Better Highscores] Updated leaderboards for map: ${mapName} (${mapCode})`);
      
      // Success - reset error state
      handleSuccess();
      
    } catch (error) {
      const errorResult = handleError(error, 'updateLeaderboards');
      
      if (errorResult.shouldStop) {
        console.warn(`[Better Highscores] Stopping leaderboard updates: ${errorResult.reason}`);
        return;
      }
      
      // For recoverable errors, log and continue
      console.warn('[Better Highscores] Recoverable error occurred:', error.message);
    } finally {
      BetterHighscoresState.isUpdating = false;
      if (BetterHighscoresState.pendingUpdateAfterCurrent) {
        BetterHighscoresState.pendingUpdateAfterCurrent = false;
        scheduleTimeout(() => updateLeaderboards(), 0);
      }
    }
  }

// =======================
// MODULE 7: Initialization & Cleanup
// =======================
  function getPrimaryGameNavUl() {
    const headerSlot = document.getElementById('header-slot');
    const nav =
      headerSlot?.querySelector('nav') ||
      document.querySelector('nav.shrink-0') ||
      document.querySelector('nav.grow') ||
      document.querySelector('div.z-floatingHud nav');
    if (!nav) {
      return null;
    }
    return nav.querySelector('ul.flex.items-center') || null;
  }

  function syncNavButtonSelectedState() {
    const btn = document.querySelector('.better-highscores-nav-btn');
    if (btn) {
      btn.setAttribute('data-selected', modSettings.hidden ? 'false' : 'true');
    }
  }

  function setHighscoresHidden(hidden) {
    modSettings.hidden = hidden === true;
    saveSettings();
    syncNavButtonSelectedState();
    updateLeaderboards();
  }

  function toggleHighscoresFromNavButton(event) {
    if (event) {
      event.stopPropagation();
    }
    setHighscoresHidden(!modSettings.hidden);
    console.log('[Better Highscores] Panel', modSettings.hidden ? 'hidden' : 'shown');
  }

  function addHighscoresNavButton() {
    const tryInsert = () => {
      const ul = getPrimaryGameNavUl();
      if (!ul) {
        scheduleTimeout(tryInsert, 500);
        return;
      }

      if (ul.querySelector('.better-highscores-nav-btn')) {
        syncNavButtonSelectedState();
        return;
      }

      const autosellerBtn = ul.querySelector('.autoseller-nav-btn');
      if (!autosellerBtn) {
        scheduleTimeout(tryInsert, 500);
        return;
      }

      const autosellerLi = autosellerBtn.closest('li');
      if (!autosellerLi) {
        scheduleTimeout(tryInsert, 500);
        return;
      }

      const li = document.createElement('li');
      li.className = 'hover:text-whiteExp';

      const btn = document.createElement('button');
      btn.className = 'better-highscores-nav-btn focus-style-visible pixel-font-16 relative my-px flex items-center gap-1.5 border border-solid border-transparent px-1 py-0.5 active:frame-pressed-1 data-[selected="true"]:frame-pressed-1 hover:text-whiteExp data-[selected="true"]:text-whiteExp sm:px-2 sm:py-0.5';
      btn.innerHTML = `<img src="https://bestiaryarena.com/assets/icons/achievement.png" alt="${t('mods.betterUI.betterHighscoresButton')}" width="12" height="12" class="pixelated"><span class="hidden sm:inline">${t('mods.betterUI.betterHighscoresButton')}</span>`;
      btn.onclick = toggleHighscoresFromNavButton;

      li.appendChild(btn);
      syncNavButtonSelectedState();

      if (autosellerLi.nextSibling) {
        ul.insertBefore(li, autosellerLi.nextSibling);
      } else {
        ul.appendChild(li);
      }

      console.log('[Better Highscores] Nav button inserted after Autoseller');
    };

    tryInsert();
  }

  function removeHighscoresNavButton() {
    const btn = document.querySelector('.better-highscores-nav-btn');
    const li = btn?.closest('li');
    if (li) {
      li.remove();
      console.log('[Better Highscores] Nav button removed');
    }
  }

  function applyNavButtonVisibility() {
    if (modSettings.showNavButton !== false) {
      addHighscoresNavButton();
    } else {
      removeHighscoresNavButton();
    }
    syncNavButtonSelectedState();
  }

  // Function to initialize the mod
  function initBetterHighscores() {
    console.log('[Better Highscores] Initializing version 1.0.0');
    scheduleTimeout(() => applyNavButtonVisibility(), 1500);
    
    // Wait for game state to be available
    let checkGameStateTimeout = null;
    const checkGameState = () => {
      if (modDisposed) {
        return;
      }

      if (globalThis.state && globalThis.state.board) {
        // Initial update
        updateLeaderboards();
        
        // Set up observer for map changes using board state
        const boardState = globalThis.state.board;
        const boardUnsubscribe = boardState.subscribe((state) => {
          // Skip updates during board analysis to prevent spam
          if (isBoardAnalyzing()) {
            return;
          }
          
          // Handle map changes and container updates
          const detectedMapCode = getCurrentMapCode();
          const mainContainer = getMainContainer();
          handleStateUpdate(detectedMapCode, mainContainer);
          
          // Check for sandbox mode changes
          const currentMode = state.context?.mode;
          const wasInSandbox = BetterHighscoresState.wasInSandboxMode;
          const isInSandbox = currentMode === 'sandbox';
          
          if (isInSandbox && !wasInSandbox) {
            // Just entered sandbox mode
            console.log('[Better Highscores] Entered sandbox mode, preserving container');
            preserveContainer();
          } else if (!isInSandbox && wasInSandbox) {
            // Just exited sandbox mode
            console.log('[Better Highscores] Exited sandbox mode');
            
            // Always update leaderboards when exiting sandbox mode
            console.log('[Better Highscores] Exiting sandbox mode, updating leaderboards with current map');
            BetterHighscoresState.preservedContainer = null;
            BetterHighscoresState.wasInSandboxMode = false;
            updateLeaderboards();
          }
        });
         
         // Store subscription for cleanup
         BetterHighscoresState.subscriptions.push(boardUnsubscribe);
        
        // Also listen for game state changes as backup
        if (globalThis.state.game) {
          const gameUnsubscribe = globalThis.state.game.subscribe((state) => {
            // Skip updates during board analysis to prevent spam
            if (isBoardAnalyzing()) {
              return;
            }
            
            // Handle map changes and container updates
            const detectedMapCode = getCurrentMapCode();
            const mainContainer = getMainContainer();
            handleStateUpdate(detectedMapCode, mainContainer);
          });
          
          // Store subscription for cleanup
          BetterHighscoresState.subscriptions.push(gameUnsubscribe);
        }
        
        // Listen for game timer changes to detect battle completion
        if (globalThis.state.gameTimer) {
          let previousState = 'initial';
          
          const gameTimerUnsubscribe = globalThis.state.gameTimer.subscribe((state) => {
            const currentState = state.context.state;
            
            // Skip updates during board analysis to prevent spam and preserve container
            if (isBoardAnalyzing()) {
              return;
            }
            
            // Check if game just ended (victory/defeat states)
            if (currentState !== 'initial' && currentState !== 'playing') {
              handleBattleCompletion();
            }
            
            // Handle state transitions
            handleStateTransition(previousState, currentState);
            
            previousState = currentState;
          });
          
          // Store subscription for cleanup
          BetterHighscoresState.subscriptions.push(gameTimerUnsubscribe);
        }

        if (globalThis.state.player?.subscribe) {
          const playerUnsubscribe = globalThis.state.player.subscribe(() => {
            handlePlayerScoreUpdate();
          });
          BetterHighscoresState.subscriptions.push(playerUnsubscribe);
          resetTrackedUserScores(getCurrentMapCode());
        }
        
        // Set up MutationObserver to detect when leaderboard gets removed from DOM
        window.BetterHighscoresInternals = window.BetterHighscoresInternals || {};
        window.BetterHighscoresInternals.observer = new MutationObserver((mutations) => {
          if (!isAutoplayMode()) return;
          
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              for (const removedNode of mutation.removedNodes) {
                if (removedNode === leaderboardContainer || 
                    (removedNode.nodeType === Node.ELEMENT_NODE && 
                     removedNode.contains && removedNode.contains(leaderboardContainer))) {
                  console.log('[Better Highscores] Leaderboard removed from DOM during autoplay, restoring');
                  scheduleTimeout(() => {
                    updateLeaderboards();
                  }, DELAYS.MUTATION_RESTORE);
                  break;
                }
              }
            }
          }
        });
        
        // Observe the document body for leaderboard removal
        window.BetterHighscoresInternals.observer.observe(document.body, { 
          childList: true, 
          subtree: true 
        });
        
        console.log('[Better Highscores] Initialization complete');
        initTblFloorLeague();
      } else {
        // Retry after a short delay
        checkGameStateTimeout = scheduleTimeout(checkGameState, DELAYS.RETRY);
        window.betterHighscoresCheckGameStateTimeout = checkGameStateTimeout;
      }
    };
    
    checkGameState();
    
    return {
      name: context.modName,
      version: context.modVersion,
      description: context.modDescription,
      status: 'active'
    };
  }

  function detachLeaderboardContainer(container) {
    if (!container) {
      return;
    }

    const contentDiv = container._contentDiv;
    if (contentDiv && container._contextMenuHandler) {
      contentDiv.removeEventListener('contextmenu', container._contextMenuHandler);
      container._contextMenuHandler = null;
    }

    try {
      container.remove();
    } catch (error) {
      console.warn('[Better Highscores] Error removing leaderboard container:', error);
    }
  }

  function cleanup() {
    console.log('[Better Highscores] Cleaning up...');
    modDisposed = true;

    cleanupTblFloorLeague();
    closeBetterHighscoresContextMenu();
    removeRestoreButton();
    removeHighscoresNavButton();
    
    // Remove leaderboard container
    detachLeaderboardContainer(leaderboardContainer);
    leaderboardContainer = null;
    currentMapCode = null;
    roomNames = null;
    lastTrackedMapCode = null;
    lastTrackedUserScores = null;
    
    // Clean up state subscriptions
    BetterHighscoresState.subscriptions.forEach(unsubscribe => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        console.warn('[Better Highscores] Error unsubscribing:', error);
      }
    });
    
    clearDebounceTimeout('mapChangeDebounceTimeout');
    clearDebounceTimeout('containerDebounceTimeout');
    BetterHighscoresState.pendingMapCode = null;
    BetterHighscoresState.pendingUpdateAfterCurrent = false;

    // Reset state
    BetterHighscoresState.reset();
    
    // Clear all tracked timeouts
    BetterHighscoresState.clearTimeouts();
    
    // Clear checkGameState timeout if it exists
    if (window.betterHighscoresCheckGameStateTimeout) {
      clearTimeout(window.betterHighscoresCheckGameStateTimeout);
      window.betterHighscoresCheckGameStateTimeout = null;
    }
    
    // Clean up observer
    if (window.BetterHighscoresInternals?.observer) {
      window.BetterHighscoresInternals.observer.disconnect();
      window.BetterHighscoresInternals.observer = null;
    }

    // Clean up global window objects
    if (window.BetterHighscores) {
      delete window.BetterHighscores;
    }
    
    if (window.BetterHighscoresInternals) {
      delete window.BetterHighscoresInternals;
    }
    
    console.log('[Better Highscores] Cleanup complete');
  }

  // =======================
  // MODULE INITIALIZATION
  // =======================
  function initializeBetterHighscores() {
    console.log('[Better Highscores] Starting initialization...');
    
    if (config.enabled) {
      initBetterHighscores();
    } else {
      console.log('[Better Highscores] Disabled in configuration');
    }
  }
  
  // Start initialization
  initializeBetterHighscores();
  
  // Export control functions
  if (typeof exports !== 'undefined') {
    exports.cleanup = cleanup;
    exports.updateLeaderboards = updateLeaderboards;
    exports.restoreContainer = restoreContainer;
    exports.preserveContainer = preserveContainer;
    exports.updatePlacement = updatePlacement;
    exports.updateScale = updateScale;
    exports.modName = context.modName;
    exports.modVersion = context.modVersion;
  }
  
  // Function to update opacity of existing container
  function updateOpacity(opacity) {
    if (leaderboardContainer && leaderboardContainer._backgroundDiv) {
      leaderboardContainer._backgroundDiv.style.opacity = opacity;
    } else if (leaderboardContainer) {
      // Container exists but doesn't have the new structure, recreate it
      console.log('[Better Highscores] Container structure outdated, updating leaderboards');
      updateLeaderboards();
    }
  }

  function updatePlacement() {
    if (isBetterHighscoresHidden()) {
      return;
    }

    if (leaderboardContainer && document.contains(leaderboardContainer)) {
      applyContainerStyles(leaderboardContainer);
      return;
    }

    updateLeaderboards();
  }

  function updateScale() {
    if (isBetterHighscoresHidden()) {
      return;
    }

    if (leaderboardContainer && document.contains(leaderboardContainer)) {
      applyContainerStyles(leaderboardContainer);
      return;
    }

    updateLeaderboards();
  }
  
  if (typeof window !== 'undefined') {
    window.BetterHighscores = window.BetterHighscores || {};
    window.BetterHighscores.cleanup = cleanup;
    window.BetterHighscores.updateLeaderboards = updateLeaderboards;
    window.BetterHighscores.restoreContainer = restoreContainer;
    window.BetterHighscores.preserveContainer = preserveContainer;
    window.BetterHighscores.updateOpacity = updateOpacity;
    window.BetterHighscores.updatePlacement = updatePlacement;
    window.BetterHighscores.updateScale = updateScale;
    window.BetterHighscores.debug = {
      getCurrentMapCode: getCurrentMapCode,
      getMapName: getMapName,
      getMainContainer: getMainContainer,
      isSandboxMode: isSandboxMode,
      forceUpdate: () => {
        console.log('[Better Highscores] Force update triggered');
        updateLeaderboards();
      },
      forceRestore: () => {
        console.log('[Better Highscores] Force restore triggered');
        restoreContainer();
      },
      forcePreserve: () => {
        console.log('[Better Highscores] Force preserve triggered');
        preserveContainer();
      },
      getState: () => {
        return {
          leaderboardContainer: !!leaderboardContainer,
          preservedContainer: !!BetterHighscoresState.preservedContainer,
          wasInSandboxMode: BetterHighscoresState.wasInSandboxMode,
          isSandboxMode: isSandboxMode(),
          isBoardAnalyzing: isBoardAnalyzing(),
          currentMapCode: currentMapCode,
          detectedMapCode: getCurrentMapCode()
        };
      }
    };
  }

})();

