// src/lib/guestDemoContent.js - FIXED: Unified demo source with proper Firestore Timestamp compatibility
// This is the SINGLE SOURCE for all demo prompts across the application

// Helper to create Firestore-compatible timestamp mock
function createTimestampMock(date) {
  const timestamp = date instanceof Date ? date : new Date(date);
  return {
    toDate: () => timestamp,
    toMillis: () => timestamp.getTime(),
    seconds: Math.floor(timestamp.getTime() / 1000),
    nanoseconds: (timestamp.getTime() % 1000) * 1000000,
  };
}

export const DEMO_PROMPTS = [
  {
    id: 'demo-1',
    title: '📝 Blog Post Generator',
    text: `Write a comprehensive blog post about [TOPIC]. 

Requirements:
- Engaging introduction with hook
- 3-5 main points with supporting examples
- Clear section headers
- SEO-friendly with natural keyword integration
- Compelling conclusion with call-to-action

Tone: [Professional/Conversational/Technical]
Length: [800/1200/1500] words`,
    tags: ['writing', 'content', 'marketing', 'seo'],
    visibility: 'public',
    category: 'Content Creation',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-15'),
    stats: { views: 1247, copies: 89 },
    // ✅ CRITICAL FLAGS
    isDemo: true,
    owner: 'system',
  },
  {
    id: 'demo-2',
    title: '💻 Code Review Assistant',
    text: `Review the following code and provide:

1. **Bug Identification**
   - Syntax errors
   - Logic flaws
   - Edge cases

2. **Performance Optimization**
   - Time complexity analysis
   - Memory usage improvements
   - Best practices

3. **Security Considerations**
   - Vulnerability assessment
   - Input validation
   - Data handling

4. **Recommendations**
   - Refactoring suggestions
   - Design patterns
   - Documentation improvements

Code:
[PASTE CODE HERE]`,
    tags: ['development', 'code-review', 'programming', 'debugging'],
    visibility: 'public',
    category: 'Development',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-14'),
    stats: { views: 2341, copies: 156 },
    isDemo: true,
    owner: 'system',
  },
  {
    id: 'demo-3',
    title: '📧 Email Marketing Template',
    text: `Create a professional email marketing campaign for [PRODUCT/SERVICE].

Structure:
- **Subject Line:** Attention-grabbing, 50 chars max
- **Preview Text:** Complement subject, build curiosity
- **Header:** Personalized greeting
- **Body:** 
  • Problem identification
  • Solution presentation
  • Social proof/testimonials
  • Value proposition
  • Urgency element
- **CTA:** Clear, action-oriented button
- **Footer:** Contact info, unsubscribe

Tone: [Professional/Friendly/Urgent]
Target: [B2B/B2C/SaaS]`,
    tags: ['marketing', 'email', 'sales', 'copywriting'],
    visibility: 'public',
    category: 'Marketing',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-13'),
    stats: { views: 1876, copies: 203 },
    isDemo: true,
    owner: 'system',
  },
  {
    id: 'demo-4',
    title: '📊 Data Analysis Helper',
    text: `Analyze the following dataset and provide comprehensive insights:

1. **Descriptive Statistics**
   - Mean, median, mode
   - Standard deviation
   - Distribution analysis

2. **Trends & Patterns**
   - Temporal trends
   - Correlations
   - Outlier detection

3. **Insights & Findings**
   - Key takeaways
   - Anomalies
   - Predictive indicators

4. **Actionable Recommendations**
   - Data-driven decisions
   - Risk assessment
   - Opportunity identification

5. **Visualization Suggestions**
   - Chart types
   - Dashboard layout
   - KPI tracking

Data:
[PASTE DATA/CSV HERE]`,
    tags: ['analytics', 'data', 'insights', 'statistics'],
    visibility: 'public',
    category: 'Analytics',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-12'),
    stats: { views: 987, copies: 67 },
    isDemo: true,
    owner: 'system',
  },
  {
    id: 'demo-5',
    title: '🎯 Product Launch Strategy',
    text: `Develop a comprehensive product launch strategy for [PRODUCT NAME].

**Pre-Launch Phase (4-6 weeks):**
- Market research & competitive analysis
- Target audience identification
- Beta testing program
- Influencer/partner outreach
- Landing page creation
- Email list building

**Launch Phase (Week 1-2):**
- Press release distribution
- Social media campaign
- Launch event/webinar
- Special launch pricing
- Early adopter incentives

**Post-Launch Phase (Week 3-8):**
- Customer feedback collection
- Content marketing (case studies, tutorials)
- Paid advertising campaigns
- Partnership announcements
- Community building

**Success Metrics:**
- Sign-ups/sales targets
- Media mentions
- Social engagement
- Customer satisfaction scores

Budget: $[AMOUNT]
Timeline: [DURATION]`,
    tags: ['marketing', 'strategy', 'product-launch', 'business'],
    visibility: 'public',
    category: 'Business',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-11'),
    stats: { views: 1534, copies: 124 },
    isDemo: true,
    owner: 'system',
  },
  {
    id: 'demo-6',
    title: '🔍 SEO Content Optimizer',
    text: `Optimize the following content for SEO:

**Analysis Required:**
1. Keyword Research
   - Primary keyword: [KEYWORD]
   - Secondary keywords (LSI)
   - Search intent analysis
   - Competitor gap analysis

2. On-Page SEO
   - Title tag optimization (60 chars)
   - Meta description (155 chars)
   - Header structure (H1-H6)
   - Internal linking opportunities
   - Image alt text

3. Content Quality
   - Readability score (Flesch-Kincaid)
   - Word count optimization
   - Content depth vs. competitors
   - Unique value proposition

4. Technical SEO
   - URL structure
   - Schema markup suggestions
   - Mobile optimization
   - Page speed considerations

Content:
[PASTE CONTENT HERE]`,
    tags: ['seo', 'content', 'optimization', 'marketing'],
    visibility: 'public',
    category: 'SEO',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-10'),
    stats: { views: 2156, copies: 178 },
    isDemo: true,
    owner: 'system',
  },
  {
    id: 'demo-7',
    title: '🎨 Creative Brainstorm Generator',
    text: `Generate creative ideas for [PROJECT/CAMPAIGN].

**Brainstorming Framework:**

1. **Problem Statement**
   - What challenge are we solving?
   - Target audience pain points
   - Desired outcome

2. **Ideation Techniques**
   - Mind mapping
   - SCAMPER method (Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse)
   - Random word association
   - Role-playing scenarios

3. **Concept Development**
   - Generate 10-15 raw ideas
   - No self-censoring
   - Build on others' suggestions
   - Wild ideas encouraged

4. **Evaluation Criteria**
   - Feasibility (1-10)
   - Impact (1-10)
   - Innovation (1-10)
   - Resource requirements

5. **Top 3 Concepts**
   - Detailed description
   - Execution plan
   - Budget estimate
   - Timeline

Project Context:
[DESCRIBE PROJECT]`,
    tags: ['creativity', 'brainstorming', 'ideation', 'innovation'],
    visibility: 'public',
    category: 'Creative',
    createdBy: 'system',
    createdAt: createTimestampMock('2024-01-09'),
    stats: { views: 876, copies: 92 },
    isDemo: true,
    owner: 'system',
  },
];

