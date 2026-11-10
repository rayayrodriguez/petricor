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
