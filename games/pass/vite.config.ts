import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pass/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  worker: { format: 'es' },
});
