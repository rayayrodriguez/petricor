// Compartir el tiempo: una imagen con el cielo de este momento (nubes, lluvia y gotas en el cristal
// incluidas) y los datos principales, más un texto con lo mismo. Se monta de golpe, sin esperas,
// porque el iPhone solo deja abrir el menú de compartir justo después del toque.

const ANCHO = 1080, ALTO = 1350; // 4:5, lo que mejor se ve en WhatsApp e Instagram

const texto = (sel) => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();

// Parte un texto en líneas que quepan en un ancho
function lineas(g, t, ancho) {
  const palabras = t.split(' '), res = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (g.measureText(prueba).width > ancho && linea) { res.push(linea); linea = p; } else linea = prueba;
  }
  if (linea) res.push(linea);
  return res;
}

function sombraTexto(g, fuerza = 1) {
  g.shadowColor = `rgba(0,0,0,${0.35 * fuerza})`; g.shadowBlur = 18 * fuerza; g.shadowOffsetY = 2;
}

export function imagenTiempo(cielo) {
  const c = document.createElement('canvas');
  c.width = ANCHO; c.height = ALTO;
  const g = c.getContext('2d');
  // El cielo de ahora: se pinta un fotograma para que el agua del cristal esté en su lienzo
  try { cielo.dibujar(0); } catch (e) { /* si falla, se usa lo último pintado */ }
  const fuente = cielo.c, sw = fuente.width, sh = Math.min(fuente.height, sw * (ALTO / ANCHO));
  g.fillStyle = '#20283a'; g.fillRect(0, 0, ANCHO, ALTO);
  g.drawImage(fuente, 0, 0, sw, sh, 0, 0, ANCHO, ALTO);
  if (cielo.agua && !cielo.agua.perdido && cielo.cristalActivo) {
    const a = cielo.agua.c, k = a.width / sw;
    g.drawImage(a, 0, 0, a.width, sh * k, 0, 0, ANCHO, ALTO);
  }
  // Velo suave arriba y abajo para que el texto se lea sobre cualquier cielo
  const velo = g.createLinearGradient(0, 0, 0, ALTO);
  velo.addColorStop(0, 'rgba(10,14,24,0.28)'); velo.addColorStop(0.45, 'rgba(10,14,24,0.08)'); velo.addColorStop(0.75, 'rgba(10,14,24,0.22)'); velo.addColorStop(1, 'rgba(10,14,24,0.6)');
  g.fillStyle = velo; g.fillRect(0, 0, ANCHO, ALTO);

  const display = "'Bricolage Grotesque', 'Avenir Next', 'Helvetica Neue', sans-serif", cuerpo = "'Inter', -apple-system, 'Helvetica Neue', sans-serif";
  g.textAlign = 'center'; g.fillStyle = '#fff';
  sombraTexto(g);
  g.font = `600 44px ${display}`;
  if ('letterSpacing' in g) g.letterSpacing = '7px';
  g.fillText(texto('#lugar-nombre').toUpperCase(), ANCHO / 2, 150);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.font = `400 30px ${cuerpo}`; g.fillStyle = 'rgba(255,255,255,0.82)';
  g.fillText(texto('#hora-local'), ANCHO / 2, 200);
  g.fillStyle = '#fff';
  g.font = `200 300px ${display}`;
  g.fillText(texto('#temp-ahora'), ANCHO / 2 + 30, 500);
  g.font = `500 56px ${display}`;
  g.fillText(texto('#estado-ahora'), ANCHO / 2, 600);
  g.font = `400 34px ${cuerpo}`; g.fillStyle = 'rgba(255,255,255,0.88)';
  g.fillText(texto('#extremos'), ANCHO / 2, 662);
  g.fillStyle = '#fff'; g.font = `500 44px ${display}`;
  const frase = lineas(g, texto('#frase'), 860).slice(0, 4);
  frase.forEach((l, i) => g.fillText(l, ANCHO / 2, 790 + i * 58));
  // Firma
  sombraTexto(g, 0.6);
  g.font = `600 30px ${display}`; g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillText('Petricor', ANCHO / 2, ALTO - 70);
  return c;
}

function aArchivo(c, nombre) {
  const url = c.toDataURL('image/jpeg', 0.9), bin = atob(url.split(',')[1]), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new File([u], nombre, { type: 'image/jpeg' });
}

export function textoTiempo() {
  const partes = [`${texto('#lugar-nombre')}: ${texto('#temp-ahora')}, ${texto('#estado-ahora').toLowerCase()}.`, texto('#extremos') + '.', texto('#frase')];
  return partes.filter((p) => p && p !== '.').join(' ');
}

// Devuelve 'compartido', 'cancelado' o 'descargado'
export async function compartirTiempo(cielo) {
  const lugar = texto('#lugar-nombre') || 'tiempo';
  const archivo = aArchivo(imagenTiempo(cielo), `petricor-${lugar.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}.jpg`);
  const t = textoTiempo();
  const datos = { files: [archivo], text: t, title: `El tiempo en ${lugar}` };
  if (navigator.canShare && navigator.canShare(datos)) {
    try { await navigator.share(datos); return 'compartido'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
  }
  // Sin menú de compartir: se descarga la imagen y el texto se copia
  const a = document.createElement('a');
  a.href = URL.createObjectURL(archivo); a.download = archivo.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  try { await navigator.clipboard.writeText(t); } catch (e) { /* sin portapapeles */ }
  return 'descargado';
}
