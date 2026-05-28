// Logica di dominio: lookup targa, occupazione cabina (derivata dagli eventi del giorno),
// registrazione ingresso/uscita. Tutto filtrato per data Europe/Rome → reset a mezzanotte
// automatico, senza cron e senza dover registrare le uscite a fine giornata.
import { db, transaction } from './db.js';
import { romeDate } from './util.js';

const qCabinaByTarga = db.prepare('SELECT cabina FROM targhe WHERE targa = ?');
const qPosti = db.prepare('SELECT posti FROM cabine WHERE numero = ?');

// Occupati = ingressi(+1) - uscite(-1) per quella cabina nel giorno.
const qOccCabina = db.prepare(`
  SELECT COALESCE(SUM(CASE WHEN tipo='ingresso' THEN 1 ELSE -1 END), 0) AS occ
  FROM eventi WHERE cabina = ? AND giorno = ?`);

// Quante volte una targa è "dentro" (>0 = presente) nel giorno.
const qDentroTarga = db.prepare(`
  SELECT COALESCE(SUM(CASE WHEN tipo='ingresso' THEN 1 ELSE -1 END), 0) AS dentro
  FROM eventi WHERE targa = ? AND giorno = ?`);

// dispositivo = postazione che autorizza (tracciabilità nei log).
const insEvento = db.prepare(`
  INSERT INTO eventi (ts, giorno, targa, cabina, tipo, dispositivo) VALUES (?, ?, ?, ?, ?, ?)`);

const qTutteCabine = db.prepare('SELECT numero, posti FROM cabine ORDER BY numero');

// Targhe attualmente dentro (per la UI uscita: lista cercabile, niente OCR).
const qPresenti = db.prepare(`
  SELECT targa, cabina, SUM(CASE WHEN tipo='ingresso' THEN 1 ELSE -1 END) AS dentro
  FROM eventi WHERE giorno = ?
  GROUP BY targa, cabina HAVING dentro > 0
  ORDER BY cabina, targa`);

// Suggerimenti per autocomplete (inserimento manuale anti-fila).
const qSuggest = db.prepare(
  'SELECT targa, cabina FROM targhe WHERE targa LIKE ? ORDER BY targa LIMIT 10');

// Log del giorno per il super user (include il dispositivo che ha autorizzato).
const qLog = db.prepare(`
  SELECT ts, giorno, targa, cabina, tipo, dispositivo
  FROM eventi WHERE giorno = ? ORDER BY ts DESC`);

// Ricerca elastica su tutti i giorni (retention): targa, cabina, operatore, data.
const qCerca = db.prepare(`
  SELECT ts, giorno, targa, cabina, tipo, dispositivo
  FROM eventi
  WHERE targa LIKE ? OR cabina LIKE ? OR IFNULL(dispositivo, '') LIKE ? OR giorno LIKE ?
  ORDER BY ts DESC LIMIT 1000`);

export function occupazioneCabina(cabina, giorno = romeDate()) {
  const posti = qPosti.get(cabina)?.posti ?? 0;
  const occupati = qOccCabina.get(cabina, giorno).occ;
  return { posti, occupati, disponibili: posti - occupati };
}

export function targaDentro(targa, giorno = romeDate()) {
  return qDentroTarga.get(targa, giorno).dentro > 0;
}

// Esito di una scansione/inserimento: dove sta la cabina e se può entrare.
export function lookup(targa, giorno = romeDate()) {
  const row = qCabinaByTarga.get(targa);
  if (!row) return { targa, stato: 'sconosciuta', cabina: null, decisione: 'sconosciuta' };

  const cabina = row.cabina;
  const occ = occupazioneCabina(cabina, giorno);
  const dentro = targaDentro(targa, giorno);

  let decisione;
  if (dentro) decisione = 'gia_dentro';
  else if (occ.disponibili > 0) decisione = 'verde';
  else decisione = 'rosso';

  return { targa, stato: 'trovata', cabina, ...occ, dentro, decisione };
}

// Check + insert atomici: due operatori che registrano insieme non sforano i posti.
export const registraIngresso = transaction((targa, dispositivo = null) => {
  const giorno = romeDate();
  const info = lookup(targa, giorno);
  if (info.stato === 'sconosciuta') return { ok: false, motivo: 'sconosciuta', ...info };
  if (info.dentro) return { ok: false, motivo: 'gia_dentro', ...info };
  if (info.disponibili <= 0) return { ok: false, motivo: 'pieno', ...info };

  insEvento.run(new Date().toISOString(), giorno, targa, info.cabina, 'ingresso', dispositivo);
  return { ok: true, targa, cabina: info.cabina, ...occupazioneCabina(info.cabina, giorno) };
});

export const registraUscita = transaction((targa, dispositivo = null) => {
  const giorno = romeDate();
  const row = qCabinaByTarga.get(targa);
  if (!row) return { ok: false, motivo: 'sconosciuta' };
  if (!targaDentro(targa, giorno)) return { ok: false, motivo: 'non_dentro' };

  insEvento.run(new Date().toISOString(), giorno, targa, row.cabina, 'uscita', dispositivo);
  return { ok: true, targa, cabina: row.cabina, ...occupazioneCabina(row.cabina, giorno) };
});

export function presenti(giorno = romeDate()) {
  return qPresenti.all(giorno);
}

export function occupazioneTutte(giorno = romeDate()) {
  return qTutteCabine.all().map((c) => {
    const occupati = qOccCabina.get(c.numero, giorno).occ;
    return { cabina: c.numero, posti: c.posti, occupati, disponibili: c.posti - occupati };
  });
}

export function suggerisci(frammento) {
  return qSuggest.all(`%${frammento}%`);
}

export function logGiorno(giorno = romeDate()) {
  return qLog.all(giorno);
}

export function cercaLog(q) {
  const like = `%${q}%`;
  return qCerca.all(like, like, like, like);
}
