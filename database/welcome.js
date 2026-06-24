// =======================
// Welcome Mod for Bestiary Arena
// Shows a welcome page on initialization and a loading toast while mods load.
// =======================
/* global context, api, exports */
console.log('Welcome mod initializing...');

// =======================
// 1. Configuration
// =======================

const defaultConfig = {
  enabled: true,
  showWelcome: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

const WELCOME_MODAL_SIZE = {
  width: 700,
  height: 550,
  viewportPadding: 16,
  minWidth: 300,
  minHeight: 300
};

const WELCOME_ASSETS = {
  logo: 'https://bestiaryarena.com/assets/logo.png',
  shinyStar: 'https://bestiaryarena.com/assets/icons/shiny-star.png',
  spellbook: 'https://bestiaryarena.com/assets/icons/spellbook.png',
  starAwaken: 'https://bestiaryarena.com/assets/icons/star-tier-awaken.png',
  chat: 'https://bestiaryarena.com/assets/icons/chat.png',
  chest: 'https://bestiaryarena.com/assets/icons/exaltation-chest.png',
  quest: 'https://bestiaryarena.com/assets/icons/quest.png',
  premium: 'https://bestiaryarena.com/assets/icons/premium.png',
  grade: 'https://bestiaryarena.com/assets/icons/grade.png',
  starTier: 'https://bestiaryarena.com/assets/icons/star-tier.png',
  stamina: 'https://bestiaryarena.com/assets/icons/stamina.png'
};

function welcomeInlineIcon(src, { size = 16, alt = '' } = {}) {
  return `<img src="${src}" alt="${alt}" class="pixelated welcome-inline-icon" style="display:inline-block;width:${size}px;height:${size}px;vertical-align:-2px;margin-right:4px;">`;
}

const MOD_LOAD_FALLBACK_DELAY = 15000;

// =======================
// 2. Global State
// =======================

let loadingToast = null;
let loadingCompleted = false;
let modsLoaded = false;
let modLoadingObserver = null;
let modalAborted = false;
let modLoadingFallbackTimer = null;
let activeTimeouts = new Set();
let activeEventListeners = new Map();
let currentModal = null;
let welcomeModalLayoutCleanup = null;

// =======================
// 3. Modal Conflict Helpers
// =======================

function getModalState(body) {
  try {
    if (!body) return { isClean: true, hasModals: false };
    
    const hasScrollLock = body.getAttribute('data-scroll-locked') === '1';
    const hasPointerEvents = body.style.pointerEvents === 'none';
    const hasCheckeredClass = body.classList.contains('checkered');
    const hasWideClass = body.classList.contains('w-full-even-down');
    
    // Clean state: only "checkered w-full-even-down" with empty style
    const isClean = hasCheckeredClass && hasWideClass && !hasScrollLock && !hasPointerEvents;
    const hasModals = hasScrollLock || hasPointerEvents;
    
    return { isClean, hasModals, hasScrollLock, hasPointerEvents };
  } catch (error) {
    console.warn('[Welcome] Error checking modal state:', error);
    return { isClean: true, hasModals: false };
  }
}

async function tryCloseModalsAndCheck() {
  try {
    const body = document.body;
    if (!body) return false;
    
    // Get initial modal state
    const initialState = getModalState(body);
    
    // If it's already clean, no need to close anything
    if (initialState.isClean) {
      return false;
    }
    
    // If there are modals, try a single ESC press
    if (initialState.hasModals) {
      console.log('[Welcome] Attempting to close modals with single ESC press');
      
      // Single ESC press to close any open modals
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        keyCode: 27, 
        which: 27, 
        bubbles: true 
      }));
      
      // Wait for ESC press to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Re-check after ESC press
      const afterEscState = getModalState(body);
      
      if (afterEscState.isClean) {
        console.log('[Welcome] Modal successfully closed with ESC press');
        return false; // No modals open now
      } else {
        console.log('[Welcome] Modal still open after ESC press');
        return true; // Still has modals open
      }
    }
    
    return false; // No modals detected
  } catch (error) {
    console.warn('[Welcome] Error trying to close modals:', error);
    return false; // Default to allowing modal if we can't check
  }
}

// =======================
// 4. User Preferences & Extension API
// =======================

