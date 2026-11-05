import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/hearsay/',
  test: { exclude: [...configDefaults.exclude, 'archive/**'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  worker: { format: 'es' },
});
