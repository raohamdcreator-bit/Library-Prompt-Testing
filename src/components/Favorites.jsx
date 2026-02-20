// src/components/Favorites.jsx
import { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import {
  collection, onSnapshot, doc, getDoc, deleteDoc, query,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { toggleFavorite, canViewPrompt } from "../lib/prompts";
import { subscribeToResults } from "../lib/results";
import { usePromptRating } from "./PromptAnalytics";
import EnhancedBadge from "./EnhancedBadge";
import {
  Star, Copy, Trash2, ChevronDown, ChevronUp,
  Lock, Unlock, Tag, Calendar, Check, Activity,
  FileText, Code, Image as ImageIcon, MessageSquare,
  Eye, Sparkles, BarChart2, TrendingUp,
} from "lucide-react";

// ── FavoriteButton (unchanged) ─────────────────────────────────────────────────
export function FavoriteButton({ prompt, teamId }) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !prompt) return;
    const favRef = doc(db, "users", user.uid, "favorites", prompt.id);
    const unsub = onSnapshot(favRef, snap => setIsFavorite(snap.exists()));
    return () => unsub();
  }, [user, prompt]);

  async function handleToggle() {
    if (!user || loading) return;
    setLoading(true);
    try { await toggleFavorite(user.uid, { ...prompt, teamId }, isFavorite); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`fav-btn${isFavorite ? " on" : " off"}`}
      style={{ padding: "8px" }}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        size={18}
        color={isFavorite ? "#f59e0b" : "var(--muted-foreground)"}
        fill={isFavorite ? "#f59e0b" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}

// ── Compact star row ───────────────────────────────────────────────────────────
function RatingRow({ teamId, promptId }) {
  const { averageRating, totalRatings, ratings } = usePromptRating(teamId, promptId);

  const dist = useMemo(() => {
    const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(r => { if (r.rating >= 1 && r.rating <= 5) d[r.rating]++; });
    return d;
  }, [ratings]);

  if (totalRatings === 0) {
    return (
      <span className="fav-meta-chip">
        <Star size={11} />
        No ratings yet
      </span>
    );
  }

  const filled = Math.round(averageRating);
  return (
    <div className="fav-rating-row">
      <div className="fav-stars">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            size={11}
            className={s <= filled ? "star-filled" : "star-empty"}
            fill={s <= filled ? "#f59e0b" : "none"}
            color={s <= filled ? "#f59e0b" : "var(--muted-foreground)"}
          />
        ))}
      </div>
      <span className="fav-rating-val">{averageRating.toFixed(1)}</span>
      <span className="fav-rating-count">({totalRatings})</span>
    </div>
  );
}

// ── Output mini-preview ────────────────────────────────────────────────────────
function OutputMiniPreview({ outputs }) {
  if (!outputs || outputs.length === 0) {
    return (
      <span className="fav-meta-chip fav-meta-chip-muted">
        <Activity size={11} />
        No outputs
      </span>
    );
  }

  const latest = outputs[0];
  const icon =
    latest.type === "code" ? <Code size={11} style={{ color: "#a78bfa" }} /> :
    latest.type === "image" ? <ImageIcon size={11} style={{ color: "#f472b6" }} /> :
    <FileText size={11} style={{ color: "#60a5fa" }} />;

  return (
    <div className="fav-output-strip">
      {latest.type === "image" && latest.imageUrl ? (
        <img src={latest.imageUrl} alt="" className="fav-output-thumb" />
      ) : icon}
      <span className="fav-output-title">{latest.title || "Untitled output"}</span>
      {outputs.length > 1 && (
        <span className="fav-output-count">+{outputs.length - 1}</span>
      )}
    </div>
  );
}

