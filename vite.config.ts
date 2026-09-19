/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://mred-randomprojects.github.io/chacarero/ — Vite needs the
// sub-path so asset URLs resolve on GitHub Pages.
export default defineConfig({
  base: "/chacarero/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
