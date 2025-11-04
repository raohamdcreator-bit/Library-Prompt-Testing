// src/components/Favorites.jsx - Updated with Visibility Support
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { toggleFavorite } from "../lib/prompts";
import { canViewPrompt } from "../lib/prompts";

// Favorite Button Component
export function FavoriteButton({ prompt, teamId, teamName, size = "normal" }) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !prompt) return;

    const favRef = doc(db, "users", user.uid, "favorites", prompt.id);
    const unsubscribe = onSnapshot(favRef, (snap) => {
      setIsFavorite(snap.exists());
    });

    return () => unsubscribe();
  }, [user, prompt]);

  async function handleToggle() {
    if (!user || loading) return;

    setLoading(true);
    try {
      await toggleFavorite(user.uid, { ...prompt, teamId }, isFavorite);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setLoading(false);
    }
  }

  const buttonSize = size === "small" ? "p-2" : "p-3";
  const iconSize = size === "small" ? "w-5 h-5" : "w-6 h-6";

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`${buttonSize} rounded-lg transition-all duration-200 hover:scale-110 ${
        loading ? "opacity-50" : ""
      }`}
      style={{
        backgroundColor: isFavorite ? "var(--accent)" : "var(--secondary)",
        color: isFavorite ? "var(--accent-foreground)" : "var(--foreground)",
      }}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        className={iconSize}
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
}

// Main Favorites List Component
export default function FavoritesList() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFavorites, setExpandedFavorites] = useState({});
  const [teamRoles, setTeamRoles] = useState({});

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const favsRef = collection(db, "users", user.uid, "favorites");
    const unsubscribe = onSnapshot(
      favsRef,
      async (snapshot) => {
        const favData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Load team roles for visibility checking
        const roles = {};
        const uniqueTeamIds = [...new Set(favData.map((f) => f.teamId))];

        for (const teamId of uniqueTeamIds) {
          try {
            const teamDoc = await getDoc(doc(db, "teams", teamId));
            if (teamDoc.exists()) {
              const teamData = teamDoc.data();
              roles[teamId] = teamData.members?.[user.uid] || null;
            }
          } catch (error) {
            console.error("Error loading team role:", error);
          }
        }

        setTeamRoles(roles);

        // Filter out favorites that user can no longer view
        const visibleFavorites = favData.filter((fav) => {
          const userRole = roles[fav.teamId];
          return canViewPrompt(fav, user.uid, userRole);
        });

        setFavorites(visibleFavorites);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading favorites:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  async function handleRemoveFavorite(favorite) {
    if (!confirm("Remove this prompt from favorites?")) return;

    try {
      await toggleFavorite(user.uid, favorite, true);
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  }

  async function handleCopy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("Copied to clipboard!", "success");
    } catch (error) {
      console.error("Error copying:", error);
      showNotification("Failed to copy", "error");
    }
  }

  function toggleExpanded(id) {
    setExpandedFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    const icons = { success: "✅", error: "❌", info: "ℹ️" };

    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type]}</span>
        <span>${message}</span>
      </div>
    `;

    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.backgroundColor = "var(--card)";
    notification.style.color = "var(--foreground)";
    notification.style.border = `1px solid var(--${
      type === "error" ? "destructive" : "primary"
    })`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      return timestamp.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function getVisibilityBadge(visibility) {
    const isPrivate = visibility === "private";
    return {
      icon: isPrivate ? "🔒" : "🔓",
      label: isPrivate ? "Private" : "Public",
      style: {
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "0.75rem",
        fontWeight: "500",
        backgroundColor: isPrivate ? "var(--accent)" : "var(--secondary)",
        color: isPrivate
          ? "var(--accent-foreground)"
          : "var(--secondary-foreground)",
        border: "1px solid var(--border)",
      },
    };
  }

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>
          Loading your favorites...
        </p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-6xl mb-4">⭐</div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: "var(--foreground)" }}
        >
          No Favorites Yet
        </h3>
        <p style={{ color: "var(--muted-foreground)" }}>
          Star prompts from any team to save them here for quick access
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <span className="text-lg">⭐</span>
          </div>
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              My Favorites
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {favorites.length} saved{" "}
              {favorites.length === 1 ? "prompt" : "prompts"}
            </p>
          </div>
        </div>
      </div>

      {/* Favorites List */}
      <div className="space-y-4">
        {favorites.map((favorite) => {
          const isExpanded = expandedFavorites[favorite.id];
          const visibilityBadge = getVisibilityBadge(
            favorite.visibility || "public"
          );

          return (
            <div
              key={favorite.id}
              className="glass-card p-6 transition-all duration-300 hover:border-primary/50"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3
                      className="text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {favorite.title}
                    </h3>
                    <span
                      style={visibilityBadge.style}
                      className="flex items-center gap-1"
                    >
                      {visibilityBadge.icon} {visibilityBadge.label}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span>Saved {formatDate(favorite.createdAt)}</span>
                    <span>•</span>
                    <span>{favorite.text?.length || 0} characters</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleCopy(favorite.text)}
                    className="p-2 rounded-lg transition-colors hover:scale-105"
                    style={{
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                    title="Copy to clipboard"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleRemoveFavorite(favorite)}
                    className="p-2 rounded-lg transition-colors hover:scale-105"
                    style={{
                      backgroundColor: "var(--destructive)",
                      color: "var(--destructive-foreground)",
                    }}
                    title="Remove from favorites"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => toggleExpanded(favorite.id)}
                    className="p-2 rounded-lg transition-colors hover:scale-105"
                    style={{
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Prompt Preview */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: "var(--muted)",
                  borderColor: "var(--border)",
                }}
              >
                <pre
                  className={`whitespace-pre-wrap text-sm font-mono ${
                    !isExpanded ? "line-clamp-3" : ""
                  }`}
                  style={{ color: "var(--foreground)" }}
                >
                  {favorite.text}
                </pre>
              </div>

              {/* Tags */}
              {favorite.tags && favorite.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {favorite.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 rounded-full text-xs font-medium border"
                      style={{
                        backgroundColor: "var(--secondary)",
                        color: "var(--secondary-foreground)",
                        borderColor: "var(--border)",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
