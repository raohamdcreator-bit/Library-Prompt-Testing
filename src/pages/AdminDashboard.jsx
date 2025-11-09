// src/pages/AdminDashboard.jsx - Complete Admin Dashboard (Using Centralized Config)
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { isAdminUser } from "../config/admin"; // ✅ Import from centralized config
import { db } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import usePagination, { PaginationControls } from "../hooks/usePagination";

export default function AdminDashboard({ onNavigate }) {
  const { user } = useAuth();
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterEarlyAccess, setFilterEarlyAccess] = useState("all"); // ✅ NEW: Early Access Filter
  const [sortField, setSortField] = useState("timestamp");
  const [sortDirection, setSortDirection] = useState("desc");
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {},
    byRole: {},
    earlyAccessCount: 0, // ✅ NEW: Early Access Count
  });

  // ✅ Check if user is admin using centralized function
  const isAdmin = isAdminUser(user);

  // Redirect if not admin
  useEffect(() => {
    if (user && !isAdmin) {
      onNavigate("/");
    }
  }, [user, isAdmin, onNavigate]);

  // Load waitlist entries
  useEffect(() => {
    if (!user || !isAdmin) return;

    setLoading(true);
    setError(null);

    const waitlistRef = collection(db, "waitlist");
    const q = query(waitlistRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setWaitlistEntries(entries);
        calculateStats(entries);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading waitlist:", err);
        setError("Failed to load waitlist entries");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Calculate statistics
  const calculateStats = (entries) => {
    const byStatus = {};
    const byRole = {};
    let earlyAccessCount = 0;

    entries.forEach((entry) => {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      byRole[entry.role] = (byRole[entry.role] || 0) + 1;
      if (entry.earlyAccess) {
        earlyAccessCount++;
      }
    });

    setStats({
      total: entries.length,
      byStatus,
      byRole,
      earlyAccessCount, // ✅ NEW: Early Access Count
    });
  };

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    let filtered = [...waitlistEntries];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((entry) => entry.status === filterStatus);
    }

    // Apply role filter
    if (filterRole !== "all") {
      filtered = filtered.filter((entry) => entry.role === filterRole);
    }

    // ✅ NEW: Apply early access filter
    if (filterEarlyAccess !== "all") {
      const earlyAccessValue = filterEarlyAccess === "yes";
      filtered = filtered.filter((entry) => entry.earlyAccess === earlyAccessValue);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle timestamps
      if (sortField === "timestamp") {
        aVal = aVal?.toMillis() || 0;
        bVal = bVal?.toMillis() || 0;
      }

      // Handle strings
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [waitlistEntries, filterStatus, filterRole, filterEarlyAccess, sortField, sortDirection]);

  // Pagination
  const pagination = usePagination(filteredAndSortedEntries, 20);

  // Update entry status
  const updateStatus = async (entryId, newStatus) => {
    try {
      await updateDoc(doc(db, "waitlist", entryId), {
        status: newStatus,
      });
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    }
  };

  // Delete entry
  const deleteEntry = async (entryId) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      await deleteDoc(doc(db, "waitlist", entryId));
      setSelectedEntries((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    } catch (err) {
      console.error("Error deleting entry:", err);
      alert("Failed to delete entry");
    }
  };

  // Bulk actions
  const bulkUpdateStatus = async (newStatus) => {
    if (selectedEntries.size === 0) return;

    if (
      !confirm(
        `Update ${selectedEntries.size} entries to "${newStatus}" status?`
      )
    ) {
      return;
    }

    try {
      const promises = Array.from(selectedEntries).map((id) =>
        updateDoc(doc(db, "waitlist", id), { status: newStatus })
      );
      await Promise.all(promises);
      setSelectedEntries(new Set());
    } catch (err) {
      console.error("Error bulk updating:", err);
      alert("Failed to update entries");
    }
  };

  const bulkDelete = async () => {
    if (selectedEntries.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedEntries.size} entries? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const promises = Array.from(selectedEntries).map((id) =>
        deleteDoc(doc(db, "waitlist", id))
      );
      await Promise.all(promises);
      setSelectedEntries(new Set());
    } catch (err) {
      console.error("Error bulk deleting:", err);
      alert("Failed to delete entries");
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Role",
      "Status",
      "Institution",
      "Use Case",
      "Early Access",
      "Timestamp",
    ];
    const csvData = filteredAndSortedEntries.map((entry) => [
      entry.name,
      entry.email,
      entry.role,
      entry.status,
      entry.institution || "",
      entry.useCase || "",
      entry.earlyAccess ? "Yes" : "No",
      entry.timestamp?.toDate()?.toISOString() || "",
    ]);

    const csv = [
      headers.join(","),
      ...csvData.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Toggle selection
  const toggleSelection = (entryId) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === pagination.currentItems.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(pagination.currentItems.map((e) => e.id)));
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return timestamp.toDate().toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="neo-spinner mx-auto mb-4"></div>
          <p style={{ color: "var(--muted-foreground)" }}>
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Access Denied
          </h2>
          <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
            You don't have permission to access the admin dashboard.
          </p>
          <button onClick={() => onNavigate("/")} className="btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Header */}
      <div
        className="border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Admin Dashboard
              </h1>
              <p style={{ color: "var(--muted-foreground)" }}>
                Manage waitlist entries and user requests
              </p>
            </div>
            <button onClick={() => onNavigate("/")} className="btn-secondary">
              ← Back to App
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Total Entries
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--secondary)" }}
              >
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Waitlisted
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {stats.byStatus.waitlisted || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Approved
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {stats.byStatus.approved || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--destructive)" }}
              >
                <span className="text-2xl">❌</span>
              </div>
              <div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Rejected
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {stats.byStatus.rejected || 0}
                </p>
              </div>
            </div>
          </div>

          {/* ✅ NEW: Early Access Stats Card */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgb(168, 85, 247)" }}
              >
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Early Access
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {stats.earlyAccessCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="form-input"
                >
                  <option value="all">All Statuses</option>
                  <option value="waitlisted">Waitlisted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="contacted">Contacted</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Role
                </label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="form-input"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="educator">Educator</option>
                  <option value="team">Team</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="creator">Creator</option>
                </select>
              </div>

              {/* ✅ NEW: Early Access Filter */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Early Access
                </label>
                <select
                  value={filterEarlyAccess}
                  onChange={(e) => setFilterEarlyAccess(e.target.value)}
                  className="form-input"
                >
                  <option value="all">All Users</option>
                  <option value="yes">With Early Access</option>
                  <option value="no">Without Early Access</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Sort By
                </label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className="form-input"
                >
                  <option value="timestamp">Date</option>
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="role">Role</option>
                  <option value="status">Status</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Direction
                </label>
                <button
                  onClick={() =>
                    setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
                  }
                  className="btn-secondary px-4 py-2"
                >
                  {sortDirection === "asc" ? "↑ Ascending" : "↓ Descending"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button onClick={exportToCSV} className="btn-secondary">
                📊 Export CSV
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedEntries.size > 0 && (
            <div
              className="mt-4 pt-4 flex flex-wrap gap-2 items-center"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span
                className="text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {selectedEntries.size} selected:
              </span>
              <button
                onClick={() => bulkUpdateStatus("approved")}
                className="btn-primary px-4 py-2 text-sm"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => bulkUpdateStatus("rejected")}
                className="btn-secondary px-4 py-2 text-sm"
              >
                ❌ Reject
              </button>
              <button
                onClick={() => bulkUpdateStatus("contacted")}
                className="btn-secondary px-4 py-2 text-sm"
              >
                📧 Mark Contacted
              </button>
              <button
                onClick={bulkDelete}
                className="btn-secondary px-4 py-2 text-sm"
                style={{ color: "var(--destructive)" }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>

        {/* Entries Table */}
        <div className="glass-card overflow-hidden">
          {pagination.totalItems === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🔭</div>
              <p
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                No entries found
              </p>
              <p style={{ color: "var(--muted-foreground)" }}>
                {filterStatus !== "all" || filterRole !== "all" || filterEarlyAccess !== "all"
                  ? "Try adjusting your filters"
                  : "Waitlist entries will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="border-b"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--secondary)",
                      }}
                    >
                      <th className="text-left p-4">
                        <input
                          type="checkbox"
                          checked={
                            selectedEntries.size ===
                              pagination.currentItems.length &&
                            pagination.currentItems.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="cursor-pointer"
                        />
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Name
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Email
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Role
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Status
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Early Access
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Date
                      </th>
                      <th
                        className="text-left p-4 font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.currentItems.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        isSelected={selectedEntries.has(entry.id)}
                        onToggleSelect={() => toggleSelection(entry.id)}
                        onUpdateStatus={updateStatus}
                        onDelete={deleteEntry}
                        formatDate={formatDate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                className="p-4 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <PaginationControls
                  pagination={pagination}
                  showSearch={false}
                  showPageSizeSelector={true}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Entry Row Component
function EntryRow({
  entry,
  isSelected,
  onToggleSelect,
  onUpdateStatus,
  onDelete,
  formatDate,
}) {
  const [expanded, setExpanded] = useState(false);

  const getStatusStyle = (status) => {
    const styles = {
      waitlisted: {
        bg: "var(--secondary)",
        color: "var(--secondary-foreground)",
      },
      approved: { bg: "rgb(34, 197, 94)", color: "white" },
      rejected: { bg: "var(--destructive)", color: "white" },
      contacted: { bg: "var(--accent)", color: "var(--accent-foreground)" },
    };
    return styles[status] || styles.waitlisted;
  };

  const getRoleBadge = (role) => {
    const badges = {
      student: "🎓",
      educator: "👨‍🏫",
      team: "👥",
      enterprise: "🏢",
      creator: "🎨",
    };
    return badges[role] || "👤";
  };

  const statusStyle = getStatusStyle(entry.status);

  return (
    <>
      <tr
        className="border-b hover:bg-secondary/50 transition-colors"
        style={{ borderColor: "var(--border)" }}
      >
        <td className="p-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="cursor-pointer"
          />
        </td>
        <td className="p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm hover:opacity-70"
            >
              {expanded ? "▼" : "▶"}
            </button>
            <span style={{ color: "var(--foreground)" }}>{entry.name}</span>
          </div>
        </td>
        <td className="p-4">
          <a
            href={`mailto:${entry.email}`}
            className="text-sm hover:underline"
            style={{ color: "var(--primary)" }}
          >
            {entry.email}
          </a>
        </td>
        <td className="p-4">
          <span className="text-sm">
            {getRoleBadge(entry.role)} {entry.role}
          </span>
        </td>
        <td className="p-4">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            {entry.status}
          </span>
        </td>
        {/* ✅ NEW: Early Access Column */}
        <td className="p-4">
          {entry.earlyAccess ? (
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "rgb(168, 85, 247)",
                color: "white",
              }}
            >
              ⚡ Yes
            </span>
          ) : (
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "var(--secondary)",
                color: "var(--muted-foreground)",
              }}
            >
              No
            </span>
          )}
        </td>
        <td className="p-4">
          <span
            className="text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {formatDate(entry.timestamp)}
          </span>
        </td>
        <td className="p-4">
          <div className="flex gap-2">
            <select
              value={entry.status}
              onChange={(e) => onUpdateStatus(entry.id, e.target.value)}
              className="text-sm px-2 py-1 border rounded"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--background)",
              }}
            >
              <option value="waitlisted">Waitlisted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="contacted">Contacted</option>
            </select>
            <button
              onClick={() => onDelete(entry.id)}
              className="text-sm px-2 py-1 hover:opacity-70"
              style={{ color: "var(--destructive)" }}
              title="Delete entry"
            >
              🗑️
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr
          className="border-b"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--secondary)",
          }}
        >
          <td colSpan="8" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entry.institution && (
                <div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    Institution
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {entry.institution}
                  </p>
                </div>
              )}
              {entry.useCase && (
                <div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    Use Case
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {entry.useCase}
                  </p>
                </div>
              )}
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "var(--foreground)" }}
                >
                  Early Access
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {entry.earlyAccess ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "var(--foreground)" }}
                >
                  Entry ID
                </p>
                <p
                  className="text-sm font-mono"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {entry.id}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
