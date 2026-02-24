import { auth } from '@/lib/firebase';

/**
 * Helper function for authenticated API requests
 */
export async function authFetch(url, options = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated');
  }

  // 1️⃣ Get Firebase ID token
  const token = await user.getIdToken();

  // 2️⃣ Call API with Authorization header
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  // 3️⃣ Handle auth errors cleanly
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  return res;
}
