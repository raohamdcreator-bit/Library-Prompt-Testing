// src/components/PromptList.jsx - COMPLETE FIXED VERSION
// ✅ All 8 issues resolved

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../lib/firebase";
import { trackPromptCopy } from "../lib/promptStats";
import { updateCommentCount } from "../lib/promptStats";
import {
  collection, onSnapshot, query, orderBy, getDoc, doc,
  addDoc, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useGuestMode } from "../context/GuestModeContext";
import {
  savePrompt, updatePrompt as updatePromptFirestore,
  deletePrompt, togglePromptVisibility, filterVisiblePrompts,
} from "../lib/prompts";
import { 
  getAllDemoPrompts, isDemoPrompt, duplicateDemoToUserPrompt, getPromptBadge,
} from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';
import { subscribeToResults } from "../lib/results";
import {
  Plus, X, Sparkles, Copy, Edit2, Trash2, ChevronDown,
  MoreVertical, Lock, Unlock, Eye, Star, FileText, Search,
  Check, Clock, Filter, MessageSquare, Activity, Code,
  Image as ImageIcon, Send, Loader2, Cpu, DollarSign,
  Target, TrendingUp,
} from "lucide-react";
import EditPromptModal from "./EditPromptModal";
import EnhancedBadge from './EnhancedBadge';
import { ExportUtils } from "./ExportImport";
import AIPromptEnhancer from "./AIPromptEnhancer";
import AddResultModal from "./AddResultModal";
import { usePromptRating } from "./PromptAnalytics";
import { useSoundEffects } from '../hooks/useSoundEffects';
import { TokenEstimator, AI_MODELS } from "./AIModelTools";
import BulkOperations, { PromptSelector } from "./BulkOperations";

