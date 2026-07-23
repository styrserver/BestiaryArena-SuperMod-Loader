// =======================
// Challenges Mod for Bestiary Arena
// =======================
console.log('[Challenges Mod] Initializing...');

// =======================
// 1. Constants
// =======================

// Same size as Cyclopedia modal (from Super Mods/Cyclopedia.js LAYOUT_CONSTANTS)
const CHALLENGES_MODAL_CONFIG = {
  width: 950,
  height: 700,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 360
};
const MODAL_WIDTH = CHALLENGES_MODAL_CONFIG.width;
const MODAL_HEIGHT = CHALLENGES_MODAL_CONFIG.height;
// Three-column layout (reference: Cyclopedia.js LAYOUT_CONSTANTS)
const COLUMN_WIDTH = 270;
const COL1_WIDTH = COLUMN_WIDTH - 30;
const COL3_WIDTH = COLUMN_WIDTH + 30;
// UI theming (reference: Cyclopedia.js COLOR_CONSTANTS)
const CHALLENGE_COLORS = { TEXT: '#fff', PRIMARY: '#ffe066', SECONDARY: '#e6d7b0', BORDER: '#444' };

/** Shared styles for framed widget boxes (placeholder box, matchmaking panel, etc.) */
const CHALLENGES_FRAME_BOX_STYLE = 'display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; border: 4px solid transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch; border-radius: 6px; overflow: hidden;';

function applyChallengesCol1BoxLayout(box, flexGrow) {
  box.style.flex = (flexGrow != null ? flexGrow : 1) + ' 1 0';
  box.style.minHeight = '0';
}
const CHALLENGES_WIDGET_TITLE_STYLE = 'margin: 0; padding: 2px 8px; text-align: center; color: ' + CHALLENGE_COLORS.TEXT + ';';
const CHALLENGES_WIDGET_BODY_STYLE = 'flex: 1 1 0; overflow-y: auto; padding: 8px 12px; color: ' + CHALLENGE_COLORS.SECONDARY + '; font-size: 14px; line-height: 1.4; min-height: 0; background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat;';

/** Subnav styling (Cyclopedia-like). Injected when opening Challenges modal so subnav works without opening Cyclopedia first. */
const CHALLENGES_SUBNAV_CSS = '.challenges-subnav { display: flex; gap: 0; margin-bottom: 0; width: 100%; } nav.challenges-subnav > button.challenges-btn, nav.challenges-subnav > button.challenges-btn:hover, nav.challenges-subnav > button.challenges-btn:focus { background: url(\'https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png\') repeat !important; border: 6px solid transparent !important; border-color: #ffe066 !important; border-image: url(\'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png\') 6 fill stretch !important; color: var(--theme-text, #e6d7b0) !important; font-weight: 700 !important; border-radius: 0 !important; box-sizing: border-box !important; transition: color 0.2s, border-image 0.1s !important; font-family: \'Trebuchet MS\', \'Arial Black\', Arial, sans-serif !important; outline: none !important; position: relative !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; padding: 7px 24px !important; cursor: pointer; flex: 1 1 0; min-width: 0; } nav.challenges-subnav > button.challenges-btn.active { border-image: url(\'https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png\') 6 fill stretch !important; } nav.challenges-subnav > button.challenges-btn[data-tab="help"] { width: 42px !important; height: 42px !important; min-width: 42px !important; min-height: 42px !important; max-width: 42px !important; max-height: 42px !important; flex: 0 0 42px !important; padding: 0 !important; margin-left: 20px !important; }';
const OBSERVER_DEBOUNCE_DELAY = 250;
const OBSERVER_MIN_INTERVAL = 100;
const HEADER_BUTTON_CHECK_INTERVAL = 1000;

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
/** Player arsenal for solo/PvPvE challenges: count, level, and gene value per stat. */
/** Player arsenal size = factor × rolled enemy count (e.g. 4 enemies → 8 creatures + 8 equips). */
const CHALLENGE_PLAYER_ARSENAL_ENEMY_COUNT_FACTOR = 2;
const CHALLENGE_PLAYER_LEVEL = 99;
const CHALLENGE_PLAYER_GENE_VALUE = 20;
/** Fallback if autoSetupBoard does not fire after room navigation. */
const CHALLENGE_PLAYER_ARSENAL_APPLY_FALLBACK_MS = 200;
/** Base bonus points per rolled arsenal creature/equipment before strength reduction (÷ creature/equip mult). */
const CHALLENGE_PLAYER_ARSENAL_ITEM_BASE_POINTS = 500;
/** Creatures excluded from random challenge rolls (display names, case-insensitive). */
const CHALLENGE_BLOCKED_SPAWN_CREATURE_NAMES = ['Rahemos'];
/** Per-creature chance to roll awakened (non-awakenable creatures never awaken). */
const CHALLENGE_AWAKEN_ROLL_CHANCE = 0.5;
/** Difficulty contribution multiplier for an awakened villain creature. */
const CHALLENGE_AWAKEN_DIFFICULTY_MULT = 1.5;
const CHALLENGE_AWAKEN_STAR_TIER = 6;
const CHALLENGE_AWAKEN_ICON_URL = 'https://bestiaryarena.com/assets/icons/star-tier-awaken.png';
/** localStorage key for personal (non-global) challenge runs, keyed by player name. */
const CHALLENGE_PERSONAL_RECORDS_KEY = 'bestiary_challenges_personal';
/** Max personal records kept per player in localStorage. */
const CHALLENGE_PERSONAL_RECORDS_MAX = 10;
/** Delay in ms between each slot reveal (map → creature → equipment → … → summary). */
const ROLL_SLOT_DELAY_MS = 200;
const ARSENAL_ROLL_SLOT_DELAY_MS = 150;
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
// 2. Challenge Leaderboard (Firebase)
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

/** English fallbacks when locale JSON is unavailable (mirrors en-US). */
var CHALLENGES_I18N_FALLBACK = {
  'mods.challenges.alliesVsEnemiesTitle': "Allies v Enemies (allies allowed vs number of enemy creatures)",
  'mods.challenges.close': "Close",
  'mods.challenges.comingSoon': "Coming soon.",
  'mods.challenges.creatures': "Creatures",
  'mods.challenges.creaturesAllowed': "Creatures allowed: {n}",
  'mods.challenges.creaturesLabel': "Creatures:",
  'mods.challenges.deleteRun': "Delete run",
  'mods.challenges.difficultyLabel': "Difficulty: ",
  'mods.challenges.expectedScoreLabel': "Expected score:",
  'mods.challenges.expectedScoreTitle': "Score you would get for A rank with 500 ticks (includes map difficulty and your rolled arsenal)",
  'mods.challenges.arsenalFactorLabel': "Arsenal factor",
  'mods.challenges.arsenalBonusLabel': "Arsenal bonus",
  'mods.challenges.arsenalItemScoreLabel': "Score",
  'mods.challenges.globalTop10': "Global Top 10",
  'mods.challenges.help': "Help",
  'mods.challenges.helpPanel.arsenalBonusText': "Added on top of map score: average points from each rolled creature and equipment piece × the hardest enemy creature multiplier on the map. Harder rolled items contribute fewer points. Shown in Expected score after the arsenal roll finishes.",
  'mods.challenges.helpPanel.arsenalBonusTitle': "Arsenal bonus",
  'mods.challenges.helpPanel.baseValueTicks': "Base value: (1000 − ticks).",
  'mods.challenges.helpPanel.difficultyMultiplier': "Difficulty multiplier",
  'mods.challenges.helpPanel.difficultyMultiplierDescription': "Based on how many allies you were allowed vs how many enemy creatures (e.g. 1 v 5). Raw difficulty is the internal number that encodes how hard the setup is; the displayed/score multiplier is 10 × (raw÷1000)^{power}, so lower difficulties grant more score (steep at the low end). Shown in the summary and leaderboard (e.g. raw 100 → ~3.16×, raw 500 → ~7.07×, raw 1000 → 10×).",
  'mods.challenges.helpPanel.formula': "Formula",
  'mods.challenges.helpPanel.formulaText': "Map score = round( ( (1000 − ticks) + gradeBonus ) × difficultyMultiplier ). Final score = map score + arsenal bonus.",
  'mods.challenges.helpPanel.gradeA': "A : +1000",
  'mods.challenges.helpPanel.gradeB': "B : +750",
  'mods.challenges.helpPanel.gradeBonus': "Grade bonus",
  'mods.challenges.helpPanel.gradeC': "C : +500",
  'mods.challenges.helpPanel.gradeD': "D : +250",
  'mods.challenges.helpPanel.gradeDescription': "Grade is from max team size, current team size and creatures alive (time is not used). Defeat = F, 0 points.",
  'mods.challenges.helpPanel.gradeF': "F : +0 (defeat)",
  'mods.challenges.helpPanel.gradeS': "S : +1250",
  'mods.challenges.helpPanel.gradeSPlus': "S+ : +1500",
  'mods.challenges.helpPanel.howToPlayText': "Click Randomize to roll a map and enemy creatures (with equipment). Your player arsenal rolls next in the panel below the summary. Click Start to enter the challenge — your inventory is temporarily replaced with the rolled arsenal and restored when you leave.",
  'mods.challenges.helpPanel.howToPlayTitle': "How to play",
  'mods.challenges.helpPanel.mpHowToPlayText': "Click Join queue for matchmaking. When paired, both players must accept within 30 seconds. The first player in the match (by name order) rolls the shared map, enemies, and player arsenal; both see the same roll animation, then enter the same challenge. You have 3 minutes to finish. Higher challenge score wins; defeat scores 0.",
  'mods.challenges.helpPanel.mpHowToPlayTitle': "How to play",
  'mods.challenges.helpPanel.mpRatingText': "Matches use Elo rating (default 1000). Winning gains points, losing loses points; beating a higher-rated player gains more. The leaderboard sorts by rating, then matches played, then name. Your challenge score (map score + arsenal bonus) decides who wins; the loser's score is 0.",
  'mods.challenges.helpPanel.mpRatingTitle': "Rating & leaderboard",
  'mods.challenges.helpPanel.mpSharedArsenalText': "Both players receive the same rolled player arsenal. Slot count is 2× the number of enemies. Each inventory creature can only be placed on the board once.",
  'mods.challenges.helpPanel.mpSharedArsenalTitle': "Shared arsenal",
  'mods.challenges.helpPanel.mpTitle': "PvPvE",
  'mods.challenges.helpPanel.playerArsenalText': "After villains finish rolling, you receive random Lv. 99 shiny awakened creatures and random equipment. Slot count is 2× the number of enemies rolled (e.g. 4 enemies → 8 creatures + 8 equipment).",
  'mods.challenges.helpPanel.playerArsenalTitle': "Player arsenal",
  'mods.challenges.helpPanel.removeTicks': "Remove Ticks",
  'mods.challenges.helpPanel.soloTitle': "Solo",
  'mods.challenges.helpPanel.title': "How challenge score is calculated",
  'mods.challenges.labels.diff': "Diff",
  'mods.challenges.labels.grade': "Grade",
  'mods.challenges.labels.map': "Map",
  'mods.challenges.labels.name': "Name",
  'mods.challenges.labels.score': "Score",
  'mods.challenges.labels.ticks': "Ticks",
  'mods.challenges.loading': "Loading…",
  'mods.challenges.loadingError': "Could not load leaderboard.",
  'mods.challenges.loadSetupTitle': "Load this challenge setup",
  'mods.challenges.mapLabel': "Map:",
  'mods.challenges.maps': "Maps",
  'mods.challenges.multiplayer.acceptMatch': "Accept match",
  'mods.challenges.multiplayer.acceptMatchPrompt': "Matched with {name}. Accept the match to proceed.",
  'mods.challenges.multiplayer.acceptMatchPromptWithin': "Matched with {name}. Accept within {n}s...",
  'mods.challenges.multiplayer.acceptWithin': "Accept within {n}s",
  'mods.challenges.multiplayer.alreadyInQueueElsewhere': "You are already in the queue in another tab or device.",
  'mods.challenges.multiplayer.draw': "Draw.",
  'mods.challenges.multiplayer.footerQueueCount': "{n} in queue",
  'mods.challenges.multiplayer.joining': "Joining…",
  'mods.challenges.multiplayer.joinMatch': "Join match",
  'mods.challenges.multiplayer.joinQueue': "Join queue",
  'mods.challenges.multiplayer.joinQueueHint': "Click the button below to join the matchmaking queue. You will be paired with another player when one is available.",
  'mods.challenges.multiplayer.leaderboardComingSoon': "Rating system coming soon.",
  'mods.challenges.multiplayer.leaderboardRank': "#",
  'mods.challenges.multiplayer.leaderboardTitle': "Leaderboard",
  'mods.challenges.multiplayer.leaveQueue': "Leave queue",
  'mods.challenges.multiplayer.liveToastTime': "Time: {time}",
  'mods.challenges.multiplayer.matchAccepted': "Match accepted! Ready to proceed.",
  'mods.challenges.multiplayer.matchedWith': "Matched with {name}!",
  'mods.challenges.multiplayer.matches': "Matches",
  'mods.challenges.multiplayer.matchExpired': "Match expired.",
  'mods.challenges.multiplayer.matchExpiredRequeued': "Match expired. You've been re-queued.",
  'mods.challenges.multiplayer.matchmaking': "Matchmaking",
  'mods.challenges.multiplayer.needPlayerName': "Please log in so we can add you to the queue.",
  'mods.challenges.multiplayer.noPlayersYet': "No players yet. Complete a match to appear here.",
  'mods.challenges.multiplayer.queueError': "Could not join queue. Please try again.",
  'mods.challenges.multiplayer.queueStatus': "{count} player(s) in queue · Waiting {time}",
  'mods.challenges.multiplayer.queueWatchInviteJoin': "Join",
  'mods.challenges.multiplayer.queueWatchInviteLead': "A player is in queue in challenges!",
  'mods.challenges.multiplayer.queueWatchInviteTail': "here!",
  'mods.challenges.multiplayer.rating': "Rating",
  'mods.challenges.multiplayer.submitError': "Could not submit score.",
  'mods.challenges.multiplayer.timeUp': "Time's up! Submitting score...",
  'mods.challenges.multiplayer.underDevelopmentBanner': "PvPvE is under development and may be a little buggy.",
  'mods.challenges.multiplayer.waitingForAccept': "Waiting for {name} to accept…",
  'mods.challenges.multiplayer.waitingForAcceptWithin': "Waiting for {name} to accept within {n}s...",
  'mods.challenges.multiplayer.waitingForOpponent': "Waiting for an opponent…",
  'mods.challenges.multiplayer.winByForfeit': "Win by forfeit!",
  'mods.challenges.multiplayer.winByForfeitWithOpponent': "{name} has disconnected. Win by forfeit!",
  'mods.challenges.multiplayer.victoryOpponent': "Opponent: {name}",
  'mods.challenges.multiplayer.victoryWaitingForOpponent': "Your score has been submitted. Waiting for {name} to finish…",
  'mods.challenges.multiplayer.youLose': "You lose.",
  'mods.challenges.multiplayer.youWin': "You win!",
  'mods.challenges.noPersonalRunsYet': "No personal runs yet.",
  'mods.challenges.noRunsYet': "No runs yet. Complete a challenge to appear here.",
  'mods.challenges.openProfileTitle': "{name} (open profile)",
  'mods.challenges.opponentFallback': "Opponent",
  'mods.challenges.personalTop10': "Personal Top 10",
  'mods.challenges.randomize': "Randomize",
  'mods.challenges.rankLabel': "Rank:",
  'mods.challenges.rollFailed': "Roll failed",
  'mods.challenges.rolling': "Rolling…",
  'mods.challenges.skip': "Skip",
  'mods.challenges.start': "Start",
  'mods.challenges.summary': "Summary",
  'mods.challenges.playerArsenal': "Player arsenal",
  'mods.challenges.playerArsenalCreatures': "Creatures",
  'mods.challenges.playerArsenalEquipment': "Equipment",
  'mods.challenges.playerArsenalEmpty': "Roll a challenge to see your arsenal.",
  'mods.challenges.playerArsenalRolling': "Rolling player arsenal…",
  'mods.challenges.playerArsenalSlots': "{n} slots (2× {enemies} enemies)",
  'mods.challenges.tabs.multiplayer': "PvPvE",
  'mods.challenges.tabs.solo': "Solo",
  'mods.challenges.title': "Challenges",
  'mods.challenges.victory': "Victory!"
};

function challengesModTranslate(key, fallback) {
  if (fallback == null && CHALLENGES_I18N_FALLBACK[key] != null) {
    fallback = CHALLENGES_I18N_FALLBACK[key];
  }
  try {
    if (typeof context !== 'undefined' && context.api && context.api.i18n && typeof context.api.i18n.t === 'function') {
      var s = context.api.i18n.t(key);
      if (s && typeof s === 'string' && s !== key && s.indexOf('mods.') !== 0) return s;
    }
  } catch (e) {}
  return fallback != null ? fallback : key;
}

function challengesText(key) {
  return challengesModTranslate(key, CHALLENGES_I18N_FALLBACK[key]);
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
  function doDelete() {
    ChallengeFirebaseService.delete(matchPath).catch(function() {});
    if (keys[0]) ChallengeFirebaseService.delete(pmPath + '/' + keys[0]).catch(function() {});
    if (keys[1]) ChallengeFirebaseService.delete(pmPath + '/' + keys[1]).catch(function() {});
  }
  if (CHALLENGE_MP_MATCH_DELETE_DELAY_MS > 0 && typeof setTimeout === 'function') {
    setTimeout(doDelete, CHALLENGE_MP_MATCH_DELETE_DELAY_MS);
  } else {
    doDelete();
  }
}

/** Build result payload from cached match scores (both players must have numeric scores). */
function buildMultiplayerResultDataFromContext(ctx) {
  if (!ctx || !ctx.matchId) return null;
  var keys = getMatchPlayerKeys(ctx.matchId);
  if (keys.length < 2 || !ctx.cachedMatch || !ctx.cachedMatch.scores) return null;
  var scores = ctx.cachedMatch.scores;
  if (typeof scores[keys[0]] !== 'number' || typeof scores[keys[1]] !== 'number') return null;
  var name1 = getMatchPlayerNameForKey(ctx.cachedMatch, keys[0]);
  var name2 = getMatchPlayerNameForKey(ctx.cachedMatch, keys[1]);
  return { score1: scores[keys[0]], score2: scores[keys[1]], key1: keys[0], key2: keys[1], name1: name1, name2: name2 };
}

/** Show match result once and clear multiplayer battle context. ratingsUpdate: call updateMultiplayerRatingsAfterMatch when true. */
function finishMultiplayerMatch(ctx, resultData, ratingsUpdate) {
  if (!ctx || ctx.resultShown) return;
  ctx.resultShown = true;
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
  if (resultData) {
    if (ratingsUpdate) {
      updateMultiplayerRatingsAfterMatch(resultData.key1, resultData.key2, resultData.name1, resultData.name2, resultData.score1, resultData.score2).then(function() {
        showMultiplayerResult(ctx, resultData);
      }).catch(function() {
        showMultiplayerResult(ctx, resultData);
      });
    } else {
      showMultiplayerResult(ctx, resultData);
    }
  } else {
    showMultiplayerResult(ctx, null);
  }
  challengeMultiplayerContext = null;
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
  updateChallengesNavHeaderMatchAlert();
  if (typeof window !== 'undefined' && typeof window.__challengesSyncFooter === 'function') {
    window.__challengesSyncFooter();
  }
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
  if (state === challengesMultiplayerPersisted) {
    updateChallengesNavHeaderMatchAlert();
  }
}

