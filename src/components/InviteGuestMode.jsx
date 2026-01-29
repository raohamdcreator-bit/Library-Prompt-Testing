// src/components/InviteGuestMode.jsx - Guest preview for invited users
import { useState, useEffect } from 'react';
import { Shield, Users, FileText, ArrowRight, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, getDocs, limit } from 'firebase/firestore';

/**
 * Invite Guest Mode Banner
 * Shows when an unauthenticated user visits via invite link
 * Allows them to preview team content before signing up
 */
export default function InviteGuestMode({ 
  inviteData, 
  onAcceptInvite, 
  onDecline 
}) {
  const [teamPreview, setTeamPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load team preview data
  useEffect(() => {
    async function loadTeamPreview() {
      if (!inviteData?.teamId) return;

      try {
        const teamRef = doc(db, 'teams', inviteData.teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
          setLoading(false);
          return;
        }

        const teamData = teamSnap.data();

        // Get sample prompts (first 3)
        const promptsRef = collection(db, 'teams', inviteData.teamId, 'prompts');
        const promptsQuery = query(promptsRef, limit(3));
        const promptsSnap = await getDocs(promptsQuery);
        const samplePrompts = promptsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        setTeamPreview({
          name: teamData.name,
          memberCount: Object.keys(teamData.members || {}).length,
          promptCount: promptsSnap.size,
          samplePrompts,
          inviterName: inviteData.inviterName,
          role: inviteData.role,
        });
      } catch (error) {
        console.error('Error loading team preview:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTeamPreview();
  }, [inviteData]);

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'rgba(139, 92, 246, 0.08)',
          borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
          backdropFilter: 'blur(8px)',
          padding: '1rem 2rem',
        }}
      >
        <div className="container mx-auto flex items-center justify-center gap-3">
          <div className="neo-spinner"></div>
          <span style={{ color: 'var(--foreground)', fontSize: '0.875rem' }}>
            Loading team preview...
          </span>
        </div>
      </div>
    );
  }

  if (!teamPreview) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '1rem 2rem',
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <span style={{ color: 'var(--destructive)', fontSize: '0.875rem' }}>
            ⚠️ Team not found or invite expired
          </span>
          <button onClick={onDecline} className="action-btn-premium">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(124, 58, 237, 0.12) 100%)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="container mx-auto px-4 py-4">
        {/* Mobile Layout */}
        <div className="md:hidden space-y-3">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Shield size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--foreground)' }}>
                You've been invited!
              </span>
            </div>
            <p style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.7)' }}>
              <strong>{teamPreview.inviterName || 'Someone'}</strong> invited you to join{' '}
              <strong>{teamPreview.name}</strong> as a <strong>{teamPreview.role}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div
              style={{
                flex: '1 1 auto',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Users size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>
                {teamPreview.memberCount} members
              </span>
            </div>
            <div
              style={{
                flex: '1 1 auto',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FileText size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>
                {teamPreview.promptCount} prompts
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onAcceptInvite}
              className="btn-premium flex-1"
              style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}
            >
              <Shield size={16} />
              Join Team
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onDecline}
              className="btn-secondary"
              style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}
            >
              Decline
            </button>
          </div>

          <p style={{ fontSize: '0.688rem', color: 'rgba(228, 228, 231, 0.5)', textAlign: 'center' }}>
            You're viewing as a guest • Sign up to join and collaborate
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={24} style={{ color: 'var(--primary)' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--foreground)', margin: 0 }}>
                  You've been invited to join {teamPreview.name}
                </h3>
                <span
                  style={{
                    padding: '0.25rem 0.625rem',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    borderRadius: '6px',
                    fontSize: '0.688rem',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    textTransform: 'uppercase',
                  }}
                >
                  {teamPreview.role}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'rgba(228, 228, 231, 0.6)', margin: 0 }}>
                Invited by <strong>{teamPreview.inviterName || 'a team member'}</strong> •{' '}
                {teamPreview.memberCount} members • {teamPreview.promptCount} prompts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.5)', marginRight: '0.5rem' }}>
              Currently viewing as guest
            </div>
            <button
              onClick={onDecline}
              className="btn-secondary"
              style={{ padding: '0.625rem 1rem' }}
            >
              Decline
            </button>
            <button
              onClick={onAcceptInvite}
              className="btn-premium"
              style={{ padding: '0.625rem 1.5rem' }}
            >
              <Shield size={18} />
              Join Team
              <ArrowRight size={18} className="btn-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
