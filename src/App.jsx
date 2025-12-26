// src/App.jsx - Enhanced with Professional Icons
import { useEffect, useState } from "react";
import { db } from "./lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "./context/AuthContext";
import { useActiveTeam } from "./context/AppStateContext";
import PromptList from "./components/PromptList";
import TeamInviteForm from "./components/TeamInviteForm";
import MyInvites from "./components/MyInvites";
import TeamMembers from "./components/TeamMembers";
import FavoritesList from "./components/Favorites";
import { TeamAnalytics } from "./components/PromptAnalytics";
import ActivityFeed from "./components/ActivityFeed";
import TeamChat from "./components/TeamChat";
import PlagiarismChecker from "./components/PlagiarismChecker";

// Lucide React Icons
import {
  Menu,
  X,
  Zap,
  Sparkles,
  Users,
  FileText,
  BarChart3,
  Activity,
  Search,
  MessageSquare,
  Star,
  Shield,
  LogOut,
  Plus,
  ChevronDown,
  Crown,
  UserCog,
  User,
} from "lucide-react";

// Import Legal/Info Pages
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import About from "./pages/About";
import JoinTeam from "./pages/JoinTeam";
import Waitlist from "./pages/Waitlist";
import AdminDashboard from "./pages/AdminDashboard";
import { NavigationProvider } from "./components/LegalLayout";

// Admin email configuration
const ADMIN_EMAIL = "rao.hamd.creator@gmail.com";

// ===================================
// ROUTER COMPONENTS
// ===================================
function Router({ currentPath, children }) {
  const routes = Array.isArray(children) ? children : [children];
  const route = routes.find((r) => {
    const routePath = r.props.path;
    if (currentPath === routePath) return true;
    if (currentPath.startsWith(routePath + "?")) return true;
    return false;
  });
  return route || null;
}

function Route({ children }) {
  return children;
}

// ===================================
// LOGO COMPONENT
// ===================================
function Logo({ size = "normal", onClick }) {
  const dimensions =
    size === "small" ? "w-6 h-6" : size === "large" ? "w-12 h-12" : "w-8 h-8";

  return (
    <div
      className={`${dimensions} flex items-center justify-center`}
      onClick={onClick}
    >
      <img
        src="/logo.png"
        alt="Prism Logo"
        className="w-full h-full object-contain"
        style={{ filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))" }}
      />
    </div>
  );
}

// ===================================
// MOBILE MENU ICON
// ===================================
function MenuIcon({ isOpen }) {
  return isOpen ? <X size={24} /> : <Menu size={24} />;
}

