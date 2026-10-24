import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // These are pure Node/TypeScript unit tests with no CSS; disabling CSS
    // handling stops Vite from loading the project's Tailwind PostCSS config,
    // whose Next-style string plugin form Vite can't parse.
    css: false,
    passWithNoTests: true,
  },
  css: {
    postcss: { plugins: [] },
  },
  resolve: {
    alias: {
      // Mirror tsconfig "paths": "@/*" -> "./src/*"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
