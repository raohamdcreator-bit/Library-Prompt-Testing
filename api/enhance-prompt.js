// api/enhance-prompt.js - Enhanced with Model-Specific Optimizations
//
// CHANGES vs original:
//   • requireAuth() guard added — unauthenticated callers receive 401
//   • Removed the broken `authFetch` import and call that existed inside
//     the server-side callAIProvider() function; replaced with native fetch()

import { requireAuth } from './_auth.js';

const PROVIDERS = {
  GROQ: 'groq',
  HUGGINGFACE: 'huggingface',
  OPENROUTER: 'openrouter'
};

// Configuration - Choose your provider
const ACTIVE_PROVIDER = process.env.AI_PROVIDER || PROVIDERS.GROQ;

// Provider-specific configurations
const PROVIDER_CONFIGS = {
  [PROVIDERS.GROQ]: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
  },
  [PROVIDERS.HUGGINGFACE]: {
    endpoint: 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1',
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  },
  [PROVIDERS.OPENROUTER]: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'meta-llama/llama-3.1-8b-instruct:free',
  }
};

/**
 * MODEL-SPECIFIC OPTIMIZATION SYSTEM PROMPTS
 * Each AI model has unique characteristics for optimal performance
 */
const MODEL_OPTIMIZATION_PROMPTS = {
  general: `You are an expert Prompt Engineer. Enhance the given prompt for maximum clarity, structure, and effectiveness across all AI models.

ENHANCEMENT RULES:
1. Preserve the original intent completely
2. Improve clarity and remove ambiguity
3. Add structure using clear sections
4. Include specific instructions where needed
5. Make it actionable and results-oriented

OUTPUT: Enhanced prompt only, no explanations.`,

  claude: `You are an expert in optimizing prompts for Claude AI (Anthropic).

CLAUDE-SPECIFIC OPTIMIZATION:
- Use natural, conversational language with rich context
- Provide background information and reasoning expectations
- Structure thinking steps explicitly ("Think through this step by step")
- Use XML tags for complex structure when beneficial (<context>, <requirements>)
- Frame as collaborative problem-solving
- Include examples when clarifying expectations
- Encourage analytical reasoning and multiple perspectives

ENHANCEMENT RULES:
1. Add context sections: Background, Goal, Constraints
2. Use phrases like "Let's approach this systematically"
3. Include reasoning requirements: "Consider X, Y, Z before responding"
4. Make thinking process explicit
5. Preserve original intent exactly

OUTPUT: Enhanced prompt only, no meta-commentary.`,

  chatgpt: `You are an expert in optimizing prompts for ChatGPT (OpenAI).

CHATGPT-SPECIFIC OPTIMIZATION:
- Assign explicit roles: "You are a [expert role]..."
- Use numbered steps and clear formatting (1., 2., 3.)
- Define output format precisely (bullets, JSON, markdown, table)
- Include clear "Requirements:" and "Constraints:" sections
- Use system/user role framing where helpful
- Add action-oriented instructions: "Do this:", "Create:", "Generate:"
- Specify tone and style explicitly (professional, casual, technical)

ENHANCEMENT RULES:
1. Start with role assignment: "You are an expert in..."
2. Break complex tasks into numbered steps
3. Add "Output format:" section with specific structure
4. Include "Requirements:" and "Constraints:" as bullet lists
5. Specify desired tone and audience
6. Preserve original intent exactly

OUTPUT: Enhanced prompt only, no meta-commentary.`,

  cursor: `You are an expert in optimizing prompts for Cursor AI (developer tool).

CURSOR-SPECIFIC OPTIMIZATION:
- Optimize for code context and file structure awareness
- Use precise technical language and standard terminology
- Reference file paths, functions, and code patterns explicitly
- Include code snippets as examples when relevant
- Specify programming languages, frameworks, and versions
- Focus on developer workflow efficiency
- Use technical constraints (dependencies, patterns, best practices)
- Request specific code organization and structure

ENHANCEMENT RULES:
1. Add specific technical requirements and versions
2. Reference code structure explicitly (files, functions, modules)
3. Include language/framework specifications (e.g., "React 18+", "TypeScript")
4. Add example code patterns or snippets when helpful
5. Specify file/module organization if relevant
6. Include testing and documentation expectations
7. Preserve original intent exactly

OUTPUT: Enhanced prompt only, no meta-commentary.`,

  gemini: `You are an expert in optimizing prompts for Google Gemini AI.

GEMINI-SPECIFIC OPTIMIZATION:
- Use structured, concise language with clear sections
- Organize with explicit headings (Task:, Requirements:, Output:)
- Task-focused with explicit, measurable goals
- Prefer bullet points for requirements and constraints
- Use direct instructions over narrative storytelling
- Include specific output format expectations
- Optimize for efficiency and token usage
- Keep focused and avoid unnecessary elaboration

ENHANCEMENT RULES:
1. Structure with clear sections: Task, Requirements, Constraints, Output
2. Use concise, action-oriented language
3. Bullet point all key requirements (•)
4. Specify deliverables explicitly and measurably
5. Keep it focused and efficient - no fluff
6. Use headings for organization
7. Preserve original intent exactly

OUTPUT: Enhanced prompt only, no meta-commentary.`,

  copilot: `You are an expert in optimizing prompts for GitHub Copilot.

COPILOT-SPECIFIC OPTIMIZATION:
- Optimize for inline code suggestions and completions
- Use clear, descriptive function/variable names in examples
- Include type hints and expected behavior in comments
- Reference code patterns and best practices explicitly
- Add implementation requirements as inline comments
- Focus on code-level precision and correctness
- Include test cases or expected inputs/outputs
- Specify error handling and edge cases
- Use docstrings and JSDoc-style documentation

ENHANCEMENT RULES:
1. Add specific code requirements with types
2. Include function signatures and type information
3. Reference design patterns explicitly (Factory, Singleton, etc.)
4. Specify edge cases and error handling requirements
5. Add example inputs/outputs as comments
6. Include testing expectations (unit tests, edge cases)
7. Preserve original intent exactly

OUTPUT: Enhanced prompt only, no meta-commentary.`,
};

