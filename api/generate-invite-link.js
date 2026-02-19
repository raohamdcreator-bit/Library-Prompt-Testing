// api/generate-invite-link.js - Generate shareable team invite links
import { customAlphabet } from 'nanoid';

// Use URL-safe characters for tokens
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32);

/**
 * Resolve the canonical public base URL for invite links.
 *
 * Priority order:
 *  1. NEXT_PUBLIC_APP_URL  — set this in Vercel project settings to your
 *     custom domain or a stable alias (e.g. https://prism.example.com).
 *     This is the ONLY env var that should be set for production.
 *
 *  2. APP_URL              — server-side alias of the same value, useful if
 *     you don't want the NEXT_PUBLIC_ prefix in non-Next.js projects.
 *
 *  ❌  VERCEL_URL is intentionally NOT used here because Vercel sets it to
 *     the deployment-specific URL which leaks branch names, project slugs,
 *     team usernames, and internal repo identifiers in every invite link.
 *
 *  3. localhost fallback   — only used when running the dev server locally.
 */
function getBaseUrl() {
  // Custom domain / stable alias — preferred for all environments
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''); // strip trailing slash
  }

  // Server-side alias (no NEXT_PUBLIC_ prefix needed for API routes)
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }

  // Local development fallback
  return 'http://localhost:5173';
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  console.log('🔗 Generate invite link API called');

  try {
    const { teamId, teamName, role, invitedBy, inviterName, expiresInDays = 7 } = req.body;

    // Validate inputs
    if (!teamId || !teamName || !role || !invitedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: teamId, teamName, role, invitedBy',
      });
    }

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be "member" or "admin"',
      });
    }

    // Validate expiration days
    if (expiresInDays < 1 || expiresInDays > 30) {
      return res.status(400).json({
        success: false,
        error: 'Expiration must be between 1 and 30 days',
      });
    }

    // Generate cryptographically secure token
    const token = nanoid();

    // Calculate expiration timestamp
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Build the invite link using the safe base URL helper
    const baseUrl = getBaseUrl();
    const inviteLink = `${baseUrl}/join?token=${token}`;

    console.log('✅ Invite link generated (domain only):', baseUrl + '/join?token=...');

    return res.status(200).json({
      success: true,
      token,
      inviteLink,
      expiresAt: expiresAt.toISOString(),
      message: 'Invite link generated successfully',
    });

  } catch (error) {
    console.error('❌ Error in generate-invite-link API:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Failed to generate invite link',
      // Never expose stack traces or internal details in production
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}
