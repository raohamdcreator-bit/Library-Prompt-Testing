// src/lib/guestTeamAccess.js - FIXED: Memoized hasGuestAccess to prevent console spam
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

// ✅ CRITICAL FIX: Memoize the access check to prevent console spam loop
let cachedAccessData = null;
let lastAccessCheck = 0;
const ACCESS_CACHE_DURATION = 1000; // 1 second cache

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
    if (!teamId || !teamName || !createdBy) {
      throw new Error("Missing required fields");
    }

    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    );

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

    const guestAccessRef = doc(db, "guest-team-access", token);
    const guestAccessDoc = await getDoc(guestAccessRef);

    if (!guestAccessDoc.exists()) {
      return {
        valid: false,
        error: "Invalid or expired access link",
      };
    }

    const accessData = guestAccessDoc.data();

    if (accessData.status !== "active") {
      return {
        valid: false,
        error: "This access link has been deactivated",
      };
    }

    const now = Timestamp.now();
    if (accessData.expiresAt && accessData.expiresAt.toMillis() < now.toMillis()) {
      return {
        valid: false,
        error: "This access link has expired",
        expired: true,
      };
    }

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
 * ✅ CRITICAL FIX: Memoized to prevent console spam loop
 */
export function hasGuestAccess() {
  const now = Date.now();
  
  // Return cached data if available and fresh
  if (cachedAccessData && (now - lastAccessCheck) < ACCESS_CACHE_DURATION) {
    return cachedAccessData;
  }

  try {
    const token = sessionStorage.getItem("guest_team_token");
    const teamId = sessionStorage.getItem("guest_team_id");
    const permissions = sessionStorage.getItem("guest_team_permissions");

    // Only log on first check or cache miss
    if (!cachedAccessData || (now - lastAccessCheck) >= ACCESS_CACHE_DURATION) {
      console.log('🔍 [GUEST ACCESS] Checking access:', {
        hasToken: !!token,
        hasTeamId: !!teamId,
        hasPermissions: !!permissions
      });
    }

    const result = {
      hasAccess: !!(token && teamId && permissions),
      teamId: teamId || null,
      permissions: permissions ? JSON.parse(permissions) : null,
      token: token || null,
    };

    // Cache the result
    cachedAccessData = result;
    lastAccessCheck = now;

    return result;
  } catch (error) {
    console.error('❌ [GUEST ACCESS] Error checking access:', error);
    
    const errorResult = {
      hasAccess: false,
      teamId: null,
      permissions: null,
      token: null,
    };
    
    cachedAccessData = errorResult;
    lastAccessCheck = now;
    
    return errorResult;
  }
}

/**
 * Clear the access cache (call when access changes)
 */
export function clearGuestAccessCache() {
  cachedAccessData = null;
  lastAccessCheck = 0;
}

/**
 * Store guest access in session storage
 */
export function setGuestAccess(teamId, permissions, token) {
  try {
    console.log('✅ [GUEST ACCESS] Setting guest access:', {
      teamId: teamId.substring(0, 8),
      token: token.substring(0, 8),
      hasPermissions: !!permissions
    });
    
    sessionStorage.setItem("guest_team_token", token);
    sessionStorage.setItem("guest_team_id", teamId);
    sessionStorage.setItem("guest_team_permissions", JSON.stringify(permissions));
    sessionStorage.setItem("is_guest_mode", "true");
    
    // Clear cache to force fresh read
    clearGuestAccessCache();
    
    return true;
  } catch (error) {
    console.error('❌ [GUEST ACCESS] Error setting access:', error);
    return false;
  }
}

/**
 * Clear guest access from session storage
 */
export function clearGuestAccess() {
  try {
    console.log('🧹 [GUEST ACCESS] Clearing guest access');
    
    sessionStorage.removeItem("guest_team_token");
    sessionStorage.removeItem("guest_team_id");
    sessionStorage.removeItem("guest_team_permissions");
    sessionStorage.removeItem("is_guest_mode");
    
    // Clear cache
    clearGuestAccessCache();
    
    return true;
  } catch (error) {
    console.error('❌ [GUEST ACCESS] Error clearing access:', error);
    return false;
  }
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
