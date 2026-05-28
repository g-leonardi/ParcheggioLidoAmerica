import { useState } from 'react';
import { api } from '../api.js';
import { ensureDeviceId, setDeviceNome } from '../device.js';

// Primo avvio: l'operatore dà un nome alla postazione e richiede l'accesso.
export default function Setup({ onDone }) {
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);

  async function richiedi() {
    const n = nome.trim();
    if (!n) return;
    setBusy(true);
    const id = ensureDeviceId();
    setDeviceNome(n);
    await api.registerDevice(id, n);
    onDone();
  }

  return (
    <div className="pannello centro-col">
      <img src="/lido-america.png" className="logo-lido" alt="Lido America" />
      <h2>Configura postazione</h2>
      <p className="muto">
        Dai un nome a questo dispositivo. Il responsabile dovrà approvarlo una volta sola.
      </p>
      <input
        className="ti-input"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Es. Ingresso 1"
        autoCorrect="off"
      />
      <button className="btn-grande" disabled={busy} onClick={richiedi}>
        RICHIEDI ACCESSO
      </button>
    </div>
  );
}
