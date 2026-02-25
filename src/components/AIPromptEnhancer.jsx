// src/components/AIPromptEnhancer.jsx — Redesigned UI
import { useState } from "react";
import { authFetch } from "../../services/api"; // ← replaces plain fetch()
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useGuestMode } from '../context/GuestModeContext';
import { isDemoPrompt } from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';
import {
  X, Sparkles, Settings, Palette, Search, FileText, BookOpen,
  Check, AlertCircle, Loader2, Copy, Save, Cpu, Code, Brain,
  Zap, Bot, Globe, Feather, Shield, ChevronRight, ArrowRight,
} from "lucide-react";

const aiModels = [
  { id: "general", name: "Universal",  icon: Globe,   color: "#8b5cf6", desc: "All AI models" },
  { id: "claude",  name: "Claude",     icon: Brain,   color: "#f59e0b", desc: "Reasoning-focused" },
  { id: "chatgpt", name: "ChatGPT",    icon: Zap,     color: "#10b981", desc: "Role-based structure" },
  { id: "cursor",  name: "Cursor",     icon: Code,    color: "#3b82f6", desc: "Developer-optimised" },
  { id: "gemini",  name: "Gemini",     icon: Sparkles,color: "#ec4899", desc: "Task-focused" },
  { id: "copilot", name: "Copilot",    icon: Bot,     color: "#6366f1", desc: "Code completion" },
];

const enhancementTypes = [
  { id: "general",    name: "General",    icon: Feather,   desc: "Clarity & structure" },
  { id: "technical",  name: "Technical",  icon: Cpu,       desc: "Specs & precision" },
  { id: "creative",   name: "Creative",   icon: Palette,   desc: "Style & expression" },
  { id: "analytical", name: "Analytical", icon: Search,    desc: "Reasoning & depth" },
  { id: "concise",    name: "Concise",    icon: FileText,  desc: "Lean & clear" },
  { id: "detailed",   name: "Detailed",   icon: BookOpen,  desc: "Comprehensive" },
];

