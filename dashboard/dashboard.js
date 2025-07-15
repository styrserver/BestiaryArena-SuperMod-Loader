// Cross-browser API shim for extension APIs
window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

if (window.DEBUG) console.log('DEBUG: browserAPI:', window.browserAPI, 'chrome:', typeof chrome, 'browser:', typeof browser);

// Topnav navigation logic
// Switches visible section when topnav item is clicked

document.querySelectorAll('.topnav ul li').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.topnav ul li').forEach(li => li.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(this.dataset.section + '-section').classList.add('active');
    // Show/hide right-side panels
    document.querySelectorAll('.dashboard-container > .section').forEach(sec => sec.classList.remove('active'));
    if (this.dataset.section === 'mods') {
      document.getElementById('editor-section').classList.add('active');
    }
    // Add similar logic for other right-side panels if needed
  });
});

// Settings subnav navigation logic
document.querySelectorAll('.settings-subnav-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.settings-subnav-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.settings-subsection').forEach(subsection => subsection.classList.remove('active'));
    document.getElementById('settings-' + this.dataset.settingsSubsection + '-section').classList.add('active');
  });
});

// Theme selection functionality
let currentTheme = localStorage.getItem('dashboard-theme') || 'default';

function applyTheme(themeName) {
  // Always set data-theme to the selected theme, even for 'default'
  document.documentElement.setAttribute('data-theme', themeName);
  // Update theme card active states
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.remove('active');
  });
  const activeCard = document.querySelector(`[data-theme="${themeName}"]`);
  if (activeCard) {
    activeCard.classList.add('active');
  }
  // Save theme preference to both localStorage and browser.storage.local
  localStorage.setItem('dashboard-theme', themeName);
  if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
    window.browserAPI.storage.local.set({ 'dashboard-theme': themeName });
  }
  currentTheme = themeName;
}

// Initialize theme selection
document.addEventListener('DOMContentLoaded', function() {
  // Apply saved theme
  applyTheme(currentTheme);
  
  // Add click handlers to theme cards
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', function() {
      const themeName = this.dataset.theme;
      applyTheme(themeName);
    });
  });

  // Animate all .game-style-button and .topnav ul li on click
  function addPressAnimation(selector) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('mousedown', function() {
        btn.classList.add('pressed');
      });
      btn.addEventListener('mouseup', function() {
        setTimeout(() => btn.classList.remove('pressed'), 120);
      });
      btn.addEventListener('mouseleave', function() {
        btn.classList.remove('pressed');
      });
      btn.addEventListener('touchstart', function() {
        btn.classList.add('pressed');
      });
      btn.addEventListener('touchend', function() {
        setTimeout(() => btn.classList.remove('pressed'), 120);
      });
    });
  }
  addPressAnimation('.game-style-button');
  addPressAnimation('.topnav ul li');
});

// Real-time Mods List with Toggle
const officialModsList = document.getElementById('official-mods-list');
const superModsList = document.getElementById('super-mods-list');
const userModsList = document.getElementById('user-mods-list');

import { getLocalMods } from '../mods/modsLoader.js';

