// src/lib/storage.js
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

const storage = getStorage();

/**
 * Upload image with real progress tracking.
 * @param {File} file
 * @param {string} promptId
 * @param {string} userId
 * @param {(pct: number) => void} [onProgress]  - called 0-100
 */
export async function uploadResultImage(file, promptId, userId, onProgress) {
  if (!file.type.startsWith('image/')) throw new Error('File must be an image');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be less than 10MB');

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `results/${userId}/${promptId}/${timestamp}_${sanitizedName}`;

  const storageRef = ref(storage, filename);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url,
            path: filename,
            filename: file.name,
            size: file.size,
            type: file.type,
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
