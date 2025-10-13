// src/components/LegalLayout.jsx - Optimized Custom Routing
import { createContext, useContext, useCallback } from "react";

// Create a navigation context
const NavigationContext = createContext(null);

export function NavigationProvider({ children, navigate }) {
  return (
    <NavigationContext.Provider value={navigate}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}

// Custom Link component that uses our navigation
function CustomLink({ to, children, className, style }) {
  const navigate = useNavigation();

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("CustomLink clicked - Navigating to:", to);
      if (navigate) {
        navigate(to);
      } else {
        console.error("Navigation function not available!");
      }
    },
    [navigate, to]
  );

  return (
    <button
      onClick={handleClick}
      className={`${className} cursor-pointer hover:opacity-80 transition-opacity`}
      style={style}
      type="button"
    >
      {children}
    </button>
  );
}

export default function LegalLayout({ title, lastUpdated, children }) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-4xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h1>
          {lastUpdated && (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Last Updated: {lastUpdated}
            </p>
          )}
        </div>

        {/* Content */}
        <div
          className="prose prose-lg max-w-none"
          style={{ color: "var(--foreground)" }}
        >
          {children}
        </div>

        {/* Footer Navigation */}
        <div
          className="mt-12 pt-8 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <h3
            className="text-lg font-semibold mb-4 text-center"
            style={{ color: "var(--foreground)" }}
          >
            Quick Links
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <CustomLink
              to="/privacy"
              className="p-4 text-center rounded-lg border transition-all hover:border-primary/50"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">🔒</span>
                <span style={{ color: "var(--foreground)", fontWeight: "500" }}>
                  Privacy Policy
                </span>
              </div>
            </CustomLink>
            <CustomLink
              to="/terms"
              className="p-4 text-center rounded-lg border transition-all hover:border-primary/50"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">📄</span>
                <span style={{ color: "var(--foreground)", fontWeight: "500" }}>
                  Terms of Use
                </span>
              </div>
            </CustomLink>
            <CustomLink
              to="/contact"
              className="p-4 text-center rounded-lg border transition-all hover:border-primary/50"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">📧</span>
                <span style={{ color: "var(--foreground)", fontWeight: "500" }}>
                  Contact Us
                </span>
              </div>
            </CustomLink>
          </div>
        </div>
      </div>
    </div>
  );
}
