import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    // DB-backed suites each boot a MongoMemoryServer and share a process-global
    // mongoose cache via __tests__/helpers/mongodb.ts. Running files in parallel
    // within a worker lets one file's setup clobber another's (shared `process.env`
    // + `global.mongoose`), producing flaky cross-file failures. Run files
    // serially for deterministic, isolated DB state.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
