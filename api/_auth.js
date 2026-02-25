// api/_auth.js — Shared authentication middleware (server-side only)
//
// SETUP:
//   1. Firebase Console → Project Settings → Service Accounts
//   2. Click "Generate new private key" → download the JSON file
//   3. Vercel → Settings → Environment Variables → add:
//        Key:   FIREBASE_SERVICE_ACCOUNT
//        Value: paste the ENTIRE downloaded JSON as a single-line string
//        Environments: Production + Preview  (NOT Development unless needed)

import admin from 'firebase-admin';

// Initialise once per cold-start; subsequent imports reuse the same app.
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccount) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Add the Firebase service-account JSON (as a single-line string) to your Vercel env vars.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

/**
 * Verifies the Firebase ID token supplied in the Authorization header.
 *
 * Usage (at the top of every API handler):
 *   const user = await requireAuth(req, res);
 *   if (!user) return;   // 401 already sent
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @returns {Promise<admin.auth.DecodedIdToken|null>}
 */
export async function requireAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthenticated: missing Bearer token' });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error('Token verification failed:', err.code, err.message);
    res.status(401).json({ success: false, error: 'Unauthenticated: invalid or expired token' });
    return null;
  }
}
