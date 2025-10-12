// src/context/NotificationContext.jsx - Proper React Notification System
import { createContext, useContext, useState, useCallback } from "react";

const NotificationContext = createContext();

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback(
    (message, type = "info", duration = 4000) => {
      const id = Date.now() + Math.random();

      const notification = {
        id,
        message,
        type, // 'success' | 'error' | 'warning' | 'info'
        duration,
        timestamp: new Date(),
      };

      setNotifications((prev) => [...prev, notification]);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback(
    (message, duration) => {
      return addNotification(message, "success", duration);
    },
    [addNotification]
  );

  const error = useCallback(
    (message, duration) => {
      return addNotification(message, "error", duration);
    },
    [addNotification]
  );

  const warning = useCallback(
    (message, duration) => {
      return addNotification(message, "warning", duration);
    },
    [addNotification]
  );

  const info = useCallback(
    (message, duration) => {
      return addNotification(message, "info", duration);
    },
    [addNotification]
  );

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// Notification Container Component
function NotificationContainer() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

// Individual Notification Component
function Notification({ notification, onClose }) {
  const { message, type } = notification;

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
      default:
        return "ℹ";
    }
  };

  const getStyles = () => {
    const baseStyles = {
      backgroundColor: "var(--card)",
      color: "var(--foreground)",
      border: "1px solid",
    };

    switch (type) {
      case "success":
        return { ...baseStyles, borderColor: "rgb(34, 197, 94)" };
      case "error":
        return { ...baseStyles, borderColor: "var(--destructive)" };
      case "warning":
        return { ...baseStyles, borderColor: "rgb(234, 179, 8)" };
      case "info":
      default:
        return { ...baseStyles, borderColor: "var(--primary)" };
    }
  };

  return (
    <div
      className="glass-card px-4 py-3 rounded-lg text-sm shadow-lg animate-slideIn"
      style={getStyles()}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg flex-shrink-0">{getIcon()}</span>
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label="Close notification"
          style={{ color: "var(--muted-foreground)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Add animation styles to App.css
const animationStyles = `
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out;
}
`;

// Export styles to be added to App.css
export { animationStyles };
