// src/lib/prompts.js - FIXED: Added guest mode support
import { db } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  deleteDoc as fbDeleteDoc,
} from "firebase/firestore";
import { getInitialStats } from "./promptStats";
import { guestState } from "./guestState";  // ✅ ADD THIS

/**
 * Save new prompt with visibility control
 * ✅ FIXED: Added guest mode support
 */
export async function savePrompt(userId, prompt, teamId) {
  // ✅ GUEST MODE: Save to sessionStorage
  if (userId === 'guest' || !userId) {
    const { title, text, tags, visibility = "public" } = prompt;
    
    const guestPrompt = {
      title: title || "",
      text: text || "",
      tags: Array.isArray(tags) ? tags : [],
      visibility: visibility,
      owner: 'guest',
      isGuest: true,
    };
    
    return guestState.addPrompt(guestPrompt);
  }
  
  // ✅ AUTHENTICATED: Save to Firestore
  if (!teamId) throw new Error("No team selected");

  const { title, text, tags, visibility = "public" } = prompt;

  await addDoc(collection(db, "teams", teamId, "prompts"), {
    title: title || "",
    text: text || "",
    tags: Array.isArray(tags) ? tags : [],
    visibility: visibility,
    createdAt: serverTimestamp(),
    createdBy: userId,
    stats: getInitialStats(),  
  });
}

/**
 * Update existing prompt
 * ✅ FIXED: Added guest mode support
 */
export async function updatePrompt(teamId, promptId, updates) {
  // ✅ GUEST MODE: Update in guestState
  if (!teamId || teamId === null) {
    return guestState.updatePrompt(promptId, updates);
  }
  
  // ✅ AUTHENTICATED: Update in Firestore
  const ref = doc(db, "teams", teamId, "prompts", promptId);
  const { id, teamId: tid, createdAt, createdBy, ...allowedUpdates } = updates;
  await updateDoc(ref, allowedUpdates);
}

/**
 * Toggle prompt visibility between public and private
 */
export async function togglePromptVisibility(teamId, promptId, currentVisibility) {
  const ref = doc(db, "teams", teamId, "prompts", promptId);
  const newVisibility = currentVisibility === "public" ? "private" : "public";
  
  await updateDoc(ref, {
    visibility: newVisibility,
    lastVisibilityChange: serverTimestamp(),
  });
  
  return newVisibility;
}

/**
 * Check if user can view a prompt based on visibility rules
 */
export function canViewPrompt(prompt, userId, userRole) {
  // Public prompts are visible to all team members
  if (prompt.visibility === "public" || !prompt.visibility) {
    return true;
  }

  // Private prompts visibility rules
  if (prompt.visibility === "private") {
    if (prompt.createdBy === userId) {
      return true;
    }

    if (userRole === "admin" || userRole === "owner") {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Check if user can edit a prompt's visibility
 */
export function canChangeVisibility(prompt, userId, userRole) {
  if (prompt.createdBy === userId) {
    return true;
  }

  if (userRole === "admin" || userRole === "owner") {
    return true;
  }

  return false;
}

/**
 * Filter prompts based on visibility permissions
 */
export function filterVisiblePrompts(prompts, userId, userRole) {
  return prompts.filter(prompt => canViewPrompt(prompt, userId, userRole));
}

/**
 * Delete prompt
 * ✅ FIXED: Added guest mode support
 */
export async function deletePrompt(teamId, promptId) {
  // ✅ GUEST MODE: Delete from guestState (not needed, handled elsewhere)
  if (!teamId || teamId === null) {
    // Guest deletion handled in PromptList via deleteDemoPrompt
    return;
  }
  
  // ✅ AUTHENTICATED: Delete from Firestore
  const ref = doc(db, "teams", teamId, "prompts", promptId);
  await deleteDoc(ref);
}

/**
 * Toggle Favorite
 */
export async function toggleFavorite(userId, prompt, isFav) {
  const favRef = doc(db, "users", userId, "favorites", prompt.id);

  if (isFav) {
    await fbDeleteDoc(favRef);
  } else {
    await setDoc(favRef, {
      teamId: prompt.teamId,
      promptId: prompt.id,
      title: prompt.title,
      text: prompt.text,
      tags: prompt.tags || [],
      visibility: prompt.visibility || "public",
      createdAt: serverTimestamp(),
    });
  }
}