async function shouldShowWelcome() {
  try {
    // Simply check the welcome-enabled setting
    let welcomeEnabledRaw;
    
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      try {
        const storageData = await new Promise(resolve => {
          window.browserAPI.storage.local.get(['welcome-enabled'], resolve);
        });
        welcomeEnabledRaw = storageData['welcome-enabled'];
        console.log('[Welcome Debug] Using extension storage');
      } catch (storageError) {
        console.warn('[Welcome Debug] Extension storage failed, using localStorage:', storageError);
        welcomeEnabledRaw = localStorage.getItem('welcome-enabled');
      }
    } else {
      welcomeEnabledRaw = localStorage.getItem('welcome-enabled');
      console.log('[Welcome Debug] Using localStorage');
    }
    
    const welcomeEnabled = welcomeEnabledRaw !== 'false'; // Default to true if not set
    
    console.log('[Welcome Debug] shouldShowWelcome - welcomeEnabledRaw:', welcomeEnabledRaw);
    console.log('[Welcome Debug] shouldShowWelcome - welcomeEnabled:', welcomeEnabled);
    
    return welcomeEnabled;
  } catch (error) {
    console.warn('Could not check welcome preference:', error);
    return true; // Default to showing welcome if we can't check
  }
}

// Set the never show again preference
async function setNeverShowAgain() {
  try {
    // Simply set welcome-enabled to false - this controls both the popup slider and welcome display
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      await new Promise(resolve => {
        window.browserAPI.storage.local.set({
          'welcome-enabled': 'false'
        }, resolve);
      });
      console.log('Welcome page set to never show again and popup disabled (extension storage)');
    } else {
      localStorage.setItem('welcome-enabled', 'false');
      console.log('Welcome page set to never show again and popup disabled (localStorage)');
    }
    
    // Send message to popup via browser extension messaging
    if (window.browserAPI && window.browserAPI.runtime) {
      window.browserAPI.runtime.sendMessage({
        action: 'disableWelcomeToggle'
      }).catch(error => {
        console.warn('Could not send message to popup:', error);
      });
    }
    
    // Also try window.postMessage as fallback
    window.postMessage({
      from: 'BESTIARY_WELCOME',
      action: 'disableWelcomeToggle'
    }, '*');
  } catch (error) {
    console.warn('Could not save welcome preference:', error);
  }
}

// Get extension version dynamically
async function getExtensionVersion() {
  console.log('[Welcome] Getting extension version...');
  try {
    // Use the same message passing pattern as other mods
    const response = await new Promise((resolve) => {
      const messageId = `welcome_version_${Date.now()}_${Math.random()}`;
      
      // Set up response listener
      const handleResponse = (event) => {
        if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener('message', handleResponse);
      
      // Send request to content script
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        id: messageId,
        message: { action: 'getVersion' }
      }, '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout' });
      }, 5000);
    });
    
    console.log('[Welcome] Version response:', response);
    
    if (response && response.success && response.version) {
      return response.version;
    }
    
    // If no version found, return unknown
    console.log('[Welcome] No version found, returning unknown');
    return 'unknown';
  } catch (error) {
    console.warn('[Welcome] Could not get extension version:', error);
    return 'unknown';
  }
}

// Get mod counts dynamically
async function getModCounts() {
  console.log('[Welcome] Getting mod counts...');
  try {
    const response = await new Promise((resolve) => {
      const messageId = `welcome_modcounts_${Date.now()}_${Math.random()}`;
      
      // Set up response listener
      const handleResponse = (event) => {
        if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.id === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener('message', handleResponse);
      
      // Send request to content script
      window.postMessage({
        from: 'BESTIARY_CLIENT',
        id: messageId,
        message: { action: 'getModCounts' }
      }, '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        resolve({ success: false, error: 'Timeout' });
      }, 5000);
    });
    
    console.log('[Welcome] Mod counts response:', response);
    
    if (response && response.success && response.counts) {
      return response.counts;
    }
    
    // If API fails, throw error with details
    if (response && response.error) {
      throw new Error(`Background script error: ${response.error}`);
    } else if (!response) {
      throw new Error('No response from background script (timeout or message passing failure)');
    } else {
      throw new Error('Failed to get mod counts from background script');
    }
  } catch (error) {
    console.error('[Welcome] Could not get mod counts:', error);
    // Return null to indicate failure - welcome modal will handle gracefully
    return null;
  }
}

