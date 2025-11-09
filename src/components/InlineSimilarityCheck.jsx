// src/components/InlineSimilarityCheck.jsx
// Quick inline similarity check component for individual prompts

import { useState } from "react";
import {
  calculateSimilarity,
  findSimilarItems,
  getSimilarityLevel,
} from "../lib/plagiarism";
import { SimilarityBadge, SimilarityBar } from "./SimilarityBadge";

export default function InlineSimilarityCheck({
  currentItem,
  allItems,
  teamMembers = {},
  threshold = 30,
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  async function checkSimilarity() {
    setIsChecking(true);

    // Simulate async operation for better UX
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Filter out current item from comparison
    const otherItems = allItems.filter((item) => item.id !== currentItem.id);

    // Find similar items
    const similar = findSimilarItems(currentItem.text, otherItems, threshold);

    setResults({
      totalChecked: otherItems.length,
      similarCount: similar.length,
      matches: similar,
      timestamp: new Date(),
    });

    setShowResults(true);
    setIsChecking(false);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      return (
        timestamp.toDate?.()?.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) ||
        new Date(timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    } catch {
      return "";
    }
  }

  return (
    <div className="space-y-3">
      {/* Check Button */}
      {!showResults && (
        <button
          onClick={checkSimilarity}
          disabled={isChecking}
          className="btn-secondary w-full py-2 text-sm flex items-center justify-center gap-2"
        >
          {isChecking ? (
            <>
              <div className="neo-spinner w-4 h-4"></div>
              <span>Checking similarity...</span>
            </>
          ) : (
            <>
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Check for Similar Content</span>
            </>
          )}
        </button>
      )}

      {/* Results */}
      {showResults && results && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h5
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Similarity Check Results
            </h5>
            <button
              onClick={() => setShowResults(false)}
              className="p-1 rounded hover:bg-secondary transition-colors"
              style={{ color: "var(--muted-foreground)" }}
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div
              className="p-2 rounded"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="text-lg font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {results.totalChecked}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Items Checked
              </div>
            </div>
            <div
              className="p-2 rounded"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="text-lg font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {results.similarCount}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Similar Found
              </div>
            </div>
          </div>

          {/* Matches */}
          {results.similarCount === 0 ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">✅</div>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                No similar content found above {threshold}% threshold
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.matches.map((match, index) => {
                const author = teamMembers[match.createdBy];
                const level = getSimilarityLevel(match.similarity);

                return (
                  <div
                    key={index}
                    className="p-3 rounded-lg border"
                    style={{
                      borderColor: `var(--${level.color})`,
                      backgroundColor: "var(--muted)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {match.title}
                        </p>
                        <div
                          className="flex items-center gap-2 text-xs mt-1"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <span>{author?.name || "Unknown"}</span>
                          <span>•</span>
                          <span>{formatDate(match.createdAt)}</span>
                        </div>
                      </div>
                      <SimilarityBadge
                        score={match.similarity}
                        size="small"
                        showLabel={false}
                      />
                    </div>

                    <SimilarityBar
                      score={match.similarity}
                      height="h-1"
                      showPercentage={false}
                    />

                    <p
                      className="text-xs line-clamp-2 mt-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {match.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Re-check button */}
          <button
            onClick={() => {
              setShowResults(false);
              checkSimilarity();
            }}
            className="btn-secondary w-full mt-3 py-1.5 text-xs"
          >
            Re-check
          </button>
        </div>
      )}
    </div>
  );
}
