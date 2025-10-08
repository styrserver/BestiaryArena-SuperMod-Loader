// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Better Setups] initializing...');

// Configuration constants
const defaultConfig = {
  enabled: false
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Default setup labels
const DEFAULT_LABELS = ["Farm", "Speedrun", "Rank Points", "Boosted Map", "Other"];

// Global observer for setup interface changes
let setupInterfaceObserver = null;

// Media URLs from media.txt
const MEDIA_URLS = {
  BACKGROUND_BLUE: 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png',
  BORDER_BLUE: 'https://bestiaryarena.com/_next/static/media/1-frame-blue.cf300a6a.png',
  BACKGROUND_GREEN: 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png',
  BORDER_GREEN: 'https://bestiaryarena.com/_next/static/media/1-frame-green.fe32d59c.png',
  BACKGROUND_RED: 'https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png',
  BORDER_RED: 'https://bestiaryarena.com/_next/static/media/1-frame-red.946aade9.png',
  BACKGROUND_REGULAR: 'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png',
  BORDER_REGULAR: 'https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png',
  BACKGROUND_DARK: 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png',
  BACKGROUND_DARKER: 'https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png'
};

// Button styling constants
const BUTTON_STYLES = {
  BASE: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  EDIT: {
    backgroundImage: `url("${MEDIA_URLS.BACKGROUND_BLUE}"), url("${MEDIA_URLS.BORDER_BLUE}")`,
    backgroundSize: 'auto, 100% 100%',
    backgroundPosition: 'top left, center',
    backgroundRepeat: 'repeat, no-repeat',
    color: '#fff'
  },
  ADD: {
    backgroundImage: `url("${MEDIA_URLS.BACKGROUND_GREEN}"), url("${MEDIA_URLS.BORDER_GREEN}")`,
    backgroundSize: 'auto, 100% 100%',
    backgroundPosition: 'top left, center',
    backgroundRepeat: 'repeat, no-repeat',
    color: '#fff'
  },
  REMOVE: {
    backgroundImage: `url("${MEDIA_URLS.BACKGROUND_RED}"), url("${MEDIA_URLS.BORDER_RED}")`,
    backgroundSize: 'auto, 100% 100%',
    backgroundPosition: 'top left, center',
    backgroundRepeat: 'repeat, no-repeat',
    color: '#fff'
  }
};

// Storage keys for setup data
const STORAGE_KEYS = {
  SETUP_LABELS: 'stored-setup-labels',
  STORED_SETUPS: 'stored-setups'
};

// =======================
// 2. Initialization & Lifecycle
// =======================

// Wait for game to be ready before activating setup labels
function waitForGameAndActivate() {
  // Check if the game state is available and the game is fully loaded
  if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player) {
    console.log('[Better Setups] Game state detected, starting immediate initialization...');
    
    // Start the MutationObserver immediately for faster detection
    startSetupInterfaceObserver();
    
    // Activate setups immediately
    activateSetups();
    
    // Try immediate injection, then fallback with shorter delays
    if (!processSetupInterface()) {
      console.log('[Better Setups] Setup interface not ready, trying with shorter delays...');
      
      // Try multiple times with increasing delays for faster detection
      const tryInjection = (attempt = 1) => {
        if (attempt > 10) {
          console.log('[Better Setups] Max injection attempts reached, MutationObserver will handle it');
          return;
        }
        
        if (processSetupInterface()) {
          console.log(`[Better Setups] Setup interface found on attempt ${attempt}`);
          return;
        }
        
        // Try again with increasing delay (100ms, 200ms, 300ms, etc.)
        setTimeout(() => tryInjection(attempt + 1), attempt * 100);
      };
      
      tryInjection();
    } else {
      console.log('[Better Setups] Setup interface found immediately!');
    }
  } else {
    console.log('[Better Setups] Game state not ready, waiting...');
    setTimeout(waitForGameAndActivate, 500); // Reduced from 1000ms to 500ms
  }
}

// Start early initialization attempts for faster button injection
console.log('[Better Setups] Starting early initialization attempts...');

// Try immediate initialization first
if (processSetupInterface()) {
  console.log('[Better Setups] Setup interface found immediately on startup!');
  // Start observer for future changes
  startSetupInterfaceObserver();
} else {
  console.log('[Better Setups] Setup interface not ready, starting fast polling...');
  
  // Start fast polling immediately
  let earlyAttempts = 0;
  const earlyMaxAttempts = 30; // Try for 3 seconds with 100ms intervals
  
  const earlyPoll = () => {
    earlyAttempts++;
    
    if (processSetupInterface()) {
      console.log(`[Better Setups] Setup interface found after ${earlyAttempts} early polling attempts`);
      startSetupInterfaceObserver();
      return;
    }
    
    if (earlyAttempts < earlyMaxAttempts) {
      setTimeout(earlyPoll, 100);
    } else {
      console.log('[Better Setups] Early polling completed, switching to game state waiting');
      // Fall back to game state waiting
      waitForGameAndActivate();
    }
  };
  
  earlyPoll();
}

// Also start the game state waiting as a backup
waitForGameAndActivate();

// =======================
// 3. Core Setup Management
// =======================

