// src/lib/videoApi.js
// Frontend-only module for calling /api/video/* routes.
// Gets the Firebase ID token and attaches it to every request.
// Cloudflare credentials never touch this file.

import { auth } from './firebase.js';

/**
 * Get the current user's Firebase ID token.
 * Throws if user is not authenticated.
 */
// AFTER
async function getIdToken() {
  const user = await new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged(
      (u) => { unsub(); resolve(u); },
      (err) => { unsub(); reject(err); }
    );
  });
  if (!user) throw new Error('You must be signed in to upload videos');
  return user.getIdToken(false);
}

/**
 * Step 1 of upload flow — request a one-time Cloudflare upload URL.
 * All limit enforcement happens server-side in /api/video/request-upload.
 *
 * @param {object} params
 * @param {File}   params.file       - The video File object
 * @param {string} params.teamId     - Team this video belongs to
 * @param {string} params.title      - Display title
 * @param {string} [params.promptId] - Optional linked prompt
 * @returns {Promise<{ videoId, uploadUrl, expiresAt }>}
 */
export async function requestUploadUrl({ file, teamId, title, promptId }) {
  const token = await getIdToken();

  const response = await fetch('/api/video/request-upload', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName:      file.name,
      fileSizeBytes: file.size,
      mimeType:      file.type,
      teamId,
      promptId:      promptId || null,
      title:         title || file.name,
    }),
  });

 let data;
try {
  data = await response.json();
} catch {
  throw new Error(
    `Server error (HTTP ${response.status}) — the API returned a non-JSON response. ` +
    `Check Vercel function logs for the actual error.`
  );
}

if (!response.ok || !data.success) {
  throw new Error(data.error || `Upload request failed with status ${response.status}`);
}

  return {
    videoId:   data.videoId,
    uploadUrl: data.uploadUrl,
    expiresAt: data.expiresAt,
  };
}

/**
 * Step 2 of upload flow — upload file directly to Cloudflare Stream.
 * Uses XMLHttpRequest (not fetch) so we get real upload progress events.
 * Your server never sees the video bytes — zero Vercel bandwidth cost.
 *
 * @param {object}   params
 * @param {string}   params.uploadUrl     - One-time CF upload URL
 * @param {File}     params.file          - The video File object
 * @param {Function} params.onProgress    - Called with 0-100 percentage
 * @param {AbortSignal} [params.signal]   - Optional cancel signal
 * @returns {Promise<void>}
 */
export function uploadToCloudflare({ uploadUrl, file, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // ── Progress tracking ────────────────────────────────────────────────────
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress?.(pct);
      }
    });

    // ── Completion ───────────────────────────────────────────────────────────
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(
          `Upload failed with status ${xhr.status}. Please try again.`
        ));
      }
    });

    // ── Network error ────────────────────────────────────────────────────────
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload. Check your connection.'));
    });

    // ── Abort / cancel ───────────────────────────────────────────────────────
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    // Wire up AbortSignal to XHR abort
    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    // Cloudflare Direct Upload expects a multipart/form-data POST
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
}

/**
 * Poll Firestore for video status after upload.
 * Cloudflare processes the video asynchronously — this waits for "ready".
 * Resolves when ready, rejects after timeout or on error status.
 *
 * @param {string}   videoId
 * @param {Function} onStatusChange  - Called with current status string
 * @param {number}   [timeoutMs=120000] - Give up after 2 minutes
 */
export async function waitForVideoReady(videoId, onStatusChange, timeoutMs = 120_000) {
  // Import Firestore client-side SDK (already in your firebase.js)
  const { db }      = await import('./firebase.js');
  const { doc, onSnapshot } = await import('firebase/firestore');

  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      unsubscribe();
      reject(new Error('Video processing timed out. Please refresh and try again.'));
    }, timeoutMs);

    const unsubscribe = onSnapshot(
      doc(db, 'videos', videoId),
      (snap) => {
        if (!snap.exists()) return;

        const status = snap.data().status;
        onStatusChange?.(status);

        if (status === 'ready') {
          clearTimeout(deadline);
          unsubscribe();
          resolve(snap.data());
        }

        if (status === 'error') {
          clearTimeout(deadline);
          unsubscribe();
          reject(new Error('Video processing failed. Please try uploading again.'));
        }
      },
      (err) => {
        clearTimeout(deadline);
        reject(err);
      }
    );
  });
}
