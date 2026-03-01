// src/components/PromptAnalytics.jsx - RESPONSIVE + PERF: parallel subcollection reads
import { useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  updateDoc,
  getDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { getGuestToken, getGuestUserId, debugGuestToken } from "../lib/guestToken";
import { hasGuestAccess } from "../lib/guestTeamAccess";
import {
  Star, BarChart3, FileText, Copy, MessageSquare,
  TrendingUp, Award, Users, Eye, Activity, UserCheck,
  UserX, TrendingDown, Clock, Zap, AlertCircle
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveGuestToken() {
  const fromGuestToken = getGuestToken();
  if (fromGuestToken) return fromGuestToken;
  const access = hasGuestAccess();
  if (access?.token) {
    try { sessionStorage.setItem("guest_team_token", access.token); } catch (_) {}
    return access.token;
  }
  return null;
}

function resolveGuestUserId() {
  const token = resolveGuestToken();
  return token ? `guest_${token}` : null;
}

// ✅ PERF: fetch all ratings for all prompts in parallel
async function fetchAllSubcollections(teamId, promptIds, subcol) {
  const results = await Promise.all(
    promptIds.map(id => getDocs(collection(db, "teams", teamId, "prompts", id, subcol)))
  );
  // returns Map<promptId, docs[]>
  return Object.fromEntries(promptIds.map((id, i) => [id, results[i].docs]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePromptRating(teamId, promptId) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [userRating, setUserRating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !promptId) {
      setRatings([]); setUserRating(null); setLoading(false); return;
    }
    // Only debug guest token when user is NOT signed in (i.e. actually a guest)
    if (!user) debugGuestToken();
    try {
      const ratingsRef = collection(db, "teams", teamId, "prompts", promptId, "ratings");
      const unsub = onSnapshot(ratingsRef, (snap) => {
        const ratingsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRatings(ratingsData);
        const guestToken  = resolveGuestToken();
        const guestUserId = resolveGuestUserId();
        const userId      = user?.uid || guestUserId;
        const found = ratingsData.find(
          (r) => r.userId === userId || (guestToken && r.guestToken === guestToken)
        );
        setUserRating(found?.rating ?? null);
        setLoading(false);
      }, (error) => {
        console.error("❌ [RATING] Error loading ratings:", error);
        setRatings([]); setUserRating(null); setLoading(false);
      });
      return () => unsub();
    } catch (error) {
      console.error("❌ [RATING] Error setting up listener:", error);
      setLoading(false);
    }
  }, [teamId, promptId, user?.uid]);

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
  }, [ratings]);

  async function ratePrompt(rating) {
    if (!teamId || !promptId || rating < 1 || rating > 5) return;
    const isGuest     = !user;
    const guestToken  = isGuest ? resolveGuestToken() : null;
    const guestUserId = isGuest ? resolveGuestUserId() : null;

    if (isGuest && !guestToken) {
      throw new Error("Your guest session could not be verified. Please refresh the page and try again.");
    }
    const userId = user?.uid || guestUserId;
    if (!userId) throw new Error("Could not determine user ID — please refresh and try again.");

    try {
      const ratingRef  = doc(db, "teams", teamId, "prompts", promptId, "ratings", userId);
      const ratingData = { userId, rating, createdAt: serverTimestamp() };
      if (isGuest) { ratingData.isGuest = true; ratingData.guestToken = guestToken; }
      await setDoc(ratingRef, ratingData);
      const promptRef  = doc(db, "teams", teamId, "prompts", promptId);
      const promptSnap = await getDoc(promptRef);
      if (promptSnap.exists()) {
        const currentStats   = promptSnap.data().stats || {};
        const currentRatings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...(currentStats.ratings || {}) };
        if (userRating) currentRatings[userRating] = Math.max(0, (currentRatings[userRating] || 0) - 1);
        currentRatings[rating] = (currentRatings[rating] || 0) + 1;
        const totalRatings = Object.values(currentRatings).reduce((s, c) => s + c, 0);
        const weightedSum  = Object.entries(currentRatings).reduce((s, [star, count]) => s + parseInt(star) * count, 0);
        const newAverage   = totalRatings > 0 ? weightedSum / totalRatings : 0;
        await updateDoc(promptRef, {
          "stats.ratings": currentRatings, "stats.totalRatings": totalRatings,
          "stats.averageRating": newAverage, "stats.lastRated": serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("❌ [RATING] Error:", error.message, error.code);
      throw error;
    }
  }

  async function removeRating() {
    if (!teamId || !promptId || !userRating) return;
    const guestUserId = resolveGuestUserId();
    const userId      = user?.uid || guestUserId;
    if (!userId) return;
    try {
      await deleteDoc(doc(db, "teams", teamId, "prompts", promptId, "ratings", userId));
      const promptRef  = doc(db, "teams", teamId, "prompts", promptId);
      const promptSnap = await getDoc(promptRef);
      if (promptSnap.exists()) {
        const currentStats   = promptSnap.data().stats || {};
        const currentRatings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...(currentStats.ratings || {}) };
        currentRatings[userRating] = Math.max(0, (currentRatings[userRating] || 0) - 1);
        const totalRatings = Object.values(currentRatings).reduce((s, c) => s + c, 0);
        const weightedSum  = Object.entries(currentRatings).reduce((s, [star, count]) => s + parseInt(star) * count, 0);
        const newAverage   = totalRatings > 0 ? weightedSum / totalRatings : 0;
        await updateDoc(promptRef, {
          "stats.ratings": currentRatings, "stats.totalRatings": totalRatings, "stats.averageRating": newAverage,
        });
      }
    } catch (error) {
      console.error("Error removing rating:", error); throw error;
    }
  }

  return { ratings, userRating, averageRating, totalRatings: ratings.length, loading, ratePrompt, removeRating };
}

// ─────────────────────────────────────────────────────────────────────────────
// StarRating component
// ─────────────────────────────────────────────────────────────────────────────

export function StarRating({ rating = 0, onRate, readonly = false, size = "normal", className = "" }) {
  const [hoverRating, setHoverRating] = useState(0);
  const starSize = size === "small" ? 14 : size === "large" ? 24 : 20;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star} type="button" disabled={readonly}
          className={`transition-all duration-150 ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
          onClick={() => !readonly && onRate && onRate(star)}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
        >
          <Star
            size={starSize}
            fill={star <= (hoverRating || rating) ? "#f59e0b" : "none"}
            color={star <= (hoverRating || rating) ? "#f59e0b" : "#4b5563"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ icon, value, label, accent = false }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: accent ? "var(--primary)" : "var(--secondary)" }}
    >
      <span style={{ color: accent ? "var(--primary-foreground)" : "var(--primary)" }}>{icon}</span>
      <div>
        <div className="text-xs font-bold leading-none" style={{ color: accent ? "var(--primary-foreground)" : "var(--foreground)" }}>{value}</div>
        <div className="text-[10px] leading-tight mt-0.5" style={{ color: accent ? "rgba(255,255,255,0.7)" : "var(--muted-foreground)" }}>{label}</div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, badge }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span style={{ color: "var(--primary)" }}>{icon}</span>
      <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--foreground)" }}>{title}</span>
      {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>{badge}</span>}
    </div>
  );
}

function MiniBar({ pct, color }) {
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="neo-spinner" style={{ width: 18, height: 18 }} />
      <span className="text-xs ml-2" style={{ color: "var(--muted-foreground)" }}>Loading…</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GuestAnalyticsCard
// ✅ PERF: fetch ratings + comments for all prompts in parallel (not sequentially)
// ─────────────────────────────────────────────────────────────────────────────

function GuestAnalyticsCard({ teamId }) {
  const [guestStats, setGuestStats] = useState({ guestRatings: 0, guestComments: 0, guestCopies: 0, loading: true });

  useEffect(() => {
    if (!teamId) { setGuestStats(p => ({ ...p, loading: false })); return; }
    const unsub = onSnapshot(collection(db, 'teams', teamId, 'prompts'), async (snap) => {
      try {
        const promptDocs = snap.docs;
        const promptIds  = promptDocs.map(d => d.id);

        // ✅ PERF: fetch all ratings + comments in parallel (2 batch calls vs 2N sequential)
        const [allRatings, allComments] = await Promise.all([
          fetchAllSubcollections(teamId, promptIds, 'ratings'),
          fetchAllSubcollections(teamId, promptIds, 'comments'),
        ]);

        let guestCopies = 0, guestRatings = 0, guestComments = 0;
        promptDocs.forEach(d => {
          guestCopies   += d.data().stats?.guestCopies || 0;
          guestRatings  += (allRatings[d.id]  || []).filter(r => r.data().isGuest).length;
          guestComments += (allComments[d.id] || []).filter(r => r.data().isGuest).length;
        });

        setGuestStats({ guestRatings, guestComments, guestCopies, loading: false });
      } catch { setGuestStats(p => ({ ...p, loading: false })); }
    }, () => setGuestStats(p => ({ ...p, loading: false })));
    return () => unsub();
  }, [teamId]);

  return (
    <div className="glass-card p-4">
      <SectionHeader icon={<Eye size={14} />} title="Guest Activity" />
      {guestStats.loading ? <LoadingCard /> : (
        <div className="space-y-2">
          {[
            { icon: <Star size={12} />, value: guestStats.guestRatings,  label: "Ratings"  },
            { icon: <MessageSquare size={12} />, value: guestStats.guestComments, label: "Comments" },
            { icon: <Copy size={12} />, value: guestStats.guestCopies,   label: "Copies"   },
          ].map(({ icon, value, label }) => (
            <div key={label} className="flex items-center justify-between px-2.5 py-1.5 rounded" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                {icon}
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{value}</span>
            </div>
          ))}
          <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] text-center" style={{ color: "var(--muted-foreground)" }}>
              {guestStats.guestRatings + guestStats.guestComments + guestStats.guestCopies} total interactions
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthenticatedUserAnalyticsCard
// ✅ PERF: was sequential for...of, now parallel Promise.all
// ─────────────────────────────────────────────────────────────────────────────

function AuthenticatedUserAnalyticsCard({ teamId }) {
  const [authStats, setAuthStats] = useState({ authRatings: 0, authComments: 0, authCopies: 0, authViews: 0, loading: true });

  useEffect(() => {
    if (!teamId) { setAuthStats(p => ({ ...p, loading: false })); return; }
    const unsub = onSnapshot(collection(db, 'teams', teamId, 'prompts'), async (snap) => {
      try {
        const promptDocs = snap.docs;
        const promptIds  = promptDocs.map(d => d.id);

        // ✅ PERF: all subcollection reads run in parallel
        const [allRatings, allComments] = await Promise.all([
          fetchAllSubcollections(teamId, promptIds, 'ratings'),
          fetchAllSubcollections(teamId, promptIds, 'comments'),
        ]);

        let totalR = 0, totalC = 0, totalCp = 0, totalV = 0;
        promptDocs.forEach(d => {
          const data = d.data();
          totalR  += (allRatings[d.id]  || []).filter(r => !r.data().isGuest).length;
          totalC  += (allComments[d.id] || []).filter(r => !r.data().isGuest).length;
          totalCp += (data.stats?.copies || 0) - (data.stats?.guestCopies || 0);
          totalV  += data.stats?.views || 0;
        });

        setAuthStats({ authRatings: totalR, authComments: totalC, authCopies: totalCp, authViews: totalV, loading: false });
      } catch { setAuthStats(p => ({ ...p, loading: false })); }
    });
    return () => unsub();
  }, [teamId]);

  return (
    <div className="glass-card p-4">
      <SectionHeader icon={<UserCheck size={14} />} title="Member Activity" />
      {authStats.loading ? <LoadingCard /> : (
        <div className="space-y-2">
          {[
            { icon: <Star size={12} />,         value: authStats.authRatings,  label: "Ratings"  },
            { icon: <MessageSquare size={12} />, value: authStats.authComments, label: "Comments" },
            { icon: <Copy size={12} />,          value: authStats.authCopies,   label: "Copies"   },
            { icon: <Eye size={12} />,           value: authStats.authViews,    label: "Views"    },
          ].map(({ icon, value, label }) => (
            <div key={label} className="flex items-center justify-between px-2.5 py-1.5 rounded" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                {icon}
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{value}</span>
            </div>
          ))}
          <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] text-center" style={{ color: "var(--muted-foreground)" }}>
              {authStats.authRatings + authStats.authComments + authStats.authCopies} total interactions
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamAnalytics — Full Responsive Layout
// ✅ PERF: was sequential for...of per prompt, now parallel Promise.all
// ─────────────────────────────────────────────────────────────────────────────

export function TeamAnalytics({ teamId }) {
  const [analytics, setAnalytics] = useState({
    totalPrompts: 0, totalViews: 0, totalCopies: 0,
    totalComments: 0, totalRatings: 0, averageRating: 0,
    topPrompts: [],
  });
  const [loading, setLoading] = useState(true);
  const [userTypeStats, setUserTypeStats] = useState({
    authenticatedRatings: 0, guestRatings: 0,
    authenticatedComments: 0, guestComments: 0,
  });

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    const unsub = onSnapshot(collection(db, "teams", teamId, "prompts"), async (snap) => {
      try {
        const allPrompts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const promptIds  = allPrompts.map(p => p.id);

        // ✅ PERF: fetch ratings + comments for ALL prompts in 2 parallel batch calls
        //    Old: 2N sequential getDocs (e.g. 20 prompts = 40 serial round-trips)
        //    New: 2 parallel Promise.all calls (all fetches run concurrently)
        const [allRatings, allComments] = await Promise.all([
          fetchAllSubcollections(teamId, promptIds, 'ratings'),
          fetchAllSubcollections(teamId, promptIds, 'comments'),
        ]);

        // Aggregate totals using pre-fetched subcollection data
        const totals = allPrompts.reduce((acc, p) => {
          const s = p.stats || {};
          return {
            totalPrompts:  acc.totalPrompts + 1,
            totalViews:    acc.totalViews   + (s.views         || 0),
            totalCopies:   acc.totalCopies  + (s.copies        || 0),
            totalComments: acc.totalComments + (s.comments     || 0),
            totalRatings:  acc.totalRatings + (s.totalRatings  || 0),
            ratingSum:     acc.ratingSum    + ((s.averageRating || 0) * (s.totalRatings || 0)),
          };
        }, { totalPrompts: 0, totalViews: 0, totalCopies: 0, totalComments: 0, totalRatings: 0, ratingSum: 0 });

        // Compute guest/auth split from already-fetched subcollection docs
        let authR = 0, guestR = 0, authC = 0, guestC = 0;
        allPrompts.forEach(p => {
          (allRatings[p.id]  || []).forEach(d => d.data().isGuest ? guestR++ : authR++);
          (allComments[p.id] || []).forEach(d => d.data().isGuest ? guestC++ : authC++);
        });
        setUserTypeStats({ authenticatedRatings: authR, guestRatings: guestR, authenticatedComments: authC, guestComments: guestC });

        const topPrompts = allPrompts
          .filter(p => (p.stats?.averageRating || 0) > 0 && (p.stats?.totalRatings || 0) > 0)
          .sort((a, b) => ((b.stats?.averageRating || 0) * (b.stats?.totalRatings || 0)) - ((a.stats?.averageRating || 0) * (a.stats?.totalRatings || 0)))
          .slice(0, 10);

        setAnalytics({
          totalPrompts: totals.totalPrompts, totalViews: totals.totalViews, totalCopies: totals.totalCopies,
          totalComments: totals.totalComments, totalRatings: totals.totalRatings,
          averageRating: totals.totalRatings > 0 ? Math.round((totals.ratingSum / totals.totalRatings) * 10) / 10 : 0,
          topPrompts,
        });
        setLoading(false);
      } catch (e) { console.error("Analytics error:", e); setLoading(false); }
    }, (e) => { console.error("Analytics listener error:", e); setLoading(false); });
    return () => unsub();
  }, [teamId]);

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-3" />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading analytics…</p>
      </div>
    );
  }

  const engagementRate = analytics.totalPrompts > 0
    ? ((analytics.totalCopies + analytics.totalComments) / analytics.totalPrompts).toFixed(1)
    : "0.0";
  const qualityPct  = (analytics.averageRating / 5) * 100;
  const collabScore = analytics.totalPrompts > 0
    ? Math.min(100, ((analytics.totalComments + analytics.totalCopies) / analytics.totalPrompts) * 20)
    : 0;
  const totalGuestInteractions   = userTypeStats.guestRatings + userTypeStats.guestComments;
  const totalMemberInteractions  = userTypeStats.authenticatedRatings + userTypeStats.authenticatedComments;
  const totalInteractions        = totalGuestInteractions + totalMemberInteractions;

  return (
    <>
      <style>{`
        .pa-wrap {
  display: flex;
  flex-direction: column;
  gap: .75rem;
  margin-top: 0;   
}

        .pa-header {
          background:var(--card); border:1px solid rgba(255,255,255,.05);
          border-radius:10px; padding:.75rem 1rem;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.5rem;
        }

        .pa-kpi {
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:.5rem;
        }
        @media(max-width:500px){ .pa-kpi { grid-template-columns:repeat(2,1fr); } }

        .pa-main {
          display:grid;
          grid-template-columns:1fr 1fr 1fr;
          gap:.75rem;
          align-items:start;
        }
        @media(max-width:900px){
          .pa-main { grid-template-columns:1fr 1fr; }
          .pa-col-right { grid-column:span 2; }
        }
        @media(max-width:580px){
          .pa-main { grid-template-columns:1fr; }
          .pa-col-right { grid-column:span 1; }
        }

        .pa-col { display:flex; flex-direction:column; gap:.75rem; }

        @media(min-width:581px) and (max-width:900px){
          .pa-col-left, .pa-col-mid { display:contents; }
          .pa-activity-row {
            display:grid;
            grid-template-columns:1fr 1fr 1fr;
            gap:.75rem;
            grid-column:span 2;
          }
        }
        @media(max-width:580px){
          .pa-activity-row { display:flex; flex-direction:column; gap:.75rem; }
        }
        @media(min-width:901px){
          .pa-activity-row { display:contents; }
        }

        .pa-top-list {
          display:flex;
          flex-direction:column;
          gap:.375rem;
          max-height:420px;
          overflow-y:auto;
          scrollbar-width:thin;
          scrollbar-color:rgba(139,92,246,.2) transparent;
          padding-right:.125rem;
        }
        .pa-top-list::-webkit-scrollbar { width:3px; }
        .pa-top-list::-webkit-scrollbar-thumb { background:rgba(139,92,246,.3); border-radius:2px; }
      `}</style>

      <div className="pa-wrap">

        {/* ── Header bar ── */}
        <div className="pa-header">
          <div className="flex items-center gap-2">
            <div>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Live Team Analytics</span>
              <span className="text-xs ml-2 hidden sm:inline" style={{ color: "var(--muted-foreground)" }}>Performance insights &amp; usage statistics</span>
            </div>
          </div>
        </div>

        {/* ── Top KPI strip ── */}
        <div className="pa-kpi">
          {[
            { icon: <FileText size={14} />,     value: analytics.totalPrompts,  label: "Prompts" },
            { icon: <Copy size={14} />,          value: analytics.totalCopies,   label: "Copies"  },
            { icon: <MessageSquare size={14} />, value: analytics.totalComments, label: "Comments"},
            {
              icon: <Star size={14} />,
              value: analytics.averageRating > 0 ? analytics.averageRating.toFixed(1) : "—",
              label: "Avg Rating",
            },
          ].map(({ icon, value, label }) => (
            <div key={label} className="glass-card p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1" style={{ color: "var(--primary)" }}>
                {icon}
              </div>
              <div className="text-lg font-bold leading-none mb-0.5" style={{ color: "var(--foreground)" }}>{value}</div>
              <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="pa-main">

          {/* LEFT: activity cards + split */}
          <div className="pa-activity-row pa-col-left">
            <AuthenticatedUserAnalyticsCard teamId={teamId} />
            <GuestAnalyticsCard teamId={teamId} />

            {/* Interaction split */}
            <div className="glass-card p-4">
              <SectionHeader icon={<Users size={14} />} title="Interaction Split" />
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <UserCheck size={10} /> Members
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "var(--foreground)" }}>{totalMemberInteractions}</span>
                  </div>
                  <MiniBar pct={totalInteractions > 0 ? (totalMemberInteractions / totalInteractions) * 100 : 0} color="var(--primary)" />
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>★ {userTypeStats.authenticatedRatings}</span>
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>💬 {userTypeStats.authenticatedComments}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Eye size={10} /> Guests
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "var(--foreground)" }}>{totalGuestInteractions}</span>
                  </div>
                  <MiniBar pct={totalInteractions > 0 ? (totalGuestInteractions / totalInteractions) * 100 : 0} color="var(--accent)" />
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>★ {userTypeStats.guestRatings}</span>
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>💬 {userTypeStats.guestComments}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE: health + trends + ratings */}
          <div className="pa-col pa-col-mid">
            {/* Team Health */}
            <div className="glass-card p-4">
              <SectionHeader icon={<Activity size={14} />} title="Team Health" />
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Collaboration</span>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {analytics.totalComments > 0 ? "Active" : analytics.totalPrompts > 0 ? "Growing" : "Starting"}
                    </span>
                  </div>
                  <MiniBar pct={collabScore} color="var(--primary)" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Content Quality</span>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {analytics.averageRating >= 4 ? "Excellent" : analytics.averageRating >= 3 ? "Good" : analytics.averageRating > 0 ? "Improving" : "No ratings"}
                    </span>
                  </div>
                  <MiniBar pct={qualityPct} color="var(--accent)" />
                </div>
              </div>
            </div>

            {/* Usage Insights */}
            <div className="glass-card p-4">
              <SectionHeader icon={<TrendingUp size={14} />} title="Usage Trends" />
              <div className="space-y-2">
                {[
                  {
                    label: "Most Active Feature",
                    value: analytics.totalCopies > analytics.totalComments ? "Copying" : "Commenting",
                  },
                  { label: "Engagement Rate",  value: `${engagementRate} / prompt` },
                  {
                    label: "Quality Score",
                    value: analytics.averageRating > 0
                      ? `${((analytics.averageRating / 5) * 100).toFixed(0)}%`
                      : "No ratings",
                  },
                  { label: "Total Interactions", value: totalInteractions },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                    <span className="text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating Overview */}
            {analytics.totalRatings > 0 && (
              <div className="glass-card p-4">
                <SectionHeader icon={<Star size={14} />} title="Rating Overview" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
                    {analytics.averageRating.toFixed(1)}
                  </div>
                  <div>
                    <StarRating rating={Math.round(analytics.averageRating)} readonly size="small" />
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{analytics.totalRatings} ratings</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Top Prompts */}
          <div className="glass-card p-4 pa-col-right">
            <SectionHeader icon={<Award size={14} />} title="Top 10 Prompts" badge="by score" />

            {analytics.topPrompts.length === 0 ? (
              <div className="text-center py-8">
                <Award size={28} className="mx-auto mb-2 opacity-30" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No rated prompts yet</p>
              </div>
            ) : (
              <div className="pa-top-list">
                {analytics.topPrompts.map((prompt, index) => {
                  const score = ((prompt.stats?.averageRating || 0) * (prompt.stats?.totalRatings || 0)).toFixed(1);
                  const avgR  = (prompt.stats?.averageRating || 0);
                  const isTop = index < 3;
                  return (
                    <div
                      key={prompt.id}
                      className="flex items-center gap-2 p-2 rounded-lg transition-all hover:opacity-90"
                      style={{
                        backgroundColor: isTop ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--secondary)",
                        borderLeft: isTop ? `2px solid var(--primary)` : "2px solid transparent",
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          backgroundColor: isTop ? "var(--primary)" : "var(--muted)",
                          color: isTop ? "var(--primary-foreground)" : "var(--muted-foreground)",
                        }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate leading-tight" style={{ color: "var(--foreground)" }}>
                          {prompt.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <StarRating rating={Math.round(avgR)} readonly size="small" />
                          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                            {avgR.toFixed(1)} · {prompt.stats?.totalRatings || 0}r · {prompt.stats?.copies || 0}c
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold flex-shrink-0 text-right" style={{ color: "var(--primary)" }}>
                        {score}
                      </div>
                    </div>
                  );
                })}

                {analytics.topPrompts.length === 10 && (
                  <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t" style={{ borderColor: "var(--border)" }}>
                    <AlertCircle size={11} style={{ color: "var(--muted-foreground)" }} />
                    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      Score = Avg × Ratings. Showing top 10.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
