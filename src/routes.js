// API HTTP.
// - Pubbliche: health, registrazione/stato dispositivo, login super user.
// - requireDevice: endpoint operatore (servono un dispositivo approvato).
// - requireSuperuser: gestione dispositivi e log.
import { normalizeTarga } from './util.js';
import * as core from './occupancy.js';
import * as auth from './auth.js';
import * as alpr from './alpr.js';
import * as anag from './anagrafica.js';

export default async function routes(app) {
  app.get('/api/health', async () => ({ ok: true, devBypass: auth.DEV_BYPASS }));

  // --- Dispositivi (pubblici: servono prima dell'approvazione) ---
  app.post('/api/device/register', async (req, reply) => {
    const { deviceId, nome } = req.body || {};
    const r = auth.registerDevice(deviceId, nome);
    if (r.error) return reply.code(400).send({ ok: false, motivo: r.error });
    return { ok: true, ...r };
  });

  app.get('/api/device/status', async (req) => auth.deviceStatus(req.query.deviceId));

  app.post('/api/superuser/login', async (req, reply) => {
    const r = auth.loginSuperuser(req.body?.password);
    if (!r.ok) return reply.code(401).send(r);
    return r;
  });

  // --- Operatore (dispositivo approvato) ---
  const dev = { preHandler: auth.requireDevice };

  app.get('/api/suggerisci', dev, async (req) => {
    const q = normalizeTarga(req.query.q || '');
    if (q.length < 2) return { suggerimenti: [] };
    return { suggerimenti: core.suggerisci(q) };
  });

  app.get('/api/lookup/:targa', dev, async (req) => core.lookup(normalizeTarga(req.params.targa)));

  app.post('/api/ingresso', dev, async (req, reply) => {
    const targa = normalizeTarga(req.body?.targa);
    if (!targa) return reply.code(400).send({ ok: false, motivo: 'targa_mancante' });
    return core.registraIngresso(targa, req.device.nome);
  });

  app.post('/api/uscita', dev, async (req, reply) => {
    const targa = normalizeTarga(req.body?.targa);
    if (!targa) return reply.code(400).send({ ok: false, motivo: 'targa_mancante' });
    return core.registraUscita(targa, req.device.nome);
  });

  app.get('/api/presenti', dev, async () => ({ presenti: core.presenti() }));
  app.get('/api/occupazione', dev, async () => ({ cabine: core.occupazioneTutte() }));

  // ALPR: l'operatore manda la foto, l'app propone la targa + confidenza.
  // L'operatore conferma o corregge prima del verde (la foto NON decide, velocizza).
  app.post('/api/alpr', dev, async (req, reply) => {
    if (!alpr.configurato()) return reply.code(503).send({ ok: false, motivo: 'alpr_non_configurato' });
    const file = await req.file().catch(() => null);
    if (!file) return reply.code(400).send({ ok: false, motivo: 'foto_mancante' });
    let buf;
    try {
      buf = await file.toBuffer();
    } catch {
      // Oltre il limite multipart: meglio dirlo chiaro che un 500 opaco.
      return reply.code(413).send({ ok: false, motivo: 'foto_troppo_grande' });
    }
    if (file.truncated) return reply.code(413).send({ ok: false, motivo: 'foto_troppo_grande' });
    const r = await alpr.riconosci(buf, file.mimetype);
    if (!r.ok) return reply.code(422).send(r);
    const sottoSoglia = r.confidenza < alpr.CONFIDENCE_MIN;
    // Lookup non scrive: l'operatore vede dove finisce prima di confermare.
    const info = r.targa ? core.lookup(r.targa) : null;
    return { ok: true, targa: r.targa, confidenza: r.confidenza, sottoSoglia, lookup: info, mock: r.mock };
  });

  // --- Super user ---
  const sup = { preHandler: auth.requireSuperuser };

  app.get('/api/devices', sup, async () => ({ devices: auth.listDevices() }));
  app.post('/api/devices/:id/approve', sup, async (req) => ({ ok: true, ...auth.approveDevice(req.params.id) }));
  app.post('/api/devices/:id/revoke', sup, async (req) => ({ ok: true, ...auth.revokeDevice(req.params.id) }));

  app.get('/api/admin/alpr', sup, async () => alpr.stato());
  app.put('/api/admin/alpr', sup, async (req, reply) => {
    const v = req.body?.apiKey;
    if (typeof v !== 'string') return reply.code(400).send({ ok: false, motivo: 'apikey_non_valida' });
    alpr.setApiKey(v.trim());
    return { ok: true, ...alpr.stato() };
  });

  // --- Anagrafica (cabine + targhe + posti) ---
  app.get('/api/admin/cabine', sup, async () => ({ cabine: anag.lista() }));

  app.post('/api/admin/cabine', sup, async (req, reply) => {
    const r = anag.creaCabina(req.body?.numero, req.body?.posti);
    return r.ok ? r : reply.code(400).send(r);
  });

  app.put('/api/admin/cabine/:numero', sup, async (req, reply) => {
    const r = anag.aggiornaPosti(req.params.numero, req.body?.posti);
    return r.ok ? r : reply.code(400).send(r);
  });

  app.delete('/api/admin/cabine/:numero', sup, async (req, reply) => {
    const r = anag.eliminaCabina(req.params.numero);
    return r.ok ? r : reply.code(400).send(r);
  });

  app.post('/api/admin/cabine/:numero/targhe', sup, async (req, reply) => {
    const r = anag.aggiungiTarga(req.params.numero, req.body?.targa);
    return r.ok ? r : reply.code(400).send(r);
  });

  app.delete('/api/admin/targhe/:targa', sup, async (req, reply) => {
    const r = anag.rimuoviTarga(req.params.targa);
    return r.ok ? r : reply.code(400).send(r);
  });

  app.get('/api/log', sup, async (req) => {
    const q = (req.query.q || '').trim();
    if (q) return { q, eventi: core.cercaLog(q) }; // ricerca su tutti i giorni
    const giorno = req.query.giorno;
    return { giorno: giorno || null, eventi: core.logGiorno(giorno) };
  });
}
