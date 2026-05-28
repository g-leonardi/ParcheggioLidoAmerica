// Riconoscimento targa via Plate Recognizer Snapshot Cloud.
// La foto NON viene mai salvata su disco: arriva come Buffer in memoria, viene
// inoltrata al provider, scartata. Risposta = solo la stringa targa + confidenza.
//
// Configurazione runtime (key/url/regions) in tabella `settings`, modificabile
// dal super user senza redeploy. Fallback iniziale: variabili d'ambiente.
// `ALPR_MOCK=1` → niente cloud, restituisce una targa a caso dall'anagrafica
// (utile per testare la UI senza spendere).
import { db } from './db.js';
import { normalizeTarga } from './util.js';

const MOCK = process.env.ALPR_MOCK === '1';
export const CONFIDENCE_MIN = Number(process.env.ALPR_CONFIDENCE_MIN || '0.65');

const qTargaRandom = db.prepare('SELECT targa FROM targhe ORDER BY RANDOM() LIMIT 1');
const qSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const upSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`);

function setting(key, envFallback) {
  const r = qSetting.get(key);
  const v = r?.value;
  if (v != null && v !== '') return { value: v, source: 'db' };
  if (envFallback) return { value: envFallback, source: 'env' };
  return { value: '', source: 'none' };
}

function apiKey() { return setting('alpr_api_key', process.env.ALPR_API_KEY); }
function apiUrl() { return setting('alpr_url', process.env.ALPR_URL || 'https://api.platerecognizer.com/v1/plate-reader/'); }
function apiRegions() { return setting('alpr_regions', process.env.ALPR_REGIONS || 'it'); }

export function setApiKey(value) {
  upSetting.run('alpr_api_key', value || '');
}

export function configurato() {
  return MOCK || !!apiKey().value;
}

// Stato pubblico per la UI admin: mai esporre la key, solo lunghezza + sorgente.
export function stato() {
  const k = apiKey();
  return {
    mock: MOCK,
    sorgente: k.source,     // 'db' | 'env' | 'none'
    lunghezzaKey: k.value.length,
    url: apiUrl().value,
    regioni: apiRegions().value,
    sogliaConfidenza: CONFIDENCE_MIN,
  };
}

export async function riconosci(buffer, mime = 'image/jpeg') {
  if (MOCK) {
    const r = qTargaRandom.get();
    return { ok: true, targa: r?.targa || null, confidenza: 0.92, mock: true };
  }
  const key = apiKey().value;
  if (!key) return { ok: false, motivo: 'alpr_non_configurato' };

  const form = new FormData();
  form.append('upload', new Blob([buffer], { type: mime }), 'plate.jpg');
  form.append('regions', apiRegions().value);

  let res;
  try {
    res = await fetch(apiUrl().value, {
      method: 'POST',
      headers: { Authorization: `Token ${key}` },
      body: form,
    });
  } catch (err) {
    return { ok: false, motivo: 'alpr_rete', dettaglio: String(err?.message || err) };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, motivo: 'alpr_errore', status: res.status, dettaglio: txt.slice(0, 300) };
  }

  const data = await res.json().catch(() => null);
  const first = data?.results?.[0];
  if (!first?.plate) return { ok: false, motivo: 'nessuna_targa' };

  return {
    ok: true,
    targa: normalizeTarga(first.plate),
    confidenza: Number(first.score) || 0,
  };
}
