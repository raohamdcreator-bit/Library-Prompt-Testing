// src/components/Permission.jsx
import { useAuth } from "../context/AuthContext";

/**
 * Permission component for role-based UI rendering
 * Only renders children if user has the required permission
 */
export default function Permission({
  children,
  role,
  requiredRoles = [],
  teamData,
  promptCreatorId = null,
  fallback = null,
  showFallback = false,
}) {
  const { user } = useAuth();

  // Helper function to check permissions
  function hasPermission() {
    if (!user || !role) return false;

    // Check role-based permissions
    if (requiredRoles.length > 0) {
      return requiredRoles.includes(role);
    }

    // If no specific roles required, check if user has any role
    return ["owner", "admin", "member"].includes(role);
  }

  // Check prompt-specific permissions
  function canAccessPrompt() {
    if (!user || !promptCreatorId) return true; // No specific prompt restrictions

    // Owner and admin can access all prompts
    if (role === "owner" || role === "admin") return true;

    // Members can only access their own prompts for editing/deleting
    return promptCreatorId === user.uid;
  }

  // Check team ownership
  function isTeamOwner() {
    return teamData && user && teamData.ownerId === user.uid;
  }

  const allowed = hasPermission() && canAccessPrompt();

  if (!allowed) {
    if (showFallback && fallback) {
      return fallback;
    }
    return null;
  }

  return children;
}

/**
 * Specific permission components for common use cases
 */

// Only show to team owners
export function OwnerOnly({ children, role, teamData, fallback = null }) {
  return (
    <Permission
      role={role}
      requiredRoles={["owner"]}
      teamData={teamData}
      fallback={fallback}
      showFallback={!!fallback}
    >
      {children}
    </Permission>
  );
}

// Only show to owners and admins
export function AdminOnly({ children, role, fallback = null }) {
  return (
    <Permission
      role={role}
      requiredRoles={["owner", "admin"]}
      fallback={fallback}
      showFallback={!!fallback}
    >
      {children}
    </Permission>
  );
}

// Show to all team members
export function MemberOnly({ children, role, fallback = null }) {
  return (
    <Permission
      role={role}
      requiredRoles={["owner", "admin", "member"]}
      fallback={fallback}
      showFallback={!!fallback}
    >
      {children}
    </Permission>
  );
}

// Show only if user can edit this specific prompt
export function PromptEditor({
  children,
  role,
  promptCreatorId,
  fallback = null,
}) {
  return (
    <Permission
      role={role}
      requiredRoles={["owner", "admin", "member"]}
      promptCreatorId={promptCreatorId}
      fallback={fallback}
      showFallback={!!fallback}
    >
      {children}
    </Permission>
  );
}

// Role badge component
export function RoleBadge({ role, size = "normal", className = "" }) {
  if (!role) return null;

  const getRoleConfig = () => {
    switch (role) {
      case "owner":
        return {
          label: "Owner",
          className: "bg-purple-100 text-purple-800 border-purple-200",
        };
      case "admin":
        return {
          label: "Admin",
          className: "bg-blue-100 text-blue-800 border-blue-200",
        };
      case "member":
        return {
          label: "Member",
          className: "bg-green-100 text-green-800 border-green-200",
        };
      default:
        return {
          label: role,
          className: "bg-gray-100 text-gray-800 border-gray-200",
        };
    }
  };

  const config = getRoleConfig();
  const sizeClass =
    size === "small" ? "text-xs px-2 py-0.5" : "text-sm px-2 py-1";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border capitalize ${sizeClass} ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

// Permission info tooltip/modal component
export function PermissionInfo({ role, onClose }) {
  if (!role) return null;

  const getRoleInfo = () => {
    switch (role) {
      case "owner":
        return {
          title: "Team Owner",
          description: "You have full control over this team",
          permissions: [
            "Delete the entire team",
            "Manage all team members",
            "Change member roles",
            "Create, edit, and delete all prompts",
            "Send team invitations",
            "Access team analytics",
          ],
        };
      case "admin":
        return {
          title: "Team Administrator",
          description: "You can manage team members and content",
          permissions: [
            "Manage team members (except owner)",
            "Send team invitations",
            "Create, edit, and delete all prompts",
            "View team member activity",
            "Access basic team analytics",
          ],
        };
      case "member":
        return {
          title: "Team Member",
          description: "You can contribute prompts to the team",
          permissions: [
            "Create new prompts",
            "Edit your own prompts",
            "Delete your own prompts",
            "View all team prompts",
            "Copy prompts to clipboard",
          ],
        };
      default:
        return {
          title: "No Access",
          description: "You do not have access to this team",
          permissions: [],
        };
    }
  };

  const info = getRoleInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{info.title}</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        <p className="text-gray-600 mb-4">{info.description}</p>

        {info.permissions.length > 0 && (
          <>
            <h4 className="font-medium text-gray-800 mb-2">
              Your permissions:
            </h4>
            <ul className="space-y-1">
              {info.permissions.map((permission, index) => (
                <li
                  key={index}
                  className="flex items-center text-sm text-gray-600"
                >
                  <span className="text-green-500 mr-2">✓</span>
                  {permission}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
