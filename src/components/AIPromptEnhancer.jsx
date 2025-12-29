// src/components/AIPromptEnhancer.jsx - Professional UI with Icons
import { useState } from "react";
import { 
  X, 
  Sparkles, 
  Settings, 
  Palette, 
  Search, 
  FileText, 
  BookOpen,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  Save
} from "lucide-react";

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
      icon: Sparkles,
      description: "Improve clarity, structure, and effectiveness",
    },
    {
      id: "technical",
      name: "Technical Optimization",
      icon: Settings,
      description: "Add technical specs, constraints, and precision",
    },
    {
      id: "creative",
      name: "Creative Expansion",
      icon: Palette,
      description: "Enhance creativity, style, and descriptive elements",
    },
    {
      id: "analytical",
      name: "Analytical Depth",
      icon: Search,
      description: "Add reasoning, analysis, and structured thinking",
    },
    {
      id: "concise",
      name: "Concise Version",
      icon: FileText,
      description: "Simplify while maintaining clarity",
    },
    {
      id: "detailed",
      name: "Detailed Expansion",
      icon: BookOpen,
      description: "Add comprehensive details and examples",
    },
  ];

  async function handleEnhance() {
    if (!prompt?.text) {
      setError("No prompt text to enhance");
      return;
    }

    if (loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Enhancement failed");
      }

      setResult(data);
      showNotification("Prompt enhanced successfully!", "success");
    } catch (err) {
      console.error("Enhancement error:", err);
      const errorMessage = err.message || "Failed to enhance prompt";
      setError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.innerHTML = `<div>${message}</div>`;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-[9999] text-sm transition-opacity duration-300";
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
      showNotification("Enhanced prompt applied!", "success");
      if (onClose) onClose();
    }
  }

  function handleSaveAsNew() {
    if (result?.enhanced) {
      const { id, teamId, createdAt, createdBy, ...promptData } = prompt;

      onSaveAsNew({
        ...promptData,
        text: result.enhanced,
        title: `${prompt.title} (AI Enhanced)`,
      });
      showNotification("Saved as new prompt!", "success");
      if (onClose) onClose();
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div 
          className="flex-shrink-0 p-6 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <Sparkles 
                  className="w-5 h-5" 
                  style={{ color: "var(--primary-foreground)" }}
                />
              </div>
              <div>
                <h2 
                  className="text-xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  AI Prompt Enhancement
                </h2>
                <p 
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Powered by Open Source AI Models
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Enhancement Type Selection */}
          <div>
            <label 
              className="block text-sm font-medium mb-3"
              style={{ color: "var(--foreground)" }}
            >
              Select Enhancement Type:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {enhancementTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setEnhancementType(type.id)}
                    disabled={loading}
                    className="p-4 rounded-lg border-2 transition-all duration-200 text-left disabled:opacity-50"
                    style={{
                      borderColor: enhancementType === type.id 
                        ? "var(--primary)" 
                        : "var(--border)",
                      backgroundColor: enhancementType === type.id
                        ? "var(--secondary)"
                        : "transparent",
                    }}
                  >
                    <Icon 
                      className="w-6 h-6 mb-2"
                      style={{ 
                        color: enhancementType === type.id 
                          ? "var(--primary)" 
                          : "var(--muted-foreground)"
                      }}
                    />
                    <div 
                      className="font-semibold text-sm mb-1"
                      style={{ color: "var(--foreground)" }}
                    >
                      {type.name}
                    </div>
                    <div 
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {type.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Original Prompt */}
          <div 
            className="glass-card p-4 rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 
              className="font-semibold mb-2 flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <FileText className="w-4 h-4" />
              Original Prompt:
            </h3>
            <div 
              className="p-3 rounded-lg border max-h-48 overflow-y-auto"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              <pre 
                className="whitespace-pre-wrap text-sm"
                style={{ color: "var(--foreground)" }}
              >
                {prompt?.text || "No prompt text"}
              </pre>
            </div>
            <div 
              className="mt-2 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {prompt?.text?.length || 0} characters
            </div>
          </div>

          {/* Enhance Button */}
          {!result && !loading && (
            <button
              onClick={handleEnhance}
              disabled={loading || !prompt?.text}
              className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              <span>Enhance Prompt with AI</span>
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div 
              className="glass-card p-6 rounded-xl border text-center"
              style={{
                borderColor: "var(--primary)",
                backgroundColor: "var(--secondary)",
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <Loader2 
                  className="w-12 h-12 animate-spin"
                  style={{ color: "var(--primary)" }}
                />
                <div>
                  <p 
                    className="font-medium mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    Enhancing with AI...
                  </p>
                  <p 
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    This may take 5-10 seconds
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && !loading && (
            <div 
              className="glass-card p-4 rounded-xl border-2"
              style={{
                borderColor: "var(--destructive)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle 
                  className="w-6 h-6 flex-shrink-0"
                  style={{ color: "var(--destructive)" }}
                />
                <div className="flex-1">
                  <h4 
                    className="font-semibold mb-1"
                    style={{ color: "var(--destructive)" }}
                  >
                    Enhancement Failed
                  </h4>
                  <p 
                    className="text-sm mb-3"
                    style={{ color: "var(--destructive)" }}
                  >
                    {error}
                  </p>
                  <button
                    onClick={handleEnhance}
                    className="btn-secondary text-sm px-4 py-2"
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
              <div 
                className="glass-card p-4 rounded-xl border-2"
                style={{
                  borderColor: "var(--primary)",
                  backgroundColor: "var(--secondary)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-semibold flex items-center gap-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Check className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    <span>Enhanced Prompt:</span>
                  </h3>
                  <span 
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                  >
                    {result.provider?.toUpperCase() || "AI"}
                  </span>
                </div>
                <div 
                  className="p-3 rounded-lg border max-h-64 overflow-y-auto"
                  style={{
                    backgroundColor: "var(--muted)",
                    borderColor: "var(--border)",
                  }}
                >
                  <pre 
                    className="whitespace-pre-wrap text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    {result.enhanced}
                  </pre>
                </div>
                <div 
                  className="mt-2 flex items-center justify-between text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <span>{result.enhanced?.length || 0} characters</span>
                  {prompt?.text && (
                    <span style={{ color: "var(--primary)" }}>
                      {result.enhanced.length > prompt.text.length ? "+" : ""}
                      {result.enhanced.length - prompt.text.length} chars
                    </span>
                  )}
                </div>
              </div>

              {/* Improvements List */}
              {result.improvements && result.improvements.length > 0 && (
                <div 
                  className="glass-card p-4 rounded-xl border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h3 
                    className="font-semibold mb-3 flex items-center gap-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Check className="w-4 h-4" />
                    Applied Improvements:
                  </h3>
                  <ul className="space-y-2">
                    {result.improvements.map((improvement, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check 
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{ color: "var(--primary)" }}
                        />
                        <span style={{ color: "var(--foreground)" }}>
                          {improvement}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApply}
                  className="flex-1 btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Apply Enhanced Prompt
                </button>
                <button
                  onClick={handleSaveAsNew}
                  className="flex-1 btn-secondary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
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
            <div 
              className="text-xs space-y-1 border-t pt-4"
              style={{
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
              }}
            >
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

        {/* Fixed Footer */}
        <div 
          className="flex-shrink-0 p-4 border-t"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--muted)",
          }}
        >
          <div className="flex justify-between items-center text-xs">
            <div style={{ color: "var(--muted-foreground)" }}>
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Tip: Try different enhancement types for varied results
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="btn-secondary px-4 py-2 disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
