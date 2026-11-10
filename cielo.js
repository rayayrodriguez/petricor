// Fondo animado: el cielo se dibuja según el tiempo que hace ahora en el lugar.
// Todo es canvas, sin imágenes externas. Con "reducir movimiento" activado se dibuja un cielo quieto.
//
// Capas, de atrás hacia delante: degradado del cielo, estrellas y luna, sol con rayos,
// nubes en dos alturas, niebla, precipitación en tres profundidades, salpicaduras,
// relámpagos y, por último, gotas en el cristal cuando llueve.

const PALETAS = {
  noche: { despejado: ['#070d1f', '#1a2a4d'], nubes: ['#0d1424', '#26324a'], cubierto: ['#11161f', '#2a313d'], lluvia: ['#0c1119', '#232a35'], tormenta: ['#07090f', '#1b2030'], niebla: ['#1d232c', '#3b434e'], nieve: ['#1a2333', '#3d4a5e'] },
  alba: { despejado: ['#2b3a6e', '#f0a27a'], nubes: ['#38436a', '#c99479'], cubierto: ['#4a5163', '#8d8a8f'], lluvia: ['#3b4252', '#6f7480'], tormenta: ['#262b38', '#4d5262'], niebla: ['#8a8f99', '#c9c3bd'], nieve: ['#7d8aa3', '#c9cfd9'] },
  dia: { despejado: ['#2a6fd0', '#8fc3f0'], nubes: ['#4b7fb8', '#a9c6e0'], cubierto: ['#6b7787', '#a4adb8'], lluvia: ['#4a5563', '#7d8794'], tormenta: ['#2a303c', '#565e6c'], niebla: ['#9aa3ab', '#cfd4d8'], nieve: ['#8e9db0', '#d7dee6'] },
  ocaso: { despejado: ['#24305e', '#f08a5d'], nubes: ['#323a62', '#c77b62'], cubierto: ['#454a5c', '#8a7f80'], lluvia: ['#363c4b', '#676b77'], tormenta: ['#1f2330', '#474b5a'], niebla: ['#7f838c', '#bdb4ad'], nieve: ['#6f7a92', '#bfc4cf'] }
};

// Color de la cara iluminada y de la cara en sombra de las nubes
const TONO_NUBES = {
  dia: { despejado: [[255, 255, 255], [184, 198, 218]], nubes: [[255, 255, 255], [172, 186, 206]], cubierto: [[222, 226, 232], [132, 142, 158]], lluvia: [[150, 158, 170], [74, 82, 96]], tormenta: [[112, 118, 132], [36, 40, 52]], niebla: [[238, 240, 242], [204, 208, 214]], nieve: [[236, 240, 245], [156, 166, 182]] },
  alba: { despejado: [[255, 214, 186], [140, 120, 150]], nubes: [[255, 204, 172], [124, 108, 140]], cubierto: [[204, 184, 184], [98, 94, 110]], lluvia: [[132, 126, 136], [62, 62, 76]], tormenta: [[96, 92, 104], [32, 34, 46]], niebla: [[228, 218, 212], [176, 170, 170]], nieve: [[218, 214, 224], [128, 130, 150]] },
  noche: { despejado: [[98, 108, 130], [34, 40, 58]], nubes: [[96, 106, 128], [34, 40, 56]], cubierto: [[80, 86, 100], [30, 34, 44]], lluvia: [[64, 70, 82], [22, 26, 34]], tormenta: [[52, 56, 68], [14, 16, 24]], niebla: [[98, 102, 112], [62, 66, 74]], nieve: [[104, 112, 128], [46, 52, 66]] }
};
const ALFA_NUBES = { despejado: 0.75, nubes: 0.9, cubierto: 0.95, lluvia: 0.97, tormenta: 0.98, niebla: 0.6, nieve: 0.92 };

