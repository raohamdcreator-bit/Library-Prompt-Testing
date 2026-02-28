// src/main.jsx - Entry point with GuestModeProvider
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppStateProvider } from "./context/AppStateContext.jsx";
import { GuestModeProvider } from "./context/GuestModeContext.jsx";
import { initSentry } from "./lib/sentry.js";
import { initCookieConsent } from "./lib/cookieConsent.js";
import { NotificationProvider } from "./context/NotificationContext";
// §3.1 — Show consent banner on first visit; load GA4 only after user accepts
initCookieConsent();
// Sentry loads via dynamic import inside initSentry() — keeps @sentry/react
// out of the static module graph, preventing the Vite 7 Rolldown TDZ crash.
// Fire-and-forget: Sentry initialises after React starts, not before.
initSentry().catch(() => {});

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
