// Cálculos astronómicos sencillos (algoritmo de la NOAA): sol y luna.

const rad = Math.PI / 180;

function parametros(fechaUTC) {
  const inicio = Date.UTC(fechaUTC.getUTCFullYear(), 0, 1);
  const dia = Math.floor((fechaUTC.getTime() - inicio) / 86400000) + 1;
  const horas = fechaUTC.getUTCHours() + fechaUTC.getUTCMinutes() / 60;
  const g = (2 * Math.PI / 365) * (dia - 1 + (horas - 12) / 24);
  const ecuacion = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { ecuacion, decl };
}

// Altura del sol en grados para un instante (ms) y lugar
export function alturaSol(ms, lat, lon) {
  const f = new Date(ms);
  const { ecuacion, decl } = parametros(f);
  const minutos = f.getUTCHours() * 60 + f.getUTCMinutes() + f.getUTCSeconds() / 60;
  const tst = minutos + ecuacion + 4 * lon;
  const ha = (tst / 4 - 180) * rad;
  const cosZ = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / rad;
}

// Altura y acimut del sol. El acimut se mide desde el sur, positivo hacia el oeste
export function posicionSol(ms, lat, lon) {
  const f = new Date(ms);
  const { ecuacion, decl } = parametros(f);
  const minutos = f.getUTCHours() * 60 + f.getUTCMinutes() + f.getUTCSeconds() / 60;
  const ha = ((minutos + ecuacion + 4 * lon) / 4 - 180) * rad;
  return horizontales(ha, lat * rad, decl);
}

// Altura y acimut de la luna, con una precisión de alrededor de un grado
export function posicionLuna(ms, lat, lon) {
  const d = ms / 86400000 - 10957.5; // días desde J2000
  const e = 23.4397 * rad;
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const H = rad * (280.16 + 360.9856235 * d) + lon * rad - ra;
  const p = horizontales(H, lat * rad, dec);
  p.altitud -= 0.95 * Math.cos(p.altitud * rad); // paralaje: la luna está cerca
  return p;
}

// Tiempo sidéreo local en grados: dice qué parte del cielo estrellado está sobre el lugar
export function tiempoSidereo(ms, lon) {
  const d = ms / 86400000 - 10957.5;
  return ((280.16 + 360.9856235 * d + lon) % 360 + 360) % 360;
}

// Venus, Marte, Júpiter y Saturno con los elementos orbitales de Paul Schlyter (error de alrededor de un grado)
const ORBITAS = {
  Venus: (d) => [76.6799 + 2.4659e-5 * d, 3.3946 + 2.75e-8 * d, 54.891 + 1.38374e-5 * d, 0.72333, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d],
  Marte: (d) => [49.5574 + 2.11081e-5 * d, 1.8497 - 1.78e-8 * d, 286.5016 + 2.92961e-5 * d, 1.523688, 0.093405 + 2.516e-9 * d, 18.6021 + 0.5240207766 * d],
  'Júpiter': (d) => [100.4542 + 2.76854e-5 * d, 1.303 - 1.557e-7 * d, 273.8777 + 1.64505e-5 * d, 5.20256, 0.048498 + 4.469e-9 * d, 19.895 + 0.0830853001 * d],
  Saturno: (d) => [113.6634 + 2.3898e-5 * d, 2.4886 - 1.081e-7 * d, 339.3939 + 2.97661e-5 * d, 9.55475, 0.055546 - 9.499e-9 * d, 316.967 + 0.0334442282 * d]
};
const BRILLO = { Venus: [-4.34, 0.013], Marte: [-1.51, 0.016], 'Júpiter': [-9.25, 0.014], Saturno: [-9.0, 0.044] };

function kepler(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

export function planetas(ms, lat, lon) {
  const d = ms / 86400000 - 10956; // días desde el 0 de enero de 2000
  const ecl = (23.4393 - 3.563e-7 * d) * rad;
  // Sol visto desde la Tierra
  const ws = (282.9404 + 4.70935e-5 * d) * rad, es = 0.016709 - 1.151e-9 * d, Ms = ((356.047 + 0.9856002585 * d) % 360) * rad;
  const Es = kepler(Ms, es), xvs = Math.cos(Es) - es, yvs = Math.sqrt(1 - es * es) * Math.sin(Es);
  const rs = Math.hypot(xvs, yvs), ls = Math.atan2(yvs, xvs) + ws;
  const xs = rs * Math.cos(ls), ys = rs * Math.sin(ls);
  const tsl = tiempoSidereo(ms, lon) * rad;
  return Object.entries(ORBITAS).map(([nombre, f]) => {
    const [N0, i0, w0, a, e, M0] = f(d), N = N0 * rad, i = i0 * rad, w = w0 * rad, M = ((M0 % 360) + 360) % 360 * rad;
    const E = kepler(M, e), xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv), r = Math.hypot(xv, yv);
    const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
    const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
    const zh = r * Math.sin(v + w) * Math.sin(i);
    const xg = xh + xs, yg = yh + ys, zg = zh;
    const xe = xg, ye = yg * Math.cos(ecl) - zg * Math.sin(ecl), ze = yg * Math.sin(ecl) + zg * Math.cos(ecl);
    const ra = Math.atan2(ye, xe), dec = Math.atan2(ze, Math.hypot(xe, ye));
    const R = Math.hypot(xg, yg, zg);
    const fase = Math.acos(Math.max(-1, Math.min(1, (r * r + R * R - rs * rs) / (2 * r * R)))) / rad;
    const [m0, k] = BRILLO[nombre];
    const p = horizontales(tsl - ra, lat * rad, dec);
    let mag = m0 + 5 * Math.log10(r * R) + k * fase + (nombre === 'Venus' ? 4.2e-7 * fase ** 3 : 0);
    if (nombre === 'Venus') mag = Math.max(-4.7, mag);
    return { nombre, altitud: p.altitud, azimut: p.azimut, mag };
  });
}

function horizontales(H, phi, dec) {
  return {
    altitud: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad,
    azimut: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / rad
  };
}

// Salida y puesta del sol (ms UTC) para el día que contiene el instante ms (día civil UTC aproximado)
export function solDia(ms, lat, lon) {
  const f = new Date(ms);
  const medio = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), 12));
  const { ecuacion, decl } = parametros(medio);
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH > 1) return { salida: null, puesta: null, polar: 'noche' };
  if (cosH < -1) return { salida: null, puesta: null, polar: 'dia' };
  const H = Math.acos(cosH) / rad;
  const base = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  const salida = base + (720 - 4 * (lon + H) - ecuacion) * 60000;
  const puesta = base + (720 - 4 * (lon - H) - ecuacion) * 60000;
  return { salida, puesta };
}

// Fase lunar: 0 = nueva, 0.5 = llena
export function faseLuna(ms) {
  const jd = ms / 86400000 + 2440587.5;
  const ciclo = 29.530588853;
  let f = ((jd - 2451550.1) / ciclo) % 1;
  if (f < 0) f += 1;
  const iluminada = (1 - Math.cos(2 * Math.PI * f)) / 2;
  const nombres = ['Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente', 'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante'];
  const nombre = nombres[Math.round(f * 8) % 8];
  return { fase: f, iluminada, nombre };
}
