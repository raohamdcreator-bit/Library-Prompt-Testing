import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Public directory configuration
  publicDir: 'public',

  // Base URL
  base: '/',

  // Pre-bundle React and Firebase so they are fully evaluated before app code.
  // This prevents the Rollup TDZ crash ("Cannot access 'W'/'G' before initialization")
  // where the React scheduler binding is referenced before its const is assigned.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      external: ['firebase-admin', 'resend', '@vercel/kv', 'nanoid'],
      output: {
        // Separate React and vendor libraries into their own chunks.
        // Without this, Rollup inlines React's scheduler into the same chunk as
        // the app code. If any app module initialises before the scheduler const
        // (W / G / etc.) is assigned, JavaScript throws a TDZ ReferenceError.
        // Keeping React in its own chunk guarantees it is fully evaluated first.
        manualChunks(id) {
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/firebase/')) {
            return 'firebase-vendor';
          }
          if (id.includes('node_modules/@sentry/')) {
            return 'sentry-vendor';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },

  // Development server
  server: {
    port: 3000,
    open: true,
  },

  // Test configuration
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

  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
