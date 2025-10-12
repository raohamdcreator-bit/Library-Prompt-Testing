// src/components/ActivityFeed.jsx - Complete Updated to match demo UI
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  doc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// Activity Logger utility for creating activity records
export const ActivityLogger = {
  async logPromptCreated(teamId, userId, promptId, promptTitle) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "prompt_created",
        userId,
        promptId,
        promptTitle,
        timestamp: serverTimestamp(),
        metadata: { action: "created" },
      });
    } catch (error) {
      console.error("Error logging prompt creation:", error);
    }
  },

  async logPromptUpdated(teamId, userId, promptId, promptTitle) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "prompt_updated",
        userId,
        promptId,
        promptTitle,
        timestamp: serverTimestamp(),
        metadata: { action: "updated" },
      });
    } catch (error) {
      console.error("Error logging prompt update:", error);
    }
  },

  async logMemberJoined(teamId, userId, memberName) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "member_joined",
        userId,
        timestamp: serverTimestamp(),
        metadata: { memberName },
      });
    } catch (error) {
      console.error("Error logging member join:", error);
    }
  },

  async logPromptRated(teamId, userId, promptId, promptTitle, rating) {
    try {
      await addDoc(collection(db, "teams", teamId, "activities"), {
        type: "prompt_rated",
        userId,
        promptId,
        promptTitle,
        timestamp: serverTimestamp(),
        metadata: { rating },
      });
    } catch (error) {
      console.error("Error logging rating:", error);
    }
  },
};

