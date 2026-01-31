import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const serverOnlyPath = fileURLToPath(
  new URL('./__tests__/server-only.ts', import.meta.url)
);
const domainCommonRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
      },
    },
  },
  resolve: {
    alias: {
      'server-only': serverOnlyPath,
      '@domain-common': domainCommonRoot,
    },
  },
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      all: true,
      include: ['employmentGuards.ts', 'psvPolicy.ts'],
      exclude: ['**/__tests__/**'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
