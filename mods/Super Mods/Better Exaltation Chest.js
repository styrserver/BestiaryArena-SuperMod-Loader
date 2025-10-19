// =======================
// Better Exaltation Chest
// =======================
(function() {
  
  // =======================
  // 1. Configuration & Constants
  // =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  // Performance constants
  const CONSTANTS = {
    DEBOUNCE_DELAY: 50,
    RETRY_MAX_ATTEMPTS: 5,
    RETRY_BASE_DELAY: 100
  };
  
  // Panel constants
  const EXALTATION_PANEL_WIDTH = 450;
  
  // DOM selectors
  const SELECTORS = {
    EXALTATION_CHEST_TITLE: 'p.inline.text-rarity-5',
    EXALTATION_CHEST_MODAL: '.widget-bottom'
  };
  
  // Track processed elements to prevent re-processing
  const processedElements = new WeakSet();
  
  // Event listener management for memory leak prevention
  const eventListeners = new Map();
  
  function addManagedEventListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    const key = `${element.id || element.className || 'anonymous'}_${event}_${Date.now()}`;
    eventListeners.set(key, { element, event, handler, options });
    return key;
  }
  
  function removeManagedEventListener(key) {
    const listener = eventListeners.get(key);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      eventListeners.delete(key);
    }
  }
  
  function cleanupAllEventListeners() {
    eventListeners.forEach((listener, key) => {
      try {
        listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      } catch (error) {
        console.warn('[Better Exaltation Chest] Error removing event listener:', error);
      }
    });
    eventListeners.clear();
  }
  
  // =======================
  // 2. LocalStorage Functions
  // =======================
  
  const STORAGE_KEYS = {
    AUTO_OPEN_SPEED: 'better-exaltation-auto-speed',
    EQUIPMENT_SETUP: 'better-exaltation-equipment-setup'
  };
  
  // Auto mode state (always default: disabled, not saved to localStorage)
  let autoModeEnabled = false;
  
  // Equipment setup state (load from localStorage, default: empty array)
  let equipmentSetup = loadSetting(STORAGE_KEYS.EQUIPMENT_SETUP, []);
  
  // If no setup exists, create default "All" setup
  if (equipmentSetup.length === 0) {
    equipmentSetup = [{ equipment: 'All', tier: 'All', stat: 'All' }];
    saveSetting(STORAGE_KEYS.EQUIPMENT_SETUP, equipmentSetup);
    console.log('[Better Exaltation Chest] Created default equipment setup: All/All/All');
  }
  
  // Panel state
  let activeExaltationPanel = null;
  let escKeyListener = null;
  let resizeListener = null;
  let exaltationPanelInProgress = false;
  let lastPanelCall = 0;
  let modalObserver = null;
  
  // Auto-opening state
  let autoOpenInterval = null;
  let modalCloseObserver = null;
  let repositionTimeout = null;
  
  // Equipment filtering state
  let lastOpenedEquipment = null;
  let equipmentCheckTimeout = null;
  let originalFetch = null;
  
  // Status tracking
  let equipmentStats = {
    totalOpened: 0,
    kept: 0,
    disenchanted: 0,
    dustGained: 0
  };
  
  // Equipment log tracking for detailed history
  let equipmentLog = [];
  let sessionStartTime = Date.now();
  
  function saveSetting(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      console.log(`[Better Exaltation Chest] Saved setting ${key}:`, value);
    } catch (error) {
      console.warn(`[Better Exaltation Chest] Failed to save setting ${key}:`, error);
    }
  }
  
  async function copyToClipboard(text) {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        console.log("[Better Exaltation Chest] Successfully copied using modern clipboard API");
        return true;
      } catch (err) {
        console.warn("[Better Exaltation Chest] Modern clipboard API failed, trying fallback:", err);
      }
    }
    
    // Fallback to legacy method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    let success = false;
    try { 
      success = document.execCommand('copy'); 
      console.log("[Better Exaltation Chest] Legacy copy command result:", success);
    } catch (err) { 
      console.error("[Better Exaltation Chest] Failed to copy to clipboard:", err); 
    }
    document.body.removeChild(textarea);
    return success;
  }
  
  function generateSummaryLogText() {
    const sessionDuration = Date.now() - sessionStartTime;
    const sessionHours = sessionDuration / (1000 * 60 * 60);
    
    let summary = `--- Better Exaltation Chest Summary ---\n`;
    summary += `Total Equipment Opened: ${equipmentStats.totalOpened}\n`;
    summary += `Equipment Kept: ${equipmentStats.kept}\n`;
    summary += `Equipment Disenchanted: ${equipmentStats.disenchanted}\n`;
    summary += `Total Dust Gained: ${equipmentStats.dustGained.toLocaleString()}\n`;
    summary += `---------------------------\n\n`;
    
    // Equipment Details
    summary += `--- Equipment Details ---\n`;
    if (equipmentLog.length === 0) {
      summary += `No equipment opened yet.\n`;
      summary += `\n`;
      summary += `Example format when equipment is opened:\n`;
      summary += `1. [12/25/2024, 3:45:30 PM] ✅ KEPT\n`;
      summary += `   Equipment: Sword (T3 AD)\n`;
      summary += `   Matched Rule: Sword/≥T2/AD\n`;
      summary += `\n`;
      summary += `2. [12/25/2024, 3:46:15 PM] ❌ DISENCHANTED\n`;
      summary += `   Equipment: Shield (T1 HP)\n`;
      summary += `   Reason: No matching setup rules\n`;
      summary += `   Dust Gained: 150\n`;
    } else {
      equipmentLog.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toLocaleString();
        const equipment = entry.equipment;
        const action = entry.action === 'kept' ? '✅ KEPT' : 
                      entry.action === 'disenchanted' ? '❌ DISENCHANTED' : 
                      '📦 OPENED';
        
        summary += `${index + 1}. [${timestamp}] ${action}\n`;
        summary += `   Equipment: ${equipment.name} (T${equipment.tier} ${equipment.stat.toUpperCase()})\n`;
        
        if (entry.action === 'kept' && entry.matchedRule) {
          summary += `   Matched Rule: ${entry.matchedRule.equipment}/${entry.matchedRule.tier}/${entry.matchedRule.stat}\n`;
        } else if (entry.action === 'disenchanted') {
          summary += `   Reason: ${entry.reason || 'No matching setup rules'}\n`;
          if (entry.dustGained > 0) {
            summary += `   Dust Gained: ${entry.dustGained.toLocaleString()}\n`;
          }
        }
        summary += `\n`;
      });
    }
    summary += `---------------------------\n`;
    
    return summary;
  }
  
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(num => num.toString().padStart(2, '0')).join(':');
  }
  
  function clearEquipmentLog() {
    equipmentLog = [];
    equipmentStats = {
      totalOpened: 0,
      kept: 0,
      disenchanted: 0,
      dustGained: 0
    };
    sessionStartTime = Date.now();
    console.log('[Better Exaltation Chest] Equipment log and stats cleared');
  }
  
  function loadSetting(key, defaultValue) {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const value = JSON.parse(stored);
        console.log(`[Better Exaltation Chest] Loaded setting ${key}:`, value);
        return value;
      }
    } catch (error) {
      console.warn(`[Better Exaltation Chest] Failed to load setting ${key}:`, error);
    }
    return defaultValue;
  }
  
  // =======================
  // 3. Core Functions
  // =======================
  
  // Reusable button style functions
  function createButtonStyle(type, customStyles = '') {
    const baseStyles = `
      color: #fff;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.1s ease;
    `;
    
    const buttonTypes = {
      green: `
        background-image: url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png');
        background-repeat: repeat;
        border: 1px solid #4a7c4a;
      `,
      red: `
        background-image: url('https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png');
        background-repeat: repeat;
        border: 1px solid #7c4a4a;
      `,
      gray: `
        background: #444;
        border: 1px solid #666;
      `
    };
    
    return baseStyles + (buttonTypes[type] || '') + customStyles;
  }
  
  // Add click animation to buttons
  function addClickAnimation(button) {
    const mousedownHandler = (event) => {
      event.stopPropagation();
      button.style.transform = 'scale(0.95)';
      button.style.filter = 'brightness(0.8)';
    };
    
    const mouseupHandler = (event) => {
      event.stopPropagation();
      button.style.transform = 'scale(1)';
      button.style.filter = 'brightness(1)';
    };
    
    const mouseleaveHandler = (event) => {
      event.stopPropagation();
      button.style.transform = 'scale(1)';
      button.style.filter = 'brightness(1)';
    };
    
    // Store handlers on button for potential cleanup
    button._clickAnimationHandlers = { mousedownHandler, mouseupHandler, mouseleaveHandler };
    
    addManagedEventListener(button, 'mousedown', mousedownHandler);
    addManagedEventListener(button, 'mouseup', mouseupHandler);
    addManagedEventListener(button, 'mouseleave', mouseleaveHandler);
  }
  
  function createDropdownStyle(customStyles = '') {
    return `
      background: #333;
      color: #fff;
      border: 1px solid #555;
      border-radius: 2px;
      font-size: 10px;
      padding: 2px;
    ` + customStyles;
  }
  
  // Reusable modal finding functions
  function findExaltationChestModal() {
    const modalTitles = document.querySelectorAll('h2.widget-top-text p');
    for (const title of modalTitles) {
      if (title.textContent.includes('Exaltation Chest')) {
        return title;
      }
    }
    return null;
  }
  
  function findExaltationChestModalContent() {
    const modalTitle = findExaltationChestModal();
    if (!modalTitle) return null;
    return modalTitle.closest('.widget-top').nextElementSibling;
  }
  
  function findExaltationChestTitle() {
    return document.querySelector(SELECTORS.EXALTATION_CHEST_TITLE);
  }
  
  function isProcessed(element) {
    return processedElements.has(element);
  }
  
  function markAsProcessed(element) {
    processedElements.add(element);
  }
  
  function enhanceExaltationChestTitle() {
    console.log('enhanceExaltationChestTitle called');
    
    // Find the specific exaltation chest modal (same logic as enhanceExaltationChestModal)
    const modalTitles = document.querySelectorAll('h2.widget-top-text p');
    let modalTitle = null;
    
    for (const title of modalTitles) {
      if (title.textContent.includes('Exaltation Chest')) {
        modalTitle = title;
        break;
      }
    }
    
    console.log('modalTitle found in enhanceExaltationChestTitle:', !!modalTitle);
    console.log('modalTitle text in enhanceExaltationChestTitle:', modalTitle ? modalTitle.textContent : 'null');
    if (!modalTitle) {
      console.log('Not an exaltation chest modal in enhanceExaltationChestTitle, returning');
      return;
    }
    
    const titleElement = findExaltationChestTitle();
    console.log('titleElement found in enhanceExaltationChestTitle:', !!titleElement);
    console.log('titleElement text in enhanceExaltationChestTitle:', titleElement ? titleElement.textContent : 'null');
    
    if (!titleElement || isProcessed(titleElement)) {
      console.log('titleElement not found or already processed in enhanceExaltationChestTitle');
      return;
    }
    
    if (titleElement.textContent === 'Exaltation Chest') {
      console.log('Changing title from Exaltation Chest to Better Exaltation Chest activated!');
      titleElement.textContent = 'Better Exaltation Chest activated!';
      titleElement.style.color = '#32cd32'; // Green color
      markAsProcessed(titleElement);
      console.log('Title enhanced successfully');
    } else {
      console.log('Title already changed or not Exaltation Chest:', titleElement.textContent);
    }
  }
  
  function replaceModalDescriptionWithStatus() {
    try {
      // Find the modal content area
      const modalTitle = findExaltationChestModal();
      if (!modalTitle) return;
      
      const exaltationModal = findExaltationChestModalContent();
      if (!exaltationModal) return;
      
      // Find the tooltip-prose section that contains the description
      const tooltipProse = exaltationModal.querySelector('.tooltip-prose');
      if (!tooltipProse || isProcessed(tooltipProse)) return;
      
      // Replace the description content with status display
      const descriptionP = tooltipProse.querySelector('p.inline:not(.text-rarity-5)');
      const blockquote = tooltipProse.querySelector('blockquote');
      
      if (descriptionP) {
        descriptionP.innerHTML = createStatusDisplay();
      }
      
      if (blockquote) {
        blockquote.style.display = 'none'; // Hide the quote
      }
      
      markAsProcessed(tooltipProse);
      console.log('[Better Exaltation Chest] Modal description replaced with status display');
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error replacing modal description:', error);
    }
  }
  
  function createStatusDisplay() {
    return `
      <div style="display: flex; flex-direction: column; gap: 6px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #fff;">Total Opened:</span>
          <span style="color: #32cd32; font-weight: bold;">${equipmentStats.totalOpened}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #fff;">Kept:</span>
          <span style="color: #32cd32; font-weight: bold;">${equipmentStats.kept}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #fff;">Disenchanted:</span>
          <span style="color: #ff6b6b; font-weight: bold;">${equipmentStats.disenchanted}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #fff;">Dust Gained:</span>
          <span style="color: #87ceeb; font-weight: bold;">${equipmentStats.dustGained.toLocaleString()}</span>
        </div>
      </div>
    `;
  }
  
  function updateStatusDisplay() {
    try {
      // Find the modal content area
      const modalTitle = findExaltationChestModal();
      if (!modalTitle) return;
      
      const exaltationModal = findExaltationChestModalContent();
      if (!exaltationModal) return;
      
      // Find the tooltip-prose section
      const tooltipProse = exaltationModal.querySelector('.tooltip-prose');
      if (!tooltipProse) return;
      
      // Update the status display
      const descriptionP = tooltipProse.querySelector('p.inline:not(.text-rarity-5)');
      if (descriptionP && descriptionP.innerHTML.includes('Total Opened:')) {
        descriptionP.innerHTML = createStatusDisplay();
      }
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error updating status display:', error);
    }
  }
  
  function addAutoAndSettingsButtons() {
    console.log('addAutoAndSettingsButtons called');
    
    // Find the specific exaltation chest modal (same logic as other functions)
    const modalTitles = document.querySelectorAll('h2.widget-top-text p');
    let modalTitle = null;
    
    for (const title of modalTitles) {
      if (title.textContent.includes('Exaltation Chest')) {
        modalTitle = title;
        break;
      }
    }
    
    console.log('modalTitle found:', !!modalTitle);
    console.log('modalTitle text:', modalTitle ? modalTitle.textContent : 'null');
    if (!modalTitle) {
      console.log('Not an exaltation chest modal, returning');
      return;
    }
    
    // Find the modal content area
    const exaltationModal = modalTitle.closest('.widget-top').nextElementSibling;
    console.log('exaltationModal found:', !!exaltationModal);
    if (!exaltationModal) return;
    
    const footer = exaltationModal.querySelector('.flex.justify-end.gap-2');
    console.log('footer found:', !!footer);
    console.log('footer already processed:', footer ? isProcessed(footer) : 'footer is null');
    
    if (!footer || isProcessed(footer)) {
      console.log('Footer not found or already processed, returning');
      return;
    }
    
    // Create Auto button (toggle button)
    const autoButton = document.createElement('button');
    autoButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
    autoButton.textContent = 'Auto';
    autoButton.id = 'better-exaltation-auto-btn';
    
    // Create Settings button
    const settingsButton = document.createElement('button');
    settingsButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
    settingsButton.textContent = 'Settings';
    settingsButton.id = 'better-exaltation-settings-btn';
    
    // Set initial state for Auto button (disabled/red)
    updateAutoButtonState(autoButton);
    
    // Insert buttons in correct order: Dust -> Auto -> Settings -> Close -> Open
    // Insert Settings first (will be last in the sequence)
    footer.insertBefore(settingsButton, footer.firstChild);
    // Insert Auto button (will be second to last)
    footer.insertBefore(autoButton, footer.firstChild);
    // Add dust display last (will be first in the sequence)
    injectDustDisplayIntoModal(footer);
    
    // Add event listeners using managed system
    addManagedEventListener(autoButton, 'click', handleAutoButtonClick);
    addManagedEventListener(settingsButton, 'click', handleSettingsButtonClick);
    
    console.log('Buttons created and added to footer');
    markAsProcessed(footer);
    console.log('Footer marked as processed');
  }
  
  function updateAutoButtonState(button) {
    if (autoModeEnabled) {
      // Enabled state - Green
      button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
      button.style.backgroundImage = 'url("https://bestiaryarena.com/_next/static/media/background-green.be515334.png")';
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
      button.style.backgroundRepeat = 'no-repeat';
    } else {
      // Disabled state - Red
      button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
      button.style.backgroundImage = 'url("https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png")';
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
      button.style.backgroundRepeat = 'no-repeat';
    }
  }
  
  function handleAutoButtonClick(event) {
    // Toggle auto mode
    autoModeEnabled = !autoModeEnabled;
    
    // Do NOT save to localStorage - auto button should always default to disabled
    
    // Update button appearance
    updateAutoButtonState(event.target);
    
    // Log state change
    console.log(`Auto mode ${autoModeEnabled ? 'enabled' : 'disabled'}`);
    
    // Start or stop auto-opening based on new state
    if (autoModeEnabled) {
      startAutoOpening();
    } else {
      stopAutoOpening();
    }
  }
  
  function handleSettingsButtonClick() {
    console.log('Settings button clicked');
    console.log('activeExaltationPanel state:', activeExaltationPanel ? 'exists' : 'null');
    
    // Check if settings panel is already open
    if (activeExaltationPanel) {
      console.log('Settings panel already open, closing it');
      cleanupExaltationPanel();
    } else {
      console.log('Opening settings panel');
      openExaltationSettingsPanel();
    }
  }
  
  // =======================
  // 4. Auto-Opening Functions
  // =======================
  
  function startAutoOpening() {
    console.log('[Better Exaltation Chest] Starting auto-opening');
    
    // Stop any existing interval
    stopAutoOpening();
    
    // Set up network interception to detect chest openings
    setupNetworkInterception();
    
    // Get the current auto-open speed
    const autoOpenSpeed = loadSetting(STORAGE_KEYS.AUTO_OPEN_SPEED, 2000);
    
    // Click the Open button immediately
    clickOpenButton();
    
    // Start the interval to continue clicking the Open button
    autoOpenInterval = setInterval(() => {
      clickOpenButton();
    }, autoOpenSpeed);
    
    // Set up observer to detect when modal closes
    setupModalCloseObserver();
    
    console.log(`[Better Exaltation Chest] Auto-opening started with immediate click, then ${autoOpenSpeed}ms interval`);
  }
  
  function stopAutoOpening() {
    if (autoOpenInterval) {
      console.log('[Better Exaltation Chest] Stopping auto-opening');
      clearInterval(autoOpenInterval);
      autoOpenInterval = null;
    }
    
    // Clean up modal close observer
    if (modalCloseObserver) {
      modalCloseObserver.disconnect();
      modalCloseObserver = null;
    }
    
    // Remove network interception
    removeNetworkInterception();
    
    // Clear any pending equipment checks
    if (equipmentCheckTimeout) {
      clearTimeout(equipmentCheckTimeout);
      equipmentCheckTimeout = null;
    }
  }
  
  function clickOpenButton() {
    try {
      // Find the Open button in the current exaltation chest modal
      const openButton = findOpenButton();
      
      if (openButton) {
        console.log('[Better Exaltation Chest] Clicking Open button');
        openButton.click();
      } else {
        console.log('[Better Exaltation Chest] Open button not found, stopping auto-opening');
        stopAutoOpening();
        // Reset auto button to disabled state
        autoModeEnabled = false;
        const autoButton = document.getElementById('better-exaltation-auto-btn');
        if (autoButton) {
          updateAutoButtonState(autoButton);
        }
      }
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error clicking Open button:', error);
      stopAutoOpening();
    }
  }
  
  function findOpenButton() {
    // Find the exaltation chest modal first
    const modalTitle = findExaltationChestModal();
    if (!modalTitle) {
      return null;
    }
    
    // Find the modal content area
    const exaltationModal = findExaltationChestModalContent();
    if (!exaltationModal) {
      return null;
    }
    
    // Find the Open button (the green button with the package icon)
    const openButton = exaltationModal.querySelector('button[data-state="closed"]');
    
    return openButton;
  }
  
  function setupModalCloseObserver() {
    // Clean up existing observer
    if (modalCloseObserver) {
      modalCloseObserver.disconnect();
      modalCloseObserver = null;
    }
    
    // Find the exaltation chest modal
    const modalTitle = findExaltationChestModal();
    if (!modalTitle) {
      console.log('[Better Exaltation Chest] Modal not found for close observer');
      return;
    }
    
    // Find the modal element
    const modal = modalTitle.closest('[role="dialog"]');
    if (!modal) {
      console.log('[Better Exaltation Chest] Modal dialog not found for close observer');
      return;
    }
    
    // Set up observer to detect when modal is closed
    modalCloseObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check if the modal was removed from the DOM
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node === modal) {
              console.log('[Better Exaltation Chest] Modal closed, stopping auto-opening');
              stopAutoOpening();
              // Reset auto button to disabled state
              autoModeEnabled = false;
              const autoButton = document.getElementById('better-exaltation-auto-btn');
              if (autoButton) {
                updateAutoButtonState(autoButton);
              }
            }
          });
        }
        
        // Check if the modal's data-state changed to closed
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const newState = modal.getAttribute('data-state');
          if (newState === 'closed' || !newState) {
            console.log('[Better Exaltation Chest] Modal state changed to closed, stopping auto-opening');
            stopAutoOpening();
            // Reset auto button to disabled state
            autoModeEnabled = false;
            const autoButton = document.getElementById('better-exaltation-auto-btn');
            if (autoButton) {
              updateAutoButtonState(autoButton);
            }
          }
        }
      });
    });
    
    // Observe the modal and its parent for changes
    modalCloseObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state']
    });
    
    // Also observe the modal itself for attribute changes
    modalCloseObserver.observe(modal, {
      attributes: true,
      attributeFilter: ['data-state']
    });
  }
  
  function disableAutoOpeningIfActive() {
    if (autoModeEnabled) {
      console.log('[Better Exaltation Chest] Settings changed, disabling auto-opening');
      stopAutoOpening();
      autoModeEnabled = false;
      
      // Update the auto button appearance
      const autoButton = document.getElementById('better-exaltation-auto-btn');
      if (autoButton) {
        updateAutoButtonState(autoButton);
      }
    }
  }
  
  // =======================
  // 5. Equipment Filtering Functions
  // =======================
  
  
  
  function getEquipmentDetailsFromChestResponse(equipData) {
    try {
      if (!equipData || !equipData.gameId) {
        return null;
      }
      
      // Get equipment name from game data
      let equipmentName = `Equipment ID ${equipData.gameId}`;
      try {
        const equipDataFromGame = globalThis.state?.utils?.getEquipment(equipData.gameId);
        if (equipDataFromGame && equipDataFromGame.metadata && equipDataFromGame.metadata.name) {
          equipmentName = equipDataFromGame.metadata.name;
          console.log(`[Better Exaltation Chest] 🔍 Translated gameId ${equipData.gameId} to equipment: "${equipmentName}"`);
        } else {
          console.warn(`[Better Exaltation Chest] ⚠️ Could not find equipment data for gameId ${equipData.gameId}`);
        }
      } catch (e) {
        console.warn(`[Better Exaltation Chest] ⚠️ Error getting equipment name for gameId ${equipData.gameId}:`, e);
      }
      
      return {
        id: equipData.id,
        name: equipmentName,
        tier: equipData.tier || 1,
        stat: equipData.stat || 'unknown',
        gameId: equipData.gameId
      };
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error getting equipment details from chest response:', error);
      return null;
    }
  }
  
  
  
  function checkTierRequirement(requirement, actualTier) {
    switch (requirement) {
      case '≥T1': return actualTier >= 1;
      case '≥T2': return actualTier >= 2;
      case '≥T3': return actualTier >= 3;
      case '≥T4': return actualTier >= 4;
      case 'T5': return actualTier === 5;
      default: return true;
    }
  }
  
  // Unified equipment checking function
  function checkEquipmentAgainstSettings(equipment, options = {}) {
    const { 
      updateStats = false, 
      logPrefix = '', 
      logSuffix = '' 
    } = options;
    
    try {
      if (!equipment) {
        console.log(`[Better Exaltation Chest] ${logPrefix}Equipment not found${logSuffix}`);
        return { matches: false, reason: 'Equipment not found' };
      }
      
      console.log(`[Better Exaltation Chest] ${logPrefix}Opened equipment:`, {
        name: equipment.name,
        tier: equipment.tier,
        stat: equipment.stat,
        gameId: equipment.gameId,
        ...(equipment.id && { id: equipment.id })
      });
      
      if (equipment.id) {
        console.log(`[Better Exaltation Chest] 📋 Equipment Summary: ${equipment.name} (T${equipment.tier} ${equipment.stat}) - GameID: ${equipment.gameId}`);
      }
      
      // Update total opened count if requested
      if (updateStats) {
        equipmentStats.totalOpened++;
        
        // Log the equipment opening
        const logEntry = {
          timestamp: new Date().toISOString(),
          equipment: {
            name: equipment.name || 'Unknown',
            tier: equipment.tier || 0,
            stat: equipment.stat || 'Unknown',
            gameId: equipment.gameId || 0,
            id: equipment.id || 0
          },
          action: 'opened',
          dustGained: 0
        };
        equipmentLog.push(logEntry);
      }
      
      // Check against each equipment setup rule
      for (const setup of equipmentSetup) {
        // Check equipment type
        if (setup.equipment !== 'All' && setup.equipment !== equipment.name) {
          continue;
        }
        
        // Check tier requirement
        if (setup.tier !== 'All') {
          const tierMatch = checkTierRequirement(setup.tier, equipment.tier);
          if (!tierMatch) {
            continue;
          }
        }
        
        // Check stat requirement
        if (setup.stat !== 'All' && setup.stat !== equipment.stat) {
          continue;
        }
        
        // If we reach here, this setup rule matches
        console.log('[Better Exaltation Chest] ✅ Equipment matches setup rule:', setup);
        
        if (updateStats) {
          equipmentStats.kept++;
          updateStatusDisplay();
          
          // Update the last log entry to mark as kept
          if (equipmentLog.length > 0) {
            const lastEntry = equipmentLog[equipmentLog.length - 1];
            if (lastEntry.equipment.id === equipment.id && lastEntry.action === 'opened') {
              lastEntry.action = 'kept';
              lastEntry.matchedRule = setup;
            }
          }
        }
        
        return { matches: true, matchedRule: setup, equipment: equipment };
      }
      
      // No rules matched
      console.log('[Better Exaltation Chest] ❌ Equipment does not match any setup rules');
      
      if (updateStats) {
        equipmentStats.disenchanted++;
        updateStatusDisplay();
        
        // Update the last log entry to mark as disenchanted
        if (equipmentLog.length > 0) {
          const lastEntry = equipmentLog[equipmentLog.length - 1];
          if (lastEntry.equipment.id === equipment.id && lastEntry.action === 'opened') {
            lastEntry.action = 'disenchanted';
            lastEntry.reason = 'No matching setup rules';
          }
        }
      }
      
      return { matches: false, reason: 'No matching setup rules', equipment: equipment };
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error checking equipment against settings:', error);
      return { matches: false, reason: 'Error checking equipment' };
    }
  }
  
  function disenchantEquipment(equipmentId) {
    return new Promise((resolve, reject) => {
      try {
        const payload = {
          "0": {
            "json": equipmentId
          }
        };
        
        fetch('https://bestiaryarena.com/api/trpc/game.equipToDust?batch=1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Game-Version': '1'
          },
          body: JSON.stringify(payload)
        })
        .then(response => {
          if (!response.ok) {
            if (response.status === 404) {
              return { success: false, status: 404, message: 'Equipment not found' };
            }
            if (response.status === 429) {
              return { success: false, status: 429, message: 'Rate limited' };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          try {
            if (data && data.success === false) {
              resolve(data);
              return;
            }
            
            const result = data[0]?.result?.data?.json;
            if (result && result.dustDiff !== undefined) {
              console.log('[Better Exaltation Chest] ✅ Equipment disenchanted successfully:', equipmentId, 'Dust gained:', result.dustDiff);
              resolve({
                success: true,
                dustGained: result.dustDiff
              });
            } else {
              console.warn('[Better Exaltation Chest] ⚠️ Disenchant response unexpected format:', data);
              resolve({
                success: false,
                error: 'Invalid response format'
              });
            }
          } catch (parseError) {
            console.error('[Better Exaltation Chest] ❌ Error parsing disenchant response:', parseError);
            resolve({
              success: false,
              error: 'Failed to parse response'
            });
          }
        })
        .catch(error => {
          console.error('[Better Exaltation Chest] ❌ Error disenchanting equipment:', error);
          resolve({ success: false, error: error.message });
        });
      } catch (error) {
        console.error('[Better Exaltation Chest] ❌ Error in disenchantEquipment:', error);
        resolve({ success: false, error: error.message });
      }
    });
  }
  
  
  function handleOpenedEquipmentFromChestResponse(equipData) {
    if (!autoModeEnabled) {
      return; // Only process if auto-opening is active
    }
    
    // Clear any existing timeout
    if (equipmentCheckTimeout) {
      clearTimeout(equipmentCheckTimeout);
    }
    
    // Check equipment against settings immediately using chest response data
    equipmentCheckTimeout = setTimeout(() => {
      const equipment = getEquipmentDetailsFromChestResponse(equipData);
      const checkResult = checkEquipmentAgainstSettings(equipment, { 
        updateStats: true, 
        logPrefix: '📦 ' 
      });
      
      if (!checkResult.matches) {
        console.log('[Better Exaltation Chest] 🔄 Auto-disenchanting equipment that does not match settings');
        disenchantEquipment(equipData.id)
          .then(result => {
            if (result.success) {
              console.log('[Better Exaltation Chest] ✅ Equipment auto-disenchanted successfully');
              
              // Update stats tracking, logs, and dust display
              if (result.dustGained && result.dustGained > 0) {
                console.log('[Better Exaltation Chest] 💰 Dust gained from disenchanting:', result.dustGained);
                equipmentStats.dustGained += result.dustGained;
                updateStatusDisplay();
                
                // Update player state with new dust amount
                try {
                  const player = globalThis.state?.player;
                  if (player) {
                    player.send({
                      type: "setState",
                      fn: (prev) => ({
                        ...prev,
                        dust: (prev.dust || 0) + result.dustGained
                      }),
                    });
                    console.log('[Better Exaltation Chest] Player state updated with dust gain:', result.dustGained);
                  }
                } catch (e) {
                  console.warn('[Better Exaltation Chest] Failed to update player state:', e);
                }
                
                // Manually update dust display with animation (state updates don't reliably trigger subscription)
                updateDustDisplayWithAnimation(result.dustGained);
                
                // Update the log entry with dust gained
                if (equipmentLog.length > 0) {
                  const lastEntry = equipmentLog[equipmentLog.length - 1];
                  if (lastEntry.equipment.id === equipData.id && lastEntry.action === 'disenchanted') {
                    lastEntry.dustGained = result.dustGained;
                  }
                }
              }
            } else {
              console.warn('[Better Exaltation Chest] ⚠️ Failed to auto-disenchant equipment:', result.error);
            }
          });
      } else {
        console.log('[Better Exaltation Chest] ✅ Equipment matches settings, keeping it');
      }
    }, 100); // Shorter delay since we don't need to wait for inventory update
  }
  
  // =======================
  // 6. Network Interception Functions
  // =======================
  
  function setupNetworkInterception() {
    if (originalFetch) {
      return; // Already set up
    }
    
    originalFetch = window.fetch;
    
    window.fetch = function(...args) {
      const [url, options] = args;
      
      // Check if this is a chest opening request
      if (typeof url === 'string' && url.includes('inventory.equipChest')) {
        console.log('[Better Exaltation Chest] 🎁 Chest opening request detected');
        
        // Call the original fetch
        return originalFetch.apply(this, args)
          .then(response => {
            // Clone the response to read it without affecting the original
            const clonedResponse = response.clone();
            
            // Try to extract equipment data from the response
            clonedResponse.json()
              .then(data => {
                try {
                  if (data && data[0] && data[0].result && data[0].result.data && data[0].result.data.json) {
                    const equipData = data[0].result.data.json.equip;
                    if (equipData && equipData.id) {
                      console.log('[Better Exaltation Chest] 🎁 Chest opened, equipment ID:', equipData.id);
                      console.log('[Better Exaltation Chest] 🎁 Raw equipment data from chest:', {
                        id: equipData.id,
                        gameId: equipData.gameId,
                        stat: equipData.stat,
                        tier: equipData.tier
                      });
                      handleOpenedEquipmentFromChestResponse(equipData);
                    }
                  }
                } catch (error) {
                  console.warn('[Better Exaltation Chest] Error parsing chest response:', error);
                }
              })
              .catch(error => {
                console.warn('[Better Exaltation Chest] Error reading chest response:', error);
              });
            
            return response;
          });
      }
      
      // For all other requests, use the original fetch
      return originalFetch.apply(this, args);
    };
    
    console.log('[Better Exaltation Chest] Network interception set up');
  }
  
  function removeNetworkInterception() {
    if (originalFetch) {
      window.fetch = originalFetch;
      originalFetch = null;
      console.log('[Better Exaltation Chest] Network interception removed');
    }
  }
  
  // =======================
  // 7. Settings Panel Functions
  // =======================
  
  // Cleanup function for panel state
  function cleanupExaltationPanel() {
    try {
      console.log('[Better Exaltation Chest] cleanupExaltationPanel called, activeExaltationPanel:', activeExaltationPanel ? 'exists' : 'null');
      
      // Stop auto-opening when panel is closed
      stopAutoOpening();
      
      // Clean up ResizeObserver BEFORE removing the panel
      if (activeExaltationPanel) {
        const attachedModalId = activeExaltationPanel.dataset?.attachedModal;
        if (attachedModalId) {
          const modal = document.querySelector(`[data-attached-modal="${attachedModalId}"]`);
          if (modal && modal.dataset.resizeObserver) {
            modal.dataset.resizeObserver.disconnect();
            delete modal.dataset.resizeObserver;
          }
        }
        
        // Remove panel from DOM
        activeExaltationPanel.remove();
        activeExaltationPanel = null;
      }
      
      // Clean up modal observer
      if (modalObserver) {
        modalObserver.disconnect();
        modalObserver = null;
      }
      
      // Clean up resize listener
      if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
        resizeListener = null;
      }
      
      // Clean up reposition timeout
      if (repositionTimeout) {
        clearTimeout(repositionTimeout);
        repositionTimeout = null;
      }
      
      // Restore modal to original state
      restoreModalToOriginalState();
      
      // Remove ESC key listener
      if (escKeyListener) {
        document.removeEventListener('keydown', escKeyListener);
        escKeyListener = null;
      }
      
      // Reset panel state
      exaltationPanelInProgress = false;
      lastPanelCall = 0;
      
      console.log('[Better Exaltation Chest] Panel cleanup completed');
    } catch (error) {
      console.error('[Better Exaltation Chest] Error during panel cleanup:', error);
    }
  }
  
  // Restore modal to original state (no longer needed since we don't modify the modal)
  function restoreModalToOriginalState() {
    // No restoration needed since we don't modify the original modal anymore
  }
  
  // Disable modal's click-outside behavior temporarily
  function disableModalClickOutside(modal) {
    try {
      // Find the modal overlay (usually a sibling element)
      const modalOverlay = modal.previousElementSibling || modal.nextElementSibling;
      if (modalOverlay && modalOverlay.classList.contains('fixed') && modalOverlay.classList.contains('inset-0')) {
        // Store original click handler
        modalOverlay._originalClickHandler = modalOverlay.onclick;
        // Disable click handler
        modalOverlay.onclick = null;
        modalOverlay.style.pointerEvents = 'none';
        console.log('[Better Exaltation Chest] Modal click-outside behavior disabled');
      }
      
      // Add global click interceptor to prevent modal closing when clicking on our panel
      const globalClickInterceptor = (event) => {
        const target = event.target;
        const settingsPanel = document.getElementById('better-exaltation-settings-panel');
        
        // If click is on our settings panel or its children, prevent modal closing
        if (settingsPanel && (target === settingsPanel || settingsPanel.contains(target))) {
          event.stopPropagation();
          event.preventDefault();
          console.log('[Better Exaltation Chest] Click on settings panel intercepted');
          return false;
        }
      };
      
      // Store reference for cleanup
      modal._globalClickInterceptor = globalClickInterceptor;
      modal._globalClickInterceptorKeys = [
        addManagedEventListener(document, 'click', globalClickInterceptor, true),
        addManagedEventListener(document, 'mousedown', globalClickInterceptor, true)
      ];
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Could not disable modal click-outside:', error);
    }
  }
  
  // Re-enable modal's click-outside behavior
  function enableModalClickOutside(modal) {
    try {
      // Remove global click interceptor
      if (modal._globalClickInterceptor) {
        if (modal._globalClickInterceptorKeys) {
          modal._globalClickInterceptorKeys.forEach(key => {
            removeManagedEventListener(key);
          });
          delete modal._globalClickInterceptorKeys;
        }
        delete modal._globalClickInterceptor;
        console.log('[Better Exaltation Chest] Global click interceptor removed');
      }
      
      // Find the modal overlay (usually a sibling element)
      const modalOverlay = modal.previousElementSibling || modal.nextElementSibling;
      if (modalOverlay && modalOverlay.classList.contains('fixed') && modalOverlay.classList.contains('inset-0')) {
        // Restore original click handler
        if (modalOverlay._originalClickHandler) {
          modalOverlay.onclick = modalOverlay._originalClickHandler;
        }
        modalOverlay.style.pointerEvents = '';
        console.log('[Better Exaltation Chest] Modal click-outside behavior restored');
      }
    } catch (error) {
      console.warn('[Better Exaltation Chest] Could not restore modal click-outside:', error);
    }
  }
  
  // Open Exaltation Settings Panel
  function openExaltationSettingsPanel() {
    try {
      const now = Date.now();
      if (exaltationPanelInProgress) return;
      if (now - lastPanelCall < 500) return;
      
      lastPanelCall = now;
      exaltationPanelInProgress = true;
      
      // Clean up existing panel if any
      cleanupExaltationPanel();
      
      // Find the exaltation chest modal specifically
      const allOpenModals = document.querySelectorAll('div[role="dialog"][data-state="open"]');
      let exaltationModal = null;
      
      for (const modal of allOpenModals) {
        const titleElement = modal.querySelector('h2.widget-top-text p');
        if (titleElement && titleElement.textContent.includes('Exaltation Chest')) {
          exaltationModal = modal;
          break;
        }
      }
      
      if (!exaltationModal) {
        console.warn('[Better Exaltation Chest] No exaltation chest modal found');
        exaltationPanelInProgress = false;
        return;
      }
      
      console.log('[Better Exaltation Chest] Found exaltation chest modal');
      
      // Insert the settings panel next to the modal
      insertSettingsPanelNextToModal(exaltationModal);
      
      // Add ESC key support for closing panel
      escKeyListener = (event) => {
        if (event.key === 'Escape' && activeExaltationPanel) {
          console.log('[Better Exaltation Chest] ESC key pressed, closing panel');
          cleanupExaltationPanel();
        }
      };
      addManagedEventListener(document, 'keydown', escKeyListener);
      
      exaltationPanelInProgress = false;
      console.log('[Better Exaltation Chest] Settings panel opened');
      
    } catch (error) {
      console.error('[Better Exaltation Chest] Error in openExaltationSettingsPanel:', error);
      exaltationPanelInProgress = false;
    }
  }
  
  // Insert settings panel inside the modal
  function insertSettingsPanelNextToModal(modal) {
    // Check if panel already exists
    if (document.getElementById('better-exaltation-settings-panel')) {
      console.log('[Better Exaltation Chest] Settings panel already exists');
      return;
    }
    
    // Create the settings panel
    const panel = createExaltationSettingsPanel();
    
    // Position the panel to the right of the modal (but as a child of the modal)
    positionPanelInsideModal(panel, modal);
    
    // Insert the panel as a child of the modal's inner content
    // This ensures it's treated as part of the modal's DOM tree
    const modalContent = modal.querySelector('.widget-bottom') || modal;
    modalContent.appendChild(panel);
    activeExaltationPanel = panel;
    console.log('[Better Exaltation Chest] Panel created and activeExaltationPanel set');
    
    // Mark the panel as part of the modal system
    panel.setAttribute('data-modal-part', 'true');
    panel.setAttribute('data-attached-modal', modal.id || 'exaltation-modal');
    
    // Set up observer to detect when the modal is closed
    setupModalObserver(modal);
    
    // Set up resize listener to reposition panel when window resizes
    setupResizeListener(modal);
  }
  
  // Position panel inside the modal but visually to the right
  function positionPanelInsideModal(panel, modal) {
    const modalRect = modal.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Match the modal height instead of using fixed height
    const modalHeight = modalRect.height;
    
    // Calculate position to the right of the modal with no gap
    let left = modalRect.right; // No gap - panel touches modal
    let top = modalRect.top;
    
    // Ensure panel doesn't go off screen horizontally
    if (left + EXALTATION_PANEL_WIDTH > viewportWidth) {
      left = modalRect.left - EXALTATION_PANEL_WIDTH; // Position to the left instead
    }
    
    // Ensure panel doesn't go off screen vertically
    if (top + modalHeight > viewportHeight) {
      top = viewportHeight - modalHeight - 10;
    }
    
    if (top < 10) {
      top = 10;
    }
    
    // Ensure panel doesn't go off the left edge
    if (left < 10) {
      left = 10;
    }
    
    // Position the panel absolutely within the modal but visually outside it
    panel.style.position = 'absolute';
    panel.style.zIndex = '10001';
    panel.style.left = (left - modalRect.left) + 'px'; // Relative to modal
    panel.style.top = (top - modalRect.top) + 'px'; // Relative to modal
    panel.style.height = modalHeight + 'px'; // Match modal height
    
    // Store reference to modal for repositioning
    panel.dataset.attachedModal = modal.id || 'exaltation-modal';
  }
  
  // Set up observer to detect when the modal is closed
  function setupModalObserver(modal) {
    // Clean up existing observer
    if (modalObserver) {
      modalObserver.disconnect();
      modalObserver = null;
    }
    
    modalObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check if the modal was removed from the DOM
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node === modal) {
              console.log('[Better Exaltation Chest] Modal closed, cleaning up settings panel');
              cleanupExaltationPanel();
            }
          });
        }
        
        // Check if the modal's data-state changed to closed
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const newState = modal.getAttribute('data-state');
          if (newState === 'closed' || !newState) {
            console.log('[Better Exaltation Chest] Modal state changed to closed, cleaning up settings panel');
            cleanupExaltationPanel();
          }
        }
        
        // Reposition panel if modal moves (style changes) - debounced to reduce spam
        if (mutation.type === 'attributes' && mutation.attributeName === 'style' && activeExaltationPanel) {
          // Clear existing timeout
          if (repositionTimeout) {
            clearTimeout(repositionTimeout);
          }
          
          // Debounce repositioning to reduce log spam
          repositionTimeout = setTimeout(() => {
            if (activeExaltationPanel && modal.isConnected) {
              positionPanelInsideModal(activeExaltationPanel, modal);
            }
            repositionTimeout = null;
          }, 100); // Increased delay to reduce frequency
        }
      });
    });
    
    // Observe the modal and its parent for changes
    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'style']
    });
    
    // Also observe the modal itself for attribute changes
    modalObserver.observe(modal, {
      attributes: true,
      attributeFilter: ['data-state', 'style']
    });
  }
  
    // Set up resize listener to reposition panel when window resizes
    function setupResizeListener(modal) {
      // Clean up existing resize listener
      if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
        resizeListener = null;
      }
      
      resizeListener = () => {
        if (activeExaltationPanel && modal.isConnected) {
          positionPanelInsideModal(activeExaltationPanel, modal);
        }
      };
      
      addManagedEventListener(window, 'resize', resizeListener);
    
    // Also observe modal size changes
    const modalObserver = new ResizeObserver(() => {
      if (activeExaltationPanel && modal.isConnected) {
        positionPanelInsideModal(activeExaltationPanel, modal);
      }
    });
    modalObserver.observe(modal);
    
    // Store observer reference for cleanup
    modal.dataset.resizeObserver = modalObserver;
  }
  
  // Create the settings panel
  function createExaltationSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'better-exaltation-settings-panel';
    panel.style.cssText = `
      width: ${EXALTATION_PANEL_WIDTH}px;
      background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
      color: #fff;
      font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
      border: 4px solid transparent;
      border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 fill stretch;
      border-radius: 6px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Prevent clicks on the panel from bubbling up and closing it
    // But allow clicks on interactive elements (dropdowns, buttons, inputs)
    addManagedEventListener(panel, 'click', (event) => {
      const target = event.target;
      const isInteractiveElement = target.tagName === 'SELECT' || 
                                  target.tagName === 'BUTTON' || 
                                  target.tagName === 'INPUT' ||
                                  target.closest('select') ||
                                  target.closest('button') ||
                                  target.closest('input');
      
      if (!isInteractiveElement) {
        event.stopPropagation();
        event.preventDefault();
      }
    });
    
    // Prevent mousedown events from bubbling up (but allow for interactive elements)
    addManagedEventListener(panel, 'mousedown', (event) => {
      const target = event.target;
      const isInteractiveElement = target.tagName === 'SELECT' || 
                                  target.tagName === 'BUTTON' || 
                                  target.tagName === 'INPUT' ||
                                  target.closest('select') ||
                                  target.closest('button') ||
                                  target.closest('input');
      
      if (!isInteractiveElement) {
        event.stopPropagation();
        event.preventDefault();
      }
    });
    
    // Prevent mouseup events from bubbling up (but allow for interactive elements)
    addManagedEventListener(panel, 'mouseup', (event) => {
      const target = event.target;
      const isInteractiveElement = target.tagName === 'SELECT' || 
                                  target.tagName === 'BUTTON' || 
                                  target.tagName === 'INPUT' ||
                                  target.closest('select') ||
                                  target.closest('button') ||
                                  target.closest('input');
      
      if (!isInteractiveElement) {
        event.stopPropagation();
        event.preventDefault();
      }
    });
    
    // Create content area with 2-column layout
    const content = createExaltationSettingsContent();
    
    panel.appendChild(content);
    
    return panel;
  }
  
  // Create settings content with 2-column layout
  function createExaltationSettingsContent() {
    // Main container with 2-column layout
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
      display: flex;
      flex-direction: row;
      width: 100%;
      height: 100%;
      flex: 1;
      box-sizing: border-box;
      overflow: hidden;
    `;
    
    // Left column
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
      width: 35%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #444;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
    `;
    
    // Right column
    const rightColumn = document.createElement('div');
    rightColumn.style.cssText = `
      width: 65%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.1);
    `;
    
    // Left column content
    const leftContent = createLeftColumnContent();
    leftColumn.appendChild(leftContent);
    
    // Right column content
    const rightContent = createRightColumnContent();
    rightColumn.appendChild(rightContent);
    
    mainContainer.appendChild(leftColumn);
    mainContainer.appendChild(rightColumn);
    
    return mainContainer;
  }
  
  
  // Create left column content
  function createLeftColumnContent() {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      justify-content: space-between;
      align-items: center;
    `;
    
    // Top content wrapper
    const topContent = document.createElement('div');
    topContent.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    `;
    
    const title = document.createElement('h4');
    title.textContent = 'Auto Settings';
    title.className = 'pixel-font-14';
    title.style.cssText = `
      margin: 0 0 16px 0;
      color: #ffe066;
      font-weight: bold;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    topContent.appendChild(title);
    
    // Auto-open Speed setting
    const speedContainer = document.createElement('div');
    speedContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      margin-bottom: 16px;
      align-items: center;
    `;
    
    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Auto-open Speed:';
    speedLabel.style.cssText = `
      color: #fff;
      font-size: 12px;
      margin-bottom: 8px;
      text-align: center;
    `;
    speedContainer.appendChild(speedLabel);
    
    const speedControl = document.createElement('div');
    speedControl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      justify-content: center;
    `;
    
    const speedDecreaseBtn = document.createElement('button');
    speedDecreaseBtn.textContent = '-';
    speedDecreaseBtn.style.cssText = createButtonStyle('gray', `
      width: 24px;
      height: 24px;
      font-size: 14px;
    `);
    addClickAnimation(speedDecreaseBtn);
    
    const speedDisplay = document.createElement('span');
    speedDisplay.id = 'auto-open-speed-display';
    speedDisplay.textContent = '1000ms';
    speedDisplay.style.cssText = `
      color: #fff;
      font-size: 12px;
      min-width: 60px;
      text-align: center;
    `;
    
    const speedIncreaseBtn = document.createElement('button');
    speedIncreaseBtn.textContent = '+';
    speedIncreaseBtn.style.cssText = createButtonStyle('gray', `
      width: 24px;
      height: 24px;
      font-size: 14px;
    `);
    addClickAnimation(speedIncreaseBtn);
    
    // Auto-open speed state (load from localStorage, default: 2000ms)
    let autoOpenSpeed = loadSetting(STORAGE_KEYS.AUTO_OPEN_SPEED, 2000);
    
    // Update speed display
    function updateSpeedDisplay() {
      speedDisplay.textContent = `${autoOpenSpeed}ms`;
    }
    
    // Set initial display to loaded value
    updateSpeedDisplay();
    
    // Speed control event listeners
    addManagedEventListener(speedDecreaseBtn, 'click', (event) => {
      event.stopPropagation();
      if (autoOpenSpeed > 1000) {
        autoOpenSpeed -= 100;
        saveSetting(STORAGE_KEYS.AUTO_OPEN_SPEED, autoOpenSpeed);
        updateSpeedDisplay();
        disableAutoOpeningIfActive();
      }
    });
    
    addManagedEventListener(speedIncreaseBtn, 'click', (event) => {
      event.stopPropagation();
      if (autoOpenSpeed < 2000) {
        autoOpenSpeed += 100;
        saveSetting(STORAGE_KEYS.AUTO_OPEN_SPEED, autoOpenSpeed);
        updateSpeedDisplay();
        disableAutoOpeningIfActive();
      }
    });
    
    speedControl.appendChild(speedDecreaseBtn);
    speedControl.appendChild(speedDisplay);
    speedControl.appendChild(speedIncreaseBtn);
    speedContainer.appendChild(speedControl);
    topContent.appendChild(speedContainer);
    
    // Log buttons container
    const logButtonsContainer = document.createElement('div');
    logButtonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      align-items: center;
      gap: 8px;
    `;
    
    // Copy Log button
    const copyLogButton = document.createElement('button');
    copyLogButton.textContent = 'Copy Log';
    copyLogButton.style.cssText = createButtonStyle('green', `
      width: 100%;
      height: 32px;
      font-size: 12px;
    `);
    addClickAnimation(copyLogButton);
    addManagedEventListener(copyLogButton, 'click', async (event) => {
      event.stopPropagation();
      const summaryText = generateSummaryLogText();
      console.log('[Better Exaltation Chest] Generated summary text:', summaryText);
      const success = await copyToClipboard(summaryText);
      
      // Provide visual feedback
      const feedbackMessage = document.createElement('div');
      feedbackMessage.textContent = success ? 'Log copied!' : 'Failed to copy!';
      feedbackMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${success ? '#98C379' : '#E06C75'};
        color: #FFFFFF;
        padding: 8px 12px;
        border-radius: 5px;
        z-index: 10001;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(feedbackMessage);
      
      // Remove feedback after 2 seconds
      setTimeout(() => {
        if (feedbackMessage.parentNode) {
          feedbackMessage.parentNode.removeChild(feedbackMessage);
        }
      }, 2000);
    });
    
    // Clear Log button
    const clearLogButton = document.createElement('button');
    clearLogButton.textContent = 'Clear Log';
    clearLogButton.style.cssText = createButtonStyle('red', `
      width: 100%;
      height: 32px;
      font-size: 12px;
    `);
    addClickAnimation(clearLogButton);
    addManagedEventListener(clearLogButton, 'click', (event) => {
      event.stopPropagation();
      clearEquipmentLog();
      updateStatusDisplay();
      
      // Provide visual feedback
      const feedbackMessage = document.createElement('div');
      feedbackMessage.textContent = 'Log cleared!';
      feedbackMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #E06C75;
        color: #FFFFFF;
        padding: 8px 12px;
        border-radius: 5px;
        z-index: 10001;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(feedbackMessage);
      
      // Remove feedback after 2 seconds
      setTimeout(() => {
        if (feedbackMessage.parentNode) {
          feedbackMessage.parentNode.removeChild(feedbackMessage);
        }
      }, 2000);
    });
    
    logButtonsContainer.appendChild(copyLogButton);
    logButtonsContainer.appendChild(clearLogButton);
    
    // Add both containers to main container
    container.appendChild(topContent);
    container.appendChild(logButtonsContainer);
    
    return container;
  }
  
  // Create right column content with equipment setup
  function createRightColumnContent() {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      justify-content: flex-start;
      align-items: center;
    `;
    
    const title = document.createElement('h4');
    title.textContent = 'Chest Settings';
    title.className = 'pixel-font-14';
    title.style.cssText = `
      margin: 0 0 8px 0;
      color: #ffe066;
      font-weight: bold;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    container.appendChild(title);
    
    // Add description
    const description = document.createElement('div');
    description.textContent = 'Pick equipment, tiers to keep, and stats to keep';
    description.style.cssText = `
      margin: 0 0 12px 0;
      color: #ccc;
      font-size: 10px;
      text-align: center;
      font-style: italic;
    `;
    container.appendChild(description);
    
    // Equipment setup section
    const setupSection = createEquipmentSetupSection();
    container.appendChild(setupSection);
    
    return container;
  }
  
  // Create equipment setup section
  function createEquipmentSetupSection() {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      flex: 1;
      overflow-y: auto;
    `;
    
    
    // Equipment setup rows container
    const rowsContainer = document.createElement('div');
    rowsContainer.id = 'equipment-setup-rows';
    rowsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      overflow-y: auto;
    `;
    section.appendChild(rowsContainer);
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 8px;
    `;
    
    // Add button
    const addButton = document.createElement('button');
    addButton.textContent = '+';
    addButton.style.cssText = createButtonStyle('green', `
      flex: 7;
      height: 32px;
      font-size: 16px;
    `);
    addClickAnimation(addButton);
    addManagedEventListener(addButton, 'click', (event) => {
      event.stopPropagation();
      addEquipmentSetupRow(rowsContainer);
      disableAutoOpeningIfActive();
    });
    
    // Reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.style.cssText = createButtonStyle('red', `
      flex: 3;
      height: 32px;
      font-size: 12px;
    `);
    addClickAnimation(resetButton);
    addManagedEventListener(resetButton, 'click', (event) => {
      event.stopPropagation();
      resetEquipmentSetup(rowsContainer);
      disableAutoOpeningIfActive();
    });
    
    buttonContainer.appendChild(addButton);
    buttonContainer.appendChild(resetButton);
    section.appendChild(buttonContainer);
    
    // Load existing setup rows
    loadEquipmentSetupRows(rowsContainer);
    
    return section;
  }
  
  // Load existing equipment setup rows
  function loadEquipmentSetupRows(container) {
    // Clear existing rows
    container.innerHTML = '';
    
    // If no setup exists, add one default row
    if (equipmentSetup.length === 0) {
      addEquipmentSetupRow(container);
      // Save the default setup to localStorage
      saveEquipmentSetup();
    } else {
      // Load existing setup rows
      equipmentSetup.forEach((setup, index) => {
        addEquipmentSetupRow(container, setup, index);
      });
    }
  }
  
  // Add a new equipment setup row
  function addEquipmentSetupRow(container, setup = null, index = null) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 4px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 3px;
    `;
    
    // Equipment dropdown
    const equipmentSelect = document.createElement('select');
    equipmentSelect.style.cssText = createDropdownStyle(`
      flex: 1;
      height: 24px;
    `);
    
    // Populate equipment dropdown
    populateEquipmentDropdown(equipmentSelect);
    
    // Tier dropdown
    const tierSelect = document.createElement('select');
    tierSelect.style.cssText = createDropdownStyle(`
      width: 50px;
      height: 24px;
    `);
    
    // Populate tier dropdown
    ['All', '≥T2', '≥T3', '≥T4', 'T5'].forEach(tier => {
      const option = document.createElement('option');
      option.value = tier;
      option.textContent = tier;
      tierSelect.appendChild(option);
    });
    
    // Stat dropdown
    const statSelect = document.createElement('select');
    statSelect.style.cssText = createDropdownStyle(`
      width: 50px;
      height: 24px;
    `);
    
    // Populate stat dropdown
    ['All', 'HP', 'AD', 'AP'].forEach(stat => {
      const option = document.createElement('option');
      option.value = stat;
      option.textContent = stat;
      statSelect.appendChild(option);
    });
    
    // Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.style.cssText = createButtonStyle('red', `
      width: 24px;
      height: 24px;
      border-radius: 2px;
      font-size: 14px;
    `);
    addClickAnimation(removeButton);
    addManagedEventListener(removeButton, 'click', (event) => {
      event.stopPropagation();
      
      // Check if this is the last row
      const rowsContainer = document.getElementById('equipment-setup-rows');
      const existingRows = rowsContainer.querySelectorAll('div');
      
      if (existingRows.length <= 1) {
        // Reset the last row to default values instead of deleting it
        console.log('[Better Exaltation Chest] Resetting last row to default values');
        equipmentSelect.value = 'All';
        tierSelect.value = 'All';
        statSelect.value = 'All';
        saveEquipmentSetup();
        disableAutoOpeningIfActive();
      } else {
        // Remove the row if it's not the last one
        row.remove();
        saveEquipmentSetup();
        disableAutoOpeningIfActive();
      }
    });
    
    // Set initial values
    if (setup) {
      equipmentSelect.value = setup.equipment || 'All';
      tierSelect.value = setup.tier || 'All';
      statSelect.value = setup.stat || 'All';
    } else {
      // Default values when no setup provided
      equipmentSelect.value = 'All';
      tierSelect.value = 'All';
      statSelect.value = 'All';
    }
    
    // Add change listeners to save setup
    [equipmentSelect, tierSelect, statSelect].forEach(select => {
      addManagedEventListener(select, 'change', () => {
        saveEquipmentSetup();
        disableAutoOpeningIfActive();
      });
    });
    
    row.appendChild(equipmentSelect);
    row.appendChild(tierSelect);
    row.appendChild(statSelect);
    row.appendChild(removeButton);
    
    container.appendChild(row);
  }
  
  // Populate equipment dropdown with database
  function populateEquipmentDropdown(select) {
    // Add "All" option first
    const allOption = document.createElement('option');
    allOption.value = 'All';
    allOption.textContent = 'All';
    select.appendChild(allOption);
    
    // Equipment that cannot be obtained from exaltation chests
    const excludedEquipment = [
      'Amazon Armor',
      'Amazon Helmet', 
      'Amazon Shield',
      'Earthborn Titan Armor',
      'Fireborn Giant Armor',
      'Hailstorm Rod',
      'Paladin Armor',
      'Windborn Colossus Armor'
    ];
    
    // Get equipment from database
    const equipmentDatabase = window.equipmentDatabase;
    if (equipmentDatabase && equipmentDatabase.ALL_EQUIPMENT) {
      equipmentDatabase.ALL_EQUIPMENT
        .filter(equipment => !excludedEquipment.includes(equipment))
        .forEach(equipment => {
          const option = document.createElement('option');
          option.value = equipment;
          option.textContent = equipment;
          select.appendChild(option);
        });
    } else {
      // Fallback if database not available
      const fallbackOption = document.createElement('option');
      fallbackOption.value = '';
      fallbackOption.textContent = 'Database not loaded';
      select.appendChild(fallbackOption);
    }
  }
  
  // Save equipment setup to localStorage
  function saveEquipmentSetup() {
    const rowsContainer = document.getElementById('equipment-setup-rows');
    if (!rowsContainer) return;
    
    const rows = rowsContainer.querySelectorAll('div');
    const newSetup = [];
    
    rows.forEach(row => {
      const equipmentSelect = row.querySelector('select:nth-child(1)');
      const tierSelect = row.querySelector('select:nth-child(2)');
      const statSelect = row.querySelector('select:nth-child(3)');
      
      if (equipmentSelect && tierSelect && statSelect) {
        newSetup.push({
          equipment: equipmentSelect.value,
          tier: tierSelect.value,
          stat: statSelect.value
        });
      }
    });
    
    equipmentSetup = newSetup;
    saveSetting(STORAGE_KEYS.EQUIPMENT_SETUP, equipmentSetup);
  }
  
  // Reset equipment setup to default (single row with "All" selections)
  function resetEquipmentSetup(container) {
    // Clear all existing rows
    container.innerHTML = '';
    
    // Reset the equipment setup array to default "All/All/All"
    equipmentSetup = [{ equipment: 'All', tier: 'All', stat: 'All' }];
    
    // Add one default row
    addEquipmentSetupRow(container);
    
    // Save the reset state
    saveSetting(STORAGE_KEYS.EQUIPMENT_SETUP, equipmentSetup);
    
    console.log('[Better Exaltation Chest] Equipment setup reset to default: All/All/All');
  }
  
  // =======================
  // 8. Dust Display Functions
  // =======================
  
  function injectDustDisplayIntoModal(footer) {
    try {
      console.log('injectDustDisplayIntoModal called');
      
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const currentDust = Number(playerContext?.dust) || 0;
      console.log('Current dust:', currentDust);
      
      // Check if dust display already exists
      if (document.getElementById('better-exaltation-dust-display')) {
        console.log('Dust display already exists, skipping');
        return;
      }
      
      const dustDisplay = document.createElement('div');
      dustDisplay.className = 'pixel-font-16 frame-pressed-1 surface-darker flex items-center justify-end gap-1 px-1.5 pb-px text-right text-whiteRegular mr-auto';
      dustDisplay.id = 'better-exaltation-dust-display';
      
      const dustIcon = document.createElement('img');
      dustIcon.src = '/assets/icons/dust.png';
      dustIcon.alt = 'Dust';
      dustIcon.className = 'w-4 h-4 pixelated';
      
      const dustAmount = document.createElement('span');
      dustAmount.id = 'better-exaltation-dust-amount';
      dustAmount.textContent = currentDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      
      dustDisplay.appendChild(dustIcon);
      dustDisplay.appendChild(dustAmount);
      
      // Insert dust display at the beginning of the footer
      footer.insertBefore(dustDisplay, footer.firstChild);
      
      // Subscribe to dust changes only (optimized with select)
      if (globalThis.state?.player?.select) {
        let previousDust = currentDust;
        let isFirstCallback = true;
        
        // Create a targeted subscription that only watches dust
        const subscription = globalThis.state.player
          .select((state) => state.context?.dust)
          .subscribe((newDust) => {
            const numericDust = Number(newDust) || 0;
            
            // Skip the initial callback that fires immediately on subscribe
            if (isFirstCallback) {
              isFirstCallback = false;
              previousDust = numericDust;
              return;
            }
            
            const dustChange = numericDust - previousDust;
            
            if (dustChange > 0) {
              updateDustDisplayWithAnimation(dustChange);
            } else if (dustChange < 0 || numericDust !== previousDust) {
              // Update display for dust decreases or other changes
              const dustAmountElement = document.getElementById('better-exaltation-dust-amount');
              if (dustAmountElement) {
                dustAmountElement.textContent = numericDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              }
            }
            
            previousDust = numericDust;
          });
        
        dustDisplay._unsubscribe = subscription.unsubscribe;
      }
      
      console.log('Dust display injected successfully');
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error injecting dust display:', error);
    }
  }
  
  function updateDustDisplay() {
    try {
      const dustAmountElement = document.getElementById('better-exaltation-dust-amount');
      if (dustAmountElement) {
        const playerContext = globalThis.state?.player?.getSnapshot()?.context;
        const currentDust = Number(playerContext?.dust) || 0;
        dustAmountElement.textContent = currentDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error updating dust display:', error);
    }
  }
  
  function animateDustCount(startValue, endValue, duration = 500) {
    try {
      const dustAmountElement = document.getElementById('better-exaltation-dust-amount');
      if (!dustAmountElement) return;
      
      const startTime = Date.now();
      const difference = endValue - startValue;
      
      function updateCount() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.round(startValue + (difference * progress));
        
        dustAmountElement.textContent = currentValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        if (progress < 1) {
          requestAnimationFrame(updateCount);
        }
        
        // Flash green when gaining dust
        if (difference > 0 && progress > 0.5) {
          dustAmountElement.style.color = '#32cd32';
          setTimeout(() => {
            dustAmountElement.style.color = '';
          }, 300);
        }
      }
      
      updateCount();
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error animating dust count:', error);
      updateDustDisplay();
    }
  }
  
  function updateDustDisplayWithAnimation(dustChange = 0) {
    try {
      console.log('[Better Exaltation Chest] updateDustDisplayWithAnimation called with:', dustChange);
      
      const numericDustChange = Number(dustChange) || 0;
      const dustAmountElement = document.getElementById('better-exaltation-dust-amount');
      
      if (!dustAmountElement) {
        console.log('[Better Exaltation Chest] Dust amount element not found, calling updateDustDisplay');
        updateDustDisplay();
        return;
      }
      
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const currentDust = Number(playerContext?.dust) || 0;
      
      if (numericDustChange !== 0) {
        const startValue = currentDust - numericDustChange;
        const endValue = currentDust;
        console.log('[Better Exaltation Chest] Animating dust from', startValue, 'to', endValue);
        animateDustCount(startValue, endValue, 800);
      } else {
        dustAmountElement.textContent = currentDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error updating dust display with animation:', error);
      updateDustDisplay();
    }
  }
  
  function cleanupDustDisplay() {
    try {
      const dustDisplay = document.getElementById('better-exaltation-dust-display');
      if (dustDisplay && dustDisplay._unsubscribe) {
        dustDisplay._unsubscribe();
        dustDisplay._unsubscribe = null;
      }
    } catch (error) {
      console.warn('[Better Exaltation Chest] Error cleaning up dust display:', error);
    }
  }
  
  function enhanceExaltationChestModal() {
    console.log('enhanceExaltationChestModal called');
    
    // Debug: Check all modal titles on the page
    const allModalTitles = document.querySelectorAll('h2.widget-top-text p');
    console.log('All modal titles found:', allModalTitles.length);
    allModalTitles.forEach((title, index) => {
      console.log(`Modal ${index + 1}: "${title.textContent}"`);
    });
    
    // Check if this is an exaltation chest modal first - find the specific one
    const modalTitle = findExaltationChestModal();
    
    console.log('modalTitle found:', !!modalTitle);
    console.log('modalTitle text:', modalTitle ? modalTitle.textContent : 'null');
    if (!modalTitle) {
      console.log('Not an exaltation chest modal, returning false');
      return false;
    }
    
    // Find the modal content area
    const exaltationModal = findExaltationChestModalContent();
    console.log('exaltationModal found:', !!exaltationModal);
    if (!exaltationModal) {
      console.log('No exaltation modal content found, returning false');
      return false;
    }
    
    // Check if already processed
    if (isProcessed(exaltationModal)) {
      console.log('Modal already processed, returning true');
      return true;
    }
    
    try {
      console.log('Enhancing exaltation chest title');
      enhanceExaltationChestTitle();
      console.log('Replacing modal description with status display');
      replaceModalDescriptionWithStatus();
      console.log('Adding auto and settings buttons');
      addAutoAndSettingsButtons();
      markAsProcessed(exaltationModal);
      console.log('Modal enhanced successfully');
      return true;
    } catch (e) {
      console.log('Error enhancing modal:', e);
      return false;
    }
  }
  
  // Retry mechanism for modal enhancement (similar to Better Yasir)
  function retryEnhanceExaltationChestModal(maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS, baseDelay = CONSTANTS.RETRY_BASE_DELAY) {
    let attempts = 0;
    
    const tryEnhance = () => {
      attempts++;
      console.log(`Retry attempt ${attempts}/${maxAttempts}`);
      
      if (enhanceExaltationChestModal()) {
        console.log('Modal enhancement successful');
        return; // Success, stop retrying
      }
      
      if (attempts < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        setTimeout(tryEnhance, delay);
      } else {
        console.warn('[Better Exaltation Chest] Failed to enhance modal after maximum retry attempts');
      }
    };
    
    // Add a small initial delay to ensure modal is fully rendered
    console.log('Starting retry mechanism with initial 50ms delay');
    setTimeout(tryEnhance, 50);
  }
  
  // =======================
  // 9. Observer & Initialization
  // =======================
  
  let observer = null;
  let observerTimeout = null;
  let beforeUnloadListener = null;
  let domContentLoadedListener = null;
  const DEBOUNCE_DELAY = 50;
  
  function initializeObserver() {
    if (observer) {
      observer.disconnect();
    }
    
    observer = new MutationObserver((mutations) => {
      // Early content filtering - only process if exaltation chest content exists
      const hasExaltationChestContent = mutations.some(mutation => 
        mutation.addedNodes.length > 0 && 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.textContent?.includes('Exaltation Chest') || 
           node.querySelector?.('*') && 
           Array.from(node.querySelectorAll('*')).some(el => 
             el.textContent?.includes('Exaltation Chest')
           ))
        )
      );
      
      // Skip processing if no relevant content
      if (!hasExaltationChestContent) return;
      
      // Debounce processing
      if (observerTimeout) {
        clearTimeout(observerTimeout);
      }
      
      observerTimeout = setTimeout(() => {
        console.log('[Better Exaltation Chest] Exaltation chest modal detected, enhancing...');
        retryEnhanceExaltationChestModal();
      }, DEBOUNCE_DELAY);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  function cleanup() {
    // Clean up all managed event listeners first
    cleanupAllEventListeners();
    
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (observerTimeout) {
      clearTimeout(observerTimeout);
      observerTimeout = null;
    }
    
    // Stop auto-opening
    stopAutoOpening();
    
    // Remove network interception
    removeNetworkInterception();
    
    // Clean up dust display subscription
    cleanupDustDisplay();
    
    // Clean up panel state
    cleanupExaltationPanel();
    
    // Clean up global event listeners
    if (beforeUnloadListener) {
      window.removeEventListener('beforeunload', beforeUnloadListener);
      beforeUnloadListener = null;
    }
    if (domContentLoadedListener) {
      document.removeEventListener('DOMContentLoaded', domContentLoadedListener);
      domContentLoadedListener = null;
    }
  }
  
  function initializeBetterExaltationChest() {
    console.log('initializeBetterExaltationChest called, config.enabled:', config.enabled);
    if (!config.enabled) return;
    
    // Set up observer for dynamic content - only process when modals appear
    console.log('Initializing observer');
    initializeObserver();
    
    // Cleanup on page unload
    beforeUnloadListener = cleanup;
    window.addEventListener('beforeunload', beforeUnloadListener);
    console.log('Better Exaltation Chest mod initialized');
  }
  
  // =======================
  // 10. Exports and Cleanup
  // =======================
  
  // Export cleanup function for when mod is disabled
  exports = {
    cleanup: cleanup,
    updateConfig: (newConfig) => {
      Object.assign(config, newConfig);
    }
  };
  
  // =======================
  // 11. Start Mod
  // =======================
  
  if (document.readyState === 'loading') {
    domContentLoadedListener = initializeBetterExaltationChest;
    document.addEventListener('DOMContentLoaded', domContentLoadedListener);
  } else {
    initializeBetterExaltationChest();
  }
  
})();
