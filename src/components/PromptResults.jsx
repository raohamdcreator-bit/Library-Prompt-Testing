// src/components/PromptResults.jsx - Premium Results UI with Enhanced CTA
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { subscribeToResults, deleteResult } from "../lib/results";
import AddResultModal from "./AddResultModal";
import ResultCard from "./ResultCard";

function Icon({ name, className = "w-5 h-5" }) {
  const icons = {
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
    arrowRight: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
}

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

      // Prevent render loops by deferring parent updates
      if (onResultsChange && newResults.length !== lastCountRef.current) {
        lastCountRef.current = newResults.length;
        setTimeout(() => {
          onResultsChange(newResults.length);
        }, 0);
      }

      isInitialMount.current = false;
    });

    return () => {
      unsubscribe();
      isInitialMount.current = true;
    };
  }, [teamId, promptId]);

  async function handleDelete(resultId, imagePath) {
    if (!confirm("Are you sure you want to delete this result?")) return;

    try {
      await deleteResult(teamId, promptId, resultId, imagePath);
      showSuccessToast("Result deleted");
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

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="neo-spinner mx-auto mb-3"></div>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Loading results...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4
            className="text-lg font-semibold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            AI Output Results
          </h4>
          <p
            className="text-xs"
            style={{ color: "rgba(228, 228, 231, 0.5)" }}
          >
            {results.length === 0
              ? "No results yet"
              : `${results.length} ${results.length === 1 ? "result" : "results"}`}
          </p>
        </div>
      </div>

      {/* Premium Add Result CTA */}
      <button
        onClick={() => setShowAddModal(true)}
        className="add-result-cta"
      >
        <Icon name="plus" className="w-5 h-5" />
        <span>Add New Result</span>
        <Icon name="arrowRight" className="w-4 h-4" />
      </button>

      {/* Results List */}
      {results.length === 0 ? (
        <div
          className="glass-card p-10 text-center rounded-xl"
          style={{
            borderColor: "rgba(139, 92, 246, 0.15)",
            background: "rgba(17, 19, 24, 0.4)",
          }}
        >
          <div className="text-5xl mb-4 opacity-50">📊</div>
          <h5
            className="text-base font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            No results yet
          </h5>
          <p
            className="text-sm mb-6 max-w-md mx-auto"
            style={{ color: "var(--muted-foreground)", lineHeight: "1.5" }}
          >
            Store your AI-generated outputs here. Track text responses, code snippets, and images all in one place.
          </p>
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