/**
 * ENHANCEMENT TYPE MODIFIERS
 * Additional layer of optimization based on enhancement type
 */
const ENHANCEMENT_TYPE_MODIFIERS = {
  general: "Apply general improvements to clarity, structure, and effectiveness.",
  
  technical: `Add technical depth and precision:
- Include specific technical requirements and constraints
- Add version requirements and compatibility notes
- Specify programming languages, frameworks, or tools explicitly
- Define error handling and edge case expectations
- Add performance, security, or quality criteria
- Include code standards and best practices`,

  creative: `Enhance creative and stylistic aspects:
- Add descriptive and evocative language for mood/atmosphere
- Include style, tone, and voice specifications
- Specify target audience and emotional impact
- Add sensory details and vivid imagery
- Include creative constraints that spark innovation
- Suggest narrative structure or storytelling elements`,

  analytical: `Add analytical depth and rigor:
- Request step-by-step reasoning and logic
- Ask for evidence, citations, and data sources
- Include requirement for multiple perspectives
- Specify depth and breadth of analysis expected
- Request structured conclusions with supporting arguments
- Add critical thinking and evaluation criteria`,

  concise: `Simplify while maintaining clarity and impact:
- Remove redundancy and unnecessary words
- Use precise, direct language
- Focus on essential elements only
- Eliminate filler and maintain core meaning
- Use active voice and strong verbs
- Keep instructions clear and actionable`,

  detailed: `Expand with comprehensive detail and examples:
- Add extensive context and background information
- Include multiple examples and use cases
- Specify edge cases and exceptional scenarios
- Add detailed quality criteria and success metrics
- Request thorough explanations with reasoning
- Include step-by-step breakdowns of complex tasks`,
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── AUTHENTICATION ──────────────────────────────────────────────────────────
  // Verify Firebase ID token. Returns null (and sends 401) if invalid.
  const user = await requireAuth(req, res);
  if (!user) return;
  // ───────────────────────────────────────────────────────────────────────────

  // Detailed logging for debugging
  console.log('=== AI Enhancement Request ===');
  console.log('Authenticated user:', user.uid);
  console.log('Active Provider:', ACTIVE_PROVIDER);
  console.log('Environment Variables Check:');
  console.log('- AI_PROVIDER:', process.env.AI_PROVIDER ? '✓ Set' : '✗ Not set');
  console.log('- GROQ_API_KEY:', process.env.GROQ_API_KEY ? `✓ Set (${process.env.GROQ_API_KEY.substring(0, 10)}...)` : '✗ Not set');
  console.log('- HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('- OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set');

  try {
    const { 
      prompt, 
      enhancementType = 'general', 
      targetModel = 'general',
      context = {} 
    } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.error('Invalid prompt:', prompt);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid prompt',
        message: 'Prompt text is required and must be a non-empty string'
      });
    }

    console.log('Prompt length:', prompt.length);
    console.log('Enhancement type:', enhancementType);
    console.log('Target model:', targetModel);

    // Validate provider configuration
    const config = PROVIDER_CONFIGS[ACTIVE_PROVIDER];
    
    if (!config) {
      console.error('Provider configuration not found for:', ACTIVE_PROVIDER);
      return res.status(500).json({ 
        success: false,
        error: 'Service configuration error',
        message: `Provider "${ACTIVE_PROVIDER}" is not supported. Available: ${Object.keys(PROVIDERS).join(', ')}`
      });
    }

    if (!config.apiKey) {
      console.error(`Missing API key for provider: ${ACTIVE_PROVIDER}`);
      return res.status(500).json({ 
        success: false,
        error: 'Service configuration error',
        message: `API key not configured for ${ACTIVE_PROVIDER}. Please add ${ACTIVE_PROVIDER.toUpperCase()}_API_KEY to environment variables.`,
        details: process.env.NODE_ENV === 'development' ? {
          provider: ACTIVE_PROVIDER,
          requiredEnvVar: `${ACTIVE_PROVIDER.toUpperCase()}_API_KEY`,
          availableEnvVars: Object.keys(process.env).filter(k => k.includes('API'))
        } : undefined
      });
    }

    console.log(`✓ Using provider: ${ACTIVE_PROVIDER}`);
    console.log(`✓ Model: ${config.model}`);
    console.log(`✓ Target optimization: ${targetModel}`);
    console.log(`✓ Endpoint: ${config.endpoint}`);

    // Generate model-specific and type-specific enhancement prompt
    const systemPrompt = generateSystemPrompt(enhancementType, targetModel, context);
    const userPrompt = generateUserPrompt(prompt, enhancementType, targetModel);

    console.log('System prompt length:', systemPrompt.length);
    console.log('User prompt length:', userPrompt.length);

    // Call the selected AI provider
    console.log('Calling AI provider...');
    const enhancedPrompt = await callAIProvider(config, systemPrompt, userPrompt);

    console.log('AI response received, length:', enhancedPrompt?.length || 0);

    // Extract and validate the enhanced prompt
    const result = extractEnhancedPrompt(enhancedPrompt);

    // Analyze improvements made
    const improvements = analyzeImprovements(
      prompt, 
      result.enhanced, 
      targetModel, 
      enhancementType
    );

    console.log('✓ Enhancement successful');
    console.log('- Enhanced length:', result.enhanced.length);
    console.log('- Improvements count:', improvements.length);
    console.log('- Target model:', targetModel);

    return res.status(200).json({
      success: true,
      original: prompt,
      enhanced: result.enhanced,
      improvements: improvements.length > 0 ? improvements : result.improvements,
      provider: ACTIVE_PROVIDER,
      model: config.model,
      targetModel,
      metadata: {
        enhancementType,
        targetModel,
        timestamp: new Date().toISOString(),
        originalLength: prompt.length,
        enhancedLength: result.enhanced.length,
        improvementCount: improvements.length,
      }
    });

  } catch (error) {
    console.error('=== Enhancement Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.cause) {
      console.error('Error cause:', error.cause);
    }

    let errorMessage = 'Failed to enhance prompt';
    let statusCode = 500;
    let errorDetails = error.message;

    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      errorMessage = 'AI service authentication failed';
      errorDetails = 'Invalid or missing API key';
      statusCode = 503;
    } else if (error.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timeout. Please try again.';
      statusCode = 504;
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error connecting to AI service';
      errorDetails = 'Could not reach AI provider endpoint';
      statusCode = 503;
    } else if (error.message?.includes('400')) {
      errorMessage = 'Invalid request to AI service';
      errorDetails = 'The prompt may be too long or contain invalid characters';
      statusCode = 400;
    }

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      provider: ACTIVE_PROVIDER,
      debugInfo: process.env.NODE_ENV === 'development' ? {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      } : undefined
    });
  }
}

