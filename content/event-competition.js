// =======================
// Event Competition Framework
// =======================
// Config-driven community event leaderboards (Firebase + in-game highscores).
'use strict';

if (window.EventCompetition) {
  // Already initialized
} else {
(function() {
  'use strict';

  const DEFAULT_TIMERS = {
    eventIntervalMs: 1000,
    submitMinIntervalMs: 2000,
    fetchCacheTtlMs: 60000,
    fetchMinIntervalMs: 15000,
    joinStateCacheTtlMs: 120000,
    participantsCacheTtlMs: 60000,
    participantSyncMinIntervalMs: 60000,
    ineligiblePurgeMinIntervalMs: 6 * 60 * 60 * 1000,
    profileCacheTtlMs: 60 * 60 * 1000
  };

  const DEFAULT_MODAL = {
    id: 'event-competition-modal',
    stylesId: 'event-competition-styles',
    width: 550,
    height: 550,
    viewportPadding: 16,
    minWidth: 280,
    minHeight: 320
  };

  const DEFAULT_TOAST = {
    containerId: 'event-competition-toast-container',
    durationMs: 10000
  };

  function normalizeConfig(config) {
    const floors = config.floors || {};
    return {
      id: config.id,
      roomId: config.roomId,
      firebaseBase: config.firebaseBase,
      joinStorageKey: config.joinStorageKey,
      i18nPrefix: config.i18nPrefix,
      logPrefix: config.logPrefix || '[EventCompetition]',
      prizeBeastCoins: config.prizeBeastCoins ?? 500,
      leaderboardTop: config.leaderboardTop ?? 10,
      missingFloorTicks: config.missingFloorTicks ?? 9600,
      eventButtonIcon: config.eventButtonIcon || null,
      floorScaleColors: config.floorScaleColors || [],
      tabIcons: config.tabIcons || {},
      tabIconSize: config.tabIconSize ?? 12,
      isPlayerEligible: typeof config.isPlayerEligible === 'function'
        ? config.isPlayerEligible
        : null,
      ascensionFormula: typeof config.ascensionFormula === 'function'
        ? config.ascensionFormula
        : (floor) => 100 + floor * 20,
      timers: Object.assign({}, DEFAULT_TIMERS, config.timers || {}),
      modal: Object.assign({}, DEFAULT_MODAL, config.modal || {}),
      toast: Object.assign({}, DEFAULT_TOAST, config.toast || {}),
      floors: {
        min: floors.min ?? 0,
        max: floors.max ?? 15,
        firebaseMin: floors.firebaseMin ?? 1,
        firebaseMax: floors.firebaseMax ?? 14,
        highscore: Array.isArray(floors.highscore) ? floors.highscore : [0, 15],
        highscoreRank: Array.isArray(floors.highscoreRank) ? floors.highscoreRank : [0]
      },
      shinyCompetition: config.shinyCompetition || null,
      countdownToast: config.countdownToast != null
        ? Object.assign({ maxDays: 10 }, config.countdownToast)
        : null,
      profileApiBase: config.profileApiBase
        || 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData'
    };
  }

  function createEventCompetitionInstance(rawConfig, deps) {
    const cfg = normalizeConfig(rawConfig);
    const {
      getCurrentMapCode,
      getPlayerSnapshot,
      isDisposed,
      getLeaderboardContainer,
      getUserBestScores,
      isSandboxMode,
      fetchLeaderboardData,
      getBestLeaderboardEntry,
      getEntryFloorTicks,
      scheduleTimeout,
      onLeaderboardsUpdate,
      t: translate,
      getApi,
      addSubscription,
      removeSubscription,
      getMedalColor,
      ui = {}
    } = deps;

    const {
      floorSectionConfig,
      rankSectionConfig,
      sectionWrapperStyle,
      entrySpanStyle,
      assets,
      createScoreIcon,
      formatLeaderboardEntry,
      appendWorldRecordPlaceholder,
      applySectionVisibility
    } = ui;

    const logPrefix = cfg.logPrefix;
    const ascensionFormula = cfg.ascensionFormula;
    const highscoreFloorsSet = new Set(cfg.floors.highscore);
    const highscoreRankFloorsSet = new Set(cfg.floors.highscoreRank);
    const COMPETITION_TAB = { RANK: 'rank', FLOOR: 'floor', SHINY: 'shiny' };
    const PROFILE_RATE_WINDOW_MS = 10000;
    const PROFILE_RATE_MAX = 28;
    const PROFILE_429_RETRY_AFTER_MS = 10500;
    const PROFILE_429_MAX_RETRIES = 2;
    const profileRequestTimestamps = [];
    const profileRateLimitQueue = [];
    const participantsPath = `${cfg.firebaseBase}/participants`;
    const scoresPath = `${cfg.firebaseBase}/scores`;
    const rankScoresPath = `${cfg.firebaseBase}/rank-scores`;

    const tEvent = (suffix, params) => translate(`${cfg.i18nPrefix}${suffix}`, params);

    const state = {
  joined: false,
  joinChecked: false,
  joinedAt: 0,
  playerHash: null,
  modalRef: null,
  layoutCleanup: null,
  lastSubmitAt: 0,
  lastRankSubmitAt: 0,
  lastProcessedSeed: null,
  myEventScores: {},
  myEventRankScores: {},
  myEventRankTicks: {},
  boardUnsubscribe: null,
  fetchRestore: null,
  runTrackerTrigger: null,
  eventTimerInterval: null,
  raidsUnsubscribe: null,
  countdownToastInterval: null,
  countdownRaidsUnsubscribe: null,
  lastCountdownToastDays: null,
  lastCountdownToastLiveShown: false,
  eventNextCheckEndTime: null,
  floorBarRows: null,
  floorBarCacheAt: 0,
  rankBarRows: null,
  rankBarCacheAt: 0,
  shinyBarRows: null,
  shinyBarCacheAt: 0,
  shinyScoresByName: null,
  activeModalTab: COMPETITION_TAB.FLOOR,
  lastBarFloor: null,
  trackedBattleSetup: null,
  playerTotalTicks: null,
  playerTotalRanks: null,
  playerTotalRankTicks: null,
  eventWasActive: false,
  participantCount: 0,
  fetchCache: new Map(),
  fetchInFlight: new Map(),
  profileCache: new Map(),
  profileFetchInFlight: new Map(),
  fullLoadInFlight: null,
  rankFullLoadInFlight: null,
  shinyFullLoadInFlight: null,
  lastFullLoadAt: 0,
  lastRankFullLoadAt: 0,
  lastShinyFullLoadAt: 0,
  lastParticipantSyncAt: 0,
  joinStateCachedAt: 0,
  eligibilityCheckedAt: 0,
  currentPlayerEligible: true,
  eligibilityByName: new Map(),
  purgeInFlight: null,
  lastIneligiblePurgeAt: 0,
  modalLoadSession: 0
};

const firebaseClient = {
  get(path, defaultReturn = null) {
    return fetch(`${path}.json`).then((r) => {
      if (!r.ok) return r.status === 404 ? defaultReturn : Promise.reject(new Error(`GET ${r.status}`));
      return r.json();
    }).catch((err) => {
      console.warn(`${logPrefix} Firebase GET error:`, err);
      return defaultReturn;
    });
  },
  put(path, data) {
    return fetch(`${path}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then((r) => {
      if (!r.ok) return Promise.reject(new Error(`PUT ${r.status}`));
      return r.json();
    });
  },
  delete(path) {
    return fetch(`${path}.json`, {
      method: 'DELETE'
    }).then((r) => {
      if (!r.ok) return Promise.reject(new Error(`DELETE ${r.status}`));
      return true;
    });
  }
};

function tblFirebaseGetCached(path, options = {}) {
  const {
    ttl = cfg.timers.fetchCacheTtlMs,
    defaultReturn = null,
    force = false
  } = options;
  const now = Date.now();

  if (!force) {
    const cached = state.fetchCache.get(path);
    if (cached && now - cached.at < ttl) {
      return Promise.resolve(cached.data);
    }
    const inFlight = state.fetchInFlight.get(path);
    if (inFlight) {
      return inFlight;
    }
  }

  const request = firebaseClient.get(path, defaultReturn)
    .then((data) => {
      state.fetchCache.set(path, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      state.fetchInFlight.delete(path);
    });

  state.fetchInFlight.set(path, request);
  return request;
}

function invalidateTblFetchCache(paths) {
  if (!paths) {
    state.fetchCache.clear();
    invalidateTblFloorBarCache();
    return;
  }
  const pathList = Array.isArray(paths) ? paths : [paths];
  pathList.forEach((path) => {
    state.fetchCache.delete(path);
  });
  invalidateTblFloorBarCache();
}

function buildTblParticipantHighscoreMap(participants) {
  const tickMap = new Map();
  const rankMap = new Map();
  const rankTickMap = new Map();
  if (!participants || typeof participants !== 'object') {
    return { tickMap, rankMap, rankTickMap };
  }
  Object.values(participants).forEach((participant) => {
    if (!participant?.name) {
      return;
    }
    const highscores = { 0: null, 15: null };
    const highscoreRanks = { 0: null, 15: null };
    const highscoreRankTicks = { 0: null, 15: null };
    const stored = participant.highscoreFloorTicks;
    if (stored && typeof stored === 'object') {
      if (Number.isFinite(Number(stored[0]))) {
        highscores[0] = Number(stored[0]);
      }
      if (Number.isFinite(Number(stored[15]))) {
        highscores[15] = Number(stored[15]);
      }
    }
    const storedRanks = participant.highscoreFloorRanks;
    if (storedRanks && typeof storedRanks === 'object') {
      if (Number.isFinite(Number(storedRanks[0]))) {
        highscoreRanks[0] = Number(storedRanks[0]);
      }
      if (Number.isFinite(Number(storedRanks[15]))) {
        highscoreRanks[15] = Number(storedRanks[15]);
      }
    }
    const storedRankTicks = participant.highscoreFloorRankTicks;
    if (storedRankTicks && typeof storedRankTicks === 'object') {
      if (Number.isFinite(Number(storedRankTicks[0]))) {
        highscoreRankTicks[0] = Number(storedRankTicks[0]);
      }
      if (Number.isFinite(Number(storedRankTicks[15]))) {
        highscoreRankTicks[15] = Number(storedRankTicks[15]);
      }
    }
    tickMap.set(participant.name, highscores);
    rankMap.set(participant.name, highscoreRanks);
    rankTickMap.set(participant.name, highscoreRankTicks);
  });
  return { tickMap, rankMap, rankTickMap };
}

async function loadTblParticipantsBundle(force = false) {
  const participantsRaw = await tblFirebaseGetCached(participantsPath, {
    ttl: cfg.timers.participantsCacheTtlMs,
    defaultReturn: {},
    force
  });
  const participants = await filterTblParticipants(participantsRaw);
  const count = !participants || typeof participants !== 'object'
    ? 0
    : Object.values(participants).filter((entry) => entry && entry.name).length;
  const { tickMap, rankMap, rankTickMap } = buildTblParticipantHighscoreMap(participants);
  return {
    participants: participants && typeof participants === 'object' ? participants : {},
    count,
    highscoreMap: tickMap,
    highscoreRankMap: rankMap,
    highscoreRankTickMap: rankTickMap
  };
}

function isTblShinyCompetitionEnabled() {
  return Boolean(cfg.shinyCompetition);
}

function getTblShinyCreatureGameId() {
  const shinyConfig = cfg.shinyCompetition;
  if (!shinyConfig) {
    return null;
  }
  if (Number.isFinite(shinyConfig.gameId)) {
    return Number(shinyConfig.gameId);
  }
  if (shinyConfig.creatureName) {
    const db = globalThis.creatureDatabase;
    const monster = db?.findMonsterByName?.(shinyConfig.creatureName);
    if (monster?.gameId != null) {
      return Number(monster.gameId);
    }
  }
  return null;
}

function buildTblProfileRequestUrl(playerName) {
  return `${cfg.profileApiBase}?batch=1&input=${encodeURIComponent(JSON.stringify({ '0': { json: playerName } }))}`;
}

function getTblProfileCacheRecord(playerName) {
  const entry = state.profileCache.get(playerName);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.at >= cfg.timers.profileCacheTtlMs) {
    state.profileCache.delete(playerName);
    return null;
  }
  return entry;
}

function setTblProfileCacheEntry(playerName, profileData) {
  state.profileCache.set(playerName, { data: profileData, at: Date.now() });
}

function isTblProfileCached(playerName) {
  return getTblProfileCacheRecord(playerName) !== null;
}

function processTblProfileRateLimitQueue() {
  if (!profileRateLimitQueue.length) {
    return;
  }
  const now = Date.now();
  while (profileRequestTimestamps.length && profileRequestTimestamps[0] < now - PROFILE_RATE_WINDOW_MS) {
    profileRequestTimestamps.shift();
  }
  if (profileRequestTimestamps.length >= PROFILE_RATE_MAX) {
    const waitMs = Math.min(
      PROFILE_RATE_WINDOW_MS,
      profileRequestTimestamps[0] + PROFILE_RATE_WINDOW_MS - now + 50
    );
    scheduleTimeout(processTblProfileRateLimitQueue, Math.max(100, waitMs));
    return;
  }
  const next = profileRateLimitQueue.shift();
  if (!next) {
    return;
  }
  profileRequestTimestamps.push(Date.now());
  next.run();
  if (profileRateLimitQueue.length) {
    scheduleTimeout(processTblProfileRateLimitQueue, 0);
  }
}

function withTblProfileRateLimit(task) {
  return new Promise((resolve, reject) => {
    profileRateLimitQueue.push({
      run: () => {
        Promise.resolve(task()).then(resolve).catch(reject);
      }
    });
    processTblProfileRateLimitQueue();
  });
}

function parseTblProfilePageDataResponse(data) {
  let profileData = null;
  if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
    profileData = data[0].result.data.json;
    if (data[0]?.result?.error || !profileData || (typeof profileData === 'object' && !profileData.name)) {
      return null;
    }
    return profileData;
  }
  profileData = data && typeof data === 'object' ? data : null;
  if (!profileData || (typeof profileData === 'object' && !profileData.name)) {
    return null;
  }
  return profileData;
}

async function fetchTblPlayerProfileNetwork(playerName, retryCount = 0) {
  const apiUrl = buildTblProfileRequestUrl(playerName);
  const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
  if (response.status === 429 && retryCount < PROFILE_429_MAX_RETRIES) {
    const retryAfter = parseInt(response.headers.get('Retry-After'), 10);
    let waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : PROFILE_429_RETRY_AFTER_MS;
    if (retryCount > 0) {
      waitMs = Math.min(20000, waitMs + retryCount * 2000);
    }
    if (waitMs > 0) {
      console.warn(
        `${logPrefix} Profile API rate limited (429), retrying after`,
        Math.round(waitMs / 1000),
        's (attempt',
        retryCount + 1,
        'of',
        PROFILE_429_MAX_RETRIES + 1,
        ')'
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    return fetchTblPlayerProfileNetwork(playerName, retryCount + 1);
  }
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return parseTblProfilePageDataResponse(data);
}

async function fetchTblPlayerProfile(playerName, force = false) {
  if (!playerName || typeof playerName !== 'string') {
    return null;
  }

  if (!force) {
    const cached = getTblProfileCacheRecord(playerName);
    if (cached) {
      return cached.data;
    }
    const inFlight = state.profileFetchInFlight.get(playerName);
    if (inFlight) {
      return inFlight;
    }
  } else {
    state.profileCache.delete(playerName);
  }

  const promise = (async () => {
    try {
      const profileData = await withTblProfileRateLimit(() => fetchTblPlayerProfileNetwork(playerName, 0));
      setTblProfileCacheEntry(playerName, profileData);
      return profileData;
    } catch (error) {
      if (!error?.message || (!error.message.includes('fetch') && !error.message.includes('network'))) {
        console.warn(`${logPrefix} Error fetching player profile:`, error);
      }
      return null;
    } finally {
      state.profileFetchInFlight.delete(playerName);
    }
  })();

  state.profileFetchInFlight.set(playerName, promise);
  return promise;
}

async function buildTblShinyScoresForParticipants(names, gameId, force = false) {
  const shinyScoresByName = new Map();
  const namesToFetch = [];

  names.forEach((name) => {
    if (force || !isTblProfileCached(name)) {
      namesToFetch.push(name);
      return;
    }
    const cachedProfile = getTblProfileCacheRecord(name)?.data ?? null;
    shinyScoresByName.set(name, countTblShinyCreatures(cachedProfile, gameId));
  });

  for (const name of namesToFetch) {
    if (isDisposed()) {
      break;
    }
    const profileData = await fetchTblPlayerProfile(name, force);
    shinyScoresByName.set(name, countTblShinyCreatures(profileData, gameId));
  }

  return shinyScoresByName;
}

function getTblServerUtcOffsetMs() {
  const offsetHours = Number(cfg.shinyCompetition?.serverUtcOffsetHours);
  if (Number.isFinite(offsetHours)) {
    return offsetHours * 60 * 60 * 1000;
  }
  // Bestiary Arena server wall clock is UTC-3 (e.g. 2026-07-17T00:00:00 server = 03:00 UTC).
  return 3 * 60 * 60 * 1000;
}

function parseTblServerTimeMs(value) {
  const str = String(value).trim();
  if (!str) {
    return 0;
  }
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z)?$/i);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ) + getTblServerUtcOffsetMs();
  }
  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTblShinyMinCreatedAtMs() {
  const minCreatedAt = cfg.shinyCompetition?.minCreatedAt;
  if (minCreatedAt == null || minCreatedAt === '') {
    return 0;
  }
  if (Number.isFinite(minCreatedAt)) {
    let ts = Number(minCreatedAt);
    if (ts > 0 && ts < 1e12) {
      ts *= 1000;
    }
    return ts;
  }
  return parseTblServerTimeMs(minCreatedAt);
}

function normalizeTblMonsterCreatedAtMs(createdAt) {
  let ts = Number(createdAt);
  if (!Number.isFinite(ts) || ts <= 0) {
    return null;
  }
  if (ts < 1e12) {
    ts *= 1000;
  }
  return ts;
}

function countTblShinyCreatures(profileData, gameId) {
  const minCreatedAtMs = getTblShinyMinCreatedAtMs();
  const monsters = Array.isArray(profileData?.monsters) ? profileData.monsters : [];
  let count = 0;
  let lastCreatedAt = 0;
  monsters.forEach((monster) => {
    if (Number(monster?.gameId) !== Number(gameId) || monster?.shiny !== true) {
      return;
    }
    const createdAtMs = normalizeTblMonsterCreatedAtMs(monster.createdAt);
    if (createdAtMs === null || createdAtMs < minCreatedAtMs) {
      return;
    }
    count += 1;
    if (createdAtMs > lastCreatedAt) {
      lastCreatedAt = createdAtMs;
    }
  });
  return { count, lastCreatedAt };
}

function sortTblShinyStandings(standings) {
  return [...standings].sort((a, b) => {
    const countA = Number(a.count) || 0;
    const countB = Number(b.count) || 0;
    if (countB !== countA) {
      return countB - countA;
    }
    const createdA = Number(a.lastCreatedAt) || 0;
    const createdB = Number(b.lastCreatedAt) || 0;
    if (createdB !== createdA) {
      return createdA - createdB;
    }
    return String(a.name).localeCompare(String(b.name));
  });
}

function buildTblShinyOverallStandings(rows, ensurePlayerName = null) {
  const standings = Array.isArray(rows)
    ? rows
      .filter((row) => Number(row.count) > 0)
      .map((row) => ({
        name: row.name,
        count: Number(row.count) || 0,
        lastCreatedAt: Number(row.lastCreatedAt) || 0,
        floorsLed: 0
      }))
    : [];

  if (ensurePlayerName && !standings.some((entry) => entry.name === ensurePlayerName)) {
    const viewerScore = (state.shinyScoresByName || new Map()).get(ensurePlayerName);
    const viewerCount = Number(viewerScore?.count) || 0;
    if (viewerCount > 0) {
      standings.push({
        name: ensurePlayerName,
        count: viewerCount,
        lastCreatedAt: Number(viewerScore?.lastCreatedAt) || 0,
        floorsLed: 0
      });
    }
  }

  return sortTblShinyStandings(standings);
}

function getTblPlayerShinyCount(playerName) {
  return Number((state.shinyScoresByName || new Map()).get(playerName)?.count) || 0;
}

function getTblPlayerShinyLastCreatedAt(playerName) {
  return Number((state.shinyScoresByName || new Map()).get(playerName)?.lastCreatedAt) || 0;
}

function formatTblShinyDropAgo(timestamp) {
  let ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) {
    return '—';
  }
  if (ts < 1e12) {
    ts *= 1000;
  }
  const diffMs = Date.now() - ts;
  if (diffMs < 0) {
    return tEvent('ShinyDropJustNow');
  }
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return tEvent('ShinyDropJustNow');
  }
  if (diffMins < 60) {
    return tEvent('ShinyDropMinutesAgo', { minutes: diffMins });
  }
  if (diffHours < 48) {
    return tEvent('ShinyDropHoursAgo', { hours: diffHours });
  }
  if (diffDays === 1) {
    return tEvent('ShinyDropDayAgo');
  }
  return tEvent('ShinyDropDaysAgo', { days: diffDays });
}

function getTblPlayerShinyDropLabel(player) {
  const lastCreatedAt = Number(
    player?.lastCreatedAt ?? getTblPlayerShinyLastCreatedAt(player?.name)
  ) || 0;
  if (!lastCreatedAt) {
    return tEvent('ShinyDropNone');
  }
  return formatTblShinyDropAgo(lastCreatedAt);
}

async function loadTblAllShinyData(force = false) {
  if (!isTblShinyCompetitionEnabled()) {
    return state.shinyBarRows || [];
  }

  const now = Date.now();
  if (
    !force &&
    state.shinyBarRows &&
    now - state.shinyBarCacheAt < cfg.timers.fetchCacheTtlMs
  ) {
    return state.shinyBarRows;
  }
  if (
    !force &&
    state.shinyBarRows &&
    now - state.lastShinyFullLoadAt < cfg.timers.fetchMinIntervalMs
  ) {
    return state.shinyBarRows;
  }
  if (state.shinyFullLoadInFlight) {
    return state.shinyFullLoadInFlight;
  }

  state.shinyFullLoadInFlight = (async () => {
    try {
      if (isDisposed()) {
        return state.shinyBarRows || [];
      }

      const gameId = getTblShinyCreatureGameId();
      if (!Number.isFinite(gameId)) {
        console.warn(`${logPrefix} Shiny competition enabled but creature gameId is unavailable`);
        return state.shinyBarRows || [];
      }

      const participantBundle = await loadTblParticipantsBundle(force);
      const participantNames = Object.values(participantBundle.participants || {})
        .map((participant) => participant?.name)
        .filter(Boolean);

      const uniqueNames = [...new Set(participantNames)];
      const shinyScoresByName = await buildTblShinyScoresForParticipants(uniqueNames, gameId, force);

      if (isDisposed()) {
        return state.shinyBarRows || [];
      }

      state.shinyScoresByName = shinyScoresByName;
      state.participantCount = participantBundle.count;

      const rows = sortTblShinyStandings(uniqueNames.map((name) => {
        const score = shinyScoresByName.get(name) || { count: 0, lastCreatedAt: 0 };
        return {
          name,
          count: score.count,
          lastCreatedAt: score.lastCreatedAt
        };
      }))
        .filter((row) => Number(row.count) > 0)
        .map((row, index) => ({
          ...row,
          rank: index + 1
        }));

      state.shinyBarRows = rows;
      state.shinyBarCacheAt = Date.now();
      state.lastShinyFullLoadAt = Date.now();
      return rows;
    } catch (error) {
      console.warn(`${logPrefix} Failed to load shiny competition data:`, error);
      return state.shinyBarRows || [];
    } finally {
      state.shinyFullLoadInFlight = null;
    }
  })();

  return state.shinyFullLoadInFlight;
}

function tblScoresPath(floor) {
  return `${scoresPath}/${floor}`;
}

function tblRankScoresPath(floor) {
  return `${rankScoresPath}/${floor}`;
}

function isTblMapActive(mapCode = getCurrentMapCode()) {
  return mapCode === cfg.roomId;
}

function getTblCurrentBoardRoomId() {
  try {
    const roomId = globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom?.id;
    return typeof roomId === 'string' && roomId.length > 0 ? roomId : null;
  } catch (error) {
    return null;
  }
}

function isTblOnEventBoardRoom() {
  return getTblCurrentBoardRoomId() === cfg.roomId;
}

function getTblPlayerName() {
  const snapshot = getPlayerSnapshot();
  return snapshot?.context?.name || snapshot?.context?.playerName || null;
}

async function isTblPlayerEligibleByName(name) {
  if (!name) {
    return false;
  }
  const key = String(name).toLowerCase();
  if (state.eligibilityByName.has(key)) {
    return state.eligibilityByName.get(key);
  }
  if (typeof cfg.isPlayerEligible !== 'function') {
    state.eligibilityByName.set(key, true);
    return true;
  }
  try {
    const eligible = await cfg.isPlayerEligible(name);
    const normalized = eligible !== false;
    state.eligibilityByName.set(key, normalized);
    return normalized;
  } catch (error) {
    console.warn(`${logPrefix} Player eligibility check failed:`, error);
    state.eligibilityByName.set(key, true);
    return true;
  }
}

async function isTblCurrentPlayerEligible(force = false) {
  const name = getTblPlayerName();
  if (!name) {
    state.currentPlayerEligible = false;
    return false;
  }
  const now = Date.now();
  if (
    !force &&
    state.eligibilityCheckedAt &&
    now - state.eligibilityCheckedAt < cfg.timers.joinStateCacheTtlMs
  ) {
    return state.currentPlayerEligible;
  }
  const eligible = await isTblPlayerEligibleByName(name);
  state.currentPlayerEligible = eligible;
  state.eligibilityCheckedAt = now;
  return eligible;
}

async function filterTblNamedEntries(entries) {
  if (!Array.isArray(entries) || !entries.length || typeof cfg.isPlayerEligible !== 'function') {
    return Array.isArray(entries) ? entries : [];
  }
  const checks = await Promise.all(entries.map(async (entry) => {
    if (!entry?.name) {
      return false;
    }
    return isTblPlayerEligibleByName(entry.name);
  }));
  return entries.filter((_, index) => checks[index]);
}

async function filterTblParticipants(participants) {
  if (!participants || typeof participants !== 'object' || typeof cfg.isPlayerEligible !== 'function') {
    return participants && typeof participants === 'object' ? participants : {};
  }
  const filtered = {};
  const checks = await Promise.all(Object.entries(participants).map(async ([hash, participant]) => {
    if (!participant?.name) {
      return [hash, null];
    }
    const eligible = await isTblPlayerEligibleByName(participant.name);
    return [hash, eligible ? participant : null];
  }));
  checks.forEach(([hash, participant]) => {
    if (participant) {
      filtered[hash] = participant;
    }
  });
  return filtered;
}

function getTblIneligiblePurgeStorageKey() {
  return `event-competition-ineligible-purge-${cfg.id}`;
}

function readTblIneligiblePurgeTimestamp() {
  if (typeof localStorage === 'undefined') {
    return 0;
  }
  try {
    const raw = localStorage.getItem(getTblIneligiblePurgeStorageKey());
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

function writeTblIneligiblePurgeTimestamp(timestamp) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(getTblIneligiblePurgeStorageKey(), String(timestamp));
  } catch (error) {
    // Ignore storage failures.
  }
}

async function purgeTblIneligibleFirebaseRecords(force = false) {
  if (typeof cfg.isPlayerEligible !== 'function') {
    return 0;
  }
  const now = Date.now();
  const lastPersisted = readTblIneligiblePurgeTimestamp();
  const lastPurgeAt = Math.max(state.lastIneligiblePurgeAt, lastPersisted);
  if (
    !force &&
    lastPurgeAt > 0 &&
    now - lastPurgeAt < cfg.timers.ineligiblePurgeMinIntervalMs
  ) {
    return 0;
  }
  if (state.purgeInFlight) {
    return state.purgeInFlight;
  }

  state.purgeInFlight = (async () => {
    try {
      const participantsRaw = await firebaseClient.get(participantsPath, {});
      const participants = participantsRaw && typeof participantsRaw === 'object'
        ? participantsRaw
        : {};
      const ineligibleNames = new Set();
      const ineligibleHashes = new Set();

      const participantEntries = Object.entries(participants);
      for (const [hash, participant] of participantEntries) {
        const participantName = participant?.name;
        if (!participantName) {
          continue;
        }
        const eligible = await isTblPlayerEligibleByName(participantName);
        if (!eligible) {
          ineligibleNames.add(String(participantName).toLowerCase());
          ineligibleHashes.add(hash);
        }
      }

      if (!ineligibleNames.size && !ineligibleHashes.size) {
        state.lastIneligiblePurgeAt = Date.now();
        writeTblIneligiblePurgeTimestamp(state.lastIneligiblePurgeAt);
        return 0;
      }

      const deletePaths = new Set();
      ineligibleHashes.forEach((hash) => {
        deletePaths.add(`${participantsPath}/${hash}`);
      });

      const collectionRoots = [
        scoresPath,
        rankScoresPath,
        `${cfg.firebaseBase}/replays`,
        `${cfg.firebaseBase}/rank-replays`
      ];

      for (const rootPath of collectionRoots) {
        const floors = await firebaseClient.get(rootPath, {});
        if (!floors || typeof floors !== 'object') {
          continue;
        }
        for (const [floorKey, floorEntries] of Object.entries(floors)) {
          if (!floorEntries || typeof floorEntries !== 'object') {
            continue;
          }
          for (const [hash, record] of Object.entries(floorEntries)) {
            const recordNameRaw =
              typeof record?.name === 'string' ? record.name
                : (typeof record?.userName === 'string' ? record.userName
                  : (typeof record?.playerName === 'string' ? record.playerName : null));
            const recordName = recordNameRaw ? recordNameRaw.toLowerCase() : null;
            let shouldDelete = ineligibleHashes.has(hash) || (recordName && ineligibleNames.has(recordName));
            if (!shouldDelete && recordNameRaw) {
              const eligible = await isTblPlayerEligibleByName(recordNameRaw);
              if (!eligible) {
                shouldDelete = true;
                ineligibleNames.add(recordNameRaw.toLowerCase());
                ineligibleHashes.add(hash);
              }
            }
            if (shouldDelete) {
              deletePaths.add(`${rootPath}/${floorKey}/${hash}`);
            }
          }
        }
      }

      if (!deletePaths.size) {
        state.lastIneligiblePurgeAt = Date.now();
        writeTblIneligiblePurgeTimestamp(state.lastIneligiblePurgeAt);
        return 0;
      }

      await Promise.all(Array.from(deletePaths).map((path) => firebaseClient.delete(path).catch(() => null)));
      invalidateTblFetchCache();
      state.lastIneligiblePurgeAt = Date.now();
      writeTblIneligiblePurgeTimestamp(state.lastIneligiblePurgeAt);
      console.log(`${logPrefix} Purged ineligible records: ${deletePaths.size}`);
      return deletePaths.size;
    } finally {
      state.purgeInFlight = null;
    }
  })();

  return state.purgeInFlight;
}

async function hashTblPlayerName(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(username).toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getTblPlayerHash() {
  if (state.playerHash) {
    return state.playerHash;
  }
  const name = getTblPlayerName();
  if (!name) {
    return null;
  }
  state.playerHash = await hashTblPlayerName(name);
  return state.playerHash;
}

function readTblJoinedLocal() {
  try {
    return localStorage.getItem(cfg.joinStorageKey) === '1';
  } catch (error) {
    return false;
  }
}

function isTblPlayerJoined() {
  return state.joined || readTblJoinedLocal();
}

function writeTblJoinedLocal(joined) {
  try {
    if (joined) {
      localStorage.setItem(cfg.joinStorageKey, '1');
    } else {
      localStorage.removeItem(cfg.joinStorageKey);
    }
  } catch (error) {
    console.warn(`${logPrefix} Could not persist join state:`, error);
  }
}

async function refreshTblJoinState(force = false) {
  const name = getTblPlayerName();
  if (!name) {
    state.joined = false;
    state.joinChecked = true;
    return false;
  }
  const hash = await getTblPlayerHash();
  if (!hash) {
    state.joined = false;
    state.joinChecked = true;
    return false;
  }
  const eligible = await isTblCurrentPlayerEligible(force);
  if (!eligible) {
    state.joined = false;
    state.joinChecked = true;
    state.joinedAt = 0;
    state.joinStateCachedAt = Date.now();
    writeTblJoinedLocal(false);
    return false;
  }

  const now = Date.now();
  if (
    !force &&
    state.joinChecked &&
    now - state.joinStateCachedAt < cfg.timers.joinStateCacheTtlMs
  ) {
    return state.joined;
  }

  const participantPath = `${participantsPath}/${hash}`;
  const remote = await tblFirebaseGetCached(participantPath, {
    ttl: cfg.timers.joinStateCacheTtlMs,
    defaultReturn: null,
    force
  });
  const joined = Boolean(remote && remote.name);
  state.joined = joined;
  state.joinedAt = joined ? (Number(remote.joinedAt) || 0) : 0;
  state.joinChecked = true;
  state.joinStateCachedAt = now;
  writeTblJoinedLocal(joined);
  return joined;
}

async function joinTblFloorLeague() {
  const name = getTblPlayerName();
  if (!name) {
    console.warn(`${logPrefix} Cannot join without player name`);
    return false;
  }
  const hash = await getTblPlayerHash();
  if (!hash) {
    return false;
  }
  const eligible = await isTblCurrentPlayerEligible(true);
  if (!eligible) {
    state.joined = false;
    state.joinChecked = true;
    writeTblJoinedLocal(false);
    return false;
  }
  const joinedAt = Date.now();
  await firebaseClient.put(
    `${participantsPath}/${hash}`,
    buildTblParticipantRecord(null, name, joinedAt)
  );
  invalidateTblFetchCache(participantsPath);
  invalidateTblFetchCache(`${participantsPath}/${hash}`);
  state.joined = true;
  state.joinedAt = joinedAt;
  state.joinChecked = true;
  writeTblJoinedLocal(true);
  invalidateTblFloorBarCache();
  refreshTblFloorBarSection().catch(() => {});
  await refreshTblFloorLeagueModalIfOpen();
  onLeaderboardsUpdate();
  return true;
}

function getTblRoomIdFromServerResults(serverResults) {
  return serverResults?.rewardScreen?.roomId || serverResults?.roomId || null;
}

function getTblFloorTicksFromServerResults(serverResults) {
  const reward = serverResults?.rewardScreen;
  if (!reward) {
    return null;
  }
  const candidates = [
    reward.floorTicks,
    serverResults.floorTicks,
    reward.gameTicks,
    serverResults.time
  ];
  for (const value of candidates) {
    const ticks = Number(value);
    if (Number.isFinite(ticks) && ticks > 0) {
      return ticks;
    }
  }
  return null;
}

function getTblRankFromServerResults(serverResults) {
  const reward = serverResults?.rewardScreen;
  if (!reward) {
    return null;
  }
  const rank = Number(reward.rank);
  if (!Number.isFinite(rank) || rank <= 0) {
    return null;
  }
  return rank;
}

function isTblFirebaseRankFloor(floor) {
  return floor >= 1 && floor <= cfg.floors.max;
}

function isTblHighscoreRankFloor(floor) {
  return highscoreRankFloorsSet.has(floor);
}

function isTblRankScoreBetter(candidateRank, candidateTicks, existing) {
  if (!existing || !Number.isFinite(Number(existing.rank))) {
    return true;
  }
  const previousRank = Number(existing.rank);
  const previousTicks = Number.isFinite(Number(existing.ticks)) ? Number(existing.ticks) : null;
  if (candidateRank > previousRank) {
    return true;
  }
  if (candidateRank < previousRank) {
    return false;
  }
  if (candidateTicks === null || candidateTicks === undefined) {
    return false;
  }
  if (previousTicks === null || previousTicks === undefined) {
    return true;
  }
  return candidateTicks < previousTicks;
}

function isTblPlayerBoardPiece(piece) {
  return piece?.type === 'player' || piece?.type === 'custom';
}

function getTblInventoryMonster(databaseId) {
  if (!databaseId) {
    return null;
  }
  const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
  if (!Array.isArray(monsters)) {
    return null;
  }
  return monsters.find((monster) => monster.id === databaseId) || null;
}

function getTblInventoryEquipment(equipId) {
  if (equipId === null || equipId === undefined) {
    return null;
  }
  const equips = globalThis.state?.player?.getSnapshot?.()?.context?.equips;
  if (!Array.isArray(equips)) {
    return null;
  }
  return equips.find((equip) => String(equip.id) === String(equipId)) || null;
}

function serializeTblBoardPiece(piece) {
  const boardPiece = {
    tile: piece.tileIndex,
    monsterId: piece.monsterId || piece.gameId || piece.databaseId || null,
    databaseId: piece.databaseId || null,
    level: piece.level || 50
  };

  if (piece.monster?.name) {
    boardPiece.monsterName = piece.monster.name;
    boardPiece.monsterStats = {
      hp: piece.monster.hp ?? 20,
      ad: piece.monster.ad ?? 20,
      ap: piece.monster.ap ?? 20,
      armor: piece.monster.armor ?? 20,
      magicResist: piece.monster.magicResist ?? 20
    };
  } else if (piece.monsterName) {
    boardPiece.monsterName = piece.monsterName;
  } else if (piece.name) {
    boardPiece.monsterName = piece.name;
  }

  const inventoryMonster = getTblInventoryMonster(piece.databaseId);
  if (inventoryMonster) {
    if (globalThis.state?.utils?.expToCurrentLevel) {
      boardPiece.level = globalThis.state.utils.expToCurrentLevel(inventoryMonster.exp);
    }
    boardPiece.monsterStats = {
      hp: inventoryMonster.hp,
      ad: inventoryMonster.ad,
      ap: inventoryMonster.ap,
      armor: inventoryMonster.armor,
      magicResist: inventoryMonster.magicResist
    };
    if (inventoryMonster.genes) {
      boardPiece.genes = inventoryMonster.genes;
    }
  } else if (
    piece.hp !== undefined ||
    piece.ad !== undefined ||
    piece.ap !== undefined ||
    piece.armor !== undefined ||
    piece.magicResist !== undefined
  ) {
    boardPiece.monsterStats = {
      hp: piece.hp ?? 20,
      ad: piece.ad ?? 20,
      ap: piece.ap ?? 20,
      armor: piece.armor ?? 20,
      magicResist: piece.magicResist ?? 20
    };
  }

  const equipSource = piece.equip || piece.equipment;
  if (equipSource) {
    boardPiece.equipId = equipSource.gameId ?? equipSource.id ?? piece.equipId ?? null;
    boardPiece.equipmentName = equipSource.name || null;
    boardPiece.equipmentStat = equipSource.stat || 'ap';
    boardPiece.equipmentTier = equipSource.tier || 5;
  } else if (piece.equipId) {
    boardPiece.equipId = piece.equipId;
    const inventoryEquip = getTblInventoryEquipment(piece.equipId);
    if (inventoryEquip) {
      boardPiece.equipmentStat = inventoryEquip.stat || 'ap';
      boardPiece.equipmentTier = inventoryEquip.tier || 5;
    }
  }

  return boardPiece;
}

function buildTblSetupFromBoardConfig(boardConfig) {
  if (!Array.isArray(boardConfig)) {
    return null;
  }

  const pieces = boardConfig
    .filter(isTblPlayerBoardPiece)
    .map(serializeTblBoardPiece)
    .sort((a, b) => a.tile - b.tile);

  if (!pieces.length) {
    return null;
  }

  return {
    mapId: cfg.roomId,
    pieces
  };
}

function getTblSetupFromCurrentBoard() {
  const boardConfig = globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig;
  return buildTblSetupFromBoardConfig(boardConfig);
}

function trackTblBattleSetup(context) {
  if (!isTblMapActive() || context?.serverResults?.rewardScreen) {
    return;
  }

  const setup = buildTblSetupFromBoardConfig(context?.boardConfig);
  if (setup?.pieces?.length) {
    state.trackedBattleSetup = setup;
  }
}

function getTblSetupForSubmission() {
  const setup = state.trackedBattleSetup || getTblSetupFromCurrentBoard();
  state.trackedBattleSetup = null;
  return setup?.pieces?.length ? setup : null;
}

function parseTblSerializedBoard() {
  if (typeof window.$serializeBoard === 'function') {
    try {
      return JSON.parse(window.$serializeBoard());
    } catch (error) {
      // Fall through to BestiaryModAPI
    }
  }
  if (window.BestiaryModAPI?.utility?.serializeBoard) {
    try {
      return JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
    } catch (error) {
      return null;
    }
  }
  return null;
}

function buildTblReplayBoardFromSetup(setup) {
  if (!setup?.pieces?.length) {
    return [];
  }

  return setup.pieces.map((piece) => {
    const boardPiece = {
      tile: piece.tile || 0
    };
    const level = piece.level || 1;
    const stats = piece.monsterStats || {};
    const monster = {
      name: String(piece.monsterName || piece.monsterId || 'unknown').toLowerCase(),
      level,
      hp: stats.hp ?? 20,
      ad: stats.ad ?? 20,
      ap: stats.ap ?? 20,
      armor: stats.armor ?? 20,
      magicResist: stats.magicResist ?? 20
    };
    if (level > 50) {
      monster.awakened = true;
    }
    boardPiece.monster = monster;

    if (piece.equipmentName || piece.equipId) {
      boardPiece.equipment = {
        name: String(piece.equipmentName || piece.equipId || 'unknown').toLowerCase(),
        stat: piece.equipmentStat || 'ap',
        tier: piece.equipmentTier || 5
      };
    }

    return boardPiece;
  });
}

function buildTblReplayString(serverResults, floor, setup) {
  if (!serverResults || serverResults.seed === undefined || serverResults.seed === null) {
    return '';
  }

  const boardJson = parseTblSerializedBoard();
  const replayData = {};

  if (boardJson?.board) {
    if (boardJson.region) {
      replayData.region = boardJson.region;
    }
    replayData.map = boardJson.map || cfg.roomId;
    replayData.floor = Number.isFinite(floor) ? floor : (boardJson.floor ?? 0);
    replayData.board = boardJson.board;
  } else if (setup?.pieces?.length) {
    replayData.map = cfg.roomId;
    replayData.floor = Number.isFinite(floor) ? floor : 0;
    replayData.board = buildTblReplayBoardFromSetup(setup);
  } else {
    return '';
  }

  if (!replayData.region) {
    const boardSnapshot = globalThis.state?.board?.getSnapshot?.()?.context;
    const regionName = boardSnapshot?.selectedMap?.selectedRegion?.name
      || boardSnapshot?.selectedMap?.selectedRegion?.id;
    if (regionName) {
      replayData.region = regionName;
    }
  }

  replayData.seed = serverResults.seed;
  return `$replay(${JSON.stringify(replayData)})`;
}

async function buildTblReplayStringWithRetry(serverResults, floor, setup, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const replay = buildTblReplayString(serverResults, floor, setup);
    if (replay) {
      return replay;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => scheduleTimeout(resolve, (attempt + 1) * 200));
    }
  }
  return '';
}

function getTblToastContainer() {
  if (typeof document === 'undefined') {
    return null;
  }
  let container = document.getElementById(cfg.toast.containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = cfg.toast.containerId;
    container.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(container);
  }
  return container;
}

function updateTblToastPositions(container) {
  if (!container) {
    return;
  }
  container.querySelectorAll('.tbl-event-toast-item').forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * 46}px)`;
  });
}

function showTblEventToast(message, options = {}) {
  const rawMessage = message != null && message !== '' ? String(message) : '';
  if (!rawMessage) {
    return;
  }
  const useHtml = options.html === true || hasTblEventHighlightTags(rawMessage);

  try {
    const container = getTblToastContainer();
    if (!container) {
      return;
    }

    const duration = typeof options.duration === 'number' && options.duration > 0
      ? options.duration
      : cfg.toast.durationMs;
    const existingToasts = container.querySelectorAll('.tbl-event-toast-item');
    const stackOffset = existingToasts.length * 46;
    const flexContainer = document.createElement('div');
    flexContainer.className = 'tbl-event-toast-item';
    flexContainer.style.cssText = `display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-${stackOffset}px); bottom: 0px; right: 0px; justify-content: flex-end; pointer-events: none; width: max-content; max-width: 100%;`;

    const toast = document.createElement('button');
    toast.type = 'button';
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    toast.style.pointerEvents = 'auto';

    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';
    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    if (rawMessage.indexOf('\n') !== -1) {
      messageDiv.style.whiteSpace = 'pre-line';
    }
    if (useHtml) {
      messageDiv.innerHTML = formatTblEventHighlightHtml(rawMessage);
    } else {
      if (options.messageColor) {
        messageDiv.style.color = options.messageColor;
      }
      messageDiv.textContent = rawMessage.replace(/</g, '&lt;');
    }
    widgetBottom.appendChild(messageDiv);

    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);

    const removeToast = () => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateTblToastPositions(container);
      }
    };

    toast.addEventListener('click', () => {
      removeToast();
      if (typeof options.onClick === 'function') {
        Promise.resolve(options.onClick()).catch((error) => {
          console.warn(`${logPrefix} Toast click action failed:`, error);
        });
      }
    });
    if (typeof options.onClick === 'function') {
      toast.style.cursor = 'pointer';
    }
    scheduleTimeout(removeToast, duration);
  } catch (error) {
    console.warn(`${logPrefix} Toast failed:`, error);
  }
}

function getTblEventRaidEntry() {
  const list = globalThis.state?.raids?.getSnapshot?.()?.context?.list || [];
  return list.find((raid) => raid.roomId === cfg.roomId) || null;
}

function isTblEventCompetitionActive() {
  return getTblEventTimerState().active;
}

function getTblEventTimerState() {
  const now = Date.now();
  const raid = getTblEventRaidEntry();
  if (raid?.expiresAt && Number(raid.expiresAt) > now) {
    state.eventNextCheckEndTime = null;
    return {
      active: true,
      msRemaining: Number(raid.expiresAt) - now
    };
  }

  const raidContext = globalThis.state?.raids?.getSnapshot?.()?.context;
  const willUpdateAt = Number(raidContext?.willUpdateAt) || 0;
  const msUntilUpdate = Number(raidContext?.msUntilNextUpdate) || 0;

  if (willUpdateAt > now) {
    state.eventNextCheckEndTime = willUpdateAt;
  } else if (msUntilUpdate > 0) {
    if (!state.eventNextCheckEndTime || state.eventNextCheckEndTime <= now) {
      state.eventNextCheckEndTime = now + msUntilUpdate;
    }
  } else {
    state.eventNextCheckEndTime = null;
  }

  return {
    active: false,
    msRemaining: state.eventNextCheckEndTime
      ? Math.max(0, state.eventNextCheckEndTime - now)
      : 0
  };
}

function formatTblEventTimer(msRemaining) {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function getTblEventTimerColor(msRemaining, active) {
  if (!active) {
    return '#ccc';
  }
  if (msRemaining < 60000) {
    return '#f88';
  }
  if (msRemaining < 300000) {
    return '#ff8';
  }
  return '#8f8';
}

function getTblEventDaysRemaining(msRemaining) {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  return Math.floor(totalSeconds / 86400);
}

function getTblEventMapName() {
  const roomNames = globalThis.state?.utils?.ROOM_NAME || {};
  return roomNames[cfg.roomId] || cfg.roomId;
}

function getTblEventCountdownToastMessage(daysRemaining) {
  if (daysRemaining === 0) {
    return tEvent('EventEndsTodayToast');
  }
  if (daysRemaining === 1) {
    return tEvent('EventDayLeftToast');
  }
  return tEvent('EventDaysLeftToast', { days: daysRemaining });
}

function getTblEventLiveToastMessage() {
  const liveMessage = cfg.countdownToast?.liveMessage;
  const mapName = getTblEventMapName();
  if (typeof liveMessage === 'function') {
    return liveMessage(mapName);
  }
  if (typeof liveMessage === 'string' && liveMessage.trim()) {
    return liveMessage.replace(/\{mapName\}/g, mapName);
  }
  return tEvent('EventLiveToast', { mapName });
}

function maybeShowTblEventCountdownToast(options = {}) {
  const maxDays = cfg.countdownToast?.maxDays;
  if (!maxDays || maxDays <= 0) {
    return;
  }

  const { active, msRemaining } = getTblEventTimerState();
  if (!active || msRemaining <= 0) {
    return;
  }

  const daysRemaining = getTblEventDaysRemaining(msRemaining);
  const force = options.force === true;

  if (daysRemaining >= maxDays) {
    if (!force && state.lastCountdownToastLiveShown) {
      return;
    }

    state.lastCountdownToastLiveShown = true;
    state.lastCountdownToastDays = null;
    showTblEventToast(
      getTblEventLiveToastMessage(),
      {
        onClick: () => openTblCompetitionFromCountdownToast()
      }
    );
    return;
  }

  state.lastCountdownToastLiveShown = false;
  if (!force && state.lastCountdownToastDays === daysRemaining) {
    return;
  }

  state.lastCountdownToastDays = daysRemaining;
  showTblEventToast(
    getTblEventCountdownToastMessage(daysRemaining),
    {
      onClick: () => openTblCompetitionFromCountdownToast()
    }
  );
}

async function openTblCompetitionFromCountdownToast() {
  if (!isTblOnEventBoardRoom()) {
    const navigated = await navigateTblToEventMap();
    if (navigated) {
      onLeaderboardsUpdate?.();
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  if (!isTblPlayerJoined()) {
    return;
  }

  await refreshTblJoinState().catch(() => {});
  if (!isTblPlayerJoined()) {
    return;
  }

  openTblFloorLeagueModal();
}

function updateTblEventCountdownToast() {
  if (isDisposed()) {
    return;
  }
  maybeShowTblEventCountdownToast();
}

function clearTblEventCountdownToastWatcher() {
  if (state.countdownToastInterval) {
    clearInterval(state.countdownToastInterval);
    state.countdownToastInterval = null;
  }
  unsubscribeTblSubscription(state.countdownRaidsUnsubscribe);
  state.countdownRaidsUnsubscribe = null;
}

function setupTblEventCountdownToastWatcher() {
  if (!cfg.countdownToast?.maxDays) {
    return;
  }

  clearTblEventCountdownToastWatcher();
  maybeShowTblEventCountdownToast({ force: true });
  state.countdownToastInterval = setInterval(
    updateTblEventCountdownToast,
    cfg.timers.eventIntervalMs
  );
  if (globalThis.state?.raids?.subscribe) {
    state.countdownRaidsUnsubscribe = globalThis.state.raids.subscribe(() => {
      state.eventNextCheckEndTime = null;
      updateTblEventCountdownToast();
    });
  }
}

function getTblShinyStartTimerState() {
  const minCreatedAtMs = getTblShinyMinCreatedAtMs();
  if (!minCreatedAtMs) {
    return { started: true, msUntilStart: 0 };
  }
  const msUntilStart = minCreatedAtMs - Date.now();
  return {
    started: msUntilStart <= 0,
    msUntilStart: Math.max(0, msUntilStart)
  };
}

function updateTblEventTimerDisplay() {
  if (isDisposed()) {
    return;
  }
  const valueEls = document.querySelectorAll('.tbl-event-timer-value');
  if (!valueEls.length) {
    return;
  }

  const isShinyTab = state.activeModalTab === COMPETITION_TAB.SHINY && isTblShinyCompetitionEnabled();
  const shinyStart = isShinyTab ? getTblShinyStartTimerState() : null;
  const { active, msRemaining } = getTblEventTimerState();
  if (active) {
    state.eventWasActive = true;
  }
  valueEls.forEach((valueEl) => {
    if (isShinyTab && shinyStart && !shinyStart.started) {
      valueEl.innerHTML = formatTblEventTimerValueHtml(
        'ShinyStartsIn',
        formatTblEventTimer(shinyStart.msUntilStart),
        '#f88'
      );
      valueEl.style.color = '';
      return;
    }

    if (active && msRemaining > 0) {
      valueEl.innerHTML = formatTblEventTimerValueHtml(
        'EventEndsIn',
        formatTblEventTimer(msRemaining),
        getTblEventTimerColor(msRemaining, true)
      );
      valueEl.style.color = '';
      return;
    }

    if (state.eventWasActive) {
      valueEl.innerHTML = formatTblEventHighlightHtml(tEvent('EventEnded'));
      valueEl.style.color = '';
      return;
    }

    if (msRemaining > 0) {
      valueEl.innerHTML = formatTblEventTimerValueHtml(
        'EventInactiveCheck',
        formatTblEventTimer(msRemaining),
        '#ccc'
      );
      valueEl.style.color = '';
      return;
    }

    valueEl.innerHTML = formatTblEventHighlightHtml(tEvent('EventInactive'));
    valueEl.style.color = '';
  });
}

function unsubscribeTblSubscription(subscription) {
  if (!subscription) {
    return;
  }
  if (typeof subscription === 'function') {
    subscription();
    return;
  }
  if (typeof subscription.unsubscribe === 'function') {
    subscription.unsubscribe();
  }
}

function clearTblEventTimerUpdates() {
  if (state.eventTimerInterval) {
    clearInterval(state.eventTimerInterval);
    state.eventTimerInterval = null;
  }
  unsubscribeTblSubscription(state.raidsUnsubscribe);
  state.raidsUnsubscribe = null;
}

function setupTblEventTimerUpdates() {
  clearTblEventTimerUpdates();
  state.eventNextCheckEndTime = null;
  updateTblEventTimerDisplay();
  state.eventTimerInterval = setInterval(
    updateTblEventTimerDisplay,
    cfg.timers.eventIntervalMs
  );
  if (globalThis.state?.raids?.subscribe) {
    state.raidsUnsubscribe = globalThis.state.raids.subscribe(() => {
      state.eventNextCheckEndTime = null;
      updateTblEventTimerDisplay();
    });
  }
}

function createTblEventCompetitionButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = [
    'tbl-event-competition-btn',
    'focus-style-visible',
    'flex',
    'items-center',
    'justify-center',
    'tracking-wide',
    'text-whiteRegular',
    'frame-1',
    'active:frame-pressed-1',
    'surface-regular',
    'gap-1',
    'px-1',
    'py-0',
    'pb-[2px]',
    'pixel-font-14'
  ].join(' ');
  button.title = tEvent('OpenHint');
  Object.assign(button.style, {
    marginLeft: '0',
    cursor: 'pointer',
    flexShrink: '0',
    lineHeight: '1'
  });

  const icon = document.createElement('img');
  icon.src = cfg.eventButtonIcon || 'https://bestiaryarena.com/assets/icons/wc-mini-icon.png';
  icon.alt = '';
  icon.className = 'pixelated';
  Object.assign(icon.style, {
    width: '11px',
    height: '11px',
    objectFit: 'contain',
    flexShrink: '0'
  });
  button.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'tbl-event-competition-btn-label';
  label.style.whiteSpace = 'nowrap';
  const showBoardLabel = state.joined || state.currentPlayerEligible === false;
  label.textContent = showBoardLabel
    ? tEvent('Board')
    : tEvent('Join');
  if (!showBoardLabel) {
    label.style.color = '#ffd700';
  }
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && typeof label.animate === 'function') {
    label.animate(
      [
        { color: '#ffd84d', textShadow: '0 0 3px rgba(255, 216, 77, 0.35)' },
        { color: '#56e3ff', textShadow: '0 0 3px rgba(86, 227, 255, 0.35)' },
        { color: '#8dff6a', textShadow: '0 0 3px rgba(141, 255, 106, 0.35)' },
        { color: '#ff74d4', textShadow: '0 0 3px rgba(255, 116, 212, 0.35)' },
        { color: '#ffd84d', textShadow: '0 0 3px rgba(255, 216, 77, 0.35)' }
      ],
      {
        duration: 9000,
        iterations: Infinity,
        easing: 'ease-in-out'
      }
    );
  }
  button.appendChild(label);

  return button;
}

function getSelectedBoardFloor() {
  const raw = globalThis.state?.board?.getSnapshot?.()?.context?.floor;
  const floor = Number(raw);
  if (!Number.isFinite(floor)) {
    return cfg.floors.min;
  }
  return Math.min(cfg.floors.max, Math.max(cfg.floors.min, floor));
}

function getTblFloorBarRow(floor) {
  return state.floorBarRows?.find((row) => row.floor === floor) || null;
}

function getTblRankBarRow(floor) {
  return state.rankBarRows?.find((row) => row.floor === floor) || null;
}

function invalidateTblFloorBarCache() {
  state.floorBarCacheAt = 0;
  state.floorBarRows = null;
  state.rankBarCacheAt = 0;
  state.rankBarRows = null;
}

async function ensureTblFloorBarData(force = false) {
  const rows = await loadTblAllFloorData(force);
  state.floorBarRows = rows;
  state.floorBarCacheAt = Date.now();
  return rows;
}

async function ensureTblRankBarData(force = false) {
  const rows = await loadTblAllRankData(force);
  state.rankBarRows = rows;
  state.rankBarCacheAt = Date.now();
  return rows;
}

async function refreshTblFloorBarSection(force = false) {
  if (isDisposed() || !isTblMapActive() || !getLeaderboardContainer()?.isConnected) {
    return;
  }

  await Promise.all([ensureTblFloorBarData(force), ensureTblRankBarData(force)]);

  const contentDiv = getLeaderboardContainer()._contentDiv
    || getLeaderboardContainer().querySelector('div[style*="position: relative"]');
  if (!contentDiv || contentDiv.children.length < 3) {
    return;
  }

  const selectedFloor = getSelectedBoardFloor();
  state.lastBarFloor = selectedFloor;
  const oldRankSection = contentDiv.children[1];
  const newRankSection = createTblRankLeaderboardSection();
  oldRankSection.replaceWith(newRankSection);
  const oldFloorSection = contentDiv.children[2];
  const newFloorSection = createTblFloorLeaderboardSection();
  oldFloorSection.replaceWith(newFloorSection);
  applySectionVisibility(contentDiv);
}

function scheduleTblFloorBarRefresh() {
  if (isDisposed() || !isTblMapActive()) {
    return;
  }
  Promise.all([ensureTblFloorBarData(), ensureTblRankBarData()]).then(() => {
    if (isDisposed() || !isTblMapActive()) {
      return;
    }
    refreshTblFloorBarSection();
  }).catch(() => {});
}

function removeTblBoardSubscription() {
  if (!state.boardUnsubscribe) {
    return;
  }
  const subscription = state.boardUnsubscribe;
  state.boardUnsubscribe = null;
  unsubscribeTblSubscription(subscription);
  removeSubscription(subscription);
}

function cleanupTblToastContainer() {
  if (typeof document === 'undefined') {
    return;
  }
  const container = document.getElementById(cfg.toast.containerId);
  if (container) {
    container.remove();
  }
}

function appendTblSelectedFloorUserEntry(section, floor, yourTicks, youLead) {
  const userEntrySpan = document.createElement('span');
  const hasTicks = yourTicks !== null && yourTicks !== undefined;
  Object.assign(userEntrySpan.style, entrySpanStyle, {
    color: youLead ? '#00ff00' : (hasTicks ? '#ffa500' : '#888'),
    cursor: 'default'
  });
  userEntrySpan.appendChild(createScoreIcon(
    assets.ACHIEVEMENT_ICON,
    'You',
    'Your time on this floor'
  ));

  const valueText = document.createElement('span');
  valueText.textContent = hasTicks
    ? `${floor} (${yourTicks})`
    : `${floor} (${cfg.missingFloorTicks})`;
  userEntrySpan.appendChild(valueText);
  section.appendChild(userEntrySpan);
}

function appendTblSelectedFloorLeaderEntry(section, floor, leader, playerName) {
  const isYou = Boolean(playerName && leader?.name === playerName);
  const entry = {
    userName: leader.name,
    floor,
    floorTicks: leader.ticks,
    ticks: leader.ticks
  };
  const formattedEntry = formatLeaderboardEntry(entry, 0, false, true, null);
  const entrySpan = document.createElement('span');
  Object.assign(entrySpan.style, entrySpanStyle, {
    color: isYou ? '#00ff00' : formattedEntry.color,
    fontWeight: formattedEntry.fontWeight
  });

  entrySpan.appendChild(createScoreIcon(
    isYou ? assets.ACHIEVEMENT_ICON : assets.HIGHSCORE_ICON,
    isYou ? 'You' : 'Top',
    isYou ? 'You lead this floor' : 'Floor leader'
  ));

  const valueText = document.createElement('span');
  valueText.textContent = formattedEntry.value;
  entrySpan.appendChild(valueText);
  section.appendChild(entrySpan);
}

function shouldShowTblFloorLeaderEntry(row, yourTicks, playerName) {
  if (!row?.leader || row.leaderTicks === null || row.leaderTicks === undefined) {
    return false;
  }
  const samePlayer = Boolean(playerName && row.leader?.name === playerName);
  const sameTicks = yourTicks !== null && yourTicks !== undefined && Number(yourTicks) === Number(row.leaderTicks);
  // Avoid duplicate "You" entries when the user is also the floor leader.
  if (samePlayer && sameTicks) {
    return false;
  }
  return true;
}

function createTblFloorLeaderboardSection() {
  const config = floorSectionConfig;
  const section = document.createElement('div');
  section.className = 'tbl-dynamic-floor-section';
  Object.assign(section.style, sectionWrapperStyle);

  const titleText = document.createElement('span');
  Object.assign(titleText.style, {
    fontWeight: 'bold',
    color: config.titleColor,
    fontSize: '10px'
  });
  titleText.textContent = config.displayName || config.title;
  section.appendChild(titleText);

  const selectedFloor = getSelectedBoardFloor();
  state.lastBarFloor = selectedFloor;
  const row = getTblFloorBarRow(selectedFloor);
  const includeViewer = state.currentPlayerEligible !== false;
  const userScores = includeViewer ? getTblUserScoresForMap() : null;
  const playerName = includeViewer ? getTblPlayerName() : null;
  const yourTicks = includeViewer
    ? (row?.yourTicks ?? getTblYourTicksForFloor(
      selectedFloor,
      state.myEventScores,
      userScores
    ))
    : null;

  const maxDisplay = document.createElement('span');
  Object.assign(maxDisplay.style, {
    fontSize: '10px',
    fontWeight: 'bold',
    ...buildTblFloorScaleTextStyle(selectedFloor)
  });
  maxDisplay.textContent = `${selectedFloor}`;
  section.appendChild(maxDisplay);

  if (includeViewer) {
    appendTblSelectedFloorUserEntry(section, selectedFloor, yourTicks, row?.youLead);
  }

  const hasLeaderData = Boolean(row?.leader && row.leaderTicks !== null && row.leaderTicks !== undefined);
  if (shouldShowTblFloorLeaderEntry(row, yourTicks, playerName)) {
    appendTblSelectedFloorLeaderEntry(section, selectedFloor, row.leader, playerName);
  } else if (!hasLeaderData) {
    appendWorldRecordPlaceholder(section);
  }

  decorateTblFloorSection(section, getUserBestScores());

  if (!state.floorBarRows) {
    scheduleTblFloorBarRefresh();
  }

  return section;
}

function appendTblSelectedFloorRankLeaderEntry(section, leader, playerName) {
  const isYou = Boolean(playerName && leader?.name === playerName);
  const entry = {
    userName: leader.name,
    rank: leader.rank,
    ticks: leader.ticks
  };
  const formattedEntry = formatLeaderboardEntry(entry, 0, true, false, null);
  const entrySpan = document.createElement('span');
  Object.assign(entrySpan.style, entrySpanStyle, {
    color: isYou ? '#00ff00' : formattedEntry.color,
    fontWeight: formattedEntry.fontWeight
  });

  entrySpan.appendChild(createScoreIcon(
    isYou ? assets.ACHIEVEMENT_ICON : assets.HIGHSCORE_ICON,
    isYou ? 'You' : 'Top',
    isYou ? 'You lead this floor rank' : 'Floor rank leader'
  ));

  const valueText = document.createElement('span');
  valueText.textContent = formattedEntry.value;
  entrySpan.appendChild(valueText);
  section.appendChild(entrySpan);
}

function createTblRankLeaderboardSection() {
  const config = rankSectionConfig || {
    title: 'Rank',
    displayName: 'Rank',
    titleColor: '#98fb98'
  };
  const section = document.createElement('div');
  section.className = 'tbl-dynamic-rank-section';
  Object.assign(section.style, sectionWrapperStyle);

  const titleText = document.createElement('span');
  Object.assign(titleText.style, {
    fontWeight: 'bold',
    color: config.titleColor,
    fontSize: '10px'
  });
  titleText.textContent = config.displayName || config.title;
  section.appendChild(titleText);

  const selectedFloor = getSelectedBoardFloor();
  const row = getTblRankBarRow(selectedFloor);
  const includeViewer = state.currentPlayerEligible !== false;
  const playerName = includeViewer ? getTblPlayerName() : null;
  const yourRank = includeViewer ? (row?.yourRank ?? null) : null;
  const yourTicks = includeViewer ? (row?.yourTicks ?? null) : null;

  const maxDisplay = document.createElement('span');
  Object.assign(maxDisplay.style, {
    fontSize: '10px',
    fontWeight: 'bold',
    ...buildTblFloorScaleTextStyle(selectedFloor)
  });
  maxDisplay.textContent = `${selectedFloor}`;
  section.appendChild(maxDisplay);

  if (includeViewer) {
    const hasRun = yourRank !== null && yourRank !== undefined;
    const youText = hasRun
      ? `${yourRank}${yourTicks !== null && yourTicks !== undefined ? ` (${yourTicks})` : ''}`
      : '0';
    const userEntrySpan = document.createElement('span');
    Object.assign(userEntrySpan.style, entrySpanStyle, {
      color: row?.youLead ? '#00ff00' : (hasRun ? '#ffa500' : '#888'),
      cursor: 'default'
    });
    userEntrySpan.appendChild(createScoreIcon(
      assets.ACHIEVEMENT_ICON,
      'You',
      'Your rank on this floor'
    ));
    const valueText = document.createElement('span');
    valueText.textContent = youText;
    userEntrySpan.appendChild(valueText);
    section.appendChild(userEntrySpan);
  }

  if (row?.leader && row.leaderRank !== null && row.leaderRank !== undefined) {
    appendTblSelectedFloorRankLeaderEntry(section, row.leader, playerName);
  } else {
    appendWorldRecordPlaceholder(section);
  }

  if (!state.rankBarRows) {
    scheduleTblFloorBarRefresh();
  }

  return section;
}

function isTblFirebaseFloor(floor) {
  return floor >= cfg.floors.firebaseMin && floor <= cfg.floors.firebaseMax;
}

function isTblHighscoreFloor(floor) {
  return highscoreFloorsSet.has(floor);
}

function getTblUserScoresForMap() {
  const room = getPlayerSnapshot()?.context?.rooms?.[cfg.roomId];
  if (!room) {
    return null;
  }
  return {
    bestTicks: room.ticks ?? null,
    bestRank: room.rank ?? null,
    bestRankTicks: room.rankTicks ?? null,
    bestFloor: room.floor !== undefined && room.floor !== null ? room.floor : 0,
    bestFloorTicks: room.floorTicks ?? null
  };
}

function hasTblYourRun(yourTicks) {
  return yourTicks !== null && yourTicks !== undefined;
}

function getTblEffectiveYourTicks(yourTicks) {
  return hasTblYourRun(yourTicks) ? yourTicks : cfg.missingFloorTicks;
}

function getTblBestCompletedFloor() {
  const room = getPlayerSnapshot()?.context?.rooms?.[cfg.roomId];
  if (!room) {
    return null;
  }
  if (room.floor !== undefined && room.floor !== null && Number.isFinite(Number(room.floor))) {
    return Math.min(cfg.floors.max, Math.max(cfg.floors.min, Number(room.floor)));
  }
  if (room.ticks !== undefined && room.ticks !== null && Number.isFinite(Number(room.ticks))) {
    return 0;
  }
  return -1;
}

function getTblMaxUnlockedFloor() {
  const bestCompleted = getTblBestCompletedFloor();
  if (bestCompleted === null) {
    return null;
  }
  if (bestCompleted < 0) {
    return cfg.floors.min;
  }
  return Math.min(cfg.floors.max, bestCompleted + 1);
}

function isTblFloorUnlocked(floor) {
  const maxUnlocked = getTblMaxUnlockedFloor();
  if (maxUnlocked === null) {
    return false;
  }
  return floor <= maxUnlocked;
}

function getTblYourTicksForFloor(floor, myEventScores, userScores) {
  if (floor === 0) {
    if (userScores?.bestFloor === 0) {
      return userScores.bestFloorTicks ?? userScores.bestTicks ?? null;
    }
    return userScores?.bestTicks ?? null;
  }
  if (floor === 15) {
    if (userScores?.bestFloor === 15) {
      return userScores.bestFloorTicks ?? null;
    }
    return null;
  }
  return myEventScores[floor] ?? null;
}

function getTblYourRankForFloor(floor, myEventRankScores, userScores) {
  if (floor === 0) {
    return userScores?.bestRank ?? null;
  }
  if (floor === 15) {
    return userScores?.bestFloor === 15 ? (userScores?.bestRank ?? null) : null;
  }
  return myEventRankScores[floor] ?? null;
}

function getTblYourRankTicksForFloor(floor, myEventRankTicks, userScores) {
  if (floor === 0) {
    return userScores?.bestRankTicks ?? null;
  }
  if (floor === 15) {
    return userScores?.bestFloor === 15 ? (userScores?.bestRankTicks ?? null) : null;
  }
  return myEventRankTicks[floor] ?? null;
}

function getTblParticipantHighscoreTicksByFloor() {
  const userScores = getTblUserScoresForMap();
  if (!userScores) {
    return { 0: null, 15: null };
  }
  return {
    0: getTblYourTicksForFloor(0, {}, userScores),
    15: getTblYourTicksForFloor(15, {}, userScores)
  };
}

function getTblParticipantHighscoreRanksByFloor() {
  const userScores = getTblUserScoresForMap();
  if (!userScores) {
    return { 0: null, 15: null };
  }
  return {
    0: getTblYourRankForFloor(0, {}, userScores),
    15: getTblYourRankForFloor(15, {}, userScores)
  };
}

function getTblParticipantHighscoreRankTicksByFloor() {
  const userScores = getTblUserScoresForMap();
  if (!userScores) {
    return { 0: null, 15: null };
  }
  return {
    0: getTblYourRankTicksForFloor(0, {}, userScores),
    15: getTblYourRankTicksForFloor(15, {}, userScores)
  };
}

function buildTblParticipantRecord(existing, name, joinedAt) {
  const highscoreFloorTicks = getTblParticipantHighscoreTicksByFloor();
  const highscoreFloorRanks = getTblParticipantHighscoreRanksByFloor();
  const highscoreFloorRankTicks = getTblParticipantHighscoreRankTicksByFloor();
  return {
    ...(existing || {}),
    name,
    joinedAt: existing?.joinedAt || joinedAt || Date.now(),
    highscoreFloorTicks: {
      0: highscoreFloorTicks[0],
      15: highscoreFloorTicks[15]
    },
    highscoreFloorRanks: {
      0: highscoreFloorRanks[0],
      15: highscoreFloorRanks[15]
    },
    highscoreFloorRankTicks: {
      0: highscoreFloorRankTicks[0],
      15: highscoreFloorRankTicks[15]
    }
  };
}

function tblParticipantRecordMatches(existing, name) {
  if (!existing) {
    return false;
  }
  const nextTicks = getTblParticipantHighscoreTicksByFloor();
  const nextRanks = getTblParticipantHighscoreRanksByFloor();
  const nextRankTicks = getTblParticipantHighscoreRankTicksByFloor();
  const prevTicks = existing.highscoreFloorTicks || {};
  const prevRanks = existing.highscoreFloorRanks || {};
  const prevRankTicks = existing.highscoreFloorRankTicks || {};
  const floor0Match = (prevTicks[0] ?? null) === (nextTicks[0] ?? null);
  const floor15Match = (prevTicks[15] ?? null) === (nextTicks[15] ?? null);
  const rank0Match = (prevRanks[0] ?? null) === (nextRanks[0] ?? null);
  const rank15Match = (prevRanks[15] ?? null) === (nextRanks[15] ?? null);
  const rankTick0Match = (prevRankTicks[0] ?? null) === (nextRankTicks[0] ?? null);
  const rankTick15Match = (prevRankTicks[15] ?? null) === (nextRankTicks[15] ?? null);
  return floor0Match && floor15Match && rank0Match && rank15Match && rankTick0Match && rankTick15Match && existing.name === name;
}

async function updateTblParticipantHighscoreTicks(force = false) {
  const hash = await getTblPlayerHash();
  const name = getTblPlayerName();
  if (!hash || !name) {
    return;
  }
  if (!(await isTblCurrentPlayerEligible(force))) {
    return;
  }
  const now = Date.now();
  if (
    !force &&
    now - state.lastParticipantSyncAt < cfg.timers.participantSyncMinIntervalMs
  ) {
    return;
  }
  const participantPath = `${participantsPath}/${hash}`;
  const existing = await tblFirebaseGetCached(participantPath, {
    ttl: cfg.timers.participantsCacheTtlMs,
    defaultReturn: null,
    force
  });
  if (tblParticipantRecordMatches(existing, name)) {
    state.lastParticipantSyncAt = now;
    return;
  }
  await firebaseClient.put(
    participantPath,
    buildTblParticipantRecord(existing, name, existing?.joinedAt)
  );
  state.lastParticipantSyncAt = now;
  invalidateTblFetchCache([participantsPath, participantPath]);
}

async function loadTblHighscoreFloorLeaders() {
  try {
    // Event competition highscores (floor 0 and 15) should always come from a fresh game API fetch.
    const { tickData, floorData } = await fetchLeaderboardData(cfg.roomId, true);
    const tickEntry = tickData?.[0] || null;
    const floorEntry = getBestLeaderboardEntry(floorData, { isFloor: true });
    const leaders = {};

    if (tickEntry?.userName && Number.isFinite(Number(tickEntry.ticks))) {
      leaders[0] = {
        name: tickEntry.userName,
        ticks: Number(tickEntry.ticks)
      };
    }

    if (floorEntry?.userName && Number(floorEntry.floor) >= 15) {
      const ticks = getEntryFloorTicks(floorEntry);
      if (Number.isFinite(ticks)) {
        leaders[15] = {
          name: floorEntry.userName,
          ticks
        };
      }
    }

    return leaders;
  } catch (error) {
    console.warn(`${logPrefix} Failed to load highscore floors:`, error);
    return {};
  }
}

async function loadTblHighscoreRankLeaders() {
  try {
    const { rankData } = await fetchLeaderboardData(cfg.roomId, true);
    const rankEntry = getBestLeaderboardEntry(rankData, { isRank: true });
    const leaders = {};

    if (rankEntry?.userName && Number.isFinite(Number(rankEntry.rank))) {
      leaders[0] = {
        name: rankEntry.userName,
        rank: Number(rankEntry.rank),
        ticks: Number.isFinite(Number(rankEntry.ticks)) ? Number(rankEntry.ticks) : null
      };
    }

    return leaders;
  } catch (error) {
    console.warn(`${logPrefix} Failed to load highscore rank floor:`, error);
    return {};
  }
}

function buildTblFloorRow(floor, entries, myEventScores, userScores, playerName) {
  const leader = entries[0] || null;
  const yourTicks = getTblYourTicksForFloor(floor, myEventScores, userScores);
  const leaderTicks = leader ? Number(leader.ticks) : null;
  const youLead = Boolean(
    playerName &&
    yourTicks !== null &&
    (
      leaderTicks === null ||
      yourTicks < leaderTicks ||
      (leader?.name === playerName && yourTicks === leaderTicks)
    )
  );
  let gap = null;
  if (yourTicks !== null && leaderTicks !== null && !youLead) {
    gap = yourTicks - leaderTicks;
  }
  return {
    floor,
    ascension: tblFloorToAscensionPercent(floor),
    yourTicks,
    leader,
    leaderTicks,
    entries,
    youLead,
    gap,
    fromHighscores: isTblHighscoreFloor(floor),
    unlocked: isTblFloorUnlocked(floor)
  };
}

function parseTblFloorRunFromServerResults(serverResults) {
  if (!serverResults?.rewardScreen) {
    return null;
  }

  const roomId = getTblRoomIdFromServerResults(serverResults);
  if (roomId !== cfg.roomId) {
    return null;
  }

  if (!serverResults.rewardScreen.victory) {
    return null;
  }

  const floor = Number(serverResults.rewardScreen.floor ?? serverResults.floor);
  const floorTicks = getTblFloorTicksFromServerResults(serverResults);
  if (!Number.isFinite(floor) || !isTblFirebaseFloor(floor) || floorTicks === null) {
    return null;
  }

  return {
    floor,
    floorTicks,
    date: new Date().toISOString().slice(0, 10)
  };
}

async function submitTblFloorScoreIfBetter(floor, ticks, date, runMeta = {}) {
  if (!state.joined || !isTblFirebaseFloor(floor)) {
    return false;
  }
  if (!(await isTblCurrentPlayerEligible())) {
    return false;
  }
  if (!isTblEventCompetitionActive()) {
    return false;
  }
  if (!Number.isFinite(ticks) || ticks <= 0) {
    return false;
  }
  const now = Date.now();
  if (now - state.lastSubmitAt < cfg.timers.submitMinIntervalMs) {
    return false;
  }
  const hash = await getTblPlayerHash();
  const name = getTblPlayerName();
  if (!hash || !name) {
    return false;
  }
  const scorePath = `${cfg.firebaseBase}/scores/${floor}/${hash}`;
  const existing = await tblFirebaseGetCached(scorePath, {
    defaultReturn: null,
    force: true
  });
  const previousTicks = existing && Number.isFinite(Number(existing.ticks))
    ? Number(existing.ticks)
    : null;
  if (previousTicks !== null && previousTicks <= ticks) {
    return false;
  }
  const scoreDate = date || new Date().toISOString().slice(0, 10);
  const scorePayload = {
    name,
    ticks,
    date: scoreDate,
    updatedAt: now
  };
  const writes = [firebaseClient.put(scorePath, scorePayload)];
  if (typeof runMeta.replay === 'string' && runMeta.replay.startsWith('$replay(')) {
    writes.push(firebaseClient.put(`${cfg.firebaseBase}/replays/${floor}/${hash}`, {
      name,
      ticks,
      date: scoreDate,
      updatedAt: now,
      replay: runMeta.replay
    }));
  }
  await Promise.all(writes);
  await updateTblParticipantHighscoreTicks(true);
  invalidateTblFetchCache([scoresPath, tblScoresPath(floor), scorePath, participantsPath]);
  state.lastSubmitAt = now;
  state.myEventScores[floor] = ticks;
  invalidateTblFloorBarCache();
  console.log(`${logPrefix} Submitted floor ${floor}: ${ticks} ticks`);
  refreshTblFloorBarSection(true).catch(() => {});
  return true;
}

function buildTblRankRow(floor, entries, myEventRankScores, myEventRankTicks, userScores, playerName) {
  const leader = entries[0] || null;
  const yourRank = getTblYourRankForFloor(floor, myEventRankScores, userScores);
  const yourTicks = getTblYourRankTicksForFloor(floor, myEventRankTicks, userScores);
  const leaderRank = leader && Number.isFinite(Number(leader.rank)) ? Number(leader.rank) : null;
  const leaderTicks = leader && Number.isFinite(Number(leader.ticks)) ? Number(leader.ticks) : null;
  const youLead = Boolean(
    playerName &&
    yourRank !== null &&
    (
      leaderRank === null ||
      yourRank > leaderRank ||
      (
        yourRank === leaderRank &&
        yourTicks !== null &&
        leaderTicks !== null &&
        yourTicks < leaderTicks
      ) ||
      (
        leader?.name === playerName &&
        yourRank === leaderRank &&
        yourTicks === leaderTicks
      )
    )
  );
  let gap = null;
  let gapType = 'rank';
  if (yourRank !== null && leaderRank !== null && !youLead) {
    if (yourRank < leaderRank) {
      gap = leaderRank - yourRank;
      gapType = 'rank';
    } else if (
      yourRank === leaderRank &&
      yourTicks !== null &&
      leaderTicks !== null &&
      yourTicks > leaderTicks
    ) {
      gap = yourTicks - leaderTicks;
      gapType = 'ticks';
    } else if (yourRank === leaderRank) {
      gap = 0;
      gapType = 'rank';
    }
  }
  return {
    floor,
    ascension: tblFloorToAscensionPercent(floor),
    yourRank,
    yourTicks,
    leader,
    leaderRank,
    leaderTicks,
    entries,
    youLead,
    gap,
    gapType,
    fromHighscores: isTblHighscoreRankFloor(floor),
    unlocked: isTblFloorUnlocked(floor)
  };
}

function parseTblRankRunFromServerResults(serverResults) {
  if (!serverResults?.rewardScreen) {
    return null;
  }

  const roomId = getTblRoomIdFromServerResults(serverResults);
  if (roomId !== cfg.roomId) {
    return null;
  }

  if (!serverResults.rewardScreen.victory) {
    return null;
  }

  const floor = Number(serverResults.rewardScreen.floor ?? serverResults.floor);
  const rank = getTblRankFromServerResults(serverResults);
  const ticks = getTblFloorTicksFromServerResults(serverResults);
  if (!Number.isFinite(floor) || !isTblFirebaseRankFloor(floor) || rank === null) {
    return null;
  }

  return {
    floor,
    rank,
    ticks,
    date: new Date().toISOString().slice(0, 10)
  };
}

async function submitTblRankScoreIfBetter(floor, rank, ticks, date, runMeta = {}) {
  if (!state.joined || !isTblFirebaseRankFloor(floor)) {
    return false;
  }
  if (!(await isTblCurrentPlayerEligible())) {
    return false;
  }
  if (!isTblEventCompetitionActive()) {
    return false;
  }
  if (!Number.isFinite(rank) || rank <= 0) {
    return false;
  }
  const now = Date.now();
  if (now - state.lastRankSubmitAt < cfg.timers.submitMinIntervalMs) {
    return false;
  }
  const hash = await getTblPlayerHash();
  const name = getTblPlayerName();
  if (!hash || !name) {
    return false;
  }
  const scorePath = `${rankScoresPath}/${floor}/${hash}`;
  const existing = await tblFirebaseGetCached(scorePath, {
    defaultReturn: null,
    force: true
  });
  if (!isTblRankScoreBetter(rank, ticks, existing)) {
    return false;
  }
  const scoreDate = date || new Date().toISOString().slice(0, 10);
  const scorePayload = {
    name,
    rank,
    ticks: Number.isFinite(ticks) ? ticks : null,
    date: scoreDate,
    updatedAt: now
  };
  const writes = [firebaseClient.put(scorePath, scorePayload)];
  if (typeof runMeta.replay === 'string' && runMeta.replay.startsWith('$replay(')) {
    writes.push(firebaseClient.put(`${cfg.firebaseBase}/rank-replays/${floor}/${hash}`, {
      name,
      rank,
      ticks: scorePayload.ticks,
      date: scoreDate,
      updatedAt: now,
      replay: runMeta.replay
    }));
  }
  await Promise.all(writes);
  await updateTblParticipantHighscoreTicks(true);
  invalidateTblFetchCache([rankScoresPath, tblRankScoresPath(floor), scorePath, participantsPath]);
  state.lastRankSubmitAt = now;
  state.myEventRankScores[floor] = rank;
  if (Number.isFinite(ticks)) {
    state.myEventRankTicks[floor] = ticks;
  }
  invalidateTblFloorBarCache();
  console.log(`${logPrefix} Submitted rank floor ${floor}: ${rank} points`);
  return true;
}

async function handleTblServerResults(serverResults, seed) {
  if (!state.joined || isSandboxMode()) {
    return false;
  }

  if (seed === state.lastProcessedSeed) {
    return false;
  }

  const floorRun = parseTblFloorRunFromServerResults(serverResults);
  const rankRun = parseTblRankRunFromServerResults(serverResults);
  if (!floorRun && !rankRun) {
    return false;
  }

  state.lastProcessedSeed = seed;
  const setup = getTblSetupForSubmission();
  const replayFloor = floorRun?.floor ?? rankRun?.floor;
  const replay = await buildTblReplayStringWithRetry(serverResults, replayFloor, setup);
  if (!replay) {
    console.warn(`${logPrefix} Could not build $replay for submitted run`);
  }

  let submitted = false;
  if (floorRun) {
    const floorSubmitted = await submitTblFloorScoreIfBetter(
      floorRun.floor,
      floorRun.floorTicks,
      floorRun.date,
      { replay }
    );
    if (floorSubmitted) {
      showTblEventToast(
        tEvent('ScoreSubmitted', { floor: floorRun.floor, ticks: floorRun.floorTicks })
      );
      submitted = true;
    }
  }
  if (rankRun) {
    const rankSubmitted = await submitTblRankScoreIfBetter(
      rankRun.floor,
      rankRun.rank,
      rankRun.ticks,
      rankRun.date,
      { replay }
    );
    if (rankSubmitted) {
      showTblEventToast(
        tEvent('RankScoreSubmitted', { floor: rankRun.floor, points: rankRun.rank })
      );
      submitted = true;
    }
  }
  if (submitted) {
    refreshTblFloorBarSection(true).catch(() => {});
  }
  return submitted;
}

function getTblServerResultsFromBoard() {
  return globalThis.state?.board?.getSnapshot?.()?.context?.serverResults || null;
}

async function trySubmitTblAfterBattle(maxAttempts = 6) {
  if (!state.joined || !isTblMapActive() || isSandboxMode()) {
    return;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => scheduleTimeout(resolve, attempt * 250));
    }

    const serverResults = getTblServerResultsFromBoard();
    if (!serverResults?.rewardScreen || typeof serverResults.seed === 'undefined') {
      continue;
    }

    const submitted = await handleTblServerResults(serverResults, serverResults.seed);
    if (submitted || serverResults.seed === state.lastProcessedSeed) {
      return;
    }
  }
}

