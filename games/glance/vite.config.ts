import { defineConfig } from 'vite';

export default defineConfig({
  base: '/glance/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rolldownOptions: { input: { main: 'index.html', file: 'file/index.html' } },
  },
  worker: { format: 'es' },
});
