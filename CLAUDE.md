# Parcheggio Stabilimento Balneare

Web app per gestire l'accesso al parcheggio di uno stabilimento balneare. Un operatore
inquadra/inserisce la targa di un'auto; l'app verifica se la cabina associata a quella
targa ha ancora posti disponibili **per la giornata corrente** e mostra **semaforo verde
(entra)** o **rosso (pieno)**. Pensata per uso **mobile, sotto il sole**: UI minimale, ad
alto contrasto, pochissimi tap.

## Requisiti funzionali

- **Login operatore**: l'operatore si autentica prima di usare l'app.
- **Riconoscimento targa**: l'operatore scatta una foto col cellulare → l'app riconosce la
  targa (ALPR/OCR) e la cerca nell'anagrafica.
- **Inserimento manuale** (first-class, non un ripiego): se la foto non riconosce la targa,
  l'operatore la inserisce a mano e ritrova la cabina. UX **anti-fila**: campo con
  **autocomplete/suggerimenti** mentre digita (filtra le targhe dell'anagrafica già dalle
  prime lettere/cifre), tap sul suggerimento → cabina trovata in un colpo. Nessun form lungo,
  bottoni grandi, pochi tap. Stesso pattern di ricerca usato per la lista uscite.
- **Decisione di accesso**:
  - Targa trovata + posti disponibili per la cabina oggi → **verde**, registra ingresso,
    decrementa i posti disponibili.
  - Targa trovata ma cabina già al completo per oggi → **rosso**, accesso negato.
  - Targa non trovata → stato dedicato (non in anagrafica).
- **Uscita** (ri-scan = toggle): un'auto già dentro che si ripresenta viene registrata come
  uscita e il posto torna disponibile (ingressi − uscite per oggi). **In uscita NON si usa
  l'OCR**: si mostra la lista cercabile delle targhe attualmente dentro e l'operatore tocca
  quella giusta → azzera il costo ALPR in uscita (dimezza il volume di letture/mese).
- **Reset giornaliero a mezzanotte** (fuso **Europe/Rome**): all'inizio del nuovo giorno
  tutti i posti tornano disponibili. **Automatico per costruzione** (vedi sotto): non serve
  che gli operatori registrino le uscite a fine giornata, né un cron load-bearing.
- **Log / vista super user**: un super user vede i log storici (default: **giorno
  corrente**). Ogni riga: **data, ora, targa, ingresso/uscita, cabina**.
- **Le foto NON vengono salvate**: elaborate in memoria e scartate subito dopo l'OCR.

## Modello dati

### Anagrafica (seed, sola lettura) — `cabine`
Chiave univoca = numero cabina. Per ogni cabina: posti contemporanei e targhe ammesse.
```json
{
  "25B": { "posti": 2, "targhe": ["AA123BB", "CC456DD", "EF789GH"] }
}
```
Nota: una cabina con `posti: 2` e 3 targhe ammette **2 qualsiasi** delle 3 contemporaneamente.
**Una targa appartiene a UNA sola cabina** (targa univoca) → si costruisce un indice inverso
`targa → cabina` per il lookup diretto.

### Stato/occupazione — derivato dagli eventi, NON sorgente di verità
L'occupazione corrente di una cabina = (ingressi di oggi − uscite di oggi) per quella
cabina, filtrando per data **Europe/Rome**. Vista esempio: `cabina 25B → 1/2 occupati`.

### Eventi (log) — sorgente di verità
Append-only: `{ timestamp, targa, cabina, tipo: "ingresso"|"uscita" }`.

## Decisioni architetturali

> Vedi anche le note di analisi qui sotto. Sintesi delle scelte consigliate:

- **L'occupazione si CALCOLA dagli eventi filtrati per data Europe/Rome**, non si "resetta"
  con un cron a mezzanotte. Formula: `occupazione cabina = (ingressi di OGGI) − (uscite di
  oggi)`. A mezzanotte cambia "oggi" → gli ingressi di ieri smettono di contare → reset
  automatico, **senza cron e senza che nessuno registri uscite a fine giornata**. Più
  robusto del cron (immune al downtime del server) e senza race condition (solo `INSERT` +
  `COUNT`, niente decremento concorrente).
- **Le uscite sono OPZIONALI e on-demand**: servono SOLO per riusare un posto nello stesso
  giorno quando c'è contesa (cabina piena + nuova auto della stessa cabina che chiede di
  entrare). In quel momento l'operatore segna l'uscita di chi è già andato via. NON si
  registrano uscite di massa a fine giornata → throughput in uscita invariato.
- **Un cron serve SOLO per la pulizia GDPR** (cancellare i log più vecchi della retention),
  non per il reset. Lì il cron va bene perché non è critico per la correttezza.
