import admin from 'firebase-admin';
import { getPlanLimits } from '../../src/config/plans.js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const ALLOWED_ORIGINS = [
  'https://prism-app.online',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req, res) {
  if (ALLOWED_ORIGINS.includes(req.headers.origin)) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ success: false, error: 'Method not allowed' });

  // Auth
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ success: false, error: 'Missing token' });

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  const { fileName, fileSizeBytes, mimeType, teamId } = req.body;

  if (!fileName || !fileSizeBytes || !mimeType || !teamId) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Format check
  if (!['video/mp4', 'video/quicktime'].includes(mimeType)) {
    return res.status(400).json({
      success: false,
      error: 'Only MP4 and MOV files are accepted.',
    });
  }

  // Load user
  let userDoc;
  try {
    const snap = await admin.firestore().collection('users').doc(uid).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'User not found' });
    userDoc = snap.data();
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to load user' });
  }

  const plan   = userDoc.plan || 'free';
  const limits = getPlanLimits(plan);

  // Enforce file size
  if (fileSizeBytes > limits.maxFileSizeBytes) {
    const limitMB = Math.round(limits.maxFileSizeBytes / 1_048_576);
    const fileMB  = (fileSizeBytes / 1_048_576).toFixed(1);
    return res.status(413).json({
      success: false,
      error: `File too large. Your ${plan} plan allows ${limitMB}MB per video. This file is ${fileMB}MB.`,
      code:  'FILE_TOO_LARGE',
    });
  }

  // Enforce video count
  if ((userDoc.videosUploaded || 0) >= limits.maxVideos) {
    return res.status(403).json({
      success: false,
      error: `Video limit reached. Your ${plan} plan allows ${limits.maxVideos} videos.`,
      code:  'VIDEO_LIMIT_REACHED',
    });
  }

  // Enforce storage
  const storageUsed = userDoc.storageUsedBytes || 0;
  if (storageUsed + fileSizeBytes > limits.maxStorageBytes) {
    return res.status(403).json({
      success: false,
      error: `Storage full on ${plan} plan.`,
      code:  'STORAGE_LIMIT_REACHED',
    });
  }

  // Team membership
  try {
    const teamSnap = await admin.firestore().collection('teams').doc(teamId).get();
    if (!teamSnap.exists) return res.status(404).json({ success: false, error: 'Team not found' });
    if (!teamSnap.data().members?.[uid]) return res.status(403).json({ success: false, error: 'Not a team member' });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to verify team' });
  }

  // All checks passed — frontend can proceed with Firebase Storage upload
  return res.status(200).json({ success: true, approved: true, plan });
}
