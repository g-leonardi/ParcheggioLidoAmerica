// Costruisce data/cabine.json dall'export CSV del Google Form iscrizioni.
//
//   node scripts/build-cabine.mjs [data/iscrizioni.csv]
//
// Mapping colonne (0-based) del foglio risposte:
//   F(5)=Cognome/nome  G(6)+H(7)=identificativo cabina  K(10)/L(11)/M(12)=abbonamenti
// Il foglio è MISTO: a volte col6="G" col7="18", a volte col6="4G" col7="", più casi
// sporchi ("103 G", "129 gialla", "G58", "Cabina 124", "11 bianco =B").
// Settori: G = gialla, B = bianca. Cabina normalizzata a NUMERO+LETTERA (es. "18G", "83B").
// Posti = 2 di default. Targhe estratte/normalizzate/UNITE per cabina. Resto in anomalie.txt.

import fs from 'node:fs';

const CSV_PATH = process.argv[2] || 'data/iscrizioni.csv';
const OUT_JSON = 'data/cabine.json';
const OUT_REPORT = 'data/anomalie.txt';

const COL = { nome: 5, c6: 6, c7: 7, abb: [10, 11, 12] };
const POSTI_DEFAULT = 2;
const SETTORI_VALIDI = new Set(['G', 'B']); // gialla / bianca

// Estrae numero+settore da col6/col7 in qualunque formato.
function parseCabina(c6, c7) {
  const raw = `${c6} ${c7}`.trim();
  const low = raw.toLowerCase();
  const numMatch = raw.match(/\d+/);
  let settore = null;
  if (/giall/.test(low)) settore = 'G';
  else if (/bianc/.test(low)) settore = 'B';
  else {
    // togli parole che contengono lettere-settore spurie (CABINA ha 'B', LATO/NR rumore)
    const cleaned = raw.toUpperCase().replace(/CABINA|LATO|\bNR\b/g, ' ');
    const m = cleaned.match(/[GBCSO]/);
    if (m) settore = m[0];
  }
  if (!numMatch || !settore) return { ok: false, raw };
  return { ok: true, cabina: numMatch[0] + settore, settore, numero: +numMatch[0], raw };
}

// --- CSV parser quote-aware (gestisce virgole/newline dentro i campi quotati) ---
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// --- Estrazione targhe da una cella scritta in modo irregolare ---
// Pattern targhe italiane (in ordine di priorità per lo scan greedy):
const PLATE_PATTERNS = [
  /^[A-Z]{2}\d{3}[A-Z]{2}/,   // auto attuale: AA000AA
  /^[A-Z]{3}\d{4,6}/,         // vecchia provincia 3 lettere: CTA21820
  /^[A-Z]{2}\d{5}/,           // moto: AA00000
];

function extractPlates(cell, dubbie) {
  if (!cell) return [];
  const out = [];
  // separatori "forti": / , ; - . : ( ) e a-capo; lo spazio NO (alcune targhe hanno spazi interni)
  const chunks = cell.toUpperCase().split(/[\/,;.:()\n]|(?:\s-\s)|(?:-)/);
  for (const raw of chunks) {
    const cand = raw.replace(/[^A-Z0-9]/g, ''); // togli spazi/simboli residui
    if (!cand) continue;
    let i = 0, residue = '';
    while (i < cand.length) {
      let m = null;
      for (const p of PLATE_PATTERNS) { m = cand.slice(i).match(p); if (m) break; }
      if (m) { out.push(m[0]); i += m[0].length; }
      else { residue += cand[i]; i++; }
    }
    if (residue.length >= 3) dubbie.push(residue);
  }
  return out;
}

// --- Main ---
if (!fs.existsSync(CSV_PATH)) {
  console.error(`✗ File non trovato: ${CSV_PATH}\n  Esporta il foglio Google come CSV e salvalo lì (o passa il path come argomento).`);
  process.exit(1);
}

const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
// salta l'header se la prima cella non sembra una data
const start = /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test((rows[0]?.[0] || '').trim()) ? 0 : 1;

