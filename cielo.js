// Fondo animado: el cielo se dibuja según el tiempo que hace ahora en el lugar.
// Sin imágenes externas: todo es canvas. Respeta "reducir movimiento" del sistema.

const PALETAS = {
  // [arriba, abajo]
  noche: { despejado: ['#070d1f', '#1a2a4d'], nubes: ['#0d1424', '#26324a'], cubierto: ['#11161f', '#2a313d'], lluvia: ['#0c1119', '#232a35'], tormenta: ['#07090f', '#1b2030'], niebla: ['#1d232c', '#3b434e'], nieve: ['#1a2333', '#3d4a5e'] },
  alba: { despejado: ['#2b3a6e', '#f0a27a'], nubes: ['#38436a', '#c99479'], cubierto: ['#4a5163', '#8d8a8f'], lluvia: ['#3b4252', '#6f7480'], tormenta: ['#262b38', '#4d5262'], niebla: ['#8a8f99', '#c9c3bd'], nieve: ['#7d8aa3', '#c9cfd9'] },
  dia: { despejado: ['#2a6fd0', '#8fc3f0'], nubes: ['#4b7fb8', '#a9c6e0'], cubierto: ['#6b7787', '#a4adb8'], lluvia: ['#4a5563', '#7d8794'], tormenta: ['#2a303c', '#565e6c'], niebla: ['#9aa3ab', '#cfd4d8'], nieve: ['#8e9db0', '#d7dee6'] },
  ocaso: { despejado: ['#24305e', '#f08a5d'], nubes: ['#323a62', '#c77b62'], cubierto: ['#454a5c', '#8a7f80'], lluvia: ['#363c4b', '#676b77'], tormenta: ['#1f2330', '#474b5a'], niebla: ['#7f838c', '#bdb4ad'], nieve: ['#6f7a92', '#bfc4cf'] }
};

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

