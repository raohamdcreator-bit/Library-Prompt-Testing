// src/hooks/useTimestamp.js - Universal timestamp handling hook for React components

import { useMemo, useCallback } from 'react';

/**
 * Universal timestamp formatting hook
 * Works with Firestore Timestamps, JavaScript Dates, ISO strings, and milliseconds
 * 
 * @example
 * const { formatDate, formatRelative, formatDateTime, compareTimestamps } = useTimestamp();
 * 
 * // Display formatted date
 * <span>{formatDate(prompt.createdAt)}</span>
 * 
 * // Display relative time ("2 hours ago")
 * <span>{formatRelative(message.timestamp)}</span>
 * 
 * // Sort by timestamp
 * prompts.sort((a, b) => compareTimestamps(a.createdAt, b.createdAt))
 */
export function useTimestamp() {
  /**
   * Safely extract milliseconds from any timestamp format
   */
  const getMillis = useCallback((timestamp) => {
    if (!timestamp) return 0;

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

    // Already milliseconds (number)
    if (typeof timestamp === 'number' && !isNaN(timestamp)) {
      return timestamp;
    }

    console.warn('Unknown timestamp format:', timestamp);
    return 0;
  }, []);

  /**
   * Format timestamp as date string
   * @param {*} timestamp - Any timestamp format
   * @param {Object} options - Intl.DateTimeFormat options
   * @returns {string} Formatted date (e.g., "Jan 15, 2024")
   */
  const formatDate = useCallback((timestamp, options = {}) => {
    if (!timestamp) return '';
    
    try {
      const millis = getMillis(timestamp);
      if (millis === 0) return '';
      
      const date = new Date(millis);
      
      const defaultOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      };
      
      return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }, [getMillis]);

  /**
   * Format timestamp with time
   * @param {*} timestamp - Any timestamp format
   * @returns {string} Formatted datetime (e.g., "Jan 15, 2024, 3:30 PM")
   */
  const formatDateTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const millis = getMillis(timestamp);
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
      console.error('Error formatting datetime:', error);
      return '';
    }
  }, [getMillis]);

  /**
   * Format timestamp as relative time
   * @param {*} timestamp - Any timestamp format
   * @returns {string} Relative time (e.g., "2 hours ago", "just now")
   */
  const formatRelative = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const millis = getMillis(timestamp);
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
      
      if (seconds < 60) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      if (weeks < 4) return `${weeks}w ago`;
      if (months < 12) return `${months}mo ago`;
      return `${years}y ago`;
    } catch (error) {
      console.error('Error calculating relative time:', error);
      return '';
    }
  }, [getMillis]);

  /**
   * Compare two timestamps for sorting
   * @param {*} a - First timestamp
   * @param {*} b - Second timestamp
   * @param {boolean} ascending - Sort order (default: descending)
   * @returns {number} Comparison result for Array.sort()
   */
  const compareTimestamps = useCallback((a, b, ascending = false) => {
    const aMillis = getMillis(a);
    const bMillis = getMillis(b);
    
    return ascending ? aMillis - bMillis : bMillis - aMillis;
  }, [getMillis]);

  /**
   * Check if timestamp is today
   * @param {*} timestamp - Any timestamp format
   * @returns {boolean}
   */
  const isToday = useCallback((timestamp) => {
    if (!timestamp) return false;
    
    try {
      const millis = getMillis(timestamp);
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
  }, [getMillis]);

  /**
   * Check if timestamp is this week
   * @param {*} timestamp - Any timestamp format
   * @returns {boolean}
   */
  const isThisWeek = useCallback((timestamp) => {
    if (!timestamp) return false;
    
    try {
      const millis = getMillis(timestamp);
      if (millis === 0) return false;
      
      const date = new Date(millis);
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      return date >= weekAgo && date <= today;
    } catch (error) {
      console.error('Error checking if this week:', error);
      return false;
    }
  }, [getMillis]);

  /**
   * Get detailed time information
   * @param {*} timestamp - Any timestamp format
   * @returns {Object} Object with various time representations
   */
  const getTimeInfo = useCallback((timestamp) => {
    if (!timestamp) {
      return {
        millis: 0,
        date: null,
        formatted: '',
        relative: '',
        isToday: false,
        isThisWeek: false,
      };
    }

    const millis = getMillis(timestamp);
    const date = millis ? new Date(millis) : null;

    return {
      millis,
      date,
      formatted: formatDate(timestamp),
      formattedWithTime: formatDateTime(timestamp),
      relative: formatRelative(timestamp),
      isToday: isToday(timestamp),
      isThisWeek: isThisWeek(timestamp),
    };
  }, [getMillis, formatDate, formatDateTime, formatRelative, isToday, isThisWeek]);

  return {
    formatDate,
    formatDateTime,
    formatRelative,
    compareTimestamps,
    isToday,
    isThisWeek,
    getTimeInfo,
    getMillis, // Export for advanced use cases
  };
}

/**
 * Hook for sorting arrays by timestamp field
 * @param {Array} items - Array to sort
 * @param {string} field - Field name containing timestamp
 * @param {boolean} ascending - Sort order
 * @returns {Array} Sorted array (memoized)
 * 
 * @example
 * const sortedPrompts = useSortByTimestamp(prompts, 'createdAt', false);
 */
export function useSortByTimestamp(items, field = 'createdAt', ascending = false) {
  const { compareTimestamps } = useTimestamp();

  return useMemo(() => {
    if (!items || items.length === 0) return [];
    
    return [...items].sort((a, b) => 
      compareTimestamps(a[field], b[field], ascending)
    );
  }, [items, field, ascending, compareTimestamps]);
}

/**
 * Hook for formatting multiple timestamps at once
 * Useful for list rendering to avoid recalculating on every render
 * 
 * @param {Array} timestamps - Array of timestamps
 * @param {string} format - 'date' | 'relative' | 'datetime'
 * @returns {Object} Map of timestamp index to formatted string
 * 
 * @example
 * const formatted = useFormattedTimestamps(prompts.map(p => p.createdAt), 'relative');
 * prompts.map((p, i) => <span>{formatted[i]}</span>)
 */
export function useFormattedTimestamps(timestamps, format = 'relative') {
  const { formatDate, formatRelative, formatDateTime } = useTimestamp();

  return useMemo(() => {
    if (!timestamps || timestamps.length === 0) return {};
    
    const formatter = format === 'date' 
      ? formatDate 
      : format === 'datetime'
      ? formatDateTime
      : formatRelative;

    return timestamps.reduce((acc, timestamp, index) => {
      acc[index] = formatter(timestamp);
      return acc;
    }, {});
  }, [timestamps, format, formatDate, formatRelative, formatDateTime]);
}

export default useTimestamp;
