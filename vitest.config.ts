import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/types.ts",
        "src/core/groups/chrome-api.ts",
        "src/core/groups/manager.ts",
        "src/tools/session.ts",
        "src/tools/interaction/index.ts",
        "src/core/bridge.ts",
        "src/core/favicon.ts",
        "src/core/connection.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
