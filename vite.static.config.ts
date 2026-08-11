import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "static",
  publicDir: "../public",
  envPrefix: ["VITE_"],
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    outDir: "../dist/aws-frontend",
    emptyOutDir: true,
  },
});