// Generate comprehensive system prompt with model and type specificity
function generateSystemPrompt(enhancementType, targetModel, context) {
  const modelPrompt = MODEL_OPTIMIZATION_PROMPTS[targetModel] || MODEL_OPTIMIZATION_PROMPTS.general;
  const typeModifier = ENHANCEMENT_TYPE_MODIFIERS[enhancementType] || ENHANCEMENT_TYPE_MODIFIERS.general;

  return `${modelPrompt}

ADDITIONAL ENHANCEMENT FOCUS: ${enhancementType.toUpperCase()}
${typeModifier}

CONTEXT (if provided):
${context.title ? `Title: ${context.title}` : ''}
${context.tags ? `Tags: ${context.tags.join(', ')}` : ''}

CRITICAL INSTRUCTIONS:
- Output ONLY the enhanced prompt
- No explanations or meta-commentary
- No markdown formatting markers
- Preserve the original intent completely
- Apply both model-specific and enhancement-type optimizations
- Make it ready to use immediately`;
}

// Generate user prompt with clear instructions
function generateUserPrompt(originalPrompt, enhancementType, targetModel) {
  const modelNames = {
    general: 'all AI models',
    claude: 'Claude AI (Anthropic)',
    chatgpt: 'ChatGPT (OpenAI)',
    cursor: 'Cursor AI (developer tool)',
    gemini: 'Google Gemini',
    copilot: 'GitHub Copilot',
  };

  const targetName = modelNames[targetModel] || modelNames.general;

  return `Original prompt to enhance:

"""
${originalPrompt}
"""

Task: Enhance this prompt specifically for ${targetName}, applying ${enhancementType} optimization.

Provide:
1. The enhanced version of the prompt
2. A brief list of specific improvements made

Format your response exactly as:
ENHANCED PROMPT:
[Your enhanced prompt here]

IMPROVEMENTS:
- [Improvement 1]
- [Improvement 2]
- [Improvement 3]

Remember: The enhanced prompt should be optimized for ${targetName} and follow ${enhancementType} enhancement principles.`;
}

