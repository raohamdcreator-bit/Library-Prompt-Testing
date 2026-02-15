// src/lib/promptStats.js - Helper functions for tracking prompt statistics
// ✅ FIXED: Proper guest copy tracking with real-time updates

import { doc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Track when a prompt is copied
 * ✅ FIXED: Now properly tracks guest copies separately
 */
export async function trackPromptCopy(teamId, promptId, isGuest = false) {
  if (!teamId || !promptId) return;

  try {
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    
    // Get current stats to ensure we don't lose data
    const promptSnap = await getDoc(promptRef);
    const currentStats = promptSnap.exists() ? promptSnap.data().stats || {} : {};
    
    // ✅ FIXED: Increment both total copies and guest copies if applicable
    const updates = {
      "stats.copies": increment(1),
    };
    
    if (isGuest) {
      updates["stats.guestCopies"] = increment(1);
    }
    
    await updateDoc(promptRef, updates);
    
    console.log(`✅ Tracked copy for prompt ${promptId}${isGuest ? ' (guest)' : ''}`);
  } catch (error) {
    console.error("Error tracking prompt copy:", error);
    // Don't throw - tracking shouldn't break the copy functionality
  }
}

/**
 * Track when a prompt is viewed
 */
export async function trackPromptView(teamId, promptId) {
  if (!teamId || !promptId) return;

  try {
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    await updateDoc(promptRef, {
      "stats.views": increment(1),
    });
  } catch (error) {
    console.error("Error tracking prompt view:", error);
  }
}

/**
 * Update comment count for a prompt
 */
export async function updateCommentCount(teamId, promptId, increment_value = 1) {
  if (!teamId || !promptId) return;

  try {
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    await updateDoc(promptRef, {
      "stats.comments": increment(increment_value),
    });
  } catch (error) {
    console.error("Error updating comment count:", error);
  }
}

/**
 * Initialize stats object for a new prompt
 */
export function initializePromptStats() {
  return {
    views: 0,
    copies: 0,
    guestCopies: 0, // ✅ Track guest copies separately
    comments: 0,
    totalRatings: 0,
    averageRating: 0,
    ratings: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  };
}

/**
 * Get formatted stats for display
 */
export function getFormattedStats(stats) {
  if (!stats) return initializePromptStats();
  
  return {
    views: stats.views || 0,
    copies: stats.copies || 0,
    guestCopies: stats.guestCopies || 0,
    authenticatedCopies: (stats.copies || 0) - (stats.guestCopies || 0),
    comments: stats.comments || 0,
    totalRatings: stats.totalRatings || 0,
    averageRating: stats.averageRating || 0,
    ratings: stats.ratings || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}
