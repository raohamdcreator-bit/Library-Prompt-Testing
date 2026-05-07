// api/video/webhook.js
// Cloudflare Stream calls this when a video finishes processing.
// Uses the same firebase-admin default import pattern as _auth.js.

import admin from 'firebase-admin';

// ── Initialize Firebase Admin (same singleton pattern as _auth.js) ────────────
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

// ── Webhook signature verification ───────────────────────────────────────────
async function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('CLOUDFLARE_WEBHOOK_SECRET not set — rejecting webhook');
    return false;
  }

  try {
    const parts     = Object.fromEntries(
      signatureHeader.split(',').map(p => p.split('='))
    );
    const timestamp = parts.time;
    const signature = parts.sig1;

    if (!timestamp || !signature) return false;

    // Reject webhooks older than 5 minutes (replay attack prevention)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
      console.warn('Webhook too old — possible replay attack');
      return false;
    }

    const payload  = `${timestamp}.${rawBody}`;
    const encoder  = new TextEncoder();
    const key      = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf   = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;

  } catch (err) {
    console.error('Webhook signature error:', err);
    return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Read raw body for signature verification
  // In Vercel Node runtime, req.body is already parsed — we need the raw string.
  // The raw body is available via a buffer when we disable body parsing.
  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end',  ()    => resolve(data));
      req.on('error', err  => reject(err));
    });
  } catch (err) {
    console.error('Failed to read request body:', err);
    return res.status(400).json({ success: false, error: 'Failed to read body' });
  }

  // Verify Cloudflare webhook signature
  const signatureHeader = req.headers['webhook-signature'] || '';

  if (!signatureHeader) {
    console.error('Webhook received without signature header');
    return res.status(401).json({ success: false, error: 'Missing webhook signature' });
  }

  const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    console.error('Webhook signature verification FAILED');
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  // Parse payload
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }

  const eventType = event.event;
  const video     = event.video || {};
  const videoId   = video.uid;

  console.log(`CF Webhook: ${eventType} for video ${videoId}`);

  // ── Handle video ready ──────────────────────────────────────────────────────
  if (eventType === 'stream.video.finished') {
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'Missing video UID in webhook payload' });
    }

    try {
      const db        = admin.firestore();
      const videoRef  = db.collection('videos').doc(videoId);
      const videoSnap = await videoRef.get();

      if (!videoSnap.exists) {
        console.warn(`Webhook for unknown video: ${videoId}`);
        return res.status(200).json({ success: true, received: true });
      }

      const videoData = videoSnap.data();
      const ownerId   = videoData.ownerId;
      const now       = new Date();

      // Mark video ready and store playback URLs
      await videoRef.update({
        status:                    'ready',
        durationSeconds:           video.duration  || 0,
        thumbnailUrl:              video.thumbnail || null,
        uploadedAt:                now,
        updatedAt:                 now,
        'playback.hls':            video.playback?.hls  || null,
        'playback.dash':           video.playback?.dash || null,
        'uploadSession.uploadUrl': null,
        'uploadSession.expiresAt': null,
      });

      // Increment user video count and storage usage
      await db.collection('users').doc(ownerId).update({
        videosUploaded:   admin.firestore.FieldValue.increment(1),
        totalStorageUsed: admin.firestore.FieldValue.increment(videoData.fileSizeBytes || 0),
        updatedAt:        now,
      });

      console.log(`✅ Video ${videoId} marked ready for user ${ownerId}`);

    } catch (err) {
      console.error('Webhook processing error:', err);
      // Return 200 so Cloudflare doesn't retry — log the error for monitoring
      return res.status(200).json({ success: true, received: true, error: 'processing_failed' });
    }

    return res.status(200).json({ success: true, received: true });
  }

  // ── Handle video encoding error ─────────────────────────────────────────────
  if (eventType === 'stream.video.error') {
    if (videoId) {
      try {
        await admin.firestore().collection('videos').doc(videoId).update({
          status:    'error',
          updatedAt: new Date(),
        });
        console.warn(`Video ${videoId} encoding failed`);
      } catch (err) {
        console.error('Failed to update error status:', err);
      }
    }
    return res.status(200).json({ success: true, received: true });
  }

  // ── Acknowledge all other events ────────────────────────────────────────────
  return res.status(200).json({ success: true, received: true });
}
