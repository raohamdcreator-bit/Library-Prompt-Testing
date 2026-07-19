// src/App.jsx - FIXED: Proper guest team access initialization and redirect
import { useEffect, useState, useRef } from "react";
import { useCanonical } from "./hooks/useCanonical";
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
import {
  hasGuestAccess,
  setGuestAccess,
  clearGuestAccess,
  clearGuestAccessCache,
} from "./lib/guestTeamAccess";
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
import IntroVideoSection from "./components/IntroVideoSection";
import OnboardingExperience from "./components/OnboardingExperience";
import { savePrompt } from "./lib/prompts";
import { migrateGuestWorkToUser, guestState } from "./lib/guestState";
import { initializeDemoPrompts } from "./lib/demoPromptManager";
import { getAllDemoPrompts } from "./lib/guestDemoContent";
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
  MessageCircle,
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
  ArrowDown,
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
  Eye,
  Heart,
  Share2,
  TrendingUp,
  Flame,
  Handshake,
  FolderOpen,
  History,
  Video,
  Lightbulb,
  PenLine,
  RefreshCw,
  Upload,
  Award,
  Cloud,
  Folder,
  Image as ImageIcon,
  Globe,
} from "lucide-react";

// Import Legal/Info Pages
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import About from "./pages/About";
import JoinTeam from "./pages/JoinTeam";
import GuestTeamView from "./pages/GuestTeamView";
import Waitlist from "./pages/Waitlist";
import { NavigationProvider } from "./components/LegalLayout";
import { lazy, Suspense } from "react";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PlagiarismChecker = lazy(() => import("./components/PlagiarismChecker"));

// Admin email configuration
// src/config/admin.js
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// ===================================
// NAVBAR SCROLL EFFECT HOOK
// ===================================
function useNavbarScroll() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
// NAVIGATION COMPONENT (used on internal / legal pages)
// ===================================
function Navigation({
  onSignIn,
  isAuthenticated,
  onNavigate,
  user,
  isGuest,
  onExitGuestMode,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrolled = useNavbarScroll();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <nav className={`modern-navbar ${scrolled ? "scrolled" : ""}`}>
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
          style={{ cursor: "pointer" }}
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
          <button
            onClick={() => onNavigate("/contact")}
            className="navbar-link"
          >
            Contact
          </button>

          {isAdmin && (
            <button
              onClick={() => onNavigate("/admin")}
              className="btn-premium"
              style={{ padding: "10px 20px" }}
            >
              <Shield size={16} />
              Admin
              <ArrowRight size={16} className="btn-arrow" />
            </button>
          )}

          {!isAuthenticated && (
            <button
              onClick={onSignIn}
              className="btn-premium"
              style={{ padding: "10px 20px" }}
            >
              Sign up free
              <ArrowRight size={16} className="btn-arrow" />
            </button>
          )}
        </div>

        {/* Mobile Menu Button — hidden on large screens */}
        <button
          className="md:hidden mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{
            padding: "1rem 2rem 2rem",
            borderTop: "1px solid rgba(139, 92, 246, 0.1)",
            background: "rgba(10, 13, 20, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
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
// FOOTER COMPONENT (used on internal / legal pages)
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
          <p>© 2025 Prism. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

/* =========================================================================================
   LANDING PAGE DESIGN SYSTEM
   Ported from the reference Hero.tsx / Story.tsx / Pillars.tsx / Comparison.tsx /
   Showcase.tsx / Storytelling.tsx / CTA.tsx / primitives.tsx / charts.tsx / hooks.ts
   ========================================================================================= */

// ---- local hooks (from hooks.ts) ----------------------------------------------------------
function useMouseTrack() {
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    const onMove = (e) => {
      setPos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return pos;
}

function useInViewOnce(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(entry.target);
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCountUpValue(target, start, duration = 1800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);
  return value;
}

function useElementScrollProgress() {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const seen = vh - rect.top;
      setProgress(Math.max(0, Math.min(1, seen / total)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return { ref, progress };
}

// ---- primitives (from primitives.tsx) -----------------------------------------------------
function Reveal({ children, delay = 0, y = 24, className = "", once = true }) {
  const { ref, inView } = useInViewOnce(0.12);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (inView) setShown(true);
    else if (!once) setShown(false);
  }, [inView, once]);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: shown
          ? "translateY(0) scale(1)"
          : `translateY(${y}px) scale(0.98)`,
        opacity: shown ? 1 : 0,
        transition: `transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, opacity 0.9s ease ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

function MagneticButton({
  children,
  variant = "primary",
  className = "",
  onClick,
}) {
  const ref = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      setOffset({ x: x * 0.25, y: y * 0.25 });
    };
    const onLeave = () => setOffset({ x: 0, y: 0 });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const base =
    "relative inline-flex items-center gap-2 rounded-full font-medium transition-all duration-300 will-change-transform";
  const styles =
    variant === "primary"
      ? "bg-ink text-white px-7 py-3.5 shadow-float hover:shadow-float-lg"
      : "bg-white text-ink px-7 py-3.5 border border-line hover:border-ink-30";

  const purpleTheme2 = {
    bg: "linear-gradient(135deg, #1b0a33 0%, #3b1368 100%)",
    border: "rgba(167, 139, 250, 0.35)",
    iconBg: "rgba(167, 139, 250, 0.18)",
    iconBorder: "rgba(167, 139, 250, 0.35)",
    iconColor: "#ddd6fe",
    bgIconColor: "#c4b5fd",
    titleColor: "#f5f3ff",
    descColor: "rgba(221, 214, 254, 0.58)",
    hoverBorder: "rgba(167, 139, 250, 0.65)",
    hoverShadow: "rgba(167, 139, 250, 0.18)",
  };

  const purpleTheme3 = {
    bg: "linear-gradient(135deg, #0f0820 0%, #24124a 100%)",
    border: "rgba(124, 58, 237, 0.35)",
    iconBg: "rgba(124, 58, 237, 0.18)",
    iconBorder: "rgba(124, 58, 237, 0.35)",
    iconColor: "#c4b5fd",
    bgIconColor: "#8b5cf6",
    titleColor: "#ede9fe",
    descColor: "rgba(196, 181, 253, 0.58)",
    hoverBorder: "rgba(124, 58, 237, 0.65)",
    hoverShadow: "rgba(124, 58, 237, 0.18)",
  };

  const themes = [purpleTheme1, purpleTheme2, purpleTheme3];
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-muted backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulse" />
      {children}
    </div>
  );
}

// ---- charts (from charts.tsx) --------------------------------------------------------------
function Counter({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  className = "",
  start,
}) {
  const { ref, inView } = useInViewOnce(0.4);
  const trigger = start === undefined ? inView : inView && start;
  const v = useCountUpValue(value, trigger, 2000);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

function LineChart({
  points,
  width = 240,
  height = 80,
  className = "",
  stroke = "#0a0a0b",
  fill = true,
}) {
  const { ref, inView } = useInViewOnce(0.3);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1800);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: i * step,
    y: height - ((p - min) / range) * (height - 8) - 4,
  }));
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`)
    .join(" ");
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <div ref={ref} className={className}>
      <svg width={width} height={height} className="overflow-visible">
        {fill && (
          <path
            d={fillPath}
            fill={stroke}
            opacity={0.06 * progress}
            style={{ transition: "opacity 0.3s" }}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - progress}
        />
        <circle
          cx={last.x}
          cy={last.y}
          r={3.5}
          fill={stroke}
          opacity={progress}
          style={{ transition: "opacity 0.3s" }}
        />
        <circle
          cx={last.x}
          cy={last.y}
          r={7}
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          opacity={progress * 0.3}
        />
      </svg>
    </div>
  );
}

function BarChart({ data, height = 120, className = "" }) {
  const { ref, inView } = useInViewOnce(0.3);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1400);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  const max = Math.max(...data.map((d) => d.value));
  return (
    <div
      ref={ref}
      className={`flex items-end gap-2 ${className}`}
      style={{ height }}
    >
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-ink"
              style={{
                height: `${(d.value / max) * 100 * progress}%`,
                transition: "height 0.1s linear",
                opacity: 0.7 + (i / data.length) * 0.3,
              }}
            />
          </div>
          <span className="text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments, size = 120, className = "" }) {
  const { ref, inView } = useInViewOnce(0.3);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1500);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = size / 2 - 12;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div ref={ref} className={className}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e8e8eb"
          strokeWidth={8}
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ * progress;
          const dash = `${len} ${circ}`;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={i === 0 ? "#0a0a0b" : i === 1 ? "#5a5a5e" : "#a8a8ad"}
              strokeWidth={8}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += (s.value / total) * circ;
          return el;
        })}
      </svg>
    </div>
  );
}

