import { useEffect, useState } from 'react';
import { api } from './api.js';
import { getDeviceId, getDeviceNome } from './device.js';
import { getModo, setModo, prossimoModo, temaEffettivo, etichettaModo } from './tema.js';
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

// Applica il tema (auto/sole/notte) scrivendo data-tema su <html>; il CSS
// chiaro è scopato su quell'attributo, quindi tocca solo l'app operatore
// (l'admin non monta questo componente → resta scura).
function useTema() {
  const [modo, setModoState] = useState(getModo);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const applica = () => {
      document.documentElement.dataset.tema = temaEffettivo(modo);
    };
    applica();
    // in 'auto' segui i cambi chiaro/scuro del sistema in tempo reale
    if (modo === 'auto' && mq) {
      mq.addEventListener?.('change', applica);
      return () => mq.removeEventListener?.('change', applica);
    }
  }, [modo]);
  const cicla = () => {
    const next = prossimoModo(modo);
    setModo(next);
    setModoState(next);
  };
  return { modo, cicla };
}

export default function OperatorApp() {
  // fase: 'loading' | 'setup' | 'pending' | 'revoked' | 'ok'
  const [fase, setFase] = useState('loading');
  const [tab, setTab] = useState('ingresso');
  const { modo, cicla } = useTema();

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

  const tema = etichettaModo(modo);
  // Mostra "Operatore <nome>" dal nome dato al dispositivo in setup (es. "Operatore
  // Peo"); fallback "Parcheggio" se per qualche motivo il nome manca.
  const nomeDisp = getDeviceNome();
  const operatore = nomeDisp ? `Operatore ${nomeDisp}` : 'Parcheggio';

  return (
    <div className="app">
      <header className="topbar">
        <img src="/lido-america.png" className="logo-topbar" alt="" />
        {operatore}
        <button
          className="tema-toggle"
          onClick={cicla}
          aria-label={`Tema ${tema.testo}. Tocca per cambiare.`}
          title={`Tema: ${tema.testo}`}
        >
          <span aria-hidden="true">{tema.icona}</span>
          {tema.testo}
        </button>
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
