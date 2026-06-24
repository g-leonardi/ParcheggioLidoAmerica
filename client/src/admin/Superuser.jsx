import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Grafici from './Grafici.jsx';

const K_TOKEN = 'parcheggio.superToken';

// Token in localStorage (non sessionStorage): deve sopravvivere alla chiusura
// della PWA. La PWA installata da Chrome viene chiusa dall'OS quando va in
// background; con sessionStorage il token spariva e l'admin doveva rifare login
// di continuo. localStorage persiste finché non si fa "Esci". La scadenza vera
// la decide il server (token firmato, 30 giorni — vedi src/auth.js).
export default function Superuser() {
  const [token, setToken] = useState(localStorage.getItem(K_TOKEN) || '');

  function setSession(t) {
    localStorage.setItem(K_TOKEN, t);
    setToken(t);
  }
  function logout() {
    localStorage.removeItem(K_TOKEN);
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
      <h2>Area manager</h2>
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
  const [vista, setVista] = useState('grafici'); // dashboard-first
  return (
    <div className="app">
      <header className="topbar">
        <img src="/lido-america.png" className="logo-topbar" alt="" />
        Manager
        <button className="logout" onClick={onLogout}>
          Esci
        </button>
      </header>
      <main className="contenuto">
        {vista === 'grafici' && <Grafici token={token} onAuthFail={onLogout} />}
        {vista === 'dispositivi' && <Dispositivi token={token} onAuthFail={onLogout} />}
        {vista === 'anagrafica' && <Anagrafica token={token} onAuthFail={onLogout} />}
        {vista === 'alpr' && <Alpr token={token} onAuthFail={onLogout} />}
        {vista === 'log' && <Log token={token} onAuthFail={onLogout} />}
      </main>
      <nav className="tabbar">
        <button className={vista === 'grafici' ? 'attivo' : ''} onClick={() => setVista('grafici')}>
          <span className="tab-icon">📊</span>Dashboard
        </button>
        <button className={vista === 'dispositivi' ? 'attivo' : ''} onClick={() => setVista('dispositivi')}>
          <span className="tab-icon">📱</span>Dispositivi
        </button>
        <button className={vista === 'anagrafica' ? 'attivo' : ''} onClick={() => setVista('anagrafica')}>
          <span className="tab-icon">🏖️</span>Cabine
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

const MOTIVI = {
  gia_esistente: 'Cabina già esistente.',
  posti_non_validi: 'Numero di ingressi non valido.',
  numero_mancante: 'Indica il nome della cabina.',
  gia_presente: 'Targa già presente in questa cabina.',
  targa_non_valida: 'Targa non valida (troppo corta).',
  cabina_non_trovata: 'Cabina non trovata.',
  non_trovata: 'Non trovata.',
};
// Costruisce la sigla cabina dalla categoria scelta nel menu guidato, così
// l'admin non deve ricordare i codici (B/G/CB/CG/P).
//  • 'B'/'G'        → 25B / 32G
//  • 'postazioni'   → P12 (Postazione) oppure CB1/CG1 (Capannina): in creazione
//    resta la distinzione (sottoP); in Stato sono accorpate in un'unica zona.
//  • 'libero'       → sigla digitata a mano (spogliatoi SB/SG/SI/SL…)
//  • 'vip'          → il "numero" è un NOME libero → sigla "VIP <NOME>", che
//    lo Stato riconosce dal prefisso e mette nella zona VIP.
function costruisciSigla(categoria, sottoP, num) {
  if (categoria === 'vip') {
    const nome = String(num).trim().replace(/\s+/g, ' ').toUpperCase();
    return nome ? `VIP ${nome}` : '';
  }
  const n = String(num).trim().toUpperCase().replace(/\s/g, '');
  if (!n) return '';
  if (categoria === 'B') return `${n}B`;
  if (categoria === 'G') return `${n}G`;
  if (categoria === 'postazioni') return `${sottoP}${n}`; // P12 / CB1 / CG1
  if (categoria === 'libero') return n;
  return '';
}

function messaggio(r) {
  if (r.motivo === 'targa_in_altra_cabina') return `Targa già assegnata alla cabina ${r.cabina}.`;
  return MOTIVI[r.motivo] || 'Operazione non riuscita.';
}

// Display: il prefisso tecnico "VIP " serve solo per la categoria, non si mostra.
// Così "VIP GIUSEPPE" compare come "GIUSEPPE". La sigla reale (chiave) resta intatta.
const nomeVisibile = (numero) => (numero.startsWith('VIP ') ? numero.slice(4) : numero);

// Categorie mostrate nei contatori "auto entrate / targhe" del Parking Manager.
const CATEGORIE = [
  { key: 'bianche', label: 'Bianco' },
  { key: 'gialle', label: 'Giallo' },
  { key: 'postazioni', label: 'Postazioni' },
  { key: 'spogliatoi', label: 'Spogliatoi' },
  { key: 'vip', label: 'VIP' },
];

// --- Esportazione anagrafica (cabina -> targhe) ---------------------------
// Tutto client-side dai dati già caricati: nessuna chiamata extra al server.
function campoCsv(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function scarica(contenuto, nome, mime) {
  const url = URL.createObjectURL(new Blob([contenuto], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function esportaCSV(cabine) {
  // Una riga per cabina; le targhe nella stessa cella, separate da virgola.
  // Delimitatore ';' (default di Excel in locale IT → si apre già in colonne).
  const sep = ';';
  const righe = [['cabina', 'ingressi', 'targhe'].join(sep)];
  for (const c of cabine) {
    righe.push([campoCsv(c.numero), c.posti, campoCsv(c.targhe.join(','))].join(sep));
  }
  // BOM iniziale → Excel legge l'UTF-8 (accenti) correttamente.
  const csv = '﻿' + righe.join('\r\n');
  scarica(csv, `parking-manager-${todayRome()}.csv`, 'text/csv;charset=utf-8');
}
function esportaJSON(cabine) {
  // Indicizzato per cabina: { "2B": { ingressi: 2, targhe: ["AAA","BBB"] }, ... }.
  const dati = {};
  for (const c of cabine) dati[c.numero] = { ingressi: c.posti, targhe: c.targhe };
  scarica(JSON.stringify(dati, null, 2), `parking-manager-${todayRome()}.json`, 'application/json');
}

function Anagrafica({ token, onAuthFail }) {
  const [cabine, setCabine] = useState(null);
  const [riepilogo, setRiepilogo] = useState(null);
  const [q, setQ] = useState('');
  const [nuovaAperta, setNuovaAperta] = useState(false);
  const [exportAperto, setExportAperto] = useState(false);

  async function carica() {
    const r = await api.cabine(token);
    if (r.cabine) setCabine(r.cabine);
    else onAuthFail();
  }
  async function caricaRiepilogo() {
    const r = await api.riepilogo(token);
    if (r.categorie) setRiepilogo(r.categorie);
  }
  useEffect(() => {
    carica();
    caricaRiepilogo();
    const t = setInterval(caricaRiepilogo, 20000); // "auto entrate" è dato vivo
    return () => clearInterval(t);
  }, []);

  if (!cabine) return <div className="pannello"><p className="muto">…</p></div>;

  const filtro = q.trim().toUpperCase().replace(/\s/g, '');
  const norm = (s) => s.toUpperCase().replace(/\s/g, '');
  // Rank: 0 = cabina esatta, 1 = cabina parziale, 2 = match solo nelle targhe.
  // Così cercando "2B" esce PRIMA la cabina 2B, poi le parziali, poi le cabine
  // che hanno "2B" tra le targhe. (sort stabile → ordine naturale a parità di rank)
  const rank = (c) => {
    const n = norm(c.numero);
    if (n === filtro) return 0;
    if (n.includes(filtro)) return 1;
    if (c.targhe.some((t) => norm(t).includes(filtro))) return 2;
    return -1;
  };
  const viste = filtro
    ? cabine
        .map((c) => [c, rank(c)])
        .filter(([, r]) => r >= 0)
        .sort((a, b) => a[1] - b[1])
        .map(([c]) => c)
    : cabine;
  // Totale auto dentro / targhe registrate (somma su tutte le categorie).
  const tot = Object.values(riepilogo || {}).reduce(
    (a, r) => ({ entrate: a.entrate + r.entrate, targhe: a.targhe + r.targhe }),
    { entrate: 0, targhe: 0 },
  );

  return (
    <div className="pannello">
      <div className="ana-head">
        <div><h2>Parking Manager</h2></div>
        <div className="ana-head-azioni">
          <div className="pm-export-wrap">
            <button className="ana-nuova-btn pm-export-btn" onClick={() => setExportAperto((o) => !o)}>
              ⬇ Esporta
            </button>
            {exportAperto && (
              <>
                <div className="pm-export-backdrop" onClick={() => setExportAperto(false)} />
                <div className="pm-export-menu" role="menu">
                  <span className="muto piccolo">Esporta in</span>
                  <button onClick={() => { esportaCSV(cabine); setExportAperto(false); }}>CSV / Excel</button>
                  <button onClick={() => { esportaJSON(cabine); setExportAperto(false); }}>JSON</button>
                </div>
              </>
            )}
          </div>
          <button className="ana-nuova-btn" onClick={() => setNuovaAperta(true)}>+ Nuova</button>
        </div>
      </div>
      {riepilogo ? (
        <div className="pm-conteggi">
          {CATEGORIE.map((cat) => {
            const r = riepilogo[cat.key] || { entrate: 0, targhe: 0 };
            return (
              <span key={cat.key} className="pm-chip">
                <span className="pm-lbl">{cat.label}</span>
                <span className="pm-val">{r.entrate}/{r.targhe}</span>
              </span>
            );
          })}
          <span className="pm-chip pm-tot">
            <span className="pm-lbl">Totale</span>
            <span className="pm-val">{tot.entrate}/{tot.targhe}</span>
          </span>
        </div>
      ) : <div className="muto piccolo">Caricamento…</div>}

      <input
        className="ti-input cerca ana-cerca"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca cabina o targa…"
        autoCapitalize="characters"
        autoCorrect="off"
      />

      {viste.length === 0 ? (
        <p className="muto">{filtro ? 'Nessuna corrispondenza.' : 'Nessuna cabina. Tocca “+ Nuova” o importa il CSV.'}</p>
      ) : (
        <div className="ana-lista">
          {viste.map((c) => (
            <CardCabina key={c.numero} cabina={c} token={token} onChange={carica} />
          ))}
        </div>
      )}

      {nuovaAperta && (
        <ModaleNuovaCabina
          token={token}
          onChiudi={() => setNuovaAperta(false)}
          onCreata={() => { setNuovaAperta(false); carica(); }}
        />
      )}
    </div>
  );
}

function ModaleNuovaCabina({ token, onChiudi, onCreata }) {
  const [categoria, setCategoria] = useState(''); // '' | 'B' | 'G' | 'postazioni' | 'libero' | 'vip'
  const [sottoP, setSottoP] = useState('P');       // solo postazioni: 'P' | 'CB' | 'CG'
  const [nNum, setNNum] = useState('');             // numero, sigla (libero) o nome (vip)
  const [nPosti, setNPosti] = useState(2);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // La sigla è costruita dall'app dalla categoria scelta → niente codici da ricordare.
  const sigla = costruisciSigla(categoria, sottoP, nNum);
  const isVip = categoria === 'vip';
  const isLibero = categoria === 'libero';
  const labelCampo = isVip ? 'Nome' : isLibero ? 'Sigla' : 'Numero';

  async function crea() {
    if (!sigla || busy) return;
    setBusy(true);
    const r = await api.creaCabina(token, sigla, Number(nPosti));
    setBusy(false);
    if (r.ok) onCreata();
    else setMsg(messaggio(r));
  }

  return (
    <div className="sheet-overlay" onClick={onChiudi}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nuovo inserimento">
        <div className="sheet-head">
          <h3>Nuovo inserimento</h3>
          <button className="sheet-chiudi" onClick={onChiudi} aria-label="Chiudi">×</button>
        </div>

        <select
          className="ti-input"
          value={categoria}
          onChange={(e) => { setCategoria(e.target.value); setNNum(''); setMsg(''); }}
        >
          <option value="" disabled>Seleziona categoria</option>
          <option value="B">⚪ Bianco</option>
          <option value="G">🟡 Giallo</option>
          <option value="postazioni">⛱️ Postazioni</option>
          <option value="libero">🚪 Spogliatoi</option>
          <option value="vip">⭐ VIP</option>
        </select>

        {categoria === 'postazioni' && (
          <>
            <label className="sheet-label">Tipo postazione</label>
            <select
              className="ti-input"
              value={sottoP}
              onChange={(e) => setSottoP(e.target.value)}
            >
              <option value="P">⛱️ Postazione (P)</option>
              <option value="CB">🏕️ Capannina bianca (CB)</option>
              <option value="CG">🏕️ Capannina gialla (CG)</option>
            </select>
          </>
        )}

        <label className="sheet-label">{labelCampo}</label>
        <input
          className="ti-input"
          value={nNum}
          onChange={(e) => { setNNum(e.target.value); setMsg(''); }}
          onKeyDown={(e) => e.key === 'Enter' && sigla && crea()}
          placeholder={isVip ? 'es. Giuseppe Leonardi' : isLibero ? 'es. SB' : 'es. 12'}
          inputMode={isVip || isLibero ? 'text' : 'numeric'}
          autoCapitalize={isVip ? 'words' : 'characters'}
          autoCorrect="off"
          autoFocus
        />

        <div className="ana-posti sheet-posti">
          <button onClick={() => setNPosti((n) => Math.max(1, n - 1))} disabled={nPosti <= 1}>−</button>
          <span>{nPosti} <small>{nPosti === 1 ? 'ingresso' : 'ingressi'}</small></span>
          <button onClick={() => setNPosti((n) => n + 1)}>+</button>
        </div>

        <p className="muto piccolo sheet-anteprima">
          {!categoria
            ? 'Scegli prima una categoria.'
            : sigla
              ? <>Verrà creata: <b>{sigla}</b> · {nPosti} {nPosti === 1 ? 'ingresso' : 'ingressi'}</>
              : `Inserisci ${isVip ? 'il nome' : isLibero ? 'la sigla' : 'il numero'}: la sigla la genera l’app.`}
        </p>
        {msg && <div className="msg-err">{msg}</div>}

        <button className="btn-grande" onClick={crea} disabled={!sigla || busy}>
          {busy ? 'Creazione…' : 'CREA CABINA'}
        </button>
      </div>
    </div>
  );
}

function CardCabina({ cabina, token, onChange }) {
  const [targa, setTarga] = useState('');
  const [err, setErr] = useState('');
  const [posti, setPosti] = useState(cabina.posti);

  async function setP(nuovo) {
    if (nuovo < 1) return;
    // Modificare gli ingressi è un'azione delicata quanto l'eliminazione → conferma.
    const verbo = nuovo > posti ? 'Aumentare' : 'Ridurre';
    if (!confirm(`${verbo} gli ingressi di ${cabina.numero} da ${posti} a ${nuovo}?`)) return;
    const prima = posti;
    setPosti(nuovo);
    setErr('');
    const r = await api.aggiornaPosti(token, cabina.numero, nuovo);
    if (!r.ok) { setPosti(prima); setErr(messaggio(r)); } else onChange();
  }
  async function addTarga() {
    const r = await api.aggiungiTarga(token, cabina.numero, targa);
    if (r.ok) { setTarga(''); setErr(''); onChange(); } else setErr(messaggio(r));
  }
  async function delTarga(t) {
    const r = await api.rimuoviTarga(token, t);
    if (r.ok) onChange();
  }
  async function elimina() {
    if (!confirm(`Eliminare la cabina ${cabina.numero} e le sue ${cabina.targhe.length} targhe?`)) return;
    const r = await api.eliminaCabina(token, cabina.numero);
    if (r.ok) onChange();
  }

  return (
    <div className="ana-card">
      <div className="ana-card-head">
        <span className="ana-cab">
          {cabina.numero.startsWith('VIP ') && '⭐ '}{nomeVisibile(cabina.numero)}
        </span>
        <div className="ana-posti">
          <button onClick={() => setP(posti - 1)} disabled={posti <= 1}>−</button>
          <span>{posti} <small>{posti === 1 ? 'ingresso' : 'ingressi'}</small></span>
          <button onClick={() => setP(posti + 1)}>+</button>
        </div>
        <button className="ana-del" onClick={elimina} title="Elimina cabina">🗑</button>
      </div>
      <div className="ana-targhe">
        {cabina.targhe.length === 0 && <span className="muto piccolo">nessuna targa</span>}
        {cabina.targhe.map((t) => (
          <span key={t} className="ana-chip">
            {t}
            <button onClick={() => delTarga(t)} aria-label={`rimuovi ${t}`}>×</button>
          </span>
        ))}
      </div>
      <div className="ana-addtarga">
        <input
          className="ti-input"
          value={targa}
          onChange={(e) => setTarga(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && targa.trim() && addTarga()}
          placeholder="Aggiungi targa…"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="btn-ok" onClick={addTarga} disabled={!targa.trim()}>+</button>
      </div>
      {err && <div className="msg-err piccolo">{err}</div>}
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
