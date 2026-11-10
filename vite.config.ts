import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'Forever Atlas — WoW Forever Companion',
        short_name: 'ForeverAtlas',
        description: 'Real-time World of Warcraft: Forever second-screen companion with voice chat, interactive world map, image forge, and 72-hour player memory.',
        theme_color: '#0d0f14',
        background_color: '#0d0f14',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/src/assets/images/pwa_icon_forever_1794330599465.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any',
          },
          {
            src: '/src/assets/images/pwa_icon_forever_1794330599465.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any',
          },
          {
            src: '/src/assets/images/pwa_icon_forever_1794330599465.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
