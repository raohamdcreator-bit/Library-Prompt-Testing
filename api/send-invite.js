// api/send-invite.js - Fixed with better error handling
export default async function handler(req, res) {
  // Set CORS headers first
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
      error: 'Method Not Allowed' 
    });
  }

  console.log('📨 Send invite API called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { to, link, teamName, invitedBy, role } = req.body;

    // Validate inputs
    if (!to || !link || !teamName) {
      console.error('❌ Missing required fields:', { to: !!to, link: !!link, teamName: !!teamName });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: to, link, teamName' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.error('❌ Invalid email format:', to);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Check API key
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.'
      });
    }

    console.log('✅ Validation passed, initializing Resend...');

    // Import Resend dynamically
    let Resend;
    try {
      const resendModule = await import('resend');
      Resend = resendModule.Resend;
      console.log('✅ Resend module imported');
    } catch (importError) {
      console.error('❌ Failed to import Resend:', importError);
      return res.status(500).json({
        success: false,
        error: 'Email service module not available. Install: npm install resend',
        details: importError.message
      });
    }

    // Initialize Resend client
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend client initialized');

    // Prepare email data
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'Prompt Teams <onboarding@resend.dev>',
      to: [to],
      subject: `You've been invited to join ${teamName}`,
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
                          <strong>${invitedBy || 'A team member'}</strong> has invited you to join <strong>${teamName}</strong> as a <strong>${role || 'member'}</strong>.
                        </p>
                        
                        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 30px 0;">
                          Click the button below to accept the invitation and start collaborating on AI prompts with your team.
                        </p>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${link}" 
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
                          <a href="${link}" style="color: #667eea; word-break: break-all;">${link}</a>
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
      text: `
You've been invited to join ${teamName}!

${invitedBy || 'A team member'} has invited you to join ${teamName} as a ${role || 'member'}.

Click here to accept: ${link}

This invitation will expire in 7 days.

---
Prompt Teams - AI Collaboration Platform
      `.trim()
    };

    console.log('📧 Sending email to:', to);
    console.log('From:', emailData.from);

    // Send email
    const result = await resend.emails.send(emailData);

    console.log('📧 Resend API response:', JSON.stringify(result, null, 2));

    // Check for errors in response
    if (result.error) {
      console.error('❌ Resend returned error:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error.message || 'Email service error',
        details: result.error.name || 'Unknown error'
      });
    }

    // Check for success
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
    console.error('Error stack:', error.stack);
    
    // Determine error type and status code
    let statusCode = 500;
    let errorMessage = 'Failed to send invitation email';
    let errorDetails = error.message;

    if (error.message?.includes('API key')) {
      statusCode = 503;
      errorMessage = 'Email service authentication failed';
      errorDetails = 'Invalid or missing API key';
    } else if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded';
      errorDetails = 'Too many emails sent. Please try again later.';
    } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      statusCode = 503;
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
