// src/pages/JoinTeam.jsx - Updated with Token Support
import { useEffect, useState } from "react";
import { Lock, PartyPopper, XCircle, Search, Lightbulb, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { getInviteByToken, acceptLinkInvite } from "../lib/inviteUtils";

export default function JoinTeam({ onNavigate }) {
  const { user, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [inviteType, setInviteType] = useState(null); // "email" or "link"

  useEffect(() => {
    handleInvitation();
  }, [user]);

  async function handleInvitation() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const teamId = urlParams.get("teamId");
      const token = urlParams.get("token");

      console.log("🔍 JoinTeam - URL params:", { teamId, token: token ? token.substring(0, 8) + "..." : null });

      // Determine invite type
      if (token) {
        setInviteType("link");
        await handleLinkInvite(token);
      } else if (teamId) {
        setInviteType("email");
        await handleEmailInvite(teamId);
      } else {
        setStatus("error");
        setMessage("Invalid invitation link - missing team ID or token");
        setDebugInfo({ error: "No teamId or token in URL", url: window.location.href });
      }
    } catch (err) {
      console.error("❌ Error in handleInvitation:", err);
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
      setDebugInfo({ error: err.message, stack: err.stack });
    }
  }

  async function handleLinkInvite(token) {
    console.log("🔗 Handling link invite with token:", token.substring(0, 8) + "...");

    if (!user) {
      setStatus("signin_required");
      setMessage("Please sign in to accept this invitation");
      setDebugInfo({ token: token.substring(0, 8) + "...", userStatus: "not signed in" });
      return;
    }

    setStatus("processing");
    setMessage("Validating invite link...");

    try {
      // Validate token
      const validation = await getInviteByToken(token);
      
      if (!validation.valid) {
        if (validation.expired) {
          setStatus("error");
          setMessage("This invitation link has expired. Please request a new invitation from the team.");
          setDebugInfo({ error: "Token expired", token: token.substring(0, 8) + "..." });
          return;
        }

        setStatus("error");
        setMessage(validation.error || "Invalid or expired invitation link");
        setDebugInfo({ error: validation.error, token: token.substring(0, 8) + "..." });
        return;
      }

      const invite = validation.invite;
      setTeamName(invite.teamName);

      // Check if team still exists
      const teamRef = doc(db, "teams", invite.teamId);
      const teamDoc = await getDoc(teamRef);

      if (!teamDoc.exists()) {
        setStatus("error");
        setMessage("This team has been deleted by the owner.");
        setDebugInfo({ error: "Team deleted", teamId: invite.teamId });
        return;
      }

      const teamData = teamDoc.data();

      // Check if already a member
      if (teamData.members && teamData.members[user.uid]) {
        console.log("✅ User is already a member, redirecting...");
        setStatus("already_member");
        setMessage(`You're already a member of "${teamData.name}"!`);
        setDebugInfo({ teamId: invite.teamId, teamName: teamData.name });
        
        // Track in GA4
        if (window.gtag) {
          window.gtag('event', 'invite_link_already_member', {
            team_id: invite.teamId,
            user_id: user.uid,
          });
        }

        setTimeout(() => {
          onNavigate("/");
        }, 2000);
        return;
      }

      // Accept the invite
      console.log("📝 Accepting link invite...");
      const result = await acceptLinkInvite(token, user.uid);

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log("✅ Link invite accepted successfully!");

      // Track in GA4
      if (window.gtag) {
        window.gtag('event', 'invite_link_accepted', {
          team_id: invite.teamId,
          team_name: invite.teamName,
          role: invite.role,
          user_id: user.uid,
        });
      }

      setStatus("success");
      setMessage(`Successfully joined "${invite.teamName}" as ${invite.role}!`);

      setTimeout(() => {
        onNavigate("/");
      }, 2000);
    } catch (err) {
      console.error("❌ Error accepting link invite:", err);
      setStatus("error");

      let errorMessage = "Failed to accept invitation. ";

      if (err.message === "TEAM_NOT_FOUND") {
        errorMessage = "This team has been deleted by the owner.";
      } else if (err.message === "ALREADY_MEMBER") {
        setStatus("already_member");
        errorMessage = `You're already a member of "${teamName}"!`;
        setTimeout(() => onNavigate("/"), 2000);
        return;
      } else if (err.message === "INVITE_EXPIRED") {
        errorMessage = "This invitation link has expired. Please request a new invitation.";
      } else if (err.message === "INVITE_NOT_FOUND") {
        errorMessage = "This invitation link is invalid or has been revoked.";
      } else {
        errorMessage += err.message || "Unknown error";
      }

      setMessage(errorMessage);
      setDebugInfo({ error: err.message, code: err.code });
    }
  }

  async function handleEmailInvite(teamId) {
    console.log("📧 Handling email invite for teamId:", teamId);

    if (!user) {
      setStatus("signin_required");
      setMessage("Please sign in to accept this invitation");
      setDebugInfo({ teamId, userStatus: "not signed in" });
      return;
    }

    console.log("👤 User email:", user.email);

    setStatus("processing");
    setMessage("Processing your invitation...");

    try {
      await runTransaction(db, async (transaction) => {
        const teamRef = doc(db, "teams", teamId);
        const teamDoc = await transaction.get(teamRef);

        if (!teamDoc.exists()) {
          throw new Error("TEAM_NOT_FOUND");
        }

        const teamData = teamDoc.data();
        setTeamName(teamData.name);

        if (teamData.members && teamData.members[user.uid]) {
          throw new Error("ALREADY_MEMBER");
        }

        const normalizedEmail = user.email.toLowerCase();
        console.log("🔍 Looking for invites with email:", normalizedEmail);

        const invitesRef = collection(db, "team-invites");
        const inviteQuery = query(
          invitesRef,
          where("teamId", "==", teamId),
          where("email", "==", normalizedEmail),
          where("type", "==", "email"),
          where("status", "==", "pending")
        );

        const inviteSnapshot = await getDocs(inviteQuery);
        console.log("📨 Found invites:", inviteSnapshot.size);

        if (inviteSnapshot.empty) {
          const allInvitesQuery = query(
            invitesRef,
            where("teamId", "==", teamId),
            where("type", "==", "email"),
            where("status", "==", "pending")
          );
          const allInvites = await getDocs(allInvitesQuery);
          const inviteEmails = allInvites.docs.map((d) => d.data().email);

          throw {
            name: "NO_INVITE_FOUND",
            message: "No pending invitation found",
            debugData: {
              userEmail: normalizedEmail,
              pendingInvitesForTeam: inviteEmails.length,
              inviteEmails: inviteEmails,
            },
          };
        }

        const inviteDoc = inviteSnapshot.docs[0];
        const inviteData = inviteDoc.data();
        const inviteRef = doc(db, "team-invites", inviteDoc.id);

        console.log("✅ Found invite:", {
          id: inviteDoc.id,
          role: inviteData.role,
          invitedBy: inviteData.inviterName,
        });

        const now = Timestamp.now();
        if (inviteData.expiresAt && inviteData.expiresAt.toMillis() < now.toMillis()) {
          throw new Error("INVITE_EXPIRED");
        }

        transaction.update(teamRef, {
          [`members.${user.uid}`]: inviteData.role || "member",
        });

        transaction.update(inviteRef, {
          status: "accepted",
          acceptedAt: Timestamp.now(),
          acceptedByUid: user.uid,
        });

        console.log("✅ Transaction prepared successfully");

        // Track in GA4
        if (window.gtag) {
          window.gtag('event', 'team_invite_accepted', {
            team_id: teamId,
            team_name: teamData.name,
            role: inviteData.role,
            user_id: user.uid,
          });
        }

        return {
          teamName: teamData.name,
          role: inviteData.role,
          inviteId: inviteDoc.id,
        };
      });

      console.log("✅ Successfully joined team!");

      setStatus("success");
      setMessage(`Successfully joined "${teamName}" as member!`);

      setTimeout(() => {
        onNavigate("/");
      }, 2000);
    } catch (err) {
      console.error("❌ Error accepting email invitation:", err);
      setError(err);

      if (err.message === "TEAM_NOT_FOUND") {
        setStatus("error");
        setMessage("This team has been deleted by the owner.");
        setDebugInfo({ teamId, error: "Team doesn't exist" });
        return;
      }

      if (err.message === "ALREADY_MEMBER") {
        setStatus("already_member");
        setMessage(`You're already a member of "${teamName}"!`);
        setDebugInfo({ teamId, teamName });
        setTimeout(() => {
          onNavigate("/");
        }, 2000);
        return;
      }

      if (err.message === "INVITE_EXPIRED") {
        setStatus("error");
        setMessage("This invitation has expired. Please request a new invitation from the team owner.");
        setDebugInfo({ error: "Invite expired" });
        return;
      }

      if (err.name === "NO_INVITE_FOUND") {
        setStatus("error");
        setMessage(
          "No pending invitation found for your email address. " +
          "It may have already been accepted, cancelled, or sent to a different email address."
        );
        setDebugInfo({
          teamId,
          teamName,
          userEmail: user.email.toLowerCase(),
          ...err.debugData,
        });
        return;
      }

      setStatus("error");

      let errorMessage = "Failed to accept invitation. ";

      if (err.code === "permission-denied") {
        errorMessage +=
          "You don't have permission to join this team. Please check your Firestore security rules.";
      } else if (err.code === "not-found") {
        errorMessage += "Team not found. The invitation may be invalid.";
      } else if (err.code === "unavailable") {
        errorMessage +=
          "Firebase is currently unavailable. Please try again in a moment.";
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += "An unexpected error occurred.";
      }

      setMessage(errorMessage);
      setDebugInfo({
        error: err.message,
        code: err.code,
        stack: err.stack?.split("\n").slice(0, 3).join("\n"),
      });
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="glass-card p-8 max-w-md w-full mx-4">
        {status === "loading" && (
          <div className="text-center">
            <div className="neo-spinner mx-auto mb-4"></div>
            <h2
              className="text-xl font-bold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Loading Invitation...
            </h2>
            <p style={{ color: "var(--muted-foreground)" }}>
              Please wait while we verify your invitation
            </p>
          </div>
        )}

        {status === "signin_required" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="w-16 h-16" style={{ color: "var(--primary)" }} />
            </div>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Sign In Required
            </h2>
            <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
              {message}
            </p>
            <button
              onClick={signInWithGoogle}
              className="btn-primary px-6 py-3 w-full"
            >
              Sign in with Google
            </button>
            <p
              className="text-xs mt-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              {inviteType === "email" 
                ? "Make sure to sign in with the email address that received the invitation"
                : "Sign in with any Google account to join this team"
              }
            </p>
          </div>
        )}

        {status === "processing" && (
          <div className="text-center">
            <div className="neo-spinner mx-auto mb-4"></div>
            <h2
              className="text-xl font-bold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Joining Team...
            </h2>
            <p style={{ color: "var(--muted-foreground)" }}>{message}</p>
          </div>
        )}

        {status === "already_member" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16" style={{ color: "var(--success)" }} />
            </div>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Already a Member!
            </h2>
            <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
              {message}
            </p>
            <div
              className="p-4 rounded-lg mb-4"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--secondary-foreground)" }}
              >
                You already have access to this team. Redirecting...
              </p>
            </div>
            <button
              onClick={() => onNavigate("/")}
              className="btn-primary px-6 py-2"
            >
              Go to App Now
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <PartyPopper className="w-16 h-16" style={{ color: "var(--primary)" }} />
            </div>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Success!
            </h2>
            <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
              {message}
            </p>
            <div
              className="p-4 rounded-lg mb-4"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--secondary-foreground)" }}
              >
                Redirecting you to the app...
              </p>
            </div>
            <button
              onClick={() => onNavigate("/")}
              className="btn-primary px-6 py-2"
            >
              Go to App Now
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {message.includes("deleted") ? (
                <AlertCircle className="w-16 h-16" style={{ color: "var(--warning)" }} />
              ) : (
                <XCircle className="w-16 h-16" style={{ color: "var(--destructive)" }} />
              )}
            </div>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: message.includes("deleted") ? "var(--warning)" : "var(--destructive)" }}
            >
              {message.includes("deleted") ? "Team Deleted" : "Invitation Error"}
            </h2>
            <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
              {message}
            </p>

            {debugInfo && process.env.NODE_ENV === "development" && (
              <details className="mb-4 text-left">
                <summary
                  className="text-sm cursor-pointer mb-2 flex items-center gap-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Search className="w-4 h-4" />
                  Debug Information (Dev Mode)
                </summary>
                <div
                  className="mt-2 p-3 rounded text-xs"
                  style={{ backgroundColor: "var(--muted)" }}
                >
                  <pre className="whitespace-pre-wrap text-left overflow-auto">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              </details>
            )}

            {!message.includes("deleted") && (
              <div
                className="p-4 rounded-lg mb-4 text-left"
                style={{
                  backgroundColor: "var(--muted)",
                  borderColor: "var(--border)",
                }}
              >
                <h3
                  className="font-semibold mb-2 text-sm flex items-center gap-2"
                  style={{ color: "var(--foreground)" }}
                >
                  <Lightbulb className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  Troubleshooting Tips:
                </h3>
                <ul
                  className="text-xs space-y-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {inviteType === "email" && (
                    <>
                      <li>
                        • Make sure you're signed in with the email address that
                        received the invitation
                      </li>
                      <li>
                        • Check if the invitation was sent to a different email
                        address
                      </li>
                    </>
                  )}
                  {inviteType === "link" && (
                    <li>
                      • Make sure you're using the complete invitation link
                    </li>
                  )}
                  <li>• The invitation may have already been accepted or expired</li>
                  <li>• The team owner may have cancelled the invitation</li>
                  {inviteType === "email" && (
                    <li>
                      • Try signing out and signing back in with the correct email
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              {!message.includes("deleted") && (
                <button
                  onClick={() => {
                    setStatus("loading");
                    setMessage("");
                    setError(null);
                    setDebugInfo(null);
                    handleInvitation();
                  }}
                  className="btn-primary px-6 py-2 w-full"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={() => onNavigate("/")}
                className="btn-secondary px-6 py-2 w-full"
              >
                Go to Home
              </button>
            </div>
          </div>
        )}

        <div
          className="mt-6 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          {user && inviteType === "email" ? (
            <p>
              Signed in as: <strong>{user.email}</strong>
              <br />
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Sign out and try with a different email? This will redirect you to the home page."
                    )
                  ) {
                    onNavigate("/");
                  }
                }}
                className="underline mt-2"
                style={{ color: "var(--primary)" }}
              >
                Sign in with different email
              </button>
            </p>
          ) : user ? (
            <p>
              Signed in as: <strong>{user.email}</strong>
            </p>
          ) : (
            <p>
              {inviteType === "email" 
                ? "Having trouble? Make sure you're signed in with the email address that received the invitation."
                : "Having trouble? Make sure you're using the complete invitation link."
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