const cabine = {};            // numero -> Set(targhe)
const report = [];            // righe di anomalie
let nRows = 0, nPlate = 0;

for (let r = start; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.every((c) => !c.trim())) continue;
  nRows++;
  const nome = (row[COL.nome] || '').trim();
  const c6 = (row[COL.c6] || '').trim();
  const c7 = (row[COL.c7] || '').trim();
  const pc = parseCabina(c6, c7);

  if (!pc.ok) {
    report.push(`RIGA ${r + 1} — cabina non riconosciuta (col6="${c6}" col7="${c7}") [${nome}] → SALTATA`);
    continue;
  }
  // Settore non gialla/bianca → quasi sempre refuso: segnala e salta (lo aggiungi a mano se reale).
  if (!SETTORI_VALIDI.has(pc.settore)) {
    report.push(`RIGA ${r + 1} — settore "${pc.settore}" non G/B (col6="${c6}" col7="${c7}") [${nome}] → SALTATA, verifica`);
    continue;
  }
  const cabina = pc.cabina;
  if (pc.numero > 180 || pc.numero < 1) report.push(`RIGA ${r + 1} — numero insolito ${cabina} [${nome}], verifica`);
  // Segnala solo le interpretazioni NON banali (non il semplice riordino lettera/numero o nome-colore).
  const formaPulita = /^([GBCSO]\s*\d+|\d+\s*[GBCSO]|\d+\s*(gialla|bianca|giallo|bianco)|(gialla|bianca|giallo|bianco)\s*\d+)$/i;
  if (!formaPulita.test(pc.raw)) report.push(`RIGA ${r + 1} — "${pc.raw}" → interpretato ${cabina} [${nome}], verifica`);

  const dubbie = [];
  const plates = [];
  for (const ci of COL.abb) plates.push(...extractPlates(row[ci] || '', dubbie));

  if (!cabine[cabina]) cabine[cabina] = new Set();
  for (const p of plates) cabine[cabina].add(p);

  if (dubbie.length) report.push(`RIGA ${r + 1} — ${cabina} [${nome}] testo non interpretato come targa: ${dubbie.join(' | ')}`);
  if (plates.length === 0) report.push(`RIGA ${r + 1} — ${cabina} [${nome}] NESSUNA targa estratta`);
  nPlate += plates.length;
}

// Una targa = una cabina (è PRIMARY KEY). Se compare su più cabine la ESCLUDO da tutte
// e la segnalo: va riassegnata a mano (altrimenti il seed fallirebbe per vincolo UNIQUE).
const targaCabine = new Map();
for (const [cab, set] of Object.entries(cabine))
  for (const t of set) (targaCabine.get(t) || targaCabine.set(t, []).get(t)).push(cab);
for (const [t, cabs] of targaCabine) {
  if (cabs.length > 1) {
    for (const cab of cabs) cabine[cab].delete(t);
    report.push(`CONFLITTO — targa ${t} su più cabine (${cabs.join(', ')}): ESCLUSA, riassegnala nell'editor`);
  }
}

// Oggetto finale ordinato per settore poi numero (es. 1B, 2B, … poi 4G, 5G…).
const out = {};
const keys = Object.keys(cabine).sort((a, b) => {
  const sa = a.replace(/^\d+/, ''), sb = b.replace(/^\d+/, '');
  const na = parseInt(a, 10), nb = parseInt(b, 10);
  return sa !== sb ? sa.localeCompare(sb) : na - nb;
});
for (const k of keys) out[k] = { posti: POSTI_DEFAULT, targhe: [...cabine[k]] };

fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(OUT_REPORT, report.join('\n') + '\n');

const totTarghe = keys.reduce((s, k) => s + out[k].targhe.length, 0);
console.log(`✓ ${OUT_JSON}: ${keys.length} cabine, ${totTarghe} targhe uniche (da ${nRows} righe, ${nPlate} targhe lette).`);
console.log(`  Report anomalie: ${OUT_REPORT} (${report.length} note da rivedere).`);
