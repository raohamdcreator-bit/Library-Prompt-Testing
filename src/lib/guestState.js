// src/lib/guestState.js
import { createTimestampMock } from './guestDemoContent';

const GUEST_STORAGE_KEY = 'prism_guest_work';
const GUEST_SESSION_KEY = 'prism_guest_session';
// ✅ FIX: Key used to prevent duplicate migrations across re-renders
const MIGRATION_DONE_KEY = 'prism_migration_done';

/**
 * Guest State Manager
 * Persists user work in localStorage until they sign up.
 */
export class GuestStateManager {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  // ─── Session ID ────────────────────────────────────────────────────────────

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(GUEST_SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  // ─── Raw Storage ───────────────────────────────────────────────────────────

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

  getDefaultState() {
    return {
      prompts: [],
      outputs: [],
      chatMessages: [],
      enhancementCount: 0,
      lastModified: null,
      sessionId: this.sessionId,
    };
  }

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
      if (error.name === 'QuotaExceededError') {
        this.cleanupOldWork();
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

  // ─── Timestamp Helpers ─────────────────────────────────────────────────────

  reconstructTimestamp(timestamp) {
    if (!timestamp) return undefined;
    if (timestamp.toMillis && typeof timestamp.toMillis === 'function') return timestamp;
    if (timestamp.seconds !== undefined) return createTimestampMock(new Date(timestamp.seconds * 1000));
    if (typeof timestamp === 'string') return createTimestampMock(new Date(timestamp));
    return createTimestampMock(new Date());
  }

  // ─── Prompts ───────────────────────────────────────────────────────────────

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

  updatePrompt(promptId, updates, isEnhancement = false) {
    const work = this.getGuestWork();
    const promptIndex = work.prompts.findIndex(p => p.id === promptId);
    if (promptIndex === -1) return { success: false, error: 'Prompt not found' };

    work.prompts[promptIndex] = {
      ...work.prompts[promptIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (isEnhancement) {
      work.enhancementCount = (work.enhancementCount || 0) + 1;
    }

    this.saveGuestWork(work);
    return { success: true };
  }

  deletePrompt(promptId) {
    const work = this.getGuestWork();
    work.prompts = work.prompts.filter(p => p.id !== promptId);
    this.saveGuestWork(work);
    return { success: true };
  }

  getPrompts() {
    return this.getGuestWork().prompts || [];
  }

  // ─── Outputs ───────────────────────────────────────────────────────────────

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

  getOutputs(promptId = null) {
    const outputs = this.getGuestWork().outputs || [];
    return promptId ? outputs.filter(o => o.promptId === promptId) : outputs;
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

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

  getChatMessages() {
    return this.getGuestWork().chatMessages || [];
  }

  // ─── Work Summary ──────────────────────────────────────────────────────────

  hasUnsavedWork() {
    const work = this.getGuestWork();
    return (
      work.prompts.length > 0 ||
      work.outputs.length > 0 ||
      work.chatMessages.length > 0
    );
  }

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

  // ─── Migration ─────────────────────────────────────────────────────────────

  /**
   * Returns true if migration has already been triggered for this browser
   * session. Uses sessionStorage so the flag resets on tab close.
   */
  isMigrationComplete() {
    return sessionStorage.getItem(MIGRATION_DONE_KEY) === 'true';
  }

  /**
   * Mark migration as done for this session.
   * Called immediately when migration begins so re-renders cannot trigger it again.
   */
  markMigrationComplete() {
    sessionStorage.setItem(MIGRATION_DONE_KEY, 'true');
  }

  /**
   * Snapshot the current guest work and clear it from localStorage
   * before any async saves begin. Returns the snapshot.
   * This prevents double-migration when the effect re-fires.
   */
  snapshotAndClear() {
    const work = this.exportForMigration();
    this.clearGuestWork();
    return work;
  }

  // ─── Export / Clear ────────────────────────────────────────────────────────

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

  cleanupOldWork() {
    try {
      const work = this.getGuestWork();
      if (work.prompts.length > 10)     work.prompts      = work.prompts.slice(-10);
      if (work.outputs.length > 20)     work.outputs      = work.outputs.slice(-20);
      if (work.chatMessages.length > 50) work.chatMessages = work.chatMessages.slice(-50);
      this.saveGuestWork(work);
    } catch (error) {
      console.error('Error cleaning up guest work:', error);
    }
  }

  getStorageInfo() {
    const data = localStorage.getItem(GUEST_STORAGE_KEY);
    const sizeInBytes = data ? new Blob([data]).size : 0;
    return {
      sizeInBytes,
      sizeInKB: (sizeInBytes / 1024).toFixed(2),
      promptCount: this.getPrompts().length,
      outputCount: this.getOutputs().length,
      chatCount: this.getChatMessages().length,
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────
export const guestState = new GuestStateManager();

// ─── Helpers ───────────────────────────────────────────────────────────────

export function isGuestUser(user) {
  return !user || user === null;
}

export function shouldTriggerSaveModal(user, action) {
  const saveActions = [
    'save_prompt', 'save_workspace', 'create_team', 'invite_member', 'persist_work',
  ];
  return isGuestUser(user) && saveActions.includes(action);
}

/**
 * Migrate guest work to an authenticated user's Firestore team.
 *
 * ✅ FIX: Guest work is snapshot-and-cleared BEFORE the async save loop.
 * This ensures that even if the calling effect fires multiple times (e.g. due
 * to Firestore onSnapshot re-renders), the data is only ever migrated once.
 * The `isMigrationComplete` / `markMigrationComplete` session flags in
 * GuestStateManager provide a second layer of protection at the call-site.
 */
export async function migrateGuestWorkToUser(userId, teamId, savePromptFn) {
  try {
    // ✅ Snapshot data and clear localStorage atomically BEFORE saving.
    // Any subsequent calls to this function will see an empty prompts array.
    const guestWork = guestState.snapshotAndClear();

    if (guestWork.prompts.length === 0) {
      return { success: true, migratedCount: 0 };
    }

    let migratedCount = 0;
    const errors = [];

    for (const promptData of guestWork.prompts) {
      try {
        await savePromptFn(userId, promptData, teamId);
        migratedCount++;
      } catch (error) {
        console.error('Error migrating prompt:', error);
        errors.push(error);
      }
    }

    return {
      success: errors.length === 0,
      migratedCount,
      errors,
      metadata: guestWork.metadata,
    };
  } catch (error) {
    console.error('Error during migration:', error);
    return { success: false, migratedCount: 0, error: error.message };
  }
}

export default guestState;
