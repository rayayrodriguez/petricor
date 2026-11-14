// Horizonte real de cada lugar, mirando al sur como el cielo de la app. Para cada dirección se
// buscan los puntos del terreno que se ven más altos. La altitud sale de los mosaicos públicos
// de relieve de AWS (Terrain Tiles, datos SRTM y otros), que se leen como imágenes: una docena
// basta para 60 km a la redonda. Se calcula una vez por lugar y se guarda en el móvil.

const MOSAICO = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const VERSION = 2;
// Acimut desde el sur, positivo hacia el oeste, como el sol y la luna
export const ACIMUTS = Array.from({ length: 121 }, (_, i) => -60 + i);
// Capas para la perspectiva atmosférica: lo cercano oscuro y nítido, lo lejano azulado
const CAPAS = [['cerca', 0, 3], ['media', 3, 12], ['lejos', 12, 99]];
const R_TIERRA = 6371000, RAD = Math.PI / 180;

export const claveHorizonte = (lugar) => `petricor.horizonte.${(+lugar.lat).toFixed(3)},${(+lugar.lon).toFixed(3)}`;
export function horizonteValido(h) { return h && h.v === VERSION && h.capas && h.capas.cerca && h.capas.cerca.length === ACIMUTS.length; }

// De grados a píxel dentro del mosaico de nivel z
function aPixel(lat, lon, z) {
  const n = 256 * 2 ** z;
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(lat * RAD) + 1 / Math.cos(lat * RAD)) / Math.PI) / 2) * n];
}

async function leerMosaico(z, x, y) {
  const r = await fetch(MOSAICO(z, x, y), { mode: 'cors' });
  if (!r.ok) throw new Error('relieve ' + r.status);
  const bmp = await createImageBitmap(await r.blob());
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, 256, 256).data, alt = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) alt[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  return alt;
}

export async function calcularHorizonte(lugar) {
  const lat = +lugar.lat, lon = +lugar.lon;
  // Puntos a muestrear: cada vez más separados con la distancia
  const dist = [];
  for (let d = 0.15; d <= 60; d = d * 1.035 + 0.04) dist.push(d);
  const zoom = (d) => (d <= 15 ? 11 : 9);
  const muestras = [];
  for (const az of ACIMUTS) {
    const rumbo = (180 + az) * RAD; // desde el norte, en el sentido de las agujas del reloj
    for (const d of dist) muestras.push([az, d, lat + (d / 111.32) * Math.cos(rumbo), lon + (d / (111.32 * Math.cos(lat * RAD))) * Math.sin(rumbo)]);
  }
  // Qué mosaicos hacen falta, y se piden de cuatro en cuatro
  const necesarios = new Map();
  const apuntar = (la, lo, z) => { const [px, py] = aPixel(la, lo, z); const k = `${z}/${Math.floor(px / 256)}/${Math.floor(py / 256)}`; necesarios.set(k, null); };
  apuntar(lat, lon, 11);
  for (const [, d, la, lo] of muestras) apuntar(la, lo, zoom(d));
  const claves = [...necesarios.keys()];
  for (let i = 0; i < claves.length; i += 4) {
    await Promise.all(claves.slice(i, i + 4).map(async (k) => { const [z, x, y] = k.split('/').map(Number); necesarios.set(k, await leerMosaico(z, x, y)); }));
  }
  const altura = (la, lo, z) => {
    const [px, py] = aPixel(la, lo, z), x = px - 0.5, y = py - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const v = (xx, yy) => necesarios.get(`${z}/${Math.floor(xx / 256)}/${Math.floor(yy / 256)}`)?.[(((yy % 256) + 256) % 256) * 256 + (((xx % 256) + 256) % 256)] ?? 0;
    return v(x0, y0) * (1 - fx) * (1 - fy) + v(x0 + 1, y0) * fx * (1 - fy) + v(x0, y0 + 1) * (1 - fx) * fy + v(x0 + 1, y0 + 1) * fx * fy;
  };
  // Los ojos, a la altura de una ventana sobre el suelo del lugar
  const h0 = (lugar.elev ?? altura(lat, lon, 11)) + 12;
  const capas = Object.fromEntries(CAPAS.map(([n]) => [n, ACIMUTS.map(() => -90)]));
  for (const [az, d, la, lo] of muestras) {
    const m = d * 1000, caida = (m * m) / (2 * R_TIERRA) * 0.87; // curvatura de la tierra y refracción
    const ang = Math.atan2(altura(la, lo, zoom(d)) - h0 - caida, m) / RAD, i = az - ACIMUTS[0];
    for (const [nombre, d0, d1] of CAPAS) if (d >= d0 && d < d1 && ang > capas[nombre][i]) capas[nombre][i] = ang;
  }
  for (const n in capas) capas[n] = capas[n].map((v) => +v.toFixed(2));
  return { v: VERSION, acimuts: ACIMUTS, capas, altura: Math.round(h0) };
}
