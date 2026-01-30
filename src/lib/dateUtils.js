// src/lib/dateUtils.js - Safe timestamp handling for Firestore and demo prompts

/**
 * Safely get timestamp in milliseconds from various date formats
 * Handles: Firestore Timestamps, JavaScript Dates, ISO strings, numbers, null/undefined
 * 
 * @param {*} timestamp - Any timestamp format
 * @returns {number} Milliseconds since epoch, or 0 if invalid
 */
export function getTimestampMillis(timestamp) {
  if (!timestamp) {
    return 0;
  }

  // Firestore Timestamp with toMillis()
  if (timestamp.toMillis && typeof timestamp.toMillis === 'function') {
    try {
      return timestamp.toMillis();
    } catch (error) {
      console.warn('Error calling toMillis():', error);
    }
  }

  // Firestore Timestamp with toDate()
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    try {
      return timestamp.toDate().getTime();
    } catch (error) {
      console.warn('Error calling toDate():', error);
    }
  }

  // JavaScript Date object
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  // ISO string or date string
  if (typeof timestamp === 'string') {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    } catch (error) {
      console.warn('Error parsing date string:', error);
    }
  }

  // Already in milliseconds (number)
  if (typeof timestamp === 'number' && !isNaN(timestamp)) {
    return timestamp;
  }

  console.warn('Unknown timestamp format:', timestamp);
  return 0;
}

/**
 * Format timestamp for display
 * 
 * @param {*} timestamp - Any timestamp format
 * @returns {string} Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  try {
    const millis = getTimestampMillis(timestamp);
    if (millis === 0) return '';
    
    const date = new Date(millis);
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
}

/**
 * Format timestamp with time
 * 
 * @param {*} timestamp - Any timestamp format
 * @returns {string} Formatted datetime string (e.g., "Jan 15, 2024, 3:30 PM")
 */
export function formatTimestampWithTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const millis = getTimestampMillis(timestamp);
    if (millis === 0) return '';
    
    const date = new Date(millis);
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting timestamp with time:', error);
    return '';
  }
}

/**
 * Compare two timestamps for sorting
 * 
 * @param {*} a - First timestamp
 * @param {*} b - Second timestamp
 * @param {boolean} ascending - Sort ascending (true) or descending (false)
 * @returns {number} Comparison result for Array.sort()
 */
export function compareTimestamps(a, b, ascending = false) {
  const aMillis = getTimestampMillis(a);
  const bMillis = getTimestampMillis(b);
  
  return ascending ? aMillis - bMillis : bMillis - aMillis;
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 * 
 * @param {*} timestamp - Any timestamp format
 * @returns {string} Relative time string
 */
export function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const millis = getTimestampMillis(timestamp);
    if (millis === 0) return '';
    
    const now = Date.now();
    const diff = now - millis;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return '';
  }
}

/**
 * Check if a timestamp is today
 * 
 * @param {*} timestamp - Any timestamp format
 * @returns {boolean} True if timestamp is today
 */
export function isToday(timestamp) {
  if (!timestamp) return false;
  
  try {
    const millis = getTimestampMillis(timestamp);
    if (millis === 0) return false;
    
    const date = new Date(millis);
    const today = new Date();
    
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  } catch (error) {
    console.error('Error checking if today:', error);
    return false;
  }
}

/**
 * Check if a timestamp is this week
 * 
 * @param {*} timestamp - Any timestamp format
 * @returns {boolean} True if timestamp is this week
 */
export function isThisWeek(timestamp) {
  if (!timestamp) return false;
  
  try {
    const millis = getTimestampMillis(timestamp);
    if (millis === 0) return false;
    
    const date = new Date(millis);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return date >= weekAgo && date <= today;
  } catch (error) {
    console.error('Error checking if this week:', error);
    return false;
  }
}

/**
 * Sort array of objects by timestamp field
 * 
 * @param {Array} items - Array to sort
 * @param {string} field - Field name containing timestamp (default: 'createdAt')
 * @param {boolean} ascending - Sort ascending (true) or descending (false)
 * @returns {Array} Sorted array (new array, doesn't mutate original)
 */
export function sortByTimestamp(items, field = 'createdAt', ascending = false) {
  return [...items].sort((a, b) => 
    compareTimestamps(a[field], b[field], ascending)
  );
}

/**
 * Create a Firestore-compatible timestamp mock for demos/testing
 * 
 * @param {Date|string} date - Date to convert
 * @returns {Object} Object with toDate() and toMillis() methods
 */
export function createTimestampMock(date) {
  const timestamp = date instanceof Date ? date : new Date(date);
  
  return {
    toDate: () => timestamp,
    toMillis: () => timestamp.getTime(),
    seconds: Math.floor(timestamp.getTime() / 1000),
    nanoseconds: (timestamp.getTime() % 1000) * 1000000,
  };
}
