// api/video/webhook.js
// POST /api/video/webhook
//
// Cloudflare Stream calls this when a video finishes processing.
// Updates Firestore video status → "ready" and stores playback URLs.
// Also increments user's videosUploaded counter.

import { adminDb }               from '../../src/lib/firebaseAdmin.js';
import { verifyWebhookSignature } from '../../src/lib/cloudflareApi.js';
import { errorResponse, successResponse } from '../../src/lib/apiHelpers.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // ── 1. Read raw body (needed for signature verification) ────────────────────
  // Must read as text BEFORE parsing JSON
  const rawBody = await request.text();

  // ── 2. Verify Cloudflare webhook signature ──────────────────────────────────
  const signatureHeader = request.headers.get('Webhook-Signature') || '';

  if (!signatureHeader) {
    console.error('Webhook received without signature header');
    return errorResponse('Missing webhook signature', 401);
  }

  const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    console.error('Webhook signature verification FAILED');
    return errorResponse('Invalid webhook signature', 401);
  }

  // ── 3. Parse webhook payload ─────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse('Invalid JSON payload', 400);
  }

  const eventType = event.event;
  const video     = event.video || {};
  const videoId   = video.uid;

  console.log(`CF Webhook: ${eventType} for video ${videoId}`);

  // ── 4. Handle "video ready" event ───────────────────────────────────────────
  if (eventType === 'stream.video.finished') {
    if (!videoId) {
      return errorResponse('Missing video UID in webhook payload', 400);
    }

    try {
      // Fetch existing Firestore document to get ownerId
      const videoRef  = adminDb.collection('videos').doc(videoId);
      const videoSnap = await videoRef.get();

      if (!videoSnap.exists) {
        // CF processed a video we have no record of — log and ignore
        console.warn(`Webhook for unknown video: ${videoId}`);
        return successResponse({ received: true });
      }

      const videoData = videoSnap.data();
      const ownerId   = videoData.ownerId;
      const now       = new Date();

      // ── 4a. Update video document to "ready" ────────────────────────────
      await videoRef.update({
        status:          'ready',
        durationSeconds: video.duration || 0,
        thumbnailUrl:    video.thumbnail || null,
        uploadedAt:      now,
        updatedAt:       now,

        // Store playback URLs
        'playback.hls':  video.playback?.hls  || null,
        'playback.dash': video.playback?.dash || null,

        // Clear one-time upload session data
        'uploadSession.uploadUrl': null,
        'uploadSession.expiresAt': null,
      });

      // ── 4b. Increment user's video count and storage usage ───────────────
      await adminDb.collection('users').doc(ownerId).update({
        videosUploaded:   adminDb.FieldValue.increment(1),
        totalStorageUsed: adminDb.FieldValue.increment(videoData.fileSizeBytes || 0),
        updatedAt:        now,
      });

      console.log(`✅ Video ${videoId} marked ready for user ${ownerId}`);

    } catch (err) {
      console.error('Webhook processing error:', err);
      // Return 200 anyway — CF will retry on non-2xx responses
      // which could cause duplicate updates
      return successResponse({ received: true, error: 'processing_failed' });
    }
  }

  // ── 5. Handle video encoding error ──────────────────────────────────────────
  if (eventType === 'stream.video.error') {
    if (videoId) {
      try {
        await adminDb.collection('videos').doc(videoId).update({
          status:    'error',
          updatedAt: new Date(),
        });
        console.warn(`Video ${videoId} encoding failed`);
      } catch (err) {
        console.error('Failed to update error status:', err);
      }
    }
  }

  // ── 6. Acknowledge all other events ─────────────────────────────────────────
  return successResponse({ received: true });
}
