import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // vitest 4 shrank `configDefaults.exclude` to node_modules + .git;
    // vitest 3 also excluded `**/dist/**`. Keep build output out of the test
    // run so compiled CommonJS copies of specs are never collected.
    exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    environment: 'node',
    globals: true,
  },
});
