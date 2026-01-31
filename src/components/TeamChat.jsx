// src/components/TeamChat.jsx - Production Ready Fixed Version
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
import { useTimestamp } from "../hooks/useTimestamp";
import { 
  MessageSquare, Send, X, Edit2, Trash2, Reply, 
  Clock, Loader, Check, AlertCircle
} from 'lucide-react';

export default function TeamChat({
  teamId,
  teamName,
  position = "left",
  isOpen,
  onToggle,
}) {
  const { user } = useAuth();
  const { formatRelative } = useTimestamp();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load user profiles with caching
  async function loadUserProfiles(userIds) {
    const profiles = {};
    const uncachedIds = userIds.filter(id => !userProfiles[id]);
    
    if (uncachedIds.length === 0) return;

    for (const userId of uncachedIds) {
      try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) {
          profiles[userId] = docSnap.data();
        } else {
          // Fallback profile if user doc doesn't exist
          profiles[userId] = {
            name: "Unknown User",
            email: "",
            avatar: null
          };
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
        profiles[userId] = {
          name: "Unknown User",
          email: "",
          avatar: null
        };
      }
    }
    
    if (Object.keys(profiles).length > 0) {
      setUserProfiles((prev) => ({ ...prev, ...profiles }));
    }
  }

  // Load messages
  useEffect(() => {
    if (!teamId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
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

        // Load user profiles for all message authors
        const userIds = [
          ...new Set(messageData.map((m) => m.userId).filter(Boolean)),
        ];
        
        if (userIds.length > 0) {
          await loadUserProfiles(userIds);
        }

        // Auto-scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        console.error("Error loading messages:", error);
        setError("Failed to load messages. Please check your permissions.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle sending/editing messages
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending || !teamId) return;

    setSending(true);
    setError(null);

    try {
      if (editingMessage) {
        // ✅ EDIT MESSAGE - Update existing message
        const messageRef = doc(db, "teams", teamId, "chat", editingMessage.id);
        await updateDoc(messageRef, {
          text: newMessage.trim(),
          edited: true,
          editedAt: serverTimestamp(),
        });
        setEditingMessage(null);
      } else {
        // ✅ NEW MESSAGE - Matches security rules exactly
        const messageData = {
          userId: user.uid,
          userName: user.displayName || user.email || "Anonymous", // Optional but recommended
          text: newMessage.trim(),
          timestamp: serverTimestamp(),
        };

        // Add optional fields
        if (user.photoURL) {
          messageData.userAvatar = user.photoURL;
        }

        if (replyTo) {
          messageData.replyTo = {
            id: replyTo.id,
            text: replyTo.text,
            userName: replyTo.userName || "Unknown",
          };
        }

        const chatRef = collection(db, "teams", teamId, "chat");
        await addDoc(chatRef, messageData);
      }

      // Reset form
      setNewMessage("");
      setReplyTo(null);
      
      // Focus input for next message
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Better error messages
      let errorMessage = "Failed to send message. ";
      
      if (error.code === 'permission-denied') {
        errorMessage += "You don't have permission to send messages in this team.";
      } else if (error.code === 'failed-precondition') {
        errorMessage += "Please check your internet connection.";
      } else if (error.message?.includes('Missing or insufficient permissions')) {
        errorMessage += "Security rules prevented this action.";
      } else {
        errorMessage += "Please try again.";
      }
      
      setError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setSending(false);
    }
  }

  // Handle deleting messages
  async function handleDeleteMessage(messageId) {
    if (!confirm("Delete this message? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, "teams", teamId, "chat", messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      
      if (error.code === 'permission-denied') {
        setError("You don't have permission to delete this message.");
      } else {
        setError("Failed to delete message.");
      }
      
      setTimeout(() => setError(null), 5000);
    }
  }

  // Start editing a message
  function handleEditStart(message) {
    setEditingMessage(message);
    setNewMessage(message.text);
    setReplyTo(null); // Clear reply when editing
    inputRef.current?.focus();
  }

  // Cancel editing
  function handleCancelEdit() {
    setEditingMessage(null);
    setNewMessage("");
    inputRef.current?.focus();
  }

 

  // User Avatar Component
  function UserAvatar({ userId, userName }) {
    const profile = userProfiles[userId];
    const [imageError, setImageError] = useState(false);

    // Use avatar if available and not errored
    if (profile?.avatar && !imageError) {
      return (
        <img
          src={profile.avatar}
          alt={profile.name || userName || "User"}
          className="w-8 h-8 rounded-full object-cover border-2 border-white/20 flex-shrink-0"
          onError={() => setImageError(true)}
        />
      );
    }

    // Fallback to initials
    const displayName = profile?.name || userName || "U";
    const initials = displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
        style={{ backgroundColor: "var(--primary)" }}
        title={displayName}
      >
        {initials}
      </div>
    );
  }

  // Message Item Component
  function MessageItem({ message }) {
    const isMine = message.userId === user?.uid;
    const profile = userProfiles[message.userId];
    const displayName = profile?.name || message.userName || "Unknown User";

    return (
      <div
        className={`flex gap-2 mb-3 ${
          isMine ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <UserAvatar userId={message.userId} userName={message.userName} />

        <div 
          className={`flex flex-col ${isMine ? "items-end" : "items-start"}`} 
          style={{ maxWidth: "75%" }}
        >
          {/* Message Header */}
          <div
            className={`flex items-center gap-2 mb-1 ${
              isMine ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <span
              className="text-xs font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {displayName}
            </span>
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Clock size={10} />
              {formatRelative(message.timestamp)}
            </span>
          </div>

          {/* Reply Preview */}
          {message.replyTo && (
            <div
              className={`text-xs p-2 rounded mb-1 border-l-2 w-full`}
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--primary)",
              }}
            >
              <p 
                className="flex items-center gap-1 mb-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Reply size={10} />
                Replying to {message.replyTo.userName}
              </p>
              <p className="truncate" style={{ color: "var(--foreground)" }}>
                {message.replyTo.text}
              </p>
            </div>
          )}

          {/* Message Bubble */}
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
              
              {/* Edited Indicator */}
              {message.edited && (
                <span 
                  className="text-xs italic flex items-center gap-1 mt-1" 
                  style={{ opacity: 0.7 }}
                >
                  <Edit2 size={10} />
                  edited
                </span>
              )}
            </div>

            {/* Action Buttons (only for own messages) */}
            {isMine && (
              <div
                className={`absolute top-0 ${
                  isMine
                    ? "left-0 -translate-x-full"
                    : "right-0 translate-x-full"
                } opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 p-1 rounded-lg`}
                style={{ 
                  backgroundColor: "var(--card)", 
                  marginLeft: isMine ? '-4px' : '0', 
                  marginRight: isMine ? '0' : '-4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <button
                  onClick={() => handleEditStart(message)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Edit message"
                  style={{ color: "var(--foreground)" }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Delete message"
                  style={{ color: "var(--destructive)" }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setReplyTo(message)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Reply to message"
                  style={{ color: "var(--foreground)" }}
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

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 shadow-2xl ${
        position === "right" ? "right-0 border-l" : "left-80 border-r"
      }`}
      style={{
        top: 0,
        bottom: 10,
        width: "380px",
        backgroundColor: "var(--background)",
        borderColor: "var(--border)",
        zIndex: 200,
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
              <MessageSquare 
                size={20} 
                style={{ color: "var(--primary-foreground)" }} 
              />
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
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="px-4 py-3 flex items-center gap-2 border-b"
            style={{ 
              backgroundColor: "var(--destructive)", 
              color: "var(--destructive-foreground)",
              borderColor: "var(--border)"
            }}
          >
            <AlertCircle size={16} />
            <p className="text-sm flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Messages Body */}
        <div 
          className="flex-1 overflow-y-auto p-4" 
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139, 92, 246, 0.3) transparent'
          }}
        >
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
                <div 
                  className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" 
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <MessageSquare size={32} color="var(--muted-foreground)" />
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
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
            style={{ 
              backgroundColor: "var(--secondary)", 
              borderColor: "var(--border)" 
            }}
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
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Cancel reply"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Edit Indicator */}
        {editingMessage && (
          <div
            className="px-4 py-2 border-t flex items-center justify-between"
            style={{ 
              backgroundColor: "var(--secondary)", 
              borderColor: "var(--border)" 
            }}
          >
            <div className="flex-1 flex items-center gap-2">
              <Edit2 size={14} style={{ color: "var(--primary)" }} />
              <p
                className="text-xs"
                style={{ color: "var(--foreground)" }}
              >
                Editing message
              </p>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Cancel editing"
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
              maxLength={5000}
              style={{
                fontSize: '0.875rem',
                padding: '0.625rem 0.875rem'
              }}
              aria-label="Message input"
            />

            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="btn-primary px-3 py-2 flex items-center justify-center transition-all"
              style={{
                minWidth: '44px',
                opacity: !newMessage.trim() || sending ? 0.5 : 1,
                cursor: !newMessage.trim() || sending ? 'not-allowed' : 'pointer'
              }}
              aria-label={editingMessage ? "Save changes" : "Send message"}
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
          
          {/* Character Counter */}
          <div 
            className="text-xs text-right" 
            style={{ 
              color: newMessage.length > 4500 
                ? 'var(--destructive)' 
                : 'var(--muted-foreground)' 
            }}
          >
            {newMessage.length}/5000
          </div>
        </form>
      </div>
    </div>
  );
}
