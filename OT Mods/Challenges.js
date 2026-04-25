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

/** Shared styles for framed widget boxes (placeholder box, matchmaking panel, etc.) */
const CHALLENGES_FRAME_BOX_STYLE = 'display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; border: 4px solid transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch; border-radius: 6px; overflow: hidden;';
const CHALLENGES_WIDGET_TITLE_STYLE = 'margin: 0; padding: 2px 8px; text-align: center; color: ' + CHALLENGE_COLORS.TEXT + ';';
const CHALLENGES_WIDGET_BODY_STYLE = 'flex: 1 1 0; overflow-y: auto; padding: 8px 12px; color: ' + CHALLENGE_COLORS.SECONDARY + '; font-size: 14px; line-height: 1.4; min-height: 0; background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat;';

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

/** English strings for mod-only keys (also in challengesFallback in openChallengesModal). Resolved here without calling i18n so the client does not log missing keys. */
var CHALLENGES_MOD_ONLY_I18N = {
  'mods.challenges.multiplayer.queueWatchInviteLead': 'A player is in queue in challenges!',
  'mods.challenges.multiplayer.queueWatchInviteJoin': 'Join',
  'mods.challenges.multiplayer.queueWatchInviteTail': 'here!'
};

/** i18n for code that runs before/without the inner mod `t` closure (e.g. queue watch timer). */
function challengesModTranslate(key, fallback) {
  if (CHALLENGES_MOD_ONLY_I18N[key] != null) {
    return CHALLENGES_MOD_ONLY_I18N[key];
  }
  try {
    if (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') {
      var s = context.api.i18n.t(key);
      if (s && typeof s === 'string' && s !== key) return s;
    }
  } catch (e) {}
  return fallback;
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
  },
  delete: function(path) {
    return fetch(path + '.json', { method: 'DELETE' }).then(function(r) {
      if (!r.ok) return Promise.reject(new Error('DELETE ' + r.status));
      return undefined;
    });
  },
  patch: function(path, data) {
    return fetch(path + '.json', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) {
      if (!r.ok) return Promise.reject(new Error('PATCH ' + r.status));
      return r.json();
    });
  }
};

