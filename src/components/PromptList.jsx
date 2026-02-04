// src/components/PromptList.jsx - OPTIMIZED VERSION
// Enhanced mobile responsiveness, accessibility, and user experience

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

function getUserInitials(name, email) {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
}

// ============================================================================
// CHILD COMPONENTS
// ============================================================================

// Rating Section Component
function RatingSection({ teamId, promptId }) {
  const { userRating, averageRating, totalRatings, ratePrompt, loading } = 
    usePromptRating(teamId, promptId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="spinner-sm" />
        <span className="text-xs text-muted">Loading ratings...</span>
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
          <span className="text-sm font-medium">
            {userRating ? "Your Rating" : "Rate this prompt"}
          </span>
        </div>
      </div>
      
      {totalRatings > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4" fill="#fbbf24" color="#fbbf24" />
            <span className="font-semibold text-foreground">
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
      className="action-btn"
      title="Copy to clipboard"
      aria-label="Copy prompt to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-success" />
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
      className="tooltip-wrapper"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="tooltip" role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
}

// User Avatar Component
function UserAvatar({ src, name, email }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!src || imageError) {
    return (
      <div className="avatar avatar-initials">
        {getUserInitials(name, email)}
      </div>
    );
  }

  return (
    <div className="avatar-container">
      {!imageLoaded && (
        <div className="avatar avatar-loading">
          <div className="spinner-sm" />
        </div>
      )}
      <img
        src={src}
        alt={`${name || email}'s avatar`}
        className={`avatar ${imageLoaded ? 'loaded' : 'loading'}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  );
}

// Welcome Tour Component
function WelcomeTour({ onClose }) {
  return (
    <div className="tour-overlay" onClick={onClose}>
      <div className="tour-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="tour-title">Welcome to Prompt Library! 🎉</h2>
        <p className="tour-description">
          Get started with these demo prompts and learn how to create your own.
        </p>
        <ul className="tour-list">
          <li className="tour-item">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <strong>Try demos:</strong> Click "Make My Own" to create an editable copy
            </div>
          </li>
          <li className="tour-item">
            <Copy className="w-5 h-5 text-primary" />
            <div>
              <strong>Copy quickly:</strong> Use the copy button to grab any prompt
            </div>
          </li>
          <li className="tour-item">
            <Plus className="w-5 h-5 text-primary" />
            <div>
              <strong>Create your own:</strong> Click "New Prompt" to build from scratch
            </div>
          </li>
        </ul>
        <button onClick={onClose} className="btn-primary w-full">
          Got it, let's start!
        </button>
      </div>
    </div>
  );
}

// Filter Menu Component
function FilterMenu({ currentFilter, onFilterChange, onClose, isGuestMode, hasUserPrompts, hasDemos }) {
  const filters = [
    { id: 'all', label: 'All Prompts', icon: FileText },
    ...(isGuestMode && hasDemos ? [{ id: 'demos', label: 'Demo Prompts', icon: Sparkles }] : []),
    ...(hasUserPrompts ? [{ id: 'mine', label: 'My Prompts', icon: Users }] : []),
    { id: 'enhanced', label: 'AI Enhanced', icon: Zap },
    { id: 'recent', label: 'Recent', icon: Clock },
  ];

  return (
    <div className="filter-menu" role="menu">
      {filters.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => {
            onFilterChange(id);
            onClose();
          }}
          className={`filter-menu-item ${currentFilter === id ? 'active' : ''}`}
          role="menuitem"
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PromptList({ activeTeam, userRole, isGuestMode = false, userId }) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const { checkSaveRequired, canEditPrompt: canEditGuestPrompt } = useGuestMode();
  
  // State Management
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
  
  // Refs
  const createFormRef = useRef(null);
  const listTopRef = useRef(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

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

  // Search and filter
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

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (openKebabMenu && !event.target.closest('.kebab-container')) {
        setOpenKebabMenu(null);
      }
      if (showFilterMenu && !event.target.closest('.filter-wrapper')) {
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

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

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
    toast.className = "toast toast-success";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `
      <div class="toast-icon">
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
    notification.className = `toast toast-${type}`;
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

  // ============================================================================
  // RENDER PROMPT CARD
  // ============================================================================

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
        className={`prompt-card ${isViewed ? 'viewed' : 'unviewed'} ${hasOutputs ? 'has-outputs' : ''}`}
      >
        {/* Outputs Sidebar */}
        {!isDemo && hasOutputs && (
          <div className="outputs-sidebar">
            <div className="outputs-indicator">
              <div className="outputs-badge">
                <Zap className="w-4 h-4" />
                <span>{resultsCount}</span>
              </div>
              <div className="outputs-label">Outputs</div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="prompt-content">
          {/* Author Info */}
          {!isDemo && (
            <div className="author-section">
              <UserAvatar
                src={author?.avatar}
                name={author?.name}
                email={author?.email}
              />
              <div className="author-info">
                <div className="author-name">
                  {isGuestMode ? "You" : (author?.name || author?.email || "Unknown")}
                </div>
                <div className="author-meta">
                  <Clock className="w-3 h-3" />
                  {getRelativeTime(prompt.createdAt)}
                </div>
              </div>
              {!isGuestMode && (
                <Tooltip text={isPrivate ? "Only you can see this" : "Visible to team members"}>
                  <span className={`visibility-badge ${isPrivate ? "private" : ""}`}>
                    {isPrivate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {isPrivate ? "Private" : "Public"}
                  </span>
                </Tooltip>
              )}
            </div>
          )}

          {/* Demo Badge */}
          {badge && (
            <div className="badge-container">
              <span className={`badge badge-${badge.type}`}>
                {badge.icon} {badge.label}
              </span>
            </div>
          )}

          {/* Title & Enhancement Badge */}
          <div className="title-section">
            <h3 className="prompt-title">{prompt.title}</h3>
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

          {/* Expandable Text Preview */}
          <div className={`text-preview ${isTextExpanded ? 'expanded' : 'collapsed'}`}>
            <pre className="text-content">
              {displayText}
              {!isTextExpanded && shouldTruncate && "..."}
            </pre>
          </div>
          
          {shouldTruncate && (
            <button
              className="expand-btn"
              onClick={() => handleTextExpansionWithTracking(prompt.id)}
              aria-expanded={isTextExpanded}
              aria-label={isTextExpanded ? "Show less" : "Show more"}
            >
              <span>{isTextExpanded ? "Show less" : "Read more"}</span>
              <ChevronDown className={`w-3.5 h-3.5 ${isTextExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Metadata */}
          <div className="metadata">
            {!isGuestMode && !isDemo && (
              <>
                <Tooltip text="Views">
                  <span className="metadata-item">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{prompt.stats?.views || 0}</span>
                  </span>
                </Tooltip>
                <span className="separator">•</span>
              </>
            )}
            <Tooltip text="Characters">
              <span className="metadata-item">
                <FileText className="w-3.5 h-3.5" />
                <span>{prompt.text.length}</span>
              </span>
            </Tooltip>
            {!isDemo && resultsCount > 0 && (
              <>
                <span className="separator">•</span>
                <Tooltip text="Outputs">
                  <span className="metadata-item">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{resultsCount}</span>
                  </span>
                </Tooltip>
              </>
            )}
          </div>

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="tags">
              {prompt.tags.map((tag, index) => (
                <span key={index} className="tag">#{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="actions">
            {isDemo ? (
              <>
                <Tooltip text="Copy to clipboard">
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
                      className="action-btn"
                      aria-expanded={isTextExpanded}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
                
                <Tooltip text="Create your own copy">
                  <button 
                    onClick={() => handleDuplicateDemo(prompt)}
                    className="action-btn action-btn-primary"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="btn-text">Make My Own</span>
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

                <Tooltip text={isExpanded ? "Hide details" : "Show details"}>
                  <button
                    onClick={() => handleExpand(prompt.id)}
                    className="action-btn"
                    aria-expanded={isExpanded}
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
                      className="action-btn"
                    />
                  </Tooltip>
                )}

                {/* Kebab Menu */}
                <div className="kebab-container">
                  <Tooltip text="More options">
                    <button
                      onClick={() => setOpenKebabMenu(openKebabMenu === prompt.id ? null : prompt.id)}
                      className="action-btn"
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
                        className="kebab-item"
                        role="menuitem"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Enhance with AI</span>
                      </button>

                      {!isGuestMode && canChangeVisibility(prompt, user.uid, userRole) && (
                        <button
                          onClick={() => handleToggleVisibility(prompt.id)}
                          className="kebab-item"
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
                            className="kebab-item"
                            role="menuitem"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span>Edit Prompt</span>
                          </button>

                          <button
                            onClick={() => handleDelete(prompt.id)}
                            className="kebab-item danger"
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

          {/* Expanded Content */}
          {!isDemo && isExpanded && (
            <div className="expanded-content">
              {!isGuestMode ? (
                <>
                  <CompactAITools text={prompt.text} />

                  <div className="rating-card">
                    <RatingSection teamId={activeTeam} promptId={prompt.id} />
                  </div>

                  <div>
                    <button
                      onClick={() => setShowResults((prev) => ({ ...prev, [prompt.id]: !prev[prompt.id] }))}
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
                      <div className="results-container">
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

                  <button
                    onClick={() => setShowComments((prev) => ({ ...prev, [prompt.id]: !prev[prompt.id] }))}
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
              ) : (
                <div className="guest-notice">
                  <p>Sign up to access AI tools, ratings, results tracking, and comments.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

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
    <div className="prompt-list-container" ref={listTopRef}>
      <style jsx>{`
        /* ============================================================================
           GLOBAL STYLES
           ============================================================================ */
        
        .prompt-list-container {
          --spacing-xs: 0.25rem;
          --spacing-sm: 0.5rem;
          --spacing-md: 1rem;
          --spacing-lg: 1.5rem;
          --spacing-xl: 2rem;
          --radius-sm: 6px;
          --radius-md: 8px;
          --radius-lg: 12px;
          --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
          --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
          --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.2);
        }

        /* ============================================================================
           UTILITY CLASSES
           ============================================================================ */

        .text-foreground { color: var(--foreground); }
        .text-muted { color: var(--muted-foreground); }
        .text-primary { color: var(--primary); }
        .text-success { color: #10b981; }
        .bg-card { background: var(--card); }
        .bg-muted { background: var(--muted); }
        .border-color { border-color: var(--border); }

        .spinner-sm {
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ============================================================================
           LAYOUT
           ============================================================================ */

        .glass-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          box-shadow: var(--shadow-sm);
        }

        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }

        /* ============================================================================
           PROMPT CARD
           ============================================================================ */

        .prompt-card {
          display: flex;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          margin-bottom: var(--spacing-lg);
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
        }

        .prompt-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .prompt-card.unviewed {
          border-left: 3px solid var(--primary);
        }

        .prompt-card.viewed {
          opacity: 0.95;
        }

        /* Outputs Sidebar */
        .outputs-sidebar {
          width: 80px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: var(--spacing-lg) 0;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08));
          border-right: 2px solid rgba(139, 92, 246, 0.2);
          position: relative;
        }

        .outputs-sidebar::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%);
          pointer-events: none;
        }

        .outputs-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm);
          position: relative;
          z-index: 1;
        }

        .outputs-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, var(--primary), rgba(139, 92, 246, 0.8));
          border-radius: var(--radius-lg);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
          color: white;
          font-weight: 700;
          font-size: 1.125rem;
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
          margin-top: var(--spacing-sm);
        }

        /* Main Content */
        .prompt-content {
          flex: 1;
          padding: var(--spacing-lg);
          min-width: 0;
        }

        /* Author Section */
        .author-section {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .avatar-container {
          position: relative;
          width: 40px;
          height: 40px;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-initials {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--primary);
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .avatar-loading {
          background: var(--muted);
        }

        .avatar.loading {
          opacity: 0;
          position: absolute;
        }

        .avatar.loaded {
          opacity: 1;
          transition: opacity 0.3s;
        }

        .author-info {
          flex: 1;
          min-width: 0;
        }

        .author-name {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--foreground);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .author-meta {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: var(--muted-foreground);
          margin-top: 0.125rem;
        }

        .visibility-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 500;
          background: rgba(139, 92, 246, 0.1);
          color: var(--primary);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .visibility-badge.private {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* Badge */
        .badge-container {
          margin-bottom: var(--spacing-md);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.025em;
        }

        .badge-demo {
          background: rgba(139, 92, 246, 0.1);
          color: rgba(139, 92, 246, 0.9);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .badge-featured {
          background: rgba(251, 191, 36, 0.1);
          color: rgba(251, 191, 36, 0.9);
          border: 1px solid rgba(251, 191, 36, 0.2);
        }

        /* Title */
        .title-section {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .prompt-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--foreground);
          line-height: 1.4;
          flex: 1;
          min-width: 0;
        }

        /* Text Preview */
        .text-preview {
          margin-bottom: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--muted);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }

        .text-content {
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--foreground);
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
        }

        .expand-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          margin-bottom: var(--spacing-md);
          padding: 0.375rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--primary);
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .expand-btn:hover {
          background: rgba(139, 92, 246, 0.1);
        }

        .expand-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        .expand-btn svg {
          transition: transform 0.2s;
        }

        /* Metadata */
        .metadata {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          flex-wrap: wrap;
          font-size: 0.813rem;
          color: var(--muted-foreground);
          margin-bottom: var(--spacing-md);
        }

        .metadata-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          cursor: help;
          transition: color 0.2s;
        }

        .metadata-item:hover {
          color: var(--foreground);
        }

        .separator {
          color: var(--border);
        }

        /* Tags */
        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .tag {
          padding: 0.25rem 0.625rem;
          background: rgba(139, 92, 246, 0.1);
          color: var(--primary);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 500;
        }

        /* Actions */
        .actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border);
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 40px;
          height: 40px;
          padding: 0;
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--foreground);
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: var(--accent);
          transform: translateY(-1px);
        }

        .action-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        .action-btn-primary {
          background: linear-gradient(135deg, var(--primary), rgba(139, 92, 246, 0.8));
          color: white;
          border-color: transparent;
          padding: 0 var(--spacing-md);
          width: auto;
          font-weight: 600;
        }

        .action-btn-primary:hover {
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .btn-text {
          font-size: 0.875rem;
        }

        /* Kebab Menu */
        .kebab-container {
          position: relative;
        }

        .kebab-menu {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background: var(--popover);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 100;
          min-width: 200px;
          padding: 0.5rem;
        }

        .kebab-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: 0.75rem var(--spacing-md);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 0.2s;
          font-size: 0.875rem;
          color: var(--foreground);
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }

        .kebab-item:hover {
          background: var(--accent);
        }

        .kebab-item.danger {
          color: #ef4444;
        }

        .kebab-item.danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Expanded Content */
        .expanded-content {
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .rating-card {
          padding: var(--spacing-md);
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .expand-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--spacing-md);
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--foreground);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .expand-toggle:hover {
          background: var(--accent);
        }

        .expand-toggle svg {
          transition: transform 0.2s;
        }

        .results-container {
          margin-top: var(--spacing-md);
        }

        .guest-notice {
          padding: var(--spacing-md);
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--muted-foreground);
          font-size: 0.875rem;
        }

        /* ============================================================================
           TOOLTIP
           ============================================================================ */

        .tooltip-wrapper {
          position: relative;
          display: inline-block;
        }

        .tooltip {
          position: absolute;
          bottom: calc(100% + 0.5rem);
          left: 50%;
          transform: translateX(-50%);
          padding: 0.5rem 0.75rem;
          background: var(--popover);
          color: var(--popover-foreground);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          white-space: nowrap;
          z-index: 1000;
          box-shadow: var(--shadow-md);
          pointer-events: none;
        }

        .tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: var(--border);
        }

        /* ============================================================================
           TOAST NOTIFICATIONS
           ============================================================================ */

        .toast {
          position: fixed;
          top: 1rem;
          right: 1rem;
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-lg);
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 9999;
          font-size: 0.875rem;
          transition: opacity 0.3s;
          max-width: 400px;
        }

        .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
        }

        .toast-success {
          border-left: 4px solid #10b981;
        }

        .toast-success .toast-icon {
          color: #10b981;
        }

        .toast-error {
          border-left: 4px solid #ef4444;
        }

        .toast-error .toast-icon {
          color: #ef4444;
        }

        .toast-info {
          border-left: 4px solid var(--primary);
        }

        .toast-info .toast-icon {
          color: var(--primary);
        }

        .toast-warning {
          border-left: 4px solid #f59e0b;
        }

        .toast-warning .toast-icon {
          color: #f59e0b;
        }

        /* ============================================================================
           TOUR
           ============================================================================ */

        .tour-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-md);
        }

        .tour-content {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          max-width: 500px;
          width: 100%;
          box-shadow: var(--shadow-lg);
        }

        .tour-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: var(--spacing-md);
          color: var(--foreground);
        }

        .tour-description {
          color: var(--muted-foreground);
          margin-bottom: var(--spacing-lg);
          line-height: 1.6;
        }

        .tour-list {
          list-style: none;
          padding: 0;
          margin: var(--spacing-lg) 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .tour-item {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--muted);
          border-radius: var(--radius-md);
        }

        /* ============================================================================
           FILTER MENU
           ============================================================================ */

        .filter-wrapper {
          position: relative;
          display: inline-block;
        }

        .filter-menu {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background: var(--popover);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 100;
          min-width: 200px;
          padding: 0.5rem;
        }

        .filter-menu-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: 0.75rem var(--spacing-md);
          border-radius: var(--radius-sm);
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

        /* ============================================================================
           BUTTONS
           ============================================================================ */

        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-primary:hover {
          background: rgba(139, 92, 246, 0.9);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          padding: 0.75rem 1.5rem;
          background: var(--muted);
          color: var(--foreground);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-secondary:hover {
          background: var(--accent);
        }

        /* ============================================================================
           FORMS
           ============================================================================ */

        .form-input {
          width: 100%;
          padding: 0.75rem;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--foreground);
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem;
          padding-left: 2.5rem;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--foreground);
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        /* ============================================================================
           SKELETON LOADING
           ============================================================================ */

        .skeleton-card {
          height: 200px;
          background: linear-gradient(
            90deg,
            var(--muted) 0%,
            var(--accent) 50%,
            var(--muted) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: var(--radius-lg);
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ============================================================================
           RESPONSIVE DESIGN
           ============================================================================ */

        @media (max-width: 768px) {
          .outputs-sidebar {
            width: 60px;
            padding: var(--spacing-md) 0;
          }

          .outputs-badge {
            width: 40px;
            height: 40px;
            font-size: 0.875rem;
          }

          .outputs-label {
            font-size: 0.563rem;
          }

          .prompt-content {
            padding: var(--spacing-md);
          }

          .prompt-title {
            font-size: 1.125rem;
          }

          .text-preview {
            padding: var(--spacing-sm);
          }

          .text-content {
            font-size: 0.813rem;
          }

          .action-btn {
            width: 44px;
            height: 44px;
          }

          .btn-text {
            display: none;
          }

          .action-btn-primary {
            width: 44px;
            padding: 0;
          }

          .filter-menu {
            right: auto;
            left: 0;
          }

          .kebab-menu {
            right: auto;
            left: 0;
          }

          .tour-content {
            padding: var(--spacing-lg);
          }

          .tour-title {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .outputs-sidebar {
            display: none;
          }

          .prompt-card {
            flex-direction: column;
          }

          .actions {
            flex-wrap: wrap;
          }
        }

        /* ============================================================================
           ACCESSIBILITY
           ============================================================================ */

        *:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Welcome Tour */}
      {showTour && <WelcomeTour onClose={() => setShowTour(false)} />}

      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </h2>
            <p className="text-sm text-muted">
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
            className="btn-primary"
            aria-label={showCreateForm ? "Cancel" : "Create new prompt"}
          >
            {showCreateForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showCreateForm ? "Cancel" : "New Prompt"}</span>
          </button>
        </div>

        {/* Search and Filter */}
        {allPrompts.length > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="flex-1 min-w-0" style={{ position: 'relative' }}>
              <Search 
                size={18} 
                style={{ 
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-foreground)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                aria-label="Search prompts"
              />
              {searchLoading && (
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="spinner-sm" />
                </div>
              )}
            </div>

            <div className="filter-wrapper">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="btn-secondary"
                aria-label="Filter prompts"
                aria-expanded={showFilterMenu}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                <ChevronDown className={`w-4 h-4 ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>

              {showFilterMenu && (
                <FilterMenu
                  currentFilter={filterCategory}
                  onFilterChange={setFilterCategory}
                  onClose={() => setShowFilterMenu(false)}
                  isGuestMode={isGuestMode}
                  hasUserPrompts={displayUserPrompts.length > 0}
                  hasDemos={displayDemos.length > 0}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="glass-card" ref={createFormRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Create New Prompt</h3>
            {isGuestMode && (
              <Tooltip text="Saved locally until you sign up">
                <HelpCircle className="w-5 h-5 text-muted" />
              </Tooltip>
            )}
          </div>
          
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Title <span style={{ color: '#ef4444' }}>*</span>
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
              <label className="block text-sm font-medium mb-2 text-foreground">
                Prompt Text <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                placeholder="Enter your prompt here..."
                className="form-input min-h-[150px]"
                value={newPrompt.text}
                onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })}
                required
              />
              <p className="text-xs mt-1 text-muted">
                {newPrompt.text.length} characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
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
                <label className="block text-sm font-medium mb-2 text-foreground">
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
            )}

            <div className="flex gap-3 pt-4">
              <button type="submit" className="btn-primary flex-1">
                <Plus className="w-4 h-4" />
                Create Prompt
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Demo Section */}
      {displayDemos.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6 px-2">
            <Sparkles size={20} className="text-primary" />
            <h3 className="text-xl font-semibold text-foreground">
              Try These Examples
            </h3>
            <span className="badge badge-demo">
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
              <div className="flex items-center gap-3 mb-6 px-2">
                <FileText size={20} className="text-primary" />
                <h3 className="text-xl font-semibold text-foreground">
                  Your Prompts
                </h3>
                <Tooltip text="Saved locally. Sign up to save permanently.">
                  <span className="badge badge-featured">
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
        <div className="glass-card text-center" style={{ padding: '3rem 1.5rem' }}>
          <Sparkles size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
          <h3 className="text-lg font-semibold mb-2 text-foreground">
            {searchQuery ? "No prompts found" : "No prompts yet"}
          </h3>
          <p className="mb-6 text-muted">
            {searchQuery 
              ? `No prompts match "${searchQuery}"`
              : isGuestMode 
                ? "Create your first prompt to get started!" 
                : "Create your first prompt to start building your library."
            }
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="btn-secondary">
                Clear Search
              </button>
            )}
            {filterCategory !== 'all' && (
              <button onClick={() => setFilterCategory('all')} className="btn-secondary">
                Clear Filter
              </button>
            )}
            {!searchQuery && filterCategory === 'all' && (
              <button 
                onClick={() => {
                  setShowCreateForm(true);
                  setTimeout(() => {
                    createFormRef.current?.scrollIntoView({ behavior: 'smooth' });
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

      {/* Advanced Features */}
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
