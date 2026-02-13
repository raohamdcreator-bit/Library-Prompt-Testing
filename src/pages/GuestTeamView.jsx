// src/pages/GuestTeamView.jsx - FIXED: Ensure sessionStorage write completes before redirect
import { useEffect, useState } from "react";
import {
  validateGuestAccessToken,
  setGuestAccess,
} from "../lib/guestTeamAccess";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
  Users,
  Sparkles,
  Shield,
  Copy,
  MessageSquare,
  Star,
  LogIn,
  AlertTriangle,
  Clock,
} from "lucide-react";

export default function GuestTeamView({ onNavigate }) {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Validating access link...");
  const [teamData, setTeamData] = useState(null);

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No access token provided in URL");
      return;
    }

    validateAndRedirect();
  }, [token]);

  async function validateAndRedirect() {
    try {
      setStatus("loading");
      setMessage("Validating your access link...");

      console.log("🔍 [GUEST TEAM VIEW] Validating token:", token);

      // Validate the token
      const validation = await validateGuestAccessToken(token);

      console.log("✅ [GUEST TEAM VIEW] Validation result:", validation);

      if (!validation.valid) {
        throw new Error(validation.error || "Invalid access link");
      }

      // ✅ CRITICAL FIX: Store guest access in session with EXPLICIT write
      console.log("💾 [GUEST TEAM VIEW] Storing guest access in sessionStorage");
      
      // Store each item individually with verification
      sessionStorage.setItem("guest_team_token", validation.token);
      sessionStorage.setItem("guest_team_id", validation.teamId);
      sessionStorage.setItem("guest_team_permissions", JSON.stringify(validation.permissions));
      sessionStorage.setItem("is_guest_mode", "true");
      
      // ✅ VERIFY WRITE COMPLETED
      const storedToken = sessionStorage.getItem("guest_team_token");
      const storedTeamId = sessionStorage.getItem("guest_team_id");
      const storedPermissions = sessionStorage.getItem("guest_team_permissions");
      
      console.log("✅ [GUEST TEAM VIEW] Verification - Data stored:", {
        token: storedToken ? "✓" : "✗",
        teamId: storedTeamId ? "✓" : "✗",
        permissions: storedPermissions ? "✓" : "✗",
      });

      // Store team data for display
      setTeamData({
        teamId: validation.teamId,
        teamName: validation.teamName,
        permissions: validation.permissions,
        expiresAt: validation.expiresAt,
        token: validation.token,
      });

      setStatus("success");
      setMessage(`Access granted to ${validation.teamName}!`);

      // Track in GA4
      if (window.gtag) {
        window.gtag("event", "guest_team_access", {
          team_id: validation.teamId,
          team_name: validation.teamName,
        });
      }

      // ✅ CRITICAL FIX: Use longer delay to ensure storage write completes
      console.log("⏰ [GUEST TEAM VIEW] Starting redirect countdown (3 seconds)...");
      
      setTimeout(() => {
        console.log("🚀 [GUEST TEAM VIEW] Redirecting to home...");
        
        // ✅ FIXED: Always use full page reload to ensure App.jsx reinitializes
        window.location.href = "/";
      }, 3000);

    } catch (err) {
      console.error("❌ [GUEST TEAM VIEW] Error validating access:", err);
      setStatus("error");

      if (err.message.includes("expired")) {
        setMessage(
          "This access link has expired. Please request a new one from your team admin."
        );
      } else if (err.message.includes("deactivated")) {
        setMessage(
          "This access link has been deactivated. Please contact your team admin."
        );
      } else if (err.message.includes("Invalid")) {
        setMessage(
          "This access link is invalid. Please check the URL or request a new link."
        );
      } else {
        setMessage(
          err.message || "Failed to validate access. Please try again."
        );
      }
    }
  }

  function handleSignUp() {
    console.log("📝 [GUEST TEAM VIEW] Redirecting to signup...");
    if (onNavigate) {
      onNavigate("/");
    } else {
      window.location.href = "/";
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "loading":
        return "text-blue-600 dark:text-blue-400";
      case "success":
        return "text-green-600 dark:text-green-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "loading":
        return <Loader2 className="w-12 h-12 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-12 h-12" />;
      case "error":
        return <XCircle className="w-12 h-12" />;
      default:
        return <Eye className="w-12 h-12" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case "loading":
        return "Validating Access";
      case "success":
        return "Access Granted!";
      case "error":
        return "Access Denied";
      default:
        return "Team Access";
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="glass-card p-8 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="text-center">
          {/* Status Icon */}
          <div className={`flex justify-center mb-4 ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>

          {/* Title */}
          <h2
            className="text-2xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            {getTitle()}
          </h2>

          {/* Message */}
          <p className={`mb-6 ${getStatusColor()}`}>{message}</p>

          {/* Success State - Show Access Details */}
          {status === "success" && teamData && (
            <>
              <div
                className="mb-6 p-4 rounded-lg"
                style={{
                  backgroundColor: "var(--muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="space-y-3">
                  {/* Team Name */}
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Users
                      className="w-5 h-5"
                      style={{ color: "var(--primary)" }}
                    />
                    <span
                      className="text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {teamData.teamName}
                    </span>
                  </div>

                  {/* Guest Mode Badge */}
                  <div
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.1)",
                      border: "1px solid rgba(139, 92, 246, 0.3)",
                    }}
                  >
                    <Eye className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--primary)" }}
                    >
                      Guest Access • Read-Only Mode
                    </span>
                  </div>

                  {/* Permissions */}
                  <div className="mt-4 space-y-2">
                    <p
                      className="text-sm font-medium mb-2"
                      style={{ color: "var(--foreground)" }}
                    >
                      Your Permissions:
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div
                        className="flex items-center gap-2 p-2 rounded"
                        style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                      >
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span style={{ color: "var(--foreground)" }}>
                          View prompts
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2 p-2 rounded"
                        style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                      >
                        <Copy className="w-3 h-3 text-green-500" />
                        <span style={{ color: "var(--foreground)" }}>
                          Copy prompts
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2 p-2 rounded"
                        style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                      >
                        <MessageSquare className="w-3 h-3 text-green-500" />
                        <span style={{ color: "var(--foreground)" }}>Comment</span>
                      </div>

                      <div
                        className="flex items-center gap-2 p-2 rounded"
                        style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                      >
                        <Star className="w-3 h-3 text-green-500" />
                        <span style={{ color: "var(--foreground)" }}>
                          Rate prompts
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-2 p-2 rounded col-span-2"
                        style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                      >
                        <Lock className="w-3 h-3 text-red-500" />
                        <span style={{ color: "var(--muted-foreground)" }}>
                          Cannot create, edit, or delete prompts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expiration Notice */}
                  {teamData.expiresAt && (
                    <div
                      className="flex items-center gap-2 p-2 rounded text-xs mt-3"
                      style={{
                        backgroundColor: "rgba(251, 191, 36, 0.1)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      <Clock className="w-3 h-3" />
                      <span>
                        Access expires on{" "}
                        {teamData.expiresAt.toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Redirecting indicator */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Redirecting to team workspace...
                </span>
              </div>
            </>
          )}

          {/* Success State - Upgrade CTA */}
          {status === "success" && (
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: "rgba(139, 92, 246, 0.05)",
                border: "1px solid rgba(139, 92, 246, 0.2)",
              }}
            >
              <div className="flex items-start gap-2">
                <Sparkles
                  className="w-4 h-4 mt-0.5"
                  style={{ color: "var(--primary)" }}
                />
                <div className="text-left flex-1">
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    Want full access?
                  </p>
                  <p
                    className="text-xs mb-3"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Sign up for a free account to create your own prompts,
                    collaborate with teams, and unlock all features.
                  </p>
                  <button
                    onClick={handleSignUp}
                    className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign Up Free
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error State - Action Buttons */}
          {status === "error" && (
            <div className="space-y-3">
              <div
                className="p-3 rounded-lg flex items-start gap-2"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p
                  className="text-sm text-left"
                  style={{ color: "var(--foreground)" }}
                >
                  If you believe this is an error, please contact the person who
                  shared this link with you.
                </p>
              </div>

              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate("/");
                  } else {
                    window.location.href = "/";
                  }
                }}
                className="btn-primary w-full py-3"
              >
                Return Home
              </button>

              <button
                onClick={() => window.location.reload()}
                className="btn-secondary w-full py-3"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading indicator */}
          {status === "loading" && (
            <div className="flex justify-center mt-6">
              <div
                className="flex items-center gap-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Please wait...</span>
              </div>
            </div>
          )}

          {/* Debug info in development */}
          {process.env.NODE_ENV === "development" && (
            <div
              className="mt-6 p-3 rounded text-xs text-left"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              <div className="font-semibold mb-1">Debug Info:</div>
              <div>Status: {status}</div>
              <div>Token: {token ? token.substring(0, 8) + "..." : "None"}</div>
              {teamData && (
                <>
                  <div>Team: {teamData.teamName}</div>
                  <div>Team ID: {teamData.teamId}</div>
                  <div>Session Storage: {sessionStorage.getItem('guest_team_token') ? '✅ Set' : '❌ Not Set'}</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
