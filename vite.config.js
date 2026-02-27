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
      external: ['firebase-admin', 'resend', '@vercel/kv', 'nanoid'],
output: {
  manualChunks(id) {
    if (id.includes('node_modules')) {
      if (id.includes('firebase'))  return 'vendor-firebase';
      if (id.includes('@sentry'))   return 'vendor-sentry';
      if (
        id.includes('/react/') ||
        id.includes('/react-dom/') ||
        id.includes('/react-router')
      ) return 'vendor-react';
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
