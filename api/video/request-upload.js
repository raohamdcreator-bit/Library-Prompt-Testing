// api/video/request-upload.js

import admin from 'firebase-admin';

const t0  = Date.now();
const log = (msg) => console.log(`[request-upload] +${Date.now()-t0}ms ${msg}`);

// ── Initialize Firebase Admin exactly like _auth.js does ──────────────────────
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

const LIMITS = {
  free: { maxVideos: 2,   maxFileSizeBytes: 25  * 1024 * 1024,      maxStorageBytes: 50  * 1024 * 1024      },
  pro:  { maxVideos: 50,  maxFileSizeBytes: 500 * 1024 * 1024,      maxStorageBytes: 5   * 1024 * 1024 * 1024 },
  team: { maxVideos: 200, maxFileSizeBytes: 1024 * 1024 * 1024,     maxStorageBytes: 20  * 1024 * 1024 * 1024 },
};

export default async function handler(req, res) {
  log('HANDLER STARTED');

  // ── CORS ────────────────────────────────────────────────────────────────────
  const ALLOWED_ORIGINS = [
    'https://prism-app.online',
    'https://www.prism-app.online',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const reqOrigin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods',  'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',  'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { fileName, fileSizeBytes, mimeType, teamId, promptId, title } = req.body;
  log('body parsed');

  if (!fileName   || typeof fileName   !== 'string') return res.status(400).json({ success: false, error: 'fileName is required' });
  if (!fileSizeBytes || fileSizeBytes  <= 0)          return res.status(400).json({ success: false, error: 'fileSizeBytes must be positive' });
  if (!mimeType   || !mimeType.startsWith('video/'))  return res.status(400).json({ success: false, error: 'File must be a video' });
  if (!teamId     || typeof teamId     !== 'string')  return res.status(400).json({ success: false, error: 'teamId is required' });

  // ── Auth — same pattern as _auth.js ────────────────────────────────────────
  log('verifying auth token...');
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing Bearer token' });
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
    log(`auth OK uid=${uid}`);
  } catch (err) {
    log(`auth FAILED: ${err.message}`);
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  // ── Fetch user doc ──────────────────────────────────────────────────────────
  log('fetching user doc...');
  let userDoc;
  try {
    const snap = await admin.firestore().collection('users').doc(uid).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }
    userDoc = snap.data();
    log(`user doc OK plan=${userDoc.plan || 'free'}`);
  } catch (err) {
    log(`user doc FAILED: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to load user profile' });
  }

  // ── Plan limits ─────────────────────────────────────────────────────────────
  const plan   = userDoc.plan || 'free';
  const limits = LIMITS[plan] || LIMITS.free;

  if (fileSizeBytes > limits.maxFileSizeBytes) {
    const limitMB = Math.round(limits.maxFileSizeBytes / 1_048_576);
    const fileMB  = (fileSizeBytes / 1_048_576).toFixed(1);
    return res.status(413).json({ success: false, error: `File too large. Plan allows ${limitMB}MB, file is ${fileMB}MB.` });
  }
  if ((userDoc.videosUploaded || 0) >= limits.maxVideos) {
    return res.status(403).json({ success: false, error: `Video limit reached for ${plan} plan.` });
  }
  if ((userDoc.totalStorageUsed || 0) + fileSizeBytes > limits.maxStorageBytes) {
    return res.status(403).json({ success: false, error: 'Storage limit reached.' });
  }

  // ── Verify team membership ──────────────────────────────────────────────────
  log('checking team membership...');
  try {
    const teamSnap = await admin.firestore().collection('teams').doc(teamId).get();
    if (!teamSnap.exists) return res.status(404).json({ success: false, error: 'Team not found' });
    if (!teamSnap.data().members?.[uid]) return res.status(403).json({ success: false, error: 'Not a team member' });
    log('team OK');
  } catch (err) {
    log(`team FAILED: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to verify team' });
  }

  // ── Request Cloudflare upload URL ───────────────────────────────────────────
  log('requesting CF upload URL...');
  let uploadUrl, videoId, expiresAt;
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken  = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) throw new Error('Cloudflare env vars missing');

    expiresAt      = new Date(Date.now() + 1800 * 1000).toISOString();
    const cfRes    = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600,
          expiry:            expiresAt,
          meta:              { userId: uid, teamId, promptId, source: 'prism-app' },
          requireSignedURLs: false,
        }),
      }
    );

    const cfData = await cfRes.json();
    if (!cfRes.ok || !cfData.success) {
      const msg = cfData.errors?.map(e => e.message).join(', ') || `CF HTTP ${cfRes.status}`;
      throw new Error(msg);
    }

    uploadUrl = cfData.result.uploadURL;
    videoId   = cfData.result.uid;
    log(`CF OK videoId=${videoId}`);
  } catch (err) {
    log(`CF FAILED: ${err.message}`);
    return res.status(502).json({ success: false, error: `Failed to prepare upload: ${err.message}` });
  }

  // ── Save pending video doc ──────────────────────────────────────────────────
  log('saving video doc...');
  try {
    const now = new Date();
    await admin.firestore().collection('videos').doc(videoId).set({
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
      uploadSession:   {
        uploadUrl,
        expiresAt:  new Date(expiresAt),
        issuedAt:   now,
      },
      createdAt:       now,
      uploadedAt:      null,
      updatedAt:       now,
    });
    log('video doc saved');
  } catch (err) {
    log(`video doc FAILED (non-fatal): ${err.message}`);
  }

  log('DONE');
  return res.status(200).json({
    success:          true,
    videoId,
    uploadUrl,
    expiresAt,
    accountSubdomain: `customer-${process.env.CLOUDFLARE_ACCOUNT_ID?.slice(0, 8)}`,
  });
}
