import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        // ClaudeCliProvider depends on Tauri IPC — tested via E2E only.
        "src/providers/claude-cli.ts",
        // provider.ts is a pure type definition file — no executable code.
        "src/provider.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      reporter: ["text", "json", "html"],
    },
    env: {
      FAKT_AI_PROVIDER: "mock",
    },
  },
  resolve: {
    // Alias ?raw imports to empty strings in test env (prompts are not tested for content).
    alias: {
      "?raw": "",
    },
  },
});
