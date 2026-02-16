// src/lib/guestToken.js - Guest Token Management Utility
// ✅ Ensures guest_team_token is properly stored and retrieved

/**
 * Get the guest team token from sessionStorage
 * @returns {string|null} The guest token or null if not found
 */
export function getGuestToken() {
  try {
    const token = sessionStorage.getItem('guest_team_token');
    console.log('🔑 [GUEST TOKEN] Retrieved token:', token ? token.substring(0, 8) + '...' : 'null');
    return token;
  } catch (error) {
    console.error('❌ [GUEST TOKEN] Error retrieving token:', error);
    return null;
  }
}

/**
 * Set the guest team token in sessionStorage
 * @param {string} token - The guest access token
 */
export function setGuestToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      console.error('❌ [GUEST TOKEN] Invalid token provided:', token);
      return false;
    }
    
    sessionStorage.setItem('guest_team_token', token);
    console.log('✅ [GUEST TOKEN] Token stored:', token.substring(0, 8) + '...');
    return true;
  } catch (error) {
    console.error('❌ [GUEST TOKEN] Error storing token:', error);
    return false;
  }
}

/**
 * Remove the guest team token from sessionStorage
 */
export function clearGuestToken() {
  try {
    sessionStorage.removeItem('guest_team_token');
    console.log('✅ [GUEST TOKEN] Token cleared');
    return true;
  } catch (error) {
    console.error('❌ [GUEST TOKEN] Error clearing token:', error);
    return false;
  }
}

/**
 * Check if a guest token exists
 * @returns {boolean} True if guest token exists
 */
export function hasGuestToken() {
  const token = getGuestToken();
  return token !== null && token.length > 0;
}

/**
 * Get the guest user ID for Firestore operations
 * @returns {string|null} The guest user ID (guest_{token}) or null
 */
export function getGuestUserId() {
  const token = getGuestToken();
  if (!token) {
    console.warn('⚠️ [GUEST TOKEN] No token found, cannot generate guest user ID');
    return null;
  }
  
  const guestUserId = `guest_${token}`;
  console.log('🔑 [GUEST TOKEN] Generated guest user ID:', guestUserId.substring(0, 20) + '...');
  return guestUserId;
}

/**
 * Validate that a guest token is properly formatted
 * @param {string} token - The token to validate
 * @returns {boolean} True if valid
 */
export function isValidGuestToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Token should be at least 10 characters
  if (token.length < 10) {
    console.warn('⚠️ [GUEST TOKEN] Token too short:', token.length);
    return false;
  }
  
  // Token should only contain alphanumeric characters and hyphens
  if (!/^[a-zA-Z0-9-_]+$/.test(token)) {
    console.warn('⚠️ [GUEST TOKEN] Token contains invalid characters');
    return false;
  }
  
  return true;
}

/**
 * Initialize guest token from URL parameter if present
 * Used when user clicks a guest access link
 * @param {string} urlToken - The token from URL parameters
 * @returns {boolean} True if token was set successfully
 */
export function initializeGuestTokenFromURL(urlToken) {
  if (!urlToken) {
    console.log('ℹ️ [GUEST TOKEN] No URL token provided');
    return false;
  }
  
  console.log('🔗 [GUEST TOKEN] Initializing from URL token:', urlToken.substring(0, 8) + '...');
  
  if (!isValidGuestToken(urlToken)) {
    console.error('❌ [GUEST TOKEN] Invalid URL token format');
    return false;
  }
  
  // Check if we already have a different token
  const existingToken = getGuestToken();
  if (existingToken && existingToken !== urlToken) {
    console.log('ℹ️ [GUEST TOKEN] Replacing existing token with new token from URL');
  }
  
  return setGuestToken(urlToken);
}

/**
 * Debug function to log current guest token state
 */
export function debugGuestToken() {
  const token = getGuestToken();
  const hasToken = hasGuestToken();
  const guestUserId = getGuestUserId();
  
  console.group('🔍 [GUEST TOKEN DEBUG]');
  console.log('Has Token:', hasToken);
  console.log('Token:', token ? token.substring(0, 8) + '...' : 'null');
  console.log('Guest User ID:', guestUserId ? guestUserId.substring(0, 20) + '...' : 'null');
  console.log('Token Valid:', token ? isValidGuestToken(token) : false);
  console.log('Token Length:', token ? token.length : 0);
  console.groupEnd();
  
  return {
    hasToken,
    token,
    guestUserId,
    isValid: token ? isValidGuestToken(token) : false,
  };
}
