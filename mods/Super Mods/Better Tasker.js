// Better Tasker - A mod for Bestiary Arena
console.log('[Better Tasker] initializing...');

// ============================================================================
// 1. CONSTANTS
// ============================================================================

// UI Text Constants - Centralized text management for multi-language support
const UI_TEXT = {
    BUTTONS: {
        ENABLED: 'Enabled',
        SETTINGS: 'Settings',
        CLOSE: 'Close',
        START: 'Start',
        REMOVE: 'Remove',
        CONFIRM: 'Confirm',
        AUTO_SETUP: 'Auto-setup',
        NEW_TASK: 'New task'
    },
    BUTTONS_PT: {
        ENABLED: 'Habilitado',
        SETTINGS: 'Configurações', 
        CLOSE: 'Fechar',
        START: 'Iniciar',
        REMOVE: 'Remover',
        CONFIRM: 'Confirmar',
        AUTO_SETUP: 'Autoconfigurar',
        NEW_TASK: 'Nova tarefa'
    },
    LABELS: {
        TASK_START_DELAY: 'Task Start Delay (seconds)',
        AUTO_REFILL_STAMINA: 'Auto-refill Stamina',
        FASTER_AUTOPLAY: 'Faster Autoplay',
        AUTOCOMPLETE_TASKS: 'Autocomplete Tasks',
        ENABLE_AUTOPLANT: 'Enable Autoplant',
        CREATURE_SELECTION: 'Select which creatures you want to hunt for tasks:',
        WARNING_UNSELECTED: 'Unselected creatures will cause active tasks to be removed'
    },
    LABELS_PT: {
        TASK_START_DELAY: 'Delay de Início da Tarefa (segundos)',
        AUTO_REFILL_STAMINA: 'Recarregar Stamina Automaticamente',
        FASTER_AUTOPLAY: 'Autoplay Mais Rápido',
        AUTOCOMPLETE_TASKS: 'Autocompletar Tarefas',
        ENABLE_AUTOPLANT: 'Ativar Vendedor Automático de Planta Dragão',
        CREATURE_SELECTION: 'Selecione quais criaturas você quer caçar para tarefas:',
        WARNING_UNSELECTED: 'Criaturas não selecionadas causarão remoção de tarefas ativas'
    },
    DESCRIPTIONS: {
        NO_CREATURES_AVAILABLE: 'No creatures available. Please refresh the page.'
    },
    DESCRIPTIONS_PT: {
        NO_CREATURES_AVAILABLE: 'Nenhuma criatura disponível. Por favor, atualize a página.'
    },
    QUEST_TEXT: {
        SUGGESTED_MAP: 'Suggested map:'
    },
    QUEST_TEXT_PT: {
        SUGGESTED_MAP: 'Mapa sugerido:'
    }
};

const MOD_ID = 'better-tasker';
const TASKER_BUTTON_ID = `${MOD_ID}-settings-button`;
const TASKER_TOGGLE_ID = `${MOD_ID}-toggle-button`;

// Language detection function
function isPortuguese() {
    return document.documentElement.lang === 'pt-BR' || 
           document.querySelector('html[lang="pt-BR"]') || 
           navigator.language.startsWith('pt-BR') ||
           window.location.href.includes('/pt/');
}

// Get localized text based on current language
function getLocalizedText(englishText, portugueseText) {
    return isPortuguese() ? portugueseText : englishText;
}

// Default settings constants
const DEFAULT_TASK_START_DELAY = 3;

// Tasker states
const TASKER_STATES = {
    DISABLED: 'disabled',
    NEW_TASK_ONLY: 'new_task_only',
    ENABLED: 'enabled'
};
const DEFAULT_TASKER_STATE = TASKER_STATES.DISABLED;

// Timing constants - Standardized across all mods
const NAVIGATION_DELAY = 500;           // Reduced from 200ms for consistency
const AUTO_SETUP_DELAY = 800;          // Reduced from 1000ms for faster response
const AUTOPLAY_SETUP_DELAY = 500;      // Reduced from 1000ms for faster response
const AUTOMATION_CHECK_DELAY = 300;    // New standardized delay
const BESTIARY_INTEGRATION_DELAY = 300; // Reduced from 500ms for faster response
const BESTIARY_RETRY_DELAY = 1500;     // Reduced from 2000ms for faster response
const BESTIARY_INIT_WAIT = 2000;       // Reduced from 3000ms for faster response

// Legacy constants removed - now using standardized timing constants

// User-configurable delays
const DEFAULT_START_DELAY = 3;         // 3 seconds default (user-configurable 1-10)
const MAX_START_DELAY = 10;            // 10 seconds maximum
const ESC_KEY_DELAY = 50;
const TASK_START_DELAY = 200;

// Stamina constants
const DEFAULT_STAMINA_COST = 30;

// ============================================================================
// 1.1. DOM UTILITY FUNCTIONS
// ============================================================================

// Utility function to handle control request/release with proper error handling
function withControl(manager, modName, callback, errorContext = 'operation') {
    // Request control
    if (!manager.requestControl(modName)) {
        console.log(`[Better Tasker] Cannot ${errorContext} - controlled by another mod`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Better Tasker] Error during ${errorContext}:`, error);
        return false;
    } finally {
        // Always release control
        manager.releaseControl(modName);
    }
}

// Utility function to handle control check/release with proper error handling
function withControlCheck(manager, modName, callback, errorContext = 'operation') {
    // Check if we have control
    if (!manager.hasControl(modName)) {
        console.log(`[Better Tasker] Cannot ${errorContext} - not controlled by Better Tasker`);
        return false;
    }
    
    try {
        const result = callback();
        return result;
    } catch (error) {
        console.error(`[Better Tasker] Error during ${errorContext}:`, error);
        return false;
    } finally {
        // Always release control
        manager.releaseControl(modName);
    }
}

// Create a styled button with consistent styling
function createStyledButton(id, text, color, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = `focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-${color} active:frame-pressed-1-${color} surface-${color} gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight`;
    button.style.cssText = `
        padding: 2px 6px;
        height: 20px;
    `;
    button.addEventListener('click', onClick);
    return button;
}

// Create a styled button with custom styling
function createCustomStyledButton(id, text, className, style, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.className = className;
    button.style.cssText = style;
    button.addEventListener('click', onClick);
    return button;
}

// Create a styled container div
function createStyledContainer(className, style) {
    const container = document.createElement('div');
    if (className) container.className = className;
    if (style) container.style.cssText = style;
    return container;
}

// Create a styled input element
function createStyledInput(type, id, value, style, attributes = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    if (value !== undefined) input.value = value;
    if (style) input.style.cssText = style;
    
    // Apply additional attributes
    Object.entries(attributes).forEach(([key, val]) => {
        input[key] = val;
    });
    
    return input;
}

// Helper function to add tracked event listeners
function addTrackedListener(element, event, handler) {
    element.addEventListener(event, handler);
    if (!trackedListeners.has(element)) {
        trackedListeners.set(element, []);
    }
    trackedListeners.get(element).push({ event, handler });
}

// Helper function to clear tracked timeouts
function clearTrackedTimeouts() {
    safetyTimeouts.forEach(timeoutId => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
    safetyTimeouts = [];
}

// Create a reusable checkbox setting with label and description
function createCheckboxSetting(id, labelText, description, checked = false) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    // Container for checkbox and label on same line
    const checkboxLabelContainer = document.createElement('div');
    checkboxLabelContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    `;
    
    const checkbox = createStyledInput('checkbox', id, undefined, `
        width: 16px;
        height: 16px;
        accent-color: #ffe066;
    `, { checked });
    // Add auto-save listener with tracking
    addTrackedListener(checkbox, 'change', autoSaveSettings);
    checkboxLabelContainer.appendChild(checkbox);
    
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'pixel-font-16';
    label.style.cssText = `
        font-weight: bold;
        color: #fff;
        cursor: pointer;
    `;
    label.setAttribute('for', id);
    checkboxLabelContainer.appendChild(label);
    
    settingDiv.appendChild(checkboxLabelContainer);
    
    const desc = document.createElement('div');
    desc.textContent = description;
    desc.className = 'pixel-font-16';
    desc.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(desc);
    
    return settingDiv;
}

function createDropdownSetting(id, label, description, value = 'Auto-setup', options = ['Auto-setup']) {
    const settingDiv = document.createElement('div');
    settingDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'pixel-font-16';
    labelElement.setAttribute('for', id);
    labelElement.style.cssText = `
        font-weight: bold;
        color: #fff;
        margin-bottom: 4px;
    `;
    settingDiv.appendChild(labelElement);
    
    const selectElement = document.createElement('select');
    selectElement.id = id;
    selectElement.className = 'pixel-font-16';
    selectElement.style.cssText = `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
        cursor: pointer;
    `;
    
    // Add options to dropdown
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        optionElement.style.cssText = `
            background: #333;
            color: #fff;
        `;
        selectElement.appendChild(optionElement);
    });
    
    // Set initial value
    selectElement.value = value;
    addTrackedListener(selectElement, 'change', autoSaveSettings);
    settingDiv.appendChild(selectElement);
    
    const descElement = document.createElement('div');
    descElement.textContent = description;
    descElement.className = 'pixel-font-16';
    descElement.style.cssText = `
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 2px;
    `;
    settingDiv.appendChild(descElement);
    
    return settingDiv;
}

// Sleep function for delays
function sleep(timeout = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
}

// Clear modals by simulating ESC key presses (async version with delays)
async function clearModalsWithEsc(count = 3, delayBetween = ESC_KEY_DELAY) {
    for (let i = 0; i < count; i++) {
        const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(escEvent);
        if (i < count - 1) {
            await sleep(delayBetween);
        }
    }
}

// Clear modals by simulating ESC key presses (sync version without delays)
function clearModalsWithEscSync(count = 3) {
    for (let i = 0; i < count; i++) {
        const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(escEvent);
    }
}

// Show toast notification
function showToast(message, duration = 5000) {
    try {
        // Use custom toast implementation (same as Welcome.js)
        // Get or create the main toast container
        let mainContainer = document.getElementById('bt-toast-container');
        if (!mainContainer) {
            mainContainer = document.createElement('div');
            mainContainer.id = 'bt-toast-container';
            mainContainer.style.cssText = `
                position: fixed;
                z-index: 9999;
                inset: 16px 16px 64px;
                pointer-events: none;
            `;
            document.body.appendChild(mainContainer);
        }
        
        // Count existing toasts to calculate stacking position
        const existingToasts = mainContainer.querySelectorAll('.toast-item');
        const stackOffset = existingToasts.length * 46;
        
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
        
        // Create toast button
        const toast = document.createElement('button');
        toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
        
        // Create widget structure
        const widgetTop = document.createElement('div');
        widgetTop.className = 'widget-top h-2.5';
        
        const widgetBottom = document.createElement('div');
        widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
        
        // Add icon (taskrank icon for tasks)
        const iconImg = document.createElement('img');
        iconImg.alt = 'task';
        iconImg.src = 'https://bestiaryarena.com/assets/icons/taskrank.png';
        iconImg.className = 'pixelated';
        iconImg.style.cssText = 'width: 16px; height: 16px;';
        widgetBottom.appendChild(iconImg);
        
        // Add message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-left';
        messageDiv.textContent = message;
        widgetBottom.appendChild(messageDiv);
        
        // Assemble toast
        toast.appendChild(widgetTop);
        toast.appendChild(widgetBottom);
        flexContainer.appendChild(toast);
        mainContainer.appendChild(flexContainer);
        
        console.log(`[Better Tasker] Toast shown: ${message}`);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (flexContainer && flexContainer.parentNode) {
                flexContainer.parentNode.removeChild(flexContainer);
                
                // Update positions of remaining toasts
                const toasts = mainContainer.querySelectorAll('.toast-item');
                toasts.forEach((toast, index) => {
                    const offset = index * 46;
                    toast.style.transform = `translateY(-${offset}px)`;
                });
            }
        }, duration);
        
    } catch (error) {
        console.error('[Better Tasker] Error showing toast:', error);
    }
}

// ============================================================================
// 1.2. STAMINA MONITORING FUNCTIONS
// ============================================================================

// Stamina tooltip monitoring state
let staminaTooltipObserver = null;
let staminaRecoveryCallback = null;

/**
 * Calculate current stamina using game state API
 * @returns {number} Current stamina amount
 */
function getCurrentStamina() {
    try {
        // Read stamina directly from DOM (same approach as Bestiary Automator)
        const elStamina = document.querySelector('[title="Stamina"]');
        if (!elStamina) {
            console.log('[Better Tasker] Stamina element not found');
            return 0;
        }
        
        const staminaElement = elStamina.querySelector('span span');
        if (!staminaElement) {
            console.log('[Better Tasker] Stamina text element not found');
            return 0;
        }
        
        const stamina = Number(staminaElement.textContent);
        console.log('[Better Tasker] Current stamina from DOM:', stamina);
        return stamina;
    } catch (error) {
        console.error('[Better Tasker] Error reading stamina:', error);
        return 0;
    }
}

/**
 * Get stamina cost for current map from game API
 * @returns {number} Stamina cost (defaults to DEFAULT_STAMINA_COST if unknown)
 */
function getCurrentMapStaminaCost() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        const selectedRoom = boardContext?.selectedMap?.selectedRoom;
        
        if (selectedRoom && selectedRoom.staminaCost) {
            return selectedRoom.staminaCost;
        }
        
        return DEFAULT_STAMINA_COST;
    } catch (error) {
        console.error('[Better Tasker] Error getting stamina cost:', error);
        return DEFAULT_STAMINA_COST;
    }
}

/**
 * Check if stamina tooltip is visible (insufficient stamina indicator)
 * @returns {Object} { insufficient: boolean, cost: number }
 */
function hasInsufficientStamina() {
    // Look for stamina tooltip (icon-based, language-independent)
    const staminaTooltip = document.querySelector(
        '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
    );
    
    // Get stamina cost from game API
    const cost = getCurrentMapStaminaCost();
    
    if (staminaTooltip) {
        // Found stamina icon in tooltip = insufficient stamina
        console.log(`[Better Tasker] Tooltip check: Insufficient (needs ${cost})`);
        return { insufficient: true, cost };
    }
    
    // No tooltip = sufficient stamina (trust the game)
    return { insufficient: false, cost };
}

/**
 * Set up hybrid stamina monitoring (tooltip watching + API for progress)
 * Uses tooltip as truth for recovery, API for progress tracking
 * @param {Function} onRecovered - Callback when stamina recovers
 * @param {number} requiredStamina - Stamina cost for this map (optional for continuous monitoring)
 */
function startStaminaTooltipMonitoring(onRecovered, requiredStamina = null) {
    // Clean up any existing monitoring
    if (staminaTooltipObserver) {
        stopStaminaTooltipMonitoring();
    }
    
    console.log('[Better Tasker] Starting stamina recovery monitoring...');
    
    staminaRecoveryCallback = onRecovered;
    let hasStaminaIssue = true;
    
    // PRIMARY METHOD: Interval-based API checking for progress tracking (every 5 seconds)
    const staminaCheckInterval = setInterval(() => {
        const currentStamina = getCurrentStamina();
        
        // Also check if tooltip disappeared (double-check)
        const tooltipStillExists = document.querySelector(
            '[role="tooltip"] img[alt="stamina"], [data-state="instant-open"] img[alt="stamina"]'
        );
        
        if (!tooltipStillExists && hasStaminaIssue) {
            console.log(`[Better Tasker] ✅ STAMINA RECOVERED (tooltip gone) - current: ${currentStamina}`);
            hasStaminaIssue = false;
            
            // Save callback before cleanup (cleanup clears the callback)
            const callback = staminaRecoveryCallback;
            
            clearInterval(staminaCheckInterval);
            stopStaminaTooltipMonitoring();
            
            // Execute saved callback
            if (typeof callback === 'function') {
                callback();
            }
        } else if (tooltipStillExists && requiredStamina) {
            // Show progress if we know required stamina
            const timeRemaining = Math.max(0, requiredStamina - currentStamina);
            console.log(`[Better Tasker] Waiting for stamina (${currentStamina}/${requiredStamina}) - ~${timeRemaining} min remaining`);
        }
    }, 15000); // Check every 15 seconds (stamina regenerates 1 per minute)
    
    // Store interval for cleanup
    window.betterTaskerStaminaInterval = staminaCheckInterval;
    
    // BACKUP METHOD: MutationObserver for tooltip removal (instant detection)
    staminaTooltipObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.removedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const wasStaminaTooltip = 
                        (node.matches?.('[role="tooltip"]') || node.matches?.('[data-state="instant-open"]')) &&
                        node.querySelector?.('img[alt="stamina"]');
                    
                    if (wasStaminaTooltip && hasStaminaIssue) {
                        const currentStamina = getCurrentStamina();
                        console.log(`[Better Tasker] ✅ STAMINA RECOVERED (tooltip removed) - current: ${currentStamina}`);
                        hasStaminaIssue = false;
                        
                        // Save callback before cleanup (cleanup clears the callback)
                        const callback = staminaRecoveryCallback;
                        
                        clearInterval(staminaCheckInterval);
                        stopStaminaTooltipMonitoring();
                        
                        // Execute saved callback
                        if (typeof callback === 'function') {
                            callback();
                        }
                    }
                }
            });
        }
    });
    
    staminaTooltipObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Better Tasker] Stamina monitoring active (tooltip watching + API progress)');
}

/**
 * Stop stamina tooltip monitoring
 */
function stopStaminaTooltipMonitoring() {
    // Clear interval-based API checking
    if (window.betterTaskerStaminaInterval) {
        clearInterval(window.betterTaskerStaminaInterval);
        window.betterTaskerStaminaInterval = null;
    }
    
    // Disconnect MutationObserver
    if (staminaTooltipObserver) {
        staminaTooltipObserver.disconnect();
        staminaTooltipObserver = null;
        staminaRecoveryCallback = null;
    }
    
    console.log('[Better Tasker] Stamina monitoring stopped');
}

// ============================================================================
// 1.1. BETTER SETUPS INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Check if Better Setups mod is available and enabled
 * @returns {boolean} True if Better Setups is available
 */
function isBetterSetupsAvailable() {
    try {
        const storedSetupsEnabled = window.localStorage.getItem('stored-setups');
        const storedLabels = window.localStorage.getItem('stored-setup-labels');
        return storedSetupsEnabled === 'true' && storedLabels !== null;
    } catch (error) {
        console.error('[Better Tasker] Error checking Better Setups availability:', error);
        return false;
    }
}

/**
 * Get available setup options from Better Setups
 * @returns {Array} Array of available setup options
 */
function getAvailableSetupOptions() {
    const options = [getLocalizedText('Auto-setup', 'Autoconfigurar')]; // Always include default with translation
    
    if (isBetterSetupsAvailable()) {
        try {
            const labels = JSON.parse(window.localStorage.getItem('stored-setup-labels') || '[]');
            if (Array.isArray(labels) && labels.length > 0) {
                options.push(...labels);
                console.log('[Better Tasker] Better Setups labels found:', labels);
            }
        } catch (error) {
            console.error('[Better Tasker] Error parsing Better Setups labels:', error);
        }
    }
    
    return options;
}

/**
 * Check if a Better Setups button has a saved setup (green button = has setup, grey = no setup)
 * @param {HTMLElement} button - The button element to check
 * @returns {boolean} True if button has a saved setup
 */
function hasSavedSetup(button) {
    // Green buttons have saved setups, grey buttons don't
    // Check for green styling classes
    const hasGreenStyling = button.classList.contains('frame-1-green') || 
                           button.classList.contains('surface-green') ||
                           button.style.backgroundImage?.includes('background-green');
    
    return hasGreenStyling;
}

/**
 * Find setup button by option name with fallback to Auto-setup if no saved setup
 * @param {string} option - The setup option to find
 * @returns {HTMLElement|null} The button element or null if not found
 */
function findSetupButton(option) {
    if (option === getLocalizedText('Auto-setup', 'Autoconfigurar')) {
        return findButtonByText('Auto-setup');
    }
    
    // Look for Better Setups buttons with patterns "Setup (LabelName)" or "Save (LabelName)"
    const buttons = Array.from(document.querySelectorAll('button'));
    const setupButton = buttons.find(button => {
        const text = button.textContent.trim();
        return text === `Setup (${option})` || text === `Save (${option})`;
    });
    
    if (setupButton) {
        console.log(`[Better Tasker] Found Better Setups button: ${setupButton.textContent.trim()}`);
        
        // Check if this button has a saved setup
        if (hasSavedSetup(setupButton)) {
            console.log(`[Better Tasker] Button has saved setup (green) - using it`);
            return setupButton;
        } else {
            console.log(`[Better Tasker] Button has no saved setup (grey) - falling back to Auto-setup`);
            // Fallback to Auto-setup if the selected button has no saved setup
            const autoSetupButton = findButtonByText('Auto-setup');
            if (autoSetupButton) {
                console.log(`[Better Tasker] Using Auto-setup as fallback`);
                return autoSetupButton;
            }
        }
    } else {
        console.log(`[Better Tasker] Better Setups button not found for: ${option}`);
    }
    
    return null;
}

// ============================================================================
// 2. STATE MANAGEMENT
// ============================================================================

// UI/Observer State
let questLogObserver = null;

// ============================================================================
// 2.1. CONTROL MANAGER CLASS
// ============================================================================

// Reusable control manager class for coordination between mods
class ControlManager {
    constructor(name, uniqueProperties = {}) {
        this.name = name;
        this.currentOwner = null;
        
        // Add any unique properties specific to this manager
        Object.assign(this, uniqueProperties);
    }
    
    // Request control (returns true if successful)
    requestControl(modName) {
        if (this.currentOwner === null || this.currentOwner === modName) {
            this.currentOwner = modName;
            console.log(`[${this.name}] Control granted to ${modName}`);
            return true;
        }
        console.log(`[${this.name}] Control denied to ${modName} (currently owned by ${this.currentOwner})`);
        return false;
    }
    
    // Release control
    releaseControl(modName) {
        if (this.currentOwner === modName) {
            this.currentOwner = null;
            console.log(`[${this.name}] Control released by ${modName}`);
            return true;
        }
        return false;
    }
    
    // Check if mod has control
    hasControl(modName) {
        return this.currentOwner === modName;
    }
    
    // Get current owner
    getCurrentOwner() {
        return this.currentOwner;
    }
}

// ============================================================================
// 2.2. CONTROL MANAGER INSTANCES
// ============================================================================

// Quest Button Manager for coordination between mods
window.QuestButtonManager = window.QuestButtonManager || new ControlManager('Quest Button Manager', {
    originalState: null,
    validationInterval: null
});

// Autoplay Manager for coordination between mods
window.AutoplayManager = window.AutoplayManager || new ControlManager('Autoplay Manager', {
    originalMode: null,
    isControlledByOther(modName) {
        return this.currentOwner !== null && this.currentOwner !== modName;
    }
});

// Bestiary Automator Settings Manager for coordination between mods
window.BestiaryAutomatorSettingsManager = window.BestiaryAutomatorSettingsManager || new ControlManager('Bestiary Automator Settings Manager');

// Raid Hunter coordination state
let isRaidHunterActive = false;
let raidHunterCoordinationInterval = null;
let lastRaidHunterCheckTime = null; // Track when we first detected raids but no Raid Hunter control
let lastRaidHunterActiveTime = 0; // Track when Raid Hunter was last active to prevent ping-pong
let raidHunterFailureCount = 0; // Track consecutive Raid Hunter failures
let gameStateUnsubscribers = [];
let automationInterval = null;
let questLogInterval = null;
let taskCheckTimeout = null;

// Board Analyzer coordination state
let isBoardAnalyzerRunning = false;
let boardAnalyzerCoordinationInterval = null;

// Modal State
let activeTaskerModal = null;
let taskerModalInProgress = false;
let lastModalCall = 0;

// Event listener management
let escKeyListener = null;

// Timeout tracking for cleanup
let safetyTimeouts = [];
let trackedListeners = new Map();

// Automation State
let taskerState = TASKER_STATES.DISABLED;
let taskHuntingOngoing = false;
let taskNavigationCompleted = false;
let autoplayPausedByTasker = false;
let pendingTaskCompletion = false;
let taskOperationInProgress = false;
let questBlipObserver = null;
let questBlipCheckInterval = null;
let lastQuestBlipTrigger = 0;

// Session State
let lastGameStateChange = 0;
let lastNoTaskCheck = 0;

// Loop detection and auto-refresh
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5; // Refresh after 5 consecutive failures
let lastFailureType = null;
const FAILURE_RESET_TIME = 60000; // Reset counter after 60 seconds of no failures

// Check if it's safe to reload the page (won't interrupt user's active game)
function isSafeToReload() {
    try {
        const boardContext = globalThis.state?.board?.getSnapshot()?.context;
        
        // Don't reload if game state is unavailable
        if (!boardContext) {
            console.log('[Better Tasker] Cannot verify game state - skipping reload for safety');
            return false;
        }
        
        // CRITICAL: Check if user is actively playing a game
        if (boardContext.gameStarted) {
            console.log('[Better Tasker] User is in an active game - skipping reload to avoid interruption');
            return false;
        }
        
        // Check if user is in autoplay mode but this mod doesn't have control
        // This means user manually enabled autoplay or another mod is controlling it
        const currentOwner = window.AutoplayManager?.getCurrentOwner();
        
        if (boardContext.mode === 'autoplay' && currentOwner && currentOwner !== 'Better Tasker') {
            console.log(`[Better Tasker] Another mod (${currentOwner}) is autoplaying - skipping reload`);
            return false;
        }
        
        // Safe to reload
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error checking if safe to reload:', error);
        return false; // Fail safe - don't reload on error
    }
}

// Centralized state reset function
function resetState(resetType = 'full') {
    try {
        // Common reset groups to eliminate duplication
        const resetCommonFlags = () => {
            autoplayPausedByTasker = false;
            pendingTaskCompletion = false;
            taskOperationInProgress = false;
            lastNoTaskCheck = 0;
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
        };
        
        const resetSessionFlags = () => {
            // Session flags reset (currently no session flags to reset)
        };
        
        const resetTaskHunting = () => {
            taskHuntingOngoing = false;
            // Clear saved tasking map ID only when task hunting actually stops
            taskingMapId = null;
            // Reset quest button modification flag
            questButtonModifiedForTasking = false;
            // Stop quest button validation and restore appearance when task hunting stops
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            console.log('[Better Tasker] Task hunting flag cleared - no longer actively hunting');
        };
        
        const resetNavigation = () => {
            taskNavigationCompleted = false;
            console.log('[Better Tasker] Task navigation flag cleared - ready for new navigation');
        };
        
        // Apply resets based on type
        switch (resetType) {
            case 'session':
                resetSessionFlags();
                // For session resets, only reset common flags if not task hunting
                if (!taskHuntingOngoing) {
                    resetCommonFlags();
                } else {
                    // Reset flags but preserve quest button state and tasking map ID during task hunting
                    autoplayPausedByTasker = false;
                    pendingTaskCompletion = false;
                    taskOperationInProgress = false;
                    lastNoTaskCheck = 0;
                    // CRITICAL FIX: Reset quest button modification flag during session reset
                    // This prevents the quest button from staying in modified state indefinitely
                    questButtonModifiedForTasking = false;
                    // CRITICAL FIX: Do NOT clear taskingMapId during session reset - preserve it for map validation
                    console.log('[Better Tasker] Session reset during task hunting - reset quest button modification flag but preserving tasking map ID');
                }
                // Don't reset taskHuntingOngoing during session reset - it should persist until task completion
                console.log('[Better Tasker] Session state reset (preserving task hunting flag)');
                break;
                
            case 'automation':
                resetSessionFlags();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Automation state reset');
                break;
                
            case 'navigation':
                resetNavigation();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Navigation state reset');
                break;
                
            case 'taskComplete':
                resetNavigation();
                resetTaskHunting();
                resetCommonFlags();
                console.log('[Better Tasker] Task hunting flag reset - task completed');
                break;
                
            case 'full':
            default:
                resetSessionFlags();
                resetTaskHunting();
                resetCommonFlags();
                // Note: taskNavigationCompleted persists until user manually stops automation
                console.log('[Better Tasker] Full state reset');
                break;
        }
        
        // Always update exposed state after any reset so other mods (like Raid Hunter) can see the changes
        updateExposedState();
    } catch (error) {
        console.error('[Better Tasker] Error during state reset:', error);
    }
}

