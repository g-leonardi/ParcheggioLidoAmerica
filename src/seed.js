// Importa l'anagrafica da data/cabine.json in SQLite.
// Idempotente: rigenera la tabella targhe (riflette esattamente il seed) e fa upsert cabine.
import fs from 'node:fs';
import path from 'node:path';
import { db, transaction } from './db.js';
import { normalizeTarga } from './util.js';

const seedPath = process.env.SEED_PATH || path.join(process.cwd(), 'data', 'cabine.json');
const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const upCabina = db.prepare(`
  INSERT INTO cabine (numero, posti) VALUES (?, ?)
  ON CONFLICT(numero) DO UPDATE SET posti = excluded.posti`);
const clearTarghe = db.prepare('DELETE FROM targhe');
const insTarga = db.prepare('INSERT INTO targhe (targa, cabina) VALUES (?, ?)');

const run = transaction(() => {
  clearTarghe.run();
  let nTarghe = 0;
  for (const [numero, info] of Object.entries(data)) {
    upCabina.run(numero, info.posti);
    for (const t of info.targhe ?? []) {
      insTarga.run(normalizeTarga(t), numero);
      nTarghe++;
    }
  }
  return nTarghe;
});

const nTarghe = run();
console.log(`Seed completato: ${Object.keys(data).length} cabine, ${nTarghe} targhe.`);
