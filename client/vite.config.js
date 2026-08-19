import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pagina = (f) => fileURLToPath(new URL(f, import.meta.url));

export default defineConfig({
  build: {
    // Due pagine di ingresso per la STESSA app React (App.jsx smista sul
    // pathname): index.html = operatore, admin.html = responsabile. Servono
    // separate solo per dare a ciascuna il proprio manifest → due PWA distinte
    // e installabili in parallelo su Android.
    rollupOptions: {
      input: { main: pagina('index.html'), admin: pagina('admin.html') },
    },
  },
  plugins: [
    react(),
    // In sviluppo il dev server manderebbe /admin sul fallback index.html (cioè
    // sulla pagina dell'operatore): stessa app, ma manifest sbagliato. Questo
    // rewrite tiene dev e produzione identici — vedi src/server.js.
    {
      name: 'admin-html-dev',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const u = req.url || '';
          if (u === '/admin' || u.startsWith('/admin?')) req.url = '/admin.html';
          next();
        });
      },
    },
    // Rende l'app installabile ("Aggiungi a Home") senza passare dagli store.
    // registerType 'autoUpdate' = l'aggiornamento arriva da solo al deploy successivo.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      // manifest: false → i due manifest sono file statici in public/
      // (manifest.webmanifest e manager.webmanifest), linkati a mano nelle
      // rispettive pagine. Il plugin ne genererebbe e inietterebbe uno solo,
      // che è esattamente il bug degli shortcut Android.
      manifest: false,
      workbox: {
        // Cache dello shell per apertura rapida/offline; le /api restano sempre online.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // /admin NON deve passare dal fallback di navigazione: il service worker
        // risponderebbe con index.html (cioè con il manifest dell'operatore) e
        // installando dal pannello ti ritroveresti di nuovo l'app operatore.
        // Escluso qui, la navigazione va in rete e il server serve admin.html.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
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
