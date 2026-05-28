// Helper per data/ora nel fuso Europe/Rome e normalizzazione targhe.

// Data calendario Europe/Rome in formato YYYY-MM-DD.
// È la chiave usata per "il giorno corrente": a mezzanotte cambia da sola → reset automatico.
export function romeDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

// Ora Europe/Rome (HH:MM:SS) per la visualizzazione nei log.
export function romeTime(d = new Date()) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

// Normalizza una targa: maiuscole, senza spazi/trattini/altri simboli.
export function normalizeTarga(s) {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
