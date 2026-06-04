// Gestione anagrafica (CRUD cabine + targhe) per il super user.
// Una targa appartiene a UNA sola cabina (targa = PRIMARY KEY): se si prova ad
// assegnarla a una cabina diversa, l'operazione viene rifiutata segnalando dove si trova.
import { db, transaction } from './db.js';
import { normalizeTarga } from './util.js';

const qCabine = db.prepare('SELECT numero, posti FROM cabine');
const qTutteTarghe = db.prepare('SELECT targa, cabina FROM targhe');
const qCabina = db.prepare('SELECT numero, posti FROM cabine WHERE numero = ?');
const insCabina = db.prepare('INSERT INTO cabine (numero, posti) VALUES (?, ?)');
const updPosti = db.prepare('UPDATE cabine SET posti = ? WHERE numero = ?');
const delCabina = db.prepare('DELETE FROM cabine WHERE numero = ?');
const qTarga = db.prepare('SELECT targa, cabina FROM targhe WHERE targa = ?');
const insTarga = db.prepare('INSERT INTO targhe (targa, cabina) VALUES (?, ?)');
const delTarga = db.prepare('DELETE FROM targhe WHERE targa = ?');
const delTargheCabina = db.prepare('DELETE FROM targhe WHERE cabina = ?');

// Ordina "G4" prima di "G10" (settore poi numero), non in ordine ASCII.
function chiaveNat(n) {
  const settore = n.replace(/\d.*$/, '');
  const num = parseInt(n.replace(/^\D+/, ''), 10);
  return [settore, Number.isNaN(num) ? Infinity : num, n];
}

export function lista() {
  const byCab = new Map();
  for (const c of qCabine.all()) byCab.set(c.numero, { numero: c.numero, posti: c.posti, targhe: [] });
  for (const t of qTutteTarghe.all()) byCab.get(t.cabina)?.targhe.push(t.targa);
  const arr = [...byCab.values()];
  for (const c of arr) c.targhe.sort();
  arr.sort((a, b) => {
    const ka = chiaveNat(a.numero), kb = chiaveNat(b.numero);
    return ka[0] !== kb[0] ? ka[0].localeCompare(kb[0]) : ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });
  return arr;
}

export function creaCabina(numeroRaw, posti) {
  const numero = String(numeroRaw ?? '').trim().toUpperCase();
  if (!numero) return { ok: false, motivo: 'numero_mancante' };
  const p = Number(posti);
  if (!Number.isInteger(p) || p < 1) return { ok: false, motivo: 'posti_non_validi' };
  if (qCabina.get(numero)) return { ok: false, motivo: 'gia_esistente' };
  insCabina.run(numero, p);
  return { ok: true, cabina: { numero, posti: p, targhe: [] } };
}

export function aggiornaPosti(numero, posti) {
  const p = Number(posti);
  if (!Number.isInteger(p) || p < 1) return { ok: false, motivo: 'posti_non_validi' };
  if (!qCabina.get(numero)) return { ok: false, motivo: 'non_trovata' };
  updPosti.run(p, numero);
  return { ok: true, numero, posti: p };
}

// Elimina cabina + le sue targhe (la FK targhe->cabine impone di togliere prima le targhe).
// Gli eventi storici non vengono toccati (referenziano la cabina per testo, non via FK).
export const eliminaCabina = transaction((numero) => {
  if (!qCabina.get(numero)) return { ok: false, motivo: 'non_trovata' };
  delTargheCabina.run(numero);
  delCabina.run(numero);
  return { ok: true, numero };
});

export function aggiungiTarga(cabina, targaRaw) {
  if (!qCabina.get(cabina)) return { ok: false, motivo: 'cabina_non_trovata' };
  const targa = normalizeTarga(targaRaw);
  if (targa.length < 4) return { ok: false, motivo: 'targa_non_valida' };
  const esiste = qTarga.get(targa);
  if (esiste) {
    if (esiste.cabina === cabina) return { ok: false, motivo: 'gia_presente' };
    return { ok: false, motivo: 'targa_in_altra_cabina', cabina: esiste.cabina };
  }
  insTarga.run(targa, cabina);
  return { ok: true, targa, cabina };
}

export function rimuoviTarga(targaRaw) {
  const targa = normalizeTarga(targaRaw);
  const r = delTarga.run(targa);
  if (r.changes === 0) return { ok: false, motivo: 'non_trovata' };
  return { ok: true, targa };
}
