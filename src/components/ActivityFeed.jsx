// src/components/ActivityFeed.jsx - RESPONSIVE + PERF: parallel reads + batch profile loading
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection, query, orderBy, limit, onSnapshot,
  getDoc, getDocs, doc, serverTimestamp, addDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { batchGetUserProfiles } from "../lib/firestoreUtils"; // ✅ PERF: batch profile reads
import {
  Plus, Edit2, Trash2, Star, UserPlus, UserMinus,
  RefreshCw, Activity, Download, FileText,
  MessageSquare, Users, ChevronDown,
} from "lucide-react";
import { getTimestampMillis } from "../lib/dateUtils";

// ── Activity Logger ────────────────────────────────────────────────────────────────
export const ActivityLogger = {
  async logPromptCreated(teamId, userId, promptId, promptTitle) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "prompt_created", userId, promptId, promptTitle,
        timestamp: serverTimestamp(), metadata: { action: "created" },
      });
    } catch (e) { console.error(e); }
  },
  async logPromptUpdated(teamId, userId, promptId, promptTitle) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "prompt_updated", userId, promptId, promptTitle,
        timestamp: serverTimestamp(), metadata: { action: "updated" },
      });
    } catch (e) { console.error(e); }
  },
  async logMemberJoined(teamId, userId, memberName) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "member_joined", userId,
        timestamp: serverTimestamp(), metadata: { memberName },
      });
    } catch (e) { console.error(e); }
  },
  async logPromptRated(teamId, userId, promptId, promptTitle, rating) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "prompt_rated", userId, promptId, promptTitle,
        timestamp: serverTimestamp(), metadata: { rating },
      });
    } catch (e) { console.error(e); }
  },
};

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  prompt_created:          { icon: Plus,          color: "#8b5cf6", label: "Created"  },
  prompt_updated:          { icon: Edit2,         color: "#a78bfa", label: "Updated"  },
  prompt_deleted:          { icon: Trash2,        color: "#ef4444", label: "Deleted"  },
  prompt_rated:            { icon: Star,          color: "#f59e0b", label: "Rated"    },
  prompt_rated_individual: { icon: Star,          color: "#f59e0b", label: "Rated"    },
  comment_added:           { icon: MessageSquare, color: "#22d3ee", label: "Comment"  },
  member_joined:           { icon: UserPlus,      color: "#34d399", label: "Joined"   },
  member_left:             { icon: UserMinus,     color: "#64748b", label: "Left"     },
  role_changed:            { icon: RefreshCw,     color: "#a78bfa", label: "Role"     },
};
const getTypeCfg = t => TYPE_CFG[t] || { icon: FileText, color: "#64748b", label: "Action" };

