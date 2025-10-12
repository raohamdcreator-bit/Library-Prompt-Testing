// src/lib/firestoreUtils.js - Optimized Firestore Operations
import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
  writeBatch,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { logError } from './sentry';

// Cache for user profiles to avoid repeated reads
const userProfileCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Batch read user profiles (max 10 per batch due to Firestore limitations)
export async function batchGetUserProfiles(userIds) {
  if (!userIds || userIds.length === 0) return {};

  const uniqueIds = [...new Set(userIds)];
  const profiles = {};
  const uncachedIds = [];

  // Check cache first
  const now = Date.now();
  uniqueIds.forEach(uid => {
    const cached = userProfileCache.get(uid);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      profiles[uid] = cached.data;
    } else {
      uncachedIds.push(uid);
    }
  });

  if (uncachedIds.length === 0) {
    return profiles;
  }

  try {
    // Firestore 'in' query supports max 10 items
    const batches = [];
    for (let i = 0; i < uncachedIds.length; i += 10) {
      batches.push(uncachedIds.slice(i, i + 10));
    }

    const batchPromises = batches.map(async (batch) => {
      const q = query(
        collection(db, 'users'),
        where(documentId(), 'in', batch)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
    });

    const results = await Promise.all(batchPromises);
    
    // Flatten and cache results
    results.flat().forEach(profile => {
      profiles[profile.uid] = profile;
      userProfileCache.set(profile.uid, {
        data: profile,
        timestamp: now,
      });
    });

    // Add null for users that don't exist
    uncachedIds.forEach(uid => {
      if (!profiles[uid]) {
        profiles[uid] = null;
        userProfileCache.set(uid, {
          data: null,
          timestamp: now,
        });
      }
    });

    return profiles;
  } catch (error) {
    logError(error, {
      operation: 'batchGetUserProfiles',
      userIds: uncachedIds,
    });
    
    // Fallback to individual reads
    const fallbackPromises = uncachedIds.map(async (uid) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const data = { uid, ...userDoc.data() };
          profiles[uid] = data;
          userProfileCache.set(uid, { data, timestamp: now });
        } else {
          profiles[uid] = null;
        }
      } catch (err) {
        console.error(`Error loading profile for ${uid}:`, err);
        profiles[uid] = null;
      }
    });

    await Promise.all(fallbackPromises);
    return profiles;
  }
}

// Clear user profile cache
export function clearUserProfileCache(uid = null) {
  if (uid) {
    userProfileCache.delete(uid);
  } else {
    userProfileCache.clear();
  }
}

// Get a single user profile with caching
export async function getUserProfile(uid) {
  if (!uid) return null;

  const now = Date.now();
  const cached = userProfileCache.get(uid);
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.exists() ? { uid, ...userDoc.data() } : null;
    
    userProfileCache.set(uid, {
      data,
      timestamp: now,
    });

    return data;
  } catch (error) {
    logError(error, {
      operation: 'getUserProfile',
      uid,
    });
    return null;
  }
}

// Batch write operations
export async function batchWriteDocuments(operations) {
  if (!operations || operations.length === 0) return { success: true };

  try {
    const batch = writeBatch(db);
    let operationCount = 0;

    for (const operation of operations) {
      const { type, ref, data } = operation;

      switch (type) {
        case 'set':
          batch.set(ref, data, { merge: operation.merge || false });
          break;
        case 'update':
          batch.update(ref, data);
          break;
        case 'delete':
          batch.delete(ref);
          break;
        default:
          console.warn('Unknown batch operation type:', type);
      }

      operationCount++;

      // Firestore batch limit is 500 operations
      if (operationCount >= 500) {
        await batch.commit();
        return batchWriteDocuments(operations.slice(500));
      }
    }

    await batch.commit();
    return { success: true, count: operationCount };
  } catch (error) {
    logError(error, {
      operation: 'batchWriteDocuments',
      operationCount: operations.length,
    });
    return { success: false, error };
  }
}

// Paginated query helper
export async function getPaginatedDocs(collectionRef, pageSize = 20, lastDoc = null) {
  try {
    let q = query(collectionRef, firestoreLimit(pageSize));

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _docRef: doc, // Keep reference for pagination
    }));

    return {
      docs,
      lastDoc: snapshot.docs[snapshot.docs.length - 1],
      hasMore: docs.length === pageSize,
    };
  } catch (error) {
    logError(error, {
      operation: 'getPaginatedDocs',
    });
    return { docs: [], lastDoc: null, hasMore: false };
  }
}

// Load team with member profiles (optimized)
export async function getTeamWithMembers(teamId) {
  try {
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    
    if (!teamDoc.exists()) {
      return null;
    }

    const teamData = { id: teamDoc.id, ...teamDoc.data() };
    const memberIds = Object.keys(teamData.members || {});

    // Batch load all member profiles
    const memberProfiles = await batchGetUserProfiles(memberIds);

    // Combine team data with member profiles
    return {
      ...teamData,
      memberProfiles,
    };
  } catch (error) {
    logError(error, {
      operation: 'getTeamWithMembers',
      teamId,
    });
    return null;
  }
}

// Optimized prompt loading with author profiles
export async function getPromptsWithAuthors(teamId, limitCount = 50) {
  try {
    const q = query(
      collection(db, 'teams', teamId, 'prompts'),
      firestoreLimit(limitCount)
    );

    const snapshot = await getDocs(q);
    const prompts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Extract unique author IDs
    const authorIds = [...new Set(prompts.map(p => p.createdBy).filter(Boolean))];

    // Batch load all author profiles
    const authorProfiles = await batchGetUserProfiles(authorIds);

    // Attach author profiles to prompts
    return prompts.map(prompt => ({
      ...prompt,
      author: authorProfiles[prompt.createdBy] || null,
    }));
  } catch (error) {
    logError(error, {
      operation: 'getPromptsWithAuthors',
      teamId,
    });
    return [];
  }
}

// Debounced Firestore write
let writeTimeouts = new Map();

export function debouncedWrite(docRef, data, delay = 1000) {
  const key = docRef.path;

  // Clear existing timeout
  if (writeTimeouts.has(key)) {
    clearTimeout(writeTimeouts.get(key));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(async () => {
      try {
        await setDoc(docRef, data, { merge: true });
        writeTimeouts.delete(key);
        resolve();
      } catch (error) {
        writeTimeouts.delete(key);
        reject(error);
      }
    }, delay);

    writeTimeouts.set(key, timeoutId);
  });
}

// Retry failed operations
export async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

// Query optimizer - add indexes hint
export function logMissingIndex(error, queryDescription) {
  if (error.code === 'failed-precondition' && error.message.includes('index')) {
    console.error(`
      ⚠️ Missing Firestore Index!
      Query: ${queryDescription}
      
      Create this index in Firebase Console:
      ${error.message}
    `);

    logError(error, {
      operation: 'missing-index',
      query: queryDescription,
      tags: {
        missing_index: 'true',
      },
    });
  }
}

// Export cache stats for debugging
export function getCacheStats() {
  return {
    userProfiles: {
      size: userProfileCache.size,
      keys: Array.from(userProfileCache.keys()),
    },
  };
}