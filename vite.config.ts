/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/gre-trainer/ on GitHub Pages.
export default defineConfig({
  base: '/gre-trainer/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { katex: ['katex'], react: ['react', 'react-dom'] },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
