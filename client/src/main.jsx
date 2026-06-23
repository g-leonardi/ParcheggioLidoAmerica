import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './styles.css';

// Service worker in modalità autoUpdate (vedi vite.config.js): appena un deploy
// pubblica una nuova build, il SW la installa, la attiva e RICARICA la pagina da
// solo. Così l'utente vede subito le modifiche senza svuotare la cache a mano.
// `r.update()` ogni ora copre le PWA lasciate aperte per giorni (es. in cassa).
const UNORA = 60 * 60 * 1000;
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (r) setInterval(() => r.update(), UNORA);
  },
});

createRoot(document.getElementById('root')).render(<App />);