// Main mod functionality
function activateSetups() {
  console.log('[Better Setups] activateSetups() called');
  
  try {
    // Check if stored setups are already enabled
    const storedSetupsEnabled = window.localStorage.getItem(STORAGE_KEYS.STORED_SETUPS);
    const existingLabels = window.localStorage.getItem(STORAGE_KEYS.SETUP_LABELS);
    const defaultLabels = [...DEFAULT_LABELS];
    
    console.log('[Better Setups] Checking stored-setups flag:', storedSetupsEnabled);
    console.log('[Better Setups] Checking existing labels:', existingLabels);
    console.log('[Better Setups] Default labels to set:', defaultLabels);
    
    let message = '';
    let labelsToSet = defaultLabels;
    
    if (storedSetupsEnabled === 'true' && existingLabels) {
      try {
        const parsedLabels = JSON.parse(existingLabels);
        console.log('[Better Setups] Found existing labels:', parsedLabels);
        console.log('[Better Setups] Stored setups already enabled, exiting silently');
        return; // Exit silently if already enabled
      } catch (parseError) {
        console.warn('[Better Setups] Failed to parse existing labels, proceeding with setup:', parseError);
        message = '<p>Setup labels have been activated!</p><p>Available setups: Farm, Speedrun, Rank Points, Boosted Map, Other</p>';
      }
    } else {
      console.log('[Better Setups] No existing setup found, setting defaults');
      message = '<p>Setup labels have been activated!</p><p>Available setups: Farm, Speedrun, Rank Points, Boosted Map, Other</p>';
    }
    
    // Set the stored setups flag
    console.log('[Better Setups] Setting stored-setups flag to true');
    window.localStorage.setItem(STORAGE_KEYS.STORED_SETUPS, 'true');
    
    // Set the stored setup labels
    console.log('[Better Setups] Setting labels in localStorage:', labelsToSet);
    window.localStorage.setItem(STORAGE_KEYS.SETUP_LABELS, JSON.stringify(labelsToSet));
    
    // Update the game state to enable stored setups
    console.log('[Better Setups] Updating game state to enable stored setups');
    globalThis.state.menu.trigger.setState({
      fn: (prev) => ({
        ...prev,
        flags: { ...prev.flags, storedSetups: true },
      }),
    });
    
    // Verify the settings were applied correctly
    const verifyFlag = window.localStorage.getItem('stored-setups');
    const verifyLabels = window.localStorage.getItem('stored-setup-labels');
    console.log('[Better Setups] Verification - stored-setups flag:', verifyFlag);
    console.log('[Better Setups] Verification - labels in localStorage:', verifyLabels);
    
    console.log('[Better Setups] Setup labels activated successfully');
    
    // Show confirmation modal
    api.ui.components.createModal({
      title: 'Better Setups',
      content: message,
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  } catch (error) {
    console.error('[Better Setups] Error activating setups:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to activate setup labels. Please try again.</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  }
}

// Function to show edit labels modal
function showEditLabelsModal() {
  console.log('[Better Setups] showEditLabelsModal() called');
  
  try {
    // Get current map information
    const currentMapId = getCurrentMapId();
    const currentMapName = getCurrentMapName();
    
    console.log('[Better Setups] Current map:', currentMapId, currentMapName);
    
    // Get current labels
    const existingLabels = window.localStorage.getItem('stored-setup-labels');
    let currentLabels = ["Farm", "Speedrun", "Rank Points", "Boosted Map", "Other"];
    
    if (existingLabels) {
      try {
        currentLabels = JSON.parse(existingLabels);
      } catch (e) {
        console.warn('[Better Setups] Failed to parse existing labels, using defaults');
      }
    }
    
    // Get map-specific setup data
    const mapSetupData = getMapSetupData(currentMapId);
    console.log('[Better Setups] Map setup data:', mapSetupData);
    
    // Create modal content
    const content = document.createElement('div');
    
    // Add map information header
    const mapInfo = document.createElement('div');
    mapInfo.style.marginBottom = '15px';
    mapInfo.style.padding = '10px';
    mapInfo.style.backgroundColor = '#2a2a2a';
    mapInfo.style.borderRadius = '5px';
    mapInfo.style.border = '1px solid #444';
    
    mapInfo.innerHTML = `
      <h3 style="margin: 0 0 5px 0; color: #fff;">Current Map: ${currentMapName}</h3>
      <p style="margin: 0; color: #ccc; font-size: 12px;">Map ID: ${currentMapId}</p>
      <p style="margin: 5px 0 0 0; color: #ccc; font-size: 12px;">Saved setups: ${mapSetupData.count} (from ${mapSetupData.source})</p>
    `;
    
    content.appendChild(mapInfo);
    
    // Add setup labels section
    const labelsSection = document.createElement('div');
    labelsSection.innerHTML = '<h4 style="margin: 15px 0 10px 0; color: #fff;">Edit Setup Labels:</h4>';
    content.appendChild(labelsSection);
    
    // Create input fields for each label
    const inputsContainer = document.createElement('div');
    inputsContainer.style.marginTop = '10px';
    
    function createLabelInput(label, index) {
      const inputGroup = document.createElement('div');
      inputGroup.style.marginBottom = '8px';
      inputGroup.style.display = 'flex';
      inputGroup.style.alignItems = 'center';
      inputGroup.style.gap = '8px';
      
      const labelElement = document.createElement('span');
      labelElement.textContent = `${index + 1}.`;
      labelElement.style.minWidth = '20px';
      
      const input = createStyledTextInput({
        value: label,
        datasetIndex: index,
        styles: { flex: '1' }
      });
      
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.style.padding = '4px 8px';
      removeButton.style.backgroundColor = '#dc3545';
      removeButton.style.color = 'white';
      removeButton.style.border = 'none';
      removeButton.style.borderRadius = '3px';
      removeButton.style.cursor = 'pointer';
      removeButton.onclick = () => {
        // Check if this would be the last label
        if (inputsContainer.children.length <= 1) {
          api.ui.components.createModal({
            title: 'Cannot Remove',
            content: '<p>You must have at least one setup label.</p>',
            buttons: [{ text: 'OK', primary: true }]
          });
          return;
        }
        inputGroup.remove();
        updateLabelNumbers();
      };
      
      inputGroup.appendChild(labelElement);
      inputGroup.appendChild(input);
      inputGroup.appendChild(removeButton);
      return inputGroup;
    }
    
    function updateLabelNumbers() {
      const inputGroups = inputsContainer.querySelectorAll('div');
      inputGroups.forEach((group, index) => {
        const labelElement = group.querySelector('span');
        if (labelElement) {
          labelElement.textContent = `${index + 1}.`;
        }
      });
    }
    
    function addNewLabel() {
      const newIndex = inputsContainer.children.length;
      const newInputGroup = createLabelInput('New Label', newIndex);
      inputsContainer.appendChild(newInputGroup);
    }
    
    // Create existing labels
    currentLabels.forEach((label, index) => {
      const inputGroup = createLabelInput(label, index);
      inputsContainer.appendChild(inputGroup);
    });
    
    // Add "Add Label" button
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Label';
    addButton.style.marginTop = '10px';
    addButton.style.padding = '8px 16px';
    addButton.style.backgroundColor = '#28a745';
    addButton.style.color = 'white';
    addButton.style.border = 'none';
    addButton.style.borderRadius = '3px';
    addButton.style.cursor = 'pointer';
    addButton.onclick = addNewLabel;
    
    labelsSection.appendChild(inputsContainer);
    labelsSection.appendChild(addButton);
    content.appendChild(labelsSection);
    
    // Show modal
    api.ui.components.createModal({
      title: 'Edit Setup Labels',
      content: content,
      buttons: [
        {
          text: 'Cancel',
          primary: false,
          onClick: () => {
            console.log('[Better Setups] Edit labels cancelled');
          }
        },
        {
          text: 'Save',
          primary: true,
          onClick: () => {
            console.log('[Better Setups] Saving edited labels');
            
            // Get values from inputs
            const inputs = inputsContainer.querySelectorAll('input');
            const newLabels = Array.from(inputs).map(input => input.value.trim()).filter(label => label.length > 0);
            
            if (newLabels.length === 0) {
              api.ui.components.createModal({
                title: 'Error',
                content: '<p>Please enter at least one label.</p>',
                buttons: [{ text: 'OK', primary: true }]
              });
              return;
            }
            
            // Save new labels
            console.log('[Better Setups] New labels:', newLabels);
            window.localStorage.setItem('stored-setup-labels', JSON.stringify(newLabels));
            
            // Update game state
            globalThis.state.menu.trigger.setState({
              fn: (prev) => ({
                ...prev,
                flags: { ...prev.flags, storedSetups: true },
              }),
            });
            
            // Show success message
            api.ui.components.createModal({
              title: 'Success',
              content: `<p>Setup labels updated successfully!</p><p>New labels: ${newLabels.join(', ')}</p>`,
              buttons: [{ text: 'OK', primary: true }]
            });
            
            // Trigger storage event to notify the game
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'stored-setup-labels',
              newValue: window.localStorage.getItem('stored-setup-labels'),
              oldValue: null,
              storageArea: window.localStorage
            }));
          }
        }
      ]
    });
  } catch (error) {
    console.error('[Better Setups] Error showing edit labels modal:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to open edit labels modal. Please try again.</p>',
      buttons: [{ text: 'OK', primary: true }]
    });
  }
}

