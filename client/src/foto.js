// Normalizza la foto PRIMA di mandarla all'ANPR.
//
// Perché serve: i telefoni vecchi scattano JPEG enormi (6-12 MP, spesso 4-8 MB)
// e a volte ruotati via EXIF. Il file grezzo (a) supera il limite di upload del
// server → arriva troncato/corrotto, (b) può essere "di traverso". In entrambi i
// casi l'ANPR risponde "nessuna targa". Ridimensionando il lato lungo, correggendo
// l'orientamento e ricomprimendo qui, l'ANPR riceve un'immagine pulita e leggera:
// il riconoscimento sale molto, a parità di provider.
const MAX_LATO = 1600; // px sul lato lungo: abbondante per una targa, leggero da inviare
const QUALITA = 0.85; // JPEG

export async function preparaFoto(file) {
  try {
    const sorgente = await caricaImmagine(file);
    const iw = sorgente.naturalWidth || sorgente.width;
    const ih = sorgente.naturalHeight || sorgente.height;
    if (!iw || !ih) return file;

    const scala = Math.min(1, MAX_LATO / Math.max(iw, ih));
    const w = Math.round(iw * scala);
    const h = Math.round(ih * scala);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(sorgente, 0, 0, w, h);
    sorgente.close?.(); // ImageBitmap: libera memoria

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITA));
    return blob || file; // se la canvas fallisce, meglio l'originale che niente
  } catch {
    return file; // mai bloccare lo scatto: in caso di errore mando l'originale
  }
}

async function caricaImmagine(file) {
  // createImageBitmap applica l'orientamento EXIF dove supportato (Chrome/Android).
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fallback sotto */
    }
  }
  // Fallback via <img>: i browser recenti applicano l'orientamento EXIF da soli.
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
