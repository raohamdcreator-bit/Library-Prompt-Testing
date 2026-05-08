export const PLAN_LIMITS = {
  free: {
    maxVideos:          2,
    maxFileSizeBytes:   25  * 1024 * 1024,  // 25 MB — keeps bandwidth costs tiny
    maxStorageBytes:    50  * 1024 * 1024,  // 50 MB total
    allowedMimeTypes:   ['video/mp4', 'video/quicktime'],
  },
  creator: {
    maxVideos:          20,
    maxFileSizeBytes:   100 * 1024 * 1024,  // 100 MB
    maxStorageBytes:    500 * 1024 * 1024,  // 500 MB total
    allowedMimeTypes:   ['video/mp4', 'video/quicktime'],
  },
  pro: {
    maxVideos:          100,
    maxFileSizeBytes:   250 * 1024 * 1024,  // 250 MB
    maxStorageBytes:    2   * 1024 * 1024 * 1024, // 2 GB total
    allowedMimeTypes:   ['video/mp4', 'video/quicktime'],
  },
};

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
