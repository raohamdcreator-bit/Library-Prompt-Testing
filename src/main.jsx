// src/main.jsx - Updated with Secure State Management
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AppStateProvider } from "./context/AppStateContext"; // ✅ NEW: Secure state management
import ErrorBoundary, { ConnectionStatus } from "./components/ErrorBoundary";
import "./index.css";
import "./App.css";

// Custom error fallback component
function AppErrorFallback({ error, onReset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-8 text-center shadow-lg">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-red-800 mb-4">
          Oops! Something went wrong
        </h1>
        <p className="text-red-600 text-sm mb-6">
          We encountered an unexpected error in the Prompt Teams app. This might
          be a temporary issue.
        </p>

        <div className="space-y-3">
          <button
            onClick={onReset}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Try Again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Reload Application
          </button>

          <button
            onClick={() => {
              // Clear all cached data
              if ("caches" in window) {
                caches.keys().then((names) => {
                  names.forEach((name) => caches.delete(name));
                });
              }

              // ✅ SECURE: Clear session storage instead of localStorage
              sessionStorage.clear();

              // Clear IndexedDB
              if ("indexedDB" in window) {
                indexedDB.deleteDatabase("PromptTeamsDB");
              }

              window.location.reload();
            }}
            className="w-full text-gray-600 hover:text-gray-800 text-sm py-2 px-4 rounded transition-colors"
          >
            Clear Data & Reload
          </button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <details className="mt-6 text-left">
            <summary className="text-sm font-medium text-red-700 cursor-pointer">
              Error Details (Development Mode)
            </summary>
            <div className="mt-2 text-xs bg-red-50 p-3 rounded border">
              <pre className="whitespace-pre-wrap text-red-800">
                {error?.toString()}
              </pre>
            </div>
          </details>
        )}

        <div className="mt-6 text-xs text-gray-500">
          If this problem persists, please refresh the page or contact support.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={AppErrorFallback}
      showDetails={process.env.NODE_ENV === "development"}
    >
      <ConnectionStatus />
      <AuthProvider>
        {/* ✅ NEW: Wrap app with secure state provider */}
        <AppStateProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AppStateProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
