//src/components/PromptResults.jsx
// Main component for displaying and managing prompt results
// FIXED: Prevents glitching and render loops when toggling results

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { subscribeToResults, deleteResult } from "../lib/results";
import AddResultModal from "./AddResultModal";
import ResultCard from "./ResultCard";

export default function PromptResults({
  teamId,
  promptId,
  userRole,
  onResultsChange,
}) {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedResults, setExpandedResults] = useState(new Set());

  // FIX: Use refs to track state and prevent render loops
  const lastCountRef = useRef(0);
  const isInitialMount = useRef(true);

  // Subscribe to real-time results
  useEffect(() => {
    if (!teamId || !promptId) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    isInitialMount.current = true;

    const unsubscribe = subscribeToResults(teamId, promptId, (newResults) => {
      setResults(newResults);
      setLoading(false);

      // FIX: Only call onResultsChange if:
      // 1. The callback exists
      // 2. The count has actually changed
      // 3. Defer the update to next tick to prevent render loop
      if (onResultsChange && newResults.length !== lastCountRef.current) {
        lastCountRef.current = newResults.length;

        // Use setTimeout to defer parent update to next event loop tick
        // This breaks the synchronous render cycle and prevents glitching
        setTimeout(() => {
          onResultsChange(newResults.length);
        }, 0);
      }

      isInitialMount.current = false;
    });

    return () => {
      unsubscribe();
      // Reset refs on unmount
      isInitialMount.current = true;
    };
  }, [teamId, promptId]); // FIX: Don't include onResultsChange in deps

  async function handleDelete(resultId, imagePath) {
    if (!confirm("Are you sure you want to delete this result?")) return;

    try {
      await deleteResult(teamId, promptId, resultId, imagePath);
      showNotification("Result deleted", "success");
    } catch (error) {
      console.error("Error deleting result:", error);
      showNotification("Failed to delete result", "error");
    }
  }

  function toggleExpanded(resultId) {
    setExpandedResults((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  }

  function canDeleteResult(result) {
    return (
      result.createdBy === user.uid ||
      userRole === "owner" ||
      userRole === "admin"
    );
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

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="neo-spinner mx-auto mb-2"></div>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Loading results...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4
          className="text-lg font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          AI Output Results ({results.length})
        </h4>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>Add Result</span>
        </button>
      </div>

      {/* Results List */}
      {results.length === 0 ? (
        <div
          className="glass-card p-8 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-4xl mb-3">📋</div>
          <h5
            className="text-base font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            No results yet
          </h5>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            Add your first AI output result to track your work
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Add First Result
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              isExpanded={expandedResults.has(result.id)}
              onToggleExpand={() => toggleExpanded(result.id)}
              onDelete={
                canDeleteResult(result)
                  ? () => handleDelete(result.id, result.imagePath)
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Add Result Modal */}
      <AddResultModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        promptId={promptId}
        teamId={teamId}
        userId={user.uid}
      />
    </div>
  );
}
