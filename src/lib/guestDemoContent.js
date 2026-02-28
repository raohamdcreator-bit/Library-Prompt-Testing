// src/lib/guestDemoContent.js
// Production-ready demo content system with duplication and helper utilities
// createTimestampMock and formatTimestamp live in dateUtils.js — import from there
// to avoid the Rollup/Vite duplicate-export TDZ crash.
import { createTimestampMock, formatTimestamp } from './dateUtils';

/**
 * DEMO PROMPTS - System-owned examples (Read-only)
 * These are high-quality example prompts that guests can view and duplicate
 */
export const DEMO_PROMPTS = [
  {
    id: 'demo-1',
    title: '📝 Blog Post Generator',
    text: `Create an engaging blog post about [TOPIC] that:

1. Starts with a compelling hook that grabs attention
2. Includes 3-5 main sections with clear subheadings
3. Uses conversational tone while maintaining professionalism
4. Incorporates relevant examples and data points
5. Ends with a strong call-to-action
6. Optimizes for SEO with natural keyword integration

Target audience: [DESCRIBE AUDIENCE]
Tone: [Professional/Casual/Educational]
Length: [800-1200 words]

Include:
- An attention-grabbing title
- Meta description (150-160 characters)
- 2-3 internal linking opportunities
- Conclusion with next steps`,
    tags: ['writing', 'content', 'blogging', 'seo', 'marketing'],
    category: 'Content Creation',
    visibility: 'public',
    
    // Demo-specific flags
    isDemo: true,
    isReadOnly: true,
    owner: 'system',
    demoOrder: 1,
    
    // Demo metadata
    stats: {
      views: 1250,
      copies: 340,
      rating: 4.8,
    },
  },
  
  {
    id: 'demo-2',
    title: '💼 Professional Email Writer',
    text: `Compose a professional email for [PURPOSE]:

Context:
- Recipient: [NAME/ROLE]
- Relationship: [Client/Colleague/Manager/Vendor]
- Purpose: [Meeting request/Follow-up/Proposal/Update]
- Urgency: [High/Medium/Low]

Email should:
1. Have a clear, specific subject line
2. Start with appropriate greeting
3. State purpose in first paragraph
4. Provide necessary context and details
5. Include clear call-to-action or next steps
6. End with professional signature

Tone: [Formal/Semi-formal/Friendly-professional]
Length: [Brief/Standard/Detailed]

Special considerations:
- Previous conversation context: [IF APPLICABLE]
- Attachments to mention: [IF ANY]
- Deadline or time-sensitive elements: [IF ANY]`,
    tags: ['email', 'business', 'communication', 'professional'],
    category: 'Business Communication',
    visibility: 'public',
    
    isDemo: true,
    isReadOnly: true,
    owner: 'system',
    demoOrder: 2,
    
    stats: {
      views: 980,
      copies: 245,
      rating: 4.7,
    },
  },
  
  {
    id: 'demo-3',
    title: '🎯 Product Description Creator',
    text: `Write a compelling product description for:

Product: [PRODUCT NAME]
Category: [CATEGORY]
Target Customer: [DESCRIBE TARGET AUDIENCE]

Include:
1. Headline (benefit-focused, 5-10 words)
2. Opening hook that addresses customer pain point
3. Key features (3-5 bullet points)
4. Benefits (how features solve problems)
5. Social proof element (testimonial/stats if available)
6. Strong call-to-action

Format:
- Use sensory language and vivid descriptions
- Focus on benefits over features
- Address common objections
- Create urgency where appropriate
- Optimize for conversions

Technical details to incorporate:
- Specifications: [LIST KEY SPECS]
- Unique selling points: [WHAT MAKES IT DIFFERENT]
- Use cases: [WHO/WHEN/WHERE WOULD USE IT]

Length: [Short (50-100 words) / Medium (150-250 words) / Long (300-500 words)]`,
    tags: ['ecommerce', 'copywriting', 'marketing', 'sales', 'product'],
    category: 'Sales & Marketing',
    visibility: 'public',
    
    isDemo: true,
    isReadOnly: true,
    owner: 'system',
    demoOrder: 3,
    
    stats: {
      views: 1100,
      copies: 310,
      rating: 4.9,
    },
  },
  
  {
    id: 'demo-4',
    title: '📱 Social Media Post Generator',
    text: `Create an engaging social media post for [PLATFORM]:

Platform: [Instagram/LinkedIn/Twitter/Facebook/TikTok]
Topic: [TOPIC/ANNOUNCEMENT/PRODUCT]
Goal: [Engagement/Traffic/Sales/Awareness]

Post should include:
1. Attention-grabbing opening (first 1-2 lines)
2. Value proposition or main message
3. Engaging body content
4. Clear call-to-action
5. Relevant hashtags (3-10 depending on platform)
6. Emoji usage (if appropriate for platform/brand)

Content specifications:
- Tone: [Professional/Casual/Inspirational/Educational]
- Voice: [First person/Brand voice/Expert]
- Length: [Optimized for platform]
- Visual description: [Suggest image/video type]

Additional elements:
- Question to spark engagement (if applicable)
- Tag suggestions (if applicable)
- Best posting time recommendation
- Engagement hooks (polls/questions/CTAs)

Platform-specific optimization:
- Character limits
- Hashtag best practices
- Format preferences`,
    tags: ['social-media', 'marketing', 'content', 'engagement', 'branding'],
    category: 'Social Media',
    visibility: 'public',
    
    isDemo: true,
    isReadOnly: true,
    owner: 'system',
    demoOrder: 4,
    
    stats: {
      views: 1350,
      copies: 425,
      rating: 4.8,
    },
  },
  
  {
    id: 'demo-5',
    title: '🎓 Educational Content Creator',
    text: `Create educational content that explains [TOPIC/CONCEPT]:

Learning objective: [WHAT SHOULD LEARNER UNDERSTAND/DO]
Audience level: [Beginner/Intermediate/Advanced]
Format: [Tutorial/Guide/Explanation/How-to]

Structure:
1. Introduction (Why this matters)
2. Prerequisites (What learner should know first)
3. Main content broken into digestible sections
4. Practical examples and use cases
5. Common mistakes to avoid
6. Practice exercises or application ideas
7. Additional resources

Teaching approach:
- Use analogies and metaphors for complex concepts
- Include visual descriptions where helpful
- Build from simple to complex
- Provide real-world applications
- Address common misconceptions

Content should:
- Be clear and jargon-free (or explain necessary jargon)
- Include step-by-step instructions where applicable
- Provide checkpoints for understanding
- Encourage active learning
- Include summary/key takeaways

Tone: [Patient/Enthusiastic/Professional/Conversational]
Length: [Quick overview / Comprehensive guide / In-depth tutorial]`,
    tags: ['education', 'teaching', 'tutorial', 'learning', 'training'],
    category: 'Education & Training',
    visibility: 'public',
    
    isDemo: true,
    isReadOnly: true,
    owner: 'system',
    demoOrder: 5,
    
    stats: {
      views: 890,
      copies: 215,
      rating: 4.7,
    },
  },
];

