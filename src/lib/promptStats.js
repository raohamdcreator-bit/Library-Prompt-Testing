// src/lib/promptStats.js - FIXED: Proper guest copy tracking
import { db } from './firebase';
import { doc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { getGuestToken } from './guestToken';

/**
 * Get initial stats structure for a new prompt
 */
export function getInitialStats() {
  return {
    views: 0,
    copies: 0,
    guestCopies: 0, // ✅ Track guest copies separately
    comments: 0,
    ratings: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    totalRatings: 0,
    averageRating: 0,
    lastViewed: null,
    lastCopied: null,
    lastRated: null,
  };
}

/**
 * Track when a prompt is copied
 * ✅ FIXED: Properly tracks guest copies with token verification
 */
export async function trackPromptCopy(teamId, promptId, isGuest = false) {
  try {
    console.log('📋 [COPY TRACKING] Starting:', { teamId, promptId, isGuest });
    
    if (!teamId || !promptId) {
      console.error('❌ [COPY TRACKING] Missing teamId or promptId');
      return { success: false, error: 'Missing required parameters' };
    }

    const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
    
    // ✅ CRITICAL: Build update object based on user type
    const updateData = {
      'stats.copies': increment(1),
      'stats.lastCopied': serverTimestamp(),
    };
    
    // ✅ Track guest copies separately — only call getGuestToken when actually a guest
    if (isGuest) {
      const guestToken = getGuestToken();
      console.log('📋 [COPY TRACKING] Guest copy detected, token:', guestToken ? 'present' : 'missing');
      
      if (!guestToken) {
        // Still track the copy, but skip the guest counter
        console.warn('⚠️ [COPY TRACKING] Guest token not found — counting as anonymous copy');
      } else {
        updateData['stats.guestCopies'] = increment(1);
        console.log('✅ [COPY TRACKING] Incrementing guestCopies counter');
      }
    }

    await updateDoc(promptRef, updateData);
    
    console.log('✅ [COPY TRACKING] Copy tracked successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ [COPY TRACKING] Error:', error);
    
    // Handle case where stats field doesn't exist yet
    if (error.code === 'not-found') {
      try {
        const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
        const promptSnap = await getDoc(promptRef);
        
        if (promptSnap.exists()) {
          const stats = promptSnap.data().stats || getInitialStats();
          stats.copies = (stats.copies || 0) + 1;
          stats.lastCopied = new Date();
          
          if (isGuest) {
            stats.guestCopies = (stats.guestCopies || 0) + 1;
          }
          
          await updateDoc(promptRef, { stats });
          console.log('✅ [COPY TRACKING] Stats initialized and copy tracked');
          return { success: true };
        }
      } catch (retryError) {
        console.error('❌ [COPY TRACKING] Retry failed:', retryError);
        return { success: false, error: retryError.message };
      }
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Track when a prompt is viewed
 */
export async function trackPromptView(teamId, promptId) {
  try {
    if (!teamId || !promptId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
    
    await updateDoc(promptRef, {
      'stats.views': increment(1),
      'stats.lastViewed': serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error tracking view:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update comment count when comments are added/removed
 */
export async function updateCommentCount(teamId, promptId, delta = 1) {
  try {
    if (!teamId || !promptId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
    
    await updateDoc(promptRef, {
      'stats.comments': increment(delta),
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating comment count:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recalculate rating statistics
 * This should be called when ratings are added/removed/updated
 */
export async function recalculateRatingStats(teamId, promptId, ratings) {
  try {
    if (!teamId || !promptId || !ratings) {
      return { success: false, error: 'Missing required parameters' };
    }

    const ratingCounts = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalRatings = 0;
    let totalScore = 0;

    // Count each rating value
    ratings.forEach((rating) => {
      const value = rating.rating;
      if (value >= 1 && value <= 5) {
        ratingCounts[value]++;
        totalRatings++;
        totalScore += value;
      }
    });

    const averageRating = totalRatings > 0 ? totalScore / totalRatings : 0;

    const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
    
    await updateDoc(promptRef, {
      'stats.ratings': ratingCounts,
      'stats.totalRatings': totalRatings,
      'stats.averageRating': averageRating,
      'stats.lastRated': serverTimestamp(),
    });

    return {
      success: true,
      stats: {
        ratingCounts,
        totalRatings,
        averageRating,
      },
    };
  } catch (error) {
    console.error('Error recalculating rating stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get prompt statistics
 */
export async function getPromptStats(teamId, promptId) {
  try {
    if (!teamId || !promptId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
    const promptSnap = await getDoc(promptRef);

    if (!promptSnap.exists()) {
      return { success: false, error: 'Prompt not found' };
    }

    const stats = promptSnap.data().stats || getInitialStats();

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error('Error getting prompt stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset all stats for a prompt (admin function)
 */
export async function resetPromptStats(teamId, promptId) {
  try {
    if (!teamId || !promptId) {
      return { success: false, error: 'Missing required parameters' };
    }

    const promptRef = doc(db, 'teams', teamId, 'prompts', promptId);
    
    await updateDoc(promptRef, {
      stats: getInitialStats(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error resetting prompt stats:', error);
    return { success: false, error: error.message };
  }
}
