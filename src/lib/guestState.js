// src/lib/guestState.js - FIXED: Removed duplicate getWorkSummary method
import { createTimestampMock } from './guestDemoContent';

const GUEST_STORAGE_KEY = 'prism_guest_work';
const GUEST_SESSION_KEY = 'prism_guest_session';

/**
 * Guest State Manager
 * Persists user work in localStorage until they sign up
 */
export class GuestStateManager {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Generate unique session ID for guest user
   */
  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem(GUEST_SESSION_KEY);
    
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(GUEST_SESSION_KEY, sessionId);
    }
    
    return sessionId;
  }

  /**
   * Get all guest work from localStorage
   */
  getGuestWork() {
    try {
      const data = localStorage.getItem(GUEST_STORAGE_KEY);
      if (!data) return this.getDefaultState();
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading guest work:', error);
      return this.getDefaultState();
    }
  }

  /**
   * Default empty state structure
   */
  getDefaultState() {
    return {
      prompts: [],
      outputs: [],
      chatMessages: [],
      enhancementCount: 0, // ✅ Track enhancements
      lastModified: null,
      sessionId: this.sessionId,
    };
  }
  
  /**
   * ✅ HELPER: Reconstruct timestamp mock from stored data
   */
  reconstructTimestamp(timestamp) {
    if (!timestamp) return undefined;
    
    // Already a timestamp mock (has methods)
    if (timestamp.toMillis && typeof timestamp.toMillis === 'function') {
      return timestamp;
    }
    
    // Stored as object with seconds/nanoseconds
    if (timestamp.seconds !== undefined) {
      return createTimestampMock(new Date(timestamp.seconds * 1000));
    }
    
    // Stored as ISO string
    if (typeof timestamp === 'string') {
      return createTimestampMock(new Date(timestamp));
    }
    
    // Fallback
    return createTimestampMock(new Date());
  }

  /**
   * Save guest work to localStorage
   */
  saveGuestWork(data) {
    try {
      const currentWork = this.getGuestWork();
      const updatedWork = {
        ...currentWork,
        ...data,
        lastModified: new Date().toISOString(),
        sessionId: this.sessionId,
      };
      
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updatedWork));
      return { success: true };
    } catch (error) {
      console.error('Error saving guest work:', error);
      
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        this.cleanupOldWork();
        // Retry save
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
          return { success: true };
        } catch (retryError) {
          return { success: false, error: 'Storage quota exceeded' };
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Add a prompt to guest work
   */
  addPrompt(prompt) {
    const work = this.getGuestWork();
    const newPrompt = {
      id: `user_${Date.now()}`,
      ...prompt,
      createdAt: new Date().toISOString(),
      owner: 'guest',
      isGuest: true,
    };
    
    work.prompts.push(newPrompt);
    this.saveGuestWork(work);
    
    return newPrompt;
  }

  /**
   * Update a guest prompt
   */
  updatePrompt(promptId, updates, isEnhancement = false) {
    const work = this.getGuestWork();
    const promptIndex = work.prompts.findIndex(p => p.id === promptId);
    
    if (promptIndex === -1) {
      return { success: false, error: 'Prompt not found' };
    }
    
    work.prompts[promptIndex] = {
      ...work.prompts[promptIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // ✅ Track enhancements for save trigger
    if (isEnhancement) {
      work.enhancementCount = (work.enhancementCount || 0) + 1;
    }
    
    this.saveGuestWork(work);
    return { success: true };
  }

  /**
   * Delete a guest prompt
   */
  deletePrompt(promptId) {
    const work = this.getGuestWork();
    work.prompts = work.prompts.filter(p => p.id !== promptId);
    this.saveGuestWork(work);
    return { success: true };
  }

  /**
   * Add output to a prompt
   */
  addOutput(promptId, output) {
    const work = this.getGuestWork();
    const newOutput = {
      id: `guest_output_${Date.now()}`,
      promptId,
      ...output,
      createdAt: createTimestampMock(new Date()),
      isGuest: true,
    };
    
    work.outputs.push(newOutput);
    this.saveGuestWork(work);
    
    return newOutput;
  }

  /**
   * Add chat message
   */
  addChatMessage(message) {
    const work = this.getGuestWork();
    const newMessage = {
      id: `guest_msg_${Date.now()}`,
      ...message,
      timestamp: createTimestampMock(new Date()), 
      isGuest: true,
    };
    
    work.chatMessages.push(newMessage);
    this.saveGuestWork(work);
    
    return newMessage;
  }

  /**
   * Get all guest prompts
   */
  getPrompts() {
    const work = this.getGuestWork();
    return work.prompts || [];
  }

  /**
   * Get all guest outputs
   */
  getOutputs(promptId = null) {
    const work = this.getGuestWork();
    const outputs = work.outputs || [];
    
    if (promptId) {
      return outputs.filter(o => o.promptId === promptId);
    }
    
    return outputs;
  }

  /**
   * Get all guest chat messages
   */
  getChatMessages() {
    const work = this.getGuestWork();
    return work.chatMessages || [];
  }

  /**
   * Check if guest has any unsaved work
   */
  hasUnsavedWork() {
    const work = this.getGuestWork();
    return (
      work.prompts.length > 0 ||
      work.outputs.length > 0 ||
      work.chatMessages.length > 0
    );
  }

  /**
   * ✅ FIXED: Single getWorkSummary method (removed duplicate)
   */
  getWorkSummary() {
    const work = this.getGuestWork();
    return {
      promptCount: work.prompts.length,
      outputCount: work.outputs.length,
      chatCount: work.chatMessages.length,
      enhancementCount: work.enhancementCount || 0,
      lastModified: work.lastModified,
      sessionId: work.sessionId,
    };
  }

  /**
   * Clear all guest work (after successful migration)
   */
  clearGuestWork() {
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error clearing guest work:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export guest work for migration to backend
   */
  exportForMigration() {
    const work = this.getGuestWork();
    
    return {
      prompts: work.prompts.map(p => ({
        title: p.title || 'Untitled Prompt',
        text: p.text || '',
        tags: p.tags || [],
        visibility: p.visibility || 'private',
        outputs: this.getOutputs(p.id),
        createdAt: p.createdAt,
      })),
      chatMessages: work.chatMessages,
      metadata: {
        sessionId: this.sessionId,
        lastModified: work.lastModified,
        migratedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Cleanup old work to free up space
   */
  cleanupOldWork() {
    try {
      const work = this.getGuestWork();
      
      // Keep only last 10 prompts
      if (work.prompts.length > 10) {
        work.prompts = work.prompts.slice(-10);
      }
      
      // Keep only last 20 outputs
      if (work.outputs.length > 20) {
        work.outputs = work.outputs.slice(-20);
      }
      
      // Keep only last 50 chat messages
      if (work.chatMessages.length > 50) {
        work.chatMessages = work.chatMessages.slice(-50);
      }
      
      this.saveGuestWork(work);
    } catch (error) {
      console.error('Error cleaning up guest work:', error);
    }
  }

  /**
   * Check storage usage
   */
  getStorageInfo() {
    const data = localStorage.getItem(GUEST_STORAGE_KEY);
    const sizeInBytes = data ? new Blob([data]).size : 0;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    
    return {
      sizeInBytes,
      sizeInKB,
      promptCount: this.getPrompts().length,
      outputCount: this.getOutputs().length,
      chatCount: this.getChatMessages().length,
    };
  }
}

// Singleton instance
export const guestState = new GuestStateManager();

// Helper functions
export function isGuestUser(user) {
  return !user || user === null;
}

export function shouldTriggerSaveModal(user, action) {
  // Trigger save modal for guest users on these actions
  const saveActions = [
    'save_prompt',
    'save_workspace',
    'create_team',
    'invite_member',
    'persist_work',
  ];
  
  return isGuestUser(user) && saveActions.includes(action);
}

/**
 * Migrate guest work to authenticated user's backend
 */
export async function migrateGuestWorkToUser(userId, teamId, savePromptFn) {
  try {
    const guestWork = guestState.exportForMigration();
    
    if (guestWork.prompts.length === 0) {
      return { success: true, migratedCount: 0 };
    }
    
    let migratedCount = 0;
    const errors = [];
    
    // Migrate each prompt
    for (const promptData of guestWork.prompts) {
      try {
        await savePromptFn(userId, promptData, teamId);
        migratedCount++;
      } catch (error) {
        console.error('Error migrating prompt:', error);
        errors.push(error);
      }
    }
    
    // Clear guest work after successful migration
    if (migratedCount > 0 && errors.length === 0) {
      guestState.clearGuestWork();
    }
    
    return {
      success: errors.length === 0,
      migratedCount,
      errors,
      metadata: guestWork.metadata,
    };
  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      migratedCount: 0,
      error: error.message,
    };
  }
}

// Export for use in components
export default guestState;
