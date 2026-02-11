// src/lib/inviteUtils.js - FIXED: Proper invite link generation for email invites
import { db } from "./firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  increment,
} from "firebase/firestore";

// Constants
const INVITE_EXPIRATION_DAYS = 7;
const MAX_PENDING_INVITES_PER_USER = 10;

/**
 * Check if an invite already exists for email/team combination
 */
export async function checkDuplicateInvite(teamId, email) {
  const normalizedEmail = email.toLowerCase().trim();

  const invitesRef = collection(db, "team-invites");
  const q = query(
    invitesRef,
    where("teamId", "==", teamId),
    where("email", "==", normalizedEmail),
    where("status", "==", "pending"),
    where("type", "==", "email")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { exists: false };
  }

  const existingInvite = snapshot.docs[0].data();
  const expiresAt = existingInvite.expiresAt?.toDate();
  const now = new Date();

  // Check if expired
  if (expiresAt && expiresAt < now) {
    return { exists: false, expired: true };
  }

  return {
    exists: true,
    inviteId: snapshot.docs[0].id,
    expiresAt: expiresAt,
  };
}

/**
 * Count pending invites sent by a user (rate limiting)
 */
export async function countPendingInvites(userId) {
  const invitesRef = collection(db, "team-invites");
  const q = query(
    invitesRef,
    where("invitedBy", "==", userId),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Create a new team invite with validation (EMAIL-BASED)
 */
export async function createTeamInvite({
  teamId,
  teamName,
  email,
  role,
  invitedBy,
  inviterName,
}) {
  // Validate inputs
  if (!teamId || !teamName || !email || !role || !invitedBy) {
    throw new Error("Missing required fields for invite creation");
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid email format");
  }

  // Validate role
  if (!["member", "admin"].includes(role)) {
    throw new Error("Invalid role. Must be 'member' or 'admin'");
  }

  // Check for duplicate invites
  const duplicateCheck = await checkDuplicateInvite(teamId, normalizedEmail);
  if (duplicateCheck.exists) {
    throw new Error("An active invitation already exists for this email");
  }

  // Check rate limiting
  const pendingCount = await countPendingInvites(invitedBy);
  if (pendingCount >= MAX_PENDING_INVITES_PER_USER) {
    throw new Error(
      `You have reached the maximum of ${MAX_PENDING_INVITES_PER_USER} pending invitations`
    );
  }

  // Calculate expiration date
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
  );

  // Create invite (EMAIL TYPE)
  const inviteDoc = await addDoc(collection(db, "team-invites"), {
    type: "email",
    teamId,
    teamName,
    email: normalizedEmail,
    role,
    invitedBy,
    inviterName: inviterName || null,
    createdAt: serverTimestamp(),
    expiresAt,
    status: "pending",
    token: null,
    maxUses: null,
    useCount: 0,
    usedBy: [],
  });

  return {
    success: true,
    inviteId: inviteDoc.id,
    expiresAt: expiresAt.toDate(),
  };
}

/**
 * Create a LINK-BASED team invite
 */
export async function createLinkInvite({
  teamId,
  teamName,
  role,
  invitedBy,
  inviterName,
  token,
  expiresInDays = 7,
}) {
  // Validate inputs
  if (!teamId || !teamName || !role || !invitedBy || !token) {
    throw new Error("Missing required fields for link invite creation");
  }

  // Validate role
  if (!["member", "admin"].includes(role)) {
    throw new Error("Invalid role. Must be 'member' or 'admin'");
  }

  // Check rate limiting
  const pendingCount = await countPendingInvites(invitedBy);
  if (pendingCount >= MAX_PENDING_INVITES_PER_USER) {
    throw new Error(
      `You have reached the maximum of ${MAX_PENDING_INVITES_PER_USER} pending invitations`
    );
  }

  // Calculate expiration date
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  );

  // Create invite (LINK TYPE)
  const inviteDoc = await addDoc(collection(db, "team-invites"), {
    type: "link",
    teamId,
    teamName,
    email: null,
    role,
    invitedBy,
    inviterName: inviterName || null,
    createdAt: serverTimestamp(),
    expiresAt,
    status: "pending",
    token,
    maxUses: null, // Unlimited uses
    useCount: 0,
    usedBy: [],
  });

  return {
    success: true,
    inviteId: inviteDoc.id,
    token,
    expiresAt: expiresAt.toDate(),
  };
}

/**
 * Validate and get invite by token
 */