function Heatmap({ rows = 5, cols = 12, className = "" }) {
  const { ref, inView } = useInViewOnce(0.2);
  const cells = useRef(
    Array.from({ length: rows * cols }, () => Math.random()),
  ).current;
  return (
    <div
      ref={ref}
      className={`grid gap-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-sm"
          style={{
            background: `rgba(10,10,11,${inView ? v * 0.9 : 0})`,
            transition: `background 0.6s ease ${(i / cells.length) * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---- one-time stylesheet providing the ink/paper/fog/line/muted design tokens -------------
function LandingStyles() {
  return (
    <style>{`
      .prism-landing { background:#ffffff; color:#0a0a0b; overflow-x:hidden; }
      .prism-landing .bg-ink{background-color:#0a0a0b}
      .prism-landing .text-ink{color:#0a0a0b}
      .prism-landing .border-ink{border-color:#0a0a0b}
      .prism-landing .border-ink-30{border-color:rgba(10,10,11,0.3)}
      .prism-landing .fill-ink{fill:#0a0a0b}
      .prism-landing .bg-paper{background-color:#ffffff}
      .prism-landing .bg-fog{background-color:#f5f5f7}
      .prism-landing .border-line{border-color:#e8e8eb}
      .prism-landing .bg-line{background-color:#e8e8eb}
      .prism-landing .text-muted{color:#86868b}
      .prism-landing .bg-muted{background-color:#86868b}
      .prism-landing .from-ink{--tw-gradient-from:#0a0a0b; --tw-gradient-to: rgba(10,10,11,0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);}
      .prism-landing .to-muted{--tw-gradient-to:#86868b}
      .prism-landing .grayscale{filter:grayscale(1)}
      .prism-landing .font-serif{font-family:"Instrument Serif", Georgia, serif}
      .prism-landing .tracking-tightest{letter-spacing:-0.04em}
      .prism-landing .text-balance{text-wrap:balance}
      .prism-landing .text-pretty{text-wrap:pretty}
      .prism-landing .perspective{perspective:2000px}
      .prism-landing .shadow-float{
        box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06),0 24px 64px rgba(0,0,0,0.08);
      }
      .prism-landing .shadow-float-lg{
        box-shadow:0 2px 4px rgba(0,0,0,0.05),0 16px 40px rgba(0,0,0,0.08),0 40px 96px rgba(0,0,0,0.1);
      }
      .prism-landing .glass{
        background:rgba(255,255,255,0.6);
        backdrop-filter:blur(20px) saturate(180%);
        -webkit-backdrop-filter:blur(20px) saturate(180%);
        border:1px solid rgba(0,0,0,0.06);
      }
      .prism-landing .grid-bg{
        background-image:linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
        background-size:64px 64px;
      }
      .prism-landing .dot-bg{
        background-image:radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px);
        background-size:24px 24px;
      }
      .prism-landing .mask-fade-b{
        -webkit-mask-image:linear-gradient(to bottom, black 60%, transparent 100%);
        mask-image:linear-gradient(to bottom, black 60%, transparent 100%);
      }
      @keyframes prismFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
      .prism-landing .animate-prism-float{ animation: prismFloat 6s ease-in-out infinite; }
    `}</style>
  );
}

// ---- Nav (from Hero.tsx) -------------------------------------------------------------------
function LandingNav({ onSignIn, onExploreApp }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${scrolled ? "py-3" : "py-5"}`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 transition-all duration-500 ${
          scrolled ? "glass shadow-float py-2.5" : "bg-transparent py-3"
        }`}
        style={{ width: scrolled ? "min(960px, 92%)" : "min(1100px, 92%)" }}
      >
        <a href="#" className="flex items-center gap-2">
          <div className="relative h-7 w-7">
            <div className="absolute inset-0 rotate-45 rounded-[6px] bg-ink" />
            <div className="absolute inset-[5px] rotate-45 rounded-[3px] bg-white" />
            <div className="absolute inset-[9px] rotate-45 rounded-[1px] bg-ink" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Prism</span>
        </a>
        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#features" className="transition hover:text-ink">
            Features
          </a>
          <a href="#comparison" className="transition hover:text-ink">
            Why Prism
          </a>
          <a href="#community" className="transition hover:text-ink">
            Community
          </a>
          <a href="#analytics" className="transition hover:text-ink">
            Analytics
          </a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSignIn}
            className="hidden text-sm text-muted transition hover:text-ink sm:block"
          >
            Sign in
          </button>
          <MagneticButton className="text-sm" onClick={onExploreApp}>
            Start Creating <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        </div>
      </div>
    </nav>
  );
}

// ---- Hero (from Hero.tsx) ------------------------------------------------------------------
function LandingHeroWorkspace() {
  const mouse = useMouseTrack();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const float = (depth) => {
    const tx = (mouse.x - 0.5) * depth;
    const ty = (mouse.y - 0.5) * depth;
    return `translate3d(${tx}px, ${ty}px, 0)`;
  };

  return (
    <div className="perspective relative mx-auto h-[560px] w-full max-w-5xl">
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.06),transparent_70%)] blur-2xl" />

      <svg
        className="absolute inset-0 h-full w-full"
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 1s" }}
      >
        <defs>
          <linearGradient id="prismLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a0a0b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0a0a0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1="30%"
          y1="35%"
          x2="55%"
          y2="25%"
          stroke="url(#prismLine)"
          strokeWidth="1"
          strokeDasharray="4 4"
          className="animate-pulse"
        />
        <line
          x1="55%"
          y1="25%"
          x2="75%"
          y2="40%"
          stroke="url(#prismLine)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="30%"
          y1="35%"
          x2="25%"
          y2="65%"
          stroke="url(#prismLine)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="75%"
          y1="40%"
          x2="70%"
          y2="70%"
          stroke="url(#prismLine)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="25%"
          y1="65%"
          x2="55%"
          y2="80%"
          stroke="url(#prismLine)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="70%"
          y1="70%"
          x2="55%"
          y2="80%"
          stroke="url(#prismLine)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Creator Profile card */}
      <div
        className="absolute left-1/2 top-[8%] z-30 w-[200px] -translate-x-1/2"
        style={{
          transform: `${float(-20)} translateZ(40px)`,
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          opacity: mounted ? 1 : 0,
          animation: "prismFloat 7s ease-in-out infinite",
        }}
      >
        <div className="glass shadow-float-lg rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-ink to-muted">
              <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
                AK
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Ava Kessler</div>
              <div className="text-[11px] text-muted">AI Motion Designer</div>
            </div>
          </div>
          <div className="mt-3 flex justify-between text-center">
            <div>
              <div className="text-base font-bold">
                <Counter value={12400} suffix="K" />
              </div>
              <div className="text-[9px] uppercase tracking-wide text-muted">
                Followers
              </div>
            </div>
            <div>
              <div className="text-base font-bold">
                <Counter value={2.4} decimals={1} suffix="M" />
              </div>
              <div className="text-[9px] uppercase tracking-wide text-muted">
                Views
              </div>
            </div>
            <div>
              <div className="text-base font-bold">
                <Counter value={89} />
              </div>
              <div className="text-[9px] uppercase tracking-wide text-muted">
                Projects
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project card */}
      <div
        className="absolute left-[2%] top-[28%] z-20 w-[230px]"
        style={{
          transform: `${float(-35)} translateZ(20px)`,
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          opacity: mounted ? 1 : 0,
          animation: "prismFloat 8s ease-in-out infinite 0.5s",
        }}
      >
        <div className="glass shadow-float-lg overflow-hidden rounded-2xl">
          <div className="relative h-28 bg-gradient-to-br from-ink to-muted">
            <div className="absolute inset-0 dot-bg opacity-20" />
            <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> 48.2K
              </span>
            </div>
            <div className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-white">
              Featured
            </div>
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold">Neon Cartography</div>
            <div className="mt-1 text-[11px] text-muted">Motion · AI Video</div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" /> 1.2K
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> 84
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics card */}
      <div
        className="absolute right-[2%] top-[24%] z-20 w-[210px]"
        style={{
          transform: `${float(-35)} translateZ(30px)`,
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          opacity: mounted ? 1 : 0,
          animation: "prismFloat 7.5s ease-in-out infinite 1s",
        }}
      >
        <div className="glass shadow-float-lg rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Growth
            </div>
            <TrendingUp className="h-4 w-4 text-ink" />
          </div>
          <div className="mt-1 text-2xl font-bold">
            <Counter value={312} suffix="%" />
          </div>
          <div className="text-[11px] text-muted">Audience growth · 90d</div>
          <div className="mt-2">
            <LineChart
              points={[8, 12, 10, 18, 22, 19, 28, 35, 42, 48, 55, 62]}
              width={178}
              height={50}
            />
          </div>
        </div>
      </div>

      {/* Prompt editor */}
      <div
        className="absolute left-[8%] bottom-[6%] z-20 w-[240px]"
        style={{
          transform: `${float(-25)} translateZ(15px)`,
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          opacity: mounted ? 1 : 0,
          animation: "prismFloat 9s ease-in-out infinite 1.5s",
        }}
      >
        <div className="glass shadow-float-lg rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-ink/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-ink/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-ink/20" />
            </div>
            <span className="ml-1 text-[11px] font-medium text-muted">
              prompt.prism
            </span>
          </div>
          <div className="mt-3 space-y-1.5 font-mono text-[10px] leading-relaxed">
            <div className="text-muted"># Cinematic establishing shot</div>
            <div className="text-ink">wide angle, volumetric fog,</div>
            <div className="text-ink">golden hour rim light,</div>
            <div className="text-ink">35mm film grain, anamorphic</div>
            <div className="inline-block animate-pulse rounded bg-ink/10 px-1">
              |
            </div>
          </div>
        </div>
      </div>

      {/* Community / comments */}
      <div
        className="absolute right-[6%] bottom-[8%] z-20 w-[210px]"
        style={{
          transform: `${float(-25)} translateZ(25px)`,
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          opacity: mounted ? 1 : 0,
          animation: "prismFloat 8.5s ease-in-out infinite 0.8s",
        }}
      >
        <div className="glass shadow-float-lg rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Users className="h-4 w-4" /> Community
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 shrink-0 rounded-full bg-ink/80" />
              <div>
                <div className="text-[11px] font-medium">"This is unreal."</div>
                <div className="text-[10px] text-muted">@miyazaki · 2h</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 shrink-0 rounded-full bg-muted" />
              <div>
                <div className="text-[11px] font-medium">
                  Want to collab on a series?
                </div>
                <div className="text-[10px] text-muted">@studio.noir · 5h</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI image thumbnail */}
      <div
        className="absolute left-1/2 bottom-[2%] z-10 w-[150px] -translate-x-1/2"
        style={{
          transform: `${float(-15)} translateZ(10px)`,
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          opacity: mounted ? 1 : 0,
          animation: "prismFloat 6.5s ease-in-out infinite 0.3s",
        }}
      >
        <div className="glass shadow-float rounded-xl p-2">
          <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-md bg-gradient-to-br from-ink/80 to-muted"
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted">
            <Plus className="h-3 w-3" /> 4 outputs
          </div>
        </div>
      </div>

      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-ink/30"
          style={{
            left: `${15 + i * 14}%`,
            top: `${20 + (i % 3) * 25}%`,
            animation: `prismFloat ${5 + i}s ease-in-out infinite ${i * 0.4}s`,
            opacity: mounted ? 1 : 0,
            transition: "opacity 1s",
          }}
        />
      ))}
    </div>
  );
}