async function processTblNetworkServerResults(responseData) {
  if (isDisposed() || !state.joined || isSandboxMode()) {
    return;
  }

  let data = responseData;
  if (Array.isArray(responseData) && responseData[0]?.result?.data) {
    data = responseData[0].result.data.json ?? responseData[0].result.data;
  }

  if (!data?.rewardScreen || typeof data.seed === 'undefined') {
    return;
  }

  await handleTblServerResults(data, data.seed);
}

function setupTblNetworkListener() {
  if (state.fetchRestore) {
    return;
  }

  const previousFetch = window.fetch.bind(window);
  state.fetchRestore = previousFetch;

  window.fetch = async function tblFloorLeagueFetch(...args) {
    const response = await previousFetch(...args);
    if (isDisposed()) {
      return response;
    }
    const url = args[0];
    if (typeof url === 'string' && (url.includes('gameServer?batch=1') || url.includes('game.gameServer?batch=1'))) {
      try {
        const cloned = response.clone();
        const responseData = await cloned.json();
        processTblNetworkServerResults(responseData).catch((err) => {
          console.warn(`${logPrefix} Network results handling failed:`, err);
        });
      } catch (error) {
        // Ignore parse errors on unrelated responses
      }
    }
    return response;
  };
}

function sanitizeTblLeaderboardEntry(entry) {
  if (!entry || !Number.isFinite(Number(entry.ticks))) {
    return null;
  }
  return {
    name: entry.name,
    ticks: Number(entry.ticks),
    date: entry.date,
    updatedAt: entry.updatedAt
  };
}

