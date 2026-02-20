// src/components/ViewOutputsModal.jsx
//
// ═══════════════════════════════════════════════════════════════════════════════
// ALL BUGS FIXED — full analysis in comments below each fix
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, FileText, Code, Image as ImageIcon, Loader2,
  Plus, Copy, Trash2, ChevronDown, ChevronUp, Check,
  ZoomIn, Maximize2,
} from "lucide-react";
import { subscribeToResults, deleteResult } from "../lib/results";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

const TYPE_COLOR = { code: "#a78bfa", image: "#f472b6", text: "#60a5fa" };
const TYPE_BG    = {
  code:  "rgba(167,139,250,.13)",
  image: "rgba(244,114,182,.13)",
  text:  "rgba(96,165,250,.13)",
};
function typeColor(t) { return TYPE_COLOR[t] ?? TYPE_COLOR.text; }
function typeBg(t)    { return TYPE_BG[t]    ?? TYPE_BG.text; }

function TypeIcon({ type, size = 14 }) {
  const c = typeColor(type);
  if (type === "code")  return <Code      size={size} color={c} />;
  if (type === "image") return <ImageIcon size={size} color={c} />;
  return <FileText size={size} color={c} />;
}

// ─── Image Lightbox ────────────────────────────────────────────────────────────
// FIX 7: Full-size image view that was completely missing before
function Lightbox({ src, title, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,.93)", backdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem", animation: "lbIn .15s ease-out",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: "1.25rem", right: "1.25rem",
          width: "36px", height: "36px", borderRadius: "10px",
          background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .13s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.22)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; }}
      >
        <X size={16} />
      </button>
      <img
        src={src} alt={title}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
          borderRadius: "10px", boxShadow: "0 24px 80px rgba(0,0,0,.7)",
        }}
      />
    </div>
  );
}

// ─── Gradient fade overlay — signals hidden content below ──────────────────────
// FIX 8: Visual affordance that content continues below the visible area
function ClipFade() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "3.5rem",
        background: "linear-gradient(to bottom, transparent, var(--card) 88%)",
        pointerEvents: "none", borderRadius: "0 0 8px 8px",
      }}
    />
  );
}

