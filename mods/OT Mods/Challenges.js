// =======================
// Challenges Mod for Bestiary Arena
// =======================
console.log('[Challenges Mod] Initializing...');

// =======================
// 1. Constants
// =======================

// Same size as Cyclopedia modal (from Super Mods/Cyclopedia.js LAYOUT_CONSTANTS)
const MODAL_WIDTH = 950;
const MODAL_HEIGHT = 700;
// Three-column layout (reference: Cyclopedia.js LAYOUT_CONSTANTS)
const COLUMN_WIDTH = 270;
const COL1_WIDTH = COLUMN_WIDTH - 30;
const COL3_WIDTH = COLUMN_WIDTH + 30;
// UI theming (reference: Cyclopedia.js COLOR_CONSTANTS)
const CHALLENGE_COLORS = { TEXT: '#fff', PRIMARY: '#ffe066', SECONDARY: '#e6d7b0', BORDER: '#444' };

const CHALLENGES_ASSET_PATH = '/assets/challenges/Exalted_Core.gif';

/** Subnav styling (Cyclopedia-like). Injected when opening Challenges modal so subnav works without opening Cyclopedia first. */
const CHALLENGES_SUBNAV_CSS = '.challenges-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; } nav.challenges-subnav > button.challenges-btn, nav.challenges-subnav > button.challenges-btn:hover, nav.challenges-subnav > button.challenges-btn:focus { background: url(\'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png\') repeat !important; border: 6px solid transparent !important; border-color: #ffe066 !important; border-image: url(\'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png\') 6 fill stretch !important; color: var(--theme-text, #e6d7b0) !important; font-weight: 700 !important; border-radius: 0 !important; box-sizing: border-box !important; transition: color 0.2s, border-image 0.1s !important; font-family: \'Trebuchet MS\', \'Arial Black\', Arial, sans-serif !important; outline: none !important; position: relative !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; padding: 7px 24px !important; cursor: pointer; flex: 1 1 0; min-width: 0; } nav.challenges-subnav > button.challenges-btn.active { border-image: url(\'https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png\') 6 fill stretch !important; } nav.challenges-subnav > button.challenges-btn[data-tab="help"] { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; max-width: 42px !important; max-height: 42px !important; flex: 0 0 42px !important; padding: 0 !important; margin-left: 20px !important; }';
const OBSERVER_DEBOUNCE_DELAY = 250;
const OBSERVER_MIN_INTERVAL = 100;
const BUTTON_CHECK_INTERVAL = 1000;
const BUTTON_CHECK_TIMEOUT = 10000;

// Challenge start logic (random map + creatures + CustomBattle)
const CHALLENGE_DEFAULT_VILLAIN_COUNT = 5;
const CHALLENGE_TILE_INDEX_MAX = 99;
const CHALLENGE_CREATURE_GAMEID_MAX = 400;
const CHALLENGE_CUSTOMBATTLES_WAIT_MS = 50;
const CHALLENGE_CUSTOMBATTLES_MAX_RETRIES = 40;
const CHALLENGE_SANDBOX_DELAY_MS = 800;
const CHALLENGE_LEVEL_MIN = 10;
const CHALLENGE_LEVEL_MAX = 200;
const CHALLENGE_GENE_MIN = 0;
const CHALLENGE_GENE_MAX = 50;
const CHALLENGE_EQUIP_STATS = ['ad', 'ap', 'hp'];
const CHALLENGE_EQUIP_TIER_MIN = 1;
const CHALLENGE_EQUIP_TIER_MAX = 5;
const CHALLENGE_EQUIP_GAMEID_MAX = 300;
const CHALLENGE_LEADERBOARD_TOP = 10;
/** Max villain creatures per challenge roll (1 to this value, inclusive). */
const CHALLENGE_MAX_VILLAINS = 10;
/** localStorage key for personal (non-global) challenge runs, keyed by player name. */
const CHALLENGE_PERSONAL_RECORDS_KEY = 'bestiary_challenges_personal';
/** Max personal records kept per player in localStorage. */
const CHALLENGE_PERSONAL_RECORDS_MAX = 10;
/** Delay in ms between each slot reveal (map → creature → equipment → … → summary). */
const ROLL_SLOT_DELAY_MS = 200;
/** Interval in ms between reel "ticks" (one-armed bandit spin). */
const ROLL_REEL_TICK_MS = 70;

/** Grade bonus points added to challenge score (by grade string, case-insensitive). S+ = 1500, each rank below −250. F = 0. */
var CHALLENGE_GRADE_POINTS = {
  's+': 1500,
  's': 1250,
  'a': 1000,
  'b': 750,
  'c': 500,
  'd': 250,
  'f': 0
};

// Firebase (same base URL as Quests/Guilds)
const CHALLENGE_FIREBASE_CONFIG = {
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app'
};

// =======================
// 2. Asset URL Helpers
// =======================

function getChallengesIconUrl() {
  const base = typeof window !== 'undefined' && window.BESTIARY_EXTENSION_BASE_URL;
  if (base) {
    const normalizedBase = base.endsWith('/') ? base : base + '/';
    const path = CHALLENGES_ASSET_PATH.startsWith('/') ? CHALLENGES_ASSET_PATH.slice(1) : CHALLENGES_ASSET_PATH;
    return normalizedBase + path;
  }
  try {
    const api = window.browserAPI || window.chrome || window.browser;
    if (api?.runtime?.getURL) return api.runtime.getURL(CHALLENGES_ASSET_PATH);
  } catch (e) {}
  return CHALLENGES_ASSET_PATH;
}

// =======================
// 2b. Challenge Leaderboard (Firebase)
// =======================

function getChallengeLeaderboardPath() {
  return CHALLENGE_FIREBASE_CONFIG.firebaseUrl + '/challenges/leaderboard';
}

function getCurrentPlayerName() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.player) {
      var ctx = globalThis.state.player.getSnapshot && globalThis.state.player.getSnapshot();
      if (ctx && ctx.context && ctx.context.name) return ctx.context.name;
    }
    if (typeof window !== 'undefined' && window.gameState && window.gameState.player && window.gameState.player.name) {
      return window.gameState.player.name;
    }
  } catch (e) {}
  return 'Unknown';
}

var ChallengeFirebaseService = {
  get: function(path, defaultReturn) {
    defaultReturn = defaultReturn !== undefined ? defaultReturn : null;
    return fetch(path + '.json').then(function(r) {
      if (!r.ok) return r.status === 404 ? defaultReturn : Promise.reject(new Error('GET ' + r.status));
      return r.json();
    }).catch(function(err) {
      console.warn('[Challenges Mod] Firebase GET error:', err);
      return defaultReturn;
    });
  },
  put: function(path, data) {
    return fetch(path + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) {
      if (!r.ok) return Promise.reject(new Error('PUT ' + r.status));
      return r.json();
    });
  }
};

/**
 * Build $replay(...) string from current board.
 * Uses serverResults.seed when available (normal mode); in sandbox mode serverResults is often
 * never set, so we use the serialized board with a fallback seed so the link still saves.
 */
function getChallengeReplayString() {
  try {
    var state = getState();
    if (!state || !state.board) return '';
    var ctx = state.board.getSnapshot && state.board.getSnapshot();
    if (!ctx || !ctx.context) return '';
    var serverResults = ctx.context.serverResults;
    var seed = serverResults && typeof serverResults.seed !== 'undefined' ? serverResults.seed : null;
    var boardJson = null;
    if (typeof window.$serializeBoard === 'function') {
      try { boardJson = JSON.parse(window.$serializeBoard()); } catch (e) {}
    }
    if (!boardJson && window.BestiaryModAPI && window.BestiaryModAPI.utility && typeof window.BestiaryModAPI.utility.serializeBoard === 'function') {
      try { boardJson = JSON.parse(window.BestiaryModAPI.utility.serializeBoard()); } catch (e) {}
    }
    if (!boardJson || !boardJson.board) return '';
    if (seed == null) {
      seed = 0;
    }
    var replayData = {};
    if (boardJson.region) replayData.region = boardJson.region;
    replayData.map = boardJson.map || '';
    replayData.floor = boardJson.floor !== undefined && boardJson.floor !== null ? boardJson.floor : 0;
    replayData.board = boardJson.board;
    replayData.seed = seed;
    return '$replay(' + JSON.stringify(replayData) + ')';
  } catch (e) {
    console.warn('[Challenges Mod] getChallengeReplayString:', e);
    return '';
  }
}

/** Try to get replay with retries (serverResults can appear shortly after victory). */
function getChallengeReplayStringWithRetry(done, maxAttempts) {
  maxAttempts = maxAttempts != null ? maxAttempts : 5;
  var attempt = 0;
  function tryOnce() {
    var replay = getChallengeReplayString();
    if (replay && replay.length > 0) {
      done(replay);
      return;
    }
    attempt++;
    if (attempt >= maxAttempts) {
      done('');
      return;
    }
    setTimeout(tryOnce, attempt * 200);
  }
  tryOnce();
}

/**
 * Save a challenge run: if it makes global top 10, update Firebase; otherwise save locally only.
 * @param {{ name: string, mapName: string, difficulty: number, score: number, replay: string, ticks?: number, grade?: string }} run
 */
function saveChallengeRunToLeaderboard(run) {
  var runEntry = {
    name: run.name || 'Unknown',
    map: run.mapName || '',
    difficulty: run.difficulty,
    score: run.score,
    replay: run.replay || '',
    ticks: run.ticks,
    grade: run.grade
  };
  var path = getChallengeLeaderboardPath();
  ChallengeFirebaseService.get(path, []).then(function(list) {
    var arr = Array.isArray(list) ? list.slice() : [];
    var merged = arr.concat([runEntry]);
    merged.sort(function(a, b) { return (b.score - a.score); });
    var top10 = merged.slice(0, CHALLENGE_LEADERBOARD_TOP);
    var ourIndex = merged.findIndex(function(r) {
      return r.name === runEntry.name && r.score === runEntry.score && (r.map || '') === (runEntry.map || '');
    });
    savePersonalRecordToStorage(runEntry);
    if (ourIndex >= 0 && ourIndex < CHALLENGE_LEADERBOARD_TOP) {
      return ChallengeFirebaseService.put(path, top10).then(function() {
        console.log('[Challenges Mod] Global leaderboard updated with run:', run.name, run.score);
      });
    }
    return Promise.resolve();
  }).catch(function(err) {
    console.warn('[Challenges Mod] Failed to save to leaderboard:', err);
    savePersonalRecordToStorage(runEntry);
  });
}

/**
 * Load leaderboard entries from Firebase.
 * @returns {Promise<Array<{ name: string, map: string, difficulty: number, score: number, replay: string }>>}
 */
function loadChallengeLeaderboard() {
  var path = getChallengeLeaderboardPath();
  return ChallengeFirebaseService.get(path, []).then(function(list) {
    return Array.isArray(list) ? list : [];
  });
}

/**
 * Load personal (non-global) records from localStorage for the current player.
 * @returns {Array<{ name: string, map: string, difficulty: number, score: number, replay: string, ticks?: number, grade?: string }>}
 */
