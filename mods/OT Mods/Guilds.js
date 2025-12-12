// =======================
// Guild System Mod
// =======================
'use strict';

console.log('[Guilds] initializing...');

// =======================
// Configuration & Constants
// =======================

const STORAGE_KEYS = {
  GUILD_DATA: 'guilds-data',
  GUILD_CONFIG: 'guilds-config',
  PANEL_SETTINGS: 'guilds-panel-settings',
  CHAT_PANEL_POSITIONS: 'guilds-chat-panel-positions',
  CHAT_PANEL_SETTINGS: 'guilds-chat-panel-settings'
};

const GUILD_CONFIG = {
  firebaseUrl: 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app',
  checkInterval: 5000,
  maxMessageLength: 1000,
  maxGuildNameLength: 20,
  maxGuildDescriptionLength: 200,
  maxMembers: 50
};

const POINTS_CONFIG = {
  LEVELS_PER_POINT: 100,
  RANK_POINTS_PER_POINT: 1,
  TIME_SUM_PENALTY_DIVISOR: 10000,
  WORLD_RECORD_BONUS: 5
};

const GUILD_ROLES = {
  LEADER: 'leader',
  OFFICER: 'officer',
  MEMBER: 'member'
};

const GUILD_JOIN_TYPES = {
  OPEN: 'open',
  INVITE_ONLY: 'invite_only'
};

const ROLE_PERMISSIONS = {
  [GUILD_ROLES.LEADER]: ['invite', 'kick', 'promote', 'demote', 'edit', 'delete', 'chat'],
  [GUILD_ROLES.OFFICER]: ['invite', 'kick', 'chat'],
  [GUILD_ROLES.MEMBER]: ['chat']
};

const MODAL_DIMENSIONS = {
  WIDTH: 550,
  HEIGHT: 360
};

const GUILD_PANEL_DIMENSIONS = {
  WIDTH: 650,  // 550 + 100 (50px each side)
  HEIGHT: 460  // 360 + 100 (50px each side)
};

const PANEL_DIMENSIONS = {
  WIDTH: 600,
  HEIGHT: 500,
  MIN_WIDTH: 400,
  MAX_WIDTH: 800,
  MIN_HEIGHT: 300,
  MAX_HEIGHT: 600
};

const PANEL_ID = 'guilds-panel';

// Timeout constants (matching VIP List)
const TIMEOUTS = {
  IMMEDIATE: 0,
  SHORT: 10,
  MEDIUM: 50,
  NORMAL: 100,
  LONG: 200,
  LONGER: 300,
  INITIAL_CHECK: 500,
  PLACEHOLDER_RESET: 3000
};

// =======================
// Translation Helpers
// =======================

// Use shared translation system via API
const t = (key) => {
  if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
    return api.i18n.t(key);
  }
  return key;
};

const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
    text = text.replace(regex, value);
  });
  return text;
};

// =======================
// Firebase API Functions
// =======================

const getApiUrl = (endpoint) => {
  return `${GUILD_CONFIG.firebaseUrl}/guilds/${endpoint}`;
};

const getGuildsApiUrl = () => getApiUrl('list');
const getGuildMembersApiUrl = (guildId) => getApiUrl(`members/${guildId}`);
const getGuildChatApiUrl = (guildId) => getApiUrl(`chat/${guildId}`);
const getGuildInvitesApiUrl = (guildId) => getApiUrl(`invites/${guildId}`);
const getPlayerGuildApiUrl = () => getApiUrl('players');
const getGuildCoinsApiUrl = () => getApiUrl('coins');

// =======================
// Utility Functions
// =======================

// Sanitize username for Firebase key (Firebase keys cannot start with . or $)
const sanitizeFirebaseKey = (username) => {
  if (!username) return '';
  let sanitized = username.toLowerCase();
  // Replace leading dot with _dot_
  if (sanitized.startsWith('.')) {
    sanitized = '_dot_' + sanitized.substring(1);
  }
  // Replace leading $ with _dollar_
  if (sanitized.startsWith('$')) {
    sanitized = '_dollar_' + sanitized.substring(1);
  }
  // Replace other invalid characters for Firebase keys
  sanitized = sanitized.replace(/[\/\[\]#]/g, '_');
  return sanitized;
};

function getCurrentPlayerName() {
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) {
      return playerState.name;
    }
    // Fallback methods
    if (window.gameState && window.gameState.player && window.gameState.player.name) {
      return window.gameState.player.name;
    }
    if (window.api && window.api.gameState && window.api.gameState.getPlayerName) {
      return window.api.gameState.getPlayerName();
    }
  } catch (error) {
    console.error('[Guilds] Error getting current player name:', error);
  }
  return null;
}

async function hashUsername(username) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(username.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
  } catch (error) {
    // crypto.subtle should always be available in modern browsers
    // This fallback is only for edge cases (very old browsers, non-browser environments)
    console.warn('[Guilds] Username hashing failed, using fallback (this should not happen in modern browsers):', error);
    // Fallback: sanitize username (not cryptographically secure, but better than nothing)
    return username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }
}

async function hashGuildId(guildName) {
  return await hashUsername(guildName);
}

// =======================
// Generic Cache Utility
// =======================

// Generic TTL cache implementation that can be reused for different data types
function createTTLCache(defaultTTL = 10 * 60 * 1000) {
  const cache = new Map();
  
  return {
    get(key, customTTL = null) {
      if (!key) return null;
      const normalizedKey = typeof key === 'string' ? key.toLowerCase() : key;
      const cached = cache.get(normalizedKey);
      if (!cached) return null;
      
      const ttl = customTTL !== null ? customTTL : defaultTTL;
      const now = Date.now();
      if (now - cached.timestamp < ttl) {
        return cached.value;
      }
      
      // Cache expired, remove it
      cache.delete(normalizedKey);
      return null;
    },
    
    set(key, value, customTTL = null) {
      if (key === null || key === undefined) return;
      const normalizedKey = typeof key === 'string' ? key.toLowerCase() : key;
      cache.set(normalizedKey, {
        value,
        timestamp: Date.now(),
        ttl: customTTL !== null ? customTTL : defaultTTL
      });
    },
    
    has(key) {
      if (!key) return false;
      const normalizedKey = typeof key === 'string' ? key.toLowerCase() : key;
      if (!cache.has(normalizedKey)) return false;
      
      const cached = cache.get(normalizedKey);
      const now = Date.now();
      if (now - cached.timestamp < cached.ttl) {
        return true;
      }
      
      // Cache expired, remove it
      cache.delete(normalizedKey);
      return false;
    },
    
    delete(key) {
      if (!key) return false;
      const normalizedKey = typeof key === 'string' ? key.toLowerCase() : key;
      return cache.delete(normalizedKey);
    },
    
    clear() {
      cache.clear();
    },
    
    size() {
      return cache.size;
    },
    
    // Clean up expired entries (useful for periodic cleanup)
    cleanup() {
      const now = Date.now();
      for (const [key, cached] of cache.entries()) {
        if (now - cached.timestamp >= cached.ttl) {
          cache.delete(key);
        }
      }
    }
  };
}

// Cache for player existence checks (10 minutes TTL)
const playerExistsCache = createTTLCache(10 * 60 * 1000);

// Shared helper for Bestiary Arena profile API URL
function buildProfileApiUrl(playerName) {
  return `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
}

// Check if a player exists by fetching their profile data (with caching)
async function playerExists(playerName) {
  if (!playerName || typeof playerName !== 'string') {
    return false;
  }
  
  // Check cache first
  const cached = playerExistsCache.get(playerName);
  if (cached !== null) {
    return cached;
  }
  
  try {
    const apiUrl = buildProfileApiUrl(playerName);
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const exists = false;
      playerExistsCache.set(playerName, exists);
      return exists;
    }
    
    const data = await response.json();
    
    // Check if player data exists
    let exists = false;
    
    if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
      const profileData = data[0].result.data.json;
      // Check if the result contains an error (player doesn't exist)
      exists = !data[0]?.result?.error && profileData && (typeof profileData !== 'object' || profileData.name);
    } else {
      const profileData = data;
      // Check if data is null or doesn't have a name (player doesn't exist)
      exists = profileData && (typeof profileData !== 'object' || profileData.name);
    }
    
    // Cache the result
    playerExistsCache.set(playerName, exists);
    return exists;
  } catch (error) {
    // Network or parsing errors - don't cache false, let it retry next time
    // Only log unexpected errors (not network timeouts which are common)
    if (!error.message || (!error.message.includes('fetch') && !error.message.includes('network'))) {
      console.error('[Guilds] Error checking if player exists:', error);
    }
    return false; // Return false but don't cache it
  }
}

// Player profile cache (1 hour TTL)
const playerProfileCache = createTTLCache(60 * 60 * 1000);

// Guild points cache (5 minutes TTL)
const guildPointsCache = createTTLCache(5 * 60 * 1000);

// Format number with compact notation (k, M)
function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  if (num < 1000) return num.toString();
  if (num < 1000000) {
    const k = num / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  const m = num / 1000000;
  return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
}

// Fetch player profile data
async function fetchPlayerProfile(playerName) {
  if (!playerName || typeof playerName !== 'string') {
    return null;
  }
  
  // Check cache first
  const cached = playerProfileCache.get(playerName);
  if (cached !== null) {
    return cached;
  }
  
  try {
    const apiUrl = buildProfileApiUrl(playerName);
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      playerProfileCache.set(playerName, null);
      return null;
    }
    
    const data = await response.json();
    let profileData = null;
    
    if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
      profileData = data[0].result.data.json;
      if (data[0]?.result?.error || !profileData || (typeof profileData === 'object' && !profileData.name)) {
        profileData = null;
      }
    } else {
      profileData = data;
      if (!profileData || (typeof profileData === 'object' && !profileData.name)) {
        profileData = null;
      }
    }
    
    // Cache the result
    playerProfileCache.set(playerName, profileData);
    return profileData;
  } catch (error) {
    if (!error.message || (!error.message.includes('fetch') && !error.message.includes('network'))) {
      console.error('[Guilds] Error fetching player profile:', error);
    }
    return null;
  }
}

// Calculate level from experience
function calculateLevelFromExp(exp) {
  if (typeof exp !== 'number' || exp < 0) return 0;
  return Math.floor(exp / 400) + 1;
}

// Fetch TRPC data
async function fetchTRPC(method) {
  try {
    const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
    const res = await fetch(`/pt/api/trpc/${method}?batch=1&input=${inp}`, {
      headers: { 
        'Accept': '*/*', 
        'Content-Type': 'application/json', 
        'X-Game-Version': '1' 
      }
    });
    
    if (!res.ok) {
      throw new Error(`${method} → ${res.status}`);
    }
    
    const json = await res.json();
    return json[0].result.data.json;
  } catch (error) {
    console.error('[Guilds] Error fetching from TRPC:', error);
    throw error;
  }
}

// Check if any guild member holds a world record
async function checkGuildWorldRecords(memberUsernames) {
  try {
    const leaderboardData = await fetchTRPC('game.getRoomsHighscores');
    if (!leaderboardData || !leaderboardData.ticks) {
      return false;
    }
    
    // Create a set of member usernames for quick lookup (case-insensitive)
    const memberSet = new Set(memberUsernames.map(name => name.toLowerCase()));
    
    // Check all maps for world records
    for (const mapCode in leaderboardData.ticks) {
      const worldRecord = leaderboardData.ticks[mapCode];
      if (worldRecord && worldRecord.userName) {
        // Check if any guild member holds this world record
        if (memberSet.has(worldRecord.userName.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('[Guilds] Error checking world records:', error);
    return false;
  }
}

// Check if a specific member holds a world record
async function checkMemberWorldRecord(username) {
  try {
    const leaderboardData = await fetchTRPC('game.getRoomsHighscores');
    if (!leaderboardData || !leaderboardData.ticks) {
      return false;
    }
    
    const usernameLower = username.toLowerCase();
    
    // Check all maps for world records
    for (const mapCode in leaderboardData.ticks) {
      const worldRecord = leaderboardData.ticks[mapCode];
      if (worldRecord && worldRecord.userName && worldRecord.userName.toLowerCase() === usernameLower) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[Guilds] Error checking member world record:', error);
    return false;
  }
}

// Point calculation helper functions
function calculateLevelPoints(level) {
  return Math.floor(level / POINTS_CONFIG.LEVELS_PER_POINT);
}

function calculateRankPoints(rankPointsValue) {
  return Math.floor(rankPointsValue / POINTS_CONFIG.RANK_POINTS_PER_POINT);
}

function calculateTimeSumPenalty(timeSum) {
  return Math.floor(timeSum / POINTS_CONFIG.TIME_SUM_PENALTY_DIVISOR);
}

function calculateFloorPoints(floors) {
  return floors || 0;
}

// Get equipment points for a specific player
async function getPlayerEquipmentPoints(username) {
  try {
    if (!username) return 0;
    
    const normalizedName = sanitizeFirebaseKey(username);
    const path = `${GUILD_CONFIG.firebaseUrl}/player-equipment/${normalizedName}/equipment.json`;
    
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        return 0; // No equipment stored yet
      }
      return 0;
    }
    
    const equippedItems = await response.json();
    if (!equippedItems || typeof equippedItems !== 'object') {
      return 0;
    }
    
    // Calculate total guild points from equipped items (sum of tiers)
    let totalPoints = 0;
    for (const [slotType, item] of Object.entries(equippedItems)) {
      if (item && item.tier) {
        totalPoints += item.tier;
      }
    }
    
    return totalPoints;
  } catch (error) {
    console.warn(`[Guilds] Error fetching equipment points for ${username}:`, error);
    return 0;
  }
}

// Calculate individual member points and get detailed breakdown
async function calculateMemberPoints(username) {
  try {
    const profile = await fetchPlayerProfile(username);
    if (!profile) {
      return {
        total: 0,
        levelPoints: 0,
        rankPoints: 0,
        timeSumPenalty: 0,
        equipmentPoints: 0,
        level: 0,
        exp: 0,
        rankPointsValue: 0,
        timeSum: 0,
        hasWorldRecord: false
      };
    }
    
    // Calculate level from exp
    const exp = profile.exp || 0;
    const level = calculateLevelFromExp(exp);
    const levelPoints = calculateLevelPoints(level);
    
    // Get rank points
    const rankPointsValue = profile.rankPoints || 0;
    const rankPoints = calculateRankPoints(rankPointsValue);
    
    // Get time sum (ticks)
    const timeSum = profile.ticks || 0;
    const timeSumPenalty = calculateTimeSumPenalty(timeSum);
    
    // Get equipment points
    const equipmentPoints = await getPlayerEquipmentPoints(username);
    
    // Get floors
    const floors = profile.floors || 0;
    const floorPoints = calculateFloorPoints(floors);
    
    // Check if member holds a world record (individual check, but bonus is guild-wide)
    const hasWorldRecord = await checkMemberWorldRecord(username);
    
    // Individual member points (without world record bonus, as that's guild-wide)
    const total = levelPoints + rankPoints - timeSumPenalty + equipmentPoints + floorPoints;
    
    return {
      total: Math.max(0, Math.floor(total)),
      levelPoints,
      rankPoints,
      timeSumPenalty,
      equipmentPoints,
      floorPoints,
      level,
      exp,
      rankPointsValue,
      timeSum,
      floors,
      hasWorldRecord
    };
  } catch (error) {
    console.error('[Guilds] Error calculating member points:', error);
    return {
      total: 0,
      levelPoints: 0,
      rankPoints: 0,
      timeSumPenalty: 0,
      equipmentPoints: 0,
      floorPoints: 0,
      level: 0,
      exp: 0,
      rankPointsValue: 0,
      timeSum: 0,
      floors: 0,
      hasWorldRecord: false
    };
  }
}

// Calculate guild points based on member data
async function calculateGuildPoints(guildId) {
  try {
    // Check cache first
    const cached = guildPointsCache.get(guildId);
    if (cached !== null) {
      return cached;
    }
    
    const members = await getGuildMembers(guildId);
    if (!members || members.length === 0) {
      const points = 0;
      guildPointsCache.set(guildId, points);
      return points;
    }
    
    let totalLevels = 0;
    let totalRankPoints = 0;
    let totalTimeSum = 0;
    let totalEquipmentPoints = 0;
    let totalFloors = 0;
    
    // Fetch profile data for all members (with rate limiting consideration)
    const profilePromises = members.map(member => fetchPlayerProfile(member.username));
    const profiles = await Promise.all(profilePromises);
    
    // Fetch equipment points for all members
    const equipmentPromises = members.map(member => getPlayerEquipmentPoints(member.username));
    const equipmentPointsArray = await Promise.all(equipmentPromises);
    
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      if (!profile) continue;
      
      // Calculate level from exp
      const exp = profile.exp || 0;
      const level = calculateLevelFromExp(exp);
      totalLevels += level;
      
      // Get rank points
      const rankPoints = profile.rankPoints || 0;
      totalRankPoints += rankPoints;
      
      // Get time sum (ticks)
      const timeSum = profile.ticks || 0;
      totalTimeSum += timeSum;
      
      // Add equipment points
      totalEquipmentPoints += equipmentPointsArray[i] || 0;
      
      // Get floors
      const floors = profile.floors || 0;
      totalFloors += floors;
    }
    
    // Calculate points using helper functions
    const levelPoints = calculateLevelPoints(totalLevels);
    const rankPoints = calculateRankPoints(totalRankPoints);
    const timeSumPenalty = calculateTimeSumPenalty(totalTimeSum);
    const floorPoints = calculateFloorPoints(totalFloors);
    
    // Check if any member holds a world record
    const memberUsernames = members.map(m => m.username).filter(Boolean);
    const hasWorldRecord = memberUsernames.length > 0 ? await checkGuildWorldRecords(memberUsernames) : false;
    const worldRecordBonus = hasWorldRecord ? POINTS_CONFIG.WORLD_RECORD_BONUS : 0;
    
    const totalPoints = levelPoints + rankPoints - timeSumPenalty + totalEquipmentPoints + floorPoints + worldRecordBonus;
    
    // Ensure points are never negative - minimum is 0
    const points = Math.max(0, Math.floor(totalPoints));
    
    // Cache the result
    guildPointsCache.set(guildId, points);
    return points;
  } catch (error) {
    console.error('[Guilds] Error calculating guild points:', error);
    return 0;
  }
}

// =======================
// Helper Functions
// =======================

// Firebase response handler with consistent error handling
async function handleFirebaseResponse(response, errorContext, defaultReturn = null) {
  if (!response.ok) {
    if (response.status === 404) {
      return Array.isArray(defaultReturn) ? [] : null;
    }
    if (response.status === 401) {
      // Firebase security rules prevent read access - fail gracefully
      if (errorContext === 'getAllGuilds' && !firebase401WarningShown) {
        console.warn('[Guilds] Firebase security rules are blocking guild access (401). To enable full guild functionality, configure Firebase security rules. Guild creation and joining will still work.');
        firebase401WarningShown = true;
      }
      return Array.isArray(defaultReturn) ? [] : null;
    }
    throw new Error(`Failed to ${errorContext}: ${response.status}`);
  }
  return await response.json();
}

// Common Firebase request helper
async function firebaseRequest(endpoint, method, data = null, errorContext, defaultReturn = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (data !== null) {
    options.body = JSON.stringify(data);
  }
  const response = await fetch(`${endpoint}.json`, options);
  return await handleFirebaseResponse(response, errorContext, defaultReturn);
}

// Validate current player and get player name
function validateCurrentPlayer() {
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) {
    throw new Error('Could not get current player name');
  }
  return currentPlayer;
}

// Check if player is in a guild (checks both Firebase and localStorage)
// Returns { isInGuild: boolean, guildId: string|null, guildData: object|null }
async function checkPlayerGuildMembership(expectedGuildId = null) {
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return { isInGuild: false, guildId: null, guildData: null };
    }

    const hashedPlayer = await hashUsername(currentPlayer);
    const playerGuildResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
    
    if (playerGuildResponse.ok) {
      const playerGuildCheck = await playerGuildResponse.json();
      if (playerGuildCheck && playerGuildCheck.guildId) {
        if (expectedGuildId === null || playerGuildCheck.guildId === expectedGuildId) {
          return { 
            isInGuild: true, 
            guildId: playerGuildCheck.guildId, 
            guildData: playerGuildCheck 
          };
        }
      }
    }

    // Also check localStorage as fallback
    const localGuild = getPlayerGuild();
    if (localGuild && localGuild.id) {
      if (expectedGuildId === null || localGuild.id === expectedGuildId) {
        return { 
          isInGuild: true, 
          guildId: localGuild.id, 
          guildData: localGuild 
        };
      }
    }

    return { isInGuild: false, guildId: null, guildData: null };
  } catch (error) {
    console.error('[Guilds] Error checking player guild membership:', error);
    return { isInGuild: false, guildId: null, guildData: null };
  }
}

// Find member in members array by username (case-insensitive)
function findMemberByUsername(members, username) {
  if (!members || !Array.isArray(members) || !username) {
    return null;
  }
  return members.find(m => m.username && m.username.toLowerCase() === username.toLowerCase());
}

// Check if current player is the guild leader
function isGuildLeader(guild, currentPlayer) {
  if (!guild || !currentPlayer || !guild.leader) {
    return false;
  }
  return guild.leader.toLowerCase() === currentPlayer.toLowerCase();
}

// Create ESC key handler factory for modals/dialogs
function createEscKeyHandler(onClose) {
  return function handleEsc(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      onClose();
    }
  };
}

// Setup ESC key handler with automatic cleanup when dialog closes
function setupEscKeyHandler(dialog, onClose) {
  let isHandling = false;
  const handleEsc = function(e) {
    // Ignore if already handling (prevents double-triggering)
    if (isHandling) return;
    // Only handle real user key presses, not programmatic events
    if (e.isTrusted && (e.key === 'Escape' || e.keyCode === 27)) {
      // Check if dialog still exists
      if (!document.contains(dialog)) {
        document.removeEventListener('keydown', handleEsc);
        return;
      }
      isHandling = true;
      onClose();
      // Reset after a short delay
      setTimeout(() => { isHandling = false; }, 100);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  // Clean up when dialog is removed
  const observer = new MutationObserver(() => {
    if (!document.contains(dialog)) {
      document.removeEventListener('keydown', handleEsc);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  return handleEsc;
}

// Validate guild exists and throw error if not
function validateGuildExists(guild, guildId = null) {
  if (!guild) {
    throw new Error(t('mods.guilds.guildNotFound'));
  }
  return guild;
}

// Validate member exists in members array
function validateMemberExists(member, username = null) {
  if (!member) {
    throw new Error('Member not found');
  }
  return member;
}

// Common validation helper for guild operations
async function validateGuildOperation(guildId, requireLeader = false, requirePermission = null) {
  const currentPlayer = validateCurrentPlayer();
  const guild = validateGuildExists(await getGuild(guildId));
  
  if (requireLeader && !isGuildLeader(guild, currentPlayer)) {
    throw new Error('Only the guild leader can perform this action');
  }
  
  if (requirePermission) {
    const members = await getGuildMembers(guildId);
    const currentMember = findMemberByUsername(members, currentPlayer);
    if (!currentMember) {
      throw new Error('You are not a member of this guild');
    }
    if (!hasPermission(currentMember.role, requirePermission)) {
      throw new Error(`You do not have permission to ${requirePermission}`);
    }
    return { currentPlayer, guild, members, currentMember };
  }
  
  return { currentPlayer, guild };
}

// Update player's guild reference in Firebase
async function updatePlayerGuildReference(hashedPlayer, guildId, guildName) {
  const url = `${getPlayerGuildApiUrl()}/${hashedPlayer}.json`;
  try {
    if (guildId) {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, guildName })
      });
      if (!response.ok) {
        console.error('[Guilds] Failed to update player guild reference:', response.status, response.statusText);
        return false;
      }
      console.log('[Guilds] Successfully updated player guild reference:', { hashedPlayer, guildId, guildName });
      return true;
    } else {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        console.error('[Guilds] Failed to remove player guild reference:', response.status, response.statusText);
        return false;
      }
      console.log('[Guilds] Successfully removed player guild reference:', hashedPlayer);
      return true;
    }
  } catch (error) {
    console.error('[Guilds] Error updating player guild reference:', error);
    return false;
  }
}

// Update guild member count
async function updateGuildMemberCount(guildId) {
  const members = await getGuildMembers(guildId);
  await firebaseRequest(`${getGuildsApiUrl()}/${guildId}`, 'PATCH', { memberCount: members.length }, 'update member count');
}

// Button style constants
const BUTTON_STYLES = {
  PRIMARY: 'background: rgba(76, 175, 80, 0.3); border-color: rgba(76, 175, 80, 0.5);',
  DANGER: 'background: rgba(255, 107, 107, 0.3); border-color: rgba(255, 107, 107, 0.5);',
  WARNING: 'background: rgba(255, 193, 7, 0.3); border-color: rgba(255, 193, 7, 0.5);',
  DISABLED: 'background: rgba(128, 128, 128, 0.3); border-color: rgba(128, 128, 128, 0.5); opacity: 0.6;'
};

// Font helper functions
function getFontFamily() {
  return CSS_CONSTANTS.FONT_FAMILY_SYSTEM;
}

function getFontSize(size = 'BASE') {
  return CSS_CONSTANTS.FONT_SIZES[size] || CSS_CONSTANTS.FONT_SIZES.BASE;
}

// Create styled input or textarea element
function createStyledInput({ type = 'text', placeholder = '', maxLength, className = 'pixel-font-14', style = {} }) {
  const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (type !== 'textarea') input.type = type;
  if (maxLength) input.maxLength = maxLength;
  input.placeholder = placeholder;
  input.className = className;
  
  const baseStyle = `
    width: 100%;
    padding: ${type === 'textarea' ? '8px' : '2px 8px'};
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border-width: 4px;
    border-style: solid;
    border-color: transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: ${type === 'textarea' ? getFontSize('BASE') : getFontSize('LG')};
    font-family: ${getFontFamily()};
    ${type === 'textarea' ? 'resize: none; flex: 1; min-height: 80px;' : 'max-height: 21px; height: 21px; line-height: normal;'}
    box-sizing: border-box;
  `;
  
  const customStyle = Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ');
  input.style.cssText = baseStyle + (customStyle ? ` ${customStyle}` : '');
  
  return input;
}

// Create styled select element
function createStyledSelect({ className = 'pixel-font-14', style = {} } = {}) {
  const select = document.createElement('select');
  select.className = className;
  
  const baseStyle = `
    width: 100%;
    padding: 4px 8px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border-width: 4px;
    border-style: solid;
    border-color: transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: ${getFontSize('LG')};
    font-family: ${getFontFamily()};
    min-height: 35px;
    height: auto;
    line-height: 1.4;
    box-sizing: border-box;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  `;
  
  const customStyle = Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ');
  select.style.cssText = baseStyle + (customStyle ? ` ${customStyle}` : '');
  
  // Ensure global style for select options is added
  if (!document.getElementById('guild-select-options-style')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'guild-select-options-style';
    styleElement.textContent = `
      select option {
        background: #1a1a1a !important;
        color: rgb(255, 255, 255) !important;
      }
      select option:checked {
        background: #1a1a1a !important;
        color: rgb(255, 255, 255) !important;
      }
      select:focus option:checked {
        background: rgba(100, 181, 246, 0.3) !important;
        color: rgb(255, 255, 255) !important;
      }
      select option:hover {
        background: rgba(100, 181, 246, 0.2) !important;
        color: rgb(255, 255, 255) !important;
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  return select;
}

// Create styled option element
function createStyledOption({ value, text, selected = false }) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  option.selected = selected;
  option.style.cssText = `background: #1a1a1a; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};`;
  return option;
}

// Create form field with label
function createFormField(labelText, inputElement) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column;';
  
  const label = document.createElement('label');
  label.textContent = labelText;
  label.style.cssText = `display: block; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: ${getFontSize('LG')}; font-family: ${getFontFamily()}; margin-bottom: 4px;`;
  
  container.appendChild(label);
  container.appendChild(inputElement);
  return container;
}

// Show warning modal
function showWarningModal(title, message, width = 450) {
  const warningContent = document.createElement('div');
  warningContent.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 14px;
    padding: 8px;
    text-align: center;
  `;
  warningContent.textContent = message;
  
  createStyledModal({
    title,
    width,
    content: warningContent,
    buttons: [{ text: 'OK', primary: true, onClick: () => {} }]
  });
}

// Show confirmation modal
function showConfirmModal(title, message, onConfirm, width = 450) {
  const confirmContent = document.createElement('div');
  confirmContent.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 14px;
    padding: 8px;
    text-align: center;
  `;
  confirmContent.textContent = message;
  
  createStyledModal({
    title,
    width,
    content: confirmContent,
    buttons: [
      createCloseDialogButton(t('mods.guilds.cancel'), false),
      createCloseDialogButton('OK', true, onConfirm)
    ]
  });
}

// =======================
// Guild Chat Encryption
// =======================

// Derive an encryption key from guild ID (deterministic - all members use same key)
async function deriveGuildChatKey(guildId) {
  try {
    const encoder = new TextEncoder();
    const password = encoder.encode(guildId);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      password,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = encoder.encode('guild-chat-salt');
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return key;
  } catch (error) {
    console.error('[Guilds] Error deriving guild chat key:', error);
    throw error;
  }
}

// Encrypt guild chat message
async function encryptGuildMessage(text, guildId) {
  try {
    const key = await deriveGuildChatKey(guildId);
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Guilds] Error encrypting message:', error);
    throw error;
  }
}

// Decrypt guild chat message
async function decryptGuildMessage(encryptedText, guildId) {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return encryptedText;
    }
    
    let combined;
    try {
      combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    } catch (e) {
      return encryptedText;
    }
    
    if (combined.length < 13) {
      return encryptedText;
    }
    
    const key = await deriveGuildChatKey(guildId);
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    if (!error.message.includes('invalid') && !error.message.includes('String contains')) {
      console.warn('[Guilds] Decryption error (message may be unencrypted):', error.message);
    }
    return encryptedText;
  }
}

// =======================
// Guild Coins System
// =======================

// Derive an encryption key from player username (only player can decrypt their own coins)
async function deriveGuildCoinsKey(username) {
  try {
    const encoder = new TextEncoder();
    const password = encoder.encode(username.toLowerCase());
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      password,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const salt = encoder.encode('guild-coins-salt');
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return key;
  } catch (error) {
    console.error('[Guilds] Error deriving guild coins key:', error);
    throw error;
  }
}

// Encrypt coin count
async function encryptCoinCount(count, username) {
  try {
    const key = await deriveGuildCoinsKey(username);
    const encoder = new TextEncoder();
    const data = encoder.encode(count.toString());
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Guilds] Error encrypting coin count:', error);
    throw error;
  }
}

// Decrypt coin count
async function decryptCoinCount(encryptedText, username) {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return 0;
    }
    
    let combined;
    try {
      combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    } catch (e) {
      return 0;
    }
    
    if (combined.length < 13) {
      return 0;
    }
    
    const key = await deriveGuildCoinsKey(username);
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const countStr = decoder.decode(decrypted);
    const count = parseInt(countStr, 10);
    return isNaN(count) ? 0 : count;
  } catch (error) {
    console.warn('[Guilds] Error decrypting coin count:', error);
    return 0;
  }
}

