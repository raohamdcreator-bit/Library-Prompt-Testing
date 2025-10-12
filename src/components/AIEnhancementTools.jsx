// src/components/AIEnhancementTools.jsx - Enhanced AI Tools Implementation
import { useState, useEffect } from "react";

// AI Enhancement Service
class AIEnhancementService {
  // Detect prompt type and domain
  static detectPromptType(text) {
    const lowerText = text.toLowerCase();
    
    const types = {
      coding: /code|program|function|class|algorithm|debug|implement|javascript|python|css|html|react/i.test(text),
      writing: /write|essay|article|blog|story|content|copy|draft|compose/i.test(text),
      analysis: /analyze|examine|evaluate|assess|review|compare|investigate/i.test(text),
      creative: /creative|imagine|design|brainstorm|innovative|artistic|generate ideas/i.test(text),
      explanation: /explain|describe|clarify|elaborate|define|what is|how does/i.test(text),
      translation: /translate|convert|transform|adapt|language/i.test(text),
      summarization: /summarize|condense|brief|overview|key points|tldr/i.test(text),
      question: /\?|question|ask|inquiry|wondering/i.test(text),
      instruction: /step by step|guide|tutorial|how to|instructions|procedure/i.test(text),
      dataProcessing: /data|dataset|csv|json|parse|extract|process/i.test(text),
    };
    
    const detected = Object.entries(types)
      .filter(([_, matches]) => matches)
      .map(([type, _]) => type);
    
    return detected.length > 0 ? detected : ['general'];
  }