function LandingHero({ onExploreApp, onNavigate }) {
  return (
    <section className="relative overflow-hidden pt-36 pb-20">
      <div className="absolute inset-0 grid-bg mask-fade-b opacity-60" />
      <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,0,0,0.04),transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <Reveal>
          <SectionLabel>Prism · AI Creator Workspace</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tightest text-balance sm:text-7xl md:text-8xl">
            Show Your Work.
            <br />
            <span className="font-serif italic font-normal">
              Grow Your Audience.
            </span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-pretty text-muted">
            Create, organize, showcase and grow your creative work from one
            intelligent workspace.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex items-center justify-center gap-4">
            <MagneticButton onClick={onExploreApp}>
              Start Creating
            </MagneticButton>
            <MagneticButton
              variant="ghost"
              onClick={() => onNavigate("/waitlist")}
            >
              {/* <Play className="h-4 w-4" /> Watch Demo */}
              Waitlist | Feedback <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </div>
        </Reveal>
      </div>

      <Reveal delay={400} y={60}>
        <div className="relative mt-16">
          <LandingHeroWorkspace />
        </div>
      </Reveal>

      <div className="mx-auto mt-12 max-w-6xl px-6">
        <Reveal delay={200}>
          <div className="flex items-center justify-center gap-2 text-sm text-muted">
            <Sparkles className="h-4 w-4" />
            <span>Trusted by creators building with AI</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Trust / Problem / Solution (from Story.tsx) -------------------------------------------
const prismAvatars = [
  "AK",
  "MR",
  "JL",
  "SN",
  "DK",
  "YT",
  "PV",
  "LC",
  "BH",
  "NW",
  "EC",
  "RT",
];
const prismRoles = [
  "AI Artist",
  "Video Editor",
  "Designer",
  "Creative Agency",
  "Marketing Team",
  "Content Creator",
];

function LandingTrust() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-sm uppercase tracking-widest text-muted">
            Trusted by creators building with AI
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {prismAvatars.map((a, i) => (
              <div
                key={i}
                className="group relative h-14 w-14 overflow-hidden rounded-full border border-line bg-white shadow-float transition-all duration-500 hover:scale-110 hover:shadow-float-lg"
                style={{ transform: `translateY(${i % 2 === 0 ? -4 : 4}px)` }}
              >
                <div
                  className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, hsl(0,0%,${10 + i * 4}%), hsl(0,0%,${30 + i * 4}%))`,
                  }}
                >
                  {a}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={200}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
            {prismRoles.map((r) => (
              <span key={r} className="inline-flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-ink" />
                {r}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const prismScattered = [
  { icon: MessageSquare, label: "ChatGPT", x: "8%", y: "10%" },
  { icon: Sparkles, label: "Claude", x: "78%", y: "8%" },
  { icon: GitBranch, label: "Cursor", x: "88%", y: "40%" },
  { icon: Cloud, label: "Google Drive", x: "4%", y: "45%" },
  { icon: Video, label: "CapCut", x: "70%", y: "72%" },
  { icon: Video, label: "Premiere", x: "18%", y: "78%" },
  { icon: MessageSquare, label: "Discord", x: "45%", y: "85%" },
  { icon: FileText, label: "Notion", x: "40%", y: "12%" },
  { icon: Folder, label: "Folders", x: "55%", y: "45%" },
  { icon: ImageIcon, label: "References", x: "25%", y: "35%" },
  { icon: FileText, label: "Prompt Notes", x: "62%", y: "28%" },
  { icon: ImageIcon, label: "Generated Images", x: "30%", y: "60%" },
];

function LandingProblem() {
  const { ref, progress } = useElementScrollProgress();
  return (
    <section ref={ref} className="relative overflow-hidden py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>The Problem</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Your creative work is{" "}
            <span className="font-serif italic">everywhere.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Prompts in one app. Outputs in another. Notes scattered across
            folders. Nothing connects. Nothing compounds.
          </p>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-20 h-[440px] max-w-5xl px-6">
        <svg className="absolute inset-0 h-full w-full">
          <g
            stroke="purple"
            strokeWidth="1"
            strokeDasharray="6 8"
            opacity={0.85}
          >
            <path
              d="M 120 80 Q 200 120 180 200"
              fill="none"
              className="animate-pulse"
            />
            <path d="M 700 70 Q 600 140 620 220" fill="none" />
            <path d="M 300 70 Q 600 140 620 220" fill="none" />
            <path d="M 900 200 Q 300 410 120 220" fill="none" />
            <path d="M 400 100 Q 350 200 300 280" fill="none" />
            <path
              d="M 780 350 Q 650 300 580 320"
              fill="none"
              className="animate-pulse"
            />
            <path d="M 100 380 Q 250 320 320 360" fill="none" />
          </g>
        </svg>
        {prismScattered.map((s, i) => {
          const Icon = s.icon;
          const drift = Math.sin(progress * Math.PI * 2 + i) * 8;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: s.x,
                top: s.y,
                transform: `translate(${drift}px, ${drift * 0.5}px)`,
                transition: "transform 0.3s",
                opacity: progress > 0.1 ? 1 : 0.3,
              }}
            >
              <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-float grayscale">
                <Icon className="h-4 w-4 text-muted" />
                <span className="text-xs font-medium text-muted">
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LandingSolution() {
  const { ref, progress } = useElementScrollProgress();
  const center = [
    { icon: Folder, label: "Projects" },
    { icon: ImageIcon, label: "Assets" },
    { icon: Video, label: "Videos" },
    { icon: MessageSquare, label: "Community" },
    { icon: Eye, label: "Analytics" },
    { icon: FileText, label: "Portfolio" },
  ];
  return (
    <section ref={ref} className="relative overflow-hidden bg-fog py-32">
      <div className="absolute inset-0 dot-bg opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>The Solution</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Bring your entire creative workflow{" "}
            <span className="font-serif italic">together.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Every disconnected item becomes part of one connected workspace.
            Projects. Assets. Videos. Community. Analytics. Portfolio.
            Everything connected.
          </p>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-20 h-[440px] max-w-4xl">
        <svg className="absolute inset-0 h-full w-full">
          {[
            [80, 60, 400, 220],
            [720, 60, 400, 220],
            [80, 380, 400, 220],
            [720, 380, 400, 220],
            [400, 40, 400, 220],
            [400, 400, 400, 220],
          ].map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#0a0a0b"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity={progress * 0.4}
              style={{ transition: "opacity 0.3s" }}
            />
          ))}
        </svg>

        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            transform: `translate(-50%,-50%) scale(${0.8 + progress * 0.4})`,
            transition: "transform 0.3s",
          }}
        >
          <div className="relative h-32 w-32">
            <div className="absolute inset-0 rotate-45 rounded-3xl bg-ink shadow-float-lg" />
            <div className="absolute inset-3 rotate-45 rounded-2xl bg-white" />
            <div className="absolute inset-6 rotate-45 rounded-xl bg-ink" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">PRISM</span>
            </div>
          </div>
        </div>

        {center.map((c, i) => {
          const angle = (i / center.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 160 + Math.sin(progress * Math.PI) * 20;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${progress * 0.5 + 0.5})`,
                opacity: progress,
                transition: "transform 0.3s, opacity 0.3s",
              }}
            >
              <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-float">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{c.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Reveal delay={200}>
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-sm text-muted">
          <ArrowRight className="h-4 w-4" />
          One connected workspace
        </div>
      </Reveal>
    </section>
  );
}

// ---- Pillars / FeatureGrid (from Pillars.tsx) -----------------------------------------------
const prismPillars = [
  {
    n: "01",
    icon: FolderOpen,
    title: "Create",
    desc: "Store prompts, projects, reference images, generated outputs, videos, assets, version history and prompt iterations. Multi-model testing and AI workflows.",
    value: "Everything needed to create lives together.",
    chart: (
      <BarChart
        data={[
          { label: "M", value: 30 },
          { label: "T", value: 45 },
          { label: "W", value: 38 },
          { label: "T", value: 60 },
          { label: "F", value: 72 },
          { label: "S", value: 55 },
          { label: "S", value: 80 },
        ]}
        height={80}
      />
    ),
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Showcase",
    desc: "Creator Profile, Portfolio, Featured Work, Public Projects, Collections, Case Studies and shareable pages.",
    value: "Don't just store your work. Show the world.",
    chart: (
      <LineChart
        points={[5, 8, 6, 12, 18, 15, 22, 28, 35, 40]}
        width={200}
        height={70}
      />
    ),
  },
  {
    n: "03",
    icon: Users,
    title: "Community",
    desc: "Follow creators, likes, comments, discussions, collaborations and creator discovery.",
    value: "Your work becomes discoverable.",
    chart: (
      <DonutChart
        segments={[
          { label: "Followers", value: 60 },
          { label: "Engaged", value: 25 },
          { label: "New", value: 15 },
        ]}
        size={100}
      />
    ),
  },
  {
    n: "04",
    icon: BarChart3,
    title: "Insights",
    desc: "Views, followers, engagement, project performance, audience growth, trending projects, top performing work, traffic sources and returning visitors.",
    value: "Know what resonates.",
    chart: (
      <LineChart
        points={[10, 14, 12, 20, 26, 30, 38, 45, 52, 60, 68, 75]}
        width={200}
        height={70}
      />
    ),
  },
  {
    n: "05",
    icon: Handshake,
    title: "Collaborate",
    desc: "Shared workspaces, teams, comments, reviews, permissions and real-time collaboration.",
    value: "Create together.",
    chart: (
      <BarChart
        data={[
          { label: "You", value: 40 },
          { label: "Team", value: 65 },
          { label: "Clients", value: 30 },
          { label: "Reviewers", value: 50 },
        ]}
        height={80}
      />
    ),
  },
];

