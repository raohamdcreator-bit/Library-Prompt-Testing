// src/components/OnboardingExperience.jsx - FIXED: Works without teams for guests
import { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  Zap, 
  FileText, 
  Star,
  X,
} from 'lucide-react';
import { DEMO_PROMPTS } from '../lib/guestDemoContent';

/**
 * ✅ FIXED: Onboarding Experience for Guests
 * - No team dependency
 * - Demos stored in sessionStorage only
 * - Works for both guests and authenticated users
 * - For guests: Educational experience
 * - For auth users: Adds prompts to their team
 */
export default function OnboardingExperience({ 
  onComplete, 
  onSkip, 
  userName,
  teamId, // Optional - only for authenticated users
  onCreateExamples, // Optional - only for authenticated users
  isGuest = false, // ✅ NEW: Distinguish guest vs auth onboarding
}) {
  const [step, setStep] = useState(1);
  const [selectedPrompts, setSelectedPrompts] = useState(new Set([0, 1, 2])); // Pre-select first 3
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(null);

  const totalSteps = 2;

  const handleTogglePrompt = (index) => {
    setSelectedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  /**
   * ✅ FIXED: Handle example creation differently for guests vs auth users
   */
  const handleCreateExamples = async () => {
    setIsCreating(true);
    
    const selectedExamples = DEMO_PROMPTS.filter((_, index) => 
      selectedPrompts.has(index)
    );

    try {
      if (isGuest) {
        // ✅ GUESTS: Demos already loaded in sessionStorage
        // Just track interaction and proceed
        if (window.gtag) {
          window.gtag('event', 'demo_prompts_viewed', {
            count: selectedExamples.length,
            user_type: 'guest',
          });
        }
        
        // No backend operation needed
        setStep(2);
      } else {
        // ✅ AUTHENTICATED: Save to their team (existing behavior)
        if (onCreateExamples && teamId) {
          await onCreateExamples(selectedExamples);
        }
        setStep(2);
      }
    } catch (error) {
      console.error("Error in onboarding:", error);
      alert("Failed to proceed. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(10, 13, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div 
        className="w-full max-w-4xl glass-card"
        style={{
          borderRadius: '24px',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div 
          className="p-6 md:p-8 border-b"
          style={{
            borderColor: 'var(--border)',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)',
            flexShrink: 0,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                }}
              >
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {isGuest 
                    ? "Welcome to Prism! 👋" 
                    : `Welcome to Prism, ${userName?.split(' ')[0] || 'there'}! 👋`
                  }
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {isGuest 
                    ? "Explore example prompts to see how teams collaborate"
                    : "Let's get you started in less than a minute"
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-sm hover:underline"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Skip
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className="flex-1 h-2 rounded-full transition-all duration-300"
                style={{
                  background: index < step 
                    ? 'var(--primary)' 
                    : 'rgba(139, 92, 246, 0.1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div 
          className="p-6 md:p-8 overflow-y-auto"
          style={{ flex: 1 }}
        >
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  {isGuest ? "Explore Demo Prompts" : "Start with Ready-to-Use Examples"}
                </h3>
                <p style={{ color: 'var(--muted-foreground)' }}>
                  {isGuest 
                    ? "See how professional prompts are structured. You can edit these to experiment!"
                    : "Select example prompts to add to your team. You can customize them later!"
                  }
                </p>
              </div>

              {/* Example Prompts Grid */}
              <div className="grid md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                {DEMO_PROMPTS.map((prompt, index) => {
                  const isSelected = selectedPrompts.has(index);
                  
                  return (
                    <div
                      key={index}
                      onClick={() => handleTogglePrompt(index)}
                      className="relative p-4 rounded-xl cursor-pointer transition-all duration-200"
                      style={{
                        background: isSelected 
                          ? 'rgba(139, 92, 246, 0.1)' 
                          : 'var(--card)',
                        border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      {/* Selection Indicator */}
                      <div 
                        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: isSelected ? 'var(--primary)' : 'var(--border)',
                          color: isSelected ? 'white' : 'transparent',
                        }}
                      >
                        {isSelected && <Check size={16} />}
                      </div>

                      {/* Category Badge */}
                      <div className="tag-chip-premium mb-2">
                        {prompt.category}
                      </div>

                      <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                        {prompt.title}
                      </h4>
                      
                      <p 
                        className="text-sm mb-3"
                        style={{ 
                          color: 'var(--muted-foreground)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {prompt.text}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {prompt.tags.slice(0, 3).map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: 'rgba(139, 92, 246, 0.05)',
                              color: 'var(--muted-foreground)',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Preview Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPreview(index);
                        }}
                        className="absolute bottom-3 right-3 action-btn-premium"
                        style={{ width: '32px', height: '32px' }}
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Selection Summary */}
              <div 
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Star size={20} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--foreground)' }}>
                    <strong>{selectedPrompts.size}</strong> example{selectedPrompts.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (selectedPrompts.size === DEMO_PROMPTS.length) {
                      setSelectedPrompts(new Set());
                    } else {
                      setSelectedPrompts(new Set(DEMO_PROMPTS.map((_, i) => i)));
                    }
                  }}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  {selectedPrompts.size === DEMO_PROMPTS.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateExamples}
                  disabled={selectedPrompts.size === 0 || isCreating}
                  className="btn-premium flex-1"
                  style={{
                    opacity: selectedPrompts.size === 0 ? 0.5 : 1,
                    cursor: selectedPrompts.size === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isCreating ? (
                    <>
                      <div className="neo-spinner" />
                      {isGuest ? "Loading..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      {isGuest ? "Start Exploring" : "Add Examples & Continue"}
                      <ArrowRight size={20} className="btn-arrow" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center space-y-6 py-8">
              {/* Success Animation */}
              <div className="flex justify-center mb-6">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center pulse-glow"
                  style={{
                    background: 'var(--primary)',
                    animation: 'scaleIn 0.5s ease-out',
                  }}
                >
                  <Check size={40} color="white" />
                </div>
              </div>

              <h3 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {isGuest ? "You're Ready to Explore! 🎉" : "You're All Set! 🎉"}
              </h3>
              
              <p className="text-lg max-w-md mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                {isGuest 
                  ? `You can now explore ${selectedPrompts.size} demo prompt${selectedPrompts.size !== 1 ? 's' : ''}. Edit them, copy them, and see how teams collaborate!`
                  : `We've added ${selectedPrompts.size} example prompt${selectedPrompts.size !== 1 ? 's' : ''} to your team. Feel free to customize them or create your own!`
                }
              </p>

              {/* Quick Tips */}
              <div 
                className="text-left max-w-lg mx-auto p-6 rounded-xl space-y-4"
                style={{
                  background: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                }}
              >
                <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                  <Zap size={18} style={{ color: 'var(--primary)' }} />
                  {isGuest ? "What You Can Do:" : "Quick Tips to Get Started:"}
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    <span>
                      {isGuest 
                        ? "Edit demo prompts to experiment (changes won't be saved)"
                        : "Click any prompt to expand and see AI enhancement options"
                      }
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    <span>
                      {isGuest 
                        ? "Copy prompts to use in your AI tools (ChatGPT, Claude, etc.)"
                        : "Use the copy button to quickly use prompts in your AI tools"
                      }
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    <span>
                      {isGuest 
                        ? "Sign up to create your own prompts and save your work"
                        : "Invite team members to collaborate on prompt development"
                      }
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    <span>
                      {isGuest 
                        ? "Demo prompts reset on refresh - they're just for exploration!"
                        : "Track prompt performance with built-in analytics"
                      }
                    </span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleComplete}
                className="btn-premium px-8 py-4"
              >
                {isGuest ? "Start Exploring" : "Start Building"}
                <ArrowRight size={20} className="btn-arrow" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
          }}
          onClick={() => setShowPreview(null)}
        >
          <div 
            className="w-full max-w-2xl glass-card p-6"
            style={{ borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                {DEMO_PROMPTS[showPreview].title}
              </h3>
              <button
                onClick={() => setShowPreview(null)}
                className="action-btn-premium"
              >
                <X size={20} />
              </button>
            </div>
            
            <div 
              className="p-4 rounded-lg mb-4 font-mono text-sm whitespace-pre-wrap"
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                maxHeight: '400px',
                overflowY: 'auto',
                color: 'var(--foreground)',
              }}
            >
              {DEMO_PROMPTS[showPreview].text}
            </div>

            <div className="flex flex-wrap gap-2">
              {DEMO_PROMPTS[showPreview].tags.map((tag, index) => (
                <span key={index} className="tag-chip-premium">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
