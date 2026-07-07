import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // The first DB-backed suite to run pays mongodb-memory-server's ~120MB
    // mongod download (cold cache each CI build), which blows past vitest's
    // 10s default hook cap. Give beforeAll ample room for that one-time fetch.
    hookTimeout: 180_000,
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
