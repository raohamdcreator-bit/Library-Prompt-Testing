// src/components/MyInvites.jsx - FIXED: Better handling for existing team members
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function MyInvites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingInvites, setProcessingInvites] = useState(new Set());

  useEffect(() => {
    if (!user?.email) {
      setInvites([]);
      setLoading(false);
      return;
    }

    console.log("👀 MyInvites: Listening for invites for", user.email.toLowerCase());

    // Listen to global team-invites collection
    const invitesRef = collection(db, "team-invites");
    const q = query(
      invitesRef,
      where("email", "==", user.email.toLowerCase()),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("📨 MyInvites: Found", snapshot.docs.length, "pending invites");
        
        const allInvites = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Sort by creation date, newest first
        allInvites.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });

        setInvites(allInvites);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Error loading invites:", error);
        // Silently fail - user just won't see invites
        setInvites([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.email]);

  // Accept invite handler
  async function handleAccept(invite) {
    if (!invite?.teamId || !invite?.id) {
      console.error("Invalid invite data:", invite);
      showNotification("Invalid invitation data", "error");
      return;
    }

    const inviteKey = invite.id;
    setProcessingInvites((prev) => new Set(prev.add(inviteKey)));

    try {
      console.log("✅ Accepting invite:", invite.id, "for team:", invite.teamId);

      // ✅ STEP 1: Check if team exists and if user is already a member
      const teamRef = doc(db, "teams", invite.teamId);
      const teamDoc = await getDoc(teamRef);

      if (!teamDoc.exists()) {
        throw new Error("Team no longer exists. It may have been deleted.");
      }

      const teamData = teamDoc.data();

      // ✅ Check if user is already a member
      if (teamData.members && teamData.members[user.uid]) {
        console.log("ℹ️ User is already a member of this team");
        
        // Mark invite as accepted (cleanup)
        const inviteRef = doc(db, "team-invites", invite.id);
        await updateDoc(inviteRef, {
          status: "accepted",
          acceptedAt: new Date(),
          acceptedByUid: user.uid,
          note: "User was already a member",
        });

        showNotification(
          `You're already a member of "${invite.teamName}" as ${teamData.members[user.uid]}!`,
          "info"
        );

        // Remove from local state
        setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
        return;
      }

      // ✅ STEP 2: Add user to team and mark invite as accepted
      const batch = writeBatch(db);

      // Add user to team members
      batch.update(teamRef, {
        [`members.${user.uid}`]: invite.role || "member",
      });

      // Mark invite as accepted
      const inviteRef = doc(db, "team-invites", invite.id);
      batch.update(inviteRef, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUid: user.uid,
      });

      await batch.commit();

      console.log("✅ Successfully joined team:", invite.teamName);

      showNotification(
        `Successfully joined "${invite.teamName}" as ${
          invite.role || "member"
        }!`,
        "success"
      );

      // Remove from local state
      setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
    } catch (error) {
      console.error("❌ Error accepting invite:", error);

      let errorMessage = "Failed to accept invite. ";
      
      if (error.code === "permission-denied") {
        errorMessage += "You don't have permission to join this team.";
      } else if (error.code === "not-found") {
        errorMessage += "The team or invite no longer exists.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please try again.";
      }

      showNotification(errorMessage, "error");
    } finally {
      setProcessingInvites((prev) => {
        const newSet = new Set(prev);
        newSet.delete(inviteKey);
        return newSet;
      });
    }
  }

  // Reject invite handler
  async function handleReject(invite) {
    if (!invite?.teamId || !invite?.id) {
      console.error("Invalid invite data:", invite);
      showNotification("Invalid invitation data", "error");
      return;
    }

    const inviteKey = invite.id;
    setProcessingInvites((prev) => new Set(prev.add(inviteKey)));

    try {
      console.log("🚫 Rejecting invite:", invite.id);

      const inviteRef = doc(db, "team-invites", invite.id);
      await updateDoc(inviteRef, {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedByUid: user.uid,
      });

      showNotification("Invitation declined", "info");
      setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
    } catch (error) {
      console.error("❌ Error rejecting invite:", error);

      if (error.code !== "not-found") {
        showNotification(
          "Failed to decline invite. Please try again.",
          "error"
        );
      }
    } finally {
      setProcessingInvites((prev) => {
        const newSet = new Set(prev);
        newSet.delete(inviteKey);
        return newSet;
      });
    }
  }

  // Notification helper
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
      type === "error" ? "destructive" : type === "info" ? "primary" : "primary"
    })`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Unknown";
    try {
      return timestamp.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid date";
    }
  }

  function getRoleIcon(role) {
    switch (role) {
      case "admin":
        return "👑";
      case "owner":
        return "🔑";
      default:
        return "👤";
    }
  }

  function getRoleBadge(role) {
    const baseStyle = {
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "500",
      border: "1px solid var(--border)",
    };

    switch (role) {
      case "owner":
        return {
          ...baseStyle,
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground)",
        };
      case "admin":
        return {
          ...baseStyle,
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        };
      case "member":
        return {
          ...baseStyle,
          backgroundColor: "var(--secondary)",
          color: "var(--secondary-foreground)",
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: "var(--muted)",
          color: "var(--muted-foreground)",
        };
    }
  }

  // Don't render if no invites and not loading
  if (!loading && invites.length === 0) {
    return null;
  }

  return (
    <div
      className="p-6 border-t"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {loading ? (
        <div className="flex items-center gap-3">
          <div className="neo-spinner w-4 h-4"></div>
          <span
            className="text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            Checking for invitations...
          </span>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span style={{ color: "var(--primary-foreground)" }}>📬</span>
            </div>
            <div>
              <h3
                className="font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Team Invitations
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {invites.length} pending{" "}
                {invites.length === 1 ? "invitation" : "invitations"}
              </p>
            </div>
          </div>

          {/* Invites List */}
          <div className="space-y-3">
            {invites.map((invite) => {
              const isProcessing = processingInvites.has(invite.id);

              return (
                <div
                  key={invite.id}
                  className="glass-card p-4 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Team Info */}
                      <div className="flex items-center gap-2 mb-2">
                        <h4
                          className="font-semibold truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {invite.teamName}
                        </h4>
                        <span style={getRoleBadge(invite.role)}>
                          {getRoleIcon(invite.role)} {invite.role || "member"}
                        </span>
                      </div>

                      {/* Invite Details */}
                      <div
                        className="text-sm space-y-1"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {invite.inviterName && (
                          <p>
                            <span className="font-medium">Invited by:</span>{" "}
                            {invite.inviterName}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Received:</span>{" "}
                          {formatDate(invite.createdAt)}
                        </p>
                      </div>

                      {/* Role Description */}
                      <div
                        className="mt-2 p-2 rounded border text-xs"
                        style={{
                          backgroundColor: "var(--muted)",
                          borderColor: "var(--border)",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        <span className="font-medium">
                          As a {invite.role || "member"}, you'll be able to:{" "}
                        </span>
                        {invite.role === "admin"
                          ? "manage team members and all prompts"
                          : invite.role === "owner"
                          ? "have full control over the team"
                          : "create and manage your own prompts"}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleAccept(invite)}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1"
                        style={{
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                          opacity: isProcessing ? 0.5 : 1,
                        }}
                      >
                        {isProcessing && (
                          <div className="neo-spinner w-3 h-3"></div>
                        )}
                        Accept
                      </button>

                      <button
                        onClick={() => handleReject(invite)}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium border rounded-lg transition-all duration-200"
                        style={{
                          backgroundColor: "var(--secondary)",
                          color: "var(--secondary-foreground)",
                          borderColor: "var(--border)",
                          opacity: isProcessing ? 0.5 : 1,
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
