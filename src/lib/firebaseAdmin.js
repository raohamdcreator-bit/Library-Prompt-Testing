// FULL REPLACEMENT — src/lib/firebaseAdmin.js

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth }      from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!rawServiceAccount) {
    throw new Error('Firebase Admin: FIREBASE_SERVICE_ACCOUNT env var is missing');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error('Firebase Admin: FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }

  const projectId   = serviceAccount.project_id;
  const clientEmail = serviceAccount.client_email;
  const privateKey  = serviceAccount.private_key?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      `Firebase Admin: service account JSON is missing fields: ${[
        !projectId   && 'project_id',
        !clientEmail && 'client_email',
        !privateKey  && 'private_key',
      ].filter(Boolean).join(', ')}`
    );
  }

  console.log('[firebaseAdmin] Initializing with project:', projectId, '| client:', clientEmail);

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

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

export const adminDb   = new Proxy({}, { get: (_, prop) => getAdminDb()[prop] });
export const adminAuth = new Proxy({}, { get: (_, prop) => getAdminAuth()[prop] });
