// src/components/TeamHeader.jsx - FIXED: Complete guest mode support
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { 
  FileText, 
  Users, 
  BarChart3, 
  Activity, 
  Shield,
  Lock
} from "lucide-react";

export default function TeamHeader({ 
  teamId, 
  userRole, 
  activeTab = "prompts", 
  onTabChange,
  user,  // ✅ ADDED: user object to check authentication
  isGuestMode = false  // ✅ ADDED: guest mode flag
}) {
  const [teamData, setTeamData] = useState(null);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    async function loadTeamData() {
      if (!teamId) return;

      try {
        const teamDoc = await getDoc(doc(db, "teams", teamId));
        if (teamDoc.exists()) {
          const data = teamDoc.data();
          setTeamData(data);
          setMemberCount(Object.keys(data.members || {}).length);
        }
      } catch (error) {
        // ✅ FIX: Don't log errors for guests (expected permission issues)
        if (!isGuestMode) {
          console.error("Error loading team data:", error);
        }
      }
    }

    loadTeamData();
  }, [teamId, user, isGuestMode]); // ✅ ADDED: user to dependencies

  const tabs = [
    { id: "prompts", label: "Prompts", icon: FileText },
    { id: "members", label: "Members", icon: Users },
    { id: "analytics", label: "Performance", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "plagiarism", label: "Plagiarism", icon: Shield },
  ];

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "owner":
        return "var(--primary)";
      case "admin":
        return "var(--info)";
      default:
        return "var(--muted-foreground)";
    }
  };

  if (!teamData) {
    return (
      <div className="team-header-container">
        <div className="team-header-info">
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading team...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-header-container">
      {/* Team Info Section */}
      <div className="team-header-info">
        <div className="team-header-main">
          <h1 className="team-name-title">{teamData.name}</h1>
          
          {/* ✅ FIXED: Show guest badge or role badge */}
          {isGuestMode ? (
            <span 
              className="team-role-badge" 
              style={{ 
                borderColor: "rgba(139, 92, 246, 0.5)",
                backgroundColor: "rgba(139, 92, 246, 0.15)",
                color: "rgba(139, 92, 246, 0.95)"
              }}
            >
              guest
            </span>
          ) : userRole && (
            <span 
              className="team-role-badge" 
              style={{ 
                borderColor: getRoleBadgeColor(userRole),
                backgroundColor: `${getRoleBadgeColor(userRole)}15`
              }}
            >
              {userRole}
            </span>
          )}
        </div>
        <div className="team-members-count">
          <Users className="w-4 h-4 inline mr-1" />
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </div>
      </div>

      {/* Horizontal Tab Navigation */}
      <div className="tab-navigation-container">
        <nav className="tab-navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            
            // ✅ FIXED: Disable tabs for guests except prompts
            const isDisabled = isGuestMode && tab.id !== 'prompts';
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isDisabled) {
                    alert("Sign up to access " + tab.label + "!");
                    return;
                  }
                  onTabChange && onTabChange(tab.id);
                }}
                className={`tab-item ${activeTab === tab.id ? "active" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isDisabled}
                title={isDisabled ? "Sign up to access" : tab.label}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {isDisabled && (
                  <Lock className="w-3 h-3 ml-1 opacity-60" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
