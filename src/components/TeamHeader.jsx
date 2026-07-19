// src/components/TeamHeader.jsx - RESPONSIVE: Complete guest mode support + mobile-first + glassmorphism
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  FileText,
  Users,
  BarChart3,
  Activity,
  Shield,
  Lock,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

export default function TeamHeader({
  teamId,
  userRole,
  activeTab = "prompts",
  onTabChange,
  user,
  isGuestMode = false,
}) {
  const [teamData, setTeamData] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [mobileTabOpen, setMobileTabOpen] = useState(false);

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
        if (!isGuestMode) {
          console.error("Error loading team data:", error);
        }
      }
    }
    loadTeamData();
  }, [teamId, user, isGuestMode]);

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

  const activeTabData = tabs.find((t) => t.id === activeTab);

  if (!teamData) {
    return (
      <div className="team-header-container">
        <div className="team-header-info th-glass">
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Loading team...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* ── Glassmorphism base ── */
        .th-wrap {
          position: relative;
          background: rgba(255,255,255,.045);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border: 1px solid rgba(255,255,255,.10);
          overflow: hidden;
          margin-bottom: .25rem;
          box-shadow:
            0 8px 32px rgba(0,0,0,.28),
            inset 0 1px 0 rgba(255,255,255,.06);
        }
        /* subtle top sheen to sell the glass */
        .th-wrap::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 40%);
          pointer-events: none;
        }

        /* ── Top info bar ── */
        .th-info {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          padding: .875rem 1.125rem;
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.02);
          flex-wrap: wrap;
        }
        .th-info-left {
          display: flex;
          align-items: center;
          gap: .625rem;
          min-width: 0;
          flex: 1;
        }
        .th-name {
          font-size: 1rem;
          font-weight: 800;
          color: var(--foreground);
          letter-spacing: -.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .th-role-badge {
          font-size: .62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
          padding: .18rem .55rem;
          border-radius: 5px;
          border: 1px solid;
          white-space: nowrap;
          flex-shrink: 0;
          backdrop-filter: blur(6px);
        }
        .th-meta {
          display: flex;
          align-items: center;
          gap: .35rem;
          font-size: .72rem;
          color: var(--muted-foreground);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Desktop tab nav — equal gap / equal width columns ── */
        .th-tabs-desktop {
          position: relative;
          display: flex;
          align-items: stretch;
          width: 100%;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .th-tabs-desktop::-webkit-scrollbar { display: none; }

        .th-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .45rem;
          flex: 1 1 0;
          min-width: 0;
          padding: .75rem 1rem;
          font-size: .78rem;
          font-weight: 600;
          color: var(--muted-foreground);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: background .15s ease, color .15s ease, border-color .15s ease;
          white-space: nowrap;
          position: relative;
        }
        /* thin glass dividers between equal-width tabs */
        .th-tab + .th-tab::before {
          content: "";
          position: absolute;
          left: 0;
          top: 22%;
          bottom: 22%;
          width: 1px;
          background: rgba(255,255,255,.07);
        }
        .th-tab:hover:not(:disabled) {
          color: var(--foreground);
          background: rgba(255,255,255,.05);
        }
        .th-tab.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background: rgba(139,92,246,.10);
          backdrop-filter: blur(4px);
        }
        .th-tab:disabled {
          cursor: not-allowed;
        }
        .th-tab-lock {
          opacity: .55;
          font-size: .6rem;
        }

        /* ── Mobile tab dropdown ── */
        .th-tabs-mobile {
          display: none;
        }
        .th-mobile-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: .65rem 1.125rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--foreground);
          font-size: .82rem;
          font-weight: 600;
          gap: .5rem;
        }
        .th-mobile-trigger-left {
          display: flex;
          align-items: center;
          gap: .5rem;
          color: var(--primary);
        }
        .th-mobile-dropdown {
          background: rgba(255,255,255,.04);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border-top: 1px solid rgba(255,255,255,.08);
          animation: thDrop .15s ease-out;
        }
        .th-mobile-item {
          display: flex;
          align-items: center;
          gap: .5rem;
          padding: .65rem 1.375rem;
          font-size: .8rem;
          font-weight: 500;
          color: var(--muted-foreground);
          background: transparent;
          border: none;
          width: 100%;
          cursor: pointer;
          transition: background .12s ease, color .12s ease;
          border-bottom: 1px solid rgba(255,255,255,.05);
        }
        .th-mobile-item:last-child { border-bottom: none; }
        .th-mobile-item:hover:not(:disabled) {
          background: rgba(255,255,255,.05);
          color: var(--foreground);
        }
        .th-mobile-item.active {
          color: var(--primary);
          background: rgba(139,92,246,.10);
        }
        .th-mobile-item:disabled { cursor: not-allowed; }

        @keyframes thDrop {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: none; }
        }

        /* ── Breakpoints ── */
        @media (max-width: 600px) {
          .th-tabs-desktop { display: none; }
          .th-tabs-mobile  { display: block; }
          .th-name { font-size: .9rem; }
          .th-info { padding: .7rem .875rem; }
        }

        @media (min-width: 601px) and (max-width: 860px) {
          .th-tab { padding: .7rem .5rem; font-size: .74rem; }
          .th-tab span { display: none; }
          .th-tab { gap: 0; }
        }

        @media (min-width: 861px) {
          .th-tab span { display: inline; }
        }
      `}</style>

      <div className="th-wrap">
        {/* Info bar */}
        <div className="th-info">
          <div className="th-info-left">
            <h1 className="th-name">{teamData.name}</h1>
            {isGuestMode ? (
              <span
                className="th-role-badge"
                style={{
                  borderColor: "rgba(139,92,246,.5)",
                  backgroundColor: "rgba(139,92,246,.12)",
                  color: "rgba(139,92,246,.95)",
                }}
              >
                guest
              </span>
            ) : (
              userRole && (
                <span
                  className="th-role-badge"
                  style={{
                    borderColor: getRoleBadgeColor(userRole),
                    backgroundColor: `${getRoleBadgeColor(userRole)}18`,
                    color: getRoleBadgeColor(userRole),
                  }}
                >
                  {userRole}
                </span>
              )
            )}
          </div>
          <div className="th-meta">
            <Users size={13} />
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </div>
        </div>

        {/* Desktop tabs — flex:1 columns give perfectly equal gaps regardless of label width */}
        <nav className="th-tabs-desktop">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isDisabled = isGuestMode && tab.id !== "prompts";
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
                className={`th-tab${activeTab === tab.id ? " active" : ""}${isDisabled ? " opacity-50" : ""}`}
                disabled={isDisabled}
                title={isDisabled ? "Sign up to access" : tab.label}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {isDisabled && <Lock size={10} className="th-tab-lock" />}
              </button>
            );
          })}
        </nav>

        {/* Mobile tab dropdown */}
        <div className="th-tabs-mobile">
          <button
            className="th-mobile-trigger"
            onClick={() => setMobileTabOpen((v) => !v)}
          >
            <div className="th-mobile-trigger-left">
              {activeTabData && <activeTabData.icon size={15} />}
              {activeTabData?.label || "Prompts"}
            </div>
            <ChevronDown
              size={14}
              style={{
                transform: mobileTabOpen ? "rotate(180deg)" : "none",
                transition: "transform .2s",
                color: "var(--muted-foreground)",
              }}
            />
          </button>
          {mobileTabOpen && (
            <div className="th-mobile-dropdown">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isDisabled = isGuestMode && tab.id !== "prompts";
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isDisabled) {
                        alert("Sign up to access " + tab.label + "!");
                        return;
                      }
                      onTabChange && onTabChange(tab.id);
                      setMobileTabOpen(false);
                    }}
                    className={`th-mobile-item${activeTab === tab.id ? " active" : ""}`}
                    disabled={isDisabled}
                  >
                    <Icon size={14} />
                    {tab.label}
                    {isDisabled && (
                      <Lock
                        size={11}
                        style={{ marginLeft: "auto", opacity: 0.5 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
