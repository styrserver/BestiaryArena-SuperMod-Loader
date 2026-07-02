// =======================
// 0. Metadata
// =======================
(function() {
'use strict';

// =======================
// 1. Configuration & Constants
// =======================
const MOD_ID = 'battle-helper';
const BUTTON_ID = 'battle-helper-button';
const PROFILE_API_BASE = 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData';

const MODAL_CONFIG = {
  width: 400,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 200
};
const BATTLE_HELPER_MODAL_ID = 'battle-helper-modal';
const BATTLE_HELPER_BUTTON_CLASS = {
  primary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  secondary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14'
};

const BATTLE_HELPER_BUTTON_IMPORTED_CLASS = 'battle-helper-button-imported';
const BATTLE_HELPER_BUTTON_STYLE_ID = 'battle-helper-button-styles';
const BATTLE_HELPER_FIELD_HEIGHT_PX = 25;
const BATTLE_HELPER_OUTPUT_HEIGHT_PX = 110;
const BATTLE_HELPER_SCROLLBAR_GUTTER_PX = 12;
const BATTLE_HELPER_FETCH_MIN_INTERVAL_MS = 400;
const BATTLE_HELPER_TOAST_CONTAINER_ID = 'battle-helper-toast-container';
const BATTLE_HELPER_PROFILE_URL_BASE = 'https://bestiaryarena.com/profile/';

const DEFAULT_MONSTER_STAT = 1;
const DEFAULT_MONSTER_EXP = 0;
const DEFAULT_EQUIP_STAT = 'ad';
const VALID_EQUIP_STATS = new Set(['ad', 'ap', 'hp']);

const t = (key) => {
  if (typeof api !== 'undefined' && api.i18n?.t) {
    return api.i18n.t(key);
  }
  if (typeof context !== 'undefined' && context.api?.i18n?.t) {
    return context.api.i18n.t(key);
  }
  return key;
};

const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  });
  return text;
};

function formatProfileDisplayName(name) {
  const raw = String(name || '').trim();
  return raw || t('mods.battleHelper.unknown');
}

function getProfileReplacedOutput() {
  return `${t('mods.battleHelper.output.profileReplaced')}\n${t('mods.battleHelper.output.dragDropHint')}`;
}

function getNoProfileFetchedOutput() {
  return `${t('mods.battleHelper.output.ready')}\n${t('mods.battleHelper.output.noProfileFetched')}`;
}

function getEnterUsernameFirstOutput() {
  return `${t('mods.battleHelper.output.enterUsernameFirst')}\n${t('mods.battleHelper.output.noProfileFetched')}`;
}

function getFetchFailedOutput(error) {
  return `${tReplace('mods.battleHelper.output.fetchFailed', {
    error: String(error?.message || error)
  })}\n${t('mods.battleHelper.output.noProfileFetched')}`;
}