function LandingPillars() {
  return (
    <section id="features" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Core Pillars</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Five pillars.{" "}
            <span className="font-serif italic">One workspace.</span>
          </h2>
        </Reveal>
      </div>

      <div className="mx-auto mt-20 max-w-6xl space-y-6 px-6">
        {prismPillars.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal key={p.n} delay={i * 80}>
              <div className="group relative grid grid-cols-1 gap-6 rounded-3xl border border-line bg-white p-8 shadow-float transition-all duration-500 hover:shadow-float-lg md:grid-cols-[1fr_1.2fr_1fr] md:p-12">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-5xl italic text-muted">
                      {p.n}
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {p.desc}
                  </p>
                </div>
                <div className="flex items-center justify-center rounded-2xl bg-fog p-6">
                  {p.chart}
                </div>
                <div className="flex flex-col justify-center">
                  <div className="border-l-2 border-ink pl-4">
                    <p className="font-serif text-xl italic leading-snug">
                      {p.value}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

const prismFeatures = [
  {
    icon: FolderOpen,
    label: "Project Workspace",
    span: "md:col-span-2 md:row-span-2",
    big: true,
  },
  { icon: GitBranch, label: "Prompt Engineering", span: "" },
  { icon: Layers, label: "Content Management", span: "" },
  { icon: ImageIcon, label: "Generated Outputs", span: "" },
  { icon: FolderOpen, label: "Reference Assets", span: "" },
  { icon: Video, label: "Video Management", span: "md:col-span-2" },
  { icon: Sparkles, label: "Creator Portfolio", span: "" },
  { icon: Users, label: "Community", span: "" },
  { icon: BarChart3, label: "Analytics Dashboard", span: "" },
  { icon: Eye, label: "Audience Insights", span: "" },
  { icon: Star, label: "Creator Profile", span: "" },
  { icon: Handshake, label: "Collaboration", span: "" },
  { icon: Search, label: "Search", span: "" },
  { icon: Shield, label: "Privacy Controls", span: "" },
  { icon: FileText, label: "Templates", span: "" },
  { icon: Clock, label: "Execution History", span: "" },
  { icon: History, label: "Version History", span: "" },
];

function LandingFeatureGrid() {
  return (
    <section className="relative bg-fog py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Feature Grid</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Every tool. <span className="font-serif italic">In one place.</span>
          </h2>
        </Reveal>
      </div>

      <div className="mx-auto mt-16 max-w-6xl px-6">
        <div className="grid auto-rows-[140px] grid-cols-2 gap-4 md:grid-cols-4">
          {prismFeatures.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.label} delay={(i % 4) * 60} className={f.span}>
                <div
                  className={`group relative h-full overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-float transition-all duration-500 hover:-translate-y-1 hover:shadow-float-lg ${
                    f.big ? "flex flex-col justify-between" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white transition-all duration-500 group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className={f.big ? "mt-auto" : "mt-4"}>
                    <h3
                      className={`font-semibold tracking-tight ${f.big ? "text-2xl" : "text-sm"}`}
                    >
                      {f.label}
                    </h3>
                    {f.big && (
                      <>
                        <p className="mt-2 max-w-xs text-sm text-muted">
                          The home base for every creation — prompts, assets,
                          outputs, versions and analytics, all linked.
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {["A", "B", "C"].map((x) => (
                              <div
                                key={x}
                                className="h-7 w-7 rounded-full border-2 border-white bg-gradient-to-br from-ink to-muted"
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted">
                            12 collaborators
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {f.big && (
                    <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.05),transparent)]" />
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---- Comparison (from Comparison.tsx) --------------------------------------------------------
function TraditionalCard() {
  return (
    <div className="grayscale">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-float">
        <div className="h-40 bg-gradient-to-br from-muted to-fog" />
        <div className="p-5">
          <div className="text-base font-semibold text-muted">
            Untitled Project
          </div>
          <div className="mt-1 text-xs text-muted">
            A still image. A title. A description. Done.
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <span>2024</span>
            <span>·</span>
            <span>Portfolio</span>
          </div>
        </div>
      </div>
      <div className="mt-6 text-center">
        <p className="font-serif text-lg italic text-muted">
          Shows what you created.
        </p>
      </div>
      <div className="mt-6 space-y-2 opacity-40">
        <div className="h-2 rounded bg-muted/30" />
        <div className="h-2 w-2/3 rounded bg-muted/30" />
        <div className="h-2 w-1/2 rounded bg-muted/30" />
      </div>
    </div>
  );
}

function PrismCard({ progress }) {
  const stage = (t) => Math.max(0, Math.min(1, (progress - t) / 0.12));
  const s1 = stage(0.05);
  const s2 = stage(0.18);
  const s3 = stage(0.32);
  const s4 = stage(0.45);
  const s5 = stage(0.58);
  const s6 = stage(0.72);
  const s7 = stage(0.85);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-float-lg transition-all duration-500">
        <div className="relative h-40 bg-gradient-to-br from-ink to-muted">
          <div className="absolute inset-0 dot-bg opacity-20" />
          <div
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold"
            style={{
              opacity: s1,
              transform: `translateY(${(1 - s1) * -10}px)`,
              transition: "all 0.4s",
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            <Counter value={48213} start={s1 > 0.1} />
          </div>
          <div
            className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-white"
            style={{ opacity: s1 }}
          >
            Featured
          </div>
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold"
            style={{
              opacity: s7,
              transform: `scale(${0.5 + s7 * 0.5})`,
              transition: "all 0.5s",
            }}
          >
            <Flame className="h-3.5 w-3.5" /> Trending #3
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Neon Cartography</div>
              <div className="mt-0.5 text-xs text-muted">
                Motion · AI Video · 4K
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-ink" />
              <span className="text-sm font-semibold">
                <Counter value={4.9} decimals={1} start={s2 > 0.1} />
              </span>
            </div>
          </div>

          <div
            className="mt-4 flex items-center gap-2 rounded-xl bg-fog p-3"
            style={{
              opacity: s2,
              transform: `translateY(${(1 - s2) * 10}px)`,
              transition: "all 0.5s",
            }}
          >
            <Users className="h-4 w-4" />
            <span className="text-xs text-muted">Followers</span>
            <span className="ml-auto text-lg font-bold">
              <Counter value={12400} start={s2 > 0.1} />
            </span>
            <span className="text-xs font-semibold text-ink">
              +<Counter value={312} start={s2 > 0.1} suffix="%" />
            </span>
          </div>

          <div
            className="mt-3 rounded-xl border border-line p-3"
            style={{
              opacity: s3,
              transform: `scale(${0.95 + s3 * 0.05})`,
              transition: "all 0.5s",
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Engagement</span>
              <span className="inline-flex items-center gap-1 text-muted">
                <TrendingUp className="h-3 w-3" /> 90d
              </span>
            </div>
            <div className="mt-2">
              <LineChart
                points={[8, 12, 10, 18, 22, 19, 28, 35, 42, 48, 55, 62, 70, 78]}
                width={260}
                height={56}
              />
            </div>
          </div>

          <div
            className="mt-3 grid grid-cols-3 gap-2"
            style={{ opacity: s4, transition: "opacity 0.5s" }}
          >
            {[
              { icon: Heart, label: "Likes", val: 1240 },
              { icon: MessageCircle, label: "Comments", val: 84 },
              { icon: Share2, label: "Shares", val: 312 },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="rounded-xl bg-fog p-2.5 text-center">
                  <Icon className="mx-auto h-4 w-4" />
                  <div className="mt-1 text-sm font-bold">
                    <Counter value={m.val} start={s4 > 0.1} />
                  </div>
                  <div className="text-[10px] text-muted">{m.label}</div>
                </div>
              );
            })}
          </div>

          <div
            className="mt-3 grid grid-cols-2 gap-3"
            style={{ opacity: s5, transition: "opacity 0.5s" }}
          >
            <div className="rounded-xl border border-line p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Audience Heatmap
              </div>
              <Heatmap rows={4} cols={8} className="mt-2" />
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Traffic Sources
              </div>
              <BarChart
                data={[
                  { label: "Dir", value: 40 },
                  { label: "Soc", value: 65 },
                  { label: "Sch", value: 30 },
                  { label: "Ref", value: 50 },
                ]}
                height={56}
                className="mt-2"
              />
            </div>
          </div>

          <div
            className="mt-3 space-y-2"
            style={{ opacity: s6, transition: "opacity 0.5s" }}
          >
            <div className="rounded-xl border border-line p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Project Timeline
              </div>
              <div className="mt-2 flex items-center gap-1">
                {["Idea", "Prompt", "Gen", "Edit", "Publish"].map((t, i) => (
                  <div key={t} className="flex flex-1 items-center gap-1">
                    <div
                      className="h-2 flex-1 rounded-full bg-ink"
                      style={{ opacity: 0.2 + (i / 4) * 0.8 }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-muted">
                {["Idea", "Prompt", "Gen", "Edit", "Publish"].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted">
                <GitBranch className="h-3 w-3" /> Prompt Evolution
              </div>
              <div className="mt-2 space-y-1 font-mono text-[10px] text-muted">
                <div className="line-through opacity-50">
                  v1: "a city at night"
                </div>
                <div className="line-through opacity-70">
                  v3: "neon city, cinematic, fog"
                </div>
                <div className="text-ink">
                  v7: "anamorphic, volumetric, golden rim" ←
                </div>
              </div>
            </div>
          </div>

          <div
            className="mt-3 flex items-center gap-2 rounded-xl bg-ink p-3 text-white"
            style={{
              opacity: s7,
              transform: `translateY(${(1 - s7) * 10}px)`,
              transition: "all 0.5s",
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium">
              3 collaboration requests
            </span>
            <span className="ml-auto text-xs text-white/60">View →</span>
          </div>
        </div>
      </div>
      <div className="mt-6 text-center">
        <p className="font-serif text-lg italic">
          Shows <span className="font-semibold not-italic">why</span> your work
          mattered.
        </p>
      </div>
    </div>
  );
}

function LandingComparison() {
  const { ref, progress } = useElementScrollProgress();
  return (
    <section
      id="comparison"
      ref={ref}
      className="relative overflow-hidden py-32"
    >
      <div className="absolute inset-0 grid-bg opacity-30 mask-fade-b" />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>The Difference</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            A portfolio ends here. <br />
            <span className="font-serif italic">Prism starts here.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Traditional portfolios answer "what did you create?" Prism answers
            "what happened after you created it?"
          </p>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-20 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          <div className="md:pt-8">
            <div className="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted">
              <span className="h-px w-8 bg-muted" /> Traditional Portfolio
            </div>
            <TraditionalCard />
          </div>

          <div>
            <div className="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-widest">
              <span className="h-px w-8 bg-ink" /> Prism
            </div>
            <PrismCard progress={progress} />
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-line bg-white px-5 py-2.5 text-sm shadow-float">
            <span className="text-muted">Static</span>
            <ArrowDown className="h-4 w-4 rotate-[-90deg]" />
            <span className="font-semibold">Living</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- Showcase / Community / Analytics (from Showcase.tsx) ------------------------------------
function LandingShowcase() {
  const projects = [
    {
      title: "Neon Cartography",
      tag: "Motion",
      views: 48213,
      likes: 1240,
      featured: true,
    },
    { title: "Liquid Type Study", tag: "AI Image", views: 32100, likes: 890 },
    { title: "Anamorphic Skies", tag: "Video", views: 28400, likes: 670 },
    { title: "Chrome Botany", tag: "AI Image", views: 19800, likes: 540 },
  ];
  return (
    <section className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Showcase</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Your portfolio should do more than{" "}
            <span className="font-serif italic">display work.</span>
          </h2>
        </Reveal>
      </div>

      <div className="mx-auto mt-16 max-w-6xl px-6">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-white p-8 shadow-float md:flex-row md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-ink to-muted" />
              <div>
                <div className="text-xl font-semibold">Ava Kessler</div>
                <div className="text-sm text-muted">
                  AI Motion Designer · Berlin
                </div>
              </div>
            </div>
            <div className="flex gap-8 text-center">
              <div>
                <div className="text-2xl font-bold">
                  <Counter value={89} />
                </div>
                <div className="text-xs text-muted">Projects</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  <Counter value={12400} />
                </div>
                <div className="text-xs text-muted">Followers</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  <Counter value={2.4} decimals={1} suffix="M" />
                </div>
                <div className="text-xs text-muted">Views</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  <Counter value={4.9} decimals={1} />
                </div>
                <div className="text-xs text-muted">Rating</div>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div className="group relative overflow-hidden rounded-2xl border border-line bg-white shadow-float transition-all duration-500 hover:-translate-y-1 hover:shadow-float-lg">
                <div className="relative h-44 bg-gradient-to-br from-ink to-muted">
                  <div className="absolute inset-0 dot-bg opacity-20" />
                  {p.featured && (
                    <div className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold">
                      <Star className="mr-1 inline h-3 w-3 fill-ink" /> Featured
                    </div>
                  )}
                  <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold">
                    <Eye className="mr-1 inline h-3 w-3" />
                    <Counter value={p.views} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted">{p.tag}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      <Counter value={p.likes} />
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {Math.floor(p.likes / 12)}
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-6 flex items-center gap-4 overflow-x-auto rounded-2xl border border-line bg-fog p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              Collections
            </div>
            {[
              "Cinematic",
              "Type Studies",
              "Botanical AI",
              "Anamorphic",
              "Chrome",
            ].map((c) => (
              <div
                key={c}
                className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm shadow-float transition hover:scale-105"
              >
                {c}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function LandingCommunity() {
  const { ref, progress } = useElementScrollProgress();
  const creators = [
    { name: "Miyazaki", role: "AI Artist", followers: "8.2K" },
    { name: "Studio Noir", role: "Motion Studio", followers: "15.4K" },
    { name: "Lena Park", role: "Video Editor", followers: "6.1K" },
    { name: "Dax Kim", role: "Designer", followers: "11.3K" },
    { name: "Echo Lab", role: "Creative Agency", followers: "22.7K" },
  ];
  return (
    <section
      id="community"
      ref={ref}
      className="relative overflow-hidden bg-ink py-32 text-white"
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-white/60 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />{" "}
            Community
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Build your audience <br /> around your{" "}
            <span className="font-serif italic">work.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-5 max-w-xl text-lg text-white/60">
            Discover creators, follow, like, comment, collaborate and share.
            Your work becomes discoverable.
          </p>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-16 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Reveal>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Users className="h-4 w-4" /> Discover Creators
              </div>
              <div className="mt-4 space-y-3">
                {creators.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-white/80 to-white/30" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-white/50">
                        {c.role} · {c.followers}
                      </div>
                    </div>
                    <button className="rounded-full border border-white/20 px-3 py-1 text-xs transition hover:bg-white hover:text-ink">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Heart className="h-4 w-4" /> Activity
              </div>
              <div className="mt-4 space-y-3">
                {[
                  {
                    who: "Miyazaki",
                    what: "liked Neon Cartography",
                    when: "2m",
                  },
                  {
                    who: "Studio Noir",
                    what: "sent a collaboration request",
                    when: "18m",
                  },
                  {
                    who: "Lena Park",
                    what: "commented: 'tutorial?'",
                    when: "1h",
                  },
                  { who: "Dax Kim", what: "shared your project", when: "3h" },
                  {
                    who: "Echo Lab",
                    what: "started following you",
                    when: "5h",
                  },
                ].map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-white/40" />
                    <div>
                      <span className="font-medium">{a.who}</span>
                      <span className="text-white/60"> {a.what}</span>
                      <div className="text-xs text-white/40">{a.when} ago</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <MessageCircle className="h-4 w-4" /> Discussions
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "How do you get consistent lighting across generations?",
                  "Best workflow for 4K upscaling?",
                  "Anyone using Prism for client reviews?",
                  "Prompt evolution: v1 → v7 case study",
                ].map((d, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm transition hover:bg-white/10"
                  >
                    {d}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-white/40">
                      <span>{12 + i * 4} replies</span>
                      <span>·</span>
                      <span>{48 + i * 12} likes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="mt-6 flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="shrink-0 text-xs font-medium uppercase tracking-wide text-white/60">
              Recommended
            </div>
            <div className="flex gap-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-white/60 to-white/20"
                  style={{ transform: `translateX(${-(progress * 200)}px)` }}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function LandingAnalytics() {
  return (
    <section id="analytics" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Analytics</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Know what <span className="font-serif italic">resonates.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-5 max-w-xl text-lg text-muted">
            A dashboard that feels alive. Views, engagement, follower growth,
            traffic sources, returning visitors and peak activity — continuously
            animating.
          </p>
        </Reveal>
      </div>

      <div className="mx-auto mt-16 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Reveal className="md:col-span-2">
            <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-float">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">
                    Project Views
                  </div>
                  <div className="mt-1 text-3xl font-bold">
                    <Counter value={2.4} decimals={1} suffix="M" />
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                  <TrendingUp className="h-3.5 w-3.5" /> +312%
                </div>
              </div>
              <div className="mt-6">
                <LineChart
                  points={[
                    10, 14, 12, 20, 26, 30, 38, 45, 52, 60, 68, 75, 82, 90, 96,
                  ]}
                  width={520}
                  height={140}
                  className="w-full"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                <div>
                  <div className="text-xs text-muted">Engagement Rate</div>
                  <div className="text-lg font-bold">
                    <Counter value={18.4} decimals={1} suffix="%" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Avg. Watch Time</div>
                  <div className="text-lg font-bold">
                    <Counter value={2.7} decimals={1} suffix="m" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Returning Visitors</div>
                  <div className="text-lg font-bold">
                    <Counter value={42} suffix="%" />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-float">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                Follower Growth
              </div>
              <div className="mt-4 flex justify-center">
                <DonutChart
                  segments={[
                    { label: "New", value: 45 },
                    { label: "Returning", value: 35 },
                    { label: "Re-engaged", value: 20 },
                  ]}
                  size={160}
                />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: "New", val: 45 },
                  { label: "Returning", val: 35 },
                  { label: "Re-engaged", val: 20 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted">{s.label}</span>
                    <span className="font-semibold">{s.val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-float">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                Top Projects
              </div>
              <BarChart
                data={[
                  { label: "P1", value: 90 },
                  { label: "P2", value: 65 },
                  { label: "P3", value: 48 },
                  { label: "P4", value: 32 },
                  { label: "P5", value: 22 },
                ]}
                height={120}
                className="mt-4"
              />
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-float">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                <Globe className="h-3.5 w-3.5" /> Traffic Sources
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  { src: "Direct", val: 38 },
                  { src: "Social", val: 27 },
                  { src: "Search", val: 19 },
                  { src: "Referral", val: 16 },
                ].map((t) => (
                  <div key={t.src}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">{t.src}</span>
                      <span className="font-semibold">{t.val}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fog">
                      <div
                        className="h-full rounded-full bg-ink"
                        style={{
                          width: `${t.val}%`,
                          transition: "width 1s ease 0.3s",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-float">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                Audience by Country
              </div>
              <Heatmap rows={5} cols={10} className="mt-4" />
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted">
                {["US", "DE", "JP", "UK", "BR", "FR", "CA", "AU"].map((c) => (
                  <span key={c} className="rounded-full bg-fog px-2 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-2">
            <div className="grid h-full grid-cols-2 gap-4">
              <div className="rounded-2xl border border-line bg-white p-5 shadow-float">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                  <Clock className="h-3.5 w-3.5" /> Peak Activity
                </div>
                <BarChart
                  data={[
                    { label: "6", value: 10 },
                    { label: "9", value: 25 },
                    { label: "12", value: 45 },
                    { label: "15", value: 60 },
                    { label: "18", value: 85 },
                    { label: "21", value: 70 },
                    { label: "24", value: 30 },
                  ]}
                  height={80}
                  className="mt-3"
                />
              </div>
              <div className="rounded-2xl border border-line bg-white p-5 shadow-float">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                  <Share2 className="h-3.5 w-3.5" /> Most Shared
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-ink to-muted" />
                  <div>
                    <div className="text-sm font-semibold">
                      Neon Cartography
                    </div>
                    <div className="text-xs text-muted">
                      <Counter value={312} /> shares · <Counter value={84} />{" "}
                      saves
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-fog p-2.5 text-xs">
                  <Flame className="h-3.5 w-3.5" />
                  <span>
                    Best performing prompt:{" "}
                    <span className="font-mono font-semibold">
                      "anamorphic, volumetric"
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100} className="md:col-span-3">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-float">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                <GitBranch className="h-3.5 w-3.5" /> Project Growth Timeline
              </div>
              <LineChart
                points={[
                  5, 8, 7, 12, 16, 14, 22, 28, 35, 42, 48, 55, 62, 70, 78, 85,
                  92,
                ]}
                width={900}
                height={120}
                className="mt-4 w-full"
              />
              <div className="mt-2 flex justify-between text-[10px] text-muted">
                {["Jan", "Mar", "May", "Jul", "Sep", "Nov"].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---- CreatorTimeline / Workflow / Value / Testimonials (from Storytelling.tsx) -----------------
const prismTimeline = [
  { icon: Lightbulb, label: "Idea" },
  { icon: PenLine, label: "Prompt" },
  { icon: Sparkles, label: "AI Generation" },
  { icon: RefreshCw, label: "Revision" },
  { icon: Video, label: "Video Editing" },
  { icon: Upload, label: "Publishing" },
  { icon: Eye, label: "Audience" },
  { icon: BarChart3, label: "Insights" },
  { icon: Award, label: "Recognition" },
  { icon: Handshake, label: "Collaboration" },
  { icon: TrendingUp, label: "Career Growth" },
];

function LandingCreatorTimeline() {
  const { ref, progress } = useElementScrollProgress();
  return (
    <section ref={ref} className="relative overflow-hidden py-32">
      <div className="absolute inset-0 grid-bg opacity-20 mask-fade-b" />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Creator Timeline</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Every project has a{" "}
            <span className="font-serif italic">story.</span>
          </h2>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-20 max-w-4xl px-6">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-line">
          <div
            className="w-full bg-ink"
            style={{
              height: `${progress * 100}%`,
              transition: "height 0.1s linear",
            }}
          />
        </div>

        <div className="space-y-12">
          {prismTimeline.map((t, i) => {
            const Icon = t.icon;
            const active = progress > i / prismTimeline.length;
            const left = i % 2 === 0;
            return (
              <div
                key={i}
                className="relative flex items-center"
                style={{ justifyContent: left ? "flex-start" : "flex-end" }}
              >
                <div
                  className="absolute left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 transition-all duration-500"
                  style={{
                    background: active ? "#0a0a0b" : "#fff",
                    borderColor: active ? "#0a0a0b" : "#e8e8eb",
                    color: active ? "#fff" : "#86868b",
                    transform: `scale(${active ? 1.1 : 0.9})`,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div
                  className={`w-[42%] rounded-2xl border p-4 shadow-float transition-all duration-500 ${
                    active
                      ? "border-ink/20 bg-white opacity-100"
                      : "border-line bg-fog opacity-40"
                  } ${left ? "text-right" : "text-left"}`}
                  style={{ transform: `translateY(${active ? 0 : 20}px)` }}
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">
                    Step {i + 1}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{t.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const prismBeforeFlow = [
  "Prompt",
  "ChatGPT",
  "Folder",
  "Drive",
  "Discord",
  "Behance",
  "Done",
];
const prismAfterFlow = [
  "Prompt",
  "Project",
  "Assets",
  "Community",
  "Analytics",
  "Growth",
];

function LandingWorkflow() {
  return (
    <section className="relative bg-fog py-32">
      <div className="absolute inset-0 dot-bg opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Workflow</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            From disconnected to{" "}
            <span className="font-serif italic">connected.</span>
          </h2>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl px-6">
        <Reveal>
          <div className="mb-6 text-sm font-medium uppercase tracking-widest text-muted">
            Before Prism
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="flex flex-wrap items-center gap-3">
            {prismBeforeFlow.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-muted shadow-float grayscale">
                  {s}
                </div>
                {i < prismBeforeFlow.length - 1 && (
                  <ArrowDown className="h-4 w-4 text-muted opacity-50" />
                )}
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-4 text-sm text-muted">Everything disconnected.</p>
        </Reveal>
      </div>

      <Reveal delay={150}>
        <div className="mx-auto mt-12 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white shadow-float">
          <ArrowDown className="h-5 w-5" />
        </div>
      </Reveal>

      <div className="relative mx-auto mt-12 max-w-5xl px-6">
        <Reveal>
          <div className="mb-6 text-sm font-medium uppercase tracking-widest">
            After Prism
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="flex flex-wrap items-center gap-3">
            {prismAfterFlow.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className="rounded-xl border border-ink/10 bg-ink px-4 py-3 text-sm font-medium text-white shadow-float-lg"
                  style={{ transform: `translateY(${Math.sin(i) * 2}px)` }}
                >
                  {s}
                </div>
                {i < prismAfterFlow.length - 1 && (
                  <ArrowRight className="h-4 w-4" />
                )}
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-4 text-sm font-semibold">Everything connected.</p>
        </Reveal>
      </div>
    </section>
  );
}

const prismValues = [
  "Don't just archive your work. Grow from it.",
  "Every project tells a story. Prism helps you understand it.",
  "Know what resonates. Not just what exists.",
  "Your audience leaves clues. Prism helps you read them.",
  "Turn every creation into your next opportunity.",
  "Your portfolio shouldn't collect dust. It should collect data.",
  "Projects don't end after publishing. They begin collecting insights.",
  "From creation to recognition.",
  "Build with AI. Learn from your audience. Repeat.",
];

function LandingValue() {
  return (
    <section className="relative overflow-hidden py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <SectionLabel>Why Prism</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Your portfolio shows what you created. <br />
            <span className="font-serif italic">
              Prism shows why it mattered.
            </span>
          </h2>
        </Reveal>
      </div>

      <div className="mx-auto mt-16 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {prismValues.map((v, i) => (
            <Reveal key={i} delay={(i % 3) * 80}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-float transition-all duration-500 hover:-translate-y-1 hover:shadow-float-lg">
                <div className="absolute right-4 top-3 font-serif text-3xl italic text-muted/30">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <p className="mt-6 text-lg font-medium leading-snug tracking-tight">
                  {v}
                </p>
                <div className="mt-4 h-px w-0 bg-ink transition-all duration-500 group-hover:w-full" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const prismTestimonials = [
  {
    quote:
      "Prism replaced five tools for me. My prompts, my outputs, my portfolio, my analytics — finally in one place. My follower growth tripled in two months.",
    name: "Ava Kessler",
    role: "AI Motion Designer",
    stat: "+312% followers",
  },
  {
    quote:
      "Clients used to ask 'what have you made?' Now they ask 'how did it perform?' Prism made my work speak for itself.",
    name: "Dax Kim",
    role: "Creative Director, Studio Noir",
    stat: "2.4M views",
  },
  {
    quote:
      "I stopped archiving and started growing. Every project now tells me what to make next. It's like analytics for my creative instincts.",
    name: "Lena Park",
    role: "Video Editor & Content Creator",
    stat: "89 projects",
  },
  {
    quote:
      "We onboarded our whole team in a day. Shared workspaces, comments, reviews — collaboration finally feels native to AI work.",
    name: "Echo Lab",
    role: "Creative Agency",
    stat: "12 collaborators",
  },
];

function LandingTestimonials() {
  return (
    <section className="relative bg-ink py-32 text-white">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-white/60 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />{" "}
            Testimonials
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Creators are building their{" "}
            <span className="font-serif italic">career</span> here.
          </h2>
        </Reveal>
      </div>

      <div className="relative mx-auto mt-16 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {prismTestimonials.map((t, i) => (
            <Reveal key={i} delay={(i % 2) * 100}>
              <div className="group h-full rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur transition-all duration-500 hover:bg-white/10">
                <div className="text-4xl leading-none text-white/30">"</div>
                <p className="mt-2 text-lg leading-relaxed text-white/90">
                  {t.quote}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-white/80 to-white/30" />
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-white/50">{t.role}</div>
                    </div>
                  </div>
                  <div className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium">
                    {t.stat}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- CTA / Footer (from CTA.tsx) ---------------------------------------------------------------
function LandingCTA({ onExploreApp, onNavigate }) {
  return (
    <section className="relative overflow-hidden py-40">
      <div className="absolute inset-0 grid-bg opacity-30 mask-fade-b" />
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,0,0,0.05),transparent_60%)]" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <SectionLabel>Get Started</SectionLabel>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-8 text-5xl font-semibold leading-[1.02] tracking-tightest sm:text-7xl md:text-8xl">
            Create.
            <br />
            Showcase.
            <br />
            <span className="font-serif italic font-normal">Grow.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-7 max-w-lg text-lg text-pretty text-muted">
            Join the next generation of creators building their creative
            identity with Prism.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex items-center justify-center gap-4">
            <MagneticButton onClick={onExploreApp}>
              Get Started Free <ArrowRight className="h-4 w-4" />
            </MagneticButton>
            <MagneticButton
              variant="ghost"
              onClick={() => onNavigate("/waitlist")}
            >
              View Demo
            </MagneticButton>
          </div>
        </Reveal>
        <Reveal delay={400}>
          <p className="mt-6 text-xs text-muted">
            No credit card required · Free forever for solo creators
          </p>
        </Reveal>
      </div>

      <Reveal delay={200}>
        <div className="pointer-events-none absolute -bottom-20 left-1/2 -translate-x-1/2 opacity-[0.04]">
          <div className="h-64 w-64 rotate-45 rounded-[48px] bg-ink" />
        </div>
      </Reveal>
    </section>
  );
}

const prismFooterLinks = {
  Product: [
    "Features",
    "Analytics",
    "Community",
    "Collaboration",
    "Templates",
    "Changelog",
  ],
  Company: ["About", "Careers", "Blog", "Press", "Contact"],
  Resources: ["Documentation", "Creator Guide", "API", "Community", "Status"],
  Legal: ["Privacy", "Terms", "Security", "Cookies"],
};

function LandingFooter({ onNavigate }) {
  const handleLinkClick = (cat, link) => {
    if (cat === "Company" && link === "About") onNavigate("/about");
    else if (cat === "Company" && link === "Contact") onNavigate("/contact");
    else if (cat === "Legal" && link === "Privacy") onNavigate("/privacy");
    else if (cat === "Legal" && link === "Terms") onNavigate("/terms");
  };

  return (
    <footer className="relative border-t border-line bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <a href="#" className="flex items-center gap-2">
              <div className="relative h-8 w-8">
                <div className="absolute inset-0 rotate-45 rounded-[6px] bg-ink" />
                <div className="absolute inset-[5px] rotate-45 rounded-[3px] bg-white" />
                <div className="absolute inset-[9px] rotate-45 rounded-[1px] bg-ink" />
              </div>
              <span className="text-xl font-semibold tracking-tight">
                Prism
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              The AI Creator Workspace where creators create, showcase,
              collaborate, build community and understand the impact of their
              work.
            </p>
            <p className="mt-6 font-serif text-lg italic">
              Your portfolio shows what you created.
              <br />
              Prism shows why it mattered.
            </p>
          </div>

          {Object.entries(prismFooterLinks).map(([cat, links]) => (
            <div key={cat}>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted">
                {cat}
              </div>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => (
                  <li key={l}>
                    <button
                      onClick={() => handleLinkClick(cat, l)}
                      className="text-sm text-ink/70 transition hover:text-ink"
                    >
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 md:flex-row">
          <p className="text-xs text-muted">
            © 2026 Prism. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted">
            <button
              onClick={() => onNavigate("/privacy")}
              className="transition hover:text-ink"
            >
              Privacy
            </button>
            <button
              onClick={() => onNavigate("/terms")}
              className="transition hover:text-ink"
            >
              Terms
            </button>
            <span className="transition hover:text-ink">Status</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ===================================
// LANDING PAGE (assembled from the sections above)
// ===================================
function LandingPage({ onSignIn, onNavigate, onExploreApp, onExitGuestMode }) {
  return (
    <div className="prism-landing relative min-h-screen">
      <LandingStyles />
      <LandingNav onSignIn={onSignIn} onExploreApp={onExploreApp} />
      <main>
        <LandingHero onExploreApp={onExploreApp} onNavigate={onNavigate} />
        <LandingTrust />
        <LandingProblem />
        <LandingSolution />
        <LandingPillars />
        <LandingFeatureGrid />
        <LandingComparison />
        <LandingShowcase />
        <LandingCommunity />
        <LandingAnalytics />
        <LandingCreatorTimeline />
        <LandingWorkflow />
        <LandingValue />
        <LandingTestimonials />
        <LandingCTA onExploreApp={onExploreApp} onNavigate={onNavigate} />
      </main>
      <LandingFooter onNavigate={onNavigate} />
    </div>
  );
}

// ===================================
// MAIN APP COMPONENT
// ===================================
export default function App() {
  const { user, signInWithGoogle, logout } = useAuth();

  // §4.3 — Update <link rel="canonical"> dynamically on every navigation

  // ✅ FIX 2: Simplified useState initializer — token is already in sessionStorage
  // from setGuestAccess(). Don't re-store it (setGuestToken didn't exist anyway),
  // and don't clear the cache immediately after warming it.
  const [guestTeamId, setGuestTeamId] = useState(() => {
    const guestAccess = hasGuestAccess();
    if (guestAccess.hasAccess) {
      console.log("👁️ [APP INIT] Guest team access detected:", {
        teamId: guestAccess.teamId,
        hasAccess: guestAccess.hasAccess,
      });
      console.log(
        "👁️ [APP INIT] Guest permissions loaded:",
        guestAccess.permissions,
      );
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
  const activeTeam = guestTeamId
    ? guestActiveTeam
    : contextActiveTeam.activeTeam;
  const setActiveTeam = guestTeamId
    ? (teamId) => {
        console.log("👁️ [GUEST] Setting guest active team:", teamId);
        setGuestActiveTeam(teamId);
      }
    : contextActiveTeam.setActiveTeam;

  const inviteCardRef = useRef(null);
  // ✅ FIX: Prevents duplicate migration when Firestore triggers re-renders
  const migrationDoneRef = useRef(false);

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
  useCanonical(currentPath);
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
      const guestTeam = teams.find((t) => t.id === guestTeamId);
      if (guestTeam) {
        console.log(
          "👁️ [ACTIVE TEAM] Setting active team for guest:",
          guestTeamId,
        );
        setActiveTeam(guestTeamId);
        setActiveView("prompts");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestTeamId, teams.length]);

  // ✅ Track analytics when guest mode is active
  useEffect(() => {
    if (guestTeamId && window.gtag) {
      console.log("📊 [ANALYTICS] Tracking guest team mode active");
      window.gtag("event", "guest_team_mode_active", {
        team_id: guestTeamId,
      });
    }
  }, [guestTeamId]);

  // Initialize demo prompts for guest users (non-team guests)
  useEffect(() => {
    if (isGuest && !guestTeamId && !guestDemosInitialized) {
      console.log("📝 [DEMOS] Initializing demo prompts for non-team guest");
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

  // Load teams from Firestore
  useEffect(() => {
    console.log("🔍 [TEAMS EFFECT] Running with:", {
      hasUser: !!user,
      guestTeamId,
      teamsLength: teams.length,
      willLoad: !user && guestTeamId && teams.length === 0,
    });

    // ✅ Load guest team data for guest users
    if (!user && guestTeamId) {
      if (teams.length === 0) {
        console.log("👁️ [TEAMS] Loading guest team data:", guestTeamId);

        const fetchGuestTeam = async () => {
          try {
            const teamRef = doc(db, "teams", guestTeamId);
            const teamSnap = await getDoc(teamRef);

            if (teamSnap.exists()) {
              const teamData = { id: teamSnap.id, ...teamSnap.data() };
              console.log("✅ [TEAMS] Guest team loaded:", teamData.name);
              setTeams([teamData]);
              setLoading(false);
            } else {
              console.error("❌ [TEAMS] Guest team not found");
              setTeams([]);
              setLoading(false);
            }
          } catch (error) {
            console.error("❌ [TEAMS] Error loading guest team:", error);
            setTeams([]);
            setLoading(false);
          }
        };

        fetchGuestTeam();
      } else {
        console.log("👁️ [TEAMS] Guest team already loaded, keeping it");
      }
      return;
    }

    // Regular user without guest access
    if (!user) {
      console.log("📝 [TEAMS] No user and no guest team, clearing");
      setTeams([]);
      setActiveTeam(null);
      setLoading(false);
      return;
    }

    // Authenticated user - load their teams
    const q = query(
      collection(db, "teams"),
      where(`members.${user.uid}`, "!=", null),
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
      },
    );

    return () => unsub();
  }, [user, guestTeamId, teams.length]);

  // Handle page exit/refresh for guests with unsaved work
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (isGuest && guestState.hasUnsavedWork()) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved work. Are you sure you want to leave?";
        return e.returnValue;
      }
    }

    if (isGuest) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () =>
        window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [isGuest]);

  // Set first team if no active team (only for authenticated users without guest team)
  useEffect(() => {
    if (!user || loading || isGuest || guestTeamId) return;

    if (teams.length > 0 && !activeTeam && activeView !== "favorites") {
      console.log("👥 [TEAMS] Setting first team as active:", teams[0].id);
      setActiveTeam(teams[0].id);
    }
  }, [
    teams.length,
    activeTeam,
    activeView,
    user,
    loading,
    setActiveTeam,
    isGuest,
    guestTeamId,
  ]);

  // Validate active team still exists (skip for guest users)
  useEffect(() => {
    if (guestTeamId) return;

    if (!user || loading || !activeTeam || teams.length === 0) return;

    const teamExists = teams.find((t) => t.id === activeTeam);
    if (!teamExists) {
      console.log("⚠️ [TEAMS] Active team no longer exists, clearing");
      setActiveTeam(null);
      if (activeView !== "favorites") {
        setActiveView("prompts");
      }
    }
  }, [
    teams,
    activeTeam,
    user,
    loading,
    setActiveTeam,
    activeView,
    guestTeamId,
  ]);

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
        },
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
      const guestOnboardingKey = "guest_onboarding_completed";
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

    if (
      !completed &&
      teams.length === 1 &&
      activeTeam &&
      !hasCompletedOnboarding
    ) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [
    user,
    teams.length,
    loading,
    activeTeam,
    hasCompletedOnboarding,
    isGuest,
    guestDemosInitialized,
  ]);

  // ─── Migration useEffect ───────────────────────────────────────────────────
  // Migrate guest work after successful signup.
  // ✅ FIX: If the user has no teams yet, auto-create "My Team" so that
  //         guest prompts are never silently dropped.
  useEffect(() => {
    if (!user || isGuest) return;

    // Guard 1: ref-based lock (same component lifetime, reset only on error)
    if (migrationDoneRef.current) return;

    // Guard 2: sessionStorage flag (survives React remount / StrictMode)
    if (guestState.isMigrationComplete()) return;

    // Wait until the teams snapshot has resolved so we know the real count.
    // Without this guard, loading===true and teams===[] looks identical to
    // "user genuinely has no teams", which would create a spurious "My Team".
    if (loading) return;

    // Nothing to migrate — bail out without setting the flags so we don't
    // block a future session where the user does have guest work.
    if (!guestState.hasUnsavedWork()) return;

    // Claim the migration slot synchronously before any await.
    migrationDoneRef.current = true;
    guestState.markMigrationComplete();

    const migrateWork = async () => {
      try {
        let targetTeamId;

        if (teams.length > 0) {
          // Happy path — migrate into the user's first existing team.
          targetTeamId = teams[0].id;
        } else {
          // ✅ FIX: New user with no teams — create "My Team" automatically
          //         so the guest prompts have somewhere to land.
          console.log('📁 [MIGRATION] No team found, creating "My Team"…');
          const teamRef = await addDoc(collection(db, "teams"), {
            name: "My Team",
            ownerId: user.uid,
            members: { [user.uid]: "owner" },
            createdAt: serverTimestamp(),
          });
          targetTeamId = teamRef.id;
          console.log('✅ [MIGRATION] "My Team" created:', targetTeamId);

          if (window.gtag) {
            window.gtag("event", "workspace_created", {
              workspace_name: "My Team",
              user_id: user.uid,
              source: "guest_migration",
            });
          }
        }

        const result = await migrateGuestWorkToUser(
          user.uid,
          targetTeamId,
          savePrompt,
        );

        if (result.success && result.migratedCount > 0) {
          console.log(
            `✅ Migrated ${result.migratedCount} prompt(s) → team ${targetTeamId}`,
          );
        }
      } catch (error) {
        console.error("❌ Error migrating guest work:", error);
        // Reset the ref so the next render can retry.
        // Leave the sessionStorage flag in place to avoid an infinite retry loop.
        migrationDoneRef.current = false;
      }
    };

    migrateWork();
  }, [user, isGuest, teams, loading]); // ← `loading` added so we wait for real team data

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
        window.gtag("event", "workspace_created", {
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
          activeTeam,
        );
      } catch (error) {
        console.error("Error creating example prompt:", error);
      }
    }
  }

  // Handle onboarding completion
  function handleOnboardingComplete() {
    if (isGuest) {
      localStorage.setItem("guest_onboarding_completed", "true");
    } else if (user) {
      localStorage.setItem(`onboarding_completed_${user.uid}`, "true");
    }
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
  }

  function handleOnboardingSkip() {
    if (isGuest) {
      localStorage.setItem("guest_onboarding_completed", "true");
    } else if (user) {
      localStorage.setItem(`onboarding_completed_${user.uid}`, "true");
    }
    setShowOnboarding(false);
  }

  // Scroll to invitation card from PromptList
  function scrollToInviteCard() {
    if (inviteCardRef.current) {
      inviteCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  // Handle "Explore App" from landing page
  function handleExploreApp() {
    setIsExploringAsGuest(true);
    window.history.pushState({ guestMode: true }, "", window.location.pathname);

    if (window.gtag) {
      window.gtag("event", "guest_mode_entered", {
        source: "landing_page_cta",
      });
    }
  }

  function handleExitGuestMode() {
    if (guestState.hasUnsavedWork()) {
      const confirmExit = window.confirm(
        "You have unsaved work. Sign up to save it permanently, or continue without saving?",
      );

      if (!confirmExit) {
        return;
      }
    }

    guestState.clearGuestWork();
    setIsExploringAsGuest(false);

    clearGuestAccess(true);

    if (window.gtag) {
      window.gtag("event", "guest_mode_exited", {
        had_work: guestState.hasUnsavedWork(),
      });
    }

    navigate("/");
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  // ✅ FIX 3 & 4: handleExitGuestTeam uses clearGuestAccess() instead of raw
  // sessionStorage.removeItem() calls. This clears both sessionStorage AND the
  // in-memory backup in guestTeamAccess.js, preventing stale token restoration.
  function handleExitGuestTeam() {
    console.log("🚪 [EXIT] Exiting guest team mode");

    clearGuestAccess(true);

    setGuestTeamId(null);
    setGuestTeamPermissions(null);
    setActiveTeam(null);

    if (window.gtag) {
      window.gtag("event", "guest_team_exited");
    }

    navigate("/");

    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  const activeTeamObj = teams.find((t) => t.id === activeTeam);

  // Debug log for guest team state
  useEffect(() => {
    if (guestTeamId) {
      console.log("🔍 [DEBUG] Guest team state:", {
        guestTeamId,
        activeTeam,
        teamsLength: teams.length,
        activeTeamObj: activeTeamObj ? activeTeamObj.name : "undefined",
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
  ].some(
    (route) => currentPath === route || currentPath.startsWith(route + "?"),
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
              isGuest={isGuest}
              onExitGuestMode={handleExitGuestMode}
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
            <Route path="/guest-team">
              <GuestTeamView onNavigate={navigate} />
            </Route>
            <Route path="/waitlist">
              <Waitlist onNavigate={navigate} />
            </Route>
            <Route path="/admin">
              <Suspense
                fallback={
                  <div
                    className="neo-spinner"
                    style={{ margin: "4rem auto" }}
                  />
                }
              >
                <AdminDashboard onNavigate={navigate} />
              </Suspense>
            </Route>
          </Router>
          {currentPath !== "/waitlist" && currentPath !== "/admin" && (
            <Footer onNavigate={navigate} />
          )}
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
            <p style={{ color: "var(--muted-foreground)" }}>
              Loading your teams...
            </p>
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
          <button
            onClick={() => setSidebarOpen(false)}
            className="action-btn-premium"
          >
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
                    background: "rgba(139, 92, 246, 0.08)",
                    border: "1px solid rgba(139, 92, 246, 0.15)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        color: "var(--foreground)",
                      }}
                    >
                      {guestTeamId
                        ? "Guest Team View • Read-Only"
                        : "Guest Mode • Changes are temporary"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "rgba(228, 228, 231, 0.6)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {guestTeamId
                      ? "You can view, copy, comment, and rate prompts. Sign up to create your own."
                      : "Sign up to save your work and collaborate with teams."}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={signInWithGoogle}
                      className="btn-premium"
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        fontSize: "0.813rem",
                      }}
                    >
                      <Shield size={14} />
                      Sign up free
                    </button>
                    <button
                      onClick={
                        guestTeamId ? handleExitGuestTeam : handleExitGuestMode
                      }
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        fontSize: "0.813rem",
                      }}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 0.875rem",
                }}
              >
                <h2 className="sidebar-section-title">Teams</h2>
                {teams.length > 0 && (
                  <span className="team-counter">{teams.length}</span>
                )}
              </div>

              {/* Teams List */}
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.688rem",
                          }}
                        >
                          <span className="owner-label">
                            Owner:{" "}
                            {ownerData?.name || ownerData?.email || "Unknown"}
                          </span>
                          {isOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Delete team "${team.name}"? This cannot be undone.`,
                                  )
                                ) {
                                  deleteTeam(team.id);
                                }
                              }}
                              className="action-btn-premium danger"
                              title="Delete team"
                              style={{ width: "24px", height: "24px" }}
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
                  <Eye
                    size={32}
                    style={{ color: "var(--primary)", margin: "0 auto 1rem" }}
                  />
                  <p>Viewing team as guest</p>
                  <p className="text-xs">Sign up to unlock all features</p>
                </>
              ) : (
                <>
                  <Eye
                    size={32}
                    style={{ color: "var(--primary)", margin: "0 auto 1rem" }}
                  />
                  <p>Exploring as guest</p>
                  <p className="text-xs">
                    Create a free account to unlock everything
                  </p>
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
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ marginLeft: "260px" }}
      >
        {/* Mobile Header */}
        <div className="mobile-header">
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
            ) : activeView === "favorites" && user ? (
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--foreground)" }}
              >
                My Favorites
              </h1>
            ) : isGuest ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <h1
                  className="text-lg font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  Prism
                </h1>
                <span
                  style={{
                    fontSize: "0.688rem",
                    color: "var(--muted-foreground)",
                  }}
                >
                  • Guest Mode
                </span>
              </div>
            ) : guestTeamId ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <h1
                  className="text-lg font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {activeTeamObj?.name || "Team"}
                </h1>
                <span
                  style={{
                    fontSize: "0.688rem",
                    color: "var(--muted-foreground)",
                  }}
                >
                  • Guest View
                </span>
              </div>
            ) : null}
          </div>
          {(isGuest || guestTeamId) && (
            <button
              onClick={guestTeamId ? handleExitGuestTeam : handleExitGuestMode}
              className="btn-secondary"
              style={{ padding: "0.5rem 0.75rem", fontSize: "0.813rem" }}
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
          <div
            className="hidden md:block p-6 border-b"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              My Favorites
            </h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Your bookmarked prompts from all teams
            </p>
          </div>
        ) : null}

        {/* Main Content */}
        <div
          className="flex-1 p-4 md:p-6 overflow-y-auto"
          style={{ backgroundColor: "var(--background)" }}
        >
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
                <TeamInviteForm
                  teamId={activeTeamObj.id}
                  ref={inviteCardRef}
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
            <Suspense
              fallback={
                <div className="neo-spinner" style={{ margin: "4rem auto" }} />
              }
            >
              <PlagiarismChecker teamId={activeTeamObj.id} userRole={role} />
            </Suspense>
          )}

          {/* Favorites view */}
          {activeView === "favorites" && !activeTeam && user && (
            <FavoritesList />
          )}

          {/* Guest Mode - Show demo prompts (only for non-team guests) */}
          {isGuest &&
            !activeTeamObj &&
            !guestTeamId &&
            activeView !== "favorites" && (
              <PromptList
                activeTeam={null}
                userRole={null}
                isGuestMode={true}
                userId={null}
              />
            )}

          {/* Authenticated user without team */}
          {!isGuest &&
            !guestTeamId &&
            !activeTeamObj &&
            activeView !== "favorites" && (
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
