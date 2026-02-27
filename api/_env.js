// api/_env.js — §7.4: Startup environment variable validation


const REQUIRED_SERVER_VARS = [
  'GROQ_API_KEY',
  'RESEND_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
  'RESEND_FROM_EMAIL',
];

/**
 * Validate that all required environment variables are present.
 * Throws with a clear error message listing every missing variable.
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
 * Useful for handlers that only need a subset of the full list.
 */
export function requireEnvVars(...keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length > 0) {
    const msg = `FATAL: Missing required environment variables: ${missing.join(', ')}`;
    console.error(msg);
    throw new Error(msg);
  }
}