// Get player's guild coins from Firebase
async function getGuildCoins() {
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return 0;
    }
    
    const hashedPlayer = await hashUsername(currentPlayer);
    const response = await fetch(`${getGuildCoinsApiUrl()}/${hashedPlayer}.json`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return 0;
      }
      throw new Error(`Failed to fetch coins: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || !data.encrypted) {
      return 0;
    }
    
    return await decryptCoinCount(data.encrypted, currentPlayer);
  } catch (error) {
    console.error('[Guilds] Error getting guild coins:', error);
    return 0;
  }
}

// Add guild coins and save to Firebase
async function addGuildCoins(amount) {
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      throw new Error('Player name not available');
    }
    
    if (amount <= 0) {
      return;
    }
    
    const currentCoins = await getGuildCoins();
    const newCoins = currentCoins + amount;
    const encrypted = await encryptCoinCount(newCoins, currentPlayer);
    const hashedPlayer = await hashUsername(currentPlayer);
    
    console.log('[Guilds][Coins] Saving coins to Firebase', { hashedPlayer, amount, newCoins });
    await firebaseRequest(
      `${getGuildCoinsApiUrl()}/${hashedPlayer}`,
      'PUT',
      { encrypted },
      'save guild coins'
    );
    
    console.log(`[Guilds][Coins] Added ${amount} guild coins. New total: ${newCoins}`);
    return newCoins;
  } catch (error) {
    console.error('[Guilds][Coins] Error adding guild coins:', error);
    throw error;
  }
}

// Show toast notification when coins drop (similar to Raid_Hunter.js)
// =======================
// Deterministic Drop Calculation
// =======================

// Deterministic random function using seed (produces consistent results)
// This makes drops verifiable and prevents manipulation
function deterministicRandom(seed, additionalValue = 0) {
  // Combine seed with additional value for uniqueness
  const combined = seed + additionalValue;
  
  // Simple hash function to create pseudo-random value
  let hash = 0;
  const str = combined.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Normalize to 0-1 range
  return Math.abs(hash) % 10000 / 10000;
}

function showGuildCoinNotification(amount) {
  try {
    // Get or create the main toast container
    let mainContainer = document.getElementById('guild-coins-toast-container');
    if (!mainContainer) {
      mainContainer = document.createElement('div');
      mainContainer.id = 'guild-coins-toast-container';
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
    
    // Add guild coin icon
    const iconImg = document.createElement('img');
    iconImg.alt = 'Guild Coin';
    iconImg.src = getGuildAssetUrl('Guild_Coin.PNG');
    iconImg.className = 'pixelated';
    iconImg.style.cssText = 'width: 16px; height: 16px;';
    widgetBottom.appendChild(iconImg);
    
    // Add message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.textContent = `Guild Coin obtained! (+${amount})`;
    widgetBottom.appendChild(messageDiv);
    
    // Assemble toast
    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    mainContainer.appendChild(flexContainer);
    
    console.log(`[Guilds] Toast shown: Guild Coin obtained! (+${amount})`);
    
    // Auto-remove after 3 seconds
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
    }, 3000);
    
  } catch (error) {
    console.error('[Guilds] Error showing coin toast:', error);
  }
}

// Board subscription for coin drops
let guildCoinsBoardSubscription = null;
let lastProcessedSeed = null;

function setupGuildCoinsDropSystem() {
  if (guildCoinsBoardSubscription) {
    return; // Already set up
  }
  
  if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.subscribe) {
    console.log('[Guilds] Setting up guild coins drop system...');
    guildCoinsBoardSubscription = globalThis.state.board.subscribe(({ context }) => {
      const serverResults = context.serverResults;
      if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
        return;
      }
      
      // Only drop on victories
      if (!serverResults.rewardScreen.victory) {
        return;
      }
      
      const seed = serverResults.seed;
      
      // Skip duplicate seeds
      if (seed === lastProcessedSeed) {
        return;
      }
      
      lastProcessedSeed = seed;
      
      // Roll 10% drop chance using deterministic calculation
      const dropChance = 0.10;
      const roll = deterministicRandom(seed, 0);
      console.log('[Guilds][Coins] Victory detected, seed:', seed, 'roll:', roll.toFixed(4), 'chance:', dropChance);
      if (roll <= dropChance) {
        addGuildCoins(1).then((newTotal) => {
          showGuildCoinNotification(1);
          // Update display if guild panel is open
          updateGuildCoinsDisplay();
          console.log('[Guilds][Coins] Drop awarded. Total coins:', newTotal);
        }).catch((error) => {
          console.error('[Guilds][Coins] Error adding guild coin:', error);
        });
      } else {
        console.log('[Guilds][Coins] No drop this victory (roll >= 0.10)');
      }
    });
  }
}

// Update coin display in footer
let guildCoinsDisplayElement = null;

async function updateGuildCoinsDisplay() {
  try {
    if (!guildCoinsDisplayElement) {
      return;
    }
    
    const coins = await getGuildCoins();
    guildCoinsDisplayElement.textContent = coins.toLocaleString();
  } catch (error) {
    console.error('[Guilds] Error updating coin display:', error);
  }
}

// Setup guild coins display in modal footer (reusable function)
async function setupGuildCoinsInFooter(buttonContainer) {
  // Check if coins display already exists in this container
  if (buttonContainer.querySelector('.guild-coins-display')) {
    return;
  }
  
  // Add coin display first (matching Better Forge dust display style)
  const coinsDisplay = document.createElement('div');
  coinsDisplay.className = 'pixel-font-16 frame-pressed-1 surface-darker flex items-center justify-end gap-1 px-1.5 pb-px text-right text-whiteRegular mr-auto guild-coins-display';
  
  const coinIcon = document.createElement('img');
  coinIcon.src = getGuildAssetUrl('Guild_Coin.PNG');
  coinIcon.alt = 'Guild Coins';
  coinIcon.style.cssText = 'width: 16px; height: 16px;';
  
  const coinAmount = document.createElement('span');
  coinAmount.className = 'guild-coins-amount';
  coinAmount.textContent = '0';
  
  // Set as main display element for update function
  guildCoinsDisplayElement = coinAmount;
  
  coinsDisplay.appendChild(coinIcon);
  coinsDisplay.appendChild(coinAmount);
  
  // Load and display current coin count
  const coins = await getGuildCoins();
  coinAmount.textContent = coins.toLocaleString();
  
  // Insert coins display first (left side)
  buttonContainer.insertBefore(coinsDisplay, buttonContainer.firstChild);
}

// =======================
// Guild Data Management
// =======================

function getPlayerGuild() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GUILD_DATA);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('[Guilds] Error loading player guild:', error);
    return null;
  }
}

function savePlayerGuild(guildData) {
  try {
    localStorage.setItem(STORAGE_KEYS.GUILD_DATA, JSON.stringify(guildData));
  } catch (error) {
    console.error('[Guilds] Error saving player guild:', error);
  }
}

function clearPlayerGuild() {
  try {
    localStorage.removeItem(STORAGE_KEYS.GUILD_DATA);
  } catch (error) {
    console.error('[Guilds] Error clearing player guild:', error);
  }
}

// =======================
// Firebase Operations
// =======================

async function createGuild(guildName, description = '', abbreviation = '', joinType = GUILD_JOIN_TYPES.OPEN) {
  try {
    const currentPlayer = validateCurrentPlayer();

    // Check if player is already in a guild
    const membershipCheck = await checkPlayerGuildMembership();
    if (membershipCheck.isInGuild) {
      throw new Error('You are already a member of a guild. Leave your current guild before creating a new one.');
    }

    const hashedPlayer = await hashUsername(currentPlayer);

    if (!guildName || guildName.trim().length === 0) {
      throw new Error('Guild name is required');
    }

    if (guildName.length > GUILD_CONFIG.maxGuildNameLength) {
      throw new Error(`Guild name must be ${GUILD_CONFIG.maxGuildNameLength} characters or less`);
    }

    if (!abbreviation || abbreviation.length < 3 || abbreviation.length > 6) {
      throw new Error('Abbreviation must be between 3 and 6 letters');
    }

    if (!/^[A-Z]{3,6}$/.test(abbreviation)) {
      throw new Error('Abbreviation must contain only letters');
    }

    if (description.length > GUILD_CONFIG.maxGuildDescriptionLength) {
      throw new Error(`Description must be ${GUILD_CONFIG.maxGuildDescriptionLength} characters or less`);
    }

    const guildId = await hashGuildId(guildName.trim());
    const timestamp = Date.now();

    const guildData = {
      id: guildId,
      name: guildName.trim(),
      abbreviation: abbreviation.toUpperCase(),
      description: description.trim(),
      leader: currentPlayer,
      leaderHashed: hashedPlayer,
      createdAt: timestamp,
      memberCount: 1,
      joinType: joinType || GUILD_JOIN_TYPES.OPEN
    };

    // Create guild in Firebase
    await firebaseRequest(`${getGuildsApiUrl()}/${guildId}`, 'PUT', guildData, 'create guild');

    // Add leader as member
    const memberData = {
      username: currentPlayer,
      usernameHashed: hashedPlayer,
      role: GUILD_ROLES.LEADER,
      joinedAt: timestamp
    };

    const memberResponse = await fetch(`${getGuildMembersApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData)
    });

    if (!memberResponse.ok) {
      throw new Error(`Failed to add leader as member: ${memberResponse.status}`);
    }

    // Update player's guild reference
    await updatePlayerGuildReference(hashedPlayer, guildId, guildName.trim());

    // Save locally
    savePlayerGuild(guildData);

    // Sync guild chat tab if VIP List mod is loaded
    if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
      window.syncGuildChatTab();
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `Guild "${guildName.trim()}" was created by ${currentPlayer}`);

    return guildData;
  } catch (error) {
    console.error('[Guilds] Error creating guild:', error);
    throw error;
  }
}

async function getGuild(guildId) {
  try {
    const response = await fetch(`${getGuildsApiUrl()}/${guildId}.json`);
    return await handleFirebaseResponse(response, 'get guild', null);
  } catch (error) {
    console.error('[Guilds] Error getting guild:', error);
    return null;
  }
}

async function getAllGuilds() {
  try {
    const response = await fetch(`${getGuildsApiUrl()}.json`);
    const data = await handleFirebaseResponse(response, 'getAllGuilds', []);
    if (!data || typeof data !== 'object') {
      return [];
    }
    return Object.values(data).sort((a, b) => {
      // Sort by member count (descending), then by name
      if (b.memberCount !== a.memberCount) {
        return (b.memberCount || 0) - (a.memberCount || 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  } catch (error) {
    console.error('[Guilds] Error getting all guilds:', error);
    return [];
  }
}

async function getGuildMembers(guildId) {
  try {
    const response = await fetch(`${getGuildMembersApiUrl(guildId)}.json`);
    const data = await handleFirebaseResponse(response, 'get members', []);
    if (!data || typeof data !== 'object') {
      return [];
    }
    return Object.values(data);
  } catch (error) {
    console.error('[Guilds] Error getting guild members:', error);
    return [];
  }
}

async function joinGuild(guildId) {
  try {
    const currentPlayer = validateCurrentPlayer();

    // Check if player is already in a guild
    const membershipCheck = await checkPlayerGuildMembership(guildId);
    if (membershipCheck.isInGuild && membershipCheck.guildId !== guildId) {
      throw new Error(t('mods.guilds.alreadyInAnotherGuild'));
    }

    const hashedPlayer = await hashUsername(currentPlayer);

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error(t('mods.guilds.guildNotFound'));
    }

    // Check if guild is invite-only
    const joinType = guild.joinType || GUILD_JOIN_TYPES.OPEN;
    if (joinType === GUILD_JOIN_TYPES.INVITE_ONLY) {
      throw new Error('This guild is invite-only. You need an invitation to join.');
    }

    const members = await getGuildMembers(guildId);
    if (members.length >= GUILD_CONFIG.maxMembers) {
      throw new Error('Guild is full');
    }

    const existingMember = members.find(m => m.usernameHashed === hashedPlayer);
    if (existingMember) {
      throw new Error('You are already a member of this guild');
    }

    const memberData = {
      username: currentPlayer,
      usernameHashed: hashedPlayer,
      role: GUILD_ROLES.MEMBER,
      joinedAt: Date.now()
    };

    await firebaseRequest(`${getGuildMembersApiUrl(guildId)}/${hashedPlayer}`, 'PUT', memberData, 'join guild');

    // Update member count
    await updateGuildMemberCount(guildId);

    // Update player's guild reference
    await updatePlayerGuildReference(hashedPlayer, guildId, guild.name);

    // Clean up all other pending invites (player can only be in one guild)
    const allInvites = await getPlayerInvites();
    for (const invite of allInvites) {
      if (invite.guildId !== guildId) {
        // Remove invite from player's invites
        await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${invite.guildId}.json`, {
          method: 'DELETE'
        });
        // Also remove from guild's invites tracking
        await fetch(`${getGuildInvitesApiUrl(invite.guildId)}/${hashedPlayer}.json`, {
          method: 'DELETE'
        });
      }
    }

    savePlayerGuild(guild);

    // Sync guild chat tab if VIP List mod is loaded
    if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
      window.syncGuildChatTab();
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} joined the guild`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error joining guild:', error);
    throw error;
  }
}

async function leaveGuild(guildId) {
  try {
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error(t('mods.guilds.guildNotFound'));
    }

    if (isGuildLeader(guild, currentPlayer)) {
      throw new Error('Guild leader cannot leave. Transfer leadership or delete the guild.');
    }

    const hashedPlayer = await hashUsername(currentPlayer);
    const response = await fetch(`${getGuildMembersApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to leave guild: ${response.status}`);
    }

    // Update member count
    await updateGuildMemberCount(guildId);

    // Remove player's guild reference
    await updatePlayerGuildReference(hashedPlayer, null, null);

    clearPlayerGuild();

    // Sync guild chat tab (will remove it since player has no guild) if VIP List mod is loaded
    if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
      window.syncGuildChatTab();
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} left the guild`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error leaving guild:', error);
    throw error;
  }
}

// Update guild join type
async function updateGuildJoinType(guildId, newJoinType) {
  try {
    const { currentPlayer, guild } = await validateGuildOperation(guildId, true);

    if (newJoinType !== GUILD_JOIN_TYPES.OPEN && newJoinType !== GUILD_JOIN_TYPES.INVITE_ONLY) {
      throw new Error('Invalid join type');
    }

    await firebaseRequest(`${getGuildsApiUrl()}/${guildId}`, 'PATCH', { joinType: newJoinType }, 'update join type');

    // Update local storage
    const playerGuild = getPlayerGuild();
    if (playerGuild && playerGuild.id === guildId) {
      playerGuild.joinType = newJoinType;
      savePlayerGuild(playerGuild);
    }

    // Post system message
    const joinTypeText = newJoinType === GUILD_JOIN_TYPES.OPEN ? 'open' : 'invite-only';
    await sendGuildSystemMessage(guildId, `${currentPlayer} changed the guild join type to ${joinTypeText}`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error updating join type:', error);
    throw error;
  }
}

// Update guild description
async function updateGuildDescription(guildId, newDescription) {
  try {
    const { currentPlayer, guild } = await validateGuildOperation(guildId, true);

    if (newDescription.length > GUILD_CONFIG.maxGuildDescriptionLength) {
      throw new Error(`Description must be ${GUILD_CONFIG.maxGuildDescriptionLength} characters or less`);
    }

    await firebaseRequest(`${getGuildsApiUrl()}/${guildId}`, 'PATCH', { description: newDescription.trim() }, 'update description');

    // Update local storage
    const playerGuild = getPlayerGuild();
    if (playerGuild && playerGuild.id === guildId) {
      playerGuild.description = newDescription.trim();
      savePlayerGuild(playerGuild);
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} updated the guild description`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error updating description:', error);
    throw error;
  }
}

// Transfer leadership to another member
async function transferLeadership(guildId, newLeaderUsername) {
  try {
    const { currentPlayer, guild, members } = await validateGuildOperation(guildId, true);
    const newLeader = validateMemberExists(findMemberByUsername(members, newLeaderUsername));

    if (newLeader.username.toLowerCase() === currentPlayer.toLowerCase()) {
      throw new Error('You are already the leader');
    }

    const newLeaderHashed = await hashUsername(newLeaderUsername);
    const currentLeaderHashed = await hashUsername(currentPlayer);

    // Update guild leader
    await firebaseRequest(`${getGuildsApiUrl()}/${guildId}`, 'PATCH', { 
      leader: newLeaderUsername,
      leaderHashed: newLeaderHashed
    }, 'transfer leadership');

    // Update member roles
    await firebaseRequest(`${getGuildMembersApiUrl(guildId)}/${currentLeaderHashed}`, 'PATCH', { role: GUILD_ROLES.MEMBER }, 'update member role');
    await firebaseRequest(`${getGuildMembersApiUrl(guildId)}/${newLeaderHashed}`, 'PATCH', { role: GUILD_ROLES.LEADER }, 'update member role');

    // Update local storage if current player is still in guild
    const playerGuild = getPlayerGuild();
    if (playerGuild && playerGuild.id === guildId) {
      playerGuild.leader = newLeaderUsername;
      savePlayerGuild(playerGuild);
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} transferred leadership to ${newLeaderUsername}`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error transferring leadership:', error);
    throw error;
  }
}

// Promote member to officer
async function promoteMember(guildId, memberUsername) {
  try {
    const { currentPlayer, members, currentMember } = await validateGuildOperation(guildId, false, 'promote');
    const targetMember = validateMemberExists(findMemberByUsername(members, memberUsername));

    if (!canPerformAction(currentMember.role, targetMember.role, 'promote')) {
      throw new Error('You do not have permission to promote this member');
    }

    if (targetMember.role !== GUILD_ROLES.MEMBER) {
      throw new Error('Can only promote members to officer');
    }

    const hashedMember = await hashUsername(memberUsername);
    await firebaseRequest(`${getGuildMembersApiUrl(guildId)}/${hashedMember}`, 'PATCH', { role: GUILD_ROLES.OFFICER }, 'promote member');

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} promoted ${memberUsername} to Officer`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error promoting member:', error);
    throw error;
  }
}

// Demote officer to member
async function demoteMember(guildId, memberUsername) {
  try {
    const { currentPlayer, members, currentMember } = await validateGuildOperation(guildId, false, 'demote');
    const targetMember = validateMemberExists(findMemberByUsername(members, memberUsername));

    if (!canPerformAction(currentMember.role, targetMember.role, 'demote')) {
      throw new Error('You do not have permission to demote this member');
    }

    if (targetMember.role !== GUILD_ROLES.OFFICER) {
      throw new Error('Can only demote officers to member');
    }

    const hashedMember = await hashUsername(memberUsername);
    await firebaseRequest(`${getGuildMembersApiUrl(guildId)}/${hashedMember}`, 'PATCH', { role: GUILD_ROLES.MEMBER }, 'demote member');

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} demoted ${memberUsername} to Member`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error demoting member:', error);
    throw error;
  }
}

async function kickMember(guildId, memberUsername) {
  try {
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error(t('mods.guilds.guildNotFound'));
    }

    const members = await getGuildMembers(guildId);
    const currentMember = findMemberByUsername(members, currentPlayer);
    const targetMember = findMemberByUsername(members, memberUsername);

    if (!currentMember) {
      throw new Error('You are not a member of this guild');
    }

    if (!targetMember) {
      throw new Error('Member not found');
    }

    if (!hasPermission(currentMember.role, 'kick')) {
      throw new Error('You do not have permission to kick members');
    }

    if (targetMember.role === GUILD_ROLES.LEADER) {
      throw new Error('Cannot kick the guild leader');
    }

    if (currentMember.role !== GUILD_ROLES.LEADER && targetMember.role === GUILD_ROLES.OFFICER) {
      throw new Error('Officers can only be kicked by the leader');
    }

    const hashedMember = await hashUsername(memberUsername);
    const response = await fetch(`${getGuildMembersApiUrl(guildId)}/${hashedMember}.json`, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to kick member: ${response.status}`);
    }

    // Update member count
    await updateGuildMemberCount(guildId);

    // Remove player's guild reference
    await updatePlayerGuildReference(hashedMember, null, null);

    // Sync guild chat tab if the kicked member is the current player and VIP List mod is loaded
    if (targetMember.username.toLowerCase() === currentPlayer.toLowerCase()) {
      clearPlayerGuild();
      if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
        window.syncGuildChatTab();
      }
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} kicked ${memberUsername} from the guild`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error kicking member:', error);
    throw error;
  }
}

// Delete guild (only when leader is the only member)
async function deleteGuild(guildId) {
  try {
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error(t('mods.guilds.guildNotFound'));
    }

    if (!isGuildLeader(guild, currentPlayer)) {
      throw new Error('Only the guild leader can delete the guild');
    }

    const members = await getGuildMembers(guildId);
    if (members.length > 1) {
      throw new Error('Cannot delete guild with multiple members. Transfer leadership or remove members first.');
    }

    if (members.length === 0 || members[0].username.toLowerCase() !== currentPlayer.toLowerCase()) {
      throw new Error('Only the leader can delete the guild when they are the only member');
    }

    // Delete guild data
    await fetch(`${getGuildsApiUrl()}/${guildId}.json`, {
      method: 'DELETE'
    });

    // Delete all members
    await fetch(`${getGuildMembersApiUrl(guildId)}.json`, {
      method: 'DELETE'
    });

    // Delete guild chat
    await fetch(`${getGuildChatApiUrl(guildId)}.json`, {
      method: 'DELETE'
    });

    // Delete guild invites
    await fetch(`${getGuildInvitesApiUrl(guildId)}.json`, {
      method: 'DELETE'
    });

    // Remove player's guild reference
    const hashedPlayer = await hashUsername(currentPlayer);
    await updatePlayerGuildReference(hashedPlayer, null, null);

    // Clear local storage
    clearPlayerGuild();

    // Sync guild chat tab (will remove it since player has no guild) if VIP List mod is loaded
    if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
      window.syncGuildChatTab();
    }

    return true;
  } catch (error) {
    console.error('[Guilds] Error deleting guild:', error);
    throw error;
  }
}

async function invitePlayer(guildId, playerName) {
  try {
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error(t('mods.guilds.guildNotFound'));
    }

    const members = await getGuildMembers(guildId);
    const currentMember = findMemberByUsername(members, currentPlayer);

    if (!currentMember) {
      throw new Error('You are not a member of this guild');
    }

    if (!hasPermission(currentMember.role, 'invite')) {
      throw new Error('You do not have permission to invite players');
    }

    if (members.length >= GUILD_CONFIG.maxMembers) {
      throw new Error('Guild is full');
    }

    // Check if player exists before inviting
    const playerExistsCheck = await playerExists(playerName);
    if (!playerExistsCheck) {
      throw new Error('Player does not exist');
    }

    const hashedPlayer = await hashUsername(playerName);
    const existingMember = members.find(m => m.usernameHashed === hashedPlayer);
    if (existingMember) {
      throw new Error('Player is already a member');
    }

    // Check if invite already exists (prevent duplicates)
    // This check prevents duplicate invites from being created
    const existingInviteResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}.json`);
    if (existingInviteResponse.ok) {
      const existingInvite = await existingInviteResponse.json();
      if (existingInvite) {
        throw new Error('Player has already been invited');
      }
    }

    const inviteData = {
      guildId,
      guildName: guild.name,
      playerName, // Store plain text player name
      invitedBy: currentPlayer,
      invitedByHashed: await hashUsername(currentPlayer),
      invitedAt: Date.now()
    };

    await firebaseRequest(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}`, 'PUT', inviteData, 'send invite');

    // Also store invite in guild's invites path for tracking (check for duplicates here too)
    const guildInviteCheck = await fetch(`${getGuildInvitesApiUrl(guildId)}/${hashedPlayer}.json`);
    if (guildInviteCheck.ok) {
      const existingGuildInvite = await guildInviteCheck.json();
      if (existingGuildInvite) {
        // Invite already exists in guild tracking, but we just created it in player path
        // This is fine - just update the guild invite with latest info
      }
    }

    const guildInviteData = {
      playerName,
      playerNameHashed: hashedPlayer,
      invitedBy: currentPlayer,
      invitedByHashed: await hashUsername(currentPlayer),
      invitedAt: Date.now()
    };
    
    await fetch(`${getGuildInvitesApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guildInviteData)
    });

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} invited ${playerName} to the guild`);

    return true;
  } catch (error) {
    // Don't log expected validation errors as errors
    if (error.message && (
      error.message.includes('already been invited') ||
      error.message.includes('already a member') ||
      error.message.includes('Guild is full') ||
      error.message.includes('does not exist')
    )) {
      throw error; // Re-throw without logging
    }
    console.error('[Guilds] Error inviting player:', error);
    throw error;
  }
}

async function acceptInvite(guildId) {
  try {
    await joinGuild(guildId);
    
    // Remove invite after accepting
    const currentPlayer = getCurrentPlayerName();
    if (currentPlayer) {
      const hashedPlayer = await hashUsername(currentPlayer);
      await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}.json`, {
        method: 'DELETE'
      });
      // Also remove from guild's invites tracking
      await fetch(`${getGuildInvitesApiUrl(guildId)}/${hashedPlayer}.json`, {
        method: 'DELETE'
      });
    }
    
    // Note: System message for joining is already posted in joinGuild()
    
    return true;
  } catch (error) {
    console.error('[Guilds] Error accepting invite:', error);
    throw error;
  }
}

async function declineInvite(guildId) {
  try {
    const currentPlayer = validateCurrentPlayer();
    
    const hashedPlayer = await hashUsername(currentPlayer);
    const response = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}.json`, {
      method: 'DELETE'
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to decline invite: ${response.status}`);
    }
    
    // Also remove from guild's invites tracking
    await fetch(`${getGuildInvitesApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'DELETE'
    });
    
    return true;
  } catch (error) {
    console.error('[Guilds] Error declining invite:', error);
    throw error;
  }
}

async function getPlayerInvites() {
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      return [];
    }

    const hashedPlayer = await hashUsername(currentPlayer);
    const response = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites.json`);
    const data = await handleFirebaseResponse(response, 'get invites', []);
    if (!data || typeof data !== 'object') {
      return [];
    }
    return Object.values(data);
  } catch (error) {
    console.error('[Guilds] Error getting player invites:', error);
    return [];
  }
}

