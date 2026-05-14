import { defineConfig } from "vitest/config";

export default defineConfig({
  // Disable PostCSS for tests. The root `postcss.config.js` references
  // `tailwindcss` and `autoprefixer`, which aren't installed in this
  // package (the spike skeleton doesn't ship them yet). None of our
  // current tests render styles — they exercise data-layer and importer
  // logic against an in-memory SQLite — so we short-circuit the CSS
  // pipeline rather than pulling in unused build deps.
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    include: ["src/**/*.test.ts", "app/**/*.test.{ts,tsx}"],
    reporters: ["default"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
