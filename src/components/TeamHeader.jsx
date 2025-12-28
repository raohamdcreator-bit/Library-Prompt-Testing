// src/components/TeamHeader.jsx - Compact Team Header with Horizontal Tabs
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { 
  FileText, 
  Users, 
  BarChart3, 
  Activity, 
  Shield 
} from "lucide-react";

export default function TeamHeader({ teamId, userRole, activeTab = "prompts", onTabChange }) {
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
        console.error("Error loading team data:", error);
      }
    }

    loadTeamData();
  }, [teamId]);

  const tabs = [
    { id: "prompts", label: "Prompts", icon: FileText },
    { id: "members", label: "Members", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
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
          <span 
            className="team-role-badge" 
            style={{ 
              borderColor: getRoleBadgeColor(userRole),
              backgroundColor: `${getRoleBadgeColor(userRole)}15`
            }}
          >
            {userRole}
          </span>
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
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange && onTabChange(tab.id)}
                className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
