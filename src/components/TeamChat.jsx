// src/components/TeamChat.jsx - Fixed UI Issues
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
import { 
  MessageSquare, Send, X, Edit2, Trash2, Reply, 
  Clock, MoreVertical, Check, Loader
} from 'lucide-react';

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

        messageData.reverse();
        setMessages(messageData);
        setLoading(false);

        const userIds = [
          ...new Set(messageData.map((m) => m.userId).filter(Boolean)),
        ];
        if (userIds.length > 0) {
          await loadUserProfiles(userIds);
        }

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

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

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
        const messageRef = doc(db, "teams", teamId, "chat", editingMessage.id);
        await updateDoc(messageRef, {
          text: newMessage.trim(),
          edited: true,
          editedAt: serverTimestamp(),
        });
        setEditingMessage(null);
      } else {
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

  async function handleDeleteMessage(messageId) {
    if (!confirm("Delete this message?")) return;

    try {
      await deleteDoc(doc(db, "teams", teamId, "chat", messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message.");
    }
  }

  function handleEditStart(message) {
    setEditingMessage(message);
    setNewMessage(message.text);
    inputRef.current?.focus();
  }

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

  function MessageItem({ message }) {
    const isMine = message.userId === user?.uid;
    const profile = userProfiles[message.userId];

    return (
      <div
        className={`flex gap-2 mb-3 ${
          isMine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <UserAvatar userId={message.userId} />

        <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`} style={{ maxWidth: "75%" }}>
          <div
            className={`flex items-center gap-2 mb-1 ${
              isMine ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <span
              className="text-xs font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {profile?.name || message.userName}
            </span>
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Clock size={10} />
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          {message.replyTo && (
            <div
              className={`text-xs p-2 rounded mb-1 border-l-2 w-full`}
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--primary)",
              }}
            >
              <p style={{ color: "var(--muted-foreground)" }}>
                <Reply size={10} style={{ display: 'inline', marginRight: '4px' }} />
                Replying to {message.replyTo.userName}
              </p>
              <p className="truncate" style={{ color: "var(--foreground)" }}>
                {message.replyTo.text}
              </p>
            </div>
          )}

          <div className="relative group">
            <div
              className="px-3 py-2 rounded-lg inline-block"
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
                <span className="text-xs italic flex items-center gap-1 mt-1" style={{ opacity: 0.7 }}>
                  <Edit2 size={10} />
                  (edited)
                </span>
              )}
            </div>

            {isMine && (
              <div
                className={`absolute top-0 ${
                  isMine
                    ? "left-0 -translate-x-full"
                    : "right-0 translate-x-full"
                } opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1 rounded-lg`}
                style={{ backgroundColor: "var(--card)", marginLeft: isMine ? '-4px' : '0', marginRight: isMine ? '0' : '-4px' }}
              >
                <button
                  onClick={() => handleEditStart(message)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Delete"
                  style={{ color: "var(--destructive)" }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setReplyTo(message)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Reply"
                >
                  <Reply size={14} />
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
      className={`fixed z-50 transition-all duration-300 shadow-2xl ${
        position === "right" ? "right-0 border-l" : "left-80 border-r"
      }`}
      style={{
        top: "125px", // Below navbar
        bottom: 0,
        width: "380px",
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
              <MessageSquare size={20} style={{ color: "var(--primary-foreground)" }} />
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
            <X size={20} />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4" style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(139, 92, 246, 0.3) transparent'
        }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader className="neo-spinner mx-auto mb-2" size={24} />
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
                <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--muted)' }}>
                  <MessageSquare size={32} color="var(--muted-foreground)" />
                </div>
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
            className="px-4 py-2 border-t flex items-center justify-between"
            style={{ backgroundColor: "var(--secondary)", borderColor: "var(--border)" }}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-xs flex items-center gap-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Reply size={12} />
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
              <X size={16} />
            </button>
          </div>
        )}

        {/* Edit Indicator */}
        {editingMessage && (
          <div
            className="px-4 py-2 border-t flex items-center justify-between"
            style={{ backgroundColor: "var(--secondary)", borderColor: "var(--border)" }}
          >
            <div className="flex-1 flex items-center gap-2">
              <Edit2 size={14} />
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
              <X size={16} />
            </button>
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex gap-2 mb-1">
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
              style={{
                fontSize: '0.875rem',
                padding: '0.625rem 0.875rem'
              }}
            />

            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="btn-primary px-3 py-2 flex items-center justify-center"
              style={{
                minWidth: '44px',
                opacity: !newMessage.trim() || sending ? 0.5 : 1
              }}
            >
              {sending ? (
                <Loader className="neo-spinner" size={18} />
              ) : editingMessage ? (
                <Check size={18} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <div className="text-xs text-right" style={{ color: 'var(--muted-foreground)' }}>
            {newMessage.length}/1000
          </div>
        </form>
      </div>
    </div>
  );
}
