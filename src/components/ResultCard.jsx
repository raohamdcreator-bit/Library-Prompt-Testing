// src/components/ResultCard.jsx - Premium Result Card Design
import { useState } from "react";

function Icon({ name, className = "w-4 h-4" }) {
  const icons = {
    copy: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    chevronDown: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
}

export default function ResultCard({ result, isExpanded, onToggleExpand, onDelete }) {
  const [imageError, setImageError] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.content);
      showSuccessToast("Copied to clipboard!");
    } catch (error) {
      console.error("Error copying:", error);
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
      } catch (error) {
        console.error("Error downloading:", error);
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
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function getTypeIcon() {
    switch (result.type) {
      case "text":
        return "📄";
      case "code":
        return "💻";
      case "image":
        return "🖼️";
      default:
        return "📋";
    }
  }

  function getTypeBadgeStyle() {
    const baseStyle = {
      padding: "4px 12px",
      borderRadius: "10px",
      fontSize: "0.75rem",
      fontWeight: "600",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    };

    switch (result.type) {
      case "text":
        return {
          ...baseStyle,
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          color: "rgba(59, 130, 246, 0.95)",
          border: "1px solid rgba(59, 130, 246, 0.25)",
        };
      case "code":
        return {
          ...baseStyle,
          backgroundColor: "rgba(139, 92, 246, 0.15)",
          color: "rgba(139, 92, 246, 0.95)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
        };
      case "image":
        return {
          ...baseStyle,
          backgroundColor: "rgba(236, 72, 153, 0.15)",
          color: "rgba(236, 72, 153, 0.95)",
          border: "1px solid rgba(236, 72, 153, 0.25)",
        };
      default:
        return baseStyle;
    }
  }

  function showSuccessToast(message) {
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.innerHTML = `
      <div class="success-icon">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  function showNotification(message, type = "info") {
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const notification = document.createElement("div");
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
      </div>
    `;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${type === "error" ? "destructive" : "primary"});
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

  return (
    <div className="result-card-premium">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="text-2xl flex-shrink-0">{getTypeIcon()}</div>
          <div className="flex-1 min-w-0">
            <h5
              className="font-semibold text-base mb-2 truncate"
              style={{ color: "var(--foreground)" }}
            >
              {result.title}
            </h5>
            <div className="flex items-center gap-3 flex-wrap">
              <span style={getTypeBadgeStyle()}>
                {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                {result.type === "code" && result.language && ` • ${result.language}`}
              </span>
              <span
                className="text-xs"
                style={{ color: "rgba(228, 228, 231, 0.5)" }}
              >
                {formatDate(result.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {result.type !== "image" && (
            <button
              onClick={handleCopy}
              className="action-btn-premium"
              title="Copy to clipboard"
            >
              <Icon name="copy" />
            </button>
          )}

          <button
            onClick={handleDownload}
            className="action-btn-premium"
            title="Download"
          >
            <Icon name="download" />
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              className="action-btn-premium danger"
              title="Delete result"
            >
              <Icon name="trash" />
            </button>
          )}

          <button
            onClick={onToggleExpand}
            className="action-btn-premium"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <Icon name="chevronDown" />
          </button>
        </div>
      </div>

      {/* Content Preview (Collapsed) */}
      {!isExpanded && (
        <>
          {result.type === "text" && (
            <div
              className="p-4 rounded-lg border text-sm"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderColor: "rgba(139, 92, 246, 0.1)",
                color: "rgba(228, 228, 231, 0.7)",
                maxHeight: "80px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div style={{
                background: "linear-gradient(to bottom, transparent 60%, rgba(0, 0, 0, 0.3))",
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "30px",
                pointerEvents: "none",
              }}></div>
              {result.content.slice(0, 150)}...
            </div>
          )}

          {result.type === "code" && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
            >
              <pre
                className="p-4 text-xs font-mono overflow-hidden"
                style={{
                  backgroundColor: "#1e1e1e",
                  color: "#d4d4d4",
                  maxHeight: "80px",
                  position: "relative",
                }}
              >
                <div style={{
                  background: "linear-gradient(to bottom, transparent 60%, #1e1e1e)",
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "30px",
                  pointerEvents: "none",
                }}></div>
                {result.content.slice(0, 200)}...
              </pre>
            </div>
          )}

          {result.type === "image" && !imageError && result.imageUrl && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
            >
              <img
                src={result.imageUrl}
                alt={result.title}
                className="w-full h-48 object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          )}
        </>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className="space-y-4 mt-4 pt-4 border-t"
          style={{ borderColor: "rgba(139, 92, 246, 0.15)" }}
        >
          {result.type === "text" && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderColor: "rgba(139, 92, 246, 0.1)",
              }}
            >
              <pre
                className="whitespace-pre-wrap text-sm font-sans"
                style={{ color: "rgba(228, 228, 231, 0.85)", lineHeight: "1.6" }}
              >
                {result.content}
              </pre>
            </div>
          )}

          {result.type === "code" && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
            >
              <div
                className="px-4 py-2 text-xs font-medium border-b flex items-center justify-between"
                style={{
                  backgroundColor: "#2d2d2d",
                  borderColor: "#404040",
                  color: "#d4d4d4",
                }}
              >
                <span className="font-semibold">{result.language || "code"}</span>
                <span className="text-gray-400">
                  {result.content?.split("\n").length || 0} lines
                </span>
              </div>
              <div
                style={{
                  backgroundColor: "#1e1e1e",
                  maxHeight: "500px",
                  overflow: "auto",
                }}
              >
                <pre
                  className="p-4 text-sm font-mono"
                  style={{
                    color: "#d4d4d4",
                    margin: 0,
                    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                  }}
                >
                  {result.content?.split("\n").map((line, i) => (
                    <div key={i} className="flex">
                      <span
                        className="select-none pr-4 text-right"
                        style={{
                          minWidth: "3em",
                          color: "#858585",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span>{line || " "}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          )}

          {result.type === "image" && !imageError && result.imageUrl && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
            >
              <img
                src={result.imageUrl}
                alt={result.title}
                className="w-full h-auto max-h-[600px] object-contain"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {imageError && result.type === "image" && (
            <div
              className="p-8 text-center rounded-lg border"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderColor: "rgba(239, 68, 68, 0.3)",
              }}
            >
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Failed to load image
              </p>
            </div>
          )}

          {/* Metadata */}
          <div
            className="flex items-center gap-4 text-xs pt-3 border-t"
            style={{ 
              color: "rgba(228, 228, 231, 0.5)",
              borderColor: "rgba(139, 92, 246, 0.1)",
            }}
          >
            {result.type === "text" && (
              <span>{result.content?.length || 0} characters</span>
            )}
            {result.type === "code" && (
              <>
                <span>{result.content?.length || 0} characters</span>
                <span>•</span>
                <span>{result.content?.split("\n").length || 0} lines</span>
              </>
            )}
            {result.type === "image" && result.imageSize && (
              <>
                <span>{(result.imageSize / 1024).toFixed(1)} KB</span>
                {result.imageType && (
                  <>
                    <span>•</span>
                    <span>{result.imageType}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
