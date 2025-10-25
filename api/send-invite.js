// api/send-invite.js - COMPLETELY FIXED VERSION
import { Resend } from "resend";

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

console.log("🔑 Resend API Key Status:", process.env.RESEND_API_KEY ? "✓ Loaded" : "✗ Missing");

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    console.log(`❌ Method ${req.method} not allowed`);
    return res.status(405).json({ 
      success: false, 
      error: `Method ${req.method} Not Allowed. Use POST.` 
    });
  }

  try {
    const { to, link, teamName, invitedBy, role } = req.body;

    console.log("📨 Received invite request:", { to, teamName, role, invitedBy });

    // Validate required fields
    if (!to || !link || !teamName) {
      console.log("❌ Missing required fields:", { to: !!to, link: !!link, teamName: !!teamName });
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: to, link, teamName" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.log("❌ Invalid email format:", to);
      return res.status(400).json({ 
        success: false, 
        error: "Invalid email address format" 
      });
    }

    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY environment variable is not set");
      return res.status(500).json({ 
        success: false, 
        error: "Email service not configured. Please add RESEND_API_KEY to environment variables." 
      });
    }

    // Validate API key format
    if (!process.env.RESEND_API_KEY.startsWith('re_')) {
      console.error("❌ RESEND_API_KEY has invalid format");
      return res.status(500).json({ 
        success: false, 
        error: "Email service misconfigured - invalid API key format" 
      });
    }

    console.log(`📧 Sending email via Resend...`);
    console.log(`   To: ${to}`);
    console.log(`   Team: ${teamName}`);
    console.log(`   Role: ${role}`);

    // ✅ FIXED: Send email with proper error handling
    // NOTE: The "from" email must be verified in your Resend account
    // For testing, Resend provides onboarding@resend.dev
    // For production, verify your own domain
    const emailData = await resend.emails.send({
      from: "Prompt Teams <onboarding@resend.dev>",
      to: [to], // ✅ FIXED: Resend expects an array
      subject: `You've been invited to join ${teamName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              You've been invited!
            </h1>
          </div>

          <!-- Main Content -->
          <div style="background: white; padding: 30px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 18px; margin: 0 0 20px 0; color: #2c3e50;">
              Hello!
            </p>
            <p style="font-size: 16px; margin: 0 0 20px 0; color: #34495e; line-height: 1.8;">
              <strong style="color: #667eea;">${invitedBy || 'A team member'}</strong> has invited you to join 
              <strong style="color: #764ba2;">${teamName}</strong> as a 
              <strong style="color: #667eea;">${role || 'member'}</strong>.
            </p>
            <p style="font-size: 15px; color: #7f8c8d; margin: 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
              Join your team to start collaborating on AI prompts and boost productivity together.
            </p>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${link}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 18px 40px; 
                      text-decoration: none; 
                      border-radius: 10px; 
                      font-weight: 700; 
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Accept Invitation
            </a>
            <p style="margin-top: 15px; font-size: 13px; color: #95a5a6;">
              This invitation is personal and cannot be shared
            </p>
          </div>

          <!-- Link Fallback -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 30px; border: 1px solid #e1e8ed;">
            <p style="font-size: 13px; color: #7f8c8d; margin: 0 0 10px 0; font-weight: 600;">
              Can't click the button? Copy this link:
            </p>
            <p style="font-size: 12px; color: #3498db; word-break: break-all; margin: 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; font-family: monospace;">
              ${link}
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e1e8ed;">
            <p style="font-size: 13px; color: #95a5a6; margin: 0 0 8px 0;">
              If you don't want to join this team, you can safely ignore this email.
            </p>
            <p style="font-size: 12px; color: #bdc3c7; margin: 0;">
              Sent by <strong>Prompt Teams</strong>
            </p>
          </div>
        </body>
        </html>
      `,
      text: `You've been invited to join ${teamName}!

${invitedBy || 'A team member'} has invited you to join ${teamName} as a ${role || 'member'}.

Click here to accept: ${link}

If you can't click the link, copy and paste this URL into your browser:
${link}

If you don't want to join this team, you can safely ignore this email.`,
    });

    // ✅ Check for error in response
    console.log("📧 Resend API response:", emailData);

    // Resend returns { id: "uuid" } on success
    // or { name: "error_name", message: "error message", statusCode: 4xx } on error
    if (emailData.statusCode && emailData.statusCode >= 400) {
      console.error("❌ Resend returned an error:", emailData);
      return res.status(emailData.statusCode).json({
        success: false,
        error: emailData.message || "Email service error",
        details: emailData.name,
        code: emailData.statusCode
      });
    }

    // Validate successful response has an ID
    if (!emailData.id) {
      console.error("❌ Invalid Resend response (missing id):", emailData);
      return res.status(500).json({
        success: false,
        error: "Invalid email service response",
        details: "Email ID missing from response"
      });
    }

    console.log("✅ Email sent successfully!");
    console.log("   Email ID:", emailData.id);
    
    return res.status(200).json({ 
      success: true, 
      emailId: emailData.id,
      message: "Invitation email sent successfully"
    });
    
  } catch (error) {
    // Enhanced error logging
    console.error("❌ Email sending error occurred");
    console.error("   Error name:", error.name);
    console.error("   Error message:", error.message);
    
    if (error.stack) {
      console.error("   Stack trace:", error.stack);
    }
    
    // Log the full error object for debugging
    if (error.response) {
      console.error("   Error response:", JSON.stringify(error.response, null, 2));
    }

    // Check if this is a Resend API error
    if (error.statusCode || error.name === 'validation_error') {
      console.error("   Resend API Error Details:", {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode
      });
      
      return res.status(error.statusCode || 422).json({
        success: false,
        error: error.message || "Email validation failed",
        details: error.name,
        code: error.statusCode
      });
    }
    
    // Provide specific error messages based on error type
    let errorMessage = "Failed to send invitation email";
    let statusCode = 500;
    
    if (error.message?.includes("403") || error.statusCode === 403) {
      errorMessage = "Email service authentication failed. API key may be invalid.";
      statusCode = 500;
    } else if (error.message?.includes("API key")) {
      errorMessage = "Invalid email service configuration";
      statusCode = 500;
    } else if (error.message?.includes("rate limit") || error.statusCode === 429) {
      errorMessage = "Email rate limit exceeded. Please try again later.";
      statusCode = 429;
    } else if (error.message?.includes("quota")) {
      errorMessage = "Email quota exceeded for today.";
      statusCode = 429;
    } else if (error.message?.includes("domain") || error.message?.includes("verified")) {
      errorMessage = "Email domain not verified in Resend. Please verify your domain or use onboarding@resend.dev for testing.";
      statusCode = 500;
    } else if (error.message?.includes("invalid") && error.message?.includes("email")) {
      errorMessage = "Invalid email address provided";
      statusCode = 400;
    } else if (error.message?.includes("ENOTFOUND") || error.message?.includes("network")) {
      errorMessage = "Network error connecting to email service";
      statusCode = 503;
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.statusCode || error.code
    });
  }
}
