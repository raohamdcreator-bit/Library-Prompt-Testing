// src/components/PromptList.jsx - Complete Updated Version with Fixed View Count
import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/firebase";
import { trackPromptCopy, trackPromptView } from "../lib/promptStats";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import {
  savePrompt,
  updatePrompt,
  deletePrompt,
  togglePromptVisibility,
  canChangeVisibility,
  filterVisiblePrompts,
} from "../lib/prompts";
import {
  Plus,
  X,
  Sparkles,
  Copy,
  Edit2,
  Trash2,
  ChevronDown,
  MoreVertical,
  Lock,
  Unlock,
  Maximize2,
  Eye,
  Star,
  FileText,
  AlertCircle,
} from "lucide-react";
import EditPromptModal from "./EditPromptModal";
import Comments from "./Comments";
import { FavoriteButton } from "./Favorites";
import { CompactAITools } from "./AIModelTools";
import AdvancedSearch from "./AdvancedSearch";
import BulkOperations from "./BulkOperations";
import EnhancedBadge from './EnhancedBadge';
import ExportImport, { ExportUtils } from "./ExportImport";
import usePagination, { PaginationControls } from "../hooks/usePagination";
import AIPromptEnhancer from "./AIPromptEnhancer";
import PromptResults from "./PromptResults";
import { StarRating, usePromptRating } from "./PromptAnalytics";
import { useSoundEffects } from '../hooks/useSoundEffects';
// Rating Section Component
function RatingSection({ teamId, promptId }) {
  const { userRating, averageRating, totalRatings, ratePrompt, loading } = 
    usePromptRating(teamId, promptId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Loading ratings...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarRating
            rating={userRating || 0}
            onRate={ratePrompt}
            size="normal"
          />
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {userRating ? "Your Rating" : "Rate this prompt"}
          </span>
        </div>
      </div>
      
      {totalRatings > 0 && (
        <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4" fill="#fbbf24" color="#fbbf24" />
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>
              {averageRating.toFixed(1)}
            </span>
          </div>
          <span>•</span>
          <span>{totalRatings} {totalRatings === 1 ? "rating" : "ratings"}</span>
        </div>
      )}
    </div>
  );
}

