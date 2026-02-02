// src/context/GuestModeContext.jsx - FIXED: Proper callback handling for save operations
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { isDemoPrompt } from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';

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
  const checkSaveRequired = useCallback((action, onProceed, context = {}) => {
  // ✅ Authenticated users always proceed
  if (!isGuest) {
    if (onProceed) onProceed();
    return true;
  }

  // ✅ Get current work state
  const work = guestState.getWorkSummary();

  // ✅ NEVER BLOCK: Demo interactions
  const nonBlockingActions = [
    'view_demo',
    'copy_demo', 
    'duplicate_demo', // "Make My Own" button
    'edit_guest_prompt', // Editing already-created prompts
    'delete_guest_prompt',
  ];

  if (nonBlockingActions.includes(action)) {
    if (onProceed) onProceed();
    return true;
  }

  // ✅ TRIGGER MODAL: After 3rd prompt creation
  if (action === 'create_prompt' && work.promptCount >= 3) {
    console.log('💾 Save trigger: 3+ prompts created');
    setPendingSaveCallback(() => onProceed);
    setModalContext({
      trigger: 'prompt_limit',
      promptCount: work.promptCount,
      message: `You've created ${work.promptCount} prompts`,
    });
    setShowSaveModal(true);
    
    // Track analytics
    if (window.gtag) {
      window.gtag('event', 'save_modal_shown', {
        trigger: 'prompt_limit',
        prompt_count: work.promptCount,
      });
    }
    
    return false;
  }

  // ✅ TRIGGER MODAL: First enhancement
  if (action === 'enhance_prompt' && work.enhancementCount === 0) {
    console.log('💾 Save trigger: First enhancement');
    setPendingSaveCallback(() => onProceed);
    setModalContext({
      trigger: 'first_enhancement',
      promptCount: work.promptCount,
      message: 'Save your enhanced prompts',
    });
    setShowSaveModal(true);
    
    if (window.gtag) {
      window.gtag('event', 'save_modal_shown', {
        trigger: 'first_enhancement',
        prompt_count: work.promptCount,
      });
    }
    
    return false;
  }

  // ✅ TRIGGER MODAL: Before export
  if (action === 'export_prompts') {
    console.log('💾 Save trigger: Export attempt');
    setPendingSaveCallback(() => onProceed);
    setModalContext({
      trigger: 'export_attempt',
      promptCount: work.promptCount,
      message: 'Save before exporting',
    });
    setShowSaveModal(true);
    
    if (window.gtag) {
      window.gtag('event', 'save_modal_shown', {
        trigger: 'export_attempt',
        prompt_count: work.promptCount,
      });
    }
    
    return false;
  }

  // ✅ DEFAULT: Allow action
  if (onProceed) onProceed();
  return true;
}, [isGuest]);

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
 * Get work summary for display
 */
const getWorkSummary = useCallback(() => {
  return guestState.getWorkSummary();
}, []);

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
  modalContext, // ✅ NEW: Context for modal messaging
  
  // ✅ NEW: Strategic API
  checkSaveRequired,
  getWorkSummary,
  
  // Modal controls
  handleSignupFromModal,
  handleContinueWithout,
  closeSaveModal,
  
  // Permissions
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
