# Deploy su Fly.io

App Node (Fastify) + SQLite su file, servita da un solo processo. Il database vive su un
**volume persistente** (`/data`), così sopravvive a deploy e riavvii. Pensato per uso
**stagionale**: la macchina si ferma da sola quando non c'è traffico e riparte alla prima
richiesta (costo ~0 fuori stagione).

> I valori reali dei segreti sono in `CREDENZIALI.local.md` (non versionato).

## 0. Prerequisiti (una volta sola)

```bash
# Installa flyctl
curl -L https://fly.io/install.sh | sh        # macOS/Linux
# poi aggiungi al PATH come indicato dall'installer (o: brew install flyctl)

fly auth login        # apre il browser; serve un metodo di pagamento sull'account Fly
```

## 1. Crea l'app (senza deployare ancora)

```bash
cd ~/Documents/Claude/Parcheggio
# (opzionale) cambia il nome in fly.toml -> app = "..."  (deve essere unico su Fly)
fly launch --no-deploy --copy-config --name parcheggio-lido-america --region fra
```

Se chiede di creare il volume per il mount `/data`, accetta. Altrimenti crealo a mano:

```bash
fly volumes create parcheggio_data --region fra --size 1   # 1 GB, ~€0.15/mese
```

## 2. Imposta i segreti (MAI nel repo)

```bash
fly secrets set \
  SUPERUSER_PASSWORD='<scegli-una-password-forte>' \
  AUTH_SECRET='<vedi CREDENZIALI.local.md>' \
  ALPR_API_KEY='<token Plate Recognizer>'
```

## 3. Deploy

```bash
fly deploy
```

Al primo avvio il server crea un database **vuoto** sul volume (solo schema). Ora carichiamo
quello reale (240 cabine).

## 4. Carica il database reale (bootstrap, una volta sola)

```bash
# carica il file in una posizione temporanea sul volume
fly ssh sftp shell
  put data/parcheggio.db /data/parcheggio.db.new
  # Ctrl-D per uscire

# sostituisci il DB vuoto con quello vero e rimuovi i file WAL del vuoto
fly ssh console -C "rm -f /data/parcheggio.db-wal /data/parcheggio.db-shm && mv -f /data/parcheggio.db.new /data/parcheggio.db"

# riavvia per ricaricare il DB
fly apps restart parcheggio-lido-america
```

## 5. Verifica

```bash
fly open                 # apre l'app nel browser (HTTPS)
fly logs                 # log in tempo reale
```

- App operatore: `https://<app>.fly.dev/`
- Area responsabile: `https://<app>.fly.dev/admin` (password = `SUPERUSER_PASSWORD`)

## Aggiornamenti futuri

- **Codice** (nuove funzioni): `git push` poi `fly deploy`.
- **Dati** (cabine/targhe): si modificano **dall'app** in `/admin → Cabine`. Il volume li
  conserva: **non** serve rifare il bootstrap, e **non** rilanciare `npm run seed` (cancellerebbe
  le modifiche fatte a mano, spogliatoi inclusi).

## Fuori stagione

- La macchina si ferma da sola (nessun costo di compute). Resta solo il costo del volume (~€0.15/mese).
- Per spegnere del tutto a fine stagione: `fly scale count 0`. Per riaccendere: `fly scale count 1`.
- Il DB sul volume resta intatto tra una stagione e l'altra.
