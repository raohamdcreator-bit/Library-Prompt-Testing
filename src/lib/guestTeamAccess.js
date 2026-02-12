// src/lib/guestTeamAccess.js - Guest/Read-only Team Access via Link
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  increment,
} from "firebase/firestore";

/**
 * Generate a guest access link for a team
 * This creates a special invite that doesn't require authentication
 */
export async function generateGuestAccessLink({
  teamId,
  teamName,
  createdBy,
  creatorName,
  expiresInDays = 30,
}) {
  try {
    // Validate inputs
    if (!teamId || !teamName || !createdBy) {
      throw new Error("Missing required fields");
    }

    // Calculate expiration
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    );

    // Create guest access document
    const guestAccessRef = await addDoc(collection(db, "guest-team-access"), {
      teamId,
      teamName,
      createdBy,
      creatorName: creatorName || null,
      createdAt: serverTimestamp(),
      expiresAt,
      status: "active",
      accessCount: 0,
      lastAccessed: null,
      permissions: {
        canView: true,
        canCopy: true,
        canComment: true,
        canRate: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canManageMembers: false,
      },
    });

    // Generate the access link
    const accessToken = guestAccessRef.id;
    const baseUrl = window.location.origin;
    const accessLink = `${baseUrl}/guest-team?token=${accessToken}`;

    console.log("✅ Guest access link generated:", accessLink);

    return {
      success: true,
      accessToken,
      accessLink,
      expiresAt: expiresAt.toDate(),
    };
  } catch (error) {
    console.error("❌ Error generating guest access link:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Validate and get guest access details by token
 */
export async function validateGuestAccessToken(token) {
  try {
    if (!token) {
      return {
        valid: false,
        error: "No access token provided",
      };
    }

    // Get the guest access document
    const guestAccessRef = doc(db, "guest-team-access", token);
    const guestAccessDoc = await getDoc(guestAccessRef);

    if (!guestAccessDoc.exists()) {
      return {
        valid: false,
        error: "Invalid or expired access link",
      };
    }

    const accessData = guestAccessDoc.data();

    // Check if active
    if (accessData.status !== "active") {
      return {
        valid: false,
        error: "This access link has been deactivated",
      };
    }

    // Check expiration
    const now = Timestamp.now();
    if (accessData.expiresAt && accessData.expiresAt.toMillis() < now.toMillis()) {
      return {
        valid: false,
        error: "This access link has expired",
        expired: true,
      };
    }

    // Update access count and last accessed
    await updateDoc(guestAccessRef, {
      accessCount: increment(1),
      lastAccessed: serverTimestamp(),
    });

    return {
      valid: true,
      teamId: accessData.teamId,
      teamName: accessData.teamName,
      permissions: accessData.permissions,
      token,
      expiresAt: accessData.expiresAt?.toDate(),
    };
  } catch (error) {
    console.error("❌ Error validating guest access token:", error);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Check if user has guest access to a team
 */
export function hasGuestAccess() {
  const token = sessionStorage.getItem("guest_team_token");
  const teamId = sessionStorage.getItem("guest_team_id");
  const permissions = sessionStorage.getItem("guest_team_permissions");

  if (!token || !teamId || !permissions) {
    return {
      hasAccess: false,
      teamId: null,
      permissions: null,
      token: null,
    };
  }

  return {
    hasAccess: true,
    teamId,
    permissions: JSON.parse(permissions),
    token,
  };
}

/**
 * Store guest access in session storage
 */
export function setGuestAccess(teamId, permissions, token) {
  sessionStorage.setItem("guest_team_token", token);
  sessionStorage.setItem("guest_team_id", teamId);
  sessionStorage.setItem("guest_team_permissions", JSON.stringify(permissions));
  
  // Also store in a flag for easy checking
  sessionStorage.setItem("is_guest_mode", "true");
}

/**
 * Clear guest access from session storage
 */
export function clearGuestAccess() {
  sessionStorage.removeItem("guest_team_token");
  sessionStorage.removeItem("guest_team_id");
  sessionStorage.removeItem("guest_team_permissions");
  sessionStorage.removeItem("is_guest_mode");
}

/**
 * Get all active guest access links for a team (for management)
 */
export async function getTeamGuestAccessLinks(teamId) {
  try {
    const guestAccessRef = collection(db, "guest-team-access");
    const q = query(
      guestAccessRef,
      where("teamId", "==", teamId),
      where("status", "==", "active")
    );

    const snapshot = await getDocs(q);
    const now = new Date();

    const links = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        expiresAt: doc.data().expiresAt?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        lastAccessed: doc.data().lastAccessed?.toDate(),
      }))
      .filter((link) => {
        // Filter out expired links
        return !link.expiresAt || link.expiresAt > now;
      });

    return {
      success: true,
      links,
    };
  } catch (error) {
    console.error("❌ Error fetching guest access links:", error);
    return {
      success: false,
      error: error.message,
      links: [],
    };
  }
}

/**
 * Revoke/deactivate a guest access link
 */
export async function revokeGuestAccessLink(linkId) {
  try {
    const guestAccessRef = doc(db, "guest-team-access", linkId);
    
    await updateDoc(guestAccessRef, {
      status: "revoked",
      revokedAt: serverTimestamp(),
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("❌ Error revoking guest access link:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if a specific permission is allowed for guest
 */
export function canGuestPerform(action) {
  const { hasAccess, permissions } = hasGuestAccess();
  
  if (!hasAccess || !permissions) {
    return false;
  }

  const permissionMap = {
    view: permissions.canView,
    copy: permissions.canCopy,
    comment: permissions.canComment,
    rate: permissions.canRate,
    create: permissions.canCreate,
    edit: permissions.canEdit,
    delete: permissions.canDelete,
    invite: permissions.canInvite,
    manageMembers: permissions.canManageMembers,
  };

  return permissionMap[action] || false;
}

/**
 * Create a guest comment (stores guest identifier instead of userId)
 */
export async function createGuestComment(teamId, promptId, commentText) {
  try {
    if (!canGuestPerform("comment")) {
      throw new Error("Guest users cannot comment");
    }

    const { token } = hasGuestAccess();

    // Create comment with guest identifier
    const commentRef = await addDoc(
      collection(db, "teams", teamId, "prompts", promptId, "comments"),
      {
        text: commentText,
        userId: null, // No userId for guests
        guestToken: token,
        isGuest: true,
        userName: "Guest User",
        userAvatar: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        edited: false,
      }
    );

    return {
      success: true,
      commentId: commentRef.id,
    };
  } catch (error) {
    console.error("❌ Error creating guest comment:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a guest rating
 */
export async function createGuestRating(teamId, promptId, rating) {
  try {
    if (!canGuestPerform("rate")) {
      throw new Error("Guest users cannot rate prompts");
    }

    const { token } = hasGuestAccess();

    // Use guest token as rating ID to ensure one rating per guest
    const ratingRef = doc(
      db,
      "teams",
      teamId,
      "prompts",
      promptId,
      "ratings",
      `guest_${token}`
    );

    await updateDoc(ratingRef, {
      rating,
      userId: null,
      guestToken: token,
      isGuest: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
    };
  } catch (error) {
    // If doc doesn't exist, create it
    if (error.code === "not-found") {
      try {
        const ratingRef = doc(
          db,
          "teams",
          teamId,
          "prompts",
          promptId,
          "ratings",
          `guest_${token}`
        );
        
        await updateDoc(ratingRef, {
          rating,
          userId: null,
          guestToken: token,
          isGuest: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return { success: true };
      } catch (createError) {
        return {
          success: false,
          error: createError.message,
        };
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Track guest prompt copy
 */
export async function trackGuestPromptCopy(teamId, promptId) {
  try {
    const { token } = hasGuestAccess();

    // Update prompt stats
    const promptRef = doc(db, "teams", teamId, "prompts", promptId);
    await updateDoc(promptRef, {
      "stats.copies": increment(1),
      "stats.lastCopiedAt": serverTimestamp(),
      "stats.guestCopies": increment(1),
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Error tracking guest copy:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get guest access statistics for a team (admin view)
 */
export async function getGuestAccessStats(teamId) {
  try {
    const guestAccessRef = collection(db, "guest-team-access");
    const q = query(guestAccessRef, where("teamId", "==", teamId));

    const snapshot = await getDocs(q);

    const stats = {
      totalLinks: 0,
      activeLinks: 0,
      revokedLinks: 0,
      expiredLinks: 0,
      totalAccesses: 0,
      lastAccessed: null,
    };

    const now = new Date();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      stats.totalLinks++;

      if (data.status === "active") {
        const expiresAt = data.expiresAt?.toDate();
        if (!expiresAt || expiresAt > now) {
          stats.activeLinks++;
        } else {
          stats.expiredLinks++;
        }
      } else if (data.status === "revoked") {
        stats.revokedLinks++;
      }

      stats.totalAccesses += data.accessCount || 0;

      const lastAccessed = data.lastAccessed?.toDate();
      if (lastAccessed && (!stats.lastAccessed || lastAccessed > stats.lastAccessed)) {
        stats.lastAccessed = lastAccessed;
      }
    });

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("❌ Error getting guest access stats:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
