import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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