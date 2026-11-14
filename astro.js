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

// Posición de la luna con los elementos de Paul Schlyter y sus principales perturbaciones:
// el error es de pocos minutos de arco, suficiente para la fase y para colocarla en el cielo
function lunaEcliptica(ms) {
  const d = ms / 86400000 - 10956; // días desde el 0 de enero de 2000
  const n = (x) => ((x % 360) + 360) % 360;
  const N = n(125.1228 - 0.0529538083 * d), i = 5.1454, w = n(318.0634 + 0.1643573223 * d);
  const a = 60.2666, e = 0.0549, M = n(115.3654 + 13.0649929509 * d);
  let E = M * rad + e * Math.sin(M * rad) * (1 + e * Math.cos(M * rad));
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M * rad) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r = Math.hypot(xv, yv);
  const xh = r * (Math.cos(N * rad) * Math.cos(v + w * rad) - Math.sin(N * rad) * Math.sin(v + w * rad) * Math.cos(i * rad));
  const yh = r * (Math.sin(N * rad) * Math.cos(v + w * rad) + Math.cos(N * rad) * Math.sin(v + w * rad) * Math.cos(i * rad));
  const zh = r * Math.sin(v + w * rad) * Math.sin(i * rad);
  let lon = Math.atan2(yh, xh) / rad, lat = Math.atan2(zh, Math.hypot(xh, yh)) / rad;
  // Sol
  const Ms = n(356.047 + 0.9856002585 * d), ws = 282.9404 + 4.70935e-5 * d, es = 0.016709 - 1.151e-9 * d;
  const Es = Ms * rad + es * Math.sin(Ms * rad) * (1 + es * Math.cos(Ms * rad));
  const lonSol = n(Math.atan2(Math.sqrt(1 - es * es) * Math.sin(Es), Math.cos(Es) - es) / rad + ws);
  // Perturbaciones
  const Ls = Ms + ws, Lm = N + w + M, D = (Lm - Ls) * rad, F = (Lm - N) * rad, Mm = M * rad, Mr = Ms * rad;
  lon += -1.274 * Math.sin(Mm - 2 * D) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Mr) - 0.059 * Math.sin(2 * Mm - 2 * D)
    - 0.057 * Math.sin(Mm - 2 * D + Mr) + 0.053 * Math.sin(Mm + 2 * D) + 0.046 * Math.sin(2 * D - Mr) + 0.041 * Math.sin(Mm - Mr)
    - 0.035 * Math.sin(D) - 0.031 * Math.sin(Mm + Mr) - 0.015 * Math.sin(2 * F - 2 * D) + 0.011 * Math.sin(Mm - 4 * D);
  lat += -0.173 * Math.sin(F - 2 * D) - 0.055 * Math.sin(Mm - F - 2 * D) - 0.046 * Math.sin(Mm + F - 2 * D)
    + 0.033 * Math.sin(F + 2 * D) + 0.017 * Math.sin(2 * Mm + F);
  return { lon: n(lon), lat, lonSol, d };
}

// Altura y acimut de la luna vistos desde el lugar
export function posicionLuna(ms, lat, lon) {
  const m = lunaEcliptica(ms);
  const ecl = (23.4393 - 3.563e-7 * m.d) * rad, l = m.lon * rad, b = m.lat * rad;
  const ra = Math.atan2(Math.sin(l) * Math.cos(ecl) - Math.tan(b) * Math.sin(ecl), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(ecl) + Math.cos(b) * Math.sin(ecl) * Math.sin(l));
  const p = horizontales(tiempoSidereo(ms, lon) * rad - ra, lat * rad, dec);
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
  // Fase real a partir de la separación entre la luna y el sol, no de un ciclo medio
  const m = lunaEcliptica(ms);
  const dif = ((m.lon - m.lonSol) % 360 + 360) % 360;
  const elong = Math.acos(Math.cos(m.lat * rad) * Math.cos(dif * rad));
  const iluminada = (1 - Math.cos(elong)) / 2;
  const f = dif / 360;
  const nombres = ['Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente', 'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante'];
  const nombre = nombres[Math.round(f * 8) % 8];
  return { fase: f, iluminada, nombre };
}
