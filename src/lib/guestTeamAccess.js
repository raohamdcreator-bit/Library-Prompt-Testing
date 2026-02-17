// src/lib/guestTeamAccess.js
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
// STORAGE KEYS
// ============================================================
const KEY_TOKEN       = "guest_team_token";
const KEY_TEAM_ID     = "guest_team_id";
const KEY_PERMISSIONS = "guest_team_permissions";
const KEY_GUEST_MODE  = "is_guest_mode";
// ↓ Backup key — intentionally NOT cleared by clearGuestAccess() unless forced.
// This survives the Firebase auth listener calling clearGuestAccess() on page load.
const KEY_PENDING     = "pending_guest_restore";

// ============================================================
// IN-MEMORY BACKUP
// Survives React re-renders and auth-state events within the SAME page load.
// Does NOT survive window.location.href navigation (full page reload).
// The KEY_PENDING sessionStorage key covers the cross-page case.
// ============================================================
let _memoryToken       = null;
let _memoryTeamId      = null;
let _memoryPermissions = null;

// Memoization cache to prevent console spam
let cachedAccessData = null;
let lastAccessCheck  = 0;
const ACCESS_CACHE_DURATION = 1000; // 1 second

// ============================================================
// SYNCHRONOUS SELF-RESTORE ON MODULE LOAD
// ============================================================
// This IIFE runs once at import time — synchronously, before Firebase
// initialises and before onAuthStateChanged can fire.
// It checks KEY_PENDING (written by setGuestAccess / GuestTeamView) and
// restores the normal session keys + memory so every subsequent call
// sees a valid token even if the auth listener later calls clearGuestAccess().
(function restoreOnLoad() {
  try {
    // 1. Normal keys already intact? Populate memory and we're done.
    const existingToken  = sessionStorage.getItem(KEY_TOKEN);
    const existingTeamId = sessionStorage.getItem(KEY_TEAM_ID);
    if (existingToken && existingTeamId) {
      _memoryToken       = existingToken;
      _memoryTeamId      = existingTeamId;
      _memoryPermissions = sessionStorage.getItem(KEY_PERMISSIONS);
      console.log("✅ [GUEST ACCESS INIT] Session already present in sessionStorage");
      return;
    }

    // 2. Try the pending_guest_restore backup.
    const pendingRaw = sessionStorage.getItem(KEY_PENDING);
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw);
      if (pending.token && pending.teamId) {
        _memoryToken       = pending.token;
        _memoryTeamId      = pending.teamId;
        _memoryPermissions = typeof pending.permissions === "string"
          ? pending.permissions
          : JSON.stringify(pending.permissions ?? {});

        // Re-write normal keys so everything downstream works
        sessionStorage.setItem(KEY_TOKEN,       _memoryToken);
        sessionStorage.setItem(KEY_TEAM_ID,     _memoryTeamId);
        sessionStorage.setItem(KEY_PERMISSIONS, _memoryPermissions);
        sessionStorage.setItem(KEY_GUEST_MODE,  "true");

        console.log("✅ [GUEST ACCESS INIT] Restored from pending_guest_restore backup");
      }
    }
  } catch (e) {
    // sessionStorage unavailable — silently continue
  }
})();

// ============================================================
// CORE TOKEN MANAGEMENT
// ============================================================

/**
 * Store guest access.
 * Writes to memory, the normal sessionStorage keys, AND the pending backup key.
 */
export function setGuestAccess(teamId, permissions, token) {
  try {
    if (!token || !teamId) {
      console.error("❌ [GUEST ACCESS] setGuestAccess called with missing token or teamId");
      return false;
    }

    const permsStr = typeof permissions === "string"
      ? permissions
      : JSON.stringify(permissions ?? {});

    // Memory first
    _memoryToken       = token;
    _memoryTeamId      = teamId;
    _memoryPermissions = permsStr;

    // Normal session keys
    sessionStorage.setItem(KEY_TOKEN,       token);
    sessionStorage.setItem(KEY_TEAM_ID,     teamId);
    sessionStorage.setItem(KEY_PERMISSIONS, permsStr);
    sessionStorage.setItem(KEY_GUEST_MODE,  "true");

    // Backup key — survives clearGuestAccess() called without force
    sessionStorage.setItem(KEY_PENDING, JSON.stringify({
      token,
      teamId,
      permissions: permsStr,
      ts: Date.now(),
    }));

    clearGuestAccessCache();

    console.log("✅ [GUEST ACCESS] Set guest access:", {
      teamId: teamId.substring(0, 8) + "...",
      token:  token.substring(0, 8)  + "...",
    });
    return true;
  } catch (error) {
    console.error("❌ [GUEST ACCESS] Error setting access:", error);
    return false;
  }
}

