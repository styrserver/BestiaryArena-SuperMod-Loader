// =======================
// Welcome Mod for Bestiary Arena
// Shows a welcome page on initialization and a loading toast while mods load.
// =======================
/* global context, api, exports */

// Translation lookup with an English fallback: the loading toast is shown in the first
// (database) batch, which can run before the locale has finished loading, when
// api.i18n.t() still returns the raw key.
function wt(key, fallback, vars) {
  let text = fallback;
  try {
    const translated = api?.i18n?.t?.(key);
    if (typeof translated === 'string' && translated !== key) text = translated;
  } catch (_) {
    // Locale helper unavailable this early; keep the English fallback.
  }
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

function isWelcomeLocaleReady() {
  try {
    return api?.i18n?.t?.('mods.welcome.loadingMods') !== 'mods.welcome.loadingMods';
  } catch (_) {
    return false;
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// =======================
// 1. Configuration
// =======================

const config = Object.assign({ showWelcome: true }, context.config);

const WELCOME_MODAL_SIZE = {
  width: 700,
  height: 600,
  viewportPadding: 16,
  minWidth: 300,
  minHeight: 300
};

const ASSET_BASE = 'https://bestiaryarena.com/assets/icons/';
const WELCOME_ASSETS = {
  logo: 'https://bestiaryarena.com/assets/logo.png',
  shinyStar: `${ASSET_BASE}shiny-star.png`,
  spellbook: `${ASSET_BASE}spellbook.png`,
  starAwaken: `${ASSET_BASE}star-tier-awaken.png`,
  chat: `${ASSET_BASE}chat.png`,
  chest: `${ASSET_BASE}exaltation-chest.png`,
  quest: `${ASSET_BASE}quest.png`,
  premium: `${ASSET_BASE}premium.png`,
  grade: `${ASSET_BASE}grade.png`,
  starTier: `${ASSET_BASE}star-tier.png`,
  stamina: `${ASSET_BASE}stamina.png`
};

const WELCOME_FRAME_URL = window.BAAssets.url('4-frame');
const WELCOME_BG_URL = window.BAAssets.url('background-dark');
const WELCOME_DIALOG_SELECTOR = 'div[role="dialog"][data-welcome-dialog="1"]';
const WELCOME_ENABLED_KEY = 'welcome-enabled';
const LAST_SEEN_VERSION_KEY = 'ba-last-seen-version';
const MOD_LOAD_FALLBACK_DELAY = 15000;

function welcomeInlineIcon(src, { size = 16, alt = '' } = {}) {
  return `<img src="${src}" alt="${alt}" class="pixelated welcome-inline-icon" style="width:${size}px;height:${size}px;">`;
}

// =======================
// 2. Global State
// =======================

let loadingToast = null;
let loadingCompleted = false;
let modsLoaded = false;
let modLoadingObserver = null;
let modLoadingFallbackTimer = null;
let currentModal = null;
let welcomeEscHandler = null;
let welcomeModalLayoutCleanup = null;
const activeTimeouts = new Set();
const activeEventListeners = [];

// =======================
// 3. Lifecycle Tracking Helpers
// =======================

function trackTimeout(timeoutId) {
  activeTimeouts.add(timeoutId);
  return timeoutId;
}

function clearTrackedTimeout(timeoutId) {
  clearTimeout(timeoutId);
  activeTimeouts.delete(timeoutId);
}

function trackEventListener(element, event, handler) {
  activeEventListeners.push({ element, event, handler });
  element.addEventListener(event, handler);
}

function removeTrackedEventListener(element, event, handler) {
  const index = activeEventListeners.findIndex((l) => l.element === element && l.event === event && l.handler === handler);
  if (index === -1) return;
  activeEventListeners.splice(index, 1);
  element.removeEventListener(event, handler);
}

// =======================
// 4. Extension Messaging & Storage
// =======================

// One request/response round trip to the content script. Always resolves; on
// timeout the response is { success: false, error: 'Timeout' }.
function requestExtension(action, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const id = `welcome_${action}_${Date.now()}_${Math.random()}`;
    let timer = null;
    const finish = (response) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(response);
    };
    const onMessage = (event) => {
      const data = event.data;
      if (data?.from === 'BESTIARY_EXTENSION' && data.id === id) finish(data.response);
    };
    window.addEventListener('message', onMessage);
    timer = setTimeout(() => finish({ success: false, error: 'Timeout' }), timeoutMs);
    window.postMessage({ from: 'BESTIARY_CLIENT', id, message: { action } }, '*');
  });
}