// =======================
// 5. Lifecycle Tracking Helpers
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
  const key = `${element === window ? 'window' : element.constructor.name}_${event}`;
  if (!activeEventListeners.has(key)) {
    activeEventListeners.set(key, []);
  }
  activeEventListeners.get(key).push({ element, event, handler });
  element.addEventListener(event, handler);
}

function removeTrackedEventListener(element, event, handler) {
  const key = `${element === window ? 'window' : element.constructor.name}_${event}`;
  const listeners = activeEventListeners.get(key);
  if (listeners) {
    const index = listeners.findIndex(l => l.handler === handler);
    if (index !== -1) {
      listeners.splice(index, 1);
      element.removeEventListener(event, handler);
      if (listeners.length === 0) {
        activeEventListeners.delete(key);
      }
    }
  }
}

// =======================
// 6. Mod Loading Lifecycle
// =======================

function isGameStateReadyForMods() {
  try {
    const state = globalThis.state;
    if (!state?.player?.getSnapshot || !state?.board?.getSnapshot) {
      return false;
    }
    const boardCtx = state.board.getSnapshot()?.context;
    const playerCtx = state.player.getSnapshot()?.context;
    return !!(boardCtx && playerCtx);
  } catch {
    return false;
  }
}

function hasReactHydrationErrorForWelcome() {
  return !!(
    window.__BA_REACT_HYDRATION_ERROR__ ||
    window.localModsAPI?.hasReactHydrationError?.()
  );
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
      console.log('[Welcome] Mod batch still running, extending fallback timer');
      scheduleModLoadingFallbackTimer();
      return;
    }

    if (window.localModsAPI?.wasCompletionSignalSent?.()) {
      const errors = window.localModsAPI.getLastLoadErrors?.() || [];
      console.log('[Welcome] Completion signal sent but message missed — recovering');
      handleModLoadingFinished(errors);
      return;
    }

    console.log('[Welcome] Mod loading completion timeout — treating as load failure');
    handleModLoadingFinished([{ mod: 'loader', error: 'Loading timed out' }]);
  }, MOD_LOAD_FALLBACK_DELAY));
}

function onModBatchExecutionStarted() {
  console.log('[Welcome] Mod batch execution started — arming fallback timer');
  scheduleModLoadingFallbackTimer();
}

async function handleModLoadingFinished(errors = []) {
  console.log('[Welcome] handleModLoadingFinished called, errors:', errors);
  console.log('[Welcome] loadingToast exists:', !!loadingToast);
  console.log('[Welcome] loadingCompleted:', loadingCompleted);
  
  // Prevent duplicate processing
  if (loadingCompleted) {
    console.log('[Welcome] Loading already completed, skipping duplicate call');
    return;
  }
  
  loadingCompleted = true;
  clearModLoadingFallbackTimer();

  if (modLoadingObserver) {
    modLoadingObserver.disconnect();
    modLoadingObserver = null;
  }

  let resolvedErrors = Array.isArray(errors) ? [...errors] : [];
  const strictCompletion = window.BestiaryPlatform?.useStrictLoaderCompletion?.() ?? true;

  if (strictCompletion && resolvedErrors.length === 0 && !isGameStateReadyForMods()) {
    const hasGameMods = window.localMods?.some(mod => mod.enabled && !mod.name.startsWith('database/'));
    if (hasGameMods) {
      resolvedErrors.push({ mod: 'loader', error: 'Game state not ready (board/player unavailable)' });
      console.warn('[Welcome] Mod batch reported success but game state is not ready — treating as load failure');
    }
  } else if (!strictCompletion && resolvedErrors.length === 0 && !isGameStateReadyForMods()) {
    console.warn('[Welcome] Relaxed loader: game state not ready at completion (non-fatal)');
  }

  if (strictCompletion && resolvedErrors.length === 0 && hasReactHydrationErrorForWelcome()) {
    resolvedErrors.push({ mod: 'loader', error: 'React hydration error detected (#418/#423)' });
    console.warn('[Welcome] React hydration error detected — treating as load failure');
  } else if (!strictCompletion && resolvedErrors.length === 0 && hasReactHydrationErrorForWelcome()) {
    console.warn('[Welcome] Relaxed loader: hydration error at completion (non-fatal)');
  }

  const hasErrors = resolvedErrors.length > 0;

  loadingToast?.remove?.();
  loadingToast = null;

  if (hasErrors) {
    modsLoaded = false;
    const incomingHadErrors = Array.isArray(errors) && errors.length > 0;
    const failedModNames = resolvedErrors.map(e => e.mod || 'unknown').join(', ');
    console.log('[Welcome] Mod loading had errors:', failedModNames);

    if (!incomingHadErrors) {
      window.BestiaryUIComponents?.handleLoaderLoadFailure?.(resolvedErrors);
    }
    return;
  }

  modsLoaded = true;
  window.BestiaryUIComponents?.resetModLoadRetryCount?.();

  try {
    createToast({
      message: '<span class="text-monster">Mods</span> loaded successfully!',
      type: 'success',
      duration: 5000,
      icon: WELCOME_ASSETS.logo
    });

    console.log('[Welcome] Completion toast created successfully');
    handleCompletionModalClose('(completion toast)');
  } catch (error) {
    console.error('[Welcome] Error creating completion toast:', error);
    handleCompletionModalClose('(error fallback)');
  }
}

