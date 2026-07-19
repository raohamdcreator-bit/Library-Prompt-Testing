// src/components/PromptList.jsx - RESPONSIVE VERSION
// Member restriction: members cannot enhance/attach/edit admin/owner prompts

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../lib/firebase";
import { trackPromptCopy } from "../lib/promptStats";
import { updateCommentCount } from "../lib/promptStats";
import { increment } from "firebase/firestore";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useGuestMode } from "../context/GuestModeContext";
import {
  savePrompt,
  updatePrompt as updatePromptFirestore,
  deletePrompt,
  togglePromptVisibility,
  filterVisiblePrompts,
} from "../lib/prompts";
import {
  getAllDemoPrompts,
  isDemoPrompt,
  duplicateDemoToUserPrompt,
  getPromptBadge,
} from "../lib/guestDemoContent";
import { guestState } from "../lib/guestState";
import { subscribeToResults } from "../lib/results";
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
  Search,
  Check,
  Clock,
  Filter,
  MessageSquare,
  Activity,
  Code,
  Image as ImageIcon,
  Loader2,
  Cpu,
  DollarSign,
  Target,
  TrendingUp,
  User,
  Calendar,
  Tag,
  Ruler,
  BarChart2,
  Lightbulb,
  SlidersHorizontal,
  UserPlus,
  TrendingUp as TrendIcon,
  ChevronUp,
  ShieldAlert,
  Video,
  ChevronLeft,
  ChevronRight, // ← added ChevronLeft/Right
} from "lucide-react";
import EditPromptModal from "./EditPromptModal";
import EnhancedBadge from "./EnhancedBadge";
import { ExportUtils } from "./ExportImport";
import ExportImport from "./ExportImport";
import AIPromptEnhancer from "./AIPromptEnhancer";
import AddResultModal from "./AddResultModal";
import ViewOutputsModal from "./ViewOutputsModal";
import Comments from "./Comments";
import { usePromptRating } from "./PromptAnalytics";
import { useSoundEffects } from "../hooks/useSoundEffects";
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
  } catch {
    return "";
  }
}

function getUserInitials(name, email) {
  if (name)
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}
        style={{
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        {getUserInitials(name, email)}
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0`}
          style={{ backgroundColor: "var(--muted)" }}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={`${name || email}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-border/50 flex-shrink-0 ${imageLoaded ? "block" : "hidden"}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </>
  );
}

// ─── Copy Button ─────────────────────────────────────────────────────────────
function CopyButton({ text, promptId, onCopy, isGuestMode, compact = false }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await onCopy(text, promptId, isGuestMode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <button
        onClick={handleCopy}
        className="icon-action-btn"
        title={copied ? "Copied!" : "Copy prompt"}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className="btn-action-secondary"
      title="Copy prompt"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

// ─── Compact Rating Display (also used as the star rating input) ─────────────
function CompactRating({ teamId, promptId, isGuestMode }) {
  const { averageRating, totalRatings, userRating, ratePrompt } =
    usePromptRating(teamId, promptId);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = async (rating) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await ratePrompt(rating);
    } catch (error) {
      if (isGuestMode && !teamId) alert("Sign up to rate prompts");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating || userRating || 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0 transition-transform hover:scale-110"
            disabled={isSubmitting}
          >
            <Star
              className={`w-3.5 h-3.5 transition-all ${star <= displayRating ? "fill-yellow-400 text-yellow-400" : "text-gray-600 hover:text-yellow-300"}`}
            />
          </button>
        ))}
      </div>
      {totalRatings > 0 && (
        <span
          className="text-xs font-medium tabular-nums"
          style={{ color: "var(--muted-foreground)" }}
        >
          {averageRating.toFixed(1)}{" "}
          <span className="opacity-60">({totalRatings})</span>
        </span>
      )}
    </div>
  );
}

// ─── Rating Distribution Panel (content only — toggled from the tab bar) ─────
function RatingDistributionPanel({
  ratings = {},
  totalRatings = 0,
  averageRating = 0,
}) {
  const ratingCounts = {
    5: ratings[5] || 0,
    4: ratings[4] || 0,
    3: ratings[3] || 0,
    2: ratings[2] || 0,
    1: ratings[1] || 0,
  };
  const maxCount = Math.max(...Object.values(ratingCounts), 1);

  if (totalRatings === 0) {
    return (
      <div className="panel-empty-note">
        <TrendIcon className="w-3.5 h-3.5" />
        <span>No ratings yet — be the first to rate this prompt.</span>
      </div>
    );
  }

  return (
    <div className="rating-distribution-panel">
      <div className="rating-distribution-header">
        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
        <span className="rating-distribution-avg">
          {averageRating.toFixed(1)}
        </span>
        <span className="rating-distribution-count">
          ({totalRatings} ratings)
        </span>
      </div>
      <div className="space-y-1">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = ratingCounts[stars];
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={stars} className="flex items-center gap-2">
              <span
                className="text-xs w-4 tabular-nums text-right"
                style={{ color: "var(--muted-foreground)" }}
              >
                {stars}
              </span>
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor:
                      stars >= 4
                        ? "rgb(34,197,94)"
                        : stars === 3
                          ? "rgb(251,191,36)"
                          : "rgb(239,68,68)",
                  }}
                />
              </div>
              <span
                className="text-xs w-5 tabular-nums"
                style={{ color: "var(--muted-foreground)" }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inline Comments Section ──────────────────────────────────────────────────
function ExpandedCommentsSection({
  promptId,
  teamId,
  commentCount,
  onClose,
  userRole,
}) {
  return (
    <div className="expanded-comments-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <h4 className="text-xs font-semibold text-foreground">
            Comments ({commentCount})
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-background rounded transition-colors"
          title="Close comments"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <Comments teamId={teamId} promptId={promptId} userRole={userRole} />
    </div>
  );
}

// ─── AI Analysis Panel (content only — toggled from the tab bar) ─────────────
function AIAnalysisPanel({ text, onEnhance }) {
  const stats = useMemo(() => {
    if (!text) return null;
    const tokens = TokenEstimator.estimateTokens(text, "gpt-4");
    const cost = TokenEstimator.estimateCost(text, "gpt-4");
    const recommendations = TokenEstimator.getRecommendations(text);
    return {
      tokens,
      cost,
      bestModel: recommendations[0]?.model || "gpt-4",
      compatibleModels: Object.keys(AI_MODELS).filter((model) =>
        TokenEstimator.fitsInContext(text, model),
      ).length,
      totalModels: Object.keys(AI_MODELS).length,
    };
  }, [text]);

  if (!stats) return null;
  const BestIcon = AI_MODELS[stats.bestModel]?.icon || Cpu;
  const BestModelConfig = AI_MODELS[stats.bestModel];
  const compatPct = Math.round(
    (stats.compatibleModels / stats.totalModels) * 100,
  );

  return (
    <div className="ai-analysis-panel">
      <div className="grid grid-cols-4 gap-1.5 text-xs">
        {[
          {
            icon: <TrendingUp className="w-3 h-3" />,
            label: "Tokens",
            value: stats.tokens.toLocaleString(),
          },
          {
            icon: <DollarSign className="w-3 h-3" />,
            label: "Cost",
            value: `$${stats.cost.toFixed(4)}`,
          },
          {
            icon: <Target className="w-3 h-3" />,
            label: "Compatible",
            value: `${stats.compatibleModels}/${stats.totalModels}`,
          },
        ].map(({ icon, label, value }) => (
          <div key={label} className="ai-stat-chip">
            <div className="ai-stat-chip-label">
              {icon}
              <span>{label}</span>
            </div>
            <span className="ai-stat-chip-value">{value}</span>
          </div>
        ))}
        <div className="ai-stat-chip ai-stat-chip-best">
          <div className="ai-stat-chip-label">
            <BestIcon className="w-3 h-3" />
            <span>Best</span>
          </div>
          <span className="ai-stat-chip-value truncate">
            {BestModelConfig?.name || stats.bestModel}
          </span>
        </div>
      </div>
      <div className="ai-compat-row">
        <span
          className={compatPct >= 80 ? "good" : compatPct >= 50 ? "ok" : "poor"}
        >
          {compatPct}% of models compatible
        </span>
      </div>
      {onEnhance && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEnhance();
          }}
          className="ai-enhance-btn"
        >
          <Sparkles className="w-3 h-3" />
          Detailed Analysis &amp; Enhancement
        </button>
      )}
    </div>
  );
}

// ─── Restriction Banner ───────────────────────────────────────────────────────
function RestrictionBanner({ creatorRole }) {
  const label = creatorRole === "owner" ? "owner" : "admin";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.375rem 0.875rem",
        borderBottom: "1px solid rgba(245,158,11,0.15)",
        background: "rgba(245,158,11,0.04)",
        fontSize: "0.68rem",
        color: "rgba(245,158,11,0.8)",
      }}
    >
      <ShieldAlert className="w-3 h-3 flex-shrink-0" />
      <span>
        This prompt was created by an {label}. Members can view and copy, but
        cannot edit, enhance, or attach outputs.
      </span>
    </div>
  );
}

