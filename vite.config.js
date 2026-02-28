import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  publicDir: 'public',
  base: '/',

  // resolve.dedupe ensures only ONE copy of React exists in the bundle.
  // Multiple copies of React in the same page cause dispatcher errors and TDZ crashes.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      external: ['firebase-admin', 'resend', '@vercel/kv', 'nanoid'],
      output: {
        // Split large pure-vendor bundles for better caching.
        // Do NOT put react/react-dom here — letting Rolldown/Vite handle them
        // natively avoids the live-binding TDZ that appears when React is
        // manually split into a separate chunk.
        // @sentry/react is excluded entirely (loaded via dynamic import in sentry.js).
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) return 'firebase-vendor';
          if (id.includes('node_modules/lucide-react/')) return 'icons-vendor';
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
});