// =======================
// 2. Utilities & Validation Helpers
// =======================
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function snapBattleHelperModalPx(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function getModalDimensions() {
  const pad = MODAL_CONFIG.viewportPadding * 2;
  return {
    width: snapBattleHelperModalPx(Math.max(
      MODAL_CONFIG.minWidth,
      Math.min(MODAL_CONFIG.width, window.innerWidth - pad)
    )),
    maxHeight: snapBattleHelperModalPx(Math.max(
      MODAL_CONFIG.minHeight,
      window.innerHeight - pad
    ))
  };
}

function isSandboxEnabled() {
  try {
    const playerCtx = globalThis.state?.player?.getSnapshot?.()?.context;
    if (!playerCtx) return false;
    const flags = new globalThis.state.utils.Flags(playerCtx.flags);
    return flags.isSet('sandbox');
  } catch (error) {
    console.warn('[Battle Helper] Could not check sandbox mode:', error);
    return false;
  }
}

function ensureSandboxPlayMode() {
  try {
    const board = globalThis.state?.board;
    if (!board?.send) return false;
    const currentMode = board.getSnapshot?.()?.context?.mode;
    if (currentMode === 'sandbox') return false;
    board.send({ type: 'setPlayMode', mode: 'sandbox' });
    return true;
  } catch (error) {
    console.warn('[Battle Helper] Could not set sandbox play mode:', error);
    return false;
  }
}

function buildProfileRequestUrl(username) {
  const input = encodeURIComponent(JSON.stringify({
    0: { json: username }
  }));
  return `${PROFILE_API_BASE}?batch=1&input=${input}`;
}

function normalizeEquips(rawEquips) {
  const equips = [];
  for (const equip of rawEquips) {
    if (typeof equip?.id !== 'string') continue;
    const gameId = parseFiniteNumber(equip.gameId, NaN);
    if (!Number.isFinite(gameId)) continue;
    const tier = clamp(parseFiniteNumber(equip.tier, 1), 1, 5);
    const stat = VALID_EQUIP_STATS.has(equip.stat) ? equip.stat : DEFAULT_EQUIP_STAT;
    equips.push({
      id: equip.id,
      gameId,
      stat,
      tier
    });
  }
  return equips;
}

function normalizeMonsters(rawMonsters, validEquipIds) {
  const monsters = [];

  for (const monster of rawMonsters) {
    if (typeof monster?.id !== 'string') continue;
    const gameId = parseFiniteNumber(monster.gameId, NaN);
    if (!Number.isFinite(gameId)) continue;

    const normalized = {
      id: monster.id,
      gameId,
      hp: parseFiniteNumber(monster.hp, DEFAULT_MONSTER_STAT),
      ad: parseFiniteNumber(monster.ad, DEFAULT_MONSTER_STAT),
      ap: parseFiniteNumber(monster.ap, DEFAULT_MONSTER_STAT),
      armor: parseFiniteNumber(monster.armor, DEFAULT_MONSTER_STAT),
      magicResist: parseFiniteNumber(monster.magicResist, DEFAULT_MONSTER_STAT),
      exp: parseFiniteNumber(monster.exp, DEFAULT_MONSTER_EXP),
      tier: parseFiniteNumber(monster.tier, 1),
      locked: Boolean(monster.locked),
      createdAt: parseFiniteNumber(monster.createdAt, Date.now())
    };

    if (typeof monster.equipId === 'string' && validEquipIds.has(monster.equipId)) {
      normalized.equipId = monster.equipId;
    }

    monsters.push(normalized);
  }

  return monsters;
}

function normalizeProfileArsenal(profile) {
  const equips = normalizeEquips(Array.isArray(profile?.equips) ? profile.equips : []);
  const equipIdSet = new Set(equips.map((equip) => equip.id));
  const monstersInput = Array.isArray(profile?.monsters) ? profile.monsters : [];
  const monsters = normalizeMonsters(monstersInput, equipIdSet);

  return {
    profileName: String(profile?.name || '').trim(),
    monsters,
    equips
  };
}

// =======================
// 3. State & Session Backup
// =======================
const sessionState = {
  backup: null,
  lastProfileRaw: null,
  lastNormalized: null,
  lastUsername: '',
  replaced: false
};
let activeBattleHelperModal = null;
let battleHelperModalLayoutCleanup = null;
let battleHelperPersistentToastHandle = null;

function getPlayerContext() {
  const ctx = globalThis.state?.player?.getSnapshot?.()?.context;
  if (!ctx) {
    throw new Error(t('mods.battleHelper.errors.playerStateUnavailable'));
  }
  return ctx;
}

function makePlayerBackup() {
  const player = getPlayerContext();
  return {
    monsters: JSON.parse(JSON.stringify(Array.isArray(player.monsters) ? player.monsters : [])),
    equips: JSON.parse(JSON.stringify(Array.isArray(player.equips) ? player.equips : []))
  };
}

// =======================
// 4. API Layer
// =======================
let lastProfileFetchStartedAt = 0;
let profileFetchSlot = Promise.resolve();

function scheduleProfileFetch(task) {
  const scheduled = profileFetchSlot.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, BATTLE_HELPER_FETCH_MIN_INTERVAL_MS - (now - lastProfileFetchStartedAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastProfileFetchStartedAt = Date.now();
    return task();
  });
  profileFetchSlot = scheduled.catch(() => {});
  return scheduled;
}