/**
 * Check if a prompt is a demo
 * @param {Object} prompt - Prompt object to check
 * @returns {boolean} - True if prompt is a demo
 */
export function isDemoPrompt(prompt) {
  if (!prompt) return false;
  
  return (
    prompt.isDemo === true || 
    prompt.owner === 'system' || 
    (prompt.id && prompt.id.startsWith('demo-'))
  );
}

/**
 * Get all demo prompts (sorted by demoOrder)
 * @returns {Array} - Array of demo prompts
 */
export function getAllDemoPrompts() {
  return [...DEMO_PROMPTS].sort((a, b) => a.demoOrder - b.demoOrder);
}

/**
 * Get demo prompts by category
 * @param {string} category - Category to filter by
 * @returns {Array} - Filtered demo prompts
 */
export function getDemoPromptsByCategory(category) {
  return DEMO_PROMPTS.filter(prompt => prompt.category === category)
    .sort((a, b) => a.demoOrder - b.demoOrder);
}

/**
 * Get all demo categories
 * @returns {Array} - Unique categories
 */
export function getDemoCategories() {
  const categories = new Set(DEMO_PROMPTS.map(p => p.category));
  return Array.from(categories).sort();
}

/**
 * Duplicate demo to create user-owned prompt
 * This is called when user clicks "Make My Own" on a demo
 * 
 * @param {Object} demoPrompt - Demo prompt to duplicate
 * @returns {Object|null} - New user prompt or null if invalid
 */
