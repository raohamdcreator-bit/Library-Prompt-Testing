// api/send-invite.js - Simplified Vercel-Compatible Version
// This version handles common Vercel deployment issues

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
  console.log('Environment check:', {
    hasResendKey: !!process.env.RESEND_API_KEY,
    nodeEnv: process.env.NODE_ENV
  });

  try {
    // Import Resend dynamically to avoid build issues
    let Resend;
    try {
      const resendModule = await import('resend');
      Resend = resendModule.Resend;
      console.log('✅ Resend module imported successfully');
    } catch (importError) {
      console.error('❌ Failed to import Resend:', importError.message);
      return res.status(500).json({
        success: false,
        error: 'Email service module not available',
        details: importError.message
      });
    }

    const { to, link, teamName, invitedBy, role } = req.body;

    // Validate inputs
    if (!to || !link || !teamName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Check API key
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not set');
      return res.status(500).json({ 
        success: false, 
        error: 'Email service not configured. Set RESEND_API_KEY in Vercel environment variables.'
      });
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend client initialized');

    // Send email
    console.log(`📧 Sending email to: ${to}`);
    
    const emailData = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [to],
      subject: `You've been invited to join ${teamName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #667eea;">You've been invited!</h1>
          <p>Hello!</p>
          <p><strong>${invitedBy || 'A team member'}</strong> has invited you to join <strong>${teamName}</strong> as a <strong>${role || 'member'}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="${link}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you can't click the button, copy this link: ${link}</p>
        </div>
      `,
      text: `You've been invited to join ${teamName}!\n\n${invitedBy || 'A team member'} has invited you to join ${teamName} as a ${role || 'member'}.\n\nClick here to accept: ${link}`
    });

    console.log('📧 Resend response:', emailData);

    // Check for errors in response
    if (emailData.statusCode && emailData.statusCode >= 400) {
      console.error('❌ Resend error:', emailData);
      return res.status(emailData.statusCode).json({
        success: false,
        error: emailData.message || 'Email service error',
        details: emailData.name
      });
    }

    // Check for success
    if (!emailData.id) {
      console.error('❌ No email ID in response');
      return res.status(500).json({
        success: false,
        error: 'Invalid email service response'
      });
    }

    console.log('✅ Email sent successfully, ID:', emailData.id);

    return res.status(200).json({ 
      success: true, 
      emailId: emailData.id,
      message: 'Invitation email sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in send-invite API:', error);
    
    // Return proper JSON error
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send invitation email',
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      } : undefined
    });
  }
}