// ===================================
// NAVIGATION COMPONENT
// ===================================
function Navigation({ onSignIn, isAuthenticated, onNavigate, user }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <nav
      className="border-b"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onNavigate("/")}
          >
            <Logo />
            <span
              className="text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Prism
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => onNavigate("/")}
              className="transition-colors hover:text-foreground"
              style={{ color: "var(--muted-foreground)" }}
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("/about")}
              className="transition-colors hover:text-foreground"
              style={{ color: "var(--muted-foreground)" }}
            >
              About
            </button>
            <button
              onClick={() => onNavigate("/contact")}
              className="transition-colors hover:text-foreground"
              style={{ color: "var(--muted-foreground)" }}
            >
              Contact
            </button>

            {isAdmin && (
              <button
                onClick={() => onNavigate("/admin")}
                className="px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                  border: "1px solid var(--primary)",
                }}
                title="Admin Dashboard - Manage Waitlist"
              >
                <Shield size={16} />
                Admin
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <MenuIcon isOpen={mobileMenuOpen} />
          </button>

          {/* Desktop Sign In */}
          <div className="hidden md:flex items-center gap-3">
            {!isAuthenticated && (
              <button
                onClick={onSignIn}
                className="btn-primary px-6 py-2 flex items-center gap-2"
              >
                <Zap size={18} />
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-2">
            <button
              onClick={() => {
                onNavigate("/");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              Home
            </button>
            <button
              onClick={() => {
                onNavigate("/about");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              About
            </button>
            <button
              onClick={() => {
                onNavigate("/contact");
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              Contact
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  onNavigate("/admin");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg font-semibold flex items-center gap-2"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <Shield size={18} />
                Admin Dashboard
              </button>
            )}

            {!isAuthenticated && (
              <button
                onClick={() => {
                  onSignIn();
                  setMobileMenuOpen(false);
                }}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Zap size={18} />
                Sign in with Google
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

// ===================================
// FOOTER COMPONENT
// ===================================
function Footer({ onNavigate }) {
  return (
    <footer
      className="border-t mt-20"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <img
                  src="/logo.png"
                  alt="Prompt Teams Logo"
                  className="w-full h-full object-contain"
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))",
                  }}
                />
              </div>
              <span
                className="font-bold"
                style={{ color: "var(--foreground)" }}
              >
                Prism
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Building the future of AI prompt collaboration
            </p>
          </div>
          <div>
            <h4
              className="font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Platform
            </h4>
            <ul
              className="space-y-2 text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li>
                <button
                  onClick={() => onNavigate("/")}
                  className="hover:text-foreground transition-colors"
                >
                  Teams
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("/")}
                  className="hover:text-foreground transition-colors"
                >
                  Prompts
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("/")}
                  className="hover:text-foreground transition-colors"
                >
                  Analytics
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4
              className="font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Company
            </h4>
            <ul
              className="space-y-2 text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li>
                <button
                  onClick={() => onNavigate("/about")}
                  className="hover:text-foreground transition-colors"
                >
                  About
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("/contact")}
                  className="hover:text-foreground transition-colors"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4
              className="font-semibold mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Legal
            </h4>
            <ul
              className="space-y-2 text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              <li>
                <button
                  onClick={() => onNavigate("/privacy")}
                  className="hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("/terms")}
                  className="hover:text-foreground transition-colors"
                >
                  Terms of Use
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div
          className="border-t mt-8 pt-8 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          <p>© 2025 Prompt Teams. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ===================================
// LANDING PAGE COMPONENT
// ===================================
function LandingPage({ onSignIn, onNavigate }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navigation
        onSignIn={onSignIn}
        isAuthenticated={false}
        onNavigate={onNavigate}
        user={null}
      />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <div
              className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs md:text-sm"
              style={{
                backgroundColor: "var(--secondary)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              <Sparkles size={16} />
              <span className="font-medium">
                AI-Powered Prompt Collaboration
              </span>
            </div>

            <h1
              className="text-3xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6 px-4"
              style={{ color: "var(--foreground)" }}
            >
              Build Better Prompts with{" "}
              <span style={{ color: "var(--primary)" }}>Your Team</span>
            </h1>

            <p
              className="text-base md:text-xl mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed px-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              Collaborate on AI prompts with your team. Store, share, and
              discover the best prompts for your projects.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 md:mb-12 px-4">
            <button
              onClick={onSignIn}
              className="btn-primary px-6 md:px-8 py-3 text-base md:text-lg font-medium w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Zap size={20} />
              Get Started
            </button>
            <button
              onClick={() => onNavigate("/waitlist")}
              className="btn-secondary px-6 md:px-8 py-3 text-base md:text-lg font-medium w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Join Waitlist
            </button>
          </div>
          <div
            className="flex items-center justify-center gap-2 text-xs md:text-sm px-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span className="text-center">
              We're building something transformative • Your feedback will help
              us shape it
            </span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12 md:mb-16">
          <h2
            className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Everything you need to collaborate on AI prompts
          </h2>
          <p
            className="text-base md:text-lg max-w-2xl mx-auto px-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            Comprehensive tools designed for modern AI prompt development
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          {[
            {
              icon: <Users size={24} />,
              title: "Real-time Collaboration",
              desc: "Work together seamlessly with live updates and team chat.",
            },
            {
              icon: <FileText size={24} />,
              title: "Prompt Version Control",
              desc: "Track changes and revert to previous versions effortlessly.",
            },
            {
              icon: <Sparkles size={24} />,
              title: "Multi-Model Testing",
              desc: "Test prompts across different AI models simultaneously.",
            },
            {
              icon: <Shield size={24} />,
              title: "Prompt Privacy Controls",
              desc: "Granular permissions to control who sees what.",
            },
            {
              icon: <Search size={24} />,
              title: "Plagiarism Detection",
              desc: "Ensure originality with built-in similarity checks.",
            },
            {
              icon: <FileText size={24} />,
              title: "Attach Outputs",
              desc: "Save text, code, images and results alongside prompts.",
            },
            {
              icon: <BarChart3 size={24} />,
              title: "Analytics",
              desc: "Track usage patterns and optimize performance.",
            },
            {
              icon: <Users size={24} />,
              title: "Team Workspace",
              desc: "Owner, Admin, and Member roles with custom permissions.",
            },
            {
              icon: <Zap size={24} />,
              title: "Execute & Export",
              desc: "Run prompts directly and export to JSON/API formats.",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="glass-card p-4 md:p-6 hover:border-primary transition-all duration-300"
            >
              <div
                className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center mb-4"
                style={{
                  backgroundColor: "var(--secondary)",
                  color: "var(--primary)",
                }}
              >
                {feature.icon}
              </div>
              <h3
                className="text-base md:text-lg font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                {feature.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            className="btn-primary px-6 md:px-8 py-3 text-base md:text-lg font-medium flex items-center gap-2 mx-auto"
            onClick={onSignIn}
          >
            <Sparkles size={20} />
            Explore Features
          </button>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="container mx-auto px-4 py-12 md:py-20"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-2xl md:text-3xl lg:text-5xl font-bold mb-4 md:mb-6"
            style={{ color: "var(--foreground)" }}
          >
            Ready to build smarter AI workflows?
          </h2>
          <p
            className="text-base md:text-xl mb-6 md:mb-8"
            style={{ color: "var(--muted-foreground)" }}
          >
            Join teams already transforming their AI collaboration
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <button
              onClick={onSignIn}
              className="btn-primary px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold w-full sm:w-auto sm:min-w-[200px] flex items-center justify-center gap-2"
            >
              <Zap size={20} />
              Start Free
            </button>
            <button
              onClick={() => onNavigate("/waitlist")}
              className="btn-secondary px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold w-full sm:w-auto sm:min-w-[200px] flex items-center justify-center gap-2"
            >
              <MessageSquare size={20} />
              Book Demo
            </button>
          </div>
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

// ===================================
// MAIN APP COMPONENT
// ===================================
export default function App() {
  const { user, signInWithGoogle, logout } = useAuth();
  const { activeTeam, setActiveTeam } = useActiveTeam();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const [teams, setTeams] = useState([]);
  const [role, setRole] = useState(null);
  const [avatars, setAvatars] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("prompts");
  const [teamStats, setTeamStats] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ===================================
  // NAVIGATION HANDLER
  // ===================================
  const navigate = (path) => {
    setCurrentPath(path);
    window.history.pushState({}, "", path);
    window.scrollTo(0, 0);
  };

  // ===================================
  // HANDLE URL CHANGES
  // ===================================
  useEffect(() => {
    const path = window.location.pathname;
    setCurrentPath(path);

    const handlePopState = () => {
      const newPath = window.location.pathname;
      setCurrentPath(newPath);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ===================================
  // HELPER FUNCTIONS
  // ===================================
  function getUserInitials(name, email) {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  }

  function UserAvatar({ src, name, email, size = "normal", className = "" }) {
    const [imageError, setImageError] = useState(false);
    const avatarClass = size === "small" ? "user-avatar-small" : "user-avatar";
    const initialsClass =
      size === "small"
        ? "avatar-initials avatar-initials-small"
        : "avatar-initials";

    if (!src || imageError) {
      return (
        <div className={`${initialsClass} ${avatarClass} ${className}`}>
          {getUserInitials(name, email)}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt="avatar"
        className={`${avatarClass} ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // ===================================
  // LOAD TEAMS FROM FIRESTORE
  // ===================================
  useEffect(() => {
    if (!user) {
      setTeams([]);
      setActiveTeam(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "teams"),
      where(`members.${user.uid}`, "!=", null)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeams(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading teams:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, setActiveTeam]);

  // ===================================
  // SET FIRST TEAM IF NO ACTIVE TEAM
  // ===================================
  useEffect(() => {
    if (!user || loading) return;

    if (teams.length > 0 && !activeTeam && activeView !== "favorites") {
      setActiveTeam(teams[0].id);
    }
  }, [teams.length, activeTeam, activeView, user, loading, setActiveTeam]);

  // ===================================
  // VALIDATE ACTIVE TEAM STILL EXISTS
  // ===================================
  useEffect(() => {
    if (!user || loading || !activeTeam || teams.length === 0) return;

    const teamExists = teams.find((t) => t.id === activeTeam);
    if (!teamExists) {
      setActiveTeam(null);
      if (activeView !== "favorites") {
        setActiveView("prompts");
      }
    }
  }, [teams, activeTeam, user, loading, setActiveTeam, activeView]);

  // ===================================
  // LOAD CURRENT USER'S ROLE
  // ===================================
  useEffect(() => {
    if (!activeTeam || !user) {
      setRole(null);
      return;
    }

    async function fetchRole() {
      try {
        const teamRef = doc(db, "teams", activeTeam);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const data = teamSnap.data();
          setRole(data.members?.[user.uid] || "member");
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole("member");
      }
    }

    fetchRole();
  }, [activeTeam, user]);

  // ===================================
  // LOAD AVATARS AND TEAM STATS
  // ===================================
  useEffect(() => {
    async function loadTeamData() {
      const avatarResults = {};
      const statsResults = {};

      for (const team of teams) {
        for (const uid of Object.keys(team.members || {})) {
          if (!avatarResults[uid]) {
            try {
              const snap = await getDoc(doc(db, "users", uid));
              if (snap.exists()) {
                const userData = snap.data();
                avatarResults[uid] = {
                  avatar: userData.avatar,
                  name: userData.name,
                  email: userData.email,
                };
              }
            } catch (error) {
              console.error("Error loading avatar for", uid, error);
            }
          }
        }

        try {
          const promptsQuery = collection(db, "teams", team.id, "prompts");
          const promptsSnapshot = await getDocs(promptsQuery);
          const promptCount = promptsSnapshot.size;

          statsResults[team.id] = {
            memberCount: Object.keys(team.members || {}).length,
            promptCount: promptCount,
          };
        } catch (error) {
          console.error("Error loading team stats:", error);
          statsResults[team.id] = {
            memberCount: Object.keys(team.members || {}).length,
            promptCount: 0,
          };
        }
      }

      setAvatars(avatarResults);
      setTeamStats(statsResults);
    }

    if (teams.length > 0) loadTeamData();
  }, [teams]);

  // ===================================
  // CREATE NEW TEAM
  // ===================================
  async function createTeam(name) {
    if (!name || !user) return;
    try {
      await addDoc(collection(db, "teams"), {
        name,
        ownerId: user.uid,
        members: {
          [user.uid]: "owner",
        },
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team. Please try again.");
    }
  }

  // ===================================
  // DELETE TEAM (OWNER ONLY)
  // ===================================
  async function deleteTeam(teamId) {
    if (!user) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    if (team.ownerId !== user.uid) {
      alert("Only the team owner can delete this team.");
      return;
    }

    const memberCount = Object.keys(team.members || {}).length;
    const confirmMessage =
      memberCount > 1
        ? `Delete team "${team.name}"? This will remove ${memberCount} members and cannot be undone.`
        : `Delete team "${team.name}"? This cannot be undone.`;

    if (confirm(confirmMessage)) {
      try {
        await deleteDoc(doc(db, "teams", teamId));
        if (activeTeam === teamId) {
          setActiveTeam(null);
          setActiveView("prompts");
        }
      } catch (error) {
        console.error("Error deleting team:", error);
        alert("Failed to delete team. Please try again.");
      }
    }
  }

  // ===================================
  // HELPER FUNCTIONS FOR UI
  // ===================================
  const activeTeamObj = teams.find((t) => t.id === activeTeam);

  function getRoleBadge(role) {
    const baseStyle = {
      padding: "4px 12px",
      borderRadius: "6px",
      fontSize: "0.75rem",
      fontWeight: "500",
      border: "1px solid var(--border)",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    };

    const icons = {
      owner: <Crown size={12} />,
      admin: <UserCog size={12} />,
      member: <User size={12} />,
    };

    const styles = {
      owner: {
        ...baseStyle,
        backgroundColor: "var(--primary)",
        color: "var(--primary-foreground)",
        borderColor: "var(--primary)",
      },
      admin: {
        ...baseStyle,
        backgroundColor: "var(--accent)",
        color: "var(--accent-foreground)",
        borderColor: "var(--accent)",
      },
      member: {
        ...baseStyle,
        backgroundColor: "var(--secondary)",
        color: "var(--secondary-foreground)",
        borderColor: "var(--border)",
      },
    };

    return (
      <span style={styles[role] || styles.member}>
        {icons[role] || icons.member}
        {role}
      </span>
    );
  }

  function canManageMembers() {
    return role === "owner" || role === "admin";
  }

  // ===================================
  // RENDER SPECIAL ROUTES
  // ===================================
  const isSpecialRoute = [
    "/contact",
    "/privacy",
    "/terms",
    "/about",
    "/join",
    "/waitlist",
    "/admin",
  ].some(
    (route) => currentPath === route || currentPath.startsWith(route + "?")
  );

  if (isSpecialRoute) {
    return (
      <NavigationProvider navigate={navigate}>
        <div style={{ background: "var(--background)", minHeight: "100vh" }}>
          {currentPath !== "/waitlist" && (
            <Navigation
              onSignIn={signInWithGoogle}
              isAuthenticated={!!user}
              onNavigate={navigate}
              user={user}
            />
          )}
          <Router currentPath={currentPath.split("?")[0]}>
            <Route path="/contact">
              <Contact />
            </Route>
            <Route path="/privacy">
              <PrivacyPolicy />
            </Route>
            <Route path="/terms">
              <TermsOfUse />
            </Route>
            <Route path="/about">
              <About />
            </Route>
            <Route path="/join">
              <JoinTeam onNavigate={navigate} />
            </Route>
            <Route path="/waitlist">
              <Waitlist onNavigate={navigate} />
            </Route>
            <Route path="/admin">
              <AdminDashboard onNavigate={navigate} />
            </Route>
          </Router>
          {currentPath !== "/waitlist" && currentPath !== "/admin" && (
            <Footer onNavigate={navigate} />
          )}
        </div>
      </NavigationProvider>
    );
  }

  // ===================================
  // LOADING STATE
  // ===================================
  if (loading) {
    return (
      <div className="app-container">
        <div className="min-h-screen flex items-center justify-center">
          <div className="glass-card p-8 text-center">
            <div className="neo-spinner mx-auto mb-4"></div>
            <p style={{ color: "var(--muted-foreground)" }}>
              Loading your teams...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===================================
  // NOT AUTHENTICATED
  // ===================================
  if (!user) {
    return <LandingPage onSignIn={signInWithGoogle} onNavigate={navigate} />;
  }

  // ===================================
  // MAIN APPLICATION UI
  // ===================================
  return (
    <div className="app-container flex min-h-screen relative">
      {/* Sidebar Overlay for Mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div
        className={`team-sidebar w-72 p-4 flex flex-col ${
          sidebarOpen ? "mobile-visible" : "mobile-hidden"
        }`}
      >
        {/* Mobile Close Button */}
        <div className="md:hidden flex justify-between items-center mb-4">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Menu
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="mobile-menu-btn"
          >
            <X size={24} />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="glass-card p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar
              src={user.photoURL}
              name={user.displayName}
              email={user.email}
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--foreground)" }}
              >
                {user.displayName || user.email}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {teams.length} {teams.length === 1 ? "team" : "teams"}
              </p>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full status-dot"></div>
          </div>
        </div>

        {/* My Favorites */}
        <div className="mb-4">
          <button
            onClick={() => {
              setActiveTeam(null);
              setActiveView("favorites");
              setIsChatOpen(false);
              setSidebarOpen(false);
            }}
            className={`w-full p-4 text-left rounded-lg transition-all duration-300 border ${
              activeView === "favorites" && !activeTeam
                ? "border-primary bg-popover"
                : "glass-card hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: "var(--secondary)",
                  color: "var(--primary)",
                }}
              >
                <Star size={20} />
              </div>
              <div>
                <span
                  className="font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  My Favorites
                </span>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Your saved prompts
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Admin Dashboard Button */}
        {user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
          <div className="mb-4">
            <button
              onClick={() => {
                navigate("/admin");
                setSidebarOpen(false);
              }}
              className="w-full p-4 text-left rounded-lg transition-all duration-300 border glass-card hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  <Shield size={20} />
                </div>
                <div>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Admin Dashboard
                  </span>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Manage waitlist entries
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Team Chat Button */}
        {activeTeamObj && (
          <div className="mb-4">
            <button
              onClick={() => {
                setIsChatOpen(!isChatOpen);
                setSidebarOpen(false);
              }}
              className={`w-full p-4 text-left rounded-lg transition-all duration-300 border ${
                isChatOpen
                  ? "border-primary bg-popover"
                  : "glass-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--secondary)",
                    color: "var(--primary)",
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <div>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Team Chat
                  </span>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {isChatOpen ? "Close chat" : "Open chat"}
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Create Team & Sign Out */}
        <div className="space-y-3 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = e.target.teamName.value.trim();
              if (name) {
                createTeam(name);
                e.target.reset();
              }
            }}
            className="space-y-2"
          >
            <input
              type="text"
              name="teamName"
              placeholder="New team name"
              className="form-input"
              required
            />
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={18} />
              Create Team
            </button>
          </form>

          <button onClick={logout} className="btn-secondary w-full flex items-center justify-center gap-2">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

        {/* Teams List */}
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Teams
          </h2>
          {teams.length > 0 && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: "var(--secondary)",
                color: "var(--secondary-foreground)",
              }}
            >
              {teams.length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {teams.map((team) => {
            const isOwner = team.ownerId === user.uid;
            const myRole = team.members?.[user.uid];
            const ownerData = avatars[team.ownerId];
            const isActive = activeTeam === team.id;
            const stats = teamStats[team.id] || {
              memberCount: 0,
              promptCount: 0,
            };

            return (
              <div
                key={team.id}
                className={`team-item p-4 cursor-pointer ${
                  isActive ? "active" : ""
                }`}
              >
                <div
                  onClick={() => {
                    setActiveTeam(team.id);
                    setActiveView("prompts");
                    setSidebarOpen(false);
                  }}
                  className="flex items-start gap-3"
                >
                  <UserAvatar
                    src={ownerData?.avatar}
                    name={ownerData?.name}
                    email={ownerData?.email}
                    size="small"
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p
                        className="font-semibold truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {team.name}
                      </p>
                      {getRoleBadge(myRole)}
                    </div>
                    <div
                      className="flex items-center gap-4 text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {stats.memberCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {stats.promptCount}
                      </span>
                    </div>
                  </div>
                </div>

                {isActive && (
                  <div
                    className="flex justify-between items-center mt-3 pt-3"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <div
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Owner: {ownerData?.name || ownerData?.email || "Unknown"}
                    </div>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTeam(team.id);
                        }}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ color: "var(--destructive)" }}
                        title="Delete team"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden mobile-header">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-menu-btn"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1 min-w-0">
            {activeTeamObj ? (
              <h1
                className="text-lg font-bold truncate"
                style={{ color: "var(--foreground)" }}
              >
                {activeTeamObj.name}
              </h1>
            ) : activeView === "favorites" ? (
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--foreground)" }}
              >
                My Favorites
              </h1>
            ) : null}
          </div>
        </div>

        {/* Desktop Header */}
        <div
          className="hidden md:block p-6 border-b"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              {activeTeamObj ? (
                <>
                  <h1
                    className="text-2xl font-bold mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    {activeTeamObj.name}
                  </h1>
                  <div
                    className="flex items-center gap-4 text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span className="flex items-center gap-2">
                      Your role:
                      {getRoleBadge(role)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users size={14} />
                      {Object.keys(activeTeamObj.members || {}).length} members
                    </span>
                  </div>
                </>
              ) : activeView === "favorites" ? (
                <>
                  <h1
                    className="text-2xl font-bold mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    My Favorites
                  </h1>
                  <p
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Your bookmarked prompts from all teams
                  </p>
                </>
              ) : null}
            </div>

            {activeTeamObj && (
              <div className="glass-card p-1 rounded-lg">
                {[
                  { id: "prompts", icon: FileText, label: "Prompts" },
                  { id: "members", icon: Users, label: "Members" },
                  { id: "analytics", icon: BarChart3, label: "Analytics" },
                  { id: "activity", icon: Activity, label: "Activity" },
                  { id: "plagiarism", icon: Search, label: "Plagiarism" },
                ].map((view) => (
                  <button
                    key={view.id}
                    onClick={() => setActiveView(view.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 capitalize flex items-center gap-2 ${
                      activeView === view.id
                        ? "text-primary-foreground"
                        : "hover:text-foreground"
                    }`}
                    style={
                      activeView === view.id
                        ? {
                            backgroundColor: "var(--primary)",
                            color: "var(--primary-foreground)",
                          }
                        : { color: "var(--muted-foreground)" }
                    }
                  >
                    <view.icon size={16} />
                    {view.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Tabs */}
        {activeTeamObj && (
          <div
            className="md:hidden view-tabs-container border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="view-tabs">
              {[
                { id: "prompts", icon: FileText },
                { id: "members", icon: Users },
                { id: "analytics", icon: BarChart3 },
                { id: "activity", icon: Activity },
                { id: "plagiarism", icon: Search },
              ].map((view) => (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`view-tab rounded-lg transition-all duration-200 capitalize flex items-center gap-2 ${
                    activeView === view.id ? "border-primary" : ""
                  }`}
                  style={
                    activeView === view.id
                      ? {
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                          border: "1px solid var(--primary)",
                        }
                      : {
                          backgroundColor: "var(--card)",
                          color: "var(--muted-foreground)",
                          border: "1px solid var(--border)",
                        }
                  }
                >
                  <view.icon size={16} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="flex-1 p-4 md:p-6 overflow-y-auto"
          style={{ backgroundColor: "var(--background)" }}
        >
          {activeTeamObj && activeView === "prompts" && (
            <>
              <PromptList activeTeam={activeTeamObj.id} userRole={role} />

              {canManageMembers() && (
                <TeamInviteForm
                  teamId={activeTeamObj.id}
                  teamName={activeTeamObj.name}
                  role={role}
                />
              )}
            </>
          )}

          {activeTeamObj && activeView === "members" && (
            <TeamMembers
              teamId={activeTeamObj.id}
              teamName={activeTeamObj.name}
              userRole={role}
              teamData={activeTeamObj}
            />
          )}

          {activeTeamObj && activeView === "analytics" && (
            <div className="space-y-6">
              <TeamAnalytics teamId={activeTeamObj.id} />
            </div>
          )}

          {activeTeamObj && activeView === "activity" && (
            <ActivityFeed teamId={activeTeamObj.id} />
          )}

          {activeTeamObj && activeView === "plagiarism" && (
            <PlagiarismChecker teamId={activeTeamObj.id} userRole={role} />
          )}

          {activeView === "favorites" && !activeTeam && <FavoritesList />}

          {!activeTeamObj && activeView !== "favorites" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12">
                <div className="glass-card p-6 md:p-8 max-w-md mx-auto">
                  <Sparkles
                    size={48}
                    className="mx-auto mb-4"
                    style={{ color: "var(--primary)" }}
                  />
                  <h2
                    className="text-lg md:text-xl font-semibold mb-4"
                    style={{ color: "var(--foreground)" }}
                  >
                    No Team Selected
                  </h2>
                  <p
                    className="mb-6 text-sm md:text-base"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Select a team from the sidebar or create a new one to get
                    started.
                  </p>
                  {teams.length === 0 && (
                    <p
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Create your first team to start collaborating on AI
                      prompts!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <MyInvites />
      </div>

      {/* Team Chat Component */}
      {activeTeamObj && (
        <TeamChat
          teamId={activeTeamObj.id}
          teamName={activeTeamObj.name}
          position="right"
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
        />
      )}
    </div>
  );
}
