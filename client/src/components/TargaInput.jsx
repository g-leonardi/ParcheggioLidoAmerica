import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Campo targa con autocomplete (anti-fila): suggerisce le targhe dell'anagrafica
// già dalle prime lettere/cifre; tap sul suggerimento → cabina trovata in un colpo.
export default function TargaInput({ value, onChange, onPick }) {
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSugg([]);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await api.suggerisci(q);
      setSugg(r.suggerimenti || []);
      setOpen(true);
    }, 180); // debounce
    return () => clearTimeout(timer.current);
  }, [value]);

  return (
    <div className="ti">
      <input
        className="ti-input"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="AA123BB"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      {open && sugg.length > 0 && (
        <ul className="ti-list">
          {sugg.map((s) => (
            <li key={s.targa}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(s.targa);
                }}
              >
                <span className="ti-targa">{s.targa}</span>
                <span className="ti-cabina">cabina {s.cabina}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
