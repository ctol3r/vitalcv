import path from 'path';

const { configDefaults, defineConfig } = require('vitest/config');

export default defineConfig({
  // Match Next.js's production JSX behavior so components that rely on the
  // automatic runtime (no explicit `import React from 'react'`) render under
  // vitest without a false "React is not defined" error. Next's own build
  // pipeline transforms JSX the same way.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Mirror the tsconfig path alias so vitest can resolve domain-common
      // subpath imports (e.g. '@domain-common/dataConfidence') the same way
      // the web build does. Without this the tests compile fine via tsc but
      // fail at import time because vite's resolver only reads this config.
      '@domain-common': path.resolve(__dirname, '../../packages/domain-common'),
    },
  },
});
