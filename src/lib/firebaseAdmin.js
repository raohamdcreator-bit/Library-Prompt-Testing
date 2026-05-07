
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth }      from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_SERVICE_ACCOUNT?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId   && 'VITE_FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey  && 'FIREBASE_SERVICE_ACCOUNT',
    ].filter(Boolean);
    throw new Error(`Firebase Admin: missing env vars: ${missing.join(', ')}`);
  }

  console.log('[firebaseAdmin] Initializing with:', {
    projectId,
    clientEmail,
    privateKeyStart: privateKey.substring(0, 40),
  });

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

// ── Lazy getters — initialize on first call, not at module load ──────────────
let _db   = null;
let _auth = null;

export function getAdminDb() {
  if (!_db) _db = getFirestore(getAdminApp());
  return _db;
}

export function getAdminAuth() {
  if (!_auth) _auth = getAuth(getAdminApp());
  return _auth;
}

// Keep these for backward compatibility with existing imports
export const adminDb   = new Proxy({}, { get: (_, prop) => getAdminDb()[prop] });
export const adminAuth = new Proxy({}, { get: (_, prop) => getAdminAuth()[prop] });
