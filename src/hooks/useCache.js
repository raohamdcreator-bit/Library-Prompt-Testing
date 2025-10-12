// src/hooks/useCache.js
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Enhanced cache with LRU eviction and better memory management
class Cache {
  constructor(maxSize = 100, defaultTTL = 300000) {
    this.data = new Map();
    this.timers = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    // Clear existing timer and access order
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Evict LRU items if cache is full
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      this._evictLRU();
    }

    // Set data and access time
    this.data.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
    this.accessOrder.set(key, Date.now());

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }
  }

  get(key) {
    const item = this.data.get(key);
    if (!item) return undefined;

    // Update access time and hit count
    item.hits++;
    this.accessOrder.set(key, Date.now());

    return item.value;
  }

  has(key) {
    return this.data.has(key);
  }

  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.data.delete(key);
    this.accessOrder.delete(key);
  }

  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.data.clear();
    this.accessOrder.clear();
  }

  _evictLRU() {
    if (this.accessOrder.size === 0) return;

    // Find least recently used item
    const entries = Array.from(this.accessOrder.entries());
    entries.sort((a, b) => a[1] - b[1]);

    // Remove oldest item
    const keyToEvict = entries[0][0];
    this.delete(keyToEvict);
  }

  size() {
    return this.data.size;
  }

  // Enhanced stats with memory estimation
  getStats() {
    const now = Date.now();
    let totalSize = 0;
    let oldestTimestamp = now;
    let totalHits = 0;

    this.data.forEach(item => {
      // Rough size estimation
      totalSize += JSON.stringify(item.value).length * 2; // *2 for UTF-16
      totalHits += item.hits;
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
      }
    });

    return {
      entries: this.data.size,
      maxSize: this.maxSize,
      totalSizeBytes: totalSize,
      oldestEntryAge: now - oldestTimestamp,
      totalHits,
      hitRate: totalHits > 0 ? totalHits / this.data.size : 0,
      memoryUsage: `${(totalSize / 1024).toFixed(2)} KB`
    };
  }

  // Get cache keys by pattern
  getKeysByPattern(pattern) {
    const regex = new RegExp(pattern);
    return Array.from(this.data.keys()).filter(key => regex.test(key));
  }
}

// Global cache instance with increased limits
const globalCache = new Cache(200, 600000); // 200 items, 10 minutes TTL

// Enhanced cache hook with more options
export function useCache(key, fetcher, options = {}) {
  const {
    ttl = 600000, // 10 minutes default
    enabled = true,
    onError,
    staleWhileRevalidate = false,
    retryOnError = true,
    maxRetries = 3,
    retryDelay = 1000,
    background = false // For background refreshing
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const fetcherRef = useRef(fetcher);
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef(null);
  const backgroundTimerRef = useRef(null);

  // Update fetcher ref when it changes
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Background refresh for long-lived data
  useEffect(() => {
    if (background && ttl > 0 && data) {
      backgroundTimerRef.current = setTimeout(() => {
        fetchData(false, true); // Silent background refresh
      }, ttl * 0.8); // Refresh at 80% of TTL
    }

    return () => {
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
      }
    };
  }, [data, background, ttl]);

  // Enhanced fetch function
  const fetchData = useCallback(async (forceRefresh = false, isBackground = false) => {
    if (!enabled || !key) return;

    // Check cache first (unless forcing refresh)
    if (!forceRefresh && globalCache.has(key)) {
      const cachedData = globalCache.get(key);
      setData(cachedData);
      setError(null);
      setIsStale(false);
      return cachedData;
    }

    // Don't show loading for background refreshes
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const result = await fetcherRef.current(abortControllerRef.current.signal);

      // Cache the result
      globalCache.set(key, result, ttl);
      setData(result);
      setError(null);
      setIsStale(false);
      retryCountRef.current = 0;

      return result;
    } catch (err) {
      if (err.name === 'AbortError') return;

      console.error(`Cache fetch error for key ${key}:`, err);

      // Retry logic
      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(() => {
          fetchData(forceRefresh, isBackground);
        }, retryDelay * retryCountRef.current);
        return;
      }

      setError(err);
      if (onError) onError(err);

      // Return stale data if available and staleWhileRevalidate is enabled
      if (staleWhileRevalidate && globalCache.has(key)) {
        const staleData = globalCache.get(key);
        setData(staleData);
        setIsStale(true);
        return staleData;
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [key, enabled, ttl, staleWhileRevalidate, retryOnError, maxRetries, retryDelay, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
      }
    };
  }, [fetchData]);

  // Manual refresh
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Clear cache for this key
  const invalidate = useCallback(() => {
    globalCache.delete(key);
    setData(null);
    setError(null);
    setIsStale(false);
  }, [key]);

  // Prefetch data into cache
  const prefetch = useCallback(async () => {
    if (!globalCache.has(key)) {
      await fetchData();
    }
  }, [key, fetchData]);

  return {
    data,
    loading,
    error,
    isStale,
    refresh,
    invalidate,
    prefetch,
    cacheHit: globalCache.has(key)
  };
}