// =======================
// 4. UI Injection & Button Management
// =======================

// Function to inject edit buttons into existing setup labels

// Function to inject edit buttons into a specific setup button
function injectEditButton(setupButton) {
  const buttonText = setupButton.textContent.trim();
  
  // Check if this is a setup/save button and doesn't already have an edit button
  if ((buttonText.includes('Setup (') || buttonText.includes('Save (')) && 
      !setupButton.parentElement.querySelector('.edit-label-btn')) {
    
    // Create edit button
    const editButton = createEditButton(() => {
      console.log('[Better Setups] Edit button clicked for:', buttonText);
      showEditSingleLabelModal(buttonText);
    });
    
    // Find trash button and insert edit button after it if it exists
    const parent = setupButton.parentElement;
    const trashButton = parent.querySelector('button svg.lucide-trash2')?.closest('button');
    
    if (trashButton) {
      // Insert edit button after trash button
      parent.insertBefore(editButton, trashButton.nextSibling);
    } else {
      // No trash button found, append at end
      parent.appendChild(editButton);
    }
    
    console.log(`[Better Setups] Injected edit button for: ${buttonText}`);
    return true;
  }
  return false;
}

// Function to inject edit labels button if not present (always last)
function injectEditLabelsButton(setupContainer) {
  // Remove any existing Edit Labels button first to ensure proper ordering
  const existingEditLabelsBtn = setupContainer.querySelector('.edit-labels-btn');
  if (existingEditLabelsBtn) {
    existingEditLabelsBtn.parentElement.remove();
    console.log('[Better Setups] Removed existing Edit Labels button for reordering');
  }
  
  // Create the Edit Labels button
  const editLabelsButton = createSetupButton('Edit Labels', 'add', () => {
    console.log('[Better Setups] Edit Labels clicked');
    showEditLabelsModal();
  });
  editLabelsButton.classList.add('edit-labels-btn');
  
  // Create a container for the edit labels button
  const editLabelsContainer = document.createElement('div');
  editLabelsContainer.className = 'flex';
  editLabelsContainer.appendChild(editLabelsButton);
  
  // Always append at the very end to ensure it's last
  setupContainer.appendChild(editLabelsContainer);
  
  console.log('[Better Setups] Injected Edit Labels button at the end');
  return true;
}