// --- NEW: Automatically register all mods in /mods on dashboard load ---
async function scanAndRegisterLocalMods() {
  // List of mod files in /mods (hardcoded, since browser JS can't read directory)
  const modFiles = [
    // Official Mods
    { name: 'Bestiary_Automator.js', enabled: false },
    { name: 'Board Analyzer.js', enabled: false },
    { name: 'Custom_Display.js', enabled: false },
    { name: 'Hero_Editor.js', enabled: false },
    { name: 'Highscore_Improvements.js', enabled: false },
    { name: 'Item_tier_list.js', enabled: false },
    { name: 'Monster_tier_list.js', enabled: false },
    { name: 'Setup_Manager.js', enabled: false },
    { name: 'Team_Copier.js', enabled: false },
    { name: 'TestMod.js', enabled: false },
    { name: 'Tick_Tracker.js', enabled: false },
    { name: 'Turbo Mode.js', enabled: false },
    { name: 'UIComponentsShowcase.js', enabled: false },
    // Super Mods
    { name: 'Cyclopedia.js', enabled: true },
    { name: 'Hunt Analyzer.js', enabled: true },
    { name: 'DashboardButton.js', enabled: true },
    { name: 'Dice_Roller.js', enabled: true }
  ];
  // Build mod objects
  const mods = modFiles.map(({ name, enabled }) => ({
    name,
    displayName: name.replace('.js', '').replace(/_/g, ' '),
    isLocal: true,
    enabled
  }));
  // Register mods with background script
  if (window.browserAPI && window.browserAPI.runtime && window.browserAPI.runtime.sendMessage) {
    await window.browserAPI.runtime.sendMessage({
      action: 'registerLocalMods',
      mods
    });
  }
}
// --- END NEW ---

async function fetchFileModContent(modName) {
  // Try to fetch the file content from the mods folder
  try {
    const url = window.browserAPI.runtime.getURL(`mods/${modName}`);
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {}
  return '';
}

// Add modal for read-only script view
let scriptModal = document.getElementById('script-modal');
if (!scriptModal) {
  scriptModal = document.createElement('div');
  scriptModal.id = 'script-modal';
  scriptModal.style.display = 'none';
  scriptModal.innerHTML = `
    <div class="modal-bg"></div>
    <div class="modal-content">
      <h4 id="modal-script-title"></h4>
      <textarea id="modal-script-content" readonly style="width:100%;height:300px;font-family:monospace;font-size:14px;"></textarea>
      <button id="close-modal-btn" class="primary-button" style="margin-top:16px;float:right;">Close</button>
    </div>
  `;
  document.body.appendChild(scriptModal);
  document.getElementById('close-modal-btn').onclick = () => {
    scriptModal.style.display = 'none';
  };
  scriptModal.querySelector('.modal-bg').onclick = () => {
    scriptModal.style.display = 'none';
  };
}

// Remove old scriptEditPanel logic and replace with persistent editor logic

function updateEditorLineNumbers() {
  const textarea = document.getElementById('code-editor-textarea');
  const lineNumbers = document.getElementById('editor-line-numbers');
  if (!textarea || !lineNumbers) return;
  const lines = textarea.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) {
    html += i + '<br>';
  }
  lineNumbers.innerHTML = html;
  // Sync scroll
  lineNumbers.scrollTop = textarea.scrollTop;
}

// Update line numbers on input and scroll
const textarea = document.getElementById('code-editor-textarea');
if (textarea) {
  textarea.addEventListener('input', updateEditorLineNumbers);
  textarea.addEventListener('scroll', updateEditorLineNumbers);
}

// Update setEditorContent to show/hide the Save button in the header
function setEditorContent(title, content, editable, onSave, downloadName) {
  const editorHeader = document.querySelector('.editor-header');
  const editorTextarea = document.getElementById('code-editor-textarea');
  const saveBtn = document.getElementById('editor-save-btn');
  editorHeader.querySelector('span').textContent = title || 'Code Editor';
  editorTextarea.value = content || '';
  editorTextarea.readOnly = !editable;
  // Hide Save/Download button if content is blank or is the default placeholder
  const isPlaceholder = !content || content.trim() === '' || content.trim() === 'Select a mod and click Edit to view or edit code...';
  if (isPlaceholder) {
    saveBtn.style.display = 'none';
    saveBtn.onclick = null;
  } else if (editable) {
    saveBtn.style.display = '';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
      if (onSave) onSave(editorTextarea.value);
    };
  } else {
    saveBtn.style.display = '';
    saveBtn.textContent = 'Download';
    saveBtn.onclick = () => {
      // Download the script as a file
      const blob = new Blob([editorTextarea.value], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName || 'script.js';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };
  }
  updateEditorLineNumbers();
}

  const superModNames = [
    'Cyclopedia.js',
    'Hunt Analyzer.js',
    'DashboardButton.js',
    'Dice_Roller.js'
  ];

  const hiddenMods = [
    'inventory-tooltips.js',
    'DashboardButton.js'
  ];