// Track failures and trigger page refresh if stuck in a loop
function trackFailureAndCheckRefresh(failureType, shouldRefresh = true) {
    try {
        const now = Date.now();
        
        // Reset counter if it's been a while since last failure (successful recovery)
        if (lastFailureType && now - lastGameStateChange > FAILURE_RESET_TIME) {
            console.log('[Better Tasker] Resetting failure counter after successful recovery period');
            consecutiveFailures = 0;
            lastFailureType = null;
        }
        
        // Increment counter for same failure type
        if (lastFailureType === failureType) {
            consecutiveFailures++;
        } else {
            // Different failure type, reset counter
            consecutiveFailures = 1;
            lastFailureType = failureType;
        }
        
        console.log(`[Better Tasker] Failure tracked: ${failureType} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
        
        // Check if we should refresh
        if (shouldRefresh && consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(`[Better Tasker] STUCK IN LOOP DETECTED: ${failureType} failed ${consecutiveFailures} times consecutively`);
            console.warn('[Better Tasker] Triggering page refresh in 3 seconds to recover...');
            
            // Give user a moment to see the warning
            setTimeout(() => {
                if (!isSafeToReload()) return;
                // Check if Better UI has disabled auto-reload
                if (window.betterUIConfig?.disableAutoReload) {
                    console.log('[Better Tasker] Auto-reload disabled by Better UI - skipping page refresh');
                    return;
                }
                console.log('[Better Tasker] Refreshing page to recover from stuck state...');
                location.reload();
            }, 3000);
            
            return true; // Indicates refresh is scheduled
        }
        
        return false; // No refresh needed
    } catch (error) {
        console.error('[Better Tasker] Error tracking failure:', error);
        return false;
    }
}

// Reset failure counter on successful operations
function resetFailureCounter() {
    if (consecutiveFailures > 0) {
        console.log('[Better Tasker] Operation successful - resetting failure counter');
        consecutiveFailures = 0;
        lastFailureType = null;
    }
}

// Centralized cleanup function for task completion failures
function cleanupTaskCompletionFailure(reason = 'unknown') {
    try {
        console.log(`[Better Tasker] Cleaning up after task completion failure: ${reason}`);
        
        // Track this failure
        trackFailureAndCheckRefresh(reason);
        
        // Clear all task-related flags
        resetState('taskComplete');
        
        // Close any open quest log
        clickAllCloseButtons();
        
        // Press ESC to ensure quest log is closed
        clearModalsWithEscSync(3);
        
        // Update exposed state for other mods
        updateExposedState();
        
        // Reschedule task check after failure
        scheduleTaskCheck();
        
        console.log('[Better Tasker] Task completion failure cleanup completed');
        
    } catch (error) {
        console.error('[Better Tasker] Error during cleanup:', error);
    }
}

// ============================================================================
// 3. AUTOPLAY CONTROL FUNCTIONS
// ============================================================================

// Generic function to control autoplay with button clicks
async function controlAutoplayWithButton(action) {
    try {
        console.log(`[Better Tasker] Looking for ${action} button...`);
        
        // Define selectors based on action type
        const selectors = action === 'pause' 
            ? [
                'button:has(svg.lucide-pause)',
                'button.frame-1-red[class*="pause"]',
                'button.frame-1-red:has(svg.lucide-pause)', // Red button with pause icon (more specific)
                'button[class*="surface-red"]:has(svg.lucide-pause)' // Red button with pause icon only
              ]
            : [
                'button:has(svg.lucide-play)',
                'button.frame-1-green[class*="play"]',
                'button.frame-1-green:has(svg.lucide-play)', // Green button with play icon (more specific)
                'button[class*="surface-green"]:has(svg.lucide-play)' // Green button with play icon only
              ];
        
        // Find button using first matching selector
        let button = selectors.reduce((found, selector) => 
            found || document.querySelector(selector), null);
        
        // Fallback: Look for pause button by structure (second button in flex container with pause icon)
        if (!button && action === 'pause') {
            const flexContainer = document.querySelector('div.flex');
            if (flexContainer) {
                const buttons = flexContainer.querySelectorAll('button');
                if (buttons.length >= 2) {
                    const secondButton = buttons[1]; // Second button (pause button)
                    const hasPauseIcon = secondButton.querySelector('svg.lucide-pause');
                    if (hasPauseIcon) {
                        button = secondButton;
                        console.log('[Better Tasker] Found pause button using structure fallback');
                    }
                }
            }
        }
        
        if (button) {
            console.log(`[Better Tasker] Found ${action} button, clicking to ${action} autoplay...`);
            
            // Clear any modals by simulating ESC key presses to remove data-scroll-locked
            await clearModalsWithEsc(3);
            
            // Brief wait for modals to close and scroll lock to clear
            await sleep(100);
            
            button.click();
            
            // Wait briefly for UI to update
            await sleep(300);
            console.log(`[Better Tasker] ${action.charAt(0).toUpperCase() + action.slice(1)} button clicked successfully`);
            
            return true;
        } else {
            console.log(`[Better Tasker] ${action.charAt(0).toUpperCase() + action.slice(1)} button not found`);
            return false;
        }
    } catch (error) {
        console.error(`[Better Tasker] Error clicking ${action} button:`, error);
        return false;
    }
}

// Find and click the pause button to pause autoplay
async function pauseAutoplayWithButton() {
    return await controlAutoplayWithButton('pause');
}

// Find and click the play button to resume autoplay
async function resumeAutoplayWithButton() {
    return await controlAutoplayWithButton('play');
}

// ============================================================================
// 4. RAID HUNTER COORDINATION
// ============================================================================

// Check if Raid Hunter is actively raiding
function isRaidHunterRaiding() {
    try {
        // Check if Raid Hunter mod is loaded and actively raiding
        if (typeof window !== 'undefined') {
            // First check if Raid Hunter is actually enabled
            const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
            if (raidHunterEnabled !== 'true') {
                return false;
            }
            
            // Check if Raid Hunter is actually currently raiding by checking if it has control of the quest button
            // Raid Hunter takes control of the quest button when it's actively processing a raid
            const raidState = globalThis.state?.raids?.getSnapshot?.();
            if (raidState) {
                const currentRaidList = raidState.context?.list || [];
                const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                
                // Check if Raid Hunter has control of the quest button OR is internally raiding
                const questButtonOwner = window.QuestButtonManager?.getCurrentOwner();
                const isRaidHunterCurrentlyRaiding = questButtonOwner === 'Raid Hunter' ||
                                                     (window.raidHunterIsCurrentlyRaiding && window.raidHunterIsCurrentlyRaiding());
                
                // Debug logging to help diagnose coordination issues
                if (currentRaidList.length > 0) {
                    console.log(`[Better Tasker] Raid coordination check - raids: ${currentRaidList.length}, quest owner: ${questButtonOwner}, raid function: ${window.raidHunterIsCurrentlyRaiding ? window.raidHunterIsCurrentlyRaiding() : 'N/A'}`);
                }
                
                // Only yield control if Raid Hunter is actually actively raiding (has quest button control)
                if (isRaidHunterCurrentlyRaiding) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - preventing task automation');
                    lastRaidHunterCheckTime = null; // Reset timer since Raid Hunter has control
                    lastRaidHunterActiveTime = Date.now(); // Track when Raid Hunter was last active
                    raidHunterFailureCount = 0; // Reset failure count when Raid Hunter is active
                    return true;
                } else if (currentRaidList.length > 0 && raidHunterEnabled === 'true') {
                    // Check if we're currently tasking - if so, don't interfere with ongoing task
                    if (taskHuntingOngoing) {
                        console.log('[Better Tasker] Task hunting ongoing, skipping automation');
                        return false;
                    }
                    
                    // Track Raid Hunter failures and give it more time when struggling
                    const now = Date.now();
                    const timeSinceLastActive = now - lastRaidHunterActiveTime;
                    
                    // If Raid Hunter was active recently, increment failure count and give it more time
                    if (timeSinceLastActive < 60000) { // 60 second cooldown
                        raidHunterFailureCount++;
                        const extendedCooldown = Math.min(raidHunterFailureCount * 30, 180); // Up to 3 minutes for struggling Raid Hunter
                        
                        if (timeSinceLastActive < extendedCooldown * 1000) {
                            console.log(`[Better Tasker] Raid Hunter struggling (${raidHunterFailureCount} failures, ${Math.round(timeSinceLastActive/1000)}s ago) - extending yield time to ${extendedCooldown}s`);
                            return true;
                        }
                    }
                    
                    // If raids are available but Raid Hunter isn't actively raiding,
                    // give Raid Hunter a chance to claim control (especially after foreground transitions)
                    // Wait up to 10 seconds for Raid Hunter to claim control
                    if (!lastRaidHunterCheckTime) {
                        lastRaidHunterCheckTime = now;
                        console.log('[Better Tasker] Active raids available - waiting for Raid Hunter to claim control...');
                        return true; // Yield control temporarily
                    }
                    
                    const timeSinceFirstCheck = now - lastRaidHunterCheckTime;
                    if (timeSinceFirstCheck < 10000) { // Wait up to 10 seconds
                        console.log(`[Better Tasker] Still waiting for Raid Hunter to claim control... (${Math.round(timeSinceFirstCheck/1000)}s)`);
                        return true; // Continue yielding
                    } else {
                        // Timeout reached - Raid Hunter hasn't claimed control, proceed with tasks
                        console.log('[Better Tasker] Raid Hunter timeout - proceeding with task automation');
                        lastRaidHunterCheckTime = null; // Reset for next time
                        return false;
                    }
                }
            } else {
                console.log('[Better Tasker] Raid state not available - assuming no active raids');
                lastRaidHunterCheckTime = null; // Reset timer when no raids
            }
        }
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking Raid Hunter status:', error);
        return false;
    }
}

// Monitor Raid Hunter coordination
function setupRaidHunterCoordination() {
    if (raidHunterCoordinationInterval) {
        clearInterval(raidHunterCoordinationInterval);
    }
    
    // Check Raid Hunter status every 10 seconds
    raidHunterCoordinationInterval = setInterval(() => {
        const wasRaidHunterActive = isRaidHunterActive;
        isRaidHunterActive = isRaidHunterRaiding();
        
        // If Raid Hunter just became active and we're running automation, pause it (but keep game state monitoring for new tasks)
        if (isRaidHunterActive && !wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
            console.log('[Better Tasker] Raid Hunter started raiding - pausing task automation (keeping game state monitoring for new tasks)');
            pauseAutomationDuringRaid();
        }
        
        // If Raid Hunter stopped raiding and we were enabled, resume automation
        if (!isRaidHunterActive && wasRaidHunterActive && taskerState === TASKER_STATES.ENABLED) {
            console.log('[Better Tasker] Raid Hunter stopped raiding - resuming task automation');
            // Small delay before resuming to ensure Raid Hunter has fully stopped
            setTimeout(() => {
                if (!isRaidHunterRaiding() && taskerState === TASKER_STATES.ENABLED) {
                    // Now that Raid Hunter has stopped, we can safely disable its Bestiary Automator settings
                    // and enable our own if needed
                    handleRaidHunterStopped();
                    startAutomation();
                }
            }, 3000);
        }
    }, 10000);
    
    console.log('[Better Tasker] Raid Hunter coordination set up');
}

// Handle when Raid Hunter stops raiding
function handleRaidHunterStopped() {
    try {
        console.log('[Better Tasker] Raid Hunter stopped - managing Bestiary Automator settings transition');
        
        // Release Raid Hunter's control of Bestiary Automator settings
        window.BestiaryAutomatorSettingsManager.releaseControl('Raid Hunter');
        
        // Ensure Raid Hunter releases quest button control if it still has it
        if (window.QuestButtonManager.getCurrentOwner() === 'Raid Hunter') {
            console.log('[Better Tasker] Forcing Raid Hunter to release quest button control');
            window.QuestButtonManager.releaseControl('Raid Hunter');
        }
        
        // Disable Raid Hunter's Bestiary Automator settings
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Better Tasker] Disabling Raid Hunter\'s Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
        }
        if (settings.fasterAutoplay) {
            console.log('[Better Tasker] Disabling Raid Hunter\'s Bestiary Automator faster autoplay...');
            disableBestiaryAutomatorFasterAutoplay();
        }
        
        // Small delay before enabling our own settings to avoid conflicts
        setTimeout(() => {
            console.log('[Better Tasker] Enabling our Bestiary Automator settings...');
            enableBestiaryAutomatorSettings();
        }, 1000);
    } catch (error) {
        console.error('[Better Tasker] Error handling Raid Hunter stop:', error);
    }
}

// Clean up Raid Hunter coordination
function cleanupRaidHunterCoordination() {
    if (raidHunterCoordinationInterval) {
        clearInterval(raidHunterCoordinationInterval);
        raidHunterCoordinationInterval = null;
    }
    isRaidHunterActive = false;
}

// ============================================================================
// 4.1. BOARD ANALYZER COORDINATION
// ============================================================================

// Check if Board Analyzer is currently running
function isBoardAnalyzerActive() {
    try {
        if (!window.__modCoordination) return false;
        return window.__modCoordination.boardAnalyzerRunning === true;
    } catch (error) {
        console.error('[Better Tasker] Error checking Board Analyzer status:', error);
        return false;
    }
}

// Handle Board Analyzer coordination - pause Better Tasker when Board Analyzer runs
function handleBoardAnalyzerCoordination() {
    try {
        if (!window.__modCoordination) return;
        
        const boardAnalyzerRunning = window.__modCoordination.boardAnalyzerRunning;
        
        if (boardAnalyzerRunning && !isBoardAnalyzerRunning) {
            // Board Analyzer started - pause Better Tasker automation
            console.log('[Better Tasker] Board Analyzer started - pausing task automation');
            isBoardAnalyzerRunning = true;
            
            if (taskerState === TASKER_STATES.ENABLED) {
                stopAutomation();
            }
        } else if (!boardAnalyzerRunning && isBoardAnalyzerRunning) {
            // Board Analyzer finished - resume Better Tasker automation if enabled
            console.log('[Better Tasker] Board Analyzer finished - checking if automation should resume');
            isBoardAnalyzerRunning = false;
            
            if (taskerState === TASKER_STATES.ENABLED && !isRaidHunterRaiding()) {
                console.log('[Better Tasker] Resuming task automation');
                startAutomation();
            }
        }
    } catch (error) {
        console.error('[Better Tasker] Error in Board Analyzer coordination:', error);
    }
}

// Setup Board Analyzer coordination
function setupBoardAnalyzerCoordination() {
    if (boardAnalyzerCoordinationInterval) {
        clearInterval(boardAnalyzerCoordinationInterval);
        boardAnalyzerCoordinationInterval = null;
    }
    
    // Poll for Board Analyzer state changes every 2 seconds
    boardAnalyzerCoordinationInterval = setInterval(() => {
        handleBoardAnalyzerCoordination();
    }, 2000);
    
    console.log('[Better Tasker] Board Analyzer coordination set up');
}

// Clean up Board Analyzer coordination
function cleanupBoardAnalyzerCoordination() {
    if (boardAnalyzerCoordinationInterval) {
        clearInterval(boardAnalyzerCoordinationInterval);
        boardAnalyzerCoordinationInterval = null;
    }
    isBoardAnalyzerRunning = false;
}

// ============================================================================
// 5. UI FUNCTIONS
// ============================================================================

// Helper function to find quest log container with optimized selectors
function findQuestLogContainer() {
    const selectors = [
        '.widget-bottom .grid.h-\\[260px\\].items-start.gap-1', // Most specific
        '[data-radix-scroll-area-viewport] .grid.h-\\[260px\\].items-start.gap-1',
        '.grid.h-\\[260px\\].items-start.gap-1',
        '.widget-bottom .grid.items-start.gap-1',
        '[data-radix-scroll-area-viewport] .grid.items-start.gap-1',
        '.grid.items-start.gap-1'
    ];
    
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        const container = document.querySelector(selector);
        
        if (container) {
            console.log(`[Better Tasker] Found potential quest log container with selector ${i + 1}: ${selector}`);
            return container;
        }
    }
    
    return null;
}

// Find the Paw and Fur Society section
function findPawAndFurSection() {
    const questLogContainer = findQuestLogContainer();
    if (!questLogContainer) return null;
    
    // Look for the Paw and Fur Society section by its text content
    const sections = questLogContainer.querySelectorAll('.frame-1.surface-regular');
    for (const section of sections) {
        const titleElement = section.querySelector('p.text-whiteHighlight');
        if (titleElement && titleElement.textContent === 'Paw and Fur Society') {
            return section;
        }
    }
    
    return null;
}

// Create the settings button
function createSettingsButton() {
    return createStyledButton(TASKER_BUTTON_ID, getLocalizedText(UI_TEXT.BUTTONS.SETTINGS, UI_TEXT.BUTTONS_PT.SETTINGS), 'blue', () => {
        console.log('[Better Tasker] Settings button clicked');
        openTaskerSettingsModal();
    });
}

// Create the toggle button
function createToggleButton() {
    return createStyledButton(TASKER_TOGGLE_ID, getLocalizedText('Disabled', 'Desabilitado'), 'red', () => {
        console.log('[Better Tasker] Toggle button clicked');
        toggleTasker();
    });
}

// Insert buttons into Paw and Fur Society section
function insertButtons() {
    // Check if buttons already exist
    if (document.getElementById(TASKER_BUTTON_ID) && document.getElementById(TASKER_TOGGLE_ID)) {
        console.log('[Better Tasker] Buttons already exist, skipping');
        return true; // Success - buttons already exist
    }
    
    const pawAndFurSection = findPawAndFurSection();
    if (!pawAndFurSection) {
        console.log('[Better Tasker] Paw and Fur Society section not found');
        return false; // Failed - section not found
    }
    
    console.log('[Better Tasker] Found Paw and Fur Society section, inserting buttons');
    
    // Find the title element and its parent container
    const titleElement = pawAndFurSection.querySelector('p.text-whiteHighlight');
    if (titleElement && titleElement.textContent === 'Paw and Fur Society') {
        // Find the parent container that holds the title
        const titleContainer = titleElement.parentElement;
        
        if (titleContainer) {
            // Create a button container
            const buttonContainer = createStyledContainer(null, `
                display: flex;
                gap: 4px;
                margin-top: 4px;
            `);
            
            // Create the toggle button
            const toggleButton = createToggleButton();
            buttonContainer.appendChild(toggleButton);
            
            // Create the settings button
            const settingsButton = createSettingsButton();
            buttonContainer.appendChild(settingsButton);
            
            // Insert the button container after the title
            titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
            
            // Update toggle button state
            updateToggleButton();
            
            console.log('[Better Tasker] Buttons inserted next to title successfully');
            return true; // Success - buttons inserted
        } else {
            console.log('[Better Tasker] Could not find title container for buttons');
            return false; // Failed - no container
        }
    } else {
        console.log('[Better Tasker] Could not find Paw and Fur Society title element');
        return false; // Failed - no title element
    }
}

// ============================================================================
// 6. STATE MANAGEMENT FUNCTIONS
// ============================================================================

// Setup quest blip monitoring for "New Task Only" mode
function setupQuestBlipMonitoring() {
    if (questBlipObserver) {
        console.log('[Better Tasker] Quest blip observer already exists');
        return;
    }
    
    console.log('[Better Tasker] Setting up quest blip monitoring...');
    
    // Check for existing quest blip immediately when setting up monitoring
    if (taskerState === TASKER_STATES.NEW_TASK_ONLY) {
        const existingQuestBlip = document.querySelector('#header-slot img[src*="quest-blip.png"]');
        if (existingQuestBlip) {
            console.log('[Better Tasker] Existing quest blip found during setup - triggering New Task Only mode');
            handleNewTaskOnly();
        }
    }
    
    // Enhanced MutationObserver that watches for both node additions and attribute changes
    questBlipObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Check for newly added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && taskerState === TASKER_STATES.NEW_TASK_ONLY) {
                    // Check if quest blip appeared
                    const questBlipSelectors = [
                        '#header-slot img[src*="quest-blip.png"]',
                        '#header-slot img[src*="/assets/icons/quest-blip.png"]',
                        '#header-slot img[alt="Quests"][src*="quest-blip"]',
                        '#header-slot img[alt="Tasking"][src*="quest-blip"]',
                        'img[src*="quest-blip.png"]', // Fallback
                        'img[src*="/assets/icons/quest-blip.png"]' // Fallback
                    ];
                    
                    let questBlip = null;
                    for (const selector of questBlipSelectors) {
                        questBlip = node.querySelector?.(selector) || 
                                   (node.matches?.(selector) ? node : null);
                        if (questBlip) break;
                    }
                    
                    // Debug: Log what was added to help identify quest blip
                    if (node.querySelector && node.querySelector('img[src*="quest"]')) {
                        console.log('[Better Tasker] Debug - Quest-related image added:', node.querySelector('img[src*="quest"]').src);
                    }
                    
                    if (questBlip) {
                        console.log('[Better Tasker] Quest blip detected via node addition - triggering New Task Only mode');
                        handleNewTaskOnly();
                    }
                }
            });
            
            // Check for attribute changes (like src changes that transition quest.png to quest-blip.png)
            if (mutation.type === 'attributes' && taskerState === TASKER_STATES.NEW_TASK_ONLY) {
                const target = mutation.target;
                
                // Check if this is a quest image src change in the header navigation
                if ((target.matches?.('#header-slot img[alt="Quests"]') || target.matches?.('#header-slot img[alt="Tasking"]')) && mutation.attributeName === 'src') {
                    const newSrc = target.src;
                    if (newSrc && newSrc.includes('quest-blip.png')) {
                        console.log('[Better Tasker] Quest image src changed to quest-blip.png in header navigation - triggering New Task Only mode');
                        handleNewTaskOnly();
                        return;
                    }
                }
                
                // Check if the changed element or its parent contains a quest blip
                const questBlipSelectors = [
                    '#header-slot img[src*="quest-blip.png"]',
                    '#header-slot img[src*="/assets/icons/quest-blip.png"]',
                    '#header-slot img[alt="Quests"][src*="quest-blip"]',
                    '#header-slot img[alt="Tasking"][src*="quest-blip"]',
                    'img[src*="quest-blip.png"]', // Fallback
                    'img[src*="/assets/icons/quest-blip.png"]' // Fallback
                ];
                
                let questBlip = null;
                for (const selector of questBlipSelectors) {
                    questBlip = target.querySelector?.(selector) || 
                               (target.matches?.(selector) ? target : null) ||
                               target.closest?.('li')?.querySelector?.(selector);
                    if (questBlip) break;
                }
                
                if (questBlip) {
                    console.log('[Better Tasker] Quest blip detected via attribute change - triggering New Task Only mode');
                    handleNewTaskOnly();
                }
            }
        });
    });
    
    questBlipObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'data-selected', 'src']
    });
    
    // Also set up periodic checking as backup (every 30 seconds)
    questBlipCheckInterval = setInterval(() => {
        if (taskerState === TASKER_STATES.NEW_TASK_ONLY) {
            const questBlipSelectors = [
                '#header-slot img[src*="quest-blip.png"]',
                '#header-slot img[src*="/assets/icons/quest-blip.png"]',
                '#header-slot img[alt="Quests"][src*="quest-blip"]',
                '#header-slot img[alt="Tasking"][src*="quest-blip"]',
                'img[src*="quest-blip.png"]', // Fallback
                'img[src*="/assets/icons/quest-blip.png"]' // Fallback
            ];
            
            let questBlip = null;
            for (const selector of questBlipSelectors) {
                questBlip = document.querySelector(selector);
                if (questBlip && questBlip.offsetParent !== null) { // Check if visible
                    console.log(`[Better Tasker] Quest blip detected via periodic check with selector: ${selector} - triggering New Task Only mode`);
                    handleNewTaskOnly();
                    break;
                }
            }
        }
    }, 30000);
    
    console.log('[Better Tasker] Quest blip monitoring started (MutationObserver + periodic checks)');
}

// Stop quest blip monitoring
function stopQuestBlipMonitoring() {
    if (questBlipObserver) {
        questBlipObserver.disconnect();
        questBlipObserver = null;
        console.log('[Better Tasker] Quest blip MutationObserver stopped');
    }
    
    if (questBlipCheckInterval) {
        clearInterval(questBlipCheckInterval);
        questBlipCheckInterval = null;
        console.log('[Better Tasker] Quest blip periodic checking stopped');
    }
}

// Load tasker state from localStorage
function loadTaskerState() {
    const saved = localStorage.getItem('betterTaskerState');
    if (saved !== null) {
        try {
            taskerState = saved;
            console.log('[Better Tasker] Loaded tasker state from localStorage:', taskerState);
        } catch (error) {
            console.error('[Better Tasker] Error parsing tasker state:', error);
            taskerState = TASKER_STATES.DISABLED;
        }
    } else {
        // Try to migrate from old boolean system
        const oldSaved = localStorage.getItem('betterTaskerEnabled');
        if (oldSaved !== null) {
            try {
                const oldState = JSON.parse(oldSaved);
                taskerState = oldState ? TASKER_STATES.ENABLED : TASKER_STATES.DISABLED;
                console.log('[Better Tasker] Migrated from old boolean system:', taskerState);
                // Clean up old key
                localStorage.removeItem('betterTaskerEnabled');
            } catch (error) {
                console.error('[Better Tasker] Error migrating from old system:', error);
                taskerState = TASKER_STATES.DISABLED;
            }
        } else {
            console.log('[Better Tasker] No saved tasker state, using default (disabled)');
            taskerState = TASKER_STATES.DISABLED;
        }
    }
}

// Save tasker state to localStorage
function saveTaskerState() {
    localStorage.setItem('betterTaskerState', taskerState);
    console.log('[Better Tasker] Saved tasker state to localStorage:', taskerState);
}

// Handle "New Task Only" functionality
async function handleNewTaskOnly() {
    try {
        // Prevent infinite triggering with cooldown
        const now = Date.now();
        if (now - lastQuestBlipTrigger < 5000) { // 5 second cooldown
            console.log('[Better Tasker] Quest blip trigger cooldown active, skipping...');
            return;
        }
        lastQuestBlipTrigger = now;
        
        console.log('[Better Tasker] New Task Only mode - opening quest log...');
        
        // Check if quest log is already open
        const existingQuestLog = document.querySelector('.widget-bottom .grid.h-\\[260px\\].items-start.gap-1');
        if (existingQuestLog) {
            console.log('[Better Tasker] Quest log already open, skipping quest blip click');
            // Still proceed to look for New Task button
        } else {
            // 1. Find and click quest blip to open quest log
        const questBlipSelectors = [
            '#header-slot img[src*="quest-blip.png"]',
            '#header-slot img[src*="/assets/icons/quest-blip.png"]',
            '#header-slot img[alt="Quests"][src*="quest-blip"]',
            '#header-slot img[alt="Tasking"][src*="quest-blip"]',
            'img[src*="quest-blip.png"]', // Fallback
            'img[src*="/assets/icons/quest-blip.png"]' // Fallback
        ];
        
        let questBlip = null;
        for (const selector of questBlipSelectors) {
            questBlip = document.querySelector(selector);
            if (questBlip) {
                console.log(`[Better Tasker] Quest blip found with selector: ${selector}`);
                break;
            }
        }
        
            if (!questBlip) {
                console.log('[Better Tasker] No quest blip found');
                return;
            }
            
            console.log('[Better Tasker] Quest blip found, clicking it...');
            questBlip.click();
            await sleep(300); // Wait for quest log to open
            console.log('[Better Tasker] Quest blip clicked, waiting for quest log to open...');
        }
        
        // 2. Accept new task without creature filtering (New Task+ always accepts any task)
        console.log('[Better Tasker] New Task+ mode - accepting task without filtering...');
        const taskAccepted = await acceptNewTaskFromQuestLog(true); // Skip filtering
        
        // 3. Close quest log with ESC key
        await clearModalsWithEsc(3);
        
        if (taskAccepted) {
            console.log('[Better Tasker] Quest log closed - New Task+ mode complete (task accepted)');
        } else {
            console.log('[Better Tasker] Quest log closed - New Task+ mode complete (no task found)');
        }
        
    } catch (error) {
        console.error('[Better Tasker] Error in New Task Only mode:', error);
    }
}

// Toggle tasker through the 3 states
function toggleTasker() {
    // Rotate through states: Enable → New Task+ → Disabled
    switch (taskerState) {
        case TASKER_STATES.DISABLED:
            taskerState = TASKER_STATES.ENABLED;
            startAutomation();
            scheduleTaskCheck(); // Check resetAt and schedule next task check
            break;
        case TASKER_STATES.ENABLED:
            taskerState = TASKER_STATES.NEW_TASK_ONLY;
            stopAutomation();
            // New Task+ mode: Only run scheduler for task acceptance (no full automation)
            scheduleTaskCheck();
            break;
        case TASKER_STATES.NEW_TASK_ONLY:
            taskerState = TASKER_STATES.DISABLED;
            // Clear scheduler when disabling
            if (taskCheckTimeout) {
                clearTimeout(taskCheckTimeout);
                taskCheckTimeout = null;
            }
            resetState('navigation');
            updateExposedState();
            break;
    }
    
    saveTaskerState();
    updateToggleButton();
    
    console.log('[Better Tasker] Tasker state changed to:', taskerState);
}

// Update the toggle button appearance
function updateToggleButton() {
    const toggleButton = document.querySelector(`#${TASKER_TOGGLE_ID}`);
    if (!toggleButton) return;
    
    // Clear any shimmer effect
    toggleButton.style.background = '';
    toggleButton.style.backgroundSize = '';
    toggleButton.style.backgroundClip = '';
    toggleButton.style.webkitBackgroundClip = '';
    toggleButton.style.webkitTextFillColor = '';
    toggleButton.style.animation = '';
    
    switch (taskerState) {
        case TASKER_STATES.DISABLED:
            toggleButton.textContent = getLocalizedText('Disabled', 'Desabilitado');
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
            break;
        case TASKER_STATES.NEW_TASK_ONLY:
            toggleButton.textContent = getLocalizedText('New Task+', 'Nova Task+');
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
            // Set custom blue background
            toggleButton.style.background = 'url("https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png")';
            toggleButton.style.backgroundSize = 'cover';
            toggleButton.style.backgroundPosition = 'center';
            break;
        case TASKER_STATES.ENABLED:
            toggleButton.textContent = getLocalizedText(UI_TEXT.BUTTONS.ENABLED, UI_TEXT.BUTTONS_PT.ENABLED);
            toggleButton.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-1 py-0.5 pixel-font-16 flex-1 text-whiteHighlight';
            break;
    }
}



// ============================================================================
// 7. QUEST BUTTON MODIFICATION FUNCTIONS
// ============================================================================

// Store original quest button state
let originalQuestButtonState = null;
let questButtonValidationInterval = null;
let boardStateUnsubscribe = null;

// Store the map ID when tasking starts (after Start button click)
let taskingMapId = null;

// Track if quest button has been modified for tasking (only after Start button click)
let questButtonModifiedForTasking = false;

// Function to get current room ID
function getCurrentRoomId() {
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.selectedMap && boardContext.selectedMap.selectedRoom) {
            return boardContext.selectedMap.selectedRoom.id;
        }
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error getting current room ID:', error);
        return null;
    }
}