/** Return [key1, key2] from matchId (e.g. "key1_key2"). Keys are sorted alphabetically in matchId. */
function getMatchPlayerKeys(matchId) {
  if (!matchId || typeof matchId !== 'string') return [];
  return matchId.split('_');
}

/** Display name for a player Firebase key on a match or cached match snapshot. */
function getMatchPlayerNameForKey(match, playerKey) {
  if (!playerKey) return '';
  var k = String(playerKey);
  if (!match || typeof match !== 'object') return k;
  if (match.player1Key != null && String(match.player1Key) === k) {
    return (match.player1 != null && String(match.player1).trim()) ? String(match.player1).trim() : k;
  }
  if (match.player2Key != null && String(match.player2Key) === k) {
    return (match.player2 != null && String(match.player2).trim()) ? String(match.player2).trim() : k;
  }
  return k;
}

/** Keep cachedMatch player names aligned to matchId key order (keys[0], keys[1]). */
function syncCachedMatchPlayersFromMatch(cachedMatch, match, matchId) {
  var keys = getMatchPlayerKeys(matchId);
  if (keys.length < 2) return cachedMatch;
  var cm = cachedMatch || {};
  cm.player1Key = keys[0];
  cm.player2Key = keys[1];
  cm.player1 = getMatchPlayerNameForKey(match, keys[0]);
  cm.player2 = getMatchPlayerNameForKey(match, keys[1]);
  return cm;
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
/** Both clients start the reel at chosenAt + this delay so opponent has time to poll Firebase. */
var CHALLENGE_MP_ROLL_SYNC_DELAY_MS = 2500;
var CHALLENGE_MP_ROLL_POLL_MS = 400;
var challengeMpRollStartedForMatchId = null;
var challengeMpRollWriteStartedForMatchId = null;
var CHALLENGE_MP_TIME_LIMIT_MS = 3 * 60 * 1000; // 3 minutes
var CHALLENGE_MP_ACCEPT_DEADLINE_MS = 30 * 1000; // time to accept match; after that remove from queue / re-queue if one accepted
var CHALLENGE_MP_QUEUE_POLL_MS = 1000; // Firebase GET /queue while in matchmaking (1s; e.g. after toast Join)
var CHALLENGE_MP_QUEUE_UI_TICK_MS = 1000; // refresh wait time (m:ss) every second while in queue
/** While matched (accept phase): poll Firebase match doc every 1s so countdown + accept state stay current. */
var CHALLENGE_MP_ACCEPT_POLL_MS = 1000;
var CHALLENGE_MP_SCORE_POLL_MS = 2000;
var CHALLENGE_MP_TOAST_UPDATE_MS = 1000; // live toast (vs opponent · countdown) refresh every 1s
/** Delay before deleting completed match so the other client can poll final scores. */
var CHALLENGE_MP_MATCH_DELETE_DELAY_MS = 15000;

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
/** True when Firebase queue has other player(s) waiting (updated by queue watch poll). */
var challengesNavOthersInQueue = false;

function isMultiplayerQueueWatchDebug() {
  return typeof window !== 'undefined' && window.__challengesQueueWatchDebug === true;
}

function shouldQueueWatchIncludeSelf() {
  return typeof window !== 'undefined' && window.__challengesQueueWatchIncludeSelf === true;
}

/** Other players waiting in the multiplayer queue (excludes self unless debug include-self). */
function collectMultiplayerQueueWatcherEntries(queueData) {
  var myName = (getCurrentPlayerName() || '').trim();
  var myKey = myName && myName !== 'Unknown' ? sanitizeFirebaseKeyForChallenges(myName) : null;
  var includeSelf = shouldQueueWatchIncludeSelf();
  var entries = [];
  if (queueData && typeof queueData === 'object') {
    Object.keys(queueData).forEach(function(k) {
      var v = queueData[k];
      if (!v || v.playerName == null || v.joinedAt == null) return;
      if (!includeSelf && myKey && k === myKey) return;
      entries.push({ key: k, playerName: String(v.playerName), joinedAt: v.joinedAt, clientToken: v.clientToken != null ? String(v.clientToken) : '' });
    });
  }
  entries.sort(function(a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
  return entries;
}

function syncChallengesNavOthersInQueueFromEntries(entries) {
  challengesNavOthersInQueue = entries.length > 0;
  updateChallengesNavHeaderMatchAlert();
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
    var entries = collectMultiplayerQueueWatcherEntries(queueData);
    var rawKeyCount = queueData && typeof queueData === 'object' ? Object.keys(queueData).length : 0;
    syncChallengesNavOthersInQueueFromEntries(entries);
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
  var name1 = getMatchPlayerNameForKey(ctx.cachedMatch, keys[0]);
  var name2 = getMatchPlayerNameForKey(ctx.cachedMatch, keys[1]);
  var s1 = (ctx.cachedMatch && ctx.cachedMatch.scores && typeof ctx.cachedMatch.scores[keys[0]] === 'number') ? ctx.cachedMatch.scores[keys[0]] : '—';
  var s2 = (ctx.cachedMatch && ctx.cachedMatch.scores && typeof ctx.cachedMatch.scores[keys[1]] === 'number') ? ctx.cachedMatch.scores[keys[1]] : '—';
  var alliesAllowedText = (ctx && typeof ctx.alliesAllowed === 'number') ? String(ctx.alliesAllowed) : '—';
  return challengesText('mods.challenges.multiplayer.liveToastTime').replace('{time}', timeStr) + '\n' +
    challengesText('mods.challenges.creaturesAllowed').replace('{n}', alliesAllowedText) + '\n' +
    name1 + ': ' + s1 + '\n' +
    name2 + ': ' + s2;
}

function buildSoloCreaturesAllowedToastMessage(alliesAllowed) {
  var n = typeof alliesAllowed === 'number' ? alliesAllowed : 0;
  return challengesText('mods.challenges.creaturesAllowed').replace('{n}', String(n));
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
      var resultFromCache = buildMultiplayerResultDataFromContext(ctx);
      if (resultFromCache) {
        finishMultiplayerMatch(ctx, resultFromCache, false);
        if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
        return;
      }
      if (ctx.submittedAt) {
        /* We finished; match was removed after normal completion — not a forfeit. */
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
        if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
        challengeMultiplayerContext = null;
        return;
      }
      var keys = getMatchPlayerKeys(ctx.matchId);
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
      var oppKey = (keys.length >= 2 && ctx.myKey) ? (keys[0] === ctx.myKey ? keys[1] : keys[0]) : null;
      var oppName = oppKey ? (getMatchPlayerNameForKey(ctx.cachedMatch, oppKey) || (ctx.opponentName && String(ctx.opponentName).trim()) || oppKey) : challengesText('mods.challenges.opponentFallback');
      var winByForfeitTemplate = challengesText('mods.challenges.multiplayer.winByForfeitWithOpponent');
      var winByForfeitMsg = winByForfeitTemplate.replace('{name}', String(oppName).trim() || challengesText('mods.challenges.opponentFallback'));
      showChallengesToast(winByForfeitMsg, { duration: 10000 });
      if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
      challengeMultiplayerContext = null;
      return;
    }
    var scores = (match && match.scores && typeof match.scores === 'object') ? match.scores : {};
    var keys = getMatchPlayerKeys(ctx.matchId);
    if (keys.length < 2) return;
    ctx.cachedMatch = syncCachedMatchPlayersFromMatch(ctx.cachedMatch, match, ctx.matchId);
    ctx.cachedMatch.scores = { [keys[0]]: scores[keys[0]], [keys[1]]: scores[keys[1]] };
    var has1 = typeof scores[keys[0]] === 'number';
    var has2 = typeof scores[keys[1]] === 'number';
    if (has1 && has2) {
      var name1 = getMatchPlayerNameForKey(match, keys[0]);
      var name2 = getMatchPlayerNameForKey(match, keys[1]);
      if (!name1) name1 = keys[0];
      if (!name2) name2 = keys[1];
      var resultData = { score1: scores[keys[0]], score2: scores[keys[1]], key1: keys[0], key2: keys[1], name1: name1, name2: name2 };
      var completedMatchId = ctx.matchId;
      var ratingsAlreadyApplied = !!(match && match.ratingsApplied);
      if (!ratingsAlreadyApplied) {
        ChallengeFirebaseService.patch(matchPath, { ratingsApplied: true }).catch(function() {});
      }
      finishMultiplayerMatch(ctx, resultData, !ratingsAlreadyApplied);
      deleteCompletedMatchFromFirebase(completedMatchId);
      return;
    }
    if (ctx.startTime && (Date.now() - ctx.startTime) >= CHALLENGE_MP_TIME_LIMIT_MS) {
      var timeUpMatchId = ctx.matchId;
      finishMultiplayerMatch(ctx, null, false);
      deleteCompletedMatchFromFirebase(timeUpMatchId);
      return;
    }
    updateMultiplayerChallengeToast();
  });
}

function stopMultiplayerChallengeToast() {
  challengeMpRollStartedForMatchId = null;
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

function ensureChallengesModalOpenOnMultiplayerTab(onReady) {
  function finish() {
    if (typeof window !== 'undefined' && window.__challengesSetActiveTab) {
      window.__challengesSetActiveTab(1);
    }
    if (typeof onReady === 'function') {
      setTimeout(onReady, 0);
    }
  }
  if (!isChallengesModalOpen()) {
    if (typeof openChallengesModal === 'function') openChallengesModal(1);
    setTimeout(finish, 50);
  } else {
    finish();
  }
}

function waitForChallengesMpUiReady(onReady, maxAttempts) {
  var attempts = 0;
  var limit = maxAttempts != null ? maxAttempts : 80;
  function tryReady() {
    if (typeof window !== 'undefined'
        && typeof window.__challengesRunMultiplayerRoll === 'function'
        && typeof window.__challengesMpSetRollResult === 'function') {
      onReady();
      return;
    }
    attempts++;
    if (attempts >= limit) {
      console.warn('[Challenges MP] MP UI not ready after wait; continuing without reel animation');
      onReady();
      return;
    }
    setTimeout(tryReady, 50);
  }
  ensureChallengesModalOpenOnMultiplayerTab(tryReady);
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

function runMultiplayerRollThenStart(roomId, roomName, villainSpecs, matchId, myKey, opponentName, allyGameIds, allyEquips) {
  var specs = normalizeVillainSpecsArray(villainSpecs);
  if (!roomId || !specs.length) {
    showChallengeToastNotification('Invalid match roll.');
    return;
  }
  if (matchId) challengeMpRollStartedForMatchId = matchId;
  villainSpecs = specs;
  console.log('[Challenges MP] runMultiplayerRollThenStart', roomId, villainSpecs.length, 'villains', matchId);

  function doAfterRoll() {
    var diff = computeChallengeDifficulty(villainSpecs);
    var expectedScore = computeChallengeExpectedScore(diff.difficulty, 'A', 500, allyGameIds, allyEquips, villainSpecs);
    if (typeof window !== 'undefined' && window.__challengesMpSetRollResult) {
      window.__challengesMpSetRollResult(roomId, roomName, villainSpecs, diff, expectedScore, allyGameIds, allyEquips);
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
        challengeMultiplayerContext.cachedMatch = syncCachedMatchPlayersFromMatch({ scores: {} }, {
          player1Key: keys[0],
          player2Key: keys[1],
          player1: (myKey === keys[0] ? (getCurrentPlayerName() || keys[0]) : (opponentName || keys[0])),
          player2: (myKey === keys[1] ? (getCurrentPlayerName() || keys[1]) : (opponentName || keys[1]))
        }, matchId);
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
      console.log('[Challenges MP] navigating to challenge map', roomId);
      startChallengeWithVillainConfig({
        roomId: roomId,
        roomName: roomName || roomId,
        villains: villainSpecs,
        allyGameIds: allyGameIds,
        allyEquips: allyEquips
      });
      if (challengeMultiplayerContext) {
        challengeMultiplayerTimerId = setTimeout(function() {
          challengeMultiplayerTimerId = null;
          onMultiplayerTimeLimitReached();
        }, CHALLENGE_MP_TIME_LIMIT_MS);
      }
    }, CHALLENGE_MP_ROLL_DELAY_MS);
  }

  waitForChallengesMpUiReady(function() {
    if (typeof window !== 'undefined' && window.__challengesRunMultiplayerRoll) {
      window.__challengesRunMultiplayerRoll(roomId, roomName, specs, doAfterRoll, allyGameIds, allyEquips);
    } else {
      doAfterRoll();
    }
  });
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
    ctx.cachedMatch = syncCachedMatchPlayersFromMatch(ctx.cachedMatch, match, ctx.matchId);
    ctx.cachedMatch.scores = ctx.cachedMatch.scores || {};
    var scores = (match && match.scores && typeof match.scores === 'object') ? Object.assign({}, match.scores) : {};
    scores[ctx.myKey] = score;
    console.log('[Challenges MP] submit score', { matchId: ctx.matchId, myKey: ctx.myKey, score: score });
    return ChallengeFirebaseService.patch(matchPath, { scores: scores });
  }).then(function() {
    ctx.submittedAt = ctx.submittedAt || Date.now();
    ctx.cachedMatch = ctx.cachedMatch || {};
    ctx.cachedMatch.scores = ctx.cachedMatch.scores || {};
    ctx.cachedMatch.scores[ctx.myKey] = score;
    pollMultiplayerMatchScores();
  }).catch(function(err) {
    console.warn('[Challenges MP] submit score error', err);
    stopMultiplayerChallengeToast();
    showChallengeToastNotification(t('mods.challenges.multiplayer.submitError') || 'Could not submit score.');
    challengeMultiplayerContext = null;
  });
}