export function duplicateDemoToUserPrompt(demoPrompt) {
  if (!isDemoPrompt(demoPrompt)) {
    console.warn('Attempted to duplicate non-demo prompt:', demoPrompt.id);
    return null;
  }
  
  // Remove demo-specific and system fields
  const {
    id,
    isDemo,
    isReadOnly,
    owner,
    createdAt,
    updatedAt,
    demoOrder,
    stats,
    views,
    copies,
    rating,
    ...promptData
  } = demoPrompt;
  
  // Create new user prompt
  return {
    ...promptData,
    title: `${promptData.title} (My Copy)`,
    owner: 'guest',
    isDemo: false,
    isReadOnly: false,
    duplicatedFrom: id,
    createdAt: new Date().toISOString(),
    visibility: 'private',
  };
}

/**
 * Get demo prompt by ID
 * @param {string} demoId - Demo ID to find
 * @returns {Object|undefined} - Demo prompt or undefined
 */
export function getDemoPromptById(demoId) {
  return DEMO_PROMPTS.find(p => p.id === demoId);
}

/**
 * Search demo prompts
 * @param {string} query - Search query
 * @returns {Array} - Matching demo prompts
 */
export function searchDemoPrompts(query) {
  if (!query || query.trim() === '') {
    return getAllDemoPrompts();
  }
  
  const lowerQuery = query.toLowerCase();
  
  return DEMO_PROMPTS.filter(prompt => {
    return (
      prompt.title.toLowerCase().includes(lowerQuery) ||
      prompt.text.toLowerCase().includes(lowerQuery) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      prompt.category.toLowerCase().includes(lowerQuery)
    );
  }).sort((a, b) => a.demoOrder - b.demoOrder);
}

/**
 * Get recommended demos based on user's activity
 * @param {Array} userTags - User's tags from previous prompts
 * @param {number} limit - Number of recommendations
 * @returns {Array} - Recommended demo prompts
 */
export function getRecommendedDemos(userTags = [], limit = 3) {
  if (userTags.length === 0) {
    return [...DEMO_PROMPTS]
      .sort((a, b) => (b.stats?.rating || 0) - (a.stats?.rating || 0))
      .slice(0, limit);
  }
  
  const scoredDemos = DEMO_PROMPTS.map(demo => {
    const tagOverlap = demo.tags.filter(tag => 
      userTags.some(userTag => 
        userTag.toLowerCase() === tag.toLowerCase()
      )
    ).length;
    
    return {
      demo,
      score: tagOverlap * 10 + (demo.stats?.rating || 0),
    };
  });
  
  return scoredDemos
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.demo);
}

/**
 * Get display badge for prompt
 * @param {Object} prompt - Prompt object
 * @param {boolean} isGuest - Whether user is in guest mode
 * @returns {Object|null} - Badge configuration or null
 */
export function getPromptBadge(prompt, isGuest) {
  if (isDemoPrompt(prompt)) {
    return {
      type: 'demo',
      label: 'Demo - Read Only',
      icon: '✨',
      color: 'primary',
    };
  }
  
  if (isGuest && prompt.owner === 'guest') {
    return {
      type: 'unsaved',
      label: 'Unsaved',
      icon: '📝',
      color: 'warning',
    };
  }
  
  if (prompt.enhanced) {
    return {
      type: 'enhanced',
      label: 'Enhanced',
      icon: '⚡',
      color: 'success',
    };
  }
  
  return null;
}

// reconstructTimestamp uses createTimestampMock (imported from dateUtils above)
export function reconstructTimestamp(timestamp) {
  if (!timestamp) {
    return createTimestampMock();
  }
  
  // Already a Firestore timestamp with toDate method
  if (typeof timestamp.toDate === 'function') {
    return timestamp;
  }
  
  // ISO string
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: (date.getTime() % 1000) * 1000000,
      toDate: function() { return date; },
      toMillis: function() { return date.getTime(); },
    };
  }
  
  // Plain object with seconds
  if (timestamp.seconds !== undefined) {
    const date = new Date(timestamp.seconds * 1000);
    return {
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds || 0,
      toDate: function() { return date; },
      toMillis: function() { return date.getTime(); },
    };
  }
  
  return createTimestampMock();
}

// formatTimestamp is imported from dateUtils above — re-export for backwards compatibility
export { createTimestampMock, formatTimestamp };

export default {
  DEMO_PROMPTS,
  isDemoPrompt,
  getAllDemoPrompts,
  getDemoPromptsByCategory,
  getDemoCategories,
  duplicateDemoToUserPrompt,
  getDemoPromptById,
  searchDemoPrompts,
  getRecommendedDemos,
  getPromptBadge,
  createTimestampMock,
  reconstructTimestamp,
  formatTimestamp,
};