async function updateLoadingToComplete(errors = []) {
  return handleModLoadingFinished(errors);
}

// =======================
// 7. Layout Utilities & Modal Shell
// =======================

function getWelcomeModalDimensions() {
  const pad = WELCOME_MODAL_SIZE.viewportPadding * 2;
  return {
    width: Math.max(
      WELCOME_MODAL_SIZE.minWidth,
      Math.min(WELCOME_MODAL_SIZE.width, window.innerWidth - pad)
    ),
    height: Math.max(
      WELCOME_MODAL_SIZE.minHeight,
      Math.min(WELCOME_MODAL_SIZE.height, window.innerHeight - pad)
    )
  };
}

function getWelcomeOpenDialog() {
  return document.querySelector('div[role="dialog"][data-welcome-dialog="1"]') ||
    document.querySelector('div[role="dialog"][data-state="open"]') ||
    document.querySelector('div[role="dialog"]');
}

function getWelcomeDialog(modalRef) {
  if (modalRef?.element?.isConnected) return modalRef.element;
  if (modalRef instanceof HTMLElement && modalRef.isConnected) return modalRef;
  if (currentModal?.element?.isConnected) return currentModal.element;
  return getWelcomeOpenDialog();
}

function ensureWelcomeScrollbarStyles() {
  if (document.getElementById('welcome-modal-scrollbar-styles')) return;
  const style = document.createElement('style');
  style.id = 'welcome-modal-scrollbar-styles';
  style.textContent = `
    .welcome-scroll-area {
      scrollbar-width: thin !important;
      scrollbar-color: #444 #222 !important;
    }
    .welcome-scroll-area::-webkit-scrollbar {
      width: 10px !important;
      background: #222 !important;
    }
    .welcome-scroll-area::-webkit-scrollbar-thumb {
      background: #444 !important;
      border: 2px solid #666 !important;
      border-radius: 2px !important;
    }
    .welcome-feature-row {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      margin: 0;
      font-size: 14px;
      line-height: 1.35;
    }
    .welcome-feature-row .welcome-inline-icon {
      flex-shrink: 0;
      margin-top: 1px;
      margin-right: 0;
    }
  `;
  document.head.appendChild(style);
}

