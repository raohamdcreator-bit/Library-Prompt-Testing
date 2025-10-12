// api/enhance-prompt.js - Enhanced with detailed error logging
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
    model: 'llama-3.3-70b-versatile', // UPDATED: Current active model
    // Alternative models: 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768' (deprecated)
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

  // Detailed logging for debugging
  console.log('=== AI Enhancement Request ===');
  console.log('Active Provider:', ACTIVE_PROVIDER);
  console.log('Environment Variables Check:');
  console.log('- AI_PROVIDER:', process.env.AI_PROVIDER ? '✓ Set' : '✗ Not set');
  console.log('- GROQ_API_KEY:', process.env.GROQ_API_KEY ? `✓ Set (${process.env.GROQ_API_KEY.substring(0, 10)}...)` : '✗ Not set');
  console.log('- HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('- OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set');

  try {
    const { prompt, enhancementType = 'general', context = {} } = req.body;

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
      console.error('Config check:', {
        provider: ACTIVE_PROVIDER,
        hasEndpoint: !!config.endpoint,
        hasModel: !!config.model,
        hasApiKey: !!config.apiKey
      });
      
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
    console.log(`✓ Endpoint: ${config.endpoint}`);

    // Generate enhancement prompt based on type
    const systemPrompt = generateSystemPrompt(enhancementType, context);
    const userPrompt = generateUserPrompt(prompt, enhancementType);

    console.log('System prompt length:', systemPrompt.length);
    console.log('User prompt length:', userPrompt.length);

    // Call the selected AI provider
    console.log('Calling AI provider...');
    const enhancedPrompt = await callAIProvider(
      config,
      systemPrompt,
      userPrompt
    );

    console.log('AI response received, length:', enhancedPrompt?.length || 0);

    // Extract and validate the enhanced prompt
    const result = extractEnhancedPrompt(enhancedPrompt);

    console.log('✓ Enhancement successful');
    console.log('- Enhanced length:', result.enhanced.length);
    console.log('- Improvements count:', result.improvements.length);

    return res.status(200).json({
      success: true,
      original: prompt,
      enhanced: result.enhanced,
      improvements: result.improvements,
      provider: ACTIVE_PROVIDER,
      model: config.model,
      metadata: {
        enhancementType,
        timestamp: new Date().toISOString(),
        originalLength: prompt.length,
        enhancedLength: result.enhanced.length,
        improvementCount: result.improvements.length
      }
    });

  } catch (error) {
    console.error('=== Enhancement Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Detailed error information
    if (error.cause) {
      console.error('Error cause:', error.cause);
    }

    // Provide helpful error messages
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

// Generate system prompt based on enhancement type
function generateSystemPrompt(enhancementType, context) {
  const basePrompt = `You are an expert AI prompt engineer. Your task is to enhance and optimize prompts to make them more effective, clear, and comprehensive.`;

  const typeSpecificPrompts = {
    general: `${basePrompt}

Focus on:
- Making instructions clearer and more specific
- Adding relevant context and constraints
- Structuring the prompt for better comprehension
- Including examples where helpful
- Specifying desired output format`,

    technical: `${basePrompt}

Focus on technical accuracy and precision:
- Add technical specifications and constraints
- Include version requirements if applicable
- Specify programming languages, frameworks, or tools
- Define error handling expectations
- Add performance or security considerations`,

    creative: `${basePrompt}

Enhance for creative output:
- Expand on style, tone, and voice requirements
- Add sensory and descriptive details
- Include target audience specification
- Suggest emotional tone or mood
- Add creative constraints that spark innovation`,

    analytical: `${basePrompt}

Optimize for analytical thinking:
- Request step-by-step reasoning
- Ask for evidence and citations
- Include multiple perspectives consideration
- Specify depth and breadth of analysis
- Request structured conclusions`,

    concise: `${basePrompt}

Make the prompt clearer while keeping it brief:
- Remove redundancy
- Use precise language
- Focus on essential elements only
- Maintain clarity without verbosity`,

    detailed: `${basePrompt}

Expand the prompt with comprehensive details:
- Add extensive context and background
- Include multiple examples
- Specify edge cases
- Add quality criteria
- Request thorough explanations`
  };

  return typeSpecificPrompts[enhancementType] || typeSpecificPrompts.general;
}

// Generate user prompt
function generateUserPrompt(originalPrompt, enhancementType) {
  return `Original prompt: "${originalPrompt}"

Please enhance this prompt to make it more effective. Provide:
1. The enhanced version of the prompt
2. A list of specific improvements made

Format your response as:
ENHANCED PROMPT:
[Your enhanced prompt here]

IMPROVEMENTS:
- [Improvement 1]
- [Improvement 2]
- [etc.]`;
}

// Call AI provider based on configuration
async function callAIProvider(config, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    let requestBody;
    let headers = {
      'Content-Type': 'application/json',
    };

    console.log('Preparing request for provider:', ACTIVE_PROVIDER);

    // Provider-specific request formatting
    switch (ACTIVE_PROVIDER) {
      case PROVIDERS.GROQ:
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        requestBody = {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9
        };
        console.log('Groq request prepared');
        break;

      case PROVIDERS.HUGGINGFACE:
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        requestBody = {
          inputs: `${systemPrompt}\n\n${userPrompt}`,
          parameters: {
            max_new_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
            return_full_text: false
          }
        };
        console.log('HuggingFace request prepared');
        break;

      case PROVIDERS.OPENROUTER:
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        headers['HTTP-Referer'] = process.env.VERCEL_URL || 'https://prompt-teams.com';
        headers['X-Title'] = 'Prompt Teams';
        requestBody = {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        };
        console.log('OpenRouter request prepared');
        break;

      default:
        throw new Error(`Unsupported provider: ${ACTIVE_PROVIDER}`);
    }

    console.log('Making fetch request to:', config.endpoint);
    console.log('Request body size:', JSON.stringify(requestBody).length, 'bytes');

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response (${response.status}):`, errorText);
      
      // Try to parse as JSON for better error message
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Parsed error:', errorJson);
        throw new Error(`AI API error: ${errorJson.error?.message || errorJson.message || errorText}`);
      } catch (e) {
        throw new Error(`AI API returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
    }

    const data = await response.json();
    console.log('Response parsed successfully');

    // Extract response based on provider
    let content;
    switch (ACTIVE_PROVIDER) {
      case PROVIDERS.GROQ:
      case PROVIDERS.OPENROUTER:
        content = data.choices?.[0]?.message?.content;
        console.log('Extracted content from choices');
        break;
      case PROVIDERS.HUGGINGFACE:
        content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
        console.log('Extracted content from HuggingFace response');
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
      console.error('Request timed out after 30 seconds');
      throw new Error('Request timeout: AI service took too long to respond');
    }
    
    console.error('Error in callAIProvider:', error);
    throw error;
  }
}

// Extract enhanced prompt and improvements from AI response
function extractEnhancedPrompt(response) {
  console.log('Extracting enhanced prompt from response...');
  
  // Try to parse structured response
  const enhancedMatch = response.match(/ENHANCED PROMPT:\s*([\s\S]*?)(?=IMPROVEMENTS:|$)/i);
  const improvementsMatch = response.match(/IMPROVEMENTS:\s*([\s\S]*?)$/i);

  let enhanced = '';
  let improvements = [];

  if (enhancedMatch) {
    enhanced = enhancedMatch[1].trim();
    console.log('Found ENHANCED PROMPT section');
  } else {
    // Fallback: Use first substantial paragraph
    const paragraphs = response.split('\n\n').filter(p => p.trim().length > 50);
    enhanced = paragraphs[0]?.trim() || response.trim();
    console.log('Using fallback extraction method');
  }

  if (improvementsMatch) {
    const improvementsText = improvementsMatch[1].trim();
    improvements = improvementsText
      .split('\n')
      .filter(line => line.trim().match(/^[-•*]\s+/))
      .map(line => line.replace(/^[-•*]\s+/, '').trim())
      .filter(Boolean);
    console.log('Found', improvements.length, 'improvements');
  }

  // If no improvements found, extract from response
  if (improvements.length === 0) {
    improvements = [
      'Enhanced clarity and specificity',
      'Added structured format',
      'Improved instruction quality'
    ];
    console.log('Using default improvements');
  }

  return {
    enhanced,
    improvements
  };
}
