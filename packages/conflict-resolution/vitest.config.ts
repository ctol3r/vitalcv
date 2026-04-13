import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      functions: 100,
      lines: 95,
      statements: 95,
      branches: 95,
      threshold: {
        global: {
          functions: 100,
          lines: 95,
          statements: 95,
          branches: 95,
        },
      },
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/__tests__/**",
        "**/test/**",
        "**/*.spec.ts",
        "**/*.test.ts",
      ],
    },
  },
});
