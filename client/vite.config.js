import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Rende l'app installabile ("Aggiungi a Home") senza passare dagli store.
    // registerType 'autoUpdate' = l'aggiornamento arriva da solo al deploy successivo.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Parcheggio Stabilimento',
        short_name: 'Parcheggio',
        description: 'Gestione accessi parcheggio stabilimento balneare',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0b1220',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache dello shell per apertura rapida/offline; le /api restano sempre online.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    host: true, // espone sulla LAN: il telefono sulla stessa wifi può aprirla
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
