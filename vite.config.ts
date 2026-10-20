import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    // Seeded campaign and replay controls can exceed the 5s default under shared machine load.
    testTimeout: 30_000,
  },
});
