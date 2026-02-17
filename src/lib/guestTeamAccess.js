// src/lib/guestTeamAccess.js
// FIXED: Uses in-memory backup so guest token survives Firebase auth state changes
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

// ============================================================
// IN-MEMORY BACKUP — survives auth state changes clearing sessionStorage
// ============================================================
let _memoryToken = null;
let _memoryTeamId = null;
let _memoryPermissions = null;

// Memoization cache to prevent console spam
let cachedAccessData = null;
let lastAccessCheck = 0;
const ACCESS_CACHE_DURATION = 1000; // 1 second

// ============================================================
// CORE TOKEN MANAGEMENT
// ============================================================

/**
 * Store guest access — writes to BOTH sessionStorage AND in-memory backup
 */
export function setGuestAccess(teamId, permissions, token) {
  try {
    // ✅ Always save to memory first (survives auth state changes)
    _memoryToken = token;
    _memoryTeamId = teamId;
    _memoryPermissions = permissions;

    // Write to sessionStorage
    sessionStorage.setItem("guest_team_token", token);
    sessionStorage.setItem("guest_team_id", teamId);
    sessionStorage.setItem("guest_team_permissions", JSON.stringify(permissions));
    sessionStorage.setItem("is_guest_mode", "true");

    // Invalidate cache
    clearGuestAccessCache();

    console.log("✅ [GUEST ACCESS] Set guest access:", {
      teamId: teamId.substring(0, 8) + "...",
      token: token.substring(0, 8) + "...",
    });
    return true;
  } catch (error) {
    console.error("❌ [GUEST ACCESS] Error setting access:", error);
    return false;
  }
}

/**
 * Clear guest access from all storage
 */
export function clearGuestAccess() {
  try {
    _memoryToken = null;
    _memoryTeamId = null;
    _memoryPermissions = null;

    sessionStorage.removeItem("guest_team_token");
    sessionStorage.removeItem("guest_team_id");
    sessionStorage.removeItem("guest_team_permissions");
    sessionStorage.removeItem("is_guest_mode");

    clearGuestAccessCache();

    console.log("🧹 [GUEST ACCESS] Cleared guest access");
    return true;
  } catch (error) {
    console.error("❌ [GUEST ACCESS] Error clearing access:", error);
    return false;
  }
}

/**
 * Clear memoization cache (call when access changes)
 */
export function clearGuestAccessCache() {
  cachedAccessData = null;
  lastAccessCheck = 0;
}

/**
 * Check if user has guest access
 * ✅ FIXED: Uses in-memory backup so token survives auth state changes
 */
export function hasGuestAccess() {
  const now = Date.now();

  // Return cached result if fresh
  if (cachedAccessData && now - lastAccessCheck < ACCESS_CACHE_DURATION) {
    return cachedAccessData;
  }

  try {
    // Try sessionStorage first
    let token = sessionStorage.getItem("guest_team_token");
    let teamId = sessionStorage.getItem("guest_team_id");
    let permissionsStr = sessionStorage.getItem("guest_team_permissions");

    // ✅ CRITICAL FIX: Fall back to memory if sessionStorage was cleared
    if (!token && _memoryToken) {
      console.log("🔄 [GUEST ACCESS] Restoring from memory cache (sessionStorage was cleared)");
      token = _memoryToken;
      teamId = _memoryTeamId;
      permissionsStr = _memoryPermissions ? JSON.stringify(_memoryPermissions) : null;

      // Restore sessionStorage
      try {
        sessionStorage.setItem("guest_team_token", token);
        sessionStorage.setItem("guest_team_id", teamId);
        sessionStorage.setItem("guest_team_permissions", permissionsStr);
        sessionStorage.setItem("is_guest_mode", "true");
        console.log("✅ [GUEST ACCESS] Restored sessionStorage from memory");
      } catch (e) {
        // Can't restore, memory will serve as fallback
      }
    }

    // Only log on cache miss
    console.log("🔍 [GUEST ACCESS] Checking access:", {
      hasToken: !!token,
      hasTeamId: !!teamId,
      hasPermissions: !!permissionsStr,
    });

    const result = {
      hasAccess: !!(token && teamId && permissionsStr),
      teamId: teamId || null,
      permissions: permissionsStr ? JSON.parse(permissionsStr) : null,
      token: token || null,
    };

    cachedAccessData = result;
    lastAccessCheck = now;

    return result;
  } catch (error) {
    console.error("❌ [GUEST ACCESS] Error:", error);
    const errorResult = { hasAccess: false, teamId: null, permissions: null, token: null };
    cachedAccessData = errorResult;
    lastAccessCheck = now;
    return errorResult;
  }
}

/**
 * Get guest token — with memory fallback
 */
export function getGuestToken() {
  try {
    const stored = sessionStorage.getItem("guest_team_token");
    if (stored) {
      _memoryToken = stored; // Keep memory in sync
      console.log("🔑 [GUEST TOKEN] Retrieved token:", stored.substring(0, 8) + "...");
      return stored;
    }
  } catch (e) {
    // sessionStorage unavailable
  }

  if (_memoryToken) {
    console.log("🔑 [GUEST TOKEN] Retrieved token from memory cache");
    // Attempt restore
    try {
      sessionStorage.setItem("guest_team_token", _memoryToken);
      if (_memoryTeamId) sessionStorage.setItem("guest_team_id", _memoryTeamId);
      if (_memoryPermissions) sessionStorage.setItem("guest_team_permissions", JSON.stringify(_memoryPermissions));
      sessionStorage.setItem("is_guest_mode", "true");
    } catch (e) { /* ignore */ }
    return _memoryToken;
  }

  console.warn("⚠️ [GUEST TOKEN] No token found, cannot generate guest user ID");
  return null;
}

