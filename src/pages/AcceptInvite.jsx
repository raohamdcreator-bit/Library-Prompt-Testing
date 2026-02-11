// src/pages/AcceptInvite.jsx - Fixed popup-blocked error with improved flow
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, CheckCircle2, XCircle, Info, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { acceptTeamInvite, acceptLinkInvite, validateInvite, getInviteByToken } from "../lib/inviteUtils";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Loading invitation...");
  const [inviteData, setInviteData] = useState(null);
  const [acceptedTeamId, setAcceptedTeamId] = useState(null);

  const inviteId = searchParams.get("inviteId");
  const teamId = searchParams.get("teamId");
  const token = searchParams.get("token");

  // Step 1: Load and validate invite
  useEffect(() => {
    loadInvite();
  }, [inviteId, teamId, token]);

  // Step 2: Accept invite if user is signed in
  useEffect(() => {
    if (user && inviteData && status === "ready") {
      acceptInviteHandler();
    }
  }, [user, inviteData, status]);

  async function loadInvite() {
    try {
      setStatus("loading");
      setMessage("Validating invitation...");

      let validation;

      // Check if it's a link-based invite (token) or email-based (inviteId)
      if (token) {
        // Link-based invite
        validation = await getInviteByToken(token);
        
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid invite link");
        }

        setInviteData({
          type: "link",
          token,
          teamId: validation.invite.teamId,
          teamName: validation.invite.teamName,
          role: validation.invite.role,
        });
      } else if (inviteId && teamId) {
        // Email-based invite
        validation = await validateInvite(inviteId);
        
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid invitation");
        }

        setInviteData({
          type: "email",
          inviteId,
          teamId,
          teamName: validation.invite.teamName,
          role: validation.invite.role,
          email: validation.invite.email,
        });
      } else {
        throw new Error("Missing invitation parameters");
      }

      // If user is already signed in, proceed to accept
      // Otherwise, show sign-in prompt
      if (user) {
        setStatus("ready");
        setMessage("Processing invitation...");
      } else {
        setStatus("signin_required");
        setMessage(`You've been invited to join "${validation.invite.teamName || inviteData.teamName}"`);
      }
    } catch (err) {
      console.error("Error loading invite:", err);
      setStatus("error");

      if (err.message.includes("expired")) {
        setMessage("This invitation has expired. Please request a new one.");
      } else if (err.message.includes("not found")) {
        setMessage("This invitation is no longer valid or has already been used.");
      } else {
        setMessage(err.message || "Failed to load invitation");
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
        result = await acceptLinkInvite(inviteData.token, user.uid);
      } else {
        // Accept email-based invite
        result = await acceptTeamInvite(inviteData.inviteId, inviteData.teamId, user.uid);
      }

      if (!result.success) {
        // Handle specific error cases
        if (result.error === "ALREADY_MEMBER") {
          setStatus("success");
          setMessage(`You're already a member of "${inviteData.teamName}"!`);
          setAcceptedTeamId(inviteData.teamId);
          setTimeout(() => navigate(`/teams/${inviteData.teamId}`), 2000);
          return;
        }

        throw new Error(result.error || "Failed to accept invitation");
      }

      setStatus("success");
      setMessage(`Successfully joined "${result.teamName || inviteData.teamName}" as ${result.role}!`);
      setAcceptedTeamId(inviteData.teamId);

      // Redirect to team page after short delay
      setTimeout(() => {
        navigate(`/teams/${inviteData.teamId}`);
      }, 2000);
    } catch (err) {
      console.error("Error accepting invite:", err);
      setStatus("error");

      if (err.message === "TEAM_NOT_FOUND") {
        setMessage("This team no longer exists.");
      } else if (err.message === "INVITE_EXPIRED") {
        setMessage("This invitation has expired. Please request a new one.");
      } else if (err.message === "INVITE_NOT_FOUND") {
        setMessage("This invitation is no longer valid.");
      } else {
        setMessage(err.message || "Failed to accept invitation");
      }
    }
  }

  async function handleSignIn() {
    try {
      setStatus("signing_in");
      setMessage("Opening sign-in...");
      await signInWithGoogle();
      // After sign-in, the useEffect will trigger acceptance
    } catch (err) {
      console.error("Sign-in error:", err);
      setStatus("signin_required");
      
      if (err.message?.includes("popup-blocked") || err.code === "auth/popup-blocked") {
        setMessage("Pop-up blocked! Please allow pop-ups for this site and try again.");
      } else {
        setMessage("Sign-in failed. Please try again.");
      }
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "loading":
      case "processing":
      case "signing_in":
        return "text-blue-600";
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "signin_required":
        return "text-purple-600";
      default:
        return "text-gray-600";
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
        return "Invitation Accepted!";
      case "error":
        return "Invitation Error";
      case "signin_required":
        return "Sign In Required";
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
              <div className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                <div className="flex justify-between">
                  <span className="font-medium">Team:</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    {inviteData.teamName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Role:</span>
                  <span className="font-semibold capitalize" style={{ color: "var(--foreground)" }}>
                    {inviteData.role}
                  </span>
                </div>
                {inviteData.email && (
                  <div className="flex justify-between">
                    <span className="font-medium">Invited as:</span>
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {inviteData.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {status === "signin_required" && (
            <button
              onClick={handleSignIn}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Sign In with Google to Accept
            </button>
          )}

          {status === "success" && (
            <button
              onClick={() => navigate(`/teams/${acceptedTeamId}`)}
              className="btn-primary w-full py-3"
            >
              Go to Team
            </button>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <button
                onClick={() => navigate("/")}
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
          {(status === "loading" || status === "processing" || status === "ready" || status === "signing_in") && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Please wait...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
