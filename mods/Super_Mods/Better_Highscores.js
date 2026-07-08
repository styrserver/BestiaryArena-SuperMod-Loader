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
// MODULE 1b: Event Competition adapter (Tibia Ball League / wcfield)
// =======================
  const TBL_EVENT_ID = 'tbl-wcfield';
  const TBL_EVENT_CONFIG = {
    id: TBL_EVENT_ID,
    roomId: 'wcfield',
    firebaseBase: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app/events',
    joinStorageKey: 'better-highscores-tbl-joined',
    i18nPrefix: 'mods.betterUI.tblLeague',
    logPrefix: '[Better Highscores][TBL]',
    prizeBeastCoins: 500,
    missingFloorTicks: 9600,
    eventButtonIcon: 'https://bestiaryarena.com/assets/icons/wc-mini-icon.png',
    floorScaleColors: [
      '#97f7bc', '#65f19b', '#3acb71', '#4dcb7e', '#28d269',
      '#27b45d', '#9b8a41', '#c2ad51', '#c3a937', '#b99e22',
      '#ae900a', '#b85151', '#c74848', '#cc2e2e', '#d01616', '#e80202'
    ],
    tabIcons: {
      rank: { src: '/assets/icons/star-tier.png', alt: 'Rank' },
      floor: { src: '/assets/icons/speed.png', alt: 'Ticks' }
    },
    isPlayerEligible: async (playerName) => {
      if (!playerName) {
        return false;
      }
      const adminApi = window.FirebaseAdminsAPI;
      if (typeof adminApi?.isPlayerAdminAsync === 'function') {
        return !(await adminApi.isPlayerAdminAsync(playerName));
      }
      if (typeof adminApi?.isPlayerAdmin === 'function') {
        return !adminApi.isPlayerAdmin(playerName);
      }
      return true;
    },
    floors: {
      min: 0,
      max: 15,
      firebaseMin: 1,
      firebaseMax: 14,
      highscore: [0, 15],
      highscoreRank: [0, 15]
    },
    modal: {
      id: 'better-highscores-tbl-modal',
      stylesId: 'better-highscores-tbl-styles'
    },
    toast: {
      containerId: 'better-highscores-tbl-toast-container'
    }
  };

  let tblEventCompetitionInstance = null;

  function waitForEventCompetition(maxAttempts = 40, intervalMs = 50) {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (window.EventCompetition) {
          resolve(window.EventCompetition);
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          resolve(null);
          return;
        }
        scheduleTimeout(check, intervalMs);
      };
      check();
    });
  }

  function buildTblEventCompetitionDeps() {
    return {
      getCurrentMapCode,
      getPlayerSnapshot,
      isDisposed: () => modDisposed,
      getLeaderboardContainer: () => leaderboardContainer,
      getUserBestScores,
      isSandboxMode,
      fetchLeaderboardData,
      getBestLeaderboardEntry,
      getEntryFloorTicks,
      scheduleTimeout,
      onLeaderboardsUpdate: updateLeaderboards,
      t,
      getApi: () => context?.api || null,
      addSubscription: (subscription) => {
        BetterHighscoresState.subscriptions.push(subscription);
      },
      removeSubscription: (subscription) => {
        const index = BetterHighscoresState.subscriptions.indexOf(subscription);
        if (index >= 0) {
          BetterHighscoresState.subscriptions.splice(index, 1);
        }
      },
      getMedalColor,
      ui: {
        floorSectionConfig: LEADERBOARD_SECTION_CONFIG.floor,
        rankSectionConfig: LEADERBOARD_SECTION_CONFIG.rank,
        sectionWrapperStyle: SECTION_WRAPPER_STYLE,
        entrySpanStyle: ENTRY_SPAN_STYLE,
        assets: ASSETS,
        createScoreIcon,
        formatLeaderboardEntry,
        appendWorldRecordPlaceholder,
        applySectionVisibility
      }
    };
  }

  function getTblEventCompetitionInstanceSync() {
    if (tblEventCompetitionInstance) {
      return tblEventCompetitionInstance;
    }
    if (!window.EventCompetition) {
      return null;
    }
    const existing = window.EventCompetition.get(TBL_EVENT_ID);
    if (existing) {
      tblEventCompetitionInstance = existing;
      return existing;
    }
    tblEventCompetitionInstance = window.EventCompetition.register(
      TBL_EVENT_CONFIG,
      buildTblEventCompetitionDeps()
    );
    return tblEventCompetitionInstance;
  }

  async function ensureTblEventCompetition() {
    const syncInstance = getTblEventCompetitionInstanceSync();
    if (syncInstance) {
      return syncInstance;
    }
    const framework = await waitForEventCompetition();
    if (!framework) {
      console.warn('[Better Highscores][TBL] EventCompetition framework not available');
      return null;
    }
    return getTblEventCompetitionInstanceSync();
  }

  function decorateTblFloorSection(section, userScores) {
    const instance = getTblEventCompetitionInstanceSync();
    if (instance) {
      instance.decorateFloorSection(section, userScores);
      return;
    }
    ensureTblEventCompetition().then((loaded) => {
      loaded?.decorateFloorSection(section, userScores);
    }).catch(() => {});
  }

  function isTblMapActive(mapCode = getCurrentMapCode()) {
    const instance = getTblEventCompetitionInstanceSync();
    if (instance) {
      return instance.isMapActive(mapCode);
    }
    return mapCode === TBL_EVENT_CONFIG.roomId;
  }

  function createTblFloorLeaderboardSection() {
    const instance = getTblEventCompetitionInstanceSync();
    if (!instance) {
      const section = document.createElement('div');
      section.className = 'tbl-dynamic-floor-section';
      Object.assign(section.style, SECTION_WRAPPER_STYLE);
      return section;
    }
    return instance.createFloorLeaderboardSection();
  }

  function createTblRankLeaderboardSection() {
    const instance = getTblEventCompetitionInstanceSync();
    if (!instance) {
      const section = document.createElement('div');
      section.className = 'tbl-dynamic-rank-section';
      Object.assign(section.style, SECTION_WRAPPER_STYLE);
      return section;
    }
    return instance.createRankLeaderboardSection();
  }

  function scheduleTblFloorBarRefresh() {
    const instance = getTblEventCompetitionInstanceSync();
    instance?.scheduleFloorBarRefresh();
  }

  function trySubmitTblAfterBattle() {
    const instance = getTblEventCompetitionInstanceSync();
    instance?.trySubmitAfterBattle?.();
  }

  function initTblFloorLeague() {
    ensureTblEventCompetition().then((instance) => {
      instance?.init();
    }).catch(() => {});
  }

  function cleanupTblFloorLeague() {
    const instance = window.EventCompetition?.get(TBL_EVENT_ID) || tblEventCompetitionInstance;
    instance?.cleanup();
    tblEventCompetitionInstance = null;
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
    if (config.isRank && isTblMapActive()) {
      return createTblRankLeaderboardSection();
    }
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

