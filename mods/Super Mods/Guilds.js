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
    console.error('[Guilds] Username hashing error:', error);
    return username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }
}

async function hashGuildId(guildName) {
  return await hashUsername(guildName);
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
  
  api.ui.components.createModal({
    title,
    width,
    content: warningContent,
    buttons: [{ text: 'OK', primary: true, onClick: () => {} }]
  });
  
  setTimeout(() => {
    const dialog = getOpenDialog();
    if (dialog) applyModalStyles(dialog, width, null);
  }, 100);
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

async function createGuild(guildName, description = '', abbreviation = '') {
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
      memberCount: 1
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

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} left the guild`);

    return true;
  } catch (error) {
    console.error('[Guilds] Error leaving guild:', error);
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

    const hashedPlayer = await hashUsername(playerName);
    const existingMember = members.find(m => m.usernameHashed === hashedPlayer);
    if (existingMember) {
      throw new Error('Player is already a member');
    }

    const inviteData = {
      guildId,
      guildName: guild.name,
      invitedBy: currentPlayer,
      invitedByHashed: await hashUsername(currentPlayer),
      invitedAt: Date.now()
    };

    // Store invite in player's invites path
    const response = await fetch(`${getPlayerGuildApiUrl()}/${hashedPlayer}/invites/${guildId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteData)
    });

    if (!response.ok) {
      throw new Error(`Failed to send invite: ${response.status}`);
    }

    // Post system message
    await sendGuildSystemMessage(guildId, `${currentPlayer} invited ${playerName} to the guild`);

    return true;
  } catch (error) {
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
    SUCCESS: '#4caf50'
  }
};

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
  if (typeof api === 'undefined' || !api.ui || !api.ui.components || !api.ui.components.createModal) {
    console.error('[Guilds] Modal API not available');
    return;
  }

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
  contentDiv.appendChild(errorMsg);

  let createBtnRef = null;
  const modal = api.ui.components.createModal({
    title: t('mods.guilds.createGuildTitle'),
    width: 450,
    height: 320,
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
            await createGuild(name, desc, abbrev);
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
      applyModalStyles(dialog, 450, 320);
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
  const invites = await getPlayerInvites();
  if (invites.length === 0) {
    alert(t('mods.guilds.noPendingInvites'));
    return;
  }

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
    border: 6px solid transparent;
    border-image: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
    padding: 20px;
    z-index: 10000;
    min-width: 400px;
    max-width: 500px;
    max-height: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  `;

  const title = document.createElement('h3');
  title.textContent = t('mods.guilds.invitesTitle');
  title.style.cssText = `
    margin: 0 0 16px 0;
    color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
    font-size: 16px;
    font-weight: 600;
  `;

  const invitesList = document.createElement('div');
  invitesList.style.cssText = `
    flex: 1;
    overflow-y: auto;
    margin-bottom: 16px;
  `;

  invites.forEach(invite => {
    const inviteItem = document.createElement('div');
    inviteItem.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
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
      try {
        await acceptInvite(invite.guildId);
        document.body.removeChild(dialog);
        await openGuildPanel();
      } catch (error) {
        alert(error.message);
      }
    }, { background: 'rgba(76, 175, 80, 0.3)', flex: '1' });

    const declineBtn = createButton(t('mods.guilds.decline'), async () => {
      try {
        await declineInvite(invite.guildId);
        document.body.removeChild(dialog);
        if (invites.length > 1) {
          showInvitesDialog();
        }
      } catch (error) {
        alert(error.message);
      }
    }, { background: 'rgba(255, 107, 107, 0.3)', flex: '1' });

    buttonContainer.appendChild(acceptBtn);
    buttonContainer.appendChild(declineBtn);

    inviteItem.appendChild(guildName);
    inviteItem.appendChild(invitedBy);
    inviteItem.appendChild(buttonContainer);
    invitesList.appendChild(inviteItem);
  });

  const closeBtn = createButton(t('mods.guilds.close'), () => {
    document.body.removeChild(dialog);
  }, { width: '100%' });

  dialog.appendChild(title);
  dialog.appendChild(invitesList);
  dialog.appendChild(closeBtn);

  document.body.appendChild(dialog);

  const escHandler = (e) => {
    if (e.key === 'Escape' && document.contains(dialog)) {
      document.body.removeChild(dialog);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

async function showGuildBrowser() {
  if (typeof api === 'undefined' || !api.ui || !api.ui.components || !api.ui.components.createModal) {
    console.error('[Guilds] Modal API not available');
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
            alert(error.message);
            loadGuilds(searchInput.value);
          }
        });
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

async function openGuildPanel() {
  if (typeof api === 'undefined' || !api.ui || !api.ui.components || !api.ui.components.createModal) {
    console.error('[Guilds] Modal API not available');
    return;
  }

  const playerGuild = getPlayerGuild();
  if (!playerGuild) {
    const invites = await getPlayerInvites();
    if (invites.length > 0) {
      if (confirm(tReplace('mods.guilds.pendingInvitesConfirm', { count: invites.length }))) {
        showInvitesDialog();
        return;
      }
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
      padding: 8px 0;
      margin-bottom: 4px;
      background: rgba(255, 255, 255, 0.05);
      width: 100%;
    `;

    const memberInfo = document.createElement('div');
    memberInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};
    `;
    
    const memberName = document.createElement('span');
    memberName.textContent = member.username;
    if (member.username.toLowerCase() === currentPlayer.toLowerCase()) {
      memberName.textContent += ' ' + t('mods.guilds.youSuffix');
    }
    memberName.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};`;
    
    const memberRole = document.createElement('span');
    const roleKey = `mods.guilds.role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`;
    memberRole.textContent = t(roleKey);
    memberRole.style.cssText = `font-size: 10px; opacity: 0.7; color: ${CSS_CONSTANTS.COLORS.TEXT_PRIMARY};`;
    
    memberInfo.appendChild(memberName);
    memberInfo.appendChild(memberRole);
    memberItem.appendChild(memberInfo);

    if (currentMember && canPerformAction(currentMember.role, member.role, 'kick') && 
        member.username.toLowerCase() !== currentPlayer.toLowerCase()) {
      const kickBtn = createButton(t('mods.guilds.kick'), async () => {
        if (confirm(tReplace('mods.guilds.kickConfirm', { name: member.username }))) {
          try {
            await kickMember(guild.id, member.username);
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            await openGuildPanel();
          } catch (error) {
            alert(error.message);
          }
        }
      }, { background: 'rgba(255, 107, 107, 0.3)', padding: '2px 6px', fontSize: '10px' });
      memberItem.appendChild(kickBtn);
    }

    membersList.appendChild(memberItem);
  });

  if (currentMember && hasPermission(currentMember.role, 'invite')) {
    const inviteBtn = createButton('+ ' + t('mods.guilds.invitePlayerTitle'), async () => {
      const inviteModal = api.ui.components.createModal({
        title: t('mods.guilds.invitePlayerTitle'),
        width: 400,
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
                alert(t('mods.guilds.enterPlayerName'));
                return;
              }
              
              try {
                await invitePlayer(guild.id, input.value.trim());
                alert(tReplace('mods.guilds.inviteSent', { name: input.value.trim() }));
                dialog.remove();
                const mainDialog = getOpenDialog();
                if (mainDialog) mainDialog.remove();
                await openGuildPanel();
              } catch (error) {
                alert(error.message);
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
                alert(error.message);
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
  }

  // Transfer Leadership (Leader only)
  if (isLeader) {
    const transferSection = document.createElement('div');
    transferSection.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    
    const transferLabel = document.createElement('label');
    transferLabel.textContent = t('mods.guilds.transferLeadership');
    transferLabel.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
    
    const otherMembers = members.filter(m => m.username.toLowerCase() !== currentPlayer.toLowerCase());
    
    if (otherMembers.length > 0) {
      const transferSelect = document.createElement('select');
      transferSelect.className = 'pixel-font-14';
      transferSelect.style.cssText = `
        width: 100%;
        padding: 4px 8px;
        background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
        border-width: 4px;
        border-style: solid;
        border-color: transparent;
        border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
        color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
        font-size: 12px;
        box-sizing: border-box;
      `;
      
      otherMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.username;
        const roleKey = `mods.guilds.role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`;
        option.textContent = `${member.username} (${t(roleKey)})`;
        transferSelect.appendChild(option);
      });
      
      const transferBtn = createButton(t('mods.guilds.transferLeadershipButton'), async () => {
        if (confirm(tReplace('mods.guilds.transferLeadershipConfirm', { name: transferSelect.value }))) {
          try {
            await transferLeadership(guild.id, transferSelect.value);
            alert(t('mods.guilds.leadershipTransferred'));
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            await openGuildPanel();
          } catch (error) {
            alert(error.message);
          }
        }
      }, { width: '100%', marginTop: '4px', background: 'rgba(255, 193, 7, 0.3)' });
      
      transferSection.appendChild(transferLabel);
      transferSection.appendChild(transferSelect);
      transferSection.appendChild(transferBtn);
    } else {
      const noMembersMsg = document.createElement('div');
      noMembersMsg.textContent = t('mods.guilds.noMembersToTransfer');
      noMembersMsg.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 11px; opacity: 0.7; padding: 4px;`;
      transferSection.appendChild(transferLabel);
      transferSection.appendChild(noMembersMsg);
    }
    
    adminContainer.appendChild(transferSection);
  }

  // Member Management (Leader only)
  if (isLeader) {
    const memberMgmtSection = document.createElement('div');
    memberMgmtSection.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    
    const memberMgmtLabel = document.createElement('label');
    memberMgmtLabel.textContent = t('mods.guilds.manageMembers');
    memberMgmtLabel.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 12px;`;
    
    const regularMembers = members.filter(m => 
      m.username.toLowerCase() !== currentPlayer.toLowerCase() && 
      m.role === GUILD_ROLES.MEMBER
    );
    const officers = members.filter(m => 
      m.username.toLowerCase() !== currentPlayer.toLowerCase() && 
      m.role === GUILD_ROLES.OFFICER
    );
    
    if (regularMembers.length > 0 || officers.length > 0) {
      const memberSelect = document.createElement('select');
      memberSelect.className = 'pixel-font-14';
      memberSelect.style.cssText = `
        width: 100%;
        padding: 4px 8px;
        background: url('${CSS_CONSTANTS.BACKGROUND_URL}') repeat;
        border-width: 4px;
        border-style: solid;
        border-color: transparent;
        border-image: ${CSS_CONSTANTS.BORDER_1_FRAME};
        color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE};
        font-size: 12px;
        box-sizing: border-box;
      `;
      
      if (regularMembers.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = t('mods.guilds.membersGroup');
        regularMembers.forEach(member => {
          const option = document.createElement('option');
          option.value = member.username;
          option.textContent = member.username;
          option.dataset.role = member.role;
          optgroup.appendChild(option);
        });
        memberSelect.appendChild(optgroup);
      }
      
      if (officers.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = t('mods.guilds.officersGroup');
        officers.forEach(member => {
          const option = document.createElement('option');
          option.value = member.username;
          option.textContent = member.username;
          option.dataset.role = member.role;
          optgroup.appendChild(option);
        });
        memberSelect.appendChild(optgroup);
      }
      
      const actionButtons = document.createElement('div');
      actionButtons.style.cssText = 'display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;';
      
      const promoteBtn = createButton(t('mods.guilds.promote'), async () => {
        const selected = memberSelect.options[memberSelect.selectedIndex];
        if (selected && selected.dataset.role === GUILD_ROLES.MEMBER) {
          try {
            await promoteMember(guild.id, selected.value);
            alert(tReplace('mods.guilds.promotedToOfficer', { name: selected.value }));
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            await openGuildPanel();
          } catch (error) {
            alert(error.message);
          }
        } else {
          alert(t('mods.guilds.canOnlyPromoteMembers'));
        }
      }, { flex: '1', minWidth: '80px' });
      
      const demoteBtn = createButton(t('mods.guilds.demote'), async () => {
        const selected = memberSelect.options[memberSelect.selectedIndex];
        if (selected && selected.dataset.role === GUILD_ROLES.OFFICER) {
          try {
            await demoteMember(guild.id, selected.value);
            alert(`${selected.value} ${t('mods.guilds.demote').toLowerCase()}d to ${t('mods.guilds.roleMember').toLowerCase()}`);
            const dialog = getOpenDialog();
            if (dialog) dialog.remove();
            await openGuildPanel();
          } catch (error) {
            alert(error.message);
          }
        } else {
          alert(t('mods.guilds.demote') + ' - can only demote officers');
        }
      }, { flex: '1', minWidth: '80px' });
      
      const kickBtn = createButton(t('mods.guilds.kick'), async () => {
        const selected = memberSelect.options[memberSelect.selectedIndex];
        if (selected) {
          if (confirm(tReplace('mods.guilds.kickConfirm', { name: selected.value }))) {
            try {
              await kickMember(guild.id, selected.value);
              alert(tReplace('mods.guilds.kickedFromGuild', { name: selected.value }));
              const dialog = getOpenDialog();
              if (dialog) dialog.remove();
              await openGuildPanel();
            } catch (error) {
              alert(error.message);
            }
          }
        }
      }, { flex: '1', minWidth: '80px', background: 'rgba(255, 107, 107, 0.3)' });
      
      actionButtons.appendChild(promoteBtn);
      actionButtons.appendChild(demoteBtn);
      actionButtons.appendChild(kickBtn);
      
      memberMgmtSection.appendChild(memberMgmtLabel);
      memberMgmtSection.appendChild(memberSelect);
      memberMgmtSection.appendChild(actionButtons);
    } else {
      const noMembersMsg = document.createElement('div');
      noMembersMsg.textContent = t('mods.guilds.noMembersToManage');
      noMembersMsg.style.cssText = `color: ${CSS_CONSTANTS.COLORS.TEXT_WHITE}; font-size: 11px; opacity: 0.7; padding: 4px;`;
      memberMgmtSection.appendChild(memberMgmtLabel);
      memberMgmtSection.appendChild(noMembersMsg);
    }
    
    adminContainer.appendChild(memberMgmtSection);
  }

  // Delete Guild (Leader only, when they are the only member)
  if (isLeader && members.length === 1) {
    const deleteSection = document.createElement('div');
    deleteSection.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 8px;';
    
    const deleteBtn = createButton(t('mods.guilds.deleteGuild'), async () => {
      const confirmModal = api.ui.components.createModal({
        title: t('mods.guilds.deleteGuild'),
        width: 450,
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
      if (confirm(t('mods.guilds.leaveGuildConfirm'))) {
        try {
          await leaveGuild(guild.id);
          alert(t('mods.guilds.leftGuild'));
          const dialog = getOpenDialog();
          if (dialog) dialog.remove();
          showGuildBrowser();
        } catch (error) {
          alert(error.message);
        }
      }
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