function showMultiplayerResult(ctx, data) {
  if (!data) {
    showChallengeToastNotification(challengesText('mods.challenges.multiplayer.timeUp'));
    return;
  }
  var myKey = ctx && ctx.myKey;
  var myScore = data.key1 === myKey ? data.score1 : data.score2;
  var otherScore = data.key1 === myKey ? data.score2 : data.score1;
  var name1 = (data.name1 != null && data.name1 !== '') ? String(data.name1) : data.key1;
  var name2 = (data.name2 != null && data.name2 !== '') ? String(data.name2) : data.key2;
  var resultTitle = myScore > otherScore ? challengesText('mods.challenges.multiplayer.youWin')
    : myScore < otherScore ? challengesText('mods.challenges.multiplayer.youLose')
    : challengesText('mods.challenges.multiplayer.draw');
  var resultColor = myScore > otherScore ? '#22c55e' : myScore < otherScore ? '#ef4444' : '#e6d7b0';

  var wrap = document.createElement('div');
  wrap.style.cssText = 'padding: 12px 16px; text-align: center;';
  var headline = document.createElement('p');
  headline.textContent = resultTitle;
  headline.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; font-weight: bold; color: ' + resultColor + ';';
  wrap.appendChild(headline);

  function scoreRow(name, score) {
    var p = document.createElement('p');
    p.style.cssText = 'margin: 8px 0; font-size: 15px; color: #e6d7b0;';
    p.textContent = name + ': ' + score;
    return p;
  }
  wrap.appendChild(scoreRow(name1, data.score1));
  wrap.appendChild(scoreRow(name2, data.score2));

  var api = (typeof context !== 'undefined' && context && context.api) ? context.api : (typeof window !== 'undefined' && window.BestiaryModAPI) ? window.BestiaryModAPI : null;
  var opened = openModal(api, {
    title: challengesText('mods.challenges.title'),
    content: wrap,
    buttons: [{
      text: challengesText('mods.challenges.close'),
      primary: true,
      onClick: function() {
        if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
        ensureChallengesModalOpenOnMultiplayerTab();
      }
    }]
  });

  if (!opened) {
    var scoresAndResult = name1 + ': ' + data.score1 + '\n' + name2 + ': ' + data.score2 + '\n' + resultTitle;
    showChallengesToast(scoresAndResult, { duration: 6000, messageColor: resultColor });
    if (typeof window !== 'undefined') {
      window.setTimeout(function() {
        ensureChallengesModalOpenOnMultiplayerTab();
      }, 5000);
    }
  }

  if (typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
}

/** When both players accepted: chooser writes roll to Firebase; both poll until complete then run the same synced reel animation. */
function handleMultiplayerMatchReady(matchId, myKey) {
  if (!matchId || !myKey) return;
  if (challengeMultiplayerContext && challengeMultiplayerContext.matchId === matchId) {
    console.log('[Challenges MP] handleMultiplayerMatchReady: match already in progress', matchId);
    return;
  }
  if (challengeMpRollStartedForMatchId === matchId) {
    console.log('[Challenges MP] handleMultiplayerMatchReady: roll already started for', matchId);
    return;
  }
  var keysPreview = getMatchPlayerKeys(matchId);
  console.log('[Challenges MP] handleMultiplayerMatchReady', matchId, myKey, 'chooser=', myKey === keysPreview[0]);
  ensureChallengesModalOpenOnMultiplayerTab(function() {
    startMultiplayerMatchRollSync(matchId, myKey);
  });
}

function startMultiplayerMatchRollSync(matchId, myKey) {
  var matchPath = CHALLENGE_MULTIPLAYER_BASE + '/matches/' + matchId;
  var keys = getMatchPlayerKeys(matchId);
  if (keys.length < 2) return;
  var isChooser = (myKey === keys[0]);
  var pollTimer = null;
  var pollCount = 0;
  var maxPolls = 60;

  function stopPoll() {
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function opponentFromMatch(match) {
    var opponentKey = (myKey === keys[0]) ? keys[1] : keys[0];
    return getMatchPlayerNameForKey(match, opponentKey) || challengesText('mods.challenges.opponentFallback');
  }

  function startRollFromSync(match, sync) {
    if (challengeMpRollStartedForMatchId === matchId) {
      stopPoll();
      return;
    }
    challengeMpRollStartedForMatchId = matchId;
    stopPoll();
    var chosenAt = sync.chosenAt || (match && match.chosenAt) || Date.now();
    console.log('[Challenges MP] roll payload ready', sync.roomId, sync.specs.length, 'villains',
      sync.rawIdCount + '/' + sync.arsenalCount, 'allies',
      sync.rawEquipCount + '/' + sync.arsenalCount, 'equips');
    scheduleSyncedMultiplayerRoll(chosenAt, function() {
      runMultiplayerRollThenStart(
        sync.roomId,
        sync.roomName || sync.roomId,
        sync.specs,
        matchId,
        myKey,
        opponentFromMatch(match),
        sync.allyIds,
        sync.allyEquips
      );
    });
  }

  function chooserWriteFullRoll(match) {
    if (challengeMpRollWriteStartedForMatchId === matchId) return;
    challengeMpRollWriteStartedForMatchId = matchId;
    var allRooms = getAllRoomsForReel();
    if (!allRooms || !allRooms.length) {
      challengeMpRollWriteStartedForMatchId = null;
      showChallengeToastNotification('No maps available.');
      return;
    }
    var picked = pickRandomFromArray(allRooms, 1)[0];
    var roomId = picked.roomId;
    var roomName = picked.roomName || roomId;
    var villainSpecs = pickRandomCreatureSpecsForRoom(roomId);
    if (!villainSpecs || !villainSpecs.length) {
      challengeMpRollWriteStartedForMatchId = null;
      showChallengeToastNotification('Could not roll creatures for map.');
      return;
    }
    var arsenalCount = getChallengePlayerArsenalCount(villainSpecs);
    var allyGameIds = pickRandomUniqueChallengePlayerGameIds(arsenalCount);
    if (!allyGameIds.length) {
      challengeMpRollWriteStartedForMatchId = null;
      showChallengeToastNotification('Could not roll player creatures.');
      return;
    }
    var allyEquips = pickRandomChallengePlayerEquips(arsenalCount);
    if (!allyEquips.length) {
      challengeMpRollWriteStartedForMatchId = null;
      showChallengeToastNotification('Could not roll player equipment.');
      return;
    }
    var chosenAt = Date.now();
    console.log('[Challenges MP] chooser writing full roll', roomId, villainSpecs.length, 'villains', arsenalCount, 'arsenal slots');
    ChallengeFirebaseService.patch(matchPath, {
      chosenRoomId: roomId,
      chosenRoomName: roomName,
      chosenVillainSpecs: villainSpecs,
      chosenAllyGameIds: allyGameIds,
      chosenAllyEquips: allyEquips,
      chosenAt: chosenAt
    }).then(function() {
      startRollFromSync(match, {
        specs: villainSpecs,
        arsenalCount: arsenalCount,
        rawIdCount: allyGameIds.length,
        rawEquipCount: allyEquips.length,
        allyIds: allyGameIds,
        allyEquips: allyEquips,
        complete: true,
        stale: false,
        roomId: roomId,
        roomName: roomName,
        chosenAt: chosenAt
      });
    }).catch(function(err) {
      challengeMpRollWriteStartedForMatchId = null;
      console.warn('[Challenges MP] chooser PATCH full roll failed', err);
      showChallengeToastNotification('Could not sync challenge roll.');
    });
  }

  function chooserCompletePartialRoll(match, sync) {
    if (challengeMpRollWriteStartedForMatchId === matchId) return;
    challengeMpRollWriteStartedForMatchId = matchId;
    var allyIds = sync.allyIds.slice();
    var allyEquips = sync.allyEquips.slice();
    if (allyIds.length < sync.arsenalCount) {
      allyIds = pickRandomUniqueChallengePlayerGameIds(sync.arsenalCount);
    }
    if (allyEquips.length < sync.arsenalCount) {
      allyEquips = pickRandomChallengePlayerEquips(sync.arsenalCount);
    }
    if (!allyIds.length || !allyEquips.length) {
      challengeMpRollWriteStartedForMatchId = null;
      chooserWriteFullRoll(match);
      return;
    }
    var chosenAt = Date.now();
    console.log('[Challenges MP] chooser completing partial roll (allies)', sync.roomId, sync.arsenalCount, 'slots');
    ChallengeFirebaseService.patch(matchPath, {
      chosenAllyGameIds: allyIds,
      chosenAllyEquips: allyEquips,
      chosenAt: chosenAt
    }).finally(function() {
      startRollFromSync(match, {
        specs: sync.specs,
        arsenalCount: sync.arsenalCount,
        rawIdCount: allyIds.length,
        rawEquipCount: allyEquips.length,
        allyIds: allyIds,
        allyEquips: allyEquips,
        complete: true,
        stale: false,
        roomId: sync.roomId,
        roomName: sync.roomName,
        chosenAt: chosenAt
      });
    });
  }

  function onMatchPoll(match) {
    pollCount++;
    var sync = getMatchRollSyncState(match);
    if (sync.complete && !sync.stale) {
      startRollFromSync(match, sync);
      return;
    }
    if (isChooser) {
      if (sync.stale || !sync.roomId || !sync.specs.length) {
        chooserWriteFullRoll(match);
      } else if (!sync.complete) {
        chooserCompletePartialRoll(match, sync);
      }
      return;
    }
    if (pollCount === 1 || pollCount % 5 === 0) {
      console.log('[Challenges MP] waiting for chooser roll', pollCount,
        sync.roomId || '(no map)',
        sync.specs.length, 'villains',
        sync.rawIdCount + '/' + sync.arsenalCount, 'allies',
        sync.rawEquipCount + '/' + sync.arsenalCount, 'equips',
        sync.stale ? '(stale — chooser will re-roll)' : '');
    }
    if (pollCount >= maxPolls) {
      stopPoll();
      console.warn('[Challenges MP] timed out waiting for chooser roll from Firebase');
      showChallengeToastNotification('Timed out waiting for opponent to roll the challenge.');
    }
  }

  ChallengeFirebaseService.get(matchPath, null).then(function(match) {
    onMatchPoll(match || {});
    if (challengeMpRollStartedForMatchId === matchId) return;
    pollTimer = setInterval(function() {
      if (challengeMpRollStartedForMatchId === matchId) {
        stopPoll();
        return;
      }
      ChallengeFirebaseService.get(matchPath, null).then(function(m) {
        onMatchPoll(m || {});
      });
    }, CHALLENGE_MP_ROLL_POLL_MS);
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
    grade: run.grade,
    playerArsenalBonus: run.playerArsenalBonus != null ? run.playerArsenalBonus : 0,
    playerArsenalAverage: run.playerArsenalAverage,
    playerArsenalMapMax: run.playerArsenalMapMax,
    playerArsenalItems: Array.isArray(run.playerArsenalItems) ? run.playerArsenalItems : []
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
  var ctxT = challengesText;
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

function getChallengesOpenDialog() {
  return document.querySelector('div[role="dialog"][data-challenges-dialog="1"]') ||
    document.querySelector('div[role="dialog"][data-state="open"]') ||
    document.querySelector('div[role="dialog"]');
}

function getChallengesDialog(modalRef) {
  if (modalRef && modalRef.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return getChallengesOpenDialog();
}

let activeChallengesModal = null;
let challengesModalLayoutCleanup = null;
let challengesModalChromeInitialized = false;

function getChallengesModalDimensions() {
  const pad = CHALLENGES_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      CHALLENGES_MODAL_CONFIG.minWidth,
      Math.min(CHALLENGES_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      CHALLENGES_MODAL_CONFIG.minHeight,
      Math.min(CHALLENGES_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function getChallengesColumnWidths(modalWidth) {
  const contentWidth = Math.max(200, modalWidth - 24);
  const desktopTotal = COL1_WIDTH + COLUMN_WIDTH + COL3_WIDTH;
  if (contentWidth >= desktopTotal) {
    return { col1: COL1_WIDTH, col3: COL3_WIDTH, soloOverflowX: 'hidden' };
  }
  const scale = contentWidth / desktopTotal;
  return {
    col1: Math.max(72, Math.round(COL1_WIDTH * scale)),
    col3: Math.max(90, Math.round(COL3_WIDTH * scale)),
    soloOverflowX: 'auto'
  };
}

function clearChallengesModalLayoutCleanup() {
  if (challengesModalLayoutCleanup) {
    challengesModalLayoutCleanup();
    challengesModalLayoutCleanup = null;
  }
}

function applyChallengesModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getChallengesDialog(modalRef);
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
  dialog.setAttribute('data-challenges-dialog', '1');

  const innerWrapper = dialog.querySelector(':scope > div') || dialog.firstElementChild;
  if (innerWrapper) {
    Object.assign(innerWrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '0',
      flex: '1 1 0'
    });
  }

  const widgetBottom = dialog.querySelector('.widget-bottom');
  if (widgetBottom) {
    Object.assign(widgetBottom.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  const tabContent = dialog.querySelector('[data-challenges-content]');
  if (tabContent) {
    Object.assign(tabContent.style, {
      flex: '1 1 0',
      minHeight: '0',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }

  const { col1, col3, soloOverflowX } = getChallengesColumnWidths(width);
  dialog.querySelectorAll('.challenges-col-left').forEach(function(col) {
    col.style.width = `${col1}px`;
    col.style.minWidth = `${col1}px`;
    col.style.flex = `0 0 ${col1}px`;
  });
  dialog.querySelectorAll('.challenges-col-right').forEach(function(col) {
    col.style.width = `${col3}px`;
    col.style.minWidth = `${col3}px`;
    col.style.flex = `0 0 ${col3}px`;
  });
  dialog.querySelectorAll('.challenges-solo-panel, .challenges-mp-panel').forEach(function(panel) {
    panel.style.overflowX = soloOverflowX;
  });
}

function setupChallengesModalResponsiveLayout(modalRef, contentRoot, initChromeFn) {
  clearChallengesModalLayoutCleanup();
  activeChallengesModal = modalRef;
  challengesModalChromeInitialized = false;
  const apply = () => {
    applyChallengesModalLayout(modalRef, contentRoot, getChallengesModalDimensions());
    if (!challengesModalChromeInitialized) {
      challengesModalChromeInitialized = true;
      const dialog = getChallengesDialog(modalRef);
      if (dialog && typeof initChromeFn === 'function') {
        initChromeFn(dialog);
      }
    }
  };
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  challengesModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (activeChallengesModal === modalRef) {
      activeChallengesModal = null;
    }
    challengesModalChromeInitialized = false;
    if (window.__challengesFooterQueueIntervalId) {
      clearInterval(window.__challengesFooterQueueIntervalId);
      window.__challengesFooterQueueIntervalId = null;
    }
    if (typeof window !== 'undefined') window.__challengesSyncFooter = null;
    if (typeof window !== 'undefined') {
      window.__challengesRunMultiplayerRoll = null;
      window.__challengesMpSetRollResult = null;
    }
  };
}

function openModal(challengesApi, { title, width, height, content, buttons }) {
  const options = { title, content, buttons: buttons || [] };
  if (width != null) options.width = width;
  if (height != null && height !== undefined) options.height = height;

  if (challengesApi && challengesApi.ui && challengesApi.ui.components && challengesApi.ui.components.createModal) {
    return challengesApi.ui.components.createModal(options);
  }
  if (challengesApi && typeof challengesApi.showModal === 'function') {
    return challengesApi.showModal(options);
  }
  return null;
}

function openChallengesModal(initialTabIndex) {
  if (!context.api || (
    typeof context.api.showModal !== 'function' &&
    (!context.api.ui || !context.api.ui.components)
  )) {
    console.error('[Challenges Mod] API not available');
    return;
  }
  const api = context.api;
  const t = function (k) {
    return challengesModTranslate(k, CHALLENGES_I18N_FALLBACK[k]);
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
  wrapper.className = 'challenges-modal-content';
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
          var sortedKeys = [a.key, b.key].sort();
          var matchId = sortedKeys.join('_');
          var now = Date.now();
          var matchPayload = {
            player1: a.key === sortedKeys[0] ? a.playerName : b.playerName,
            player2: a.key === sortedKeys[0] ? b.playerName : a.playerName,
            player1Key: sortedKeys[0],
            player2Key: sortedKeys[1],
            createdAt: now,
            acceptances: {},
            chosenRoomId: null,
            chosenRoomName: null,
            chosenVillainSpecs: null,
            chosenAllyGameIds: null,
            chosenAllyEquips: null,
            chosenAt: null
          };
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
    } else if (state.bothAccepted && state.matchId && !challengeMultiplayerContext) {
      console.log('[Challenges MP]','panel open: both accepted, resuming match roll');
      challengeMpRollStartedForMatchId = null;
      challengeMpRollWriteStartedForMatchId = null;
      handleMultiplayerMatchReady(state.matchId, state.myKey);
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
  soloPanel.className = 'challenges-solo-panel';
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

  // Multiplayer panel: same three-column layout as solo (DOM built after shared column helpers)
  const multiplayerPanel = document.createElement('div');
  multiplayerPanel.className = 'challenges-mp-panel';
  Object.assign(multiplayerPanel.style, {
    display: 'none',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: '0',
    minHeight: '0',
    flex: '1 1 0'
  });
  var mpLeaderboardBody;
  var mpCreaturesListEl;
  function buildMultiplayerRatingTable(entries) {
    var currentName = (getCurrentPlayerName() || '').trim();
    var table = document.createElement('div');
    table.style.cssText = 'display:table; width:100%; font-size:12px; border-collapse:collapse;';
    var thead = document.createElement('div');
    thead.style.cssText = 'display:table-row; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + ';';
    [t('mods.challenges.multiplayer.leaderboardRank'), t('mods.challenges.labels.name'), t('mods.challenges.multiplayer.matches'), t('mods.challenges.multiplayer.rating')].forEach(function(label) {
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
        var blueBg = 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png';
        [rankCell, nameCell, matchesCell, ratingCell].forEach(function(c) {
          c.style.backgroundImage = 'url(' + blueBg + ')';
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
    if (!mpLeaderboardBody) return;
    mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loading') + '</p>';
    loadMultiplayerRatingLeaderboard().then(function(entries) {
      if (!mpLeaderboardBody) return;
      mpLeaderboardBody.innerHTML = '';
      if (!entries || entries.length === 0) {
        mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + (t('mods.challenges.multiplayer.noPlayersYet') || 'No players yet. Complete a match to appear here.') + '</p>';
        return;
      }
      mpLeaderboardBody.appendChild(buildMultiplayerRatingTable(entries));
    }).catch(function() {
      if (mpLeaderboardBody) mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + (t('mods.challenges.loadingError') || 'Could not load leaderboard.') + '</p>';
    });
  }
  if (typeof window !== 'undefined') window.__challengesRefreshMultiplayerLeaderboard = refreshMultiplayerLeaderboard;

  // Help panel: two columns (Solo left, Multiplayer right)
  const pointsPanel = document.createElement('div');
  Object.assign(pointsPanel.style, {
    display: 'none',
    flex: '1 1 0',
    minHeight: '0',
    overflow: 'hidden',
    flexDirection: 'row',
    padding: '6px',
    gap: '8px'
  });
  var hp = 'mods.challenges.helpPanel.';
  var helpTitleP = 'margin:0 0 4px 0; color:' + CHALLENGE_COLORS.PRIMARY + '; font-weight:bold; font-size:14px; line-height:1.25;';
  var helpBlockP = 'margin:0 0 6px 0; font-size:13px; line-height:1.3;';
  var helpSubP = 'margin:0 0 3px 0; font-size:13px; line-height:1.3;';
  var helpEndP = 'margin:0; font-size:13px; line-height:1.3;';
  var helpList = 'margin:0 0 6px 0; padding-left:16px; font-size:13px; line-height:1.25;';
  var soloBodyHtml = [
    '<p style="' + helpTitleP + '">' + t(hp + 'howToPlayTitle') + '</p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'howToPlayText') + '</p>',
    '<p style="' + helpTitleP + '">' + t(hp + 'playerArsenalTitle') + '</p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'playerArsenalText') + '</p>',
    '<p style="' + helpTitleP + '">' + t(hp + 'title') + '</p>',
    '<p style="' + helpSubP + '"><strong>' + t(hp + 'formula') + '</strong></p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'formulaText') + '</p>',
    '<p style="' + helpSubP + '"><strong>' + t(hp + 'gradeBonus') + '</strong></p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'gradeDescription') + '</p>',
    '<ul style="' + helpList + '">',
    '<li style="margin:0;">' + t(hp + 'gradeSPlus') + '</li>',
    '<li style="margin:0;">' + t(hp + 'gradeS') + '</li>',
    '<li style="margin:0;">' + t(hp + 'gradeA') + '</li>',
    '<li style="margin:0;">' + t(hp + 'gradeB') + '</li>',
    '<li style="margin:0;">' + t(hp + 'gradeC') + '</li>',
    '<li style="margin:0;">' + t(hp + 'gradeD') + '</li>',
    '<li style="margin:0;">' + t(hp + 'gradeF') + '</li>',
    '</ul>',
    '<p style="' + helpSubP + '"><strong>' + t(hp + 'arsenalBonusTitle') + '</strong></p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'arsenalBonusText') + '</p>',
    '<p style="' + helpSubP + '"><strong>' + t(hp + 'difficultyMultiplier') + '</strong></p>',
    '<p style="' + helpEndP + '">' + t(hp + 'difficultyMultiplierDescription').replace('^{power}', '^' + CHALLENGE_DIFFICULTY_POWER) + '</p>'
  ].join('');
  var mpBodyHtml = [
    '<p style="' + helpTitleP + '">' + t(hp + 'mpHowToPlayTitle') + '</p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'mpHowToPlayText') + '</p>',
    '<p style="' + helpTitleP + '">' + t(hp + 'mpSharedArsenalTitle') + '</p>',
    '<p style="' + helpBlockP + '">' + t(hp + 'mpSharedArsenalText') + '</p>',
    '<p style="' + helpTitleP + '">' + t(hp + 'mpRatingTitle') + '</p>',
    '<p style="' + helpEndP + '">' + t(hp + 'mpRatingText') + '</p>'
  ].join('');
  var soloHelpBox = createPlaceholderBox(t(hp + 'soloTitle'), soloBodyHtml);
  var mpHelpBox = createPlaceholderBox(t(hp + 'mpTitle'), mpBodyHtml);
  var helpBodyCompact = 'padding: 6px 10px; font-size: 12px; line-height: 1.25;';
  [soloHelpBox, mpHelpBox].forEach(function(box) {
    var body = box.querySelector('.widget-bottom');
    if (body) body.style.cssText = helpBodyCompact + ' flex: 1 1 0; overflow-y: auto; color: ' + CHALLENGE_COLORS.SECONDARY + '; min-height: 0; background: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat;';
    var title = box.querySelector('.widget-top');
    if (title) title.style.padding = '1px 6px';
  });
  Object.assign(soloHelpBox.style, { flex: '1 1 0', minWidth: '0', minHeight: '0', overflow: 'auto' });
  Object.assign(mpHelpBox.style, { flex: '1 1 0', minWidth: '0', minHeight: '0', overflow: 'auto' });
  pointsPanel.appendChild(soloHelpBox);
  pointsPanel.appendChild(mpHelpBox);

  contentArea.appendChild(soloPanel);
  contentArea.appendChild(multiplayerPanel);
  contentArea.appendChild(pointsPanel);
  wrapper.appendChild(contentArea);

  var challengesActiveTabIndex = 0;
  var syncChallengesFooterForActiveTab = function() {};
  function setActiveTab(idx) {
    challengesActiveTabIndex = idx;
    tabButtons.forEach(function(btn, i) {
      btn.classList.toggle('active', i === idx);
    });
    soloPanel.style.display = idx === 0 ? 'flex' : 'none';
    multiplayerPanel.style.display = idx === 1 ? 'flex' : 'none';
    pointsPanel.style.display = idx === 2 ? 'flex' : 'none';
    if (idx === 1 && typeof window !== 'undefined' && window.__challengesRefreshMultiplayerLeaderboard) window.__challengesRefreshMultiplayerLeaderboard();
    syncChallengesFooterForActiveTab();
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

  // Summary elements – created first so Col1/Col2 roll handlers can update them
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

  // Col1: Summary (map + stats), then player arsenal
  const leftCol = document.createElement('div');
  leftCol.className = 'challenges-col-left';
  Object.assign(leftCol.style, {
    width: COL1_WIDTH + 'px',
    minWidth: COL1_WIDTH + 'px',
    flex: '0 0 ' + COL1_WIDTH + 'px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflow: 'hidden',
    minHeight: '0'
  });

  var PLACEHOLDER_ICONS = {
    map: 'https://bestiaryarena.com/assets/icons/minotaurstatue.png',
    creature: 'https://bestiaryarena.com/assets/icons/minotaurstatue.png',
    equip: 'https://bestiaryarena.com/assets/icons/empty-equip.png',
    stats: 'https://bestiaryarena.com/assets/icons/spellbook.png'
  };

  const mapResultContainer = document.createElement('div');
  mapResultContainer.style.cssText = 'margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;';

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

  const summaryBox = createPlaceholderBox(t('mods.challenges.summary'), '');
  applyChallengesCol1BoxLayout(summaryBox, 11);
  const summaryBody = summaryBox.querySelector('.widget-bottom');
  summaryBody.innerHTML = '';
  summaryBody.style.display = 'flex';
  summaryBody.style.flexDirection = 'column';
  summaryBody.style.gap = '6px';
  summaryBody.appendChild(mapResultContainer);
  summaryBody.appendChild(summaryCreaturesEl);
  summaryBody.appendChild(summaryDifficultyEl);
  summaryBody.appendChild(summaryExpectedScoreEl);
  leftCol.appendChild(summaryBox);

  const playerArsenalContainer = document.createElement('div');
  playerArsenalContainer.style.cssText = 'margin: 0; display: flex; flex-direction: column; gap: 4px;';
  const playerArsenalBox = createPlaceholderBox(t('mods.challenges.playerArsenal'), '');
  applyChallengesCol1BoxLayout(playerArsenalBox, 9);
  playerArsenalBox.querySelector('.widget-bottom').appendChild(playerArsenalContainer);
  renderPlayerArsenalPanel(playerArsenalContainer, null, null);
  leftCol.appendChild(playerArsenalBox);

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
        return rollRandomCreatureSpec(gameId);
      });
      var diff = computeChallengeDifficulty(rolledCreatureSpecs);
      if (walkableCount <= 0) break;
      var villainsToPlace = Math.min(rolledCreatureSpecs.length, walkableCount);
      if (villainsToPlace + diff.alliesAllowed <= walkableCount) break;
    } while (attempt < maxAttempts);
    clearChallengePlayerArsenalRoll();
    return rolledCreatureSpecs;
  }

  function rollMapHandler() {
    console.log('[Challenges Mod] rollMapHandler() called');
    try {
      computeMapRoll();
      setMapResultToRolled(rolledRoomId, rolledRoomName);
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
    var awakenMult = spec.awakened === true ? CHALLENGE_AWAKEN_DIFFICULTY_MULT : 1;
    var difficultyTooltip = 'Difficulty: ' + difficultyContrib;
    if (creatureMult !== 1) difficultyTooltip += ' (creature ×' + creatureMult + ')';
    if (equipMult !== 1) difficultyTooltip += ' (equip ×' + equipMult + ')';
    if (awakenMult !== 1) difficultyTooltip += ' (awaken ×' + awakenMult + ')';

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
    nameP.style.cssText = 'margin: 0; font-size: 11px; font-weight: bold; text-align: center; line-height: 1.2; display: inline-flex; align-items: center; justify-content: center; gap: 3px; flex-wrap: wrap;';
    nameP.textContent = name;
    if (spec.awakened === true) {
      var awakenImg = document.createElement('img');
      awakenImg.src = CHALLENGE_AWAKEN_ICON_URL;
      awakenImg.alt = 'Awakened';
      awakenImg.title = 'Awakened ability';
      awakenImg.className = 'pixelated';
      awakenImg.style.cssText = 'width: 10px; height: 10px; flex-shrink: 0;';
      nameP.appendChild(awakenImg);
    }
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

  function buildCompactEquipPortrait(equipSpec) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:1px; width:44px;';
    var eqName = getEquipmentName(equipSpec.gameId);
    var eqPoints = getPlayerArsenalEquipmentScorePoints(equipSpec);
    wrap.title = eqName + ' T' + (equipSpec.tier || 1);
    if (api && api.ui && api.ui.components && typeof api.ui.components.createItemPortrait === 'function') {
      try {
        var eqData = getState() && getState().utils && getState().utils.getEquipment ? getState().utils.getEquipment(equipSpec.gameId) : null;
        var itemId = (eqData && eqData.metadata && eqData.metadata.spriteId) ? eqData.metadata.spriteId : equipSpec.gameId;
        var equipPortrait = api.ui.components.createItemPortrait({
          itemId: itemId,
          tier: equipSpec.tier || 1,
          stat: equipSpec.stat || 'ad'
        });
        if (equipPortrait && equipPortrait.nodeType === 1) {
          var portraitEl = equipPortrait.tagName === 'BUTTON' && equipPortrait.firstChild ? equipPortrait.firstChild : equipPortrait;
          var portraitWrap = document.createElement('div');
          portraitWrap.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center;';
          portraitEl.style.position = 'relative';
          portraitWrap.appendChild(portraitEl);
          wrap.appendChild(portraitWrap);
        }
      } catch (e) {
        console.warn('[Challenges Mod] buildCompactEquipPortrait failed:', e);
      }
    }
    if (!wrap.firstChild) {
      var ph = document.createElement('div');
      ph.style.cssText = 'width:32px; height:32px; background:rgba(68,68,68,0.5); border:1px solid #555; border-radius:4px;';
      wrap.appendChild(ph);
    }
    var scoreEl = document.createElement('span');
    scoreEl.style.cssText = 'font-size:9px; line-height:1.1; color:' + CHALLENGE_COLORS.SECONDARY + '; text-align:center;';
    scoreEl.textContent = formatChallengePlayerArsenalItemScore(eqPoints);
    scoreEl.title = t('mods.challenges.arsenalItemScoreLabel') + ': ' + formatChallengePlayerArsenalItemScore(eqPoints);
    wrap.appendChild(scoreEl);
    return wrap;
  }

  function buildCompactPlayerCreatureRow(gameId) {
    var name = getCreatureName(gameId);
    var points = getPlayerArsenalCreatureScorePoints(gameId);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:6px; padding:2px 0; min-width:0;';
    row.title = name;
    var img = document.createElement('img');
    img.src = getCreaturePortraitUrl(gameId);
    img.alt = name;
    img.className = 'pixelated';
    img.style.cssText = 'width:28px; height:28px; object-fit:cover; border-radius:3px; border:1px solid #555; flex-shrink:0;';
    row.appendChild(img);
    var label = document.createElement('span');
    label.style.cssText = 'font-size:11px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;';
    label.textContent = name;
    row.appendChild(label);
    var scoreEl = document.createElement('span');
    scoreEl.style.cssText = 'font-size:10px; line-height:1.2; color:' + CHALLENGE_COLORS.SECONDARY + '; flex-shrink:0;';
    scoreEl.textContent = formatChallengePlayerArsenalItemScore(points);
    scoreEl.title = t('mods.challenges.arsenalItemScoreLabel') + ': ' + formatChallengePlayerArsenalItemScore(points);
    row.appendChild(scoreEl);
    return row;
  }

  function renderPlayerArsenalPanel(container, gameIds, equipSpecs, villainSpecs) {
    container.innerHTML = '';
    var specs = villainSpecs;
    if (!specs || !specs.length) specs = rolledCreatureSpecs;
    var arsenalCount = getChallengePlayerArsenalCount(specs);
    var enemyCount = specs && specs.length ? specs.length : 0;
    var ids = normalizeChallengeAllyGameIds(gameIds, arsenalCount);
    var equips = normalizeChallengeAllyEquips(equipSpecs, arsenalCount);
    if (!ids.length && !equips.length) {
      var empty = document.createElement('p');
      empty.style.cssText = 'margin:0; font-size:12px; color:#888; text-align:center;';
      empty.textContent = t('mods.challenges.playerArsenalEmpty');
      container.appendChild(empty);
      return;
    }
    var slotsEl = document.createElement('p');
    slotsEl.style.cssText = 'margin:0 0 6px 0; font-size:10px; color:' + CHALLENGE_COLORS.SECONDARY + '; text-align:center;';
    slotsEl.textContent = t('mods.challenges.playerArsenalSlots')
      .replace('{n}', String(arsenalCount))
      .replace('{enemies}', String(enemyCount));
    container.appendChild(slotsEl);
    if (ids.length) {
      var creaturesHeader = document.createElement('p');
      creaturesHeader.style.cssText = 'margin:0 0 4px 0; font-size:11px; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + ';';
      creaturesHeader.textContent = t('mods.challenges.playerArsenalCreatures') + ' (' + ids.length + ')';
      container.appendChild(creaturesHeader);
      var creaturesList = document.createElement('div');
      creaturesList.style.cssText = 'display:flex; flex-direction:column; gap:2px; margin-bottom:8px;';
      ids.forEach(function(gid) {
        creaturesList.appendChild(buildCompactPlayerCreatureRow(gid));
      });
      container.appendChild(creaturesList);
    }
    if (equips.length) {
      var equipHeader = document.createElement('p');
      equipHeader.style.cssText = 'margin:0 0 4px 0; font-size:11px; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + ';';
      equipHeader.textContent = t('mods.challenges.playerArsenalEquipment') + ' (' + equips.length + ')';
      container.appendChild(equipHeader);
      var equipGrid = document.createElement('div');
      equipGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;';
      equips.forEach(function(spec) {
        equipGrid.appendChild(buildCompactEquipPortrait(spec));
      });
      container.appendChild(equipGrid);
    }
  }

  function preparePlayerArsenalRollLayout(container, villainSpecs) {
    container.innerHTML = '';
    var specs = (villainSpecs && villainSpecs.length) ? villainSpecs : (rolledCreatureSpecs || []);
    var arsenalCount = getChallengePlayerArsenalCount(specs);
    var enemyCount = specs.length ? specs.length : 0;
    var slotsEl = document.createElement('p');
    slotsEl.style.cssText = 'margin:0 0 4px 0; font-size:10px; color:' + CHALLENGE_COLORS.SECONDARY + '; text-align:center;';
    slotsEl.textContent = t('mods.challenges.playerArsenalSlots')
      .replace('{n}', String(arsenalCount))
      .replace('{enemies}', String(enemyCount));
    container.appendChild(slotsEl);
    var rollingEl = document.createElement('p');
    rollingEl.style.cssText = 'margin:0 0 6px 0; font-size:11px; color:#888; text-align:center;';
    rollingEl.textContent = t('mods.challenges.playerArsenalRolling');
    rollingEl.dataset.role = 'arsenal-rolling-label';
    container.appendChild(rollingEl);
    var creaturesHeader = document.createElement('p');
    creaturesHeader.style.cssText = 'margin:0 0 4px 0; font-size:11px; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + ';';
    creaturesHeader.dataset.role = 'arsenal-creatures-header';
    creaturesHeader.textContent = t('mods.challenges.playerArsenalCreatures') + ' (0/' + arsenalCount + ')';
    container.appendChild(creaturesHeader);
    var creaturesList = document.createElement('div');
    creaturesList.style.cssText = 'display:flex; flex-direction:column; gap:2px; margin-bottom:8px;';
    creaturesList.dataset.role = 'arsenal-creatures-list';
    container.appendChild(creaturesList);
    var equipHeader = document.createElement('p');
    equipHeader.style.cssText = 'margin:0 0 4px 0; font-size:11px; font-weight:bold; color:' + CHALLENGE_COLORS.PRIMARY + '; display:none;';
    equipHeader.dataset.role = 'arsenal-equip-header';
    equipHeader.textContent = t('mods.challenges.playerArsenalEquipment') + ' (0/' + arsenalCount + ')';
    container.appendChild(equipHeader);
    var equipGrid = document.createElement('div');
    equipGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;';
    equipGrid.dataset.role = 'arsenal-equip-grid';
    container.appendChild(equipGrid);
    return {
      specs: specs,
      arsenalCount: arsenalCount,
      creaturesHeader: creaturesHeader,
      creaturesList: creaturesList,
      equipHeader: equipHeader,
      equipGrid: equipGrid,
      rollingEl: rollingEl
    };
  }

  function spinArsenalCreatureSlot(listEl, poolIds, finalGameId, durationMs) {
    if (rollState.skipRequested || !poolIds.length) {
      listEl.appendChild(buildCompactPlayerCreatureRow(finalGameId));
      return Promise.resolve();
    }
    var spinRow = document.createElement('div');
    spinRow.style.cssText = 'display:flex; align-items:center; gap:6px; padding:2px 0; min-width:0; opacity:0.85;';
    var img = document.createElement('img');
    img.className = 'pixelated';
    img.style.cssText = 'width:28px; height:28px; object-fit:cover; border-radius:3px; border:1px solid #555; flex-shrink:0;';
    var label = document.createElement('span');
    label.style.cssText = 'font-size:11px; line-height:1.2; color:#888; flex:1; min-width:0;';
    label.textContent = '…';
    spinRow.appendChild(img);
    spinRow.appendChild(label);
    listEl.appendChild(spinRow);
    return new Promise(function(resolve) {
      var interval = setInterval(function() {
        if (rollState.skipRequested) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          spinRow.replaceWith(buildCompactPlayerCreatureRow(finalGameId));
          resolve();
          return;
        }
        var spinId = poolIds[Math.floor(Math.random() * poolIds.length)];
        img.src = getCreaturePortraitUrl(spinId);
        label.textContent = getCreatureName(spinId);
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        spinRow.replaceWith(buildCompactPlayerCreatureRow(finalGameId));
        resolve();
      }, durationMs);
    });
  }

  function spinArsenalEquipSlot(gridEl, poolIds, finalSpec, durationMs) {
    if (rollState.skipRequested) {
      gridEl.appendChild(buildCompactEquipPortrait(finalSpec));
      return Promise.resolve();
    }
    var spinWrap = document.createElement('div');
    spinWrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px; width:40px; opacity:0.85;';
    var ph = document.createElement('div');
    ph.style.cssText = 'width:32px; height:32px; background:rgba(68,68,68,0.5); border:1px solid #555; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:14px; color:#888;';
    ph.textContent = '?';
    spinWrap.appendChild(ph);
    gridEl.appendChild(spinWrap);
    if (!poolIds.length) {
      spinWrap.replaceWith(buildCompactEquipPortrait(finalSpec));
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      var interval = setInterval(function() {
        if (rollState.skipRequested) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          spinWrap.replaceWith(buildCompactEquipPortrait(finalSpec));
          resolve();
          return;
        }
        ph.textContent = ph.textContent === '?' ? '…' : '?';
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        spinWrap.replaceWith(buildCompactEquipPortrait(finalSpec));
        resolve();
      }, durationMs);
    });
  }

  /** Roll (or reveal pre-rolled) player arsenal after villain specs are final. Animated unless skip. */
  function runPlayerArsenalRollSequence(container, villainSpecs, preRolledGameIds, preRolledEquips) {
    var specs = (villainSpecs && villainSpecs.length) ? villainSpecs : (rolledCreatureSpecs || []);
    if (!specs.length) {
      renderPlayerArsenalPanel(container, null, null, specs);
      return Promise.resolve();
    }
    var arsenalCount = getChallengePlayerArsenalCount(specs);
    var gameIds;
    var equips;
    if (preRolledGameIds != null && preRolledEquips != null) {
      gameIds = normalizeChallengeAllyGameIds(preRolledGameIds, arsenalCount);
      equips = normalizeChallengeAllyEquips(preRolledEquips, arsenalCount);
      rolledMapMaxCreatureMult = getMapMaxCreatureDifficultyMultiplier(specs);
      rolledAllyArsenalCount = arsenalCount;
      rolledAllyGameIds = gameIds;
      rolledAllyEquips = equips;
    } else {
      var rolled = rollChallengePlayerArsenal(specs);
      gameIds = rolled.gameIds;
      equips = rolled.equips;
    }
    if (rollState.skipRequested) {
      renderPlayerArsenalPanel(container, gameIds, equips, specs);
      return Promise.resolve();
    }
    var layout = preparePlayerArsenalRollLayout(container, specs);
    var creaturePool = getChallengePlayerArsenalCreatureGameIds();
    var equipPool = getAllEquipmentGameIds();
    function runCreatureSlots(index) {
      if (index >= gameIds.length) {
        layout.rollingEl.textContent = t('mods.challenges.playerArsenalEquipment') + '…';
        layout.equipHeader.style.display = '';
        return runEquipSlots(0);
      }
      return spinArsenalCreatureSlot(layout.creaturesList, creaturePool, gameIds[index], ARSENAL_ROLL_SLOT_DELAY_MS)
        .then(function() {
          layout.creaturesHeader.textContent = t('mods.challenges.playerArsenalCreatures') + ' (' + (index + 1) + '/' + gameIds.length + ')';
          return runCreatureSlots(index + 1);
        });
    }
    function runEquipSlots(index) {
      if (index >= equips.length) {
        if (layout.rollingEl.parentNode) layout.rollingEl.remove();
        renderPlayerArsenalPanel(container, gameIds, equips, specs);
        return Promise.resolve();
      }
      return spinArsenalEquipSlot(layout.equipGrid, equipPool, equips[index], ARSENAL_ROLL_SLOT_DELAY_MS)
        .then(function() {
          layout.equipHeader.textContent = t('mods.challenges.playerArsenalEquipment') + ' (' + (index + 1) + '/' + equips.length + ')';
          return runEquipSlots(index + 1);
        });
    }
    return runCreatureSlots(0);
  }

  function finalizeRollSummary(specs, gameIds, equips, summaryCreatures, summaryDifficulty, summaryExpected) {
    summaryCreatures.textContent = t('mods.challenges.creaturesLabel') + ' ' + specs.length;
    var diff = computeChallengeDifficulty(specs);
    var mult = getDifficultyMultiplier(diff.difficulty);
    var enemyCount = specs.length;
    summaryDifficulty.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
    summaryDifficulty.style.color = getDifficultyColor(mult) || '';
    if (summaryExpected) {
      summaryExpected.textContent = '~' + computeChallengeExpectedScore(diff.difficulty, 'A', 500, gameIds, equips, specs);
    }
  }

  function finalizeVillainRollSummary(specs, summaryCreatures, summaryDifficulty) {
    summaryCreatures.textContent = t('mods.challenges.creaturesLabel') + ' ' + specs.length;
    var diff = computeChallengeDifficulty(specs);
    var mult = getDifficultyMultiplier(diff.difficulty);
    var enemyCount = specs.length;
    summaryDifficulty.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
    summaryDifficulty.style.color = getDifficultyColor(mult) || '';
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

  /** Spin map reel then land on final room. Optional setRolledFn(roomId, roomName) for alternate target (e.g. multiplayer). */
  function spinMapReel(allRooms, finalRoomId, finalRoomName, durationMs, setRolledFn) {
    var setRolled = typeof setRolledFn === 'function' ? setRolledFn : setMapResultToRolled;
    if (!allRooms.length) {
      setRolled(finalRoomId, finalRoomName);
      return Promise.resolve();
    }
    if (rollState.skipRequested) {
      setRolled(finalRoomId, finalRoomName);
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      var interval = setInterval(function() {
        if (rollState.skipRequested) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          setRolled(finalRoomId, finalRoomName);
          resolve();
          return;
        }
        var r = allRooms[Math.floor(Math.random() * allRooms.length)];
        setRolled(r.roomId, r.roomName);
      }, ROLL_REEL_TICK_MS);
      var timeoutId = setTimeout(function() {
        clearInterval(interval);
        setRolled(finalRoomId, finalRoomName);
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
      runPlayerArsenalRollSequence(playerArsenalContainer, rolledCreatureSpecs).then(function() {
        finalizeRollSummary(
          rolledCreatureSpecs,
          rolledAllyGameIds,
          rolledAllyEquips,
          summaryCreaturesEl,
          summaryDifficultyValueSpan,
          summaryExpectedScoreValueSpan
        );
      });
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
    syncChallengesFooterForActiveTab();
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
    summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
    summaryDifficultyValueSpan.textContent = '— (— v —)';
    summaryDifficultyValueSpan.style.color = '';
    summaryExpectedScoreValueSpan.textContent = '—';
    renderPlayerArsenalPanel(playerArsenalContainer, null, null);
    var allRooms = getAllRoomsForReel();
    var creatureIds = getAllCreatureGameIds();
    function runCreatureSequence(index) {
      if (index >= specs.length) {
        return delay(ROLL_SLOT_DELAY_MS).then(function() {
          summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
          finalizeVillainRollSummary(specs, summaryCreaturesEl, summaryDifficultyValueSpan);
          summaryExpectedScoreValueSpan.textContent = '—';
          return runPlayerArsenalRollSequence(playerArsenalContainer, specs).then(function() {
            summaryExpectedScoreValueSpan.textContent = '~' + computeChallengeExpectedScore(
              computeChallengeDifficulty(specs).difficulty,
              'A',
              500,
              rolledAllyGameIds,
              rolledAllyEquips,
              specs
            );
            finishRollState();
            if (typeof onDone === 'function') onDone();
          });
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
        summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
        summaryDifficultyValueSpan.textContent = '— (— v —)';
        summaryExpectedScoreValueSpan.textContent = '—';
        renderPlayerArsenalPanel(playerArsenalContainer, null, null);
        finishRollState();
        if (typeof onDone === 'function') onDone();
        return;
      }
      runCreatureSequence(0);
    });
  }

  if (typeof window !== 'undefined') window.__challengesRunPredeterminedRoll = runPredeterminedRoll;

  var mpPlayerArsenalContainer;

  /** Run predetermined roll animation inside the Multiplayer panel (same flow as solo). Calls onDone() when finished. */
  function runMultiplayerPredeterminedRoll(roomId, roomName, specs, onDone, allyGameIds, allyEquips) {
    if (!specs || !Array.isArray(specs)) specs = [];
    var allRooms = getAllRoomsForReel();
    var creatureIds = getAllCreatureGameIds();
    mpSetMapResultText(t('mods.challenges.rolling'));
    mpCreaturesListEl.innerHTML = '';
    mpCreaturesListEl.textContent = t('mods.challenges.rolling');
    mpCreaturesListEl.style.textAlign = 'center';
    mpSummaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
    mpSummaryDifficultyValueSpan.textContent = '— (— v —)';
    mpSummaryDifficultyValueSpan.style.color = '';
    mpSummaryExpectedScoreValueSpan.textContent = '—';
    renderPlayerArsenalPanel(mpPlayerArsenalContainer, null, null);
    function runCreatureSequence(index) {
      if (index >= specs.length) {
        return delay(ROLL_SLOT_DELAY_MS).then(function() {
          mpSummaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
          finalizeVillainRollSummary(specs, mpSummaryCreaturesEl, mpSummaryDifficultyValueSpan);
          mpSummaryExpectedScoreValueSpan.textContent = '—';
          return runPlayerArsenalRollSequence(mpPlayerArsenalContainer, specs, allyGameIds, allyEquips).then(function() {
            mpSummaryExpectedScoreValueSpan.textContent = '~' + computeChallengeExpectedScore(
              computeChallengeDifficulty(specs).difficulty,
              'A',
              500,
              rolledAllyGameIds,
              rolledAllyEquips,
              specs
            );
            if (typeof onDone === 'function') onDone();
          });
        });
      }
      return spinCreatureReel(creatureIds, specs[index], mpCreaturesListEl, ROLL_SLOT_DELAY_MS)
        .then(function(card) { return spinEquipmentReel(card, specs[index], ROLL_SLOT_DELAY_MS); })
        .then(function() { return runCreatureSequence(index + 1); });
    }
    spinMapReel(allRooms, roomId, roomName || roomId, ROLL_SLOT_DELAY_MS, mpSetMapResultToRolled).then(function() {
      mpCreaturesListEl.textContent = '';
      mpCreaturesListEl.style.textAlign = '';
      if (specs.length === 0) {
        mpSummaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
        mpSummaryDifficultyValueSpan.textContent = '— (— v —)';
        mpSummaryExpectedScoreValueSpan.textContent = '—';
        renderPlayerArsenalPanel(mpPlayerArsenalContainer, null, null);
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
    summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
    summaryDifficultyValueSpan.textContent = '— (— v —)';
    summaryDifficultyValueSpan.style.color = '';
    summaryExpectedScoreValueSpan.textContent = '—';
    renderPlayerArsenalPanel(playerArsenalContainer, null, null);

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
            summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
            finalizeVillainRollSummary(specs, summaryCreaturesEl, summaryDifficultyValueSpan);
            summaryExpectedScoreValueSpan.textContent = '—';
            return runPlayerArsenalRollSequence(playerArsenalContainer, specs).then(function() {
              summaryExpectedScoreValueSpan.textContent = '~' + computeChallengeExpectedScore(
                computeChallengeDifficulty(specs).difficulty,
                'A',
                500,
                rolledAllyGameIds,
                rolledAllyEquips,
                specs
              );
              finishRollState();
            });
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
          summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
          summaryDifficultyValueSpan.textContent = '— (— v —)';
          summaryDifficultyValueSpan.style.color = '';
          summaryExpectedScoreValueSpan.textContent = '—';
          renderPlayerArsenalPanel(playerArsenalContainer, null, null);
          finishRollState();
          return;
        }
        runCreatureEquipmentSequence(0);
      });
    })();
  }

  // Col3: Global top 10 + Personal top 10 (two boxes)
  const rightCol = document.createElement('div');
  rightCol.className = 'challenges-col-right';
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
    var headers = showNameColumn ? [t('mods.challenges.labels.name'), t('mods.challenges.labels.map'), t('mods.challenges.labels.diff'), t('mods.challenges.labels.score'), ''] : [t('mods.challenges.labels.map'), t('mods.challenges.labels.diff'), t('mods.challenges.labels.score'), ''];
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
        nameCell.title = row.name ? t('mods.challenges.openProfileTitle').replace('{name}', row.name) : '';
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
      leaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.noRunsYet') + '</p>';
      return;
    }
    var globalTop10 = entries.slice(0, CHALLENGE_LEADERBOARD_TOP);
    leaderboardBody.appendChild(buildLeaderboardTable(globalTop10, true, true));
  }

  function renderPersonalLeaderboard(personalEntries) {
    personalLeaderboardBody.innerHTML = '';
    if (!personalEntries || !personalEntries.length) {
      personalLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.noPersonalRunsYet') + '</p>';
      return;
    }
    personalLeaderboardBody.appendChild(buildLeaderboardTable(personalEntries, false, false, true));
  }

  loadChallengeLeaderboard().then(function(entries) {
    renderChallengeLeaderboard(entries || []);
  }).catch(function() {
    leaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loadingError') + '</p>';
  });
  // Personal: only locally saved runs (localStorage), top 10
  var personalEntries = getPersonalRecordsFromStorage().slice(0, 10);
  renderPersonalLeaderboard(personalEntries);

  container.appendChild(leftCol);
  container.appendChild(middleCol);
  container.appendChild(rightCol);
  soloPanel.appendChild(container);

  // Multiplayer panel — same three-column layout as solo
  const mpContainer = document.createElement('div');
  Object.assign(mpContainer.style, {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: '0',
    minHeight: '0'
  });
  const mpSummaryCreaturesEl = document.createElement('p');
  mpSummaryCreaturesEl.style.margin = '0';
  mpSummaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' —';
  const mpSummaryDifficultyEl = document.createElement('p');
  mpSummaryDifficultyEl.style.margin = '0';
  mpSummaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
  mpSummaryDifficultyEl.appendChild(document.createTextNode(t('mods.challenges.difficultyLabel')));
  const mpSummaryDifficultyValueSpan = document.createElement('span');
  mpSummaryDifficultyValueSpan.textContent = '— (— v —)';
  mpSummaryDifficultyEl.appendChild(mpSummaryDifficultyValueSpan);
  const mpSummaryExpectedScoreEl = document.createElement('p');
  mpSummaryExpectedScoreEl.style.margin = '0';
  mpSummaryExpectedScoreEl.title = t('mods.challenges.expectedScoreTitle');
  mpSummaryExpectedScoreEl.appendChild(document.createTextNode(t('mods.challenges.expectedScoreLabel')));
  const mpSummaryExpectedScoreValueSpan = document.createElement('span');
  mpSummaryExpectedScoreValueSpan.textContent = '—';
  mpSummaryExpectedScoreEl.appendChild(mpSummaryExpectedScoreValueSpan);
  const mpMapResultContainer = document.createElement('div');
  mpMapResultContainer.setAttribute('data-mp-map-result', '1');
  mpMapResultContainer.style.cssText = 'margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;';
  function mpSetMapPlaceholder() {
    mpMapResultContainer.innerHTML = '';
    var thumb = document.createElement('div');
    thumb.style.cssText = 'width: 128px; height: 128px; background: rgba(68,68,68,0.5); border: 1px solid #555; border-radius: 4px; display: flex; align-items: center; justify-content: center;';
    var thumbImg = document.createElement('img');
    thumbImg.src = PLACEHOLDER_ICONS.map;
    thumbImg.alt = '';
    thumbImg.className = 'pixelated';
    thumbImg.style.cssText = 'width: 80px; height: 80px; object-fit: contain; opacity: 0.7;';
    thumb.appendChild(thumbImg);
    mpMapResultContainer.appendChild(thumb);
    var nameEl = document.createElement('p');
    nameEl.style.cssText = 'margin: 0; text-align: center; font-size: 14px; color: #888;';
    nameEl.textContent = '—';
    mpMapResultContainer.appendChild(nameEl);
  }
  function mpSetMapResultToRolled(roomId, roomName) {
    mpMapResultContainer.innerHTML = '';
    var img = document.createElement('img');
    img.src = getRoomThumbnailUrl(roomId);
    img.alt = roomName;
    img.className = 'pixelated';
    img.style.cssText = 'width: 128px; height: 128px; object-fit: cover; border: 1px solid #666; border-radius: 4px;';
    mpMapResultContainer.appendChild(img);
    var nameEl = document.createElement('p');
    nameEl.style.cssText = 'margin: 0; text-align: center; font-size: 14px;';
    nameEl.textContent = roomName || roomId;
    mpMapResultContainer.appendChild(nameEl);
  }
  function mpSetMapResultText(text) {
    mpMapResultContainer.innerHTML = '';
    mpMapResultContainer.textContent = text;
  }
  mpSetMapPlaceholder();
  mpPlayerArsenalContainer = document.createElement('div');
  mpPlayerArsenalContainer.style.cssText = 'margin: 0; display: flex; flex-direction: column; gap: 4px;';
  const mpLeftCol = document.createElement('div');
  mpLeftCol.className = 'challenges-col-left';
  Object.assign(mpLeftCol.style, {
    width: COL1_WIDTH + 'px',
    minWidth: COL1_WIDTH + 'px',
    flex: '0 0 ' + COL1_WIDTH + 'px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflow: 'hidden',
    minHeight: '0'
  });
  const mpSummaryBox = createPlaceholderBox(t('mods.challenges.summary'), '');
  applyChallengesCol1BoxLayout(mpSummaryBox, 11);
  const mpSummaryBody = mpSummaryBox.querySelector('.widget-bottom');
  mpSummaryBody.innerHTML = '';
  mpSummaryBody.style.display = 'flex';
  mpSummaryBody.style.flexDirection = 'column';
  mpSummaryBody.style.gap = '6px';
  mpSummaryBody.appendChild(mpMapResultContainer);
  mpSummaryBody.appendChild(mpSummaryCreaturesEl);
  mpSummaryBody.appendChild(mpSummaryDifficultyEl);
  mpSummaryBody.appendChild(mpSummaryExpectedScoreEl);
  mpLeftCol.appendChild(mpSummaryBox);
  const mpPlayerArsenalBox = createPlaceholderBox(t('mods.challenges.playerArsenal'), '');
  applyChallengesCol1BoxLayout(mpPlayerArsenalBox, 9);
  mpPlayerArsenalBox.querySelector('.widget-bottom').appendChild(mpPlayerArsenalContainer);
  renderPlayerArsenalPanel(mpPlayerArsenalContainer, null, null);
  mpLeftCol.appendChild(mpPlayerArsenalBox);
  const mpMiddleCol = document.createElement('div');
  Object.assign(mpMiddleCol.style, {
    flex: '1 1 0',
    minHeight: '0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflowY: 'auto'
  });
  const mpCreaturesBox = createPlaceholderBox(t('mods.challenges.creatures'), '');
  mpCreaturesListEl = document.createElement('div');
  mpCreaturesListEl.setAttribute('data-mp-creatures-list', '1');
  mpCreaturesListEl.style.cssText = 'margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;';
  mpCreaturesBox.querySelector('.widget-bottom').innerHTML = '';
  mpCreaturesBox.querySelector('.widget-bottom').appendChild(mpCreaturesListEl);
  mpCreaturesListEl.appendChild(buildBlankCreatureCard());
  mpMiddleCol.appendChild(mpCreaturesBox);
  const mpRightCol = document.createElement('div');
  mpRightCol.className = 'challenges-col-right';
  Object.assign(mpRightCol.style, {
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
  const mpLeaderboardBox = createPlaceholderBox(t('mods.challenges.multiplayer.leaderboardTitle'), '');
  mpLeaderboardBody = mpLeaderboardBox.querySelector('.widget-bottom');
  mpLeaderboardBody.innerHTML = '<p style="margin:0;color:#888;">' + t('mods.challenges.loading') + '</p>';
  mpRightCol.appendChild(mpLeaderboardBox);
  mpContainer.appendChild(mpLeftCol);
  mpContainer.appendChild(mpMiddleCol);
  mpContainer.appendChild(mpRightCol);
  multiplayerPanel.appendChild(mpContainer);
  refreshMultiplayerLeaderboard();
  if (typeof window !== 'undefined') {
    window.__challengesMpSetRollResult = function(roomId, roomName, villainSpecs, diff, expectedScore, allyGameIds, allyEquips) {
      mpSetMapResultToRolled(roomId, roomName || roomId);
      mpCreaturesListEl.innerHTML = '';
      if (villainSpecs && villainSpecs.length) {
        normalizeVillainSpecsArray(villainSpecs).forEach(function(spec) {
          mpCreaturesListEl.appendChild(buildCreatureCard(spec));
        });
      } else {
        mpCreaturesListEl.appendChild(buildBlankCreatureCard());
      }
      mpSummaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' ' + (villainSpecs && villainSpecs.length ? villainSpecs.length : '—');
      var multStr = (diff && typeof diff.difficulty === 'number') ? getDifficultyMultiplier(diff.difficulty).toFixed(2) : '—';
      var allies = (diff && diff.alliesAllowed != null) ? diff.alliesAllowed : '—';
      var nV = (villainSpecs && villainSpecs.length) ? villainSpecs.length : 0;
      mpSummaryDifficultyValueSpan.textContent = multStr + '× (' + allies + ' v ' + nV + ')';
      mpSummaryDifficultyValueSpan.style.color = multStr !== '—' ? (getDifficultyColor(parseFloat(multStr)) || '') : '';
      mpSummaryExpectedScoreValueSpan.textContent = expectedScore != null ? '~' + expectedScore : '—';
      renderPlayerArsenalPanel(mpPlayerArsenalContainer, allyGameIds, allyEquips, villainSpecs);
    };
  }

  function restoreLastRollInModal() {
    if (rolledRoomId && rolledRoomName) {
      setMapResultToRolled(rolledRoomId, rolledRoomName);
    }
    if (rolledCreatureSpecs && rolledCreatureSpecs.length) {
      creaturesListEl.innerHTML = '';
      rolledCreatureSpecs.forEach(function(spec) {
        creaturesListEl.appendChild(buildCreatureCard(spec));
      });
      summaryCreaturesEl.textContent = t('mods.challenges.creaturesLabel') + ' ' + rolledCreatureSpecs.length;
      var diff = computeChallengeDifficulty(rolledCreatureSpecs);
      var mult = getDifficultyMultiplier(diff.difficulty);
      var enemyCount = rolledCreatureSpecs.length;
      summaryDifficultyValueSpan.textContent = mult.toFixed(2) + '× (' + diff.alliesAllowed + ' v ' + enemyCount + ')';
      summaryDifficultyValueSpan.style.color = getDifficultyColor(mult) || '';
      summaryDifficultyEl.title = t('mods.challenges.alliesVsEnemiesTitle');
      summaryExpectedScoreValueSpan.textContent = '~' + computeChallengeExpectedScore(diff.difficulty, 'A', 500, rolledAllyGameIds, rolledAllyEquips, rolledCreatureSpecs);
      renderPlayerArsenalPanel(playerArsenalContainer, rolledAllyGameIds, rolledAllyEquips, rolledCreatureSpecs);
    }
  }
  restoreLastRollInModal();
  updateChallengesStartButtonState();

  // Roll (map + creatures) / Start as modal footer buttons. Start: close modal then run challenge (sandbox + execute).
  var CHALLENGE_GREEN_BG = 'https://bestiaryarena.com/_next/static/media/background-green.be515334.png';
  var CHALLENGE_BLUE_BG = 'https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png';
  var CHALLENGE_RED_BG = 'https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png';

  function initializeChallengesModalChrome(dialog) {
    if (!dialog) return;
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
    var randomizeBtn = getChallengesRollButton();
    if (randomizeBtn) {
      randomizeBtn.style.backgroundImage = 'url(' + CHALLENGE_BLUE_BG + ')';
      randomizeBtn.style.backgroundSize = 'cover';
      randomizeBtn.style.backgroundPosition = 'center';
      randomizeBtn.style.color = (CHALLENGE_COLORS && CHALLENGE_COLORS.TEXT) || '#fff';
    }
    if (typeof window !== 'undefined') {
      window.__challengesMultiplayerUpdateHeaderButton = function() {
        updateChallengesNavHeaderMatchAlert();
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
      syncChallengesFooterForActiveTab = function() {
        var idx = challengesActiveTabIndex;
        var randomizeBtn = getChallengesRollButton();
        var startBtn = getChallengesStartButton();
        var footerQueueEl = document.querySelector('[data-challenges-footer-queue-count]');
        if (footerQueueEl) footerQueueEl.style.display = (idx === 1) ? '' : 'none';
        if (startBtn) {
          if (idx === 1) {
            startBtn.style.display = 'none';
          } else {
            startBtn.style.display = '';
            if (idx === 0) {
              updateChallengesStartButtonState();
            } else {
              startBtn.disabled = true;
              startBtn.style.opacity = '0.5';
              startBtn.style.pointerEvents = 'none';
              startBtn.style.cursor = 'not-allowed';
            }
          }
        }
        if (!randomizeBtn) return;
        if (idx === 1) {
          if (window.__challengesMultiplayerUpdateHeaderButton) {
            window.__challengesMultiplayerUpdateHeaderButton();
          } else {
            randomizeBtn.textContent = t('mods.challenges.multiplayer.joinQueue');
            randomizeBtn.disabled = false;
            randomizeBtn.style.opacity = '';
            randomizeBtn.style.pointerEvents = '';
            randomizeBtn.style.cursor = '';
          }
          return;
        }
        if (idx === 0 && !rollState.isRolling) {
          randomizeBtn.textContent = t('mods.challenges.randomize');
          randomizeBtn.disabled = false;
          randomizeBtn.style.opacity = '';
          randomizeBtn.style.pointerEvents = '';
          randomizeBtn.style.cursor = '';
          return;
        }
        if (idx === 0) return;
        randomizeBtn.disabled = true;
        randomizeBtn.style.opacity = '0.5';
        randomizeBtn.style.pointerEvents = 'none';
        randomizeBtn.style.cursor = 'not-allowed';
      };
      if (typeof window !== 'undefined') window.__challengesSyncFooter = syncChallengesFooterForActiveTab;
    }
    setActiveTab(challengesActiveTabIndex);
  }

  if (initialTabIndex === 1) {
    challengesActiveTabIndex = 1;
    soloPanel.style.display = 'none';
    multiplayerPanel.style.display = 'flex';
    pointsPanel.style.display = 'none';
    tabButtons.forEach(function(btn, i) { btn.classList.toggle('active', i === 1); });
  }

  createMultiplayerQueuePanel();

  const modalDimensions = getChallengesModalDimensions();
  const modalRef = openModal(api, {
    title: t('mods.challenges.title'),
    width: modalDimensions.width,
    height: modalDimensions.height,
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
          clearChallengesModalLayoutCleanup();
          if (modalObj && typeof modalObj.close === 'function') modalObj.close();
          startChallenge();
        },
        closeOnClick: false
      },
      {
        text: t('mods.challenges.close'),
        primary: false,
        onClick: function() {
          clearChallengesModalLayoutCleanup();
        }
      }
    ]
  });

  setupChallengesModalResponsiveLayout(modalRef, wrapper, initializeChallengesModalChrome);
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
let rolledAllyGameIds = null;
let rolledAllyEquips = null;
let rolledMapMaxCreatureMult = null;
let rolledAllyArsenalCount = null;
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
function isChallengeSpawnCreatureName(creatureName) {
  if (!creatureName || typeof creatureName !== 'string') return true;
  var lname = creatureName.toLowerCase().trim();
  for (var i = 0; i < CHALLENGE_BLOCKED_SPAWN_CREATURE_NAMES.length; i++) {
    if (CHALLENGE_BLOCKED_SPAWN_CREATURE_NAMES[i].toLowerCase() === lname) return false;
  }
  return true;
}

function filterChallengeSpawnCreatureIds(ids) {
  if (!ids || !ids.length) return [];
  return ids.filter(function(gameId) {
    return isChallengeSpawnCreatureName(getCreatureName(gameId));
  });
}

function getAllCreatureGameIds() {
  var ids = [];
  try {
    var state = getState();
    var getMonster = state?.utils?.getMonster;
    if (getMonster) {
      for (var i = 1; i <= CHALLENGE_CREATURE_GAMEID_MAX; i++) {
        try {
          var monster = getMonster(i);
          if (monster && monster.metadata && monster.metadata.name && isChallengeSpawnCreatureName(monster.metadata.name)) {
            ids.push(i);
          }
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
        var fallbackIds = list
          .filter(function(m) {
            return m && typeof m.gameId === 'number' && isChallengeSpawnCreatureName(m.name || m.metadata && m.metadata.name);
          })
          .map(function(m) { return m.gameId; });
        console.log('[Challenges Mod] getAllCreatureGameIds: fallback creatureDatabase, count =', fallbackIds.length);
        return fallbackIds;
      }
    }
  } catch (e) {
    console.warn('[Challenges Mod] getAllCreatureGameIds error:', e);
  }
  return filterChallengeSpawnCreatureIds(ids);
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

var challengePlayerArsenalBackup = null;
var challengePendingPlayerArsenal = null;
var challengeActivePlayerArsenal = null;
var challengeActiveVillainSpecs = null;
var challengePlayerArsenalNavigationUnsub = null;
var challengePlayerArsenalApplyTimeoutId = null;

function generateChallengePlayerMonsterId(index) {
  var rand = Math.random().toString(36).slice(2, 10);
  return 'ch-' + Date.now().toString(36) + '-' + index + '-' + rand;
}

function generateChallengePlayerEquipId(index) {
  var rand = Math.random().toString(36).slice(2, 10);
  return 'che-' + Date.now().toString(36) + '-' + index + '-' + rand;
}

function getAllEquipmentGameIds() {
  var ids = [];
  try {
    var state = getState();
    var getEquipment = state && state.utils && state.utils.getEquipment;
    if (getEquipment) {
      for (var i = 1; i <= CHALLENGE_EQUIP_GAMEID_MAX; i++) {
        try {
          var eq = getEquipment(i);
          if (eq && eq.metadata && eq.metadata.name) ids.push(i);
        } catch (_) {
          break;
        }
      }
    }
  } catch (e) {
    console.warn('[Challenges Mod] getAllEquipmentGameIds error:', e);
  }
  return ids;
}

function getChallengeRandomEquipTier() {
  return getRandomInt(CHALLENGE_EQUIP_TIER_MIN, CHALLENGE_EQUIP_TIER_MAX);
}

function getChallengeRandomEquipStat() {
  return CHALLENGE_EQUIP_STATS[Math.floor(Math.random() * CHALLENGE_EQUIP_STATS.length)];
}

function getChallengePlayerLevelExp() {
  try {
    var state = getState();
    if (state && state.utils && typeof state.utils.expAtLevel === 'function') {
      return state.utils.expAtLevel(CHALLENGE_PLAYER_LEVEL);
    }
  } catch (e) {}
  return 0;
}

function pickRandomUniqueChallengePlayerGameIds(count) {
  var pool = getChallengePlayerArsenalCreatureGameIds();
  if (!pool || !pool.length) return [];
  if (pool.length >= count) {
    return pickRandomFromArray(pool, count);
  }
  var out = pickRandomFromArray(pool, pool.length);
  while (out.length < count) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}

function getChallengePlayerArsenalCreatureGameIds() {
  return getAllCreatureGameIds().filter(function(gameId) {
    var name = getCreatureName(gameId);
    if (!name) return false;
    if (name.toLowerCase().indexOf('gazer') !== -1) return false;
    return isCreatureAwakenable(gameId);
  });
}

function normalizeChallengeAllyGameIds(raw, maxCount) {
  if (raw == null) return [];
  var ids = Array.isArray(raw)
    ? raw.slice()
    : (typeof raw === 'object'
      ? Object.keys(raw).sort(function(a, b) { return Number(a) - Number(b); }).map(function(k) { return raw[k]; })
      : []);
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var n = Number(ids[i]);
    if (!Number.isFinite(n)) continue;
    var name = getCreatureName(n);
    if (!name || name.toLowerCase().indexOf('gazer') !== -1 || !isCreatureAwakenable(n)) continue;
    out.push(n);
  }
  var limit = maxCount != null ? maxCount : getChallengePlayerArsenalCount();
  return out.slice(0, limit);
}

function clearChallengePlayerArsenalRoll() {
  rolledAllyGameIds = null;
  rolledAllyEquips = null;
  rolledMapMaxCreatureMult = null;
  rolledAllyArsenalCount = null;
}

function rollChallengePlayerArsenal(villainSpecs) {
  var specs = villainSpecs;
  if (!specs || !specs.length) {
    if (rolledCreatureSpecs && rolledCreatureSpecs.length) specs = rolledCreatureSpecs;
  }
  if (!specs || !specs.length) {
    clearChallengePlayerArsenalRoll();
    return { gameIds: [], equips: [], count: 0, mapMax: 1 };
  }
  var arsenalCount = getChallengePlayerArsenalCount(specs);
  rolledMapMaxCreatureMult = getMapMaxCreatureDifficultyMultiplier(specs);
  rolledAllyArsenalCount = arsenalCount;
  rolledAllyGameIds = pickRandomUniqueChallengePlayerGameIds(arsenalCount);
  rolledAllyEquips = pickRandomChallengePlayerEquips(arsenalCount);
  console.log('[Challenges Mod] player arsenal rolled:', arsenalCount, 'slots (2×', specs.length, 'enemies)');
  return {
    gameIds: rolledAllyGameIds,
    equips: rolledAllyEquips,
    count: arsenalCount,
    mapMax: rolledMapMaxCreatureMult
  };
}

function pickRandomChallengePlayerEquips(count) {
  var pool = getAllEquipmentGameIds();
  if (!pool.length) return [];
  var out = [];
  for (var i = 0; i < count; i++) {
    out.push({
      gameId: pool[Math.floor(Math.random() * pool.length)],
      stat: getChallengeRandomEquipStat(),
      tier: getChallengeRandomEquipTier()
    });
  }
  return out;
}

function normalizeChallengeAllyEquips(raw, maxCount) {
  if (raw == null) return [];
  var list = Array.isArray(raw)
    ? raw.slice()
    : (typeof raw === 'object'
      ? Object.keys(raw).sort(function(a, b) { return Number(a) - Number(b); }).map(function(k) { return raw[k]; })
      : []);
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var spec = list[i];
    if (!spec || spec.gameId == null) continue;
    var gameId = Number(spec.gameId);
    if (!Number.isFinite(gameId)) continue;
    var stat = CHALLENGE_EQUIP_STATS.indexOf(spec.stat) >= 0 ? spec.stat : CHALLENGE_EQUIP_STATS[0];
    var tier = CHALLENGE_EQUIP_TIER_MIN;
    if (spec.tier != null) {
      tier = Math.min(CHALLENGE_EQUIP_TIER_MAX, Math.max(CHALLENGE_EQUIP_TIER_MIN, Number(spec.tier) || CHALLENGE_EQUIP_TIER_MIN));
    }
    out.push({ gameId: gameId, stat: stat, tier: tier });
  }
  var limit = maxCount != null ? maxCount : getChallengePlayerArsenalCount();
  return out.slice(0, limit);
}

function buildChallengePlayerEquips(equipSpecs) {
  return equipSpecs.map(function(spec, index) {
    return {
      id: generateChallengePlayerEquipId(index),
      gameId: spec.gameId,
      stat: spec.stat,
      tier: spec.tier
    };
  });
}

function countRawFirebaseArray(raw) {
  if (raw == null) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === 'object') return Object.keys(raw).length;
  return 0;
}

function getMatchRollSyncState(match) {
  var specs = normalizeVillainSpecsArray(match && match.chosenVillainSpecs);
  var arsenalCount = specs.length ? getChallengePlayerArsenalCount(specs) : 0;
  var rawIdCount = countRawFirebaseArray(match && match.chosenAllyGameIds);
  var rawEquipCount = countRawFirebaseArray(match && match.chosenAllyEquips);
  var allyIds = normalizeChallengeAllyGameIds(match && match.chosenAllyGameIds, arsenalCount);
  var allyEquips = normalizeChallengeAllyEquips(match && match.chosenAllyEquips, arsenalCount);
  var complete = !!(match && match.chosenRoomId && specs.length > 0
    && rawIdCount >= arsenalCount && rawEquipCount >= arsenalCount);
  var stale = !!(match && match.chosenRoomId && specs.length > 0 && match.createdAt
    && (!match.chosenAt || match.chosenAt < match.createdAt));
  return {
    specs: specs,
    arsenalCount: arsenalCount,
    rawIdCount: rawIdCount,
    rawEquipCount: rawEquipCount,
    allyIds: allyIds,
    allyEquips: allyEquips,
    complete: complete,
    stale: stale,
    roomId: match && match.chosenRoomId,
    roomName: match && match.chosenRoomName,
    chosenAt: match && match.chosenAt
  };
}

function isChallengePlayerArsenalReady(gameIds, equipSpecs, villainSpecs) {
  var count = getChallengePlayerArsenalCount(villainSpecs);
  return countRawFirebaseArray(gameIds) >= count && countRawFirebaseArray(equipSpecs) >= count;
}

function scheduleSyncedMultiplayerRoll(chosenAt, fn) {
  var base = (typeof chosenAt === 'number' && chosenAt > 0) ? chosenAt : Date.now();
  var syncAt = base + CHALLENGE_MP_ROLL_SYNC_DELAY_MS;
  var delay = Math.max(0, syncAt - Date.now());
  console.log('[Challenges MP] synced roll starts in', delay, 'ms');
  setTimeout(fn, delay);
}

function buildChallengePlayerMonsters(gameIds) {
  var exp = getChallengePlayerLevelExp();
  var now = Date.now();
  return gameIds.map(function(gameId, index) {
    return {
      id: generateChallengePlayerMonsterId(index),
      gameId: gameId,
      hp: CHALLENGE_PLAYER_GENE_VALUE,
      ad: CHALLENGE_PLAYER_GENE_VALUE,
      ap: CHALLENGE_PLAYER_GENE_VALUE,
      armor: CHALLENGE_PLAYER_GENE_VALUE,
      magicResist: CHALLENGE_PLAYER_GENE_VALUE,
      exp: exp,
      tier: 6,
      shiny: true,
      awaken: true,
      awakened: true,
      isAwakened: true,
      locked: false,
      createdAt: now + index
    };
  });
}

function backupChallengePlayerArsenalIfNeeded() {
  if (challengePlayerArsenalBackup) return;
  try {
    var state = getState();
    var player = state && state.player;
    if (!player || typeof player.getSnapshot !== 'function') return;
    var ctx = player.getSnapshot().context;
    if (!ctx) return;
    challengePlayerArsenalBackup = {
      monsters: JSON.parse(JSON.stringify(Array.isArray(ctx.monsters) ? ctx.monsters : [])),
      equips: JSON.parse(JSON.stringify(Array.isArray(ctx.equips) ? ctx.equips : []))
    };
  } catch (e) {
    console.warn('[Challenges Mod] backupChallengePlayerArsenalIfNeeded:', e);
  }
}

function applyChallengePlayerArsenal(gameIds, equipSpecs, skipBackup, villainSpecs) {
  var payloadCount = Math.max(countRawFirebaseArray(gameIds), countRawFirebaseArray(equipSpecs));
  var arsenalCount = payloadCount > 0
    ? payloadCount
    : getChallengePlayerArsenalCount(villainSpecs);
  var ids = normalizeChallengeAllyGameIds(gameIds, arsenalCount);
  if (ids.length < arsenalCount) {
    ids = pickRandomUniqueChallengePlayerGameIds(arsenalCount);
  }
  var equips = normalizeChallengeAllyEquips(equipSpecs, arsenalCount);
  if (equips.length < arsenalCount) {
    equips = pickRandomChallengePlayerEquips(arsenalCount);
  }
  if (!ids.length) {
    console.warn('[Challenges Mod] applyChallengePlayerArsenal: no creature ids available');
    return false;
  }
  if (!equips.length) {
    console.warn('[Challenges Mod] applyChallengePlayerArsenal: no equipment available');
    return false;
  }
  if (!skipBackup) backupChallengePlayerArsenalIfNeeded();
  var monsters = buildChallengePlayerMonsters(ids);
  var playerEquips = buildChallengePlayerEquips(equips);
  try {
    var state = getState();
    if (!state || !state.player || typeof state.player.send !== 'function') return false;
    state.player.send({
      type: 'setState',
      fn: function(prev) {
        return Object.assign({}, prev, { monsters: monsters, equips: playerEquips });
      }
    });
    console.log('[Challenges Mod] applyChallengePlayerArsenal:', ids.length, 'creatures,', playerEquips.length, 'equips');
    challengeActivePlayerArsenal = { gameIds: ids.slice(), equipSpecs: equips.map(function(e) { return { gameId: e.gameId, stat: e.stat, tier: e.tier }; }) };
    return true;
  } catch (e) {
    console.warn('[Challenges Mod] applyChallengePlayerArsenal:', e);
    return false;
  }
}

function setChallengePendingPlayerArsenal(gameIds, equipSpecs, villainSpecs) {
  backupChallengePlayerArsenalIfNeeded();
  challengePendingPlayerArsenal = {
    gameIds: gameIds,
    equipSpecs: equipSpecs,
    villainSpecs: villainSpecs && villainSpecs.length ? villainSpecs.slice() : null
  };
}

function applyPendingChallengePlayerArsenalAfterNavigation() {
  if (!challengePendingPlayerArsenal) return true;
  var pending = challengePendingPlayerArsenal;
  challengePendingPlayerArsenal = null;
  return applyChallengePlayerArsenal(pending.gameIds, pending.equipSpecs, true, pending.villainSpecs);
}

function clearChallengePlayerArsenalNavigationHook() {
  if (challengePlayerArsenalApplyTimeoutId != null) {
    clearTimeout(challengePlayerArsenalApplyTimeoutId);
    challengePlayerArsenalApplyTimeoutId = null;
  }
  if (!challengePlayerArsenalNavigationUnsub) return;
  try {
    if (typeof challengePlayerArsenalNavigationUnsub === 'function') {
      challengePlayerArsenalNavigationUnsub();
    } else if (challengePlayerArsenalNavigationUnsub.unsubscribe) {
      challengePlayerArsenalNavigationUnsub.unsubscribe();
    }
  } catch (e) {}
  challengePlayerArsenalNavigationUnsub = null;
}

/** Apply pending player arsenal after room load (autoSetupBoard or fallback timeout). */
function scheduleChallengePlayerArsenalAfterNavigation() {
  clearChallengePlayerArsenalNavigationHook();
  if (!challengePendingPlayerArsenal) return;
  var applied = false;
  function isOnChallengeRoom() {
    if (!challengeRoomId) return true;
    try {
      var state = getState();
      var ctx = state && state.board && state.board.getSnapshot && state.board.getSnapshot().context;
      var currentRoomId = ctx && (ctx.selectedMap && (ctx.selectedMap.selectedRoom && ctx.selectedMap.selectedRoom.id || ctx.selectedMap.roomId));
      return currentRoomId === challengeRoomId;
    } catch (e) {
      return false;
    }
  }
  function tryApply(source) {
    if (applied || !challengePendingPlayerArsenal) return;
    if (!isOnChallengeRoom()) return;
    applied = true;
    clearChallengePlayerArsenalNavigationHook();
    if (!applyPendingChallengePlayerArsenalAfterNavigation()) {
      console.warn('[Challenges Mod] player arsenal apply failed (' + source + ')');
    }
  }
  try {
    var state = getState();
    if (state && state.board && typeof state.board.on === 'function') {
      var handler = function() {
        tryApply('autoSetupBoard');
      };
      var unsub = state.board.on('autoSetupBoard', handler);
      if (typeof unsub === 'function') {
        challengePlayerArsenalNavigationUnsub = unsub;
      } else {
        challengePlayerArsenalNavigationUnsub = function() {
          try {
            if (state.board.off) state.board.off('autoSetupBoard', handler);
          } catch (e) {}
        };
      }
    }
  } catch (e) {
    console.warn('[Challenges Mod] scheduleChallengePlayerArsenalAfterNavigation:', e);
  }
  challengePlayerArsenalApplyTimeoutId = setTimeout(function() {
    challengePlayerArsenalApplyTimeoutId = null;
    tryApply('timeout');
  }, CHALLENGE_PLAYER_ARSENAL_APPLY_FALLBACK_MS);
}

function restoreChallengePlayerArsenal() {
  clearChallengePlayerArsenalNavigationHook();
  challengePendingPlayerArsenal = null;
  challengeActivePlayerArsenal = null;
  challengeActiveVillainSpecs = null;
  if (!challengePlayerArsenalBackup) return;
  try {
    var backup = challengePlayerArsenalBackup;
    challengePlayerArsenalBackup = null;
    var state = getState();
    if (!state || !state.player || typeof state.player.send !== 'function') return;
    state.player.send({
      type: 'setState',
      fn: function(prev) {
        return Object.assign({}, prev, {
          monsters: backup.monsters,
          equips: backup.equips
        });
      }
    });
    console.log('[Challenges Mod] restoreChallengePlayerArsenal');
  } catch (e) {
    console.warn('[Challenges Mod] restoreChallengePlayerArsenal:', e);
  }
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

function getNonAwakenableCreatureNames() {
  var db = (typeof window !== 'undefined' && window.creatureDatabase) ? window.creatureDatabase : null;
  if (db && Array.isArray(db.NON_AWAKENABLE_CREATURES) && db.NON_AWAKENABLE_CREATURES.length) {
    return db.NON_AWAKENABLE_CREATURES;
  }
  return ['Dwarf Merrymancer', 'Goblin Gumslinger', 'Goblin Saboteur', 'Gummy Raider', 'Reindeer', 'Unionized Goblin'];
}

function isCreatureAwakenable(gameId) {
  var name = getCreatureName(gameId);
  if (!name) return false;
  var lname = name.toLowerCase();
  if (lname.indexOf('gazer') !== -1) return false;
  var blocked = getNonAwakenableCreatureNames();
  for (var i = 0; i < blocked.length; i++) {
    if (blocked[i].toLowerCase() === lname) return false;
  }
  return true;
}

function rollCreatureAwakened(gameId) {
  if (!isCreatureAwakenable(gameId)) return false;
  return Math.random() < CHALLENGE_AWAKEN_ROLL_CHANCE;
}

/** One rolled villain creature spec (level, genes, equip, optional awakened). */
function rollRandomCreatureSpec(gameId) {
  return {
    gameId: gameId,
    level: getRandomInt(CHALLENGE_LEVEL_MIN, CHALLENGE_LEVEL_MAX),
    genes: rollRandomGenes(),
    equip: rollRandomEquip(),
    awakened: rollCreatureAwakened(gameId)
  };
}

function getCreatureAwakenDifficultyMultiplier(spec) {
  return (spec && spec.awakened === true) ? CHALLENGE_AWAKEN_DIFFICULTY_MULT : 1;
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
  'albino gazer': 0.1,
  'chubby gazer': 0.1,
  'mystic gazer': 0.1,
  'psychic gazer': 0.1,
  'spiky gazer': 0.1,
  'sturdy gazer': 0.1,
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

/** Bonus points for a player arsenal creature: base ÷ creature difficulty mult (e.g. Black Knight 500÷3 ≈ 167). */
function getPlayerArsenalCreatureScorePoints(gameId) {
  var mult = getCreatureDifficultyMultiplier(getCreatureName(gameId));
  if (!(mult > 0)) mult = 1;
  return Math.round(CHALLENGE_PLAYER_ARSENAL_ITEM_BASE_POINTS / mult);
}

/** Bonus points for player equipment: base ÷ (name mult × tier). */
function getPlayerArsenalEquipmentScorePoints(equipSpec) {
  if (!equipSpec || equipSpec.gameId == null) return 0;
  var nameMult = getEquipmentDifficultyMultiplier(getEquipmentName(equipSpec.gameId));
  if (!(nameMult > 0)) nameMult = 1;
  var tier = equipSpec.tier != null ? Number(equipSpec.tier) : CHALLENGE_EQUIP_TIER_MIN;
  tier = Math.min(CHALLENGE_EQUIP_TIER_MAX, Math.max(CHALLENGE_EQUIP_TIER_MIN, tier));
  return Math.round(CHALLENGE_PLAYER_ARSENAL_ITEM_BASE_POINTS / (nameMult * tier));
}

function getChallengeAllyBoardPieces() {
  var pieces = [];
  try {
    var state = getState();
    if (!state || !state.board || typeof state.board.getSnapshot !== 'function') return pieces;
    var boardCtx = state.board.getSnapshot().context;
    var boardConfig = boardCtx && boardCtx.boardConfig;
    if (!Array.isArray(boardConfig)) return pieces;
    var playerCtx = state.player && state.player.getSnapshot && state.player.getSnapshot().context;
    var monsters = (playerCtx && Array.isArray(playerCtx.monsters)) ? playerCtx.monsters : [];
    var equips = (playerCtx && Array.isArray(playerCtx.equips)) ? playerCtx.equips : [];
    function isAlly(piece) {
      return piece && (piece.type === 'player' || (piece.type === 'custom' && piece.villain === false));
    }
    for (var i = 0; i < boardConfig.length; i++) {
      var piece = boardConfig[i];
      if (!isAlly(piece)) continue;
      var gameId = null;
      var equipSpec = null;
      if (piece.type === 'custom' && piece.gameId != null) {
        gameId = piece.gameId;
        if (piece.equip && piece.equip.gameId != null) {
          equipSpec = { gameId: piece.equip.gameId, tier: piece.equip.tier, stat: piece.equip.stat };
        }
      } else {
        var monsterId = piece.monsterId != null ? piece.monsterId : piece.databaseId;
        if (monsterId != null) {
          for (var m = 0; m < monsters.length; m++) {
            if (monsters[m].id === monsterId) {
              gameId = monsters[m].gameId;
              break;
            }
          }
        }
        if (piece.equipId != null) {
          for (var e = 0; e < equips.length; e++) {
            if (equips[e].id === piece.equipId) {
              equipSpec = { gameId: equips[e].gameId, tier: equips[e].tier, stat: equips[e].stat };
              break;
            }
          }
        }
      }
      if (gameId != null) pieces.push({ gameId: gameId, equip: equipSpec });
    }
  } catch (err) {
    console.warn('[Challenges Mod] getChallengeAllyBoardPieces:', err);
  }
  return pieces;
}

function getMapMaxCreatureDifficultyMultiplier(villainSpecs) {
  if (!villainSpecs || !villainSpecs.length) return 1;
  var max = 1;
  for (var i = 0; i < villainSpecs.length; i++) {
    var spec = villainSpecs[i];
    if (!spec || spec.gameId == null) continue;
    var mult = getCreatureDifficultyMultiplier(getCreatureName(spec.gameId));
    if (mult > max) max = mult;
  }
  return max;
}

function getChallengeVillainSpecsForScoring(villainSpecs) {
  if (villainSpecs && villainSpecs.length) return villainSpecs;
  if (challengeActiveVillainSpecs && challengeActiveVillainSpecs.length) return challengeActiveVillainSpecs;
  if (rolledCreatureSpecs && rolledCreatureSpecs.length) return rolledCreatureSpecs;
  return [];
}

function getChallengePlayerArsenalCount(villainSpecs) {
  var specs = villainSpecs;
  if (!specs || !specs.length) {
    if (challengeActiveVillainSpecs && challengeActiveVillainSpecs.length) specs = challengeActiveVillainSpecs;
    else if (rolledCreatureSpecs && rolledCreatureSpecs.length) specs = rolledCreatureSpecs;
  }
  var enemyCount = specs && specs.length ? specs.length : 1;
  return Math.max(1, Math.round(CHALLENGE_PLAYER_ARSENAL_ENEMY_COUNT_FACTOR * enemyCount));
}

function collectPlayerArsenalScorePointsFromSpecs(gameIds, equipSpecs) {
  var points = [];
  var ids = normalizeChallengeAllyGameIds(gameIds);
  var equips = normalizeChallengeAllyEquips(equipSpecs);
  for (var i = 0; i < ids.length; i++) {
    points.push(getPlayerArsenalCreatureScorePoints(ids[i]));
  }
  for (var j = 0; j < equips.length; j++) {
    points.push(getPlayerArsenalEquipmentScorePoints(equips[j]));
  }
  return points;
}

function computeChallengePlayerArsenalBonusFromPoints(points, mapMaxCreatureMult) {
  if (!points || !points.length) return { bonus: 0, average: 0, mapMax: mapMaxCreatureMult || 1 };
  var sum = 0;
  for (var i = 0; i < points.length; i++) sum += points[i];
  var average = sum / points.length;
  var mapMax = mapMaxCreatureMult != null && mapMaxCreatureMult > 0 ? mapMaxCreatureMult : 1;
  return {
    bonus: Math.round(average * mapMax),
    average: average,
    mapMax: mapMax
  };
}

function computeChallengePlayerArsenalBonusFromSpecs(gameIds, equipSpecs, villainSpecs) {
  var points = collectPlayerArsenalScorePointsFromSpecs(gameIds, equipSpecs);
  var mapMax = getMapMaxCreatureDifficultyMultiplier(getChallengeVillainSpecsForScoring(villainSpecs));
  return computeChallengePlayerArsenalBonusFromPoints(points, mapMax);
}

function computeChallengePlayerArsenalBonusFromBoard(villainSpecs) {
  var arsenal = challengeActivePlayerArsenal || challengePendingPlayerArsenal;
  if (arsenal) {
    return computeChallengePlayerArsenalBonusFromSpecs(arsenal.gameIds, arsenal.equipSpecs, villainSpecs);
  }
  var pieces = getChallengeAllyBoardPieces();
  if (!pieces.length) {
    return computeChallengePlayerArsenalBonusFromPoints([], getMapMaxCreatureDifficultyMultiplier(getChallengeVillainSpecsForScoring(villainSpecs)));
  }
  var points = [];
  for (var i = 0; i < pieces.length; i++) {
    points.push(getPlayerArsenalCreatureScorePoints(pieces[i].gameId));
    if (pieces[i].equip) {
      points.push(getPlayerArsenalEquipmentScorePoints(pieces[i].equip));
    }
  }
  var mapMax = getMapMaxCreatureDifficultyMultiplier(getChallengeVillainSpecsForScoring(villainSpecs));
  return computeChallengePlayerArsenalBonusFromPoints(points, mapMax);
}

function getChallengePlayerArsenalScoreItemsFromSpecs(gameIds, equipSpecs) {
  var items = [];
  var ids = normalizeChallengeAllyGameIds(gameIds);
  var equips = normalizeChallengeAllyEquips(equipSpecs);
  for (var i = 0; i < ids.length; i++) {
    items.push({
      type: 'creature',
      name: getCreatureName(ids[i]),
      points: getPlayerArsenalCreatureScorePoints(ids[i])
    });
  }
  for (var j = 0; j < equips.length; j++) {
    items.push({
      type: 'equipment',
      name: getEquipmentName(equips[j].gameId),
      points: getPlayerArsenalEquipmentScorePoints(equips[j]),
      tier: equips[j].tier
    });
  }
  return items;
}

function getChallengePlayerArsenalScoreItemsFromBoard() {
  var pieces = getChallengeAllyBoardPieces();
  var items = [];
  for (var i = 0; i < pieces.length; i++) {
    items.push({
      type: 'creature',
      name: getCreatureName(pieces[i].gameId),
      points: getPlayerArsenalCreatureScorePoints(pieces[i].gameId)
    });
    if (pieces[i].equip) {
      items.push({
        type: 'equipment',
        name: getEquipmentName(pieces[i].equip.gameId),
        points: getPlayerArsenalEquipmentScorePoints(pieces[i].equip),
        tier: pieces[i].equip.tier
      });
    }
  }
  return items;
}

function getChallengePlayerArsenalScoreItems(gameIds, equipSpecs) {
  var boardItems = getChallengePlayerArsenalScoreItemsFromBoard();
  if (boardItems.length) return boardItems;
  if (gameIds || equipSpecs) {
    return getChallengePlayerArsenalScoreItemsFromSpecs(gameIds, equipSpecs);
  }
  var arsenal = challengeActivePlayerArsenal || challengePendingPlayerArsenal;
  if (arsenal) {
    return getChallengePlayerArsenalScoreItemsFromSpecs(arsenal.gameIds, arsenal.equipSpecs);
  }
  return [];
}

function getChallengePlayerArsenalBonusPoints(villainSpecs) {
  return computeChallengePlayerArsenalBonusFromBoard(villainSpecs).bonus;
}

function getChallengePlayerArsenalBonusDetails(villainSpecs) {
  return computeChallengePlayerArsenalBonusFromBoard(villainSpecs);
}

function formatChallengePlayerArsenalItemScore(points) {
  if (points == null || !Number.isFinite(points)) return '+0';
  return '+' + Math.round(points);
}

function computeChallengeExpectedScore(rawDifficulty, grade, ticks, gameIds, equipSpecs, villainSpecs) {
  ticks = ticks != null ? ticks : 500;
  grade = grade || 'A';
  var bonusResult;
  if (gameIds || equipSpecs) {
    bonusResult = computeChallengePlayerArsenalBonusFromSpecs(gameIds || [], equipSpecs || [], villainSpecs);
  } else {
    bonusResult = computeChallengePlayerArsenalBonusFromBoard(villainSpecs);
  }
  return Math.round(computeChallengeScore(ticks, rawDifficulty, grade, bonusResult.bonus) / 100) * 100;
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
  var awakenMult = getCreatureAwakenDifficultyMultiplier(spec);
  return Math.round((level + equipPoints) * creatureMult * equipMult * awakenMult);
}

// Difficulty = sum over creatures of (level + 10*equipTier) * creatureMult * equipmentMult, rounded.
// Display/score multiplier = getDifficultyMultiplier(difficulty), power curve (see below).
// Allies = round(2.5 * (difficulty/150)^p), min 1, with p = log(5)/log(10) so 150→3, 375→5, 600→6, 1500→13, 2000→15.
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
    var awakenMult = getCreatureAwakenDifficultyMultiplier(spec);
    difficulty += (level + equipPoints) * creatureMult * equipMult * awakenMult;
  }
  difficulty = Math.round(difficulty);
  if (hasDharalion) difficulty = Math.round(difficulty * 0.5);
  var alliesAllowed = Math.max(1, Math.round(2.5 * Math.pow(difficulty / CHALLENGE_ALLIES_BASE_DIFFICULTY, CHALLENGE_ALLIES_EXPONENT)));
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

/** Score = round((1000 − ticks + gradePoints) × mapMultiplier) + arsenal bonus points. */
function computeChallengeScore(ticks, rawDifficulty, grade, playerArsenalBonus) {
  var mult = getDifficultyMultiplier(rawDifficulty);
  var base = (1000 - (ticks || 0)) + getGradePoints(grade);
  var bonus = playerArsenalBonus != null ? playerArsenalBonus : getChallengePlayerArsenalBonusPoints();
  return Math.round(base * mult) + bonus;
}

/** Compute challenge score from gameData (victory). Used by onVictory and victoryContent. */
function computeVictoryScoreFromGameData(gameData, allyLimit, difficulty) {
  var ticks = (gameData && typeof gameData.ticks === 'number') ? gameData.ticks : 0;
  var currentTeamSize = (gameData && typeof gameData.currentTeamSize === 'number') ? gameData.currentTeamSize : allyLimit;
  var creaturesAlive = (gameData && typeof gameData.creaturesAlive === 'number') ? gameData.creaturesAlive : getCreaturesAliveFromBoardState();
  if (typeof creaturesAlive !== 'number' || creaturesAlive < 0) creaturesAlive = currentTeamSize;
  var grade = computeChallengeGrade(allyLimit, currentTeamSize, creaturesAlive);
  var playerArsenalItems = getChallengePlayerArsenalScoreItemsFromBoard();
  if (!playerArsenalItems.length) {
    var arsenal = challengeActivePlayerArsenal || challengePendingPlayerArsenal;
    if (arsenal) {
      playerArsenalItems = getChallengePlayerArsenalScoreItemsFromSpecs(arsenal.gameIds, arsenal.equipSpecs);
    }
  }
  var bonusDetails = computeChallengePlayerArsenalBonusFromBoard();
  return {
    score: computeChallengeScore(ticks, difficulty, grade, bonusDetails.bonus),
    grade: grade,
    ticks: ticks,
    playerArsenalBonus: bonusDetails.bonus,
    playerArsenalAverage: bonusDetails.average,
    playerArsenalMapMax: bonusDetails.mapMax,
    playerArsenalItems: playerArsenalItems
  };
}

/** Compute multiplayer score from current board state (time-up path). Returns 0 if defeat, else computed score. */
function computeMultiplayerScoreFromBoardState(alliesAllowed, difficulty) {
  var creaturesAlive = getCreaturesAliveFromBoardState();
  if (typeof creaturesAlive !== 'number' || creaturesAlive < 0) creaturesAlive = 0;
  if (creaturesAlive <= 0) return 0;
  var grade = computeChallengeGrade(alliesAllowed, alliesAllowed, creaturesAlive);
  var bonusDetails = computeChallengePlayerArsenalBonusFromBoard();
  return computeChallengeScore(180, difficulty, grade, bonusDetails.bonus); // 3 min = 180 ticks
}

/** Build score breakdown tooltip for a leaderboard row (with newlines for title attribute). Always shows actual numbers. */
function getScoreBreakdownText(row) {
  var mult = row.difficulty != null ? getDifficultyMultiplier(row.difficulty) : 0;
  var multStr = mult > 0 ? mult.toFixed(2) + '×' : '—';
  var arsenalBonus = row.playerArsenalBonus != null ? row.playerArsenalBonus : 0;
  var score = row.score != null ? row.score : 0;
  if (row.ticks != null && row.difficulty != null) {
    var gradePoints = getGradePoints(row.grade);
    var base = (1000 - row.ticks) + gradePoints;
    var mapScore = Math.round(base * mult);
    var lines = [
      'Base: (1000 − ' + row.ticks + ') + ' + gradePoints + ' = ' + base,
      'Map score: round(' + base + ' × ' + multStr.replace('×', '') + ') = ' + mapScore
    ];
    if (row.playerArsenalItems && row.playerArsenalItems.length) {
      for (var i = 0; i < row.playerArsenalItems.length; i++) {
        var item = row.playerArsenalItems[i];
        var itemLabel = item.name || (item.type === 'equipment' ? 'Equipment' : 'Creature');
        if (item.type === 'equipment' && item.tier != null) itemLabel += ' T' + item.tier;
        var itemPoints = item.points != null ? item.points : 0;
        lines.push(itemLabel + ': ' + formatChallengePlayerArsenalItemScore(itemPoints));
      }
    }
    if (row.playerArsenalAverage != null && row.playerArsenalMapMax != null) {
      lines.push('Arsenal average: ' + Math.round(row.playerArsenalAverage) + ' × map max ' + row.playerArsenalMapMax + '×');
    }
    if (arsenalBonus > 0) {
      lines.push('Arsenal bonus: +' + arsenalBonus);
    }
    lines.push('Score: ' + mapScore + ' + ' + arsenalBonus + ' = ' + score);
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
  var ids = getAllEquipmentGameIds();
  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
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
  return { gameId: gameId, stat: getChallengeRandomEquipStat(), tier: getChallengeRandomEquipTier() };
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
      return rollRandomCreatureSpec(gameId);
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
  challengeActiveVillainSpecs = villainSpecs && villainSpecs.length ? villainSpecs.slice() : null;

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
    if (spec.awakened === true) {
      villain.awaken = true;
      villain.awakened = true;
      villain.isAwakened = true;
      villain.starTier = CHALLENGE_AWAKEN_STAR_TIER;
    }
    return villain;
  });
  var config = {
    name: challengesText('mods.challenges.title'),
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
              equip: s.equip || null,
              awakened: s.awakened === true
            };
          })
        };
        if (!challengeMultiplayerContext || !challengeMultiplayerContext.matchId) {
          var configString = JSON.stringify(villainConfig);
          saveChallengeRunToLeaderboard({
            name: name,
            mapName: mapName,
            difficulty: difficulty,
            score: score,
            replay: configString,
            ticks: ticks,
            grade: grade,
            playerArsenalBonus: result.playerArsenalBonus,
            playerArsenalAverage: result.playerArsenalAverage,
            playerArsenalMapMax: result.playerArsenalMapMax,
            playerArsenalItems: result.playerArsenalItems
          });
        }
      },
      victoryContent: function(gameData) {
        console.log('[Challenges Mod] victoryContent gameData:', gameData);
        var result = computeVictoryScoreFromGameData(gameData, allyLimit, difficulty);
        var score = result.score;
        var ticks = result.ticks;
        var grade = result.grade;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'padding: 12px 16px; text-align: left;';
        var victoryT = challengesText;
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
        wrap.appendChild(row(challengesText('mods.challenges.labels.map'), mapName || '—'));
        wrap.appendChild(row(challengesText('mods.challenges.difficultyLabel').replace(/:\s*$/, ''), getDifficultyMultiplier(difficulty).toFixed(2) + '×'));
        if (result.playerArsenalItems && result.playerArsenalItems.length) {
          result.playerArsenalItems.forEach(function(item) {
            var itemLabel = item.name || (item.type === 'equipment' ? 'Equipment' : 'Creature');
            if (item.type === 'equipment' && item.tier != null) itemLabel += ' T' + item.tier;
            wrap.appendChild(row(itemLabel, formatChallengePlayerArsenalItemScore(item.points)));
          });
        }
        if (result.playerArsenalBonus > 0) {
          var bonusDetail = '+' + result.playerArsenalBonus;
          if (result.playerArsenalAverage != null && result.playerArsenalMapMax != null) {
            bonusDetail += ' (avg ' + Math.round(result.playerArsenalAverage) + ' × ' + result.playerArsenalMapMax + '×)';
          }
          wrap.appendChild(row(challengesText('mods.challenges.arsenalBonusLabel'), bonusDetail));
        }
        wrap.appendChild(row(challengesText('mods.challenges.labels.score'), String(score)));
        wrap.appendChild(row(challengesText('mods.challenges.labels.ticks'), String(ticks)));
        wrap.appendChild(row(challengesText('mods.challenges.labels.grade'), (grade && String(grade).trim()) ? String(grade) + ' (+' + getGradePoints(grade) + ')' : '—'));
        var mpCtx = challengeMultiplayerContext;
        if (mpCtx && mpCtx.matchId && mpCtx.myKey) {
          var oppName = (mpCtx.opponentName && String(mpCtx.opponentName).trim())
            || challengesText('mods.challenges.opponentFallback');
          var oppP = document.createElement('p');
          oppP.style.cssText = 'margin: 6px 0; font-size: 14px;';
          oppP.textContent = challengesText('mods.challenges.multiplayer.victoryOpponent').replace('{name}', oppName);
          wrap.appendChild(oppP);
          var waitP = document.createElement('p');
          waitP.style.cssText = 'margin: 12px 0 0 0; font-size: 13px; color: #c9e4a8; font-style: italic; text-align: center;';
          waitP.textContent = challengesText('mods.challenges.multiplayer.victoryWaitingForOpponent').replace('{name}', oppName);
          wrap.appendChild(waitP);
          return wrap;
        }
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
        resetChallengeBoardAfterBattleClose();
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
    if (openModal(api, {
      title: challengesText('mods.challenges.title'),
      content: '<p>' + text + '</p>',
      buttons: [{ text: 'OK', primary: true }]
    })) {
      return;
    }
  } catch (e) {
    console.warn('[Challenges Mod] showChallengeToast:', e);
  }
  if (typeof alert === 'function') {
    alert(challengesText('mods.challenges.title') + ': ' + (message || 'Unknown'));
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
    flexContainer.style.cssText = 'display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-' + stackOffset + 'px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;';
    var toast = document.createElement((isTransient && !useJoinLink) ? 'button' : 'div');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    if (!isTransient) toast.setAttribute('role', 'presentation');
    var toastNeedsPointerEvents = isTransient || useJoinLink || options.showAccept === true || options.acceptLabel !== undefined || typeof options.onClose === 'function';
    if (toastNeedsPointerEvents) {
      toast.style.pointerEvents = 'auto';
      if (useJoinLink) toast.style.cursor = 'default';
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
      lead.textContent = challengesText('mods.challenges.multiplayer.queueWatchInviteLead');
      var joinLinkBtn = document.createElement('button');
      joinLinkBtn.type = 'button';
      joinLinkBtn.setAttribute('data-challenges-queue-watch-join', '1');
      joinLinkBtn.setAttribute('aria-label', 'Join challenges queue');
      joinLinkBtn.textContent = challengesText('mods.challenges.multiplayer.queueWatchInviteJoin');
      joinLinkBtn.style.cssText = 'flex-shrink: 0; padding: 0 0.2em; margin: 0; font-size: inherit; line-height: inherit; color: #ffe066; text-decoration: underline; background: transparent; border: none; cursor: pointer; pointer-events: auto; font-family: inherit; letter-spacing: 0.06em;';
      joinLinkBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openChallengesModalMultiplayerAndJoinQueue();
      });
      var tail = document.createElement('span');
      tail.textContent = challengesText('mods.challenges.multiplayer.queueWatchInviteTail');
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
      if (ta.parentNode) {
        ta.parentNode.removeChild(ta);
      }
      showChallengesToast('Setup config copied to clipboard.', { duration: CHALLENGE_TOAST_DURATION });
    }
  } catch (e) {
    showChallengesToast('Copy failed.', { duration: CHALLENGE_TOAST_DURATION });
  }
}

function cleanupChallengeBattle() {
  clearChallengePlayerArsenalNavigationHook();
  if (challengeBoardUnsubscribe && typeof challengeBoardUnsubscribe === 'function') {
    try { challengeBoardUnsubscribe(); } catch (e) {}
    challengeBoardUnsubscribe = null;
  }
  if (challengeBattle) {
    try {
      challengeBattle.cleanup(undefined, showChallengesOverlaysAndButtons);
    } catch (e) {
      console.warn('[Challenges Mod] cleanupChallengeBattle cleanup:', e);
    }
    challengeBattle = null;
  }
  challengeRoomId = null;
  challengeSetupDone = false;
  challengeActiveVillainSpecs = null;
  // In multiplayer, keep context/timer/toast until match result; still restore board UI on modal close.
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

/** After victory/defeat modal OK: tear down custom battle, exit sandbox, reload room villains. */
function resetChallengeBoardAfterBattleClose() {
  var roomId = challengeRoomId;
  cleanupChallengeBattle();
  restoreChallengePlayerArsenal();
  setTimeout(function() {
    triggerChallengeStopButton();
    if (!roomId) return;
    try {
      var state = getState();
      if (state && state.board && typeof state.board.send === 'function') {
        state.board.send({ type: 'selectRoomById', roomId: roomId });
      }
    } catch (e) {
      console.warn('[Challenges Mod] resetChallengeBoardAfterBattleClose:', e);
    }
  }, 150);
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
    // Room info overlay (Monsters / map name) is owned by custom-battles.js during CustomBattles.
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
    // Room info overlay restore is owned by custom-battles.js.
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
    return titleP && titleP.textContent.trim() === challengesText('mods.challenges.title');
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
      if (!titleP || titleP.textContent.trim() !== challengesText('mods.challenges.title')) return;
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
    setChallengePendingPlayerArsenal(rolledAllyGameIds, rolledAllyEquips, rolledCreatureSpecs);

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
        equip: spec.equip,
        awakened: spec.awakened === true
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
          restoreChallengePlayerArsenal();
          showChallengeToast('Custom Battles system not available. Try again in a moment.');
          return;
        }
        console.log('[Challenges Mod] startChallenge: CustomBattles ready');

        state = getState();
        if (!state || !state.board) {
          console.log('[Challenges Mod] startChallenge: no state/board in then');
          restoreChallengePlayerArsenal();
          showChallengeToast('Board state not available.');
          return;
        }

        cleanupChallengeBattle();
        challengeActiveVillainSpecs = villainSpecs && villainSpecs.length ? villainSpecs.slice() : null;
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
            restoreChallengePlayerArsenal();
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
          setTimeout(function() {
            if (!challengeBattle || !challengeRoomId) return;
            try {
              challengeBattle.removeOriginalVillains();
            } catch (e) {
              console.warn('[Challenges Mod] removeOriginalVillains:', e);
            }
          }, 350);
        });

        showChallengeToastNotification('Navigating to challenge.');
        startSoloChallengeLiveToast(alliesAllowed);
        scheduleChallengePlayerArsenalAfterNavigation();
        console.log('[Challenges Mod] startChallenge: sending selectRoomById', roomId);
        state.board.send({ type: 'selectRoomById', roomId: roomId });
        console.log('[Challenges Mod] startChallenge: done, navigating to room:', roomId);
      }).catch(function(err) {
        console.error('[Challenges Mod] startChallenge promise error:', err);
        restoreChallengePlayerArsenal();
        showChallengeToast('Error starting challenge: ' + (err && err.message ? err.message : 'Unknown error'));
      });
    }, CHALLENGE_SANDBOX_DELAY_MS);
  } catch (err) {
    console.error('[Challenges Mod] startChallenge error:', err);
    restoreChallengePlayerArsenal();
    showChallengeToast('Error: ' + (err && err.message ? err.message : 'Unknown error'));
  }
}