// Utility functions
function getRelativeTime(timestamp) {
  if (!timestamp) return "";
  try {
    let date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function getUserInitials(name, email) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return "U";
}

// User Avatar Component
function UserAvatar({ src, name, email, size = "sm" }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const sizeClasses = { sm: "w-6 h-6 text-xs", md: "w-8 h-8 text-sm" };

  if (!src || imageError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold`}
           style={{ backgroundColor: "var(--primary)" }}>
        {getUserInitials(name, email)}
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center`} 
             style={{ backgroundColor: "var(--muted)" }}>
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      )}
      <img src={src} alt={`${name || email}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-border/50 ${imageLoaded ? 'block' : 'hidden'}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </>
  );
}

// Copy Button Component
function CopyButton({ text, promptId, onCopy }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await onCopy(text, promptId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="btn-action-secondary">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

// ✅ FIXED: Output Preview with 120px truncation
function OutputPreviewPanel({ outputs, onViewAll }) {
  if (!outputs || outputs.length === 0) {
    return (
      <div className="output-preview-panel-empty">
        <FileText className="w-5 h-5 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">No outputs yet</p>
        <button onClick={onViewAll} className="text-xs text-primary hover:underline mt-1">
          Attach first output
        </button>
      </div>
    );
  }

  const latestOutput = outputs[0];
  const getOutputIcon = (type) => {
    switch (type) {
      case 'text': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'code': return <Code className="w-4 h-4 text-purple-400" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-pink-400" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="output-preview-panel" onClick={onViewAll} role="button" tabIndex={0}>
      <div className="output-preview-header">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="output-preview-label">Latest Output</span>
        </div>
        <span className="output-count-badge">{outputs.length} Output{outputs.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="output-preview-content" style={{ maxHeight: '120px', overflow: 'hidden' }}>
        {latestOutput.type === 'text' && (
          <div className="output-text-preview">
            {getOutputIcon('text')}
            <div className="flex-1 min-w-0">
              <p className="output-preview-title truncate">{latestOutput.title}</p>
              <p className="truncate-2-lines text-sm">{latestOutput.content}</p>
            </div>
          </div>
        )}
        {latestOutput.type === 'code' && (
          <div className="output-code-preview">
            {getOutputIcon('code')}
            <div className="flex-1 min-w-0">
              <p className="output-preview-title truncate">{latestOutput.title}</p>
              <pre className="code-snippet" style={{ maxHeight: '80px', overflow: 'hidden' }}>
                {latestOutput.content.slice(0, 100)}...
              </pre>
            </div>
          </div>
        )}
        {latestOutput.type === 'image' && latestOutput.imageUrl && (
          <div className="output-image-preview" style={{ maxHeight: '120px' }}>
            <img src={latestOutput.imageUrl} alt={latestOutput.title}
              style={{ maxHeight: '120px', width: '100%', objectFit: 'cover', borderRadius: '8px' }}
            />
            <div className="image-overlay">
              <ImageIcon className="w-5 h-5" />
              <span className="text-xs font-medium truncate">{latestOutput.title}</span>
            </div>
          </div>
        )}
      </div>
      <div className="output-preview-footer">
        <span className="text-xs text-primary font-medium flex items-center gap-1">
          View all outputs <ChevronDown className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

// ✅ FIXED: Inline Rating with functional integration
function InlineRating({ teamId, promptId, isGuestMode }) {
  const { user } = useAuth();
  const { averageRating, totalRatings, userRating, ratePrompt } = usePromptRating(teamId, promptId);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = async (rating) => {
    if (isGuestMode) { alert("Sign up to rate prompts"); return; }
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await ratePrompt(rating);
    } catch (error) {
      console.error("Error rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating || userRating || 0;

  return (
    <div className="inline-rating-section">
      <div className="rating-stars-display">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="star-button" disabled={isSubmitting || isGuestMode}>
            <Star className={`w-4 h-4 transition-all ${
              star <= displayRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
            }`} />
          </button>
        ))}
      </div>
      {totalRatings > 0 && (
        <div className="rating-summary">
          <span className="rating-value">{averageRating.toFixed(1)}</span>
          <span className="rating-count">({totalRatings})</span>
        </div>
      )}
    </div>
  );
}

// Updated InlineCommentBox component
function InlineCommentBox({ promptId, teamId, commentCount, recentComments = [], onClose }) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    if (!commentText.trim() || isPosting) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, "teams", teamId, "prompts", promptId, "comments"), {
        text: commentText.trim(), 
        createdBy: user.uid, 
        createdAt: serverTimestamp(), 
        parentId: null,
      });
      await updateCommentCount(teamId, promptId, 1);
      setCommentText("");
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="inline-comment-box">
      <div className="comment-input-section">
        <textarea 
          placeholder="Add a comment..." 
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="comment-textarea" 
          rows={3} 
          maxLength={500} 
        />
        <div className="comment-actions">
          <span className="text-xs text-muted-foreground">
            {commentText.length}/500
          </span>
          <div className="flex gap-2">
            <button 
              onClick={onClose} 
              className="btn-secondary text-xs px-3 py-1.5" 
              disabled={isPosting}
            >
              Cancel
            </button>
            <button 
              onClick={handlePost} 
              className="btn-primary text-xs px-3 py-1.5"
              disabled={!commentText.trim() || isPosting}
            >
              {isPosting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Post
            </button>
          </div>
        </div>
      </div>

      {/* ADD THIS SECTION - Display recent comments */}
      {recentComments && recentComments.length > 0 && (
        <div className="recent-comments-preview">
          <div className="comment-preview-header">
            Recent Comments ({commentCount})
          </div>
          {recentComments.slice(0, 3).map((comment) => (
            <div key={comment.id} className="comment-preview-item">
              <UserAvatar 
                src={comment.authorAvatar} 
                name={comment.authorName} 
                email={comment.authorEmail} 
                size="sm" 
              />
              <div className="comment-preview-content">
                <span className="comment-author">
                  {comment.authorName || comment.authorEmail || "Unknown"}
                </span>
                <p className="comment-text-preview">{comment.text}</p>
                <span className="comment-time">
                  {getRelativeTime(comment.createdAt)}
                </span>
              </div>
            </div>
          ))}
          {commentCount > 3 && (
            <button className="view-all-comments-link">
              View all {commentCount} comments
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// AI Analysis Section
function AIAnalysisSection({ text, isExpanded, onToggle }) {
  const stats = useMemo(() => {
    if (!text) return null;
    const tokens = TokenEstimator.estimateTokens(text, "gpt-4");
    const cost = TokenEstimator.estimateCost(text, "gpt-4");
    const recommendations = TokenEstimator.getRecommendations(text);
    return {
      tokens, cost,
      bestModel: recommendations[0]?.model || "gpt-4",
      compatibleModels: Object.keys(AI_MODELS).filter((model) =>
        TokenEstimator.fitsInContext(text, model)
      ).length,
    };
  }, [text]);

  if (!stats) return null;
  const BestIcon = AI_MODELS[stats.bestModel]?.icon || Cpu;

  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 bg-muted/30">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-medium text-foreground hover:text-primary transition-colors">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span>AI Model Analysis</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isExpanded && (
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="p-2 rounded bg-muted/50 border border-border/30">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /><span>Tokens</span>
            </div>
            <span className="font-mono font-bold text-foreground">{stats.tokens.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-muted/50 border border-border/30">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /><span>Est. Cost</span>
            </div>
            <span className="font-mono font-bold text-foreground">${stats.cost.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Prompt Card Component
function PromptCard({ 
  prompt, outputs = [], comments = [], isDemo = false, canEdit = false,
  author, isGuestMode = false, activeTeam, userRole,
  onCopy, onEdit, onDelete, onToggleVisibility, onDuplicate,
  onViewOutputs, onAttachOutput, onEnhance, viewedPrompts = new Set(),
  onMarkViewed, showCommentInput, onToggleComments,
  isSelected, onSelect, openMenuId, onMenuToggle,
}) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const menuRef = useRef(null);
  const isPrivate = prompt.visibility === "private";
  const isViewed = viewedPrompts.has(prompt.id);
  const shouldTruncate = prompt.text.length > 200;
  const displayText = isTextExpanded ? prompt.text : prompt.text.slice(0, 200);
  const badge = getPromptBadge(prompt, isGuestMode);
  const showMenu = openMenuId === prompt.id;

  // ✅ FIXED: Auto-close menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && showMenu) {
        onMenuToggle(null);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu, onMenuToggle]);

  return (
    <article className={`prompt-card-v2 ${isViewed ? 'viewed' : 'new'} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <div className="prompt-card-header">
        <div className="prompt-author-row">
          {onSelect && !isDemo && (
            <PromptSelector promptId={prompt.id} isSelected={isSelected} onSelectionChange={onSelect} />
          )}
          {!isDemo && author && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <UserAvatar src={author?.avatar} name={author?.name} email={author?.email} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate text-foreground">
                  {isGuestMode ? "You" : (author?.name || author?.email || "Unknown")}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{getRelativeTime(prompt.createdAt)}</span>
                </div>
              </div>
            </div>
          )}
          {!isGuestMode && !isDemo && (
            <div className={`privacy-badge ${isPrivate ? 'private' : 'public'}`}>
              {isPrivate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span className="hidden sm:inline">{isPrivate ? 'Private' : 'Public'}</span>
            </div>
          )}
          {badge && <span className="demo-badge-small">{badge.label}</span>}
        </div>
      </div>

      <div className="prompt-main-content">
        <div className="prompt-title-row">
          <h3 className="prompt-title-text">{prompt.title}</h3>
          {!isDemo && prompt.enhanced && (
            <EnhancedBadge enhanced={prompt.enhanced} enhancedFor={prompt.enhancedFor}
              enhancementType={prompt.enhancementType} size="sm" />
          )}
        </div>

        <div className="prompt-preview-section">
          <div className={`prompt-text-content ${isTextExpanded ? 'expanded' : 'collapsed'}`}>
            {displayText}
            {!isTextExpanded && shouldTruncate && <span className="text-muted-foreground">...</span>}
          </div>
          {shouldTruncate && (
            <button onClick={() => setIsTextExpanded(!isTextExpanded)} className="read-more-btn">
              {isTextExpanded ? "Show less" : "Read more"}
              <ChevronDown className={`w-3 h-3 transition-transform ${isTextExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {prompt.tags && prompt.tags.length > 0 && (
          <div className="prompt-tags">
            {prompt.tags.slice(0, 4).map((tag, idx) => (
              <span key={idx} className="prompt-tag">#{tag}</span>
            ))}
            {prompt.tags.length > 4 && <span className="prompt-tag-more">+{prompt.tags.length - 4}</span>}
          </div>
        )}

        {!isDemo && (
          <AIAnalysisSection text={prompt.text} isExpanded={showAIAnalysis}
            onToggle={() => setShowAIAnalysis(!showAIAnalysis)} />
        )}

        {!isDemo && (
          <OutputPreviewPanel outputs={outputs} onViewAll={() => onViewOutputs && onViewOutputs(prompt)} />
        )}

        <div className="prompt-metadata-row">
          <div className="flex items-center gap-3 flex-wrap">
            {!isGuestMode && !isDemo && (
              <>
                <InlineRating teamId={activeTeam} promptId={prompt.id} isGuestMode={isGuestMode} />
                <div className="metadata-dot" />
              </>
            )}
            <button onClick={() => onToggleComments(prompt.id)} className="metadata-item-button">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{comments.length}</span>
            </button>
            <div className="metadata-dot" />
            <div className="metadata-item"><Eye className="w-3.5 h-3.5" /><span>{prompt.stats?.views || 0}</span></div>
          </div>
        </div>

        {showCommentInput && !isDemo && (
          <InlineCommentBox promptId={prompt.id} teamId={activeTeam}
            commentCount={comments.length} recentComments={comments}
            onClose={() => onToggleComments(prompt.id)} />
        )}

        <div className="prompt-actions">
          {isDemo ? (
            <>
              <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} />
              <button onClick={() => onDuplicate && onDuplicate(prompt)} className="btn-action-primary">
                <Sparkles className="w-3.5 h-3.5" /><span>Make My Own</span>
              </button>
            </>
          ) : (
            <>
              <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} />
              {/* ✅ FIXED: Enhance button always visible */}
              <button onClick={() => onEnhance(prompt)} className="btn-action-secondary" title="AI Enhance">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enhance</span>
              </button>
              {!isGuestMode && (
                <button onClick={() => onToggleComments(prompt.id)} className="btn-action-secondary">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Comment</span>
                </button>
              )}
              {/* ✅ FIXED: Kebab menu with z-index fix and auto-close */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => onMenuToggle(showMenu ? null : prompt.id)}
                  className="btn-action-secondary" aria-expanded={showMenu}>
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                  <div className="kebab-menu-v2">
                    {outputs.length > 0 && (
                      <>
                        <button onClick={() => { onViewOutputs(prompt); onMenuToggle(null); }} className="menu-item">
                          <FileText className="w-4 h-4" />
                          <span>View All Outputs ({outputs.length})</span>
                        </button>
                        <div className="menu-divider" />
                      </>
                    )}
                    <button onClick={() => { onAttachOutput(prompt); onMenuToggle(null); }} className="menu-item">
                      <Plus className="w-4 h-4" /><span>Attach New Output</span>
                    </button>
                    <div className="menu-divider" />
                    {!isGuestMode && (
                      <button onClick={() => { onToggleVisibility(prompt.id); onMenuToggle(null); }} className="menu-item">
                        {isPrivate ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        <span>Make {isPrivate ? "Public" : "Private"}</span>
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <div className="menu-divider" />
                        <button onClick={() => { onEdit(prompt); onMenuToggle(null); }} className="menu-item">
                          <Edit2 className="w-4 h-4" /><span>Edit</span>
                        </button>
                        <button onClick={() => { onDelete(prompt.id); onMenuToggle(null); }} className="menu-item danger">
                          <Trash2 className="w-4 h-4" /><span>Delete</span>
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
    </article>
  );
}

// Main Component
export default function PromptList({ activeTeam, userRole, isGuestMode = false, userId }) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const { checkSaveRequired, canEditPrompt: canEditGuestPrompt } = useGuestMode();
  
  const [userPrompts, setUserPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPrompt, setNewPrompt] = useState({ title: "", tags: "", text: "", visibility: "public" });
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [viewedPrompts, setViewedPrompts] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [promptOutputs, setPromptOutputs] = useState({});
  const [promptComments, setPromptComments] = useState({});
  const [showCommentInput, setShowCommentInput] = useState({});
  const [selectedPromptForAttach, setSelectedPromptForAttach] = useState(null);
  const [showAIEnhancer, setShowAIEnhancer] = useState(false);
  const [currentPromptForAI, setCurrentPromptForAI] = useState(null);
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);

  const demos = useMemo(() => {
    if (isGuestMode && userPrompts.length === 0) return getAllDemoPrompts();
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
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "teams", activeTeam, "prompts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, teamId: activeTeam, ...d.data() }));
      const uniqueData = Array.from(new Map(data.map((item) => [item.id, item])).values());
      const visiblePrompts = filterVisiblePrompts(uniqueData, user.uid, userRole);
      setUserPrompts(visiblePrompts);
      setLoading(false);
    }, (error) => {
      console.error("Error loading prompts:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [activeTeam, user, userRole, isGuestMode]);

  // Load outputs
  useEffect(() => {
    if (isGuestMode || !activeTeam) return;
    const unsubscribers = [];
    userPrompts.forEach((prompt) => {
      const unsub = subscribeToResults(activeTeam, prompt.id, (results) => {
        setPromptOutputs((prev) => ({ ...prev, [prompt.id]: results }));
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [userPrompts, activeTeam, isGuestMode]);

  // Load comments
  useEffect(() => {
    if (isGuestMode || !activeTeam) return;
    const unsubscribers = [];
    userPrompts.forEach((prompt) => {
      const q = query(collection(db, "teams", activeTeam, "prompts", prompt.id, "comments"),
        orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, async (snap) => {
        const commentData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const enrichedComments = await Promise.all(commentData.map(async (comment) => {
          const author = teamMembers[comment.createdBy];
          return { ...comment, authorName: author?.name, authorEmail: author?.email, authorAvatar: author?.avatar };
        }));
        setPromptComments((prev) => ({ ...prev, [prompt.id]: enrichedComments }));
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [userPrompts, activeTeam, isGuestMode, teamMembers]);

  // Load team data
  useEffect(() => {
    async function loadTeamData() {
      if (!activeTeam || isGuestMode) return;
      try {
        const teamDoc = await getDoc(doc(db, "teams", activeTeam));
        if (!teamDoc.exists()) return;
        const teamData = teamDoc.data();
        setTeamName(teamData.name || "Unknown Team");
        const memberIds = Object.keys(teamData.members || {});
        const profiles = {};
        for (const memberId of memberIds) {
          try {
            const userDoc = await getDoc(doc(db, "users", memberId));
            if (userDoc.exists()) profiles[memberId] = userDoc.data();
          } catch (error) { console.error("Error loading member:", error); }
        }
        setTeamMembers(profiles);
      } catch (error) { console.error("Error loading team data:", error); }
    }
    loadTeamData();
  }, [activeTeam, isGuestMode]);

  // ✅ FIXED: Search with filter
  const allPrompts = useMemo(() => {
    let combined = [...demos, ...userPrompts];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.text.toLowerCase().includes(query) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    if (filterCategory !== 'all') {
      if (filterCategory === 'demos') combined = combined.filter(p => isDemoPrompt(p));
      else if (filterCategory === 'mine') combined = combined.filter(p => !isDemoPrompt(p));
      else if (filterCategory === 'enhanced') combined = combined.filter(p => p.enhanced === true);
    }
    return combined;
  }, [demos, userPrompts, searchQuery, filterCategory]);

  const displayDemos = useMemo(() => allPrompts.filter(p => isDemoPrompt(p)), [allPrompts]);
  const displayUserPrompts = useMemo(() => allPrompts.filter(p => !isDemoPrompt(p)), [allPrompts]);

  // Bulk operations
  const handleSelectPrompt = (promptId, isSelected) => {
    setSelectedPrompts(prev => isSelected ? [...prev, promptId] : prev.filter(id => id !== promptId));
  };

  const handleBulkDelete = async (promptIds) => {
    try {
      for (const promptId of promptIds) {
        if (isGuestMode) guestState.deletePrompt(promptId);
        else await deletePrompt(activeTeam, promptId);
      }
      if (isGuestMode) setUserPrompts(prev => prev.filter(p => !promptIds.includes(p.id)));
      setSelectedPrompts([]);
      showSuccessToast(`${promptIds.length} prompts deleted`);
    } catch (error) {
      showNotification("Failed to delete some prompts", "error");
    }
  };

  const handleBulkExport = (prompts, format) => {
    if (format === 'json') ExportUtils.exportAsJSON(prompts, `prompts-${Date.now()}`);
    else if (format === 'csv') ExportUtils.exportAsCSV(prompts, `prompts-${Date.now()}`);
    else if (format === 'txt') ExportUtils.exportAsTXT(prompts, `prompts-${Date.now()}`);
  };

  const handleDuplicateDemo = (demoPrompt) => {
    const userPrompt = duplicateDemoToUserPrompt(demoPrompt);
    if (!userPrompt) { showNotification('Failed to duplicate demo', 'error'); return; }
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
        } catch (error) { showNotification('Failed to save copied prompt', 'error'); }
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
        await savePrompt(user.uid, {
          title: newPrompt.title.trim(),
          text: newPrompt.text.trim(),
          tags: newPrompt.tags.split(",").map((t) => t.trim()).filter(Boolean),
          visibility: newPrompt.visibility,
        }, activeTeam);
      }
      setNewPrompt({ title: "", tags: "", text: "", visibility: "public" });
      setShowCreateForm(false);
      showSuccessToast("Prompt created successfully!");
    } catch (error) { showNotification("Failed to create prompt", "error"); }
  }

  async function handleUpdate(promptId, updates) {
    try {
      if (isGuestMode) {
        guestState.updatePrompt(promptId, updates);
        setUserPrompts(prev => prev.map(p => p.id === promptId ? { ...p, ...updates } : p));
      } else {
        await updatePromptFirestore(activeTeam, promptId, updates);
      }
      setShowEditModal(false);
      setEditingPrompt(null);
      showSuccessToast("Prompt updated successfully!");
    } catch (error) { showNotification("Failed to update prompt", "error"); }
  }

  async function handleDelete(promptId) {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    try {
      if (isGuestMode) {
        guestState.deletePrompt(promptId);
        setUserPrompts(prev => prev.filter(p => p.id !== promptId));
      } else {
        await deletePrompt(activeTeam, promptId);
      }
      showSuccessToast("Prompt deleted");
    } catch (error) { showNotification("Failed to delete prompt", "error"); }
  }

  async function handleToggleVisibility(promptId) {
    if (isGuestMode) { showNotification("Sign up to manage prompt visibility", "info"); return; }
    const prompt = allPrompts.find((p) => p.id === promptId);
    if (!prompt) return;
    try {
      await togglePromptVisibility(activeTeam, promptId, prompt.visibility || "public");
      showSuccessToast("Visibility updated");
    } catch (error) { showNotification("Failed to change visibility", "error"); }
  }

  async function handleCopy(text, promptId) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Copied to clipboard!");
      if (!isGuestMode && activeTeam) await trackPromptCopy(activeTeam, promptId);
    } catch (error) { showNotification("Failed to copy", "error"); }
  }

  function canEditPrompt(prompt) {
    if (isGuestMode) return canEditGuestPrompt(prompt);
    return prompt.createdBy === user.uid || userRole === "owner" || userRole === "admin";
  }

  function handleToggleComments(promptId) {
    setShowCommentInput(prev => ({ ...prev, [promptId]: !prev[promptId] }));
  }

  function handleEnhance(prompt) {
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
  }

  // ✅ FIXED: Notification functions using CSS
  function showSuccessToast(message) {
    playNotification();
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) document.body.removeChild(toast); }, 3000);
  }

  function showNotification(message, type = "info") {
    playNotification();
    const notification = document.createElement("div");
    notification.className = "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-[9999] text-sm transition-opacity";
    notification.style.cssText = `background-color: var(--card); color: var(--foreground); border: 1px solid var(--${type === "error" ? "destructive" : "primary"}); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);`;
    notification.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => { if (notification.parentNode) document.body.removeChild(notification); }, 300);
    }, 3000);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card h-64"></div>
        <div className="skeleton-card h-64"></div>
      </div>
    );
  }

  return (
    <div className="prompt-list-container">
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {isGuestMode
                ? `${displayDemos.length} demos • ${displayUserPrompts.length} your prompts`
                : `${displayUserPrompts.length} ${displayUserPrompts.length === 1 ? "prompt" : "prompts"}`}
            </p>
          </div>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary px-6 py-3 flex items-center gap-2">
            {showCreateForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showCreateForm ? "Cancel" : "New Prompt"}</span>
          </button>
        </div>

        {/* ✅ FIXED: Search with clear button */}
        {allPrompts.length > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              <input type="text" placeholder="Search prompts..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="search-input pl-10" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="btn-secondary px-4 py-3 flex items-center gap-2">
                <Filter className="w-4 h-4" /><span>Filter</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>
              {showFilterMenu && (
                <div className="absolute top-full mt-2 right-0 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg z-50 p-2">
                  <button onClick={() => { setFilterCategory('all'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'all' ? 'bg-primary text-white' : ''}`}>
                    All Prompts
                  </button>
                  {displayDemos.length > 0 && (
                    <button onClick={() => { setFilterCategory('demos'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'demos' ? 'bg-primary text-white' : ''}`}>
                      Demo Prompts
                    </button>
                  )}
                  {displayUserPrompts.length > 0 && (
                    <button onClick={() => { setFilterCategory('mine'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'mine' ? 'bg-primary text-white' : ''}`}>
                      My Prompts
                    </button>
                  )}
                  <button onClick={() => { setFilterCategory('enhanced'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'enhanced' ? 'bg-primary text-white' : ''}`}>
                    AI Enhanced
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ✅ FIXED: Bulk Operations always visible */}
      {!isGuestMode && displayUserPrompts.length > 0 && (
        <BulkOperations prompts={displayUserPrompts} selectedPrompts={selectedPrompts}
          onSelectionChange={setSelectedPrompts} onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport} userRole={userRole} userId={userId} />
      )}

      {showCreateForm && (
        <div className="glass-card p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>Create New Prompt</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <input type="text" placeholder="e.g., Blog Post Generator" className="form-input"
                value={newPrompt.title} onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Prompt Text *</label>
              <textarea placeholder="Enter your prompt..." className="form-input min-h-[150px]"
                value={newPrompt.text} onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tags (comma separated)</label>
              <input type="text" placeholder="e.g., writing, creative, marketing" className="form-input"
                value={newPrompt.tags} onChange={(e) => setNewPrompt({ ...newPrompt, tags: e.target.value })} />
            </div>
            {!isGuestMode && (
              <div>
                <label className="block text-sm font-medium mb-2">Visibility</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="public" checked={newPrompt.visibility === "public"}
                      onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })} />
                    <span>Public</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="private" checked={newPrompt.visibility === "private"}
                      onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })} />
                    <span>Private</span>
                  </label>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">Create Prompt</button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary px-6">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {displayDemos.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Try These Examples</h3>
          </div>
          {displayDemos.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} outputs={[]} comments={[]} isDemo={true}
              canEdit={false} author={null} isGuestMode={isGuestMode} activeTeam={activeTeam}
              userRole={userRole} onCopy={handleCopy} onDuplicate={handleDuplicateDemo}
              viewedPrompts={viewedPrompts} showCommentInput={false} onToggleComments={() => {}}
              openMenuId={openMenuId} onMenuToggle={setOpenMenuId} />
          ))}
        </section>
      )}

      {displayUserPrompts.length > 0 && (
        <section>
          {isGuestMode && displayDemos.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Your Prompts</h3>
            </div>
          )}
          {displayUserPrompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} outputs={promptOutputs[prompt.id] || []}
              comments={promptComments[prompt.id] || []} isDemo={false} canEdit={canEditPrompt(prompt)}
              author={teamMembers[prompt.createdBy]} isGuestMode={isGuestMode} activeTeam={activeTeam}
              userRole={userRole} onCopy={handleCopy} onEdit={(p) => { setEditingPrompt(p); setShowEditModal(true); }}
              onDelete={handleDelete} onToggleVisibility={handleToggleVisibility} onEnhance={handleEnhance}
              onViewOutputs={(p) => {}} onAttachOutput={(p) => setSelectedPromptForAttach(p)}
              viewedPrompts={viewedPrompts} onMarkViewed={(id) => setViewedPrompts(prev => new Set([...prev, id]))}
              showCommentInput={showCommentInput[prompt.id] || false} onToggleComments={handleToggleComments}
              isSelected={selectedPrompts.includes(prompt.id)} onSelect={handleSelectPrompt}
              openMenuId={openMenuId} onMenuToggle={setOpenMenuId} />
          ))}
        </section>
      )}

      {/* ✅ FIXED: Empty state with clear search */}
      {allPrompts.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Sparkles size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? `No prompts match "${searchQuery}"` : "No prompts yet"}
          </h3>
          <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
            {searchQuery ? (
              <>
                Try adjusting your search or{' '}
                <button onClick={() => setSearchQuery('')} className="text-primary hover:underline">
                  clear the search
                </button>
              </>
            ) : (
              "Create your first prompt to get started"
            )}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowCreateForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />Create First Prompt
            </button>
          )}
        </div>
      )}

      {showEditModal && editingPrompt && (
        <EditPromptModal open={showEditModal} prompt={editingPrompt}
          onClose={() => { setShowEditModal(false); setEditingPrompt(null); }}
          onSave={(updates) => handleUpdate(editingPrompt.id, updates)} />
      )}

      {selectedPromptForAttach && (
        <AddResultModal isOpen={!!selectedPromptForAttach}
          onClose={() => setSelectedPromptForAttach(null)}
          promptId={selectedPromptForAttach.id} teamId={activeTeam} userId={user?.uid} />
      )}

      {showAIEnhancer && currentPromptForAI && (
        <AIPromptEnhancer prompt={currentPromptForAI}
          onApply={async (enhanced) => { await handleUpdate(enhanced.id, enhanced); setShowAIEnhancer(false); }}
          onSaveAsNew={(enhanced) => {
            if (isGuestMode) {
              const newPrompt = guestState.addPrompt(enhanced);
              setUserPrompts(prev => [newPrompt, ...prev]);
            } else {
              savePrompt(user.uid, enhanced, activeTeam);
            }
            setShowAIEnhancer(false);
            showSuccessToast("Enhanced prompt saved!");
          }}
          onClose={() => { setShowAIEnhancer(false); setCurrentPromptForAI(null); }}
        />
      )}
    </div>
  );
}