/**
 * Call the configured AI provider using native fetch().
 *
 * NOTE: This is a server-side function. It must NOT import or call any
 * client-side helpers (e.g. authFetch from services/api.js).
 */
async function callAIProvider(config, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 s timeout

  try {
    let requestBody;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    console.log('Preparing request for provider:', ACTIVE_PROVIDER);

    switch (ACTIVE_PROVIDER) {
      case PROVIDERS.GROQ:
        requestBody = {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9
        };
        break;

      case PROVIDERS.HUGGINGFACE:
        requestBody = {
          inputs: `${systemPrompt}\n\n${userPrompt}`,
          parameters: {
            max_new_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
            return_full_text: false
          }
        };
        break;

      case PROVIDERS.OPENROUTER:
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://prism-app.online';
        headers['X-Title'] = 'Prompt Teams';
        requestBody = {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   }
          ],
          temperature: 0.7,
          max_tokens: 2000
        };
        break;

      default:
        throw new Error(`Unsupported provider: ${ACTIVE_PROVIDER}`);
    }

    console.log('Making fetch request to:', config.endpoint);
    console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');

    // ── Use native fetch() here — this runs server-side, not in the browser ──
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response (${response.status}):`, errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`AI API error: ${errorJson.error?.message || errorJson.message || errorText}`);
      } catch (e) {
        if (e.message.startsWith('AI API error:')) throw e;
        throw new Error(`AI API returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
    }

    const data = await response.json();
    console.log('Response parsed successfully');

    let content;
    switch (ACTIVE_PROVIDER) {
      case PROVIDERS.GROQ:
      case PROVIDERS.OPENROUTER:
        content = data.choices?.[0]?.message?.content;
        break;
      case PROVIDERS.HUGGINGFACE:
        content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
        break;
    }

    if (!content) {
      console.error('No content in AI response');
      console.error('Response structure:', JSON.stringify(data, null, 2));
      throw new Error('No content in AI response');
    }

    console.log('Content extracted successfully, length:', content.length);
    return content;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: AI service took too long to respond');
    }
    
    console.error('Error in callAIProvider:', error);
    throw error;
  }
}

