// src/components/TeamMembers.jsx - RESPONSIVE + PERF: parallel member/invite loads
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  doc, getDoc, getDocs, collection, updateDoc, deleteDoc,
  query, where, onSnapshot, Timestamp,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { cancelTeamInvite, deleteTeamInvite } from "../lib/inviteUtils";
import { batchGetUserProfiles } from "../lib/firestoreUtils"; // ✅ PERF: batch reads
import {
  Users, Crown, Shield, User, Trash2,
  Mail, Clock, Calendar, X, LogOut, Eye,
  ChevronDown, ChevronUp,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); }
  catch { return "—"; }
}

function timeRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diff = expiresAt.toDate() - new Date();
  if (diff <= 0) return "Expired";
  const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return "<1h";
}

const ROLE_CFG = {
  owner:  { icon: Crown,  color: "#f59e0b", bg: "rgba(245,158,11,.1)",   border: "rgba(245,158,11,.2)",   label: "Owner"  },
  admin:  { icon: Shield, color: "#8b5cf6", bg: "rgba(139,92,246,.1)",   border: "rgba(139,92,246,.2)",   label: "Admin"  },
  member: { icon: User,   color: "#64748b", bg: "rgba(100,116,139,.08)", border: "rgba(100,116,139,.16)", label: "Member" },
};
const getRoleCfg = r => ROLE_CFG[r] || ROLE_CFG.member;

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ src, name, email, size = 38 }) {
  const [err, setErr] = useState(false);
  const px = size + "px";
  const base = { width:px, height:px, borderRadius:"50%", flexShrink:0,
    display:"flex", alignItems:"center", justifyContent:"center" };
  if (!src || err) {
    const i = name
      ? name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)
      : email ? email[0].toUpperCase() : "U";
    return (
      <div style={{ ...base, background:"linear-gradient(135deg,rgba(139,92,246,.45),rgba(99,102,241,.2))",
        border:"1px solid rgba(139,92,246,.2)", fontSize:"11px", fontWeight:700, color:"#c4b5fd" }}>{i}</div>
    );
  }
  return <img src={src} alt="" onError={()=>setErr(true)}
    style={{ ...base, objectFit:"cover", border:"1px solid rgba(139,92,246,.15)" }} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TeamMembers({ teamId, teamName, userRole, teamData }) {
  const { user } = useAuth();
  const [members,           setMembers]           = useState([]);
  const [pendingInvites,    setPendingInvites]     = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [processingActions, setProcessingActions] = useState(new Set());
  const [guestStats,        setGuestStats]        = useState({ totalAccesses: 0 });
  const [loadingGuest,      setLoadingGuest]      = useState(true);
  const [isLeaving,         setIsLeaving]         = useState(false);
  const [permsExpanded,     setPermsExpanded]     = useState(false);

  // ✅ PERF: Load all member profiles in parallel using batchGetUserProfiles
  useEffect(() => {
    if (!teamId || !teamData) { setLoading(false); return; }

    async function load() {
      const entries = Object.entries(teamData.members || {});
      const uids = entries.map(([uid]) => uid);

      // Single batched call instead of N sequential getDoc calls
      const profiles = await batchGetUserProfiles(uids);

      const list = entries.map(([uid, role]) => {
        const p = profiles[uid];
        return p
          ? { uid, role, ...p }
          : { uid, role, email: `user-${uid}@unknown`, name: `User ${uid.slice(-4)}` };
      });

      const order = { owner:0, admin:1, member:2 };
      list.sort((a, b) => (order[a.role] || 2) - (order[b.role] || 2));
      setMembers(list);
      setLoading(false);
    }

    load().catch(err => {
      console.error("Error loading members:", err);
      setLoading(false);
    });
  }, [teamId, teamData]);

  // guest stats
  useEffect(() => {
    if (!teamId) return;
    const q = query(collection(db, "guest-team-access"), where("teamId","==",teamId));
    setLoadingGuest(true);
    const unsub = onSnapshot(q, snap => {
      const now = new Date();
      let total = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.status === "active") {
          const exp = data.expiresAt?.toDate();
          if (!exp || exp > now) total += data.accessCount || 0;
        }
      });
      setGuestStats({ totalAccesses: total }); setLoadingGuest(false);
    });
    return () => unsub();
  }, [teamId]);

  // invites
  useEffect(() => {
    if (!teamId) return;
    const q = query(collection(db,"team-invites"), where("teamId","==",teamId), where("status","==","pending"));
    const unsub = onSnapshot(q, snap => {
      const now = Timestamp.now();
      const invites = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .filter(i => !i.expiresAt || i.expiresAt.toMillis() >= now.toMillis());
      invites.sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
      setPendingInvites(invites);
    });
    return () => unsub();
  }, [teamId]);

  function setProc(key, on) {
    setProcessingActions(prev => { const s = new Set(prev); on ? s.add(key) : s.delete(key); return s; });
  }

  function notify(msg, type="info") {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = `position:fixed;top:1.25rem;right:1.25rem;z-index:99999;
      padding:.6rem 1rem;border-radius:8px;font-size:.8rem;font-weight:600;
      background:var(--card);color:var(--foreground);
      border:1px solid ${type==="error"?"var(--destructive)":"var(--primary)"};
      box-shadow:0 8px 28px rgba(0,0,0,.45);`;
    document.body.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; setTimeout(()=>el.remove(),300); },4000);
  }

  async function changeMemberRole(uid, newRole) {
    if (!canManageRoles() || uid === user.uid) return;
    setProc(`role-${uid}`, true);
    try {
      await updateDoc(doc(db,"teams",teamId), { [`members.${uid}`]: newRole });
      notify(`Role updated to ${newRole}`);
    } catch { notify("Failed to update role","error"); }
    finally { setProc(`role-${uid}`, false); }
  }

  async function removeMember(uid) {
    if (!canRemoveMembers() || uid === user.uid) return;
    const m = members.find(x => x.uid === uid);
    if (!m || !confirm(`Remove ${m.name||m.email} from the team?`)) return;
    setProc(`remove-${uid}`, true);
    try {
      const teamDoc = await getDoc(doc(db,"teams",teamId));
      if (teamDoc.exists()) {
        const curr = { ...teamDoc.data().members };
        delete curr[uid];
        await updateDoc(doc(db,"teams",teamId), { members: curr });
      }
      notify(`${m.name||m.email} removed`);
    } catch { notify("Failed to remove member","error"); }
    finally { setProc(`remove-${uid}`, false); }
  }

  async function handleLeaveTeam() {
    if (!user || userRole==="owner") return;
    if (!confirm(`Leave "${teamName}"? You'll lose access to all team prompts.`)) return;
    setIsLeaving(true);
    try {
      const teamDoc = await getDoc(doc(db,"teams",teamId));
      if (teamDoc.exists()) {
        const curr = { ...teamDoc.data().members };
        delete curr[user.uid];
        await updateDoc(doc(db,"teams",teamId), { members:curr });
      }
      notify("You have left the team");
      setTimeout(() => { window.location.href = "/"; }, 500);
    } catch { notify("Failed to leave team","error"); setIsLeaving(false); }
  }

  async function cancelInvite(id) {
    if (!canManageInvites() || !confirm("Cancel this invitation?")) return;
    setProc(`cancel-${id}`, true);
    try {
      const r = await deleteTeamInvite(id);
      if (r.success) notify("Invitation cancelled");
      else throw new Error(r.error);
    } catch { notify("Failed to cancel invitation","error"); }
    finally { setProc(`cancel-${id}`, false); }
  }

  const canManageRoles   = () => userRole === "owner";
  const canRemoveMembers = () => userRole === "owner" || userRole === "admin";
  const canManageInvites = () => userRole === "owner" || userRole === "admin";
  const canModifyMember  = m => m.uid !== user?.uid && (userRole==="owner" || (userRole==="admin" && m.role==="member"));

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"4rem", gap:".75rem" }}>
      <style>{`@keyframes tmSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:18,height:18,borderRadius:"50%",border:"2px solid rgba(139,92,246,.15)",borderTopColor:"#8b5cf6",animation:"tmSpin .75s linear infinite" }} />
      <span style={{ fontSize:".82rem",color:"var(--muted-foreground)" }}>Loading members…</span>
    </div>
  );

  const adminsCount = members.filter(m => m.role==="admin"||m.role==="owner").length;

  return (
    <>
      <style>{`
        @keyframes tmSpin    { to{transform:rotate(360deg)} }
        @keyframes tmFadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

        .tm-wrap { display:flex; flex-direction:column; gap:.875rem; }

        .tm-summary {
          background:var(--card); border:1px solid rgba(255,255,255,.05);
          border-radius:12px; overflow:hidden;
        }
        .tm-sum-head {
          display:flex; align-items:center; justify-content:space-between; gap:1rem;
          padding:.875rem 1.125rem; border-bottom:1px solid rgba(255,255,255,.04); flex-wrap:wrap;
        }
        .tm-sum-left { display:flex; align-items:center; gap:.625rem; min-width:0; flex:1; }
        .tm-sum-icon {
          width:34px; height:34px; border-radius:9px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background:rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.2);
        }
        .tm-sum-title    { font-size:.88rem; font-weight:700; color:var(--foreground); letter-spacing:-.01em; }
        .tm-sum-subtitle { font-size:.68rem; color:var(--muted-foreground); margin-top:.1rem; }

        .tm-leave {
          display:flex; align-items:center; gap:.4rem; padding:.35rem .75rem; border-radius:7px;
          font-size:.73rem; font-weight:600; cursor:pointer; transition:all .14s;
          background:rgba(239,68,68,.08); color:rgba(239,68,68,.9);
          border:1px solid rgba(239,68,68,.2); flex-shrink:0;
        }
        .tm-leave:hover    { background:rgba(239,68,68,.15); border-color:rgba(239,68,68,.35); }
        .tm-leave:disabled { opacity:.5; cursor:not-allowed; }

        .tm-tiles {
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:.5rem;
          padding:.875rem 1.125rem;
        }
        @media(max-width:600px){ .tm-tiles { grid-template-columns:repeat(2,1fr); } }

        .tm-tile {
          padding:.7rem .625rem; border-radius:9px; text-align:center;
          background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05);
          transition:border-color .14s;
        }
        .tm-tile:hover { border-color:rgba(139,92,246,.14); }
        .tm-tile-n { font-size:1.2rem; font-weight:800; letter-spacing:-.04em; font-variant-numeric:tabular-nums; line-height:1; margin-bottom:.22rem; }
        .tm-tile-l { font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted-foreground); }

        .tm-panel {
          background:var(--card); border:1px solid rgba(255,255,255,.05);
          border-radius:12px; overflow:hidden;
          animation:tmFadeUp .28s ease-out backwards;
        }
        .tm-panel-head {
          display:flex; align-items:center; gap:.5rem;
          padding:.625rem 1.125rem; border-bottom:1px solid rgba(255,255,255,.04);
          font-size:.74rem; font-weight:700; color:var(--foreground);
        }
        .tm-panel-cnt {
          font-size:.61rem; font-weight:700; padding:.08rem .38rem; border-radius:4px;
          background:rgba(139,92,246,.1); color:#c4b5fd; font-variant-numeric:tabular-nums;
        }

        .tm-list { display:flex; flex-direction:column; }
        .tm-row {
          display:flex; align-items:center; justify-content:space-between; gap:.75rem;
          padding:.625rem 1.125rem; border-bottom:1px solid rgba(255,255,255,.025);
          transition:background .12s; flex-wrap:wrap;
        }
        .tm-row:last-child { border-bottom:none; }
        .tm-row:hover { background:rgba(255,255,255,.013); }
        .tm-row.me { border-left:2px solid rgba(139,92,246,.4); padding-left:calc(1.125rem - 2px); }

        .tm-row-left { display:flex; align-items:center; gap:.625rem; flex:1; min-width:0; }
        .tm-name-wrap { flex:1; min-width:0; }
        .tm-name-line { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; margin-bottom:.18rem; }
        .tm-name { font-size:.82rem; font-weight:700; color:var(--foreground); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px; }
        .tm-you-tag {
          font-size:.59rem; font-weight:700; padding:.07rem .35rem; border-radius:3px;
          background:rgba(139,92,246,.1); color:#a78bfa; border:1px solid rgba(139,92,246,.18);
        }
        .tm-role-badge {
          display:inline-flex; align-items:center; gap:.3rem;
          font-size:.62rem; font-weight:700; padding:.1rem .45rem; border-radius:5px;
        }
        .tm-email { font-size:.72rem; color:var(--muted-foreground); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; }

        .tm-row-actions { display:flex; align-items:center; gap:.375rem; flex-shrink:0; }
        .tm-role-select {
          padding:.28rem .55rem; border-radius:6px; font-size:.71rem; font-weight:600;
          border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03);
          color:var(--foreground); cursor:pointer; outline:none;
        }
        .tm-role-select:focus { border-color:rgba(139,92,246,.35); }
        .tm-role-select option { background:var(--card); }

        .tm-remove-btn {
          width:28px; height:28px; border-radius:7px; border:1px solid rgba(239,68,68,.18);
          background:rgba(239,68,68,.07); color:#f87171; cursor:pointer;
          display:flex; align-items:center; justify-content:center; transition:all .13s;
        }
        .tm-remove-btn:hover    { background:rgba(239,68,68,.16); border-color:rgba(239,68,68,.35); }
        .tm-remove-btn:disabled { opacity:.4; cursor:not-allowed; }

        .tm-spin {
          width:12px; height:12px; border-radius:50%;
          border:2px solid rgba(255,255,255,.15); border-top-color:currentColor;
          animation:tmSpin .7s linear infinite;
        }

        .tm-inv-row {
          display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem;
          padding:.625rem 1.125rem; border-bottom:1px solid rgba(255,255,255,.025);
          transition:background .12s; flex-wrap:wrap;
        }
        .tm-inv-row:last-child { border-bottom:none; }
        .tm-inv-body  { flex:1; min-width:0; }
        .tm-inv-top   { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; margin-bottom:.22rem; }
        .tm-inv-email { font-size:.82rem; font-weight:600; color:var(--foreground); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; }
        .tm-exp-tag {
          font-size:.61rem; font-weight:700; padding:.08rem .38rem; border-radius:4px;
          display:inline-flex; align-items:center; gap:.25rem;
        }
        .tm-inv-meta { font-size:.68rem; color:var(--muted-foreground); display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; }
        .tm-cancel-btn {
          display:flex; align-items:center; gap:.3rem; padding:.3rem .625rem; border-radius:6px;
          font-size:.7rem; font-weight:600; flex-shrink:0; cursor:pointer; transition:all .13s;
          border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:var(--muted-foreground);
        }
        .tm-cancel-btn:hover    { color:var(--foreground); border-color:rgba(255,255,255,.18); }
        .tm-cancel-btn:disabled { opacity:.4; cursor:not-allowed; }

        .tm-perms {
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:.5rem;
          padding:.875rem 1.125rem;
        }
        @media(max-width:700px){ .tm-perms { grid-template-columns:1fr; } }
        @media(min-width:701px) and (max-width:900px){ .tm-perms { grid-template-columns:repeat(2,1fr); } }

        .tm-perm-card {
          padding:.875rem; border-radius:9px;
          border:1px solid rgba(255,255,255,.05); background:rgba(255,255,255,.018);
          transition:border-color .14s;
        }
        .tm-perm-card:hover { border-color:rgba(139,92,246,.14); }
        .tm-perm-head { display:flex; align-items:center; gap:.45rem; margin-bottom:.625rem; }
        .tm-perm-title { font-size:.78rem; font-weight:700; color:var(--foreground); }
        .tm-perm-list { display:flex; flex-direction:column; gap:.3rem; }
        .tm-perm-item {
          display:flex; align-items:flex-start; gap:.45rem;
          font-size:.72rem; color:var(--muted-foreground); line-height:1.45;
        }
        .tm-perm-dot { width:4px; height:4px; border-radius:50%; margin-top:.42rem; flex-shrink:0; }

        .tm-perms-toggle {
          display:flex; align-items:center; justify-content:space-between; width:100%;
          padding:.625rem 1.125rem; background:transparent; border:none; cursor:pointer;
          color:var(--muted-foreground); font-size:.73rem; font-weight:600;
          transition:color .13s;
        }
        .tm-perms-toggle:hover { color:var(--foreground); }

        @media(max-width:500px) {
          .tm-row { padding:.625rem .75rem; }
          .tm-name { max-width:120px; }
          .tm-email { max-width:130px; }
          .tm-role-select { font-size:.67rem; padding:.22rem .4rem; }
        }
      `}</style>

      <div className="tm-wrap">

        {/* ── Summary ── */}
        <div className="tm-summary">
          <div className="tm-sum-head">
            <div className="tm-sum-left">
              <div className="tm-sum-icon"><Users size={16} color="#a78bfa" /></div>
              <div>
                <div className="tm-sum-title">Team Members</div>
                <div className="tm-sum-subtitle">Manage {teamName} members &amp; permissions</div>
              </div>
            </div>
            {userRole !== "owner" && user && (
              <button onClick={handleLeaveTeam} disabled={isLeaving} className="tm-leave">
                {isLeaving
                  ? <div className="tm-spin" style={{ color:"rgba(239,68,68,.7)" }} />
                  : <LogOut size={13} />}
                {isLeaving ? "Leaving…" : "Leave Team"}
              </button>
            )}
          </div>

          <div className="tm-tiles">
            {[
              { n: members.length,           l: "Members",     c: "var(--foreground)", d: ".04s" },
              { n: pendingInvites.length,     l: "Pending",     c: "#f59e0b",           d: ".09s" },
              { n: adminsCount,               l: "Admins",      c: "#8b5cf6",           d: ".14s" },
              {
                n: loadingGuest ? "—" : guestStats.totalAccesses,
                l: "Guest Visits",
                c: "#34d399",
                d: ".19s",
                
              },
            ].map(s => (
              <div key={s.l} className="tm-tile" style={{ animationDelay: s.d }}>
                <div className="tm-tile-n" style={{ color:s.c, display:"flex", alignItems:"center", justifyContent:"center", gap:".25rem" }}>
                  {s.icon}{s.n}
                </div>
                <div className="tm-tile-l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Active members ── */}
        <div className="tm-panel" style={{ animationDelay: ".05s" }}>
          <div className="tm-panel-head">
            <Users size={13} color="var(--primary)" />
            Active Members
            <span className="tm-panel-cnt">{members.length}</span>
          </div>
          <div className="tm-list">
            {members.map((m, i) => {
              const isMe = m.uid === user?.uid;
              const cfg  = getRoleCfg(m.role);
              const Icon = cfg.icon;
              const isProc = processingActions.has(`role-${m.uid}`) || processingActions.has(`remove-${m.uid}`);
              return (
                <div key={m.uid} className={`tm-row${isMe ? " me" : ""}`}
                  style={{ animationDelay:`${i*.03}s` }}>
                  <div className="tm-row-left">
                    <Avatar src={m.avatar} name={m.name} email={m.email} size={34} />
                    <div className="tm-name-wrap">
                      <div className="tm-name-line">
                        <span className="tm-name">{m.name || m.email}</span>
                        {isMe && <span className="tm-you-tag">You</span>}
                        <span className="tm-role-badge"
                          style={{ background: cfg.bg, color: cfg.color, border:`1px solid ${cfg.border}` }}>
                          <Icon size={10} />{cfg.label}
                        </span>
                      </div>
                      <div className="tm-email">{m.email}</div>
                    </div>
                  </div>
                  {canModifyMember(m) && (
                    <div className="tm-row-actions">
                      {canManageRoles() && (
                        <select value={m.role} onChange={e => changeMemberRole(m.uid, e.target.value)}
                          disabled={isProc} className="tm-role-select">
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      <button onClick={() => removeMember(m.uid)} disabled={isProc} className="tm-remove-btn" title="Remove member">
                        {isProc ? <div className="tm-spin" style={{ color:"#f87171" }} /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Pending invites ── */}
        {pendingInvites.length > 0 && canManageInvites() && (
          <div className="tm-panel" style={{ animationDelay: ".1s" }}>
            <div className="tm-panel-head">
              <Mail size={13} color="var(--primary)" />
              Pending Invitations
              <span className="tm-panel-cnt">{pendingInvites.length}</span>
            </div>
            <div className="tm-list">
              {pendingInvites.map(inv => {
                const isProc = processingActions.has(`cancel-${inv.id}`);
                const rem    = timeRemaining(inv.expiresAt);
                const soon   = inv.expiresAt && (inv.expiresAt.toMillis() - Date.now()) < 864e5;
                const roleCfg= getRoleCfg(inv.role);
                const RIcon  = roleCfg.icon;
                return (
                  <div key={inv.id} className="tm-inv-row">
                    <div className="tm-inv-body">
                      <div className="tm-inv-top">
                        <span className="tm-inv-email">{inv.email}</span>
                        <span className="tm-role-badge"
                          style={{ background:roleCfg.bg, color:roleCfg.color, border:`1px solid ${roleCfg.border}` }}>
                          <RIcon size={10} />{roleCfg.label}
                        </span>
                        {rem && (
                          <span className="tm-exp-tag"
                            style={{ background:soon?"rgba(245,158,11,.1)":"rgba(255,255,255,.04)", color:soon?"#f59e0b":"var(--muted-foreground)", border:`1px solid ${soon?"rgba(245,158,11,.2)":"rgba(255,255,255,.07)"}` }}>
                            <Clock size={9} />{rem}
                          </span>
                        )}
                      </div>
                      <div className="tm-inv-meta">
                        <Calendar size={11} />
                        Invited {fmtDate(inv.createdAt)} by {inv.inviterName || "Unknown"}
                      </div>
                    </div>
                    <button onClick={() => cancelInvite(inv.id)} disabled={isProc} className="tm-cancel-btn">
                      {isProc ? <div className="tm-spin" /> : <><X size={11} />Cancel</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Permissions (collapsible) ── */}
        <div className="tm-panel" style={{ animationDelay: ".15s" }}>
          <button
            className="tm-perms-toggle"
            onClick={() => setPermsExpanded(v => !v)}
          >
            <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
              <Shield size={13} color="var(--primary)" />
              <span style={{ color:"var(--foreground)" }}>Role Permissions</span>
            </div>
            {permsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {permsExpanded && (
            <div className="tm-perms">
              {[
                {
                  role: "member", icon: User, color: "#64748b",
                  perms: ["Create & edit own prompts","View all team prompts","Copy & rate prompts","Add comments"],
                },
                {
                  role: "admin", icon: Shield, color: "#8b5cf6",
                  perms: ["All member permissions","Edit any team prompt","Invite new members","Remove members"],
                },
                {
                  role: "owner", icon: Crown, color: "#f59e0b",
                  perms: ["All admin permissions","Change member roles","Delete team","Transfer ownership"],
                },
              ].map(p => {
                const Icon = p.icon;
                return (
                  <div key={p.role} className="tm-perm-card">
                    <div className="tm-perm-head">
                      <Icon size={14} color={p.color} />
                      <div className="tm-perm-title" style={{ color:p.color }}>{p.role.charAt(0).toUpperCase()+p.role.slice(1)}</div>
                    </div>
                    <div className="tm-perm-list">
                      {p.perms.map(perm => (
                        <div key={perm} className="tm-perm-item">
                          <div className="tm-perm-dot" style={{ background:p.color }} />
                          {perm}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
