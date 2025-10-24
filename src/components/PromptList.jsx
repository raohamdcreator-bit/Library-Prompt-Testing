// src/components/PromptList.jsx - Complete Fixed Version
import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { savePrompt, updatePrompt, deletePrompt } from "../lib/prompts";
import EditPromptModal from "./EditPromptModal";
import Comments from "./Comments";
import { FavoriteButton } from "./Favorites";
import { CompactAITools } from "./AIModelTools";
import AdvancedSearch from "./AdvancedSearch";
import BulkOperations, { PromptSelector } from "./BulkOperations";
import ExportImport, { ExportUtils } from "./ExportImport";
import usePagination, { PaginationControls } from "../hooks/usePagination";
import AIPromptEnhancer from "./AIPromptEnhancer";
import PromptResults from "./PromptResults";

// SVG Icon Component
function Icon({ name, className = "w-5 h-5" }) {
  const icons = {
    add: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    ),
    close: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    ),
    sparkles: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    ),
    copy: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    ),
    edit: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    ),
    trash: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    ),
    chevronUp: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    ),
    chevronDown: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    ),
    document: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
    database: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    ),
  };

  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {icons[name]}
    </svg>
  );
}

export default function PromptList({ activeTeam, userRole }) {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPrompt, setNewPrompt] = useState({ title: "", tags: "", text: "" });
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState(null);
  const [showComments, setShowComments] = useState({});
  const [showResults, setShowResults] = useState({});
  const [resultCounts, setResultCounts] = useState({});
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [teamMembers, setTeamMembers] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [showAIEnhancer, setShowAIEnhancer] = useState(false);
  const [currentPromptForAI, setCurrentPromptForAI] = useState(null);

  const pagination = usePagination(filteredPrompts, 10);

  // Load prompts from Firestore
  useEffect(() => {
    if (!activeTeam) {
      setPrompts([]);
      setFilteredPrompts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "teams", activeTeam, "prompts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          teamId: activeTeam,
          ...d.data(),
        }));

        const uniqueData = Array.from(
          new Map(data.map((item) => [item.id, item])).values()
        );

        setPrompts(uniqueData);
        setFilteredPrompts(uniqueData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading prompts:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activeTeam]);

  // Load team name
  useEffect(() => {
    async function loadTeamName() {
      if (!activeTeam) {
        setTeamName("");
        return;
      }

      try {
        const teamDoc = await getDoc(doc(db, "teams", activeTeam));
        if (teamDoc.exists()) {
          setTeamName(teamDoc.data().name || "Unknown Team");
        }
      } catch (error) {
        console.error("Error loading team name:", error);
        setTeamName("Unknown Team");
      }
    }

    loadTeamName();
  }, [activeTeam]);

  // Load team member profiles
  useEffect(() => {
    async function loadMembers() {
      if (!activeTeam) return;

      try {
        const teamDoc = await getDoc(doc(db, "teams", activeTeam));
        if (!teamDoc.exists()) return;

        const teamData = teamDoc.data();
        const memberIds = Object.keys(teamData.members || {});
        const profiles = {};

        for (const memberId of memberIds) {
          try {
            const userDoc = await getDoc(doc(db, "users", memberId));
            if (userDoc.exists()) {
              profiles[memberId] = userDoc.data();
            }
          } catch (error) {
            console.error("Error loading member profile:", error);
          }
        }

        setTeamMembers(profiles);
      } catch (error) {
        console.error("Error loading team members:", error);
      }
    }

    loadMembers();
  }, [activeTeam]);

  function handleFilteredResults(filtered) {
    setFilteredPrompts(filtered);
  }

  // FIX: Memoized callback that only updates if count actually changes
  const handleResultsChange = useCallback((promptId, count) => {
    setResultCounts((prev) => {
      // Only update if count actually changed to prevent unnecessary re-renders
      if (prev[promptId] === count) return prev;
      return {
        ...prev,
        [promptId]: count,
      };
    });
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newPrompt.title.trim() || !newPrompt.text.trim()) {
      alert("Title and prompt text are required");
      return;
    }

    try {
      await savePrompt(
        user.uid,
        {
          title: newPrompt.title.trim(),
          text: newPrompt.text.trim(),
          tags: newPrompt.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
        activeTeam
      );

      setNewPrompt({ title: "", tags: "", text: "" });
      setShowCreateForm(false);
      showNotification("Prompt created successfully!", "success");
    } catch (error) {
      console.error("Error creating prompt:", error);
      showNotification("Failed to create prompt", "error");
    }
  }

  async function handleUpdate(promptId, updates) {
    try {
      await updatePrompt(activeTeam, promptId, updates);
      setShowEditModal(false);
      setEditingPrompt(null);
      showNotification("Prompt updated successfully!", "success");
    } catch (error) {
      console.error("Error updating prompt:", error);
      showNotification("Failed to update prompt", "error");
    }
  }

  async function handleDelete(promptId) {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    if (
      prompt.createdBy !== user.uid &&
      userRole !== "owner" &&
      userRole !== "admin"
    ) {
      alert("You don't have permission to delete this prompt");
      return;
    }

    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      await deletePrompt(activeTeam, promptId);
      showNotification("Prompt deleted", "success");
    } catch (error) {
      console.error("Error deleting prompt:", error);
      showNotification("Failed to delete prompt", "error");
    }
  }

  async function handleCopy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("Copied to clipboard!", "success");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      showNotification("Failed to copy", "error");
    }
  }

  function toggleComments(promptId) {
    setShowComments((prev) => ({
      ...prev,
      [promptId]: !prev[promptId],
    }));
  }

  // FIX: Simple toggle without triggering cascading updates
  function toggleResults(promptId) {
    setShowResults((prev) => ({
      ...prev,
      [promptId]: !prev[promptId],
    }));
  }

  function handleSelectionChange(promptId, isSelected) {
    setSelectedPrompts((prev) =>
      isSelected ? [...prev, promptId] : prev.filter((id) => id !== promptId)
    );
  }

  async function handleBulkDelete(promptIds) {
    try {
      await Promise.all(promptIds.map((id) => deletePrompt(activeTeam, id)));
      setSelectedPrompts([]);
      showNotification(`Deleted ${promptIds.length} prompts`, "success");
    } catch (error) {
      console.error("Bulk delete error:", error);
      showNotification("Some prompts failed to delete", "error");
    }
  }

  function handleBulkExport(promptsToExport, format) {
    const filename = `prompts-${new Date().toISOString().split("T")[0]}`;
    switch (format) {
      case "json":
        ExportUtils.exportAsJSON(promptsToExport, filename);
        break;
      case "csv":
        ExportUtils.exportAsCSV(promptsToExport, filename);
        break;
      case "txt":
        ExportUtils.exportAsTXT(promptsToExport, filename);
        break;
    }
    showNotification(`Exported ${promptsToExport.length} prompts`, "success");
  }

  async function handleImport(importedPrompts) {
    let successCount = 0;
    let failCount = 0;

    for (const prompt of importedPrompts) {
      try {
        await savePrompt(user.uid, prompt, activeTeam);
        successCount++;
      } catch (error) {
        console.error("Import error:", error);
        failCount++;
      }
    }

    if (successCount > 0) {
      showNotification(
        `Imported ${successCount} prompts${
          failCount > 0 ? `, ${failCount} failed` : ""
        }`,
        successCount > failCount ? "success" : "error"
      );
    }
  }

  function handleAIEnhance(prompt) {
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
  }

  async function handleApplyAIEnhancement(enhancedPrompt) {
    try {
      await updatePrompt(activeTeam, enhancedPrompt.id, {
        text: enhancedPrompt.text,
        title: enhancedPrompt.title,
      });
      setShowAIEnhancer(false);
      setCurrentPromptForAI(null);
      showNotification("AI enhancement applied!", "success");
    } catch (error) {
      console.error("Error applying enhancement:", error);
      showNotification("Failed to apply enhancement", "error");
    }
  }

  async function handleSaveAIAsNew(enhancedPrompt) {
    try {
      await savePrompt(
        user.uid,
        {
          title: enhancedPrompt.title,
          text: enhancedPrompt.text,
          tags: Array.isArray(enhancedPrompt.tags) ? enhancedPrompt.tags : [],
        },
        activeTeam
      );
      setShowAIEnhancer(false);
      setCurrentPromptForAI(null);
      showNotification("AI enhanced prompt saved as new!", "success");
    } catch (error) {
      console.error("Error saving enhanced prompt:", error);
      showNotification("Failed to save enhanced prompt", "error");
    }
  }

  function showNotification(message, type = "info") {
    const icons = {
      success: "✓",
      error: "✕",
      info: "ℹ",
    };

    const notification = document.createElement("div");
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
      </div>
    `;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${type === "error" ? "destructive" : "primary"});
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

  function getUserInitials(name, email) {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  }

  function UserAvatar({ src, name, email, size = "small", className = "" }) {
    const [imageError, setImageError] = useState(false);
    const avatarClass = size === "small" ? "w-8 h-8" : "w-10 h-10";

    if (!src || imageError) {
      return (
        <div
          className={`${avatarClass} ${className} rounded-full flex items-center justify-center text-white font-semibold text-xs`}
          style={{ backgroundColor: "var(--primary)" }}
        >
          {getUserInitials(name, email)}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt="avatar"
        className={`${avatarClass} ${className} rounded-full object-cover border-2 border-white/20`}
        onError={() => setImageError(true)}
      />
    );
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      return timestamp.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function canEditPrompt(prompt) {
    return (
      prompt.createdBy === user.uid ||
      userRole === "owner" ||
      userRole === "admin"
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>Loading prompts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Prompt Library
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"} in
              this team
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary px-6 py-3 flex items-center gap-2"
          >
            <Icon name={showCreateForm ? "close" : "add"} />
            <span>{showCreateForm ? "Cancel" : "New Prompt"}</span>
          </button>
        </div>
      </div>

      {/* Create Prompt Form */}
      {showCreateForm && (
        <div className="glass-card p-6">
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Create New Prompt
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Title *
              </label>
              <input
                type="text"
                placeholder="e.g., Blog Post Generator"
                className="form-input"
                value={newPrompt.title}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, title: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Prompt Text *
              </label>
              <textarea
                placeholder="Enter your prompt here..."
                className="form-input min-h-[150px]"
                value={newPrompt.text}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, text: e.target.value })
                }
                required
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                {newPrompt.text.length} characters
              </p>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Tags (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g., writing, creative, marketing"
                className="form-input"
                value={newPrompt.tags}
                onChange={(e) =>
                  setNewPrompt({ ...newPrompt, tags: e.target.value })
                }
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary px-6 py-2">
                Create Prompt
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary px-6 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Advanced Search */}
      <AdvancedSearch
        prompts={prompts}
        onFilteredResults={handleFilteredResults}
        teamMembers={teamMembers}
      />

      {/* Bulk Operations */}
      {prompts.length > 0 && (
        <BulkOperations
          prompts={filteredPrompts}
          selectedPrompts={selectedPrompts}
          onSelectionChange={setSelectedPrompts}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
          userRole={userRole}
          userId={user.uid}
        />
      )}

      {/* Pagination Controls */}
      {filteredPrompts.length > 0 && (
        <PaginationControls
          pagination={pagination}
          showPageSizeSelector={true}
          showSearch={false}
        />
      )}

      {/* Prompts List */}
      {pagination.currentItems.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Icon
            name="document"
            className="mx-auto mb-4 w-16 h-16"
            style={{ color: "var(--muted-foreground)" }}
          />
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            {pagination.isFiltered ? "No matching prompts" : "No prompts yet"}
          </h3>
          <p style={{ color: "var(--muted-foreground)" }}>
            {pagination.isFiltered
              ? "Try adjusting your search filters"
              : "Create your first prompt to get started"}
          </p>
          {pagination.isFiltered && (
            <button
              onClick={pagination.clearSearch}
              className="btn-secondary mt-4"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {pagination.currentItems.map((prompt) => {
            const author = teamMembers[prompt.createdBy];
            const isExpanded = expandedPromptId === prompt.id;
            const isSelected = selectedPrompts.includes(prompt.id);
            const resultsCount = resultCounts[prompt.id] || 0;

            return (
              <div
                key={prompt.id}
                className="glass-card p-6 transition-all duration-300 hover:border-primary/50"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <PromptSelector
                      promptId={prompt.id}
                      isSelected={isSelected}
                      onSelectionChange={handleSelectionChange}
                      className="mt-1"
                    />

                    <UserAvatar
                      src={author?.avatar}
                      name={author?.name}
                      email={author?.email}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-lg font-semibold mb-1"
                        style={{ color: "var(--foreground)" }}
                      >
                        {prompt.title}
                      </h3>
                      <div
                        className="flex items-center gap-3 text-xs flex-wrap"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <span>
                          By {author?.name || author?.email || "Unknown"}
                        </span>
                        <span>•</span>
                        <span>{formatDate(prompt.createdAt)}</span>
                        <span>•</span>
                        <span>{prompt.text?.length || 0} chars</span>
                        {resultsCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Icon name="database" className="w-3 h-3" />
                              {resultsCount}{" "}
                              {resultsCount === 1 ? "result" : "results"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    <FavoriteButton
                      prompt={prompt}
                      teamId={activeTeam}
                      teamName={teamName}
                      size="small"
                    />

                    <button
                      onClick={() => handleAIEnhance(prompt)}
                      className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                      title="Enhance with AI"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleCopy(prompt.text)}
                      className="p-2 rounded-lg transition-colors"
                      style={{
                        backgroundColor: "var(--secondary)",
                        color: "var(--foreground)",
                      }}
                      title="Copy to clipboard"
                    >
                      <Icon name="copy" className="w-5 h-5" />
                    </button>

                    {canEditPrompt(prompt) && (
                      <>
                        <button
                          onClick={() => {
                            setEditingPrompt(prompt);
                            setShowEditModal(true);
                          }}
                          className="p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor: "var(--secondary)",
                            color: "var(--foreground)",
                          }}
                          title="Edit prompt"
                        >
                          <Icon name="edit" className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDelete(prompt.id)}
                          className="p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor: "var(--destructive)",
                            color: "var(--destructive-foreground)",
                          }}
                          title="Delete prompt"
                        >
                          <Icon name="trash" className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() =>
                        setExpandedPromptId(isExpanded ? null : prompt.id)
                      }
                      className="p-2 rounded-lg transition-colors"
                      style={{
                        backgroundColor: "var(--secondary)",
                        color: "var(--foreground)",
                      }}
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <Icon
                        name={isExpanded ? "chevronUp" : "chevronDown"}
                        className="w-5 h-5"
                      />
                    </button>
                  </div>
                </div>

                {/* Prompt Text Preview */}
                <div className="mb-4">
                  <div
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: "var(--muted)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <pre
                      className={`whitespace-pre-wrap text-sm font-mono ${
                        !isExpanded ? "line-clamp-3" : ""
                      }`}
                      style={{ color: "var(--foreground)" }}
                    >
                      {prompt.text}
                    </pre>
                  </div>
                </div>

                {/* Tags */}
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {prompt.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 rounded-full text-xs font-medium border"
                        style={{
                          backgroundColor: "var(--secondary)",
                          color: "var(--secondary-foreground)",
                          borderColor: "var(--border)",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    className="space-y-4 border-t pt-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <CompactAITools text={prompt.text} />

                    {/* Results Section - FIX: Added unique key to prevent remounting */}
                    <div>
                      <button
                        onClick={() => toggleResults(prompt.id)}
                        className="btn-secondary w-full py-2 text-sm flex items-center justify-center gap-2"
                      >
                        <Icon name="database" className="w-4 h-4" />
                        <span>
                          {showResults[prompt.id] ? "Hide" : "Show"} AI Output
                          Results
                          {resultsCount > 0 && ` (${resultsCount})`}
                        </span>
                      </button>

                      {showResults[prompt.id] && (
                        <div className="mt-4">
                          <PromptResults
                            key={`results-${prompt.id}`}
                            teamId={activeTeam}
                            promptId={prompt.id}
                            userRole={userRole}
                            onResultsChange={(count) =>
                              handleResultsChange(prompt.id, count)
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* Comments Section */}
                    <button
                      onClick={() => toggleComments(prompt.id)}
                      className="btn-secondary w-full py-2 text-sm"
                    >
                      {showComments[prompt.id] ? "Hide" : "Show"} Comments
                    </button>

                    {showComments[prompt.id] && (
                      <Comments
                        teamId={activeTeam}
                        promptId={prompt.id}
                        userRole={userRole}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination */}
      {filteredPrompts.length > 0 && (
        <PaginationControls
          pagination={pagination}
          showPageSizeSelector={false}
          showSearch={false}
        />
      )}

      {/* Import/Export */}
      <ExportImport
        onImport={handleImport}
        teamId={activeTeam}
        teamName={teamName}
        userRole={userRole}
      />

      {/* Edit Modal */}
      {showEditModal && editingPrompt && (
        <EditPromptModal
          open={showEditModal}
          prompt={editingPrompt}
          onClose={() => {
            setShowEditModal(false);
            setEditingPrompt(null);
          }}
          onSave={(updates) => handleUpdate(editingPrompt.id, updates)}
        />
      )}

      {/* AI Enhancement Modal */}
      {showAIEnhancer && currentPromptForAI && (
        <AIPromptEnhancer
          prompt={currentPromptForAI}
          onApply={handleApplyAIEnhancement}
          onSaveAsNew={handleSaveAIAsNew}
          onClose={() => {
            setShowAIEnhancer(false);
            setCurrentPromptForAI(null);
          }}
        />
      )}
    </div>
  );
}
