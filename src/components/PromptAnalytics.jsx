// src/components/PromptAnalytics.jsx - Complete Updated Version with Guest Analytics
// ✅ FIXED: Guest team user ratings now functional with proper token management
// ✅ FIXED: Real-time guest copy tracking
// ✅ FIXED: Prevent duplicate guest ratings
// ✅ FIXED: Top 10 performing prompts display
// ✅ FIXED: Separate authenticated user section

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
import { 
  Star, BarChart3, FileText, Copy, MessageSquare, 
  TrendingUp, Award, Users, Eye, Activity, UserCheck,
  UserX, TrendingDown, Clock, Zap, AlertCircle
} from 'lucide-react';

// Hook for prompt ratings with duplicate prevention for guests
export function usePromptRating(teamId, promptId) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [userRating, setUserRating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !promptId) {
      console.log('⭐ [RATING] Missing teamId or promptId');
      setRatings([]);
      setUserRating(null);
      setLoading(false);
      return;
    }

    console.log('⭐ [RATING] Setting up listener for:', { teamId, promptId });
    
    // ✅ Debug guest token on mount
    debugGuestToken();

    try {
      const ratingsRef = collection(
        db,
        "teams",
        teamId,
        "prompts",
        promptId,
        "ratings"
      );
      const unsub = onSnapshot(
        ratingsRef,
        (snap) => {
          const ratingsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          console.log('⭐ [RATING] Loaded ratings:', ratingsData.length);
          setRatings(ratingsData);

          // ✅ FIXED: Use utility function for token management
          const guestToken = getGuestToken();
          const guestUserId = getGuestUserId();
          
          const userId = user?.uid || guestUserId;
          console.log('⭐ [RATING] Looking for userId:', userId?.substring(0, 20));

          const userRatingData = ratingsData.find(
            (r) => r.userId === userId || (guestToken && r.guestToken === guestToken)
          );
          
          console.log('⭐ [RATING] Found user rating:', userRatingData?.rating);
          setUserRating(userRatingData?.rating || null);
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
      console.error("❌ [RATING] Error setting up ratings listener:", error);
      setLoading(false);
    }
  }, [teamId, promptId, user?.uid]);

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
  }, [ratings]);

  async function ratePrompt(rating) {
    if (!teamId || !promptId || rating < 1 || rating > 5) {
      console.error('❌ [RATING] Invalid parameters:', { teamId, promptId, rating });
      return;
    }

    console.log('⭐ [RATING] Starting rating submission:', rating);
    
    // ✅ Debug guest token before rating
    const tokenDebug = debugGuestToken();

    try {
      // ✅ FIXED: Use utility functions for token management
      const isGuest = !user;
      const guestToken = getGuestToken();
      
      console.log('⭐ [RATING] User type:', isGuest ? 'guest' : 'authenticated');
      console.log('⭐ [RATING] Has guest token:', !!guestToken);
      
      if (isGuest && !guestToken) {
        console.error('❌ [RATING] Guest token not found in sessionStorage');
        console.error('❌ [RATING] Token debug:', tokenDebug);
        throw new Error("Guest token not found. Please refresh the page and try again.");
      }

      const userId = user?.uid || getGuestUserId();
      
      if (!userId) {
        console.error('❌ [RATING] Could not determine user ID');
        throw new Error("Could not determine user ID");
      }
      
      console.log('⭐ [RATING] Using userId:', userId.substring(0, 20));

      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "prompts",
        promptId,
        "ratings",
        userId
      );
      
      const ratingData = {
        userId: userId,
        rating: rating,
        createdAt: serverTimestamp(),
      };
      
      // ✅ Add guest metadata for tracking
      if (isGuest) {
        ratingData.isGuest = true;
        ratingData.guestToken = guestToken;
      }
      
      console.log('⭐ [RATING] Saving rating document:', { userId: userId.substring(0, 20), rating, isGuest });
      await setDoc(ratingRef, ratingData);
      console.log('✅ [RATING] Rating document saved successfully');

      const promptRef = doc(db, "teams", teamId, "prompts", promptId);
      const promptSnap = await getDoc(promptRef);

      if (promptSnap.exists()) {
        const currentStats = promptSnap.data().stats || {};
        const currentRatings = currentStats.ratings || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };

        console.log('⭐ [RATING] Current ratings:', currentRatings);
        console.log('⭐ [RATING] Previous user rating:', userRating);

        // Remove old rating if it exists
        if (userRating) {
          currentRatings[userRating] = Math.max(
            0,
            (currentRatings[userRating] || 0) - 1
          );
        }

        // Add new rating
        currentRatings[rating] = (currentRatings[rating] || 0) + 1;

        const totalRatings = Object.values(currentRatings).reduce(
          (sum, count) => sum + count,
          0
        );
        const weightedSum = Object.entries(currentRatings).reduce(
          (sum, [star, count]) => sum + parseInt(star) * count,
          0
        );
        const newAverage = totalRatings > 0 ? weightedSum / totalRatings : 0;

        console.log('⭐ [RATING] New stats:', { 
          totalRatings, 
          averageRating: newAverage.toFixed(2),
          distribution: currentRatings 
        });

        await updateDoc(promptRef, {
          "stats.ratings": currentRatings,
          "stats.totalRatings": totalRatings,
          "stats.averageRating": newAverage,
          "stats.lastRated": serverTimestamp(),
        });
        
        console.log('✅ [RATING] Prompt stats updated successfully');
      } else {
        console.error('❌ [RATING] Prompt document not found');
      }
    } catch (error) {
      console.error("❌ [RATING] Error rating prompt:", error);
      console.error("❌ [RATING] Error details:", error.message, error.code);
      throw error;
    }
  }

  async function removeRating() {
    if (!teamId || !promptId || !userRating) return;
    
    // ✅ Get user ID (authenticated or guest) using utility
    const guestUserId = getGuestUserId();
    const userId = user?.uid || guestUserId;
    
    if (!userId) return;

    try {
      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "prompts",
        promptId,
        "ratings",
        userId
      );
      await deleteDoc(ratingRef);

      const promptRef = doc(db, "teams", teamId, "prompts", promptId);
      const promptSnap = await getDoc(promptRef);

      if (promptSnap.exists()) {
        const currentStats = promptSnap.data().stats || {};
        const currentRatings = currentStats.ratings || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };

        currentRatings[userRating] = Math.max(
          0,
          (currentRatings[userRating] || 0) - 1
        );

        const totalRatings = Object.values(currentRatings).reduce(
          (sum, count) => sum + count,
          0
        );
        const weightedSum = Object.entries(currentRatings).reduce(
          (sum, [star, count]) => sum + parseInt(star) * count,
          0
        );
        const newAverage = totalRatings > 0 ? weightedSum / totalRatings : 0;

        await updateDoc(promptRef, {
          "stats.ratings": currentRatings,
          "stats.totalRatings": totalRatings,
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

// Star rating component
export function StarRating({
  rating = 0,
  onRate,
  readonly = false,
  size = "normal",
  className = "",
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const starSize = size === "small" ? 16 : size === "large" ? 24 : 20;

  const handleRate = (newRating) => {
    if (readonly || !onRate) return;
    onRate(newRating);
  };

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
          onClick={() => handleRate(star)}
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

// ✅ UPDATED: Guest Analytics Card with real-time copy tracking
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

    console.log('📊 [GUEST STATS] Setting up real-time listener for teamId:', teamId);

    // ✅ OPTIMIZED: Real-time listener with parallel processing
    const promptsRef = collection(db, 'teams', teamId, 'prompts');
    
    const unsub = onSnapshot(promptsRef, async (promptsSnap) => {
      console.log('📊 [GUEST STATS] Prompts snapshot received:', promptsSnap.docs.length);
      
      try {
        // ✅ Process all prompts in parallel for better performance
        const promptPromises = promptsSnap.docs.map(async (promptDoc) => {
          const promptData = promptDoc.data();
          const promptId = promptDoc.id;

          // ✅ Get guest copies from stats (already aggregated in Firestore)
          const guestCopiesCount = promptData.stats?.guestCopies || 0;
          
          // Count guest ratings
          const ratingsRef = collection(db, 'teams', teamId, 'prompts', promptId, 'ratings');
          const ratingsSnap = await getDocs(ratingsRef);
          const guestRatingsCount = ratingsSnap.docs.filter(d => d.data().isGuest === true).length;

          // Count guest comments
          const commentsRef = collection(db, 'teams', teamId, 'prompts', promptId, 'comments');
          const commentsSnap = await getDocs(commentsRef);
          const guestCommentsCount = commentsSnap.docs.filter(d => d.data().isGuest === true).length;

          return {
            copies: guestCopiesCount,
            ratings: guestRatingsCount,
            comments: guestCommentsCount,
          };
        });

        // Wait for all promises to resolve
        const results = await Promise.all(promptPromises);
        
        // Aggregate all results
        let totalGuestCopies = 0;
        let totalGuestRatings = 0;
        let totalGuestComments = 0;
        
        results.forEach(result => {
          totalGuestCopies += result.copies;
          totalGuestRatings += result.ratings;
          totalGuestComments += result.comments;
        });

        console.log('📊 [GUEST STATS] Aggregated totals:', {
          ratings: totalGuestRatings,
          comments: totalGuestComments,
          copies: totalGuestCopies
        });

        setGuestStats({
          guestRatings: totalGuestRatings,
          guestComments: totalGuestComments,
          guestCopies: totalGuestCopies,
          guestViews: 0, // Can add view tracking if needed
          loading: false,
        });
      } catch (error) {
        console.error('❌ [GUEST STATS] Error loading guest stats:', error);
        setGuestStats(prev => ({ ...prev, loading: false }));
      }
    }, (error) => {
      // ✅ Added error handler for snapshot listener
      console.error('❌ [GUEST STATS] Snapshot listener error:', error);
      setGuestStats(prev => ({ ...prev, loading: false }));
    });

    return () => unsub();
  }, [teamId]);

  // ✅ Rest of the component remains the same (rendering logic)
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
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading guest analytics...
          </p>
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
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No guest activity yet
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Share guest access links to track external engagement
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {guestStats.guestRatings}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Guest Ratings
              </div>
            </div>

            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <MessageSquare size={16} style={{ color: "var(--accent)" }} />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {guestStats.guestComments}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Guest Comments
              </div>
            </div>

            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Copy size={16} style={{ color: "var(--primary)" }} />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {guestStats.guestCopies}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Guest Copies
              </div>
            </div>
          </div>

          {/* Engagement Indicator */}
          <div className="p-3 rounded-lg border" style={{
            backgroundColor: "var(--muted)",
            borderColor: "var(--border)",
          }}>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
              <div className="flex-1">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Guest Engagement
                </p>
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

// ✅ NEW: Authenticated User Analytics Card
function AuthenticatedUserAnalyticsCard({ teamId }) {
  const [authStats, setAuthStats] = useState({
    authRatings: 0,
    authComments: 0,
    authCopies: 0,
    authViews: 0,
    loading: true,
  });

  useEffect(() => {
    if (!teamId) {
      setAuthStats(prev => ({ ...prev, loading: false }));
      return;
    }

    // Real-time listener for authenticated user activity
    const promptsRef = collection(db, 'teams', teamId, 'prompts');
    
    const unsub = onSnapshot(promptsRef, async (promptsSnap) => {
      try {
        let totalAuthRatings = 0;
        let totalAuthComments = 0;
        let totalAuthCopies = 0;
        let totalAuthViews = 0;

        for (const promptDoc of promptsSnap.docs) {
          const promptData = promptDoc.data();
          const promptId = promptDoc.id;

          // Count authenticated ratings
          const ratingsRef = collection(db, 'teams', teamId, 'prompts', promptId, 'ratings');
          const ratingsSnap = await getDocs(ratingsRef);
          const authRatingsCount = ratingsSnap.docs.filter(d => !d.data().isGuest).length;
          totalAuthRatings += authRatingsCount;

          // Count authenticated comments
          const commentsRef = collection(db, 'teams', teamId, 'prompts', promptId, 'comments');
          const commentsSnap = await getDocs(commentsRef);
          const authCommentsCount = commentsSnap.docs.filter(d => !d.data().isGuest).length;
          totalAuthComments += authCommentsCount;

          // Get authenticated copies (total copies - guest copies)
          const totalCopies = promptData.stats?.copies || 0;
          const guestCopies = promptData.stats?.guestCopies || 0;
          totalAuthCopies += (totalCopies - guestCopies);

          // Get views (can be split if tracked separately)
          totalAuthViews += promptData.stats?.views || 0;
        }

        setAuthStats({
          authRatings: totalAuthRatings,
          authComments: totalAuthComments,
          authCopies: totalAuthCopies,
          authViews: totalAuthViews,
          loading: false,
        });
      } catch (error) {
        console.error('Error loading authenticated user stats:', error);
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
          <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
            Authenticated User Activity
          </h4>
        </div>
        <div className="text-center py-8">
          <div className="neo-spinner mx-auto mb-2"></div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading authenticated user analytics...
          </p>
        </div>
      </div>
    );
  }

  const hasAuthActivity = authStats.authRatings > 0 || authStats.authComments > 0 || authStats.authCopies > 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck size={20} color="var(--primary)" />
        <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
          Authenticated User Activity
        </h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
          Team Members
        </span>
      </div>

      {!hasAuthActivity ? (
        <div className="text-center py-8">
          <Users size={32} className="mx-auto mb-2 opacity-50" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No team member activity yet
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Activity from team members will appear here
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {authStats.authRatings}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Ratings
              </div>
            </div>

            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <MessageSquare size={16} style={{ color: "var(--accent)" }} />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {authStats.authComments}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Comments
              </div>
            </div>

            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Copy size={16} style={{ color: "var(--primary)" }} />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {authStats.authCopies}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Copies
              </div>
            </div>

            <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Eye size={16} style={{ color: "var(--muted-foreground)" }} />
                <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {authStats.authViews}
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Views
              </div>
            </div>
          </div>

          {/* Engagement Indicator */}
          <div className="p-3 rounded-lg border" style={{
            backgroundColor: "var(--muted)",
            borderColor: "var(--border)",
          }}>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
              <div className="flex-1">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Team Member Engagement
                </p>
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

// ✅ UPDATED: Team analytics dashboard with all fixes
export function TeamAnalytics({ teamId }) {
  const [analytics, setAnalytics] = useState({
    totalPrompts: 0,
    totalViews: 0,
    totalCopies: 0,
    totalComments: 0,
    totalRatings: 0,
    averageRating: 0,
    topPrompts: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  // ✅ Separate tracking for authenticated vs guest metrics
  const [userTypeStats, setUserTypeStats] = useState({
    authenticatedRatings: 0,
    guestRatings: 0,
    authenticatedComments: 0,
    guestComments: 0,
  });

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const promptsRef = collection(db, "teams", teamId, "prompts");
    const unsub = onSnapshot(
      promptsRef,
      async (snap) => {
        try {
          const allPrompts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // Calculate totals with proper fallbacks
          const totals = allPrompts.reduce(
            (acc, prompt) => {
              const stats = prompt.stats || {};
              return {
                totalPrompts: acc.totalPrompts + 1,
                totalViews: acc.totalViews + (stats.views || 0),
                totalCopies: acc.totalCopies + (stats.copies || 0),
                totalComments: acc.totalComments + (stats.comments || 0),
                totalRatings: acc.totalRatings + (stats.totalRatings || 0),
                ratingSum:
                  acc.ratingSum +
                  ((stats.averageRating || 0) * (stats.totalRatings || 0)),
              };
            },
            {
              totalPrompts: 0,
              totalViews: 0,
              totalCopies: 0,
              totalComments: 0,
              totalRatings: 0,
              ratingSum: 0,
            }
          );

          // Calculate user type breakdown
          let authRatings = 0;
          let guestRatingsCount = 0;
          let authComments = 0;
          let guestCommentsCount = 0;

          for (const prompt of allPrompts) {
            // Count ratings by type
            const ratingsRef = collection(db, 'teams', teamId, 'prompts', prompt.id, 'ratings');
            const ratingsSnap = await getDocs(ratingsRef);
            ratingsSnap.docs.forEach(doc => {
              if (doc.data().isGuest === true) {
                guestRatingsCount++;
              } else {
                authRatings++;
              }
            });

            // Count comments by type
            const commentsRef = collection(db, 'teams', teamId, 'prompts', prompt.id, 'comments');
            const commentsSnap = await getDocs(commentsRef);
            commentsSnap.docs.forEach(doc => {
              if (doc.data().isGuest === true) {
                guestCommentsCount++;
              } else {
                authComments++;
              }
            });
          }

          setUserTypeStats({
            authenticatedRatings: authRatings,
            guestRatings: guestRatingsCount,
            authenticatedComments: authComments,
            guestComments: guestCommentsCount,
          });

          // ✅ FIXED: Get top 10 prompts with ratings (was limited to 5)
          const topPrompts = allPrompts
            .filter((p) => {
              const stats = p.stats || {};
              return (stats.averageRating || 0) > 0 && (stats.totalRatings || 0) > 0;
            })
            .sort((a, b) => {
              // Sort by weighted score: average rating * total ratings
              const scoreA = (a.stats?.averageRating || 0) * (a.stats?.totalRatings || 0);
              const scoreB = (b.stats?.averageRating || 0) * (b.stats?.totalRatings || 0);
              return scoreB - scoreA;
            })
            .slice(0, 10); // ✅ FIXED: Changed from 5 to 10

          setAnalytics({
            totalPrompts: totals.totalPrompts,
            totalViews: totals.totalViews,
            totalCopies: totals.totalCopies,
            totalComments: totals.totalComments,
            totalRatings: totals.totalRatings,
            averageRating:
              totals.totalRatings > 0
                ? Math.round((totals.ratingSum / totals.totalRatings) * 10) / 10
                : 0,
            topPrompts,
          });

          setLoading(false);
        } catch (error) {
          console.error("Error calculating analytics:", error);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Analytics listener error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [teamId]);

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>
          Loading team analytics...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <BarChart3 size={20} style={{ color: "var(--primary-foreground)" }} />
          </div>
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Team Analytics
            </h3>
            <p
              className="text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              Performance insights and usage statistics
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 text-center hover:border-primary/50 transition-all duration-300">
          <div
            className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-3"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            <FileText size={24} />
          </div>
          <div
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {analytics.totalPrompts}
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Total Prompts
          </div>
        </div>

        <div className="glass-card p-6 text-center hover:border-primary/50 transition-all duration-300">
          <div
            className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-3"
            style={{
              backgroundColor: "var(--secondary)",
              color: "var(--secondary-foreground)",
            }}
          >
            <Copy size={24} />
          </div>
          <div
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {analytics.totalCopies}
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Times Copied
          </div>
        </div>

        <div className="glass-card p-6 text-center hover:border-primary/50 transition-all duration-300">
          <div
            className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-3"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground)",
            }}
          >
            <MessageSquare size={24} />
          </div>
          <div
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {analytics.totalComments}
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Comments
          </div>
        </div>

        <div className="glass-card p-6 text-center hover:border-primary/50 transition-all duration-300">
          <div
            className="w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-3"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--foreground)",
            }}
          >
            <Star size={24} />
          </div>
          <div
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {analytics.averageRating > 0
              ? analytics.averageRating.toFixed(1)
              : "0.0"}
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Avg Rating
          </div>
        </div>
      </div>

      {/* ✅ NEW: Authenticated User Analytics Card (separate from guest) */}
      <AuthenticatedUserAnalyticsCard teamId={teamId} />

      {/* ✅ Guest Analytics Card (with real-time copy tracking) */}
      <GuestAnalyticsCard teamId={teamId} />

      {/* ✅ User Type Breakdown - kept for backward compatibility */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck size={20} color="var(--primary)" />
            <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
              Authenticated Users
            </h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                <span className="text-sm" style={{ color: "var(--foreground)" }}>Ratings</span>
              </div>
              <span className="font-bold" style={{ color: "var(--foreground)" }}>
                {userTypeStats.authenticatedRatings}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-2">
                <MessageSquare size={16} style={{ color: "var(--accent)" }} />
                <span className="text-sm" style={{ color: "var(--foreground)" }}>Comments</span>
              </div>
              <span className="font-bold" style={{ color: "var(--foreground)" }}>
                {userTypeStats.authenticatedComments}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={20} color="var(--primary)" />
            <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
              Guest Users
            </h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                <span className="text-sm" style={{ color: "var(--foreground)" }}>Ratings</span>
              </div>
              <span className="font-bold" style={{ color: "var(--foreground)" }}>
                {userTypeStats.guestRatings}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-2">
                <MessageSquare size={16} style={{ color: "var(--accent)" }} />
                <span className="text-sm" style={{ color: "var(--foreground)" }}>Comments</span>
              </div>
              <span className="font-bold" style={{ color: "var(--foreground)" }}>
                {userTypeStats.guestComments}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ FIXED: Top 10 Performing Prompts (was 5) */}
      {analytics.topPrompts.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award size={20} color="var(--primary)" />
            <h4
              className="font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Top 10 Performing Prompts
            </h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Ranked by Rating Score
            </span>
          </div>
          <div className="space-y-3">
            {analytics.topPrompts.map((prompt, index) => {
              const ratingScore = ((prompt.stats?.averageRating || 0) * (prompt.stats?.totalRatings || 0)).toFixed(1);
              
              return (
                <div
                  key={prompt.id}
                  className="flex items-center justify-between p-3 rounded-lg border transition-all hover:border-primary/50"
                  style={{
                    backgroundColor: "var(--secondary)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        backgroundColor: index < 3 ? "var(--primary)" : "var(--muted)",
                        color: index < 3 ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {prompt.title}
                      </div>
                      <div
                        className="text-sm flex items-center gap-2 flex-wrap"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <span className="flex items-center gap-1">
                          <Copy size={12} />
                          {prompt.stats?.copies || 0} copies
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {prompt.stats?.comments || 0} comments
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Star size={12} />
                          {prompt.stats?.totalRatings || 0} ratings
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <TrendingUp size={12} />
                          Score: {ratingScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1">
                    <StarRating
                      rating={prompt.stats?.averageRating || 0}
                      readonly
                      size="small"
                    />
                    <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      {(prompt.stats?.averageRating || 0).toFixed(1)} avg
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {analytics.topPrompts.length === 10 && (
            <div className="mt-4 p-3 rounded-lg border" style={{
              backgroundColor: "var(--muted)",
              borderColor: "var(--border)",
            }}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Showing Top 10
                  </p>
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
            <h4
              className="font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Usage Trends
            </h4>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Most Active Feature
              </span>
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {analytics.totalCopies > analytics.totalComments
                  ? "Copying"
                  : "Commenting"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Engagement Rate
              </span>
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {analytics.totalPrompts > 0
                  ? (
                      ((analytics.totalCopies + analytics.totalComments) /
                        analytics.totalPrompts)
                    ).toFixed(1)
                  : "0.0"}{" "}
                per prompt
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Quality Score
              </span>
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {analytics.averageRating > 0
                  ? `${((analytics.averageRating / 5) * 100).toFixed(0)}%`
                  : "No ratings"}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={20} color="var(--primary)" />
            <h4
              className="font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Team Health
            </h4>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Collaboration
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {analytics.totalComments > 0 && analytics.totalPrompts > 0
                    ? "Active"
                    : analytics.totalPrompts > 0
                    ? "Growing"
                    : "Starting"}
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full"
                style={{ backgroundColor: "var(--muted)" }}
              >
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: "var(--primary)",
                    width: `${
                      analytics.totalPrompts > 0
                        ? Math.min(
                            100,
                            ((analytics.totalComments + analytics.totalCopies) /
                              analytics.totalPrompts) *
                              20
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Content Quality
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {analytics.averageRating >= 4
                    ? "Excellent"
                    : analytics.averageRating >= 3
                    ? "Good"
                    : analytics.averageRating > 0
                    ? "Improving"
                    : "No ratings yet"}
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full"
                style={{ backgroundColor: "var(--muted)" }}
              >
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: "var(--accent)",
                    width: `${((analytics.averageRating || 0) / 5) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
