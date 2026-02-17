// src/pages/JoinTeam.jsx - FIXED: Unauthenticated invite loading + robust sign-in → accept flow
import { useEffect, useState, useRef } from "react";
import { CheckCircle2, XCircle, Info, LogIn, Loader2, Users, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { acceptTeamInvite, acceptLinkInvite, validateInvite, getInviteByToken } from "../lib/inviteUtils";

// Session storage key used to survive the auth popup redirect / state reset
const PENDING_INVITE_KEY = "pending_join_invite";

export default function JoinTeam({ onNavigate }) {
  const { user, signInWithGoogle } = useAuth();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading invitation...");
  const [inviteData, setInviteData] = useState(null);
  const [acceptedTeamId, setAcceptedTeamId] = useState(null);

  // Guard so we only attempt acceptance once per mount
  const acceptAttempted = useRef(false);

  // Parse URL parameters once
  const urlParams = new URLSearchParams(window.location.search);
  const inviteId = urlParams.get("inviteId");
  const teamId = urlParams.get("teamId");
  const token = urlParams.get("token");

  // ─── Step 1: Load & validate the invite (works for unauthenticated users) ───
  useEffect(() => {
    loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Step 2: Auto-accept as soon as we have both a user and invite data ──────
  useEffect(() => {
    if (user && inviteData && !acceptAttempted.current) {
      // Only fire when we're in a state that expects acceptance
      if (
        status === "ready" ||
        status === "signin_required" ||
        status === "signing_in"
      ) {
        acceptAttempted.current = true;
        setStatus("processing");
        setMessage("Accepting invitation...");
        acceptInviteHandler(inviteData, user);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, inviteData]);

  // ─────────────────────────────────────────────────────────────────────────────

  async function loadInvite() {
    try {
      setStatus("loading");
      setMessage("Validating invitation...");

      // Check if we have invite data already saved from a previous attempt
      // (e.g. user hit "Sign in" and the auth popup triggered a re-render)
      const savedInvite = tryRestoreSavedInvite();

      let details;

      if (savedInvite) {
        // We already validated this invite before sign-in — skip re-validation
        console.log("♻️ [JOIN] Restoring invite data from session storage");
        details = savedInvite;
      } else if (token) {
        // Link-based invite
        console.log("🔗 [JOIN] Processing link invite, token:", token);
        const validation = await getInviteByToken(token);

        if (!validation.valid) {
          throw new Error(validation.error || "Invalid invite link");
        }

        details = {
          type: "link",
          token,
          teamId: validation.invite.teamId,
          teamName: validation.invite.teamName,
          role: validation.invite.role,
          inviterName: validation.invite.inviterName,
        };
      } else if (inviteId && teamId) {
        // Email-based invite — validateInvite now works for unauthenticated
        // users because the Firestore rule allows public `get` on team-invites
        console.log("📧 [JOIN] Processing email invite, inviteId:", inviteId);
        const validation = await validateInvite(inviteId);

        if (!validation.valid) {
          throw new Error(validation.error || "Invalid invitation");
        }

        details = {
          type: "email",
          inviteId,
          teamId,
          teamName: validation.invite.teamName,
          role: validation.invite.role,
          email: validation.invite.email,
          inviterName: validation.invite.inviterName,
        };
      } else if (teamId && !inviteId && !token) {
        // Legacy / malformed link: only teamId with no inviteId or token
        throw new Error(
          "This invitation link is incomplete. Please ask your team admin for a new one."
        );
      } else {
        throw new Error(
          "Missing invitation parameters. Please check your invitation link."
        );
      }

      console.log("✅ [JOIN] Invite validated:", details);
      setInviteData(details);

      if (user) {
        // Already signed in → auto-accept will fire via the useEffect above
        setStatus("ready");
        setMessage("Processing invitation...");
      } else {
        // Not signed in → show sign-in prompt, persist details for after auth
        saveInviteToSession(details);
        setStatus("signin_required");
        setMessage(`You've been invited to join "${details.teamName}"`);
      }
    } catch (err) {
      console.error("❌ [JOIN] Error loading invite:", err);
      clearSavedInvite();
      setStatus("error");

      if (err.message.includes("expired")) {
        setMessage(
          "This invitation has expired. Please ask your team admin for a new one."
        );
      } else if (err.message.includes("not found")) {
        setMessage(
          "This invitation is no longer valid or has already been used."
        );
      } else {
        setMessage(
          err.message ||
            "Failed to load invitation. Please try again or contact your team admin."
        );
      }
    }
  }

  async function acceptInviteHandler(invite, currentUser) {
    try {
      let result;

      if (invite.type === "link") {
        console.log("🔗 [JOIN] Accepting link invite, token:", invite.token);
        result = await acceptLinkInvite(invite.token, currentUser.uid);
      } else {
        console.log("📧 [JOIN] Accepting email invite, inviteId:", invite.inviteId);
        result = await acceptTeamInvite(invite.inviteId, invite.teamId, currentUser.uid);
      }

      // Clear persisted invite regardless of outcome
      clearSavedInvite();

      if (!result.success) {
        if (result.error === "ALREADY_MEMBER") {
          setStatus("success");
          setMessage(`You're already a member of "${invite.teamName}"!`);
          setAcceptedTeamId(invite.teamId);
          scheduleRedirect("/");
          return;
        }
        throw new Error(result.error || "Failed to accept invitation");
      }

      console.log("✅ [JOIN] Invitation accepted successfully");
      setStatus("success");
      setMessage(
        `Successfully joined "${result.teamName || invite.teamName}" as ${result.role}!`
      );
      setAcceptedTeamId(invite.teamId);

      if (window.gtag) {
        window.gtag("event", "team_invite_accepted", {
          team_id: invite.teamId,
          team_name: invite.teamName,
          role: result.role,
          invite_type: invite.type,
        });
      }

      scheduleRedirect("/");
    } catch (err) {
      console.error("❌ [JOIN] Error accepting invite:", err);
      clearSavedInvite();
      acceptAttempted.current = false; // allow retry
      setStatus("error");

      const code = err.message || "";
      if (code === "TEAM_NOT_FOUND") {
        setMessage("This team no longer exists.");
      } else if (code === "INVITE_EXPIRED") {
        setMessage("This invitation has expired. Please ask your team admin for a new one.");
      } else if (code === "INVITE_NOT_FOUND") {
        setMessage("This invitation is no longer valid.");
      } else {
        setMessage(
          err.message || "Failed to accept invitation. Please try again."
        );
      }
    }
  }

  async function handleSignIn() {
    try {
      setStatus("signing_in");
      setMessage("Opening Google sign-in...");

      // Ensure invite data is persisted before the popup triggers re-renders
      if (inviteData) {
        saveInviteToSession(inviteData);
      }

      await signInWithGoogle();
      // After signInWithGoogle resolves, `user` updates via AuthContext and
      // the useEffect above triggers acceptInviteHandler automatically.
    } catch (err) {
      console.error("❌ [JOIN] Sign-in error:", err);
      setStatus("signin_required");

      if (
        err.message?.includes("popup") ||
        err.code === "auth/popup-blocked"
      ) {
        setMessage(
          "Pop-up blocked! Please allow pop-ups for this site and try again."
        );
      } else if (
        err.message?.includes("cancelled") ||
        err.code === "auth/popup-closed-by-user"
      ) {
        setMessage(
          "Sign-in was cancelled. Click the button below when you're ready to join."
        );
      } else {
        setMessage("Sign-in failed. Please try again.");
      }
    }
  }

  function scheduleRedirect(path) {
    setTimeout(() => {
      onNavigate ? onNavigate(path) : (window.location.href = path);
    }, 2000);
  }

  // ─── Session storage helpers ─────────────────────────────────────────────────

  function saveInviteToSession(details) {
    try {
      sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(details));
    } catch (_) {
      // Non-critical — worst case the user just has to sign in again
    }
  }

  function tryRestoreSavedInvite() {
    try {
      const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Only restore if the URL params still match (guard against stale data)
      if (parsed.type === "link" && parsed.token === token) return parsed;
      if (parsed.type === "email" && parsed.inviteId === inviteId && parsed.teamId === teamId)
        return parsed;
      return null;
    } catch (_) {
      return null;
    }
  }

  function clearSavedInvite() {
    try {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
    } catch (_) {}
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  const statusColorClass = {
    loading: "text-blue-500",
    processing: "text-blue-500",
    signing_in: "text-blue-500",
    ready: "text-blue-500",
    success: "text-green-500",
    error: "text-red-500",
    signin_required: "text-purple-500",
  }[status] ?? "text-gray-500";

  const isSpinning = ["loading", "processing", "ready", "signing_in"].includes(status);

  const titles = {
    loading: "Loading Invitation",
    processing: "Processing Invitation",
    ready: "Processing Invitation",
    success: "Welcome to the Team!",
    error: "Invitation Error",
    signin_required: "Sign In to Join",
    signing_in: "Signing In…",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="glass-card p-8 rounded-xl shadow-2xl max-w-md w-full">
        <div className="text-center">
          {/* Status icon */}
          <div className={`flex justify-center mb-4 ${statusColorClass}`}>
            {isSpinning && <Loader2 className="w-12 h-12 animate-spin" />}
            {status === "success" && <CheckCircle2 className="w-12 h-12" />}
            {status === "error" && <XCircle className="w-12 h-12" />}
            {status === "signin_required" && <LogIn className="w-12 h-12" />}
          </div>

          {/* Title */}
          <h2
            className="text-2xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            {titles[status] ?? "Team Invitation"}
          </h2>

          {/* Message */}
          <p className={`mb-6 ${statusColorClass}`}>{message}</p>

          {/* Invite details card (sign-in prompt only) */}
          {status === "signin_required" && inviteData && (
            <div
              className="mb-6 p-4 rounded-lg"
              style={{
                backgroundColor: "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  <span
                    className="text-lg font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {inviteData.teamName}
                  </span>
                </div>

                <div
                  className="space-y-2 text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Your Role:</span>
                    <span
                      className="flex items-center gap-1 font-semibold capitalize"
                      style={{ color: "var(--foreground)" }}
                    >
                      <Shield className="w-4 h-4" />
                      {inviteData.role}
                    </span>
                  </div>

                  {inviteData.inviterName && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Invited by:</span>
                      <span
                        className="font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {inviteData.inviterName}
                      </span>
                    </div>
                  )}

                  {inviteData.email && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Email:</span>
                      <span
                        className="font-semibold truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {inviteData.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {status === "signin_required" && (
            <div className="space-y-3">
              <button
                onClick={handleSignIn}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Sign In with Google to Join
              </button>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                You'll need to sign in to accept this invitation.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <button
                onClick={() =>
                  onNavigate ? onNavigate("/") : (window.location.href = "/")
                }
                className="btn-primary w-full py-3"
              >
                Go to Team Dashboard
              </button>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Redirecting automatically in a moment…
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <button
                onClick={() =>
                  onNavigate ? onNavigate("/") : (window.location.href = "/")
                }
                className="btn-primary w-full py-3"
              >
                Return Home
              </button>
              <button
                onClick={() => {
                  acceptAttempted.current = false;
                  window.location.reload();
                }}
                className="btn-secondary w-full py-3"
              >
                Try Again
              </button>
              <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>
                If this problem persists, please contact your team admin for a
                new invitation.
              </p>
            </div>
          )}

          {/* Spinner hint while async work is in progress */}
          {isSpinning && (
            <div className="flex justify-center mt-6">
              <div
                className="flex items-center gap-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Please wait…</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