function getPersonalRecordsFromStorage() {
  try {
    var raw = typeof localStorage !== 'undefined' && localStorage.getItem(CHALLENGE_PERSONAL_RECORDS_KEY);
    if (!raw) return [];
    var data = JSON.parse(raw);
    var name = (getCurrentPlayerName() || '').trim();
    var list = (data && data[name]) ? data[name] : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * Append a run to personal records in localStorage (only if not a global record).
 * Keeps top CHALLENGE_PERSONAL_RECORDS_MAX per player.
 * @param {{ name: string, map: string, difficulty: number, score: number, replay: string, ticks?: number, grade?: string }} runEntry
 */
function savePersonalRecordToStorage(runEntry) {
  try {
    var raw = typeof localStorage !== 'undefined' && localStorage.getItem(CHALLENGE_PERSONAL_RECORDS_KEY);
    var data = raw ? JSON.parse(raw) : {};
    var name = (runEntry.name || getCurrentPlayerName() || 'Unknown').trim();
    var list = Array.isArray(data[name]) ? data[name].slice() : [];
    list.push({
      name: name,
      map: runEntry.map || runEntry.mapName || '',
      difficulty: runEntry.difficulty,
      score: runEntry.score,
      replay: runEntry.replay || '',
      ticks: runEntry.ticks,
      grade: runEntry.grade
    });
    list.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
    list = list.slice(0, CHALLENGE_PERSONAL_RECORDS_MAX);
    data[name] = list;
    if (typeof localStorage !== 'undefined') localStorage.setItem(CHALLENGE_PERSONAL_RECORDS_KEY, JSON.stringify(data));
    console.log('[Challenges Mod] Personal record saved locally:', name, runEntry.score);
  } catch (e) {
    console.warn('[Challenges Mod] Failed to save personal record to localStorage:', e);
  }
}

/**
 * Remove one personal run from localStorage (match by map, score, difficulty, replay).
 * @param {{ map: string, difficulty: number, score: number, replay: string }} entry - Entry to remove (as in leaderboard row)
 * @returns {boolean} True if an entry was removed
 */
function deletePersonalRecordFromStorage(entry) {
  try {
    var raw = typeof localStorage !== 'undefined' && localStorage.getItem(CHALLENGE_PERSONAL_RECORDS_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    var name = (getCurrentPlayerName() || 'Unknown').trim();
    var list = Array.isArray(data[name]) ? data[name].slice() : [];
    var match = function(r) {
      return (r.map || '') === (entry.map || '') && r.difficulty === entry.difficulty && r.score === entry.score && (r.replay || '') === (entry.replay || '');
    };
    var idx = list.findIndex(match);
    if (idx < 0) return false;
    list.splice(idx, 1);
    data[name] = list;
    if (typeof localStorage !== 'undefined') localStorage.setItem(CHALLENGE_PERSONAL_RECORDS_KEY, JSON.stringify(data));
    console.log('[Challenges Mod] Personal run deleted from storage:', entry.map, entry.score);
    return true;
  } catch (e) {
    console.warn('[Challenges Mod] Failed to delete personal record:', e);
    return false;
  }
}

/** Reference to open context menu for Challenges (overlay, menu, closeMenu) - only one at a time. */
var challengesOpenContextMenu = null;

/**
 * Show a right-click context menu with "Delete run" for a personal leaderboard row.
 * @param {number} x - Client X position
 * @param {number} y - Client Y position
 * @param {{ map: string, difficulty: number, score: number, replay: string }} entry - Row data
 * @param {Function} onDelete - Called when user chooses Delete run
 * @param {Function} onClose - Called when menu closes (e.g. to refresh list)
 */
function createDeleteRunContextMenu(x, y, entry, onDelete, onClose) {
  if (challengesOpenContextMenu && challengesOpenContextMenu.closeMenu) {
    challengesOpenContextMenu.closeMenu();
  }
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;background:transparent;pointer-events:auto;cursor:default;';
  var menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:9999;min-width:180px;background:url(\'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png\') repeat;border:4px solid transparent;border-image:url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;border-radius:6px;padding:10px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
  var deleteBtn = document.createElement('button');
  deleteBtn.className = 'pixel-font-14';
  var ctxT = (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') ? context.api.i18n.t.bind(context.api.i18n) : function(k) { return k === 'mods.challenges.deleteRun' ? 'Delete run' : k; };
  deleteBtn.textContent = ctxT('mods.challenges.deleteRun');
  deleteBtn.style.cssText = 'display:block;width:100%;padding:8px 12px;text-align:left;background:#1a1a1a;color:#ff6b6b;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:13px;font-weight:bold;box-sizing:border-box;';
  deleteBtn.addEventListener('mouseenter', function() {
    deleteBtn.style.backgroundColor = '#2a2a2a';
    deleteBtn.style.borderColor = '#ff6b6b';
  });
  deleteBtn.addEventListener('mouseleave', function() {
    deleteBtn.style.backgroundColor = '#1a1a1a';
    deleteBtn.style.borderColor = '#555';
  });
  var documentClickHandler = function(e) {
    if (!menu.contains(e.target)) {
      closeMenu();
    }
  };
  function closeMenu() {
    overlay.removeEventListener('mousedown', overlayClickHandler);
    overlay.removeEventListener('click', overlayClickHandler);
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('mousedown', documentClickHandler, true);
    if (menu.parentNode) menu.parentNode.removeChild(menu);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (challengesOpenContextMenu && (challengesOpenContextMenu.overlay === overlay || challengesOpenContextMenu.menu === menu)) {
      challengesOpenContextMenu = null;
    }
    if (onClose) onClose();
  }
  deleteBtn.addEventListener('click', function() {
    onDelete();
    closeMenu();
  });
  menu.appendChild(deleteBtn);
  var overlayClickHandler = function(e) {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
  };
  var escHandler = function(e) {
    if (e.key === 'Escape') closeMenu();
  };
  document.body.appendChild(overlay);
  document.body.appendChild(menu);
  overlay.addEventListener('mousedown', overlayClickHandler);
  overlay.addEventListener('click', overlayClickHandler);
  document.addEventListener('keydown', escHandler);
  document.addEventListener('mousedown', documentClickHandler, true);
  menu.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  menu.addEventListener('click', function(e) { e.stopPropagation(); });
  challengesOpenContextMenu = { overlay: overlay, menu: menu, closeMenu: closeMenu };
}

// =======================
// 3. Modal
// =======================

function openChallengesModal() {
  if (!context.api || !context.api.ui || !context.api.ui.components) {
    console.error('[Challenges Mod] API not available');
    return;
  }
  const api = context.api;
  var challengesFallback = { 'mods.challenges.title': 'Challenges', 'mods.challenges.tabs.solo': 'Solo', 'mods.challenges.tabs.multiplayer': 'Multiplayer', 'mods.challenges.help': 'Help', 'mods.challenges.maps': 'Maps', 'mods.challenges.creatures': 'Creatures', 'mods.challenges.summary': 'Summary', 'mods.challenges.randomize': 'Randomize', 'mods.challenges.skip': 'Skip', 'mods.challenges.start': 'Start', 'mods.challenges.close': 'Close', 'mods.challenges.comingSoon': 'Coming soon.', 'mods.challenges.rolling': 'Rolling…', 'mods.challenges.rollFailed': 'Roll failed', 'mods.challenges.loadSetupTitle': 'Load this challenge setup', 'mods.challenges.mapLabel': 'Map:', 'mods.challenges.creaturesLabel': 'Creatures:', 'mods.challenges.difficultyLabel': 'Difficulty: ', 'mods.challenges.expectedScoreLabel': 'Expected score: ', 'mods.challenges.expectedScoreTitle': 'Score you would get for A rank with 500 ticks', 'mods.challenges.alliesVsEnemiesTitle': 'Allies v Enemies (allies allowed vs number of enemy creatures)', 'mods.challenges.globalTop10': 'Global Top 10', 'mods.challenges.personalTop10': 'Personal Top 10', 'mods.challenges.loading': 'Loading…', 'mods.challenges.rankLabel': 'Rank:', 'mods.challenges.victory': 'Victory!', 'mods.challenges.deleteRun': 'Delete run', 'mods.challenges.helpPanel.howToPlayTitle': 'How to play', 'mods.challenges.helpPanel.howToPlayText': 'Click Randomize to roll a map and creatures, then Start to play the battle. Your score is based on ticks, grade (team size and creatures alive), and difficulty.', 'mods.challenges.helpPanel.title': 'How challenge score is calculated', 'mods.challenges.helpPanel.formula': 'Formula', 'mods.challenges.helpPanel.formulaText': 'Score = round( ( (1000 − ticks) + gradeBonus ) × difficultyMultiplier )', 'mods.challenges.helpPanel.removeTicks': 'Remove Ticks', 'mods.challenges.helpPanel.baseValueTicks': 'Base value: (1000 − ticks).', 'mods.challenges.helpPanel.gradeBonus': 'Grade bonus', 'mods.challenges.helpPanel.gradeSPlus': 'S+ : +1500', 'mods.challenges.helpPanel.gradeS': 'S : +1250', 'mods.challenges.helpPanel.gradeA': 'A : +1000', 'mods.challenges.helpPanel.gradeB': 'B : +750', 'mods.challenges.helpPanel.gradeC': 'C : +500', 'mods.challenges.helpPanel.gradeD': 'D : +250', 'mods.challenges.helpPanel.gradeDescription': 'Grade is from max team size, current team size and creatures alive (time is not used). Defeat = F, 0 points.', 'mods.challenges.helpPanel.gradeF': 'F : +0 (defeat)', 'mods.challenges.helpPanel.difficultyMultiplier': 'Difficulty multiplier', 'mods.challenges.helpPanel.difficultyMultiplierDescription': 'Based on how many allies you were allowed vs how many enemy creatures (e.g. 1 v 5). Raw difficulty is the internal number that encodes how hard the setup is; the displayed/score multiplier is 10 × (raw÷1000)^{power}, so lower difficulties grant more score (steep at the low end). Shown in the summary and leaderboard (e.g. raw 100 → ~3.16×, raw 500 → ~7.07×, raw 1000 → 10×).' };
  const t = function (k) {
    if (api.i18n && typeof api.i18n.t === 'function') {
      try {
        var s = api.i18n.t(k);
        if (s && typeof s === 'string' && s !== k) return s;
      } catch (e) {}
    }
    return challengesFallback[k] != null ? challengesFallback[k] : k;
  };

  // Inject subnav styles (Cyclopedia-like) if not already present
  if (typeof document !== 'undefined' && !document.getElementById('challenges-subnav-css')) {
    var styleEl = document.createElement('style');
    styleEl.id = 'challenges-subnav-css';
    styleEl.textContent = CHALLENGES_SUBNAV_CSS;
    document.head.appendChild(styleEl);
  }

  // Outer wrapper: subnav at top, then tab content area (reference: Cyclopedia.js subnav)
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minHeight: '0',
    overflow: 'hidden'
  });
  // Stop propagation so clicks inside modal don't reach game React (prevents removeChild crash).
  function isLoadSetupButton(target) {
    var el = target && target.nodeType === 1 ? target : (target && target.parentElement);
    if (!el) return false;
    if (el.tagName === 'BUTTON' && el.getAttribute('data-challenges-action') === 'load-setup') return true;
    if (el.closest && el.closest('button[data-challenges-action="load-setup"]')) return true;
    return false;
  }
  function shouldAllowEventToTarget(e) {
    var el = e.target && e.target.nodeType === 1 ? e.target : null;
    if (!el) return false;
    if (isLoadSetupButton(el)) return true;
    if (el.closest && el.closest('.challenges-subnav')) return true;
    return false;
  }
  wrapper.addEventListener('click', function(e) {
    if (!shouldAllowEventToTarget(e)) e.stopPropagation();
  }, true);
  wrapper.addEventListener('mousedown', function(e) {
    if (!shouldAllowEventToTarget(e)) e.stopPropagation();
  }, true);
  wrapper.addEventListener('mouseup', function(e) {
    if (!shouldAllowEventToTarget(e)) e.stopPropagation();
  }, true);
  wrapper.addEventListener('click', function(e) {
    e.stopPropagation();
  }, false);

  // Helper: create a box with title and body (same frame as Global top 10 / Cyclopedia)
  function createPlaceholderBox(titleText, bodyHtml) {
    const box = document.createElement('div');
    box.style.cssText = 'display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; border: 4px solid transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch; border-radius: 6px; overflow: hidden;';
    const titleEl = document.createElement('h2');
    titleEl.className = 'widget-top widget-top-text pixel-font-16';
    titleEl.style.cssText = 'margin: 0; padding: 2px 8px; text-align: center; color: ' + CHALLENGE_COLORS.TEXT + ';';
    const titleP = document.createElement('p');
    titleP.style.cssText = 'margin: 0; padding: 0; text-align: center; color: ' + CHALLENGE_COLORS.TEXT + ';';
    titleP.textContent = titleText;
    titleEl.appendChild(titleP);
    box.appendChild(titleEl);
    const body = document.createElement('div');
    body.className = 'widget-bottom pixel-font-16';
    body.style.cssText = 'flex: 1 1 0; overflow-y: auto; padding: 8px 12px; color: ' + CHALLENGE_COLORS.SECONDARY + '; font-size: 14px; line-height: 1.4; min-height: 0; background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat;';
    body.innerHTML = bodyHtml;
    box.appendChild(body);
    return box;
  }

  // Subnav: Solo | Multiplayer | Help (icon button, wiki-style)
  const tabNav = document.createElement('nav');
  tabNav.className = 'challenges-subnav';
  const tabButtons = [];
  [t('mods.challenges.tabs.solo'), t('mods.challenges.tabs.multiplayer')].forEach(function(tab, i) {
    var btn = document.createElement('button');
    btn.className = 'challenges-btn';
    if (i === 0) btn.classList.add('active');
    btn.type = 'button';
    btn.textContent = tab;
    tabButtons.push(btn);
    tabNav.appendChild(btn);
  });
  var helpBtn = document.createElement('button');
  helpBtn.className = 'challenges-btn';
  helpBtn.setAttribute('data-tab', 'help');
  helpBtn.type = 'button';
  helpBtn.title = t('mods.challenges.help');
  helpBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  tabButtons.push(helpBtn);
  tabNav.appendChild(helpBtn);
  wrapper.appendChild(tabNav);

  // Content area holds the three tab panels
  const contentArea = document.createElement('div');
  Object.assign(contentArea.style, {
    flex: '1 1 0',
    minHeight: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  });

  // Solo panel: three-column layout (current challenge UI)
  const soloPanel = document.createElement('div');
  Object.assign(soloPanel.style, {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: '0',
    minHeight: '0',
    flex: '1 1 0'
  });

  // Multiplayer panel: framed box (same style as Global top 10)
  const multiplayerPanel = document.createElement('div');
  Object.assign(multiplayerPanel.style, {
    display: 'none',
    flex: '1 1 0',
    minHeight: '0',
    overflow: 'hidden',
    flexDirection: 'column',
    padding: '8px'
  });
  multiplayerPanel.appendChild(createPlaceholderBox(t('mods.challenges.tabs.multiplayer'), '<p style="margin:0;">' + t('mods.challenges.comingSoon') + '</p>'));

  // Points panel: framed box with wall of text
  const pointsPanel = document.createElement('div');
  Object.assign(pointsPanel.style, {
    display: 'none',
    flex: '1 1 0',
    minHeight: '0',
    overflow: 'hidden',
    flexDirection: 'column',
    padding: '8px'
  });
  var hp = 'mods.challenges.helpPanel.';
  var pointsBodyHtml = [
    '<p style="margin:0 0 12px 0; color:' + CHALLENGE_COLORS.PRIMARY + '; font-weight:bold;">' + t(hp + 'howToPlayTitle') + '</p>',
    '<p style="margin:0 0 16px 0;">' + t(hp + 'howToPlayText') + '</p>',
    '<p style="margin:0 0 12px 0; color:' + CHALLENGE_COLORS.PRIMARY + '; font-weight:bold;">' + t(hp + 'title') + '</p>',
    '<p style="margin:0 0 8px 0;"><strong>' + t(hp + 'formula') + '</strong></p>',
    '<p style="margin:0 0 16px 0;">' + t(hp + 'formulaText') + '</p>',
    '<p style="margin:0 0 8px 0;"><strong>' + t(hp + 'gradeBonus') + '</strong></p>',
    '<p style="margin:0 0 8px 0;">' + t(hp + 'gradeDescription') + '</p>',
    '<ul style="margin:0 0 16px 0; padding-left:20px;">',
    '<li>' + t(hp + 'gradeSPlus') + '</li>',
    '<li>' + t(hp + 'gradeS') + '</li>',
    '<li>' + t(hp + 'gradeA') + '</li>',
    '<li>' + t(hp + 'gradeB') + '</li>',
    '<li>' + t(hp + 'gradeC') + '</li>',
    '<li>' + t(hp + 'gradeD') + '</li>',
    '<li>' + t(hp + 'gradeF') + '</li>',
    '</ul>',
    '<p style="margin:0 0 8px 0;"><strong>' + t(hp + 'difficultyMultiplier') + '</strong></p>',
    '<p style="margin:0 0 0 0;">' + t(hp + 'difficultyMultiplierDescription').replace('^{power}', '^' + CHALLENGE_DIFFICULTY_POWER) + '</p>'
  ].join('');
  pointsPanel.appendChild(createPlaceholderBox(t('mods.challenges.help'), pointsBodyHtml));

  contentArea.appendChild(soloPanel);
  contentArea.appendChild(multiplayerPanel);
  contentArea.appendChild(pointsPanel);
  wrapper.appendChild(contentArea);

  var challengesActiveTabIndex = 0;
  function setActiveTab(idx) {
    challengesActiveTabIndex = idx;
    tabButtons.forEach(function(btn, i) {
      btn.classList.toggle('active', i === idx);
    });
    soloPanel.style.display = idx === 0 ? 'flex' : 'none';
    multiplayerPanel.style.display = idx === 1 ? 'flex' : 'none';
    pointsPanel.style.display = idx === 2 ? 'flex' : 'none';
    var onSolo = (idx === 0);
    var randomizeBtn = getChallengesRollButton();
    var startBtn = getChallengesStartButton();
    if (randomizeBtn) {
      randomizeBtn.disabled = !onSolo;
      randomizeBtn.style.opacity = onSolo ? '' : '0.5';
      randomizeBtn.style.pointerEvents = onSolo ? '' : 'none';
      randomizeBtn.style.cursor = onSolo ? '' : 'not-allowed';
    }
    if (startBtn) {
      if (onSolo) {
        updateChallengesStartButtonState();
      } else {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
        startBtn.style.pointerEvents = 'none';
        startBtn.style.cursor = 'not-allowed';
      }
    }
  }
  tabButtons.forEach(function(btn, i) {
    btn.addEventListener('click', function() { setActiveTab(i); });
  });

  // Three-column layout lives inside Solo panel (reference: Cyclopedia.js createBestiaryTabPage)
  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: '0',
    minHeight: '0'
  });

  // Summary elements – created first so Col1/Col2 roll handlers can update them (shown in Col1 bottom)
  const summaryMapEl = document.createElement('p');
  summaryMapEl.style.margin = '0 0 4px 0';
  summaryMapEl.textContent = t('mods.challenges.mapLabel') + ' —';
  const summaryCreaturesEl = document.createElement('p');
  summaryCreaturesEl.style.margin = '0';
  summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
  const summaryDifficultyEl = document.createElement('p');
  summaryDifficultyEl.style.margin = '0';
  summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
  summaryDifficultyEl.appendChild(document.createTextNode(t('mods.challenges.difficultyLabel')));
  const summaryDifficultyValueSpan = document.createElement('span');
  summaryDifficultyValueSpan.textContent = '— (— v —)';
  summaryDifficultyEl.appendChild(summaryDifficultyValueSpan);
  const summaryExpectedScoreEl = document.createElement('p');
  summaryExpectedScoreEl.style.margin = '0';
  summaryExpectedScoreEl.title = t('mods.challenges.expectedScoreTitle');
  summaryExpectedScoreEl.appendChild(document.createTextNode(t('mods.challenges.expectedScoreLabel')));
  const summaryExpectedScoreValueSpan = document.createElement('span');
  summaryExpectedScoreValueSpan.textContent = '—';
  summaryExpectedScoreEl.appendChild(summaryExpectedScoreValueSpan);

  // Col1: Top = Maps, Bottom = Summary
  const leftCol = document.createElement('div');
  Object.assign(leftCol.style, {
    width: COL1_WIDTH + 'px',
    minWidth: COL1_WIDTH + 'px',
    flex: '0 0 ' + COL1_WIDTH + 'px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflowY: 'auto',
    minHeight: '0'
  });
  const mapBox = createPlaceholderBox(t('mods.challenges.maps'), '');
  const mapResultContainer = document.createElement('div');
  mapResultContainer.style.cssText = 'margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;';
  mapBox.querySelector('.widget-bottom').innerHTML = '';
  mapBox.querySelector('.widget-bottom').appendChild(mapResultContainer);

  var PLACEHOLDER_ICONS = {
    map: 'https://bestiaryarena.com/assets/icons/minotaurstatue.png',
    creature: 'https://bestiaryarena.com/assets/icons/minotaurstatue.png',
    equip: 'https://bestiaryarena.com/assets/icons/empty-equip.png',
    stats: 'https://bestiaryarena.com/assets/icons/spellbook.png'
  };
  function setMapPlaceholder() {
    mapResultContainer.innerHTML = '';
    var thumb = document.createElement('div');
    thumb.style.cssText = 'width: 128px; height: 128px; background: rgba(68,68,68,0.5); border: 1px solid #555; border-radius: 4px; display: flex; align-items: center; justify-content: center;';
    var thumbImg = document.createElement('img');
    thumbImg.src = PLACEHOLDER_ICONS.map;
    thumbImg.alt = '';
    thumbImg.className = 'pixelated';
    thumbImg.style.cssText = 'width: 80px; height: 80px; object-fit: contain; opacity: 0.7;';
    thumb.appendChild(thumbImg);
    mapResultContainer.appendChild(thumb);
    var nameEl = document.createElement('p');
    nameEl.style.cssText = 'margin: 0; text-align: center; font-size: 14px; color: #888;';
    nameEl.textContent = '—';
    mapResultContainer.appendChild(nameEl);
  }
  setMapPlaceholder();

  leftCol.appendChild(mapBox);
  const summaryBox = createPlaceholderBox(t('mods.challenges.summary'), '');
  summaryBox.querySelector('.widget-bottom').innerHTML = '';
  summaryBox.querySelector('.widget-bottom').appendChild(summaryMapEl);
  summaryBox.querySelector('.widget-bottom').appendChild(summaryCreaturesEl);
  summaryBox.querySelector('.widget-bottom').appendChild(summaryDifficultyEl);
  summaryBox.querySelector('.widget-bottom').appendChild(summaryExpectedScoreEl);
  leftCol.appendChild(summaryBox);

  function getRoomThumbnailUrl(roomId) {
    return '/assets/room-thumbnails/' + (roomId || '') + '.png';
  }

  function setMapResultToRolled(roomId, roomName) {
    mapResultContainer.innerHTML = '';
    var img = document.createElement('img');
    img.src = getRoomThumbnailUrl(roomId);
    img.alt = roomName;
    img.className = 'pixelated';
    img.style.cssText = 'width: 128px; height: 128px; object-fit: cover; border: 1px solid #666; border-radius: 4px;';
    mapResultContainer.appendChild(img);
    var nameEl = document.createElement('p');
    nameEl.style.cssText = 'margin: 0; text-align: center; font-size: 14px;';
    nameEl.textContent = roomName || roomId;
    mapResultContainer.appendChild(nameEl);
  }

  function setMapResultText(text) {
    mapResultContainer.innerHTML = '';
    mapResultContainer.textContent = text;
  }

  var rollState = { isRolling: false, skipRequested: false };

  function delay(ms) {
    if (rollState.skipRequested) return Promise.resolve();
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  /** Compute map roll only; sets rolledRegionId, rolledRoomId, rolledRoomName, etc. Does not update DOM. */
  function computeMapRoll() {
    var regions = getRegions();
    if (!regions.length) throw new Error('No regions loaded');
    var region = pickRandomFromArray(regions, 1)[0];
    var rooms = getRoomsInRegion(region);
    if (!rooms.length) throw new Error(region.name || region.id || 'No rooms');
    var room = pickRandomFromArray(rooms, 1)[0];
    rolledRegionId = region.id;
    rolledRegionName = region.name || region.id || '';
    rolledRoomId = room.id;
    rolledRoomName = getRoomName(room.id) || room.id;
    hasNavigatedWithCurrentRoll = false;
  }

  /** Compute creature specs only; uses rolledRoomId. Sets rolledCreatureSpecs. Does not update DOM. */
  function computeCreaturesRoll() {
    var creatureIds = getAllCreatureGameIds();
    if (!creatureIds.length) throw new Error('No creatures loaded');
    var maxAttempts = 50;
    var attempt = 0;
    var walkable = rolledRoomId ? getWalkableTileIndicesForRoom(rolledRoomId) : null;
    var walkableCount = (walkable && walkable.length) ? walkable.length : 0;
    do {
      attempt++;
      var count = Math.min(CHALLENGE_MAX_VILLAINS, Math.max(1, Math.floor(Math.random() * CHALLENGE_MAX_VILLAINS) + 1));
      var gameIds = [];
      for (var g = 0; g < count; g++) {
        gameIds.push(creatureIds[Math.floor(Math.random() * creatureIds.length)]);
      }
      rolledCreatureSpecs = gameIds.map(function(gameId) {
        return {
          gameId: gameId,
          level: getRandomInt(CHALLENGE_LEVEL_MIN, CHALLENGE_LEVEL_MAX),
          genes: rollRandomGenes(),
          equip: rollRandomEquip()
        };
      });
      var diff = computeChallengeDifficulty(rolledCreatureSpecs);
      if (walkableCount <= 0) break;
      var villainsToPlace = Math.min(rolledCreatureSpecs.length, walkableCount);
      if (villainsToPlace + diff.alliesAllowed <= walkableCount) break;
    } while (attempt < maxAttempts);
    return rolledCreatureSpecs;
  }

  function rollMapHandler() {
    console.log('[Challenges Mod] rollMapHandler() called');
    try {
      computeMapRoll();
      setMapResultToRolled(rolledRoomId, rolledRoomName);
      summaryMapEl.textContent = 'Map: ' + rolledRoomName;
      console.log('[Challenges Mod] rollMap: rolled', rolledRoomName, '(' + rolledRoomId + ')');
    } catch (e) {
      console.error('[Challenges Mod] rollMapHandler error:', e);
      setMapResultText('Error: ' + (e && e.message ? e.message : 'Roll failed'));
    }
  }

  // Col2: Roll creature count (1 to CHALLENGE_MAX_VILLAINS) + creatures
  const middleCol = document.createElement('div');
  Object.assign(middleCol.style, {
    flex: '1 1 0',
    minHeight: '0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflowY: 'auto'
  });
  const creaturesBox = createPlaceholderBox(t('mods.challenges.creatures'), '');
  const creaturesListEl = document.createElement('div');
  creaturesListEl.style.cssText = 'margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;';
  creaturesBox.querySelector('.widget-bottom').innerHTML = '';
  creaturesBox.querySelector('.widget-bottom').appendChild(creaturesListEl);

  /** One blank creature card (same layout as real cards) for placeholder state. */
  function buildBlankCreatureCard() {
    var card = document.createElement('div');
    card.style.cssText = 'display: flex; flex-direction: row; align-items: stretch; gap: 6px; padding: 4px; border: 1px solid #444; border-radius: 4px; background: rgba(0,0,0,0.15); flex-wrap: nowrap;';
    var creatureCol = document.createElement('div');
    creatureCol.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; width: 130px; min-width: 130px; max-width: 130px;';
    var portrait = document.createElement('div');
    portrait.style.cssText = 'width: 48px; height: 48px; background: rgba(68,68,68,0.5); border-radius: 4px; border: 1px solid #555; display: flex; align-items: center; justify-content: center;';
    var portraitImg = document.createElement('img');
    portraitImg.src = PLACEHOLDER_ICONS.creature;
    portraitImg.alt = '';
    portraitImg.className = 'pixelated';
    portraitImg.style.cssText = 'width: 40px; height: 40px; object-fit: contain; opacity: 0.7;';
    portrait.appendChild(portraitImg);
    creatureCol.appendChild(portrait);
    var nameP = document.createElement('p');
    nameP.style.cssText = 'margin: 0; font-size: 11px; color: #666; text-align: center; line-height: 1.2;';
    nameP.textContent = '—';
    creatureCol.appendChild(nameP);
    var levelP = document.createElement('p');
    levelP.style.cssText = 'margin: 0; font-size: 10px; color: #555; line-height: 1.2;';
    levelP.textContent = 'Lv —';
    creatureCol.appendChild(levelP);
    var equipSlot = document.createElement('div');
    equipSlot.style.cssText = 'width: 40px; height: 40px; background: rgba(68,68,68,0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center;';
    var equipImg = document.createElement('img');
    equipImg.src = PLACEHOLDER_ICONS.equip;
    equipImg.alt = '';
    equipImg.className = 'pixelated';
    equipImg.style.cssText = 'width: 32px; height: 32px; object-fit: contain; opacity: 0.7;';
    equipSlot.appendChild(equipImg);
    creatureCol.appendChild(equipSlot);
    card.appendChild(creatureCol);
    var statsPlaceholder = document.createElement('div');
    statsPlaceholder.style.cssText = 'width: 160px; min-width: 160px; height: 80px; background: rgba(68,68,68,0.2); border-radius: 4px; display: flex; align-items: center; justify-content: center;';
    var statsImg = document.createElement('img');
    statsImg.src = PLACEHOLDER_ICONS.stats;
    statsImg.alt = '';
    statsImg.className = 'pixelated';
    statsImg.style.cssText = 'width: 48px; height: 48px; object-fit: contain; opacity: 0.5;';
    statsPlaceholder.appendChild(statsImg);
    card.appendChild(statsPlaceholder);
    return card;
  }

  var CREATURES_PLACEHOLDER_COUNT = 1;
  for (var i = 0; i < CREATURES_PLACEHOLDER_COUNT; i++) {
    creaturesListEl.appendChild(buildBlankCreatureCard());
  }

  middleCol.appendChild(creaturesBox);

  function getCreaturePortraitUrl(gameId) {
    return '/assets/portraits/' + (gameId != null ? gameId : '') + '.png';
  }

  var CHALLENGE_STATS_CONFIG = [
    { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 50, barColor: 'rgb(96, 192, 96)' },
    { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 50, barColor: 'rgb(255, 128, 96)' },
    { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 50, barColor: 'rgb(128, 128, 255)' },
    { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 50, barColor: 'rgb(224, 224, 128)' },
    { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 50, barColor: 'rgb(192, 128, 255)' }
  ];

  function buildChallengeStatsPanel(genes) {
    var g = genes || {};
    var statsDiv = document.createElement('div');
    statsDiv.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-0.5 px-1.5 py-0.5 pb-1 revert-pixel-font-spacing whitespace-nowrap';
    Object.assign(statsDiv.style, {
      flex: '1 1 0',
      textAlign: 'left',
      margin: '2px',
      width: '160px',
      minWidth: '160px',
      height: 'auto',
      minHeight: '0',
      alignSelf: 'center',
      padding: '4px 6px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      boxSizing: 'border-box'
    });
    CHALLENGE_STATS_CONFIG.forEach(function(stat) {
      var value = g[stat.key] !== undefined ? g[stat.key] : 0;
      var maxValue = stat.max || 50;
      var percent = Math.max(0, Math.min(1, value / maxValue));
      var barWidth = Math.round(percent * 100);

      var statRow = document.createElement('div');
      statRow.setAttribute('data-transparent', 'false');
      statRow.className = 'pixel-font-16 whitespace-nowrap text-whiteRegular data-[transparent=\'true\']:opacity-25';
      statRow.style.fontSize = '13px';
      statRow.style.lineHeight = '1.25';

      var topRow = document.createElement('div');
      topRow.className = 'flex justify-between items-center';

      var left = document.createElement('span');
      left.className = 'flex items-center';
      left.style.gap = '2px';
      var icon = document.createElement('img');
      icon.src = stat.icon;
      icon.alt = stat.label;
      icon.style.cssText = 'width: 12px; height: 12px; margin-right: 2px;';
      left.appendChild(icon);
      var nameSpan = document.createElement('span');
      nameSpan.textContent = stat.label;
      left.appendChild(nameSpan);

      var valueSpan = document.createElement('span');
      valueSpan.textContent = value;
      valueSpan.className = 'text-right text-whiteExp';
      valueSpan.style.cssText = 'text-align: right; min-width: 3.5ch; max-width: 5ch; margin-left: 6px; overflow: hidden; white-space: nowrap; display: inline-block;';
      topRow.appendChild(left);
      topRow.appendChild(valueSpan);

      var barRow = document.createElement('div');
      barRow.className = 'relative';
      var barOuter = document.createElement('div');
      barOuter.className = 'h-1 w-full border border-solid border-black bg-black frame-pressed-1 relative overflow-hidden duration-300 fill-mode-forwards gene-stats-bar-filled';
      barOuter.style.animationDelay = '700ms';
      var barFillWrap = document.createElement('div');
      barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';
      var barFill = document.createElement('div');
      barFill.className = 'h-full shrink-0';
      barFill.style.width = barWidth + '%';
      barFill.style.background = stat.barColor || '#666';
      barFillWrap.appendChild(barFill);
      barOuter.appendChild(barFillWrap);
      var barRight = document.createElement('div');
      barRight.className = 'absolute left-full top-1/2 -translate-y-1/2';
      barRight.style.display = 'block';
      var skillBar = document.createElement('div');
      skillBar.className = 'relative text-skillBar';
      var spill1 = document.createElement('div');
      spill1.className = 'spill-particles absolute left-full h-px w-0.5 bg-current';
      var spill2 = document.createElement('div');
      spill2.className = 'spill-particles-2 absolute left-full h-px w-0.5 bg-current';
      skillBar.appendChild(spill1);
      skillBar.appendChild(spill2);
      barRight.appendChild(skillBar);
      barRow.appendChild(barOuter);
      barRow.appendChild(barRight);
      statRow.appendChild(topRow);
      statRow.appendChild(barRow);
      statsDiv.appendChild(statRow);
    });
    return statsDiv;
  }

  /** Appends the equipment portrait to an existing creature card (creatureCol is first child of card). */
  function addEquipmentToCreatureCard(card, spec) {
    if (!spec.equip || !api || !api.ui || !api.ui.components || typeof api.ui.components.createItemPortrait !== 'function') return;
    var creatureCol = card.firstElementChild;
    if (!creatureCol) return;
    try {
      var eqData = getState() && getState().utils && getState().utils.getEquipment ? getState().utils.getEquipment(spec.equip.gameId) : null;
      var itemId = (eqData && eqData.metadata && eqData.metadata.spriteId) ? eqData.metadata.spriteId : spec.equip.gameId;
      var equipPortrait = api.ui.components.createItemPortrait({
        itemId: itemId,
        tier: spec.equip.tier || 1,
        stat: spec.equip.stat || 'ad'
      });
      if (equipPortrait && equipPortrait.nodeType === 1) {
        var portraitEl = equipPortrait.tagName === 'BUTTON' && equipPortrait.firstChild ? equipPortrait.firstChild : equipPortrait;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display: flex; justify-content: center; align-items: center; width: 40px; height: 40px; flex-shrink: 0;';
        portraitEl.style.position = 'relative';
        wrap.appendChild(portraitEl);
        creatureCol.appendChild(wrap);
      }
    } catch (e) {
      console.warn('[Challenges Mod] createItemPortrait failed:', e);
    }
  }

  /** opts.showEquipment: if false, creature card is built without the equipment portrait (for slot reveal). Default true. */
  function buildCreatureCard(spec, opts) {
    var showEquipment = opts && opts.hasOwnProperty('showEquipment') ? opts.showEquipment : true;
    var name = getCreatureName(spec.gameId);
    var difficultyContrib = getCreatureDifficultyContribution(spec);
    var creatureMult = getCreatureDifficultyMultiplier(name);
    var equipMult = (spec.equip && spec.equip.gameId != null) ? getEquipmentDifficultyMultiplier(getEquipmentName(spec.equip.gameId)) : 1;
    var difficultyTooltip = 'Difficulty: ' + difficultyContrib;
    if (creatureMult !== 1) difficultyTooltip += ' (creature ×' + creatureMult + ')';
    if (equipMult !== 1) difficultyTooltip += ' (equip ×' + equipMult + ')';

    var card = document.createElement('div');
    card.style.cssText = 'display: flex; flex-direction: row; align-items: stretch; gap: 6px; padding: 4px; border: 1px solid #555; border-radius: 4px; background: rgba(0,0,0,0.2); flex-wrap: nowrap;';
    card.title = difficultyTooltip;

    var creatureCol = document.createElement('div');
    creatureCol.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; width: 130px; min-width: 130px; max-width: 130px;';
    var img = document.createElement('img');
    img.src = getCreaturePortraitUrl(spec.gameId);
    img.alt = name;
    img.className = 'pixelated';
    img.style.cssText = 'width: 48px; height: 48px; object-fit: cover; border-radius: 4px; border: 1px solid #555;';
    creatureCol.appendChild(img);
    var nameP = document.createElement('p');
    nameP.style.cssText = 'margin: 0; font-size: 11px; font-weight: bold; text-align: center; line-height: 1.2;';
    nameP.textContent = name;
    creatureCol.appendChild(nameP);
    var levelP = document.createElement('p');
    levelP.style.cssText = 'margin: 0; font-size: 10px; line-height: 1.2;';
    levelP.textContent = 'Lv ' + (spec.level != null ? spec.level : '?');
    creatureCol.appendChild(levelP);
    if (showEquipment && spec.equip && api && api.ui && api.ui.components && typeof api.ui.components.createItemPortrait === 'function') {
      try {
        var eqData = getState() && getState().utils && getState().utils.getEquipment ? getState().utils.getEquipment(spec.equip.gameId) : null;
        var itemId = (eqData && eqData.metadata && eqData.metadata.spriteId) ? eqData.metadata.spriteId : spec.equip.gameId;
        var equipPortrait = api.ui.components.createItemPortrait({
          itemId: itemId,
          tier: spec.equip.tier || 1,
          stat: spec.equip.stat || 'ad'
        });
        if (equipPortrait && equipPortrait.nodeType === 1) {
          var portraitEl = equipPortrait.tagName === 'BUTTON' && equipPortrait.firstChild ? equipPortrait.firstChild : equipPortrait;
          var wrap = document.createElement('div');
          wrap.style.cssText = 'display: flex; justify-content: center; align-items: center; width: 40px; height: 40px; flex-shrink: 0;';
          portraitEl.style.position = 'relative';
          wrap.appendChild(portraitEl);
          creatureCol.appendChild(wrap);
        }
      } catch (e) {
        console.warn('[Challenges Mod] createItemPortrait failed:', e);
      }
    }
    card.appendChild(creatureCol);

    var statsCol = buildChallengeStatsPanel(spec.genes);
    card.appendChild(statsCol);
    return card;
  }

  /** Minimal creature card for reel spin (portrait + name + Lv ? + placeholder stats). */
  function buildReelCreatureCard(gameId) {
    var name = getCreatureName(gameId);
    var card = document.createElement('div');
    card.style.cssText = 'display: flex; flex-direction: row; align-items: stretch; gap: 6px; padding: 4px; border: 1px solid #555; border-radius: 4px; background: rgba(0,0,0,0.2); flex-wrap: nowrap;';
    var creatureCol = document.createElement('div');
    creatureCol.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; width: 130px; min-width: 130px; max-width: 130px;';
    var img = document.createElement('img');
    img.src = getCreaturePortraitUrl(gameId);
    img.alt = name;
    img.className = 'pixelated';
    img.style.cssText = 'width: 48px; height: 48px; object-fit: cover; border-radius: 4px; border: 1px solid #555;';
    creatureCol.appendChild(img);
    var nameP = document.createElement('p');
    nameP.style.cssText = 'margin: 0; font-size: 11px; font-weight: bold; text-align: center; line-height: 1.2;';
    nameP.textContent = name;
    creatureCol.appendChild(nameP);
    var levelP = document.createElement('p');
    levelP.style.cssText = 'margin: 0; font-size: 10px; line-height: 1.2;';
    levelP.textContent = 'Lv ?';
    creatureCol.appendChild(levelP);
    card.appendChild(creatureCol);
    var statsPlaceholder = document.createElement('div');
    statsPlaceholder.style.cssText = 'width: 160px; min-width: 160px; height: 80px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;';
    statsPlaceholder.textContent = '…';
    card.appendChild(statsPlaceholder);
    return card;
  }

  /** Spin map reel then land on final room. Returns Promise. */
  function spinMapReel(allRooms, finalRoomId, finalRoomName, durationMs) {
    if (!allRooms.length) {
      setMapResultToRolled(finalRoomId, finalRoomName);
      return Promise.resolve();
    }
    if (rollState.skipRequested) {
      setMapResultToRolled(finalRoomId, finalRoomName);
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      var interval = setInterval(function() {
        if (rollState.skipRequested) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          setMapResultToRolled(finalRoomId, finalRoomName);
          resolve();
          return;
        }
        var r = allRooms[Math.floor(Math.random() * allRooms.length)];
        setMapResultToRolled(r.roomId, r.roomName);
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        setMapResultToRolled(finalRoomId, finalRoomName);
        resolve();
      }, durationMs);
    });
  }

  /** Spin creature reel then land on final spec. Appends final card to parentEl. Returns Promise. */
  function spinCreatureReel(creatureIds, finalSpec, parentEl, durationMs) {
    if (!creatureIds.length) {
      var card = buildCreatureCard(finalSpec, { showEquipment: false });
      parentEl.appendChild(card);
      return Promise.resolve(card);
    }
    if (rollState.skipRequested) {
      var card = buildCreatureCard(finalSpec, { showEquipment: false });
      parentEl.appendChild(card);
      return Promise.resolve(card);
    }
    return new Promise(function(resolve) {
      var reelCard = buildReelCreatureCard(creatureIds[0]);
      parentEl.appendChild(reelCard);
      var interval = setInterval(function() {
        if (rollState.skipRequested) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          reelCard.remove();
          var card = buildCreatureCard(finalSpec, { showEquipment: false });
          parentEl.appendChild(card);
          resolve(card);
          return;
        }
        var nextId = creatureIds[Math.floor(Math.random() * creatureIds.length)];
        var next = buildReelCreatureCard(nextId);
        reelCard.replaceWith(next);
        reelCard = next;
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        reelCard.remove();
        var card = buildCreatureCard(finalSpec, { showEquipment: false });
        parentEl.appendChild(card);
        resolve(card);
      }, durationMs);
    });
  }

  /** Spin equipment placeholder then reveal real equipment on card. Returns Promise. */
  function spinEquipmentReel(card, spec, durationMs) {
    var creatureCol = card && card.firstElementChild;
    if (!creatureCol) {
      addEquipmentToCreatureCard(card, spec);
      return Promise.resolve();
    }
    if (rollState.skipRequested) {
      addEquipmentToCreatureCard(card, spec);
      return Promise.resolve();
    }
    var placeholder = document.createElement('div');
    placeholder.style.cssText = 'display: flex; justify-content: center; align-items: center; width: 40px; height: 40px; flex-shrink: 0; color: #888; font-size: 18px;';
    placeholder.textContent = '?';
    creatureCol.appendChild(placeholder);
    return new Promise(function(resolve) {
      var ticks = 0;
      var interval = setInterval(function() {
        if (rollState.skipRequested) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          placeholder.remove();
          addEquipmentToCreatureCard(card, spec);
          resolve();
          return;
        }
        placeholder.textContent = ticks % 2 === 0 ? '?' : '…';
        ticks++;
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        placeholder.remove();
        addEquipmentToCreatureCard(card, spec);
        resolve();
      }, durationMs);
    });
  }

  function rollCreaturesHandler() {
    console.log('[Challenges Mod] rollCreaturesHandler() called');
    try {
      computeCreaturesRoll();
      creaturesListEl.innerHTML = '';
      rolledCreatureSpecs.forEach(function(spec) {
        creaturesListEl.appendChild(buildCreatureCard(spec));
      });
      var names = rolledCreatureSpecs.map(function(s) { return getCreatureName(s.gameId); });
      summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' ' + rolledCreatureSpecs.length;
      var diff = computeChallengeDifficulty(rolledCreatureSpecs);
      var mult = getDifficultyMultiplier(diff.difficulty);
      var enemyCount = rolledCreatureSpecs.length;
      summaryDifficultyValueSpan.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
      summaryDifficultyValueSpan.style.color = getDifficultyColor(mult) || '';
      summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
      summaryExpectedScoreValueSpan.textContent = '~' + (Math.round(computeChallengeScore(500, diff.difficulty, 'A') / 100) * 100);
      console.log('[Challenges Mod] rollCreatures: rolled', rolledCreatureSpecs.length, names.join(', '), 'difficulty', diff.difficulty, 'allies', diff.alliesAllowed);
    } catch (e) {
      console.error('[Challenges Mod] rollCreaturesHandler error:', e);
      creaturesListEl.innerHTML = '';
      creaturesListEl.textContent = 'Error: ' + (e && e.message ? e.message : 'Roll failed');
    }
  }

  function getChallengesRollButton() {
    var dialogs = document.querySelectorAll('div[role="dialog"]');
    for (var d = 0; d < dialogs.length; d++) {
      var btn = dialogs[d].querySelector('[data-challenges-btn="randomize"]');
      if (btn) return btn;
    }
    return null;
  }

  function getChallengesStartButton() {
    var dialogs = document.querySelectorAll('div[role="dialog"]');
    for (var d = 0; d < dialogs.length; d++) {
      var startBtn = dialogs[d].querySelector('[data-challenges-btn="start"]');
      if (startBtn && dialogs[d].querySelector('[data-challenges-btn="randomize"]')) return startBtn;
    }
    return null;
  }

  function updateChallengesStartButtonState() {
    var startBtn = getChallengesStartButton();
    if (!startBtn) return;
    if (challengesActiveTabIndex !== 0) {
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.pointerEvents = 'none';
      startBtn.style.cursor = 'not-allowed';
      return;
    }
    var canStart = !!(rolledRoomId && rolledCreatureSpecs && rolledCreatureSpecs.length && !hasNavigatedWithCurrentRoll);
    startBtn.disabled = !canStart;
    startBtn.style.pointerEvents = ''; // clear grey-out from Multiplayer/Help tab
    if (canStart) {
      startBtn.style.backgroundImage = 'url(' + CHALLENGE_GREEN_BG + ')';
      startBtn.style.backgroundSize = 'cover';
      startBtn.style.backgroundPosition = 'center';
      startBtn.style.color = (CHALLENGE_COLORS && CHALLENGE_COLORS.TEXT) || '#fff';
      startBtn.style.opacity = '1';
      startBtn.style.cursor = 'pointer';
    } else {
      startBtn.style.backgroundImage = 'none';
      startBtn.style.backgroundColor = '#555';
      startBtn.style.color = '#999';
      startBtn.style.opacity = '0.7';
      startBtn.style.cursor = 'not-allowed';
    }
  }

  function finishRollState() {
    rollState.isRolling = false;
    rollState.skipRequested = false;
    var rollBtn = getChallengesRollButton();
    if (rollBtn) {
      rollBtn.textContent = t('mods.challenges.randomize');
      rollBtn.disabled = (challengesActiveTabIndex !== 0);
      rollBtn.style.opacity = (challengesActiveTabIndex === 0) ? '' : '0.5';
      rollBtn.style.pointerEvents = (challengesActiveTabIndex === 0) ? '' : 'none';
      rollBtn.style.cursor = (challengesActiveTabIndex === 0) ? '' : 'not-allowed';
    }
    updateChallengesStartButtonState();
  }

  function rollMapAndCreaturesHandler() {
    if (rollState.isRolling) {
      rollState.skipRequested = true;
      return;
    }
    var rollBtn = getChallengesRollButton();
    rollState.isRolling = true;
    rollState.skipRequested = false;
    if (rollBtn) {
      rollBtn.textContent = t('mods.challenges.skip');
      rollBtn.disabled = false;
    }
    setMapResultText(t('mods.challenges.rolling'));
    creaturesListEl.innerHTML = '';
    creaturesListEl.textContent = t('mods.challenges.rolling');
    creaturesListEl.style.textAlign = 'center';
    summaryMapEl.textContent = t('mods.challenges.mapLabel') + ' —';
    summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
    summaryDifficultyValueSpan.textContent = '— (— v —)';
    summaryDifficultyValueSpan.style.color = '';
    summaryExpectedScoreValueSpan.textContent = '—';

    (function runSlotRoll() {
      var roomId, roomName, specs;
      try {
        computeMapRoll();
        roomId = rolledRoomId;
        roomName = rolledRoomName;
        specs = computeCreaturesRoll();
      } catch (e) {
        console.error('[Challenges Mod] slot roll error:', e);
        var errMsg = (e && e.message ? e.message : t('mods.challenges.rollFailed'));
        setMapResultText('Error: ' + errMsg);
        creaturesListEl.textContent = 'Error: ' + errMsg;
        creaturesListEl.style.textAlign = '';
        finishRollState();
        return;
      }

      var allRooms = getAllRoomsForReel();
      var creatureIds = getAllCreatureGameIds();

      function runCreatureEquipmentSequence(index) {
        if (index >= specs.length) {
          return delay(ROLL_SLOT_DELAY_MS).then(function() {
            summaryMapEl.textContent = t('mods.challenges.mapLabel') + ' ' + roomName;
            summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' ' + specs.length;
            var diff = computeChallengeDifficulty(specs);
            var mult = getDifficultyMultiplier(diff.difficulty);
            var enemyCount = specs.length;
            summaryDifficultyValueSpan.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
            summaryDifficultyValueSpan.style.color = getDifficultyColor(mult) || '';
            summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
            summaryExpectedScoreValueSpan.textContent = '~' + (Math.round(computeChallengeScore(500, diff.difficulty, 'A') / 100) * 100);
            finishRollState();
          });
        }
        return spinCreatureReel(creatureIds, specs[index], creaturesListEl, ROLL_SLOT_DELAY_MS)
          .then(function(card) {
            return spinEquipmentReel(card, specs[index], ROLL_SLOT_DELAY_MS);
          })
          .then(function() {
            return runCreatureEquipmentSequence(index + 1);
          });
      }

      spinMapReel(allRooms, roomId, roomName, ROLL_SLOT_DELAY_MS).then(function() {
        creaturesListEl.textContent = '';
        creaturesListEl.style.textAlign = '';
        if (specs.length === 0) {
          summaryMapEl.textContent = t('mods.challenges.mapLabel') + ' ' + roomName;
          summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
          summaryDifficultyValueSpan.textContent = '— (— v —)';
          summaryDifficultyValueSpan.style.color = '';
          summaryExpectedScoreValueSpan.textContent = '—';
          finishRollState();
          return;
        }
        runCreatureEquipmentSequence(0);
      });
    })();
  }

  // Col3: Global top 10 + Personal top 10 (two boxes)
  const rightCol = document.createElement('div');
  Object.assign(rightCol.style, {
    width: COL3_WIDTH + 'px',
    minWidth: COL3_WIDTH + 'px',
    flex: '0 0 ' + COL3_WIDTH + 'px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflowY: 'auto',
    minHeight: '0'
  });
  const globalLeaderboardBox = createPlaceholderBox(t('mods.challenges.globalTop10'), '');
  const leaderboardBody = globalLeaderboardBox.querySelector('.widget-bottom');
  leaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loading') + '</p>';
  rightCol.appendChild(globalLeaderboardBox);

  const personalLeaderboardBox = createPlaceholderBox(t('mods.challenges.personalTop10'), '');
  const personalLeaderboardBody = personalLeaderboardBox.querySelector('.widget-bottom');
  personalLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loading') + '</p>';
  rightCol.appendChild(personalLeaderboardBox);

  var CHALLENGE_BLUE_BG_URL = 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png';

  function buildLeaderboardTable(entries, showNameColumn, highlightCurrentUser, onDeleteRun) {
    highlightCurrentUser = highlightCurrentUser && showNameColumn;
    var currentName = highlightCurrentUser ? (getCurrentPlayerName() || '').trim() : '';
    var table = document.createElement('div');
    table.style.cssText = 'display:table; width:100%; font-size:12px; border-collapse: collapse;';
    var thead = document.createElement('div');
    thead.style.cssText = 'display:table-row; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + ';';
    var headers = showNameColumn ? ['Name', 'Map', 'Diff', 'Score', ''] : ['Map', 'Diff', 'Score', ''];
    headers.forEach(function(label) {
      var th = document.createElement('div');
      th.style.cssText = 'display:table-cell; padding:2px 4px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + ';';
      th.textContent = label;
      thead.appendChild(th);
    });
    table.appendChild(thead);
    entries.forEach(function(row) {
      var tr = document.createElement('div');
      tr.style.cssText = 'display:table-row; color:' + CHALLENGE_COLORS.SECONDARY + ';';
      if (onDeleteRun) {
        tr.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          createDeleteRunContextMenu(e.clientX, e.clientY, row, function() {
            if (deletePersonalRecordFromStorage(row)) {
              var updated = getPersonalRecordsFromStorage().slice(0, 10);
              renderPersonalLeaderboard(updated);
            }
          }, function() {});
        });
      }
      if (showNameColumn) {
        var nameCell = document.createElement('a');
        nameCell.href = 'https://bestiaryarena.com/profile/' + encodeURIComponent(row.name || '');
        nameCell.target = '_blank';
        nameCell.rel = 'noopener noreferrer';
        nameCell.style.cssText = 'display:table-cell; padding:2px 4px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + '; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:' + CHALLENGE_COLORS.PRIMARY + '; text-decoration:none;';
        nameCell.textContent = row.name || '—';
        nameCell.title = row.name ? (row.name + ' (open profile)') : '';
        tr.appendChild(nameCell);
      }
      var mapCell = document.createElement('div');
      mapCell.style.cssText = 'display:table-cell; padding:2px 4px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + '; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
      mapCell.textContent = row.map || '—';
      mapCell.title = row.map || '';
      tr.appendChild(mapCell);
      var diffCell = document.createElement('div');
      diffCell.style.cssText = 'display:table-cell; padding:2px 4px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + ';';
      diffCell.textContent = row.difficulty != null ? getDifficultyMultiplier(row.difficulty).toFixed(2) + '×' : '—';
      tr.appendChild(diffCell);
      var scoreCell = document.createElement('div');
      scoreCell.style.cssText = 'display:table-cell; padding:2px 4px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + '; cursor:help;';
      scoreCell.textContent = row.score != null ? row.score : '—';
      scoreCell.title = getScoreBreakdownText(row);
      tr.appendChild(scoreCell);
      var replayCell = document.createElement('div');
      replayCell.style.cssText = 'display:table-cell; padding:2px 4px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + '; text-align:center;';
      if (row.replay && row.replay.length > 0) {
        var replayBtn = document.createElement('button');
        replayBtn.type = 'button';
        replayBtn.setAttribute('data-challenges-action', 'load-setup');
        replayBtn.title = t('mods.challenges.loadSetupTitle');
        replayBtn.innerHTML = '▶';
        replayBtn.style.cssText = 'background:none; border:none; color:' + CHALLENGE_COLORS.PRIMARY + '; cursor:pointer; padding:0 4px; font-size:14px;';
        replayBtn.addEventListener('click', function() {
          var text = row.replay;
          if (!text) return;
          try {
            var parsed = JSON.parse(text);
            if (parsed && parsed.roomId && parsed.villains && Array.isArray(parsed.villains) && parsed.villains.length > 0) {
              startChallengeWithVillainConfig(parsed);
            } else {
              copyReplayToClipboard(text);
            }
          } catch (e) {
            copyReplayToClipboard(text);
          }
        });
        replayCell.appendChild(replayBtn);
      } else {
        replayCell.textContent = '—';
      }
      tr.appendChild(replayCell);
      if (highlightCurrentUser && (row.name || '').trim() === currentName) {
        for (var c = 0; c < tr.children.length; c++) {
          tr.children[c].style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG_URL + ')';
          tr.children[c].style.backgroundSize = 'cover';
          tr.children[c].style.backgroundPosition = 'center';
          tr.children[c].style.color = CHALLENGE_COLORS.TEXT;
        }
      }
      table.appendChild(tr);
    });
    return table;
  }

  function renderChallengeLeaderboard(entries) {
    leaderboardBody.innerHTML = '';
    if (!entries || entries.length === 0) {
      leaderboardBody.innerHTML = '<p style="margin:0;color:#888;">No runs yet. Complete a challenge to appear here.</p>';
      return;
    }
    var globalTop10 = entries.slice(0, CHALLENGE_LEADERBOARD_TOP);
    leaderboardBody.appendChild(buildLeaderboardTable(globalTop10, true, true));
  }

  function renderPersonalLeaderboard(personalEntries) {
    personalLeaderboardBody.innerHTML = '';
    if (!personalEntries || !personalEntries.length) {
      personalLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">No personal runs yet.</p>';
      return;
    }
    personalLeaderboardBody.appendChild(buildLeaderboardTable(personalEntries, false, false, true));
  }

  loadChallengeLeaderboard().then(function(entries) {
    renderChallengeLeaderboard(entries || []);
  }).catch(function() {
    leaderboardBody.innerHTML = '<p style="margin:0;color:#888;">Could not load leaderboard.</p>';
  });
  // Personal: only locally saved runs (localStorage), top 10
  var personalEntries = getPersonalRecordsFromStorage().slice(0, 10);
  renderPersonalLeaderboard(personalEntries);

  container.appendChild(leftCol);
  container.appendChild(middleCol);
  container.appendChild(rightCol);
  soloPanel.appendChild(container);

  function restoreLastRollInModal() {
    if (rolledRoomId && rolledRoomName) {
      setMapResultToRolled(rolledRoomId, rolledRoomName);
      summaryMapEl.textContent = 'Map: ' + rolledRoomName;
    }
    if (rolledCreatureSpecs && rolledCreatureSpecs.length) {
      creaturesListEl.innerHTML = '';
      rolledCreatureSpecs.forEach(function(spec) {
        creaturesListEl.appendChild(buildCreatureCard(spec));
      });
      var names = rolledCreatureSpecs.map(function(s) { return getCreatureName(s.gameId); });
      summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' ' + rolledCreatureSpecs.length;
      var diff = computeChallengeDifficulty(rolledCreatureSpecs);
      var mult = getDifficultyMultiplier(diff.difficulty);
      var enemyCount = rolledCreatureSpecs.length;
      summaryDifficultyValueSpan.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
      summaryDifficultyValueSpan.style.color = getDifficultyColor(mult) || '';
      summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
      summaryExpectedScoreValueSpan.textContent = '~' + (Math.round(computeChallengeScore(500, diff.difficulty, 'A') / 100) * 100);
    }
  }
  restoreLastRollInModal();
  updateChallengesStartButtonState();

  // Roll (map + creatures) / Start as modal footer buttons. Start: close modal then run challenge (sandbox + execute).
  api.ui.components.createModal({
    title: t('mods.challenges.title'),
    width: MODAL_WIDTH,
    height: MODAL_HEIGHT,
    content: wrapper,
    buttons: [
      { text: t('mods.challenges.randomize'), primary: false, onClick: rollMapAndCreaturesHandler, closeOnClick: false },
      {
        text: t('mods.challenges.start'),
        primary: true,
        onClick: function(e, modalObj) {
          if (modalObj && typeof modalObj.close === 'function') modalObj.close();
          startChallenge();
        },
        closeOnClick: false
      },
      { text: t('mods.challenges.close'), primary: false }
    ]
  });

  // Force modal and inner content to use full size; style footer Randomize (blue) and Start (green) buttons
  var CHALLENGE_GREEN_BG = 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png';
  var CHALLENGE_BLUE_BG = 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png';
  setTimeout(function() {
    var dialog = document.querySelector('div[role="dialog"][data-state="open"]') || document.querySelector('div[role="dialog"]');
    if (!dialog) return;
    dialog.classList.remove('max-w-[300px]');
    dialog.style.width = MODAL_WIDTH + 'px';
    dialog.style.minWidth = MODAL_WIDTH + 'px';
    dialog.style.maxWidth = MODAL_WIDTH + 'px';
    dialog.style.height = MODAL_HEIGHT + 'px';
    dialog.style.minHeight = MODAL_HEIGHT + 'px';
    var footer = dialog.querySelector('.flex.justify-end.gap-2');
    if (footer) {
      var fb = footer.querySelectorAll('button');
      if (fb[0]) fb[0].setAttribute('data-challenges-btn', 'randomize');
      if (fb[1]) fb[1].setAttribute('data-challenges-btn', 'start');
      if (fb[2]) fb[2].setAttribute('data-challenges-btn', 'close');
    }
    var innerContent = dialog.firstElementChild;
    if (innerContent) {
      innerContent.style.display = 'flex';
      innerContent.style.flexDirection = 'column';
      innerContent.style.height = '100%';
      innerContent.style.minHeight = '0';
    }
    var widgetBottom = dialog.querySelector('.widget-bottom');
    if (widgetBottom) {
      widgetBottom.style.flex = '1 1 0';
      widgetBottom.style.minHeight = '0';
      widgetBottom.style.height = '100%';
      widgetBottom.style.display = 'flex';
      widgetBottom.style.flexDirection = 'column';
      widgetBottom.style.overflow = 'hidden';
    }
    var randomizeBtn = getChallengesRollButton();
    if (randomizeBtn) {
      randomizeBtn.style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG + ')';
      randomizeBtn.style.backgroundSize = 'cover';
      randomizeBtn.style.backgroundPosition = 'center';
      randomizeBtn.style.color = (CHALLENGE_COLORS && CHALLENGE_COLORS.TEXT) || '#fff';
    }
    updateChallengesStartButtonState();
  }, 100);
}

