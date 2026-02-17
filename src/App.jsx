// src/App.jsx - FIXED: Proper guest team access initialization and redirect
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
import { useGuestMode } from "./context/GuestModeContext";
// ✅ FIX 1: Added clearGuestAccess to imports; removed setGuestToken/debugGuestToken (they're handled inside guestTeamAccess.js now)
import { hasGuestAccess, setGuestAccess, clearGuestAccess, clearGuestAccessCache } from "./lib/guestTeamAccess";
import SaveLockModal from "./components/SaveLockModal";
import PromptList from "./components/PromptList";
import TeamInviteForm from "./components/TeamInviteForm";
import MyInvites from "./components/MyInvites";
import TeamMembers from "./components/TeamMembers";
import TeamHeader from "./components/TeamHeader";
import FavoritesList from "./components/Favorites";
import { TeamAnalytics } from "./components/PromptAnalytics";
import ActivityFeed from "./components/ActivityFeed";
import TeamChat from "./components/TeamChat";
import PlagiarismChecker from "./components/PlagiarismChecker";
import IntroVideoSection from "./components/IntroVideoSection";
import OnboardingExperience from "./components/OnboardingExperience";
import { savePrompt } from "./lib/prompts";
import { migrateGuestWorkToUser, guestState } from "./lib/guestState";
import { initializeDemoPrompts } from "./lib/demoPromptManager";
import { getAllDemoPrompts } from './lib/guestDemoContent';
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
  Save,
  Shield,
  LogOut,
  Plus,
  ChevronDown,
  Crown,
  UserCog,
  User,
  UserCheck,
  ArrowRight,
  ArrowUpRight,
  Trash2,
  Clock,
  Layers,
  Repeat,
  Puzzle,
  ShieldCheck,
  Play,
  FileDown,
  GitBranch,
  Lock,
  Bot,
  EyeOff,
  Database,
  RotateCcw,
  Eye
} from "lucide-react";

