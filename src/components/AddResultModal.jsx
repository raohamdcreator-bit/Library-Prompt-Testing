// src/components/AddResultModal.jsx
import { useState } from "react";
import { addResultToPrompt } from "../lib/results";
import { uploadResultImage } from "../lib/storage";
import { X, FileText, Code, Image, Upload, Check } from "lucide-react";
import { useSoundEffects } from "../hooks/useSoundEffects";

const LANGUAGES = [
  "javascript","typescript","python","java","csharp","cpp","go","rust",
  "php","ruby","swift","kotlin","html","css","sql","bash","json","yaml","markdown",
];

const TYPES = [
  { value: "text",  icon: FileText, label: "Text",  desc: "Prose output"  },
  { value: "code",  icon: Code,     label: "Code",  desc: "Source code"   },
  { value: "image", icon: Image,    label: "Image", desc: "Visual output" },
];

export default function AddResultModal({ isOpen, onClose, promptId, teamId, userId }) {
  const [resultType,     setResultType]     = useState("text");
  const [title,          setTitle]          = useState("");
  const [content,        setContent]        = useState("");
  const [language,       setLanguage]       = useState("javascript");
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { playNotification } = useSoundEffects();

  if (!isOpen) return null;

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Image must be less than 10MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function notify(message, type = "info") {
    playNotification();
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = `
      position:fixed;top:1.25rem;right:1.25rem;z-index:99999;
      padding:.625rem 1rem;border-radius:8px;font-size:.8rem;font-weight:600;
      background:var(--card);color:var(--foreground);
      border:1px solid ${type==="error" ? "var(--destructive)" : "var(--primary)"};
      box-shadow:0 8px 28px rgba(0,0,0,.45);
    `;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity="0"; setTimeout(()=>el.remove(),300); }, 3000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { alert("Title is required"); return; }
    if (resultType !== "image" && !content.trim()) { alert("Content is required"); return; }
    if (resultType === "image" && !imageFile) { alert("Please select an image"); return; }
    setUploading(true); setUploadProgress(0);
    try {
      let resultData = { type: resultType, title: title.trim() };
      if (resultType === "text") {
        resultData.content = content.trim();
      } else if (resultType === "code") {
        resultData.content = content.trim();
        resultData.language = language;
      } else {
        setUploadProgress(30);
        const img = await uploadResultImage(imageFile, promptId, userId);
        setUploadProgress(70);
        Object.assign(resultData, { imageUrl: img.url, imagePath: img.path, imageFilename: img.filename, imageSize: img.size, imageType: img.type });
      }
      setUploadProgress(90);
      await addResultToPrompt(teamId, promptId, userId, resultData);
      setUploadProgress(100);
      if (window.gtag) window.gtag("event","output_attached",{ team_id:teamId, prompt_id:promptId, output_type:resultType });
      notify("Result added successfully!");
      onClose();
    } catch (err) {
      notify(err.message || "Failed to add result", "error");
    } finally {
      setUploading(false); setUploadProgress(0);
    }
  }

  return (
    <>
      <style>{`
        @keyframes armFade   { from{opacity:0}                         to{opacity:1} }
        @keyframes armRise   { from{opacity:0;transform:translateY(16px) scale(.975)} to{opacity:1;transform:none} }
        @keyframes armSpin   { to{transform:rotate(360deg)} }

        .arm-overlay {
          position:fixed; inset:0; z-index:9998;
          display:flex; align-items:center; justify-content:center; padding:1rem;
          background:rgba(0,0,0,.68); backdrop-filter:blur(8px);
          animation:armFade .18s ease-out;
        }
        .arm-shell {
          width:100%; max-width:580px; max-height:92vh;
          display:flex; flex-direction:column;
          background:var(--card);
          border:1px solid rgba(139,92,246,.16);
          border-radius:16px;
          box-shadow:0 28px 64px rgba(0,0,0,.55), 0 0 0 1px rgba(139,92,246,.06);
          overflow:hidden;
          animation:armRise .24s cubic-bezier(.4,0,.2,1);
        }

        /* header */
        .arm-hd {
          display:flex; align-items:center; justify-content:space-between;
          padding:1rem 1.25rem .875rem;
          border-bottom:1px solid rgba(255,255,255,.05); flex-shrink:0;
        }
        .arm-hd-left { display:flex; align-items:center; gap:.625rem; }
        .arm-hd-icon {
          width:32px; height:32px; border-radius:8px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background:rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.2);
        }
        .arm-title    { font-size:.9rem; font-weight:700; color:var(--foreground); letter-spacing:-.01em; }
        .arm-subtitle { font-size:.68rem; color:var(--muted-foreground); margin-top:.1rem; }
        .arm-close {
          width:28px; height:28px; border-radius:7px; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          background:transparent; color:var(--muted-foreground); transition:all .13s;
        }
        .arm-close:hover  { background:rgba(255,255,255,.07); color:var(--foreground); }
        .arm-close:disabled { opacity:.4; cursor:not-allowed; }

        /* body */
        .arm-body {
          flex:1; overflow-y:auto; padding:1.125rem 1.25rem 1.25rem;
          display:flex; flex-direction:column; gap:1rem;
          scrollbar-width:thin; scrollbar-color:rgba(139,92,246,.2) transparent;
        }
        .arm-body::-webkit-scrollbar { width:4px; }
        .arm-body::-webkit-scrollbar-thumb { background:rgba(139,92,246,.25); border-radius:2px; }

        /* label */
        .arm-lbl {
          display:block; font-size:.63rem; font-weight:700;
          letter-spacing:.07em; text-transform:uppercase;
          color:var(--muted-foreground); margin-bottom:.45rem;
        }

        /* type grid */
        .arm-tgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:.45rem; }
        .arm-tbtn {
          display:flex; flex-direction:column; align-items:center; gap:.35rem;
          padding:.75rem .5rem; border-radius:10px;
          border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.02);
          cursor:pointer; transition:all .14s; position:relative; overflow:hidden;
        }
        .arm-tbtn:hover { border-color:rgba(139,92,246,.28); background:rgba(139,92,246,.04); }
        .arm-tbtn.on    { border-color:rgba(139,92,246,.45); background:rgba(139,92,246,.09); }
        .arm-tbtn.on::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(139,92,246,.06),transparent 60%);
          pointer-events:none;
        }
        .arm-tcheck {
          position:absolute; top:.45rem; right:.45rem;
          width:15px; height:15px; border-radius:50%;
          background:var(--primary);
          display:flex; align-items:center; justify-content:center;
        }
        .arm-tname { font-size:.77rem; font-weight:700; color:var(--foreground); }
        .arm-tdesc { font-size:.62rem; color:var(--muted-foreground); }

        /* inputs */
        .arm-input {
          width:100%; padding:.575rem .7rem; border-radius:8px;
          background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
          color:var(--foreground); font-size:.82rem; font-family:inherit;
          outline:none; transition:border-color .14s;
          box-sizing:border-box;
        }
        .arm-input:focus { border-color:rgba(139,92,246,.4); background:rgba(255,255,255,.045); }
        .arm-input::placeholder { color:rgba(228,228,231,.28); }

        .arm-textarea {
          width:100%; padding:.65rem .7rem; border-radius:8px;
          background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
          color:var(--foreground); font-size:.79rem; font-family:inherit;
          line-height:1.65; resize:vertical; outline:none; transition:border-color .14s;
          box-sizing:border-box;
        }
        .arm-textarea:focus { border-color:rgba(139,92,246,.4); background:rgba(255,255,255,.045); }
        .arm-textarea::placeholder { color:rgba(228,228,231,.28); }
        .arm-textarea.mono { font-family:'JetBrains Mono','Consolas',monospace; font-size:.74rem; }

        .arm-chars { font-size:.63rem; color:var(--muted-foreground); text-align:right; margin-top:.28rem; font-variant-numeric:tabular-nums; }

        /* select */
        .arm-select {
          width:100%; padding:.525rem .7rem; border-radius:8px;
          background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
          color:var(--foreground); font-size:.79rem; font-family:inherit;
          outline:none; cursor:pointer; transition:border-color .14s;
        }
        .arm-select:focus { border-color:rgba(139,92,246,.4); }
        .arm-select option { background:var(--card); }

        /* upload */
        .arm-upload {
          border:1.5px dashed rgba(139,92,246,.22); border-radius:10px;
          padding:1.75rem 1rem; text-align:center; cursor:pointer;
          background:rgba(139,92,246,.02); transition:all .14s;
        }
        .arm-upload:hover { border-color:rgba(139,92,246,.38); background:rgba(139,92,246,.05); }
        .arm-upload-icon {
          width:38px; height:38px; border-radius:9px; margin:0 auto .625rem;
          display:flex; align-items:center; justify-content:center;
          background:rgba(139,92,246,.1); border:1px solid rgba(139,92,246,.18);
        }
        .arm-upload-t { font-size:.8rem; font-weight:600; color:var(--foreground); margin-bottom:.22rem; }
        .arm-upload-s { font-size:.68rem; color:var(--muted-foreground); }

        .arm-preview { position:relative; border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,.07); }
        .arm-preview-x {
          position:absolute; top:.45rem; right:.45rem; width:24px; height:24px; border-radius:6px;
          background:rgba(239,68,68,.88); border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center; color:#fff; transition:background .13s;
        }
        .arm-preview-x:hover { background:rgba(239,68,68,1); }
        .arm-finfo { font-size:.66rem; color:var(--muted-foreground); margin-top:.3rem; }

        /* progress */
        .arm-prog { display:flex; flex-direction:column; gap:.35rem; }
        .arm-prog-labels { display:flex; justify-content:space-between; font-size:.68rem; color:var(--muted-foreground); }
        .arm-prog-track { height:3px; background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden; }
        .arm-prog-fill  { height:100%; background:var(--primary); border-radius:2px; transition:width .3s ease; }

        /* footer */
        .arm-ft {
          padding:.8rem 1.25rem; border-top:1px solid rgba(255,255,255,.05);
          display:flex; gap:.5rem; flex-shrink:0;
          background:rgba(0,0,0,.08);
        }
        .arm-submit {
          flex:1; padding:.7rem; border-radius:9px; border:none; cursor:pointer;
          font-size:.82rem; font-weight:700;
          display:flex; align-items:center; justify-content:center; gap:.45rem;
          background:var(--primary); color:#fff; transition:all .14s;
        }
        .arm-submit:hover    { background:var(--primary-hover); transform:translateY(-1px); }
        .arm-submit:disabled { opacity:.45; cursor:not-allowed; transform:none; }
        .arm-cancel {
          padding:.7rem 1rem; border-radius:9px; cursor:pointer; font-size:.82rem; font-weight:600;
          background:transparent; color:var(--muted-foreground);
          border:1px solid rgba(255,255,255,.08); transition:all .14s;
        }
        .arm-cancel:hover    { color:var(--foreground); border-color:rgba(255,255,255,.18); }
        .arm-cancel:disabled { opacity:.4; cursor:not-allowed; }

        .arm-spinner { width:13px; height:13px; border-radius:50%; border:2px solid rgba(255,255,255,.22); border-top-color:#fff; animation:armSpin .7s linear infinite; }
      `}</style>

      <div className="arm-overlay" onClick={onClose}>
        <div className="arm-shell" onClick={e => e.stopPropagation()}>

          {/* header */}
          <div className="arm-hd">
            <div className="arm-hd-left">
              <div className="arm-hd-icon"><Upload size={15} color="#a78bfa" /></div>
              <div>
                <div className="arm-title">Add AI Output</div>
                <div className="arm-subtitle">Attach a result to this prompt</div>
              </div>
            </div>
            <button className="arm-close" onClick={onClose} disabled={uploading}><X size={14} /></button>
          </div>

          {/* body */}
          <div className="arm-body">
            <form id="arm-form" onSubmit={handleSubmit} style={{ display:"contents" }}>

              {/* type */}
              <div>
                <span className="arm-lbl">Output type</span>
                <div className="arm-tgrid">
                  {TYPES.map(t => {
                    const Icon = t.icon;
                    const on = resultType === t.value;
                    return (
                      <button key={t.value} type="button" disabled={uploading}
                        onClick={() => setResultType(t.value)}
                        className={`arm-tbtn${on ? " on" : ""}`}>
                        {on && <div className="arm-tcheck"><Check size={8} color="#fff" /></div>}
                        <Icon size={19} color={on ? "var(--primary)" : "var(--muted-foreground)"} />
                        <div className="arm-tname">{t.label}</div>
                        <div className="arm-tdesc">{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* title */}
              <div>
                <span className="arm-lbl">Title *</span>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Generated Blog Post, API Response…"
                  className="arm-input" required disabled={uploading} />
              </div>

              {/* text */}
              {resultType === "text" && (
                <div>
                  <span className="arm-lbl">Text content *</span>
                  <textarea value={content} onChange={e => setContent(e.target.value)}
                    placeholder="Paste your AI-generated text output here…"
                    className="arm-textarea" rows={8} required disabled={uploading} />
                  <div className="arm-chars">{content.length.toLocaleString()} chars</div>
                </div>
              )}

              {/* code */}
              {resultType === "code" && (
                <>
                  <div>
                    <span className="arm-lbl">Language</span>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className="arm-select" disabled={uploading}>
                      {LANGUAGES.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="arm-lbl">Code content *</span>
                    <textarea value={content} onChange={e => setContent(e.target.value)}
                      placeholder="Paste your AI-generated code here…"
                      className="arm-textarea mono" rows={10} required disabled={uploading} />
                    <div className="arm-chars">{content.length.toLocaleString()} chars</div>
                  </div>
                </>
              )}

              {/* image */}
              {resultType === "image" && (
                <div>
                  <span className="arm-lbl">Image *</span>
                  {!imagePreview ? (
                    <label style={{ display:"block", cursor:"pointer" }}>
                      <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display:"none" }} disabled={uploading} />
                      <div className="arm-upload">
                        <div className="arm-upload-icon"><Upload size={17} color="rgba(139,92,246,.65)" /></div>
                        <div className="arm-upload-t">Click to upload image</div>
                        <div className="arm-upload-s">PNG · JPG · GIF · WebP · max 10 MB</div>
                      </div>
                    </label>
                  ) : (
                    <>
                      <div className="arm-preview">
                        <img src={imagePreview} alt="Preview"
                          style={{ width:"100%", maxHeight:"220px", objectFit:"contain", display:"block", background:"rgba(0,0,0,.2)" }} />
                        <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                          disabled={uploading} className="arm-preview-x"><X size={11} /></button>
                      </div>
                      {imageFile && <div className="arm-finfo">{imageFile.name} · {(imageFile.size/1024).toFixed(1)} KB</div>}
                    </>
                  )}
                </div>
              )}

              {/* progress */}
              {uploading && (
                <div className="arm-prog">
                  <div className="arm-prog-labels">
                    <span>Uploading…</span>
                    <span style={{ fontVariantNumeric:"tabular-nums" }}>{uploadProgress}%</span>
                  </div>
                  <div className="arm-prog-track">
                    <div className="arm-prog-fill" style={{ width:`${uploadProgress}%` }} />
                  </div>
                </div>
              )}

            </form>
          </div>

          {/* footer */}
          <div className="arm-ft">
            <button type="submit" form="arm-form" disabled={uploading} className="arm-submit">
              {uploading
                ? <><div className="arm-spinner" />Uploading…</>
                : <><Check size={13} />Add Result</>}
            </button>
            <button type="button" onClick={onClose} disabled={uploading} className="arm-cancel">Cancel</button>
          </div>

        </div>
      </div>
    </>
  );
}
