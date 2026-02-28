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

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    // Target modern browsers so Rollup emits clean ESM without legacy CJS wrappers.
    target: 'es2020',
    rollupOptions: {
      external: ['firebase-admin', 'resend', '@vercel/kv', 'nanoid'],
      output: {
        // Split large vendor bundles for better long-term caching.
        // React/react-dom are intentionally NOT split here — Rollup 4 (Vite 6)
        // handles React's internal circular deps correctly in a single chunk.
        // @sentry/react is not here because it is loaded via dynamic import.
        manualChunks(id) {
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
