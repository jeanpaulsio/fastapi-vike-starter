import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["lib/**", "services/**", "hooks/**", "components/**", "pages/**"],
      exclude: ["pages/+config.ts", "pages/tailwind.css", "lib/types.ts"],
    },
  },
});