const FILTERS = [
  { key: "all",      label: "All",      icon: Activity     },
  { key: "prompts",  label: "Prompts",  icon: FileText     },
  { key: "ratings",  label: "Ratings",  icon: Star         },
  { key: "comments", label: "Comments", icon: MessageSquare},
  { key: "members",  label: "Members",  icon: Users        },
];
const TIME_OPTS = [
  { value: "today", label: "Today"      },
  { value: "week",  label: "This week"  },
  { value: "month", label: "This month" },
  { value: "all",   label: "All time"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function relTime(ts) {
  if (!ts) return "—";
  try {
    const diff = Date.now() - ts.toDate();
    const m = Math.floor(diff / 6e4), h = Math.floor(diff / 36e5), d = Math.floor(diff / 864e5);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d <  7) return `${d}d ago`;
    return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return "—"; }
}

// ── MiniAvatar ────────────────────────────────────────────────────────────────
function MiniAvatar({ profile, isGuest, size = 28 }) {
  const [err, setErr] = useState(false);
  const px = size + "px";
  const base = {
    width: px, height: px, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  if (isGuest) return (
    <div style={{ ...base, background: "rgba(139,92,246,.14)", border: "1px solid rgba(139,92,246,.22)",
      fontSize: "9px", fontWeight: 800, color: "#a78bfa", letterSpacing: ".03em" }}>G</div>
  );
  if (!profile?.avatar || err) {
    const i = profile?.name
      ? profile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : profile?.email ? profile.email[0].toUpperCase() : "?";
    return (
      <div style={{ ...base, background: "linear-gradient(135deg,rgba(139,92,246,.45),rgba(99,102,241,.2))",
        border: "1px solid rgba(139,92,246,.18)", fontSize: "10px", fontWeight: 700, color: "#c4b5fd" }}>{i}</div>
    );
  }
  return <img src={profile.avatar} alt="" onError={() => setErr(true)}
    style={{ ...base, objectFit: "cover", border: "1px solid rgba(139,92,246,.14)" }} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ActivityFeed({ teamId }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [profiles,   setProfiles]   = useState({});
  const [filter,     setFilter]     = useState("all");
  const [timeFilter, setTimeFilter] = useState("week");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const q = query(collection(db, "teams", teamId, "activities"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(q, async snap => {
      let items = [];

      if (snap.empty) {
        // ── Synthetic activities from prompt sub-docs ──
        const pq = query(collection(db, "teams", teamId, "prompts"), orderBy("createdAt", "desc"), limit(50));
        const ps = await new Promise((res, rej) => onSnapshot(pq, res, rej));
        const promptData = ps.docs.map(d => ({ id: d.id, ...d.data() }));
        const promptIds  = promptData.map(p => p.id);

        // Collect uids for profile loading
        const uids = new Set(promptData.map(p => p.createdBy).filter(Boolean));

        // Build created/updated items from prompt top-level docs
        promptData.forEach(p => {
          items.push({
            id: `created-${p.id}`, type: "prompt_created", userId: p.createdBy,
            promptId: p.id, promptTitle: p.title, timestamp: p.createdAt,
            metadata: { tags: p.tags || [] },
          });
          if (p.updatedAt && p.updatedAt !== p.createdAt)
            items.push({
              id: `updated-${p.id}`, type: "prompt_updated", userId: p.createdBy,
              promptId: p.id, promptTitle: p.title, timestamp: p.updatedAt,
              metadata: { tags: p.tags || [] },
            });
        });

        // ✅ PERF: fetch ALL comments and ratings for ALL prompts in parallel
        //    Old: sequential for...of (N serial getDocs for comments + N for ratings = 2N round-trips)
        //    New: 2 Promise.all fan-outs → all fetches run concurrently
        const [allCommentSnaps, allRatingSnaps] = await Promise.all([
          Promise.all(
            promptIds.map(id =>
              getDocs(query(
                collection(db, "teams", teamId, "prompts", id, "comments"),
                orderBy("createdAt", "desc"),
                limit(10),
              )).then(snap => ({ id, snap })).catch(() => ({ id, snap: null }))
            )
          ),
          Promise.all(
            promptIds.map(id =>
              getDocs(collection(db, "teams", teamId, "prompts", id, "ratings"))
                .then(snap => ({ id, snap })).catch(() => ({ id, snap: null }))
            )
          ),
        ]);

        // Process comments
        allCommentSnaps.forEach(({ id: promptId, snap: cs }) => {
          if (!cs) return;
          const prompt = promptData.find(p => p.id === promptId);
          cs.docs.forEach(cd => {
            const c = cd.data();
            items.push({
              id: `comment-${promptId}-${cd.id}`, type: "comment_added",
              userId: c.userId || null, isGuest: c.isGuest || false, guestToken: c.guestToken || null,
              promptId, promptTitle: prompt?.title, timestamp: c.createdAt,
              metadata: { commentText: c.text?.substring(0, 50) || "", userName: c.userName || "Guest" },
            });
          });
        });

        // Process ratings
        allRatingSnaps.forEach(({ id: promptId, snap: rs }) => {
          if (!rs) return;
          const prompt = promptData.find(p => p.id === promptId);
          rs.docs.forEach(rd => {
            const r = rd.data();
            if (r.createdAt)
              items.push({
                id: `rating-${promptId}-${rd.id}`, type: "prompt_rated_individual",
                userId: r.userId || null, isGuest: r.isGuest || false, guestToken: r.guestToken || null,
                promptId, promptTitle: prompt?.title, timestamp: r.createdAt,
                metadata: { rating: r.rating, userName: r.isGuest ? "Guest" : null },
              });
          });
        });

        // ✅ PERF: batch load profiles instead of sequential getDoc loop
        const prof = await batchGetUserProfiles([...uids]);
        setProfiles(prof);

      } else {
        items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // ✅ PERF: batch load all referenced user profiles in one shot
        const uids = [...new Set(items.map(a => a.userId).filter(Boolean))];
        const prof = await batchGetUserProfiles(uids);
        setProfiles(prof);
      }

      items.sort((a, b) => getTimestampMillis(b.timestamp) - getTimestampMillis(a.timestamp));
      setActivities(items);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [teamId]);

  const filtered = activities.filter(a => {
    const ok = (() => {
      switch (filter) {
        case "prompts":  return ["prompt_created","prompt_updated","prompt_deleted"].includes(a.type);
        case "ratings":  return a.type === "prompt_rated" || a.type === "prompt_rated_individual";
        case "comments": return a.type === "comment_added";
        case "members":  return ["member_joined","member_left","role_changed"].includes(a.type);
        default: return true;
      }
    })();
    if (!ok) return false;
    if (timeFilter === "all" || !a.timestamp) return true;
    const diff = Date.now() - a.timestamp.toDate();
    if (timeFilter === "today") return diff < 864e5;
    if (timeFilter === "week")  return diff < 7 * 864e5;
    if (timeFilter === "month") return diff < 30 * 864e5;
    return true;
  });

  const actorName = a => {
    if (a.isGuest) return a.metadata?.userName || "Guest";
    const p = profiles[a.userId];
    return p?.name || p?.email || "Unknown";
  };

  function exportCSV() {
    const rows = filtered.map(a => ({
      Time: relTime(a.timestamp), Type: a.type,
      User: a.isGuest ? "Guest" : (profiles[a.userId]?.name || profiles[a.userId]?.email || "Unknown"),
      Prompt: a.promptTitle || a.metadata?.memberName || "—",
    }));
    const csv = [Object.keys(rows[0] || {}).join(","), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(","))].join("\n");
    const el = document.createElement("a");
    el.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    el.download = `activity-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
  }

  const stats = {
    created:  activities.filter(a => a.type === "prompt_created").length,
    updated:  activities.filter(a => a.type === "prompt_updated").length,
    ratings:  activities.filter(a => a.type.startsWith("prompt_rated")).length,
    comments: activities.filter(a => a.type === "comment_added").length,
    guests:   activities.filter(a => a.isGuest).length,
    unique:   new Set(activities.map(a => a.userId || a.guestToken).filter(Boolean)).size,
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"4rem", gap:".75rem" }}>
      <style>{`@keyframes afSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:18,height:18,borderRadius:"50%",border:"2px solid rgba(139,92,246,.15)",borderTopColor:"#8b5cf6",animation:"afSpin .75s linear infinite" }} />
      <span style={{ fontSize:".82rem", color:"var(--muted-foreground)" }}>Loading activity…</span>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes afSpin    { to { transform:rotate(360deg) } }
        @keyframes afSlideUp { from { opacity:0;transform:translateY(7px) } to { opacity:1;transform:none } }
        @keyframes afPulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes afDrop    { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }

        .af-wrap { display:flex; flex-direction:column; gap:.875rem; }

        .af-bar {
          display:flex; align-items:center; justify-content:space-between; gap:.75rem; flex-wrap:wrap;
          padding:.625rem .875rem; background:var(--card);
          border:1px solid rgba(255,255,255,.05); border-radius:12px;
        }
        .af-bar-l { display:flex; align-items:center; gap:.5rem; flex:1; min-width:0; flex-wrap:wrap; }

        .af-pill-row-desktop { display:flex; gap:.2rem; }
        @media(max-width:560px){ .af-pill-row-desktop { display:none; } }

        .af-filter-mobile { display:none; position:relative; }
        @media(max-width:560px){ .af-filter-mobile { display:block; } }
        .af-mobile-trigger {
          display:flex; align-items:center; gap:.4rem;
          padding:.3rem .65rem; border-radius:7px; font-size:.72rem; font-weight:600;
          border:1px solid rgba(139,92,246,.2); background:rgba(139,92,246,.1);
          color:#c4b5fd; cursor:pointer;
        }
        .af-mobile-dropdown {
          position:absolute; top:calc(100% + 5px); left:0; z-index:50;
          background:var(--card); border:1px solid rgba(255,255,255,.08);
          border-radius:9px; padding:.3rem; min-width:140px;
          box-shadow:0 8px 24px rgba(0,0,0,.4);
          animation:afDrop .14s ease-out;
        }
        .af-mobile-opt {
          display:flex; align-items:center; gap:.4rem;
          padding:.4rem .65rem; border-radius:6px; font-size:.75rem; font-weight:600;
          background:transparent; border:none; color:var(--muted-foreground);
          cursor:pointer; width:100%; transition:all .12s;
        }
        .af-mobile-opt:hover { background:rgba(255,255,255,.04); color:var(--foreground); }
        .af-mobile-opt.on { background:rgba(139,92,246,.1); color:#c4b5fd; }

        .af-pill {
          display:flex; align-items:center; gap:.3rem; padding:.28rem .6rem; border-radius:6px;
          font-size:.7rem; font-weight:600; border:1px solid transparent; background:transparent;
          color:var(--muted-foreground); cursor:pointer; transition:all .13s; white-space:nowrap;
        }
        .af-pill:hover { background:rgba(255,255,255,.04); color:var(--foreground); }
        .af-pill.on { background:rgba(139,92,246,.11); border-color:rgba(139,92,246,.2); color:#c4b5fd; }

        .af-time {
          padding:.26rem .6rem; border-radius:6px; font-size:.7rem; font-weight:600;
          border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.02);
          color:var(--foreground); cursor:pointer; outline:none;
        }
        .af-time:focus { border-color:rgba(139,92,246,.3); }

        .af-export {
          display:flex; align-items:center; gap:.35rem; padding:.28rem .7rem; border-radius:6px;
          font-size:.7rem; font-weight:600; border:1px solid rgba(255,255,255,.07); background:transparent;
          color:var(--muted-foreground); cursor:pointer; transition:all .13s; white-space:nowrap;
        }
        .af-export:hover { border-color:rgba(139,92,246,.22); color:var(--foreground); }

        .af-stats {
          display:grid;
          grid-template-columns:repeat(6,1fr);
          gap:.5rem;
        }
        @media(max-width:700px){ .af-stats { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:400px){ .af-stats { grid-template-columns:repeat(2,1fr); } }

        .af-stat {
          position:relative; overflow:hidden; padding:.7rem .5rem; border-radius:10px; text-align:center;
          background:var(--card); border:1px solid rgba(255,255,255,.05);
          transition:border-color .14s,transform .14s;
          animation:afSlideUp .28s ease-out backwards;
        }
        .af-stat::after {
          content:''; position:absolute; inset:0; pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent,transparent 11px,rgba(255,255,255,.011) 11px,rgba(255,255,255,.011) 12px);
        }
        .af-stat:hover { border-color:rgba(139,92,246,.16); transform:translateY(-1px); }
        .af-stat-n { font-size:1.3rem; font-weight:800; letter-spacing:-.04em; font-variant-numeric:tabular-nums; line-height:1; margin-bottom:.22rem; }
        .af-stat-l { font-size:.59rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted-foreground); }

        .af-panel { background:var(--card); border:1px solid rgba(255,255,255,.05); border-radius:12px; overflow:hidden; }
        .af-ph {
          display:flex; align-items:center; justify-content:space-between;
          padding:.55rem .875rem; border-bottom:1px solid rgba(255,255,255,.04); flex-wrap:wrap; gap:.5rem;
        }
        .af-ph-title { display:flex; align-items:center; gap:.45rem; font-size:.74rem; font-weight:700; color:var(--foreground); }
        .af-live { width:6px; height:6px; border-radius:50%; background:#34d399; animation:afPulse 2s ease infinite; }
        .af-cnt {
          font-size:.61rem; font-weight:700; padding:.09rem .38rem; border-radius:4px;
          background:rgba(139,92,246,.11); color:#c4b5fd; font-variant-numeric:tabular-nums;
        }
        .af-fn { font-size:.66rem; color:var(--muted-foreground); }

        .af-list-wrap {
          max-height: 520px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(139,92,246,.2) transparent;
        }
        .af-list-wrap::-webkit-scrollbar { width: 4px; }
        .af-list-wrap::-webkit-scrollbar-thumb { background: rgba(139,92,246,.25); border-radius: 2px; }

        .af-list { display:flex; flex-direction:column; }

        .af-item {
          display:grid;
          grid-template-columns:24px 26px 1fr auto;
          align-items:flex-start; gap:.6rem;
          padding:.575rem .875rem;
          border-bottom:1px solid rgba(255,255,255,.025);
          transition:background .12s;
          animation:afSlideUp .23s ease-out backwards;
        }
        @media(max-width:480px){
          .af-item {
            grid-template-columns:24px 1fr auto;
            gap:.45rem;
          }
          .af-item > *:nth-child(2) { display:none; }
        }

        .af-item:last-child { border-bottom:none; }
        .af-item:hover { background:rgba(255,255,255,.014); }

        .af-ic {
          width:24px; height:24px; border-radius:6px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; margin-top:2px;
        }
        .af-body { min-width:0; }
        .af-row  { display:flex; align-items:center; gap:.35rem; flex-wrap:wrap; margin-bottom:.18rem; }
        .af-actor  { font-size:.79rem; font-weight:700; color:var(--foreground); white-space:nowrap; }
        .af-verb   { font-size:.79rem; color:var(--muted-foreground); }
        .af-target {
          font-size:.79rem; font-weight:600; color:var(--foreground);
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px;
        }
        @media(min-width:600px){ .af-target { max-width:220px; } }

        .af-gtag {
          font-size:.57rem; font-weight:700; padding:.08rem .33rem; border-radius:3px;
          background:rgba(139,92,246,.09); color:#a78bfa; border:1px solid rgba(139,92,246,.16);
        }
        .af-stars { display:inline-flex; align-items:center; gap:.18rem; font-size:.72rem; font-weight:700; color:#f59e0b; }
        .af-meta  { display:flex; align-items:center; gap:.32rem; flex-wrap:wrap; font-size:.65rem; color:var(--muted-foreground); }
        .af-sep   { width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,.18); flex-shrink:0; }
        .af-tag   { font-size:.59rem; padding:.07rem .32rem; border-radius:3px; background:rgba(255,255,255,.05); }
        .af-snip  { font-size:.65rem; font-style:italic; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px; }
        @media(min-width:500px){ .af-snip { max-width:180px; } }

        .af-badge {
          font-size:.57rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase;
          padding:.12rem .45rem; border-radius:4px; white-space:nowrap; align-self:flex-start; margin-top:3px;
        }
        @media(max-width:380px){ .af-badge { display:none; } }

        .af-empty { display:flex; flex-direction:column; align-items:center; padding:3.5rem 1rem; gap:.6rem; }
        .af-empty-ring {
          width:46px; height:46px; border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(139,92,246,.06); border:1px solid rgba(139,92,246,.1); margin-bottom:.2rem;
        }
        .af-empty-t { font-size:.875rem; font-weight:700; color:var(--foreground); }
        .af-empty-s { font-size:.75rem; color:var(--muted-foreground); text-align:center; max-width:240px; line-height:1.55; }

        .af-more { padding:.875rem; text-align:center; border-top:1px solid rgba(255,255,255,.04); }
        .af-more-btn {
          font-size:.72rem; font-weight:600; padding:.38rem .875rem; border-radius:7px;
          border:1px solid rgba(255,255,255,.07); background:transparent;
          color:var(--muted-foreground); cursor:pointer; transition:all .13s;
        }
        .af-more-btn:hover { color:var(--foreground); border-color:rgba(255,255,255,.16); }
      `}</style>

      <div className="af-wrap">

        {/* Filter bar */}
        <div className="af-bar">
          <div className="af-bar-l">
            <div className="af-pill-row-desktop">
              {FILTERS.map(f => (
                <button key={f.key} className={`af-pill${filter === f.key ? " on" : ""}`}
                  onClick={() => setFilter(f.key)}>
                  <f.icon size={10} />{f.label}
                </button>
              ))}
            </div>

            <div className="af-filter-mobile">
              <button className="af-mobile-trigger" onClick={() => setFilterOpen(v => !v)}>
                {(() => { const F = FILTERS.find(f => f.key === filter); return <><F.icon size={11} />{F.label}<ChevronDown size={11} /></>; })()}
              </button>
              {filterOpen && (
                <div className="af-mobile-dropdown">
                  {FILTERS.map(f => (
                    <button key={f.key} className={`af-mobile-opt${filter === f.key ? " on" : ""}`}
                      onClick={() => { setFilter(f.key); setFilterOpen(false); }}>
                      <f.icon size={12} />{f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="af-time">
              {TIME_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="af-export">
              <Download size={11} /><span className="hidden-xs">Export</span> CSV
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="af-stats">
          {[
            { n: stats.created,  l: "Created",    c: "#8b5cf6", d: ".04s" },
            { n: stats.updated,  l: "Updated",    c: "#a78bfa", d: ".09s" },
            { n: stats.ratings,  l: "Ratings",    c: "#f59e0b", d: ".14s" },
            { n: stats.comments, l: "Comments",   c: "#22d3ee", d: ".19s" },
            { n: stats.guests,   l: "Guest Acts", c: "#34d399", d: ".24s" },
            { n: stats.unique,   l: "Unique",     c: "#c084fc", d: ".29s" },
          ].map(s => (
            <div key={s.l} className="af-stat" style={{ animationDelay: s.d }}>
              <div className="af-stat-n" style={{ color: s.c }}>{s.n}</div>
              <div className="af-stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Feed panel */}
        <div className="af-panel">
          <div className="af-ph">
            <div className="af-ph-title">
              <div className="af-live" />
              Activity Feed
              <span className="af-cnt">{filtered.length}</span>
            </div>
            {filtered.length !== activities.length && (
              <span className="af-fn">filtered from {activities.length} total</span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="af-empty">
              <div className="af-empty-ring"><Activity size={22} color="rgba(139,92,246,.4)" /></div>
              <div className="af-empty-t">No activity</div>
              <div className="af-empty-s">
                {filter === "all"
                  ? "Team activity will appear here as members create and interact with prompts."
                  : `No ${filter} activity in the selected time range.`}
              </div>
            </div>
          ) : (
            <div className="af-list-wrap">
              <div className="af-list">
                {filtered.slice(0, 50).map((a, i) => {
                  const cfg = getTypeCfg(a.type);
                  const Icon = cfg.icon;
                  return (
                    <div key={`${a.id}-${i}`} className="af-item"
                      style={{ animationDelay: `${Math.min(i * .025, .45)}s` }}>

                      <div className="af-ic"
                        style={{ background: `${cfg.color}11`, border: `1px solid ${cfg.color}1e` }}>
                        <Icon size={12} color={cfg.color} />
                      </div>

                      <MiniAvatar profile={profiles[a.userId]} isGuest={a.isGuest} size={26} />

                      <div className="af-body">
                        <div className="af-row">
                          <span className="af-actor">{actorName(a)}</span>
                          <span className="af-verb">
                            {a.type === "prompt_created" ? "created" :
                             a.type === "prompt_updated" ? "updated" :
                             a.type === "prompt_deleted" ? "deleted" :
                             a.type.startsWith("prompt_rated") ? "rated" :
                             a.type === "comment_added" ? "commented on" :
                             a.type === "member_joined" ? "joined" :
                             a.type === "member_left"   ? "left" : "acted on"}
                          </span>
                          {a.promptTitle && <span className="af-target">"{a.promptTitle}"</span>}
                          {a.type.startsWith("prompt_rated") && a.metadata?.rating != null && (
                            <span className="af-stars">
                              <Star size={9} fill="#f59e0b" strokeWidth={0} />
                              {typeof a.metadata.rating === "number" ? a.metadata.rating.toFixed(1) : a.metadata.rating}
                            </span>
                          )}
                          {a.isGuest && <span className="af-gtag">Guest</span>}
                        </div>
                        <div className="af-meta">
                          <span style={{ fontVariantNumeric:"tabular-nums" }}>{relTime(a.timestamp)}</span>
                          {a.metadata?.tags?.length > 0 && <>
                            <span className="af-sep" />
                            {a.metadata.tags.slice(0, 2).map(t => <span key={t} className="af-tag">#{t}</span>)}
                            {a.metadata.tags.length > 2 && <span>+{a.metadata.tags.length - 2}</span>}
                          </>}
                          {a.metadata?.commentText && <>
                            <span className="af-sep" />
                            <span className="af-snip">"{a.metadata.commentText}…"</span>
                          </>}
                        </div>
                      </div>

                      <span className="af-badge"
                        style={{ background:`${cfg.color}10`, color:cfg.color, border:`1px solid ${cfg.color}1c` }}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}

                {filtered.length > 50 && (
                  <div className="af-more">
                    <button className="af-more-btn">{filtered.length - 50} more items</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
