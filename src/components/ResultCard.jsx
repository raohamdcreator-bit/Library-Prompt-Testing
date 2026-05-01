// src/components/ResultCard.jsx - Full image display fix
import { useState } from "react";
import { useSoundEffects } from '../hooks/useSoundEffects';
import { X, ZoomIn } from "lucide-react";

function Icon({ name, className = "w-4 h-4" }) {
  const icons = {
    copy: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    chevronDown: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
    chevronUp: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />,
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
}

// Full-screen lightbox for any image
function ImageLightbox({ src, title, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,.92)", backdropFilter: "blur(18px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem", animation: "rcLbIn .15s ease-out",
      }}
    >
      <style>{`@keyframes rcLbIn { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:none } }`}</style>
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: "1.25rem", right: "1.25rem",
          width: "38px", height: "38px", borderRadius: "10px",
          background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.22)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <X size={16} />
      </button>
      <img
        src={src}
        alt={title}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: "10px",
          boxShadow: "0 24px 80px rgba(0,0,0,.7)",
        }}
      />
      {title && (
        <div style={{
          position: "absolute", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,.7)", color: "#fff", borderRadius: "8px",
          padding: ".4rem 1rem", fontSize: ".8rem", maxWidth: "80%",
          textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {title}
        </div>
      )}
    </div>
  );
}

