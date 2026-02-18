// src/components/PromptList.jsx - Redesigned: maximized info density, output previews, upward kebab menu

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../lib/firebase";
import { trackPromptCopy } from "../lib/promptStats";
import { updateCommentCount } from "../lib/promptStats";
import { increment } from "firebase/firestore";
import {
  collection, onSnapshot, query, orderBy, getDoc, doc,
  addDoc, serverTimestamp, deleteDoc, updateDoc, setDoc,
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
  Target, TrendingUp, User, Calendar, Tag, Ruler, BarChart2,
  Lightbulb, SlidersHorizontal, UserPlus, TrendingUp as TrendIcon,
  ChevronUp,
} from "lucide-react";
import EditPromptModal from "./EditPromptModal";
import EnhancedBadge from './EnhancedBadge';
import { ExportUtils } from "./ExportImport";
import ExportImport from "./ExportImport";
import AIPromptEnhancer from "./AIPromptEnhancer";
import AddResultModal from "./AddResultModal";
import ViewOutputsModal from "./ViewOutputsModal";
import Comments from "./Comments";
import { usePromptRating } from "./PromptAnalytics";
import { useSoundEffects } from '../hooks/useSoundEffects';
import { TokenEstimator, AI_MODELS } from "./AIModelTools";
import BulkOperations, { PromptSelector } from "./BulkOperations";
import { useNotification } from "../context/NotificationContext";
import usePagination, { PaginationControls } from "../hooks/usePagination";

// ─── Utility functions ────────────────────────────────────────────────────────
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

// ─── User Avatar ─────────────────────────────────────────────────────────────
function UserAvatar({ src, name, email, size = "sm" }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const sizeClasses = { sm: "w-6 h-6 text-xs", md: "w-8 h-8 text-sm" };

  if (!src || imageError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
           style={{ backgroundColor: "var(--primary)" }}>
        {getUserInitials(name, email)}
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0`}
             style={{ backgroundColor: "var(--muted)" }}>
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      )}
      <img src={src} alt={`${name || email}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-border/50 flex-shrink-0 ${imageLoaded ? 'block' : 'hidden'}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </>
  );
}

// ─── Copy Button ─────────────────────────────────────────────────────────────
function CopyButton({ text, promptId, onCopy, isGuestMode }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await onCopy(text, promptId, isGuestMode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="btn-action-secondary" title="Copy prompt">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

// ─── Compact Rating Display ───────────────────────────────────────────────────
function CompactRating({ teamId, promptId, isGuestMode }) {
  const { averageRating, totalRatings, userRating, ratePrompt } = usePromptRating(teamId, promptId);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = async (rating) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try { await ratePrompt(rating); }
    catch (error) { if (isGuestMode && !teamId) alert("Sign up to rate prompts"); }
    finally { setIsSubmitting(false); }
  };

  const displayRating = hoverRating || userRating || 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0 transition-transform hover:scale-110" disabled={isSubmitting}>
            <Star className={`w-3 h-3 transition-all ${star <= displayRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600 hover:text-yellow-300'}`} />
          </button>
        ))}
      </div>
      {totalRatings > 0 && (
        <span className="text-xs font-medium tabular-nums" style={{ color: "var(--muted-foreground)" }}>
          {averageRating.toFixed(1)} <span className="opacity-60">({totalRatings})</span>
        </span>
      )}
    </div>
  );
}