// =======================
// 3b. Challenge Start Logic
// =======================
// Roll map + roll creatures, then Start executes that challenge (CustomBattle).

let challengeBattle = null;
let challengeRoomId = null;
let challengeSetupDone = false;
let challengeBoardUnsubscribe = null;

// Rolled challenge settings (set by Roll map / Roll creatures in modal)
let rolledRegionId = null;
let rolledRegionName = null;
let rolledRoomId = null;
let rolledRoomName = null;
let rolledCreatureSpecs = null;
/** True after Start was used for the current roll; cleared when user rolls a new map. */
let hasNavigatedWithCurrentRoll = false;

function getState() {
  return (typeof globalThis !== 'undefined' && globalThis.state) || (typeof window !== 'undefined' && window.state) || null;
}

// Regions/maps per mod_development_guide, database/maps-database.js, Cyclopedia.js safeGetRegions / REGIONS
function getRegions() {
  try {
    var state = getState();
    var utils = state && state.utils;
    if (utils && utils.REGIONS && Array.isArray(utils.REGIONS)) {
      return utils.REGIONS;
    }
    console.log('[Challenges Mod] getRegions: no REGIONS in state');
  } catch (e) {
    console.warn('[Challenges Mod] getRegions error:', e);
  }
  var mapsDb = (typeof window !== 'undefined' && window.mapsDatabase) ? window.mapsDatabase : null;
  if (mapsDb && typeof mapsDb.getAllMaps === 'function') {
    var maps = mapsDb.getAllMaps();
    if (Array.isArray(maps) && maps.length) {
      console.log('[Challenges Mod] getRegions: fallback mapsDatabase.getAllMaps, count =', maps.length);
      return [{ id: 'fallback', name: 'Maps', rooms: maps }];
    }
  }
  return [];
}

