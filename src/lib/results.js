//src/lib/results.js 
// Firestore operations for prompt results

import { db } from './firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { deleteResultImage } from './storage';

/**
 * Add a new result to a prompt
 */
export async function addResultToPrompt(teamId, promptId, userId, resultData) {
  try {
    const resultRef = collection(db, 'teams', teamId, 'prompts', promptId, 'results');
    
    await addDoc(resultRef, {
      ...resultData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error adding result:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing result
 */
export async function updateResult(teamId, promptId, resultId, updates) {
  try {
    const resultRef = doc(db, 'teams', teamId, 'prompts', promptId, 'results', resultId);
    
    await updateDoc(resultRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating result:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a result (and its image if exists)
 */
export async function deleteResult(teamId, promptId, resultId, imagePath = null) {
  try {
    // Delete image from storage if exists
    if (imagePath) {
      await deleteResultImage(imagePath);
    }
    
    // Delete result document
    const resultRef = doc(db, 'teams', teamId, 'prompts', promptId, 'results', resultId);
    await deleteDoc(resultRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting result:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all results for a prompt (one-time read)
 */
export async function getPromptResults(teamId, promptId) {
  try {
    const resultsRef = collection(db, 'teams', teamId, 'prompts', promptId, 'results');
    const q = query(resultsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting results:', error);
    return [];
  }
}

/**
 * Subscribe to real-time results updates
 */
export function subscribeToResults(teamId, promptId, callback) {
  const resultsRef = collection(db, 'teams', teamId, 'prompts', promptId, 'results');
  const q = query(resultsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(results);
    },
    (error) => {
      console.error('Error subscribing to results:', error);
      callback([]);
    }
  );
}
