// src/components/AIPromptEnhancer.jsx - FIXED: Guest mode enhancement with temporary demo changes
import { useState } from "react";
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useGuestMode } from '../context/GuestModeContext';
import { isDemoPrompt } from '../lib/guestDemoContent';
import { updateDemoPrompt } from '../lib/demoPromptManager';
import { guestState } from '../lib/guestState';
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
  Save,
  Cpu,
  Code,
  Brain,
  Zap,
  Bot,
  Globe,
  Feather,
  Shield,
} from "lucide-react";

export default function AIPromptEnhancer({
  prompt,
  onApply,
  onSaveAsNew,
  onClose,
}) {
  const [targetModel, setTargetModel] = useState("general");
  const [enhancementType, setEnhancementType] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { playNotification, playEnhancement } = useSoundEffects();
  const { isGuest, triggerSaveModal } = useGuestMode();
  
  const aiModels = [
    {
      id: "general",
      name: "Universal",
      icon: Globe,
      description: " Optimized for all AI models",
      color: "#8b5cf6",
    },
    {
      id: "claude",
      name: "Claude",
      icon: Brain,
      description: " Contextual, reasoning-focused",
      color: "#d97706",
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      icon: Zap,
      description: " Structured, role-based",
      color: "#10b981",
    },
    {
      id: "cursor",
      name: "Cursor",
      icon: Code,
      description: " Developer-optimized",
      color: "#3b82f6",
    },
    {
      id: "gemini",
      name: "Gemini",
      icon: Sparkles,
      description: " Concise, task-focused",
      color: "#ec4899",
    },
    {
      id: "copilot",
      name: "Copilot",
      icon: Bot,
      description: " Code completion focus",
      color: "#6366f1",
    },
  ];

  const enhancementTypes = [
    {
      id: "general",
      name: "General Enhancement",
      icon: Feather,
      description: "Improve clarity, structure, and effectiveness",
    },
    {
      id: "technical",
      name: "Technical Optimization",
      icon: Cpu,
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
          targetModel,
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
      playEnhancement();
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
    if (!result?.enhanced) return;

    const modelName = aiModels.find(m => m.id === targetModel)?.name || targetModel;
    const cleanTitle = prompt.title.replace(/\s*(Enhanced for [^)]+)\s*/g, '').trim();
    
    const enhancedPrompt = {
      ...prompt,
      text: result.enhanced,
      title: `${cleanTitle} (Enhanced for ${modelName})`,
      enhanced: true,
      enhancedFor: targetModel,
      enhancementType: enhancementType,
      enhancedAt: new Date().toISOString(),
    };

    // ✅ DEMO PROMPT: Always trigger save modal (BLOCKING)
    if (isGuest && isDemoPrompt(prompt)) {
      console.log('🔒 Demo prompt enhancement - triggering save modal');
      
      triggerSaveModal(
        enhancedPrompt,
        () => {
          // ✅ This ONLY runs after successful signup
          onApply(enhancedPrompt);
          showNotification("Enhancement saved to your account!", "success");
          if (onClose) onClose();
        }
      );

      // ✅ CRITICAL: Return immediately - DON'T apply anything until signup
      return;
    }

    // ✅ GUEST USER PROMPT: Update in guestState + show reminder
    if (isGuest && !isDemoPrompt(prompt)) {
      try {
        guestState.updatePrompt(prompt.id, enhancedPrompt);
        onApply(enhancedPrompt);
        showNotification("Enhancement saved! Sign up to keep your work.", "success");
        if (onClose) onClose();
        return;
      } catch (error) {
        console.error("Error updating guest prompt:", error);
        showNotification("Failed to save enhancement", "error");
        return;
      }
    }

    // ✅ AUTHENTICATED: Apply directly
    onApply(enhancedPrompt);
    showNotification("Enhanced prompt applied!", "success");
    if (onClose) onClose();
  }

  function handleSaveAsNew() {
    if (!result?.enhanced) return;

    const { id, teamId, createdAt, createdBy, ...promptData } = prompt;
    const modelName = aiModels.find(m => m.id === targetModel)?.name || targetModel;
    const cleanTitle = prompt.title.replace(/\s*\(Enhanced for [^)]+\)\s*/g, '').trim();

    const newPrompt = {
      ...promptData,
      text: result.enhanced,
      title: `${cleanTitle} (Enhanced for ${modelName})`,
      enhanced: true,
      enhancedFor: targetModel,
      enhancementType: enhancementType,
      enhancedAt: new Date().toISOString(),
    };

    // ✅ DEMO PROMPT: Always trigger save modal (BLOCKING)
    if (isGuest && isDemoPrompt(prompt)) {
      console.log('🔒 Saving enhanced demo as new - triggering save modal');
      
      triggerSaveModal(
        newPrompt,
        () => {
          // ✅ This ONLY runs after successful signup
          onSaveAsNew(newPrompt);
          showNotification("Saved to your account!", "success");
          if (onClose) onClose();
        }
      );
      
      // ✅ CRITICAL: Return immediately - DON'T save anything until signup
      return;
    }
    
    // ✅ GUEST USER PROMPT: Add to guestState
    if (isGuest && !isDemoPrompt(prompt)) {
      try {
        const savedPrompt = guestState.addPrompt(newPrompt);
        onSaveAsNew(savedPrompt);
        showNotification("Saved as new! Sign up to keep your work.", "success");
        if (onClose) onClose();
        return;
      } catch (error) {
        console.error("Error saving guest prompt:", error);
        showNotification("Failed to save as new", "error");
        return;
      }
    }

    // ✅ AUTHENTICATED: Save directly
    onSaveAsNew(newPrompt);
    showNotification("Saved as new prompt!", "success");
    if (onClose) onClose();
  }

  const selectedModel = aiModels.find(m => m.id === targetModel);

  return (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl border"
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
                  Model-Specific Optimization • Powered by Open Source AI
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

          {/* ✅ Guest Mode Warning for Demo Prompts */}
          {isGuest && isDemoPrompt(prompt) && (
            <div 
              className="mt-4 p-3 rounded-lg border flex items-start gap-2"
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                borderColor: 'rgba(139, 92, 246, 0.3)',
              }}
            >
              <AlertCircle size={18} style={{ color: 'var(--primary)', marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', marginBottom: '0.25rem', fontWeight: '500' }}>
                  Demo Prompt Enhancement
                </p>
                <p style={{ fontSize: '0.813rem', color: 'rgba(228, 228, 231, 0.7)' }}>
                  Changes are temporary. Create a free account to save your version.
                </p>
              </div>
              <Shield size={16} style={{ color: 'var(--primary)' }} />
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target AI Model Selection */}
          <div>
            <label 
              className="block text-sm font-medium mb-3"
              style={{ color: "var(--foreground)" }}
            >
              <Cpu className="w-4 h-4 inline mr-2" />
              Select Target AI Model:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {aiModels.map((model) => {
                const Icon = model.icon;
                return (
                  <button
                    key={model.id}
                    onClick={() => setTargetModel(model.id)}
                    disabled={loading}
                    className="p-4 rounded-lg border-2 transition-all duration-200 text-left disabled:opacity-50 hover:scale-105"
                    style={{
                      borderColor: targetModel === model.id 
                        ? model.color
                        : "var(--border)",
                      backgroundColor: targetModel === model.id
                        ? `${model.color}15`
                        : "transparent",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon 
                        className="w-6 h-6"
                        style={{ 
                          color: targetModel === model.id 
                            ? model.color
                            : "var(--muted-foreground)"
                        }}
                      />
                      {targetModel === model.id && (
                        <Check className="w-4 h-4" style={{ color: model.color }} />
                      )}
                    </div>
                    <div 
                      className="font-semibold text-sm mb-1"
                      style={{ color: "var(--foreground)" }}
                    >
                      {model.name}
                    </div>
                    <div 
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {model.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enhancement Type Selection */}
          <div>
            <label 
              className="block text-sm font-medium mb-3"
              style={{ color: "var(--foreground)" }}
            >
              <Settings className="w-4 h-4 inline mr-2" />
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
              <span>Enhance for {selectedModel?.name || "AI"}</span>
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
                    Enhancing for {selectedModel?.name}...
                  </p>
                  <p 
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Applying {enhancementType} optimization • This may take 5-10 seconds
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
                  borderColor: selectedModel?.color || "var(--primary)",
                  backgroundColor: "var(--secondary)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-semibold flex items-center gap-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    <Check className="w-4 h-4" style={{ color: selectedModel?.color || "var(--primary)" }} />
                    <span>Enhanced Prompt:</span>
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span 
                      className="text-xs px-3 py-1 rounded-full font-semibold"
                      style={{
                        backgroundColor: selectedModel?.color || "var(--primary)",
                        color: "white",
                      }}
                    >
                      ✓ Enhanced
                    </span>
                    <span 
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: `${selectedModel?.color || "var(--primary)"}20`,
                        color: selectedModel?.color || "var(--primary)",
                      }}
                    >
                      {selectedModel?.name}
                    </span>
                  </div>
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
                  className="mt-2 flex items-center justify-between text-xs flex-wrap gap-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <span>{result.enhanced?.length || 0} characters</span>
                  {prompt?.text && (
                    <span style={{ color: selectedModel?.color || "var(--primary)" }}>
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
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleApply}
                  className="flex-1 min-w-[200px] btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {isGuest && isDemoPrompt(prompt) ? "Sign up to Apply" : "Apply Enhanced Prompt"}
                </button>
                <button
                  onClick={handleSaveAsNew}
                  className="flex-1 min-w-[200px] btn-secondary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isGuest && isDemoPrompt(prompt) ? "Sign up to Save" : "Save as New Prompt"}
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
                  Enhance Again
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
              <div className="flex items-center gap-2">
                <span className="font-semibold">Enhancement Details:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>Provider: {result.provider}</div>
                <div>Model: {result.model}</div>
                <div>Target: {selectedModel?.name || targetModel}</div>
                <div>Type: {result.metadata.enhancementType}</div>
              </div>
              <div className="mt-2">
                Processed: {new Date(result.metadata.timestamp).toLocaleString()}
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
          <div className="flex justify-between items-center text-xs flex-wrap gap-3">
            <div style={{ color: "var(--muted-foreground)" }}>
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {isGuest ? (
                isDemoPrompt(prompt) ? (
                  <span>Demo prompt: Changes are temporary. Sign up to save your version.</span>
                ) : (
                  <span>Guest mode: Changes saved to session until you sign up</span>
                )
              ) : (
                <span>Tip: Select target AI model first, then choose enhancement type for best results</span>
              )}
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