// Enhanced debounce hook with immediate execution option
export function useDebounce(value, delay = 500, immediate = false) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef(null);
  const immediateRef = useRef(immediate);

  useEffect(() => {
    // Execute immediately on first call if immediate is true
    if (immediate && !immediateRef.current) {
      setDebouncedValue(value);
      immediateRef.current = true;
      return;
    }

    const handler = () => setDebouncedValue(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(handler, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, immediate]);

  // Flush function to execute immediately
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setDebouncedValue(value);
    }
  }, [value]);

  // Cancel function to prevent execution
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return [debouncedValue, { flush, cancel }];
}

// Enhanced throttle hook with leading/trailing options
export function useThrottle(callback, delay = 1000, options = {}) {
  const { leading = true, trailing = true } = options;
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    const runCallback = () => {
      callbackRef.current(...args);
      lastRun.current = Date.now();
    };

    if (timeSinceLastRun >= delay) {
      if (leading) {
        runCallback();
      }
    } else {
      if (trailing) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          runCallback();
        }, delay - timeSinceLastRun);
      }
    }
  }, [delay, leading, trailing]);
}

// Virtual scrolling hook for performance with large lists
export function useVirtualScroll(items, itemHeight = 60, containerHeight = 400, overscan = 5) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);

  const virtualData = useMemo(() => {
    if (!items.length) return {
      visibleItems: [],
      totalHeight: 0,
      offsetY: 0,
      startIndex: 0,
      endIndex: 0
    };

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan * 2
    );

    const visibleItems = items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      virtualIndex: startIndex + index,
      top: (startIndex + index) * itemHeight
    }));

    return {
      visibleItems,
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight,
      startIndex,
      endIndex
    };
  }, [items, scrollTop, itemHeight, containerHeight, overscan]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    containerRef: setContainerRef,
    ...virtualData,
    handleScroll
  };
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(options = {}) {
  const [entry, setEntry] = useState(null);
  const [node, setNode] = useState(null);
  const observer = useRef(null);

  const defaultOptions = {
    threshold: 0.1,
    rootMargin: '50px',
    ...options
  };

  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, defaultOptions);

    if (node) observer.current.observe(node);

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [node, defaultOptions.threshold, defaultOptions.rootMargin]);

  return [setNode, entry];
}

// Performance monitoring hook
export function usePerformanceMonitor(name, threshold = 16) {
  const startTime = useRef(null);
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    renderCount: 0,
    averageRenderTime: 0,
    slowRenders: 0
  });

  useEffect(() => {
    startTime.current = performance.now();
  });

  useEffect(() => {
    const endTime = performance.now();
    if (startTime.current) {
      const renderTime = endTime - startTime.current;

      setMetrics(prev => {
        const newRenderCount = prev.renderCount + 1;
        const totalTime = (prev.averageRenderTime * prev.renderCount) + renderTime;
        const slowRenders = renderTime > threshold ? prev.slowRenders + 1 : prev.slowRenders;

        return {
          renderTime,
          renderCount: newRenderCount,
          averageRenderTime: totalTime / newRenderCount,
          slowRenders
        };
      });

      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && renderTime > threshold) {
        console.warn(`Slow render in ${name}: ${renderTime.toFixed(2)}ms (threshold: ${threshold}ms)`);
      }
    }
  });

  return metrics;
}

// Memory monitoring hook
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState(null);

  useEffect(() => {
    if (!performance.memory) {
      console.warn('Memory API not available in this browser');
      return;
    }

    const updateMemoryInfo = () => {
      setMemoryInfo({
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        usageMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        usagePercent: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
      });
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

// Enhanced cache management utilities
export const CacheUtils = {
  // Get comprehensive cache stats
  getStats() {
    return globalCache.getStats();
  },

  // Clear all cache
  clearAll() {
    globalCache.clear();
  },

  // Clear cache by pattern
  clearByPattern(pattern) {
    const keys = globalCache.getKeysByPattern(pattern);
    keys.forEach(key => globalCache.delete(key));
    return keys.length;
  },

  // Preload data into cache
  preload(key, data, ttl) {
    globalCache.set(key, data, ttl);
  },

  // Get cache hit ratio
  getHitRatio() {
    const stats = globalCache.getStats();
    return stats.hitRate;
  },

  // Get memory usage
  getMemoryUsage() {
    const stats = globalCache.getStats();
    return {
      size: stats.totalSizeBytes,
      readable: stats.memoryUsage
    };
  },

  // Warm up cache with multiple keys
  async warmUp(keyDataPairs) {
    const promises = keyDataPairs.map(([key, data, ttl]) => {
      globalCache.set(key, data, ttl);
      return Promise.resolve();
    });
    return Promise.all(promises);
  },

  // Export cache for debugging
  exportCache() {
    if (process.env.NODE_ENV !== 'development') return null;

    const exported = {};
    globalCache.data.forEach((value, key) => {
      exported[key] = value;
    });
    return exported;
  }
};