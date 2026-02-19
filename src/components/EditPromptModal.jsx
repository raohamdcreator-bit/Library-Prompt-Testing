// src/components/EditPromptModal.jsx
import { useState, useEffect } from "react";
import { X, Lock, Unlock, AlertCircle, Save } from "lucide-react";

export default function EditPromptModal({ open, prompt, onClose, onSave }) {
  const [title,      setTitle]      = useState("");
  const [text,       setText]       = useState("");
  const [tags,       setTags]       = useState("");
  const [visibility, setVisibility] = useState("public");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title || "");
      setText(prompt.text || "");
      setTags(Array.isArray(prompt.tags) ? prompt.tags.join(", ") : "");
      setVisibility(prompt.visibility || "public");
    }
  }, [prompt]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) { alert("Title and prompt text are required"); return; }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        text:  text.trim(),
        tags:  tags.split(",").map(t => t.trim()).filter(Boolean),
        visibility,
      });
    } catch (err) {
      console.error(err);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);

  return (
    <>
      <style>{`
        @keyframes epmFade { from{opacity:0} to{opacity:1} }
        @keyframes epmRise { from{opacity:0;transform:translateY(14px) scale(.977)} to{opacity:1;transform:none} }
        @keyframes epmSpin { to{transform:rotate(360deg)} }

        .epm-overlay {
          position:fixed;inset:0;z-index:9998;
          display:flex;align-items:center;justify-content:center;padding:1rem;
          background:rgba(0,0,0,.7);backdrop-filter:blur(8px);
          animation:epmFade .18s ease-out;
        }
        .epm-shell {
          width:100%;max-width:620px;max-height:92vh;
          display:flex;flex-direction:column;
          background:var(--card);
          border:1px solid rgba(139,92,246,.16);
          border-radius:16px;
          box-shadow:0 32px 72px rgba(0,0,0,.55),0 0 0 1px rgba(139,92,246,.07);
          overflow:hidden;
          animation:epmRise .24s cubic-bezier(.4,0,.2,1);
        }

        /* header */
        .epm-hd {
          display:flex;align-items:center;justify-content:space-between;
          padding:1rem 1.25rem .875rem;
          border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;
        }
        .epm-hd-left { display:flex;align-items:center;gap:.625rem; }
        .epm-hd-icon {
          width:32px;height:32px;border-radius:8px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.2);
        }
        .epm-title    { font-size:.9rem;font-weight:700;color:var(--foreground);letter-spacing:-.01em; }
        .epm-subtitle { font-size:.68rem;color:var(--muted-foreground);margin-top:.08rem; }
        .epm-close {
          width:28px;height:28px;border-radius:7px;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          background:transparent;color:var(--muted-foreground);transition:all .13s;
        }
        .epm-close:hover  { background:rgba(255,255,255,.07);color:var(--foreground); }
        .epm-close:disabled { opacity:.4;cursor:not-allowed; }

        /* body */
        .epm-body {
          flex:1;overflow-y:auto;padding:1.125rem 1.25rem;
          display:flex;flex-direction:column;gap:1rem;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
        }
        .epm-body::-webkit-scrollbar { width:4px; }
        .epm-body::-webkit-scrollbar-thumb { background:rgba(139,92,246,.25);border-radius:2px; }

        /* field */
        .epm-field { display:flex;flex-direction:column;gap:.42rem; }
        .epm-lbl {
          font-size:.62rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
          color:var(--muted-foreground);
        }
        .epm-input {
          width:100%;padding:.575rem .7rem;border-radius:8px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
          color:var(--foreground);font-size:.82rem;font-family:inherit;
          outline:none;transition:border-color .14s,background .14s;box-sizing:border-box;
        }
        .epm-input:focus { border-color:rgba(139,92,246,.42);background:rgba(255,255,255,.045); }
        .epm-input::placeholder { color:rgba(228,228,231,.28); }

        .epm-textarea {
          width:100%;padding:.7rem;border-radius:8px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
          color:var(--foreground);font-size:.77rem;
          font-family:'JetBrains Mono','Consolas',monospace;
          line-height:1.7;resize:vertical;outline:none;
          transition:border-color .14s,background .14s;box-sizing:border-box;
        }
        .epm-textarea:focus { border-color:rgba(139,92,246,.42);background:rgba(255,255,255,.045); }
        .epm-textarea::placeholder { color:rgba(228,228,231,.25); }
        .epm-char-row { display:flex;justify-content:flex-end;font-size:.63rem;color:var(--muted-foreground);font-variant-numeric:tabular-nums; }

        /* tags preview */
        .epm-tags { display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.2rem; }
        .epm-tag {
          font-size:.62rem;font-weight:600;padding:.1rem .45rem;border-radius:4px;
          background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.18);
        }

        /* visibility */
        .epm-vis-grid { display:grid;grid-template-columns:1fr 1fr;gap:.5rem; }
        .epm-vis-opt {
          position:relative;display:flex;align-items:flex-start;gap:.625rem;
          padding:.75rem .875rem;border-radius:10px;cursor:pointer;
          border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);
          transition:all .14s;
        }
        .epm-vis-opt:hover { border-color:rgba(139,92,246,.28);background:rgba(139,92,246,.04); }
        .epm-vis-opt.active-pub { border-color:rgba(139,92,246,.45);background:rgba(139,92,246,.08); }
        .epm-vis-opt.active-priv{ border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.06); }
        .epm-vis-opt input { position:absolute;opacity:0;pointer-events:none; }
        .epm-vis-accent {
          width:3px;height:100%;position:absolute;left:0;top:0;bottom:0;border-radius:0 2px 2px 0;
        }
        .epm-vis-icon {
          width:26px;height:26px;border-radius:7px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;margin-top:1px;
        }
        .epm-vis-name { font-size:.79rem;font-weight:700;color:var(--foreground);margin-bottom:.12rem; }
        .epm-vis-desc { font-size:.65rem;color:var(--muted-foreground);line-height:1.45; }

        /* info box */
        .epm-info {
          display:flex;gap:.625rem;padding:.75rem .875rem;border-radius:9px;
          background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);
        }
        .epm-info-text { font-size:.71rem;color:var(--muted-foreground);line-height:1.6; }
        .epm-info-title { font-size:.71rem;font-weight:700;color:var(--foreground);margin-bottom:.3rem; }
        .epm-info-list  { display:flex;flex-direction:column;gap:.2rem; }
        .epm-info-item  { display:flex;align-items:flex-start;gap:.4rem; }
        .epm-info-dot   { width:4px;height:4px;border-radius:50%;background:var(--muted-foreground);flex-shrink:0;margin-top:.45rem;opacity:.5; }

        /* footer */
        .epm-ft {
          padding:.8rem 1.25rem;border-top:1px solid rgba(255,255,255,.05);
          display:flex;gap:.5rem;flex-shrink:0;background:rgba(0,0,0,.08);
        }
        .epm-submit {
          flex:1;padding:.7rem;border-radius:9px;border:none;cursor:pointer;
          font-size:.82rem;font-weight:700;
          display:flex;align-items:center;justify-content:center;gap:.45rem;
          background:var(--primary);color:#fff;transition:all .14s;
        }
        .epm-submit:hover    { background:var(--primary-hover);transform:translateY(-1px); }
        .epm-submit:disabled { opacity:.45;cursor:not-allowed;transform:none; }
        .epm-cancel {
          padding:.7rem 1rem;border-radius:9px;cursor:pointer;font-size:.82rem;font-weight:600;
          background:transparent;color:var(--muted-foreground);
          border:1px solid rgba(255,255,255,.08);transition:all .14s;
        }
        .epm-cancel:hover    { color:var(--foreground);border-color:rgba(255,255,255,.18); }
        .epm-cancel:disabled { opacity:.4;cursor:not-allowed; }
        .epm-spinner { width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.22);border-top-color:#fff;animation:epmSpin .7s linear infinite; }
      `}</style>

      <div className="epm-overlay" onClick={onClose}>
        <div className="epm-shell" onClick={e => e.stopPropagation()}>

          {/* header */}
          <div className="epm-hd">
            <div className="epm-hd-left">
              <div className="epm-hd-icon"><Save size={15} color="#a78bfa" /></div>
              <div>
                <div className="epm-title">Edit Prompt</div>
                <div className="epm-subtitle">Update your prompt details</div>
              </div>
            </div>
            <button className="epm-close" onClick={onClose} disabled={saving}><X size={14} /></button>
          </div>

          {/* body */}
          <div className="epm-body">
            <form id="epm-form" onSubmit={handleSubmit} style={{ display:"contents" }}>

              {/* title */}
              <div className="epm-field">
                <span className="epm-lbl">Title *</span>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Blog Post Generator"
                  className="epm-input" required disabled={saving} />
              </div>

              {/* prompt text */}
              <div className="epm-field">
                <span className="epm-lbl">Prompt Text *</span>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder="Enter your prompt here…"
                  className="epm-textarea" rows={8} required disabled={saving} />
                <div className="epm-char-row">{text.length.toLocaleString()} chars</div>
              </div>

              {/* tags */}
              <div className="epm-field">
                <span className="epm-lbl">Tags <span style={{ opacity:.5, textTransform:"none", letterSpacing:0 }}>(comma separated)</span></span>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="writing, creative, marketing…"
                  className="epm-input" disabled={saving} />
                {tagList.length > 0 && (
                  <div className="epm-tags">
                    {tagList.map(t => <span key={t} className="epm-tag">#{t}</span>)}
                  </div>
                )}
              </div>

              {/* visibility */}
              <div className="epm-field">
                <span className="epm-lbl">Visibility</span>
                <div className="epm-vis-grid">

                  <label className={`epm-vis-opt${visibility === "public" ? " active-pub" : ""}`}>
                    <input type="radio" name="visibility" value="public"
                      checked={visibility === "public"} onChange={e => setVisibility(e.target.value)} disabled={saving} />
                    <div className="epm-vis-accent" style={{ background: visibility==="public" ? "rgba(139,92,246,.7)" : "transparent" }} />
                    <div className="epm-vis-icon" style={{ background:"rgba(139,92,246,.1)",border:"1px solid rgba(139,92,246,.18)" }}>
                      <Unlock size={13} color={visibility==="public" ? "var(--primary)" : "var(--muted-foreground)"} />
                    </div>
                    <div>
                      <div className="epm-vis-name">Public</div>
                      <div className="epm-vis-desc">All team members can view</div>
                    </div>
                  </label>

                  <label className={`epm-vis-opt${visibility === "private" ? " active-priv" : ""}`}>
                    <input type="radio" name="visibility" value="private"
                      checked={visibility === "private"} onChange={e => setVisibility(e.target.value)} disabled={saving} />
                    <div className="epm-vis-accent" style={{ background: visibility==="private" ? "rgba(245,158,11,.6)" : "transparent" }} />
                    <div className="epm-vis-icon" style={{ background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.16)" }}>
                      <Lock size={13} color={visibility==="private" ? "#f59e0b" : "var(--muted-foreground)"} />
                    </div>
                    <div>
                      <div className="epm-vis-name">Private</div>
                      <div className="epm-vis-desc">Only you &amp; admins see this</div>
                    </div>
                  </label>

                </div>
              </div>

              {/* info */}
              <div className="epm-info">
                <AlertCircle size={14} color="rgba(139,92,246,.5)" style={{ flexShrink:0, marginTop:1 }} />
                <div className="epm-info-text">
                  <div className="epm-info-title">Privacy rules</div>
                  <div className="epm-info-list">
                    {["Private prompts are only visible to you and team admins/owners",
                      "Results added to private prompts follow the same visibility rules",
                      "You can change visibility at any time"].map(s => (
                      <div key={s} className="epm-info-item">
                        <div className="epm-info-dot" />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </form>
          </div>

          {/* footer */}
          <div className="epm-ft">
            <button type="submit" form="epm-form" disabled={saving} className="epm-submit">
              {saving ? <><div className="epm-spinner" />Saving…</> : <><Save size={13} />Save Changes</>}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="epm-cancel">Cancel</button>
          </div>

        </div>
      </div>
    </>
  );
}
