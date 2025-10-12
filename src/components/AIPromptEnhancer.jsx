// src/components/AIPromptEnhancer.jsx - FIXED VERSION (No Infinite Loop + Unique IDs)
import { useState } from "react";

export default function AIPromptEnhancer({
  prompt,
  onApply,
  onSaveAsNew,
  onClose,
}) {
  const [enhancementType, setEnhancementType] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const enhancementTypes = [
    {
      id: "general",
      name: "General Enhancement",
      icon: "✨",
      description: "Improve clarity, structure, and effectiveness",
    },
    {
      id: "technical",
      name: "Technical Optimization",
      icon: "⚙️",
      description: "Add technical specs, constraints, and precision",
    },
    {
      id: "creative",
      name: "Creative Expansion",
      icon: "🎨",
      description: "Enhance creativity, style, and descriptive elements",
    },
    {
      id: "analytical",
      name: "Analytical Depth",
      icon: "🔍",
      description: "Add reasoning, analysis, and structured thinking",
    },
    {
      id: "concise",
      name: "Concise Version",
      icon: "📝",
      description: "Simplify while maintaining clarity",
    },
    {
      id: "detailed",
      name: "Detailed Expansion",
      icon: "📚",
      description: "Add comprehensive details and examples",
    },
  ];

  // ✅ FIXED: Manual enhancement - user must click button
  async function handleEnhance() {
    if (!prompt?.text) {
      setError("No prompt text to enhance");
      return;
    }

    // Prevent multiple simultaneous requests
    if (loading) {
      console.log("⏸️ Already processing, please wait...");
      return;
    }

    console.log("🚀 Starting AI enhancement...");
    console.log("📝 Prompt text:", prompt?.text?.substring(0, 100) + "...");
    console.log("🎯 Enhancement type:", enhancementType);

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("📡 Sending request to /api/enhance-prompt...");

      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.text,
          enhancementType,
          context: {
            title: prompt.title,
            tags: prompt.tags,
          },
        }),
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response OK:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`
        );
      }

      const data = await response.json();
      console.log("📊 Response received:", {
        success: data.success,
        hasEnhanced: !!data.enhanced,
        provider: data.provider,
      });

      if (!data.success) {
        throw new Error(data.error || "Enhancement failed");
      }

      console.log("✅ Enhancement successful!");
      console.log("📏 Original length:", prompt.text.length);
      console.log("📏 Enhanced length:", data.enhanced.length);

      setResult(data);
      showNotification("✨ Prompt enhanced successfully!", "success");
    } catch (err) {
      console.error("❌ Enhancement error:", err);
      const errorMessage = err.message || "Failed to enhance prompt";
      setError(errorMessage);
      showNotification(`❌ ${errorMessage}`, "error");
    } finally {
      setLoading(false);
    }
  }

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.innerHTML = `<div>${message}</div>`;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${type === "error" ? "destructive" : "primary"});
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  function handleApply() {
    if (result?.enhanced) {
      onApply({ ...prompt, text: result.enhanced });
      showNotification("✅ Enhanced prompt applied!", "success");
      if (onClose) onClose();
    }
  }

  function handleSaveAsNew() {
    if (result?.enhanced) {
      // ✅ FIXED: Create a new object WITHOUT the id, teamId, or timestamp fields
      const { id, teamId, createdAt, createdBy, ...promptData } = prompt;

      onSaveAsNew({
        ...promptData,
        text: result.enhanced,
        title: `${prompt.title} (AI Enhanced)`,
      });
      showNotification("✅ Saved as new prompt!", "success");
      if (onClose) onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="glass-card rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  AI Prompt Enhancement
                </h2>
                <p className="text-sm text-slate-400">
                  Powered by Open Source AI Models
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Enhancement Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-100 mb-3">
              Select Enhancement Type:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {enhancementTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setEnhancementType(type.id)}
                  disabled={loading}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-left disabled:opacity-50 ${
                    enhancementType === type.id
                      ? "border-cyan-400 bg-cyan-500/20"
                      : "border-white/10 hover:border-cyan-400/50 bg-white/5"
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <div className="font-semibold text-slate-100 text-sm mb-1">
                    {type.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Original Prompt */}
          <div className="glass-card p-4 rounded-xl border border-white/10">
            <h3 className="font-semibold text-slate-100 mb-2">
              Original Prompt:
            </h3>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-slate-200">
                {prompt?.text || "No prompt text"}
              </pre>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {prompt?.text?.length || 0} characters
            </div>
          </div>

          {/* Enhance Button - Only show if no result yet */}
          {!result && !loading && (
            <button
              onClick={handleEnhance}
              disabled={loading || !prompt?.text}
              className="w-full neo-btn btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>✨</span>
              <span>Enhance Prompt with AI</span>
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div className="glass-card p-6 rounded-xl border border-cyan-400/50 bg-cyan-500/10 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="neo-spinner w-12 h-12"></div>
                <div>
                  <p className="text-slate-100 font-medium mb-1">
                    Enhancing with AI...
                  </p>
                  <p className="text-slate-400 text-sm">
                    This may take 5-10 seconds
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && !loading && (
            <div className="glass-card p-4 rounded-xl border-2 border-red-500/50 bg-red-500/10">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-300 mb-1">
                    Enhancement Failed
                  </h4>
                  <p className="text-sm text-red-200 mb-3">{error}</p>
                  <button
                    onClick={handleEnhance}
                    className="text-sm bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && !loading && (
            <>
              {/* Enhanced Prompt */}
              <div className="glass-card p-4 rounded-xl border-2 border-green-500/50 bg-green-500/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-300 flex items-center gap-2">
                    <span>✨</span>
                    <span>Enhanced Prompt:</span>
                  </h3>
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">
                    {result.provider?.toUpperCase() || "AI"}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-green-700/30 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">
                    {result.enhanced}
                  </pre>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{result.enhanced?.length || 0} characters</span>
                  {prompt?.text && (
                    <span className="text-green-400">
                      {result.enhanced.length > prompt.text.length ? "+" : ""}
                      {result.enhanced.length - prompt.text.length} chars
                    </span>
                  )}
                </div>
              </div>

              {/* Improvements List */}
              {result.improvements && result.improvements.length > 0 && (
                <div className="glass-card p-4 rounded-xl border border-white/10">
                  <h3 className="font-semibold text-slate-100 mb-3">
                    🎯 Applied Improvements:
                  </h3>
                  <ul className="space-y-2">
                    {result.improvements.map((improvement, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span className="text-slate-300">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApply}
                  className="flex-1 neo-btn btn-primary py-3 text-sm font-semibold"
                >
                  Apply Enhanced Prompt
                </button>
                <button
                  onClick={handleSaveAsNew}
                  className="flex-1 neo-btn btn-secondary py-3 text-sm font-semibold"
                >
                  Save as New Prompt
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                  className="px-6 py-3 text-sm font-semibold rounded-lg border transition-colors"
                  style={{
                    backgroundColor: "var(--secondary)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  Try Different Type
                </button>
              </div>
            </>
          )}

          {/* Metadata Display */}
          {result?.metadata && (
            <div className="text-xs text-slate-500 space-y-1 border-t border-white/10 pt-4">
              <div>
                Provider: {result.provider} • Model: {result.model}
              </div>
              <div>Enhancement Type: {result.metadata.enhancementType}</div>
              <div>
                Processed:{" "}
                {new Date(result.metadata.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <div>
              💡 Tip: Try different enhancement types for varied results
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="neo-btn btn-secondary px-4 py-2 disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
