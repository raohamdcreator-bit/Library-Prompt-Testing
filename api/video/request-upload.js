// api/video/request-upload.js
// POST /api/video/request-upload
//
// Secure endpoint that:
//   1. Verifies Firebase auth token
//   2. Checks user plan limits (videos, file size, storage)
//   3. Requests a one-time upload URL from Cloudflare Stream
//   4. Saves pending video metadata to Firestore
//   5. Returns uploadUrl + videoId to frontend
//
// The frontend then uploads DIRECTLY to Cloudflare — never through this server.
// This keeps bandwidth costs at zero on Vercel's end.

import { adminDb }              from '../../src/lib/firebaseAdmin.js';
import { createDirectUploadUrl } from '../../src/lib/cloudflareApi.js';
import {
  verifyAuthToken,
  getUserDoc,
  errorResponse,
  successResponse,
} from '../../src/lib/apiHelpers.js';
import { PLAN_LIMITS } from '../../src/config/plans.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request) {
  // ── 1. Method guard ─────────────────────────────────────────────────────────
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // ── 2. Parse & validate request body ────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { fileName, fileSizeBytes, mimeType, teamId, promptId, title } = body;

  // Basic input validation
  if (!fileName || typeof fileName !== 'string') {
    return errorResponse('fileName is required', 400);
  }
  if (!fileSizeBytes || typeof fileSizeBytes !== 'number' || fileSizeBytes <= 0) {
    return errorResponse('fileSizeBytes must be a positive number', 400);
  }
  if (!mimeType || !mimeType.startsWith('video/')) {
    return errorResponse('File must be a video', 400);
  }
  if (!teamId || typeof teamId !== 'string') {
    return errorResponse('teamId is required', 400);
  }

  // ── 3. Verify Firebase auth token ───────────────────────────────────────────
 let decodedToken;
try {
  decodedToken = await Promise.race([
    verifyAuthToken(request),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(Object.assign(
          new Error('Firebase Admin timed out — check FIREBASE_CLIENT_EMAIL and FIREBASE_SERVICE_ACCOUNT env vars'),
          { statusCode: 500 }
        )),
        8000
      )
    ),
  ]);
} catch (err) {
  console.error('[request-upload] Auth failed:', err.message);
  return errorResponse(err.message, err.statusCode || 401);
}

  const uid = decodedToken.uid;

  // ── 4. Fetch user document & plan limits ────────────────────────────────────
  let userDoc;
  try {
    userDoc = await getUserDoc(uid);
  } catch (err) {
    return errorResponse(err.message, err.statusCode || 500);
  }

  // Use denormalised limits on user doc, fall back to plan defaults
  const plan   = userDoc.plan || 'free';
  const limits = userDoc.limits || PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // ── 5. Enforce file size limit ───────────────────────────────────────────────
  if (fileSizeBytes > limits.maxFileSizeBytes) {
    const limitMB   = Math.round(limits.maxFileSizeBytes / 1_048_576);
    const fileMB    = (fileSizeBytes / 1_048_576).toFixed(1);
    return errorResponse(
      `File too large. Your ${plan} plan allows up to ${limitMB} MB per video. This file is ${fileMB} MB.`,
      413
    );
  }

  // ── 6. Enforce total video count limit ───────────────────────────────────────
  const currentCount = userDoc.videosUploaded || 0;
  if (currentCount >= limits.maxVideos) {
    return errorResponse(
      `Video limit reached. Your ${plan} plan allows ${limits.maxVideos} video${limits.maxVideos !== 1 ? 's' : ''}. Delete an existing video to upload a new one.`,
      403
    );
  }

  // ── 7. Enforce total storage limit ──────────────────────────────────────────
  const currentStorage = userDoc.totalStorageUsed || 0;
  if (currentStorage + fileSizeBytes > limits.maxStorageBytes) {
    const usedMB  = Math.round(currentStorage / 1_048_576);
    const limitMB = Math.round(limits.maxStorageBytes / 1_048_576);
    return errorResponse(
      `Storage limit reached. You are using ${usedMB} MB of your ${limitMB} MB allowance.`,
      403
    );
  }

  // ── 8. Verify user is a member of the specified team ────────────────────────
  try {
    const teamSnap = await adminDb.collection('teams').doc(teamId).get();
    if (!teamSnap.exists) {
      return errorResponse('Team not found', 404);
    }
    const teamData = teamSnap.data();
    if (!teamData.members || !teamData.members[uid]) {
      return errorResponse('You are not a member of this team', 403);
    }
  } catch (err) {
    console.error('Team verification error:', err);
    return errorResponse('Failed to verify team membership', 500);
  }

  // ── 9. Request one-time upload URL from Cloudflare Stream ───────────────────
  let uploadUrl, videoId, expiresAt;
  try {
    ({ uploadUrl, videoId, expiresAt } = await createDirectUploadUrl({
      userId:       uid,
      teamId,
      promptId:     promptId || null,
      maxSizeBytes: limits.maxFileSizeBytes,
      expirySeconds: 1800,          // 30 minutes — frontend must start upload within this window
    }));
  } catch (cfErr) {
    console.error('Cloudflare upload URL error:', cfErr.message, cfErr.cfErrors);
    return errorResponse('Failed to prepare video upload. Please try again.', 502);
  }

  // ── 10. Save pending video document to Firestore ────────────────────────────
  // videoId === Cloudflare UID — single key across both systems
  try {
    const now = new Date();
    await adminDb.collection('videos').doc(videoId).set({
      videoId,
      ownerId:         uid,
      teamId,
      promptId:        promptId || null,
      title:           title?.trim() || fileName,
      fileSizeBytes,
      mimeType,
      durationSeconds: 0,
      status:          'pending',
      playback:        { hls: null, dash: null },
      thumbnailUrl:    null,
      visibility:      'private',
      totalViews:      0,
      uploadSession: {
        uploadUrl,
        expiresAt:   new Date(expiresAt),
        issuedAt:    now,
      },
      createdAt:  now,
      uploadedAt: null,
      updatedAt:  now,
    });
  } catch (dbErr) {
    console.error('Firestore write error:', dbErr);
    // Non-fatal: return the URL anyway — webhook will still update status
    // But log this for monitoring
  }

  // ── 11. Return upload credentials to frontend ────────────────────────────────
  // Frontend uses uploadUrl to PUT/POST directly to Cloudflare
  return successResponse({
    videoId,
    uploadUrl,
    expiresAt,
    // Tell frontend which CF customer subdomain to use for playback later
    accountSubdomain: `customer-${process.env.CLOUDFLARE_ACCOUNT_ID?.slice(0, 8)}`,
  });
}
