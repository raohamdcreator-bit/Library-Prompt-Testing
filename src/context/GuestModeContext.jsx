// src/context/GuestModeContext.jsx - FIXED: Ownership-based signup gating
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { isDemoPrompt } from '../lib/guestDemoContent';

const GuestModeContext = createContext();

export function GuestModeProvider({ children }) {
  const { user, signInWithGoogle } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState(null);

  // User is guest if not authenticated
  const isGuest = !user;

  /**
   * ✅ FIXED: Ownership-based save gating
   * Trigger signup ONLY for non-demo, guest-owned prompts
   */
  function triggerSaveModal(prompt, onSaveCallback) {
    // ✅ CRITICAL CHECK: Never trigger signup for demo prompts
    if (isDemoPrompt(prompt)) {
      console.log('🚫 Save blocked: Cannot save demo prompts (must duplicate first)');
      return false;
    }

    // ✅ If authenticated, allow save
    if (!isGuest) {
      if (onSaveCallback) {
        onSaveCallback();
      }
      return true;
    }

    // ✅ Guest trying to save user-created prompt → Trigger signup
    if (isGuest && !prompt.isDemo) {
      console.log('💾 Guest save attempt: Triggering signup modal');
      setPendingSaveCallback(() => onSaveCallback);
      setShowSaveModal(true);
      
      // Track analytics
      if (window.gtag) {
        window.gtag('event', 'save_attempt_user_prompt_guest', {
          prompt_title: prompt.title,
          prompt_id: prompt.id,
        });
      }
      
      return false;
    }

    return false;
  }

  /**
   * Handle signup from save modal
   */
  async function handleSignupFromModal() {
    try {
      setIsMigrating(true);
      await signInWithGoogle();
      
      // Execute pending save after successful signup
      if (pendingSaveCallback) {
        setTimeout(() => {
          pendingSaveCallback();
          setPendingSaveCallback(null);
        }, 1000);
      }
      
      setShowSaveModal(false);
      
      // Track conversion
      if (window.gtag) {
        window.gtag('event', 'signup_completed', {
          source: 'save_prompt_modal',
        });
      }
    } catch (error) {
      console.error('Signup failed:', error);
      setIsMigrating(false);
    }
  }

  /**
   * User chose to continue without signing up
   */
  function handleContinueWithout() {
    setShowSaveModal(false);
    setPendingSaveCallback(null);
  }

  /**
   * Close save modal
   */
  function closeSaveModal() {
    setShowSaveModal(false);
    setPendingSaveCallback(null);
  }

  /**
   * Check if a specific prompt can be saved
   */
  function canSavePrompt(prompt) {
    // Demo prompts cannot be saved
    if (isDemoPrompt(prompt)) {
      return false;
    }

    // Authenticated users can save any non-demo prompt
    if (!isGuest) {
      return true;
    }

    // Guests cannot save without signup
    return false;
  }

  /**
   * Check if a prompt can be edited
   */
  function canEditPrompt(prompt) {
    // Demo prompts can be edited by anyone (changes are ephemeral)
    if (isDemoPrompt(prompt)) {
      return true;
    }

    // User prompts require authentication
    if (!isGuest) {
      return true;
    }

    // Guests can edit their own prompts
    if (prompt.owner === 'guest') {
      return true;
    }

    return false;
  }

  /**
   * Check if a prompt can be deleted
   */
  function canDeletePrompt(prompt) {
    // Demo prompts can be deleted (removed from session)
    if (isDemoPrompt(prompt)) {
      return true;
    }

    // User prompts require authentication
    if (!isGuest) {
      return true;
    }

    // Guests can delete their own prompts
    if (prompt.owner === 'guest') {
      return true;
    }

    return false;
  }

  const value = {
    isGuest,
    showSaveModal,
    isMigrating,
    triggerSaveModal,
    handleSignupFromModal,
    handleContinueWithout,
    closeSaveModal,
    canSavePrompt,
    canEditPrompt,
    canDeletePrompt,
  };

  return (
    <GuestModeContext.Provider value={value}>
      {children}
    </GuestModeContext.Provider>
  );
}

export function useGuestMode() {
  const context = useContext(GuestModeContext);
  if (!context) {
    throw new Error('useGuestMode must be used within GuestModeProvider');
  }
  return context;
}