/**
 * Start a challenge from a saved villain config (roomId, roomName, villains). Closes modal and navigates to map with villains.
 * @param {{ roomId: string, roomName: string, villains: Array, allyGameIds?: Array<number>, allyEquips?: Array<{gameId:number, stat:string, tier:number}> }} config
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
  setChallengePendingPlayerArsenal(config.allyGameIds, config.allyEquips, config.villains);

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
        restoreChallengePlayerArsenal();
        showChallengeToast('Custom Battles not available.');
        return;
      }
      console.log('[Challenges Mod] startChallengeWithVillainConfig: CustomBattles ready, creating battle');
      state = getState();
      if (!state || !state.board) {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: no state/board after wait');
        restoreChallengePlayerArsenal();
        showChallengeToast('Board state not available.');
        return;
      }
        cleanupChallengeBattle();
        challengeActiveVillainSpecs = villainSpecs && villainSpecs.length ? villainSpecs.slice() : null;
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
          restoreChallengePlayerArsenal();
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
      scheduleChallengePlayerArsenalAfterNavigation();
      // Match Start flow: send selectRoomById immediately so the board loads the room the same way
      if (state && state.board && typeof state.board.send === 'function') {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: sending selectRoomById', roomId);
        state.board.send({ type: 'selectRoomById', roomId: roomId });
      } else {
        console.log('[Challenges Mod] startChallengeWithVillainConfig: cannot send selectRoomById, state.board missing');
      }
    }).catch(function(err) {
      console.error('[Challenges Mod] startChallengeWithVillainConfig error:', err);
      restoreChallengePlayerArsenal();
      showChallengeToast('Error loading setup: ' + (err && err.message ? err.message : 'Unknown error'));
    });
  }, CHALLENGE_SANDBOX_DELAY_MS);
}

// =======================
// 4. Header Integration
// =======================

let headerObserver = null;
let headerButtonCheckInterval = null;
let headerObserverDebounceTimeout = null;
let lastHeaderObserverCheck = 0;

const CHALLENGES_HEADER_MATCH_CSS = '@keyframes challenges-header-match-colors{0%,100%{color:#ffe066;text-shadow:0 0 10px rgba(255,224,102,.85)}25%{color:#4ade80;text-shadow:0 0 10px rgba(74,222,128,.85)}50%{color:#38bdf8;text-shadow:0 0 10px rgba(56,189,248,.85)}75%{color:#f472b6;text-shadow:0 0 10px rgba(244,114,182,.85)}}header .challenges-header-btn.challenges-header-match-found{animation:challenges-header-match-colors 1.4s ease-in-out infinite;font-weight:700}@keyframes challenges-header-queue-pulse{0%,100%{color:#d4c4a0;text-shadow:none}33%{color:#ffe066;text-shadow:0 0 6px rgba(255,224,102,.5)}66%{color:#c9e4a8;text-shadow:0 0 5px rgba(168,212,120,.4)}}header .challenges-header-btn.challenges-header-queue-waiting{animation:challenges-header-queue-pulse 2.8s ease-in-out infinite}';

function injectChallengesHeaderStyles() {
  if (typeof document === 'undefined') return;
  var styleEl = document.getElementById('challenges-header-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'challenges-header-css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = CHALLENGES_HEADER_MATCH_CSS;
}

/** Pulse the top-nav Challenges button when a multiplayer match awaits acceptance or others are in queue. */
function updateChallengesNavHeaderMatchAlert() {
  var btn = document.querySelector('.challenges-header-btn');
  if (!btn) return;
  var p = challengesMultiplayerPersisted;
  var matchPending = !!(p.matchedOpponent && p.matchId && !p.bothAccepted);
  if (matchPending) {
    btn.classList.add('challenges-header-match-found');
    btn.classList.remove('challenges-header-queue-waiting');
    var opponent = String(p.matchedOpponent || '').trim() || challengesText('mods.challenges.opponentFallback');
    btn.title = challengesText('mods.challenges.multiplayer.matchedWith').replace('{name}', opponent);
  } else if (challengesNavOthersInQueue && !p.inQueue) {
    btn.classList.remove('challenges-header-match-found');
    btn.classList.add('challenges-header-queue-waiting');
    btn.title = challengesText('mods.challenges.multiplayer.queueWatchInviteLead');
  } else {
    btn.classList.remove('challenges-header-match-found');
    btn.classList.remove('challenges-header-queue-waiting');
    btn.title = '';
  }
}

