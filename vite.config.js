import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ─── WHY VITE 6 (not 7) ───────────────────────────────────────────────────────
// Vite 7 switched its production bundler to Rolldown (Rust).
// Rolldown 0.x has a known live-binding TDZ bug when inlining React's CJS build.
// Vite 6 uses the stable Rollup 4 bundler which handles this correctly —
// but only if React is NOT manually split into its own chunk (see below).
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

  // Force Vite to pre-bundle React during dev so its CJS→ESM conversion
  // happens exactly once, before any module can reference scheduler constants.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    // Modern browsers — Rollup emits clean ESM without legacy CJS wrappers.
    target: 'es2020',
    rollupOptions: {
      // firebase-admin, resend, @vercel/kv are Node/server-only — exclude them.
      // nanoid v5 is pure browser ESM and MUST be bundled, not listed here.
      external: ['firebase-admin', 'resend', '@vercel/kv'],
      output: {
        // ── DO NOT manually chunk React, react-dom, or scheduler ─────────────
        //
        // React's CJS build has internal circular references between react,
        // react-dom, and scheduler.  When Rollup resolves these it builds a
        // dependency graph where the scheduler's `const` bindings are read
        // before they are assigned — a TDZ crash:
        //   "Cannot access '_' / 'N' before initialization"
        //
        // Rollup 4 (Vite 6) resolves this automatically when React stays inside
        // the main entry chunk, because it controls hoisting order within a
        // single file.  Splitting React out into a separate chunk forces
        // cross-chunk ES live-binding references that re-introduce the race.
        //
        // Only split packages that are large, have NO circular deps with
        // React internals, and are genuinely independent (firebase, lucide).
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
