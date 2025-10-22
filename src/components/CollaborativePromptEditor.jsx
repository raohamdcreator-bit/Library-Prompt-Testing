// src/components/CollaborativePromptEditor.jsx - Full Collaboration Interface with Versioning
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useCollaboration } from "../context/CollaborationContext";
import CollaborativeEditor from "./CollaborativeEditor";
import PromptVersioning, { savePromptVersion } from "./PromptVersioning";

export default function CollaborativePromptEditor({
  promptId,
  teamId,
  onClose,
  onSave,
}) {
  const { user } = useAuth();
  const {
    getActiveCollaborators,
    getCollaboratorCount,
    startSession,
    endSession,
    isLocked,
    getLockInfo,
  } = useCollaboration();

  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showVersioning, setShowVersioning] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  // Start collaboration session when component mounts
  useEffect(() => {
    if (promptId && teamId && user && !sessionStarted) {
      startSession(promptId, teamId).then((result) => {
        if (result.success) {
          setSessionStarted(true);
          console.log("✅ Collaboration session started");
        }
      });
    }

    return () => {
      if (sessionStarted) {
        endSession();
        console.log("🔌 Collaboration session ended");
      }
    };
  }, [promptId, teamId, user, startSession, endSession, sessionStarted]);

  // Load prompt data
  useEffect(() => {
    async function loadPrompt() {
      if (!promptId || !teamId) return;
      try {
        const promptRef = doc(db, "teams", teamId, "prompts", promptId);
        const promptSnap = await getDoc(promptRef);
        if (promptSnap.exists()) {
          const data = { id: promptSnap.id, ...promptSnap.data() };
          setPrompt(data);
          setTitle(data.title || "");
          setTags(Array.isArray(data.tags) ? data.tags.join(", ") : "");
        }
      } catch (error) {
        console.error("Error loading prompt:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPrompt();
  }, [promptId, teamId]);

  // Save prompt (called by CollaborativeEditor on Ctrl+S or manually)
  const handleSave = async (content) => {
    if (!promptId || !teamId || saving) return;
    setSaving(true);

    const newTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const newTitle = title.trim();

    // Check if document is locked by someone else
    const lockInfo = getLockInfo(promptId);
    if (lockInfo && lockInfo.lockedBy !== user.uid) {
      showNotification(
        `Cannot save: ${lockInfo.userName} is currently editing`,
        "error"
      );
      setSaving(false);
      return;
    }

    // 1. Create a version snapshot before updating the main prompt
    try {
      await savePromptVersion(
        teamId,
        promptId,
        {
          title: newTitle,
          text: content,
          tags: newTags,
          createdBy: user.uid,
        },
        "Collaborative Save"
      );
      console.log("✅ Prompt version saved.");
    } catch (versionError) {
      console.error("Warning: Failed to save version:", versionError);
      showNotification("Warning: Version save failed.", "warning");
    }

    // 2. Update the main prompt document
    try {
      const promptRef = doc(db, "teams", teamId, "prompts", promptId);
      await updateDoc(promptRef, {
        title: newTitle,
        text: content,
        tags: newTags,
        updatedAt: serverTimestamp(),
      });

      if (onSave) {
        onSave();
      }

      setPrompt((prev) => ({
        ...prev,
        title: newTitle,
        tags: newTags,
        text: content,
      }));

      showNotification("Changes saved and version captured!", "success");
    } catch (error) {
      console.error("Error saving prompt:", error);
      showNotification("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type]}</span>
        <span>${message}</span>
      </div>
    `;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${
        type === "error" || type === "warning" ? "destructive" : "primary"
      });
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Handler for restoring a version from the PromptVersioning modal
  const handleRestoreVersion = ({
    title: restoredTitle,
    text: restoredText,
    tags: restoredTags,
  }) => {
    setTitle(restoredTitle);
    setTags(restoredTags.join(", "));
    handleSave(restoredText);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="glass-card p-8 text-center">
          <div className="neo-spinner mx-auto mb-4"></div>
          <p style={{ color: "var(--muted-foreground)" }}>Loading prompt...</p>
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Prompt Not Found
          </h3>
          <p className="mb-4" style={{ color: "var(--muted-foreground)" }}>
            The prompt you're trying to edit could not be found.
          </p>
          <button onClick={onClose} className="btn-secondary px-6 py-2">
            Close
          </button>
        </div>
      </div>
    );
  }

  const activeCollaborators = getActiveCollaborators(promptId);
  const collaboratorCount = getCollaboratorCount(promptId);
  const inSession = collaboratorCount > 0;
  const lockInfo = getLockInfo(promptId);
  const isDocLocked = isLocked(promptId);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="glass-card rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center">
                  <span className="text-xl">✏️</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">
                    Collaborative Edit
                  </h2>
                  <p className="text-sm text-slate-400">
                    {inSession
                      ? `${collaboratorCount} ${
                          collaboratorCount === 1 ? "user" : "users"
                        } editing now`
                      : "Start editing session"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {/* Version History Button */}
                <button
                  onClick={() => setShowVersioning(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:border-accent/50"
                  style={{
                    backgroundColor: "var(--secondary)",
                    borderColor: "var(--border)",
                    color: "var(--accent)",
                  }}
                  title="View Version History"
                >
                  📜
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    History
                  </span>
                </button>

                {/* Collaborators Badge */}
                {collaboratorCount > 0 && (
                  <button
                    onClick={() => setShowCollaborators(!showCollaborators)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:border-primary/50"
                    style={{
                      backgroundColor: "var(--secondary)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      👥 {collaboratorCount}
                    </span>
                  </button>
                )}

                {/* Lock Status Indicator */}
                {isDocLocked && lockInfo && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                    style={{
                      backgroundColor: "var(--destructive)",
                      borderColor: "var(--destructive)",
                      color: "var(--destructive-foreground)",
                    }}
                  >
                    <span className="text-sm">🔒</span>
                    <span className="text-sm font-medium">
                      Locked by {lockInfo.userName}
                    </span>
                  </div>
                )}

                <button
                  onClick={onClose}
                  disabled={saving}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Title and Tags */}
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Prompt title..."
                className="form-input w-full"
                disabled={saving || isDocLocked}
              />
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags (comma separated)..."
                className="form-input w-full"
                disabled={saving || isDocLocked}
              />
            </div>
          </div>

          {/* Collaborators List */}
          {showCollaborators && activeCollaborators.length > 0 && (
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h4 className="text-sm font-semibold mb-2 text-slate-300">
                Active Collaborators:
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeCollaborators.map((collab) => (
                  <div
                    key={collab.uid}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: "var(--secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: "var(--primary)" }}
                    />
                    {collab.avatar && (
                      <img
                        src={collab.avatar}
                        alt={collab.name}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span
                      className="text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {collab.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            <CollaborativeEditor
              promptId={promptId}
              teamId={teamId}
              initialContent={prompt.text || ""}
              onSave={handleSave}
              disabled={saving}
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/5">
            <div className="flex justify-between items-center">
              <div className="text-xs text-slate-400">
                💡 Tip: Changes are auto-saved • Press Ctrl+S to save manually
                {isDocLocked && " • Document locked by another user"}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="btn-secondary px-4 py-2"
                >
                  Close
                </button>
                <button
                  onClick={() => handleSave(prompt.text)}
                  disabled={saving || isDocLocked}
                  className="btn-primary px-6 py-2 flex items-center gap-2"
                  title={isDocLocked ? "Document is locked" : "Save changes"}
                >
                  {saving && <div className="neo-spinner w-4 h-4"></div>}
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Versioning Modal */}
      {showVersioning && (
        <PromptVersioning
          teamId={teamId}
          promptId={promptId}
          currentPrompt={prompt}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersioning(false)}
        />
      )}
    </>
  );
}
