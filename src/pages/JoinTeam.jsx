// src/pages/JoinTeam.jsx - Hybrid approach with clear value propositions
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, getDocs, limit } from 'firebase/firestore';
import {
  getInviteByToken,
  acceptLinkInvite,
  validateInvite,
  acceptTeamInvite,
} from '../lib/inviteUtils';
import InviteGuestMode from '../components/InviteGuestMode';
import { 
  Shield, 
  Loader, 
  AlertTriangle, 
  Eye, 
  Lock,
  Users,
  MessageSquare,
  BarChart3,
  FileText,
  CheckCircle,
  XCircle,
  Zap,
  Crown,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function JoinTeam({ onNavigate }) {
  const { user, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showGuestPreview, setShowGuestPreview] = useState(false);
  const [teamPreview, setTeamPreview] = useState(null);
  const [showChoiceScreen, setShowChoiceScreen] = useState(false);

  // Parse URL parameters and load invite
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const teamId = params.get('teamId');

    async function loadInvite() {
      try {
        if (token) {
          // LINK-BASED INVITE - Show choice screen
          const result = await getInviteByToken(token);
          
          if (!result.valid) {
            setError(result.error || 'Invalid or expired invite');
            setLoading(false);
            return;
          }

          setInviteData(result.invite);
          
          // Load team preview data
          await loadTeamPreview(result.invite.teamId);

          // Show choice screen for guest users
          if (!user) {
            setShowChoiceScreen(true);
          }
        } else if (teamId) {
          // EMAIL-BASED INVITE - Require auth immediately
          if (!user) {
            setLoading(false);
            // Auto-trigger sign-in for email invites
            await handleSignupAndJoin();
            return;
          }

          const teamRef = doc(db, 'teams', teamId);
          const teamSnap = await getDoc(teamRef);
          
          if (!teamSnap.exists()) {
            setError('Team not found');
            setLoading(false);
            return;
          }

          const teamData = teamSnap.data();
          setInviteData({
            teamId,
            teamName: teamData.name,
            type: 'email',
          });
        } else {
          setError('No invite information found');
        }
      } catch (err) {
        console.error('Error loading invite:', err);
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [user]);

  // Load team preview data
  async function loadTeamPreview(teamId) {
    try {
      const teamRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamRef);

      if (!teamSnap.exists()) return;

      const teamData = teamSnap.data();

      // Get sample prompts (first 5 for preview)
      const promptsRef = collection(db, 'teams', teamId, 'prompts');
      const promptsQuery = query(promptsRef, limit(5));
      const promptsSnap = await getDocs(promptsQuery);
      const samplePrompts = promptsSnap.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || 'Untitled',
      }));

      setTeamPreview({
        name: teamData.name,
        memberCount: Object.keys(teamData.members || {}).length,
        promptCount: promptsSnap.size,
        samplePrompts,
      });
    } catch (error) {
      console.error('Error loading team preview:', error);
    }
  }

  // Auto-accept invite if user is already authenticated
  useEffect(() => {
    if (user && inviteData && !processing && !showChoiceScreen && !showGuestPreview) {
      handleAcceptInvite();
    }
  }, [user, inviteData, processing, showChoiceScreen, showGuestPreview]);

  // Handle signup and join
  async function handleSignupAndJoin() {
    if (!user) {
      try {
        setProcessing(true);
        await signInWithGoogle();
        // After sign-in, useEffect will auto-accept
      } catch (error) {
        console.error('Sign-in failed:', error);
        setError('Sign-in failed. Please try again.');
        setProcessing(false);
      }
      return;
    }

    await handleAcceptInvite();
  }

  // Handle guest preview choice
  function handleViewAsGuest() {
    setShowChoiceScreen(false);
    setShowGuestPreview(true);
  }

  // Accept invite
  async function handleAcceptInvite() {
    if (!user) {
      await handleSignupAndJoin();
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let result;

      if (inviteData.type === 'link' && inviteData.token) {
        result = await acceptLinkInvite(inviteData.token, user.uid);
      } else {
        if (inviteData.id) {
          result = await acceptTeamInvite(inviteData.id, inviteData.teamId, user.uid);
        } else {
          result = { success: false, error: 'Invalid invite format' };
        }
      }

      if (result.success) {
        console.log('✅ Successfully joined team');
        
        // Track conversion
        if (window.gtag) {
          window.gtag('event', 'team_joined', {
            team_id: inviteData.teamId,
            role: inviteData.role,
            invite_type: inviteData.type,
          });
        }
        
        onNavigate('/');
        
        setTimeout(() => {
          alert(`✅ Welcome to ${result.teamName || inviteData.teamName}!`);
        }, 500);
      } else {
        if (result.error === 'ALREADY_MEMBER') {
          setError('You are already a member of this team');
          setTimeout(() => onNavigate('/'), 2000);
        } else if (result.error === 'INVITE_EXPIRED') {
          setError('This invite has expired');
        } else if (result.error === 'TEAM_NOT_FOUND') {
          setError('Team not found');
        } else {
          setError(result.error || 'Failed to join team');
        }
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      setError('An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  }

  function handleDecline() {
    onNavigate('/');
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="glass-card p-8 text-center max-w-md">
          <Loader className="animate-spin mx-auto mb-4" size={48} style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--foreground)' }}>Loading invite...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="glass-card p-8 text-center max-w-md">
          <AlertTriangle className="mx-auto mb-4" size={48} style={{ color: 'var(--destructive)' }} />
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
            Invite Error
          </h2>
          <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {error}
          </p>
          <button onClick={() => onNavigate('/')} className="btn-primary">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // Processing state
  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="glass-card p-8 text-center max-w-md">
          <Loader className="animate-spin mx-auto mb-4" size={48} style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--foreground)' }}>
            {user ? 'Joining team...' : 'Signing in...'}
          </p>
        </div>
      </div>
    );
  }

  // CHOICE SCREEN - Guest vs Signup
  if (showChoiceScreen && teamPreview) {
    return (
      <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
        {/* Animated gradient background */}
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>

        <div className="container mx-auto px-4 py-12 relative z-10">
          {/* Header */}
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <div
              style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 2rem',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
                borderRadius: '20px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={40} style={{ color: 'var(--primary)' }} />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
              You've been invited to join
            </h1>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-4"
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <Crown size={24} style={{ color: 'var(--primary)' }} />
              <span className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {teamPreview.name}
              </span>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <div className="flex items-center gap-2">
                <Users size={16} />
                <span>{teamPreview.memberCount} members</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={16} />
                <span>{teamPreview.promptCount} prompts</span>
              </div>
            </div>

            <p className="mt-6 text-lg" style={{ color: 'var(--muted-foreground)' }}>
              Invited by <strong>{inviteData.inviterName || 'a team member'}</strong> as a{' '}
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(139, 92, 246, 0.15)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  fontWeight: '600',
                }}
              >
                {inviteData.role}
              </span>
            </p>
          </div>

          {/* Choice Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-8">
            {/* GUEST PREVIEW OPTION */}
            <div
              className="glass-card p-8 relative overflow-hidden"
              style={{
                border: '1px solid rgba(139, 92, 246, 0.15)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#fbbf24',
                }}
              >
                Free • No signup
              </div>

              <div className="mb-6">
                <Eye size={48} style={{ color: 'var(--muted-foreground)', marginBottom: '1rem' }} />
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                  View as Guest
                </h2>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.938rem' }}>
                  Preview the team before deciding to join
                </p>
              </div>

              {/* What you CAN do */}
              <div className="space-y-3 mb-6">
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Browse team prompts</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      See titles and descriptions
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>View team info</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Member count and activity
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Explore interface</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Test the platform risk-free
                    </p>
                  </div>
                </div>
              </div>

              {/* What you CANNOT do */}
              <div className="pt-4 border-t mb-6" style={{ borderColor: 'var(--border)' }}>
                <p style={{ fontSize: '0.813rem', fontWeight: '600', color: 'var(--muted-foreground)', marginBottom: '0.75rem' }}>
                  Limitations:
                </p>
                <div className="space-y-2">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <XCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Cannot see full prompt content
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <XCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Cannot create or edit prompts
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <XCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Cannot use team chat
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <XCircle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Work won't be saved
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleViewAsGuest}
                className="btn-secondary w-full"
                style={{ padding: '0.875rem', fontSize: '0.938rem' }}
              >
                <Eye size={18} />
                Preview as Guest
              </button>
            </div>

            {/* SIGNUP & JOIN OPTION */}
            <div
              className="glass-card p-8 relative overflow-hidden"
              style={{
                border: '2px solid rgba(139, 92, 246, 0.4)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 92, 246, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  padding: '0.25rem 0.75rem',
                  background: 'var(--primary)',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <Sparkles size={12} />
                Recommended
              </div>

              <div className="mb-6">
                <Shield size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                  Sign Up & Join
                </h2>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.938rem' }}>
                  Full access as a team {inviteData.role}
                </p>
              </div>

              {/* Full benefits */}
              <div className="space-y-3 mb-6">
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Create & edit prompts</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Build and refine AI workflows
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Real-time collaboration</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Team chat and live updates
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Access all content</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      View full prompts and outputs
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Analytics & insights</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Track performance metrics
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                  <CheckCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.125rem' }} />
                  <div>
                    <strong style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>Work saved permanently</strong>
                    <p style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                      Access from anywhere, anytime
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSignupAndJoin}
                className="btn-premium w-full"
                style={{ padding: '1rem', fontSize: '1rem' }}
              >
                <Shield size={20} />
                Sign Up & Join Team
                <ArrowRight size={20} className="btn-arrow" />
              </button>

              <p className="text-center mt-4" style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                Free forever • No credit card • Takes 10 seconds
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <button
              onClick={handleDecline}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted-foreground)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              No thanks, return home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GUEST PREVIEW MODE
  if (showGuestPreview && inviteData) {
    return (
      <div style={{ background: 'var(--background)', minHeight: '100vh', paddingTop: '120px' }}>
        <InviteGuestMode
          inviteData={inviteData}
          onAcceptInvite={handleSignupAndJoin}
          onDecline={handleDecline}
        />

        <div className="container mx-auto px-4 py-12">
          <div className="glass-card p-8 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <Eye size={64} className="mx-auto mb-4" style={{ color: 'var(--primary)' }} />
              <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                Preview: {inviteData.teamName}
              </h1>
              <p style={{ color: 'var(--muted-foreground)' }}>
                You're viewing this team as a guest with limited access
              </p>
            </div>

            {/* Guest limitations notice */}
            <div
              className="mb-8 p-6 rounded-lg"
              style={{
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <Lock size={24} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                    Guest Restrictions
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                    As a guest, you can only view limited information. Sign up to unlock full access.
                  </p>
                  <ul className="space-y-2">
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <XCircle size={16} style={{ color: '#fbbf24' }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>Cannot view full prompt content</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <XCircle size={16} style={{ color: '#fbbf24' }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>Cannot create or edit</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <XCircle size={16} style={{ color: '#fbbf24' }} />
                      <span style={{ color: 'var(--muted-foreground)' }}>Cannot use team chat</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Sample prompts preview */}
            {teamPreview?.samplePrompts && teamPreview.samplePrompts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  Sample Prompts
                </h2>
                <div className="space-y-3">
                  {teamPreview.samplePrompts.map((prompt, index) => (
                    <div
                      key={prompt.id}
                      className="p-4 rounded-lg"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText size={18} style={{ color: 'var(--primary)' }} />
                          <span style={{ color: 'var(--foreground)', fontWeight: '500' }}>
                            {prompt.title}
                          </span>
                        </div>
                        <Lock size={16} style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA to join */}
            <div className="text-center pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Ready to collaborate?
              </h3>
              <button
                onClick={handleSignupAndJoin}
                className="btn-premium"
                style={{ padding: '1rem 2rem' }}
              >
                <Shield size={20} />
                Sign Up & Join Team
                <ArrowRight size={20} className="btn-arrow" />
              </button>
              <p className="mt-4" style={{ fontSize: '0.813rem', color: 'var(--muted-foreground)' }}>
                Free forever • No credit card required • Full access to all features
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