// Remove an invite from Firebase (both guild and player paths)
async function removeInviteFromFirebase(guildId, hashedPlayer) {
  try {
    // Remove from guild invites path
    await fetch(`${getGuildInvitesApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'DELETE'
    });
    
    // Remove from player invites path
    await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}.json`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.error('[Guilds] Error removing invite from Firebase:', error);
  }
}

async function getGuildInvites(guildId) {
  try {
    const invites = [];
    const inviteMap = new Map(); // Track by playerNameHashed to avoid duplicates
    
    // Get invites from new guild invites path
    const response = await fetch(`${getGuildInvitesApiUrl(guildId)}.json`);
    const data = await handleFirebaseResponse(response, 'get guild invites', []);
    if (data && typeof data === 'object') {
      Object.values(data).forEach(invite => {
        if (invite && invite.playerNameHashed) {
          inviteMap.set(invite.playerNameHashed, invite);
        }
      });
    }
    
    // Also check for old invites in players path and migrate them
    try {
      const playersResponse = await fetch(`${getPlayerGuildApiUrl()}.json`);
      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        if (playersData && typeof playersData === 'object') {
          // Check each player's invites
          for (const [hashedPlayer, playerData] of Object.entries(playersData)) {
            if (playerData && playerData.invites && playerData.invites[guildId]) {
              const oldInvite = playerData.invites[guildId];
              // If not already in new format, migrate it
              if (!inviteMap.has(hashedPlayer)) {
                // Get player name from old invite (should be stored in plain text now)
                const playerName = oldInvite.playerName || 'Unknown Player';
                
                await migrateInviteToGuildPath(guildId, playerName, hashedPlayer, oldInvite);
                
                // Add to invites list
                inviteMap.set(hashedPlayer, {
                  playerName,
                  playerNameHashed: hashedPlayer,
                  invitedBy: oldInvite.invitedBy || 'Unknown',
                  invitedByHashed: oldInvite.invitedByHashed || '',
                  invitedAt: oldInvite.invitedAt || Date.now()
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Silently fail - old invites check is optional
    }
    
    // Validate invites and remove ones for non-existent players
    const validInvites = [];
    for (const invite of inviteMap.values()) {
      if (invite && invite.playerName && invite.playerNameHashed) {
        // Check if player exists
        const exists = await playerExists(invite.playerName);
        if (exists) {
          validInvites.push(invite);
        } else {
          // Player doesn't exist, remove invite from Firebase
          console.log(`[Guilds] Removing invite for non-existent player: ${invite.playerName}`);
          await removeInviteFromFirebase(guildId, invite.playerNameHashed);
        }
      } else {
        // Invalid invite data, skip it
        if (invite && invite.playerNameHashed) {
          console.log(`[Guilds] Removing invite with invalid data: ${invite.playerNameHashed}`);
          await removeInviteFromFirebase(guildId, invite.playerNameHashed);
        }
      }
    }
    
    return validInvites;
  } catch (error) {
    console.error('[Guilds] Error getting guild invites:', error);
    return [];
  }
}

// Migrate old invite from player path to guild path
async function migrateInviteToGuildPath(guildId, playerName, hashedPlayer, inviteData) {
  try {
    const guildInviteData = {
      playerName,
      playerNameHashed: hashedPlayer,
      invitedBy: inviteData.invitedBy || 'Unknown',
      invitedByHashed: inviteData.invitedByHashed || '',
      invitedAt: inviteData.invitedAt || Date.now()
    };
    
    await fetch(`${getGuildInvitesApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guildInviteData)
    });
  } catch (error) {
    console.error('[Guilds] Error migrating invite:', error);
  }
}

// =======================
// Permissions
// =======================

function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

const ACTION_RULES = {
  kick: { 
    [GUILD_ROLES.LEADER]: (target) => target !== GUILD_ROLES.LEADER, 
    [GUILD_ROLES.OFFICER]: (target) => target === GUILD_ROLES.MEMBER 
  },
  demote: { 
    [GUILD_ROLES.LEADER]: (target) => target === GUILD_ROLES.OFFICER 
  },
  promote: { 
    [GUILD_ROLES.LEADER]: (target) => target === GUILD_ROLES.MEMBER 
  }
};

function canPerformAction(currentRole, targetRole, action) {
  if (ACTION_RULES[action]?.[currentRole]) {
    return ACTION_RULES[action][currentRole](targetRole);
  }
  return hasPermission(currentRole, action);
}

// =======================
// Guild Chat
// =======================

async function sendGuildMessage(guildId, text) {
  try {
    const currentPlayer = validateCurrentPlayer();

    if (!text || text.trim().length === 0) {
      return false;
    }

    if (text.length > GUILD_CONFIG.maxMessageLength) {
      throw new Error(`Message must be ${GUILD_CONFIG.maxMessageLength} characters or less`);
    }

    const members = await getGuildMembers(guildId);
    const currentMember = findMemberByUsername(members, currentPlayer);
    if (!currentMember) {
      throw new Error('You are not a member of this guild');
    }

    const messageText = text.trim();
    const encryptedText = await encryptGuildMessage(messageText, guildId);
    
    const messageData = {
      from: currentPlayer,
      fromHashed: await hashUsername(currentPlayer),
      text: encryptedText,
      timestamp: Date.now()
    };

    const messageId = Date.now().toString();
    await firebaseRequest(`${getGuildChatApiUrl(guildId)}/${messageId}`, 'PUT', messageData, 'send message');

    return true;
  } catch (error) {
    console.error('[Guilds] Error sending guild message:', error);
    throw error;
  }
}

async function sendGuildSystemMessage(guildId, messageText) {
  try {
    const encryptedText = await encryptGuildMessage(messageText, guildId);
    
    const messageData = {
      from: 'System',
      fromHashed: 'system',
      text: encryptedText,
      timestamp: Date.now(),
      isSystem: true
    };

    const messageId = Date.now().toString();
    const response = await fetch(`${getGuildChatApiUrl(guildId)}/${messageId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      console.warn('[Guilds] Failed to send system message:', response.status);
    }
  } catch (error) {
    console.warn('[Guilds] Error sending system message:', error);
  }
}

async function getGuildMessages(guildId, limit = 50) {
  try {
    const response = await fetch(`${getGuildChatApiUrl(guildId)}.json?orderBy="$key"&limitToLast=${limit}`);
    const data = await handleFirebaseResponse(response, 'get messages', []);
    if (!data || typeof data !== 'object') {
      return [];
    }
    const messages = Object.entries(data)
      .map(([id, message]) => ({ id, ...message }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Decrypt messages
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const decryptedText = await decryptGuildMessage(msg.text, guildId);
          return { ...msg, text: decryptedText };
        } catch (error) {
          console.warn('[Guilds] Failed to decrypt message:', error);
          return msg;
        }
      })
    );
    
    return decryptedMessages;
  } catch (error) {
    console.error('[Guilds] Error getting guild messages:', error);
    return [];
  }
}

// =======================
// UI Components
// =======================

const CSS_CONSTANTS = {
  BACKGROUND_URL: 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png',
  BORDER_4_FRAME: 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch',
  BORDER_1_FRAME: 'url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill',
  BORDER_1_FRAME_PRESSED: 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 4 fill',
  BORDER_3_FRAME: 'url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill',
  FONT_FAMILY: "'Trebuchet MS', 'Arial Black', Arial, sans-serif",
  FONT_FAMILY_SYSTEM: 'system-ui, -apple-system, sans-serif',
  COLORS: {
    TEXT_PRIMARY: 'rgb(230, 215, 176)',
    TEXT_WHITE: 'rgb(255, 255, 255)',
    ONLINE: 'rgb(76, 175, 80)',
    OFFLINE: 'rgb(255, 107, 107)',
    LINK: 'rgb(100, 181, 246)',
    ERROR: '#ff6b6b',
    SUCCESS: '#4caf50',
    ROLE_LEADER: '#ffd700', // Gold for leader
    ROLE_OFFICER: '#64b5f6', // Blue for officer
    ROLE_MEMBER: '#a5d6a7', // Green for member
    WHITE_50: 'rgba(255, 255, 255, 0.5)',
    WHITE_60: 'rgba(255, 255, 255, 0.6)',
    WHITE_70: 'rgba(255, 255, 255, 0.7)',
    WHITE_05: 'rgba(255, 255, 255, 0.05)',
    WHITE_10: 'rgba(255, 255, 255, 0.1)',
    WHITE_20: 'rgba(255, 255, 255, 0.2)',
    BLACK_20: 'rgba(0, 0, 0, 0.2)',
    BLACK_30: 'rgba(0, 0, 0, 0.3)',
    LINK_15: 'rgba(100, 181, 246, 0.15)'
  },
  FONT_SIZES: {
    XS: '10px',
    SM: '11px',
    BASE: '12px',
    MD: '13px',
    LG: '14px',
    XL: '16px'
  }
};

// =======================
// Dropdown Menu Functions (VIP List style)
// =======================

// Add hover effect to element
function addHoverEffect(element, hoverBackground = 'rgba(255, 255, 255, 0.1)') {
  element.addEventListener('mouseenter', () => {
    element.style.background = hoverBackground;
  });
  element.addEventListener('mouseleave', () => {
    element.style.background = 'transparent';
  });
}

// Find container (modal, panel, or scrollable parent)
function findDropdownContainer(element) {
  return element.closest('.column-content-wrapper') || 
         element.closest('[style*="overflow"]') ||
         element.closest('[class*="scroll"]');
}

// Check if dropdown should open upward based on available space
function shouldDropdownOpenUpward(dropdown, button, container) {
  const buttonRect = button.getBoundingClientRect();
  
  const wasVisible = dropdown.style.display === 'block';
  dropdown.style.position = 'fixed';
  dropdown.style.visibility = 'hidden';
  dropdown.style.display = 'block';
  dropdown.style.top = '-9999px';
  dropdown.style.left = '-9999px';
  
  void dropdown.offsetHeight;
  const dropdownHeight = dropdown.offsetHeight || 150;
  
  dropdown.style.display = wasVisible ? 'block' : 'none';
  dropdown.style.position = '';
  dropdown.style.visibility = '';
  dropdown.style.top = '';
  dropdown.style.left = '';
  
  let spaceBelow, spaceAbove, containerBottom, containerTop;
  
  if (container) {
    const containerRect = container.getBoundingClientRect();
    containerBottom = Math.min(containerRect.bottom, window.innerHeight);
    containerTop = Math.max(containerRect.top, 0);
    spaceBelow = containerBottom - buttonRect.bottom;
    spaceAbove = buttonRect.top - containerTop;
  } else {
    containerBottom = window.innerHeight;
    containerTop = 0;
    spaceBelow = containerBottom - buttonRect.bottom;
    spaceAbove = buttonRect.top;
  }
  
  const requiredSpace = dropdownHeight + 20;
  return (spaceBelow < requiredSpace && spaceAbove >= requiredSpace) ||
         (spaceAbove > spaceBelow && spaceAbove >= requiredSpace);
}

// Position dropdown above or below button
function positionDropdown(dropdown, button, openUpward, container) {
  // Always use fixed positioning when dropdown is in document.body (ensures it appears above all elements)
  // Use absolute positioning only if dropdown is still in its original container (modal context)
  const isInBody = dropdown.parentElement === document.body;
  
  if (isInBody) {
    // Use fixed positioning relative to viewport (ensures dropdown appears above all elements)
    const buttonRect = button.getBoundingClientRect();
    
    if (openUpward) {
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${buttonRect.top - dropdown.offsetHeight - 4}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.left = `${buttonRect.left}px`;
    } else {
      dropdown.style.position = 'fixed';
      dropdown.style.top = `${buttonRect.bottom + 4}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.left = `${buttonRect.left}px`;
    }
    dropdown.style.marginTop = '0';
    dropdown.style.marginBottom = '0';
    dropdown.style.transform = 'none';
  } else {
    // Use absolute positioning relative to button's positioned parent (for modals)
    const relativeParent = button.closest('div[style*="position: relative"]') || 
                           (button.parentElement && getComputedStyle(button.parentElement).position === 'relative' ? button.parentElement : null);
    
    if (relativeParent && relativeParent.style.position !== 'relative') {
      relativeParent.style.position = 'relative';
    }
    
    dropdown.style.position = 'absolute';
    if (openUpward) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = '100%';
      dropdown.style.marginTop = '0';
      dropdown.style.marginBottom = '4px';
    } else {
      dropdown.style.top = '100%';
      dropdown.style.bottom = 'auto';
      dropdown.style.marginTop = '4px';
      dropdown.style.marginBottom = '0';
    }
    dropdown.style.left = '0';
    dropdown.style.right = 'auto';
    dropdown.style.transform = 'none';
  }
}

// Reset dropdown positioning styles
function resetDropdownStyles(dropdown) {
  dropdown.style.display = 'none';
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.left = '';
  dropdown.style.marginTop = '';
  dropdown.style.marginBottom = '';
  dropdown.style.transform = '';
  dropdown.style.position = '';
  
  // Move dropdown back to original parent if it was moved to document.body
  if (dropdown._originalParent && dropdown.parentElement === document.body) {
    dropdown._originalParent.appendChild(dropdown);
    dropdown._originalParent = null;
  }
}

// Close all dropdowns except the specified one
function closeAllDropdownsExcept(excludeDropdown) {
  document.querySelectorAll('.guild-dropdown-menu').forEach(menu => {
    if (menu !== excludeDropdown) {
      resetDropdownStyles(menu);
    }
  });
}

// Create dropdown element with base styling
function createDropdownElement() {
  const dropdown = document.createElement('div');
  dropdown.className = 'guild-dropdown-menu';
  dropdown.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    transform: none;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    min-width: 120px;
    z-index: 10001;
    margin-top: 0;
    margin-bottom: 0;
    padding: 4px;
    pointer-events: auto;
  `;
  return dropdown;
}

// Create dropdown menu item
function createDropdownItem(text, onClick, dropdown, options = {}) {
  const {
    color = CSS_CONSTANTS.COLORS.TEXT_PRIMARY,
    fontSize = '',
    selected = false,
    dataAttributes = {}
  } = options;
  
  const menuItem = document.createElement('div');
  menuItem.textContent = text;
  menuItem.style.cssText = `
    padding: 6px 12px;
    color: ${color};
    cursor: pointer;
    ${fontSize ? `font-size: ${fontSize};` : ''}
    text-align: left;
    ${selected ? 'background: rgba(100, 181, 246, 0.2);' : ''}
  `;
  
  // Apply data attributes
  Object.entries(dataAttributes).forEach(([key, value]) => {
    menuItem.setAttribute(key, value);
  });
  
  addHoverEffect(menuItem);
  menuItem.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
    resetDropdownStyles(dropdown); // Properly close and reset dropdown
  });
  
  return menuItem;
}

// Global click handler for closing dropdowns
let guildDropdownClickHandler = null;

// Setup global click handler to close dropdowns when clicking outside
function setupGuildDropdownClickHandler() {
  if (guildDropdownClickHandler) return;
  
  guildDropdownClickHandler = (e) => {
    // Close all dropdowns if click is outside any dropdown menu
    const clickedDropdown = e.target.closest('.guild-dropdown-menu');
    
    if (!clickedDropdown) {
      document.querySelectorAll('.guild-dropdown-menu').forEach(menu => {
        resetDropdownStyles(menu);
      });
    }
  };
  
  document.addEventListener('click', guildDropdownClickHandler);
}

// Toggle dropdown visibility with positioning
function toggleDropdown(dropdown, button, container) {
  const isVisible = dropdown.style.display === 'block';
  closeAllDropdownsExcept(dropdown);
  
  if (!isVisible) {
    setupGuildDropdownClickHandler(); // Ensure handler is set up
    
    // Move dropdown to document.body to ensure it appears above all elements
    const originalParent = dropdown.parentElement;
    if (dropdown.parentElement !== document.body) {
      document.body.appendChild(dropdown);
      dropdown._originalParent = originalParent;
    }
    
    const openUpward = shouldDropdownOpenUpward(dropdown, button, container);
    dropdown.style.display = 'block';
    void dropdown.offsetHeight;
    positionDropdown(dropdown, button, openUpward, container);
  } else {
    resetDropdownStyles(dropdown);
    
    // Move dropdown back to original parent if it was moved
    if (dropdown._originalParent && dropdown.parentElement === document.body) {
      dropdown._originalParent.appendChild(dropdown);
      dropdown._originalParent = null;
    }
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getOpenDialog() {
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

// Close the currently open dialog
function closeDialog() {
  const dialog = getOpenDialog();
  if (dialog) dialog.remove();
}

// Open Cyclopedia modal for a specific player (Leaderboards view - same as VIP List)
function openCyclopediaForPlayer(playerName) {
  // Close guild panel if open
  const guildPanel = document.querySelector('.guild-panel');
  if (guildPanel) {
    const closeBtn = guildPanel.querySelector('.panel-close-button');
    if (closeBtn) closeBtn.click();
  }
  
  // Check if Cyclopedia is already open and close it first
  const isCyclopediaOpen = () => {
    if (typeof window !== 'undefined' && window.activeCyclopediaModal) return true;
    if (typeof window !== 'undefined' && window.cyclopediaModalInProgress) return true;
    if (typeof window !== 'undefined' && window.cyclopediaState && window.cyclopediaState.modalOpen) return true;
    const openModal = document.querySelector('div[role="dialog"][data-state="open"]');
    if (openModal && openModal.textContent && openModal.textContent.includes('Cyclopedia')) return true;
    return false;
  };
  
  const wasCyclopediaOpen = isCyclopediaOpen();
  
  if (wasCyclopediaOpen) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    
    if (typeof window !== 'undefined') {
      if (window.activeCyclopediaModal) window.activeCyclopediaModal = null;
      if (window.cyclopediaModalInProgress !== undefined) window.cyclopediaModalInProgress = false;
      if (window.cyclopediaState) window.cyclopediaState.modalOpen = false;
    }
  }
  
  // Helper to set cyclopedia state
  const setCyclopediaState = (username) => {
    if (typeof cyclopediaState !== 'undefined') {
      cyclopediaState.searchedUsername = username;
    } else if (typeof window !== 'undefined' && window.cyclopediaState) {
      window.cyclopediaState.searchedUsername = username;
    }
  };
  
  // Wait a bit for modal to close, then open Cyclopedia (longer wait if we closed one)
  const waitTime = wasCyclopediaOpen ? TIMEOUTS.NORMAL : TIMEOUTS.SHORT;
  const timeout1 = setTimeout(() => {
    try {
      // Set searched player name in cyclopediaState before opening
      setCyclopediaState(playerName);
      
      // Set selected category to Leaderboards
      if (typeof window !== 'undefined') {
        window.selectedCharacterItem = 'Leaderboards';
      }
      
      // Open Cyclopedia modal
      if (typeof window !== 'undefined' && window.Cyclopedia && typeof window.Cyclopedia.show === 'function') {
        window.Cyclopedia.show({});
      } else if (typeof openCyclopediaModal === 'function') {
        openCyclopediaModal({});
      } else {
        console.warn('[Guilds] Could not find openCyclopediaModal function');
        return;
      }
      
      // After opening, navigate to Characters tab and Leaderboards
      const timeout2 = setTimeout(() => {
        setCyclopediaState(playerName);
        
        // Find Characters tab button
        const tabButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
          const text = btn.textContent?.trim() || '';
          return text === 'Characters';
        });
        
        // Click Characters tab
        if (tabButtons.length > 0) {
          const charactersTab = tabButtons.find((btn) => {
            const parent = btn.closest('[role="tablist"], .flex, nav');
            return parent !== null;
          }) || tabButtons[0];
          
          charactersTab.click();
        }
        
        // Wait for Characters tab to load, then click Leaderboards and trigger search
        const timeout3 = setTimeout(() => {
          setCyclopediaState(playerName);
          
          // Set selected category to Leaderboards
          if (typeof window !== 'undefined') {
            window.selectedCharacterItem = 'Leaderboards';
          }
          
          // Find and click Leaderboards button
          const leaderboardsButton = Array.from(document.querySelectorAll('div')).find(div => {
            const text = div.textContent?.trim() || '';
            return text === 'Leaderboards';
          });
          
          if (leaderboardsButton) {
            leaderboardsButton.click();
          }
          
          // Wait for Leaderboards to load, then find search input and trigger search
          const timeout4 = setTimeout(() => {
            // Try to find the leaderboard search input using multiple strategies
            let searchInput = null;
            
            // Strategy 1: Look for input with placeholder "Compare with..." inside "Player search" widget
            const playerSearchHeaders = Array.from(document.querySelectorAll('h2, .widget-top-text')).filter(el => {
              const text = el.textContent?.trim() || '';
              return text.toLowerCase() === 'player search';
            });
            
            if (playerSearchHeaders.length > 0) {
              // Find the closest parent container that contains both the header and the input
              const playerSearchContainer = playerSearchHeaders[0].closest('div[style*="flex-direction: column"]');
              if (playerSearchContainer) {
                const inputWithPlaceholder = playerSearchContainer.querySelector('input[placeholder*="Compare with"]');
                if (inputWithPlaceholder) {
                  searchInput = inputWithPlaceholder;
                }
              }
            }
            
            // Strategy 2: Look for visible input with placeholder "Compare with..."
            if (!searchInput) {
              const allInputs = Array.from(document.querySelectorAll('input[type="text"]'));
              searchInput = allInputs.find(input => {
                const placeholder = (input.placeholder || '').toLowerCase();
                const style = window.getComputedStyle(input);
                return placeholder.includes('compare with') &&
                       !input.disabled && 
                       input.offsetParent !== null &&
                       style.display !== 'none' &&
                       style.visibility !== 'hidden';
              });
            }
            
            // Strategy 3: Look for input near a Search button (fallback)
            if (!searchInput) {
              const searchButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const text = btn.textContent?.trim().toLowerCase() || '';
                return text === 'search' && !btn.disabled && btn.offsetParent !== null;
              });
              
              if (searchButtons.length > 0) {
                // Find the Search button that's in the same container as "Player search" header
                const playerSearchButton = searchButtons.find(btn => {
                  const container = btn.closest('div[style*="flex-direction: column"]');
                  if (container) {
                    const header = container.querySelector('h2, .widget-top-text');
                    return header && header.textContent?.trim().toLowerCase() === 'player search';
                  }
                  return false;
                });
                
                if (playerSearchButton) {
                  const buttonParent = playerSearchButton.closest('div');
                  if (buttonParent) {
                    searchInput = buttonParent.querySelector('input[type="text"]');
                  }
                }
              }
            }
            
            // If found, set the value and trigger search
            if (searchInput) {
              searchInput.value = playerName;
              searchInput.focus();
              
              // Trigger input event
              searchInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              
              // Also try Enter key to trigger search
              searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                bubbles: true, 
                cancelable: true, 
                key: 'Enter',
                code: 'Enter',
                keyCode: 13
              }));
              
              // Look for and click Search button if it exists
              const searchButton = Array.from(document.querySelectorAll('button')).find(btn => {
                const text = btn.textContent?.trim() || '';
                return text.toLowerCase() === 'search' && !btn.disabled && btn.offsetParent !== null;
              });
              
              if (searchButton) {
                setTimeout(() => {
                  searchButton.click();
                }, 100);
              }
            }
          }, TIMEOUTS.NORMAL);
        }, TIMEOUTS.LONGER);
      }, TIMEOUTS.LONG);
    } catch (error) {
      console.error('[Guilds] Error opening Cyclopedia:', error);
    }
  }, waitTime);
}

// Get player equipment from Firebase
async function getPlayerEquipmentFromFirebase(playerName) {
  try {
    if (!playerName) return {};
    
    const normalizedName = sanitizeFirebaseKey(playerName);
    const path = `${GUILD_CONFIG.firebaseUrl}/player-equipment/${normalizedName}/equipment.json`;
    
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        return {}; // No equipment stored yet
      }
      return {};
    }
    
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error('[Guilds] Error fetching player equipment from Firebase:', error);
    return {};
  }
}

// Helper function to populate equipment grid with player equipment
async function populatePlayerEquipmentGrid(container, equippedItems) {
  EQUIPMENT_SLOTS.forEach(([slotType, x, y, name]) => {
    const slot = container.querySelector(`[data-slot-type="${slotType}"]`);
    if (!slot) return;
    
    // Clear slot completely (including any async-loaded default images)
    while (slot.firstChild) {
      const child = slot.firstChild;
      if (child.parentNode === slot) {
        slot.removeChild(child);
      } else {
        break; // Child is no longer a child of slot, stop
      }
    }
    
    // Try to find item by slotType, or by normalized slot type
    let item = equippedItems[slotType];
    if (!item) {
      // Try normalized slot types (weapon -> weapon-right, shield -> weapon-left)
      const normalizedSlot = normalizeSlotTypeFromDb(slotType);
      if (normalizedSlot !== slotType) {
        item = equippedItems[normalizedSlot];
      }
      // Also try reverse normalization (weapon-right -> weapon, weapon-left -> shield)
      if (!item && slotType === 'weapon-right') {
        item = equippedItems['weapon'];
      } else if (!item && slotType === 'weapon-left') {
        item = equippedItems['shield'];
      }
    }
    
    // Store item data on slot for tooltip access
    slot._equippedItem = item;
    
    if (item && item.gameId) {
      // Show equipped item
      try {
        const equipData = globalThis.state?.utils?.getEquipment(item.gameId);
        let spriteId = null;
        let isInventoryItem = false;
        
        if (equipData && equipData.metadata) {
          spriteId = equipData.metadata.spriteId;
        } else {
          // For inventory items, use gameId directly as spriteId
          spriteId = item.gameId;
          isInventoryItem = true;
        }
        
        if (spriteId && typeof api?.ui?.components?.createItemPortrait === 'function' && !isInventoryItem) {
          // Use createItemPortrait for regular equipment
          const itemPortrait = api.ui.components.createItemPortrait({
            itemId: spriteId,
            stat: item.stat,
            tier: item.tier
          });
          slot.appendChild(itemPortrait);
        } else if (spriteId) {
          // For inventory items, create viewport structure manually
          const viewportStructure = createViewportStructureForSlot(spriteId);
          slot.appendChild(viewportStructure);
        } else {
          loadDefaultSlotImageIntoSlot(slot, slotType, name);
        }
      } catch (e) {
        // For inventory items that can't be accessed via getEquipment, try using gameId directly
        try {
          const spriteId = item.gameId;
          const viewportStructure = createViewportStructureForSlot(spriteId);
          slot.appendChild(viewportStructure);
        } catch (e2) {
          console.warn(`[Guilds] Error displaying equipped item:`, e2);
          loadDefaultSlotImageIntoSlot(slot, slotType, name);
        }
      }
    } else {
      // No equipment - show empty slot image
      loadDefaultSlotImageIntoSlot(slot, slotType, name);
    }
    
    // Add tooltip functionality for viewing other players' equipment
    addPlayerEquipmentTooltip(slot, slotType, name);
  });
}

// Helper function to add tooltip to equipment slot when viewing other players' equipment
function addPlayerEquipmentTooltip(slot, slotType, name) {
  // Remove existing tooltip if any
  if (slot._tooltip) {
    const existingTooltip = slot._tooltip;
    slot.removeEventListener('mouseenter', slot._showTooltip);
    slot.removeEventListener('mouseleave', slot._hideTooltip);
    slot.removeEventListener('mousemove', slot._updateTooltipPosition);
    if (existingTooltip.parentNode) {
      existingTooltip.parentNode.removeChild(existingTooltip);
    }
  }
  
  // Create tooltip for slot
  const tooltip = createTooltipElement();
  slot._tooltip = tooltip;
  
  // Build tooltip content (will be updated when hovering)
  const tooltipContent = document.createElement('div');
  tooltipContent.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
  tooltip.appendChild(tooltipContent);
  
  const updateSlotTooltip = () => {
    tooltipContent.innerHTML = '';
    
    const title = document.createElement('div');
    title.textContent = name;
    title.style.cssText = `
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 2px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 6px;
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
    `;
    tooltipContent.appendChild(title);
    
    // Get equipped item from slot data
    const item = slot._equippedItem;
    
    if (item && item.gameId) {
      // Get item name
      let itemName = item.name || `Item ${item.gameId}`;
      try {
        const equipData = globalThis.state?.utils?.getEquipment(item.gameId);
        if (equipData && equipData.metadata && equipData.metadata.name) {
          itemName = equipData.metadata.name;
        }
      } catch (e) {
        // Use stored name or fallback
      }
      
      addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipEquipped') || 'Equipped', itemName, CSS_CONSTANTS.COLORS.TEXT_WHITE);
      if (item.tier) {
        addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipGuildPoints') || 'Guild Points', `+${item.tier}`, CSS_CONSTANTS.COLORS.SUCCESS);
      }
      // Backpacks have no stat
      if (!isSpecialBackpack(item.gameId) && item.stat) {
        addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipStat') || 'Stat', item.stat.toUpperCase(), '#64b5f6');
      }
      if (item.tier) {
        addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipTier') || 'Tier', `T${item.tier}`, CSS_CONSTANTS.COLORS.TEXT_WHITE);
      }
    } else {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = t('mods.guilds.equipment.tooltipEmptySlot') || 'Empty slot';
      emptyMsg.style.cssText = `
        color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
        font-size: 11px;
        opacity: 0.7;
        font-style: italic;
      `;
      tooltipContent.appendChild(emptyMsg);
    }
  };
  
  // Show/hide tooltip on hover
  let tooltipTimeout;
  const showTooltip = () => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      updateSlotTooltip();
      showEquipmentTooltip(tooltip);
      updateTooltipPosition();
    }, 300);
  };
  
  const hideTooltip = () => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    if (currentEquipmentTooltip === tooltip) {
      hideCurrentEquipmentTooltip();
    } else {
      tooltip.style.display = 'none';
    }
  };
  
  const updateTooltipPosition = () => {
    const rect = slot.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const position = calculateTooltipPosition(rect, tooltipRect);
    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
  };
  
  // Store handlers for cleanup
  slot._showTooltip = showTooltip;
  slot._hideTooltip = hideTooltip;
  slot._updateTooltipPosition = updateTooltipPosition;
  
  // Hover effects
  slot.addEventListener('mouseenter', showTooltip);
  slot.addEventListener('mouseleave', hideTooltip);
  slot.addEventListener('mousemove', updateTooltipPosition);
}

