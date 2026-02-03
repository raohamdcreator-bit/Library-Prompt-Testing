// src/components/AIPromptEnhancer.jsx
// AI-powered prompt enhancement modal with strategic save triggers

import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Loader2, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { useGuestMode } from '../context/GuestModeContext';
import { isDemoPrompt } from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';

export default function AIPromptEnhancer({ 
  prompt, 
  onApply, 
  onClose,
  teamId,
  updatePrompt,
}) {
  const { isGuest, checkSaveRequired, canEditPrompt } = useGuestMode();
  
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedEnhancement, setSelectedEnhancement] = useState('clarity');

  const canEnhance = canEditPrompt(prompt);
  const isDemo = isDemoPrompt(prompt);

  const enhancementOptions = [
    {
      id: 'clarity',
      name: 'Improve Clarity',
      description: 'Make the prompt clearer and more specific',
      icon: '🎯',
    },
    {
      id: 'detail',
      name: 'Add Detail',
      description: 'Expand with more context and examples',
      icon: '📝',
    },
    {
      id: 'structure',
      name: 'Better Structure',
      description: 'Organize into logical sections',
      icon: '🏗️',
    },
    {
      id: 'professional',
      name: 'More Professional',
      description: 'Refine tone and language',
      icon: '💼',
    },
    {
      id: 'concise',
      name: 'Make Concise',
      description: 'Shorten while keeping key points',
      icon: '✂️',
    },
  ];

  const handleEnhance = async () => {
    if (!canEnhance) {
      setError('This prompt cannot be enhanced. Try "Make My Own" first.');
      return;
    }

    setEnhancing(true);
    setError(null);
    setResult(null);

    try {
      const option = enhancementOptions.find(opt => opt.id === selectedEnhancement);
      
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.text,
          enhancementType: selectedEnhancement,
          currentTitle: prompt.title,
          currentTags: prompt.tags || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Enhancement failed. Please try again.');
      }

      const data = await response.json();
      
      setResult({
        original: prompt.text,
        enhanced: data.enhancedText,
        title: data.suggestedTitle || prompt.title,
        tags: data.suggestedTags || prompt.tags,
        enhancementType: selectedEnhancement,
        improvements: data.improvements || [],
      });

      if (window.gtag) {
        window.gtag('event', 'prompt_enhancement_generated', {
          enhancement_type: selectedEnhancement,
          is_guest: isGuest,
          prompt_length: prompt.text.length,
        });
      }
    } catch (err) {
      console.error('Enhancement error:', err);
      setError(err.message || 'Failed to enhance prompt. Please try again.');
    } finally {
      setEnhancing(false);
    }
  };

  const handleApplyEnhancement = async () => {
    if (!result?.enhanced) return;

    const enhancedPrompt = {
      ...prompt,
      text: result.enhanced,
      title: result.title,
      tags: result.tags,
      enhanced: true,
      enhancedAt: new Date().toISOString(),
      enhancedFor: result.enhancementType,
    };

    checkSaveRequired('enhance_prompt', async () => {
      try {
        if (isGuest) {
          const updateResult = guestState.updatePrompt(
            prompt.id, 
            enhancedPrompt, 
            true
          );

          if (updateResult.success) {
            showNotification('Enhancement applied!', 'success');
            
            if (window.gtag) {
              window.gtag('event', 'prompt_enhanced', {
                enhancement_type: result.enhancementType,
                enhancement_count: guestState.getWorkSummary().enhancementCount,
                is_first_enhancement: guestState.getWorkSummary().enhancementCount === 1,
              });
            }

            onApply(enhancedPrompt);
            onClose();
          } else {
            showNotification('Failed to apply enhancement', 'error');
          }
        } else {
          await updatePrompt(teamId, prompt.id, enhancedPrompt);
          showNotification('Enhancement saved!', 'success');
          
          if (window.gtag) {
            window.gtag('event', 'prompt_enhanced', {
              enhancement_type: result.enhancementType,
              user_authenticated: true,
            });
          }

          onApply(enhancedPrompt);
          onClose();
        }
      } catch (err) {
        console.error('Apply enhancement error:', err);
        showNotification('Failed to apply enhancement', 'error');
      }
    });
  };

  const handleCopyEnhanced = async () => {
    if (!result?.enhanced) return;

    try {
      await navigator.clipboard.writeText(result.enhanced);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      if (window.gtag) {
        window.gtag('event', 'enhanced_text_copied', {
          enhancement_type: result.enhancementType,
        });
      }
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  const showNotification = (message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  return (
    <div className="ai-enhancer-overlay" onClick={onClose}>
      <div className="ai-enhancer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="enhancer-header">
          <div className="header-title">
            <Sparkles size={20} />
            <h2>AI Prompt Enhancer</h2>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {isDemo && (
          <div className="demo-warning">
            <AlertCircle size={16} />
            <div>
              <strong>This is a demo prompt</strong>
              <p>Click "Make My Own" first to create an editable copy you can enhance.</p>
            </div>
          </div>
        )}

        {!result && (
          <div className="enhancement-options">
            <label className="section-label">Choose Enhancement Type:</label>
            <div className="options-grid">
              {enhancementOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedEnhancement(option.id)}
                  className={`option-card ${selectedEnhancement === option.id ? 'selected' : ''}`}
                  disabled={!canEnhance}
                >
                  <span className="option-icon">{option.icon}</span>
                  <div className="option-content">
                    <span className="option-name">{option.name}</span>
                    <span className="option-description">{option.description}</span>
                  </div>
                  {selectedEnhancement === option.id && (
                    <Check size={16} className="selected-check" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="prompt-section">
          <label className="section-label">Original Prompt:</label>
          <div className="prompt-display original">
            <p>{prompt.text}</p>
          </div>
        </div>

        {result && (
          <div className="prompt-section">
            <label className="section-label">
              Enhanced Prompt:
              <button 
                onClick={handleCopyEnhanced}
                className="copy-btn"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </label>
            <div className="prompt-display enhanced">
              <p>{result.enhanced}</p>
            </div>

            {result.improvements && result.improvements.length > 0 && (
              <div className="improvements-section">
                <label className="section-label">
                  <Zap size={14} />
                  Key Improvements:
                </label>
                <ul className="improvements-list">
                  {result.improvements.map((improvement, index) => (
                    <li key={index}>{improvement}</li>
                  ))}
                </ul>
              </div>
            )}

            {(result.title !== prompt.title || result.tags !== prompt.tags) && (
              <div className="suggestions-section">
                <label className="section-label">Suggested Changes:</label>
                {result.title !== prompt.title && (
                  <div className="suggestion">
                    <strong>Title:</strong> {result.title}
                  </div>
                )}
                {result.tags && result.tags.length > 0 && (
                  <div className="suggestion">
                    <strong>Tags:</strong>{' '}
                    {result.tags.map((tag, i) => (
                      <span key={i} className="tag-badge">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="enhancer-actions">
          {!result ? (
            <>
              <button 
                onClick={onClose} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleEnhance}
                className="btn-primary"
                disabled={enhancing || !canEnhance}
              >
                {enhancing ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Enhance Prompt
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
                Try Different
              </button>
              <button 
                onClick={handleApplyEnhancement}
                className="btn-primary"
              >
                <Check size={16} />
                Apply Enhancement
              </button>
            </>
          )}
        </div>

        {isGuest && !isDemo && (
          <div className="guest-info">
            <p>
              <Sparkles size={12} />
              Your enhancement will be saved in this session. 
              Sign up to keep it permanently!
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .ai-enhancer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9998;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        .ai-enhancer-modal {
          background: var(--card-bg, #1a1a1a);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 16px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 2rem;
          animation: slideUp 0.3s ease-out;
        }

        .enhancer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-title h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--foreground, #fff);
          margin: 0;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 1);
        }

        .demo-warning {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 10px;
          margin-bottom: 1.5rem;
          color: rgba(251, 191, 36, 0.9);
        }

        .demo-warning strong {
          display: block;
          margin-bottom: 0.25rem;
          color: rgba(251, 191, 36, 1);
        }

        .demo-warning p {
          margin: 0;
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground, #fff);
          margin-bottom: 0.75rem;
        }

        .enhancement-options {
          margin-bottom: 1.5rem;
        }

        .options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }

        .option-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .option-card:not(:disabled):hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(139, 92, 246, 0.4);
          transform: translateY(-2px);
        }

        .option-card.selected {
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.5);
        }

        .option-card:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .option-icon {
          font-size: 1.5rem;
        }

        .option-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .option-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--foreground, #fff);
        }

        .option-description {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.4;
        }

        .selected-check {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          color: var(--primary, #8b5cf6);
        }

        .prompt-section {
          margin-bottom: 1.5rem;
        }

        .copy-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 6px;
          font-size: 0.75rem;
          color: var(--primary, #8b5cf6);
          cursor: pointer;
          transition: all 0.2s;
          margin-left: auto;
        }

        .copy-btn:hover {
          background: rgba(139, 92, 246, 0.2);
        }

        .prompt-display {
          padding: 1rem;
          border-radius: 10px;
          font-size: 0.938rem;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .prompt-display.original {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
        }

        .prompt-display.enhanced {
          background: rgba(139, 92, 246, 0.05);
          border: 1px solid rgba(139, 92, 246, 0.2);
          color: rgba(255, 255, 255, 0.9);
        }

        .improvements-section {
          margin-top: 1rem;
        }

        .improvements-list {
          margin: 0;
          padding-left: 1.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
        }

        .improvements-list li {
          margin-bottom: 0.5rem;
        }

        .suggestions-section {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(139, 92, 246, 0.05);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 8px;
        }

        .suggestion {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .suggestion:last-child {
          margin-bottom: 0;
        }

        .tag-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          margin: 0 0.25rem 0.25rem 0;
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--primary, #8b5cf6);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: rgba(239, 68, 68, 0.9);
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .enhancer-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .btn-secondary,
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.938rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .btn-secondary:disabled,
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        .guest-info {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(139, 92, 246, 0.05);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 8px;
          text-align: center;
        }

        .guest-info p {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 0.813rem;
          color: rgba(255, 255, 255, 0.7);
        }

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

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .ai-enhancer-modal {
            padding: 1.5rem;
          }

          .options-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