function parseTblFirebaseScoresBundle(allScores, playerHash) {
  const rawEntriesByFloor = new Map();
  const myScores = {};

  for (let floor = cfg.floors.firebaseMin; floor <= cfg.floors.firebaseMax; floor++) {
    const entries = [];
    const floorData = allScores?.[floor];
    if (floorData && typeof floorData === 'object') {
      Object.entries(floorData).forEach(([entryHash, entry]) => {
        const sanitized = sanitizeTblLeaderboardEntry(entry);
        if (!sanitized) {
          return;
        }
        entries.push(sanitized);
        if (playerHash && entryHash === playerHash) {
          myScores[floor] = sanitized.ticks;
        }
      });
    }
    rawEntriesByFloor.set(floor, entries);
  }

  return { rawEntriesByFloor, myScores };
}

async function loadTblAllFirebaseScores(force = false) {
  const allScores = await tblFirebaseGetCached(scoresPath, {
    defaultReturn: {},
    force
  });
  return allScores && typeof allScores === 'object' ? allScores : {};
}

function sanitizeTblRankLeaderboardEntry(entry) {
  if (!entry || !Number.isFinite(Number(entry.rank))) {
    return null;
  }
  const rank = Number(entry.rank);
  if (rank <= 0) {
    return null;
  }
  return {
    name: entry.name,
    rank,
    ticks: Number.isFinite(Number(entry.ticks)) ? Number(entry.ticks) : null,
    date: entry.date,
    updatedAt: entry.updatedAt
  };
}

