// Sonido ambiente de Petricor. Todo se sintetiza al momento con Web Audio, sin grabaciones:
// no pesa nada, funciona sin conexión y nunca suena igual dos veces.
// Capas: lluvia (cuerpo, rumor grave, chisporroteo y gotas cercanas), viento con rachas y silbido,
// truenos al ritmo de los relámpagos del cielo, pájaros de día, vencejos y chicharras en verano,
// grillos y autillo en las noches templadas, y goteo cuando hay niebla.
//
// En el iPhone una web solo puede sonar si el audio arranca dentro de un toque, así que empieza
// con el primero. Se declara como sonido «ambiente»: respeta el modo silencio y no corta la música.

const azar = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const VOLUMEN = 0.8;

export class Sonido {
  constructor(activo = true) {
    this.activo = activo;
    this.c = null;
    this.e = null;
    this.sonando = false;
    this.temporizador = null;
    this.desbloquear = this.desbloquear.bind(this);
    for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, this.desbloquear, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.callar(true);
      else if (this.activo && this.c) this.c.resume().then(() => this.arrancar()).catch(() => {});
    });
  }

  // ── Control ──

  desbloquear() {
    if (!this.activo) return;
    if (!this.c) this.montar();
    if (!this.c) return;
    if (this.c.state !== 'running') this.c.resume().then(() => this.arrancar()).catch(() => {});
    else this.arrancar();
  }

  activar(si) {
    this.activo = si;
    if (si) this.desbloquear(); else this.callar();
  }

  set(e) {
    this.e = e;
    if (this.c) this.aplicar();
  }

  arrancar() {
    if (!this.c || !this.activo || this.sonando || this.c.state !== 'running') return;
    this.sonando = true;
    const t = this.c.currentTime;
    this.salida.gain.cancelScheduledValues(t);
    this.salida.gain.setTargetAtTime(VOLUMEN, t, 0.6);
    this.hasta = t;
    this.aplicar();
    if (!this.offline) this.temporizador = setInterval(() => this.tic(), 100);
  }

  callar(pausar) {
    if (!this.c) return;
    this.sonando = false;
    clearInterval(this.temporizador); this.temporizador = null;
    const t = this.c.currentTime;
    this.salida.gain.cancelScheduledValues(t);
    this.salida.gain.setTargetAtTime(0, t, 0.15);
    if (pausar || !this.activo) setTimeout(() => { if (!this.sonando && this.c.state === 'running') this.c.suspend().catch(() => {}); }, 900);
  }

  tic() {
    const ahora = this.c.currentTime;
    this.programar(Math.max(this.hasta, ahora), ahora + 0.35);
    this.hasta = ahora + 0.35;
  }

  // ── Montaje ──

  montar(c) {
    if (!c) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (err) { /* sin Audio Session API */ }
      try { c = new AC(); } catch (err) { return; }
    }
    this.c = c;
    this.offline = typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext;
    this.blanco = this.ruido('blanco'); this.rosa = this.ruido('rosa'); this.marron = this.ruido('marron');
    this.muestras = Array.from({ length: 12 }, (_, i) => this.muestraGota(i));

    // Salida con un compresor suave para que un trueno cercano no sature
    this.salida = this.ganancia(0);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.4;
    this.salida.connect(comp); comp.connect(c.destination);
    this.mezcla = this.ganancia(1, this.salida);
    // Eco de exterior para lo lejano: pájaros, truenos, goteo
    const rev = c.createConvolver(); rev.buffer = this.impulso(3);
    this.eco = this.ganancia(1); this.eco.connect(rev); rev.connect(this.ganancia(0.55, this.salida));

    // Lluvia: un cuerpo de ruido rosa, un rumor grave cuando cae fuerte y un chisporroteo agudo
    const L = this.lluvia = {};
    L.respira = this.ganancia(1, this.mezcla);
    L.nivel = this.ganancia(0, L.respira);
    L.lp = this.filtro('lowpass', 3000, 0.5);
    this.cadena(this.bucle(this.rosa), this.filtro('highpass', 280, 0.6), L.lp, L.gCuerpo = this.ganancia(0), L.nivel);
    this.cadena(this.bucle(this.marron), this.filtro('lowpass', 380, 0.6), L.gGrave = this.ganancia(0), L.nivel);
    this.cadena(this.bucle(this.blanco), this.filtro('highpass', 5500, 0.6), L.gBrillo = this.ganancia(0), L.nivel);

    // Viento: ruido grave filtrado que sube de tono y de volumen con las rachas, y un silbido si sopla fuerte
    const V = this.viento = { r: 0.4 };
    V.bp = this.filtro('bandpass', 400, 0.7);
    this.cadena(this.bucle(this.marron), V.bp, V.racha = this.ganancia(1), V.nivel = this.ganancia(0), this.mezcla);
    V.bpS = this.filtro('bandpass', 950, 14);
    this.cadena(this.bucle(this.rosa), V.bpS, V.rachaS = this.ganancia(0), V.nivelS = this.ganancia(0), this.mezcla);

    // Chicharras: ruido agudo que se abre y se cierra muy deprisa, en coros que suben y bajan
    const C = this.chicharras = { r: 0.6 };
    C.am = this.ganancia(0.5);
    this.cadena(this.bucle(this.blanco), this.filtro('bandpass', 5300, 5), C.am, C.coro = this.ganancia(0), C.nivel = this.ganancia(0), this.mezcla);
    const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 118;
    osc.connect(this.ganancia(0.5, C.am.gain)); osc.start();

    // Grillos: tres, cada uno con su tono, su sitio y su ritmo
    this.grillos = [0, 1, 2].map((i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 4300 + i * 260 + azar(-60, 60);
      const puerta = this.ganancia(0), pan = c.createStereoPanner(); pan.pan.value = [-0.6, 0.5, 0.05][i];
      const nivel = this.ganancia(0);
      this.cadena(o, puerta, pan, nivel, this.mezcla);
      o.start();
      return { puerta, nivel, prox: 0, ritmo: azar(0.92, 1.1), vol: azar(0.5, 1) };
    });

    this.prox = { autillo: 0 };
    this.ultimoTrueno = -99;
    this.aplicar();
  }

  // ── Del tiempo que hace a cada capa ──

  derivar(e) {
    const mm = Math.max(0, e.intensidad || 0);
    const lluvia = e.tipo === 'llovizna' ? 0.2
      : e.tipo === 'lluvia' ? Math.min(0.7, 0.35 + mm / 8)
      : e.tipo === 'lluvia_fuerte' || e.tipo === 'tormenta' ? Math.min(1, 0.75 + mm / 16) : 0;
    const v = e.viento ?? 8, ra = e.racha ?? v * 1.5;
    const viento = clamp((v - 3) / 47), rachas = clamp((ra - v) / 35);
    const dia = e.fase === 'dia' || e.fase === 'alba', noche = e.fase === 'noche';
    const mes = e.mes || 6, T = e.temp ?? 15;
    const seco = !lluvia && e.tipo !== 'nieve';
    // Frases de pájaro por minuto según la estación; al amanecer de primavera, el coro
    const primavera = mes >= 3 && mes <= 6, verano = mes >= 7 && mes <= 8, invierno = mes === 12 || mes <= 2;
    let pajaros = primavera ? 9 : verano ? 4 : invierno ? 2.5 : 3.5;
    if (e.fase === 'alba') pajaros *= primavera ? 2 : 1.4;
    if (e.fase === 'ocaso') pajaros *= 0.5;
    pajaros *= (1 - viento * 0.8) * (e.tipo === 'niebla' ? 0.4 : e.tipo === 'cubierto' ? 0.7 : 1);
    return {
      lluvia, viento, rachas, tormenta: e.tipo === 'tormenta', nieve: e.tipo === 'nieve', T,
      pajaros: seco && !noche ? pajaros : 0,
      chicharras: seco && dia && mes >= 6 && mes <= 8 && T >= 27 ? clamp((T - 26) / 8) : 0,
      vencejos: seco && !noche && mes >= 5 && mes <= 7 && T >= 18 && viento < 0.5,
      grillos: seco && (noche || e.fase === 'ocaso') && mes >= 5 && mes <= 9 && T >= 14 ? clamp((T - 13) / 8) : 0,
      autillo: seco && noche && mes >= 4 && mes <= 8 && viento < 0.4,
      goteo: e.tipo === 'niebla'
    };
  }

  aplicar() {
    if (!this.c || !this.e) return;
    const D = this.D = this.derivar(this.e), t = this.c.currentTime, L = this.lluvia, V = this.viento;
    const ir = (p, v, s = 1.2) => p.setTargetAtTime(v, t, s / 3);
    const f = D.lluvia;
    ir(L.nivel.gain, f ? 1 : 0, 2);
    ir(L.gCuerpo.gain, f ? 0.16 + 0.5 * f : 0);
    ir(L.lp.frequency, 1600 + 5600 * f);
    ir(L.gGrave.gain, 0.9 * f * f);
    ir(L.gBrillo.gain, f ? 0.03 + 0.1 * f : 0);
    // Siempre queda algo de aire; la nieve lo amortigua todo
    ir(V.nivel.gain, (0.05 + 0.75 * Math.pow(D.viento, 1.3)) * (D.nieve ? 0.6 : 1), 2);
    ir(V.nivelS.gain, D.viento > 0.4 ? 0.06 * (D.viento - 0.4) / 0.6 : 0, 2);
    ir(this.chicharras.nivel.gain, 0.16 * D.chicharras, 2);
    for (const g of this.grillos) ir(g.nivel.gain, 0.05 * g.vol * D.grillos, 2);
  }

  // Todo lo que pasa en un trozo de tiempo [t0, t1): gotas, rachas, pájaros, grillos…
  programar(t0, t1) {
    const D = this.D;
    if (!D) return;
    const c = this.c, L = this.lluvia, V = this.viento, C = this.chicharras;
    const poisson = (tasa, fn) => { if (tasa <= 0) return; for (let t = t0 + this.espera(tasa); t < t1; t += this.espera(tasa)) fn(t); };

    // Rachas: el viento y la lluvia respiran con un paseo aleatorio
    for (let t = Math.ceil(t0 * 4) / 4; t < t1; t += 0.25) {
      V.r = clamp(V.r + azar(-1, 1) * 0.12 + (0.4 - V.r) * 0.03);
      const g = 0.75 + V.r * (0.5 + 1.4 * D.rachas);
      V.racha.gain.linearRampToValueAtTime(g, t);
      V.rachaS.gain.linearRampToValueAtTime(clamp(V.r * 1.6 - 0.3), t);
      V.bp.frequency.linearRampToValueAtTime((D.nieve ? 200 : 260) + 650 * D.viento * (0.7 + V.r * 0.8), t);
      V.bpS.frequency.linearRampToValueAtTime(800 + 500 * V.r, t);
      L.respira.gain.linearRampToValueAtTime(0.88 + 0.24 * V.r * (0.4 + D.rachas), t);
      C.r = clamp(C.r + azar(-1, 1) * 0.08 + (Math.random() < 0.01 ? -0.6 : 0) + (0.65 - C.r) * 0.02, 0.05, 1);
      C.coro.gain.linearRampToValueAtTime(C.r, t);
    }

    // Gotas cercanas: en el alféizar, en el cristal, en los charcos
    if (D.lluvia) poisson(D.lluvia === 0.2 ? 3 : 5 + 32 * D.lluvia, (t) => this.gota(t, 0.05 + 0.2 * D.lluvia, 0.15));
    if (D.goteo) poisson(0.45, (t) => this.gota(t, 0.22, 0.6, 0.55));
    // Si hay tormenta y el cielo no ha tronado en un rato (o no hay relámpagos), un trueno lejano
    if (D.tormenta && t1 - this.ultimoTrueno > 18) this.trueno(false, t1 + azar(0, 4));

    poisson(D.pajaros / 60, (t) => this.pajaro(t));
    if (D.vencejos) poisson(1 / 16, (t) => this.vencejos(t));

    // Grillos: chirridos de tres pulsos; más deprisa cuanto más calor hace (ley de Dolbear)
    if (D.grillos) {
      const F = D.T * 9 / 5 + 32, porMinuto = Math.max(40, 4 * (F - 50) + 40);
      for (const g of this.grillos) {
        if (g.prox < t0) g.prox = t0 + azar(0, 0.5);
        while (g.prox < t1) {
          for (let p = 0; p < 3; p++) {
            const ts = g.prox + p * 0.026, pu = g.puerta.gain;
            pu.setValueAtTime(0, ts); pu.linearRampToValueAtTime(1, ts + 0.004); pu.setValueAtTime(1, ts + 0.012); pu.linearRampToValueAtTime(0, ts + 0.017);
          }
          g.prox += (60 / porMinuto) * g.ritmo * azar(0.96, 1.04) + (Math.random() < 0.04 ? azar(1, 4) : 0);
        }
      }
    }

    // Autillo: un «tiu» suave cada dos o tres segundos, con silencios largos de vez en cuando
    if (D.autillo) {
      if (this.prox.autillo < t0) this.prox.autillo = t0 + azar(1, 6);
      while (this.prox.autillo < t1) {
        this.autillo(this.prox.autillo);
        this.prox.autillo += Math.random() < 0.06 ? azar(15, 40) : azar(2.4, 2.9);
      }
    }
  }

  espera(tasa) { return -Math.log(1 - Math.random()) / tasa; }

  // ── Sonidos sueltos ──

  gota(t, vol, eco = 0, grave = 1) {
    const c = this.c, s = c.createBufferSource();
    s.buffer = this.muestras[(Math.random() * this.muestras.length) | 0];
    s.playbackRate.value = azar(0.75, 1.3) * grave;
    const pan = c.createStereoPanner(); pan.pan.value = azar(-0.9, 0.9);
    const g = this.ganancia(vol * azar(0.25, 1));
    this.cadena(s, g, pan, this.mezcla);
    if (eco) pan.connect(this.ganancia(eco, this.eco));
    s.start(t);
  }

  trueno(cerca, t) {
    if (!this.c) return;
    const c = this.c;
    t = t ?? c.currentTime + (cerca ? azar(0.15, 0.8) : azar(1.5, 4.5)); // la luz llega antes que el sonido
    this.ultimoTrueno = t;
    const dur = cerca ? azar(5, 8) : azar(6, 10);
    const lp = this.filtro('lowpass', cerca ? 1300 : 380, 0.5);
    lp.frequency.setValueAtTime(cerca ? 1300 : 380, t);
    lp.frequency.exponentialRampToValueAtTime(cerca ? 150 : 100, t + dur);
    // Envolvente: golpe, retumbos que van y vienen y una cola larga
    const N = 256, curva = new Float32Array(N);
    const golpes = Array.from({ length: 3 + ((Math.random() * 4) | 0) }, () => [azar(0.04, 0.7), azar(0.3, 1), azar(0.03, 0.12)]);
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      let v = Math.exp(-x * 3) * (1 - Math.exp(-x * (cerca ? 70 : 10)));
      for (const [p, a, w] of golpes) v += 0.6 * a * Math.exp(-((x - p) ** 2) / (2 * w * w)) * Math.exp(-x * 1.8);
      curva[i] = i === N - 1 ? 0 : v * (cerca ? 1.1 : 0.6);
    }
    const g = this.ganancia(0);
    g.gain.setValueCurveAtTime(curva, t, dur);
    const pan = c.createStereoPanner(); pan.pan.value = azar(-0.6, 0.6);
    const s = this.bucle(this.marron, false);
    this.cadena(s, lp, g, pan, this.mezcla);
    pan.connect(this.ganancia(0.7, this.eco));
    s.start(t, azar(0, 3)); s.stop(t + dur + 0.1);
    if (cerca) {
      // El chasquido del rayo cercano, con un par de restallidos
      for (const [d, a] of [[0, 0.8], [azar(0.04, 0.09), 0.45], [azar(0.12, 0.22), 0.3]]) {
        const s2 = this.bucle(this.blanco, false), g2 = this.ganancia(0);
        g2.gain.setValueAtTime(0, t + d); g2.gain.linearRampToValueAtTime(a, t + d + 0.004); g2.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
        this.cadena(s2, this.filtro('highpass', 900, 0.5), g2, pan);
        s2.start(t + d, azar(0, 3)); s2.stop(t + d + 0.35);
      }
    }
  }

  // Gorrión o pajarillo cualquiera: unas pocas notas cortas que suben o bajan, a lo lejos
  pajaro(t) {
    const c = this.c, pan = c.createStereoPanner(); pan.pan.value = azar(-0.85, 0.85);
    const salida = this.ganancia(azar(0.06, 0.14));
    this.cadena(salida, this.filtro('lowpass', 7000, 0.5), pan, this.mezcla);
    pan.connect(this.ganancia(0.6, this.eco));
    const base = azar(2600, 4400), notas = 2 + ((Math.random() * 5) | 0), estilo = Math.random();
    let ti = t;
    for (let i = 0; i < notas; i++) {
      const d = azar(0.035, 0.09);
      const f1 = base * (estilo < 0.5 ? azar(0.95, 1.25) : azar(1.1, 1.5)), f2 = f1 * (estilo < 0.5 ? azar(0.6, 0.85) : azar(1.15, 1.4));
      for (const [mult, a] of [[1, 1], [2, 0.18]]) {
        const o = c.createOscillator(), g = this.ganancia(0);
        o.frequency.setValueAtTime(f1 * mult, ti); o.frequency.exponentialRampToValueAtTime(f2 * mult, ti + d);
        g.gain.setValueAtTime(0, ti); g.gain.linearRampToValueAtTime(a, ti + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, ti + d);
        this.cadena(o, g, salida);
        o.start(ti); o.stop(ti + d + 0.02);
      }
      ti += d + azar(0.03, 0.12);
    }
  }

  // Vencejos: chillidos agudos de un grupo que pasa de un lado a otro
  vencejos(t) {
    const c = this.c, n = 2 + ((Math.random() * 3) | 0), dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const ti = t + i * azar(0.05, 0.35), d = azar(0.35, 0.7);
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(azar(6000, 7000), ti); o.frequency.linearRampToValueAtTime(azar(4800, 5600), ti + d);
      const vib = c.createOscillator(); vib.frequency.value = azar(35, 55);
      vib.connect(this.ganancia(azar(300, 600), o.frequency));
      const g = this.ganancia(0);
      g.gain.setValueAtTime(0, ti); g.gain.linearRampToValueAtTime(0.04, ti + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, ti + d);
      const pan = c.createStereoPanner();
      pan.pan.setValueAtTime(-0.9 * dir, ti); pan.pan.linearRampToValueAtTime(0.9 * dir, ti + d);
      this.cadena(o, this.filtro('bandpass', 6000, 1.5), g, pan, this.mezcla);
      pan.connect(this.ganancia(0.5, this.eco));
      o.start(ti); vib.start(ti); o.stop(ti + d + 0.05); vib.stop(ti + d + 0.05);
    }
  }

  autillo(t) {
    const c = this.c, o = c.createOscillator(), g = this.ganancia(0);
    o.frequency.setValueAtTime(1240, t); o.frequency.linearRampToValueAtTime(1190, t + 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.03); g.gain.setValueAtTime(0.06, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.2);
    const pan = c.createStereoPanner(); pan.pan.value = 0.35;
    this.cadena(o, g, pan, this.mezcla);
    pan.connect(this.ganancia(1, this.eco));
    o.start(t); o.stop(t + 0.25);
  }

  // ── Piezas ──

  ganancia(v, destino) {
    const g = this.c.createGain(); g.gain.value = v;
    if (destino) g.connect(destino);
    return g;
  }

  filtro(tipo, f, q) {
    const b = this.c.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q;
    return b;
  }

  cadena(...nodos) {
    for (let i = 0; i < nodos.length - 1; i++) nodos[i].connect(nodos[i + 1]);
    return nodos[nodos.length - 1];
  }

  // Ruido en bucle que empieza en un punto al azar; el principio del búfer no se usa porque el final
  // está fundido con él y así el bucle no hace clic
  bucle(b, arrancar = true) {
    const s = this.c.createBufferSource();
    s.buffer = b; s.loop = true; s.loopStart = 0.05; s.loopEnd = b.duration;
    if (arrancar) s.start(0, azar(0.05, b.duration - 0.1));
    return s;
  }

  ruido(tipo, seg = 5) {
    const c = this.c, sr = c.sampleRate, n = Math.round(sr * seg), b = c.createBuffer(2, n, sr), f = Math.round(sr * 0.05);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, u = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (tipo === 'blanco') d[i] = w * 0.5;
        else if (tipo === 'rosa') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { u = (u + 0.02 * w) / 1.02; d[i] = u * 3.5; }
      }
      for (let i = 0; i < f; i++) { const k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; }
    }
    return b;
  }

  // Reverberación de exterior: ruido que se apaga y se oscurece
  impulso(seg) {
    const c = this.c, sr = c.sampleRate, n = Math.round(sr * seg), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < n; i++) {
        const x = i / n, k = 0.5 - 0.42 * x;
        y += k * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.pow(1 - x, 3) * Math.min(1, i / (sr * 0.012)) * 0.6;
      }
    }
    return b;
  }

  // Una gota: el golpe seco y, en la mitad de ellas, la burbujita que sube de tono al caer en agua
  muestraGota(i) {
    const c = this.c, sr = c.sampleRate, n = Math.round(sr * 0.09), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    const charco = i % 2 === 0, f0 = azar(1300, 3800), sube = azar(1.3, 1.9), tau = azar(0.008, 0.022), golpe = azar(0.0012, 0.004);
    let fase = 0, lp = 0;
    for (let k = 0; k < n; k++) {
      const t = k / sr;
      lp += 0.35 * ((Math.random() * 2 - 1) - lp);
      let v = lp * Math.exp(-t / golpe) * 1.4;
      if (charco) {
        fase += (2 * Math.PI * f0 * (1 + (sube - 1) * Math.min(1, t / 0.035))) / sr;
        v += 0.5 * Math.sin(fase) * Math.exp(-t / tau) * Math.min(1, t / 0.0015);
      }
      d[k] = v;
    }
    return b;
  }
}
