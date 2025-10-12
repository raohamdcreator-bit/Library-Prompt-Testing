// src/components/Favorites.jsx - FIXED VERSION
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// Hook: useFavorites
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userFavoritesRef = collection(db, "users", user.uid, "favorites");

    const unsub = onSnapshot(
      userFavoritesRef,
      (snap) => {
        const favs = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        favs.sort(
          (a, b) => (b.addedAt?.toMillis() || 0) - (a.addedAt?.toMillis() || 0)
        );

        setFavorites(favs);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading favorites:", error);
        setFavorites([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // ✅ FIXED: Get team name if missing
  async function getTeamName(teamId) {
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      if (teamDoc.exists()) {
        return teamDoc.data().name || "Unknown Team";
      }
      return "Unknown Team";
    } catch (error) {
      console.error("Error fetching team name:", error);
      return "Unknown Team";
    }
  }

  async function addToFavorites(prompt, teamId, teamName) {
    if (!user || !prompt) {
      console.error("Cannot add favorite: missing user or prompt");
      return;
    }

    // ✅ FIXED: Fetch team name if not provided
    let finalTeamName = teamName;
    if (!finalTeamName && teamId) {
      finalTeamName = await getTeamName(teamId);
    }

    // ✅ FIXED: Validate all required fields
    const favoriteData = {
      promptId: prompt.id || null,
      teamId: teamId || null,
      teamName: finalTeamName || "Unknown Team",
      title: prompt.title || "Untitled Prompt",
      text: prompt.text || "",
      tags: Array.isArray(prompt.tags) ? prompt.tags : [],
      originalAuthor: prompt.createdBy || null,
      addedAt: serverTimestamp(),
      originalCreatedAt: prompt.createdAt || null,
    };

    console.log("Adding favorite:", favoriteData);

    try {
      const favoriteRef = doc(db, "users", user.uid, "favorites", prompt.id);
      await setDoc(favoriteRef, favoriteData);
    } catch (error) {
      console.error("Error adding favorite:", error);
      throw error;
    }
  }

  async function removeFromFavorites(favoriteId) {
    if (!user || !favoriteId) return;
    
    try {
      const favoriteRef = doc(db, "users", user.uid, "favorites", favoriteId);
      await deleteDoc(favoriteRef);
    } catch (error) {
      console.error("Error removing favorite:", error);
      throw error;
    }
  }

  async function toggleFavorite(prompt, teamId, teamName) {
    if (!prompt) return;

    const exists = favorites.some((f) => f.id === prompt.id);
    if (exists) {
      await removeFromFavorites(prompt.id);
    } else {
      await addToFavorites(prompt, teamId, teamName);
    }
  }

  return {
    favorites,
    loading,
    isFavorite: (promptId) => favorites.some((f) => f.id === promptId),
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
  };
}

// Component: FavoriteButton
export function FavoriteButton({
  prompt,
  teamId,
  teamName,
  size = "normal",
  className = "",
}) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  if (!user) return null;

  async function handleToggle(e) {
    e.stopPropagation();
    if (isToggling || !prompt) return;

    setIsToggling(true);
    try {
      // ✅ FIXED: Ensure user profile exists
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          name: user.displayName || "",
          email: user.email || "",
          avatar: user.photoURL || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await toggleFavorite(prompt, teamId, teamName);

      const action = isFavorite(prompt.id) ? "removed from" : "added to";
      const toast = document.createElement("div");
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <span>${isFavorite(prompt.id) ? "💔" : "⭐"}</span>
          <span>Prompt ${action} favorites!</span>
        </div>
      `;
      toast.className =
        "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm";
      toast.style.backgroundColor = "var(--card)";
      toast.style.color = "var(--foreground)";
      toast.style.border = "1px solid var(--primary)";
      document.body.appendChild(toast);
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    } catch (error) {
      console.error("Error updating favorites:", error);
      alert("Failed to update favorites. Please try again.");
    } finally {
      setIsToggling(false);
    }
  }

  const isFav = isFavorite(prompt.id);
  const sizeClass = size === "small" ? "p-1.5" : "p-2";

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`rounded-lg transition-all duration-200 ${sizeClass} ${className} ${
        isFav
          ? "text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20"
          : "hover:bg-gray-100/10"
      }`}
      style={{
        color: isFav ? "#fbbf24" : "var(--muted-foreground)",
      }}
      title={isFav ? "Remove from favorites" : "Add to favorites"}
    >
      {isToggling ? (
        <div className="neo-spinner w-4 h-4"></div>
      ) : (
        <span className="text-lg">{isFav ? "★" : "☆"}</span>
      )}
    </button>
  );
}

// Component: FavoritesList
export default function FavoritesList() {
  const { user } = useAuth();
  const { favorites, loading, removeFromFavorites } = useFavorites();
  const [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState("");

  // Load author profiles
  useEffect(() => {
    async function fetchProfiles() {
      const authorIds = [
        ...new Set(favorites.map((f) => f.originalAuthor).filter(Boolean)),
      ];
      const profilesData = {};

      for (const authorId of authorIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", authorId));
          if (userDoc.exists()) {
            profilesData[authorId] = userDoc.data();
          }
        } catch (error) {
          console.error("Error loading author profile:", error);
        }
      }

      setProfiles(profilesData);
    }

    if (favorites.length > 0) fetchProfiles();
  }, [favorites]);

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      const toast = document.createElement("div");
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <span>📋</span>
          <span>Prompt copied to clipboard!</span>
        </div>
      `;
      toast.className =
        "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm";
      toast.style.backgroundColor = "var(--card)";
      toast.style.color = "var(--foreground)";
      toast.style.border = "1px solid var(--primary)";
      document.body.appendChild(toast);
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy to clipboard.");
    }
  }

  const filteredFavorites = favorites.filter((favorite) => {
    if (!search.trim()) return true;
    return (
      favorite.title?.toLowerCase().includes(search.toLowerCase()) ||
      favorite.text?.toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(favorite.tags) &&
        favorite.tags.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase())
        ))
    );
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <span
              className="text-lg"
              style={{ color: "var(--primary-foreground)" }}
            >
              ⭐
            </span>
          </div>
          <div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              My Favorites
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {favorites.length} {favorites.length === 1 ? "prompt" : "prompts"}{" "}
              saved across all teams
            </p>
          </div>
        </div>

        {/* Search */}
        {favorites.length > 0 && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search your favorites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredFavorites.length === 0 ? (
        <div className="glass-card p-12 text-center">
          {favorites.length === 0 ? (
            <>
              <div className="text-6xl mb-4">⭐</div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                No favorites yet
              </h3>
              <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
                Click the star icon on any prompt to save it to your favorites
              </p>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: "var(--secondary)",
                  borderColor: "var(--border)",
                  color: "var(--muted-foreground)",
                }}
              >
                <span>💡</span>
                <span className="text-sm">
                  Favorites sync across all your teams
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">🔍</div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                No matching favorites
              </h3>
              <p style={{ color: "var(--muted-foreground)" }}>
                Try adjusting your search terms
              </p>
            </>
          )}
        </div>
      ) : (
        /* Favorites Grid */
        <div className="grid gap-4">
          {filteredFavorites.map((favorite) => {
            const author = profiles[favorite.originalAuthor];

            return (
              <div
                key={favorite.id}
                className="glass-card p-6 hover:border-primary/50 transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-lg mb-2"
                      style={{ color: "var(--foreground)" }}
                    >
                      {favorite.title}
                    </h3>
                    <div
                      className="flex items-center gap-3 text-xs flex-wrap"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <div className="flex items-center gap-1">
                        <span>🏢</span>
                        <span>{favorite.teamName || "Unknown Team"}</span>
                      </div>
                      {author && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <span>👤</span>
                            <span>{author.name || author.email}</span>
                          </div>
                        </>
                      )}
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <span>📅</span>
                        <span>Saved: {formatDate(favorite.addedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => copyToClipboard(favorite.text)}
                      className="p-2 rounded-lg transition-colors"
                      style={{
                        backgroundColor: "var(--secondary)",
                        color: "var(--foreground)",
                      }}
                      title="Copy to clipboard"
                    >
                      📋
                    </button>

                    <button
                      onClick={() => removeFromFavorites(favorite.id)}
                      className="p-2 rounded-lg transition-colors"
                      style={{
                        backgroundColor: "var(--destructive)",
                        color: "var(--destructive-foreground)",
                      }}
                      title="Remove from favorites"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <div
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: "var(--muted)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <pre
                      className="whitespace-pre-wrap text-sm leading-relaxed font-mono"
                      style={{ color: "var(--foreground)" }}
                    >
                      {favorite.text}
                    </pre>
                  </div>
                </div>

                {/* Tags */}
                {favorite.tags && favorite.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
      )}

      {/* Footer Stats */}
      {favorites.length > 0 && (
        <div className="glass-card p-4">
          <div
            className="flex items-center justify-between text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span>
              {filteredFavorites.length} of {favorites.length} favorites shown
            </span>
            <span>
              Across {new Set(favorites.map((f) => f.teamId)).size} teams
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
