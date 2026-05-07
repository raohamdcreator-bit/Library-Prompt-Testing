// api/video/request-upload.js — FULL REPLACEMENT
// Uses dynamic requires to avoid ESM cold-start crashes on Vercel

export const config = { runtime: 'nodejs' };

export default async function handler(request) {
  const t0  = Date.now();
  const log = (msg) => console.log(`[request-upload] +${Date.now()-t0}ms ${msg}`);

  log('HANDLER STARTED');

  // ── Method guard ────────────────────────────────────────────────────────────
  if (request.method !== 'POST') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
    log('body parsed');
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { fileName, fileSizeBytes, mimeType, teamId, promptId, title } = body;

  if (!fileName   || typeof fileName      !== 'string') return Response.json({ success: false, error: 'fileName is required' },            { status: 400 });
  if (!fileSizeBytes || fileSizeBytes     <= 0)         return Response.json({ success: false, error: 'fileSizeBytes must be positive' },   { status: 400 });
  if (!mimeType   || !mimeType.startsWith('video/'))    return Response.json({ success: false, error: 'File must be a video' },             { status: 400 });
  if (!teamId     || typeof teamId        !== 'string') return Response.json({ success: false, error: 'teamId is required' },               { status: 400 });

  // ── Load Firebase Admin lazily ──────────────────────────────────────────────
  log('loading firebase-admin...');
  let adminApp, adminDb, adminAuth, FieldValue;
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue: FV } = await import('firebase-admin/firestore');
    const { getAuth }                       = await import('firebase-admin/auth');

    FieldValue = FV;

    const rawSA = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawSA) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');

    let sa;
    try { sa = JSON.parse(rawSA); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON'); }

    if (!sa.project_id || !sa.client_email || !sa.private_key) {
      throw new Error(`Service account JSON missing fields: ${[
        !sa.project_id   && 'project_id',
        !sa.client_email && 'client_email',
        !sa.private_key  && 'private_key',
      ].filter(Boolean).join(', ')}`);
    }

    adminApp  = getApps().length > 0
      ? getApps()[0]
      : initializeApp({ credential: cert({
          projectId:   sa.project_id,
          clientEmail: sa.client_email,
          privateKey:  sa.private_key.replace(/\\n/g, '\n'),
        })});

    adminDb   = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    log('firebase-admin loaded OK');
  } catch (err) {
    log(`firebase-admin FAILED: ${err.message}`);
    return Response.json({ success: false, error: `Firebase init failed: ${err.message}` }, { status: 500 });
  }

  // ── Verify auth token ───────────────────────────────────────────────────────
  log('verifying auth token...');
  let uid;
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json({ success: false, error: 'Missing Authorization header' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
    log(`auth OK uid=${uid}`);
  } catch (err) {
    log(`auth FAILED: ${err.message}`);
    return Response.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  // ── Fetch user doc ──────────────────────────────────────────────────────────
  log('fetching user doc...');
  let userDoc;
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) {
      return Response.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }
    userDoc = snap.data();
    log(`user doc OK plan=${userDoc.plan || 'free'}`);
  } catch (err) {
    log(`user doc FAILED: ${err.message}`);
    return Response.json({ success: false, error: 'Failed to load user profile' }, { status: 500 });
  }

  // ── Plan limits ─────────────────────────────────────────────────────────────
  const LIMITS = {
    free: { maxVideos: 2,   maxFileSizeBytes: 25*1024*1024,        maxStorageBytes: 50*1024*1024        },
    pro:  { maxVideos: 50,  maxFileSizeBytes: 500*1024*1024,       maxStorageBytes: 5*1024*1024*1024    },
    team: { maxVideos: 200, maxFileSizeBytes: 1024*1024*1024,      maxStorageBytes: 20*1024*1024*1024   },
  };
  const plan   = userDoc.plan || 'free';
  const limits = LIMITS[plan] || LIMITS.free;

  if (fileSizeBytes > limits.maxFileSizeBytes) {
    const limitMB = Math.round(limits.maxFileSizeBytes / 1_048_576);
    const fileMB  = (fileSizeBytes / 1_048_576).toFixed(1);
    return Response.json({ success: false, error: `File too large. Plan allows ${limitMB}MB, file is ${fileMB}MB.` }, { status: 413 });
  }
  if ((userDoc.videosUploaded || 0) >= limits.maxVideos) {
    return Response.json({ success: false, error: `Video limit reached for ${plan} plan.` }, { status: 403 });
  }
  if ((userDoc.totalStorageUsed || 0) + fileSizeBytes > limits.maxStorageBytes) {
    return Response.json({ success: false, error: 'Storage limit reached.' }, { status: 403 });
  }

  // ── Verify team membership ──────────────────────────────────────────────────
  log('checking team membership...');
  try {
    const teamSnap = await adminDb.collection('teams').doc(teamId).get();
    if (!teamSnap.exists) {
      return Response.json({ success: false, error: 'Team not found' }, { status: 404 });
    }
    if (!teamSnap.data().members?.[uid]) {
      return Response.json({ success: false, error: 'Not a team member' }, { status: 403 });
    }
    log('team membership OK');
  } catch (err) {
    log(`team check FAILED: ${err.message}`);
    return Response.json({ success: false, error: 'Failed to verify team' }, { status: 500 });
  }

  // ── Request Cloudflare upload URL ───────────────────────────────────────────
  log('requesting CF upload URL...');
  let uploadUrl, videoId, expiresAt;
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken  = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing');
    }

    const expiry = new Date(Date.now() + 1800 * 1000).toISOString();
    const cfRes  = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600,
          expiry,
          meta: { userId: uid, teamId, promptId, source: 'prism-app' },
          requireSignedURLs: false,
        }),
      }
    );

    const cfData = await cfRes.json();
    if (!cfRes.ok || !cfData.success) {
      const msg = cfData.errors?.map(e => e.message).join(',') || `CF HTTP ${cfRes.status}`;
      throw new Error(msg);
    }

    uploadUrl = cfData.result.uploadURL;
    videoId   = cfData.result.uid;
    expiresAt = expiry;
    log(`CF upload URL OK videoId=${videoId}`);
  } catch (err) {
    log(`CF FAILED: ${err.message}`);
    return Response.json({ success: false, error: `Failed to prepare upload: ${err.message}` }, { status: 502 });
  }

  // ── Save pending video doc ──────────────────────────────────────────────────
  log('saving video doc...');
  try {
    const now = new Date();
    await adminDb.collection('videos').doc(videoId).set({
      videoId, ownerId: uid, teamId,
      promptId:        promptId || null,
      title:           title?.trim() || fileName,
      fileSizeBytes,   mimeType,
      durationSeconds: 0,
      status:          'pending',
      playback:        { hls: null, dash: null },
      thumbnailUrl:    null,
      visibility:      'private',
      totalViews:      0,
      uploadSession:   { uploadUrl, expiresAt: new Date(expiresAt), issuedAt: now },
      createdAt:       now,
      uploadedAt:      null,
      updatedAt:       now,
    });
    log('video doc saved');
  } catch (err) {
    log(`video doc save FAILED (non-fatal): ${err.message}`);
  }

  log('DONE');
  return Response.json({
    success: true,
    videoId,
    uploadUrl,
    expiresAt,
    accountSubdomain: `customer-${accountId?.slice(0, 8)}`,
  });
}