async function fetchProfileByUsername(username) {
  return scheduleProfileFetch(async () => {
    const response = await fetch(buildProfileRequestUrl(username), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw new Error(tReplace('mods.battleHelper.errors.profileRequestFailed', {
        status: String(response.status)
      }));
    }

    const payload = await response.json();
    const profile = payload?.[0]?.result?.data?.json ?? null;
    if (!profile) {
      throw new Error(t('mods.battleHelper.errors.profileNotFound'));
    }
    return profile;
  });
}

// =======================
// 5. Transform Layer
// =======================
function validateNormalizedArsenal(normalized) {
  if (!Array.isArray(normalized.monsters) || normalized.monsters.length === 0) {
    throw new Error(t('mods.battleHelper.errors.noUsableCreatures'));
  }
  if (!Array.isArray(normalized.equips) || normalized.equips.length === 0) {
    throw new Error(t('mods.battleHelper.errors.noUsableEquipment'));
  }
}

// =======================
// 6. Apply/Restore State Actions
// =======================
function applyArsenalReplacement(normalized) {
  if (!sessionState.backup) {
    sessionState.backup = makePlayerBackup();
  }

  globalThis.state.player.send({
    type: 'setState',
    fn: (prev) => ({
      ...prev,
      monsters: normalized.monsters,
      equips: normalized.equips
    })
  });

  sessionState.lastNormalized = normalized;
  sessionState.replaced = true;
  syncBattleHelperButtonState();
  startBattleHelperViewingProfileToast(normalized.profileName, sessionState.lastUsername);
}

function restoreOriginalArsenal() {
  if (!sessionState.backup) {
    throw new Error(t('mods.battleHelper.errors.noBackupAvailable'));
  }

  globalThis.state.player.send({
    type: 'setState',
    fn: (prev) => ({
      ...prev,
      monsters: sessionState.backup.monsters,
      equips: sessionState.backup.equips
    })
  });

  sessionState.replaced = false;
  syncBattleHelperButtonState();
  stopBattleHelperViewingProfileToast();
}

// =======================
// 6.5 Toast
// =======================
function getBattleHelperToastContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(BATTLE_HELPER_TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = BATTLE_HELPER_TOAST_CONTAINER_ID;
    container.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(container);
  }
  return container;
}

