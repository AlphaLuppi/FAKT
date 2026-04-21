import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/routes/quotes/**",
        "src/routes/invoices/**",
        "src/features/doc-editor/**",
      ],
      exclude: [
        "src/routes/quotes/index.tsx",
        "src/routes/quotes/New.tsx",
        "src/routes/quotes/__test-helpers__/**",
        "src/routes/invoices/index.tsx",
        "src/routes/invoices/New.tsx",
        "src/routes/invoices/__test-helpers__/**",
        "src/features/doc-editor/index.ts",
        "**/*.test.{ts,tsx}",
      ],
      thresholds: {
        lines: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@fakt/shared": new URL(
        "../../packages/shared/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/design-tokens": new URL(
        "../../packages/design-tokens/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/core": new URL(
        "../../packages/core/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/legal": new URL(
        "../../packages/legal/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/config": new URL(
        "../../packages/config/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/ui": new URL(
        "../../packages/ui/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/ai": new URL(
        "../../packages/ai/src/index.ts",
        import.meta.url,
      ).pathname,
      "@fakt/pdf": new URL(
        "../../packages/pdf/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
