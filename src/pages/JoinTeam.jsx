// src/pages/JoinTeam.jsx - Handle team invitation acceptance
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
} from "firebase/firestore";

export default function JoinTeam({ onNavigate }) {
  const { user, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    handleInvitation();
  }, [user]);

  async function handleInvitation() {
    try {
      // Get teamId from URL
      const urlParams = new URLSearchParams(window.location.search);
      const teamId = urlParams.get("teamId");

      if (!teamId) {
        setStatus("error");
        setMessage("Invalid invitation link - missing team ID");
        return;
      }

      // User must be signed in
      if (!user) {
        setStatus("signin_required");
        setMessage("Please sign in to accept this invitation");
        return;
      }

      setStatus("processing");
      setMessage("Processing your invitation...");

      // Find pending invite for this user's email
      const invitesRef = collection(db, "teams", teamId, "invites");
      const q = query(
        invitesRef,
        where("email", "==", user.email.toLowerCase()),
        where("status", "==", "pending")
      );

      const inviteSnapshot = await getDocs(q);

      if (inviteSnapshot.empty) {
        setStatus("error");
        setMessage(
          "No pending invitation found for your email address. It may have already been accepted or cancelled."
        );
        return;
      }

      // Get the first matching invite
      const inviteDoc = inviteSnapshot.docs[0];
      const inviteData = inviteDoc.data();
      setTeamName(inviteData.teamName);

      // Use batch write to update both team members and invite status
      const batch = writeBatch(db);

      // Add user to team members
      const teamRef = doc(db, "teams", teamId);
      batch.update(teamRef, {
        [`members.${user.uid}`]: inviteData.role || "member",
      });

      // Mark invite as accepted
      const inviteRef = doc(db, "teams", teamId, "invites", inviteDoc.id);
      batch.update(inviteRef, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUid: user.uid,
      });

      // Commit the batch
      await batch.commit();

      setStatus("success");
      setMessage(
        `Successfully joined "${inviteData.teamName}" as ${
          inviteData.role || "member"
        }!`
      );

      // Redirect to home after 2 seconds
      setTimeout(() => {
        onNavigate("/");
      }, 2000);
    } catch (err) {
      console.error("Error accepting invitation:", err);
      setStatus("error");
      setError(err);

      if (err.code === "permission-denied") {
        setMessage("You don't have permission to join this team.");
      } else if (err.code === "not-found") {
        setMessage("Team not found. The invitation may be invalid.");
      } else {
        setMessage(`Failed to accept invitation: ${err.message}`);
      }
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
            <p
              className="mb-6"
              style={{ color: "var(--muted-foreground)" }}
            >
              {message}
            </p>
            <button
              onClick={signInWithGoogle}
              className="btn-primary ai-glow px-6 py-3 w-full"
            >
              Sign in with Google
            </button>
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

        {status === "success" && (
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Success!
            </h2>
            <p
              className="mb-6"
              style={{ color: "var(--muted-foreground)" }}
            >
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
            <p
              className="mb-6"
              style={{ color: "var(--muted-foreground)" }}
            >
              {message}
            </p>

            {error && process.env.NODE_ENV === "development" && (
              <details className="mb-4 text-left">
                <summary
                  className="text-sm cursor-pointer"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Error Details (Dev Mode)
                </summary>
                <div
                  className="mt-2 p-3 rounded text-xs"
                  style={{ backgroundColor: "var(--muted)" }}
                >
                  <pre className="whitespace-pre-wrap">
                    {error.toString()}
                  </pre>
                </div>
              </details>
            )}

            <div className="space-y-3">
              <button
                onClick={handleInvitation}
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

        <div
          className="mt-6 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <p>
            Having trouble? Make sure you're signed in with the email address
            that received the invitation.
          </p>
        </div>
      </div>
    </div>
  );
}