// Function to get room ID for a map name
function getRoomIdForMapName(mapName) {
    try {
        // Get all available maps from the game state
        const boardContext = globalThis.state.board.getSnapshot().context;
        if (boardContext && boardContext.maps) {
            // Look through all maps to find one that matches the name
            for (const map of boardContext.maps) {
                if (map.name === mapName) {
                    // Return the first room ID of this map
                    if (map.rooms && map.rooms.length > 0) {
                        console.log(`[Better Tasker] Found room ID for map "${mapName}": ${map.rooms[0].id}`);
                        return map.rooms[0].id;
                    }
                }
            }
        }
        
        console.log(`[Better Tasker] No room ID found for map: ${mapName}`);
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error getting room ID for map name:', error);
        return null;
    }
}

// Function to check if user is on the correct tasking map
function isOnCorrectTaskingMap() {
    if (!taskOperationInProgress && !taskHuntingOngoing) {
        return false;
    }
    
    const currentRoomId = getCurrentRoomId();
    if (!currentRoomId) {
        console.log('[Better Tasker] Could not determine current room ID');
        return false;
    }
    
    // If we have a saved tasking map ID, compare with current map
    if (taskingMapId) {
        const isCorrectMap = currentRoomId === taskingMapId;
        console.log(`[Better Tasker] Map validation: current=${currentRoomId}, tasking=${taskingMapId}, correct=${isCorrectMap}`);
        return isCorrectMap;
    }
    
    // Fallback: Get the recommended map for the current task (for initial setup)
    try {
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task) {
            console.log(`[Better Tasker] Task object keys:`, Object.keys(task));
            
            // Game State API doesn't provide suggestedMap - this validation is not possible via API
            console.log('[Better Tasker] Cannot validate map via Game State API - suggestedMap not available');
            return true; // Allow any map since we can't validate
        } else {
            console.log('[Better Tasker] No task found - allowing any map');
            return true;
        }
    } catch (error) {
        console.error('[Better Tasker] Error checking recommended map:', error);
        return true;
    }
}

// Function to find quest button with multiple fallback selectors
function findQuestButton() {
    // First, try to find by quest icon (normal state) - check both selected and unselected
    const questIconButton = document.querySelector('button img[src*="quest.png"]')?.closest('button');
    if (questIconButton) {
        console.log('[Better Tasker] Found quest button by quest icon');
        return questIconButton;
    }
    
    // Then, look for any button with "Tasking" text - check both selected and unselected
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Tasking') {
            console.log('[Better Tasker] Found quest button by Tasking text');
            return button;
        }
    }
    
    // Fallback: look for any button with quest-related alt text - check both selected and unselected
    const questAltButton = document.querySelector('button img[alt="Quests"]')?.closest('button');
    if (questAltButton) {
        console.log('[Better Tasker] Found quest button by quest alt text');
        return questAltButton;
    }
    
    // Additional fallback: look for any button with "Quests" text
    for (const button of allButtons) {
        const span = button.querySelector('span');
        if (span && span.textContent === 'Quests') {
            console.log('[Better Tasker] Found quest button by Quests text');
            return button;
        }
    }
    
    console.log('[Better Tasker] Quest button not found');
    return null;
}

// Function to modify quest button appearance when tasking is active
function modifyQuestButtonForTasking() {
    console.log('[Better Tasker] Attempting to modify quest button for tasking...');
    
    return withControl(window.QuestButtonManager, 'Better Tasker', () => {
        console.log('[Better Tasker] Quest button control granted, finding quest button...');
        
        // Find the quest button in the header navigation
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for modification');
            return false;
        }
        
        console.log('[Better Tasker] Quest button found, proceeding with modification...');
        
        // Store original state if not already stored AND quest button is in original state
        if (!window.QuestButtonManager.originalState) {
            const img = questButton.querySelector('img');
            const span = questButton.querySelector('span');
            
            // Only store original state if quest button appears to be in original state
            // Check if it's not already modified by another mod
            const isInOriginalState = img && img.src.includes('quest.png') && span && span.textContent === 'Quests';
            
            if (isInOriginalState) {
                window.QuestButtonManager.originalState = {
                    imgSrc: img ? img.src : null,
                    imgAlt: img ? img.alt : null,
                    imgWidth: img ? img.width : null,
                    imgHeight: img ? img.height : null,
                    imgStyle: img ? img.style.cssText : null,
                    imgClassList: img ? img.className : null,
                    spanText: span ? span.textContent : null,
                    buttonColor: questButton.style.color || ''
                };
                console.log('[Better Tasker] Stored original quest button state');
            } else {
                console.log('[Better Tasker] Quest button not in original state - not storing originalState');
            }
        }
        
        // Modify the button appearance - replace icon and change text
        const img = questButton.querySelector('img');
        const span = questButton.querySelector('span');
        
        // Replace the icon with taskrank icon
        if (img) {
            img.src = 'https://bestiaryarena.com/assets/icons/taskrank.png';
            img.alt = 'Tasking';
            img.style.display = ''; // Make sure it's visible
        }
        
        // Change text to "Tasking"
        if (span) {
            span.textContent = 'Tasking';
            // Add shimmer effect to the text
            span.style.background = 'linear-gradient(45deg, #22c55e, #16a34a, #22c55e, #16a34a)';
            span.style.backgroundSize = '400% 400%';
            span.style.backgroundClip = 'text';
            span.style.webkitBackgroundClip = 'text';
            span.style.webkitTextFillColor = 'transparent';
            span.style.animation = 'taskerShimmer 2s ease-in-out infinite';
        }
        
        // Add CSS keyframes for shimmer animation if not already added
        if (!document.getElementById('taskerShimmerCSS')) {
            const style = document.createElement('style');
            style.id = 'taskerShimmerCSS';
            style.textContent = `
                @keyframes taskerShimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Set green color for the button
        questButton.style.color = '#22c55e'; // Green color
        
        console.log('[Better Tasker] Quest button modified for tasking state');
        return true;
    }, 'modify quest button');
}

// Function to restore quest button to original appearance
function restoreQuestButtonAppearance() {
    return withControlCheck(window.QuestButtonManager, 'Better Tasker', () => {
        // Find the quest button - try multiple selectors to find it regardless of current state
        const questButton = findQuestButton();
        
        if (!questButton) {
            console.log('[Better Tasker] Quest button not found for restoration');
            return false;
        }
        
        if (!window.QuestButtonManager.originalState) {
            console.log('[Better Tasker] Original quest button state not found for restoration');
            return false;
        }
        
        // Restore original appearance
        const img = questButton.querySelector('img');
        const span = questButton.querySelector('span');
        
        // Show the icon again
        if (img) {
            img.style.display = '';
            // Restore original source and properties
            if (window.QuestButtonManager.originalState.imgSrc) {
                img.src = window.QuestButtonManager.originalState.imgSrc;
                img.alt = window.QuestButtonManager.originalState.imgAlt;
            }
            // Restore original dimensions
            if (window.QuestButtonManager.originalState.imgWidth) {
                img.width = window.QuestButtonManager.originalState.imgWidth;
            }
            if (window.QuestButtonManager.originalState.imgHeight) {
                img.height = window.QuestButtonManager.originalState.imgHeight;
            }
            // Restore original CSS styles
            if (window.QuestButtonManager.originalState.imgStyle) {
                img.style.cssText = window.QuestButtonManager.originalState.imgStyle;
            }
            // Restore original class list
            if (window.QuestButtonManager.originalState.imgClassList) {
                img.className = window.QuestButtonManager.originalState.imgClassList;
            }
        }
        
        // Restore original text and clear shimmer effect
        if (span) {
            if (window.QuestButtonManager.originalState.spanText) {
                span.textContent = window.QuestButtonManager.originalState.spanText;
            }
            // Clear shimmer effect
            span.style.background = '';
            span.style.backgroundSize = '';
            span.style.backgroundClip = '';
            span.style.webkitBackgroundClip = '';
            span.style.webkitTextFillColor = '';
            span.style.animation = '';
        }
        
        // Restore original color
        questButton.style.color = window.QuestButtonManager.originalState.buttonColor;
        
        console.log('[Better Tasker] Quest button appearance restored');
        return true;
    }, 'restore quest button');
}

// Function to start monitoring quest button validation using real-time board state subscription
function startQuestButtonValidation() {
    // Clear any existing subscription or interval
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
    }
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
    }
    
    // Only start monitoring if we're currently tasking or hunting
    if (!taskOperationInProgress && !taskHuntingOngoing) {
        return;
    }
    
    console.log('[Better Tasker] Starting real-time quest button validation monitoring');
    
    try {
        // Subscribe to board state changes for immediate map change detection
        boardStateUnsubscribe = globalThis.state.board.subscribe((state) => {
            try {
                // Check if we're still tasking or hunting
                if (!taskOperationInProgress && !taskHuntingOngoing) {
                    console.log('[Better Tasker] No longer tasking or hunting - stopping quest button validation');
                    stopQuestButtonValidation();
                    return;
                }
                
                // Get current room ID from the state
                const currentRoomId = state.context?.selectedMap?.selectedRoom?.id;
                
                // Check if we're on the correct map for tasking
                if (taskingMapId && currentRoomId !== taskingMapId) {
                    console.log(`[Better Tasker] Map change detected: ${taskingMapId} -> ${currentRoomId} - restoring quest button`);
                    
                    // Request control to restore quest button (don't just check for it)
                    withControl(window.QuestButtonManager, 'Better Tasker', () => {
                        const questButton = findQuestButton();
                        
                        if (!questButton) {
                            console.log('[Better Tasker] Quest button not found for restoration');
                            return false;
                        }
                        
                        if (!window.QuestButtonManager.originalState) {
                            console.log('[Better Tasker] Original quest button state not found for restoration');
                            return false;
                        }
                        
                        // Restore original appearance
                        const img = questButton.querySelector('img');
                        const span = questButton.querySelector('span');
                        
                        // Show the icon again
                        if (img) {
                            img.style.display = '';
                            // Restore original source and properties
                            if (window.QuestButtonManager.originalState.imgSrc) {
                                img.src = window.QuestButtonManager.originalState.imgSrc;
                                img.alt = window.QuestButtonManager.originalState.imgAlt;
                            }
                            // Restore original dimensions
                            if (window.QuestButtonManager.originalState.imgWidth) {
                                img.width = window.QuestButtonManager.originalState.imgWidth;
                            }
                            if (window.QuestButtonManager.originalState.imgHeight) {
                                img.height = window.QuestButtonManager.originalState.imgHeight;
                            }
                            // Restore original CSS styles
                            if (window.QuestButtonManager.originalState.imgStyle) {
                                img.style.cssText = window.QuestButtonManager.originalState.imgStyle;
                            }
                            // Restore original class list
                            if (window.QuestButtonManager.originalState.imgClassList) {
                                img.className = window.QuestButtonManager.originalState.imgClassList;
                            }
                        }
                        
                        // Restore original text and clear shimmer effect
                        if (span) {
                            if (window.QuestButtonManager.originalState.spanText) {
                                span.textContent = window.QuestButtonManager.originalState.spanText;
                            }
                            // Clear shimmer effect
                            span.style.background = '';
                            span.style.backgroundSize = '';
                            span.style.backgroundClip = '';
                            span.style.webkitBackgroundClip = '';
                            span.style.webkitTextFillColor = '';
                            span.style.animation = '';
                        }
                        
                        // Restore original color
                        questButton.style.color = window.QuestButtonManager.originalState.buttonColor;
                        
                        console.log('[Better Tasker] Quest button appearance restored after map navigation');
                        return true;
                    }, 'restore quest button on map change');
                    
                    // Clear the saved tasking map ID since user switched maps
                    taskingMapId = null;
                    // CRITICAL FIX: Reset quest button modification flag to match visual state
                    questButtonModifiedForTasking = false;
                    console.log('[Better Tasker] Cleared tasking map ID and quest button modification flag - quest button reset to normal state');
                }
                
            } catch (error) {
                console.error('[Better Tasker] Error in board state subscription:', error);
            }
        });
        
        console.log('[Better Tasker] Real-time board state monitoring active');
        
    } catch (error) {
        console.error('[Better Tasker] Error setting up board state subscription:', error);
        // Fallback to old polling method if subscription fails
        console.log('[Better Tasker] Falling back to polling method');
        startQuestButtonValidationPolling();
    }
}

// Fallback polling method (only used if real-time subscription fails)
function startQuestButtonValidationPolling() {
    // Clear any existing interval
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
    }
    
    // Only start monitoring if we're currently tasking or hunting
    if (!taskOperationInProgress && !taskHuntingOngoing) {
        return;
    }
    
    console.log('[Better Tasker] Starting quest button validation monitoring (polling fallback)');
    
    questButtonValidationInterval = setInterval(() => {
        try {
            // Check if we're still tasking or hunting
            if (!taskOperationInProgress && !taskHuntingOngoing) {
                console.log('[Better Tasker] No longer tasking or hunting - stopping quest button validation');
                stopQuestButtonValidation();
                return;
            }
            
            // Check if we're on the correct map for tasking
            if (!isOnCorrectTaskingMap()) {
                console.log('[Better Tasker] User navigated away from tasking map - restoring quest button and clearing saved map ID');
                
                // Request control to restore quest button (don't just check for it)
                withControl(window.QuestButtonManager, 'Better Tasker', () => {
                    const questButton = findQuestButton();
                    
                    if (!questButton) {
                        console.log('[Better Tasker] Quest button not found for restoration');
                        return false;
                    }
                    
                    if (!window.QuestButtonManager.originalState) {
                        console.log('[Better Tasker] Original quest button state not found for restoration');
                        return false;
                    }
                    
                    // Restore original appearance
                    const img = questButton.querySelector('img');
                    const span = questButton.querySelector('span');
                    
                    // Show the icon again
                    if (img) {
                        img.style.display = '';
                        // Restore original source and properties
                        if (window.QuestButtonManager.originalState.imgSrc) {
                            img.src = window.QuestButtonManager.originalState.imgSrc;
                            img.alt = window.QuestButtonManager.originalState.imgAlt;
                        }
                        // Restore original dimensions
                        if (window.QuestButtonManager.originalState.imgWidth) {
                            img.width = window.QuestButtonManager.originalState.imgWidth;
                        }
                        if (window.QuestButtonManager.originalState.imgHeight) {
                            img.height = window.QuestButtonManager.originalState.imgHeight;
                        }
                        // Restore original CSS styles
                        if (window.QuestButtonManager.originalState.imgStyle) {
                            img.style.cssText = window.QuestButtonManager.originalState.imgStyle;
                        }
                        // Restore original class list
                        if (window.QuestButtonManager.originalState.imgClassList) {
                            img.className = window.QuestButtonManager.originalState.imgClassList;
                        }
                    }
                    
                    // Restore original text and clear shimmer effect
                    if (span) {
                        if (window.QuestButtonManager.originalState.spanText) {
                            span.textContent = window.QuestButtonManager.originalState.spanText;
                        }
                        // Clear shimmer effect
                        span.style.background = '';
                        span.style.backgroundSize = '';
                        span.style.backgroundClip = '';
                        span.style.webkitBackgroundClip = '';
                        span.style.webkitTextFillColor = '';
                        span.style.animation = '';
                    }
                    
                    // Restore original color
                    questButton.style.color = window.QuestButtonManager.originalState.buttonColor;
                    
                    console.log('[Better Tasker] Quest button appearance restored after map navigation');
                    return true;
                }, 'restore quest button on map change');
                
                // Clear the saved tasking map ID since user switched maps
                taskingMapId = null;
                // CRITICAL FIX: Reset quest button modification flag to match visual state
                questButtonModifiedForTasking = false;
                console.log('[Better Tasker] Cleared tasking map ID and quest button modification flag - quest button reset to normal state');
                // Don't stop the interval - keep monitoring in case they come back
                return;
            }
        } catch (error) {
            console.error('[Better Tasker] Error in quest button validation:', error);
        }
    }, 30000); // Check every 30 seconds
}

// Function to stop monitoring quest button validation
function stopQuestButtonValidation() {
    // Unsubscribe from board state changes
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        boardStateUnsubscribe();
        boardStateUnsubscribe = null;
        console.log('[Better Tasker] Board state subscription stopped');
    }
    
    // Clear polling interval (fallback method)
    if (questButtonValidationInterval) {
        clearInterval(questButtonValidationInterval);
        questButtonValidationInterval = null;
        console.log('[Better Tasker] Quest button validation monitoring stopped');
    }
    
    // Clear the saved tasking map ID when stopping validation
    if (taskingMapId) {
        console.log(`[Better Tasker] Clearing saved tasking map ID: ${taskingMapId}`);
        taskingMapId = null;
    }
}

// ============================================================================
// 8. QUEST LOG MONITORING
// ============================================================================

// Check for quest log content
function checkForQuestLogContent(node) {
    return node.textContent?.includes('Quest Log') || 
           (node.querySelector?.('*') && 
            Array.from(node.querySelectorAll('*')).some(el => 
              el.textContent?.includes('Quest Log')
            )) ||
           // Check for quest log container structure
           (node.classList?.contains('grid') && 
            node.classList?.contains('items-start') && 
            node.classList?.contains('gap-1')) ||
           // Check for widget-bottom that might contain quest log
           node.classList?.contains('widget-bottom') ||
           // Check for any element with quest log related classes
           (node.querySelector && node.querySelector('.grid.h-\\[260px\\].items-start.gap-1'));
}

// Check for Paw and Fur Society content
function checkForPawAndFurContent(node) {
    return node.textContent?.includes('Paw and Fur Society') || 
           (node.querySelector?.('*') && 
            Array.from(node.querySelectorAll('*')).some(el => 
              el.textContent?.includes('Paw and Fur Society')
            ));
}

// Quest log detection handler - IMMEDIATE button insertion (like Raid Hunter)
function handleQuestLogDetection(mutations) {
    let hasQuestLogContent = false;
    let hasPawAndFurContent = false;
    
    // Process mutations for quest log content
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && !document.getElementById(TASKER_BUTTON_ID)) {
                    hasQuestLogContent = checkForQuestLogContent(node);
                    if (hasQuestLogContent) break;
                }
            }
        }
        if (hasQuestLogContent) break;
    }
    
    // Check for Paw and Fur Society content
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && !document.getElementById(TASKER_BUTTON_ID)) {
                    hasPawAndFurContent = checkForPawAndFurContent(node);
                    if (hasPawAndFurContent) break;
                }
            }
        }
        if (hasPawAndFurContent) break;
    }
    
    // Handle quest log detection - insert buttons immediately
    if (hasQuestLogContent || hasPawAndFurContent) {
        console.log('[Better Tasker] Quest log content detected!');
        
        // Insert buttons immediately if they don't exist
        if (!document.getElementById(TASKER_BUTTON_ID) || !document.getElementById(TASKER_TOGGLE_ID)) {
            insertButtons();
        }
    }
}

// Task processing handler - DEBOUNCED for batching (like Raid Hunter's fight toast, but with delay)
let mutationProcessTimer = null;
function handleTaskProcessing(mutations) {
    // Debounce task processing to batch rapid mutations
    if (mutationProcessTimer) {
        clearTimeout(mutationProcessTimer);
    }
    
    mutationProcessTimer = setTimeout(() => {
        processMutations(mutations);
        mutationProcessTimer = null;
    }, 100); // 100ms debounce delay for task processing
}

// Consolidated mutation processing (like Raid Hunter)
function processAllMutations(mutations) {
    // Handle quest log detection immediately (button insertion)
    handleQuestLogDetection(mutations);
    
    // Handle task processing with debounce (task logic)
    handleTaskProcessing(mutations);
}

// Actual mutation processing logic
function processMutations(mutations) {
    let hasQuestLogContent = false;
    let hasPawAndFurContent = false;
    
    // Process all mutations in one pass
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check for quest log content
                    if (!hasQuestLogContent) {
                        hasQuestLogContent = checkForQuestLogContent(node);
                    }
                    
                    // Check for Paw and Fur Society content
                    if (!hasPawAndFurContent) {
                        hasPawAndFurContent = checkForPawAndFurContent(node);
                    }
                }
            }
        }
    }
    
    // Handle quest log detection (task processing logic only - buttons already inserted above)
    if (hasQuestLogContent) {
        // Only trigger task completion logic if we're not already processing a task
        // and we're not just inserting UI elements
        if (!taskOperationInProgress && !pendingTaskCompletion && !taskHuntingOngoing) {
            console.log('[Better Tasker] Quest log opened for task processing - checking for tasks...');
            // Small delay to let quest log fully load before checking
            setTimeout(() => {
                checkQuestLogForTasks();
            }, 100);
        } else {
            console.log('[Better Tasker] Quest log opened but task operation already in progress - skipping task check');
        }
    }
}

// Monitors quest log visibility
function monitorQuestLogVisibility() {
    // Skip if observer already exists
    if (questLogObserver) {
        console.log('[Better Tasker] Observer already exists, skipping');
        return;
    }
    
    // Consolidated MutationObserver for quest log and Paw and Fur Society detection
    questLogObserver = new MutationObserver(processAllMutations);
    
    questLogObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Better Tasker] MutationObserver set up for quest log and Paw and Fur Society detection');
}

// Starts UI monitoring (always runs to insert buttons)
function startUIMonitoring() {
    console.log('[Better Tasker] Starting UI monitoring...');
    
    // Clear any existing UI monitoring first
    
    if (questLogObserver) {
        console.log('[Better Tasker] Disconnecting existing UI observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection (UI only)
    monitorQuestLogVisibility();
}

// Starts quest log monitoring (for automation only)
function startQuestLogMonitoring() {
    console.log('[Better Tasker] Starting quest log monitoring...');
    
    // Clear any existing monitoring first
    
    if (questLogObserver) {
        console.log('[Better Tasker] Disconnecting existing observer');
        questLogObserver.disconnect();
        questLogObserver = null;
    }
    
    // Set up MutationObserver for quest log detection
    monitorQuestLogVisibility();
}

// Stops quest log monitoring
function stopQuestLogMonitoring() {
    console.log('[Better Tasker] Stopping quest log monitoring...');
    
    // Disconnect mutation observer
    if (questLogObserver) {
        questLogObserver.disconnect();
        questLogObserver = null;
    }
}

// ============================================================================
// 9. SETTINGS MODAL
// ============================================================================

// Cleanup function for modal state
function cleanupTaskerModal() {
    try {
        // Clear modal reference
        if (activeTaskerModal) {
            activeTaskerModal = null;
        }
        
        // Remove ESC key listener
        if (escKeyListener) {
            document.removeEventListener('keydown', escKeyListener);
            escKeyListener = null;
        }
        
        // Reset modal state
        taskerModalInProgress = false;
        lastModalCall = 0;
        
        console.log('[Better Tasker] Modal cleanup completed');
    } catch (error) {
        console.error('[Better Tasker] Error during modal cleanup:', error);
    }
}

// Constants for modal dimensions
const TASKER_MODAL_WIDTH = 700;
const TASKER_MODAL_HEIGHT = 400;

// Open Tasker Settings Modal
function openTaskerSettingsModal() {
    try {
        const now = Date.now();
        if (taskerModalInProgress) return;
        if (now - lastModalCall < 1000) return;
        
        lastModalCall = now;
        taskerModalInProgress = true;
        
        (() => {
            try {
                if (!taskerModalInProgress) return;
                
                // Simulate ESC key to remove scroll lock
                clearModalsWithEscSync(1);
                
                // Small delay to ensure scroll lock is removed
                setTimeout(() => {
                    if (typeof context !== 'undefined' && context.api && context.api.ui) {
                        try {
                            // Create settings content
                            const settingsContent = createSettingsContent();
                            
                            // Open modal
                            activeTaskerModal = context.api.ui.components.createModal({
                                title: getLocalizedText('Better Tasker Settings', 'Configurações do Better Tasker'),
                                width: TASKER_MODAL_WIDTH,
                                height: TASKER_MODAL_HEIGHT,
                                content: settingsContent,
                                buttons: [{ text: getLocalizedText(UI_TEXT.BUTTONS.CLOSE, UI_TEXT.BUTTONS_PT.CLOSE), primary: true }],
                                onClose: () => {
                                    console.log('[Better Tasker] Settings modal closed');
                                    cleanupTaskerModal();
                                }
                            });
                            
                            // Add ESC key support for closing modal
                            escKeyListener = (event) => {
                                if (event.key === 'Escape' && activeTaskerModal) {
                                    console.log('[Better Tasker] ESC key pressed, closing modal');
                                    cleanupTaskerModal();
                                }
                            };
                            document.addEventListener('keydown', escKeyListener);
                            
                            // Override modal size and load settings
                            setTimeout(() => {
                                const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (dialog) {
                                    dialog.style.width = TASKER_MODAL_WIDTH + 'px';
                                    dialog.style.minWidth = TASKER_MODAL_WIDTH + 'px';
                                    dialog.style.maxWidth = TASKER_MODAL_WIDTH + 'px';
                                    dialog.style.height = TASKER_MODAL_HEIGHT + 'px';
                                    dialog.style.minHeight = TASKER_MODAL_HEIGHT + 'px';
                                    dialog.style.maxHeight = TASKER_MODAL_HEIGHT + 'px';
                                    
                                    // Load and apply saved settings
                                    loadAndApplySettings();
                                }
                            }, 50);
                            
                            // Inject auto-save indicator into the existing modal footer
                            setTimeout(() => {
                                const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
                                if (modalElement) {
                                    const footer = modalElement.querySelector('.flex.justify-end.gap-2');
                                    if (footer) {
                                        // Create auto-save indicator
                                        const autoSaveIndicator = document.createElement('div');
                                        autoSaveIndicator.textContent = getLocalizedText(
                                            '✓ Settings auto-save when changed',
                                            '✓ Configurações são salvas automaticamente quando alteradas'
                                        );
                                        autoSaveIndicator.className = 'pixel-font-16';
                                        autoSaveIndicator.style.cssText = `
                                            font-size: 11px;
                                            color: #4ade80;
                                            font-style: italic;
                                            margin-right: auto;
                                        `;
                                        
                                        // Modify footer to use space-between layout
                                        footer.style.cssText = `
                                            display: flex;
                                            justify-content: space-between;
                                            align-items: center;
                                            gap: 2px;
                                        `;
                                        
                                        // Insert auto-save indicator at the beginning
                                        footer.insertBefore(autoSaveIndicator, footer.firstChild);
                                    }
                                }
                            }, 100);
                        } catch (error) {
                            console.error('[Better Tasker] Error creating modal:', error);
                            try {
                                alert('Failed to open settings. Please try again.');
                            } catch (alertError) {
                                console.error('[Better Tasker] Even fallback alert failed:', alertError);
                            }
                        } finally {
                            taskerModalInProgress = false;
                        }
                    } else {
                        console.warn('[Better Tasker] API not available for modal creation');
                        alert('Better Tasker Settings - API not available');
                        taskerModalInProgress = false;
                    }
                }, 100);
            } catch (error) {
                console.error('[Better Tasker] Error in modal creation wrapper:', error);
                taskerModalInProgress = false;
            }
        })();
        
    } catch (error) {
        console.error('[Better Tasker] Error in openTaskerSettingsModal:', error);
        taskerModalInProgress = false;
    }
}

// Create settings content
function createSettingsContent() {
    // Main container with 2-column layout
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 100%;
        min-width: 665px;
        max-width: 700px;
        min-height: 400px;
        max-height: 400px;
        box-sizing: border-box;
        overflow: hidden;
        background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
        color: #fff;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
        border: 4px solid transparent;
        border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 fill stretch;
        border-radius: 6px;
    `;
    
    // Left column - Auto-Task Settings
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
        width: 250px;
        min-width: 250px;
        max-width: 250px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #444;
        overflow-y: auto;
        min-height: 0;
        padding: 0;
        margin: 0;
        background: rgba(0, 0, 0, 0.2);
    `;
    
    // Right column - Task Settings
    const rightColumn = document.createElement('div');
    rightColumn.style.cssText = `
        flex: 1 1 0%;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.1);
        width: auto;
        height: 100%;
    `;
    
    // Left column content - Auto-Task Settings
    const leftContent = createGeneralSettings();
    leftColumn.appendChild(leftContent);
    
    // Right column content - Task Settings
    const rightContent = createTaskSettings();
    rightColumn.appendChild(rightContent);
    
    mainContainer.appendChild(leftColumn);
    mainContainer.appendChild(rightColumn);
    
    return mainContainer;
}

// Create Auto-Task Settings section
function createGeneralSettings() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        justify-content: space-between;
    `;
    
    const title = document.createElement('h3');
    title.textContent = getLocalizedText('Auto-Task Settings', 'Configurações de Auto-Task');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #ffe066;
        font-weight: bold;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    container.appendChild(title);
    
    // Create wrapper for main settings content that will be centered
    const settingsWrapper = document.createElement('div');
    settingsWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        justify-content: center;
    `;
    
    // Task Start Delay setting
    const taskDelayDiv = document.createElement('div');
    taskDelayDiv.style.cssText = `
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    
    const taskDelayLabel = document.createElement('label');
    taskDelayLabel.textContent = getLocalizedText(UI_TEXT.LABELS.TASK_START_DELAY, UI_TEXT.LABELS_PT.TASK_START_DELAY);
    taskDelayLabel.className = 'pixel-font-16';
    taskDelayLabel.style.cssText = `
        font-weight: bold;
        color: #fff;
        margin-bottom: 4px;
    `;
    taskDelayDiv.appendChild(taskDelayLabel);
    
    const taskDelayInput = createStyledInput('number', 'taskStartDelay', 3, `
        width: 100%;
        padding: 6px;
        background: #333;
        border: 1px solid #ffe066;
        color: #fff;
        border-radius: 3px;
        box-sizing: border-box;
        font-size: 14px;
    `, { 
        min: 0, 
        max: 10, 
        className: 'pixel-font-16' 
    });
    // Add auto-save listener with tracking
    addTrackedListener(taskDelayInput, 'input', autoSaveSettings);
    taskDelayDiv.appendChild(taskDelayInput);
    
    settingsWrapper.appendChild(taskDelayDiv);
    
    // Setup method selection
    const setupMethodDiv = createDropdownSetting(
        'setupMethod',
        getLocalizedText('Setup Method', 'Método de Configuração'),
        '',
        loadSettings().setupMethod || getLocalizedText('Auto-setup', 'Autoconfigurar'),
        getAvailableSetupOptions()
    );
    settingsWrapper.appendChild(setupMethodDiv);
    
    // Auto-refill Stamina setting
    const staminaRefillSetting = createCheckboxSetting(
        'autoRefillStamina',
        getLocalizedText(UI_TEXT.LABELS.AUTO_REFILL_STAMINA, UI_TEXT.LABELS_PT.AUTO_REFILL_STAMINA),
        '',
        false
    );
    settingsWrapper.appendChild(staminaRefillSetting);
    
    // Faster Autoplay setting
    const fasterAutoplaySetting = createCheckboxSetting(
        'fasterAutoplay',
        getLocalizedText(UI_TEXT.LABELS.FASTER_AUTOPLAY, UI_TEXT.LABELS_PT.FASTER_AUTOPLAY),
        '',
        false
    );
    settingsWrapper.appendChild(fasterAutoplaySetting);
    
    // Auto-complete Tasks setting
    const autoCompleteSetting = createCheckboxSetting(
        'autoCompleteTasks',
        getLocalizedText(UI_TEXT.LABELS.AUTOCOMPLETE_TASKS, UI_TEXT.LABELS_PT.AUTOCOMPLETE_TASKS),
        '',
        true
    );
    settingsWrapper.appendChild(autoCompleteSetting);
    
    // Enable Autoplant setting
    const dragonPlantSetting = createCheckboxSetting(
        'enableDragonPlant',
        getLocalizedText(UI_TEXT.LABELS.ENABLE_AUTOPLANT, UI_TEXT.LABELS_PT.ENABLE_AUTOPLANT),
        '',
        false
    );
    settingsWrapper.appendChild(dragonPlantSetting);
    
    // Add settings wrapper to container
    container.appendChild(settingsWrapper);
    
    
    return container;
}

// Create Task Settings section
function createTaskSettings() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        gap: 20px;
        min-height: 0;
        justify-content: center;
    `;
    
    // Monster Selection Settings
    const monsterSection = createMonsterSelectionSettings();
    container.appendChild(monsterSection);
    
    return container;
}

// Create Monster Selection Settings section
function createMonsterSelectionSettings() {
    const section = document.createElement('div');
    section.style.cssText = `
        padding: 15px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #444;
        border-radius: 5px;
        margin: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
    `;
    
    const title = document.createElement('h3');
    title.textContent = getLocalizedText('Monster Selection', 'Seleção de Monstros');
    title.className = 'pixel-font-16';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #ffe066;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    section.appendChild(title);
    
    const description = document.createElement('div');
    description.textContent = getLocalizedText(UI_TEXT.LABELS.CREATURE_SELECTION, UI_TEXT.LABELS_PT.CREATURE_SELECTION);
    description.className = 'pixel-font-16';
    description.style.cssText = `
        margin-bottom: 15px;
        color: #888;
        font-style: italic;
    `;
    section.appendChild(description);
    
    // Add warning about active tasks
    const warning = document.createElement('div');
    warning.className = 'pixel-font-14';
    warning.style.cssText = `
        margin-bottom: 15px;
        padding: 8px 12px;
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 4px;
        color: #ffc107;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    `;
    
    // Create monster selection container first
    const monsterContainer = document.createElement('div');
    monsterContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        max-height: 190px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
    `;
    
    // Get creatures from the creature database
    const creatures = window.creatureDatabase?.ALL_CREATURES || [];
    
    if (creatures.length === 0) {
        const noCreaturesDiv = document.createElement('div');
        noCreaturesDiv.textContent = getLocalizedText(UI_TEXT.DESCRIPTIONS.NO_CREATURES_AVAILABLE, UI_TEXT.DESCRIPTIONS_PT.NO_CREATURES_AVAILABLE);
        noCreaturesDiv.className = 'pixel-font-16';
        noCreaturesDiv.style.cssText = `
            color: #888;
            font-style: italic;
            text-align: center;
            padding: 20px;
        `;
        monsterContainer.appendChild(noCreaturesDiv);
    } else {
        // Create checkboxes for each creature
        creatures.forEach(creatureName => {
            const creatureDiv = document.createElement('div');
            creatureDiv.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 2px 0;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            checkbox.checked = true; // Default to enabled
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                accent-color: #ffe066;
            `;
            
            const label = document.createElement('label');
            label.textContent = creatureName;
            label.className = 'pixel-font-16';
            label.style.cssText = `
                color: #fff;
                cursor: pointer;
                flex: 1;
            `;
            label.setAttribute('for', checkbox.id);
            
        // Create warning symbol for unselected creatures
        const warningSymbol = document.createElement('span');
        warningSymbol.textContent = '⚠️';
        warningSymbol.className = 'creature-warning-symbol';
        warningSymbol.style.cssText = `
            color: #ffc107;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.2s ease;
            cursor: help;
        `;
        warningSymbol.setAttribute('title', getLocalizedText(
            'Unselected creatures will cause active tasks to be removed',
            'Criaturas não selecionadas causarão remoção de tasks ativas'
        ));
            
        // Function to update warning visibility and count
        const updateWarningVisibility = () => {
            warningSymbol.style.opacity = checkbox.checked ? '0' : '1';
            window.updateWarningText(); // Update the warning count
        };
            
            // Add change listener to checkbox with tracking
            addTrackedListener(checkbox, 'change', updateWarningVisibility);
            
            creatureDiv.appendChild(checkbox);
            creatureDiv.appendChild(warningSymbol);
            creatureDiv.appendChild(label);
            monsterContainer.appendChild(creatureDiv);
        });
    }
    
    // Function to update warning text with count (defined after monsterContainer is created)
    window.updateWarningText = () => {
        const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]');
        const totalCreatures = checkboxes.length;
        const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        warning.textContent = getLocalizedText(
            `⚠️ Warning: Unselected creatures will cause active tasks to be removed! (${selectedCount}/${totalCreatures} selected creatures)`,
            `⚠️ Aviso: Criaturas não selecionadas causarão remoção de tasks ativas! (${selectedCount}/${totalCreatures} criaturas selecionadas)`
        );
    };
    
    // Add warning before monster container
    section.appendChild(warning);
    section.appendChild(monsterContainer);
    
    // Set initial warning text AFTER monsterContainer is added to DOM
    window.updateWarningText();
    
    // Add select all/none buttons
    const buttonContainer = createStyledContainer(null, `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `);
    
    const selectAllBtn = createCustomStyledButton(
        'selectAllBtn',
        'Select All',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = true;
                // Hide warning symbol for this checkbox
                const warningSymbol = cb.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = '0';
                }
            });
            window.updateWarningText(); // Update the warning count
            autoSaveSettings(); // Auto-save after selecting all
        }
    );
    
    const selectNoneBtn = createCustomStyledButton(
        'selectNoneBtn',
        'Select None',
        'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 text-whiteHighlight',
        'flex: 1;',
        () => {
            const checkboxes = monsterContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = false;
                // Show warning symbol for this checkbox
                const warningSymbol = cb.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = '1';
                }
            });
            window.updateWarningText(); // Update the warning count
            autoSaveSettings(); // Auto-save after selecting none
        }
    );
    
    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(selectNoneBtn);
    section.appendChild(buttonContainer);
    
    return section;
}