function parseTblFirebaseRankScoresBundle(allScores, playerHash) {
  const rawEntriesByFloor = new Map();
  const myScores = {};
  const myTicks = {};

  for (let floor = 1; floor <= cfg.floors.max; floor++) {
    const entries = [];
    const floorData = allScores?.[floor];
    if (floorData && typeof floorData === 'object') {
      Object.entries(floorData).forEach(([entryHash, entry]) => {
        const sanitized = sanitizeTblRankLeaderboardEntry(entry);
        if (!sanitized) {
          return;
        }
        entries.push(sanitized);
        if (playerHash && entryHash === playerHash) {
          myScores[floor] = sanitized.rank;
          if (sanitized.ticks !== null) {
            myTicks[floor] = sanitized.ticks;
          }
        }
      });
    }
    rawEntriesByFloor.set(floor, entries);
  }

  return { rawEntriesByFloor, myScores, myTicks };
}

async function loadTblAllFirebaseRankScores(force = false) {
  const allScores = await tblFirebaseGetCached(rankScoresPath, {
    defaultReturn: {},
    force
  });
  return allScores && typeof allScores === 'object' ? allScores : {};
}

function buildTblPlayerTotalRanks(
  entriesByFloor,
  participantHighscoreRanksByName = new Map(),
  highscoreRankLeaders = {}
) {
  const players = new Set();
  const floorRanksByPlayer = new Map();

  const ensurePlayer = (name) => {
    if (!name) {
      return null;
    }
    players.add(name);
    if (!floorRanksByPlayer.has(name)) {
      floorRanksByPlayer.set(name, new Map());
    }
    return floorRanksByPlayer.get(name);
  };

  const setFloorRank = (name, floor, rank) => {
    if (!name || !Number.isFinite(rank)) {
      return;
    }
    const floors = ensurePlayer(name);
    if (!floors) {
      return;
    }
    const existing = floors.get(floor);
    if (existing === undefined || rank > existing) {
      floors.set(floor, rank);
    }
  };

  participantHighscoreRanksByName.forEach((_, name) => {
    ensurePlayer(name);
  });

  for (let floor = 1; floor <= cfg.floors.max; floor++) {
    (entriesByFloor.get(floor) || []).forEach((entry) => {
      setFloorRank(entry.name, floor, Number(entry.rank));
    });
  }

  participantHighscoreRanksByName.forEach((highscores, name) => {
    if (Number.isFinite(highscores[0])) {
      setFloorRank(name, 0, highscores[0]);
    }
  });

  const floor0Leader = highscoreRankLeaders[0];
  if (floor0Leader?.name && Number.isFinite(Number(floor0Leader.rank))) {
    setFloorRank(floor0Leader.name, 0, Number(floor0Leader.rank));
  }

  const totals = new Map();
  players.forEach((name) => {
    const floors = floorRanksByPlayer.get(name) || new Map();
    let total = 0;
    for (let floor = cfg.floors.min; floor <= cfg.floors.max; floor++) {
      const rank = floors.get(floor);
      total += Number.isFinite(rank) ? rank : 0;
    }
    totals.set(name, total);
  });

  return totals;
}