// Function to process setup interface and inject buttons
function processSetupInterface() {
  const setupContainer = document.querySelector('.mb-2.flex.items-center.gap-2');
  
  if (!setupContainer) {
    return false;
  }
  
  console.log('[Better Setups] Processing setup interface...');
  
  // First, inject edit buttons for all setup labels
  const setupButtons = setupContainer.querySelectorAll('button');
  let injectedCount = 0;
  
  setupButtons.forEach(button => {
    if (injectEditButton(button)) {
      injectedCount++;
    }
  });
  
  // Then, add Edit Labels button at the very end
  injectEditLabelsButton(setupContainer);
  
  if (injectedCount > 0) {
    console.log(`[Better Setups] Successfully injected ${injectedCount} edit buttons`);
  }
  
  console.log('[Better Setups] Edit Labels button positioned at the end');
  return true;
}

// Function to inject edit buttons into setup interface
function injectSetupButtons() {
  console.log('[Better Setups] injectSetupButtons() called');
  
  // Try to process immediately
  if (processSetupInterface()) {
    console.log('[Better Setups] Setup interface found and processed immediately');
    return;
  }
  
  // If not found, try with aggressive polling for faster detection
  console.log('[Better Setups] Setup interface not found, using fast polling...');
  
  let attempts = 0;
  const maxAttempts = 20; // Try for up to 2 seconds with 100ms intervals
  
  const fastPoll = () => {
    attempts++;
    
    if (processSetupInterface()) {
      console.log(`[Better Setups] Setup interface found after ${attempts} fast polling attempts`);
      return;
    }
    
    if (attempts < maxAttempts) {
      setTimeout(fastPoll, 100); // Check every 100ms
    } else {
      console.log('[Better Setups] Fast polling completed, MutationObserver will handle future changes');
    }
  };
  
  fastPoll();
}

// Function to start MutationObserver for automatic button injection
function startSetupInterfaceObserver() {
  if (setupInterfaceObserver) {
    console.log('[Better Setups] Observer already running');
    return;
  }
  
  console.log('[Better Setups] Starting MutationObserver for setup interface...');
  
  setupInterfaceObserver = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if any added nodes contain setup buttons
        const addedNodes = Array.from(mutation.addedNodes);
        addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this node is a setup button or contains setup buttons
            if (node.matches && node.matches('button')) {
              const buttonText = node.textContent.trim();
              if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
                shouldProcess = true;
              }
            }
            
            // Check if this node contains setup buttons
            if (node.querySelectorAll) {
              const setupButtons = node.querySelectorAll('button');
              setupButtons.forEach(button => {
                const buttonText = button.textContent.trim();
                if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
                  shouldProcess = true;
                }
              });
            }
            
            // Check if this is the setup container itself
            if (node.matches && node.matches('.mb-2.flex.items-center.gap-2')) {
              shouldProcess = true;
            }
          }
        });
        
        // Check if any removed nodes might affect our buttons
        const removedNodes = Array.from(mutation.removedNodes);
        removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector && node.querySelector('.edit-label-btn')) {
              shouldProcess = true; // Re-inject if edit buttons were removed
            }
          }
        });
      }
      
      // Also check for attribute changes that might affect button text
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const target = mutation.target;
        if (target.nodeType === Node.ELEMENT_NODE && target.tagName === 'BUTTON') {
          const buttonText = target.textContent.trim();
          if (buttonText.includes('Setup (') || buttonText.includes('Save (')) {
            shouldProcess = true;
          }
        }
      }
    });
    
    if (shouldProcess) {
      console.log('[Better Setups] Setup interface change detected, processing immediately...');
      // Process immediately for faster response, with fallback
      processSetupInterface();
      
      // Also try again after a tiny delay to catch any delayed DOM updates
      setTimeout(() => {
        processSetupInterface();
      }, 50);
    }
  });
  
  // Start observing the entire document for changes
  setupInterfaceObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false // We don't need to watch attribute changes
  });
  
  console.log('[Better Setups] MutationObserver started successfully');
}

// Function to stop the MutationObserver
function stopSetupInterfaceObserver() {
  if (setupInterfaceObserver) {
    console.log('[Better Setups] Stopping MutationObserver...');
    setupInterfaceObserver.disconnect();
    setupInterfaceObserver = null;
  }
}

// =======================
// 5. UI Creation Functions
// =======================

// Helper function to create styled text input (matching Dice_Roller.js style)
function createStyledTextInput(options = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  
  // Apply Dice_Roller.js style
  input.style.background = 'rgba(255, 255, 255, 0.1)';
  input.style.color = 'rgb(255, 255, 255)';
  input.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  input.style.padding = '3px 6px';
  input.style.borderRadius = '2px';
  input.style.fontSize = '12px';
  input.style.width = '100%';
  input.style.fontFamily = 'inherit';
  input.style.outline = 'none';
  input.style.boxSizing = 'border-box';
  
  // Apply custom options
  if (options.value !== undefined) input.value = options.value;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.datasetIndex !== undefined) input.dataset.index = options.datasetIndex;
  
  // Apply custom styles (these will override the base styles if needed)
  if (options.styles) {
    Object.assign(input.style, options.styles);
  }
  
  return input;
}

// Helper function to create setup buttons with consistent styling
function createSetupButton(text, type, onClick) {
  const button = document.createElement('button');
  button.className = BUTTON_STYLES.BASE;
  button.textContent = text;
  button.onclick = onClick;
  
  // Apply background styles based on button type
  if (type === 'edit') {
    Object.assign(button.style, BUTTON_STYLES.EDIT);
  } else if (type === 'add') {
    Object.assign(button.style, BUTTON_STYLES.ADD);
  }
  
  return button;
}