// ============================================================================
// 10. SETTINGS PERSISTENCE
// ============================================================================

// Load settings function
function loadSettings() {
    const defaultSettings = {
        autoCompleteTasks: true,
        autoRefillStamina: false,
        fasterAutoplay: false,
        enableDragonPlant: false,
        setupMethod: getLocalizedText('Auto-setup', 'Autoconfigurar'),  // Default to Auto-setup
        // Default all creatures to enabled
        ...Object.fromEntries(
            (window.creatureDatabase?.ALL_CREATURES || []).map(creature => 
                [`creature-${creature.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`, true]
            )
        )
    };
    
    const saved = localStorage.getItem('betterTaskerSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { ...defaultSettings, ...parsed };
        } catch (error) {
            console.error('[Better Tasker] Error parsing settings:', error);
        }
    }
    return defaultSettings;
}

// Auto-save settings when changed
function autoSaveSettings() {
    try {
        const settings = {};
        const inputs = document.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            // Only process inputs that belong to Better Tasker settings
            if (input.id === 'autoCompleteTasks' || input.id === 'autoRefillStamina' || input.id === 'fasterAutoplay' || input.id === 'enableDragonPlant' || input.id === 'taskStartDelay' || input.id === 'setupMethod' || input.id.startsWith('creature-')) {
                if (input.type === 'checkbox') {
                    settings[input.id] = input.checked;
                } else {
                    settings[input.id] = input.value;
                }
            }
        });
        
        // Save to localStorage
        localStorage.setItem('betterTaskerSettings', JSON.stringify(settings));
        console.log('[Better Tasker] Settings auto-saved:', settings);
    } catch (error) {
        console.error('[Better Tasker] Error auto-saving settings:', error);
    }
}

