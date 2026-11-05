import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rope/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: 'index.html', file: 'file/index.html' } },
  },
  worker: { format: 'es' },
});
