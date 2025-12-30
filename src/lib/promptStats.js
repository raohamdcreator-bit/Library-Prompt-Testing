// src/lib/promptStats.js
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function trackPromptCopy(teamId, promptId) {
  try {
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    await updateDoc(promptRef, {
      "stats.copies": increment(1),
      "stats.lastCopied": serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error tracking copy:", error);
    return false;
  }
}

export async function trackPromptView(teamId, promptId) {
  try {
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    await updateDoc(promptRef, {
      "stats.views": increment(1),
      "stats.lastViewed": serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error tracking view:", error);
    return false;
  }
}

export async function updateCommentCount(teamId, promptId, change = 1) {
  try {
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    await updateDoc(promptRef, {
      "stats.comments": increment(change),
      "stats.lastCommented": serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error updating comment count:", error);
    return false;
  }
}

export function getInitialStats() {
  return {
    views: 0,
    copies: 0,
    comments: 0,
    totalRatings: 0,
    averageRating: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}
