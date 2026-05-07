// src/lib/firebaseAdmin.js
// Firebase Admin SDK singleton — used only in /api server routes.
// Never import in frontend components.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getAuth }                       from 'firebase-admin/auth';

// Singleton pattern — prevents re-initialisation on hot reloads
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
    throw new Error(`Firebase Admin SDK: missing env vars: ${missing.join(', ')}`);
  }

  if (!clientEmail.includes('iam.gserviceaccount.com')) {
    throw new Error(
      `Firebase Admin SDK: FIREBASE_CLIENT_EMAIL looks wrong ("${clientEmail}"). ` +
      `It must be a service account email ending in iam.gserviceaccount.com, ` +
      `not a personal Gmail address.`
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const adminApp = getAdminApp();

export const adminDb   = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
