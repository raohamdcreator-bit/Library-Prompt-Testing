// src/components/PromptAnalytics.jsx
// FIX: usePromptRating.ratePrompt() now reads the token from BOTH
// guestTeamAccess (memory+sessionStorage) and guestToken as a fallback,
// and shows a friendly UI message instead of throwing when the token is
// absent in pure read-only guest-team mode.

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
// Primary token source — has in-memory fallback
import { getGuestToken, getGuestUserId, debugGuestToken } from "../lib/guestToken";
// Secondary / cross-module token source — also has in-memory fallback
import { hasGuestAccess } from "../lib/guestTeamAccess";
import {
  Star, BarChart3, FileText, Copy, MessageSquare,
  TrendingUp, Award, Users, Eye, Activity, UserCheck,
  UserX, TrendingDown, Clock, Zap, AlertCircle
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve guest token from every available source.
 * Priority:
 *   1. guestToken.getGuestToken()   (sessionStorage + memory in guestToken.js)
 *   2. hasGuestAccess().token       (sessionStorage + memory in guestTeamAccess.js)
 *
 * The two modules each maintain their OWN in-memory backup, so whichever one
 * was initialised first will still have the value even if sessionStorage was
 * cleared by Firebase's auth-state-changed event.
 */
function resolveGuestToken() {
  // 1. Try the dedicated guestToken module first
  const fromGuestToken = getGuestToken();
  if (fromGuestToken) return fromGuestToken;

  // 2. Fall back to guestTeamAccess (populated by setGuestAccess() on redirect)
  const access = hasGuestAccess();
  if (access?.token) {
    // Keep the two modules in sync so future reads succeed from either
    try {
      sessionStorage.setItem("guest_team_token", access.token);
    } catch (_) { /* ignore */ }
    return access.token;
  }

  return null;
}

/**
 * Build a stable guest user-ID without throwing.
 * Returns null when no token is available.
 */
function resolveGuestUserId() {
  const token = resolveGuestToken();
  return token ? `guest_${token}` : null;
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
      setRatings([]);
      setUserRating(null);
      setLoading(false);
      return;
    }

    console.log('⭐ [RATING] Setting up listener for:', { teamId, promptId });

    // Debug on mount — informational only, never blocks
    debugGuestToken();

    try {
      const ratingsRef = collection(db, "teams", teamId, "prompts", promptId, "ratings");

      const unsub = onSnapshot(
        ratingsRef,
        (snap) => {
          const ratingsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRatings(ratingsData);

          // Resolve identity from all available sources
          const guestToken  = resolveGuestToken();
          const guestUserId = resolveGuestUserId();
          const userId      = user?.uid || guestUserId;

          const found = ratingsData.find(
            (r) => r.userId === userId || (guestToken && r.guestToken === guestToken)
          );
          setUserRating(found?.rating ?? null);
          setLoading(false);
        },
        (error) => {
          console.error("❌ [RATING] Error loading ratings:", error);
          setRatings([]);
          setUserRating(null);
          setLoading(false);
        }
      );

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

  // ─────────────────────────────────────────────────────────────────────────
  // ratePrompt
  // ─────────────────────────────────────────────────────────────────────────
  async function ratePrompt(rating) {
    if (!teamId || !promptId || rating < 1 || rating > 5) {
      console.error('❌ [RATING] Invalid parameters:', { teamId, promptId, rating });
      return;
    }

    const isGuest  = !user;
    // FIX: use the unified resolver instead of getGuestToken() alone
    const guestToken  = isGuest ? resolveGuestToken() : null;
    const guestUserId = isGuest ? resolveGuestUserId() : null;

    // Debug info (informational — won't throw)
    const tokenDebug = debugGuestToken();
    console.log('⭐ [RATING] ratePrompt called:', {
      rating,
      isGuest,
      hasGuestToken: !!guestToken,
      tokenSource: guestToken
        ? (sessionStorage.getItem('guest_team_token') ? 'sessionStorage' : 'memory')
        : 'none',
    });

    // Guard: if guest has no token from ANY source, show a friendly message
    if (isGuest && !guestToken) {
      console.warn(
        '⚠️ [RATING] Guest token not available from any source.',
        'tokenDebug:', tokenDebug
      );
      throw new Error(
        "Your guest session could not be verified. Please refresh the page and try again."
      );
    }

    const userId = user?.uid || guestUserId;

    if (!userId) {
      console.error('❌ [RATING] Could not determine user ID');
      throw new Error("Could not determine user ID — please refresh and try again.");
    }

    try {
      const ratingRef = doc(
        db, "teams", teamId, "prompts", promptId, "ratings", userId
      );

      const ratingData = {
        userId,
        rating,
        createdAt: serverTimestamp(),
      };

      if (isGuest) {
        ratingData.isGuest    = true;
        ratingData.guestToken = guestToken;
      }

      console.log('⭐ [RATING] Writing rating document…');
      await setDoc(ratingRef, ratingData);
      console.log('✅ [RATING] Rating written');

      // Update aggregated stats on the prompt document
      const promptRef  = doc(db, "teams", teamId, "prompts", promptId);
      const promptSnap = await getDoc(promptRef);

      if (promptSnap.exists()) {
        const currentStats  = promptSnap.data().stats || {};
        const currentRatings = {
          1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
          ...(currentStats.ratings || {}),
        };

        if (userRating) {
          currentRatings[userRating] = Math.max(0, (currentRatings[userRating] || 0) - 1);
        }
        currentRatings[rating] = (currentRatings[rating] || 0) + 1;

        const totalRatings  = Object.values(currentRatings).reduce((s, c) => s + c, 0);
        const weightedSum   = Object.entries(currentRatings).reduce(
          (s, [star, count]) => s + parseInt(star) * count, 0
        );
        const newAverage    = totalRatings > 0 ? weightedSum / totalRatings : 0;

        await updateDoc(promptRef, {
          "stats.ratings":       currentRatings,
          "stats.totalRatings":  totalRatings,
          "stats.averageRating": newAverage,
          "stats.lastRated":     serverTimestamp(),
        });

        console.log('✅ [RATING] Prompt stats updated');
      }
    } catch (error) {
      console.error("❌ [RATING] Error:", error.message, error.code);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // removeRating
  // ─────────────────────────────────────────────────────────────────────────
  async function removeRating() {
    if (!teamId || !promptId || !userRating) return;

    const guestUserId = resolveGuestUserId();
    const userId      = user?.uid || guestUserId;
    if (!userId) return;

    try {
      const ratingRef = doc(
        db, "teams", teamId, "prompts", promptId, "ratings", userId
      );
      await deleteDoc(ratingRef);

      const promptRef  = doc(db, "teams", teamId, "prompts", promptId);
      const promptSnap = await getDoc(promptRef);

      if (promptSnap.exists()) {
        const currentStats   = promptSnap.data().stats || {};
        const currentRatings = {
          1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
          ...(currentStats.ratings || {}),
        };

        currentRatings[userRating] = Math.max(0, (currentRatings[userRating] || 0) - 1);

        const totalRatings = Object.values(currentRatings).reduce((s, c) => s + c, 0);
        const weightedSum  = Object.entries(currentRatings).reduce(
          (s, [star, count]) => s + parseInt(star) * count, 0
        );
        const newAverage   = totalRatings > 0 ? weightedSum / totalRatings : 0;

        await updateDoc(promptRef, {
          "stats.ratings":       currentRatings,
          "stats.totalRatings":  totalRatings,
          "stats.averageRating": newAverage,
        });
      }
    } catch (error) {
      console.error("Error removing rating:", error);
      throw error;
    }
  }

  return {
    ratings,
    userRating,
    averageRating,
    totalRatings: ratings.length,
    loading,
    ratePrompt,
    removeRating,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// StarRating component (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function StarRating({
  rating = 0,
  onRate,
  readonly = false,
  size = "normal",
  className = "",
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const starSize = size === "small" ? 16 : size === "large" ? 24 : 20;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`transition-all duration-150 ${
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          }`}
          onClick={() => !readonly && onRate && onRate(star)}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
        >
          <Star
            size={starSize}
            fill={star <= (hoverRating || rating) ? "#fbbf24" : "none"}
            color={star <= (hoverRating || rating) ? "#fbbf24" : "#6b7280"}
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GuestAnalyticsCard (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function GuestAnalyticsCard({ teamId }) {
  const [guestStats, setGuestStats] = useState({
    guestRatings: 0,
    guestComments: 0,
    guestCopies: 0,
    guestViews: 0,
    loading: true,
  });

  useEffect(() => {
    if (!teamId) {
      setGuestStats(prev => ({ ...prev, loading: false }));
      return;
    }

    const promptsRef = collection(db, 'teams', teamId, 'prompts');

    const unsub = onSnapshot(promptsRef, async (promptsSnap) => {
      try {
        const promptPromises = promptsSnap.docs.map(async (promptDoc) => {
          const promptData = promptDoc.data();
          const promptId   = promptDoc.id;

          const guestCopiesCount = promptData.stats?.guestCopies || 0;

          const ratingsRef   = collection(db, 'teams', teamId, 'prompts', promptId, 'ratings');
          const ratingsSnap  = await getDocs(ratingsRef);
          const guestRatingsCount = ratingsSnap.docs.filter(d => d.data().isGuest === true).length;

          const commentsRef  = collection(db, 'teams', teamId, 'prompts', promptId, 'comments');
          const commentsSnap = await getDocs(commentsRef);
          const guestCommentsCount = commentsSnap.docs.filter(d => d.data().isGuest === true).length;

          return { copies: guestCopiesCount, ratings: guestRatingsCount, comments: guestCommentsCount };
        });

        const results = await Promise.all(promptPromises);

        let totalGuestCopies = 0, totalGuestRatings = 0, totalGuestComments = 0;
        results.forEach(r => {
          totalGuestCopies   += r.copies;
          totalGuestRatings  += r.ratings;
          totalGuestComments += r.comments;
        });

        setGuestStats({
          guestRatings:  totalGuestRatings,
          guestComments: totalGuestComments,
          guestCopies:   totalGuestCopies,
          guestViews:    0,
          loading:       false,
        });
      } catch (error) {
        console.error('❌ [GUEST STATS] Error:', error);
        setGuestStats(prev => ({ ...prev, loading: false }));
      }
    }, (error) => {
      console.error('❌ [GUEST STATS] Snapshot error:', error);
      setGuestStats(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, [teamId]);

  if (guestStats.loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={20} color="var(--primary)" />
          <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
            Guest Activity
          </h4>
        </div>
        <div className="text-center py-8">
          <div className="neo-spinner mx-auto mb-2"></div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading guest analytics…</p>
        </div>
      </div>
    );
  }

  const hasGuestActivity = guestStats.guestRatings > 0 || guestStats.guestComments > 0 || guestStats.guestCopies > 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={20} color="var(--primary)" />
        <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
          Guest User Activity
        </h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
          Read-Only Users
        </span>
      </div>

      {!hasGuestActivity ? (
        <div className="text-center py-8">
          <UserX size={32} className="mx-auto mb-2 opacity-50" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No guest activity yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Share guest access links to track external engagement
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {[
              { icon: <Star size={16} className="text-yellow-400 fill-yellow-400" />, value: guestStats.guestRatings,  label: "Guest Ratings"  },
              { icon: <MessageSquare size={16} style={{ color: "var(--accent)" }} />, value: guestStats.guestComments, label: "Guest Comments" },
              { icon: <Copy size={16} style={{ color: "var(--primary)" }} />,         value: guestStats.guestCopies,   label: "Guest Copies"   },
            ].map(({ icon, value, label }) => (
              <div key={label} className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {icon}
                  <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
                </div>
                <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
              <div className="flex-1">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Guest Engagement</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {guestStats.guestRatings + guestStats.guestComments + guestStats.guestCopies} total interactions from guest users
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthenticatedUserAnalyticsCard (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function AuthenticatedUserAnalyticsCard({ teamId }) {
  const [authStats, setAuthStats] = useState({
    authRatings: 0, authComments: 0, authCopies: 0, authViews: 0, loading: true,
  });

  useEffect(() => {
    if (!teamId) { setAuthStats(prev => ({ ...prev, loading: false })); return; }

    const promptsRef = collection(db, 'teams', teamId, 'prompts');

    const unsub = onSnapshot(promptsRef, async (promptsSnap) => {
      try {
        let totalAuthRatings = 0, totalAuthComments = 0, totalAuthCopies = 0, totalAuthViews = 0;

        for (const promptDoc of promptsSnap.docs) {
          const promptData = promptDoc.data();
          const promptId   = promptDoc.id;

          const ratingsSnap  = await getDocs(collection(db, 'teams', teamId, 'prompts', promptId, 'ratings'));
          totalAuthRatings  += ratingsSnap.docs.filter(d => !d.data().isGuest).length;

          const commentsSnap = await getDocs(collection(db, 'teams', teamId, 'prompts', promptId, 'comments'));
          totalAuthComments += commentsSnap.docs.filter(d => !d.data().isGuest).length;

          const totalCopies  = promptData.stats?.copies      || 0;
          const guestCopies  = promptData.stats?.guestCopies || 0;
          totalAuthCopies   += (totalCopies - guestCopies);
          totalAuthViews    += promptData.stats?.views || 0;
        }

        setAuthStats({
          authRatings:  totalAuthRatings,
          authComments: totalAuthComments,
          authCopies:   totalAuthCopies,
          authViews:    totalAuthViews,
          loading:      false,
        });
      } catch (error) {
        console.error('Error loading auth user stats:', error);
        setAuthStats(prev => ({ ...prev, loading: false }));
      }
    });

    return () => unsub();
  }, [teamId]);

  if (authStats.loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck size={20} color="var(--primary)" />
          <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>Authenticated User Activity</h4>
        </div>
        <div className="text-center py-8">
          <div className="neo-spinner mx-auto mb-2"></div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading authenticated user analytics…</p>
        </div>
      </div>
    );
  }

  const hasAuthActivity = authStats.authRatings > 0 || authStats.authComments > 0 || authStats.authCopies > 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck size={20} color="var(--primary)" />
        <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>Authenticated User Activity</h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
          Team Members
        </span>
      </div>

      {!hasAuthActivity ? (
        <div className="text-center py-8">
          <Users size={32} className="mx-auto mb-2 opacity-50" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No team member activity yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Activity from team members will appear here</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { icon: <Star size={16} className="text-yellow-400 fill-yellow-400" />, value: authStats.authRatings,  label: "Ratings"  },
              { icon: <MessageSquare size={16} style={{ color: "var(--accent)" }} />, value: authStats.authComments, label: "Comments" },
              { icon: <Copy size={16} style={{ color: "var(--primary)" }} />,         value: authStats.authCopies,   label: "Copies"   },
              { icon: <Eye size={16} style={{ color: "var(--muted-foreground)" }} />, value: authStats.authViews,    label: "Views"    },
            ].map(({ icon, value, label }) => (
              <div key={label} className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {icon}
                  <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
                </div>
                <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
              <div className="flex-1">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Team Member Engagement</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {authStats.authRatings + authStats.authComments + authStats.authCopies} total interactions from team members
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamAnalytics (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

export function TeamAnalytics({ teamId }) {
  const [analytics, setAnalytics] = useState({
    totalPrompts: 0, totalViews: 0, totalCopies: 0,
    totalComments: 0, totalRatings: 0, averageRating: 0,
    topPrompts: [], recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  const [userTypeStats, setUserTypeStats] = useState({
    authenticatedRatings: 0, guestRatings: 0,
    authenticatedComments: 0, guestComments: 0,
  });

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }

    const promptsRef = collection(db, "teams", teamId, "prompts");
    const unsub = onSnapshot(promptsRef, async (snap) => {
      try {
        const allPrompts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const totals = allPrompts.reduce((acc, prompt) => {
          const stats = prompt.stats || {};
          return {
            totalPrompts:   acc.totalPrompts + 1,
            totalViews:     acc.totalViews    + (stats.views         || 0),
            totalCopies:    acc.totalCopies   + (stats.copies        || 0),
            totalComments:  acc.totalComments + (stats.comments      || 0),
            totalRatings:   acc.totalRatings  + (stats.totalRatings  || 0),
            ratingSum:      acc.ratingSum     + ((stats.averageRating || 0) * (stats.totalRatings || 0)),
          };
        }, { totalPrompts: 0, totalViews: 0, totalCopies: 0, totalComments: 0, totalRatings: 0, ratingSum: 0 });

        let authRatings = 0, guestRatingsCount = 0, authComments = 0, guestCommentsCount = 0;

        for (const prompt of allPrompts) {
          const ratingsSnap  = await getDocs(collection(db, 'teams', teamId, 'prompts', prompt.id, 'ratings'));
          ratingsSnap.docs.forEach(d => d.data().isGuest === true ? guestRatingsCount++ : authRatings++);

          const commentsSnap = await getDocs(collection(db, 'teams', teamId, 'prompts', prompt.id, 'comments'));
          commentsSnap.docs.forEach(d => d.data().isGuest === true ? guestCommentsCount++ : authComments++);
        }

        setUserTypeStats({
          authenticatedRatings:  authRatings,
          guestRatings:          guestRatingsCount,
          authenticatedComments: authComments,
          guestComments:         guestCommentsCount,
        });

        const topPrompts = allPrompts
          .filter((p) => (p.stats?.averageRating || 0) > 0 && (p.stats?.totalRatings || 0) > 0)
          .sort((a, b) => {
            const sA = (a.stats?.averageRating || 0) * (a.stats?.totalRatings || 0);
            const sB = (b.stats?.averageRating || 0) * (b.stats?.totalRatings || 0);
            return sB - sA;
          })
          .slice(0, 10);

        setAnalytics({
          totalPrompts:  totals.totalPrompts,
          totalViews:    totals.totalViews,
          totalCopies:   totals.totalCopies,
          totalComments: totals.totalComments,
          totalRatings:  totals.totalRatings,
          averageRating: totals.totalRatings > 0
            ? Math.round((totals.ratingSum / totals.totalRatings) * 10) / 10
            : 0,
          topPrompts,
        });

        setLoading(false);
      } catch (error) {
        console.error("Error calculating analytics:", error);
        setLoading(false);
      }
    }, (error) => {
      console.error("Analytics listener error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [teamId]);

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>Loading team analytics…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
            <BarChart3 size={20} style={{ color: "var(--primary-foreground)" }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Team Analytics</h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Performance insights and usage statistics</p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <FileText size={24} />, value: analytics.totalPrompts,  label: "Total Prompts", bg: "var(--primary)",   fg: "var(--primary-foreground)"   },
          { icon: <Copy size={24} />,     value: analytics.totalCopies,    label: "Times Copied",  bg: "var(--secondary)", fg: "var(--secondary-foreground)" },
          { icon: <MessageSquare size={24} />, value: analytics.totalComments, label: "Comments",  bg: "var(--accent)",    fg: "var(--accent-foreground)"    },
          { icon: <Star size={24} />,     value: analytics.averageRating > 0 ? analytics.averageRating.toFixed(1) : "0.0", label: "Avg Rating", bg: "var(--muted)", fg: "var(--foreground)" },
        ].map(({ icon, value, label, bg, fg }) => (
          <div key={label} className="glass-card p-6 text-center hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-3"
              style={{ backgroundColor: bg, color: fg }}>
              {icon}
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>{value}</div>
            <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>{label}</div>
          </div>
        ))}
      </div>

      <AuthenticatedUserAnalyticsCard teamId={teamId} />
      <GuestAnalyticsCard teamId={teamId} />

      {/* User Type Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { title: "Authenticated Users", icon: <UserCheck size={20} color="var(--primary)" />, badge: <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Team Members</span>, rows: [{ icon: <Star size={16} className="text-yellow-400 fill-yellow-400" />, label: "Ratings", value: userTypeStats.authenticatedRatings }, { icon: <MessageSquare size={16} style={{ color: "var(--accent)" }} />, label: "Comments", value: userTypeStats.authenticatedComments }] },
          { title: "Guest Users",          icon: <Eye size={20} color="var(--primary)" />,      badge: null, rows: [{ icon: <Star size={16} className="text-yellow-400 fill-yellow-400" />, label: "Ratings", value: userTypeStats.guestRatings }, { icon: <MessageSquare size={16} style={{ color: "var(--accent)" }} />, label: "Comments", value: userTypeStats.guestComments }] },
        ].map(({ title, icon, badge, rows }) => (
          <div key={title} className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              {icon}
              <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>{title}</h4>
              {badge}
            </div>
            <div className="space-y-3">
              {rows.map(({ icon: rowIcon, label, value }) => (
                <div key={label} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="flex items-center gap-2">
                    {rowIcon}
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>{label}</span>
                  </div>
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Top 10 Prompts */}
      {analytics.topPrompts.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award size={20} color="var(--primary)" />
            <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>Top 10 Performing Prompts</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Ranked by Rating Score
            </span>
          </div>
          <div className="space-y-3">
            {analytics.topPrompts.map((prompt, index) => {
              const ratingScore = ((prompt.stats?.averageRating || 0) * (prompt.stats?.totalRatings || 0)).toFixed(1);
              return (
                <div key={prompt.id}
                  className="flex items-center justify-between p-3 rounded-lg border transition-all hover:border-primary/50"
                  style={{ backgroundColor: "var(--secondary)", borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: index < 3 ? "var(--primary)" : "var(--muted)", color: index < 3 ? "var(--primary-foreground)" : "var(--foreground)" }}>
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ color: "var(--foreground)" }}>{prompt.title}</div>
                      <div className="text-sm flex items-center gap-2 flex-wrap" style={{ color: "var(--muted-foreground)" }}>
                        <span className="flex items-center gap-1"><Copy size={12} />{prompt.stats?.copies || 0} copies</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><MessageSquare size={12} />{prompt.stats?.comments || 0} comments</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Star size={12} />{prompt.stats?.totalRatings || 0} ratings</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-primary font-medium"><TrendingUp size={12} />Score: {ratingScore}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1">
                    <StarRating rating={prompt.stats?.averageRating || 0} readonly size="small" />
                    <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      {(prompt.stats?.averageRating || 0).toFixed(1)} avg
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {analytics.topPrompts.length === 10 && (
            <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Showing Top 10</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Rating Score = Average Rating × Total Ratings. Higher engagement and quality yield better rankings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} color="var(--primary)" />
            <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>Usage Trends</h4>
          </div>
          <div className="space-y-4">
            {[
              { label: "Most Active Feature",
                value: analytics.totalCopies > analytics.totalComments ? "Copying" : "Commenting" },
              { label: "Engagement Rate",
                value: analytics.totalPrompts > 0
                  ? `${(((analytics.totalCopies + analytics.totalComments) / analytics.totalPrompts)).toFixed(1)} per prompt`
                  : "0.0 per prompt" },
              { label: "Quality Score",
                value: analytics.averageRating > 0
                  ? `${((analytics.averageRating / 5) * 100).toFixed(0)}%`
                  : "No ratings" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={20} color="var(--primary)" />
            <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>Team Health</h4>
          </div>
          <div className="space-y-4">
            {[
              {
                label: "Collaboration",
                status: analytics.totalComments > 0 && analytics.totalPrompts > 0
                  ? "Active" : analytics.totalPrompts > 0 ? "Growing" : "Starting",
                pct: analytics.totalPrompts > 0
                  ? Math.min(100, ((analytics.totalComments + analytics.totalCopies) / analytics.totalPrompts) * 20)
                  : 0,
                color: "var(--primary)",
              },
              {
                label: "Content Quality",
                status: analytics.averageRating >= 4 ? "Excellent" : analytics.averageRating >= 3 ? "Good" : analytics.averageRating > 0 ? "Improving" : "No ratings yet",
                pct: ((analytics.averageRating || 0) / 5) * 100,
                color: "var(--accent)",
              },
            ].map(({ label, status, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{status}</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: "var(--muted)" }}>
                  <div className="h-2 rounded-full transition-all duration-300"
                    style={{ backgroundColor: color, width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
