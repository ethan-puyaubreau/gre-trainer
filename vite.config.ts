/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/gre-trainer/ on GitHub Pages.
export default defineConfig({
  base: '/gre-trainer/',
  plugins: [react()],
  build: {
    // The question generators are one chunk on purpose: once loaded, every page works without further requests.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: { katex: ['katex'], react: ['react', 'react-dom'] },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Each content test runs a template on hundreds of seeds; sampling checks can take seconds.
    testTimeout: 120_000,
    // Separate processes: the long content suites starved the threads pool's RPC on CI (onTaskUpdate timeout).
    pool: 'forks',
  },
});