/** Firebase keys cannot contain . $ # [ ] / — sanitize for queue paths */
function sanitizeFirebaseKeyForChallenges(name) {
  if (name == null || typeof name !== 'string') return 'unknown';
  return name
    .replace(/\./g, '_')
    .replace(/\$/g, '_')
    .replace(/#/g, '_')
    .replace(/\[/g, '_')
    .replace(/\]/g, '_')
    .replace(/\//g, '_')
    .trim() || 'unknown';
}

// Multiplayer queue Firebase paths (same DB as leaderboard)
var CHALLENGE_MULTIPLAYER_BASE = CHALLENGE_FIREBASE_CONFIG.firebaseUrl + '/challenges-multiplayer';
function getMultiplayerQueuePath() { return CHALLENGE_MULTIPLAYER_BASE + '/queue'; }
function getMultiplayerMatchesPath() { return CHALLENGE_MULTIPLAYER_BASE + '/matches'; }
function getMultiplayerPlayerMatchesPath() { return CHALLENGE_MULTIPLAYER_BASE + '/playerMatches'; }
function getMultiplayerRatingsPath() { return CHALLENGE_MULTIPLAYER_BASE + '/ratings'; }

/** Delete match document and both playerMatches entries so neither player sees a stale match when re-joining queue. */
function deleteCompletedMatchFromFirebase(matchId) {
  if (!matchId || typeof matchId !== 'string') return;
  var keys = getMatchPlayerKeys(matchId);
  var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + matchId;
  var pmPath = getMultiplayerPlayerMatchesPath();
  ChallengeFirebaseService.delete(matchPath).catch(function() {});
  if (keys[0]) ChallengeFirebaseService.delete(pmPath + '/' + keys[0]).catch(function() {});
  if (keys[1]) ChallengeFirebaseService.delete(pmPath + '/' + keys[1]).catch(function() {});
}

var CHALLENGE_MP_DEFAULT_RATING = 1000;
var CHALLENGE_MP_ELO_K = 32;

/** Get current ratings for two players (default 1000 if missing). Returns { r1, r2, name1, name2, matches1, matches2 }. */
function getMultiplayerRatingsForMatch(key1, key2, name1, name2) {
  var path = getMultiplayerRatingsPath();
  return ChallengeFirebaseService.get(path, null).then(function(ratings) {
    var data = (ratings && typeof ratings === 'object') ? ratings : {};
    var r1 = (data[key1] && typeof data[key1].rating === 'number') ? data[key1].rating : CHALLENGE_MP_DEFAULT_RATING;
    var r2 = (data[key2] && typeof data[key2].rating === 'number') ? data[key2].rating : CHALLENGE_MP_DEFAULT_RATING;
    var matches1 = (data[key1] && typeof data[key1].matches === 'number') ? data[key1].matches : 0;
    var matches2 = (data[key2] && typeof data[key2].matches === 'number') ? data[key2].matches : 0;
    return { r1: r1, r2: r2, name1: name1 || key1, name2: name2 || key2, matches1: matches1, matches2: matches2 };
  });
}

/** Elo: expected score E = 1 / (1 + 10^((oppRating - myRating)/400)); newRating = oldRating + K * (actual - E). actual: 1 win, 0.5 draw, 0 loss.
 * Only counts as a match (increments matches) when both scores are submitted — i.e. completed match (win/draw/loss).
 * @param {boolean} [isForfeit] - If true, rating change is scaled to 10% (forfeit wins/losses count less). */
function updateMultiplayerRatingsAfterMatch(key1, key2, name1, name2, score1, score2, isForfeit) {
  var completed = typeof score1 === 'number' && typeof score2 === 'number';
  if (!completed) return Promise.resolve();
  var actual1 = score1 > score2 ? 1 : score1 < score2 ? 0 : 0.5;
  var actual2 = score2 > score1 ? 1 : score2 < score1 ? 0 : 0.5;
  var k = (isForfeit === true) ? (CHALLENGE_MP_ELO_K * 0.1) : CHALLENGE_MP_ELO_K;
  return getMultiplayerRatingsForMatch(key1, key2, name1, name2).then(function(data) {
    var r1 = data.r1;
    var r2 = data.r2;
    var e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    var e2 = 1 - e1;
    var newR1 = Math.round(r1 + k * (actual1 - e1));
    var newR2 = Math.round(r2 + k * (actual2 - e2));
    newR1 = Math.max(0, newR1);
    newR2 = Math.max(0, newR2);
    var path = getMultiplayerRatingsPath();
    var patch = {};
    patch[key1] = { rating: newR1, name: (name1 && String(name1).trim()) || key1, matches: (data.matches1 || 0) + 1 };
    patch[key2] = { rating: newR2, name: (name2 && String(name2).trim()) || key2, matches: (data.matches2 || 0) + 1 };
    return ChallengeFirebaseService.patch(path, patch);
  }).catch(function(err) {
    console.warn('[Challenges MP] update ratings error', err);
  });
}

/** Ensure a player has a rating entry (1000 if new). Call when they join queue so they appear on leaderboard. */
function ensureMultiplayerRating(playerKey, playerName) {
  if (!playerKey) return Promise.resolve();
  var path = getMultiplayerRatingsPath();
  return ChallengeFirebaseService.get(path, null).then(function(ratings) {
    var data = (ratings && typeof ratings === 'object') ? ratings : {};
    if (data[playerKey] && typeof data[playerKey].rating === 'number') return;
    var patch = {};
    patch[playerKey] = { rating: CHALLENGE_MP_DEFAULT_RATING, name: (playerName && String(playerName).trim()) || playerKey, matches: 0 };
    return ChallengeFirebaseService.patch(path, patch);
  }).catch(function(err) {
    console.warn('[Challenges MP] ensure rating error', err);
  });
}

/** Load all ratings, return array sorted by rating desc, then matches desc, then name asc. */
function loadMultiplayerRatingLeaderboard() {
  var path = getMultiplayerRatingsPath();
  return ChallengeFirebaseService.get(path, null).then(function(ratings) {
    if (!ratings || typeof ratings !== 'object') return [];
    var entries = [];
    Object.keys(ratings).forEach(function(key) {
      var v = ratings[key];
      if (v && typeof v.rating === 'number') {
        entries.push({ key: key, name: (v.name && String(v.name).trim()) || key, rating: v.rating, matches: (typeof v.matches === 'number' ? v.matches : 0) });
      }
    });
    entries.sort(function(a, b) {
      if (a.rating !== b.rating) return b.rating - a.rating;
      if ((a.matches || 0) !== (b.matches || 0)) return (b.matches || 0) - (a.matches || 0);
      return (a.name || a.key).localeCompare(b.name || b.key, undefined, { sensitivity: 'base' });
    });
    return entries;
  });
}

/** Persistent multiplayer state across modal close/reopen. clientToken identifies this tab; matchId/myAccepted/bothAccepted for match acceptance flow. */
var challengesMultiplayerPersisted = { inQueue: false, myKey: null, matchedOpponent: null, joinedAt: null, queueCount: 0, clientToken: null, matchId: null, myAccepted: false, bothAccepted: false, matchCreatedAt: null };
function syncMultiplayerStateToPersisted(state) {
  challengesMultiplayerPersisted.inQueue = state.inQueue;
  challengesMultiplayerPersisted.myKey = state.myKey;
  challengesMultiplayerPersisted.matchedOpponent = state.matchedOpponent;
  challengesMultiplayerPersisted.joinedAt = state.joinedAt;
  challengesMultiplayerPersisted.queueCount = state.queueCount != null ? state.queueCount : 0;
  challengesMultiplayerPersisted.clientToken = state.clientToken != null ? state.clientToken : null;
  challengesMultiplayerPersisted.matchId = state.matchId != null ? state.matchId : null;
  challengesMultiplayerPersisted.myAccepted = state.myAccepted === true;
  challengesMultiplayerPersisted.bothAccepted = state.bothAccepted === true;
  challengesMultiplayerPersisted.matchCreatedAt = state.matchCreatedAt != null ? state.matchCreatedAt : null;
}
function generateMultiplayerClientToken() {
  return 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
}

/** Clear all queue/match state on a state object (does not stop timers or touch Firebase). */
function clearMultiplayerStateFields(state) {
  if (!state) return;
  state.myKey = null;
  state.inQueue = false;
  state.matchedOpponent = null;
  state.joinedAt = null;
  state.queueCount = 0;
  state.clientToken = null;
  state.matchId = null;
  state.myAccepted = false;
  state.bothAccepted = false;
  state.matchCreatedAt = null;
}

/** Return [key1, key2] from matchId (e.g. "key1_key2"). */
function getMatchPlayerKeys(matchId) {
  if (!matchId || typeof matchId !== 'string') return [];
  return matchId.split('_');
}

/** Set state when matched with an opponent (creator or non-creator). matchCreatedAt optional (for accept countdown; see CHALLENGE_MP_ACCEPT_DEADLINE_MS). */
function setMatchedState(state, opponent, matchId, matchCreatedAt) {
  if (!state) return;
  state.matchedOpponent = opponent;
  state.matchId = matchId != null ? matchId : null;
  state.myAccepted = false;
  state.bothAccepted = false;
  state.inQueue = false;
  state.matchCreatedAt = (matchCreatedAt != null && typeof matchCreatedAt === 'number') ? matchCreatedAt : null;
}

/** Close modal, clear multiplayer state, remove toast, then navigate to room. Called when both players accepted. */
function navigateToRoomAndFinishMultiplayerMatch(roomId, roomName) {
  clearMultiplayerStateFields(challengesMultiplayerPersisted);
  removeChallengesPersistentToast();
  closeChallengesModalIfOpen();
  var state = getState();
  if (state && state.board && typeof state.board.send === 'function') {
    showChallengesToast('Going to map: ' + (roomName || roomId), { duration: CHALLENGE_TOAST_DURATION });
    console.log('[Challenges MP] navigateToRoomAndFinishMultiplayerMatch', roomId);
    state.board.send({ type: 'selectRoomById', roomId: roomId });
  } else {
    showChallengeToastNotification('Could not navigate to map.');
  }
}

var CHALLENGE_MP_ROLL_DELAY_MS = 5000;
var CHALLENGE_MP_TIME_LIMIT_MS = 3 * 60 * 1000; // 3 minutes
var CHALLENGE_MP_ACCEPT_DEADLINE_MS = 30 * 1000; // time to accept match; after that remove from queue / re-queue if one accepted
var CHALLENGE_MP_QUEUE_POLL_MS = 1000; // Firebase GET /queue while in matchmaking (1s; e.g. after toast Join)
var CHALLENGE_MP_QUEUE_UI_TICK_MS = 1000; // refresh wait time (m:ss) every second while in queue
/** While matched (accept phase): poll Firebase match doc every 1s so countdown + accept state stay current. */
var CHALLENGE_MP_ACCEPT_POLL_MS = 1000;
var CHALLENGE_MP_SCORE_POLL_MS = 2000;
var CHALLENGE_MP_TOAST_UPDATE_MS = 1000; // live toast (vs opponent · countdown) refresh every 1s

/** Set when a multiplayer challenge starts; cleared after scores are submitted and result shown. */
var challengeMultiplayerContext = null;
var challengeMultiplayerTimerId = null;
var challengeMultiplayerToastIntervalId = null;
var challengeMultiplayerScorePollIntervalId = null;
var CHALLENGE_MP_QUEUE_WATCH_MS = 60 * 1000;
var CHALLENGE_MP_QUEUE_WATCH_FIRST_MS = 1500;
/** Queue-watch invite toast visibility (ms). Must match setTimeout in showChallengesToast for transient toasts. */
var CHALLENGE_QUEUE_WATCH_TOAST_MS = 10 * 1000;
var lastMultiplayerQueueToastFingerprint = null;
var challengeMultiplayerQueueWatchIntervalId = null;
var challengeMultiplayerQueueWatchFirstTimeoutId = null;

function isMultiplayerQueueWatchDebug() {
  return typeof window !== 'undefined' && window.__challengesQueueWatchDebug === true;
}

function shouldQueueWatchIncludeSelf() {
  return typeof window !== 'undefined' && window.__challengesQueueWatchIncludeSelf === true;
}

/** Background check: toast when other players are in the multiplayer queue. Same snapshot = no repeat toast.
 *  Debug: set window.__challengesQueueWatchDebug = true for console logs each poll.
 *  Solo test toast: window.__challengesQueueWatchIncludeSelf = true (count yourself as "others").
 *  Manual poll: window.__challengesPollMultiplayerQueueWatch && window.__challengesPollMultiplayerQueueWatch()
 */
function pollMultiplayerQueueForToast() {
  if (typeof ChallengeFirebaseService === 'undefined' || typeof ChallengeFirebaseService.get !== 'function') {
    if (isMultiplayerQueueWatchDebug()) console.log('[Challenges MP]', 'queueWatch: skipped (ChallengeFirebaseService missing)');
    return;
  }
  var queuePath = getMultiplayerQueuePath();
  ChallengeFirebaseService.get(queuePath, {}).then(function(queueData) {
    var myName = (getCurrentPlayerName() || '').trim();
    var myKey = myName && myName !== 'Unknown' ? sanitizeFirebaseKeyForChallenges(myName) : null;
    var includeSelf = shouldQueueWatchIncludeSelf();
    var entries = [];
    var rawKeyCount = queueData && typeof queueData === 'object' ? Object.keys(queueData).length : 0;
    if (queueData && typeof queueData === 'object') {
      Object.keys(queueData).forEach(function(k) {
        var v = queueData[k];
        if (!v || v.playerName == null || v.joinedAt == null) return;
        if (!includeSelf && myKey && k === myKey) return;
        entries.push({ key: k, playerName: String(v.playerName), joinedAt: v.joinedAt, clientToken: v.clientToken != null ? String(v.clientToken) : '' });
      });
    }
    entries.sort(function(a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
    if (entries.length === 0) {
      lastMultiplayerQueueToastFingerprint = null;
      if (isMultiplayerQueueWatchDebug()) {
        console.log('[Challenges MP]', 'queueWatch: poll', queuePath, { rawKeys: rawKeyCount, others: 0, includeSelf: includeSelf, myKey: myKey || null, resetFingerprint: true });
      }
      return;
    }
    var fingerprint = entries.map(function(e) { return e.key + ':' + e.joinedAt + ':' + e.clientToken; }).join('|');
    var sameAsLast = fingerprint === lastMultiplayerQueueToastFingerprint;
    if (sameAsLast) {
      if (isMultiplayerQueueWatchDebug()) {
        console.log('[Challenges MP]', 'queueWatch: poll', queuePath, { rawKeys: rawKeyCount, others: entries.length, sameFingerprint: true, noToast: true });
      }
      return;
    }
    lastMultiplayerQueueToastFingerprint = fingerprint;
    if (isMultiplayerQueueWatchDebug()) {
      console.log('[Challenges MP]', 'queueWatch: poll', queuePath, { rawKeys: rawKeyCount, others: entries.length, toast: true, withJoinLink: true });
    }
    showChallengesToast('', { duration: CHALLENGE_QUEUE_WATCH_TOAST_MS, withJoinLink: true });
  }).catch(function(err) {
    console.warn('[Challenges MP]', 'queueWatch: error', queuePath, err);
  });
}

function startMultiplayerQueueWatchInterval() {
  if (typeof setInterval === 'undefined') return;
  if (challengeMultiplayerQueueWatchIntervalId != null) {
    clearInterval(challengeMultiplayerQueueWatchIntervalId);
    challengeMultiplayerQueueWatchIntervalId = null;
  }
  if (challengeMultiplayerQueueWatchFirstTimeoutId != null) {
    clearTimeout(challengeMultiplayerQueueWatchFirstTimeoutId);
    challengeMultiplayerQueueWatchFirstTimeoutId = null;
  }
  challengeMultiplayerQueueWatchIntervalId = setInterval(pollMultiplayerQueueForToast, CHALLENGE_MP_QUEUE_WATCH_MS);
  challengeMultiplayerQueueWatchFirstTimeoutId = setTimeout(function() {
    challengeMultiplayerQueueWatchFirstTimeoutId = null;
    pollMultiplayerQueueForToast();
  }, CHALLENGE_MP_QUEUE_WATCH_FIRST_MS);
}

function formatTimeRemainingMs(ms) {
  var sec = Math.max(0, Math.floor(ms / 1000));
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function buildMultiplayerLiveToastMessage(ctx) {
  if (!ctx || !ctx.startTime) return '';
  var elapsed = Date.now() - ctx.startTime;
  var timeStr = elapsed >= CHALLENGE_MP_TIME_LIMIT_MS ? '0:00' : formatTimeRemainingMs(CHALLENGE_MP_TIME_LIMIT_MS - elapsed);
  var keys = getMatchPlayerKeys(ctx.matchId);
  var name1 = (ctx.cachedMatch && ctx.cachedMatch.player1 != null) ? String(ctx.cachedMatch.player1).trim() || keys[0] : keys[0];
  var name2 = (ctx.cachedMatch && ctx.cachedMatch.player2 != null) ? String(ctx.cachedMatch.player2).trim() || keys[1] : keys[1];
  var s1 = (ctx.cachedMatch && ctx.cachedMatch.scores && typeof ctx.cachedMatch.scores[keys[0]] === 'number') ? ctx.cachedMatch.scores[keys[0]] : '—';
  var s2 = (ctx.cachedMatch && ctx.cachedMatch.scores && typeof ctx.cachedMatch.scores[keys[1]] === 'number') ? ctx.cachedMatch.scores[keys[1]] : '—';
  var alliesAllowedText = (ctx && typeof ctx.alliesAllowed === 'number') ? String(ctx.alliesAllowed) : '—';
  return 'Time: ' + timeStr + '\n' +
    'Creatures allowed: ' + alliesAllowedText + '\n' +
    name1 + ': ' + s1 + '\n' +
    name2 + ': ' + s2;
}

function buildSoloCreaturesAllowedToastMessage(alliesAllowed) {
  var n = typeof alliesAllowed === 'number' ? alliesAllowed : 0;
  return 'Creatures allowed: ' + String(n);
}

function startSoloChallengeLiveToast(alliesAllowed) {
  if (challengeMultiplayerContext) return;
  stopSoloChallengeToast();
  showChallengesToast(buildSoloCreaturesAllowedToastMessage(alliesAllowed));
}

function stopSoloChallengeToast() {
  removeChallengesPersistentToast();
}

function updateMultiplayerChallengeToast() {
  var ctx = challengeMultiplayerContext;
  if (!ctx || !ctx.startTime) return;
  var elapsed = Date.now() - ctx.startTime;
  if (elapsed >= CHALLENGE_MP_TIME_LIMIT_MS) return;
  var msg = buildMultiplayerLiveToastMessage(ctx);
  if (msg && challengesPersistentToastHandle && challengesPersistentToastHandle.updateMessage) {
    challengesPersistentToastHandle.updateMessage(msg);
  }
}

function pollMultiplayerMatchScores() {
  var ctx = challengeMultiplayerContext;
  if (!ctx || !ctx.matchId || !ctx.myKey) return;
  var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + ctx.matchId;
  ChallengeFirebaseService.get(matchPath, null).then(function(match) {
    if (!challengeMultiplayerContext || challengeMultiplayerContext.matchId !== ctx.matchId) return;
    if (!match) {
      if (challengeMultiplayerScorePollIntervalId != null) {
        clearInterval(challengeMultiplayerScorePollIntervalId);
        challengeMultiplayerScorePollIntervalId = null;
      }
      if (challengeMultiplayerToastIntervalId != null) {
        clearInterval(challengeMultiplayerToastIntervalId);
        challengeMultiplayerToastIntervalId = null;
      }
      if (challengeMultiplayerTimerId != null) {
        clearTimeout(challengeMultiplayerTimerId);
        challengeMultiplayerTimerId = null;
      }
      removeChallengesPersistentToast();
      var keys = getMatchPlayerKeys(ctx.matchId);
      var bothScoresIn = keys.length >= 2 && ctx.cachedMatch && ctx.cachedMatch.scores
        && typeof ctx.cachedMatch.scores[keys[0]] === 'number'
        && typeof ctx.cachedMatch.scores[keys[1]] === 'number';
      if (bothScoresIn) {
        /* Match was completed (both scores in) and then deleted by the other client; do not show forfeit. */
        if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
        challengeMultiplayerContext = null;
        return;
      }
      var tf = (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') ? context.api.i18n.t.bind(context.api.i18n) : function(k) { return k; };
      var oppKey = (keys.length >= 2 && ctx.myKey) ? (keys[0] === ctx.myKey ? keys[1] : keys[0]) : null;
      var oppName = oppKey && ctx.cachedMatch && (ctx.cachedMatch.player1Key === oppKey || ctx.cachedMatch.player2Key === oppKey)
        ? (ctx.cachedMatch.player1Key === oppKey ? (ctx.cachedMatch.player1 || oppKey) : (ctx.cachedMatch.player2 || oppKey))
        : (oppKey || 'Opponent');
      var winByForfeitTemplate = tf('mods.challenges.multiplayer.winByForfeitWithOpponent') || '{name} has disconnected. Win by forfeit!';
      var winByForfeitMsg = winByForfeitTemplate.replace('{name}', String(oppName).trim() || 'Opponent');
      showChallengesToast(winByForfeitMsg, { duration: 10000 });
      if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
      challengeMultiplayerContext = null;
      return;
    }
    var scores = (match && match.scores && typeof match.scores === 'object') ? match.scores : {};
    var keys = getMatchPlayerKeys(ctx.matchId);
    if (keys.length < 2) return;
    ctx.cachedMatch = ctx.cachedMatch || {};
    ctx.cachedMatch.player1 = (match && match.player1 != null) ? match.player1 : keys[0];
    ctx.cachedMatch.player2 = (match && match.player2 != null) ? match.player2 : keys[1];
    if (match && match.player1Key != null) ctx.cachedMatch.player1Key = match.player1Key;
    if (match && match.player2Key != null) ctx.cachedMatch.player2Key = match.player2Key;
    ctx.cachedMatch.scores = { [keys[0]]: scores[keys[0]], [keys[1]]: scores[keys[1]] };
    var has1 = typeof scores[keys[0]] === 'number';
    var has2 = typeof scores[keys[1]] === 'number';
    if (has1 && has2) {
      if (challengeMultiplayerScorePollIntervalId != null) {
        clearInterval(challengeMultiplayerScorePollIntervalId);
        challengeMultiplayerScorePollIntervalId = null;
      }
      if (challengeMultiplayerToastIntervalId != null) {
        clearInterval(challengeMultiplayerToastIntervalId);
        challengeMultiplayerToastIntervalId = null;
      }
      if (challengeMultiplayerTimerId != null) {
        clearTimeout(challengeMultiplayerTimerId);
        challengeMultiplayerTimerId = null;
      }
      removeChallengesPersistentToast();
      var player1Key = (match && match.player1Key != null) ? String(match.player1Key) : keys[0];
      var player2Key = (match && match.player2Key != null) ? String(match.player2Key) : keys[1];
      var name1 = (player1Key === keys[0]) ? ((match && match.player1 != null) ? String(match.player1).trim() : keys[0]) : ((match && match.player2 != null) ? String(match.player2).trim() : keys[0]);
      var name2 = (player1Key === keys[1]) ? ((match && match.player1 != null) ? String(match.player1).trim() : keys[1]) : ((match && match.player2 != null) ? String(match.player2).trim() : keys[1]);
      if (!name1) name1 = keys[0];
      if (!name2) name2 = keys[1];
      var resultData = { score1: scores[keys[0]], score2: scores[keys[1]], key1: keys[0], key2: keys[1], name1: name1, name2: name2 };
      var completedMatchId = ctx.matchId;
      updateMultiplayerRatingsAfterMatch(keys[0], keys[1], name1, name2, scores[keys[0]], scores[keys[1]]).then(function() {
        showMultiplayerResult(ctx, resultData);
      }).catch(function() {
        showMultiplayerResult(ctx, resultData);
      });
      challengeMultiplayerContext = null;
      deleteCompletedMatchFromFirebase(completedMatchId);
      return;
    }
    if (ctx.startTime && (Date.now() - ctx.startTime) >= CHALLENGE_MP_TIME_LIMIT_MS) {
      if (challengeMultiplayerScorePollIntervalId != null) {
        clearInterval(challengeMultiplayerScorePollIntervalId);
        challengeMultiplayerScorePollIntervalId = null;
      }
      if (challengeMultiplayerToastIntervalId != null) {
        clearInterval(challengeMultiplayerToastIntervalId);
        challengeMultiplayerToastIntervalId = null;
      }
      if (challengeMultiplayerTimerId != null) {
        clearTimeout(challengeMultiplayerTimerId);
        challengeMultiplayerTimerId = null;
      }
      removeChallengesPersistentToast();
      var timeUpMatchId = ctx.matchId;
      showMultiplayerResult(ctx, null);
      challengeMultiplayerContext = null;
      deleteCompletedMatchFromFirebase(timeUpMatchId);
      return;
    }
    updateMultiplayerChallengeToast();
  });
}

function stopMultiplayerChallengeToast() {
  if (challengeMultiplayerToastIntervalId != null) {
    clearInterval(challengeMultiplayerToastIntervalId);
    challengeMultiplayerToastIntervalId = null;
  }
  if (challengeMultiplayerScorePollIntervalId != null) {
    clearInterval(challengeMultiplayerScorePollIntervalId);
    challengeMultiplayerScorePollIntervalId = null;
  }
  removeChallengesPersistentToast();
}

function ensureChallengesModalOpenOnMultiplayerTab() {
  if (!isChallengesModalOpen()) {
    if (typeof openChallengesModal === 'function') openChallengesModal();
    setTimeout(function() {
      if (typeof window !== 'undefined' && window.__challengesSetActiveTab) window.__challengesSetActiveTab(1);
    }, 250);
  } else {
    if (typeof window !== 'undefined' && window.__challengesSetActiveTab) window.__challengesSetActiveTab(1);
  }
}

function openChallengesModalMultiplayerAndJoinQueue() {
  try {
    function tabAndJoin() {
      if (typeof window !== 'undefined' && window.__challengesSetActiveTab) window.__challengesSetActiveTab(1);
      var attempts = 0;
      function tryJoin() {
        if (typeof window !== 'undefined' && typeof window.__challengesMultiplayerDoJoin === 'function') {
          window.__challengesMultiplayerDoJoin();
          return;
        }
        attempts++;
        if (attempts < 40) setTimeout(tryJoin, 50);
      }
      setTimeout(tryJoin, 0);
    }
    if (!isChallengesModalOpen()) {
      if (typeof openChallengesModal === 'function') openChallengesModal();
      setTimeout(tabAndJoin, 250);
    } else {
      tabAndJoin();
    }
  } catch (e) {
    console.warn('[Challenges Mod] openChallengesModalMultiplayerAndJoinQueue', e);
  }
}

function normalizeVillainSpecsArray(specs) {
  if (Array.isArray(specs)) return specs;
  if (specs && typeof specs === 'object') {
    return Object.keys(specs).sort(function(a, b) { return Number(a) - Number(b); }).map(function(k) { return specs[k]; }).filter(Boolean);
  }
  return [];
}

function runMultiplayerRollThenStart(roomId, roomName, villainSpecs, matchId, myKey, opponentName) {
  var specs = normalizeVillainSpecsArray(villainSpecs);
  if (!roomId || !specs.length) {
    showChallengeToastNotification('Invalid match roll.');
    return;
  }
  villainSpecs = specs;
  ensureChallengesModalOpenOnMultiplayerTab();
  var diff = computeChallengeDifficulty(villainSpecs);
  var expectedScore = Math.round(computeChallengeScore(500, diff.difficulty, 'A') / 100) * 100;

  function doAfterRoll() {
    if (typeof window !== 'undefined' && window.__challengesMpSetRollResult) {
      window.__challengesMpSetRollResult(roomId, roomName, villainSpecs, diff, expectedScore);
    }
    setTimeout(function() {
    clearMultiplayerStateFields(challengesMultiplayerPersisted);
    if (matchId && myKey) {
      if (challengeMultiplayerTimerId != null) {
        clearTimeout(challengeMultiplayerTimerId);
        challengeMultiplayerTimerId = null;
      }
      var startTime = Date.now();
      challengeMultiplayerContext = {
        matchId: matchId,
        myKey: myKey,
        difficulty: diff.difficulty,
        alliesAllowed: diff.alliesAllowed,
        startTime: startTime,
        opponentName: opponentName || '',
        cachedMatch: null
      };
      var keys = getMatchPlayerKeys(matchId);
      challengeMultiplayerContext.cachedMatch = {
        player1: (myKey === keys[0] ? (getCurrentPlayerName() || keys[0]) : (opponentName || keys[0])),
        player2: (myKey === keys[1] ? (getCurrentPlayerName() || keys[1]) : (opponentName || keys[1])),
        scores: {}
      };
      var initialMsg = buildMultiplayerLiveToastMessage(challengeMultiplayerContext);
      removeChallengesPersistentToast();
      showChallengesToast(initialMsg);
      updateMultiplayerChallengeToast();
      challengeMultiplayerToastIntervalId = setInterval(updateMultiplayerChallengeToast, CHALLENGE_MP_TOAST_UPDATE_MS);
      pollMultiplayerMatchScores();
      challengeMultiplayerScorePollIntervalId = setInterval(pollMultiplayerMatchScores, CHALLENGE_MP_SCORE_POLL_MS);
    } else {
      removeChallengesPersistentToast();
    }
    startChallengeWithVillainConfig({ roomId: roomId, roomName: roomName || roomId, villains: villainSpecs });
    if (challengeMultiplayerContext) {
      challengeMultiplayerTimerId = setTimeout(function() {
        challengeMultiplayerTimerId = null;
        onMultiplayerTimeLimitReached();
      }, CHALLENGE_MP_TIME_LIMIT_MS);
    }
  }, CHALLENGE_MP_ROLL_DELAY_MS);
  }

  if (typeof window !== 'undefined' && window.__challengesRunMultiplayerRoll) {
    window.__challengesRunMultiplayerRoll(roomId, roomName, specs, doAfterRoll);
  } else {
    doAfterRoll();
  }
}

/** Submit multiplayer score. Live toast stays visible; pollMultiplayerMatchScores will detect both scores and show result. scoreOverride: if a number (including 0), use it; otherwise compute from current board (for time-up). */
function onMultiplayerTimeLimitReached(scoreOverride) {
  var ctx = challengeMultiplayerContext;
  if (!ctx || !ctx.matchId || !ctx.myKey) return;
  var difficulty = ctx.difficulty;
  var alliesAllowed = ctx.alliesAllowed;
  var score;
  if (typeof scoreOverride === 'number') {
    score = scoreOverride; // Defeat: 0; Victory: use score from onVictory
  } else {
    score = computeMultiplayerScoreFromBoardState(alliesAllowed, difficulty);
  }
  var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + ctx.matchId;
  var t = (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') ? context.api.i18n.t.bind(context.api.i18n) : function(k) { return k; };
  ChallengeFirebaseService.get(matchPath, null).then(function(match) {
    var scores = (match && match.scores && typeof match.scores === 'object') ? Object.assign({}, match.scores) : {};
    scores[ctx.myKey] = score;
    return ChallengeFirebaseService.patch(matchPath, { scores: scores });
  }).then(function() {
    ctx.submittedAt = ctx.submittedAt || Date.now();
    ctx.cachedMatch = ctx.cachedMatch || {};
    ctx.cachedMatch.scores = ctx.cachedMatch.scores || {};
    ctx.cachedMatch.scores[ctx.myKey] = score;
  }).catch(function(err) {
    console.warn('[Challenges MP] submit score error', err);
    stopMultiplayerChallengeToast();
    showChallengeToastNotification(t('mods.challenges.multiplayer.submitError') || 'Could not submit score.');
    challengeMultiplayerContext = null;
  });
}

function showMultiplayerResult(ctx, data) {
  var t = (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') ? context.api.i18n.t.bind(context.api.i18n) : function(k) { return k; };
  if (!data) {
    showChallengeToastNotification(t('mods.challenges.multiplayer.timeUp') || 'Time\'s up!');
    return;
  }
  var myScore = data.key1 === ctx.myKey ? data.score1 : data.score2;
  var otherScore = data.key1 === ctx.myKey ? data.score2 : data.score1;
  var name1 = (data.name1 != null && data.name1 !== '') ? String(data.name1) : data.key1;
  var name2 = (data.name2 != null && data.name2 !== '') ? String(data.name2) : data.key2;
  var resultText = myScore > otherScore ? (t('mods.challenges.multiplayer.youWin') || 'You win!')
    : myScore < otherScore ? (t('mods.challenges.multiplayer.youLose') || 'You lose.')
    : (t('mods.challenges.multiplayer.draw') || 'Draw.');
  var scoresAndResult = name1 + ': ' + data.score1 + '\n' + name2 + ': ' + data.score2 + '\n' + resultText;
  var resultColor = myScore > otherScore ? '#22c55e' : myScore < otherScore ? '#ef4444' : null;
  showChallengesToast(scoresAndResult, { duration: 6000, messageColor: resultColor || undefined });
  if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
  if (typeof window !== 'undefined') {
    window.setTimeout(function() {
      ensureChallengesModalOpenOnMultiplayerTab();
    }, 5000);
  }
}

/** When both players accepted: ensure modal on Multiplayer tab, chooser rolls map+creatures and writes to Firebase; both show roll for 5s then start challenge. */
function handleMultiplayerMatchReady(matchId, myKey) {
  if (!matchId || !myKey) return;
  var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + matchId;
  ChallengeFirebaseService.get(matchPath, null).then(function(match) {
    var keys = getMatchPlayerKeys(matchId);
    var opponentName = (match && keys.length >= 2) ? (myKey === keys[0] ? (match.player2 || 'Opponent') : (match.player1 || 'Opponent')) : 'Opponent';
    var existingSpecs = normalizeVillainSpecsArray(match && match.chosenVillainSpecs);
    if (match && match.chosenRoomId && existingSpecs.length > 0) {
      console.log('[Challenges MP] match already has roll', match.chosenRoomId);
      runMultiplayerRollThenStart(match.chosenRoomId, match.chosenRoomName, existingSpecs, matchId, myKey, opponentName);
      return;
    }
    if (keys.length < 2) return;
    var isChooser = (myKey === keys[0]);
    if (isChooser) {
      var allRooms = getAllRoomsForReel();
      if (!allRooms || !allRooms.length) {
        showChallengeToastNotification('No maps available.');
        return;
      }
      var picked = pickRandomFromArray(allRooms, 1)[0];
      var roomId = picked.roomId;
      var roomName = picked.roomName || roomId;
      var villainSpecs = pickRandomCreatureSpecsForRoom(roomId);
      if (!villainSpecs || !villainSpecs.length) {
        showChallengeToastNotification('Could not roll creatures for map.');
        return;
      }
      console.log('[Challenges MP] chosen map + creatures', roomId, villainSpecs.length);
      ChallengeFirebaseService.patch(matchPath, {
        chosenRoomId: roomId,
        chosenRoomName: roomName,
        chosenVillainSpecs: villainSpecs,
        chosenAt: Date.now()
      }).then(function() {
        runMultiplayerRollThenStart(roomId, roomName, villainSpecs, matchId, myKey, opponentName);
      }).catch(function(err) {
        console.warn('[Challenges MP] PATCH chosen roll failed', err);
        runMultiplayerRollThenStart(roomId, roomName, villainSpecs, matchId, myKey, opponentName);
      });
    } else {
      var pollCount = 0;
      var maxPolls = 30;
      var iv = setInterval(function() {
        pollCount++;
        ChallengeFirebaseService.get(matchPath, null).then(function(m) {
          var polledSpecs = normalizeVillainSpecsArray(m && m.chosenVillainSpecs);
          if (m && m.chosenRoomId && polledSpecs.length > 0) {
            clearInterval(iv);
            var opp = (m.player1 && m.player2 && keys.length >= 2) ? (myKey === keys[0] ? m.player2 : m.player1) : 'Opponent';
            console.log('[Challenges MP] got chosen roll from match', m.chosenRoomId);
            runMultiplayerRollThenStart(m.chosenRoomId, m.chosenRoomName, polledSpecs, matchId, myKey, opp);
          }
        });
        if (pollCount >= maxPolls) clearInterval(iv);
      }, 1000);
    }
  });
}

// Matchmaking toasts use the unified showChallengesToast (same container as other challenge toasts).
function showChallengesMatchmakingToast(message, options) {
  options = options || {};
  return showChallengesToast(message, {
    showAccept: options.showAccept === true,
    acceptLabel: options.acceptLabel,
    onClose: function() {
      if (typeof window !== 'undefined' && window.__challengesMultiplayerDoLeave) window.__challengesMultiplayerDoLeave();
      removeChallengesPersistentToast();
    }
  });
}
function removeChallengesMatchmakingToast() {
  removeChallengesPersistentToast();
}
if (typeof window !== 'undefined') {
  window.__challengesMultiplayerDoLeave = function() {
    var key = challengesMultiplayerPersisted.myKey;
    if (!key) return;
    clearMultiplayerStateFields(challengesMultiplayerPersisted);
    ChallengeFirebaseService.delete(getMultiplayerQueuePath() + '/' + key).catch(function() {});
    ChallengeFirebaseService.delete(getMultiplayerPlayerMatchesPath() + '/' + key).catch(function() {});
    removeChallengesPersistentToast();
  };
}

/** Reset local multiplayer state and clear this player's queue/match from Firebase so the mod starts on a clean slate. Called on script init. */
function clearMultiplayerSlateForCurrentPlayer() {
  console.log('[Challenges MP]','clearMultiplayerSlateForCurrentPlayer');
  clearMultiplayerStateFields(challengesMultiplayerPersisted);
  var name = (getCurrentPlayerName() || '').trim();
  if (!name || name === 'Unknown') {
    console.log('[Challenges MP]','clearSlate: no player name, skipped Firebase');
    if (typeof console !== 'undefined' && console.log) {
      console.log('[Challenges Mod] Multiplayer slate: local state reset. Player name not set yet — Firebase cleanup will retry.');
    }
    return;
  }
  var key = sanitizeFirebaseKeyForChallenges(name);
  var queuePath = getMultiplayerQueuePath() + '/' + key;
  var playerMatchPath = getMultiplayerPlayerMatchesPath() + '/' + key;
  var matchesPath = CHALLENGE_MULTIPLAYER_BASE + '/matches';
  console.log('[Challenges MP]','clearSlate: clearing queue + playerMatch + match (if any) for', name, 'key=', key);
  if (typeof console !== 'undefined' && console.log) {
    console.log('[Challenges Mod] Multiplayer slate: clearing Firebase for', name, '(queue + playerMatch + match).');
  }
  function doDeleteMatchAndPlayerMatches(matchId, opponentKey) {
    var matchDocPath = matchesPath + '/' + matchId;
    var opponentMatchPath = getMultiplayerPlayerMatchesPath() + '/' + opponentKey;
    console.log('[Challenges MP]','clearSlate: removing match', matchId, 'and both playerMatch entries');
    ChallengeFirebaseService.delete(matchDocPath).catch(function() {});
    ChallengeFirebaseService.delete(opponentMatchPath).catch(function() {});
  }
  ChallengeFirebaseService.get(playerMatchPath, null).then(function(myMatch) {
    if (myMatch && myMatch.matchId && myMatch.opponent) {
      var opponentKey = sanitizeFirebaseKeyForChallenges(myMatch.opponent);
      var matchDocPathForGet = matchesPath + '/' + myMatch.matchId;
      ChallengeFirebaseService.get(matchDocPathForGet, null).then(function(match) {
        if (match && (match.chosenRoomId || (match.scores && typeof match.scores === 'object'))) {
          var keys = getMatchPlayerKeys(myMatch.matchId);
          var oppKey = (keys[0] === key) ? keys[1] : keys[0];
          var oppName = (match.player1Key === oppKey) ? (match.player1 || oppKey) : (match.player2 || oppKey);
          var scores = (match.scores && typeof match.scores === 'object') ? Object.assign({}, match.scores) : {};
          scores[key] = 0;
          if (typeof console !== 'undefined' && console.log) {
            console.log('[Challenges MP] forfeit (clearSlate)', { matchId: myMatch.matchId, refresherKey: key, refresherName: name, opponentKey: oppKey, opponentName: oppName, ratingsUpdate: { key1: oppKey, name1: oppName, key2: key, name2: name, score1: 1, score2: 0 } });
          }
          ChallengeFirebaseService.patch(matchDocPathForGet, { scores: scores }).then(function() {
            return updateMultiplayerRatingsAfterMatch(oppKey, key, oppName, name, 1, 0);
          }).then(function() {
            doDeleteMatchAndPlayerMatches(myMatch.matchId, opponentKey);
            ChallengeFirebaseService.delete(queuePath).catch(function() {});
            ChallengeFirebaseService.delete(playerMatchPath).catch(function() {});
          }).catch(function(err) {
            console.warn('[Challenges MP] clearSlate: forfeit failed', err);
            doDeleteMatchAndPlayerMatches(myMatch.matchId, opponentKey);
            ChallengeFirebaseService.delete(queuePath).catch(function() {});
            ChallengeFirebaseService.delete(playerMatchPath).catch(function() {});
          });
        } else {
          doDeleteMatchAndPlayerMatches(myMatch.matchId, opponentKey);
          ChallengeFirebaseService.delete(queuePath).catch(function() {});
          ChallengeFirebaseService.delete(playerMatchPath).catch(function() {});
        }
      }).catch(function() {
        doDeleteMatchAndPlayerMatches(myMatch.matchId, opponentKey);
        ChallengeFirebaseService.delete(queuePath).catch(function() {});
        ChallengeFirebaseService.delete(playerMatchPath).catch(function() {});
      });
    } else {
      ChallengeFirebaseService.get(matchesPath, {}).then(function(matchesData) {
        if (matchesData && typeof matchesData === 'object') {
          Object.keys(matchesData).forEach(function(matchId) {
            var m = matchesData[matchId];
            if (!m || (m.player1 !== name && m.player2 !== name)) return;
            var other = (m.player1 === name ? m.player2 : m.player1);
            var opponentKey = sanitizeFirebaseKeyForChallenges(other);
            console.log('[Challenges MP]','clearSlate: found orphan match via matches scan', matchId);
            doDeleteMatchAndPlayerMatches(matchId, opponentKey);
          });
        }
      });
    }
    ChallengeFirebaseService.delete(queuePath).catch(function() {});
    ChallengeFirebaseService.delete(playerMatchPath).catch(function() {});
  }).catch(function() {
    ChallengeFirebaseService.get(matchesPath, {}).then(function(matchesData) {
      if (matchesData && typeof matchesData === 'object') {
        Object.keys(matchesData).forEach(function(matchId) {
          var m = matchesData[matchId];
          if (!m || (m.player1 !== name && m.player2 !== name)) return;
          var other = (m.player1 === name ? m.player2 : m.player1);
          var opponentKey = sanitizeFirebaseKeyForChallenges(other);
          doDeleteMatchAndPlayerMatches(matchId, opponentKey);
        });
      }
    });
    ChallengeFirebaseService.delete(queuePath).catch(function() {});
    ChallengeFirebaseService.delete(playerMatchPath).catch(function() {});
  });
}

clearMultiplayerSlateForCurrentPlayer();
if (typeof setTimeout !== 'undefined') {
  setTimeout(clearMultiplayerSlateForCurrentPlayer, 500);
  setTimeout(clearMultiplayerSlateForCurrentPlayer, 2000);
}
if (typeof window !== 'undefined') {
  window.__challengesPollMultiplayerQueueWatch = pollMultiplayerQueueForToast;
  window.__challengesOpenMultiplayerAndJoin = openChallengesModalMultiplayerAndJoinQueue;
}
startMultiplayerQueueWatchInterval();

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
  var challengesFallback = { 'mods.challenges.title': 'Challenges', 'mods.challenges.tabs.solo': 'Solo', 'mods.challenges.tabs.multiplayer': 'Multiplayer', 'mods.challenges.help': 'Help', 'mods.challenges.maps': 'Maps', 'mods.challenges.creatures': 'Creatures', 'mods.challenges.summary': 'Summary', 'mods.challenges.randomize': 'Randomize', 'mods.challenges.skip': 'Skip', 'mods.challenges.start': 'Start', 'mods.challenges.close': 'Close', 'mods.challenges.comingSoon': 'Coming soon.', 'mods.challenges.rolling': 'Rolling…', 'mods.challenges.rollFailed': 'Roll failed', 'mods.challenges.loadSetupTitle': 'Load this challenge setup', 'mods.challenges.mapLabel': 'Map:', 'mods.challenges.creaturesLabel': 'Creatures:', 'mods.challenges.difficultyLabel': 'Difficulty: ', 'mods.challenges.expectedScoreLabel': 'Expected score: ', 'mods.challenges.expectedScoreTitle': 'Score you would get for A rank with 500 ticks', 'mods.challenges.alliesVsEnemiesTitle': 'Allies v Enemies (allies allowed vs number of enemy creatures)', 'mods.challenges.globalTop10': 'Global Top 10', 'mods.challenges.personalTop10': 'Personal Top 10', 'mods.challenges.loading': 'Loading…', 'mods.challenges.rankLabel': 'Rank:', 'mods.challenges.victory': 'Victory!', 'mods.challenges.deleteRun': 'Delete run', 'mods.challenges.helpPanel.howToPlayTitle': 'How to play', 'mods.challenges.helpPanel.howToPlayText': 'Click Randomize to roll a map and creatures, then Start to play the battle. Your score is based on ticks, grade (team size and creatures alive), and difficulty.', 'mods.challenges.helpPanel.title': 'How challenge score is calculated', 'mods.challenges.helpPanel.formula': 'Formula', 'mods.challenges.helpPanel.formulaText': 'Score = round( ( (1000 − ticks) + gradeBonus ) × difficultyMultiplier )', 'mods.challenges.helpPanel.removeTicks': 'Remove Ticks', 'mods.challenges.helpPanel.baseValueTicks': 'Base value: (1000 − ticks).', 'mods.challenges.helpPanel.gradeBonus': 'Grade bonus', 'mods.challenges.helpPanel.gradeSPlus': 'S+ : +1500', 'mods.challenges.helpPanel.gradeS': 'S : +1250', 'mods.challenges.helpPanel.gradeA': 'A : +1000', 'mods.challenges.helpPanel.gradeB': 'B : +750', 'mods.challenges.helpPanel.gradeC': 'C : +500', 'mods.challenges.helpPanel.gradeD': 'D : +250', 'mods.challenges.helpPanel.gradeDescription': 'Grade is from max team size, current team size and creatures alive (time is not used). Defeat = F, 0 points.', 'mods.challenges.helpPanel.gradeF': 'F : +0 (defeat)', 'mods.challenges.helpPanel.difficultyMultiplier': 'Difficulty multiplier', 'mods.challenges.helpPanel.difficultyMultiplierDescription': 'Based on how many allies you were allowed vs how many enemy creatures (e.g. 1 v 5). Raw difficulty is the internal number that encodes how hard the setup is; the displayed/score multiplier is 10 × (raw÷1000)^{power}, so lower difficulties grant more score (steep at the low end). Shown in the summary and leaderboard (e.g. raw 100 → ~3.16×, raw 500 → ~7.07×, raw 1000 → 10×).', 'mods.challenges.helpPanel.soloTitle': 'Solo', 'mods.challenges.helpPanel.mpTitle': 'Multiplayer', 'mods.challenges.helpPanel.mpHowToPlayTitle': 'How to play', 'mods.challenges.helpPanel.mpHowToPlayText': 'Click Join queue to enter matchmaking. When another player is in the queue, you are paired and both must accept. The creator rolls map and creatures; both see the same roll animation, then the battle starts.', 'mods.challenges.helpPanel.mpRatingTitle': 'Rating & leaderboard', 'mods.challenges.helpPanel.mpRatingText': 'Matches use Elo rating (default 1000). Winning gains points, losing loses points; beating a higher-rated player gains more. The leaderboard sorts by rating, then matches played, then name. Your score in the battle (ticks + grade) decides who wins; the loser\'s score is 0.', 'mods.challenges.multiplayer.joinQueue': 'Join queue', 'mods.challenges.multiplayer.leaveQueue': 'Leave queue', 'mods.challenges.multiplayer.joinQueueHint': 'Click the button below to join the matchmaking queue. You will be paired with another player when one is available.', 'mods.challenges.multiplayer.waitingForOpponent': 'Waiting for an opponent…', 'mods.challenges.multiplayer.queueStatus': '{count} player(s) in queue · Waiting {time}', 'mods.challenges.multiplayer.joining': 'Joining…', 'mods.challenges.multiplayer.matchmaking': 'Matchmaking', 'mods.challenges.multiplayer.leaderboardTitle': 'Leaderboard', 'mods.challenges.multiplayer.leaderboardComingSoon': 'Rating system coming soon.', 'mods.challenges.multiplayer.alreadyInQueueElsewhere': 'You are already in the queue in another tab or device.', 'mods.challenges.multiplayer.underDevelopmentBanner': 'Multiplayer is under development and may be a little buggy.', 'mods.challenges.multiplayer.matchedWith': 'Matched with {name}!', 'mods.challenges.multiplayer.acceptMatch': 'Accept match', 'mods.challenges.multiplayer.joinMatch': 'Join match', 'mods.challenges.multiplayer.acceptMatchPrompt': 'Matched with {name}. Accept the match to proceed.', 'mods.challenges.multiplayer.waitingForAccept': 'Waiting for {name} to accept…', 'mods.challenges.multiplayer.matchAccepted': 'Match accepted! Ready to proceed.', 'mods.challenges.multiplayer.needPlayerName': 'Please log in so we can add you to the queue.', 'mods.challenges.multiplayer.queueError': 'Could not join queue. Please try again.', 'mods.challenges.multiplayer.acceptWithin': 'Accept within {n}s', 'mods.challenges.multiplayer.waitingForAcceptWithin': 'Waiting for {name} to accept within {n}s...', 'mods.challenges.multiplayer.acceptMatchPromptWithin': 'Matched with {name}. Accept within {n}s...', 'mods.challenges.multiplayer.matchExpired': 'Match expired.', 'mods.challenges.multiplayer.matchExpiredRequeued': "Match expired. You've been re-queued.", 'mods.challenges.multiplayer.winByForfeit': 'Win by forfeit!', 'mods.challenges.multiplayer.winByForfeitWithOpponent': '{name} has disconnected. Win by forfeit!', 'mods.challenges.multiplayer.queueWatchInviteLead': 'A player is in queue in challenges!', 'mods.challenges.multiplayer.queueWatchInviteJoin': 'Join', 'mods.challenges.multiplayer.queueWatchInviteTail': 'here!', 'mods.challenges.multiplayer.footerQueueCount': '{n} in queue' };
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
    if (el.closest && el.closest('[data-challenges-content]')) return true;
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

  // Helper: create framed box with title and body container (shared by placeholder box and matchmaking panel)
  function createChallengesFramedBox(titleText) {
    const box = document.createElement('div');
    box.style.cssText = CHALLENGES_FRAME_BOX_STYLE;
    const titleEl = document.createElement('h2');
    titleEl.className = 'widget-top widget-top-text pixel-font-16';
    titleEl.style.cssText = CHALLENGES_WIDGET_TITLE_STYLE;
    const titleP = document.createElement('p');
    titleP.style.cssText = 'margin: 0; padding: 0; text-align: center; color: ' + CHALLENGE_COLORS.TEXT + ';';
    titleP.textContent = titleText;
    titleEl.appendChild(titleP);
    box.appendChild(titleEl);
    const body = document.createElement('div');
    body.className = 'widget-bottom pixel-font-16';
    body.style.cssText = CHALLENGES_WIDGET_BODY_STYLE;
    box.appendChild(body);
    return { box: box, body: body };
  }
  function createPlaceholderBox(titleText, bodyHtml) {
    const framed = createChallengesFramedBox(titleText);
    framed.body.innerHTML = bodyHtml;
    return framed.box;
  }

  // Multiplayer queue UI and Firebase pairing (buttons live in header; this panel shows matchmaking title only)
  function createMultiplayerQueuePanel() {
    const framed = createChallengesFramedBox(t('mods.challenges.multiplayer.matchmaking'));
    const box = framed.box;
    const body = framed.body;
    var statusEl = { style: {}, textContent: '' };
    var joinBtn = { style: {}, textContent: '', disabled: false };
    var leaveBtn = { style: {} };
    var hintEl = document.createElement('p');
    hintEl.style.cssText = 'margin: 0; font-size: 14px; color: ' + (CHALLENGE_COLORS.SECONDARY || '#888') + ';';
    hintEl.textContent = t('mods.challenges.multiplayer.joinQueueHint');
    body.appendChild(hintEl);
    var matchmakingAcceptPanelBtn = document.createElement('button');
    matchmakingAcceptPanelBtn.type = 'button';
    matchmakingAcceptPanelBtn.className = 'challenges-btn';
    matchmakingAcceptPanelBtn.style.cssText = 'display: none; margin-top: 10px; align-self: flex-start;';
    matchmakingAcceptPanelBtn.textContent = t('mods.challenges.multiplayer.acceptMatch');
    body.appendChild(matchmakingAcceptPanelBtn);

    function formatWaitTime(ms) {
      var sec = Math.floor(ms / 1000);
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    var p = challengesMultiplayerPersisted;
    var state = { inQueue: p.inQueue, myKey: p.myKey, pollTimer: null, acceptPollTimer: null, matchedOpponent: p.matchedOpponent, joinedAt: p.joinedAt, queueCount: p.queueCount != null ? p.queueCount : 0, clientToken: p.clientToken, matchId: p.matchId, myAccepted: p.myAccepted, bothAccepted: p.bothAccepted, matchCreatedAt: p.matchCreatedAt != null ? p.matchCreatedAt : null };
    function stopAcceptPolling() {
      if (state.acceptPollTimer != null) {
        clearInterval(state.acceptPollTimer);
        state.acceptPollTimer = null;
        console.log('[Challenges MP]','acceptPoll: stopped');
      }
    }
    function requeueAfterAcceptTimeout() {
      var hadAccepted = state.myAccepted;
      var keys = getMatchPlayerKeys(state.matchId);
      var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + state.matchId;
      var queuePath = getMultiplayerQueuePath();
      var playerMatchPath = getMultiplayerPlayerMatchesPath();
      ChallengeFirebaseService.delete(matchPath).catch(function() {});
      if (keys.length >= 2) {
        ChallengeFirebaseService.delete(playerMatchPath + '/' + keys[0]).catch(function() {});
        ChallengeFirebaseService.delete(playerMatchPath + '/' + keys[1]).catch(function() {});
      }
      state.matchId = null;
      state.matchedOpponent = null;
      state.myAccepted = false;
      state.bothAccepted = false;
      state.matchCreatedAt = null;
      if (hadAccepted && state.myKey) {
        var name = (getCurrentPlayerName() || '').trim();
        if (name && name !== 'Unknown') {
          state.clientToken = state.clientToken || generateMultiplayerClientToken();
          state.inQueue = true;
          state.joinedAt = Date.now();
          state.queueCount = 0;
          var payload = { playerName: name, joinedAt: state.joinedAt, clientToken: state.clientToken };
          ChallengeFirebaseService.put(queuePath + '/' + state.myKey, payload).then(function() {
            stopAcceptPolling();
            syncMultiplayerStateToPersisted(state);
            updateUI();
            state.pollTimer = setInterval(pollQueue, CHALLENGE_MP_QUEUE_POLL_MS);
            startQueueUiTick();
            pollQueue();
            showChallengesMatchmakingToast((t('mods.challenges.multiplayer.matchExpiredRequeued') || 'Match expired. You\'ve been re-queued.'), { acceptLabel: t('mods.challenges.multiplayer.acceptMatch') });
          }).catch(function() {
            stopAcceptPolling();
            syncMultiplayerStateToPersisted(state);
            updateUI();
            statusEl.textContent = t('mods.challenges.multiplayer.queueError') || 'Queue error';
          });
          return;
        }
      }
      stopAcceptPolling();
      syncMultiplayerStateToPersisted(state);
      updateUI();
      if (hadAccepted) {
        showChallengesMatchmakingToast((t('mods.challenges.multiplayer.matchExpired') || 'Match expired.'), { acceptLabel: t('mods.challenges.multiplayer.acceptMatch') });
      }
    }
    function startAcceptPolling() {
      stopAcceptPolling();
      if (!state.matchId || !state.matchedOpponent) return;
      console.log('[Challenges MP]','acceptPoll: start matchId=', state.matchId);
      function acceptPollTick() {
        var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + state.matchId;
        ChallengeFirebaseService.get(matchPath, null).then(function(matchData) {
          var keys = getMatchPlayerKeys(state.matchId);
          if (keys.length < 2) return;
          if (!matchData) {
            if (state.matchId) {
              console.log('[Challenges MP]','acceptPoll: match gone (deleted or expired)');
              requeueAfterAcceptTimeout();
            }
            return;
          }
          if (state.matchCreatedAt == null) state.matchCreatedAt = typeof matchData.createdAt === 'number' ? matchData.createdAt : Date.now();
          updateUI();
          var elapsed = Date.now() - (state.matchCreatedAt != null ? state.matchCreatedAt : matchData.createdAt || 0);
          if (elapsed >= CHALLENGE_MP_ACCEPT_DEADLINE_MS) {
            var a1 = !!(matchData.acceptances && matchData.acceptances[keys[0]]);
            var a2 = !!(matchData.acceptances && matchData.acceptances[keys[1]]);
            if (!(a1 && a2)) {
              console.log('[Challenges MP]','acceptPoll: accept deadline passed, cleaning up and re-queuing accepter if any');
              requeueAfterAcceptTimeout();
              return;
            }
          }
          if (!matchData.acceptances) return;
          var k1 = keys[0];
          var k2 = keys[1];
          var a1 = !!matchData.acceptances[k1];
          var a2 = !!matchData.acceptances[k2];
          var both = a1 && a2;
          console.log('[Challenges MP]','acceptPoll: acceptances', { k1: a1, k2: a2, both: both });
          if (both) {
            state.bothAccepted = true;
            stopAcceptPolling();
            syncMultiplayerStateToPersisted(state);
            updateUI();
            console.log('[Challenges MP]','acceptPoll: both accepted, done');
            handleMultiplayerMatchReady(state.matchId, state.myKey);
          } else {
            updateUI();
          }
        });
      }
      acceptPollTick();
      state.acceptPollTimer = setInterval(acceptPollTick, CHALLENGE_MP_ACCEPT_POLL_MS);
    }
    function updateUI() {
      syncMultiplayerStateToPersisted(state);
      if (state.matchedOpponent) {
        leaveBtn.style.display = 'none';
        var acceptMessage;
        var showAcceptInToast = false;
        var createdAt = state.matchCreatedAt != null ? state.matchCreatedAt : 0;
        var acceptSecondsLeft = createdAt ? Math.max(0, Math.ceil((CHALLENGE_MP_ACCEPT_DEADLINE_MS - (Date.now() - createdAt)) / 1000)) : Math.ceil(CHALLENGE_MP_ACCEPT_DEADLINE_MS / 1000);
        if (state.bothAccepted) {
          statusEl.textContent = t('mods.challenges.multiplayer.matchAccepted');
          matchmakingAcceptPanelBtn.style.display = 'none';
          joinBtn.style.display = 'inline-block';
          joinBtn.textContent = t('mods.challenges.multiplayer.joinQueue');
          joinBtn.disabled = true;
          if (joinBtn.style) joinBtn.style.opacity = '0.5';
          acceptMessage = t('mods.challenges.multiplayer.matchAccepted');
        } else if (state.myAccepted) {
          joinBtn.style.display = 'none';
          statusEl.textContent = (t('mods.challenges.multiplayer.waitingForAcceptWithin') || 'Waiting for {name} to accept within {n}s...').replace('{name}', state.matchedOpponent).replace('{n}', String(acceptSecondsLeft));
          matchmakingAcceptPanelBtn.style.display = 'none';
          acceptMessage = statusEl.textContent;
        } else {
          joinBtn.style.display = 'none';
          statusEl.textContent = (t('mods.challenges.multiplayer.acceptMatchPromptWithin') || 'Matched with {name}. Accept within {n}s...').replace('{name}', state.matchedOpponent).replace('{n}', String(acceptSecondsLeft));
          matchmakingAcceptPanelBtn.style.display = 'inline-block';
          acceptMessage = statusEl.textContent;
          showAcceptInToast = true;
        }
        if (challengesPersistentToastHandle) {
          challengesPersistentToastHandle.updateMessage(acceptMessage);
          challengesPersistentToastHandle.setAcceptVisible(showAcceptInToast);
        } else {
          showChallengesMatchmakingToast(acceptMessage, { showAccept: showAcceptInToast, acceptLabel: t('mods.challenges.multiplayer.acceptMatch') });
        }
        if (typeof window !== 'undefined' && window.__challengesMultiplayerUpdateHeaderButton) window.__challengesMultiplayerUpdateHeaderButton();
        return;
      }
      if (state.inQueue) {
        matchmakingAcceptPanelBtn.style.display = 'none';
        var timeStr = state.joinedAt != null ? formatWaitTime(Date.now() - state.joinedAt) : '0:00';
        var count = state.queueCount != null ? state.queueCount : 0;
        var queueStatusText = t('mods.challenges.multiplayer.queueStatus').replace('{count}', String(count)).replace('{time}', timeStr);
        statusEl.textContent = queueStatusText;
        joinBtn.style.display = 'none';
        leaveBtn.style.display = 'inline-block';
        if (challengesPersistentToastHandle) {
          challengesPersistentToastHandle.updateMessage(queueStatusText);
        } else {
          showChallengesMatchmakingToast(queueStatusText, { acceptLabel: t('mods.challenges.multiplayer.acceptMatch') });
        }
      } else {
        matchmakingAcceptPanelBtn.style.display = 'none';
        removeChallengesPersistentToast();
        statusEl.textContent = t('mods.challenges.multiplayer.joinQueueHint');
        joinBtn.textContent = t('mods.challenges.multiplayer.joinQueue');
        joinBtn.disabled = false;
        joinBtn.style.display = 'inline-block';
        leaveBtn.style.display = 'none';
      }
      if (typeof window !== 'undefined' && window.__challengesMultiplayerUpdateHeaderButton) window.__challengesMultiplayerUpdateHeaderButton();
    }
    var queueUiTickTimer = null;
    function stopQueueUiTick() {
      if (queueUiTickTimer != null) {
        clearInterval(queueUiTickTimer);
        queueUiTickTimer = null;
      }
    }
    function startQueueUiTick() {
      stopQueueUiTick();
      if (!state.inQueue || state.matchedOpponent) return;
      queueUiTickTimer = setInterval(function() {
        if (!state.inQueue || state.matchedOpponent) {
          stopQueueUiTick();
          return;
        }
        updateUI();
      }, CHALLENGE_MP_QUEUE_UI_TICK_MS);
    }
    function stopPolling() {
      if (state.pollTimer != null) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
      stopQueueUiTick();
    }
    function pollQueue() {
      var queuePath = getMultiplayerQueuePath();
      var myKey = state.myKey;
      console.log('[Challenges MP]','poll: GET queue', queuePath);
      ChallengeFirebaseService.get(queuePath, {}).then(function(queueData) {
        if (!queueData || typeof queueData !== 'object') {
          console.log('[Challenges MP]','poll: queueData empty or invalid');
          // Still check playerMatches when in queue so we discover the match after the other player created it (queue may be empty now)
          if (myKey && state.inQueue) {
            state.queueCount = 0;
            syncMultiplayerStateToPersisted(state);
            updateUI();
            console.log('[Challenges MP]','poll: GET playerMatches (queue empty)', myKey);
            ChallengeFirebaseService.get(getMultiplayerPlayerMatchesPath() + '/' + myKey, null).then(function(myMatch) {
              console.log('[Challenges MP]','poll: playerMatches result', myMatch ? { matchId: myMatch.matchId, opponent: myMatch.opponent } : null);
              if (!myMatch || !myMatch.opponent) return;
              console.log('[Challenges MP]','poll: matched (non-creator) with', myMatch.opponent);
              setMatchedState(state, myMatch.opponent, myMatch.matchId);
              stopPolling();
              syncMultiplayerStateToPersisted(state);
              updateUI();
              startAcceptPolling();
            });
          }
          return;
        }
        console.log('[Challenges MP]','poll: queueData', JSON.stringify(queueData));
        if (myKey && state.inQueue && state.clientToken) {
          var myEntry = queueData[myKey];
          if (myEntry && myEntry.clientToken && myEntry.clientToken !== state.clientToken) {
            console.log('[Challenges MP]','poll: replaced by other tab — myKey', myKey, 'entryToken', myEntry.clientToken, 'myToken', state.clientToken);
            clearMultiplayerStateFields(state);
            stopPolling();
            stopAcceptPolling();
            syncMultiplayerStateToPersisted(state);
            statusEl.textContent = t('mods.challenges.multiplayer.alreadyInQueueElsewhere');
            updateUI();
            return;
          }
        }
        var entries = [];
        Object.keys(queueData).forEach(function(k) {
          var v = queueData[k];
          if (v && v.playerName != null && v.joinedAt != null) entries.push({ key: k, playerName: v.playerName, joinedAt: v.joinedAt });
        });
        entries.sort(function(a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
        console.log('[Challenges MP]','poll: entries', entries.length, entries);
        if (entries.length >= 2) {
          var a = entries[0];
          var b = entries[1];
          var matchId = [a.key, b.key].sort().join('_');
          var now = Date.now();
          var matchPayload = { player1: a.playerName, player2: b.playerName, player1Key: a.key, player2Key: b.key, createdAt: now, acceptances: {} };
          var base = CHALLENGE_MULTIPLAYER_BASE;
          var isCreator = (a.key === myKey || b.key === myKey);
          var creatorOpponent = (a.key === myKey ? b.playerName : a.playerName);
          console.log('[Challenges MP]','poll: creating match', matchId, matchPayload, 'isCreator=', isCreator);
          ChallengeFirebaseService.put(base + '/matches/' + matchId, matchPayload).then(function() {
            return Promise.all([
              ChallengeFirebaseService.put(base + '/playerMatches/' + a.key, { matchId: matchId, opponent: b.playerName, createdAt: now }),
              ChallengeFirebaseService.put(base + '/playerMatches/' + b.key, { matchId: matchId, opponent: a.playerName, createdAt: now })
            ]);
          }).then(function() {
            console.log('[Challenges MP]','poll: playerMatches written, deleting queue', a.key);
            return ChallengeFirebaseService.delete(queuePath + '/' + a.key);
          }).then(function() {
            console.log('[Challenges MP]','poll: queue delete', a.key, 'ok, deleting', b.key);
            return ChallengeFirebaseService.delete(queuePath + '/' + b.key);
          }).then(function() {
            console.log('[Challenges MP]','poll: queue deletes done, isCreator=', isCreator);
            if (isCreator) {
              console.log('[Challenges MP]','poll: matched as creator with', creatorOpponent);
              setMatchedState(state, creatorOpponent, matchId, now);
              stopPolling();
              syncMultiplayerStateToPersisted(state);
              updateUI();
              startAcceptPolling();
            }
          }).catch(function(err) {
            console.log('[Challenges MP]','poll: create match error', err);
            console.warn('[Challenges Mod] Create match error:', err);
          });
        }
        if (myKey && state.inQueue) {
          state.queueCount = entries.length;
          syncMultiplayerStateToPersisted(state);
          updateUI();
          console.log('[Challenges MP]','poll: GET playerMatches', myKey, 'entries.length=', entries.length);
          // Check playerMatches every poll so we discover the match even if queue GET is stale (replication delay)
          ChallengeFirebaseService.get(getMultiplayerPlayerMatchesPath() + '/' + myKey, null).then(function(myMatch) {
            console.log('[Challenges MP]','poll: playerMatches result', myMatch ? { matchId: myMatch.matchId, opponent: myMatch.opponent } : null);
            if (!myMatch || !myMatch.opponent) return;
            console.log('[Challenges MP]','poll: matched (non-creator) with', myMatch.opponent);
            setMatchedState(state, myMatch.opponent, myMatch.matchId);
            stopPolling();
            syncMultiplayerStateToPersisted(state);
            updateUI();
            startAcceptPolling();
          });
        }
      });
    }
    function leaveQueue() {
      if (!state.myKey) return;
      var key = state.myKey;
      console.log('[Challenges MP]','leaveQueue', key);
      clearMultiplayerStateFields(state);
      stopPolling();
      syncMultiplayerStateToPersisted(state);
      ChallengeFirebaseService.delete(getMultiplayerQueuePath() + '/' + key).catch(function(err) {
        console.log('[Challenges MP]','leaveQueue: DELETE error', err);
        console.warn('[Challenges Mod] Leave queue DELETE error:', err);
      });
      removeChallengesPersistentToast();
      stopAcceptPolling();
      syncMultiplayerStateToPersisted(state);
      updateUI();
    }
    function acceptMatch() {
      if (!state.matchId || !state.myKey || state.myAccepted) return;
      console.log('[Challenges MP]','acceptMatch: matchId=', state.matchId, 'myKey=', state.myKey);
      var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + state.matchId;
      ChallengeFirebaseService.get(matchPath, null).then(function(matchData) {
        var acceptances = (matchData && matchData.acceptances) ? Object.assign({}, matchData.acceptances) : {};
        acceptances[state.myKey] = true;
        console.log('[Challenges MP]','acceptMatch: PATCH acceptances', acceptances);
        return ChallengeFirebaseService.patch(matchPath, { acceptances: acceptances });
      }).then(function() {
        state.myAccepted = true;
        console.log('[Challenges MP]','acceptMatch: PATCH ok, myAccepted=true');
        syncMultiplayerStateToPersisted(state);
        updateUI();
        startAcceptPolling();
      }).catch(function(err) {
        console.log('[Challenges MP]','acceptMatch: error', err);
        console.warn('[Challenges Mod] Accept match error:', err);
      });
    }
    matchmakingAcceptPanelBtn.addEventListener('click', function() {
      acceptMatch();
    });
    function joinQueue() {
      var name = (getCurrentPlayerName() || '').trim();
      if (!name || name === 'Unknown') {
        statusEl.textContent = t('mods.challenges.multiplayer.needPlayerName');
        return;
      }
      joinBtn.disabled = true;
      joinBtn.textContent = t('mods.challenges.multiplayer.joining');
      var key = sanitizeFirebaseKeyForChallenges(name);
      var now = Date.now();
      state.clientToken = generateMultiplayerClientToken();
      state.myKey = key;
      state.inQueue = true;
      state.matchedOpponent = null;
      state.joinedAt = now;
      state.queueCount = 1;
      var queuePath = getMultiplayerQueuePath();
      var payload = { playerName: name, joinedAt: now, clientToken: state.clientToken };
      console.log('[Challenges MP]','joinQueue', name, 'key=', key, 'payload=', payload);
      ChallengeFirebaseService.put(queuePath + '/' + key, payload).then(function() {
        console.log('[Challenges MP]','joinQueue: PUT ok, starting poll');
        ensureMultiplayerRating(key, name);
        joinBtn.disabled = false;
        syncMultiplayerStateToPersisted(state);
        updateUI();
        state.pollTimer = setInterval(pollQueue, CHALLENGE_MP_QUEUE_POLL_MS);
        startQueueUiTick();
        pollQueue();
      }).catch(function(err) {
        console.log('[Challenges MP]','joinQueue: PUT error', err);
        console.warn('[Challenges Mod] Join queue error:', err);
        joinBtn.disabled = false;
        joinBtn.textContent = t('mods.challenges.multiplayer.joinQueue');
        clearMultiplayerStateFields(state);
        statusEl.textContent = t('mods.challenges.multiplayer.queueError');
        updateUI();
      });
    }

    if (typeof window !== 'undefined') {
      window.__challengesMultiplayerDoLeave = leaveQueue;
      window.__challengesMultiplayerDoAccept = acceptMatch;
      window.__challengesMultiplayerDoJoin = joinQueue;
      window.__challengesMultiplayerDispatch = function() {
        if (state.bothAccepted && state.matchId) return;
        if (state.matchedOpponent && !state.bothAccepted) return;
        else if (state.inQueue) leaveQueue();
        else joinQueue();
      };
    }
    box.appendChild(body);
    updateUI();
    if (state.inQueue && state.myKey) {
      console.log('[Challenges MP]','panel open: restoring inQueue, myKey=', state.myKey, 'starting poll');
      state.pollTimer = setInterval(pollQueue, CHALLENGE_MP_QUEUE_POLL_MS);
      startQueueUiTick();
      pollQueue();
    } else if (state.matchedOpponent && state.matchId && !state.bothAccepted) {
      console.log('[Challenges MP]','panel open: restoring matched state, starting acceptPoll');
      startAcceptPolling();
    } else {
      console.log('[Challenges MP]','panel open: state', { inQueue: state.inQueue, myKey: state.myKey, matchedOpponent: state.matchedOpponent, matchId: state.matchId, bothAccepted: state.bothAccepted });
    }
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

  // Content area holds the three tab panels (data attribute so clicks inside are allowed)
  const contentArea = document.createElement('div');
  contentArea.setAttribute('data-challenges-content', 'true');
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

  // Multiplayer panel: two boxes — left: matchmaking queue, right: leaderboard/rating placeholder
  const multiplayerPanel = document.createElement('div');
  Object.assign(multiplayerPanel.style, {
    display: 'none',
    flex: '1 1 0',
    minHeight: '0',
    height: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px'
  });
  const multiplayerRow = document.createElement('div');
  Object.assign(multiplayerRow.style, {
    flex: '1 1 0',
    minHeight: '0',
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    overflow: 'hidden'
  });
  const leftColumn = document.createElement('div');
  leftColumn.style.cssText = 'display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; min-width: 0; gap: 8px;';
  const leftColumnContent = document.createElement('div');
  leftColumnContent.style.cssText = 'display: flex; flex-direction: row; flex: 1 1 0; min-height: 0; min-width: 0; gap: 8px;';
  leftColumn.appendChild(leftColumnContent);

  // Left sub-column: Map, Creatures, Summary (same structure as Solo, placeholder until match map is chosen)
  const mpLeftSubCol = document.createElement('div');
  Object.assign(mpLeftSubCol.style, {
    flex: '1 1 0',
    minWidth: '0',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    minHeight: '0'
  });
  const mpMapBox = createPlaceholderBox(t('mods.challenges.maps'), '');
  const mpMapBody = mpMapBox.querySelector('.widget-bottom');
  mpMapBody.innerHTML = '';
  mpMapBody.style.display = 'flex';
  mpMapBody.style.flexDirection = 'column';
  mpMapBody.style.alignItems = 'center';
  mpMapBody.style.gap = '6px';
  var mpMapThumb = document.createElement('div');
  mpMapThumb.style.cssText = 'width: 128px; height: 128px; background: rgba(68,68,68,0.5); border: 1px solid #555; border-radius: 4px; display: flex; align-items: center; justify-content: center;';
  var mpMapThumbImg = document.createElement('img');
  mpMapThumbImg.src = 'https://bestiaryarena.com/assets/icons/minotaurstatue.png';
  mpMapThumbImg.alt = '';
  mpMapThumbImg.className = 'pixelated';
  mpMapThumbImg.style.cssText = 'width: 80px; height: 80px; object-fit: contain; opacity: 0.7;';
  mpMapThumb.appendChild(mpMapThumbImg);
  mpMapBody.appendChild(mpMapThumb);
  var mpMapName = document.createElement('p');
  mpMapName.style.cssText = 'margin: 0; text-align: center; font-size: 14px; color: #888;';
  mpMapName.textContent = '—';
  mpMapName.setAttribute('data-mp-map-name', '1');
  mpMapBody.appendChild(mpMapName);
  Object.assign(mpMapBox.style, { flex: '1 1 0', minHeight: '0', minWidth: '0' });
  mpLeftSubCol.appendChild(mpMapBox);

  const mpCreaturesBox = createPlaceholderBox(t('mods.challenges.creatures'), '');
  const mpCreaturesBody = mpCreaturesBox.querySelector('.widget-bottom');
  mpCreaturesBody.innerHTML = '';
  var mpCreaturesText = document.createElement('p');
  mpCreaturesText.style.cssText = 'margin: 0; font-size: 14px; color: #888;';
  mpCreaturesText.textContent = '—';
  mpCreaturesText.setAttribute('data-mp-creatures', '1');
  mpCreaturesBody.appendChild(mpCreaturesText);
  Object.assign(mpCreaturesBox.style, { flex: '1 1 0', minHeight: '0', minWidth: '0' });
  mpLeftSubCol.appendChild(mpCreaturesBox);

  const mpSummaryBox = createPlaceholderBox(t('mods.challenges.summary'), '');
  const mpSummaryBody = mpSummaryBox.querySelector('.widget-bottom');
  mpSummaryBody.innerHTML = '';
  var mpSummaryMap = document.createElement('p');
  mpSummaryMap.style.margin = '0 0 4px 0';
  mpSummaryMap.appendChild(document.createTextNode(t('mods.challenges.mapLabel') + ' —'));
  mpSummaryMap.setAttribute('data-mp-summary-map', '1');
  var mpSummaryCreatures = document.createElement('p');
  mpSummaryCreatures.style.margin = '0 0 4px 0';
  mpSummaryCreatures.appendChild(document.createTextNode(t('mods.challenges.creaturesLabel') + ' —'));
  var mpSummaryDiff = document.createElement('p');
  mpSummaryDiff.style.margin = '0 0 4px 0';
  mpSummaryDiff.title = t('mods.challenges.alliesVsEnemiesTitle');
  mpSummaryDiff.appendChild(document.createTextNode(t('mods.challenges.difficultyLabel')));
  var mpSummaryDiffVal = document.createElement('span');
  mpSummaryDiffVal.textContent = '— (— v —)';
  mpSummaryDiff.appendChild(mpSummaryDiffVal);
  var mpSummaryScore = document.createElement('p');
  mpSummaryScore.style.margin = '0';
  mpSummaryScore.title = t('mods.challenges.expectedScoreTitle');
  mpSummaryScore.appendChild(document.createTextNode(t('mods.challenges.expectedScoreLabel')));
  var mpSummaryScoreVal = document.createElement('span');
  mpSummaryScoreVal.textContent = '—';
  mpSummaryScore.appendChild(mpSummaryScoreVal);
  mpSummaryBody.appendChild(mpSummaryMap);
  mpSummaryBody.appendChild(mpSummaryCreatures);
  mpSummaryBody.appendChild(mpSummaryDiff);
  mpSummaryBody.appendChild(mpSummaryScore);
  Object.assign(mpSummaryBox.style, { flex: '1 1 0', minHeight: '0', minWidth: '0' });
  mpLeftSubCol.appendChild(mpSummaryBox);

  if (typeof window !== 'undefined') {
    window.__challengesMpSetRollResult = function(roomId, roomName, villainSpecs, diff, expectedScore) {
      var thumbUrl = '/assets/room-thumbnails/' + (roomId || '') + '.png';
      mpMapThumbImg.src = thumbUrl;
      mpMapThumbImg.alt = roomName || '';
      mpMapName.textContent = roomName || roomId || '—';
      // Grey creature names line removed in multiplayer tab; keep placeholder when no creatures
      mpCreaturesText.textContent = (villainSpecs && villainSpecs.length) ? '' : ((villainSpecs && villainSpecs.length) ? villainSpecs.length + ' creatures' : '—');
      mpSummaryMap.textContent = t('mods.challenges.mapLabel') + ' ' + (roomName || roomId || '—');
      mpSummaryCreatures.textContent = t('mods.challenges.creaturesLabel') + ' ' + (villainSpecs && villainSpecs.length ? villainSpecs.length : '—');
      var multStr = (diff && typeof diff.difficulty === 'number') ? getDifficultyMultiplier(diff.difficulty).toFixed(2) : '—';
      var allies = (diff && diff.alliesAllowed != null) ? diff.alliesAllowed : '—';
      var nV = (villainSpecs && villainSpecs.length) ? villainSpecs.length : 0;
      mpSummaryDiffVal.textContent = multStr + '× (' + allies + ' v ' + nV + ')';
      mpSummaryScoreVal.textContent = expectedScore != null ? '~' + expectedScore : '—';
    };
  }

  leftColumnContent.appendChild(mpLeftSubCol);
  createMultiplayerQueuePanel();
  const mpLeaderboardFramed = createChallengesFramedBox(t('mods.challenges.multiplayer.leaderboardTitle'));
  const mpLeaderboardBox = mpLeaderboardFramed.box;
  const mpLeaderboardBody = mpLeaderboardFramed.body;
  mpLeaderboardBody.style.overflowY = 'auto';
  mpLeaderboardBody.style.minHeight = '0';
  mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loading') + '</p>';
  function buildMultiplayerRatingTable(entries) {
    var currentName = (getCurrentPlayerName() || '').trim();
    var table = document.createElement('div');
    table.style.cssText = 'display:table; width:100%; font-size:12px; border-collapse:collapse;';
    var thead = document.createElement('div');
    thead.style.cssText = 'display:table-row; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + ';';
    ['#', 'Name', 'Matches', 'Rating'].forEach(function(label) {
      var th = document.createElement('div');
      th.style.cssText = 'display:table-cell; padding:4px 6px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + ';';
      th.textContent = label;
      thead.appendChild(th);
    });
    table.appendChild(thead);
    entries.forEach(function(row, index) {
      var tr = document.createElement('div');
      tr.style.cssText = 'display:table-row; color:' + CHALLENGE_COLORS.SECONDARY + ';';
      var rankCell = document.createElement('div');
      rankCell.style.cssText = 'display:table-cell; padding:4px 6px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + ';';
      rankCell.textContent = index + 1;
      tr.appendChild(rankCell);
      var nameCell = document.createElement('div');
      nameCell.style.cssText = 'display:table-cell; padding:4px 6px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + '; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
      nameCell.textContent = row.name || row.key || '—';
      tr.appendChild(nameCell);
      var matchesCell = document.createElement('div');
      matchesCell.style.cssText = 'display:table-cell; padding:4px 6px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + ';';
      matchesCell.textContent = row.matches != null ? row.matches : '0';
      tr.appendChild(matchesCell);
      var ratingCell = document.createElement('div');
      ratingCell.style.cssText = 'display:table-cell; padding:4px 6px; border-bottom:1px solid ' + CHALLENGE_COLORS.BORDER + ';';
      ratingCell.textContent = row.rating != null ? row.rating : '—';
      tr.appendChild(ratingCell);
      if (currentName && (row.name || row.key || '').trim() === currentName) {
        [rankCell, nameCell, matchesCell, ratingCell].forEach(function(c) {
          c.style.backgroundImage = 'url(' + (typeof CHALLENGE_BLUE_BG_URL !== 'undefined' ? CHALLENGE_BLUE_BG_URL : 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') + ')';
          c.style.backgroundSize = 'cover';
          c.style.backgroundPosition = 'center';
          c.style.color = CHALLENGE_COLORS.TEXT;
        });
      }
      table.appendChild(tr);
    });
    return table;
  }
  function refreshMultiplayerLeaderboard() {
    mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loading') + '</p>';
    loadMultiplayerRatingLeaderboard().then(function(entries) {
      mpLeaderboardBody.innerHTML = '';
      if (!entries || entries.length === 0) {
        mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + (t('mods.challenges.multiplayer.noPlayersYet') || 'No players yet. Complete a match to appear here.') + '</p>';
        return;
      }
      mpLeaderboardBody.appendChild(buildMultiplayerRatingTable(entries));
    }).catch(function() {
      mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + (t('mods.challenges.loadingError') || 'Could not load leaderboard.') + '</p>';
    });
  }
  refreshMultiplayerLeaderboard();
  if (typeof window !== 'undefined') window.__challengesRefreshMultiplayerLeaderboard = refreshMultiplayerLeaderboard;
  Object.assign(mpLeaderboardBox.style, { flex: '1 1 0', minHeight: '0', minWidth: '0' });
  multiplayerRow.appendChild(leftColumn);
  multiplayerRow.appendChild(mpLeaderboardBox);
  multiplayerPanel.appendChild(multiplayerRow);

  // Help panel: two columns (Solo left, Multiplayer right)
  const pointsPanel = document.createElement('div');
  Object.assign(pointsPanel.style, {
    display: 'none',
    flex: '1 1 0',
    minHeight: '0',
    overflow: 'hidden',
    flexDirection: 'row',
    padding: '8px',
    gap: '12px'
  });
  var hp = 'mods.challenges.helpPanel.';
  var soloBodyHtml = [
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
  var mpBodyHtml = [
    '<p style="margin:0 0 12px 0; color:' + CHALLENGE_COLORS.PRIMARY + '; font-weight:bold;">' + t(hp + 'mpHowToPlayTitle') + '</p>',
    '<p style="margin:0 0 16px 0;">' + t(hp + 'mpHowToPlayText') + '</p>',
    '<p style="margin:0 0 12px 0; color:' + CHALLENGE_COLORS.PRIMARY + '; font-weight:bold;">' + t(hp + 'mpRatingTitle') + '</p>',
    '<p style="margin:0 0 0 0;">' + t(hp + 'mpRatingText') + '</p>'
  ].join('');
  var soloHelpBox = createPlaceholderBox(t(hp + 'soloTitle'), soloBodyHtml);
  var mpHelpBox = createPlaceholderBox(t(hp + 'mpTitle'), mpBodyHtml);
  Object.assign(soloHelpBox.style, { flex: '1 1 0', minWidth: '0', minHeight: '0', overflow: 'auto' });
  Object.assign(mpHelpBox.style, { flex: '1 1 0', minWidth: '0', minHeight: '0', overflow: 'auto' });
  pointsPanel.appendChild(soloHelpBox);
  pointsPanel.appendChild(mpHelpBox);

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
    if (idx === 1 && typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
    var onSolo = (idx === 0);
    var onMultiplayer = (idx === 1);
    var randomizeBtn = getChallengesRollButton();
    var startBtn = getChallengesStartButton();
    if (randomizeBtn) {
      if (onSolo) {
        randomizeBtn.textContent = t('mods.challenges.randomize');
        randomizeBtn.disabled = false;
        randomizeBtn.style.opacity = '';
        randomizeBtn.style.pointerEvents = '';
        randomizeBtn.style.cursor = '';
      } else if (onMultiplayer) {
        if (window.__challengesMultiplayerUpdateHeaderButton) window.__challengesMultiplayerUpdateHeaderButton();
      } else {
        randomizeBtn.disabled = true;
        randomizeBtn.style.opacity = '0.5';
        randomizeBtn.style.pointerEvents = 'none';
        randomizeBtn.style.cursor = 'not-allowed';
      }
    }
    if (startBtn) {
      if (onMultiplayer) {
        startBtn.style.display = 'none';
      } else {
        startBtn.style.display = '';
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
    var footerQueueEl = document.querySelector('[data-challenges-footer-queue-count]');
    if (footerQueueEl) footerQueueEl.style.display = (idx === 1) ? '' : 'none';
  }
  if (typeof window !== 'undefined') window.__challengesSetActiveTab = setActiveTab;
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

  /** Spin map reel into given img and name elements (for multiplayer panel). Returns Promise. */
  function spinMapReelToElements(allRooms, finalRoomId, finalRoomName, durationMs, imgEl, nameEl) {
    if (!imgEl || !nameEl) return Promise.resolve();
    if (!allRooms.length) {
      imgEl.src = getRoomThumbnailUrl(finalRoomId);
      imgEl.alt = finalRoomName || '';
      nameEl.textContent = finalRoomName || finalRoomId || '—';
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      var interval = setInterval(function() {
        var r = allRooms[Math.floor(Math.random() * allRooms.length)];
        imgEl.src = getRoomThumbnailUrl(r.roomId);
        imgEl.alt = r.roomName || '';
        nameEl.textContent = r.roomName || r.roomId || '—';
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        imgEl.src = getRoomThumbnailUrl(finalRoomId);
        imgEl.alt = finalRoomName || '';
        nameEl.textContent = finalRoomName || finalRoomId || '—';
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
      startBtn.style.display = (challengesActiveTabIndex === 1) ? 'none' : '';
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.pointerEvents = 'none';
      startBtn.style.cursor = 'not-allowed';
      return;
    }
    startBtn.style.display = '';
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

  /** Run the same map + creature reel animation as Randomize, but land on predetermined roomId, roomName, specs. Calls onDone() when finished. */
  function runPredeterminedRoll(roomId, roomName, specs, onDone) {
    if (!specs || !Array.isArray(specs)) specs = [];
    rollState.isRolling = true;
    rollState.skipRequested = false;
    var rollBtn = getChallengesRollButton();
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
    var allRooms = getAllRoomsForReel();
    var creatureIds = getAllCreatureGameIds();
    function runCreatureSequence(index) {
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
          if (typeof onDone === 'function') onDone();
        });
      }
      return spinCreatureReel(creatureIds, specs[index], creaturesListEl, ROLL_SLOT_DELAY_MS)
        .then(function(card) { return spinEquipmentReel(card, specs[index], ROLL_SLOT_DELAY_MS); })
        .then(function() { return runCreatureSequence(index + 1); });
    }
    spinMapReel(allRooms, roomId, roomName || roomId, ROLL_SLOT_DELAY_MS).then(function() {
      creaturesListEl.textContent = '';
      creaturesListEl.style.textAlign = '';
      if (specs.length === 0) {
        summaryMapEl.textContent = t('mods.challenges.mapLabel') + ' ' + roomName;
        summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
        summaryDifficultyValueSpan.textContent = '— (— v —)';
        summaryExpectedScoreValueSpan.textContent = '—';
        finishRollState();
        if (typeof onDone === 'function') onDone();
        return;
      }
      runCreatureSequence(0);
    });
  }

  if (typeof window !== 'undefined') window.__challengesRunPredeterminedRoll = runPredeterminedRoll;

  /** Run predetermined roll animation inside the Multiplayer panel (map + creature reels). Calls onDone() when finished. */
  function runMultiplayerPredeterminedRoll(roomId, roomName, specs, onDone) {
    if (!specs || !Array.isArray(specs)) specs = [];
    var allRooms = getAllRoomsForReel();
    var creatureIds = getAllCreatureGameIds();
    mpMapName.textContent = t('mods.challenges.rolling');
    mpCreaturesBody.innerHTML = '';
    var rollingP = document.createElement('p');
    rollingP.style.cssText = 'margin: 0; font-size: 14px; color: #888; text-align: center;';
    rollingP.textContent = t('mods.challenges.rolling');
    mpCreaturesBody.appendChild(rollingP);
    var mpCreaturesListEl = document.createElement('div');
    mpCreaturesListEl.style.cssText = 'margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;';
    function runCreatureSequence(index) {
      if (index >= specs.length) {
        mpSummaryMap.textContent = t('mods.challenges.mapLabel') + ' ' + roomName;
        mpSummaryCreatures.textContent = t('mods.challenges.creaturesLabel') + ' ' + specs.length;
        var diff = computeChallengeDifficulty(specs);
        var mult = getDifficultyMultiplier(diff.difficulty);
        var enemyCount = specs.length;
        mpSummaryDiffVal.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
        mpSummaryScoreVal.textContent = '~' + (Math.round(computeChallengeScore(500, diff.difficulty, 'A') / 100) * 100);
        if (typeof onDone === 'function') onDone();
        return Promise.resolve();
      }
      return spinCreatureReel(creatureIds, specs[index], mpCreaturesListEl, ROLL_SLOT_DELAY_MS)
        .then(function(card) { return spinEquipmentReel(card, specs[index], ROLL_SLOT_DELAY_MS); })
        .then(function() { return runCreatureSequence(index + 1); });
    }
    spinMapReelToElements(allRooms, roomId, roomName || roomId, ROLL_SLOT_DELAY_MS, mpMapThumbImg, mpMapName).then(function() {
      mpCreaturesBody.innerHTML = '';
      mpCreaturesBody.appendChild(mpCreaturesListEl);
      if (specs.length === 0) {
        var namesP = document.createElement('p');
        namesP.style.cssText = 'margin: 0; font-size: 14px; color: #888;';
        namesP.textContent = '—';
        mpCreaturesBody.appendChild(namesP);
        mpSummaryMap.textContent = t('mods.challenges.mapLabel') + ' ' + roomName;
        mpSummaryCreatures.textContent = t('mods.challenges.creaturesLabel') + ' —';
        mpSummaryDiffVal.textContent = '— (— v —)';
        mpSummaryScoreVal.textContent = '—';
        if (typeof onDone === 'function') onDone();
        return;
      }
      runCreatureSequence(0);
    });
  }

  if (typeof window !== 'undefined') window.__challengesRunMultiplayerRoll = runMultiplayerPredeterminedRoll;

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
      { text: t('mods.challenges.randomize'), primary: false, onClick: function(e, modalObj) {
        if (challengesActiveTabIndex === 1 && typeof window !== 'undefined' && window.__challengesMultiplayerDispatch) {
          window.__challengesMultiplayerDispatch();
        } else {
          rollMapAndCreaturesHandler(e, modalObj);
        }
      }, closeOnClick: false },
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
  var CHALLENGE_RED_BG = 'https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png';
  setTimeout(function() {
    var dialog = document.querySelector('div[role="dialog"][data-state="open"]') || document.querySelector('div[role="dialog"]');
    if (!dialog) return;
    dialog.setAttribute('data-challenges-dialog', '1');
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
      var queueCountEl = document.createElement('span');
      queueCountEl.setAttribute('data-challenges-footer-queue-count', '1');
      queueCountEl.style.cssText = 'margin-right: auto; align-self: center; font-size: 12px; color: ' + ((CHALLENGE_COLORS && CHALLENGE_COLORS.SECONDARY) || '#888') + '; display: none;';
      queueCountEl.textContent = (t('mods.challenges.multiplayer.footerQueueCount') || '{n} in queue').replace('{n}', '—');
      footer.insertBefore(queueCountEl, footer.firstChild);
      function updateFooterQueueCount() {
        if (!queueCountEl.parentNode) {
          if (window.__challengesFooterQueueIntervalId) {
            clearInterval(window.__challengesFooterQueueIntervalId);
            window.__challengesFooterQueueIntervalId = null;
          }
          return;
        }
        ChallengeFirebaseService.get(getMultiplayerQueuePath(), {}).then(function(queueData) {
          if (!queueCountEl.parentNode) return;
          var n = (queueData && typeof queueData === 'object') ? Object.keys(queueData).length : 0;
          queueCountEl.textContent = (t('mods.challenges.multiplayer.footerQueueCount') || '{n} in queue').replace('{n}', String(n));
        }).catch(function() {
          if (queueCountEl.parentNode) queueCountEl.textContent = (t('mods.challenges.multiplayer.footerQueueCount') || '{n} in queue').replace('{n}', '—');
        });
      }
      updateFooterQueueCount();
      if (window.__challengesFooterQueueIntervalId) clearInterval(window.__challengesFooterQueueIntervalId);
      window.__challengesFooterQueueIntervalId = setInterval(updateFooterQueueCount, 5000);
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
    if (typeof window !== 'undefined') {
      window.__challengesMultiplayerUpdateHeaderButton = function() {
        var btn = getChallengesRollButton();
        if (!btn) return;
        var textColor = (CHALLENGE_COLORS && CHALLENGE_COLORS.TEXT) ? CHALLENGE_COLORS.TEXT : '#fff';
        if (challengesActiveTabIndex !== 1) {
          btn.textContent = t('mods.challenges.randomize');
          btn.style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG + ')';
          btn.style.backgroundSize = 'cover';
          btn.style.backgroundPosition = 'center';
          btn.style.color = textColor;
          return;
        }
        var p = challengesMultiplayerPersisted;
        if (p.bothAccepted && p.matchId) {
          btn.textContent = t('mods.challenges.multiplayer.joinQueue');
          btn.style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG + ')';
          btn.style.opacity = '0.5';
          btn.disabled = true;
          btn.style.cursor = 'not-allowed';
          btn.style.pointerEvents = 'none';
          btn.style.color = textColor;
        } else if (p.matchedOpponent && !p.bothAccepted) {
          btn.textContent = t('mods.challenges.multiplayer.joinMatch');
          btn.style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG + ')';
          btn.style.opacity = '0.45';
          btn.disabled = true;
          btn.style.cursor = 'not-allowed';
          btn.style.pointerEvents = 'none';
          btn.style.color = '#888888';
        } else if (p.inQueue) {
          btn.textContent = t('mods.challenges.multiplayer.leaveQueue');
          btn.style.backgroundImage = 'url(' + CHALLENGE_RED_BG + ')';
          btn.style.opacity = '';
          btn.disabled = false;
          btn.style.cursor = '';
          btn.style.pointerEvents = '';
          btn.style.color = textColor;
        } else {
          btn.textContent = t('mods.challenges.multiplayer.joinQueue');
          btn.style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG + ')';
          btn.style.opacity = '';
          btn.disabled = false;
          btn.style.cursor = '';
          btn.style.pointerEvents = '';
          btn.style.color = textColor;
        }
        btn.style.backgroundSize = 'cover';
        btn.style.backgroundPosition = 'center';
      };
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

/** Compute challenge score from gameData (victory). Used by onVictory and victoryContent. */
function computeVictoryScoreFromGameData(gameData, allyLimit, difficulty) {
  var ticks = (gameData && typeof gameData.ticks === 'number') ? gameData.ticks : 0;
  var currentTeamSize = (gameData && typeof gameData.currentTeamSize === 'number') ? gameData.currentTeamSize : allyLimit;
  var creaturesAlive = (gameData && typeof gameData.creaturesAlive === 'number') ? gameData.creaturesAlive : getCreaturesAliveFromBoardState();
  if (typeof creaturesAlive !== 'number' || creaturesAlive < 0) creaturesAlive = currentTeamSize;
  var grade = computeChallengeGrade(allyLimit, currentTeamSize, creaturesAlive);
  return { score: computeChallengeScore(ticks, difficulty, grade), grade: grade, ticks: ticks };
}

/** Compute multiplayer score from current board state (time-up path). Returns 0 if defeat, else computed score. */
function computeMultiplayerScoreFromBoardState(alliesAllowed, difficulty) {
  var creaturesAlive = getCreaturesAliveFromBoardState();
  if (typeof creaturesAlive !== 'number' || creaturesAlive < 0) creaturesAlive = 0;
  if (creaturesAlive <= 0) return 0;
  var grade = computeChallengeGrade(alliesAllowed, alliesAllowed, creaturesAlive);
  return computeChallengeScore(180, difficulty, grade); // 3 min = 180 ticks
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

/** Pick random creature specs for a room (for multiplayer sync: chooser calls this and writes to Firebase). Returns array of { gameId, tileIndex, level, genes, equip }. */
function pickRandomCreatureSpecsForRoom(roomId) {
  var creatureIds = getAllCreatureGameIds();
  if (!creatureIds || !creatureIds.length) return [];
  var walkable = getWalkableTileIndicesForRoom(roomId);
  var walkableCount = (walkable && walkable.length) ? walkable.length : 0;
  var maxAttempts = 50;
  var attempt = 0;
  var specs;
  do {
    attempt++;
    var count = Math.min(CHALLENGE_MAX_VILLAINS, Math.max(1, Math.floor(Math.random() * CHALLENGE_MAX_VILLAINS) + 1));
    var gameIds = [];
    for (var g = 0; g < count; g++) {
      gameIds.push(creatureIds[Math.floor(Math.random() * creatureIds.length)]);
    }
    specs = gameIds.map(function(gameId) {
      return {
        gameId: gameId,
        level: getRandomInt(CHALLENGE_LEVEL_MIN, CHALLENGE_LEVEL_MAX),
        genes: rollRandomGenes(),
        equip: rollRandomEquip()
      };
    });
    var diff = computeChallengeDifficulty(specs);
    if (walkableCount <= 0) break;
    var villainsToPlace = Math.min(specs.length, walkableCount);
    if (villainsToPlace + diff.alliesAllowed <= walkableCount) break;
  } while (attempt < maxAttempts);
  if (!specs || !specs.length) return [];
  var tiles;
  if (walkable && walkable.length > 0) {
    var n = Math.min(specs.length, walkable.length);
    tiles = pickRandomFromArray(walkable, n);
    specs = specs.slice(0, n);
  } else {
    tiles = pickRandomTiles(specs.length, CHALLENGE_TILE_INDEX_MAX);
  }
  for (var i = 0; i < specs.length; i++) {
    specs[i].tileIndex = tiles[i];
  }
  return specs;
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
        var result = computeVictoryScoreFromGameData(gameData, allyLimit, difficulty);
        var score = result.score;
        var ticks = result.ticks;
        var grade = result.grade;
        console.log('[Challenges Mod] grade (onVictory):', { maxTeamSize: allyLimit, grade });
        // Multiplayer: submit victory score; live toast stays until match over (poll handles result)
        if (challengeMultiplayerContext && challengeMultiplayerContext.matchId && challengeMultiplayerContext.myKey) {
          if (challengeMultiplayerTimerId != null) {
            clearTimeout(challengeMultiplayerTimerId);
            challengeMultiplayerTimerId = null;
          }
          onMultiplayerTimeLimitReached(score);
        }
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
        var result = computeVictoryScoreFromGameData(gameData, allyLimit, difficulty);
        var score = result.score;
        var ticks = result.ticks;
        var grade = result.grade;
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
        // Defeat: grade F, 0 rank points — do not save to leaderboard (score 0 does not count to personal/global).
        // In multiplayer, submit score 0 now (loser always gets 0); live toast stays until match over.
        if (challengeMultiplayerContext && challengeMultiplayerContext.matchId && challengeMultiplayerContext.myKey) {
          if (challengeMultiplayerTimerId != null) {
            clearTimeout(challengeMultiplayerTimerId);
            challengeMultiplayerTimerId = null;
          }
          onMultiplayerTimeLimitReached(0);
        }
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

// Unified toast: one container, transient (duration) or persistent (message + optional Accept/Close).
var CHALLENGE_TOAST_DURATION = 5000;
var CHALLENGE_TOAST_CONTAINER_ID = 'challenges-toast-container';
var challengesPersistentToastHandle = null;

function getChallengesToastContainer() {
  if (typeof document === 'undefined') return null;
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
  if (!container) return;
  var toasts = container.querySelectorAll('.challenges-toast-item');
  toasts.forEach(function(toast, index) {
    var offset = index * 46;
    toast.style.transform = 'translateY(-' + offset + 'px)';
  });
}

/**
 * Show a toast. Options: duration (transient, ms — e.g. CHALLENGE_QUEUE_WATCH_TOAST_MS = 10s); or persistent with showAccept?, acceptLabel?, onClose?.
 * Transient toasts auto-remove after `duration` milliseconds via setTimeout.
 * Returns a handle for persistent toasts: { updateMessage, setAcceptVisible?, remove }.
 */
function showChallengesToast(message, options) {
  options = options || {};
  var safeMsg = (message != null && message !== '') ? String(message).replace(/</g, '&lt;') : '';
  try {
    var container = getChallengesToastContainer();
    if (!container) return null;
    var isTransient = typeof options.duration === 'number' && options.duration > 0;
    var useJoinLink = options.withJoinLink === true;
    if (!isTransient) removeChallengesPersistentToast();
    var existingToasts = container.querySelectorAll('.challenges-toast-item');
    var stackOffset = existingToasts.length * 46;
    var flexContainer = document.createElement('div');
    flexContainer.className = 'challenges-toast-item';
    flexContainer.style.cssText = 'left: 0px; right: 0px; display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-' + stackOffset + 'px); bottom: 0px; justify-content: flex-end;' + ((!isTransient || useJoinLink) ? ' pointer-events: auto;' : '');
    var toast = document.createElement((isTransient && !useJoinLink) ? 'button' : 'div');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    if (!isTransient) toast.setAttribute('role', 'presentation');
    if (useJoinLink) {
      toast.style.pointerEvents = 'auto';
      toast.style.cursor = 'default';
    }
    var widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';
    var widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
    var messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    if (useJoinLink) {
      messageDiv.style.display = 'inline-flex';
      messageDiv.style.flexWrap = 'wrap';
      messageDiv.style.alignItems = 'baseline';
      messageDiv.style.gap = '0.35em';
      messageDiv.style.rowGap = '0.25em';
      var lead = document.createElement('span');
      lead.textContent = challengesModTranslate('mods.challenges.multiplayer.queueWatchInviteLead', 'A player is in queue in challenges!');
      var joinLinkBtn = document.createElement('button');
      joinLinkBtn.type = 'button';
      joinLinkBtn.setAttribute('data-challenges-queue-watch-join', '1');
      joinLinkBtn.setAttribute('aria-label', 'Join challenges queue');
      joinLinkBtn.textContent = challengesModTranslate('mods.challenges.multiplayer.queueWatchInviteJoin', 'Join');
      joinLinkBtn.style.cssText = 'flex-shrink: 0; padding: 0 0.2em; margin: 0; font-size: inherit; line-height: inherit; color: #ffe066; text-decoration: underline; background: transparent; border: none; cursor: pointer; pointer-events: auto; font-family: inherit; letter-spacing: 0.06em;';
      joinLinkBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openChallengesModalMultiplayerAndJoinQueue();
      });
      var tail = document.createElement('span');
      tail.textContent = challengesModTranslate('mods.challenges.multiplayer.queueWatchInviteTail', 'here!');
      messageDiv.appendChild(lead);
      messageDiv.appendChild(joinLinkBtn);
      messageDiv.appendChild(tail);
    } else {
      if (safeMsg.indexOf('\n') !== -1) messageDiv.style.whiteSpace = 'pre-line';
      if (options.messageColor && typeof options.messageColor === 'string') messageDiv.style.color = options.messageColor;
      messageDiv.textContent = safeMsg;
    }
    widgetBottom.appendChild(messageDiv);
    var acceptToastBtn = null;
    if (options.showAccept === true || options.acceptLabel !== undefined) {
      acceptToastBtn = document.createElement('button');
      acceptToastBtn.type = 'button';
      acceptToastBtn.setAttribute('aria-label', 'Accept match');
      acceptToastBtn.className = 'challenges-btn';
      acceptToastBtn.style.cssText = 'flex-shrink: 0; padding: 4px 10px; font-size: 12px; cursor: pointer;';
      acceptToastBtn.textContent = typeof options.acceptLabel === 'string' ? options.acceptLabel : 'Accept match';
      acceptToastBtn.style.display = options.showAccept === true ? 'inline-block' : 'none';
      acceptToastBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof window !== 'undefined' && window.__challengesMultiplayerDoAccept) window.__challengesMultiplayerDoAccept();
      });
      widgetBottom.appendChild(acceptToastBtn);
    }
    if (typeof options.onClose === 'function') {
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Leave queue');
      closeBtn.className = 'flex-shrink-0';
      closeBtn.style.cssText = 'width: 24px; height: 24px; padding: 0; border: none; background: transparent; cursor: pointer; color: #e74c3c; font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; border-radius: 4px;';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        options.onClose();
      });
      widgetBottom.appendChild(closeBtn);
    }
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);

    if (isTransient) {
      toast.addEventListener('click', function(e) {
        if (useJoinLink && e.target && e.target.closest && e.target.closest('[data-challenges-queue-watch-join]')) return;
        if (flexContainer && flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateChallengesToastPositions(container);
        }
      });
      setTimeout(function() {
        if (flexContainer && flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateChallengesToastPositions(container);
        }
      }, options.duration);
      return null;
    }

    updateChallengesToastPositions(container);
    var handle = {
      updateMessage: function(text) { messageDiv.textContent = (text != null && text !== '') ? String(text).replace(/</g, '&lt;') : ''; },
      setAcceptVisible: acceptToastBtn ? function(visible) { acceptToastBtn.style.display = visible ? 'inline-block' : 'none'; } : function() {},
      remove: function() {
        if (flexContainer && flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateChallengesToastPositions(container);
        }
        if (challengesPersistentToastHandle === handle) challengesPersistentToastHandle = null;
      }
    };
    challengesPersistentToastHandle = handle;
    return handle;
  } catch (e) {
    console.warn('[Challenges Mod] showChallengesToast:', e);
    return null;
  }
}

function removeChallengesPersistentToast() {
  if (challengesPersistentToastHandle && challengesPersistentToastHandle.remove) challengesPersistentToastHandle.remove();
  challengesPersistentToastHandle = null;
}

function showChallengeToastNotification(message, duration) {
  showChallengesToast(message, { duration: duration || CHALLENGE_TOAST_DURATION });
}

function copyReplayToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showChallengesToast('Setup config copied to clipboard.', { duration: CHALLENGE_TOAST_DURATION });
      }).catch(function() { showChallengesToast('Copy failed.', { duration: CHALLENGE_TOAST_DURATION }); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showChallengesToast('Setup config copied to clipboard.', { duration: CHALLENGE_TOAST_DURATION });
    }
  } catch (e) {
    showChallengesToast('Copy failed.', { duration: CHALLENGE_TOAST_DURATION });
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
  // In multiplayer, keep the timer running so we still submit score and show result when time is up (e.g. after closing defeat modal).
  if (!challengeMultiplayerContext) {
    stopSoloChallengeToast();
    if (challengeMultiplayerTimerId != null) {
      clearTimeout(challengeMultiplayerTimerId);
      challengeMultiplayerTimerId = null;
    }
    stopMultiplayerChallengeToast();
    challengeMultiplayerContext = null;
  }
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

function isChallengesModalOpen() {
  try {
    var dialog = document.querySelector('div[role="dialog"][data-challenges-dialog="1"]');
    if (dialog) return true;
    var fallback = document.querySelector('div[role="dialog"]');
    if (!fallback) return false;
    var titleP = fallback.querySelector('.widget-top p, h2.widget-top-text p');
    return titleP && titleP.textContent.trim() === 'Challenges';
  } catch (e) {
    return false;
  }
}

function closeChallengesModalIfOpen() {
  try {
    var dialog = document.querySelector('div[role="dialog"][data-challenges-dialog="1"]') || document.querySelector('div[role="dialog"]');
    if (!dialog) return;
    var isChallengesModal = dialog.getAttribute('data-challenges-dialog') === '1';
    if (!isChallengesModal) {
      var titleP = dialog.querySelector('.widget-top p, h2.widget-top-text p');
      if (!titleP || titleP.textContent.trim() !== 'Challenges') return;
    }
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
            stopSoloChallengeToast();
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
        startSoloChallengeLiveToast(alliesAllowed);
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
          if (challengeMultiplayerContext) {
            stopMultiplayerChallengeToast();
            challengeMultiplayerContext = null;
          } else {
            stopSoloChallengeToast();
          }
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
      if (!challengeMultiplayerContext) {
        showChallengeToastNotification('Loading challenge setup...');
        startSoloChallengeLiveToast(alliesAllowed);
      }
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
  openChallengesModalMultiplayerAndJoinQueue: openChallengesModalMultiplayerAndJoinQueue,
  cleanup: cleanupChallenges
};
