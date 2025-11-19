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

const PANEL_DIMENSIONS = {
  WIDTH: 600,
  HEIGHT: 500,
  MIN_WIDTH: 400,
  MAX_WIDTH: 800,
  MIN_HEIGHT: 300,
  MAX_HEIGHT: 600
};

const PANEL_ID = 'guilds-panel';

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

// =======================
// Utility Functions
// =======================

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
    const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
    
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

// Validate current player and get player name
function validateCurrentPlayer() {
  const currentPlayer = getCurrentPlayerName();
  if (!currentPlayer) {
    throw new Error('Could not get current player name');
  }
  return currentPlayer;
}

// Update player's guild reference in Firebase
async function updatePlayerGuildReference(hashedPlayer, guildId, guildName) {
  const url = `${getPlayerGuildApiUrl()}/${hashedPlayer}.json`;
  if (guildId) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, guildName })
    });
    if (!response.ok) {
      console.warn('[Guilds] Failed to update player guild reference');
    }
  } else {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      console.warn('[Guilds] Failed to remove player guild reference');
    }
  }
}

// Update guild member count
async function updateGuildMemberCount(guildId) {
  const members = await getGuildMembers(guildId);
  await fetch(`${getGuildsApiUrl()}/${guildId}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberCount: members.length })
  });
}

// Button style constants
const BUTTON_STYLES = {
  PRIMARY: 'background: rgba(76, 175, 80, 0.3); border-color: rgba(76, 175, 80, 0.5);',
  DANGER: 'background: rgba(255, 107, 107, 0.3); border-color: rgba(255, 107, 107, 0.5);',
  WARNING: 'background: rgba(255, 193, 7, 0.3); border-color: rgba(255, 193, 7, 0.5);',
  DISABLED: 'background: rgba(128, 128, 128, 0.3); border-color: rgba(128, 128, 128, 0.5); opacity: 0.6;'
};

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
    font-size: ${type === 'textarea' ? '12px' : '14px'};
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
    font-size: 14px;
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
  label.style.cssText = `display: block; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 14px; margin-bottom: 4px;`;
  
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
    const hashedPlayer = await hashUsername(currentPlayer);
    const playerGuildCheckResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
    if (playerGuildCheckResponse.ok) {
      const playerGuildCheck = await playerGuildCheckResponse.json();
      if (playerGuildCheck && playerGuildCheck.guildId) {
        throw new Error('You are already a member of a guild. Leave your current guild before creating a new one.');
      }
    }

    // Also check localStorage as fallback
    const localGuild = getPlayerGuild();
    if (localGuild && localGuild.id) {
      throw new Error('You are already a member of a guild. Leave your current guild before creating a new one.');
    }

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
    const guildResponse = await fetch(`${getGuildsApiUrl()}/${guildId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guildData)
    });

    if (!guildResponse.ok) {
      throw new Error(`Failed to create guild: ${guildResponse.status}`);
    }

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

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
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

    const hashedPlayer = await hashUsername(currentPlayer);
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

    const response = await fetch(`${getGuildMembersApiUrl(guildId)}/${hashedPlayer}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData)
    });

    if (!response.ok) {
      throw new Error(`Failed to join guild: ${response.status}`);
    }

    // Update member count
    await updateGuildMemberCount(guildId);

    // Update player's guild reference
    await updatePlayerGuildReference(hashedPlayer, guildId, guild.name);

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
      throw new Error('Guild not found');
    }

    if (guild.leader.toLowerCase() === currentPlayer.toLowerCase()) {
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
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    if (guild.leader.toLowerCase() !== currentPlayer.toLowerCase()) {
      throw new Error('Only the guild leader can update the join type');
    }

    if (newJoinType !== GUILD_JOIN_TYPES.OPEN && newJoinType !== GUILD_JOIN_TYPES.INVITE_ONLY) {
      throw new Error('Invalid join type');
    }

    const response = await fetch(`${getGuildsApiUrl()}/${guildId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinType: newJoinType })
    });

    if (!response.ok) {
      throw new Error(`Failed to update join type: ${response.status}`);
    }

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
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    if (guild.leader.toLowerCase() !== currentPlayer.toLowerCase()) {
      throw new Error('Only the guild leader can update the description');
    }

    if (newDescription.length > GUILD_CONFIG.maxGuildDescriptionLength) {
      throw new Error(`Description must be ${GUILD_CONFIG.maxGuildDescriptionLength} characters or less`);
    }

    const response = await fetch(`${getGuildsApiUrl()}/${guildId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDescription.trim() })
    });

    if (!response.ok) {
      throw new Error(`Failed to update description: ${response.status}`);
    }

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
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    if (guild.leader.toLowerCase() !== currentPlayer.toLowerCase()) {
      throw new Error('Only the current leader can transfer leadership');
    }

    const members = await getGuildMembers(guildId);
    const newLeader = members.find(m => m.username.toLowerCase() === newLeaderUsername.toLowerCase());
    
    if (!newLeader) {
      throw new Error('Member not found');
    }

    if (newLeader.username.toLowerCase() === currentPlayer.toLowerCase()) {
      throw new Error('You are already the leader');
    }

    const newLeaderHashed = await hashUsername(newLeaderUsername);
    const currentLeaderHashed = await hashUsername(currentPlayer);

    // Update guild leader
    await fetch(`${getGuildsApiUrl()}/${guildId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        leader: newLeaderUsername,
        leaderHashed: newLeaderHashed
      })
    });

    // Update member roles
    await fetch(`${getGuildMembersApiUrl(guildId)}/${currentLeaderHashed}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: GUILD_ROLES.MEMBER })
    });

    await fetch(`${getGuildMembersApiUrl(guildId)}/${newLeaderHashed}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: GUILD_ROLES.LEADER })
    });

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
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    const members = await getGuildMembers(guildId);
    const currentMember = members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase());
    const targetMember = members.find(m => m.username.toLowerCase() === memberUsername.toLowerCase());

    if (!currentMember || !targetMember) {
      throw new Error('Member not found');
    }

    if (!canPerformAction(currentMember.role, targetMember.role, 'promote')) {
      throw new Error('You do not have permission to promote this member');
    }

    if (targetMember.role !== GUILD_ROLES.MEMBER) {
      throw new Error('Can only promote members to officer');
    }

    const hashedMember = await hashUsername(memberUsername);
    await fetch(`${getGuildMembersApiUrl(guildId)}/${hashedMember}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: GUILD_ROLES.OFFICER })
    });

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
    const currentPlayer = validateCurrentPlayer();

    const guild = await getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    const members = await getGuildMembers(guildId);
    const currentMember = members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase());
    const targetMember = members.find(m => m.username.toLowerCase() === memberUsername.toLowerCase());

    if (!currentMember || !targetMember) {
      throw new Error('Member not found');
    }

    if (!canPerformAction(currentMember.role, targetMember.role, 'demote')) {
      throw new Error('You do not have permission to demote this member');
    }

    if (targetMember.role !== GUILD_ROLES.OFFICER) {
      throw new Error('Can only demote officers to member');
    }

    const hashedMember = await hashUsername(memberUsername);
    await fetch(`${getGuildMembersApiUrl(guildId)}/${hashedMember}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: GUILD_ROLES.MEMBER })
    });

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
      throw new Error('Guild not found');
    }

    const members = await getGuildMembers(guildId);
    const currentMember = members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase());
    const targetMember = members.find(m => m.username.toLowerCase() === memberUsername.toLowerCase());

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
      throw new Error('Guild not found');
    }

    if (guild.leader.toLowerCase() !== currentPlayer.toLowerCase()) {
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
      throw new Error('Guild not found');
    }

    const members = await getGuildMembers(guildId);
    const currentMember = members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase());

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

    const response = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteData)
    });

    if (!response.ok) {
      throw new Error(`Failed to send invite: ${response.status}`);
    }

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
    const currentMember = members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase());
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
    const response = await fetch(`${getGuildChatApiUrl(guildId)}/${messageId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

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
  COLORS: {
    TEXT_PRIMARY: 'rgb(230, 215, 176)',
    TEXT_WHITE: 'rgb(255, 255, 255)',
    ERROR: '#ff6b6b',
    SUCCESS: '#4caf50',
    ROLE_LEADER: '#ffd700', // Gold for leader
    ROLE_OFFICER: '#64b5f6', // Blue for officer
    ROLE_MEMBER: '#a5d6a7' // Green for member
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
  // Check if button's parent has position: relative
  const relativeParent = button.closest('div[style*="position: relative"]') || 
                         (button.parentElement && getComputedStyle(button.parentElement).position === 'relative' ? button.parentElement : null);
  
  if (relativeParent) {
    // Use absolute positioning relative to the positioned parent
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
  } else {
    // Fallback to fixed positioning
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
    position: absolute;
    top: 100%;
    left: 0;
    transform: none;
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 4px solid transparent;
    border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
    min-width: 120px;
    z-index: 10001;
    margin-top: 4px;
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
    selected = false
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
  
  addHoverEffect(menuItem);
  menuItem.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
    dropdown.style.display = 'none';
  });
  
  return menuItem;
}

// Toggle dropdown visibility with positioning
function toggleDropdown(dropdown, button, container) {
  const isVisible = dropdown.style.display === 'block';
  closeAllDropdownsExcept(dropdown);
  
  if (!isVisible) {
    const openUpward = shouldDropdownOpenUpward(dropdown, button, container);
    dropdown.style.display = 'block';
    void dropdown.offsetHeight;
    positionDropdown(dropdown, button, openUpward, container);
  } else {
    resetDropdownStyles(dropdown);
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
  titleEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  titleEl.style.fontSize = '14px';
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
    const currentPlayer = getCurrentPlayerName();
    if (currentPlayer) {
      const hashedPlayer = await hashUsername(currentPlayer);
      const playerGuildResponse = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
      if (playerGuildResponse.ok) {
        const playerGuild = await playerGuildResponse.json();
        if (playerGuild && playerGuild.guildId) {
          showWarningModal(t('mods.guilds.cannotCreateGuild'), t('mods.guilds.alreadyInGuild'));
          return;
        }
      }

      // Also check localStorage as fallback
      const localGuild = getPlayerGuild();
      if (localGuild && localGuild.id) {
        showWarningModal(t('mods.guilds.cannotCreateGuild'), t('mods.guilds.alreadyInGuild'));
        return;
      }
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
      const handleEsc = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
          dialog.remove();
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);
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

  async function loadGuilds(searchTerm = '') {
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
      const guildItem = document.createElement('div');
      guildItem.style.cssText = `
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 8px 0;
        margin-bottom: 4px;
        background: rgba(255, 255, 255, 0.05);
        width: 100%;
      `;

      const guildNameCell = document.createElement('div');
      guildNameCell.style.cssText = `
        flex: 2 1 0%;
        text-align: center;
        position: relative;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
      `;
      const guildName = document.createElement('div');
      guildName.style.cssText = `
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-weight: 600;
      `;
      const nameText = document.createTextNode(guild.name);
      guildName.appendChild(nameText);
      if (guild.abbreviation) {
        const abbrevSpan = document.createElement('span');
        abbrevSpan.textContent = ` [${guild.abbreviation}]`;
        abbrevSpan.style.cssText = `
          color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
          opacity: 0.7;
          font-size: 12px;
          font-weight: normal;
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
          font-size: 11px;
          font-weight: normal;
          font-style: italic;
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
      `;
      memberCountCell.textContent = `${guild.memberCount || 0}/${GUILD_CONFIG.maxMembers}`;

      const leaderCell = document.createElement('div');
      leaderCell.style.cssText = `
        flex: 1.2 1 0%;
        text-align: center;
        position: relative;
        color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
        font-size: 12px;
        opacity: 0.8;
      `;
      leaderCell.textContent = guild.leader;
      
      const isPlayerGuild = playerGuild && playerGuild.id === guild.id;
      
      // Check if player is already a member
      let isAlreadyMember = false;
      if (hashedPlayer && !isPlayerGuild) {
        const members = await getGuildMembers(guild.id);
        isAlreadyMember = members.some(m => m.usernameHashed === hashedPlayer);
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
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    letter-spacing: 0.2px;
    width: 100%;
  `;

  const createHeaderCell = (text, flex = '1') => {
    const cell = document.createElement('div');
    cell.textContent = text;
    cell.style.cssText = `
      flex: ${flex};
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      text-align: center;
      white-space: nowrap;
      position: relative;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.2px;
    `;
    return cell;
  };

  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnName'), '2 1 0%'));
  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnMembers'), '0.8 1 0%'));
  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnLeader'), '1.2 1 0%'));
  headerRow.appendChild(createHeaderCell(t('mods.guilds.columnAction'), '1 1 0%'));

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
      font-size: 14px;
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
      loadGuilds(e.target.value);
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
        await loadGuilds();
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
      const handleEsc = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
          dialog.remove();
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);
    }
  }, 100);
}

