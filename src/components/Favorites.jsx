// src/components/Favorites.jsx
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { toggleFavorite } from "../lib/prompts";
import { canViewPrompt } from "../lib/prompts";
import {
  Star, Copy, Trash2, ChevronDown, ChevronUp,
  Lock, Unlock, Tag, Calendar, Check,
} from "lucide-react";

// ── FavoriteButton ─────────────────────────────────────────────────────────────
export function FavoriteButton({ prompt, teamId, teamName, size = "normal" }) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    if (!user || !prompt) return;
    const favRef = doc(db, "users", user.uid, "favorites", prompt.id);
    const unsub  = onSnapshot(favRef, snap => setIsFavorite(snap.exists()));
    return () => unsub();
  }, [user, prompt]);

  async function handleToggle() {
    if (!user || loading) return;
    setLoading(true);
    try { await toggleFavorite(user.uid, { ...prompt, teamId }, isFavorite); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const iconSize = size === "small" ? 16 : 18;

  return (
    <>
      <style>{`
        .fav-btn {
          display:flex;align-items:center;justify-content:center;
          border-radius:8px;border:none;cursor:pointer;transition:all .15s;
          flex-shrink:0;
        }
        .fav-btn:hover    { transform:scale(1.1); }
        .fav-btn:disabled { opacity:.5;cursor:not-allowed;transform:none; }
        .fav-btn.on  { background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.25); }
        .fav-btn.off { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08); }
      `}</style>
      <button onClick={handleToggle} disabled={loading}
        className={`fav-btn${isFavorite ? " on" : " off"}`}
        style={{ padding: size === "small" ? "6px" : "8px" }}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
        <Star size={iconSize} color={isFavorite ? "#f59e0b" : "var(--muted-foreground)"}
          fill={isFavorite ? "#f59e0b" : "none"} strokeWidth={2} />
      </button>
    </>
  );
}

// ── FavoritesList ──────────────────────────────────────────────────────────────
export default function FavoritesList() {
  const { user } = useAuth();
  const [favorites,  setFavorites]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState({});
  const [copied,     setCopied]     = useState({});

  useEffect(() => {
    if (!user) { setFavorites([]); setLoading(false); return; }
    const favsRef = collection(db, "users", user.uid, "favorites");
    const unsub = onSnapshot(favsRef, async snap => {
      const favData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const roles = {};
      const teamIds = [...new Set(favData.map(f => f.teamId))];
      for (const tid of teamIds) {
        try {
          const td = await getDoc(doc(db, "teams", tid));
          if (td.exists()) roles[tid] = td.data().members?.[user.uid] || null;
        } catch {}
      }
      setFavorites(favData.filter(f => canViewPrompt(f, user.uid, roles[f.teamId])));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  async function handleRemove(fav) {
    if (!confirm("Remove this prompt from favorites?")) return;
    try { await toggleFavorite(user.uid, fav, true); }
    catch (e) { console.error(e); }
  }

  async function handleCopy(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(p => ({ ...p, [id]: true }));
      setTimeout(() => setCopied(p => ({ ...p, [id]: false })), 2000);
    } catch {}
  }

  function fmtDate(ts) {
    if (!ts) return "";
    try { return ts.toDate().toLocaleDateString("en-US",{ month:"short",day:"numeric",year:"numeric" }); }
    catch { return ""; }
  }

  if (loading) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"4rem",gap:".75rem" }}>
      <style>{`@keyframes flSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:18,height:18,borderRadius:"50%",border:"2px solid rgba(139,92,246,.15)",borderTopColor:"#8b5cf6",animation:"flSpin .75s linear infinite" }} />
      <span style={{ fontSize:".82rem",color:"var(--muted-foreground)" }}>Loading favorites…</span>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes flSpin    { to{transform:rotate(360deg)} }
        @keyframes flSlideUp { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:none} }

        .fl-wrap { display:flex;flex-direction:column;gap:.875rem; }

        /* ── Header ── */
        .fl-header {
          display:flex;align-items:center;justify-content:space-between;
          padding:.875rem 1.125rem;
          background:var(--card);border:1px solid rgba(255,255,255,.05);border-radius:12px;
        }
        .fl-header-left { display:flex;align-items:center;gap:.625rem; }
        .fl-header-icon {
          width:34px;height:34px;border-radius:9px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);
        }
        .fl-header-title { font-size:.9rem;font-weight:700;color:var(--foreground);letter-spacing:-.01em; }
        .fl-header-sub   { font-size:.68rem;color:var(--muted-foreground);margin-top:.08rem; }
        .fl-header-count {
          font-size:.65rem;font-weight:700;padding:.18rem .55rem;border-radius:5px;
          background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.18);
          font-variant-numeric:tabular-nums;
        }

        /* ── Empty ── */
        .fl-empty {
          display:flex;flex-direction:column;align-items:center;
          padding:4rem 1rem;gap:.75rem;
          background:var(--card);border:1px solid rgba(255,255,255,.05);border-radius:12px;
        }
        .fl-empty-ring {
          width:52px;height:52px;border-radius:14px;
          display:flex;align-items:center;justify-content:center;margin-bottom:.25rem;
          background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.12);
        }
        .fl-empty-title { font-size:.95rem;font-weight:700;color:var(--foreground); }
        .fl-empty-sub   { font-size:.78rem;color:var(--muted-foreground);text-align:center;max-width:280px;line-height:1.55; }

        /* ── Favorite card ── */
        .fl-card {
          background:var(--card);border-radius:12px;overflow:hidden;
          border:1px solid rgba(255,255,255,.05);
          transition:border-color .15s;
          animation:flSlideUp .26s ease-out backwards;
        }
        .fl-card:hover { border-color:rgba(139,92,246,.14); }

        /* accent strip based on visibility */
        .fl-strip { height:2px;width:100%;flex-shrink:0; }

        /* card head */
        .fl-card-hd {
          display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
          padding:.875rem 1rem .75rem;
        }
        .fl-card-left  { flex:1;min-width:0; }
        .fl-title-row  { display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem; }
        .fl-title      { font-size:.88rem;font-weight:700;color:var(--foreground);letter-spacing:-.01em; }
        .fl-vis-badge  {
          display:inline-flex;align-items:center;gap:.28rem;
          font-size:.6rem;font-weight:700;padding:.1rem .45rem;border-radius:4px;
          white-space:nowrap;
        }
        .fl-meta { display:flex;align-items:center;gap:.4rem;font-size:.68rem;color:var(--muted-foreground); }
        .fl-meta-sep { width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.18); }

        /* actions */
        .fl-actions { display:flex;align-items:center;gap:.35rem;flex-shrink:0; }
        .fl-action-btn {
          width:28px;height:28px;border-radius:7px;
          border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;transition:all .13s;color:var(--muted-foreground);
        }
        .fl-action-btn:hover { color:var(--foreground);border-color:rgba(255,255,255,.18); }
        .fl-action-btn.del   { border-color:rgba(239,68,68,.15);background:rgba(239,68,68,.06);color:#f87171; }
        .fl-action-btn.del:hover { background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3); }
        .fl-action-btn.copied { border-color:rgba(52,211,153,.25);background:rgba(52,211,153,.08);color:#34d399; }

        /* text preview */
        .fl-preview-wrap { padding:0 1rem .875rem; }
        .fl-preview {
          padding:.7rem .875rem;border-radius:8px;
          background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);
          font-family:'JetBrains Mono','Consolas',monospace;
          font-size:.74rem;line-height:1.7;color:rgba(228,228,231,.8);
          white-space:pre-wrap;word-break:break-word;
        }
        .fl-preview.clamped {
          display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
        }

        /* expand toggle */
        .fl-toggle {
          display:flex;align-items:center;gap:.3rem;margin-top:.5rem;
          font-size:.7rem;font-weight:600;color:var(--primary);
          background:transparent;border:none;cursor:pointer;padding:0;transition:opacity .13s;
        }
        .fl-toggle:hover { opacity:.75; }

        /* tags */
        .fl-tags { display:flex;flex-wrap:wrap;gap:.3rem;padding:0 1rem .875rem; }
        .fl-tag  {
          font-size:.62rem;font-weight:600;padding:.1rem .4rem;border-radius:4px;
          background:rgba(255,255,255,.04);color:var(--muted-foreground);
          border:1px solid rgba(255,255,255,.06);
        }
      `}</style>

      {favorites.length === 0 ? (
        <div className="fl-empty">
          <div className="fl-empty-ring"><Star size={24} color="rgba(245,158,11,.5)" fill="none" /></div>
          <div className="fl-empty-title">No favorites yet</div>
          <div className="fl-empty-sub">Star prompts from any team to save them here for quick access</div>
        </div>
      ) : (
        <div className="fl-wrap">

          {/* header */}
          <div className="fl-header">
            <div className="fl-header-left">
              <div className="fl-header-icon"><Star size={16} color="#f59e0b" fill="#f59e0b" /></div>
              <div>
                <div className="fl-header-title">My Favorites</div>
                <div className="fl-header-sub">Quick-access saved prompts</div>
              </div>
            </div>
            <span className="fl-header-count">{favorites.length} {favorites.length === 1 ? "prompt" : "prompts"}</span>
          </div>

          {/* cards */}
          {favorites.map((fav, i) => {
            const isExpanded = expanded[fav.id];
            const isPrivate  = fav.visibility === "private";
            const isCopied   = copied[fav.id];
            const stripColor = isPrivate ? "#f59e0b" : "rgba(139,92,246,.6)";
            return (
              <div key={fav.id} className="fl-card" style={{ animationDelay:`${i*.04}s` }}>

                {/* accent strip */}
                <div className="fl-strip" style={{ background:stripColor }} />

                {/* head */}
                <div className="fl-card-hd">
                  <div className="fl-card-left">
                    <div className="fl-title-row">
                      <span className="fl-title">{fav.title}</span>
                      <span className="fl-vis-badge"
                        style={isPrivate
                          ? { background:"rgba(245,158,11,.1)", color:"#f59e0b", border:"1px solid rgba(245,158,11,.18)" }
                          : { background:"rgba(139,92,246,.1)", color:"#a78bfa", border:"1px solid rgba(139,92,246,.18)" }}>
                        {isPrivate ? <Lock size={9} /> : <Unlock size={9} />}
                        {isPrivate ? "Private" : "Public"}
                      </span>
                    </div>
                    <div className="fl-meta">
                      <Calendar size={11} />
                      {fmtDate(fav.createdAt) && <span>Saved {fmtDate(fav.createdAt)}</span>}
                      <span className="fl-meta-sep" />
                      <span style={{ fontVariantNumeric:"tabular-nums" }}>{fav.text?.length?.toLocaleString() || 0} chars</span>
                    </div>
                  </div>

                  <div className="fl-actions">
                    <button onClick={() => handleCopy(fav.id, fav.text)}
                      className={`fl-action-btn${isCopied ? " copied" : ""}`} title="Copy to clipboard">
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button onClick={() => handleRemove(fav)}
                      className="fl-action-btn del" title="Remove from favorites">
                      <Trash2 size={12} />
                    </button>
                    <button onClick={() => setExpanded(p => ({ ...p, [fav.id]: !p[fav.id] }))}
                      className="fl-action-btn" title={isExpanded ? "Collapse" : "Expand"}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* preview */}
                <div className="fl-preview-wrap">
                  <div className={`fl-preview${isExpanded ? "" : " clamped"}`}>{fav.text}</div>
                  <button className="fl-toggle" onClick={() => setExpanded(p => ({ ...p, [fav.id]: !p[fav.id] }))}>
                    {isExpanded ? <><ChevronUp size={12} />Show less</> : <><ChevronDown size={12} />Show full prompt</>}
                  </button>
                </div>

                {/* tags */}
                {fav.tags?.length > 0 && (
                  <div className="fl-tags">
                    {fav.tags.map((t, ti) => (
                      <span key={ti} className="fl-tag">#{t}</span>
                    ))}
                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}
    </>
  );
}