function buildWelcomeModalContent({ officialCount, superCount, otCount, version }) {
  ensureWelcomeScrollbarStyles();

  const content = document.createElement('div');
  content.className = 'welcome-modal-root';
  Object.assign(content.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    minHeight: '0',
    minWidth: '0',
    flex: '1 1 auto',
    boxSizing: 'border-box',
    overflow: 'hidden'
  });

  const mainPanel = document.createElement('div');
  mainPanel.className = 'welcome-main-panel';
  Object.assign(mainPanel.style, {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    minHeight: '0',
    minWidth: '0',
    height: 'auto',
    boxSizing: 'border-box',
    overflow: 'hidden',
    border: '6px solid transparent',
    borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch'
  });

  const scrollArea = document.createElement('div');
  scrollArea.className = 'welcome-scroll-area';
  Object.assign(scrollArea.style, {
    flex: '1 1 0',
    minHeight: '0',
    minWidth: '0',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: 'clamp(8px, 2vw, 14px)',
    textAlign: 'center',
    color: '#a6adc8',
    lineHeight: '1.35',
    background: "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat",
    wordBreak: 'break-word'
  });

  const versionLabel = version !== 'unknown' ? ` v${version}` : '';
  const featureRow = (icon, label, text) => `
    <p class="welcome-feature-row">
      <img src="${icon}" alt="" class="pixelated welcome-inline-icon" width="16" height="16">
      <span><strong>${label}</strong> ${text}</span>
    </p>`;

  scrollArea.innerHTML = `
    <div style="margin-bottom: 10px;">
      <h2 style="color: #a6adc8; margin: 0 0 6px; font-size: 18px; line-height: 1.3;">
        ${welcomeInlineIcon(WELCOME_ASSETS.logo, { size: 20, alt: 'Bestiary Arena' })}Bestiary Arena SuperMod Loader
      </h2>
      <p style="color: #a6adc8; margin: 0; font-size: 14px; line-height: 1.4;">
        Powerful tools and improvements for a more efficient Bestiary Arena experience.
      </p>
    </div>
    <div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; box-sizing: border-box;">
      <h3 style="color: #a6adc8; margin: 0 0 8px; font-size: 15px; text-align: left;">
        ${welcomeInlineIcon(WELCOME_ASSETS.shinyStar, { alt: 'Features' })}What's Included
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 4px 14px; text-align: left; color: #a6adc8;">
        ${featureRow(WELCOME_ASSETS.spellbook, `${officialCount} Original Mods:`, 'Automator, Board Analyzer, Hero Editor, and more. <em>(On by default)</em>')}
        ${featureRow(WELCOME_ASSETS.starAwaken, `${superCount} Super Mods:`, 'Autoseller, Cyclopedia, Hunt Analyzer, Raid Hunter, and more. <em>(Mostly off)</em>')}
        ${featureRow(WELCOME_ASSETS.chat, `${otCount} OT Mods:`, 'Challenges, Guilds, VIP List, Quests. <em>(Off by default)</em>')}
        ${featureRow(WELCOME_ASSETS.chest, 'Backups:', 'Import and export settings via Mod Settings.')}
        ${featureRow(WELCOME_ASSETS.quest, 'Patch Notes:', 'See what\'s new each version in the popup.')}
        ${featureRow(WELCOME_ASSETS.premium, 'Popup Controls:', 'Enable mods, add Gist scripts, manage extras.')}
        ${featureRow(WELCOME_ASSETS.grade, 'Analytics:', 'Hunt Analyzer, Run Tracker, Better Analytics, and more.')}
      </div>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; min-width: 0;">
      <div style="background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3); border-radius: 6px; padding: 8px 10px; flex: 1 1 180px; min-width: 0; box-sizing: border-box;">
        <p style="color: #a6adc8; margin: 0; font-size: 14px; line-height: 1.4; text-align: left;">
          ${welcomeInlineIcon(WELCOME_ASSETS.starTier, { alt: 'Approved' })}<strong>Safe & Approved</strong> — Officially approved by Xandjiji. Single-player enhancement only.
        </p>
      </div>
      <div style="background: rgba(0,255,0,0.1); border: 1px solid rgba(0,255,0,0.3); border-radius: 6px; padding: 8px 10px; flex: 1 1 180px; min-width: 0; box-sizing: border-box;">
        <p style="color: #a6adc8; margin: 0; font-size: 14px; line-height: 1.4; text-align: left;">
          ${welcomeInlineIcon(WELCOME_ASSETS.stamina, { alt: 'Tip' })}<strong>Tip</strong> — Open the extension popup to toggle mods. Re-enable this welcome page from Extras anytime.
        </p>
      </div>
    </div>
    <div style="color: #a6adc8; font-size: 14px; text-align: center;">
      <p style="margin: 0 0 4px; line-height: 1.4;">
        ${welcomeInlineIcon(WELCOME_ASSETS.shinyStar, { alt: '' })}Enjoy your enhanced Bestiary Arena experience!
      </p>
      <p style="font-size: 13px; opacity: 0.7; margin: 0;">Bestiary Arena SuperMod Loader${versionLabel}</p>
    </div>
  `;

  mainPanel.appendChild(scrollArea);
  content.appendChild(mainPanel);

  return content;
}

function applyWelcomeModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getWelcomeDialog(modalRef);
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
  dialog.setAttribute('data-welcome-dialog', '1');

  const innerWrapper = dialog.querySelector(':scope > div') || dialog.firstElementChild;
  if (innerWrapper) {
    Object.assign(innerWrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '0',
      flex: '1 1 0',
      boxSizing: 'border-box'
    });
  }

  const contentElem = dialog.querySelector('.widget-bottom');
  if (contentElem) {
    Object.assign(contentElem.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      overflowY: 'hidden',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      minWidth: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  const mainPanel = dialog.querySelector('.welcome-main-panel');
  if (mainPanel) {
    Object.assign(mainPanel.style, {
      flex: '1 1 0',
      minHeight: '0',
      minWidth: '0',
      height: 'auto',
      maxHeight: 'none',
      overflow: 'hidden'
    });
  }

  const scrollArea = dialog.querySelector('.welcome-scroll-area');
  if (scrollArea) {
    Object.assign(scrollArea.style, {
      flex: '1 1 0',
      minHeight: '0',
      minWidth: '0',
      width: '100%',
      boxSizing: 'border-box',
      overflowX: 'hidden',
      overflowY: 'auto'
    });
  }

  const buttonFooter = dialog.querySelector('.widget-bottom > .flex.justify-end.gap-2');
  if (buttonFooter) {
    buttonFooter.style.flexShrink = '0';
  }
}

function setupWelcomeModalResponsiveLayout(modalRef, contentRoot) {
  clearWelcomeModalLayoutCleanup();
  const apply = () => applyWelcomeModalLayout(modalRef, contentRoot, getWelcomeModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  welcomeModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
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

function createToast({ message, type = 'info', duration = 3000, icon = null }) {
  // Get or create the main toast container
  let mainContainer = document.getElementById('welcome-toast-container');
  if (!mainContainer) {
    mainContainer = document.createElement('div');
    mainContainer.id = 'welcome-toast-container';
    mainContainer.style.cssText = `
      position: fixed;
      z-index: 9999;
      inset: 16px 16px 64px;
      pointer-events: none;
    `;
    mainContainer.setAttribute('data-aria-hidden', 'true');
    mainContainer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mainContainer);
  }
  
  // Count existing toasts to calculate stacking position
  const existingToasts = mainContainer.querySelectorAll('.toast-item');
  const stackOffset = existingToasts.length * 46; // 46px per toast
  
  // Create the flex container for this specific toast
  const flexContainer = document.createElement('div');
  flexContainer.className = 'toast-item';
  flexContainer.style.cssText = `
    left: 0px;
    right: 0px;
    display: flex;
    position: absolute;
    transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1);
    transform: translateY(-${stackOffset}px);
    bottom: 0px;
    justify-content: flex-end;
  `;
  
  // Create toast button with proper animation classes
  const toast = document.createElement('button');
  toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
  
  // Create widget structure to match game's toast style
  const widgetTop = document.createElement('div');
  widgetTop.className = 'widget-top h-2.5';
  
  const widgetBottom = document.createElement('div');
  widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
  
  // Add icon if provided
  if (icon) {
    const iconImg = document.createElement('img');
    iconImg.alt = type;
    iconImg.src = icon;
    iconImg.className = 'pixelated';
    iconImg.style.cssText = 'width: 16px; height: 16px;';
    widgetBottom.appendChild(iconImg);
  }
  
  // Add message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'text-left';
  messageDiv.innerHTML = message; // Use innerHTML to support HTML content like spans
  widgetBottom.appendChild(messageDiv);
  
  // Assemble toast
  toast.appendChild(widgetTop);
  toast.appendChild(widgetBottom);
  flexContainer.appendChild(toast);
  mainContainer.appendChild(flexContainer);
  
  // Debug: Log toast creation
  console.log('[Welcome] Toast created and added to DOM:', {
    container: !!mainContainer,
    stackOffset: stackOffset,
    duration: duration,
    totalToasts: existingToasts.length + 1
  });
  
  // Auto-remove after duration (duration 0 = keep until manually removed)
  if (duration > 0) {
    const timeoutId = trackTimeout(setTimeout(() => {
      if (flexContainer && flexContainer.parentNode) {
        console.log('[Welcome] Auto-removing toast after', duration, 'ms');
        flexContainer.parentNode.removeChild(flexContainer);
        
        // Update positions of remaining toasts
        updateToastPositions(mainContainer);
      }
      activeTimeouts.delete(timeoutId);
    }, duration));
  }
  
  return {
    element: flexContainer,
    remove: () => {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateToastPositions(mainContainer);
      }
    }
  };
}

// Update positions of remaining toasts when one is removed
function updateToastPositions(container) {
  const toasts = container.querySelectorAll('.toast-item');
  toasts.forEach((toast, index) => {
    const offset = index * 46;
    toast.style.transform = `translateY(-${offset}px)`;
  });
}

// Show loading toast
function showLoadingToast() {
  console.log('[Welcome] showLoadingToast called');
  
  try {
    loadingToast = createToast({
      message: '<span class="text-monster">Loading mods</span>...',
      type: 'loading',
      duration: 0,
      icon: WELCOME_ASSETS.logo
    });

    console.log('[Welcome] Loading toast created:', !!loadingToast);
  } catch (error) {
    console.error('[Welcome] Error creating loading toast:', error);
  }
}

function hideLoadingToast() {
  console.log('[Welcome] hideLoadingToast called');
  console.log('[Welcome] loadingToast exists:', !!loadingToast);
  console.log('[Welcome] loadingCompleted:', loadingCompleted);
  
  if (loadingToast && typeof loadingToast.remove === 'function') {
    loadingToast.remove();
    loadingToast = null;
    console.log('[Welcome] Loading toast hidden successfully');
  } else {
    console.warn('[Welcome] Could not hide loading toast - invalid toast object');
  }
  
  // If loading was completed but toast was closed, show welcome modal as fallback
  if (loadingCompleted) {
    trackTimeout(setTimeout(() => handleCompletionModalClose('(loading completed but toast was closed)'), 100));
  }
}

// =======================
// 9. Welcome Modal
// =======================

async function handleCompletionModalClose(source = '') {
  const shouldShow = await shouldShowWelcome();
  if (shouldShow && config.showWelcome) {
    console.log(`[Welcome] Showing welcome modal after completion modal ${source}`);
    showWelcomeModal();
  } else {
    console.log('[Welcome] Welcome modal skipped (user preference or config)');
  }
}

async function showWelcomeModal() {
  // Try to close other modals and check if we can proceed
  const stillHasModals = await tryCloseModalsAndCheck();
  if (stillHasModals) {
    console.log('[Welcome] Aborting welcome modal - other modal is still open after ESC attempts');
    modalAborted = true; // Mark as aborted to prevent future attempts
    return;
  }
  
  // If we successfully closed modals, reset the abort flag
  if (modalAborted) {
    console.log('[Welcome] Modals were closed successfully, resetting abort flag');
    modalAborted = false;
  }
  
  if (!api || !api.ui || !api.ui.components) {
    console.error('[Welcome] API not available');
    return;
  }

  try {
    const [version, modCounts] = await Promise.all([
      getExtensionVersion(),
      getModCounts()
    ]);
    console.log('[Welcome] Version received:', version);
    console.log('[Welcome] Mod counts received:', modCounts);
    
    // Handle case where mod counts couldn't be fetched
    const officialCount = modCounts?.official || 'Multiple';
    const superCount = modCounts?.super || 'Multiple';
    const otCount = modCounts?.ot || 'Multiple';
    
    clearWelcomeModalLayoutCleanup();

    const modalDimensions = getWelcomeModalDimensions();
    let modal = null;
    const content = buildWelcomeModalContent({
      officialCount,
      superCount,
      otCount,
      version
    });

    modal = api.ui.components.createModal({
      title: 'Welcome to Bestiary Arena SuperMod Loader!',
      width: modalDimensions.width,
      height: modalDimensions.height,
      content,
      buttons: [
        {
          text: 'Never Show Again',
          onClick: () => setNeverShowAgain()
        },
        {
          text: 'Got It!',
          primary: true
        }
      ]
    });

    // Add ESC key support for closing modal
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal?.close?.();
        removeTrackedEventListener(document, 'keydown', escHandler);
      }
    };
    trackEventListener(document, 'keydown', escHandler);

    setupWelcomeModalResponsiveLayout(modal, content);

    const originalClose = modal.close?.bind(modal);
    if (originalClose) {
      modal.close = () => {
        clearWelcomeModalLayoutCleanup();
        originalClose();
        if (currentModal === modal) {
          currentModal = null;
        }
      };
    }

    // Store modal reference for cleanup
    currentModal = modal;
  } catch (error) {
    console.error('[Welcome] Error creating welcome modal:', error);
  }
}

