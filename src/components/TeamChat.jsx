// src/components/TeamChat.jsx - Real-time Team Chat Interface
import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function TeamChat({
  teamId,
  teamName,
  position = "left",
  isOpen,
  onToggle,
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load user profiles
  async function loadUserProfiles(userIds) {
    const profiles = {};
    for (const userId of userIds) {
      if (!userProfiles[userId]) {
        try {
          const docSnap = await getDoc(doc(db, "users", userId));
          if (docSnap.exists()) {
            profiles[userId] = docSnap.data();
          }
        } catch (error) {
          console.error("Error loading user profile:", error);
        }
      }
    }
    setUserProfiles((prev) => ({ ...prev, ...profiles }));
  }

  // Load messages
  useEffect(() => {
    if (!teamId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesRef = collection(db, "teams", teamId, "chat");
    const q = query(messagesRef, orderBy("timestamp", "desc"), limit(100));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const messageData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Reverse to show oldest first
        messageData.reverse();
        setMessages(messageData);
        setLoading(false);

        // Load user profiles
        const userIds = [
          ...new Set(messageData.map((m) => m.userId).filter(Boolean)),
        ];
        if (userIds.length > 0) {
          await loadUserProfiles(userIds);
        }

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        console.error("Error loading messages:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Send or edit message
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending || !teamId) return;

    setSending(true);
    try {
      const messageData = {
        userId: user.uid,
        userName: user.displayName || user.email,
        userAvatar: user.photoURL || null,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        reactions: {},
      };

      if (replyTo) {
        messageData.replyTo = {
          id: replyTo.id,
          text: replyTo.text,
          userName: replyTo.userName,
        };
      }

      if (editingMessage) {
        // Update existing message
        const messageRef = doc(db, "teams", teamId, "chat", editingMessage.id);
        await updateDoc(messageRef, {
          text: newMessage.trim(),
          edited: true,
          editedAt: serverTimestamp(),
        });
        setEditingMessage(null);
      } else {
        // Create new message
        const chatRef = collection(db, "teams", teamId, "chat");
        await addDoc(chatRef, messageData);
      }

      setNewMessage("");
      setReplyTo(null);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Delete message
  async function handleDeleteMessage(messageId) {
    if (!confirm("Delete this message?")) return;

    try {
      await deleteDoc(doc(db, "teams", teamId, "chat", messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message.");
    }
  }

  // Start editing a message
  function handleEditStart(message) {
    setEditingMessage(message);
    setNewMessage(message.text);
    inputRef.current?.focus();
  }

  // Format timestamp
  function formatTimestamp(timestamp) {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  // User Avatar Component
  function UserAvatar({ userId }) {
    const profile = userProfiles[userId];
    const [imageError, setImageError] = useState(false);

    if (!profile?.avatar || imageError) {
      const name = profile?.name || profile?.email || "U";
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      return (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        src={profile.avatar}
        alt="avatar"
        className="w-8 h-8 rounded-full object-cover border-2 border-white/20 flex-shrink-0"
        onError={() => setImageError(true)}
      />
    );
  }

  // Message Item Component
  function MessageItem({ message }) {
    const isMine = message.userId === user?.uid;
    const profile = userProfiles[message.userId];

    return (
      <div
        className={`flex gap-2 mb-4 ${
          isMine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <UserAvatar userId={message.userId} />

        <div className={`flex-1 ${isMine ? "items-end" : "items-start"}`}>
          <div
            className={`flex items-center gap-2 mb-1 ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            <span
              className="text-xs font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {profile?.name || message.userName}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          {/* Reply indicator */}
          {message.replyTo && (
            <div
              className={`text-xs p-2 rounded mb-1 border-l-2 ${
                isMine ? "ml-auto" : "mr-auto"
              }`}
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--primary)",
                maxWidth: "80%",
              }}
            >
              <p style={{ color: "var(--muted-foreground)" }}>
                Replying to {message.replyTo.userName}
              </p>
              <p className="truncate" style={{ color: "var(--foreground)" }}>
                {message.replyTo.text}
              </p>
            </div>
          )}

          <div
            className={`relative group ${isMine ? "ml-auto" : "mr-auto"}`}
            style={{ maxWidth: "80%" }}
          >
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: isMine ? "var(--primary)" : "var(--secondary)",
                color: isMine
                  ? "var(--primary-foreground)"
                  : "var(--foreground)",
              }}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.text}
              </p>
              {message.edited && (
                <span className="text-xs italic" style={{ opacity: 0.7 }}>
                  (edited)
                </span>
              )}
            </div>

            {/* Message Actions */}
            {isMine && (
              <div
                className={`absolute top-0 ${
                  isMine
                    ? "left-0 -translate-x-full"
                    : "right-0 translate-x-full"
                } opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1 rounded-lg ml-2`}
                style={{ backgroundColor: "var(--card)" }}
              >
                <button
                  onClick={() => handleEditStart(message)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Edit"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Delete"
                  style={{ color: "var(--destructive)" }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setReplyTo(message)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Reply"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-0 bottom-0 z-40 transition-all duration-300 shadow-2xl w-96 ${
        position === "right" ? "right-0 border-l" : "left-80 border-r"
      }`}
      style={{
        backgroundColor: "var(--background)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex justify-between items-center p-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="text-lg"
                style={{ color: "var(--primary-foreground)" }}
              >
                💬
              </span>
            </div>
            <div>
              <h3
                className="font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Team Chat
              </h3>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {teamName}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="neo-spinner mx-auto mb-2"></div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Loading messages...
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <div className="text-4xl mb-2">💬</div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  No messages yet
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Start the conversation!
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Reply Indicator */}
        {replyTo && (
          <div
            className="px-4 py-2 border-t border-white/10 flex items-center justify-between"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Replying to {replyTo.userName}
              </p>
              <p
                className="text-sm truncate"
                style={{ color: "var(--foreground)" }}
              >
                {replyTo.text}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Edit Indicator */}
        {editingMessage && (
          <div
            className="px-4 py-2 border-t border-white/10 flex items-center justify-between"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div className="flex-1">
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Editing message
              </p>
            </div>
            <button
              onClick={() => {
                setEditingMessage(null);
                setNewMessage("");
              }}
              className="p-1 hover:bg-white/10 rounded"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-white/10"
        >
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  editingMessage ? "Edit your message..." : "Type a message..."
                }
                className="form-input flex-1"
                disabled={sending}
                maxLength={1000}
              />

              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="btn-primary px-4 py-2 flex items-center gap-2"
              >
                {sending ? (
                  <div className="neo-spinner w-4 h-4"></div>
                ) : editingMessage ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* Character Count Display */}
          <div className="text-xs py-1 text-gray-400 text-right">
            {newMessage.length}/1000
          </div>
        </form>
      </div>
    </div>
  );
}
