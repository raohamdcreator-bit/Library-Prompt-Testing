// src/context/GuestModeContext.jsx - FIXED: Proper callback handling for save operations
import React, { createContext, useContext, useState, useEffect } from 'react';
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
   * ✅ FIXED: Trigger save modal with callback support
   * @param {Object} prompt - The prompt being saved
   * @param {Function} onSaveCallback - Callback to execute after successful signup
   * @returns {boolean} - True if save can proceed immediately, false if modal triggered
   */
  function triggerSaveModal(prompt, onSaveCallback) {
    // ✅ CRITICAL CHECK: Never trigger signup for demo prompts
    if (isDemoPrompt(prompt)) {
      console.log('🚫 Save blocked: Cannot save demo prompts (must duplicate first)');
      return false;
    }

    // ✅ If authenticated, allow save immediately
    if (!isGuest) {
      if (onSaveCallback) {
        onSaveCallback();
      }
      return true;
    }

    // ✅ Guest trying to save user-created prompt → Trigger signup
    if (isGuest && !prompt.isDemo) {
      console.log('💾 Guest save attempt: Triggering signup modal');
      
      // Store the callback to execute after signup
      setPendingSaveCallback(() => onSaveCallback);
      setShowSaveModal(true);
      
      // Track analytics
      if (window.gtag) {
        window.gtag('event', 'save_attempt_user_prompt_guest', {
          prompt_title: prompt.title,
          prompt_id: prompt.id,
        });
      }
      
      return false; // Modal triggered, don't proceed with save
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
        // Give Firebase time to initialize user
        setTimeout(() => {
          if (typeof pendingSaveCallback === 'function') {
            pendingSaveCallback();
          }
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
