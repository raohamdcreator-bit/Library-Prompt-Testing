// src/context/AppStateContext.jsx - Secure State Management
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";

const AppStateContext = createContext({});

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}

/**
 * Secure state management provider
 * Replaces localStorage with sessionStorage and encrypted persistence
 */
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

  // Use ref to track if we should save (prevents save loops)
  const saveTimerRef = useRef(null);
  const initialLoadRef = useRef(true);

  // Load state on mount (from sessionStorage only)
  useEffect(() => {
    loadStateFromSession();
  }, []);

  // Save state when it changes (debounced to prevent loops)
  useEffect(() => {
    // Skip saving during initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce saves to prevent rapid updates
    saveTimerRef.current = setTimeout(() => {
      if (user) {
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
  }, [user, activeTeam, preferences]);

  /**
   * Load state from sessionStorage (more secure than localStorage)
   * Session data is cleared when browser/tab closes
   */
  function loadStateFromSession() {
    try {
      const savedState = sessionStorage.getItem("app_state");
      if (savedState) {
        const parsed = JSON.parse(savedState);

        // Validate and restore state
        if (parsed.activeTeam) {
          setActiveTeam(parsed.activeTeam);
        }

        if (parsed.preferences) {
          setPreferences((prev) => ({ ...prev, ...parsed.preferences }));
        }
      }
    } catch (error) {
      console.error("Error loading state from session:", error);
      // Clear corrupted data
      sessionStorage.removeItem("app_state");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Save state to sessionStorage
   * Only non-sensitive UI preferences are stored
   */
  function saveStateToSession() {
    try {
      const stateToSave = {
        activeTeam,
        preferences,
        timestamp: Date.now(),
      };

      sessionStorage.setItem("app_state", JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Error saving state to session:", error);
      // Handle quota exceeded errors gracefully
      if (error.name === "QuotaExceededError") {
        console.warn("Session storage quota exceeded, clearing old data");
        sessionStorage.clear();
      }
    }
  }

  /**
   * Clear all state (on logout)
   */
  const clearState = useCallback(() => {
    setActiveTeam(null);
    setPreferences({
      theme: "dark",
      itemsPerPage: 10,
      sortOrder: "newest",
      notifications: true,
    });

    // Clear session storage
    try {
      sessionStorage.removeItem("app_state");
    } catch (error) {
      console.error("Error clearing state:", error);
    }
  }, []);

  /**
   * Update active team (with validation)
   */
  const updateActiveTeam = useCallback((teamId) => {
    // Allow null to clear active team
    if (teamId === null) {
      setActiveTeam(null);
      return true;
    }

    // Validate non-null teamId
    if (!teamId || typeof teamId !== "string") {
      console.warn("Invalid team ID:", teamId);
      return false;
    }

    setActiveTeam(teamId);
    return true;
  }, []);

  /**
   * Update user preferences
   */
  const updatePreferences = useCallback((newPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      ...newPreferences,
    }));
  }, []);

  /**
   * Reset to default preferences
   */
  const resetPreferences = useCallback(() => {
    setPreferences({
      theme: "dark",
      itemsPerPage: 10,
      sortOrder: "newest",
      notifications: true,
    });
  }, []);

  const value = {
    // State
    activeTeam,
    preferences,
    loading,

    // Actions
    updateActiveTeam,
    updatePreferences,
    resetPreferences,
    clearState,

    // Helpers
    hasActiveTeam: !!activeTeam,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Hook for active team management
 */
export function useActiveTeam() {
  const { activeTeam, updateActiveTeam, hasActiveTeam } = useAppState();
  return { activeTeam, setActiveTeam: updateActiveTeam, hasActiveTeam };
}

/**
 * Hook for user preferences
 */
export function usePreferences() {
  const { preferences, updatePreferences, resetPreferences } = useAppState();
  return { preferences, updatePreferences, resetPreferences };
}

/**
 * Secure storage utility (for IndexedDB - more secure for sensitive data)
 */
export const SecureStorage = {
  /**
   * Check if IndexedDB is available
   */
  isAvailable() {
    return typeof indexedDB !== "undefined";
  },

  /**
   * Open IndexedDB connection
   */
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("PromptTeamsDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains("userSettings")) {
          db.createObjectStore("userSettings", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("tempData")) {
          db.createObjectStore("tempData", { keyPath: "id" });
        }
      };
    });
  },

  /**
   * Store data securely in IndexedDB
   */
  async setItem(key, value, storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      const data = {
        id: key,
        value: value,
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("SecureStorage.setItem error:", error);
      return false;
    }
  },

  /**
   * Retrieve data from IndexedDB
   */
  async getItem(key, storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("SecureStorage.getItem error:", error);
      return null;
    }
  },

  /**
   * Remove data from IndexedDB
   */
  async removeItem(key, storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("SecureStorage.removeItem error:", error);
      return false;
    }
  },

  /**
   * Clear all data from a store
   */
  async clear(storeName = "userSettings") {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("SecureStorage.clear error:", error);
      return false;
    }
  },

  /**
   * Clear all stores on logout
   */
  async clearAll() {
    await this.clear("userSettings");
    await this.clear("tempData");
  },
};

