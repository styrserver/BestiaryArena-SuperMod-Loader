// Loads maintainer/admin names from Firebase (config/admins). Read-only in security rules.
'use strict';

const FIREBASE_URL = 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app';
const ADMINS_PATH = 'config/admins';
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Removed admin-tool throttles (no longer used). */
const OBSOLETE_THROTTLE_STORAGE_KEYS = [
  'guildsGlobalSkillResetLastRun',
  'vipListAllChatCleanupLastRun'
];

let adminNamesLower = [];
let lastFetchMs = 0;
let fetchInFlight = null;

async function fetchAdminNamesFromFirebase() {
  if (fetchInFlight) return fetchInFlight;
  fetchInFlight = (async () => {
    try {
      const response = await fetch(`${FIREBASE_URL}/${ADMINS_PATH}.json`);
      if (!response.ok) {
        console.warn('[FirebaseAdmins] Failed to load admins:', response.status);
        return [];
      }
      const data = await response.json();
      if (!data || typeof data !== 'object') return [];
      return Object.entries(data)
        .filter(([, value]) => value === true || value === 1 || value === 'true')
        .map(([name]) => name.toLowerCase());
    } catch (error) {
      console.warn('[FirebaseAdmins] Error loading admins:', error);
      return [];
    } finally {
      fetchInFlight = null;
    }
  })();
  return fetchInFlight;
}

async function refreshAdminList(force = false) {
  const now = Date.now();
  if (!force && adminNamesLower.length > 0 && now - lastFetchMs < CACHE_TTL_MS) {
    return adminNamesLower;
  }
  adminNamesLower = await fetchAdminNamesFromFirebase();
  lastFetchMs = now;
  return adminNamesLower;
}

function isPlayerAdmin(playerName) {
  if (!playerName || !adminNamesLower.length) return false;
  return adminNamesLower.includes(playerName.toLowerCase());
}

async function isPlayerAdminAsync(playerName) {
  if (!playerName) return false;
  await refreshAdminList();
  return isPlayerAdmin(playerName);
}

const api = {
  refreshAdminList,
  isPlayerAdmin,
  isPlayerAdminAsync,
  getAdminNames: () => adminNamesLower.slice()
};

if (typeof window !== 'undefined') {
  window.FirebaseAdminsAPI = api;
}

function removeObsoleteAdminThrottleKeys() {
  if (typeof localStorage === 'undefined') return;
  for (const key of OBSOLETE_THROTTLE_STORAGE_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('[FirebaseAdmins] Failed to remove obsolete key:', key, error);
    }
  }
}

exports = {
  init: async function () {
    removeObsoleteAdminThrottleKeys();
    await refreshAdminList(true);
    console.log('[FirebaseAdmins] Loaded admins:', adminNamesLower.length ? adminNamesLower.join(', ') : '(none)');
    return true;
  },
  cleanup: function () {
    adminNamesLower = [];
    lastFetchMs = 0;
    if (typeof window !== 'undefined' && window.FirebaseAdminsAPI === api) {
      delete window.FirebaseAdminsAPI;
    }
    return true;
  }
};
