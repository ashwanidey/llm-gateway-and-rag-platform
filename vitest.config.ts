import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@platform/shared": resolve(import.meta.dirname, "packages/shared/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
    restoreMocks: true
  }
});
