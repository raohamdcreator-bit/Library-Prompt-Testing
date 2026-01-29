// src/main.jsx - Entry point with GuestModeProvider
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppStateProvider } from "./context/AppStateContext.jsx";
import { GuestModeProvider } from "./context/GuestModeContext.jsx"; // NEW
import { initSentry } from "./lib/sentry.js";

// Initialize error tracking
initSentry();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AppStateProvider>
        <GuestModeProvider>
          <App />
        </GuestModeProvider>
      </AppStateProvider>
    </AuthProvider>
  </StrictMode>
);