/**
 * Get stable guest user ID
 */
export function getGuestUserId() {
  const token = getGuestToken();
  if (!token) return null;
  const userId = `guest_${token}`;
  console.log("🔑 [GUEST TOKEN] Generated guest user ID:", userId.substring(0, 16) + "...");
  return userId;
}

/**
 * Debug info for guest token
 */
export function getGuestTokenDebug() {
  const token = getGuestToken();
  const guestUserId = token ? `guest_${token}` : null;
  const isValid = !!(token && token.length > 0);

  console.log("🔍 [GUEST TOKEN DEBUG]");
  console.log("Has Token:", !!token);
  console.log("Token:", token ? token.substring(0, 8) + "..." : null);
  console.log("Guest User ID:", guestUserId ? guestUserId.substring(0, 16) + "..." : null);
  console.log("Token Valid:", isValid);
  console.log("Token Length:", token?.length || 0);

  return { hasToken: !!token, token, guestUserId, isValid, tokenLength: token?.length || 0 };
}

/**
 * Check specific guest permission
 */
export function canGuestPerform(action) {
  const { hasAccess, permissions } = hasGuestAccess();
  if (!hasAccess || !permissions) return false;

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

// ============================================================
// FIRESTORE OPERATIONS
// ============================================================

export async function generateGuestAccessLink({
  teamId, teamName, createdBy, creatorName, expiresInDays = 30,
}) {
  try {
    if (!teamId || !teamName || !createdBy) throw new Error("Missing required fields");

    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    );

    const guestAccessRef = await addDoc(collection(db, "guest-team-access"), {
      teamId, teamName, createdBy,
      creatorName: creatorName || null,
      createdAt: serverTimestamp(),
      expiresAt,
      status: "active",
      accessCount: 0,
      lastAccessed: null,
      permissions: {
        canView: true, canCopy: true, canComment: true, canRate: true,
        canCreate: false, canEdit: false, canDelete: false,
        canInvite: false, canManageMembers: false,
      },
    });

    const accessToken = guestAccessRef.id;
    const accessLink = `${window.location.origin}/guest-team?token=${accessToken}`;
    console.log("✅ Guest access link generated:", accessLink);

    return { success: true, accessToken, accessLink, expiresAt: expiresAt.toDate() };
  } catch (error) {
    console.error("❌ Error generating guest access link:", error);
    return { success: false, error: error.message };
  }
}

export async function validateGuestAccessToken(token) {
  try {
    if (!token) return { valid: false, error: "No access token provided" };

    const guestAccessRef = doc(db, "guest-team-access", token);
    const guestAccessDoc = await getDoc(guestAccessRef);

    if (!guestAccessDoc.exists()) return { valid: false, error: "Invalid or expired access link" };

    const accessData = guestAccessDoc.data();
    if (accessData.status !== "active") return { valid: false, error: "This access link has been deactivated" };

    const now = Timestamp.now();
    if (accessData.expiresAt && accessData.expiresAt.toMillis() < now.toMillis()) {
      return { valid: false, error: "This access link has expired", expired: true };
    }

    await updateDoc(guestAccessRef, { accessCount: increment(1), lastAccessed: serverTimestamp() });

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
    return { valid: false, error: error.message };
  }
}

export async function getTeamGuestAccessLinks(teamId) {
  try {
    const q = query(
      collection(db, "guest-team-access"),
      where("teamId", "==", teamId),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);
    const now = new Date();
    const links = snapshot.docs
      .map((doc) => ({
        id: doc.id, ...doc.data(),
        expiresAt: doc.data().expiresAt?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        lastAccessed: doc.data().lastAccessed?.toDate(),
      }))
      .filter((link) => !link.expiresAt || link.expiresAt > now);
    return { success: true, links };
  } catch (error) {
    console.error("❌ Error fetching guest access links:", error);
    return { success: false, error: error.message, links: [] };
  }
}

export async function revokeGuestAccessLink(linkId) {
  try {
    await updateDoc(doc(db, "guest-team-access", linkId), {
      status: "revoked", revokedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Error revoking guest access link:", error);
    return { success: false, error: error.message };
  }
}

export async function getGuestAccessStats(teamId) {
  try {
    const q = query(collection(db, "guest-team-access"), where("teamId", "==", teamId));
    const snapshot = await getDocs(q);
    const stats = { totalLinks: 0, activeLinks: 0, revokedLinks: 0, expiredLinks: 0, totalAccesses: 0, lastAccessed: null };
    const now = new Date();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      stats.totalLinks++;
      if (data.status === "active") {
        const expiresAt = data.expiresAt?.toDate();
        (!expiresAt || expiresAt > now) ? stats.activeLinks++ : stats.expiredLinks++;
      } else if (data.status === "revoked") {
        stats.revokedLinks++;
      }
      stats.totalAccesses += data.accessCount || 0;
      const lastAccessed = data.lastAccessed?.toDate();
      if (lastAccessed && (!stats.lastAccessed || lastAccessed > stats.lastAccessed)) {
        stats.lastAccessed = lastAccessed;
      }
    });

    return { success: true, stats };
  } catch (error) {
    console.error("❌ Error getting guest access stats:", error);
    return { success: false, error: error.message };
  }
}
