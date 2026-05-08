import {
  getStorage, ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { app } from './firebase';
import { db } from './firebase';
import {
  doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';

const storage = getStorage(app);

const ALLOWED_MIME   = ['video/mp4', 'video/quicktime'];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // frontend guard — server enforces plan limit

/**
 * Upload video to Firebase Storage with progress tracking.
 * Saves metadata to Firestore on success.
 */
export async function uploadVideo({
  file,
  userId,
  teamId,
  promptId,
  title,
  onProgress,
}) {
  // ── Client-side validation ──────────────────────────────────────────────────
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error('Only MP4 and MOV files are accepted.');
  }
  if (file.size === 0) {
    throw new Error('File appears to be empty.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `File too large (${(file.size/1_048_576).toFixed(1)}MB). ` +
      `Maximum is ${Math.round(MAX_SIZE_BYTES/1_048_576)}MB on the free plan.`
    );
  }

  const videoId    = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `videos/${userId}/${videoId}/${safeName}`;
  const storageRef  = ref(storage, storagePath);

  // Save pending Firestore record before upload starts
  // so we can clean up if the upload fails
  const videoDocRef = doc(db, 'videos', videoId);
  await setDoc(videoDocRef, {
    videoId,
    ownerId:      userId,
    teamId,
    promptId:     promptId || null,
    title:        (title || file.name).substring(0, 200),
    fileSizeBytes: file.size,
    mimeType:     file.type,
    storagePath,
    status:       'uploading',
    downloadUrl:  null,
    thumbnailUrl: null,
    duration:     null,
    visibility:   'private',
    views:        0,
    createdAt:    serverTimestamp(),
    uploadedAt:   null,
    updatedAt:    serverTimestamp(),
  });

  // Upload with progress tracking
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        userId,
        teamId,
        promptId: promptId || '',
        videoId,
      },
    });

    // 60 second timeout guard
    const timeout = setTimeout(() => {
      uploadTask.cancel();
      // Mark as failed in Firestore
      updateDoc(videoDocRef, {
        status:    'error',
        lastError: 'Upload timed out',
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      reject(new Error('Upload timed out. Please check your connection and try again.'));
    }, 60_000);

    uploadTask.on(
      'state_changed',
      snapshot => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(pct);
      },
      async error => {
        clearTimeout(timeout);
        // Mark Firestore record as failed
        await updateDoc(videoDocRef, {
          status:    'error',
          lastError: error.message,
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        if (error.code === 'storage/canceled') {
          reject(new Error('Upload cancelled.'));
        } else if (error.code === 'storage/unauthorized') {
          reject(new Error('Permission denied. Please sign in and try again.'));
        } else if (error.code === 'storage/quota-exceeded') {
          reject(new Error('Storage quota exceeded. Please contact support.'));
        } else {
          reject(new Error(`Upload failed: ${error.message}`));
        }
      },
      async () => {
        clearTimeout(timeout);
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          await updateDoc(videoDocRef, {
            status:      'ready',
            downloadUrl,
            uploadedAt:  serverTimestamp(),
            updatedAt:   serverTimestamp(),
          });

          onProgress?.(100);
          resolve({
            videoId,
            downloadUrl,
            storagePath,
            title: (title || file.name).substring(0, 200),
          });
        } catch (err) {
          await updateDoc(videoDocRef, {
            status:    'error',
            lastError: err.message,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          reject(err);
        }
      }
    );
  });
}

/**
 * Delete a video from Storage and Firestore.
 * Called server-side or by the owner.
 */
export async function deleteVideo(videoId, storagePath) {
  // Delete from Storage
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (err) {
      if (err.code !== 'storage/object-not-found') throw err;
    }
  }
  // Firestore deletion handled by caller
}
