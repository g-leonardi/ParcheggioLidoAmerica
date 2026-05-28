// Connessione SQLite tramite il modulo integrato di Node (node:sqlite, sincrono).
// Niente dipendenze native da compilare. SQLite è file-based e transazionale:
// le scritture concorrenti di più operatori non corrompono i contatori.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'parcheggio.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  -- Anagrafica: una cabina ha N posti contemporanei.
  CREATE TABLE IF NOT EXISTS cabine (
    numero TEXT PRIMARY KEY,
    posti  INTEGER NOT NULL CHECK (posti > 0)
  );

  -- Indice inverso targa -> cabina. Una targa appartiene a UNA sola cabina.
  CREATE TABLE IF NOT EXISTS targhe (
    targa  TEXT PRIMARY KEY,
    cabina TEXT NOT NULL REFERENCES cabine(numero)
  );

  -- Sorgente di verità: log append-only di ingressi/uscite.
  -- L'occupazione NON è memorizzata: si calcola da qui filtrando per "giorno" (Europe/Rome).
  CREATE TABLE IF NOT EXISTS eventi (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ts     TEXT NOT NULL,                                  -- ISO 8601 UTC
    giorno TEXT NOT NULL,                                  -- data Europe/Rome YYYY-MM-DD
    targa  TEXT NOT NULL,
    cabina TEXT NOT NULL,
    tipo   TEXT NOT NULL CHECK (tipo IN ('ingresso','uscita'))
  );

  CREATE INDEX IF NOT EXISTS idx_eventi_giorno        ON eventi(giorno);
  CREATE INDEX IF NOT EXISTS idx_eventi_cabina_giorno ON eventi(cabina, giorno);
  CREATE INDEX IF NOT EXISTS idx_eventi_targa_giorno  ON eventi(targa, giorno);

  -- Dispositivi operatore: il super user approva chi può usare l'app (auth basata su dispositivo).
  CREATE TABLE IF NOT EXISTS devices (
    id          TEXT PRIMARY KEY,            -- ID casuale generato dall'app (~128 bit, segreto)
    nome        TEXT NOT NULL,               -- etichetta postazione (es. "Ingresso 1")
    stato       TEXT NOT NULL DEFAULT 'pending' CHECK (stato IN ('pending','approved','revoked')),
    created_at  TEXT NOT NULL,
    approved_at TEXT
  );

  -- Configurazione runtime modificabile dal super user (es. API key ALPR).
  -- Editabile da /admin senza ridistribuire l'app.
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migrazione: colonna "dispositivo" sugli eventi (tracciabilità: quale postazione ha autorizzato).
const colsEventi = db.prepare('PRAGMA table_info(eventi)').all().map((c) => c.name);
if (!colsEventi.includes('dispositivo')) {
  db.exec('ALTER TABLE eventi ADD COLUMN dispositivo TEXT');
}

// node:sqlite non ha il wrapper db.transaction(fn) di better-sqlite3: lo ricreiamo.
// Restituisce una funzione che esegue fn dentro BEGIN/COMMIT (ROLLBACK su errore).
export function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}