// ── Individual favorite card ───────────────────────────────────────────────────
function FavoriteCard({ fav, index, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [outputs, setOutputs] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [viewCount, setViewCount] = useState(fav.stats?.views || 0);

  // Subscribe to live outputs
  useEffect(() => {
    if (!fav.teamId || !fav.id) return;
    const unsub = subscribeToResults(fav.teamId, fav.id, setOutputs);
    return () => unsub();
  }, [fav.teamId, fav.id]);

  // Subscribe to live comment count
  useEffect(() => {
    if (!fav.teamId || !fav.id) return;
    const q = query(
      collection(db, "teams", fav.teamId, "prompts", fav.id, "comments")
    );
    const unsub = onSnapshot(q, snap => setCommentCount(snap.size), () => {});
    return () => unsub();
  }, [fav.teamId, fav.id]);

  // Fetch live view count from the actual prompt doc
  useEffect(() => {
    if (!fav.teamId || !fav.id) return;
    getDoc(doc(db, "teams", fav.teamId, "prompts", fav.id))
      .then(snap => {
        if (snap.exists()) setViewCount(snap.data().stats?.views || 0);
      })
      .catch(() => {});
  }, [fav.teamId, fav.id]);

  const isPrivate = fav.visibility === "private";
  const stripColor = isPrivate ? "#f59e0b" : "rgba(139,92,246,.6)";
  const shouldTruncate = (fav.text?.length || 0) > 200;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fav.text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="fav-card" style={{ animationDelay: `${index * 0.04}s` }}>
      {/* Accent strip */}
      <div className="fav-strip" style={{ background: stripColor }} />

      {/* Header row */}
      <div className="fav-card-hd">
        <div className="fav-card-left">
          {/* Title + badges */}
          <div className="fav-title-row">
            <span className="fav-title">{fav.title}</span>
            <span
              className="fav-vis-badge"
              style={
                isPrivate
                  ? { background: "rgba(245,158,11,.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.18)" }
                  : { background: "rgba(139,92,246,.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,.18)" }
              }
            >
              {isPrivate ? <Lock size={9} /> : <Unlock size={9} />}
              {isPrivate ? "Private" : "Public"}
            </span>
            {fav.enhanced && (
              <EnhancedBadge
                enhanced={fav.enhanced}
                enhancedFor={fav.enhancedFor}
                enhancementType={fav.enhancementType}
                size="sm"
              />
            )}
          </div>

          {/* Meta chips row */}
          <div className="fav-meta-row">
            <span className="fav-meta-chip">
              <Calendar size={11} />
              {fmtDate(fav.createdAt)}
            </span>
            <span className="fav-meta-sep" />
            <span className="fav-meta-chip">
              <Eye size={11} />
              {viewCount}
            </span>
            <span className="fav-meta-sep" />
            <span className="fav-meta-chip">
              <MessageSquare size={11} />
              {commentCount}
            </span>
            <span className="fav-meta-sep" />
            <span className="fav-meta-chip fav-meta-chip-muted">
              {(fav.text?.length || 0).toLocaleString()} chars
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="fav-actions">
          <button
            onClick={handleCopy}
            className={`fav-action-btn${copied ? " copied" : ""}`}
            title="Copy to clipboard"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <button
            onClick={() => onRemove(fav)}
            className="fav-action-btn del"
            title="Remove from favorites"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={() => setIsExpanded(p => !p)}
            className="fav-action-btn"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Ratings + outputs row */}
      <div className="fav-live-row">
        <RatingRow teamId={fav.teamId} promptId={fav.id} />
        <span className="fav-meta-sep" />
        <OutputMiniPreview outputs={outputs} />
      </div>

      {/* Tags */}
      {fav.tags?.length > 0 && (
        <div className="fav-tags">
          {fav.tags.map((t, i) => (
            <span key={i} className="fav-tag">#{t}</span>
          ))}
        </div>
      )}

      {/* Prompt text */}
      <div className="fav-preview-wrap">
        <div className={`fav-preview${isExpanded ? "" : " clamped"}`}>
          {fav.text}
        </div>
        {shouldTruncate && (
          <button className="fav-toggle" onClick={() => setIsExpanded(p => !p)}>
            {isExpanded
              ? <><ChevronUp size={12} />Show less</>
              : <><ChevronDown size={12} />Show full prompt</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

// ── FavoritesList ──────────────────────────────────────────────────────────────
export default function FavoritesList() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setFavorites([]); setLoading(false); return; }
    const favsRef = collection(db, "users", user.uid, "favorites");
    const unsub = onSnapshot(favsRef, async snap => {
      const favData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Check roles
      const roles = {};
      const teamIds = [...new Set(favData.map(f => f.teamId).filter(Boolean))];
      for (const tid of teamIds) {
        try {
          const td = await getDoc(doc(db, "teams", tid));
          if (td.exists()) roles[tid] = td.data().members?.[user.uid] || null;
        } catch {}
      }

      // Verify each prompt still exists; auto-delete stale favorites
      const existenceChecks = await Promise.all(
        favData.map(async fav => {
          if (!fav.teamId || !fav.id) return false;
          try {
            const snap = await getDoc(doc(db, "teams", fav.teamId, "prompts", fav.id));
            return snap.exists();
          } catch { return false; }
        })
      );

      const stale = favData.filter((_, i) => !existenceChecks[i]);
      await Promise.all(
        stale.map(fav =>
          deleteDoc(doc(db, "users", user.uid, "favorites", fav.id)).catch(() => {})
        )
      );

      const valid = favData.filter((fav, i) =>
        existenceChecks[i] && canViewPrompt(fav, user.uid, roles[fav.teamId])
      );
      setFavorites(valid);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  async function handleRemove(fav) {
    if (!confirm("Remove this prompt from favorites?")) return;
    try { await toggleFavorite(user.uid, fav, true); }
    catch (e) { console.error(e); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem", gap: ".75rem" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(139,92,246,.15)", borderTopColor: "#8b5cf6", animation: "flSpin .75s linear infinite" }} />
      <span style={{ fontSize: ".82rem", color: "var(--muted-foreground)" }}>Loading favorites…</span>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes flSpin    { to { transform: rotate(360deg) } }
        @keyframes flSlideUp { from { opacity:0; transform:translateY(7px) } to { opacity:1; transform:none } }

        /* ── Shared button base ── */
        .fav-btn {
          display:flex; align-items:center; justify-content:center;
          border-radius:8px; border:none; cursor:pointer; transition:all .15s; flex-shrink:0;
        }
        .fav-btn:hover    { transform:scale(1.1); }
        .fav-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .fav-btn.on  { background:rgba(245,158,11,.12); border:1px solid rgba(245,158,11,.25); }
        .fav-btn.off { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }

        /* ── Layout ── */
        .fav-wrap { display:flex; flex-direction:column; gap:.875rem; }

        /* ── Header ── */
        .fav-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:.875rem 1.125rem;
          background:var(--card); border:1px solid rgba(255,255,255,.05); border-radius:12px;
        }
        .fav-header-left { display:flex; align-items:center; gap:.625rem; }
        .fav-header-icon {
          width:34px; height:34px; border-radius:9px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.2);
        }
        .fav-header-title { font-size:.9rem; font-weight:700; color:var(--foreground); letter-spacing:-.01em; }
        .fav-header-sub   { font-size:.68rem; color:var(--muted-foreground); margin-top:.08rem; }
        .fav-header-count {
          font-size:.65rem; font-weight:700; padding:.18rem .55rem; border-radius:5px;
          background:rgba(245,158,11,.1); color:#f59e0b; border:1px solid rgba(245,158,11,.18);
        }

        /* ── Empty state ── */
        .fav-empty {
          display:flex; flex-direction:column; align-items:center;
          padding:4rem 1rem; gap:.75rem;
          background:var(--card); border:1px solid rgba(255,255,255,.05); border-radius:12px;
        }
        .fav-empty-ring {
          width:52px; height:52px; border-radius:14px;
          display:flex; align-items:center; justify-content:center; margin-bottom:.25rem;
          background:rgba(245,158,11,.06); border:1px solid rgba(245,158,11,.12);
        }
        .fav-empty-title { font-size:.95rem; font-weight:700; color:var(--foreground); }
        .fav-empty-sub   { font-size:.78rem; color:var(--muted-foreground); text-align:center; max-width:280px; line-height:1.55; }

        /* ── Card ── */
        .fav-card {
          background:var(--card); border-radius:12px; overflow:hidden;
          border:1px solid rgba(255,255,255,.05); transition:border-color .15s;
          animation:flSlideUp .26s ease-out backwards;
        }
        .fav-card:hover { border-color:rgba(139,92,246,.14); }
        .fav-strip { height:2px; width:100%; flex-shrink:0; }

        /* card header */
        .fav-card-hd {
          display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem;
          padding:.875rem 1rem .5rem;
        }
        .fav-card-left { flex:1; min-width:0; }
        .fav-title-row { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; margin-bottom:.35rem; }
        .fav-title     { font-size:.88rem; font-weight:700; color:var(--foreground); letter-spacing:-.01em; }
        .fav-vis-badge {
          display:inline-flex; align-items:center; gap:.28rem;
          font-size:.6rem; font-weight:700; padding:.1rem .45rem; border-radius:4px; white-space:nowrap;
        }

        /* meta chips */
        .fav-meta-row { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; }
        .fav-meta-chip {
          display:inline-flex; align-items:center; gap:.28rem;
          font-size:.68rem; color:var(--muted-foreground);
        }
        .fav-meta-chip-muted { opacity:.7; }
        .fav-meta-sep { width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,.18); flex-shrink:0; }

        /* actions */
        .fav-actions { display:flex; align-items:center; gap:.35rem; flex-shrink:0; }
        .fav-action-btn {
          width:28px; height:28px; border-radius:7px;
          border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.03);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all .13s; color:var(--muted-foreground);
        }
        .fav-action-btn:hover  { color:var(--foreground); border-color:rgba(255,255,255,.18); }
        .fav-action-btn.del    { border-color:rgba(239,68,68,.15); background:rgba(239,68,68,.06); color:#f87171; }
        .fav-action-btn.del:hover { background:rgba(239,68,68,.15); border-color:rgba(239,68,68,.3); }
        .fav-action-btn.copied { border-color:rgba(52,211,153,.25); background:rgba(52,211,153,.08); color:#34d399; }

        /* ── Live data row (ratings + outputs) ── */
        .fav-live-row {
          display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;
          padding:.25rem 1rem .5rem;
          border-top:1px solid rgba(255,255,255,.04);
        }
        .fav-rating-row { display:flex; align-items:center; gap:.3rem; }
        .fav-stars      { display:flex; align-items:center; gap:.15rem; }
        .fav-rating-val { font-size:.72rem; font-weight:700; color:var(--foreground); }
        .fav-rating-count { font-size:.68rem; color:var(--muted-foreground); }

        /* output strip */
        .fav-output-strip {
          display:flex; align-items:center; gap:.35rem;
          padding:.18rem .55rem; border-radius:6px;
          background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06);
          font-size:.68rem; color:var(--muted-foreground); max-width:200px;
        }
        .fav-output-thumb {
          width:20px; height:20px; border-radius:3px; object-fit:cover; flex-shrink:0;
        }
        .fav-output-title {
          overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
          color:var(--foreground); font-weight:500;
        }
        .fav-output-count {
          flex-shrink:0; font-size:.62rem; font-weight:700;
          color:var(--primary); background:rgba(139,92,246,.1);
          padding:.05rem .35rem; border-radius:4px;
        }

        /* tags */
        .fav-tags { display:flex; flex-wrap:wrap; gap:.3rem; padding:0 1rem .5rem; }
        .fav-tag  {
          font-size:.62rem; font-weight:600; padding:.1rem .4rem; border-radius:4px;
          background:rgba(255,255,255,.04); color:var(--muted-foreground);
          border:1px solid rgba(255,255,255,.06);
        }

        /* text preview */
        .fav-preview-wrap { padding:0 1rem .875rem; }
        .fav-preview {
          padding:.7rem .875rem; border-radius:8px;
          background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.05);
          font-family:'JetBrains Mono','Consolas',monospace;
          font-size:.74rem; line-height:1.7; color:rgba(228,228,231,.8);
          white-space:pre-wrap; word-break:break-word;
        }
        .fav-preview.clamped {
          display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        }
        .fav-toggle {
          display:flex; align-items:center; gap:.3rem; margin-top:.5rem;
          font-size:.7rem; font-weight:600; color:var(--primary);
          background:transparent; border:none; cursor:pointer; padding:0; transition:opacity .13s;
        }
        .fav-toggle:hover { opacity:.75; }
      `}</style>

      {favorites.length === 0 ? (
        <div className="fav-empty">
          <div className="fav-empty-ring">
            <Star size={24} color="rgba(245,158,11,.5)" fill="none" />
          </div>
          <div className="fav-empty-title">No favorites yet</div>
          <div className="fav-empty-sub">
            Star prompts from any team to save them here for quick access
          </div>
        </div>
      ) : (
        <div className="fav-wrap">
          {/* Header */}
          <div className="fav-header">
            <div className="fav-header-left">
              <div className="fav-header-icon">
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
              </div>
              <div>
                <div className="fav-header-title">My Favorites</div>
                <div className="fav-header-sub">Quick-access saved prompts</div>
              </div>
            </div>
            <span className="fav-header-count">
              {favorites.length} {favorites.length === 1 ? "prompt" : "prompts"}
            </span>
          </div>

          {/* Cards */}
          {favorites.map((fav, i) => (
            <FavoriteCard key={fav.id} fav={fav} index={i} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </>
  );
}