// Helper function to create edit buttons with pencil icon
function createEditButton(onClick) {
  const button = document.createElement('button');
  button.className = `${BUTTON_STYLES.BASE} edit-label-btn`;
  button.onclick = onClick;
  
  // Apply edit button styles
  Object.assign(button.style, BUTTON_STYLES.EDIT);
  
  // Add pencil icon
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
      <path d="m15 5 4 4"></path>
    </svg>
  `;
  
  return button;
}

// =======================
// 6. Modal Management
// =======================

// Function to show edit single label modal
function showEditSingleLabelModal(currentLabelText) {
  console.log('[Better Setups] showEditSingleLabelModal() called for:', currentLabelText);
  
  try {
    // Extract the label name from the button text (e.g., "Setup (rank)" -> "rank")
    const labelMatch = currentLabelText.match(/\(([^)]+)\)/);
    const currentLabel = labelMatch ? labelMatch[1] : currentLabelText;
    
    // Get current labels
    const existingLabels = window.localStorage.getItem('stored-setup-labels');
    let currentLabels = ["Farm", "Speedrun", "Rank Points", "Boosted Map", "Other"];
    
    if (existingLabels) {
      try {
        currentLabels = JSON.parse(existingLabels);
      } catch (e) {
        console.warn('[Better Setups] Failed to parse existing labels, using defaults');
      }
    }
    
    // Create modal content with blue background
    const content = document.createElement('div');
    content.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_BLUE}")`;
    content.style.backgroundSize = 'auto';
    content.style.backgroundPosition = 'top left';
    content.style.backgroundRepeat = 'repeat';
    content.style.padding = '10px';
    content.style.borderRadius = '8px';
    content.style.minHeight = 'auto';
    content.style.position = 'relative';
    
    // Add overlay for better text readability
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_DARK}")`;
    overlay.style.backgroundSize = 'auto';
    overlay.style.backgroundPosition = 'top left';
    overlay.style.backgroundRepeat = 'repeat';
    overlay.style.borderRadius = '8px';
    content.appendChild(overlay);
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.style.position = 'relative';
    contentContainer.style.zIndex = '1';
    contentContainer.style.color = '#fff';
    contentContainer.innerHTML = `<p style="margin: 0 0 8px 0; font-size: 14px;">Edit label: <strong style="color: #ffe066;">${currentLabel}</strong></p>`;
    
    const input = createStyledTextInput({
      value: currentLabel,
      styles: { marginTop: '5px' }
    });
    
    contentContainer.appendChild(input);
    content.appendChild(contentContainer);
    
    // Show modal
    api.ui.components.createModal({
      title: 'Edit Setup Label',
      content: content,
      buttons: [
        {
          text: 'Cancel',
          primary: false,
          onClick: () => {
            console.log('[Better Setups] Edit label cancelled');
          }
        },
        {
          text: 'Save',
          primary: true,
          onClick: () => {
            const newLabel = input.value.trim();
            if (!newLabel) {
              api.ui.components.createModal({
                title: 'Error',
                content: '<p>Please enter a label name.</p>',
                buttons: [{ text: 'OK', primary: true }]
              });
              return;
            }
            
            if (newLabel === currentLabel) {
              console.log('[Better Setups] No changes made');
              return;
            }
            
            // Update the label in the array
            const labelIndex = currentLabels.indexOf(currentLabel);
            if (labelIndex !== -1) {
              currentLabels[labelIndex] = newLabel;
            } else {
              // If not found, add it
              currentLabels.push(newLabel);
            }
            
            // Update setup data in localStorage to rename setups
            console.log('[Better Setups] About to update setup data in localStorage');
            updateSetupDataLabel(currentLabel, newLabel);
            
            // Save updated labels
            console.log('[Better Setups] Saving updated labels to localStorage:', currentLabels);
            window.localStorage.setItem(STORAGE_KEYS.SETUP_LABELS, JSON.stringify(currentLabels));
            console.log('[Better Setups] Labels saved successfully');
            
            // Update game state
            globalThis.state.menu.trigger.setState({
              fn: (prev) => ({
                ...prev,
                flags: { ...prev.flags, storedSetups: true },
              }),
            });
            
            // Update the button text immediately
            updateButtonText(currentLabel, newLabel);
            
            // Re-inject edit buttons to ensure they appear on updated buttons
            setTimeout(() => {
              console.log('[Better Setups] Re-injecting edit buttons after label update');
              processSetupInterface();
            }, 100);
            
            // Show success message
            api.ui.components.createModal({
              title: 'Success',
              content: `<p>Label updated successfully!</p><p>"${currentLabel}" → "${newLabel}"</p>`,
              buttons: [{ text: 'OK', primary: true }]
            });
          }
        }
      ]
    });
  } catch (error) {
    console.error('[Better Setups] Error showing edit single label modal:', error);
  }
}

