// Fondo animado: el cielo se dibuja según el tiempo que hace ahora en el lugar.
// Todo es canvas, sin imágenes externas. Con "reducir movimiento" activado se dibuja un cielo quieto.
//
// La luz cambia de forma continua con la altura real del sol y la posición de la luna.
// Capas, de atrás hacia delante: degradado del cielo, estrellas y luna, sol con rayos,
// nubes en dos alturas, niebla, precipitación en tres profundidades, salpicaduras,
// relámpagos y, por último, gotas en el cristal cuando llueve.

import { ESTRELLAS } from './estrellas.js';

const RAD = Math.PI / 180;
// Color de las estrellas según su índice B-V, suavizado como se ve a simple vista
const COLOR_ESTRELLA = [[-0.3, [170, 191, 255]], [0, [210, 222, 255]], [0.3, [245, 245, 255]], [0.6, [255, 246, 232]], [0.9, [255, 232, 200]], [1.2, [255, 216, 170]], [1.6, [255, 196, 140]]];
const BV_PLANETA = { Venus: 0.3, Marte: 1.6, 'Júpiter': 0.6, Saturno: 0.9 };

// La luz no va por fases fijas: todos los colores se interpolan según la altura real del sol (grados).
// Cielo despejado: [cénit, horizonte]
const CIELO_DESPEJADO = [
  [-18, [[3, 6, 14], [9, 14, 28]]],
  [-12, [[6, 11, 28], [18, 28, 54]]],
  [-8, [[12, 22, 52], [44, 52, 92]]],
  [-4, [[24, 42, 88], [128, 96, 124]]],
  [-1, [[36, 62, 122], [222, 140, 108]]],
  [2, [[48, 90, 160], [240, 170, 120]]],
  [6, [[56, 112, 190], [226, 196, 168]]],
  [12, [[50, 116, 204], [168, 202, 234]]],
  [25, [[42, 110, 208], [143, 195, 240]]],
  [50, [[34, 98, 200], [134, 190, 240]]]
];
// Cielo tapado: [de noche, de día], cada uno [cénit, horizonte]. De noche, algo cálido por las luces de la ciudad
const CIELO_TAPADO = {
  cubierto: [[[20, 20, 24], [48, 43, 44]], [[112, 122, 136], [168, 176, 186]]],
  lluvia: [[[15, 16, 20], [38, 35, 38]], [[72, 82, 96], [122, 132, 145]]],
  tormenta: [[[9, 10, 14], [28, 27, 32]], [[40, 46, 58], [86, 94, 108]]],
  niebla: [[[26, 28, 32], [50, 50, 54]], [[156, 164, 172], [208, 212, 216]]],
  nieve: [[[24, 30, 42], [56, 62, 76]], [[142, 156, 176], [214, 222, 230]]]
};
// Nubes finas: [cara iluminada, cara en sombra]. Al atardecer se tiñen de naranja y rosa
const NUBE = [
  [-14, [[60, 66, 84], [24, 28, 40]]],
  [-8, [[78, 80, 116], [34, 38, 62]]],
  [-4, [[196, 132, 140], [70, 64, 98]]],
  [-1, [[255, 158, 112], [112, 88, 120]]],
  [2, [[255, 184, 130], [136, 112, 136]]],
  [6, [[255, 222, 188], [160, 150, 168]]],
  [12, [[255, 248, 240], [176, 186, 204]]],
  [25, [[255, 255, 255], [172, 186, 206]]]
];
// Nubes gruesas: [luz, desaturación, sombra]. Cuanto más espesas, más grises y oscuras
const ESPESOR = { despejado: [1, 0, 1], nubes: [1, 0, 1], cubierto: [0.88, 0.35, 0.8], lluvia: [0.6, 0.55, 0.62], tormenta: [0.42, 0.65, 0.45], nieve: [0.94, 0.4, 0.85], niebla: [0.97, 0.5, 1] };
const ALFA_NUBES = { despejado: 0.75, nubes: 0.9, cubierto: 0.95, lluvia: 0.97, tormenta: 0.98, niebla: 0.6, nieve: 0.92 };
const DISCO_SOL = [[-1, [255, 132, 64]], [2, [255, 166, 92]], [6, [255, 214, 150]], [15, [255, 244, 214]], [30, [255, 251, 238]]];

const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const sube = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gris = (c, d) => { const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return mezclar(c, [l, l, l], d); };
function tramo(claves, x) {
  if (x <= claves[0][0]) return claves[0][1];
  for (let i = 1; i < claves.length; i++) {
    if (x <= claves[i][0]) {
      const [x0, a] = claves[i - 1], [x1, b] = claves[i], t = (x - x0) / (x1 - x0);
      return Array.isArray(a[0]) ? a.map((v, k) => mezclar(v, b[k], t)) : mezclar(a, b, t);
    }
  }
  return claves[claves.length - 1][1];
}

// Ruido de valor periódico en x, para que la textura se pueda repetir sin costura
function textura({ ancho = 320, alto = 134, semilla = 1, periodo = 4, octavas = 5, cobertura = 0.5, suave = 0.6, relieve = true, contraste = 0.9, perfil = null, fundido = [0, 0.35] }) {
  const r = rnd(semilla), N = 256, tabla = new Float32Array(N * N);
  for (let i = 0; i < tabla.length; i++) tabla[i] = r();
  const valor = (x, y, px) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = yi & 255, y1 = (yi + 1) & 255;
    const a = tabla[y0 * N + x0], b = tabla[y0 * N + x1], c = tabla[y1 * N + x0], d = tabla[y1 * N + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const dens = new Float32Array(ancho * alto);
  let suma = 0, suma2 = 0;
  for (let j = 0; j < alto; j++) {
    for (let i = 0; i < ancho; i++) {
      let t = 0, a = 1, norma = 0;
      for (let o = 0; o < octavas; o++) {
        const p = periodo << o;
        t += a * valor((i / ancho) * p, (j / ancho) * p + o * 31.7, p); norma += a; a *= 0.5;
      }
      let d = t / norma;
      if (perfil) d += perfil(j / alto);
      dens[j * ancho + i] = d; suma += d; suma2 += d * d;
    }
  }
  const n = ancho * alto, media = suma / n, dt = Math.sqrt(Math.max(1e-6, suma2 / n - media * media));
  // Umbral por cuantil: la fracción cubierta es la que pide la nubosidad
  const muestra = []; for (let k = 0; k < n; k += 7) muestra.push(dens[k]);
  muestra.sort((x, y) => x - y);
  const umbral = muestra[Math.min(muestra.length - 1, Math.floor((1 - cobertura) * muestra.length))];
  const banda = suave * dt;
  // Dos lienzos blancos: uno lleva la forma de la nube y otro cuánta luz recibe cada punto
  const mascara = lienzo(ancho, alto), tonos = lienzo(ancho, alto);
  const gm = mascara.getContext('2d'), gt = tonos.getContext('2d');
  const im = gm.createImageData(ancho, alto), it = gt.createImageData(ancho, alto), pm = im.data, pt = it.data;
  const paso = 3, sube = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  for (let j = 0; j < alto; j++) {
    // Bordes superior e inferior difuminados para que no se vea el corte de la textura
    const yy = j / (alto - 1);
    const borde = (fundido[0] ? sube(yy / fundido[0]) : 1) * (fundido[1] ? sube((1 - yy) / fundido[1]) : 1);
    for (let i = 0; i < ancho; i++) {
      const k = j * ancho + i, d = dens[k];
      let a = (d - umbral + banda * 0.5) / banda;
      a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
      // Luz desde arriba: el borde superior se ilumina y la panza se oscurece, más cuanto más espesa
      let tono = 0.62;
      if (relieve) {
        const abajo = dens[Math.min(alto - 1, j + paso) * ancho + i];
        const espesor = Math.min(1, Math.max(0, (d - umbral) / (2.2 * dt)));
        tono = Math.min(1, Math.max(0, 0.6 + ((abajo - d) / dt) * contraste - espesor * 0.45));
      }
      pm[k * 4] = pm[k * 4 + 1] = pm[k * 4 + 2] = 255; pm[k * 4 + 3] = 255 * a * borde;
      pt[k * 4] = pt[k * 4 + 1] = pt[k * 4 + 2] = 255; pt[k * 4 + 3] = 255 * tono;
    }
  }
  gm.putImageData(im, 0, 0); gt.putImageData(it, 0, 0);
  return { mascara, tonos };
}

function spriteEstrella(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 36;
  const g = c.getContext('2d'), gr = g.createRadialGradient(18, 18, 0, 18, 18, 18);
  // El núcleo ocupa un tercio del sprite: al dibujarlo a 6 veces el radio, el núcleo mide justo ese radio
  gr.addColorStop(0, rgba(mezclar(color, [255, 255, 255], 0.55), 1));
  gr.addColorStop(0.2, rgba(color, 1));
  gr.addColorStop(0.34, rgba(color, 0.5));
  gr.addColorStop(0.6, rgba(color, 0.1));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 36, 36);
  return c;
}