// ─── Rating Stats Bar ─────────────────────────────────────────────────────────
function RatingStatsBar({ ratings = {}, totalRatings = 0, averageRating = 0, isExpanded, onToggle }) {
  const ratingCounts = { 5: ratings[5]||0, 4: ratings[4]||0, 3: ratings[3]||0, 2: ratings[2]||0, 1: ratings[1]||0 };
  const maxCount = Math.max(...Object.values(ratingCounts), 1);

  if (totalRatings === 0) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-xs py-1 hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-1.5">
          <TrendIcon className="w-3 h-3" style={{ color: "var(--primary)" }} />
          <span style={{ color: "var(--muted-foreground)" }}>Rating Distribution</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{averageRating.toFixed(1)}</span>
          <span style={{ color: "var(--muted-foreground)" }}>({totalRatings})</span>
          <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: "var(--muted-foreground)" }} />
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-1 mt-2" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars];
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-xs w-4 tabular-nums text-right" style={{ color: "var(--muted-foreground)" }}>{stars}</span>
                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${barWidth}%`,
                    backgroundColor: stars >= 4 ? 'rgb(34,197,94)' : stars === 3 ? 'rgb(251,191,36)' : 'rgb(239,68,68)',
                  }} />
                </div>
                <span className="text-xs w-5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inline Output Preview Strip ─────────────────────────────────────────────
// Compact horizontal strip showing latest output inline on the card
function OutputPreviewStrip({ outputs, onViewAll, isGuestMode = false }) {
  if (isGuestMode) {
    return (
      <button
        onClick={() => alert("Sign up to attach outputs and track prompt performance!")}
        className="output-strip-locked"
        title="Sign up to attach outputs"
      >
        <Lock className="w-3 h-3" />
        <span>Sign up to attach outputs</span>
      </button>
    );
  }

  if (!outputs || outputs.length === 0) {
    return (
      <button onClick={onViewAll} className="output-strip-empty" title="Attach first output">
        <Activity className="w-3 h-3 opacity-40" />
        <span>No outputs — attach one</span>
        <Plus className="w-3 h-3 opacity-60 ml-auto" />
      </button>
    );
  }

  const latest = outputs[0];
  const typeIcon = latest.type === 'code'
    ? <Code className="w-3 h-3 text-purple-400 flex-shrink-0" />
    : latest.type === 'image'
    ? <ImageIcon className="w-3 h-3 text-pink-400 flex-shrink-0" />
    : <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />;

  return (
    <button onClick={onViewAll} className="output-strip" title="View all outputs">
      {latest.type === 'image' && latest.imageUrl ? (
        <img
          src={latest.imageUrl}
          alt={latest.title}
          className="output-strip-thumb"
        />
      ) : typeIcon}
      <div className="output-strip-body">
        <span className="output-strip-title">{latest.title || 'Untitled output'}</span>
        {latest.type !== 'image' && latest.content && (
          <span className="output-strip-preview">{latest.content.slice(0, 80)}</span>
        )}
      </div>
      <div className="output-strip-count">
        <span>{outputs.length}</span>
        <ChevronUp className="w-3 h-3 opacity-60" />
      </div>
    </button>
  );
}

// Legacy panel kept for backwards compat — replaced by strip on card
function OutputPreviewPanel({ outputs, onViewAll, isGuestMode = false }) {
  return <OutputPreviewStrip outputs={outputs} onViewAll={onViewAll} isGuestMode={isGuestMode} />;
}

// ─── Inline Comments Section ──────────────────────────────────────────────────
function ExpandedCommentsSection({ promptId, teamId, commentCount, onClose, userRole }) {
  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '0.875rem',
      backgroundColor: 'var(--muted)',
      borderRadius: '0.625rem',
      border: '1px solid var(--border)',
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <h4 className="text-xs font-semibold text-foreground">Comments ({commentCount})</h4>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-background rounded transition-colors" title="Close comments">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <Comments teamId={teamId} promptId={promptId} userRole={userRole} />
    </div>
  );
}

// ─── AI Analysis Section ──────────────────────────────────────────────────────
function AIAnalysisSection({ text, isExpanded, onToggle, onEnhance }) {
  const stats = useMemo(() => {
    if (!text) return null;
    const tokens = TokenEstimator.estimateTokens(text, "gpt-4");
    const cost = TokenEstimator.estimateCost(text, "gpt-4");
    const recommendations = TokenEstimator.getRecommendations(text);
    return {
      tokens,
      cost,
      bestModel: recommendations[0]?.model || "gpt-4",
      bestModelReason: recommendations[0]?.reason || "Recommended for this prompt",
      compatibleModels: Object.keys(AI_MODELS).filter((model) => TokenEstimator.fitsInContext(text, model)).length,
      totalModels: Object.keys(AI_MODELS).length,
    };
  }, [text]);

  if (!stats) return null;
  const BestIcon = AI_MODELS[stats.bestModel]?.icon || Cpu;
  const BestModelConfig = AI_MODELS[stats.bestModel];
  const compatPct = Math.round((stats.compatibleModels / stats.totalModels) * 100);

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between text-xs py-1 hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3" style={{ color: "var(--primary)" }} />
          <span style={{ color: "var(--muted-foreground)" }}>AI Model Analysis</span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
            compatPct >= 80 ? 'bg-green-500/15 text-green-400' :
            compatPct >= 50 ? 'bg-yellow-500/15 text-yellow-400' :
            'bg-red-500/15 text-red-400'}`}>
            {compatPct}%
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: "var(--muted-foreground)" }} />
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {[
              { icon: <TrendingUp className="w-3 h-3" />, label: "Tokens", value: stats.tokens.toLocaleString() },
              { icon: <DollarSign className="w-3 h-3" />, label: "Cost", value: `$${stats.cost.toFixed(4)}` },
              { icon: <Target className="w-3 h-3" />, label: "Compatible", value: `${stats.compatibleModels}/${stats.totalModels}` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="p-2 rounded-lg col-span-1" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-1 mb-0.5" style={{ color: "var(--muted-foreground)" }}>{icon}<span>{label}</span></div>
                <span className="font-mono font-bold text-xs" style={{ color: "var(--foreground)" }}>{value}</span>
              </div>
            ))}
            <div className="p-2 rounded-lg col-span-1" style={{ backgroundColor: "var(--primary-10, rgba(var(--primary-rgb),0.1))", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1 mb-0.5 text-primary"><BestIcon className="w-3 h-3" /><span className="text-xs">Best</span></div>
              <span className="font-bold text-xs truncate block" style={{ color: "var(--foreground)" }}>{BestModelConfig?.name || stats.bestModel}</span>
            </div>
          </div>

          {onEnhance && (
            <button onClick={(e) => { e.stopPropagation(); onEnhance(); }}
              className="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1.5 hover:bg-primary/10 hover:text-primary transition-all">
              <Sparkles className="w-3 h-3" />
              Detailed Analysis & Enhancement
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────
function PromptCard({ 
  prompt, outputs = [], commentCount = 0, isDemo = false, canEdit = false,
  author, isGuestMode = false, activeTeam, userRole,
  onCopy, onEdit, onDelete, onToggleVisibility, onDuplicate,
  onViewOutputs, onAttachOutput, onEnhance, viewedPrompts = new Set(),
  onMarkViewed, showCommentSection, onToggleComments,
  isSelected, onSelect, openMenuId, onMenuToggle, onTrackView,
  onToggleFavourite, favouritePromptIds = new Set(),
}) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showRatingStats, setShowRatingStats] = useState(false);
  const menuRef = useRef(null);
  const isPrivate = prompt.visibility === "private";
  const isViewed = viewedPrompts.has(prompt.id);
  const shouldTruncate = prompt.text.length > 160;
  const displayText = isTextExpanded ? prompt.text : prompt.text.slice(0, 160);
  const badge = getPromptBadge(prompt, isGuestMode);
  const showMenu = openMenuId === prompt.id;
  const isFavourited = favouritePromptIds.has(prompt.id);

  const { ratings, averageRating, totalRatings } = usePromptRating(activeTeam, prompt.id);
  const ratingDistribution = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating]++; });
    return dist;
  }, [ratings]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && showMenu) onMenuToggle(null);
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu, onMenuToggle]);

  return (
    <article className={`prompt-card-v2 prompt-card-dense ${isViewed ? 'viewed' : 'new'} ${isSelected ? 'ring-2 ring-primary' : ''}`}
      style={{
        display: 'grid',
        gridTemplateRows: 'auto',
        gap: 0,
      }}>

      {/* ── Top Meta Bar ── */}
      <div className="prompt-card-meta-bar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.625rem 0.875rem',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        {onSelect && !isDemo && (
          <PromptSelector promptId={prompt.id} isSelected={isSelected} onSelectionChange={onSelect} />
        )}

        {/* Author */}
        {!isDemo && author && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <UserAvatar src={author?.avatar} name={author?.name} email={author?.email} size="sm" />
            <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
              {isGuestMode ? "You" : (author?.name || author?.email || "Unknown")}
            </span>
          </div>
        )}
        {isDemo && <div className="flex-1" />}

        {/* Right-side chips */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            <Clock className="w-3 h-3" />
            {getRelativeTime(prompt.createdAt)}
          </span>

          {!isGuestMode && !isDemo && (
            <span className={`privacy-badge ${isPrivate ? 'private' : 'public'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}>
              {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
              <span className="hidden sm:inline">{isPrivate ? 'Private' : 'Public'}</span>
            </span>
          )}

          {badge && <span className="demo-badge-small">{badge.label}</span>}

          {!isDemo && prompt.enhanced && (
            <EnhancedBadge enhanced={prompt.enhanced} enhancedFor={prompt.enhancedFor}
              enhancementType={prompt.enhancementType} size="sm" />
          )}

          {/* Favourite star quick-action */}
          {!isGuestMode && !isDemo && onToggleFavourite && (
            <button
              onClick={() => onToggleFavourite(prompt.id, prompt.teamId || activeTeam)}
              className="p-0.5 rounded transition-all hover:scale-110"
              title={isFavourited ? "Remove favourite" : "Mark favourite"}
            >
              <Star className={`w-3.5 h-3.5 transition-all ${isFavourited ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column body: main content + output preview ── */}
      <div className="prompt-card-body" style={{
        display: 'grid',
        gridTemplateColumns: outputs.length > 0 || !isDemo ? '1fr auto' : '1fr',
        gap: 0,
      }}>

        {/* Left: text + tags + metadata */}
        <div style={{ padding: '0.75rem 0.875rem', minWidth: 0 }}>
          {/* Title */}
          <h3 className="prompt-title-text" style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem', lineHeight: 1.3 }}>
            {prompt.title}
          </h3>

          {/* Prompt text */}
          <div className="prompt-preview-section" style={{ marginBottom: '0.5rem' }}>
            <p className="prompt-text-content text-sm" style={{
              color: "var(--muted-foreground)",
              lineHeight: 1.55,
              display: isTextExpanded ? 'block' : '-webkit-box',
              WebkitLineClamp: isTextExpanded ? 'unset' : 3,
              WebkitBoxOrient: 'vertical',
              overflow: isTextExpanded ? 'visible' : 'hidden',
            }}>
              {prompt.text}
            </p>
            {shouldTruncate && (
              <button
                onClick={() => {
                  setIsTextExpanded(!isTextExpanded);
                  if (!isTextExpanded && onTrackView) onTrackView(prompt.id);
                }}
                className="read-more-btn"
                style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}
              >
                {isTextExpanded ? "Show less" : "Read more"}
                <ChevronDown className={`w-3 h-3 transition-transform ${isTextExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-0.5">
              {prompt.tags.slice(0, 5).map((tag, idx) => (
                <span key={idx} className="prompt-tag" style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}>
                  #{tag}
                </span>
              ))}
              {prompt.tags.length > 5 && (
                <span className="prompt-tag-more" style={{ fontSize: '0.65rem' }}>+{prompt.tags.length - 5}</span>
              )}
            </div>
          )}

          {/* Stats row: rating · comments · views */}
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '0.5rem' }}>
            {!isDemo && activeTeam && (
              <CompactRating teamId={activeTeam} promptId={prompt.id} isGuestMode={isGuestMode} />
            )}
            {!isDemo && (
              <>
                {activeTeam && <span className="text-muted-foreground opacity-40 text-xs">·</span>}
                {isGuestMode && !activeTeam ? (
                  <button
                    onClick={() => alert("Sign up to view and add comments!")}
                    className="flex items-center gap-1 text-xs opacity-50 cursor-not-allowed"
                    style={{ color: "var(--muted-foreground)" }}>
                    <Lock className="w-2.5 h-2.5" />
                    <MessageSquare className="w-3 h-3" />
                    <span>{commentCount}</span>
                  </button>
                ) : (
                  <button onClick={() => onToggleComments(prompt.id)}
                    className="flex items-center gap-1 text-xs hover:text-primary transition-colors"
                    style={{ color: "var(--muted-foreground)" }}>
                    <MessageSquare className="w-3 h-3" />
                    <span>{commentCount}</span>
                  </button>
                )}
                <span className="text-muted-foreground opacity-40 text-xs">·</span>
                <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <Eye className="w-3 h-3" />
                  <span>{prompt.stats?.views || 0}</span>
                </div>
              </>
            )}
          </div>

          {/* Collapsible AI analysis */}
          {!isDemo && (
            <AIAnalysisSection
              text={prompt.text}
              isExpanded={showAIAnalysis}
              onToggle={() => setShowAIAnalysis(!showAIAnalysis)}
              onEnhance={isGuestMode && activeTeam ? null : () => onEnhance && onEnhance(prompt)}
            />
          )}

          {/* Collapsible rating distribution */}
          {!isDemo && activeTeam && (
            <RatingStatsBar
              ratings={ratingDistribution}
              totalRatings={totalRatings}
              averageRating={averageRating}
              isExpanded={showRatingStats}
              onToggle={() => setShowRatingStats(!showRatingStats)}
            />
          )}
        </div>

        {/* Right: output preview sidebar */}
        {!isDemo && (
          <div className="prompt-output-sidebar" style={{
            width: '180px',
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <OutputSidebar
              outputs={outputs}
              onViewAll={() => onViewOutputs && onViewOutputs(prompt)}
              onAttach={() => onAttachOutput && onAttachOutput(prompt)}
              isGuestMode={isGuestMode}
            />
          </div>
        )}
      </div>

      {/* ── Inline comments ── */}
      {showCommentSection && !isDemo && activeTeam && (
        <div style={{ padding: '0 0.875rem 0.75rem' }}>
          <ExpandedCommentsSection
            promptId={prompt.id}
            teamId={activeTeam}
            commentCount={commentCount}
            onClose={() => onToggleComments(prompt.id)}
            userRole={userRole}
          />
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="prompt-actions" style={{
        borderTop: '1px solid var(--border)',
        padding: '0.5rem 0.875rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
      }}>
        {isDemo ? (
          <>
            <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} isGuestMode={isGuestMode} />
            <button onClick={() => onDuplicate && onDuplicate(prompt)} className="btn-action-primary">
              <Sparkles className="w-3.5 h-3.5" /><span>Make My Own</span>
            </button>
          </>
        ) : (
          <>
            <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} isGuestMode={isGuestMode} />

            {isGuestMode && activeTeam ? (
              <button
                onClick={() => alert("Sign up to enhance prompts and unlock all features!")}
                className="btn-action-secondary opacity-60 cursor-not-allowed" title="Sign up to enhance">
                <Lock className="w-3 h-3" /><Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enhance</span>
              </button>
            ) : (
              <button onClick={() => onEnhance(prompt)} className="btn-action-secondary" title="AI Enhance">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Enhance</span>
              </button>
            )}

            {isGuestMode && !activeTeam ? (
              <button
                onClick={() => alert("Sign up to add comments and collaborate!")}
                className="btn-action-secondary opacity-60 cursor-not-allowed" title="Sign up to comment">
                <Lock className="w-3 h-3" /><MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Comment</span>
              </button>
            ) : (
              <button onClick={() => onToggleComments(prompt.id)} className="btn-action-secondary">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Comment</span>
              </button>
            )}

            {/* Kebab menu — opens UPWARD */}
            <div className="relative ml-auto" ref={menuRef}>
              <button
                onClick={() => onMenuToggle(showMenu ? null : prompt.id)}
                className="btn-action-secondary"
                aria-expanded={showMenu}
                title="More actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">More</span>
              </button>

              {showMenu && (
                <div className="kebab-menu-v2 kebab-menu-upward" style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  right: 0,
                  top: 'auto',
                  zIndex: 50,
                  minWidth: '11rem',
                }}>
                  {/* Favourite */}
                  {!isGuestMode && onToggleFavourite && (
                    <>
                      <button
                        onClick={() => { onToggleFavourite(prompt.id, prompt.teamId || activeTeam); onMenuToggle(null); }}
                        className="menu-item"
                      >
                        <Star className={`w-4 h-4 ${isFavourited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        <span>{isFavourited ? 'Remove Favourite' : 'Mark Favourite'}</span>
                      </button>
                      <div className="menu-divider" />
                    </>
                  )}

                  {outputs.length > 0 && (
                    <>
                      <button onClick={() => { onViewOutputs(prompt); onMenuToggle(null); }} className="menu-item">
                        <FileText className="w-4 h-4" />
                        <span>View All Outputs ({outputs.length})</span>
                      </button>
                      <div className="menu-divider" />
                    </>
                  )}

                  {isGuestMode ? (
                    <button
                      onClick={() => { alert("Sign up to attach outputs!"); onMenuToggle(null); }}
                      className="menu-item opacity-60 cursor-not-allowed">
                      <Lock className="w-3.5 h-3.5" /><Plus className="w-4 h-4" /><span>Attach Output</span>
                    </button>
                  ) : (
                    <button onClick={() => { onAttachOutput(prompt); onMenuToggle(null); }} className="menu-item">
                      <Plus className="w-4 h-4" /><span>Attach Output</span>
                    </button>
                  )}

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
    </article>
  );
}

// ─── Output Sidebar (right panel on card) ─────────────────────────────────────
function OutputSidebar({ outputs, onViewAll, onAttach, isGuestMode }) {
  if (isGuestMode) {
    return (
      <div className="output-sidebar-locked" onClick={() => alert("Sign up to attach outputs!")}
        style={{ cursor: 'pointer', padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', height: '100%', opacity: 0.6 }}>
        <Lock className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
        <span style={{ fontSize: '0.65rem', textAlign: 'center', color: "var(--muted-foreground)" }}>Sign up for outputs</span>
      </div>
    );
  }

  if (!outputs || outputs.length === 0) {
    return (
      <button onClick={onAttach}
        className="output-sidebar-empty"
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
          padding: '0.75rem', cursor: 'pointer', border: 'none', background: 'transparent',
          color: 'var(--muted-foreground)',
          transition: 'background 0.15s',
        }}
        title="Attach first output"
        onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Activity className="w-5 h-5 opacity-30" />
        <span style={{ fontSize: '0.65rem', textAlign: 'center', opacity: 0.6 }}>No outputs yet</span>
        <span style={{
          fontSize: '0.6rem', padding: '0.1rem 0.5rem', borderRadius: '999px',
          border: '1px dashed var(--border)', marginTop: '0.25rem', opacity: 0.7,
        }}>+ Attach</span>
      </button>
    );
  }

  const latest = outputs[0];

  return (
    <button onClick={onViewAll}
      className="output-sidebar-filled"
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        padding: '0', cursor: 'pointer', border: 'none', background: 'transparent',
        textAlign: 'left', transition: 'background 0.15s',
      }}
      title="View all outputs"
      onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Thumbnail or type header */}
      {latest.type === 'image' && latest.imageUrl ? (
        <div style={{ width: '100%', height: '80px', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={latest.imageUrl}
            alt={latest.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div style={{
          padding: '0.5rem 0.625rem 0.25rem',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          borderBottom: '1px solid var(--border)',
        }}>
          {latest.type === 'code'
            ? <Code className="w-3 h-3 text-purple-400 flex-shrink-0" />
            : <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />}
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--foreground)', truncate: true }}>
            {latest.type === 'code' ? 'Code' : 'Text'}
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '0.5rem 0.625rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <p style={{
          fontSize: '0.7rem', fontWeight: 600, color: 'var(--foreground)',
          marginBottom: '0.25rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {latest.title || 'Untitled'}
        </p>
        {latest.type !== 'image' && latest.content && (
          <p style={{
            fontSize: '0.65rem', color: 'var(--muted-foreground)', lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {latest.content}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '0.3rem 0.625rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)' }}>
          {outputs.length} output{outputs.length !== 1 ? 's' : ''}
        </span>
        <ChevronUp className="w-3 h-3" style={{ color: "var(--primary)", opacity: 0.7 }} />
      </div>
    </button>
  );
}

// ─── Filter Card ──────────────────────────────────────────────────────────────
function FilterCard({ filters, onFilterChange, onClearFilters, hasActiveFilters, filteredCount, teamMembers = {}, isExpanded, onToggleExpanded }) {
  const authors = Object.entries(teamMembers).map(([uid, member]) => ({ uid, name: member.name || member.email }));
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== "sortBy" && v !== "" && v !== "all").length;

  return (
    <div className="glass-card p-6 mb-6" id="filter-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'} · {filteredCount} results
              </p>
            )}
          </div>
        </div>
        <button onClick={onToggleExpanded} className="btn-secondary px-3 py-1.5 flex items-center gap-1.5 text-sm">
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
              <BarChart2 className="w-3.5 h-3.5" />Sort By
            </label>
            <select value={filters.sortBy} onChange={(e) => onFilterChange("sortBy", e.target.value)} className="form-input w-full text-sm">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
              <option value="author">Author A-Z</option>
              <option value="length-desc">Longest First</option>
              <option value="length-asc">Shortest First</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'author', label: 'Author', icon: User, type: 'select', options: [{ value: 'all', label: 'All Authors' }, ...authors.map(a => ({ value: a.uid, label: a.name }))] },
              { key: 'visibility', label: 'Visibility', icon: Lock, type: 'select', options: [{ value: 'all', label: 'All Prompts' }, { value: 'public', label: 'Public Only' }, { value: 'private', label: 'Private Only' }] },
              { key: 'dateRange', label: 'Created', icon: Calendar, type: 'select', options: [{ value: 'all', label: 'Any Time' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Past Week' }, { value: 'month', label: 'Past Month' }, { value: 'quarter', label: 'Past 3 Months' }] },
            ].map(({ key, label, icon: Icon, type, options }) => (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </label>
                <select value={filters[key]} onChange={(e) => onFilterChange(key, e.target.value)} className="form-input w-full text-sm">
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                <Tag className="w-3.5 h-3.5" />Tags
              </label>
              <input type="text" placeholder="writing, creative" value={filters.tags}
                onChange={(e) => onFilterChange("tags", e.target.value)} className="form-input w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Comma separated</p>
            </div>

            {[{ key: 'minLength', label: 'Min Characters' }, { key: 'maxLength', label: 'Max Characters' }].map(({ key, label }) => (
              <div key={key}>
                <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  <Ruler className="w-3.5 h-3.5" />{label}
                </label>
                <input type="number" placeholder={key === 'minLength' ? '0' : 'No limit'}
                  value={filters[key]} onChange={(e) => onFilterChange(key, e.target.value)}
                  className="form-input w-full text-sm" min="0" />
              </div>
            ))}
          </div>

          {hasActiveFilters && (
            <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}
              </p>
              <button onClick={onClearFilters} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />Clear All
              </button>
            </div>
          )}

          <div className="p-2.5 rounded-lg border flex items-start gap-2 text-xs"
            style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
            <p style={{ color: "var(--muted-foreground)" }}>
              Combine filters for precision. Use commas in Tags to match multiple.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PromptList({ activeTeam, userRole, isGuestMode = false, userId, onScrollToInvite }) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const { checkSaveRequired, canEditPrompt: canEditGuestPrompt } = useGuestMode();
  const { success, error, info } = useNotification();
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
  const [promptOutputs, setPromptOutputs] = useState({});
  const [promptComments, setPromptComments] = useState({});
  const [showCommentSection, setShowCommentSection] = useState({});
  const [selectedPromptForAttach, setSelectedPromptForAttach] = useState(null);
  const [showAIEnhancer, setShowAIEnhancer] = useState(false);
  const [currentPromptForAI, setCurrentPromptForAI] = useState(null);
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewOutputsPrompt, setViewOutputsPrompt] = useState(null);
  const [trackedViews, setTrackedViews] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const filterCardRef = useRef(null);
  const importCardRef = useRef(null);
  const [favouritePromptIds, setFavouritePromptIds] = useState(new Set());

  const [filters, setFilters] = useState({
    author: "all", tags: "", dateRange: "all", sortBy: "newest",
    minLength: "", maxLength: "", visibility: "all",
  });

  const demos = useMemo(() => {
    if (isGuestMode && userPrompts.length === 0) return getAllDemoPrompts();
    return [];
  }, [isGuestMode, userPrompts.length]);

  // Load favourites
  useEffect(() => {
    if (!user || isGuestMode) return;
    const favRef = collection(db, "users", user.uid, "favourites");
    const unsub = onSnapshot(favRef, (snap) => {
      setFavouritePromptIds(new Set(snap.docs.map((d) => d.id)));
    });
    return () => unsub();
  }, [user, isGuestMode]);

  // Load prompts
  useEffect(() => {
    if (isGuestMode && !activeTeam) {
      setUserPrompts(guestState.getPrompts());
      setLoading(false);
      return;
    }
    if (!activeTeam) { setUserPrompts([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, "teams", activeTeam, "prompts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, teamId: activeTeam, ...d.data() }));
      const unique = Array.from(new Map(data.map(item => [item.id, item])).values());
      const visible = user
        ? filterVisiblePrompts(unique, user.uid, userRole)
        : unique.filter(p => p.visibility === 'public' || !p.visibility);
      setUserPrompts(visible);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [activeTeam, user, userRole, isGuestMode]);

  // Load outputs
  useEffect(() => {
    if (!activeTeam) return;
    const unsubs = userPrompts.map((prompt) =>
      subscribeToResults(activeTeam, prompt.id, (results) => {
        setPromptOutputs((prev) => ({ ...prev, [prompt.id]: results }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [userPrompts, activeTeam]);

  // Load comment counts
  useEffect(() => {
    if (!activeTeam) return;
    const unsubs = userPrompts.map((prompt) => {
      const q = query(collection(db, "teams", activeTeam, "prompts", prompt.id, "comments"));
      return onSnapshot(q, (snap) => {
        setPromptComments((prev) => ({ ...prev, [prompt.id]: snap.docs.length }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [userPrompts, activeTeam]);

  // Load team data
  useEffect(() => {
    async function loadTeamData() {
      if (!activeTeam || isGuestMode || !user) return;
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
          } catch {}
        }
        setTeamMembers(profiles);
      } catch {}
    }
    loadTeamData();
  }, [activeTeam, isGuestMode, user]);

  async function handleToggleFavourite(promptId, teamId) {
    if (!user) { showNotification("Sign up to save favourites", "info"); return; }
    const favRef = doc(db, "users", user.uid, "favourites", promptId);
    const isCurrentlyFaved = favouritePromptIds.has(promptId);
    setFavouritePromptIds((prev) => {
      const next = new Set(prev);
      isCurrentlyFaved ? next.delete(promptId) : next.add(promptId);
      return next;
    });
    try {
      if (isCurrentlyFaved) {
        await deleteDoc(favRef);
        showSuccessToast("Removed from favourites");
      } else {
        await setDoc(favRef, { promptId, teamId: teamId || activeTeam, addedAt: serverTimestamp() });
        showSuccessToast("Added to favourites ★");
      }
    } catch {
      setFavouritePromptIds((prev) => {
        const next = new Set(prev);
        isCurrentlyFaved ? next.add(promptId) : next.delete(promptId);
        return next;
      });
      showNotification("Failed to update favourites", "error");
    }
  }

  function applyFilters(promptsList) {
    function getTimestamp(p) {
      if (!p.createdAt) return 0;
      if (typeof p.createdAt.toMillis === 'function') return p.createdAt.toMillis();
      if (p.createdAt instanceof Date) return p.createdAt.getTime();
      if (typeof p.createdAt === 'number') return p.createdAt;
      return 0;
    }
    let filtered = [...promptsList];
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(term) ||
        p.text?.toLowerCase().includes(term) ||
        (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(term)))
      );
    }
    if (filters.author !== "all") filtered = filtered.filter(p => p.createdBy === filters.author);
    if (filters.visibility !== "all") filtered = filtered.filter(p => (p.visibility || "public") === filters.visibility);
    if (filters.tags.trim()) {
      const searchTags = filters.tags.toLowerCase().split(",").map(t => t.trim()).filter(Boolean);
      filtered = filtered.filter(p =>
        Array.isArray(p.tags) && searchTags.some(st => p.tags.some(t => t.toLowerCase().includes(st)))
      );
    }
    if (filters.dateRange !== "all") {
      const now = new Date(), cutoff = new Date();
      if (filters.dateRange === "today") cutoff.setHours(0, 0, 0, 0);
      else if (filters.dateRange === "week") cutoff.setDate(now.getDate() - 7);
      else if (filters.dateRange === "month") cutoff.setMonth(now.getMonth() - 1);
      else if (filters.dateRange === "quarter") cutoff.setMonth(now.getMonth() - 3);
      filtered = filtered.filter(p => {
        if (!p.createdAt) return false;
        try {
          const d = typeof p.createdAt.toDate === 'function' ? p.createdAt.toDate()
                  : p.createdAt instanceof Date ? p.createdAt
                  : typeof p.createdAt === 'number' ? new Date(p.createdAt) : null;
          return d && d >= cutoff;
        } catch { return false; }
      });
    }
    if (filters.minLength && !isNaN(filters.minLength)) filtered = filtered.filter(p => (p.text?.length || 0) >= parseInt(filters.minLength));
    if (filters.maxLength && !isNaN(filters.maxLength)) filtered = filtered.filter(p => (p.text?.length || 0) <= parseInt(filters.maxLength));

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "newest": return getTimestamp(b) - getTimestamp(a);
        case "oldest": return getTimestamp(a) - getTimestamp(b);
        case "title": return (a.title || "").localeCompare(b.title || "");
        case "author":
          return (teamMembers[a.createdBy]?.name || teamMembers[a.createdBy]?.email || "")
            .localeCompare(teamMembers[b.createdBy]?.name || teamMembers[b.createdBy]?.email || "");
        case "length-asc": return (a.text?.length || 0) - (b.text?.length || 0);
        case "length-desc": return (b.text?.length || 0) - (a.text?.length || 0);
        default: return 0;
      }
    });
    return filtered;
  }

  function handleFilterChange(key, value) { setFilters(prev => ({ ...prev, [key]: value })); }
  function clearFilters() { setFilters({ author: "all", tags: "", dateRange: "all", sortBy: "newest", minLength: "", maxLength: "", visibility: "all" }); }
  function hasActiveFilters() {
    return filters.author !== "all" || filters.tags !== "" || filters.dateRange !== "all" ||
      filters.minLength !== "" || filters.maxLength !== "" || filters.visibility !== "all";
  }

  function scrollToFilters() {
    setShowFilters(true);
    setTimeout(() => filterCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  const allPrompts = useMemo(() => applyFilters([...demos, ...userPrompts]), [demos, userPrompts, searchQuery, filters, teamMembers]);
  const displayDemos = useMemo(() => allPrompts.filter(p => isDemoPrompt(p)), [allPrompts]);
  const displayUserPrompts = useMemo(() => allPrompts.filter(p => !isDemoPrompt(p)), [allPrompts]);
  const userPromptsPagination = usePagination(displayUserPrompts, 10);
  const demoPromptsPagination = usePagination(displayDemos, 5);

  const handleSelectPrompt = (promptId, isSel) => {
    setSelectedPrompts(prev => isSel ? [...prev, promptId] : prev.filter(id => id !== promptId));
  };

  const handleBulkDelete = async (promptIds) => {
    try {
      for (const id of promptIds) {
        if (isGuestMode) guestState.deletePrompt(id);
        else await deletePrompt(activeTeam, id);
      }
      if (isGuestMode) setUserPrompts(prev => prev.filter(p => !promptIds.includes(p.id)));
      setSelectedPrompts([]);
      showSuccessToast(`${promptIds.length} prompts deleted`);
    } catch { showNotification("Failed to delete some prompts", "error"); }
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
        const saved = guestState.addPrompt(userPrompt);
        setUserPrompts(prev => [saved, ...prev]);
        showSuccessToast('Demo copied! Edit it however you like.');
        setEditingPrompt(saved); setShowEditModal(true);
      } else {
        try { await savePrompt(user.uid, userPrompt, activeTeam); showSuccessToast('Demo copied!'); }
        catch { showNotification('Failed to save copied prompt', 'error'); }
      }
    });
  };

  async function handleCreate(e) {
    e.preventDefault();
    if (!newPrompt.title.trim() || !newPrompt.text.trim()) { showNotification("Title and prompt text are required", "error"); return; }
    try {
      if (isGuestMode) {
        const saved = guestState.addPrompt({ title: newPrompt.title.trim(), text: newPrompt.text.trim(), tags: newPrompt.tags.split(",").map(t => t.trim()).filter(Boolean), visibility: newPrompt.visibility });
        setUserPrompts(prev => [saved, ...prev]);
        checkSaveRequired('create_prompt', () => {});
      } else {
        await savePrompt(user.uid, { title: newPrompt.title.trim(), text: newPrompt.text.trim(), tags: newPrompt.tags.split(",").map(t => t.trim()).filter(Boolean), visibility: newPrompt.visibility }, activeTeam);
      }
      setNewPrompt({ title: "", tags: "", text: "", visibility: "public" });
      setShowCreateForm(false);
      showSuccessToast("Prompt created successfully!");
    } catch { showNotification("Failed to create prompt", "error"); }
  }

  async function handleUpdate(promptId, updates) {
    try {
      if (isGuestMode) { guestState.updatePrompt(promptId, updates); setUserPrompts(prev => prev.map(p => p.id === promptId ? { ...p, ...updates } : p)); }
      else await updatePromptFirestore(activeTeam, promptId, updates);
      setShowEditModal(false); setEditingPrompt(null);
      showSuccessToast("Prompt updated successfully!");
    } catch { showNotification("Failed to update prompt", "error"); }
  }

  async function handleDelete(promptId) {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    try {
      if (isGuestMode) { guestState.deletePrompt(promptId); setUserPrompts(prev => prev.filter(p => p.id !== promptId)); }
      else await deletePrompt(activeTeam, promptId);
      showSuccessToast("Prompt deleted");
    } catch { showNotification("Failed to delete prompt", "error"); }
  }

  async function handleToggleVisibility(promptId) {
    if (isGuestMode) { showNotification("Sign up to manage prompt visibility", "info"); return; }
    const prompt = allPrompts.find(p => p.id === promptId);
    if (!prompt) return;
    try { await togglePromptVisibility(activeTeam, promptId, prompt.visibility || "public"); showSuccessToast("Visibility updated"); }
    catch { showNotification("Failed to change visibility", "error"); }
  }

  async function handleCopy(text, promptId, isGuestUser = false) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Copied to clipboard!");
      if (activeTeam) {
        const guestToken = sessionStorage.getItem('guest_team_token');
        try { await trackPromptCopy(activeTeam, promptId, !!guestToken); } catch {}
      }
    } catch { showNotification("Failed to copy", "error"); }
  }

  function canEditPrompt(prompt) {
    if (isGuestMode) return canEditGuestPrompt(prompt);
    return prompt.createdBy === user.uid || userRole === "owner" || userRole === "admin";
  }

  function handleToggleComments(promptId) {
    if (isGuestMode && !activeTeam) { alert("Sign up to view and add comments!"); return; }
    setShowCommentSection(prev => ({ ...prev, [promptId]: !prev[promptId] }));
  }

  async function handleTrackView(promptId) {
    if (trackedViews.has(promptId)) return;
    setTrackedViews(prev => new Set([...prev, promptId]));
    if (activeTeam) {
      try { await updateDoc(doc(db, "teams", activeTeam, "prompts", promptId), { 'stats.views': increment(1) }); }
      catch { setTrackedViews(prev => { const s = new Set(prev); s.delete(promptId); return s; }); }
    }
  }

  async function handleImportPrompts(validPrompts) {
    if (isGuestMode) { validPrompts.forEach(p => guestState.addPrompt(p)); setUserPrompts(guestState.getPrompts()); return; }
    try { for (const p of validPrompts) await savePrompt(user.uid, p, activeTeam); }
    catch (e) { console.error("Import error:", e); throw e; }
  }

  function handleEnhance(prompt) {
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
  }

  function showSuccessToast(msg) { playNotification(); success(msg, 3000); }
  function showNotification(msg, type = "info") {
    playNotification();
    if (type === "error") error(msg, 3000);
    else if (type === "info") info(msg, 3000);
    else success(msg, 3000);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="skeleton-card h-48" />)}
      </div>
    );
  }

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== "sortBy" && v !== "" && v !== "all").length;

  return (
    <div className="prompt-list-container">

      {/* ── Header ── */}
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {isGuestMode
                ? `${displayDemos.length} demos · ${displayUserPrompts.length} yours`
                : `${displayUserPrompts.length} ${displayUserPrompts.length === 1 ? "prompt" : "prompts"}`}
              {hasActiveFilters() && <span className="text-primary font-medium"> · filtered</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isGuestMode && (userRole === "owner" || userRole === "admin") && onScrollToInvite && (
              <button onClick={onScrollToInvite} className="btn-secondary px-3 py-2 flex items-center gap-1.5 text-sm">
                <UserPlus className="w-4 h-4" /><span>Invite</span>
              </button>
            )}
            <button onClick={scrollToFilters}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm whitespace-nowrap transition-all ${hasActiveFilters() ? 'btn-primary' : 'btn-secondary'}`}>
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[1.1rem] text-center"
                  style={{ backgroundColor: "var(--primary-foreground)", color: "var(--primary)" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary px-4 py-2 flex items-center gap-1.5 text-sm">
              {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCreateForm ? "Cancel" : "Create Prompt"}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
          <input type="text" placeholder="Search prompts by title, content, or tag…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input pl-9 w-full" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground" style={{ color: "var(--muted-foreground)" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Create form ── */}
      {showCreateForm && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-base font-semibold mb-3" style={{ color: "var(--foreground)" }}>Create New Prompt</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input type="text" placeholder="Title *" className="form-input w-full"
              value={newPrompt.title} onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })} required />
            <textarea placeholder="Prompt text *" className="form-input w-full min-h-[120px]"
              value={newPrompt.text} onChange={(e) => setNewPrompt({ ...newPrompt, text: e.target.value })} required />
            <input type="text" placeholder="Tags (comma separated)" className="form-input w-full"
              value={newPrompt.tags} onChange={(e) => setNewPrompt({ ...newPrompt, tags: e.target.value })} />
            {!isGuestMode && (
              <div className="flex gap-4">
                {['public', 'private'].map(vis => (
                  <label key={vis} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" value={vis} checked={newPrompt.visibility === vis}
                      onChange={(e) => setNewPrompt({ ...newPrompt, visibility: e.target.value })} />
                    <span className="capitalize">{vis}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 text-sm">Create Prompt</button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary px-5 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bulk operations ── */}
      {!isGuestMode && displayUserPrompts.length > 0 && (
        <BulkOperations
          prompts={displayUserPrompts} selectedPrompts={selectedPrompts}
          onSelectionChange={setSelectedPrompts} onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport} userRole={userRole} userId={userId}
        />
      )}

      {/* ── Demo section ── */}
      {displayDemos.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Try These Examples</h3>
          </div>
          {demoPromptsPagination.currentItems.map(prompt => (
            <PromptCard key={prompt.id} prompt={prompt} outputs={[]} commentCount={0} isDemo={true}
              canEdit={false} author={null} isGuestMode={isGuestMode} activeTeam={activeTeam}
              userRole={userRole} onCopy={handleCopy} onDuplicate={handleDuplicateDemo}
              viewedPrompts={viewedPrompts} showCommentSection={false} onToggleComments={() => {}}
              openMenuId={openMenuId} onMenuToggle={setOpenMenuId} onTrackView={handleTrackView}
              onToggleFavourite={null} favouritePromptIds={favouritePromptIds} />
          ))}
          {displayDemos.length > 5 && (
            <div className="mt-4">
              <PaginationControls pagination={demoPromptsPagination} showSearch={false} showPageSizeSelector pageSizeOptions={[5, 10, 15]} />
            </div>
          )}
        </section>
      )}

      {/* ── User prompts section ── */}
      {displayUserPrompts.length > 0 && (
        <section>
          {isGuestMode && displayDemos.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Your Prompts</h3>
            </div>
          )}
          {userPromptsPagination.currentItems.map(prompt => (
            <PromptCard key={prompt.id} prompt={prompt} outputs={promptOutputs[prompt.id] || []}
              commentCount={promptComments[prompt.id] || 0} isDemo={false} canEdit={canEditPrompt(prompt)}
              author={teamMembers[prompt.createdBy]} isGuestMode={isGuestMode} activeTeam={activeTeam}
              userRole={userRole} onCopy={handleCopy}
              onEdit={(p) => { setEditingPrompt(p); setShowEditModal(true); }}
              onDelete={handleDelete} onToggleVisibility={handleToggleVisibility} onEnhance={handleEnhance}
              onViewOutputs={setViewOutputsPrompt}
              onAttachOutput={(p) => setSelectedPromptForAttach(p)}
              viewedPrompts={viewedPrompts}
              onMarkViewed={(id) => setViewedPrompts(prev => new Set([...prev, id]))}
              showCommentSection={showCommentSection[prompt.id] || false}
              onToggleComments={handleToggleComments}
              isSelected={selectedPrompts.includes(prompt.id)} onSelect={handleSelectPrompt}
              openMenuId={openMenuId} onMenuToggle={setOpenMenuId} onTrackView={handleTrackView}
              onToggleFavourite={handleToggleFavourite} favouritePromptIds={favouritePromptIds} />
          ))}
          {displayUserPrompts.length > 5 && (
            <div className="mt-4">
              <PaginationControls pagination={userPromptsPagination} showSearch={false} showPageSizeSelector showItemCount pageSizeOptions={[5, 10, 20, 50]} />
            </div>
          )}
        </section>
      )}

      {/* ── Empty state ── */}
      {allPrompts.length === 0 && (
        <div className="glass-card p-10 text-center mb-8">
          <Sparkles size={40} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
          <h3 className="text-base font-semibold mb-2">
            {searchQuery || hasActiveFilters() ? "No prompts match your search or filters" : "No prompts yet"}
          </h3>
          <p className="text-sm mb-5" style={{ color: "var(--muted-foreground)" }}>
            {searchQuery || hasActiveFilters() ? (
              <><span>Try adjusting your search or </span>
              <button onClick={() => { setSearchQuery(''); clearFilters(); }} className="text-primary hover:underline">clear all filters</button></>
            ) : "Create your first prompt to get started"}
          </p>
          {!searchQuery && !hasActiveFilters() && (
            <button onClick={() => setShowCreateForm(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4" />Create First Prompt
            </button>
          )}
        </div>
      )}

      {/* ── Filter card ── */}
      <div ref={filterCardRef}>
        <FilterCard filters={filters} onFilterChange={handleFilterChange} onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters()} filteredCount={allPrompts.length}
          teamMembers={teamMembers} isExpanded={showFilters} onToggleExpanded={() => setShowFilters(!showFilters)} />
      </div>

      {/* ── Export/Import ── */}
      <div ref={importCardRef}>
        <ExportImport onImport={handleImportPrompts} teamId={activeTeam} teamName={teamName} userRole={userRole} />
      </div>

      {/* ── Modals ── */}
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
      {viewOutputsPrompt && (
        <ViewOutputsModal isOpen={!!viewOutputsPrompt} onClose={() => setViewOutputsPrompt(null)}
          prompt={viewOutputsPrompt} teamId={activeTeam} userRole={userRole} isGuestMode={isGuestMode}
          onAttachNew={isGuestMode ? null : () => { setViewOutputsPrompt(null); setSelectedPromptForAttach(viewOutputsPrompt); }} />
      )}
      {showAIEnhancer && currentPromptForAI && (
        <AIPromptEnhancer prompt={currentPromptForAI}
          onApply={async (enhanced) => { await handleUpdate(enhanced.id, enhanced); setShowAIEnhancer(false); }}
          onSaveAsNew={(enhanced) => {
            if (isGuestMode) { const p = guestState.addPrompt(enhanced); setUserPrompts(prev => [p, ...prev]); }
            else savePrompt(user.uid, enhanced, activeTeam);
            setShowAIEnhancer(false); showSuccessToast("Enhanced prompt saved!");
          }}
          onClose={() => { setShowAIEnhancer(false); setCurrentPromptForAI(null); }} />
      )}

      {/* ── Scoped styles ── */}
      <style>{`
        .prompt-card-dense {
          margin-bottom: 0.75rem;
          overflow: hidden;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: var(--card);
          transition: box-shadow 0.15s, border-color 0.15s;
        }
        .prompt-card-dense:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          border-color: var(--primary-20, color-mix(in srgb, var(--primary) 20%, transparent));
        }
        .prompt-card-dense.new .prompt-card-meta-bar {
          border-left: 3px solid var(--primary);
        }
        .prompt-card-dense.viewed .prompt-card-meta-bar {
          border-left: 3px solid transparent;
        }

        /* Output sidebar */
        .prompt-output-sidebar {
          background: var(--muted-10, color-mix(in srgb, var(--muted) 40%, transparent));
          min-height: 120px;
        }

        /* Output strip (compact, below text) */
        .output-strip,
        .output-strip-empty,
        .output-strip-locked {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.375rem 0.5rem;
          border-radius: 0.5rem;
          border: 1px dashed var(--border);
          background: transparent;
          cursor: pointer;
          font-size: 0.7rem;
          color: var(--muted-foreground);
          transition: background 0.15s, border-color 0.15s;
          text-align: left;
          margin-top: 0.5rem;
        }
        .output-strip:hover {
          background: var(--muted);
          border-color: var(--primary-30, color-mix(in srgb, var(--primary) 30%, transparent));
        }
        .output-strip-empty:hover {
          background: var(--muted);
        }
        .output-strip-locked {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .output-strip-thumb {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .output-strip-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .output-strip-title {
          font-weight: 600;
          color: var(--foreground);
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .output-strip-preview {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          opacity: 0.7;
        }
        .output-strip-count {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
          font-weight: 600;
          color: var(--primary);
        }

        /* Kebab upward override */
        .kebab-menu-upward {
          bottom: calc(100% + 6px) !important;
          top: auto !important;
          transform-origin: bottom right;
          animation: menuUpIn 0.15s ease-out;
        }
        @keyframes menuUpIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Compact privacy badge */
        .privacy-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.65rem;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          font-weight: 600;
        }
        .privacy-badge.private {
          background: rgba(239,68,68,0.12);
          color: rgb(239,68,68);
        }
        .privacy-badge.public {
          background: rgba(34,197,94,0.12);
          color: rgb(34,197,94);
        }

        /* Fade in animation */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Read more button */
        .read-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: var(--primary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          opacity: 0.85;
          transition: opacity 0.15s;
        }
        .read-more-btn:hover { opacity: 1; }

        /* Tags */
        .prompt-tag {
          display: inline-flex;
          align-items: center;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 500;
          background: var(--muted);
          color: var(--muted-foreground);
          border: 1px solid var(--border);
        }
        .prompt-tag-more {
          display: inline-flex;
          align-items: center;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 500;
          background: var(--muted);
          color: var(--primary);
          border: 1px dashed var(--border);
        }

        /* Demo badge */
        .demo-badge-small {
          display: inline-flex;
          align-items: center;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 600;
          background: rgba(var(--primary-rgb, 99,102,241),0.15);
          color: var(--primary);
          border: 1px solid rgba(var(--primary-rgb, 99,102,241),0.3);
        }

        /* Responsive: stack output sidebar below content on mobile */
        @media (max-width: 600px) {
          .prompt-card-body {
            grid-template-columns: 1fr !important;
          }
          .prompt-output-sidebar {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid var(--border) !important;
            min-height: unset !important;
          }
        }
`}
