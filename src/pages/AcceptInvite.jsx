// src/components/AcceptInvite.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  collectionGroup,
} from "firebase/firestore";

export default function AcceptInvite({
  inviteId,
  teamId,
  onAcceptSuccess,
  onClose,
}) {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing invite...");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !inviteId || !teamId) {
      setStatus("error");
      setMessage("Invalid invite or user not logged in");
      return;
    }

    acceptInviteHandler();
  }, [user, inviteId, teamId]);

  async function acceptInviteHandler() {
    try {
      setStatus("processing");
      setMessage("Accepting invite...");

      // Find the specific invite
      const inviteRef = doc(db, "teams", teamId, "invites", inviteId);
      const inviteDoc = await getDocs(
        query(
          collection(db, "teams", teamId, "invites"),
          where("email", "==", user.email.toLowerCase())
        )
      );

      if (inviteDoc.empty) {
        throw new Error("Invite not found or already processed");
      }

      const inviteData = inviteDoc.docs[0].data();
      const actualInviteId = inviteDoc.docs[0].id;

      // Add user to team with the specified role
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        [`members.${user.uid}`]: inviteData.role || "member",
      });

      // Remove the invite
      await deleteDoc(doc(db, "teams", teamId, "invites", actualInviteId));

      setStatus("success");
      setMessage(
        `Successfully joined "${inviteData.teamName}" as ${inviteData.role}!`
      );

      if (onAcceptSuccess) {
        setTimeout(() => onAcceptSuccess(teamId, inviteData.teamName), 1500);
      }
    } catch (err) {
      console.error("Error accepting invite:", err);
      setStatus("error");

      if (err.code === "permission-denied") {
        setMessage(
          "Permission denied. The team may have been deleted or you may not have access."
        );
      } else if (err.message.includes("not found")) {
        setMessage("This invite is no longer valid or has already been used.");
      } else {
        setMessage(
          "Failed to accept invite: " + (err.message || "Unknown error")
        );
      }
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "processing":
        return "text-blue-600";
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "processing":
        return "⏳";
      case "success":
        return "✅";
      case "error":
        return "❌";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-4xl mb-4">{getStatusIcon()}</div>
          <h3 className="text-lg font-semibold mb-2">
            {status === "processing" && "Processing Invite"}
            {status === "success" && "Invite Accepted!"}
            {status === "error" && "Invite Error"}
          </h3>
          <p className={`mb-4 ${getStatusColor()}`}>{message}</p>

          {status !== "processing" && (
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
            >
              {status === "success" ? "Continue" : "Close"}
            </button>
          )}

          {status === "processing" && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
