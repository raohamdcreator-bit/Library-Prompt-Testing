// src/components/InviteForm.jsx
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function InviteForm({ teamId, teamName }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email) {
      alert("Please enter an email");
      return;
    }

    setIsLoading(true);
    setStatus("Creating invite...");

    try {
      // ✅ 1) Save invite inside team's invites subcollection
      const inviteDoc = await addDoc(
        collection(db, "teams", teamId, "invites"),
        {
          teamId,
          teamName,
          email: email.toLowerCase(),
          role,
          invitedBy: user.uid,
          inviterName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          status: "pending",
        }
      );

      console.log("✅ Invite saved to Firestore:", inviteDoc.id);
      setStatus("Invite saved to database. Sending email...");

      // ✅ 2) Send email invite through backend
      const inviteLink = `${window.location.origin}/join?teamId=${teamId}`;

      console.log("📧 Attempting to send email to:", email);
      console.log("🔗 Invite link:", inviteLink);

      try {
        const res = await fetch("/api/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            link: inviteLink,
            teamName,
            invitedBy: user.displayName || user.email,
            role,
          }),
        });

        console.log("📡 API Response status:", res.status);
        console.log("📡 API Response ok:", res.ok);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        console.log("📧 Email API response:", data);

        if (!data.success) {
          console.error("Email send failed:", data.error);
          setStatus(
            `Invite saved but email failed: ${data.error || "Unknown error"} ⚠️`
          );
        } else {
          setStatus("Invite sent successfully ✅");
        }
      } catch (fetchError) {
        console.error("📧 Email API fetch error:", fetchError);

        if (fetchError.message.includes("404")) {
          setStatus("Invite saved but email API not found (404) ⚠️");
        } else if (fetchError.message.includes("Failed to fetch")) {
          setStatus("Invite saved but unable to connect to email service ⚠️");
        } else {
          setStatus(`Invite saved but email failed: ${fetchError.message} ⚠️`);
        }
      }

      // Reset form
      setEmail("");
      setRole("member");
    } catch (err) {
      console.error("❌ Error creating invite:", err);
      setStatus(`Failed to create invite: ${err.message} ❌`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleInvite}
      className="space-y-2 bg-white p-3 rounded shadow mt-4 w-full max-w-md"
    >
      <h3 className="font-semibold">Invite a member</h3>

      {/* Email Input */}
      <input
        className="w-full border p-2 rounded"
        placeholder="Enter email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
      />

      {/* Role Selection */}
      <select
        className="w-full border p-2 rounded"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={isLoading}
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>

      {/* Submit Button */}
      <button
        type="submit"
        className="bg-blue-600 text-white px-3 py-1 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading}
      >
        {isLoading ? "Sending..." : "Send Invite"}
      </button>

      {/* Status */}
      {status && (
        <div className="text-sm p-2 rounded bg-gray-50 border">
          <p>{status}</p>
          {status.includes("failed") && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-600">
                Debug Info (click to expand)
              </summary>
              <div className="mt-1 text-xs text-gray-600">
                <p>• Check browser console for detailed errors</p>
                <p>• Verify /api/send-invite endpoint exists</p>
                <p>• Check if backend server is running</p>
                <p>• Verify email service is configured</p>
              </div>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