function buildTblPlayerTotalRankTicks(
  entriesByFloor,
  participantHighscoreRankTicksByName = new Map(),
  highscoreRankLeaders = {}
) {
  const players = new Set();
  const floorRankTicksByPlayer = new Map();

  const ensurePlayer = (name) => {
    if (!name) {
      return null;
    }
    players.add(name);
    if (!floorRankTicksByPlayer.has(name)) {
      floorRankTicksByPlayer.set(name, new Map());
    }
    return floorRankTicksByPlayer.get(name);
  };

  const setFloorRankTicks = (name, floor, ticks) => {
    if (!name || !Number.isFinite(ticks)) {
      return;
    }
    const floors = ensurePlayer(name);
    if (!floors) {
      return;
    }
    const existing = floors.get(floor);
    if (existing === undefined || ticks < existing) {
      floors.set(floor, ticks);
    }
  };

  participantHighscoreRankTicksByName.forEach((_, name) => {
    ensurePlayer(name);
  });

  for (let floor = 1; floor <= cfg.floors.max; floor++) {
    (entriesByFloor.get(floor) || []).forEach((entry) => {
      if (Number.isFinite(Number(entry.ticks))) {
        setFloorRankTicks(entry.name, floor, Number(entry.ticks));
      }
    });
  }

  participantHighscoreRankTicksByName.forEach((highscoreRankTicks, name) => {
    if (Number.isFinite(highscoreRankTicks[0])) {
      setFloorRankTicks(name, 0, highscoreRankTicks[0]);
    }
  });

  const floor0Leader = highscoreRankLeaders[0];
  if (floor0Leader?.name && Number.isFinite(Number(floor0Leader.ticks))) {
    setFloorRankTicks(floor0Leader.name, 0, Number(floor0Leader.ticks));
  }

  const totals = new Map();
  players.forEach((name) => {
    const floors = floorRankTicksByPlayer.get(name) || new Map();
    let total = 0;
    for (let floor = cfg.floors.min; floor <= cfg.floors.max; floor++) {
      const ticks = floors.get(floor);
      total += Number.isFinite(ticks) ? ticks : cfg.missingFloorTicks;
    }
    totals.set(name, total);
  });

  return totals;
}

