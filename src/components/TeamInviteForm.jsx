// src/components/TeamInviteForm.jsx - FIXED: Proper team ID tracking and reset
import { useState, forwardRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { 
  Users, Mail, Send, UserPlus, Shield, Info, CheckCircle, X, Loader2,
  Link as LinkIcon, Copy, Check, Sparkles, Eye, Lock, Star, MessageSquare
} from "lucide-react";
import { sendTeamInvitation, generateTeamInviteLink } from "../lib/inviteUtils";
import { generateGuestAccessLink } from "../lib/guestTeamAccess";

const TeamInviteForm = forwardRef(({ teamId, teamName, role }, ref) => {
  const { user } = useAuth();
  const { success, error: showError, info } = useNotification();
  const { playNotification } = useSoundEffects();
  
  const [inviteType, setInviteType] = useState("guest-link");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  // ✅ CRITICAL FIX: Reset form state when team changes
  useEffect(() => {
    console.log('🔄 Team changed, resetting form:', { teamId, teamName });
    
    // Reset all form state
    setInviteType("guest-link");
    setEmail("");
    setInviteRole("member");
    setLoading(false);
    setGeneratedLink(null);
    setCopied(false);
  }, [teamId]); // Reset whenever teamId changes

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
      console.log('📧 Sending email invite:', { teamId, teamName, email, inviteRole });
      
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
      playNotification();
      
      success(
        `Invite sent to ${email.trim()}! ${result.emailSent ? 'Email delivered.' : 'Saved to database.'}`,
        4000
      );
    } catch (err) {
      console.error("❌ Error sending invite:", err);

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

  async function handleGenerateAuthLink(e) {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔗 Generating auth invite link:', { teamId, teamName, inviteRole });
      
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

      if (window.gtag) {
        window.gtag('event', 'auth_invite_link_generated', {
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
        type: "auth",
      });

      playNotification();
      success("Full access invite link generated successfully!", 3000);
    } catch (err) {
      console.error("❌ Error generating auth invite link:", err);

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

  async function handleGenerateGuestLink(e) {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('👁️ Generating guest access link:', { teamId, teamName });
      
      const result = await generateGuestAccessLink({
        teamId,
        teamName,
        createdBy: user.uid,
        creatorName: user.displayName || user.email,
        expiresInDays: 30,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('✅ Guest access link generated:', result.accessLink);

      if (window.gtag) {
        window.gtag('event', 'guest_access_link_generated', {
          team_id: teamId,
          team_name: teamName,
          created_by: user.uid,
          expires_in_days: 30,
        });
      }

      setGeneratedLink({
        url: result.accessLink,
        token: result.accessToken,
        expiresAt: result.expiresAt,
        type: "guest",
      });

      playNotification();
      success("Guest access link generated successfully!", 3000);
    } catch (err) {
      console.error("❌ Error generating guest access link:", err);

      let errorMessage = "Failed to generate guest link: ";
      errorMessage += err.message || "Unknown error";

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
      playNotification();
      success("Link copied to clipboard!", 2000);
      
      if (window.gtag) {
        window.gtag('event', 'invite_link_copied', {
          team_id: teamId,
          link_type: generatedLink.type,
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
      key={`invite-form-${teamId}`} // ✅ CRITICAL: Force re-render on team change
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
            Invite to Team
          </h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Share <strong>{teamName}</strong> with others
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
            {/* Guest Link Option */}
            <label
              className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                inviteType === "guest-link"
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
              style={{
                borderColor:
                  inviteType === "guest-link"
                    ? "var(--primary)"
                    : "var(--border)",
                backgroundColor:
                  inviteType === "guest-link"
                    ? "rgba(139, 92, 246, 0.08)"
                    : "transparent",
              }}
            >
              <input
                type="radio"
                value="guest-link"
                checked={inviteType === "guest-link"}
                onChange={(e) => {
                  setInviteType(e.target.value);
                  setGeneratedLink(null);
                }}
                className="mt-1 w-4 h-4"
                style={{ accentColor: "var(--primary)" }}
                disabled={loading}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span
                    className="font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    Guest Link (Read-Only)
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.15)",
                      color: "rgb(34, 197, 94)",
                    }}
                  >
                     Instant Access
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.15)",
                      color: "var(--primary)",
                    }}
                  >
                     No Sign-up
                  </span>
                </div>
                <p
                  className="text-sm mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Perfect for sharing with anyone! No account required. Users can view, copy, comment, and rate prompts instantly.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="w-3 h-3" /> View & Copy
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <MessageSquare className="w-3 h-3" /> Comment
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <Star className="w-3 h-3" /> Rate
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <Lock className="w-3 h-3" /> Can't Edit
                  </span>
                </div>
              </div>
            </label>

            {/* Full Access Link Option */}
            <label
              className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                inviteType === "auth-link"
                  ? "border-primary"
                  : "border-border hover:border-primary/50"
              }`}
              style={{
                borderColor:
                  inviteType === "auth-link"
                    ? "var(--primary)"
                    : "var(--border)",
                backgroundColor:
                  inviteType === "auth-link"
                    ? "rgba(139, 92, 246, 0.08)"
                    : "transparent",
              }}
            >
              <input
                type="radio"
                value="auth-link"
                checked={inviteType === "auth-link"}
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
                    Full Access Link
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.15)",
                      color: "var(--primary)",
                    }}
                  >
                    Sign-up Required
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Share with people who need full access. They'll sign in with Google and become team members with the role you select.
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
                    Email Invite
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.15)",
                      color: "var(--primary)",
                    }}
                  >
                    Sign-up Required
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

        {/* Email Input */}
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
        {(inviteType === "auth-link" || inviteType === "email") && (
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
        )}

        {/* Generated Link Display */}
        {generatedLink && (
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
                {generatedLink.type === "guest" 
                  ? "Guest Access Link Generated!" 
                  : "Invite Link Generated!"}
              </span>
            </div>
            
            {generatedLink.type === "guest" && (
              <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                Anyone with this link can view your team's prompts in read-only mode. No sign-up required!
              </p>
            )}
            
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
                    <span>Sending...</span>
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
          ) : inviteType === "guest-link" ? (
            <button
              onClick={handleGenerateGuestLink}
              disabled={loading || generatedLink}
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : generatedLink ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Link Generated</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Generate Guest Link</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleGenerateAuthLink}
              disabled={loading || generatedLink}
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : generatedLink ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Link Generated</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  <span>Generate Full Access Link</span>
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
          How It Works:
        </h4>
        <div
          className="space-y-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <div className="flex items-start gap-2">
            <Eye className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span><strong>Guest Link:</strong> Instant read-only access. Perfect for clients, stakeholders, or anyone who needs to view prompts without signing up.</span>
          </div>
          <div className="flex items-start gap-2">
            <LinkIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span><strong>Full Access Link:</strong> Requires Google sign-in. New users become team members with the role you select.</span>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <span><strong>Email Invite:</strong> Personalized invite sent to a specific email address. Also requires sign-in.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>All links expire automatically (7-30 days) and can be revoked anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
});

TeamInviteForm.displayName = 'TeamInviteForm';

export default TeamInviteForm;