export default function ActivityFeed({ teamId }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState({});
  const [filter, setFilter] = useState("all"); // all, prompts, members, ratings
  const [timeFilter, setTimeFilter] = useState("week"); // today, week, month, all

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    // Try to load from activities collection, fallback to generating from prompts
    const activitiesRef = collection(db, "teams", teamId, "activities");
    const q = query(activitiesRef, orderBy("timestamp", "desc"), limit(100));

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        let activityItems = [];

        if (snapshot.empty) {
          // Fallback: Generate activities from prompts collection
          const promptsRef = collection(db, "teams", teamId, "prompts");
          const promptsQuery = query(
            promptsRef,
            orderBy("createdAt", "desc"),
            limit(50)
          );

          const promptsSnapshot = await new Promise((resolve, reject) => {
            const unsubPrompts = onSnapshot(promptsQuery, resolve, reject);
            return unsubPrompts;
          });

          const promptData = promptsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          const userIds = new Set();

          promptData.forEach((prompt) => {
            if (prompt.createdBy) userIds.add(prompt.createdBy);

            // Add creation activity
            activityItems.push({
              id: `created-${prompt.id}`,
              type: "prompt_created",
              userId: prompt.createdBy,
              promptId: prompt.id,
              promptTitle: prompt.title,
              timestamp: prompt.createdAt,
              metadata: {
                tags: prompt.tags || [],
                stats: prompt.stats || {},
              },
            });

            // Add update activity if updated
            if (prompt.updatedAt && prompt.updatedAt !== prompt.createdAt) {
              activityItems.push({
                id: `updated-${prompt.id}`,
                type: "prompt_updated",
                userId: prompt.createdBy,
                promptId: prompt.id,
                promptTitle: prompt.title,
                timestamp: prompt.updatedAt,
                metadata: {
                  tags: prompt.tags || [],
                },
              });
            }

            // Add rating activity if exists
            if (prompt.stats?.lastRated && prompt.stats?.averageRating > 0) {
              activityItems.push({
                id: `rated-${prompt.id}-${prompt.stats.lastRated.toMillis()}`,
                type: "prompt_rated",
                userId: prompt.createdBy,
                promptId: prompt.id,
                promptTitle: prompt.title,
                timestamp: prompt.stats.lastRated,
                metadata: {
                  rating: prompt.stats.averageRating,
                  totalRatings: prompt.stats.totalRatings || 0,
                },
              });
            }
          });

          // Load user profiles
          const profiles = {};
          for (const userId of userIds) {
            try {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                profiles[userId] = userDoc.data();
              }
            } catch (error) {
              console.error("Error loading user profile:", error);
            }
          }
          setUserProfiles(profiles);
        } else {
          // Use real activities collection
          activityItems = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Load user profiles for activities
          const userIds = new Set(
            activityItems.map((a) => a.userId).filter(Boolean)
          );
          const profiles = {};

          for (const userId of userIds) {
            try {
              const userDoc = await getDoc(doc(db, "users", userId));
              if (userDoc.exists()) {
                profiles[userId] = userDoc.data();
              }
            } catch (error) {
              console.error("Error loading user profile:", error);
            }
          }
          setUserProfiles(profiles);
        }

        // Sort by timestamp
        activityItems.sort((a, b) => {
          const aTime = a.timestamp?.toMillis() || 0;
          const bTime = b.timestamp?.toMillis() || 0;
          return bTime - aTime;
        });

        setActivities(activityItems);
        setLoading(false);
      },
      (error) => {
        console.error("Activity feed listener error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [teamId]);

  // Filter activities based on selected filters
  const filteredActivities = activities.filter((activity) => {
    // Type filter
    const typeMatch = (() => {
      switch (filter) {
        case "prompts":
          return [
            "prompt_created",
            "prompt_updated",
            "prompt_deleted",
          ].includes(activity.type);
        case "ratings":
          return activity.type === "prompt_rated";
        case "members":
          return ["member_joined", "member_left", "role_changed"].includes(
            activity.type
          );
        default:
          return true;
      }
    })();

    if (!typeMatch) return false;

    // Time filter
    const timeMatch = (() => {
      if (timeFilter === "all" || !activity.timestamp) return true;

      const now = new Date();
      const activityTime = activity.timestamp.toDate();
      const diffMs = now - activityTime;

      switch (timeFilter) {
        case "today":
          return diffMs < 24 * 60 * 60 * 1000; // 24 hours
        case "week":
          return diffMs < 7 * 24 * 60 * 60 * 1000; // 7 days
        case "month":
          return diffMs < 30 * 24 * 60 * 60 * 1000; // 30 days
        default:
          return true;
      }
    })();

    return timeMatch;
  });

  function getActivityIcon(type) {
    switch (type) {
      case "prompt_created":
        return "➕";
      case "prompt_updated":
        return "✏️";
      case "prompt_deleted":
        return "🗑️";
      case "prompt_rated":
        return "⭐";
      case "member_joined":
        return "👋";
      case "member_left":
        return "👋";
      case "role_changed":
        return "🔄";
      default:
        return "📝";
    }
  }

  function getActivityColor(type) {
    switch (type) {
      case "prompt_created":
        return "var(--primary)";
      case "prompt_updated":
        return "var(--accent)";
      case "prompt_deleted":
        return "var(--destructive)";
      case "prompt_rated":
        return "#fbbf24"; // yellow
      case "member_joined":
        return "var(--primary)";
      case "member_left":
        return "var(--muted-foreground)";
      case "role_changed":
        return "var(--accent)";
      default:
        return "var(--muted-foreground)";
    }
  }

  function formatActivityMessage(activity) {
    const user = userProfiles[activity.userId];
    const userName = user?.name || user?.email || "Unknown user";

    switch (activity.type) {
      case "prompt_created":
        return (
          <span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {userName}
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              created prompt{" "}
            </span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              "{activity.promptTitle}"
            </span>
          </span>
        );
      case "prompt_updated":
        return (
          <span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {userName}
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              updated prompt{" "}
            </span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              "{activity.promptTitle}"
            </span>
          </span>
        );
      case "prompt_rated":
        return (
          <span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {userName}
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              rated prompt{" "}
            </span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              "{activity.promptTitle}"
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              ({activity.metadata?.rating?.toFixed(1)} stars)
            </span>
          </span>
        );
      case "member_joined":
        return (
          <span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {userName}
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              joined the team
            </span>
          </span>
        );
      case "member_left":
        return (
          <span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {userName}
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              left the team
            </span>
          </span>
        );
      default:
        return (
          <span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {userName}
            </span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {" "}
              performed an action
            </span>
          </span>
        );
    }
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "Unknown time";

    try {
      const now = new Date();
      const activityTime = timestamp.toDate();
      const diffMs = now - activityTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return activityTime.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown time";
    }
  }

  function UserAvatar({ userId, size = "small" }) {
    const user = userProfiles[userId];
    const [imageError, setImageError] = useState(false);
    const avatarClass = size === "small" ? "w-8 h-8" : "w-10 h-10";

    if (!user?.avatar || imageError) {
      const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user?.email
        ? user.email[0].toUpperCase()
        : "U";

      return (
        <div
          className={`${avatarClass} rounded-full flex items-center justify-center text-white font-semibold text-xs`}
          style={{ backgroundColor: "var(--primary)" }}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        src={user.avatar}
        alt="avatar"
        className={`${avatarClass} rounded-full object-cover border-2 border-white/20`}
        onError={() => setImageError(true)}
      />
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>
          Loading team activity...
        </p>
      </div>
    );
  }

  const activityStats = {
    promptsCreated: activities.filter((a) => a.type === "prompt_created")
      .length,
    updatesCount: activities.filter((a) => a.type === "prompt_updated").length,
    ratingsCount: activities.filter((a) => a.type === "prompt_rated").length,
    activeMembers: new Set(activities.map((a) => a.userId)).size,
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="text-lg"
                style={{ color: "var(--primary-foreground)" }}
              >
                ⚡
              </span>
            </div>
            <div>
              <h3
                className="text-lg font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Team Activity
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Recent actions and updates from your team
              </p>
            </div>
          </div>

          {/* Export Activity Button */}
          <button
            onClick={() => {
              const csvData = filteredActivities.map((activity) => ({
                Time: formatRelativeTime(activity.timestamp),
                Type: activity.type,
                User:
                  userProfiles[activity.userId]?.name ||
                  userProfiles[activity.userId]?.email ||
                  "Unknown",
                Action:
                  activity.promptTitle ||
                  activity.metadata?.memberName ||
                  "N/A",
              }));

              const csv = [
                Object.keys(csvData[0] || {}).join(","),
                ...csvData.map((row) => Object.values(row).join(",")),
              ].join("\n");

              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `team-activity-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 text-sm rounded-lg border transition-colors"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
              color: "var(--secondary-foreground)",
            }}
          >
            Export CSV
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Activity Type Filter */}
          <div>
            <label
              className="text-sm font-medium mb-2 block"
              style={{ color: "var(--foreground)" }}
            >
              Activity Type
            </label>
            <div
              className="flex rounded-lg border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              {[
                { key: "all", label: "All", icon: "📋" },
                { key: "prompts", label: "Prompts", icon: "📝" },
                { key: "ratings", label: "Ratings", icon: "⭐" },
                { key: "members", label: "Members", icon: "👥" },
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => setFilter(filterOption.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1 ${
                    filter === filterOption.key
                      ? "text-primary-foreground"
                      : "hover:text-foreground"
                  }`}
                  style={
                    filter === filterOption.key
                      ? {
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                        }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  <span className="text-xs">{filterOption.icon}</span>
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Filter */}
          <div>
            <label
              className="text-sm font-medium mb-2 block"
              style={{ color: "var(--foreground)" }}
            >
              Time Period
            </label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="glass-card p-6">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📭</div>
            <h4
              className="font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              No recent activity
            </h4>
            <p style={{ color: "var(--muted-foreground)" }}>
              {filter === "all"
                ? "Team activity will appear here as members create and interact with prompts"
                : `No recent ${filter} activity to show`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Activity Feed ({filteredActivities.length})
              </h4>
              {filteredActivities.length !== activities.length && (
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: "var(--muted)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  Filtered from {activities.length} total
                </span>
              )}
            </div>

            {filteredActivities.slice(0, 50).map((activity, index) => (
              <div
                key={`${activity.id}-${index}`}
                className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
              >
                {/* Activity Icon */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{
                    backgroundColor: `${getActivityColor(activity.type)}20`,
                    color: getActivityColor(activity.type),
                  }}
                >
                  {getActivityIcon(activity.type)}
                </div>

                {/* User Avatar */}
                <UserAvatar userId={activity.userId} />

                {/* Activity Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm mb-1">
                    {formatActivityMessage(activity)}
                  </div>

                  {/* Activity Metadata */}
                  <div
                    className="flex items-center gap-3 text-xs flex-wrap"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span>{formatRelativeTime(activity.timestamp)}</span>

                    {activity.metadata?.tags &&
                      activity.metadata.tags.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex gap-1">
                            {activity.metadata.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded text-xs"
                                style={{
                                  backgroundColor: "var(--secondary)",
                                  color: "var(--secondary-foreground)",
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                            {activity.metadata.tags.length > 2 && (
                              <span
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                +{activity.metadata.tags.length - 2} more
                              </span>
                            )}
                          </div>
                        </>
                      )}

                    {activity.metadata?.totalRatings && (
                      <>
                        <span>•</span>
                        <span>
                          {activity.metadata.totalRatings} total ratings
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Show More Button */}
            {filteredActivities.length > 50 && (
              <div className="text-center pt-4">
                <button
                  onClick={() => {
                    // This would load more activities in a real implementation
                    alert(
                      `Showing ${Math.min(50, filteredActivities.length)} of ${
                        filteredActivities.length
                      } activities`
                    );
                  }}
                  className="px-4 py-2 text-sm rounded-lg border transition-colors"
                  style={{
                    backgroundColor: "var(--secondary)",
                    borderColor: "var(--border)",
                    color: "var(--secondary-foreground)",
                  }}
                >
                  Load More Activity ({filteredActivities.length - 50}{" "}
                  remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity Stats */}
      <div className="glass-card p-6">
        <h4
          className="font-semibold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          Activity Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              {activityStats.promptsCreated}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Prompts Created
            </div>
          </div>
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              {activityStats.updatesCount}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Updates Made
            </div>
          </div>
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              {activityStats.ratingsCount}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Ratings Given
            </div>
          </div>
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              {activityStats.activeMembers}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Active Members
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
