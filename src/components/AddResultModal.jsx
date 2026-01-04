// src/components/AddResultModal.jsx - Fixed Header Overlap
import { useState } from "react";
import { addResultToPrompt } from "../lib/results";
import { uploadResultImage } from "../lib/storage";
import { X, FileText, Code, Image, Upload, AlertCircle } from "lucide-react";
import { useSoundEffects } from '../hooks/useSoundEffects';
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
  const { playNotification } = useSoundEffects();
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
    playNotification();
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const notification = document.createElement("div");
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
      </div>
    `;
    notification.className =
      "fixed top-4 right-4 glass-card px-4 py-3 rounded-lg z-[9999] text-sm transition-opacity duration-300";
    notification.style.cssText = `
      background-color: var(--card);
      color: var(--foreground);
      border: 1px solid var(--${type === "error" ? "destructive" : "primary"});
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
          className="flex-shrink-0 p-4 md:p-6 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <h3
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Add AI Output Result
            </h3>
            <button
              onClick={onClose}
              disabled={uploading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Result Type Selection */}
            <div>
              <label
                className="block text-xs md:text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Result Type
              </label>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {[
                  { value: "text", icon: FileText, label: "Text" },
                  { value: "code", icon: Code, label: "Code" },
                  { value: "image", icon: Image, label: "Image" },
                ].map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setResultType(type.value)}
                      className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                        resultType === type.value
                          ? "border-primary"
                          : "border-border"
                      }`}
                      style={{
                        backgroundColor:
                          resultType === type.value
                            ? "var(--secondary)"
                            : "var(--card)",
                      }}
                    >
                      <Icon 
                        className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2"
                        style={{ 
                          color: resultType === type.value 
                            ? "var(--primary)" 
                            : "var(--muted-foreground)"
                        }}
                      />
                      <div
                        className="text-xs md:text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {type.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label
                className="block text-xs md:text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Generated Blog Post, API Response"
                className="form-input text-sm md:text-base"
                required
                disabled={uploading}
              />
            </div>

            {/* Content (Text) */}
            {resultType === "text" && (
              <div>
                <label
                  className="block text-xs md:text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Text Content *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your AI-generated text output here..."
                  className="form-input min-h-[150px] md:min-h-[200px] font-mono text-xs md:text-sm"
                  required
                  disabled={uploading}
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
                    className="block text-xs md:text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Programming Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="form-input text-sm md:text-base"
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
                    className="block text-xs md:text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Code Content *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste your AI-generated code here..."
                    className="form-input min-h-[200px] md:min-h-[300px] font-mono text-xs md:text-sm"
                    required
                    disabled={uploading}
                    style={{
                      fontFamily: "JetBrains Mono, Consolas, monospace",
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
                  className="block text-xs md:text-sm font-medium mb-2"
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
                    <div
                      className="border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-primary transition-colors"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Upload
                        className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                      <p
                        className="text-xs md:text-sm font-medium mb-1"
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
                  <div
                    className="relative rounded-lg overflow-hidden border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-auto max-h-64 md:max-h-96 object-contain bg-black/5"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      disabled={uploading}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                    >
                      <X className="w-4 h-4" />
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
                  className="flex items-center justify-between text-xs md:text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${uploadProgress}%`,
                      backgroundColor: "var(--primary)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={uploading}
                className="btn-primary flex-1 py-2 md:py-3 text-sm md:text-base"
              >
                {uploading ? "Adding Result..." : "Add Result"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="btn-secondary px-6 py-2 md:py-3 text-sm md:text-base sm:w-auto"
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
