// src/lib/sentry.js - Error Tracking Configuration
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

// Initialize Sentry only if DSN is provided and in production
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
  const isEnabled = import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true';

  if (!dsn || !isEnabled) {
    console.log('📊 Sentry error tracking is disabled');
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      
      // Performance Monitoring
      integrations: [
        new BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Capture Replay for 10% of all sessions,
      // plus for 100% of sessions with an error
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Release tracking
      release: `${import.meta.env.VITE_APP_NAME}@${import.meta.env.VITE_APP_VERSION}`,

      // BeforeSend hook to filter sensitive data
      beforeSend(event, hint) {
        // Don't send events in development
        if (environment === 'development') {
          console.log('Sentry Event (dev):', event);
          return null;
        }

        // §6.2 — PII scrubbing: remove user email and request body
        // (request body may contain user prompts which are personal data under GDPR)
        if (event.user) {
          delete event.user.email;      // keep uid for deduplication, drop PII
          delete event.user.username;   // display name may identify the person
        }
        if (event.request) {
          delete event.request.data;    // body may contain prompt text
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['Cookie'];
          }
          // Remove query parameters that might contain tokens
          if (event.request.query_string) {
            event.request.query_string = '[Filtered]';
          }
        }
        // §6.2 — Strip any extra context keys that might hold prompt content
        if (event.extra) {
          delete event.extra.prompt;
          delete event.extra.promptText;
        }

        // Filter out known third-party errors
        if (event.exception) {
          const exceptionValue = event.exception.values?.[0]?.value || '';
          
          // Ignore browser extension errors
          if (exceptionValue.includes('chrome-extension://') || 
              exceptionValue.includes('moz-extension://')) {
            return null;
          }

          // Ignore network errors (they're usually not actionable)
          if (exceptionValue.includes('NetworkError') || 
              exceptionValue.includes('Failed to fetch')) {
            return null;
          }
        }

        return event;
      },

      // Ignore certain errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        'atomicFindClose',
        
        // Random plugins/extensions
        'Can\'t find variable: ZiteReader',
        'jigsaw is not defined',
        'ComboSearch is not defined',
        
        // Facebook blocked errors
        'fb_xd_fragment',
        
        // ISP injected ads
        'bmi_SafeAddOnload',
        'EBCallBackMessageReceived',
        
        // Chrome extensions
        'conduitPage',
        
        // Network errors
        'Network request failed',
        'NetworkError when attempting to fetch resource',
        'Failed to fetch',
        'Load failed',
        
        // Ignore ResizeObserver errors (not actionable)
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
      ],

      // Don't send events from certain URLs
      denyUrls: [
        // Chrome extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        
        // Firefox extensions
        /^moz-extension:\/\//i,
        
        // Other extensions
        /^safari-extension:\/\//i,
      ],
    });

    console.log('✓ Sentry error tracking initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return false;
  }
}

// Custom error logging with context
export function logError(error, context = {}) {
  if (import.meta.env.DEV) {
    console.error('Error:', error, 'Context:', context);
  }

  Sentry.withScope((scope) => {
    // Add context
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });

    // Set error level
    scope.setLevel(context.level || 'error');

    // Add tags for filtering
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Capture the error
    Sentry.captureException(error);
  });
}

// Log a message (not an error)
export function logMessage(message, level = 'info', context = {}) {
  if (import.meta.env.DEV) {
    console.log(`[${level}]`, message, context);
  }

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });

    scope.setLevel(level);
    Sentry.captureMessage(message);
  });
}

// Set user context for error tracking
export function setUserContext(user) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.uid,
    email: user.email,
    username: user.displayName || user.email,
  });
}

// Add breadcrumb for debugging
export function addBreadcrumb(message, category = 'custom', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

// Performance monitoring
export function startTransaction(name, operation = 'custom') {
  return Sentry.startTransaction({
    name,
    op: operation,
  });
}

// Track user interaction
export function trackUserAction(action, data = {}) {
  addBreadcrumb(action, 'user', data);
}

// Export Sentry for advanced usage
export { Sentry };

// Custom error boundary error handler
export function handleErrorBoundary(error, errorInfo) {
  logError(error, {
    errorBoundary: true,
    componentStack: errorInfo.componentStack,
    tags: {
      error_boundary: 'true',
    },
  });
}

// API error handler
export function handleAPIError(error, endpoint, method = 'GET') {
  const context = {
    api: true,
    endpoint,
    method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    tags: {
      api_error: 'true',
      endpoint: endpoint,
    },
  };

  logError(error, context);
}

// Firebase error handler
export function handleFirebaseError(error, operation) {
  const context = {
    firebase: true,
    operation,
    code: error.code,
    tags: {
      firebase_error: 'true',
      operation: operation,
      error_code: error.code,
    },
  };

  logError(error, context);
}
