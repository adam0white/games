import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'test/episode/**/*.test.ts',
      'test/death.test.ts',
      'test/hf-person.test.ts',
      'test/hf-hunch.test.ts',
      'test/hf-lifecycle.test.ts',
      'test/voices.test.ts',
      'test/pacing.test.ts',
    ],
    maxWorkers: 1,
    testTimeout: 120000,
  },
});
