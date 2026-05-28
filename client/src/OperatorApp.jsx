import { useEffect, useState } from 'react';
import { api } from './api.js';
import { getDeviceId, getDeviceNome } from './device.js';
import Ingresso from './components/Ingresso.jsx';
import Uscita from './components/Uscita.jsx';
import Stato from './components/Stato.jsx';
import Setup from './components/Setup.jsx';
import Pending from './components/Pending.jsx';

const TABS = [
  { id: 'ingresso', label: 'Ingresso', icon: '🚗' },
  { id: 'stato', label: 'Stato', icon: '📊' },
  { id: 'uscita', label: 'Uscita', icon: '↩️' },
];

export default function OperatorApp() {
  // fase: 'loading' | 'setup' | 'pending' | 'revoked' | 'ok'
  const [fase, setFase] = useState('loading');
  const [tab, setTab] = useState('ingresso');

  async function refresh() {
    const id = getDeviceId();
    if (!id) return setFase('setup');
    const r = await api.deviceStatus(id);
    if (r.stato === 'approved') return setFase('ok');
    if (r.stato === 'revoked') return setFase('revoked');
    if (r.stato === 'sconosciuto') {
      // ID presente ma non noto al server (es. DB resettato): ri-registra se abbiamo il nome.
      const nome = getDeviceNome();
      if (nome) {
        await api.registerDevice(id, nome);
        return setFase('pending');
      }
      return setFase('setup');
    }
    setFase('pending');
  }

  useEffect(() => {
    refresh();
  }, []);

  if (fase === 'loading') return <div className="centro">…</div>;
  if (fase === 'setup') return <Setup onDone={() => setFase('pending')} />;
  if (fase === 'pending' || fase === 'revoked')
    return <Pending revoked={fase === 'revoked'} onApproved={() => setFase('ok')} />;

  return (
    <div className="app">
      <header className="topbar">
        <img src="/lido-america.png" className="logo-topbar" alt="" />
        Parcheggio
      </header>
      <main className="contenuto">
        {tab === 'ingresso' && <Ingresso />}
        {tab === 'uscita' && <Uscita />}
        {tab === 'stato' && <Stato />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'attivo' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
