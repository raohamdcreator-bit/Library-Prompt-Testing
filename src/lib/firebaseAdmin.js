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
      projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VITE_ADMIN_EMAIL,
      // Vercel stores newlines as literal \n — this restores them
      privateKey:  process.env.FIREBASE_SERVICE_ACCOUNT?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminApp = getAdminApp();

export const adminDb   = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