/** True when nav pulse indicates multiplayer queue activity (others waiting or match pending). */
function shouldOpenChallengesOnMultiplayerTab() {
  var p = challengesMultiplayerPersisted;
  var matchPending = !!(p.matchedOpponent && p.matchId && !p.bothAccepted);
  return matchPending || (challengesNavOthersInQueue && !p.inQueue);
}

function openChallengesModalFromHeader() {
  var openMultiplayer = shouldOpenChallengesOnMultiplayerTab();
  if (isChallengesModalOpen()) {
    if (openMultiplayer && typeof window !== 'undefined' && window.__challengesSetActiveTab) {
      window.__challengesSetActiveTab(1);
    }
    return;
  }
  openChallengesModal(openMultiplayer ? 1 : 0);
}

function addChallengesHeaderButton() {
  var existingBtn = document.querySelector('.challenges-header-btn');
  if (existingBtn) {
    existingBtn.textContent = challengesText('mods.challenges.title');
    updateChallengesNavHeaderMatchAlert();
    existingBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        openChallengesModalFromHeader();
      } catch (err) {
        console.error('[Challenges Mod] Error opening modal from header:', err);
      }
    };
    return true;
  }

  var headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
  if (!headerUl) return false;

  var li = document.createElement('li');
  li.className = 'hover:text-whiteExp';
  var btn = document.createElement('button');
  btn.textContent = challengesText('mods.challenges.title');
  btn.className = 'challenges-header-btn';
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      openChallengesModalFromHeader();
    } catch (err) {
      console.error('[Challenges Mod] Error opening modal from header:', err);
    }
  });
  li.appendChild(btn);

  var cyclopediaLi = Array.from(headerUl.children).find(function(el) {
    return el.querySelector('.cyclopedia-header-btn');
  });
  if (cyclopediaLi) {
    cyclopediaLi.insertAdjacentElement('afterend', li);
  } else {
    var settingsLi = Array.from(headerUl.children).find(function(el) {
      return el.querySelector('.mod-settings-header-btn');
    });
    if (settingsLi) {
      settingsLi.insertAdjacentElement('afterend', li);
    } else {
      headerUl.appendChild(li);
    }
  }

  updateChallengesNavHeaderMatchAlert();
  return true;
}

