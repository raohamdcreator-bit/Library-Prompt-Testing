// api/send-invite.js
//
// CHANGES vs original:
//   • requireAuth() guard added — unauthenticated callers receive 401
//   • escapeHtml() applied to all user-controlled values before HTML interpolation
//   • validateInviteLink() ensures the href is a legitimate HTTPS URL on your domain

import { requireAuth }    from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';

// ── Security helpers ──────────────────────────────────────────────────────────

/**
 * Escape characters that have special meaning in HTML so user-controlled
 * values cannot inject tags or attributes into the email template.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

/**
 * Validate that the invite link is an HTTPS URL on an allowed domain.
 * Returns the normalised URL string on success, or null on failure.
 *
 * Extend the `allowed` array if you add custom domains.
 */
function validateInviteLink(link) {
  try {
    const url     = new URL(link);
    const allowed = ['prism-app.online', 'localhost'];

    const onAllowedDomain = allowed.some(
      h => url.hostname === h || url.hostname.endsWith('.' + h)
    );
    if (!onAllowedDomain) throw new Error('Domain not allowed');

    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      throw new Error('Must use HTTPS');
    }

    return url.toString();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // §2.2 — CORS: reflect origin only if it is on the allow-list
  const ALLOWED_ORIGINS = [
    'https://prism-app.online',
    'https://www.prism-app.online',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const reqOrigin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin',  reqOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods',  'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',  'Content-Type, Authorization');

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

  // §2.4 — Rate limiting: 10 invite emails per user per 60 seconds
  if (!(await checkRateLimit(req, res, user.uid, 'send-invite', 10, 60))) return;

  console.log('📨 Send invite API called by uid:', user.uid);

  try {
    const { to, link, teamName, invitedBy, role } = req.body;

    // Validate required fields
    if (!to || !link || !teamName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, link, teamName'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    // ── HTML INJECTION PREVENTION ─────────────────────────────────────────────
    // Sanitise every user-controlled value before inserting into the template.
    const safeTeamName  = escapeHtml(teamName);
    const safeInvitedBy = escapeHtml(invitedBy || 'A team member');
    const safeRole      = escapeHtml(role || 'member');

    // The link is used as both href and visible text — validate it strictly.
    const safeLink = validateInviteLink(link);
    if (!safeLink) {
      console.error('❌ Invalid or disallowed invite link:', link);
      return res.status(400).json({ success: false, error: 'Invalid invite link' });
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.'
      });
    }

    console.log('✅ Validation passed, initializing Resend...');

    let Resend;
    try {
      const resendModule = await import('resend');
      Resend = resendModule.Resend;
    } catch (importError) {
      console.error('❌ Failed to import Resend:', importError);
      return res.status(500).json({
        success: false,
        error: 'Email service module not available. Install: npm install resend',
        details: importError.message
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'Prompt Teams <onboarding@resend.dev>',
      to: [to],
      subject: `You've been invited to join ${safeTeamName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Team Invitation</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                          You've Been Invited! 🎉
                        </h1>
                      </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                          Hello!
                        </p>

                        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                          <strong>${safeInvitedBy}</strong> has invited you to join
                          <strong>${safeTeamName}</strong> as a
                          <strong>${safeRole}</strong>.
                        </p>

                        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 30px 0;">
                          Click the button below to accept the invitation and start collaborating on AI prompts with your team.
                        </p>

                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${safeLink}"
                                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                        color: #ffffff; text-decoration: none; padding: 16px 40px;
                                        border-radius: 6px; font-size: 16px; font-weight: bold;
                                        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                                Accept Invitation
                              </a>
                            </td>
                          </tr>
                        </table>

                        <!-- Link fallback -->
                        <p style="font-size: 14px; line-height: 1.6; color: #666666; margin: 30px 0 0 0; padding: 20px; background-color: #f8f9fa; border-radius: 4px;">
                          If the button doesn't work, copy and paste this link into your browser:<br>
                          <a href="${safeLink}" style="color: #667eea; word-break: break-all;">${safeLink}</a>
                        </p>

                        <!-- Expiration notice -->
                        <p style="font-size: 14px; line-height: 1.6; color: #999999; margin: 20px 0 0 0; text-align: center;">
                          ⏰ This invitation will expire in 7 days
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                        <p style="font-size: 14px; color: #666666; margin: 0 0 10px 0;">
                          Prompt Teams - AI Collaboration Platform
                        </p>
                        <p style="font-size: 12px; color: #999999; margin: 0;">
                          You received this email because someone invited you to join their team.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      // Plain-text version uses the raw (already-trusted) safeLink — no HTML needed here
      text: `
You've been invited to join ${safeTeamName}!

${safeInvitedBy} has invited you to join ${safeTeamName} as a ${safeRole}.

Click here to accept: ${safeLink}

This invitation will expire in 7 days.

---
Prompt Teams - AI Collaboration Platform
      `.trim()
    };

    console.log('📧 Sending email to:', to);
    console.log('From:', emailData.from);

    const result = await resend.emails.send(emailData);

    console.log('📧 Resend API response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('❌ Resend returned error:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error.message || 'Email service error',
        details: result.error.name || 'Unknown error'
      });
    }

    if (!result.data || !result.data.id) {
      console.error('❌ No email ID in response:', result);
      return res.status(500).json({
        success: false,
        error: 'Invalid email service response',
        details: 'No email ID returned'
      });
    }

    console.log('✅ Email sent successfully, ID:', result.data.id);

    return res.status(200).json({
      success: true,
      emailId: result.data.id,
      message: 'Invitation email sent successfully'
    });

  } catch (error) {
    console.error('❌ Error in send-invite API:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);

    let statusCode    = 500;
    let errorMessage  = 'Failed to send invitation email';
    let errorDetails  = error.message;

    if (error.message?.includes('API key')) {
      statusCode   = 503;
      errorMessage = 'Email service authentication failed';
      errorDetails = 'Invalid or missing API key';
    } else if (error.message?.includes('rate limit')) {
      statusCode   = 429;
      errorMessage = 'Rate limit exceeded';
      errorDetails = 'Too many emails sent. Please try again later.';
    } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      statusCode   = 503;
      errorMessage = 'Email service unavailable';
      errorDetails = 'Could not connect to email service';
    }

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      debugInfo: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      } : undefined
    });
  }
}
