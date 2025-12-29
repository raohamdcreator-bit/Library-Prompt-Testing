// src/components/Favorites.jsx - Modernized with Professional Icons
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { toggleFavorite } from "../lib/prompts";
import { canViewPrompt } from "../lib/prompts";
import { 
  Star, Copy, Trash2, ChevronDown, ChevronUp, 
  Lock, Unlock, Tag, Calendar, CheckCircle, XCircle, Info
} from 'lucide-react';

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
      <Star
        size={size === "small" ? 20 : 24}
        fill={isFavorite ? "currentColor" : "none"}
        strokeWidth={2}
      />
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
    const icons = {
      success: <CheckCircle size={20} />,
      error: <XCircle size={20} />,
      info: <Info size={20} />
    };

    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
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
      icon: isPrivate ? Lock : Unlock,
      label: isPrivate ? "Private" : "Public",
      style: {
        padding: "4px 8px",
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
        <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--muted)' }}>
          <Star size={40} color="var(--muted-foreground)" />
        </div>
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
            <Star size={20} color="var(--accent-foreground)" />
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
          const VisibilityIcon = visibilityBadge.icon;

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
                      <VisibilityIcon size={12} />
                      {visibilityBadge.label}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      Saved {formatDate(favorite.createdAt)}
                    </span>
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
                    <Copy size={18} />
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
                    <Trash2 size={18} />
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
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
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
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border"
                      style={{
                        backgroundColor: "var(--secondary)",
                        color: "var(--secondary-foreground)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <Tag size={12} />
                      {tag}
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
