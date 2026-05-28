import { useEffect, useState } from 'react';
import { api } from '../api.js';

const K_TOKEN = 'parcheggio.superToken';

export default function Superuser() {
  const [token, setToken] = useState(sessionStorage.getItem(K_TOKEN) || '');

  function setSession(t) {
    sessionStorage.setItem(K_TOKEN, t);
    setToken(t);
  }
  function logout() {
    sessionStorage.removeItem(K_TOKEN);
    setToken('');
  }

  if (!token) return <Login onToken={setSession} />;
  return <Dashboard token={token} onLogout={logout} />;
}

function Login({ onToken }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');

  async function entra() {
    const r = await api.superLogin(pwd);
    if (r.ok) return onToken(r.token);
    setErr(r.motivo === 'superuser_non_configurato' ? 'Super user non configurato sul server.' : 'Password errata.');
  }

  return (
    <div className="pannello centro-col">
      <img src="/lido-america.png" className="logo-lido" alt="Lido America" />
      <h2>Area responsabile</h2>
      <input
        type="password"
        className="ti-input"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && entra()}
        placeholder="Password"
      />
      {err && <div className="msg-err">{err}</div>}
      <button className="btn-grande" onClick={entra}>
        ENTRA
      </button>
      <a className="btn-testo" href="/">
        ← App operatore
      </a>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [vista, setVista] = useState('dispositivi');
  return (
    <div className="app">
      <header className="topbar">
        <img src="/lido-america.png" className="logo-topbar" alt="" />
        Responsabile
        <button className="logout" onClick={onLogout}>
          Esci
        </button>
      </header>
      <main className="contenuto">
        {vista === 'dispositivi' && <Dispositivi token={token} onAuthFail={onLogout} />}
        {vista === 'alpr' && <Alpr token={token} onAuthFail={onLogout} />}
        {vista === 'log' && <Log token={token} onAuthFail={onLogout} />}
      </main>
      <nav className="tabbar">
        <button className={vista === 'dispositivi' ? 'attivo' : ''} onClick={() => setVista('dispositivi')}>
          <span className="tab-icon">📱</span>Dispositivi
        </button>
        <button className={vista === 'alpr' ? 'attivo' : ''} onClick={() => setVista('alpr')}>
          <span className="tab-icon">📷</span>ALPR
        </button>
        <button className={vista === 'log' ? 'attivo' : ''} onClick={() => setVista('log')}>
          <span className="tab-icon">📋</span>Log
        </button>
      </nav>
    </div>
  );
}

