// src/components/PlagiarismChecker.jsx
// Main plagiarism detection UI component for admins and owners

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import {
  calculateSimilarity,
  calculateDetailedSimilarity,
  findSimilarItems,
  findAllSimilarPairs,
  getSimilarityLevel,
  extractCommonPhrases,
  generatePlagiarismReport,
  compareCode,
} from "../lib/plagiarism";

export default function PlagiarismChecker({ teamId, userRole }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const [results, setResults] = useState([]);
  const [teamMembers, setTeamMembers] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(30);
  const [analysisMode, setAnalysisMode] = useState("prompts"); // "prompts" or "results"
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sortBy, setSortBy] = useState("similarity"); // "similarity" or "date"

  // Check if user has permission
  const hasPermission = userRole === "owner" || userRole === "admin";

  // Load team data
  useEffect(() => {
    if (!teamId || !hasPermission) {
      setLoading(false);
      return;
    }

    loadTeamData();
  }, [teamId, hasPermission]);

  async function loadTeamData() {
    setLoading(true);
    try {
      // Load prompts
      const promptsSnap = await getDocs(
        collection(db, "teams", teamId, "prompts")
      );
      const promptsData = promptsSnap.docs.map((doc) => ({
        id: doc.id,
        type: "prompt",
        text: doc.data().text || "",
        title: doc.data().title || "",
        createdBy: doc.data().createdBy,
        createdAt: doc.data().createdAt,
        tags: doc.data().tags || [],
      }));
      setPrompts(promptsData);

      // Load results from all prompts
      const allResults = [];
      for (const promptDoc of promptsSnap.docs) {
        const resultsSnap = await getDocs(
          collection(db, "teams", teamId, "prompts", promptDoc.id, "results")
        );
        resultsSnap.docs.forEach((resultDoc) => {
          const data = resultDoc.data();
          if (data.type === "text" || data.type === "code") {
            allResults.push({
              id: resultDoc.id,
              promptId: promptDoc.id,
              type: data.type,
              text: data.content || "",
              title: data.title || "",
              createdBy: data.createdBy,
              createdAt: data.createdAt,
              language: data.language,
            });
          }
        });
      }
      setResults(allResults);

      // Load team member profiles
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      if (teamDoc.exists()) {
        const teamData = teamDoc.data();
        const memberIds = Object.keys(teamData.members || {});
        const profiles = {};

        for (const memberId of memberIds) {
          try {
            const userDoc = await getDoc(doc(db, "users", memberId));
            if (userDoc.exists()) {
              profiles[memberId] = userDoc.data();
            }
          } catch (error) {
            console.error("Error loading member profile:", error);
          }
        }
        setTeamMembers(profiles);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading team data:", error);
      setLoading(false);
      showNotification("Failed to load team data", "error");
    }
  }

  // Run similarity analysis
  async function runAnalysis() {
    setAnalyzing(true);

    try {
      const items = analysisMode === "prompts" ? prompts : results;

      if (items.length < 2) {
        showNotification("Need at least 2 items to analyze", "error");
        setAnalyzing(false);
        return;
      }

      // Find all similar pairs
      const pairs = findAllSimilarPairs(items, similarityThreshold);

      setAnalysisResults({
        mode: analysisMode,
        threshold: similarityThreshold,
        totalItems: items.length,
        totalPairs: pairs.length,
        pairs: pairs,
        timestamp: new Date(),
      });

      if (pairs.length === 0) {
        showNotification("No similar items found above threshold", "info");
      } else {
        showNotification(
          `Found ${pairs.length} similar ${
            analysisMode === "prompts" ? "prompt" : "result"
          } pairs`,
          "success"
        );
      }
    } catch (error) {
      console.error("Analysis error:", error);
      showNotification("Analysis failed", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  // Check individual item
  function checkSimilarity(item) {
    const items = analysisMode === "prompts" ? prompts : results;
    const similar = findSimilarItems(
      item.text,
      items.filter((i) => i.id !== item.id),
      similarityThreshold
    );

    setSelectedItem({
      ...item,
      similarItems: similar,
    });
  }

  // View pair details
  function viewPairDetails(pair) {
    const detailed1 = calculateDetailedSimilarity(
      pair.item1.text,
      pair.item2.text
    );
    const commonPhrases = extractCommonPhrases(
      pair.item1.text,
      pair.item2.text
    );

    setSelectedPair({
      ...pair,
      detailed: detailed1,
      commonPhrases,
    });
    setShowDetailModal(true);
  }

  // Export report
  function exportReport() {
    if (!analysisResults) return;

    const report = {
      team: teamId,
      analysisMode: analysisResults.mode,
      threshold: analysisResults.threshold,
      timestamp: analysisResults.timestamp,
      totalItems: analysisResults.totalItems,
      totalPairs: analysisResults.totalPairs,
      pairs: analysisResults.pairs.map((pair) => ({
        item1: {
          id: pair.item1.id,
          title: pair.item1.title,
          author: teamMembers[pair.item1.createdBy]?.name || "Unknown",
        },
        item2: {
          id: pair.item2.id,
          title: pair.item2.title,
          author: teamMembers[pair.item2.createdBy]?.name || "Unknown",
        },
        similarity: pair.similarity,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plagiarism-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification("Report exported", "success");
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

  function getSimilarityColor(score) {
    const level = getSimilarityLevel(score);
    return `var(--${level.color})`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      return timestamp.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  if (!hasPermission) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--foreground)" }}
        >
          Access Denied
        </h3>
        <p style={{ color: "var(--muted-foreground)" }}>
          Only team owners and admins can access the plagiarism checker.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="neo-spinner mx-auto mb-4"></div>
        <p style={{ color: "var(--muted-foreground)" }}>
          Loading plagiarism checker...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              🔍 Plagiarism Checker
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Detect similar content within your team to maintain originality
            </p>
          </div>
          {analysisResults && (
            <button
              onClick={exportReport}
              className="btn-secondary px-4 py-2 flex items-center gap-2"
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
              Export Report
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Analysis Mode
            </label>
            <select
              value={analysisMode}
              onChange={(e) => {
                setAnalysisMode(e.target.value);
                setAnalysisResults(null);
                setSelectedItem(null);
              }}
              className="form-input"
            >
              <option value="prompts">Prompts ({prompts.length})</option>
              <option value="results">Results ({results.length})</option>
            </select>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Similarity Threshold: {similarityThreshold}%
            </label>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-full"
            />
            <div
              className="flex justify-between text-xs mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              <span>Loose (10%)</span>
              <span>Strict (90%)</span>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {analyzing && <div className="neo-spinner w-4 h-4"></div>}
              <span>{analyzing ? "Analyzing..." : "Run Analysis"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {analysisResults && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Analysis Results
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-input text-sm py-1"
              >
                <option value="similarity">Sort by Similarity</option>
                <option value="date">Sort by Date</option>
              </select>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {analysisResults.totalItems}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Total Items
              </div>
            </div>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {analysisResults.totalPairs}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Similar Pairs
              </div>
            </div>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {analysisResults.pairs.filter((p) => p.similarity >= 70).length}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                High Risk (≥70%)
              </div>
            </div>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {analysisResults.threshold}%
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Threshold
              </div>
            </div>
          </div>

          {/* Pairs List */}
          {analysisResults.pairs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">✅</div>
              <h4
                className="text-lg font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                No Similar Items Found
              </h4>
              <p style={{ color: "var(--muted-foreground)" }}>
                All {analysisResults.mode} appear to be unique above the{" "}
                {analysisResults.threshold}% threshold
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysisResults.pairs
                .sort((a, b) => {
                  if (sortBy === "similarity") {
                    return b.similarity - a.similarity;
                  } else {
                    const dateA = a.item1.createdAt?.toDate() || new Date(0);
                    const dateB = b.item1.createdAt?.toDate() || new Date(0);
                    return dateB - dateA;
                  }
                })
                .map((pair, index) => {
                  const level = getSimilarityLevel(pair.similarity);
                  const author1 = teamMembers[pair.item1.createdBy];
                  const author2 = teamMembers[pair.item2.createdBy];

                  return (
                    <div
                      key={index}
                      className="glass-card p-4 hover:border-primary/50 transition-all cursor-pointer"
                      onClick={() => viewPairDetails(pair)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold"
                            style={{
                              backgroundColor: getSimilarityColor(
                                pair.similarity
                              ),
                              color: "white",
                            }}
                          >
                            {pair.similarity}%
                          </div>
                          <div>
                            <div
                              className="text-sm font-medium px-2 py-1 rounded inline-block"
                              style={{
                                backgroundColor: getSimilarityColor(
                                  pair.similarity
                                ),
                                color: "white",
                              }}
                            >
                              {level.label}
                            </div>
                          </div>
                        </div>
                        <button className="p-2 rounded-lg hover:bg-secondary">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Item 1 */}
                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: "var(--muted)" }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-6 h-6 rounded-full"
                              style={{ backgroundColor: "var(--primary)" }}
                            >
                              <span className="text-xs text-white flex items-center justify-center h-full">
                                {author1?.name?.[0] || "?"}
                              </span>
                            </div>
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--foreground)" }}
                            >
                              {author1?.name || "Unknown"}
                            </span>
                          </div>
                          <p
                            className="text-sm font-semibold mb-1"
                            style={{ color: "var(--foreground)" }}
                          >
                            {pair.item1.title}
                          </p>
                          <p
                            className="text-xs line-clamp-2"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {pair.item1.text}
                          </p>
                          <p
                            className="text-xs mt-2"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {formatDate(pair.item1.createdAt)}
                          </p>
                        </div>

                        {/* Item 2 */}
                        <div
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: "var(--muted)" }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-6 h-6 rounded-full"
                              style={{ backgroundColor: "var(--primary)" }}
                            >
                              <span className="text-xs text-white flex items-center justify-center h-full">
                                {author2?.name?.[0] || "?"}
                              </span>
                            </div>
                            <span
                              className="text-sm font-medium"
                              style={{ color: "var(--foreground)" }}
                            >
                              {author2?.name || "Unknown"}
                            </span>
                          </div>
                          <p
                            className="text-sm font-semibold mb-1"
                            style={{ color: "var(--foreground)" }}
                          >
                            {pair.item2.title}
                          </p>
                          <p
                            className="text-xs line-clamp-2"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {pair.item2.text}
                          </p>
                          <p
                            className="text-xs mt-2"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {formatDate(pair.item2.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
          <div
            className="modal-content w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3
                  className="text-xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  Detailed Similarity Analysis
                </h3>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedPair(null);
                  }}
                  className="p-2 rounded-lg hover:bg-secondary"
                >
                  <svg
                    className="w-5 h-5"
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

              {/* Overall Score */}
              <div
                className="mb-6 p-4 rounded-lg text-center"
                style={{ backgroundColor: "var(--secondary)" }}
              >
                <div
                  className="text-4xl font-bold mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  {selectedPair.similarity}%
                </div>
                <div
                  className="text-sm px-3 py-1 rounded-full inline-block"
                  style={{
                    backgroundColor: getSimilarityColor(
                      selectedPair.similarity
                    ),
                    color: "white",
                  }}
                >
                  {getSimilarityLevel(selectedPair.similarity).label}
                </div>
              </div>

              {/* Breakdown */}
              <div className="mb-6">
                <h4
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--foreground)" }}
                >
                  Similarity Breakdown
                </h4>
                <div className="space-y-2">
                  {Object.entries(selectedPair.detailed.breakdown).map(
                    ([key, value]) => (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span
                            style={{ color: "var(--foreground)" }}
                            className="capitalize"
                          >
                            {key}
                          </span>
                          <span
                            style={{ color: "var(--foreground)" }}
                            className="font-medium"
                          >
                            {value}%
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${value}%`,
                              backgroundColor: getSimilarityColor(value),
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Common Phrases */}
              {selectedPair.commonPhrases.length > 0 && (
                <div className="mb-6">
                  <h4
                    className="text-sm font-semibold mb-3"
                    style={{ color: "var(--foreground)" }}
                  >
                    Common Phrases Found
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPair.commonPhrases.map((phrase, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "var(--accent-foreground)",
                        }}
                      >
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Text Comparison */}
              <div>
                <h4
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--foreground)" }}
                >
                  Full Text Comparison
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div
                      className="text-xs font-medium mb-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {selectedPair.item1.title}
                    </div>
                    <div
                      className="p-3 rounded-lg max-h-64 overflow-y-auto"
                      style={{ backgroundColor: "var(--muted)" }}
                    >
                      <pre
                        className="text-xs whitespace-pre-wrap"
                        style={{ color: "var(--foreground)" }}
                      >
                        {selectedPair.item1.text}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-xs font-medium mb-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {selectedPair.item2.title}
                    </div>
                    <div
                      className="p-3 rounded-lg max-h-64 overflow-y-auto"
                      style={{ backgroundColor: "var(--muted)" }}
                    >
                      <pre
                        className="text-xs whitespace-pre-wrap"
                        style={{ color: "var(--foreground)" }}
                      >
                        {selectedPair.item2.text}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
