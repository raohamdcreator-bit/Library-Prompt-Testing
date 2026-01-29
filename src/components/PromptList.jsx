// src/components/PromptList.jsx - Mobile-Responsive Version
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { isDemoPrompt, duplicateDemoPrompt } from '../lib/guestDemoContent';
import { 
  getDemoPrompts, 
  updateDemoPrompt, 
  deleteDemoPrompt,
  trackDemoInteraction 
} from '../lib/demoPromptManager';
import { useGuestMode } from '../context/GuestModeContext';
import PropTypes from 'prop-types';

// Constants
const TRUNCATE_LENGTH = 50;
const TOAST_DURATION = 3000;
const DEFAULT_PAGE_SIZE = 10;

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

RatingSection.propTypes = {
  teamId: PropTypes.string,
  promptId: PropTypes.string.isRequired,
};

// User Avatar Component
function UserAvatar({ src, name, email }) {
  const [imageError, setImageError] = useState(false);

  const getUserInitials = useCallback((name, email) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  }, []);

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

UserAvatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  email: PropTypes.string,
};

export default function PromptList({ activeTeam, userRole, isGuestMode = false, userId }) {
  const { user } = useAuth();
  const { triggerSaveModal, canEditPrompt: canEditAsGuest, canDeletePrompt: canDeleteAsGuest } = useGuestMode();
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

  // Use ref for kebab menu to avoid unnecessary re-renders
  const kebabMenuRef = useRef(null);

  const pagination = usePagination(filteredPrompts, DEFAULT_PAGE_SIZE);

  // Determine effective user ID
  const effectiveUserId = useMemo(() => {
    return userId || user?.uid || (isGuestMode ? 'guest' : null);
  }, [userId, user?.uid, isGuestMode]);

  // Load prompts (with demo support for guests)
  useEffect(() => {
    // ✅ GUEST MODE: Load demo prompts from sessionStorage
    if (isGuestMode && !activeTeam) {
      try {
        const demoPrompts = getDemoPrompts();
        setPrompts(demoPrompts);
        setFilteredPrompts(demoPrompts);
      } catch (error) {
        console.error("Error loading demo prompts:", error);
        setPrompts([]);
        setFilteredPrompts([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ✅ AUTHENTICATED: Load from Firestore
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
        try {
          const data = snap.docs.map((d) => ({
            id: d.id,
            teamId: activeTeam,
            ...d.data(),
          }));

          const uniqueData = Array.from(
            new Map(data.map((item) => [item.id, item])).values()
          );

          const visiblePrompts = filterVisiblePrompts(uniqueData, effectiveUserId, userRole);
          setPrompts(visiblePrompts);
          setFilteredPrompts(visiblePrompts);
        } catch (error) {
          console.error("Error processing prompts:", error);
          setPrompts([]);
          setFilteredPrompts([]);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error loading prompts:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activeTeam, effectiveUserId, userRole, isGuestMode]);

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
        } else {
          setTeamName("Unknown Team");
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
            console.error(`Error loading member profile ${memberId}:`, error);
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
      if (!activeTeam || !effectiveUserId) return;
      
      try {
        const storageKey = `viewedPrompts_${effectiveUserId}_${activeTeam}`;
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
  }, [activeTeam, effectiveUserId]);

  // Persist viewed prompts to localStorage
  useEffect(() => {
    if (!activeTeam || !effectiveUserId || viewedPrompts.size === 0) return;
    
    try {
      const storageKey = `viewedPrompts_${effectiveUserId}_${activeTeam}`;
      localStorage.setItem(storageKey, JSON.stringify([...viewedPrompts]));
    } catch (error) {
      console.error("Error saving viewed prompts:", error);
    }
  }, [viewedPrompts, activeTeam, effectiveUserId]);

  // Close kebab menu when clicking outside - optimized with single listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (openKebabMenu !== null && !event.target.closest('.kebab-menu-container')) {
        setOpenKebabMenu(null);
      }
    }

    if (openKebabMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openKebabMenu]);

  const handleFilteredResults = useCallback((filtered) => {
    setFilteredPrompts(filtered);
  }, []);

  const handleResultsChange = useCallback((promptId, count) => {
    setResultCounts((prev) => {
      if (prev[promptId] === count) return prev;
      return { ...prev, [promptId]: count };
    });
  }, []);

  const toggleTextExpansion = useCallback((promptId) => {
    setExpandedTextIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        newSet.add(promptId);
      }
      return newSet;
    });
  }, []);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    
    // Validate input
    if (!newPrompt.title.trim() || !newPrompt.text.trim()) {
      showNotification("Title and prompt text are required", "error");
      return;
    }

    // ✅ GUEST MODE: Check if guest is trying to save
    if (isGuestMode) {
      const newPromptData = {
        title: newPrompt.title.trim(),
        text: newPrompt.text.trim(),
        tags: newPrompt.tags.split(",").map((t) => t.trim()).filter(Boolean),
        visibility: newPrompt.visibility,
        isDemo: false,
        owner: 'guest',
      };
      
      // Trigger signup modal and stop here
      triggerSaveModal(newPromptData);
      return; // Guest must sign up first
    }
    
    // ✅ AUTHENTICATED: Save to Firestore
    try {
      await savePrompt(
        effectiveUserId,
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
      
      // Analytics tracking
      if (window.gtag) {
        window.gtag('event', 'prompt_created', {
          team_id: activeTeam,
          prompt_title: newPrompt.title.trim(),
          visibility: newPrompt.visibility,
          tags_count: newPrompt.tags.split(",").filter(Boolean).length,
        });
      }
    } catch (error) {
      console.error("Error creating prompt:", error);
      showNotification("Failed to create prompt", "error");
    }
  }, [newPrompt, isGuestMode, effectiveUserId, activeTeam, triggerSaveModal]);

  const handleUpdate = useCallback(async (promptId, updates) => {
    try {
      const prompt = prompts.find(p => p.id === promptId);
      
      if (!prompt) {
        showNotification("Prompt not found", "error");
        return;
      }
      
      // ✅ DEMO PROMPT: Update in sessionStorage only
      if (isDemoPrompt(prompt)) {
        try {
          updateDemoPrompt(promptId, updates);
          trackDemoInteraction('edited', promptId);
          
          // Refresh demo prompts
          const updatedDemos = getDemoPrompts();
          setPrompts(updatedDemos);
          setFilteredPrompts(updatedDemos);
          
          setShowEditModal(false);
          setEditingPrompt(null);
          showSuccessToast("Demo prompt updated (changes are temporary)");
        } catch (error) {
          console.error("Error updating demo prompt:", error);
          showNotification("Failed to update demo prompt", "error");
        }
        return;
      }
      
      // ✅ USER PROMPT: Update in Firestore
      await updatePrompt(activeTeam, promptId, updates);
      setShowEditModal(false);
      setEditingPrompt(null);
      showSuccessToast("Prompt updated successfully!");
    } catch (error) {
      console.error("Error updating prompt:", error);
      showNotification("Failed to update prompt", "error");
    }
  }, [prompts, activeTeam]);

  const handleDelete = useCallback(async (promptId) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) {
      showNotification("Prompt not found", "error");
      return;
    }

    // ✅ DEMO PROMPT: Delete from sessionStorage
    if (isDemoPrompt(prompt)) {
      if (!confirm("Remove this demo prompt? (It will be restored on page refresh)")) return;
      
      try {
        deleteDemoPrompt(promptId);
        trackDemoInteraction('deleted', promptId);
        
        // Refresh demo prompts
        const updatedDemos = getDemoPrompts();
        setPrompts(updatedDemos);
        setFilteredPrompts(updatedDemos);
        
        showSuccessToast("Demo prompt removed (temporary)");
        setOpenKebabMenu(null);
        return;
      } catch (error) {
        console.error("Error deleting demo prompt:", error);
        showNotification("Failed to remove demo prompt", "error");
        return;
      }
    }

    // ✅ USER PROMPT: Permission check
    if (
      prompt.createdBy !== effectiveUserId &&
      userRole !== "owner" &&
      userRole !== "admin"
    ) {
      showNotification("You don't have permission to delete this prompt", "error");
      return;
    }

    if (!confirm("Are you sure you want to delete this prompt?")) return;

    // ✅ Delete from Firestore
    try {
      await deletePrompt(activeTeam, promptId);
      showSuccessToast("Prompt deleted");
      setOpenKebabMenu(null);
    } catch (error) {
      console.error("Error deleting prompt:", error);
      showNotification("Failed to delete prompt", "error");
    }
  }, [prompts, effectiveUserId, userRole, activeTeam]);

  const handleToggleVisibility = useCallback(async (promptId) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) {
      showNotification("Prompt not found", "error");
      return;
    }

    // Check permissions (using optional chaining for safety)
    if (!canChangeVisibility(prompt, effectiveUserId, userRole)) {
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
  }, [prompts, effectiveUserId, userRole, activeTeam]);

  const handleCopy = useCallback(async (text, promptId) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Copied to clipboard!");
      
      const prompt = prompts.find(p => p.id === promptId);
      
      // ✅ Track demo interaction
      if (prompt && isDemoPrompt(prompt)) {
        trackDemoInteraction('copied', promptId);
      } else if (activeTeam && promptId) {
        // ✅ Track user prompt stats
        try {
          await trackPromptCopy(activeTeam, promptId);
        } catch (error) {
          console.error("Error tracking copy:", error);
          // Don't show error to user for tracking failures
        }
      }
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      showNotification("Failed to copy", "error");
    }
  }, [prompts, activeTeam]);

  const handleExpand = useCallback((promptId) => {
    setExpandedPromptId(prev => prev === promptId ? null : promptId);
  }, []);

  const handleTextExpansionWithTracking = useCallback(async (promptId) => {
    const isCurrentlyExpanded = expandedTextIds.has(promptId);
    
    // Toggle text expansion
    toggleTextExpansion(promptId);
    
    // Only track view if expanding and not already viewed
    if (!isCurrentlyExpanded && !viewedPrompts.has(promptId) && activeTeam) {
      try {
        await trackPromptView(activeTeam, promptId);
        // Mark this prompt as viewed
        setViewedPrompts(prev => new Set([...prev, promptId]));
      } catch (error) {
        console.error("Error tracking view:", error);
        // Don't show error to user for tracking failures
      }
    }
  }, [expandedTextIds, viewedPrompts, activeTeam, toggleTextExpansion]);

  const handleAIEnhance = useCallback((prompt) => {
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
    setOpenKebabMenu(null);
  }, []);

  const handleApplyAIEnhancement = useCallback(async (enhancedPrompt) => {
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
  }, [activeTeam]);

  const handleSaveAIAsNew = useCallback(async (enhancedPrompt) => {
    try {
      await savePrompt(
        effectiveUserId,
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
  }, [effectiveUserId, activeTeam]);

  const handleDuplicateDemo = useCallback((prompt) => {
    try {
      const duplicated = duplicateDemoPrompt(prompt, effectiveUserId);
      setNewPrompt({
        title: duplicated.title,
        text: duplicated.text,
        tags: duplicated.tags.join(", "),
        visibility: duplicated.visibility || "public",
      });
      setShowCreateForm(true);
      setOpenKebabMenu(null);
      showSuccessToast("Demo copied to create form. Click 'Create' to save your version!");
    } catch (error) {
      console.error("Error duplicating demo:", error);
      showNotification("Failed to duplicate demo prompt", "error");
    }
  }, [effectiveUserId]);

  function showSuccessToast(message) {
    playNotification();
    const toast = document.createElement("div");
    toast.className = "success-toast";
    
    const icon = document.createElement("div");
    icon.className = "success-icon";
    icon.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    `;
    
    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, TOAST_DURATION);
  }

  function showNotification(message, type = "info") {
    playNotification();
    
    const icons = {
      success: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>',
      error: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>',
      info: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
    };
    
    const notification = document.createElement("div");
    const iconDiv = document.createElement("div");
    iconDiv.className = "flex items-center gap-2";
    iconDiv.innerHTML = icons[type] || icons.info;
    
    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;
    
    iconDiv.appendChild(messageSpan);
    notification.appendChild(iconDiv);
    
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
    }, TOAST_DURATION);
  }

  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return "";
    try {
      // Handle both Firestore timestamps and regular Date objects
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  }, []);

  const canEditPrompt = useCallback((prompt) => {
    if (!prompt) return false;
    
    // ✅ Demo prompts can be edited by anyone (changes are ephemeral)
    if (isDemoPrompt(prompt)) {
      return true;
    }
    
    // ✅ Guest mode check
    if (isGuestMode) {
      return canEditAsGuest(prompt);
    }
    
    // ✅ User prompts require ownership or admin role
    return (
      prompt.createdBy === effectiveUserId ||
      userRole === "owner" ||
      userRole === "admin"
    );
  }, [effectiveUserId, userRole, isGuestMode, canEditAsGuest]);

  const canDeletePrompt = useCallback((prompt) => {
    if (!prompt) return false;
    
    // ✅ Demo prompts can be deleted by anyone
    if (isDemoPrompt(prompt)) {
      return true;
    }
    
    // ✅ Guest mode check
    if (isGuestMode) {
      return canDeleteAsGuest(prompt);
    }
    
    // ✅ User prompts require ownership or admin role
    return (
      prompt.createdBy === effectiveUserId ||
      userRole === "owner" ||
      userRole === "admin"
    );
  }, [effectiveUserId, userRole, isGuestMode, canDeleteAsGuest]);

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
    <div className="space-y-6 mobile-prompt-list-container">
      <style jsx>{`
        /* Mobile-only styles - ONLY activate below 770px */
        @media (max-width: 769px) {
          .mobile-prompt-list-container .glass-card {
            padding: 1rem !important;
            border-radius: 12px !important;
          }

          .mobile-prompt-list-container .prompt-card-premium {
            padding: 1rem !important;
            margin-bottom: 1rem !important;
          }

          .mobile-prompt-list-container .author-info {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .mobile-prompt-list-container .author-avatar {
            width: 32px !important;
            height: 32px !important;
          }

          .mobile-prompt-list-container .prompt-title-premium {
            font-size: 1rem !important;
            line-height: 1.3;
          }

          .mobile-prompt-list-container .content-preview-box {
            padding: 0.75rem !important;
            font-size: 0.813rem !important;
          }

          .mobile-prompt-list-container .prompt-metadata {
            font-size: 0.688rem !important;
            flex-wrap: wrap;
          }

          .mobile-prompt-list-container .tag-chip-premium {
            font-size: 0.688rem !important;
            padding: 0.188rem 0.5rem !important;
          }

          .mobile-prompt-list-container .primary-actions {
            flex-wrap: wrap;
            gap: 0.375rem;
          }

          .mobile-prompt-list-container .action-btn-premium {
            width: 36px !important;
            height: 36px !important;
          }

          .mobile-prompt-list-container .visibility-badge {
            font-size: 0.688rem !important;
            padding: 0.188rem 0.5rem !important;
          }

          .mobile-prompt-list-container .expand-indicator {
            font-size: 0.688rem !important;
          }

          /* Header mobile adjustments */
          .mobile-prompt-list-container > .glass-card:first-child h2 {
            font-size: 1.5rem !important;
          }

          .mobile-prompt-list-container > .glass-card:first-child .flex {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 1rem;
          }

          .mobile-prompt-list-container > .glass-card:first-child button {
            width: 100%;
            justify-content: center;
          }

          /* Create form mobile */
          .mobile-prompt-list-container .space-y-4 > div > label {
            font-size: 0.875rem !important;
          }

          .mobile-prompt-list-container .form-input {
            font-size: 0.875rem !important;
            padding: 0.625rem !important;
          }

          .mobile-prompt-list-container textarea.form-input {
            min-height: 120px !important;
          }

          /* Expanded content mobile */
          .mobile-prompt-list-container .expandable-section {
            padding: 0.75rem !important;
          }

          .mobile-prompt-list-container .expand-toggle {
            font-size: 0.813rem !important;
            padding: 0.5rem !important;
          }

          /* Empty state mobile */
          .mobile-prompt-list-container .glass-card svg.w-16 {
            width: 3rem !important;
            height: 3rem !important;
          }

          .mobile-prompt-list-container .glass-card p.text-lg {
            font-size: 1rem !important;
          }

          /* Kebab menu mobile positioning */
          .mobile-prompt-list-container .kebab-menu {
            right: 0;
            left: auto;
            min-width: 180px !important;
          }
        }
      `}</style>

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
            {isGuestMode 
              ? "Welcome to Prism!" 
              : pagination.isFiltered 
                ? "No matching prompts" 
                : "No prompts yet"}
          </h3>
          <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
            {isGuestMode
              ? "Explore demo prompts above or create your own. Sign up to save your work!"
              : pagination.isFiltered
                ? "Try adjusting your search filters"
                : "Create your first prompt to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagination.currentItems.map((prompt) => {
            const author = teamMembers[prompt.createdBy] || {};
            const isExpanded = expandedPromptId === prompt.id;
            const isTextExpanded = expandedTextIds.has(prompt.id);
            const isPrivate = prompt.visibility === "private";
            const resultsCount = resultCounts[prompt.id] || 0;
            const shouldTruncate = prompt.text.length >= TRUNCATE_LENGTH;

            return (
              <div key={prompt.id} className="prompt-card-premium">
                {/* Author Info */}
                <div className="author-info">
                  <UserAvatar
                    src={author.avatar}
                    name={author.name}
                    email={author.email}
                  />
                  <div className="author-details">
                    <div className="author-name">
                      {author.name || author.email || "Unknown"}
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
                  {isDemoPrompt(prompt) && (
                    <span 
                      className="visibility-badge"
                      style={{
                        background: 'rgba(139, 92, 246, 0.15)',
                        borderColor: 'var(--primary)',
                        color: 'var(--primary)',
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      Demo
                    </span>
                  )}
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
                    {isTextExpanded ? prompt.text : prompt.text.slice(0, TRUNCATE_LENGTH)}
                    {!isTextExpanded && prompt.text.length >= TRUNCATE_LENGTH && "..."}
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

                    {activeTeam && (
                      <FavoriteButton
                        prompt={prompt}
                        teamId={activeTeam}
                        teamName={teamName}
                        size="small"
                        className="action-btn-premium primary"
                      />
                    )}

                    {/* Kebab Menu */}
                    <div className="kebab-menu-container" ref={kebabMenuRef}>
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
                          {/* ✅ Duplicate Demo Button */}
                          {isDemoPrompt(prompt) && (
                            <button
                              onClick={() => handleDuplicateDemo(prompt)}
                              className="kebab-menu-item"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Duplicate as My Own</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleAIEnhance(prompt)}
                            className="kebab-menu-item"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Enhance with AI</span>
                          </button>

                          {!isDemoPrompt(prompt) && canChangeVisibility(prompt, effectiveUserId, userRole) && (
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

                      {/* Rating Section - only for non-demo prompts with team */}
                      {!isDemoPrompt(prompt) && activeTeam && (
                        <div className="glass-card p-4 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                          <RatingSection teamId={activeTeam} promptId={prompt.id} />
                        </div>
                      )}

                      {/* Results Section - only for non-demo prompts with team */}
                      {!isDemoPrompt(prompt) && activeTeam && (
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
                      )}

                      {/* Comments - only for non-demo prompts with team */}
                      {!isDemoPrompt(prompt) && activeTeam && (
                        <>
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
                        </>
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
      
      {/* Search & Filters */}
      <AdvancedSearch
        prompts={prompts}
        onFilteredResults={handleFilteredResults}
        teamMembers={teamMembers}
      />

      {/* Bulk Operations - only for authenticated users */}
      {!isGuestMode && prompts.length > 0 && effectiveUserId && (
        <BulkOperations
          prompts={filteredPrompts}
          selectedPrompts={selectedPrompts}
          onSelectionChange={setSelectedPrompts}
          onBulkDelete={async (ids) => {
            try {
              await Promise.all(ids.map((id) => deletePrompt(activeTeam, id)));
              setSelectedPrompts([]);
              showSuccessToast(`Deleted ${ids.length} prompts`);
            } catch (error) {
              console.error("Error in bulk delete:", error);
              showNotification("Failed to delete some prompts", "error");
            }
          }}
          onBulkExport={(promptsToExport, format) => {
            try {
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
                default:
                  throw new Error("Unknown export format");
              }
              showSuccessToast(`Exported ${promptsToExport.length} prompts`);
            } catch (error) {
              console.error("Error exporting prompts:", error);
              showNotification("Failed to export prompts", "error");
            }
          }}
          userRole={userRole}
          userId={effectiveUserId}
        />
      )}

      {/* Import/Export - only for authenticated users */}
      {!isGuestMode && activeTeam && effectiveUserId && (
        <ExportImport
          onImport={async (importedPrompts) => {
            let successCount = 0;
            let errorCount = 0;
            
            for (const prompt of importedPrompts) {
              try {
                await savePrompt(effectiveUserId, prompt, activeTeam);
                successCount++;
              } catch (error) {
                console.error("Import error:", error);
                errorCount++;
              }
            }
            
            if (successCount > 0) {
              showSuccessToast(`Imported ${successCount} prompts`);
            }
            if (errorCount > 0) {
              showNotification(`Failed to import ${errorCount} prompts`, "error");
            }
          }}
          teamId={activeTeam}
          teamName={teamName}
          userRole={userRole}
        />
      )}

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