- **Persistenza con SQLite** (es. `better-sqlite3`), non file JSON scritti a mano: le
  scritture su JSON da più operatori in contemporanea causano race condition e corruzione
  del contatore. SQLite è file-based, gratis e transazionale. L'anagrafica può restare un
  JSON di seed caricato in SQLite all'avvio.
  **Implementazione**: si usa il modulo integrato **`node:sqlite`** (Node ≥22.5, qui Node 26),
  sincrono e senza dipendenze native da compilare. (`better-sqlite3` non compila su Node 26.)
  `node:sqlite` non ha il wrapper `db.transaction(fn)`: ricreato in `src/db.js`.
- **Backend e frontend in un unico servizio Node** (Fastify/Express) che serve anche la
  build statica React → un solo processo, hosting più economico.
- **Frontend React (Vite) come PWA**, mobile-first.
- **Fotocamera via** `<input type="file" accept="image/*" capture="environment">`: apre la
  fotocamera del telefono senza gestire stream complessi. Richiede HTTPS.
- **La foto NON decide, velocizza il caso comune**: flusso = scatta → OCR propone targa +
  confidenza → **l'operatore conferma o corregge** → semaforo. Una lettura sbagliata è
  innocua perché l'operatore la vede prima del verde. Sotto una **soglia di confidenza**
  l'app spinge sull'inserimento manuale. Da comunicare al cliente: la foto non fa tutto da
  sola (nessun ALPR è affidabile al 100% al sole), ma riduce i tap nel caso normale.
- **UX di cattura**: riquadro guida a schermo ("inquadra la targa qui dentro, avvicinati"),
  evitare il controluce → riduce gli errori più di qualsiasi modello.

## Stack consigliato

- **Frontend**: React + Vite, PWA, UI a semaforo a tutto schermo (verde/rosso), bottoni
  grandi, alto contrasto per leggibilità al sole.
- **Distribuzione = PWA, NIENTE app store**: installabile con "Aggiungi a Home" (icona,
  apertura a tutto schermo). Implementato con **`vite-plugin-pwa`** (`registerType:
  autoUpdate` → aggiornamento automatico al deploy), icone in `client/public/` (generate da
  `client/icon-src.svg`), service worker per shell offline. Android mostra il prompt
  "Installa" con HTTPS+SW+manifest; iOS richiede Condividi → Aggiungi a Home (nessun prompt).
  **HTTPS obbligatorio in produzione** per install Android e per la fotocamera (fase ALPR).
- **Backend**: Node + Fastify, serve API + build statica.
- **DB**: SQLite (`better-sqlite3`).
- **ALPR**: **Plate Recognizer Snapshot Cloud (pay-per-use)** — ALPR dedicato, affidabile su
  targhe IT, regione **EU** + **DPA**, **foto non salvata** (restituisce solo la stringa
  targa). Scelto perché pay-per-use = **€0 fuori stagione** automaticamente (vedi
  Stagionalità). Sempre con **fallback manuale obbligatorio**. OCR **solo in ingresso**, mai
  in uscita. L'OCR generico (Tesseract.js/Vision) è meno affidabile su sole/angoli/sporco.
- **Auth**: session cookie o JWT, password hashate con **argon2/bcrypt**, ruoli
  (operatore / super user). Niente crypto fatta a mano.
