// src/hooks/useCanonical.js 
// Updates the <link rel="canonical"> tag dynamically on each navigation.
//
// NOTE: Prism uses a custom push-state router (not react-router-dom), so this
// hook accepts the current pathname as a prop rather than reading useLocation().
//
// Usage in App.jsx:
//   import { useCanonical } from './hooks/useCanonical';
//   // inside App():
//   useCanonical(currentPath);

import { useEffect } from 'react';

const BASE_URL = 'https://prism-app.online';

// Paths that should NOT expose a public canonical URL
// (auth-required or ephemeral routes)
const PRIVATE_PATHS = ['/team', '/admin', '/join', '/guest-team', '/accept-invite'];

export function useCanonical(pathname) {
  useEffect(() => {
    if (!pathname) return;

    const isPrivate = PRIVATE_PATHS.some(p => pathname.startsWith(p));
    let link = document.querySelector('link[rel="canonical"]');

    if (isPrivate) {
      // Remove canonical tag on private/authenticated pages
      if (link) link.remove();
      return;
    }

    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }

    // Strip query strings and hashes — canonical is always the clean path
    const cleanPath = pathname.split('?')[0].split('#')[0];
    link.href = BASE_URL + cleanPath;
  }, [pathname]);
}