function Alpr({ token, onAuthFail }) {
  const [stato, setStato] = useState(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function carica() {
    const r = await api.alprStato(token);
    if (r && typeof r.sorgente === 'string') setStato(r);
    else onAuthFail();
  }
  useEffect(() => { carica(); }, []);

  async function salva() {
    setBusy(true);
    setMsg('');
    const r = await api.alprSetKey(token, key);
    setBusy(false);
    if (r.ok) {
      setStato(r);
      setKey('');
      setMsg('Salvata. Le nuove letture useranno questa chiave.');
    } else {
      setMsg('Errore nel salvataggio.');
    }
  }
  async function svuota() {
    if (!confirm('Rimuovere la chiave salvata? Tornerà a quella dell\'ambiente (se presente).')) return;
    const r = await api.alprSetKey(token, '');
    if (r.ok) { setStato(r); setMsg('Chiave rimossa.'); }
  }

  if (!stato) return <div className="pannello"><p className="muto">…</p></div>;

  const FONTI = {
    db: { label: 'Salvata qui (database)', cls: 'badge approved' },
    env: { label: 'Variabile d\'ambiente (.env)', cls: 'badge pending' },
    none: { label: 'Non configurata', cls: 'badge revoked' },
  };
  const f = FONTI[stato.sorgente];

  return (
    <div className="pannello">
      <h2>ALPR — Plate Recognizer</h2>

      <div className="alpr-stato">
        <div className="alpr-riga">
          <span>Stato:</span> <span className={f.cls}>{f.label}</span>
        </div>
        {stato.lunghezzaKey > 0 && (
          <div className="alpr-riga">
            <span>Chiave attiva:</span> <span className="muto">••••••• ({stato.lunghezzaKey} caratteri)</span>
          </div>
        )}
        <div className="alpr-riga muto">
          {stato.mock && <em>Modalità MOCK attiva (ALPR_MOCK=1) · le foto non vengono inviate al cloud.</em>}
        </div>
      </div>

      <h3 className="alpr-h3">Aggiorna chiave API</h3>
      <input
        type="password"
        className="ti-input"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Incolla qui il token Plate Recognizer"
        autoComplete="off"
        spellCheck={false}
      />
      <button className="btn-grande" onClick={salva} disabled={busy || !key.trim()}>
        {busy ? 'Salvataggio…' : 'SALVA'}
      </button>
      {stato.sorgente === 'db' && (
        <button className="btn-testo" onClick={svuota}>Rimuovi chiave salvata</button>
      )}
      {msg && <div className="msg-ok">{msg}</div>}
      <p className="muto piccolo">
        La chiave è salvata nel database del server e ha precedenza sulla variabile d'ambiente.
        Modificarla qui ha effetto immediato: nessun riavvio necessario.
      </p>
    </div>
  );
}

const ETICHETTA = { pending: 'In attesa', approved: 'Approvato', revoked: 'Revocato' };

function Dispositivi({ token, onAuthFail }) {
  const [devices, setDevices] = useState([]);

  async function carica() {
    const r = await api.devices(token);
    if (r.devices) setDevices(r.devices);
    else onAuthFail();
  }

  useEffect(() => {
    carica();
    const t = setInterval(carica, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pannello">
      <h2>Dispositivi</h2>
      {devices.length === 0 ? (
        <p className="muto">Nessun dispositivo registrato.</p>
      ) : (
        <ul className="lista-dev">
          {devices.map((d) => (
            <li key={d.id} className="dev">
              <div className="dev-info">
                <b>{d.nome}</b>
                <span className={`badge ${d.stato}`}>{ETICHETTA[d.stato] || d.stato}</span>
              </div>
              <div className="dev-azioni">
                {d.stato !== 'approved' && (
                  <button className="btn-ok" onClick={async () => { await api.approve(token, d.id); carica(); }}>
                    Approva
                  </button>
                )}
                {d.stato === 'approved' && (
                  <button className="btn-no" onClick={async () => { await api.revoke(token, d.id); carica(); }}>
                    Revoca
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function todayRome() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}
function shiftDay(d, delta) {
  const dt = new Date(`${d}T12:00:00`);
  dt.setDate(dt.getDate() + delta);
  return new Intl.DateTimeFormat('en-CA').format(dt);
}
function etichettaGiorno(d) {
  const s = new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  return d === todayRome() ? `${s} · oggi` : s;
}
const oraOf = (ts) => new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Raggruppa per veicolo, eventi in ordine cronologico (ingresso poi uscita adiacenti).
// I gruppi sono ordinati per attività più recente.
function raggruppaPerVeicolo(eventi) {
  const map = new Map();
  for (const e of eventi) {
    if (!map.has(e.targa)) map.set(e.targa, []);
    map.get(e.targa).push(e);
  }
  return [...map.entries()]
    .map(([targa, evs]) => {
      const asc = [...evs].sort((a, b) => a.ts.localeCompare(b.ts));
      return { targa, cabina: asc[0].cabina, eventi: asc, ultimo: asc[asc.length - 1].ts };
    })
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo));
}

function Log({ token, onAuthFail }) {
  const [giorno, setGiorno] = useState(todayRome());
  const [q, setQ] = useState('');
  const [eventi, setEventi] = useState([]);
  const ricerca = q.trim().length > 0;

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      const r = await api.log(token, ricerca ? { q: q.trim() } : { giorno });
      if (!alive) return;
      if (r.eventi) setEventi(r.eventi);
      else onAuthFail();
    }, ricerca ? 250 : 0); // debounce sulla ricerca
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, giorno]);

  const gruppi = raggruppaPerVeicolo(eventi);
  const oggi = todayRome();

  return (
    <div className="pannello">
      <input
        className="ti-input cerca"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca targa, cabina, operatore, data…"
        autoCorrect="off"
        autoCapitalize="characters"
      />

      {ricerca ? (
        <div className="ricerca-info">Ricerca su tutti i giorni · {gruppi.length} veicoli</div>
      ) : (
        <div className="giorno-nav">
          <button onClick={() => setGiorno(shiftDay(giorno, -1))}>◀</button>
          <span className="giorno-label">{etichettaGiorno(giorno)}</span>
          <button onClick={() => setGiorno(shiftDay(giorno, 1))} disabled={giorno >= oggi}>
            ▶
          </button>
          {giorno !== oggi && (
            <button className="oggi" onClick={() => setGiorno(oggi)}>
              Oggi
            </button>
          )}
        </div>
      )}

      {gruppi.length === 0 ? (
        <p className="muto">{ricerca ? 'Nessun risultato.' : 'Nessun movimento.'}</p>
      ) : (
        <div className="log-gruppi">
          {gruppi.map((g) => (
            <div key={g.targa + g.ultimo} className="veicolo">
              <div className="veicolo-head">
                <span className="l-targa">{g.targa}</span>
                <span className="l-cabina">cab {g.cabina}</span>
              </div>
              {g.eventi.map((e, i) => (
                <div key={i} className={`mov ${e.tipo}`}>
                  <span className="mov-ora">{oraOf(e.ts)}</span>
                  <span className={`mov-tipo ${e.tipo}`}>
                    {e.tipo === 'ingresso' ? '▶ INGRESSO' : '◀ USCITA'}
                  </span>
                  {ricerca && <span className="mov-data">{e.giorno}</span>}
                  <span className="mov-disp">{e.dispositivo || '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
