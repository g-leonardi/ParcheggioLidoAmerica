import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Le cabine sono "numero + lettera-zona" (es. 101B bianca, 101G gialla); i numeri
// si ripetono tra zone, quindi le separiamo visivamente. Le 4 speciali (SB/SG/SI/SL)
// hanno la lettera davanti → finiscono nel gruppo "Speciali".
const ZONE = [
  { key: 'bianche', label: 'Bianche', icona: '⚪' },
  { key: 'gialle', label: 'Gialle', icona: '🟡' },
  { key: 'capannine', label: 'Capannine', icona: '🏕️' },
  { key: 'speciali', label: 'Speciali', icona: '⭐' },
];

// Estrae numero e zona da una sigla cabina, gestendo sia "101G" sia "SB".
function parseCab(cab) {
  const numFirst = cab.match(/^(\d+)([A-Za-z]*)$/);
  if (numFirst) return { num: parseInt(numFirst[1], 10), zona: numFirst[2].toUpperCase() };
  const letFirst = cab.match(/^([A-Za-z]+)(\d*)$/);
  const num = letFirst && letFirst[2] ? parseInt(letFirst[2], 10) : Infinity;
  return { num, zona: (letFirst ? letFirst[1] : cab).toUpperCase() };
}

function zonaDi(cab) {
  const { zona } = parseCab(cab);
  if (zona === 'B') return 'bianche';
  if (zona === 'G') return 'gialle';
  if (zona === 'CB' || zona === 'CG') return 'capannine'; // CB=capannina bianca, CG=gialla
  return 'speciali';
}

// Colpo d'occhio sull'occupazione di tutte le cabine (es. 101B 2/2), raggruppate
// per zona e ordinabili. Toccando una cabina si vedono le targhe attualmente dentro.
export default function Stato() {
  const [cabine, setCabine] = useState([]);
  const [presenti, setPresenti] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [ordine, setOrdine] = useState('numero'); // 'numero' (crescente) | 'occupazione'

  async function carica() {
    const [o, p] = await Promise.all([api.occupazione(), api.presenti()]);
    setCabine(o.cabine || []);
    setPresenti(p.presenti || []);
  }

  useEffect(() => {
    carica();
  }, []);

  const dentro = sel ? presenti.filter((p) => p.cabina === sel).map((p) => p.targa) : [];

  const gruppi = useMemo(() => {
    const filtro = q.trim().toUpperCase();
    const visibili = filtro
      ? cabine.filter((c) => c.cabina.toUpperCase().includes(filtro))
      : cabine;
    const cmp =
      ordine === 'occupazione'
        ? (a, b) => a.disponibili - b.disponibili || parseCab(a.cabina).num - parseCab(b.cabina).num
        : (a, b) => {
            const pa = parseCab(a.cabina);
            const pb = parseCab(b.cabina);
            // zona-prima poi numero: dentro un gruppo monocolore equivale all'ordine
            // numerico; nelle Capannine/Speciali tiene insieme i colori (CB… poi CG…).
            return (
              pa.zona.localeCompare(pb.zona) || pa.num - pb.num || a.cabina.localeCompare(b.cabina)
            );
          };
    return ZONE.map((z) => ({
      ...z,
      celle: visibili.filter((c) => zonaDi(c.cabina) === z.key).sort(cmp),
    })).filter((g) => g.celle.length > 0);
  }, [cabine, q, ordine]);

  const totVisibili = gruppi.reduce((n, g) => n + g.celle.length, 0);

  return (
    <div className="pannello">
      <h2>Stato cabine</h2>

      <div className="stato-toolbar">
        <input
          className="ti-input cerca stato-cerca"
          inputMode="numeric"
          placeholder="Cerca cabina…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="stato-ordina" role="group" aria-label="Ordinamento">
          <button
            className={ordine === 'numero' ? 'attivo' : ''}
            onClick={() => setOrdine('numero')}
          >
            N°
          </button>
          <button
            className={ordine === 'occupazione' ? 'attivo' : ''}
            onClick={() => setOrdine('occupazione')}
          >
            Pieni
          </button>
        </div>
      </div>

      {q.trim() && <p className="ricerca-info">{totVisibili} cabine trovate</p>}

      {gruppi.length === 0 ? (
        <p className="vuoto">Nessuna cabina trovata.</p>
      ) : (
        gruppi.map((g) => (
          <section key={g.key} className="zona">
            <h3 className="zona-head">
              <span aria-hidden="true">{g.icona}</span> {g.label}
              <span className="zona-count">{g.celle.length}</span>
            </h3>
            <div className="griglia">
              {g.celle.map((c) => (
                <button
                  key={c.cabina}
                  className={`cella ${c.disponibili <= 0 ? 'rosso' : 'verde'} ${
                    sel === c.cabina ? 'sel' : ''
                  }`}
                  onClick={() => setSel(sel === c.cabina ? null : c.cabina)}
                >
                  <div className="cella-num">{c.cabina}</div>
                  <div className="cella-posti">
                    {c.occupati}/{c.posti}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {sel && (
        <div className="dettaglio-cabina">
          <h3>Cabina {sel} · dentro ora</h3>
          {dentro.length === 0 ? (
            <p className="muto">Nessuna auto dentro.</p>
          ) : (
            <ul className="targhe-dentro">
              {dentro.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