/**
 * Clear guest access.
 *
 * @param {boolean} force  Pass true ONLY for explicit user sign-out.
 *                         When false (default), the function is a no-op if a
 *                         valid guest session is active — this prevents Firebase's
 *                         onAuthStateChanged(null) from wiping the guest session.
 */
export function clearGuestAccess(force = false) {
  try {
    // Guard: block clearing unless explicitly forced.
    // The auth listener fires with null user on every page load for guests;
    // without this guard it would wipe sessionStorage before components mount.
    if (!force) {
      const hasToken = !!(_memoryToken || sessionStorage.getItem(KEY_TOKEN));
      if (hasToken) {
        console.log("🛡️ [GUEST ACCESS] clearGuestAccess() blocked — guest session is active (pass force=true to override)");
        return false;
      }
    }

    _memoryToken       = null;
    _memoryTeamId      = null;
    _memoryPermissions = null;

    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_TEAM_ID);
    sessionStorage.removeItem(KEY_PERMISSIONS);
    sessionStorage.removeItem(KEY_GUEST_MODE);

    // Only wipe the backup key on an intentional sign-out
    if (force) {
      sessionStorage.removeItem(KEY_PENDING);
    }

    clearGuestAccessCache();
    console.log("🧹 [GUEST ACCESS] Cleared guest access", force ? "(forced)" : "");
    return true;
  } catch (error) {
    console.error("❌ [GUEST ACCESS] Error clearing access:", error);
    return false;
  }
}

/**
 * Clear memoization cache (call when access changes).
 */
export function clearGuestAccessCache() {
  cachedAccessData = null;
  lastAccessCheck  = 0;
}

/**
 * Check if user has guest access.
 * Falls back: memory → sessionStorage → pending_guest_restore backup.
 */
export function hasGuestAccess() {
  const now = Date.now();

  // Return cached result if still fresh
  if (cachedAccessData && now - lastAccessCheck < ACCESS_CACHE_DURATION) {
    return cachedAccessData;
  }

  try {
    let token      = _memoryToken       ?? sessionStorage.getItem(KEY_TOKEN);
    let teamId     = _memoryTeamId      ?? sessionStorage.getItem(KEY_TEAM_ID);
    let permsStr   = _memoryPermissions ?? sessionStorage.getItem(KEY_PERMISSIONS);

    // If still empty, try the pending backup (handles the case where auth
    // listener ran before this call and wiped the normal keys)
    if (!token) {
      const pendingRaw = sessionStorage.getItem(KEY_PENDING);
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          if (pending.token && pending.teamId) {
            console.log("🔄 [GUEST ACCESS] hasGuestAccess() late-restored from pending backup");
            token    = pending.token;
            teamId   = pending.teamId;
            permsStr = typeof pending.permissions === "string"
              ? pending.permissions
              : JSON.stringify(pending.permissions ?? {});

            // Repopulate memory and normal keys
            _memoryToken       = token;
            _memoryTeamId      = teamId;
            _memoryPermissions = permsStr;
            sessionStorage.setItem(KEY_TOKEN,       token);
            sessionStorage.setItem(KEY_TEAM_ID,     teamId);
            sessionStorage.setItem(KEY_PERMISSIONS, permsStr);
            sessionStorage.setItem(KEY_GUEST_MODE,  "true");
          }
        } catch (_) { /* ignore parse error */ }
      }
    }

    // Sync memory if sessionStorage had a value but memory was stale
    if (token && !_memoryToken) {
      _memoryToken       = token;
      _memoryTeamId      = teamId;
      _memoryPermissions = permsStr;
    }

    console.log("🔍 [GUEST ACCESS] Checking access:", {
      hasToken:       !!token,
      hasTeamId:      !!teamId,
      hasPermissions: !!permsStr,
    });

    const result = {
      hasAccess:   !!(token && teamId && permsStr),
      teamId:      teamId   || null,
      permissions: permsStr ? JSON.parse(permsStr) : null,
      token:       token    || null,
    };

    cachedAccessData = result;
    lastAccessCheck  = now;
    return result;
  } catch (error) {
    console.error("❌ [GUEST ACCESS] Error:", error);
    const errorResult = { hasAccess: false, teamId: null, permissions: null, token: null };
    cachedAccessData = errorResult;
    lastAccessCheck  = now;
    return errorResult;
  }
}

