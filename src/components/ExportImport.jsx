// src/components/ExportImport.jsx - Responsive layout
import { useState } from "react";
import { Upload, FileJson, FileSpreadsheet, FileText, Lightbulb, Loader2, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";

export default function ExportImport({ onImport, teamId, teamName, userRole }) {
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [formatsOpen, setFormatsOpen] = useState(false);

  function canImport() {
    return userRole === "owner" || userRole === "admin" || userRole === "member";
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
        } catch (e) { throw new Error("Invalid JSON format"); }
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        prompts = parseCSV(text);
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        prompts = parseTXT(text);
      } else {
        throw new Error("Unsupported file format. Please use JSON, CSV, or TXT files.");
      }

      const validPrompts = prompts
        .filter(p => p && (p.title || p.text))
        .map(p => ({
          title: String(p.title || "").trim() || "Untitled Prompt",
          text: String(p.text || "").trim() || "",
          tags: Array.isArray(p.tags)
            ? p.tags.filter(t => typeof t === "string" && t.trim())
            : typeof p.tags === "string"
            ? p.tags.split(",").map(t => t.trim()).filter(Boolean)
            : [],
        }))
        .filter(p => p.text);

      if (validPrompts.length === 0) throw new Error("No valid prompts found in the file.");
      if (!confirm(`Import ${validPrompts.length} prompts to "${teamName}"?`)) return;
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
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const titleIndex = headers.findIndex(h => h.includes("title") || h.includes("name"));
    const textIndex  = headers.findIndex(h => h.includes("text") || h.includes("content") || h.includes("prompt"));
    const tagsIndex  = headers.findIndex(h => h.includes("tag"));
    if (textIndex === -1) throw new Error("CSV must have a column for prompt text (e.g., 'text', 'content', 'prompt')");
    return lines.slice(1).map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"(.*)"$/, "$1"));
      return { title: titleIndex >= 0 ? cols[titleIndex] : "", text: cols[textIndex] || "", tags: tagsIndex >= 0 ? cols[tagsIndex] : "" };
    });
  }

  function parseTXT(text) {
    const sections = text.split(/\n\s*---\s*\n|\n\s*===\s*\n/).filter(s => s.trim());
    if (sections.length === 1) {
      const lines = sections[0].split("\n").filter(l => l.trim());
      return [{ title: lines[0] || "Imported Prompt", text: lines.slice(1).join("\n").trim() || lines[0] || "", tags: [] }];
    }
    return sections.map((section, index) => {
      const lines = section.split("\n").filter(l => l.trim());
      return { title: lines[0] || `Imported Prompt ${index + 1}`, text: lines.slice(1).join("\n").trim() || lines[0] || "", tags: [] };
    });
  }

  function handleDragEnter(e) { e.preventDefault(); e.stopPropagation(); setDragActive(true); }
  function handleDragLeave(e) { e.preventDefault(); e.stopPropagation(); setDragActive(false); }
  function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); }
  function handleDrop(e) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const files = [...e.dataTransfer.files];
    if (files.length > 0) handleFileImport(files[0]);
  }
  function handleFileSelect(e) {
    const files = [...e.target.files];
    if (files.length > 0) handleFileImport(files[0]);
    e.target.value = "";
  }

  if (!canImport()) return null;

  const formats = [
    {
      icon: <FileJson className="w-5 h-5 text-cyan-400" />,
      label: "JSON",
      code: `[{\n  "title": "...",\n  "text": "...",\n  "tags": [...]\n}]`,
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5 text-green-400" />,
      label: "CSV",
      code: `title,text,tags\n"Title","Content","tag1,tag2"`,
    },
    {
      icon: <FileText className="w-5 h-5 text-purple-400" />,
      label: "TXT",
      code: `Title\nContent here\n---\nNext Title\nNext content`,
    },
  ];

  return (
    <>
      <style>{`
        .ei-wrap { display:flex; flex-direction:column; gap:.75rem; }

        /* Drop zone */
        .ei-drop {
          border:2px dashed var(--border);
          border-radius:12px; padding:2rem 1.5rem;
          text-align:center; transition:all .25s;
          background:var(--muted);
          cursor:default;
        }
        .ei-drop.active {
          border-color:var(--primary);
          background:color-mix(in srgb, var(--primary) 8%, transparent);
          transform:scale(1.01);
        }
        @media(max-width:480px){
          .ei-drop { padding:1.25rem 1rem; }
        }

        /* Format grid: 3 cols → 1 col */
        .ei-formats {
          display:grid; grid-template-columns:repeat(3,1fr); gap:.75rem;
        }
        @media(max-width:640px){
          .ei-formats { grid-template-columns:1fr; }
        }

        /* Collapsible formats section toggle button */
        .ei-toggle {
          width:100%; display:flex; align-items:center; justify-content:space-between;
          padding:.625rem .875rem; border-radius:8px; cursor:pointer;
          border:1px solid var(--border); background:var(--card);
          color:var(--foreground); font-size:.8125rem; font-weight:600;
          transition:background .15s;
        }
        .ei-toggle:hover { background:var(--secondary); }

        /* Format card code block */
        .ei-code {
          font-size:.7rem; display:block; padding:.625rem;
          border-radius:6px; border:1px solid var(--border);
          background:var(--muted); color:var(--foreground);
          font-family:monospace; line-height:1.6; white-space:pre;
          overflow-x:auto;
        }
      `}</style>

      <div className="glass-card p-5 ei-wrap">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Import Prompts</h3>
          <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>JSON · CSV · TXT</span>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`ei-drop${dragActive ? " active" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {importing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
              <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Processing file…</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Analysing data…</p>
            </div>
          ) : (
            <>
              <FolderOpen
                className="mx-auto mb-3 text-cyan-400 transition-transform duration-300 hover:scale-110"
                style={{ width: dragActive ? 52 : 44, height: dragActive ? 52 : 44 }}
              />
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                {dragActive ? "Drop to upload" : "Drop files here or click to browse"}
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>Supports JSON, CSV, and TXT</p>
              <label className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer text-sm">
                <Upload className="w-3.5 h-3.5" />
                Choose File
                <input type="file" accept=".json,.csv,.txt" onChange={handleFileSelect} className="hidden" />
              </label>
            </>
          )}
        </div>

        {/* Supported Formats — collapsible on mobile, always visible on desktop */}
        <div>
          {/* Toggle visible only on small screens */}
          <button className="ei-toggle sm:hidden" onClick={() => setFormatsOpen(o => !o)} type="button">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
              Supported Formats
            </div>
            {formatsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Always show on sm+, toggle on mobile */}
          <div className={`mt-3 ${formatsOpen ? "block" : "hidden"} sm:block`}>
            <div className="hidden sm:flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
              <h4 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Supported Formats</h4>
            </div>
            <div className="ei-formats">
              {formats.map(f => (
                <div
                  key={f.label}
                  className="p-3 rounded-lg border transition-colors"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {f.icon}
                    <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{f.label}</span>
                  </div>
                  <code className="ei-code">{f.code}</code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--secondary)", borderColor: "var(--primary)" }}>
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs mb-1.5" style={{ color: "var(--foreground)" }}>Pro Tips</p>
              <ul className="text-xs space-y-1" style={{ color: "var(--muted-foreground)" }}>
                <li>• CSV requires headers for proper field mapping</li>
                <li>• Use <code style={{ fontSize: ".68rem" }}>---</code> or <code style={{ fontSize: ".68rem" }}>===</code> to separate prompts in TXT files</li>
                <li>• JSON arrays allow bulk importing multiple prompts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Export utility functions
export const ExportUtils = {
  exportAsJSON(prompts, filename = "prompts") {
    const data = prompts.map(p => ({
      title: p.title, text: p.text, tags: p.tags || [],
      createdAt: p.createdAt ? p.createdAt.toDate().toISOString() : null,
      author: p.createdBy,
    }));
    this.downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, "application/json");
  },
  exportAsCSV(prompts, filename = "prompts") {
    const headers = ["title", "text", "tags", "created_date", "author"];
    const rows = prompts.map(p => [
      this.escapeCSV(p.title || ""),
      this.escapeCSV(p.text || ""),
      this.escapeCSV((p.tags || []).join(", ")),
      p.createdAt ? p.createdAt.toDate().toLocaleDateString() : "",
      p.createdBy || "",
    ]);
    this.downloadFile([headers.join(","), ...rows.map(r => r.join(","))].join("\n"), `${filename}.csv`, "text/csv");
  },
  exportAsTXT(prompts, filename = "prompts") {
    const content = prompts.map(p => {
      let s = p.title || "Untitled Prompt";
      s += "\n" + (p.text || "");
      if (p.tags && p.tags.length > 0) s += "\nTags: " + p.tags.join(", ");
      return s;
    }).join("\n\n---\n\n");
    this.downloadFile(content, `${filename}.txt`, "text/plain");
  },
  escapeCSV(value) {
    if (typeof value !== "string") return '""';
    if (value.includes(",") || value.includes('"') || value.includes("\n"))
      return `"${value.replace(/"/g, '""')}"`;
    return `"${value}"`;
  },
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
  },
};