// Show equipment modal for a player
async function showPlayerEquipmentModal(playerName) {
  try {
    // Close guild panel if open
    const guildPanel = document.querySelector('.guild-panel');
    if (guildPanel) {
      const closeBtn = guildPanel.querySelector('.panel-close-button');
      if (closeBtn) closeBtn.click();
    }
    
    // Fetch equipment from Firebase
    const equippedItems = await getPlayerEquipmentFromFirebase(playerName);
    
    // Calculate total stats
    let totalStats = { ad: 0, ap: 0, hp: 0 };
    let totalGuildPoints = 0;
    
    for (const [slotType, item] of Object.entries(equippedItems)) {
      if (item && item.tier) {
        totalGuildPoints += item.tier;
        // Calculate stats separately (only if item has stat property)
        if (item.stat) {
          const statType = item.stat.toLowerCase();
          if (totalStats.hasOwnProperty(statType)) {
            totalStats[statType] += item.tier;
          }
        }
      }
    }
    
    // Create modal content similar to col2 layout
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
      width: 190px;
      min-width: 190px;
      max-width: 190px;
      flex: 1 1 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    // Row 1: Equipment section (50% height - fixed)
    const equipmentBox = createEquipmentBox({
      title: t('mods.guilds.equipment.characterEquipmentTitle') || 'Character Equipment',
      content: (() => {
        const container = document.createElement('div');
        container.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 100%;
        `;
        
        const equipmentGrid = createEquipmentGrid(true); // Skip auto-loading
        container.appendChild(equipmentGrid);
        
        // Populate grid with player equipment (async)
        populatePlayerEquipmentGrid(equipmentGrid, equippedItems);
        
        return container;
      })()
    });
    equipmentBox.style.flex = '0 0 200px';
    equipmentBox.style.height = '200px';
    equipmentBox.style.minHeight = '200px';
    equipmentBox.style.maxHeight = '200px';
    contentDiv.appendChild(equipmentBox);
    
    // Row 2: Total stats section (50% height - fixed)
    const detailsContainer = document.createElement('div');
    detailsContainer.setAttribute('data-details-container', 'true');
    detailsContainer.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow-y: auto;
    `;
    
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      height: 100%;
    `;
    
    // Total Guild Points
    const totalDiv = document.createElement('div');
    totalDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    `;
    
    const totalLabel = document.createElement('div');
    totalLabel.textContent = t('mods.guilds.equipment.totalGuildPoints') || 'Total Guild Points';
    totalLabel.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 10px;
      opacity: 0.7;
    `;
    
    const totalValue = document.createElement('div');
    totalValue.textContent = totalGuildPoints.toString();
    totalValue.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 18px;
      font-weight: 600;
    `;
    
    totalDiv.appendChild(totalLabel);
    totalDiv.appendChild(totalValue);
    statsDiv.appendChild(totalDiv);
    
    detailsContainer.appendChild(statsDiv);
    
    const bottomBox = createEquipmentBox({
      title: t('mods.guilds.equipment.totalStatsTitle') || 'Total stats',
      content: detailsContainer
    });
    bottomBox.style.flex = '0 0 200px';
    bottomBox.style.height = '200px';
    bottomBox.style.minHeight = '200px';
    bottomBox.style.maxHeight = '200px';
    contentDiv.appendChild(bottomBox);
    
    // Create modal
    if (!ensureModalApi()) {
      console.error('[Guilds] Modal API not available');
      return;
    }
    
    const modal = api.ui.components.createModal({
      title: `${playerName}'s Equipment`,
      width: 220,
      height: 480,
      content: contentDiv,
      buttons: [{
        text: t('mods.guilds.close') || 'Close',
        primary: true,
        onClick: () => {
          const dialog = getOpenDialog();
          if (dialog) dialog.remove();
        }
      }]
    });
    
    setTimeout(() => {
      const dialog = getOpenDialog();
      if (dialog) {
        applyModalStyles(dialog, 220, 480);
        setupEscKeyHandler(dialog, () => {
          dialog.remove();
        });
      }
    }, 100);
    
  } catch (error) {
    console.error('[Guilds] Error showing equipment modal:', error);
    showWarningModal(t('mods.guilds.error') || 'Error', 'Failed to load equipment data.');
  }
}

// Check if modal API is available
function isModalApiAvailable() {
  return typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal;
}

// Ensure modal API is available, show error and return false if not
function ensureModalApi() {
  if (!isModalApiAvailable()) {
    console.error('[Guilds] Modal API not available');
    return false;
  }
  return true;
}

// Create modal with automatic styling application
function createStyledModal({ title, width, height, content, buttons, onAfterCreate }) {
  if (!ensureModalApi()) return null;
  
  const modal = api.ui.components.createModal({
    title,
    width,
    height: height !== undefined ? height : null,
    content,
    buttons
  });
  
  setTimeout(() => {
    const dialog = getOpenDialog();
    if (dialog) {
      applyModalStyles(dialog, width, height);
      if (onAfterCreate) onAfterCreate(dialog);
    }
  }, 100);
  
  return modal;
}

// Create a button that closes dialog on click
function createCloseDialogButton(text, primary = false, onClick = null) {
  return {
    text,
    primary,
    onClick: () => {
      closeDialog();
      if (onClick) onClick();
    }
  };
}

function applyModalStyles(dialog, width, height) {
  const w = width || MODAL_DIMENSIONS.WIDTH;
  dialog.style.width = `${w}px`;
  dialog.style.minWidth = `${w}px`;
  dialog.style.maxWidth = `${w}px`;
  
  if (height !== null && height !== undefined) {
    const h = height || MODAL_DIMENSIONS.HEIGHT;
    dialog.style.height = `${h}px`;
    dialog.style.minHeight = `${h}px`;
    dialog.style.maxHeight = `${h}px`;
  } else {
    dialog.style.height = 'auto';
    dialog.style.minHeight = 'auto';
    dialog.style.maxHeight = 'none';
  }
  
  const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body, .widget-bottom');
  if (contentElem) {
    contentElem.style.width = `${w}px`;
    if (height !== null && height !== undefined) {
      const h = height || MODAL_DIMENSIONS.HEIGHT;
      contentElem.style.height = `${h}px`;
    } else {
      contentElem.style.height = 'auto';
    }
    contentElem.style.display = 'flex';
    contentElem.style.flexDirection = 'column';
    contentElem.style.flex = '1 1 0';
    contentElem.style.minHeight = '0';
  }
  
  const separator = dialog.querySelector('.separator');
  if (separator) {
    separator.className = 'separator my-2.5';
  }
}

function createButton(text, onClick, style = {}) {
  const button = document.createElement('button');
  button.textContent = text;
  button.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
  
  // Apply custom styles if provided
  if (Object.keys(style).length > 0) {
    const styleString = Object.entries(style).map(([k, v]) => {
      const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${v}`;
    }).join('; ');
    button.style.cssText = styleString;
  }
  
  button.addEventListener('click', onClick);
  return button;
}

function createGuildBox({headerRow, content}) {
  const box = document.createElement('div');
  box.style.flex = '1 1 0';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.margin = '0';
  box.style.padding = '0';
  box.style.minHeight = '0';
  box.style.height = '100%';
  box.style.background = `url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat`;
  box.style.border = '4px solid transparent';
  box.style.borderImage = CSS_CONSTANTS.BORDER_4_FRAME;
  box.style.borderRadius = '6px';
  box.style.overflow = 'hidden';
  
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text';
  titleEl.style.margin = '0';
  titleEl.style.padding = '0';
  titleEl.style.textAlign = 'center';
  titleEl.style.color = CSS_CONSTANTS.COLORS.TEXT_WHITE;
  titleEl.style.display = 'flex';
  titleEl.style.flexDirection = 'row';
  titleEl.style.alignItems = 'center';
  titleEl.style.width = '100%';
  titleEl.style.fontFamily = getFontFamily();
  titleEl.style.fontSize = getFontSize('LG');
  titleEl.style.fontWeight = '600';
  titleEl.style.letterSpacing = '0.3px';
  
  if (headerRow) {
    headerRow.style.position = 'static';
    headerRow.style.top = 'auto';
    headerRow.style.zIndex = 'auto';
    headerRow.style.marginBottom = '0';
    headerRow.style.width = '100%';
    titleEl.appendChild(headerRow);
  }
  box.appendChild(titleEl);
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'column-content-wrapper';
  contentWrapper.style.flex = '1 1 0';
  contentWrapper.style.width = '100%';
  contentWrapper.style.height = '100%';
  contentWrapper.style.minHeight = '0';
  contentWrapper.style.overflowY = 'auto';
  contentWrapper.style.display = 'flex';
  contentWrapper.style.flexDirection = 'column';
  contentWrapper.style.padding = '3px';
  
  if (typeof content === 'string') {
    contentWrapper.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentWrapper.appendChild(content);
  }
  box.appendChild(contentWrapper);
  return box;
}

async function showCreateGuildDialog() {
  if (!ensureModalApi()) return;

  // Check if player is already in a guild
  try {
    const membershipCheck = await checkPlayerGuildMembership();
    if (membershipCheck.isInGuild) {
      showWarningModal(t('mods.guilds.cannotCreateGuild'), t('mods.guilds.alreadyInGuild'));
      return;
    }
  } catch (error) {
    console.error('[Guilds] Error checking player guild status:', error);
    // Continue anyway - better to allow creation than block due to error
  }

  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
  `;

  const nameInput = createStyledInput({
    type: 'text',
    placeholder: t('mods.guilds.guildNamePlaceholder'),
    maxLength: GUILD_CONFIG.maxGuildNameLength
  });
  const nameContainer = createFormField(t('mods.guilds.guildNameLabel'), nameInput);

  const abbrevInput = createStyledInput({
    type: 'text',
    placeholder: t('mods.guilds.abbreviationPlaceholder'),
    maxLength: 6,
    style: { textTransform: 'uppercase' }
  });
  abbrevInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  });
  const abbrevContainer = createFormField(t('mods.guilds.abbreviationLabel'), abbrevInput);

  const descInput = createStyledInput({
    type: 'textarea',
    placeholder: t('mods.guilds.descriptionPlaceholder'),
    maxLength: GUILD_CONFIG.maxGuildDescriptionLength,
    style: { fontFamily: 'system-ui, -apple-system, sans-serif' }
  });
  const descContainer = createFormField(t('mods.guilds.descriptionLabel'), descInput);
  descContainer.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-height: 0;';

  // Join Type selector
  const joinTypeContainer = document.createElement('div');
  joinTypeContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
  
  const joinTypeLabel = document.createElement('label');
  joinTypeLabel.textContent = t('mods.guilds.joinTypeLabel');
  joinTypeLabel.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 14px; margin-bottom: 4px;`;
  
  const joinTypeSelect = createStyledSelect();
  joinTypeSelect.appendChild(createStyledOption({
    value: GUILD_JOIN_TYPES.OPEN,
    text: t('mods.guilds.joinTypeOpen')
  }));
  joinTypeSelect.appendChild(createStyledOption({
    value: GUILD_JOIN_TYPES.INVITE_ONLY,
    text: t('mods.guilds.joinTypeInviteOnly')
  }));
  
  joinTypeContainer.appendChild(joinTypeLabel);
  joinTypeContainer.appendChild(joinTypeSelect);

  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.ERROR};
    font-size: 12px;
    min-height: 16px;
    display: none;
    flex-shrink: 0;
  `;

  contentDiv.appendChild(nameContainer);
  contentDiv.appendChild(abbrevContainer);
  contentDiv.appendChild(descContainer);
  contentDiv.appendChild(joinTypeContainer);
  contentDiv.appendChild(errorMsg);

  let createBtnRef = null;
  const modal = api.ui.components.createModal({
    title: t('mods.guilds.createGuildTitle'),
    width: 450,
    height: null,
    content: contentDiv,
    buttons: [
      {
        text: t('mods.guilds.cancel'),
        primary: false,
        onClick: () => {}
      },
      {
        text: t('mods.guilds.create'),
        primary: true,
        onClick: async () => {
          const name = nameInput.value.trim();
          const abbrev = abbrevInput.value.trim().toUpperCase();
          const desc = descInput.value.trim();
          const joinType = joinTypeSelect.value;

          if (!name) {
            errorMsg.textContent = t('mods.guilds.guildNameRequired');
            errorMsg.style.display = 'block';
            return;
          }

          if (!abbrev || abbrev.length < 3 || abbrev.length > 6) {
            errorMsg.textContent = t('mods.guilds.abbreviationRequired');
            errorMsg.style.display = 'block';
            return;
          }

          if (createBtnRef) {
            createBtnRef.disabled = true;
            createBtnRef.textContent = t('mods.guilds.creating');
          }

          try {
            await createGuild(name, desc, abbrev, joinType);
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            await showGuildBrowser();
          } catch (error) {
            errorMsg.textContent = error.message || t('mods.guilds.failedToCreate');
            errorMsg.style.display = 'block';
            if (createBtnRef) {
              createBtnRef.disabled = false;
              createBtnRef.textContent = t('mods.guilds.create');
            }
          }
        }
      }
    ]
  });

  setTimeout(() => {
    const dialog = getOpenDialog();
    if (dialog) {
      applyModalStyles(dialog, 450, null);
      const buttonContainer = dialog.querySelector('.flex.justify-end.gap-2');
      if (buttonContainer) {
        createBtnRef = buttonContainer.querySelector('button:last-child');
      }
      nameInput.focus();

      const clearError = () => {
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
      };

      nameInput.addEventListener('input', clearError);
      abbrevInput.addEventListener('input', clearError);
      descInput.addEventListener('input', clearError);

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (createBtnRef) createBtnRef.click();
        }
      });
    }
  }, 100);
}

async function showInvitesDialog() {
  if (!ensureModalApi()) return;

  const invites = await getPlayerInvites();
  if (invites.length === 0) {
    showWarningModal(t('mods.guilds.invitesTitle'), t('mods.guilds.noPendingInvites'));
    return;
  }

  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
  `;

  const invitesList = document.createElement('div');
  invitesList.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  `;

  invites.forEach(invite => {
    const inviteItem = document.createElement('div');
    inviteItem.style.cssText = `
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const guildName = document.createElement('div');
    guildName.textContent = invite.guildName;
    guildName.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    `;

    const invitedBy = document.createElement('div');
    invitedBy.textContent = tReplace('mods.guilds.invitedBy', { name: invite.invitedBy });
    invitedBy.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 12px;
      opacity: 0.7;
      margin-bottom: 8px;
    `;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px;';

    const acceptBtn = createButton(t('mods.guilds.accept'), async () => {
      closeDialog();
      try {
        await acceptInvite(invite.guildId);
        // Refresh invite list in guild panel if it's open
        const guildPanel = document.querySelector('.guild-invited-players-container');
        if (guildPanel && guildPanel.refreshInvites) {
          await guildPanel.refreshInvites();
        }
        await openGuildPanel();
      } catch (error) {
        showWarningModal(t('mods.guilds.error'), error.message);
      }
    }, { background: 'rgba(76, 175, 80, 0.3)', flex: '1' });

    const declineBtn = createButton(t('mods.guilds.decline'), async () => {
      try {
        await declineInvite(invite.guildId);
        // Refresh invite list in guild panel if it's open
        const guildPanel = document.querySelector('.guild-invited-players-container');
        if (guildPanel && guildPanel.refreshInvites) {
          await guildPanel.refreshInvites();
        }
        closeDialog();
        if (invites.length > 1) {
          showInvitesDialog();
        }
      } catch (error) {
        showWarningModal(t('mods.guilds.error'), error.message);
      }
    }, { background: 'rgba(255, 107, 107, 0.3)', flex: '1' });

    buttonContainer.appendChild(acceptBtn);
    buttonContainer.appendChild(declineBtn);

    inviteItem.appendChild(guildName);
    inviteItem.appendChild(invitedBy);
    inviteItem.appendChild(buttonContainer);
    invitesList.appendChild(inviteItem);
  });

  contentDiv.appendChild(invitesList);

  createStyledModal({
    title: t('mods.guilds.invitesTitle'),
    width: 450,
    content: contentDiv,
    buttons: [{
      text: t('mods.guilds.close'),
      primary: true,
      onClick: () => {}
    }],
    onAfterCreate: (dialog) => {
      // Add ESC key support to close modal
      setupEscKeyHandler(dialog, () => {
        dialog.remove();
      });
    }
  });
}

async function showGuildBrowser() {
  if (!ensureModalApi()) return;

  const contentDiv = document.createElement('div');
  contentDiv.style.width = '100%';
  contentDiv.style.flex = '1 1 0';
  contentDiv.style.minHeight = '0';
  contentDiv.style.boxSizing = 'border-box';
  contentDiv.style.overflow = 'hidden';
  contentDiv.style.display = 'flex';
  contentDiv.style.flexDirection = 'row';
  contentDiv.style.gap = '8px';

  // Guilds list container
  const guildsList = document.createElement('div');
  guildsList.style.cssText = `
    width: 100%;
    display: flex;
    flex-direction: column;
  `;

  // Sorting state - default to points descending (highest to lowest)
  let sortBy = 'points';
  let sortDirection = 'desc';

  async function loadGuilds(searchTerm = '', sortColumn = null, direction = 'asc') {
    const allGuilds = await getAllGuilds();
    const currentPlayer = getCurrentPlayerName();
    const playerGuild = getPlayerGuild();
    const hashedPlayer = currentPlayer ? await hashUsername(currentPlayer) : null;

    guildsList.innerHTML = '';

    let filteredGuilds = allGuilds;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filteredGuilds = allGuilds.filter(guild => 
        guild.name.toLowerCase().includes(term) ||
        (guild.abbreviation && guild.abbreviation.toLowerCase().includes(term)) ||
        (guild.description && guild.description.toLowerCase().includes(term))
      );
    }

    // Fetch points for all guilds to calculate rankings
    const pointsPromises = filteredGuilds.map(async (guild) => {
      const points = await calculateGuildPoints(guild.id);
      return { guild, points };
    });
    const guildsWithPoints = await Promise.all(pointsPromises);
    filteredGuilds = guildsWithPoints.map(item => ({ ...item.guild, _points: item.points }));

    // Calculate rankings based on points (descending)
    const sortedByPoints = [...filteredGuilds].sort((a, b) => (b._points || 0) - (a._points || 0));
    const rankings = new Map();
    sortedByPoints.forEach((guild, index) => {
      rankings.set(guild.id, index + 1);
    });

    // Apply sorting
    if (sortColumn) {
      filteredGuilds.sort((a, b) => {
        let aVal, bVal;
        
        if (sortColumn === 'name') {
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
        } else if (sortColumn === 'members') {
          aVal = a.memberCount || 0;
          bVal = b.memberCount || 0;
        } else if (sortColumn === 'points') {
          aVal = a._points || 0;
          bVal = b._points || 0;
        } else {
          return 0;
        }
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (filteredGuilds.length === 0) {
      const emptyMsg = document.createElement('div');
      if (firebase401WarningShown) {
        emptyMsg.innerHTML = `
          <div style="text-align: center; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; opacity: 0.7; padding: 20px;">
            <div style="margin-bottom: 12px;">${searchTerm ? t('mods.guilds.noGuildsFound') : t('mods.guilds.unableToLoadGuilds')}</div>
            <div style="font-size: 11px; opacity: 0.6; margin-top: 8px;">
              ${t('mods.guilds.firebaseBlockingAccess')}
            </div>
          </div>
        `;
      } else {
        emptyMsg.textContent = searchTerm ? t('mods.guilds.noGuildsFound') : t('mods.guilds.noGuildsAvailable');
        emptyMsg.style.cssText = `
          text-align: center;
          color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
          opacity: 0.7;
          padding: 20px;
        `;
      }
      guildsList.appendChild(emptyMsg);
      return;
    }

    for (const guild of filteredGuilds) {
      const rank = rankings.get(guild.id) || 999;
      
      // Get background color based on rank
      let bgColor = 'rgba(255, 255, 255, 0.05)'; // Default
      if (rank === 1) {
        bgColor = 'rgba(255, 215, 0, 0.15)'; // Gold for 1st
      } else if (rank === 2) {
        bgColor = 'rgba(192, 192, 192, 0.15)'; // Silver for 2nd
      } else if (rank === 3) {
        bgColor = 'rgba(205, 127, 50, 0.15)'; // Bronze for 3rd
      } else if (rank <= 10) {
        bgColor = 'rgba(200, 200, 255, 0.1)'; // Light blue for top 10
      }
      
      const guildItem = document.createElement('div');
      guildItem.style.cssText = `
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 0;
        margin-bottom: 4px;
        background: ${bgColor};
        width: 100%;
        font-family: ${getFontFamily()};
      `;

      const guildNameCell = document.createElement('div');
      guildNameCell.style.cssText = `
        flex: 2 1 0%;
        text-align: center;
        position: relative;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-family: ${getFontFamily()};
      `;
      const guildName = document.createElement('div');
      guildName.style.cssText = `
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-weight: 600;
        font-size: ${getFontSize('BASE')};
        font-family: ${getFontFamily()};
      `;
      const nameText = document.createTextNode(guild.name);
      guildName.appendChild(nameText);
      if (guild.abbreviation) {
        const abbrevSpan = document.createElement('span');
        abbrevSpan.textContent = ` [${guild.abbreviation}]`;
        abbrevSpan.style.cssText = `
          color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
          opacity: 0.7;
          font-size: ${getFontSize('BASE')};
          font-weight: normal;
          font-family: ${getFontFamily()};
        `;
        guildName.appendChild(abbrevSpan);
      }
      const joinType = guild.joinType || GUILD_JOIN_TYPES.OPEN;
      if (joinType === GUILD_JOIN_TYPES.INVITE_ONLY) {
        const inviteOnlyBadge = document.createElement('span');
        inviteOnlyBadge.textContent = ` (${t('mods.guilds.inviteOnly')})`;
        inviteOnlyBadge.style.cssText = `
          color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
          opacity: 0.6;
          font-size: ${getFontSize('SM')};
          font-weight: normal;
          font-style: italic;
          font-family: ${getFontFamily()};
        `;
        guildName.appendChild(inviteOnlyBadge);
      }
      guildNameCell.appendChild(guildName);

      const memberCountCell = document.createElement('div');
      memberCountCell.style.cssText = `
        flex: 0.8 1 0%;
        text-align: center;
        position: relative;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-size: ${getFontSize('BASE')};
        font-family: ${getFontFamily()};
      `;
      memberCountCell.textContent = `${guild.memberCount || 0}/${GUILD_CONFIG.maxMembers}`;

      const pointsCell = document.createElement('div');
      pointsCell.style.cssText = `
        flex: 0.8 1 0%;
        text-align: center;
        position: relative;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-size: ${getFontSize('BASE')};
        font-weight: 600;
        font-family: ${getFontFamily()};
      `;
      
      // Use cached points if available, otherwise calculate
      if (guild._points !== undefined) {
        pointsCell.textContent = formatNumber(guild._points);
      } else {
        pointsCell.textContent = '...';
        calculateGuildPoints(guild.id).then(points => {
          pointsCell.textContent = formatNumber(points);
        }).catch(() => {
          pointsCell.textContent = '0';
        });
      }
      
      const leaderCell = document.createElement('div');
      leaderCell.style.cssText = `
        flex: 1.2 1 0%;
        text-align: center;
        position: relative;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-size: ${getFontSize('BASE')};
        opacity: 0.8;
        font-family: ${getFontFamily()};
      `;
      leaderCell.textContent = guild.leader;
      
      // Check if this is the player's guild (from localStorage)
      let isPlayerGuild = playerGuild && playerGuild.id === guild.id;
      
      // Also verify from Firebase if localStorage doesn't match
      // Check if player is actually a member (to handle localStorage sync issues)
      let isAlreadyMember = false;
      let playerRole = null;
      if (hashedPlayer) {
        const members = await getGuildMembers(guild.id);
        const member = members.find(m => m.usernameHashed === hashedPlayer);
        if (member) {
          isAlreadyMember = true;
          playerRole = member.role;
          // If player is a member but localStorage doesn't match, fix it
          if (!isPlayerGuild) {
            // Check Firebase to verify if this is actually their guild
            try {
              const playerGuildResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
              if (playerGuildResponse.ok) {
                const playerGuildData = await playerGuildResponse.json();
                if (playerGuildData && playerGuildData.guildId === guild.id) {
                  // Firebase confirms this is their guild - update localStorage
                  isPlayerGuild = true;
                  savePlayerGuild(guild);
                  // Sync guild chat tab if VIP List mod is loaded
                  if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
                    window.syncGuildChatTab();
                  }
                }
              }
            } catch (error) {
              // If Firebase check fails, still treat as their guild if they're a member
              // (especially if leader)
              if (playerRole === GUILD_ROLES.LEADER || isGuildLeader(guild, currentPlayer)) {
                isPlayerGuild = true;
                savePlayerGuild(guild);
                // Sync guild chat tab if VIP List mod is loaded
                if (typeof window !== 'undefined' && typeof window.syncGuildChatTab === 'function') {
                  window.syncGuildChatTab();
                }
              }
            }
          }
        }
      }

      const actionCell = document.createElement('div');
      actionCell.style.cssText = `
        flex: 1 1 0%;
        text-align: center;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      `;

      const actionBtn = document.createElement('button');
      actionBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      
      if (isPlayerGuild) {
        actionBtn.textContent = t('mods.guilds.view');
        actionBtn.style.cssText = 'background: rgba(100, 181, 246, 0.3); border-color: rgba(100, 181, 246, 0.5);';
        actionBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const dialog = getOpenDialog();
          if (dialog) dialog.remove();
          await openGuildPanel();
        });
      } else if (isAlreadyMember) {
        actionBtn.textContent = t('mods.guilds.member');
        actionBtn.style.cssText = 'background: rgba(128, 128, 128, 0.3); border-color: rgba(128, 128, 128, 0.5); opacity: 0.6;';
        actionBtn.disabled = true;
      } else if ((guild.memberCount || 0) >= GUILD_CONFIG.maxMembers) {
        actionBtn.textContent = t('mods.guilds.full');
        actionBtn.style.cssText = 'background: rgba(128, 128, 128, 0.3); border-color: rgba(128, 128, 128, 0.5); opacity: 0.6;';
        actionBtn.disabled = true;
      } else if (playerGuild && playerGuild.id && playerGuild.id !== guild.id) {
        actionBtn.textContent = t('mods.guilds.view');
        actionBtn.style.cssText = 'background: rgba(100, 181, 246, 0.3); border-color: rgba(100, 181, 246, 0.5);';
        actionBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const dialog = getOpenDialog();
          if (dialog) dialog.remove();
          await openGuildPanel(guild.id);
        });
      } else {
        const joinType = guild.joinType || GUILD_JOIN_TYPES.OPEN;
        if (joinType === GUILD_JOIN_TYPES.INVITE_ONLY) {
          actionBtn.textContent = t('mods.guilds.inviteOnly');
          actionBtn.style.cssText = 'background: rgba(128, 128, 128, 0.3); border-color: rgba(128, 128, 128, 0.5); opacity: 0.6;';
          actionBtn.disabled = true;
        } else {
          actionBtn.textContent = t('mods.guilds.join');
          actionBtn.style.cssText = 'background: rgba(76, 175, 80, 0.3); border-color: rgba(76, 175, 80, 0.5);';
          actionBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              await joinGuild(guild.id);
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
              await openGuildPanel();
            } catch (error) {
              showWarningModal(t('mods.guilds.error'), error.message);
              loadGuilds(searchInput.value);
            }
          });
        }
      }
      actionCell.appendChild(actionBtn);

      guildItem.appendChild(guildNameCell);
      guildItem.appendChild(memberCountCell);
      guildItem.appendChild(pointsCell);
      guildItem.appendChild(leaderCell);
      guildItem.appendChild(actionCell);

      guildsList.appendChild(guildItem);
    }
  }

  // Create header row
  const headerRow = document.createElement('div');
  headerRow.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 0;
    margin-bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    font-weight: 600;
    font-family: ${getFontFamily()};
    font-size: ${getFontSize('MD')};
    letter-spacing: 0.2px;
    width: 100%;
  `;
  
  // Store sort indicators for updating
  const sortIndicators = new Map();

  const createHeaderCell = (text, flex = '1', sortable = false, sortKey = null) => {
    const cell = document.createElement('div');
    cell.style.cssText = `
      flex: ${flex};
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      text-align: center;
      white-space: nowrap;
      position: relative;
      font-family: ${getFontFamily()};
      font-size: ${getFontSize('MD')};
      font-weight: 600;
      letter-spacing: 0.2px;
      ${sortable ? 'cursor: pointer; user-select: none;' : ''}
    `;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    cell.appendChild(textSpan);
    
    if (sortable) {
      const sortIndicator = document.createElement('span');
      sortIndicator.style.cssText = `
        margin-left: 4px;
        opacity: 0.6;
        font-size: 10px;
      `;
      cell.appendChild(sortIndicator);
      
      sortIndicators.set(sortKey, sortIndicator);
      
      const updateSortIndicator = () => {
        if (sortBy === sortKey) {
          sortIndicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
          sortIndicator.style.opacity = '1';
        } else {
          sortIndicator.textContent = '⇅';
          sortIndicator.style.opacity = '0.4';
        }
      };
      
      updateSortIndicator();
      
      cell.addEventListener('click', () => {
        if (sortBy === sortKey) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortBy = sortKey;
          sortDirection = 'asc';
        }
        
        // Update all sort indicators
        sortIndicators.forEach((indicator, key) => {
          if (key === sortBy) {
            indicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
            indicator.style.opacity = '1';
          } else {
            indicator.textContent = '⇅';
            indicator.style.opacity = '0.4';
          }
        });
        
        loadGuilds(searchInput ? searchInput.value : '', sortBy, sortDirection);
      });
    }
    
    return cell;
  };

  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnName'), '2 1 0%', true, 'name'));
  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnMembers'), '0.8 1 0%', true, 'members'));
  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnPoints'), '0.8 1 0%', true, 'points'));
  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnLeader'), '1.2 1 0%'));
  headerRow.appendChild(createHeaderCell('', '1 1 0%'));

  // Update all sort indicators to reflect default sort (points descending)
  sortIndicators.forEach((indicator, key) => {
    if (key === sortBy) {
      indicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
      indicator.style.opacity = '1';
    } else {
      indicator.textContent = '⇅';
      indicator.style.opacity = '0.4';
    }
  });

  const guildBox = createGuildBox({
    headerRow: headerRow,
    content: guildsList
  });
  guildBox.style.width = '100%';
  guildBox.style.height = '100%';
  guildBox.style.flex = '1 1 0';

  contentDiv.appendChild(guildBox);

  // Create search input for footer
  let searchInput = null;
  const setupFooter = (buttonContainer) => {
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;';

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'pixel-font-14';
    searchInput.placeholder = t('mods.guilds.searchPlaceholder');
    searchInput.style.cssText = `
      flex: 1 1 0%;
      min-width: 0px;
      max-width: 200px;
      padding: 2px 8px;
      background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
      border-width: 4px;
      border-style: solid;
      border-color: transparent;
      border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: ${getFontSize('XS')};
      font-family: ${getFontFamily()};
      text-align: left;
      box-sizing: border-box;
      max-height: 21px;
      height: 21px;
      line-height: normal;
    `;

    const createBtn = document.createElement('button');
    createBtn.textContent = t('mods.guilds.createGuildButton');
    createBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
    createBtn.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
    createBtn.addEventListener('click', () => {
      const dialog = getOpenDialog();
      if (dialog) dialog.remove();
      showCreateGuildDialog();
    });

    searchInput.addEventListener('input', (e) => {
      loadGuilds(e.target.value, sortBy, sortDirection);
    });

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(createBtn);
    buttonContainer.insertBefore(searchContainer, buttonContainer.firstChild);
  };

  const modal = api.ui.components.createModal({
    title: t('mods.guilds.browserTitle'),
    width: MODAL_DIMENSIONS.WIDTH,
    height: MODAL_DIMENSIONS.HEIGHT,
    content: contentDiv,
    buttons: [{
      text: t('mods.guilds.close'),
      primary: true,
      onClick: () => {}
    }]
  });

  setTimeout(async () => {
    const dialog = getOpenDialog();
    if (dialog) {
      applyModalStyles(dialog, MODAL_DIMENSIONS.WIDTH, MODAL_DIMENSIONS.HEIGHT);
      const buttonContainer = dialog.querySelector('.flex.justify-end.gap-2');
      if (buttonContainer) {
        setupFooter(buttonContainer);
        await loadGuilds('', sortBy, sortDirection);
        if (searchInput) searchInput.focus();
      }
    }
  }, 100);
}

async function showMemberManagementModal(guild, currentMember, targetMember) {
  const currentPlayer = validateCurrentPlayer();
  const isLeader = currentMember.role === GUILD_ROLES.LEADER;
  const isTargetSelf = targetMember.username.toLowerCase() === currentPlayer.toLowerCase();
  const canPromote = !isTargetSelf && isLeader && targetMember.role === GUILD_ROLES.MEMBER;
  const canDemote = !isTargetSelf && isLeader && targetMember.role === GUILD_ROLES.OFFICER;
  const canKick = !isTargetSelf && canPerformAction(currentMember.role, targetMember.role, 'kick');
  const canTransfer = !isTargetSelf && isLeader;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 8px;';

  const memberInfo = document.createElement('div');
  memberInfo.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 14px; margin-bottom: 8px;`;
  const roleKey = `mods.guilds.role${targetMember.role.charAt(0).toUpperCase() + targetMember.role.slice(1)}`;
  memberInfo.textContent = `${targetMember.username} (${t(roleKey)})`;
  modalContent.appendChild(memberInfo);

  if (canTransfer) {
    const transferBtn = createButton(t('mods.guilds.transferLeadership'), async () => {
      showConfirmModal(
        t('mods.guilds.transferLeadership'),
        tReplace('mods.guilds.transferLeadershipConfirm', { name: targetMember.username }),
        async () => {
          try {
            await transferLeadership(guild.id, targetMember.username);
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            showWarningModal(t('mods.guilds.success'), t('mods.guilds.leadershipTransferred'));
            await openGuildPanel();
          } catch (error) {
            showWarningModal(t('mods.guilds.error'), error.message);
          }
        }
      );
    }, { width: '100%', background: 'rgba(255, 193, 7, 0.3)' });
    modalContent.appendChild(transferBtn);
  }

  if (canPromote) {
    const promoteBtn = createButton(t('mods.guilds.promote'), async () => {
      try {
        await promoteMember(guild.id, targetMember.username);
        const dialog = getOpenDialog();
        if (dialog) dialog.remove();
        showWarningModal(t('mods.guilds.success'), tReplace('mods.guilds.promotedToOfficer', { name: targetMember.username }));
        await openGuildPanel();
      } catch (error) {
        showWarningModal(t('mods.guilds.error'), error.message);
      }
    }, { width: '100%' });
    modalContent.appendChild(promoteBtn);
  }

  if (canDemote) {
    const demoteBtn = createButton(t('mods.guilds.demote'), async () => {
      try {
        await demoteMember(guild.id, targetMember.username);
        const dialog = getOpenDialog();
        if (dialog) dialog.remove();
        showWarningModal(t('mods.guilds.success'), `${targetMember.username} ${t('mods.guilds.demote').toLowerCase()}d to ${t('mods.guilds.roleMember').toLowerCase()}`);
        await openGuildPanel();
      } catch (error) {
        showWarningModal(t('mods.guilds.error'), error.message);
      }
    }, { width: '100%' });
    modalContent.appendChild(demoteBtn);
  }

  if (canKick) {
    const kickBtn = createButton(t('mods.guilds.kick'), async () => {
      showConfirmModal(
        t('mods.guilds.kick'),
        tReplace('mods.guilds.kickConfirm', { name: targetMember.username }),
        async () => {
          try {
            await kickMember(guild.id, targetMember.username);
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            await openGuildPanel();
          } catch (error) {
            showWarningModal(t('mods.guilds.error'), error.message);
          }
        }
      );
    }, { width: '100%', background: 'rgba(255, 107, 107, 0.3)' });
    modalContent.appendChild(kickBtn);
  }

  if (!canTransfer && !canPromote && !canDemote && !canKick) {
    const noActionsMsg = document.createElement('div');
    noActionsMsg.textContent = t('mods.guilds.noActionsAvailable') || 'No actions available for this member.';
    noActionsMsg.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px; opacity: 0.7; text-align: center; padding: 8px;`;
    modalContent.appendChild(noActionsMsg);
  }

  const modal = api.ui.components.createModal({
    title: t('mods.guilds.manageMember') || 'Manage Member',
    width: 350,
    height: null,
    content: modalContent,
    buttons: [{
      text: t('mods.guilds.close') || 'Close',
      onClick: () => {
        const dialog = getOpenDialog();
        if (dialog) dialog.remove();
      }
    }]
  });

  setTimeout(() => {
    const dialog = getOpenDialog();
    if (dialog) {
      applyModalStyles(dialog, 350, null);
      
      // Add ESC key support to close modal
      setupEscKeyHandler(dialog, () => {
        dialog.remove();
      });
    }
  }, 100);
}

async function openGuildPanel(viewGuildId = null) {
  if (!ensureModalApi()) return;

  let guild, members, currentPlayer, currentMember;

  // If viewGuildId is provided, we're viewing as a non-member - skip membership checks
  if (viewGuildId) {
    guild = await getGuild(viewGuildId);
    if (!guild) {
      showWarningModal(t('mods.guilds.error'), t('mods.guilds.guildNotFound'));
      return;
    }
    members = await getGuildMembers(guild.id);
    currentPlayer = getCurrentPlayerName();
    currentMember = currentPlayer ? findMemberByUsername(members, currentPlayer) : null;
    // Show guild in view mode (will hide admin controls if currentMember is null)
  } else {
    // First, verify actual guild state from Firebase
    let verifiedGuild = null;
    currentPlayer = getCurrentPlayerName();
  try {
    if (currentPlayer) {
      const hashedPlayer = await hashUsername(currentPlayer);
      const playerGuildResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
      if (playerGuildResponse.ok) {
        const playerGuildData = await playerGuildResponse.json();
        if (playerGuildData && playerGuildData.guildId) {
          // Firebase says user is in a guild - verify it exists and user is actually a member
          const guild = await getGuild(playerGuildData.guildId);
          if (guild) {
            const members = await getGuildMembers(guild.id);
            const isActuallyMember = members.some(m => m.usernameHashed === hashedPlayer);
            if (isActuallyMember) {
              // User is actually a member - use this as truth
              verifiedGuild = guild;
              savePlayerGuild(guild); // Sync localStorage
            } else {
              // Firebase reference exists but user is not actually a member - clean up
              console.warn('[Guilds] Player has guild reference in Firebase but is not a member - cleaning up');
              await updatePlayerGuildReference(hashedPlayer, null, null);
              clearPlayerGuild();
            }
          } else {
            // Firebase reference exists but guild doesn't exist - clean up
            console.warn('[Guilds] Player has guild reference in Firebase but guild does not exist - cleaning up');
            await updatePlayerGuildReference(hashedPlayer, null, null);
            clearPlayerGuild();
          }
        } else {
          // Firebase says user is not in a guild - clear localStorage if it says otherwise
          const localGuild = getPlayerGuild();
          if (localGuild) {
            console.warn('[Guilds] localStorage has guild but Firebase does not - clearing localStorage');
            clearPlayerGuild();
          }
        }
      } else if (playerGuildResponse.status === 404) {
        // No Firebase reference - clear localStorage if it says otherwise
        const localGuild = getPlayerGuild();
        if (localGuild) {
          console.warn('[Guilds] localStorage has guild but Firebase does not - clearing localStorage');
          clearPlayerGuild();
        }
      }
    }
    } catch (error) {
      console.error('[Guilds] Error verifying guild state from Firebase:', error);
      // Fall back to localStorage check if Firebase check fails
      verifiedGuild = getPlayerGuild();
    }

    // Use verified guild (from Firebase) or fall back to localStorage
    const playerGuild = verifiedGuild || getPlayerGuild();
    if (!playerGuild) {
      const invites = await getPlayerInvites();
      if (invites.length > 0) {
        showInvitesDialog();
        return;
      }
      showGuildBrowser();
      return;
    }

    guild = await getGuild(playerGuild.id);
    if (!guild) {
      clearPlayerGuild();
      showGuildBrowser();
      return;
    }
    members = await getGuildMembers(guild.id);
    currentMember = currentPlayer ? members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase()) : null;
  }
  
  // Final verification - if user is not actually a member, redirect to browser (unless viewing)
  if (!currentMember && !viewGuildId) {
    if (!currentPlayer) {
      console.warn('[Guilds] No current player - redirecting to browser');
      showGuildBrowser();
      return;
    }
    console.warn('[Guilds] Player has guild in localStorage but is not a member - redirecting to browser');
    await updatePlayerGuildReference(await hashUsername(currentPlayer), null, null);
    clearPlayerGuild();
    showGuildBrowser();
    return;
  }

  const contentDiv = document.createElement('div');
  contentDiv.style.width = '100%';
  contentDiv.style.flex = '1 1 0';
  contentDiv.style.minHeight = '0';
  contentDiv.style.boxSizing = 'border-box';
  contentDiv.style.overflow = 'hidden';
  contentDiv.style.display = 'flex';
  contentDiv.style.flexDirection = 'row';
  contentDiv.style.gap = '8px';

  const leftPanel = document.createElement('div');
  leftPanel.style.cssText = `
    width: 200px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_4_FRAME};
    border-radius: 6px;
    overflow: hidden;
  `;

  const membersHeader = document.createElement('h2');
  membersHeader.className = 'widget-top widget-top-text';
  membersHeader.style.cssText = `
    margin: 0;
    padding: 8px;
    text-align: center;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 14px;
    font-weight: 600;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  `;
  membersHeader.textContent = tReplace('mods.guilds.membersHeader', { count: members.length, max: GUILD_CONFIG.maxMembers });
  leftPanel.appendChild(membersHeader);

  const membersList = document.createElement('div');
  membersList.className = 'column-content-wrapper';
  membersList.style.cssText = `
    flex: 1 1 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 3px;
  `;

  // Calculate points for all members first, then sort
  const membersWithPoints = await Promise.all(members.map(async (member) => {
    const pointsData = await calculateMemberPoints(member.username);
    return {
      ...member,
      _points: pointsData.total
    };
  }));

  // Sort members by role (Leader > Officer > Member), then by points (descending), then by name
  const rolePriority = {
    [GUILD_ROLES.LEADER]: 0,
    [GUILD_ROLES.OFFICER]: 1,
    [GUILD_ROLES.MEMBER]: 2
  };
  
  const sortedMembers = membersWithPoints.sort((a, b) => {
    // First sort by role
    const roleDiff = (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
    if (roleDiff !== 0) {
      return roleDiff;
    }
    // Then sort by points (descending - higher points first)
    const pointsDiff = (b._points || 0) - (a._points || 0);
    if (pointsDiff !== 0) {
      return pointsDiff;
    }
    // Finally sort by name (case-insensitive)
    return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase());
  });

  sortedMembers.forEach(member => {
    const memberItem = document.createElement('div');
    memberItem.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 6px 6px;
      margin-bottom: 3px;
      background: rgba(255, 255, 255, 0.05);
      width: 100%;
      border-radius: 2px;
      gap: 4px;
      font-family: ${getFontFamily()};
    `;

    // Top row: member info and points
    const topRow = document.createElement('div');
    topRow.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
    `;

    const memberInfo = document.createElement('div');
    memberInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
      position: relative;
      font-family: ${getFontFamily()};
    `;
    
    // Create wrapper for name button and dropdown
    const nameWrapper = document.createElement('div');
    nameWrapper.style.cssText = `
      position: relative;
      display: inline-block;
      width: fit-content;
      z-index: 1;
    `;
    
    // Create clickable name button
    const memberName = document.createElement('button');
    const nameText = member.username;
    const isCurrentPlayer = member.username.toLowerCase() === currentPlayer.toLowerCase();
    const displayText = isCurrentPlayer
      ? nameText + ' ' + t('mods.guilds.youSuffix')
      : nameText;
    memberName.textContent = displayText;
    
    // Disable button for current player
    if (isCurrentPlayer) {
      memberName.disabled = true;
      memberName.style.cssText = `
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        background: transparent;
        border: none;
        padding: 0;
        cursor: default;
        text-decoration: none;
        font-family: inherit;
        opacity: 0.8;
      `;
    } else {
      memberName.style.cssText = `
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-color: rgba(230, 215, 176, 0.6);
        text-underline-offset: 2px;
        font-family: inherit;
      `;
      
      // Add hover effect only for non-current players
      memberName.addEventListener('mouseenter', () => {
        memberName.style.textDecorationColor = CSS_CONSTANTS.COLORS.TEXT_PRIMARY;
      });
      memberName.addEventListener('mouseleave', () => {
        memberName.style.textDecorationColor = 'rgba(230, 215, 176, 0.6)';
      });
      
      // Create dropdown menu only for non-current players
      const dropdown = createDropdownElement();
      
      // Get profile URL (use lowercase username)
      const profileUrl = member.username.toLowerCase();
      
      // Add Profile dropdown item
      dropdown.appendChild(createDropdownItem(t('mods.vipList.dropdownProfile') || 'Profile', () => {
        window.open(`/profile/${profileUrl}`, '_blank');
      }, dropdown, { fontSize: '13px' }));
      
      // Add Cyclopedia dropdown item (with data attribute to prevent Cyclopedia mod from hiding it)
      const cyclopediaMenuItem = createDropdownItem(t('mods.vipList.dropdownCyclopedia') || 'Cyclopedia', () => {
        openCyclopediaForPlayer(member.username);
      }, dropdown, {
        fontSize: '13px',
        dataAttributes: {
          'data-cyclopedia-exclude': 'true'
        }
      });
      cyclopediaMenuItem.style.display = '';
      dropdown.appendChild(cyclopediaMenuItem);
      
      // Add Equipment dropdown item
      dropdown.appendChild(createDropdownItem(t('mods.guilds.dropdownEquipment') || 'Equipment', () => {
        showPlayerEquipmentModal(member.username);
      }, dropdown, { fontSize: '13px' }));
      
      // Add click handler to toggle dropdown
      memberName.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const container = findDropdownContainer(memberItem);
        toggleDropdown(dropdown, memberName, container || membersList);
      });
      
      nameWrapper.appendChild(dropdown);
    }
    
    nameWrapper.appendChild(memberName);
    
    const memberRole = document.createElement('span');
    const roleKey = `mods.guilds.role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`;
    memberRole.textContent = t(roleKey);
    
    // Get role color
    let roleColor = CSS_CONSTANTS.COLORS.ROLE_MEMBER;
    if (member.role === GUILD_ROLES.LEADER) {
      roleColor = CSS_CONSTANTS.COLORS.ROLE_LEADER;
    } else if (member.role === GUILD_ROLES.OFFICER) {
      roleColor = CSS_CONSTANTS.COLORS.ROLE_OFFICER;
    }
    
    memberRole.style.cssText = `
      font-size: ${getFontSize('XS')};
      opacity: 0.9;
      color: ${roleColor};
      line-height: 1.2;
      font-weight: 500;
      font-family: ${getFontFamily()};
    `;
    
    memberInfo.appendChild(nameWrapper);
    memberInfo.appendChild(memberRole);
    topRow.appendChild(memberInfo);

    // Add points display with tooltip
    const pointsContainer = document.createElement('div');
    pointsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      margin-left: 6px;
      position: relative;
    `;

    const pointsDisplay = document.createElement('div');
    const memberPoints = member._points !== undefined ? member._points : 0;
    pointsDisplay.textContent = formatNumber(memberPoints);
    pointsDisplay.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
      font-size: 11px;
      font-weight: 600;
      cursor: help;
      min-width: 40px;
      text-align: right;
      font-family: ${getFontFamily()};
    `;

    // Create tooltip with game-native styling
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: fixed;
      padding: 8px 10px;
      background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
      border-width: 4px;
      border-style: solid;
      border-color: transparent;
      border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 11px;
      white-space: nowrap;
      z-index: 10002;
      display: none;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
      font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
    `;
    document.body.appendChild(tooltip);

    // Recalculate for tooltip (to get detailed breakdown)
    calculateMemberPoints(member.username).then(pointsData => {
      // Update display if points changed (shouldn't happen, but just in case)
      if (pointsData.total !== memberPoints) {
        pointsDisplay.textContent = formatNumber(pointsData.total);
      }
      
      // Build tooltip content with game-native styling
      const tooltipContent = document.createElement('div');
      tooltipContent.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
      
      const title = document.createElement('div');
      title.textContent = `${member.username}'s Points`;
      title.style.cssText = `
        font-weight: 600;
        font-size: 12px;
        margin-bottom: 2px;
        border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 6px;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
      `;
      tooltipContent.appendChild(title);
      
      const addDetail = (label, value, color = CSS_CONSTANTS.COLORS.TEXT_WHITE) => {
        const detail = document.createElement('div');
        detail.style.cssText = `
          display: flex;
          justify-content: space-between;
          gap: 16px;
          color: ${color};
          font-size: 11px;
          line-height: 1.4;
        `;
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        labelSpan.style.opacity = '0.9';
        const valueSpan = document.createElement('span');
        valueSpan.textContent = value;
        valueSpan.style.fontWeight = '600';
        valueSpan.style.color = color;
        detail.appendChild(labelSpan);
        detail.appendChild(valueSpan);
        tooltipContent.appendChild(detail);
      };
      
      addDetail('Level Points', `+${pointsData.levelPoints}`, CSS_CONSTANTS.COLORS.SUCCESS);
      addDetail(`  (Level ${pointsData.level})`, ``, 'rgba(255, 255, 255, 0.6)');
      addDetail('Rank Points', `+${pointsData.rankPoints}`, '#64b5f6');
      addDetail(`  (${formatNumber(pointsData.rankPointsValue)} total, every ${POINTS_CONFIG.RANK_POINTS_PER_POINT} = 1 pt)`, ``, 'rgba(255, 255, 255, 0.6)');
      if (pointsData.floorPoints > 0) {
        addDetail(t('mods.guilds.equipment.floorPoints') || 'Floor Points', `+${pointsData.floorPoints}`, '#ba68c8');
        addDetail(`  (${tReplace('mods.guilds.equipment.floorPointsDescription', { floors: formatNumber(pointsData.floors) }) || `${formatNumber(pointsData.floors)} floors, 1 floor = 1 pt`})`, ``, 'rgba(255, 255, 255, 0.6)');
      }
      if (pointsData.equipmentPoints > 0) {
        addDetail(t('mods.guilds.equipment.equipmentPoints') || 'Equipment Points', `+${pointsData.equipmentPoints}`, '#81c784');
        addDetail(`  (Sum of equipped item tiers)`, ``, 'rgba(255, 255, 255, 0.6)');
      }
      addDetail('Time Penalty', `-${pointsData.timeSumPenalty}`, CSS_CONSTANTS.COLORS.ERROR);
      addDetail(`  (${formatNumber(pointsData.timeSum)} ticks, every ${POINTS_CONFIG.TIME_SUM_PENALTY_DIVISOR} = -1 pt)`, ``, 'rgba(255, 255, 255, 0.6)');
      
      if (pointsData.hasWorldRecord) {
        const wrNote = document.createElement('div');
        wrNote.textContent = '⭐ Holds World Record';
        wrNote.style.cssText = `
          color: ${CSS_CONSTANTS.COLORS.ROLE_LEADER};
          font-weight: 600;
          margin-top: 2px;
          padding-top: 6px;
          border-top: 2px solid rgba(255, 255, 255, 0.2);
          font-size: 11px;
        `;
        tooltipContent.appendChild(wrNote);
      }
      
      const total = document.createElement('div');
      total.style.cssText = `
        margin-top: 2px;
        padding-top: 6px;
        border-top: 2px solid rgba(255, 255, 255, 0.3);
        font-weight: 600;
        font-size: 12px;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
      `;
      total.textContent = `Total: ${formatNumber(pointsData.total)}`;
      tooltipContent.appendChild(total);
      
      tooltip.appendChild(tooltipContent);
    }).catch(() => {
      pointsDisplay.textContent = '0';
    });

    // Show/hide tooltip on hover with smart positioning
    let tooltipTimeout;
    const updateTooltipPosition = () => {
      const rect = pointsContainer.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const spacing = 8;
      
      // Calculate available space above and below
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const tooltipHeight = tooltipRect.height + spacing;
      
      // Position vertically: choose direction with more space
      if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
        // Position below (more space below or equal)
        tooltip.style.top = `${rect.bottom + spacing}px`;
        tooltip.style.bottom = 'auto';
      } else {
        // Position above (more space above)
        tooltip.style.bottom = `${window.innerHeight - rect.top + spacing}px`;
        tooltip.style.top = 'auto';
      }
      
      // Position horizontally: always align to right edge of container
      tooltip.style.left = `${rect.right}px`;
      tooltip.style.right = 'auto';
      tooltip.style.transform = 'translateX(-100%)';
    };
    
    pointsDisplay.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimeout);
      tooltip.style.display = 'block';
      // Use requestAnimationFrame to ensure tooltip is rendered before calculating position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateTooltipPosition();
        });
      });
    });
    pointsDisplay.addEventListener('mouseleave', () => {
      tooltipTimeout = setTimeout(() => {
        tooltip.style.display = 'none';
      }, 100);
    });
    tooltip.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimeout);
    });
    tooltip.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    pointsContainer.appendChild(pointsDisplay);
    topRow.appendChild(pointsContainer);
    memberItem.appendChild(topRow);

    if (currentMember && member.username.toLowerCase() !== currentPlayer.toLowerCase()) {
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-top: 2px;';

      const isLeader = currentMember.role === GUILD_ROLES.LEADER;
      const canPromote = isLeader && member.role === GUILD_ROLES.MEMBER;
      const canDemote = isLeader && member.role === GUILD_ROLES.OFFICER;
      const canKick = canPerformAction(currentMember.role, member.role, 'kick');
      const canTransfer = isLeader;
      const hasAnyAction = canPromote || canDemote || canKick || canTransfer;

      if (hasAnyAction) {
        const editBtn = createButton(t('mods.guilds.edit') || 'Edit', async () => {
          await showMemberManagementModal(guild, currentMember, member);
        }, { background: 'rgba(100, 181, 246, 0.3)', padding: '2px 6px', fontSize: '10px' });
        buttonContainer.appendChild(editBtn);
      }

      if (canKick) {
        const kickBtn = createButton(t('mods.guilds.kick'), async () => {
          showConfirmModal(
            t('mods.guilds.kick'),
            tReplace('mods.guilds.kickConfirm', { name: member.username }),
            async () => {
              try {
                await kickMember(guild.id, member.username);
                const dialog = getOpenDialog();
                if (dialog) dialog.remove();
                await openGuildPanel();
              } catch (error) {
                showWarningModal(t('mods.guilds.error'), error.message);
              }
            }
          );
        }, { background: 'rgba(255, 107, 107, 0.3)', padding: '2px 6px', fontSize: '10px' });
        buttonContainer.appendChild(kickBtn);
      }

      if (buttonContainer.children.length > 0) {
        memberItem.appendChild(buttonContainer);
      }
    }

    membersList.appendChild(memberItem);
  });

  if (currentMember && hasPermission(currentMember.role, 'invite')) {
    const inviteBtn = createButton('+ ' + t('mods.guilds.invitePlayerTitle'), async () => {
      const inviteModal = api.ui.components.createModal({
        title: t('mods.guilds.invitePlayerTitle'),
        width: 400,
        height: null,
        content: (() => {
          const modalContent = document.createElement('div');
          modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 8px;';
          
          const label = document.createElement('label');
          label.textContent = t('mods.guilds.playerNameLabel');
          label.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
          
          const input = createStyledInput({
            type: 'text',
            placeholder: t('mods.guilds.playerNamePlaceholder'),
            style: { fontSize: '12px', padding: '4px 8px' }
          });
          
          modalContent.appendChild(label);
          modalContent.appendChild(input);
          
          return modalContent;
        })(),
        buttons: [
          {
            text: t('mods.guilds.back'),
            onClick: async () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
              await openGuildPanel();
            }
          },
          {
            text: t('mods.guilds.sendInvite'),
            primary: true,
            onClick: async () => {
              const dialog = getOpenDialog();
              const input = dialog.querySelector('input[type="text"]');
              if (!input || !input.value.trim()) {
                const errorDialog = getOpenDialog();
                if (errorDialog) errorDialog.remove();
                showWarningModal(t('mods.guilds.error'), t('mods.guilds.enterPlayerName'));
                return;
              }
              
              try {
                await invitePlayer(guild.id, input.value.trim());
                const currentDialog = getOpenDialog();
                if (currentDialog) currentDialog.remove();
                // Refresh invite list in guild panel if it's open
                const guildPanel = document.querySelector('.guild-invited-players-container');
                if (guildPanel && guildPanel.refreshInvites) {
                  await guildPanel.refreshInvites();
                }
                const mainDialog = getOpenDialog();
                if (mainDialog) mainDialog.remove();
                showWarningModal(t('mods.guilds.success'), tReplace('mods.guilds.inviteSent', { name: input.value.trim() }));
                // Refresh the panel to show the new invite
                await openGuildPanel();
              } catch (error) {
                const errorDialog = getOpenDialog();
                if (errorDialog) errorDialog.remove();
                // Show user-friendly message - expected validation errors are not logged as errors
                const message = error.message || t('mods.guilds.error');
                showWarningModal(t('mods.guilds.error'), message);
              }
            }
          }
        ]
      });
      
      setTimeout(() => {
        const dialog = getOpenDialog();
        if (dialog) {
          applyModalStyles(dialog, 400, null);
          const input = dialog.querySelector('input[type="text"]');
          if (input) {
            input.focus();
          }
        }
      }, 100);
    }, { width: '100%', marginTop: '8px' });
    membersList.appendChild(inviteBtn);
    
    // Display invited players
    const invitedPlayersContainer = document.createElement('div');
    invitedPlayersContainer.className = 'guild-invited-players-container';
    invitedPlayersContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 8px;';
    
    async function loadInvitedPlayers() {
      try {
        invitedPlayersContainer.innerHTML = '';
        const invites = await getGuildInvites(guild.id);
        const members = await getGuildMembers(guild.id);
        const memberHashes = new Set(members.map(m => m.usernameHashed));
        
        // Filter out invites for players who are already members
        const pendingInvites = invites.filter(invite => invite && invite.playerNameHashed && !memberHashes.has(invite.playerNameHashed));
        
        if (pendingInvites.length === 0) {
          return;
        }
      
      const title = document.createElement('div');
      title.textContent = t('mods.guilds.invitedPlayers');
      title.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 11px; opacity: 0.7; margin-bottom: 4px;`;
      invitedPlayersContainer.appendChild(title);
      
      pendingInvites.forEach(async (invite) => {
        const inviteItem = document.createElement('div');
        inviteItem.style.cssText = `
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 6px 8px;
          margin-bottom: 2px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 2px;
        `;
        
        const playerInfo = document.createElement('div');
        playerInfo.style.cssText = 'flex: 1 1 0%; display: flex; flex-direction: column;';
        
        const playerName = document.createElement('span');
        playerName.textContent = invite.playerName;
        playerName.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 11px;`;
        
        const invitedBy = document.createElement('span');
        invitedBy.textContent = tReplace('mods.guilds.invitedBy', { name: invite.invitedBy });
        invitedBy.style.cssText = `font-size: 9px; opacity: 0.6; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; margin-top: 2px;`;
        
        playerInfo.appendChild(playerName);
        playerInfo.appendChild(invitedBy);
        inviteItem.appendChild(playerInfo);
        
        // Add remove button if user has invite permission
        if (currentMember && hasPermission(currentMember.role, 'invite')) {
          const removeBtn = document.createElement('button');
          removeBtn.textContent = '×';
          removeBtn.style.cssText = `
            background: rgba(255, 107, 107, 0.3);
            border: 1px solid rgba(255, 107, 107, 0.5);
            color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
            width: 20px;
            height: 20px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            flex-shrink: 0;
          `;
          removeBtn.title = t('mods.guilds.removeInvite');
          removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              await removeInviteFromFirebase(guild.id, invite.playerNameHashed);
              // Post system message
              await sendGuildSystemMessage(guild.id, `${currentPlayer} cancelled the invite for ${invite.playerName}`);
              // Refresh invite list
              await loadInvitedPlayers();
            } catch (error) {
              console.error('[Guilds] Error removing invite:', error);
              showWarningModal(t('mods.guilds.error'), error.message || t('mods.guilds.failedToRemoveInvite'));
            }
          });
          inviteItem.appendChild(removeBtn);
        }
        
        invitedPlayersContainer.appendChild(inviteItem);
      });
      } catch (error) {
        console.error('[Guilds] Error loading invited players:', error);
      }
    }
    
    // Store refresh function on container for external access
    invitedPlayersContainer.refreshInvites = loadInvitedPlayers;
    
    await loadInvitedPlayers();
    membersList.appendChild(invitedPlayersContainer);
  }

  leftPanel.appendChild(membersList);
  contentDiv.appendChild(leftPanel);

  const rightPanel = document.createElement('div');
  rightPanel.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_4_FRAME};
    border-radius: 6px;
    overflow: hidden;
  `;

  const adminHeader = document.createElement('h2');
  adminHeader.className = 'widget-top widget-top-text';
  adminHeader.style.cssText = `
    margin: 0;
    padding: 8px;
    text-align: center;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 14px;
    font-weight: 600;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  `;
  adminHeader.textContent = t('mods.guilds.administration');
  rightPanel.appendChild(adminHeader);

  const adminContainer = document.createElement('div');
  adminContainer.style.cssText = `
    flex: 1 1 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 8px;
  `;

  const isLeader = currentMember && currentMember.role === GUILD_ROLES.LEADER;

  // Guild Points (visible to all members) - at top
  const pointsSection = document.createElement('div');
  pointsSection.style.cssText = `
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    padding: 8px;
    gap: 6px;
  `;
  
  const pointsLabel = document.createElement('label');
  pointsLabel.textContent = t('mods.guilds.guildPoints');
  pointsLabel.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  
  const pointsValueContainer = document.createElement('div');
  pointsValueContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.1));
    border: 2px solid rgba(255, 215, 0, 0.3);
    border-radius: 3px;
    justify-content: center;
  `;
  
  const pointsIcon = document.createElement('span');
  pointsIcon.textContent = '⭐';
  pointsIcon.style.cssText = 'font-size: 14px;';
  
  const currentPoints = document.createElement('div');
  currentPoints.textContent = '...';
  currentPoints.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-shadow: 0 0 6px rgba(255, 215, 0, 0.5);
  `;
  
  // Calculate and display points
  calculateGuildPoints(guild.id).then(points => {
    currentPoints.textContent = formatNumber(points);
  }).catch(() => {
    currentPoints.textContent = '0';
  });
  
  pointsValueContainer.appendChild(pointsIcon);
  pointsValueContainer.appendChild(currentPoints);
  
  pointsSection.appendChild(pointsLabel);
  pointsSection.appendChild(pointsValueContainer);
  adminContainer.appendChild(pointsSection);

  // Change Description (Leader only)
  if (isLeader) {
    const descSection = document.createElement('div');
    descSection.style.cssText = `
      display: flex;
      flex-direction: column;
      background: rgba(0, 0, 0, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 8px;
      gap: 6px;
    `;
    
    const descLabel = document.createElement('label');
    descLabel.textContent = t('mods.guilds.description');
    descLabel.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    
    const currentDesc = document.createElement('div');
    currentDesc.textContent = guild.description || t('mods.guilds.noDescription');
    currentDesc.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 12px;
      opacity: 0.9;
      padding: 6px;
      min-height: 30px;
      word-wrap: break-word;
      line-height: 1.4;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    `;
    
    const descBtn = createButton(t('mods.guilds.editDescription'), async () => {
      const editModal = api.ui.components.createModal({
        title: t('mods.guilds.editDescription'),
        width: 450,
        height: null,
        content: (() => {
          const modalContent = document.createElement('div');
          modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 8px;';
          
          const label = document.createElement('label');
          label.textContent = t('mods.guilds.description');
          label.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
          
          const textarea = createStyledInput({
            type: 'textarea',
            placeholder: t('mods.guilds.descriptionPlaceholder'),
            maxLength: GUILD_CONFIG.maxGuildDescriptionLength,
            style: { fontSize: '12px', padding: '4px 8px', minHeight: '120px' }
          });
          textarea.value = guild.description || '';
          
          const charCount = document.createElement('div');
          charCount.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 10px; opacity: 0.7; text-align: right;`;
          charCount.textContent = `${textarea.value.length}/${GUILD_CONFIG.maxGuildDescriptionLength}`;
          
          textarea.addEventListener('input', () => {
            charCount.textContent = `${textarea.value.length}/${GUILD_CONFIG.maxGuildDescriptionLength}`;
          });
          
          modalContent.appendChild(label);
          modalContent.appendChild(textarea);
          modalContent.appendChild(charCount);
          
          return modalContent;
        })(),
        buttons: [
          {
            text: t('mods.guilds.back'),
            onClick: async () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
              await openGuildPanel();
            }
          },
          {
            text: t('common.save'),
            primary: true,
            onClick: async () => {
              const dialog = getOpenDialog();
              const textarea = dialog.querySelector('textarea');
              if (!textarea) return;
              
              try {
                await updateGuildDescription(guild.id, textarea.value);
                dialog.remove();
                const mainDialog = getOpenDialog();
                if (mainDialog) mainDialog.remove();
                
                // Show success modal
                const successContent = document.createElement('div');
                successContent.style.cssText = `
                  color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
                  font-size: 14px;
                  padding: 8px;
                  text-align: center;
                `;
                successContent.textContent = t('mods.guilds.descriptionUpdated');
                
                const successModal = api.ui.components.createModal({
                  title: t('mods.guilds.success'),
                  width: 400,
                  height: null,
                  content: successContent,
                  buttons: [{
                    text: 'OK',
                    primary: true,
                    onClick: async () => {
                      const successDialog = getOpenDialog();
                      if (successDialog) successDialog.remove();
                      await openGuildPanel();
                    }
                  }]
                });
                
                setTimeout(() => {
                  const successDialog = getOpenDialog();
                  if (successDialog) {
                    applyModalStyles(successDialog, 400, null);
                  }
                }, 100);
              } catch (error) {
                const errorDialog = getOpenDialog();
                if (errorDialog) errorDialog.remove();
                showWarningModal(t('mods.guilds.error'), error.message);
              }
            }
          }
        ]
      });
      
      setTimeout(() => {
        const dialog = getOpenDialog();
        if (dialog) {
          applyModalStyles(dialog, 450, null);
          const textarea = dialog.querySelector('textarea');
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
          }
        }
      }, 100);
    }, { width: '100%' });
    
    descSection.appendChild(descLabel);
    descSection.appendChild(currentDesc);
    descSection.appendChild(descBtn);
    adminContainer.appendChild(descSection);

    // Join Type setting (Leader only)
    const joinTypeSection = document.createElement('div');
    joinTypeSection.style.cssText = `
      display: flex;
      flex-direction: column;
      background: rgba(0, 0, 0, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 8px;
      gap: 6px;
    `;
    
    const joinTypeLabel = document.createElement('label');
    joinTypeLabel.textContent = t('mods.guilds.joinTypeLabel');
    joinTypeLabel.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    
    const currentJoinType = document.createElement('div');
    const joinType = guild.joinType || GUILD_JOIN_TYPES.OPEN;
    const joinTypeText = joinType === GUILD_JOIN_TYPES.OPEN 
      ? t('mods.guilds.joinTypeOpen') 
      : t('mods.guilds.joinTypeInviteOnly');
    
    const joinTypeBadge = document.createElement('span');
    joinTypeBadge.textContent = joinType === GUILD_JOIN_TYPES.OPEN ? '🌐' : '🔒';
    joinTypeBadge.style.cssText = 'font-size: 12px; margin-right: 5px;';
    
    const joinTypeTextSpan = document.createElement('span');
    joinTypeTextSpan.textContent = joinTypeText;
    
    currentJoinType.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 12px;
      font-weight: 500;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      display: flex;
      align-items: center;
    `;
    
    currentJoinType.appendChild(joinTypeBadge);
    currentJoinType.appendChild(joinTypeTextSpan);
    
    const joinTypeBtn = createButton(t('mods.guilds.changeJoinType'), async () => {
      let selectedJoinType = joinType;
      
      const editModal = api.ui.components.createModal({
        title: t('mods.guilds.changeJoinType'),
        width: 400,
        height: null,
        content: (() => {
          const modalContent = document.createElement('div');
          modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 8px;';
          
          const label = document.createElement('label');
          label.textContent = t('mods.guilds.joinTypeLabel');
          label.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
          
          // Create dropdown button container (must be position: relative for absolute positioning)
          const dropdownContainer = document.createElement('div');
          dropdownContainer.style.cssText = 'position: relative; width: 100%;';
          dropdownContainer.style.position = 'relative';
          
          // Create dropdown button
          const dropdownButton = document.createElement('button');
          dropdownButton.type = 'button';
          dropdownButton.className = 'pixel-font-14';
          dropdownButton.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
            border-width: 4px;
            border-style: solid;
            border-color: transparent;
            border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
            color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
            font-size: 14px;
            min-height: 35px;
            height: auto;
            line-height: 1.4;
            box-sizing: border-box;
            text-align: left;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `;
          
          const buttonText = document.createElement('span');
          buttonText.textContent = selectedJoinType === GUILD_JOIN_TYPES.OPEN 
            ? t('mods.guilds.joinTypeOpen') 
            : t('mods.guilds.joinTypeInviteOnly');
          
          const buttonArrow = document.createElement('span');
          buttonArrow.textContent = '▼';
          buttonArrow.style.cssText = 'font-size: 10px; opacity: 0.7; margin-left: 8px;';
          
          dropdownButton.appendChild(buttonText);
          dropdownButton.appendChild(buttonArrow);
          
          // Create dropdown menu
          const dropdown = createDropdownElement();
          
          const openOption = createDropdownItem(t('mods.guilds.joinTypeOpen'), () => {
            selectedJoinType = GUILD_JOIN_TYPES.OPEN;
            buttonText.textContent = t('mods.guilds.joinTypeOpen');
            resetDropdownStyles(dropdown);
          }, dropdown, {
            selected: selectedJoinType === GUILD_JOIN_TYPES.OPEN
          });
          
          const inviteOnlyOption = createDropdownItem(t('mods.guilds.joinTypeInviteOnly'), () => {
            selectedJoinType = GUILD_JOIN_TYPES.INVITE_ONLY;
            buttonText.textContent = t('mods.guilds.joinTypeInviteOnly');
            resetDropdownStyles(dropdown);
          }, dropdown, {
            selected: selectedJoinType === GUILD_JOIN_TYPES.INVITE_ONLY
          });
          
          dropdown.appendChild(openOption);
          dropdown.appendChild(inviteOnlyOption);
          
          // Handle button click
          dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = findDropdownContainer(dropdownButton) || modalContent;
            toggleDropdown(dropdown, dropdownButton, container);
          });
          
          dropdownContainer.appendChild(dropdownButton);
          dropdownContainer.appendChild(dropdown);
          
          modalContent.appendChild(label);
          modalContent.appendChild(dropdownContainer);
          
          // Close dropdown when clicking outside or pressing ESC
          const handleClickOutside = (e) => {
            if (!dropdownContainer.contains(e.target) && dropdown.style.display === 'block') {
              resetDropdownStyles(dropdown);
            }
          };
          
          const handleEsc = (e) => {
            if ((e.key === 'Escape' || e.keyCode === 27) && dropdown.style.display === 'block') {
              resetDropdownStyles(dropdown);
            }
          };
          
          setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleEsc);
            // Clean up on modal close
            const dialog = getOpenDialog();
            if (dialog) {
              const observer = new MutationObserver(() => {
                if (!document.contains(dialog)) {
                  document.removeEventListener('click', handleClickOutside);
                  document.removeEventListener('keydown', handleEsc);
                  observer.disconnect();
                }
              });
              observer.observe(document.body, { childList: true, subtree: true });
            }
          }, 100);
          
          return modalContent;
        })(),
        buttons: [
          {
            text: t('mods.guilds.back'),
            onClick: async () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
              await openGuildPanel();
            }
          },
          {
            text: t('common.save'),
            primary: true,
            onClick: async () => {
              const dialog = getOpenDialog();
              try {
                await updateGuildJoinType(guild.id, selectedJoinType);
                if (dialog) dialog.remove();
                const mainDialog = getOpenDialog();
                if (mainDialog) mainDialog.remove();
                
                // Show success modal
                const successContent = document.createElement('div');
                successContent.style.cssText = `
                  color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
                  font-size: 14px;
                  padding: 8px;
                  text-align: center;
                `;
                successContent.textContent = t('mods.guilds.joinTypeUpdated');
                
                const successModal = api.ui.components.createModal({
                  title: t('mods.guilds.success'),
                  width: 400,
                  height: null,
                  content: successContent,
                  buttons: [{
                    text: 'OK',
                    primary: true,
                    onClick: async () => {
                      const successDialog = getOpenDialog();
                      if (successDialog) successDialog.remove();
                      await openGuildPanel();
                    }
                  }]
                });
                
                setTimeout(() => {
                  const successDialog = getOpenDialog();
                  if (successDialog) {
                    applyModalStyles(successDialog, 400, null);
                  }
                }, 100);
              } catch (error) {
                const errorDialog = getOpenDialog();
                if (errorDialog) errorDialog.remove();
                showWarningModal(t('mods.guilds.error'), error.message);
              }
            }
          }
        ]
      });
      
      setTimeout(() => {
        const dialog = getOpenDialog();
        if (dialog) {
          applyModalStyles(dialog, 400, null);
        }
      }, 100);
    }, { width: '100%' });
    
    joinTypeSection.appendChild(joinTypeLabel);
    joinTypeSection.appendChild(currentJoinType);
    joinTypeSection.appendChild(joinTypeBtn);
    adminContainer.appendChild(joinTypeSection);
  }

  // Delete Guild (Leader only, when they are the only member)
  if (isLeader && members.length === 1) {
    const deleteSection = document.createElement('div');
    deleteSection.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 8px;';
    
    const deleteBtn = createButton(t('mods.guilds.deleteGuild'), async () => {
      const confirmModal = api.ui.components.createModal({
        title: t('mods.guilds.deleteGuild'),
        width: 450,
        height: null,
        content: (() => {
          const modalContent = document.createElement('div');
          modalContent.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 8px;';
          
          const warningText = document.createElement('div');
          warningText.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 13px; line-height: 1.5;`;
          warningText.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: 600; color: rgba(255, 107, 107, 1);">${t('mods.guilds.deleteGuildWarning')}</div>
            <div style="margin-bottom: 8px;">${tReplace('mods.guilds.deleteGuildMessage', { name: guild.name })}</div>
            <div>${t('mods.guilds.deleteGuildWillDelete')}</div>
            <ul style="margin: 8px 0; padding-left: 20px; opacity: 0.9;">
              <li>${t('mods.guilds.deleteGuildData')}</li>
              <li>${t('mods.guilds.deleteGuildChat')}</li>
              <li>${t('mods.guilds.deleteGuildMembers')}</li>
              <li>${t('mods.guilds.deleteGuildInvites')}</li>
            </ul>
            <div style="font-weight: 600; color: rgba(255, 107, 107, 1);">${t('mods.guilds.deleteGuildConfirm')}</div>
          `;
          
          modalContent.appendChild(warningText);
          
          return modalContent;
        })(),
        buttons: [
          {
            text: t('mods.guilds.back'),
            onClick: async () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
              await openGuildPanel();
            }
          },
          {
            text: t('mods.guilds.deleteGuild'),
            primary: true,
            onClick: async () => {
              const dialog = getOpenDialog();
              try {
                await deleteGuild(guild.id);
                dialog.remove();
                const mainDialog = getOpenDialog();
                if (mainDialog) mainDialog.remove();
                
                // Show success modal
                const successContent = document.createElement('div');
                successContent.style.cssText = `
                  color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
                  font-size: 14px;
                  padding: 8px;
                  text-align: center;
                `;
                successContent.textContent = t('mods.guilds.guildDeleted');
                
                api.ui.components.createModal({
                  title: t('mods.guilds.success'),
                  width: 400,
                  height: null,
                  content: successContent,
                  buttons: [{
                    text: t('controls.ok'),
                    primary: true,
                    onClick: () => {
                      const successDialog = getOpenDialog();
                      if (successDialog) successDialog.remove();
                    }
                  }]
                });
                
                setTimeout(() => {
                  const successDialog = getOpenDialog();
                  if (successDialog) {
                    applyModalStyles(successDialog, 400, null);
                  }
                }, 100);
                
                showGuildBrowser();
              } catch (error) {
                // Show error modal
                const errorContent = document.createElement('div');
                errorContent.style.cssText = `
                  color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
                  font-size: 14px;
                  padding: 8px;
                  text-align: center;
                `;
                errorContent.textContent = error.message || t('mods.guilds.error');
                
                api.ui.components.createModal({
                  title: t('mods.guilds.error'),
                  width: 400,
                  height: null,
                  content: errorContent,
                  buttons: [{
                    text: t('controls.ok'),
                    primary: true,
                    onClick: () => {
                      const errorDialog = getOpenDialog();
                      if (errorDialog) errorDialog.remove();
                    }
                  }]
                });
                
                setTimeout(() => {
                  const errorDialog = getOpenDialog();
                  if (errorDialog) {
                    applyModalStyles(errorDialog, 400, null);
                  }
                }, 100);
              }
            }
          }
        ]
      });
      
      setTimeout(() => {
        const dialog = getOpenDialog();
        if (dialog) {
          applyModalStyles(dialog, 450, null);
          // Style the delete button to be red/danger
          const deleteButton = dialog.querySelector('button:last-child');
          if (deleteButton) {
            deleteButton.style.background = 'rgba(255, 107, 107, 0.4)';
            deleteButton.style.borderColor = 'rgba(255, 107, 107, 0.6)';
            deleteButton.style.color = 'rgb(255, 255, 255)';
          }
        }
      }, 100);
    }, { 
      width: '100%',
      background: 'rgba(255, 107, 107, 0.4)',
      border: '1px solid rgba(255, 107, 107, 0.6)'
    });
    
    deleteSection.appendChild(deleteBtn);
    adminContainer.appendChild(deleteSection);
  }

  // Leave Guild (Not for leader)
  if (currentMember && !isLeader) {
    const leaveBtn = createButton(t('mods.guilds.leaveGuild'), async () => {
      showConfirmModal(
        t('mods.guilds.leaveGuild'),
        t('mods.guilds.leaveGuildConfirm'),
        async () => {
          try {
            await leaveGuild(guild.id);
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            showWarningModal(t('mods.guilds.success'), t('mods.guilds.leftGuild'));
            showGuildBrowser();
          } catch (error) {
            showWarningModal(t('mods.guilds.error'), error.message);
          }
        }
      );
    }, { 
      width: '100%', 
      marginTop: '8px',
      background: 'rgba(255, 107, 107, 0.3)'
    });
    adminContainer.appendChild(leaveBtn);
  }

  rightPanel.appendChild(adminContainer);

  contentDiv.appendChild(rightPanel);

  const setupFooter = async (buttonContainer) => {
    // Add guild coins display
    await setupGuildCoinsInFooter(buttonContainer);
    
    // Set the coin amount element for updates
    const coinAmount = buttonContainer.querySelector('.guild-coins-amount');
    if (coinAmount && !guildCoinsDisplayElement) {
      guildCoinsDisplayElement = coinAmount;
    }
    
    // Add back button before the Close button (so Back and Close are together on the right)
    const backBtn = document.createElement('button');
    backBtn.textContent = t('mods.guilds.backButton');
    backBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
    backBtn.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
    backBtn.addEventListener('click', () => {
      const dialog = getOpenDialog();
      if (dialog) dialog.remove();
      showGuildBrowser();
    });
    
    // Find the Close button and insert Back button before it
    const closeButton = buttonContainer.querySelector('button:last-child');
    if (closeButton) {
      buttonContainer.insertBefore(backBtn, closeButton);
    } else {
      // Fallback: if no Close button found, just append
      buttonContainer.appendChild(backBtn);
    }
  };

  const modalTitle = guild.abbreviation ? `${guild.name} [${guild.abbreviation}]` : guild.name;
  const modal = api.ui.components.createModal({
    title: modalTitle,
    width: GUILD_PANEL_DIMENSIONS.WIDTH,
    height: GUILD_PANEL_DIMENSIONS.HEIGHT,
    content: contentDiv,
    buttons: [{
      text: t('mods.guilds.close'),
      primary: true,
      onClick: () => {}
    }]
  });

  setTimeout(() => {
    const dialog = getOpenDialog();
    if (dialog) {
      applyModalStyles(dialog, GUILD_PANEL_DIMENSIONS.WIDTH, GUILD_PANEL_DIMENSIONS.HEIGHT);
      const buttonContainer = dialog.querySelector('.flex.justify-end.gap-2');
      if (buttonContainer) {
        setupFooter(buttonContainer);
      }
    }
  }, 100);
}

// =======================
// Menu Integration
// =======================

async function updateGuildInviteBadge(menuItem) {
  const invites = await getPlayerInvites();
  let badge = menuItem.querySelector('.guild-invite-badge');
  
  if (invites.length > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'guild-invite-badge';
      badge.style.cssText = `
        background: ${CSS_CONSTANTS.COLORS.ERROR};
        color: white;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 10px;
        margin-left: auto;
        font-weight: 600;
      `;
      menuItem.appendChild(badge);
    }
    badge.textContent = invites.length > 9 ? '9+' : invites.length.toString();
    badge.style.display = '';
  } else if (badge) {
    badge.remove();
  }
}

function injectGuildMenuItem(menuElement) {
  // Check if already processed
  if (!menuElement || menuElement.querySelector('.guilds-menu-item')) {
    return;
  }

  // Check if this is the "My Account" menu (support both English and Portuguese)
  const menuText = menuElement.textContent || '';
  const lowerMenuText = menuText.toLowerCase();
  if (!lowerMenuText.includes('my account') && !lowerMenuText.includes('minha conta')) {
    return;
  }

  // Find the VIP List menu item to position after it
  const vipListItem = menuElement.querySelector('.vip-list-menu-item');
  if (!vipListItem) {
    // VIP List not found yet, try again later
    return;
  }

  // Find the group container
  const group = menuElement.querySelector('div[role="group"]');
  if (!group) {
    return;
  }

  // Create Guilds menu item matching VIP List style
  const guildsMenuItem = document.createElement('div');
  guildsMenuItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none text-whiteRegular guilds-menu-item';
  guildsMenuItem.setAttribute('role', 'menuitem');
  guildsMenuItem.setAttribute('tabindex', '-1');
  guildsMenuItem.setAttribute('data-orientation', 'vertical');
  guildsMenuItem.setAttribute('data-radix-collection-item', '');

  // Add icon (using users/group icon for guilds)
  guildsMenuItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
    <span class="relative">${t('mods.guilds.menuItem')}</span>
  `;

  // Check for invites and show badge
  (async () => {
    await updateGuildInviteBadge(guildsMenuItem);
  })();

  // Add click handler
  guildsMenuItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    await openGuildPanel();
    // Close the menu
    const timeoutId = setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape', 
        keyCode: 27, 
        bubbles: true 
      }));
    }, 100);
  });

  // Insert after VIP List item, before the separator
  const nextSibling = vipListItem.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains('separator')) {
    // Insert before the separator
    group.insertBefore(guildsMenuItem, nextSibling);
  } else {
    // Insert right after VIP List
    vipListItem.parentNode.insertBefore(guildsMenuItem, vipListItem.nextSibling);
  }

  // Inject Equipment menu item after Guilds
  injectEquipmentMenuItem(guildsMenuItem);
}

// =======================
// Equipment Section
// =======================

const EQUIPMENT_CONFIG = {
  MODAL_WIDTH: 490,
  MODAL_HEIGHT: 490,
  SLOT_SIZE: 32,
  SLOT_GAP: 4,
  // Base path for local equipment images (relative to extension root)
  IMAGE_BASE_PATH: '/assets/equipment/'
};

// Cache for extension base URL to avoid repeated lookups
let cachedExtensionBaseUrl = null;

// Store window message handler for cleanup
let windowMessageHandler = null;

// Listen for extension base URL from injector
if (typeof window !== 'undefined') {
  windowMessageHandler = function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.from !== 'BESTIARY_EXTENSION') return;
    
    // Get extension base URL from postMessage
    if (event.data.extensionBaseUrl) {
      cachedExtensionBaseUrl = event.data.extensionBaseUrl;
      console.log('[Equipment] Received extension base URL:', cachedExtensionBaseUrl);
    }
    
    // Also check window.BESTIARY_EXTENSION_BASE_URL (set by client.js)
    if (window.BESTIARY_EXTENSION_BASE_URL && !cachedExtensionBaseUrl) {
      cachedExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
    }
  };
  
  window.addEventListener('message', windowMessageHandler);
  
  // Check if it's already set
  if (window.BESTIARY_EXTENSION_BASE_URL) {
    cachedExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
  }
}

// Equipment slot definitions: [slotType, x, y, name]
const EQUIPMENT_SLOTS = [
  ['amulet', 1, 19, 'Amulet'],
  ['weapon-right', 1, 55, 'Right Hand'],
  ['ring', 1, 91, 'Ring'],
  ['helmet', 37, 1, 'Helmet'],
  ['armor', 37, 37, 'Armor'],
  ['legs', 37, 73, 'Legs'],
  ['boots', 37, 109, 'Boots'],
  ['bag', 73, 19, 'Backpack'],
  ['weapon-left', 73, 55, 'Shield'],
  ['ammo', 73, 91, 'Ammunition']
];

// Special backpack IDs (inventory items that don't have stats)
const SPECIAL_BACKPACK_IDS = [10327, 21445];
const BACKPACK_NAMES = {
  10327: 'Bestiary backpack',
  21445: 'Runes backpack'
};

// Helper functions for special backpacks
function isSpecialBackpack(gameId) {
  return SPECIAL_BACKPACK_IDS.includes(gameId);
}

function getBackpackName(gameId) {
  return BACKPACK_NAMES[gameId] || `Item ${gameId}`;
}

function getBackpackCountFromInventory(backpackId, inventory) {
  if (!inventory) return 1;
  
  const idString = String(backpackId);
  
  // Check if inventory has this ID as a key directly
  if (inventory[idString] !== undefined) {
    return typeof inventory[idString] === 'number' ? inventory[idString] : 1;
  }
  
  // Check if any key contains the ID
  for (const [key, value] of Object.entries(inventory)) {
    if (key === idString || key.includes(idString)) {
      return typeof value === 'number' ? value : 1;
    }
  }
  
  return 1;
}

function createBackpackEquipmentItem(backpackId, itemData, count) {
  return {
    id: `backpack_${backpackId}`,
    gameId: backpackId,
    name: itemData?.metadata?.name || getBackpackName(backpackId),
    tier: itemData?.tier || 1,
    count: count
    // Note: Backpacks have no stat field
  };
}

// Helper functions for slot type normalization
function normalizeSlotTypeForDb(slotType) {
  if (slotType === 'weapon-right') return 'weapon';
  if (slotType === 'weapon-left') return 'shield';
  return slotType;
}

function normalizeSlotTypeFromDb(dbSlotType) {
  if (dbSlotType === 'weapon') return 'weapon-right';
  if (dbSlotType === 'shield') return 'weapon-left';
  return dbSlotType;
}

// Helper function to calculate tooltip position
function calculateTooltipPosition(elementRect, tooltipRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let left = elementRect.right + 10;
  let top = elementRect.top;
  
  // Adjust if tooltip would go off screen
  if (left + tooltipRect.width > viewportWidth) {
    left = elementRect.left - tooltipRect.width - 10;
  }
  if (top + tooltipRect.height > viewportHeight) {
    top = viewportHeight - tooltipRect.height - 10;
  }
  if (left < 0) {
    left = 10;
  }
  if (top < 0) {
    top = 10;
  }
  
  return { left, top };
}

// Tooltip manager for equipment modal - ensures only one tooltip is visible at a time
let currentEquipmentTooltip = null;

function hideCurrentEquipmentTooltip() {
  if (currentEquipmentTooltip && currentEquipmentTooltip.style.display !== 'none') {
    currentEquipmentTooltip.style.display = 'none';
  }
  currentEquipmentTooltip = null;
}

function showEquipmentTooltip(tooltip) {
  hideCurrentEquipmentTooltip();
  currentEquipmentTooltip = tooltip;
  if (tooltip) {
    tooltip.style.display = 'block';
  }
}

// Helper function to create a tooltip element
function createTooltipElement() {
  const tooltip = document.createElement('div');
  tooltip.setAttribute('data-equipment-tooltip', 'true');
  tooltip.style.cssText = `
    position: fixed;
    padding: 8px 10px;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border-width: 4px;
    border-style: solid;
    border-color: transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 11px;
    white-space: nowrap;
    z-index: 10002;
    display: none;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
    font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
  `;
  document.body.appendChild(tooltip);
  return tooltip;
}

// Helper function to add a detail row to tooltip content
function addTooltipDetail(container, label, value, color = CSS_CONSTANTS.COLORS.TEXT_WHITE) {
  const detail = document.createElement('div');
  detail.style.cssText = `
    display: flex;
    justify-content: space-between;
    gap: 16px;
    color: ${color};
    font-size: 11px;
    line-height: 1.4;
  `;
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  labelSpan.style.opacity = '0.9';
  const valueSpan = document.createElement('span');
  valueSpan.textContent = value;
  valueSpan.style.fontWeight = '600';
  valueSpan.style.color = color;
  detail.appendChild(labelSpan);
  detail.appendChild(valueSpan);
  container.appendChild(detail);
}

// Equipment item data - maps slot types to image info
// Using local files for better performance and reliability
const EQUIPMENT_ITEMS = {
  'amulet': {
    local: 'NoAmulet.webp',
    name: 'No Amulet'
  },
  'weapon-right': {
    local: 'NoWeaponRight.webp',
    name: 'No Weapon'
  },
  'ring': {
    local: 'NoRing.webp',
    name: 'No Ring'
  },
  'helmet': {
    local: 'NoHelmet.webp',
    name: 'No Helmet'
  },
  'armor': {
    local: 'NoArmor.webp',
    name: 'No Armor'
  },
  'legs': {
    local: 'NoLegs.webp',
    name: 'No Legs'
  },
  'boots': {
    local: 'NoBoots.webp',
    name: 'No Boots'
  },
  'bag': {
    local: 'NoBag.gif',
    name: 'No Backpack'
  },
  'weapon-left': {
    local: 'NoWeaponLeft.webp',
    name: 'No Shield'
  },
  'ammo': {
    local: 'NoAmmo.gif',
    name: 'No Ammunition'
  }
};

function getEquipmentImageUrl(slotType) {
  const item = EQUIPMENT_ITEMS[slotType];
  if (!item || !item.local) return '';
  
  const imagePath = EQUIPMENT_CONFIG.IMAGE_BASE_PATH + item.local;
  
  // Use cached base URL if available
  if (cachedExtensionBaseUrl) {
    // Ensure no double slashes - remove leading slash from imagePath if baseUrl ends with slash
    const base = cachedExtensionBaseUrl.endsWith('/') ? cachedExtensionBaseUrl : cachedExtensionBaseUrl + '/';
    const path = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    return base + path;
  }
  
  // Try multiple methods to get extension runtime URL (similar to local_mods.js)
  // Method 1: Try browser API in order: browserAPI, chrome, browser
  // IMPORTANT: Check runtime.id first to ensure extension context is valid
  try {
    const api = window.browserAPI || window.chrome || window.browser;
    if (api && api.runtime) {
      // Check if runtime.id exists and is valid (not "invalid")
      if (api.runtime.id && api.runtime.id !== 'invalid' && api.runtime.getURL) {
        const url = api.runtime.getURL(imagePath);
        // Validate URL - make sure it's not "invalid"
        if (url && url.includes('://') && !url.includes('://invalid')) {
          // Cache the base URL for future use
          const baseUrlMatch = url.match(/^(chrome-extension|moz-extension):\/\/[^/]+\//);
          if (baseUrlMatch) {
            cachedExtensionBaseUrl = baseUrlMatch[0];
          }
          return url;
        }
      }
    }
  } catch (e) {
    console.warn('[Equipment] Error getting URL from browser API:', e);
  }
  
  // Method 2: Try global browserAPI (if available in mod context)
  try {
    if (typeof browserAPI !== 'undefined' && browserAPI?.runtime) {
      if (browserAPI.runtime.id && browserAPI.runtime.id !== 'invalid' && browserAPI.runtime.getURL) {
        const url = browserAPI.runtime.getURL(imagePath);
        if (url && url.includes('://') && !url.includes('://invalid')) {
          const baseUrlMatch = url.match(/^(chrome-extension|moz-extension):\/\/[^/]+\//);
          if (baseUrlMatch) {
            cachedExtensionBaseUrl = baseUrlMatch[0];
          }
          return url;
        }
      }
    }
  } catch (e) {}
  
  // Method 3: Try to get from extension base URL if available (from postMessage or window)
  if (typeof window !== 'undefined') {
    if (window.BESTIARY_EXTENSION_BASE_URL && !cachedExtensionBaseUrl) {
      cachedExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
    }
    if (cachedExtensionBaseUrl) {
      // Ensure no double slashes - remove leading slash from imagePath if baseUrl ends with slash
      const base = cachedExtensionBaseUrl.endsWith('/') ? cachedExtensionBaseUrl : cachedExtensionBaseUrl + '/';
      const path = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      return base + path;
    }
  }
  
  // Method 4: Try to detect extension URL from script sources (similar to client.js)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Check all script elements
    const scriptElements = document.querySelectorAll('script[src]');
    for (const script of scriptElements) {
      const src = script.src || '';
      // Look for extension scripts (chrome-extension:// or moz-extension://)
      const extensionMatch = src.match(/^(chrome-extension|moz-extension):\/\/([^/]+)\//);
      if (extensionMatch && extensionMatch[2] && extensionMatch[2] !== 'invalid' && extensionMatch[2].length > 10) {
        const protocol = extensionMatch[1];
        const extensionId = extensionMatch[2];
        cachedExtensionBaseUrl = `${protocol}://${extensionId}/`;
        // Remove leading slash from imagePath to avoid double slashes
        const path = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
        return cachedExtensionBaseUrl + path;
      }
    }
    
    // Also check script elements that might be in the head or body
    const allScripts = document.getElementsByTagName('script');
    for (const script of allScripts) {
      const src = script.src || script.getAttribute('src') || '';
      if (src) {
        const extensionMatch = src.match(/^(chrome-extension|moz-extension):\/\/([^/]+)\//);
        if (extensionMatch && extensionMatch[2] && extensionMatch[2] !== 'invalid' && extensionMatch[2].length > 10) {
          const protocol = extensionMatch[1];
          const extensionId = extensionMatch[2];
          cachedExtensionBaseUrl = `${protocol}://${extensionId}/`;
          // Remove leading slash from imagePath to avoid double slashes
          const path = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
          return cachedExtensionBaseUrl + path;
        }
      }
    }
  }
  
  // Last resort: return path and let the browser try (will likely fail but better than nothing)
  console.warn('[Equipment] Could not determine extension runtime URL, using relative path:', imagePath);
  return imagePath;
}

// Helper function to get guild asset URL (similar to getEquipmentImageUrl)
function getGuildAssetUrl(filename) {
  const imagePath = '/assets/guild/' + filename;
  
  // Use cached base URL if available
  if (cachedExtensionBaseUrl) {
    const base = cachedExtensionBaseUrl.endsWith('/') ? cachedExtensionBaseUrl : cachedExtensionBaseUrl + '/';
    const path = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    return base + path;
  }
  
  // Try multiple methods to get extension runtime URL (same as equipment)
  try {
    const api = window.browserAPI || window.chrome || window.browser;
    if (api && api.runtime) {
      if (api.runtime.id && api.runtime.id !== 'invalid' && api.runtime.getURL) {
        const url = api.runtime.getURL(imagePath);
        if (url && url.includes('://') && !url.includes('://invalid')) {
          const baseUrlMatch = url.match(/^(chrome-extension|moz-extension):\/\/[^/]+\//);
          if (baseUrlMatch) {
            cachedExtensionBaseUrl = baseUrlMatch[0];
          }
          return url;
        }
      }
    }
  } catch (e) {
    console.warn('[Guilds] Error getting URL from browser API:', e);
  }
  
  // Try window.BESTIARY_EXTENSION_BASE_URL
  if (typeof window !== 'undefined') {
    if (window.BESTIARY_EXTENSION_BASE_URL && !cachedExtensionBaseUrl) {
      cachedExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
    }
    if (cachedExtensionBaseUrl) {
      const base = cachedExtensionBaseUrl.endsWith('/') ? cachedExtensionBaseUrl : cachedExtensionBaseUrl + '/';
      const path = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      return base + path;
    }
  }
  
  // Last resort: return path
  console.warn('[Guilds] Could not determine extension runtime URL, using relative path:', imagePath);
  return imagePath;
}

function createEquipmentSlot(slotType, x, y, name) {
  const slot = document.createElement('div');
  slot.className = 'equipment-slot';
  slot.setAttribute('data-slot-type', slotType);
  slot.setAttribute('data-slot-name', name);
  slot.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: ${EQUIPMENT_CONFIG.SLOT_SIZE}px;
    height: ${EQUIPMENT_CONFIG.SLOT_SIZE}px;
    cursor: pointer;
    border: none;
    background: rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  `;
  
  // Store original styles for reset
  slot._originalBorder = 'none';
  slot._originalBackground = 'rgba(0, 0, 0, 0.3)';
  
  // Create tooltip for slot
  const tooltip = createTooltipElement();
  
  // Build tooltip content (will be updated when hovering)
  const tooltipContent = document.createElement('div');
  tooltipContent.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
  tooltip.appendChild(tooltipContent);
  
  const updateSlotTooltip = async () => {
    tooltipContent.innerHTML = '';
    
    const title = document.createElement('div');
    title.textContent = name;
    title.style.cssText = `
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 2px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 6px;
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
    `;
    tooltipContent.appendChild(title);
    
    // Get equipped item if any
    const equippedItem = await getEquippedItem(slotType);
    
    if (equippedItem) {
      addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipEquipped') || 'Equipped', equippedItem.name, CSS_CONSTANTS.COLORS.TEXT_WHITE);
      addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipGuildPoints') || 'Guild Points', `+${equippedItem.tier}`, CSS_CONSTANTS.COLORS.SUCCESS);
      // Backpacks have no stat
      if (!isSpecialBackpack(equippedItem.gameId) && equippedItem.stat) {
        addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipStat') || 'Stat', equippedItem.stat.toUpperCase(), '#64b5f6');
      }
      addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipTier') || 'Tier', `T${equippedItem.tier}`, CSS_CONSTANTS.COLORS.TEXT_WHITE);
    } else {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = t('mods.guilds.equipment.tooltipEmptySlot') || 'Empty slot';
      emptyMsg.style.cssText = `
        color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
        font-size: 11px;
        opacity: 0.7;
        font-style: italic;
      `;
      tooltipContent.appendChild(emptyMsg);
    }
    
    const instruction = document.createElement('div');
    instruction.textContent = t('mods.guilds.equipment.tooltipInstruction') || 'Click to select • Right-click to unequip';
    instruction.style.cssText = `
      margin-top: 4px;
      padding-top: 6px;
      border-top: 2px solid rgba(255, 255, 255, 0.2);
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 10px;
      opacity: 0.6;
    `;
    tooltipContent.appendChild(instruction);
  };
  
  // Show/hide tooltip on hover
  let tooltipTimeout;
  const showTooltip = () => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(async () => {
      await updateSlotTooltip();
      showEquipmentTooltip(tooltip);
      updateTooltipPosition();
    }, 300);
  };
  
  const hideTooltip = () => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    if (currentEquipmentTooltip === tooltip) {
      hideCurrentEquipmentTooltip();
    } else {
      tooltip.style.display = 'none';
    }
  };
  
  const updateTooltipPosition = () => {
    const rect = slot.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const position = calculateTooltipPosition(rect, tooltipRect);
    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
  };
  
  // Hover effects
  slot.addEventListener('mouseenter', () => {
    // Don't override selection highlight on hover
    if (!slot.classList.contains('slot-selected')) {
      slot.style.background = 'rgba(255, 255, 255, 0.1)';
    }
    showTooltip();
  });
  
  slot.addEventListener('mouseleave', () => {
    // Restore selection highlight if selected (monochrome grey), otherwise restore original
    if (slot.classList.contains('slot-selected')) {
      slot.style.filter = 'grayscale(100%) brightness(0.7)';
    } else {
      slot.style.filter = '';
    }
    hideTooltip();
  });
  
  slot.addEventListener('mousemove', updateTooltipPosition);
  
  // Click handler
  slot.addEventListener('click', (e) => {
    e.stopPropagation();
    handleEquipmentSlotClick(slotType, name, slot);
  });
  
  // Right-click handler to unequip
  slot.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const equippedItem = await getEquippedItem(slotType);
    if (equippedItem) {
      await unequipItemFromSlot(slotType);
    }
  });
  
  // Load equipped item or default image (async)
  (async () => {
    const equippedItem = await getEquippedItem(slotType);
    if (equippedItem) {
      // Show equipped item
      try {
        const equipData = globalThis.state?.utils?.getEquipment(equippedItem.gameId);
        let spriteId = null;
        let isInventoryItem = false;
        
        if (equipData && equipData.metadata) {
          spriteId = equipData.metadata.spriteId;
        } else {
          // For inventory items, use gameId directly as spriteId
          spriteId = equippedItem.gameId;
          isInventoryItem = true;
        }
        
        if (spriteId && typeof api?.ui?.components?.createItemPortrait === 'function' && !isInventoryItem) {
          // Use createItemPortrait for regular equipment
          const itemPortrait = api.ui.components.createItemPortrait({
            itemId: spriteId,
            stat: equippedItem.stat,
            tier: equippedItem.tier
          });
          
          slot.appendChild(itemPortrait);
          // No title attribute - we use custom tooltip instead
        } else if (spriteId) {
          // For inventory items, create viewport structure manually
          const viewportStructure = createViewportStructureForSlot(spriteId);
          slot.appendChild(viewportStructure);
        } else {
          // Fallback: show default image
          loadDefaultSlotImageIntoSlot(slot, slotType, name);
        }
      } catch (e) {
        // For inventory items that can't be accessed via getEquipment, try using gameId directly
        try {
          const spriteId = equippedItem.gameId;
          const viewportStructure = createViewportStructureForSlot(spriteId);
          slot.appendChild(viewportStructure);
        } catch (e2) {
          console.warn(`[Equipment] Error loading equipped item:`, e2);
          loadDefaultSlotImageIntoSlot(slot, slotType, name);
        }
      }
    } else {
      // Show default slot image
      loadDefaultSlotImageIntoSlot(slot, slotType, name);
    }
  })();
  
  return slot;
}

// Helper function to load default slot image
function loadDefaultSlotImageIntoSlot(slot, slotType, name) {
  const img = document.createElement('img');
  img.alt = name;
  img.style.cssText = `
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    object-fit: contain;
  `;
  
  // Function to load image with retry
  const loadImage = (retryCount = 0) => {
    let imageUrl = getEquipmentImageUrl(slotType);
    
    // If we don't have a valid URL and haven't retried, wait a bit and try again
    if ((!imageUrl || imageUrl.includes('://invalid') || (!imageUrl.includes('://') && retryCount < 3))) {
      if (retryCount < 3) {
        setTimeout(() => {
          loadImage(retryCount + 1);
        }, 200);
        return;
      }
    }
    
    if (imageUrl && !imageUrl.includes('://invalid')) {
      img.src = imageUrl;
    } else {
      console.warn(`[Equipment] Could not get valid URL for ${slotType} after retries`);
      img.style.opacity = '0.3';
    }
  };
  
  // Start loading
  loadImage();
  
  // Handle image load errors gracefully
  img.onerror = () => {
    console.warn(`[Equipment] Failed to load image for ${slotType}, URL:`, img.src);
    // Show placeholder or empty slot
    img.style.opacity = '0.3';
  };
  
  slot.appendChild(img);
}

// Function to clear all slot highlights
function clearSlotHighlights() {
  const modal = document.querySelector('div[role="dialog"][data-state="open"]');
  if (modal) {
    const slots = modal.querySelectorAll('.equipment-slot');
    slots.forEach(slot => {
      slot.classList.remove('slot-selected');
      slot.style.filter = '';
    });
  }
}

// Function to highlight a specific slot
function highlightSlot(slotElement) {
  if (!slotElement) return;
  
  // Clear all highlights first
  clearSlotHighlights();
  
  // Highlight the selected slot (monochrome grey filter)
  slotElement.classList.add('slot-selected');
  slotElement.style.filter = 'grayscale(100%) brightness(0.7)';
}

function handleEquipmentSlotClick(slotType, slotName, slotElement) {
  const item = EQUIPMENT_ITEMS[slotType];
  const itemName = item?.name || slotName;
  
  console.log(`[Equipment] Clicked ${slotName} (${slotType}): ${itemName}`);
  
  // Find the modal and check if this slot is already selected
  const modal = document.querySelector('div[role="dialog"][data-state="open"]');
  if (modal) {
    const currentSelectedSlot = modal.getAttribute('data-selected-slot');
    
    // If clicking the same slot, unselect it
    if (currentSelectedSlot === slotType) {
      modal.removeAttribute('data-selected-slot');
      clearSlotHighlights();
      // Buttons remain enabled - they can auto-equip to correct slot
      
      // Clear filter and show all equipment
      const arsenalContent = modal.querySelector('[data-arsenal-content="true"]');
      if (arsenalContent && typeof arsenalContent.filterBySlot === 'function') {
        arsenalContent.filterBySlot('all');
      }
      
      console.log(`[Equipment] Unselected ${slotName}`);
      return;
    }
    
    // Store selected slot on modal for easy access
    modal.setAttribute('data-selected-slot', slotType);
    
    // Highlight the clicked slot
    if (slotElement) {
      highlightSlot(slotElement);
    } else {
      // Fallback: find slot by data attribute
      const slot = modal.querySelector(`[data-slot-type="${slotType}"]`);
      if (slot) {
        highlightSlot(slot);
      }
    }
    
    // Enable equipment buttons
    enableEquipmentButtons(modal, true);
    
    // Find the arsenal content div and filter by slot
    const arsenalContent = modal.querySelector('[data-arsenal-content="true"]');
    if (arsenalContent && typeof arsenalContent.filterBySlot === 'function') {
      arsenalContent.filterBySlot(slotType);
      console.log(`[Equipment] Filtered arsenal to show ${slotType} equipment`);
    } else {
      // Fallback: try to find by searching for the search input
      const searchInput = modal.querySelector('input[placeholder*="Search equipment"]');
      if (searchInput) {
        const arsenalDiv = searchInput.closest('div[style*="padding: 10px"]');
        if (arsenalDiv && typeof arsenalDiv.filterBySlot === 'function') {
          arsenalDiv.filterBySlot(slotType);
          console.log(`[Equipment] Filtered arsenal to show ${slotType} equipment`);
        }
      }
    }
  }
}

// Function to enable/disable equipment buttons based on slot selection
// Note: Buttons are now always enabled, but this function is kept for potential future use
function enableEquipmentButtons(modal, enabled) {
  if (!modal) return;
  
  const equipmentButtons = modal.querySelectorAll('button[data-equipment-id]');
  equipmentButtons.forEach(btn => {
    // Always enable buttons - they will auto-equip to correct slot
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.style.pointerEvents = 'auto';
    btn.classList.remove('equipment-disabled');
  });
}

// Custom equipment storage using localStorage
// Firebase path helper for player equipment
function getPlayerEquipmentPath(playerName) {
  if (!playerName) return null;
  // Normalize and sanitize player name for Firebase
  const normalizedName = sanitizeFirebaseKey(playerName);
  return `${GUILD_CONFIG.firebaseUrl}/player-equipment/${normalizedName}/equipment.json`;
}

// Get all equipped items from Firebase
async function getEquippedItems() {
  try {
    const playerName = getCurrentPlayerName();
    if (!playerName) {
      console.warn('[Equipment] No player name available');
      return {};
    }
    
    const path = getPlayerEquipmentPath(playerName);
    if (!path) return {};
    
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        return {}; // No equipment stored yet
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error('[Equipment] Error loading equipped items from Firebase:', error);
    return {};
  }
}

// Save equipped items to Firebase
async function saveEquippedItems(equippedItems) {
  try {
    const playerName = getCurrentPlayerName();
    if (!playerName) {
      console.warn('[Equipment] No player name available');
      return false;
    }
    
    const path = getPlayerEquipmentPath(playerName);
    if (!path) return false;
    
    const response = await fetch(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(equippedItems)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('[Equipment] Error saving equipped items to Firebase:', error);
    return false;
  }
}

// Get equipped item for a specific slot
async function getEquippedItem(slotType) {
  const equippedItems = await getEquippedItems();
  return equippedItems[slotType] || null;
}

// Remove unknown equipment slots from Firebase
async function removeUnknownEquipment(playerName = null) {
  try {
    const currentPlayer = getCurrentPlayerName();
    const targetPlayer = playerName || currentPlayer;
    
    if (!targetPlayer) {
      console.warn('[Equipment] No player name available');
      return { removed: 0, errors: ['No player name available'] };
    }
    
    // Get equipment for the target player
    const equippedItems = playerName 
      ? await getPlayerEquipmentFromFirebase(playerName)
      : await getEquippedItems();
      
    if (!equippedItems || Object.keys(equippedItems).length === 0) {
      return { removed: 0, errors: [] };
    }
    
    // Only allow saving if it's for the current player (security)
    const canSave = !playerName || targetPlayer.toLowerCase() === currentPlayer?.toLowerCase();
    if (playerName && !canSave) {
      console.warn('[Equipment] Can only save equipment for current player');
      return { removed: 0, errors: ['Can only save equipment for current player'] };
    }
    
    const cleanedItems = { ...equippedItems };
    let removedCount = 0;
    const errors = [];
    
    // Check each equipment slot
    for (const [slotType, item] of Object.entries(equippedItems)) {
      // Check if slot key is "unknown" or item's slotType property is "unknown"
      // Unknown equipment cannot be equipped, so it should be deleted
      if ((slotType === 'unknown' || (item && item.slotType === 'unknown')) && item) {
        // Delete unknown equipment (cannot be equipped)
        delete cleanedItems[slotType];
        removedCount++;
        console.log(`[Equipment] Removed "${item.name}" (unknown slot cannot be equipped)`);
      }
    }
    
    // Save cleaned equipment if changes were made and we can save
    if (removedCount > 0 && canSave) {
      const saved = await saveEquippedItems(cleanedItems);
      if (!saved) {
        errors.push('Failed to save cleaned equipment to Firebase');
        return { removed: 0, errors };
      }
    } else if (removedCount > 0) {
      // Changes detected but can't save (read-only mode)
      return { 
        removed: removedCount, 
        errors: ['Read-only mode: changes detected but not saved'] 
      };
    }
    
    return { removed: removedCount, errors };
  } catch (error) {
    console.error('[Equipment] Error removing unknown equipment:', error);
    return { removed: 0, errors: [error.message] };
  }
}

// Equip an item to a slot
async function equipItemToSlot(equipment, slotType) {
  try {
    const equippedItems = await getEquippedItems();
    
    // Store equipment data
    // Backpacks don't have stat
    const equippedItemData = {
      id: equipment.id,
      gameId: equipment.gameId,
      name: equipment.name,
      tier: equipment.tier,
      slotType: slotType,
      equippedAt: Date.now()
    };
    
    // Only include stat if it exists (backpacks don't have stat)
    if (equipment.stat) {
      equippedItemData.stat = equipment.stat;
    }
    
    equippedItems[slotType] = equippedItemData;
    
    const saved = await saveEquippedItems(equippedItems);
    if (!saved) {
      console.warn('[Equipment] Failed to save equipment to Firebase');
      return false;
    }
    
    console.log(`[Equipment] Equipped ${equipment.name} to ${slotType} slot`);
    
    // Small delay to ensure Firebase save is complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Update the slot display
    await updateSlotDisplay(slotType);
    
    // Update stats display
    await updateEquipmentStats();
    
    // Clear selection after equipping (buttons remain enabled for auto-equip)
    const modal = document.querySelector('div[role="dialog"][data-state="open"]');
    if (modal) {
      modal.removeAttribute('data-selected-slot');
      clearSlotHighlights();
      // Buttons remain enabled - they can auto-equip to correct slot
    }
    
    return true;
  } catch (error) {
    console.error('[Equipment] Error equipping item:', error);
    return false;
  }
}

// Unequip an item from a slot
async function unequipItemFromSlot(slotType) {
  try {
    const equippedItems = await getEquippedItems();
    if (equippedItems[slotType]) {
      delete equippedItems[slotType];
      const saved = await saveEquippedItems(equippedItems);
      if (!saved) {
        console.warn('[Equipment] Failed to save equipment to Firebase');
        return false;
      }
      
      console.log(`[Equipment] Unequipped item from ${slotType} slot`);
      
      // Small delay to ensure Firebase save is complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Update the slot display
      await updateSlotDisplay(slotType);
      
      // Update stats display
      await updateEquipmentStats();
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Equipment] Error unequipping item:', error);
    return false;
  }
}

// Calculate total stats from equipped items (using playereq-database.js as source of truth)
async function calculateEquipmentStats() {
  try {
    const equippedItems = await getEquippedItems();
    let totalGuildPoints = 0;
    const stats = {
      totalGuildPoints: 0,
      itemsCount: 0,
      itemsByTier: {},
      itemsBySlot: {},
      // Stat totals (using database as source of truth)
      totalStats: {
        ad: 0,
        ap: 0,
        hp: 0,
        armor: 0,
        magicResist: 0
      },
      statsByType: {
        ad: [],
        ap: [],
        hp: [],
        armor: [],
        magicResist: []
      }
    };
    
    // Get database for verification
    const playerEqDb = window.playerEquipmentDatabase;
    
    for (const [slotType, item] of Object.entries(equippedItems)) {
      if (item && item.tier) {
        totalGuildPoints += item.tier;
        stats.itemsCount++;
        
        // Count by tier
        stats.itemsByTier[item.tier] = (stats.itemsByTier[item.tier] || 0) + 1;
        
        // Store item by slot
        stats.itemsBySlot[slotType] = item;
        
        // Calculate stat totals (each tier point = 1 stat point)
        // Use item.stat from equipped data, verify with database if available
        const statType = item.stat || 'unknown';
        if (statType !== 'unknown' && stats.totalStats.hasOwnProperty(statType)) {
          stats.totalStats[statType] += item.tier;
          stats.statsByType[statType].push({
            name: item.name,
            tier: item.tier,
            slotType: slotType
          });
        }
        
        // Verify slot type matches database if available
        if (playerEqDb && playerEqDb.EQUIPMENT_BY_SLOT) {
          const normalizedSlot = normalizeSlotTypeForDb(slotType);
          const slotEquipment = playerEqDb.EQUIPMENT_BY_SLOT[normalizedSlot] || [];
          const itemInSlot = slotEquipment.includes(item.name);
          
          if (!itemInSlot) {
            console.warn(`[Equipment] Item ${item.name} may not belong to slot ${slotType} according to database`);
          }
        }
      }
    }
    
    stats.totalGuildPoints = totalGuildPoints;
    return stats;
  } catch (error) {
    console.error('[Equipment] Error calculating stats:', error);
    return {
      totalGuildPoints: 0,
      itemsCount: 0,
      itemsByTier: {},
      itemsBySlot: {},
      totalStats: {
        ad: 0,
        ap: 0,
        hp: 0,
        armor: 0,
        magicResist: 0
      },
      statsByType: {
        ad: [],
        ap: [],
        hp: [],
        armor: [],
        magicResist: []
      }
    };
  }
}

// Update the equipment stats display
async function updateEquipmentStats(container) {
  if (!container) {
    const modal = document.querySelector('div[role="dialog"][data-state="open"]');
    if (modal) {
      container = modal.querySelector('[data-details-container="true"]');
    }
  }
  
  if (!container) return;
  
  const stats = await calculateEquipmentStats();
  
  // Clear container
  container.innerHTML = '';
  
  // Create stats display
  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    height: 100%;
  `;
  
  // Total Guild Points
  const totalDiv = document.createElement('div');
  totalDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  `;
  
  const totalLabel = document.createElement('div');
  totalLabel.textContent = t('mods.guilds.equipment.totalGuildPoints') || 'Total Guild Points';
  totalLabel.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 10px;
    opacity: 0.7;
  `;
  
  const totalValue = document.createElement('div');
  totalValue.textContent = stats.totalGuildPoints.toString();
  totalValue.style.cssText = `
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 18px;
    font-weight: 600;
  `;
  
  totalDiv.appendChild(totalLabel);
  totalDiv.appendChild(totalValue);
  statsDiv.appendChild(totalDiv);
  
  container.appendChild(statsDiv);
}

// Update the visual display of a slot
// Helper function to create viewport structure for inventory items (like Cyclopedia)
function createViewportStructureForSlot(itemId) {
  const containerSlot = document.createElement('div');
  containerSlot.className = 'container-slot surface-darker';
  containerSlot.setAttribute('data-hoverable', 'true');
  containerSlot.setAttribute('data-highlighted', 'false');
  containerSlot.setAttribute('data-disabled', 'false');
  
  const rarityDiv = document.createElement('div');
  rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
  
  const spriteContainer = document.createElement('div');
  spriteContainer.className = 'sprite item relative';
  spriteContainer.classList.add(`id-${itemId}`);
  spriteContainer.classList.add('translate-y-px');
  
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  
  const img = document.createElement('img');
  img.alt = String(itemId);
  img.setAttribute('data-cropped', 'false');
  img.className = 'spritesheet';
  img.style.setProperty('--cropX', '0');
  img.style.setProperty('--cropY', '0');
  
  viewport.appendChild(img);
  spriteContainer.appendChild(viewport);
  rarityDiv.appendChild(spriteContainer);
  containerSlot.appendChild(rarityDiv);
  
  return containerSlot;
}

async function updateSlotDisplay(slotType) {
  const modal = document.querySelector('div[role="dialog"][data-state="open"]');
  if (!modal) {
    console.warn('[Equipment] Modal not found for slot update');
    return;
  }
  
  const slot = modal.querySelector(`[data-slot-type="${slotType}"]`);
  if (!slot) {
    console.warn(`[Equipment] Slot ${slotType} not found in modal`);
    return;
  }
  
  const equippedItem = await getEquippedItem(slotType);
  const slotName = slot.getAttribute('data-slot-name') || slotType;
  
  // Remove all children but preserve the slot element and its event listeners
  while (slot.firstChild) {
    const child = slot.firstChild;
    if (child.parentNode === slot) {
      slot.removeChild(child);
    } else {
      break; // Child is no longer a child of slot, stop
    }
  }
  
  if (equippedItem) {
    // Show equipped item
    try {
      const equipData = globalThis.state?.utils?.getEquipment(equippedItem.gameId);
      let spriteId = null;
      let isInventoryItem = false;
      
      if (equipData && equipData.metadata) {
        spriteId = equipData.metadata.spriteId;
      } else {
        // For inventory items, use gameId directly as spriteId
        spriteId = equippedItem.gameId;
        isInventoryItem = true;
      }
      
      if (spriteId && typeof api?.ui?.components?.createItemPortrait === 'function' && !isInventoryItem) {
        // Use createItemPortrait for regular equipment
        const itemPortrait = api.ui.components.createItemPortrait({
          itemId: spriteId,
          stat: equippedItem.stat,
          tier: equippedItem.tier
        });
        
        // Add portrait to slot
        slot.appendChild(itemPortrait);
      } else if (spriteId) {
        // For inventory items, create viewport structure manually
        const viewportStructure = createViewportStructureForSlot(spriteId);
        slot.appendChild(viewportStructure);
      } else {
        // Fallback: show default image
        loadDefaultSlotImage(slot, slotType);
      }
    } catch (e) {
      // For inventory items that can't be accessed via getEquipment, try using gameId directly
      try {
        const spriteId = equippedItem.gameId;
        const viewportStructure = createViewportStructureForSlot(spriteId);
        slot.appendChild(viewportStructure);
      } catch (e2) {
        console.warn(`[Equipment] Error displaying equipped item:`, e2);
        // Fallback to default slot image
        loadDefaultSlotImage(slot, slotType);
      }
    }
  } else {
    // Show default slot image
    loadDefaultSlotImage(slot, slotType);
  }
  
  console.log(`[Equipment] Updated slot display for ${slotType}`, equippedItem ? `(equipped: ${equippedItem.name})` : '(empty)');
}

// Load default slot image (used by updateSlotDisplay)
function loadDefaultSlotImage(slot, slotType) {
  const name = EQUIPMENT_ITEMS[slotType]?.name || slotType;
  loadDefaultSlotImageIntoSlot(slot, slotType, name);
}

function createEquipmentGrid(skipAutoLoad = false) {
  const container = document.createElement('div');
  container.className = 'equipment-grid-container';
  container.style.cssText = `
    position: relative;
    width: 110px;
    height: 145px;
    margin: 0 auto;
    background: rgba(0, 0, 0, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 4px;
  `;
  
  EQUIPMENT_SLOTS.forEach(([slotType, x, y, name]) => {
    const slot = skipAutoLoad ? createEquipmentSlotSimple(slotType, x, y, name) : createEquipmentSlot(slotType, x, y, name);
    container.appendChild(slot);
  });
  
  return container;
}

// Create a simple equipment slot without async auto-loading (for player equipment display)
function createEquipmentSlotSimple(slotType, x, y, name) {
  const slot = document.createElement('div');
  slot.className = 'equipment-slot';
  slot.setAttribute('data-slot-type', slotType);
  slot.setAttribute('data-slot-name', name);
  slot.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: ${EQUIPMENT_CONFIG.SLOT_SIZE}px;
    height: ${EQUIPMENT_CONFIG.SLOT_SIZE}px;
    cursor: default;
    border: none;
    background: rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  `;
  
  return slot;
}

// =======================
// Arsenal Functions
// =======================

function getUserOwnedEquipment() {
  try {
    const playerSnapshot = globalThis.state?.player?.getSnapshot();
    if (!playerSnapshot) {
      console.warn('[Equipment] ⚠️ Player snapshot not available');
      return [];
    }
    
    const playerContext = playerSnapshot.context;
    if (!playerContext) {
      console.warn('[Equipment] ⚠️ Player context not available');
      return [];
    }
    
    const userEquips = playerContext.equips || [];
    
    const individualEquipment = userEquips
      .filter(equip => equip && equip.gameId)
      .map((equip, index) => {
        try {
          const equipData = globalThis.state?.utils?.getEquipment(equip.gameId);
          const equipmentName = equipData?.metadata?.name || `Equipment ID ${equip.gameId}`;
          
          return {
            id: equip.id || `equip_${index}`,
            gameId: equip.gameId,
            name: equipmentName,
            tier: equip.tier || 1,
            stat: equip.stat || 'unknown',
            count: 1
          };
        } catch (e) {
          console.warn(`[Equipment] ⚠️ Error processing equipment ${equip.gameId}:`, e);
          return null;
        }
      })
      .filter(Boolean);
    
    // Always include specific backpack IDs (inventory items) - these are always available
    const inventory = playerContext.inventory || {};
    
    for (const backpackId of SPECIAL_BACKPACK_IDS) {
      // Check if already in list
      const alreadyExists = individualEquipment.some(eq => eq.gameId === backpackId);
      if (alreadyExists) continue;
      
      // Try to get item data for this ID (might work even for inventory items)
      let itemData = null;
      try {
        itemData = globalThis.state?.utils?.getEquipment(backpackId);
      } catch (e) {
        // getEquipment might fail for inventory items, that's okay
      }
      
      // Get count from inventory
      const count = getBackpackCountFromInventory(backpackId, inventory);
      
      // Create and add backpack equipment item
      individualEquipment.push(createBackpackEquipmentItem(backpackId, itemData, count));
    }
    
    const sortedEquipment = individualEquipment.sort((a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier;
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      // Handle items without stat (like backpacks)
      const statA = a.stat || '';
      const statB = b.stat || '';
      return statA.localeCompare(statB);
    });
    
    return sortedEquipment;
  } catch (error) {
    console.error('[Equipment] 💥 Error getting user owned equipment:', error);
    return [];
  }
}

function applyTierFilter(equipment, tierFilter) {
  if (!tierFilter || tierFilter === 'all') {
    return equipment;
  }
  const tierNum = parseInt(tierFilter.substring(1));
  return equipment.filter(equip => equip.tier === tierNum);
}

function applyFilters(equipment, searchTerm, tierFilter) {
  let filtered = equipment;
  
  filtered = applyTierFilter(filtered, tierFilter);
  
  if (searchTerm) {
    filtered = filtered.filter(equip => 
      equip.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  return filtered;
}

function updateFilterButtonText(filterBtn, tierFilter) {
  if (filterBtn && tierFilter) {
    const filterValues = ['all', 't1', 't2', 't3', 't4', 't5'];
    const filterLabels = [t('mods.guilds.equipment.filterAll') || 'All', 'T1', 'T2', 'T3', 'T4', 'T5'];
    const filterIndex = filterValues.findIndex(value => value === tierFilter.toLowerCase());
    if (filterIndex >= 0) {
      filterBtn.textContent = filterLabels[filterIndex];
    }
  }
}

function createEquipmentSearchBar() {
  try {
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; margin: 0; width: 100%; box-sizing: border-box;';
  
    const searchInput = document.createElement('input');
    searchInput.placeholder = t('mods.guilds.equipment.searchPlaceholder') || 'Search equipment...';
    searchInput.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 6px; border-radius: 2px; font-size: 12px; flex: 1; font-family: inherit; outline: none; box-sizing: border-box;';
    
    searchInput.addEventListener('focus', () => {
      searchInput.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });
    
    searchInput.addEventListener('blur', () => {
      searchInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    
    const filterBtn = document.createElement('button');
    filterBtn.textContent = t('mods.guilds.equipment.filterAll') || 'All';
    filterBtn.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 8px; border-radius: 2px; font-size: 12px; cursor: pointer; font-family: inherit; outline: none; white-space: nowrap; min-width: 50px;';
    
    filterBtn.addEventListener('mouseenter', () => {
      filterBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });
    
    filterBtn.addEventListener('mouseleave', () => {
      filterBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(filterBtn);
    
    return { searchContainer, searchInput, filterBtn };
  } catch (error) {
    console.error('[Equipment] Error creating search bar:', error);
    return { searchContainer: document.createElement('div'), searchInput: document.createElement('input'), filterBtn: document.createElement('button') };
  }
}

function createEquipmentButton(equipment, onSelect) {
  const btn = document.createElement('button');
  btn.setAttribute('data-equipment', equipment.name);
  btn.setAttribute('data-equipment-id', equipment.id);
  btn.setAttribute('data-tier', equipment.tier);
  // Backpacks don't have stat
  if (equipment.stat) {
    btn.setAttribute('data-stat', equipment.stat);
  }
  
  btn.style.width = '34px';
  btn.style.height = '34px';
  btn.style.minWidth = '34px';
  btn.style.minHeight = '34px';
  btn.style.maxWidth = '34px';
  btn.style.maxHeight = '34px';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.padding = '0';
  btn.style.margin = '0';
  btn.style.border = 'none';
  btn.style.background = 'none';
  btn.style.cursor = 'pointer';
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
  
  let spriteId = '';
  let equipName = equipment.name;
  let isInventoryItem = false;
  
  try {
    const equipData = globalThis.state?.utils?.getEquipment(equipment.gameId);
    if (equipData && equipData.metadata) {
      spriteId = equipData.metadata.spriteId;
      equipName = equipData.metadata.name;
    } else {
      // For inventory items, use gameId directly as spriteId
      spriteId = equipment.gameId;
      isInventoryItem = true;
    }
  } catch (e) {
    // For inventory items that can't be accessed via getEquipment, use gameId as spriteId
    spriteId = equipment.gameId;
    isInventoryItem = true;
  }
  
  // Get slot type from database first (needed for getTargetSlotForEquipment)
  const playerEqDb = window.playerEquipmentDatabase;
  let equipmentSlot = 'Unknown';
  let targetSlotType = null; // Store the actual slot type for equipping
  if (playerEqDb && playerEqDb.EQUIPMENT_BY_SLOT) {
    for (const [slotType, items] of Object.entries(playerEqDb.EQUIPMENT_BY_SLOT)) {
      if (items.includes(equipName)) {
        targetSlotType = slotType; // Store the database slot type
        // Format slot name nicely for display
        if (slotType === 'weapon') {
          equipmentSlot = 'Weapon (Right Hand)';
        } else if (slotType === 'shield') {
          equipmentSlot = 'Shield';
        } else {
          equipmentSlot = slotType.charAt(0).toUpperCase() + slotType.slice(1);
        }
        break;
      }
    }
  }
  
  // For special backpack IDs, set target slot to 'bag'
  if (isSpecialBackpack(equipment.gameId)) {
    targetSlotType = 'bag';
    equipmentSlot = 'Backpack';
  }
  
  // Function to get the correct slot for this equipment
  const getTargetSlotForEquipment = () => {
    // If a slot is manually selected, use that
    const modal = document.querySelector('div[role="dialog"][data-state="open"]');
    if (modal) {
      const selectedSlot = modal.getAttribute('data-selected-slot');
      if (selectedSlot) {
        return selectedSlot;
      }
    }
    
    // Otherwise, use the slot from database
    if (!targetSlotType) {
      return null;
    }
    
    // Map database slot types to actual equipment slot types
    return normalizeSlotTypeFromDb(targetSlotType);
  };
  
  // Function to create viewport structure manually (like Cyclopedia)
  const createViewportStructure = (itemId) => {
    const containerSlot = document.createElement('div');
    containerSlot.className = 'container-slot surface-darker';
    containerSlot.setAttribute('data-hoverable', 'true');
    containerSlot.setAttribute('data-highlighted', 'false');
    containerSlot.setAttribute('data-disabled', 'false');
    
    const rarityDiv = document.createElement('div');
    rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
    
    const spriteContainer = document.createElement('div');
    spriteContainer.className = 'sprite item relative';
    spriteContainer.classList.add(`id-${itemId}`);
    spriteContainer.classList.add('translate-y-px');
    
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    
    const img = document.createElement('img');
    img.alt = String(itemId);
    img.setAttribute('data-cropped', 'false');
    img.className = 'spritesheet';
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
    
    viewport.appendChild(img);
    spriteContainer.appendChild(viewport);
    rarityDiv.appendChild(spriteContainer);
    containerSlot.appendChild(rarityDiv);
    
    return containerSlot;
  };
  
  if (spriteId && typeof api?.ui?.components?.createItemPortrait === 'function' && !isInventoryItem) {
    try {
      const itemPortrait = api.ui.components.createItemPortrait({
        itemId: spriteId,
        stat: equipment.stat,
        tier: equipment.tier,
        onClick: () => {
          const targetSlot = getTargetSlotForEquipment();
          if (!targetSlot) {
            console.warn('[Equipment] Could not determine target slot for', equipName);
            return;
          }
          
          // Equip the item to the target slot (will replace if already equipped)
          equipItemToSlot(equipment, targetSlot).then(success => {
            if (success && onSelect) onSelect(equipment);
          });
        }
      });
      
      btn.innerHTML = '';
      btn.appendChild(itemPortrait);
    } catch (e) {
      // Fallback to manual viewport structure
      btn.innerHTML = '';
      btn.appendChild(createViewportStructure(spriteId));
    }
  } else if (spriteId) {
    // For inventory items or when createItemPortrait is not available, create viewport manually
    btn.innerHTML = '';
    btn.appendChild(createViewportStructure(spriteId));
  } else {
    btn.textContent = equipName.charAt(0).toUpperCase();
  }
  
  // No title attribute - we use custom tooltip instead
  
  // Create tooltip for equipment
  const tooltip = createTooltipElement();
  
  // Build tooltip content
  const tooltipContent = document.createElement('div');
  tooltipContent.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
  
  const title = document.createElement('div');
  title.textContent = equipName;
  title.style.cssText = `
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 2px;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 6px;
    color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
  `;
  tooltipContent.appendChild(title);
  
  addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipSlot') || 'Slot', equipmentSlot, CSS_CONSTANTS.COLORS.TEXT_WHITE);
  addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipGuildPoints') || 'Guild Points', `+${equipment.tier}`, CSS_CONSTANTS.COLORS.SUCCESS);
  // Backpacks have no stat
  if (!isSpecialBackpack(equipment.gameId) && equipment.stat) {
    addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipStat') || 'Stat', equipment.stat.toUpperCase(), '#64b5f6');
  }
  addTooltipDetail(tooltipContent, t('mods.guilds.equipment.tooltipTier') || 'Tier', `T${equipment.tier}`, CSS_CONSTANTS.COLORS.TEXT_WHITE);
  
  tooltip.appendChild(tooltipContent);
  
  // Show/hide tooltip on hover
  let tooltipTimeout;
  const showTooltip = (e) => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      showEquipmentTooltip(tooltip);
      updateTooltipPosition(e);
    }, 300);
  };
  
  const hideTooltip = () => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    if (currentEquipmentTooltip === tooltip) {
      hideCurrentEquipmentTooltip();
    } else {
      tooltip.style.display = 'none';
    }
  };
  
  const updateTooltipPosition = (e) => {
    const rect = btn.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const position = calculateTooltipPosition(rect, tooltipRect);
    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
  };
  
  btn.addEventListener('mouseenter', showTooltip);
  btn.addEventListener('mouseleave', hideTooltip);
  btn.addEventListener('mousemove', updateTooltipPosition);
  
  // Add click handler for fallback case (when itemPortrait is not used)
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    const targetSlot = getTargetSlotForEquipment();
    if (!targetSlot) {
      console.warn('[Equipment] Could not determine target slot for', equipName);
      return;
    }
    
    // Equip the item to the target slot (will replace if already equipped)
    equipItemToSlot(equipment, targetSlot).then(success => {
      if (success && onSelect) onSelect(equipment);
    });
  });
  
  return btn;
}

function renderEquipmentList(scrollArea, equipmentItems, onSelect) {
  scrollArea.innerHTML = '';
  
  if (!equipmentItems.length) {
    scrollArea.innerHTML = `<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 6;max-width:100%;word-wrap:break-word;overflow-wrap:break-word;">${t('mods.guilds.equipment.noEquipmentFound') || 'No equipment found.'}</div>`;
    return;
  }
  
  const sortedEquipment = [...equipmentItems].sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.stat.localeCompare(b.stat);
  });
  
  for (const equipment of sortedEquipment) {
    const btn = createEquipmentButton(equipment, onSelect);
    scrollArea.appendChild(btn);
  }
}

function applyEquipmentSearch(scrollArea, searchValue, equipmentItems, onSelect) {
  try {
    if (!scrollArea || !(scrollArea instanceof HTMLElement)) {
      return;
    }
    
    const searchTerm = searchValue.toLowerCase().trim();
    
    if (searchTerm && searchTerm.length > 0) {
      const matchingEquipment = equipmentItems.filter(equipment => 
        equipment.name.toLowerCase().includes(searchTerm)
      );
      
      if (matchingEquipment.length > 0) {
        matchingEquipment.sort((a, b) => {
          if (a.tier !== b.tier) return b.tier - a.tier;
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return a.stat.localeCompare(b.stat);
        });
      }
      
      requestAnimationFrame(() => {
        scrollArea.innerHTML = '';
        
        if (matchingEquipment.length === 0) {
          const noResultsMsg = document.createElement('div');
          noResultsMsg.style.cssText = 'color: #bbb; text-align: center; padding: 16px; grid-column: span 6; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word;';
          noResultsMsg.textContent = (t('mods.guilds.equipment.noEquipmentFoundMatching') || 'No equipment found matching "{searchValue}"').replace('{searchValue}', searchValue);
          scrollArea.appendChild(noResultsMsg);
        } else {
          matchingEquipment.forEach(equipment => {
            const btn = createEquipmentButton(equipment, onSelect);
            scrollArea.appendChild(btn);
          });
        }
      });
    } else {
      renderEquipmentList(scrollArea, equipmentItems, onSelect);
    }
  } catch (error) {
    console.error('[Equipment] Error applying search:', error);
  }
}

// Function to filter equipment by slot type
function filterEquipmentBySlot(equipment, slotType) {
  if (!slotType || slotType === 'all' || slotType === 'unknown') {
    return equipment;
  }
  
  // Normalize slot type (weapon-right -> weapon, weapon-left -> shield)
  const normalizedSlot = normalizeSlotTypeForDb(slotType.toLowerCase());
  
  // Special backpack IDs that should always be included when filtering for bags
  const isBagFilter = normalizedSlot === 'bag';
  
  // Get equipment database for slot filtering (source of truth)
  const playerEqDb = window.playerEquipmentDatabase;
  if (!playerEqDb || !playerEqDb.EQUIPMENT_BY_SLOT) {
    console.warn('[Equipment] Player equipment database not available, cannot filter by slot');
    return []; // Return empty array if database not available
  }
  
  // Use database to filter
  const slotEquipment = playerEqDb.EQUIPMENT_BY_SLOT[normalizedSlot] || [];
  const slotEquipmentSet = new Set(slotEquipment.map(name => name.toLowerCase()));
  
  return equipment.filter(eq => {
    // Always allow special backpack IDs when filtering for bags
    if (isBagFilter && isSpecialBackpack(eq.gameId)) {
      return true;
    }
    // Otherwise use database filter
    return slotEquipmentSet.has(eq.name.toLowerCase());
  });
}

function getArsenalContent() {
  try {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 0; height: 100%; width: 100%; box-sizing: border-box;';
    
    const availableEquipment = getUserOwnedEquipment();
    
    const { searchContainer, searchInput, filterBtn } = createEquipmentSearchBar();
    div.appendChild(searchContainer);
    
    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex: 1 1 0; height: calc(100% - 40px); min-height: 0; width: 100%; max-width: 100%; overflow-y: auto; display: grid; grid-template-columns: repeat(6, 34px); grid-auto-rows: 34px; gap: 0; padding: 5px; background: rgba(40,40,40,0.96); box-sizing: border-box; justify-content: center;';
    
    let currentFilter = 'all';
    let currentSlotFilter = 'all';
    let filteredEquipment = availableEquipment;
    let currentSearchTerm = '';
    
    const filterValues = ['all', 't1', 't2', 't3', 't4', 't5'];
    const filterLabels = [t('mods.guilds.equipment.filterAll') || 'All', 'T1', 'T2', 'T3', 'T4', 'T5'];
    let currentFilterIndex = 0;
    
    // Function to refresh the equipment list with current filters
    const refreshEquipmentList = () => {
      const freshEquipment = getUserOwnedEquipment();
      let filtered = freshEquipment;
      
      // Apply slot filter
      if (currentSlotFilter && currentSlotFilter !== 'all') {
        filtered = filterEquipmentBySlot(filtered, currentSlotFilter);
      }
      
      // Apply tier filter
      filtered = applyTierFilter(filtered, currentFilter);
      
      // Apply search filter
      if (currentSearchTerm && currentSearchTerm.trim()) {
        filtered = filtered.filter(eq => 
          eq.name.toLowerCase().includes(currentSearchTerm.toLowerCase())
        );
      }
      
      scrollArea.innerHTML = '';
      renderEquipmentList(scrollArea, filtered, (equipment) => {
        console.log('[Equipment] Selected equipment:', equipment);
      });
      
      // Ensure buttons are enabled (they auto-equip to correct slot)
      const modal = scrollArea.closest('div[role="dialog"]');
      if (modal) {
        enableEquipmentButtons(modal, true);
      }
    };
    
    renderEquipmentList(scrollArea, filteredEquipment, (equipment) => {
      console.log('[Equipment] Selected equipment:', equipment);
    });
    
    // Ensure buttons are enabled (they auto-equip to correct slot)
    const modal = scrollArea.closest('div[role="dialog"]');
    if (modal) {
      enableEquipmentButtons(modal, true);
    }
    
    let searchTimeout;
    const debouncedSearch = (value) => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearchTerm = value;
        refreshEquipmentList();
      }, 150);
    };
    
    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });
    
    filterBtn.addEventListener('click', () => {
      currentFilterIndex = (currentFilterIndex + 1) % filterValues.length;
      currentFilter = filterValues[currentFilterIndex];
      updateFilterButtonText(filterBtn, currentFilter);
      refreshEquipmentList();
    });
    
    div.appendChild(scrollArea);
    
    // Store filter function on the div so it can be called from outside
    div.filterBySlot = (slotType) => {
      currentSlotFilter = slotType || 'all';
      refreshEquipmentList();
    };
    
    return div;
  } catch (error) {
    console.error('[Equipment] Error creating arsenal content:', error);
    return document.createElement('div');
  }
}

