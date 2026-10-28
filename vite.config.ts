import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: { workshop: 'index.html', file: 'file/index.html' },
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    // Full HF4 archives are restored and replayed by campaign controls. Keep their
    // assertions intact while allowing the measured multi-day workload to finish.
    testTimeout: 300_000,
    maxWorkers: 2,
  },
});
