import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getDeviceId, getDeviceNome, resetDevice } from '../device.js';

// Schermata d'attesa: fa polling dello stato finché il responsabile non approva.
export default function Pending({ revoked, onApproved }) {
  const [stato, setStato] = useState(revoked ? 'revoked' : 'pending');

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await api.deviceStatus(getDeviceId());
      if (!alive) return;
      if (r.stato === 'approved') onApproved();
      else setStato(r.stato);
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const revocato = stato === 'revoked';

  return (
    <div className="pannello centro-col">
      <img src="/lido-america.png" className="logo-lido" alt="Lido America" />
      {!revocato && <div className="spinner" />}
      <h2>{revocato ? 'Accesso revocato' : 'In attesa di approvazione'}</h2>
      <p className="muto">
        Postazione: <b>{getDeviceNome()}</b>
      </p>
      <p className="muto">
        {revocato
          ? 'Questo dispositivo è stato disabilitato. Contatta il responsabile.'
          : 'Il responsabile deve approvare questo dispositivo. La schermata si aggiorna da sola.'}
      </p>
      <button
        className="btn-testo"
        onClick={() => {
          resetDevice();
          location.reload();
        }}
      >
        Cambia nome postazione
      </button>
    </div>
  );
}
