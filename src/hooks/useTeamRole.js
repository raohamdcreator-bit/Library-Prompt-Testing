// src/hooks/useTeamRole.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function useTeamRole(teamId) {
  const { user } = useAuth();
  const [role, setRole] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamId || !user) {
      setRole(null);
      setTeamData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    const ref = doc(db, "teams", teamId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setRole(null);
        setTeamData(null);
        setError("Team not found or access denied");
        setLoading(false);
        return;
      }
      
      const data = snap.data();
      setTeamData(data);
      
      // Get user's role from members object
      const userRole = data.members && data.members[user.uid] ? data.members[user.uid] : null;
      setRole(userRole);
      setLoading(false);
      
    }, (err) => {
      console.error("useTeamRole snapshot error:", err);
      setRole(null);
      setTeamData(null);
      setError(err.code === 'permission-denied' ? 'Access denied' : 'Failed to load team');
      setLoading(false);
    });

    return () => unsub();
  }, [teamId, user]);

  // Helper functions for role checks
  const canManageTeam = () => role === 'owner';
  const canManageMembers = () => role === 'owner' || role === 'admin';
  const canCreatePrompts = () => role === 'owner' || role === 'admin' || role === 'member';
  const canEditAllPrompts = () => role === 'owner' || role === 'admin';
  const canDeleteTeam = () => role === 'owner';
  const canInviteMembers = () => role === 'owner' || role === 'admin';

  // Check if user can edit a specific prompt
  const canEditPrompt = (promptCreatorId) => {
    if (!user || !promptCreatorId) return false;
    return promptCreatorId === user.uid || canEditAllPrompts();
  };

  // Check if user can delete a specific prompt
  const canDeletePrompt = (promptCreatorId) => {
    if (!user || !promptCreatorId) return false;
    return promptCreatorId === user.uid || canEditAllPrompts();
  };

  // Get role display information
  const getRoleInfo = () => {
    switch (role) {
      case 'owner':
        return {
          label: 'Owner',
          color: 'purple',
          description: 'Full control - can delete team, manage all members and prompts',
          permissions: ['All permissions', 'Delete team', 'Manage members', 'Manage all prompts']
        };
      case 'admin':
        return {
          label: 'Admin',
          color: 'blue',
          description: 'Can manage members, invites, and all prompts',
          permissions: ['Manage members', 'Send invites', 'Manage all prompts', 'View team analytics']
        };
      case 'member':
        return {
          label: 'Member',
          color: 'green',
          description: 'Can create and manage own prompts only',
          permissions: ['Create prompts', 'Edit own prompts', 'View all prompts', 'Comment on prompts']
        };
      default:
        return {
          label: 'No Access',
          color: 'gray',
          description: 'No access to this team',
          permissions: []
        };
    }
  };

  // Check if user is team owner
  const isOwner = () => teamData && user && teamData.ownerId === user.uid;

  // Get team member count
  const getMemberCount = () => teamData ? Object.keys(teamData.members || {}).length : 0;

  return {
    // Basic role data
    role,
    teamData,
    loading,
    error,
    
    // Permission checkers
    canManageTeam,
    canManageMembers,
    canCreatePrompts,
    canEditAllPrompts,
    canDeleteTeam,
    canInviteMembers,
    canEditPrompt,
    canDeletePrompt,
    isOwner,
    
    // Helper data
    getRoleInfo,
    getMemberCount,
    
    // Status checks
    hasAccess: role !== null,
    isTeamMember: role === 'owner' || role === 'admin' || role === 'member'
  };
}