import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs so the laptop HTTP server can host the build at any path/host.
  base: "./",
  plugins: [
    react(),
    {
      // Avoid crossorigin attrs — Safari CORS on LAN http://IP is fragile.
      name: "strip-crossorigin",
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, "");
      },
    },
  ],
  server: {
    host: true,
    port: 5174,
    cors: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Target older mobile Safari; avoid bleeding-edge syntax.
    target: ["es2020", "safari14"],
  },
});
