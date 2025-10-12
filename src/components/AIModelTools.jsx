// src/components/AIModelTools.jsx - Updated with futuristic AI theme
import { useState, useEffect, useMemo } from "react";

// AI Model configurations
export const AI_MODELS = {
  "gpt-4": {
    name: "GPT-4",
    provider: "OpenAI",
    maxTokens: 8192,
    costPer1kTokens: 0.03,
    strengths: ["Reasoning", "Code", "Analysis"],
    color: "green",
    emoji: "🧠",
  },
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    maxTokens: 128000,
    costPer1kTokens: 0.01,
    strengths: ["Long context", "Speed", "Efficiency"],
    color: "blue",
    emoji: "⚡",
  },
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    maxTokens: 4096,
    costPer1kTokens: 0.002,
    strengths: ["Speed", "Cost-effective", "General use"],
    color: "cyan",
    emoji: "💨",
  },
  "claude-3-opus": {
    name: "Claude 3 Opus",
    provider: "Anthropic",
    maxTokens: 200000,
    costPer1kTokens: 0.015,
    strengths: ["Long context", "Analysis", "Writing"],
    color: "orange",
    emoji: "📚",
  },
  "claude-3-sonnet": {
    name: "Claude 3 Sonnet",
    provider: "Anthropic",
    maxTokens: 200000,
    costPer1kTokens: 0.003,
    strengths: ["Balanced", "Reasoning", "Code"],
    color: "purple",
    emoji: "🎯",
  },
  "claude-3-haiku": {
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    maxTokens: 200000,
    costPer1kTokens: 0.00025,
    strengths: ["Speed", "Cost-effective", "Simple tasks"],
    color: "teal",
    emoji: "🚀",
  },
  "gemini-pro": {
    name: "Gemini Pro",
    provider: "Google",
    maxTokens: 32768,
    costPer1kTokens: 0.0005,
    strengths: ["Multimodal", "Fast", "Cost-effective"],
    color: "red",
    emoji: "🌟",
  },
};

// Token estimation utility
export class TokenEstimator {
  static estimateTokens(text, model = "gpt-4") {
    if (!text) return 0;

    const charPerTokenRatio = {
      "gpt-4": 4,
      "gpt-4-turbo": 4,
      "gpt-3.5-turbo": 4,
      "claude-3-opus": 3.8,
      "claude-3-sonnet": 3.8,
      "claude-3-haiku": 3.8,
      "gemini-pro": 4.2,
    };

    const ratio = charPerTokenRatio[model] || 4;
    return Math.ceil(text.length / ratio);
  }

  static estimateCost(text, model = "gpt-4") {
    const tokens = this.estimateTokens(text, model);
    const modelConfig = AI_MODELS[model];
    if (!modelConfig) return 0;

    return (tokens / 1000) * modelConfig.costPer1kTokens;
  }

  static fitsInContext(text, model = "gpt-4") {
    const tokens = this.estimateTokens(text, model);
    const modelConfig = AI_MODELS[model];
    if (!modelConfig) return false;

    return tokens <= modelConfig.maxTokens;
  }

