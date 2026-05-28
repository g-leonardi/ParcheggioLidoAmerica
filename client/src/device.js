// Identità del dispositivo, salvata in localStorage (persistente, non è la cache):
// si genera una volta sola e sopravvive a chiusure/riavvii finché non si cancellano i dati.
const K_ID = 'parcheggio.deviceId';
const K_NOME = 'parcheggio.deviceNome';

// 256 bit casuali in hex. getRandomValues funziona anche su http (LAN), a differenza di
// crypto.randomUUID che richiede un secure context.
function randomId() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const getDeviceId = () => localStorage.getItem(K_ID);
export const getDeviceNome = () => localStorage.getItem(K_NOME);

export function ensureDeviceId() {
  let id = localStorage.getItem(K_ID);
  if (!id) {
    id = randomId();
    localStorage.setItem(K_ID, id);
  }
  return id;
}

export const setDeviceNome = (nome) => localStorage.setItem(K_NOME, nome);

export function resetDevice() {
  localStorage.removeItem(K_ID);
  localStorage.removeItem(K_NOME);
}
