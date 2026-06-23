// Autenticazione basata su DISPOSITIVO (opzione 1) + login super user.
//
// - Operatori: nessuna password. Ogni dispositivo ha un ID casuale (~128 bit) generato
//   dall'app e salvato in localStorage; il super user lo approva una volta. Da lì l'ID
//   funge da bearer token (inviato nell'header x-device-id).
// - Super user: password (env SUPERUSER_PASSWORD) -> token HMAC firmato (env AUTH_SECRET).
// - Dev/test: AUTH_DEV_BYPASS=1 salta ogni controllo (e auto-approva i dispositivi).
import crypto from 'node:crypto';
import { db } from './db.js';

export const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === '1';
const SUPER_PWD = process.env.SUPERUSER_PASSWORD || null;
const SECRET = process.env.AUTH_SECRET || 'dev-secret-cambiami';

const qDevice = db.prepare('SELECT * FROM devices WHERE id = ?');
const insDevice = db.prepare(
  'INSERT INTO devices (id, nome, stato, created_at, approved_at) VALUES (?, ?, ?, ?, ?)');
const qAllDevices = db.prepare(
  'SELECT id, nome, stato, created_at, approved_at FROM devices ORDER BY created_at DESC');
const updStato = db.prepare('UPDATE devices SET stato = ?, approved_at = ? WHERE id = ?');

// --- Dispositivi -----------------------------------------------------------

export function registerDevice(deviceId, nome) {
  if (!deviceId || !nome) return { error: 'dati_mancanti' };
  let d = qDevice.get(deviceId);
  if (!d) {
    const stato = DEV_BYPASS ? 'approved' : 'pending';
    const now = new Date().toISOString();
    insDevice.run(deviceId, String(nome).slice(0, 60), stato, now, stato === 'approved' ? now : null);
    d = qDevice.get(deviceId);
  }
  return { stato: d.stato, nome: d.nome };
}

export function deviceStatus(deviceId) {
  const d = qDevice.get(deviceId);
  return d ? { stato: d.stato, nome: d.nome } : { stato: 'sconosciuto' };
}

export const listDevices = () => qAllDevices.all();

export function approveDevice(id) {
  updStato.run('approved', new Date().toISOString(), id);
  return deviceStatus(id);
}

export function revokeDevice(id) {
  updStato.run('revoked', null, id);
  return deviceStatus(id);
}

// preHandler Fastify: richiede un dispositivo approvato. Espone req.device = { id, nome }.
export async function requireDevice(req, reply) {
  if (DEV_BYPASS) {
    req.device = { id: 'DEV', nome: 'DEV' };
    return;
  }
  const id = req.headers['x-device-id'];
  const d = id ? qDevice.get(id) : null;
  if (!d || d.stato !== 'approved') {
    return reply.code(401).send({
      ok: false,
      motivo: 'dispositivo_non_autorizzato',
      stato: d?.stato || 'sconosciuto',
    });
  }
  req.device = { id: d.id, nome: d.nome };
}

// --- Super user ------------------------------------------------------------

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() ? payload : null;
}

export function loginSuperuser(password) {
  if (!SUPER_PWD) return { ok: false, motivo: 'superuser_non_configurato' };
  const a = Buffer.from(String(password ?? ''));
  const b = Buffer.from(SUPER_PWD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, motivo: 'password_errata' };
  }
  return { ok: true, token: signToken({ role: 'super', exp: Date.now() + 30 * 24 * 3600 * 1000 }) };
}

export async function requireSuperuser(req, reply) {
  if (DEV_BYPASS) {
    req.user = { role: 'super' };
    return;
  }
  const h = req.headers['authorization'] || '';
  const payload = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!payload || payload.role !== 'super') {
    return reply.code(401).send({ ok: false, motivo: 'non_autorizzato' });
  }
  req.user = payload;
}