function compareTblEntryUpdatedAtTieBreak(a, b) {
  const updatedA = Number(a?.updatedAt);
  const updatedB = Number(b?.updatedAt);
  const validA = Number.isFinite(updatedA);
  const validB = Number.isFinite(updatedB);
  if (validA && validB && updatedA !== updatedB) {
    return updatedA - updatedB;
  }
  if (validA !== validB) {
    return validA ? -1 : 1;
  }
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function compareTblRankLeaderboardEntries(a, b) {
  if (a.rank !== b.rank) {
    return b.rank - a.rank;
  }
  const ticksA = Number.isFinite(a.ticks) ? a.ticks : Number.POSITIVE_INFINITY;
  const ticksB = Number.isFinite(b.ticks) ? b.ticks : Number.POSITIVE_INFINITY;
  if (ticksA !== ticksB) {
    return ticksA - ticksB;
  }
  return compareTblEntryUpdatedAtTieBreak(a, b);
}

function rankTblRankLeaderboardEntries(entries) {
  return [...entries]
    .sort((a, b) => compareTblRankLeaderboardEntries(a, b))
    .slice(0, cfg.leaderboardTop);
}

function buildTblPlayerTotalTicks(
  entriesByFloor,
  participantHighscoresByName = new Map(),
  highscoreFloorLeaders = {}
) {
  const players = new Set();
  const floorTicksByPlayer = new Map();

  const ensurePlayer = (name) => {
    if (!name) {
      return null;
    }
    players.add(name);
    if (!floorTicksByPlayer.has(name)) {
      floorTicksByPlayer.set(name, new Map());
    }
    return floorTicksByPlayer.get(name);
  };

  const setFloorTick = (name, floor, ticks) => {
    if (!name || !Number.isFinite(ticks)) {
      return;
    }
    const floors = ensurePlayer(name);
    if (!floors) {
      return;
    }
    const existing = floors.get(floor);
    if (existing === undefined || ticks < existing) {
      floors.set(floor, ticks);
    }
  };

  participantHighscoresByName.forEach((_, name) => {
    ensurePlayer(name);
  });

  for (let floor = cfg.floors.firebaseMin; floor <= cfg.floors.firebaseMax; floor++) {
    (entriesByFloor.get(floor) || []).forEach((entry) => {
      setFloorTick(entry.name, floor, Number(entry.ticks));
    });
  }

  participantHighscoresByName.forEach((highscores, name) => {
    if (Number.isFinite(highscores[0])) {
      setFloorTick(name, 0, highscores[0]);
    }
    if (Number.isFinite(highscores[15])) {
      setFloorTick(name, 15, highscores[15]);
    }
  });

  [0, 15].forEach((floor) => {
    const leader = highscoreFloorLeaders[floor];
    if (leader?.name && Number.isFinite(Number(leader.ticks))) {
      setFloorTick(leader.name, floor, Number(leader.ticks));
    }
  });

  const totals = new Map();
  players.forEach((name) => {
    const floors = floorTicksByPlayer.get(name) || new Map();
    let total = 0;
    for (let floor = cfg.floors.min; floor <= cfg.floors.max; floor++) {
      const ticks = floors.get(floor);
      total += Number.isFinite(ticks) ? ticks : cfg.missingFloorTicks;
    }
    totals.set(name, total);
  });

  return totals;
}

function compareTblLeaderboardEntries(a, b) {
  if (a.ticks !== b.ticks) {
    return a.ticks - b.ticks;
  }
  return compareTblEntryUpdatedAtTieBreak(a, b);
}

function rankTblLeaderboardEntries(entries) {
  return [...entries]
    .sort((a, b) => compareTblLeaderboardEntries(a, b))
    .slice(0, cfg.leaderboardTop);
}

function escapeTblHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TBL_EVENT_HIGHLIGHT_COLORS = {
  green: '#8f8',
  red: '#f88',
  yellow: '#ff8',
  muted: '#ccc'
};

const TBL_EVENT_HIGHLIGHT_TAG_RE = /\[\[(green|red|yellow|muted)\]\]([\s\S]*?)\[\[\/\1\]\]/g;
const TBL_EVENT_TIMER_PLACEHOLDER = '@@TBL_EVENT_TIME@@';

function hasTblEventHighlightTags(text) {
  TBL_EVENT_HIGHLIGHT_TAG_RE.lastIndex = 0;
  return TBL_EVENT_HIGHLIGHT_TAG_RE.test(String(text || ''));
}

function buildTblEventColoredSpanHtml(color, text) {
  return `<span style="color:${color};font-weight:normal;text-shadow:1px 0 0 ${color},0 0 2px ${color}66,0 1px 1px rgba(0,0,0,0.4);">${escapeTblHtml(text)}</span>`;
}

function formatTblEventHighlightHtml(text) {
  const source = String(text || '');
  if (!source) {
    return '';
  }

  let html = '';
  let lastIndex = 0;
  TBL_EVENT_HIGHLIGHT_TAG_RE.lastIndex = 0;
  let match = TBL_EVENT_HIGHLIGHT_TAG_RE.exec(source);
  while (match) {
    html += escapeTblHtml(source.slice(lastIndex, match.index));
    const color = TBL_EVENT_HIGHLIGHT_COLORS[match[1]] || '#fff';
    html += buildTblEventColoredSpanHtml(color, match[2]);
    lastIndex = TBL_EVENT_HIGHLIGHT_TAG_RE.lastIndex;
    match = TBL_EVENT_HIGHLIGHT_TAG_RE.exec(source);
  }
  html += escapeTblHtml(source.slice(lastIndex));
  return html;
}

function formatTblEventTimerValueHtml(i18nKey, time, timeColor, extraParams = {}) {
  const template = tEvent(i18nKey, { ...extraParams, time: TBL_EVENT_TIMER_PLACEHOLDER });
  const html = formatTblEventHighlightHtml(template);
  return html.replace(
    TBL_EVENT_TIMER_PLACEHOLDER,
    buildTblEventColoredSpanHtml(timeColor, time)
  );
}

function tblFloorToAscensionPercent(floor) {
  if (!Number.isFinite(Number(floor))) {
    return null;
  }
  return ascensionFormula(Number(floor));
}

function getTblFloorScaleColor(floor) {
  const index = Math.min(cfg.floors.max, Math.max(cfg.floors.min, Math.round(Number(floor) || 0)));
  return cfg.floorScaleColors[index] || cfg.floorScaleColors[0];
}

function buildTblFloorScaleTextStyle(floor) {
  const color = getTblFloorScaleColor(floor);
  return {
    color,
    textShadow: floor >= 11
      ? `0 0 3px ${color}80, 0 1px 2px #000`
      : '0 1px 2px #000'
  };
}

function formatTblFloorRowTitleHtml(floor, ascension) {
  const text = tEvent('FloorRowTitle', { floor, ascension });
  const style = buildTblFloorScaleTextStyle(floor);
  return `<span style="color:${style.color};text-shadow:${style.textShadow};">${escapeTblHtml(text)}</span>`;
}

function formatTblProfileLink(playerName) {
  const safeName = escapeTblHtml(playerName || 'Unknown');
  const profileUrl = `https://bestiaryarena.com/profile/${encodeURIComponent(String(playerName || '').trim())}`;
  return `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="color:#ff8;text-decoration:underline;cursor:pointer;">${safeName}</a>`;
}

function formatTblTicksComparison(yourTicks, leaderTicks, leaderName, youLead = false) {
  if (state.currentPlayerEligible === false) {
    if (leaderTicks === null || leaderTicks === undefined) {
      return `<span style="color:#888;">${escapeTblHtml(tEvent('NoLeaderYet'))}</span>`;
    }
    return `<span>${leaderTicks} ticks</span> (${formatTblProfileLink(leaderName)})`;
  }
  const hasRun = hasTblYourRun(yourTicks);
  const displayTicks = getTblEffectiveYourTicks(yourTicks);
  const youPart = hasRun
    ? `<span>${displayTicks} ticks</span>`
    : `<span style="color:#888;">${displayTicks} ticks</span>`;
  if (youLead) {
    return youPart;
  }
  if (leaderTicks === null || leaderTicks === undefined) {
    return `${youPart} <span style="color:#888;">${escapeTblHtml(tEvent('NoLeaderYet'))}</span>`;
  }
  return `${youPart} → <span>${leaderTicks} ticks</span> (${formatTblProfileLink(leaderName)})`;
}

function formatTblRankComparison(yourRank, yourTicks, leaderRank, leaderTicks, leaderName, youLead = false) {
  if (state.currentPlayerEligible === false) {
    if (leaderRank === null || leaderRank === undefined) {
      return `<span style="color:#888;">${escapeTblHtml(tEvent('NoLeaderYet'))}</span>`;
    }
    const leaderTickSuffix = leaderTicks !== null && leaderTicks !== undefined ? ` (${leaderTicks} ticks)` : '';
    return `<span>${leaderRank} points${leaderTickSuffix}</span> (${formatTblProfileLink(leaderName)})`;
  }
  const hasRun = yourRank !== null && yourRank !== undefined;
  const tickSuffix = hasRun && yourTicks !== null && yourTicks !== undefined ? ` (${yourTicks} ticks)` : '';
  const youPart = hasRun
    ? `<span>${yourRank} points${tickSuffix}</span>`
    : `<span style="color:#888;">0 points</span>`;
  if (youLead) {
    return youPart;
  }
  if (leaderRank === null || leaderRank === undefined) {
    return `${youPart} <span style="color:#888;">${escapeTblHtml(tEvent('NoLeaderYet'))}</span>`;
  }
  const leaderTickSuffix = leaderTicks !== null && leaderTicks !== undefined ? ` (${leaderTicks} ticks)` : '';
  return `${youPart} → <span>${leaderRank} points${leaderTickSuffix}</span> (${formatTblProfileLink(leaderName)})`;
}

function ensureTblLeagueStyles() {
  if (document.getElementById(cfg.modal.stylesId)) {
    return;
  }
  const style = document.createElement('style');
  style.id = cfg.modal.stylesId;
  style.textContent = `
    .tbl-league-item--empty {
      opacity: 0.55;
    }
    .tbl-league-item--locked {
      opacity: 0.5;
      filter: grayscale(0.8);
      position: relative;
      cursor: not-allowed;
    }
    .tbl-league-item--locked::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
      background-size: 6px 6px;
      z-index: 2;
    }
    .tbl-league-item--clickable {
      cursor: pointer;
    }
    .tbl-league-item--clickable:hover {
      filter: brightness(1.08);
    }
    .tbl-event-competition-btn .tbl-event-competition-btn-label {
      animation: tbl-event-btn-shift 9s ease-in-out infinite;
    }
    @keyframes tbl-event-btn-shift {
      0% { color: #f1d892; text-shadow: 0 0 0 transparent; }
      35% { color: #e6d39f; text-shadow: 0 0 2px rgba(255, 230, 170, 0.18); }
      70% { color: #d9dfe8; text-shadow: 0 0 2px rgba(188, 223, 255, 0.16); }
      100% { color: #f1d892; text-shadow: 0 0 0 transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      .tbl-event-competition-btn .tbl-event-competition-btn-label {
        animation: none;
      }
    }
    .tbl-league-floor-thumb {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
    }
    .tbl-league-floor-thumb-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .tbl-league-floor-thumb-overlay {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.42);
    }
    .tbl-league-modal-content {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .tbl-league-summary-grid {
      display: grid;
      grid-template-columns: minmax(0, 35%) auto minmax(0, 60%);
      gap: 8px;
      align-items: center;
    }
    .tbl-league-summary-col {
      min-width: 0;
      overflow: hidden;
    }
    .tbl-league-standings-col {
      display: flex;
      justify-content: center;
      align-items: center;
      min-width: 0;
      overflow: hidden;
    }
    .tbl-league-top-players {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      margin: 0 auto;
    }
    .tbl-league-top-players-title {
      color: #ccc;
      text-align: center;
      margin-bottom: 4px;
      font-size: 14px;
    }
    .tbl-league-summary-separator {
      width: 1px;
      align-self: stretch;
      background: rgba(255, 255, 255, 0.2);
    }
    .tbl-league-top-grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
    }
    .tbl-league-top-grid th,
    .tbl-league-top-grid td {
      border: 1px solid rgba(255, 255, 255, 0.22);
      padding: 3px 5px;
      text-align: center;
      vertical-align: middle;
      min-width: 0;
    }
    .tbl-league-top-grid-corner,
    .tbl-league-top-grid-label {
      color: #999;
      background: rgba(0, 0, 0, 0.28);
      text-align: left;
      white-space: nowrap;
      width: 58px;
    }
    .tbl-league-top-grid-header {
      color: #ccc;
      background: rgba(0, 0, 0, 0.28);
      font-weight: normal;
    }
    .tbl-league-top-grid-medal-header {
      padding: 4px 2px;
    }
    .tbl-league-top-grid-medal {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      line-height: 1;
    }
    .tbl-league-top-grid-medal-icon {
      display: block;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.65));
    }
    .tbl-league-top-grid-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .tbl-league-top-grid-name a {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    .tbl-league-top-grid-you-cell {
      color: #8f8;
    }
    .tbl-league-top-grid-footer td,
    .tbl-league-top-grid-footer th {
      color: #8f8;
      background: rgba(0, 0, 0, 0.18);
    }
    .tbl-league-top-grid-footer .tbl-league-top-grid-cell {
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tbl-league-top-grid-footer a {
      display: inline-block;
      max-width: 38%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }
    .tbl-league-list-panel {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
}

function getTblModalDialog(modalRef) {
  if (modalRef?.element) {
    return modalRef.element;
  }
  if (modalRef instanceof HTMLElement) {
    return modalRef;
  }
  return document.getElementById(cfg.modal.id)
    || document.querySelector('div[role="dialog"][data-state="open"]');
}

function getTblModalDimensions() {
  const pad = cfg.modal.viewportPadding * 2;
  return {
    width: Math.max(cfg.modal.minWidth, Math.min(cfg.modal.width, window.innerWidth - pad)),
    height: Math.max(cfg.modal.minHeight, Math.min(cfg.modal.height, window.innerHeight - pad))
  };
}

function clearTblModalLayoutCleanup() {
  if (state.layoutCleanup) {
    state.layoutCleanup();
    state.layoutCleanup = null;
  }
}

function applyTblModalLayout(modalRef, contentRoot) {
  const dialog = getTblModalDialog(modalRef);
  if (!dialog) {
    return;
  }

  const { width, height } = getTblModalDimensions();
  dialog.id = cfg.modal.id;
  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]', 'w-full');

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0'
    });
  }

  const widgetBottom = dialog.querySelector('.widget-bottom');
  if (widgetBottom) {
    Object.assign(widgetBottom.style, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden'
    });
  }

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      maxHeight: '100%',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }
}

function setupTblModalResponsiveLayout(modalRef, contentRoot) {
  clearTblModalLayoutCleanup();
  const apply = () => applyTblModalLayout(modalRef, contentRoot);
  apply();
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  state.layoutCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
}

function createTblScrollContainer() {
  const api = getApi();
  if (api?.ui?.components?.createScrollContainer) {
    const scrollContainer = api.ui.components.createScrollContainer({
      height: '100%',
      padding: true,
      content: ''
    });
    Object.assign(scrollContainer.element.style, {
      flex: '1 1 0',
      minHeight: '0',
      height: 'auto',
      overflow: 'hidden'
    });
    scrollContainer.contentContainer.classList.add('highscores-list');
    return scrollContainer;
  }

  const fallback = document.createElement('div');
  fallback.className = 'highscores-list';
  Object.assign(fallback.style, {
    flex: '1 1 0',
    minHeight: '0',
    overflowY: 'auto',
    padding: '4px'
  });
  return {
    element: fallback,
    contentContainer: fallback,
    addContent(node) {
      fallback.appendChild(node);
    }
  };
}

function createTblStatsPanel(html) {
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  statsContainer.style.flexShrink = '0';
  statsContainer.innerHTML = html;
  return statsContainer;
}

function sortTblOverallStandings(standings, competitionMode = COMPETITION_TAB.FLOOR) {
  if (competitionMode === COMPETITION_TAB.SHINY) {
    return sortTblShinyStandings(standings);
  }
  if (competitionMode === COMPETITION_TAB.RANK) {
    const playerTotalRanks = state.playerTotalRanks || new Map();
    const playerTotalRankTicks = state.playerTotalRankTicks || new Map();
    const missingRankTicks = (cfg.floors.max - cfg.floors.min + 1) * cfg.missingFloorTicks;
    return [...standings].sort((a, b) => {
      const totalA = playerTotalRanks.get(a.name) ?? 0;
      const totalB = playerTotalRanks.get(b.name) ?? 0;
      if (totalB !== totalA) {
        return totalB - totalA;
      }
      const rankTicksA = playerTotalRankTicks.get(a.name) ?? missingRankTicks;
      const rankTicksB = playerTotalRankTicks.get(b.name) ?? missingRankTicks;
      if (rankTicksA !== rankTicksB) {
        return rankTicksA - rankTicksB;
      }
      if (b.floorsLed !== a.floorsLed) {
        return b.floorsLed - a.floorsLed;
      }
      return String(a.name).localeCompare(String(b.name));
    });
  }

  const playerTotalTicks = state.playerTotalTicks || new Map();
  const missingTotal = (cfg.floors.max - cfg.floors.min + 1) * cfg.missingFloorTicks;

  return [...standings].sort((a, b) => {
    const totalA = playerTotalTicks.get(a.name) ?? missingTotal;
    const totalB = playerTotalTicks.get(b.name) ?? missingTotal;
    if (totalA !== totalB) {
      return totalA - totalB;
    }
    if (b.floorsLed !== a.floorsLed) {
      return b.floorsLed - a.floorsLed;
    }
    return String(a.name).localeCompare(String(b.name));
  });
}

function buildTblOverallStandings(rows, ensurePlayerName = null, competitionMode = COMPETITION_TAB.FLOOR) {
  if (competitionMode === COMPETITION_TAB.SHINY) {
    return buildTblShinyOverallStandings(rows, ensurePlayerName);
  }
  const standings = new Map();
  const playerTotals = competitionMode === COMPETITION_TAB.RANK
    ? (state.playerTotalRanks || new Map())
    : (state.playerTotalTicks || new Map());

  playerTotals.forEach((_, name) => {
    if (!name) {
      return;
    }
    standings.set(name, {
      name,
      floorsLed: 0
    });
  });

  rows.forEach((row) => {
    const leaderName = row.leader?.name;
    if (!leaderName) {
      return;
    }

    const existing = standings.get(leaderName) || {
      name: leaderName,
      floorsLed: 0
    };
    existing.floorsLed += 1;
    standings.set(leaderName, existing);
  });

  if (ensurePlayerName && !standings.has(ensurePlayerName)) {
    standings.set(ensurePlayerName, {
      name: ensurePlayerName,
      floorsLed: 0
    });
  }

  return sortTblOverallStandings(Array.from(standings.values()), competitionMode);
}

function getTblOverallLeaderName(rows, competitionMode = COMPETITION_TAB.FLOOR) {
  const standings = buildTblOverallStandings(rows, null, competitionMode);
  return standings[0]?.name || null;
}

function buildTblFallbackTickLeader(highscoreMap, floor) {
  if (!(highscoreMap instanceof Map)) {
    return null;
  }
  let bestName = null;
  let bestTicks = null;
  for (const [name, floors] of highscoreMap.entries()) {
    const ticks = Number(floors?.[floor]);
    if (!Number.isFinite(ticks) || ticks <= 0) {
      continue;
    }
    if (bestTicks === null || ticks < bestTicks) {
      bestTicks = ticks;
      bestName = name;
    }
  }
  if (!bestName || bestTicks === null) {
    return null;
  }
  return { name: bestName, ticks: bestTicks };
}

function buildTblFallbackRankLeader(highscoreRankMap, highscoreRankTickMap, floor) {
  if (!(highscoreRankMap instanceof Map)) {
    return null;
  }
  let best = null;
  for (const [name, floors] of highscoreRankMap.entries()) {
    const rank = Number(floors?.[floor]);
    if (!Number.isFinite(rank) || rank <= 0) {
      continue;
    }
    const ticksRaw = highscoreRankTickMap instanceof Map
      ? Number(highscoreRankTickMap.get(name)?.[floor])
      : NaN;
    const ticks = Number.isFinite(ticksRaw) && ticksRaw > 0 ? ticksRaw : null;
    if (!best) {
      best = { name, rank, ticks };
      continue;
    }
    if (rank > best.rank) {
      best = { name, rank, ticks };
      continue;
    }
    if (rank === best.rank) {
      if (ticks !== null && best.ticks === null) {
        best = { name, rank, ticks };
      } else if (ticks !== null && best.ticks !== null && ticks < best.ticks) {
        best = { name, rank, ticks };
      }
    }
  }
  return best;
}

function buildTblLeagueCurrentLeaderRowHtml(rows, competitionMode = COMPETITION_TAB.FLOOR) {
  const leaderName = getTblOverallLeaderName(rows, competitionMode);
  const viewerName = getTblPlayerName();
  let nameHtml;
  if (!leaderName) {
    nameHtml = `<span style="color:#888;">${escapeTblHtml(tEvent('NoCurrentLeader'))}</span>`;
  } else if (viewerName && leaderName === viewerName) {
    nameHtml = `<span style="color:#8f8;">${escapeTblHtml(leaderName)}</span>`;
  } else {
    nameHtml = formatTblProfileLink(leaderName);
  }
  return `${escapeTblHtml(tEvent('CurrentLeaderLabel'))} ${nameHtml}`;
}

function getTblPlayerTotalTicks(playerName) {
  return (state.playerTotalTicks || new Map()).get(playerName)
    ?? (cfg.floors.max - cfg.floors.min + 1) * cfg.missingFloorTicks;
}

function getTblPlayerTotalRankPoints(playerName) {
  return (state.playerTotalRanks || new Map()).get(playerName) ?? 0;
}

function getTblPlayerTotalRankTicks(playerName) {
  return (state.playerTotalRankTicks || new Map()).get(playerName)
    ?? (cfg.floors.max - cfg.floors.min + 1) * cfg.missingFloorTicks;
}

function formatTblTopGridNameCell(player, viewerName) {
  if (!player?.name) {
    return '<td class="tbl-league-top-grid-cell">—</td>';
  }
  const isYou = Boolean(viewerName && player.name === viewerName);
  const nameHtml = isYou
    ? escapeTblHtml(player.name)
    : formatTblProfileLink(player.name);
  const youClass = isYou ? ' tbl-league-top-grid-you-cell' : '';
  return `<td class="tbl-league-top-grid-cell tbl-league-top-grid-name${youClass}">${nameHtml}</td>`;
}

function formatTblTopGridValueCell(value, viewerName, playerName, { isYou: forceYou = false } = {}) {
  const isYou = forceYou || Boolean(viewerName && playerName && viewerName === playerName);
  const youClass = isYou ? ' tbl-league-top-grid-you-cell' : '';
  const display = value === null || value === undefined ? '—' : escapeTblHtml(String(value));
  return `<td class="tbl-league-top-grid-cell${youClass}">${display}</td>`;
}

function formatTblTopGridMedalHeader(position) {
  const rank = Math.min(3, Math.max(1, Number(position) || 1));
  const medalColor = getMedalColor(rank);
  const label = `#${rank}`;
  return `<th class="tbl-league-top-grid-header tbl-league-top-grid-medal-header" title="${label}" aria-label="${label}">
    <span class="tbl-league-top-grid-medal" style="color:${medalColor};">
      <svg class="tbl-league-top-grid-medal-icon" viewBox="0 0 20 24" width="16" height="19" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M5.5 1.5 7.8 9.2 10 2.2 12.2 9.2 14.5 1.5H5.5z"/>
        <circle cx="10" cy="15.5" r="7" fill="currentColor"/>
        <circle cx="10" cy="15.5" r="5.6" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
        <text x="10" y="17.1" text-anchor="middle" fill="rgba(0,0,0,0.55)" font-size="7" font-weight="bold" font-family="monospace">${rank}</text>
      </svg>
    </span>
  </th>`;
}

function buildTblLeagueTopPlayersGridHtml(topThree, competitionMode, viewerName, yourRow = null) {
  const slots = [0, 1, 2].map((index) => topThree[index] || null);
  const isRank = competitionMode === COMPETITION_TAB.RANK;
  const isShiny = competitionMode === COMPETITION_TAB.SHINY;

  let html = '<table class="tbl-league-top-grid"><thead><tr>';
  html += `<th class="tbl-league-top-grid-corner"></th>`;
  slots.forEach((entry, index) => {
    const position = entry?.rank ?? (index + 1);
    html += formatTblTopGridMedalHeader(position);
  });
  html += '</tr></thead><tbody>';

  html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(tEvent('GridName'))}</th>`;
  slots.forEach((entry) => {
    html += entry
      ? formatTblTopGridNameCell(entry.player, viewerName)
      : '<td class="tbl-league-top-grid-cell">—</td>';
  });
  html += '</tr>';

  if (isShiny) {
    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(tEvent('GridShinies'))}</th>`;
    slots.forEach((entry) => {
      if (!entry) {
        html += '<td class="tbl-league-top-grid-cell">—</td>';
        return;
      }
      const count = Number(entry.player.count ?? getTblPlayerShinyCount(entry.player.name)) || 0;
      html += formatTblTopGridValueCell(count, viewerName, entry.player.name);
    });
    html += '</tr>';
    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(tEvent('GridDrop'))}</th>`;
    slots.forEach((entry) => {
      if (!entry) {
        html += '<td class="tbl-league-top-grid-cell">—</td>';
        return;
      }
      const dropAgo = getTblPlayerShinyDropLabel(entry.player);
      html += formatTblTopGridValueCell(dropAgo, viewerName, entry.player.name);
    });
    html += '</tr>';
  } else if (isRank) {
    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(tEvent('GridPoints'))}</th>`;
    slots.forEach((entry) => {
      html += entry
        ? formatTblTopGridValueCell(
          getTblPlayerTotalRankPoints(entry.player.name),
          viewerName,
          entry.player.name
        )
        : '<td class="tbl-league-top-grid-cell">—</td>';
    });
    html += '</tr>';
  }

  if (!isShiny) {
    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(tEvent('GridTicks'))}</th>`;
    slots.forEach((entry) => {
      if (!entry) {
        html += '<td class="tbl-league-top-grid-cell">—</td>';
        return;
      }
      const ticks = isRank
        ? getTblPlayerTotalRankTicks(entry.player.name)
        : getTblPlayerTotalTicks(entry.player.name);
      html += formatTblTopGridValueCell(ticks, viewerName, entry.player.name);
    });
    html += '</tr>';
  }

  if (!isRank && !isShiny) {
    html += `<tr><th class="tbl-league-top-grid-label">${escapeTblHtml(tEvent('GridRecords'))}</th>`;
    slots.forEach((entry) => {
      html += entry
        ? formatTblTopGridValueCell(entry.player.floorsLed, viewerName, entry.player.name)
        : '<td class="tbl-league-top-grid-cell">—</td>';
    });
    html += '</tr>';
  }

  if (yourRow?.player) {
    html += formatTblOverallStandingGridFooterRow(
      yourRow.player,
      yourRow.rank,
      viewerName,
      competitionMode
    );
  }

  html += '</tbody></table>';
  return html;
}

function formatTblOverallStandingGridFooterRow(player, rank, viewerName, competitionMode) {
  const isYou = Boolean(viewerName && player.name === viewerName);
  const nameHtml = isYou
    ? escapeTblHtml(player.name)
    : formatTblProfileLink(player.name);
  const standingLabel = escapeTblHtml(formatTblOverallStandingStats(player, competitionMode));
  const rankLabel = rank ? `#${rank}` : '—';
  return `<tr class="tbl-league-top-grid-footer">
    <th class="tbl-league-top-grid-label">${rankLabel}</th>
    <td class="tbl-league-top-grid-cell" colspan="3">${nameHtml} — ${standingLabel}</td>
  </tr>`;
}

function formatTblOverallStandingStats(player, competitionMode = COMPETITION_TAB.FLOOR) {
  if (competitionMode === COMPETITION_TAB.SHINY) {
    const count = Number(player.count ?? getTblPlayerShinyCount(player.name)) || 0;
    const lastDropped = getTblPlayerShinyDropLabel(player);
    return tEvent('PlayerStandingShiny', { count, lastDropped });
  }
  return competitionMode === COMPETITION_TAB.RANK
    ? tEvent('PlayerStandingRank', {
      points: getTblPlayerTotalRankPoints(player.name),
      ticks: getTblPlayerTotalRankTicks(player.name)
    })
    : tEvent('PlayerStanding', {
      count: player.floorsLed,
      ticks: getTblPlayerTotalTicks(player.name)
    });
}

function computeTblOverallTopPlayers(floorRows, limit = 3) {
  return buildTblOverallStandings(floorRows).slice(0, limit);
}

async function loadTblAllFloorData(force = false) {
  if (isDisposed()) {
    return state.floorBarRows || [];
  }

  const now = Date.now();
  if (
    !force &&
    state.floorBarRows &&
    now - state.floorBarCacheAt < cfg.timers.fetchCacheTtlMs
  ) {
    return state.floorBarRows;
  }
  if (
    !force &&
    state.floorBarRows &&
    now - state.lastFullLoadAt < cfg.timers.fetchMinIntervalMs
  ) {
    return state.floorBarRows;
  }
  if (state.fullLoadInFlight) {
    return state.fullLoadInFlight;
  }

  state.fullLoadInFlight = (async () => {
    try {
      if (isDisposed()) {
        return state.floorBarRows || [];
      }

      const isViewerEligible = await isTblCurrentPlayerEligible(force);
      const userScores = isViewerEligible ? getTblUserScoresForMap() : null;
      const playerName = isViewerEligible ? getTblPlayerName() : null;
      const playerHash = await getTblPlayerHash();
      if (state.joined) {
        await updateTblParticipantHighscoreTicks(force);
      }

      const allScores = await loadTblAllFirebaseScores(force);
      const { rawEntriesByFloor, myScores: loadedMyScores } = parseTblFirebaseScoresBundle(
        allScores,
        playerHash
      );
      const myScores = { ...state.myEventScores, ...loadedMyScores };

      const [highscoreLeaders, participantBundle] = await Promise.all([
        loadTblHighscoreFloorLeaders(),
        loadTblParticipantsBundle(force)
      ]);
      const filteredHighscoreLeaders = {};
      for (const [floorKey, leader] of Object.entries(highscoreLeaders || {})) {
        if (leader?.name && await isTblPlayerEligibleByName(leader.name)) {
          filteredHighscoreLeaders[floorKey] = leader;
        }
      }
      cfg.floors.highscore.forEach((floor) => {
        if (!filteredHighscoreLeaders[floor]) {
          const fallbackLeader = buildTblFallbackTickLeader(participantBundle.highscoreMap, floor);
          if (fallbackLeader) {
            filteredHighscoreLeaders[floor] = fallbackLeader;
          }
        }
      });

      if (isDisposed()) {
        return state.floorBarRows || [];
      }

      state.myEventScores = myScores;
      state.participantCount = participantBundle.count;

      const playerTotalTicks = buildTblPlayerTotalTicks(
        rawEntriesByFloor,
        participantBundle.highscoreMap,
        filteredHighscoreLeaders
      );
      state.playerTotalTicks = playerTotalTicks;

      const firebaseByFloor = new Map();
      for (let floor = cfg.floors.firebaseMin; floor <= cfg.floors.firebaseMax; floor++) {
        const eligibleEntries = await filterTblNamedEntries(rawEntriesByFloor.get(floor) || []);
        firebaseByFloor.set(
          floor,
          rankTblLeaderboardEntries(eligibleEntries)
        );
      }

      const floorRows = [];
      for (let floor = cfg.floors.min; floor <= cfg.floors.max; floor++) {
        let entries = [];
        if (isTblHighscoreFloor(floor)) {
          const leader = filteredHighscoreLeaders[floor];
          entries = leader ? [leader] : [];
        } else {
          entries = firebaseByFloor.get(floor) || [];
        }
        floorRows.push(buildTblFloorRow(floor, entries, myScores, userScores, playerName));
      }

      state.lastFullLoadAt = Date.now();
      return floorRows;
    } finally {
      state.fullLoadInFlight = null;
    }
  })();

  return state.fullLoadInFlight;
}