// Helper to normalize mod names for comparison
function normalizeModName(name) {
  return name.replace(/\s+/g, '').toLowerCase();
}

async function renderMods(fileMods) {
  if (window.DEBUG) console.log('DEBUG: fileMods returned from getLocalMods:', fileMods);
  const manualMods = await getManualMods();
  officialModsList.innerHTML = '';
  superModsList.innerHTML = '';
  userModsList.innerHTML = '';
  
  const visibleMods = fileMods.filter(mod => {
    const modFileName = mod.name.split('/').pop();
    return !hiddenMods.some(hidden => 
      normalizeModName(hidden) === normalizeModName(modFileName)
    );
  });
  
  visibleMods.forEach(mod => {
    // Robust comparison for Super Mods
    const modFileName = mod.name.split('/').pop(); // Get just the filename
    const isSuper = superModNames.some(
      n => normalizeModName(n) === normalizeModName(modFileName)
    );
    const card = document.createElement('div');
    card.className = 'mod-card';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'mod-name';
    nameSpan.textContent = modFileName.replace('.js', '').replace(/_/g, ' ');
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<span>' + (isSuper || true ? 'View' : 'Edit') + '</span>';
    editBtn.className = 'unified-btn mod-action-btn';
    editBtn.style.marginLeft = '16px';
    editBtn.onclick = async () => {
      const content = await fetchFileModContent(mod.name);
      setEditorContent(
        mod.displayName || mod.name,
        content,
        false, // read-only for official and super mods
        null,
        mod.name // pass filename for download
      );
    };
    card.appendChild(nameSpan);
    card.appendChild(editBtn);
    if (isSuper) {
      superModsList.appendChild(card);
    } else {
      officialModsList.appendChild(card);
    }
  });
  manualMods.forEach((mod, idx) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'mod-name';
    nameSpan.textContent = mod.name + ' (Manual)';
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<span>Edit</span>';
    editBtn.className = 'unified-btn mod-action-btn';
    editBtn.style.marginLeft = '16px';
    editBtn.onclick = () => {
      setEditorContent(mod.name + ' (Manual)', mod.content, true, async (newContent) => {
        let mods = await getManualMods();
        mods[idx].content = newContent;
        await saveManualMods(mods);
        fetchAndRenderMods();
        if (window.toast) window.toast('Script saved!');
        else alert('Script saved!');
      }, mod.name);
    };
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'unified-btn delete-btn';
    deleteBtn.onclick = async () => {
      if (confirm(`Delete manual mod '${mod.name}'?`)) {
        let mods = await getManualMods();
        mods.splice(idx, 1);
        await saveManualMods(mods);
        fetchAndRenderMods();
        setEditorContent('Code Editor', '', false, null); // Clear the code editor
      }
    };
    card.appendChild(nameSpan);
    card.appendChild(editBtn);
    card.appendChild(deleteBtn);
    userModsList.appendChild(card);
  });
}

async function fetchAndRenderMods() {
  try {
    const mods = await getLocalMods();
    await renderMods(mods);
  } catch (error) {
    alert('Error loading mods: ' + error.message);
  }
}

// Add Script logic
const hashForm = document.getElementById('hash-form');
const hashInput = document.getElementById('hash-input');
const nameInput = document.getElementById('name-input');

function extractGistHash(input) {
  // Gist hash (at least 8 hex chars)
  if (/^[a-f0-9]{8,}$/.test(input)) {
    return input;
  }
  // Gist URL
  const match = input.match(/gist\.github\.com\/(?:[\w-]+\/)?([a-f0-9]{8,})/);
  if (match) {
    return match[1];
  }
  return null;
}

