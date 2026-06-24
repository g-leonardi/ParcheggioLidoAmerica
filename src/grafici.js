// Grafici della dashboard super user: persistenza della config + aggregazione
// dei dati dagli eventi (append-only). Niente librerie: solo query + riduzioni.
import { db } from './db.js';
import { categoria } from './occupancy.js';
import { romeDate } from './util.js';

export const TIPI = ['linea', 'barre', 'torta', 'punti'];

// Metriche disponibili (la UI ha lo stesso elenco). 'asse' guida solo l'etichetta x.
export const METRICHE = {
  ingressi_giorno: 'Ingressi per giorno',
  occupazione_giorno: 'Occupazione massima per giorno',
  ingressi_ora: 'Ingressi per fascia oraria',
  ingressi_categoria: 'Ingressi per categoria',
  ingressi_operatore: 'Ingressi per operatore',
};

// --- Persistenza (dashboard) ---------------------------------------------
const qLista = db.prepare('SELECT id, tipo, titolo, config FROM grafici ORDER BY ordine, id');
const insG = db.prepare(
  'INSERT INTO grafici (tipo, titolo, config, ordine, created_at) VALUES (?, ?, ?, ?, ?)');
const delG = db.prepare('DELETE FROM grafici WHERE id = ?');
const updOrdine = db.prepare('UPDATE grafici SET ordine = ? WHERE id = ?');
const qMaxOrdine = db.prepare('SELECT COALESCE(MAX(ordine), 0) AS m FROM grafici');

export function listaGrafici() {
  return qLista.all().map((g) => {
    const config = JSON.parse(g.config);
    return { id: g.id, tipo: g.tipo, titolo: g.titolo, config, dati: datiGrafico(config) };
  });
}

export function creaGrafico({ tipo, titolo, config } = {}) {
  if (!TIPI.includes(tipo)) return { ok: false, motivo: 'tipo_non_valido' };
  if (!config || !METRICHE[config.metrica]) return { ok: false, motivo: 'metrica_non_valida' };
  const clean = { metrica: config.metrica, da: config.da || null, a: config.a || null };
  const nome = String(titolo || '').trim().slice(0, 80) || METRICHE[config.metrica];
  const ordine = qMaxOrdine.get().m + 1;
  const info = insG.run(tipo, nome, JSON.stringify(clean), ordine, new Date().toISOString());
  return { ok: true, id: Number(info.lastInsertRowid) };
}

export function eliminaGrafico(id) {
  return delG.run(id).changes ? { ok: true } : { ok: false, motivo: 'non_trovato' };
}

export function riordina(ids) {
  if (!Array.isArray(ids)) return { ok: false, motivo: 'ids_mancanti' };
  ids.forEach((id, i) => updOrdine.run(i, Number(id)));
  return { ok: true };
}

// --- Aggregazione dati ----------------------------------------------------
const qIngGiorno = db.prepare(`
  SELECT giorno, COUNT(*) AS n FROM eventi
  WHERE tipo = 'ingresso' AND giorno BETWEEN ? AND ? GROUP BY giorno`);
const qIngEventi = db.prepare(`
  SELECT ts, cabina, dispositivo FROM eventi
  WHERE tipo = 'ingresso' AND giorno BETWEEN ? AND ?`);
const qTuttiEventi = db.prepare(`
  SELECT giorno, ts, tipo FROM eventi
  WHERE giorno BETWEEN ? AND ? ORDER BY giorno, ts`);

const CAT_LABEL = {
  bianche: 'Bianco', gialle: 'Giallo', postazioni: 'Postazioni', spogliatoi: 'Spogliatoi', vip: 'VIP',
};

const fmtOra = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false });
const oraDi = (ts) => parseInt(fmtOra.format(new Date(ts)), 10) % 24;

function addDay(giorno) {
  const dt = new Date(`${giorno}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}
function giorniRange(da, a) {
  const out = [];
  let d = da;
  for (let i = 0; i < 400 && d <= a; i++) { out.push(d); d = addDay(d); }
  return out;
}

// Restituisce { punti: [{ x, y }] } per la metrica/intervallo richiesti.
export function datiGrafico(config = {}) {
  const a = config.a || romeDate();
  const da = config.da || a;
  switch (config.metrica) {
    case 'ingressi_giorno': {
      const m = new Map(qIngGiorno.all(da, a).map((r) => [r.giorno, r.n]));
      return { punti: giorniRange(da, a).map((g) => ({ x: g, y: m.get(g) || 0 })) };
    }
    case 'occupazione_giorno': {
      // Picco di presenze del giorno = max del saldo (ingresso +1, uscita −1) nel tempo.
      const peak = new Map();
      let cur = null, bal = 0;
      for (const e of qTuttiEventi.all(da, a)) {
        if (e.giorno !== cur) { cur = e.giorno; bal = 0; }
        bal += e.tipo === 'ingresso' ? 1 : -1;
        if (bal > (peak.get(cur) || 0)) peak.set(cur, bal);
      }
      return { punti: giorniRange(da, a).map((g) => ({ x: g, y: peak.get(g) || 0 })) };
    }
    case 'ingressi_ora': {
      const ore = Array(24).fill(0);
      for (const e of qIngEventi.all(da, a)) ore[oraDi(e.ts)]++;
      return { punti: ore.map((y, h) => ({ x: `${String(h).padStart(2, '0')}`, y })) };
    }
    case 'ingressi_categoria': {
      const m = {};
      for (const e of qIngEventi.all(da, a)) {
        const k = CAT_LABEL[categoria(e.cabina)] || categoria(e.cabina);
        m[k] = (m[k] || 0) + 1;
      }
      return { punti: Object.entries(m).map(([x, y]) => ({ x, y })) };
    }
    case 'ingressi_operatore': {
      const m = {};
      for (const e of qIngEventi.all(da, a)) {
        const k = e.dispositivo || '—';
        m[k] = (m[k] || 0) + 1;
      }
      return { punti: Object.entries(m).map(([x, y]) => ({ x, y })).sort((p, q) => q.y - p.y) };
    }
    default:
      return { punti: [] };
  }
}
