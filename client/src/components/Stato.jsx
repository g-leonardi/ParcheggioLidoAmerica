import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Colpo d'occhio sull'occupazione di tutte le cabine (es. 25B 2/2).
// Toccando una cabina si vedono le targhe attualmente dentro.
export default function Stato() {
  const [cabine, setCabine] = useState([]);
  const [presenti, setPresenti] = useState([]);
  const [sel, setSel] = useState(null);

  async function carica() {
    const [o, p] = await Promise.all([api.occupazione(), api.presenti()]);
    setCabine(o.cabine || []);
    setPresenti(p.presenti || []);
  }

  useEffect(() => {
    carica();
  }, []);

  const dentro = sel ? presenti.filter((p) => p.cabina === sel).map((p) => p.targa) : [];

  return (
    <div className="pannello">
      <h2>Stato cabine</h2>
      <div className="griglia">
        {cabine.map((c) => (
          <button
            key={c.cabina}
            className={`cella ${c.disponibili <= 0 ? 'rosso' : 'verde'} ${sel === c.cabina ? 'sel' : ''}`}
            onClick={() => setSel(sel === c.cabina ? null : c.cabina)}
          >
            <div className="cella-num">{c.cabina}</div>
            <div className="cella-posti">
              {c.occupati}/{c.posti}
            </div>
          </button>
        ))}
      </div>

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
