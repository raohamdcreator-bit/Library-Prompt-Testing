// src/config/plans.js
// Single source of truth for plan limits.
// Used by both frontend (display) and API routes (enforcement).

export const PLAN_LIMITS = {
  free: {
    maxVideos:             2,
    maxFileSizeBytes:      26_214_400,   // 25 MB
    maxDailyViews:         10,
    maxStorageBytes:       52_428_800,   // 50 MB total
    maxVideoDurationSecs:  300,          // 5 minutes
  },
  pro: {
    maxVideos:             20,
    maxFileSizeBytes:      524_288_000,  // 500 MB
    maxDailyViews:         500,
    maxStorageBytes:       10_737_418_240, // 10 GB
    maxVideoDurationSecs:  3600,         // 1 hour
  },
  team: {
    maxVideos:             100,
    maxFileSizeBytes:      1_073_741_824, // 1 GB
    maxDailyViews:         2000,
    maxStorageBytes:       107_374_182_400, // 100 GB
    maxVideoDurationSecs:  7200,          // 2 hours
  },
};

// Returns today's date as YYYY-MM-DD string (used as daily usage doc ID)
export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Returns a Unix timestamp 90 days from now (for Firestore TTL)
export function getExpireAt() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
}
