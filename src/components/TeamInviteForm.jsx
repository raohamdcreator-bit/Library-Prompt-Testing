// src/components/TeamInviteForm.jsx - FIXED VERSION
import { useState } from "react";
import { db } from "../lib/firebase";
import { collection, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function TeamInviteForm({ teamId, teamName, role }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [loading, setLoading] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();

    if (!email.trim()) {
      alert("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // ✅ FIXED: Use consistent subcollection structure like other components
      await addDoc(collection(db, "teams", teamId, "invites"), {
        teamId: teamId, // Store teamId for easier querying
        teamName: teamName,
        email: email.trim().toLowerCase(),
        role: inviteRole,
        invitedBy: user.uid,
        inviterName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        status: "pending",
      });

      // ✅ Optional: Try to send email, but don't fail if unavailable
      try {
        const inviteLink = `${
          window.location.origin
        }/join?teamId=${teamId}&inviteId=${Date.now()}`;

        const response = await fetch("/api/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email.trim(),
            link: inviteLink,
            teamName,
            invitedBy: user.displayName || user.email,
            role: inviteRole,
          }),
        });

        if (!response.ok) {
          console.warn(
            "Email sending failed, but invite was saved to database"
          );
        }
      } catch (emailError) {
        console.warn(
          "Email service unavailable, but invite was saved:",
          emailError.message
        );
        // Don't throw error - invite was still created successfully
      }

      setEmail("");
      setInviteRole("member");

      // Show success message
      showNotification(`Invite sent to ${email.trim()}!`, "success");
    } catch (err) {
      console.error("Error sending invite:", err);

      let errorMessage = "Failed to send invite: ";
      if (err.code === "permission-denied") {
        errorMessage +=
          "You don't have permission to send invites for this team.";
      } else if (err.code === "invalid-argument") {
        errorMessage += "Invalid email address or team data.";
      } else {
        errorMessage += err.message || "Unknown error";
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Helper function for notifications
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");

    const icons = {
      success: "✅",
      error: "❌",
      info: "ℹ️",
    };

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${icons[type]}</span>
        <span>${message}</span>
      </div>
    `;

    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${type === "error" ? "destructive" : "primary"});
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

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

  // Only owner/admin can invite
  if (role !== "owner" && role !== "admin") {
    return null;
  }

  const roleOptions = [
    {
      value: "member",
      label: "Member",
      description: "Can create and manage their own prompts",
      icon: "👤",
    },
    {
      value: "admin",
      label: "Admin",
      description: "Can manage team members and all prompts",
      icon: "👑",
    },
  ];

  return (
    <div
      className="glass-card p-6 mt-8"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--primary)" }}
        >
          <span style={{ color: "var(--primary-foreground)" }}>👥</span>
        </div>
        <div>
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Invite Team Member
          </h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Add a new member to <strong>{teamName}</strong>
          </p>
        </div>
      </div>

      <form onSubmit={handleInvite} className="space-y-6">
        {/* Email Input */}
        <div className="space-y-2">
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Email Address *
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="colleague@company.com"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            They'll receive an invitation to join your team
          </p>
        </div>

        {/* Role Selection */}
        <div className="space-y-3">
          <label
            className="block text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Role & Permissions
          </label>
          <div className="grid gap-3">
            {roleOptions.map((option) => (
              <label
                key={option.value}
                className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  inviteRole === option.value
                    ? "border-primary"
                    : "border-border hover:border-primary/50"
                }`}
                style={{
                  borderColor:
                    inviteRole === option.value
                      ? "var(--primary)"
                      : "var(--border)",
                  backgroundColor:
                    inviteRole === option.value
                      ? "var(--secondary)"
                      : "transparent",
                }}
              >
                <input
                  type="radio"
                  value={option.value}
                  checked={inviteRole === option.value}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1 w-4 h-4"
                  style={{ accentColor: "var(--primary)" }}
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{option.icon}</span>
                    <span
                      className="font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {option.label}
                    </span>
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="btn-primary px-6 py-2.5 flex items-center gap-2"
          >
            {loading && <div className="neo-spinner w-4 h-4"></div>}
            <span>{loading ? "Sending Invite..." : "Send Invitation"}</span>
          </button>

          {email && !loading && (
            <button
              type="button"
              onClick={() => setEmail("")}
              className="btn-secondary px-4 py-2.5"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Info Section */}
      <div
        className="mt-6 p-4 rounded-lg border"
        style={{
          backgroundColor: "var(--muted)",
          borderColor: "var(--border)",
        }}
      >
        <h4 className="font-medium mb-3" style={{ color: "var(--foreground)" }}>
          ℹ️ How Invites Work:
        </h4>
        <div
          className="space-y-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <div>• Invitations are saved immediately to the database</div>
          <div>
            • Users will see pending invites when they sign in with the invited
            email
          </div>
          <div>
            • Email notifications are sent if the email service is configured
          </div>
          <div>
            • Invites can be accepted or declined from the user's invite panel
          </div>
        </div>
      </div>
    </div>
  );
}
