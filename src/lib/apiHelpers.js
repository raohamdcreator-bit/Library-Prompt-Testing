// src/lib/apiHelpers.js
// Shared utilities for all /api route handlers.


import { getAdminAuth, getAdminDb } from './firebaseAdmin.js';

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token (contains uid, email, etc.).
 * Throws if missing or invalid.
 */
export async function verifyAuthToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or malformed Authorization header');
    err.statusCode = 401;
    throw err;
  }
  const idToken = authHeader.slice(7);
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch {
    const err = new Error('Invalid or expired authentication token');
    err.statusCode = 401;
    throw err;
  }
}

/**
 * Fetch the user document from Firestore.
 * Throws 403 if user is suspended.
 */
export async function getUserDoc(uid) {
  const snap = await getAdminDb().collection('users').doc(uid).get();
  if (!snap.exists) {
    const err = new Error('User profile not found');
    err.statusCode = 404;
    throw err;
  }
  const data = snap.data();
  if (data.status === 'suspended') {
    const err = new Error('Account suspended');
    err.statusCode = 403;
    throw err;
  }
  return { id: snap.id, ...data };
}

/**
 * Fetch today's usage document for a user.
 * Returns zeroed object if it doesn't exist yet (first action today).
 */
export async function getTodayUsage(uid) {
  const today   = new Date().toISOString().split('T')[0];
  const docPath = `usageTracking/${uid}/daily/${today}`;
  const snap    = await adminDb.doc(docPath).get();

  if (!snap.exists) {
    return { viewCount: 0, uploadCount: 0, date: today };
  }

  return snap.data();
}

/**
 * Increment a field in today's usage document.
 * Creates the document if it doesn't exist (upsert).
 */
export async function incrementTodayUsage(uid, field, amount = 1) {
  const today   = new Date().toISOString().split('T')[0];
  const docRef  = adminDb.doc(`usageTracking/${uid}/daily/${today}`);
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + 90);

  await docRef.set(
    {
      userId:    uid,
      date:      today,
      [field]:   adminDb.FieldValue.increment(amount),
      updatedAt: adminDb.FieldValue.serverTimestamp(),
      expireAt,                     // TTL — Firestore auto-deletes after 90 days
      createdAt: adminDb.FieldValue.serverTimestamp(),
    },
    { merge: true }                 // upsert — safe on first use
  );
}

/**
 * Standard JSON error response builder.
 */
export function errorResponse(message, statusCode = 400, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return Response.json(body, { status: statusCode });
}

/**
 * Standard JSON success response builder.
 */
export function successResponse(data, statusCode = 200) {
  return Response.json({ success: true, ...data }, { status: statusCode });
}
