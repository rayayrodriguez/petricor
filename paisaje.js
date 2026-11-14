// Paisaje del lugar al fondo del cielo: el horizonte real (montañas de lejos, medias y cerca, cada
// capa más velada por el aire cuanto más lejos está), el suelo con lo que hay en la zona (olivar,
// viñas y cereal o campo), las casas si es un pueblo o una ciudad y, de noche, sus luces.
// Todo se ilumina con la luz del momento: amanecer, mediodía, nublado, noche; se moja con la lluvia,
// se blanquea con la nieve y se lo traga la niebla. Se pinta una vez y se guarda hasta que cambia la luz.

export const EXAGERA = 1.8; // el relieve se realza un poco para que se lea en una pantalla tan pequeña
const AZ_DEFECTO = Array.from({ length: 121 }, (_, i) => -60 + i);

const mezclar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
function semilla(s) { let t = s >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
// Ruido suave de una dimensión, para dar detalle a las crestas que el modelo de 90 m no tiene
function ruido(x, s) {
  const h = (n) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

// Colores de la estación para el campo: [suelo, cultivo]
function estacion(mes, suelo) {
  const invierno = mes === 12 || mes <= 2, primavera = mes >= 3 && mes <= 5, verano = mes >= 6 && mes <= 9;
  if (suelo === 'vinedo') {
    if (invierno) return { tierra: [122, 104, 84], cultivo: [96, 82, 70], trigo: [92, 112, 70] };
    if (primavera) return { tierra: [128, 110, 86], cultivo: [96, 128, 66], trigo: [104, 140, 70] };
    if (verano) return { tierra: [150, 128, 94], cultivo: [82, 112, 58], trigo: [196, 172, 112] };
    return { tierra: [132, 112, 88], cultivo: [168, 96, 56], trigo: [150, 132, 96] }; // otoño: viñas rojizas
  }
  if (invierno) return { tierra: [124, 104, 80], cultivo: [86, 108, 64], trigo: [92, 114, 68] };
  if (primavera) return { tierra: [126, 108, 82], cultivo: [94, 130, 66], trigo: [108, 142, 72] };
  if (verano) return { tierra: [158, 134, 96], cultivo: [120, 114, 70], trigo: [198, 174, 114] };
  return { tierra: [136, 112, 84], cultivo: [110, 106, 70], trigo: [150, 130, 92] };
}

export function pintarPaisaje(g, w, h, proyectar, L, o) {
  const azar = semilla(o.semilla || 7);
  const hy = proyectar(0, 0)[1];
  const bajo = h + 4;

  // Luz que cae sobre el paisaje y el aire que se interpone
  let luz = mezclar([18, 22, 34], [236, 232, 222], L.dia);
  luz = mezclar(luz, L.cielo[1], 0.3).map((v) => v * (1 - 0.3 * L.k) + 26 * L.lunar);
  const aire = o.niebla ? mezclar(L.cielo[1], [190, 194, 200], 0.3 * L.dia) : L.cielo[1];
  const veloExtra = o.niebla ? 0.45 : o.lluvia ? 0.04 : 0.06 * L.k;
  const oscuro = o.lluvia ? 0.8 : 1; // la tierra mojada se oscurece
  const tinte = (albedo, velo) => {
    let a = o.nieve ? mezclar(albedo, [236, 240, 246], 0.75) : albedo;
    a = a.map((v, i) => (v * luz[i] / 255) * 1.12 * oscuro);
    return mezclar(a, aire, Math.min(0.96, velo + veloExtra));
  };
  const est = estacion(o.mes || 6, o.suelo);

  // Crestas de cada capa, proyectadas igual que el cielo para que el sol se ponga detrás de ellas
  const H = o.horizonte, acs = H ? H.acimuts : AZ_DEFECTO;
  const sintetico = { lejos: (az) => 0.7 + 1.4 * ruido(az / 14, 3), media: (az) => 0.2 + 1.2 * ruido(az / 9, 5), cerca: (az) => -0.6 + 0.8 * ruido(az / 6, 9) };
  const detalle = { lejos: 0.12, media: 0.22, cerca: 0.3 };
  const cresta = (nombre) => acs.map((az, i) => {
    let a = H ? H.capas[nombre][i] : sintetico[nombre](az);
    if (a < -8) a = -8;
    a += (ruido(az * 0.9, nombre.length) - 0.5) * detalle[nombre] + (ruido(az * 3.1, nombre.length + 2) - 0.5) * detalle[nombre] * 0.5;
    return proyectar(a * EXAGERA, az);
  });
  const capa = (pts, arriba, abajo) => {
    g.beginPath();
    g.moveTo(pts[0][0], bajo);
    g.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    g.lineTo(pts[pts.length - 1][0], bajo);
    g.closePath();
    const top = Math.min(...pts.map((p) => p[1]));
    const gr = g.createLinearGradient(0, top, 0, Math.max(top + 1, hy + (h - hy) * 0.6));
    gr.addColorStop(0, rgb(arriba)); gr.addColorStop(1, rgb(abajo));
    g.fillStyle = gr; g.fill();
  };

  const lejos = cresta('lejos'), media = cresta('media'), cerca = cresta('cerca');
  capa(lejos, tinte([92, 104, 122], 0.6), tinte([78, 90, 106], 0.66));
  capa(media, tinte([84, 92, 80], 0.4), tinte([70, 78, 66], 0.48));
  const tierraCerca = o.suelo === 'olivar' ? [150, 128, 96] : est.tierra;
  capa(cerca, tinte(tierraCerca, 0.2), tinte(tierraCerca.map((v) => v * 0.7), 0.08));

  // Altura de la cresta cercana en cada x, para saber dónde hay suelo
  const ySil = (x) => {
    for (let i = 1; i < cerca.length; i++) if (cerca[i][0] >= x) {
      const [x0, y0] = cerca[i - 1], [x1, y1] = cerca[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0 || 1));
    }
    return cerca[cerca.length - 1][1];
  };
  const techo = Math.min(...cerca.filter((p) => p[0] > -20 && p[0] < w + 20).map((p) => p[1]));
  // Tamaño aparente de lo que hay en el suelo: diminuto en las lomas, grande al pie de la pantalla
  const tam = (y) => 0.55 + 6.5 * Math.pow(Math.max(0, (y - techo) / (h - techo)), 2.2);

  // Campos en perspectiva: bandas que se estrechan hacia el horizonte con parcelas de distinto color
  if (o.suelo !== 'olivar') {
    const bandas = [];
    for (let y = Math.max(techo, hy - 30); y < h; y += Math.max(3, tam(y) * 5)) bandas.push(y);
    for (let b = 0; b < bandas.length - 1; b++) {
      const y0 = bandas[b], y1 = bandas[b + 1] + 0.6;
      let x = -20;
      while (x < w + 20) {
        const ancho = (90 + azar() * 220) * (0.25 + tam(y0) / 4);
        const r = azar(), base = mezclar(r < 0.35 ? est.trigo : r < 0.6 ? est.tierra : est.cultivo, est.tierra, 0.35);
        if (y1 > ySil(x) && y0 < h) {
          g.fillStyle = rgb(tinte(base.map((v) => v * (0.94 + azar() * 0.12)), 0.32 * Math.max(0, 1 - (y0 - hy + 40) / (h - hy))));
          g.fillRect(x, Math.max(y0, ySil(x + ancho / 2)), ancho, y1 - Math.max(y0, ySil(x + ancho / 2)));
        }
        x += ancho;
      }
    }
    // Hileras de viña: rayas finas que van hacia el horizonte
    if (o.suelo === 'vinedo') {
      g.strokeStyle = rgb(tinte(est.cultivo.map((v) => v * 0.7), 0.15), 0.55);
      for (let i = 0; i < 70; i++) {
        const xb = azar() * w * 1.6 - w * 0.3, y0 = hy + (h - hy) * (0.15 + azar() * 0.3);
        const xf = w / 2 + (xb - w / 2) * 0.15;
        g.lineWidth = 0.6 + azar() * 0.8;
        g.beginPath(); g.moveTo(xf, Math.max(y0, ySil(xf) + 1)); g.lineTo(xb, h); g.stroke();
      }
    }
  }

  // Árboles: olivos en hileras por las lomas (el moteado tan de Jaén) o árboles sueltos en el campo
  const copa = (x, y, s, color) => {
    if (s < 1.2) { g.fillStyle = rgb(color); g.fillRect(x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.1); return; }
    g.fillStyle = rgb(color.map((v) => v * 0.55), 0.5);
    g.beginPath(); g.ellipse(x + s * 0.25, y + s * 0.7, s * 1.05, s * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgb(color);
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.arc(x - s * 0.55, y + s * 0.2, s * 0.7, 0, Math.PI * 2); g.arc(x + s * 0.55, y + s * 0.15, s * 0.72, 0, Math.PI * 2); g.fill();
    if (L.dia > 0.3) { g.fillStyle = rgb(color.map((v) => Math.min(255, v * 1.35)), 0.6); g.beginPath(); g.arc(x - s * 0.3, y - s * 0.35, s * 0.45, 0, Math.PI * 2); g.fill(); }
  };
  const olivo = [62, 74, 50], arbol = [52, 74, 46];
  for (let y = techo; y < h + 10; y += Math.max(2.1, tam(y) * 1.75)) {
    const s = tam(y), velo = Math.max(0, 0.32 - (y - techo) / (h - techo) * 0.4);
    const color = tinte(o.suelo === 'olivar' ? olivo : arbol, velo);
    const paso = Math.max(3, s * 2.7), densidad = o.suelo === 'olivar' ? 0.92 : 0.07;
    for (let x = -10 + azar() * paso; x < w + 10; x += paso * (0.85 + azar() * 0.3)) {
      if (y < ySil(x) + s * 0.8) continue;
      // claros entre fincas
      if (ruido(x / 70 + y / 40, 11) < (o.suelo === 'olivar' ? 0.18 : 0) || azar() > densidad) continue;
      copa(x + (azar() - 0.5) * paso * 0.25, y, s * (0.85 + azar() * 0.3), color);
    }
  }

  // Casas: un pueblo al pie o, si es ciudad, subiendo por la loma más cercana
  const pob = o.poblacion || 0, ciudad = pob >= 20000, pueblo = pob >= 800;
  const luces = [];
  if (pueblo) {
    const desde = ciudad ? techo + (hy - techo) * 0.55 : hy + (h - hy) * 0.3;
    const pared = [[214, 210, 198], [206, 192, 166], [220, 216, 208], [198, 182, 150]], teja = [138, 92, 72];
    for (let y = desde; y < h + 20; y += Math.max(1.8, tam(y) * 1.6)) {
      const s = tam(y) * 1.15, paso = Math.max(2.4, s * 1.3);
      // la ciudad se aclara hacia arriba y hacia los lados
      const prob = ciudad ? 0.25 + 0.7 * Math.min(1, (y - desde) / ((h - desde) * 0.5)) : 0.5;
      for (let x = -10 + azar() * paso; x < w + 10; x += paso * (0.9 + azar() * 0.4)) {
        if (y < ySil(x) + s * 0.5) continue;
        const centro = 1 - Math.abs(x - w * (ciudad ? 0.5 : 0.45)) / (w * (ciudad ? 0.9 : 0.4));
        if (azar() > prob * Math.max(0, centro)) continue;
        const ancho = s * (0.9 + azar() * 0.7), alto = s * (0.5 + azar() * 0.35) * (ciudad && azar() < 0.15 ? 1.6 : 1);
        const muro = tinte(pared[(azar() * pared.length) | 0], Math.max(0, 0.25 - (y - desde) / (h - desde) * 0.3));
        g.fillStyle = rgb(muro); g.fillRect(x, y - alto, ancho, alto);
        g.fillStyle = rgb(muro.map((v) => v * 0.72)); g.fillRect(x + ancho * 0.62, y - alto, ancho * 0.38, alto);
        g.fillStyle = rgb(tinte(teja, 0.15)); g.fillRect(x - ancho * 0.04, y - alto - Math.max(0.6, s * 0.16), ancho * 1.08, Math.max(0.6, s * 0.18));
        if (azar() < (s > 1.2 ? 0.14 : 0.08)) luces.push([x + ancho * (0.2 + azar() * 0.6), y - alto * 0.55, Math.max(0.7, s * 0.12)]);
      }
    }
  }

  // El castillo de Santa Catalina en lo alto de su cerro, si se ve desde aquí
  if (o.castillo) {
    const { az, ang } = o.castillo, [cx, cy] = proyectar(ang * EXAGERA, az), [ex] = proyectar(ang * EXAGERA, az + 1);
    const px = Math.abs(ex - cx) * 1.35, piedra = tinte([214, 198, 168], 0.12);
    g.fillStyle = rgb(piedra);
    const muro = (a0, a1, alto) => g.fillRect(cx + a0 * px, cy - alto, (a1 - a0) * px, alto + 2);
    muro(-4.5, 4.5, px * 0.55);
    for (const [a, an, al] of [[-4.2, 0.9, 1.1], [-1.6, 0.9, 1], [0.6, 1.5, 1.9], [3.2, 1, 1.15]]) {
      muro(a, a + an, px * al);
      for (let m = 0; m < 3; m++) g.fillRect(cx + (a + (m * an) / 3) * px, cy - px * al - px * 0.18, (an / 5) * px, px * 0.18);
    }
    // la cruz, en la punta oeste del cerro
    const [kx, ky] = [cx + 7 * px, ySil(cx + 7 * px)];
    g.fillRect(kx - px * 0.07, ky - px * 1.4, px * 0.14, px * 1.4);
    g.fillRect(kx - px * 0.35, ky - px * 1.05, px * 0.7, px * 0.13);
    if (L.dia < 0.4) luces.push([cx, cy - px * 0.6, px * 1.6, true]);
  }

  // Lo más cercano queda en penumbra: no distrae y el texto de encima se lee mejor
  const sombra = g.createLinearGradient(0, hy + (h - hy) * 0.2, 0, h);
  const oscura = tinte([34, 36, 32], 0);
  sombra.addColorStop(0, rgb(oscura, 0)); sombra.addColorStop(1, rgb(oscura, 0.6));
  g.fillStyle = sombra; g.fillRect(0, hy, w, h - hy);

  // De noche, las ventanas encendidas, las farolas y algún cortijo en las lomas
  const noche = 1 - L.dia;
  if (noche > 0.25) {
    const n = Math.round((pob ? 12 + Math.log10(Math.max(pob, 10)) * 10 : 10) * noche);
    for (let i = 0; i < n; i++) {
      const x = azar() * w, y = ySil(x) + 2 + azar() * Math.max(4, hy + (h - hy) * 0.3 - ySil(x));
      luces.push([x, y, 0.8 + azar() * 0.6]);
    }
    while (luces.length > 140) luces.splice((azar() * luces.length) | 0, 1);
    // Las farolas de las calles que suben por la loma, en la franja que queda a la vista
    if (pob >= 800) {
      const m = Math.round(Math.log10(pob) * 9 * noche);
      for (let i = 0; i < m; i++) {
        const x = azar() * w, arriba = Math.max(ySil(x) + 3, hy - (hy - techo) * 0.4);
        luces.push([x, arriba + azar() * (h - hy) * 0.14, 0.9 + azar() * 0.5]);
      }
    }
    for (const l of luces) { if (l.length < 4) l.push(false); l.push(l[3] ? [255, 214, 160] : azar() < 0.25 ? [235, 240, 255] : [255, 196, 120]); }
    // Con el fondo desenfocado las luces se pintan después, como círculos de bokeh
    if (!o.desenfocado) {
      for (const [x, y, s, foco, c] of luces) {
        const r = s * (foco ? 1 : 3.2), gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgb(c, 0.95 * noche)); gr.addColorStop(0.3, rgb(c, 0.4 * noche)); gr.addColorStop(1, rgb(c, 0));
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    return { luces, noche };
  }
  return { luces: [], noche };
}

// Luces de noche vistas a través de un cristal mojado: discos suaves con el borde algo más vivo
export function pintarBokeh(g, luces, noche) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, s, foco, c] of luces) {
    const r = foco ? s * 1.4 : 3 + s * 2, a = (foco ? 0.32 : 0.24) * noche;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgb(c, a * 0.75)); gr.addColorStop(0.8, rgb(c, a)); gr.addColorStop(0.92, rgb(c, a * 0.6)); gr.addColorStop(1, rgb(c, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
