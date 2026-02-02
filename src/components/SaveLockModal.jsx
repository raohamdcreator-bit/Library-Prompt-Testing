// src/components/SaveLockModal.jsx - REFACTORED: Shows value, clear messaging
import { X, Zap, Shield, Clock, Sparkles, FileText } from 'lucide-react';

/**
 * ✅ REFACTORED Save Lock Modal
 * - Shows accumulated work value
 * - Clear messaging based on trigger context
 * - Trust indicators
 * - Easy dismissal (no guilt)
 */
export default function SaveLockModal({ 
  isOpen, 
  onClose, 
  onSignup, 
  onContinueWithout,
  workSummary,
  modalContext,
}) {
  if (!isOpen) return null;

  // ✅ Get trigger-specific messaging
  const getMessage = () => {
    if (!modalContext) {
      return {
        title: "Don't lose this work",
        subtitle: "Create a free account to save your prompts",
      };
    }

    switch (modalContext.trigger) {
      case 'prompt_limit':
        return {
          title: "You're on a roll! 🎉",
          subtitle: `You've created ${modalContext.promptCount} prompts. Save them to your account?`,
        };
      case 'first_enhancement':
        return {
          title: "Great enhancement!",
          subtitle: "Save your optimized prompts so you can use them anytime",
        };
      case 'export_attempt':
        return {
          title: "Ready to export?",
          subtitle: "Create an account first to export your prompts",
        };
      default:
        return {
          title: "Don't lose this work",
          subtitle: "Create a free account to save your prompts",
        };
    }
  };

  const { title, subtitle } = getMessage();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ 
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card relative w-full max-w-md mx-4"
        style={{
          padding: '2rem',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="action-btn-premium absolute top-4 right-4"
          style={{ width: '32px', height: '32px' }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
            borderRadius: '14px',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <Shield size={28} style={{ color: 'var(--primary)' }} />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--foreground)',
            textAlign: 'center',
            marginBottom: '0.5rem',
            lineHeight: '1.2',
          }}
        >
          {title}
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '0.938rem',
            color: 'rgba(228, 228, 231, 0.7)',
            textAlign: 'center',
            marginBottom: '1.5rem',
            lineHeight: '1.5',
          }}
        >
          {subtitle}
        </p>

        {/* ✅ NEW: Work Summary */}
        {workSummary && (workSummary.promptCount > 0 || workSummary.enhancementCount > 0) && (
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--foreground)' }}>
                What you'll save:
              </span>
            </div>
            
            <div style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.7)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {workSummary.promptCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={14} style={{ color: 'var(--primary)' }} />
                  <span>
                    <strong style={{ color: 'var(--foreground)' }}>{workSummary.promptCount}</strong>{' '}
                    {workSummary.promptCount === 1 ? 'prompt' : 'prompts'}
                  </span>
                </div>
              )}
              
              {workSummary.enhancementCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={14} style={{ color: 'var(--primary)' }} />
                  <span>
                    <strong style={{ color: 'var(--foreground)' }}>{workSummary.enhancementCount}</strong>{' '}
                    {workSummary.enhancementCount === 1 ? 'enhancement' : 'enhancements'}
                  </span>
                </div>
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
            padding: '0.875rem 1rem',
            fontSize: '0.938rem',
            fontWeight: '600',
            justifyContent: 'center',
          }}
        >
          <Shield size={18} />
          <span>Save & create free account</span>
        </button>

        {/* Secondary CTA */}
        <button
          onClick={onContinueWithout}
          className="btn-secondary w-full"
          style={{
            padding: '0.875rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            justifyContent: 'center',
          }}
        >
          Continue without saving
        </button>

        {/* Trust Indicators */}
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(139, 92, 246, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Zap size={13} style={{ color: 'rgba(139, 92, 246, 0.7)' }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(228, 228, 231, 0.5)' }}>
              100% Free
            </span>
          </div>
          <span style={{ color: 'rgba(228, 228, 231, 0.2)' }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Shield size={13} style={{ color: 'rgba(139, 92, 246, 0.7)' }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(228, 228, 231, 0.5)' }}>
              No credit card
            </span>
          </div>
          <span style={{ color: 'rgba(228, 228, 231, 0.2)' }}>•</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Clock size={13} style={{ color: 'rgba(139, 92, 246, 0.7)' }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(228, 228, 231, 0.5)' }}>
              10 seconds
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
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