function updateBattleHelperToastPositions(container) {
  if (!container) return;
  const toasts = container.querySelectorAll('.battle-helper-toast-item');
  toasts.forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * 46}px)`;
  });
}

function buildBattleHelperProfileUrl(username) {
  const slug = encodeURIComponent(normalizeUsername(username));
  return `${BATTLE_HELPER_PROFILE_URL_BASE}${slug}`;
}

function populateBattleHelperToastMessage(messageDiv, profileName, username) {
  const displayName = formatProfileDisplayName(profileName || username);
  const profileSlug = normalizeUsername(username) || displayName;

  messageDiv.textContent = '';

  const lead = document.createElement('span');
  lead.textContent = t('mods.battleHelper.toast.viewingLead');

  const profileLink = document.createElement('a');
  profileLink.href = buildBattleHelperProfileUrl(profileSlug);
  profileLink.target = '_blank';
  profileLink.rel = 'noopener noreferrer';
  const suffix = t('mods.battleHelper.toast.viewingNameSuffix');
  profileLink.textContent = `${displayName}${suffix}`;
  profileLink.style.cssText = 'color: #ffe066; text-decoration: underline; pointer-events: auto;';

  const tail = document.createElement('span');
  const tailText = t('mods.battleHelper.toast.viewingTail');
  if (tailText) {
    tail.textContent = tailText;
    messageDiv.appendChild(lead);
    messageDiv.appendChild(profileLink);
    messageDiv.appendChild(tail);
    return;
  }

  messageDiv.appendChild(lead);
  messageDiv.appendChild(profileLink);
}

function removeBattleHelperPersistentToast() {
  if (battleHelperPersistentToastHandle?.remove) {
    battleHelperPersistentToastHandle.remove();
  }
  battleHelperPersistentToastHandle = null;
}

function showBattleHelperPersistentToast(profileName, username) {
  try {
    const container = getBattleHelperToastContainer();
    if (!container) return null;

    removeBattleHelperPersistentToast();

    const existingToasts = container.querySelectorAll('.battle-helper-toast-item');
    const stackOffset = existingToasts.length * 46;
    const flexContainer = document.createElement('div');
    flexContainer.className = 'battle-helper-toast-item';
    flexContainer.style.cssText = `display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-${stackOffset}px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;`;

    const toast = document.createElement('div');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    toast.setAttribute('role', 'presentation');
    toast.style.pointerEvents = 'auto';
    toast.style.cursor = 'default';

    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';

    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    populateBattleHelperToastMessage(messageDiv, profileName, username);

    widgetBottom.appendChild(messageDiv);
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);
    updateBattleHelperToastPositions(container);

    const handle = {
      updateProfile(nextProfileName, nextUsername) {
        populateBattleHelperToastMessage(messageDiv, nextProfileName, nextUsername);
      },
      remove() {
        if (flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateBattleHelperToastPositions(container);
        }
        if (battleHelperPersistentToastHandle === handle) {
          battleHelperPersistentToastHandle = null;
        }
      }
    };
    battleHelperPersistentToastHandle = handle;
    return handle;
  } catch (error) {
    console.warn('[Battle Helper] showBattleHelperPersistentToast:', error);
    return null;
  }
}

function startBattleHelperViewingProfileToast(profileName, username) {
  if (battleHelperPersistentToastHandle?.updateProfile) {
    battleHelperPersistentToastHandle.updateProfile(profileName, username);
    return;
  }
  showBattleHelperPersistentToast(profileName, username);
}

function stopBattleHelperViewingProfileToast() {
  removeBattleHelperPersistentToast();
}

// =======================
// 7. UI Components
// =======================
function createActionButton(label, onClick, options = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${options.primary ? BATTLE_HELPER_BUTTON_CLASS.primary : BATTLE_HELPER_BUTTON_CLASS.secondary} disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50`;
  button.style.cssText = 'width: 100%; cursor: pointer;';
  const textSpan = document.createElement('span');
  textSpan.textContent = label;
  button.appendChild(textSpan);
  if (options.disabled) button.disabled = true;
  button.addEventListener('click', onClick);
  return button;
}

function createSectionLabel(title, options = {}) {
  const label = document.createElement('div');
  label.className = 'pixel-font-12 text-whiteRegular mb-1 shrink-0';
  if (options.centered) {
    label.style.textAlign = 'center';
    label.style.width = '100%';
  }
  label.textContent = title;
  return label;
}

function createSectionCard(options = {}) {
  const card = document.createElement('div');
  card.className = 'frame-1 surface-regular box-border flex flex-col gap-1 p-1 shrink-0';
  if (options.flex) {
    card.style.flex = '1 1 0';
    card.style.minWidth = '0';
  }
  if (options.fullWidth) {
    card.style.width = '100%';
  }
  return card;
}

function createUsernameInput(initialValue = '') {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'frame-pressed-1 surface-dark w-full p-1 text-whiteRegular pixel-font-16';
  input.placeholder = t('mods.battleHelper.usernamePlaceholder');
  input.value = initialValue;
  input.style.maxWidth = '100%';
  input.style.boxSizing = 'border-box';
  input.style.height = `${BATTLE_HELPER_FIELD_HEIGHT_PX}px`;
  input.style.maxHeight = `${BATTLE_HELPER_FIELD_HEIGHT_PX}px`;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  return input;
}

function createInfoNote(text, options = {}) {
  const notesBlock = document.createElement('div');
  notesBlock.className = 'frame-pressed-1 surface-dark w-full min-w-0 shrink-0 p-1';

  const notesText = document.createElement('p');
  notesText.className = options.yellow ? 'pixel-font-14 italic m-0' : 'pixel-font-14 text-whiteRegular italic m-0';
  notesText.style.cssText = 'line-height: 1.35; word-break: break-word; white-space: pre-line;';
  if (options.yellow) {
    notesText.style.color = '#ffe066';
  }
  notesText.textContent = text;
  notesBlock.appendChild(notesText);

  return notesBlock;
}

