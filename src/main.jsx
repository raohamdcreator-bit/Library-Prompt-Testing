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
import { initCookieConsent } from "./lib/cookieConsent.js";
import { NotificationProvider } from "./context/NotificationContext";
// Initialize error tracking
initSentry();
// §3.1 — Show consent banner on first visit; load GA4 only after user accepts
initCookieConsent();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AppStateProvider>
        <GuestModeProvider>
          <NotificationProvider>
          <App />
          </NotificationProvider>
        </GuestModeProvider>
      </AppStateProvider>
    </AuthProvider>
  </StrictMode>
);
