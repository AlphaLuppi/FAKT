import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: [
      { find: "@fakt/db/__tests__/helpers", replacement: resolve(pkg, "../db/src/__tests__/helpers.ts") },
      { find: "@fakt/db/queries", replacement: resolve(pkg, "../db/src/queries/index.ts") },
      { find: "@fakt/db/schema", replacement: resolve(pkg, "../db/src/schema/index.ts") },
      { find: "@fakt/db/adapter", replacement: resolve(pkg, "../db/src/adapter.ts") },
      { find: /^@fakt\/db$/, replacement: resolve(pkg, "../db/src/index.ts") },
      { find: /^@fakt\/shared$/, replacement: resolve(pkg, "../shared/src/index.ts") },
    ],
  },
});
