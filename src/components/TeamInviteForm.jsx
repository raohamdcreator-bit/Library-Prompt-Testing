// src/components/TeamInviteForm.jsx - Updated with Link Invite Support + NotificationContext
import { useState, forwardRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { 
  Users, Mail, Send, UserPlus, Shield, Info, CheckCircle, X, Loader2,
  Link as LinkIcon, Copy, Check, Sparkles
} from "lucide-react";
import { sendTeamInvitation, generateTeamInviteLink } from "../lib/inviteUtils";

const TeamInviteForm = forwardRef(({ teamId, teamName, role }, ref) => {
  const { user } = useAuth();
  const { success, error: showError, info } = useNotification();
  const [inviteType, setInviteType] = useState("link"); // Default to link (more prominent)
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleEmailInvite(e) {
    e.preventDefault();

    if (!email.trim()) {
      showError("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const result = await sendTeamInvitation({
        teamId,
        teamName,
        email: email.trim(),
        role: inviteRole,
        invitedBy: user.uid,
        inviterName: user.displayName || user.email,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Track in GA4
      if (window.gtag) {
        window.gtag('event', 'team_invited_email', {
          team_id: teamId,
          team_name: teamName,
          invited_role: inviteRole,
          invited_by: user.uid,
          email_sent: result.emailSent,
        });
      }

      setEmail("");
      setInviteRole("member");

      success(
        `Invite sent to ${email.trim()}! ${result.emailSent ? 'Email delivered.' : 'Saved to database.'}`,
        4000
      );
    } catch (err) {
      console.error("Error sending invite:", err);

      let errorMessage = "Failed to send invite: ";
      if (err.message.includes("already exists")) {
        errorMessage = "An active invitation already exists for this email.";
      } else if (err.message.includes("maximum")) {
        errorMessage = err.message;
      } else {
        errorMessage += err.message || "Unknown error";
      }

      showError(errorMessage, 5000);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLink(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await generateTeamInviteLink({
        teamId,
        teamName,
        role: inviteRole,
        invitedBy: user.uid,
        inviterName: user.displayName || user.email,
        expiresInDays: 7,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Track in GA4
      if (window.gtag) {
        window.gtag('event', 'invite_link_generated', {
          team_id: teamId,
          team_name: teamName,
          role: inviteRole,
          invited_by: user.uid,
          expires_in_days: 7,
        });
      }

      setGeneratedLink({
        url: result.inviteLink,
        token: result.token,
        inviteId: result.inviteId,
        expiresAt: result.expiresAt,
      });

      success("Invite link generated successfully!", 3000);
    } catch (err) {
      console.error("Error generating invite link:", err);

      let errorMessage = "Failed to generate invite link: ";
      if (err.message.includes("maximum")) {
        errorMessage = err.message;
      } else {
        errorMessage += err.message || "Unknown error";
      }

      showError(errorMessage, 5000);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink.url);
      setCopied(true);
      success("Link copied to clipboard!", 2000);
      
      // Track in GA4
      if (window.gtag) {
        window.gtag('event', 'invite_link_copied', {
          team_id: teamId,
        });
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      showError("Failed to copy link. Please copy it manually.", 3000);
    }
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
      ref={ref}
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
        {/* Invite Type Selection */}
        <div className="space-y-3">
          <label
            className="block text-sm font-medium flex items-center gap-2"
            style={{ color: "var(--foreground)" }}
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Invite Method
          </label>
          
          <div className="grid gap-3">
            {/* Link Invite Option (Prominent) */}
            <label
              className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                inviteType === "link"
                  ? "border-primary"
                  : "border-border hover:border-primary/50"
              }`}
              style={{
                borderColor:
                  inviteType === "link"
                    ? "var(--primary)"
                    : "var(--border)",
                backgroundColor:
                  inviteType === "link"
                    ? "rgba(139, 92, 246, 0.08)"
                    : "transparent",
              }}
            >
              <input
                type="radio"
                value="link"
                checked={inviteType === "link"}
                onChange={(e) => {
                  setInviteType(e.target.value);
                  setGeneratedLink(null);
                }}
                className="mt-1 w-4 h-4"
                style={{ accentColor: "var(--primary)" }}
                disabled={loading}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <LinkIcon className="w-4 h-4 text-cyan-400" />
                  <span
                    className="font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    Invite via Link (Recommended)
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.15)",
                      color: "var(--primary)",
                    }}
                  >
                    ✨ Easy Share
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Generate a shareable link that anyone can use to join. Perfect for Slack, Discord, or quick sharing.
                </p>
              </div>
            </label>

            {/* Email Invite Option */}
            <label
              className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                inviteType === "email"
                  ? "border-primary"
                  : "border-border hover:border-primary/50"
              }`}
              style={{
                borderColor:
                  inviteType === "email"
                    ? "var(--primary)"
                    : "var(--border)",
                backgroundColor:
                  inviteType === "email"
                    ? "var(--secondary)"
                    : "transparent",
              }}
            >
              <input
                type="radio"
                value="email"
                checked={inviteType === "email"}
                onChange={(e) => {
                  setInviteType(e.target.value);
                  setGeneratedLink(null);
                }}
                className="mt-1 w-4 h-4"
                style={{ accentColor: "var(--primary)" }}
                disabled={loading}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span
                    className="font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    Invite via Email
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Send a personalized invitation to a specific email address
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Email Input (only for email invites) */}
        {inviteType === "email" && (
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
        )}

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

        {/* Generated Link Display */}
        {generatedLink && inviteType === "link" && (
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "rgba(139, 92, 246, 0.05)",
              borderColor: "var(--primary)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>
                Invite Link Generated!
              </span>
            </div>
            <div
              className="p-3 rounded-lg mb-3 flex items-center gap-2"
              style={{
                backgroundColor: "var(--muted)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.813rem",
                wordBreak: "break-all",
              }}
            >
              <code style={{ flex: 1, color: "var(--foreground)" }}>
                {generatedLink.url}
              </code>
              <button
                onClick={copyToClipboard}
                className="action-btn-premium flex-shrink-0"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              <Info className="w-3 h-3 inline mr-1" />
              This link expires on {generatedLink.expiresAt.toLocaleDateString()} at {generatedLink.expiresAt.toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {inviteType === "email" ? (
            <>
              <button
                onClick={handleEmailInvite}
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
                    <span>Send Email Invitation</span>
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
            </>
          ) : (
            <button
              onClick={handleGenerateLink}
              disabled={loading || generatedLink}
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Link...</span>
                </>
              ) : generatedLink ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Link Generated</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  <span>Generate Invite Link</span>
                </>
              )}
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
            <span><strong>Link invites:</strong> Anyone with the link can join (no email required)</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span><strong>Email invites:</strong> Sent to specific email addresses only</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>All invites expire after 7 days and can be revoked at any time</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Users must sign in with Google to accept invitations</span>
          </div>
        </div>
      </div>
    </div>
  );
});

TeamInviteForm.displayName = 'TeamInviteForm';

export default TeamInviteForm;
