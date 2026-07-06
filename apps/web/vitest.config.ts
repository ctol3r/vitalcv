import path from 'path';

const { configDefaults, defineConfig } = require('vitest/config');

// NOTE: the former STALE_TEST_FILES quarantine list was cleared 2026-07-05.
// The three suites that still passed (employer-request-context,
// employer-workspace-bootstrap, pricing-model) were un-excluded to restore
// their coverage; the six that targeted pages removed from main
// (billing-page, live-path-regression, passport-page, pilot-ops-page,
// public-docs-route-contract, postrelease-truth-cleanup) were deleted.
// Vitest resolves workspace deps via their dist/ output, so CI builds
// `--filter='!@vitalcv/web'` before running tests (see .github/workflows/ci.yml).

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    exclude: [...configDefaults.exclude, 'tests/**'],
  },
  // Match Next's automatic JSX runtime so components without a `React` import
  // (the app's prevailing style) also render under jsdom tests.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