/**
 * Get all demo prompts for guest users
 * These are loaded immediately when guests access the app
 */
export function getGuestDemoPrompts() {
  return DEMO_PROMPTS;
}

/**
 * Get aggregated stats for demo prompts
 */
export function getGuestDemoStats() {
  return {
    totalPrompts: DEMO_PROMPTS.length,
    totalViews: DEMO_PROMPTS.reduce((sum, p) => sum + (p.stats?.views || 0), 0),
    totalCopies: DEMO_PROMPTS.reduce((sum, p) => sum + (p.stats?.copies || 0), 0),
  };
}

/**
 * Check if a prompt is a demo prompt
 */
export function isDemoPrompt(prompt) {
  return prompt?.isDemo === true && prompt?.owner === 'system';
}

/**
 * Duplicate a demo prompt to create a user-owned prompt
 * This removes demo flags and creates a fresh user prompt
 */
export function duplicateDemoPrompt(demoPrompt, userId) {
  const { id, isDemo, owner, createdBy, createdAt, stats, ...promptData } = demoPrompt;
  
  return {
    ...promptData,
    // Remove system ownership
    owner: userId ? userId : 'guest',
    createdBy: userId || 'guest',
    // Mark as user-created, NOT demo
    isDemo: false,
    // User can now save this
    title: `${promptData.title} (My Copy)`,
  };
}
