// src/components/Comments.jsx - Updated to match PromptList UI style
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// Comments hook
export function useComments(teamId, promptId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    if (!teamId || !promptId) {
      setComments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "teams", teamId, "prompts", promptId, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const commentData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setComments(commentData);

        const authorIds = [
          ...new Set(commentData.map((c) => c.createdBy).filter(Boolean)),
        ];
        const profilesData = {};

        for (const authorId of authorIds) {
          if (!profilesData[authorId]) {
            try {
              const userDoc = await getDoc(doc(db, "users", authorId));
              if (userDoc.exists()) {
                profilesData[authorId] = userDoc.data();
              }
            } catch (error) {
              console.error("Error loading comment author profile:", error);
            }
          }
        }

        setProfiles(profilesData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading comments:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [teamId, promptId]);

  return { comments, loading, profiles };
}

// Individual comment component
export function Comment({
  comment,
  profile,
  onDelete,
  onEdit,
  canModify,
  onReply,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [showReplyForm, setShowReplyForm] = useState(false);

  function getUserInitials(name, email) {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  }

  function UserAvatar({ src, name, email, size = "small", className = "" }) {
    const [imageError, setImageError] = useState(false);
    const avatarClass = size === "small" ? "w-8 h-8" : "w-10 h-10";
    const initialsClass = size === "small" ? "text-xs" : "text-sm";

    if (!src || imageError) {
      return (
        <div
          className={`${avatarClass} ${className} rounded-full flex items-center justify-center text-white font-bold transition-transform duration-300 hover:scale-110`}
          style={{ backgroundColor: "var(--primary)" }}
        >
          <span className={initialsClass}>{getUserInitials(name, email)}</span>
        </div>
      );
    }

    return (
      <img
        src={src}
        alt="avatar"
        className={`${avatarClass} ${className} rounded-full border-2 transition-transform duration-300 hover:scale-110`}
        style={{ borderColor: "var(--border)" }}
        onError={() => setImageError(true)}
      />
    );
  }

  const handleEdit = async () => {
    if (!editText.trim()) return;

    try {
      await onEdit(comment.id, editText.trim());
      setIsEditing(false);
    } catch (error) {
      alert("Failed to update comment. Please try again.");
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={`group flex gap-4 p-4 rounded-lg border transition-all duration-300 hover:border-primary/50 ${
        comment.parentId ? "ml-8 bg-muted/30" : ""
      }`}
      style={{
        backgroundColor: comment.parentId ? "var(--muted)" : "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <UserAvatar
        src={profile?.avatar}
        name={profile?.name}
        email={profile?.email}
        size="small"
        className="mt-0.5 flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {profile?.name || profile?.email || "Unknown user"}
            </span>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span>{formatDate(comment.createdAt)}</span>
              {comment.updatedAt && (
                <span className="font-medium">(edited)</span>
              )}
            </div>
          </div>

          {canModify && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "var(--secondary)",
                  color: "var(--foreground)",
                }}
              >
                {isEditing ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "var(--destructive)",
                  color: "var(--destructive-foreground)",
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="form-input resize-none"
              rows={3}
              placeholder="Edit your comment..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                disabled={!editText.trim()}
                className="btn-primary text-xs px-4 py-2"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditText(comment.text);
                }}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--foreground)" }}>
              {comment.text}
            </p>

            {!comment.parentId && (
              <div className="mt-3">
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-xs font-semibold transition-all duration-200 hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  💬 Reply
                </button>
              </div>
            )}
          </div>
        )}

        {showReplyForm && (
          <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <CommentForm
              onSubmit={(text) => {
                onReply(comment.id, text);
                setShowReplyForm(false);
              }}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`Reply to ${profile?.name || "user"}...`}
              submitText="Reply"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Comment form component
export function CommentForm({
  onSubmit,
  onCancel,
  placeholder = "Add a comment...",
  submitText = "Comment",
  autoFocus = false,
}) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (error) {
      alert("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="form-input resize-none"
        rows={3}
        autoFocus={autoFocus}
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span
            className={`font-medium ${
              text.length > 400
                ? "text-yellow-500"
                : text.length > 450
                ? "text-red-500"
                : ""
            }`}
          >
            {text.length}/500
          </span>
          <span className="ml-1">characters</span>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim() || isSubmitting || text.length > 500}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
          >
            {isSubmitting && <div className="neo-spinner w-3 h-3"></div>}
            {submitText}
          </button>
        </div>
      </div>
    </form>
  );
}

// Main comments component
export default function Comments({ teamId, promptId, userRole }) {
  const { user } = useAuth();
  const { comments, loading, profiles } = useComments(teamId, promptId);
  const [showCommentForm, setShowCommentForm] = useState(false);

  async function handleAddComment(text, parentId = null) {
    if (!teamId || !promptId || !user) return;

    try {
      await addDoc(
        collection(db, "teams", teamId, "prompts", promptId, "comments"),
        {
          text,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          parentId: parentId || null,
        }
      );
    } catch (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
  }

  async function handleEditComment(commentId, newText) {
    if (!teamId || !promptId) return;

    try {
      await updateDoc(
        doc(db, "teams", teamId, "prompts", promptId, "comments", commentId),
        {
          text: newText,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error("Error editing comment:", error);
      throw error;
    }
  }

  async function handleDeleteComment(commentId) {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteDoc(
        doc(db, "teams", teamId, "prompts", promptId, "comments", commentId)
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment. Please try again.");
    }
  }

  async function handleReply(parentId, text) {
    await handleAddComment(text, parentId);
  }

  function canModifyComment(comment) {
    if (!user || !comment) return false;
    return (
      comment.createdBy === user.uid ||
      userRole === "owner" ||
      userRole === "admin"
    );
  }

  const organizedComments = comments.reduce((acc, comment) => {
    if (!comment.parentId) {
      acc.push({
        ...comment,
        replies: comments.filter((c) => c.parentId === comment.id),
      });
    }
    return acc;
  }, []);

  const topLevelComments = organizedComments;
  const commentCount = comments.length;

  if (loading) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Loading comments...
        </span>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold" style={{ color: "var(--foreground)" }}>
              💬 Comments
              <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                {commentCount}
              </span>
            </h3>
          </div>

          {!showCommentForm && (
            <button
              onClick={() => setShowCommentForm(true)}
              className="btn-primary text-sm px-4 py-2"
            >
              <span className="mr-2">+</span>
              Add Comment
            </button>
          )}
        </div>
      </div>

      {/* Comment Form */}
      {showCommentForm && (
        <div className="p-6 border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
          <CommentForm
            onSubmit={(text) => {
              handleAddComment(text);
              setShowCommentForm(false);
            }}
            onCancel={() => setShowCommentForm(false)}
            placeholder="Share your thoughts about this prompt..."
            autoFocus={true}
          />
        </div>
      )}

      {/* Comments List */}
      <div className="p-6">
        {topLevelComments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium mb-2" style={{ color: "var(--foreground)" }}>
              No comments yet
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {topLevelComments.map((comment) => (
              <div key={comment.id}>
                <Comment
                  comment={comment}
                  profile={profiles[comment.createdBy]}
                  onDelete={handleDeleteComment}
                  onEdit={handleEditComment}
                  onReply={handleReply}
                  canModify={canModifyComment(comment)}
                />

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {comment.replies.map((reply) => (
                      <Comment
                        key={reply.id}
                        comment={reply}
                        profile={profiles[reply.createdBy]}
                        onDelete={handleDeleteComment}
                        onEdit={handleEditComment}
                        canModify={canModifyComment(reply)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