function getRoomsInRegion(region) {
  if (!region || !region.rooms || !Array.isArray(region.rooms)) return [];
  return region.rooms;
}

function getRoomName(roomId) {
  try {
    var state = getState();
    if (state && state.utils && state.utils.ROOM_NAME && state.utils.ROOM_NAME[roomId])
      return state.utils.ROOM_NAME[roomId];
  } catch (e) {}
  return roomId || '';
}

/** All rooms for reel spin (flat list of { roomId, roomName }). */
function getAllRoomsForReel() {
  var regions = getRegions();
  var out = [];
  for (var i = 0; i < regions.length; i++) {
    var rooms = getRoomsInRegion(regions[i]);
    for (var j = 0; j < rooms.length; j++) {
      var r = rooms[j];
      if (r && r.id) out.push({ roomId: r.id, roomName: getRoomName(r.id) || r.id });
    }
  }
  return out;
}

// Walkable tile indices for a room (Custom_Display.js: hitboxes[i] === false = walkable, hitboxes[i] === true = hitbox/invalid).
function getWalkableTileIndicesForRoom(roomId) {
  try {
    var state = getState();
    var utils = state && state.utils;
    if (!utils || !utils.ROOMS) return null;
    var rooms = utils.ROOMS;
    var room = Array.isArray(rooms) ? rooms.find(function(r) { return r && r.id === roomId; }) : (rooms[roomId] || null);
    if (!room || !room.file || !room.file.data || !room.file.data.hitboxes) return null;
    var hitboxes = room.file.data.hitboxes;
    var walkable = [];
    for (var i = 0; i < hitboxes.length; i++) {
      if (hitboxes[i] === false) walkable.push(i);
    }
    return walkable;
  } catch (e) {
    console.warn('[Challenges Mod] getWalkableTileIndicesForRoom:', e);
    return null;
  }
}

