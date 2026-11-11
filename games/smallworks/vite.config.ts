import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  base: '/smallworks/',
  build: {
    rolldownOptions: {
      input: { workshop: 'index.html', file: 'file/index.html' },
    },
  },
  server: { host: '127.0.0.1', port: 5173, fs: { allow: [resolve(import.meta.dirname, '../..')] } },
  test: {
    include: ['tests/**/*.test.ts'],
    // Full HF4 archives are restored and replayed by campaign controls. Keep their
    // assertions intact while allowing the measured multi-day workload to finish.
    testTimeout: 600_000,
    maxWorkers: 2,
  },
});
