// Smoke test isolato per Plate Recognizer.
// Uso: ALPR_API_KEY=xxx node test-alpr.js path/to/foto.jpg
// Niente Fastify, niente DB: chiama direttamente PR e stampa la risposta cruda.
import { readFile } from 'node:fs/promises';

const key = process.env.ALPR_API_KEY;
const url = process.env.ALPR_URL || 'https://api.platerecognizer.com/v1/plate-reader/';
const regions = process.env.ALPR_REGIONS || 'it';
const file = process.argv[2];

if (!key) { console.error('manca ALPR_API_KEY'); process.exit(1); }
if (!file) { console.error('uso: node test-alpr.js path/to/foto.jpg'); process.exit(1); }

const buf = await readFile(file);
console.log(`→ ${url}  (${buf.length} byte, regions=${regions})`);

const form = new FormData();
form.append('upload', new Blob([buf], { type: 'image/jpeg' }), 'plate.jpg');
form.append('regions', regions);

const t0 = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Token ${key}` },
  body: form,
});
const ms = Date.now() - t0;

console.log(`← HTTP ${res.status}  (${ms}ms)`);
const text = await res.text();
try {
  const data = JSON.parse(text);
  console.log(JSON.stringify(data, null, 2));
  const first = data?.results?.[0];
  if (first) console.log(`\nTARGA: ${first.plate}  score=${first.score}`);
} catch {
  console.log(text);
}