export class Cielo {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.estado = { tipo: 'despejado', fase: 'dia', solPos: 0.5, nubes: 10, viento: 8, intensidad: 0, luna: 0.5 };
    this.reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0; this.ultimo = 0; this.flash = 0; this.proxRayo = 4;
    this.redimensionar = this.redimensionar.bind(this);
    this.bucle = this.bucle.bind(this);
    window.addEventListener('resize', this.redimensionar);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.parar(); else this.arrancar();
    });
    this.redimensionar();
  }

  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.c.style.width = this.w + 'px'; this.c.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.preparar();
    if (this.reducido) this.dibujar(0);
  }

  set(estado) {
    this.estado = { ...this.estado, ...estado };
    this.preparar();
    if (this.reducido) this.dibujar(0);
  }

  preparar() {
    const e = this.estado, r = rnd(7);
    const g = grupo(e.tipo);
    // Estrellas
    this.estrellas = Array.from({ length: 140 }, () => ({ x: r(), y: r() * 0.7, s: r() * 1.3 + 0.3, f: r() * 6.28 }));
    // Nubes: sprites pre-renderizados, con color según la hora y el tipo de cielo
    const fase = e.fase;
    const COLOR = {
      dia: { despejado: [255, 255, 255, 0.42], nubes: [255, 255, 255, 0.46], cubierto: [222, 227, 234, 0.55], lluvia: [148, 156, 168, 0.7], tormenta: [88, 96, 110, 0.82], niebla: [236, 238, 240, 0.3], nieve: [228, 234, 242, 0.6] },
      alba: { despejado: [255, 214, 192, 0.4], nubes: [250, 206, 186, 0.45], cubierto: [192, 182, 186, 0.55], lluvia: [122, 122, 134, 0.7], tormenta: [70, 74, 88, 0.82], niebla: [226, 220, 214, 0.32], nieve: [214, 216, 228, 0.6] },
      noche: { despejado: [70, 82, 104, 0.3], nubes: [72, 84, 106, 0.36], cubierto: [58, 66, 82, 0.5], lluvia: [44, 50, 64, 0.62], tormenta: [34, 38, 50, 0.72], niebla: [90, 96, 108, 0.3], nieve: [92, 102, 122, 0.5] }
    };
    const col = (COLOR[fase === 'ocaso' ? 'alba' : fase] || COLOR.dia)[g];
    const cantidad = g === 'niebla' ? 2 : Math.round(1 + (e.nubes / 100) * 7) + (g === 'lluvia' || g === 'tormenta' ? 2 : 0);
    this.nubesSpr = [];
    for (let i = 0; i < cantidad; i++) {
      const ancho = this.w * (0.7 + r() * 0.6), alto = ancho * 0.32, borde = alto * 0.6;
      const off = document.createElement('canvas');
      off.width = Math.ceil(ancho + 2 * borde); off.height = Math.ceil(alto + 2 * borde);
      const o = off.getContext('2d');
      const bolas = 10 + Math.floor(r() * 7);
      for (let b = 0; b < bolas; b++) {
        const bx = borde + ancho * (0.08 + r() * 0.84), by = borde + alto * (0.5 + (r() - 0.5) * 0.5), br = alto * (0.18 + r() * 0.3);
        const gr = o.createRadialGradient(bx, by, 0, bx, by, br);
        gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${col[3] * 0.55})`);
        gr.addColorStop(0.6, `rgba(${col[0]},${col[1]},${col[2]},${col[3] * 0.3})`);
        gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        o.fillStyle = gr; o.beginPath(); o.arc(bx, by, br, 0, Math.PI * 2); o.fill();
      }
      const alturaMax = (g === 'lluvia' || g === 'tormenta' || g === 'cubierto') ? 0.5 : 0.36;
      this.nubesSpr.push({ img: off, x: r() * (this.w + off.width) - off.width, y: r() * this.h * alturaMax - off.height * 0.45, v: 0.4 + r() * 0.6, a: off.width });
    }
    // Precipitación
    const intens = Math.min(e.intensidad || 0, 12);
    const nGotas = e.tipo === 'nieve' ? 120 : (g === 'lluvia' || g === 'tormenta') ? Math.round(80 + intens * 45) : 0;
    this.gotas = Array.from({ length: nGotas }, () => ({ x: r() * this.w, y: r() * this.h, l: 10 + r() * 16, v: 9 + r() * 7, s: 1 + r() * 2.2, f: r() * 6.28 }));
    // Niebla
    this.bandas = Array.from({ length: g === 'niebla' ? 5 : 0 }, (_, i) => ({ y: this.h * (0.35 + i * 0.13), v: 0.15 + r() * 0.25, x: r() * this.w }));
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
    if (dt >= 1 / 32) { this.ultimo = ahora; this.t += dt; this.dibujar(dt); }
    this.rafId = requestAnimationFrame(this.bucle);
  }

  dibujar(dt) {
    const { ctx, w, h } = this, e = this.estado, g = grupo(e.tipo);
    const pal = (PALETAS[e.fase] || PALETAS.dia)[g];
    const fondo = ctx.createLinearGradient(0, 0, 0, h);
    fondo.addColorStop(0, pal[0]); fondo.addColorStop(1, pal[1]);
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);

    // Estrellas y luna
    if (e.fase === 'noche' && e.nubes < 75 && g !== 'niebla') {
      const visible = 1 - e.nubes / 90;
      for (const s of this.estrellas) {
        const tw = 0.55 + 0.45 * Math.sin(this.t * 1.6 + s.f);
        ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.6 * tw) * visible})`;
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      }
      this.luna(w * 0.84, h * 0.085, Math.min(w, h) * 0.04, e.luna, visible);
    }

    // Sol
    if ((e.fase === 'dia' || e.fase === 'alba' || e.fase === 'ocaso') && g !== 'tormenta') {
      const p = Math.max(0, Math.min(1, e.solPos));
      const sx = w * (0.12 + 0.76 * p), sy = h * (0.42 - 0.3 * Math.sin(Math.PI * p));
      const fuerza = g === 'despejado' ? 1 : g === 'nubes' ? 0.7 : 0.25;
      const radio = Math.max(w, h) * 0.45;
      const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, radio);
      const tono = e.fase === 'dia' ? '255,244,214' : '255,196,140';
      gl.addColorStop(0, `rgba(${tono},${0.75 * fuerza})`);
      gl.addColorStop(0.08, `rgba(${tono},${0.35 * fuerza})`);
      gl.addColorStop(1, `rgba(${tono},0)`);
      ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    }

    // Nubes
    const deriva = 0.25 + (e.viento || 5) / 25;
    for (const n of this.nubesSpr) {
      n.x += n.v * deriva * dt * 12;
      if (n.x > w + 20) n.x = -n.a;
      ctx.drawImage(n.img, n.x, n.y);
    }

    // Niebla
    for (const b of this.bandas) {
      b.x += b.v * dt * 20; if (b.x > w) b.x -= w;
      const gr = ctx.createLinearGradient(0, b.y - 60, 0, b.y + 60);
      gr.addColorStop(0, 'rgba(235,238,240,0)'); gr.addColorStop(0.5, 'rgba(235,238,240,0.28)'); gr.addColorStop(1, 'rgba(235,238,240,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(b.x - w, b.y - 60, w * 2, 120);
    }

    // Lluvia o nieve
    if (this.gotas.length) {
      if (e.tipo === 'nieve') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const d of this.gotas) {
          d.y += d.v * 0.12 * dt * 30; d.x += Math.sin(this.t + d.f) * 0.4;
          if (d.y > h) { d.y = -5; d.x = Math.random() * w; }
          ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const inc = Math.min((e.viento || 0) / 60, 0.45);
        ctx.strokeStyle = g === 'tormenta' ? 'rgba(200,210,230,0.32)' : 'rgba(210,222,240,0.36)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const d of this.gotas) {
          d.y += d.v * dt * 60; d.x += d.v * inc * dt * 60;
          if (d.y > h) { d.y = -d.l; d.x = Math.random() * (w + 100) - 100; }
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * inc, d.y + d.l);
        }
        ctx.stroke();
      }
    }

    // Relámpagos
    if (g === 'tormenta' && !this.reducido) {
      this.proxRayo -= dt;
      if (this.proxRayo <= 0) { this.flash = 1; this.proxRayo = 5 + Math.random() * 9; }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.35})`;
        ctx.fillRect(0, 0, w, h);
        this.flash = Math.max(0, this.flash - dt * 3.2);
      }
    }

    // Velo inferior para que el texto se lea bien sobre cualquier cielo
    const velo = ctx.createLinearGradient(0, h * 0.35, 0, h);
    velo.addColorStop(0, 'rgba(6,10,20,0)'); velo.addColorStop(1, 'rgba(6,10,20,0.35)');
    ctx.fillStyle = velo; ctx.fillRect(0, 0, w, h);
  }

  luna(x, y, r, fase, alfa) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.9 * alfa;
    const halo = ctx.createRadialGradient(x, y, r, x, y, r * 5);
    halo.addColorStop(0, 'rgba(220,228,255,0.18)'); halo.addColorStop(1, 'rgba(220,228,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fill();
    // Disco iluminado según la fase (0 nueva, 0.5 llena, 1 nueva)
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(40,48,70,0.9)'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    const ilum = 1 - Math.abs(fase - 0.5) * 2; // 0..1
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
