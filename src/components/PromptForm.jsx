// src/components/PromptForm.jsx - Updated to match demo UI
import { useState, useEffect } from "react";

export default function PromptForm({
  onSubmit,
  editingPrompt,
  onUpdate,
  onCancel,
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title || "");
      setText(editingPrompt.text || "");
      setTags((editingPrompt.tags || []).join(", "));
    } else {
      setTitle("");
      setText("");
      setTags("");
    }
  }, [editingPrompt]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim() || !text.trim()) {
      alert("Please fill in both title and prompt text");
      return;
    }

    setIsSubmitting(true);

    const prompt = {
      title: title.trim(),
      text: text.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      if (editingPrompt && onUpdate) {
        await onUpdate(editingPrompt.id, prompt);
      } else if (onSubmit) {
        await onSubmit(prompt);
      }

      if (!editingPrompt) {
        setTitle("");
        setText("");
        setTags("");
      }
    } catch (error) {
      console.error("Error submitting prompt:", error);
      alert("Failed to save prompt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setTitle("");
    setText("");
    setTags("");
    if (onCancel) {
      onCancel();
    }
  }

  const isEditing = Boolean(editingPrompt);

  return (
    <div
      className="glass-card p-6 mb-6"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--primary)" }}
        >
          <span
            className="text-lg"
            style={{ color: "var(--primary-foreground)" }}
          >
            {isEditing ? "✏️" : "➕"}
          </span>
        </div>
        <div>
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {isEditing ? "Edit Prompt" : "Create New Prompt"}
          </h3>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isEditing
              ? "Update your prompt details"
              : "Add a new prompt to your team library"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Input */}
        <div className="space-y-2">
          <label
            htmlFor="prompt-title"
            className="block text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Title *
          </label>
          <input
            id="prompt-title"
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
              A clear, descriptive title helps others understand your prompt's
              purpose
            </span>
            <span>{title.length}/100</span>
          </div>
        </div>

        {/* Prompt Content */}
        <div className="space-y-2">
          <label
            htmlFor="prompt-text"
            className="block text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Prompt Content *
          </label>
          <div className="relative">
            <textarea
              id="prompt-text"
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
            htmlFor="prompt-tags"
            className="block text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Tags
          </label>
          <input
            id="prompt-tags"
            type="text"
            placeholder="e.g. writing, creative, marketing, code"
            className="form-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
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

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !text.trim()}
            className="btn-primary px-6 py-2.5 flex items-center gap-2"
          >
            {isSubmitting && <div className="neo-spinner w-4 h-4"></div>}
            <span>
              {isSubmitting
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Prompt"
                : "Create Prompt"}
            </span>
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="btn-secondary px-6 py-2.5"
            >
              Cancel
            </button>
          )}

          {!isEditing && (title || text || tags) && (
            <button
              type="button"
              onClick={() => {
                setTitle("");
                setText("");
                setTags("");
              }}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm transition-colors rounded-lg"
              style={{
                color: "var(--muted-foreground)",
                ":hover": { color: "var(--foreground)" },
              }}
            >
              Clear Form
            </button>
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
      </form>
    </div>
  );
}
