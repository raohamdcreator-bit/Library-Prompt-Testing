// src/lib/sentry.js - Error Tracking Configuration
//
// ⚠️  CRITICAL — DO NOT ADD A TOP-LEVEL `import * as Sentry from "@sentry/react"` HERE.
//
// @sentry/react has a static initialisation side-effect that races with React's own
// scheduler initialisation under Vite 7 / Rolldown's live-binding model.
// The symptom is a production-only TDZ crash:
//   "Cannot access 'G'/'W'/'N' before initialization"
//
// Fix: load @sentry/react via a dynamic import() so it sits outside the static
// module graph entirely.  React and all app modules are fully initialised before
// the dynamic import resolves, eliminating the race condition.

// Lazily-resolved Sentry instance so helper functions can use it after init.
let _sentry = null;

// ─── Initialise ──────────────────────────────────────────────────────────────

export async function initSentry() {
  const dsn         = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
  const isEnabled   = import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true';

  if (!dsn || !isEnabled) {
    console.log('📊 Sentry error tracking is disabled');
    return false;
  }

  try {
    // Dynamic import — @sentry/react is NOT in the static dependency graph.
    const Sentry = await import('@sentry/react');
    _sentry = Sentry;

    Sentry.init({
      dsn,
      environment,

      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText:   true,
          blockAllMedia: true,
        }),
      ],

      tracesSampleRate:         environment === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      release: `${import.meta.env.VITE_APP_NAME}@${import.meta.env.VITE_APP_VERSION}`,

      beforeSend(event) {
        if (environment === 'development') {
          console.log('Sentry Event (dev):', event);
          return null;
        }
        // §6.2 — PII scrubbing
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
        }
        if (event.request) {
          delete event.request.data;
          if (event.request.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['Cookie'];
          }
          if (event.request.query_string) event.request.query_string = '[Filtered]';
        }
        if (event.extra) {
          delete event.extra.prompt;
          delete event.extra.promptText;
        }
        const val = event.exception?.values?.[0]?.value || '';
        if (val.includes('chrome-extension://') || val.includes('moz-extension://')) return null;
        if (val.includes('NetworkError') || val.includes('Failed to fetch')) return null;
        return event;
      },

      ignoreErrors: [
        'top.GLOBALS','canvas.contentDocument','fb_xd_fragment',
        'bmi_SafeAddOnload','EBCallBackMessageReceived','conduitPage',
        'Network request failed','NetworkError when attempting to fetch resource',
        'Failed to fetch','Load failed',
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
      ],

      denyUrls: [
        /extensions\//i,/^chrome:\/\//i,/^chrome-extension:\/\//i,
        /^moz-extension:\/\//i,/^safari-extension:\/\//i,
      ],
    });

    console.log('✓ Sentry error tracking initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return false;
  }
}

// ─── Helpers (all no-ops when Sentry is disabled) ─────────────────────────────

export function logError(error, context = {}) {
  if (import.meta.env.DEV) console.error('Error:', error, 'Context:', context);
  if (!_sentry) return;
  _sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setContext(k, v));
    scope.setLevel(context.level || 'error');
    if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    _sentry.captureException(error);
  });
}

export function logMessage(message, level = 'info', context = {}) {
  if (import.meta.env.DEV) console.log(`[${level}]`, message, context);
  if (!_sentry) return;
  _sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setContext(k, v));
    scope.setLevel(level);
    _sentry.captureMessage(message);
  });
}

export function setUserContext(user) {
  if (!_sentry) return;
  _sentry.setUser(user
    ? { id: user.uid, email: user.email, username: user.displayName || user.email }
    : null);
}

export function addBreadcrumb(message, category = 'custom', data = {}) {
  if (!_sentry) return;
  _sentry.addBreadcrumb({ message, category, data, level: 'info', timestamp: Date.now() / 1000 });
}

export function startTransaction(name, operation = 'custom') {
  if (!_sentry) return null;
  return _sentry.startTransaction({ name, op: operation });
}

export function trackUserAction(action, data = {}) { addBreadcrumb(action, 'user', data); }

export function handleErrorBoundary(error, errorInfo) {
  logError(error, {
    errorBoundary: true,
    componentStack: errorInfo.componentStack,
    tags: { error_boundary: 'true' },
  });
}

export function handleAPIError(error, endpoint, method = 'GET') {
  logError(error, {
    api: true, endpoint, method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    tags: { api_error: 'true', endpoint },
  });
}

export function handleFirebaseError(error, operation) {
  logError(error, {
    firebase: true, operation, code: error.code,
    tags: { firebase_error: 'true', operation, error_code: error.code },
  });
}

// getSentry() for rare cases that need the raw SDK after init
export function getSentry() { return _sentry; }
