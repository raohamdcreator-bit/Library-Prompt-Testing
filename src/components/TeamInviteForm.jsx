// src/components/TeamInviteForm.jsx - Updated with Professional Icons
import { useState } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { Users, Mail, Send, UserPlus, Shield, Info, CheckCircle, X, Loader2 } from "lucide-react";

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const expiresAt = Timestamp.fromMillis(Date.now() + (7 * 24 * 60 * 60 * 1000));
      
      await addDoc(collection(db, "team-invites"), {
        teamId: teamId,
        teamName: teamName,
        email: email.trim().toLowerCase(),
        role: inviteRole,
        invitedBy: user.uid,
        inviterName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        status: "pending",
      });

      try {
        const inviteLink = `${window.location.origin}/join?teamId=${teamId}`;

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
          console.warn("Email sending failed, but invite was saved to database");
        }
      } catch (emailError) {
        console.warn(
          "Email service unavailable, but invite was saved:",
          emailError.message
        );
      }

      setEmail("");
      setInviteRole("member");

      showNotification(`Invite sent to ${email.trim()}! (Valid for 7 days)`, "success");
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

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");

    const icons = {
      success: "✓",
      error: "✗",
      info: "ℹ",
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

  if (role !== "owner" && role !== "admin") {
    return null;
  }

  const roleOptions = [
    {
      value: "member",
      label: "Member",
      description: "Can create and manage their own prompts",
      icon: UserPlus,
    },
    {
      value: "admin",
      label: "Admin",
      description: "Can manage team members and all prompts",
      icon: Shield,
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
          <Users className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
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

      <div className="space-y-6">
        {/* Email Input */}
        <div className="space-y-2">
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium flex items-center gap-2"
            style={{ color: "var(--foreground)" }}
          >
            <Mail className="w-4 h-4" />
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
          <p className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
            <Info className="w-3 h-3" />
            They'll receive an invitation to join your team (valid for 7 days)
          </p>
        </div>

        {/* Role Selection */}
        <div className="space-y-3">
          <label
            className="block text-sm font-medium flex items-center gap-2"
            style={{ color: "var(--foreground)" }}
          >
            <Shield className="w-4 h-4" />
            Role & Permissions
          </label>
          <div className="grid gap-3">
            {roleOptions.map((option) => {
              const Icon = option.icon;
              return (
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
                      <Icon className="w-4 h-4 text-cyan-400" />
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
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleInvite}
            disabled={loading || !email.trim()}
            className="btn-primary px-6 py-2.5 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Invite...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Invitation</span>
              </>
            )}
          </button>

          {email && !loading && (
            <button
              type="button"
              onClick={() => setEmail("")}
              className="btn-secondary px-4 py-2.5 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div
        className="mt-6 p-4 rounded-lg border"
        style={{
          backgroundColor: "var(--muted)",
          borderColor: "var(--border)",
        }}
      >
        <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
          <Info className="w-5 h-5 text-cyan-400" />
          How Invites Work:
        </h4>
        <div
          className="space-y-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Invitations are saved immediately to the database</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Users will see pending invites when they sign in with the invited email</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Email notifications are sent if the email service is configured</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Invites expire after 7 days and can be cancelled at any time</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Invites can be accepted or declined from the user's invite panel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
