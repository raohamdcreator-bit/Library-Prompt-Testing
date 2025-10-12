// src/components/ExportImport.jsx - Updated to match PromptList UI style
import { useState } from "react";

export default function ExportImport({ onImport, teamId, teamName, userRole }) {
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  function canImport() {
    return (
      userRole === "owner" || userRole === "admin" || userRole === "member"
    );
  }

  async function handleFileImport(file) {
    if (!canImport()) {
      alert("You don't have permission to import prompts to this team.");
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      let prompts = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        try {
          const data = JSON.parse(text);
          prompts = Array.isArray(data) ? data : [data];
        } catch (e) {
          throw new Error("Invalid JSON format");
        }
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        prompts = parseCSV(text);
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        prompts = parseTXT(text);
      } else {
        throw new Error(
          "Unsupported file format. Please use JSON, CSV, or TXT files."
        );
      }

      const validPrompts = prompts
        .filter((prompt) => prompt && (prompt.title || prompt.text))
        .map((prompt) => ({
          title: String(prompt.title || "").trim() || "Untitled Prompt",
          text: String(prompt.text || "").trim() || "",
          tags: Array.isArray(prompt.tags)
            ? prompt.tags.filter((tag) => typeof tag === "string" && tag.trim())
            : typeof prompt.tags === "string"
            ? prompt.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        }))
        .filter((prompt) => prompt.text);

      if (validPrompts.length === 0) {
        throw new Error("No valid prompts found in the file.");
      }

      const confirmMessage = `Import ${validPrompts.length} prompts to "${teamName}"?`;
      if (!confirm(confirmMessage)) return;

      await onImport(validPrompts);
      alert(`Successfully imported ${validPrompts.length} prompts!`);
    } catch (error) {
      console.error("Import error:", error);
      alert("Import failed: " + (error.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  }

  function parseCSV(text) {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const titleIndex = headers.findIndex(
      (h) => h.includes("title") || h.includes("name")
    );
    const textIndex = headers.findIndex(
      (h) => h.includes("text") || h.includes("content") || h.includes("prompt")
    );
    const tagsIndex = headers.findIndex((h) => h.includes("tag"));

    if (textIndex === -1) {
      throw new Error(
        "CSV must have a column for prompt text (e.g., 'text', 'content', 'prompt')"
      );
    }

    return lines.slice(1).map((line) => {
      const cols = line
        .split(",")
        .map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
      return {
        title: titleIndex >= 0 ? cols[titleIndex] : "",
        text: cols[textIndex] || "",
        tags: tagsIndex >= 0 ? cols[tagsIndex] : "",
      };
    });
  }

  function parseTXT(text) {
    const sections = text
      .split(/\n\s*---\s*\n|\n\s*===\s*\n/)
      .filter((section) => section.trim());

    if (sections.length === 1) {
      const lines = sections[0].split("\n").filter((line) => line.trim());
      return [
        {
          title: lines[0] || "Imported Prompt",
          text: lines.slice(1).join("\n").trim() || lines[0] || "",
          tags: [],
        },
      ];
    }

    return sections.map((section, index) => {
      const lines = section.split("\n").filter((line) => line.trim());
      return {
        title: lines[0] || `Imported Prompt ${index + 1}`,
        text: lines.slice(1).join("\n").trim() || lines[0] || "",
        tags: [],
      };
    });
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = [...e.dataTransfer.files];
    if (files.length > 0) {
      handleFileImport(files[0]);
    }
  }

  function handleFileSelect(e) {
    const files = [...e.target.files];
    if (files.length > 0) {
      handleFileImport(files[0]);
    }
    e.target.value = "";
  }

  if (!canImport()) return null;

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📥</span>
        <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          Import Prompts
        </h3>
      </div>

      {/* Drag and Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
          dragActive ? "scale-105" : ""
        }`}
        style={{
          borderColor: dragActive ? "var(--primary)" : "var(--border)",
          backgroundColor: dragActive ? "var(--primary)/10" : "var(--muted)",
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {importing ? (
          <div className="flex flex-col items-center gap-4">
            <div className="neo-spinner w-12 h-12"></div>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>
              Processing file...
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Analyzing data...
            </p>
          </div>
        ) : (
          <>
            <div className="text-6xl mb-4 transition-transform duration-300 hover:scale-110">
              📁
            </div>
            <p className="mb-2 font-semibold text-lg" style={{ color: "var(--foreground)" }}>
              {dragActive ? "Drop file to upload" : "Drop files here or click to browse"}
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
              Supports JSON, CSV, and TXT files
            </p>

            <label className="btn-primary inline-flex items-center gap-2 px-6 py-3 cursor-pointer">
              <span className="text-lg">⬆️</span>
              Choose File
              <input
                type="file"
                accept=".json,.csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>

      {/* Format Instructions */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 rounded-full" style={{ backgroundColor: "var(--primary)" }}></div>
          <h4 className="font-semibold" style={{ color: "var(--foreground)" }}>
            Supported Formats
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* JSON Format */}
          <div 
            className="p-4 rounded-lg border transition-all duration-300 hover:border-primary/50"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📋</span>
              <h5 className="font-semibold" style={{ color: "var(--foreground)" }}>
                JSON
              </h5>
            </div>
            <code 
              className="text-xs block p-3 rounded border font-mono leading-relaxed"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              {`[{\n  "title": "...",\n  "text": "...",\n  "tags": [...]\n}]`}
            </code>
          </div>

          {/* CSV Format */}
          <div 
            className="p-4 rounded-lg border transition-all duration-300 hover:border-primary/50"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📊</span>
              <h5 className="font-semibold" style={{ color: "var(--foreground)" }}>
                CSV
              </h5>
            </div>
            <code 
              className="text-xs block p-3 rounded border font-mono leading-relaxed"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              title,text,tags
              <br />
              "Title","Content","tag1,tag2"
            </code>
          </div>

          {/* TXT Format */}
          <div 
            className="p-4 rounded-lg border transition-all duration-300 hover:border-primary/50"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📝</span>
              <h5 className="font-semibold" style={{ color: "var(--foreground)" }}>
                TXT
              </h5>
            </div>
            <code 
              className="text-xs block p-3 rounded border font-mono leading-relaxed"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              Title
              <br />
              Content here
              <br />
              ---
              <br />
              Next Title
              <br />
              Next content
            </code>
          </div>
        </div>

        {/* Tips Section */}
        <div 
          className="mt-6 p-4 rounded-lg border"
          style={{
            backgroundColor: "var(--secondary)",
            borderColor: "var(--primary)",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <h5 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Pro Tips
              </h5>
              <ul className="text-sm space-y-1" style={{ color: "var(--foreground)" }}>
                <li className="flex items-start gap-2">
                  <span style={{ color: "var(--primary)" }}>•</span>
                  <span>Ensure your CSV has headers for proper field mapping</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: "var(--primary)" }}>•</span>
                  <span>Use --- or === to separate multiple prompts in TXT files</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: "var(--primary)" }}>•</span>
                  <span>JSON arrays allow batch importing multiple prompts at once</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export utility functions
export const ExportUtils = {
  // Export prompts as JSON
  exportAsJSON(prompts, filename = "prompts") {
    const data = prompts.map((prompt) => ({
      title: prompt.title,
      text: prompt.text,
      tags: prompt.tags || [],
      createdAt: prompt.createdAt
        ? prompt.createdAt.toDate().toISOString()
        : null,
      author: prompt.createdBy,
    }));

    this.downloadFile(
      JSON.stringify(data, null, 2),
      `${filename}.json`,
      "application/json"
    );
  },

  // Export prompts as CSV
  exportAsCSV(prompts, filename = "prompts") {
    const headers = ["title", "text", "tags", "created_date", "author"];
    const rows = prompts.map((prompt) => [
      this.escapeCSV(prompt.title || ""),
      this.escapeCSV(prompt.text || ""),
      this.escapeCSV((prompt.tags || []).join(", ")),
      prompt.createdAt ? prompt.createdAt.toDate().toLocaleDateString() : "",
      prompt.createdBy || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    this.downloadFile(csvContent, `${filename}.csv`, "text/csv");
  },

  // Export prompts as TXT
  exportAsTXT(prompts, filename = "prompts") {
    const content = prompts
      .map((prompt) => {
        let section = prompt.title || "Untitled Prompt";
        section += "\n" + (prompt.text || "");
        if (prompt.tags && prompt.tags.length > 0) {
          section += "\nTags: " + prompt.tags.join(", ");
        }
        return section;
      })
      .join("\n\n---\n\n");

    this.downloadFile(content, `${filename}.txt`, "text/plain");
  },

  // Helper function to escape CSV values
  escapeCSV(value) {
    if (typeof value !== "string") return '""';
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return `"${value}"`;
  },

  // Helper function to download file
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
