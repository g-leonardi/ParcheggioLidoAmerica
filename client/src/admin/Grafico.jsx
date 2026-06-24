// Renderer grafici in SVG puro (niente librerie): linea, barre, punti, torta.
// Riceve dati normalizzati { punti: [{ x, y }] } dal server.

const PALETTE = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

// "2026-06-24" -> "24/6"; altri valori (ore, categorie) restano com'è.
function fmtX(x) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x));
  return m ? `${+m[3]}/${+m[2]}` : String(x);
}

export default function Grafico({ tipo, dati }) {
  const punti = dati?.punti || [];
  const totale = punti.reduce((s, p) => s + p.y, 0);
  if (punti.length === 0 || totale === 0) {
    return <div className="g-vuoto">Nessun dato nel periodo.</div>;
  }
  if (tipo === 'torta') return <Torta punti={punti} />;
  return <Assi tipo={tipo} punti={punti} />;
}

function Assi({ tipo, punti }) {
  const W = 320, H = 180, padL = 30, padR = 10, padT = 12, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = punti.length;
  const maxY = Math.max(1, ...punti.map((p) => p.y));
  const yPos = (v) => padT + innerH - (v / maxY) * innerH;
  const xLine = (i) => padL + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const slot = innerW / n;

  // Etichette x sparse: al massimo ~6, sempre prima e ultima.
  const step = Math.max(1, Math.ceil(n / 6));
  const mostraX = (i) => i === 0 || i === n - 1 || i % step === 0;

  return (
    <svg className="g-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      {/* asse y: 0 e max */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} className="g-asse" />
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} className="g-asse" />
      <text x={padL - 4} y={padT + 4} className="g-tick" textAnchor="end">{maxY}</text>
      <text x={padL - 4} y={padT + innerH} className="g-tick" textAnchor="end">0</text>

      {tipo === 'barre' && punti.map((p, i) => {
        const h = (p.y / maxY) * innerH;
        return <rect key={i} x={padL + i * slot + slot * 0.15} y={padT + innerH - h}
          width={slot * 0.7} height={h} rx="2" fill={PALETTE[0]} />;
      })}

      {tipo === 'linea' && (
        <polyline className="g-linea" points={punti.map((p, i) => `${xLine(i)},${yPos(p.y)}`).join(' ')} />
      )}

      {(tipo === 'linea' || tipo === 'punti') && punti.map((p, i) => (
        <circle key={i} cx={xLine(i)} cy={yPos(p.y)} r={tipo === 'punti' ? 3.5 : 2.5} fill={PALETTE[0]} />
      ))}

      {punti.map((p, i) => mostraX(i) && (
        <text key={i} x={tipo === 'barre' ? padL + i * slot + slot / 2 : xLine(i)}
          y={H - 8} className="g-tick" textAnchor="middle">{fmtX(p.x)}</text>
      ))}
    </svg>
  );
}

function Torta({ punti }) {
  const dati = [...punti].sort((a, b) => b.y - a.y);
  const totale = dati.reduce((s, p) => s + p.y, 0);
  const cx = 70, cy = 70, r = 60;
  let ang = -Math.PI / 2;

  return (
    <div className="g-torta">
      <svg viewBox="0 0 140 140" className="g-torta-svg" role="img">
        {dati.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={PALETTE[0]} />
        ) : dati.map((p, i) => {
          const a0 = ang;
          const a1 = ang + (p.y / totale) * 2 * Math.PI;
          ang = a1;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          const large = a1 - a0 > Math.PI ? 1 : 0;
          return <path key={i} d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
            fill={PALETTE[i % PALETTE.length]} />;
        })}
      </svg>
      <ul className="g-legenda">
        {dati.map((p, i) => (
          <li key={i}>
            <span className="g-pallino" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="g-leg-label">{p.x}</span>
            <span className="g-leg-val">{p.y} · {Math.round((p.y / totale) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
