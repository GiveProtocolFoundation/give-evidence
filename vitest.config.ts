import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "app/**/*.test.{ts,tsx}"],
    reporters: ["default"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