// Load and apply settings to the modal
function loadAndApplySettings() {
    try {
        const settings = loadSettings();
        
        if (settings.autoRefillStamina !== undefined) {
            const checkbox = document.getElementById('autoRefillStamina');
            if (checkbox) {
                checkbox.checked = settings.autoRefillStamina;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.fasterAutoplay !== undefined) {
            const checkbox = document.getElementById('fasterAutoplay');
            if (checkbox) {
                checkbox.checked = settings.fasterAutoplay;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.autoCompleteTasks !== undefined) {
            const checkbox = document.getElementById('autoCompleteTasks');
            if (checkbox) {
                checkbox.checked = settings.autoCompleteTasks;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.enableDragonPlant !== undefined) {
            const checkbox = document.getElementById('enableDragonPlant');
            if (checkbox) {
                checkbox.checked = settings.enableDragonPlant;
                // Event listener already added by createCheckboxSetting
            }
        }
        
        if (settings.taskStartDelay !== undefined) {
            const input = document.getElementById('taskStartDelay');
            if (input) {
                input.value = settings.taskStartDelay;
                // Add auto-save listener with tracking
                addTrackedListener(input, 'input', autoSaveSettings);
            }
        }
        
        // Apply setup method setting
        if (settings.setupMethod !== undefined) {
            const setupMethodSelect = document.getElementById('setupMethod');
            if (setupMethodSelect) {
                setupMethodSelect.value = settings.setupMethod;
                // Add auto-save listener
                setupMethodSelect.addEventListener('change', autoSaveSettings);
            }
        }
        
        // Apply creature selections from individual settings
        const creatures = window.creatureDatabase?.ALL_CREATURES || [];
        console.log('[Better Tasker] Loading creature settings:', {
            hasIndividualSettings: Object.keys(settings).some(key => key.startsWith('creature-'))
        });
        
        creatures.forEach(creatureName => {
            const checkboxId = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                // Use individual creature setting
                const individualSetting = settings[checkboxId];
                checkbox.checked = individualSetting !== undefined ? individualSetting : true;
                
                // Update warning symbol visibility based on checkbox state
                const warningSymbol = checkbox.parentElement.querySelector('.creature-warning-symbol');
                if (warningSymbol) {
                    warningSymbol.style.opacity = checkbox.checked ? '0' : '1';
                }
            }
        });
        
        // Add auto-save listeners to all creature checkboxes
        creatures.forEach(creatureName => {
            const checkboxId = `creature-${creatureName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                addTrackedListener(checkbox, 'change', autoSaveSettings);
            }
        });
        
        // Update warning text count after loading settings
        if (typeof window.updateWarningText === 'function') {
            window.updateWarningText();
        }
        
        console.log('[Better Tasker] Settings applied to modal with auto-save listeners');
    } catch (error) {
        console.error('[Better Tasker] Error applying settings:', error);
    }
}

// ============================================================================
// 11. TASK HANDLING FUNCTIONS
// ============================================================================

// Enable Bestiary Automator settings with retry logic
function enableBestiaryAutomatorSettings(returnSuccess = false) {
    const settings = loadSettings();
    let anySuccess = false;
    
    if (settings.autoRefillStamina) {
        console.log('[Better Tasker] Auto-refill stamina enabled - enabling Bestiary Automator autorefill...');
        // Add a small delay to ensure Bestiary Automator is fully initialized
        setTimeout(() => {
            const success = enableBestiaryAutomatorStaminaRefill();
            if (success) anySuccess = true;
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    const retrySuccess = enableBestiaryAutomatorStaminaRefill();
                    if (retrySuccess) anySuccess = true;
                }, BESTIARY_RETRY_DELAY);
            }
        }, BESTIARY_INTEGRATION_DELAY);
    }
    
    if (settings.fasterAutoplay) {
        console.log('[Better Tasker] Faster autoplay enabled - enabling Bestiary Automator faster autoplay...');
        // Add a small delay to ensure Bestiary Automator is fully initialized
        setTimeout(() => {
            const success = enableBestiaryAutomatorFasterAutoplay();
            if (success) anySuccess = true;
            if (!success) {
                // If first attempt failed, try again with longer delay for Chrome
                console.log('[Better Tasker] First attempt failed, retrying with longer delay for Chrome...');
                setTimeout(() => {
                    const retrySuccess = enableBestiaryAutomatorFasterAutoplay();
                    if (retrySuccess) anySuccess = true;
                }, BESTIARY_RETRY_DELAY);
            }
        }, BESTIARY_INTEGRATION_DELAY);
    }
    
    if (settings.enableDragonPlant) {
        console.log('[Better Tasker] Dragon Plant enabled - enabling via Autoseller...');
        enableAutosellerDragonPlant();
    }
    
    // Return success status if requested (for functions that need it)
    if (returnSuccess) {
        return anySuccess;
    }
}

// Handle quest log state - close quest log first, then navigate to suggested map
async function handleQuestLogState(roomId) {
    // First, close the quest log with ESC key presses (like Raid Hunter)
    console.log('[Better Tasker] Closing quest log before navigation...');
    await clearModalsWithEsc(3);
    
    // Wait for quest log to close
    await sleep(AUTOMATION_CHECK_DELAY);
    console.log('[Better Tasker] Quest log closed with ESC presses');
    
    // Now navigate to the suggested map
    console.log('[Better Tasker] Navigating to suggested map via API...');
    globalThis.state.board.send({
        type: 'selectRoomById',
        roomId: roomId
    });
    await sleep(NAVIGATION_DELAY);
    
    // Wait for map to load
    await sleep(AUTOMATION_CHECK_DELAY);
    console.log('[Better Tasker] Navigation to suggested map completed via API');
    
    return true; // Navigation completed, quest log closed
}

// Check if game is active and ready for task operations
function isGameActive() {
    try {
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.board) {
            console.log('[Better Tasker] Game State API not available');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error checking game state:', error);
        return false;
    }
}

// Check if new task is available based on resetAt timestamp
function isQuestBlipAvailable() {
    try {
        console.log('[Better Tasker] isQuestBlipAvailable: Checking via game state API...');
        const task = globalThis.state.player.get().context.questLog.task;
        
        if (!task) {
            console.log('[Better Tasker] isQuestBlipAvailable: No task object found');
            return false;
        }
        
        console.log('[Better Tasker] isQuestBlipAvailable: Task data:', {
            gameId: task.gameId,
            ready: task.ready,
            resetAt: task.resetAt,
            resetAtDate: task.resetAt ? new Date(task.resetAt).toLocaleString() : 'null',
            killCount: task.killCount
        });
        
        // If resetAt is null, a new task is available
        if (!task.resetAt) {
            console.log('[Better Tasker] isQuestBlipAvailable: ✓ New task available (resetAt is null)');
            return true;
        }
        
        // If resetAt is a timestamp, check if it's in the past
        const now = Date.now();
        const resetTime = task.resetAt;
        
        if (now >= resetTime) {
            console.log('[Better Tasker] isQuestBlipAvailable: ✓ Task cooldown expired, new task available');
            return true;
        }
        
        const timeRemaining = Math.ceil((resetTime - now) / 1000);
        console.log(`[Better Tasker] isQuestBlipAvailable: ✗ Task cooldown active, ${timeRemaining}s remaining`);
        return false;
    } catch (error) {
        console.error('[Better Tasker] isQuestBlipAvailable: Error checking task availability:', error);
        return false;
    }
}

// Navigate to suggested map and start autoplay using API
async function navigateToSuggestedMapAndStartAutoplay(suggestedMapElement = null) {
    try {
        console.log('[Better Tasker] Looking for suggested map link...');
        
        // First, ensure quest log is open
        console.log('[Better Tasker] Ensuring quest log is open...');
        const questLogOpened = await openQuestLogDirectly();
        if (!questLogOpened) {
            console.log('[Better Tasker] Failed to open quest log - checking if we can use stored map ID...');
            
            // If quest log cannot be opened (e.g., during autoplay), try to use stored taskingMapId
            if (taskingMapId) {
                console.log(`[Better Tasker] Using stored tasking map ID: ${taskingMapId}`);
                const roomId = taskingMapId;
                
                // Show toast notification
                showToast('Starting Better Tasker');
                
                // Handle quest log state and navigation
                const navigationCompleted = await handleQuestLogState(roomId);
                
                // Set the tasking map ID for future validation (already set, but ensure it's preserved)
                taskingMapId = roomId;
                console.log(`[Better Tasker] Tasking map ID preserved: ${taskingMapId}`);
                
                // Continue with setup...
                const settings = loadSettings();
                const setupMethod = settings.setupMethod || 'Auto-setup';
                
                // Find and click the appropriate setup button
                console.log(`[Better Tasker] Looking for ${setupMethod} button...`);
                const setupButton = findSetupButton(setupMethod);
                if (!setupButton) {
                    console.log(`[Better Tasker] ${setupMethod} button not found`);
                    return false;
                }
                
                console.log(`[Better Tasker] Clicking ${setupMethod} button...`);
                setupButton.click();
                await sleep(AUTO_SETUP_DELAY);
                
                // Enable autoplay mode
                console.log('[Better Tasker] Enabling autoplay mode...');
                await ensureAutoplayMode();
                await sleep(AUTOPLAY_SETUP_DELAY);
                
                // Enable Bestiary Automator settings if configured
                enableBestiaryAutomatorSettings();
                
                // Wait for Bestiary Automator to initialize
                console.log('[Better Tasker] Waiting for Bestiary Automator to initialize...');
                await sleep(BESTIARY_INIT_WAIT);
                
                // Post-navigation settings validation
                console.log('[Better Tasker] Validating settings after navigation...');
                validateSettingsAfterNavigation();
                
                // Set flag BEFORE checking stamina to prevent rechecking during ongoing task
                taskNavigationCompleted = true;
                console.log('[Better Tasker] Task navigation flag set - will not repeat quest log navigation during ongoing task');
                
                return true; // Navigation successful
            } else {
                console.log('[Better Tasker] No stored tasking map ID available - cannot proceed without quest log access');
                return false;
            }
        }
        
        // Wait for quest log to fully load
        await sleep(AUTOMATION_CHECK_DELAY);
        
        // Use provided element or look for the suggested map link
        let suggestedMapLink = suggestedMapElement;
        if (!suggestedMapLink) {
            // Look for the suggested map link only within Paw and Fur Society section
            console.log('[Better Tasker] No specific element provided, searching within Paw and Fur Society section...');
            const pawAndFurSection = findPawAndFurSection();
            if (pawAndFurSection) {
                console.log('[Better Tasker] Paw and Fur Society section found, looking for suggested map...');
                // Look for suggested map text within this section
                const allParagraphs = pawAndFurSection.querySelectorAll('p.pixel-font-14');
                const suggestedMapText = getLocalizedText(UI_TEXT.QUEST_TEXT.SUGGESTED_MAP, UI_TEXT.QUEST_TEXT_PT.SUGGESTED_MAP);
                for (const p of allParagraphs) {
                    if (p.textContent && p.textContent.includes(suggestedMapText)) {
                        suggestedMapLink = p.querySelector('span.action-link');
                        console.log('[Better Tasker] Suggested map found within Paw and Fur Society section');
                        break;
                    }
                }
            } else {
                console.log('[Better Tasker] Paw and Fur Society section not found');
            }
            
            // If still no link found in Paw and Fur Society section, don't proceed
            if (!suggestedMapLink) {
                console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                return false;
            }
        } else {
            console.log('[Better Tasker] Using provided suggested map element (already validated)');
        }
        if (suggestedMapLink) {
            console.log('[Better Tasker] Suggested map link found, extracting map info...');
            console.log('[Better Tasker] Attempting to extract room ID from suggested map...');
            
            // Debug: Log all attributes of the suggested map element
            console.log('[Better Tasker] Suggested map element attributes:', {
                tagName: suggestedMapLink.tagName,
                className: suggestedMapLink.className,
                id: suggestedMapLink.id,
                textContent: suggestedMapLink.textContent.trim(),
                allAttributes: Array.from(suggestedMapLink.attributes).map(attr => `${attr.name}="${attr.value}"`)
            });
            
            // Extract map name from text content
            const mapName = suggestedMapLink.textContent.trim();
            console.log('[Better Tasker] Extracted map name:', mapName);
            
            // Try to find room ID using game state API
            let roomId = null;
            if (globalThis.state?.utils?.ROOM_NAME) {
                // Find room ID by map name
                for (const [id, name] of Object.entries(globalThis.state.utils.ROOM_NAME)) {
                    if (name === mapName) {
                        roomId = id;
                        break;
                    }
                }
            }
            
            if (roomId) {
                console.log('[Better Tasker] Found room ID for map:', mapName, '->', roomId);
                
                // Show toast notification
                showToast('Starting Better Tasker');
                
                // Handle quest log state and navigation
                const navigationCompleted = await handleQuestLogState(roomId);
                
                // Set the tasking map ID for future validation
                taskingMapId = roomId;
                console.log(`[Better Tasker] Tasking map ID set to: ${taskingMapId}`);
                
                // Get user's selected setup method
                const settings = loadSettings();
                const setupMethod = settings.setupMethod || 'Auto-setup';
                
                // Find and click the appropriate setup button
                console.log(`[Better Tasker] Looking for ${setupMethod} button...`);
                const setupButton = findSetupButton(setupMethod);
                if (!setupButton) {
                    console.log(`[Better Tasker] ${setupMethod} button not found`);
                    return;
                }
                
                console.log(`[Better Tasker] Clicking ${setupMethod} button...`);
                setupButton.click();
                await sleep(AUTO_SETUP_DELAY);
                
                // Enable autoplay mode
                console.log('[Better Tasker] Enabling autoplay mode...');
                await ensureAutoplayMode();
                await sleep(AUTOPLAY_SETUP_DELAY);
                
                // Enable Bestiary Automator settings if configured
                enableBestiaryAutomatorSettings();
                
                // CRITICAL FIX: Wait for Bestiary Automator to initialize (standardized timing)
                console.log('[Better Tasker] Waiting for Bestiary Automator to initialize...');
                await sleep(BESTIARY_INIT_WAIT);
                
                // Post-navigation settings validation
                console.log('[Better Tasker] Validating settings after navigation...');
                validateSettingsAfterNavigation();
                
                // Set flag BEFORE checking stamina to prevent rechecking during ongoing task
                taskNavigationCompleted = true;
                console.log('[Better Tasker] Task navigation flag set - will not repeat quest log navigation during ongoing task');
                
                // Check stamina before clicking Start button
                console.log('[Better Tasker] Checking stamina status...');
                const staminaCheck = hasInsufficientStamina();
                
                if (staminaCheck.insufficient) {
                    console.log(`[Better Tasker] Insufficient stamina (needs ${staminaCheck.cost}) - starting monitoring`);
                    
                    // Start stamina recovery monitoring (tooltip + API for progress) with continuous monitoring
                    const continuousStaminaMonitoring = () => {
                        console.log('[Better Tasker] Stamina recovered - checking autoplay state');
                        
                        // Check if still valid to continue
                        if (!taskHuntingOngoing) {
                            console.log('[Better Tasker] Task no longer active during stamina recovery');
                            stopStaminaTooltipMonitoring();
                            return;
                        }
                        
                        // Check if user is still on correct tasking map
                        if (!isOnCorrectTaskingMap()) {
                            console.log('[Better Tasker] User changed map - stopping stamina monitoring');
                            stopStaminaTooltipMonitoring();
                            resetState('navigation');
                            return;
                        }
                        
                        // Check if autoplay session is actually running (not just mode enabled)
                        const boardContext = globalThis.state.board.getSnapshot().context;
                        const isAutoplayMode = boardContext.mode === 'autoplay';
                        const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
                        
                        if (isAutoplayMode && isAutoplaySessionRunning) {
                            // Autoplay session is actually running - just continue monitoring
                            console.log('[Better Tasker] Autoplay session running - continuing stamina monitoring');
                            startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                        } else {
                            // Autoplay session is not running - need to click Start button
                            console.log('[Better Tasker] Autoplay session not running - clicking Start button');
                            
                            // Find and click Start button
                            const startButton = findButtonByText('Start');
                            if (!startButton) {
                                console.log('[Better Tasker] Start button not found after stamina recovery');
                                resetState('navigation');
                                return;
                            }
                            
                            console.log('[Better Tasker] Clicking Start button after stamina recovery...');
                            startButton.click();
                            
                            // Continue monitoring for stamina depletion
                            startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                        }
                    };
                    
                    startStaminaTooltipMonitoring(continuousStaminaMonitoring, staminaCheck.cost); // Pass required stamina
                    
                    return; // Exit - monitoring will handle the rest
                }
                
                // Stamina is sufficient - proceed with Start button
                console.log('[Better Tasker] Stamina sufficient - finding Start button...');
                const startButton = findButtonByText('Start');
                if (!startButton) {
                    console.log('[Better Tasker] Start button not found');
                    return;
                }
                
                console.log('[Better Tasker] Clicking Start button...');
                startButton.click();
                
                // Save the current map ID for tasking validation
                const currentMapId = getCurrentRoomId();
                if (currentMapId) {
                    taskingMapId = currentMapId;
                    console.log(`[Better Tasker] Saved tasking map ID: ${taskingMapId}`);
                } else {
                    console.log('[Better Tasker] Could not save tasking map ID - map validation may not work properly');
                }
                
                // Set task hunting flag to prevent further automation
                taskHuntingOngoing = true;
                // Keep task in progress flag true - task is still active until completed
                // taskInProgress remains true to indicate an active task
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task hunting flag set - automation disabled until task completion');
                
                // Reset failure counter on successful task start
                resetFailureCounter();
                
                // Modify quest button appearance to show tasking state (after Start button click, like Raid Hunter)
                modifyQuestButtonForTasking();
                questButtonModifiedForTasking = true;
                
                // Start quest button validation monitoring for task hunting
                startQuestButtonValidation();
                
                // Start continuous stamina monitoring for depletion during autoplay (recursive)
                const continuousStaminaMonitoring = () => {
                    console.log('[Better Tasker] Stamina recovered - checking autoplay state');
                    
                    // Check if still valid to continue
                    if (!taskHuntingOngoing) {
                        console.log('[Better Tasker] Task no longer active during stamina recovery');
                        stopStaminaTooltipMonitoring();
                        return;
                    }
                    
                    // Check if user is still on correct tasking map
                    if (!isOnCorrectTaskingMap()) {
                        console.log('[Better Tasker] User changed map - stopping stamina monitoring');
                        stopStaminaTooltipMonitoring();
                        return;
                    }
                    
                    // Check if autoplay session is actually running (not just mode enabled)
                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const isAutoplayMode = boardContext.mode === 'autoplay';
                    const isAutoplaySessionRunning = boardContext.isRunning || boardContext.autoplayRunning;
                    
                    if (isAutoplayMode && isAutoplaySessionRunning) {
                        // Autoplay session is actually running - just continue monitoring
                        console.log('[Better Tasker] Autoplay session running - continuing stamina monitoring');
                        startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                    } else {
                        // Autoplay session is not running - need to click Start button
                        console.log('[Better Tasker] Autoplay session not running - clicking Start button');
                        
                        // Find and click Start button
                        const startButton = findButtonByText('Start');
                        if (!startButton) {
                            console.log('[Better Tasker] Start button not found after stamina recovery');
                            resetState('navigation');
                            return;
                        }
                        
                        console.log('[Better Tasker] Clicking Start button after stamina recovery...');
                        startButton.click();
                        
                        // Continue monitoring for stamina depletion
                        startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                    }
                };
                
                startStaminaTooltipMonitoring(continuousStaminaMonitoring);
                
                await sleep(TASK_START_DELAY);
                
                console.log('[Better Tasker] Navigation and setup completed');
                
                return true; // Navigation successful
            } else {
                console.log('[Better Tasker] No room ID found for map name:', mapName);
                console.log('[Better Tasker] Available maps:', globalThis.state?.utils?.ROOM_NAME ? Object.values(globalThis.state.utils.ROOM_NAME) : 'Not available');
            }
        }
        
        // If no suggested map found or no room ID extracted, log and return
        console.log('[Better Tasker] No suggested map found or no room ID available for API navigation');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error navigating to suggested map:', error);
        return false;
    }
}

// Start autoplay
async function startAutoplay() {
    try {
        console.log('[Better Tasker] Looking for autoplay button...');
        
        // Wait for the board to load
        await sleep(500);
        
        // Look for autoplay button
        const autoplayButton = document.querySelector('button[data-full="false"][data-state="closed"]');
        if (autoplayButton && autoplayButton.textContent.includes('Autoplay')) {
            console.log('[Better Tasker] Autoplay button found, starting autoplay...');
            autoplayButton.click();
            await sleep(200);
            console.log('[Better Tasker] Autoplay started');
            
            // Enable Bestiary Automator settings if configured
            enableBestiaryAutomatorSettings();
        } else {
            console.log('[Better Tasker] Autoplay button not found or not ready');
        }
    } catch (error) {
        console.error('[Better Tasker] Error starting autoplay:', error);
    }
}

// Check if autoplay is active and quest log is accessible
function checkIfAutoplayIsActive() {
    try {
        // Look for the autoplay button with the specific pattern that allows quest log access
        const autoplayButton = document.querySelector('button[data-full="false"][data-state="closed"]');
        if (!autoplayButton) return false;
        
        // Check if it has the autoplay text and is disabled (indicating autoplay is running)
        const buttonText = autoplayButton.textContent;
        const isDisabled = autoplayButton.hasAttribute('disabled') || autoplayButton.disabled;
        
        // Check for autoplay text and disabled state
        if (buttonText.includes('Autoplay') && isDisabled) {
            console.log('[Better Tasker] Autoplay button detected as active and quest log accessible');
            return true;
        }
        
        // If we see "Auto" with data-full="true", quest log is not accessible yet
        const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
        if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
            console.log('[Better Tasker] Autoplay button shows "Auto" - quest log not accessible yet');
            return false;
        }
        
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error checking autoplay state:', error);
        return false;
    }
}

// Wait for game to end by continuously checking multiple game state indicators
async function waitForGameToEnd() {
    console.log('[Better Tasker] Starting continuous game state monitoring...');
    
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max wait time (60 * 2 seconds)
    
    while (attempts < maxAttempts) {
        try {
            // Check multiple indicators that game has ended
            const boardContext = globalThis.state.board.getSnapshot().context;
            const gameTimerContext = globalThis.state.gameTimer.getSnapshot().context;
            
            const isGameRunning = boardContext.gameStarted;
            const gameState = gameTimerContext.state; // 'initial', 'victory', 'defeat'
            console.log(`[Better Tasker] Game state check ${attempts + 1}: gameStarted=${isGameRunning}, gameState=${gameState}`);
            
            // Game has ended if any of these conditions are true:
            // 1. board.gameStarted is false
            // 2. gameTimer.state is 'victory' or 'defeat' (not 'initial')
            if (!isGameRunning || (gameState !== 'initial')) {
                console.log(`[Better Tasker] Game ended after ${attempts * 2} seconds - gameStarted: ${isGameRunning}, gameState: ${gameState}`);
                return true;
            }
            
            // If game has been running for more than 30 seconds and is still in initial state,
            // it might be stuck - proceed with task completion anyway
            if (attempts >= 15 && gameState === 'initial' && isGameRunning) {
                console.log(`[Better Tasker] Game stuck in initial state for ${attempts * 2}s - proceeding with task completion`);
                return true;
            }
            
            // Log progress every 10 seconds (every 5 attempts)
            if (attempts % 5 === 0 && attempts > 0) {
                console.log(`[Better Tasker] Still waiting for game to end... (${attempts * 2}s elapsed)`);
            }
            
            await sleep(2000); // Check every 2 seconds
            attempts++;
            
        } catch (error) {
            console.error('[Better Tasker] Error checking game state during wait:', error);
            await sleep(2000);
            attempts++;
        }
    }
    
    console.log('[Better Tasker] Game state monitoring timeout - proceeding anyway...');
    return false;
}


// Click all Close buttons
function clickAllCloseButtons() {
    const closeButtons = document.querySelectorAll('button');
    let clickedCount = 0;
    
    // Use centralized text mapping for close button detection
    const closeTexts = [UI_TEXT.BUTTONS.CLOSE, UI_TEXT.BUTTONS_PT.CLOSE];
    
    for (const button of closeButtons) {
        const buttonText = button.textContent.trim();
        if (closeTexts.includes(buttonText)) {
            console.log(`[Better Tasker] Clicking close button: "${buttonText}"`);
            button.click();
            clickedCount++;
        }
    }
    
    if (clickedCount > 0) {
        console.log(`[Better Tasker] Clicked ${clickedCount} close button(s)`);
    }
    
    return clickedCount > 0;
}

// ============================================================================
// 12. BESTIARY AUTOMATOR INTEGRATION
// ============================================================================

// Find Bestiary Automator instance using multiple access methods
function findBestiaryAutomator() {
    // Method 1: Check if Bestiary Automator is available in global scope
    if (window.bestiaryAutomator && window.bestiaryAutomator.updateConfig) {
        console.log('[Better Tasker] Found Bestiary Automator via global window object');
        return window.bestiaryAutomator;
    }
    // Method 2: Check if it's available in context exports
    else if (typeof context !== 'undefined' && context.exports && context.exports.updateConfig) {
        console.log('[Better Tasker] Found Bestiary Automator via context exports');
        return context.exports;
    }
    // Method 3: Try to find it in the mod loader's context
    else if (window.modLoader && window.modLoader.getModContext) {
        const automatorContext = window.modLoader.getModContext('bestiary-automator');
        if (automatorContext && automatorContext.exports && automatorContext.exports.updateConfig) {
            console.log('[Better Tasker] Found Bestiary Automator via mod loader');
            return automatorContext.exports;
        }
    }
    return null;
}

// Lightweight health check for Bestiary Automator integration
function checkBestiaryAutomatorHealth() {
    try {
        const automator = findBestiaryAutomator();
        if (!automator) {
            return { healthy: false, reason: 'Bestiary Automator not available' };
        }
        
        // Check if automator is responsive
        if (typeof automator.updateConfig !== 'function') {
            return { healthy: false, reason: 'Bestiary Automator not responsive' };
        }
        
        return { healthy: true, reason: 'Bestiary Automator is healthy' };
    } catch (error) {
        return { healthy: false, reason: `Health check failed: ${error.message}` };
    }
}

// Generic function to update Bestiary Automator configuration
function updateBestiaryAutomatorConfig(setting, value, enableRetry = false) {
    try {
        const bestiaryAutomator = findBestiaryAutomator();
        
        if (bestiaryAutomator) {
            console.log(`[Better Tasker] ${value ? 'Enabling' : 'Disabling'} Bestiary Automator ${setting}...`);
            bestiaryAutomator.updateConfig({
                [setting]: value
            });
            console.log(`[Better Tasker] Bestiary Automator ${setting} ${value ? 'enabled' : 'disabled'}`);
            
            // Verification for enable operations
            if (value && enableRetry) {
                setTimeout(() => {
                    if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                        console.log(`[Better Tasker] Verifying ${setting} setting:`, window.bestiaryAutomator.config[setting]);
                    }
                }, 1000);
            }
            
            return true;
        } else {
            console.log(`[Better Tasker] Bestiary Automator not available for ${setting}`);
            
            // Retry logic for enable operations
            if (value && enableRetry) {
                setTimeout(() => {
                    const retryAutomator = findBestiaryAutomator();
                    if (retryAutomator) {
                        console.log(`[Better Tasker] Retrying Bestiary Automator ${setting}...`);
                        retryAutomator.updateConfig({ [setting]: value });
                        console.log(`[Better Tasker] Bestiary Automator ${setting} enabled (retry)`);
                        
                        setTimeout(() => {
                            if (window.bestiaryAutomator && window.bestiaryAutomator.config) {
                                console.log(`[Better Tasker] Verifying ${setting} setting (retry):`, window.bestiaryAutomator.config[setting]);
                            }
                        }, 1000);
                    } else {
                        console.log(`[Better Tasker] Bestiary Automator still not available - you may need to enable ${setting} manually`);
                    }
                }, 2000);
            }
            return false;
        }
    } catch (error) {
        console.error(`[Better Tasker] Error ${value ? 'enabling' : 'disabling'} Bestiary Automator ${setting}:`, error);
        return false;
    }
}

// Generic function to toggle Bestiary Automator settings
function toggleBestiaryAutomatorSetting(setting, value, enableRetry = false) {
    const isEnabling = value === true;
    const controlMethod = isEnabling ? 'requestControl' : 'hasControl';
    
    if (!window.BestiaryAutomatorSettingsManager[controlMethod]('Better Tasker')) {
        const action = isEnabling ? 'control' : 'disable';
        const reason = isEnabling ? 'controlled by another mod' : 'not controlled by Better Tasker';
        console.log(`[Better Tasker] Cannot ${action} Bestiary Automator settings - ${reason}`);
        return false;
    }
    
    const success = updateBestiaryAutomatorConfig(setting, value, enableRetry);
    if (!success && isEnabling) {
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
    } else if (!isEnabling) {
        window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
    }
    return success;
}

// Enable Bestiary Automator's autorefill stamina setting
function enableBestiaryAutomatorStaminaRefill() {
    return toggleBestiaryAutomatorSetting('autoRefillStamina', true, true);
}

// Disable Bestiary Automator's autorefill stamina setting
function disableBestiaryAutomatorStaminaRefill() {
    return toggleBestiaryAutomatorSetting('autoRefillStamina', false);
}

// Enable Bestiary Automator's faster autoplay setting
function enableBestiaryAutomatorFasterAutoplay() {
    return toggleBestiaryAutomatorSetting('fasterAutoplay', true, true);
}

// Post-navigation settings validation
function validateSettingsAfterNavigation() {
    try {
        const settings = loadSettings();
        let validationIssues = [];
        
        // Validate Bestiary Automator settings if enabled
        if (settings.autoRefillStamina) {
            const automator = findBestiaryAutomator();
            if (!automator) {
                validationIssues.push('Bestiary Automator not available for stamina refill');
            }
        }
        
        if (settings.fasterAutoplay) {
            const automator = findBestiaryAutomator();
            if (!automator) {
                validationIssues.push('Bestiary Automator not available for faster autoplay');
            }
        }
        
        // Validate creature filtering settings
        if (settings.allowedCreatures && settings.allowedCreatures.length === 0) {
            validationIssues.push('No creatures allowed for tasking');
        }
        
        // Log validation results and attempt recovery
        if (validationIssues.length > 0) {
            console.warn('[Better Tasker] Settings validation issues:', validationIssues);
            
            // Attempt automatic recovery for Bestiary Automator issues
            if (validationIssues.some(issue => issue.includes('Bestiary Automator'))) {
                console.log('[Better Tasker] Attempting automatic recovery for Bestiary Automator...');
                const healthCheck = checkBestiaryAutomatorHealth();
                if (!healthCheck.healthy) {
                    console.warn('[Better Tasker] Bestiary Automator health check failed:', healthCheck.reason);
                } else {
                    console.log('[Better Tasker] Bestiary Automator health check passed, attempting to re-enable settings...');
                    // Re-enable settings if health check passes
                    if (settings.autoRefillStamina) {
                        enableBestiaryAutomatorStaminaRefill();
                    }
                    if (settings.fasterAutoplay) {
                        enableBestiaryAutomatorFasterAutoplay();
                    }
                }
            }
        } else {
            console.log('[Better Tasker] Settings validation passed');
        }
        
        return validationIssues.length === 0;
    } catch (error) {
        console.error('[Better Tasker] Error during settings validation:', error);
        return false;
    }
}

// Disable Bestiary Automator's faster autoplay setting
function disableBestiaryAutomatorFasterAutoplay() {
    return toggleBestiaryAutomatorSetting('fasterAutoplay', false);
}

// Enable Autoseller's Dragon Plant setting
function enableAutosellerDragonPlant() {
    try {
        // Try to find Autoseller's exported function
        let autoseller = null;
        
        // Method 1: Check window scope
        if (window.autoseller && window.autoseller.enableDragonPlant) {
            autoseller = window.autoseller;
            console.log('[Better Tasker] Found Autoseller via window object');
        }
        // Method 2: Check context exports
        else if (typeof context !== 'undefined' && context.exports && context.exports.enableDragonPlant) {
            autoseller = context.exports;
            console.log('[Better Tasker] Found Autoseller via context exports');
        }
        // Method 3: Try mod loader
        else if (window.modLoader && window.modLoader.getModContext) {
            const autosellerContext = window.modLoader.getModContext('autoseller');
            if (autosellerContext && autosellerContext.exports && autosellerContext.exports.enableDragonPlant) {
                autoseller = autosellerContext.exports;
                console.log('[Better Tasker] Found Autoseller via mod loader');
            }
        }
        
        if (autoseller) {
            console.log('[Better Tasker] Enabling Dragon Plant via Autoseller...');
            autoseller.enableDragonPlant();
            console.log('[Better Tasker] Dragon Plant enabled');
            return true;
        } else {
            console.log('[Better Tasker] Autoseller not available - trying direct approach');
            // Fallback: try to access via global exports
            if (typeof exports !== 'undefined' && exports.enableDragonPlant) {
                exports.enableDragonPlant();
                console.log('[Better Tasker] Dragon Plant enabled via exports');
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error enabling Dragon Plant:', error);
        return false;
    }
}

// Finds button by text content - supports both English and Portuguese
function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define text mappings for different languages using centralized constants
    const textMappings = {
        'Auto-setup': [UI_TEXT.BUTTONS.AUTO_SETUP, UI_TEXT.BUTTONS_PT.AUTO_SETUP],
        'Start': [UI_TEXT.BUTTONS.START, UI_TEXT.BUTTONS_PT.START],
        'Close': [UI_TEXT.BUTTONS.CLOSE, UI_TEXT.BUTTONS_PT.CLOSE],
        'New task': [UI_TEXT.BUTTONS.NEW_TASK, UI_TEXT.BUTTONS_PT.NEW_TASK],
        'Remove': [UI_TEXT.BUTTONS.REMOVE, UI_TEXT.BUTTONS_PT.REMOVE],
        'Remove current task': ['Remove current task', 'Remover tarefa atual'],
        'Remove task': ['Remove task', 'Remover tarefa'],
        'Confirm': [UI_TEXT.BUTTONS.CONFIRM, UI_TEXT.BUTTONS_PT.CONFIRM]
    };
    
    // Get the list of possible texts for the given text key
    const possibleTexts = textMappings[text] || [text];
    
    return buttons.find(button => {
        const buttonText = button.textContent.trim();
        return possibleTexts.includes(buttonText) && isElementVisible(button);
    }) || null;
}

// Finds button by partial text content with language support
function findButtonByPartialText(textKey) {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define text mappings for different languages using centralized constants
    const textMappings = {
        'Remove': [UI_TEXT.BUTTONS.REMOVE, UI_TEXT.BUTTONS_PT.REMOVE]
    };
    
    // Get the list of possible texts for the given text key
    const possibleTexts = textMappings[textKey] || [textKey];
    
    return buttons.find(button => {
        if (!isElementVisible(button)) return false;
        const buttonText = button.textContent.trim();
        return possibleTexts.some(text => buttonText.includes(text));
    }) || null;
}

// Finds confirmation button for task removal
function findConfirmationButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Define confirmation button text mappings using centralized constants
    const confirmationTexts = [
        'Remove current task', 'Remover tarefa atual',
        'Remove task', 'Remover tarefa', 
        UI_TEXT.BUTTONS.CONFIRM, UI_TEXT.BUTTONS_PT.CONFIRM
    ];
    
    return buttons.find(button => {
        if (!isElementVisible(button)) return false;
        const buttonText = button.textContent.trim();
        return confirmationTexts.includes(buttonText);
    }) || null;
}

// Checks element visibility
function isElementVisible(el) {
    if (!el || el.disabled) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Ensures autoplay mode is enabled with coordination
function ensureAutoplayMode() {
    // Check if another mod is controlling autoplay
    if (window.AutoplayManager.isControlledByOther('Better Tasker')) {
        console.log('[Better Tasker] Cannot switch to autoplay - controlled by another mod');
        return false;
    }
    
    return withControl(window.AutoplayManager, 'Better Tasker', () => {
        const boardContext = globalThis.state.board.getSnapshot().context;
        const currentMode = boardContext.mode;
        
        if (currentMode !== 'autoplay') {
            globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });
            console.log('[Better Tasker] Switched to autoplay mode');
            return true;
        }
        return false;
    }, 'switch to autoplay');
}


// Consolidated failsafe function - replaces all duplicated failsafe logic
async function triggerFailsafe(reason) {
    console.log(`[Better Tasker] FAILSAFE TRIGGERED: ${reason} - stopping autoplay immediately!`);
    
    // Stop all automations immediately (includes autoplay, Bestiary Automator, Raid Hunter coordination)
    const automationsStopped = await stopAllAutomationsForTaskCompletion();
    if (!automationsStopped) {
        console.warn('[Better Tasker] Failed to stop automations, continuing with task completion anyway');
    }
    
    // Wait for game to end if running, then complete task
    await waitForGameEndAndCompleteTask();
}


// Wait for game to end and complete task
async function waitForGameEndAndCompleteTask() {
    try {
        // Check if a game is currently running
        const boardContext = globalThis.state.board.getSnapshot().context;
        const isGameRunning = boardContext.gameStarted;
        console.log('[Better Tasker] Game running check after failsafe:', isGameRunning);
        
        if (isGameRunning) {
            console.log('[Better Tasker] Game is running, waiting for game to finish before claiming task...');
            pendingTaskCompletion = true;
            updateExposedState(); // Update exposed state for other mods
            console.log('[Better Tasker] Pending task completion flag set - waiting for game to end');
            
            // Start continuous checking for game end
            await waitForGameToEnd();
            
            // Game has ended, proceed with task completion
            console.log('[Better Tasker] Game ended, proceeding with task completion...');
        } else {
            console.log('[Better Tasker] No game running, proceeding with task completion immediately...');
        }
        
        // Complete task regardless of game state
        resetState('taskComplete');
        await handleTaskReadyCompletion();
        
    } catch (error) {
        console.error('[Better Tasker] Error in waitForGameEndAndCompleteTask:', error);
        // Still try to complete the task even if there was an error
        try {
            resetState('taskComplete');
            await handleTaskReadyCompletion();
        } catch (completionError) {
            console.error('[Better Tasker] Error in task completion after error:', completionError);
            cleanupTaskCompletionFailure('error in waitForGameEndAndCompleteTask');
        }
    }
}

// Stop all automations when task is ready to be claimed
async function stopAllAutomationsForTaskCompletion() {
    try {
        console.log('[Better Tasker] Stopping all automations for task completion...');
        
        // 1. Stop autoplay
        const autoplayStopped = await pauseAutoplay();
        
        // 2. Stop Bestiary Automator settings if we have control
        let bestiaryAutomatorStopped = false;
        if (window.BestiaryAutomatorSettingsManager.hasControl('Better Tasker')) {
            console.log('[Better Tasker] Stopping Bestiary Automator settings for task completion...');
            bestiaryAutomatorStopped = disableBestiaryAutomatorStaminaRefill();
            if (bestiaryAutomatorStopped) {
                bestiaryAutomatorStopped = disableBestiaryAutomatorFasterAutoplay();
            }
        }
        
        // 3. Coordinate with Raid Hunter to pause its automation
        let raidHunterPaused = false;
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Coordinating with Raid Hunter to pause automation for task completion...');
            // Update exposed state to signal task completion is in progress
            updateExposedState();
            // Note: Raid Hunter should detect this through our exposed state and pause its own automation
            raidHunterPaused = true;
        }
        
        console.log('[Better Tasker] Automation stopping results:', {
            autoplayStopped,
            bestiaryAutomatorStopped,
            raidHunterPaused
        });
        
        return autoplayStopped;
    } catch (error) {
        console.error('[Better Tasker] Error stopping automations for task completion:', error);
        return false;
    }
}

// Pause autoplay using game state API with coordination
async function pauseAutoplay() {
    console.log('[Better Tasker] Pausing autoplay using state API...');
    
    // Check if another mod is controlling autoplay
    if (window.AutoplayManager.isControlledByOther('Better Tasker')) {
        console.log('[Better Tasker] Cannot pause autoplay - controlled by another mod');
        return false;
    }
    
    // Request control of autoplay
    if (!window.AutoplayManager.requestControl('Better Tasker')) {
        console.log('[Better Tasker] Cannot pause autoplay - control denied');
        return false;
    }
    
    try {
        // Check if game is actually started and needs pausing
        const boardContext = globalThis.state.board.getSnapshot().context;
        const gameStarted = boardContext.gameStarted;
        const currentMode = boardContext.mode;
        
        console.log(`[Better Tasker] Current state - gameStarted: ${gameStarted}, mode: ${currentMode}`);
        
        if (gameStarted) {
            // Game is running, need to pause it
            console.log('[Better Tasker] Attempting to pause autoplay...');
            
            const paused = await pauseAutoplayWithButton();
            if (paused) {
                // Wait for game state to update (give it up to 3 seconds)
                let verified = false;
                for (let checkAttempt = 0; checkAttempt < 6; checkAttempt++) {
                    await sleep(500);
                    const newBoardContext = globalThis.state.board.getSnapshot().context;
                    if (!newBoardContext.gameStarted) {
                        verified = true;
                        autoplayPausedByTasker = true;
                        console.log(`[Better Tasker] Autoplay paused and verified (took ${(checkAttempt + 1) * 500}ms)`);
                        return true;
                    }
                }
                
                if (!verified) {
                    console.warn('[Better Tasker] Pause button clicked but game still running after 3s - continuing anyway');
                    autoplayPausedByTasker = true;
                    return true; // Don't reload, just continue
                }
            } else {
                console.warn('[Better Tasker] Pause button not found - game may still be running');
                return false;
            }
        } else {
            console.log('[Better Tasker] Game not started - no need to pause');
            return true; // Already paused/not running
        }
    } finally {
        // Release control after operation
        window.AutoplayManager.releaseControl('Better Tasker');
    }
}

// Verify that task completion was successful before resuming automations
async function verifyTaskCompletion() {
    try {
        console.log('[Better Tasker] Verifying task completion...');
        
        // Wait a moment for the game state to update after task completion
        await sleep(1000);
        
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.player) {
            console.log('[Better Tasker] Game State API not available for verification');
            return false;
        }
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        // Check if there's still an active task
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // If task still has gameId and is still ready, it wasn't completed properly
            if (task.gameId && task.ready) {
                console.log('[Better Tasker] Task verification failed - task still active and ready:', {
                    gameId: task.gameId,
                    ready: task.ready,
                    killCount: task.killCount
                });
                return false;
            }
            
            // If task has no gameId, it means it was completed successfully
            if (!task.gameId) {
                console.log('[Better Tasker] Task verification successful - no active task found');
                // Reset task navigation flag to allow future task completions
                taskNavigationCompleted = false;
                console.log('[Better Tasker] Task navigation flag reset - ready for next task');
                return true;
            }
            
            // If task exists but is not ready, it was completed
            if (!task.ready) {
                console.log('[Better Tasker] Task verification successful - task no longer ready');
                // Reset task navigation flag to allow future task completions
                taskNavigationCompleted = false;
                console.log('[Better Tasker] Task navigation flag reset - ready for next task');
                return true;
            }
        } else {
            // No task in quest log means it was completed successfully
            console.log('[Better Tasker] Task verification successful - no task in quest log');
            // Reset task navigation flag to allow future task completions
            taskNavigationCompleted = false;
            console.log('[Better Tasker] Task navigation flag reset - ready for next task');
            return true;
        }
        
        console.log('[Better Tasker] Task verification inconclusive - defaulting to successful');
        // Reset task navigation flag to allow future task completions
        taskNavigationCompleted = false;
        console.log('[Better Tasker] Task navigation flag reset - ready for next task');
        return true;
    } catch (error) {
        console.error('[Better Tasker] Error verifying task completion:', error);
        // Default to successful on error to avoid getting stuck
        return true;
    }
}

// Resume autoplay using game state API with coordination
async function resumeAutoplay() {
    try {
        console.log('[Better Tasker] Resuming autoplay using state API...');
        
        // Only resume if we previously paused it
        if (autoplayPausedByTasker) {
            // Check if we still have control
            if (!window.AutoplayManager.hasControl('Better Tasker')) {
                console.log('[Better Tasker] Cannot resume autoplay - no longer have control');
                autoplayPausedByTasker = false;
                return false;
            }
            
            // Use play button instead of switching to autoplay mode
            const resumed = resumeAutoplayWithButton();
            autoplayPausedByTasker = false;
            if (resumed) {
                console.log('[Better Tasker] Autoplay resumed successfully using play button');
            } else {
                // Fallback to autoplay mode if play button not found
                const wasChanged = ensureAutoplayMode();
                if (wasChanged) {
                    console.log('[Better Tasker] Autoplay resumed using fallback (switched to autoplay mode)');
                } else {
                    console.log('[Better Tasker] Already in autoplay mode - no need to resume');
                }
            }
            return true;
        } else {
            console.log('[Better Tasker] Autoplay was not paused by tasker - no need to resume');
            return true;
        }
    } catch (error) {
        console.error('[Better Tasker] Error resuming autoplay:', error);
        return false;
    }
}

// Open quest log directly without relying on quest blip
async function openQuestLogDirectly() {
    try {
        console.log('[Better Tasker] Opening quest log directly...');
        
        // FIRST: Try to find and click quest blip (most reliable for task completion)
        const questBlipSelectors = [
            '#header-slot img[src*="quest-blip.png"]',
            '#header-slot img[src*="/assets/icons/quest-blip.png"]',
            '#header-slot img[alt="Quests"][src*="quest-blip"]',
            '#header-slot img[alt="Tasking"][src*="quest-blip"]',
            'img[src*="quest-blip.png"]',
            'img[src*="/assets/icons/quest-blip.png"]'
        ];
        
        let questBlip = null;
        for (const selector of questBlipSelectors) {
            questBlip = document.querySelector(selector);
            if (questBlip && questBlip.offsetParent !== null) {
                console.log(`[Better Tasker] Found quest blip with selector: ${selector}`);
                questBlip.click();
                await sleep(300);
                
                // Validate that quest log actually opened
                const questLogContainer = findQuestLogContainer();
                if (questLogContainer) {
                    console.log('[Better Tasker] Quest log opened via quest blip and validated');
                    return true;
                } else {
                    console.log('[Better Tasker] Quest blip clicked but quest log did not appear');
                }
                break;
            }
        }
        
        // SECOND: Try to find quest log button or icon (fallback)
        const questSelectors = [
            'button[aria-label*="quest"]',
            'button[title*="quest"]',
            '.quest-icon',
            'img[src*="quest.png"]',
            'button:has(svg[data-lucide="book"])',
            'button:has(svg[data-lucide="scroll"])'
        ];
        
        let questButton = null;
        for (const selector of questSelectors) {
            questButton = document.querySelector(selector);
            if (questButton) {
                console.log(`[Better Tasker] Found quest button with selector: ${selector}`);
                break;
            }
        }
        
        if (questButton) {
            questButton.click();
            await sleep(300);
            
            // Validate that quest log actually opened
            const questLogContainer = document.querySelector('[class*="quest"], [class*="modal"], [class*="dialog"]');
            if (questLogContainer) {
                console.log('[Better Tasker] Quest log opened directly and validated');
                return true;
            } else {
                console.log('[Better Tasker] Quest log button clicked but UI did not appear');
                return false;
            }
        } else {
            console.log('[Better Tasker] Could not find quest log button, trying fallback...');
            
            // Fallback: try to find any button that might open quest log
            const allButtons = document.querySelectorAll('button');
            const questButtonFallback = Array.from(allButtons).find(btn => 
                btn.textContent.toLowerCase().includes('quest') ||
                btn.getAttribute('aria-label')?.toLowerCase().includes('quest') ||
                btn.getAttribute('title')?.toLowerCase().includes('quest')
            );
            
            if (questButtonFallback) {
                questButtonFallback.click();
                await sleep(300);
                
                // Validate that quest log actually opened
                const questLogContainer = document.querySelector('[class*="quest"], [class*="modal"], [class*="dialog"]');
                if (questLogContainer) {
                    console.log('[Better Tasker] Quest log opened via fallback and validated');
                    return true;
                } else {
                    console.log('[Better Tasker] Quest log fallback clicked but UI did not appear');
                    return false;
                }
            }
            
            console.log('[Better Tasker] Could not find quest log button with any method');
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log directly:', error);
        return false;
    }
}

// Helper: Find Finish button using mutation observer and polling
async function findFinishButton(pollInterval = 1000, maxAttempts = 3, useFallbackSelectors = false) {
    const finishSelectors = [
        'button:has(svg.lucide-check)',
        'button:has(svg.lucide-check-circle)'
    ];
    
    let finishButton = null;
    let attempts = 0;
    
    // Use mutation observer to watch for Finish button changes
    const finishButtonObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                const target = mutation.target;
                if (target.querySelector('svg.lucide-check')) {
                    // Check if button is now enabled
                    if (!target.hasAttribute('disabled') && !target.disabled) {
                        finishButton = target;
                        console.log('[Better Tasker] Finish button enabled via mutation observer');
                    }
                }
            }
        }
    });
    
    // Start observing the document body for button changes
    finishButtonObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled']
    });
    
    // Poll for Finish button
    while (!finishButton && attempts < maxAttempts) {
        await sleep(pollInterval);
        attempts++;
        
        // Search for buttons with SVG check icon (language-independent)
        // Exclude checkboxes and other non-Finish buttons by checking button context
        const allButtons = document.querySelectorAll('button');
        finishButton = Array.from(allButtons).find(btn => {
            // Must have check icon
            if (!btn.querySelector('svg.lucide-check') || btn.hasAttribute('disabled') || btn.disabled) {
                return false;
            }
            
            // Exclude checkboxes and input elements
            if (btn.type === 'checkbox' || btn.tagName === 'INPUT') {
                return false;
            }
            
            // Exclude buttons that are clearly not Finish buttons (like settings checkboxes)
            const buttonText = btn.textContent.trim().toLowerCase();
            if (buttonText.includes('enable') || buttonText.includes('disable') || 
                buttonText.includes('dragon') || buttonText.includes('plant') ||
                buttonText.includes('autoplay') || buttonText.includes('stamina')) {
                return false;
            }
            
            // Prefer buttons that are in quest log context
            const questLogContainer = findQuestLogContainer();
            if (questLogContainer && questLogContainer.contains(btn)) {
                return true;
            }
            
            // If not in quest log, check if it's a proper Finish button by looking for task-related context
            const parentSection = btn.closest('.frame-1.surface-regular');
            if (parentSection) {
                const sectionTitle = parentSection.querySelector('p.text-whiteHighlight');
                if (sectionTitle && sectionTitle.textContent === 'Paw and Fur Society') {
                    return true;
                }
            }
            
            return false;
        });
        
        // If not found and fallback selectors enabled, try CSS selectors
        if (!finishButton && useFallbackSelectors) {
            for (const selector of finishSelectors) {
                try {
                    const buttons = document.querySelectorAll(selector);
                    finishButton = Array.from(buttons).find(btn => {
                        // Must have check icon
                        if (!btn.querySelector('svg.lucide-check') || btn.hasAttribute('disabled') || btn.disabled) {
                            return false;
                        }
                        
                        // Exclude checkboxes and input elements
                        if (btn.type === 'checkbox' || btn.tagName === 'INPUT') {
                            return false;
                        }
                        
                        // Exclude buttons that are clearly not Finish buttons (like settings checkboxes)
                        const buttonText = btn.textContent.trim().toLowerCase();
                        if (buttonText.includes('enable') || buttonText.includes('disable') || 
                            buttonText.includes('dragon') || buttonText.includes('plant') ||
                            buttonText.includes('autoplay') || buttonText.includes('stamina')) {
                            return false;
                        }
                        
                        return true;
                    });
                    
                    if (finishButton) break;
                } catch (error) {
                    // Skip invalid selectors
                    console.log(`[Better Tasker] Skipping invalid selector: ${selector}`);
                }
            }
        }
        
        if (finishButton) {
            console.log('[Better Tasker] Finish button found and ready, attempts:', attempts);
            break;
        }
        
        if (attempts % 2 === 0 && pollInterval >= 1000) { // Log every 2 seconds for slow polling
            console.log(`[Better Tasker] Still looking for Finish button... (${attempts}s)`);
        }
    }
    
    // Stop observing
    finishButtonObserver.disconnect();
    
    return finishButton;
}

// Helper: Click Finish button and verify task completion
async function clickFinishAndVerify(finishButton) {
    console.log('[Better Tasker] Clicking Finish button...');
    finishButton.click();
    await sleep(200);
    console.log('[Better Tasker] Finish button clicked');
    
    // Verify task completion
    await sleep(1000);
    const taskCompleted = await verifyTaskCompletion();
    if (taskCompleted) {
        console.log('[Better Tasker] Task completion verified successfully');
        resetFailureCounter(); // Success - reset failure counter
        
        if (!isSafeToReload()) return false;
        
        // Check if Better UI has disabled auto-reload
        if (window.betterUIConfig?.disableAutoReload) {
            console.log('[Better Tasker] Auto-reload disabled by Better UI - skipping page refresh');
            // Clear flags manually since we're not reloading
            taskNavigationCompleted = false;
            return true;
        }
        
        // Reload page to refresh DOM and cache (no need to clear flags - reload handles it)
        console.log('[Better Tasker] Reloading page for fresh state...');
        location.reload();
        return true;
    } else {
        console.log('[Better Tasker] Task completion verification failed');
        // Clear flags before cleanup on failure
        taskOperationInProgress = false;
        updateExposedState();
        cleanupTaskCompletionFailure('task completion verification failed');
        return false;
    }
}

// Find and click Finish button with improved detection
async function findAndClickFinishButton() {
    try {
        console.log('[Better Tasker] Looking for Finish button...');
        
        // Wait for quest log to load
        await sleep(1200);
        
        // Find Finish button (100ms fast polling, 5 attempts)
        const finishButton = await findFinishButton(100, 5, false);
        
        // Click Finish button and verify completion
        if (finishButton) {
            return await clickFinishAndVerify(finishButton);
        } else {
            console.log('[Better Tasker] Finish button never became ready');
            // Clear task operation in progress flag since no finish button appeared
            taskOperationInProgress = false;
            updateExposedState();
            console.log('[Better Tasker] Task completion and progress flags cleared - no finish button');
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            updateToggleButton();
            
            return false;
        }
    } catch (error) {
        console.error('[Better Tasker] Error finding and clicking Finish button:', error);
        
        // Clear flags on error
        taskOperationInProgress = false;
        updateExposedState();
        
        return false;
    }
}

// Handle task completion when task.ready = true (API state)
async function handleTaskReadyCompletion() {
    try {
        console.log('[Better Tasker] Handling task ready completion via API state...');
        
        // Set task operation in progress flag to prevent duplicate operations
        taskOperationInProgress = true;
        updateExposedState(); // Update exposed state for other mods
        console.log('[Better Tasker] Task operation in progress flag set - preventing duplicate operations');
        
        // Safety timeout to reset the flag if operation gets stuck (30 seconds)
        const safetyTimeout = setTimeout(() => {
            if (taskOperationInProgress) {
                console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
                taskOperationInProgress = false;
                updateExposedState();
            }
        }, 30000);
        safetyTimeouts.push(safetyTimeout);
        
        // Start quest button validation monitoring
        startQuestButtonValidation();
        
        // Clear any modals with ESC key presses
        console.log('[Better Tasker] Clearing any modals with ESC key presses...');
        await clearModalsWithEsc(3);
        
        // Also try clicking any Close buttons
        clickAllCloseButtons();
        
        // Wait for modals to clear
        await sleep(200);
        console.log('[Better Tasker] Modal clearing completed');
        
        // Check if a game is actually running before waiting for it to finish
        const boardContext = globalThis.state.board.getSnapshot().context;
        const gameTimerContext = globalThis.state.gameTimer.getSnapshot().context;
        const isGameStarted = boardContext.gameStarted;
        const gameState = gameTimerContext.state; // 'initial', 'victory', 'defeat'
        const isGameRunning = isGameStarted && gameState === 'initial';
        console.log('[Better Tasker] Game running check:', isGameRunning, '(gameStarted:', isGameStarted, ', gameState:', gameState, ')');
        
        if (isGameRunning) {
            console.log('[Better Tasker] Game is running, waiting for game to finish before completing task...');
            // NOTE: Quest log opening and Finish button clicking will be handled 
            // in the game end event handler, not here, to avoid opening quest log
            // while game is still running
        } else {
            console.log('[Better Tasker] No game running, proceeding with task completion...');
            // No game running, proceed with quest log opening
            await handlePostGameTaskCompletion();
        }
        
    } catch (error) {
        console.error('[Better Tasker] Error in handleTaskReadyCompletion:', error);
        cleanupTaskCompletionFailure('error in handleTaskReadyCompletion');
    }
}

// Open quest log with retry mechanism - tries 3 times with ESC fallback
async function openQuestLogWithRetry() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`[Better Tasker] Quest log opening attempt ${attempt}/3...`);
        
        // Try to open quest log directly
        const questLogOpened = await openQuestLogDirectly();
        
        if (questLogOpened) {
            console.log(`[Better Tasker] Quest log opened successfully on attempt ${attempt}`);
            resetFailureCounter(); // Success - reset failure counter
            return true;
        }
        
        // If not the last attempt, try ESC key and retry
        if (attempt < 3) {
            console.log(`[Better Tasker] Quest log opening failed, trying ESC key and retrying...`);
            await clearModalsWithEsc(1);
            await sleep(200); // Wait for any modals to close
        }
    }
    
    console.log('[Better Tasker] All quest log opening attempts failed');
    
    // Track this failure - will trigger refresh after 3 consecutive failures
    const refreshScheduled = trackFailureAndCheckRefresh('quest_log_opening_failed');
    if (refreshScheduled) {
        console.warn('[Better Tasker] Page refresh scheduled due to repeated quest log opening failures');
    }
    
    return false;
}

// Handle quest log opening and button clicking AFTER game finishes
async function handlePostGameTaskCompletion() {
    try {
        console.log('[Better Tasker] Handling post-game task completion...');
        
        // Wait for game to finish completely
        console.log('[Better Tasker] Waiting for game to finish...');
        await sleep(1000); // Wait for game end animations and UI to settle
        
        
        // Check current task state to determine what to do
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.ready) {
            // Task is ready - open quest log and look for Finish button
            console.log('[Better Tasker] Task is ready, opening quest log for Finish button...');
            
            // Try to open quest log with retry mechanism
            const questLogOpened = await openQuestLogWithRetry();
            
            if (questLogOpened) {
                // Look for Finish button
                await findAndClickFinishButton();
            } else {
                console.log('[Better Tasker] Failed to open quest log after 3 attempts');
            }
        } else {
            // No active task or not ready - check if new task is available
            console.log('[Better Tasker] No ready task, checking if new task is available...');
            
            if (isQuestBlipAvailable()) {
                console.log('[Better Tasker] New task available - opening quest log to accept task');
                await openQuestLogAndAcceptTask();
            } else {
                console.log('[Better Tasker] No new task available yet (cooldown active)');
                cleanupTaskCompletionFailure('no new task available');
            }
        }
        
        // Clear task operation flag on successful completion
        taskOperationInProgress = false;
        updateExposedState();
        console.log('[Better Tasker] Task operation completed successfully');
        
    } catch (error) {
        console.error('[Better Tasker] Error in handlePostGameTaskCompletion:', error);
        cleanupTaskCompletionFailure('error in handlePostGameTaskCompletion');
    }
}

// Handle task finishing - main function for completing tasks
async function handleTaskFinishing() {
    if (taskerState !== TASKER_STATES.ENABLED) {
        console.log('[Better Tasker] Tasker not in enabled state, skipping task completion');
        return;
    }
    
    // EARLY CHECK: If no active task and cooldown is active, let scheduler handle it
    try {
        const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
        const task = playerContext?.questLog?.task;
        
        // If no active task (no gameId) and cooldown is active, skip expensive checks
        if (task && !task.gameId && task.resetAt && task.resetAt > Date.now()) {
            // Cooldown is active, scheduler will handle waking up
            return;
        }
    } catch (error) {
        // If check fails, continue with normal flow
    }
    
    // Check if new task is available (based on resetAt timestamp)
    const isQuestBlipReady = isQuestBlipAvailable();
    
    // If task hunting is ongoing, check if task is ready to complete
    if (taskHuntingOngoing) {
        // Check if we have an active task that's ready
        const playerContext = globalThis.state.player.getSnapshot().context;
        const task = playerContext?.questLog?.task;
        
        if (task && task.gameId && task.ready) {
            console.log('[Better Tasker] Task hunting complete - task is ready, proceeding with completion');
            // Don't return - proceed with task completion
        } else {
            console.log('[Better Tasker] Task hunting ongoing, task not ready yet - skipping task completion');
            return;
        }
    }
    
    // Don't run task finishing if a task operation is already in progress
    if (taskOperationInProgress) {
        console.log('[Better Tasker] Task operation already in progress, skipping quest log check');
        return;
    }
    
    // Don't run task finishing if pending task completion is already set
    if (pendingTaskCompletion) {
        console.log('[Better Tasker] Pending task completion already set, skipping quest log check');
        return;
    }
    
    // Check if task navigation has already been completed for this session
    if (taskNavigationCompleted) {
        console.log('[Better Tasker] Task navigation already completed, skipping quest log check');
        return;
    }
    
    // Load settings to check if autocomplete is enabled
    const settings = loadSettings();
    if (!settings.autoCompleteTasks) {
        console.log('[Better Tasker] Autocomplete tasks disabled, skipping');
        return;
    }
    
    // Check if current task should be removed due to creature filtering
    const taskRemoved = await removeCurrentTaskIfNotAllowed();
    if (taskRemoved) {
        console.log('[Better Tasker] Task removed due to creature filtering, ending task finishing');
        return;
    }
    
    try {
        // Check if Game State API is available
        if (!globalThis.state || !globalThis.state.player) {
            console.log('[Better Tasker] Game State API not available');
            return;
        }
        
        const playerContext = globalThis.state.player.getSnapshot().context;
        
        // Check if there's a hunting task that's ready
        if (playerContext.questLog && playerContext.questLog.task) {
            const task = playerContext.questLog.task;
            
            // Check if there's an active task by checking for gameId
            if (!task.gameId) {
                console.log('[Better Tasker] No active task (no gameId), checking if new task is available...');
                
                if (isQuestBlipReady) {
                    console.log('[Better Tasker] New task available - opening quest log to start task...');
                    // Continue with quest log opening logic below
                } else {
                    console.log('[Better Tasker] No new task available yet (cooldown active) - letting scheduler handle it');
                    return;
                }
            } else {
                console.log('[Better Tasker] Active task found:', {
                    gameId: task.gameId,
                    killCount: task.killCount,
                    ready: task.ready,
                    points: task.points
                });
                
                // If we have an active task (gameId exists), we should proceed to check quest log
                // The task might need to be activated even if killCount is 0
                console.log('[Better Tasker] Active task detected, proceeding to quest log check...');
                
                // Apply task start delay if configured (only for active tasks)
                const taskStartDelay = settings.taskStartDelay || DEFAULT_TASK_START_DELAY;
                
                if (taskStartDelay > 0) {
                    console.log(`[Better Tasker] Applying task start delay: ${taskStartDelay} seconds`);
                    
                    // Wait for the specified delay before proceeding
                    await new Promise(resolve => setTimeout(resolve, taskStartDelay * 1000));
                    
                    // Check if Board Analyzer started during delay
                    if (isBoardAnalyzerActive()) {
                        console.log('[Better Tasker] Board Analyzer started during task start delay - aborting task operation');
                        return;
                    }
                    
                    // Check if tasker is still enabled after delay
                    if (taskerState !== TASKER_STATES.ENABLED) {
                        console.log('[Better Tasker] Tasker disabled during task start delay');
                        return;
                    }
                    
                    console.log('[Better Tasker] Task start delay completed, proceeding...');
                }
            }
            
            // Quest blip already checked at the beginning of the function
            
            // Check if task is ready OR if autoplay is active
            const isTaskReady = task.gameId ? task.ready : false; // Only check task.ready if there's an active task
            let isAutoplayActive = checkIfAutoplayIsActive();
            
            // If autoplay shows "Auto" state, wait for it to transition to "Autoplay" state
            if (!isTaskReady && !isAutoplayActive) {
                const autoButton = document.querySelector('button[data-full="true"][data-state="closed"]');
                if (autoButton && autoButton.textContent.includes('Auto') && autoButton.hasAttribute('disabled')) {
                    console.log('[Better Tasker] Waiting for autoplay button to transition from "Auto" to "Autoplay" state...');
                    
                    // Wait up to 30 seconds for the transition
                    let waitAttempts = 0;
                    const maxWaitAttempts = 300; // 30 seconds with 100ms intervals
                    
                    while (!isAutoplayActive && waitAttempts < maxWaitAttempts) {
                        await sleep(100);
                        waitAttempts++;
                        isAutoplayActive = checkIfAutoplayIsActive();
                        
                        if (waitAttempts % 100 === 0) { // Log every 10 seconds
                            console.log(`[Better Tasker] Still waiting for autoplay transition... (${waitAttempts / 10}s)`);
                        }
                    }
                    
                    if (isAutoplayActive) {
                        console.log('[Better Tasker] Autoplay button transitioned to accessible state');
                    } else {
                        console.log('[Better Tasker] Autoplay button never transitioned, skipping quest log check');
                        return;
                    }
                }
            }
            
            // Only attempt quest log access when necessary
            if (isTaskReady) {
                console.log('[Better Tasker] Task is ready - proceeding with completion');
                await triggerFailsafe('Task is ready');
                return;
                
            } else if (isQuestBlipReady) {
                console.log('[Better Tasker] New task available - opening quest log to start task...');
                // New task availability is only for starting new tasks, not completing existing ones
                
            } else if (task.gameId && !task.ready) {
                // Active task that's not ready yet - check if we need to navigate to the task map
                if (!taskNavigationCompleted) {
                    console.log('[Better Tasker] Active task in progress (not ready) - checking if already on correct map...');
                    
                    // First check if we're already on the correct map
                    const currentRoomId = getCurrentRoomId();
                    if (currentRoomId && taskingMapId && currentRoomId === taskingMapId) {
                        console.log(`[Better Tasker] Already on correct task map (${currentRoomId}) - skipping navigation`);
                        taskNavigationCompleted = true;
                        updateExposedState();
                        return;
                    }
                    
                    // If we don't have a taskingMapId, try to get it from quest log
                    if (!taskingMapId) {
                        console.log(`[Better Tasker] No tasking map ID stored (current: ${currentRoomId}) - opening quest log to get suggested map information...`);
                        const navigationResult = await navigateToSuggestedMapAndStartAutoplay();
                        if (navigationResult) {
                            console.log('[Better Tasker] Navigation successful - tasking map ID should now be set');
                        } else {
                            console.log('[Better Tasker] Navigation failed - will retry on next check');
                        }
                        return;
                    } else {
                        console.log(`[Better Tasker] Not on correct map (current: ${currentRoomId}, expected: ${taskingMapId}) - opening quest log to get suggested map information...`);
                        const navigationResult = await navigateToSuggestedMapAndStartAutoplay();
                        if (navigationResult) {
                            console.log('[Better Tasker] Navigation successful');
                        } else {
                            console.log('[Better Tasker] Navigation failed - will retry on next check');
                        }
                        return;
                    }
                } else {
                    console.log('[Better Tasker] Active task in progress (not ready) - already navigated, monitoring kill progress only');
                    return;
                }
                
            } else if (isAutoplayActive) {
                console.log('[Better Tasker] Autoplay is active and quest log accessible, checking...');
            } else {
                // No active task and no new task available
                const now = Date.now();
                const NO_TASK_CHECK_DELAY = 60000; // 1 minute in milliseconds
                
                if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                    // Still within the delay period, skip this check
                    return;
                }
                
                // Update the last check time
                lastNoTaskCheck = now;
                console.log('[Better Tasker] No quest blip found and no active task - waiting 1 minute before next check');
                return;
            }
            
            // 1. Open quest log for other cases (autoplay active, etc.)
            console.log('[Better Tasker] Opening quest log for general case...');
            
            if (isQuestBlipReady) {
                // Set task completion in progress flag to prevent duplicate operations
                taskCompletionInProgress = true;
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task completion in progress flag set - preventing duplicate operations');
                
                // Set task in progress flag to prevent duplicate quest log operations
                taskInProgress = true;
                console.log('[Better Tasker] Task in progress flag set - preventing duplicate quest log operations');
                
                // Start quest button validation monitoring
                startQuestButtonValidation();
                // Clear any modals with ESC key presses
                console.log('[Better Tasker] Clearing any modals with ESC key presses...');
                await clearModalsWithEsc(3);
                
                // Also try clicking any Close buttons
                clickAllCloseButtons();
                
                // Wait for modals to clear
                await sleep(200);
                console.log('[Better Tasker] Modal clearing completed');
                
                // Find and click the quest blip
                const questBlip = document.querySelector('img[src*="quest-blip.png"]');
                if (questBlip) {
                    questBlip.click();
                } else {
                    console.log('[Better Tasker] Quest blip not found when trying to click');
                    return;
                }
                await sleep(200);
                console.log('[Better Tasker] Quest log opened via quest blip');
                
                // Wait for quest log to fully load
                await sleep(300);
                
                // 2. Look for and click "New Task" button
                console.log('[Better Tasker] Looking for New Task button...');
                let newTaskButton = document.querySelector('button:has(svg.lucide-plus)');
                if (!newTaskButton) {
                    // Use localization system to find New Task button
                    newTaskButton = findButtonByText('New task');
                }
                
                if (newTaskButton) {
                    console.log('[Better Tasker] New Task button found, clicking...');
                    // Set task operation in progress flag when actually accepting a new task
                    taskOperationInProgress = true;
                    updateExposedState();
                    console.log('[Better Tasker] Task operation in progress flag set - accepting new task');
                    
                    // Safety timeout to reset the flag if operation gets stuck (30 seconds)
                    const safetyTimeout = setTimeout(() => {
                        if (taskOperationInProgress) {
                            console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
                            taskOperationInProgress = false;
                            updateExposedState();
                        }
                    }, 30000);
                    safetyTimeouts.push(safetyTimeout);
                    
                    newTaskButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] New Task button clicked');
                    
                    // Wait for task selection to load
                    await sleep(500);
                    
                    // Check if the task creature is allowed before proceeding
                    console.log('[Better Tasker] Checking creature filtering in handleTaskFinishing...');
                    const creatureName = extractCreatureFromTask();
                    console.log('[Better Tasker] Extracted creature name:', creatureName);
                    if (creatureName && !isCreatureAllowed(creatureName)) {
                        console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                        
                        // Remove the task directly while quest log is open
                        console.log('[Better Tasker] Removing rejected task directly from quest log...');
                        const taskRemoved = await removeTaskDirectlyFromQuestLog();
                        if (taskRemoved) {
                            console.log('[Better Tasker] Rejected task successfully removed from game');
                        } else {
                            console.log('[Better Tasker] Failed to remove rejected task from game');
                        }
                        
                        // Clear task operation in progress flag and return early
                        taskOperationInProgress = false;
                        updateExposedState();
                        return;
                    }
                    
                    console.log('[Better Tasker] Task creature is allowed, proceeding with navigation...');
                    
                    // 3. Navigate to suggested map and start autoplay
                    await navigateToSuggestedMapAndStartAutoplay();
                } else {
                    console.log('[Better Tasker] New Task button not found, checking for suggested map...');
                    
                    // Try to navigate to suggested map using API (will validate Paw and Fur Society section internally)
                    await navigateToSuggestedMapAndStartAutoplay();
                }
                
                // 4. Find Finish button (100ms fast polling, 5 attempts, no fallback selectors)
                const finishButton = await findFinishButton(100, 5, false);
                
                // 5. Click Finish and verify completion
                if (finishButton) {
                    await clickFinishAndVerify(finishButton);
                } else {
                    // If we were checking during autoplay and no finish button appeared, just close the quest log
                    if (isAutoplayActive && !isTaskReady) {
                        console.log('[Better Tasker] No finish button found during autoplay, closing quest log');
                        clickAllCloseButtons();
                // Clear task operation in progress flag since we're closing the quest log
                taskOperationInProgress = false;
                updateExposedState(); // Update exposed state for other mods
                console.log('[Better Tasker] Task completion and progress flags cleared - quest log closed');
                
                // Stop quest button validation and restore appearance
                stopQuestButtonValidation();
                restoreQuestButtonAppearance();
                
                // Restore normal button state
                updateToggleButton();
                    } else {
                        console.log('[Better Tasker] Finish button never became ready');
                        // Clear task operation in progress flag since no finish button appeared
                        taskOperationInProgress = false;
                        updateExposedState();
                        console.log('[Better Tasker] Task completion and progress flags cleared - no finish button');
                        
                        // Stop quest button validation and restore appearance
                        stopQuestButtonValidation();
                        restoreQuestButtonAppearance();
                        
                        // Restore normal button state
                        updateToggleButton();
                    }
                }
            } else {
                // Fallback: Try to open quest log using "Quests" button for active tasks
                console.log('[Better Tasker] No quest blip found, trying Quests button fallback...');
                const questsButton = document.querySelector('button img[src*="quest.png"]');
                if (questsButton) {
                    const questButton = questsButton.closest('button');
                    if (questButton) {
                        console.log('[Better Tasker] Found Quests button, opening quest log...');
                        
                        // Set task operation in progress flag
                        taskOperationInProgress = true;
                        updateExposedState();
                        console.log('[Better Tasker] Task operation in progress flag set - preventing duplicate operations');
                        
                        // Safety timeout to reset the flag if operation gets stuck (30 seconds)
                        const safetyTimeout = setTimeout(() => {
                            if (taskOperationInProgress) {
                                console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
                                taskOperationInProgress = false;
                                updateExposedState();
                            }
                        }, 30000);
                        safetyTimeouts.push(safetyTimeout);
                        
                        // Start quest button validation monitoring
                        startQuestButtonValidation();
                        
                        // Clear any modals with ESC key presses
                        console.log('[Better Tasker] Clearing any modals with ESC key presses...');
                        await clearModalsWithEsc(3);
                        
                        // Also try clicking any Close buttons
                        clickAllCloseButtons();
                        
                        // Wait for modals to clear
                        await sleep(200);
                        console.log('[Better Tasker] Modal clearing completed');
                        
                        questButton.click();
                        await sleep(200);
                        console.log('[Better Tasker] Quest log opened via Quests button');
                        
                        // Wait for quest log to fully load
                        await sleep(300);
                        
                        // 1. Find Paw and Fur Society section first (section-first approach)
                        console.log('[Better Tasker] Using section-first approach - finding Paw and Fur Society section...');
                        const pawAndFurSection = findPawAndFurSection();
                        if (!pawAndFurSection) {
                            console.log('[Better Tasker] Paw and Fur Society section not found');
                            taskOperationInProgress = false;
                            updateExposedState();
                            return;
                        }
                        
                        // 2. Extract & validate creature from that specific section
                        console.log('[Better Tasker] Extracting creature from Paw and Fur Society section...');
                        const creatureName = extractCreatureFromSection(pawAndFurSection);
                        console.log('[Better Tasker] Extracted creature name:', creatureName);
                        if (!creatureName || !isCreatureAllowed(creatureName)) {
                            console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                            
                            // Remove the task directly while quest log is open
                            console.log('[Better Tasker] Removing rejected task directly from quest log...');
                            const taskRemoved = await removeTaskDirectlyFromQuestLog();
                            if (taskRemoved) {
                                console.log('[Better Tasker] Rejected task successfully removed from game');
                            } else {
                                console.log('[Better Tasker] Failed to remove rejected task from game');
                            }
                            
                            // Clear flags and return
                            taskOperationInProgress = false;
                            updateExposedState();
                            return;
                        }
                        
                        // 3. Extract suggested map from that same section
                        console.log('[Better Tasker] Extracting suggested map from Paw and Fur Society section...');
                        const suggestedMapElement = extractSuggestedMapFromSection(pawAndFurSection);
                        
                        if (suggestedMapElement) {
                            console.log('[Better Tasker] Suggested map found, navigating...');
                            await navigateToSuggestedMapAndStartAutoplay(suggestedMapElement);
                        } else {
                            console.log('[Better Tasker] No suggested map found in Paw and Fur Society section');
                        }
                        
                        return; // Successfully opened quest log, exit early
                    }
                }
                
                // Check if we should wait before re-checking (1 minute delay)
                const now = Date.now();
                const NO_TASK_CHECK_DELAY = 60000; // 1 minute in milliseconds
                
                if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                    // Still within the delay period, skip this check
                    return;
                }
                
                // Update the last check time
                lastNoTaskCheck = now;
                console.log('[Better Tasker] Quest blip not found and Quests button fallback failed - waiting 1 minute before next check');
                // Clear task operation in progress flag since no quest blip was found
                taskOperationInProgress = false;
                updateExposedState();
                console.log('[Better Tasker] Task completion and progress flags cleared - no quest blip');
                
                // Stop quest button validation and restore appearance
                stopQuestButtonValidation();
                restoreQuestButtonAppearance();
                
                // Restore normal button state
                updateToggleButton();
            }
        } else {
            // Check if we should wait before re-checking (1 minute delay)
            const now = Date.now();
            const NO_TASK_CHECK_DELAY = 60000; // 1 minute in milliseconds
            
            if (now - lastNoTaskCheck < NO_TASK_CHECK_DELAY) {
                // Still within the delay period, skip this check
                return;
            }
            
            // Update the last check time
            lastNoTaskCheck = now;
            console.log('[Better Tasker] No quest log or task found - waiting 1 minute before next check');
            // Clear task operation in progress flag since no quest log or task was found
            taskOperationInProgress = false;
            updateExposedState();
            console.log('[Better Tasker] Task completion and progress flags cleared - no quest log or task');
            
            // Stop quest button validation and restore appearance
            stopQuestButtonValidation();
            restoreQuestButtonAppearance();
            
            // Restore normal button state
            updateToggleButton();
        }
    } catch (error) {
        console.error('[Better Tasker] Error handling task finishing:', error);
        cleanupTaskCompletionFailure('error handling task finishing');
    }
}

// ============================================================================
// 13. AUTOMATION LOOP
// ============================================================================

// Add debouncing for game state events
const GAME_STATE_DEBOUNCE_MS = 1000; // 1 second debounce

// Subscribe to board game state changes
function subscribeToGameState() {
    try {
        // Subscribe to board state changes for new game detection
        if (globalThis.state && globalThis.state.board) {
            // Consolidated new game handler with debouncing
            const handleNewGame = async (event) => {
                // Skip during Board Analyzer runs
                if (isBoardAnalyzerActive()) {
                    return;
                }
                
                const now = Date.now();
                if (now - lastGameStateChange < GAME_STATE_DEBOUNCE_MS) {
                    console.log('[Better Tasker] Ignoring rapid new game event (debounced)');
                    return;
                }
                lastGameStateChange = now;
                
                // Skip session reset during raids to avoid quest button control conflicts
                // Use cached flag for reliability during game transitions
                if (isRaidHunterActive || isRaidHunterRaiding()) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - skipping session reset to avoid control conflicts');
                    return;
                }
                
                console.log('[Better Tasker] New game detected via game state API, resetting session flags');
                console.log('[Better Tasker] New game event details:', event);
                resetState('session');
                // Don't reset taskNavigationCompleted - it should persist until user manually stops automation
                
                // Log current task status when new game starts
                try {
                    if (globalThis.state?.player) {
                        const playerContext = globalThis.state.player.getSnapshot().context;
                        const task = playerContext?.questLog?.task;
                        
                        if (task && task.killCount !== undefined) {
                            console.log(`[Better Tasker] Progress: ${task.killCount} creatures killed`);
                            
                            // If 60+ creatures killed, assume task is finished (max quest requirement)
                            if (task.killCount >= 60) {
                                await triggerFailsafe('60+ creatures killed');
                                return;
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Better Tasker] Error logging task status on new game:', error);
                }
            };
            
            // Subscribe to newGame event (primary handler)
            const newGameUnsub = globalThis.state.board.on('newGame', handleNewGame);
            if (typeof newGameUnsub === 'function') {
                gameStateUnsubscribers.push(newGameUnsub);
            }
            
            // Consolidated end game handler with debouncing
            const handleEndGame = async (event) => {
                // Skip during Board Analyzer runs
                if (isBoardAnalyzerActive()) {
                    return;
                }
                
                const now = Date.now();
                if (now - lastGameStateChange < GAME_STATE_DEBOUNCE_MS) {
                    console.log('[Better Tasker] Ignoring rapid end game event (debounced)');
                    return;
                }
                lastGameStateChange = now;
                
                // Check for task completion after every game ends (autoplay or manual)
                console.log('[Better Tasker] Game ended, checking for task completion...');
                
                // Log current task status and progress
                try {
                    if (globalThis.state?.player) {
                        const playerContext = globalThis.state.player.getSnapshot().context;
                        const task = playerContext?.questLog?.task;
                        
                        if (task && task.killCount !== undefined) {
                            console.log(`[Better Tasker] Progress: ${task.killCount} creatures killed`);
                            
                            // If 60+ creatures killed, assume task is finished (max quest requirement)
                            if (task.killCount >= 60) {
                                await triggerFailsafe('60+ creatures killed');
                                return;
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Better Tasker] Error logging task status:', error);
                }
                
                // ALWAYS check for new tasks (even during raids) - this is non-invasive
                console.log('[Better Tasker] Checking if new task is available via game state API...');
                const newTaskAvailable = isQuestBlipAvailable();
                console.log('[Better Tasker] New task available check result:', newTaskAvailable);
                
                if (newTaskAvailable) {
                    console.log('[Better Tasker] New task available - accepting task (works during raids)');
                    await openQuestLogAndAcceptTask();
                    return;
                }
                
                // Check if Raid Hunter is currently raiding - skip task COMPLETION during raids
                // Use cached flag for reliability during game transitions
                const raidActive = isRaidHunterActive || isRaidHunterRaiding();
                console.log('[Better Tasker] Raid Hunter active check:', raidActive);
                
                if (raidActive) {
                    console.log('[Better Tasker] Raid Hunter is actively raiding - skipping task completion (already checked for new tasks)');
                    return;
                }
                
                // Check and finish tasks immediately after game ends (only when not raiding)
                await handlePostGameTaskCompletion();
            };
            
            // Subscribe to emitEndGame event
            const endGameUnsub = globalThis.state.board.on('emitEndGame', handleEndGame);
            if (typeof endGameUnsub === 'function') {
                gameStateUnsubscribers.push(endGameUnsub);
            }
        }
        
        console.log('[Better Tasker] Game state monitoring set up');
    } catch (error) {
        console.error('[Better Tasker] Error subscribing to game state:', error);
    }
}

// Unsubscribe from game state changes
function unsubscribeFromGameState() {
    // Clean up game state API subscriptions
    gameStateUnsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') {
            try {
                unsub();
            } catch (error) {
                console.error('[Better Tasker] Error unsubscribing from game state:', error);
            }
        }
    });
    gameStateUnsubscribers = [];
    
    // Also clean up board state subscription for quest button validation
    if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
        try {
            boardStateUnsubscribe();
            boardStateUnsubscribe = null;
        } catch (error) {
            console.error('[Better Tasker] Error unsubscribing from board state:', error);
        }
    }
    
    console.log('[Better Tasker] Game state monitoring disconnected');
}

// Main automation loop
function startAutomation() {
    if (automationInterval) return;
    
    console.log('[Better Tasker] Starting automation loop');
    
    // Reset session flags when starting automation
    resetState('automation');
    // Don't reset taskNavigationCompleted - let it persist across automation restarts
    
    // Set up Raid Hunter coordination FIRST (monitoring only, doesn't interfere)
    setupRaidHunterCoordination();
    
    // Set up Board Analyzer coordination (monitoring only)
    setupBoardAnalyzerCoordination();
    
    // Subscribe to game state for task completion (always set up, even during raids for new task acceptance)
    subscribeToGameState();
    
    // Check if Raid Hunter is actively raiding
    if (isRaidHunterRaiding()) {
        console.log('[Better Tasker] Raid Hunter is actively raiding - game state monitoring active for new tasks, waiting for raid to end for full automation');
        return;
    }
    
    // CRITICAL: Check if raids are available at startup - if yes, delay to let Raid Hunter claim priority
    const raidHunterEnabled = localStorage.getItem('raidHunterAutomationEnabled');
    const raidState = globalThis.state?.raids?.getSnapshot?.();
    const hasActiveRaids = raidState?.context?.list?.length > 0;
    
    // Set up core automation interval (always set up, even during delay)
    automationInterval = setInterval(runAutomationTasks, 5000); // Core automation every 5s
    
    // Check if we should delay initial run to let Raid Hunter claim priority
    if (raidHunterEnabled === 'true' && hasActiveRaids) {
        console.log('[Better Tasker] Raids available at startup - delaying 5 seconds to let Raid Hunter claim priority');
        setTimeout(() => {
            // After delay, check if Raid Hunter is now processing raids
            if (isRaidHunterRaiding()) {
                console.log('[Better Tasker] Raid Hunter is now processing raids - skipping full automation but starting scheduler for new tasks');
                // ALWAYS start scheduler for new task acceptance, even during raids
                scheduleTaskCheck();
                return;
            }
            
            console.log('[Better Tasker] Raid Hunter did not claim raids - proceeding with full task automation');
            runAutomationTasks();
            scheduleTaskCheck();
        }, 5000);
    } else {
        // No raids available or Raid Hunter disabled - run immediately
        runAutomationTasks();
        scheduleTaskCheck();
    }
}

// Pause automation during raids (keeps game state monitoring AND scheduler for new tasks)
function pauseAutomationDuringRaid() {
    if (!automationInterval) return;
    
    console.log('[Better Tasker] Pausing automation during raid (keeping game state monitoring and scheduler for new task acceptance)');
    
    // Clear main automation intervals (but keep game state monitoring)
    clearInterval(automationInterval);
    automationInterval = null;
    
    // Clear quest log interval (legacy)
    if (questLogInterval) {
        clearInterval(questLogInterval);
        questLogInterval = null;
    }
    
    // DON'T clear task check timeout - we need it to wake up for new tasks during raids
    // DON'T unsubscribe from game state - we need it to accept new tasks during raids
    // DON'T clean up coordinators - they need to keep monitoring
    // DON'T pause autoplay - Raid Hunter is controlling that
    // DON'T touch Bestiary Automator settings - Raid Hunter is controlling those
    
    console.log('[Better Tasker] Automation paused - game state monitoring and scheduler active for new task acceptance');
}

function stopAutomation() {
    if (!automationInterval) return;
    
    console.log('[Better Tasker] Stopping automation loop');
    
    // Clean up Raid Hunter coordination
    cleanupRaidHunterCoordination();
    
    // Clean up Board Analyzer coordination
    cleanupBoardAnalyzerCoordination();
    
    // Clear main intervals
    clearInterval(automationInterval);
    automationInterval = null;
    
    // Clear quest log interval (legacy)
    if (questLogInterval) {
        clearInterval(questLogInterval);
        questLogInterval = null;
    }
    
    // Clear task check timeout
    if (taskCheckTimeout) {
        clearTimeout(taskCheckTimeout);
        taskCheckTimeout = null;
    }
    
    // Unsubscribe from game state changes
    unsubscribeFromGameState();
    
    // Stop stamina tooltip monitoring
    stopStaminaTooltipMonitoring();
    
    // Pause autoplay if we have control (using pause button)
    try {
        if (window.AutoplayManager.hasControl('Better Tasker')) {
            const boardContext = globalThis.state.board.getSnapshot().context;
            if (boardContext.mode === 'autoplay') {
                // Use pause button to pause autoplay
                const paused = pauseAutoplayWithButton();
                if (paused) {
                    console.log('[Better Tasker] Autoplay paused using pause button');
                } else {
                    console.log('[Better Tasker] Pause button not found - autoplay not paused');
                }
            }
            // Release control after pausing
            window.AutoplayManager.releaseControl('Better Tasker');
        } else {
            console.log('[Better Tasker] Cannot pause autoplay - not controlling autoplay');
        }
    } catch (error) {
        console.error('[Better Tasker] Error pausing autoplay:', error);
    }
    
    // Only disable Bestiary Automator settings if Raid Hunter is not actively raiding
    // This prevents conflicts when Raid Hunter needs these settings
    if (!isRaidHunterRaiding()) {
        const settings = loadSettings();
        if (settings.autoRefillStamina) {
            console.log('[Better Tasker] Automation stopped - disabling Bestiary Automator autorefill stamina...');
            disableBestiaryAutomatorStaminaRefill();
        }
        if (settings.fasterAutoplay) {
            console.log('[Better Tasker] Automation stopped - disabling Bestiary Automator faster autoplay...');
            disableBestiaryAutomatorFasterAutoplay();
        }
    } else {
        console.log('[Better Tasker] Raid Hunter is actively raiding - preserving Bestiary Automator settings');
    }
}

function runAutomationTasks() {
    try {
        // Only run if tasker is enabled
        if (taskerState !== TASKER_STATES.ENABLED) {
            return;
        }
        
        // Check if Board Analyzer is running
        if (isBoardAnalyzerActive()) {
            console.log('[Better Tasker] Board Analyzer is running, skipping automation');
            return;
        }
        
        // Check if Raid Hunter is actively raiding
        if (isRaidHunterRaiding()) {
            console.log('[Better Tasker] Raid Hunter is actively raiding, skipping automation');
            return;
        }
        
        // Don't run automation if task hunting is ongoing
        if (taskHuntingOngoing) {
            console.log('[Better Tasker] Task hunting ongoing, skipping automation');
            return;
        }
        
        // Check if game is active
        if (!isGameActive()) {
            return;
        }
        
        // Check and finish tasks proactively
        handleTaskFinishing();
        
    } catch (error) {
        console.error('[Better Tasker] Error in automation tasks:', error);
    }
}

// ============================================================================
// 13.1. CREATURE FILTERING FUNCTIONS
// ============================================================================

// Extract creature name from task HTML (global search - kept for backward compatibility)
function extractCreatureFromTask() {
    try {
        console.log('[Better Tasker] Extracting creature from task...');
        
        // Look for creature sprite with ID (e.g., id-52 for Winter Wolf)
        const creatureSprite = document.querySelector('.sprite.outfit[class*="id-"]');
        if (creatureSprite) {
            const classList = Array.from(creatureSprite.classList);
            const idClass = classList.find(cls => cls.startsWith('id-'));
            if (idClass) {
                const creatureId = idClass.replace('id-', '');
                console.log('[Better Tasker] Found creature sprite with ID:', creatureId);
                
                // Try to get creature name from creature database
                if (window.creatureDatabase?.CREATURE_ID_MAP) {
                    const creatureName = window.creatureDatabase.CREATURE_ID_MAP[creatureId];
                    if (creatureName) {
                        console.log('[Better Tasker] Mapped creature ID to name:', creatureName);
                        return creatureName;
                    }
                }
                
                // Fallback: try to extract from task description
                const taskDescription = document.querySelector('.pixel-font-14');
                if (taskDescription && taskDescription.textContent) {
                    const text = taskDescription.textContent;
                    console.log('[Better Tasker] Task description:', text);
                    
                    // Look for "kill count" pattern (English) or "mortos" pattern (Portuguese)
                    const killCountMatch = text.match(/^(.+?)\s+(?:kill\s+count|mortos?)/i);
                    if (killCountMatch) {
                        const creatureName = killCountMatch[1].trim();
                        console.log('[Better Tasker] Extracted creature from description:', creatureName);
                        return creatureName;
                    }
                }
            }
        }
        
        // Alternative: Look for creature name in task description text
        const taskDescriptions = document.querySelectorAll('.pixel-font-14');
        for (const desc of taskDescriptions) {
            if (desc.textContent && (desc.textContent.includes('kill count') || desc.textContent.includes('mortos'))) {
                const text = desc.textContent;
                const killCountMatch = text.match(/^(.+?)\s+(?:kill\s+count|mortos?)/i);
                if (killCountMatch) {
                    const creatureName = killCountMatch[1].trim();
                    console.log('[Better Tasker] Extracted creature from description:', creatureName);
                    return creatureName;
                }
            }
        }
        
        console.log('[Better Tasker] Could not extract creature name from task');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting creature from task:', error);
        return null;
    }
}

// Extract creature name from a specific section (new section-based approach)
function extractCreatureFromSection(section) {
    try {
        console.log('[Better Tasker] Extracting creature from section...');
        
        // Look for creature sprite with ID within the specific section
        const creatureSprite = section.querySelector('.sprite.outfit[class*="id-"]');
        if (creatureSprite) {
            const classList = Array.from(creatureSprite.classList);
            const idClass = classList.find(cls => cls.startsWith('id-'));
            if (idClass) {
                const creatureId = idClass.replace('id-', '');
                console.log('[Better Tasker] Found creature sprite with ID:', creatureId);
                
                // Try to get creature name from creature database
                if (window.creatureDatabase?.CREATURE_ID_MAP) {
                    const creatureName = window.creatureDatabase.CREATURE_ID_MAP[creatureId];
                    if (creatureName) {
                        console.log('[Better Tasker] Mapped creature ID to name:', creatureName);
                        return creatureName;
                    }
                }
                
                // Fallback: try to extract from task description within the section
                const taskDescription = section.querySelector('.pixel-font-14');
                if (taskDescription && taskDescription.textContent) {
                    const text = taskDescription.textContent;
                    console.log('[Better Tasker] Task description:', text);
                    
                    // Look for "kill count" pattern (English) or "mortos" pattern (Portuguese)
                    const killCountMatch = text.match(/^(.+?)\s+(?:kill\s+count|mortos?)/i);
                    if (killCountMatch) {
                        const creatureName = killCountMatch[1].trim();
                        console.log('[Better Tasker] Extracted creature from description:', creatureName);
                        return creatureName;
                    }
                }
            }
        }
        
        // Alternative: Look for creature name in task description text within the section
        const taskDescriptions = section.querySelectorAll('.pixel-font-14');
        for (const desc of taskDescriptions) {
            if (desc.textContent && (desc.textContent.includes('kill count') || desc.textContent.includes('mortos'))) {
                const text = desc.textContent;
                const killCountMatch = text.match(/^(.+?)\s+(?:kill\s+count|mortos?)/i);
                if (killCountMatch) {
                    const creatureName = killCountMatch[1].trim();
                    console.log('[Better Tasker] Extracted creature from description:', creatureName);
                    return creatureName;
                }
            }
        }
        
        console.log('[Better Tasker] Could not extract creature name from section');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting creature from section:', error);
        return null;
    }
}

// Extract suggested map from a specific section
function extractSuggestedMapFromSection(section) {
    try {
        console.log('[Better Tasker] Extracting suggested map from section...');
        
        // Look for suggested map text within this section
        const allParagraphs = section.querySelectorAll('p.pixel-font-14');
        const suggestedMapText = getLocalizedText(UI_TEXT.QUEST_TEXT.SUGGESTED_MAP, UI_TEXT.QUEST_TEXT_PT.SUGGESTED_MAP);
        for (const p of allParagraphs) {
            if (p.textContent && p.textContent.includes(suggestedMapText)) {
                const suggestedMapElement = p.querySelector('span.action-link');
                if (suggestedMapElement) {
                    console.log('[Better Tasker] Suggested map element found in section:', suggestedMapElement.textContent.trim());
                    return suggestedMapElement;
                }
            }
        }
        
        console.log('[Better Tasker] No suggested map found in section');
        return null;
    } catch (error) {
        console.error('[Better Tasker] Error extracting suggested map from section:', error);
        return null;
    }
}

// Open quest log specifically for task removal
async function openQuestLogForTaskRemoval() {
    try {
        // First try to find quest blip
        const questBlip = document.querySelector('[data-blip="true"]');
        if (questBlip) {
            console.log('[Better Tasker] Found quest blip, clicking to open quest log...');
            questBlip.click();
            await sleep(500);
            return true;
        }
        
        // Fallback: try Quests button
        const questsButton = document.querySelector('button img[src*="quest.png"]')?.closest('button') ||
                            Array.from(document.querySelectorAll('button')).find(btn => {
                                const span = btn.querySelector('span');
                                return span && (span.textContent === 'Quests' || span.textContent === 'Quest Log');
                            });
        
        if (questsButton) {
            console.log('[Better Tasker] Found Quests button, clicking to open quest log...');
            questsButton.click();
            await sleep(500);
            return true;
        }
        
        console.log('[Better Tasker] No quest blip or Quests button found for task removal');
        return false;
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log for task removal:', error);
        return false;
    }
}

// Remove current task if creature is not allowed
async function removeCurrentTaskIfNotAllowed() {
    try {
        console.log('[Better Tasker] Checking if current task should be removed...');
        
        // Get current active task
        const activeTask = globalThis.state?.player?.activeTask;
        if (!activeTask) {
            console.log('[Better Tasker] No active task found');
            return false;
        }
        
        // Safety check: prevent double-removal by checking if we're already in the middle of removing
        if (window.betterTaskerRemovingTask) {
            console.log('[Better Tasker] Task removal already in progress, skipping to prevent double-removal');
            return false;
        }
        
        // Set flag to prevent double-removal
        window.betterTaskerRemovingTask = true;
        
        // Extract creature from current task
        const creatureName = extractCreatureFromTask();
        if (!creatureName) {
            console.log('[Better Tasker] Could not extract creature from current task');
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        // Check if creature is allowed
        const isAllowed = isCreatureAllowed(creatureName);
        if (isAllowed) {
            console.log(`[Better Tasker] Current task creature "${creatureName}" is allowed, keeping task`);
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        console.log(`[Better Tasker] Current task creature "${creatureName}" is NOT allowed, removing task...`);
        
        // First, make sure quest log is open (Remove button is only visible when quest log is open)
        console.log('[Better Tasker] Opening quest log to access Remove button...');
        const questLogOpened = await openQuestLogForTaskRemoval();
        if (!questLogOpened) {
            console.log('[Better Tasker] Failed to open quest log for task removal');
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        // Wait a moment for quest log to fully load
        await sleep(500);
        
        // Find and click the Remove button (look for button containing trash icon)
        let removeButton = null;
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const trashIcon = btn.querySelector('svg.lucide-trash2');
            if (trashIcon && isElementVisible(btn)) {
                // Use centralized function to check for remove button text
                const possibleTexts = [UI_TEXT.BUTTONS.REMOVE, UI_TEXT.BUTTONS_PT.REMOVE];
                const buttonText = btn.textContent.trim();
                if (possibleTexts.some(text => buttonText.includes(text))) {
                    removeButton = btn;
                    break;
                }
            }
        }
        
        if (!removeButton) {
            console.log('[Better Tasker] Remove button not found');
            window.betterTaskerRemovingTask = false;
            return false;
        }
        
        console.log('[Better Tasker] Clicking Remove button...');
        removeButton.click();
        
        // Wait for the confirmation dialog to appear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Find and click the confirmation button
        const confirmButton = findConfirmationButton();
        if (confirmButton) {
            console.log('[Better Tasker] Clicking confirmation button...');
            confirmButton.click();
            
            // Wait after confirmation click
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.log('[Better Tasker] Confirmation button not found');
        }
        
        console.log('[Better Tasker] Task removal completed');
        
        // Close quest log after task removal
        console.log('[Better Tasker] Closing quest log after task removal...');
        await clearModalsWithEsc(3);
        await sleep(200);
        
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error removing current task:', error);
        return false;
    } finally {
        // Always clear the flag, even if there was an error
        window.betterTaskerRemovingTask = false;
    }
}

// Remove task directly from quest log (without closing it first)
async function removeTaskDirectlyFromQuestLog() {
    try {
        console.log('[Better Tasker] Removing task directly from quest log...');
        
        // Wait a moment for quest log to be fully loaded
        await sleep(500);
        
        // Find and click the Remove button (look for button containing trash icon)
        let removeButton = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!removeButton && attempts < maxAttempts) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const trashIcon = btn.querySelector('svg.lucide-trash2');
                if (trashIcon && isElementVisible(btn)) {
                    const text = btn.textContent.trim().toLowerCase();
                    // More specific matching to avoid false positives
                    const possibleTexts = [UI_TEXT.BUTTONS.REMOVE.toLowerCase(), UI_TEXT.BUTTONS_PT.REMOVE.toLowerCase()];
                    if (possibleTexts.some(possibleText => 
                        text === possibleText || 
                        text === `${possibleText} task` || 
                        text.includes(`${possibleText} current`))) {
                        removeButton = btn;
                        break;
                    }
                }
            }
            
            if (!removeButton) {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`[Better Tasker] Remove button not found, retrying... (${attempts}/${maxAttempts})`);
                    await sleep(500);
                }
            }
        }
        
        if (!removeButton) {
            console.log('[Better Tasker] Remove button not found in quest log after retries');
            return false;
        }
        
        console.log('[Better Tasker] Clicking Remove button...');
        removeButton.click();
        
        // Wait for the confirmation dialog to appear
        await sleep(1000);
        
        // Find and click the confirmation button
        const confirmButton = findConfirmationButton();
        let confirmationClicked = false;
        if (confirmButton) {
            console.log('[Better Tasker] Clicking confirmation button...');
            confirmButton.click();
            confirmationClicked = true;
            
            // Wait after confirmation click
            await sleep(1000);
        } else {
            console.log('[Better Tasker] Confirmation button not found');
        }
        
        if (!confirmationClicked) {
            console.log('[Better Tasker] Confirmation button not found - task removal may be incomplete');
            return false;
        }
        
        console.log('[Better Tasker] Task removal completed directly from quest log');
        return true;
        
    } catch (error) {
        console.error('[Better Tasker] Error removing task directly from quest log:', error);
        return false;
    }
}

// Check if a creature is in the allowed list
function isCreatureAllowed(creatureName) {
    try {
        if (!creatureName) {
            console.log('[Better Tasker] No creature name provided for checking');
            return true; // Allow if we can't determine creature
        }
        
        const settings = loadSettings();
        
        // Convert creature name to settings key format (e.g., "Winter Wolf" -> "creature-winter-wolf")
        const creatureKey = `creature-${creatureName.toLowerCase().replace(/\s+/g, '-')}`;
        
        console.log('[Better Tasker] Checking if creature is allowed:', {
            creatureName,
            creatureKey,
            hasIndividualSetting: settings.hasOwnProperty(creatureKey),
            individualSettingValue: settings[creatureKey]
        });
        
        // Use individual creature settings
        const isAllowed = settings[creatureKey] === true;
        if (!isAllowed) {
            console.log(`[Better Tasker] Creature "${creatureName}" is NOT allowed (individual setting: ${settings[creatureKey]})`);
        } else {
            console.log(`[Better Tasker] Creature "${creatureName}" IS allowed (individual setting: ${settings[creatureKey]})`);
        }
        
        return isAllowed;
    } catch (error) {
        console.error('[Better Tasker] Error checking if creature is allowed:', error);
        return true; // Allow on error to avoid blocking tasks
    }
}

// Schedule next task check based on resetAt timestamp (max 10 minutes between checks)
function scheduleTaskCheck() {
    try {
        console.log('[Better Tasker] === SCHEDULER CHECK START ===');
        
        // Clear any existing timeout
        if (taskCheckTimeout) {
            console.log('[Better Tasker] Clearing existing task check timeout');
            clearTimeout(taskCheckTimeout);
            taskCheckTimeout = null;
        }
        
        // Only schedule if tasker is enabled OR in New Task+ mode
        if (taskerState !== TASKER_STATES.ENABLED && taskerState !== TASKER_STATES.NEW_TASK_ONLY) {
            console.log('[Better Tasker] Scheduler: Tasker not in active mode (disabled), exiting');
            return;
        }
        console.log('[Better Tasker] Scheduler: Tasker is active (mode:', taskerState, ') ✓');
        
        // Don't schedule if task hunting is ongoing
        if (taskHuntingOngoing) {
            console.log('[Better Tasker] Scheduler: Task hunting ongoing, exiting');
            return;
        }
        console.log('[Better Tasker] Scheduler: Not task hunting ✓');
        
        // Check if game is active
        if (!isGameActive()) {
            console.log('[Better Tasker] Scheduler: Game not active, exiting');
            return;
        }
        console.log('[Better Tasker] Scheduler: Game is active ✓');
        
        // Get task info from game state
        const playerContext = globalThis.state.player.getSnapshot().context;
        if (!playerContext.questLog || !playerContext.questLog.task) {
            console.log('[Better Tasker] Scheduler: No task info available - retrying in 10 minutes');
            taskCheckTimeout = setTimeout(() => scheduleTaskCheck(), 600000);
            return;
        }
        
        const task = playerContext.questLog.task;
        console.log('[Better Tasker] Scheduler: Task state:', {
            gameId: task.gameId,
            ready: task.ready,
            resetAt: task.resetAt,
            resetAtDate: task.resetAt ? new Date(task.resetAt).toLocaleString() : 'null'
        });
        
        // Only check if there's no active task
        if (task.gameId) {
            console.log('[Better Tasker] Scheduler: Active task in progress (gameId:', task.gameId, ') - no need to schedule new task check');
            return;
        }
        console.log('[Better Tasker] Scheduler: No active task (gameId is null/undefined) ✓');
        
        // Check if new task is available now
        if (!task.resetAt) {
            console.log('[Better Tasker] Scheduler: New task available NOW (resetAt is null) - accepting immediately');
            openQuestLogAndAcceptTask();
            return;
        }
        
        // Calculate time until task is available
        const timeRemaining = task.resetAt - Date.now();
        console.log('[Better Tasker] Scheduler: Time remaining until task available:', Math.ceil(timeRemaining / 1000), 'seconds');
        
        if (timeRemaining <= 0) {
            console.log('[Better Tasker] Scheduler: Task cooldown EXPIRED - accepting task now');
            openQuestLogAndAcceptTask();
            return;
        }
        
        // Cap delay at 10 minutes (600000ms)
        const delay = Math.min(timeRemaining, 600000);
        const delaySeconds = Math.ceil(delay / 1000);
        
        console.log(`[Better Tasker] Scheduler: Next task check scheduled in ${delaySeconds}s (total remaining: ${Math.ceil(timeRemaining / 1000)}s)`);
        console.log('[Better Tasker] === SCHEDULER CHECK END (scheduled) ===');
        
        // Schedule next check
        taskCheckTimeout = setTimeout(() => {
            console.log('[Better Tasker] Scheduler: Timeout fired, rechecking...');
            scheduleTaskCheck(); // Rechain
        }, delay);
        
    } catch (error) {
        console.error('[Better Tasker] Scheduler: Error during check:', error);
        // Retry in 10 minutes on error
        taskCheckTimeout = setTimeout(() => scheduleTaskCheck(), 600000);
    }
}

// Legacy function for compatibility (redirects to scheduler)
function checkQuestLogForTasks() {
    scheduleTaskCheck();
}

// Shared function to accept new task (used by both Enabled and New Task+ modes)
async function acceptNewTaskFromQuestLog(skipCreatureFiltering = false) {
    try {
        console.log(`[Better Tasker] Accepting new task (skip filtering: ${skipCreatureFiltering})...`);
        
        // Look for and click "New Task" button
        console.log('[Better Tasker] Looking for New Task button...');
        let newTaskButton = document.querySelector('button:has(svg.lucide-plus)');
        if (!newTaskButton) {
            // Use localization system to find New Task button
            newTaskButton = findButtonByText('New task');
        }
        
        if (!newTaskButton) {
            console.log('[Better Tasker] New Task button not found');
            return false;
        }
        
        console.log('[Better Tasker] New Task button found, clicking...');
        newTaskButton.click();
        await sleep(200);
        console.log('[Better Tasker] New Task button clicked');
        
        // Wait for task selection to load
        await sleep(500);
        
        // Check creature filtering if not skipped
        if (!skipCreatureFiltering) {
            console.log('[Better Tasker] Checking creature filtering...');
            const creatureName = extractCreatureFromTask();
            console.log('[Better Tasker] Extracted creature name:', creatureName);
            
            if (creatureName && !isCreatureAllowed(creatureName)) {
                console.log(`[Better Tasker] Task rejected - creature "${creatureName}" is not in allowed list`);
                
                // Remove the task directly while quest log is open
                console.log('[Better Tasker] Removing rejected task directly from quest log...');
                const taskRemoved = await removeTaskDirectlyFromQuestLog();
                if (taskRemoved) {
                    console.log('[Better Tasker] Rejected task successfully removed from game');
                } else {
                    console.log('[Better Tasker] Failed to remove rejected task from game');
                }
                
                return false; // Task rejected
            }
        }
        
        console.log('[Better Tasker] Task accepted successfully');
        return true; // Task accepted
        
    } catch (error) {
        console.error('[Better Tasker] Error accepting new task:', error);
        return false;
    }
}

// Open quest log and accept new task (extracted from handleTaskFinishing)
async function openQuestLogAndAcceptTask() {
    try {
        console.log('[Better Tasker] === OPEN QUEST LOG AND ACCEPT TASK START ===');
        console.log('[Better Tasker] Current raid state:', {
            isRaidHunterActive: isRaidHunterActive,
            isRaidHunterRaiding: isRaidHunterRaiding()
        });
        
        // Don't set task operation in progress flag here - only set it when actually processing a task
        console.log('[Better Tasker] Opening quest log to check for tasks...');
        
        // Clear any open modals first
        await clearModalsWithEsc(3);
        
        // Wait for modals to clear
        await sleep(200);
        console.log('[Better Tasker] Modal clearing completed');
        
        // Find and click quest blip or use "Quests/Raiding" button as fallback
        let questLogOpened = false;
        
        // Use comprehensive quest blip selectors (like elsewhere in the code)
        const questBlipSelectors = [
            '#header-slot img[src*="quest-blip.png"]',
            '#header-slot img[src*="/assets/icons/quest-blip.png"]',
            '#header-slot img[alt="Quests"][src*="quest-blip"]',
            '#header-slot img[alt="Tasking"][src*="quest-blip"]',
            'img[src*="quest-blip.png"]',  // Fallback
            'img[src*="/assets/icons/quest-blip.png"]'  // Fallback
        ];
        
        let questBlip = null;
        for (const selector of questBlipSelectors) {
            questBlip = document.querySelector(selector);
            if (questBlip) {
                console.log(`[Better Tasker] Found quest blip with selector: ${selector}`);
                break;
            }
        }
        
        if (questBlip) {
            questBlip.click();
            await sleep(200);
            console.log('[Better Tasker] Quest log opened via quest blip');
            questLogOpened = true;
        } else {
            // Fallback: Look for "Quests" button (normal) or "Raiding" button (during raids)
            console.log('[Better Tasker] No quest blip found, looking for Quests/Raiding button...');
            const questsButton = document.querySelector('button img[src*="quest.png"]') ||
                                document.querySelector('button img[src*="enemy.png"]');  // Raiding button during raids
            if (questsButton) {
                const questButton = questsButton.closest('button');
                if (questButton) {
                    questButton.click();
                    await sleep(200);
                    console.log('[Better Tasker] Quest log opened via Quests button');
                    questLogOpened = true;
                }
            } else {
                console.log('[Better Tasker] Neither quest blip nor Quests button found');
            }
        }
        
        if (questLogOpened) {
            // Wait for quest log to fully load
            await sleep(300);
            
            // Set task operation in progress flag when actually accepting a new task
            taskOperationInProgress = true;
            updateExposedState();
            console.log('[Better Tasker] Task operation in progress flag set - accepting new task');
            
            // Safety timeout to reset the flag if operation gets stuck (30 seconds)
            const safetyTimeout = setTimeout(() => {
                if (taskOperationInProgress) {
                    console.log('[Better Tasker] Safety timeout: Resetting taskOperationInProgress flag after 30 seconds');
                    taskOperationInProgress = false;
                    updateExposedState();
                }
            }, 30000);
            safetyTimeouts.push(safetyTimeout);
            
            // Check if Raid Hunter is actively raiding OR if in New Task+ mode - both skip creature filtering
            const isRaiding = isRaidHunterRaiding();
            const isNewTaskMode = taskerState === TASKER_STATES.NEW_TASK_ONLY;
            const skipFiltering = isRaiding || isNewTaskMode;
            
            if (skipFiltering) {
                const reason = isNewTaskMode ? 'New Task+ mode' : 'Raid Hunter active';
                console.log(`[Better Tasker] ${reason} - accepting task without filtering`);
            }
            
            // Accept new task using shared function
            const taskAccepted = await acceptNewTaskFromQuestLog(skipFiltering);
            
            if (!taskAccepted) {
                console.log('[Better Tasker] Task not accepted (filtered or not found)');
                // Clear task operation in progress flag and reschedule next check
                taskOperationInProgress = false;
                updateExposedState();
                await clearModalsWithEsc(3); // Close quest log
                scheduleTaskCheck(); // Schedule next task check
                return;
            }
            
            // If in New Task+ mode OR raiding, just close quest log and return (no navigation)
            if (isNewTaskMode || isRaiding) {
                const mode = isNewTaskMode ? 'New Task+ mode' : 'raid active';
                console.log(`[Better Tasker] Task accepted (${mode}) - closing quest log, no navigation`);
                await clearModalsWithEsc(3); // Close quest log
                taskOperationInProgress = false;
                updateExposedState();
                console.log('[Better Tasker] Task claimed successfully');
                scheduleTaskCheck(); // Schedule next task check
                return;
            }
            
            // Otherwise proceed with full automation (Enabled mode, no raid - navigate to map and start autoplay)
            console.log('[Better Tasker] Enabled mode, no raid - proceeding with navigation and autoplay...');
            await navigateToSuggestedMapAndStartAutoplay();
        } else {
            console.log('[Better Tasker] Could not open quest log - neither quest blip nor Quests button found');
        }
        
        console.log('[Better Tasker] === OPEN QUEST LOG AND ACCEPT TASK END ===');
        
    } catch (error) {
        console.error('[Better Tasker] Error opening quest log and accepting task:', error);
        console.log('[Better Tasker] === OPEN QUEST LOG AND ACCEPT TASK END (error) ===');
        cleanupTaskCompletionFailure('error opening quest log and accepting task');
    }
}

// ============================================================================
// 14. INITIALIZATION
// ============================================================================

function init() {
    console.log('[Better Tasker] Better Tasker initializing');
    
    // Load tasker state from localStorage first
    loadTaskerState();
    
    // Only set up Raid Hunter coordination if tasker is enabled
    if (taskerState === TASKER_STATES.ENABLED) {
        setupRaidHunterCoordination();
        
        // Check Raid Hunter status immediately on startup
        isRaidHunterActive = isRaidHunterRaiding();
        if (isRaidHunterActive) {
            console.log('[Better Tasker] Raid Hunter is actively raiding - automation will be paused');
        }
        
        // Set up Board Analyzer coordination
        setupBoardAnalyzerCoordination();
        
        // Check Board Analyzer status immediately on startup
        isBoardAnalyzerRunning = isBoardAnalyzerActive();
        if (isBoardAnalyzerRunning) {
            console.log('[Better Tasker] Board Analyzer is running - automation will be paused');
        }
    }
    
    // Expose initial state for other mods
    exposeTaskerState();
    
    // Always start UI monitoring to insert buttons (needed to enable/disable mod)
    startUIMonitoring();
    
    // Start automation if enabled (will check for Raid Hunter internally)
    if (taskerState === TASKER_STATES.ENABLED) {
        startAutomation();
        scheduleTaskCheck(); // Check resetAt and schedule next task check
    }
    
    // Start scheduler if in New Task+ mode (uses same logic as Enabled mode for task acceptance)
    if (taskerState === TASKER_STATES.NEW_TASK_ONLY) {
        scheduleTaskCheck();
    }
    
    console.log('[Better Tasker] Better Tasker Mod initialized.');
}

init();

// ============================================================================
// 15. CLEANUP & EXPORTS
// ============================================================================

// Cleanup function for when mod is disabled
function cleanupBetterTasker() {
    try {
        // Stop automation
        stopAutomation();
        
        // Clean up Raid Hunter coordination
        cleanupRaidHunterCoordination();
        
        // Clean up modal if open
        if (activeTaskerModal) {
            try {
                // Close modal if it has a close method
                if (typeof activeTaskerModal.close === 'function') {
                    activeTaskerModal.close();
                }
            } catch (modalError) {
                console.warn('[Better Tasker] Error closing modal:', modalError);
            }
            cleanupTaskerModal();
        }
        
        // Clean up quest log observer
        stopQuestLogMonitoring();
        
        // Clean up quest button validation and restore appearance
        stopQuestButtonValidation();
        restoreQuestButtonAppearance();
        
        // Clean up stamina tooltip monitoring
        stopStaminaTooltipMonitoring();
        
        // Clean up board state subscription
        if (boardStateUnsubscribe && typeof boardStateUnsubscribe === 'function') {
            boardStateUnsubscribe();
            boardStateUnsubscribe = null;
        }
        
        // Release autoplay control
        window.AutoplayManager.releaseControl('Better Tasker');
        
        // Clean up ESC key listener
        if (escKeyListener) {
            document.removeEventListener('keydown', escKeyListener);
            escKeyListener = null;
        }
        
        // Clear all tracked timeouts
        clearTrackedTimeouts();
        
        // Clean up tracked event listeners
        trackedListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        trackedListeners.clear();
        
        // Remove custom CSS
        const shimmerCSS = document.getElementById('taskerShimmerCSS');
        if (shimmerCSS) {
            shimmerCSS.remove();
        }
        
        // Remove buttons if they exist
        const settingsButton = document.getElementById(TASKER_BUTTON_ID);
        if (settingsButton) {
            settingsButton.remove();
        }
        
        const toggleButton = document.getElementById(TASKER_TOGGLE_ID);
        if (toggleButton) {
            toggleButton.remove();
        }
        
        // Remove button containers created by insertButtons()
        const buttonContainers = document.querySelectorAll('div[style*="display: flex"][style*="gap: 4px"][style*="margin-top: 4px"]');
        buttonContainers.forEach(container => {
            // Only remove if it contains our buttons
            if (container.querySelector(`#${TASKER_BUTTON_ID}`) || container.querySelector(`#${TASKER_TOGGLE_ID}`)) {
                container.remove();
            }
        });
        
        // Clean up global state
        if (window.betterTaskerState) {
            delete window.betterTaskerState;
        }
        if (window.cleanupBetterTasker) {
            delete window.cleanupBetterTasker;
        }
        if (window.updateWarningText) {
            delete window.updateWarningText;
        }
        
        // Release control from shared managers and clean up if no other mods need them
        try {
            if (window.QuestButtonManager) {
                window.QuestButtonManager.releaseControl('Better Tasker');
                // Reset original state to prevent memory leaks
                if (window.QuestButtonManager.originalState) {
                    window.QuestButtonManager.originalState = null;
                }
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Quest Button Manager control:', managerError);
        }
        
        try {
            if (window.BestiaryAutomatorSettingsManager) {
                window.BestiaryAutomatorSettingsManager.releaseControl('Better Tasker');
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Bestiary Automator Settings Manager control:', managerError);
        }
        
        try {
            if (window.AutoplayManager) {
                window.AutoplayManager.releaseControl('Better Tasker');
                // Reset original mode to prevent memory leaks
                if (window.AutoplayManager.originalMode) {
                    window.AutoplayManager.originalMode = null;
                }
            }
        } catch (managerError) {
            console.warn('[Better Tasker] Error releasing Autoplay Manager control:', managerError);
        }
        
        // Reset session flags
        resetState('full');
        // Don't reset taskNavigationCompleted in cleanup - let it persist
        
        console.log('[Better Tasker] Mod cleanup completed');
    } catch (error) {
        console.error('[Better Tasker] Error during mod cleanup:', error);
    }
}

// Expose state for other mods to check (like Raid Hunter coordination)
function exposeTaskerState() {
    if (typeof window !== 'undefined') {
        // Check if we have an active task (even if in cooldown)
        let hasActiveTask = false;
        try {
            const playerContext = globalThis.state?.player?.getSnapshot()?.context;
            const task = playerContext?.questLog?.task;
            hasActiveTask = !!(task && task.gameId);
        } catch (error) {
            // Ignore errors, hasActiveTask remains false
        }
        
        window.betterTaskerState = {
            taskOperationInProgress: taskOperationInProgress,
            taskHuntingOngoing: taskHuntingOngoing,
            pendingTaskCompletion: pendingTaskCompletion,
            taskerState: taskerState,
            taskNavigationCompleted: taskNavigationCompleted,
            hasActiveTask: hasActiveTask
        };
    }
}

// Update exposed state whenever it changes
function updateExposedState() {
    exposeTaskerState();
}

// Export functionality for external access
context.exports = {
    cleanup: cleanupBetterTasker,
    toggleTasker: toggleTasker,
    startAutomation: startAutomation,
    stopAutomation: stopAutomation,
    loadSettings: loadSettings,
    autoSaveSettings: autoSaveSettings
};