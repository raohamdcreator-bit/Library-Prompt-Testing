// src/components/ViewOutputsModal.jsx — Redesigned UI
import { useState, useEffect } from "react";
import { X, FileText, Code, Image as ImageIcon, Loader2, Plus, Copy, Trash2, ChevronDown, Check } from "lucide-react";
import { subscribeToResults, deleteResult } from "../lib/results";
import { useAuth } from "../context/AuthContext";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function typeColor(type) {
  return type === "code" ? "#a78bfa" : type === "image" ? "#f472b6" : "#60a5fa";
}

function typeBg(type) {
  return type === "code" ? "rgba(167,139,250,.12)" : type === "image" ? "rgba(244,114,182,.12)" : "rgba(96,165,250,.12)";
}

function TypeIcon({ type, size = 14 }) {
  const color = typeColor(type);
  if (type === "code")  return <Code     size={size} color={color} />;
  if (type === "image") return <ImageIcon size={size} color={color} />;
  return <FileText size={size} color={color} />;
}

// ── OutputCard ────────────────────────────────────────────────────────────────
function OutputCard({ output, onDelete, canDelete }) {
  const [expanded,  setExpanded]  = useState(false);
  const [imgErr,    setImgErr]    = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [hovered,   setHovered]   = useState(false);

  const hasLong = (output.type !== "image") && (output.content?.length || 0) > 280;
  const color   = typeColor(output.type);
  const bg      = typeBg(output.type);

  async function handleCopy() {
    if (!output.content) return;
    await navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "12px", overflow: "hidden",
        border: "1px solid",
        borderColor: hovered ? `${color}35` : "rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.02)",
        transition: "border-color .2s, box-shadow .2s",
        boxShadow: hovered ? `0 4px 20px rgba(0,0,0,.25), 0 0 0 1px ${color}18` : "none",
      }}
    >
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: ".625rem",
        padding: ".75rem .875rem",
        background: hovered ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.015)",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        transition: "background .15s",
      }}>
        {/* Type badge */}
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: bg, border: `1px solid ${color}25`,
        }}>
          <TypeIcon type={output.type} size={14} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ".83rem", fontWeight: 700, color: "var(--foreground)", marginBottom: ".2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {output.title || "Untitled"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: ".63rem", fontWeight: 700, padding: ".1rem .45rem", borderRadius: "4px", background: bg, color, border: `1px solid ${color}30` }}>
              {output.type.charAt(0).toUpperCase() + output.type.slice(1)}
              {output.type === "code" && output.language ? ` · ${output.language}` : ""}
            </span>
            <span style={{ fontSize: ".65rem", color: "var(--muted-foreground)" }}>{fmtDate(output.createdAt)}</span>
            {output.content && output.type !== "image" && (
              <span style={{ fontSize: ".63rem", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                {output.content.length.toLocaleString()} chars
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: ".375rem", flexShrink: 0 }}>
          {output.type !== "image" && output.content && (
            <button onClick={handleCopy}
              title="Copy"
              style={{
                width: "28px", height: "28px", borderRadius: "7px", border: "1px solid rgba(255,255,255,.1)",
                background: copied ? "rgba(74,222,128,.12)" : "rgba(255,255,255,.04)",
                color: copied ? "#4ade80" : "var(--muted-foreground)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          )}
          {canDelete && onDelete && (
            <button onClick={() => onDelete(output)}
              title="Delete"
              style={{
                width: "28px", height: "28px", borderRadius: "7px", border: "1px solid rgba(239,68,68,.15)",
                background: "rgba(239,68,68,.06)", color: "#f87171",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.06)"; }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content preview */}
      <div style={{ padding: ".75rem .875rem" }}>
        {output.type === "text" && output.content && (
          <p style={{
            fontSize: ".8rem", lineHeight: 1.65, color: "rgba(228,228,231,.78)",
            margin: 0, whiteSpace: "pre-wrap",
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? "unset" : 4,
            WebkitBoxOrient: "vertical",
            overflow: expanded ? "visible" : "hidden",
          }}>{output.content}</p>
        )}

        {output.type === "code" && output.content && (
          <div style={{ borderRadius: "7px", overflow: "hidden", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.06)" }}>
            <pre style={{
              margin: 0, padding: ".625rem .75rem",
              fontSize: ".73rem", lineHeight: 1.6, color: "#e2e8f0",
              fontFamily: "'JetBrains Mono','Consolas',monospace",
              overflow: "hidden",
              display: expanded ? "block" : "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 5,
              WebkitBoxOrient: "vertical",
            }}>{output.content}</pre>
          </div>
        )}

        {output.type === "image" && output.imageUrl && !imgErr && (
          <div style={{ borderRadius: "8px", overflow: "hidden", background: "rgba(0,0,0,.3)" }}>
            <img src={output.imageUrl} alt={output.title} onError={() => setImgErr(true)}
              style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: "280px" }} />
          </div>
        )}

        {output.type === "image" && imgErr && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted-foreground)" }}>
            <ImageIcon size={28} style={{ margin: "0 auto .5rem", display: "block", opacity: .4 }} />
            <p style={{ fontSize: ".75rem" }}>Failed to load image</p>
          </div>
        )}

        {hasLong && (
          <button onClick={() => setExpanded(!expanded)}
            style={{
              display: "flex", alignItems: "center", gap: ".3rem", marginTop: ".625rem",
              fontSize: ".7rem", fontWeight: 600, color: "var(--primary)",
              background: "rgba(139,92,246,.07)", border: "1px solid rgba(139,92,246,.15)",
              padding: ".3rem .625rem", borderRadius: "6px", cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(139,92,246,.12)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(139,92,246,.07)"}
          >
            <ChevronDown size={11} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ViewOutputsModal({ isOpen, onClose, prompt, teamId, userRole, isGuestMode = false, onAttachNew }) {
  const { user }             = useAuth();
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all"); // all | text | code | image

  useEffect(() => {
    if (!isOpen || !teamId || !prompt?.id) { setOutputs([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeToResults(teamId, prompt.id, results => { setOutputs(results); setLoading(false); });
    return () => unsub();
  }, [isOpen, teamId, prompt?.id]);

  async function handleDelete(output) {
    if (!confirm("Delete this output?")) return;
    try { await deleteResult(teamId, prompt.id, output.id, output.imagePath); }
    catch { alert("Failed to delete output."); }
  }

  function canDelete(output) {
    if (isGuestMode) return false;
    return output.createdBy === user?.uid || userRole === "owner" || userRole === "admin";
  }

  const filtered = filter === "all" ? outputs : outputs.filter(o => o.type === filter);
  const counts   = { all: outputs.length, text: 0, code: 0, image: 0 };
  outputs.forEach(o => { if (counts[o.type] !== undefined) counts[o.type]++; });

  if (!isOpen) return null;

  const filterTabs = [
    { id: "all",   label: "All" },
    { id: "text",  label: "Text",  icon: FileText },
    { id: "code",  label: "Code",  icon: Code },
    { id: "image", label: "Image", icon: ImageIcon },
  ].filter(t => t.id === "all" || counts[t.id] > 0);

  return (
    <>
      <style>{`
        .vom-overlay {
          position:fixed;inset:0;z-index:9999;
          display:flex;align-items:center;justify-content:center;padding:1rem;
          background:rgba(0,0,0,.75);backdrop-filter:blur(6px);
          animation:vomIn .2s ease-out;
        }
        @keyframes vomIn { from{opacity:0} to{opacity:1} }

        .vom-shell {
          width:100%;max-width:680px;max-height:90vh;
          display:flex;flex-direction:column;
          background:var(--card);
          border:1px solid rgba(139,92,246,.18);
          border-radius:20px;
          box-shadow:0 32px 80px rgba(0,0,0,.6),0 0 0 1px rgba(139,92,246,.07);
          overflow:hidden;
          animation:vomShellIn .25s cubic-bezier(.4,0,.2,1);
        }
        @keyframes vomShellIn { from{opacity:0;transform:translateY(14px) scale(.98)} to{opacity:1;transform:none} }

        .vom-header {
          padding:1.125rem 1.375rem 1rem;
          border-bottom:1px solid rgba(139,92,246,.1);
          display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
          flex-shrink:0;
        }
        .vom-title { font-size:.95rem;font-weight:700;color:var(--foreground);letter-spacing:-.01em; }
        .vom-subtitle { font-size:.7rem;color:var(--muted-foreground);margin-top:.2rem; }
        .vom-close {
          width:30px;height:30px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:transparent;color:var(--muted-foreground);transition:all .15s;
        }
        .vom-close:hover { background:rgba(255,255,255,.07);color:var(--foreground); }

        .vom-filter-bar {
          display:flex;align-items:center;gap:.375rem;
          padding:.625rem 1.375rem;border-bottom:1px solid rgba(255,255,255,.04);
          flex-shrink:0;overflow-x:auto;scrollbar-width:none;
        }
        .vom-filter-bar::-webkit-scrollbar { display:none; }
        .vom-filter-btn {
          display:flex;align-items:center;gap:.35rem;
          padding:.3rem .625rem;border-radius:6px;font-size:.72rem;font-weight:600;
          border:1px solid transparent;background:transparent;
          color:var(--muted-foreground);cursor:pointer;transition:all .15s;white-space:nowrap;
        }
        .vom-filter-btn:hover { background:rgba(255,255,255,.04);color:var(--foreground); }
        .vom-filter-btn.active { background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.2);color:var(--primary); }
        .vom-filter-count {
          font-size:.6rem;padding:.05rem .35rem;border-radius:999px;
          background:rgba(139,92,246,.18);color:var(--primary);font-weight:700;
        }

        .vom-body {
          flex:1;overflow-y:auto;padding:1rem 1.375rem 1.25rem;
          display:flex;flex-direction:column;gap:.625rem;
          scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
        }

        .vom-footer {
          padding:.75rem 1.375rem;border-top:1px solid rgba(139,92,246,.08);
          display:flex;align-items:center;justify-content:space-between;gap:.75rem;
          flex-shrink:0;background:rgba(0,0,0,.12);flex-wrap:wrap;
        }
        .vom-attach-btn {
          display:flex;align-items:center;gap:.5rem;
          padding:.5rem .875rem;border-radius:8px;font-size:.78rem;font-weight:700;
          background:rgba(139,92,246,.1);color:var(--primary);
          border:1px dashed rgba(139,92,246,.25);cursor:pointer;transition:all .15s;
        }
        .vom-attach-btn:hover { background:rgba(139,92,246,.16);border-style:solid; }
        .vom-close-btn {
          padding:.5rem 1rem;border-radius:8px;font-size:.78rem;font-weight:600;
          background:transparent;color:var(--muted-foreground);
          border:1px solid var(--border);cursor:pointer;transition:all .15s;
        }
        .vom-close-btn:hover { color:var(--foreground);border-color:rgba(255,255,255,.2); }

        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      <div className="vom-overlay" onClick={onClose}>
        <div className="vom-shell" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="vom-header">
            <div>
              <div className="vom-title">
                AI Outputs
                {isGuestMode && <span style={{ fontSize: ".7rem", fontWeight: 400, color: "var(--muted-foreground)", marginLeft: ".5rem" }}>Read-only</span>}
              </div>
              {prompt && (
                <div className="vom-subtitle">
                  {prompt.title} · {outputs.length} {outputs.length === 1 ? "output" : "outputs"}
                </div>
              )}
            </div>
            <button className="vom-close" onClick={onClose}><X size={15} /></button>
          </div>

          {/* Filter bar — only when there are outputs */}
          {!loading && outputs.length > 0 && filterTabs.length > 1 && (
            <div className="vom-filter-bar">
              {filterTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={`vom-filter-btn${filter === t.id ? " active" : ""}`}
                >
                  {t.icon && <t.icon size={11} />}
                  {t.label}
                  <span className="vom-filter-count">{counts[t.id]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="vom-body">
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", gap: ".75rem", color: "var(--muted-foreground)" }}>
                <Loader2 size={18} style={{ animation: "spin .75s linear infinite" }} />
                <span style={{ fontSize: ".83rem" }}>Loading outputs…</span>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "14px", margin: "0 auto 1rem",
                  background: "rgba(139,92,246,.07)", border: "1px solid rgba(139,92,246,.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileText size={22} color="rgba(139,92,246,.4)" />
                </div>
                <p style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--foreground)", marginBottom: ".375rem" }}>
                  {filter === "all" ? "No outputs yet" : `No ${filter} outputs`}
                </p>
                <p style={{ fontSize: ".75rem", color: "var(--muted-foreground)", marginBottom: "1.25rem" }}>
                  {isGuestMode
                    ? "This prompt has no outputs attached yet."
                    : filter === "all"
                    ? "Attach your first AI-generated output."
                    : `No ${filter} outputs have been attached.`}
                </p>
                {onAttachNew && !isGuestMode && filter === "all" && (
                  <button
                    onClick={() => { onClose(); onAttachNew(); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: ".5rem",
                      padding: ".625rem 1.125rem", borderRadius: "8px", fontSize: ".8rem", fontWeight: 700,
                      background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />Add First Output
                  </button>
                )}
              </div>
            )}

            {!loading && filtered.length > 0 && filtered.map(o => (
              <OutputCard
                key={o.id}
                output={o}
                onDelete={isGuestMode ? null : handleDelete}
                canDelete={canDelete(o)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="vom-footer">
            {onAttachNew && !isGuestMode ? (
              <button className="vom-attach-btn" onClick={() => { onClose(); onAttachNew(); }}>
                <Plus size={13} />Add{outputs.length > 0 ? " Another" : " First"} Output
              </button>
            ) : (
              <div />
            )}
            <button className="vom-close-btn" onClick={onClose}>Close</button>
          </div>

        </div>
      </div>
    </>
  );
}
