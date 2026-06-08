// Tema dell'app operatore: 'auto' | 'chiaro' (sole) | 'scuro' (notte).
// 'auto' segue la preferenza chiaro/scuro del sistema del telefono
// (prefers-color-scheme): affidabile ovunque e senza permessi, a differenza
// del sensore di luce ambientale (assente su iOS, con popup su Android).
// L'app admin non importa questo modulo → resta sempre scura.
const KEY = 'tema-operatore';
const MODI = ['auto', 'chiaro', 'scuro'];

export function getModo() {
  const v = localStorage.getItem(KEY);
  // default 'chiaro': lo stabilimento è all'aperto → si parte leggibili al sole.
  return MODI.includes(v) ? v : 'chiaro';
}

export function setModo(m) {
  localStorage.setItem(KEY, m);
}

// Bottone unico che cicla i tre stati.
export function prossimoModo(m) {
  return MODI[(MODI.indexOf(m) + 1) % MODI.length];
}

// Risolve il modo nel tema effettivo da applicare al DOM.
export function temaEffettivo(modo) {
  if (modo === 'chiaro' || modo === 'scuro') return modo;
  const sistemaChiaro = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return sistemaChiaro ? 'chiaro' : 'scuro';
}

// Etichetta breve mostrata sul bottone.
export function etichettaModo(modo) {
  if (modo === 'chiaro') return { icona: '☀️', testo: 'Sole' };
  if (modo === 'scuro') return { icona: '🌙', testo: 'Notte' };
  return { icona: '🌗', testo: 'Auto' };
}