// Function to show add label modal
// Function to show comprehensive modal for managing labels (add, edit, remove)
function showEditLabelsModal() {
  try {
    console.log('[Better Setups] showEditLabelsModal() called');
    
    // Get current labels
    const currentLabels = getCurrentLabels();
    console.log('[Better Setups] Current labels:', currentLabels);
    
    // Create modal content with blue background
    const content = document.createElement('div');
    content.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_BLUE}")`;
    content.style.backgroundSize = 'auto';
    content.style.backgroundPosition = 'top left';
    content.style.backgroundRepeat = 'repeat';
    content.style.padding = '20px';
    content.style.borderRadius = '8px';
    content.style.minHeight = '400px';
    content.style.position = 'relative';
    
    // Add overlay for better text readability
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_DARK}")`;
    overlay.style.backgroundSize = 'auto';
    overlay.style.backgroundPosition = 'top left';
    overlay.style.backgroundRepeat = 'repeat';
    overlay.style.borderRadius = '8px';
    content.appendChild(overlay);
    
    // Current labels section
    const labelsSection = document.createElement('div');
    labelsSection.style.cssText = 'margin-bottom: 20px;';
    
    const labelsTitle = document.createElement('h4');
    labelsTitle.textContent = 'Current Labels:';
    labelsTitle.style.cssText = 'color: #fff; font-size: 14px; margin-bottom: 10px;';
    labelsSection.appendChild(labelsTitle);
    
    // Labels list container - simplified without background images
    const labelsList = document.createElement('div');
    labelsList.style.cssText = 'max-height: 200px; overflow-y: auto; border: 1px solid #444; border-radius: 4px; padding: 10px; background-color: rgba(0, 0, 0, 0.3);';
    
    currentLabels.forEach((label, index) => {
      // Create label row with simple styling
      const labelRow = document.createElement('div');
      labelRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px; margin-bottom: 5px; background-color: rgba(255, 255, 255, 0.1); border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.1);';
      
      // Label name
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      labelSpan.style.cssText = 'color: #fff; font-size: 14px; flex: 1;';
      labelRow.appendChild(labelSpan);
      
      // Edit button
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.style.cssText = 'margin-right: 5px; padding: 4px 8px; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; position: relative;';
      editBtn.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_GREEN}")`;
      editBtn.style.backgroundSize = 'auto';
      editBtn.style.backgroundPosition = 'top left';
      editBtn.style.backgroundRepeat = 'repeat';
      editBtn.onclick = () => editLabelInModal(label, index);
      labelRow.appendChild(editBtn);
      
      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.style.cssText = 'padding: 4px 8px; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; position: relative;';
      removeBtn.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_RED}")`;
      removeBtn.style.backgroundSize = 'auto';
      removeBtn.style.backgroundPosition = 'top left';
      removeBtn.style.backgroundRepeat = 'repeat';
      removeBtn.onclick = () => removeLabelInModal(label, index);
      labelRow.appendChild(removeBtn);
      
      labelsList.appendChild(labelRow);
    });
    
    labelsSection.appendChild(labelsList);
    
    // Add new label section
    const addSection = document.createElement('div');
    addSection.style.cssText = 'border-top: 1px solid #444; padding-top: 20px;';
    
    const addTitle = document.createElement('h4');
    addTitle.textContent = 'Add New Label:';
    addTitle.style.cssText = 'color: #fff; font-size: 14px; margin-bottom: 10px;';
    addSection.appendChild(addTitle);
    
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'display: flex; gap: 10px; align-items: center;';
    
    const input = createStyledTextInput({
      placeholder: 'Enter new label name',
      styles: { flex: '1' }
    });
    inputContainer.appendChild(input);
    
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cssText = 'padding: 8px 16px; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; position: relative;';
    addBtn.style.backgroundImage = `url("${MEDIA_URLS.BACKGROUND_BLUE}")`;
    addBtn.style.backgroundSize = 'auto';
    addBtn.style.backgroundPosition = 'top left';
    addBtn.style.backgroundRepeat = 'repeat';
    addBtn.onclick = () => addLabelInModal(input);
    inputContainer.appendChild(addBtn);
    
    addSection.appendChild(inputContainer);
    
    // Create main content container with proper z-index
    const mainContentContainer = document.createElement('div');
    mainContentContainer.style.cssText = 'position: relative; z-index: 1; color: #fff;';
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Manage Setup Labels';
    title.style.cssText = 'margin: 0 0 10px 0; font-size: 18px; text-align: center; color: #fff;';
    mainContentContainer.appendChild(title);
    
    // Separator above notice
    const separatorAbove = document.createElement('div');
    separatorAbove.style.cssText = 'width: 100%; height: 1px; background-color: #444; margin: 0 0 15px 0;';
    mainContentContainer.appendChild(separatorAbove);
    
    // Backup reminder with translation
    const reminder = document.createElement('p');
    
    // Check if user language is Portuguese (using same method as Board Analyzer)
    const isPortuguese = document.documentElement.lang === 'pt' || 
                        document.querySelector('html[lang="pt"]') || 
                        window.location.href.includes('/pt/');
    
    const noticeText = isPortuguese 
      ? '<strong>AVISO:</strong> Use o <strong>Configurador</strong> no cabeçalho para fazer backup dos seus rótulos de configuração antes de fazer alterações!'
      : '<strong>NOTICE:</strong> Use the <strong>Configurator</strong> in the header to backup your setup labels before making changes!';
    
    reminder.innerHTML = noticeText;
    reminder.style.cssText = 'margin: 0 0 15px 0; font-size: 14px; text-align: center; color: #fff; line-height: 1.4; font-weight: normal;';
    mainContentContainer.appendChild(reminder);
    
    // Separator below notice
    const separatorBelow = document.createElement('div');
    separatorBelow.style.cssText = 'width: 100%; height: 1px; background-color: #444; margin: 0 0 20px 0;';
    mainContentContainer.appendChild(separatorBelow);
    
    mainContentContainer.appendChild(labelsSection);
    mainContentContainer.appendChild(addSection);
    
    content.appendChild(mainContentContainer);
    
    // Show modal
    api.ui.components.createModal({
      title: 'Edit Setup Labels',
      content: content,
      buttons: [
        {
          text: 'Close',
          primary: true,
          onClick: () => {
            console.log('[Better Setups] Edit labels modal closed');
          }
        }
      ]
    });
    
  } catch (error) {
    console.error('[Better Setups] Error showing edit labels modal:', error);
  }
}

