// src/hooks/usePagination.jsx
import { useState, useMemo, useCallback, useEffect } from "react";
import { useDebounce } from "./useCache";

export default function usePagination(items, initialItemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search for better performance
  const [debouncedSearch] = useDebounce(searchQuery, 300);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return items;

    const query = debouncedSearch.toLowerCase();
    return items.filter((item) => {
      // Search in common fields
      const searchableFields = [
        item.title,
        item.text,
        item.name,
        item.content,
        ...(item.tags || []),
      ].filter(Boolean);

      return searchableFields.some((field) =>
        String(field).toLowerCase().includes(query)
      );
    });
  }, [items, debouncedSearch]);

  // Calculate pagination data
  const paginationData = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentItems = filteredItems.slice(startIndex, endIndex);

    // Calculate visible page numbers with smart ellipsis
    const getVisiblePages = () => {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      // Always show first page
      rangeWithDots.push(1);

      // Add ellipsis and/or pages around current page
      if (currentPage - delta > 2) {
        rangeWithDots.push("...");
      }

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        rangeWithDots.push(i);
      }

      // Add ellipsis and/or last page
      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push("...");
      }

      // Always show last page if there are multiple pages
      if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }

      // Remove duplicates
      return rangeWithDots.filter(
        (page, index, arr) => index === 0 || page !== arr[index - 1]
      );
    };

    return {
      currentItems,
      currentPage,
      totalPages,
      totalItems,
      originalTotalItems: items.length,
      itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      startIndex: totalItems > 0 ? startIndex + 1 : 0,
      endIndex,
      visiblePages: getVisiblePages(),
      isFirstPage: currentPage === 1,
      isLastPage: currentPage === totalPages || totalPages === 0,
      isFiltered: debouncedSearch.trim().length > 0,
      filterQuery: debouncedSearch,
    };
  }, [filteredItems, currentPage, itemsPerPage, items.length, debouncedSearch]);

  // Reset to first page when items or itemsPerPage change significantly
  useEffect(() => {
    if (
      currentPage > paginationData.totalPages &&
      paginationData.totalPages > 0
    ) {
      setCurrentPage(1);
    }
  }, [paginationData.totalPages, currentPage]);

  // Navigation functions with bounds checking
  const goToPage = useCallback(
    (page) => {
      const targetPage = Math.max(1, Math.min(page, paginationData.totalPages));
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    },
    [currentPage, paginationData.totalPages]
  );

  const nextPage = useCallback(() => {
    if (paginationData.hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [paginationData.hasNextPage]);

  const prevPage = useCallback(() => {
    if (paginationData.hasPrevPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [paginationData.hasPrevPage]);

  const goToFirstPage = useCallback(() => setCurrentPage(1), []);

  const goToLastPage = useCallback(() => {
    if (paginationData.totalPages > 0) {
      setCurrentPage(paginationData.totalPages);
    }
  }, [paginationData.totalPages]);

  // Smart page size change that maintains position
  const changeItemsPerPage = useCallback(
    (newItemsPerPage) => {
      if (newItemsPerPage === itemsPerPage) return;

      // Calculate current item position
      const currentItemIndex = (currentPage - 1) * itemsPerPage;

      // Calculate new page to maintain approximate position
      const newPage = Math.max(
        1,
        Math.floor(currentItemIndex / newItemsPerPage) + 1
      );

      setItemsPerPage(newItemsPerPage);
      setCurrentPage(newPage);
    },
    [currentPage, itemsPerPage]
  );

  // Reset everything
  const reset = useCallback(
    (newItemsPerPage = initialItemsPerPage) => {
      setCurrentPage(1);
      setItemsPerPage(newItemsPerPage);
      setSearchQuery("");
    },
    [initialItemsPerPage]
  );

  // Search functionality
  const setSearch = useCallback((query) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setCurrentPage(1);
  }, []);

  // Quick jump to page containing specific item
  const goToItemPage = useCallback(
    (itemId, idField = "id") => {
      const itemIndex = items.findIndex((item) => item[idField] === itemId);
      if (itemIndex !== -1) {
        const page = Math.ceil((itemIndex + 1) / itemsPerPage);
        goToPage(page);
        return true;
      }
      return false;
    },
    [items, itemsPerPage, goToPage]
  );

  return {
    // Pagination data
    ...paginationData,

    // Navigation functions
    goToPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    goToItemPage,

    // Configuration
    changeItemsPerPage,
    setItemsPerPage: changeItemsPerPage, // Alias for backward compatibility

    // Search functionality
    searchQuery,
    setSearch,
    clearSearch,

    // Utility functions
    reset,

    // Additional data
    isEmpty: paginationData.totalItems === 0,
    isSearching: Boolean(debouncedSearch.trim()),
    hasResults: paginationData.totalItems > 0,
    filteredItems, // Expose filtered items for advanced use cases
  };
}

// Enhanced Pagination Controls Component
export function PaginationControls({
  pagination,
  className = "",
  showPageSizeSelector = true,
  showSearch = true,
  showItemCount = true,
  showQuickJump = false,
  pageSizeOptions = [5, 10, 20, 50, 100],
  onPageSizeChange,
  compact = false,
  position = "bottom", // 'top' | 'bottom' | 'both'
}) {
  const [quickJumpPage, setQuickJumpPage] = useState("");

  if (pagination.totalItems === 0 && !pagination.isFiltered) return null;

  const handleQuickJump = (e) => {
    e.preventDefault();
    const page = parseInt(quickJumpPage);
    if (page && page >= 1 && page <= pagination.totalPages) {
      pagination.goToPage(page);
      setQuickJumpPage("");
    }
  };

  const handlePageSizeChange = (newSize) => {
    pagination.changeItemsPerPage(newSize);
    if (onPageSizeChange) onPageSizeChange(newSize);
  };

  const ControlsContent = () => (
    <div className={`flex flex-col gap-4 ${compact ? "gap-2" : ""}`}>
      {/* Search and Page Size Row */}
      {(showSearch || showPageSizeSelector) && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          {/* Search */}
          {showSearch && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={pagination.searchQuery}
                  onChange={(e) => pagination.setSearch(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute left-2 top-2.5 text-gray-400">🔍</div>
                {pagination.searchQuery && (
                  <button
                    onClick={pagination.clearSearch}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Page Size Selector */}
          {showPageSizeSelector && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Show:</span>
              <select
                value={pagination.itemsPerPage}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-gray-600">per page</span>
            </div>
          )}
        </div>
      )}

      {/* Main Controls Row */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        {/* Items Info */}
        {showItemCount && (
          <div className="text-sm text-gray-600 flex-shrink-0">
            {pagination.totalItems === 0 ? (
              pagination.isFiltered ? (
                "No matching items found"
              ) : (
                "No items"
              )
            ) : (
              <>
                Showing {pagination.startIndex} to {pagination.endIndex} of{" "}
                {pagination.totalItems}
                {pagination.isFiltered && (
                  <span className="text-blue-600">
                    {" "}
                    (filtered from {pagination.originalTotalItems})
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Pagination Navigation */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            {/* Quick Jump */}
            {showQuickJump && !compact && (
              <form
                onSubmit={handleQuickJump}
                className="flex items-center gap-2 mr-4"
              >
                <span className="text-sm text-gray-600">Go to:</span>
                <input
                  type="number"
                  min="1"
                  max={pagination.totalPages}
                  value={quickJumpPage}
                  onChange={(e) => setQuickJumpPage(e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Go
                </button>
              </form>
            )}

            {/* First/Previous Buttons */}
            <button
              onClick={pagination.goToFirstPage}
              disabled={pagination.isFirstPage}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              title="First page"
            >
              ««
            </button>

            <button
              onClick={pagination.prevPage}
              disabled={!pagination.hasPrevPage}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              title="Previous page"
            >
              ‹
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {pagination.visiblePages.map((page, index) =>
                page === "..." ? (
                  <span
                    key={`dots-${index}`}
                    className="px-2 py-1 text-gray-500 text-sm"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => pagination.goToPage(page)}
                    className={`px-3 py-1 border rounded text-sm transition-colors ${
                      page === pagination.currentPage
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            {/* Next/Last Buttons */}
            <button
              onClick={pagination.nextPage}
              disabled={!pagination.hasNextPage}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              title="Next page"
            >
              ›
            </button>

            <button
              onClick={pagination.goToLastPage}
              disabled={pagination.isLastPage}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              title="Last page"
            >
              »»
            </button>
          </div>
        )}
      </div>

      {/* Search Results Summary */}
      {pagination.isFiltered && pagination.totalItems === 0 && (
        <div className="text-center py-4 text-gray-500">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-sm">
            No items found for "<strong>{pagination.filterQuery}</strong>"
          </p>
          <button
            onClick={pagination.clearSearch}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2 transition-colors"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={className}>
      <ControlsContent />
    </div>
  );
}

// Compact pagination for mobile/small spaces
export function CompactPagination({ pagination, className = "" }) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button
        onClick={pagination.prevPage}
        disabled={!pagination.hasPrevPage}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
      >
        ← Previous
      </button>

      <span className="text-sm text-gray-600">
        Page {pagination.currentPage} of {pagination.totalPages}
      </span>

      <button
        onClick={pagination.nextPage}
        disabled={!pagination.hasNextPage}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

// Hook for infinite scroll pagination
export function useInfiniteScroll(items, itemsPerBatch = 20) {
  const [loadedItems, setLoadedItems] = useState([]);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [loading, setLoading] = useState(false);

  // Load initial batch
  useEffect(() => {
    if (items.length > 0) {
      setLoadedItems(items.slice(0, itemsPerBatch));
      setCurrentBatch(1);
    }
  }, [items, itemsPerBatch]);

  const loadMore = useCallback(async () => {
    if (loading) return;

    setLoading(true);

    // Simulate loading delay (remove in production)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const nextBatch = currentBatch + 1;
    const startIndex = currentBatch * itemsPerBatch;
    const endIndex = startIndex + itemsPerBatch;
    const newItems = items.slice(startIndex, endIndex);

    if (newItems.length > 0) {
      setLoadedItems((prev) => [...prev, ...newItems]);
      setCurrentBatch(nextBatch);
    }

    setLoading(false);
  }, [items, currentBatch, itemsPerBatch, loading]);

  const hasMore = loadedItems.length < items.length;

  const reset = useCallback(() => {
    setLoadedItems(items.slice(0, itemsPerBatch));
    setCurrentBatch(1);
  }, [items, itemsPerBatch]);

  return {
    items: loadedItems,
    loading,
    hasMore,
    loadMore,
    reset,
    totalItems: items.length,
    loadedCount: loadedItems.length,
  };
}

// Infinite scroll trigger component
export function InfiniteScrollTrigger({
  onLoadMore,
  loading,
  hasMore,
  className = "",
}) {
  const [ref, entry] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "100px",
  });

  useEffect(() => {
    if (entry?.isIntersecting && hasMore && !loading) {
      onLoadMore();
    }
  }, [entry?.isIntersecting, hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className={`flex justify-center py-4 ${className}`}>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Loading more...</span>
        </div>
      ) : (
        <button
          onClick={onLoadMore}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Load More
        </button>
      )}
    </div>
  );
}

// Custom hook for intersection observer
function useIntersectionObserver(options = {}) {
  const [entry, setEntry] = useState(null);
  const [node, setNode] = useState(null);
  const observer = useRef(null);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    if (node) observer.current.observe(node);

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [node, options.threshold, options.rootMargin]);

  return [setNode, entry];
}