async function loadTblAllRankData(force = false) {
  if (isDisposed()) {
    return state.rankBarRows || [];
  }

  const now = Date.now();
  if (
    !force &&
    state.rankBarRows &&
    now - state.rankBarCacheAt < cfg.timers.fetchCacheTtlMs
  ) {
    return state.rankBarRows;
  }
  if (
    !force &&
    state.rankBarRows &&
    now - state.lastRankFullLoadAt < cfg.timers.fetchMinIntervalMs
  ) {
    return state.rankBarRows;
  }
  if (state.rankFullLoadInFlight) {
    return state.rankFullLoadInFlight;
  }

  state.rankFullLoadInFlight = (async () => {
    try {
      if (isDisposed()) {
        return state.rankBarRows || [];
      }

      const isViewerEligible = await isTblCurrentPlayerEligible(force);
      const userScores = isViewerEligible ? getTblUserScoresForMap() : null;
      const playerName = isViewerEligible ? getTblPlayerName() : null;
      const playerHash = await getTblPlayerHash();
      if (state.joined) {
        await updateTblParticipantHighscoreTicks(force);
      }

      const allScores = await loadTblAllFirebaseRankScores(force);
      const {
        rawEntriesByFloor,
        myScores: loadedMyScores,
        myTicks: loadedMyTicks
      } = parseTblFirebaseRankScoresBundle(allScores, playerHash);
      const myRankScores = { ...state.myEventRankScores, ...loadedMyScores };
      const myRankTicks = { ...state.myEventRankTicks, ...loadedMyTicks };

      const [highscoreRankLeaders, participantBundle] = await Promise.all([
        loadTblHighscoreRankLeaders(),
        loadTblParticipantsBundle(force)
      ]);
      const filteredHighscoreRankLeaders = {};
      for (const [floorKey, leader] of Object.entries(highscoreRankLeaders || {})) {
        if (leader?.name && await isTblPlayerEligibleByName(leader.name)) {
          filteredHighscoreRankLeaders[floorKey] = leader;
        }
      }
      cfg.floors.highscoreRank.forEach((floor) => {
        if (!filteredHighscoreRankLeaders[floor]) {
          const fallbackLeader = buildTblFallbackRankLeader(
            participantBundle.highscoreRankMap,
            participantBundle.highscoreRankTickMap,
            floor
          );
          if (fallbackLeader) {
            filteredHighscoreRankLeaders[floor] = fallbackLeader;
          }
        }
      });

      if (isDisposed()) {
        return state.rankBarRows || [];
      }

      state.myEventRankScores = myRankScores;
      state.myEventRankTicks = myRankTicks;

      const playerTotalRanks = buildTblPlayerTotalRanks(
        rawEntriesByFloor,
        participantBundle.highscoreRankMap,
        filteredHighscoreRankLeaders
      );
      const playerTotalRankTicks = buildTblPlayerTotalRankTicks(
        rawEntriesByFloor,
        participantBundle.highscoreRankTickMap,
        filteredHighscoreRankLeaders
      );
      state.playerTotalRanks = playerTotalRanks;
      state.playerTotalRankTicks = playerTotalRankTicks;

      const firebaseByFloor = new Map();
      for (let floor = 1; floor <= cfg.floors.max; floor++) {
        const eligibleEntries = await filterTblNamedEntries(rawEntriesByFloor.get(floor) || []);
        firebaseByFloor.set(
          floor,
          rankTblRankLeaderboardEntries(eligibleEntries)
        );
      }

      const rankRows = [];
      for (let floor = cfg.floors.min; floor <= cfg.floors.max; floor++) {
        let entries = [];
        if (isTblHighscoreRankFloor(floor)) {
          const leader = filteredHighscoreRankLeaders[floor];
          entries = leader ? [leader] : [];
        } else {
          entries = firebaseByFloor.get(floor) || [];
        }
        rankRows.push(buildTblRankRow(
          floor,
          entries,
          myRankScores,
          myRankTicks,
          userScores,
          playerName
        ));
      }

      state.lastRankFullLoadAt = Date.now();
      return rankRows;
    } finally {
      state.rankFullLoadInFlight = null;
    }
  })();

  return state.rankFullLoadInFlight;
}

function createTblLeagueSummaryPanel(rows, participantCount = 0, competitionMode = COMPETITION_TAB.FLOOR) {
  const leftCol = buildTblLeagueSummaryLeftColHtml(participantCount, competitionMode);
  const rightCol = buildTblLeagueSummaryStandingsHtml(rows, competitionMode);
  const html = `<div class="tbl-league-summary-grid">
    <div class="tbl-league-summary-col">${leftCol}</div>
    <div class="tbl-league-summary-separator" role="none"></div>
    <div class="tbl-league-summary-col tbl-league-standings-col">${rightCol}</div>
  </div>`;

  return createTblStatsPanel(html);
}

function getTblLeaguePrizeText(competitionMode = COMPETITION_TAB.FLOOR) {
  if (competitionMode === COMPETITION_TAB.SHINY) {
    return tEvent('ShinyPrize', { amount: cfg.prizeBeastCoins });
  }
  return competitionMode === COMPETITION_TAB.RANK
    ? tEvent('RankPrize', { amount: cfg.prizeBeastCoins })
    : tEvent('FloorPrize', { amount: cfg.prizeBeastCoins });
}

function buildTblLeagueSummaryLeftColHtml(participantCount = 0, competitionMode = COMPETITION_TAB.FLOOR) {
  let leftCol = `<div class="tbl-event-timer-row pixel-font-14" style="margin-bottom:6px;"><span class="tbl-event-timer-value" style="color:#ccc;">—</span></div>`;
  leftCol += `<div class="tbl-league-participant-count" style="margin-bottom:6px;">${escapeTblHtml(tEvent('Participants', { count: participantCount }))}</div>`;
  leftCol += `<div class="tbl-event-prize-row pixel-font-14" style="margin-bottom:6px;display:flex;align-items:center;gap:4px;color:#ffd700;">
    <span class="tbl-league-prize-label">${escapeTblHtml(getTblLeaguePrizeText(competitionMode))}</span>
    <img src="/assets/icons/beastcoin.png" alt="Beast Coins" class="pixelated" style="width:12px;height:12px;object-fit:contain;flex-shrink:0;" />
  </div>`;
  leftCol += `<div class="tbl-league-current-leader-row pixel-font-14" style="margin-bottom:6px;">${buildTblLeagueCurrentLeaderRowHtml([], competitionMode)}</div>`;
  return leftCol;
}

function updateTblLeagueSummaryPrize(prizeEl, competitionMode) {
  if (!prizeEl) {
    return;
  }
  prizeEl.textContent = getTblLeaguePrizeText(competitionMode);
}

function updateTblLeagueSummaryCurrentLeader(leaderEl, rows, competitionMode) {
  if (!leaderEl) {
    return;
  }
  leaderEl.innerHTML = buildTblLeagueCurrentLeaderRowHtml(rows, competitionMode);
}

function updateTblLeagueSummaryParticipantCount(participantEl, participantCount = 0) {
  if (!participantEl) {
    return;
  }
  participantEl.textContent = tEvent('Participants', { count: participantCount });
}

function updateTblLeagueSummaryLoading(standingsCol, competitionMode = COMPETITION_TAB.FLOOR) {
  if (!standingsCol) {
    return;
  }
  const title = competitionMode === COMPETITION_TAB.SHINY
    ? tEvent('TopShinyPlayers')
    : (competitionMode === COMPETITION_TAB.RANK
      ? tEvent('TopRankPlayers')
      : tEvent('TopFloorPlayers'));
  standingsCol.innerHTML = `<div class="tbl-league-top-players"><div class="tbl-league-top-players-title">${escapeTblHtml(title)}</div><div style="color:#888;margin-top:4px;text-align:center;padding:8px 0;">${escapeTblHtml(tEvent('Loading'))}</div></div>`;
}

function buildTblLeagueSummaryStandingsHtml(rows, competitionMode = COMPETITION_TAB.FLOOR) {
  const playerName = getTblPlayerName();
  const includeViewerInStandings = state.currentPlayerEligible !== false;
  const standings = buildTblOverallStandings(
    rows,
    includeViewerInStandings ? playerName : null,
    competitionMode
  );
  const visibleStandings = includeViewerInStandings || !playerName
    ? standings
    : standings.filter((entry) => entry?.name !== playerName);

  let rightCol = `<div class="tbl-league-top-players"><div class="tbl-league-top-players-title">${escapeTblHtml(
    competitionMode === COMPETITION_TAB.SHINY
      ? tEvent('TopShinyPlayers')
      : (competitionMode === COMPETITION_TAB.RANK
        ? tEvent('TopRankPlayers')
        : tEvent('TopFloorPlayers'))
  )}</div>`;
  if (visibleStandings.length > 0) {
    const standingsWithRank = visibleStandings.map((player, index) => ({ player, rank: index + 1 }));
    const topThree = standingsWithRank.slice(0, 3);
    const yourRow = includeViewerInStandings && playerName
      ? standingsWithRank.find((entry) => entry.player?.name === playerName) || null
      : null;

    rightCol += buildTblLeagueTopPlayersGridHtml(
      topThree,
      competitionMode,
      playerName,
      yourRow && yourRow.rank > 3 ? yourRow : null
    );
  } else {
    rightCol += competitionMode === COMPETITION_TAB.SHINY
      ? `<div style="color:#888;margin-top:4px;text-align:center;">${escapeTblHtml(tEvent('ShinyNoneYet'))}</div>`
      : (competitionMode === COMPETITION_TAB.RANK
        ? `<div style="color:#888;margin-top:4px;text-align:center;">${escapeTblHtml(tEvent('RankNoRuns'))}</div>`
        : `<div style="color:#888;margin-top:4px;text-align:center;">${escapeTblHtml(tEvent('NoRuns', { ticks: cfg.missingFloorTicks }))}</div>`);
  }
  rightCol += '</div>';
  return rightCol;
}

function updateTblLeagueSummaryStandings(standingsCol, rows, competitionMode) {
  if (!standingsCol) {
    return;
  }
  standingsCol.innerHTML = buildTblLeagueSummaryStandingsHtml(rows, competitionMode);
}

function createTblLeagueSharedSummary(participantCount) {
  const html = `<div class="tbl-league-summary-grid">
    <div class="tbl-league-summary-col">${buildTblLeagueSummaryLeftColHtml(participantCount)}</div>
    <div class="tbl-league-summary-separator" role="none"></div>
    <div class="tbl-league-summary-col tbl-league-standings-col"></div>
  </div>`;
  const panel = createTblStatsPanel(html);
  panel.style.flexShrink = '0';
  return {
    panel,
    standingsCol: panel.querySelector('.tbl-league-standings-col'),
    prizeLabel: panel.querySelector('.tbl-league-prize-label'),
    leaderRow: panel.querySelector('.tbl-league-current-leader-row'),
    participantCountEl: panel.querySelector('.tbl-league-participant-count')
  };
}

function getTblLeagueTabButtonClassName(isActive) {
  return isActive
    ? 'frame-pressed-1 surface-regular px-2 py-1 flex-1 tab-active pixel-font-14'
    : 'frame-pressed-1 surface-dark px-2 py-1 flex-1 pixel-font-14';
}

function setTblLeagueTabButtonLabel(button, iconDef, label) {
  button.replaceChildren();

  const iconWrap = document.createElement('span');
  Object.assign(iconWrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${cfg.tabIconSize}px`,
    height: `${cfg.tabIconSize}px`,
    flexShrink: '0'
  });

  const img = document.createElement('img');
  img.src = iconDef.src;
  img.alt = iconDef.alt || label;
  img.className = 'pixelated';
  Object.assign(img.style, {
    width: `${cfg.tabIconSize}px`,
    height: `${cfg.tabIconSize}px`,
    objectFit: 'contain',
    display: 'block'
  });
  iconWrap.appendChild(img);
  button.appendChild(iconWrap);

  const text = document.createElement('span');
  text.textContent = label;
  text.style.lineHeight = '1';
  button.appendChild(text);
}

function createTblLeagueTabButton(iconDef, label, tabId, isActive, onTabChange) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.tab = tabId;
  button.className = getTblLeagueTabButtonClassName(isActive);
  Object.assign(button.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer'
  });
  setTblLeagueTabButtonLabel(button, iconDef, label);
  button.addEventListener('click', () => onTabChange(tabId));
  return button;
}

function createTblLeagueTabBar(activeTab, onTabChange) {
  const bar = document.createElement('div');
  bar.className = 'flex mb-2';
  bar.style.flexShrink = '0';

  const tabDefs = [
    { id: COMPETITION_TAB.FLOOR, label: tEvent('TabFloor'), icon: cfg.tabIcons.floor },
    { id: COMPETITION_TAB.RANK, label: tEvent('TabRank'), icon: cfg.tabIcons.rank }
  ];
  if (isTblShinyCompetitionEnabled()) {
    tabDefs.push({
      id: COMPETITION_TAB.SHINY,
      label: tEvent('TabShiny'),
      icon: cfg.tabIcons.shiny || { src: '/assets/icons/star-tier-shiny.png', alt: 'Shiny' }
    });
  }

  const buttons = tabDefs.map(({ id, label, icon }) => {
    const button = createTblLeagueTabButton(icon, label, id, id === activeTab, onTabChange);
    bar.appendChild(button);
    return button;
  });

  return { bar, buttons, tabDefs };
}

function createTblLeagueListPanel(scrollContainer) {
  const panel = document.createElement('div');
  panel.className = 'tbl-league-list-panel';
  panel.appendChild(scrollContainer.element);
  return panel;
}

function createTblLeagueTabLoadingScrollContainer() {
  const scrollContainer = createTblScrollContainer();
  const loadingEl = document.createElement('div');
  loadingEl.className = 'pixel-font-14';
  Object.assign(loadingEl.style, {
    color: '#888',
    textAlign: 'center',
    padding: '20px 8px'
  });
  loadingEl.textContent = tEvent('Loading');
  scrollContainer.addContent(loadingEl);
  return scrollContainer;
}

function setTblLeagueListPanelContent(panel, scrollContainer) {
  if (!panel || !scrollContainer?.element) {
    return;
  }
  panel.replaceChildren(scrollContainer.element);
}

async function navigateTblToEventMap() {
  if (!globalThis.state?.board?.send) {
    return false;
  }

  if (isTblOnEventBoardRoom()) {
    return true;
  }

  try {
    if (typeof window.markModSettingsProgrammaticNavFloorGuard === 'function') {
      window.markModSettingsProgrammaticNavFloorGuard('event-competition-toast');
    }

    globalThis.state.board.send({
      type: 'selectRoomById',
      roomId: cfg.roomId
    });

    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (isTblOnEventBoardRoom()) {
        return true;
      }
    }

    return isTblOnEventBoardRoom();
  } catch (error) {
    console.warn(`${logPrefix} Failed to navigate to event map:`, error);
    return false;
  }
}

async function navigateTblToFloor(floor) {
  const targetFloor = Math.min(cfg.floors.max, Math.max(cfg.floors.min, Number(floor)));
  if (!Number.isFinite(targetFloor) || !globalThis.state?.board?.send) {
    return;
  }
  if (!isTblFloorUnlocked(targetFloor)) {
    return;
  }

  try {
    const navigated = await navigateTblToEventMap();
    if (!navigated) {
      return;
    }

    globalThis.state?.board?.trigger?.setState?.({
      fn: (prev) => ({ ...prev, floor: targetFloor })
    });

    state.lastBarFloor = targetFloor;
    closeTblFloorLeagueModal();
    setTimeout(() => {
      refreshTblFloorBarSection().catch(() => {});
    }, 100);
  } catch (error) {
    console.warn(`${logPrefix} Failed to navigate to floor:`, error);
  }
}

function buildTblImprovementText(row) {
  if (state.currentPlayerEligible === false) {
    return '';
  }
  if (!row.unlocked) {
    return tEvent('FloorLocked');
  }
  if (row.youLead) {
    return tEvent('YouLead');
  }
  if (row.yourTicks === null || row.yourTicks === undefined) {
    const penaltyTicks = cfg.missingFloorTicks;
    if (row.fromHighscores) {
      return row.leaderTicks !== null
        ? tEvent('NoPersonalBest', { ticks: penaltyTicks })
        : tEvent('NoRuns', { ticks: penaltyTicks });
    }
    return row.leaderTicks !== null
      ? tEvent('NoRunYet', { ticks: penaltyTicks })
      : tEvent('NoRuns', { ticks: penaltyTicks });
  }
  if (row.gap !== null && row.gap > 0) {
    return tEvent('TicksBehind', { ticks: row.gap });
  }
  if (row.gap === 0) {
    return tEvent('Tied');
  }
  return tEvent('NoRuns', { ticks: cfg.missingFloorTicks });
}

function buildTblRankImprovementText(row) {
  if (state.currentPlayerEligible === false) {
    return '';
  }
  if (!row.unlocked) {
    return tEvent('FloorLocked');
  }
  if (row.youLead) {
    return tEvent('YouLead');
  }
  if (row.yourRank === null || row.yourRank === undefined) {
    if (row.fromHighscores) {
      return row.leaderRank !== null
        ? tEvent('RankNoPersonalBest')
        : tEvent('RankNoRuns');
    }
    return row.leaderRank !== null
      ? tEvent('RankNoRunYet')
      : tEvent('RankNoRuns');
  }
  if (row.gap !== null && row.gap > 0) {
    if (row.gapType === 'ticks') {
      return tEvent('TicksBehind', { ticks: row.gap });
    }
    return tEvent('PointsBehind', { points: row.gap });
  }
  if (row.gap === 0) {
    return tEvent('Tied');
  }
  return tEvent('RankNoRuns');
}

function buildTblShinyThumbHtml() {
  const gameId = getTblShinyCreatureGameId();
  const portraitSrc = Number.isFinite(gameId)
    ? `/assets/portraits/${gameId}-shiny.png`
    : '/assets/icons/star-tier-shiny.png';
  return `
    <div class="tbl-league-floor-thumb frame-pressed-1 shrink-0">
      <img
        src="${portraitSrc}"
        alt="${escapeTblHtml(cfg.shinyCompetition?.creatureName || 'Shiny')}"
        class="pixelated tbl-league-floor-thumb-bg" />
      <div class="tbl-league-floor-thumb-overlay">
        <img src="/assets/icons/star-tier-shiny.png" alt="Shiny" class="pixelated" width="18" height="18" style="filter:drop-shadow(0 0 2px #fff);object-fit:contain;" />
      </div>
    </div>
  `;
}

function formatTblShinyRowNameHtml(name, viewerName) {
  if (!name) {
    return '—';
  }
  if (viewerName && name === viewerName) {
    return `<span style="color:#8f8;">${escapeTblHtml(name)}</span>`;
  }
  return formatTblProfileLink(name);
}

function buildTblShinyRowList(rows) {
  const scrollContainer = createTblScrollContainer();
  const viewerName = getTblPlayerName();

  rows.forEach((row) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
    const count = Number(row.count) || 0;
    const isYou = Boolean(viewerName && row.name === viewerName);
    const nameHtml = formatTblShinyRowNameHtml(row.name, viewerName);
    const countLabel = escapeTblHtml(tEvent('ShinyCountLabel', { count }));
    const dropLabel = escapeTblHtml(tEvent('ShinyDropLabel', {
      time: getTblPlayerShinyDropLabel(row)
    }));
    const rankLabel = row.rank ? `#${row.rank}` : '—';
    const rankColor = isYou ? '#8f8' : '#ccc';

    itemEl.innerHTML = `
      ${buildTblShinyThumbHtml()}
      <div class="grid w-full gap-1">
        <div class="flex items-center justify-between gap-2">
          <div>${nameHtml}</div>
          <div class="pixel-font-14" style="color:${rankColor};">${escapeTblHtml(rankLabel)}</div>
        </div>
        <div class="pixel-font-14">${countLabel}</div>
        <div class="pixel-font-14" style="color:#aaa;">${dropLabel}</div>
      </div>
    `;
    scrollContainer.addContent(itemEl);
  });

  if (!rows.length) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'pixel-font-14';
    emptyEl.style.color = '#888';
    emptyEl.style.textAlign = 'center';
    emptyEl.style.padding = '12px 8px';
    emptyEl.textContent = tEvent('ShinyNoneYet');
    scrollContainer.addContent(emptyEl);
  }

  return scrollContainer;
}

function buildTblLeagueRowList(rows, competitionMode) {
  const scrollContainer = createTblScrollContainer();
  const isRankMode = competitionMode === COMPETITION_TAB.RANK;
  const isViewerIneligible = state.currentPlayerEligible === false;

  rows.forEach((row) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
    const visualUnlocked = row.unlocked || isViewerIneligible;
    const hasYourScore = isRankMode
      ? (row.yourRank !== null && row.yourRank !== undefined)
      : (row.yourTicks !== null && row.yourTicks !== undefined);

    if (!visualUnlocked) {
      itemEl.classList.add('tbl-league-item--locked');
    } else {
      itemEl.classList.add('tbl-league-item--clickable');
      if (!hasYourScore && !isViewerIneligible) {
        itemEl.classList.add('tbl-league-item--empty');
      }
      if (row.unlocked) {
        itemEl.addEventListener('click', () => {
          navigateTblToFloor(row.floor);
        });
      }
    }
    const statusColor = visualUnlocked ? '#8f8' : '#888';
    const comparisonHtml = isRankMode
      ? formatTblRankComparison(
        row.yourRank,
        row.yourTicks,
        row.leaderRank,
        row.leaderTicks,
        row.leader?.name,
        row.youLead
      )
      : formatTblTicksComparison(row.yourTicks, row.leaderTicks, row.leader?.name, row.youLead);
    const statusText = isRankMode
      ? buildTblRankImprovementText(row)
      : buildTblImprovementText(row);
    const statusHtml = statusText
      ? `<div class="pixel-font-14" style="color:${statusColor};">${escapeTblHtml(statusText)}</div>`
      : '';

    itemEl.innerHTML = `
      ${buildTblLeagueThumbHtml(row.floor, competitionMode)}
      <div class="grid w-full gap-1">
        <div>${formatTblFloorRowTitleHtml(row.floor, row.ascension)}</div>
        <div class="pixel-font-14">${comparisonHtml}</div>
        ${statusHtml}
      </div>
    `;
    scrollContainer.addContent(itemEl);
  });

  return scrollContainer;
}

