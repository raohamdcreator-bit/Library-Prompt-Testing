// src/components/PromptList.jsx - Redesigned: column-based dense layout, max info on first view

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

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function UserAvatar({ src, name, email, size = "sm" }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const dim = size === "sm" ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs";

  if (!src || imageError) {
    return (
      <div className={`${dim} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
        style={{ backgroundColor: "var(--primary)" }}>
        {getUserInitials(name, email)}
      </div>
    );
  }
  return (
    <>
      {!imageLoaded && (
        <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0`}
          style={{ backgroundColor: "var(--muted)" }}>
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        </div>
      )}
      <img src={src} alt={`${name || email}'s avatar`}
        className={`${dim} rounded-full object-cover border border-border/50 flex-shrink-0 ${imageLoaded ? 'block' : 'hidden'}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </>
  );
}

function CopyButton({ text, promptId, onCopy, isGuestMode }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await onCopy(text, promptId, isGuestMode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
      style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function MiniStars({ rating = 0, size = 11 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size}
          fill={s <= Math.round(rating) ? "#f59e0b" : "none"}
          color={s <= Math.round(rating) ? "#f59e0b" : "#4b5563"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function Chip({ label, color = "var(--secondary)", textColor = "var(--muted-foreground)" }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: color, color: textColor }}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RatingStatsBar — compact collapsible
// ─────────────────────────────────────────────────────────────────────────────

function RatingStatsBar({ ratings = {}, totalRatings = 0, averageRating = 0, isExpanded, onToggle }) {
  const ratingCounts = { 5: ratings[5] || 0, 4: ratings[4] || 0, 3: ratings[3] || 0, 2: ratings[2] || 0, 1: ratings[1] || 0 };
  const maxCount = Math.max(...Object.values(ratingCounts), 1);

  if (totalRatings === 0) return null;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs"
        style={{ color: "var(--foreground)" }}>
        <div className="flex items-center gap-2">
          <TrendIcon className="w-3 h-3" style={{ color: "var(--primary)" }} />
          <span className="font-medium">Rating Distribution</span>
          <Chip label={`${totalRatings} ratings`} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold">{averageRating.toFixed(1)}</span>
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1 border-t" style={{ borderColor: "var(--border)" }}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars];
            const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-[10px] w-3 text-right" style={{ color: "var(--foreground)" }}>{stars}</span>
                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      backgroundColor: stars >= 4 ? 'rgba(34,197,94,0.7)' : stars === 3 ? 'rgba(251,191,36,0.7)' : 'rgba(239,68,68,0.7)',
                    }} />
                </div>
                <span className="text-[10px] w-8 text-right" style={{ color: "var(--muted-foreground)" }}>
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OutputPreviewPanel — compact
// ─────────────────────────────────────────────────────────────────────────────

function OutputPreviewPanel({ outputs, onViewAll, isGuestMode = false }) {
  if (!outputs || outputs.length === 0) {
    if (isGuestMode) return null;
    return (
      <button onClick={onViewAll}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-xs transition-all hover:border-primary/50"
        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <Plus className="w-3 h-3" />
        <span>Attach first output</span>
      </button>
    );
  }

  const latest = outputs[0];
  const typeIcon = { text: <FileText className="w-3 h-3 text-blue-400" />, code: <Code className="w-3 h-3 text-purple-400" />, image: <ImageIcon className="w-3 h-3 text-pink-400" /> }[latest.type] || <FileText className="w-3 h-3" />;

  return (
    <button onClick={onViewAll}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all hover:border-primary/50 text-left"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
      {typeIcon}
      <span className="flex-1 truncate" style={{ color: "var(--foreground)" }}>{latest.title || "Untitled output"}</span>
      <Chip label={`${outputs.length} output${outputs.length !== 1 ? 's' : ''}`} />
      <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineRating
// ─────────────────────────────────────────────────────────────────────────────

function InlineRating({ teamId, promptId, isGuestMode }) {
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

  const display = hoverRating || userRating || 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={isSubmitting}
            className="transition-transform hover:scale-110">
            <Star size={12}
              fill={star <= display ? "#f59e0b" : "none"}
              color={star <= display ? "#f59e0b" : "#6b7280"}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      {totalRatings > 0 && (
        <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
          {averageRating.toFixed(1)} ({totalRatings})
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpandedCommentsSection
// ─────────────────────────────────────────────────────────────────────────────

function ExpandedCommentsSection({ promptId, teamId, commentCount, onClose, userRole }) {
  return (
    <div className="mt-2 p-3 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            Comments ({commentCount})
          </span>
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:opacity-70 transition-opacity">
          <X className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>
      <Comments teamId={teamId} promptId={promptId} userRole={userRole} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AIAnalysisSection — compact collapsible
// ─────────────────────────────────────────────────────────────────────────────

function AIAnalysisSection({ text, isExpanded, onToggle, onEnhance }) {
  const stats = useMemo(() => {
    if (!text) return null;
    const tokens = TokenEstimator.estimateTokens(text, "gpt-4");
    const cost = TokenEstimator.estimateCost(text, "gpt-4");
    const recommendations = TokenEstimator.getRecommendations(text);
    const compatibleModels = Object.keys(AI_MODELS).filter(m => TokenEstimator.fitsInContext(text, m)).length;
    return {
      tokens, cost,
      bestModel: recommendations[0]?.model || "gpt-4",
      bestModelReason: recommendations[0]?.reason || "Recommended",
      compatibleModels,
      totalModels: Object.keys(AI_MODELS).length,
    };
  }, [text]);

  if (!stats) return null;
  const compat = Math.round((stats.compatibleModels / stats.totalModels) * 100);
  const BestIcon = AI_MODELS[stats.bestModel]?.icon || Cpu;
  const BestConfig = AI_MODELS[stats.bestModel];
  const compatColor = compat >= 80 ? '#22c55e' : compat >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs"
        style={{ color: "var(--foreground)" }}>
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3" style={{ color: "var(--primary)" }} />
          <span className="font-medium">AI Analysis</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${compatColor}20`, color: compatColor }}>
            {compat}% compat.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{stats.tokens.toLocaleString()} tokens</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              { icon: <TrendingUp className="w-3 h-3" />, label: "Tokens", value: stats.tokens.toLocaleString() },
              { icon: <DollarSign className="w-3 h-3" />, label: "Est. Cost", value: `$${stats.cost.toFixed(4)}` },
              { icon: <Target className="w-3 h-3" />,     label: "Compatible", value: `${stats.compatibleModels}/${stats.totalModels}` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="p-2 rounded text-center" style={{ backgroundColor: "var(--secondary)" }}>
                <div className="flex justify-center mb-1" style={{ color: "var(--muted-foreground)" }}>{icon}</div>
                <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
                <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="p-2 rounded border" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <BestIcon className="w-3 h-3" style={{ color: "var(--primary)" }} />
              <span className="text-[10px] font-semibold" style={{ color: "var(--foreground)" }}>
                {BestConfig?.name} · {BestConfig?.provider}
              </span>
            </div>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{stats.bestModelReason}</p>
          </div>
          {onEnhance && (
            <button onClick={(e) => { e.stopPropagation(); onEnhance(); }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
              <Sparkles className="w-3 h-3" style={{ color: "var(--primary)" }} />
              View Detailed Analysis & Enhancement
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptCard — column-based dense layout
// ─────────────────────────────────────────────────────────────────────────────

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
  const shouldTruncate = prompt.text.length > 180;
  const displayText = isTextExpanded ? prompt.text : prompt.text.slice(0, 180);
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
    <article className={`glass-card mb-2 overflow-hidden transition-all duration-200 ${isViewed ? 'opacity-90' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
      style={{ borderLeft: isPrivate ? '3px solid var(--muted-foreground)' : '3px solid var(--primary)' }}>

      {/* ── Two-column layout: main content + sidebar ── */}
      <div className="flex gap-0">

        {/* ── LEFT: Main content ── */}
        <div className="flex-1 min-w-0 p-3">

          {/* Header row: selector + author + badges + privacy */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {onSelect && !isDemo && (
              <PromptSelector promptId={prompt.id} isSelected={isSelected} onSelectionChange={onSelect} />
            )}
            {!isDemo && author && (
              <>
                <UserAvatar src={author?.avatar} name={author?.name} email={author?.email} size="sm" />
                <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: "var(--foreground)" }}>
                  {isGuestMode ? "You" : (author?.name || author?.email || "Unknown")}
                </span>
              </>
            )}
            <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              <Clock className="w-2.5 h-2.5" />
              {getRelativeTime(prompt.createdAt)}
            </div>
            {!isGuestMode && !isDemo && (
              <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                <span className="hidden sm:inline">{isPrivate ? 'Private' : 'Public'}</span>
              </div>
            )}
            {badge && <Chip label={badge.label} color="color-mix(in srgb, var(--primary) 15%, transparent)" textColor="var(--primary)" />}
            {!isDemo && prompt.enhanced && (
              <EnhancedBadge enhanced={prompt.enhanced} enhancedFor={prompt.enhancedFor}
                enhancementType={prompt.enhancementType} size="sm" />
            )}
            {/* Spacer + metadata right-aligned */}
            <div className="ml-auto flex items-center gap-2">
              {totalRatings > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>
                    {averageRating.toFixed(1)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                <MessageSquare className="w-3 h-3" />
                <span className="text-[10px]">{commentCount}</span>
              </div>
              <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                <Eye className="w-3 h-3" />
                <span className="text-[10px]">{prompt.stats?.views || 0}</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug mb-1.5" style={{ color: "var(--foreground)" }}>
            {prompt.title}
          </h3>

          {/* Prompt text */}
          <div className="text-xs leading-relaxed mb-2" style={{ color: "var(--muted-foreground)" }}>
            {displayText}
            {!isTextExpanded && shouldTruncate && <span>…</span>}
          </div>
          {shouldTruncate && (
            <button
              onClick={() => {
                setIsTextExpanded(!isTextExpanded);
                if (!isTextExpanded && onTrackView) onTrackView(prompt.id);
              }}
              className="flex items-center gap-1 text-[10px] mb-2 transition-colors hover:opacity-80"
              style={{ color: "var(--primary)" }}>
              {isTextExpanded ? "Show less" : "Read more"}
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isTextExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {prompt.tags.slice(0, 5).map((tag, idx) => (
                <Chip key={idx} label={`#${tag}`} />
              ))}
              {prompt.tags.length > 5 && <Chip label={`+${prompt.tags.length - 5}`} />}
            </div>
          )}

          {/* Collapsible sections */}
          {!isDemo && (
            <div className="space-y-1.5">
              <AIAnalysisSection
                text={prompt.text}
                isExpanded={showAIAnalysis}
                onToggle={() => setShowAIAnalysis(!showAIAnalysis)}
                onEnhance={isGuestMode && activeTeam ? null : () => onEnhance && onEnhance(prompt)}
              />
              {activeTeam && (
                <RatingStatsBar
                  ratings={ratingDistribution}
                  totalRatings={totalRatings}
                  averageRating={averageRating}
                  isExpanded={showRatingStats}
                  onToggle={() => setShowRatingStats(!showRatingStats)}
                />
              )}
              <OutputPreviewPanel
                outputs={outputs}
                onViewAll={() => onViewOutputs && onViewOutputs(prompt)}
                isGuestMode={isGuestMode}
              />
            </div>
          )}

          {/* Comment section */}
          {showCommentSection && !isDemo && activeTeam && (
            <ExpandedCommentsSection
              promptId={prompt.id} teamId={activeTeam}
              commentCount={commentCount}
              onClose={() => onToggleComments(prompt.id)}
              userRole={userRole}
            />
          )}
        </div>

        {/* ── RIGHT sidebar: actions ── */}
        <div className="flex flex-col gap-1 p-2 border-l flex-shrink-0"
          style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--muted) 40%, transparent)", minWidth: 44 }}>

          <CopyButton text={prompt.text} promptId={prompt.id} onCopy={onCopy} isGuestMode={isGuestMode} />

          {isDemo ? (
            <button onClick={() => onDuplicate && onDuplicate(prompt)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Use</span>
            </button>
          ) : (
            <>
              {/* Enhance */}
              {isGuestMode && activeTeam ? (
                <button onClick={() => alert("Sign up to enhance prompts!")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                  <Lock className="w-3 h-3" />
                  <Sparkles className="w-3 h-3" />
                </button>
              ) : (
                <button onClick={() => onEnhance(prompt)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                  <Sparkles className="w-3 h-3" style={{ color: "var(--primary)" }} />
                  <span className="hidden sm:inline">Enhance</span>
                </button>
              )}

              {/* Rating row */}
              {activeTeam && (
                <div className="px-1 py-1">
                  <InlineRating teamId={activeTeam} promptId={prompt.id} isGuestMode={isGuestMode} />
                </div>
              )}

              {/* Comment */}
              {isGuestMode && !activeTeam ? (
                <button onClick={() => alert("Sign up to comment!")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                  <Lock className="w-3 h-3" />
                  <MessageSquare className="w-3 h-3" />
                </button>
              ) : (
                <button onClick={() => onToggleComments(prompt.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                  style={{ backgroundColor: showCommentSection ? "var(--primary)" : "var(--secondary)", color: showCommentSection ? "var(--primary-foreground)" : "var(--foreground)" }}>
                  <MessageSquare className="w-3 h-3" />
                  <span className="hidden sm:inline">Comment</span>
                </button>
              )}

              {/* Kebab menu */}
              <div className="relative mt-auto" ref={menuRef}>
                <button
                  onClick={() => onMenuToggle(showMenu ? null : prompt.id)}
                  className="flex items-center justify-center w-full px-2.5 py-1.5 rounded text-xs transition-all hover:opacity-80"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  aria-expanded={showMenu}>
                  <MoreVertical className="w-3 h-3" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-1 w-44 rounded-lg border shadow-lg z-50"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>

                    {/* Favourite */}
                    {!isGuestMode && onToggleFavourite && (
                      <>
                        <button onClick={() => { onToggleFavourite(prompt.id, prompt.teamId || activeTeam); onMenuToggle(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                          style={{ color: isFavourited ? "#f59e0b" : "var(--foreground)" }}>
                          <Star className={`w-3.5 h-3.5 ${isFavourited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                          {isFavourited ? 'Remove Favourite' : 'Mark Favourite'}
                        </button>
                        <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                      </>
                    )}

                    {outputs.length > 0 && (
                      <>
                        <button onClick={() => { onViewOutputs(prompt); onMenuToggle(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                          style={{ color: "var(--foreground)" }}>
                          <FileText className="w-3.5 h-3.5" />
                          View Outputs ({outputs.length})
                        </button>
                        <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                      </>
                    )}

                    {isGuestMode ? (
                      <button onClick={() => { alert("Sign up to attach outputs!"); onMenuToggle(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs opacity-50 cursor-not-allowed text-left"
                        style={{ color: "var(--foreground)" }}>
                        <Lock className="w-3 h-3" /><Plus className="w-3.5 h-3.5" /> Attach Output
                      </button>
                    ) : (
                      <button onClick={() => { onAttachOutput(prompt); onMenuToggle(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                        style={{ color: "var(--foreground)" }}>
                        <Plus className="w-3.5 h-3.5" /> Attach Output
                      </button>
                    )}

                    <div className="h-px" style={{ backgroundColor: "var(--border)" }} />

                    {!isGuestMode && (
                      <button onClick={() => { onToggleVisibility(prompt.id); onMenuToggle(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                        style={{ color: "var(--foreground)" }}>
                        {isPrivate ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        Make {isPrivate ? "Public" : "Private"}
                      </button>
                    )}

                    {canEdit && (
                      <>
                        <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                        <button onClick={() => { onEdit(prompt); onMenuToggle(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                          style={{ color: "var(--foreground)" }}>
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => { onDelete(prompt.id); onMenuToggle(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                          style={{ color: "#ef4444" }}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
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

// ─────────────────────────────────────────────────────────────────────────────
// FilterCard — compact inline version
// ─────────────────────────────────────────────────────────────────────────────

function FilterCard({ filters, onFilterChange, onClearFilters, hasActiveFilters, filteredCount, teamMembers, isExpanded, onToggleExpanded }) {
  const authors = Object.entries(teamMembers).map(([uid, m]) => ({ uid, name: m.name || m.email }));
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sortBy" && v !== "" && v !== "all").length;

  return (
    <div className="glass-card p-3 mb-3" id="filter-card">
      <button onClick={onToggleExpanded}
        className="w-full flex items-center justify-between text-xs"
        style={{ color: "var(--foreground)" }}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
          <span className="font-semibold">Advanced Filters</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
              {activeCount}
            </span>
          )}
          {activeCount > 0 && (
            <span style={{ color: "var(--muted-foreground)" }}>{filteredCount} results</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {/* Sort */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
              <BarChart2 className="w-3 h-3" /> Sort By
            </label>
            <select value={filters.sortBy} onChange={e => onFilterChange("sortBy", e.target.value)} className="form-input w-full text-xs py-1.5">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
              <option value="author">Author A-Z</option>
              <option value="length-desc">Longest First</option>
              <option value="length-asc">Shortest First</option>
            </select>
          </div>

          {/* Grid of filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { key: "author", label: "Author", icon: <User className="w-3 h-3" />, type: "select",
                options: [{ value: "all", label: "All Authors" }, ...authors.map(a => ({ value: a.uid, label: a.name }))] },
              { key: "visibility", label: "Visibility", icon: <Lock className="w-3 h-3" />, type: "select",
                options: [{ value: "all", label: "All" }, { value: "public", label: "Public" }, { value: "private", label: "Private" }] },
              { key: "dateRange", label: "Created", icon: <Calendar className="w-3 h-3" />, type: "select",
                options: [{ value: "all", label: "Any Time" }, { value: "today", label: "Today" }, { value: "week", label: "Past Week" }, { value: "month", label: "Past Month" }, { value: "quarter", label: "Past 3 Months" }] },
            ].map(({ key, label, icon, type, options }) => (
              <div key={key}>
                <label className="flex items-center gap-1 text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                  {icon} {label}
                </label>
                <select value={filters[key]} onChange={e => onFilterChange(key, e.target.value)} className="form-input w-full text-xs py-1.5">
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}

            <div>
              <label className="flex items-center gap-1 text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                <Tag className="w-3 h-3" /> Tags
              </label>
              <input type="text" placeholder="writing, creative…" value={filters.tags}
                onChange={e => onFilterChange("tags", e.target.value)}
                className="form-input w-full text-xs py-1.5" />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                <Ruler className="w-3 h-3" /> Min Chars
              </label>
              <input type="number" placeholder="0" value={filters.minLength}
                onChange={e => onFilterChange("minLength", e.target.value)}
                className="form-input w-full text-xs py-1.5" min="0" />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                <Ruler className="w-3 h-3" /> Max Chars
              </label>
              <input type="number" placeholder="No limit" value={filters.maxLength}
                onChange={e => onFilterChange("maxLength", e.target.value)}
                className="form-input w-full text-xs py-1.5" min="0" />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <button onClick={onClearFilters}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded transition-all hover:opacity-80"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                <X className="w-3 h-3" /> Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PromptList Component
// ─────────────────────────────────────────────────────────────────────────────

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
  const [showRatingsSection, setShowRatingsSection] = useState({});
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
      setFavouritePromptIds(new Set(snap.docs.map(d => d.id)));
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
      const data = snap.docs.map(d => ({ id: d.id, teamId: activeTeam, ...d.data() }));
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
    const unsubscribers = userPrompts.map(p =>
      subscribeToResults(activeTeam, p.id, (results) => {
        setPromptOutputs(prev => ({ ...prev, [p.id]: results }));
      })
    );
    return () => unsubscribers.forEach(u => u());
  }, [userPrompts, activeTeam]);

  // Load comment counts
  useEffect(() => {
    if (!activeTeam) return;
    const unsubscribers = userPrompts.map(p => {
      const q = query(collection(db, "teams", activeTeam, "prompts", p.id, "comments"));
      return onSnapshot(q, snap => {
        setPromptComments(prev => ({ ...prev, [p.id]: snap.docs.length }));
      });
    });
    return () => unsubscribers.forEach(u => u());
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
      } catch (err) { console.error("Error loading team data:", err); }
    }
    loadTeamData();
  }, [activeTeam, isGuestMode, user]);

  // Toggle favourite
  async function handleToggleFavourite(promptId, teamId) {
    if (!user) { showNotification("Sign up to save favourites", "info"); return; }
    const favRef = doc(db, "users", user.uid, "favourites", promptId);
    const isCurrentlyFaved = favouritePromptIds.has(promptId);
    setFavouritePromptIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyFaved) next.delete(promptId); else next.add(promptId);
      return next;
    });
    try {
      if (isCurrentlyFaved) { await deleteDoc(favRef); showSuccessToast("Removed from favourites"); }
      else {
        await setDoc(favRef, { promptId, teamId: teamId || activeTeam, addedAt: serverTimestamp() });
        showSuccessToast("Added to favourites ★");
      }
    } catch (err) {
      console.error("Error toggling favourite:", err);
      setFavouritePromptIds(prev => {
        const next = new Set(prev);
        if (isCurrentlyFaved) next.add(promptId); else next.delete(promptId);
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
      const now = new Date(); const cutoff = new Date();
      switch (filters.dateRange) {
        case "today": cutoff.setHours(0, 0, 0, 0); break;
        case "week": cutoff.setDate(now.getDate() - 7); break;
        case "month": cutoff.setMonth(now.getMonth() - 1); break;
        case "quarter": cutoff.setMonth(now.getMonth() - 3); break;
      }
      filtered = filtered.filter(p => {
        if (!p.createdAt) return false;
        try {
          let d;
          if (typeof p.createdAt.toDate === 'function') d = p.createdAt.toDate();
          else if (p.createdAt instanceof Date) d = p.createdAt;
          else if (typeof p.createdAt === 'number') d = new Date(p.createdAt);
          else return false;
          return d >= cutoff;
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
          return (teamMembers[a.createdBy]?.name || teamMembers[a.createdBy]?.email || "").localeCompare(teamMembers[b.createdBy]?.name || teamMembers[b.createdBy]?.email || "");
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

  const allPrompts = useMemo(() => applyFilters([...demos, ...userPrompts]),
    [demos, userPrompts, searchQuery, filters, teamMembers]);
  const displayDemos = useMemo(() => allPrompts.filter(p => isDemoPrompt(p)), [allPrompts]);
  const displayUserPrompts = useMemo(() => allPrompts.filter(p => !isDemoPrompt(p)), [allPrompts]);

  const userPromptsPagination = usePagination(displayUserPrompts, 10);
  const demoPromptsPagination = usePagination(displayDemos, 5);

  function handleSelectPrompt(promptId, isSelected) {
    setSelectedPrompts(prev => isSelected ? [...prev, promptId] : prev.filter(id => id !== promptId));
  }

  async function handleBulkDelete(promptIds) {
    try {
      for (const promptId of promptIds) {
        if (isGuestMode) guestState.deletePrompt(promptId);
        else await deletePrompt(activeTeam, promptId);
      }
      if (isGuestMode) setUserPrompts(prev => prev.filter(p => !promptIds.includes(p.id)));
      setSelectedPrompts([]);
      showSuccessToast(`${promptIds.length} prompts deleted`);
    } catch { showNotification("Failed to delete some prompts", "error"); }
  }

  function handleBulkExport(prompts, format) {
    if (format === 'json') ExportUtils.exportAsJSON(prompts, `prompts-${Date.now()}`);
    else if (format === 'csv') ExportUtils.exportAsCSV(prompts, `prompts-${Date.now()}`);
    else if (format === 'txt') ExportUtils.exportAsTXT(prompts, `prompts-${Date.now()}`);
  }

  function handleDuplicateDemo(demoPrompt) {
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
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newPrompt.title.trim() || !newPrompt.text.trim()) { showNotification("Title and text required", "error"); return; }
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
      showSuccessToast("Prompt created!");
    } catch { showNotification("Failed to create prompt", "error"); }
  }

  async function handleUpdate(promptId, updates) {
    try {
      if (isGuestMode) { guestState.updatePrompt(promptId, updates); setUserPrompts(prev => prev.map(p => p.id === promptId ? { ...p, ...updates } : p)); }
      else await updatePromptFirestore(activeTeam, promptId, updates);
      setShowEditModal(false); setEditingPrompt(null);
      showSuccessToast("Prompt updated!");
    } catch { showNotification("Failed to update prompt", "error"); }
  }

  async function handleDelete(promptId) {
    if (!confirm("Delete this prompt?")) return;
    try {
      if (isGuestMode) { guestState.deletePrompt(promptId); setUserPrompts(prev => prev.filter(p => p.id !== promptId)); }
      else await deletePrompt(activeTeam, promptId);
      showSuccessToast("Prompt deleted");
    } catch { showNotification("Failed to delete prompt", "error"); }
  }

  async function handleToggleVisibility(promptId) {
    if (isGuestMode) { showNotification("Sign up to manage visibility", "info"); return; }
    const prompt = allPrompts.find(p => p.id === promptId);
    if (!prompt) return;
    try { await togglePromptVisibility(activeTeam, promptId, prompt.visibility || "public"); showSuccessToast("Visibility updated"); }
    catch { showNotification("Failed to change visibility", "error"); }
  }

  async function handleCopy(text, promptId, isGuestUser = false) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Copied!");
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

  function handleEnhance(prompt) { setCurrentPromptForAI(prompt); setShowAIEnhancer(true); }
  function handleViewOutputs(prompt) { setViewOutputsPrompt(prompt); }

  async function handleTrackView(promptId) {
    if (trackedViews.has(promptId)) return;
    setTrackedViews(prev => new Set([...prev, promptId]));
    if (activeTeam) {
      try {
        await updateDoc(doc(db, "teams", activeTeam, "prompts", promptId), { 'stats.views': increment(1) });
      } catch {
        setTrackedViews(prev => { const s = new Set(prev); s.delete(promptId); return s; });
      }
    }
  }

  async function handleImportPrompts(validPrompts) {
    if (isGuestMode) { validPrompts.forEach(p => guestState.addPrompt(p)); setUserPrompts(guestState.getPrompts()); return; }
    try { for (const p of validPrompts) await savePrompt(user.uid, p, activeTeam); }
    catch (err) { console.error("Import error:", err); throw err; }
  }

  function showSuccessToast(message) { playNotification(); success(message, 3000); }
  function showNotification(message, type = "info") {
    playNotification();
    if (type === "error") error(message, 3000);
    else if (type === "info") info(message, 3000);
    else success(message, 3000);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="skeleton-card h-28" />)}
      </div>
    );
  }

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== "sortBy" && v !== "" && v !== "all").length;

  return (
    <div className="prompt-list-container">

      {/* ── Compact header bar ── */}
      <div className="glass-card px-4 py-3 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title + count */}
          <div className="flex items-center gap-2 mr-2">
            <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
              {isGuestMode
                ? `${displayDemos.length} demos · ${displayUserPrompts.length} yours`
                : `${displayUserPrompts.length} prompt${displayUserPrompts.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input pl-8 py-1.5 text-xs w-full" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
              {showCreateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showCreateForm ? "Cancel" : "New Prompt"}</span>
            </button>

            <button onClick={scrollToFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: activeFilterCount > 0 ? "var(--primary)" : "var(--secondary)",
                color: activeFilterCount > 0 ? "var(--primary-foreground)" : "var(--foreground)",
              }}>
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold"
                  style={{ backgroundColor: "var(--primary-foreground)", color: "var(--primary)" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {!isGuestMode && (userRole === "owner" || userRole === "admin") && onScrollToInvite && (
              <button onClick={onScrollToInvite}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Create form ── */}
      {showCreateForm && (
        <div className="glass-card p-4 mb-3">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>New Prompt</h3>
          <form onSubmit={handleCreate} className="space-y-2.5">
            <input type="text" placeholder="Title *" className="form-input text-xs py-2 w-full"
              value={newPrompt.title} onChange={e => setNewPrompt({ ...newPrompt, title: e.target.value })} required />
            <textarea placeholder="Prompt text *" className="form-input text-xs py-2 min-h-[100px] w-full"
              value={newPrompt.text} onChange={e => setNewPrompt({ ...newPrompt, text: e.target.value })} required />
            <div className="flex gap-2">
              <input type="text" placeholder="Tags (comma separated)" className="form-input text-xs py-2 flex-1"
                value={newPrompt.tags} onChange={e => setNewPrompt({ ...newPrompt, tags: e.target.value })} />
              {!isGuestMode && (
                <div className="flex items-center gap-3 px-3 py-2 rounded border text-xs"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  {['public', 'private'].map(v => (
                    <label key={v} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" value={v} checked={newPrompt.visibility === v}
                        onChange={e => setNewPrompt({ ...newPrompt, visibility: e.target.value })} />
                      {v}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded text-xs font-medium"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                Create
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded text-xs font-medium"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                Cancel
              </button>
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

      {/* ── Demo prompts section ── */}
      {displayDemos.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Try These Examples</span>
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{displayDemos.length} demos</span>
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
            <div className="mt-2">
              <PaginationControls pagination={demoPromptsPagination} showSearch={false}
                showPageSizeSelector={true} showItemCount={true} pageSizeOptions={[5, 10, 15]} />
            </div>
          )}
        </section>
      )}

      {/* ── User prompts section ── */}
      {displayUserPrompts.length > 0 && (
        <section>
          {isGuestMode && displayDemos.length > 0 && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Your Prompts</span>
            </div>
          )}
          {userPromptsPagination.currentItems.map(prompt => (
            <PromptCard key={prompt.id} prompt={prompt} outputs={promptOutputs[prompt.id] || []}
              commentCount={promptComments[prompt.id] || 0} isDemo={false} canEdit={canEditPrompt(prompt)}
              author={teamMembers[prompt.createdBy]} isGuestMode={isGuestMode} activeTeam={activeTeam}
              userRole={userRole} onCopy={handleCopy} onEdit={p => { setEditingPrompt(p); setShowEditModal(true); }}
              onDelete={handleDelete} onToggleVisibility={handleToggleVisibility} onEnhance={handleEnhance}
              onViewOutputs={handleViewOutputs} onAttachOutput={p => setSelectedPromptForAttach(p)}
              viewedPrompts={viewedPrompts} onMarkViewed={id => setViewedPrompts(prev => new Set([...prev, id]))}
              showCommentSection={showCommentSection[prompt.id] || false} onToggleComments={handleToggleComments}
              isSelected={selectedPrompts.includes(prompt.id)} onSelect={handleSelectPrompt}
              openMenuId={openMenuId} onMenuToggle={setOpenMenuId} onTrackView={handleTrackView}
              onToggleFavourite={handleToggleFavourite} favouritePromptIds={favouritePromptIds} />
          ))}
        </section>
      )}

      {/* ── Empty state ── */}
      {allPrompts.length === 0 && (
        <div className="glass-card p-10 text-center mb-4">
          <Sparkles size={36} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            {searchQuery || hasActiveFilters() ? "No prompts match your search" : "No prompts yet"}
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
            {searchQuery || hasActiveFilters() ? (
              <>Try adjusting your search or <button onClick={() => { setSearchQuery(''); clearFilters(); }} className="underline" style={{ color: "var(--primary)" }}>clear filters</button></>
            ) : "Create your first prompt to get started"}
          </p>
          {!searchQuery && !hasActiveFilters() && (
            <button onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-medium"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Plus className="w-3.5 h-3.5" /> Create First Prompt
            </button>
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      {displayUserPrompts.length > 5 && (
        <div className="mt-2 mb-3">
          <PaginationControls pagination={userPromptsPagination} showSearch={false}
            showPageSizeSelector={true} showItemCount={true} pageSizeOptions={[5, 10, 20, 50]} />
        </div>
      )}

      {/* ── Filter card ── */}
      <div ref={filterCardRef}>
        <FilterCard filters={filters} onFilterChange={handleFilterChange} onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters()} filteredCount={allPrompts.length}
          teamMembers={teamMembers} isExpanded={showFilters}
          onToggleExpanded={() => setShowFilters(!showFilters)} />
      </div>

      {/* ── Import/Export ── */}
      <div ref={importCardRef}>
        <ExportImport onImport={handleImportPrompts} teamId={activeTeam} teamName={teamName} userRole={userRole} />
      </div>

      {/* ── Modals ── */}
      {showEditModal && editingPrompt && (
        <EditPromptModal open={showEditModal} prompt={editingPrompt}
          onClose={() => { setShowEditModal(false); setEditingPrompt(null); }}
          onSave={updates => handleUpdate(editingPrompt.id, updates)} />
      )}
      {selectedPromptForAttach && (
        <AddResultModal isOpen={!!selectedPromptForAttach} onClose={() => setSelectedPromptForAttach(null)}
          promptId={selectedPromptForAttach.id} teamId={activeTeam} userId={user?.uid} />
      )}
      {viewOutputsPrompt && (
        <ViewOutputsModal isOpen={!!viewOutputsPrompt} onClose={() => setViewOutputsPrompt(null)}
          prompt={viewOutputsPrompt} teamId={activeTeam} userRole={userRole} isGuestMode={isGuestMode}
          onAttachNew={isGuestMode ? null : () => { setViewOutputsPrompt(null); setSelectedPromptForAttach(viewOutputsPrompt); }} />
      )}
      {showAIEnhancer && currentPromptForAI && (
        <AIPromptEnhancer prompt={currentPromptForAI}
          onApply={async enhanced => { await handleUpdate(enhanced.id, enhanced); setShowAIEnhancer(false); }}
          onSaveAsNew={enhanced => {
            if (isGuestMode) { const np = guestState.addPrompt(enhanced); setUserPrompts(prev => [np, ...prev]); }
            else savePrompt(user.uid, enhanced, activeTeam);
            setShowAIEnhancer(false); showSuccessToast("Enhanced prompt saved!");
          }}
          onClose={() => { setShowAIEnhancer(false); setCurrentPromptForAI(null); }} />
      )}
    </div>
  );
}
