// src/components/EditPromptModal.jsx
import React, { useState, useEffect } from "react";

export default function EditPromptModal({ open, prompt, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title || "");
      setTags(
        Array.isArray(prompt.tags)
          ? prompt.tags.join(", ")
          : (prompt.tags || "").toString()
      );
      setText(prompt.text || "");
    } else {
      setTitle("");
      setTags("");
      setText("");
    }
  }, [prompt]);

  if (!open) return null;

  async function handleSave() {
    if (!title.trim() || !text.trim()) {
      alert("Please fill in both title and prompt text");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        title: title.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        text: text.trim(),
      });
    } catch (error) {
      console.error("Error saving prompt:", error);
      alert("Failed to save prompt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="text-lg"
                style={{ color: "var(--primary-foreground)" }}
              >
                ✏️
              </span>
            </div>
            <div className="flex-1">
              <h3
                className="text-lg font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Edit Prompt
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Update your prompt details
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Title Input */}
            <div className="space-y-2">
              <label
                htmlFor="edit-prompt-title"
                className="block text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Title *
              </label>
              <input
                id="edit-prompt-title"
                type="text"
                placeholder="Enter a descriptive title for your prompt"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={isSubmitting}
                maxLength={100}
              />
              <div
                className="flex justify-between text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span>
                  A clear, descriptive title helps others understand your
                  prompt's purpose
                </span>
                <span>{title.length}/100</span>
              </div>
            </div>

            {/* Prompt Content */}
            <div className="space-y-2">
              <label
                htmlFor="edit-prompt-text"
                className="block text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Prompt Content *
              </label>
              <div className="relative">
                <textarea
                  id="edit-prompt-text"
                  placeholder="Write your AI prompt here. Be specific about what you want the AI to do, provide context, and include any formatting instructions..."
                  className="form-input min-h-32 resize-y"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required
                  disabled={isSubmitting}
                  rows={8}
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <div
                className="flex justify-between text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span>
                  Write clear, specific instructions for best AI performance
                </span>
                <span>
                  {text.length} characters •{" "}
                  {text.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            </div>

            {/* Tags Input */}
            <div className="space-y-2">
              <label
                htmlFor="edit-prompt-tags"
                className="block text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Tags
              </label>
              <input
                id="edit-prompt-tags"
                type="text"
                placeholder="e.g. writing, creative, marketing, code"
                className="form-input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={isSubmitting}
              />
              <div
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Add comma-separated tags to help organize and discover prompts
              </div>

              {/* Tag Preview */}
              {tags.trim() && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.split(",").map((tag, index) => {
                    const cleanTag = tag.trim();
                    if (!cleanTag) return null;
                    return (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                        style={{
                          backgroundColor: "var(--secondary)",
                          color: "var(--secondary-foreground)",
                          borderColor: "var(--border)",
                        }}
                      >
                        #{cleanTag}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Help Text */}
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <h4
                className="text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                💡 Tips for effective prompts:
              </h4>
              <ul
                className="text-xs space-y-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                <li>• Be specific about the desired output format</li>
                <li>• Provide relevant context and examples</li>
                <li>• Use clear, actionable language</li>
                <li>• Test your prompt before sharing with the team</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-6">
            <button
              onClick={handleSave}
              disabled={isSubmitting || !title.trim() || !text.trim()}
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {isSubmitting && <div className="neo-spinner w-4 h-4"></div>}
              <span>{isSubmitting ? "Updating..." : "Update Prompt"}</span>
            </button>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary px-6 py-2.5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
