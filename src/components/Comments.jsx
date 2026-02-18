// src/components/Comments.jsx — Redesigned UI
import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { updateCommentCount } from "../lib/promptStats";
import {
  collection, addDoc, onSnapshot, serverTimestamp,
  deleteDoc, doc, updateDoc, getDoc, orderBy, query, getDocs,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useTimestamp } from "../hooks/useTimestamp";
import { MessageCircle, Send, Edit2, Trash2, Reply, X, Loader2, MoreVertical, Check } from "lucide-react";

// ── Guest token ─────────────────────────────────────────────────────────────
function getOrCreateGuestToken() {
  let t = sessionStorage.getItem("guest_team_token");
  if (!t) {
    t = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 10)}`;
    sessionStorage.setItem("guest_team_token", t);
  }
  return t;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function initials(name, email) {
  if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return "U";
}

function Avatar({ src, name, email, size = 28 }) {
  const [err, setErr] = useState(false);
  const px = size + "px";
  if (!src || err) {
    return (
      <div style={{
        width: px, height: px, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg,rgba(139,92,246,.5),rgba(139,92,246,.2))",
        border: "1px solid rgba(139,92,246,.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size <= 28 ? "10px" : "12px", fontWeight: 700, color: "var(--primary)",
      }}>
        {initials(name, email)}
      </div>
    );
  }
  return (
    <img src={src} alt="" onError={() => setErr(true)}
      style={{ width: px, height: px, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid rgba(139,92,246,.2)" }} />
  );
}

// ── useComments hook ──────────────────────────────────────────────────────────
export function useComments(teamId, promptId) {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [profiles, setProfiles] = useState({});
  const [teamData, setTeamData] = useState(null);

  useEffect(() => {
    if (!teamId || !promptId) { setComments([]); setLoading(false); return; }

    getDoc(doc(db, "teams", teamId)).then(d => { if (d.exists()) setTeamData(d.data()); }).catch(() => {});

    const q = query(
      collection(db, "teams", teamId, "prompts", promptId, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(data);
      const ids = [...new Set(data.map(c => c.createdBy).filter(id => id && !id.startsWith("guest_")))];
      const p = {};
      for (const id of ids) {
        if (!p[id]) {
          try { const ud = await getDoc(doc(db, "users", id)); if (ud.exists()) p[id] = ud.data(); } catch {}
        }
      }
      setProfiles(p);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [teamId, promptId]);

  return { comments, loading, profiles, teamData };
}

// ── CommentForm ───────────────────────────────────────────────────────────────
export function CommentForm({ onSubmit, onCancel, placeholder = "Add a comment…", submitText = "Comment", autoFocus = false }) {
  const [text,        setText]        = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try { await onSubmit(text); setText(""); } catch { alert("Failed to submit. Try again."); }
    finally { setSubmitting(false); }
  }

  const over = text.length > 450;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: ".625rem" }}>
      <div style={{ position: "relative" }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          rows={3}
          autoFocus={autoFocus}
          disabled={submitting}
          style={{
            width: "100%", resize: "vertical", padding: ".625rem .75rem",
            background: "rgba(255,255,255,.03)", border: "1px solid var(--border)",
            borderRadius: "8px", color: "var(--foreground)", fontSize: ".82rem",
            lineHeight: 1.55, fontFamily: "inherit", transition: "border-color .15s",
            outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = "rgba(139,92,246,.5)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
        <span style={{ fontSize: ".65rem", color: over ? "#f87171" : "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
          {text.length}/500
        </span>
        <div style={{ display: "flex", gap: ".5rem" }}>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting}
              style={{
                padding: ".4rem .75rem", borderRadius: "6px", fontSize: ".75rem", fontWeight: 600,
                background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)",
                cursor: "pointer", transition: "all .15s",
              }}
            >Cancel</button>
          )}
          <button type="submit" disabled={!text.trim() || submitting || text.length > 500}
            style={{
              padding: ".4rem .875rem", borderRadius: "6px", fontSize: ".75rem", fontWeight: 700,
              background: "var(--primary)", color: "#fff", border: "none",
              cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: ".375rem",
              opacity: (!text.trim() || text.length > 500) ? .45 : 1,
            }}
          >
            {submitting && <Loader2 size={11} style={{ animation: "spin .75s linear infinite" }} />}
            <Send size={11} />
            {submitText}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Comment ───────────────────────────────────────────────────────────────────
export function Comment({ comment, profile, onDelete, onEdit, canModify, onReply, teamData, userRole, userId, activeMenuId, onMenuToggle }) {
  const [editing,      setEditing]      = useState(false);
  const [editText,     setEditText]     = useState(comment.text);
  const [replyOpen,    setReplyOpen]    = useState(false);
  const [hovered,      setHovered]      = useState(false);
  const menuRef = useRef(null);
  const { formatRelative } = useTimestamp();
  const { user } = useAuth();
  const showMenu = activeMenuId === comment.id;

  function getAuthorDisplay() {
    if (comment.isGuest) return { name: comment.guestName || "Guest", role: null, isGuest: true };
    const name = profile?.name || profile?.email || "Unknown";
    if (teamData?.members) {
      const r = teamData.members[comment.createdBy];
      if (r === "owner") return { name, role: "Owner",  isGuest: false };
      if (r === "admin") return { name, role: "Admin",  isGuest: false };
    }
    return { name, role: null, isGuest: false };
  }

  function canDeleteOwn() {
    if (comment.isGuest && !user) {
      const t = sessionStorage.getItem("guest_team_token");
      return t === comment.guestToken;
    }
    return false;
  }

  const author    = getAuthorDisplay();
  const canDelete = canModify || canDeleteOwn();
  const isReply   = !!comment.parentId;

  useEffect(() => {
    function outside(e) { if (menuRef.current && !menuRef.current.contains(e.target) && showMenu) onMenuToggle(null); }
    if (showMenu) { document.addEventListener("mousedown", outside); return () => document.removeEventListener("mousedown", outside); }
  }, [showMenu, onMenuToggle]);

  async function submitEdit() {
    if (!editText.trim()) return;
    try { await onEdit(comment.id, editText.trim()); setEditing(false); onMenuToggle(null); }
    catch { alert("Failed to update comment."); }
  }

  const roleColor = author.role === "Owner" ? "rgba(168,85,247,.9)" : "rgba(59,130,246,.9)";
  const roleBg    = author.role === "Owner" ? "rgba(168,85,247,.12)" : "rgba(59,130,246,.12)";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", gap: ".625rem",
        padding: ".75rem",
        borderRadius: "10px",
        background: isReply ? "rgba(255,255,255,.015)" : "rgba(255,255,255,.025)",
        border: "1px solid",
        borderColor: isReply ? "rgba(255,255,255,.04)" : "rgba(139,92,246,.08)",
        marginLeft: isReply ? "2rem" : 0,
        transition: "border-color .15s",
        ...(hovered && { borderColor: isReply ? "rgba(255,255,255,.07)" : "rgba(139,92,246,.15)" }),
      }}
    >
      {/* Avatar */}
      {comment.isGuest ? (
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
          background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "10px", fontWeight: 700, color: "var(--muted-foreground)",
        }}>G</div>
      ) : (
        <Avatar src={profile?.avatar} name={profile?.name} email={profile?.email} size={28} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".5rem", marginBottom: ".375rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".375rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--foreground)" }}>{author.name}</span>
            {author.role && (
              <span style={{
                fontSize: ".6rem", fontWeight: 700, padding: ".1rem .4rem", borderRadius: "4px",
                background: roleBg, color: roleColor, border: `1px solid ${roleColor}`,
              }}>{author.role}</span>
            )}
            {author.isGuest && (
              <span style={{
                fontSize: ".6rem", padding: ".1rem .4rem", borderRadius: "4px",
                background: "rgba(255,255,255,.05)", color: "var(--muted-foreground)",
              }}>Guest</span>
            )}
            <span style={{ fontSize: ".65rem", color: "var(--muted-foreground)" }}>
              {formatRelative(comment.createdAt)}
              {comment.updatedAt && <span style={{ marginLeft: ".25rem", opacity: .6 }}>· edited</span>}
            </span>
          </div>

          {/* Actions menu */}
          {(canModify || canDelete) && (
            <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => onMenuToggle(showMenu ? null : comment.id)}
                style={{
                  width: "26px", height: "26px", borderRadius: "6px", border: "none",
                  background: showMenu ? "rgba(139,92,246,.15)" : "transparent",
                  color: "var(--muted-foreground)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: hovered || showMenu ? 1 : 0, transition: "opacity .15s, background .15s",
                }}
              ><MoreVertical size={13} /></button>

              {showMenu && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 100,
                  minWidth: "130px", background: "var(--popover)",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  padding: ".25rem", boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                  animation: "cmMenuIn .12s ease-out",
                }}>
                  {canModify && (
                    <button
                      onClick={() => { setEditing(!editing); onMenuToggle(null); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: ".5rem",
                        padding: ".45rem .625rem", borderRadius: "6px", border: "none",
                        background: "transparent", color: "var(--foreground)",
                        fontSize: ".78rem", cursor: "pointer", transition: "background .12s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(139,92,246,.1)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Edit2 size={12} />{editing ? "Cancel Edit" : "Edit"}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => { onDelete(comment.id); onMenuToggle(null); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: ".5rem",
                        padding: ".45rem .625rem", borderRadius: "6px", border: "none",
                        background: "transparent", color: "#f87171",
                        fontSize: ".78rem", cursor: "pointer", transition: "background .12s",
                        marginTop: canModify ? ".25rem" : 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.1)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Trash2 size={12} />Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={3}
              style={{
                width: "100%", resize: "vertical", padding: ".5rem .625rem",
                background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.3)",
                borderRadius: "6px", color: "var(--foreground)", fontSize: ".8rem",
                fontFamily: "inherit", lineHeight: 1.5, outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: ".375rem" }}>
              <button onClick={submitEdit} disabled={!editText.trim()}
                style={{
                  padding: ".35rem .75rem", borderRadius: "6px", fontSize: ".73rem", fontWeight: 700,
                  background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: ".3rem",
                }}>
                <Check size={11} />Save
              </button>
              <button onClick={() => { setEditing(false); setEditText(comment.text); }}
                style={{
                  padding: ".35rem .75rem", borderRadius: "6px", fontSize: ".73rem",
                  background: "transparent", color: "var(--muted-foreground)",
                  border: "1px solid var(--border)", cursor: "pointer",
                }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: ".82rem", lineHeight: 1.6, color: "rgba(228,228,231,.85)", whiteSpace: "pre-wrap", margin: "0 0 .375rem 0" }}>
              {comment.text}
            </p>
            {!isReply && (
              <button
                onClick={() => setReplyOpen(!replyOpen)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: ".3rem",
                  fontSize: ".68rem", fontWeight: 600, color: "var(--primary)",
                  background: "none", border: "none", cursor: "pointer", padding: "0",
                  opacity: .8, transition: "opacity .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = .8}
              >
                <Reply size={11} />Reply
              </button>
            )}
          </>
        )}

        {/* Reply form */}
        {replyOpen && (
          <div style={{ marginTop: ".625rem", padding: ".625rem", borderRadius: "8px", background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)" }}>
            <CommentForm
              onSubmit={text => { onReply(comment.id, text); setReplyOpen(false); }}
              onCancel={() => setReplyOpen(false)}
              placeholder={`Reply to ${author.name}…`}
              submitText="Reply"
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes cmMenuIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── Main Comments Component ───────────────────────────────────────────────────
export default function Comments({ teamId, promptId, userRole }) {
  const { user }                              = useAuth();
  const { comments, loading, profiles, teamData } = useComments(teamId, promptId);
  const [showForm,     setShowForm]           = useState(false);
  const [activeMenuId, setActiveMenuId]       = useState(null);

  async function handleAdd(text, parentId = null) {
    if (!teamId || !promptId) return;
    const data = { text, createdAt: serverTimestamp(), parentId: parentId || null };
    if (user) {
      data.createdBy = user.uid;
    } else {
      const token = getOrCreateGuestToken();
      data.createdBy  = `guest_${token.substring(0, 16)}`;
      data.isGuest    = true;
      data.guestToken = token;
      data.guestName  = "Anonymous Guest";
    }
    await addDoc(collection(db, "teams", teamId, "prompts", promptId, "comments"), data);
    await updateCommentCount(teamId, promptId, 1);
  }

  async function handleEdit(id, text) {
    await updateDoc(doc(db, "teams", teamId, "prompts", promptId, "comments", id), { text, updatedAt: serverTimestamp() });
  }

  async function handleDelete(id) {
    if (!confirm("Delete this comment?")) return;
    const ref = collection(db, "teams", teamId, "prompts", promptId, "comments");
    const all  = await getDocs(ref);
    const replies = all.docs.filter(d => d.data().parentId === id);
    for (const r of replies) await deleteDoc(doc(db, "teams", teamId, "prompts", promptId, "comments", r.id));
    await deleteDoc(doc(db, "teams", teamId, "prompts", promptId, "comments", id));
    await updateCommentCount(teamId, promptId, -(1 + replies.length));
  }

  function canModify(c) {
    if (!user || !c) return false;
    return c.createdBy === user.uid || userRole === "owner" || userRole === "admin";
  }

  const topLevel = comments.reduce((acc, c) => {
    if (!c.parentId) acc.push({ ...c, replies: comments.filter(r => r.parentId === c.id) });
    return acc;
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", gap: ".625rem", color: "var(--muted-foreground)" }}>
        <Loader2 size={16} style={{ animation: "spin .75s linear infinite" }} />
        <span style={{ fontSize: ".8rem" }}>Loading comments…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: ".75rem", marginBottom: ".75rem",
        borderBottom: "1px solid rgba(139,92,246,.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <MessageCircle size={14} color="var(--primary)" />
          <span style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--foreground)" }}>
            Comments
          </span>
          <span style={{
            fontSize: ".65rem", fontWeight: 700, padding: ".1rem .45rem", borderRadius: "999px",
            background: "rgba(139,92,246,.15)", color: "var(--primary)",
          }}>{comments.length}</span>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "flex", alignItems: "center", gap: ".375rem",
              padding: ".375rem .75rem", borderRadius: "7px", fontSize: ".73rem", fontWeight: 700,
              background: "rgba(139,92,246,.12)", color: "var(--primary)",
              border: "1px solid rgba(139,92,246,.2)", cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,.12)"; }}
          >
            <Send size={11} />Add Comment
          </button>
        )}
      </div>

      {/* New comment form */}
      {showForm && (
        <div style={{
          padding: ".75rem", marginBottom: ".75rem", borderRadius: "10px",
          background: "rgba(139,92,246,.04)", border: "1px solid rgba(139,92,246,.12)",
        }}>
          <CommentForm
            onSubmit={text => { handleAdd(text); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
            placeholder="Share your thoughts about this prompt…"
            autoFocus
          />
        </div>
      )}

      {/* Empty state */}
      {topLevel.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "2rem .5rem" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%", margin: "0 auto .75rem",
            background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={18} color="rgba(139,92,246,.5)" />
          </div>
          <p style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--foreground)", marginBottom: ".25rem" }}>No comments yet</p>
          <p style={{ fontSize: ".73rem", color: "var(--muted-foreground)" }}>Be the first to share your thoughts.</p>
        </div>
      )}

      {/* Comment list */}
      {topLevel.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {topLevel.map(c => (
            <div key={c.id}>
              <Comment
                comment={c}
                profile={profiles[c.createdBy]}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onReply={(pid, text) => handleAdd(text, pid)}
                canModify={canModify(c)}
                teamData={teamData}
                userRole={userRole}
                userId={user?.uid}
                activeMenuId={activeMenuId}
                onMenuToggle={setActiveMenuId}
              />
              {c.replies?.length > 0 && (
                <div style={{ marginTop: ".375rem", display: "flex", flexDirection: "column", gap: ".375rem" }}>
                  {c.replies.map(r => (
                    <Comment
                      key={r.id}
                      comment={r}
                      profile={profiles[r.createdBy]}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      canModify={canModify(r)}
                      teamData={teamData}
                      userRole={userRole}
                      userId={user?.uid}
                      activeMenuId={activeMenuId}
                      onMenuToggle={setActiveMenuId}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
