import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
    prerenderEnvironment: "node",
  }),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["node:crypto"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("monaco-editor")) return "vendor-monaco";
            if (id.includes("@assistant-ui")) return "vendor-assistant-ui";
            if (id.includes("node_modules/react")) return "vendor-react";
          },
        },
      },
    },
  },
});