// Extract enhanced prompt and improvements from AI response
function extractEnhancedPrompt(response) {
  console.log('Extracting enhanced prompt from response...');
  
  const enhancedMatch    = response.match(/ENHANCED PROMPT:\s*([\s\S]*?)(?=IMPROVEMENTS:|$)/i);
  const improvementsMatch = response.match(/IMPROVEMENTS:\s*([\s\S]*?)$/i);

  let enhanced = '';
  let improvements = [];

  if (enhancedMatch) {
    enhanced = enhancedMatch[1].trim();
  } else {
    const paragraphs = response.split('\n\n').filter(p => p.trim().length > 50);
    enhanced = paragraphs[0]?.trim() || response.trim();
    console.log('Using fallback extraction method');
  }

  if (improvementsMatch) {
    improvements = improvementsMatch[1].trim()
      .split('\n')
      .filter(line => line.trim().match(/^[-•*]\s+/))
      .map(line => line.replace(/^[-•*]\s+/, '').trim())
      .filter(Boolean);
  }

  if (improvements.length === 0) {
    improvements = [
      'Enhanced clarity and specificity',
      'Added structured format',
      'Improved instruction quality'
    ];
  }

  return { enhanced, improvements };
}

function analyzeImprovements(original, enhanced, targetModel, enhancementType) {
  const improvements = [];

  if (enhanced.length > original.length * 1.3) {
    improvements.push("Significantly expanded with additional detail and context");
  } else if (enhanced.length > original.length * 1.1) {
    improvements.push("Added comprehensive details and structure");
  } else if (enhanced.length < original.length * 0.8) {
    improvements.push("Simplified and made more concise");
  }

  if (enhanced.includes("\n\n") && !original.includes("\n\n")) {
    improvements.push("Added paragraph structure for better readability");
  }

  if ((enhanced.match(/\n/g) || []).length > (original.match(/\n/g) || []).length + 3) {
    improvements.push("Organized into clear, logical sections");
  }

  const modelImprovements = {
    claude: [
      (enhanced.toLowerCase().includes("think") || enhanced.toLowerCase().includes("reason")) && "Added reasoning and thinking guidance",
      enhanced.toLowerCase().includes("context") && "Provided rich contextual framing",
      enhanced.toLowerCase().includes("step") && "Included step-by-step analytical structure",
      enhanced.includes("<") && enhanced.includes(">") && "Used XML tags for clear structure",
    ],
    chatgpt: [
      enhanced.toLowerCase().includes("you are") && "Assigned explicit expert role",
      /\d+\./.test(enhanced) && "Added numbered steps for clarity",
      enhanced.toLowerCase().includes("format:") && "Specified clear output format",
      enhanced.toLowerCase().includes("requirements:") && "Defined explicit requirements section",
    ],
    cursor: [
      enhanced.toLowerCase().includes("code") && "Optimized for code context and precision",
      enhanced.includes("```") && "Added code examples and snippets",
      /\.(js|ts|py|java|cpp|jsx|tsx)/.test(enhanced) && "Specified programming language/framework",
      enhanced.toLowerCase().includes("function") && "Included function-level specifications",
    ],
    gemini: [
      enhanced.includes("Task:") && "Added structured task definition",
      enhanced.includes("•") && "Used bullet points for clarity and efficiency",
      enhanced.toLowerCase().includes("output:") && "Defined clear output expectations",
      enhanced.includes("Requirements:") && "Organized requirements systematically",
    ],
    copilot: [
      enhanced.includes("function") && "Optimized for inline code suggestions",
      enhanced.includes("//") && "Added implementation guidance as comments",
      enhanced.toLowerCase().includes("type") && "Included type specifications and hints",
      enhanced.includes("test") && "Added testing expectations",
    ],
  };

  const modelSpecific = modelImprovements[targetModel] || [];
  improvements.push(...modelSpecific.filter(Boolean));

  const typeImprovements = {
    technical: "Added technical specifications, constraints, and precision",
    creative:  "Enhanced with creative elements and descriptive language",
    analytical:"Structured for analytical thinking and reasoning depth",
    concise:   "Reduced verbosity while preserving core meaning",
    detailed:  "Expanded with comprehensive examples and context",
    general:   "Applied general clarity and effectiveness improvements",
  };

  if (typeImprovements[enhancementType]) {
    improvements.push(typeImprovements[enhancementType]);
  }

  const modelNames = {
    claude:  "Claude AI",
    chatgpt: "ChatGPT",
    cursor:  "Cursor AI",
    gemini:  "Google Gemini",
    copilot: "GitHub Copilot",
    general: "universal AI compatibility",
  };

  if (targetModel !== 'general') {
    improvements.push(`Optimized specifically for ${modelNames[targetModel] || targetModel}`);
  }

  return improvements.filter(Boolean).slice(0, 6);
}
