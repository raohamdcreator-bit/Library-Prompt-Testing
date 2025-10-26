// src/pages/JoinTeam.jsx - FIXED: Better invite handling for existing users
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  getDoc,
} from "firebase/firestore";

export default function JoinTeam({ onNavigate }) {
  const { user, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    handleInvitation();
  }, [user]);

  async function handleInvitation() {
    try {
      // Get teamId from URL
      const urlParams = new URLSearchParams(window.location.search);
      const teamId = urlParams.get("teamId");

      console.log("🔍 JoinTeam - teamId from URL:", teamId);

      if (!teamId) {
        setStatus("error");
        setMessage("Invalid invitation link - missing team ID");
        setDebugInfo({ error: "No teamId in URL", url: window.location.href });
        return;
      }

      // User must be signed in
      if (!user) {
        setStatus("signin_required");
        setMessage("Please sign in to accept this invitation");
        setDebugInfo({ teamId, userStatus: "not signed in" });
        return;
      }

      console.log("👤 User email:", user.email);

      setStatus("processing");
      setMessage("Processing your invitation...");

      // ✅ STEP 1: Check if user is already a member of this team
      const teamRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamRef);

      if (!teamDoc.exists()) {
        setStatus("error");
        setMessage("Team not found. The invitation may be invalid or the team may have been deleted.");
        setDebugInfo({ teamId, error: "Team doesn't exist" });
        return;
      }

      const teamData = teamDoc.data();
      setTeamName(teamData.name);

      // Check if user is already a member
      if (teamData.members && teamData.members[user.uid]) {
        setStatus("already_member");
        setMessage(`You're already a member of "${teamData.name}"!`);
        setDebugInfo({
          teamId,
          teamName: teamData.name,
          currentRole: teamData.members[user.uid],
        });
        
        // Redirect after 2 seconds
        setTimeout(() => {
          onNavigate("/");
        }, 2000);
        return;
      }

      // ✅ STEP 2: Find pending invite for this user's email
      console.log("🔍 Looking for invites with email:", user.email.toLowerCase());
      
      const invitesRef = collection(db, "team-invites");
      const q = query(
        invitesRef,
        where("teamId", "==", teamId),
        where("email", "==", user.email.toLowerCase()),
        where("status", "==", "pending")
      );

      const inviteSnapshot = await getDocs(q);

      console.log("📨 Found invites:", inviteSnapshot.size);

      if (inviteSnapshot.empty) {
        // Check if there are ANY invites for this team (for debugging)
        const allInvitesQuery = query(
          invitesRef,
          where("teamId", "==", teamId),
          where("status", "==", "pending")
        );
        const allInvites = await getDocs(allInvitesQuery);
        
        const inviteEmails = allInvites.docs.map(d => d.data().email);
        
        setStatus("error");
        setMessage(
          "No pending invitation found for your email address. " +
          "It may have already been accepted, cancelled, or sent to a different email address."
        );
        setDebugInfo({
          teamId,
          teamName: teamData.name,
          userEmail: user.email.toLowerCase(),
          pendingInvitesForTeam: inviteEmails.length,
          inviteEmails: inviteEmails,
          hint: inviteEmails.length > 0 
            ? `There are ${inviteEmails.length} pending invite(s) for this team, but none match your email.`
            : "No pending invites found for this team."
        });
        return;
      }

      // ✅ STEP 3: Get the first matching invite
      const inviteDoc = inviteSnapshot.docs[0];
      const inviteData = inviteDoc.data();
      
      console.log("✅ Found invite:", {
        id: inviteDoc.id,
        role: inviteData.role,
        invitedBy: inviteData.inviterName
      });

      // ✅ STEP 4: Use batch write to update both team members and invite status
      const batch = writeBatch(db);

      // Add user to team members
      batch.update(teamRef, {
        [`members.${user.uid}`]: inviteData.role || "member",
      });

      // Mark invite as accepted
      const inviteRef = doc(db, "team-invites", inviteDoc.id);
      batch.update(inviteRef, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUid: user.uid,
      });

      // Commit the batch
      await batch.commit();

      console.log("✅ Successfully joined team!");

      setStatus("success");
      setMessage(
        `Successfully joined "${inviteData.teamName}" as ${
          inviteData.role || "member"
        }!`
      );
      setDebugInfo({
        teamId,
        teamName: inviteData.teamName,
        role: inviteData.role,
        inviteId: inviteDoc.id,
      });

      // Redirect to home after 2 seconds
      setTimeout(() => {
        onNavigate("/");
      }, 2000);
    } catch (err) {
      console.error("❌ Error accepting invitation:", err);
      setStatus("error");
      setError(err);

      let errorMessage = "Failed to accept invitation. ";
      
      if (err.code === "permission-denied") {
        errorMessage += "You don't have permission to join this team. Please check your Firestore security rules.";
      } else if (err.code === "not-found") {
        errorMessage += "Team not found. The invitation may be invalid.";
      } else if (err.code === "unavailable") {
        errorMessage += "Firebase is currently unavailable. Please try again in a moment.";
      } else {
        errorMessage += err.message || "An unexpected error occurred.";
      }

      setMessage(errorMessage);
      setDebugInfo({
        error: err.message,
        code: err.code,
        stack: err.stack?.split('\n').slice(0, 3).join('\n'),
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
            <div className="text-6xl mb-4">🔐</div>
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
              className="btn-primary ai-glow px-6 py-3 w-full"
            >
              Sign in with Google
            </button>
            <p
              className="text-xs mt-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              Make sure to sign in with the email address that received the invitation
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
            <div className="text-6xl mb-4">✅</div>
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
            <div className="text-6xl mb-4">🎉</div>
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
            <div className="text-6xl mb-4">❌</div>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--destructive)" }}
            >
              Invitation Error
            </h2>
            <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
              {message}
            </p>

            {/* Debug Information */}
            {debugInfo && process.env.NODE_ENV === "development" && (
              <details className="mb-4 text-left">
                <summary
                  className="text-sm cursor-pointer mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  🔍 Debug Information (Dev Mode)
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

            {/* User-friendly troubleshooting */}
            <div
              className="p-4 rounded-lg mb-4 text-left"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              <h3
                className="font-semibold mb-2 text-sm"
                style={{ color: "var(--foreground)" }}
              >
                💡 Troubleshooting Tips:
              </h3>
              <ul
                className="text-xs space-y-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                <li>
                  • Make sure you're signed in with the email address that
                  received the invitation
                </li>
                <li>
                  • Check if the invitation was sent to a different email
                  address
                </li>
                <li>• The invitation may have already been accepted</li>
                <li>• The team owner may have cancelled the invitation</li>
                <li>
                  • Try signing out and signing back in with the correct email
                </li>
              </ul>
            </div>

            <div className="space-y-3">
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
              <button
                onClick={() => onNavigate("/")}
                className="btn-secondary px-6 py-2 w-full"
              >
                Go to Home
              </button>
            </div>
          </div>
        )}

        {/* Footer Help Text */}
        <div
          className="mt-6 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          {user ? (
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
          ) : (
            <p>
              Having trouble? Make sure you're signed in with the email address
              that received the invitation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
