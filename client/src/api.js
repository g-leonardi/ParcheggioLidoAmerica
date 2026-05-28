// Wrapper sulle API del backend. In dev Vite fa da proxy su /api -> :3000.
import { getDeviceId } from './device.js';

const json = (r) => r.json();

// Header del dispositivo: l'ID approvato funge da bearer token per gli endpoint operatore.
function devHeaders() {
  const id = getDeviceId();
  return id ? { 'x-device-id': id } : {};
}

const post = (url, body, extraHeaders = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  }).then(json);

const bearer = (token) => ({ authorization: `Bearer ${token}` });

export const api = {
  // --- operatore (richiedono dispositivo approvato) ---
  suggerisci: (q) => fetch(`/api/suggerisci?q=${encodeURIComponent(q)}`, { headers: devHeaders() }).then(json),
  lookup: (targa) => fetch(`/api/lookup/${encodeURIComponent(targa)}`, { headers: devHeaders() }).then(json),
  ingresso: (targa) => post('/api/ingresso', { targa }, devHeaders()),
  uscita: (targa) => post('/api/uscita', { targa }, devHeaders()),
  presenti: () => fetch('/api/presenti', { headers: devHeaders() }).then(json),
  occupazione: () => fetch('/api/occupazione', { headers: devHeaders() }).then(json),
  alpr: (file) => {
    const fd = new FormData();
    fd.append('upload', file);
    return fetch('/api/alpr', { method: 'POST', headers: devHeaders(), body: fd }).then(json);
  },

  // --- dispositivo (pubblici) ---
  registerDevice: (deviceId, nome) => post('/api/device/register', { deviceId, nome }),
  deviceStatus: (deviceId) =>
    fetch(`/api/device/status?deviceId=${encodeURIComponent(deviceId)}`).then(json),

  // --- super user ---
  superLogin: (password) => post('/api/superuser/login', { password }),
  devices: (token) => fetch('/api/devices', { headers: bearer(token) }).then(json),
  approve: (token, id) => post(`/api/devices/${id}/approve`, {}, bearer(token)),
  revoke: (token, id) => post(`/api/devices/${id}/revoke`, {}, bearer(token)),
  alprStato: (token) => fetch('/api/admin/alpr', { headers: bearer(token) }).then(json),
  alprSetKey: (token, apiKey) =>
    fetch('/api/admin/alpr', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ apiKey }),
    }).then(json),
  log: (token, { giorno, q } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    else if (giorno) params.set('giorno', giorno);
    const qs = params.toString();
    return fetch(`/api/log${qs ? `?${qs}` : ''}`, { headers: bearer(token) }).then(json);
  },
};
