import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      // Proxy backend auth endpoints (register/login/me/google/clear-session/...),
      // but let Vite serve the SPA for the React routes /auth and /auth/callback.
      "/auth": {
        target: "http://localhost:5000",
        changeOrigin: true,
        bypass(req) {
          const url = req.url || "";
          const path = url.split("?")[0];
          if (path === "/auth" || path === "/auth/callback") {
            return "/index.html";
          }
          return undefined;
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-accordion",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-label",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
          ],
          "vendor-charts": ["recharts"],
          "vendor-maps": ["leaflet", "react-leaflet"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
        },
      },
    },
  },
});
