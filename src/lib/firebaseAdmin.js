// src/lib/firebaseAdmin.js
// Firebase Admin SDK singleton — used only in /api server routes.
// Never import in frontend components.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { getAuth }                       from 'firebase-admin/auth';

// Singleton pattern — prevents re-initialisation on hot reloads
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores newlines as literal \n — this restores them
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminApp = getAdminApp();

export const adminDb   = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