// Luna con sus mares oscuros, algunos cráteres y el borde algo más oscuro
function texturaLuna() {
  const T = 160, c = lienzo(T, T), g = c.getContext('2d'), r = rnd(13), C = T / 2;
  const base = g.createRadialGradient(C - 18, C - 22, 4, C, C, C);
  base.addColorStop(0, '#fbf8ef'); base.addColorStop(0.7, '#e9e4d6'); base.addColorStop(1, '#c9c2b2');
  g.fillStyle = base; g.beginPath(); g.arc(C, C, C, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(C, C, C, 0, Math.PI * 2); g.clip();
  // Mares, con la forma aproximada de la cara visible: Imbrio, Serenidad, Tranquilidad, Crisis, Procelas, Nubes
  const mares = [[0.36, 0.33, 0.2], [0.58, 0.33, 0.12], [0.63, 0.47, 0.13], [0.8, 0.38, 0.07], [0.24, 0.52, 0.2], [0.42, 0.66, 0.12], [0.55, 0.6, 0.09], [0.3, 0.72, 0.08]];
  for (const [mx, my, mr] of mares) {
    for (let k = 0; k < 5; k++) {
      const x = (mx + (r() - 0.5) * mr * 0.6) * T, y = (my + (r() - 0.5) * mr * 0.6) * T, rr = mr * T * (0.55 + r() * 0.5);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(120,118,112,0.28)'); gr.addColorStop(0.7, 'rgba(120,118,112,0.16)'); gr.addColorStop(1, 'rgba(120,118,112,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
  }
  for (let k = 0; k < 40; k++) {
    const x = r() * T, y = r() * T, rr = 0.8 + r() * 3.2;
    g.fillStyle = `rgba(90,88,84,${0.12 + r() * 0.12})`; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(255,255,250,${0.1 + r() * 0.15})`; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.6, 0, Math.PI * 2); g.fill();
  }
  // Tycho, el cráter brillante de abajo
  g.fillStyle = 'rgba(255,255,252,0.55)'; g.beginPath(); g.arc(0.45 * T, 0.84 * T, 3, 0, Math.PI * 2); g.fill();
  const borde = g.createRadialGradient(C, C, C * 0.7, C, C, C);
  borde.addColorStop(0, 'rgba(60,56,50,0)'); borde.addColorStop(1, 'rgba(60,56,50,0.35)');
  g.fillStyle = borde; g.fillRect(0, 0, T, T);
  g.restore();
  return c;
}

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Colorea una textura: sombra de fondo, luz según el tono y, al final, la forma de la nube
let temporal = null, coloreada = null;
// La textura coloreada se copia tres veces seguidas en un solo lienzo: al dibujarla de una vez
// no hay uniones entre copias en pantalla, que eran la línea vertical que se veía en las nubes
function tenir(capa, luz, sombra) {
  const { mascara, tonos } = capa.tex, W = mascara.width, H = mascara.height;
  if (!temporal || temporal.width !== W || temporal.height !== H) temporal = lienzo(W, H);
  if (!coloreada || coloreada.width !== W || coloreada.height !== H) coloreada = lienzo(W, H);
  const g = coloreada.getContext('2d'), t = temporal.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.fillStyle = rgba(sombra); g.fillRect(0, 0, W, H);
  t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.drawImage(tonos, 0, 0);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = rgba(luz); t.fillRect(0, 0, W, H);
  g.drawImage(temporal, 0, 0);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(mascara, 0, 0);
  g.globalCompositeOperation = 'source-over';
  if (!capa.img || capa.img.width !== W * 3 || capa.img.height !== H) capa.img = lienzo(W * 3, H);
  const f = capa.img.getContext('2d');
  f.clearRect(0, 0, W * 3, H);
  for (let k = 0; k < 3; k++) f.drawImage(coloreada, k * W, 0);
  capa.periodo = W;
}

// Rayos de sol pintados en pequeño: al ampliarlos quedan con bordes suaves
function texturaRayos(n, semilla) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d'), r = rnd(semilla);
  g.translate(80, 80);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3, abre = 0.025 + r() * 0.05, largo = 55 + r() * 25;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, largo);
    gr.addColorStop(0, `rgba(255,255,255,${0.5 + r() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0);
    g.lineTo(Math.cos(a - abre) * largo, Math.sin(a - abre) * largo);
    g.lineTo(Math.cos(a + abre) * largo, Math.sin(a + abre) * largo);
    g.closePath(); g.fill();
  }
  return c;
}

// Cortinas de lluvia: bandas verticales de distinta densidad que barre el viento
function texturaCortina(semilla) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d'), r = rnd(semilla), img = g.createImageData(256, 64);
  const nodos = Array.from({ length: 16 }, () => r());
  for (let i = 0; i < 256; i++) {
    const x = (i / 256) * 16, k = Math.floor(x), f = x - k, u = f * f * (3 - 2 * f);
    let v = nodos[k % 16] + (nodos[(k + 1) % 16] - nodos[k % 16]) * u;
    v = Math.max(0, (v - 0.35) / 0.65);
    for (let j = 0; j < 64; j++) {
      const p = (j * 256 + i) * 4;
      img.data[p] = 205; img.data[p + 1] = 214; img.data[p + 2] = 228;
      img.data[p + 3] = 255 * v * (0.35 + 0.65 * (j / 63));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function grupo(tipo) {
  if (tipo === 'despejado') return 'despejado';
  if (tipo === 'pocas_nubes' || tipo === 'nubes') return 'nubes';
  if (tipo === 'cubierto') return 'cubierto';
  if (tipo === 'niebla') return 'niebla';
  if (tipo === 'nieve') return 'nieve';
  if (tipo === 'tormenta') return 'tormenta';
  return 'lluvia';
}

function rnd(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const azar = (a, b) => a + Math.random() * (b - a);

// Trazo de una gota en movimiento: bordes suaves, cola que se desvanece y cabeza más brillante
function spriteRaya(rgb) {
  const c = document.createElement('canvas');
  c.width = 6; c.height = 96;
  const g = c.getContext('2d');
  const largo = g.createLinearGradient(0, 0, 0, 96);
  largo.addColorStop(0, `rgba(${rgb},0)`);
  largo.addColorStop(0.5, `rgba(${rgb},0.4)`);
  largo.addColorStop(0.9, `rgba(${rgb},1)`);
  largo.addColorStop(1, `rgba(${rgb},0.35)`);
  g.fillStyle = largo; g.fillRect(0, 0, 6, 96);
  g.globalCompositeOperation = 'destination-in';
  const ancho = g.createLinearGradient(0, 0, 6, 0);
  ancho.addColorStop(0, 'rgba(0,0,0,0)'); ancho.addColorStop(0.5, 'rgba(0,0,0,1)'); ancho.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ancho; g.fillRect(0, 0, 6, 96);
  return c;
}

// Sprite de una gota en el cristal, al doble de resolución. Una gota es una lente:
// enseña el cielo del revés (clara abajo, más oscura arriba), tiene el borde oscuro
// por la refracción y un brillo pequeño donde refleja la luz.
const ESC_GOTA = 2;
function spriteGota(r) {
  const R = r * ESC_GOTA;
  const t = Math.ceil(R * 2 + 4);
  const c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const cx = t / 2, cy = t / 2;
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  const cuerpo = g.createLinearGradient(0, cy - R, 0, cy + R);
  cuerpo.addColorStop(0, 'rgba(16,22,34,0.46)');
  cuerpo.addColorStop(0.42, 'rgba(70,80,96,0.2)');
  cuerpo.addColorStop(0.8, 'rgba(228,236,246,0.36)');
  cuerpo.addColorStop(1, 'rgba(255,255,255,0.55)');
  g.fillStyle = cuerpo; g.fillRect(0, 0, t, t);
  const borde = g.createRadialGradient(cx, cy + R * 0.15, R * 0.5, cx, cy, R);
  borde.addColorStop(0, 'rgba(8,12,20,0)');
  borde.addColorStop(0.78, 'rgba(8,12,20,0.18)');
  borde.addColorStop(1, 'rgba(8,12,20,0.55)');
  g.fillStyle = borde; g.fillRect(0, 0, t, t);
  g.restore();
  const bx = cx - R * 0.32, by = cy - R * 0.45;
  const brillo = g.createRadialGradient(bx, by, 0, bx, by, R * 0.32);
  brillo.addColorStop(0, 'rgba(255,255,255,0.95)');
  brillo.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  brillo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = brillo; g.fillRect(0, 0, t, t);
  if (R > 5) {
    g.beginPath(); g.arc(cx, cy, R * 0.86, 0.2 * Math.PI, 0.8 * Math.PI);
    g.lineWidth = R * 0.1; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.3)'; g.stroke();
  }
  return c;
}

// Microgota de la neblina: un punto de agua claro con el borde apenas oscuro
function spriteMicro() {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(3.4, 3.4, 0, 4, 4, 4);
  r.addColorStop(0, 'rgba(255,255,255,0.75)');
  r.addColorStop(0.55, 'rgba(225,232,242,0.35)');
  r.addColorStop(0.85, 'rgba(20,26,38,0.28)');
  r.addColorStop(1, 'rgba(20,26,38,0)');
  g.fillStyle = r; g.fillRect(0, 0, 8, 8);
  return c;
}

// ── Gotas en el cristal ──
// Las gotas que golpean el cristal se quedan pegadas. Si una cae sobre otra, se juntan y crecen.
// Cuando una pesa lo bastante vence el agarre y resbala a tirones: se traga las que encuentra,
// limpia a su paso la neblina de microgotas y arrastra detrás una película de agua corta que en
// menos de medio segundo se rompe en gotitas: lo que queda es un surco limpio salpicado de gotas
// diminutas, no una raya. Las que bajan después tienden a seguir el camino ya mojado.
const MOJ = 5; // tamaño de celda del mapa de humedad, px
const CELDA = 20, MAX_GOTAS = 650, R_RESBALA = 5.8;

class Cristal {
  constructor() {
    this.gotas = []; this.w = 0; this.h = 0; this.secar = 0; this.juntar = 0; this.reloj = 0; this.lleno = false;
    this.sprites = [2, 4, 7, 11, 16].map((r) => ({ r, img: spriteGota(r) }));
    this.spriteMicro = spriteMicro();
  }

  medir(w, h, dpr) {
    if (this.micro && this.w === w && this.h === h) return;
    this.w = w; this.h = h;
    this.micro = document.createElement('canvas');
    this.micro.width = Math.round(w * dpr); this.micro.height = Math.round(h * dpr);
    this.m = this.micro.getContext('2d');
    this.m.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cols = Math.ceil(w / MOJ) + 1; this.filas = Math.ceil(h / MOJ) + 1;
    this.mojado = new Float32Array(this.cols * this.filas);
    this.vaciar();
  }

  vaciar() {
    this.gotas = []; this.lleno = false; this.reloj = 0;
    if (this.m) { this.m.clearRect(0, 0, this.w, this.h); this.mojado.fill(0); }
  }

  // Lo mojado que sigue el cristal en una celda: 1 recién pasada una gota, 0 seco
  humedad(c, f) {
    if (c < 0 || f < 0 || c >= this.cols || f >= this.filas) return 0;
    return Math.max(0, Math.min(1, (this.mojado[f * this.cols + c] - this.reloj) / 20));
  }

  mojar(x, y, r) {
    const f = Math.floor(y / MOJ);
    if (f < 0 || f >= this.filas) return;
    for (let c = Math.floor((x - r * 0.6) / MOJ); c <= Math.floor((x + r * 0.6) / MOJ); c++) {
      if (c >= 0 && c < this.cols) this.mojado[f * this.cols + c] = this.reloj + 20;
    }
  }

  // Cuánta agua llega según el tipo de lluvia. «crece» es lo que engorda cada gota por segundo
  // al ir recogiendo la neblina que la rodea (en superficie, px²)
  ritmo(fina, f) {
    return fina
      ? { micro: 230, gotas: 18, rmin: 0.8, rmax: 2.8, inicial: 380, crece: 0.2 }
      : { micro: 160 + f * 280, gotas: 25 + f * 70, rmin: 1, rmax: 3.5 + f * 2.5, inicial: 420 + f * 160, crece: 0.12 + f * 0.4 };
  }

  radio(R) { return R.rmin + (R.rmax - R.rmin) * Math.pow(Math.random(), 2.4); }

  sprite(r) { return this.sprites.find((p) => p.r >= r) || this.sprites[this.sprites.length - 1]; }

  dibujar(ctx, x, y, r, sx, sy, a) {
    const s = this.sprite(r), t = (s.img.width / ESC_GOTA) * (r / s.r);
    ctx.globalAlpha = a;
    ctx.drawImage(s.img, x - (t * sx) / 2, y - (t * sy) / 2, t * sx, t * sy);
  }

  microgota() {
    const r = azar(0.4, 1.4), x = azar(0, this.w), y = azar(0, this.h);
    this.m.globalAlpha = azar(0.45, 1);
    this.m.drawImage(this.spriteMicro, x - r, y - r, r * 2, r * 2);
  }

  // Rejilla para encontrar vecinas sin comparar todas con todas
  indexar() {
    this.celdas = new Map();
    for (const d of this.gotas) if (d.viva) this.meter(d);
  }

  meter(d) {
    const k = (Math.floor(d.y / CELDA) + 4) * 4096 + Math.floor(d.x / CELDA) + 4;
    const l = this.celdas.get(k);
    if (l) l.push(d); else this.celdas.set(k, [d]);
  }

  // Primera gota que se solapa con el círculo (x, y, r); con «delante», solo las que tiene por debajo o al lado
  tocando(x, y, r, excepto, delante) {
    const n = Math.ceil((r + 16) / CELDA), cx = Math.floor(x / CELDA), cy = Math.floor(y / CELDA);
    for (let j = cy - n; j <= cy + n; j++) for (let i = cx - n; i <= cx + n; i++) {
      const l = this.celdas.get((j + 4) * 4096 + i + 4);
      if (!l) continue;
      for (const o of l) {
        if (o === excepto || !o.viva || (delante && o.y < y - r * 0.4)) continue;
        const dx = o.x - x, dy = o.y - y, lim = (o.r + r) * 0.82;
        if (dx * dx + dy * dy < lim * lim) return o;
      }
    }
    return null;
  }

  nueva(x, y, r, agarre = azar(0.8, 1.45)) {
    return { x, y, r, vy: 0, mueve: false, agarre, pausa: 0, rastro: 0, deriva: azar(-0.5, 0.5), viva: true, temblor: 0, eje: 0, sx: azar(0.93, 1.07), crece: azar(0.2, 1.8), hist: [], tramo: 0, sig: azar(2, 5.5) };
  }

  caer(x, y, r) {
    const o = this.tocando(x, y, r);
    if (o) { this.unir(o, { x, y, r, vy: 0 }); this.fusionar(o); return; }
    if (this.gotas.length >= MAX_GOTAS) return;
    const d = this.nueva(x, y, r);
    this.gotas.push(d); this.meter(d);
  }

  // «a» se queda con el agua de «b»: se suman las superficies y el centro se va hacia la mayor
  unir(a, b) {
    const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
    a.eje = Math.atan2(b.y - a.y, b.x - a.x);
    a.temblor = Math.min(1, a.temblor + 0.35 + 0.65 * mb / m);
    a.x = (a.x * ma + b.x * mb) / m; a.y = (a.y * ma + b.y * mb) / m;
    a.vy = (a.vy * ma + (b.vy || 0) * mb) / m;
    a.r = Math.min(10, Math.sqrt(m));
    b.viva = false;
  }

  // Al crecer puede tocar a sus vecinas: se juntan en cadena
  fusionar(a) {
    for (let n = 0; n < 3; n++) {
      const o = this.tocando(a.x, a.y, a.r, a);
      if (!o) return;
      if (o.r > a.r && !a.mueve) { this.unir(o, a); a = o; } else this.unir(a, o);
    }
  }

  // Al empezar, el cristal ya lleva un rato mojándose
  poblar(fina, f) {
    const R = this.ritmo(fina, f);
    this.indexar();
    for (let i = 0; i < 4000; i++) this.microgota();
    for (let i = 0; i < R.inicial; i++) this.caer(azar(0, this.w), azar(0, this.h), this.radio(R) * (Math.random() < 0.25 ? 1.7 : 1));
    this.lleno = true;
  }

  paso(dt, fina, f) {
    const R = this.ritmo(fina, f), m = this.m;
    if (!this.lleno) this.poblar(fina, f);
    this.reloj += dt;
    this.indexar();
    let n = R.micro * dt;
    for (; n > 0; n -= 1) if (Math.random() < n) this.microgota();
    let k = R.gotas * dt;
    for (; k > 0; k -= 1) if (Math.random() < k) this.caer(azar(0, this.w), azar(0, this.h), this.radio(R));
    // La neblina se va secando poco a poco; si no, acabaría tapándolo todo
    this.secar += dt;
    if (this.secar > 2.5) {
      this.secar = 0;
      m.globalAlpha = 1; m.globalCompositeOperation = 'destination-out';
      m.fillStyle = 'rgba(0,0,0,0.07)'; m.fillRect(0, 0, this.w, this.h);
      m.globalCompositeOperation = 'source-over';
    }
    // Las gotas quietas engordan con la neblina y, al crecer, se tocan y se juntan
    this.juntar += dt;
    const revisar = this.juntar > 0.2;
    if (revisar) this.juntar = 0;
    for (const d of this.gotas) {
      if (!d.viva) continue;
      d.temblor *= Math.exp(-dt * 7);
      if (d.hist.length) this.romperPelicula(d);
      if (!d.mueve) {
        d.r = Math.min(10, Math.sqrt(d.r * d.r + R.crece * d.crece * dt));
        if (revisar) this.fusionar(d);
        if (!d.viva) continue;
        if (d.r <= R_RESBALA * d.agarre) continue;
        d.mueve = true; d.pausa = azar(0, 0.3);
      }
      this.resbalar(d, dt);
    }
    if (this.gotas.some((d) => !d.viva)) this.gotas = this.gotas.filter((d) => d.viva);
  }

  resbalar(d, dt) {
    const m = this.m;
    const c = Math.floor(d.x / MOJ), fila = Math.floor((d.y + d.r + 2) / MOJ);
    // por cristal ya mojado corre más y se engancha menos
    const pista = this.humedad(c, fila);
    if (d.pausa > 0) { d.pausa -= dt; d.vy *= Math.exp(-dt * 12); }
    else {
      // cuanto más pesa, más corre
      const vmax = Math.max(22, 30 + (d.r - R_RESBALA) * 60) * (1 + pista * 0.5);
      d.vy += (vmax - d.vy) * Math.min(1, dt * 2.5);
      // el cristal seco no está igual de limpio en todas partes: avanza a tirones
      if (Math.random() < dt * 1.4 * (1 - pista * 0.7) * (R_RESBALA * 1.5 / d.r)) d.pausa = azar(0.04, 0.45);
    }
    // serpentea, y si tiene un reguero al lado se va hacia él
    let lado = 0, mejor = pista;
    for (const k of [-3, -2, -1, 1, 2, 3]) { const v = this.humedad(c + k, fila); if (v > mejor + 0.1) { mejor = v; lado = k; } }
    d.deriva += (lado ? Math.sign(lado) * 6 : azar(-1, 1) * 1.6) * dt;
    d.deriva = Math.max(-1, Math.min(1, d.deriva * (pista > 0.3 && !lado ? Math.exp(-dt * 4) : 1)));
    const dy = d.vy * dt;
    d.y += dy; d.x = Math.max(0, Math.min(this.w, d.x + d.deriva * dy * 0.16));
    if (dy > 0.05) {
      // limpia la neblina por donde pasa
      m.globalAlpha = 1; m.globalCompositeOperation = 'destination-out'; m.fillStyle = '#000';
      m.beginPath(); m.ellipse(d.x, d.y - d.r * 0.3, d.r * 0.95, d.r * 1.3, 0, 0, Math.PI * 2); m.fill();
      m.globalCompositeOperation = 'source-over';
      this.mojar(d.x, d.y, d.r);
      // apunta por dónde va pasando: ahí queda la película de agua
      const u = d.hist[d.hist.length - 1];
      if (!u || Math.abs(d.y - u.y) + Math.abs(d.x - u.x) >= 1) d.hist.push({ x: d.x, y: d.y, t: this.reloj });
    }
    // se traga las que encuentra delante; si al juntarse da un salto, la película de detrás se rompe ya
    const o = this.tocando(d.x, d.y, d.r, d, true);
    if (o) {
      const xa = d.x;
      this.unir(d, o);
      if (Math.abs(d.x - xa) > 1) for (const p of d.hist) p.t = -1e9;
    }
    // sin agua suficiente se queda parada
    if (d.r < R_RESBALA * d.agarre * 0.8) { d.mueve = false; d.vy = 0; }
    if (d.y - d.r * 2 > this.h) d.viva = false;
  }

  // Lo que dura la película detrás de la gota antes de romperse: más en las gordas
  vidaPelicula(d) { return 0.2 + d.r * 0.035; }

  // La película que ha caducado se rompe en gotitas sueltas y la gota pierde ese agua.
  // Casi todas son diminutas y se quedan en la capa de neblina; alguna más gorda queda como gota
  romperPelicula(d) {
    const vida = this.vidaPelicula(d), h = d.hist;
    // tampoco se estira más de un poco por detrás del cuello
    const largo = d.r * (2.6 + Math.min(2.4, d.vy / 55));
    while (h.length && (this.reloj - h[0].t > vida || d.y - h[0].y > largo)) {
      const p = h.shift(), q = h[0];
      if (!q) break;
      d.tramo += Math.hypot(q.x - p.x, q.y - p.y);
      if (d.tramo < d.sig) continue;
      d.tramo = 0; d.sig = azar(2, 5.5);
      const gorda = Math.random() < 0.15;
      const rb = gorda ? azar(1, Math.max(1.1, Math.min(1.7, d.r * 0.22))) : azar(0.45, 0.95);
      const x = p.x + azar(-0.25, 0.25) * d.r * 0.4;
      if (gorda && this.gotas.length < MAX_GOTAS + 150) {
        const t = this.nueva(x, p.y, rb);
        t.crece = azar(0.1, 0.5);
        this.gotas.push(t); this.meter(t);
      } else this.dibujar(this.m, x, p.y, rb, 1, 1, 0.95);
      d.r = Math.sqrt(Math.max(0.01, d.r * d.r - rb * rb));
    }
    if (!d.mueve && h.length < 2) h.length = 0;
  }

  // Película de agua recién dejada: se estrecha y se apaga hacia atrás, donde ya se está rompiendo
  pelicula(ctx, d, alfa) {
    const h = d.hist, n = h.length;
    if (n < 2) return;
    const vida = this.vidaPelicula(d), I = [], D = [];
    for (let i = n - 1; i >= 0; i--) {
      const p = h[i], k = Math.min(1, (this.reloj - p.t) / vida);
      const w = d.r * 0.26 * (1 - k * 0.8);
      I.push(p.x - w, p.y); D.push(p.x + w, p.y);
    }
    const yA = h[n - 1].y, yB = h[0].y;
    if (yA - yB < 1) return;
    const camino = () => {
      ctx.beginPath(); ctx.moveTo(I[0], I[1]);
      for (let i = 2; i < I.length; i += 2) ctx.lineTo(I[i], I[i + 1]);
      for (let i = D.length - 2; i >= 0; i -= 2) ctx.lineTo(D[i], D[i + 1]);
      ctx.closePath();
    };
    const relleno = ctx.createLinearGradient(0, yA, 0, yB);
    relleno.addColorStop(0, 'rgba(228,236,247,0.26)'); relleno.addColorStop(1, 'rgba(228,236,247,0)');
    const borde = ctx.createLinearGradient(0, yA, 0, yB);
    borde.addColorStop(0, 'rgba(14,20,32,0.3)'); borde.addColorStop(1, 'rgba(14,20,32,0)');
    ctx.globalAlpha = alfa;
    camino(); ctx.fillStyle = relleno; ctx.fill();
    ctx.strokeStyle = borde; ctx.lineWidth = 0.7; ctx.stroke();
  }

  // Gota en marcha: cabeza redonda abajo y un cuello que se estrecha hacia arriba y se funde con la película
  cola(ctx, d, alfa) {
    const r = d.r, L = r * (1.1 + Math.min(2.4, d.vy / 55));
    const x = d.x, y = d.y, tx = x - d.deriva * L * 0.16, ty = y - L;
    const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, 'rgba(14,20,32,0.5)');
    g.addColorStop(0.32, 'rgba(110,120,136,0.2)');
    g.addColorStop(0.55, 'rgba(236,242,250,0.38)');
    g.addColorStop(1, 'rgba(14,20,32,0.5)');
    ctx.globalAlpha = alfa; ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y);
    ctx.quadraticCurveTo(x - r * 0.72, y - L * 0.45, tx - r * 0.16, ty);
    ctx.quadraticCurveTo(tx, ty - r * 0.12, tx + r * 0.16, ty);
    ctx.quadraticCurveTo(x + r * 0.72, y - L * 0.45, x + r * 0.9, y);
    ctx.closePath(); ctx.fill();
  }

  pintar(ctx, alfa) {
    if (!this.micro) return;
    ctx.globalAlpha = alfa;
    ctx.drawImage(this.micro, 0, 0, this.w, this.h);
    for (const d of this.gotas) if (d.hist.length > 1) this.pelicula(ctx, d, alfa);
    for (const d of this.gotas) {
      if (d.mueve && d.vy > 4) {
        this.cola(ctx, d, alfa);
        this.dibujar(ctx, d.x, d.y, d.r, 0.96, 1 + Math.min(0.2, d.vy / 600), alfa);
      } else if (d.temblor > 0.03) {
        // recién unida: se estira hacia la que se ha tragado y vuelve a redondearse
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.eje);
        this.dibujar(ctx, 0, 0, d.r, 1 + d.temblor * 0.35, 1 - d.temblor * 0.15, alfa);
        ctx.restore();
      } else this.dibujar(ctx, d.x, d.y, d.r, d.sx, 1 / d.sx, alfa);
    }
    ctx.globalAlpha = 1;
  }
}

// Rayo ramificado por desplazamiento del punto medio
function trazarRayo(x0, y0, x1, y1, desv, nivel, segmentos, ramas) {
  if (nivel === 0) { segmentos.push([x0, y0, x1, y1]); return; }
  const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * desv;
  const my = (y0 + y1) / 2 + (Math.random() - 0.5) * desv * 0.2;
  trazarRayo(x0, y0, mx, my, desv / 2, nivel - 1, segmentos, ramas);
  trazarRayo(mx, my, x1, y1, desv / 2, nivel - 1, segmentos, ramas);
  if (ramas && nivel >= 3 && Math.random() < 0.28) {
    const ang = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < 0.5 ? -1 : 1) * azar(0.35, 0.8);
    const largo = Math.hypot(x1 - x0, y1 - y0) * azar(0.35, 0.7);
    const rama = [];
    trazarRayo(mx, my, mx + Math.cos(ang) * largo, my + Math.sin(ang) * largo, desv / 2, nivel - 2, rama, false);
    ramas.push(rama);
  }
}

export class Cielo {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.estado = { tipo: 'despejado', fase: 'dia', solPos: 0.5, nubes: 10, viento: 8, intensidad: 0, luna: 0.5 };
    this.mezcla = 0; this.anterior = null;
    this.reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0; this.ultimo = 0;
    this.flash = 0; this.proxRayo = 3; this.rayo = null;
    this.estrella = null; this.proxEstrella = azar(6, 14);
    this.salpicaduras = [];
    this.vidrio = new Cristal();
    this.cache = new Map();
    this.rayosA = texturaRayos(14, 3); this.rayosB = texturaRayos(9, 11);
    this.cortinaTex = texturaCortina(5);
    this.spritesEstrella = COLOR_ESTRELLA.map(([, c]) => spriteEstrella(c));
    this.firmamento = null;
    // Hasta que llega el primer tiempo real solo se pinta el degradado: así no se calculan texturas de más al abrir
    this.capasNubes = []; this.capas = []; this.copos = []; this.bancos = []; this.estrellas = [];
    this.iniciado = false;
    this.redimensionar = this.redimensionar.bind(this);
    this.bucle = this.bucle.bind(this);
    window.addEventListener('resize', this.redimensionar);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.parar(); else this.arrancar(); });
    this.redimensionar();
  }

  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.dpr = dpr;
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.c.style.width = this.w + 'px'; this.c.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vidrio.medir(this.w, this.h, dpr);
    if (this.iniciado) { this.preparar(); this.iluminar(); }
    if (this.reducido) this.dibujar(0);
  }

  set(estado) {
    const clave = () => [this.estado.tipo, Math.round(this.estado.nubes / 10), Math.round(this.fuerza() * 4)].join('|');
    const antes = clave(), altAntes = this.sol0 ? this.sol0.alt : null;
    this.estado = { ...this.estado, ...estado };
    this.sol0 = this.astros();
    const cambia = antes !== clave() || !this.iniciado;
    // Un cambio brusco, como otro tiempo, otro lugar o volver a la app horas después, se funde en lugar de saltar
    if (this.iniciado && !this.reducido && (cambia || (altAntes != null && Math.abs(altAntes - this.sol0.alt) > 2))) this.fotografiar();
    if (cambia) { this.iniciado = true; this.preparar(); }
    this.iluminar();
    if (this.reducido) this.dibujar(0);
  }

  // Posición del sol y la luna. Si la app no la manda, se deduce de la fase del día
  astros() {
    const e = this.estado;
    const alt = e.altSol ?? (e.fase === 'noche' ? -20 : e.fase === 'dia' ? 35 : 0);
    const az = e.azSol ?? ((Math.max(0, Math.min(1, e.solPos ?? 0.5)) - 0.5) * 140);
    return { alt, az, altLuna: e.altLuna ?? (e.fase === 'noche' ? 40 : -10), azLuna: e.azLuna ?? 30, ilum: e.iluminada ?? (1 - Math.cos(2 * Math.PI * (e.luna ?? 0.5))) / 2 };
  }

  fotografiar() {
    if (!this.anterior || this.anterior.width !== this.c.width || this.anterior.height !== this.c.height) this.anterior = lienzo(this.c.width, this.c.height);
    const g = this.anterior.getContext('2d');
    g.clearRect(0, 0, this.anterior.width, this.anterior.height);
    g.drawImage(this.c, 0, 0);
    this.mezcla = 1;
  }

  // Todos los colores del momento, según la altura del sol, la luna y lo tapado que esté
  iluminar() {
    const e = this.estado, g = grupo(e.tipo), { alt, altLuna, ilum } = this.sol0;
    const cubre = Math.max(0, Math.min(1, (e.nubes ?? 40) / 100));
    const k = { despejado: 0, nubes: 0.15 + 0.35 * cubre, cubierto: 0.85, lluvia: 0.92, tormenta: 0.96, niebla: 0.92, nieve: 0.9 }[g];
    const dia = sube(-10, 14, alt);
    const lunar = ilum * sube(-2, 25, altLuna) * (1 - dia);
    const limpio = tramo(CIELO_DESPEJADO, alt);
    const tapado = CIELO_TAPADO[g] || CIELO_TAPADO.cubierto;
    const gristapa = [0, 1].map((i) => mezclar(tapado[0][i], tapado[1][i], dia));
    let cielo = [0, 1].map((i) => mezclar(limpio[i], gristapa[i], k));
    cielo = [mezclar(cielo[0], cielo[0].map((v, i) => v + [8, 14, 30][i]), lunar * (1 - k)), mezclar(cielo[1], cielo[1].map((v, i) => v + [14, 20, 36][i]), lunar * (1 - k))];
    // Resplandor de las luces del pueblo o la ciudad sobre el horizonte de noche
    const urbano = e.poblacion ? Math.max(0, Math.min(1, Math.log10(e.poblacion / 1000) / 3)) : 0.4;
    cielo[1] = cielo[1].map((v, i) => v + [16, 11, 6][i] * urbano * (1 - dia));
    const [fl, des, fs] = ESPESOR[g];
    let [luz, sombra] = tramo(NUBE, alt);
    luz = gris(luz, des).map((v) => v * fl); sombra = gris(sombra, des).map((v) => v * fs);
    luz = luz.map((v, i) => v + [40, 44, 52][i] * lunar + (g !== 'despejado' && g !== 'nubes' ? [10, 6, 2][i] * (1 - dia) : 0));
    const niebla = gris(tramo(NUBE, alt)[0], 0.5).map((v) => v * (0.25 + 0.75 * Math.max(dia, 0.2)));
    this.luz = {
      cielo, dia, lunar, k, g,
      estrellas: g === 'despejado' ? 1 : g === 'nubes' ? 1 - 0.25 * cubre : 0,
      lluvia: mezclar([150, 160, 178], [226, 236, 250], Math.max(0.3, dia)),
      nieve: 0.6 + 0.4 * dia,
      cristal: 0.55 + 0.45 * dia
    };
    this.capasNubes.forEach((c, i) => tenir(c, luz, i ? sombra.map((v) => v * 0.9) : sombra));
    this.bancos.forEach((b) => tenir(b, niebla, niebla));
    this.situarEstrellas();
  }

  // Proyección estereográfica del cielo mirando al sur: conserva la forma de las constelaciones
  proyectar(alt, az) {
    const { w, h } = this, a0 = 40 * RAD;
    const k = Math.min(w / 2 / 0.9326, 0.373 * h), cy = h * 0.62 - k * 2 * Math.tan(a0 / 2);
    const ca = Math.cos(alt), sur = ca * Math.cos(az), oeste = ca * Math.sin(az), arriba = Math.sin(alt);
    const dot = sur * Math.cos(a0) + arriba * Math.sin(a0);
    if (dot < -0.3) return null;
    const f = 2 / (1 + dot);
    const x = w / 2 + k * oeste * f, y = cy - k * (-sur * Math.sin(a0) + arriba * Math.cos(a0)) * f;
    return x < -12 || x > w + 12 || y < -12 || y > h ? null : [x, y];
  }

  // Las estrellas reales que hay ahora sobre el lugar, hasta la magnitud que permiten la luz del cielo y la luna
  situarEstrellas() {
    const e = this.estado, L = this.luz, alt = this.sol0.alt;
    if (e.lat == null || e.tsl == null) { this.firmamento = null; return; }
    const lim0 = e.poblacion ? Math.max(3.4, Math.min(6, 6.2 - 0.55 * Math.log10(Math.max(e.poblacion, 50) / 50))) : 4.9;
    const oscuro = 1 - sube(-18, -6, alt);
    const lim = alt > 0 ? -10 : alt > -3 ? -3.5 : Math.min(lim0 - 1.6 * L.lunar, -1 + oscuro * (lim0 + 1.5));
    this.limite = lim;
    const phi = e.lat * RAD, sp = Math.sin(phi), cp = Math.cos(phi), lista = [];
    let n = 0;
    const fijo = () => { n++; return ((n * 2654435761) >>> 0) / 4294967296; }; // fases estables entre minuto y minuto
    const meter = (altR, azR, mag, bv, planeta) => {
      const p = this.proyectar(altR, azR);
      if (!p) return;
      const sa = Math.sin(altR);
      const r = Math.min(3.1, Math.max(0.5, 2.1 - 0.36 * mag));
      const a = Math.max(0.18, Math.min(1, 0.35 + (lim - mag) * 0.4)) * (0.35 + 0.65 * sube(0.02, 0.3, sa));
      let spr = -1;
      if (r >= 1) { spr = 0; while (spr < COLOR_ESTRELLA.length - 1 && bv > (COLOR_ESTRELLA[spr][0] + COLOR_ESTRELLA[spr + 1][0]) / 2) spr++; }
      lista.push({ x: p[0], y: p[1], r, a, spr, amp: (0.12 + 0.45 * (1 - sa)) * (planeta ? 0.25 : 1),
        f1: 2 + 3 * fijo(), f2: 7 + 6 * fijo(), p1: 6.3 * fijo(), p2: 6.3 * fijo() });
    };
    for (let i = 0; i < ESTRELLAS.length; i += 4) {
      const mag = ESTRELLAS[i + 2];
      if (mag > lim) break; // el catálogo va ordenado de más a menos brillante
      const H = (e.tsl - ESTRELLAS[i]) * RAD, dec = ESTRELLAS[i + 1] * RAD;
      const sa = sp * Math.sin(dec) + cp * Math.cos(dec) * Math.cos(H);
      if (sa < 0.02) continue;
      meter(Math.asin(sa), Math.atan2(Math.sin(H), Math.cos(H) * sp - Math.tan(dec) * cp), mag, ESTRELLAS[i + 3], false);
    }
    for (const pl of e.planetas || []) if (pl.altitud > 1 && pl.mag <= lim) meter(pl.altitud * RAD, pl.azimut * RAD, pl.mag, BV_PLANETA[pl.nombre] ?? 0.6, true);
    this.firmamento = lista;
  }

  // Intensidad de 0 a 1 según el tipo y los mm/h previstos
  fuerza() {
    const e = this.estado;
    const mm = Math.max(0, e.intensidad || 0);
    if (e.tipo === 'llovizna') return 0.25;
    if (e.tipo === 'lluvia_fuerte' || e.tipo === 'tormenta') return Math.min(1, 0.75 + mm / 16);
    if (e.tipo === 'lluvia') return Math.min(0.7, 0.35 + mm / 8);
    if (e.tipo === 'nieve') return Math.min(1, 0.45 + mm / 4);
    return 0;
  }

  // Las texturas solo dependen del tiempo que hace, no del tamaño de pantalla: se guardan
  tex(clave, opciones) {
    if (!this.cache.has(clave)) {
      if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(clave, textura(opciones));
    }
    return this.cache.get(clave);
  }

  preparar() {
    const e = this.estado, r = rnd(7), g = grupo(e.tipo), w = this.w, h = this.h;
    const f = this.fuerza();

    // Estrellas
    this.estrellas = Array.from({ length: 160 }, () => ({ x: r(), y: r() * 0.72, s: r() * 1.3 + 0.3, f: r() * 6.28, v: 0.8 + r() * 2 }));

    // Nubes: dos capas de textura, la lejana lenta y la cercana más grande y rápida
    const alfa = ALFA_NUBES[g];
    const cubre = Math.max(0, Math.min(1, (e.nubes ?? 40) / 100));
    const humedo = g === 'lluvia' || g === 'tormenta';
    const cob = g === 'niebla' ? 0.35 : humedo ? 0.97 : g === 'cubierto' || g === 'nieve' ? Math.max(0.85, cubre) : g === 'despejado' ? Math.min(0.12, cubre * 0.8) : Math.max(0.15, cubre * 0.8);
    const cb = Math.round(cob * 20);
    const bajo = (y) => -Math.max(0, y - 0.55) * 0.9; // se deshilacha por abajo
    this.capasNubes = cob < 0.02 ? [] : [
      { tex: this.tex(`a|${humedo}|${cb}`, { semilla: 21, periodo: 3, cobertura: cob, suave: humedo ? 1.1 : 0.7, perfil: bajo, contraste: humedo ? 1.8 : 0.9, fundido: [0, humedo ? 0.4 : 0.35] }),
        y: -h * 0.03, alto: h * (humedo ? 0.62 : 0.44), estira: 1.5, v: 7, a: alfa },
      { tex: this.tex(`b|${humedo}|${cb}`, { semilla: 57, periodo: 2, octavas: 5, cobertura: Math.min(0.9, cob * (humedo ? 0.75 : 0.6)), suave: 0.8, perfil: bajo, contraste: humedo ? 1.5 : 0.9, fundido: [humedo ? 0.25 : 0, 0.4] }),
        y: humedo ? h * 0.08 : -h * 0.06, alto: h * (humedo ? 0.58 : 0.4), estira: 1.9, v: 16, a: alfa * 0.85 * (humedo ? 0.9 : 0.7) }
    ];
    this.capasNubes.forEach((c, i) => { c.x = (i * 0.37 + (this.t * 0.001)) % 1; });

    // Lluvia por profundidades: lejos fina, lenta y tenue; cerca gruesa, rápida y más visible.
    // El largo de cada trazo sale de su velocidad, como el desenfoque de una foto a 1/30 s:
    // así se lee como agua que cae y no como rayitas que se desplazan.
    const lluvia = g === 'lluvia' || g === 'tormenta';
    const fina = e.tipo === 'llovizna';
    const base = lluvia ? Math.round(fina ? 480 : 170 + Math.pow(f, 1.2) * 820) : 0;
    this.cortinas = lluvia && f >= 0.6;
    const k = h / 850; // velocidades pensadas para la altura de un móvil
    const capas = fina
      ? [{ p: 0.55, vel: [620, 860], exp: 1 / 32, ancho: 1.5, alfa: 0.22 },
         { p: 0.33, vel: [860, 1150], exp: 1 / 30, ancho: 2, alfa: 0.28 },
         { p: 0.12, vel: [1150, 1450], exp: 1 / 28, ancho: 2.6, alfa: 0.34 }]
      : [{ p: 0.5, vel: [950, 1250], exp: 1 / 30, ancho: 1.7, alfa: 0.26 },
         { p: 0.32, vel: [1350, 1750], exp: 1 / 28, ancho: 2.5, alfa: 0.36 },
         { p: 0.155, vel: [1850, 2350], exp: 1 / 26, ancho: 3.6, alfa: 0.46 },
         // unas pocas gotas pegadas a la cámara, desenfocadas
         { p: 0.025, vel: [2600, 3300], exp: 1 / 24, ancho: 11, alfa: 0.07 }];
    const [x0, x1] = this.entradaLluvia(Math.max(-0.85, Math.min(0.85, (this.inclinacion() || 0) * (fina ? 1.5 : 1))));
    this.capas = capas.map((c, i) => ({ ...c, cerca: i === 2 && !fina,
      gotas: Array.from({ length: Math.round(base * c.p) }, () => {
        const v = azar(...c.vel) * k;
        return { x: azar(x0, x1), y: Math.random() * (h + 100), v, l: v * c.exp * azar(0.8, 1.2), a: azar(0.5, 1), f: Math.random() * 6.28, s: h * azar(0.82, 1) };
      }) }));

    // Nieve en tres profundidades
    this.copos = e.tipo === 'nieve'
      ? Array.from({ length: Math.round(90 + f * 160) }, (_, i) => {
        const z = i % 3; // 0 lejos, 2 cerca
        return { x: Math.random() * w, y: Math.random() * h, s: [1.1, 2, 3.4][z] * azar(0.8, 1.25), v: [28, 48, 80][z] * azar(0.8, 1.2), f: Math.random() * 6.28, z };
      })
      : [];

    // Niebla: dos velos de textura que se desplazan en sentidos opuestos
    this.bancos = g === 'niebla' ? [
      { tex: this.tex('n1', { semilla: 91, periodo: 2, octavas: 4, cobertura: 0.8, suave: 2.2, relieve: false, fundido: [0.4, 0.3] }), y: h * 0.22, alto: h * 0.75, estira: 1.6, v: 9, x: 0, a: 0.55 },
      { tex: this.tex('n2', { semilla: 33, periodo: 3, octavas: 4, cobertura: 0.7, suave: 2, relieve: false, fundido: [0.4, 0.3] }), y: h * 0.45, alto: h * 0.7, estira: 1.3, v: -14, x: 0.5, a: 0.45 }
    ] : [];

    // Gotas en el cristal
    this.cristalActivo = lluvia;
    if (!lluvia) this.vidrio.vaciar();
  }

  arrancar() {
    if (this.reducido) { this.dibujar(0); return; }
    if (this.rafId) return;
    this.ultimo = performance.now();
    this.rafId = requestAnimationFrame(this.bucle);
  }

  parar() { if (this.rafId) cancelAnimationFrame(this.rafId); this.rafId = null; }

  bucle(ahora) {
    const dt = Math.min((ahora - this.ultimo) / 1000, 0.1);
    // Con lluvia o nieve se pinta cada fotograma para que la caída sea fluida; si no, basta con menos
    const cae = (this.capas.length && this.capas[0].gotas.length) || this.copos.length;
    if (dt >= (cae ? 1 / 75 : 1 / 40)) { this.ultimo = ahora; this.t += dt; this.dibujar(dt); }
    this.rafId = requestAnimationFrame(this.bucle);
  }

  dibujar(dt) {
    const { ctx, w, h } = this, e = this.estado, g = grupo(e.tipo);
    if (!this.luz) { ctx.fillStyle = '#0b1226'; ctx.fillRect(0, 0, w, h); return; }
    const L = this.luz, { alt } = this.sol0;
    this.actualizarViento(dt);
    const fondo = ctx.createLinearGradient(0, 0, 0, h);
    fondo.addColorStop(0, rgba(L.cielo[0])); fondo.addColorStop(0.62, rgba(mezclar(L.cielo[0], L.cielo[1], 0.85))); fondo.addColorStop(1, rgba(L.cielo[1]));
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);

    if (L.estrellas > 0.02) this.noche(dt);
    this.luna();
    this.sol();
    this.nubes(dt);
    if (this.bancos.length) this.niebla(dt);
    this.luzVolumetrica();
    if (this.cortinas) this.cortina(dt);
    if (this.capas.length && this.capas[0].gotas.length) this.lluvia(dt);
    if (this.copos.length) this.nieve(dt);
    if (g === 'tormenta') this.tormenta(dt);

    // Velo inferior para que el texto se lea bien sobre cualquier cielo
    const velo = ctx.createLinearGradient(0, h * 0.35, 0, h);
    velo.addColorStop(0, 'rgba(6,10,20,0)'); velo.addColorStop(1, `rgba(6,10,20,${0.25 + 0.1 * L.dia})`);
    ctx.fillStyle = velo; ctx.fillRect(0, 0, w, h);

    if (this.cristalActivo) this.gotasCristal(dt);

    // Fundido con lo que había antes
    if (this.mezcla > 0 && this.anterior) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = this.mezcla * this.mezcla * (3 - 2 * this.mezcla);
      ctx.drawImage(this.anterior, 0, 0);
      ctx.restore();
      this.mezcla = Math.max(0, this.mezcla - dt / 1.8);
    }
  }

  // Viento del momento: el medio previsto, con rachas irregulares hasta la racha prevista.
  // Mirando al sur, el viento del oeste empuja hacia la izquierda y el de levante hacia la derecha
  actualizarViento(dt) {
    const e = this.estado;
    const base = Math.max(0, e.viento ?? 8), racha = Math.max(base, e.racha ?? base * 1.5);
    const g = this.reducido ? 0 : Math.max(0, Math.sin(this.t * 0.37) * Math.sin(this.t * 0.11 + 1.3));
    const objetivo = base + (racha - base) * g * g * 1.6;
    this.vEff = this.vEff == null || !dt ? base : this.vEff + (objetivo - this.vEff) * Math.min(1, dt * 1.5);
    let lateral = -Math.sin(((e.dirViento ?? 270) + 180) * RAD);
    if (Math.abs(lateral) < 0.3) lateral = lateral < 0 ? -0.3 : 0.3;
    this.lateral = lateral;
  }

  inclinacion() { return Math.max(-0.6, Math.min(0.6, (this.lateral * this.vEff) / 60)); }

  // De grados a pantalla: el horizonte queda a media altura y se mira hacia el sur, con el este a la izquierda
  aPantalla(alt, az) {
    const hor = this.h * 0.62;
    const x = this.w * (0.5 + 0.42 * Math.max(-1.1, Math.min(1.1, az / 90)));
    const y = hor - (hor - this.h * 0.07) * Math.min(1, Math.sin(alt * Math.PI / 180) / Math.sin(55 * Math.PI / 180));
    return [x, y];
  }

  noche(dt) {
    const { ctx, w, h } = this, t = this.t;
    const visible = this.luz.estrellas;
    if (this.firmamento) {
      // Titileo: dos ondas de distinta velocidad; más fuerte cerca del horizonte y casi nulo en los planetas
      ctx.save(); ctx.fillStyle = '#f4f6ff';
      for (const s of this.firmamento) {
        const tw = 1 - s.amp * (0.5 + 0.3 * Math.sin(t * s.f1 + s.p1) + 0.2 * Math.sin(t * s.f2 + s.p2));
        const a = s.a * tw * visible;
        if (a < 0.02) continue;
        ctx.globalAlpha = a;
        if (s.spr < 0) ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
        else { const lado = s.r * 6 * (0.92 + 0.08 * tw); ctx.drawImage(this.spritesEstrella[s.spr], s.x - lado / 2, s.y - lado / 2, lado, lado); }
      }
      ctx.restore();
    } else {
      for (const s of this.estrellas) {
        const tw = 0.55 + 0.45 * Math.sin(t * s.v + s.f);
        ctx.fillStyle = `rgba(255,255,255,${(0.22 + 0.62 * tw) * visible * (1 - sube(-14, -6, this.sol0.alt))})`;
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      }
    }
    // Estrella fugaz de vez en cuando
    if (this.reducido || visible < 0.5 || (this.firmamento && this.limite < 3)) return;
    this.proxEstrella -= dt;
    if (!this.estrella && this.proxEstrella <= 0) {
      const x = azar(w * 0.1, w * 0.8), y = azar(h * 0.03, h * 0.3), ang = azar(0.3, 0.6);
      this.estrella = { x, y, vx: Math.cos(ang) * azar(500, 750), vy: Math.sin(ang) * azar(500, 750), vida: 0, dur: azar(0.6, 1.1) };
      this.proxEstrella = azar(18, 40);
    }
    const s = this.estrella;
    if (s) {
      s.vida += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const a = Math.sin(Math.PI * Math.min(1, s.vida / s.dur)) * visible;
      const cola = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.16, s.y - s.vy * 0.16);
      cola.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); cola.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = cola; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.16, s.y - s.vy * 0.16); ctx.stroke();
      if (s.vida >= s.dur) this.estrella = null;
    }
  }

  sol() {
    const { ctx, w, h } = this, L = this.luz, { alt, az } = this.sol0;
    if (alt < -12) return;
    const [sx, sy] = this.aPantalla(alt, az);
    const claro = 1 - L.k; // las nubes espesas difuminan el sol en un resplandor
    // Resplandor del crepúsculo en el horizonte, del lado del sol
    const crep = sube(-12, -2, alt) * (1 - sube(4, 14, alt)) * (0.35 + 0.65 * claro);
    if (crep > 0.01) {
      const hy = h * 0.62, rx = w * 1.1;
      const gr = ctx.createRadialGradient(sx, hy, 0, sx, hy, rx);
      const c = alt < -5 ? [200, 120, 150] : [255, 150, 90];
      gr.addColorStop(0, rgba(c, 0.55 * crep)); gr.addColorStop(0.45, rgba(c, 0.18 * crep)); gr.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
    if (alt < -1.5) return;
    const color = tramo(DISCO_SOL, alt);
    const bajo = 1 - sube(2, 20, alt);
    const fino = L.g === 'despejado' || L.g === 'nubes';
    const R = Math.min(w, h) * 0.05 * (1 + 0.3 * bajo); // cerca del horizonte se ve más grande
    const asoma = sube(-1.5, 0.6, alt); // al salir y al ponerse, el disco aparece poco a poco
    // Luz del cielo alrededor del sol: blanca cerca, más cálida lejos
    const f = (0.3 + 0.7 * claro) * asoma;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * (0.55 + 0.2 * bajo));
    halo.addColorStop(0, rgba(mezclar(color, [255, 255, 255], 0.5), 0.6 * f));
    halo.addColorStop(0.06, rgba(color, 0.36 * f));
    halo.addColorStop(0.2, rgba(color, 0.13 * f));
    halo.addColorStop(0.5, rgba(color, 0.04 * f));
    halo.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
    if (fino) {
      // Corona y disco: blanco en el centro, amarillo pálido en el borde
      ctx.save();
      ctx.globalAlpha = asoma;
      const corona = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 3.4);
      corona.addColorStop(0, 'rgba(255,255,252,1)');
      corona.addColorStop(0.27, rgba(mezclar(color, [255, 255, 255], 0.7), 0.85));
      corona.addColorStop(0.34, rgba(color, 0.4));
      corona.addColorStop(0.6, rgba(color, 0.12));
      corona.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(sx, sy, R * 3.4, 0, Math.PI * 2); ctx.fill();
      const disco = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      disco.addColorStop(0, '#ffffff');
      disco.addColorStop(0.65, rgba(mezclar(color, [255, 255, 255], 0.85)));
      disco.addColorStop(0.92, rgba(mezclar(color, [255, 255, 255], 0.45)));
      disco.addColorStop(1, rgba(color, 0.0));
      ctx.fillStyle = disco; ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (L.g === 'cubierto' || L.g === 'nieve' || L.g === 'niebla') {
      // Tras un cielo cubierto solo se adivina una mancha clara
      const mancha = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 4);
      mancha.addColorStop(0, `rgba(255,255,250,${0.35 * asoma})`); mancha.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = mancha; ctx.fillRect(sx - R * 4, sy - R * 4, R * 8, R * 8);
    }
    this.solPantalla = { x: sx, y: sy, R, color, fino, asoma };
    if (claro < 0.6 || alt < 1) return;
    // Rayos suaves de la atmósfera, que giran muy despacio
    const lado = Math.max(w, h) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sx, sy);
    for (const [img, giro, a] of [[this.rayosA, 0.012, 0.07], [this.rayosB, -0.008, 0.05]]) {
      ctx.save();
      ctx.rotate(this.t * giro);
      ctx.globalAlpha = a * claro * sube(1, 10, alt) * (0.85 + 0.15 * Math.sin(this.t * 0.4 + a * 50));
      ctx.drawImage(img, -lado / 2, -lado / 2, lado, lado);
      ctx.restore();
    }
    ctx.restore();
  }

  // Luz volumétrica: la luz del sol que pasa entre las nubes forma haces que salen del sol.
  // Se hace en pequeño: una máscara de luz menos lo que tapan las nubes, desenfocada desde el sol
  luzVolumetrica() {
    const sp = this.solPantalla, L = this.luz;
    this.solPantalla = null;
    if (!sp || !sp.asoma) return;
    const { ctx, w, h } = this, alt = this.sol0.alt;
    const fuerza = ({ despejado: 0.1, nubes: 0.38, cubierto: 0.12 }[L.g] || 0) * sp.asoma * (0.6 + 0.4 * sube(-1, 8, alt) + 0.25 * (1 - sube(2, 15, alt)));
    if (fuerza < 0.02) return;
    const q = 4, mw = Math.ceil(w / q), mh = Math.ceil(h / q);
    if (!this.mascaraLuz || this.mascaraLuz.width !== mw || this.mascaraLuz.height !== mh) {
      this.mascaraLuz = lienzo(mw, mh); this.haces = lienzo(mw, mh);
    }
    const m = this.mascaraLuz.getContext('2d'), r = this.haces.getContext('2d');
    const x = sp.x / q, y = sp.y / q;
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
    m.clearRect(0, 0, mw, mh);
    const fuente = m.createRadialGradient(x, y, 0, x, y, Math.max(mw, mh) * 0.32);
    fuente.addColorStop(0, rgba(mezclar(sp.color, [255, 255, 255], 0.4), 0.9));
    fuente.addColorStop(0.1, rgba(sp.color, 0.5));
    fuente.addColorStop(0.45, rgba(sp.color, 0.12));
    fuente.addColorStop(1, rgba(sp.color, 0));
    m.fillStyle = fuente; m.fillRect(0, 0, mw, mh);
    // Las nubes quitan luz donde están
    m.globalCompositeOperation = 'destination-out';
    m.setTransform(1 / q, 0, 0, 1 / q, 0, 0);
    for (const c of this.capasNubes) if (c.img) this.pintarFranja(m, c);
    for (const b of this.bancos) if (b.img) this.pintarFranja(m, b);
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over';
    // Desenfoque radial: copias cada vez más grandes alrededor del sol
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalAlpha = 1; r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, mw, mh);
    r.globalCompositeOperation = 'lighter';
    const N = 16;
    for (let i = 0; i < N; i++) {
      const k = 1 + i * 0.07;
      r.globalAlpha = (1 - i / N) * 0.14;
      r.setTransform(k, 0, 0, k, x * (1 - k), y * (1 - k));
      r.drawImage(this.mascaraLuz, 0, 0);
    }
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalAlpha = 1; r.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, fuerza);
    ctx.drawImage(this.haces, 0, 0, w, h);
    // Destello encima de las nubes cuando el sol queda en un claro
    if (sp.fino) {
      ctx.globalAlpha = 0.35 * sp.asoma;
      const br = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.R * 2.4);
      br.addColorStop(0, 'rgba(255,255,250,0.9)'); br.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = br; ctx.fillRect(sp.x - sp.R * 2.4, sp.y - sp.R * 2.4, sp.R * 4.8, sp.R * 4.8);
    }
    ctx.restore();
  }

  // Dibuja una textura repetida en horizontal, desplazada según el tiempo
  franja(c, dt, velocidad) {
    if (!c.img) return;
    const ancho = c.alto * ((c.periodo || c.img.width) / c.img.height) * c.estira;
    c.x = (c.x + (velocidad * dt) / ancho + 1) % 1;
    this.pintarFranja(this.ctx, c);
  }

  pintarFranja(ctx, c) {
    const per = c.periodo || c.img.width;
    const ancho = c.alto * (per / c.img.height) * c.estira;
    const antes = ctx.globalAlpha;
    ctx.globalAlpha = antes * (c.a ?? 1);
    ctx.drawImage(c.img, -c.x * ancho, c.y, ancho * (c.img.width / per), c.alto);
    ctx.globalAlpha = antes;
  }

  nubes(dt) {
    const { ctx } = this, e = this.estado;
    const deriva = (0.15 + this.vEff / 12) * this.lateral;
    for (const c of this.capasNubes) {
      this.franja(c, dt, c.v * deriva);
      if (this.flash > 0.05) {
        // El relámpago ilumina las nubes desde dentro
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, this.flash) * 0.8;
        this.franja(c, 0, 0); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  niebla(dt) {
    // Los dos velos van con el viento, uno más despacio que otro para dar profundidad
    for (const b of this.bancos) this.franja(b, dt, Math.abs(b.v) * (0.3 + this.vEff / 15) * this.lateral * (b.v > 0 ? 1 : 0.55));
  }

  cortina(dt) {
    const { ctx, w, h } = this, e = this.estado;
    const inc = this.inclinacion();
    const ancho = w * 2.2;
    this.cortX = (this.cortX || 0) + dt * (30 + this.vEff * 5) * this.lateral;
    ctx.save();
    ctx.globalAlpha = grupo(e.tipo) === 'tormenta' ? 0.16 : 0.12;
    ctx.transform(1, 0, -inc, 1, 0, 0);
    for (const [k, s] of [[1, 0], [1.6, 0.4]]) {
      let x0 = -((((this.cortX * k) / ancho + s) % 1) + 1) % 1 * ancho - h * Math.abs(inc);
      for (; x0 < w + h * Math.abs(inc); x0 += ancho) ctx.drawImage(this.cortinaTex, x0, h * 0.1, ancho + 1, h * 0.95);
    }
    ctx.restore();
  }

  // Hueco por el que entran las gotas: con viento, más hacia barlovento para que no quede un triángulo vacío
  entradaLluvia(inc) {
    const { w, h } = this;
    return [Math.min(0, -inc * h) - 40, Math.max(w, w - inc * h) + 40];
  }

  raya(tono) {
    if (!this.rayaCache || this.rayaCache.tono !== tono) this.rayaCache = { tono, img: spriteRaya(tono) };
    return this.rayaCache.img;
  }

  lluvia(dt) {
    const { ctx, h } = this, e = this.estado, g = grupo(e.tipo);
    const fina = e.tipo === 'llovizna';
    // Las gotas pequeñas caen más despacio, así que el mismo viento las tumba más
    const inc = Math.max(-0.85, Math.min(0.85, (this.inclinacion() || 0) * (fina ? 1.5 : 1)));
    const tono = (g === 'tormenta' ? mezclar(this.luz.lluvia, [150, 170, 210], 0.15) : this.luz.lluvia).map(Math.round).join(',');
    const raya = this.raya(tono);
    const [x0, x1] = this.entradaLluvia(inc);
    const dpr = this.dpr || 1;
    // Cizalla en vez de girar cada gota: todas comparten la inclinación del viento
    ctx.setTransform(dpr, 0, inc * dpr, dpr, 0, 0);
    for (const c of this.capas) {
      for (const d of c.gotas) {
        d.y += d.v * dt; d.x += d.v * inc * dt;
        if (fina) d.x += Math.sin(this.t * 1.3 + d.f) * 20 * dt; // la llovizna remolinea
        if (d.y - d.l > h || (c.cerca && d.y > d.s)) {
          if (c.cerca && d.y > d.s && this.salpicaduras.length < 60) this.salpicar(d.x, Math.min(d.y, h - 4));
          d.y = -azar(0, 90); d.x = azar(x0, x1);
        }
        ctx.globalAlpha = c.alfa * d.a;
        ctx.drawImage(raya, d.x - inc * d.y - c.ancho / 2, d.y - d.l, c.ancho, d.l);
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Salpicaduras: anillo que se abre y gotitas que rebotan
    for (let i = this.salpicaduras.length - 1; i >= 0; i--) {
      const s = this.salpicaduras[i];
      s.vida += dt;
      const k = s.vida / s.dur;
      if (k >= 1) { this.salpicaduras.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(${tono},${0.4 * (1 - k)})`; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 2 + k * 9, 0.8 + k * 2.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(${tono},${0.6 * (1 - k)})`;
      for (const p of s.p) {
        const px = s.x + p.vx * s.vida, py = s.y + p.vy * s.vida + 260 * s.vida * s.vida;
        ctx.fillRect(px, py, 1.3, 1.3);
      }
    }
  }

  salpicar(x, y) {
    this.salpicaduras.push({ x, y, vida: 0, dur: azar(0.22, 0.36),
      p: Array.from({ length: 3 }, () => ({ vx: azar(-45, 45), vy: azar(-90, -50) })) });
  }

  nieve(dt) {
    const { ctx, w, h } = this, e = this.estado;
    const deriva = this.vEff * 0.8 * this.lateral;
    for (const c of this.copos) {
      c.y += c.v * dt; c.x += (Math.sin(this.t * 0.8 + c.f) * 14 * (c.z + 1) * 0.4 + deriva * (c.z + 1) * 0.3) * dt;
      if (c.y > h + 6) { c.y = -6; c.x = Math.random() * w; }
      if (c.x > w + 6) c.x = -6; if (c.x < -6) c.x = w + 6;
      const a = [0.55, 0.75, 0.9][c.z] * this.luz.nieve;
      if (c.z === 2) {
        const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.s * 1.6);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, c.s * 1.6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.s, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  tormenta(dt) {
    const { ctx, w, h } = this;
    if (this.reducido) return;
    this.proxRayo -= dt;
    if (this.proxRayo <= 0) {
      const cerca = Math.random() < 0.45;
      if (cerca) {
        const x0 = azar(w * 0.15, w * 0.85), y1 = azar(h * 0.55, h * 0.85);
        const seg = [], ramas = [];
        trazarRayo(x0, -10, x0 + azar(-w * 0.25, w * 0.25), y1, w * 0.22, 7, seg, ramas);
        this.rayo = { seg, ramas, vida: 0, dur: azar(0.28, 0.45) };
        this.flash = 1;
      } else {
        this.flash = azar(0.35, 0.6);
      }
      this.parpadeo = Math.random() < 0.6 ? azar(0.08, 0.16) : 0;
      this.proxRayo = azar(4, 11);
    }
    if (this.parpadeo > 0) {
      this.parpadeo -= dt;
      if (this.parpadeo <= 0) this.flash = Math.max(this.flash, 0.7);
    }
    if (this.rayo) {
      const r = this.rayo;
      r.vida += dt;
      const k = r.vida / r.dur;
      const parpadea = k < 0.15 ? 1 : k < 0.3 ? 0.25 : k < 0.5 ? 0.9 : 1 - (k - 0.5) * 2;
      const a = Math.max(0, parpadea);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pintar = (segs, ancho) => {
        ctx.beginPath();
        for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
        ctx.lineWidth = ancho * 6; ctx.strokeStyle = `rgba(150,175,255,${0.12 * a})`; ctx.stroke();
        ctx.lineWidth = ancho * 2.4; ctx.strokeStyle = `rgba(200,215,255,${0.35 * a})`; ctx.stroke();
        ctx.lineWidth = ancho; ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`; ctx.stroke();
      };
      pintar(r.seg, 2);
      for (const rama of r.ramas) pintar(rama, 1.1);
      ctx.restore();
      if (r.vida >= r.dur) this.rayo = null;
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(225,232,255,${this.flash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
      this.flash = Math.max(0, this.flash - dt * 3.2);
    }
  }

  gotasCristal(dt) {
    const fina = this.estado.tipo === 'llovizna', f = this.fuerza();
    if (this.reducido) { if (!this.vidrio.lleno) this.vidrio.poblar(fina, f); }
    else this.vidrio.paso(dt, fina, f);
    this.vidrio.pintar(this.ctx, this.luz.cristal);
  }

  // La luna sale, cruza y se pone a su hora, en su fase real y con la parte iluminada mirando al sol.
  // De día se ve pálida si el cielo está limpio
  luna() {
    const { w, h } = this, L = this.luz, { altLuna, azLuna, alt, az } = this.sol0;
    if (altLuna < -1) return;
    const noche = 1 - L.dia;
    const alfa = (0.35 + 0.65 * noche) * (1 - 0.85 * L.k) * sube(-1, 2, altLuna);
    if (alfa < 0.03) return;
    const p = this.proyectar(altLuna * RAD, azLuna * RAD);
    const [x, y] = p && p[1] > h * 0.05 && p[0] > w * 0.07 && p[0] < w * 0.93 ? p : this.aPantalla(altLuna, azLuna);
    // Hacia dónde está el sol visto desde la luna en la pantalla
    const ps = this.proyectarLibre(alt * RAD, az * RAD), creciente = (this.estado.luna ?? 0.5) < 0.5;
    const ang = ps ? Math.atan2(ps[1] - y, ps[0] - x) : (creciente ? 0 : Math.PI);
    this.dibujarLuna(x, y, Math.min(w, h) * 0.058, this.estado.luna ?? 0.5, alfa, noche, altLuna, ang);
  }

  proyectarLibre(alt, az) {
    const { w, h } = this, a0 = 40 * RAD;
    const k = Math.min(w / 2 / 0.9326, 0.373 * h), cy = h * 0.62 - k * 2 * Math.tan(a0 / 2);
    const ca = Math.cos(alt), sur = ca * Math.cos(az), oeste = ca * Math.sin(az), arriba = Math.sin(alt);
    const dot = sur * Math.cos(a0) + arriba * Math.sin(a0);
    if (dot < -0.92) return null;
    const f = 2 / (1 + dot);
    return [w / 2 + k * oeste * f, cy - k * (-sur * Math.sin(a0) + arriba * Math.cos(a0)) * f];
  }

  dibujarLuna(x, y, r, fase, alfa, noche, altura, ang) {
    const ctx = this.ctx;
    if (!this.texLuna) this.texLuna = texturaLuna();
    ctx.save();
    ctx.globalAlpha = alfa;
    // Halo de noche
    const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 6);
    halo.addColorStop(0, `rgba(220,228,255,${0.22 * noche * (0.4 + 0.6 * (1 - Math.cos(2 * Math.PI * fase)) / 2)})`); halo.addColorStop(1, 'rgba(220,228,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, Math.PI * 2); ctx.fill();
    // Parte en sombra: de noche se adivina por la luz que refleja la Tierra
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = alfa * 0.9 * noche;
    ctx.fillStyle = 'rgb(18,22,36)'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.globalAlpha = alfa * 0.13 * noche;
    ctx.drawImage(this.texLuna, x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
    // Parte iluminada: medio círculo del lado del sol y la línea de sombra como media elipse
    const kx = Math.cos(2 * Math.PI * fase); // 1 luna nueva, -1 luna llena
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(0, 0, Math.max(0.001, Math.abs(kx) * r), r, 0, Math.PI / 2, -Math.PI / 2, kx > 0);
    ctx.closePath();
    ctx.restore();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = alfa;
    ctx.drawImage(this.texLuna, x - r, y - r, 2 * r, 2 * r);
    // Cerca del horizonte se ve más anaranjada
    const naranja = 1 - sube(2, 14, altura);
    if (naranja > 0.02) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = rgba(mezclar([255, 255, 255], [255, 196, 140], naranja));
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
    ctx.restore();
  }

}