function createEquipmentBox({title, content}) {
  const box = document.createElement('div');
  box.style.flex = '1 1 0';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.margin = '0';
  box.style.padding = '0';
  box.style.minHeight = '0';
  box.style.height = '100%';
  box.style.background = `url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat`;
  box.style.border = '4px solid transparent';
  box.style.borderImage = CSS_CONSTANTS.BORDER_4_FRAME;
  box.style.borderRadius = '6px';
  box.style.overflow = 'hidden';
  
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text';
  titleEl.style.margin = '0';
  titleEl.style.padding = '2px 8px';
  titleEl.style.textAlign = 'center';
  titleEl.style.color = CSS_CONSTANTS.COLORS.TEXT_WHITE;
  titleEl.style.fontSize = '14px';
  titleEl.style.fontWeight = '600';
  
  const p = document.createElement('p');
  p.textContent = title;
  p.style.margin = '0';
  p.style.padding = '0';
  p.style.textAlign = 'center';
  p.style.color = CSS_CONSTANTS.COLORS.TEXT_WHITE;
  titleEl.appendChild(p);
  box.appendChild(titleEl);
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'column-content-wrapper';
  contentWrapper.style.flex = '1 1 0';
  contentWrapper.style.height = '100%';
  contentWrapper.style.minHeight = '0';
  contentWrapper.style.overflowY = 'auto';
  contentWrapper.style.display = 'flex';
  contentWrapper.style.flexDirection = 'column';
  contentWrapper.style.padding = '0';
  
  if (typeof content === 'string') {
    contentWrapper.style.alignItems = 'center';
    contentWrapper.style.justifyContent = 'center';
    contentWrapper.style.padding = '8px';
    contentWrapper.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentWrapper.style.alignItems = 'stretch';
    contentWrapper.style.justifyContent = 'flex-start';
    content.style.width = '100%';
    content.style.height = '100%';
    contentWrapper.appendChild(content);
  }
  box.appendChild(contentWrapper);
  return box;
}

