import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Grafico from './Grafico.jsx';

// Catalogo metriche con i tipi di grafico sensati per ciascuna (lato server
// l'elenco è in grafici.js: tenere allineato). 'tipi[0]' = default.
const METRICHE = [
  { key: 'ingressi_giorno', label: 'Ingressi per giorno', tipi: ['linea', 'barre', 'punti'] },
  { key: 'occupazione_giorno', label: 'Occupazione massima per giorno', tipi: ['linea', 'barre', 'punti'] },
  { key: 'ingressi_ora', label: 'Ingressi per fascia oraria', tipi: ['barre', 'punti', 'linea'] },
  { key: 'ingressi_categoria', label: 'Ingressi per categoria', tipi: ['torta', 'barre'] },
  { key: 'ingressi_operatore', label: 'Ingressi per operatore', tipi: ['torta', 'barre'] },
];
const TIPO_LABEL = { linea: 'Linea', barre: 'Barre', punti: 'Punti', torta: 'Torta' };

const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
function menoGiorni(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

export default function Grafici({ token, onAuthFail }) {
  const [grafici, setGrafici] = useState(null);
  const [wizard, setWizard] = useState(false);

  async function carica() {
    const r = await api.grafici(token);
    if (r.grafici) setGrafici(r.grafici);
    else onAuthFail();
  }
  useEffect(() => { carica(); }, []);

  async function elimina(id) {
    if (!confirm('Eliminare questo grafico dalla dashboard?')) return;
    await api.eliminaGrafico(token, id);
    carica();
  }

  if (!grafici) return <div className="pannello"><p className="muto">…</p></div>;

  return (
    <div className="pannello">
      <div className="ana-head">
        <div>
          <h2>Dashboard</h2>
          <div className="muto piccolo">{grafici.length} {grafici.length === 1 ? 'grafico' : 'grafici'}</div>
        </div>
        <button className="ana-nuova-btn" onClick={() => setWizard(true)}>+ Nuovo</button>
      </div>

      {grafici.length === 0 ? (
        <p className="muto">Nessun grafico. Tocca “+ Nuovo” per costruire la tua dashboard.</p>
      ) : (
        <div className="g-dashboard">
          {grafici.map((g) => (
            <div key={g.id} className="g-card">
              <div className="g-card-head">
                <b>{g.titolo}</b>
                <button className="ana-del" onClick={() => elimina(g.id)} title="Elimina grafico">🗑</button>
              </div>
              <Grafico tipo={g.tipo} dati={g.dati} />
            </div>
          ))}
        </div>
      )}

      {wizard && (
        <WizardGrafico
          token={token}
          onChiudi={() => setWizard(false)}
          onCreato={() => { setWizard(false); carica(); }}
        />
      )}
    </div>
  );
}

function WizardGrafico({ token, onChiudi, onCreato }) {
  const [metrica, setMetrica] = useState(METRICHE[0].key);
  const [tipo, setTipo] = useState(METRICHE[0].tipi[0]);
  const [da, setDa] = useState(menoGiorni(29));
  const [a, setA] = useState(oggi());
  const [titolo, setTitolo] = useState('');
  const [anteprima, setAnteprima] = useState(null);
  const [busy, setBusy] = useState(false);

  const metaM = METRICHE.find((m) => m.key === metrica);

  function cambiaMetrica(k) {
    setMetrica(k);
    const m = METRICHE.find((x) => x.key === k);
    if (!m.tipi.includes(tipo)) setTipo(m.tipi[0]); // riallinea il tipo se incompatibile
  }

  // Anteprima dati: dipende solo da metrica + intervallo (il tipo è solo resa).
  useEffect(() => {
    let vivo = true;
    setAnteprima(null);
    api.graficoDati(token, { metrica, da, a }).then((r) => { if (vivo) setAnteprima(r.dati); });
    return () => { vivo = false; };
  }, [metrica, da, a]);

  async function salva() {
    setBusy(true);
    const r = await api.creaGrafico(token, { tipo, titolo, config: { metrica, da, a } });
    setBusy(false);
    if (r.ok) onCreato();
  }

  return (
    <div className="sheet-overlay" onClick={onChiudi}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nuovo grafico">
        <div className="sheet-head">
          <h3>Nuovo grafico</h3>
          <button className="sheet-chiudi" onClick={onChiudi} aria-label="Chiudi">×</button>
        </div>

        <label className="sheet-label">Cosa misurare</label>
        <select className="ti-input" value={metrica} onChange={(e) => cambiaMetrica(e.target.value)}>
          {METRICHE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>

        <label className="sheet-label">Tipo di grafico</label>
        <div className="g-tipi">
          {metaM.tipi.map((t) => (
            <button key={t} className={`g-tipo ${tipo === t ? 'attivo' : ''}`} onClick={() => setTipo(t)}>
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>

        <label className="sheet-label">Periodo</label>
        <div className="g-periodo">
          <input type="date" className="ti-input" value={da} max={a} onChange={(e) => setDa(e.target.value)} />
          <span aria-hidden="true">→</span>
          <input type="date" className="ti-input" value={a} min={da} max={oggi()} onChange={(e) => setA(e.target.value)} />
        </div>

        <label className="sheet-label">Titolo (opzionale)</label>
        <input
          className="ti-input"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          placeholder={metaM.label}
        />

        <div className="g-anteprima">
          {anteprima ? <Grafico tipo={tipo} dati={anteprima} /> : <div className="g-vuoto">…</div>}
        </div>

        <button className="btn-grande" onClick={salva} disabled={busy}>
          {busy ? 'Salvataggio…' : 'AGGIUNGI ALLA DASHBOARD'}
        </button>
      </div>
    </div>
  );
}
