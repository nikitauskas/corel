import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  build: {
    modulePreload: false,
  },
  optimizeDeps: {
    exclude: ["maplibre-gl", "@maplibre/maplibre-gl-leaflet"],
  },
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    {
      name: "remove-module-type-after-build",
      closeBundle() {
        const htmlPath = path.resolve(import.meta.dirname, "dist/index.html");
        if (fs.existsSync(htmlPath)) {
          let html = fs.readFileSync(htmlPath, "utf-8");
          html = html.replace(
            /<script\s+type="module"\s*crossorigin>/gi,
            "<script>",
          );
          html = html.replace(/<script\s+type="module">/gi, "<script>");
          fs.writeFileSync(htmlPath, html, "utf-8");
          console.log(
            "[remove-module-type] Stripped module attributes from dist/index.html",
          );
        }
      },
    },
  ],
});