// =======================
// 10. Initialization & Messaging
// =======================

async function handleWelcomeToggle(event) {
  if (event.source !== window) return;
  
  if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'updateWelcomeMode') {
    const enabled = event.data.enabled;
    console.log('[Welcome] Received toggle update:', enabled);
    
    if (enabled) {
      console.log('[Welcome] Welcome page enabled via popup toggle');
    } else {
      console.log('[Welcome] Welcome page disabled via popup toggle');
    }
  }
}

function checkPopupToggleStatus() {
  try {
    const welcomeEnabled = localStorage.getItem('welcome-enabled');
    console.log('[Welcome Debug] checkPopupToggleStatus - welcomeEnabled:', welcomeEnabled);
  } catch (error) {
    console.warn('Could not check popup toggle status:', error);
  }
}

function setupModLoadingObserver() {
  console.log('[Welcome] Setting up mod loading completion listener');
  
  // Listen for completion and error messages from local_mods.js
  const messageHandler = (event) => {
    if (event.source !== window) return;
    
    
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'modBatchExecutionStarted') {
      onModBatchExecutionStarted();
    }

    // Listen for mod loading completion message
    if (event.data?.from === 'LOCAL_MODS_LOADER' && event.data?.action === 'allModsLoaded') {
      const errors = event.data.errors || [];
      console.log('[Welcome] Received mod loading completion signal from local_mods.js', errors.length ? `with ${errors.length} error(s)` : 'without errors');
      handleModLoadingFinished(errors);
    }
    
  };
  
  trackEventListener(window, 'message', messageHandler);
  
  // Store the handler for cleanup
  modLoadingObserver = {
    disconnect: () => {
      removeTrackedEventListener(window, 'message', messageHandler);
      console.log('[Welcome] Mod loading completion listener removed');
    }
  };

  if (window.localModsAPI?.isBatchExecuting?.()) {
    onModBatchExecutionStarted();
  }
}