- **Hosting**: VPS singolo (Hetzner ~€10–15/mese) acceso solo in stagione, che serve API +
  build statica + SQLite. **HTTPS con Caddy** (Let's Encrypt automatico, config minima).

## Stagionalità & costi (stabilimento aperto ~4 mesi/anno)

Vincolo: infrastruttura **accendibile/spegnibile** a stagione, costi ~0 fuori stagione.

**Decisioni**:
- **ALPR pay-per-use cloud** (Plate Recognizer Snapshot Cloud): paghi solo le letture fatte
  → fuori stagione **€0 automatici**, senza disdire licenze né mantenere container.
- **VPS + snapshot**: server acceso solo nei 4 mesi; a fine stagione **snapshot + distruggi**
  → in off-season paghi solo lo snapshot (pochi centesimi/mese su Hetzner); a stagione nuova
  ripristini lo snapshot in pochi minuti. SQLite ci gira nativo.
- **OCR solo in ingresso** (uscita via lista) → dimezza il volume di letture.

**Costi stimati** (volume ~500 auto/giorno ≈ ~15.000 letture/mese; prezzi indicativi cutoff
gen 2026, **da verificare**):

| Voce | In stagione | Fuori stagione |
|---|---|---|
| ALPR Plate Recognizer Cloud | ~$50/mese → **~$200/stagione** | **$0** |
| VPS Hetzner | ~€10–15/mese → **~€50/stagione** | snapshot ~centesimi |
| Frontend statico + HTTPS (Caddy sul VPS) | ~€0 | ~€0 |
| **Totale** | **~€250/anno** concentrato nei 4 mesi | **~€0** |

Il free tier ALPR (2.500/mese) è fuori scala per questo volume → escluso.

## Sicurezza & privacy (priorità alta)

- **GDPR**: targa + presenza = **dato personale** (deployment in Italia/UE). Minimizzare i
  dati, informativa privacy, accesso controllato.
- **Retention log: 3 mesi** (90 giorni). Cancellazione automatica via cron di housekeeping.
- **ALPR cloud = data processor esterno**: firmare il **DPA**, scegliere la **regione EU**,
  verificare che il provider **non conservi la foto**. La foto è inviata solo per l'OCR e
  scartata; si memorizza solo la stringa targa.
- **HTTPS obbligatorio** (serve anche per accedere alla fotocamera).
- **Rate limiting sul login** (anti brute-force).
- **RBAC**: gli operatori NON possono vedere log/admin; solo il super user.
- **NON esporre i file dati/log come static**: i log si servono SOLO via API autenticata.
  Tenere DB e file dati **fuori dalla web root**.
- **Foto solo in memoria**, mai su disco; verificare che la chiamata ALPR non persista nulla.
- **Validazione input** sull'inserimento manuale della targa (formato targa IT).
- **Segreti in variabili d'ambiente**, mai nel repo.

## Autenticazione (basata su dispositivo)

Scelta: **opzione 1 — device authorization** (no password per gli operatori; il super user
approva i dispositivi). MAC/IMEI non sono leggibili da una PWA → si usa un ID generato dall'app.

- **Operatori**: al primo avvio l'app genera un **ID dispositivo casuale (~128 bit)**, lo
  salva in `localStorage` (persistente, non è la cache) e si registra con un nome di
  postazione → stato **pending**. Il super user lo approva **una volta sola**; da lì l'ID
  funge da bearer token (header `x-device-id`). Niente login a ogni accesso.
- **Super user**: password (`SUPERUSER_PASSWORD`) → token HMAC firmato (`AUTH_SECRET`,
  scadenza 12h), header `Authorization: Bearer`. Approva/revoca dispositivi e vede i log.
- **Tracciabilità**: ogni evento registra il **dispositivo** che ha autorizzato (colonna
  `eventi.dispositivo`), visibile nei log.
- **Dev/test**: `AUTH_DEV_BYPASS=1` salta ogni controllo e auto-approva i dispositivi
  (NON usare in produzione). La demo gira con questo flag finché non c'è la UI di auth.
- **Evolvibile a WebAuthn/passkey** (opzione 2) in futuro per sicurezza legata all'hardware.
- Implementazione: `src/auth.js` (logica + preHandler `requireDevice`/`requireSuperuser`),
  tabella `devices` in `src/db.js`. Token lato client in `localStorage` (hardening futuro:
  cookie httpOnly contro XSS).
- **Frontend**: app operatore alla root `/` (Setup nome postazione → schermata "in attesa"
  con polling → tabs operativi); area responsabile su **`/admin`** (login password →
  pannello approva/revoca dispositivi + vista log del giorno). Router minimale via
  `pathname` in `client/src/App.jsx`. ID dispositivo in `client/src/device.js`.

## Edge case da gestire

- **Doppio scan** della stessa auto già entrata → idempotenza (non contare due volte).
- ~~Targa in più cabine~~ → **risolto: targa univoca** (una targa = una cabina).
- **OCR errato** → step di **conferma manuale** della targa/cabina prima di dare il verde.
- **Flusso uscita**: come l'operatore segna l'uscita (es. ri-scan che fa toggle?) → UX chiara.
- **Connettività scarsa in spiaggia** → valutare comportamento offline (eventuale fase 2).

## Stato del progetto

Working dir: `~/Documents/Claude/Parcheggio/`. Backend + frontend operativi
con auth device-based e admin. ALPR integrato: endpoint `POST /api/alpr`
(multipart, foto solo in memoria) → Plate Recognizer Cloud, con `ALPR_MOCK=1`
per sviluppo. UI ingresso: bottone "Foto targa" apre la fotocamera, pre-compila
la targa con badge di confidenza, sotto soglia evidenzia il dubbio. L'operatore
conferma sempre prima del verde. Da fare: verifica end-to-end su mobile reale,
deploy HTTPS (Caddy), DPA Plate Recognizer + regione EU.
