// src/components/ErrorBoundary.jsx
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2),
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught by boundary:", error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback, showDetails } = this.props;

      // Use custom fallback if provided
      if (Fallback) {
        return <Fallback error={this.state.error} onReset={this.handleReset} />;
      }

      // Default error UI
      return (
        <div className="min-h-64 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-red-600 text-sm mb-4">
              We encountered an unexpected error. Please try again.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-primary text-sm px-4 py-2"
              >
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                className="btn-secondary text-sm px-4 py-2"
              >
                Reload Page
              </button>
            </div>

            {showDetails && process.env.NODE_ENV === "development" && (
              <details className="mt-4 text-left">
                <summary className="text-sm font-medium text-red-700 cursor-pointer">
                  Error Details (Dev Mode)
                </summary>
                <div className="mt-2 text-xs bg-red-100 p-2 rounded">
                  <p className="font-medium">Error ID: {this.state.errorId}</p>
                  <p className="font-medium">
                    Error: {this.state.error?.toString()}
                  </p>
                  <pre className="mt-1 text-xs overflow-auto">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for handling async errors in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState(null);

  const resetError = () => setError(null);

  const handleError = React.useCallback((error) => {
    console.error("Async error caught:", error);
    setError(error);
  }, []);

  // Throw error to trigger error boundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
}

// Utility functions for error handling
export const ErrorUtils = {
  // Get user-friendly error message
  getErrorMessage(error) {
    if (!error) return "An unknown error occurred";

    // Firebase specific errors
    if (error.code) {
      switch (error.code) {
        case "permission-denied":
          return "You don't have permission to perform this action";
        case "not-found":
          return "The requested item was not found";
        case "already-exists":
          return "This item already exists";
        case "unavailable":
          return "Service is temporarily unavailable. Please try again";
        case "unauthenticated":
          return "Please sign in to continue";
        case "quota-exceeded":
          return "Storage quota exceeded. Please contact support";
        case "network-request-failed":
          return "Network error. Please check your connection";
        default:
          return error.message || "An error occurred";
      }
    }

    // Generic errors
    if (error.message) {
      return error.message;
    }

    return "An unexpected error occurred";
  },

  // Log error to service (placeholder for production error logging)
  logError(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      context,
    };

    // In development, just log to console
    if (process.env.NODE_ENV === "development") {
      console.error("Error logged:", errorData);
      return;
    }

    // In production, you would send to your error tracking service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    // errorTrackingService.log(errorData);
  },

  // Retry wrapper for async operations
  async withRetry(operation, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error.code === "permission-denied" || error.code === "not-found") {
          throw error;
        }

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  },
};

// Offline detection hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [wasOffline, setWasOffline] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
        // Show reconnection message
        console.log("Connection restored");
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

// Connection status component
export function ConnectionStatus() {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) {
    return null; // Don't show anything when online normally
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium ${
        isOnline ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {isOnline
        ? "✅ Connection restored"
        : "⚠️ No internet connection - some features may not work"}
    </div>
  );
}

export default ErrorBoundary;
