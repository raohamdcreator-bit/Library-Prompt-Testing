// src/components/ViewOutputsModal.jsx - Modal to view all outputs for a prompt
// ✅ FIXED: Guest users can now view outputs in read-only mode
import { useState, useEffect } from "react";
import { X, FileText, Code, Image as ImageIcon, Loader2, Plus } from "lucide-react";
import { subscribeToResults, deleteResult } from "../lib/results";
import { useAuth } from "../context/AuthContext";

function OutputCard({ output, onDelete, canDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getOutputIcon = (type) => {
    switch (type) {
      case 'text': return <FileText className="w-5 h-5 text-blue-400" />;
      case 'code': return <Code className="w-5 h-5 text-purple-400" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-pink-400" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'text': return 'output-type-badge-text';
      case 'code': return 'output-type-badge-code';
      case 'image': return 'output-type-badge-image';
      default: return 'output-type-badge-text';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      return timestamp.toDate().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  async function handleCopy() {
    if (output.content) {
      try {
        await navigator.clipboard.writeText(output.content);
        showSuccessToast("Copied to clipboard!");
      } catch (error) {
        console.error("Copy failed:", error);
      }
    }
  }

  function showSuccessToast(message) {
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  return (
    <div className="output-card-compact">
      <div className="output-card-header">
        <div className="output-type-icon">
          {getOutputIcon(output.type)}
        </div>
        <div className="output-meta">
          <h4 className="output-title">{output.title}</h4>
          <div className="output-info">
            <span className={getTypeBadgeClass(output.type)}>
              {output.type.charAt(0).toUpperCase() + output.type.slice(1)}
              {output.type === 'code' && output.language && ` • ${output.language}`}
            </span>
            <span className="output-timestamp">{formatDate(output.createdAt)}</span>
          </div>
        </div>
        <div className="output-actions">
          {output.type !== 'image' && output.content && (
            <button onClick={handleCopy} className="output-action-btn" title="Copy">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {/* ✅ FIX: Check both canDelete AND onDelete exists (onDelete is null for guests) */}
          {canDelete && onDelete && (
            <button onClick={() => onDelete(output)} className="output-action-btn danger" title="Delete">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="output-preview-compact">
        {output.type === 'text' && output.content && (
          <div className="output-text-preview-compact">
            <p className={isExpanded ? '' : 'line-clamp-3'}>
              {output.content}
            </p>
          </div>
        )}

        {output.type === 'code' && output.content && (
          <div className="output-code-preview-compact">
            <pre className={isExpanded ? '' : 'line-clamp-5'}>
              {output.content}
            </pre>
          </div>
        )}

        {output.type === 'image' && output.imageUrl && !imageError && (
          <div className="output-image-preview-compact">
            <img 
              src={output.imageUrl} 
              alt={output.title}
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {imageError && output.type === 'image' && (
          <div className="p-8 text-center text-muted-foreground">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Failed to load image</p>
          </div>
        )}
      </div>

      {((output.type === 'text' || output.type === 'code') && output.content?.length > 300) && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="expand-output-btn"
        >
          {isExpanded ? 'Show less' : 'Show more'}
          <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function ViewOutputsModal({ 
  isOpen, 
  onClose, 
  prompt, 
  teamId, 
  userRole,
  isGuestMode = false,  // ✅ NEW: Guest mode flag
  onAttachNew 
}) {
  const { user } = useAuth();
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !teamId || !prompt?.id) {
      setOutputs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToResults(teamId, prompt.id, (results) => {
      setOutputs(results);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, teamId, prompt?.id]);

  async function handleDelete(output) {
    if (!confirm("Are you sure you want to delete this output?")) return;

    try {
      await deleteResult(teamId, prompt.id, output.id, output.imagePath);
      showSuccessToast("Output deleted successfully");
    } catch (error) {
      console.error("Error deleting output:", error);
      showNotification("Failed to delete output", "error");
    }
  }

  function canDeleteOutput(output) {
    // ✅ FIX: Guests can never delete outputs
    if (isGuestMode) return false;
    
    return (
      output.createdBy === user?.uid ||
      userRole === "owner" ||
      userRole === "admin"
    );
  }

  function showSuccessToast(message) {
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.textContent = message;
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
    notification.className = "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-[9999] text-sm transition-opacity duration-300";
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">AI Outputs {isGuestMode && <span className="text-sm font-normal text-muted-foreground">(Read-Only)</span>}</h2>
            {prompt && (
              <p className="modal-subtitle">
                {prompt.title} • {outputs.length} {outputs.length === 1 ? 'output' : 'outputs'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Loading outputs...</p>
            </div>
          ) : outputs.length === 0 ? (
            <div className="empty-state-outputs">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3>No outputs yet</h3>
              <p>
                {isGuestMode 
                  ? "This prompt doesn't have any AI outputs attached yet"
                  : "Attach your first AI-generated output to this prompt"
                }
              </p>
              {/* ✅ FIX: Only show "Add Output" button if not guest mode */}
              {onAttachNew && !isGuestMode && (
                <button 
                  onClick={() => {
                    onClose();
                    onAttachNew();
                  }} 
                  className="btn-primary mt-4"
                >
                  <Plus className="w-4 h-4" />
                  Add First Output
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="outputs-grid">
                {outputs.map((output) => (
                  <OutputCard
                    key={output.id}
                    output={output}
                    onDelete={isGuestMode ? null : handleDelete}  // ✅ FIX: No delete for guests
                    canDelete={canDeleteOutput(output)}
                  />
                ))}
              </div>

              {/* ✅ FIX: Only show "Add Another Output" button if not guest mode */}
              {onAttachNew && !isGuestMode && (
                <button 
                  onClick={() => {
                    onClose();
                    onAttachNew();
                  }} 
                  className="add-output-cta-modal"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Output
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
