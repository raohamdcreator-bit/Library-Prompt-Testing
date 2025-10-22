// src/components/CollaborativeEditor.jsx - Real-time Collaborative Text Editor
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useCollaboration } from "../context/CollaborationContext";
import {
  getDatabase,
  ref as dbRef,
  onValue,
  set,
  serverTimestamp,
} from "firebase/database";

// Generate a unique color for each user
function getUserColor(userId) {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52BE80",
  ];
  const hash = userId
    .split("")
    .reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  return colors[hash % colors.length];
}

export default function CollaborativeEditor({
  promptId,
  teamId,
  initialContent,
  onSave,
  disabled = false,
}) {
  const { user } = useAuth();
  const { updateCursor, activeSession } = useCollaboration();
  const realtimeDB = getDatabase();

  const [content, setContent] = useState(initialContent || "");
  const [remoteCursors, setRemoteCursors] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState(null);
  const [remoteContent, setRemoteContent] = useState(initialContent || "");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const textareaRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const saveTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const cursorPositionRef = useRef({ line: 0, column: 0 });

  // Initialize RTDB paths
  const contentPath = `collaborations/${teamId}/${promptId}/content`;
  const cursorsPath = `collaborations/${teamId}/${promptId}/cursors`;
  const lockPath = `collaborations/${teamId}/${promptId}/lock`;

  // Listen for remote content changes
  useEffect(() => {
    if (!promptId || !teamId) return;

    const contentRef = dbRef(realtimeDB, contentPath);
    const unsubscribe = onValue(contentRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.text !== undefined) {
        // Only update if we're not actively typing
        if (!isTypingRef.current && data.lastEditedBy !== user?.uid) {
          setRemoteContent(data.text);
          setContent(data.text);
          setHasUnsavedChanges(false);
        }
      }
    });

    return () => unsubscribe();
  }, [promptId, teamId, user, realtimeDB, contentPath]);

  // Listen for cursor positions
  useEffect(() => {
    if (!promptId || !teamId) return;

    const cursorsRef = dbRef(realtimeDB, cursorsPath);
    const unsubscribe = onValue(cursorsRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Filter out current user's cursor
      const otherCursors = Object.entries(data)
        .filter(([uid]) => uid !== user?.uid)
        .reduce((acc, [uid, cursorData]) => {
          acc[uid] = cursorData;
          return acc;
        }, {});
      setRemoteCursors(otherCursors);
    });

    return () => unsubscribe();
  }, [promptId, teamId, user, realtimeDB, cursorsPath]);

  // Listen for edit lock
  useEffect(() => {
    if (!promptId || !teamId) return;

    const lockRef = dbRef(realtimeDB, lockPath);
    const unsubscribe = onValue(lockRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.lockedBy && data.lockedBy !== user?.uid) {
        setIsLocked(true);
        setLockedBy(data);
      } else {
        setIsLocked(false);
        setLockedBy(null);
      }
    });

    return () => unsubscribe();
  }, [promptId, teamId, user, realtimeDB, lockPath]);

  // Acquire edit lock when user starts typing
  const acquireLock = useCallback(async () => {
    if (!user || !promptId || !teamId) return;

    try {
      const lockRef = dbRef(realtimeDB, lockPath);
      await set(lockRef, {
        lockedBy: user.uid,
        userName: user.displayName || user.email,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error acquiring lock:", error);
    }
  }, [user, promptId, teamId, realtimeDB, lockPath]);

  // Release edit lock
  const releaseLock = useCallback(async () => {
    if (!user || !promptId || !teamId) return;

    try {
      const lockRef = dbRef(realtimeDB, lockPath);
      await set(lockRef, null);
    } catch (error) {
      console.error("Error releasing lock:", error);
    }
  }, [user, promptId, teamId, realtimeDB, lockPath]);

  // Calculate cursor position (line and column)
  const getCursorPosition = useCallback((textarea) => {
    if (!textarea) return { line: 0, column: 0 };

    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lines = textBeforeCursor.split("\n");

    return {
      line: lines.length,
      column: lines[lines.length - 1].length,
      position: cursorPos,
    };
  }, []);

  // Update cursor position in RTDB
  const updateCursorPosition = useCallback(async () => {
    if (!user || !promptId || !teamId || !textareaRef.current) return;

    const cursorData = getCursorPosition(textareaRef.current);
    cursorPositionRef.current = cursorData;

    try {
      const cursorRef = dbRef(realtimeDB, `${cursorsPath}/${user.uid}`);
      await set(cursorRef, {
        uid: user.uid,
        name: user.displayName || user.email,
        avatar: user.photoURL,
        color: getUserColor(user.uid),
        line: cursorData.line,
        column: cursorData.column,
        position: cursorData.position,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating cursor:", error);
    }
  }, [user, promptId, teamId, realtimeDB, cursorsPath, getCursorPosition]);

  // Handle content change
  const handleChange = useCallback(
    async (e) => {
      const newContent = e.target.value;
      setContent(newContent);
      setHasUnsavedChanges(true);
      isTypingRef.current = true;

      // Acquire lock on first change
      if (!isLocked || lockedBy?.lockedBy === user?.uid) {
        await acquireLock();
      }

      // Update cursor position
      updateCursorPosition();

      // Debounced save to RTDB
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const contentRef = dbRef(realtimeDB, contentPath);
          await set(contentRef, {
            text: newContent,
            lastEditedBy: user.uid,
            timestamp: serverTimestamp(),
          });
          isTypingRef.current = false;
          setHasUnsavedChanges(false);
        } catch (error) {
          console.error("Error saving to RTDB:", error);
        }
      }, 500); // Auto-save after 500ms of no typing
    },
    [
      user,
      isLocked,
      lockedBy,
      acquireLock,
      updateCursorPosition,
      realtimeDB,
      contentPath,
    ]
  );

  // Handle cursor/selection change
  const handleSelectionChange = useCallback(() => {
    updateCursorPosition();
  }, [updateCursorPosition]);

  // Handle manual save (Ctrl+S)
  const handleManualSave = useCallback(async () => {
    if (onSave && typeof onSave === "function") {
      await onSave(content);
      setHasUnsavedChanges(false);
      await releaseLock();
    }
  }, [content, onSave, releaseLock]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleManualSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseLock();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [releaseLock]);

  // Render remote cursors
  const renderCursors = () => {
    if (!textareaRef.current) return null;

    return Object.values(remoteCursors).map((cursor) => (
      <div
        key={cursor.uid}
        className="absolute pointer-events-none z-10"
        style={{
          left: `${cursor.column * 8}px`, // Approximate character width
          top: `${(cursor.line - 1) * 24}px`, // Line height
        }}
      >
        {/* Cursor line */}
        <div
          className="absolute w-0.5 h-6 animate-pulse"
          style={{ backgroundColor: cursor.color }}
        />
        {/* User label */}
        <div
          className="absolute -top-6 left-0 text-xs px-2 py-0.5 rounded whitespace-nowrap"
          style={{
            backgroundColor: cursor.color,
            color: "white",
          }}
        >
          {cursor.name}
        </div>
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Lock Warning Banner */}
      {isLocked && lockedBy && (
        <div
          className="px-4 py-3 border-b flex items-center gap-3"
          style={{
            backgroundColor: "var(--destructive)",
            color: "var(--destructive-foreground)",
            borderColor: "var(--border)",
          }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-sm font-medium">
            🔒 {lockedBy.userName} is currently editing this prompt
          </span>
        </div>
      )}

      {/* Status Bar */}
      <div
        className="px-4 py-2 border-b flex items-center justify-between text-xs"
        style={{
          backgroundColor: "var(--secondary)",
          borderColor: "var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* Save status */}
          <div className="flex items-center gap-2">
            {hasUnsavedChanges ? (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span>Unsaved changes</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>All changes saved</span>
              </>
            )}
          </div>

          {/* Active cursors */}
          {Object.keys(remoteCursors).length > 0 && (
            <div className="flex items-center gap-2">
              <span>👥 {Object.keys(remoteCursors).length} viewing</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Cursor position */}
          <span>
            Line {cursorPositionRef.current.line}, Col{" "}
            {cursorPositionRef.current.column}
          </span>

          {/* Character count */}
          <span>{content.length} characters</span>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        {/* Remote cursors overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {renderCursors()}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onSelect={handleSelectionChange}
          onClick={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          disabled={disabled || isLocked}
          className="w-full h-full p-4 resize-none font-mono text-sm leading-6 focus:outline-none"
          style={{
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            caretColor: isLocked
              ? "transparent"
              : getUserColor(user?.uid || ""),
          }}
          placeholder="Start typing your prompt here..."
          spellCheck={false}
        />
      </div>

      {/* Collaborator Avatars */}
      {Object.values(remoteCursors).length > 0 && (
        <div
          className="px-4 py-2 border-t flex items-center gap-2"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <span
            className="text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            Editing with:
          </span>
          {Object.values(remoteCursors).map((cursor) => (
            <div
              key={cursor.uid}
              className="flex items-center gap-2 px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--secondary)",
                border: `1px solid ${cursor.color}`,
              }}
            >
              {cursor.avatar ? (
                <img
                  src={cursor.avatar}
                  alt={cursor.name}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                  style={{ backgroundColor: cursor.color, color: "white" }}
                >
                  {cursor.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs" style={{ color: "var(--foreground)" }}>
                {cursor.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
