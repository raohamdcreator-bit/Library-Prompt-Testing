// src/App.jsx - Enhanced with Premium UI/UX
import { useEffect, useState, useRef } from "react";
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
  ArrowRight,
  ArrowUpRight,
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
// SCROLL REVEAL HOOK
// ===================================
function useScrollReveal() {
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .feature-card-3d');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);
}

// ===================================
// NAVBAR SCROLL EFFECT HOOK
// ===================================
function useNavbarScroll() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrolled;
}

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
      className={`${dimensions} flex items-center justify-center interactive-icon`}
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
// NAVIGATION COMPONENT - ENHANCED
// ===================================
function Navigation({ onSignIn, isAuthenticated, onNavigate, user }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrolled = useNavbarScroll();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <nav className={`modern-navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-content">
        <div className="navbar-logo" onClick={() => onNavigate("/")}>
          <Logo />
          <span className="navbar-logo-text">Prism</span>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-links hidden md:flex">
          <button onClick={() => onNavigate("/")} className="navbar-link">
            Home
          </button>
          <button onClick={() => onNavigate("/about")} className="navbar-link">
            About
          </button>
          <button onClick={() => onNavigate("/contact")} className="navbar-link">
            Contact
          </button>

          {isAdmin && (
            <button
              onClick={() => onNavigate("/admin")}
              className="btn-premium"
              style={{ padding: '10px 20px' }}
            >
              <Shield size={16} />
              Admin
              <ArrowRight size={16} className="btn-arrow" />
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop Sign In */}
        <div className="hidden md:flex items-center gap-3">
          {!isAuthenticated && (
            <button onClick={onSignIn} className="btn-premium">
              
              Sign in with Google
              <ArrowRight size={18} className="btn-arrow" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden" style={{ 
          padding: '1rem 2rem 2rem',
          borderTop: '1px solid rgba(139, 92, 246, 0.1)',
          background: 'rgba(10, 13, 20, 0.95)',
          backdropFilter: 'blur(20px)'
        }}>
          <div className="space-y-2">
            <button
              onClick={() => {
                onNavigate("/");
                setMobileMenuOpen(false);
              }}
              className="navbar-link w-full text-left px-4 py-3"
            >
              Home
            </button>
            <button
              onClick={() => {
                onNavigate("/about");
                setMobileMenuOpen(false);
              }}
              className="navbar-link w-full text-left px-4 py-3"
            >
              About
            </button>
            <button
              onClick={() => {
                onNavigate("/contact");
                setMobileMenuOpen(false);
              }}
              className="navbar-link w-full text-left px-4 py-3"
            >
              Contact
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  onNavigate("/admin");
                  setMobileMenuOpen(false);
                }}
                className="btn-premium w-full"
              >
                <Shield size={18} />
                Admin Dashboard
                <ArrowRight size={18} className="btn-arrow" />
              </button>
            )}

            {!isAuthenticated && (
              <button
                onClick={() => {
                  onSignIn();
                  setMobileMenuOpen(false);
                }}
                className="btn-premium w-full"
              >
                <Zap size={18} />
                Sign in with Google
                <ArrowRight size={18} className="btn-arrow" />
              </button>
            )}
          </div>
        </div>
      )}
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
              <Logo size="small" />
              <span className="font-bold navbar-logo-text">Prism</span>
            </div>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Building the future of AI prompt collaboration
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Platform
            </h4>
            <ul className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <li>
                <button onClick={() => onNavigate("/")} className="hover:text-foreground transition-colors">
                  Teams
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate("/")} className="hover:text-foreground transition-colors">
                  Prompts
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate("/")} className="hover:text-foreground transition-colors">
                  Analytics
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Company
            </h4>
            <ul className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <li>
                <button onClick={() => onNavigate("/about")} className="hover:text-foreground transition-colors">
                  About
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate("/contact")} className="hover:text-foreground transition-colors">
                  Contact
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Legal
            </h4>
            <ul className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <li>
                <button onClick={() => onNavigate("/privacy")} className="hover:text-foreground transition-colors">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate("/terms")} className="hover:text-foreground transition-colors">
                  Terms of Use
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div
          className="border-t mt-8 pt-8 text-center text-sm"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <p>© 2025 Prism. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ===================================
// LANDING PAGE - ENHANCED WITH ANIMATIONS
// ===================================
function LandingPage({ onSignIn, onNavigate }) {
  useScrollReveal();

  return (
    <div className="landing-page-container">
      {/* Animated Background Gradient Orbs */}
      <div className="gradient-orb gradient-orb-1"></div>
      <div className="gradient-orb gradient-orb-2"></div>
      <div className="grid-overlay"></div>

      <div className="relative z-10">
        <Navigation
          onSignIn={onSignIn}
          isAuthenticated={false}
          onNavigate={onNavigate}
          user={null}
        />

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="hero-badge mb-6 pulse-glow">
                <Sparkles size={16} />
                <span className="font-medium">AI-Powered Prompt Collaboration</span>
              </div>

              <h1 className="hero-title text-4xl md:text-6xl lg:text-7xl mb-6 px-4">
                Build {" "}
                <span style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                Better Prompts </span>
                with Your Team{" "}
              </h1>

              <p className="hero-description text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed px-4"
                style={{ color: "var(--muted-foreground)" }}>
                Store, share, and discover the best prompts for your projects.
              </p>

              {/* CTA Buttons */}
              <div className="hero-cta flex flex-row gap-4 justify-center items-center mb-8 px-4 whitespace-nowrap">
  <button
    onClick={onSignIn}
    className="btn-premium inline-flex items-center gap-2"
  >
    <span>Get Started</span>
    <ArrowRight size={20} className="btn-arrow" />
  </button>

  <button
    onClick={() => onNavigate("/waitlist")}
    className="btn-secondary inline-flex items-center gap-2"
  >
    <span>Join Waitlist</span>
    <ArrowUpRight size={20} className="btn-arrow" />
  </button>
</div>

              <div className="flex items-center justify-center gap-2 text-sm px-4"
                style={{ color: "var(--muted-foreground)" }}>
                <span className="text-center">
                  We're building something transformative • Your feedback will help us shape it
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid - 3D Rotation Cards */}
        <section className="container mx-auto px-4 py-20">
          <div className="section-header scroll-reveal">
            <h2 className="section-title">
              Everything you need to collaborate on AI prompts
            </h2>
            <p className="section-subtitle">
              Comprehensive tools designed for modern AI prompt development
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
              <div key={index} className="capsule-card feature-card-3d scroll-reveal">
                <div className="feature-icon-container">
                  <div style={{ color: "var(--primary)" }}>
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center scroll-reveal">
            <button className="btn-premium" onClick={onSignIn}>
              
              Explore Features
              <ArrowRight size={20} className="btn-arrow" />
            </button>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 py-20">
          <div className="capsule-card max-w-4xl mx-auto text-center pulse-glow scroll-reveal" 
            style={{ padding: '4rem 2rem' }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
              Ready to build smarter AI workflows?
            </h2>
            <p className="text-lg md:text-xl mb-8" style={{ color: "var(--muted-foreground)" }}>
              Join teams already transforming their AI collaboration
            </p>

            <div className="flex flex-row gap-4 justify-center items-center mb-8 px-4 whitespace-nowrap">
              <button onClick={onSignIn} className="btn-premium">
                
                Start Free
                <Zap size={20} />
              </button>
              <button
  onClick={() => onNavigate("/waitlist")}
  className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
>
  <span>Book Demo</span>
  <ArrowUpRight size={20} className="btn-arrow" />
</button>

            </div>
          </div>
        </section>

        <Footer onNavigate={onNavigate} />
      </div>
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

  // Navigation handler
  const navigate = (path) => {
    setCurrentPath(path);
    window.history.pushState({}, "", path);
    window.scrollTo(0, 0);
  };

  // Handle URL changes
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

  // Helper functions
  function getUserInitials(name, email) {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  }

  function UserAvatar({ src, name, email, size = "normal", className = "" }) {
    const [imageError, setImageError] = useState(false);
    const avatarClass = size === "small" ? "user-avatar-small" : "user-avatar";
    const initialsClass = size === "small" ? "avatar-initials avatar-initials-small" : "avatar-initials";

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

  // Load teams from Firestore
  useEffect(() => {
    if (!user) {
      setTeams([]);
      setActiveTeam(null);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "teams"), where(`members.${user.uid}`, "!=", null));

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

  // Set first team if no active team
  useEffect(() => {
    if (!user || loading) return;

    if (teams.length > 0 && !activeTeam && activeView !== "favorites") {
      setActiveTeam(teams[0].id);
    }
  }, [teams.length, activeTeam, activeView, user, loading, setActiveTeam]);

  // Validate active team still exists
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

  // Load current user's role
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

  // Load avatars and team stats
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

  // Create new team
  async function createTeam(name) {
    if (!name || !user) return;
    try {
      await addDoc(collection(db, "teams"), {
        name,
        ownerId: user.uid,
        members: { [user.uid]: "owner" },
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team. Please try again.");
    }
  }

  // Delete team (owner only)
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

  // Render special routes
  const isSpecialRoute = [
    "/contact",
    "/privacy",
    "/terms",
    "/about",
    "/join",
    "/waitlist",
    "/admin",
  ].some((route) => currentPath === route || currentPath.startsWith(route + "?"));

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
            <Route path="/contact"><Contact /></Route>
            <Route path="/privacy"><PrivacyPolicy /></Route>
            <Route path="/terms"><TermsOfUse /></Route>
            <Route path="/about"><About /></Route>
            <Route path="/join"><JoinTeam onNavigate={navigate} /></Route>
            <Route path="/waitlist"><Waitlist onNavigate={navigate} /></Route>
            <Route path="/admin"><AdminDashboard onNavigate={navigate} /></Route>
          </Router>
          {currentPath !== "/waitlist" && currentPath !== "/admin" && <Footer onNavigate={navigate} />}
        </div>
      </NavigationProvider>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="app-container">
        <div className="min-h-screen flex items-center justify-center">
          <div className="capsule-card p-8 text-center">
            <div className="neo-spinner mx-auto mb-4"></div>
            <p style={{ color: "var(--muted-foreground)" }}>Loading your teams...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <LandingPage onSignIn={signInWithGoogle} onNavigate={navigate} />;
  }

  // Main application UI
  return (
    <div className="app-container flex min-h-screen relative">
      {/* Sidebar Overlay for Mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div className={`team-sidebar w-72 p-4 flex flex-col ${sidebarOpen ? "mobile-visible" : "mobile-hidden"}`}>
        {/* Mobile Close Button */}
        <div className="md:hidden flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Menu</h2>
          <button onClick={() => setSidebarOpen(false)} className="mobile-menu-btn">
            <X size={24} />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="glass-card p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar src={user.photoURL} name={user.displayName} email={user.email} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {user.displayName || user.email}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--secondary)", color: "var(--primary)" }}>
                <Star size={20} />
              </div>
              <div>
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>My Favorites</span>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Your saved prompts</p>
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                  <Shield size={20} />
                </div>
                <div>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>Admin Dashboard</span>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Manage waitlist entries</p>
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
                isChatOpen ? "border-primary bg-popover" : "glass-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--primary)" }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>Team Chat</span>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
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
            <input type="text" name="teamName" placeholder="New team name" className="form-input" required />
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
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Teams</h2>
          {teams.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}>
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
            const stats = teamStats[team.id] || { memberCount: 0, promptCount: 0 };

            return (
              <div key={team.id} className={`team-item p-4 cursor-pointer ${isActive ? "active" : ""}`}>
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
                      <p className="font-semibold truncate" style={{ color: "var(--foreground)" }}>
                        {team.name}
                      </p>
                      {getRoleBadge(myRole)}
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
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
                  <div className="flex justify-between items-center mt-3 pt-3"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
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
          <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn">
            <Menu size={24} />
          </button>
          <div className="flex-1 min-w-0">
            {activeTeamObj ? (
              <h1 className="text-lg font-bold truncate" style={{ color: "var(--foreground)" }}>
                {activeTeamObj.name}
              </h1>
            ) : activeView === "favorites" ? (
              <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>My Favorites</h1>
            ) : null}
          </div>
        </div>

        {/* Desktop Header - Now using TeamHeader component */}
{activeTeamObj ? (
  <TeamHeader 
    teamId={activeTeamObj.id}
    userRole={role}
    activeTab={activeView}
    onTabChange={setActiveView}
  />
) : activeView === "favorites" ? (
  <div className="hidden md:block p-6 border-b"
    style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
    <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
      My Favorites
    </h1>
    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
      Your bookmarked prompts from all teams
    </p>
  </div>
) : null}

        {/* Mobile View Tabs */}
        {activeTeamObj && (
          <div className="md:hidden view-tabs-container border-b" style={{ borderColor: "var(--border)" }}>
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

        <div className="flex-1 p-4 md:p-6 overflow-y-auto" style={{ backgroundColor: "var(--background)" }}>
          {activeTeamObj && activeView === "prompts" && (
            <>
              <PromptList activeTeam={activeTeamObj.id} userRole={role} />
              {canManageMembers() && (
                <TeamInviteForm teamId={activeTeamObj.id} teamName={activeTeamObj.name} role={role} />
              )}
            </>
          )}

          {activeTeamObj && activeView === "members" && (
            <TeamMembers teamId={activeTeamObj.id} teamName={activeTeamObj.name} userRole={role} teamData={activeTeamObj} />
          )}

          {activeTeamObj && activeView === "analytics" && (
            <div className="space-y-6">
              <TeamAnalytics teamId={activeTeamObj.id} />
            </div>
          )}

          {activeTeamObj && activeView === "activity" && <ActivityFeed teamId={activeTeamObj.id} />}

          {activeTeamObj && activeView === "plagiarism" && (
            <PlagiarismChecker teamId={activeTeamObj.id} userRole={role} />
          )}

          {activeView === "favorites" && !activeTeam && <FavoritesList />}

          {!activeTeamObj && activeView !== "favorites" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12">
                <div className="glass-card p-6 md:p-8 max-w-md mx-auto">
                  <Sparkles size={48} className="mx-auto mb-4" style={{ color: "var(--primary)" }} />
                  <h2 className="text-lg md:text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                    No Team Selected
                  </h2>
                  <p className="mb-6 text-sm md:text-base" style={{ color: "var(--muted-foreground)" }}>
                    Select a team from the sidebar or create a new one to get started.
                  </p>
                  {teams.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Create your first team to start collaborating on AI prompts!
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
