// src/lib/invites.js
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from "firebase/firestore";

export async function sendInvite({ 
  teamId, 
  teamName, 
  email, 
  invitedBy, 
  invitedByName,
  role = "member" 
}) {
  try {
    // ✅ Fixed: Using subcollection structure teams/{teamId}/invites
    await addDoc(collection(db, "teams", teamId, "invites"), {
      teamName,
      email: email.toLowerCase().trim(),
      invitedBy,
      invitedByName: invitedByName || null,
      role,
      createdAt: serverTimestamp(),
      status: "pending"
    });
    return { success: true };
  } catch (err) {
    console.error("Error sending invite:", err);
    return { success: false, error: err.message };
  }
}

export async function acceptInvite({ teamId, inviteId, userId, role }) {
  try {
    // Add user to team members
    const teamRef = doc(db, "teams", teamId);
    await updateDoc(teamRef, {
      [`members.${userId}`]: role
    });

    // Delete the invite
    await deleteDoc(doc(db, "teams", teamId, "invites", inviteId));

    return { success: true };
  } catch (err) {
    console.error("Error accepting invite:", err);
    return { success: false, error: err.message };
  }
}

export async function rejectInvite({ teamId, inviteId }) {
  try {
    await deleteDoc(doc(db, "teams", teamId, "invites", inviteId));
    return { success: true };
  } catch (err) {
    console.error("Error rejecting invite:", err);
    return { success: false, error: err.message };
  }
}

export async function cancelInvite({ teamId, inviteId }) {
  try {
    await deleteDoc(doc(db, "teams", teamId, "invites", inviteId));
    return { success: true };
  } catch (err) {
    console.error("Error canceling invite:", err);
    return { success: false, error: err.message };
  }
}