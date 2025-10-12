// src/components/PromptVersioning.jsx - Prompt Version History
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";

// Hook to manage prompt versions
export function usePromptVersions(teamId, promptId) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorProfiles, setAuthorProfiles] = useState({});

  useEffect(() => {
    if (!teamId || !promptId) {
      setVersions([]);
      setLoading(false);
      return;
    }

    const versionsRef = collection(
      db,
      "teams",
      teamId,
      "prompts",
      promptId,
      "versions"
    );
    const q = query(versionsRef, orderBy("createdAt", "desc"), limit(50));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const versionData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setVersions(versionData);

        // Load author profiles
        const authorIds = [
          ...new Set(versionData.map((v) => v.createdBy).filter(Boolean)),
        ];
        const profiles = {};

        for (const authorId of authorIds) {
          try {
            const userDoc = await getDoc(doc(db, "users", authorId));
            if (userDoc.exists()) {
              profiles[authorId] = userDoc.data();
            }
          } catch (error) {
            console.error("Error loading author:", error);
          }
        }

        setAuthorProfiles(profiles);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading versions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId, promptId]);

  return { versions, loading, authorProfiles };
}

// Save a new version
export async function savePromptVersion(
  teamId,
  promptId,
  data,
  changeNote = ""
) {
  try {
    const versionData = {
      ...data,
      changeNote,
      createdAt: serverTimestamp(),
    };

    await addDoc(
      collection(db, "teams", teamId, "prompts", promptId, "versions"),
      versionData
    );

    return { success: true };
  } catch (error) {
    console.error("Error saving version:", error);
    return { success: false, error };
  }
}

