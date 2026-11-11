import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/stairwell/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: 'index.html', file: 'file/index.html' } },
  },
  worker: { format: 'es' },
  test: { include: ['test/**/*.test.ts'], testTimeout: 120_000, maxWorkers: 1 },
});
