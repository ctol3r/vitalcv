import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // Run frozen tests deterministically
    sequence: {
      concurrent: false,
    },

    coverage: {
      provider: "v8",

      // ✅ What actually matters for infra correctness
      // Functions must be 100% (invariants + guards)
      functions: 100,

      // Lines / branches slightly relaxed to avoid brittle guard rails
      lines: 98,
      statements: 98,
      branches: 98,

      // Fail if coverage regresses below intent
      threshold: {
        global: {
          functions: 100,
          lines: 98,
          statements: 98,
          branches: 98,
        },
      },

      // Ignore non-decision scaffolding
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/__tests__/**",
        "**/test/**",
        "**/*.spec.ts",
        "**/*.test.ts",

        // Guard helpers that are defensive, not decision logic
        "src/employmentGuards.ts",
      ],
    },
  },
});