function processHeaderMutations() {
  addChallengesHeaderButton();
}

function observeHeader() {
  if (headerObserver) {
    try { headerObserver.disconnect(); } catch (e) {}
    headerObserver = null;
  }
  if (headerButtonCheckInterval) {
    clearInterval(headerButtonCheckInterval);
    headerButtonCheckInterval = null;
  }
  if (headerObserverDebounceTimeout) {
    clearTimeout(headerObserverDebounceTimeout);
    headerObserverDebounceTimeout = null;
  }

  headerButtonCheckInterval = setInterval(function() {
    addChallengesHeaderButton();
  }, HEADER_BUTTON_CHECK_INTERVAL);

  headerObserver = new MutationObserver(function() {
    var now = Date.now();
    if (now - lastHeaderObserverCheck < OBSERVER_MIN_INTERVAL) {
      if (headerObserverDebounceTimeout) clearTimeout(headerObserverDebounceTimeout);
      headerObserverDebounceTimeout = setTimeout(processHeaderMutations, OBSERVER_DEBOUNCE_DELAY);
      return;
    }
    lastHeaderObserverCheck = now;
    processHeaderMutations();
  });

  headerObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  injectChallengesHeaderStyles();
  addChallengesHeaderButton();
}

// =======================
// 5. Cleanup & Exports
// =======================

