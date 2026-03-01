// api/_env.js — §7.4: Startup environment variable validation
//
// FIX: Replaced the single REQUIRED_SERVER_VARS list (which mixed AI vars +
// email vars) with per-feature groups. Handlers now call the group that
// matches their actual dependencies, so a missing RESEND_* key can never
// cause a 500 on the AI-enhancement endpoint and vice-versa.

// ── Per-feature variable groups ──────────────────────────────────────────────

/** Firebase Admin SDK — needed by every handler that calls requireAuth() */
const AUTH_VARS = ['FIREBASE_SERVICE_ACCOUNT'];

/** AI prompt enhancement — needed by enhance-prompt.js */
const AI_VARS = ['GROQ_API_KEY'];   // add HUGGINGFACE_API_KEY / OPENROUTER_API_KEY if switching providers

/** Email delivery — needed by send-invite.js ONLY */
const EMAIL_VARS = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'];

// ── Legacy full list (kept for reference; do NOT use in new handlers) ─────────
const REQUIRED_SERVER_VARS = [...AUTH_VARS, ...AI_VARS, ...EMAIL_VARS];

/**
 * Validate that ALL required server-side variables are present.
 * ⚠️  Only call this from handlers that genuinely need every variable in the
 *     list (e.g. send-invite.js needs auth + email).  For handlers that only
 *     need a subset, use requireEnvVars() with the exact keys you need.
 *
 * Throws with a clear message listing every missing variable.
 */
export function validateEnv(extraRequired = []) {
  const toCheck = [...REQUIRED_SERVER_VARS, ...extraRequired];
  const missing = toCheck.filter(k => !process.env[k]);

  if (missing.length > 0) {
    const msg = `FATAL: Missing required environment variables: ${missing.join(', ')}`;
    console.error(msg);
    throw new Error(msg);
  }
}

/**
 * Validate only a specific subset of variables.
 *
 * Preferred over validateEnv() for most handlers because it only throws
 * when a variable the handler *actually uses* is missing.
 *
 * Usage:
 *   requireEnvVars('GROQ_API_KEY', 'FIREBASE_SERVICE_ACCOUNT');
 */
export function requireEnvVars(...keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length > 0) {
    const msg = `FATAL: Missing required environment variables: ${missing.join(', ')}`;
    console.error(msg);
    throw new Error(msg);
  }
}

// Named exports for convenience — import only what you need
export { AUTH_VARS, AI_VARS, EMAIL_VARS };