// Room IDs per mod_development_guide + database/maps-database.js (state.utils.ROOMS, fallback mapsDatabase)
function getAllRoomIds() {
  try {
    const state = getState();
    const utils = state?.utils;
    if (utils && utils.ROOMS && Array.isArray(utils.ROOMS)) {
      return utils.ROOMS.map(function(r) { return r.id; }).filter(Boolean);
    }
    if (utils && utils.ROOM_NAME && typeof utils.ROOM_NAME === 'object') {
      return Object.keys(utils.ROOM_NAME);
    }
    if (utils && utils.ROOM_ID && typeof utils.ROOM_ID === 'object') {
      return Object.keys(utils.ROOM_ID);
    }
    if (utils && utils.REGIONS && Array.isArray(utils.REGIONS)) {
      const ids = [];
      utils.REGIONS.forEach(function(region) {
        if (region.rooms && Array.isArray(region.rooms)) {
          region.rooms.forEach(function(room) {
            if (room.id) ids.push(room.id);
          });
        }
      });
      if (ids.length) return ids;
    }
    var mapsDb = (typeof window !== 'undefined' && window.mapsDatabase) ? window.mapsDatabase : null;
    if (mapsDb && typeof mapsDb.getAllMaps === 'function') {
      var maps = mapsDb.getAllMaps();
      if (Array.isArray(maps) && maps.length) {
        return maps.map(function(m) { return m.id; }).filter(Boolean);
      }
    }
  } catch (e) {
    console.warn('[Challenges Mod] getAllRoomIds error:', e);
  }
  return [];
}

