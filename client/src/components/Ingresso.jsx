import { useRef, useState } from 'react';
import { api } from '../api.js';
import { preparaFoto } from '../foto.js';
import TargaInput from './TargaInput.jsx';

// Esiti del lookup → aspetto e azione possibile dallo schermo grande.
const ESITI = {
  verde:       { cls: 'verde',  titolo: 'ENTRA',                 azione: 'ingresso' },
  rosso:       { cls: 'rosso',  titolo: 'PARCHEGGIO PIENO',      azione: null },
  gia_dentro:  { cls: 'ambra',  titolo: 'GIÀ DENTRO',            azione: 'uscita' },
  sconosciuta: { cls: 'grigio', titolo: 'TARGA NON REGISTRATA',  azione: null },
};

// Diagnostica latenza ALPR. Attivala sul telefono di prova aprendo l'app con
//   ?debug=1   (resta attiva finché non apri con ?debug=0)
// Mostra il dettaglio dei tempi (prep, peso foto, upload, cloud) sotto l'esito,
// così si vede sul campo dove vanno i 7 secondi. Gli operatori non la vedono.
const DEBUG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === '1') localStorage.setItem('parcheggio.debug', '1');
    if (q === '0') localStorage.removeItem('parcheggio.debug');
    return localStorage.getItem('parcheggio.debug') === '1';
  } catch { return false; }
})();

