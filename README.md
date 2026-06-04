# Parcheggio — Backend

Backend (Node + Fastify + SQLite) per la gestione accessi al parcheggio.
Vedi `CLAUDE.md` per la specifica completa.

## Avvio

```bash
npm install
npm run seed     # importa data/cabine.json in SQLite
npm run dev      # avvia in watch su :3000 (oppure: npm start)
```

## Configurazione (variabili d'ambiente)

I segreti **non stanno nel repo**: si configurano via `.env` (vedi `.env.example` per l'elenco
completo e le note). Variabili principali:

| Variabile | Tipo | Descrizione |
|---|---|---|
| `SUPERUSER_PASSWORD` | segreto | password area `/admin` |
| `AUTH_SECRET` | segreto | firma i token HMAC del super user |
| `ALPR_API_KEY` | segreto | token Plate Recognizer (a consumo) |
| `PORT`, `DB_PATH`, `SEED_PATH` | config | porta, path DB e seed |
| `ALPR_URL`, `ALPR_REGIONS`, `ALPR_CONFIDENCE_MIN`, `ALPR_MOCK` | config | parametri ALPR |
| `AUTH_DEV_BYPASS` | config | `0` in produzione; `1` salta l'auth (solo dev) |

> 🔐 I **valori reali** dei segreti sono nel file locale `CREDENZIALI.local.md` (gitignorato) e
> in un password manager. In produzione vanno impostati come secret dell'hosting (es. `fly secrets set …`),
> mai committati.

## API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET  | `/api/health` | healthcheck |
| GET  | `/api/lookup/:targa` | esito senza scrivere: cabina + `verde`/`rosso`/`gia_dentro`/`sconosciuta` |
| GET  | `/api/suggerisci?q=AA1` | autocomplete targhe (inserimento manuale) |
| POST | `/api/ingresso` `{ "targa": "AA123BB" }` | registra ingresso |
| POST | `/api/uscita` `{ "targa": "AA123BB" }` | registra uscita |
| GET  | `/api/presenti` | targhe attualmente dentro (per UI uscita) |
| GET  | `/api/occupazione` | occupazione di tutte le cabine (es. 25B 1/2) |
| POST | `/api/alpr` (multipart `upload=<jpeg>`) | OCR targa: `{ targa, confidenza, sottoSoglia, lookup }`. La foto NON viene salvata. `503` se `ALPR_API_KEY` mancante. |
| GET  | `/api/log[?giorno=YYYY-MM-DD]` | log (default: oggi). **Da proteggere: solo super user** |

## Note

- L'occupazione si **calcola** dagli eventi del giorno (fuso Europe/Rome): reset a mezzanotte
  automatico, niente cron.
- Le uscite sono opzionali (riuso posto intra-day). Non vanno registrate a fine giornata.
- Auth a ruoli e integrazione ALPR: incrementi successivi.
- **ALPR**: configurabile via `.env` (`ALPR_API_KEY`, `ALPR_URL`, `ALPR_REGIONS`,
  `ALPR_CONFIDENCE_MIN`). Per testare la UI senza spendere: `ALPR_MOCK=1`
  restituisce una targa casuale dall'anagrafica. Sotto la soglia di confidenza
  l'app evidenzia un avviso e spinge sull'inserimento manuale; la foto non
  decide mai da sola.
