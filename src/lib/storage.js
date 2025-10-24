//src/lib/storage.js 
// Firebase Storage utilities for handling image uploads

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from './firebase';

const storage = getStorage();

/**
 * Upload image to Firebase Storage
 */
export async function uploadResultImage(file, promptId, userId) {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image must be less than 10MB');
    }

    // Create unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `results/${userId}/${promptId}/${timestamp}_${sanitizedName}`;
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, filename);
    const uploadResult = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    return {
      url: downloadURL,
      path: filename,
      filename: file.name,
      size: file.size,
      type: file.type,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Delete image from Firebase Storage
 */
export async function deleteResultImage(imagePath) {
  try {
    if (!imagePath) return;
    
    const storageRef = ref(storage, imagePath);
    await deleteObject(storageRef);
    console.log('Image deleted:', imagePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
}

/**
 * Get download URL from storage path
 */
export async function getImageURL(imagePath) {
  try {
    const storageRef = ref(storage, imagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting image URL:', error);
    return null;
  }
}