if (hashForm) {
  hashForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const hashInputValue = hashInput.value.trim();
    const name = nameInput.value.trim() || 'Imported Script';
    const gistHash = extractGistHash(hashInputValue);
    if (!gistHash) {
      alert('Please enter a valid GitHub Gist hash or Gist URL.');
      return;
    }
    const url = `https://gist.githubusercontent.com/raw/${gistHash}`;
    let scriptContent = '';
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        scriptContent = await response.text();
      }
    } catch (e) {}
    if (!scriptContent) {
      alert('Failed to fetch script content. Check the Gist hash/URL and your internet connection.');
      return;
    }
    let mods = await getManualMods();
    try {
      mods.push({ name, content: scriptContent, enabled: true });
      await saveManualMods(mods);
      hashInput.value = '';
      nameInput.value = '';
      if (window.toast) window.toast('Script imported!');
      else alert('Script imported!');
      await fetchAndRenderMods();
    } catch (e) {
      alert('Failed to save script.');
    }
  });
}

// Utility: debounce function
function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Add pressed state logic for all dashboard-btn buttons
function addPressedStateListeners(btn) {
  btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
  btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
  btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
  btn.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') btn.classList.add('pressed');
  });
  btn.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') btn.classList.remove('pressed');
  });
}

document.querySelectorAll('.dashboard-btn').forEach(addPressedStateListeners);

// Debug Tools logic
const reloadModsBtn = document.getElementById('reload-mods-btn');
const checkApiBtn = document.getElementById('check-api-btn');
const logStorageBtn = document.getElementById('log-storage-btn');
const resetAllBtn = document.getElementById('reset-all-btn');

if (resetAllBtn) resetAllBtn.addEventListener('click', debounce(async () => {
  if (!confirm('Are you sure you want to reset the entire mod loader? This will remove ALL settings, mods, and data.')) return;
  try {
    // Clear extension storage
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      await new Promise(res => window.browserAPI.storage.local.clear(res));
      if (window.browserAPI.storage.sync) {
        await new Promise(res => window.browserAPI.storage.sync.clear(res));
      }
    }
    // Clear window.localStorage as well
    if (window.localStorage) {
      window.localStorage.clear();
    }
    // Explicitly restore default mods/settings
    if (typeof scanAndRegisterLocalMods === 'function') {
      await scanAndRegisterLocalMods();
    }
    if (window.toast) window.toast('All mod loader data reset!');
    else alert('All mod loader data reset!');
    window.location.reload();
  } catch (e) {
    if (window.toast) window.toast('Failed to reset all data.');
    else alert('Failed to reset all data.');
  }
}, 500));

if (reloadModsBtn) reloadModsBtn.addEventListener('click', debounce(async () => {
  if (!confirm('Are you sure you want to reset local mods? This will remove all official and super mods from storage and reload from disk. User-generated mods will not be affected.')) return;
  try {
    if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
      await window.browserAPI.storage.local.remove(['localMods', 'activeScripts']);
      if (window.browserAPI.storage.sync) {
        await window.browserAPI.storage.sync.remove(['localMods', 'activeScripts']);
      }
    } else if (window.localStorage) {
      window.localStorage.removeItem('localMods');
      window.localStorage.removeItem('activeScripts');
    }
    await new Promise(res => setTimeout(res, 50));
    if (typeof getLocalMods === 'function') {
      await fetchAndRenderMods();
    }
    alert('Local mods reset!');
  } catch (e) {
    alert('Failed to reset local mods.');
  }
}, 500));

if (checkApiBtn) checkApiBtn.addEventListener('click', () => alert('Check BestiaryModAPI (TODO: integrate)'));
if (logStorageBtn) logStorageBtn.addEventListener('click', () => alert('Log Storage Contents (TODO: integrate)'));