export default function ResultCard({ result, isExpanded, onToggleExpand, onDelete }) {
  const [imageError, setImageError]   = useState(false);
  const [lightboxOpen, setLightbox]   = useState(false);
  const { playNotification }          = useSoundEffects();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.content);
      playNotification();
      showSuccessToast("Copied to clipboard!");
    } catch {
      showNotification("Failed to copy", "error");
    }
  }

  async function handleDownload() {
    if (result.type === "image" && result.imageUrl) {
      try {
        const response = await fetch(result.imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.imageFilename || "image.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccessToast("Download started");
      } catch {
        showNotification("Failed to download", "error");
      }
    } else if (result.content) {
      const blob = new Blob([result.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${
        result.type === "code" ? result.language || "txt" : "txt"
      }`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccessToast("Download started");
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      return timestamp.toDate().toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  function getTypeIcon() {
    switch (result.type) {
      case "text":  return "📄";
      case "code":  return "💻";
      case "image": return "🖼️";
      default:      return "📋";
    }
  }

  function getTypeBadgeStyle() {
    const base = {
      padding: "4px 12px", borderRadius: "10px", fontSize: "0.75rem",
      fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px",
    };
    switch (result.type) {
      case "text":  return { ...base, backgroundColor: "rgba(59,130,246,.15)",  color: "rgba(59,130,246,.95)",  border: "1px solid rgba(59,130,246,.25)" };
      case "code":  return { ...base, backgroundColor: "rgba(139,92,246,.15)",  color: "rgba(139,92,246,.95)",  border: "1px solid rgba(139,92,246,.25)" };
      case "image": return { ...base, backgroundColor: "rgba(236,72,153,.15)", color: "rgba(236,72,153,.95)", border: "1px solid rgba(236,72,153,.25)" };
      default:      return base;
    }
  }

  function showSuccessToast(message) {
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.parentNode?.removeChild(toast); }, 3000);
  }

  function showNotification(message, type = "info") {
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = `
      position:fixed;top:1rem;right:1rem;z-index:99998;
      padding:.6rem 1rem;border-radius:8px;font-size:.8rem;font-weight:600;
      background:var(--card);color:var(--foreground);
      border:1px solid var(--${type === "error" ? "destructive" : "primary"});
    `;
    document.body.appendChild(el);
    setTimeout(() => el.parentNode?.removeChild(el), 3000);
  }

  // ── Image block — used in both collapsed and expanded states ─────────────────
  // KEY FIX: objectFit:"contain" + width/height:auto so ANY aspect ratio shows
  // completely. No cropping. Clicking opens the lightbox for a full-screen view.
  function ImageBlock({ maxH = "340px" }) {
    if (imageError || !result.imageUrl) {
      return (
        <div style={{
          padding: "2rem", textAlign: "center", borderRadius: "8px",
          background: "rgba(0,0,0,.2)", border: "1px solid rgba(239,68,68,.2)",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>⚠️</div>
          <p style={{ fontSize: ".8rem", color: "var(--muted-foreground)", margin: 0 }}>
            Failed to load image
          </p>
        </div>
      );
    }
    return (
      <div
        style={{
          position: "relative",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid rgba(139,92,246,.2)",
          background: "rgba(0,0,0,.25)",
          cursor: "zoom-in",
          // Center the image regardless of orientation
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxHeight: maxH,
        }}
        onClick={() => setLightbox(true)}
      >
        <img
          src={result.imageUrl}
          alt={result.title}
          onError={() => setImageError(true)}
          style={{
            // FULL image always visible — no cropping for any aspect ratio
            display: "block",
            maxWidth: "100%",
            maxHeight: maxH,
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
        {/* Zoom hint overlay */}
        <button
          onClick={e => { e.stopPropagation(); setLightbox(true); }}
          title="View full size"
          style={{
            position: "absolute", top: ".6rem", right: ".6rem",
            width: "30px", height: "30px", borderRadius: "8px",
            background: "rgba(0,0,0,.65)", border: "1px solid rgba(255,255,255,.2)",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background .13s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,.88)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,.65)"; }}
        >
          <ZoomIn size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="result-card-premium">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="text-2xl flex-shrink-0">{getTypeIcon()}</div>
            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-base mb-2 truncate" style={{ color: "var(--foreground)" }}>
                {result.title}
              </h5>
              <div className="flex items-center gap-3 flex-wrap">
                <span style={getTypeBadgeStyle()}>
                  {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                  {result.type === "code" && result.language && ` • ${result.language}`}
                </span>
                <span className="text-xs" style={{ color: "rgba(228,228,231,.5)" }}>
                  {formatDate(result.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {result.type !== "image" && (
              <button onClick={handleCopy} className="action-btn-premium" title="Copy">
                <Icon name="copy" />
              </button>
            )}
            <button onClick={handleDownload} className="action-btn-premium" title="Download">
              <Icon name="download" />
            </button>
            {onDelete && (
              <button onClick={onDelete} className="action-btn-premium danger" title="Delete">
                <Icon name="trash" />
              </button>
            )}
            {/* Only show expand toggle for text/code — images always show fully */}
            {result.type !== "image" && (
              <button onClick={onToggleExpand} className="action-btn-premium"
                title={isExpanded ? "Collapse" : "Expand"}>
                <Icon name={isExpanded ? "chevronUp" : "chevronDown"} />
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}

        {/* IMAGE: always fully visible, no collapse/expand needed */}
        {result.type === "image" && <ImageBlock maxH="500px" />}

        {/* TEXT collapsed */}
        {result.type === "text" && !isExpanded && (
          <div style={{
            padding: "1rem", borderRadius: "8px",
            background: "rgba(0,0,0,.2)", border: "1px solid rgba(139,92,246,.1)",
            color: "rgba(228,228,231,.7)", fontSize: ".875rem",
            maxHeight: "80px", overflow: "hidden", position: "relative",
          }}>
            <div style={{
              background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.3))",
              position: "absolute", bottom: 0, left: 0, right: 0, height: "30px",
              pointerEvents: "none",
            }} />
            {result.content?.slice(0, 150)}...
          </div>
        )}

        {/* CODE collapsed */}
        {result.type === "code" && !isExpanded && (
          <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(139,92,246,.2)" }}>
            <pre style={{
              padding: "1rem", fontSize: ".75rem", fontFamily: "'JetBrains Mono','Consolas',monospace",
              background: "#1e1e1e", color: "#d4d4d4",
              maxHeight: "80px", overflow: "hidden", margin: 0, position: "relative",
            }}>
              <div style={{
                background: "linear-gradient(to bottom, transparent 50%, #1e1e1e)",
                position: "absolute", bottom: 0, left: 0, right: 0, height: "30px",
                pointerEvents: "none",
              }} />
              {result.content?.slice(0, 200)}...
            </pre>
          </div>
        )}

        {/* Expanded TEXT */}
        {result.type === "text" && isExpanded && (
          <div style={{
            padding: "1rem", borderRadius: "8px",
            background: "rgba(0,0,0,.2)", border: "1px solid rgba(139,92,246,.1)",
          }}>
            <pre className="whitespace-pre-wrap text-sm font-sans" style={{
              color: "rgba(228,228,231,.85)", lineHeight: "1.6", margin: 0,
            }}>
              {result.content}
            </pre>
          </div>
        )}

        {/* Expanded CODE */}
        {result.type === "code" && isExpanded && (
          <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(139,92,246,.2)" }}>
            <div style={{
              padding: ".5rem 1rem", background: "#2d2d2d", borderBottom: "1px solid #404040",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: ".75rem", fontWeight: 600, color: "#d4d4d4" }}>
                {result.language || "code"}
              </span>
              <span style={{ fontSize: ".75rem", color: "#858585" }}>
                {result.content?.split("\n").length || 0} lines
              </span>
            </div>
            <div style={{ background: "#1e1e1e", maxHeight: "500px", overflow: "auto" }}>
              <pre style={{
                padding: "1rem", fontSize: ".8rem", margin: 0,
                fontFamily: "'JetBrains Mono','Consolas',monospace",
                color: "#d4d4d4",
              }}>
                {result.content?.split("\n").map((line, i) => (
                  <div key={i} style={{ display: "flex" }}>
                    <span style={{ minWidth: "3em", color: "#858585", userSelect: "none", paddingRight: "1rem", textAlign: "right" }}>
                      {i + 1}
                    </span>
                    <span>{line || " "}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}

        {/* Metadata row */}
        {isExpanded && (
          <div style={{
            display: "flex", gap: "1rem", fontSize: ".75rem",
            color: "rgba(228,228,231,.5)", marginTop: ".75rem",
            paddingTop: ".75rem", borderTop: "1px solid rgba(139,92,246,.1)",
          }}>
            {result.type === "text" && <span>{result.content?.length || 0} characters</span>}
            {result.type === "code" && (
              <><span>{result.content?.length || 0} chars</span><span>•</span>
                <span>{result.content?.split("\n").length || 0} lines</span></>
            )}
            {result.type === "image" && result.imageSize && (
              <><span>{(result.imageSize / 1024).toFixed(1)} KB</span>
                {result.imageType && <><span>•</span><span>{result.imageType}</span></>}</>
            )}
          </div>
        )}
      </div>

      {lightboxOpen && result.imageUrl && (
        <ImageLightbox
          src={result.imageUrl}
          title={result.title}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}
