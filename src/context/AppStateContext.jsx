// src/context/AppStateContext.jsx - Secure State Management with Guest Mode Support
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { hasGuestAccess } from "../lib/guestTeamAccess";

const AppStateContext = createContext({});

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}

// ─── Guest session keys that must never be wiped ──────────────────────────────
const GUEST_KEYS = [
  "guest_team_token",
  "guest_team_id",
  "guest_team_permissions",
  "is_guest_mode",
  "pending_guest_restore",
];

function removeNonGuestSessionData() {
  // Remove only app_state; leave guest keys untouched
  sessionStorage.removeItem("app_state");
}

export function AppStateProvider({ children }) {
  const { user } = useAuth();
  const [activeTeam, setActiveTeam] = useState(null);
  const [preferences, setPreferences] = useState({
    theme: "dark",
    itemsPerPage: 10,
    sortOrder: "newest",
    notifications: true,
  });
  const [loading, setLoading] = useState(true);

  const saveTimerRef = useRef(null);
  const initialLoadRef = useRef(true);

  const guestAccess = hasGuestAccess();
  const isGuestMode = guestAccess.hasAccess;

  useEffect(() => {
    loadStateFromSession();
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      if (user || isGuestMode) {
        saveStateToSession();
      } else {
        clearState();
      }
    }, 100);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [user, activeTeam, preferences, isGuestMode]);

  function loadStateFromSession() {
    try {
      const savedState = sessionStorage.getItem("app_state");
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.activeTeam) setActiveTeam(parsed.activeTeam);
        if (parsed.preferences) setPreferences((prev) => ({ ...prev, ...parsed.preferences }));
      }
    } catch (error) {
      console.error("Error loading state from session:", error);
      sessionStorage.removeItem("app_state");
    } finally {
      setLoading(false);
    }
  }

  function saveStateToSession() {
    try {
      sessionStorage.setItem(
        "app_state",
        JSON.stringify({ activeTeam, preferences, timestamp: Date.now() })
      );
    } catch (error) {
      console.error("Error saving state to session:", error);
      if (error.name === "QuotaExceededError") {
        console.warn("Session storage quota exceeded");
        // Only remove app_state, not guest keys
        removeNonGuestSessionData();
      }
    }
  }

  /**
   * Clear app state on logout.
   * Only removes "app_state" — guest session keys are never touched here.
   * AuthContext.clearSessionStorageSafely() handles the full clear safely.
   */
  const clearState = useCallback(() => {
    setActiveTeam(null);
    setPreferences({
      theme: "dark",
      itemsPerPage: 10,
      sortOrder: "newest",
      notifications: true,
    });
    removeNonGuestSessionData();
  }, []);

  const updateActiveTeam = useCallback((teamId) => {
    if (teamId === null) {
      setActiveTeam(null);
      return true;
    }
    if (!teamId || typeof teamId !== "string") {
      console.warn("Invalid team ID:", teamId);
      return false;
    }
    console.log("📝 [CONTEXT] Updating active team:", teamId);
    setActiveTeam(teamId);
    return true;
  }, []);

  const updatePreferences = useCallback((newPreferences) => {
    setPreferences((prev) => ({ ...prev, ...newPreferences }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences({
      theme: "dark",
      itemsPerPage: 10,
      sortOrder: "newest",
      notifications: true,
    });
  }, []);

  const value = {
    activeTeam,
    preferences,
    loading,
    updateActiveTeam,
    updatePreferences,
    resetPreferences,
    clearState,
    hasActiveTeam: !!activeTeam,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useActiveTeam() {
  const { activeTeam, updateActiveTeam, hasActiveTeam } = useAppState();
  return { activeTeam, setActiveTeam: updateActiveTeam, hasActiveTeam };
}

export function usePreferences() {
  const { preferences, updatePreferences, resetPreferences } = useAppState();
  return { preferences, updatePreferences, resetPreferences };
}

// ─── SecureStorage, MemoryStorage, SmartStorage — unchanged ──────────────────

export const SecureStorage = {
  isAvailable() { return typeof indexedDB !== "undefined"; },

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("PromptTeamsDB", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("userSettings")) {
          db.createObjectStore("userSettings", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("tempData")) {
          db.createObjectStore("tempData", { keyPath: "id" });
        }
      };
    });
  },

  async setItem(key, value, storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.put({ id: key, value, timestamp: Date.now() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("SecureStorage.setItem error:", e); return false; }
  },

  async getItem(key, storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const tx = db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("SecureStorage.getItem error:", e); return null; }
  },

  async removeItem(key, storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("SecureStorage.removeItem error:", e); return false; }
  },

  async clear(storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const tx = db.transaction([storeName], "readwrite");
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("SecureStorage.clear error:", e); return false; }
  },

  async clearAll() {
    await this.clear("userSettings");
    await this.clear("tempData");
  },
};

export class MemoryStorage {
  constructor() { this.storage = new Map(); }
  setItem(key, value) { this.storage.set(key, { value, timestamp: Date.now() }); }
  getItem(key) { const item = this.storage.get(key); return item ? item.value : null; }
  removeItem(key) { this.storage.delete(key); }
  clear() { this.storage.clear(); }
  has(key) { return this.storage.has(key); }
  keys() { return Array.from(this.storage.keys()); }
  size() { return this.storage.size; }
  cleanup(maxAge = 3600000) {
    const now = Date.now();
    for (const [key, item] of this.storage.entries()) {
      if (now - item.timestamp > maxAge) this.storage.delete(key);
    }
  }
}

export const memoryStorage = new MemoryStorage();

export const SmartStorage = {
  async set(key, value, options = {}) {
    const { sensitive = false, persistent = false, temporary = false } = options;
    try {
      if (temporary) { memoryStorage.setItem(key, value); return true; }
      if (sensitive) return await SecureStorage.setItem(key, value);
      if (persistent) { sessionStorage.setItem(key, JSON.stringify(value)); return true; }
      memoryStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error("SmartStorage.set error:", e);
      memoryStorage.setItem(key, value);
      return false;
    }
  },

  async get(key, options = {}) {
    const { sensitive = false, persistent = false, temporary = false } = options;
    try {
      if (temporary) return memoryStorage.getItem(key);
      if (sensitive) return await SecureStorage.getItem(key);
      if (persistent) { const item = sessionStorage.getItem(key); return item ? JSON.parse(item) : null; }
      return memoryStorage.getItem(key);
    } catch (e) { console.error("SmartStorage.get error:", e); return null; }
  },

  async remove(key, options = {}) {
    const { sensitive = false, persistent = false, temporary = false } = options;
    try {
      if (temporary) { memoryStorage.removeItem(key); return true; }
      if (sensitive) return await SecureStorage.removeItem(key);
      if (persistent) { sessionStorage.removeItem(key); return true; }
      memoryStorage.removeItem(key);
      return true;
    } catch (e) { console.error("SmartStorage.remove error:", e); return false; }
  },

  async clearAll() {
    try {
      memoryStorage.clear();
      sessionStorage.clear();
      await SecureStorage.clearAll();
      return true;
    } catch (e) { console.error("SmartStorage.clearAll error:", e); return false; }
  },
};

export default AppStateContext;
