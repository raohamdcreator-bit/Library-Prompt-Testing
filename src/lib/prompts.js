// src/lib/prompts.js - Fixed to prevent duplicate IDs
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

/**
 * Save new prompt
 * ✅ FIXED: Explicitly extracts only needed fields to prevent ID duplication
 */
export async function savePrompt(userId, prompt, teamId) {
  if (!teamId) throw new Error("No team selected");

  // ✅ Explicitly extract only the fields we want to save
  // This prevents accidentally saving id, teamId, createdAt, or other metadata
  const { title, text, tags } = prompt;

  await addDoc(collection(db, "teams", teamId, "prompts"), {
    title: title || "",
    text: text || "",
    tags: Array.isArray(tags) ? tags : [],
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
}

/**
 * Update existing prompt
 * ✅ FIXED: Filters out immutable fields that shouldn't be updated
 */
export async function updatePrompt(teamId, promptId, updates) {
  const ref = doc(db, "teams", teamId, "prompts", promptId);
  
  // ✅ Filter out fields that shouldn't be updated
  const { id, teamId: tid, createdAt, createdBy, ...allowedUpdates } = updates;
  
  await updateDoc(ref, allowedUpdates);
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
    // add favorite
    await setDoc(favRef, {
      teamId: prompt.teamId,
      promptId: prompt.id,
      title: prompt.title,
      text: prompt.text,
      tags: prompt.tags || [],
      createdAt: serverTimestamp(),
    });
  }
}