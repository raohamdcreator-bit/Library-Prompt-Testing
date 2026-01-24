// src/config/admin.js 
// ============================================
// ADMIN EMAIL CONFIGURATION
// ============================================
// ⚠️ IMPORTANT: Change this to your admin email address
export const ADMIN_EMAIL = "rao.hamd.creator@gmail.com";

// Helper function to check if a user is an admin
export function isAdminUser(user) {
  if (!user || !user.email) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Helper function to check if current email is admin
export function isAdminEmail(email) {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Export admin configuration for use across the app
export const adminConfig = {
  email: ADMIN_EMAIL,
  isAdmin: isAdminUser,
  isAdminEmail: isAdminEmail,
};

export default adminConfig;
