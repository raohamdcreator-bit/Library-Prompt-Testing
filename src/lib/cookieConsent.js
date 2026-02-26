// src/lib/cookieConsent.js
// §3.1 — Cookie consent gate for Google Analytics 4.
//
// This module:
//   1. Shows a minimal consent banner on first visit.
//   2. Loads GA4 dynamically ONLY after the user explicitly accepts analytics.
//   3. Implements Google Consent Mode v2 signals so GA4 respects the choice.
//   4. Persists the decision to localStorage (key: 'prism_cookie_consent').
//
// Usage (call once in src/main.jsx, before ReactDOM.createRoot()):
//   import { initCookieConsent } from './lib/cookieConsent';
//   initCookieConsent();

const GA4_ID        = 'G-L9G2B4S3JH';
const STORAGE_KEY   = 'prism_cookie_consent';
const BANNER_ID     = 'prism-consent-banner';

/** Load GA4 script and fire initial config event */
function loadGA4() {
  if (document.getElementById('ga4-script')) return; // already loaded

  const script    = document.createElement('script');
  script.id       = 'ga4-script';
  script.async    = true;
  script.src      = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); } // eslint-disable-line
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA4_ID, { anonymize_ip: true });

  // Update Consent Mode v2 signals
  gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage:        'denied',  // we don't run ads
  });
}

/** Persist consent decision and optionally load GA4 */
function saveConsent(accepted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      accepted,
      timestamp: new Date().toISOString(),
      version:   '1',
    }));
  } catch (_) { /* private browsing — ignore */ }

  removeBanner();
  if (accepted) loadGA4();
}

function removeBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

/** Render the consent banner */
function showBanner() {
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement('div');
  banner.id    = BANNER_ID;
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:99999;
    background:#1a1a2e;border-top:1px solid rgba(139,92,246,.35);
    padding:14px 20px;display:flex;align-items:center;
    gap:16px;flex-wrap:wrap;
    font-family:Inter,-apple-system,sans-serif;font-size:13px;color:#c4c4d4;
    box-shadow:0 -4px 24px rgba(0,0,0,.45);
  `;

  banner.innerHTML = `
    <p style="flex:1;min-width:220px;margin:0;line-height:1.5">
      We use <strong style="color:#e4e4f0">analytics cookies</strong> (Google Analytics 4)
      to understand how Prism is used.
      Authentication cookies are always required.
      <a href="/privacy"
         style="color:#a78bfa;text-decoration:underline"
         target="_blank" rel="noopener">Privacy Policy</a>
    </p>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button id="prism-consent-reject"
        style="padding:8px 16px;border-radius:7px;border:1px solid rgba(139,92,246,.4);
               background:transparent;color:#a78bfa;cursor:pointer;font-size:12px;font-weight:600">
        Reject optional
      </button>
      <button id="prism-consent-accept"
        style="padding:8px 16px;border-radius:7px;border:none;
               background:linear-gradient(135deg,#7c3aed,#4f46e5);
               color:#fff;cursor:pointer;font-size:12px;font-weight:600">
        Accept all
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('prism-consent-accept')
    .addEventListener('click', () => saveConsent(true));
  document.getElementById('prism-consent-reject')
    .addEventListener('click', () => saveConsent(false));
}

/**
 * Call once at app startup (before ReactDOM.createRoot in src/main.jsx).
 * Reads the stored preference; if none exists, shows the banner.
 */
export function initCookieConsent() {
  try {
    const raw   = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;

    if (saved?.accepted === true) {
      loadGA4();
      return;
    }

    if (saved?.accepted === false) {
      return; // user already rejected — do nothing
    }
  } catch (_) { /* parse error / private browsing */ }

  // No decision yet — show banner after the page has painted
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    // Defer slightly so the React root renders first
    setTimeout(showBanner, 800);
  }
}

/** Programmatically re-open the consent banner (e.g. from Privacy Policy page) */
export function reopenConsentBanner() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  showBanner();
}

/** Check whether analytics consent has been granted */
export function hasAnalyticsConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw)?.accepted === true : false;
  } catch (_) {
    return false;
  }
}
