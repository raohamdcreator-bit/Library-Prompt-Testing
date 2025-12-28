// src/components/AdvancedSearch.jsx - Professional Search with Icons
import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  User, 
  Lock, 
  Calendar, 
  Tag, 
  Ruler, 
  BarChart2, 
  Lightbulb,
  ChevronDown 
} from "lucide-react";

export default function AdvancedSearch({
  prompts,
  onFilteredResults,
  teamMembers = {},
  isExpanded = false,
  onToggleExpanded,
}) {
  const [filters, setFilters] = useState({
    search: "",
    author: "all",
    tags: "",
    dateRange: "all",
    sortBy: "newest",
    minLength: "",
    maxLength: "",
    visibility: "all",
  });

  const [showAdvanced, setShowAdvanced] = useState(isExpanded);

  const filteredPrompts = useMemo(() => {
    return applyFilters(prompts);
  }, [prompts, filters]);

  useEffect(() => {
    onFilteredResults(filteredPrompts);
  }, [filteredPrompts]);

  function applyFilters(promptsList) {
    let filtered = [...promptsList];

    // Text search
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (prompt) =>
          prompt.title?.toLowerCase().includes(searchTerm) ||
          prompt.text?.toLowerCase().includes(searchTerm) ||
          (Array.isArray(prompt.tags) &&
            prompt.tags.some((tag) => tag.toLowerCase().includes(searchTerm)))
      );
    }

    // Author filter
    if (filters.author !== "all") {
      filtered = filtered.filter(
        (prompt) => prompt.createdBy === filters.author
      );
    }

    // Visibility filter
    if (filters.visibility !== "all") {
      filtered = filtered.filter(
        (prompt) => (prompt.visibility || "public") === filters.visibility
      );
    }

    // Tag filter
    if (filters.tags.trim()) {
      const searchTags = filters.tags
        .toLowerCase()
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      filtered = filtered.filter(
        (prompt) =>
          Array.isArray(prompt.tags) &&
          searchTags.some((searchTag) =>
            prompt.tags.some((tag) => tag.toLowerCase().includes(searchTag))
          )
      );
    }

    // Date range filter
    if (filters.dateRange !== "all") {
      const now = new Date();
      const cutoffDate = new Date();

      switch (filters.dateRange) {
        case "today":
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
      }

      filtered = filtered.filter((prompt) => {
        if (!prompt.createdAt) return false;
        try {
          return prompt.createdAt.toDate() >= cutoffDate;
        } catch {
          return false;
        }
      });
    }

    // Length filters
    if (filters.minLength && !isNaN(filters.minLength)) {
      filtered = filtered.filter(
        (prompt) => (prompt.text?.length || 0) >= parseInt(filters.minLength)
      );
    }

    if (filters.maxLength && !isNaN(filters.maxLength)) {
      filtered = filtered.filter(
        (prompt) => (prompt.text?.length || 0) <= parseInt(filters.maxLength)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "newest":
          return (
            (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
          );
        case "oldest":
          return (
            (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
          );
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "author":
          const authorA =
            teamMembers[a.createdBy]?.name ||
            teamMembers[a.createdBy]?.email ||
            "";
          const authorB =
            teamMembers[b.createdBy]?.name ||
            teamMembers[b.createdBy]?.email ||
            "";
          return authorA.localeCompare(authorB);
        case "length-asc":
          return (a.text?.length || 0) - (b.text?.length || 0);
        case "length-desc":
          return (b.text?.length || 0) - (a.text?.length || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      author: "all",
      tags: "",
      dateRange: "all",
      sortBy: "newest",
      minLength: "",
      maxLength: "",
      visibility: "all",
    });
  }

  function hasActiveFilters() {
    return (
      filters.search !== "" ||
      filters.author !== "all" ||
      filters.tags !== "" ||
      filters.dateRange !== "all" ||
      filters.sortBy !== "newest" ||
      filters.minLength !== "" ||
      filters.maxLength !== "" ||
      filters.visibility !== "all"
    );
  }

  function toggleAdvanced() {
    setShowAdvanced(!showAdvanced);
    if (onToggleExpanded) {
      onToggleExpanded(!showAdvanced);
    }
  }

  const authors = Object.entries(teamMembers).map(([uid, member]) => ({
    uid,
    name: member.name || member.email,
  }));

  const activeFilterCount = Object.values(filters).filter((value, index) => {
    const keys = Object.keys(filters);
    const key = keys[index];
    return (
      key !== "search" && key !== "sortBy" && value !== "" && value !== "all"
    );
  }).length;

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Search & Filter
        </h3>
      </div>

      {/* Basic Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search 
            className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2" 
            style={{ color: "var(--muted-foreground)" }} 
          />
          <input
            type="text"
            placeholder="Search prompts, titles, tags..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="search-input w-full pl-10"
          />
        </div>

        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange("sortBy", e.target.value)}
          className="form-input"
          style={{ minWidth: "180px" }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title">Title A-Z</option>
          <option value="author">Author A-Z</option>
          <option value="length-desc">Longest First</option>
          <option value="length-asc">Shortest First</option>
        </select>

        <button
          onClick={toggleAdvanced}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
            showAdvanced ? "btn-primary" : "btn-secondary"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span
              className="text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center font-bold"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              showAdvanced ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div
          className="border-t pt-6 space-y-6"
          style={{
            borderColor: "var(--border)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Author Filter */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                <User className="w-4 h-4" />
                Author
              </label>
              <select
                value={filters.author}
                onChange={(e) => handleFilterChange("author", e.target.value)}
                className="form-input w-full"
              >
                <option value="all">All Authors</option>
                {authors.map((author) => (
                  <option key={author.uid} value={author.uid}>
                    {author.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility Filter */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                <Lock className="w-4 h-4" />
                Visibility
              </label>
              <select
                value={filters.visibility}
                onChange={(e) =>
                  handleFilterChange("visibility", e.target.value)
                }
                className="form-input w-full"
              >
                <option value="all">All Prompts</option>
                <option value="public">Public Only</option>
                <option value="private">Private Only</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                <Calendar className="w-4 h-4" />
                Created
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) =>
                  handleFilterChange("dateRange", e.target.value)
                }
                className="form-input w-full"
              >
                <option value="all">Any Time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="quarter">Past 3 Months</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                <Tag className="w-4 h-4" />
                Tags
              </label>
              <input
                type="text"
                placeholder="e.g. writing, creative"
                value={filters.tags}
                onChange={(e) => handleFilterChange("tags", e.target.value)}
                className="form-input w-full"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Comma separated
              </p>
            </div>

            {/* Length Range */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                <Ruler className="w-4 h-4" />
                Min Characters
              </label>
              <input
                type="number"
                placeholder="0"
                value={filters.minLength}
                onChange={(e) =>
                  handleFilterChange("minLength", e.target.value)
                }
                className="form-input w-full"
                min="0"
              />
            </div>

            <div>
              <label
                className="flex items-center gap-2 text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                <Ruler className="w-4 h-4" />
                Max Characters
              </label>
              <input
                type="number"
                placeholder="No limit"
                value={filters.maxLength}
                onChange={(e) =>
                  handleFilterChange("maxLength", e.target.value)
                }
                className="form-input w-full"
                min="0"
              />
            </div>

            {/* Results Count */}
            <div className="flex items-center">
              <div
                className="p-4 rounded-lg border w-full flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "var(--secondary)",
                  borderColor: "var(--border)",
                }}
              >
                <BarChart2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                <div>
                  <p
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Results
                  </p>
                  <p
                    className="text-xl font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {filteredPrompts.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters() && (
            <div
              className="flex justify-between items-center pt-4 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {activeFilterCount} active{" "}
                {activeFilterCount === 1 ? "filter" : "filters"}
              </p>
              <button
                onClick={clearFilters}
                className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search Tips */}
      {filters.search === "" && !showAdvanced && (
        <div
          className="mt-4 p-3 rounded-lg border"
          style={{
            backgroundColor: "var(--muted)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 mt-0.5" style={{ color: "var(--primary)" }} />
            <div>
              <p
                className="text-xs font-medium mb-1"
                style={{ color: "var(--foreground)" }}
              >
                Search Tips
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Search by title, content, or tags. Use advanced filters for
                precise results.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
