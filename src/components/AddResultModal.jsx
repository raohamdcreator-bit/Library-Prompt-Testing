//src/components/AddResultModal.jsx - Fixed Overlap Issue (Styles in App.css)
import { useState, useEffect } from "react";
import { addResultToPrompt } from "../lib/results";
import { uploadResultImage } from "../lib/storage";

export default function AddResultModal({
  isOpen,
  onClose,
  promptId,
  teamId,
  userId,
}) {
  const [resultType, setResultType] = useState("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
    }
    
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('--scrollbar-width');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be less than 10MB");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    if (resultType !== "image" && !content.trim()) {
      alert("Content is required");
      return;
    }

    if (resultType === "image" && !imageFile) {
      alert("Please select an image");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      let resultData = {
        type: resultType,
        title: title.trim(),
      };

      if (resultType === "text") {
        resultData.content = content.trim();
      } else if (resultType === "code") {
        resultData.content = content.trim();
        resultData.language = language;
      } else if (resultType === "image") {
        setUploadProgress(30);
        const imageData = await uploadResultImage(imageFile, promptId, userId);
        setUploadProgress(70);

        resultData.imageUrl = imageData.url;
        resultData.imagePath = imageData.path;
        resultData.imageFilename = imageData.filename;
        resultData.imageSize = imageData.size;
        resultData.imageType = imageData.type;
      }

      setUploadProgress(90);
      await addResultToPrompt(teamId, promptId, userId, resultData);
      setUploadProgress(100);

      showNotification("Result added successfully!", "success");
      
      // Reset form
      setTitle("");
      setContent("");
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (error) {
      console.error("Error adding result:", error);
      showNotification(error.message || "Failed to add result", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function showNotification(message, type = "info") {
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const notification = document.createElement("div");
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
      </div>
    `;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-50 text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${type === "error" ? "destructive" : "primary"});
      z-index: 10000;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="modal-header">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              Add AI Output Result
            </h3>
            <button
              onClick={onClose}
              disabled={uploading}
              className="modal-close-btn"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Result Type Selection */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Result Type
              </label>
              <div className="modal-type-selector">
                {[
                  { value: "text", icon: "📝", label: "Text" },
                  { value: "code", icon: "💻", label: "Code" },
                  { value: "image", icon: "🖼️", label: "Image" },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setResultType(type.value)}
                    className={`modal-type-btn ${
                      resultType === type.value ? "active" : ""
                    }`}
                  >
                    <div className="modal-type-icon">{type.icon}</div>
                    <div className="modal-type-label">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
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
                placeholder="e.g., Generated Blog Post, API Response"
                className="form-input"
                required
                disabled={uploading}
              />
            </div>

            {/* Content (Text) */}
            {resultType === "text" && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Text Content *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your AI-generated text output here..."
                  className="form-input"
                  required
                  disabled={uploading}
                  style={{
                    minHeight: '200px',
                    fontFamily: 'JetBrains Mono, Consolas, monospace',
                    lineHeight: '1.6',
                    resize: 'vertical',
                  }}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {content.length} characters
                </p>
              </div>
            )}

            {/* Content (Code) */}
            {resultType === "code" && (
              <>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Programming Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="form-input"
                    disabled={uploading}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="csharp">C#</option>
                    <option value="cpp">C++</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                    <option value="php">PHP</option>
                    <option value="ruby">Ruby</option>
                    <option value="swift">Swift</option>
                    <option value="kotlin">Kotlin</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="sql">SQL</option>
                    <option value="bash">Bash</option>
                    <option value="json">JSON</option>
                    <option value="yaml">YAML</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Code Content *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste your AI-generated code here..."
                    className="form-input"
                    required
                    disabled={uploading}
                    style={{
                      minHeight: '300px',
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      fontFamily: 'JetBrains Mono, Consolas, monospace',
                      lineHeight: '1.6',
                      resize: 'vertical',
                    }}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {content.length} characters
                  </p>
                </div>
              </>
            )}

            {/* Content (Image) */}
            {resultType === "image" && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Upload Image *
                </label>

                {!imagePreview ? (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div className="modal-image-upload-area">
                      <svg
                        className="w-12 h-12 mx-auto mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p
                        className="text-sm font-medium mb-1"
                        style={{ color: "var(--foreground)" }}
                      >
                        Click to upload image
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        PNG, JPG, GIF, WebP (max 10MB)
                      </p>
                    </div>
                  </label>
                ) : (
                  <div className="modal-image-preview">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-auto"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      disabled={uploading}
                      className="modal-image-delete-btn"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                {imageFile && (
                  <p
                    className="text-xs mt-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div
                  className="flex items-center justify-between text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="modal-progress-bar">
                  <div
                    className="modal-progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="modal-footer">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={uploading}
              className="btn-primary flex-1"
              style={{
                opacity: uploading ? 0.5 : 1,
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? "Adding Result..." : "Add Result"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="btn-secondary sm:w-auto"
              style={{
                opacity: uploading ? 0.5 : 1,
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
