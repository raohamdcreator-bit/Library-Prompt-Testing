// src/components/FormValidation.jsx
import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "../hooks/useCache";

// Validation rules
export const ValidationRules = {
  required: (value, message = "This field is required") => {
    if (!value || (typeof value === "string" && !value.trim())) {
      return message;
    }
    return null;
  },

  minLength: (min, message) => (value) => {
    if (value && value.length < min) {
      return message || `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max, message) => (value) => {
    if (value && value.length > max) {
      return message || `Must be no more than ${max} characters`;
    }
    return null;
  },

  email: (value, message = "Please enter a valid email address") => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return message;
    }
    return null;
  },

  pattern: (regex, message) => (value) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return null;
  },

  custom: (validator, message) => (value) => {
    if (value && !validator(value)) {
      return message;
    }
    return null;
  },
};

// Hook for form validation
export function useFormValidation(initialValues = {}, validationRules = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate a single field
  const validateField = useCallback(
    (name, value) => {
      const rules = validationRules[name];
      if (!rules) return null;

      for (const rule of rules) {
        const error = rule(value);
        if (error) return error;
      }
      return null;
    },
    [validationRules]
  );

  // Validate all fields
  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField, validationRules]);

  // Handle field change
  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error if field becomes valid
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  // Handle field blur
  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  // Handle form submission
  const handleSubmit = async (onSubmit) => {
    setIsSubmitting(true);

    // Mark all fields as touched
    const allTouched = Object.keys(validationRules).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);

    // Validate all fields
    const isValid = validateAll();

    if (isValid) {
      try {
        await onSubmit(values);
      } catch (error) {
        console.error("Form submission error:", error);
      }
    }

    setIsSubmitting(false);
    return isValid;
  };

  // Reset form
  const reset = (newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    validateField,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0,
  };
}

// Enhanced Input Component
export function ValidatedInput({
  name,
  label,
  type = "text",
  placeholder,
  required = false,
  validation = [],
  value = "",
  onChange,
  onBlur,
  error,
  touched,
  disabled = false,
  className = "",
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const debouncedValue = useDebounce(value, 300);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setCharCount(value.length);
  }, [value]);

  const showError = touched && error;
  const maxLength = props.maxLength;

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlurInternal = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(name);
  };

  const handleChangeInternal = (e) => {
    const newValue = e.target.value;
    if (onChange) onChange(name, newValue);
  };

  const inputClasses = `
    form-input w-full transition-all duration-200
    ${
      showError
        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
    }
    ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}
    ${isFocused ? "ring-2" : ""}
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {type === "textarea" ? (
          <textarea
            name={name}
            value={value}
            onChange={handleChangeInternal}
            onFocus={handleFocus}
            onBlur={handleBlurInternal}
            placeholder={placeholder}
            disabled={disabled}
            className={inputClasses}
            rows={4}
            {...props}
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value}
            onChange={handleChangeInternal}
            onFocus={handleFocus}
            onBlur={handleBlurInternal}
            placeholder={placeholder}
            disabled={disabled}
            className={inputClasses}
            {...props}
          />
        )}

        {/* Character counter */}
        {maxLength && type === "textarea" && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-1">
            {charCount}/{maxLength}
          </div>
        )}
      </div>

      {/* Error message */}
      {showError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </p>
      )}

      {/* Character count for inputs */}
      {maxLength && type !== "textarea" && (
        <p className="text-xs text-gray-500">
          {charCount}/{maxLength} characters
        </p>
      )}

      {/* Help text */}
      {props.helpText && !showError && (
        <p className="text-xs text-gray-500">{props.helpText}</p>
      )}
    </div>
  );
}

// Enhanced Select Component
export function ValidatedSelect({
  name,
  label,
  options = [],
  value = "",
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  disabled = false,
  placeholder = "Select an option",
  className = "",
  ...props
}) {
  const showError = touched && error;

  const selectClasses = `
    form-input w-full transition-all duration-200
    ${
      showError
        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
    }
    ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        name={name}
        value={value}
        onChange={(e) => onChange && onChange(name, e.target.value)}
        onBlur={() => onBlur && onBlur(name)}
        disabled={disabled}
        className={selectClasses}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {showError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </p>
      )}
    </div>
  );
}

// Form wrapper component
export function ValidatedForm({
  children,
  onSubmit,
  validation,
  initialValues = {},
  className = "",
}) {
  const form = useFormValidation(initialValues, validation);

  const handleSubmit = (e) => {
    e.preventDefault();
    form.handleSubmit(onSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {typeof children === "function" ? children(form) : children}
    </form>
  );
}

// Real-time validation hook
export function useRealTimeValidation(value, rules, delay = 300) {
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    if (!debouncedValue) {
      setError(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);

    const validateAsync = async () => {
      try {
        for (const rule of rules) {
          const result = await rule(debouncedValue);
          if (result) {
            setError(result);
            setIsValidating(false);
            return;
          }
        }
        setError(null);
      } catch (err) {
        setError("Validation failed");
      }
      setIsValidating(false);
    };

    validateAsync();
  }, [debouncedValue, rules]);

  return { error, isValidating };
}

// Validation indicator component
export function ValidationIndicator({ isValid, isValidating, error }) {
  if (isValidating) {
    return <span className="text-gray-500">⏳</span>;
  }

  if (error) {
    return (
      <span className="text-red-500" title={error}>
        ❌
      </span>
    );
  }

  if (isValid) {
    return <span className="text-green-500">✅</span>;
  }

  return null;
}
