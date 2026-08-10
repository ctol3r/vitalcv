import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // vitest 4 shrank `configDefaults.exclude` to node_modules + .git; vitest 3
    // also excluded `**/dist/**`. `tsc` emits this package's specs under dist/
    // as CommonJS, and those copies `require("vitest")`, which vitest 4 refuses
    // ("cannot be imported in a CommonJS module using require()"). The tsconfig
    // now keeps tests out of dist/ entirely — this is the second line of defence
    // so a future tsconfig change cannot silently resurrect the duplicate run.
    //
    // Written out in full rather than spread from `configDefaults`: the bug
    // being fixed here *was* an invisible default changing under a major bump,
    // and the repo-root `vitest/` type stub does not export `configDefaults`.
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  },

  resolve: {
    alias: {
      // 🔒 Canonical alias for DomainError and shared domain primitives
      "@vitalcv/domain-common": path.resolve(
        __dirname,
        "../domain-common/src"
      ),
    },
  },
});