// Ruido de valor periódico en x, para que la textura se pueda repetir sin costura
function textura({ ancho = 320, alto = 134, semilla = 1, periodo = 4, octavas = 5, cobertura = 0.5, suave = 0.6, luz, sombra, alfa = 1, relieve = true, contraste = 0.9, perfil = null, fundido = [0, 0.35] }) {
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
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho; lienzo.height = alto;
  const g = lienzo.getContext('2d'), img = g.createImageData(ancho, alto), px = img.data;
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
      px[k * 4] = sombra[0] + (luz[0] - sombra[0]) * tono;
      px[k * 4 + 1] = sombra[1] + (luz[1] - sombra[1]) * tono;
      px[k * 4 + 2] = sombra[2] + (luz[2] - sombra[2]) * tono;
      px[k * 4 + 3] = 255 * a * alfa * borde;
    }
  }
  g.putImageData(img, 0, 0);
  return lienzo;
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

// Sprite de una gota en el cristal: borde oscuro, centro que refleja el cielo y un brillo arriba.
function spriteGota(r) {
  const c = document.createElement('canvas');
  const t = Math.ceil(r * 2 + 4);
  c.width = c.height = t;
  const g = c.getContext('2d');
  const cx = t / 2, cy = t / 2;
  const cuerpo = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
  cuerpo.addColorStop(0, 'rgba(255,255,255,0.10)');
  cuerpo.addColorStop(0.65, 'rgba(210,225,245,0.16)');
  cuerpo.addColorStop(0.92, 'rgba(15,22,36,0.34)');
  cuerpo.addColorStop(1, 'rgba(15,22,36,0)');
  g.fillStyle = cuerpo; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  const brillo = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.38);
  brillo.addColorStop(0, 'rgba(255,255,255,0.85)');
  brillo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = brillo; g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.4, r * 0.38, 0, Math.PI * 2); g.fill();
  const reflejo = g.createRadialGradient(cx + r * 0.2, cy + r * 0.45, 0, cx + r * 0.2, cy + r * 0.45, r * 0.35);
  reflejo.addColorStop(0, 'rgba(255,255,255,0.28)');
  reflejo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = reflejo; g.beginPath(); g.arc(cx + r * 0.2, cy + r * 0.45, r * 0.35, 0, Math.PI * 2); g.fill();
  return c;
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
    this.reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0; this.ultimo = 0;
    this.flash = 0; this.proxRayo = 3; this.rayo = null;
    this.estrella = null; this.proxEstrella = azar(6, 14);
    this.salpicaduras = []; this.cristal = []; this.deslizantes = [];
    this.sprites = [3, 5, 8, 12].map((r) => ({ r, img: spriteGota(r) }));
    this.cache = new Map();
    this.rayosA = texturaRayos(14, 3); this.rayosB = texturaRayos(9, 11);
    this.cortinaTex = texturaCortina(5);
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
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.c.style.width = this.w + 'px'; this.c.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.iniciado) this.preparar();
    if (this.reducido) this.dibujar(0);
  }

  set(estado) {
    const clave = () => [this.estado.tipo, this.estado.fase, Math.round(this.estado.nubes / 10), Math.round(this.fuerza() * 4)].join('|');
    const antes = clave();
    this.estado = { ...this.estado, ...estado };
    const ahora = clave();
    if (antes !== ahora || !this.iniciado) { this.iniciado = true; this.preparar(); }
    if (this.reducido) this.dibujar(0);
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
    const fase = e.fase === 'ocaso' ? 'alba' : e.fase;
    const [luz, sombra] = (TONO_NUBES[fase] || TONO_NUBES.dia)[g];
    const alfa = ALFA_NUBES[g];
    const cubre = Math.max(0, Math.min(1, (e.nubes ?? 40) / 100));
    const humedo = g === 'lluvia' || g === 'tormenta';
    const cob = g === 'niebla' ? 0.35 : humedo ? 0.97 : g === 'cubierto' || g === 'nieve' ? Math.max(0.85, cubre) : g === 'despejado' ? Math.min(0.12, cubre * 0.8) : Math.max(0.15, cubre * 0.8);
    const cb = Math.round(cob * 20);
    const bajo = (y) => -Math.max(0, y - 0.55) * 0.9; // se deshilacha por abajo
    this.capasNubes = cob < 0.02 ? [] : [
      { img: this.tex(`a|${fase}|${g}|${cb}`, { semilla: 21, periodo: 3, cobertura: cob, suave: humedo ? 1.1 : 0.7, luz, sombra, alfa, perfil: bajo, contraste: humedo ? 1.8 : 0.9, fundido: [0, humedo ? 0.4 : 0.35] }),
        y: -h * 0.03, alto: h * (humedo ? 0.62 : 0.44), estira: 1.5, v: 7, a: 1 },
      { img: this.tex(`b|${fase}|${g}|${cb}`, { semilla: 57, periodo: 2, octavas: 5, cobertura: Math.min(0.9, cob * (humedo ? 0.75 : 0.6)), suave: 0.8, luz, sombra: sombra.map((v) => v * 0.9), alfa: alfa * 0.85, perfil: bajo, contraste: humedo ? 1.5 : 0.9, fundido: [humedo ? 0.25 : 0, 0.4] }),
        y: humedo ? h * 0.08 : -h * 0.06, alto: h * (humedo ? 0.58 : 0.4), estira: 1.9, v: 16, a: humedo ? 0.9 : 0.7 }
    ];
    this.capasNubes.forEach((c, i) => { c.x = (i * 0.37 + (this.t * 0.001)) % 1; });

    // Lluvia en tres profundidades
    const lluvia = g === 'lluvia' || g === 'tormenta';
    const fina = e.tipo === 'llovizna';
    const base = lluvia ? Math.round(fina ? 300 : 60 + Math.pow(f, 1.4) * 950) : 0;
    this.cortinas = lluvia && f >= 0.6;
    const capas = fina
      ? [{ p: 1, largo: [5, 9], vel: [280, 380], ancho: 0.8, alfa: 0.32 }]
      : [{ p: 0.5, largo: [9, 15], vel: [520, 680], ancho: 0.7, alfa: 0.16 },
         { p: 0.33, largo: [16, 24], vel: [780, 980], ancho: 1.05, alfa: 0.26 },
         { p: 0.17, largo: [26, 40], vel: [1100, 1400], ancho: 1.5, alfa: 0.36 }];
    this.capas = capas.map((c, i) => ({ ...c, cerca: i === capas.length - 1 && !fina,
      gotas: Array.from({ length: Math.round(base * c.p) }, () => ({ x: Math.random() * (w + 200) - 100, y: Math.random() * h, l: azar(...c.largo), v: azar(...c.vel), s: h * azar(0.82, 1) })) }));

    // Nieve en tres profundidades
    this.copos = e.tipo === 'nieve'
      ? Array.from({ length: Math.round(90 + f * 160) }, (_, i) => {
        const z = i % 3; // 0 lejos, 2 cerca
        return { x: Math.random() * w, y: Math.random() * h, s: [1.1, 2, 3.4][z] * azar(0.8, 1.25), v: [28, 48, 80][z] * azar(0.8, 1.2), f: Math.random() * 6.28, z };
      })
      : [];

    // Niebla: dos velos de textura que se desplazan en sentidos opuestos
    this.bancos = g === 'niebla' ? [
      { img: this.tex(`n1|${fase}`, { semilla: 91, periodo: 2, octavas: 4, cobertura: 0.8, suave: 2.2, luz, sombra: luz, alfa: 0.55, relieve: false, fundido: [0.4, 0.3] }), y: h * 0.22, alto: h * 0.75, estira: 1.6, v: 9, x: 0 },
      { img: this.tex(`n2|${fase}`, { semilla: 33, periodo: 3, octavas: 4, cobertura: 0.7, suave: 2, luz, sombra: luz, alfa: 0.45, relieve: false, fundido: [0.4, 0.3] }), y: h * 0.45, alto: h * 0.7, estira: 1.3, v: -14, x: 0.5 }
    ] : [];

    // Gotas en el cristal
    this.cristalActivo = lluvia;
    if (!lluvia) { this.cristal = []; this.deslizantes = []; }
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
    if (dt >= 1 / 40) { this.ultimo = ahora; this.t += dt; this.dibujar(dt); }
    this.rafId = requestAnimationFrame(this.bucle);
  }

  dibujar(dt) {
    const { ctx, w, h } = this, e = this.estado, g = grupo(e.tipo);
    const pal = (PALETAS[e.fase] || PALETAS.dia)[g];
    const fondo = ctx.createLinearGradient(0, 0, 0, h);
    fondo.addColorStop(0, pal[0]); fondo.addColorStop(1, pal[1]);
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);

    if (e.fase === 'noche' && e.nubes < 75 && g !== 'niebla') this.noche(dt);
    if ((e.fase === 'dia' || e.fase === 'alba' || e.fase === 'ocaso') && g !== 'tormenta') this.sol();
    this.nubes(dt);
    if (this.bancos.length) this.niebla(dt);
    if (this.cortinas) this.cortina();
    if (this.capas.length && this.capas[0].gotas.length) this.lluvia(dt);
    if (this.copos.length) this.nieve(dt);
    if (g === 'tormenta') this.tormenta(dt);

    // Velo inferior para que el texto se lea bien sobre cualquier cielo
    const velo = ctx.createLinearGradient(0, h * 0.35, 0, h);
    velo.addColorStop(0, 'rgba(6,10,20,0)'); velo.addColorStop(1, 'rgba(6,10,20,0.35)');
    ctx.fillStyle = velo; ctx.fillRect(0, 0, w, h);

    if (this.cristalActivo) this.gotasCristal(dt);
  }

  noche(dt) {
    const { ctx, w, h } = this, e = this.estado;
    const visible = 1 - e.nubes / 90;
    for (const s of this.estrellas) {
      const tw = 0.55 + 0.45 * Math.sin(this.t * s.v + s.f);
      ctx.fillStyle = `rgba(255,255,255,${(0.22 + 0.62 * tw) * visible})`;
      ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
    }
    this.luna(w * 0.84, h * 0.085, Math.min(w, h) * 0.04, e.luna, visible);
    // Estrella fugaz de vez en cuando
    if (this.reducido || e.nubes > 40) return;
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
    const { ctx, w, h } = this, e = this.estado, g = grupo(e.tipo);
    const p = Math.max(0, Math.min(1, e.solPos));
    const sx = w * (0.12 + 0.76 * p), sy = h * (0.42 - 0.3 * Math.sin(Math.PI * p));
    const fuerza = g === 'despejado' ? 1 : g === 'nubes' ? 0.75 : 0.25;
    const tono = e.fase === 'dia' ? '255,244,214' : '255,196,140';
    const radio = Math.max(w, h) * 0.45;
    const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, radio);
    gl.addColorStop(0, `rgba(${tono},${0.8 * fuerza})`);
    gl.addColorStop(0.05, `rgba(${tono},${0.45 * fuerza})`);
    gl.addColorStop(0.2, `rgba(${tono},${0.12 * fuerza})`);
    gl.addColorStop(1, `rgba(${tono},0)`);
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    if (fuerza < 0.7) return;
    // Rayos: dos coronas suaves que giran en sentidos opuestos y crean un brillo cambiante
    const lado = Math.max(w, h) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sx, sy);
    for (const [img, giro, a] of [[this.rayosA, 0.012, 0.09], [this.rayosB, -0.008, 0.07]]) {
      ctx.save();
      ctx.rotate(this.t * giro);
      ctx.globalAlpha = a * fuerza * (e.fase === 'dia' ? 1 : 0.7) * (0.85 + 0.15 * Math.sin(this.t * 0.4 + a * 50));
      ctx.drawImage(img, -lado / 2, -lado / 2, lado, lado);
      ctx.restore();
    }
    ctx.restore();
  }

  // Dibuja una textura repetida en horizontal, desplazada según el tiempo
  franja(c, dt, velocidad) {
    const { ctx, w } = this;
    const ancho = c.alto * (c.img.width / c.img.height) * c.estira;
    c.x = (c.x + (velocidad * dt) / ancho + 1) % 1;
    let x0 = -c.x * ancho;
    for (; x0 < w; x0 += ancho) ctx.drawImage(c.img, x0, c.y, ancho + 1, c.alto);
  }

  nubes(dt) {
    const { ctx } = this, e = this.estado;
    const deriva = 0.4 + (e.viento || 5) / 20;
    for (const c of this.capasNubes) {
      ctx.globalAlpha = c.a;
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
    for (const b of this.bancos) this.franja(b, dt, b.v);
  }

  cortina() {
    const { ctx, w, h } = this, e = this.estado;
    const inc = Math.max(-0.35, Math.min(0.35, (e.viento || 0) / 70));
    const ancho = w * 2.2, vel = 40 + (e.viento || 0) * 5;
    ctx.save();
    ctx.globalAlpha = grupo(e.tipo) === 'tormenta' ? 0.16 : 0.12;
    ctx.transform(1, 0, -inc, 1, 0, 0);
    for (const [k, s] of [[1, 0], [1.6, 0.4]]) {
      let x0 = -(((this.t * vel * k) / ancho + s) % 1) * ancho - h * Math.abs(inc);
      for (; x0 < w + h * Math.abs(inc); x0 += ancho) ctx.drawImage(this.cortinaTex, x0, h * 0.1, ancho + 1, h * 0.95);
    }
    ctx.restore();
  }

  lluvia(dt) {
    const { ctx, w, h } = this, e = this.estado, g = grupo(e.tipo);
    const inc = Math.max(-0.35, Math.min(0.35, (e.viento || 0) / 70)); // inclinación por el viento
    const tono = g === 'tormenta' ? '200,212,232' : '214,226,244';
    ctx.lineCap = 'round';
    for (const c of this.capas) {
      // Cola tenue y cabeza más brillante: da sensación de velocidad
      ctx.lineWidth = c.ancho;
      ctx.strokeStyle = `rgba(${tono},${c.alfa * 0.55})`;
      ctx.beginPath();
      for (const d of c.gotas) {
        d.y += d.v * dt; d.x += d.v * inc * dt;
        if (d.y > h + d.l || (c.cerca && d.y > d.s)) {
          if (c.cerca && d.y > d.s && this.salpicaduras.length < 70) this.salpicar(d.x, Math.min(d.y, h - 4));
          d.y = -d.l - Math.random() * 60; d.x = Math.random() * (w + 200) - 100;
        }
        ctx.moveTo(d.x - d.l * inc, d.y - d.l); ctx.lineTo(d.x - d.l * inc * 0.4, d.y - d.l * 0.4);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(${tono},${c.alfa})`;
      ctx.beginPath();
      for (const d of c.gotas) { ctx.moveTo(d.x - d.l * inc * 0.4, d.y - d.l * 0.4); ctx.lineTo(d.x, d.y); }
      ctx.stroke();
    }
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
    const deriva = (e.viento || 0) * 0.8;
    for (const c of this.copos) {
      c.y += c.v * dt; c.x += (Math.sin(this.t * 0.8 + c.f) * 14 * (c.z + 1) * 0.4 + deriva * (c.z + 1) * 0.3) * dt;
      if (c.y > h + 6) { c.y = -6; c.x = Math.random() * w; }
      if (c.x > w + 6) c.x = -6; if (c.x < -6) c.x = w + 6;
      const a = [0.55, 0.75, 0.9][c.z];
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
    const { ctx, w, h } = this;
    const f = this.fuerza();
    if (this.reducido) {
      if (!this.cristal.length) for (let i = 0; i < 26; i++) this.cristal.push({ x: Math.random() * w, y: Math.random() * h, r: azar(1.5, 4), vida: 0, dur: 1e9 });
    } else {
      // Aparecen gotas nuevas en el cristal
      const ritmo = 4 + f * 30;
      let nuevas = ritmo * dt;
      while (nuevas > 0) {
        if (Math.random() < nuevas && this.cristal.length < 150) this.cristal.push({ x: Math.random() * w, y: Math.random() * h, r: azar(1.4, 4.2) * (Math.random() < 0.12 ? 1.7 : 1), vida: 0, dur: azar(6, 14) });
        nuevas -= 1;
      }
      // De vez en cuando una gota grande resbala dejando rastro
      if (this.deslizantes.length < 2 + Math.round(f * 4) && Math.random() < dt * (0.3 + f)) {
        this.deslizantes.push({ x: Math.random() * w, y: azar(-20, h * 0.5), r: azar(3.5, 6.5), v: 0, vmax: azar(60, 180), pausa: azar(0.2, 1), rastro: 0 });
      }
    }
    for (let i = this.cristal.length - 1; i >= 0; i--) {
      const d = this.cristal[i];
      d.vida += dt;
      const a = Math.min(1, d.vida * 3) * Math.min(1, (d.dur - d.vida) / 1.5);
      if (a <= 0) { this.cristal.splice(i, 1); continue; }
      this.gota(d.x, d.y, d.r, a);
    }
    for (let i = this.deslizantes.length - 1; i >= 0; i--) {
      const d = this.deslizantes[i];
      if (d.pausa > 0) { d.pausa -= dt; d.v = 0; }
      else {
        d.v = Math.min(d.v + 220 * dt, d.vmax);
        d.y += d.v * dt; d.x += Math.sin(d.y * 0.05) * 0.25;
        d.rastro += d.v * dt;
        if (d.rastro > 14 && this.cristal.length < 140) { this.cristal.push({ x: d.x + azar(-0.8, 0.8), y: d.y - d.r * 1.6, r: azar(0.8, 1.6), vida: 0.3, dur: azar(3, 7) }); d.rastro = 0; }
        if (Math.random() < dt * 0.8) d.pausa = azar(0.1, 0.6);
        // absorbe las gotas pequeñas que encuentra
        for (let j = this.cristal.length - 1; j >= 0; j--) {
          const c = this.cristal[j];
          if (Math.abs(c.x - d.x) < d.r && Math.abs(c.y - d.y) < d.r && c.r > 1.7) { this.cristal.splice(j, 1); d.r = Math.min(8, d.r + 0.15); }
        }
      }
      if (d.y > h + 20) { this.deslizantes.splice(i, 1); continue; }
      // forma alargada al caer
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1, 1 + Math.min(0.35, d.v / 500));
      this.gota(0, 0, d.r, 1);
      ctx.restore();
    }
  }

  gota(x, y, r, a) {
    const ctx = this.ctx;
    const s = this.sprites.find((p) => p.r >= r) || this.sprites[this.sprites.length - 1];
    const esc = r / s.r, t = s.img.width * esc;
    ctx.globalAlpha = a;
    ctx.drawImage(s.img, x - t / 2, y - t / 2, t, t);
    ctx.globalAlpha = 1;
  }

  luna(x, y, r, fase, alfa) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.9 * alfa;
    const halo = ctx.createRadialGradient(x, y, r, x, y, r * 5);
    halo.addColorStop(0, 'rgba(220,228,255,0.18)'); halo.addColorStop(1, 'rgba(220,228,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(40,48,70,0.9)'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    const ilum = 1 - Math.abs(fase - 0.5) * 2;
    const creciente = fase < 0.5;
    ctx.fillStyle = '#f2f0e6';
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !creciente);
    const k = (1 - 2 * ilum);
    ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === creciente);
    ctx.fill();
    ctx.restore();
  }
}