function applyBattleHelperScrollViewportGutter(scrollContainer) {
  if (!scrollContainer?.element) return;

  const viewport = scrollContainer.scrollView ||
    scrollContainer.element.querySelector('[data-radix-scroll-area-viewport]') ||
    scrollContainer.element.querySelector('.scroll-view');
  if (!viewport) return;

  viewport.setAttribute('data-radix-scroll-area-viewport', '');
  viewport.setAttribute('data-type', 'always');
  viewport.className = 'h-full w-[calc(100%-12px)] data-[type=\'auto\']:w-full';
  viewport.style.overflow = 'hidden scroll';

  const contentContainer = scrollContainer.contentContainer;
  if (contentContainer) {
    contentContainer.className = 'grid items-start gap-1 p-1';
    contentContainer.dataset.nopadding = 'false';
    contentContainer.style.gridTemplateRows = 'max-content';
    contentContainer.style.boxSizing = 'border-box';
  }

  const scrollbar = scrollContainer.element.querySelector('[data-orientation="vertical"]') ||
    Array.from(scrollContainer.element.children).find(
      child => child !== viewport && child.classList?.contains('frame-1')
    );
  if (scrollbar) {
    scrollbar.setAttribute('data-orientation', 'vertical');
    scrollbar.className = 'scrollbar-element frame-1 surface-dark flex touch-none select-none border-0 data-[orientation=\'horizontal\']:h-3 data-[orientation=\'vertical\']:h-full data-[orientation=\'vertical\']:w-3 data-[orientation=\'horizontal\']:flex-col';
    scrollbar.style.cssText = `position: absolute; top: 0px; right: 0px; bottom: 0px; width: ${BATTLE_HELPER_SCROLLBAR_GUTTER_PX}px;`;
  }
}

function createBattleHelperScrollContainer({ height = BATTLE_HELPER_OUTPUT_HEIGHT_PX } = {}) {
  const scrollContainer = api.ui.components.createScrollContainer({
    height,
    padding: true,
    content: ''
  });
  Object.assign(scrollContainer.element.style, {
    flex: '0 0 auto',
    minHeight: '0',
    height: `${height}px`,
    maxHeight: `${height}px`,
    position: 'relative',
    overflow: 'hidden',
    width: '100%'
  });
  applyBattleHelperScrollViewportGutter(scrollContainer);
  return scrollContainer;
}

