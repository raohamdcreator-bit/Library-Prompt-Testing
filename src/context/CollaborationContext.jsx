// src/context/CollaborationContext.jsx - Enhanced Real-time Collaboration Engine
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import {
  ref as dbRef,
  onValue,
  set,
  update,
  remove,
  onDisconnect,
  serverTimestamp,
  get,
} from "firebase/database";
import { getDatabase } from "firebase/database";

const CollaborationContext = createContext({});

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error(
      "useCollaboration must be used within CollaborationProvider"
    );
  }
  return context;
}

export function CollaborationProvider({ children }) {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [activeSessions, setActiveSessions] = useState({});
  const [presence, setPresence] = useState({});
  const [cursors, setCursors] = useState({});
  const [messages, setMessages] = useState([]);
  const [editLocks, setEditLocks] = useState({});
  const realtimeDB = getDatabase();

  // Cleanup refs
  const cleanupRefs = useRef([]);

  // Start collaboration session
  const startSession = useCallback(
    async (promptId, teamId) => {
      if (!user || !promptId || !teamId) return;

      const sessionPath = `collaborations/${teamId}/${promptId}`;
      const presencePath = `${sessionPath}/presence/${user.uid}`;

      const userData = {
        uid: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        avatar: user.photoURL,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isActive: true,
      };

      try {
        // Set user presence
        await set(dbRef(realtimeDB, presencePath), userData);

        // Set disconnect handler
        const presenceRef = dbRef(realtimeDB, presencePath);
        onDisconnect(presenceRef).remove();

        // Clear any stale locks from this user
        const lockRef = dbRef(realtimeDB, `${sessionPath}/lock`);
        const lockSnapshot = await get(lockRef);
        if (lockSnapshot.exists() && lockSnapshot.val().lockedBy === user.uid) {
          await set(lockRef, null);
        }
        onDisconnect(lockRef).remove();

        setActiveSession({ promptId, teamId });

        // Listen for presence updates
        const presenceListener = dbRef(realtimeDB, `${sessionPath}/presence`);
        const unsubPresence = onValue(presenceListener, (snapshot) => {
          const data = snapshot.val() || {};
          setPresence(data);
        });

        // Listen for cursor updates
        const cursorsListener = dbRef(realtimeDB, `${sessionPath}/cursors`);
        const unsubCursors = onValue(cursorsListener, (snapshot) => {
          const data = snapshot.val() || {};
          setCursors(data);
        });

        // Listen for edit locks
        const lockListener = dbRef(realtimeDB, `${sessionPath}/lock`);
        const unsubLock = onValue(lockListener, (snapshot) => {
          const data = snapshot.val();
          setEditLocks((prev) => ({
            ...prev,
            [promptId]: data,
          }));
        });

        // Listen for chat messages
        const messagesListener = dbRef(realtimeDB, `${sessionPath}/messages`);
        const unsubMessages = onValue(messagesListener, (snapshot) => {
          const data = snapshot.val() || {};
          const messageArray = Object.entries(data)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          setMessages(messageArray);
        });

        cleanupRefs.current = [
          unsubPresence,
          unsubCursors,
          unsubLock,
          unsubMessages,
        ];

        return { success: true };
      } catch (error) {
        console.error("Error starting collaboration session:", error);
        return { success: false, error };
      }
    },
    [user, realtimeDB]
  );

  // End collaboration session
  const endSession = useCallback(async () => {
    if (!activeSession || !user) return;

    const { promptId, teamId } = activeSession;
    const sessionPath = `collaborations/${teamId}/${promptId}`;

    try {
      // Remove presence
      await remove(dbRef(realtimeDB, `${sessionPath}/presence/${user.uid}`));

      // Remove cursor
      await remove(dbRef(realtimeDB, `${sessionPath}/cursors/${user.uid}`));

      // Release lock if held by this user
      const lockRef = dbRef(realtimeDB, `${sessionPath}/lock`);
      const lockSnapshot = await get(lockRef);
      if (lockSnapshot.exists() && lockSnapshot.val().lockedBy === user.uid) {
        await set(lockRef, null);
      }

      // Cleanup listeners
      cleanupRefs.current.forEach((cleanup) => cleanup && cleanup());
      cleanupRefs.current = [];

      setActiveSession(null);
      setPresence({});
      setCursors({});
      setMessages([]);

      return { success: true };
    } catch (error) {
      console.error("Error ending collaboration session:", error);
      return { success: false, error };
    }
  }, [activeSession, user, realtimeDB]);

  // Update cursor position
  const updateCursor = useCallback(
    async (position, selection = null) => {
      if (!activeSession || !user) return;

      const { promptId, teamId } = activeSession;
      const cursorPath = `collaborations/${teamId}/${promptId}/cursors/${user.uid}`;

      try {
        await set(dbRef(realtimeDB, cursorPath), {
          uid: user.uid,
          name: user.displayName || user.email,
          position,
          selection,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error updating cursor:", error);
      }
    },
    [activeSession, user, realtimeDB]
  );

  // Acquire edit lock
  const acquireLock = useCallback(
    async (promptId, teamId) => {
      if (!user || !promptId || !teamId) return { success: false };

      const lockPath = `collaborations/${teamId}/${promptId}/lock`;

      try {
        const lockRef = dbRef(realtimeDB, lockPath);
        const lockSnapshot = await get(lockRef);

        // Check if already locked by someone else
        if (lockSnapshot.exists()) {
          const lockData = lockSnapshot.val();
          if (lockData.lockedBy !== user.uid) {
            return {
              success: false,
              lockedBy: lockData,
              message: `Locked by ${lockData.userName}`,
            };
          }
        }

        // Acquire or refresh lock
        await set(lockRef, {
          lockedBy: user.uid,
          userName: user.displayName || user.email,
          userAvatar: user.photoURL,
          timestamp: serverTimestamp(),
        });

        // Set auto-release on disconnect
        onDisconnect(lockRef).remove();

        return { success: true };
      } catch (error) {
        console.error("Error acquiring lock:", error);
        return { success: false, error };
      }
    },
    [user, realtimeDB]
  );

  // Release edit lock
  const releaseLock = useCallback(
    async (promptId, teamId) => {
      if (!user || !promptId || !teamId) return { success: false };

      const lockPath = `collaborations/${teamId}/${promptId}/lock`;

      try {
        const lockRef = dbRef(realtimeDB, lockPath);
        const lockSnapshot = await get(lockRef);

        // Only release if locked by current user
        if (lockSnapshot.exists() && lockSnapshot.val().lockedBy === user.uid) {
          await set(lockRef, null);
        }

        return { success: true };
      } catch (error) {
        console.error("Error releasing lock:", error);
        return { success: false, error };
      }
    },
    [user, realtimeDB]
  );

  // Check if document is locked
  const isLocked = useCallback(
    (promptId) => {
      const lock = editLocks[promptId];
      if (!lock) return false;
      return lock.lockedBy !== user?.uid;
    },
    [editLocks, user]
  );

  // Get lock info
  const getLockInfo = useCallback(
    (promptId) => {
      return editLocks[promptId] || null;
    },
    [editLocks]
  );

  // Send chat message
  const sendMessage = useCallback(
    async (text) => {
      if (!activeSession || !user || !text.trim()) return;

      const { promptId, teamId } = activeSession;
      const messagesPath = `collaborations/${teamId}/${promptId}/messages`;

      try {
        const messageId = Date.now().toString();
        const messagePath = `${messagesPath}/${messageId}`;

        await set(dbRef(realtimeDB, messagePath), {
          uid: user.uid,
          name: user.displayName || user.email,
          avatar: user.photoURL,
          text: text.trim(),
          timestamp: serverTimestamp(),
        });

        return { success: true };
      } catch (error) {
        console.error("Error sending message:", error);
        return { success: false, error };
      }
    },
    [activeSession, user, realtimeDB]
  );

  // Update activity heartbeat
  useEffect(() => {
    if (!activeSession || !user) return;

    const { promptId, teamId } = activeSession;
    const presencePath = `collaborations/${teamId}/${promptId}/presence/${user.uid}`;

    const heartbeatInterval = setInterval(() => {
      update(dbRef(realtimeDB, presencePath), {
        lastSeen: serverTimestamp(),
        isActive: true,
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [activeSession, user, realtimeDB]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeSession) {
        endSession();
      }
    };
  }, []);

  // Get active collaborators for a specific prompt
  const getActiveCollaborators = useCallback(
    (promptId) => {
      return Object.values(presence).filter(
        (p) => p.isActive && p.uid !== user?.uid
      );
    },
    [presence, user]
  );

  // Get collaborator count for a specific prompt
  const getCollaboratorCount = useCallback(
    (promptId) => {
      return Object.keys(presence).length;
    },
    [presence]
  );

  const value = {
    activeSession,
    presence,
    cursors,
    messages,
    activeSessions,
    editLocks,
    startSession,
    endSession,
    updateCursor,
    sendMessage,
    acquireLock,
    releaseLock,
    isLocked,
    getLockInfo,
    getActiveCollaborators,
    getCollaboratorCount,
    isInSession: !!activeSession,
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

// Hook for managing collaborative editing with conflict resolution
export function useCollaborativeEditor(promptId, teamId, initialContent = "") {
  const { user } = useAuth();
  const { updateCursor, activeSession } = useCollaboration();
  const [content, setContent] = useState(initialContent);
  const [remoteChanges, setRemoteChanges] = useState([]);
  const realtimeDB = getDatabase();
  const editorRef = useRef(null);
  const localChangesRef = useRef([]);

  useEffect(() => {
    if (!promptId || !teamId || !user) return;

    const contentPath = `collaborations/${teamId}/${promptId}/content`;
    const changesPath = `collaborations/${teamId}/${promptId}/changes`;

    // Listen for content updates
    const contentListener = dbRef(realtimeDB, contentPath);
    const unsubContent = onValue(contentListener, (snapshot) => {
      const data = snapshot.val();
      if (data && data.text !== undefined) {
        // Conflict resolution: merge remote changes with local changes
        if (data.lastEditedBy !== user.uid) {
          setContent(data.text);
        }
      }
    });

    // Listen for changes
    const changesListener = dbRef(realtimeDB, changesPath);
    const unsubChanges = onValue(changesListener, (snapshot) => {
      const data = snapshot.val() || {};
      const changes = Object.entries(data)
        .map(([id, change]) => ({ id, ...change }))
        .filter((change) => change.uid !== user.uid)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setRemoteChanges(changes);
    });

    return () => {
      unsubContent();
      unsubChanges();
    };
  }, [promptId, teamId, user, realtimeDB]);

  // Apply remote changes
  const applyChange = useCallback(
    async (newContent, changeInfo) => {
      if (!promptId || !teamId || !user) return;

      const contentPath = `collaborations/${teamId}/${promptId}/content`;
      const changePath = `collaborations/${teamId}/${promptId}/changes/${Date.now()}`;

      try {
        // Update content
        await set(dbRef(realtimeDB, contentPath), {
          text: newContent,
          lastEditedBy: user.uid,
          timestamp: serverTimestamp(),
        });

        // Log change
        await set(dbRef(realtimeDB, changePath), {
          uid: user.uid,
          name: user.displayName || user.email,
          change: changeInfo,
          timestamp: serverTimestamp(),
        });

        setContent(newContent);
      } catch (error) {
        console.error("Error applying change:", error);
      }
    },
    [promptId, teamId, user, realtimeDB]
  );

  // Handle selection change
  const handleSelectionChange = useCallback(
    (position, selection) => {
      if (activeSession) {
        updateCursor(position, selection);
      }
    },
    [activeSession, updateCursor]
  );

  return {
    content,
    setContent: applyChange,
    remoteChanges,
    editorRef,
    handleSelectionChange,
  };
}
