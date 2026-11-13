// Cada mañana guarda lo que Petricor pronostica para Jaén en los próximos días, con el mismo
// código que usa la app. Más tarde, avisos.py lo compara con lo que midió la estación de AEMET.
// Se lanza cada 15 minutos con el resto de tareas, pero solo trabaja una vez al día.
import fs from 'node:fs';
import path from 'node:path';
import { descargar, procesar, partes, ESTACION, CORRECCIONES_INICIALES, max, min } from '../prevision.js';

const DATOS = process.env.PETRICOR_DATOS || 'datos';
const ARCHIVO = path.join(DATOS, 'verificacion.json');
const HORA = 9; // previsión de las 9 de la mañana, hora de Madrid
const PLAZOS = [1, 2, 3, 4, 5];
const LUGAR = { id: 'jaen', nombre: 'Jaén', lat: ESTACION.lat, lon: ESTACION.lon, elev: ESTACION.elev, estacion: ESTACION.id, provincia: 'jaen' };

const leer = (archivo, defecto) => { try { return JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { return defecto; } };
const r1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const ahora = Date.now();
const { dia: hoy, h } = partes(ahora, 'Europe/Madrid');
const ver = leer(ARCHIVO, null) || {
  estacion: ESTACION, empieza: hoy,
  criterio: { temperatura: 'Acierto si el error es de 2 °C o menos', lluvia: 'Día de lluvia: 1 mm o más. Petricor lo da por lluvioso con una probabilidad del 50 % o más' },
  emisiones: [], dias: {}
};
if (ver.emisiones.includes(hoy)) { console.log(`La previsión de hoy (${hoy}) ya está guardada.`); process.exit(0); }
if (h < HORA && !process.env.FORZAR) { console.log(`Aún no son las ${HORA}:00 en Madrid.`); process.exit(0); }

const corr = leer(path.join(DATOS, 'correcciones.json'), CORRECCIONES_INICIALES);
let mod = null;
for (let i = 1; i <= 3 && !mod; i++) {
  try { mod = procesar(await descargar(LUGAR, corr), LUGAR, corr); }
  catch (e) { console.log(`Intento ${i}: ${e.message}`); if (i < 3) await espera(20000); }
}
if (!mod) { console.log('No se pudo descargar la previsión; se intentará en la próxima vuelta.'); process.exit(0); }

const emitida = new Date(ahora).toISOString().slice(0, 16) + 'Z';
let n = 0;
for (const d of mod.dias) {
  const plazo = Math.round((Date.parse(d.dia) - Date.parse(hoy)) / 86400000);
  if (!PLAZOS.includes(plazo)) continue;
  const e = (ver.dias[d.dia] ||= { prev: {}, obs: null });
  e.prev[plazo] = {
    emitida, tmax: r1(d.tmax), tmin: r1(d.tmin), prob: d.prob, mm: r1(d.prec), code: d.code,
    // Sin la corrección local, para saber si la corrección mejora o empeora
    tmaxBruto: r1(max(d.horas.map((x) => x.crudo))), tminBruto: r1(min(d.horas.map((x) => x.crudo))),
    fuente: d.fuente
  };
  n++;
}
ver.emisiones.push(hoy);
fs.mkdirSync(DATOS, { recursive: true });
fs.writeFileSync(ARCHIVO, JSON.stringify(ver, null, 1) + '\n');
console.log(`Guardada la previsión de hoy (${hoy}) para ${n} días.`);
