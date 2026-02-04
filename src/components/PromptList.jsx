// src/components/PromptList.jsx - ENHANCED VERSION with UI/UX Improvements
// Single column layout, improved mobile experience, better accessibility

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useGuestMode } from "../context/GuestModeContext";
import {
  savePrompt,
  updatePrompt as updatePromptFirestore,
  deletePrompt,
  togglePromptVisibility,
  canChangeVisibility,
  filterVisiblePrompts,
} from "../lib/prompts";
import { 
  getAllDemoPrompts, 
  isDemoPrompt, 
  duplicateDemoToUserPrompt,
  getPromptBadge,
  formatTimestamp,
} from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';
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
  Users,
  Search,
  Check,
  TrendingUp,
  Clock,
  Zap,
  HelpCircle,
  Filter,
  ChevronRight,
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

// Utility: Get relative time
function getRelativeTime(timestamp) {
  if (!timestamp) return "";
  
  try {
    let date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

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

// Copy Button with visual feedback
function CopyButton({ text, promptId, onCopy }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await onCopy(text, promptId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="action-btn-premium"
      title="Copy to clipboard"
      aria-label="Copy prompt to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

// Tooltip component
function Tooltip({ children, text }) {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="tooltip-container"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="tooltip-content">
          {text}
        </div>
      )}
    </div>
  );
}

export default function PromptList({ activeTeam, userRole, isGuestMode = false, userId }) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const { checkSaveRequired, canEditPrompt: canEditGuestPrompt } = useGuestMode();
  
  const [userPrompts, setUserPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const createFormRef = useRef(null);
  const listTopRef = useRef(null);

  // Check if first time user
  useEffect(() => {
    if (isGuestMode && userPrompts.length === 0) {
      const hasSeenTour = localStorage.getItem('hasSeenPromptTour');
      if (!hasSeenTour) {
        setShowTour(true);
        localStorage.setItem('hasSeenPromptTour', 'true');
      }
    }
  }, [isGuestMode, userPrompts.length]);

  // Get demo prompts
  const demos = useMemo(() => {
    if (isGuestMode && userPrompts.length === 0) {
      return getAllDemoPrompts();
    }
    return [];
  }, [isGuestMode, userPrompts.length]);

  // Load prompts
  useEffect(() => {
    if (isGuestMode) {
      setUserPrompts(guestState.getPrompts());
      setLoading(false);
      return;
    }

    if (!activeTeam || !user) {
      setUserPrompts([]);
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
        setUserPrompts(visiblePrompts);
        setFilteredPrompts(visiblePrompts);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading prompts:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activeTeam, user, userRole, isGuestMode]);

  // Search and filter with loading state
  const allPrompts = useMemo(() => {
    setSearchLoading(true);
    let combined = [...demos, ...userPrompts];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.text.toLowerCase().includes(query) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    // Apply category filter
    if (filterCategory !== 'all') {
      if (filterCategory === 'demos') {
        combined = combined.filter(p => isDemoPrompt(p));
      } else if (filterCategory === 'mine') {
        combined = combined.filter(p => !isDemoPrompt(p));
      } else if (filterCategory === 'enhanced') {
        combined = combined.filter(p => p.enhanced === true);
      } else if (filterCategory === 'recent') {
        combined = combined.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        }).slice(0, 10);
      }
    }
    
    setTimeout(() => setSearchLoading(false), 100);
    return combined;
  }, [demos, userPrompts, searchQuery, filterCategory]);

  const displayDemos = useMemo(() => 
    allPrompts.filter(p => isDemoPrompt(p)), 
    [allPrompts]
  );
  
  const displayUserPrompts = useMemo(() => 
    allPrompts.filter(p => !isDemoPrompt(p)), 
    [allPrompts]
  );

  // Pagination
  const pagination = usePagination(displayUserPrompts, 10);

  // Load team name
  useEffect(() => {
    async function loadTeamName() {
      if (!activeTeam || isGuestMode) {
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
  }, [activeTeam, isGuestMode]);

  // Load team members
  useEffect(() => {
    async function loadMembers() {
      if (!activeTeam || isGuestMode) return;

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
  }, [activeTeam, isGuestMode]);

  // Load viewed prompts
  useEffect(() => {
    async function loadViewedPrompts() {
      if (!activeTeam || !user?.uid || isGuestMode) return;
      
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
  }, [activeTeam, user?.uid, isGuestMode]);

  // Persist viewed prompts
  useEffect(() => {
    if (!activeTeam || !user?.uid || viewedPrompts.size === 0 || isGuestMode) return;
    
    try {
      const storageKey = `viewedPrompts_${user.uid}_${activeTeam}`;
      localStorage.setItem(storageKey, JSON.stringify([...viewedPrompts]));
    } catch (error) {
      console.error("Error saving viewed prompts:", error);
    }
  }, [viewedPrompts, activeTeam, user?.uid, isGuestMode]);

  // Close kebab menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (openKebabMenu && !event.target.closest('.kebab-menu-container')) {
        setOpenKebabMenu(null);
      }
      if (showFilterMenu && !event.target.closest('.filter-menu-wrapper')) {
        setShowFilterMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openKebabMenu, showFilterMenu]);

  // Scroll to top on page change
  useEffect(() => {
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pagination.currentPage]);

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

  const handleDuplicateDemo = (demoPrompt) => {
    const userPrompt = duplicateDemoToUserPrompt(demoPrompt);
    
    if (!userPrompt) {
      showNotification('Failed to duplicate demo', 'error');
      return;
    }
    
    checkSaveRequired('duplicate_demo', async () => {
      if (isGuestMode) {
        const savedPrompt = guestState.addPrompt(userPrompt);
        setUserPrompts(prev => [savedPrompt, ...prev]);
        showSuccessToast('Demo copied! Edit it however you like.');
        setEditingPrompt(savedPrompt);
        setShowEditModal(true);
      } else {
        try {
          await savePrompt(user.uid, userPrompt, activeTeam);
          showSuccessToast('Demo copied!');
        } catch (error) {
          console.error('Error saving duplicated prompt:', error);
          showNotification('Failed to save copied prompt', 'error');
        }
      }
      
      if (window.gtag) {
        window.gtag('event', 'demo_duplicated', {
          demo_id: demoPrompt.id,
          demo_title: demoPrompt.title,
          is_guest: isGuestMode,
        });
      }
    });
  };

  async function handleCreate(e) {
    e.preventDefault();
    if (!newPrompt.title.trim() || !newPrompt.text.trim()) {
      showNotification("Title and prompt text are required", "error");
      return;
    }

    try {
      if (isGuestMode) {
        const savedPrompt = guestState.addPrompt({
          title: newPrompt.title.trim(),
          text: newPrompt.text.trim(),
          tags: newPrompt.tags.split(",").map((t) => t.trim()).filter(Boolean),
          visibility: newPrompt.visibility,
        });
        setUserPrompts(prev => [savedPrompt, ...prev]);
        checkSaveRequired('create_prompt', () => {});
      } else {
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

        if (window.gtag) {
          window.gtag('event', 'prompt_created', {
            team_id: activeTeam,
            prompt_title: newPrompt.title.trim(),
            visibility: newPrompt.visibility,
            tags_count: newPrompt.tags.split(",").filter(Boolean).length,
          });
        }
      }

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
      if (isGuestMode) {
        guestState.updatePrompt(promptId, updates);
        setUserPrompts(prev => prev.map(p => 
          p.id === promptId ? { ...p, ...updates } : p
        ));
      } else {
        await updatePromptFirestore(activeTeam, promptId, updates);
      }
      
      setShowEditModal(false);
      setEditingPrompt(null);
      showSuccessToast("Prompt updated successfully!");
    } catch (error) {
      console.error("Error updating prompt:", error);
      showNotification("Failed to update prompt", "error");
    }
  }

  async function handleDelete(promptId) {
    const prompt = allPrompts.find((p) => p.id === promptId);
    if (!prompt) return;

    if (isGuestMode) {
      if (!canEditGuestPrompt(prompt)) {
        showNotification("Cannot delete this prompt", "error");
        return;
      }
    } else {
      if (
        prompt.createdBy !== user.uid &&
        userRole !== "owner" &&
        userRole !== "admin"
      ) {
        showNotification("You don't have permission to delete this prompt", "error");
        return;
      }
    }

    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      if (isGuestMode) {
        guestState.deletePrompt(promptId);
        setUserPrompts(prev => prev.filter(p => p.id !== promptId));
      } else {
        await deletePrompt(activeTeam, promptId);
      }
      
      showSuccessToast("Prompt deleted");
      setOpenKebabMenu(null);
    } catch (error) {
      console.error("Error deleting prompt:", error);
      showNotification("Failed to delete prompt", "error");
    }
  }

  async function handleToggleVisibility(promptId) {
    if (isGuestMode) {
      showNotification("Sign up to manage prompt visibility", "info");
      return;
    }

    const prompt = allPrompts.find((p) => p.id === promptId);
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
      
      if (!isGuestMode && activeTeam) {
        await trackPromptCopy(activeTeam, promptId);
      }
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      showNotification("Failed to copy", "error");
    }
  }

  async function handleExpand(promptId) {
    const isCurrentlyExpanded = expandedPromptId === promptId;
    setExpandedPromptId(isCurrentlyExpanded ? null : promptId);
  }

  async function handleTextExpansionWithTracking(promptId) {
    const isCurrentlyExpanded = expandedTextIds.has(promptId);
    const wasAlreadyExpanded = isCurrentlyExpanded;
    
    toggleTextExpansion(promptId);
    
    if (!isGuestMode && !wasAlreadyExpanded && !viewedPrompts.has(promptId)) {
      try {
        await trackPromptView(activeTeam, promptId);
        setViewedPrompts(prev => new Set([...prev, promptId]));
      } catch (error) {
        console.error("Error tracking view:", error);
      }
    }
  }

  function handleAIEnhance(prompt) {
    if (isGuestMode && isDemoPrompt(prompt)) {
      showNotification('Duplicate this demo first to enhance it', 'warning');
      return;
    }
    
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
    setOpenKebabMenu(null);
  }

  async function handleApplyAIEnhancement(enhancedPrompt) {
    try {
      if (isGuestMode) {
        guestState.updatePrompt(enhancedPrompt.id, {
          text: enhancedPrompt.text,
          title: enhancedPrompt.title,
        }, true);
        setUserPrompts(prev => prev.map(p => 
          p.id === enhancedPrompt.id ? { ...p, ...enhancedPrompt } : p
        ));
      } else {
        await updatePromptFirestore(activeTeam, enhancedPrompt.id, {
          text: enhancedPrompt.text,
          title: enhancedPrompt.title,
        });
      }
      
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
      if (isGuestMode) {
        const newPrompt = guestState.addPrompt({
          title: enhancedPrompt.title,
          text: enhancedPrompt.text,
          tags: Array.isArray(enhancedPrompt.tags) ? enhancedPrompt.tags : [],
          visibility: enhancedPrompt.visibility || "public",
        });
        setUserPrompts(prev => [newPrompt, ...prev]);
      } else {
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
      }
      
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
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
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
      info: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      warning: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
    };
    const notification = document.createElement("div");
    notification.setAttribute("role", "alert");
    notification.setAttribute("aria-live", "assertive");
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

  function canEditPrompt(prompt) {
    if (isGuestMode) {
      return canEditGuestPrompt(prompt);
    }
    
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
    const [imageLoaded, setImageLoaded] = useState(false);

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
      <div className="author-avatar-wrapper">
        {!imageLoaded && (
          <div className="author-avatar flex items-center justify-center" style={{ backgroundColor: "var(--muted)" }}>
            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        <img
          src={src}
          alt={`${name || email}'s avatar`}
          className={`author-avatar ${imageLoaded ? 'loaded' : 'loading'}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          style={{ display: imageLoaded ? 'block' : 'none' }}
        />
      </div>
    );
  }

  const renderPromptCard = (prompt) => {
    const badge = getPromptBadge(prompt, isGuestMode);
    const isDemo = isDemoPrompt(prompt);
    const canEdit = canEditPrompt(prompt);
    const author = teamMembers[prompt.createdBy];
    const isExpanded = expandedPromptId === prompt.id;
    const isTextExpanded = expandedTextIds.has(prompt.id);
    const isPrivate = prompt.visibility === "private";
    const resultsCount = resultCounts[prompt.id] || 0;
    const isViewed = viewedPrompts.has(prompt.id);
    const shouldTruncate = prompt.text.length > 150;
    const displayText = isTextExpanded ? prompt.text : prompt.text.slice(0, 150);
    const hasOutputs = resultsCount > 0;

    return (
      <div 
        key={prompt.id} 
        className={`prompt-card-premium single-column ${isViewed ? 'viewed' : 'unviewed'} ${hasOutputs ? 'has-outputs' : ''}`}
      >
        {/* Main Content Wrapper with Outputs Sidebar */}
        <div className="prompt-card-content-wrapper">
          {/* Left Sidebar - Outputs Indicator */}
          {!isDemo && hasOutputs && (
            <div className="outputs-sidebar">
              <div className="outputs-indicator">
                <div className="outputs-count">
                  <Zap className="w-4 h-4" />
                  <span className="count-text">{resultsCount}</span>
                </div>
                <div className="outputs-label">
                  Output{resultsCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* Main Card Content */}
          <div className="prompt-card-main-content">
            {/* Author Info */}
            {!isDemo && (
          <div className="author-info">
            <UserAvatar
              src={author?.avatar}
              name={author?.name}
              email={author?.email}
            />
            <div className="author-details">
              <div className="author-name">
                {isGuestMode ? "You" : (author?.name || author?.email || "Unknown")}
              </div>
              <div className="author-timestamp">
                <Clock className="w-3 h-3" />
                {getRelativeTime(prompt.createdAt)}
              </div>
            </div>
            {!isGuestMode && (
              <div className="ml-auto">
                <Tooltip text={isPrivate ? "Only you can see this" : "Visible to team members"}>
                  <span className={`visibility-badge ${isPrivate ? "private" : ""}`}>
                    {isPrivate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {isPrivate ? "Private" : "Public"}
                  </span>
                </Tooltip>
              </div>
            )}
          </div>
        )}

        {/* Badge for demo prompts */}
        {badge && (
          <div style={{ marginBottom: '0.75rem' }}>
            <span 
              className="visibility-badge demo-badge"
              style={{
                background: badge.type === 'demo' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                borderColor: badge.type === 'demo' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                color: badge.type === 'demo' ? 'rgba(139, 92, 246, 0.9)' : 'rgba(251, 191, 36, 0.9)',
              }}
            >
              {badge.icon} {badge.label}
            </span>
          </div>
        )}

        {/* Title & Enhancement Badge */}
        <div className="flex items-start justify-between mb-3 gap-3">
          <h3 className="prompt-title-premium flex-1">{prompt.title}</h3>
          {!isDemo && (
            <EnhancedBadge
              enhanced={prompt.enhanced}
              enhancedFor={prompt.enhancedFor}
              enhancementType={prompt.enhancementType}
              size="md"
              showDetails={true}
            />
          )}
        </div>

        {/* Expandable Content Preview */}
        <div
          className={`content-preview-box ${isTextExpanded ? 'expanded' : 'collapsed'}`}
          style={{ cursor: 'default' }}
        >
          <pre className="content-preview-text">
            {displayText}
            {!isTextExpanded && shouldTruncate && "..."}
          </pre>
        </div>
        {shouldTruncate && (
          <button
            className="expand-indicator-button"
            onClick={() => handleTextExpansionWithTracking(prompt.id)}
            aria-expanded={isTextExpanded}
            aria-label={isTextExpanded ? "Collapse prompt text" : "Expand prompt text"}
          >
            <span className="expand-text">
              {isTextExpanded ? "Show less" : "Read more"}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 ${isTextExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
        </div>

        {/* Enhanced Metadata with Icons */}
        <div className="prompt-metadata enhanced">
          {!isGuestMode && !isDemo && (
            <>
              <Tooltip text="Number of times this prompt has been viewed">
                <span className="flex items-center gap-1.5 metadata-item">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="metadata-value">{prompt.stats?.views || 0}</span>
                  <span className="metadata-label">views</span>
                </span>
              </Tooltip>
              <span className="metadata-separator">•</span>
            </>
          )}
          <Tooltip text="Character count">
            <span className="flex items-center gap-1.5 metadata-item">
              <FileText className="w-3.5 h-3.5" />
              <span className="metadata-value">{prompt.text.length}</span>
              <span className="metadata-label">chars</span>
            </span>
          </Tooltip>
          {!isDemo && resultsCount > 0 && (
            <>
              <span className="metadata-separator">•</span>
              <Tooltip text="Number of AI outputs saved">
                <span className="flex items-center gap-1.5 metadata-item">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="metadata-value">{resultsCount}</span>
                  <span className="metadata-label">outputs</span>
                </span>
              </Tooltip>
            </>
          )}
          {prompt.category && (
            <>
              <span className="metadata-separator">•</span>
              <Tooltip text="Prompt category">
                <span className="flex items-center gap-1.5 metadata-item">
                  <Users className="w-3.5 h-3.5" />
                  <span className="metadata-label">{prompt.category}</span>
                </span>
              </Tooltip>
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
        <div className="flex items-center justify-between pt-4 border-t action-bar" style={{ borderColor: "var(--border)" }}>
          <div className="primary-actions">
            {isDemo ? (
              <>
                <Tooltip text="Copy prompt to clipboard">
                  <CopyButton 
                    text={prompt.text} 
                    promptId={prompt.id}
                    onCopy={handleCopy}
                  />
                </Tooltip>
                
                {shouldTruncate && (
                  <Tooltip text={isTextExpanded ? "Show less" : "Read full prompt"}>
                    <button
                      onClick={() => handleTextExpansionWithTracking(prompt.id)}
                      className="action-btn-premium"
                      aria-expanded={isTextExpanded}
                      aria-label={isTextExpanded ? "Collapse prompt text" : "Expand full prompt"}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
                
                <Tooltip text="Create your own editable copy">
                  <button 
                    onClick={() => handleDuplicateDemo(prompt)}
                    className="action-btn-premium primary make-own-btn"
                    aria-label="Make your own copy of this demo"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="btn-label">Make My Own</span>
                  </button>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip text="Copy to clipboard">
                  <CopyButton 
                    text={prompt.text} 
                    promptId={prompt.id}
                    onCopy={handleCopy}
                  />
                </Tooltip>

                <Tooltip text={isExpanded ? "Hide details" : "Show full details"}>
                  <button
                    onClick={() => handleExpand(prompt.id)}
                    className="action-btn-premium"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </Tooltip>

                {!isGuestMode && (
                  <Tooltip text="Add to favorites">
                    <FavoriteButton
                      prompt={prompt}
                      teamId={activeTeam}
                      teamName={teamName}
                      size="small"
                      className="action-btn-premium primary"
                    />
                  </Tooltip>
                )}

                {/* Kebab Menu */}
                <div className="kebab-menu-container">
                  <Tooltip text="More options">
                    <button
                      onClick={() =>
                        setOpenKebabMenu(openKebabMenu === prompt.id ? null : prompt.id)
                      }
                      className="action-btn-premium"
                      aria-label="More actions"
                      aria-expanded={openKebabMenu === prompt.id}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </Tooltip>

                  {openKebabMenu === prompt.id && (
                    <div className="kebab-menu" role="menu">
                      <button
                        onClick={() => handleAIEnhance(prompt)}
                        className="kebab-menu-item"
                        role="menuitem"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Enhance with AI</span>
                      </button>

                      {!isGuestMode && canChangeVisibility(prompt, user.uid, userRole) && (
                        <button
                          onClick={() => handleToggleVisibility(prompt.id)}
                          className="kebab-menu-item"
                          role="menuitem"
                        >
                          {isPrivate ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          <span>Make {isPrivate ? "Public" : "Private"}</span>
                        </button>
                      )}

                      {canEdit && (
                        <>
                          <button
                            onClick={() => {
                              setEditingPrompt(prompt);
                              setShowEditModal(true);
                              setOpenKebabMenu(null);
                            }}
                            className="kebab-menu-item"
                            role="menuitem"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span>Edit Prompt</span>
                          </button>

                          <button
                            onClick={() => handleDelete(prompt.id)}
                            className="kebab-menu-item danger"
                            role="menuitem"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {!isDemo && isExpanded && (
          <div className="expandable-section expanded">
            <div className="space-y-4 mt-6 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
              {!isGuestMode && (
                <>
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
                      aria-expanded={showResults[prompt.id]}
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
                    aria-expanded={showComments[prompt.id]}
                  >
                    <span>{showComments[prompt.id] ? "Hide" : "Show"} Comments</span>
                    <ChevronDown className={`w-4 h-4 ${showComments[prompt.id] ? "rotate-180" : ""}`} />
                  </button>

                  {showComments[prompt.id] && (
                    <Comments teamId={activeTeam} promptId={prompt.id} userRole={userRole} />
                  )}
                </>
              )}
              
              {isGuestMode && (
                <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    Sign up to access AI tools, ratings, results tracking, and comments.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      
    );
  };

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
    <div className="space-y-6 mobile-prompt-list-container" ref={listTopRef}>
      <style jsx>{`
        /* Single Column Layout */
        .prompt-card-premium.single-column {
          max-width: 100%;
          margin: 0 auto 1.5rem;
        }

        /* Outputs Sidebar Layout */
        .prompt-card-content-wrapper {
          display: flex;
          gap: 0;
          position: relative;
        }

        .outputs-sidebar {
          width: 80px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 1.5rem 0;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08));
          border-right: 2px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px 0 0 12px;
          position: relative;
        }

        .outputs-sidebar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%);
          pointer-events: none;
        }

        .outputs-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          z-index: 1;
        }

        .outputs-count {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, var(--primary), rgba(139, 92, 246, 0.8));
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
          color: white;
          font-weight: 700;
          font-size: 1.125rem;
          position: relative;
          overflow: hidden;
        }

        .outputs-count::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.1));
        }

        .outputs-count .w-4 {
          width: 1rem;
          height: 1rem;
        }

        .count-text {
          font-size: 1.25rem;
          line-height: 1;
        }

        .outputs-label {
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary);
          text-align: center;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          margin-top: 0.5rem;
        }

        .prompt-card-main-content {
          flex: 1;
          min-width: 0;
        }

        .prompt-card-premium.has-outputs .prompt-card-main-content {
          padding-left: 1.5rem;
        }

        @media (max-width: 769px) {
          .outputs-sidebar {
            width: 60px;
            padding: 1rem 0;
          }

          .outputs-count {
            width: 40px;
            height: 40px;
            font-size: 0.875rem;
          }

          .count-text {
            font-size: 1rem;
          }

          .outputs-label {
            font-size: 0.563rem;
          }

          .prompt-card-premium.has-outputs .prompt-card-main-content {
            padding-left: 1rem;
          }
        }

        /* Improved Touch Targets for Mobile */
        @media (max-width: 769px) {
          .mobile-prompt-list-container .action-btn-premium {
            width: 44px !important;
            height: 44px !important;
            min-width: 44px;
            min-height: 44px;
          }

          .mobile-prompt-list-container .primary-actions {
            gap: 0.5rem;
          }
        }

        /* Improved Text Preview */
        .expand-indicator-button {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          margin-top: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--primary);
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .expand-indicator-button:hover {
          background: rgba(139, 92, 246, 0.1);
          color: var(--primary);
        }

        .expand-indicator-button:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        
        .expand-indicator-button svg {
          transition: transform 0.2s;
        }

        /* Enhanced Metadata Styling */
        .prompt-metadata.enhanced {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          font-size: 0.813rem;
          color: var(--muted-foreground);
          padding: 0.75rem 0;
        }

        .metadata-item {
          cursor: help;
          transition: color 0.2s;
        }

        .metadata-item:hover {
          color: var(--foreground);
        }

        .metadata-value {
          font-weight: 600;
          color: var(--foreground);
        }

        .metadata-label {
          color: var(--muted-foreground);
        }

        .metadata-separator {
          color: var(--border);
        }

        /* Tooltip Styling */
        .tooltip-container {
          position: relative;
          display: inline-block;
        }

        .tooltip-content {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--popover);
          color: var(--popover-foreground);
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.75rem;
          white-space: nowrap;
          z-index: 1000;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          pointer-events: none;
        }

        .tooltip-content::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: var(--border);
        }

        /* Viewed/Unviewed Indicator */
        .prompt-card-premium.unviewed {
          border-left: 3px solid var(--primary);
        }

        .prompt-card-premium.viewed {
          opacity: 0.95;
        }

        /* Demo Badge Enhancement */
        .demo-badge {
          font-weight: 600;
          letter-spacing: 0.025em;
        }

        /* Make My Own Button */
        .make-own-btn {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)));
          color: white;
          font-weight: 600;
          padding: 0 1rem !important;
          width: auto !important;
        }

        .make-own-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .btn-label {
          font-size: 0.875rem;
        }

        @media (max-width: 640px) {
          .btn-label {
            display: none;
          }
          
          .make-own-btn {
            padding: 0 !important;
            width: 44px !important;
          }
        }

        /* Avatar Loading State */
        .author-avatar-wrapper {
          position: relative;
        }

        .author-avatar.loading {
          opacity: 0;
        }

        .author-avatar.loaded {
          opacity: 1;
          transition: opacity 0.3s;
        }

        /* Improved Action Bar */
        .action-bar {
          margin-top: 1rem;
        }

        /* Filter Menu */
        .filter-menu-wrapper {
          position: relative;
          display: inline-block;
        }

        .filter-menu {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background: var(--popover);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          z-index: 100;
          min-width: 200px;
          padding: 0.5rem;
        }
        
        @media (max-width: 640px) {
          .filter-menu {
            right: auto;
            left: 0;
          }
        }

        .filter-menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 0.875rem;
          color: var(--foreground);
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }

        .filter-menu-item:hover {
          background: var(--accent);
        }

        .filter-menu-item.active {
          background: var(--primary);
          color: white;
        }

        /* Search Loading Indicator */
        .search-loading {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
        }

        /* Improved Kebab Menu for Mobile */
        @media (max-width: 769px) {
          .kebab-menu {
            right: 0;
            left: auto;
            min-width: 200px;
          }
        }

        /* Welcome Tour */
        .tour-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .tour-content {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .tour-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: var(--foreground);
        }

        .tour-text {
          color: var(--muted-foreground);
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }

        .tour-features {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
        }

        .tour-feature {
          display: flex;
          align-items: start;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: var(--muted);
          border-radius: 8px;
        }

        .tour-feature-icon {
          flex-shrink: 0;
          color: var(--primary);
        }

        .tour-feature-text {
          color: var(--foreground);
          font-size: 0.875rem;
        }

        /* Accessibility Improvements */
        .action-btn-premium:focus-visible,
        .expand-toggle:focus-visible,
        button:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        /* Loading State for Search */
        .search-input-wrapper {
          position: relative;
        }

        /* Mobile Responsiveness */
        @media (max-width: 769px) {
          .mobile-prompt-list-container .glass-card {
            padding: 1.25rem !important;
          }

          .mobile-prompt-list-container .prompt-card-premium {
            padding: 1.25rem !important;
          }

          .mobile-prompt-list-container .prompt-title-premium {
            font-size: 1.125rem !important;
            line-height: 1.4;
          }

          .mobile-prompt-list-container .content-preview-box {
            padding: 1rem !important;
            font-size: 0.875rem !important;
          }

          .mobile-prompt-list-container .author-timestamp {
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      {/* Welcome Tour for First Time Users */}
      {showTour && (
        <div className="tour-overlay" onClick={() => setShowTour(false)}>
          <div className="tour-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="tour-title">Welcome to Prompt Library! 🎉</h2>
            <p className="tour-text">
              Get started with these demo prompts and learn how to create your own.
            </p>
            <ul className="tour-features">
              <li className="tour-feature">
                <Sparkles className="w-5 h-5 tour-feature-icon" />
                <span className="tour-feature-text">
                  <strong>Try demos:</strong> Click "Make My Own" to create an editable copy
                </span>
              </li>
              <li className="tour-feature">
                <Copy className="w-5 h-5 tour-feature-icon" />
                <span className="tour-feature-text">
                  <strong>Copy quickly:</strong> Use the copy button to grab any prompt
                </span>
              </li>
              <li className="tour-feature">
                <Plus className="w-5 h-5 tour-feature-icon" />
                <span className="tour-feature-text">
                  <strong>Create your own:</strong> Click "New Prompt" to build from scratch
                </span>
              </li>
            </ul>
            <button 
              onClick={() => setShowTour(false)}
              className="btn-primary w-full"
            >
              Got it, let's start!
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {isGuestMode 
                ? `${displayDemos.length} demos • ${displayUserPrompts.length} your prompts`
                : `${displayUserPrompts.length} ${displayUserPrompts.length === 1 ? "prompt" : "prompts"} in this team`
              }
            </p>
          </div>

          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              if (!showCreateForm && createFormRef.current) {
                setTimeout(() => {
                  createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }
            }}
            className="btn-primary px-6 py-3 flex items-center gap-2"
            aria-label={showCreateForm ? "Cancel creating prompt" : "Create new prompt"}
          >
            {showCreateForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showCreateForm ? "Cancel" : "New Prompt"}</span>
          </button>
        </div>

        {/* Universal Search and Filter */}
        {allPrompts.length > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="search-input-wrapper flex-1 min-w-0" style={{ position: 'relative' }}>
              <Search 
                size={18} 
                style={{ 
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-foreground)',
                }}
              />
              <input
                type="text"
                placeholder="Search prompts by title, content, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ paddingLeft: '2.5rem' }}
                aria-label="Search prompts"
              />
              {searchLoading && (
                <div className="search-loading">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="filter-menu-wrapper">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="btn-secondary px-4 py-3 flex items-center gap-2"
                aria-label="Filter prompts"
                aria-expanded={showFilterMenu}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>

              {showFilterMenu && (
                <div className="filter-menu" role="menu">
                  <button
                    onClick={() => {
                      setFilterCategory('all');
                      setShowFilterMenu(false);
                    }}
                    className={`filter-menu-item ${filterCategory === 'all' ? 'active' : ''}`}
                    role="menuitem"
                  >
                    <FileText className="w-4 h-4" />
                    <span>All Prompts</span>
                  </button>
                  {isGuestMode && displayDemos.length > 0 && (
                    <button
                      onClick={() => {
                        setFilterCategory('demos');
                        setShowFilterMenu(false);
                      }}
                      className={`filter-menu-item ${filterCategory === 'demos' ? 'active' : ''}`}
                      role="menuitem"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Demo Prompts</span>
                    </button>
                  )}
                  {displayUserPrompts.length > 0 && (
                    <button
                      onClick={() => {
                        setFilterCategory('mine');
                        setShowFilterMenu(false);
                      }}
                      className={`filter-menu-item ${filterCategory === 'mine' ? 'active' : ''}`}
                      role="menuitem"
                    >
                      <Users className="w-4 h-4" />
                      <span>My Prompts</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFilterCategory('enhanced');
                      setShowFilterMenu(false);
                    }}
                    className={`filter-menu-item ${filterCategory === 'enhanced' ? 'active' : ''}`}
                    role="menuitem"
                  >
                    <Zap className="w-4 h-4" />
                    <span>AI Enhanced</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilterCategory('recent');
                      setShowFilterMenu(false);
                    }}
                    className={`filter-menu-item ${filterCategory === 'recent' ? 'active' : ''}`}
                    role="menuitem"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Recent</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="glass-card p-6" ref={createFormRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Create New Prompt
            </h3>
            {isGuestMode && (
              <Tooltip text="Your prompts are saved locally until you sign up">
                <HelpCircle className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              </Tooltip>
            )}
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Title <span style={{ color: "var(--destructive)" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Blog Post Generator"
                className="form-input"
                value={newPrompt.title}
                onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                required
                aria-required="true"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Prompt Text <span style={{ color: "var(--destructive)" }}>*</span>
              </label>
              <textarea
                placeholder="Enter your prompt here... Be specific and clear for best results."
                className="form-input min-h-[150px]"
                value={newPrompt.text}
                onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })}
                required
                aria-required="true"
              />
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                {newPrompt.text.length} characters • Aim for 50-500 for best results
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

            {!isGuestMode && (
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
                    <span className="text-sm">Public - Team can see</span>
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
                    <span className="text-sm">Private - Only you</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button type="submit" className="btn-primary px-6 py-2 flex-1">
                <Plus className="w-4 h-4" />
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

      {/* Demo Section */}
      {displayDemos.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            marginBottom: '1.5rem',
            padding: '0 0.5rem',
          }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: 'var(--foreground)',
              margin: 0,
            }}>
              Try These Examples
            </h3>
            <span style={{ 
              fontSize: '0.875rem',
              color: 'var(--muted-foreground)',
              background: 'rgba(139, 92, 246, 0.1)',
              padding: '0.25rem 0.625rem',
              borderRadius: '6px',
            }}>
              {displayDemos.length} demos
            </span>
          </div>
          <div>
            {displayDemos.map(renderPromptCard)}
          </div>
        </section>
      )}

      {/* User Prompts Section */}
      {displayUserPrompts.length > 0 && (
        <>
          {!isGuestMode && displayUserPrompts.length > 10 && (
            <PaginationControls
              pagination={pagination}
              showPageSizeSelector={true}
              showSearch={false}
            />
          )}

          <section>
            {isGuestMode && displayDemos.length > 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                marginBottom: '1.5rem',
                padding: '0 0.5rem',
              }}>
                <FileText size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: 'var(--foreground)',
                  margin: 0,
                }}>
                  Your Prompts
                </h3>
                <Tooltip text="These prompts are saved locally. Sign up to save them permanently.">
                  <span style={{ 
                    fontSize: '0.75rem',
                    color: 'rgba(251, 191, 36, 0.9)',
                    background: 'rgba(251, 191, 36, 0.1)',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    cursor: help,
                  }}>
                    <AlertCircle className="w-3 h-3" />
                    {displayUserPrompts.length} unsaved
                  </span>
                </Tooltip>
              </div>
            )}
            
            <div>
              {isGuestMode 
                ? displayUserPrompts.map(renderPromptCard)
                : pagination.currentItems.map(renderPromptCard)
              }
            </div>
          </section>

          {!isGuestMode && displayUserPrompts.length > 10 && (
            <PaginationControls
              pagination={pagination}
              showPageSizeSelector={false}
              showSearch={false}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {allPrompts.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Sparkles size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            {searchQuery ? "No prompts found" : "No prompts yet"}
          </h3>
          <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
            {searchQuery 
              ? `No prompts match "${searchQuery}". Try a different search term or adjust your filters.`
              : isGuestMode 
                ? "Create your first prompt to get started! Or try our demo prompts above." 
                : "Create your first prompt to start building your library."
            }
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="btn-secondary"
              >
                Clear Search
              </button>
            )}
            {filterCategory !== 'all' && (
              <button 
                onClick={() => setFilterCategory('all')}
                className="btn-secondary"
              >
                Clear Filter
              </button>
            )}
            {!searchQuery && filterCategory === 'all' && (
              <button 
                onClick={() => {
                  setShowCreateForm(true);
                  setTimeout(() => {
                    createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="btn-primary"
              >
                <Plus size={18} />
                Create First Prompt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Advanced Features (Authenticated Users Only) */}
      {!isGuestMode && displayUserPrompts.length > 0 && (
        <>
          <AdvancedSearch
            prompts={userPrompts}
            onFilteredResults={handleFilteredResults}
            teamMembers={teamMembers}
          />

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
        </>
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
