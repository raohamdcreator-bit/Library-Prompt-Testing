// src/components/OnboardingExperience.jsx
import React, { useState } from "react";
import {
  Sparkles, ArrowRight, Check, Zap, FileText, Star, X,
} from "lucide-react";
import { DEMO_PROMPTS } from "../lib/guestDemoContent";

export default function OnboardingExperience({
  onComplete,
  onSkip,
  userName,
  teamId,
  onCreateExamples,
  isGuest = false,
}) {
  const [step,             setStep]             = useState(1);
  const [selectedPrompts,  setSelectedPrompts]  = useState(new Set([0, 1, 2]));
  const [isCreating,       setIsCreating]       = useState(false);
  const [showPreview,      setShowPreview]      = useState(null);

  const totalSteps = 2;

  function togglePrompt(index) {
    setSelectedPrompts(prev => {
      const s = new Set(prev);
      s.has(index) ? s.delete(index) : s.add(index);
      return s;
    });
  }

  async function handleCreateExamples() {
    setIsCreating(true);
    const selected = DEMO_PROMPTS.filter((_, i) => selectedPrompts.has(i));
    try {
      if (isGuest) {
        if (window.gtag) window.gtag("event","demo_prompts_viewed",{ count:selected.length, user_type:"guest" });
        setStep(2);
      } else {
        if (onCreateExamples && teamId) await onCreateExamples(selected);
        setStep(2);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to proceed. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  const allSelected = selectedPrompts.size === DEMO_PROMPTS.length;

  return (
    <>
      <style>{`
        @keyframes obFade   { from{opacity:0} to{opacity:1} }
        @keyframes obRise   { from{opacity:0;transform:translateY(18px) scale(.975)} to{opacity:1;transform:none} }
        @keyframes obSpin   { to{transform:rotate(360deg)} }
        @keyframes obScale  { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes obSlideU { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        .ob-overlay {
          position:fixed;inset:0;z-index:10000;
          display:flex;align-items:center;justify-content:center;padding:1rem;
          background:rgba(9,11,18,.94);backdrop-filter:blur(14px);
          animation:obFade .22s ease-out;
        }
        .ob-shell {
          width:100%;max-width:860px;max-height:92vh;
          display:flex;flex-direction:column;
          background:var(--card);
          border:1px solid rgba(139,92,246,.15);
          border-radius:20px;
          box-shadow:0 40px 80px rgba(0,0,0,.6),0 0 0 1px rgba(139,92,246,.06);
          overflow:hidden;
          animation:obRise .28s cubic-bezier(.4,0,.2,1);
        }

        /* ── Header ── */
        .ob-hd {
          display:flex;align-items:center;justify-content:space-between;gap:1rem;
          padding:1.25rem 1.5rem 1rem;flex-shrink:0;
          background:linear-gradient(135deg,rgba(139,92,246,.06) 0%,transparent 55%);
          border-bottom:1px solid rgba(255,255,255,.05);
        }
        .ob-hd-left  { display:flex;align-items:center;gap:.875rem;flex:1;min-width:0; }
        .ob-hd-icon  {
          width:40px;height:40px;border-radius:12px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,rgba(139,92,246,.35),rgba(139,92,246,.1));
          border:1px solid rgba(139,92,246,.25);
        }
        .ob-hd-title { font-size:1.05rem;font-weight:800;color:var(--foreground);letter-spacing:-.02em; }
        .ob-hd-sub   { font-size:.72rem;color:var(--muted-foreground);margin-top:.12rem; }
        .ob-skip {
          font-size:.72rem;font-weight:600;color:var(--muted-foreground);
          background:transparent;border:none;cursor:pointer;
          padding:.3rem .5rem;border-radius:6px;transition:all .13s;white-space:nowrap;flex-shrink:0;
        }
        .ob-skip:hover { color:var(--foreground);background:rgba(255,255,255,.04); }

        /* progress dots */
        .ob-progress { display:flex;align-items:center;gap:.375rem;margin-top:.75rem; }
        .ob-dot {
          height:3px;border-radius:2px;transition:all .3s ease;
          background:rgba(139,92,246,.12);
        }
        .ob-dot.done { background:var(--primary); }

        /* ── Body ── */
        .ob-body {
          flex:1;overflow-y:auto;padding:1.25rem 1.5rem 1.5rem;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
        }
        .ob-body::-webkit-scrollbar { width:4px; }
        .ob-body::-webkit-scrollbar-thumb { background:rgba(139,92,246,.25);border-radius:2px; }

        /* ── Step 1 ── */
        .ob-step1-intro { text-align:center;margin-bottom:1.25rem; }
        .ob-step1-title { font-size:.95rem;font-weight:700;color:var(--foreground);margin-bottom:.3rem; }
        .ob-step1-sub   { font-size:.78rem;color:var(--muted-foreground);line-height:1.55; }

        /* prompt grid */
        .ob-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:.625rem;max-height:380px;overflow-y:auto;padding-right:.25rem; }
        @media(max-width:560px){ .ob-grid { grid-template-columns:1fr; } }
        .ob-grid::-webkit-scrollbar { width:4px; }
        .ob-grid::-webkit-scrollbar-thumb { background:rgba(139,92,246,.2);border-radius:2px; }

        .ob-prompt-card {
          position:relative;padding:.875rem;border-radius:11px;cursor:pointer;
          border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);
          transition:all .15s;
        }
        .ob-prompt-card:hover { border-color:rgba(139,92,246,.25);background:rgba(139,92,246,.04); }
        .ob-prompt-card.sel   { border-color:rgba(139,92,246,.45);background:rgba(139,92,246,.08); }

        .ob-check {
          position:absolute;top:.625rem;right:.625rem;
          width:18px;height:18px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          transition:all .14s;
        }
        .ob-check.on  { background:var(--primary); }
        .ob-check.off { background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1); }

        .ob-cat {
          font-size:.59rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
          padding:.1rem .42rem;border-radius:4px;display:inline-block;margin-bottom:.5rem;
          background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.18);
        }
        .ob-card-title { font-size:.81rem;font-weight:700;color:var(--foreground);margin-bottom:.35rem; }
        .ob-card-text  {
          font-size:.72rem;color:var(--muted-foreground);line-height:1.5;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
          margin-bottom:.5rem;
        }
        .ob-card-tags  { display:flex;flex-wrap:wrap;gap:.25rem; }
        .ob-card-tag   {
          font-size:.59rem;padding:.07rem .35rem;border-radius:3px;
          background:rgba(255,255,255,.04);color:var(--muted-foreground);
        }
        .ob-preview-btn {
          position:absolute;bottom:.625rem;right:.625rem;
          width:26px;height:26px;border-radius:6px;
          display:flex;align-items:center;justify-content:center;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);
          cursor:pointer;transition:all .13s;color:var(--muted-foreground);
        }
        .ob-preview-btn:hover { background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.25);color:var(--primary); }

        /* summary bar */
        .ob-summary {
          display:flex;align-items:center;justify-content:space-between;
          padding:.625rem .875rem;border-radius:9px;margin-top:.875rem;
          background:rgba(139,92,246,.05);border:1px solid rgba(139,92,246,.1);
        }
        .ob-summary-left { display:flex;align-items:center;gap:.5rem;font-size:.79rem;color:var(--foreground); }
        .ob-sel-all {
          font-size:.72rem;font-weight:600;color:var(--primary);
          background:transparent;border:none;cursor:pointer;transition:opacity .13s;
        }
        .ob-sel-all:hover { opacity:.7; }

        /* CTA */
        .ob-cta {
          width:100%;padding:.875rem;border-radius:10px;border:none;cursor:pointer;
          font-size:.85rem;font-weight:700;letter-spacing:-.01em;
          display:flex;align-items:center;justify-content:center;gap:.625rem;
          background:var(--primary);color:#fff;transition:all .15s;margin-top:.875rem;
          box-shadow:0 4px 20px rgba(139,92,246,.3);
        }
        .ob-cta:hover    { background:var(--primary-hover);transform:translateY(-1px);box-shadow:0 6px 28px rgba(139,92,246,.4); }
        .ob-cta:active   { transform:none; }
        .ob-cta:disabled { opacity:.45;cursor:not-allowed;transform:none;box-shadow:none; }
        .ob-spinner { width:15px;height:15px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:obSpin .7s linear infinite; }

        /* ── Step 2 ── */
        .ob-step2 { display:flex;flex-direction:column;align-items:center;text-align:center;padding:1.5rem 0;gap:1.25rem; }
        .ob-success-ring {
          width:68px;height:68px;border-radius:20px;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,rgba(139,92,246,.35),rgba(139,92,246,.1));
          border:1px solid rgba(139,92,246,.3);
          animation:obScale .45s cubic-bezier(.34,1.56,.64,1);
          box-shadow:0 12px 32px rgba(139,92,246,.25);
        }
        .ob-step2-title { font-size:1.25rem;font-weight:800;color:var(--foreground);letter-spacing:-.02em; }
        .ob-step2-sub   { font-size:.82rem;color:var(--muted-foreground);max-width:360px;line-height:1.6; }

        .ob-tips {
          width:100%;max-width:460px;padding:1rem 1.125rem;border-radius:12px;text-align:left;
          background:rgba(139,92,246,.05);border:1px solid rgba(139,92,246,.1);
        }
        .ob-tips-title { font-size:.78rem;font-weight:700;color:var(--foreground);display:flex;align-items:center;gap:.45rem;margin-bottom:.75rem; }
        .ob-tips-list  { display:flex;flex-direction:column;gap:.5rem; }
        .ob-tip-item   { display:flex;align-items:flex-start;gap:.5rem;font-size:.75rem;color:var(--muted-foreground);line-height:1.5; }
        .ob-tip-dot    { width:16px;height:16px;border-radius:50%;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.05rem; }

        /* ── Preview modal ── */
        .ob-prev-overlay {
          position:fixed;inset:0;z-index:10001;
          display:flex;align-items:center;justify-content:center;padding:1rem;
          background:rgba(0,0,0,.8);
          animation:obFade .15s ease-out;
        }
        .ob-prev-shell {
          width:100%;max-width:640px;
          background:var(--card);border:1px solid rgba(139,92,246,.15);
          border-radius:14px;overflow:hidden;
          animation:obRise .2s ease-out;
        }
        .ob-prev-hd {
          display:flex;align-items:center;justify-content:space-between;
          padding:.875rem 1.125rem;border-bottom:1px solid rgba(255,255,255,.05);
        }
        .ob-prev-title { font-size:.875rem;font-weight:700;color:var(--foreground); }
        .ob-prev-close {
          width:26px;height:26px;border-radius:6px;border:1px solid rgba(255,255,255,.08);
          background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;
          color:var(--muted-foreground);transition:all .13s;
        }
        .ob-prev-close:hover { background:rgba(255,255,255,.07);color:var(--foreground); }
        .ob-prev-body {
          padding:1rem 1.125rem;max-height:420px;overflow-y:auto;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
        }
        .ob-prev-text {
          font-family:'JetBrains Mono','Consolas',monospace;
          font-size:.75rem;line-height:1.75;color:rgba(228,228,231,.85);
          white-space:pre-wrap;background:rgba(0,0,0,.25);
          border:1px solid rgba(255,255,255,.05);border-radius:8px;
          padding:.875rem;
        }
        .ob-prev-tags { display:flex;flex-wrap:wrap;gap:.3rem;padding:.75rem 1.125rem;border-top:1px solid rgba(255,255,255,.04); }
        .ob-prev-tag  {
          font-size:.62rem;font-weight:600;padding:.1rem .42rem;border-radius:4px;
          background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.18);
        }
      `}</style>

      <div className="ob-overlay">
        <div className="ob-shell">

          {/* header */}
          <div className="ob-hd">
            <div className="ob-hd-left">
              <div className="ob-hd-icon"><Sparkles size={20} color="#c4b5fd" /></div>
              <div>
                <div className="ob-hd-title">
                  {isGuest ? "Welcome to Prism 👋" : `Welcome, ${userName?.split(" ")[0] || "there"} 👋`}
                </div>
                <div className="ob-hd-sub">
                  {isGuest
                    ? "Explore example prompts to see how teams collaborate"
                    : "Get started in under a minute"}
                </div>
              </div>
            </div>
            <button onClick={onSkip} className="ob-skip">Skip</button>
          </div>

          {/* progress */}
          <div style={{ padding:"0 1.5rem .75rem", background:"linear-gradient(135deg,rgba(139,92,246,.03),transparent)", flexShrink:0 }}>
            <div className="ob-progress">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`ob-dot${i < step ? " done" : ""}`}
                  style={{ flex: 1, transition: "all .35s ease" }} />
              ))}
            </div>
          </div>

          {/* body */}
          <div className="ob-body">

            {step === 1 && (
              <div>
                <div className="ob-step1-intro">
                  <div className="ob-step1-title">
                    {isGuest ? "Explore Demo Prompts" : "Start with ready-to-use examples"}
                  </div>
                  <div className="ob-step1-sub">
                    {isGuest
                      ? "See how professional prompts are structured. You can edit these to experiment!"
                      : "Select example prompts to add to your team. Customise them later!"}
                  </div>
                </div>

                {/* grid */}
                <div className="ob-grid">
                  {DEMO_PROMPTS.map((prompt, index) => {
                    const sel = selectedPrompts.has(index);
                    return (
                      <div key={index}
                        className={`ob-prompt-card${sel ? " sel" : ""}`}
                        onClick={() => togglePrompt(index)}>
                        <div className={`ob-check${sel ? " on" : " off"}`}>
                          {sel && <Check size={10} color="#fff" />}
                        </div>
                        <div className="ob-cat">{prompt.category}</div>
                        <div className="ob-card-title">{prompt.title}</div>
                        <div className="ob-card-text">{prompt.text}</div>
                        <div className="ob-card-tags">
                          {prompt.tags.slice(0, 3).map((t, ti) => (
                            <span key={ti} className="ob-card-tag">#{t}</span>
                          ))}
                        </div>
                        <button className="ob-preview-btn" title="Preview full prompt"
                          onClick={e => { e.stopPropagation(); setShowPreview(index); }}>
                          <FileText size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* summary */}
                <div className="ob-summary">
                  <div className="ob-summary-left">
                    <Star size={15} color="var(--primary)" fill="rgba(139,92,246,.3)" />
                    <span><strong style={{ color:"var(--foreground)" }}>{selectedPrompts.size}</strong> example{selectedPrompts.size !== 1 ? "s" : ""} selected</span>
                  </div>
                  <button className="ob-sel-all"
                    onClick={() => setSelectedPrompts(allSelected ? new Set() : new Set(DEMO_PROMPTS.map((_,i) => i)))}>
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>

                {/* CTA */}
                <button className="ob-cta"
                  onClick={handleCreateExamples}
                  disabled={selectedPrompts.size === 0 || isCreating}>
                  {isCreating
                    ? <><div className="ob-spinner" />{isGuest ? "Loading…" : "Creating…"}</>
                    : <>{isGuest ? "Start Exploring" : "Add Examples & Continue"}<ArrowRight size={16} /></>}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="ob-step2">
                <div className="ob-success-ring">
                  <Check size={32} color="#c4b5fd" strokeWidth={2.5} />
                </div>

                <div className="ob-step2-title">
                  {isGuest ? "You're Ready to Explore! 🎉" : "You're All Set! 🎉"}
                </div>

                <div className="ob-step2-sub">
                  {isGuest
                    ? `Explore ${selectedPrompts.size} demo prompt${selectedPrompts.size !== 1 ? "s" : ""}. Edit them, copy them, and see how teams collaborate!`
                    : `We've added ${selectedPrompts.size} example prompt${selectedPrompts.size !== 1 ? "s" : ""} to your team. Feel free to customise them or create your own!`}
                </div>

                <div className="ob-tips">
                  <div className="ob-tips-title">
                    <Zap size={14} color="var(--primary)" />
                    {isGuest ? "What you can do:" : "Quick tips to get started:"}
                  </div>
                  <div className="ob-tips-list">
                    {(isGuest ? [
                      "Edit demo prompts to experiment (changes won't be saved)",
                      "Copy prompts to use in ChatGPT, Claude, and other AI tools",
                      "Sign up to create your own prompts and save your work",
                      "Demo prompts reset on refresh — they're just for exploration!",
                    ] : [
                      "Click any prompt to expand it and see AI enhancement options",
                      "Use the copy button to quickly use prompts in your AI tools",
                      "Invite team members to collaborate on prompt development",
                      "Track prompt performance with built-in analytics",
                    ]).map(tip => (
                      <div key={tip} className="ob-tip-item">
                        <div className="ob-tip-dot"><Check size={8} color="#a78bfa" /></div>
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>

                <button className="ob-cta" style={{ maxWidth:"320px" }} onClick={onComplete}>
                  {isGuest ? "Start Exploring" : "Start Building"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* preview modal */}
      {showPreview !== null && (
        <div className="ob-prev-overlay" onClick={() => setShowPreview(null)}>
          <div className="ob-prev-shell" onClick={e => e.stopPropagation()}>
            <div className="ob-prev-hd">
              <div className="ob-prev-title">{DEMO_PROMPTS[showPreview].title}</div>
              <button className="ob-prev-close" onClick={() => setShowPreview(null)}><X size={13} /></button>
            </div>
            <div className="ob-prev-body">
              <div className="ob-prev-text">{DEMO_PROMPTS[showPreview].text}</div>
            </div>
            <div className="ob-prev-tags">
              {DEMO_PROMPTS[showPreview].tags.map((t, i) => (
                <span key={i} className="ob-prev-tag">#{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