// Helper function to edit a label within the modal
function editLabelInModal(oldLabel, index) {
  const newLabel = prompt(`Edit label "${oldLabel}":`, oldLabel);
  if (newLabel && newLabel.trim() && newLabel.trim() !== oldLabel) {
    const trimmedLabel = newLabel.trim();
    
    // Get current labels
    const currentLabels = getCurrentLabels();
    const oldLabelIndex = currentLabels.indexOf(oldLabel);
    
    if (oldLabelIndex !== -1) {
      // Update the label
      currentLabels[oldLabelIndex] = trimmedLabel;
      
      // Save updated labels
      window.localStorage.setItem('stored-setup-labels', JSON.stringify(currentLabels));
      
      // Update setup data keys
      updateSetupDataLabel(oldLabel, trimmedLabel);
      
      // Update button text
      updateButtonText(oldLabel, trimmedLabel);
      
      // Update game state
      globalThis.state.menu.trigger.setState({
        fn: (prev) => ({
          ...prev,
          flags: { ...prev.flags, storedSetups: true },
        }),
      });
      
      // Refresh the entire setup interface
      refreshSetupInterface();
      
      // Show success message
      api.ui.components.createModal({
        title: 'Success',
        content: `<p>Label updated successfully!</p><p>"${oldLabel}" → "${trimmedLabel}"</p>`,
        buttons: [{ text: 'OK', primary: true }]
      });
    }
  }
}

// Helper function to remove a label within the modal
function removeLabelInModal(label, index) {
  const confirmed = confirm(`Are you sure you want to remove the label "${label}"?\n\nThis will not delete your setups, but they will no longer be categorized under this label.`);
  
  if (confirmed) {
    // Get current labels
    const currentLabels = getCurrentLabels();
    const labelIndex = currentLabels.indexOf(label);
    
    if (labelIndex !== -1) {
      // Remove the label
      currentLabels.splice(labelIndex, 1);
      
      // Save updated labels
      window.localStorage.setItem('stored-setup-labels', JSON.stringify(currentLabels));
      
      // Update game state
      globalThis.state.menu.trigger.setState({
        fn: (prev) => ({
          ...prev,
          flags: { ...prev.flags, storedSetups: true },
        }),
      });
      
      // Force a complete UI refresh after label removal
      console.log('[Better Setups] Triggering complete UI refresh after label removal');
      
      // Trigger the game's internal refresh mechanism
      if (globalThis.state && globalThis.state.menu && globalThis.state.menu.trigger) {
        globalThis.state.menu.trigger.setState({
          fn: (prev) => ({
            ...prev,
            flags: { ...prev.flags, storedSetups: true },
          }),
        });
      }
      
      // Dispatch custom event for label removal
      window.dispatchEvent(new CustomEvent('setupLabelsChanged', {
        detail: { 
          action: 'remove',
          removedLabel: label,
          remainingLabels: currentLabels 
        }
      }));
      
      // Refresh the entire setup interface
      refreshSetupInterface();
      
      // Show success message
      api.ui.components.createModal({
        title: 'Success',
        content: `<p>Label "${label}" removed successfully!</p><p>Remaining labels: ${currentLabels.join(', ')}</p><p>The setup interface has been refreshed.</p>`,
        buttons: [{ text: 'OK', primary: true }]
      });
    }
  }
}

// Helper function to add a label within the modal
function addLabelInModal(input) {
  const newLabel = input.value.trim();
  if (!newLabel) {
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Please enter a label name.</p>',
      buttons: [{ text: 'OK', primary: true }]
    });
    return;
  }
  
  // Get current labels
  const currentLabels = getCurrentLabels();
  
  // Check if label already exists
  if (currentLabels.includes(newLabel)) {
    api.ui.components.createModal({
      title: 'Error',
      content: `<p>Label "${newLabel}" already exists.</p>`,
      buttons: [{ text: 'OK', primary: true }]
    });
    return;
  }
  
  // Add new label
  currentLabels.push(newLabel);
  window.localStorage.setItem('stored-setup-labels', JSON.stringify(currentLabels));
  
  // Update game state
  globalThis.state.menu.trigger.setState({
    fn: (prev) => ({
      ...prev,
      flags: { ...prev.flags, storedSetups: true },
    }),
  });
  
  // Clear input
  input.value = '';
  
  // Show success message
  api.ui.components.createModal({
    title: 'Success',
    content: `<p>Label "${newLabel}" added successfully!</p><p>All labels: ${currentLabels.join(', ')}</p>`,
    buttons: [{ text: 'OK', primary: true }]
  });
  
  // Refresh the entire setup interface
  refreshSetupInterface();
}

// =======================
// 7. Data Management & Updates
// =======================

// Function to get current labels from localStorage
function getCurrentLabels() {
  try {
    const existingLabels = window.localStorage.getItem('stored-setup-labels');
    let currentLabels = ["Farm", "Speedrun", "Rank Points", "Boosted Map", "Other"];
    
    if (existingLabels) {
      try {
        currentLabels = JSON.parse(existingLabels);
      } catch (e) {
        console.warn('[Better Setups] Failed to parse existing labels, using defaults');
      }
    }
    
    return currentLabels;
  } catch (error) {
    console.error('[Better Setups] Error getting current labels:', error);
    return ["Farm", "Speedrun", "Rank Points", "Boosted Map", "Other"];
  }
}

// Function to refresh the entire setup interface
function refreshSetupInterface() {
  console.log('[Better Setups] Refreshing entire setup interface');
  
  // Clear all existing mod buttons to avoid duplicates
  const existingEditButtons = document.querySelectorAll('.edit-label-btn');
  existingEditButtons.forEach(btn => btn.remove());
  
  const existingEditLabelsBtn = document.querySelector('.edit-labels-btn');
  if (existingEditLabelsBtn) {
    existingEditLabelsBtn.parentElement.remove();
  }
  
  // Trigger storage event to notify the game
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'stored-setup-labels',
    newValue: window.localStorage.getItem('stored-setup-labels'),
    oldValue: null,
    storageArea: window.localStorage
  }));
  
  // Dispatch custom event for any game listeners
  window.dispatchEvent(new CustomEvent('setupInterfaceRefresh', {
    detail: { 
      action: 'refresh',
      timestamp: Date.now()
    }
  }));
  
  // Re-inject all buttons immediately, then again after a tiny delay for safety
  processSetupInterface();
  
  setTimeout(() => {
    processSetupInterface();
  }, 50);
}

