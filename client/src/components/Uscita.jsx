import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Uscita SENZA OCR: lista cercabile delle auto attualmente dentro, tap su "ESCI".
export default function Uscita() {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [msg, setMsg] = useState(null);
  const [errore, setErrore] = useState('');

  async function carica() {
    try {
      const r = await api.presenti();
      setLista(r.presenti || []);
      setErrore('');
    } catch {
      // Server giù: dirlo chiaro, NON mostrare "Nessuna auto dentro".
      setErrore('Server non raggiungibile — lista non aggiornata.');
    }
  }

  useEffect(() => {
    carica();
  }, []);

  async function esci(targa) {
    let r;
    try {
      r = await api.uscita(targa);
    } catch {
      setErrore(`Server non raggiungibile — uscita di ${targa} NON registrata.`);
      return;
    }
    if (r.ok) {
      setMsg(`${targa} uscita · cabina ${r.cabina} ora ${r.occupati}/${r.posti}`);
      setErrore('');
      carica();
    }
  }

  const f = filtro.toUpperCase();
  const visibili = lista.filter((p) => p.targa.includes(f) || p.cabina.includes(f));

  return (
    <div className="pannello">
      <h2>Uscita</h2>
      <input
        className="ti-input"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Cerca targa o cabina"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
      />
      {msg && <div className="msg-ok">{msg}</div>}
      {errore && <div className="errore">{errore}</div>}
      {visibili.length === 0 ? (
        !errore && <p className="vuoto">Nessuna auto dentro.</p>
      ) : (
        <ul className="lista-uscita">
          {visibili.map((p) => (
            <li key={p.targa}>
              <div>
                <b>{p.targa}</b>
                <span className="ti-cabina">cabina {p.cabina}</span>
              </div>
              <button className="btn-esci" onClick={() => esci(p.targa)}>
                ESCI
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
