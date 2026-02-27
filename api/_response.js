// api/_response.js — §6.5: Standardized response shape for all API handlers
//
// Previously each handler used its own error format:
//   enhance-prompt.js  → { success: false, error, details, debugInfo }
//   send-invite.js     → { success: false, error, details }
//   generate-invite-link.js → { error }
//
// All handlers should now use these helpers so client code can rely on a
// consistent shape regardless of which endpoint responds.

/**
 * Send a 200 success response.
 * @param {import('http').ServerResponse} res
 * @param {object} data  — merged into { success: true, ...data }
 */
export function ok(res, data = {}) {
  return res.status(200).json({ success: true, ...data });
}

/**
 * Send an error response.
 * @param {import('http').ServerResponse} res
 * @param {number} status   — HTTP status code
 * @param {string} code     — machine-readable error code (SCREAMING_SNAKE_CASE)
 * @param {string} message  — human-readable description
 * @param {object} [extra]  — optional extra fields (only in development)
 */
export function err(res, status, code, message, extra = undefined) {
  const body = {
    success: false,
    error: { code, message },
  };
  // Only expose internal details (stack traces, env info) in development
  if (extra && process.env.NODE_ENV === 'development') {
    body.error.debug = extra;
  }
  return res.status(status).json(body);
}

// ── Common error shortcuts ──────────────────────────────────────────────────

export const unauthorized = (res) =>
  err(res, 401, 'UNAUTHORIZED', 'Authentication required.');

export const forbidden = (res) =>
  err(res, 403, 'FORBIDDEN', 'You do not have permission to perform this action.');

export const rateLimited = (res) =>
  err(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again in 60 seconds.');

export const badRequest = (res, message = 'Invalid request body.') =>
  err(res, 400, 'BAD_REQUEST', message);

export const serverError = (res, message = 'An unexpected error occurred.', extra) =>
  err(res, 500, 'INTERNAL_ERROR', message, extra);
