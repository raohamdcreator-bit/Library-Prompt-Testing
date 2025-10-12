// src/components/TeamMembers.jsx - Updated to match demo UI
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
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function TeamMembers({ teamId, teamName, userRole, teamData }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingActions, setProcessingActions] = useState(new Set());

  // Load team members and their profiles
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
            // User document doesn't exist, show basic info
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

      // Sort by role hierarchy: owner > admin > member
      memberProfiles.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      });

      setMembers(memberProfiles);
      setLoading(false);
    }

    loadMembers();
  }, [teamId, teamData]);

  // Load pending invites
  useEffect(() => {
    if (!teamId) return;

    const q = query(
      collection(db, "team-invites"),
      where("teamId", "==", teamId),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const invites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by creation date, newest first
      invites.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

      setPendingInvites(invites);
    });

    return () => unsub();
  }, [teamId]);

  // Change member role
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

  // Remove member from team
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

  // Cancel pending invite
  async function cancelInvite(inviteId) {
    if (!canManageInvites()) return;

    const actionKey = `cancel-${inviteId}`;
    setProcessingActions((prev) => new Set([...prev, actionKey]));

    try {
      await deleteDoc(doc(db, "team-invites", inviteId));
      showNotification("Invitation cancelled", "success");
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

  // Permission helpers
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
    if (member.uid === user.uid) return false; // Can't modify yourself
    if (userRole === "owner") return true;
    if (userRole === "admin" && member.role === "member") return true;
    return false;
  }

  // Utility functions
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");

    const icons = { success: "✅", error: "❌", info: "ℹ️" };

    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type]}</span>
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

  function getRoleIcon(role) {
    switch (role) {
      case "owner":
        return "👑";
      case "admin":
        return "⚡";
      default:
        return "👤";
    }
  }

  function getRoleBadge(role) {
    const baseStyle = {
      padding: "4px 8px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "500",
      border: "1px solid var(--border)",
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
            <span
              className="text-lg"
              style={{ color: "var(--primary-foreground)" }}
            >
              👥
            </span>
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
          className="font-semibold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          Active Members ({members.length})
        </h4>
        <div className="space-y-3">
          {members.map((member) => {
            const isProcessing =
              processingActions.has(`role-${member.uid}`) ||
              processingActions.has(`remove-${member.uid}`);

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
                        {getRoleIcon(member.role)} {member.role}
                      </span>
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {member.email}
                      {member.lastSeen && (
                        <span className="ml-2">
                          • Last seen {formatDate(member.lastSeen)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Member Actions */}
                {canModifyMember(member) && (
                  <div className="flex items-center gap-2 ml-4">
                    {/* Role Change Dropdown */}
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
                      {userRole === "owner" && (
                        <>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </>
                      )}
                      {userRole === "admin" && member.role === "member" && (
                        <option value="member">Member</option>
                      )}
                    </select>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeMember(member.uid)}
                      disabled={isProcessing}
                      className="p-2 rounded text-xs transition-colors"
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
                        "Remove"
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
            className="font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Pending Invitations ({pendingInvites.length})
          </h4>
          <div className="space-y-3">
            {pendingInvites.map((invite) => {
              const isProcessing = processingActions.has(`cancel-${invite.id}`);

              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                  style={{
                    backgroundColor: "var(--muted)",
                    borderColor: "var(--border)",
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
                        {getRoleIcon(invite.role)} {invite.role}
                      </span>
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Invited {formatDate(invite.createdAt)} by{" "}
                      {invite.inviterName}
                    </div>
                  </div>

                  <button
                    onClick={() => cancelInvite(invite.id)}
                    disabled={isProcessing}
                    className="px-3 py-1 text-xs rounded transition-colors"
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
                      "Cancel"
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
          className="font-semibold mb-4"
          style={{ color: "var(--foreground)" }}
        >
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
              <span className="text-lg">👤</span>
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
              <span className="text-lg">⚡</span>
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
              <span className="text-lg">👑</span>
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
