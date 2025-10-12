// src/components/BulkOperations.jsx - Cyberpunk Neon Blue Theme
import { useState } from "react";

export default function BulkOperations({
  prompts,
  selectedPrompts,
  onSelectionChange,
  onBulkDelete,
  onBulkExport,
  userRole,
  userId,
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user can perform bulk operations
  function canBulkDelete() {
    if (userRole === "owner" || userRole === "admin") return true;
    // Members can only delete their own prompts
    return selectedPrompts.every((promptId) => {
      const prompt = prompts.find((p) => p.id === promptId);
      return prompt && prompt.createdBy === userId;
    });
  }

  // Get selection stats
  const selectionStats = {
    total: selectedPrompts.length,
    ownedByUser: selectedPrompts.filter((promptId) => {
      const prompt = prompts.find((p) => p.id === promptId);
      return prompt && prompt.createdBy === userId;
    }).length,
    ownedByOthers: selectedPrompts.filter((promptId) => {
      const prompt = prompts.find((p) => p.id === promptId);
      return prompt && prompt.createdBy !== userId;
    }).length,
  };

  // Select all prompts
  function handleSelectAll() {
    if (selectedPrompts.length === prompts.length) {
      onSelectionChange([]); // Deselect all
    } else {
      onSelectionChange(prompts.map((p) => p.id)); // Select all
    }
  }

  // Handle bulk delete
  async function handleBulkDelete() {
    if (!canBulkDelete()) {
      alert(
        "You can only delete prompts you created or have admin permissions."
      );
      return;
    }

    const confirmMessage =
      selectionStats.ownedByOthers > 0
        ? `Delete ${selectionStats.total} prompts? This includes ${selectionStats.ownedByOthers} prompts created by other team members. This cannot be undone.`
        : `Delete ${selectionStats.total} selected prompts? This cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      await onBulkDelete(selectedPrompts);
      onSelectionChange([]); // Clear selection after deletion
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Failed to delete some prompts. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  // Handle bulk export
  async function handleBulkExport(format) {
    setIsExporting(true);
    try {
      const selectedPromptData = prompts.filter((p) =>
        selectedPrompts.includes(p.id)
      );
      await onBulkExport(selectedPromptData, format);
    } catch (error) {
      console.error("Bulk export error:", error);
      alert("Failed to export prompts. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  if (prompts.length === 0) return null;

  return (
    <div 
      className="glass-card border rounded-lg p-4 mb-4 transition-all duration-300"
      style={{ 
        borderColor: 'var(--border)',
        boxShadow: '0 0 20px rgba(0, 200, 255, 0.1)',
      }}
    >
      {/* Selection Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={
                selectedPrompts.length === prompts.length && prompts.length > 0
              }
              onChange={handleSelectAll}
              className="rounded"
              style={{ 
                accentColor: 'var(--primary)',
                width: '18px',
                height: '18px',
              }}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Select All ({prompts.length})
            </span>
          </label>

          {selectedPrompts.length > 0 && (
            <div 
              className="text-sm px-3 py-1 rounded-full"
              style={{
                background: 'rgba(0, 200, 255, 0.2)',
                color: 'var(--primary)',
                border: '1px solid rgba(0, 200, 255, 0.3)',
              }}
            >
              {selectedPrompts.length} selected
              {selectionStats.ownedByOthers > 0 && (
                <span className="ml-2" style={{ color: '#eab308' }}>
                  ({selectionStats.ownedByOthers} by others)
                </span>
              )}
            </div>
          )}
        </div>

        {selectedPrompts.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            className="text-sm px-3 py-1 rounded transition-all duration-300"
            style={{ 
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--primary)';
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted-foreground)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedPrompts.length > 0 && (
        <div 
          className="flex items-center gap-3 pt-4 flex-wrap"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--primary)' }}>
            <span>⚡</span>
            Bulk Actions:
          </span>

          {/* Export Options */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkExport("json")}
              disabled={isExporting}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
            >
              {isExporting && <div className="neo-spinner w-3 h-3"></div>}
              Export JSON
            </button>

            <button
              onClick={() => handleBulkExport("csv")}
              disabled={isExporting}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
            >
              {isExporting && <div className="neo-spinner w-3 h-3"></div>}
              Export CSV
            </button>

            <button
              onClick={() => handleBulkExport("txt")}
              disabled={isExporting}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
            >
              {isExporting && <div className="neo-spinner w-3 h-3"></div>}
              Export TXT
            </button>
          </div>

          {/* Delete Option */}
          {canBulkDelete() && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="btn-danger text-sm px-3 py-1.5 flex items-center gap-1 ml-2 disabled:opacity-50"
            >
              {isDeleting && <div className="neo-spinner w-3 h-3"></div>}
              Delete Selected
            </button>
          )}

          {!canBulkDelete() && selectionStats.ownedByOthers > 0 && (
            <span className="text-xs ml-2" style={{ color: '#eab308' }}>
              Cannot delete prompts created by others
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Individual prompt selection checkbox component
export function PromptSelector({
  promptId,
  isSelected,
  onSelectionChange,
  className = "",
}) {
  return (
    <label className={`flex items-center cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelectionChange(promptId, e.target.checked)}
        className="rounded"
        style={{ 
          accentColor: 'var(--primary)',
          width: '18px',
          height: '18px',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent event bubbling
      />
    </label>
  );
}
