// src/config/admin.js
// ============================================



const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || '';

if (!ADMIN_EMAIL) {
  console.warn(
    '[admin.js] VITE_ADMIN_EMAIL is not set. Admin features will be disabled. ' +
    'Add it to .env.local for development or to Vercel env vars for production.'
  );
}

// Helper function to check if a user is an admin
export function isAdminUser(user) {
  if (!user || !user.email || !ADMIN_EMAIL) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Helper function to check if current email is admin
export function isAdminEmail(email) {
  if (!email || !ADMIN_EMAIL) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Export admin configuration for use across the app
export const adminConfig = {
  email: ADMIN_EMAIL,
  isAdmin: isAdminUser,
  isAdminEmail: isAdminEmail,
};

export default adminConfig;
