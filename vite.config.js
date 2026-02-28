import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ─── WHY VITE 6 (not 7) ───────────────────────────────────────────────────────
// Vite 7 switched its production bundler to Rolldown (Rust).
// Rolldown 0.x has a known live-binding TDZ bug when inlining React's CJS build:
// React's scheduler exports a `const` that Rolldown's CJS→ESM shim converts to a
// `let`.  A circular require inside react-dom causes that `let` to be read before
// it is assigned → "Cannot access '_'/'G'/'W'/'N' before initialization".
// Vite 6 uses the stable Rollup 4 bundler which handles this correctly.
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react()],

  publicDir: 'public',
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Guarantee a single copy of React in the bundle.
    // Duplicate React instances cause dispatcher errors and can trigger TDZ.
    dedupe: ['react', 'react-dom'],
  },

  // Force Vite to pre-bundle React so its CJS→ESM conversion happens once,
  // before any chunk can reference the scheduler's `const` declarations.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    // Target modern browsers so Rollup emits clean ESM without legacy CJS wrappers.
    target: 'es2020',
    rollupOptions: {
      // firebase-admin, resend, @vercel/kv are server-only — correct to exclude.
      // nanoid v5 is ESM-only browser code and MUST be bundled, not external.
      external: ['firebase-admin', 'resend', '@vercel/kv'],
      output: {
        // ── React MUST be in its own chunk and listed first ──────────────────
        // Putting React/react-dom/scheduler here guarantees Rollup emits them
        // as a separate file that other chunks declare as an explicit import,
        // enforcing correct load order and eliminating the scheduler TDZ race
        // ("Cannot access '_' before initialization").
        //
        // firebase-vendor and icons-vendor both reference React — they resolve
        // react-vendor at import time (after it is fully initialized), so no
        // TDZ risk.
        //
        // @sentry/react is intentionally absent — it is loaded via dynamic
        // import() in src/lib/sentry.js, keeping it outside the static graph.
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/firebase/'))     return 'firebase-vendor';
          if (id.includes('node_modules/lucide-react/')) return 'icons-vendor';
        },
      },
    },
  },

  server: {
    port: 3000,
    open: true,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.spec.jsx',
        '**/*.test.jsx',
        '**/main.jsx',
      ],
    },
  },
});