// Mods submenu switching logic
const modsSubnavBtns = document.querySelectorAll('.mods-subnav-btn');
const modsSubsections = document.querySelectorAll('.mods-subsection');
modsSubnavBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    modsSubnavBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    modsSubsections.forEach(sec => sec.classList.remove('active'));
    const target = this.dataset.modsSubsection;
    document.getElementById(`mods-${target}-section`).classList.add('active');
  });
});

// Add Script submenu switching logic
const addSubnavBtns = document.querySelectorAll('.add-subnav-btn');
const addSubsections = document.querySelectorAll('.add-subsection');
addSubnavBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    addSubnavBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    addSubsections.forEach(sec => sec.classList.remove('active'));
    const target = this.dataset.addSubsection;
    document.getElementById(`add-${target}-section`).classList.add('active');
  });
});

// Manual mods helpers
const MANUAL_MODS_KEY = 'manualMods';

async function getManualMods() {
  return new Promise(resolve => {
    if (!window.browserAPI || !window.browserAPI.storage || !window.browserAPI.storage.local) return resolve([]);
    window.browserAPI.storage.local.get([MANUAL_MODS_KEY], result => {
      resolve(result[MANUAL_MODS_KEY] || []);
    });
  });
}

async function saveManualMods(mods) {
  return new Promise(resolve => {
    if (!window.browserAPI || !window.browserAPI.storage || !window.browserAPI.storage.local) return resolve();
    window.browserAPI.storage.local.set({ [MANUAL_MODS_KEY]: mods }, resolve);
  });
}

const manualScriptForm = document.getElementById('manual-script-form');
const manualScriptName = document.getElementById('manual-script-name');
const manualScriptContent = document.getElementById('manual-script-content');
if (manualScriptForm) {
  manualScriptForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const name = manualScriptName.value.trim();
    const content = manualScriptContent.value;
    if (name && content) {
      let mods = await getManualMods();
      mods.push({ name, content, enabled: true });
      try {
        await saveManualMods(mods);
        manualScriptName.value = '';
        manualScriptContent.value = '';
        if (window.toast) window.toast('Script saved!');
        else alert('Script saved!');
        await fetchAndRenderMods();
      } catch (e) {
        alert('Failed to save script.');
      }
    }
  });
}

// On page load, set editor blank and readonly
setEditorContent('Code Editor', '', false, null);

const lineNumbers = document.getElementById('editor-line-numbers');
if (lineNumbers && textarea) {
  lineNumbers.addEventListener('wheel', function(e) {
    textarea.scrollTop += e.deltaY;
    e.preventDefault();
  });
}

// Mods group subnav logic
const modsGroupBtns = document.querySelectorAll('.mods-group-subnav-btn');
const modsGroups = document.querySelectorAll('.mods-group');
modsGroupBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    modsGroupBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    modsGroups.forEach(g => {
      g.classList.remove('active');
      g.style.display = 'none';
    });
    const group = this.dataset.modsGroup;
    const groupDiv = document.getElementById(`${group}-mods-group`);
    if (groupDiv) {
      groupDiv.classList.add('active');
      groupDiv.style.display = '';
    }
  });
});

document.addEventListener('DOMContentLoaded', async function() {
  // Check if local storage for official/super mods is empty
  let needsInitialImport = false;
  if (window.browserAPI && window.browserAPI.storage && window.browserAPI.storage.local) {
    const data = await new Promise(resolve => window.browserAPI.storage.local.get(['localMods'], resolve));
    if (!data.localMods || !Array.isArray(data.localMods) || data.localMods.length === 0) {
      needsInitialImport = true;
    }
  } else if (window.localStorage) {
    const localMods = window.localStorage.getItem('localMods');
    if (!localMods || localMods === '[]') {
      needsInitialImport = true;
    }
  }
  if (needsInitialImport) {
    await scanAndRegisterLocalMods();
  }
  await fetchAndRenderMods();
  // ... existing code ...
  const debugCard = document.querySelector('#debug-section .ublock-card');
  if (debugCard) debugCard.appendChild(resetAllBtn);
}); 