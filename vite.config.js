import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Public directory configuration
  publicDir: 'public',

  // Base URL
  base: '/',

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      // §2.1 — Prevent server-only packages from being bundled into the
      // client build. firebase-admin, resend, and @vercel/kv are Node.js
      // runtime packages used exclusively in api/*.js (Vercel Functions).
      // Vite/Rollup must never attempt to include them in the browser bundle.
      external: ['firebase-admin', 'resend', '@vercel/kv', 'nanoid'],
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