// Creature gameIds per mod_development_guide + database/creature-database.js (state.utils.getMonster, fallback creatureDatabase)
function getAllCreatureGameIds() {
  var ids = [];
  try {
    var state = getState();
    var getMonster = state?.utils?.getMonster;
    if (getMonster) {
      for (var i = 1; i <= CHALLENGE_CREATURE_GAMEID_MAX; i++) {
        try {
          var monster = getMonster(i);
          if (monster && monster.metadata && monster.metadata.name) ids.push(i);
        } catch (_) {
          break;
        }
      }
    }
    if (ids.length) return ids;
    var creatureDb = (typeof window !== 'undefined' && window.creatureDatabase) ? window.creatureDatabase : null;
    if (creatureDb && typeof creatureDb.getAllMonstersWithPortraits === 'function') {
      var list = creatureDb.getAllMonstersWithPortraits();
      if (Array.isArray(list) && list.length) {
        var fallbackIds = list.map(function(m) { return m.gameId; }).filter(function(n) { return typeof n === 'number'; });
        console.log('[Challenges Mod] getAllCreatureGameIds: fallback creatureDatabase, count =', fallbackIds.length);
        return fallbackIds;
      }
    }
  } catch (e) {
    console.warn('[Challenges Mod] getAllCreatureGameIds error:', e);
  }
  return ids;
}

function pickRandomTiles(count, maxTile) {
  const pool = [];
  for (let i = 0; i <= maxTile; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, count);
}

function pickRandomFromArray(arr, count) {
  if (arr.length <= count) return arr.slice();
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  return shuffled.slice(0, count);
}

function getCreatureName(gameId) {
  try {
    const state = getState();
    const monster = state?.utils?.getMonster?.(gameId);
    if (monster?.metadata?.name) return monster.metadata.name;
  } catch (_) {}
  return 'Challenge ' + gameId;
}

function getEquipmentName(gameId) {
  try {
    var state = getState();
    var item = state?.utils?.getEquipment?.(gameId);
    if (item?.metadata?.name) return item.metadata.name;
  } catch (_) {}
  return 'Equipment ' + gameId;
}

// Per-creature difficulty multipliers (by name, case-insensitive). Default 1 if not listed.
var CREATURE_DIFFICULTY_MULTIPLIERS = {
  'sheep': 0.5,
  'black knight': 3,
  'lavahole': 4,
  'the percht queen': 2,
  'regeneration tank': 3,
  'sweaty cyclops': 1.3,
  'dharalion': 0.1,
  'old giant spider': 2,
  'dead tree': 1.5,
  'monster cauldron': 2,
  'earth crystal': 2,
  'magma crystal': 2,
  'energy crystal': 2
};

// Per-equipment difficulty multipliers (by name, case-insensitive). Default 1 if not listed.
var EQUIPMENT_DIFFICULTY_MULTIPLIERS = {
  'skull helmet': 0.2,
  'amulet of loss': 1.5,
  'amazon armor': 0.8,
  'amazon shield': 0.8,
  'amazon helmet': 0.8,
  'orclops santa': 0.8,
  'with hat': 0.8
};

function getCreatureDifficultyMultiplier(creatureName) {
  if (!creatureName || typeof creatureName !== 'string') return 1;
  var key = creatureName.toLowerCase().trim();
  return CREATURE_DIFFICULTY_MULTIPLIERS[key] !== undefined ? CREATURE_DIFFICULTY_MULTIPLIERS[key] : 1;
}

function getEquipmentDifficultyMultiplier(equipmentName) {
  if (!equipmentName || typeof equipmentName !== 'string') return 1;
  var key = equipmentName.toLowerCase().trim();
  return EQUIPMENT_DIFFICULTY_MULTIPLIERS[key] !== undefined ? EQUIPMENT_DIFFICULTY_MULTIPLIERS[key] : 1;
}

/** Difficulty contribution from a single creature (level + 10*equipTier) * creatureMult * equipmentMult. */
function getCreatureDifficultyContribution(spec) {
  if (!spec) return 0;
  var level = spec.level != null ? spec.level : 0;
  var equipPoints = (spec.equip && spec.equip.tier != null) ? 10 * spec.equip.tier : 0;
  var creatureMult = getCreatureDifficultyMultiplier(getCreatureName(spec.gameId));
  var equipMult = 1;
  if (spec.equip && spec.equip.gameId != null) {
    equipMult = getEquipmentDifficultyMultiplier(getEquipmentName(spec.equip.gameId));
  }
  return Math.round((level + equipPoints) * creatureMult * equipMult);
}

// Difficulty = sum over creatures of (level + 10*equipTier) * creatureMult * equipmentMult, rounded.
// Display/score multiplier = getDifficultyMultiplier(difficulty), power curve (see below).
// Allies = round(2 * (difficulty/150)^p), min 1, with p = log(5)/log(10) so 150→2, 375→4, 600→5, 1500→10, 2000→12.
var CHALLENGE_ALLIES_BASE_DIFFICULTY = 150;
var CHALLENGE_ALLIES_EXPONENT = Math.log(5) / Math.log(10); // ~0.699
function computeChallengeDifficulty(creatureSpecs) {
  if (!creatureSpecs || !creatureSpecs.length) return { difficulty: 0, alliesAllowed: 0 };
  var difficulty = 0;
  var hasDharalion = false;
  for (var i = 0; i < creatureSpecs.length; i++) {
    var spec = creatureSpecs[i];
    var name = getCreatureName(spec.gameId);
    if (name && (name.toLowerCase().trim() === 'dharalion')) hasDharalion = true;
    var level = spec.level != null ? spec.level : 0;
    var equipPoints = (spec.equip && spec.equip.tier != null) ? 10 * spec.equip.tier : 0;
    var creatureMult = getCreatureDifficultyMultiplier(name);
    var equipMult = 1;
    if (spec.equip && spec.equip.gameId != null) {
      equipMult = getEquipmentDifficultyMultiplier(getEquipmentName(spec.equip.gameId));
    }
    difficulty += (level + equipPoints) * creatureMult * equipMult;
  }
  difficulty = Math.round(difficulty);
  if (hasDharalion) difficulty = Math.round(difficulty * 0.5);
  var alliesAllowed = Math.max(1, Math.round(2 * Math.pow(difficulty / CHALLENGE_ALLIES_BASE_DIFFICULTY, CHALLENGE_ALLIES_EXPONENT)));
  return { difficulty: difficulty, alliesAllowed: alliesAllowed };
}

/** Power-curve exponent for score: lower difficulties grant more score (steep at low end). Smaller = more boost (0.5 = strong, 0.65 = moderate). */
var CHALLENGE_DIFFICULTY_POWER = 0.5;

/** Difficulty multiplier for display and score: 10 × (raw/1000)^power so lower difficulties are boosted (steeper curve at low end). */
function getDifficultyMultiplier(rawDifficulty) {
  var linear = (rawDifficulty || 0) / 100;
  if (linear <= 0) return 0;
  return 10 * Math.pow(linear / 10, CHALLENGE_DIFFICULTY_POWER);
}

/** Color for difficulty multiplier (0–15×+): green (low) → yellow → orange → red → dark red. */
function getDifficultyColor(mult) {
  if (mult <= 0) return undefined;
  if (mult >= 15) return '#b30000';
  if (mult >= 12) return '#cc2200';
  if (mult >= 9) return '#e63900';
  if (mult >= 6) return '#e6a800';
  if (mult >= 3) return '#99cc00';
  return '#4d9900';
}

/** Max grade index (0-based) from max team size: 0 if maxTeamSize <= 1, else maxTeamSize + 1. */
function maxGrade(maxTeamSize) {
  return maxTeamSize <= 1 ? 0 : maxTeamSize + 1;
}

/**
 * Count ally creatures currently on the board from game state (same logic as Custom Battles countAllyCreatures).
 * Used when gameData does not provide creaturesAlive. Returns null if state is unavailable.
 * @returns {number|null} Number of allies on board, or null.
 */
function getCreaturesAliveFromBoardState() {
  try {
    var state = getState();
    if (!state || !state.board || typeof state.board.getSnapshot !== 'function') return null;
    var ctx = state.board.getSnapshot();
    if (!ctx || !ctx.context) return null;
    var boardConfig = ctx.context.boardConfig;
    if (!boardConfig || !Array.isArray(boardConfig)) return null;
    function isAlly(piece) {
      return piece && (piece.type === 'player' || (piece.type === 'custom' && piece.villain === false));
    }
    return boardConfig.filter(isAlly).length;
  } catch (e) {
    console.warn('[Challenges Mod] getCreaturesAliveFromBoardState error:', e);
    return null;
  }
}

/** Grade letters by index (0 = F, 1 = D … 6 = S+). Time is not used; grade is from max team size, current team size, and creatures alive. */
var CHALLENGE_GRADE_LETTERS = ['F', 'D', 'C', 'B', 'A', 'S', 'S+'];

/**
 * Compute challenge grade from max team size, current team size, and creatures alive (no ticks).
 * On defeat (creaturesAlive <= 0) returns 'F'. Otherwise uses survival ratio and maxGrade(maxTeamSize).
 * @param {number} maxTeamSize - Allies allowed (max team size).
 * @param {number} currentTeamSize - Your team size at battle start / max.
 * @param {number} creaturesAlive - Number of your creatures alive after battle.
 * @returns {string} Letter grade F, D, C, B, A, S, or S+.
 */
function computeChallengeGrade(maxTeamSize, currentTeamSize, creaturesAlive) {
  if (creaturesAlive <= 0) {
    console.log('[Challenges Mod] computeChallengeGrade: defeat (creaturesAlive <= 0) -> F');
    return 'F';
  }
  var maxVal = maxGrade(maxTeamSize);
  if (maxVal <= 0) return 'D';
  var denominator = currentTeamSize > 0 ? currentTeamSize : 1;
  var ratio = Math.max(0, Math.min(1, creaturesAlive / denominator));
  var gradeIndex = Math.min(maxVal, Math.floor(ratio * (maxVal + 1)));
  var grade = CHALLENGE_GRADE_LETTERS[Math.min(gradeIndex, CHALLENGE_GRADE_LETTERS.length - 1)];
  console.log('[Challenges Mod] computeChallengeGrade:', { maxTeamSize, currentTeamSize, creaturesAlive, maxVal, ratio, gradeIndex, grade });
  return grade;
}

/** Grade bonus points (S+ = 1500, S = 1250, A = 1000, etc., −250 per rank). Returns 0 for unknown grade. */
function getGradePoints(grade) {
  if (grade == null || typeof grade !== 'string') return 0;
  var key = grade.trim().toLowerCase();
  return CHALLENGE_GRADE_POINTS[key] !== undefined ? CHALLENGE_GRADE_POINTS[key] : 0;
}

/** Score = round(((1000 - ticks) + gradePoints) * difficultyMultiplier). */
function computeChallengeScore(ticks, rawDifficulty, grade) {
  var mult = getDifficultyMultiplier(rawDifficulty);
  var base = (1000 - (ticks || 0)) + getGradePoints(grade);
  return Math.round(base * mult);
}

