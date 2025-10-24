//src/components/ResultCard.jsx
// Individual result card component - Using CSS-only syntax highlighting

import { useState } from "react";

export default function ResultCard({
  result,
  isExpanded,
  onToggleExpand,
  onDelete,
}) {
  const [imageError, setImageError] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.content);
      showNotification("Copied to clipboard!", "success");
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
        showNotification("Download started", "success");
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
      showNotification("Download started", "success");
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
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "500",
      border: "1px solid var(--border)",
    };

    switch (result.type) {
      case "text":
        return {
          ...baseStyle,
          backgroundColor: "var(--secondary)",
          color: "var(--secondary-foreground)",
        };
      case "code":
        return {
          ...baseStyle,
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        };
      case "image":
        return {
          ...baseStyle,
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground)",
        };
      default:
        return baseStyle;
    }
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
    <div className="glass-card p-4 transition-all duration-300 hover:border-primary/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-2xl">{getTypeIcon()}</div>
          <div className="flex-1 min-w-0">
            <h5
              className="font-semibold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              {result.title}
            </h5>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={getTypeBadgeStyle()}>
                {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                {result.type === "code" &&
                  result.language &&
                  ` (${result.language})`}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {formatDate(result.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {result.type !== "image" && (
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg transition-colors hover:scale-105"
              style={{
                backgroundColor: "var(--secondary)",
                color: "var(--foreground)",
              }}
              title="Copy to clipboard"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}

          <button
            onClick={handleDownload}
            className="p-2 rounded-lg transition-colors hover:scale-105"
            style={{
              backgroundColor: "var(--secondary)",
              color: "var(--foreground)",
            }}
            title="Download"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 rounded-lg transition-colors hover:scale-105"
              style={{
                backgroundColor: "var(--destructive)",
                color: "var(--destructive-foreground)",
              }}
              title="Delete result"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}

          <button
            onClick={onToggleExpand}
            className="p-2 rounded-lg transition-colors hover:scale-105"
            style={{
              backgroundColor: "var(--secondary)",
              color: "var(--foreground)",
            }}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content Preview */}
      {!isExpanded && (
        <>
          {result.type === "text" && (
            <div
              className="p-3 rounded-lg border text-sm line-clamp-3"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              {result.content}
            </div>
          )}
          {result.type === "code" && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "var(--border)" }}
            >
              <pre
                className="p-3 text-xs font-mono line-clamp-3 overflow-x-auto"
                style={{
                  backgroundColor: "#1e1e1e",
                  color: "#d4d4d4",
                }}
              >
                {result.content}
              </pre>
            </div>
          )}
          {result.type === "image" && !imageError && result.imageUrl && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "var(--border)" }}
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
          className="space-y-3 mt-3 border-t pt-3"
          style={{ borderColor: "var(--border)" }}
        >
          {result.type === "text" && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              <pre
                className="whitespace-pre-wrap text-sm"
                style={{ color: "var(--foreground)" }}
              >
                {result.content}
              </pre>
            </div>
          )}

          {result.type === "code" && (
            <div
              className="rounded-lg overflow-hidden border"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="px-4 py-2 text-xs font-medium border-b flex items-center justify-between"
                style={{
                  backgroundColor: "#2d2d2d",
                  borderColor: "#404040",
                  color: "#d4d4d4",
                }}
              >
                <span>{result.language || "code"}</span>
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
                    fontFamily: "JetBrains Mono, Consolas, monospace",
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
              style={{ borderColor: "var(--border)" }}
            >
              <img
                src={result.imageUrl}
                alt={result.title}
                className="w-full h-auto max-h-[600px] object-contain bg-black/5"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {imageError && result.type === "image" && (
            <div
              className="p-8 text-center rounded-lg border"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              <div className="text-4xl mb-2">⚠</div>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Failed to load image
              </p>
            </div>
          )}

          {/* Metadata */}
          <div
            className="flex items-center gap-4 text-xs"
            style={{ color: "var(--muted-foreground)" }}
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