export async function getInviteByToken(token) {
  try {
    const invitesRef = collection(db, "team-invites");
    const q = query(
      invitesRef,
      where("token", "==", token),
      where("type", "==", "link"),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        valid: false,
        error: "Invite not found or already processed",
      };
    }

    const inviteDoc = snapshot.docs[0];
    const inviteData = inviteDoc.data();

    // Check expiration
    const now = Timestamp.now();
    if (inviteData.expiresAt && inviteData.expiresAt.toMillis() < now.toMillis()) {
      return {
        valid: false,
        error: "Invite has expired",
        expired: true,
      };
    }

    return {
      valid: true,
      invite: {
        id: inviteDoc.id,
        ...inviteData,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Accept a team invite via TOKEN (atomic transaction)
 */
export async function acceptLinkInvite(token, userId) {
  try {
    const result = await runTransaction(db, async (transaction) => {
      // Get invite by token
      const invitesRef = collection(db, "team-invites");
      const q = query(
        invitesRef,
        where("token", "==", token),
        where("type", "==", "link"),
        where("status", "==", "pending")
      );

      const inviteSnapshot = await getDocs(q);

      if (inviteSnapshot.empty) {
        throw new Error("INVITE_NOT_FOUND");
      }

      const inviteDoc = inviteSnapshot.docs[0];
      const inviteData = inviteDoc.data();
      const inviteRef = doc(db, "team-invites", inviteDoc.id);

      // Check expiration
      const now = Timestamp.now();
      if (inviteData.expiresAt && inviteData.expiresAt.toMillis() < now.toMillis()) {
        throw new Error("INVITE_EXPIRED");
      }

      // Get team document
      const teamRef = doc(db, "teams", inviteData.teamId);
      const teamDoc = await transaction.get(teamRef);

      if (!teamDoc.exists()) {
        throw new Error("TEAM_NOT_FOUND");
      }

      const teamData = teamDoc.data();

      // Check if already a member
      if (teamData.members && teamData.members[userId]) {
        throw new Error("ALREADY_MEMBER");
      }

      // Update team - add member
      transaction.update(teamRef, {
        [`members.${userId}`]: inviteData.role || "member",
      });

      // Update invite - increment use count and track user
      transaction.update(inviteRef, {
        useCount: increment(1),
        usedBy: arrayUnion(userId),
      });

      return {
        teamId: inviteData.teamId,
        teamName: teamData.name,
        role: inviteData.role,
      };
    });

    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Accept a team invite via EMAIL (existing function - unchanged)
 */
export async function acceptTeamInvite(inviteId, teamId, userId) {
  try {
    const result = await runTransaction(db, async (transaction) => {
      // Get team document
      const teamRef = doc(db, "teams", teamId);
      const teamDoc = await transaction.get(teamRef);

      if (!teamDoc.exists()) {
        throw new Error("TEAM_NOT_FOUND");
      }

      const teamData = teamDoc.data();

      // Check if already a member
      if (teamData.members && teamData.members[userId]) {
        throw new Error("ALREADY_MEMBER");
      }

      // Get invite document
      const inviteRef = doc(db, "team-invites", inviteId);
      const inviteDoc = await transaction.get(inviteRef);

      if (!inviteDoc.exists()) {
        throw new Error("INVITE_NOT_FOUND");
      }

      const inviteData = inviteDoc.data();

      // Check if invite is still pending
      if (inviteData.status !== "pending") {
        throw new Error("INVITE_ALREADY_PROCESSED");
      }

      // Check expiration
      const now = Timestamp.now();
      if (inviteData.expiresAt && inviteData.expiresAt.toMillis() < now.toMillis()) {
        throw new Error("INVITE_EXPIRED");
      }

      // Update team - add member
      transaction.update(teamRef, {
        [`members.${userId}`]: inviteData.role || "member",
      });

      // Update invite - mark as accepted
      transaction.update(inviteRef, {
        status: "accepted",
        acceptedAt: Timestamp.now(),
        acceptedByUid: userId,
      });

      return {
        teamName: teamData.name,
        role: inviteData.role,
      };
    });

    return { success: true, ...result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Reject a team invite
 */
export async function rejectTeamInvite(inviteId, userId) {
  try {
    await runTransaction(db, async (transaction) => {
      const inviteRef = doc(db, "team-invites", inviteId);
      transaction.update(inviteRef, {
        status: "rejected",
        rejectedAt: Timestamp.now(),
        rejectedByUid: userId,
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Cancel a team invite (by inviter or admin)
 */
export async function cancelTeamInvite(inviteId) {
  try {
    await updateDoc(doc(db, "team-invites", inviteId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete an invite (admin only)
 */
export async function deleteTeamInvite(inviteId) {
  try {
    await deleteDoc(doc(db, "team-invites", inviteId));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get all pending invites for a team (both email and link)
 */
export async function getTeamInvites(teamId) {
  try {
    const invitesRef = collection(db, "team-invites");
    const q = query(
      invitesRef,
      where("teamId", "==", teamId),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(q);
    const now = new Date();

    const invites = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((invite) => {
        // Filter out expired invites
        const expiresAt = invite.expiresAt?.toDate();
        return !expiresAt || expiresAt > now;
      });

    return { success: true, invites };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      invites: [],
    };
  }
}

/**
 * Get all pending invites for a user's email
 */
export async function getUserInvites(email) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const invitesRef = collection(db, "team-invites");
    const q = query(
      invitesRef,
      where("email", "==", normalizedEmail),
      where("type", "==", "email"),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(q);
    const now = new Date();

    const invites = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((invite) => {
        // Filter out expired invites
        const expiresAt = invite.expiresAt?.toDate();
        return !expiresAt || expiresAt > now;
      });

    return { success: true, invites };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      invites: [],
    };
  }
}

/**
 * Clean up expired invites (should be called periodically or via Cloud Function)
 */
export async function cleanupExpiredInvites() {
  try {
    const invitesRef = collection(db, "team-invites");
    const q = query(invitesRef, where("status", "==", "pending"));

    const snapshot = await getDocs(q);
    const now = Timestamp.now();
    let cleanedCount = 0;

    const batch = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
        batch.push(
          updateDoc(doc.ref, {
            status: "expired",
            expiredAt: serverTimestamp(),
          })
        );
        cleanedCount++;
      }
    });

    await Promise.all(batch);

    return {
      success: true,
      cleanedCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      cleanedCount: 0,
    };
  }
}

/**
 * Generate invite link
 */
export function generateInviteLink(token, baseUrl = window.location.origin) {
  return `${baseUrl}/join?token=${token}`;
}

/**
 * Send invite email via API
 */
export async function sendInviteEmail({
  to,
  teamName,
  invitedBy,
  role,
  link,
}) {
  try {
    const response = await fetch("/api/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        link,
        teamName,
        invitedBy,
        role,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to send email");
    }

    const data = await response.json();
    return { success: true, emailId: data.emailId };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * ✅ FIXED: Complete EMAIL invite flow (create + send email)
 * Now generates proper invite link with inviteId parameter
 */
export async function sendTeamInvitation({
  teamId,
  teamName,
  email,
  role,
  invitedBy,
  inviterName,
}) {
  try {
    // Create invite in database
    const createResult = await createTeamInvite({
      teamId,
      teamName,
      email,
      role,
      invitedBy,
      inviterName,
    });

    if (!createResult.success) {
      throw new Error(createResult.error);
    }

    // ✅ FIXED: Generate invite link with BOTH inviteId AND teamId
    const inviteLink = `${window.location.origin}/join?inviteId=${createResult.inviteId}&teamId=${teamId}`;

    console.log("✅ Generated email invite link:", inviteLink);

    // Try to send email (non-blocking)
    const emailResult = await sendInviteEmail({
      to: email,
      teamName,
      invitedBy: inviterName,
      role,
      link: inviteLink,
    });

    return {
      success: true,
      inviteId: createResult.inviteId,
      inviteLink,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      expiresAt: createResult.expiresAt,
    };
  } catch (error) {
    console.error("❌ Error in sendTeamInvitation:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Complete LINK invite flow (generate token + create invite)
 */
export async function generateTeamInviteLink({
  teamId,
  teamName,
  role,
  invitedBy,
  inviterName,
  expiresInDays = 7,
}) {
  try {
    // Call API to generate token
    const response = await fetch("/api/generate-invite-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        teamName,
        role,
        invitedBy,
        inviterName,
        expiresInDays,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate invite link");
    }

    const { token, inviteLink, expiresAt } = await response.json();

    // Create invite document in Firestore
    const createResult = await createLinkInvite({
      teamId,
      teamName,
      role,
      invitedBy,
      inviterName,
      token,
      expiresInDays,
    });

    if (!createResult.success) {
      throw new Error(createResult.error);
    }

    console.log("✅ Generated link invite:", inviteLink);

    return {
      success: true,
      inviteId: createResult.inviteId,
      token,
      inviteLink,
      expiresAt: new Date(expiresAt),
    };
  } catch (error) {
    console.error("❌ Error in generateTeamInviteLink:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Validate invite before accepting
 */
export async function validateInvite(inviteId) {
  try {
    const inviteRef = doc(db, "team-invites", inviteId);
    const inviteDoc = await getDoc(inviteRef);

    if (!inviteDoc.exists()) {
      return {
        valid: false,
        error: "Invite not found",
      };
    }

    const inviteData = inviteDoc.data();

    // Check status
    if (inviteData.status !== "pending") {
      return {
        valid: false,
        error: "Invite has already been processed",
      };
    }

    // Check expiration
    const now = Timestamp.now();
    if (inviteData.expiresAt && inviteData.expiresAt.toMillis() < now.toMillis()) {
      return {
        valid: false,
        error: "Invite has expired",
      };
    }

    return {
      valid: true,
      invite: {
        id: inviteDoc.id,
        ...inviteData,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

// Export constants for use in components
export { INVITE_EXPIRATION_DAYS, MAX_PENDING_INVITES_PER_USER };