/** Build score breakdown tooltip for a leaderboard row (with newlines for title attribute). Always shows actual numbers. */
function getScoreBreakdownText(row) {
  var mult = row.difficulty != null ? getDifficultyMultiplier(row.difficulty) : 0;
  var multStr = mult > 0 ? mult.toFixed(2) + '×' : '—';
  var score = row.score != null ? row.score : 0;
  if (row.ticks != null && row.difficulty != null) {
    var gradePoints = getGradePoints(row.grade);
    var base = (1000 - row.ticks) + gradePoints;
    var lines = [
      'Base: (1000 − ' + row.ticks + ') + ' + gradePoints + ' = ' + base,
      'Multiplier: ' + multStr,
      'Score: round(' + base + ' × ' + multStr.replace('×', '') + ') = ' + score
    ];
    if (row.grade) lines.push('Grade: ' + row.grade + ' (+' + gradePoints + ')');
    return lines.join('\n');
  }
  if (row.difficulty != null && score > 0 && mult > 0) {
    var baseApprox = Math.round(score / mult);
    return 'Base: ≈ ' + baseApprox + ' (from score ÷ multiplier)\nMultiplier: ' + multStr + '\nScore: round(' + baseApprox + ' × ' + multStr.replace('×', '') + ') = ' + score;
  }
  return 'Score: ' + score;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomEquipmentGameId() {
  try {
    var state = getState();
    var getEquipment = state?.utils?.getEquipment;
    if (!getEquipment) return null;
    var ids = [];
    for (var i = 1; i <= CHALLENGE_EQUIP_GAMEID_MAX; i++) {
      try {
        var eq = getEquipment(i);
        if (eq && eq.metadata && eq.metadata.name) ids.push(i);
      } catch (_) { break; }
    }
    if (ids.length) return pickRandomFromArray(ids, 1)[0];
  } catch (e) {}
  return null;
}

function rollRandomGenes() {
  return {
    hp: getRandomInt(CHALLENGE_GENE_MIN, CHALLENGE_GENE_MAX),
    ad: getRandomInt(CHALLENGE_GENE_MIN, CHALLENGE_GENE_MAX),
    ap: getRandomInt(CHALLENGE_GENE_MIN, CHALLENGE_GENE_MAX),
    armor: getRandomInt(CHALLENGE_GENE_MIN, CHALLENGE_GENE_MAX),
    magicResist: getRandomInt(CHALLENGE_GENE_MIN, CHALLENGE_GENE_MAX)
  };
}

function rollRandomEquip() {
  var gameId = getRandomEquipmentGameId();
  if (gameId == null) return null;
  var stat = CHALLENGE_EQUIP_STATS[Math.floor(Math.random() * CHALLENGE_EQUIP_STATS.length)];
  var tier = getRandomInt(CHALLENGE_EQUIP_TIER_MIN, CHALLENGE_EQUIP_TIER_MAX);
  return { gameId: gameId, stat: stat, tier: tier };
}

/**
 * @param {string} roomId
 * @param {Array} villainSpecs
 * @param {number|null} allyLimit
 * @param {{ mapName?: string, difficulty?: number }} opts - optional; if provided, onVictory will save run to Firebase leaderboard
 */
function buildChallengeConfig(roomId, villainSpecs, allyLimit, opts) {
  var mapName = (opts && opts.mapName) ? opts.mapName : '';
  var difficulty = (opts && typeof opts.difficulty === 'number') ? opts.difficulty : 0;

  const villains = villainSpecs.map(function(spec) {
    const nickname = getCreatureName(spec.gameId);
    const level = spec.level != null ? spec.level : 50;
    const genes = spec.genes && typeof spec.genes === 'object' ? spec.genes : { hp: 1, ad: 1, ap: 1, armor: 1, magicResist: 1 };
    const tier = (spec.equip && spec.equip.tier != null) ? spec.equip.tier : 4;
    const villain = {
      nickname: nickname,
      keyPrefix: 'challenge-tile-' + spec.tileIndex + '-',
      tileIndex: spec.tileIndex,
      gameId: spec.gameId,
      level: level,
      tier: tier,
      direction: 'south',
      genes: genes
    };
    if (spec.equip && spec.equip.gameId != null) {
      villain.equip = { gameId: spec.equip.gameId, tier: spec.equip.tier, stat: spec.equip.stat };
    }
    return villain;
  });
  var config = {
    name: 'Challenges',
    roomId: roomId,
    villains: villains,
    floor: 0,
    preventVillainMovement: true,
    victoryDefeat: {
      onVictory: function(gameData) {
        console.log('[Challenges Mod] onVictory gameData:', gameData);
        var ticks = (gameData && typeof gameData.ticks === 'number') ? gameData.ticks : 0;
        var currentTeamSize = (gameData && typeof gameData.currentTeamSize === 'number') ? gameData.currentTeamSize : allyLimit;
        var creaturesAlive = (gameData && typeof gameData.creaturesAlive === 'number') ? gameData.creaturesAlive : getCreaturesAliveFromBoardState();
        if (typeof creaturesAlive !== 'number' || creaturesAlive < 0) creaturesAlive = currentTeamSize;
        var grade = computeChallengeGrade(allyLimit, currentTeamSize, creaturesAlive);
        console.log('[Challenges Mod] grade (onVictory):', { maxTeamSize: allyLimit, currentTeamSize, creaturesAlive, grade });
        var score = computeChallengeScore(ticks, difficulty, grade);
        var name = getCurrentPlayerName();
        var villainConfig = {
          roomId: roomId,
          roomName: mapName,
          villains: villainSpecs.map(function(s) {
            return {
              tileIndex: s.tileIndex,
              gameId: s.gameId,
              level: s.level,
              genes: s.genes,
              equip: s.equip || null
            };
          })
        };
        var configString = JSON.stringify(villainConfig);
        saveChallengeRunToLeaderboard({
          name: name,
          mapName: mapName,
          difficulty: difficulty,
          score: score,
          replay: configString,
          ticks: ticks,
          grade: grade
        });
      },
      victoryContent: function(gameData) {
        console.log('[Challenges Mod] victoryContent gameData:', gameData);
        var ticks = (gameData && typeof gameData.ticks === 'number') ? gameData.ticks : 0;
        var currentTeamSize = (gameData && typeof gameData.currentTeamSize === 'number') ? gameData.currentTeamSize : allyLimit;
        var creaturesAlive = (gameData && typeof gameData.creaturesAlive === 'number') ? gameData.creaturesAlive : getCreaturesAliveFromBoardState();
        if (typeof creaturesAlive !== 'number' || creaturesAlive < 0) creaturesAlive = currentTeamSize;
        var grade = computeChallengeGrade(allyLimit, currentTeamSize, creaturesAlive);
        console.log('[Challenges Mod] grade (victoryContent):', { maxTeamSize: allyLimit, currentTeamSize, creaturesAlive, grade });
        var score = computeChallengeScore(ticks, difficulty, grade);
        var wrap = document.createElement('div');
        wrap.style.cssText = 'padding: 12px 16px; text-align: left;';
        var victoryT = (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') ? context.api.i18n.t.bind(context.api.i18n) : function(k) { var f = { 'mods.challenges.victory': 'Victory!', 'mods.challenges.rankLabel': 'Rank:' }; return f[k] != null ? f[k] : k; };
        var titleEl = document.createElement('h2');
        titleEl.textContent = victoryT('mods.challenges.victory');
        titleEl.style.cssText = 'color: #4CAF50; margin: 0 0 12px 0; font-size: 20px; font-weight: bold; text-align: center;';
        wrap.appendChild(titleEl);
        function row(label, value) {
          var p = document.createElement('p');
          p.style.cssText = 'margin: 6px 0; font-size: 14px;';
          p.textContent = label + ': ' + value;
          return p;
        }
        wrap.appendChild(row('Map', mapName || '—'));
        wrap.appendChild(row('Difficulty', getDifficultyMultiplier(difficulty).toFixed(2) + '×'));
        wrap.appendChild(row('Score', String(score)));
        wrap.appendChild(row('Ticks', String(ticks)));
        wrap.appendChild(row('Grade', (grade && String(grade).trim()) ? String(grade) + ' (+' + getGradePoints(grade) + ')' : '—'));
        var rankP = document.createElement('p');
        rankP.style.cssText = 'margin: 6px 0; font-size: 14px;';
        rankP.textContent = victoryT('mods.challenges.rankLabel') + ' …';
        wrap.appendChild(rankP);
        loadChallengeLeaderboard().then(function(entries) {
          var better = entries.filter(function(e) { return e.score > score; }).length;
          var rank = better + 1;
          rankP.textContent = victoryT('mods.challenges.rankLabel') + ' ' + rank;
        }).catch(function() {
          rankP.textContent = victoryT('mods.challenges.rankLabel') + ' —';
        });
        return wrap;
      },
      onDefeat: function() {
        // Defeat: grade F, 0 rank points — do not save to leaderboard.
      },
      onClose: function() {
        cleanupChallengeBattle();
        setTimeout(triggerChallengeStopButton, 0);
      }
    }
  };
  if (allyLimit != null && typeof allyLimit === 'number' && allyLimit >= 0) {
    config.allyLimit = allyLimit;
  }
  return config;
}

function showChallengeToast(message) {
  var text = message ? String(message).replace(/</g, '&lt;') : '';
  try {
    var api = (typeof context !== 'undefined' && context && context.api) ? context.api : (typeof window !== 'undefined' && window.BestiaryModAPI) ? window.BestiaryModAPI : null;
    if (api && api.ui && api.ui.components && api.ui.components.createModal) {
      api.ui.components.createModal({
        title: 'Challenges',
        content: '<p>' + text + '</p>',
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
    if (typeof window !== 'undefined' && window.BestiaryModAPI && typeof window.BestiaryModAPI.showModal === 'function') {
      window.BestiaryModAPI.showModal({
        title: 'Challenges',
        content: '<p>' + text + '</p>',
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
  } catch (e) {
    console.warn('[Challenges Mod] showChallengeToast:', e);
  }
  if (typeof alert === 'function') {
    alert('Challenges: ' + (message || 'Unknown'));
  }
}

// Toast notifications: same system as Quests (Quests.js NotificationService pattern) – no modal.
var CHALLENGE_TOAST_DURATION = 5000;
var CHALLENGE_TOAST_CONTAINER_ID = 'challenges-toast-container';

function getChallengesToastContainer() {
  var el = document.getElementById(CHALLENGE_TOAST_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CHALLENGE_TOAST_CONTAINER_ID;
    el.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(el);
  }
  return el;
}

function updateChallengesToastPositions(container) {
  var toasts = container.querySelectorAll('.challenges-toast-item');
  toasts.forEach(function(toast, index) {
    var offset = index * 46;
    toast.style.transform = 'translateY(-' + offset + 'px)';
  });
}

function copyReplayToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showChallengeToastNotification('Setup config copied to clipboard.');
      }).catch(function() { showChallengeToastNotification('Copy failed.'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showChallengeToastNotification('Setup config copied to clipboard.');
    }
  } catch (e) {
    showChallengeToastNotification('Copy failed.');
  }
}

function showChallengeToastNotification(message, duration) {
  duration = duration || CHALLENGE_TOAST_DURATION;
  var safeMsg = message ? String(message).replace(/</g, '&lt;') : '';
  try {
    var mainContainer = getChallengesToastContainer();
    var existingToasts = mainContainer.querySelectorAll('.challenges-toast-item');
    var stackOffset = existingToasts.length * 46;

    var flexContainer = document.createElement('div');
    flexContainer.className = 'challenges-toast-item';
    flexContainer.style.cssText = 'left: 0px; right: 0px; display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-' + stackOffset + 'px); bottom: 0px; justify-content: flex-end;';

    var toast = document.createElement('button');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';

    var widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';

    var widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    var messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.textContent = safeMsg;
    widgetBottom.appendChild(messageDiv);

    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    mainContainer.appendChild(flexContainer);

    toast.addEventListener('click', function() {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateChallengesToastPositions(mainContainer);
      }
    });

    setTimeout(function() {
      if (flexContainer && flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateChallengesToastPositions(mainContainer);
      }
    }, duration);
  } catch (e) {
    console.warn('[Challenges Mod] showChallengeToastNotification:', e);
  }
}

function cleanupChallengeBattle() {
  if (challengeBoardUnsubscribe && typeof challengeBoardUnsubscribe === 'function') {
    try { challengeBoardUnsubscribe(); } catch (e) {}
    challengeBoardUnsubscribe = null;
  }
  if (challengeBattle) {
    try {
      challengeBattle.cleanup(function() {}, function() {});
    } catch (e) {
      console.warn('[Challenges Mod] cleanupChallengeBattle cleanup:', e);
    }
    challengeBattle = null;
  }
  challengeRoomId = null;
  challengeSetupDone = false;
}

/** Find and click the game Stop button to end the sandbox run (e.g. after closing victory/defeat modal). */
function triggerChallengeStopButton() {
  try {
    var selectors = [
      'button.frame-1-red.surface-red[data-state="closed"]',
      'button.frame-1-red[data-state="closed"]',
      'button.surface-red[data-state="closed"]',
      'button[aria-label="Stop"]'
    ];
    var stopButton = null;
    for (var i = 0; i < selectors.length; i++) {
      stopButton = document.querySelector(selectors[i]);
      if (stopButton && stopButton.textContent.trim() === 'Stop') break;
    }
    if (!stopButton) {
      var redBtns = document.querySelectorAll('button.frame-1-red, button.surface-red');
      for (var j = 0; j < redBtns.length; j++) {
        if (redBtns[j].textContent.trim() === 'Stop' && redBtns[j].getAttribute('data-state') === 'closed') {
          stopButton = redBtns[j];
          break;
        }
      }
    }
    if (stopButton && !stopButton.disabled) {
      stopButton.click();
    }
  } catch (e) {
    console.warn('[Challenges Mod] triggerChallengeStopButton:', e);
  }
}

// UI hiding for challenge (same pattern as Quests.js Spider Lair / Old Widow: hideQuestOverlays, hideHeroEditorButton, set sandbox)
function setSandboxAndHideChallengeUI() {
  try {
    var state = getState();
    if (state && state.board && typeof state.board.send === 'function') {
      state.board.send({ type: 'setPlayMode', mode: 'sandbox' });
    }
    var modeButtons = document.querySelectorAll('button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]');
    modeButtons.forEach(function(btnImg) {
      var btn = btnImg.closest('button');
      if (btn) btn.style.display = 'none';
    });
  } catch (e) {
    console.warn('[Challenges Mod] setSandboxAndHideChallengeUI:', e);
  }
}

function hideChallengesOverlaysAndButtons() {
  try {
    // Hide monster count + map/region name overlay (same as Quests: .pointer-events-none.absolute.right-0.top-0.z-1)
    var overlays = document.querySelectorAll('.pointer-events-none.absolute.right-0.top-0.z-1');
    overlays.forEach(function(overlay) {
      if (overlay.textContent && overlay.textContent.includes('Monsters')) {
        overlay.style.display = 'none';
      }
    });
    var floorContainers = document.querySelectorAll('.absolute.right-0.z-3');
    floorContainers.forEach(function(container) {
      var hasFloor = container.querySelector('img[alt="Floor"]') || container.querySelector('input[type="range"]') || container.querySelector('[data-floor]');
      if (hasFloor) container.style.display = 'none';
    });
    if (typeof window.heroEditor !== 'undefined' && typeof window.heroEditor.hideButton === 'function') {
      window.heroEditor.hideButton();
    } else {
      var heroBtn = document.getElementById('hero-editor-button');
      if (heroBtn) heroBtn.style.display = 'none';
    }
    if (typeof window.teamCopier !== 'undefined' && typeof window.teamCopier.hideButton === 'function') {
      window.teamCopier.hideButton();
    } else {
      var teamBtn = document.getElementById('team-copier-button');
      if (teamBtn) teamBtn.style.display = 'none';
    }
  } catch (e) {
    console.warn('[Challenges Mod] hideChallengesOverlaysAndButtons:', e);
  }
}

function showChallengesOverlaysAndButtons() {
  try {
    // Restore monster count + map/region name overlay
    var overlays = document.querySelectorAll('.pointer-events-none.absolute.right-0.top-0.z-1');
    overlays.forEach(function(overlay) {
      overlay.style.display = '';
    });
    var modeButtons = document.querySelectorAll('button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]');
    modeButtons.forEach(function(btnImg) {
      var btn = btnImg.closest('button');
      if (btn) btn.style.display = '';
    });
    var floorContainers = document.querySelectorAll('.absolute.right-0.z-3');
    floorContainers.forEach(function(container) {
      container.style.display = '';
    });
    if (typeof window.heroEditor !== 'undefined' && typeof window.heroEditor.showButton === 'function') {
      window.heroEditor.showButton();
    } else {
      var heroBtn = document.getElementById('hero-editor-button');
      if (heroBtn) heroBtn.style.display = '';
    }
    if (typeof window.teamCopier !== 'undefined' && typeof window.teamCopier.showButton === 'function') {
      window.teamCopier.showButton();
    } else {
      var teamBtn = document.getElementById('team-copier-button');
      if (teamBtn) teamBtn.style.display = '';
    }
  } catch (e) {
    console.warn('[Challenges Mod] showChallengesOverlaysAndButtons:', e);
  }
}

function waitForCustomBattles() {
  if (window.CustomBattles) return Promise.resolve(window.CustomBattles);
  return new Promise(function(resolve) {
    let retries = 0;
    const interval = setInterval(function() {
      retries++;
      if (window.CustomBattles) {
        clearInterval(interval);
        resolve(window.CustomBattles);
      } else if (retries >= CHALLENGE_CUSTOMBATTLES_MAX_RETRIES) {
        clearInterval(interval);
        resolve(null);
      }
    }, CHALLENGE_CUSTOMBATTLES_WAIT_MS);
  });
}

function closeChallengesModalIfOpen() {
  try {
    var dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return;
    var titleP = dialog.querySelector('.widget-top p, h2.widget-top-text p');
    if (!titleP || titleP.textContent.trim() !== 'Challenges') return;
    var overlay = dialog.previousElementSibling;
    if (overlay && overlay.nodeType === 1 && String(overlay.style.position) === 'fixed') {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
  } catch (e) {
    console.warn('[Challenges Mod] closeChallengesModalIfOpen:', e);
  }
}

function startChallenge() {
  console.log('[Challenges Mod] startChallenge() called');
  closeChallengesModalIfOpen();
  var api = (typeof context !== 'undefined' && context && context.api) ? context.api : (typeof window !== 'undefined' && window.BestiaryModAPI) ? window.BestiaryModAPI : null;
  var state = getState();

  try {
    if (!rolledRoomId || !rolledCreatureSpecs || !rolledCreatureSpecs.length) {
      showChallengeToastNotification('Roll map and creatures first.');
      return;
    }

    if (!state) {
      console.log('[Challenges Mod] startChallenge: no state, aborting');
      showChallengeToast('Game state not available. Make sure you are in the game and the board is loaded.');
      return;
    }
    console.log('[Challenges Mod] startChallenge: state OK');
    hasNavigatedWithCurrentRoll = true;

    setSandboxAndHideChallengeUI();
    hideChallengesOverlaysAndButtons();

    var roomId = rolledRoomId;
    var specs = rolledCreatureSpecs.slice();
    var n = specs.length;
    var walkable = getWalkableTileIndicesForRoom(roomId);
    var tiles;
    if (walkable && walkable.length > 0) {
      n = Math.min(n, walkable.length);
      tiles = pickRandomFromArray(walkable, n);
      specs = specs.slice(0, n);
    } else {
      tiles = pickRandomTiles(n, CHALLENGE_TILE_INDEX_MAX);
    }
    var villainSpecs = specs.map(function(spec, i) {
      return {
        gameId: spec.gameId,
        tileIndex: tiles[i],
        level: spec.level,
        genes: spec.genes,
        equip: spec.equip
      };
    });

    var diff = computeChallengeDifficulty(rolledCreatureSpecs);
    var alliesAllowed = diff.alliesAllowed;
    if (walkable && walkable.length > 0) {
      alliesAllowed = Math.min(alliesAllowed, Math.max(0, walkable.length - n));
    }
    var config = buildChallengeConfig(roomId, villainSpecs, alliesAllowed, {
      mapName: rolledRoomName,
      difficulty: diff.difficulty
    });
    console.log('[Challenges Mod] startChallenge: config built, roomId =', roomId, 'villains =', n);

    setTimeout(function() {
      console.log('[Challenges Mod] startChallenge: waiting for CustomBattles...');
      waitForCustomBattles().then(function(CustomBattles) {
        if (!CustomBattles) {
          console.log('[Challenges Mod] startChallenge: CustomBattles not available after wait');
          showChallengeToast('Custom Battles system not available. Try again in a moment.');
          return;
        }
        console.log('[Challenges Mod] startChallenge: CustomBattles ready');

        state = getState();
        if (!state || !state.board) {
          console.log('[Challenges Mod] startChallenge: no state/board in then');
          showChallengeToast('Board state not available.');
          return;
        }

        cleanupChallengeBattle();
        console.log('[Challenges Mod] startChallenge: creating battle');

        var battle = CustomBattles.create(config);
        battle.setup(
          function() { return true; },
          function(toastData) {
            if (toastData && toastData.message) {
              showChallengeToastNotification(toastData.message, toastData.duration || CHALLENGE_TOAST_DURATION);
            }
          }
        );

        challengeBattle = battle;
        challengeRoomId = roomId;
        challengeSetupDone = false;

        console.log('[Challenges Mod] startChallenge: subscribing to board');
        challengeBoardUnsubscribe = state.board.subscribe(function(snapshot) {
          var ctx = snapshot && snapshot.context;
          var currentRoomId = ctx && (ctx.selectedMap && (ctx.selectedMap.selectedRoom && ctx.selectedMap.selectedRoom.id || ctx.selectedMap.roomId));
          if (challengeBattle && challengeRoomId && currentRoomId !== challengeRoomId) {
            var battleToClean = challengeBattle;
            challengeBattle = null;
            challengeRoomId = null;
            challengeSetupDone = false;
            try {
              battleToClean.cleanup(undefined, showChallengesOverlaysAndButtons);
            } catch (e) {
              console.warn('[Challenges Mod] cleanup on map change:', e);
            }
            return;
          }
          if (currentRoomId !== challengeRoomId || !challengeBattle) return;
          if (challengeSetupDone) return;
          challengeSetupDone = true;
          try {
            challengeBattle.removeOriginalVillains();
          } catch (e) {
            console.warn('[Challenges Mod] removeOriginalVillains:', e);
          }
        });

        showChallengeToastNotification('Navigating to challenge.');
        console.log('[Challenges Mod] startChallenge: sending selectRoomById', roomId);
        state.board.send({ type: 'selectRoomById', roomId: roomId });
        console.log('[Challenges Mod] startChallenge: done, navigating to room:', roomId);
      }).catch(function(err) {
        console.error('[Challenges Mod] startChallenge promise error:', err);
        showChallengeToast('Error starting challenge: ' + (err && err.message ? err.message : 'Unknown error'));
      });
    }, CHALLENGE_SANDBOX_DELAY_MS);
  } catch (err) {
    console.error('[Challenges Mod] startChallenge error:', err);
    showChallengeToast('Error: ' + (err && err.message ? err.message : 'Unknown error'));
  }
}

/**
 * Start a challenge from a saved villain config (roomId, roomName, villains). Closes modal and navigates to map with villains.
 * @param {{ roomId: string, roomName: string, villains: Array }} config
 */
function startChallengeWithVillainConfig(config) {
  console.log('[Challenges Mod] startChallengeWithVillainConfig called', { roomId: config && config.roomId, roomName: config && config.roomName, villains: config && config.villains && config.villains.length });
  if (!config || !config.roomId || !config.villains || !Array.isArray(config.villains) || config.villains.length === 0) {
    console.log('[Challenges Mod] startChallengeWithVillainConfig: invalid config, showing toast');
    showChallengeToastNotification('Invalid setup config.');
    return;
  }
  try {
    var path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    if (path.indexOf('inventory') !== -1) {
      console.log('[Challenges Mod] startChallengeWithVillainConfig: on inventory, storing config and redirecting to /game');
      sessionStorage.setItem('challengesLoadConfig', JSON.stringify(config));
      window.location.href = '/game';
      return;
    }
  } catch (e) {
    console.warn('[Challenges Mod] startChallengeWithVillainConfig: path/redirect check', e);
  }
  var state = getState();
  if (!state || !state.board) {
    console.log('[Challenges Mod] startChallengeWithVillainConfig: no state/board, aborting');
    showChallengeToast('Game state not available.');
    return;
  }
  console.log('[Challenges Mod] startChallengeWithVillainConfig: closing modal, hiding UI');
  closeChallengesModalIfOpen();
  setSandboxAndHideChallengeUI();
  hideChallengesOverlaysAndButtons();

  var roomId = config.roomId;
  var villainSpecs = config.villains;
  var diff = computeChallengeDifficulty(villainSpecs);
  var alliesAllowed = diff.alliesAllowed;
  var walkable = getWalkableTileIndicesForRoom(roomId);
  if (walkable && walkable.length > 0) {
    var nVillains = villainSpecs.length;
    var capped = Math.min(alliesAllowed, Math.max(0, walkable.length - nVillains));
    if (capped !== alliesAllowed) {
      console.log('[Challenges Mod] startChallengeWithVillainConfig: allies capped for walkable', { walkableCount: walkable.length, nVillains: nVillains, alliesRequested: alliesAllowed, alliesCapped: capped });
    }
    alliesAllowed = capped;
  } else {
    console.log('[Challenges Mod] startChallengeWithVillainConfig: no walkable data for room', roomId);
  }
  var battleConfig = buildChallengeConfig(roomId, villainSpecs, alliesAllowed, {
    mapName: config.roomName || config.roomId,
    difficulty: diff.difficulty
  });
  console.log('[Challenges Mod] startChallengeWithVillainConfig: scheduling in', CHALLENGE_SANDBOX_DELAY_MS, 'ms');

  setTimeout(function() {
    console.log('[Challenges Mod] startChallengeWithVillainConfig: waiting for CustomBattles');
    waitForCustomBattles().then(function(CustomBattles) {
      if (!CustomBattles) {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: CustomBattles not available');
        showChallengeToast('Custom Battles not available.');
        return;
      }
      console.log('[Challenges Mod] startChallengeWithVillainConfig: CustomBattles ready, creating battle');
      state = getState();
      if (!state || !state.board) {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: no state/board after wait');
        showChallengeToast('Board state not available.');
        return;
      }
      cleanupChallengeBattle();
      var battle = CustomBattles.create(battleConfig);
      battle.setup(
        function() { return true; },
        function(toastData) {
          if (toastData && toastData.message) {
            showChallengeToastNotification(toastData.message, toastData.duration || CHALLENGE_TOAST_DURATION);
          }
        }
      );
      challengeBattle = battle;
      challengeRoomId = roomId;
      challengeSetupDone = false;
      challengeBoardUnsubscribe = state.board.subscribe(function(snapshot) {
        var ctx = snapshot && snapshot.context;
        var currentRoomId = ctx && (ctx.selectedMap && (ctx.selectedMap.selectedRoom && ctx.selectedMap.selectedRoom.id || ctx.selectedMap.roomId));
        if (challengeBattle && challengeRoomId && currentRoomId !== challengeRoomId) {
          var battleToClean = challengeBattle;
          challengeBattle = null;
          challengeRoomId = null;
          challengeSetupDone = false;
          try {
            battleToClean.cleanup(undefined, showChallengesOverlaysAndButtons);
          } catch (e) {
            console.warn('[Challenges Mod] cleanup on map change:', e);
          }
          return;
        }
        if (currentRoomId !== challengeRoomId || !challengeBattle) return;
        if (challengeSetupDone) return;
        challengeSetupDone = true;
        // Delay so the board has applied the new room's boardConfig before we strip room villains.
        // Otherwise we run on stale config and the room load overwrites us, leaving room villains + re-added custom ones.
        var delayMs = 350;
        setTimeout(function() {
          if (!challengeBattle || !challengeRoomId) return;
          try {
            challengeBattle.removeOriginalVillains();
          } catch (e) {
            console.warn('[Challenges Mod] removeOriginalVillains:', e);
          }
        }, delayMs);
      });
      showChallengeToastNotification('Loading challenge setup...');
      // Match Start flow: send selectRoomById immediately so the board loads the room the same way
      if (state && state.board && typeof state.board.send === 'function') {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: sending selectRoomById', roomId);
        state.board.send({ type: 'selectRoomById', roomId: roomId });
      } else {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: cannot send selectRoomById, state.board missing');
      }
    }).catch(function(err) {
      console.error('[Challenges Mod] startChallengeWithVillainConfig error:', err);
      showChallengeToast('Error loading setup: ' + (err && err.message ? err.message : 'Unknown error'));
    });
  }, CHALLENGE_SANDBOX_DELAY_MS);
}

// =======================
// 4. Inventory Integration
// =======================
// Reference: Autoscroller.js, Better Forge.js

let inventoryObserver = null;
let buttonCheckInterval = null;
let observerDebounceTimeout = null;
let lastObserverCheck = 0;

function addChallengesInventoryButton() {
  if (document.querySelector('.challenges-inventory-button')) return true;

  const isOnInventoryPage = document.querySelector('.container-inventory-4') ||
    document.querySelector('[data-page="inventory"]') ||
    (window.location && window.location.pathname && window.location.pathname.includes('inventory'));

  if (!isOnInventoryPage) return false;

  const inventoryContainer = document.querySelector('.container-inventory-4');
  if (!inventoryContainer) return false;

  // Target: the inventory slot button that contains sprite item id-10327 (has-rarity container-slot)
  const item10327Slot = inventoryContainer.querySelector('.sprite.item.id-10327')?.closest('button') ||
    inventoryContainer.querySelector('.id-10327')?.closest('button') ||
    inventoryContainer.querySelector('img[alt="10327"]')?.closest('button');
  const targetButton = item10327Slot && !item10327Slot.classList.contains('challenges-inventory-button')
    ? item10327Slot
    : null;
  if (!targetButton) return false;

  const iconUrl = getChallengesIconUrl();
  const inventoryBorderStyle = window.betterUIConfig?.inventoryBorderStyle || 'Original';
  const borderDiv = window.getInventoryBorderStyle ? window.getInventoryBorderStyle(inventoryBorderStyle) : '';

  const challengesButton = document.createElement('button');
  challengesButton.className = 'focus-style-visible active:opacity-70 challenges-inventory-button';
  challengesButton.innerHTML = `
    <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image">
      <div class="relative grid h-full place-items-center">
        ${borderDiv}
        <img alt="Challenges" class="pixelated" width="32" height="32" src="${iconUrl}" style="object-fit: contain; position: relative; z-index: 2;">
      </div>
    </div>
  `;
  challengesButton.title = 'Challenges';
  challengesButton.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    // Close inventory (or any open UI) first so modal opens outside React's inventory subtree (reference: Autoscroller.js showAutoscrollerModal)
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    }
    setTimeout(function() {
      openChallengesModal();
    }, 50);
  });

  try {
    targetButton.insertAdjacentElement('afterend', challengesButton);
    return true;
  } catch (err) {
    console.error('[Challenges Mod] Error adding inventory button:', err);
    return false;
  }
}

function processInventoryMutations() {
  addChallengesInventoryButton();
}

function observeInventory() {
  if (inventoryObserver) {
    try { inventoryObserver.disconnect(); } catch (e) {}
    inventoryObserver = null;
  }
  if (buttonCheckInterval) {
    clearInterval(buttonCheckInterval);
    buttonCheckInterval = null;
  }
  if (observerDebounceTimeout) {
    clearTimeout(observerDebounceTimeout);
    observerDebounceTimeout = null;
  }

  buttonCheckInterval = setInterval(() => {
    addChallengesInventoryButton();
  }, BUTTON_CHECK_INTERVAL);

  inventoryObserver = new MutationObserver((mutations) => {
    const now = Date.now();
    if (now - lastObserverCheck < OBSERVER_MIN_INTERVAL) {
      if (observerDebounceTimeout) clearTimeout(observerDebounceTimeout);
      observerDebounceTimeout = setTimeout(processInventoryMutations, OBSERVER_DEBOUNCE_DELAY);
      return;
    }
    lastObserverCheck = now;
    processInventoryMutations();
  });

  inventoryObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  addChallengesInventoryButton();
}

// =======================
// 5. Cleanup & Exports
// =======================

function cleanupChallenges() {
  if (observerDebounceTimeout) {
    clearTimeout(observerDebounceTimeout);
    observerDebounceTimeout = null;
  }
  if (buttonCheckInterval) {
    clearInterval(buttonCheckInterval);
    buttonCheckInterval = null;
  }
  if (inventoryObserver) {
    try { inventoryObserver.disconnect(); } catch (e) {}
    inventoryObserver = null;
  }
  document.querySelectorAll('.challenges-inventory-button').forEach(btn => {
    try { btn.remove(); } catch (e) {}
  });
}

if (typeof context !== 'undefined' && context.api) {
  observeInventory();
} else {
  console.error('[Challenges Mod] context.api not available');
}

try {
  var pendingConfig = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('challengesLoadConfig');
  if (pendingConfig) {
    sessionStorage.removeItem('challengesLoadConfig');
    var parsedConfig = JSON.parse(pendingConfig);
    if (parsedConfig && parsedConfig.roomId && parsedConfig.villains && parsedConfig.villains.length) {
      setTimeout(function() {
        startChallengeWithVillainConfig(parsedConfig);
      }, 1200);
    }
  }
} catch (e) {}

exports = {
  openChallengesModal,
  cleanup: cleanupChallenges
};
