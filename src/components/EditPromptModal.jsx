// src/components/EditPromptModal.jsx - Fixed Header Overlap
import { useState, useEffect } from "react";
import { X, Lock, Unlock, AlertCircle } from "lucide-react";

export default function EditPromptModal({ open, prompt, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title || "");
      setText(prompt.text || "");
      setTags(Array.isArray(prompt.tags) ? prompt.tags.join(", ") : "");
      setVisibility(prompt.visibility || "public");
    }
  }, [prompt]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim() || !text.trim()) {
      alert("Title and prompt text are required");
      return;
    }

    setSaving(true);

    try {
      await onSave({
        title: title.trim(),
        text: text.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        visibility: visibility,
      });
    } catch (error) {
      console.error("Error saving prompt:", error);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div 
          className="flex-shrink-0 p-6 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <h3
              className="text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Edit Prompt
            </h3>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Blog Post Generator"
                className="form-input"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Prompt Text *
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your prompt here..."
                className="form-input min-h-[200px]"
                required
                disabled={saving}
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                {text.length} characters
              </p>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., writing, creative, marketing"
                className="form-input"
                disabled={saving}
              />
            </div>

            {/* Visibility Control */}
            <div>
              <label
                className="block text-sm font-medium mb-3"
                style={{ color: "var(--foreground)" }}
              >
                Visibility
              </label>
              <div className="space-y-3">
                <label
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50"
                  style={{
                    backgroundColor:
                      visibility === "public"
                        ? "var(--secondary)"
                        : "transparent",
                    borderColor:
                      visibility === "public"
                        ? "var(--primary)"
                        : "var(--border)",
                  }}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === "public"}
                    onChange={(e) => setVisibility(e.target.value)}
                    disabled={saving}
                    className="form-radio mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Unlock className="w-4 h-4" />
                      <span
                        className="font-medium text-sm"
                        style={{ color: "var(--foreground)" }}
                      >
                        Public
                      </span>
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      All team members can view this prompt
                    </p>
                  </div>
                </label>

                <label
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50"
                  style={{
                    backgroundColor:
                      visibility === "private"
                        ? "var(--secondary)"
                        : "transparent",
                    borderColor:
                      visibility === "private"
                        ? "var(--accent)"
                        : "var(--border)",
                  }}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === "private"}
                    onChange={(e) => setVisibility(e.target.value)}
                    disabled={saving}
                    className="form-radio mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="w-4 h-4" />
                      <span
                        className="font-medium text-sm"
                        style={{ color: "var(--foreground)" }}
                      >
                        Private
                      </span>
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Only you and team admins/owners can view this prompt
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Info Box */}
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex gap-2">
                <AlertCircle
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  style={{ color: "var(--muted-foreground)" }}
                />
                <div
                  className="text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <p className="font-medium mb-1">Privacy Information:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      Private prompts are only visible to you and team
                      admins/owners
                    </li>
                    <li>
                      Results added to private prompts follow the same
                      visibility rules
                    </li>
                    <li>You can change visibility at any time</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 py-3"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn-secondary px-6 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
