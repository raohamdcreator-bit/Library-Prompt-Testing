// src/components/TeamSelector.jsx
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { 
  Plus, 
  Search, 
  FileText, 
  Heart, 
  MessageSquare,
  Users,
  Settings,
  LogOut
} from "lucide-react";

export default function TeamSelector({ activeTeam, onSelect, onNewPrompt, onNavigate }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState("prompts");

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "teams"),
      where(`members.${user.uid}`, "!=", null)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleNavigation = (view) => {
    setCurrentView(view);
    if (onNavigate) {
      onNavigate(view);
    }
  };

  if (!user) return null;
  if (loading) return (
    <div className="team-sidebar">
      <div className="p-4 text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
        Loading...
      </div>
    </div>
  );

  return (
    <div className="team-sidebar">
      {/* User Badge */}
      <div className="sidebar-user-section">
        <div className="sidebar-user-badge">
          <Users className="w-4 h-4" />
          <span>{user.displayName || user.email?.split('@')[0] || 'User'}</span>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="sidebar-section">
        <button
          onClick={onNewPrompt}
          className="sidebar-menu-item primary"
        >
          <Plus className="w-4 h-4" />
          <span>New Prompt</span>
        </button>

        <button
          onClick={() => handleNavigation('search')}
          className={`sidebar-menu-item ${currentView === 'search' ? 'active' : ''}`}
        >
          <Search className="w-4 h-4" />
          <span>Search & Filter</span>
        </button>
      </div>

      <div className="sidebar-divider"></div>

      {/* Navigation Menu */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Navigation</div>
        
        <button
          onClick={() => handleNavigation('prompts')}
          className={`sidebar-menu-item ${currentView === 'prompts' ? 'active' : ''}`}
        >
          <FileText className="w-4 h-4" />
          <span>Prompts</span>
        </button>

        <button
          onClick={() => handleNavigation('favorites')}
          className={`sidebar-menu-item ${currentView === 'favorites' ? 'active' : ''}`}
        >
          <Heart className="w-4 h-4" />
          <span>Favorites</span>
        </button>

        <button
          onClick={() => handleNavigation('chat')}
          className={`sidebar-menu-item ${currentView === 'chat' ? 'active' : ''}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Team Chat</span>
        </button>
      </div>

      <div className="sidebar-divider"></div>

      {/* Teams List */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Your Teams</div>
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.id);
              localStorage.setItem("activeTeam", t.id);
            }}
            className={`team-item ${activeTeam === t.id ? "active" : ""}`}
          >
            <Users className="w-4 h-4" />
            <span>{t.name}</span>
          </button>
        ))}
      </div>

      {/* Bottom Section */}
      <div style={{ marginTop: 'auto' }}>
        <div className="sidebar-divider"></div>
        <div className="sidebar-section">
          <button
            onClick={() => handleNavigation('settings')}
            className={`sidebar-menu-item ${currentView === 'settings' ? 'active' : ''}`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