async function initializeWelcome() {
  console.log('[Welcome] initializeWelcome called');
  
  // Set up mod loading completion listener immediately (before API check)
  console.log('[Welcome] Setting up mod loading completion listener...');
  setupModLoadingObserver();
  
  // Show loading toast immediately (no API dependency needed)
  console.log('[Welcome] Starting loading process');
  showLoadingToast();
}

checkPopupToggleStatus();
initializeWelcome();
trackEventListener(window, 'message', handleWelcomeToggle);

// =======================
// 11. Cleanup & Exports
// =======================

function cleanup() {
  console.log('[Welcome] Cleaning up...');
  
  // Clear all tracked timeouts
  activeTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
  });
  activeTimeouts.clear();
  
  // Remove all tracked event listeners
  activeEventListeners.forEach((listeners, key) => {
    listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
  });
  activeEventListeners.clear();
  
  // Disconnect observer
  clearModLoadingFallbackTimer();
  if (modLoadingObserver) {
    modLoadingObserver.disconnect();
    modLoadingObserver = null;
  }
  
  clearWelcomeModalLayoutCleanup();

  // Close any open modal
  if (currentModal && typeof currentModal.close === 'function') {
    currentModal.close();
    currentModal = null;
  }
  
  // Close any open toasts
  if (loadingToast && typeof loadingToast.remove === 'function') {
    loadingToast.remove();
    loadingToast = null;
  }
  
  // Clean up toast container
  const toastContainer = document.getElementById('welcome-toast-container');
  if (toastContainer && toastContainer.parentNode) {
    toastContainer.parentNode.removeChild(toastContainer);
  }
  
  // Reset state variables
  loadingCompleted = false;
  modalAborted = false;
  modsLoaded = false;
}

exports = {
  showWelcome: showWelcomeModal,
  setNeverShowAgain,
  shouldShowWelcome,
  showLoading: showLoadingToast,
  hideLoading: hideLoadingToast,
  updateLoadingToComplete: updateLoadingToComplete,
  isModsLoaded: () => modsLoaded,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup: cleanup
};
