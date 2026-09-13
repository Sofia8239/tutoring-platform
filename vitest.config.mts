import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Native replacement for the vite-tsconfig-paths plugin: honours the
    // "@/*" -> "src/*" mapping from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