function cleanupChallenges() {
  clearChallengesModalLayoutCleanup();
  if (headerObserverDebounceTimeout) {
    clearTimeout(headerObserverDebounceTimeout);
    headerObserverDebounceTimeout = null;
  }
  if (headerButtonCheckInterval) {
    clearInterval(headerButtonCheckInterval);
    headerButtonCheckInterval = null;
  }
  if (headerObserver) {
    try { headerObserver.disconnect(); } catch (e) {}
    headerObserver = null;
  }
  document.querySelectorAll('.challenges-header-btn').forEach(function(btn) {
    var li = btn.closest('li');
    if (li && li.parentNode) {
      li.parentNode.removeChild(li);
    } else {
      try { btn.remove(); } catch (e) {}
    }
  });
}

function canRunChallengesAdminTools() {
  var player = getCurrentPlayerName();
  if (!player || typeof window.FirebaseAdminsAPI?.isPlayerAdmin !== 'function') {
    return false;
  }
  return window.FirebaseAdminsAPI.isPlayerAdmin(player);
}

async function canRunChallengesAdminToolsAsync() {
  var player = getCurrentPlayerName();
  if (!player || typeof window.FirebaseAdminsAPI?.isPlayerAdminAsync !== 'function') {
    return false;
  }
  return window.FirebaseAdminsAPI.isPlayerAdminAsync(player);
}