// ─── OutputCard ────────────────────────────────────────────────────────────────
function OutputCard({ output, onDelete, canDelete }) {
  const contentRef = useRef(null);

  // FIX 5: Detect REAL rendered overflow (replaces brittle char-count threshold).
  // scrollHeight > clientHeight is always accurate regardless of font/zoom/width.
  const [realOverflow, setRealOverflow] = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [lightbox,     setLightbox]     = useState(false);
  const [imgErr,       setImgErr]       = useState(false);

  const measureOverflow = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    setRealOverflow(el.scrollHeight > el.clientHeight + 4);
  }, []);

  useEffect(() => {
    measureOverflow();
    // Re-measure when fonts load or layout changes
    const ro = new ResizeObserver(measureOverflow);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [measureOverflow, output.content, output.imageUrl]);

  const color = typeColor(output.type);
  const bg    = typeBg(output.type);

  // Collapsed heights chosen to show a clear "peek" without wasting space
  const COLLAPSE_TEXT  = "6.6rem";   // ≈ 4 lines at .8rem/1.65 line-height
  const COLLAPSE_CODE  = "7.8rem";   // ≈ 5 lines at .73rem/1.6 line-height
  const COLLAPSE_IMG   = "200px";
  const EXPAND_MAX     = "min(55vh, 500px)"; // FIX 6: cap so modal footer stays reachable

  async function handleCopy() {
    if (!output.content) return;
    await navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Text renderer ────────────────────────────────────────────────────────────
  // FIX 2: Single clipping mechanism only. The wrapper div does ALL clipping/scrolling.
  // The inner <p> has NO webkit-box — that caused overflow:visible to defeat overflow:auto.
  function TextContent() {
    return (
      <div style={{ position: "relative" }}>
        <div
          ref={contentRef}
          style={{
            maxHeight: expanded ? EXPAND_MAX : COLLAPSE_TEXT,
            overflowY: expanded ? "auto" : "hidden",
            overflowX: "hidden",
            transition: "max-height .28s cubic-bezier(.4,0,.2,1)",
            borderRadius: "8px",
            padding: ".65rem .75rem",
            background: "rgba(0,0,0,.18)",
            border: "1px solid rgba(255,255,255,.05)",
            scrollbarWidth: "thin",
            scrollbarColor: `${color}50 transparent`,
          }}
        >
          <p style={{
            fontSize: ".8rem", lineHeight: 1.7,
            color: "rgba(228,228,231,.86)",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            // NO webkit-box — the wrapper handles truncation
          }}>
            {output.content}
          </p>
        </div>
        {!expanded && realOverflow && <ClipFade />}
      </div>
    );
  }

  // ── Code renderer ────────────────────────────────────────────────────────────
  // FIX 3: webkit-box on a whiteSpace:pre element is unreliable. Pure height-clip.
  // FIX 4 + 9: overflowX:auto always on so horizontal scroll always works.
  function CodeContent() {
    return (
      <div style={{ position: "relative" }}>
        <div
          ref={contentRef}
          style={{
            maxHeight: expanded ? EXPAND_MAX : COLLAPSE_CODE,
            overflowY: "auto",   // always scrollable vertically
            overflowX: "auto",   // always scrollable horizontally (code lines can be long)
            transition: "max-height .28s cubic-bezier(.4,0,.2,1)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,.07)",
            background: "#0c0d13",
            scrollbarWidth: "thin",
            scrollbarColor: `${color}50 transparent`,
          }}
        >
          <pre style={{
            margin: 0,
            padding: ".75rem .9rem",
            fontSize: ".73rem",
            lineHeight: 1.65,
            color: "#dde4f0",
            fontFamily: "'JetBrains Mono','Consolas','Fira Code',monospace",
            whiteSpace: "pre",         // keep pre — height clip on wrapper handles truncation
            minWidth: "max-content",   // forces container to recognise full line width for h-scroll
            display: "block",          // never webkit-box on a <pre>
          }}>
            {output.content}
          </pre>
        </div>

        {/* FIX 8+9: gradient + scroll hint when collapsed */}
        {!expanded && realOverflow && (
          <>
            <ClipFade />
            <div style={{
              position: "absolute", top: ".45rem", right: ".5rem",
              fontSize: ".58rem", fontWeight: 700, letterSpacing: ".04em",
              color, background: bg, border: `1px solid ${color}35`,
              padding: ".1rem .42rem", borderRadius: "4px", pointerEvents: "none",
            }}>
              ⟷ scroll
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Image renderer ────────────────────────────────────────────────────────────
  // FIX 7: Clickable image + lightbox. Expand toggles natural height.
  function ImageContent() {
    if (imgErr) return (
      <div style={{
        padding: "2.5rem 1rem", textAlign: "center", borderRadius: "8px",
        background: "rgba(0,0,0,.2)", border: "1px solid rgba(255,255,255,.06)",
      }}>
        <ImageIcon size={32} color="rgba(244,114,182,.35)"
          style={{ margin: "0 auto .625rem", display: "block" }} />
        <p style={{ fontSize: ".76rem", color: "var(--muted-foreground)", margin: 0 }}>
          Image failed to load
        </p>
      </div>
    );
    if (!output.imageUrl) return null;

    return (
      <div style={{ position: "relative" }}>
        <div
          ref={contentRef}
          onClick={() => setLightbox(true)}
          style={{
            maxHeight: expanded ? EXPAND_MAX : COLLAPSE_IMG,
            overflow: "hidden",
            transition: "max-height .3s cubic-bezier(.4,0,.2,1)",
            borderRadius: "8px",
            background: "rgba(0,0,0,.22)",
            border: "1px solid rgba(255,255,255,.06)",
            cursor: "zoom-in",
          }}
        >
          <img
            src={output.imageUrl}
            alt={output.title || "Output image"}
            onError={() => setImgErr(true)}
            style={{ width: "100%", display: "block", objectFit: "contain" }}
          />
        </div>
        {/* Zoom button */}
        <button
          onClick={() => setLightbox(true)}
          title="View full size"
          style={{
            position: "absolute", top: ".5rem", right: ".5rem",
            width: "28px", height: "28px", borderRadius: "7px",
            background: "rgba(0,0,0,.65)", border: "1px solid rgba(255,255,255,.18)",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background .13s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,.88)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,.65)"; }}
        >
          <ZoomIn size={13} />
        </button>
        {!expanded && realOverflow && <ClipFade />}
      </div>
    );
  }

  const hasContent = output.type === "image" ? !!output.imageUrl : !!output.content;
  const showToggle = hasContent && realOverflow;

  return (
    <>
      {/*
        FIX 1: Card wrapper has NO overflow:hidden.
        Before: overflow:hidden physically clipped the Show-more button when the
        content box was at maxHeight. The button appeared BELOW the clipped area
        and became invisible, giving users no way to expand.
        Now: wrapper clips only its border-radius visually via border-radius;
        the inner content box does all clipping.
      */}
      <div style={{
        borderRadius: "12px",
        border: `1px solid ${expanded ? color + "38" : "rgba(255,255,255,.07)"}`,
        background: "rgba(255,255,255,.022)",
        transition: "border-color .2s",
        // No overflow:hidden here
      }}>

        {/* ── Card header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: ".625rem",
          padding: ".75rem .875rem",
          background: "rgba(255,255,255,.018)",
          borderBottom: "1px solid rgba(255,255,255,.055)",
          borderRadius: "12px 12px 0 0",
        }}>
          {/* Type icon */}
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: bg, border: `1px solid ${color}28`,
          }}>
            <TypeIcon type={output.type} size={15} />
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: ".84rem", fontWeight: 700, color: "var(--foreground)",
              marginBottom: ".22rem",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {output.title || "Untitled"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: ".4rem", flexWrap: "wrap" }}>
              <span style={{
                fontSize: ".61rem", fontWeight: 700, padding: ".09rem .42rem",
                borderRadius: "4px", background: bg, color, border: `1px solid ${color}28`,
              }}>
                {output.type === "code" && output.language
                  ? `Code · ${output.language}`
                  : output.type.charAt(0).toUpperCase() + output.type.slice(1)}
              </span>
              <span style={{ fontSize: ".63rem", color: "var(--muted-foreground)" }}>
                {fmtDate(output.createdAt)}
              </span>
              {output.content && output.type !== "image" && (
                <span style={{
                  fontSize: ".61rem", color: "var(--muted-foreground)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {output.content.length.toLocaleString()} chars
                </span>
              )}
              {output.imageSize && (
                <span style={{ fontSize: ".61rem", color: "var(--muted-foreground)" }}>
                  {(output.imageSize / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: ".35rem", alignItems: "center", flexShrink: 0 }}>
            {output.type !== "image" && output.content && (
              <button
                onClick={handleCopy}
                title={copied ? "Copied!" : "Copy to clipboard"}
                style={{
                  width: "28px", height: "28px", borderRadius: "7px",
                  border: `1px solid ${copied ? "rgba(74,222,128,.3)" : "rgba(255,255,255,.1)"}`,
                  background: copied ? "rgba(74,222,128,.1)" : "rgba(255,255,255,.04)",
                  color: copied ? "#4ade80" : "var(--muted-foreground)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s",
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
            {output.type === "image" && output.imageUrl && (
              <button
                onClick={() => setLightbox(true)}
                title="View full size"
                style={{
                  width: "28px", height: "28px", borderRadius: "7px",
                  border: "1px solid rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.04)",
                  color: "var(--muted-foreground)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--muted-foreground)"; }}
              >
                <Maximize2 size={12} />
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(output)}
                title="Delete"
                style={{
                  width: "28px", height: "28px", borderRadius: "7px",
                  border: "1px solid rgba(239,68,68,.18)",
                  background: "rgba(239,68,68,.07)", color: "#f87171",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(239,68,68,.18)";
                  e.currentTarget.style.borderColor = "rgba(239,68,68,.35)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(239,68,68,.07)";
                  e.currentTarget.style.borderColor = "rgba(239,68,68,.18)";
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Content area ── */}
        {hasContent && (
          <div style={{ padding: ".75rem .875rem .5rem" }}>
            {output.type === "text"  && <TextContent />}
            {output.type === "code"  && <CodeContent />}
            {output.type === "image" && <ImageContent />}
          </div>
        )}

        {/*
          FIX 4 + 6: Show-more row is a SEPARATE section below the content area.
          It is NEVER inside any height-clipped or overflow-hidden container,
          so it is ALWAYS visible regardless of how tall the content is.
          Before: button was inside the content padding div which was clipped by
          the card's overflow:hidden, making it invisible for many outputs.
        */}
        <div style={{
          padding: ".375rem .875rem .65rem",
          borderTop: hasContent ? "1px solid rgba(255,255,255,.04)" : "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          minHeight: "2.25rem",
        }}>
          {showToggle ? (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: ".35rem",
                fontSize: ".71rem", fontWeight: 700,
                color, background: bg, border: `1px solid ${color}30`,
                padding: ".28rem .65rem", borderRadius: "6px",
                cursor: "pointer", transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.background = bg; }}
            >
              {expanded
                ? <><ChevronUp size={11} />Show less</>
                : <><ChevronDown size={11} />Show more</>}
            </button>
          ) : (
            // Placeholder so layout height is consistent
            <span style={{
              fontSize: ".67rem", color: "var(--muted-foreground)",
              fontStyle: "italic", opacity: .7,
            }}>
              {hasContent && output.type !== "image" ? "Full content visible" : ""}
            </span>
          )}

          {/* Total chars hint — only when content is truncated */}
          {!expanded && realOverflow && output.type !== "image" && output.content && (
            <span style={{
              fontSize: ".62rem", color: "var(--muted-foreground)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {output.content.length.toLocaleString()} chars total
            </span>
          )}
        </div>

      </div>

      {lightbox && output.imageUrl && (
        <Lightbox
          src={output.imageUrl}
          title={output.title}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
export default function ViewOutputsModal({
  isOpen,
  onClose,
  prompt,
  teamId,
  userRole,
  isGuestMode = false,
  onAttachNew,
}) {
  const { user }              = useAuth();
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    if (!isOpen || !teamId || !prompt?.id) {
      setOutputs([]); setLoading(false); return;
    }
    setLoading(true);
    const unsub = subscribeToResults(teamId, prompt.id, results => {
      setOutputs(results);
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen, teamId, prompt?.id]);

  // If filtered type disappears (e.g. last code output deleted), fall back to All
  useEffect(() => {
    if (!loading && filter !== "all") {
      if (!outputs.some(o => o.type === filter)) setFilter("all");
    }
  }, [outputs, loading, filter]);

  async function handleDelete(output) {
    if (!confirm("Delete this output? This cannot be undone.")) return;
    try { await deleteResult(teamId, prompt.id, output.id, output.imagePath); }
    catch { alert("Failed to delete output."); }
  }

  function canDelete(output) {
    if (isGuestMode) return false;
    return output.createdBy === user?.uid
      || userRole === "owner"
      || userRole === "admin";
  }

  const counts = { all: outputs.length, text: 0, code: 0, image: 0 };
  outputs.forEach(o => { if (o.type in counts) counts[o.type]++; });

  const filtered = filter === "all" ? outputs : outputs.filter(o => o.type === filter);

  const filterTabs = [
    { id: "all",   label: "All",   icon: null       },
    { id: "text",  label: "Text",  icon: FileText    },
    { id: "code",  label: "Code",  icon: Code        },
    { id: "image", label: "Image", icon: ImageIcon   },
  ].filter(t => t.id === "all" || counts[t.id] > 0);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes vomFadeIn  { from { opacity: 0 }               to { opacity: 1 } }
        @keyframes vomSlideIn { from { opacity: 0; transform: translateY(16px) scale(.979) } to { opacity: 1; transform: none } }
        @keyframes vomSpin    { to   { transform: rotate(360deg) } }
        @keyframes lbIn       { from { opacity: 0 }               to { opacity: 1 } }

        .vom-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center; padding: 1rem;
          background: rgba(0,0,0,.78); backdrop-filter: blur(7px);
          animation: vomFadeIn .18s ease-out;
        }

        /*
          FIX 10: Use explicit height (not just max-height) so the flex column
          can reliably allocate flex:1 to .vom-body. Some browsers treat
          max-height differently in flex containers and body may not scroll.
        */
        .vom-shell {
          width: 100%;
          max-width: 700px;
          height: min(90vh, 780px);
          display: flex;
          flex-direction: column;
          background: var(--card);
          border: 1px solid rgba(139,92,246,.18);
          border-radius: 20px;
          box-shadow: 0 40px 90px rgba(0,0,0,.65), 0 0 0 1px rgba(139,92,246,.07);
          overflow: hidden;
          animation: vomSlideIn .24s cubic-bezier(.4,0,.2,1);
        }

        .vom-hd {
          padding: 1.125rem 1.375rem 1rem;
          border-bottom: 1px solid rgba(139,92,246,.1);
          display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem;
          flex-shrink: 0;
        }
        .vom-title    { font-size: .93rem; font-weight: 700; color: var(--foreground); letter-spacing: -.01em; }
        .vom-subtitle { font-size: .68rem; color: var(--muted-foreground); margin-top: .2rem; }
        .vom-x {
          width: 28px; height: 28px; border-radius: 7px; border: none; cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: transparent; color: var(--muted-foreground); transition: all .14s;
        }
        .vom-x:hover { background: rgba(255,255,255,.07); color: var(--foreground); }

        .vom-fbar {
          display: flex; align-items: center; gap: .3rem;
          padding: .55rem 1.375rem;
          border-bottom: 1px solid rgba(255,255,255,.04);
          flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
        }
        .vom-fbar::-webkit-scrollbar { display: none; }

        .vom-fbtn {
          display: flex; align-items: center; gap: .35rem;
          padding: .28rem .6rem; border-radius: 6px; font-size: .71rem; font-weight: 600;
          border: 1px solid transparent; background: transparent;
          color: var(--muted-foreground); cursor: pointer; transition: all .14s; white-space: nowrap;
        }
        .vom-fbtn:hover  { background: rgba(255,255,255,.04); color: var(--foreground); }
        .vom-fbtn.active { background: rgba(139,92,246,.12); border-color: rgba(139,92,246,.22); color: var(--primary); }
        .vom-fcount {
          font-size: .58rem; padding: .04rem .34rem; border-radius: 999px;
          background: rgba(139,92,246,.18); color: var(--primary); font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /*
          FIX 10 cont.: flex:1 + overflow-y:auto = body takes all remaining height and scrolls.
          overflow:hidden on the shell clips the border-radius; body scrolls independently.
        */
        .vom-body {
          flex: 1;
          min-height: 0;             /* critical: without this, flex children don't shrink */
          overflow-y: auto;
          overflow-x: hidden;
          padding: .875rem 1.375rem 1rem;
          display: flex; flex-direction: column; gap: .625rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(139,92,246,.28) transparent;
        }
        .vom-body::-webkit-scrollbar       { width: 5px; }
        .vom-body::-webkit-scrollbar-thumb { background: rgba(139,92,246,.3); border-radius: 3px; }
        .vom-body::-webkit-scrollbar-track { background: transparent; }

        /* Propagate scrollbar style into card inner scroll regions */
        .vom-body *::-webkit-scrollbar       { width: 4px; height: 4px; }
        .vom-body *::-webkit-scrollbar-thumb { background: rgba(139,92,246,.3); border-radius: 2px; }
        .vom-body *::-webkit-scrollbar-track { background: transparent; }

        .vom-ft {
          padding: .7rem 1.375rem;
          border-top: 1px solid rgba(139,92,246,.08);
          display: flex; align-items: center; justify-content: space-between; gap: .75rem;
          flex-shrink: 0; background: rgba(0,0,0,.1); flex-wrap: wrap;
        }
        .vom-add {
          display: flex; align-items: center; gap: .45rem;
          padding: .475rem .85rem; border-radius: 8px; font-size: .77rem; font-weight: 700;
          background: rgba(139,92,246,.1); color: var(--primary);
          border: 1px dashed rgba(139,92,246,.28); cursor: pointer; transition: all .14s;
        }
        .vom-add:hover { background: rgba(139,92,246,.17); border-style: solid; }
        .vom-cls {
          padding: .475rem .95rem; border-radius: 8px; font-size: .77rem; font-weight: 600;
          background: transparent; color: var(--muted-foreground);
          border: 1px solid rgba(255,255,255,.1); cursor: pointer; transition: all .14s;
        }
        .vom-cls:hover { color: var(--foreground); border-color: rgba(255,255,255,.22); }

        .vom-empty {
          display: flex; flex-direction: column; align-items: center;
          padding: 4rem 1rem; gap: .625rem; text-align: center;
        }
        .vom-empty-icon {
          width: 52px; height: 52px; border-radius: 14px; margin-bottom: .25rem;
          background: rgba(139,92,246,.07); border: 1px solid rgba(139,92,246,.12);
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>

      <div className="vom-overlay" onClick={onClose}>
        <div className="vom-shell" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="vom-hd">
            <div>
              <div className="vom-title">
                AI Outputs
                {isGuestMode && (
                  <span style={{
                    fontSize: ".67rem", fontWeight: 400,
                    color: "var(--muted-foreground)", marginLeft: ".5rem",
                  }}>
                    · read-only
                  </span>
                )}
              </div>
              {prompt && (
                <div className="vom-subtitle">
                  {prompt.title}&ensp;·&ensp;
                  {outputs.length} {outputs.length === 1 ? "output" : "outputs"}
                  {filter !== "all" && filtered.length !== outputs.length && (
                    <>&ensp;·&ensp;showing {filtered.length} {filter}</>
                  )}
                </div>
              )}
            </div>
            <button className="vom-x" onClick={onClose}><X size={14} /></button>
          </div>

          {/* Filter bar — only when multiple types exist */}
          {!loading && outputs.length > 0 && filterTabs.length > 1 && (
            <div className="vom-fbar">
              {filterTabs.map(t => (
                <button
                  key={t.id}
                  className={`vom-fbtn${filter === t.id ? " active" : ""}`}
                  onClick={() => setFilter(t.id)}
                >
                  {t.icon && <t.icon size={11} />}
                  {t.label}
                  <span className="vom-fcount">{counts[t.id]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Scrollable body */}
          <div className="vom-body">

            {loading && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "4rem", gap: ".75rem", color: "var(--muted-foreground)",
              }}>
                <Loader2 size={18} color="var(--primary)"
                  style={{ animation: "vomSpin .8s linear infinite" }} />
                <span style={{ fontSize: ".82rem" }}>Loading outputs…</span>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="vom-empty">
                <div className="vom-empty-icon">
                  <FileText size={22} color="rgba(139,92,246,.4)" />
                </div>
                <p style={{
                  fontSize: ".875rem", fontWeight: 700,
                  color: "var(--foreground)", margin: 0,
                }}>
                  {filter === "all" ? "No outputs yet" : `No ${filter} outputs`}
                </p>
                <p style={{
                  fontSize: ".75rem", color: "var(--muted-foreground)",
                  margin: 0, lineHeight: 1.6, maxWidth: "280px",
                }}>
                  {isGuestMode
                    ? "This prompt has no outputs attached yet."
                    : filter !== "all"
                    ? `No ${filter} outputs found. Switch to "All" or add one.`
                    : "Attach AI-generated text, code, or images to this prompt."}
                </p>
                {onAttachNew && !isGuestMode && filter === "all" && (
                  <button
                    onClick={() => { onClose(); onAttachNew(); }}
                    style={{
                      marginTop: ".5rem",
                      display: "inline-flex", alignItems: "center", gap: ".45rem",
                      padding: ".6rem 1.125rem", borderRadius: "8px",
                      fontSize: ".79rem", fontWeight: 700,
                      background: "var(--primary)", color: "#fff",
                      border: "none", cursor: "pointer",
                    }}
                  >
                    <Plus size={13} />Add First Output
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
          <div className="vom-ft">
            {onAttachNew && !isGuestMode ? (
              <button className="vom-add" onClick={() => { onClose(); onAttachNew(); }}>
                <Plus size={12} />
                {outputs.length > 0 ? "Add Another Output" : "Add First Output"}
              </button>
            ) : (
              <div />
            )}
            <button className="vom-cls" onClick={onClose}>Close</button>
          </div>

        </div>
      </div>
    </>
  );
}