function buildTblLeagueThumbHtml(floor, competitionMode = COMPETITION_TAB.FLOOR) {
  const floorIndex = Math.min(cfg.floors.max, Math.max(cfg.floors.min, Math.round(Number(floor) || 0)));
  const floorStyle = buildTblFloorScaleTextStyle(floorIndex);
  const isRankMode = competitionMode === COMPETITION_TAB.RANK;
  const overlayIcon = isRankMode
    ? `<img src="/assets/icons/star-tier.png" alt="Rank" class="pixelated" width="18" height="20" style="filter:drop-shadow(rgb(255,255,255) 0px 0px 2px);object-fit:contain;" />`
    : `<img src="/assets/icons/speed.png" alt="Ticks" class="pixelated" width="22" height="22" style="filter:drop-shadow(0 0 2px #fff);object-fit:contain;" />`;
  return `
    <div class="tbl-league-floor-thumb frame-pressed-1 shrink-0">
      <img
        src="/assets/room-thumbnails/${cfg.roomId}.png"
        alt="Tibia Ball League"
        class="pixelated tbl-league-floor-thumb-bg" />
      <div class="tbl-league-floor-thumb-overlay">
        ${overlayIcon}
        <span class="pixel-font-14" style="line-height:1;color:${floorStyle.color};text-shadow:${floorStyle.textShadow};">${floorIndex}</span>
      </div>
    </div>
  `;
}

function createTblLeagueModalContent(options = {}) {
  const {
    forceRefresh = false,
    participantCount = 0,
    modalLoadSession = 0
  } = options;
  const activeTab = state.activeModalTab || COMPETITION_TAB.FLOOR;
  const {
    panel: summaryPanel,
    standingsCol,
    prizeLabel,
    leaderRow,
    participantCountEl
  } = createTblLeagueSharedSummary(participantCount);

  const tabStore = {
    [COMPETITION_TAB.FLOOR]: { rows: null, loadPromise: null },
    [COMPETITION_TAB.RANK]: { rows: null, loadPromise: null }
  };
  if (isTblShinyCompetitionEnabled()) {
    tabStore[COMPETITION_TAB.SHINY] = { rows: null, loadPromise: null };
  }

  const floorListPanel = createTblLeagueListPanel(createTblLeagueTabLoadingScrollContainer());
  const rankListPanel = createTblLeagueListPanel(createTblLeagueTabLoadingScrollContainer());
  const shinyListPanel = isTblShinyCompetitionEnabled()
    ? createTblLeagueListPanel(createTblLeagueTabLoadingScrollContainer())
    : null;

  const container = document.createElement('div');
  container.className = 'flex flex-col tbl-league-modal-content';
  Object.assign(container.style, {
    height: '100%',
    minHeight: '0',
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    overflow: 'hidden'
  });

  let tabButtons = [];

  const getModeForTab = (tab) => {
    if (tab === COMPETITION_TAB.RANK) {
      return COMPETITION_TAB.RANK;
    }
    if (tab === COMPETITION_TAB.SHINY) {
      return COMPETITION_TAB.SHINY;
    }
    return COMPETITION_TAB.FLOOR;
  };

  const getPanelForTab = (tab) => {
    if (tab === COMPETITION_TAB.RANK) {
      return rankListPanel;
    }
    if (tab === COMPETITION_TAB.SHINY) {
      return shinyListPanel;
    }
    return floorListPanel;
  };

  const isModalSessionActive = () => modalLoadSession === state.modalLoadSession;

  const seedTabFromCache = (tab) => {
    if (forceRefresh) {
      return;
    }
    const entry = tabStore[tab];
    if (!entry || entry.rows) {
      return;
    }

    let cachedRows = null;
    if (tab === COMPETITION_TAB.FLOOR && state.floorBarRows) {
      cachedRows = state.floorBarRows;
    } else if (tab === COMPETITION_TAB.RANK && state.rankBarRows) {
      cachedRows = state.rankBarRows;
    } else if (tab === COMPETITION_TAB.SHINY && state.shinyBarRows) {
      cachedRows = state.shinyBarRows;
    }

    if (!cachedRows) {
      return;
    }

    entry.rows = cachedRows;
    renderTabPanelLoaded(tab, cachedRows);
  };

  const prefetchInactiveModalTabs = (currentTab) => {
    Object.keys(tabStore).forEach((tab) => {
      if (tab !== currentTab) {
        loadTabData(tab, forceRefresh);
      }
    });
  };

  const updateSummaryForTab = (tab, rows) => {
    const mode = getModeForTab(tab);
    updateTblLeagueSummaryStandings(standingsCol, rows, mode);
    updateTblLeagueSummaryPrize(prizeLabel, mode);
    updateTblLeagueSummaryCurrentLeader(leaderRow, rows, mode);
  };

  const renderTabPanelLoading = (tab) => {
    const panel = getPanelForTab(tab);
    if (!panel) {
      return;
    }
    setTblLeagueListPanelContent(panel, createTblLeagueTabLoadingScrollContainer());
  };

  const renderTabPanelLoaded = (tab, rows) => {
    const panel = getPanelForTab(tab);
    if (!panel) {
      return;
    }
    const scrollContainer = tab === COMPETITION_TAB.SHINY
      ? buildTblShinyRowList(rows)
      : buildTblLeagueRowList(rows, tab);
    setTblLeagueListPanelContent(panel, scrollContainer);
  };

  const renderTabPanelError = (tab) => {
    const panel = getPanelForTab(tab);
    if (!panel) {
      return;
    }
    const scrollContainer = createTblScrollContainer();
    const errorEl = document.createElement('div');
    errorEl.className = 'pixel-font-14';
    Object.assign(errorEl.style, {
      color: '#888',
      textAlign: 'center',
      padding: '20px 8px'
    });
    errorEl.textContent = tEvent('LoadError');
    scrollContainer.addContent(errorEl);
    setTblLeagueListPanelContent(panel, scrollContainer);
  };

  const loadTabData = (tab, force = false) => {
    const entry = tabStore[tab];
    if (!entry) {
      return Promise.resolve([]);
    }
    if (entry.rows && !force) {
      renderTabPanelLoaded(tab, entry.rows);
      if (state.activeModalTab === tab && isModalSessionActive()) {
        updateSummaryForTab(tab, entry.rows);
        updateTblLeagueSummaryParticipantCount(participantCountEl, state.participantCount || 0);
      }
      return Promise.resolve(entry.rows);
    }
    if (entry.loadPromise && !force) {
      return entry.loadPromise;
    }

    renderTabPanelLoading(tab);

    entry.loadPromise = (async () => {
      try {
        let rows = [];
        if (tab === COMPETITION_TAB.FLOOR) {
          rows = await loadTblAllFloorData(force);
          if (isModalSessionActive()) {
            state.floorBarRows = rows;
            state.floorBarCacheAt = Date.now();
          }
        } else if (tab === COMPETITION_TAB.RANK) {
          rows = await loadTblAllRankData(force);
          if (isModalSessionActive()) {
            state.rankBarRows = rows;
            state.rankBarCacheAt = Date.now();
          }
        } else if (tab === COMPETITION_TAB.SHINY) {
          rows = await loadTblAllShinyData(force);
          if (isModalSessionActive()) {
            state.shinyBarRows = rows;
            state.shinyBarCacheAt = Date.now();
          }
        }

        if (!isModalSessionActive()) {
          return rows;
        }

        entry.rows = rows;
        renderTabPanelLoaded(tab, rows);
        updateTblLeagueSummaryParticipantCount(participantCountEl, state.participantCount || 0);

        if (state.activeModalTab === tab) {
          updateSummaryForTab(tab, rows);
        }
        return rows;
      } catch (error) {
        console.warn(`${logPrefix} Failed to load ${tab} tab data:`, error);
        if (isModalSessionActive()) {
          renderTabPanelError(tab);
          if (state.activeModalTab === tab) {
            updateTblLeagueSummaryLoading(standingsCol, getModeForTab(tab));
          }
        }
        return entry.rows || [];
      } finally {
        entry.loadPromise = null;
      }
    })();

    return entry.loadPromise;
  };

  const setActiveTab = (tab) => {
    state.activeModalTab = tab;
    const mode = getModeForTab(tab);
    const entry = tabStore[tab];
    updateTblLeagueSummaryPrize(prizeLabel, mode);

    if (entry?.rows) {
      renderTabPanelLoaded(tab, entry.rows);
      updateSummaryForTab(tab, entry.rows);
    } else {
      updateTblLeagueSummaryCurrentLeader(leaderRow, [], mode);
      updateTblLeagueSummaryLoading(standingsCol, mode);
    }

    floorListPanel.style.display = tab === COMPETITION_TAB.FLOOR ? 'flex' : 'none';
    rankListPanel.style.display = tab === COMPETITION_TAB.RANK ? 'flex' : 'none';
    if (shinyListPanel) {
      shinyListPanel.style.display = tab === COMPETITION_TAB.SHINY ? 'flex' : 'none';
    }
    tabButtons.forEach((button) => {
      button.className = getTblLeagueTabButtonClassName(button.dataset.tab === tab);
    });

    updateTblEventTimerDisplay();
    loadTabData(tab, forceRefresh);
  };

  const { bar: tabBar, buttons } = createTblLeagueTabBar(activeTab, setActiveTab);
  tabButtons = buttons;

  container.appendChild(summaryPanel);
  container.appendChild(tabBar);
  container.appendChild(floorListPanel);
  container.appendChild(rankListPanel);
  if (shinyListPanel) {
    container.appendChild(shinyListPanel);
  }
  Object.keys(tabStore).forEach(seedTabFromCache);
  setActiveTab(activeTab);
  prefetchInactiveModalTabs(activeTab);

  return {
    element: container,
    reloadTab: (tab) => loadTabData(tab, true)
  };
}

function closeTblFloorLeagueModal() {
  clearTblModalLayoutCleanup();
  clearTblEventTimerUpdates();
  state.modalLoadSession += 1;
  if (state.modalRef?.close) {
    state.modalRef.close();
  } else {
    getTblModalDialog()?.remove();
  }
  state.modalRef = null;
}

async function refreshTblFloorLeagueModalIfOpen() {
  if (!state.modalRef) {
    return;
  }
  closeTblFloorLeagueModal();
  await openTblFloorLeagueModal(true);
}

async function openTblFloorLeagueModal(forceRefresh = false) {
  const api = getApi();
  if (!api?.ui?.components?.createModal) {
    console.warn(`${logPrefix} Modal API unavailable`);
    return;
  }

  closeTblFloorLeagueModal();
  ensureTblLeagueStyles();
  const modalLoadSession = state.modalLoadSession;

  refreshTblJoinState(forceRefresh).catch(() => {});

  try {
    const modalContent = createTblLeagueModalContent({
      forceRefresh,
      participantCount: state.participantCount || 0,
      modalLoadSession
    });

    const modalButtons = [
      {
        text: translate('mods.betterUI.betterHighscoresContextMenuClose'),
        primary: true,
        onClick: () => closeTblFloorLeagueModal()
      }
    ];
    if (!state.joined && state.currentPlayerEligible !== false) {
      modalButtons.unshift({
        text: tEvent('Join'),
        primary: false,
        onClick: () => joinTblFloorLeague()
      });
    }

    const modalDimensions = getTblModalDimensions();
    const modalRef = api.ui.components.createModal({
      title: tEvent('Title'),
      width: modalDimensions.width,
      height: modalDimensions.height,
      content: modalContent.element,
      buttons: modalButtons
    });

    state.modalRef = modalRef;
    setupTblModalResponsiveLayout(modalRef, modalContent.element);
    setupTblEventTimerUpdates();

    const originalClose = modalRef.close?.bind(modalRef);
    if (originalClose) {
      modalRef.close = () => {
        closeTblFloorLeagueModal();
        originalClose();
      };
    }
  } catch (error) {
    console.warn(`${logPrefix} Failed to open league modal:`, error);
    api.ui?.components?.createModal?.({
      title: translate('common.error'),
      content: `<p>${escapeTblHtml(tEvent('LoadError'))}</p>`,
      buttons: [{ text: translate('controls.ok'), primary: true }]
    });
  }
}

function decorateTblFloorSection(section, userScores) {
  if (!isTblMapActive()) {
    return;
  }

  section.style.cursor = 'default';
  section.title = '';

  const parent = section.parentElement;
  const leaderboardContainer = getLeaderboardContainer?.() || null;
  if (!parent) {
    const existingBtn = section.querySelector('.tbl-event-competition-btn');
    if (existingBtn) {
      existingBtn.remove();
    }
    if (!section.dataset.tblEventButtonPending) {
      section.dataset.tblEventButtonPending = '1';
      scheduleTimeout(() => {
        if (!isDisposed() && section.isConnected) {
          decorateTblFloorSection(section, userScores);
        }
      }, 0);
    }
    if (section.dataset.tblEventClickBound === '1' && section._tblEventClickHandler) {
      section.removeEventListener('click', section._tblEventClickHandler);
      delete section._tblEventClickHandler;
      delete section.dataset.tblEventClickBound;
    }
    return;
  }
  delete section.dataset.tblEventButtonPending;
  if (leaderboardContainer) {
    leaderboardContainer.querySelectorAll('.tbl-event-competition-btn-host').forEach((node) => node.remove());
  } else {
    parent.querySelectorAll('.tbl-event-competition-btn-host').forEach((node) => node.remove());
  }

  const eventBtn = createTblEventCompetitionButton();
  eventBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!state.joined) {
      const eligible = await isTblCurrentPlayerEligible();
      if (!eligible) {
        openTblFloorLeagueModal();
        return;
      }
      joinTblFloorLeague().then((joined) => {
        if (joined) {
          openTblFloorLeagueModal();
        }
      });
      return;
    }
    openTblFloorLeagueModal();
  });
  if (leaderboardContainer) {
    const host = document.createElement('div');
    host.className = 'tbl-event-competition-btn-host';
    Object.assign(host.style, {
      display: 'flex',
      alignItems: 'stretch',
      position: 'absolute',
      left: '100%',
      top: '0',
      bottom: '0',
      transform: 'translateX(6px)',
      zIndex: '2',
      pointerEvents: 'auto'
    });
    Object.assign(eventBtn.style, {
      height: '100%',
      boxSizing: 'border-box',
      border: '4px solid transparent',
      borderImage: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 4 stretch',
      borderRadius: '4px',
      background: 'url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png")',
      backgroundSize: 'auto',
      backgroundRepeat: 'repeat',
      padding: '0 6px'
    });
    host.appendChild(eventBtn);
    leaderboardContainer.appendChild(host);
  } else if (parent) {
    const host = document.createElement('div');
    host.className = 'tbl-event-competition-btn-host';
    Object.assign(host.style, {
      display: 'flex',
      alignItems: 'center',
      flexShrink: '0',
      marginLeft: '2px'
    });
    host.appendChild(eventBtn);
    if (section.nextSibling) {
      parent.insertBefore(host, section.nextSibling);
    } else {
      parent.appendChild(host);
    }
  }
  if (section.dataset.tblEventClickBound === '1' && section._tblEventClickHandler) {
    section.removeEventListener('click', section._tblEventClickHandler);
    delete section._tblEventClickHandler;
    delete section.dataset.tblEventClickBound;
  }
}

function setupTblBoardListener() {
  if (state.boardUnsubscribe || !globalThis.state?.board?.subscribe) {
    return;
  }

  state.boardUnsubscribe = globalThis.state.board.subscribe(({ context }) => {
    if (isDisposed()) {
      return;
    }
    if (isTblMapActive()) {
      const selectedFloor = getSelectedBoardFloor();
      if (selectedFloor !== state.lastBarFloor) {
        state.lastBarFloor = selectedFloor;
        refreshTblFloorBarSection().catch(() => {});
      }
      trackTblBattleSetup(context);
    }

    const serverResults = context?.serverResults;
    if (!serverResults?.rewardScreen || typeof serverResults.seed === 'undefined') {
      return;
    }

    const seed = serverResults.seed;
    if (seed === state.lastProcessedSeed) {
      return;
    }

    scheduleTimeout(() => {
      const freshResults = getTblServerResultsFromBoard();
      if (!freshResults?.rewardScreen || freshResults.seed !== seed) {
        trySubmitTblAfterBattle();
        return;
      }
      handleTblServerResults(freshResults, seed).catch((err) => {
        console.warn(`${logPrefix} Server results handling failed:`, err);
      });
    }, 0);
  });
  addSubscription(state.boardUnsubscribe);
}

function setupTblRunTrackerTrigger() {
  if (state.runTrackerTrigger) {
    return;
  }
  state.runTrackerTrigger = () => {
    trySubmitTblAfterBattle(4);
  };
  window.addEventListener('runtracker:runsUpdated', state.runTrackerTrigger);
}

function initTblFloorLeague() {
  state.joined = readTblJoinedLocal();
  refreshTblJoinState().catch(() => {});
  purgeTblIneligibleFirebaseRecords().catch(() => {});
  setupTblNetworkListener();
  setupTblBoardListener();
  setupTblRunTrackerTrigger();
  setupTblEventCountdownToastWatcher();
}

function cleanupTblFloorLeague() {
  closeTblFloorLeagueModal();
  clearTblModalLayoutCleanup();
  clearTblEventTimerUpdates();
  clearTblEventCountdownToastWatcher();
  cleanupTblToastContainer();
  removeTblBoardSubscription();
  if (state.fetchRestore) {
    window.fetch = state.fetchRestore;
    state.fetchRestore = null;
  }
  if (state.runTrackerTrigger) {
    window.removeEventListener('runtracker:runsUpdated', state.runTrackerTrigger);
    state.runTrackerTrigger = null;
  }
  state.joined = false;
  state.joinChecked = false;
  state.joinedAt = 0;
  state.playerHash = null;
  state.lastProcessedSeed = null;
  state.myEventScores = {};
  state.myEventRankScores = {};
  state.myEventRankTicks = {};
  state.eventNextCheckEndTime = null;
  state.lastCountdownToastDays = null;
  state.lastCountdownToastLiveShown = false;
  state.eventWasActive = false;
  state.floorBarRows = null;
  state.floorBarCacheAt = 0;
  state.rankBarRows = null;
  state.rankBarCacheAt = 0;
  state.shinyBarRows = null;
  state.shinyBarCacheAt = 0;
  state.shinyScoresByName = null;
  state.activeModalTab = COMPETITION_TAB.FLOOR;
  state.lastBarFloor = null;
  state.trackedBattleSetup = null;
  state.playerTotalTicks = null;
  state.playerTotalRanks = null;
  state.playerTotalRankTicks = null;
  state.participantCount = 0;
  state.fetchCache.clear();
  state.fetchInFlight.clear();
  state.profileCache.clear();
  state.profileFetchInFlight.clear();
  state.fullLoadInFlight = null;
  state.rankFullLoadInFlight = null;
  state.shinyFullLoadInFlight = null;
  state.lastFullLoadAt = 0;
  state.lastRankFullLoadAt = 0;
  state.lastShinyFullLoadAt = 0;
  state.lastParticipantSyncAt = 0;
  state.joinStateCachedAt = 0;
  state.eligibilityCheckedAt = 0;
  state.currentPlayerEligible = true;
  state.eligibilityByName.clear();
  state.purgeInFlight = null;
  state.lastIneligiblePurgeAt = 0;
  state.modalLoadSession += 1;
}

    return {
      id: cfg.id,
      config: cfg,
      init: initTblFloorLeague,
      cleanup: cleanupTblFloorLeague,
      decorateFloorSection: decorateTblFloorSection,
      createFloorLeaderboardSection: createTblFloorLeaderboardSection,
      createRankLeaderboardSection: createTblRankLeaderboardSection,
      scheduleFloorBarRefresh: scheduleTblFloorBarRefresh,
      isMapActive: isTblMapActive,
      isCompetitionActive: isTblEventCompetitionActive,
      refreshFloorBarSection: refreshTblFloorBarSection,
      trySubmitAfterBattle: trySubmitTblAfterBattle
    };
  }

  const instances = new Map();

  window.EventCompetition = {
    create: createEventCompetitionInstance,
    register(config, deps) {
      const instance = createEventCompetitionInstance(config, deps);
      instances.set(config.id, instance);
      return instance;
    },
    get(id) {
      return instances.get(id);
    },
    getForMap(mapCode) {
      for (const instance of instances.values()) {
        if (instance.isMapActive(mapCode)) {
          return instance;
        }
      }
      return null;
    },
    getAll() {
      return Array.from(instances.values());
    }
  };
})();
}
