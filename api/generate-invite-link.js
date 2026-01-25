// api/generate-invite-link.js - Generate shareable team invite links
import { customAlphabet } from 'nanoid';

// Use URL-safe characters for tokens
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32);

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
      error: 'Method Not Allowed' 
    });
  }

  console.log('🔗 Generate invite link API called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { teamId, teamName, role, invitedBy, inviterName, expiresInDays = 7 } = req.body;

    // Validate inputs
    if (!teamId || !teamName || !role || !invitedBy) {
      console.error('❌ Missing required fields:', { 
        teamId: !!teamId, 
        teamName: !!teamName, 
        role: !!role, 
        invitedBy: !!invitedBy 
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: teamId, teamName, role, invitedBy' 
      });
    }

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      console.error('❌ Invalid role:', role);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid role. Must be "member" or "admin"' 
      });
    }

    // Validate expiration days
    if (expiresInDays < 1 || expiresInDays > 30) {
      console.error('❌ Invalid expiration days:', expiresInDays);
      return res.status(400).json({ 
        success: false, 
        error: 'Expiration must be between 1 and 30 days' 
      });
    }

    console.log('✅ Validation passed, generating token...');

    // Generate cryptographically secure token
    const token = nanoid();
    console.log('✅ Token generated:', token.substring(0, 8) + '...');

    // Calculate expiration timestamp
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Generate invite link
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:5173';
    const inviteLink = `${baseUrl}/join?token=${token}`;

    console.log('✅ Invite link generated:', inviteLink);

    // Return success response
    // Note: The actual Firestore document will be created by the frontend
    // to avoid additional Firebase Admin SDK setup in this serverless function
    return res.status(200).json({ 
      success: true,
      token,
      inviteLink,
      expiresAt: expiresAt.toISOString(),
      message: 'Invite link generated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in generate-invite-link API:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate invite link',
      details: error.message,
      debugInfo: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      } : undefined
    });
  }
}
