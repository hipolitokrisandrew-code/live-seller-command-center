// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * GitHub Pages requires a base path of "/<repo-name>/".
 * Replace REPO_NAME below with your actual repository name.
 */
const REPO_NAME = "live-seller-command-center";
const BASE = `/${REPO_NAME}/`;

export default defineConfig({
  // ✅ CRITICAL for GitHub Pages
  base: BASE,

  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Keeps SW updated when you deploy new versions
      registerType: "autoUpdate",

      // PWA assets copied from /public to /dist
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
        // Optional but recommended if you have these:
        // "icons/icon-192x192.png",
        // "icons/icon-512x512.png",
        // "icons/maskable-icon-192x192.png",
      ],

      manifest: {
        name: "Live Seller Command Center",
        short_name: "Live Seller CC",
        description: "Offline POS for Live Sellers in the Philippines",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",

        // ✅ IMPORTANT: must start inside your base on GitHub Pages
        start_url: BASE,
        scope: BASE,

        icons: [
          {
            // ✅ Use leading slash so it resolves correctly under BASE
            src: `${BASE}icons/icon-192x192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${BASE}icons/icon-512x512.png`,
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: `${BASE}icons/maskable-icon-192x192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
