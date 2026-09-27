import { defineConfig } from "vitest/config";

// Standalone on purpose: the app build goes through @lovable.dev/vite-tanstack-config,
// which must not be touched. Tests only need the "@/" alias, which Vite 8 resolves
// from tsconfig natively.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "db/**/*.test.ts"],
    // The schema tests boot a WASM PostgreSQL instance per case.
    testTimeout: 30_000,
  },
});
