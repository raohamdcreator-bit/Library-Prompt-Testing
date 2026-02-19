// src/components/PromptForm.jsx
import { useState, useEffect } from "react";
import { Plus, Edit2, Check, X, Lightbulb } from "lucide-react";

export default function PromptForm({ onSubmit, editingPrompt, onUpdate, onCancel }) {
  const [title,       setTitle]       = useState("");
  const [text,        setText]        = useState("");
  const [tags,        setTags]        = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title || "");
      setText(editingPrompt.text || "");
      setTags((editingPrompt.tags || []).join(", "));
    } else {
      setTitle(""); setText(""); setTags("");
    }
  }, [editingPrompt]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) { alert("Please fill in both title and prompt text"); return; }
    setSubmitting(true);
    const data = {
      title: title.trim(),
      text:  text.trim(),
      tags:  tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    try {
      if (editingPrompt && onUpdate) await onUpdate(editingPrompt.id, data);
      else if (onSubmit) await onSubmit(data);
      if (!editingPrompt) { setTitle(""); setText(""); setTags(""); }
    } catch (err) {
      console.error(err);
      alert("Failed to save prompt. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setTitle(""); setText(""); setTags("");
    if (onCancel) onCancel();
  }

  const isEditing  = Boolean(editingPrompt);
  const isDirty    = title || text || tags;
  const tagList    = tags.split(",").map(t => t.trim()).filter(Boolean);
  const wordCount  = text.trim().split(/\s+/).filter(Boolean).length;

  const TIPS = [
    "Be specific about the desired output format",
    "Provide relevant context and examples",
    "Use clear, actionable language",
    "Test your prompt before sharing with the team",
  ];

  return (
    <>
      <style>{`
        @keyframes pfSlideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        @keyframes pfSpin    { to{transform:rotate(360deg)} }
        @keyframes pfTagIn   { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }

        .pf-card {
          background:var(--card);border:1px solid rgba(255,255,255,.05);
          border-radius:14px;overflow:hidden;margin-bottom:1rem;
          animation:pfSlideIn .22s ease-out;
        }

        /* header */
        .pf-hd {
          display:flex;align-items:center;gap:.625rem;
          padding:.875rem 1.125rem;border-bottom:1px solid rgba(255,255,255,.04);
        }
        .pf-hd-icon {
          width:32px;height:32px;border-radius:8px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
        }
        .pf-hd-title  { font-size:.88rem;font-weight:700;color:var(--foreground);letter-spacing:-.01em; }
        .pf-hd-sub    { font-size:.67rem;color:var(--muted-foreground);margin-top:.07rem; }

        /* body */
        .pf-body { padding:1.125rem; display:flex;flex-direction:column;gap:.875rem; }

        /* field */
        .pf-field { display:flex;flex-direction:column;gap:.4rem; }
        .pf-lbl   {
          font-size:.62rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
          color:var(--muted-foreground);display:flex;align-items:center;justify-content:space-between;
        }
        .pf-lbl-count { font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:0;text-transform:none;font-size:.62rem; }

        .pf-input {
          width:100%;padding:.575rem .7rem;border-radius:8px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
          color:var(--foreground);font-size:.82rem;font-family:inherit;
          outline:none;transition:border-color .15s,background .15s;box-sizing:border-box;
        }
        .pf-input:focus { border-color:rgba(139,92,246,.42);background:rgba(255,255,255,.045); }
        .pf-input::placeholder { color:rgba(228,228,231,.28); }

        .pf-textarea {
          width:100%;padding:.7rem;border-radius:8px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
          color:var(--foreground);
          font-family:'JetBrains Mono','Consolas',monospace;font-size:.77rem;
          line-height:1.72;resize:vertical;outline:none;
          transition:border-color .15s,background .15s;box-sizing:border-box;
        }
        .pf-textarea:focus { border-color:rgba(139,92,246,.42);background:rgba(255,255,255,.045); }
        .pf-textarea::placeholder { color:rgba(228,228,231,.26); }

        /* tag pills */
        .pf-tags { display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.25rem; }
        .pf-tag  {
          font-size:.62rem;font-weight:600;padding:.1rem .45rem;border-radius:4px;
          background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.18);
          animation:pfTagIn .15s ease-out;
        }

        /* footer row */
        .pf-footer {
          display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;
          padding:.875rem 1.125rem;border-top:1px solid rgba(255,255,255,.04);
          background:rgba(0,0,0,.06);
        }
        .pf-submit {
          display:flex;align-items:center;gap:.45rem;
          padding:.65rem 1.125rem;border-radius:8px;border:none;cursor:pointer;
          font-size:.8rem;font-weight:700;
          background:var(--primary);color:#fff;transition:all .14s;
        }
        .pf-submit:hover    { background:var(--primary-hover);transform:translateY(-1px); }
        .pf-submit:disabled { opacity:.45;cursor:not-allowed;transform:none; }
        .pf-cancel, .pf-clear {
          display:flex;align-items:center;gap:.35rem;
          padding:.65rem .875rem;border-radius:8px;cursor:pointer;
          font-size:.8rem;font-weight:600;
          background:transparent;color:var(--muted-foreground);
          border:1px solid rgba(255,255,255,.07);transition:all .14s;
        }
        .pf-cancel:hover, .pf-clear:hover { color:var(--foreground);border-color:rgba(255,255,255,.18); }
        .pf-cancel:disabled, .pf-clear:disabled { opacity:.4;cursor:not-allowed; }

        .pf-spinner { width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.22);border-top-color:#fff;animation:pfSpin .7s linear infinite; }

        /* tips */
        .pf-tips {
          padding:.875rem 1.125rem;border-top:1px solid rgba(255,255,255,.04);
        }
        .pf-tips-head  { display:flex;align-items:center;gap:.4rem;font-size:.71rem;font-weight:700;color:var(--foreground);margin-bottom:.5rem; }
        .pf-tips-grid  { display:grid;grid-template-columns:1fr 1fr;gap:.3rem; }
        @media(max-width:480px){ .pf-tips-grid { grid-template-columns:1fr; } }
        .pf-tip        { display:flex;align-items:flex-start;gap:.375rem;font-size:.69rem;color:var(--muted-foreground);line-height:1.45; }
        .pf-tip-dot    { width:4px;height:4px;border-radius:50%;background:rgba(139,92,246,.45);flex-shrink:0;margin-top:.42rem; }
      `}</style>

      <div className="pf-card">

        {/* header */}
        <div className="pf-hd">
          <div className="pf-hd-icon"
            style={{
              background: isEditing ? "rgba(139,92,246,.1)" : "rgba(139,92,246,.12)",
              border: "1px solid rgba(139,92,246,.2)",
            }}>
            {isEditing ? <Edit2 size={15} color="#a78bfa" /> : <Plus size={15} color="#a78bfa" />}
          </div>
          <div>
            <div className="pf-hd-title">{isEditing ? "Edit Prompt" : "Create New Prompt"}</div>
            <div className="pf-hd-sub">
              {isEditing ? "Update your prompt details" : "Add a new prompt to your team library"}
            </div>
          </div>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit}>
          <div className="pf-body">

            {/* title */}
            <div className="pf-field">
              <label className="pf-lbl">
                Title *
                <span className="pf-lbl-count">{title.length}/100</span>
              </label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Enter a descriptive title for your prompt"
                className="pf-input" required disabled={submitting} maxLength={100} />
            </div>

            {/* text */}
            <div className="pf-field">
              <label className="pf-lbl">
                Prompt Content *
                <span className="pf-lbl-count" style={{ fontVariantNumeric:"tabular-nums" }}>
                  {text.length.toLocaleString()} chars · {wordCount} words
                </span>
              </label>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="Write your AI prompt here. Be specific about what you want the AI to do, provide context, and include any formatting instructions…"
                className="pf-textarea" required disabled={submitting} rows={8} />
            </div>

            {/* tags */}
            <div className="pf-field">
              <label className="pf-lbl">Tags <span style={{ opacity:.5, textTransform:"none", letterSpacing:0, fontWeight:500 }}>(comma separated)</span></label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                placeholder="writing, creative, marketing, code…"
                className="pf-input" disabled={submitting} />
              {tagList.length > 0 && (
                <div className="pf-tags">
                  {tagList.map((t, i) => <span key={i} className="pf-tag">#{t}</span>)}
                </div>
              )}
            </div>

          </div>

          {/* footer */}
          <div className="pf-footer">
            <button type="submit" disabled={submitting || !title.trim() || !text.trim()} className="pf-submit">
              {submitting
                ? <><div className="pf-spinner" />{isEditing ? "Updating…" : "Creating…"}</>
                : <><Check size={13} />{isEditing ? "Update Prompt" : "Create Prompt"}</>}
            </button>

            {isEditing && (
              <button type="button" onClick={handleCancel} disabled={submitting} className="pf-cancel">
                <X size={12} />Cancel
              </button>
            )}

            {!isEditing && isDirty && (
              <button type="button" onClick={() => { setTitle(""); setText(""); setTags(""); }}
                disabled={submitting} className="pf-clear">
                <X size={12} />Clear
              </button>
            )}
          </div>
        </form>

        {/* tips */}
        <div className="pf-tips">
          <div className="pf-tips-head">
            <Lightbulb size={13} color="rgba(139,92,246,.6)" />
            Tips for effective prompts
          </div>
          <div className="pf-tips-grid">
            {TIPS.map(tip => (
              <div key={tip} className="pf-tip">
                <div className="pf-tip-dot" />
                {tip}
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
