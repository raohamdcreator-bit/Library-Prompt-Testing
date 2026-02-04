// src/components/PromptList.jsx - REDESIGNED with Responsive Info-Rich Cards
// Desktop: Two-column layout | Tablet: Stacked | Mobile: Compact vertical

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
  Eye,
  Star,
  FileText,
  AlertCircle,
  Users,
  Search,
  Check,
  Clock,
  Zap,
  HelpCircle,
  Filter,
  MessageSquare,
  DollarSign,
  Cpu,
  TrendingUp,
  Award,
  Activity,
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

// ==================== UTILITY FUNCTIONS ====================

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

// ==================== AI MODEL ANALYSIS CALCULATOR ====================

function calculateAIAnalysis(prompt) {
  // Simple token estimation (4 chars ≈ 1 token)
  const estimatedTokens = Math.ceil(prompt.text.length / 4);
  
  // Cost estimation per 1k tokens (simplified pricing)
  const modelPricing = {
    'gpt-4': 0.03,
    'gpt-3.5': 0.002,
    'claude-3': 0.015,
    'gemini-pro': 0.00025,
  };
  
  // Calculate cost for each model
  const costs = Object.entries(modelPricing).map(([model, price]) => ({
    model,
    cost: ((estimatedTokens / 1000) * price).toFixed(4),
  }));
  
  // Find best (cheapest) model
  const bestModel = costs.reduce((prev, curr) => 
    parseFloat(curr.cost) < parseFloat(prev.cost) ? curr : prev
  );
  
  // Determine compatibility based on prompt complexity
  const complexity = prompt.text.length > 500 ? 'high' : 
                     prompt.text.length > 200 ? 'medium' : 'low';
  
  const compatibilityScores = {
    'gpt-4': complexity === 'high' ? 95 : 90,
    'gpt-3.5': complexity === 'low' ? 95 : 75,
    'claude-3': complexity === 'high' ? 98 : 85,
    'gemini-pro': complexity === 'medium' ? 92 : 80,
  };
  
  return {
    tokens: estimatedTokens,
    estimatedCost: parseFloat(bestModel.cost),
    bestModel: bestModel.model,
    compatibility: compatibilityScores,
    topModel: Object.entries(compatibilityScores).reduce((a, b) => a[1] > b[1] ? a : b)[0],
  };
}

// ==================== MICRO COMPONENTS ====================

