// src/lib/plagiarism.js
// Comprehensive plagiarism detection and similarity analysis

/**
 * Calculate Levenshtein distance between two strings
 * Used for basic string similarity
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text) return "";
  
  return text
    .toLowerCase()
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    // Remove common punctuation
    .replace(/[.,;:!?()[\]{}'"]/g, "")
    // Remove line breaks
    .replace(/[\r\n]+/g, " ");
}

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter(word => word.length > 2); // Ignore very short words
}

/**
 * Calculate Jaccard similarity coefficient
 * Measures overlap between two sets of tokens
 */
function jaccardSimilarity(tokens1, tokens2) {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate cosine similarity using term frequency
 */
function cosineSimilarity(tokens1, tokens2) {
  // Build term frequency maps
  const freq1 = {};
  const freq2 = {};
  const allTerms = new Set([...tokens1, ...tokens2]);
  
  tokens1.forEach(token => {
    freq1[token] = (freq1[token] || 0) + 1;
  });
  
  tokens2.forEach(token => {
    freq2[token] = (freq2[token] || 0) + 1;
  });
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allTerms.forEach(term => {
    const f1 = freq1[term] || 0;
    const f2 = freq2[term] || 0;
    dotProduct += f1 * f2;
    magnitude1 += f1 * f1;
    magnitude2 += f2 * f2;
  });
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Extract n-grams from token array
 */
function getNGrams(tokens, n = 3) {
  const ngrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(" "));
  }
  return ngrams;
}

/**
 * Calculate n-gram similarity
 * Good for detecting paraphrasing
 */
function ngramSimilarity(tokens1, tokens2, n = 3) {
  if (tokens1.length < n || tokens2.length < n) return 0;
  
  const ngrams1 = getNGrams(tokens1, n);
  const ngrams2 = getNGrams(tokens2, n);
  
  return jaccardSimilarity(ngrams1, ngrams2);
}

/**
 * Calculate longest common subsequence length
 */
function longestCommonSubsequence(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Main similarity calculation function
 * Returns a comprehensive similarity score (0-100)
 */
export function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 100;
  
  // Normalize texts
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  // If normalized texts are identical, return 100
  if (norm1 === norm2) return 100;
  
  // Tokenize
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  // If either is empty, return 0
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // Calculate various similarity metrics
  const jaccard = jaccardSimilarity(tokens1, tokens2);
  const cosine = cosineSimilarity(tokens1, tokens2);
  const ngram = ngramSimilarity(tokens1, tokens2, 3);
  
  // Calculate character-level similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  const levenshtein = levenshteinDistance(norm1, norm2);
  const charSimilarity = maxLen > 0 ? (1 - levenshtein / maxLen) : 0;
  
  // Calculate LCS similarity
  const lcsLength = longestCommonSubsequence(norm1, norm2);
  const lcsSimilarity = lcsLength / Math.max(norm1.length, norm2.length);
  
  // Weighted average of all metrics
  // Give more weight to semantic similarity (cosine, jaccard)
  const similarity =
    (jaccard * 0.25) +
    (cosine * 0.30) +
    (ngram * 0.20) +
    (charSimilarity * 0.15) +
    (lcsSimilarity * 0.10);
  
  return Math.round(similarity * 100);
}

/**
 * Calculate detailed similarity breakdown
 */
export function calculateDetailedSimilarity(text1, text2) {
  if (!text1 || !text2) {
    return {
      overall: 0,
      breakdown: {
        jaccard: 0,
        cosine: 0,
        ngram: 0,
        character: 0,
        lcs: 0
      }
    };
  }
  
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  const jaccard = jaccardSimilarity(tokens1, tokens2);
  const cosine = cosineSimilarity(tokens1, tokens2);
  const ngram = ngramSimilarity(tokens1, tokens2, 3);
  
  const maxLen = Math.max(norm1.length, norm2.length);
  const levenshtein = levenshteinDistance(norm1, norm2);
  const charSimilarity = maxLen > 0 ? (1 - levenshtein / maxLen) : 0;
  
  const lcsLength = longestCommonSubsequence(norm1, norm2);
  const lcsSimilarity = lcsLength / Math.max(norm1.length, norm2.length);
  
  const overall =
    (jaccard * 0.25) +
    (cosine * 0.30) +
    (ngram * 0.20) +
    (charSimilarity * 0.15) +
    (lcsSimilarity * 0.10);
  
  return {
    overall: Math.round(overall * 100),
    breakdown: {
      jaccard: Math.round(jaccard * 100),
      cosine: Math.round(cosine * 100),
      ngram: Math.round(ngram * 100),
      character: Math.round(charSimilarity * 100),
      lcs: Math.round(lcsSimilarity * 100)
    }
  };
}

