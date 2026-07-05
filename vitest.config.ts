import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" path so modules using the alias are testable.
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'e2e/**', 'playwright-report/**', 'test-results/**'],
  },
});
