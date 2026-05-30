import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo-192.png", "logo-512.png"],
      manifest: {
        name: "CrisisRoute",
        short_name: "CrisisRoute",
        description: "AI-powered disaster response coordination",
        theme_color: "#dc2626",
        background_color: "#0f172a",
        display: "standalone",
        icons: [
          { src: "logo-192.png", sizes: "192x192", type: "image/png" },
          { src: "logo-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
