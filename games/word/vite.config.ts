import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/word/',
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
  build: { target: 'es2024', rolldownOptions: { input: { main: 'index.html', file: 'file/index.html' } } },
});