// Version History Modal Component
export default function PromptVersioning({
  teamId,
  promptId,
  currentPrompt,
  onRestore,
  onClose,
}) {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const { versions, loading, authorProfiles } = usePromptVersions(
    teamId,
    promptId
  );
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comparing, setComparing] = useState(false);

  function formatDate(timestamp) {
    if (!timestamp) return "Unknown";
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return "Invalid date";
    }
  }

  function handleRestore(version) {
    if (
      !confirm(
        "Restore this version? This will create a new version with this content."
      )
    ) {
      return;
    }

    onRestore({
      title: version.title,
      text: version.text,
      tags: version.tags || [],
    });

    success("Version restored successfully!");
    onClose();
  }

  function handleCompare(version) {
    setSelectedVersion(version);
    setComparing(true);
  }

  function getChangeIndicator(version, index) {
    if (index === 0) return "🆕";

    const prev = versions[index + 1];
    if (!prev) return "📝";

    const titleChanged = version.title !== prev.title;
    const textChanged = version.text !== prev.text;
    const tagsChanged =
      JSON.stringify(version.tags) !== JSON.stringify(prev.tags);

    if (titleChanged && textChanged) return "🔄";
    if (titleChanged) return "📌";
    if (textChanged) return "✏️";
    if (tagsChanged) return "🏷️";

    return "📝";
  }

  function calculateChanges(version, prevVersion) {
    if (!prevVersion) return null;

    const changes = [];

    if (version.title !== prevVersion.title) {
      changes.push({
        type: "title",
        old: prevVersion.title,
        new: version.title,
      });
    }

    if (version.text !== prevVersion.text) {
      const oldWords = prevVersion.text.split(/\s+/).length;
      const newWords = version.text.split(/\s+/).length;
      const diff = newWords - oldWords;
      changes.push({
        type: "text",
        wordDiff: diff,
        oldLength: prevVersion.text.length,
        newLength: version.text.length,
      });
    }

    const oldTags = new Set(prevVersion.tags || []);
    const newTags = new Set(version.tags || []);
    const added = [...newTags].filter((t) => !oldTags.has(t));
    const removed = [...oldTags].filter((t) => !newTags.has(t));

    if (added.length > 0 || removed.length > 0) {
      changes.push({ type: "tags", added, removed });
    }

    return changes;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="glass-card rounded-2xl max-w-4xl w-full p-8 text-center">
          <div className="neo-spinner mx-auto mb-4"></div>
          <p style={{ color: "var(--muted-foreground)" }}>
            Loading version history...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="glass-card rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                <span className="text-xl">📜</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  Version History
                </h2>
                <p className="text-sm text-slate-400">
                  {versions.length}{" "}
                  {versions.length === 1 ? "version" : "versions"} •{" "}
                  {currentPrompt.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {versions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                No Version History Yet
              </h3>
              <p className="text-slate-400">
                Versions will be saved automatically when you edit this prompt.
              </p>
            </div>
          ) : comparing && selectedVersion ? (
            /* Comparison View */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">
                  Comparing with Current
                </h3>
                <button
                  onClick={() => setComparing(false)}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  ← Back to History
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Selected Version */}
                <div className="glass-card p-4 border-2 border-yellow-500/50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-yellow-400">📜</span>
                    <h4 className="font-semibold text-slate-100">
                      Version from {formatDate(selectedVersion.createdAt)}
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Title:
                      </label>
                      <p className="text-slate-200">{selectedVersion.title}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Content:
                      </label>
                      <pre className="text-sm text-slate-200 whitespace-pre-wrap p-3 rounded bg-slate-800/50 max-h-64 overflow-y-auto">
                        {selectedVersion.text}
                      </pre>
                    </div>
                    {selectedVersion.tags &&
                      selectedVersion.tags.length > 0 && (
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">
                            Tags:
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {selectedVersion.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                  <button
                    onClick={() => handleRestore(selectedVersion)}
                    className="btn-primary w-full mt-4"
                  >
                    Restore This Version
                  </button>
                </div>

                {/* Current Version */}
                <div className="glass-card p-4 border-2 border-green-500/50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-green-400">✓</span>
                    <h4 className="font-semibold text-slate-100">
                      Current Version
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Title:
                      </label>
                      <p className="text-slate-200">{currentPrompt.title}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Content:
                      </label>
                      <pre className="text-sm text-slate-200 whitespace-pre-wrap p-3 rounded bg-slate-800/50 max-h-64 overflow-y-auto">
                        {currentPrompt.text}
                      </pre>
                    </div>
                    {currentPrompt.tags && currentPrompt.tags.length > 0 && (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Tags:
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {currentPrompt.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Version List */
            <div className="space-y-3">
              {versions.map((version, index) => {
                const author = authorProfiles[version.createdBy];
                const prevVersion = versions[index + 1];
                const changes = calculateChanges(version, prevVersion);

                return (
                  <div
                    key={version.id}
                    className="glass-card p-4 hover:border-primary/50 transition-all duration-200"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">
                        {getChangeIndicator(version, index)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-100">
                                {author?.name || author?.email || "Unknown"}
                              </span>
                              {index === 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400">
                              {formatDate(version.createdAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCompare(version)}
                              className="text-sm px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                            >
                              Compare
                            </button>
                            {index !== 0 && (
                              <button
                                onClick={() => handleRestore(version)}
                                className="text-sm px-3 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </div>

                        {version.changeNote && (
                          <p className="text-sm text-slate-300 mb-2 italic">
                            "{version.changeNote}"
                          </p>
                        )}

                        {changes && changes.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {changes.map((change, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 rounded bg-slate-800/50 text-slate-400"
                              >
                                {change.type === "title" && "📌 Title changed"}
                                {change.type === "text" && (
                                  <>
                                    ✏️ {change.wordDiff > 0 ? "+" : ""}
                                    {change.wordDiff} words (
                                    {change.newLength - change.oldLength > 0
                                      ? "+"
                                      : ""}
                                    {change.newLength - change.oldLength} chars)
                                  </>
                                )}
                                {change.type === "tags" && (
                                  <>
                                    🏷️ Tags:
                                    {change.added.length > 0 &&
                                      ` +${change.added.length}`}
                                    {change.removed.length > 0 &&
                                      ` -${change.removed.length}`}
                                  </>
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                            View content preview
                          </summary>
                          <pre className="mt-2 text-xs text-slate-300 whitespace-pre-wrap p-3 rounded bg-slate-800/50 max-h-32 overflow-y-auto">
                            {version.text.slice(0, 300)}
                            {version.text.length > 300 && "..."}
                          </pre>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <div>
              💡 Tip: Versions are saved automatically when you edit a prompt
            </div>
            <button onClick={onClose} className="btn-secondary px-4 py-2">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
