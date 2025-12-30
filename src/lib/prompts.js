// src/lib/prompts.js - Updated with Visibility Controls
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


/**
 * Save new prompt with visibility control
 * ✅ FIXED: Explicitly extracts only needed fields to prevent ID duplication
 * ✅ NEW: Added visibility field (default: public)
 */
export async function savePrompt(userId, prompt, teamId) {
  if (!teamId) throw new Error("No team selected");

  // ✅ Explicitly extract only the fields we want to save
  const { title, text, tags, visibility = "public" } = prompt;

  await addDoc(collection(db, "teams", teamId, "prompts"), {
    title: title || "",
    text: text || "",
    tags: Array.isArray(tags) ? tags : [],
    visibility: visibility, // "public" or "private"
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
}

/**
 * Update existing prompt
 * ✅ FIXED: Filters out immutable fields that shouldn't be updated
 * ✅ NEW: Allows updating visibility
 */
export async function updatePrompt(teamId, promptId, updates) {
  const ref = doc(db, "teams", teamId, "prompts", promptId);
  
  // ✅ Filter out fields that shouldn't be updated
  const { id, teamId: tid, createdAt, createdBy, ...allowedUpdates } = updates;
  
  await updateDoc(ref, allowedUpdates);
}

/**
 * Toggle prompt visibility between public and private
 * ✅ NEW: Dedicated function for visibility toggle
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
export async function savePrompt(userId, prompt, teamId) {
  if (!teamId) throw new Error("No team selected");

  const { title, text, tags, visibility = "public" } = prompt;

  await addDoc(collection(db, "teams", teamId, "prompts"), {
    title: title || "",
    text: text || "",
    tags: Array.isArray(tags) ? tags : [],
    visibility: visibility,
    createdAt: serverTimestamp(),
    createdBy: userId,
    stats: getInitialStats(), // ✅ Initialize stats
  });
}

/**
 * Check if user can view a prompt based on visibility rules
 * ✅ NEW: Permission checker for prompt visibility
 * 
 * Rules:
 * - Public prompts: Everyone in team can see
 * - Private prompts: Only creator, admins, and owners can see
 */
export function canViewPrompt(prompt, userId, userRole) {
  // Public prompts are visible to all team members
  if (prompt.visibility === "public" || !prompt.visibility) {
    return true;
  }

  // Private prompts visibility rules
  if (prompt.visibility === "private") {
    // Creator can always see their own prompts
    if (prompt.createdBy === userId) {
      return true;
    }

    // Admins and owners can see all prompts
    if (userRole === "admin" || userRole === "owner") {
      return true;
    }

    // Others cannot see private prompts
    return false;
  }

  // Default to visible (backward compatibility)
  return true;
}

/**
 * Check if user can edit a prompt's visibility
 * ✅ NEW: Permission checker for changing visibility
 */
export function canChangeVisibility(prompt, userId, userRole) {
  // Creator can always change their own prompt's visibility
  if (prompt.createdBy === userId) {
    return true;
  }

  // Admins and owners can change any prompt's visibility
  if (userRole === "admin" || userRole === "owner") {
    return true;
  }

  return false;
}

/**
 * Filter prompts based on visibility permissions
 * ✅ NEW: Helper function to filter prompt arrays
 */
export function filterVisiblePrompts(prompts, userId, userRole) {
  return prompts.filter(prompt => canViewPrompt(prompt, userId, userRole));
}

/**
 * Delete prompt
 */
export async function deletePrompt(teamId, promptId) {
  const ref = doc(db, "teams", teamId, "prompts", promptId);
  await deleteDoc(ref);
}

/**
 * Toggle Favorite
 */
export async function toggleFavorite(userId, prompt, isFav) {
  const favRef = doc(db, "users", userId, "favorites", prompt.id);

  if (isFav) {
    // remove favorite
    await fbDeleteDoc(favRef);
  } else {
    // add favorite - include visibility info
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