export default function AIPromptEnhancer({ prompt, onApply, onSaveAsNew, onClose }) {
  const [targetModel, setTargetModel]         = useState("general");
  const [enhancementType, setEnhancementType] = useState("general");
  const [loading, setLoading]                 = useState(false);
  const [result, setResult]                   = useState(null);
  const [error, setError]                     = useState(null);
  const [copied, setCopied]                   = useState(false);
  const { playNotification, playEnhancement } = useSoundEffects();
  const { isGuest, triggerSaveModal }         = useGuestMode();

  const selectedModel    = aiModels.find(m => m.id === targetModel);
  const selectedTypeObj  = enhancementTypes.find(t => t.id === enhancementType);

  function notify(message, type = "info") {
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = `
      position:fixed;top:1.25rem;right:1.25rem;z-index:99999;
      padding:.625rem 1rem;border-radius:8px;font-size:.813rem;font-weight:500;
      background:var(--card);color:var(--foreground);
      border:1px solid ${type === "error" ? "var(--destructive)" : "var(--primary)"};
      box-shadow:0 8px 24px rgba(0,0,0,.35);
      animation:toastSlideIn .25s ease-out;
    `;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
  }

  async function handleEnhance() {
    if (!prompt?.text || loading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      // ── FIX: use authFetch so the Firebase ID token is sent automatically ──
      const res = await authFetch("/api/enhance-prompt", {
        method: "POST",
        body: JSON.stringify({
          prompt: prompt.text,
          enhancementType,
          targetModel,
          context: { title: prompt.title, tags: prompt.tags },
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`); }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Enhancement failed");
      setResult(data);
      playEnhancement();
    } catch (err) {
      setError(err.message || "Failed to enhance prompt");
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyResult() {
    if (!result?.enhanced) return;
    await navigator.clipboard.writeText(result.enhanced);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function buildEnhancedPrompt(base) {
    const modelName  = aiModels.find(m => m.id === targetModel)?.name || targetModel;
    const cleanTitle = base.title.replace(/\s*\(Enhanced for [^)]+\)\s*/g, "").trim();
    return {
      ...base,
      text: result.enhanced,
      title: `${cleanTitle} (Enhanced for ${modelName})`,
      enhanced: true,
      enhancedFor: targetModel,
      enhancementType,
      enhancedAt: new Date().toISOString(),
    };
  }

  function handleApply() {
    if (!result?.enhanced) return;
    const enhanced = buildEnhancedPrompt(prompt);
    if (isGuest && isDemoPrompt(prompt)) {
      triggerSaveModal(enhanced, () => { onApply(enhanced); onClose?.(); });
      return;
    }
    if (isGuest) {
      guestState.updatePrompt(prompt.id, enhanced);
      onApply(enhanced);
      onClose?.();
      return;
    }
    onApply(enhanced);
    onClose?.();
  }

  function handleSaveAsNew() {
    if (!result?.enhanced) return;
    const { id, teamId, createdAt, createdBy, ...base } = prompt;
    const newP = buildEnhancedPrompt(base);
    if (isGuest && isDemoPrompt(prompt)) {
      triggerSaveModal(newP, () => { onSaveAsNew(newP); onClose?.(); });
      return;
    }
    if (isGuest) {
      const saved = guestState.addPrompt(newP);
      onSaveAsNew(saved);
      onClose?.();
      return;
    }
    onSaveAsNew(newP);
    onClose?.();
  }

  const charDiff = result ? result.enhanced.length - (prompt?.text?.length || 0) : 0;

  return (
    <>
      <style>{`
        .aie-overlay {
          position:fixed;inset:0;z-index:9998;
          display:flex;align-items:center;justify-content:center;padding:1rem;
          background:rgba(0,0,0,.72);backdrop-filter:blur(6px);
          animation:aieOverlayIn .2s ease-out;
        }
        @keyframes aieOverlayIn { from{opacity:0} to{opacity:1} }

        .aie-shell {
          width:100%;max-width:820px;max-height:92vh;
          display:flex;flex-direction:column;
          background:var(--card);
          border:1px solid rgba(139,92,246,.18);
          border-radius:20px;
          box-shadow:0 32px 80px rgba(0,0,0,.55),0 0 0 1px rgba(139,92,246,.08);
          overflow:hidden;
          animation:aieShellIn .25s cubic-bezier(.4,0,.2,1);
        }
        @keyframes aieShellIn { from{opacity:0;transform:translateY(16px) scale(.98)} to{opacity:1;transform:none} }

        /* ── Header ── */
        .aie-header {
          display:flex;align-items:center;justify-content:space-between;
          padding:1.25rem 1.5rem 1rem;
          border-bottom:1px solid rgba(139,92,246,.1);
          flex-shrink:0;
        }
        .aie-header-left { display:flex;align-items:center;gap:.875rem; }
        .aie-icon-wrap {
          width:38px;height:38px;border-radius:10px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(139,92,246,.08));
          border:1px solid rgba(139,92,246,.25);
        }
        .aie-title { font-size:.95rem;font-weight:700;color:var(--foreground);letter-spacing:-.01em; }
        .aie-subtitle { font-size:.7rem;color:var(--muted-foreground);margin-top:.1rem; }
        .aie-close {
          width:32px;height:32px;border-radius:8px;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          background:transparent;color:var(--muted-foreground);
          transition:background .15s,color .15s;
        }
        .aie-close:hover { background:rgba(255,255,255,.07);color:var(--foreground); }
        .aie-close:disabled { opacity:.4;cursor:not-allowed; }

        /* ── Guest banner ── */
        .aie-guest-banner {
          margin:.75rem 1.5rem 0;padding:.625rem .875rem;
          border-radius:8px;border:1px solid rgba(139,92,246,.2);
          background:rgba(139,92,246,.07);
          display:flex;align-items:flex-start;gap:.625rem;
          font-size:.75rem;color:rgba(228,228,231,.75);
          flex-shrink:0;
        }
        .aie-guest-banner strong { color:var(--foreground);display:block;margin-bottom:.15rem; }

        /* ── Scrollable body ── */
        .aie-body {
          flex:1;overflow-y:auto;padding:1.25rem 1.5rem 1.5rem;
          display:flex;flex-direction:column;gap:1.25rem;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.25) transparent;
        }

        /* ── Section label ── */
        .aie-section-label {
          font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
          color:var(--muted-foreground);margin-bottom:.625rem;
          display:flex;align-items:center;gap:.4rem;
        }

        /* ── Model grid ── */
        .aie-model-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem; }
        @media(max-width:540px){ .aie-model-grid { grid-template-columns:repeat(2,1fr); } }

        .aie-model-btn {
          position:relative;padding:.625rem .75rem;border-radius:10px;
          border:1px solid var(--border);background:transparent;
          cursor:pointer;text-align:left;transition:all .15s;
          display:flex;flex-direction:column;gap:.3rem;
          overflow:hidden;
        }
        .aie-model-btn:hover { border-color:rgba(139,92,246,.35);background:rgba(255,255,255,.025); }
        .aie-model-btn.active { border-color:var(--model-color,var(--primary));background:rgba(var(--model-rgb,139,92,246),.08); }
        .aie-model-btn .model-row { display:flex;align-items:center;justify-content:space-between; }
        .aie-model-name { font-size:.8rem;font-weight:600;color:var(--foreground); }
        .aie-model-desc { font-size:.65rem;color:var(--muted-foreground); }
        .aie-model-check {
          width:16px;height:16px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          background:var(--model-color,var(--primary));flex-shrink:0;
        }
        .aie-model-btn:not(.active) .aie-model-check { display:none; }
        .aie-model-active-bar {
          position:absolute;left:0;top:0;bottom:0;width:3px;
          background:var(--model-color,var(--primary));border-radius:0 2px 2px 0;
          display:none;
        }
        .aie-model-btn.active .aie-model-active-bar { display:block; }

        /* ── Type grid ── */
        .aie-type-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem; }
        @media(max-width:540px){ .aie-type-grid { grid-template-columns:repeat(2,1fr); } }

        .aie-type-btn {
          padding:.5rem .625rem;border-radius:8px;
          border:1px solid var(--border);background:transparent;
          cursor:pointer;text-align:left;transition:all .15s;
          display:flex;align-items:center;gap:.5rem;
        }
        .aie-type-btn:hover { border-color:rgba(139,92,246,.3);background:rgba(255,255,255,.025); }
        .aie-type-btn.active {
          border-color:var(--primary);
          background:rgba(139,92,246,.1);
        }
        .aie-type-name { font-size:.78rem;font-weight:600;color:var(--foreground); }
        .aie-type-desc { font-size:.63rem;color:var(--muted-foreground);margin-top:.1rem; }

        /* ── Original prompt box ── */
        .aie-original {
          border:1px solid var(--border);border-radius:10px;overflow:hidden;
        }
        .aie-original-header {
          padding:.5rem .875rem;background:rgba(255,255,255,.02);
          border-bottom:1px solid var(--border);
          display:flex;align-items:center;justify-content:space-between;
        }
        .aie-original-label { font-size:.68rem;font-weight:600;color:var(--muted-foreground);text-transform:uppercase;letter-spacing:.04em; }
        .aie-original-chars { font-size:.65rem;color:var(--muted-foreground);font-variant-numeric:tabular-nums; }
        .aie-original-text {
          padding:.75rem .875rem;max-height:110px;overflow-y:auto;
          font-size:.8rem;line-height:1.6;color:rgba(228,228,231,.8);
          white-space:pre-wrap;word-break:break-word;
          font-family:'JetBrains Mono','Consolas',monospace;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
        }

        /* ── Enhance button ── */
        .aie-enhance-btn {
          width:100%;padding:1rem 1.25rem;border-radius:10px;border:none;cursor:pointer;
          font-size:.9rem;font-weight:700;letter-spacing:-.01em;
          min-height:52px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;gap:.625rem;
          background:linear-gradient(135deg,var(--primary) 0%,#7c3aed 100%);
          color:#fff;
          box-shadow:0 4px 20px rgba(139,92,246,.35);
          transition:box-shadow .2s,transform .2s;
        }
        .aie-enhance-btn:hover { transform:translateY(-1px);box-shadow:0 6px 28px rgba(139,92,246,.45); }
        .aie-enhance-btn:active { transform:none; }
        .aie-enhance-btn:disabled { opacity:.45;cursor:not-allowed;transform:none;box-shadow:none; }

        /* ── Loading state ── */
        .aie-loading {
          padding:2rem;text-align:center;
          border:1px solid rgba(139,92,246,.15);border-radius:12px;
          background:rgba(139,92,246,.04);
        }
        .aie-loading-ring {
          width:44px;height:44px;margin:0 auto .875rem;
          border-radius:50%;
          border:3px solid rgba(139,92,246,.15);
          border-top-color:var(--primary);
          animation:spin .75s linear infinite;
        }
        @keyframes spin { to{transform:rotate(360deg)} }
        .aie-loading-title { font-size:.875rem;font-weight:600;color:var(--foreground);margin-bottom:.3rem; }
        .aie-loading-sub { font-size:.75rem;color:var(--muted-foreground); }

        /* ── Error ── */
        .aie-error {
          padding:.875rem 1rem;border-radius:10px;
          border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.07);
          display:flex;gap:.75rem;align-items:flex-start;
        }
        .aie-error-text { font-size:.8rem;color:rgba(252,165,165,.9);flex:1; }
        .aie-error-title { font-size:.8rem;font-weight:700;color:#f87171;margin-bottom:.25rem; }

        /* ── Result ── */
        .aie-result {
          border-radius:12px;
          border:1px solid;
          animation:aieResultIn .3s ease-out;
        }
        @keyframes aieResultIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .aie-result-header {
          padding:.625rem .875rem;
          display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;
          border-radius:11px 11px 0 0;
        }
        .aie-result-header-left { display:flex;align-items:center;gap:.5rem; }
        .aie-result-check { width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center; }
        .aie-result-label { font-size:.75rem;font-weight:700;color:var(--foreground); }
        .aie-result-chips { display:flex;gap:.375rem;align-items:center; }
        .aie-chip {
          font-size:.63rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;letter-spacing:.02em;
        }
        .aie-result-text {
          padding:.875rem;
          max-height:260px;
          overflow-y:auto;
          overflow-x:hidden;
          font-size:.8rem;line-height:1.7;color:rgba(228,228,231,.9);
          white-space:pre-wrap;word-break:break-word;
          font-family:'JetBrains Mono','Consolas',monospace;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.35) transparent;
        }
        .aie-result-text::-webkit-scrollbar { width:5px; }
        .aie-result-text::-webkit-scrollbar-thumb { background:rgba(139,92,246,.35);border-radius:3px; }
        .aie-result-text::-webkit-scrollbar-track { background:transparent; }
        .aie-result-footer {
          padding:.5rem .875rem;border-top:1px solid rgba(255,255,255,.06);
          display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;
        }
        .aie-result-chars { font-size:.68rem;color:var(--muted-foreground);font-variant-numeric:tabular-nums; }
        .aie-copy-btn {
          display:flex;align-items:center;gap:.375rem;
          font-size:.7rem;font-weight:600;padding:.3rem .625rem;border-radius:6px;
          border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
          color:var(--muted-foreground);cursor:pointer;transition:all .15s;
        }
        .aie-copy-btn:hover { border-color:rgba(139,92,246,.35);color:var(--foreground); }

        /* ── Improvements ── */
        .aie-improvements { display:flex;flex-direction:column;gap:.375rem; }
        .aie-improvement-item {
          display:flex;align-items:flex-start;gap:.5rem;
          font-size:.76rem;color:rgba(228,228,231,.75);line-height:1.5;
          padding:.375rem 0;border-bottom:1px solid rgba(255,255,255,.04);
        }
        .aie-improvement-item:last-child { border-bottom:none; }
        .aie-imp-dot { width:5px;height:5px;border-radius:50%;background:var(--primary);margin-top:.45rem;flex-shrink:0; }

        /* ── Action row ── */
        .aie-actions { display:flex;gap:.625rem;flex-wrap:wrap; }
        .aie-btn-apply {
          flex:1;min-width:160px;padding:.75rem .875rem;border-radius:10px;border:none;cursor:pointer;
          font-size:.8rem;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:.5rem;
          background:var(--primary);color:#fff;
          transition:all .15s;
        }
        .aie-btn-apply:hover { background:var(--primary-hover);transform:translateY(-1px); }
        .aie-btn-save {
          flex:1;min-width:160px;padding:.75rem .875rem;border-radius:10px;cursor:pointer;
          font-size:.8rem;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:.5rem;
          background:transparent;color:var(--foreground);
          border:1px solid rgba(139,92,246,.3);transition:all .15s;
        }
        .aie-btn-save:hover { background:rgba(139,92,246,.08);border-color:rgba(139,92,246,.5); }
        .aie-btn-retry {
          padding:.75rem 1rem;border-radius:10px;cursor:pointer;
          font-size:.8rem;font-weight:600;
          background:transparent;color:var(--muted-foreground);
          border:1px solid var(--border);transition:all .15s;
        }
        .aie-btn-retry:hover { color:var(--foreground);border-color:rgba(255,255,255,.2); }

        /* ── Metadata strip ── */
        .aie-meta-strip {
          display:grid;grid-template-columns:repeat(2,1fr);gap:.375rem;
          padding:.625rem;border-radius:8px;
          background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);
          font-size:.68rem;color:var(--muted-foreground);
        }
        .aie-meta-row { display:flex;gap:.375rem;align-items:center; }
        .aie-meta-key { font-weight:600;color:rgba(228,228,231,.5); }
        .aie-meta-val { color:rgba(228,228,231,.75);font-variant-numeric:tabular-nums; }

        /* ── Footer ── */
        .aie-footer {
          padding:.75rem 1.5rem;border-top:1px solid rgba(139,92,246,.08);
          display:flex;align-items:center;justify-content:space-between;gap:1rem;
          flex-shrink:0;background:rgba(0,0,0,.15);flex-wrap:wrap;
        }
        .aie-footer-hint {
          font-size:.68rem;color:var(--muted-foreground);
          display:flex;align-items:center;gap:.375rem;flex:1;min-width:0;
        }
        .aie-footer-close {
          padding:.5rem 1rem;border-radius:8px;cursor:pointer;
          font-size:.78rem;font-weight:600;
          background:transparent;color:var(--muted-foreground);
          border:1px solid var(--border);transition:all .15s;flex-shrink:0;
        }
        .aie-footer-close:hover { color:var(--foreground);border-color:rgba(255,255,255,.2); }
        .aie-footer-close:disabled { opacity:.4;cursor:not-allowed; }
      `}</style>

      <div className="aie-overlay" onClick={onClose}>
        <div className="aie-shell" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="aie-header">
            <div className="aie-header-left">
              <div className="aie-icon-wrap">
                <Sparkles size={17} color="var(--primary)" />
              </div>
              <div>
                <div className="aie-title">AI Prompt Enhancement</div>
                <div className="aie-subtitle">Model-specific optimisation · Open Source AI</div>
              </div>
            </div>
            <button className="aie-close" onClick={onClose} disabled={loading}><X size={16} /></button>
          </div>

          {/* Guest banner */}
          {isGuest && isDemoPrompt(prompt) && (
            <div className="aie-guest-banner">
              <Shield size={14} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Demo Prompt</strong>
                Changes are temporary. Create a free account to save your version.
              </div>
            </div>
          )}

          {/* Body */}
          <div className="aie-body">

            {/* Target model */}
            <div>
              <div className="aie-section-label">
                <Cpu size={11} />Target AI Model
              </div>
              <div className="aie-model-grid">
                {aiModels.map(m => {
                  const Icon = m.icon;
                  const active = targetModel === m.id;
                  return (
                    <button
                      key={m.id}
                      disabled={loading}
                      onClick={() => setTargetModel(m.id)}
                      className={`aie-model-btn${active ? " active" : ""}`}
                      style={{ "--model-color": m.color }}
                    >
                      <div className="aie-model-active-bar" />
                      <div className="model-row">
                        <Icon size={14} color={active ? m.color : "var(--muted-foreground)"} />
                        {active && (
                          <div className="aie-model-check">
                            <Check size={9} color="#fff" />
                          </div>
                        )}
                      </div>
                      <div className="aie-model-name">{m.name}</div>
                      <div className="aie-model-desc">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enhancement type */}
            <div>
              <div className="aie-section-label">
                <Settings size={11} />Enhancement Type
              </div>
              <div className="aie-type-grid">
                {enhancementTypes.map(t => {
                  const Icon = t.icon;
                  const active = enhancementType === t.id;
                  return (
                    <button
                      key={t.id}
                      disabled={loading}
                      onClick={() => setEnhancementType(t.id)}
                      className={`aie-type-btn${active ? " active" : ""}`}
                    >
                      <Icon size={13} color={active ? "var(--primary)" : "var(--muted-foreground)"} style={{ flexShrink: 0 }} />
                      <div>
                        <div className="aie-type-name">{t.name}</div>
                        <div className="aie-type-desc">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Original prompt */}
            <div className="aie-original">
              <div className="aie-original-header">
                <span className="aie-original-label">Original Prompt</span>
                <span className="aie-original-chars">{prompt?.text?.length || 0} chars</span>
              </div>
              <div className="aie-original-text">{prompt?.text || "No prompt text"}</div>
            </div>

            {/* Enhance trigger */}
            {!result && !loading && (
              <button className="aie-enhance-btn" onClick={handleEnhance} disabled={loading || !prompt?.text}>
                <Sparkles size={16} />
                Enhance for {selectedModel?.name || "AI"}
                <ArrowRight size={15} />
              </button>
            )}

            {/* Loading */}
            {loading && (
              <div className="aie-loading">
                <div className="aie-loading-ring" />
                <div className="aie-loading-title">Enhancing for {selectedModel?.name}…</div>
                <div className="aie-loading-sub">
                  Applying {selectedTypeObj?.name.toLowerCase()} optimisation · 5–10 seconds
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="aie-error">
                <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div className="aie-error-title">Enhancement failed</div>
                  <div className="aie-error-text">{error}</div>
                  <button
                    onClick={handleEnhance}
                    style={{
                      marginTop: ".5rem", fontSize: ".75rem", fontWeight: 600,
                      padding: ".35rem .75rem", borderRadius: 6,
                      background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)",
                      color: "#f87171", cursor: "pointer",
                    }}
                  >Try again</button>
                </div>
              </div>
            )}

            {/* Result */}
            {result && !loading && (
              <>
                <div
                  className="aie-result"
                  style={{
                    borderColor: selectedModel?.color || "var(--primary)",
                    background: `${selectedModel?.color || "#8b5cf6"}08`,
                  }}
                >
                  <div
                    className="aie-result-header"
                    style={{ background: `${selectedModel?.color || "#8b5cf6"}10`, borderBottom: `1px solid ${selectedModel?.color || "var(--primary)"}22` }}
                  >
                    <div className="aie-result-header-left">
                      <div className="aie-result-check" style={{ background: selectedModel?.color || "var(--primary)" }}>
                        <Check size={10} color="#fff" />
                      </div>
                      <span className="aie-result-label">Enhanced Prompt</span>
                    </div>
                    <div className="aie-result-chips">
                      <span className="aie-chip" style={{ background: `${selectedModel?.color || "var(--primary)"}22`, color: selectedModel?.color || "var(--primary)" }}>
                        {selectedModel?.name}
                      </span>
                      <span className="aie-chip" style={{ background: "rgba(255,255,255,.06)", color: "var(--muted-foreground)" }}>
                        {selectedTypeObj?.name}
                      </span>
                    </div>
                  </div>
                  <div className="aie-result-text">{result.enhanced}</div>
                  <div className="aie-result-footer">
                    <div className="aie-result-chars">
                      {result.enhanced.length} chars
                      <span style={{ marginLeft: ".5rem", color: charDiff > 0 ? "#4ade80" : "#f87171" }}>
                        ({charDiff > 0 ? "+" : ""}{charDiff})
                      </span>
                    </div>
                    <button className="aie-copy-btn" onClick={handleCopyResult}>
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Improvements */}
                {result.improvements?.length > 0 && (
                  <div>
                    <div className="aie-section-label"><Check size={11} />Applied improvements</div>
                    <div className="aie-improvements">
                      {result.improvements.map((imp, i) => (
                        <div key={i} className="aie-improvement-item">
                          <div className="aie-imp-dot" />
                          <span>{imp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="aie-actions">
                  <button className="aie-btn-apply" onClick={handleApply}>
                    <Copy size={14} />
                    {isGuest && isDemoPrompt(prompt) ? "Sign up to Apply" : "Apply Enhancement"}
                  </button>
                  <button className="aie-btn-save" onClick={handleSaveAsNew}>
                    <Save size={14} />
                    {isGuest && isDemoPrompt(prompt) ? "Sign up to Save" : "Save as New"}
                  </button>
                  <button className="aie-btn-retry" onClick={() => { setResult(null); setError(null); }}>
                    Retry
                  </button>
                </div>

                {/* Metadata */}
                {result.metadata && (
                  <div className="aie-meta-strip">
                    {[
                      ["Provider", result.provider],
                      ["Model",    result.model],
                      ["Target",   selectedModel?.name],
                      ["Type",     result.metadata.enhancementType],
                    ].map(([k, v]) => (
                      <div key={k} className="aie-meta-row">
                        <span className="aie-meta-key">{k}</span>
                        <span className="aie-meta-val">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="aie-footer">
            <div className="aie-footer-hint">
              <AlertCircle size={11} />
              {isGuest
                ? isDemoPrompt(prompt)
                  ? "Demo prompt — changes are temporary until you sign up."
                  : "Guest mode — changes saved to session."
                : "Select target model first for best results."}
            </div>
            <button className="aie-footer-close" onClick={onClose} disabled={loading}>Close</button>
          </div>

        </div>
      </div>
    </>
  );
}