export default function PromptList({ activeTeam, userRole }) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const [prompts, setPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPrompt, setNewPrompt] = useState({
    title: "",
    tags: "",
    text: "",
    visibility: "public",
  });
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState(null);
  const [expandedTextIds, setExpandedTextIds] = useState(new Set());
  const [showComments, setShowComments] = useState({});
  const [showResults, setShowResults] = useState({});
  const [resultCounts, setResultCounts] = useState({});
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [teamMembers, setTeamMembers] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [showAIEnhancer, setShowAIEnhancer] = useState(false);
  const [currentPromptForAI, setCurrentPromptForAI] = useState(null);
  const [openKebabMenu, setOpenKebabMenu] = useState(null);
  const [viewedPrompts, setViewedPrompts] = useState(new Set());

  const pagination = usePagination(filteredPrompts, 10);

  // Load prompts
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

        const visiblePrompts = filterVisiblePrompts(uniqueData, user.uid, userRole);
        setPrompts(visiblePrompts);
        setFilteredPrompts(visiblePrompts);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading prompts:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activeTeam, user.uid, userRole]);

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

  // Load team members
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

  // Load previously viewed prompts from localStorage
  useEffect(() => {
    async function loadViewedPrompts() {
      if (!activeTeam || !user?.uid) return;
      
      try {
        const storageKey = `viewedPrompts_${user.uid}_${activeTeam}`;
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
          const viewedIds = JSON.parse(stored);
          setViewedPrompts(new Set(viewedIds));
        }
      } catch (error) {
        console.error("Error loading viewed prompts:", error);
      }
    }
    
    loadViewedPrompts();
  }, [activeTeam, user?.uid]);

  // Persist viewed prompts to localStorage
  useEffect(() => {
    if (!activeTeam || !user?.uid || viewedPrompts.size === 0) return;
    
    try {
      const storageKey = `viewedPrompts_${user.uid}_${activeTeam}`;
      localStorage.setItem(storageKey, JSON.stringify([...viewedPrompts]));
    } catch (error) {
      console.error("Error saving viewed prompts:", error);
    }
  }, [viewedPrompts, activeTeam, user?.uid]);

  // Close kebab menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (openKebabMenu && !event.target.closest('.kebab-menu-container')) {
        setOpenKebabMenu(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openKebabMenu]);

  function handleFilteredResults(filtered) {
    setFilteredPrompts(filtered);
  }

  const handleResultsChange = useCallback((promptId, count) => {
    setResultCounts((prev) => {
      if (prev[promptId] === count) return prev;
      return { ...prev, [promptId]: count };
    });
  }, []);

  function toggleTextExpansion(promptId) {
    setExpandedTextIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        newSet.add(promptId);
      }
      return newSet;
    });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newPrompt.title.trim() || !newPrompt.text.trim()) {
      showNotification("Title and prompt text are required", "error");
      return;
    }

    try {
      await savePrompt(
        user.uid,
        {
          title: newPrompt.title.trim(),
          text: newPrompt.text.trim(),
          tags: newPrompt.tags.split(",").map((t) => t.trim()).filter(Boolean),
          visibility: newPrompt.visibility,
        },
        activeTeam
      );

      setNewPrompt({ title: "", tags: "", text: "", visibility: "public" });
      setShowCreateForm(false);
      showSuccessToast("Prompt created successfully!");
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
      showSuccessToast("Prompt updated successfully!");
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
      showNotification("You don't have permission to delete this prompt", "error");
      return;
    }

    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      await deletePrompt(activeTeam, promptId);
      showSuccessToast("Prompt deleted");
      setOpenKebabMenu(null);
    } catch (error) {
      console.error("Error deleting prompt:", error);
      showNotification("Failed to delete prompt", "error");
    }
  }

  async function handleToggleVisibility(promptId) {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    if (!canChangeVisibility(prompt, user.uid, userRole)) {
      showNotification("You don't have permission to change visibility", "error");
      return;
    }

    try {
      const newVisibility = await togglePromptVisibility(
        activeTeam,
        promptId,
        prompt.visibility || "public"
      );
      showSuccessToast(
        `Prompt is now ${newVisibility === "private" ? "private" : "public"}`
      );
      setOpenKebabMenu(null);
    } catch (error) {
      console.error("Error toggling visibility:", error);
      showNotification("Failed to change visibility", "error");
    }
  }

  async function handleCopy(text, promptId) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Copied to clipboard!");
      
      // Track copy in stats
      await trackPromptCopy(activeTeam, promptId);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      showNotification("Failed to copy", "error");
    }
  }

  async function handleExpand(promptId) {
    const isCurrentlyExpanded = expandedPromptId === promptId;
    
    // Toggle expansion state (no view tracking here)
    setExpandedPromptId(isCurrentlyExpanded ? null : promptId);
  }

  async function handleTextExpansionWithTracking(promptId) {
    const isCurrentlyExpanded = expandedTextIds.has(promptId);
    const wasAlreadyExpanded = isCurrentlyExpanded;
    
    // Toggle text expansion
    toggleTextExpansion(promptId);
    
    // Only track view if:
    // 1. We're expanding (not collapsing)
    // 2. This user hasn't viewed this prompt yet in this session
    if (!wasAlreadyExpanded && !viewedPrompts.has(promptId)) {
      try {
        await trackPromptView(activeTeam, promptId);
        // Mark this prompt as viewed to prevent duplicate tracking
        setViewedPrompts(prev => new Set([...prev, promptId]));
      } catch (error) {
        console.error("Error tracking view:", error);
      }
    }
  }

  function handleAIEnhance(prompt) {
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
    setOpenKebabMenu(null);
  }

  async function handleApplyAIEnhancement(enhancedPrompt) {
    try {
      await updatePrompt(activeTeam, enhancedPrompt.id, {
        text: enhancedPrompt.text,
        title: enhancedPrompt.title,
      });
      setShowAIEnhancer(false);
      setCurrentPromptForAI(null);
      showSuccessToast("AI enhancement applied!");
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
          visibility: enhancedPrompt.visibility || "public",
        },
        activeTeam
      );
      setShowAIEnhancer(false);
      setCurrentPromptForAI(null);
      showSuccessToast("AI enhanced prompt saved as new!");
    } catch (error) {
      console.error("Error saving enhanced prompt:", error);
      showNotification("Failed to save enhanced prompt", "error");
    }
  }

  function showSuccessToast(message) {
    playNotification();
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.innerHTML = `
      <div class="success-icon">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  function showNotification(message, type = "info") {
    playNotification();
    const icons = {
      success: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>',
      error: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>',
      info: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
    };
    const notification = document.createElement("div");
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        ${icons[type] || icons.info}
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

  function getUserInitials(name, email) {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  }

  function UserAvatar({ src, name, email }) {
    const [imageError, setImageError] = useState(false);

    if (!src || imageError) {
      return (
        <div
          className="author-avatar flex items-center justify-center text-white font-semibold text-sm"
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
        className="author-avatar"
        onError={() => setImageError(true)}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              Prompt Library
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"} in this team
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary px-6 py-3 flex items-center gap-2"
          >
            {showCreateForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showCreateForm ? "Cancel" : "New Prompt"}</span>
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Create New Prompt
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Title *
              </label>
              <input
                type="text"
                placeholder="e.g., Blog Post Generator"
                className="form-input"
                value={newPrompt.title}
                onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Prompt Text *
              </label>
              <textarea
                placeholder="Enter your prompt here..."
                className="form-input min-h-[150px]"
                value={newPrompt.text}
                onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })}
                required
              />
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                {newPrompt.text.length} characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g., writing, creative, marketing"
                className="form-input"
                value={newPrompt.tags}
                onChange={(e) => setNewPrompt({ ...newPrompt, tags: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Visibility
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={newPrompt.visibility === "public"}
                    onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })}
                  />
                  <Unlock className="w-4 h-4" />
                  <span className="text-sm">Public</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={newPrompt.visibility === "private"}
                    onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })}
                  />
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Private</span>
                </label>
              </div>
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

      {/* Search & Filters */}
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
          onBulkDelete={async (ids) => {
            await Promise.all(ids.map((id) => deletePrompt(activeTeam, id)));
            setSelectedPrompts([]);
            showSuccessToast(`Deleted ${ids.length} prompts`);
          }}
          onBulkExport={(promptsToExport, format) => {
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
            showSuccessToast(`Exported ${promptsToExport.length} prompts`);
          }}
          userRole={userRole}
          userId={user.uid}
        />
      )}

      {/* Pagination */}
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
          <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            {pagination.isFiltered ? "No matching prompts" : "No prompts yet"}
          </h3>
          <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
            {pagination.isFiltered
              ? "Try adjusting your search filters"
              : "Create your first prompt to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagination.currentItems.map((prompt) => {
            const author = teamMembers[prompt.createdBy];
            const isExpanded = expandedPromptId === prompt.id;
            const isTextExpanded = expandedTextIds.has(prompt.id);
            const isPrivate = prompt.visibility === "private";
            const resultsCount = resultCounts[prompt.id] || 0;
            const shouldTruncate = prompt.text.length > 200;

            return (
              <div key={prompt.id} className="prompt-card-premium">
                {/* Author Info */}
                <div className="author-info">
                  <UserAvatar
                    src={author?.avatar}
                    name={author?.name}
                    email={author?.email}
                  />
                  <div className="author-details">
                    <div className="author-name">
                      {author?.name || author?.email || "Unknown"}
                    </div>
                    <div className="author-timestamp">{formatDate(prompt.createdAt)}</div>
                  </div>
                  <div className="ml-auto">
                    <span className={`visibility-badge ${isPrivate ? "private" : ""}`}>
                      {isPrivate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {isPrivate ? "Private" : "Public"}
                    </span>
                  </div>
                </div>

                {/* Title & Badge */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="prompt-title-premium flex-1">{prompt.title}</h3>
                  <EnhancedBadge
                    enhanced={prompt.enhanced}
                    enhancedFor={prompt.enhancedFor}
                    enhancementType={prompt.enhancementType}
                    size="md"
                    showDetails={true}
                  />
                </div>

                {/* Expandable Content Preview */}
                <div
                  className={`content-preview-box ${isTextExpanded ? 'expanded' : 'collapsed'}`}
                  style={{ cursor: 'default' }}
                >
                  <pre className="content-preview-text">
                    {isTextExpanded ? prompt.text : prompt.text.slice(0, 200)}
                    {!isTextExpanded && prompt.text.length > 200 && "..."}
                  </pre>
                  {shouldTruncate && (
                    <div 
                      className="expand-indicator"
                      onClick={() => handleTextExpansionWithTracking(prompt.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>{isTextExpanded ? "Click to collapse" : "Click to expand"}</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="prompt-metadata">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {prompt.stats?.views || 0} views
                  </span>
                  <span>•</span>
                  <span>{prompt.text.length} chars</span>
                  {resultsCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{resultsCount} results</span>
                    </>
                  )}
                </div>

                {/* Tags */}
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {prompt.tags.map((tag, index) => (
                      <span key={index} className="tag-chip-premium">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="primary-actions">
                    <button
                      onClick={() => handleCopy(prompt.text, prompt.id)}
                      className="action-btn-premium"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleExpand(prompt.id)}
                      className="action-btn-premium"
                      title={expandedPromptId === prompt.id ? "Collapse" : "Expand details"}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    <FavoriteButton
                      prompt={prompt}
                      teamId={activeTeam}
                      teamName={teamName}
                      size="small"
                      className="action-btn-premium primary"
                    />

                    {/* Kebab Menu */}
                    <div className="kebab-menu-container">
                      <button
                        onClick={() =>
                          setOpenKebabMenu(openKebabMenu === prompt.id ? null : prompt.id)
                        }
                        className="action-btn-premium"
                        title="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openKebabMenu === prompt.id && (
                        <div className="kebab-menu">
                          <button
                            onClick={() => handleAIEnhance(prompt)}
                            className="kebab-menu-item"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Enhance with AI</span>
                          </button>

                          {canChangeVisibility(prompt, user.uid, userRole) && (
                            <button
                              onClick={() => handleToggleVisibility(prompt.id)}
                              className="kebab-menu-item"
                            >
                              {isPrivate ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              <span>Make {isPrivate ? "Public" : "Private"}</span>
                            </button>
                          )}

                          {canEditPrompt(prompt) && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPrompt(prompt);
                                  setShowEditModal(true);
                                  setOpenKebabMenu(null);
                                }}
                                className="kebab-menu-item"
                              >
                                <Edit2 className="w-4 h-4" />
                                <span>Edit Prompt</span>
                              </button>

                              <button
                                onClick={() => handleDelete(prompt.id)}
                                className="kebab-menu-item danger"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="expandable-section expanded">
                    <div className="space-y-4 mt-6 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
                      <CompactAITools text={prompt.text} />

                      {/* Rating Section */}
                      <div className="glass-card p-4 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                        <RatingSection teamId={activeTeam} promptId={prompt.id} />
                      </div>

                      {/* Results Section */}
                      <div>
                        <button
                          onClick={() =>
                            setShowResults((prev) => ({ ...prev, [prompt.id]: !prev[prompt.id] }))
                          }
                          className="expand-toggle"
                        >
                          <span>
                            {showResults[prompt.id] ? "Hide" : "Show"} AI Output Results
                            {resultsCount > 0 && ` (${resultsCount})`}
                          </span>
                          <ChevronDown className={`w-4 h-4 ${showResults[prompt.id] ? "rotate-180" : ""}`} />
                        </button>

                        {showResults[prompt.id] && (
                          <div className="mt-4">
                            <PromptResults
                              key={`results-${prompt.id}`}
                              teamId={activeTeam}
                              promptId={prompt.id}
                              userRole={userRole}
                              onResultsChange={(count) => handleResultsChange(prompt.id, count)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Comments */}
                      <button
                        onClick={() =>
                          setShowComments((prev) => ({ ...prev, [prompt.id]: !prev[prompt.id] }))
                        }
                        className="expand-toggle"
                      >
                        <span>{showComments[prompt.id] ? "Hide" : "Show"} Comments</span>
                        <ChevronDown className={`w-4 h-4 ${showComments[prompt.id] ? "rotate-180" : ""}`} />
                      </button>

                      {showComments[prompt.id] && (
                        <Comments teamId={activeTeam} promptId={prompt.id} userRole={userRole} />
                      )}
                    </div>
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
        onImport={async (importedPrompts) => {
          let successCount = 0;
          for (const prompt of importedPrompts) {
            try {
              await savePrompt(user.uid, prompt, activeTeam);
              successCount++;
            } catch (error) {
              console.error("Import error:", error);
            }
          }
          if (successCount > 0) {
            showSuccessToast(`Imported ${successCount} prompts`);
          }
        }}
        teamId={activeTeam}
        teamName={teamName}
        userRole={userRole}
      />

      {/* Modals */}
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