function createEquipmentModalColumn(width) {
  const column = document.createElement('div');
  column.style.width = width;
  column.style.minWidth = width;
  column.style.maxWidth = width;
  column.style.height = '100%';
  column.style.flex = `0 0 ${width}`;
  column.style.display = 'flex';
  column.style.flexDirection = 'column';
  column.style.gap = '8px';
  return column;
}

function showEquipmentModal() {
  if (!ensureModalApi()) return;
  
  // Clear any existing tooltip when modal opens
  hideCurrentEquipmentTooltip();

  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
    width: 100%;
    height: 100%;
    min-width: 490px;
    max-width: 490px;
    min-height: 400px;
    max-height: 400px;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    gap: 8px;
    flex: 1 1 0;
  `;

  // Column 1: Arsenal
  const col1 = createEquipmentModalColumn('250px');
  const arsenalContent = getArsenalContent();
  arsenalContent.setAttribute('data-arsenal-content', 'true');
  const arsenalBox = createEquipmentBox({
    title: t('mods.guilds.equipment.arsenalTitle') || 'Arsenal',
    content: arsenalContent
  });
  col1.appendChild(arsenalBox);

  // Column 2: Equipment Grid (split into 2 rows)
  const col2 = createEquipmentModalColumn('200px');
  
  // Row 1: Equipment section (50% height)
  const equipmentBox = createEquipmentBox({
    title: t('mods.guilds.equipment.characterEquipmentTitle') || 'Character Equipment',
    content: (() => {
      const container = document.createElement('div');
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 100%;
      `;
      
      const equipmentGrid = createEquipmentGrid();
      container.appendChild(equipmentGrid);
      
      return container;
    })()
  });
  equipmentBox.style.flex = '0 0 50%';
  equipmentBox.style.minHeight = '0';
  col2.appendChild(equipmentBox);
  
  // Row 2: Details section (50% height)
  const detailsContainer = document.createElement('div');
  detailsContainer.setAttribute('data-details-container', 'true');
  detailsContainer.style.cssText = `
    width: 100%;
    height: 100%;
    padding: 8px;
    box-sizing: border-box;
    overflow-y: auto;
  `;
  
  const bottomBox = createEquipmentBox({
    title: t('mods.guilds.equipment.totalStatsTitle') || 'Total stats',
    content: detailsContainer
  });
  bottomBox.style.flex = '0 0 191px';
  bottomBox.style.height = '191px';
  bottomBox.style.minHeight = '191px';
  col2.appendChild(bottomBox);
  
  // Initial stats display
  updateEquipmentStats(detailsContainer);

  contentDiv.appendChild(col1);
  contentDiv.appendChild(col2);

  const modal = createStyledModal({
    title: t('mods.guilds.equipment.modalTitle') || 'Equipment',
    width: EQUIPMENT_CONFIG.MODAL_WIDTH,
    height: EQUIPMENT_CONFIG.MODAL_HEIGHT,
    content: contentDiv,
    buttons: [{
      text: t('mods.guilds.close') || 'Close',
      primary: true,
      onClick: () => {
        hideCurrentEquipmentTooltip();
      }
    }],
    onAfterCreate: (dialog) => {
      setupEscKeyHandler(dialog, () => {
        hideCurrentEquipmentTooltip();
        dialog.remove();
      });
      
      // Clean up tooltips when modal is removed
      const originalRemove = dialog.remove.bind(dialog);
      dialog.remove = function() {
        hideCurrentEquipmentTooltip();
        originalRemove();
      };
      
      // Apply modal dimensions
      setTimeout(() => {
        if (!dialog) return;
        
        const dimensions = {
          width: '490px',
          height: '490px'
        };
        
        Object.entries(dimensions).forEach(([prop, value]) => {
          dialog.style[prop] = value;
          dialog.style[`min${prop.charAt(0).toUpperCase() + prop.slice(1)}`] = value;
          dialog.style[`max${prop.charAt(0).toUpperCase() + prop.slice(1)}`] = value;
        });
        
        dialog.classList.remove('max-w-[300px]');
        
        const contentWrapper = dialog.querySelector(':scope > div:not(:first-child)') || dialog.querySelector(':scope > div');
        if (contentWrapper) {
          Object.assign(contentWrapper.style, {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0'
          });
        }
        
        // Add guild coins display to footer
        const buttonContainer = dialog.querySelector('.flex.justify-end.gap-2');
        if (buttonContainer) {
          setupGuildCoinsInFooter(buttonContainer);
        }
      }, 0);
    }
  });
}

