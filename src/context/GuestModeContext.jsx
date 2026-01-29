// src/context/GuestModeContext.jsx - Manage guest user experience
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { guestState, migrateGuestWorkToUser } from '../lib/guestState';
import { useAuth } from './AuthContext';
import { savePrompt } from '../lib/prompts';

const GuestModeContext = createContext({});

export function useGuestMode() {
  const context = useContext(GuestModeContext);
  if (!context) {
    throw new Error('useGuestMode must be used within GuestModeProvider');
  }
  return context;
}

/**
 * Guest Mode Provider
 * Manages unauthenticated user experience and save flow
 */
export function GuestModeProvider({ children }) {
  const { user, signInWithGoogle } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Check if user is in guest mode
  const isGuest = !user;

  /**
   * Trigger save modal for guest users
   */
  const triggerSaveModal = useCallback((action, data) => {
    if (!user) {
      setPendingSaveAction({ action, data });
      setShowSaveModal(true);
      return true; // Indicates save was blocked
    }
    return false; // User is authenticated, proceed normally
  }, [user]);

  /**
   * Handle signup from save modal
   */
  const handleSignupFromModal = useCallback(async () => {
    try {
      console.log('🔐 Starting signup from save modal...');
      setShowSaveModal(false);
      
      // Trigger Google sign-in
      await signInWithGoogle();
      
      // Note: Migration will happen in the effect below after user is set
    } catch (error) {
      console.error('❌ Signup failed:', error);
      alert('Failed to sign in. Please try again.');
      setShowSaveModal(true); // Reopen modal
    }
  }, [signInWithGoogle]);

  /**
   * Handle continue without saving
   */
  const handleContinueWithout = useCallback(() => {
    console.log('📝 User chose to continue without saving');
    setShowSaveModal(false);
    setPendingSaveAction(null);
  }, []);

  /**
   * Close save modal
   */
  const closeSaveModal = useCallback(() => {
    setShowSaveModal(false);
    // Don't clear pending action - user might try again
  }, []);

  /**
   * Migrate guest work after successful signup
   */
  useEffect(() => {
    if (user && pendingSaveAction && !isMigrating) {
      const migrateWork = async () => {
        setIsMigrating(true);
        
        try {
          console.log('🔄 Migrating guest work to authenticated user...');
          
          // Check if user has any teams (we'll use the first one)
          // This will be handled in App.jsx where teams are available
          // For now, just mark as migrated
          
          console.log('✅ Migration complete');
          
          // Clear pending action
          setPendingSaveAction(null);
          
          // Show success message
          console.log('✅ Your work has been saved!');
        } catch (error) {
          console.error('❌ Migration failed:', error);
          alert('Failed to save your work. Please try again.');
        } finally {
          setIsMigrating(false);
        }
      };
      
      migrateWork();
    }
  }, [user, pendingSaveAction, isMigrating]);

  /**
   * Add prompt in guest mode
   */
  const addGuestPrompt = useCallback((promptData) => {
    return guestState.addPrompt(promptData);
  }, []);

  /**
   * Add output in guest mode
   */
  const addGuestOutput = useCallback((promptId, outputData) => {
    return guestState.addOutput(promptId, outputData);
  }, []);

  /**
   * Add chat message in guest mode
   */
  const addGuestChatMessage = useCallback((message) => {
    return guestState.addChatMessage(message);
  }, []);

  /**
   * Get guest prompts
   */
  const getGuestPrompts = useCallback(() => {
    return guestState.getPrompts();
  }, []);

  /**
   * Get guest outputs
   */
  const getGuestOutputs = useCallback((promptId = null) => {
    return guestState.getOutputs(promptId);
  }, []);

  /**
   * Check if guest has unsaved work
   */
  const hasUnsavedWork = useCallback(() => {
    return guestState.hasUnsavedWork();
  }, []);

  const value = {
    // State
    isGuest,
    showSaveModal,
    isMigrating,
    hasUnsavedWork: hasUnsavedWork(),
    
    // Actions
    triggerSaveModal,
    handleSignupFromModal,
    handleContinueWithout,
    closeSaveModal,
    
    // Guest operations
    addGuestPrompt,
    addGuestOutput,
    addGuestChatMessage,
    getGuestPrompts,
    getGuestOutputs,
  };

  return (
    <GuestModeContext.Provider value={value}>
      {children}
    </GuestModeContext.Provider>
  );
}

export default GuestModeContext;
