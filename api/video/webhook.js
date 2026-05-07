import { getAdminDb }             from '../../src/lib/firebaseAdmin.js';
import { FieldValue }             from 'firebase-admin/firestore';
import { verifyWebhookSignature } from '../../src/lib/cloudflareApi.js';
import { errorResponse, successResponse } from '../../src/lib/apiHelpers.js';

export const config = { runtime: 'nodejs' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const rawBody = await request.text();
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

  if (eventType === 'stream.video.finished') {
    if (!videoId) {
      return errorResponse('Missing video UID in webhook payload', 400);
    }

    try {
      const db        = getAdminDb();
      const videoRef  = db.collection('videos').doc(videoId);
      const videoSnap = await videoRef.get();

      if (!videoSnap.exists) {
        console.warn(`Webhook for unknown video: ${videoId}`);
        return successResponse({ received: true });
      }

      const videoData = videoSnap.data();
      const ownerId   = videoData.ownerId;
      const now       = new Date();

      // 4a. Mark video ready
      await videoRef.update({
        status:                    'ready',
        durationSeconds:           video.duration   || 0,
        thumbnailUrl:              video.thumbnail  || null,
        uploadedAt:                now,
        updatedAt:                 now,
        'playback.hls':            video.playback?.hls  || null,
        'playback.dash':           video.playback?.dash || null,
        'uploadSession.uploadUrl': null,
        'uploadSession.expiresAt': null,
      });

      // 4b. Increment user counters
      await db.collection('users').doc(ownerId).update({
        videosUploaded:   FieldValue.increment(1),
        totalStorageUsed: FieldValue.increment(videoData.fileSizeBytes || 0),
        updatedAt:        now,
      });

      console.log(`✅ Video ${videoId} marked ready for user ${ownerId}`);

    } catch (err) {
      console.error('Webhook processing error:', err);
      return successResponse({ received: true, error: 'processing_failed' });
    }
  }

  if (eventType === 'stream.video.error') {
    if (videoId) {
      try {
        await getAdminDb().collection('videos').doc(videoId).update({
          status:    'error',
          updatedAt: new Date(),
        });
        console.warn(`Video ${videoId} encoding failed`);
      } catch (err) {
        console.error('Failed to update error status:', err);
      }
    }
  }

  return successResponse({ received: true });
}
