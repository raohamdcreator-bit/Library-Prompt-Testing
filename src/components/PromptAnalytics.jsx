// src/components/PromptAnalytics.jsx - Updated to match demo UI
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
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// Hook for prompt ratings
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
          setRatings(ratingsData);

          const userRatingData = ratingsData.find(
            (r) => r.userId === user?.uid
          );
          setUserRating(userRatingData?.rating || null);
          setLoading(false);
        },
        (error) => {
          console.error("Error loading ratings:", error);
          setRatings([]);
          setUserRating(null);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (error) {
      console.error("Error setting up ratings listener:", error);
      setLoading(false);
    }
  }, [teamId, promptId, user?.uid]);

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
  }, [ratings]);

  async function ratePrompt(rating) {
    if (!user || !teamId || !promptId || rating < 1 || rating > 5) return;

    try {
      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "prompts",
        promptId,
        "ratings",
        user.uid
      );
      await setDoc(ratingRef, {
        userId: user.uid,
        rating: rating,
        createdAt: serverTimestamp(),
      });

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

        if (userRating) {
          currentRatings[userRating] = Math.max(
            0,
            (currentRatings[userRating] || 0) - 1
          );
        }

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

        await updateDoc(promptRef, {
          "stats.ratings": currentRatings,
          "stats.totalRatings": totalRatings,
          "stats.averageRating": newAverage,
          "stats.lastRated": serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error rating prompt:", error);
      throw error;
    }
  }

  async function removeRating() {
    if (!user || !teamId || !promptId || !userRating) return;

    try {
      const ratingRef = doc(
        db,
        "teams",
        teamId,
        "prompts",
        promptId,
        "ratings",
        user.uid
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
  const sizeClass =
    size === "small" ? "text-sm" : size === "large" ? "text-xl" : "text-base";

  const handleRate = (newRating) => {
    if (readonly || !onRate) return;
    onRate(newRating);
  };

  return (
    <div className={`flex items-center gap-1 ${sizeClass} ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`transition-colors ${
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          }`}
          onClick={() => handleRate(star)}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
        >
          <span
            className={`${
              star <= (hoverRating || rating)
                ? "text-yellow-400"
                : "text-gray-500"
            } transition-all duration-150`}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

// Team analytics dashboard
export function TeamAnalytics({ teamId }) {
  const [analytics, setAnalytics] = useState({
    totalPrompts: 0,
    totalViews: 0,
    totalCopies: 0,
    totalComments: 0,
    averageRating: 0,
    topPrompts: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

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
                  (stats.averageRating || 0) * (stats.totalRatings || 0),
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

          const topPrompts = allPrompts
            .filter((p) => p.stats?.averageRating > 0)
            .sort(
              (a, b) =>
                (b.stats?.averageRating || 0) - (a.stats?.averageRating || 0)
            )
            .slice(0, 5);

          setAnalytics({
            ...totals,
            averageRating:
              totals.totalRatings > 0
                ? totals.ratingSum / totals.totalRatings
                : 0,
            topPrompts,
          });

          setLoading(false);
        } catch (error) {
          console.error("Error loading analytics:", error);
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
            <span
              className="text-lg"
              style={{ color: "var(--primary-foreground)" }}
            >
              📊
            </span>
          </div>
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Team Analytics
            </h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
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
            📝
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
            📋
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
            💬
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
            ⭐
          </div>
          <div
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {analytics.averageRating > 0
              ? analytics.averageRating.toFixed(1)
              : "—"}
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Avg Rating
          </div>
        </div>
      </div>

      {/* Top Rated Prompts */}
      {analytics.topPrompts.length > 0 && (
        <div className="glass-card p-6">
          <h4
            className="font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            🏆 Top Performing Prompts
          </h4>
          <div className="space-y-3">
            {analytics.topPrompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{
                  backgroundColor: "var(--secondary)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
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
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {prompt.stats?.totalCopies || 0} copies •{" "}
                      {prompt.stats?.comments || 0} comments
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <StarRating
                    rating={prompt.stats?.averageRating || 0}
                    readonly
                    size="small"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h4
            className="font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            📈 Usage Trends
          </h4>
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
                  ? Math.round(
                      ((analytics.totalCopies + analytics.totalComments) /
                        analytics.totalPrompts) *
                        100
                    ) / 100
                  : 0}{" "}
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
          <h4
            className="font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            🎯 Team Health
          </h4>
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
                  {analytics.totalComments > 0 ? "Active" : "Growing"}
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
                    width: `${Math.min(
                      100,
                      (analytics.totalComments /
                        Math.max(1, analytics.totalPrompts)) *
                        100
                    )}%`,
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
                    : "Improving"}
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
                    width: `${(analytics.averageRating / 5) * 100}%`,
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
