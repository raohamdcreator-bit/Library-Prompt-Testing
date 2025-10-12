// src/context/AuthContext.jsx - FIXED VERSION
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
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("🔥 AuthProvider: Setting up auth state listener");
    
    // Set persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        console.log("🔥 Auth state changed:", user ? user.email : "null");
        
        try {
          if (user) {
            // User is signed in - update their profile
            await setDoc(
              doc(db, "users", user.uid),
              {
                name: user.displayName,
                email: user.email,
                avatar: user.photoURL,
                lastSeen: serverTimestamp(),
              },
              { merge: true }
            );
            console.log("✅ User profile updated");
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
      provider.setCustomParameters({
        prompt: "select_account",
      });

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
      
      // Force clear user state even if signOut fails
      setUser(null);
      throw error;
    }
  };

  // ✅ ADD LOGOUT ALIAS - This is what App.jsx is calling!
  const logout = signOut;

  const value = {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    logout, // ✅ Export both names for compatibility
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