  // Extract key topics from text
  static extractTopics(text) {
    // Remove common words
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'please', 'about']);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
    
    // Count frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // Get top topics
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  // Analyze prompt complexity
  static analyzeComplexity(text) {
    const words = text.trim().split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(Boolean).length;
    const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;
    const hasInstructions = /please|must|should|need to|required|ensure|make sure/i.test(text);
    const hasExamples = /example|for instance|such as|like|e\.g\.|i\.e\./i.test(text);
    const hasContext = /context|background|about|regarding|concerning/i.test(text);
    const hasConstraints = /don't|avoid|without|except|only|limit|maximum|minimum/i.test(text);
    const hasFormat = /format|structure|organize|list|table|bullet|numbered/i.test(text);
    
    let complexity = 0;
    let level = "Simple";
    let suggestions = [];
    
    // Calculate complexity score
    if (words > 150) complexity += 3;
    else if (words > 100) complexity += 2;
    else if (words > 50) complexity += 1;
    
    if (avgWordsPerSentence > 25) complexity += 2;
    else if (avgWordsPerSentence > 15) complexity += 1;
    
    if (hasInstructions) complexity += 1;
    if (hasExamples) complexity += 1;
    if (hasContext) complexity += 1;
    if (hasConstraints) complexity += 1;
    if (hasFormat) complexity += 1;
    
    // Determine level
    if (complexity >= 7) {
      level = "Complex";
      suggestions.push("Well-structured complex prompt with clear requirements");
    } else if (complexity >= 4) {
      level = "Moderate";
      suggestions.push("Good balance of clarity and detail");
    } else {
      level = "Simple";
      suggestions.push("Consider adding more context and specific requirements");
    }
    
    // Specific suggestions
    if (!hasInstructions) {
      suggestions.push("Add action verbs: 'Create', 'Analyze', 'Generate', 'Explain'");
    }
    if (!hasExamples && words > 50) {
      suggestions.push("Include examples: 'For example: [your example]'");
    }
    if (!hasContext && words > 50) {
      suggestions.push("Add context: 'Context: [background information]'");
    }
    if (!hasConstraints && words > 50) {
      suggestions.push("Specify constraints: 'Avoid X', 'Focus on Y', 'Limit to Z'");
    }
    if (!hasFormat && words > 50) {
      suggestions.push("Specify output format: 'Provide as bullet points', 'Use markdown'");
    }
    
    return {
      score: complexity,
      level,
      words,
      sentences,
      avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
      hasInstructions,
      hasExamples,
      hasContext,
      hasConstraints,
      hasFormat,
      suggestions
    };
  }
  
  // Optimize prompt with context awareness
  static optimizePrompt(text) {
    let optimized = text.trim();
    const improvements = [];
    const promptTypes = this.detectPromptType(text);
    const topics = this.extractTopics(text);
    
    // Remove extra whitespace
    if (/\s{2,}/.test(optimized)) {
      optimized = optimized.replace(/\s+/g, ' ');
      improvements.push("Removed extra whitespace");
    }
    
    // Add structure for long prompts
    if (!optimized.includes('\n') && optimized.length > 200) {
      const sentences = optimized.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 3) {
        // Group sentences into logical paragraphs
        const paragraphs = [];
        for (let i = 0; i < sentences.length; i += 2) {
          paragraphs.push(sentences.slice(i, i + 2).join(' '));
        }
        optimized = paragraphs.join('\n\n');
        improvements.push("Added paragraph breaks for better readability");
      }
    }
    
    // Add clear instruction format based on prompt type
    const hasActionVerb = /^(please|you are|act as|your task|create|write|generate|explain|analyze|describe|provide|list|summarize|translate)/i.test(optimized);
    
    if (!hasActionVerb) {
      if (promptTypes.includes('coding')) {
        optimized = `Create a solution for the following:\n\n${optimized}`;
        improvements.push("Added clear coding task instruction");
      } else if (promptTypes.includes('writing')) {
        optimized = `Write the following:\n\n${optimized}`;
        improvements.push("Added clear writing instruction");
      } else if (promptTypes.includes('analysis')) {
        optimized = `Analyze the following:\n\n${optimized}`;
        improvements.push("Added clear analysis instruction");
      } else {
        optimized = `Your task:\n\n${optimized}`;
        improvements.push("Added clear task prefix");
      }
    }
    
    // Suggest adding specificity if missing
    if (!/(specific|detailed|clear|exact|precise|comprehensive)/i.test(optimized)) {
      improvements.push("💡 Consider: Add specificity markers like 'Be specific about...', 'Provide detailed...'");
    }
    
    // Suggest format specification
    if (!/(format|structure|organize|as a|in the form of)/i.test(optimized) && optimized.length > 100) {
      improvements.push("💡 Consider: Specify output format (e.g., 'Provide as bullet points', 'Use markdown')");
    }
    
    return {
      original: text,
      optimized,
      improvements,
      changed: optimized !== text,
      detectedTypes: promptTypes,
      topics
    };
  }
  
  // Generate context-aware variations
  static generateVariations(text) {
    const variations = [];
    const promptTypes = this.detectPromptType(text);
    const topics = this.extractTopics(text);
    const mainType = promptTypes[0] || 'general';
    
    // Detect if it's a question
    const isQuestion = text.trim().endsWith('?');
    
    // Extract core request (remove fluff)
    const coreRequest = text
      .replace(/^(please|kindly|could you|can you|would you)/i, '')
      .trim();
    
    // 1. Detailed/Comprehensive variation
    variations.push({
      name: "📚 Detailed & Comprehensive",
      text: this.createDetailedVariation(coreRequest, mainType, topics),
      description: "Maximum detail with examples and context"
    });
    
    // 2. Concise/Direct variation
    variations.push({
      name: "⚡ Concise & Direct",
      text: this.createConciseVariation(coreRequest, mainType),
      description: "Brief and to-the-point"
    });
    
    // 3. Step-by-step variation
    variations.push({
      name: "📋 Step-by-Step Guide",
      text: this.createStepByStepVariation(coreRequest, mainType),
      description: "Structured sequential approach"
    });
    
    // 4. Creative/Exploratory variation
    variations.push({
      name: "💡 Creative & Exploratory",
      text: this.createCreativeVariation(coreRequest, mainType, topics),
      description: "Innovative and diverse perspectives"
    });
    
    // 5. Professional/Formal variation
    variations.push({
      name: "🎯 Professional & Formal",
      text: this.createProfessionalVariation(coreRequest, mainType),
      description: "Formal business-appropriate tone"
    });
    
    // 6. Type-specific variation
    if (mainType === 'coding') {
      variations.push({
        name: "💻 Code-Focused",
        text: `Write production-ready, well-documented code for:\n\n${coreRequest}\n\nRequirements:\n- Include error handling\n- Add inline comments\n- Follow best practices\n- Provide usage examples`,
        description: "Optimized for coding tasks"
      });
    } else if (mainType === 'writing') {
      variations.push({
        name: "✍️ Writer's Format",
        text: `Create compelling content for:\n\n${coreRequest}\n\nConsiderations:\n- Target audience engagement\n- Clear narrative flow\n- Strong opening and closing\n- SEO-friendly if applicable`,
        description: "Optimized for content writing"
      });
    } else if (mainType === 'analysis') {
      variations.push({
        name: "🔍 Deep Analysis",
        text: `Provide a comprehensive analysis of:\n\n${coreRequest}\n\nInclude:\n- Key findings\n- Supporting evidence\n- Multiple perspectives\n- Data-driven insights\n- Actionable conclusions`,
        description: "Thorough analytical approach"
      });
    }
    
    return variations;
  }
  
  // Helper methods for variation creation
  static createDetailedVariation(coreRequest, type, topics) {
    return `Provide an extremely detailed and comprehensive response for the following:

${coreRequest}

Please include:
- In-depth explanation with all relevant details
- Multiple examples demonstrating key concepts
- Step-by-step breakdown where applicable
- Context and background information
- Best practices and common pitfalls to avoid${topics.length > 0 ? `\n- Focus on: ${topics.join(', ')}` : ''}
- Summary of key takeaways

Format: Use clear headings, bullet points, and code blocks where appropriate.`;
  }
  
  static createConciseVariation(coreRequest, type) {
    return `Provide a concise, direct response:

${coreRequest}

Requirements:
- Be brief and to-the-point
- Focus only on essential information
- Use simple, clear language
- Limit to 3-5 key points maximum`;
  }
  
  static createStepByStepVariation(coreRequest, type) {
    return `Break down the following into clear, actionable steps:

${coreRequest}

Format as a numbered list where each step includes:
1. Action to take
2. Why it's important
3. Expected outcome
4. Common issues to watch for

Conclude with a verification checklist.`;
  }
  
  static createCreativeVariation(coreRequest, type, topics) {
    return `Think creatively and explore innovative solutions for:

${coreRequest}

Approach:
- Think outside the box
- Consider unconventional methods
- Explore multiple angles and perspectives
- Challenge assumptions${topics.length > 0 ? `\n- Draw connections to: ${topics.join(', ')}` : ''}
- Suggest novel ideas

Prioritize innovation over convention.`;
  }
  
  static createProfessionalVariation(coreRequest, type) {
    return `Provide a professional, business-appropriate response to:

${coreRequest}

Standards:
- Use formal, professional language
- Support claims with evidence or reasoning
- Structure content logically
- Include executive summary
- Provide actionable recommendations
- Cite sources when applicable

Tone: Professional, authoritative, objective.`;
  }
  
  // Suggest context-aware improvements
  static suggestImprovements(text) {
    const suggestions = [];
    const analysis = this.analyzeComplexity(text);
    const promptTypes = this.detectPromptType(text);
    const topics = this.extractTopics(text);
    
    // Length checks
    if (text.length < 20) {
      suggestions.push({
        type: "Length",
        issue: "Prompt is too short (less than 20 characters)",
        suggestion: "Expand your prompt to at least 50 characters for better AI understanding",
        priority: "high",
        example: `Example: Instead of "Write code", try "Write a Python function that validates email addresses using regex"`
      });
    } else if (text.length < 50) {
      suggestions.push({
        type: "Detail",
        issue: "Prompt lacks detail",
        suggestion: "Add more context about what you want to achieve",
        priority: "high",
        example: `Add: purpose, audience, style, constraints, or desired format`
      });
    }
    
    // Punctuation
    if (!/[.!?]$/.test(text.trim())) {
      suggestions.push({
        type: "Formatting",
        issue: "Missing ending punctuation",
        suggestion: "End your prompt with proper punctuation (. ! ?)",
        priority: "low",
        example: null
      });
    }
    
    // Examples
    if (!analysis.hasExamples && text.length > 100) {
      suggestions.push({
        type: "Clarity",
        issue: "No examples provided",
        suggestion: "Include concrete examples to clarify expectations",
        priority: "medium",
        example: `Add: "For example: [specific example of what you want]"`
      });
    }
    
    // Context
    if (!analysis.hasContext && text.length > 100) {
      suggestions.push({
        type: "Context",
        issue: "Missing background context",
        suggestion: "Provide relevant background information",
        priority: "medium",
        example: `Add: "Context: I'm building a web app that needs to..." or "Background: This is for..."`
      });
    }
    
    // Structure
    if (!/\n/.test(text) && text.length > 200) {
      suggestions.push({
        type: "Readability",
        issue: "No paragraph breaks",
        suggestion: "Break long prompts into clear sections",
        priority: "medium",
        example: `Use line breaks to separate: Task, Requirements, Constraints, Format`
      });
    }
    
    // Output format
    if (!analysis.hasFormat && text.length > 100) {
      suggestions.push({
        type: "Output Format",
        issue: "No format specification",
        suggestion: "Specify how you want the response formatted",
        priority: "medium",
        example: `Add: "Provide as: bullet points" or "Format: JSON" or "Structure: introduction, body, conclusion"`
      });
    }
    
    // Constraints
    if (!analysis.hasConstraints && text.length > 100) {
      suggestions.push({
        type: "Constraints",
        issue: "No constraints or limitations specified",
        suggestion: "Define what to include/exclude",
        priority: "low",
        example: `Add: "Avoid technical jargon" or "Focus only on beginner concepts" or "Limit to 3 options"`
      });
    }
    
    // Vague language
    if (/(it|this|that|thing|stuff)/i.test(text) && text.split(/\s+/).length < 30) {
      suggestions.push({
        type: "Specificity",
        issue: "Contains vague pronouns",
        suggestion: "Replace vague terms with specific nouns",
        priority: "high",
        example: `Instead of "explain this", say "explain React hooks" or "explain the component lifecycle"`
      });
    }
    
    // Type-specific suggestions
    if (promptTypes.includes('coding')) {
      if (!/language|framework|library/i.test(text)) {
        suggestions.push({
          type: "Technical Specificity",
          issue: "Programming language not specified",
          suggestion: "Specify the programming language or framework",
          priority: "high",
          example: `Add: "in Python" or "using React" or "with TypeScript"`
        });
      }
    }
    
    if (promptTypes.includes('writing')) {
      if (!/tone|style|audience/i.test(text)) {
        suggestions.push({
          type: "Writing Style",
          issue: "No tone or audience specified",
          suggestion: "Define the writing style and target audience",
          priority: "medium",
          example: `Add: "Tone: professional" or "Audience: beginners" or "Style: conversational"`
        });
      }
    }
    
    // Topic suggestions
    if (topics.length > 0) {
      suggestions.push({
        type: "Focus Areas",
        issue: "Consider emphasizing key topics",
        suggestion: `Your prompt seems to focus on: ${topics.slice(0, 3).join(', ')}. Consider explicitly mentioning these if they're important.`,
        priority: "low",
        example: null
      });
    }
    
    return suggestions;
  }
}

