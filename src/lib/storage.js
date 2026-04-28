// src/lib/storage.js
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from './firebase';

// Pass the app instance explicitly so the correct Firebase project is used
const storage = getStorage(app);

const UPLOAD_TIMEOUT_MS = 60_000; // 60 s — fail fast instead of hanging forever 

/**
 * Upload image with real progress tracking.
 * @param {File}   file
 * @param {string} promptId
 * @param {string} userId
 * @param {(pct: number) => void} [onProgress]  called 0-100
 */
export async function uploadResultImage(file, promptId, userId, onProgress) {
  if (!file.type.startsWith('image/')) throw new Error('File must be an image');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be less than 10MB');

  const timestamp  = Date.now();
  const safeName   = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename   = `results/${userId}/${promptId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, filename);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    // ── Timeout guard ──────────────────────────────────────────────────────
    // If the upload task never fires 'error' or 'complete' (e.g. App Check
    // blocks the request silently, or the network stalls), reject after 60 s
    // so the modal doesn't get stuck on "Uploading…" forever.
    const timer = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('Upload timed out. Check your connection and try again.'));
    }, UPLOAD_TIMEOUT_MS);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      (error) => {
        clearTimeout(timer);
        console.error('Upload error:', error);

        // Provide a friendlier message for the two most common failure modes
        if (error.code === 'storage/unauthorized') {
          reject(new Error('Permission denied. Make sure you are signed in and try again.'));
        } else if (error.code === 'storage/canceled') {
          reject(new Error('Upload was cancelled.'));
        } else {
          reject(error);
        }
      },
      async () => {
        clearTimeout(timer);
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url,
            path:     filename,
            filename: file.name,
            size:     file.size,
            type:     file.type,
          });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function deleteResultImage(imagePath) {
  if (!imagePath) return;
  try {
    await deleteObject(ref(storage, imagePath));
  } catch (error) {
    if (error.code !== 'storage/object-not-found') throw error;
  }
}

export async function getImageURL(imagePath) {
  try {
    return await getDownloadURL(ref(storage, imagePath));
  } catch (error) {
    console.error('Error getting image URL:', error);
    return null;
  }
}
