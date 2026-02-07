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
    <div className="notification-container">
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

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return "rgba(34, 197, 94, 0.12)"; // Light green tint
      case "error":
        return "rgba(239, 68, 68, 0.12)"; // Light red tint
      case "warning":
        return "rgba(234, 179, 8, 0.12)"; // Light yellow tint
      case "info":
      default:
        return "rgba(139, 92, 246, 0.12)"; // Light purple tint
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "success":
        return "rgba(34, 197, 94, 0.4)";
      case "error":
        return "rgba(239, 68, 68, 0.4)";
      case "warning":
        return "rgba(234, 179, 8, 0.4)";
      case "info":
      default:
        return "rgba(139, 92, 246, 0.4)";
    }
  };

  const getIconColor = () => {
    switch (type) {
      case "success":
        return "rgb(34, 197, 94)";
      case "error":
        return "rgb(239, 68, 68)";
      case "warning":
        return "rgb(234, 179, 8)";
      case "info":
      default:
        return "rgb(139, 92, 246)";
    }
  };

  const getStyles = () => {
    return {
      backgroundColor: getBackgroundColor(),
      color: "var(--foreground)",
      border: `1px solid ${getBorderColor()}`,
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
    };
  };

  return (
    <div
      className="px-4 py-3 rounded-lg text-sm shadow-lg animate-slideIn backdrop-blur-sm"
      style={getStyles()}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span 
          className="text-lg flex-shrink-0 font-bold" 
          style={{ color: getIconColor() }}
        >
          {getIcon()}
        </span>
        <span className="flex-1 font-medium">{message}</span>
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
