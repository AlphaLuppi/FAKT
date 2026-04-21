import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/queries/**/*.ts"],
      exclude: ["src/__tests__/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@fakt/shared": new URL("../shared/src/index.ts", import.meta.url).pathname,
      "@fakt/core": new URL("../core/src/index.ts", import.meta.url).pathname,
    },
  },
});
