// src/lib/demoPromptManager.js - Local storage manager for demo prompts
// Demo prompts are ephemeral and stored only in sessionStorage
// They are discarded on refresh and never saved to backend

import { DEMO_PROMPTS, isDemoPrompt } from './guestDemoContent';
import { createTimestampMock } from './dateUtils';
const DEMO_STORAGE_KEY = 'prism_demo_prompts_session';

/**
 * Initialize demo prompts in sessionStorage
 * Called when guest users first access the app
 */
export function initializeDemoPrompts() {
  try {
    // Check if already initialized
    const existing = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (existing) {
      return JSON.parse(existing);
    }

    // Initialize with default demos
    const demoData = {
      prompts: DEMO_PROMPTS,
      initializedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoData));
    return demoData.prompts;
  } catch (error) {
    console.error('Error initializing demo prompts:', error);
    return DEMO_PROMPTS; // Fallback to in-memory
  }
}

/**
 * Get all demo prompts from session storage
 */
export function getDemoPrompts() {
  try {
    const stored = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) {
      return initializeDemoPrompts();
    }

    const data = JSON.parse(stored);
    const prompts = data.prompts || DEMO_PROMPTS;
    
    // ✅ FIXED: Reconstruct timestamp mocks after JSON parse
    return prompts.map(prompt => ({
      ...prompt,
      createdAt: reconstructTimestamp(prompt.createdAt),
      updatedAt: prompt.updatedAt ? reconstructTimestamp(prompt.updatedAt) : undefined,
    }));
  } catch (error) {
    console.error('Error loading demo prompts:', error);
    return DEMO_PROMPTS;
  }
}

/**
 * ✅ NEW HELPER: Reconstruct timestamp mock from stored data
 */
function reconstructTimestamp(timestamp) {
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
 * Update a demo prompt (ephemeral - lost on refresh)
 */
export function updateDemoPrompt(promptId, updates) {
  try {
    const prompts = getDemoPrompts();
    const index = prompts.findIndex(p => p.id === promptId);
    
    if (index === -1) {
      throw new Error('Demo prompt not found');
    }

    // ✅ CORRECT: Store original first, then create updated array
    const originalPrompt = prompts[index];          // ✅ Get from 'prompts'
    const updatedPrompts = [...prompts];            // ✅ Then create copy
    
    updatedPrompts[index] = {
      ...originalPrompt,
      ...updates,
      createdAt: originalPrompt.createdAt,         // ✅ Preserve timestamp
      updatedAt: createTimestampMock(new Date()),  // ✅ Add update time
      isDemo: true,
      owner: 'system',
    };

    // Save back to session storage
    const demoData = {
      prompts: updatedPrompts,
      initializedAt: getDemoData().initializedAt,
    };

    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoData));
    return updatedPrompts[index];
  } catch (error) {
    console.error('Error updating demo prompt:', error);
    throw error;
  }
}

/**
 * Delete a demo prompt from session (ephemeral)
 */
export function deleteDemoPrompt(promptId) {  // ✅ ADD 'export'
  try {
    const prompts = getDemoPrompts();
    const filtered = prompts.filter(p => p.id !== promptId);

    const demoData = {
      prompts: filtered,
      initializedAt: getDemoData().initializedAt,
    };

    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoData));
    return true;
  } catch (error) {
    console.error('Error deleting demo prompt:', error);
    throw error;
  }
}

/**
 * Get full demo data object
 */
function getDemoData() {
  try {
    const stored = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) {
      return {
        prompts: DEMO_PROMPTS,
        initializedAt: new Date().toISOString(),
      };
    }
    return JSON.parse(stored);
  } catch (error) {
    return {
      prompts: DEMO_PROMPTS,
      initializedAt: new Date().toISOString(),
    };
  }
}

/**
 * Clear all demo prompts (reset to defaults)
 */
export function resetDemoPrompts() {
  try {
    sessionStorage.removeItem(DEMO_STORAGE_KEY);
    return initializeDemoPrompts();
  } catch (error) {
    console.error('Error resetting demo prompts:', error);
    return DEMO_PROMPTS;
  }
}

/**
 * Check if demo prompts are initialized
 */
export function areDemoPromptsInitialized() {
  return sessionStorage.getItem(DEMO_STORAGE_KEY) !== null;
}

/**
 * Analytics tracking for demo interactions
 */
export function trackDemoInteraction(action, promptId, metadata = {}) {
  if (window.gtag) {
    window.gtag('event', `demo_prompt_${action}`, {
      prompt_id: promptId,
      ...metadata,
    });
  }
}