/**
 * Get guest token — memory → sessionStorage → pending backup.
 */
export function getGuestToken() {
  // Memory is fastest
  if (_memoryToken) {
    return _memoryToken;
  }

  try {
    const stored = sessionStorage.getItem(KEY_TOKEN);
    if (stored) {
      _memoryToken = stored; // keep in sync
      return stored;
    }

    // Last resort: pending backup
    const pendingRaw = sessionStorage.getItem(KEY_PENDING);
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw);
      if (pending.token) {
        _memoryToken       = pending.token;
        _memoryTeamId      = pending.teamId;
        _memoryPermissions = typeof pending.permissions === "string"
          ? pending.permissions
          : JSON.stringify(pending.permissions ?? {});

        sessionStorage.setItem(KEY_TOKEN,       _memoryToken);
        sessionStorage.setItem(KEY_TEAM_ID,     _memoryTeamId);
        sessionStorage.setItem(KEY_PERMISSIONS, _memoryPermissions);
        sessionStorage.setItem(KEY_GUEST_MODE,  "true");
        console.log("🔄 [GUEST TOKEN] Restored from pending backup");
        return _memoryToken;
      }
    }
  } catch (e) {
    // sessionStorage unavailable
  }

  console.warn("⚠️ [GUEST TOKEN] No token found, cannot generate guest user ID");
  return null;
}

/**
 * Get stable guest user ID derived from token.
 */
export function getGuestUserId() {
  const token = getGuestToken();
  if (!token) return null;
  const userId = `guest_${token}`;
  console.log("🔑 [GUEST TOKEN] Generated guest user ID:", userId.substring(0, 16) + "...");
  return userId;
}

/**
 * Debug info for guest token.
 */
export function getGuestTokenDebug() {
  const token       = getGuestToken();
  const guestUserId = token ? `guest_${token}` : null;
  const isValid     = !!(token && token.length > 0);

  console.log("🔍 [GUEST TOKEN DEBUG]");
  console.log("Has Token:",      !!token);
  console.log("Token:",          token ? token.substring(0, 8) + "..." : null);
  console.log("Guest User ID:",  guestUserId ? guestUserId.substring(0, 16) + "..." : null);
  console.log("Token Valid:",    isValid);
  console.log("Token Length:",   token?.length || 0);
  console.log("Source:",         _memoryToken ? "memory" : sessionStorage.getItem(KEY_TOKEN) ? "sessionStorage" : "none");

  return {
    hasToken:    !!token,
    token,
    guestUserId,
    isValid,
    tokenLength: token?.length || 0,
    source:      _memoryToken ? "memory" : sessionStorage.getItem(KEY_TOKEN) ? "sessionStorage" : "none",
  };
}

/**
 * Check specific guest permission.
 */
export function canGuestPerform(action) {
  const { hasAccess, permissions } = hasGuestAccess();
  if (!hasAccess || !permissions) return false;

  const permissionMap = {
    view:           permissions.canView,
    copy:           permissions.canCopy,
    comment:        permissions.canComment,
    rate:           permissions.canRate,
    create:         permissions.canCreate,
    edit:           permissions.canEdit,
    delete:         permissions.canDelete,
    invite:         permissions.canInvite,
    manageMembers:  permissions.canManageMembers,
  };

  return permissionMap[action] || false;
}

// ============================================================
// FIRESTORE OPERATIONS (unchanged)
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
    const accessLink  = `${window.location.origin}/guest-team?token=${accessToken}`;
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

    await updateDoc(guestAccessRef, {
      accessCount:  increment(1),
      lastAccessed: serverTimestamp(),
    });

    return {
      valid:       true,
      teamId:      accessData.teamId,
      teamName:    accessData.teamName,
      permissions: accessData.permissions,
      token,
      expiresAt:   accessData.expiresAt?.toDate(),
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
      .map((d) => ({
        id: d.id, ...d.data(),
        expiresAt:    d.data().expiresAt?.toDate(),
        createdAt:    d.data().createdAt?.toDate(),
        lastAccessed: d.data().lastAccessed?.toDate(),
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
      status:    "revoked",
      revokedAt: serverTimestamp(),
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
    const stats = {
      totalLinks: 0, activeLinks: 0, revokedLinks: 0,
      expiredLinks: 0, totalAccesses: 0, lastAccessed: null,
    };
    const now = new Date();

    snapshot.docs.forEach((d) => {
      const data = d.data();
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
