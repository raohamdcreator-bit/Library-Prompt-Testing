// src/components/TeamInviteForm.jsx - FIXED: Proper team ID tracking and reset + RESPONSIVE
import { useState, forwardRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { 
  Users, Mail, Send, UserPlus, Shield, Info, CheckCircle, X, Loader2,
  Link as LinkIcon, Copy, Check, Sparkles, Eye, Lock, Star, MessageSquare
} from "lucide-react";
import { sendTeamInvitation, generateTeamInviteLink } from "../lib/inviteUtils";
import { generateGuestAccessLink } from "../lib/guestTeamAccess";

const TeamInviteForm = forwardRef(({ teamId, teamName, role }, ref) => {
  const { user } = useAuth();
  const { success, error: showError, info } = useNotification();
  const { playNotification } = useSoundEffects();
  
  const [inviteType, setInviteType] = useState("guest-link");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  // ✅ CRITICAL FIX: Reset form state when team changes
  useEffect(() => {
    console.log('🔄 Team changed, resetting form:', { teamId, teamName });
    setInviteType("guest-link");
    setEmail("");
    setInviteRole("member");
    setLoading(false);
    setGeneratedLink(null);
    setCopied(false);
  }, [teamId]);

  async function handleEmailInvite(e) {
    e.preventDefault();
    if (!email.trim()) { showError("Please enter an email address"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { showError("Please enter a valid email address"); return; }
    setLoading(true);
    try {
      console.log('📧 Sending email invite:', { teamId, teamName, email, inviteRole });
      const result = await sendTeamInvitation({
        teamId, teamName, email: email.trim(), role: inviteRole,
        invitedBy: user.uid, inviterName: user.displayName || user.email,
      });
      if (!result.success) throw new Error(result.error);
      if (window.gtag) window.gtag('event', 'team_invited_email', { team_id: teamId, team_name: teamName, invited_role: inviteRole, invited_by: user.uid, email_sent: result.emailSent });
      setEmail(""); setInviteRole("member"); playNotification();
      success(`Invite sent to ${email.trim()}! ${result.emailSent ? 'Email delivered.' : 'Saved to database.'}`, 4000);
    } catch (err) {
      console.error("❌ Error sending invite:", err);
      let errorMessage = "Failed to send invite: ";
      if (err.message.includes("already exists")) errorMessage = "An active invitation already exists for this email.";
      else if (err.message.includes("maximum")) errorMessage = err.message;
      else errorMessage += err.message || "Unknown error";
      showError(errorMessage, 5000);
    } finally { setLoading(false); }
  }

  async function handleGenerateAuthLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('🔗 Generating auth invite link:', { teamId, teamName, inviteRole });
      const result = await generateTeamInviteLink({
        teamId, teamName, role: inviteRole, invitedBy: user.uid,
        inviterName: user.displayName || user.email, expiresInDays: 7,
      });
      if (!result.success) throw new Error(result.error);
      if (window.gtag) window.gtag('event', 'auth_invite_link_generated', { team_id: teamId, team_name: teamName, role: inviteRole, invited_by: user.uid, expires_in_days: 7 });
      setGeneratedLink({ url: result.inviteLink, token: result.token, inviteId: result.inviteId, expiresAt: result.expiresAt, type: "auth" });
      playNotification(); success("Full access invite link generated successfully!", 3000);
    } catch (err) {
      console.error("❌ Error generating auth invite link:", err);
      let errorMessage = "Failed to generate invite link: ";
      if (err.message.includes("maximum")) errorMessage = err.message;
      else errorMessage += err.message || "Unknown error";
      showError(errorMessage, 5000);
    } finally { setLoading(false); }
  }

  async function handleGenerateGuestLink(e) {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('👁️ Generating guest access link:', { teamId, teamName });
      const result = await generateGuestAccessLink({
        teamId, teamName, createdBy: user.uid,
        creatorName: user.displayName || user.email, expiresInDays: 30,
      });
      if (!result.success) throw new Error(result.error);
      console.log('✅ Guest access link generated:', result.accessLink);
      if (window.gtag) window.gtag('event', 'guest_access_link_generated', { team_id: teamId, team_name: teamName, created_by: user.uid, expires_in_days: 30 });
      setGeneratedLink({ url: result.accessLink, token: result.accessToken, expiresAt: result.expiresAt, type: "guest" });
      playNotification(); success("Guest access link generated successfully!", 3000);
    } catch (err) {
      console.error("❌ Error generating guest access link:", err);
      showError("Failed to generate guest link: " + (err.message || "Unknown error"), 5000);
    } finally { setLoading(false); }
  }

  async function copyToClipboard() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink.url);
      setCopied(true); playNotification(); success("Link copied to clipboard!", 2000);
      if (window.gtag) window.gtag('event', 'invite_link_copied', { team_id: teamId, link_type: generatedLink.type });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      showError("Failed to copy link. Please copy it manually.", 3000);
    }
  }

  if (role !== "owner" && role !== "admin") return null;

  const roleOptions = [
    { value: "member", label: "Member", description: "Can create and manage their own prompts", icon: UserPlus },
    { value: "admin",  label: "Admin",  description: "Can manage team members and all prompts", icon: Shield },
  ];

  const methodOptions = [
    { value: "guest-link", label: "Guest Link", icon: Eye },
    { value: "auth-link",  label: "Full Access", icon: LinkIcon },
    { value: "email",      label: "Email",       icon: Mail },
  ];

  return (
    <>
      <style>{`
        /* ── TeamInviteForm responsive ── */

        /* Segmented switcher */
        .tif-methods {
          display:flex; gap:.3rem; padding:.25rem;
          border-radius:10px; border:1px solid var(--border);
          background:var(--muted);
          overflow-x:auto; scrollbar-width:none;
        }
        .tif-methods::-webkit-scrollbar { display:none; }
        .tif-method-btn {
          flex:1; min-width:0; display:flex; align-items:center; justify-content:center;
          gap:.375rem; padding:.5rem .5rem; border-radius:7px; border:none;
          cursor:pointer; font-size:.8rem; font-weight:500; white-space:nowrap;
          transition:all .18s; background:transparent; color:var(--muted-foreground);
        }
        .tif-method-btn.active {
          background:var(--card); color:var(--foreground);
          box-shadow:0 1px 4px rgba(0,0,0,.2);
        }

        /* Description panel */
        .tif-desc {
          padding:.75rem; border-radius:10px;
          border:1px solid color-mix(in srgb, var(--primary) 30%, transparent);
          background:color-mix(in srgb, var(--primary) 5%, transparent);
          font-size:.8rem; line-height:1.55;
        }
        .tif-desc-title {
          font-weight:600; margin-bottom:.375rem;
          display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;
          color:var(--foreground);
        }
        .tif-badge {
          font-size:.65rem; padding:.15rem .45rem; border-radius:999px; font-weight:600;
        }
        .tif-caps {
          display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.5rem;
        }
        .tif-cap {
          font-size:.7rem; display:flex; align-items:center; gap:.25rem;
        }

        /* Role cards: 2-col on mobile, single col on very small */
        .tif-roles {
          display:grid; grid-template-columns:1fr 1fr; gap:.5rem;
        }
        @media(max-width:380px){ .tif-roles { grid-template-columns:1fr; } }

        .tif-role-card {
          display:flex; align-items:flex-start; gap:.5rem;
          padding:.625rem .75rem; border-radius:9px;
          border:1px solid var(--border); cursor:pointer;
          transition:all .15s; background:transparent; user-select:none;
        }
        .tif-role-card.active {
          border-color:var(--primary);
          background:color-mix(in srgb, var(--primary) 8%, transparent);
        }
        .tif-role-card:not(.active):hover {
          border-color:color-mix(in srgb, var(--primary) 50%, transparent);
        }

        /* Email row */
        .tif-email-row {
          display:flex; align-items:center; gap:.5rem;
          border:1px solid var(--border); border-radius:10px;
          padding:.5rem .75rem; background:var(--card);
          transition:border-color .15s;
        }
        .tif-email-row:focus-within { border-color:var(--primary); }

        /* Generated link display */
        .tif-link-box {
          display:flex; align-items:center; gap:.5rem;
          padding:.5rem .75rem; border-radius:8px;
          background:var(--muted); border:1px solid var(--border);
          overflow:hidden;
        }
        .tif-link-url {
          flex:1; min-width:0; font-family:monospace; font-size:.7rem;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          color:var(--foreground);
        }

        /* Action buttons */
        .tif-actions { display:flex; gap:.5rem; flex-wrap:wrap; }
        .tif-actions > * { flex:1; min-width:100px; justify-content:center; }
        @media(max-width:340px){ .tif-actions > * { min-width:unset; width:100%; } }

        /* How it works: 2-col grid */
        .tif-info-grid {
          display:grid; grid-template-columns:1fr 1fr; gap:.5rem;
        }
        @media(max-width:480px){ .tif-info-grid { grid-template-columns:1fr; } }

        .tif-info-item {
          display:flex; align-items:flex-start; gap:.5rem;
          padding:.5rem .625rem; border-radius:8px;
          background:var(--secondary); font-size:.75rem; line-height:1.5;
        }
      `}</style>

      <div
        ref={ref}
        className="glass-card p-5 mt-6"
        style={{ border: "1px solid var(--border)" }}
        key={`invite-form-${teamId}`}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Users className="w-4 h-4" style={{ color: "var(--primary-foreground)" }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              Invite to Team
            </h3>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Share <strong>{teamName}</strong> with others
            </p>
          </div>
        </div>

        <div className="space-y-4">

          {/* ── Segmented method switcher ── */}
          <div>
            <label className="block text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Invite Method
            </label>
            <div className="tif-methods">
              {methodOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`tif-method-btn${inviteType === value ? " active" : ""}`}
                  onClick={() => { setInviteType(value); setGeneratedLink(null); }}
                  disabled={loading}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Method description panel ── */}
          <div className="tif-desc">
            {inviteType === "guest-link" && (
              <>
                <div className="tif-desc-title">
                  <Eye size={14} className="text-cyan-400" />
                  Guest Link (Read-Only)
                  <span className="tif-badge" style={{ backgroundColor: "rgba(34,197,94,.15)", color: "rgb(34,197,94)" }}>Instant Access</span>
                  <span className="tif-badge" style={{ backgroundColor: "rgba(139,92,246,.15)", color: "var(--primary)" }}>No Sign-up</span>
                </div>
                <p style={{ color: "var(--muted-foreground)" }}>
                  Perfect for sharing with anyone! No account required. Users can view, copy, comment, and rate prompts instantly.
                </p>
                <div className="tif-caps">
                  <span className="tif-cap text-green-500"><Check size={11} /> View & Copy</span>
                  <span className="tif-cap text-green-500"><MessageSquare size={11} /> Comment</span>
                  <span className="tif-cap text-green-500"><Star size={11} /> Rate</span>
                  <span className="tif-cap text-red-500"><Lock size={11} /> Can't Edit</span>
                </div>
              </>
            )}
            {inviteType === "auth-link" && (
              <>
                <div className="tif-desc-title">
                  <LinkIcon size={14} className="text-cyan-400" />
                  Full Access Link
                  <span className="tif-badge" style={{ backgroundColor: "rgba(139,92,246,.15)", color: "var(--primary)" }}>Sign-up Required</span>
                </div>
                <p style={{ color: "var(--muted-foreground)" }}>
                  Share with people who need full access. They'll sign in with Google and become team members with the role you select below.
                </p>
              </>
            )}
            {inviteType === "email" && (
              <>
                <div className="tif-desc-title">
                  <Mail size={14} className="text-cyan-400" />
                  Email Invite
                  <span className="tif-badge" style={{ backgroundColor: "rgba(139,92,246,.15)", color: "var(--primary)" }}>Sign-up Required</span>
                </div>
                <p style={{ color: "var(--muted-foreground)" }}>
                  Send a personalized invitation to a specific email address. The invite is valid for 7 days.
                </p>
              </>
            )}
          </div>

          {/* ── Email input ── */}
          {inviteType === "email" && (
            <div>
              <label
                htmlFor="invite-email"
                className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--foreground)" }}
              >
                <Mail size={13} /> Email Address *
              </label>
              <div className="tif-email-row">
                <Mail size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                <input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  className="flex-1 bg-transparent text-sm outline-none min-w-0"
                  style={{ color: "var(--foreground)" }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleEmailInvite(e)}
                  disabled={loading}
                />
                {email && !loading && (
                  <button type="button" onClick={() => setEmail("")} className="opacity-50 hover:opacity-100 transition-opacity">
                    <X size={13} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                )}
              </div>
              <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                <Info size={11} /> They'll receive an invitation valid for 7 days
              </p>
            </div>
          )}

          {/* ── Role selection ── */}
          {(inviteType === "auth-link" || inviteType === "email") && (
            <div>
              <label className="block text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                <Shield size={13} /> Role & Permissions
              </label>
              <div className="tif-roles">
                {roleOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className={`tif-role-card${inviteRole === option.value ? " active" : ""}`}
                    >
                      <input
                        type="radio"
                        value={option.value}
                        checked={inviteRole === option.value}
                        onChange={e => setInviteRole(e.target.value)}
                        className="mt-0.5 w-3.5 h-3.5 flex-shrink-0"
                        style={{ accentColor: "var(--primary)" }}
                        disabled={loading}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon size={13} className="text-cyan-400 flex-shrink-0" />
                          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{option.label}</span>
                        </div>
                        <p className="text-[11px] leading-snug" style={{ color: "var(--muted-foreground)" }}>{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Generated link display ── */}
          {generatedLink && (
            <div
              className="p-3 rounded-lg border"
              style={{ backgroundColor: "rgba(139,92,246,.05)", borderColor: "var(--primary)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {generatedLink.type === "guest" ? "Guest Access Link Generated!" : "Invite Link Generated!"}
                </span>
              </div>
              {generatedLink.type === "guest" && (
                <p className="text-[11px] mb-2" style={{ color: "var(--muted-foreground)" }}>
                  Anyone with this link can view your team's prompts in read-only mode. No sign-up required!
                </p>
              )}
              <div className="tif-link-box mb-2">
                <span className="tif-link-url">{generatedLink.url}</span>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="action-btn-premium flex-shrink-0"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                <Info size={11} className="flex-shrink-0" />
                Expires {generatedLink.expiresAt.toLocaleDateString()} at {generatedLink.expiresAt.toLocaleTimeString()}
              </p>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="tif-actions pt-1">
            {inviteType === "email" ? (
              <>
                <button
                  type="button"
                  onClick={handleEmailInvite}
                  disabled={loading || !email.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                    : <><Send className="w-4 h-4" /> Send Invitation</>
                  }
                </button>
                {email && !loading && (
                  <button type="button" onClick={() => setEmail("")} className="btn-secondary flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </>
            ) : inviteType === "guest-link" ? (
              <button
                type="button"
                onClick={handleGenerateGuestLink}
                disabled={loading || !!generatedLink}
                className="btn-primary flex items-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : generatedLink
                  ? <><CheckCircle className="w-4 h-4" /> Link Generated</>
                  : <><Eye className="w-4 h-4" /> Generate Guest Link</>
                }
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateAuthLink}
                disabled={loading || !!generatedLink}
                className="btn-primary flex items-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : generatedLink
                  ? <><CheckCircle className="w-4 h-4" /> Link Generated</>
                  : <><LinkIcon className="w-4 h-4" /> Generate Full Access Link</>
                }
              </button>
            )}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <h4 className="text-xs font-semibold mb-2.5 flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
            <Info size={13} className="text-cyan-400" /> How It Works
          </h4>
          <div className="tif-info-grid">
            <div className="tif-info-item">
              <Eye size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span style={{ color: "var(--muted-foreground)" }}>
                <strong style={{ color: "var(--foreground)" }}>Guest Link:</strong> Instant read-only access. Perfect for clients or stakeholders. No sign-up needed.
              </span>
            </div>
            <div className="tif-info-item">
              <LinkIcon size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <span style={{ color: "var(--muted-foreground)" }}>
                <strong style={{ color: "var(--foreground)" }}>Full Access Link:</strong> Requires Google sign-in. New users become team members.
              </span>
            </div>
            <div className="tif-info-item">
              <Mail size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <span style={{ color: "var(--muted-foreground)" }}>
                <strong style={{ color: "var(--foreground)" }}>Email Invite:</strong> Personalized invite sent to a specific address. Also requires sign-in.
              </span>
            </div>
            <div className="tif-info-item">
              <CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span style={{ color: "var(--muted-foreground)" }}>
                All links expire automatically (7–30 days) and can be revoked anytime.
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

TeamInviteForm.displayName = 'TeamInviteForm';

export default TeamInviteForm;
