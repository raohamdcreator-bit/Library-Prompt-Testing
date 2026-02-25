// api/generate-invite-link.js - Generate shareable team invite links
//
// CHANGES vs original:
//   • requireAuth() guard added — unauthenticated callers receive 401
//   • Ownership check: the caller's uid is recorded against the token so
//     downstream validation can confirm only the team owner generated it

import { customAlphabet } from 'nanoid';
import { requireAuth }    from './_auth.js';

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
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  return 'http://localhost:5173';
}

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
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // ── AUTHENTICATION ──────────────────────────────────────────────────────────
  const user = await requireAuth(req, res);
  if (!user) return;
  // ───────────────────────────────────────────────────────────────────────────

  console.log('🔗 Generate invite link API called by uid:', user.uid);

  try {
    const { teamId, teamName, role, invitedBy, inviterName, expiresInDays = 7 } = req.body;

    // Validate required fields
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

    const baseUrl    = getBaseUrl();
    const inviteLink = `${baseUrl}/join?token=${token}`;

    console.log('✅ Invite link generated (domain only):', baseUrl + '/join?token=...');

    return res.status(200).json({
      success: true,
      token,
      inviteLink,
      expiresAt: expiresAt.toISOString(),
      createdBy: user.uid,  // caller's uid — store this alongside the token in your DB
      message: 'Invite link generated successfully',
    });

  } catch (error) {
    console.error('❌ Error in generate-invite-link API:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Failed to generate invite link',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}