function UserAvatar({ src, name, email, size = "md" }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  if (!src || imageError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold`}
        style={{ backgroundColor: "var(--primary)" }}
      >
        {getUserInitials(name, email)}
      </div>
    );
  }

  return (
    <div className="relative">
      {!imageLoaded && (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center`} 
             style={{ backgroundColor: "var(--muted)" }}>
          <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={`${name || email}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-border/50 ${imageLoaded ? 'block' : 'hidden'}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  );
}

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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-primary/10 border border-transparent hover:border-primary/20"
      style={{ color: copied ? 'var(--success)' : 'var(--muted-foreground)' }}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function Tooltip({ children, text }) {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs rounded-md border border-border shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
        </div>
      )}
    </div>
  );
}

// ==================== AI ANALYSIS PANEL ====================

function AIAnalysisPanel({ analysis, compact = false }) {
  if (!analysis) return null;
  
  const getModelIcon = (model) => {
    if (model.includes('gpt')) return '🤖';
    if (model.includes('claude')) return '🧠';
    if (model.includes('gemini')) return '💎';
    return '⚡';
  };
  
  const formatModelName = (model) => {
    const names = {
      'gpt-4': 'GPT-4',
      'gpt-3.5': 'GPT-3.5',
      'claude-3': 'Claude 3',
      'gemini-pro': 'Gemini Pro',
    };
    return names[model] || model;
  };

  if (compact) {
    // Mobile/Tablet: Horizontal pill layout
    return (
      <div className="ai-analysis-compact">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="ai-stat-pill">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-semibold">{analysis.tokens.toLocaleString()}</span>
            <span className="text-muted-foreground">tokens</span>
          </div>
          
          <div className="ai-stat-pill">
            <DollarSign className="w-3.5 h-3.5" />
            <span className="font-semibold">${analysis.estimatedCost}</span>
          </div>
          
          <div className="ai-stat-pill primary">
            <span className="text-xs">{getModelIcon(analysis.topModel)}</span>
            <span className="font-semibold">{formatModelName(analysis.topModel)}</span>
            <Award className="w-3 h-3 ml-0.5" style={{ color: 'var(--primary)' }} />
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Vertical panel layout
  return (
    <div className="ai-analysis-panel">
      <div className="ai-panel-header">
        <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
        <h4 className="text-xs font-semibold uppercase tracking-wide" 
            style={{ color: 'var(--muted-foreground)' }}>
          AI Analysis
        </h4>
      </div>
      
      <div className="ai-panel-content">
        {/* Token count */}
        <div className="ai-metric">
          <div className="ai-metric-icon">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="ai-metric-content">
            <div className="ai-metric-value">{analysis.tokens.toLocaleString()}</div>
            <div className="ai-metric-label">Tokens</div>
          </div>
        </div>

        {/* Cost */}
        <div className="ai-metric">
          <div className="ai-metric-icon">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="ai-metric-content">
            <div className="ai-metric-value">${analysis.estimatedCost}</div>
            <div className="ai-metric-label">Est. Cost</div>
          </div>
        </div>

        {/* Best Model */}
        <div className="ai-metric primary">
          <div className="ai-metric-icon">
            <Award className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="ai-metric-content">
            <div className="ai-metric-value flex items-center gap-1">
              <span>{getModelIcon(analysis.topModel)}</span>
              <span>{formatModelName(analysis.topModel)}</span>
            </div>
            <div className="ai-metric-label">Best Match</div>
          </div>
        </div>

        {/* Compatibility */}
        <div className="ai-metric">
          <div className="ai-metric-icon">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="ai-metric-content">
            <div className="ai-metric-value">{analysis.compatibility[analysis.topModel]}%</div>
            <div className="ai-metric-label">Match Score</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== INLINE RATING DISPLAY ====================

function InlineRating({ teamId, promptId, isGuestMode }) {
  const { averageRating, totalRatings } = usePromptRating(teamId, promptId);
  
  if (isGuestMode || totalRatings === 0) return null;
  
  return (
    <div className="inline-rating">
      <div className="flex items-center gap-1">
        <Star className="w-3.5 h-3.5 fill-current" style={{ color: '#fbbf24' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {averageRating.toFixed(1)}
        </span>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          ({totalRatings})
        </span>
      </div>
    </div>
  );
}

// ==================== FEATURED COMMENT ====================

function FeaturedComment({ teamId, promptId, teamMembers }) {
  const [comment, setComment] = useState(null);
  
  useEffect(() => {
    if (!teamId || !promptId) return;
    
    const q = query(
      collection(db, "teams", teamId, "prompts", promptId, "comments"),
      orderBy("createdAt", "desc")
    );
    
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const latest = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setComment(latest);
      }
    });
    
    return () => unsub();
  }, [teamId, promptId]);
  
  if (!comment) return null;
  
  const author = teamMembers[comment.userId];
  
  return (
    <div className="featured-comment">
      <div className="flex items-start gap-2">
        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span className="font-medium" style={{ color: 'var(--foreground)' }}>
              {author?.name || 'Unknown'}
            </span>
            {' • '}
            <span className="truncate">{comment.text.slice(0, 80)}{comment.text.length > 80 ? '...' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== OPTIMIZATION BADGES ====================

function OptimizationBadges({ prompt, analysis }) {
  const badges = [];
  
  // Determine optimization badges (max 2)
  if (analysis.topModel.includes('claude')) {
    badges.push({ label: 'Claude-Optimized', icon: '🧠', variant: 'primary' });
  } else if (analysis.topModel.includes('gpt-4')) {
    badges.push({ label: 'GPT-4 Ready', icon: '🤖', variant: 'primary' });
  }
  
  if (analysis.estimatedCost < 0.01) {
    badges.push({ label: 'Low-Cost', icon: '💰', variant: 'success' });
  } else if (analysis.compatibility[analysis.topModel] >= 95) {
    badges.push({ label: 'High-Reasoning', icon: '🎯', variant: 'info' });
  }
  
  // Limit to 2 badges
  const displayBadges = badges.slice(0, 2);
  
  if (displayBadges.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {displayBadges.map((badge, idx) => (
        <span key={idx} className={`optimization-badge ${badge.variant}`}>
          <span className="badge-icon">{badge.icon}</span>
          <span className="badge-label">{badge.label}</span>
        </span>
      ))}
    </div>
  );
}

// ==================== MAIN PROMPT CARD ====================

function PromptCard({ 
  prompt, 
  isDemo,
  canEdit,
  author,
  teamMembers,
  isGuestMode,
  activeTeam,
  teamName,
  userRole,
  onCopy,
  onEdit,
  onDelete,
  onToggleVisibility,
  onDuplicate,
  onAIEnhance,
  viewedPrompts,
  onMarkViewed,
}) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const menuRef = useRef(null);
  
  const isPrivate = prompt.visibility === "private";
  const isViewed = viewedPrompts.has(prompt.id);
  const shouldTruncate = prompt.text.length > 200;
  const displayText = isTextExpanded ? prompt.text : prompt.text.slice(0, 200);
  const badge = getPromptBadge(prompt, isGuestMode);
  const analysis = useMemo(() => calculateAIAnalysis(prompt), [prompt.text]);
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleTextExpand = () => {
    setIsTextExpanded(!isTextExpanded);
    if (!isTextExpanded && !isViewed && onMarkViewed) {
      onMarkViewed(prompt.id);
    }
  };
  
  return (
    <article className={`prompt-card-redesign ${isViewed ? 'viewed' : 'new'}`}>
      {/* Mobile/Tablet: Header Section */}
      <div className="prompt-card-header">
        {/* Author Info */}
        <div className="prompt-author-row">
          {!isDemo && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <UserAvatar
                src={author?.avatar}
                name={author?.name}
                email={author?.email}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {isGuestMode ? "You" : (author?.name || author?.email || "Unknown")}
                </div>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  <Clock className="w-3 h-3" />
                  <span>{getRelativeTime(prompt.createdAt)}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Privacy Badge */}
          {!isGuestMode && !isDemo && (
            <Tooltip text={isPrivate ? "Only you can see this" : "Visible to team"}>
              <span className={`privacy-badge ${isPrivate ? 'private' : 'public'}`}>
                {isPrivate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </span>
            </Tooltip>
          )}
          
          {/* Demo Badge */}
          {badge && (
            <span className="demo-badge-small">
              {badge.icon} {badge.label}
            </span>
          )}
        </div>
      </div>

      {/* Desktop: Two-Column Layout | Mobile/Tablet: Stacked */}
      <div className="prompt-card-body">
        {/* LEFT COLUMN: Main Content */}
        <div className="prompt-main-content">
          {/* Title with Enhancement Badge */}
          <div className="prompt-title-row">
            <h3 className="prompt-title-text">{prompt.title}</h3>
            {!isDemo && (
              <EnhancedBadge
                enhanced={prompt.enhanced}
                enhancedFor={prompt.enhancedFor}
                enhancementType={prompt.enhancementType}
                size="sm"
              />
            )}
          </div>

          {/* Prompt Preview */}
          <div className="prompt-preview-section">
            <div className={`prompt-text-content ${isTextExpanded ? 'expanded' : 'collapsed'}`}>
              {displayText}
              {!isTextExpanded && shouldTruncate && <span className="text-muted-foreground">...</span>}
            </div>
            {shouldTruncate && (
              <button
                onClick={handleTextExpand}
                className="read-more-btn"
              >
                {isTextExpanded ? "Show less" : "Read more"}
                <ChevronDown className={`w-3 h-3 transition-transform ${isTextExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="prompt-tags">
              {prompt.tags.slice(0, 4).map((tag, idx) => (
                <span key={idx} className="prompt-tag">#{tag}</span>
              ))}
              {prompt.tags.length > 4 && (
                <span className="prompt-tag-more">+{prompt.tags.length - 4} more</span>
              )}
            </div>
          )}

          {/* Mobile/Tablet: AI Analysis (Compact) */}
          <div className="ai-analysis-mobile">
            <AIAnalysisPanel analysis={analysis} compact={true} />
            <OptimizationBadges prompt={prompt} analysis={analysis} />
          </div>

          {/* Rating & Comments Preview */}
          <div className="prompt-metadata-row">
            <div className="flex items-center gap-3 flex-wrap">
              {!isGuestMode && !isDemo && (
                <>
                  <InlineRating teamId={activeTeam} promptId={prompt.id} isGuestMode={isGuestMode} />
                  <div className="metadata-dot" />
                </>
              )}
              
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <Eye className="w-3.5 h-3.5" />
                <span>{prompt.stats?.views || 0} views</span>
              </div>
              
              <div className="metadata-dot" />
              
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <FileText className="w-3.5 h-3.5" />
                <span>{prompt.text.length} chars</span>
              </div>
            </div>
          </div>

          {/* Featured Comment */}
          {!isGuestMode && !isDemo && (
            <FeaturedComment teamId={activeTeam} promptId={prompt.id} teamMembers={teamMembers} />
          )}

          {/* Action Buttons */}
          <div className="prompt-actions">
            {isDemo ? (
              <>
                <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} />
                <button 
                  onClick={() => onDuplicate(prompt)}
                  className="btn-action-primary"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Make My Own</span>
                </button>
              </>
            ) : (
              <>
                <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} />
                
                {!isGuestMode && (
                  <FavoriteButton
                    prompt={prompt}
                    teamId={activeTeam}
                    teamName={teamName}
                    size="small"
                    className="btn-action-secondary"
                  />
                )}

                <button
                  onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                  className="btn-action-secondary"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Details</span>
                </button>

                {/* More Menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="btn-action-secondary"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {showMoreMenu && (
                    <div className="more-actions-menu">
                      <button onClick={() => { onAIEnhance(prompt); setShowMoreMenu(false); }} className="menu-item">
                        <Sparkles className="w-4 h-4" />
                        <span>Enhance with AI</span>
                      </button>

                      {!isGuestMode && canChangeVisibility(prompt, author?.uid, userRole) && (
                        <button onClick={() => { onToggleVisibility(prompt.id); setShowMoreMenu(false); }} className="menu-item">
                          {isPrivate ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          <span>Make {isPrivate ? "Public" : "Private"}</span>
                        </button>
                      )}

                      {canEdit && (
                        <>
                          <button onClick={() => { onEdit(prompt); setShowMoreMenu(false); }} className="menu-item">
                            <Edit2 className="w-4 h-4" />
                            <span>Edit</span>
                          </button>

                          <button onClick={() => { onDelete(prompt.id); setShowMoreMenu(false); }} className="menu-item danger">
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

        {/* RIGHT COLUMN: AI Analysis Panel (Desktop Only) */}
        {!isDemo && (
          <div className="prompt-ai-panel-desktop">
            <AIAnalysisPanel analysis={analysis} compact={false} />
            <div className="mt-3">
              <OptimizationBadges prompt={prompt} analysis={analysis} />
            </div>
          </div>
        )}
      </div>

      {/* Expandable Full Analysis (All devices) */}
      {!isDemo && showFullAnalysis && (
        <div className="prompt-expanded-section">
          <div className="expanded-content">
            <CompactAITools text={prompt.text} />
            
            {!isGuestMode && (
              <>
                <div className="expanded-divider" />
                <PromptResults
                  teamId={activeTeam}
                  promptId={prompt.id}
                  userRole={userRole}
                  onResultsChange={() => {}}
                />
                
                <div className="expanded-divider" />
                <Comments teamId={activeTeam} promptId={prompt.id} userRole={userRole} />
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ==================== MAIN COMPONENT ====================

export default function PromptList({ activeTeam, userRole, isGuestMode = false, userId }) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const { checkSaveRequired, canEditPrompt: canEditGuestPrompt } = useGuestMode();
  
  const [userPrompts, setUserPrompts] = useState([]);
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
  const [teamMembers, setTeamMembers] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [showAIEnhancer, setShowAIEnhancer] = useState(false);
  const [currentPromptForAI, setCurrentPromptForAI] = useState(null);
  const [viewedPrompts, setViewedPrompts] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const createFormRef = useRef(null);
  const listTopRef = useRef(null);

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
      if (filterCategory === 'demos') {
        combined = combined.filter(p => isDemoPrompt(p));
      } else if (filterCategory === 'mine') {
        combined = combined.filter(p => !isDemoPrompt(p));
      } else if (filterCategory === 'enhanced') {
        combined = combined.filter(p => p.enhanced === true);
      }
    }
    
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

  const pagination = usePagination(displayUserPrompts, 10);

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
            if (userDoc.exists()) {
              profiles[memberId] = userDoc.data();
            }
          } catch (error) {
            console.error("Error loading member:", error);
          }
        }

        setTeamMembers(profiles);
      } catch (error) {
        console.error("Error loading team data:", error);
      }
    }

    loadTeamData();
  }, [activeTeam, isGuestMode]);

  // Handlers
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
          showNotification('Failed to save copied prompt', 'error');
        }
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
      }

      setNewPrompt({ title: "", tags: "", text: "", visibility: "public" });
      setShowCreateForm(false);
      showSuccessToast("Prompt created successfully!");
    } catch (error) {
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
      showNotification("Failed to update prompt", "error");
    }
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
    } catch (error) {
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

    try {
      await togglePromptVisibility(
        activeTeam,
        promptId,
        prompt.visibility || "public"
      );
      showSuccessToast("Visibility updated");
    } catch (error) {
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
      showNotification("Failed to copy", "error");
    }
  }

  function handleAIEnhance(prompt) {
    if (isGuestMode && isDemoPrompt(prompt)) {
      showNotification('Duplicate this demo first to enhance it', 'warning');
      return;
    }
    
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
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
      showNotification("Failed to apply enhancement", "error");
    }
  }

  async function handleMarkViewed(promptId) {
    if (isGuestMode || viewedPrompts.has(promptId)) return;
    
    try {
      await trackPromptView(activeTeam, promptId);
      setViewedPrompts(prev => new Set([...prev, promptId]));
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  }

  function showSuccessToast(message) {
    playNotification();
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) document.body.removeChild(toast);
    }, 3000);
  }

  function showNotification(message, type = "info") {
    playNotification();
    const notification = document.createElement("div");
    notification.className = "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity";
    notification.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) document.body.removeChild(notification);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card h-64"></div>
        <div className="skeleton-card h-64"></div>
      </div>
    );
  }

  return (
    <div className="prompt-list-container" ref={listTopRef}>
      <style jsx>{`
        /* ==================== REDESIGNED CARD STYLES ==================== */
        
        .prompt-card-redesign {
          background: rgba(17, 19, 24, 0.6);
          border: 1px solid rgba(139, 92, 246, 0.12);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .prompt-card-redesign.new {
          border-left: 3px solid var(--primary);
        }

        .prompt-card-redesign:hover {
          border-color: rgba(139, 92, 246, 0.3);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          transform: translateY(-2px);
        }

        /* Header */
        .prompt-card-header {
          margin-bottom: 1rem;
        }

        .prompt-author-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .privacy-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.688rem;
          font-weight: 600;
          border: 1px solid;
        }

        .privacy-badge.private {
          background: rgba(251, 191, 36, 0.1);
          border-color: rgba(251, 191, 36, 0.2);
          color: rgba(251, 191, 36, 0.9);
        }

        .privacy-badge.public {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.2);
          color: rgba(16, 185, 129, 0.9);
        }

        .demo-badge-small {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 6px;
          font-size: 0.688rem;
          font-weight: 600;
          color: rgba(139, 92, 246, 0.9);
        }

        /* Body Layout */
        .prompt-card-body {
          display: flex;
          gap: 1.5rem;
        }

        .prompt-main-content {
          flex: 1;
          min-width: 0;
        }

        .prompt-ai-panel-desktop {
          display: none;
        }

        .ai-analysis-mobile {
          display: block;
          margin-top: 1rem;
        }

        /* Desktop: Show AI panel */
        @media (min-width: 1024px) {
          .prompt-ai-panel-desktop {
            display: block;
            flex-shrink: 0;
            width: 220px;
          }

          .ai-analysis-mobile {
            display: none;
          }
        }

        /* Title */
        .prompt-title-row {
          display: flex;
          align-items: start;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .prompt-title-text {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--foreground);
          line-height: 1.4;
          flex: 1;
        }

        /* Preview */
        .prompt-preview-section {
          margin-bottom: 1rem;
        }

        .prompt-text-content {
          font-size: 0.875rem;
          line-height: 1.6;
          color: rgba(228, 228, 231, 0.75);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .read-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          margin-top: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: transparent;
          border: none;
          color: var(--primary);
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .read-more-btn:hover {
          background: rgba(139, 92, 246, 0.1);
        }

        /* Tags */
        .prompt-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .prompt-tag {
          display: inline-block;
          padding: 0.25rem 0.625rem;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          color: rgba(139, 92, 246, 0.9);
        }

        .prompt-tag-more {
          padding: 0.25rem 0.625rem;
          font-size: 0.75rem;
          color: var(--muted-foreground);
        }

        /* Metadata */
        .prompt-metadata-row {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(139, 92, 246, 0.08);
        }

        .metadata-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--muted-foreground);
        }

        /* Featured Comment */
        .featured-comment {
          padding: 0.75rem;
          background: rgba(139, 92, 246, 0.03);
          border-left: 2px solid rgba(139, 92, 246, 0.2);
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        /* Actions */
        .prompt-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-action-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-action-primary:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .btn-action-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.875rem;
          background: transparent;
          color: var(--muted-foreground);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-action-secondary:hover {
          background: rgba(139, 92, 246, 0.08);
          border-color: rgba(139, 92, 246, 0.3);
          color: var(--foreground);
        }

        /* More Menu */
        .more-actions-menu {
          position: absolute;
          bottom: calc(100% + 0.5rem);
          right: 0;
          min-width: 200px;
          background: rgba(17, 19, 24, 0.98);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 8px;
          padding: 0.5rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 100;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.625rem 0.875rem;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--foreground);
          font-size: 0.875rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
        }

        .menu-item:hover {
          background: rgba(139, 92, 246, 0.12);
        }

        .menu-item.danger {
          color: var(--destructive);
        }

        .menu-item.danger:hover {
          background: rgba(239, 68, 68, 0.12);
        }

        /* AI Analysis Panel */
        .ai-analysis-panel {
          background: rgba(139, 92, 246, 0.03);
          border: 1px solid rgba(139, 92, 246, 0.1);
          border-radius: 12px;
          padding: 1rem;
        }

        .ai-panel-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(139, 92, 246, 0.1);
        }

        .ai-panel-content {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .ai-metric {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .ai-metric-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 8px;
          color: var(--primary);
          flex-shrink: 0;
        }

        .ai-metric.primary .ai-metric-icon {
          background: rgba(139, 92, 246, 0.15);
        }

        .ai-metric-content {
          flex: 1;
          min-width: 0;
        }

        .ai-metric-value {
          font-size: 0.938rem;
          font-weight: 600;
          color: var(--foreground);
          line-height: 1.2;
        }

        .ai-metric-label {
          font-size: 0.688rem;
          color: var(--muted-foreground);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* AI Analysis Compact (Mobile/Tablet) */
        .ai-analysis-compact {
          padding: 0.875rem;
          background: rgba(139, 92, 246, 0.03);
          border: 1px solid rgba(139, 92, 246, 0.1);
          border-radius: 10px;
          margin-bottom: 0.875rem;
        }

        .ai-stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 20px;
          font-size: 0.75rem;
          color: var(--foreground);
        }

        .ai-stat-pill.primary {
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.25);
        }

        /* Optimization Badges */
        .optimization-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          font-size: 0.688rem;
          font-weight: 600;
          border: 1px solid;
        }

        .optimization-badge.primary {
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.2);
          color: rgba(139, 92, 246, 0.9);
        }

        .optimization-badge.success {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.2);
          color: rgba(16, 185, 129, 0.9);
        }

        .optimization-badge.info {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.2);
          color: rgba(59, 130, 246, 0.9);
        }

        .badge-icon {
          font-size: 0.875rem;
        }

        /* Expanded Section */
        .prompt-expanded-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(139, 92, 246, 0.1);
        }

        .expanded-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .expanded-divider {
          height: 1px;
          background: rgba(139, 92, 246, 0.08);
        }

        /* Mobile Responsive */
        @media (max-width: 639px) {
          .prompt-card-redesign {
            padding: 1rem;
          }

          .prompt-title-text {
            font-size: 1rem;
          }

          .prompt-text-content {
            font-size: 0.813rem;
          }

          .btn-action-primary span,
          .btn-action-secondary span {
            display: none;
          }

          .btn-action-primary {
            padding: 0.5rem 0.75rem;
          }

          .more-actions-menu {
            right: 0;
            left: auto;
          }

          .ai-stat-pill {
            font-size: 0.688rem;
            padding: 0.313rem 0.625rem;
          }
        }

        /* Tablet Responsive */
        @media (min-width: 640px) and (max-width: 1023px) {
          .prompt-card-body {
            flex-direction: column;
          }

          .ai-analysis-mobile {
            display: block;
          }

          .prompt-ai-panel-desktop {
            display: none;
          }
        }
      `}</style>

      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {isGuestMode 
                ? `${displayDemos.length} demos • ${displayUserPrompts.length} your prompts`
                : `${displayUserPrompts.length} ${displayUserPrompts.length === 1 ? "prompt" : "prompts"}`
              }
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

        {/* Search & Filter */}
        {allPrompts.length > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="flex-1 min-w-0 relative">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--muted-foreground)' }}
              />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input pl-10"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="btn-secondary px-4 py-3 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>

              {showFilterMenu && (
                <div className="absolute top-full mt-2 right-0 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg z-50 p-2">
                  <button
                    onClick={() => { setFilterCategory('all'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'all' ? 'bg-primary text-white' : ''}`}
                  >
                    All Prompts
                  </button>
                  {displayDemos.length > 0 && (
                    <button
                      onClick={() => { setFilterCategory('demos'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'demos' ? 'bg-primary text-white' : ''}`}
                    >
                      Demo Prompts
                    </button>
                  )}
                  {displayUserPrompts.length > 0 && (
                    <button
                      onClick={() => { setFilterCategory('mine'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'mine' ? 'bg-primary text-white' : ''}`}
                    >
                      My Prompts
                    </button>
                  )}
                  <button
                    onClick={() => { setFilterCategory('enhanced'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent ${filterCategory === 'enhanced' ? 'bg-primary text-white' : ''}`}
                  >
                    AI Enhanced
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="glass-card p-6 mb-6" ref={createFormRef}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Create New Prompt
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
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
              <label className="block text-sm font-medium mb-2">Prompt Text *</label>
              <textarea
                placeholder="Enter your prompt..."
                className="form-input min-h-[150px]"
                value={newPrompt.text}
                onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tags (comma separated)</label>
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
                <label className="block text-sm font-medium mb-2">Visibility</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="public"
                      checked={newPrompt.visibility === "public"}
                      onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })}
                    />
                    <span>Public</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="private"
                      checked={newPrompt.visibility === "private"}
                      onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })}
                    />
                    <span>Private</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                Create Prompt
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary px-6"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Demo Prompts */}
      {displayDemos.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              Try These Examples
            </h3>
          </div>
          {displayDemos.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isDemo={true}
              canEdit={false}
              author={null}
              teamMembers={teamMembers}
              isGuestMode={isGuestMode}
              activeTeam={activeTeam}
              teamName={teamName}
              userRole={userRole}
              onCopy={handleCopy}
              onDuplicate={handleDuplicateDemo}
              viewedPrompts={viewedPrompts}
            />
          ))}
        </section>
      )}

      {/* User Prompts */}
      {displayUserPrompts.length > 0 && (
        <section>
          {isGuestMode && displayDemos.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                Your Prompts
              </h3>
            </div>
          )}

          {!isGuestMode && displayUserPrompts.length > 10 && (
            <PaginationControls pagination={pagination} showPageSizeSelector={true} />
          )}

          {(isGuestMode ? displayUserPrompts : pagination.currentItems).map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isDemo={false}
              canEdit={canEditPrompt(prompt)}
              author={teamMembers[prompt.createdBy]}
              teamMembers={teamMembers}
              isGuestMode={isGuestMode}
              activeTeam={activeTeam}
              teamName={teamName}
              userRole={userRole}
              onCopy={handleCopy}
              onEdit={setEditingPrompt}
              onDelete={handleDelete}
              onToggleVisibility={handleToggleVisibility}
              onAIEnhance={handleAIEnhance}
              viewedPrompts={viewedPrompts}
              onMarkViewed={handleMarkViewed}
            />
          ))}

          {!isGuestMode && displayUserPrompts.length > 10 && (
            <PaginationControls pagination={pagination} />
          )}
        </section>
      )}

      {/* Empty State */}
      {allPrompts.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Sparkles size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
          <h3 className="text-lg font-semibold mb-2">No prompts yet</h3>
          <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
            {searchQuery ? `No prompts match "${searchQuery}"` : "Create your first prompt to get started"}
          </p>
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create First Prompt
          </button>
        </div>
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
          onSaveAsNew={(enhanced) => {
            if (isGuestMode) {
              const newPrompt = guestState.addPrompt({
                title: enhanced.title,
                text: enhanced.text,
                tags: enhanced.tags || [],
                visibility: enhanced.visibility || "public",
              });
              setUserPrompts(prev => [newPrompt, ...prev]);
            } else {
              savePrompt(user.uid, enhanced, activeTeam);
            }
            setShowAIEnhancer(false);
            showSuccessToast("Enhanced prompt saved!");
          }}
          onClose={() => {
            setShowAIEnhancer(false);
            setCurrentPromptForAI(null);
          }}
        />
      )}

      {/* Advanced Features */}
      {!isGuestMode && displayUserPrompts.length > 0 && (
        <>
          <AdvancedSearch
            prompts={userPrompts}
            onFilteredResults={setFilteredPrompts}
            teamMembers={teamMembers}
          />
          <ExportImport
            onImport={async (imported) => {
              for (const prompt of imported) {
                await savePrompt(user.uid, prompt, activeTeam);
              }
              showSuccessToast(`Imported ${imported.length} prompts`);
            }}
            teamId={activeTeam}
            teamName={teamName}
            userRole={userRole}
          />
        </>
      )}
    </div>
  );
}