function styleBattleHelperFooterButtons(footer) {
  if (!footer) return;

  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  `;

  footer.querySelectorAll('button').forEach((button) => {
    const bg = button.style.backgroundColor?.toLowerCase();
    const isPrimary = bg === 'rgb(76, 175, 80)' || bg === '#4caf50';
    button.className = isPrimary
      ? BATTLE_HELPER_BUTTON_CLASS.primary
      : BATTLE_HELPER_BUTTON_CLASS.secondary;
    button.style.cssText = 'cursor: pointer;';
  });
}

function formatFetchedProfileOutput(normalized, { includeSandboxNote = false } = {}) {
  const lines = [
    tReplace('mods.battleHelper.output.profileLine', {
      name: formatProfileDisplayName(normalized.profileName)
    }),
    tReplace('mods.battleHelper.output.creaturesLine', {
      count: String(normalized.monsters.length)
    }),
    tReplace('mods.battleHelper.output.equipmentLine', {
      count: String(normalized.equips.length)
    }),
    '',
    t('mods.battleHelper.output.canReplaceProfile')
  ];
  if (includeSandboxNote) {
    lines.push('', t('mods.battleHelper.output.switchedToSandbox'));
  }
  return lines.join('\n');
}

function getInitialModalOutputText() {
  if (sessionState.replaced) {
    return getProfileReplacedOutput();
  }
  if (sessionState.lastNormalized) {
    return formatFetchedProfileOutput(sessionState.lastNormalized);
  }
  return getNoProfileFetchedOutput();
}

function buildModalContent(onContentChange) {
  const root = document.createElement('div');
  root.className = 'battle-helper-modal-root flex min-h-0 flex-col';
  root.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%; box-sizing: border-box;';

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display: flex; flex-direction: row; gap: 8px; align-items: stretch; width: 100%;';

  const profileColumn = document.createElement('div');
  profileColumn.style.cssText = 'display: flex; flex-direction: column; flex: 1 1 0; min-width: 0;';
  const profileCard = createSectionCard({ flex: true });
  const usernameInput = createUsernameInput(sessionState.lastUsername);
  profileCard.appendChild(usernameInput);

  const actionsColumn = document.createElement('div');
  actionsColumn.style.cssText = 'display: flex; flex-direction: column; flex: 1 1 0; min-width: 0;';
  const actionsCard = createSectionCard({ flex: true });
  let replaceButton;
  let restoreButton;

  const outputScroll = createBattleHelperScrollContainer();
  const outputBox = document.createElement('p');
  outputBox.className = 'pixel-font-14 text-whiteRegular m-0';
  outputBox.style.cssText = 'white-space: pre-wrap; line-height: 1.35; word-break: break-word;';
  outputBox.textContent = getInitialModalOutputText();
  outputScroll.addContent(outputBox);

  function setOutput(text) {
    outputBox.textContent = text;
    if (typeof onContentChange === 'function') {
      requestAnimationFrame(() => onContentChange());
    }
  }

  function syncButtons() {
    replaceButton.disabled = !sessionState.lastNormalized;
    restoreButton.disabled = !sessionState.replaced;
  }

  const fetchButton = createActionButton(t('mods.battleHelper.fetchPlayer'), async () => {
    const username = normalizeUsername(usernameInput.value);
    if (!username) {
      setOutput(getEnterUsernameFirstOutput());
      return;
    }
    try {
      setOutput(tReplace('mods.battleHelper.output.fetchingProfile', { username }));
      const profile = await fetchProfileByUsername(username);
      sessionState.lastProfileRaw = profile;
      const normalized = normalizeProfileArsenal(profile);
      validateNormalizedArsenal(normalized);
      sessionState.lastNormalized = normalized;
      sessionState.lastUsername = username;

      const switchedToSandbox = ensureSandboxPlayMode();
      setOutput(formatFetchedProfileOutput(normalized, { includeSandboxNote: switchedToSandbox }));
      syncButtons();
    } catch (error) {
      sessionState.lastProfileRaw = null;
      sessionState.lastNormalized = null;
      setOutput(getFetchFailedOutput(error));
      syncButtons();
    }
  });
  profileCard.appendChild(fetchButton);
  profileColumn.appendChild(profileCard);

  replaceButton = createActionButton(t('mods.battleHelper.replaceProfile'), () => {
    try {
      if (!isSandboxEnabled()) {
        throw new Error(t('mods.battleHelper.errors.sandboxRequired'));
      }
      if (!sessionState.lastNormalized) {
        throw new Error(t('mods.battleHelper.errors.fetchValidProfileFirst'));
      }
      applyArsenalReplacement(sessionState.lastNormalized);
      setOutput(getProfileReplacedOutput());
      syncButtons();
    } catch (error) {
      setOutput(tReplace('mods.battleHelper.output.replaceFailed', {
        error: String(error?.message || error)
      }));
    }
  }, { disabled: true, primary: true });

  restoreButton = createActionButton(t('mods.battleHelper.restoreOriginalProfile'), () => {
    try {
      restoreOriginalArsenal();
      setOutput(t('mods.battleHelper.output.originalProfileRestored'));
      syncButtons();
    } catch (error) {
      setOutput(tReplace('mods.battleHelper.output.restoreFailed', {
        error: String(error?.message || error)
      }));
    }
  }, { disabled: true });

  actionsCard.appendChild(replaceButton);
  actionsCard.appendChild(restoreButton);
  actionsColumn.appendChild(actionsCard);

  topRow.appendChild(profileColumn);
  topRow.appendChild(actionsColumn);
  root.appendChild(topRow);
  root.appendChild(createInfoNote(t('mods.battleHelper.hiddenCreaturesNote'), { yellow: true }));
  root.appendChild(createSectionLabel(t('mods.battleHelper.statusLabel'), { centered: true }));
  root.appendChild(outputScroll.element);

  syncButtons();
  return root;
}

// =======================
// 8. Mod Button State
// =======================
function injectBattleHelperButtonStyles() {
  if (document.getElementById(BATTLE_HELPER_BUTTON_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = BATTLE_HELPER_BUTTON_STYLE_ID;
  style.textContent = `
    @keyframes battle-helper-imported-colors {
      0%, 100% {
        color: #ff9f43;
        text-shadow: 0 0 8px rgba(255, 159, 67, 0.85);
      }
      33% {
        color: #54a0ff;
        text-shadow: 0 0 8px rgba(84, 160, 255, 0.85);
      }
      66% {
        color: #c678dd;
        text-shadow: 0 0 8px rgba(198, 120, 221, 0.85);
      }
    }
    #${BUTTON_ID}.${BATTLE_HELPER_BUTTON_IMPORTED_CLASS} {
      animation: battle-helper-imported-colors 2.4s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

function syncBattleHelperButtonState() {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  injectBattleHelperButtonStyles();

  if (sessionState.replaced) {
    button.classList.add(BATTLE_HELPER_BUTTON_IMPORTED_CLASS);
    button.title = t('mods.battleHelper.importedTooltip');
  } else {
    button.classList.remove(BATTLE_HELPER_BUTTON_IMPORTED_CLASS);
    button.title = t('mods.battleHelper.defaultTooltip');
  }
}

// =======================
// 9. Modal Orchestration
// =======================
function getBattleHelperDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearBattleHelperModalLayoutCleanup() {
  if (battleHelperModalLayoutCleanup) {
    battleHelperModalLayoutCleanup();
    battleHelperModalLayoutCleanup = null;
  }
}

function clearBattleHelperModalCleanup() {
  clearBattleHelperModalLayoutCleanup();
}

function attachBattleHelperModalCloseCleanup(modalRef) {
  if (!modalRef) return;
  const runCleanup = () => clearBattleHelperModalCleanup();

  if (typeof modalRef.onClose === 'function') {
    modalRef.onClose(runCleanup);
  }

  const originalClose = modalRef.close?.bind(modalRef);
  if (originalClose) {
    modalRef.close = () => {
      runCleanup();
      originalClose();
    };
  }
}

function applyBattleHelperModalNaturalLayout(contentRoot) {
  if (!contentRoot) return;
  Object.assign(contentRoot.style, {
    flex: '0 0 auto',
    minHeight: '0',
    height: 'auto',
    maxHeight: 'none',
    width: '100%',
    minWidth: '0',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'visible',
    display: 'flex',
    flexDirection: 'column'
  });
}

function applyBattleHelperModalCompactLayout(rootWrapper, contentContainer, contentRoot) {
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      flex: '0 0 auto',
      minHeight: '0',
      gap: '0'
    });
  }
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '0 0 auto',
      minHeight: '0',
      marginTop: '-1px',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column'
    });
  }
  applyBattleHelperModalNaturalLayout(contentRoot);
}