/**
 * Memory-only storage (most secure - cleared on page refresh)
 */
export class MemoryStorage {
  constructor() {
    this.storage = new Map();
  }

  setItem(key, value) {
    this.storage.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  getItem(key) {
    const item = this.storage.get(key);
    return item ? item.value : null;
  }

  removeItem(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }

  has(key) {
    return this.storage.has(key);
  }

  keys() {
    return Array.from(this.storage.keys());
  }

  size() {
    return this.storage.size;
  }

  // Auto-cleanup old entries (optional)
  cleanup(maxAge = 3600000) {
    // 1 hour default
    const now = Date.now();
    for (const [key, item] of this.storage.entries()) {
      if (now - item.timestamp > maxAge) {
        this.storage.delete(key);
      }
    }
  }
}

// Export singleton instance for memory storage
export const memoryStorage = new MemoryStorage();

/**
 * Storage utility that automatically chooses the best storage method
 */
export const SmartStorage = {
  /**
   * Store data using the most appropriate method
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {object} options - Storage options
   */
  async set(key, value, options = {}) {
    const {
      sensitive = false, // Use IndexedDB for sensitive data
      persistent = false, // Use sessionStorage for session data
      temporary = false, // Use memory storage for temporary data
    } = options;

    try {
      if (temporary) {
        // Memory storage - most secure, cleared on refresh
        memoryStorage.setItem(key, value);
        return true;
      }

      if (sensitive) {
        // IndexedDB - secure and persistent
        return await SecureStorage.setItem(key, value);
      }

      if (persistent) {
        // SessionStorage - cleared on browser/tab close
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
      }

      // Default: memory storage
      memoryStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error("SmartStorage.set error:", error);
      // Fallback to memory storage
      memoryStorage.setItem(key, value);
      return false;
    }
  },

  /**
   * Retrieve data from storage
   */
  async get(key, options = {}) {
    const {
      sensitive = false,
      persistent = false,
      temporary = false,
    } = options;

    try {
      if (temporary) {
        return memoryStorage.getItem(key);
      }

      if (sensitive) {
        return await SecureStorage.getItem(key);
      }

      if (persistent) {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }

      return memoryStorage.getItem(key);
    } catch (error) {
      console.error("SmartStorage.get error:", error);
      return null;
    }
  },

  /**
   * Remove data from storage
   */
  async remove(key, options = {}) {
    const {
      sensitive = false,
      persistent = false,
      temporary = false,
    } = options;

    try {
      if (temporary) {
        memoryStorage.removeItem(key);
        return true;
      }

      if (sensitive) {
        return await SecureStorage.removeItem(key);
      }

      if (persistent) {
        sessionStorage.removeItem(key);
        return true;
      }

      memoryStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error("SmartStorage.remove error:", error);
      return false;
    }
  },

  /**
   * Clear all storage
   */
  async clearAll() {
    try {
      memoryStorage.clear();
      sessionStorage.clear();
      await SecureStorage.clearAll();
      return true;
    } catch (error) {
      console.error("SmartStorage.clearAll error:", error);
      return false;
    }
  },
};

export default AppStateContext;