// Function to update button text dynamically
function updateButtonText(oldLabel, newLabel) {
  console.log('[Better Setups] Updating button text:', oldLabel, '→', newLabel);
  
  try {
    // Find all buttons that contain the old label
    const allButtons = document.querySelectorAll('button');
    
    allButtons.forEach(button => {
      const buttonText = button.textContent.trim();
      
      // Check if this button contains the old label
      if (buttonText.includes(`(${oldLabel})`)) {
        // Update the button text
        const newText = buttonText.replace(`(${oldLabel})`, `(${newLabel})`);
        button.textContent = newText;
        console.log('[Better Setups] Updated button:', buttonText, '→', newText);
      }
    });
    
    // Also trigger a storage event to notify the game
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stored-setup-labels',
      newValue: window.localStorage.getItem('stored-setup-labels'),
      oldValue: null,
      storageArea: window.localStorage
    }));
    
  } catch (error) {
    console.error('[Better Setups] Error updating button text:', error);
  }
}

// Function to update setup data when renaming labels
function updateSetupDataLabel(oldLabel, newLabel) {
  console.log('[Better Setups] Updating setup data:', oldLabel, '→', newLabel);
  
  try {
    // Based on the config structure, setups are stored with keys like "Farm-crcat", "Farm-khub"
    // When we change a label, we need to rename these keys to maintain the association
    
    console.log('[Better Setups] Looking for setup keys with old label prefix...');
    
    const allKeys = Object.keys(localStorage);
    const keysToUpdate = allKeys.filter(key => key.startsWith(`${oldLabel}-`));
    
    console.log(`[Better Setups] Found ${keysToUpdate.length} setup keys to update:`, keysToUpdate);
    
    let updatedCount = 0;
    
    keysToUpdate.forEach(oldKey => {
      try {
        // Get the setup data
        const setupData = localStorage.getItem(oldKey);
        if (setupData) {
          // Create new key with new label
          const mapId = oldKey.substring(oldLabel.length + 1); // Remove "Farm-" prefix
          const newKey = `${newLabel}-${mapId}`;
          
          // Store under new key
          localStorage.setItem(newKey, setupData);
          
          // Remove old key
          localStorage.removeItem(oldKey);
          
          console.log(`[Better Setups] Updated setup key: "${oldKey}" → "${newKey}"`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`[Better Setups] Error updating setup key ${oldKey}:`, error);
      }
    });
    
    if (updatedCount > 0) {
      console.log(`[Better Setups] ✅ Updated ${updatedCount} setup keys successfully`);
    } else {
      console.log('[Better Setups] No setup keys found with old label prefix');
    }
    
  } catch (error) {
    console.error('[Better Setups] Error updating setup data:', error);
  }
}

// =======================
// 8. Utility Functions
// =======================

// Helper function to get current map ID
function getCurrentMapId() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    
    if (boardContext.selectedMap?.selectedRoom?.id) {
      return boardContext.selectedMap.selectedRoom.id;
    } else if (boardContext.selectedMap?.id) {
      return boardContext.selectedMap.id;
    } else if (boardContext.area?.id) {
      return boardContext.area.id;
    } else {
      const playerContext = globalThis.state.player.getSnapshot().context;
      return playerContext.currentRoomId || 'unknown';
    }
  } catch (error) {
    console.warn('[Better Setups] Error getting current map ID:', error);
    return 'unknown';
  }
}

// Helper function to get current map name
function getCurrentMapName() {
  try {
    const mapId = getCurrentMapId();
    if (mapId === 'unknown') return 'Unknown Map';
    
    // Try to get map name from utils
    if (globalThis.state.utils && globalThis.state.utils.ROOM_NAME) {
      return globalThis.state.utils.ROOM_NAME[mapId] || mapId;
    }
    
    return mapId;
  } catch (error) {
    console.warn('[Better Setups] Error getting current map name:', error);
    return 'Unknown Map';
  }
}

// Helper function to get map-specific setup data
function getMapSetupData(mapId) {
  try {
    if (!mapId || mapId === 'unknown') {
      return { setups: [], count: 0 };
    }
    
    // Try to get setup data from localStorage
    const setupKey = `bestiary-arena-setups-${mapId}`;
    const setupData = localStorage.getItem(setupKey);
    
    if (setupData) {
      try {
        const parsed = JSON.parse(setupData);
        return {
          setups: parsed.setups || [],
          count: parsed.setups ? parsed.setups.length : 0,
          source: 'localStorage'
        };
      } catch (e) {
        console.warn('[Better Setups] Failed to parse setup data for map:', mapId);
      }
    }
    
    // Try alternative storage keys
    const alternativeKeys = [
      `bestiary-arena-setups`,
      `setup-${mapId}`,
      `map-setups-${mapId}`
    ];
    
    for (const key of alternativeKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          // Look for map-specific data within the parsed object
          if (parsed[mapId]) {
            return {
              setups: parsed[mapId].setups || [],
              count: parsed[mapId].setups ? parsed[mapId].setups.length : 0,
              source: key
            };
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return { setups: [], count: 0, source: 'none' };
  } catch (error) {
    console.warn('[Better Setups] Error getting map setup data:', error);
    return { setups: [], count: 0, source: 'error' };
  }
}

// =======================
// 9. Exports & Lifecycle Management
// =======================

// Export functionality
exports = {
  activate: activateSetups,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup: () => {
    stopSetupInterfaceObserver();
  }
};
