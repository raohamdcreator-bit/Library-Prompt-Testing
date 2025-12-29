// src/components/TeamMembers.jsx - Modernized with Professional Icons
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { cancelTeamInvite, deleteTeamInvite } from "../lib/inviteUtils";
import { 
  Users, Crown, Shield, User, Settings, Trash2, 
  Mail, Clock, Calendar, X, CheckCircle, XCircle, 
  Info, AlertTriangle
} from 'lucide-react';

export default function TeamMembers({ teamId, teamName, userRole, teamData }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingActions, setProcessingActions] = useState(new Set());

  useEffect(() => {
    if (!teamId || !teamData) {
      setLoading(false);
      return;
    }

    async function loadMembers() {
      const memberProfiles = [];

      for (const [uid, role] of Object.entries(teamData.members || {})) {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            memberProfiles.push({
              uid,
              role,
              ...userDoc.data(),
            });
          } else {
            memberProfiles.push({
              uid,
              role,
              email: `user-${uid}@unknown.com`,
              name: `User ${uid.slice(-4)}`,
            });
          }
        } catch (error) {
          console.error("Error loading member profile:", error);
          memberProfiles.push({
            uid,
            role,
            email: `user-${uid}@error.com`,
            name: `User ${uid.slice(-4)}`,
          });
        }
      }

      memberProfiles.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      });

      setMembers(memberProfiles);
      setLoading(false);
    }

    loadMembers();
  }, [teamId, teamData]);

  useEffect(() => {
    if (!teamId) return;

    const q = query(
      collection(db, "team-invites"),
      where("teamId", "==", teamId),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const now = Timestamp.now();
      const invites = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((invite) => {
          if (invite.expiresAt && invite.expiresAt.toMillis() < now.toMillis()) {
            return false;
          }
          return true;
        });

      invites.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

      setPendingInvites(invites);
    });

    return () => unsub();
  }, [teamId]);

  async function changeMemberRole(memberUid, newRole) {
    if (!canManageRoles() || memberUid === user.uid) return;

    const actionKey = `role-${memberUid}`;
    setProcessingActions((prev) => new Set([...prev, actionKey]));

    try {
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        [`members.${memberUid}`]: newRole,
      });

      showNotification(`Member role updated to ${newRole}`, "success");
    } catch (error) {
      console.error("Error updating member role:", error);
      showNotification("Failed to update member role", "error");
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }

  async function removeMember(memberUid) {
    if (!canRemoveMembers() || memberUid === user.uid) return;

    const member = members.find((m) => m.uid === memberUid);
    if (!member) return;

    if (!confirm(`Remove ${member.name || member.email} from the team?`))
      return;

    const actionKey = `remove-${memberUid}`;
    setProcessingActions((prev) => new Set([...prev, actionKey]));

    try {
      const teamRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamRef);

      if (teamDoc.exists()) {
        const currentMembers = { ...teamDoc.data().members };
        delete currentMembers[memberUid];

        await updateDoc(teamRef, {
          members: currentMembers,
        });
      }

      showNotification(
        `${member.name || member.email} removed from team`,
        "success"
      );
    } catch (error) {
      console.error("Error removing member:", error);
      showNotification("Failed to remove member", "error");
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }

  async function cancelInvite(inviteId) {
    if (!canManageInvites()) return;

    if (!confirm("Cancel this invitation?")) return;

    const actionKey = `cancel-${inviteId}`;
    setProcessingActions((prev) => new Set([...prev, actionKey]));

    try {
      const result = await deleteTeamInvite(inviteId);
      
      if (result.success) {
        showNotification("Invitation cancelled", "success");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error cancelling invite:", error);
      showNotification("Failed to cancel invitation", "error");
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  }

  function canManageRoles() {
    return userRole === "owner";
  }

  function canRemoveMembers() {
    return userRole === "owner" || userRole === "admin";
  }

  function canManageInvites() {
    return userRole === "owner" || userRole === "admin";
  }

  function canModifyMember(member) {
    if (member.uid === user.uid) return false;
    if (userRole === "owner") return true;
    if (userRole === "admin" && member.role === "member") return true;
    return false;
  }

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${message}</span>
      </div>
    `;

    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.backgroundColor = "var(--card)";
    notification.style.color = "var(--foreground)";
    notification.style.border = `1px solid var(--${
      type === "error" ? "destructive" : "primary"
    })`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Unknown";
    try {
      return timestamp.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  }

  function getTimeRemaining(expiresAt) {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expiry = expiresAt.toDate();
    const diff = expiry - now;
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return "<1h";
  }

  function getRoleIcon(role) {
    switch (role) {
      case "owner":
        return Crown;
      case "admin":
        return Shield;
      default:
        return User;
    }
  }

  function getRoleBadge(role) {
    const baseStyle = {
      padding: "4px 8px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "500",
      border: "1px solid var(--border)",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    };

    switch (role) {
      case "owner":
        return {
          ...baseStyle,
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground)",
        };
      case "admin":
        return {
          ...baseStyle,
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        };
      case "member":
        return {
          ...baseStyle,
          backgroundColor: "var(--secondary)",
          color: "var(--secondary-foreground)",
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: "var(--muted)",
          color: "var(--muted-foreground)",
        };
    }
  }

  function UserAvatar({ src, name, email, size = "normal" }) {
    const [imageError, setImageError] = useState(false);
    const avatarClass = size === "small" ? "w-8 h-8" : "w-10 h-10";

    if (!src || imageError) {
      const initials = name
        ? name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : email
        ? email[0].toUpperCase()
        : "U";
      return (
        <div
          className={`${avatarClass} rounded-full flex items-center justify-center text-white font-semibold`}
          style={{ backgroundColor: "var(--primary)" }}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt="avatar"
        className={`${avatarClass} rounded-full object-cover border-2 border-white/20`}
        onError={() => setImageError(true)}
      />
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>
          Loading team members...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Users size={20} style={{ color: "var(--primary-foreground)" }} />
          </div>
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Team Members
            </h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Manage {teamName} team members and permissions
            </p>
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {members.length}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Total Members
            </div>
          </div>
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {pendingInvites.length}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Pending Invites
            </div>
          </div>
          <div
            className="text-center p-3 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div
              className="text-lg font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {
                members.filter((m) => m.role === "admin" || m.role === "owner")
                  .length
              }
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Admins
            </div>
          </div>
        </div>
      </div>

      {/* Active Members */}
      <div className="glass-card p-6">
        <h4
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <Users size={18} />
          Active Members ({members.length})
        </h4>
        <div className="space-y-3">
          {members.map((member) => {
            const isProcessing =
              processingActions.has(`role-${member.uid}`) ||
              processingActions.has(`remove-${member.uid}`);
            const RoleIcon = getRoleIcon(member.role);

            return (
              <div
                key={member.uid}
                className="flex items-center justify-between p-4 rounded-lg border transition-all duration-200"
                style={{
                  backgroundColor: "var(--secondary)",
                  borderColor:
                    member.uid === user.uid
                      ? "var(--primary)"
                      : "var(--border)",
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <UserAvatar
                    src={member.avatar}
                    name={member.name}
                    email={member.email}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-medium truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {member.name || member.email}
                        {member.uid === user.uid && (
                          <span
                            className="text-xs ml-2"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            (You)
                          </span>
                        )}
                      </span>
                      <span style={getRoleBadge(member.role)}>
                        <RoleIcon size={12} />
                        {member.role}
                      </span>
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {member.email}
                    </div>
                  </div>
                </div>

                {canModifyMember(member) && (
                  <div className="flex items-center gap-2 ml-4">
                    {canManageRoles() && (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          changeMemberRole(member.uid, e.target.value)
                        }
                        disabled={isProcessing}
                        className="text-xs px-2 py-1 rounded border"
                        style={{
                          backgroundColor: "var(--input)",
                          borderColor: "var(--border)",
                          color: "var(--foreground)",
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}

                    <button
                      onClick={() => removeMember(member.uid)}
                      disabled={isProcessing}
                      className="p-2 rounded text-xs transition-colors flex items-center gap-1"
                      style={{
                        backgroundColor: "var(--destructive)",
                        color: "var(--destructive-foreground)",
                        opacity: isProcessing ? 0.5 : 1,
                      }}
                      title="Remove member"
                    >
                      {isProcessing ? (
                        <div className="neo-spinner w-3 h-3"></div>
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && canManageInvites() && (
        <div className="glass-card p-6">
          <h4
            className="font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--foreground)" }}
          >
            <Mail size={18} />
            Pending Invitations ({pendingInvites.length})
          </h4>
          <div className="space-y-3">
            {pendingInvites.map((invite) => {
              const isProcessing = processingActions.has(`cancel-${invite.id}`);
              const timeRemaining = getTimeRemaining(invite.expiresAt);
              const isExpiringSoon = invite.expiresAt && 
                (invite.expiresAt.toMillis() - Date.now()) < 24 * 60 * 60 * 1000;
              const RoleIcon = getRoleIcon(invite.role);

              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                  style={{
                    backgroundColor: "var(--muted)",
                    borderColor: isExpiringSoon ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {invite.email}
                      </span>
                      <span style={getRoleBadge(invite.role)}>
                        <RoleIcon size={12} />
                        {invite.role}
                      </span>
                      {timeRemaining && (
                        <span
                          className="text-xs px-2 py-1 rounded flex items-center gap-1"
                          style={{
                            backgroundColor: isExpiringSoon ? "var(--accent)" : "var(--secondary)",
                            color: isExpiringSoon ? "var(--accent-foreground)" : "var(--muted-foreground)",
                          }}
                        >
                          <Clock size={10} />
                          {timeRemaining}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-sm flex items-center gap-1"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Calendar size={12} />
                      Invited {formatDate(invite.createdAt)} by{" "}
                      {invite.inviterName}
                    </div>
                  </div>

                  <button
                    onClick={() => cancelInvite(invite.id)}
                    disabled={isProcessing}
                    className="px-3 py-1 text-xs rounded transition-colors flex items-center gap-1"
                    style={{
                      backgroundColor: "var(--secondary)",
                      color: "var(--secondary-foreground)",
                      border: "1px solid var(--border)",
                      opacity: isProcessing ? 0.5 : 1,
                    }}
                  >
                    {isProcessing ? (
                      <div className="neo-spinner w-3 h-3"></div>
                    ) : (
                      <>
                        <X size={12} />
                        Cancel
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Role Permissions Info */}
      <div className="glass-card p-6">
        <h4
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <Shield size={18} />
          Role Permissions
        </h4>
        <div className="grid md:grid-cols-3 gap-4">
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <User size={18} />
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Member
              </span>
            </div>
            <ul
              className="text-sm space-y-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li>• Create and edit own prompts</li>
              <li>• View team prompts</li>
              <li>• Copy and rate prompts</li>
              <li>• Add comments</li>
            </ul>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} />
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Admin
              </span>
            </div>
            <ul
              className="text-sm space-y-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li>• All member permissions</li>
              <li>• Edit any team prompt</li>
              <li>• Invite new members</li>
              <li>• Remove members</li>
            </ul>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Crown size={18} />
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Owner
              </span>
            </div>
            <ul
              className="text-sm space-y-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li>• All admin permissions</li>
              <li>• Change member roles</li>
              <li>• Delete team</li>
              <li>• Transfer ownership</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
