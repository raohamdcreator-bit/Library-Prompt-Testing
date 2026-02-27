// src/config/legal.js — §7.5
//
// Single source of truth for legal document dates.
// Update these values when you publish a new version of either document.
// This prevents the Privacy Policy showing "January 15, 2025" long after
// the document has been updated.
//
// Usage in PrivacyPolicy.jsx:
//   import { PRIVACY_POLICY_UPDATED, TERMS_UPDATED } from '@/config/legal';
//   // <LegalLayout lastUpdated={PRIVACY_POLICY_UPDATED}>

/** ISO 8601 date of the most recent Privacy Policy update */
export const PRIVACY_POLICY_UPDATED = '2026-02-23';

/** ISO 8601 date of the most recent Terms of Use update */
export const TERMS_UPDATED = '2026-02-23';

/**
 * Format a legal date for display.
 * @param {string} isoDate  e.g. '2026-02-23'
 * @returns {string}        e.g. 'February 23, 2026'
 */
export function formatLegalDate(isoDate) {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
