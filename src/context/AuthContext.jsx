// src/context/AuthContext.jsx - Complete with GA4 Tracking
import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Guest session keys that must NEVER be wiped by the auth listener ────────
const GUEST_KEYS = [
  "guest_team_token",
  "guest_team_id",
  "guest_team_permissions",
  "is_guest_mode",
  "pending_guest_restore",
];

/**
 * Clear sessionStorage safely — preserves any active guest session data.
 * Called instead of sessionStorage.clear() in the auth listener.
 */
function clearSessionStorageSafely() {
  // Snapshot guest data before clearing
  const saved = {};
  GUEST_KEYS.forEach((key) => {
    const val = sessionStorage.getItem(key);
    if (val) saved[key] = val;
  });

  // Clear everything
  sessionStorage.clear();

  // Restore guest data if it was present
  Object.entries(saved).forEach(([key, val]) => {
    sessionStorage.setItem(key, val);
  });

  const hadGuestData = Object.keys(saved).length > 0;
  if (hadGuestData) {
    console.log("🛡️ [AUTH] sessionStorage cleared but guest session preserved");
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("🔥 AuthProvider: Setting up auth state listener");

    // Set persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // Track if we've already fired login/signup for this session
    let hasTrackedThisSession = false;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        console.log("🔥 Auth state changed:", user ? user.email : "null");

        try {
          if (user) {
            // Check if user is new or returning
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const isNewUser = !userDocSnap.exists();

            // Check for existing session
            const sessionKey = `auth_session_${user.uid}`;
            const existingSession = sessionStorage.getItem(sessionKey);
            const shouldTrackLogin = !existingSession && !hasTrackedThisSession;

            // User is signed in - update their profile
            await setDoc(
              userDocRef,
              {
                name: user.displayName,
                email: user.email,
                avatar: user.photoURL,
                lastSeen: serverTimestamp(),
                ...(isNewUser && { createdAt: serverTimestamp() }),
              },
              { merge: true }
            );
            console.log("✅ User profile updated");

            // Track new signup
            if (isNewUser && window.gtag) {
              window.gtag("event", "sign_up", {
                method: "Google",
                user_id: user.uid,
              });
              console.log("📊 GA4: sign_up event fired (NEW USER)");
              hasTrackedThisSession = true;
            }

            // Track returning login (once per session)
            if (!isNewUser && shouldTrackLogin && window.gtag) {
              window.gtag("event", "login", {
                method: "Google",
                user_id: user.uid,
              });
              console.log("📊 GA4: login event fired (NEW SESSION)");
              hasTrackedThisSession = true;
              sessionStorage.setItem(sessionKey, Date.now().toString());
            }
          } else {
            // ─── FIX: was sessionStorage.clear() which wiped guest tokens ────
            // Use safe clear that preserves any active guest session data.
            clearSessionStorageSafely();
            hasTrackedThisSession = false;
          }

          setUser(user);
          setError(null);
        } catch (firestoreError) {
          console.error("❌ Error updating user profile:", firestoreError);
          setUser(user);
          setError("Profile update failed");
        }

        setLoading(false);
      },
      (authError) => {
        console.error("❌ Auth state listener error:", authError);
        setError("Authentication service error");
        setLoading(false);
        setUser(null);
      }
    );

    return () => {
      console.log("🔥 Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log("🔐 Starting Google sign-in...");
      setError(null);
      setLoading(true);

      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);

      if (!result.user) {
        throw new Error("No user returned from Google sign-in");
      }

      console.log("✅ Google sign-in successful:", result.user.email);
      return result.user;
    } catch (error) {
      console.error("❌ Google sign-in error:", error);
      setLoading(false);

      let errorMessage = "Failed to sign in with Google";
      switch (error.code) {
        case "auth/popup-blocked":
          errorMessage = "Sign-in popup was blocked. Please allow popups and try again.";
          break;
        case "auth/popup-closed-by-user":
          errorMessage = "Sign-in was cancelled.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your connection.";
          break;
        default:
          errorMessage = error.message || "An unexpected error occurred";
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    try {
      console.log("🚪 Starting sign out...");
      setError(null);
      setLoading(true);

      await firebaseSignOut(auth);

      console.log("✅ Sign out successful");
      setUser(null);
      setLoading(false);
    } catch (error) {
      console.error("❌ Sign out error:", error);
      setLoading(false);
      setError("Failed to sign out");
      setUser(null);
      throw error;
    }
  };

  const logout = signOut;

  const value = {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    logout,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
