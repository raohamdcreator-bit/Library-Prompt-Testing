// api/_rateLimit.js — Redis-backed rate limiter using Vercel KV
//
// SETUP (one-time):
//   1. Vercel Dashboard → Storage → Create KV Store → link to this project
//   2. Vercel auto-injects KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN env vars
//   3. npm install @vercel/kv  (add to package.json dependencies)
//
// LIMITS (per authenticated user uid):
//   /api/enhance-prompt    → 20 requests / 60 seconds
//   /api/send-invite       → 10 requests / 60 seconds
//   /api/generate-invite-link → 10 requests / 60 seconds

import { kv } from '@vercel/kv';

/**
 * Sliding-window rate limiter backed by Vercel KV (Redis).
 *
 * Each call increments an integer key scoped to:  rl:<endpoint>:<uid>:<bucket>
 * where <bucket> = Math.floor(unixSeconds / windowSeconds)
 *
 * The key TTL is set to 2× the window so it cleans itself up automatically.
 *
 * @param {string} uid            – Firebase UID of the authenticated user
 * @param {string} endpoint       – Short label, e.g. 'enhance', 'send-invite'
 * @param {number} maxRequests    – Maximum calls allowed within the window
 * @param {number} windowSeconds  – Rolling window size in seconds
 *
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
 *   allowed  – false when the caller has exceeded the limit
 *   remaining – how many calls are left in this window
 *   resetIn  – seconds until the bucket resets
 */
export async function rateLimit(uid, endpoint, maxRequests = 20, windowSeconds = 60) {
  const now      = Math.floor(Date.now() / 1000);
  const bucket   = Math.floor(now / windowSeconds);
  const kvKey    = `rl:${endpoint}:${uid}:${bucket}`;
  const resetAt  = (bucket + 1) * windowSeconds;
  const resetIn  = resetAt - now;

  try {
    // Atomically increment; returns the NEW count after increment.
    const count = await kv.incr(kvKey);

    // Set expiry only on the first increment (count === 1) to avoid
    // resetting the TTL on every request and breaking the window.
    if (count === 1) {
      await kv.expire(kvKey, windowSeconds * 2);
    }

    const remaining = Math.max(0, maxRequests - count);
    const allowed   = count <= maxRequests;

    return { allowed, remaining, resetIn, count };
  } catch (kvError) {
    // If KV is unreachable (cold-start race, network blip), fail OPEN so
    // legitimate users are not blocked. Log the error for visibility.
    console.error('[rateLimit] KV error — failing open:', kvError.message);
    return { allowed: true, remaining: maxRequests, resetIn: windowSeconds, count: 0 };
  }
}

/**
 * Convenience wrapper that writes 429 + Retry-After to the response
 * and returns false when the rate limit is exceeded.
 *
 * Usage:
 *   if (!(await checkRateLimit(req, res, user.uid, 'enhance'))) return;
 *
 * @param {object} req
 * @param {object} res
 * @param {string} uid
 * @param {string} endpoint
 * @param {number} maxRequests
 * @param {number} windowSeconds
 * @returns {Promise<boolean>}  true = allowed, false = blocked (response already sent)
 */
export async function checkRateLimit(req, res, uid, endpoint, maxRequests = 20, windowSeconds = 60) {
  const result = await rateLimit(uid, endpoint, maxRequests, windowSeconds);

  // Always add informational headers so clients can back off gracefully
  res.setHeader('X-RateLimit-Limit',     maxRequests);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset',     result.resetIn);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.resetIn);
    res.status(429).json({
      success: false,
      error: {
        code:    'RATE_LIMITED',
        message: `Too many requests. You have used all ${maxRequests} calls allowed in ${windowSeconds} seconds. Please wait ${result.resetIn} seconds and try again.`,
      },
    });
    return false;
  }

  return true;
}