function applyBattleHelperModalScrollLayout(rootWrapper, contentContainer, contentRoot) {
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0',
      gap: '0'
    });
  }
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '1 1 auto',
      minHeight: '0',
      marginTop: '-1px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }
  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 0',
      minHeight: '0',
      overflowX: 'hidden',
      overflowY: 'auto',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    });
  }
}

function measureBattleHelperModalNaturalHeight(dialog, contentRoot) {
  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper?.offsetHeight > 0) {
    return rootWrapper.offsetHeight;
  }

  if (!contentRoot) return dialog.scrollHeight;

  const title = dialog.querySelector('.widget-top');
  const widgetBottom = dialog.querySelector('.widget-bottom');
  const separator = widgetBottom?.querySelector('.separator');
  const footer = widgetBottom?.querySelector('.flex.justify-end.gap-2');

  let chrome = 0;
  if (title) chrome += title.offsetHeight;
  if (separator) chrome += separator.offsetHeight;
  if (footer) chrome += footer.offsetHeight;
  if (widgetBottom) {
    const style = window.getComputedStyle(widgetBottom);
    chrome += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    chrome += parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  }

  return chrome + contentRoot.scrollHeight;
}

function stabilizeBattleHelperModalRendering(dialog) {
  if (!dialog) return;
  dialog.classList.remove('w-full', 'max-w-[300px]');
  dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  dialog.style.willChange = 'auto';
}

function applyBattleHelperModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getBattleHelperDialog(modalRef);
  if (!dialog) return;

  const { width, maxHeight } = dimensions;
  const snappedWidth = snapBattleHelperModalPx(width);
  const rootWrapper = dialog.querySelector(':scope > div');
  const contentContainer = dialog.querySelector('.widget-bottom');

  dialog.style.width = `${snappedWidth}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${snappedWidth}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.id = BATTLE_HELPER_MODAL_ID;
  stabilizeBattleHelperModalRendering(dialog);

  dialog.style.height = 'auto';
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = 'none';

  const widgetTop = dialog.querySelector('.widget-top');
  if (widgetTop) {
    widgetTop.style.margin = '0';
    const titleText = widgetTop.querySelector('p');
    if (titleText) titleText.style.margin = '0';
  }

  applyBattleHelperModalCompactLayout(rootWrapper, contentContainer, contentRoot);

  const naturalHeight = measureBattleHelperModalNaturalHeight(dialog, contentRoot);
  const needsScroll = naturalHeight > maxHeight;
  const finalHeight = snapBattleHelperModalPx(
    needsScroll ? maxHeight : Math.max(MODAL_CONFIG.minHeight, naturalHeight)
  );

  dialog.style.height = `${finalHeight}px`;
  dialog.style.maxHeight = `${maxHeight}px`;

  if (needsScroll) {
    applyBattleHelperModalScrollLayout(rootWrapper, contentContainer, contentRoot);
  } else {
    applyBattleHelperModalCompactLayout(rootWrapper, contentContainer, contentRoot);
  }

  styleBattleHelperFooterButtons(dialog.querySelector('.flex.justify-end.gap-2'));
}

function setupBattleHelperModalResponsiveLayout(modalRef, contentRoot) {
  clearBattleHelperModalLayoutCleanup();
  activeBattleHelperModal = modalRef;
  const apply = () => applyBattleHelperModalLayout(modalRef, contentRoot, getModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  battleHelperModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (activeBattleHelperModal === modalRef) {
      activeBattleHelperModal = null;
    }
  };
}

function openBattleHelperModal() {
  clearBattleHelperModalCleanup();
  let modalRef;
  const refitLayout = () => {
    if (modalRef) {
      applyBattleHelperModalLayout(modalRef, content, getModalDimensions());
    }
  };
  const content = buildModalContent(refitLayout);
  const dims = getModalDimensions();
  modalRef = api.ui.components.createModal({
    title: t('mods.battleHelper.title'),
    width: dims.width,
    content,
    buttons: [{
      text: t('mods.battleHelper.close'),
      primary: true,
      onClick: () => clearBattleHelperModalCleanup()
    }]
  });
  setupBattleHelperModalResponsiveLayout(modalRef, content);
  attachBattleHelperModalCloseCleanup(modalRef);
}

// =======================
// 10. Entry Point, Exports, Cleanup
// =======================
api.ui.addButton({
  id: BUTTON_ID,
  modId: MOD_ID,
  text: t('mods.battleHelper.title'),
  icon: '🧬',
  tooltip: t('mods.battleHelper.defaultTooltip'),
  primary: false,
  onClick: openBattleHelperModal
});
requestAnimationFrame(() => syncBattleHelperButtonState());

function hideButton() {
  const button = document.getElementById(BUTTON_ID);
  if (button) button.style.display = 'none';
}

function showButton() {
  const button = document.getElementById(BUTTON_ID);
  if (button) button.style.display = '';
}

context.exports = {
  open: openBattleHelperModal,
  hideButton,
  showButton,
  cleanup: () => {
    sessionState.lastProfileRaw = null;
    sessionState.lastNormalized = null;
    sessionState.lastUsername = '';
    sessionState.replaced = false;
    sessionState.backup = null;
    stopBattleHelperViewingProfileToast();
    clearBattleHelperModalCleanup();
    syncBattleHelperButtonState();
  }
};

if (typeof window !== 'undefined') {
  window.battleHelper = {
    open: openBattleHelperModal,
    hideButton,
    showButton
  };
}

console.log('[Battle Helper] initialized');
})();
