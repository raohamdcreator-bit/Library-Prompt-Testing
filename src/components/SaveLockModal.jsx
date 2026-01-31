// src/components/SaveLockModal.jsx - Signup gate for guest users attempting to save
import { X, Zap, Shield, Clock } from 'lucide-react';
import { guestState } from '../lib/guestState';

/**
 * Save Lock Modal
 * Triggers when guest user attempts to save work
 * Exact copy as per requirements
 */
export default function SaveLockModal({ isOpen, onClose, onSignup, onContinueWithout }) {
  if (!isOpen) return null;

  const workSummary = guestState.getWorkSummary();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ 
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card relative w-full max-w-md mx-4"
        style={{
          padding: '2.5rem 2rem',
          animation: 'fadeInUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="action-btn-premium absolute top-4 right-4"
          style={{
            width: '36px',
            height: '36px',
          }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <Shield size={32} style={{ color: 'var(--primary)' }} />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: 'var(--foreground)',
            textAlign: 'center',
            marginBottom: '0.75rem',
            lineHeight: '1.2',
          }}
        >
          Don't lose this work
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(228, 228, 231, 0.7)',
            textAlign: 'center',
            marginBottom: '2rem',
            lineHeight: '1.5',
          }}
        >
          Create a free account to save your prompts and come back anytime.
        </p>

        {/* Work Summary (if any work exists) */}
        {workSummary.promptCount > 0 && (
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Zap size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--foreground)' }}>
                Your work so far:
              </span>
            </div>
            <div style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.6)', marginLeft: '1.75rem' }}>
              {workSummary.promptCount > 0 && (
                <div>{workSummary.promptCount} {workSummary.promptCount === 1 ? 'prompt' : 'prompts'}</div>
              )}
              {workSummary.outputCount > 0 && (
                <div>{workSummary.outputCount} {workSummary.outputCount === 1 ? 'output' : 'outputs'}</div>
              )}
            </div>
          </div>
        )}

        {/* Primary CTA */}
        <button
          onClick={onSignup}
          className="btn-premium w-full"
          style={{
            marginBottom: '0.75rem',
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: '600',
            justifyContent: 'center',
          }}
        >
          <Shield size={20} />
          Save & create free account
        </button>

        {/* Secondary CTA */}
        <button
          onClick={onContinueWithout}
          className="btn-secondary w-full"
          style={{
            padding: '1rem',
            fontSize: '0.938rem',
            fontWeight: '500',
            justifyContent: 'center',
          }}
        >
          Continue without saving
        </button>

        {/* Microcopy */}
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Zap size={14} style={{ color: 'var(--primary)', opacity: 0.7 }} />
            <span style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.5)' }}>
              Free
            </span>
          </div>
          <span style={{ color: 'rgba(228, 228, 231, 0.3)' }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Shield size={14} style={{ color: 'var(--primary)', opacity: 0.7 }} />
            <span style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.5)' }}>
              No credit card
            </span>
          </div>
          <span style={{ color: 'rgba(228, 228, 231, 0.3)' }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Clock size={14} style={{ color: 'var(--primary)', opacity: 0.7 }} />
            <span style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.5)' }}>
              Takes 10 seconds
            </span>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
