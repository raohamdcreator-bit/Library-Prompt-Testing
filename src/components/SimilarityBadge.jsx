// src/components/SimilarityBadge.jsx
// Reusable component for displaying similarity scores

import { getSimilarityLevel } from "../lib/plagiarism";

export function SimilarityBadge({ score, size = "normal", showLabel = true }) {
  const level = getSimilarityLevel(score);

  const sizes = {
    small: {
      container: "w-8 h-8 text-xs",
      text: "text-xs",
    },
    normal: {
      container: "w-12 h-12 text-base",
      text: "text-sm",
    },
    large: {
      container: "w-16 h-16 text-xl",
      text: "text-base",
    },
  };

  const sizeClass = sizes[size] || sizes.normal;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClass.container} rounded-lg flex items-center justify-center font-bold`}
        style={{
          backgroundColor: `var(--${level.color})`,
          color: "white",
        }}
      >
        {score}%
      </div>
      {showLabel && (
        <span
          className={`${sizeClass.text} font-medium px-2 py-1 rounded`}
          style={{
            backgroundColor: `var(--${level.color})`,
            color: "white",
          }}
        >
          {level.label}
        </span>
      )}
    </div>
  );
}

export function SimilarityBar({
  score,
  height = "h-2",
  showPercentage = true,
}) {
  const level = getSimilarityLevel(score);

  return (
    <div className="w-full">
      {showPercentage && (
        <div className="flex justify-between text-sm mb-1">
          <span style={{ color: "var(--foreground)" }}>Similarity</span>
          <span style={{ color: "var(--foreground)" }} className="font-medium">
            {score}%
          </span>
        </div>
      )}
      <div className={`${height} bg-secondary rounded-full overflow-hidden`}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: `var(--${level.color})`,
          }}
        />
      </div>
    </div>
  );
}

export function SimilarityBreakdown({ breakdown }) {
  return (
    <div className="space-y-3">
      <h4
        className="text-sm font-semibold"
        style={{ color: "var(--foreground)" }}
      >
        Similarity Analysis Breakdown
      </h4>
      {Object.entries(breakdown).map(([method, score]) => {
        const level = getSimilarityLevel(score);
        return (
          <div key={method}>
            <div className="flex justify-between text-sm mb-1">
              <span
                style={{ color: "var(--foreground)" }}
                className="capitalize"
              >
                {method === "lcs" ? "Longest Common Subsequence" : method}
              </span>
              <span
                style={{ color: "var(--foreground)" }}
                className="font-medium"
              >
                {score}%
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  backgroundColor: `var(--${level.color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SimilarityBadge;