async function deleteChallengeFirebaseJsonPath(url) {
  try {
    var response = await fetch(url, { method: 'DELETE' });
    return response.ok || response.status === 404;
  } catch (error) {
    console.error('[Challenges Mod] DELETE failed:', url, error);
    return false;
  }
}

/** Wipe solo global leaderboard on Firebase. Personal localStorage records are per-browser and not affected. */
async function clearAllSoloChallengeRecords() {
  var paths = [getChallengeLeaderboardPath() + '.json'];
  var failures = [];
  var deleted = 0;
  for (var i = 0; i < paths.length; i++) {
    if (await deleteChallengeFirebaseJsonPath(paths[i])) {
      deleted += 1;
    } else {
      failures.push(paths[i]);
    }
  }
  return { deleted: deleted, failures: failures, success: failures.length === 0 };
}

/** Wipe multiplayer queue, matches, player-match links, and ELO ratings on Firebase. */
async function clearAllMultiplayerChallengeRecords() {
  var paths = [
    getMultiplayerQueuePath() + '.json',
    getMultiplayerMatchesPath() + '.json',
    getMultiplayerPlayerMatchesPath() + '.json',
    getMultiplayerRatingsPath() + '.json'
  ];
  var failures = [];
  var deleted = 0;
  for (var j = 0; j < paths.length; j++) {
    if (await deleteChallengeFirebaseJsonPath(paths[j])) {
      deleted += 1;
    } else {
      failures.push(paths[j]);
    }
  }
  return { deleted: deleted, failures: failures, success: failures.length === 0 };
}

async function runClearSoloRecordsIfAllowed() {
  if (!(await canRunChallengesAdminToolsAsync())) {
    return { success: false, error: 'Not authorized', deleted: 0 };
  }
  var result = await clearAllSoloChallengeRecords();
  if (result.success) {
    console.log('[Challenges Mod] Solo leaderboard cleared:', result);
  } else {
    console.error('[Challenges Mod] Solo leaderboard clear failed:', result.failures);
  }
  return {
    success: result.success,
    deleted: result.deleted,
    error: result.success ? null : 'Failed to delete one or more paths (' + result.failures.length + ')'
  };
}

async function runClearMultiplayerRecordsIfAllowed() {
  if (!(await canRunChallengesAdminToolsAsync())) {
    return { success: false, error: 'Not authorized', deleted: 0 };
  }
  var result = await clearAllMultiplayerChallengeRecords();
  if (result.success) {
    console.log('[Challenges Mod] Multiplayer records cleared:', result);
  } else {
    console.error('[Challenges Mod] Multiplayer records clear failed:', result.failures);
  }
  return {
    success: result.success,
    deleted: result.deleted,
    error: result.success ? null : 'Failed to delete one or more paths (' + result.failures.length + ')'
  };
}

function refreshChallengesPublicApi() {
  if (typeof window === 'undefined') return;
  window.Challenges = {
    canRunChallengesAdminTools: canRunChallengesAdminTools,
    canRunChallengesAdminToolsAsync: canRunChallengesAdminToolsAsync,
    runClearSoloRecordsIfAllowed: runClearSoloRecordsIfAllowed,
    runClearMultiplayerRecordsIfAllowed: runClearMultiplayerRecordsIfAllowed
  };
}

refreshChallengesPublicApi();

if (typeof context !== 'undefined' && context.api) {
  observeHeader();
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