// ─── Output Visual (shared image/video/text/code renderer) ───────────────────
function OutputVisual({ output, compact = false }) {
  if (!output) return null;

  if (output.type === "image" && output.imageUrl) {
    return (
      <div
        className={`output-visual${compact ? " output-visual-compact" : ""}`}
      >
        <img src={output.imageUrl} alt={output.title || "Output image"} />
      </div>
    );
  }

  if (output.type === "video") {
    return (
      <div
        className={`output-visual output-visual-video${compact ? " output-visual-compact" : ""}`}
      >
        {output.downloadUrl ? (
          <video
            src={output.downloadUrl}
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <div className="output-visual-placeholder">
            <Video className="w-4 h-4" style={{ color: "var(--primary)" }} />
            {!compact && <span>Video</span>}
          </div>
        )}
        <div className="output-play-badge">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="white">
            <polygon points="2,1 9,5 2,9" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`output-visual output-visual-text${compact ? " output-visual-compact" : ""}`}
    >
      {output.type === "code" ? (
        <Code className="w-4 h-4 text-purple-400" />
      ) : (
        <FileText className="w-4 h-4 text-blue-400" />
      )}
      {!compact && <span>{output.type === "code" ? "Code" : "Text"}</span>}
    </div>
  );
}

// ─── Output Preview Carousel (middle column) ──────────────────────────────────
function OutputPreviewCarousel({
  outputs,
  index,
  onIndexChange,
  onViewAll,
  onAttach,
  isGuestMode,
  canModify = true,
}) {
  if (isGuestMode) {
    return (
      <button
        className="preview-empty-state"
        onClick={() => alert("Sign up to attach outputs!")}
      >
        <Lock
          className="w-5 h-5"
          style={{ color: "var(--muted-foreground)" }}
        />
        <span>Sign up for outputs</span>
      </button>
    );
  }

  if (!canModify && (!outputs || outputs.length === 0)) {
    return (
      <div className="preview-empty-state" style={{ opacity: 0.45 }}>
        <Lock
          className="w-5 h-5"
          style={{ color: "var(--muted-foreground)" }}
        />
        <span>Only admins can attach outputs</span>
      </div>
    );
  }

  if (!outputs || outputs.length === 0) {
    return (
      <button
        className="preview-empty-state preview-empty-clickable"
        onClick={onAttach}
        title="Attach first output"
      >
        <Activity className="w-6 h-6 opacity-30" />
        <span>No outputs yet</span>
        <span className="attach-pill">+ Attach</span>
      </button>
    );
  }

  const safeIndex = Math.min(index, outputs.length - 1);
  const current = outputs[safeIndex];

  return (
    <div className="preview-carousel">
      <button
        className="preview-carousel-main"
        onClick={onViewAll}
        title="View all outputs"
      >
        <OutputVisual output={current} />
        <div className="preview-carousel-info">
          <p className="preview-carousel-title">
            {current.title || "Untitled"}
          </p>
          {current.type !== "image" &&
            current.type !== "video" &&
            current.content && (
              <p className="preview-carousel-snippet">{current.content}</p>
            )}
        </div>
      </button>

      {outputs.length > 1 && (
        <>
          <button
            className="carousel-nav-btn carousel-nav-prev"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((safeIndex - 1 + outputs.length) % outputs.length);
            }}
            title="Previous output"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            className="carousel-nav-btn carousel-nav-next"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((safeIndex + 1) % outputs.length);
            }}
            title="Next output"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <div className="carousel-dots">
            {outputs.map((_, i) => (
              <span
                key={i}
                className={`carousel-dot ${i === safeIndex ? "active" : ""}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="preview-count-badge">
        {outputs.length} output{outputs.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ─── Outputs Mini Grid (right column, 2x2) ────────────────────────────────────
function OutputsMiniGrid({
  outputs,
  onViewAll,
  onAttach,
  isGuestMode,
  canModify = true,
}) {
  if (isGuestMode) {
    return (
      <button
        className="outputs-mini-grid outputs-mini-grid-locked"
        onClick={() => alert("Sign up to view outputs!")}
      >
        <Lock
          className="w-4 h-4"
          style={{ color: "var(--muted-foreground)" }}
        />
        <span>Outputs locked</span>
      </button>
    );
  }

  const slots = (outputs || []).slice(0, 4);
  const emptySlots = Math.max(0, 4 - slots.length);

  return (
    <div className="outputs-mini-grid">
      {slots.map((output, i) => (
        <button
          key={output.id || i}
          className="output-mini-cell"
          onClick={() => onViewAll && onViewAll()}
          title={output.title || "View output"}
        >
          <OutputVisual output={output} compact />
        </button>
      ))}
      {Array.from({ length: emptySlots }).map((_, i) =>
        canModify ? (
          <button
            key={`empty-${i}`}
            className="output-mini-cell output-mini-cell-empty"
            onClick={onAttach}
            title="Attach output"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div
            key={`empty-${i}`}
            className="output-mini-cell output-mini-cell-empty"
            style={{ opacity: 0.3, cursor: "default" }}
          />
        ),
      )}
    </div>
  );
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────
function PromptCard({
  prompt,
  outputs = [],
  commentCount = 0,
  isDemo = false,
  canEdit = false,
  author,
  isGuestMode = false,
  activeTeam,
  userRole,
  onCopy,
  onEdit,
  onDelete,
  onToggleVisibility,
  onDuplicate,
  onViewOutputs,
  onAttachOutput,
  onEnhance,
  viewedPrompts = new Set(),
  onMarkViewed,
  showCommentSection,
  onToggleComments,
  isSelected,
  onSelect,
  openMenuId,
  onMenuToggle,
  onTrackView,
  onToggleFavourite,
  favouritePromptIds = new Set(),
  canModify = true,
  creatorRole = "member",
}) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showRatingStats, setShowRatingStats] = useState(false);
  const [outputIndex, setOutputIndex] = useState(0);
  const menuRef = useRef(null);
  const isPrivate = prompt.visibility === "private";
  const isViewed = viewedPrompts.has(prompt.id);
  const shouldTruncate = prompt.text.length > 160;
  const badge = getPromptBadge(prompt, isGuestMode);
  const showMenu = openMenuId === prompt.id;
  const isFavourited = favouritePromptIds.has(prompt.id);
  const showRestrictionBanner =
    !isGuestMode &&
    !isDemo &&
    !canModify &&
    (creatorRole === "owner" || creatorRole === "admin");

  const { ratings, averageRating, totalRatings } = usePromptRating(
    activeTeam,
    prompt.id,
  );
  const ratingDistribution = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating]++;
    });
    return dist;
  }, [ratings]);

  useEffect(() => {
    if (outputIndex > outputs.length - 1) setOutputIndex(0);
  }, [outputs.length, outputIndex]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        showMenu
      )
        onMenuToggle(null);
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu, onMenuToggle]);

  return (
    <article
      className={`prompt-card-v3 ${isViewed ? "viewed" : "new"} ${isSelected ? "ring-2 ring-primary" : ""} ${isDemo ? "is-demo" : ""}`}
    >
      {showRestrictionBanner && <RestrictionBanner creatorRole={creatorRole} />}

      <div className="prompt-card-columns">
        {/* ══════════════════ LEFT COLUMN ══════════════════ */}
        <div className="prompt-col prompt-col-left">
          {/* ── Top: selector, avatar, username, role ── */}
          <div className="prompt-left-top">
            {onSelect && !isDemo && (
              <PromptSelector
                promptId={prompt.id}
                isSelected={isSelected}
                onSelectionChange={onSelect}
              />
            )}

            {!isDemo && author && (
              <div className="prompt-author-block">
                <UserAvatar
                  src={author?.avatar}
                  name={author?.name}
                  email={author?.email}
                  size="sm"
                />
                <div className="prompt-author-meta">
                  <span className="prompt-author-name">
                    {isGuestMode
                      ? "You"
                      : author?.name || author?.email || "Unknown"}
                  </span>
                  {!isGuestMode &&
                    (creatorRole === "owner" || creatorRole === "admin") && (
                      <span className={`prompt-role-chip ${creatorRole}`}>
                        {creatorRole}
                      </span>
                    )}
                </div>
              </div>
            )}

            {isDemo && badge && (
              <span className="demo-badge-small">{badge.label}</span>
            )}

            <div className="prompt-left-top-spacer" />

            {!isDemo && prompt.enhanced && (
              <EnhancedBadge
                enhanced={prompt.enhanced}
                enhancedFor={prompt.enhancedFor}
                enhancementType={prompt.enhancementType}
                size="sm"
              />
            )}

            {!isGuestMode && !isDemo && onToggleFavourite && (
              <button
                onClick={() =>
                  onToggleFavourite(prompt.id, prompt.teamId || activeTeam)
                }
                className="icon-action-btn"
                title={isFavourited ? "Remove favourite" : "Mark favourite"}
              >
                <Star
                  className={`w-3.5 h-3.5 transition-all ${isFavourited ? "fill-yellow-400 text-yellow-400" : ""}`}
                />
              </button>
            )}
          </div>

          {/* ── Middle: prompt title, prompt details ── */}
          <div className="prompt-left-mid">
            <h3 className="prompt-title-text">{prompt.title}</h3>
            <div className="prompt-preview-section">
              <p
                className={`prompt-text-content ${isTextExpanded ? "expanded" : ""}`}
                style={{
                  display: isTextExpanded ? "block" : "-webkit-box",
                  WebkitLineClamp: isTextExpanded ? "unset" : 4,
                  WebkitBoxOrient: "vertical",
                  overflow: isTextExpanded ? undefined : "hidden",
                }}
              >
                {prompt.text}
              </p>
              {shouldTruncate && (
                <button
                  onClick={() => {
                    setIsTextExpanded(!isTextExpanded);
                    if (!isTextExpanded && onTrackView) onTrackView(prompt.id);
                  }}
                  className="read-more-btn"
                >
                  {isTextExpanded ? "Show less" : "Read more"}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${isTextExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </div>
          </div>

          {/* ── Bottom: copy/enhance icon buttons + tags ── */}
          <div className="prompt-left-bottom">
            <div className="prompt-left-icon-actions">
              <CopyButton
                text={prompt.text}
                promptId={prompt.id}
                onCopy={onCopy}
                isGuestMode={isGuestMode}
                compact
              />

              {isDemo ? (
                <button
                  onClick={() => onDuplicate && onDuplicate(prompt)}
                  className="btn-action-primary btn-action-primary-compact"
                >
                  <span>Make My Own</span>
                </button>
              ) : isGuestMode && activeTeam ? (
                <button
                  onClick={() => alert("Sign up to enhance prompts!")}
                  className="icon-action-btn opacity-60 cursor-not-allowed"
                  title="Sign up to enhance"
                >
                  <Lock className="w-3 h-3" />
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              ) : !canModify ? (
                <button
                  className="icon-action-btn cursor-not-allowed"
                  style={{ opacity: 0.4 }}
                  disabled
                  title="Restricted"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => onEnhance(prompt)}
                  className="icon-action-btn"
                  title="AI Enhance"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {prompt.tags && prompt.tags.length > 0 && (
              <div className="prompt-left-tags">
                {prompt.tags.slice(0, 4).map((tag, idx) => (
                  <span key={idx} className="prompt-tag">
                    #{tag}
                  </span>
                ))}
                {prompt.tags.length > 4 && (
                  <span className="prompt-tag-more">
                    +{prompt.tags.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════ MIDDLE COLUMN ══════════════════ */}
        {!isDemo && (
          <div className="prompt-col prompt-col-middle">
            {/* ── Output preview with scrolling icons ── */}
            <div className="prompt-preview-frame">
              <div className="preview-frame-header">
                <span className="preview-frame-dot" />
                <span className="preview-frame-label">Output Preview</span>
                {outputs.length > 0 && (
                  <button
                    className="preview-frame-expand"
                    onClick={() => onViewOutputs && onViewOutputs(prompt)}
                    title="View all outputs"
                  >
                    <Activity className="w-3 h-3" />
                  </button>
                )}
              </div>
              <OutputPreviewCarousel
                outputs={outputs}
                index={outputIndex}
                onIndexChange={setOutputIndex}
                onViewAll={() => onViewOutputs && onViewOutputs(prompt)}
                onAttach={() => onAttachOutput && onAttachOutput(prompt)}
                isGuestMode={isGuestMode}
                canModify={canModify}
              />
            </div>

            {/* ── Tablet bar: comments / ratings / kebab / AI analysis ── */}
            <div className="prompt-tab-bar">
              {isGuestMode && !activeTeam ? (
                <button
                  onClick={() => alert("Sign up to view and add comments!")}
                  className="tab-bar-btn"
                  title="Comments"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="tab-bar-count">{commentCount}</span>
                </button>
              ) : (
                <button
                  onClick={() => onToggleComments(prompt.id)}
                  className={`tab-bar-btn ${showCommentSection ? "active" : ""}`}
                  title="Comments"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="tab-bar-count">{commentCount}</span>
                </button>
              )}

              {activeTeam && (
                <button
                  onClick={() => setShowRatingStats(!showRatingStats)}
                  className={`tab-bar-btn ${showRatingStats ? "active" : ""}`}
                  title="Rating distribution"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setShowAIAnalysis(!showAIAnalysis)}
                className={`tab-bar-btn ${showAIAnalysis ? "active" : ""}`}
                title="AI model analysis"
              >
                <Cpu className="w-3.5 h-3.5" />
              </button>

              <div className="tab-bar-spacer" />

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => onMenuToggle(showMenu ? null : prompt.id)}
                  className={`tab-bar-btn ${showMenu ? "active" : ""}`}
                  aria-expanded={showMenu}
                  title="More actions"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {showMenu && (
                  <div
                    className="kebab-menu-v2 kebab-menu-upward"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 6px)",
                      right: 0,
                      top: "auto",
                      zIndex: 50,
                      minWidth: "11rem",
                    }}
                  >
                    {!isGuestMode && onToggleFavourite && (
                      <>
                        <button
                          onClick={() => {
                            onToggleFavourite(
                              prompt.id,
                              prompt.teamId || activeTeam,
                            );
                            onMenuToggle(null);
                          }}
                          className="menu-item"
                        >
                          <Star
                            className={`w-4 h-4 ${isFavourited ? "fill-yellow-400 text-yellow-400" : ""}`}
                          />
                          <span>
                            {isFavourited
                              ? "Remove Favourite"
                              : "Mark Favourite"}
                          </span>
                        </button>
                        <div className="menu-divider" />
                      </>
                    )}

                    {outputs.length > 0 && (
                      <>
                        <button
                          onClick={() => {
                            onViewOutputs(prompt);
                            onMenuToggle(null);
                          }}
                          className="menu-item"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View All Outputs ({outputs.length})</span>
                        </button>
                        <div className="menu-divider" />
                      </>
                    )}

                    {!canModify ? (
                      <button
                        className="menu-item"
                        style={{ opacity: 0.4, cursor: "not-allowed" }}
                        disabled
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Attach Output — Restricted</span>
                      </button>
                    ) : isGuestMode ? (
                      <button
                        onClick={() => {
                          alert("Sign up to attach outputs!");
                          onMenuToggle(null);
                        }}
                        className="menu-item opacity-60 cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <Plus className="w-4 h-4" />
                        <span>Attach Output</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          onAttachOutput(prompt);
                          onMenuToggle(null);
                        }}
                        className="menu-item"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Attach Output</span>
                      </button>
                    )}

                    <div className="menu-divider" />

                    {!isGuestMode && canModify && (
                      <button
                        onClick={() => {
                          onToggleVisibility(prompt.id);
                          onMenuToggle(null);
                        }}
                        className="menu-item"
                      >
                        {isPrivate ? (
                          <Unlock className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span>Make {isPrivate ? "Public" : "Private"}</span>
                      </button>
                    )}

                    {canEdit && (
                      <>
                        <div className="menu-divider" />
                        <button
                          onClick={() => {
                            onEdit(prompt);
                            onMenuToggle(null);
                          }}
                          className="menu-item"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            onDelete(prompt.id);
                            onMenuToggle(null);
                          }}
                          className="menu-item danger"
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

            {/* ── Smoothly expanding sections ── */}
            <div
              className={`panel-expand ${showCommentSection && activeTeam ? "open" : ""}`}
            >
              {showCommentSection && activeTeam && (
                <ExpandedCommentsSection
                  promptId={prompt.id}
                  teamId={activeTeam}
                  commentCount={commentCount}
                  onClose={() => onToggleComments(prompt.id)}
                  userRole={userRole}
                />
              )}
            </div>

            <div className={`panel-expand ${showRatingStats ? "open" : ""}`}>
              {showRatingStats && (
                <RatingDistributionPanel
                  ratings={ratingDistribution}
                  totalRatings={totalRatings}
                  averageRating={averageRating}
                />
              )}
            </div>

            <div className={`panel-expand ${showAIAnalysis ? "open" : ""}`}>
              {showAIAnalysis && (
                <AIAnalysisPanel
                  text={prompt.text}
                  onEnhance={
                    isGuestMode && activeTeam
                      ? null
                      : !canModify
                        ? null
                        : () => onEnhance && onEnhance(prompt)
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ RIGHT COLUMN ══════════════════ */}
        {!isDemo && (
          <div className="prompt-col prompt-col-right">
            {/* ── Top: creation date, public/private tag ── */}
            <div className="prompt-right-top">
              <span className="prompt-right-date">
                <Clock className="w-3 h-3" />
                {getRelativeTime(prompt.createdAt)}
              </span>
              {!isGuestMode && (
                <span
                  className={`privacy-badge ${isPrivate ? "private" : "public"}`}
                >
                  {isPrivate ? (
                    <Lock className="w-2.5 h-2.5" />
                  ) : (
                    <Unlock className="w-2.5 h-2.5" />
                  )}
                  <span>{isPrivate ? "Private" : "Public"}</span>
                </span>
              )}
            </div>

            {/* ── Middle: rating, comments, views, outputs 2x2 grid ── */}
            <div className="prompt-right-stats">
              <div className="stat-chip" title="Average rating">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{averageRating.toFixed(1)}</span>
              </div>
              <div className="stat-chip" title="Comments">
                <MessageSquare className="w-3 h-3" />
                <span>{commentCount}</span>
              </div>
              <div className="stat-chip" title="Views">
                <Eye className="w-3 h-3" />
                <span>{prompt.stats?.views || 0}</span>
              </div>
            </div>

            <OutputsMiniGrid
              outputs={outputs}
              onViewAll={() => onViewOutputs && onViewOutputs(prompt)}
              onAttach={() => onAttachOutput && onAttachOutput(prompt)}
              isGuestMode={isGuestMode}
              canModify={canModify}
            />

            {/* ── Bottom: star rating input ── */}
            <div className="prompt-right-rating-input">
              <span className="prompt-right-rating-label">Rate this</span>
              <CompactRating
                teamId={activeTeam}
                promptId={prompt.id}
                isGuestMode={isGuestMode}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Filter Card ──────────────────────────────────────────────────────────────
function FilterCard({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  filteredCount,
  teamMembers = {},
  isExpanded,
  onToggleExpanded,
}) {
  const authors = Object.entries(teamMembers).map(([uid, member]) => ({
    uid,
    name: member.name || member.email,
  }));
  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => k !== "sortBy" && v !== "" && v !== "all",
  ).length;

  return (
    <div className="glass-card p-4 mb-4" id="filter-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            className="w-4 h-4"
            style={{ color: "var(--primary)" }}
          />
          <div>
            <h3
              className="text-sm font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Advanced Filters
            </h3>
            {activeFilterCount > 0 && (
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                {activeFilterCount} active · {filteredCount} results
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onToggleExpanded}
          className="btn-secondary px-2 py-1 flex items-center gap-1 text-xs"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div>
            <label
              className="flex items-center gap-1.5 text-xs font-medium mb-1.5"
              style={{ color: "var(--foreground)" }}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Sort By
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => onFilterChange("sortBy", e.target.value)}
              className="form-input w-full text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
              <option value="author">Author A-Z</option>
              <option value="length-desc">Longest First</option>
              <option value="length-asc">Shortest First</option>
            </select>
          </div>

          <div className="filter-grid-responsive">
            {[
              {
                key: "author",
                label: "Author",
                icon: User,
                options: [
                  { value: "all", label: "All Authors" },
                  ...authors.map((a) => ({ value: a.uid, label: a.name })),
                ],
              },
              {
                key: "visibility",
                label: "Visibility",
                icon: Lock,
                options: [
                  { value: "all", label: "All Prompts" },
                  { value: "public", label: "Public Only" },
                  { value: "private", label: "Private Only" },
                ],
              },
              {
                key: "dateRange",
                label: "Created",
                icon: Calendar,
                options: [
                  { value: "all", label: "Any Time" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "Past Week" },
                  { value: "month", label: "Past Month" },
                  { value: "quarter", label: "Past 3 Months" },
                ],
              },
            ].map(({ key, label, icon: Icon, options }) => (
              <div key={key}>
                <label
                  className="flex items-center gap-1.5 text-xs font-medium mb-1.5"
                  style={{ color: "var(--foreground)" }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </label>
                <select
                  value={filters[key]}
                  onChange={(e) => onFilterChange(key, e.target.value)}
                  className="form-input w-full text-sm"
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div>
              <label
                className="flex items-center gap-1.5 text-xs font-medium mb-1.5"
                style={{ color: "var(--foreground)" }}
              >
                <Tag className="w-3.5 h-3.5" />
                Tags
              </label>
              <input
                type="text"
                placeholder="writing, creative"
                value={filters.tags}
                onChange={(e) => onFilterChange("tags", e.target.value)}
                className="form-input w-full text-sm"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Comma separated
              </p>
            </div>

            {[
              { key: "minLength", label: "Min Chars" },
              { key: "maxLength", label: "Max Chars" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label
                  className="flex items-center gap-1.5 text-xs font-medium mb-1.5"
                  style={{ color: "var(--foreground)" }}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  {label}
                </label>
                <input
                  type="number"
                  placeholder={key === "minLength" ? "0" : "No limit"}
                  value={filters[key]}
                  onChange={(e) => onFilterChange(key, e.target.value)}
                  className="form-input w-full text-sm"
                  min="0"
                />
              </div>
            ))}
          </div>

          {hasActiveFilters && (
            <div
              className="flex justify-between items-center pt-2 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {activeFilterCount} active{" "}
                {activeFilterCount === 1 ? "filter" : "filters"}
              </p>
              <button
                onClick={onClearFilters}
                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>
          )}

          <div
            className="p-2 rounded-lg border flex items-start gap-2 text-xs"
            style={{
              backgroundColor: "var(--muted)",
              borderColor: "var(--border)",
            }}
          >
            <Lightbulb
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
              style={{ color: "var(--primary)" }}
            />
            <p style={{ color: "var(--muted-foreground)" }}>
              Combine filters for precision. Use commas in Tags to match
              multiple.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PromptList({
  activeTeam,
  userRole,
  isGuestMode = false,
  userId,
  onScrollToInvite,
}) {
  const { user } = useAuth();
  const { playNotification } = useSoundEffects();
  const { checkSaveRequired, canEditPrompt: canEditGuestPrompt } =
    useGuestMode();
  const { success, error, info } = useNotification();
  const [userPrompts, setUserPrompts] = useState([]);
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
  const [teamMemberRoles, setTeamMemberRoles] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [viewedPrompts, setViewedPrompts] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
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
    author: "all",
    tags: "",
    dateRange: "all",
    sortBy: "newest",
    minLength: "",
    maxLength: "",
    visibility: "all",
  });

  const demos = useMemo(() => {
    if (isGuestMode && userPrompts.length === 0) return getAllDemoPrompts();
    return [];
  }, [isGuestMode, userPrompts.length]);

  useEffect(() => {
    if (!user || isGuestMode) return;
    const favRef = collection(db, "users", user.uid, "favorites");
    const unsub = onSnapshot(favRef, (snap) => {
      setFavouritePromptIds(new Set(snap.docs.map((d) => d.id)));
    });
    return () => unsub();
  }, [user, isGuestMode]);

  useEffect(() => {
    if (isGuestMode && !activeTeam) {
      setUserPrompts(guestState.getPrompts());
      setLoading(false);
      return;
    }
    if (!activeTeam) {
      setUserPrompts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "teams", activeTeam, "prompts"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          teamId: activeTeam,
          ...d.data(),
        }));
        const unique = Array.from(
          new Map(data.map((item) => [item.id, item])).values(),
        );
        const visible = user
          ? filterVisiblePrompts(unique, user.uid, userRole)
          : unique.filter((p) => p.visibility === "public" || !p.visibility);
        setUserPrompts(visible);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [activeTeam, user, userRole, isGuestMode]);

  useEffect(() => {
    if (!activeTeam) return;
    const unsubs = userPrompts.map((prompt) =>
      subscribeToResults(activeTeam, prompt.id, (results) => {
        setPromptOutputs((prev) => ({ ...prev, [prompt.id]: results }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [userPrompts, activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    const unsubs = userPrompts.map((prompt) => {
      const q = query(
        collection(db, "teams", activeTeam, "prompts", prompt.id, "comments"),
      );
      return onSnapshot(q, (snap) => {
        setPromptComments((prev) => ({
          ...prev,
          [prompt.id]: snap.docs.length,
        }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [userPrompts, activeTeam]);

  useEffect(() => {
    async function loadTeamData() {
      if (!activeTeam || isGuestMode || !user) return;
      try {
        const teamDoc = await getDoc(doc(db, "teams", activeTeam));
        if (!teamDoc.exists()) return;
        const teamData = teamDoc.data();
        setTeamName(teamData.name || "Unknown Team");
        setTeamMemberRoles(teamData.members || {});
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

  function canEditPrompt(prompt) {
    if (isGuestMode) return canEditGuestPrompt(prompt);
    if (!user) return false;
    return (
      prompt.createdBy === user.uid ||
      userRole === "owner" ||
      userRole === "admin"
    );
  }

  function canModifyPrompt(prompt) {
    if (isGuestMode) return false;
    if (!user) return false;
    if (userRole === "owner" || userRole === "admin") return true;
    if (prompt.createdBy !== user.uid) return false;
    return true;
  }

  function getPromptCreatorRole(prompt) {
    return teamMemberRoles[prompt.createdBy] || "member";
  }

  async function handleToggleFavourite(promptId, teamId) {
    if (!user) {
      showNotification("Sign up to save favourites", "info");
      return;
    }
    const favRef = doc(db, "users", user.uid, "favorites", promptId);
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
        await setDoc(favRef, {
          ...userPrompts.find((p) => p.id === promptId),
          teamId: teamId || activeTeam,
          addedAt: serverTimestamp(),
        });
        showSuccessToast("Added to favourites");
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
      if (typeof p.createdAt.toMillis === "function")
        return p.createdAt.toMillis();
      if (p.createdAt instanceof Date) return p.createdAt.getTime();
      if (typeof p.createdAt === "number") return p.createdAt;
      return 0;
    }
    let filtered = [...promptsList];
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(term) ||
          p.text?.toLowerCase().includes(term) ||
          (Array.isArray(p.tags) &&
            p.tags.some((t) => t.toLowerCase().includes(term))),
      );
    }
    if (filters.author !== "all")
      filtered = filtered.filter((p) => p.createdBy === filters.author);
    if (filters.visibility !== "all")
      filtered = filtered.filter(
        (p) => (p.visibility || "public") === filters.visibility,
      );
    if (filters.tags.trim()) {
      const searchTags = filters.tags
        .toLowerCase()
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      filtered = filtered.filter(
        (p) =>
          Array.isArray(p.tags) &&
          searchTags.some((st) =>
            p.tags.some((t) => t.toLowerCase().includes(st)),
          ),
      );
    }
    if (filters.dateRange !== "all") {
      const now = new Date(),
        cutoff = new Date();
      if (filters.dateRange === "today") cutoff.setHours(0, 0, 0, 0);
      else if (filters.dateRange === "week") cutoff.setDate(now.getDate() - 7);
      else if (filters.dateRange === "month")
        cutoff.setMonth(now.getMonth() - 1);
      else if (filters.dateRange === "quarter")
        cutoff.setMonth(now.getMonth() - 3);
      filtered = filtered.filter((p) => {
        if (!p.createdAt) return false;
        try {
          const d =
            typeof p.createdAt.toDate === "function"
              ? p.createdAt.toDate()
              : p.createdAt instanceof Date
                ? p.createdAt
                : typeof p.createdAt === "number"
                  ? new Date(p.createdAt)
                  : null;
          return d && d >= cutoff;
        } catch {
          return false;
        }
      });
    }
    if (filters.minLength && !isNaN(filters.minLength))
      filtered = filtered.filter(
        (p) => (p.text?.length || 0) >= parseInt(filters.minLength),
      );
    if (filters.maxLength && !isNaN(filters.maxLength))
      filtered = filtered.filter(
        (p) => (p.text?.length || 0) <= parseInt(filters.maxLength),
      );
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "newest":
          return getTimestamp(b) - getTimestamp(a);
        case "oldest":
          return getTimestamp(a) - getTimestamp(b);
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "author":
          return (
            teamMembers[a.createdBy]?.name ||
            teamMembers[a.createdBy]?.email ||
            ""
          ).localeCompare(
            teamMembers[b.createdBy]?.name ||
              teamMembers[b.createdBy]?.email ||
              "",
          );
        case "length-asc":
          return (a.text?.length || 0) - (b.text?.length || 0);
        case "length-desc":
          return (b.text?.length || 0) - (a.text?.length || 0);
        default:
          return 0;
      }
    });
    return filtered;
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }
  function clearFilters() {
    setFilters({
      author: "all",
      tags: "",
      dateRange: "all",
      sortBy: "newest",
      minLength: "",
      maxLength: "",
      visibility: "all",
    });
  }
  function hasActiveFilters() {
    return (
      filters.author !== "all" ||
      filters.tags !== "" ||
      filters.dateRange !== "all" ||
      filters.minLength !== "" ||
      filters.maxLength !== "" ||
      filters.visibility !== "all"
    );
  }

  function scrollToFilters() {
    setShowFilters(true);
    setTimeout(
      () =>
        filterCardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      100,
    );
  }

  const allPrompts = useMemo(
    () => applyFilters([...demos, ...userPrompts]),
    [demos, userPrompts, searchQuery, filters, teamMembers],
  );
  const displayDemos = useMemo(
    () => allPrompts.filter((p) => isDemoPrompt(p)),
    [allPrompts],
  );
  const displayUserPrompts = useMemo(
    () => allPrompts.filter((p) => !isDemoPrompt(p)),
    [allPrompts],
  );
  const userPromptsPagination = usePagination(displayUserPrompts, 10);
  const demoPromptsPagination = usePagination(displayDemos, 5);

  const handleSelectPrompt = (promptId, isSel) => {
    setSelectedPrompts((prev) =>
      isSel ? [...prev, promptId] : prev.filter((id) => id !== promptId),
    );
  };

  const handleBulkDelete = async (promptIds) => {
    try {
      let deletedCount = 0;
      for (const id of promptIds) {
        const prompt = displayUserPrompts.find((p) => p.id === id);
        if (prompt && !canEditPrompt(prompt)) continue;
        if (isGuestMode) guestState.deletePrompt(id);
        else {
          await deletePrompt(activeTeam, id);
          if (user)
            deleteDoc(doc(db, "users", user.uid, "favorites", id)).catch(
              () => {},
            );
        }
        deletedCount++;
      }
      if (isGuestMode)
        setUserPrompts((prev) => prev.filter((p) => !promptIds.includes(p.id)));
      setSelectedPrompts([]);
      showSuccessToast(
        `${deletedCount} prompt${deletedCount !== 1 ? "s" : ""} deleted`,
      );
    } catch {
      showNotification("Failed to delete some prompts", "error");
    }
  };

  const handleBulkExport = (prompts, format) => {
    if (format === "json")
      ExportUtils.exportAsJSON(prompts, `prompts-${Date.now()}`);
    else if (format === "csv")
      ExportUtils.exportAsCSV(prompts, `prompts-${Date.now()}`);
    else if (format === "txt")
      ExportUtils.exportAsTXT(prompts, `prompts-${Date.now()}`);
  };

  const handleDuplicateDemo = (demoPrompt) => {
    const userPrompt = duplicateDemoToUserPrompt(demoPrompt);
    if (!userPrompt) {
      showNotification("Failed to duplicate demo", "error");
      return;
    }
    checkSaveRequired("duplicate_demo", async () => {
      if (isGuestMode) {
        const saved = guestState.addPrompt(userPrompt);
        setUserPrompts((prev) => [saved, ...prev]);
        showSuccessToast("Demo copied!");
        setEditingPrompt(saved);
        setShowEditModal(true);
      } else {
        try {
          await savePrompt(user.uid, userPrompt, activeTeam);
          showSuccessToast("Demo copied!");
        } catch {
          showNotification("Failed to save copied prompt", "error");
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
        const saved = guestState.addPrompt({
          title: newPrompt.title.trim(),
          text: newPrompt.text.trim(),
          tags: newPrompt.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          visibility: newPrompt.visibility,
        });
        setUserPrompts((prev) => [saved, ...prev]);
        checkSaveRequired("create_prompt", () => {});
      } else {
        await savePrompt(
          user.uid,
          {
            title: newPrompt.title.trim(),
            text: newPrompt.text.trim(),
            tags: newPrompt.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            visibility: newPrompt.visibility,
          },
          activeTeam,
        );
      }
      setNewPrompt({ title: "", tags: "", text: "", visibility: "public" });
      setShowCreateForm(false);
      showSuccessToast("Prompt created successfully!");
    } catch {
      showNotification("Failed to create prompt", "error");
    }
  }

  async function handleUpdate(promptId, updates) {
    try {
      if (isGuestMode) {
        guestState.updatePrompt(promptId, updates);
        setUserPrompts((prev) =>
          prev.map((p) => (p.id === promptId ? { ...p, ...updates } : p)),
        );
      } else {
        await updatePromptFirestore(activeTeam, promptId, updates);
      }
      setShowEditModal(false);
      setEditingPrompt(null);
      showSuccessToast("Prompt updated successfully!");
    } catch {
      showNotification("Failed to update prompt", "error");
    }
  }

  async function handleDelete(promptId) {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    try {
      if (isGuestMode) {
        guestState.deletePrompt(promptId);
        setUserPrompts((prev) => prev.filter((p) => p.id !== promptId));
      } else {
        await deletePrompt(activeTeam, promptId);
        if (user)
          deleteDoc(doc(db, "users", user.uid, "favorites", promptId)).catch(
            () => {},
          );
      }
      showSuccessToast("Prompt deleted");
    } catch {
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
    if (!canModifyPrompt(prompt)) {
      showNotification(
        "You don't have permission to change this prompt's visibility",
        "error",
      );
      return;
    }
    try {
      await togglePromptVisibility(
        activeTeam,
        promptId,
        prompt.visibility || "public",
      );
      showSuccessToast("Visibility updated");
    } catch {
      showNotification("Failed to change visibility", "error");
    }
  }

  async function handleCopy(text, promptId, isGuestUser = false) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Copied to clipboard!");
      if (activeTeam) {
        const guestToken = sessionStorage.getItem("guest_team_token");
        try {
          await trackPromptCopy(activeTeam, promptId, !!guestToken);
        } catch {}
      }
    } catch {
      showNotification("Failed to copy", "error");
    }
  }

  function handleToggleComments(promptId) {
    if (isGuestMode && !activeTeam) {
      alert("Sign up to view and add comments!");
      return;
    }
    setShowCommentSection((prev) => ({ ...prev, [promptId]: !prev[promptId] }));
  }

  async function handleTrackView(promptId) {
    if (trackedViews.has(promptId)) return;
    setTrackedViews((prev) => new Set([...prev, promptId]));
    if (activeTeam) {
      try {
        await updateDoc(doc(db, "teams", activeTeam, "prompts", promptId), {
          "stats.views": increment(1),
        });
      } catch {
        setTrackedViews((prev) => {
          const s = new Set(prev);
          s.delete(promptId);
          return s;
        });
      }
    }
  }

  async function handleImportPrompts(validPrompts) {
    if (isGuestMode) {
      validPrompts.forEach((p) => guestState.addPrompt(p));
      setUserPrompts(guestState.getPrompts());
      return;
    }
    try {
      for (const p of validPrompts) await savePrompt(user.uid, p, activeTeam);
    } catch (e) {
      console.error("Import error:", e);
      throw e;
    }
  }

  function handleEnhance(prompt) {
    if (!canModifyPrompt(prompt)) {
      showNotification(
        "You don't have permission to enhance this prompt",
        "error",
      );
      return;
    }
    setCurrentPromptForAI(prompt);
    setShowAIEnhancer(true);
  }

  function handleAttachOutput(prompt) {
    if (!canModifyPrompt(prompt)) {
      showNotification(
        "You don't have permission to attach outputs to this prompt",
        "error",
      );
      return;
    }
    setSelectedPromptForAttach(prompt);
  }

  function showSuccessToast(msg) {
    playNotification();
    success(msg, 3000);
  }
  function showNotification(msg, type = "info") {
    playNotification();
    if (type === "error") error(msg, 3000);
    else if (type === "info") info(msg, 3000);
    else success(msg, 3000);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card h-40" />
        ))}
      </div>
    );
  }

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => k !== "sortBy" && v !== "" && v !== "all",
  ).length;

  return (
    <div className="prompt-list-container">
      {/* ── Header ── */}
      <div className="glass-card p-4 mb-3">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {isGuestMode ? "Demo Prompts" : "Prompt Library"}
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              {isGuestMode
                ? `${displayDemos.length} demos · ${displayUserPrompts.length} yours`
                : `${displayUserPrompts.length} ${displayUserPrompts.length === 1 ? "prompt" : "prompts"}`}
              {hasActiveFilters() && (
                <span className="text-primary font-medium"> · filtered</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isGuestMode &&
              (userRole === "owner" || userRole === "admin") &&
              onScrollToInvite && (
                <button
                  onClick={onScrollToInvite}
                  className="btn-secondary px-2.5 py-1.5 flex items-center gap-1 text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Invite</span>
                </button>
              )}
            <button
              onClick={scrollToFilters}
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs whitespace-nowrap transition-all ${hasActiveFilters() ? "btn-primary" : "btn-secondary"}`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span
                  className="text-xs rounded-full px-1 py-0.5 font-bold min-w-[1rem] text-center"
                  style={{
                    backgroundColor: "var(--primary-foreground)",
                    color: "var(--primary)",
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn-primary px-3 py-1.5 flex items-center gap-1 text-xs"
            >
              {showCreateForm ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>{showCreateForm ? "Cancel" : "Create"}</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            placeholder="Search prompts by title, content, or tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input pl-9 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Create form ── */}
      {showCreateForm && (
        <div className="glass-card p-4 mb-3">
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Create New Prompt
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              placeholder="Title *"
              className="form-input w-full"
              value={newPrompt.title}
              onChange={(e) =>
                setNewPrompt({ ...newPrompt, title: e.target.value })
              }
              required
            />
            <textarea
              placeholder="Prompt text *"
              className="form-input w-full min-h-[100px]"
              value={newPrompt.text}
              onChange={(e) =>
                setNewPrompt({ ...newPrompt, text: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Tags (comma separated)"
              className="form-input w-full"
              value={newPrompt.tags}
              onChange={(e) =>
                setNewPrompt({ ...newPrompt, tags: e.target.value })
              }
            />
            {!isGuestMode && (
              <div className="flex gap-4">
                {["public", "private"].map((vis) => (
                  <label
                    key={vis}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      value={vis}
                      checked={newPrompt.visibility === vis}
                      onChange={(e) =>
                        setNewPrompt({
                          ...newPrompt,
                          visibility: e.target.value,
                        })
                      }
                    />
                    <span className="capitalize">{vis}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 text-sm">
                Create Prompt
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary px-4 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bulk operations ── */}
      {!isGuestMode && displayUserPrompts.length > 0 && (
        <BulkOperations
          prompts={displayUserPrompts}
          selectedPrompts={selectedPrompts}
          onSelectionChange={setSelectedPrompts}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
          userRole={userRole}
          userId={userId}
        />
      )}

      {/* ── Demo section ── */}
      {displayDemos.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h4
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Try These Examples
            </h4>
          </div>
          {demoPromptsPagination.currentItems.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              outputs={[]}
              commentCount={0}
              isDemo={true}
              canEdit={false}
              author={null}
              isGuestMode={isGuestMode}
              activeTeam={activeTeam}
              userRole={userRole}
              onCopy={handleCopy}
              onDuplicate={handleDuplicateDemo}
              viewedPrompts={viewedPrompts}
              showCommentSection={false}
              onToggleComments={() => {}}
              openMenuId={openMenuId}
              onMenuToggle={setOpenMenuId}
              onTrackView={handleTrackView}
              onToggleFavourite={null}
              favouritePromptIds={favouritePromptIds}
              canModify={true}
              creatorRole="member"
            />
          ))}
          {displayDemos.length > 5 && (
            <div className="mt-3">
              <PaginationControls
                pagination={demoPromptsPagination}
                showSearch={false}
                showPageSizeSelector
                pageSizeOptions={[5, 10, 15]}
              />
            </div>
          )}
        </section>
      )}

      {/* ── User prompts section ── */}
      {displayUserPrompts.length > 0 && (
        <section>
          {isGuestMode && displayDemos.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <FileText
                className="w-4 h-4"
                style={{ color: "var(--primary)" }}
              />
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Your Prompts
              </h3>
            </div>
          )}
          {userPromptsPagination.currentItems.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              outputs={promptOutputs[prompt.id] || []}
              commentCount={promptComments[prompt.id] || 0}
              isDemo={false}
              canEdit={canEditPrompt(prompt)}
              author={teamMembers[prompt.createdBy]}
              isGuestMode={isGuestMode}
              activeTeam={activeTeam}
              userRole={userRole}
              onCopy={handleCopy}
              onEdit={(p) => {
                setEditingPrompt(p);
                setShowEditModal(true);
              }}
              onDelete={handleDelete}
              onToggleVisibility={handleToggleVisibility}
              onEnhance={handleEnhance}
              onViewOutputs={setViewOutputsPrompt}
              onAttachOutput={handleAttachOutput}
              viewedPrompts={viewedPrompts}
              onMarkViewed={(id) =>
                setViewedPrompts((prev) => new Set([...prev, id]))
              }
              showCommentSection={showCommentSection[prompt.id] || false}
              onToggleComments={handleToggleComments}
              isSelected={selectedPrompts.includes(prompt.id)}
              onSelect={handleSelectPrompt}
              openMenuId={openMenuId}
              onMenuToggle={setOpenMenuId}
              onTrackView={handleTrackView}
              onToggleFavourite={handleToggleFavourite}
              favouritePromptIds={favouritePromptIds}
              canModify={canModifyPrompt(prompt)}
              creatorRole={getPromptCreatorRole(prompt)}
            />
          ))}
          {displayUserPrompts.length > 5 && (
            <div className="mt-3">
              <PaginationControls
                pagination={userPromptsPagination}
                showSearch={false}
                showPageSizeSelector
                showItemCount
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Empty state ── */}
      {allPrompts.length === 0 && (
        <div className="glass-card p-8 text-center mb-6">
          <Sparkles
            size={36}
            style={{ color: "var(--primary)", margin: "0 auto 0.75rem" }}
          />
          <h3 className="text-sm font-semibold mb-2">
            {searchQuery || hasActiveFilters()
              ? "No prompts match your search"
              : "No prompts yet"}
          </h3>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            {searchQuery || hasActiveFilters() ? (
              <>
                <span>Try adjusting your search or </span>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    clearFilters();
                  }}
                  className="text-primary hover:underline"
                >
                  clear all filters
                </button>
              </>
            ) : (
              "Create your first prompt to get started"
            )}
          </p>
          {!searchQuery && !hasActiveFilters() && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Prompt
            </button>
          )}
        </div>
      )}

      {/* ── Filter card ── */}
      <div ref={filterCardRef}>
        <FilterCard
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters()}
          filteredCount={allPrompts.length}
          teamMembers={teamMembers}
          isExpanded={showFilters}
          onToggleExpanded={() => setShowFilters(!showFilters)}
        />
      </div>

      {/* ── Export/Import ── */}
      <div ref={importCardRef}>
        <ExportImport
          onImport={handleImportPrompts}
          teamId={activeTeam}
          teamName={teamName}
          userRole={userRole}
        />
      </div>

      {/* ── Modals ── */}
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
      {selectedPromptForAttach && (
        <AddResultModal
          isOpen={!!selectedPromptForAttach}
          onClose={() => setSelectedPromptForAttach(null)}
          promptId={selectedPromptForAttach.id}
          teamId={activeTeam}
          userId={user?.uid}
        />
      )}
      {viewOutputsPrompt && (
        <ViewOutputsModal
          isOpen={!!viewOutputsPrompt}
          onClose={() => setViewOutputsPrompt(null)}
          prompt={viewOutputsPrompt}
          teamId={activeTeam}
          userRole={userRole}
          isGuestMode={isGuestMode}
          onAttachNew={
            isGuestMode
              ? null
              : () => {
                  setViewOutputsPrompt(null);
                  handleAttachOutput(viewOutputsPrompt);
                }
          }
        />
      )}
      {showAIEnhancer && currentPromptForAI && (
        <AIPromptEnhancer
          prompt={currentPromptForAI}
          onApply={async (enhanced) => {
            await handleUpdate(enhanced.id, enhanced);
            setShowAIEnhancer(false);
          }}
          onSaveAsNew={(enhanced) => {
            if (isGuestMode) {
              const p = guestState.addPrompt(enhanced);
              setUserPrompts((prev) => [p, ...prev]);
            } else savePrompt(user.uid, enhanced, activeTeam);
            setShowAIEnhancer(false);
            showSuccessToast("Enhanced prompt saved!");
          }}
          onClose={() => {
            setShowAIEnhancer(false);
            setCurrentPromptForAI(null);
          }}
        />
      )}

      {/* ── Responsive Scoped styles ── */}
      <style>{`
        /* ══════════════════════════════════════════════════════════════
           DARK "INK" THEME TOKENS — same monochrome palette as the
           marketing site (ink / paper / fog / line / muted), inverted
           for a dark background. Scoped to this component only: every
           var(--foreground), var(--card), var(--border), var(--primary),
           etc. used below (and by shared classes like .glass-card,
           .btn-primary, .form-input) will resolve to these values
           anywhere inside .prompt-list-container.
        ══════════════════════════════════════════════════════════════ */
        .prompt-list-container {
          --background: #0a0a0b;
          --card: #16161a;
          --muted: #1e1e22;
          --border: rgba(255,255,255,0.09);
          --foreground: #f2f2f3;
          --muted-foreground: #9b9ba3;
          --primary: #f2f2f3;
          --primary-foreground: #0a0a0b;
          --primary-rgb: 242,242,243;
          --secondary: #1e1e22;
          --secondary-foreground: #f2f2f3;
          --accent: #1e1e22;
          --accent-foreground: #f2f2f3;
          color: var(--foreground);
        }

        /* ══════════════════════════════════════════════════════════════
           PROMPT CARD v3 — three-column layout
           (avatar/title/tags | preview + tab bar | stats + rating input)
        ══════════════════════════════════════════════════════════════ */
        .prompt-card-v3 {
          margin-bottom: 0.875rem;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--card);
          transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
        }
        .prompt-card-v3:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          border-color: var(--primary-20, color-mix(in srgb, var(--primary) 20%, transparent));
        }
        .prompt-card-v3.new {
          border-left: 3px solid var(--primary);
        }
        .prompt-card-v3.viewed {
          border-left: 3px solid transparent;
        }

        .prompt-card-columns {
          display: grid;
          grid-template-columns: 1.15fr 1fr 210px;
          align-items: start;
        }
        .prompt-card-v3.is-demo .prompt-card-columns {
          grid-template-columns: 1fr;
        }
        .prompt-col {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .prompt-col-left {
          padding: 0.75rem 0.875rem;
          gap: 0.5rem;
          border-right: 1px solid var(--border);
        }
        .prompt-col-middle {
          padding: 0.75rem;
          gap: 0.5rem;
          border-right: 1px solid var(--border);
        }
        .prompt-col-right {
          padding: 0.75rem;
          gap: 0.625rem;
          background: color-mix(in srgb, var(--muted) 35%, transparent);
        }

        /* ── Left: top row (selector / avatar / name / role) ── */
        .prompt-left-top {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .prompt-author-block {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          min-width: 0;
        }
        .prompt-author-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
          min-width: 0;
        }
        .prompt-author-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }
        .prompt-role-chip {
          font-size: 0.56rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          width: fit-content;
        }
        .prompt-role-chip.owner { color: var(--foreground); }
        .prompt-role-chip.admin { color: var(--muted-foreground); }
        .prompt-left-top-spacer { flex: 1; }

        /* ── Left: middle (title + text) ── */
        .prompt-left-mid { flex: 1; }
        .prompt-title-text {
          font-size: 0.9rem;
          font-weight: 700;
          margin-bottom: 0.3rem;
          line-height: 1.3;
          color: var(--foreground);
        }
        .prompt-text-content {
          font-size: 0.8rem;
          color: var(--muted-foreground);
          line-height: 1.55;
        }

        .prompt-text-content.expanded {
          max-height: 340px;
          overflow-y: auto;
          padding-right: 8px;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .prompt-text-content.expanded::-webkit-scrollbar { width: 6px; }
        .prompt-text-content.expanded::-webkit-scrollbar-track { background: transparent; }
        .prompt-text-content.expanded::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

        /* ── Left: bottom (icon actions + tags) ── */
        .prompt-left-bottom {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: auto;
          padding-top: 0.4rem;
          border-top: 1px solid var(--border);
        }
        .prompt-left-icon-actions {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }
        .icon-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid rgba(var(--primary-rgb), 0.15);
          background: transparent;
          color: var(--muted-foreground);
          cursor: pointer;
          transition: all 0.15s;
        }
        .icon-action-btn:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.08);
          border-color: rgba(var(--primary-rgb), 0.3);
          color: var(--foreground);
        }
        .btn-action-primary-compact {
          padding: 0.4rem 0.7rem;
          font-size: 0.72rem;
        }
        .prompt-left-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }

        /* ── Middle: output preview frame ── */
        .prompt-preview-frame {
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          background: rgba(0,0,0,0.35);
          display: flex;
          flex-direction: column;
        }
        .preview-frame-header {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.6rem;
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--muted) 50%, transparent);
        }
        .preview-frame-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgb(34,197,94);
          box-shadow: 0 0 6px rgba(34,197,94,0.6);
        }
        .preview-frame-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--muted-foreground);
          flex: 1;
        }
        .preview-frame-expand {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px; height: 20px;
          border-radius: 5px;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          cursor: pointer;
          transition: all 0.15s;
        }
        .preview-frame-expand:hover {
          background: rgba(var(--primary-rgb),0.1);
          color: var(--primary);
        }

        .preview-empty-state {
          width: 100%;
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.75rem;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          font-size: 0.7rem;
          cursor: default;
        }
        .preview-empty-clickable {
          cursor: pointer;
          transition: background 0.15s;
        }
        .preview-empty-clickable:hover {
          background: var(--muted);
        }
        .attach-pill {
          font-size: 0.6rem;
          padding: 0.1rem 0.5rem;
          border-radius: 999px;
          border: 1px dashed var(--border);
          margin-top: 0.2rem;
          opacity: 0.8;
        }

        .preview-carousel {
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .preview-carousel-main {
          display: flex;
          flex-direction: column;
          width: 100%;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }
        .preview-carousel-main:hover {
          background: var(--muted);
        }
        .preview-carousel-info {
          padding: 0.5rem 0.625rem;
        }
        .preview-carousel-title {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--foreground);
          margin-bottom: 0.2rem;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .preview-carousel-snippet {
          font-size: 0.65rem;
          color: var(--muted-foreground);
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .output-visual {
          width: 100%;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          max-height: 130px;
          overflow: hidden;
          position: relative;
        }
        .output-visual img {
          width: 100%;
          height: auto;
          max-height: 130px;
          object-fit: contain;
          display: block;
        }
        .output-visual-video video {
          width: 100%;
          max-height: 130px;
          object-fit: cover;
          display: block;
          pointer-events: none;
        }
        .output-visual-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          opacity: 0.6;
          padding: 1rem;
          font-size: 0.58rem;
          color: var(--muted-foreground);
        }
        .output-visual-text {
          flex-direction: row;
          gap: 0.4rem;
          padding: 0.75rem;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--foreground);
          min-height: 60px;
        }
        .output-play-badge {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .output-play-badge svg {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: rgba(10,10,11,.75);
          border: 2px solid rgba(255,255,255,.35);
          padding: 6px;
          box-sizing: border-box;
        }

        .output-visual-compact {
          max-height: none;
          height: 100%;
          min-height: 0;
        }
        .output-visual-compact img,
        .output-visual-compact video {
          max-height: none;
          height: 100%;
          object-fit: cover;
        }
        .output-visual-compact.output-visual-text {
          flex-direction: column;
          padding: 0.35rem;
          font-size: 0.55rem;
          gap: 0.15rem;
          min-height: 0;
        }
        .output-visual-compact .output-visual-placeholder {
          padding: 0.35rem;
        }
        .output-visual-compact .output-play-badge svg {
          width: 16px; height: 16px;
          padding: 4px;
        }

        .carousel-nav-btn {
          position: absolute;
          top: 40%;
          transform: translateY(-50%);
          width: 22px; height: 22px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--card) 85%, transparent);
          color: var(--foreground);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .carousel-nav-btn:hover {
          background: var(--primary);
          color: var(--primary-foreground);
          border-color: var(--primary);
        }
        .carousel-nav-prev { left: 0.4rem; }
        .carousel-nav-next { right: 0.4rem; }

        .carousel-dots {
          display: flex;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.3rem 0;
        }
        .carousel-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--border);
          transition: all 0.15s;
        }
        .carousel-dot.active {
          background: var(--primary);
          width: 12px;
          border-radius: 3px;
        }

        .preview-count-badge {
          font-size: 0.6rem;
          color: var(--muted-foreground);
          text-align: right;
          padding: 0 0.6rem 0.4rem;
        }

        /* ── Middle: tablet bar ── */
        .prompt-tab-bar {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--muted) 55%, transparent);
          border: 1px solid var(--border);
        }
        .tab-bar-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem 0.55rem;
          border-radius: 999px;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          font-size: 0.65rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tab-bar-btn:hover {
          background: rgba(var(--primary-rgb),0.08);
          color: var(--foreground);
        }
        .tab-bar-btn.active {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .tab-bar-count {
          font-variant-numeric: tabular-nums;
        }
        .tab-bar-spacer { flex: 1; }

        /* Smoothly expanding sections below the tab bar */
        .panel-expand {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.25s ease;
        }
        .panel-expand.open {
          grid-template-rows: 1fr;
        }
        .panel-expand > * {
          overflow: hidden;
        }
        .panel-expand:not(.open) {
          overflow: hidden;
        }

        .expanded-comments-panel {
          padding: 0.75rem;
          background: var(--muted);
          border-radius: 10px;
          border: 1px solid var(--border);
          margin-top: 0.15rem;
        }
        .rating-distribution-panel,
        .ai-analysis-panel {
          padding: 0.65rem 0.75rem;
          background: var(--muted);
          border-radius: 10px;
          border: 1px solid var(--border);
          margin-top: 0.15rem;
        }
        .rating-distribution-header {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          margin-bottom: 0.5rem;
        }
        .rating-distribution-avg {
          font-weight: 700;
          font-size: 0.8rem;
          color: var(--foreground);
        }
        .rating-distribution-count {
          font-size: 0.7rem;
          color: var(--muted-foreground);
        }
        .panel-empty-note {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.68rem;
          color: var(--muted-foreground);
          background: var(--muted);
          border-radius: 10px;
          border: 1px solid var(--border);
          margin-top: 0.15rem;
        }

        .ai-stat-chip {
          padding: 0.4rem;
          border-radius: 8px;
          background: var(--card);
          border: 1px solid var(--border);
        }
        .ai-stat-chip-label {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--muted-foreground);
          margin-bottom: 0.15rem;
        }
        .ai-stat-chip-value {
          font-family: ui-monospace, monospace;
          font-weight: 700;
          font-size: 0.7rem;
          color: var(--foreground);
        }
        .ai-stat-chip-best {
          background: rgba(var(--primary-rgb),0.1);
        }
        .ai-compat-row {
          margin-top: 0.5rem;
          font-size: 0.65rem;
        }
        .ai-compat-row .good { color: rgb(74,222,128); }
        .ai-compat-row .ok { color: rgb(250,204,21); }
        .ai-compat-row .poor { color: rgb(248,113,113); }
        .ai-enhance-btn {
          width: 100%;
          margin-top: 0.55rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.45rem;
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted-foreground);
          cursor: pointer;
          transition: all 0.15s;
        }
        .ai-enhance-btn:hover {
          background: rgba(var(--primary-rgb),0.08);
          border-color: rgba(var(--primary-rgb),0.3);
          color: var(--primary);
        }

        /* ── Right column ── */
        .prompt-right-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .prompt-right-date {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.68rem;
          color: var(--muted-foreground);
        }
        .prompt-right-stats {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.3rem;
        }
        .stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--foreground);
        }

        .outputs-mini-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0.35rem;
          flex: 1;
          min-height: 100px;
        }
        .outputs-mini-grid-locked {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          border: 1px dashed var(--border);
          border-radius: 8px;
          background: transparent;
          color: var(--muted-foreground);
          font-size: 0.65rem;
          cursor: pointer;
        }
        .output-mini-cell {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: rgba(0,0,0,0.35);
          padding: 0;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 0;
        }
        .output-mini-cell:hover {
          border-color: rgba(var(--primary-rgb),0.4);
          transform: translateY(-1px);
        }
        .output-mini-cell-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          border-style: dashed;
          color: var(--muted-foreground);
          background: transparent;
        }

        .prompt-right-rating-input {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }
        .prompt-right-rating-label {
          font-size: 0.62rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--muted-foreground);
        }

        /* ── Responsive: tablet stacks right column full-width, mobile stacks all ── */
        @media (max-width: 900px) {
          .prompt-card-columns {
            grid-template-columns: 1fr 1fr;
          }
          .prompt-col-right {
            grid-column: 1 / -1;
            border-right: none;
            border-top: 1px solid var(--border);
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
          }
          .prompt-right-top { order: 1; }
          .prompt-right-stats { order: 2; }
          .outputs-mini-grid { order: 3; flex: 1 1 160px; min-width: 160px; }
          .prompt-right-rating-input { order: 4; border-top: none; padding-top: 0; margin-top: 0; }
        }
        @media (max-width: 620px) {
          .prompt-card-columns {
            grid-template-columns: 1fr;
          }
          .prompt-col-left,
          .prompt-col-middle {
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
        }

        /* ── Filter grid ── */
        .filter-grid-responsive {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }
        @media (max-width: 700px) {
          .filter-grid-responsive {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 440px) {
          .filter-grid-responsive {
            grid-template-columns: 1fr;
          }
        }

        /* ── Kebab upward ── */
        .kebab-menu-upward {
          bottom: calc(100% + 6px) !important;
          top: auto !important;
          transform-origin: bottom right;
          animation: menuUpIn 0.15s ease-out;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.5);
        }
        @keyframes menuUpIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Privacy badge ── */
        .privacy-badge {
          display: inline-flex; align-items: center; gap: 0.2rem;
          font-size: 0.65rem; padding: 0.1rem 0.45rem; border-radius: 999px; font-weight: 600;
        }
        .privacy-badge.private { background: rgba(239,68,68,0.15); color: rgb(248,113,113); }
        .privacy-badge.public  { background: rgba(34,197,94,0.15);  color: rgb(74,222,128);  }

        /* ── Tags ── */
        .prompt-tag {
          display: inline-flex; align-items: center; padding: 0.1rem 0.45rem;
          border-radius: 999px; font-size: 0.65rem; font-weight: 500;
          background: var(--muted); color: var(--muted-foreground); border: 1px solid var(--border);
        }
        .prompt-tag-more {
          display: inline-flex; align-items: center; padding: 0.1rem 0.45rem;
          border-radius: 999px; font-size: 0.65rem; font-weight: 500;
          background: var(--muted); color: var(--primary); border: 1px dashed var(--border);
        }

        /* ── Demo badge ── */
        .demo-badge-small {
          display: inline-flex; align-items: center; padding: 0.1rem 0.45rem;
          border-radius: 999px; font-size: 0.65rem; font-weight: 600;
          background: rgba(var(--primary-rgb), 0.15);
          color: var(--primary);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
        }

        /* Read more */
        .read-more-btn {
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-size: 0.7rem; color: var(--primary); background: none;
          border: none; cursor: pointer; padding: 0; opacity: 0.85; transition: opacity 0.15s;
        }
        .read-more-btn:hover { opacity: 1; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Mobile action bar compact ── */
        @media (max-width: 400px) {
          .prompt-actions { padding: 0.35rem 0.625rem; gap: 0.3rem; }
          .btn-action-secondary, .btn-action-primary { padding: 0.3rem 0.55rem; font-size: 0.72rem; }
        }
      `}</style>
    </div>
  );
}