async function getExtensionVersion() {
  try {
    const response = await requestExtension('getVersion');
    return response?.success && response.version ? response.version : 'unknown';
  } catch (error) {
    console.warn('[Welcome] Could not get extension version:', error);
    return 'unknown';
  }
}

// Returns { official, super, ot } or null when the background script cannot be reached.
async function getModCounts() {
  const response = await requestExtension('getModCounts');
  if (response?.success && response.counts) return response.counts;
  console.error('[Welcome] Could not get mod counts:', response?.error || 'no response from background script');
  return null;
}

async function getStoredValue(key) {
  if (window.browserAPI?.storage?.local) {
    try {
      const data = await new Promise((resolve) => window.browserAPI.storage.local.get([key], resolve));
      return data[key];
    } catch (error) {
      console.warn(`[Welcome] Extension storage read failed for ${key}, falling back to localStorage:`, error);
    }
  }
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch (error) {
    console.warn(`[Welcome] localStorage read failed for ${key}:`, error);
    return undefined;
  }
}

async function setStoredValue(key, value) {
  if (window.browserAPI?.storage?.local) {
    try {
      await new Promise((resolve) => window.browserAPI.storage.local.set({ [key]: value }, resolve));
      return;
    } catch (error) {
      console.warn(`[Welcome] Extension storage write failed for ${key}, falling back to localStorage:`, error);
    }
  }
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[Welcome] localStorage write failed for ${key}:`, error);
  }
}

// Default to showing the welcome page when the preference is unset or unreadable.
async function shouldShowWelcome() {
  try {
    return (await getStoredValue(WELCOME_ENABLED_KEY)) !== 'false';
  } catch (error) {
    console.warn('Could not check welcome preference:', error);
    return true;
  }
}

// 'welcome-enabled' controls both the popup slider and the welcome display.
async function setNeverShowAgain() {
  try {
    await setStoredValue(WELCOME_ENABLED_KEY, 'false');
    window.browserAPI?.runtime?.sendMessage?.({ action: 'disableWelcomeToggle' })?.catch?.((error) => {
      console.warn('Could not send message to popup:', error);
    });
    window.postMessage({ from: 'BESTIARY_WELCOME', action: 'disableWelcomeToggle' }, '*');
  } catch (error) {
    console.warn('Could not save welcome preference:', error);
  }
}

// Shows an "Updated to vX.Y.Z" toast when the running version differs from the last
// recorded one (including when none was recorded yet), then records it.
async function checkForVersionUpdate(currentVersion) {
  if (!currentVersion || currentVersion === 'unknown') return;
  try {
    const lastSeenVersion = await getStoredValue(LAST_SEEN_VERSION_KEY);
    if (lastSeenVersion === currentVersion) return;

    createToast({
      message: `<span style="color:#ffd166;">${wt('mods.welcome.updatedWord', 'Updated')}</span> ${escapeHtml(wt('mods.welcome.updatedToVersion', 'to v{version}!', { version: currentVersion }))}`,
      type: 'success',
      duration: 6000
    });
    await setStoredValue(LAST_SEEN_VERSION_KEY, currentVersion);
  } catch (error) {
    console.warn('[Welcome] Could not check for version update:', error);
  }
}

// =======================
// 5. Modal Conflict Helpers
// =======================

// The game marks open modals with a scroll lock and/or pointer-events:none on <body>.
function bodyHasModals(body) {
  return body.getAttribute('data-scroll-locked') === '1' || body.style.pointerEvents === 'none';
}

// Returns true when another modal is still open after one ESC press.
async function tryCloseModalsAndCheck() {
  try {
    const body = document.body;
    if (!body || !bodyHasModals(body)) return false;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    return bodyHasModals(body);
  } catch (error) {
    console.warn('[Welcome] Error trying to close modals:', error);
    return false; // Allow the welcome modal if we cannot tell
  }
}

// =======================
// 6. Mod Loading Lifecycle
// =======================

function isGameStateReadyForMods() {
  try {
    const state = globalThis.state;
    if (!state?.player?.getSnapshot || !state?.board?.getSnapshot) return false;
    return !!(state.board.getSnapshot()?.context && state.player.getSnapshot()?.context);
  } catch {
    return false;
  }
}

function hasReactHydrationErrorForWelcome() {
  return !!(window.__BA_REACT_HYDRATION_ERROR__ || window.localModsAPI?.hasReactHydrationError?.());
}

function clearModLoadingFallbackTimer() {
  if (modLoadingFallbackTimer) {
    clearTrackedTimeout(modLoadingFallbackTimer);
    modLoadingFallbackTimer = null;
  }
}

function scheduleModLoadingFallbackTimer() {
  clearModLoadingFallbackTimer();
  modLoadingFallbackTimer = trackTimeout(setTimeout(() => {
    modLoadingFallbackTimer = null;
    if (loadingCompleted) return;

    if (window.localModsAPI?.isBatchExecuting?.()) {
      scheduleModLoadingFallbackTimer();
      return;
    }

    if (window.localModsAPI?.wasCompletionSignalSent?.()) {
      console.log('[Welcome] Completion signal sent but message missed — recovering');
      handleModLoadingFinished(window.localModsAPI.getLastLoadErrors?.() || []);
      return;
    }

    console.log('[Welcome] Mod loading completion timeout — treating as load failure');
    handleModLoadingFinished([{ mod: 'loader', error: 'Loading timed out' }]);
  }, MOD_LOAD_FALLBACK_DELAY));
}

// Extra failures the loader's own error list cannot know about. In relaxed-loader
// mode they are only warnings.
function collectCompletionErrors(errors, strictCompletion) {
  const resolved = Array.isArray(errors) ? [...errors] : [];
  if (resolved.length > 0) return resolved;

  const problems = [];
  if (!isGameStateReadyForMods()) {
    const hasGameMods = window.localMods?.some((mod) => mod.enabled && !mod.name.startsWith('database/'));
    if (hasGameMods) problems.push({ mod: 'loader', error: 'Game state not ready (board/player unavailable)' });
  }
  if (hasReactHydrationErrorForWelcome()) {
    problems.push({ mod: 'loader', error: 'React hydration error detected (#418/#423)' });
  }

  if (!strictCompletion && problems.length) {
    console.warn('[Welcome] Relaxed loader: non-fatal completion issues:', problems.map((p) => p.error).join('; '));
    return [];
  }
  return problems;
}

async function handleModLoadingFinished(errors = []) {
  if (loadingCompleted) return; // Duplicate signal (message + fallback timer)

  loadingCompleted = true;
  clearModLoadingFallbackTimer();
  modLoadingObserver?.disconnect();
  modLoadingObserver = null;

  const strictCompletion = window.BestiaryPlatform?.useStrictLoaderCompletion?.() ?? true;
  const resolvedErrors = collectCompletionErrors(errors, strictCompletion);

  loadingToast?.remove?.();
  loadingToast = null;

  if (resolvedErrors.length > 0) {
    modsLoaded = false;
    console.log('[Welcome] Mod loading had errors:', resolvedErrors.map((e) => e.mod || 'unknown').join(', '));
    // Errors the loader reported itself were already handled by the loader.
    if (!(Array.isArray(errors) && errors.length > 0)) {
      window.BestiaryLoaderFailure?.handle(resolvedErrors);
    }
    return;
  }

  modsLoaded = true;
  window.BestiaryLoaderFailure?.resetRetryCount();
  window.__BA_RESET_CRASH_RECOVERY_RETRY__?.();

  try {
    createToast({
      message: `<span class="text-monster">${wt('mods.welcome.modsWord', 'Mods')}</span> ${wt('mods.welcome.loadedSuccessfully', 'loaded successfully!')}`,
      type: 'success',
      duration: 5000
    });
    getExtensionVersion().then(checkForVersionUpdate);
  } catch (error) {
    console.error('[Welcome] Error creating completion toast:', error);
  }
  handleCompletionModalClose();
}

// =======================
// 7. Modal Styles, Content & Layout
// =======================

function getWelcomeModalDimensions() {
  const pad = WELCOME_MODAL_SIZE.viewportPadding * 2;
  return {
    width: Math.max(WELCOME_MODAL_SIZE.minWidth, Math.min(WELCOME_MODAL_SIZE.width, window.innerWidth - pad)),
    height: Math.max(WELCOME_MODAL_SIZE.minHeight, Math.min(WELCOME_MODAL_SIZE.height, window.innerHeight - pad))
  };
}

function getWelcomeDialog(modalRef) {
  if (modalRef?.element?.isConnected) return modalRef.element;
  if (modalRef instanceof HTMLElement && modalRef.isConnected) return modalRef;
  if (currentModal?.element?.isConnected) return currentModal.element;
  return document.querySelector(WELCOME_DIALOG_SELECTOR) ||
    document.querySelector('div[role="dialog"][data-state="open"]') ||
    document.querySelector('div[role="dialog"]');
}

function ensureWelcomeStyles() {
  if (document.getElementById('welcome-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'welcome-modal-styles';
  style.textContent = `
    .welcome-modal-root {
      display: flex; flex-direction: column; flex: 1 1 auto;
      width: 100%; height: 100%; min-width: 0; min-height: 0;
      box-sizing: border-box; overflow: hidden;
    }
    .welcome-main-panel {
      display: flex; flex-direction: column; flex: 1 1 0;
      min-width: 0; min-height: 0; box-sizing: border-box; overflow: hidden;
      border: 6px solid transparent;
      border-image: url("${WELCOME_FRAME_URL}") 6 fill stretch;
    }
    .welcome-scroll-area {
      display: flex; flex-direction: column; flex: 1 1 0;
      width: 100%; min-width: 0; min-height: 0; box-sizing: border-box;
      overflow-x: hidden; overflow-y: auto;
      padding: clamp(8px, 2vw, 14px);
      text-align: center; color: #a6adc8; line-height: 1.35; word-break: break-word;
      background: url("${WELCOME_BG_URL}") repeat;
      scrollbar-width: thin; scrollbar-color: #444 #222;
    }
    .welcome-scroll-area::-webkit-scrollbar { width: 10px; background: #222; }
    .welcome-scroll-area::-webkit-scrollbar-thumb { background: #444; border: 2px solid #666; border-radius: 2px; }
    .welcome-scroll-inner { margin: auto 0; width: 100%; display: flex; flex-direction: column; gap: 10px; }
    .welcome-inline-icon { display: inline-block; vertical-align: -2px; margin-right: 4px; }

    .welcome-hero { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px 0 2px; }
    .welcome-hero h2 { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 0; font-size: 18px; line-height: 1.3; color: #e6e9f5; }
    .welcome-hero h2 .welcome-inline-icon { margin: 0; }
    .welcome-version {
      font-size: 12px; line-height: 1; padding: 3px 7px; border-radius: 999px;
      color: #ffd166; background: rgba(255,209,102,0.12); border: 1px solid rgba(255,209,102,0.35);
    }
    .welcome-tagline { margin: 0; font-size: 14px; line-height: 1.4; }

    .welcome-card { background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px 12px; box-sizing: border-box; }
    .welcome-card h3 { display: flex; align-items: center; margin: 0 0 8px; font-size: 15px; text-align: left; }
    .welcome-feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px 10px; text-align: left; }
    .welcome-feature-row {
      display: flex; align-items: flex-start; gap: 6px; margin: 0;
      padding: 5px 7px; border-radius: 4px; font-size: 14px; line-height: 1.35;
      background: rgba(255,255,255,0.03);
    }
    .welcome-feature-row .welcome-inline-icon { flex-shrink: 0; margin: 1px 0 0; }
    .welcome-feature-row strong { color: #e6e9f5; }

    .welcome-notes { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
    .welcome-note {
      flex: 1 1 180px; min-width: 0; box-sizing: border-box; margin: 0;
      padding: 8px 10px; border-radius: 6px; font-size: 14px; line-height: 1.4; text-align: left;
      background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3);
    }
    .welcome-footer { margin: 0; font-size: 14px; line-height: 1.4; }
    .welcome-footer-brand { margin: 4px 0 0; font-size: 13px; opacity: 0.7; }
  `;
  document.head.appendChild(style);
}

function buildWelcomeFeatures({ officialCount, superCount, otCount }) {
  const t = wt;
  return [
    [WELCOME_ASSETS.spellbook, t('mods.welcome.originalModsLabel', '{count} Original Mods:', { count: officialCount }), t('mods.welcome.originalModsText', 'Automator, Board Analyzer, Highscores, tier lists, and more. <em>(6 on by default)</em>')],
    [WELCOME_ASSETS.starAwaken, t('mods.welcome.superModsLabel', '{count} Super Mods:', { count: superCount }), t('mods.welcome.superModsText', 'Autoseller, Cyclopedia, Hunt Analyzer, Raid Hunter, and more. <em>(Mostly off &mdash; 3 on)</em>')],
    [WELCOME_ASSETS.chat, t('mods.welcome.otModsLabel', '{count} OT Mods:', { count: otCount }), t('mods.welcome.otModsText', 'Challenges, Guilds, VIP List, Quests. <em>(Off by default)</em>')],
    [WELCOME_ASSETS.chest, t('mods.welcome.backupsLabel', 'Backups:'), t('mods.welcome.backupsText', 'Import and export settings via Mod Settings.')],
    [WELCOME_ASSETS.quest, t('mods.welcome.patchNotesLabel', 'Patch Notes:'), t('mods.welcome.patchNotesText', 'See what\'s new each version in the popup.')],
    [WELCOME_ASSETS.premium, t('mods.welcome.popupLabel', 'Popup Controls:'), t('mods.welcome.popupText', 'Enable mods, add Gist scripts, manage extras.')],
    [WELCOME_ASSETS.grade, t('mods.welcome.analyticsLabel', 'Analytics:'), t('mods.welcome.analyticsText', 'Hunt Analyzer, Run Tracker, Better Analytics, and more.')]
  ];
}

function buildWelcomeModalContent({ officialCount, superCount, otCount, version }) {
  ensureWelcomeStyles();

  const featureRows = buildWelcomeFeatures({ officialCount, superCount, otCount })
    .map(([icon, label, text]) => `
      <p class="welcome-feature-row">
        ${welcomeInlineIcon(icon)}
        <span><strong>${label}</strong> ${text}</span>
      </p>`)
    .join('');

  const versionBadge = version !== 'unknown' ? `<span class="welcome-version">v${escapeHtml(version)}</span>` : '';
  const versionLabel = version !== 'unknown' ? ` v${escapeHtml(version)}` : '';

  const content = document.createElement('div');
  content.className = 'welcome-modal-root';
  content.innerHTML = `
    <div class="welcome-main-panel">
      <div class="welcome-scroll-area">
        <div class="welcome-scroll-inner">
          <div class="welcome-hero">
            <h2>${welcomeInlineIcon(WELCOME_ASSETS.logo, { size: 24, alt: 'Bestiary Arena' })}Bestiary Arena SuperMod Loader ${versionBadge}</h2>
            <p class="welcome-tagline">${wt('mods.welcome.tagline', 'Powerful tools and improvements for a more efficient Bestiary Arena experience.')}</p>
          </div>
          <div class="welcome-card">
            <h3>${welcomeInlineIcon(WELCOME_ASSETS.shinyStar, { alt: 'Features' })}${wt('mods.welcome.whatsIncluded', 'What\'s Included')}</h3>
            <div class="welcome-feature-grid">${featureRows}</div>
          </div>
          <div class="welcome-notes">
            <p class="welcome-note">${welcomeInlineIcon(WELCOME_ASSETS.starTier, { alt: 'Approved' })}<strong>${wt('mods.welcome.safeTitle', 'Safe & Approved')}</strong> — ${wt('mods.welcome.safeText', 'Officially approved by Xandjiji. Single-player enhancement only.')}</p>
            <p class="welcome-note">${welcomeInlineIcon(WELCOME_ASSETS.stamina, { alt: 'Tip' })}<strong>${wt('mods.welcome.tipTitle', 'Tip')}</strong> — ${wt('mods.welcome.tipText', 'Open the extension popup to toggle mods. Re-enable this welcome page from Extras anytime.')}</p>
          </div>
          <div>
            <p class="welcome-footer">${welcomeInlineIcon(WELCOME_ASSETS.shinyStar)}${wt('mods.welcome.enjoy', 'Enjoy your enhanced Bestiary Arena experience!')}</p>
            <p class="welcome-footer-brand">Bestiary Arena SuperMod Loader${versionLabel}</p>
          </div>
        </div>
      </div>
    </div>`;
  return content;
}

// Sizes the game's dialog shell (its own elements, so inline styles are needed to win
// over the game's classes); the welcome content itself is styled by ensureWelcomeStyles().
function applyWelcomeModalLayout(dialog, { width, height }) {
  const maxHeight = window.innerHeight - WELCOME_MODAL_SIZE.viewportPadding * 2;
  const setHeight = (px) => {
    dialog.style.height = `${px}px`;
    dialog.style.maxHeight = `${px}px`;
  };

  Object.assign(dialog.style, {
    width: `${width}px`,
    minWidth: '0',
    maxWidth: `${width}px`,
    minHeight: '0',
    boxSizing: 'border-box'
  });
  setHeight(height);
  dialog.classList.remove('max-w-[300px]', 'w-full');
  dialog.setAttribute('data-welcome-dialog', '1');

  const innerWrapper = dialog.querySelector(':scope > div') || dialog.firstElementChild;
  if (innerWrapper) {
    Object.assign(innerWrapper.style, {
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: '0', flex: '1 1 0', boxSizing: 'border-box'
    });
  }

  const body = dialog.querySelector('.widget-bottom');
  if (body) {
    Object.assign(body.style, {
      flex: '1 1 auto', minHeight: '0', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column'
    });
  }

  const footer = dialog.querySelector('.widget-bottom > .flex.justify-end.gap-2');
  if (footer) footer.style.flexShrink = '0';

  // Autofit: grow the dialog to fit its content so the scroll area needs no scrollbar,
  // clamped to the viewport (beyond that it falls back to scrolling).
  const scrollArea = dialog.querySelector('.welcome-scroll-area');
  if (scrollArea) {
    const overflow = scrollArea.scrollHeight - scrollArea.clientHeight;
    if (overflow > 1 && height < maxHeight) setHeight(Math.min(maxHeight, height + overflow));
  }
}

function setupWelcomeModalResponsiveLayout(modalRef) {
  clearWelcomeModalLayoutCleanup();

  const onResize = () => {
    // Resolve by our own marker only: once the welcome dialog is gone (closed by a
    // button), stop instead of restyling whatever other dialog is open.
    const dialog = document.querySelector(WELCOME_DIALOG_SELECTOR);
    if (!dialog) return clearWelcomeModalLayoutCleanup();
    applyWelcomeModalLayout(dialog, getWelcomeModalDimensions());
  };

  requestAnimationFrame(() => {
    const dialog = getWelcomeDialog(modalRef);
    if (dialog) applyWelcomeModalLayout(dialog, getWelcomeModalDimensions());
  });
  window.addEventListener('resize', onResize);
  welcomeModalLayoutCleanup = () => window.removeEventListener('resize', onResize);
}

function clearWelcomeModalLayoutCleanup() {
  if (welcomeModalLayoutCleanup) {
    welcomeModalLayoutCleanup();
    welcomeModalLayoutCleanup = null;
  }
}

// =======================
// 8. Toasts
// =======================

// Toasts go through the shared stack (content/ba-toast.js). `message` is trusted HTML built here;
// duration 0 = keep until removed. Returns { remove, setMessage(html) }.
const getWelcomeToastMod = () => wt('mods.welcome.modName', 'SuperMod Loader');

function htmlToNode(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function createToast({ message, type = 'info', duration = 3000 }) {
  const handle = window.BAToast?.show({ mod: getWelcomeToastMod(), message: htmlToNode(message), type, duration });
  return {
    remove: () => handle?.remove(),
    setMessage: (html) => handle?.update(htmlToNode(html))
  };
}

function showLoadingToast() {
  try {
    const buildLoadingMessage = () => `<span class="text-monster">${wt('mods.welcome.loadingMods', 'Loading mods')}</span>...`;
    loadingToast = createToast({
      message: buildLoadingMessage(),
      type: 'loading',
      duration: 0
    });

    // Shown before the locale is guaranteed to be loaded: relabel once it arrives.
    if (!isWelcomeLocaleReady()) {
      const relabelLoadingToast = () => {
        removeTrackedEventListener(document, 'bestiary-translations-loaded', relabelLoadingToast);
        loadingToast?.setMessage?.(buildLoadingMessage());
      };
      trackEventListener(document, 'bestiary-translations-loaded', relabelLoadingToast);
    }
  } catch (error) {
    console.error('[Welcome] Error creating loading toast:', error);
  }
}

function hideLoadingToast() {
  loadingToast?.remove?.();
  loadingToast = null;

  // Loading finished but the toast was closed: show the welcome modal as fallback.
  if (loadingCompleted) trackTimeout(setTimeout(handleCompletionModalClose, 100));
}

// =======================
// 9. Welcome Modal
// =======================

async function handleCompletionModalClose() {
  if (config.showWelcome && await shouldShowWelcome()) showWelcomeModal();
}

function removeWelcomeEscHandler() {
  if (!welcomeEscHandler) return;
  removeTrackedEventListener(document, 'keydown', welcomeEscHandler);
  welcomeEscHandler = null;
}

async function showWelcomeModal() {
  if (await tryCloseModalsAndCheck()) {
    console.log('[Welcome] Not showing welcome modal - another modal is still open after ESC');
    return;
  }

  if (!api?.ui?.components) {
    console.error('[Welcome] API not available');
    return;
  }

  try {
    const [version, modCounts] = await Promise.all([getExtensionVersion(), getModCounts()]);
    const fallbackCount = wt('mods.welcome.multiple', 'Multiple');
    const content = buildWelcomeModalContent({
      officialCount: modCounts?.official || fallbackCount,
      superCount: modCounts?.super || fallbackCount,
      otCount: modCounts?.ot || fallbackCount,
      version
    });

    const { width, height } = getWelcomeModalDimensions();
    const modal = api.ui.components.createModal({
      title: wt('mods.welcome.modalTitle', 'Welcome to Bestiary Arena SuperMod Loader!'),
      width,
      height,
      content,
      buttons: [
        { text: wt('mods.welcome.neverShowAgain', 'Never Show Again'), variant: 'danger', onClick: () => setNeverShowAgain() },
        { text: wt('mods.welcome.gotIt', 'Got It!'), primary: true }
      ]
    });

    removeWelcomeEscHandler();
    welcomeEscHandler = (e) => {
      if (e.key !== 'Escape') return;
      removeWelcomeEscHandler();
      modal?.close?.();
    };
    trackEventListener(document, 'keydown', welcomeEscHandler);

    setupWelcomeModalResponsiveLayout(modal);

    const originalClose = modal.close?.bind(modal);
    if (originalClose) {
      modal.close = () => {
        clearWelcomeModalLayoutCleanup();
        removeWelcomeEscHandler();
        originalClose();
        if (currentModal === modal) currentModal = null;
      };
    }

    currentModal = modal;
  } catch (error) {
    console.error('[Welcome] Error creating welcome modal:', error);
  }
}

// =======================
// 10. Initialization
// =======================

function setupModLoadingObserver() {
  const messageHandler = (event) => {
    if (event.source !== window || event.data?.from !== 'LOCAL_MODS_LOADER') return;

    if (event.data.action === 'modBatchExecutionStarted') {
      scheduleModLoadingFallbackTimer();
    } else if (event.data.action === 'allModsLoaded') {
      handleModLoadingFinished(event.data.errors || []);
    }
  };

  trackEventListener(window, 'message', messageHandler);
  modLoadingObserver = {
    disconnect: () => removeTrackedEventListener(window, 'message', messageHandler)
  };

  if (window.localModsAPI?.isBatchExecuting?.()) scheduleModLoadingFallbackTimer();
}

// The mod loading listener and loading toast need no game API, so start immediately.
setupModLoadingObserver();
showLoadingToast();

// =======================
// 11. Cleanup & Exports
// =======================

function cleanup() {
  activeTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  activeTimeouts.clear();
  modLoadingFallbackTimer = null;

  activeEventListeners.splice(0).forEach(({ element, event, handler }) => element.removeEventListener(event, handler));
  welcomeEscHandler = null;
  modLoadingObserver = null;

  clearWelcomeModalLayoutCleanup();

  if (currentModal && typeof currentModal.close === 'function') currentModal.close();
  currentModal = null;

  loadingToast?.remove?.();
  loadingToast = null;

  window.BAToast?.clearMod(getWelcomeToastMod());
  document.getElementById('welcome-modal-styles')?.remove();

  loadingCompleted = false;
  modsLoaded = false;
}

exports = {
  showWelcome: showWelcomeModal,
  setNeverShowAgain,
  shouldShowWelcome,
  showLoading: showLoadingToast,
  hideLoading: hideLoadingToast,
  updateLoadingToComplete: handleModLoadingFinished,
  isModsLoaded: () => modsLoaded,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup
};
