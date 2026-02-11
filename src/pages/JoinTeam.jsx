// src/pages/JoinTeam.jsx - FIXED: Proper invite handling for both email and link invites
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, XCircle, Info, LogIn, Loader2, Users, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { acceptTeamInvite, acceptLinkInvite, validateInvite, getInviteByToken } from "../lib/inviteUtils";

export default function JoinTeam({ onNavigate }) {
  const { user, signInWithGoogle } = useAuth();
  
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading invitation...");
  const [inviteData, setInviteData] = useState(null);
  const [acceptedTeamId, setAcceptedTeamId] = useState(null);
  const [attemptingAutoAccept, setAttemptingAutoAccept] = useState(false);

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const inviteId = urlParams.get("inviteId");
  const teamId = urlParams.get("teamId");
  const token = urlParams.get("token");

  // Step 1: Load and validate invite
  useEffect(() => {
    loadInvite();
  }, [inviteId, teamId, token]);

  // Step 2: Auto-accept invite if user is already signed in
  useEffect(() => {
    if (user && inviteData && status === "ready" && !attemptingAutoAccept) {
      setAttemptingAutoAccept(true);
      acceptInviteHandler();
    }
  }, [user, inviteData, status]);

  async function loadInvite() {
    try {
      setStatus("loading");
      setMessage("Validating invitation...");

      let validation;
      let inviteType;
      let inviteDetails = {};

      // Determine invite type and validate
      if (token) {
        // Link-based invite (has token parameter)
        console.log("📧 Processing link-based invite with token:", token);
        inviteType = "link";
        validation = await getInviteByToken(token);
        
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid invite link");
        }

        inviteDetails = {
          type: "link",
          token,
          teamId: validation.invite.teamId,
          teamName: validation.invite.teamName,
          role: validation.invite.role,
          inviterName: validation.invite.inviterName,
        };
      } else if (inviteId && teamId) {
        // Email-based invite (has inviteId + teamId)
        console.log("📧 Processing email-based invite with inviteId:", inviteId, "teamId:", teamId);
        inviteType = "email";
        validation = await validateInvite(inviteId);
        
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid invitation");
        }

        inviteDetails = {
          type: "email",
          inviteId,
          teamId,
          teamName: validation.invite.teamName,
          role: validation.invite.role,
          email: validation.invite.email,
          inviterName: validation.invite.inviterName,
        };
      } else if (teamId && !inviteId && !token) {
        // Legacy format: only teamId (missing inviteId)
        // This is the bug - we need both teamId AND inviteId for email invites
        console.error("❌ Invalid invite format: teamId without inviteId or token");
        throw new Error("Invalid invite format. This link appears to be incomplete. Please request a new invitation.");
      } else {
        throw new Error("Missing invitation parameters. Please check your invitation link.");
      }

      console.log("✅ Invite validated successfully:", inviteDetails);
      setInviteData(inviteDetails);

      // If user is already signed in, proceed to accept
      // Otherwise, show sign-in prompt
      if (user) {
        setStatus("ready");
        setMessage("Processing invitation...");
      } else {
        setStatus("signin_required");
        setMessage(`You've been invited to join "${inviteDetails.teamName}"`);
      }
    } catch (err) {
      console.error("❌ Error loading invite:", err);
      setStatus("error");

      if (err.message.includes("expired")) {
        setMessage("This invitation has expired. Please request a new one from your team admin.");
      } else if (err.message.includes("not found")) {
        setMessage("This invitation is no longer valid or has already been used.");
      } else if (err.message.includes("Invalid invite format")) {
        setMessage(err.message);
      } else {
        setMessage(err.message || "Failed to load invitation. Please try again or contact your team admin.");
      }
    }
  }

  async function acceptInviteHandler() {
    try {
      setStatus("processing");
      setMessage("Accepting invitation...");

      let result;

      if (inviteData.type === "link") {
        // Accept link-based invite
        console.log("📧 Accepting link invite with token:", inviteData.token);
        result = await acceptLinkInvite(inviteData.token, user.uid);
      } else {
        // Accept email-based invite
        console.log("📧 Accepting email invite with inviteId:", inviteData.inviteId);
        result = await acceptTeamInvite(inviteData.inviteId, inviteData.teamId, user.uid);
      }

      if (!result.success) {
        // Handle specific error cases
        if (result.error === "ALREADY_MEMBER") {
          setStatus("success");
          setMessage(`You're already a member of "${inviteData.teamName}"!`);
          setAcceptedTeamId(inviteData.teamId);
          setTimeout(() => {
            onNavigate ? onNavigate("/") : window.location.href = "/";
          }, 2000);
          return;
        }

        throw new Error(result.error || "Failed to accept invitation");
      }

      console.log("✅ Invitation accepted successfully");
      setStatus("success");
      setMessage(`Successfully joined "${result.teamName || inviteData.teamName}" as ${result.role}!`);
      setAcceptedTeamId(inviteData.teamId);

      // Track acceptance in GA4
      if (window.gtag) {
        window.gtag('event', 'team_invite_accepted', {
          team_id: inviteData.teamId,
          team_name: inviteData.teamName,
          role: result.role,
          invite_type: inviteData.type,
        });
      }

      // Redirect to home after short delay (team will be visible in sidebar)
      setTimeout(() => {
        onNavigate ? onNavigate("/") : window.location.href = "/";
      }, 2000);
    } catch (err) {
      console.error("❌ Error accepting invite:", err);
      setStatus("error");
      setAttemptingAutoAccept(false);

      if (err.message === "TEAM_NOT_FOUND") {
        setMessage("This team no longer exists.");
      } else if (err.message === "INVITE_EXPIRED") {
        setMessage("This invitation has expired. Please request a new one.");
      } else if (err.message === "INVITE_NOT_FOUND") {
        setMessage("This invitation is no longer valid.");
      } else {
        setMessage(err.message || "Failed to accept invitation. Please try again.");
      }
    }
  }

  async function handleSignIn() {
    try {
      setStatus("signing_in");
      setMessage("Opening Google sign-in...");
      
      // Store invite data in sessionStorage so we don't lose it during sign-in
      if (inviteData) {
        sessionStorage.setItem('pendingInvite', JSON.stringify(inviteData));
      }
      
      await signInWithGoogle();
      
      // After sign-in, the useEffect will trigger acceptance
      console.log("✅ Sign-in successful, proceeding to accept invite");
    } catch (err) {
      console.error("❌ Sign-in error:", err);
      setStatus("signin_required");
      
      if (err.message?.includes("popup") || err.code === "auth/popup-blocked") {
        setMessage("Pop-up blocked! Please allow pop-ups for this site and try again.");
      } else if (err.message?.includes("cancelled") || err.code === "auth/popup-closed-by-user") {
        setMessage("Sign-in was cancelled. Please try again when you're ready to join the team.");
      } else {
        setMessage("Sign-in failed. Please try again or contact support if the issue persists.");
      }
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "loading":
      case "processing":
      case "signing_in":
      case "ready":
        return "text-blue-600 dark:text-blue-400";
      case "success":
        return "text-green-600 dark:text-green-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      case "signin_required":
        return "text-purple-600 dark:text-purple-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "loading":
      case "processing":
      case "ready":
      case "signing_in":
        return <Loader2 className="w-12 h-12 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-12 h-12" />;
      case "error":
        return <XCircle className="w-12 h-12" />;
      case "signin_required":
        return <LogIn className="w-12 h-12" />;
      default:
        return <Info className="w-12 h-12" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case "loading":
        return "Loading Invitation";
      case "processing":
      case "ready":
        return "Processing Invitation";
      case "success":
        return "Welcome to the Team!";
      case "error":
        return "Invitation Error";
      case "signin_required":
        return "Sign In to Join";
      case "signing_in":
        return "Signing In...";
      default:
        return "Team Invitation";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{ backgroundColor: "var(--background)" }}>
      <div className="glass-card p-8 rounded-xl shadow-2xl max-w-md w-full">
        <div className="text-center">
          {/* Status Icon */}
          <div className={`flex justify-center mb-4 ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            {getTitle()}
          </h2>

          {/* Message */}
          <p className={`mb-6 ${getStatusColor()}`}>
            {message}
          </p>

          {/* Invite Details (when waiting for sign-in) */}
          {status === "signin_required" && inviteData && (
            <div className="mb-6 p-4 rounded-lg" 
                 style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                    {inviteData.teamName}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Your Role:</span>
                    <span className="flex items-center gap-1 font-semibold capitalize" 
                          style={{ color: "var(--foreground)" }}>
                      <Shield className="w-4 h-4" />
                      {inviteData.role}
                    </span>
                  </div>
                  
                  {inviteData.inviterName && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Invited by:</span>
                      <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                        {inviteData.inviterName}
                      </span>
                    </div>
                  )}
                  
                  {inviteData.email && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Email:</span>
                      <span className="font-semibold truncate" style={{ color: "var(--foreground)" }}>
                        {inviteData.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
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
                You'll need to sign in to accept this invitation and join the team.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <button
                onClick={() => onNavigate ? onNavigate("/") : window.location.href = "/"}
                className="btn-primary w-full py-3"
              >
                Go to Team Dashboard
              </button>
              
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Redirecting automatically in a moment...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <button
                onClick={() => onNavigate ? onNavigate("/") : window.location.href = "/"}
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
              
              <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>
                If this problem persists, please contact your team admin for a new invitation.
              </p>
            </div>
          )}

          {/* Loading indicator */}
          {(status === "loading" || status === "processing" || status === "ready" || status === "signing_in") && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Please wait...</span>
              </div>
            </div>
          )}
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-3 rounded text-xs text-left" 
                 style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
              <div className="font-semibold mb-1">Debug Info:</div>
              <div>Status: {status}</div>
              <div>Type: {inviteData?.type || 'N/A'}</div>
              <div>Token: {token ? 'Present' : 'None'}</div>
              <div>InviteId: {inviteId || 'None'}</div>
              <div>TeamId: {teamId || 'None'}</div>
              <div>User: {user ? 'Signed in' : 'Not signed in'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