/**
 * Find similar items in a collection
 */
export function findSimilarItems(targetText, items, threshold = 30) {
  const results = [];
  
  for (const item of items) {
    const similarity = calculateSimilarity(targetText, item.text);
    
    if (similarity >= threshold) {
      results.push({
        ...item,
        similarity
      });
    }
  }
  
  // Sort by similarity (highest first)
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Batch similarity check - find all similar pairs in a collection
 */
export function findAllSimilarPairs(items, threshold = 30) {
  const pairs = [];
  
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const similarity = calculateSimilarity(items[i].text, items[j].text);
      
      if (similarity >= threshold) {
        pairs.push({
          item1: items[i],
          item2: items[j],
          similarity
        });
      }
    }
  }
  
  // Sort by similarity (highest first)
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get similarity level label
 */
export function getSimilarityLevel(score) {
  if (score >= 90) return { level: "identical", color: "destructive", label: "Identical" };
  if (score >= 70) return { level: "high", color: "warning", label: "High Similarity" };
  if (score >= 50) return { level: "medium", color: "primary", label: "Medium Similarity" };
  if (score >= 30) return { level: "low", color: "secondary", label: "Low Similarity" };
  return { level: "none", color: "muted", label: "Minimal Similarity" };
}

/**
 * Extract common phrases between two texts
 */
export function extractCommonPhrases(text1, text2, minLength = 5) {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  const commonPhrases = [];
  
  // Find common phrases of varying lengths
  for (let len = minLength; len >= 3; len--) {
    const phrases1 = getNGrams(words1, len);
    const phrases2 = getNGrams(words2, len);
    
    phrases1.forEach(phrase => {
      if (phrases2.includes(phrase) && !commonPhrases.includes(phrase)) {
        commonPhrases.push(phrase);
      }
    });
  }
  
  return commonPhrases.slice(0, 10); // Return top 10 common phrases
}

/**
 * Generate plagiarism report
 */
export function generatePlagiarismReport(targetItem, similarItems) {
  const highRisk = similarItems.filter(item => item.similarity >= 70);
  const mediumRisk = similarItems.filter(item => item.similarity >= 50 && item.similarity < 70);
  const lowRisk = similarItems.filter(item => item.similarity >= 30 && item.similarity < 50);
  
  return {
    targetItem,
    totalMatches: similarItems.length,
    riskLevel: highRisk.length > 0 ? "high" : mediumRisk.length > 0 ? "medium" : "low",
    highRiskMatches: highRisk,
    mediumRiskMatches: mediumRisk,
    lowRiskMatches: lowRisk,
    timestamp: new Date().toISOString()
  };
}

/**
 * Compare code snippets with language-aware normalization
 */
export function compareCode(code1, code2, language = "javascript") {
  // Remove comments based on language
  let cleanCode1 = code1;
  let cleanCode2 = code2;
  
  if (language === "javascript" || language === "typescript") {
    cleanCode1 = code1.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    cleanCode2 = code2.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  } else if (language === "python") {
    cleanCode1 = code1.replace(/#.*/g, "").replace(/'''[\s\S]*?'''/g, "");
    cleanCode2 = code2.replace(/#.*/g, "").replace(/'''[\s\S]*?'''/g, "");
  }
  
  // Normalize whitespace
  cleanCode1 = cleanCode1.replace(/\s+/g, " ").trim();
  cleanCode2 = cleanCode2.replace(/\s+/g, " ").trim();
  
  return calculateSimilarity(cleanCode1, cleanCode2);
}

export default {
  calculateSimilarity,
  calculateDetailedSimilarity,
  findSimilarItems,
  findAllSimilarPairs,
  getSimilarityLevel,
  extractCommonPhrases,
  generatePlagiarismReport,
  compareCode
};