// AI Tools Modal Component
export default function AIEnhancementTools({ prompt, onClose, onApply, onSaveAsNew }) {
  const [activeTab, setActiveTab] = useState("analyze");
  const [analysis, setAnalysis] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [variations, setVariations] = useState([]);
  const [improvements, setImprovements] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);

  // FIX: Use useEffect instead of useState - CRITICAL FIX
  useEffect(() => {
    if (prompt?.text) {
      setAnalysis(AIEnhancementService.analyzeComplexity(prompt.text));
      setOptimization(AIEnhancementService.optimizePrompt(prompt.text));
      setVariations(AIEnhancementService.generateVariations(prompt.text));
      setImprovements(AIEnhancementService.suggestImprovements(prompt.text));
    }
  }, [prompt?.text]);

  const tabs = [
    { id: "analyze", label: "Analyze", icon: "📊" },
    { id: "optimize", label: "Optimize", icon: "⚡" },
    { id: "variations", label: "Variations", icon: "🔄" },
    { id: "improve", label: "Suggestions", icon: "💡" }
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "rgb(239, 68, 68)"; // red-500
      case "medium": return "rgb(234, 179, 8)"; // yellow-500
      case "low": return "rgb(148, 163, 184)"; // slate-400
      default: return "rgb(226, 232, 240)"; // slate-200
    }
  };

  const getComplexityColor = (level) => {
    switch (level) {
      case "Complex": return "rgb(239, 68, 68)"; // red-500
      case "Moderate": return "rgb(234, 179, 8)"; // yellow-500
      case "Simple": return "rgb(34, 197, 94)"; // green-500
      default: return "rgb(148, 163, 184)"; // slate-400
    }
  };

  if (!prompt) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="glass-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  AI Enhancement Tools
                </h2>
                <p className="text-sm text-slate-400">
                  {prompt.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id 
                    ? "bg-cyan-500 text-white cyber-glow" 
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Analyze Tab */}
          {activeTab === "analyze" && analysis && (
            <div className="space-y-6">
              {/* Complexity Score */}
              <div className="glass-card p-6 rounded-xl border border-white/10">
                <h3 className="font-semibold mb-4 text-slate-100">
                  Complexity Analysis
                </h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400">Complexity Level:</span>
                  <span 
                    className="font-bold text-lg"
                    style={{ color: getComplexityColor(analysis.level) }}
                  >
                    {analysis.level}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((analysis.score / 10) * 100, 100)}%`,
                      backgroundColor: getComplexityColor(analysis.level)
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Score: {analysis.score}/10</p>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Words", value: analysis.words, icon: "📝" },
                  { label: "Sentences", value: analysis.sentences, icon: "📄" },
                  { label: "Avg Words/Sentence", value: analysis.avgWordsPerSentence, icon: "📊" },
                  { label: "Score", value: `${analysis.score}/10`, icon: "⭐" }
                ].map((stat, i) => (
                  <div 
                    key={i}
                    className="glass-card p-4 rounded-xl text-center border border-white/10"
                  >
                    <div className="text-2xl mb-2">{stat.icon}</div>
                    <div className="text-2xl font-bold mb-1 text-slate-100">
                      {stat.value}
                    </div>
                    <div className="text-xs text-slate-400">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div className="glass-card p-6 rounded-xl border border-white/10">
                <h3 className="font-semibold mb-4 text-slate-100">
                  Detected Features
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Clear Instructions", present: analysis.hasInstructions },
                    { label: "Examples Provided", present: analysis.hasExamples },
                    { label: "Context/Background", present: analysis.hasContext },
                    { label: "Constraints Specified", present: analysis.hasConstraints },
                    { label: "Format Defined", present: analysis.hasFormat }
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-slate-300">{feature.label}</span>
                      <span style={{ color: feature.present ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)" }}>
                        {feature.present ? "✓ Yes" : "✗ No"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prompt Type Detection */}
              {optimization?.detectedTypes && (
                <div className="glass-card p-6 rounded-xl border border-white/10">
                  <h3 className="font-semibold mb-4 text-slate-100">
                    Detected Prompt Type
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {optimization.detectedTypes.map((type, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm border border-cyan-400/30">
                        {type}
                      </span>
                    ))}
                  </div>
                  {optimization.topics && optimization.topics.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2 text-slate-300">Key Topics:</h4>
                      <div className="flex flex-wrap gap-2">
                        {optimization.topics.map((topic, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm border border-purple-400/30">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Tips */}
              {analysis.suggestions.length > 0 && (
                <div className="glass-card p-6 rounded-xl border border-white/10">
                  <h3 className="font-semibold mb-4 text-slate-100">
                    Quick Tips
                  </h3>
                  <ul className="space-y-2">
                    {analysis.suggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span className="text-slate-300">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Optimize Tab */}
          {activeTab === "optimize" && optimization && (
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-100">
                    Optimized Version
                  </h3>
                  {optimization.changed && (
                    <span className="text-xs px-3 py-1 rounded-full bg-cyan-500 text-white">
                      {optimization.improvements.length} improvements
                    </span>
                  )}
                </div>
                
                <div className="p-4 rounded-lg mb-4 bg-slate-800/50 border border-slate-700">
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">
                    {optimization.optimized}
                  </pre>
                </div>

                {optimization.improvements.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2 text-slate-100">
                      Applied Improvements:
                    </h4>
                    <ul className="space-y-1">
                      {optimization.improvements.map((improvement, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-slate-300">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => onApply({ ...prompt, text: optimization.optimized })}
                    className="neo-btn btn-primary px-6 py-2 text-sm font-semibold"
                  >
                    Apply Optimization
                  </button>
                  <button
                    onClick={() => onSaveAsNew({ ...prompt, text: optimization.optimized, title: `${prompt.title} (Optimized)` })}
                    className="neo-btn btn-secondary px-6 py-2 text-sm font-semibold"
                  >
                    Save as New
                  </button>
                </div>
              </div>

              {/* Comparison View */}
              {optimization.changed && (
                <div className="glass-card p-6 rounded-xl border border-white/10">
                  <h3 className="font-semibold mb-4 text-slate-100">
                    Before & After Comparison
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-medium mb-2 text-slate-400">Original:</h4>
                      <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                        <pre className="whitespace-pre-wrap text-xs text-slate-300">
                          {optimization.original}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium mb-2 text-slate-400">Optimized:</h4>
                      <div className="p-3 rounded-lg bg-green-900/20 border border-green-500/30">
                        <pre className="whitespace-pre-wrap text-xs text-slate-300">
                          {optimization.optimized}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Variations Tab */}
          {activeTab === "variations" && variations.length > 0 && (
            <div className="space-y-4">
              <div className="mb-4">
                <p className="text-sm text-slate-400">
                  Select a variation tailored to your specific needs. Each variation is customized based on your prompt's content and intent.
                </p>
              </div>
              
              {variations.map((variation, i) => (
                <div 
                  key={i}
                  className={`glass-card p-6 rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedVariation === i 
                      ? "border-2 border-cyan-400 cyber-glow" 
                      : "border border-white/10 hover:border-cyan-400/50"
                  }`}
                  onClick={() => setSelectedVariation(i)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold mb-1 text-slate-100">
                        {variation.name}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {variation.description}
                      </p>
                    </div>
                    {selectedVariation === i && (
                      <span className="text-cyan-400 text-xl">✓</span>
                    )}
                  </div>
                  
                  <div className="p-4 rounded-lg text-sm bg-slate-800/50 border border-slate-700 max-h-60 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-slate-200">
                      {variation.text}
                    </pre>
                  </div>

                  {selectedVariation === i && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onApply({ ...prompt, text: variation.text });
                        }}
                        className="neo-btn btn-primary px-6 py-2 text-sm font-semibold"
                      >
                        Apply This Variation
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveAsNew({ ...prompt, text: variation.text, title: `${prompt.title} (${variation.name.replace(/[^\w\s]/g, '').trim()})` });
                        }}
                        className="neo-btn btn-secondary px-6 py-2 text-sm font-semibold"
                      >
                        Save as New
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Improvements Tab */}
          {activeTab === "improve" && (
            <div className="space-y-4">
              {improvements.length === 0 ? (
                <div className="glass-card p-8 rounded-xl border border-white/10 text-center">
                  <div className="text-4xl mb-4">🎉</div>
                  <h3 className="text-lg font-semibold mb-2 text-slate-100">
                    Great Prompt!
                  </h3>
                  <p className="text-slate-400">
                    Your prompt is well-structured. No critical improvements needed.
                  </p>
                </div>
              ) : (
                improvements.map((improvement, i) => (
                  <div 
                    key={i}
                    className="glass-card p-6 rounded-xl border border-white/10"
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
                        style={{ backgroundColor: getPriorityColor(improvement.priority) + "20" }}
                      >
                        <span style={{ color: getPriorityColor(improvement.priority) }}>
                          {improvement.priority === "high" ? "❗" : improvement.priority === "medium" ? "⚠️" : "ℹ️"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-100">
                            {improvement.type}
                          </h3>
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full capitalize"
                            style={{ 
                              backgroundColor: getPriorityColor(improvement.priority) + "20",
                              color: getPriorityColor(improvement.priority)
                            }}
                          >
                            {improvement.priority} priority
                          </span>
                        </div>
                        <p className="text-sm mb-2 text-slate-300">
                          <strong className="text-slate-200">Issue:</strong> {improvement.issue}
                        </p>
                        <p className="text-sm mb-2 text-slate-300">
                          <strong className="text-slate-200">Suggestion:</strong> {improvement.suggestion}
                        </p>
                        {improvement.example && (
                          <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <p className="text-xs font-medium mb-1 text-slate-400">Example:</p>
                            <p className="text-sm text-cyan-300">{improvement.example}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-400">
              💡 Tip: Use "Analyze" to understand your prompt, then "Optimize" or "Variations" to improve it
            </div>
            <button
              onClick={onClose}
              className="neo-btn btn-secondary px-6 py-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
