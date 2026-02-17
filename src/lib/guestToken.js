// src/lib/guestToken.js
// Resilient guest token management — survives auth state changes

const GUEST_TOKEN_KEY = 'guest_team_token';
const GUEST_TEAM_ID_KEY = 'guest_team_id';
const GUEST_PERMISSIONS_KEY = 'guest_team_permissions';
const GUEST_MODE_KEY = 'is_guest_mode';

// In-memory backup — survives sessionStorage being cleared mid-session
let _memoryToken = null;
let _memoryTeamId = null;
let _memoryPermissions = null;

/**
 * Store guest token — writes to both sessionStorage AND memory
 */
export function storeGuestToken(token) {
  if (!token) return;
  
  _memoryToken = token;
  
  try {
    sessionStorage.setItem(GUEST_TOKEN_KEY, token);
    console.log('✅ [GUEST TOKEN] Token stored:', token.substring(0, 8) + '...');
  } catch (e) {
    console.warn('⚠️ [GUEST TOKEN] Could not write to sessionStorage:', e);
  }
}

/**
 * Store full guest session data
 */
export function storeGuestSession(token, teamId, permissions) {
  _memoryToken = token;
  _memoryTeamId = teamId;
  _memoryPermissions = permissions;
  
  try {
    sessionStorage.setItem(GUEST_TOKEN_KEY, token);
    sessionStorage.setItem(GUEST_TEAM_ID_KEY, teamId);
    sessionStorage.setItem(GUEST_PERMISSIONS_KEY, JSON.stringify(permissions));
    sessionStorage.setItem(GUEST_MODE_KEY, 'true');
    console.log('✅ [GUEST SESSION] Stored:', { token: token.substring(0, 8) + '...', teamId });
  } catch (e) {
    console.warn('⚠️ [GUEST SESSION] sessionStorage write failed:', e);
  }
}

/**
 * Get guest token — tries sessionStorage first, falls back to memory cache
 */
export function getGuestToken() {
  // 1. Try sessionStorage first
  try {
    const stored = sessionStorage.getItem(GUEST_TOKEN_KEY);
    if (stored) {
      _memoryToken = stored; // Keep memory in sync
      console.log('🔑 [GUEST TOKEN] Retrieved token:', stored.substring(0, 8) + '...');
      return stored;
    }
  } catch (e) {
    // sessionStorage unavailable
  }

  // 2. Fall back to in-memory cache (survives auth state changes clearing sessionStorage)
  if (_memoryToken) {
    console.log('🔑 [GUEST TOKEN] Retrieved token from memory cache:', _memoryToken.substring(0, 8) + '...');
    
    // Attempt to restore to sessionStorage
    try {
      sessionStorage.setItem(GUEST_TOKEN_KEY, _memoryToken);
      if (_memoryTeamId) sessionStorage.setItem(GUEST_TEAM_ID_KEY, _memoryTeamId);
      if (_memoryPermissions) sessionStorage.setItem(GUEST_PERMISSIONS_KEY, JSON.stringify(_memoryPermissions));
      sessionStorage.setItem(GUEST_MODE_KEY, 'true');
      console.log('✅ [GUEST TOKEN] Restored sessionStorage from memory cache');
    } catch (e) {
      // Can't restore, memory will serve as fallback
    }
    
    return _memoryToken;
  }

  console.warn('⚠️ [GUEST TOKEN] No token found, cannot generate guest user ID');
  return null;
}

/**
 * Generate a stable guest user ID from the token
 */
export function getGuestUserId() {
  const token = getGuestToken();
  if (!token) return null;
  return `guest_${token}`;
}

/**
 * Get debug info about current guest token state
 */
export function getGuestTokenDebug() {
  const token = getGuestToken();
  const guestUserId = token ? `guest_${token}` : null;
  const isValid = !!(token && token.length > 0);
  
  const debug = {
    hasToken: !!token,
    token: token,
    guestUserId,
    isValid,
    tokenLength: token?.length || 0,
    source: token ? (sessionStorage.getItem(GUEST_TOKEN_KEY) ? 'sessionStorage' : 'memory') : 'none',
  };
  
  console.log('🔍 [GUEST TOKEN DEBUG]');
  console.log('Has Token:', debug.hasToken);
  console.log('Token:', debug.token ? debug.token.substring(0, 8) + '...' : null);
  console.log('Guest User ID:', debug.guestUserId ? debug.guestUserId.substring(0, 16) + '...' : null);
  console.log('Token Valid:', debug.isValid);
  console.log('Token Length:', debug.tokenLength);
  console.log('Source:', debug.source);
  
  return debug;
}

/**
 * Check if current user is a guest
 */
export function isGuestUser() {
  return !!getGuestToken();
}

/**
 * Clear guest token from all storage
 */
export function clearGuestToken() {
  _memoryToken = null;
  _memoryTeamId = null;
  _memoryPermissions = null;
  
  try {
    sessionStorage.removeItem(GUEST_TOKEN_KEY);
    sessionStorage.removeItem(GUEST_TEAM_ID_KEY);
    sessionStorage.removeItem(GUEST_PERMISSIONS_KEY);
    sessionStorage.removeItem(GUEST_MODE_KEY);
    console.log('🧹 [GUEST TOKEN] Cleared all guest session data');
  } catch (e) {
    console.warn('⚠️ [GUEST TOKEN] Error clearing sessionStorage:', e);
  }
}