// Import Legal/Info Pages
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import About from "./pages/About";
import JoinTeam from "./pages/JoinTeam";
import GuestTeamView from "./pages/GuestTeamView";
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
// NAVIGATION COMPONENT
// ===================================
function Navigation({ onSignIn, isAuthenticated, onNavigate, user, isGuest, onExitGuestMode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrolled = useNavbarScroll();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <nav className={`modern-navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-content">
        <div 
          className="navbar-logo" 
          onClick={() => {
            if (isGuest) {
              onExitGuestMode();
            } else {
              onNavigate("/");
            }
          }}
          style={{ cursor: 'pointer' }}
        >
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

          {isGuest && (
            <button
              onClick={onSignIn}
              className="btn-premium"
              style={{ padding: '10px 20px' }}
            >
              <Zap size={16} />
              Sign up free
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

            {isGuest && (
              <button
                onClick={() => {
                  onSignIn();
                  setMobileMenuOpen(false);
                }}
                className="btn-premium w-full"
              >
                <Zap size={18} />
                Sign up free
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
// LANDING PAGE
// ===================================
function LandingPage({ onSignIn, onNavigate, onExploreApp, onExitGuestMode }) {
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
          isGuest={true}
          onExitGuestMode={() => onNavigate('/')}
        />

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-10 md:py-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="hero-badge mb-6 pulse-glow">
                <span className="font-medium">The GitHub for AI workflows</span>
              </div>

              <h1 className="hero-title text-4xl md:text-6xl lg:text-7xl mb-6 px-4">
                Build Better{" "}
                <span style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                Workflows </span>
                with Your Team{" "}
              </h1>

              <p className="hero-description text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed px-4"
                style={{ color: "var(--muted-foreground)" }}>
                Where teams build, test, and manage AI workflows
              </p>

              {/* CTA Buttons */}
              <div className="hero-cta flex flex-row gap-4 justify-center items-center mb-8 px-4 whitespace-nowrap">
                <button
                  onClick={onExploreApp}
                  className="btn-premium inline-flex items-center gap-2"
                >
                  <span>Try it now</span>
                  <ArrowRight size={20} className="btn-arrow" />
                </button>

                <button
                  onClick={() => onNavigate("/waitlist")}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <span>Waitlist | Feedback</span>
                  <ArrowUpRight size={20} className="btn-arrow" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm px-4"
                style={{ color: "var(--muted-foreground)" }}>
                <span className="text-center">
                  No signup required to explore • Save your work anytime
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
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
                title: "Team Collaboration",
                desc: "Work together seamlessly with live updates and team chat.",
              },
              {
                icon: <GitBranch size={24} />,
                title: "Workflow Versioning",
                desc: "Track changes and revert to previous versions effortlessly.",
              },
              {
                icon: <Database size={24} />,
                title: "Workflow Hub",
                desc: "Centralized storage for saving and reusing your best work.",
              },
              {
                icon: <EyeOff size={24} />,
                title: "Access Control",
                desc: "Granular permissions to control who sees what.",
              },
              {
                icon: <RotateCcw size={24} />,
                title: "Smart Reuse",
                desc: "Ensure originality with built-in similarity checks.",
              },
              {
                icon: <Save size={24} />,
                title: "Outcome Attachments",
                desc: "Save text, code, images and results alongside.",
              },
              {
                icon: <BarChart3 size={24} />,
                title: "Workflow Insights",
                desc: "Track usage patterns and optimize performance.",
              },
              {
                icon: <UserCheck size={24} />,
                title: "Team Workspaces",
                desc: "Owner, Admin, and Member roles with custom permissions.",
              },
              {
                icon: <FileDown size={24} />,
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
            <button className="btn-premium" onClick={onExploreApp}>
              Explore Features
              <ArrowRight size={20} className="btn-arrow" />
            </button>
          </div>
        </section>

        {/* Upcoming Features Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="section-header scroll-reveal">
            <div className="hero-badge mb-6 pulse-glow mx-auto">
              <Clock size={16} />
              <span className="font-medium">Coming Soon</span>
            </div>
            <h2 className="section-title">
              Upcoming Features
            </h2>
            <p className="section-subtitle">
              Exciting capabilities we're building to supercharge your workflow
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4 mb-8">
            {[
              {
                icon: <Layers size={20} />,
                title: "Multi-Model Testing",
                desc: "Test your ideas simultaneously across GPT-4, Claude, Gemini, and more. Compare outputs side-by-side to find the perfect model for your use case.",
                badge: "Q2 2025",
              },
              {
                icon: <Repeat size={20} />,
                title: "Reverse Prompt Testing",
                desc: "Input your desired output and let AI generate optimal prompts. Perfect for discovering new prompt strategies and improving existing workflows.",
                badge: "Q2 2025",
              },
              {
                icon: <Puzzle size={20} />,
                title: "IDE & Browser Extensions",
                desc: "Access your workflow directly in VS Code, Chrome, and Firefox. Seamlessly integrate AI into your daily development workflow.",
                badge: "Q3 2025",
              },
            ].map((feature, index) => (
              <div 
                key={index} 
                className="scroll-reveal"
                style={{ 
                  background: 'rgba(139, 92, 246, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.08)',
                  borderRadius: '16px',
                  padding: '1.5rem 2rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.08)';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '10px',
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}>
                  {feature.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ 
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: 'var(--foreground)',
                      margin: 0,
                    }}>
                      {feature.title}
                    </h3>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '6px',
                      fontSize: '0.688rem',
                      fontWeight: '600',
                      color: 'rgba(139, 92, 246, 0.9)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {feature.badge}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                    color: 'rgba(228, 228, 231, 0.6)',
                    margin: 0,
                  }}>
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center scroll-reveal">
            <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
              Want early access? Join our waitlist to be the first to try these features.
            </p>
            <button className="btn-premium" onClick={() => onNavigate("/waitlist")}>
              Join Waitlist
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
              <button onClick={onExploreApp} className="btn-premium">
                See How Teams Use Prism
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
  
  // ✅ FIX 2: Simplified useState initializer — token is already in sessionStorage
  // from setGuestAccess(). Don't re-store it (setGuestToken didn't exist anyway),
  // and don't clear the cache immediately after warming it.
  const [guestTeamId, setGuestTeamId] = useState(() => {
    const guestAccess = hasGuestAccess();
    if (guestAccess.hasAccess) {
      console.log('👁️ [APP INIT] Guest team access detected:', {
        teamId: guestAccess.teamId,
        hasAccess: guestAccess.hasAccess,
      });
      console.log('👁️ [APP INIT] Guest permissions loaded:', guestAccess.permissions);
      // Token is already in sessionStorage from setGuestAccess() — no action needed.
      // Leave the cache warm so subsequent reads within 1s don't hit sessionStorage again.
      return guestAccess.teamId;
    }
    return null;
  });
  
  const contextActiveTeam = useActiveTeam();
  
  // ✅ For guest users, manage activeTeam locally to prevent context resets
  const [guestActiveTeam, setGuestActiveTeam] = useState(guestTeamId);
  
  // Use guest activeTeam if in guest mode, otherwise use context
  const activeTeam = guestTeamId ? guestActiveTeam : contextActiveTeam.activeTeam;
  const setActiveTeam = guestTeamId 
    ? (teamId) => {
        console.log('👁️ [GUEST] Setting guest active team:', teamId);
        setGuestActiveTeam(teamId);
      }
    : contextActiveTeam.setActiveTeam;
  
  const inviteCardRef = useRef(null);
  const {
    isGuest,
    showSaveModal,
    isMigrating,
    triggerSaveModal,  
    handleSignupFromModal,
    handleContinueWithout,
    closeSaveModal,
    modalContext,
    getWorkSummary,
  } = useGuestMode();
  
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [teams, setTeams] = useState([]);
  const [role, setRole] = useState(null);
  const [avatars, setAvatars] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("prompts");
  const [teamStats, setTeamStats] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isExploringAsGuest, setIsExploringAsGuest] = useState(false);
  const [guestDemosInitialized, setGuestDemosInitialized] = useState(false);
  
  const [guestTeamPermissions, setGuestTeamPermissions] = useState(() => {
    const guestAccess = hasGuestAccess();
    if (guestAccess.hasAccess) {
      return guestAccess.permissions;
    }
    return null;
  });

  // ✅ Set active team when guest team data is ready
  const activeTeamRef = useRef(activeTeam);
  activeTeamRef.current = activeTeam;
  
  useEffect(() => {
    if (guestTeamId && teams.length > 0 && !activeTeamRef.current) {
      const guestTeam = teams.find(t => t.id === guestTeamId);
      if (guestTeam) {
        console.log('👁️ [ACTIVE TEAM] Setting active team for guest:', guestTeamId);
        setActiveTeam(guestTeamId);
        setActiveView('prompts');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestTeamId, teams.length]);

  // ✅ Track analytics when guest mode is active
  useEffect(() => {
    if (guestTeamId && window.gtag) {
      console.log('📊 [ANALYTICS] Tracking guest team mode active');
      window.gtag('event', 'guest_team_mode_active', {
        team_id: guestTeamId,
      });
    }
  }, [guestTeamId]);

  // Initialize demo prompts for guest users (non-team guests)
  useEffect(() => {
    if (isGuest && !guestTeamId && !guestDemosInitialized) {
      console.log('📝 [DEMOS] Initializing demo prompts for non-team guest');
      initializeDemoPrompts();
      setGuestDemosInitialized(true);
    }
  }, [isGuest, guestTeamId, guestDemosInitialized]);

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
    console.log('🔍 [TEAMS EFFECT] Running with:', {
      hasUser: !!user,
      guestTeamId,
      teamsLength: teams.length,
      willLoad: !user && guestTeamId && teams.length === 0
    });
    
    // ✅ Load guest team data for guest users
    if (!user && guestTeamId) {
      if (teams.length === 0) {
        console.log('👁️ [TEAMS] Loading guest team data:', guestTeamId);
        
        const fetchGuestTeam = async () => {
          try {
            const teamRef = doc(db, "teams", guestTeamId);
            const teamSnap = await getDoc(teamRef);
            
            if (teamSnap.exists()) {
              const teamData = { id: teamSnap.id, ...teamSnap.data() };
              console.log('✅ [TEAMS] Guest team loaded:', teamData.name);
              setTeams([teamData]);
              setLoading(false);
            } else {
              console.error('❌ [TEAMS] Guest team not found');
              setTeams([]);
              setLoading(false);
            }
          } catch (error) {
            console.error('❌ [TEAMS] Error loading guest team:', error);
            setTeams([]);
            setLoading(false);
          }
        };
        
        fetchGuestTeam();
      } else {
        console.log('👁️ [TEAMS] Guest team already loaded, keeping it');
      }
      return;
    }
    
    // Regular user without guest access
    if (!user) {
      console.log('📝 [TEAMS] No user and no guest team, clearing');
      setTeams([]);
      setActiveTeam(null);
      setLoading(false);
      return;
    }

    // Authenticated user - load their teams
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
  }, [user, guestTeamId, teams.length]);
  
  // Handle page exit/refresh for guests with unsaved work
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (isGuest && guestState.hasUnsavedWork()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved work. Are you sure you want to leave?';
        return e.returnValue;
      }
    }
    
    if (isGuest) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [isGuest]);

  // Set first team if no active team (only for authenticated users without guest team)
  useEffect(() => {
    if (!user || loading || isGuest || guestTeamId) return;

    if (teams.length > 0 && !activeTeam && activeView !== "favorites") {
      console.log('👥 [TEAMS] Setting first team as active:', teams[0].id);
      setActiveTeam(teams[0].id);
    }
  }, [teams.length, activeTeam, activeView, user, loading, setActiveTeam, isGuest, guestTeamId]);

  // Validate active team still exists (skip for guest users)
  useEffect(() => {
    if (guestTeamId) return;
    
    if (!user || loading || !activeTeam || teams.length === 0) return;

    const teamExists = teams.find((t) => t.id === activeTeam);
    if (!teamExists) {
      console.log('⚠️ [TEAMS] Active team no longer exists, clearing');
      setActiveTeam(null);
      if (activeView !== "favorites") {
        setActiveView("prompts");
      }
    }
  }, [teams, activeTeam, user, loading, setActiveTeam, activeView, guestTeamId]);

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

  // Load avatars
  useEffect(() => {
    async function loadAvatars() {
      const avatarResults = {};

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
              if (!guestTeamId) {
                console.error("Error loading avatar for", uid, error);
              }
            }
          }
        }
      }

      setAvatars(avatarResults);
    }

    if (teams.length > 0) loadAvatars();
  }, [teams]);

  // Real-time team stats with onSnapshot
  useEffect(() => {
    if (teams.length === 0) {
      setTeamStats({});
      return;
    }

    const unsubscribers = [];

    teams.forEach((team) => {
      const promptsRef = collection(db, "teams", team.id, "prompts");
      
      const unsub = onSnapshot(
        promptsRef,
        (snapshot) => {
          setTeamStats((prev) => ({
            ...prev,
            [team.id]: {
              memberCount: Object.keys(team.members || {}).length,
              promptCount: snapshot.size,
            },
          }));
        },
        (error) => {
          console.error(`Error loading stats for team ${team.id}:`, error);
          setTeamStats((prev) => ({
            ...prev,
            [team.id]: {
              memberCount: Object.keys(team.members || {}).length,
              promptCount: 0,
            },
          }));
        }
      );

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [teams]);

  // Check if user needs onboarding
  useEffect(() => {
    if (loading) return;
    
    // Guest onboarding
    if (isGuest && guestDemosInitialized && !hasCompletedOnboarding) {
      const guestOnboardingKey = 'guest_onboarding_completed';
      const completed = localStorage.getItem(guestOnboardingKey);
      
      if (!completed) {
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 800);
        
        return () => clearTimeout(timer);
      }
      return;
    }
    
    // Authenticated user onboarding
    if (!user || !teams.length) return;
    
    const onboardingKey = `onboarding_completed_${user.uid}`;
    const completed = localStorage.getItem(onboardingKey);
    
    if (!completed && teams.length === 1 && activeTeam && !hasCompletedOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [user, teams.length, loading, activeTeam, hasCompletedOnboarding, isGuest, guestDemosInitialized]);

  // Migrate guest work after successful signup
  useEffect(() => {
    if (user && !isGuest && teams.length > 0) {
      const migrateWork = async () => {
        try {
          const firstTeamId = teams[0].id;
          const result = await migrateGuestWorkToUser(user.uid, firstTeamId, savePrompt);
          
          if (result.success && result.migratedCount > 0) {
            console.log(`✅ Migrated ${result.migratedCount} items to your account`);
          }
        } catch (error) {
          console.error('❌ Error migrating guest work:', error);
        }
      };
      
      migrateWork();
    }
  }, [user, isGuest, teams]);

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
      if (window.gtag) {
        window.gtag('event', 'workspace_created', {
          workspace_name: name,
          user_id: user.uid,
        });
      }
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

  // Create example prompts for onboarding
  async function createExamplePrompts(examples) {
    if (!activeTeam || !user) return;
    
    for (const example of examples) {
      try {
        await savePrompt(
          user.uid,
          {
            title: example.title,
            text: example.text,
            tags: example.tags,
            visibility: example.visibility,
          },
          activeTeam
        );
      } catch (error) {
        console.error("Error creating example prompt:", error);
      }
    }
  }

  // Handle onboarding completion
  function handleOnboardingComplete() {
    if (isGuest) {
      localStorage.setItem('guest_onboarding_completed', 'true');
    } else if (user) {
      localStorage.setItem(`onboarding_completed_${user.uid}`, 'true');
    }
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
  }

  function handleOnboardingSkip() {
    if (isGuest) {
      localStorage.setItem('guest_onboarding_completed', 'true');
    } else if (user) {
      localStorage.setItem(`onboarding_completed_${user.uid}`, 'true');
    }
    setShowOnboarding(false);
  }

  // Scroll to invitation card from PromptList
  function scrollToInviteCard() {
    if (inviteCardRef.current) {
      inviteCardRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  // Handle "Explore App" from landing page
  function handleExploreApp() {
    setIsExploringAsGuest(true);
    window.history.pushState({ guestMode: true }, '', window.location.pathname);
    
    if (window.gtag) {
      window.gtag('event', 'guest_mode_entered', {
        source: 'landing_page_cta',
      });
    }
  }

  function handleExitGuestMode() {
    if (guestState.hasUnsavedWork()) {
      const confirmExit = window.confirm(
        'You have unsaved work. Sign up to save it permanently, or continue without saving?'
      );
      
      if (!confirmExit) {
        return;
      }
    }
    
    guestState.clearGuestWork();
    setIsExploringAsGuest(false);
    
    clearGuestAccessCache();
    
    if (window.gtag) {
      window.gtag('event', 'guest_mode_exited', {
        had_work: guestState.hasUnsavedWork(),
      });
    }
    
    navigate('/');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  // ✅ FIX 3 & 4: handleExitGuestTeam uses clearGuestAccess() instead of raw
  // sessionStorage.removeItem() calls. This clears both sessionStorage AND the
  // in-memory backup in guestTeamAccess.js, preventing stale token restoration.
  function handleExitGuestTeam() {
    console.log('🚪 [EXIT] Exiting guest team mode');
    
    // ✅ Single call clears sessionStorage + in-memory backup
    clearGuestAccess();
    
    setGuestTeamId(null);
    setGuestTeamPermissions(null);
    setActiveTeam(null);
    
    if (window.gtag) {
      window.gtag('event', 'guest_team_exited');
    }
    
    navigate('/');
    
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  const activeTeamObj = teams.find((t) => t.id === activeTeam);
  
  // Debug log for guest team state
  useEffect(() => {
    if (guestTeamId) {
      console.log('🔍 [DEBUG] Guest team state:', {
        guestTeamId,
        activeTeam,
        teamsLength: teams.length,
        activeTeamObj: activeTeamObj ? activeTeamObj.name : 'undefined',
        activeView,
      });
    }
  }, [guestTeamId, activeTeam, teams, activeTeamObj, activeView]);

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
    "/guest-team",
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
              isGuest={isGuest}
              onExitGuestMode={handleExitGuestMode}
            />
          )}
          <Router currentPath={currentPath.split("?")[0]}>
            <Route path="/contact"><Contact /></Route>
            <Route path="/privacy"><PrivacyPolicy /></Route>
            <Route path="/terms"><TermsOfUse /></Route>
            <Route path="/about"><About /></Route>
            <Route path="/join"><JoinTeam onNavigate={navigate} /></Route>
            <Route path="/guest-team"><GuestTeamView onNavigate={navigate} /></Route>
            <Route path="/waitlist"><Waitlist onNavigate={navigate} /></Route>
            <Route path="/admin"><AdminDashboard onNavigate={navigate} /></Route>
          </Router>
          {currentPath !== "/waitlist" && currentPath !== "/admin" && <Footer onNavigate={navigate} />}
        </div>
      </NavigationProvider>
    );
  }

  // Don't show loading for guest team users
  if (loading && !isGuest && !guestTeamId) {
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

  // Show landing page only if NOT in guest team mode
  if (!user && !isExploringAsGuest && !guestTeamId) {
    return (
      <LandingPage
        onSignIn={signInWithGoogle}
        onNavigate={navigate}
        onExploreApp={handleExploreApp}
        onExitGuestMode={handleExitGuestMode}
      />
    );
  }

  // Main application UI
  return (
    <div className="app-container flex min-h-screen relative">
      {/* Save Lock Modal */}
      <SaveLockModal
        isOpen={showSaveModal}
        onClose={closeSaveModal}
        onSignup={handleSignupFromModal}
        onContinueWithout={handleContinueWithout}
        workSummary={getWorkSummary()}
        modalContext={modalContext}
      />

      {/* Onboarding for authenticated users with team */}
      {showOnboarding && activeTeam && user && (
        <OnboardingExperience
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
          userName={user?.displayName}
          teamId={activeTeam}
          onCreateExamples={createExamplePrompts}
          isGuest={false}
        />
      )}

      {/* Onboarding for guest users */}
      {showOnboarding && isGuest && !user && (
        <OnboardingExperience
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
          userName="Guest"
          teamId={null}
          onCreateExamples={null}
          isGuest={true}
        />
      )}

      {/* Sidebar Overlay for Mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Static Sidebar */}
      <div className={`team-sidebar ${sidebarOpen ? "mobile-visible" : ""}`}>
        {/* Mobile Close Button */}
        <div className="sidebar-mobile-header">
          <h2>Menu</h2>
          <button onClick={() => setSidebarOpen(false)} className="action-btn-premium">
            <X size={20} />
          </button>
        </div>

        {/* Fixed Header Section */}
        <div className="sidebar-header-fixed">
          {/* User Profile Section (authenticated users) */}
          {user && (
            <>
              <div className="sidebar-user-section">
                <div className="user-info-header">
                  <div className="user-avatar-container">
                    <UserAvatar 
                      src={user.photoURL} 
                      name={user.displayName} 
                      email={user.email}
                      className="user-avatar"
                    />
                    <div className="user-status-dot"></div>
                  </div>
                  <div className="user-details">
                    <div className="user-name">
                      {user.displayName || user.email}
                    </div>
                    <div className="user-team-count">
                      {teams.length} {teams.length === 1 ? "team" : "teams"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sidebar-divider"></div>
            </>
          )}

          {/* Guest Mode Indicator (both types) */}
          {(isGuest || guestTeamId) && (
            <>
              <div className="sidebar-user-section">
                <div
                  style={{
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.15)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {guestTeamId ? <Eye size={16} style={{ color: 'var(--primary)' }} /> : <Sparkles size={16} style={{ color: 'var(--primary)' }} />}
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--foreground)' }}>
                      {guestTeamId ? 'Guest Team View • Read-Only' : 'Guest Mode • Changes are temporary'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(228, 228, 231, 0.6)', marginBottom: '0.75rem' }}>
                    {guestTeamId 
                      ? 'You can view, copy, comment, and rate prompts. Sign up to create your own.'
                      : 'Sign up to save your work and collaborate with teams.'
                    }
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={signInWithGoogle}
                      className="btn-premium"
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.813rem' }}
                    >
                      <Shield size={14} />
                      Sign up free
                    </button>
                    <button
                      onClick={guestTeamId ? handleExitGuestTeam : handleExitGuestMode}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.813rem' }}
                    >
                      Exit
                    </button>
                  </div>
                </div>
              </div>

              <div className="sidebar-divider"></div>
            </>
          )}

          {/* Quick Actions */}
          {user && (
            <>
              <button
                onClick={() => {
                  setActiveTeam(null);
                  setActiveView("favorites");
                  setIsChatOpen(false);
                  setSidebarOpen(false);
                }}
                className={`sidebar-menu-item ${activeView === "favorites" && !activeTeam ? "active" : ""}`}
              >
                <Star size={16} />
                <span>My Favorites</span>
              </button>

              {user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
                <button
                  onClick={() => {
                    navigate("/admin");
                    setSidebarOpen(false);
                  }}
                  className="sidebar-menu-item primary"
                >
                  <Shield size={16} />
                  <span>Admin Dashboard</span>
                </button>
              )}

              {activeTeamObj && (
                <button
                  onClick={() => {
                    setIsChatOpen(!isChatOpen);
                    setSidebarOpen(false);
                  }}
                  className={`sidebar-menu-item ${isChatOpen ? "active" : ""}`}
                >
                  <MessageSquare size={16} />
                  <span>Team Chat</span>
                </button>
              )}

              <div className="sidebar-divider"></div>
            </>
          )}
        </div>

        {/* Scrollable Content Section */}
        <div className="sidebar-content-scroll">
          {/* Teams Section (only for authenticated users) */}
          {user && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.875rem' }}>
                <h2 className="sidebar-section-title">Teams</h2>
                {teams.length > 0 && (
                  <span className="team-counter">
                    {teams.length}
                  </span>
                )}
              </div>

              {/* Teams List */}
              {teams.map((team) => {
                const isOwner = team.ownerId === user.uid;
                const myRole = team.members?.[user.uid];
                const ownerData = avatars[team.ownerId];
                const isActive = activeTeam === team.id;
                const stats = teamStats[team.id] || { memberCount: 0, promptCount: 0 };

                return (
                  <div key={team.id}>
                    <button
                      onClick={() => {
                        setActiveTeam(team.id);
                        setActiveView("prompts");
                        setSidebarOpen(false);
                      }}
                      className={`team-list-item ${isActive ? "active" : ""}`}
                    >
                      <UserAvatar
                        src={ownerData?.avatar}
                        name={ownerData?.name}
                        email={ownerData?.email}
                        className="team-avatar"
                      />
                      <div className="team-info">
                        <div className="team-name">{team.name}</div>
                        <div className="team-meta">
                          {myRole === "admin" && (
                            <span className="role-badge-inline">admin</span>
                          )}
                          {myRole === "owner" && (
                            <span className="role-badge-inline">owner</span>
                          )}
                          <span className="team-count-indicator">
                            <Users size={12} />
                            {stats.memberCount}
                          </span>
                          <span className="team-count-indicator">
                            <FileText size={12} />
                            {stats.promptCount}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isActive && (
                      <div className="team-details-expanded">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.688rem' }}>
                          <span className="owner-label">
                            Owner: {ownerData?.name || ownerData?.email || "Unknown"}
                          </span>
                          {isOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete team "${team.name}"? This cannot be undone.`)) {
                                  deleteTeam(team.id);
                                }
                              }}
                              className="action-btn-premium danger"
                              title="Delete team"
                              style={{ width: '24px', height: '24px' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {teams.length === 0 && (
                <div className="sidebar-empty-state">
                  <p>No teams yet</p>
                  <p className="text-xs">Create your first team below</p>
                </div>
              )}
            </>
          )}

          {/* Guest Mode Placeholder */}
          {(isGuest || guestTeamId) && !user && (
            <div className="sidebar-empty-state">
              {guestTeamId ? (
                <>
                  <Eye size={32} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
                  <p>Viewing team as guest</p>
                  <p className="text-xs">Sign up to unlock all features</p>
                </>
              ) : (
                <>
                  <Sparkles size={32} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
                  <p>Exploring as guest</p>
                  <p className="text-xs">Create a free account to unlock everything</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer Section */}
        <div className="sidebar-footer-fixed">
          {user && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = e.target.teamName.value.trim();
                  if (name) {
                    createTeam(name);
                    e.target.reset();
                  }
                }}
              >
                <input 
                  type="text" 
                  name="teamName" 
                  placeholder="New team name" 
                  className="new-team-input" 
                  required 
                />
                <button type="submit" className="create-team-btn">
                  <Plus size={16} />
                  Create Team
                </button>
              </form>

              <button onClick={logout} className="sign-out-btn">
                <LogOut size={16} />
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0" style={{ marginLeft: '260px' }}>
        {/* Mobile Header */}
        <div className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn">
            <Menu size={24} />
          </button>
          <div className="flex-1 min-w-0">
            {activeTeamObj ? (
              <h1 className="text-lg font-bold truncate" style={{ color: "var(--foreground)" }}>
                {activeTeamObj.name}
              </h1>
            ) : activeView === "favorites" && user ? (
              <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>My Favorites</h1>
            ) : isGuest ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Prism</h1>
                <span style={{ fontSize: '0.688rem', color: 'var(--muted-foreground)' }}>• Guest Mode</span>
              </div>
            ) : guestTeamId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  {activeTeamObj?.name || 'Team'}
                </h1>
                <span style={{ fontSize: '0.688rem', color: 'var(--muted-foreground)' }}>• Guest View</span>
              </div>
            ) : null}
          </div>
          {(isGuest || guestTeamId) && (
            <button
              onClick={guestTeamId ? handleExitGuestTeam : handleExitGuestMode}
              className="btn-secondary"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.813rem' }}
            >
              <X size={16} />
              Exit
            </button>
          )}
        </div>

        {/* Desktop Header */}
        {activeTeamObj ? (
          <TeamHeader 
            teamId={activeTeamObj.id}
            userRole={role}
            activeTab={activeView}
            onTabChange={setActiveView}
            isGuestMode={!!guestTeamId && !user}
            user={user}
          />
        ) : activeView === "favorites" && user ? (
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

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto" style={{ backgroundColor: "var(--background)" }}>
          {activeTeamObj && activeView === "prompts" && (
            <>
              <PromptList 
                activeTeam={activeTeamObj ? activeTeamObj.id : null}
                userRole={role} 
                isGuestMode={isGuest || !!guestTeamId}
                userId={user?.uid}
                onScrollToInvite={scrollToInviteCard}
              />
              {canManageMembers() && !guestTeamId && (
                <TeamInviteForm teamId={activeTeamObj.id} ref={inviteCardRef} teamName={activeTeamObj.name} role={role} />
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

          {/* Favorites view */}
          {activeView === "favorites" && !activeTeam && user && <FavoritesList />}

          {/* Guest Mode - Show demo prompts (only for non-team guests) */}
          {isGuest && !activeTeamObj && !guestTeamId && activeView !== "favorites" && (
            <PromptList 
              activeTeam={null}
              userRole={null}
              isGuestMode={true}
              userId={null}
            />
          )}

          {/* Authenticated user without team */}
          {!isGuest && !guestTeamId && !activeTeamObj && activeView !== "favorites" && (
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

        {user && <MyInvites />}
      </div>

      {/* Team Chat (hide for guest team users) */}
      {activeTeamObj && user && !guestTeamId && (
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
