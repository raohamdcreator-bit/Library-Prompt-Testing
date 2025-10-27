// src/components/MyInvites.jsx - FIXED with expiration handling
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
  Timestamp,
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

    const normalizedEmail = user.email.toLowerCase();
    console.log("👀 MyInvites: Listening for invites for", normalizedEmail);

    const invitesRef = collection(db, "team-invites");
    const q = query(
      invitesRef,
      where("email", "==", normalizedEmail),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("📨 MyInvites: Found", snapshot.docs.length, "pending invites");

        const now = Timestamp.now();
        const allInvites = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((invite) => {
            // ✅ Filter out expired invites
            if (invite.expiresAt && invite.expiresAt.toMillis() < now.toMillis()) {
              console.log("⏰ Filtering out expired invite:", invite.id);
              return false;
            }
            return true;
          });

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
        setInvites([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.email]);

  // ✅ Accept invite with transaction to prevent race conditions
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

      // ✅ Use transaction for atomic operation
      await runTransaction(db, async (transaction) => {
        const teamRef = doc(db, "teams", invite.teamId);
        const teamDoc = await transaction.get(teamRef);

        if (!teamDoc.exists()) {
          throw new Error("Team no longer exists. It may have been deleted.");
        }

        const teamData = teamDoc.data();

        // Check if user is already a member
        if (teamData.members && teamData.members[user.uid]) {
          console.log("ℹ️ User is already a member of this team");
          
          // Mark invite as accepted (cleanup)
          const inviteRef = doc(db, "team-invites", invite.id);
          transaction.update(inviteRef, {
            status: "accepted",
            acceptedAt: Timestamp.now(),
            acceptedByUid: user.uid,
            note: "User was already a member",
          });

          showNotification(
            `You're already a member of "${invite.teamName}" as ${teamData.members[user.uid]}!`,
            "info"
          );
          return;
        }

        // Check if invite has expired
        const now = Timestamp.now();
        if (invite.expiresAt && invite.expiresAt.toMillis() < now.toMillis()) {
          throw new Error("This invitation has expired. Please request a new one.");
        }

        // Add user to team members
        transaction.update(teamRef, {
          [`members.${user.uid}`]: invite.role || "member",
        });

        // Mark invite as accepted
        const inviteRef = doc(db, "team-invites", invite.id);
        transaction.update(inviteRef, {
          status: "accepted",
          acceptedAt: Timestamp.now(),
          acceptedByUid: user.uid,
        });
      });

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

      await runTransaction(db, async (transaction) => {
        const inviteRef = doc(db, "team-invites", invite.id);
        transaction.update(inviteRef, {
          status: "rejected",
          rejectedAt: Timestamp.now(),
          rejectedByUid: user.uid,
        });
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
    const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };

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
      type === "error" ? "destructive" : type === "warning" ? "accent" : "primary"
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

  function getTimeRemaining(expiresAt) {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expiry = expiresAt.toDate();
    const diff = expiry - now;
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} remaining`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    return "Less than 1 hour remaining";
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
              const timeRemaining = getTimeRemaining(invite.expiresAt);
              const isExpiringSoon = invite.expiresAt && 
                (invite.expiresAt.toMillis() - Date.now()) < 24 * 60 * 60 * 1000;

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
                        {timeRemaining && (
                          <p className={isExpiringSoon ? "text-orange-500 font-medium" : ""}>
                            <span className="font-medium">⏰ {timeRemaining}</span>
                          </p>
                        )}
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
          </div>

          {/* Footer Note */}
          <div
            className="mt-4 p-3 rounded-lg text-xs flex items-start gap-2"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <span>💡</span>
            <p>
              Accepting an invitation will give you immediate access to the
              team's prompt library. Invitations expire after 7 days. You can leave teams at any time from the
              team settings.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
