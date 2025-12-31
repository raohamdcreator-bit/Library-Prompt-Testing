// src/components/EnhancedBadge.jsx - Production Ready Component
import React from 'react';
import { Sparkles, Check, Brain, Zap, Code, Cpu } from 'lucide-react';

/**
 * EnhancedBadge Component
 * Displays a visual indicator that a prompt has been AI-enhanced
 * 
 * @param {boolean} enhanced - Whether the prompt is enhanced
 * @param {string} enhancedFor - Target AI model (claude, chatgpt, cursor, gemini, copilot, general)
 * @param {string} enhancementType - Type of enhancement applied
 * @param {string} size - Badge size ('sm' | 'md' | 'lg')
 * @param {boolean} showDetails - Whether to show enhancement details on hover
 */
const EnhancedBadge = ({ 
  enhanced = false, 
  enhancedFor = 'general',
  enhancementType = 'general',
  size = 'md',
  showDetails = true 
}) => {
  if (!enhanced) return null;

  const modelInfo = {
    general: { icon: Sparkles, name: 'Universal', color: '#8b5cf6' },
    claude: { icon: Brain, name: 'Claude', color: '#d97706' },
    chatgpt: { icon: Zap, name: 'ChatGPT', color: '#10b981' },
    cursor: { icon: Code, name: 'Cursor', color: '#3b82f6' },
    gemini: { icon: Sparkles, name: 'Gemini', color: '#ec4899' },
    copilot: { icon: Cpu, name: 'Copilot', color: '#6366f1' },
  };

  const model = modelInfo[enhancedFor] || modelInfo.general;
  const ModelIcon = model.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <div className="relative inline-flex group">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all duration-200 ${sizeClasses[size]}`}
        style={{
          backgroundColor: `${model.color}20`,
          border: `1px solid ${model.color}40`,
          color: model.color,
        }}
      >
        <Check className={iconSizes[size]} />
        <span>Enhanced</span>
        <ModelIcon className={iconSizes[size]} style={{ opacity: 0.8 }} />
      </div>

      {showDetails && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50"
          style={{
            backgroundColor: 'rgba(17, 19, 24, 0.98)',
            border: `1px solid ${model.color}40`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold" style={{ color: model.color }}>
              <Sparkles className="w-3 h-3" />
              <span>AI Enhanced Prompt</span>
            </div>
            <div className="text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-400">Target Model:</span>
              <ModelIcon className="w-3 h-3" style={{ color: model.color }} />
              <span>{model.name}</span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">Enhancement:</span> {enhancementType}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${model.color}40`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default EnhancedBadge;
export { EnhancedBadge };