  static getRecommendations(text) {
    const tokens = this.estimateTokens(text);
    const recommendations = [];

    if (tokens <= 4096) {
      recommendations.push({
        model: "gpt-3.5-turbo",
        reason: "Most cost-effective for short prompts",
        priority: 1,
      });
      recommendations.push({
        model: "claude-3-haiku",
        reason: "Fastest and cheapest Anthropic model",
        priority: 2,
      });
    }

    if (tokens <= 32768) {
      recommendations.push({
        model: "gemini-pro",
        reason: "Good balance of capabilities and cost",
        priority: 3,
      });
      recommendations.push({
        model: "claude-3-sonnet",
        reason: "Excellent reasoning at moderate cost",
        priority: 4,
      });
    }

    if (tokens > 32768) {
      recommendations.push({
        model: "claude-3-opus",
        reason: "Best for complex, long-context tasks",
        priority: 1,
      });
      recommendations.push({
        model: "gpt-4-turbo",
        reason: "OpenAI's longest context model",
        priority: 2,
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }
}

// Token counter component
export function TokenCounter({
  text,
  selectedModels = ["gpt-4", "claude-3-sonnet"],
  className = "",
}) {
  const stats = useMemo(() => {
    return selectedModels.map((model) => {
      const modelConfig = AI_MODELS[model];
      const tokens = TokenEstimator.estimateTokens(text, model);
      const cost = TokenEstimator.estimateCost(text, model);
      const fits = TokenEstimator.fitsInContext(text, model);

      return {
        model,
        name: modelConfig?.name || model,
        provider: modelConfig?.provider || "Unknown",
        emoji: modelConfig?.emoji || "🤖",
        tokens,
        cost,
        fits,
        maxTokens: modelConfig?.maxTokens || 0,
        color: modelConfig?.color || "gray",
      };
    });
  }, [text, selectedModels]);

  if (!text || text.trim().length === 0) {
    return (
      <div className={`text-xs ${className}`} style={{ color: "var(--muted-foreground)" }}>
        No text to analyze
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-medium mb-2" style={{ color: "var(--foreground)" }}>
        💫 Token Analysis:
      </div>
      <div className="grid grid-cols-1 gap-2">
        {stats.map((stat, index) => (
          <div
            key={stat.model}
            className="px-3 py-2 rounded-lg border transition-all duration-300 hover:border-primary/50 hover:scale-105"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              animation: `fadeIn 0.3s ease-out ${index * 0.1}s backwards`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{stat.emoji}</span>
                <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                  {stat.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono" style={{ color: "var(--foreground)" }}>
                  {stat.tokens.toLocaleString()}
                </span>
                {!stat.fits && <span className="text-lg">⚠️</span>}
              </div>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span className="font-mono">${stat.cost.toFixed(4)}</span>
              <span>
                {((stat.tokens / stat.maxTokens) * 100).toFixed(1)}% used
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Model compatibility component
export function ModelCompatibility({ text, className = "" }) {
  const compatibility = useMemo(() => {
    const results = Object.entries(AI_MODELS).map(([modelId, config]) => {
      const tokens = TokenEstimator.estimateTokens(text, modelId);
      const cost = TokenEstimator.estimateCost(text, modelId);
      const fits = TokenEstimator.fitsInContext(text, modelId);
      const usage = (tokens / config.maxTokens) * 100;

      return {
        modelId,
        config,
        tokens,
        cost,
        fits,
        usage,
        score: fits ? 100 - usage + (cost < 0.01 ? 20 : 0) : 0,
      };
    });

    return results.sort((a, b) => b.score - a.score);
  }, [text]);

  const recommendations = useMemo(() => {
    return TokenEstimator.getRecommendations(text);
  }, [text]);

  if (!text || text.trim().length === 0) {
    return null;
  }

  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎯</span>
        <h4 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
          AI Model Compatibility
        </h4>
      </div>

      {/* Model Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {compatibility.map(({ modelId, config, tokens, cost, fits, usage }, index) => (
          <div
            key={modelId}
            className={`p-4 rounded-lg border-2 transition-all duration-300 hover:scale-105 ${
              fits ? "border-green-500/30" : "border-red-500/30"
            }`}
            style={{
              backgroundColor: fits ? "var(--card)" : "var(--destructive)/10",
              animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.emoji}</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {config.name}
                </span>
              </div>
              <div
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ${
                  fits ? "btn-primary" : "btn-danger"
                }`}
              >
                {fits ? "✓ Compatible" : "✗ Too Large"}
              </div>
            </div>

            <div className="text-sm space-y-2" style={{ color: "var(--foreground)" }}>
              <div className="flex justify-between">
                <span style={{ color: "var(--muted-foreground)" }}>Tokens:</span>
                <span className="font-mono">
                  {tokens.toLocaleString()} / {config.maxTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--muted-foreground)" }}>Cost:</span>
                <span className="font-mono">${cost.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--muted-foreground)" }}>Provider:</span>
                <span>{config.provider}</span>
              </div>
            </div>

            {/* Usage bar with animation */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                <span>Context Usage</span>
                <span className="font-medium">{usage.toFixed(1)}%</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ backgroundColor: "var(--muted)" }}>
                <div
                  className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                    usage > 90
                      ? "bg-red-500"
                      : usage > 70
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ 
                    width: `${Math.min(usage, 100)}%`,
                    animation: "slideRight 1s ease-out",
                  }}
                ></div>
              </div>
            </div>

            {/* Model strengths */}
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {config.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="text-xs px-2 py-0.5 rounded-full transition-all duration-200 hover:scale-110"
                    style={{
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h5 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <span>💡</span>
            <span>Recommendations</span>
          </h5>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div
                key={rec.model}
                className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 hover:scale-105 hover:border-primary/50"
                style={{
                  backgroundColor: "var(--secondary)",
                  borderColor: "var(--border)",
                  animation: `fadeIn 0.3s ease-out ${0.5 + index * 0.1}s backwards`,
                }}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-transform duration-300 hover:scale-110 ${
                    index === 0
                      ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                      : index === 1
                      ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white"
                      : "bg-gradient-to-br from-orange-400 to-red-500 text-white"
                  }`}
                >
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                </div>
                <div className="flex-1">
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>
                    {AI_MODELS[rec.model]?.emoji} {AI_MODELS[rec.model]?.name || rec.model}
                  </div>
                  <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    {rec.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Model selector with stats
export function ModelSelector({
  selectedModels,
  onSelectionChange,
  text,
  className = "",
}) {
  const handleModelToggle = (modelId) => {
    const newSelection = selectedModels.includes(modelId)
      ? selectedModels.filter((id) => id !== modelId)
      : [...selectedModels, modelId];

    onSelectionChange(newSelection);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h4 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
        <span>🎛️</span>
        <span>Select Models for Comparison</span>
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(AI_MODELS).map(([modelId, config], index) => {
          const isSelected = selectedModels.includes(modelId);
          const tokens = text
            ? TokenEstimator.estimateTokens(text, modelId)
            : 0;
          const fits = text
            ? TokenEstimator.fitsInContext(text, modelId)
            : true;

          return (
            <label
              key={modelId}
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:border-primary/50 ${
                isSelected ? "border-primary" : ""
              }`}
              style={{
                backgroundColor: isSelected ? "var(--primary)/10" : "var(--card)",
                borderColor: isSelected ? "var(--primary)" : "var(--border)",
                animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleModelToggle(modelId)}
                className="mr-3 w-4 h-4 cursor-pointer"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.emoji}</span>
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>
                      {config.name}
                    </span>
                  </div>
                  {text && !fits && (
                    <span className="text-red-500 text-xs font-medium">⚠️ Too large</span>
                  )}
                </div>
                <div className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {config.provider} • ${config.costPer1kTokens}/1K tokens
                </div>
                {text && (
                  <div className="text-xs font-mono mt-1" style={{ color: "var(--muted-foreground)" }}>
                    ~{tokens.toLocaleString()} tokens
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Compact AI tools component for prompt cards
export function CompactAITools({ text, className = "" }) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedModels, setSelectedModels] = useState([
    "gpt-4",
    "claude-3-sonnet",
  ]);

  const stats = useMemo(() => {
    if (!text) return null;

    const tokens = TokenEstimator.estimateTokens(text, "gpt-4");
    const cost = TokenEstimator.estimateCost(text, "gpt-4");
    const recommendations = TokenEstimator.getRecommendations(text);

    return {
      tokens,
      cost,
      bestModel: recommendations[0]?.model || "gpt-4",
      compatibleModels: Object.keys(AI_MODELS).filter((model) =>
        TokenEstimator.fitsInContext(text, model)
      ).length,
    };
  }, [text]);

  if (!text || !stats) {
    return (
      <div className={className}>
        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          No text to analyze
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <span className="text-xl">🤖</span>
            <span>AI Model Analysis</span>
          </h4>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="btn-secondary text-sm px-3 py-1 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            {showDetails ? "▲ Hide" : "▼ Show"} Details
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
          <div className="p-2 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <span className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              💫 Tokens (GPT-4)
            </span>
            <span className="font-mono font-bold text-lg" style={{ color: "var(--foreground)" }}>
              {stats.tokens.toLocaleString()}
            </span>
          </div>
          <div className="p-2 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <span className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              💰 Est. Cost
            </span>
            <span className="font-mono font-bold text-lg" style={{ color: "var(--foreground)" }}>
              ${stats.cost.toFixed(4)}
            </span>
          </div>
          <div className="p-2 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <span className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              ✅ Compatible
            </span>
            <span className="font-mono font-bold text-lg" style={{ color: "var(--foreground)" }}>
              {stats.compatibleModels}/7
            </span>
          </div>
          <div className="p-2 rounded-lg border" style={{ backgroundColor: "var(--muted)", borderColor: "var(--border)" }}>
            <span className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              🎯 Best Model
            </span>
            <span className="font-bold text-sm" style={{ color: "var(--foreground)" }}>
              {AI_MODELS[stats.bestModel]?.emoji} {AI_MODELS[stats.bestModel]?.name?.split(" ")[0] || "GPT-4"}
            </span>
          </div>
        </div>

        {showDetails && (
          <div 
            className="space-y-4 border-t pt-4" 
            style={{ 
              borderColor: "var(--border)",
              animation: "fadeIn 0.3s ease-out",
            }}
          >
            <TokenCounter text={text} selectedModels={selectedModels} />

            <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <ModelSelector
                selectedModels={selectedModels}
                onSelectionChange={setSelectedModels}
                text={text}
              />
            </div>

            <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <ModelCompatibility text={text} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add keyframe animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideRight {
      from { width: 0; }
      to { width: var(--final-width); }
    }
  `;
  if (!document.querySelector('style[data-ai-model-tools-styles]')) {
    style.setAttribute('data-ai-model-tools-styles', 'true');
    document.head.appendChild(style);
  }
}
