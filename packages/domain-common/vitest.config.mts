import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // vitest 4 shrank `configDefaults.exclude` to node_modules + .git; vitest 3
    // also excluded `**/dist/**`. Keep build output out of the test run so
    // compiled CommonJS copies of specs are never collected.
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],

    // Run frozen tests deterministically
    sequence: {
      concurrent: false,
    },

    coverage: {
      provider: "v8",

      // Fail the run if coverage regresses below intent.
      //
      // The key is `thresholds`, PLURAL. This block previously declared the
      // numbers twice — as bare `coverage.functions`/`lines`/... and as
      // `coverage.threshold.global` (the *Jest* spelling, `coverageThreshold`)
      // — and vitest reads neither. Both were ignored silently, on v3 and v4
      // alike, so this gate never failed anything from the day it was written.
      // Verify it is live by making it fail on purpose:
      //   npx vitest run --coverage --config vitest.config.ts \
      //     --coverage.thresholds.lines=100
      thresholds: {
        functions: 100,
        lines: 98,
        statements: 98,
        branches: 98,
      },

      // Ignore non-decision scaffolding
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/__tests__/**",
        "**/test/**",
        "**/*.spec.ts",
        "**/*.test.ts",

        // Built output — the compiled twin of every source file under src/.
        // Counting both halves reported the same logic twice, once at 0%.
        "**/dist/**",

        // NOTE: there was an entry here for "src/employmentGuards.ts", called
        // out as defensive rather than decision logic. It never matched — these
        // sources sit at the package root, not under src/ — so the file has
        // always been measured. It is left measured deliberately: it scores
        // 98.33% on its own, so excluding it now would only shrink what the
        // thresholds above actually cover.
      ],
    },
  },
});