async function openGuildPanel() {
  if (!ensureModalApi()) return;

  const playerGuild = getPlayerGuild();
  if (!playerGuild) {
    const invites = await getPlayerInvites();
    if (invites.length > 0) {
      showInvitesDialog();
      return;
    }
    showGuildBrowser();
    return;
  }

  const guild = await getGuild(playerGuild.id);
  if (!guild) {
    clearPlayerGuild();
    showGuildBrowser();
    return;
  }

  const members = await getGuildMembers(guild.id);
  const currentPlayer = getCurrentPlayerName();
  const currentMember = members.find(m => m.username.toLowerCase() === currentPlayer.toLowerCase());

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

  members.forEach(member => {
    const memberItem = document.createElement('div');
    memberItem.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 10px 8px;
      margin-bottom: 6px;
      background: rgba(255, 255, 255, 0.05);
      width: 100%;
      border-radius: 2px;
    `;

    const memberInfo = document.createElement('div');
    memberInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
    `;
    
    const memberName = document.createElement('span');
    memberName.textContent = member.username;
    if (member.username.toLowerCase() === currentPlayer.toLowerCase()) {
      memberName.textContent += ' ' + t('mods.guilds.youSuffix');
    }
    memberName.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
    `;
    
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
      font-size: 11px;
      opacity: 0.9;
      color: ${roleColor};
      line-height: 1.3;
      font-weight: 500;
    `;
    
    memberInfo.appendChild(memberName);
    memberInfo.appendChild(memberRole);
    memberItem.appendChild(memberInfo);

    if (currentMember && member.username.toLowerCase() !== currentPlayer.toLowerCase()) {
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 4px; align-items: center;';

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
            text: t('mods.guilds.cancel'),
            onClick: () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
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
      title.textContent = 'Invited Players:';
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
        invitedBy.textContent = `Invited by ${invite.invitedBy}`;
        invitedBy.style.cssText = `font-size: 9px; opacity: 0.6; color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; margin-top: 2px;`;
        
        playerInfo.appendChild(playerName);
        playerInfo.appendChild(invitedBy);
        inviteItem.appendChild(playerInfo);
        
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

  // Change Description (Leader only)
  if (isLeader) {
    const descSection = document.createElement('div');
    descSection.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    
    const descLabel = document.createElement('label');
    descLabel.textContent = t('mods.guilds.description');
    descLabel.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
    
    const currentDesc = document.createElement('div');
    currentDesc.textContent = guild.description || t('mods.guilds.noDescription');
    currentDesc.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 12px;
      opacity: 0.8;
      padding: 4px;
      min-height: 20px;
      word-wrap: break-word;
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
            text: t('mods.guilds.cancel'),
            onClick: () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
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
    joinTypeSection.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 8px;';
    
    const joinTypeLabel = document.createElement('label');
    joinTypeLabel.textContent = t('mods.guilds.joinTypeLabel');
    joinTypeLabel.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
    
    const currentJoinType = document.createElement('div');
    const joinType = guild.joinType || GUILD_JOIN_TYPES.OPEN;
    currentJoinType.textContent = joinType === GUILD_JOIN_TYPES.OPEN 
      ? t('mods.guilds.joinTypeOpen') 
      : t('mods.guilds.joinTypeInviteOnly');
    currentJoinType.style.cssText = `
      color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
      font-size: 12px;
      opacity: 0.8;
      padding: 4px;
      min-height: 20px;
    `;
    
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
            text: t('mods.guilds.cancel'),
            onClick: () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
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
            text: t('mods.guilds.cancel'),
            onClick: () => {
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
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

  const setupFooter = (buttonContainer) => {
    const backBtn = document.createElement('button');
    backBtn.textContent = t('mods.guilds.backButton');
    backBtn.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
    backBtn.style.cssText = 'cursor: pointer; white-space: nowrap; box-sizing: border-box; max-height: 21px; height: 21px; font-size: 14px;';
    backBtn.addEventListener('click', () => {
      const dialog = getOpenDialog();
      if (dialog) dialog.remove();
      showGuildBrowser();
    });
    buttonContainer.insertBefore(backBtn, buttonContainer.firstChild);
  };

  const modalTitle = guild.abbreviation ? `${guild.name} [${guild.abbreviation}]` : guild.name;
  const modal = api.ui.components.createModal({
    title: modalTitle,
    width: MODAL_DIMENSIONS.WIDTH,
    height: MODAL_DIMENSIONS.HEIGHT,
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
      applyModalStyles(dialog, MODAL_DIMENSIONS.WIDTH, MODAL_DIMENSIONS.HEIGHT);
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
}

// =======================
// State & Observers
// =======================

let accountMenuObserver = null;
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

async function initializeGuilds() {
  console.log('[Guilds] initialized');
  
  // Sync player's guild from Firebase
  try {
    const currentPlayer = getCurrentPlayerName();
    if (currentPlayer) {
      const hashedPlayer = await hashUsername(currentPlayer);
      const response = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}.json`);
      if (response.ok) {
        const playerGuild = await response.json();
        if (playerGuild && playerGuild.guildId) {
          const guild = await getGuild(playerGuild.guildId);
          if (guild) {
            savePlayerGuild(guild);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Guilds] Error initializing:', error);
  }

  // Start menu observer
  startAccountMenuObserver();
}

// Initialize when mod loads
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGuilds);
  } else {
    initializeGuilds();
  }
}

