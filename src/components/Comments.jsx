// src/components/Comments.jsx - FIXED VERSION
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { updateCommentCount } from "../lib/promptStats";
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
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useTimestamp } from "../hooks/useTimestamp";
import { 
  MessageCircle, 
  Send, 
  Edit2, 
  Trash2, 
  Reply, 
  X,
  Loader2,
  MoreVertical
} from "lucide-react";

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
  const [showMenu, setShowMenu] = useState(false);
  const { formatRelative } = useTimestamp();
  const { user } = useAuth();
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
    const avatarClass =
      size === "small" ? "w-8 h-8 md:w-9 md:h-9" : "w-10 h-10 md:w-11 md:h-11";
    const initialsClass = size === "small" ? "text-xs" : "text-sm";

    if (!src || imageError) {
      return (
        <div
          className={`${avatarClass} ${className} rounded-full flex items-center justify-center text-white font-bold transition-transform duration-200 hover:scale-105`}
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
        className={`${avatarClass} ${className} rounded-full border-2 transition-transform duration-200 hover:scale-105`}
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
      setShowMenu(false);
    } catch (error) {
      alert("Failed to update comment. Please try again.");
    }
  };


  return (
    <div
      className={`group relative p-4 md:p-5 rounded-xl border transition-all duration-200 hover:shadow-lg ${
        comment.parentId ? "ml-6 md:ml-12" : ""
      }`}
      style={{
        backgroundColor: comment.parentId 
          ? "var(--muted)" 
          : "var(--card)",
        borderColor: "var(--border)",
      }}
    >
     <div className="flex gap-3 md:gap-4">
  {/* ✅ Show badge for guest comments */}
  {comment.isGuest ? (
    <div 
      className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0 rounded-full flex items-center justify-center"
      style={{ backgroundColor: "var(--muted)" }}
    >
      <span 
        className="text-xs font-semibold"
        style={{ color: "var(--muted-foreground)" }}
      >
        G
      </span>
    </div>
  ) : (
    <UserAvatar
      src={profile?.avatar}
      name={profile?.name}
      email={profile?.email}
      size="small"
      className="flex-shrink-0"
    />
  )}

  <div className="flex-1 min-w-0">
    {/* Header */}
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className="text-sm md:text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {comment.isGuest 
              ? "Guest User" 
              : (profile?.name || profile?.email || "Unknown user")
            }
          </span>
          {comment.isGuest && (
            <span 
              className="text-xs px-2 py-0.5 rounded"
              style={{ 
                backgroundColor: "var(--muted)", 
                color: "var(--muted-foreground)" 
              }}
            >
              Guest
            </span>
          )}
        </div>
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
               <span>{formatRelative(comment.createdAt)}</span>
                {comment.updatedAt && (
                  <>
                    <span>•</span>
                    <span className="font-medium">(edited)</span>
                  </>
                )}
              </div>
            </div>

            {canModify && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 w-40 rounded-lg border shadow-xl z-10"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <button
                      onClick={() => {
                        setIsEditing(!isEditing);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors rounded-t-lg"
                      style={{ color: "var(--foreground)" }}
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>{isEditing ? "Cancel" : "Edit"}</span>
                    </button>
                    <button
                      onClick={() => {
                        onDelete(comment.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors rounded-b-lg"
                      style={{ color: "var(--destructive)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="form-input resize-none text-sm md:text-base w-full"
                rows={3}
                placeholder="Edit your comment..."
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  disabled={!editText.trim()}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  <Send className="w-3 h-3" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(comment.text);
                  }}
                  className="btn-secondary text-xs px-4 py-2 flex items-center gap-2"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p
                className="text-sm md:text-base whitespace-pre-wrap leading-relaxed mb-3"
                style={{ color: "var(--foreground)" }}
              >
                {comment.text}
              </p>

              {!comment.parentId && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  style={{ color: "var(--primary)" }}
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}
            </div>
          )}

          {/* Reply Form */}
          {showReplyForm && (
            <div
              className="mt-4 p-3 md:p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
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

async function handleSubmit(e) {
  e.preventDefault();
  if (!text.trim()) return;
  
  setIsSubmitting(true);
  try {
    await onSubmit(text);
    setText('');
  } catch (error) {
    console.error("Error submitting comment:", error);
    alert("Failed to submit comment. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="form-input resize-none text-sm md:text-base"
        rows={3}
        autoFocus={autoFocus}
        disabled={isSubmitting}
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div 
          className="text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
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
        <div className="flex gap-2 w-full sm:w-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="btn-secondary text-xs px-4 py-2 flex items-center gap-2 flex-1 sm:flex-none"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim() || isSubmitting || text.length > 500}
            className="btn-primary text-xs px-4 py-2 flex items-center justify-center gap-2 flex-1 sm:flex-none"
          >
            {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
            <Send className="w-3 h-3" />
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
  if (!teamId || !promptId) return;

  try {
    const commentData = {
      text,
      createdAt: serverTimestamp(),
      parentId: parentId || null,
    };
    
    // ✅ Support both authenticated users and team guests
    if (user) {
      // Authenticated user
      commentData.createdBy = user.uid;
    } else {
      // Team guest - use session-based identifier
      const guestToken = sessionStorage.getItem('guest_team_token');
      const guestId = guestToken 
        ? `guest_${guestToken.substring(0, 16)}` 
        : `guest_${Date.now()}`;
      
      commentData.createdBy = guestId;
      commentData.authorName = "Guest User";
      commentData.isGuest = true;  // ✅ Required by Firestore rules
    }
    
    await addDoc(
      collection(db, "teams", teamId, "prompts", promptId, "comments"),
      commentData
    );
    
    // ✅ Update stats
    await updateCommentCount(teamId, promptId, 1);
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

  function canDeleteComment(comment) {
  // ✅ Guests cannot delete (user is null)
  if (!user) return false;
  
  // ✅ Users can delete own comments or admins can delete any
  return comment.createdBy === user.uid || userRole === 'admin' || userRole === 'owner';
}

  // ✅ FIXED: Now counts and deletes all replies
  async function handleDeleteComment(commentId) {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const commentsRef = collection(db, "teams", teamId, "prompts", promptId, "comments");
      
      // Find all replies to this comment
      const repliesSnapshot = await getDocs(commentsRef);
      const replies = repliesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(comment => comment.parentId === commentId);
      
      // Calculate total deletions (parent + all replies)
      const totalDeletions = 1 + replies.length;
      
      // Delete all replies first
      for (const reply of replies) {
        await deleteDoc(
          doc(db, "teams", teamId, "prompts", promptId, "comments", reply.id)
        );
      }
      
      // Delete the parent comment
      await deleteDoc(
        doc(db, "teams", teamId, "prompts", promptId, "comments", commentId)
      );
      
      // ✅ Update stats with correct count (parent + replies)
      await updateCommentCount(teamId, promptId, -totalDeletions);
      
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
      <div className="glass-card p-6 md:p-8 text-center rounded-xl">
        <Loader2 
          className="w-8 h-8 animate-spin mx-auto mb-4"
          style={{ color: "var(--primary)" }}
        />
        <span
          className="text-xs md:text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          Loading comments...
        </span>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
      {/* Header */}
      <div
        className="p-4 md:p-6 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h3
                className="text-base md:text-lg font-bold"
                style={{ color: "var(--foreground)" }}
              >
                Comments
              </h3>
              <p 
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {commentCount} {commentCount === 1 ? "comment" : "comments"}
              </p>
            </div>
          </div>

          {!showCommentForm && (
            <button
              onClick={() => setShowCommentForm(true)}
              className="btn-primary text-xs md:text-sm px-4 py-2 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <MessageCircle className="w-4 h-4" />
              Add Comment
            </button>
          )}
        </div>
      </div>

      {/* Comment Form */}
      {showCommentForm && (
        <div
          className="p-4 md:p-6 border-b"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--muted)",
          }}
        >
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
      <div className="p-4 md:p-6">
        {topLevelComments.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--muted)" }}
            >
              <MessageCircle 
                className="w-8 h-8"
                style={{ color: "var(--muted-foreground)" }}
              />
            </div>
            <p
              className="text-base md:text-lg font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              No comments yet
            </p>
            <p
              className="text-xs md:text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
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
                  <div className="mt-4 md:mt-5 space-y-4 md:space-y-5">
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