// fase = 'home' | 'ocr' | 'manuale' | 'lookup' | 'fatto'
export default function Ingresso() {
  const [fase, setFase] = useState('home');
  const [targa, setTarga] = useState('');
  const [esito, setEsito] = useState(null);
  const [risultato, setRisultato] = useState(null);   // { azione: 'ingresso'|'uscita', targa, cabina }
  const [errMsg, setErrMsg] = useState('');           // OCR fallito o server non raggiungibile
  const [confidenza, setConfidenza] = useState(null); // per badge informativo
  const [diag, setDiag] = useState('');               // riga tempi (solo se DEBUG)
  const fileRef = useRef(null);

  function reset() {
    setFase('home');
    setTarga('');
    setEsito(null);
    setRisultato(null);
    setErrMsg('');
    setConfidenza(null);
    setDiag('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function controlla(t) {
    const tt = (t || '').trim();
    if (!tt) return;
    let r;
    try {
      r = await api.lookup(tt);
    } catch {
      // Server non raggiungibile: errore esplicito, MAI fallire in silenzio.
      setErrMsg(SERVER_GIU);
      setFase('manuale');
      return;
    }
    setErrMsg('');
    setEsito(r);
    setFase('lookup');
  }

  // Scatto foto → ALPR → se ok salta direttamente al lookup, altrimenti pannello manuale.
  async function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFase('ocr');
    setErrMsg('');
    setConfidenza(null);
    // Normalizza (resize + orientamento + ricompressione) per non mandare all'ANPR
    // foto giganti/ruotate dei telefoni vecchi → meno "nessuna targa".
    const tPrep = performance.now();
    const foto = await preparaFoto(file);
    const msPrep = Math.round(performance.now() - tPrep);
    const kb = Math.round((foto.size || file.size) / 1024);

    const tNet = performance.now();
    const r = await api.alpr(foto).catch(() => ({ ok: false, motivo: 'errore_rete' }));
    const msNet = Math.round(performance.now() - tNet);
    if (DEBUG) {
      // msNet = upload + parsing server + cloud + risposta. msProvider = solo cloud.
      // Quindi upload telefono→server ≈ msNet − msProvider (la tratta ballerina).
      const cloud = r.msProvider ?? 0;
      setDiag(`prep ${msPrep}ms · foto ${kb}KB · upload ~${Math.max(0, msNet - cloud)}ms · cloud ${cloud}ms · totale ${msPrep + msNet}ms`);
    }
    if (r.ok && r.targa && !r.sottoSoglia) {
      setConfidenza(r.confidenza);
      setTarga(r.targa);
      await controlla(r.targa);
      return;
    }
    // OCR non sufficiente: pannello manuale con messaggio. Se sotto soglia, pre-compila.
    if (r.ok && r.targa && r.sottoSoglia) {
      setTarga(r.targa);
      setConfidenza(r.confidenza);
      setErrMsg(`Targa poco leggibile (confidenza ${Math.round(r.confidenza * 100)}%). Verifica e correggi.`);
    } else if (r.ok && !r.targa) {
      setErrMsg('Nessuna targa nella foto.');
    } else {
      setErrMsg(motivoLeggibile(r.motivo));
    }
    setFase('manuale');
  }

  async function conferma() {
    const cfg = ESITI[esito.decisione];
    const t = esito.targa;
    let r;
    try {
      r = cfg.azione === 'ingresso' ? await api.ingresso(t) : await api.uscita(t);
    } catch {
      setErrMsg(`${SERVER_GIU} L'operazione NON è stata registrata.`);
      setFase('manuale');
      return;
    }
    if (r.ok) {
      setRisultato({ azione: cfg.azione, targa: t, cabina: r.cabina });
      setFase('fatto');
    } else {
      // Stato cambiato fra lookup e conferma (es. cabina riempita da un altro operatore).
      const dec = r.motivo === 'pieno' ? 'rosso' : r.motivo === 'gia_dentro' ? 'gia_dentro' : 'sconosciuta';
      setEsito({ ...esito, decisione: dec });
    }
  }

  // ----- render -----

  if (fase === 'fatto') {
    const verbo = risultato.azione === 'ingresso' ? 'ENTRATO' : 'USCITO';
    return (
      <div className="schermo verde">
        <div className="big">✓ {verbo}</div>
        <div className="sub">{risultato.targa} · cabina {risultato.cabina}</div>
        <button className="btn-grande" onClick={reset}>Prossima auto →</button>
      </div>
    );
  }

  if (fase === 'lookup' && esito) {
    const cfg = ESITI[esito.decisione] || ESITI.sconosciuta;
    const labelConferma = cfg.azione === 'ingresso' ? 'CONFERMA INGRESSO' : 'CONFERMA USCITA';
    return (
      <div className={`schermo ${cfg.cls}`}>
        <div className="big">{cfg.titolo}</div>
        <div className="sub">
          {esito.targa}{esito.cabina ? ` · cabina ${esito.cabina}` : ''}
        </div>
        {esito.stato === 'trovata' && (
          <div className="posti">{esito.occupati}/{esito.posti} posti occupati</div>
        )}
        {confidenza != null && (
          <div className="ocr-mini">📷 letta dalla foto · {Math.round(confidenza * 100)}%</div>
        )}
        {DEBUG && diag && <div className="ocr-mini" style={{ opacity: 0.7 }}>⏱ {diag}</div>}
        {cfg.azione ? (
          <>
            <button className="btn-grande conferma" onClick={conferma}>{labelConferma}</button>
            <button className="btn-testo" onClick={reset}>Annulla</button>
          </>
        ) : (
          <button className="btn-grande" onClick={reset}>← Indietro</button>
        )}
      </div>
    );
  }

  if (fase === 'ocr') {
    return (
      <div className="schermo grigio">
        <div className="big">📷</div>
        <div className="sub">Riconoscimento targa…</div>
      </div>
    );
  }

  if (fase === 'manuale') {
    return (
      <div className="pannello">
        <h2>Inserimento manuale</h2>
        {errMsg && <div className="errore">{errMsg}</div>}
        {DEBUG && diag && <div className="ocr-mini" style={{ opacity: 0.7 }}>⏱ {diag}</div>}
        <TargaInput
          value={targa}
          onChange={setTarga}
          onPick={(t) => { setTarga(t); controlla(t); }}
        />
        <button className="btn-grande" onClick={() => controlla(targa)}>CONTROLLA</button>
        <button className="btn-testo" onClick={reset}>{errMsg ? '← Riscatta foto' : '← Indietro'}</button>
      </div>
    );
  }

  // fase === 'home' — solo foto.
  return (
    <div className="schermo-foto">
      <button className="btn-foto-hero" onClick={() => fileRef.current?.click()}>
        <span className="foto-glow" aria-hidden="true" />
        <svg className="foto-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          {/* corpo camera */}
          <rect x="6" y="18" width="52" height="36" rx="8" stroke="currentColor" strokeWidth="3" />
          {/* hump del mirino */}
          <path d="M22 18l3-6h14l3 6" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          {/* lente esterna */}
          <circle cx="32" cy="38" r="11" stroke="currentColor" strokeWidth="3" />
          {/* lente interna (riflesso) */}
          <circle cx="32" cy="38" r="5" fill="currentColor" />
          {/* flash LED */}
          <circle cx="48" cy="26" r="1.8" fill="currentColor" />
        </svg>
        <span className="foto-label">Scatta foto targa</span>
        <span className="foto-sublabel">Inquadra la targa nel riquadro</span>
      </button>
      <button className="btn-testo" onClick={() => setFase('manuale')}>
        Inserisci a mano
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onFoto}
      />
    </div>
  );
}

// Distinto dai fallimenti OCR: qui è l'app che non raggiunge il NOSTRO server.
const SERVER_GIU = 'Server non raggiungibile — controlla la connessione e riprova.';

function motivoLeggibile(m) {
  switch (m) {
    case 'alpr_non_configurato': return 'Riconoscimento foto non attivo — inserisci la targa a mano.';
    case 'nessuna_targa':        return 'Nessuna targa leggibile nella foto.';
    case 'foto_mancante':        return 'Foto non ricevuta.';
    case 'foto_troppo_grande':   return 'Foto troppo grande — riprova (verrà ridotta in automatico).';
    case 'alpr_rete':            return 'Problema di rete con il riconoscimento.';
    case 'alpr_errore':          return 'Errore del servizio di riconoscimento.';
    case 'errore_rete':          return `${SERVER_GIU} (La targa si può comunque scrivere a mano quando torna la linea.)`;
    default:                     return 'Riconoscimento non riuscito.';
  }
}
