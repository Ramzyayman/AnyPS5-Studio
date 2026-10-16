import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/dist/**', '**/dist-electron/**', '**/dist-installer/**', '**/*.tmp/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