function injectEquipmentMenuItem(guildsMenuItem) {
  const equipmentMenuItem = document.createElement('div');
  equipmentMenuItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none text-whiteRegular equipment-menu-item';
  equipmentMenuItem.setAttribute('role', 'menuitem');
  equipmentMenuItem.setAttribute('tabindex', '-1');
  equipmentMenuItem.setAttribute('data-orientation', 'vertical');
  equipmentMenuItem.setAttribute('data-radix-collection-item', '');

  // Add icon (using shield/sword icon for equipment)
  equipmentMenuItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
    <span class="relative">${t('mods.guilds.equipment.menuItem') || 'Equipment'}</span>
  `;

  // Add click handler
  equipmentMenuItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    // Close the menu first, then open modal after a short delay
    // This prevents the ESC key from closing the modal
    const closeMenuEvent = new KeyboardEvent('keydown', { 
      key: 'Escape', 
      code: 'Escape', 
      keyCode: 27, 
      bubbles: true 
    });
    document.dispatchEvent(closeMenuEvent);
    
    // Wait for menu to close, then open modal
    setTimeout(() => {
      showEquipmentModal();
    }, 150);
  });

  // Insert right after Guilds menu item
  guildsMenuItem.parentNode.insertBefore(equipmentMenuItem, guildsMenuItem.nextSibling);
}

// =======================
// State & Observers
// =======================

let accountMenuObserver = null;
let cacheCleanupInterval = null;
let firebase401WarningShown = false;

function startAccountMenuObserver() {
  if (accountMenuObserver) return;

  accountMenuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const isMenu = node.getAttribute?.('role') === 'menu';
        const hasMenu = node.querySelector?.('[role="menu"]');
        const menu = isMenu ? node : hasMenu;
        if (menu) {
          // Wait a bit longer to ensure VIP List is injected first
          setTimeout(() => injectGuildMenuItem(menu), 50);
        }
      }
    }
  });

  accountMenuObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Check existing menus with a delay to ensure VIP List is loaded first
  setTimeout(() => {
    const menus = document.querySelectorAll('[role="menu"]');
    menus.forEach(menu => injectGuildMenuItem(menu));
  }, 100);
}

// =======================
// Initialization
// =======================

// Helper function to sync guild chat tab with retry
function syncGuildChatTabWithRetry(retries = 3, delay = 1000) {
  if (typeof window === 'undefined' || typeof window.syncGuildChatTab !== 'function') {
    if (retries > 0) {
      setTimeout(() => syncGuildChatTabWithRetry(retries - 1, delay), delay);
    } else {
      console.warn('[Guilds] syncGuildChatTab not available after retries');
    }
    return;
  }
  
  try {
    window.syncGuildChatTab();
  } catch (error) {
    console.error('[Guilds] Error syncing guild chat tab:', error);
  }
}

async function initializeGuilds() {
  console.log('[Guilds] initialized');
  
  // Start periodic cache cleanup (every 5 minutes)
  if (!cacheCleanupInterval) {
    cacheCleanupInterval = setInterval(() => {
      try {
        playerExistsCache.cleanup();
        playerProfileCache.cleanup();
        guildPointsCache.cleanup();
      } catch (error) {
        console.error('[Guilds] Error during cache cleanup:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  // Sync player's guild from Firebase and verify membership
  try {
    const currentPlayer = getCurrentPlayerName();
    if (!currentPlayer) {
      console.warn('[Guilds] Player name not available during initialization, will retry...');
      // Retry after a delay if player name isn't available yet
      setTimeout(async () => {
        const retryPlayer = getCurrentPlayerName();
        if (retryPlayer) {
          await syncGuildFromFirebase(retryPlayer);
          // Clean up unknown equipment on retry
          await removeUnknownEquipment();
        }
      }, 2000);
      startAccountMenuObserver();
      return;
    }
    
    await syncGuildFromFirebase(currentPlayer);
    
    // Clean up unknown equipment slots on initialization (unknown cannot be equipped)
    try {
      const result = await removeUnknownEquipment();
      if (result.removed > 0) {
        console.log(`[Guilds] Removed ${result.removed} unknown equipment slot(s) from Firebase`);
      }
    } catch (error) {
      console.error('[Guilds] Error cleaning up unknown equipment:', error);
    }
  } catch (error) {
    console.error('[Guilds] Error initializing:', error);
  }

  // Start menu observer
  startAccountMenuObserver();
  
  // Initialize guild coins drop system
  setupGuildCoinsDropSystem();
}

async function syncGuildFromFirebase(currentPlayer) {
  try {
    console.log('[Guilds] Starting sync for player:', currentPlayer);
    const hashedPlayer = await hashUsername(currentPlayer);
    console.log('[Guilds] Hashed player:', hashedPlayer);
    
    // First, check if player is in members list of any guild (source of truth)
    console.log('[Guilds] Checking all guilds for membership...');
    const allGuildsResponse = await fetch(`${getGuildsApiUrl()}.json`);
    let foundGuild = null;
    let foundGuildId = null;
    
    if (allGuildsResponse.ok) {
      const allGuilds = await allGuildsResponse.json();
      if (allGuilds) {
        for (const [guildId, guild] of Object.entries(allGuilds)) {
          const members = await getGuildMembers(guildId);
          const isMember = members.some(m => m.usernameHashed === hashedPlayer);
          if (isMember) {
            foundGuild = { ...guild, id: guildId };
            foundGuildId = guildId;
            console.log('[Guilds] Found player in guild members:', guild.name, '(ID:', guildId + ')');
            break;
          }
        }
      }
    }
    
    // Check player reference in Firebase
    const playerRefResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
    const hasPlayerRef = playerRefResponse.ok;
    let playerRefData = null;
    if (hasPlayerRef) {
      playerRefData = await playerRefResponse.json();
      console.log('[Guilds] Player reference exists:', playerRefData);
    } else {
      console.log('[Guilds] No player reference found (status:', playerRefResponse.status + ')');
    }
    
    // Sync logic: members list is source of truth
    if (foundGuild) {
      // Player is a member - ensure player reference matches
      if (!hasPlayerRef || !playerRefData || playerRefData.guildId !== foundGuildId) {
        console.log('[Guilds] Fixing player reference - creating/updating to match membership');
        const updateResult = await updatePlayerGuildReference(hashedPlayer, foundGuildId, foundGuild.name);
        
        if (updateResult) {
          // Verify it was created
          const verifyResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log('[Guilds] Verified player reference created:', verifyData);
          } else {
            console.error('[Guilds] Failed to verify player reference creation - status:', verifyResponse.status);
          }
        } else {
          console.error('[Guilds] Failed to update player reference');
        }
      } else {
        console.log('[Guilds] Player reference already matches membership');
      }
      
      // Save to localStorage and sync chat
      savePlayerGuild(foundGuild);
      console.log('[Guilds] Saved guild to localStorage:', foundGuild.name);
      syncGuildChatTabWithRetry();
      return;
    } else {
      // Player is not a member of any guild
      if (hasPlayerRef && playerRefData) {
        console.warn('[Guilds] Player reference exists but player is not a member - cleaning up');
        await updatePlayerGuildReference(hashedPlayer, null, null);
      }
      
      // Clear localStorage if it says otherwise
      const localGuild = getPlayerGuild();
      if (localGuild) {
        console.warn('[Guilds] Clearing localStorage - player is not in any guild');
        clearPlayerGuild();
      }
      syncGuildChatTabWithRetry();
    }
  } catch (error) {
    console.error('[Guilds] Error syncing guild from Firebase:', error);
    console.error('[Guilds] Error stack:', error.stack);
  }
}

// Comprehensive sync function to ensure all members and players are in sync
async function syncAllMembersAndPlayers() {
  try {
    console.log('[Guilds] Starting comprehensive sync of all members and players...');
    
    // Get all guilds
    const allGuildsResponse = await fetch(`${getGuildsApiUrl()}.json`);
    if (!allGuildsResponse.ok) {
      console.error('[Guilds] Failed to fetch all guilds:', allGuildsResponse.status);
      return;
    }
    
    const allGuilds = await allGuildsResponse.json();
    if (!allGuilds) {
      console.log('[Guilds] No guilds found');
      return;
    }
    
    const membersToPlayers = new Map(); // Track which members need player references
    
    // Check all members in all guilds
    for (const [guildId, guild] of Object.entries(allGuilds)) {
      const members = await getGuildMembers(guildId);
      for (const member of members) {
        if (member.usernameHashed) {
          membersToPlayers.set(member.usernameHashed, {
            guildId: guildId,
            guildName: guild.name,
            username: member.username
          });
        }
      }
    }
    
    console.log('[Guilds] Found', membersToPlayers.size, 'members across all guilds');
    
    // Get all player references
    const allPlayersResponse = await fetch(`${getPlayerGuildApiUrl()}.json`);
    const allPlayers = allPlayersResponse.ok ? await allPlayersResponse.json() : {};
    
    // Fix missing player references
    let fixedCount = 0;
    for (const [hashedPlayer, memberInfo] of membersToPlayers.entries()) {
      const playerRef = allPlayers[hashedPlayer];
      if (!playerRef || playerRef.guildId !== memberInfo.guildId) {
        console.log('[Guilds] Fixing missing/incorrect player reference for:', memberInfo.username, '(hash:', hashedPlayer + ')');
        await updatePlayerGuildReference(hashedPlayer, memberInfo.guildId, memberInfo.guildName);
        fixedCount++;
      }
    }
    
    // Remove orphaned player references (players that are not members)
    let removedCount = 0;
    for (const [hashedPlayer, playerRef] of Object.entries(allPlayers || {})) {
      if (playerRef && playerRef.guildId) {
        const memberInfo = membersToPlayers.get(hashedPlayer);
        if (!memberInfo || memberInfo.guildId !== playerRef.guildId) {
          console.log('[Guilds] Removing orphaned player reference for hash:', hashedPlayer);
          await updatePlayerGuildReference(hashedPlayer, null, null);
          removedCount++;
        }
      }
    }
    
    console.log('[Guilds] Sync complete - Fixed:', fixedCount, 'Removed:', removedCount);
  } catch (error) {
    console.error('[Guilds] Error in comprehensive sync:', error);
  }
}

// =======================
// Exports & Lifecycle Management
// =======================

exports = {
  init: function() {
    try {
      initializeGuilds();
      return true;
    } catch (error) {
      console.error('[Guilds] Initialization error:', error);
      return false;
    }
  },
  
  syncGuildFromFirebase: async function() {
    const currentPlayer = getCurrentPlayerName();
    if (currentPlayer) {
      await syncGuildFromFirebase(currentPlayer);
    } else {
      console.warn('[Guilds] Cannot sync: player name not available');
    }
  },
  
  syncAllMembersAndPlayers: async function() {
    await syncAllMembersAndPlayers();
  },
  
  cleanup: function() {
    try {
      // Stop account menu observer
      if (accountMenuObserver) {
        accountMenuObserver.disconnect();
        accountMenuObserver = null;
      }
      
      // Remove guild dropdown click handler
      if (guildDropdownClickHandler) {
        document.removeEventListener('click', guildDropdownClickHandler);
        guildDropdownClickHandler = null;
      }
      
      // Remove window message listener
      if (windowMessageHandler && typeof window !== 'undefined') {
        window.removeEventListener('message', windowMessageHandler);
        windowMessageHandler = null;
      }
      
      // Clear cache cleanup interval
      if (cacheCleanupInterval) {
        clearInterval(cacheCleanupInterval);
        cacheCleanupInterval = null;
      }
      
      // Clear all caches
      try {
        playerExistsCache.clear();
        playerProfileCache.clear();
        guildPointsCache.clear();
      } catch (error) {
        console.error('[Guilds] Error clearing caches:', error);
      }
      
      // Clean up guild coins board subscription
      if (guildCoinsBoardSubscription) {
        if (typeof guildCoinsBoardSubscription === 'function') {
          guildCoinsBoardSubscription();
        }
        guildCoinsBoardSubscription = null;
      }
      
      // Clear coin display element reference
      guildCoinsDisplayElement = null;
      lastProcessedSeed = null;
      
      console.log('[Guilds] Cleaned up successfully');
      return true;
    } catch (error) {
      console.error('[Guilds] Cleanup error:', error);
      return false;
    }
  }
};

// Expose sync functions globally for manual use
if (typeof window !== 'undefined') {
  window.syncGuildFromFirebase = async function() {
    const currentPlayer = getCurrentPlayerName();
    if (currentPlayer) {
      await syncGuildFromFirebase(currentPlayer);
    } else {
      console.warn('[Guilds] Cannot sync: player name not available');
    }
  };
  
  window.syncAllMembersAndPlayers = async function() {
    await syncAllMembersAndPlayers();
  };
}

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}

