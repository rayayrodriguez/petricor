import { ZONAS, PROVINCIAS, ALIAS_PROVINCIA } from './zonas.js';
import { frase, TONOS } from './frases.js';
import { Cielo } from './cielo.js';
import { icono, tipoCodigo, textoCodigo, gota, flecha } from './iconos.js';
import { alturaSol, solDia, faseLuna, posicionSol, posicionLuna, planetas, tiempoSidereo } from './astro.js';

// ---------------------------------------------------------------- configuración

const REPO = (() => {
  const h = location.hostname;
  if (h.endsWith('.github.io')) return { owner: h.split('.')[0], repo: location.pathname.split('/')[1] || 'petricor' };
  return { owner: 'rayayrodriguez', repo: 'petricor' };
})();
const DATOS = `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/datos/`;
const API = 'https://api.open-meteo.com/v1/forecast';
const API_ENS = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const API_AIRE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const API_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const MODELOS = ['dwd_icon_global_native', 'ecmwf_ifs', 'ncep_gfs_global', 'meteofrance_arpege_europe',
  'ukmo_global_deterministic_10km', 'cmc_gem_gdps', 'dwd_icon_eu_native', 'ecmwf_ifs025'];
const NOMBRES = {
  dwd_icon_global_native: 'ICON (Alemania)', ecmwf_ifs: 'ECMWF 9 km (Europa)', ncep_gfs_global: 'GFS (EE. UU.)',
  meteofrance_arpege_europe: 'ARPEGE (Francia)', ukmo_global_deterministic_10km: 'Met Office (R. Unido)',
  cmc_gem_gdps: 'GEM (Canadá)', dwd_icon_eu_native: 'ICON-EU (Alemania)', ecmwf_ifs025: 'ECMWF 25 km', consenso: 'Media de modelos'
};
const ESTACION = { id: '08417', nombre: 'Jaén (AEMET)', lat: 37.7833, lon: -3.80, elev: 582 };
const CORRECCIONES_INICIALES = {
  actualizado: null, origen: 'inicial', ventana_dias: 90,
  temperatura: { modelo: 'dwd_icon_global_native', n: 90, correccion: { tmax: 0.4, tmin: 1.3 },
    error_bruto: { tmax: 0.77, tmin: 1.43 }, error_corregido: { tmax: 0.68, tmin: 0.84 } },
  consenso: { n: 88, correccion: { tmax: 0.8, tmin: 1.7 } },
  lluvia: { modelo: 'ecmwf_ifs', dias_lluvia: 9, acertados: 8, falsas_alarmas: 10 },
  ranking: [
    { modelo: 'dwd_icon_global_native', error: 0.75, error_bruto: 1.11 }, { modelo: 'consenso', error: 0.81, error_bruto: 1.39 },
    { modelo: 'ncep_gfs_global', error: 0.95, error_bruto: 1.24 }, { modelo: 'ecmwf_ifs', error: 1.09, error_bruto: 1.25 },
    { modelo: 'meteofrance_arpege_europe', error: 1.14, error_bruto: 1.25 }, { modelo: 'ukmo_global_deterministic_10km', error: 1.26, error_bruto: 2.23 }
  ]
};
const LUGAR_JAEN = { id: 'jaen', nombre: 'Jaén', region: 'Andalucía', lat: ESTACION.lat, lon: ESTACION.lon, elev: ESTACION.elev,
  provincia: 'jaen', zonas: ['ES090', 'ES091'], pais: 'es', estacion: ESTACION.id, avisos: true };
const NIVEL = { 2: 'Amarillo', 3: 'Naranja', 4: 'Rojo' };
const CLAVE_ESTADO = 'petricor.v1';

// ---------------------------------------------------------------- utilidades

const $ = (s, r = document) => r.querySelector(s);
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const n1 = (v) => (v == null || Number.isNaN(v) ? '–' : nf1.format(Math.round(v * 10) / 10));
const r0 = (v) => (v == null || Number.isNaN(v) ? '–' : Math.round(v).toString());
const media = (a) => { const v = a.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const max = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.max(...v) : null; };
const min = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.min(...v) : null; };
const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function distanciaKm(a, b, c, d) {
  const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const formateadores = {};
function fmt(tz, opts) {
  const k = tz + JSON.stringify(opts);
  if (!formateadores[k]) formateadores[k] = new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...opts });
  return formateadores[k];
}
function partes(ms, tz) {
  const p = {};
  for (const x of fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(ms)) p[x.type] = x.value;
  return { dia: `${p.year}-${p.month}-${p.day}`, h: +p.hour, m: +p.minute, sem: p.weekday.replace('.', '') };
}
const horaTxt = (ms, tz) => fmt(tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
function nombreDia(clave, hoy, tz) {
  const dif = Math.round((Date.parse(clave) - Date.parse(hoy)) / 86400000);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Mañana';
  const ms = Date.parse(clave + 'T12:00:00Z');
  const f = fmt('UTC', { weekday: 'short', day: 'numeric' }).format(ms).replace('.', '');
  return f.charAt(0).toUpperCase() + f.slice(1);
}

async function json(url, { timeout = 20000 } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function guardarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento lleno o bloqueado */ } }
function leerLS(k, defecto = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : defecto; } catch (e) { return defecto; } }

// ---------------------------------------------------------------- estado

const estado = (() => {
  const s = leerLS(CLAVE_ESTADO);
  if (s && Array.isArray(s.lugares) && s.lugares.length) return { tono: 'socarron', actual: 0, ...s };
  return { lugares: [LUGAR_JAEN], actual: 0, tono: 'socarron' };
})();
function guardar() { guardarLS(CLAVE_ESTADO, estado); }

let correcciones = leerLS('petricor.correcciones', CORRECCIONES_INICIALES);
let avisosDatos = leerLS('petricor.avisos', { avisos: [] });
let obsJaen = leerLS('petricor.obs', null);
const memoria = {};
let cielo;

// ---------------------------------------------------------------- datos remotos

async function cargarAuxiliares() {
  const v = `?t=${Math.floor(Date.now() / 300000)}`;
  await Promise.allSettled([
    json(DATOS + 'correcciones.json' + v).then((d) => { if (d && d.temperatura) { correcciones = d; guardarLS('petricor.correcciones', d); } }),
    json(DATOS + 'avisos.json' + v).then((d) => { if (d && Array.isArray(d.avisos)) { avisosDatos = d; guardarLS('petricor.avisos', d); } }),
    json(DATOS + 'obs_jaen.json' + v).then((d) => { if (d && d.temperatura != null) { obsJaen = d; guardarLS('petricor.obs', d); } })
  ]);
}

function modeloTemp() { return MODELOS.includes(correcciones?.temperatura?.modelo) ? correcciones.temperatura.modelo : 'dwd_icon_global_native'; }
function modeloLluvia() { return MODELOS.includes(correcciones?.lluvia?.modelo) ? correcciones.lluvia.modelo : 'ecmwf_ifs'; }

function conCorreccion(lugar) {
  return lugar.estacion === ESTACION.id || distanciaKm(lugar.lat, lugar.lon, ESTACION.lat, ESTACION.lon) <= 8;
}

function url(base, lugar, params) {
  const q = new URLSearchParams({ latitude: lugar.lat, longitude: lugar.lon, timezone: 'auto', timeformat: 'unixtime', ...params });
  if (lugar.elev != null && lugar.estacion && base !== API_AIRE) q.set('elevation', lugar.elev);
  return `${base}?${q.toString()}`;
}

async function descargar(lugar) {
  const mt = modeloTemp(), ml = modeloLluvia();
  const principales = [...new Set([ml, mt])];
  const vars = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'precipitation', 'snowfall',
    'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'pressure_msl', 'cape', 'visibility'];
  const [a, b, c, d] = await Promise.allSettled([
    json(url(API, lugar, { hourly: 'temperature_2m', models: MODELOS.join(','), forecast_days: 15 })),
    json(url(API, lugar, { hourly: vars.join(','), models: principales.join(','), forecast_days: 15, wind_speed_unit: 'kmh' })),
    json(url(API_ENS, lugar, { hourly: 'precipitation', models: 'ecmwf_ifs025', forecast_days: 15 })),
    json(url(API_AIRE, lugar, { hourly: 'european_aqi,uv_index,olive_pollen,grass_pollen,birch_pollen,alder_pollen,mugwort_pollen,ragweed_pollen', forecast_days: 5 }))
  ]);
  if (b.status !== 'fulfilled') throw new Error('No se pudo descargar la previsión');
  return { A: a.status === 'fulfilled' ? a.value : null, B: b.value, C: c.status === 'fulfilled' ? c.value : null, D: d.status === 'fulfilled' ? d.value : null, mt, ml, principales };
}

function serie(resp, variable, modelo, nModelos) {
  if (!resp || !resp.hourly) return null;
  const h = resp.hourly;
  return h[`${variable}_${modelo}`] || (nModelos === 1 ? h[variable] : null) || null;
}

// ---------------------------------------------------------------- cálculo de la previsión

function procesar(bruto, lugar) {
  const { A, B, C, D, mt, ml, principales } = bruto;
  const tz = B.timezone || 'Europe/Madrid';
  const tiempos = B.hourly.time;
  const n = tiempos.length;
  const iA = A ? new Map(A.hourly.time.map((t, i) => [t, i])) : new Map();
  const iC = C ? new Map(C.hourly.time.map((t, i) => [t, i])) : new Map();
  const iD = D ? new Map(D.hourly.time.map((t, i) => [t, i])) : new Map();
  const np = principales.length;
  const b = (v, m) => serie(B, v, m, np);
  const elige = (v) => { const s1 = b(v, ml), s2 = b(v, mt); return (i) => (s1 && s1[i] != null ? s1[i] : s2 && s2[i] != null ? s2[i] : null); };

  // Temperaturas de todos los modelos (para la media)
  const tempMod = {};
  for (const m of MODELOS) tempMod[m] = serie(A, 'temperature_2m', m, MODELOS.length);
  const tPrincipal = b('temperature_2m', mt);
  const sensPrincipal = b('apparent_temperature', mt);
  const crudo = [], consenso = [];
  for (let i = 0; i < n; i++) {
    const t = tiempos[i];
    const j = iA.get(t);
    const vals = j == null ? [] : MODELOS.map((m) => (tempMod[m] ? tempMod[m][j] : null)).filter((v) => v != null);
    consenso.push(vals.length >= 3 ? media(vals) : null);
    const p = tPrincipal ? tPrincipal[i] : null;
    crudo.push(p != null ? p : j != null && tempMod[mt] ? tempMod[mt][j] : null);
  }

  // Precipitación del conjunto ECMWF (51 miembros) para la probabilidad
  let miembros = [];
  if (C && C.hourly) miembros = Object.keys(C.hourly).filter((k) => k.startsWith('precipitation')).map((k) => C.hourly[k]);

  const g = {
    prec: elige('precipitation'), nieve: elige('snowfall'), code: elige('weather_code'), nubes: elige('cloud_cover'),
    viento: elige('wind_speed_10m'), dir: elige('wind_direction_10m'), racha: elige('wind_gusts_10m'), hr: elige('relative_humidity_2m'),
    rocio: elige('dew_point_2m'), pres: elige('pressure_msl'), cape: elige('cape'), vis: elige('visibility')
  };

  const hoy = partes(Date.now(), tz).dia;
  const horas = [];
  for (let i = 0; i < n; i++) {
    const ms = tiempos[i] * 1000, p = partes(ms, tz);
    horas.push({ ms, dia: p.dia, h: p.h, crudo: crudo[i], cons: consenso[i], sens: sensPrincipal ? sensPrincipal[i] : null,
      prec: g.prec(i), nieve: g.nieve(i), code: g.code(i), nubes: g.nubes(i), viento: g.viento(i), dir: g.dir(i), racha: g.racha(i),
      hr: g.hr(i), rocio: g.rocio(i), pres: g.pres(i), cape: g.cape(i), vis: g.vis(i),
      esDia: alturaSol(ms, lugar.lat, lugar.lon) > -0.83 });
  }

  // Probabilidad horaria: miembros con al menos 0,2 mm en la ventana de 3 horas
  if (miembros.length) {
    for (const hr of horas) {
      const j = iC.get(hr.ms / 1000);
      if (j == null) continue;
      let si = 0, tot = 0;
      for (const s of miembros) {
        const v = (s[j - 1] || 0) + (s[j] || 0) + (s[j + 1] || 0);
        if (s[j] == null && s[j - 1] == null && s[j + 1] == null) continue;
        tot++; if (v >= 0.2) si++;
      }
      hr.prob = tot ? Math.round((si / tot) * 100) : null;
    }
  }
  // Aire y UV
  if (D && D.hourly) {
    for (const hr of horas) {
      const j = iD.get(hr.ms / 1000);
      if (j == null) continue;
      hr.uv = D.hourly.uv_index?.[j] ?? null;
      hr.aqi = D.hourly.european_aqi?.[j] ?? null;
      hr.polen = { olivo: D.hourly.olive_pollen?.[j], gramineas: D.hourly.grass_pollen?.[j], abedul: D.hourly.birch_pollen?.[j],
        aliso: D.hourly.alder_pollen?.[j], artemisa: D.hourly.mugwort_pollen?.[j], ambrosia: D.hourly.ragweed_pollen?.[j] };
    }
  }

  // Correcciones locales y elección por plazo
  const usarCorr = conCorreccion(lugar);
  const cP = usarCorr ? (correcciones.temperatura?.correccion || { tmax: 0, tmin: 0 }) : { tmax: 0, tmin: 0 };
  const cC = usarCorr ? (correcciones.consenso?.correccion || { tmax: 0, tmin: 0 }) : { tmax: 0, tmin: 0 };
  const porDia = new Map();
  for (const hr of horas) { if (!porDia.has(hr.dia)) porDia.set(hr.dia, []); porDia.get(hr.dia).push(hr); }
  const corrHora = (lista, campo, c) => {
    const vals = lista.map((x) => x[campo]).filter((v) => v != null);
    const mx = Math.max(...vals), mn = Math.min(...vals);
    return (v) => (v == null ? null : v + c.tmin + (mx > mn ? clamp((v - mn) / (mx - mn), 0, 1) : 0.5) * (c.tmax - c.tmin));
  };
  for (const [dia, lista] of porDia) {
    const dd = Math.round((Date.parse(dia) - Date.parse(hoy)) / 86400000);
    const fP = corrHora(lista, 'crudo', cP), fC = corrHora(lista, 'cons', cC);
    for (const hr of lista) {
      const p = fP(hr.crudo), c = fC(hr.cons);
      let t;
      if (dd <= 1) { t = p ?? c; hr.fuente = p != null ? mt : 'consenso'; }
      else if (dd === 2) { t = p != null && c != null ? (p + c) / 2 : p ?? c; hr.fuente = 'mezcla'; }
      else { t = c ?? p; hr.fuente = c != null ? 'consenso' : mt; }
      hr.temp = t;
      if (hr.sens != null && hr.crudo != null && t != null) hr.sens = hr.sens + (t - hr.crudo);
      else hr.sens = t;
    }
  }

  // Días
  const dias = [];
  for (const [dia, lista] of porDia) {
    if (lista.length < 18) continue;
    const temps = lista.map((x) => x.temp);
    const diurnas = lista.filter((x) => x.h >= 7 && x.h <= 21);
    let prob = null;
    if (miembros.length) {
      const idx = lista.map((x) => iC.get(x.ms / 1000)).filter((j) => j != null);
      if (idx.length >= 18) {
        let si = 0, tot = 0;
        for (const s of miembros) {
          const vals = idx.map((j) => s[j]);
          if (vals.every((v) => v == null)) continue;
          tot++; if (sum(vals) >= 1) si++;
        }
        prob = tot ? Math.round((si / tot) * 100) : null;
      }
    }
    const capeMax = max(lista.map((x) => x.cape));
    const horasTormenta = lista.filter((x) => x.code >= 95).length;
    let tormenta = 'bajo';
    const pr = prob ?? 0;
    if ((horasTormenta >= 2 && pr >= 40) || (capeMax >= 1500 && pr >= 40)) tormenta = 'alto';
    else if (horasTormenta >= 1 || (capeMax >= 700 && pr >= 25)) tormenta = 'moderado';
    const sd = solDia(Date.parse(dia + 'T12:00:00Z'), lugar.lat, lugar.lon);
    let code = codigoDia(diurnas.length ? diurnas : lista);
    if (prob != null && prob >= 60 && rango(code) < 5) code = 80;
    dias.push({
      dia, tmax: max(temps), tmin: min(temps), prec: sum(lista.map((x) => x.prec)), nieve: sum(lista.map((x) => x.nieve)),
      prob, code, racha: max(lista.map((x) => x.racha)), viento: max(lista.map((x) => x.viento)),
      uv: max(lista.map((x) => x.uv)), tormenta, capeMax, salida: sd.salida, puesta: sd.puesta,
      fuente: lista[12]?.fuente || lista[0].fuente, horas: lista
    });
  }
  return { tz, horas, dias, hoy, usarCorr, mt, ml, actualizado: Date.now() };
}

function rango(c) {
  const t = tipoCodigo(c);
  return { despejado: 0, pocas_nubes: 1, nubes: 2, cubierto: 3, niebla: 4, llovizna: 5, nieve: 7, lluvia: 6, lluvia_fuerte: 8, tormenta: 9 }[t] ?? 2;
}
function codigoDia(lista) {
  const cuenta = new Map();
  for (const x of lista) if (x.code != null) cuenta.set(x.code, (cuenta.get(x.code) || 0) + 1);
  let mejor = null, rMejor = -1;
  for (const [c, k] of cuenta) {
    const r = rango(c);
    const valido = r >= 9 ? k >= 1 : r >= 5 ? k >= 2 : true;
    if (valido && r > rMejor) { rMejor = r; mejor = c; }
  }
  if (rMejor <= 3) {
    const nubes = media(lista.map((x) => x.nubes));
    if (nubes != null) return nubes < 15 ? 0 : nubes < 45 ? 1 : nubes < 80 ? 2 : 3;
  }
  return mejor ?? 2;
}

// ---------------------------------------------------------------- avisos oficiales

function avisosDe(lugar) {
  if (!lugar.zonas || !lugar.zonas.length) return [];
  const ahora = Date.now();
  const grupos = new Map();
  for (const a of avisosDatos.avisos || []) {
    if (!lugar.zonas.includes(a.zona) || Date.parse(a.fin) <= ahora) continue;
    const k = [a.nivel, a.tipo, a.inicio, a.fin].join('|');
    if (grupos.has(k)) grupos.get(k).zonas.push(a.nombre);
    else grupos.set(k, { ...a, zonas: [a.nombre] });
  }
  return [...grupos.values()].sort((a, b) => b.nivel - a.nivel || Date.parse(a.inicio) - Date.parse(b.inicio));
}

// ---------------------------------------------------------------- pintado

function lugarActual() { return estado.lugares[clamp(estado.actual, 0, estado.lugares.length - 1)]; }

function pintarPuntos() {
  const cont = $('#puntos');
  cont.innerHTML = estado.lugares.map((l, i) =>
    `<button role="tab" aria-selected="${i === estado.actual}" class="punto${i === estado.actual ? ' activo' : ''}" data-i="${i}" title="${esc(l.nombre)}"><span>${esc(l.nombre)}</span></button>`).join('');
  cont.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => irA(+b.dataset.i)));
}

function horaActual(mod) {
  const ahora = Date.now();
  let k = 0;
  for (let i = 0; i < mod.horas.length; i++) if (mod.horas[i].ms <= ahora) k = i;
  return k;
}

// Al abrir la app o cambiar de lugar, las tarjetas entran con un leve desplazamiento
let ultimoPintado = null;
function entrada(id) {
  if (ultimoPintado === id) return;
  ultimoPintado = id;
  const m = $('#contenido');
  m.classList.remove('entra'); void m.offsetWidth; m.classList.add('entra');
}

function pintar(mod, lugar) {
  entrada(lugar.id);
  const tz = mod.tz;
  mod.hoy = partes(Date.now(), tz).dia;
  const k = horaActual(mod);
  const h0 = mod.horas[k], h1 = mod.horas[k + 1] || h0;
  const f = clamp((Date.now() - h0.ms) / 3600000, 0, 1);
  let tAhora = h0.temp != null && h1.temp != null ? h0.temp + (h1.temp - h0.temp) * f : h0.temp;
  const hoyD = mod.dias.find((d) => d.dia === mod.hoy) || mod.dias.find((d) => d.dia > mod.hoy) || mod.dias[0];
  const manana = mod.dias[mod.dias.indexOf(hoyD) + 1];

  // Medición real en Jaén
  const medicion = $('#medicion');
  medicion.hidden = true;
  if (lugar.estacion === ESTACION.id && obsJaen && obsJaen.temperatura != null) {
    const edad = (Date.now() - Date.parse(obsJaen.hora)) / 60000;
    if (edad < 100) {
      tAhora = obsJaen.temperatura;
      medicion.hidden = false;
      medicion.textContent = `Medido en la estación de AEMET a las ${horaTxt(Date.parse(obsJaen.hora), tz)}`;
    }
  }

  $('#lugar-nombre').textContent = lugar.gps ? `${lugar.nombre} · tu ubicación` : lugar.nombre;
  $('#hora-local').textContent = fmt(tz, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Date.now());
  $('#temp-ahora').innerHTML = `${r0(tAhora)}<span class="grado">°</span>`;
  $('#estado-ahora').textContent = textoCodigo(h0.code);
  $('#extremos').innerHTML = `Máx <b>${r0(hoyD.tmax)}°</b> · Mín <b>${r0(hoyD.tmin)}°</b> · Sensación <b>${r0(h0.sens)}°</b>`;

  const avisos = avisosDe(lugar);
  const proximas3 = mod.horas.slice(k, k + 3);
  const mes = +mod.hoy.slice(5, 7);
  const ctx = {
    fecha: mod.hoy, tmax: hoyD.tmax, tmin: hoyD.tmin, probHoy: hoyD.prob ?? (hoyD.prec >= 1 ? 60 : 0), mmHoy: hoyD.prec,
    lluviaPronto: proximas3.some((x) => (x.prec || 0) >= 0.3 && (x.prob == null || x.prob >= 50)),
    nieveHoy: hoyD.nieve >= 0.5, niebla: tipoCodigo(h0.code) === 'niebla', rachaMax: hoyD.racha || 0,
    deltaManana: manana ? manana.tmax - hoyD.tmax : 0, nubes: h0.nubes ?? 50, esDia: h0.esDia,
    tormenta: hoyD.tormenta, avisoNivel: avisos.filter((a) => Date.parse(a.inicio) < Date.now() + 36 * 3600000).reduce((m, a) => Math.max(m, a.nivel), 0),
    campanaAceituna: (lugar.provincia === 'jaen' || lugar.provincia === 'cordoba') && (mes >= 11 || mes <= 2),
    enJaen: lugar.provincia === 'jaen'
  };
  ultimoCtx = ctx;
  $('#frase').textContent = frase(ctx, estado.tono);

  pintarAvisos(avisos, hoyD, mod, tz);
  pintarLinea(mod, k, tz);
  pintarDias(mod, tz);
  pintarDetalles(mod, k, hoyD, lugar, tz);
  pintarPrecision(mod, lugar);
  $('#nota-horas').textContent = mod.usarCorr ? 'Con corrección local' : '';
  $('#actualizado').textContent = `Actualizado a las ${horaTxt(mod.actualizado, tz)}.`;

  // Cielo
  const alt = alturaSol(Date.now(), lugar.lat, lugar.lon);
  const sd = solDia(Date.now(), lugar.lat, lugar.lon);
  const mediodia = sd.salida && sd.puesta ? (sd.salida + sd.puesta) / 2 : Date.now();
  const fase = alt < -6 ? 'noche' : alt < 6 ? (Date.now() < mediodia ? 'alba' : 'ocaso') : 'dia';
  const solPos = sd.salida && sd.puesta ? (Date.now() - sd.salida) / (sd.puesta - sd.salida) : 0.5;
  let tipo = tipoCodigo(h0.code);
  if (lugar.estacion === ESTACION.id && obsJaen && obsJaen.ww != null) {
    const ww = obsJaen.ww;
    if (ww >= 95) tipo = 'tormenta'; else if (ww >= 70 && ww <= 79) tipo = 'nieve'; else if (ww >= 50 && ww <= 69) tipo = 'lluvia'; else if (ww >= 40 && ww <= 49) tipo = 'niebla';
  }
  const ahoraMs = Date.now(), ps = posicionSol(ahoraMs, lugar.lat, lugar.lon), pl = posicionLuna(ahoraMs, lugar.lat, lugar.lon), fl = faseLuna(ahoraMs);
  cielo.set({ tipo, fase, solPos, nubes: h0.nubes ?? 40, viento: h0.viento ?? 8, intensidad: h0.prec || 0,
    altSol: ps.altitud, azSol: ps.azimut, altLuna: pl.altitud, azLuna: pl.azimut, luna: fl.fase, iluminada: fl.iluminada,
    lat: lugar.lat, tsl: tiempoSidereo(ahoraMs, lugar.lon), planetas: planetas(ahoraMs, lugar.lat, lugar.lon),
    poblacion: lugar.poblacion ?? (lugar.id === 'jaen' ? 112000 : null) });
  document.querySelector('meta[name="theme-color"]').setAttribute('content', fase === 'noche' ? '#0b1226' : '#2a4f86');
}

function pintarAvisos(avisos, hoyD, mod, tz) {
  const cont = $('#avisos');
  const chips = [];
  for (const a of avisos.slice(0, 4)) {
    const ini = Date.parse(a.inicio), fin = Date.parse(a.fin);
    const cuando = Date.now() >= ini ? `hasta las ${horaTxt(fin, tz)}` : `${nombreDia(partes(ini, tz).dia, mod.hoy, tz).toLowerCase()} desde las ${horaTxt(ini, tz)}`;
    chips.push(`<button class="chip nivel-${a.nivel}" data-aviso><span class="chip-nivel">${NIVEL[a.nivel]}</span> ${esc(a.fenomeno)} · ${esc(cuando)}</button>`);
  }
  const riesgo = mod.dias.filter((d) => d.dia >= mod.hoy).slice(0, 2).find((d) => d.tormenta !== 'bajo');
  if (riesgo && !avisos.some((a) => a.tipo === 3)) {
    chips.push(`<span class="chip chip-tormenta">${riesgo.tormenta === 'alto' ? 'Riesgo alto' : 'Riesgo moderado'} de tormenta ${nombreDia(riesgo.dia, mod.hoy, tz).toLowerCase()}</span>`);
  }
  cont.hidden = !chips.length;
  cont.innerHTML = chips.join('');
  cont.querySelectorAll('[data-aviso]').forEach((b) => b.addEventListener('click', () => abrirAvisos(avisos, tz)));
}

function abrirAvisos(avisos, tz) {
  $('#aviso-cuerpo').innerHTML = avisos.map((a) => `
    <article class="aviso-detalle nivel-${a.nivel}">
      <p class="aviso-cab"><span class="chip-nivel">${NIVEL[a.nivel]}</span> ${esc(a.fenomeno)}</p>
      <p class="aviso-zona">${esc((a.zonas || [a.nombre]).join(' · '))}</p>
      <p class="aviso-hora">${esc(fmt(tz, { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Date.parse(a.inicio)))} – ${esc(fmt(tz, { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Date.parse(a.fin)))}</p>
      ${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}
      ${a.instruccion ? `<p class="texto-suave">${esc(a.instruccion)}</p>` : ''}
    </article>`).join('') + '<p class="texto-suave">Fuente: AEMET, distribuido por MeteoAlarm.</p>';
  abrirHoja('hoja-aviso');
}

function suave(puntos) {
  if (puntos.length < 2) return '';
  let d = `M${puntos[0][0]},${puntos[0][1]}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] || puntos[i], p1 = puntos[i], p2 = puntos[i + 1], p3 = puntos[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function pintarLinea(mod, k, tz) {
  const horas = mod.horas.slice(k, k + 48);
  const ancho = 56, alto = 226, n = horas.length;
  const temps = horas.map((h) => h.temp).filter((v) => v != null);
  const tmx = Math.max(...temps), tmn = Math.min(...temps);
  const y = (t) => 132 - ((t - tmn) / Math.max(tmx - tmn, 4)) * 52;
  const pts = horas.map((h, i) => [i * ancho + ancho / 2, h.temp != null ? y(h.temp) : 110]);
  const maxPrec = Math.max(2, ...horas.map((h) => h.prec || 0));
  let s = `<svg class="grafico" width="${n * ancho}" height="${alto}" viewBox="0 0 ${n * ancho} ${alto}" role="img" aria-label="Temperatura y lluvia por horas">`;
  s += `<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a" stop-opacity=".32"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></linearGradient></defs>`;
  const linea = suave(pts);
  s += `<path d="${linea} L${pts[n - 1][0]},150 L${pts[0][0]},150 Z" fill="url(#gArea)"/>`;
  s += `<path d="${linea}" fill="none" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"/>`;
  horas.forEach((h, i) => {
    const x = i * ancho;
    const cx = x + ancho / 2;
    if (h.h === 0 && i > 0) {
      s += `<line x1="${x}" y1="6" x2="${x}" y2="${alto - 6}" class="sep-dia"/>`;
      s += `<text x="${x + 6}" y="14" class="etq-dia">${esc(nombreDia(h.dia, mod.hoy, tz))}</text>`;
    }
    s += `<text x="${cx}" y="30" class="etq-hora" text-anchor="middle">${i === 0 ? 'Ahora' : String(h.h).padStart(2, '0')}</text>`;
    s += `<g transform="translate(${cx - 13} 38)">${icono(h.code, h.esDia, 26)}</g>`;
    s += `<circle cx="${cx}" cy="${pts[i][1]}" r="2.4" fill="#ffd27a"/>`;
    s += `<text x="${cx}" y="${pts[i][1] - 8}" class="etq-temp" text-anchor="middle">${r0(h.temp)}°</text>`;
    const p = h.prec || 0;
    const hb = p > 0.05 ? Math.max(3, (p / maxPrec) * 38) : 0;
    s += `<rect x="${cx - 9}" y="${196 - hb}" width="18" height="${hb}" rx="3" class="barra-lluvia" opacity="${h.prob == null ? 0.9 : 0.35 + 0.65 * (h.prob / 100)}"/>`;
    if (p >= 0.1) s += `<text x="${cx}" y="${190 - hb}" class="etq-mm" text-anchor="middle">${n1(p)}</text>`;
    s += `<text x="${cx}" y="214" class="etq-prob" text-anchor="middle">${h.prob != null && h.prob >= 10 ? h.prob + '%' : ''}</text>`;
  });
  s += `<line x1="0" y1="196.5" x2="${n * ancho}" y2="196.5" class="base-lluvia"/>`;
  s += '</svg>';
  $('#linea-tiempo').innerHTML = s;
}

function colorTemp(t) {
  const paradas = [[-5, [120, 160, 255]], [5, [125, 200, 255]], [15, [140, 225, 190]], [22, [255, 214, 120]], [30, [255, 150, 80]], [38, [240, 80, 70]]];
  if (t <= paradas[0][0]) return `rgb(${paradas[0][1]})`;
  for (let i = 0; i < paradas.length - 1; i++) {
    const [a, ca] = paradas[i], [b, cb] = paradas[i + 1];
    if (t <= b) { const f = (t - a) / (b - a); return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * f)).join(',')})`; }
  }
  return `rgb(${paradas[paradas.length - 1][1]})`;
}

function pintarDias(mod, tz) {
  const dias = mod.dias.filter((d) => d.dia >= mod.hoy).slice(0, 15);
  const gmx = Math.max(...dias.map((d) => d.tmax)), gmn = Math.min(...dias.map((d) => d.tmin));
  const pos = (t) => ((t - gmn) / Math.max(gmx - gmn, 1)) * 100;
  $('#dias').innerHTML = dias.map((d, i) => {
    const prob = d.prob != null ? d.prob : null;
    const lluvia = prob != null && prob >= 10 ? `<span class="prob">${gota(10)} ${prob}%</span>` : '<span class="prob"></span>';
    return `<li class="dia" data-i="${i}">
      <button class="dia-fila" aria-expanded="false">
        <span class="dia-nombre">${esc(nombreDia(d.dia, mod.hoy, tz))}</span>
        <span class="dia-ico">${icono(d.code, true, 28)}</span>
        ${lluvia}
        <span class="dia-min">${r0(d.tmin)}°</span>
        <span class="dia-barra"><span style="left:${pos(d.tmin)}%;right:${100 - pos(d.tmax)}%;background:linear-gradient(90deg, ${colorTemp(d.tmin)}, ${colorTemp(d.tmax)})"></span></span>
        <span class="dia-max">${r0(d.tmax)}°</span>
      </button>
      <div class="dia-detalle" hidden></div>
    </li>`;
  }).join('');
  $('#dias').querySelectorAll('.dia').forEach((li) => {
    li.querySelector('.dia-fila').addEventListener('click', () => {
      const det = li.querySelector('.dia-detalle');
      const abierto = !det.hidden;
      det.hidden = abierto;
      li.querySelector('.dia-fila').setAttribute('aria-expanded', String(!abierto));
      if (!abierto && !det.innerHTML) det.innerHTML = detalleDia(dias[+li.dataset.i], mod, tz);
    });
  });
}

function detalleDia(d, mod, tz) {
  const pasos = d.horas.filter((h) => h.h % 3 === 0);
  const fuente = d.fuente === 'consenso' ? 'Media de modelos' : d.fuente === 'mezcla' ? 'Mezcla de ICON y media de modelos' : (NOMBRES[d.fuente] || 'ICON');
  return `
    <div class="mini-horas">${pasos.map((h) => `<div><span>${String(h.h).padStart(2, '0')}</span>${icono(h.code, h.esDia, 24)}<b>${r0(h.temp)}°</b><small>${h.prob != null && h.prob >= 10 ? h.prob + '%' : ''}</small></div>`).join('')}</div>
    <dl class="datos-dia">
      <div><dt>Lluvia</dt><dd>${n1(d.prec)} mm${d.prob != null ? ` · ${d.prob}%` : ''}</dd></div>
      <div><dt>Viento</dt><dd>${r0(d.viento)} km/h, rachas ${r0(d.racha)}</dd></div>
      <div><dt>Sol</dt><dd>${d.salida ? horaTxt(d.salida, tz) : '–'} – ${d.puesta ? horaTxt(d.puesta, tz) : '–'}</dd></div>
      ${d.uv != null ? `<div><dt>UV máximo</dt><dd>${r0(d.uv)}</dd></div>` : ''}
      ${d.tormenta !== 'bajo' ? `<div><dt>Tormentas</dt><dd>Riesgo ${d.tormenta}</dd></div>` : ''}
      ${d.nieve >= 0.5 ? `<div><dt>Nieve</dt><dd>${n1(d.nieve)} cm</dd></div>` : ''}
      <div><dt>Temperatura</dt><dd>${esc(fuente)}${mod.usarCorr ? ', corregida' : ''}</dd></div>
    </dl>`;
}

function beaufort(v) {
  const t = [[2, 'Calma'], [6, 'Ventolina'], [12, 'Flojito'], [20, 'Flojo'], [29, 'Moderado'], [39, 'Fresquito'], [50, 'Fresco'], [62, 'Frescachón'], [75, 'Temporal'], [89, 'Temporal fuerte'], [103, 'Temporal duro'], [118, 'Borrasca']];
  for (const [l, n] of t) if (v < l) return n;
  return 'Huracán';
}
function puntoCardinal(g) { return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(((g % 360) + 360) % 360 / 45) % 8]; }

function nivelUV(u) { return u < 3 ? 'Bajo' : u < 6 ? 'Moderado' : u < 8 ? 'Alto' : u < 11 ? 'Muy alto' : 'Extremo'; }
function nivelAire(a) { return a < 20 ? 'Buena' : a < 40 ? 'Razonable' : a < 60 ? 'Regular' : a < 80 ? 'Mala' : a < 100 ? 'Muy mala' : 'Extremadamente mala'; }
const UMBRALES_POLEN = { olivo: [50, 200], gramineas: [25, 50], abedul: [30, 200], aliso: [30, 100], artemisa: [10, 50], ambrosia: [10, 50] };
const NOMBRE_POLEN = { olivo: 'Olivo', gramineas: 'Gramíneas', abedul: 'Abedul', aliso: 'Aliso', artemisa: 'Artemisa', ambrosia: 'Ambrosía' };

function pintarDetalles(mod, k, hoyD, lugar, tz) {
  const h = mod.horas[k];
  const obs = lugar.estacion === ESTACION.id && obsJaen && (Date.now() - Date.parse(obsJaen.hora)) / 60000 < 100 ? obsJaen : null;
  const viento = obs?.viento ?? h.viento, racha = hoyD.racha, dir = obs?.direccion ?? h.dir;
  const humedad = obs?.humedad ?? h.hr, rocio = obs?.rocio ?? h.rocio, presion = obs?.presion ?? h.pres;
  const p3 = mod.horas[k + 3]?.pres, tendencia = presion != null && p3 != null ? p3 - h.pres : 0;
  const hoyHoras = hoyD.horas;
  const sd = solDia(Date.now(), lugar.lat, lugar.lon);
  const luna = faseLuna(Date.now());
  const tarjetas = [];

  // Viento
  tarjetas.push(`<article class="mosaico">
    <h3>Viento</h3>
    <div class="brujula" aria-hidden="true">
      <svg viewBox="0 0 100 100" width="92" height="92"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
      ${Array.from({ length: 36 }, (_, i) => { const a = i * 10 * Math.PI / 180, l = i % 9 === 0 ? 7 : 3; return `<line x1="${50 + 44 * Math.sin(a)}" y1="${50 - 44 * Math.cos(a)}" x2="${50 + (44 - l) * Math.sin(a)}" y2="${50 - (44 - l) * Math.cos(a)}" stroke="rgba(255,255,255,${i % 9 === 0 ? 0.6 : 0.25})" stroke-width="1"/>`; }).join('')}
      <text x="50" y="17" text-anchor="middle" class="card-pt">N</text>
      <g transform="rotate(${(dir ?? 0) + 180} 50 50)"><path d="M50 14 L56 50 L50 44 L44 50 Z" fill="#ffd27a"/><line x1="50" y1="50" x2="50" y2="82" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/></g>
      </svg>
      <div class="brujula-valor"><b>${r0(viento)}</b><span>km/h</span></div>
    </div>
    <p class="mosaico-pie">${beaufort(viento || 0)} del ${puntoCardinal(dir ?? 0)} · rachas hoy ${r0(racha)} km/h</p>
  </article>`);

  // Humedad
  tarjetas.push(`<article class="mosaico">
    <h3>Humedad</h3>
    <p class="mosaico-valor">${r0(humedad)}<small>%</small></p>
    <p class="mosaico-pie">Punto de rocío ${r0(rocio)}°. ${humedad >= 85 ? 'Ambiente muy húmedo.' : humedad <= 30 ? 'Aire muy seco.' : 'Ambiente normal.'}</p>
  </article>`);

  // Presión
  tarjetas.push(`<article class="mosaico">
    <h3>Presión</h3>
    <p class="mosaico-valor">${r0(presion)}<small>hPa</small></p>
    <p class="mosaico-pie">${Math.abs(tendencia) < 0.6 ? 'Estable en las próximas horas.' : tendencia > 0 ? 'Subiendo: tiende a mejorar.' : 'Bajando: tiende a empeorar.'}</p>
  </article>`);

  // UV
  if (hoyD.uv != null) {
    tarjetas.push(`<article class="mosaico">
      <h3>Índice UV</h3>
      <p class="mosaico-valor">${r0(hoyD.uv)}<small>${nivelUV(hoyD.uv)}</small></p>
      <div class="escala-uv"><span style="left:${clamp(hoyD.uv / 11 * 100, 0, 100)}%"></span></div>
      <p class="mosaico-pie">${hoyD.uv >= 6 ? 'Protección solar entre las 12 y las 17.' : 'Sin necesidad especial de protección.'}</p>
    </article>`);
  }

  // Sol
  if (sd.salida && sd.puesta) {
    const p = clamp((Date.now() - sd.salida) / (sd.puesta - sd.salida), 0, 1);
    const ang = Math.PI * (1 - p), sx = 50 + 40 * Math.cos(ang), sy = 56 - 40 * Math.sin(ang);
    const durMin = Math.round((sd.puesta - sd.salida) / 60000);
    const deNoche = Date.now() < sd.salida || Date.now() > sd.puesta;
    tarjetas.push(`<article class="mosaico">
      <h3>Sol</h3>
      <svg viewBox="0 0 100 64" width="100%" height="64" aria-hidden="true"><path d="M10 56 A40 40 0 0 1 90 56" fill="none" stroke="rgba(255,255,255,.25)" stroke-dasharray="3 4"/>
      <line x1="4" y1="56" x2="96" y2="56" stroke="rgba(255,255,255,.25)"/>
      ${deNoche ? '' : `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="#ffd27a"/>`}</svg>
      <p class="mosaico-pie">Sale ${horaTxt(sd.salida, tz)} · se pone ${horaTxt(sd.puesta, tz)}<br>${Math.floor(durMin / 60)} h ${durMin % 60} min de luz</p>
    </article>`);
  }

  // Luna
  const k1 = 1 - 2 * luna.iluminada;
  tarjetas.push(`<article class="mosaico">
    <h3>Luna</h3>
    <svg viewBox="0 0 60 60" width="54" height="54" aria-hidden="true"><circle cx="30" cy="30" r="22" fill="rgba(40,48,70,.9)"/>
      <path d="M30 8 A22 22 0 0 ${luna.fase < 0.5 ? 1 : 0} 30 52 A${Math.abs(k1) * 22} 22 0 0 ${(k1 > 0) === (luna.fase < 0.5) ? 0 : 1} 30 8 Z" fill="#f2f0e6"/></svg>
    <p class="mosaico-pie">${luna.nombre} · ${Math.round(luna.iluminada * 100)}% iluminada</p>
  </article>`);

  // Aire y polen
  const aqi = max(hoyHoras.map((x) => x.aqi));
  if (aqi != null) {
    tarjetas.push(`<article class="mosaico">
      <h3>Calidad del aire</h3>
      <p class="mosaico-valor">${r0(aqi)}<small>${nivelAire(aqi)}</small></p>
      <p class="mosaico-pie">Índice europeo, máximo previsto hoy.</p>
    </article>`);
  }
  const polen = {};
  for (const x of hoyHoras) if (x.polen) for (const [t, v] of Object.entries(x.polen)) if (v != null) polen[t] = Math.max(polen[t] || 0, v);
  const tipos = Object.entries(polen).filter(([, v]) => v >= 1).sort((a, b) => b[1] / UMBRALES_POLEN[b[0]][1] - a[1] / UMBRALES_POLEN[a[0]][1]);
  if (tipos.length) {
    const nivel = (t, v) => (v >= UMBRALES_POLEN[t][1] ? 'alto' : v >= UMBRALES_POLEN[t][0] ? 'moderado' : 'bajo');
    tarjetas.push(`<article class="mosaico">
      <h3>Polen</h3>
      <ul class="polen">${tipos.slice(0, 3).map(([t, v]) => `<li><span>${NOMBRE_POLEN[t]}</span><b class="nivel-polen ${nivel(t, v)}">${nivel(t, v)}</b></li>`).join('')}</ul>
      <p class="mosaico-pie">Máximo previsto hoy (Copernicus).</p>
    </article>`);
  }

  // Lluvia hoy
  const proxima = mod.horas.slice(k, k + 24).find((x) => (x.prec || 0) >= 0.2 && (x.prob == null || x.prob >= 40));
  tarjetas.push(`<article class="mosaico">
    <h3>Lluvia</h3>
    <p class="mosaico-valor">${n1(hoyD.prec)}<small>mm hoy</small></p>
    <p class="mosaico-pie">${proxima ? `Próxima lluvia ${proxima.dia === mod.hoy ? 'hoy' : nombreDia(proxima.dia, mod.hoy, tz).toLowerCase()} hacia las ${horaTxt(proxima.ms, tz)}.` : 'Sin lluvia en las próximas 24 horas.'}${hoyD.prob != null ? ` Probabilidad hoy ${hoyD.prob}%.` : ''}</p>
  </article>`);

  $('#detalles').innerHTML = tarjetas.join('');
}

function pintarPrecision(mod, lugar) {
  const c = correcciones, cont = $('#precision-cuerpo');
  const mt = NOMBRES[mod.mt] || mod.mt, ml = NOMBRES[mod.ml] || mod.ml;
  const fecha = c.actualizado ? new Date(c.actualizado).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : null;
  let html = '';
  if (mod.usarCorr) {
    const ct = c.temperatura?.correccion || {}, cc = c.consenso?.correccion || {};
    const eb = c.temperatura?.error_bruto, ec = c.temperatura?.error_corregido;
    const signo = (v) => (v > 0 ? '+' : '') + n1(v);
    html += `<p>Temperatura de hoy y mañana: <b>${esc(mt)}</b>, corregido con la estación de AEMET en Jaén: máxima ${signo(ct.tmax)} °C, mínima ${signo(ct.tmin)} °C. Desde pasado mañana, media de varios modelos con su propia corrección: máxima ${signo(cc.tmax)} °C, mínima ${signo(cc.tmin)} °C.</p>`;
    if (eb && ec) html += `<p>Error medio en los últimos ${c.temperatura.n || c.ventana_dias} días: ${n1((eb.tmax + eb.tmin) / 2)} °C sin corregir, ${n1((ec.tmax + ec.tmin) / 2)} °C con la corrección.</p>`;
    const rk = (c.ranking || []).slice(0, 6);
    if (rk.length) {
      html += `<table class="ranking"><caption>Acierto en Jaén, previsión para el día siguiente</caption><thead><tr><th>Modelo</th><th>Error medio</th></tr></thead><tbody>${rk.map((r) =>
        `<tr${r.modelo === mod.mt ? ' class="elegido"' : ''}><td>${esc(NOMBRES[r.modelo] || r.modelo)}</td><td>${n1(r.error)} °C</td></tr>`).join('')}</tbody></table>`;
    }
    const ll = c.lluvia || {};
    html += `<p>Lluvia: <b>${esc(ml)}</b>${ll.dias_lluvia ? `, que detectó ${ll.acertados} de ${ll.dias_lluvia} días de lluvia` : ''}. La probabilidad sale de los 51 escenarios del conjunto de ECMWF.</p>`;
    html += `<p class="texto-suave">${fecha ? `Correcciones recalculadas el ${fecha} comparando con lo que midió la estación.` : 'Correcciones iniciales de la prueba de agosto a noviembre de 2026; se recalculan solas cada mañana.'}</p>`;
  } else {
    html += `<p>Temperatura de hoy y mañana: <b>${esc(mt)}</b>; desde pasado mañana, media de varios modelos. Lluvia: <b>${esc(ml)}</b>, con la probabilidad de los 51 escenarios de ECMWF.</p>`;
    html += '<p class="texto-suave">Las correcciones locales solo se aplican cerca de la estación de AEMET en Jaén, porque se calculan con sus mediciones.</p>';
  }
  cont.innerHTML = html;
}

// ---------------------------------------------------------------- carga

let cargando = false;
async function cargar(forzar = false) {
  if (cargando) return;
  cargando = true;
  const lugar = lugarActual();
  pintarPuntos();
  $('#lugar-nombre').textContent = lugar.nombre;
  const clave = `petricor.datos.${lugar.id}`;
  try {
    if (lugar.gps && forzar) await refrescarGPS(lugar);
    const cache = memoria[lugar.id] || leerLS(clave);
    if (cache && cache.horas) { memoria[lugar.id] = cache; pintar(cache, lugar); }
    const viejo = !cache || Date.now() - cache.actualizado > 15 * 60000;
    const aux = cargarAuxiliares();
    if (forzar || viejo) {
      await aux;
      const mod = procesar(await descargar(lugar), lugar);
      memoria[lugar.id] = mod;
      guardarLS(clave, mod);
      if (lugarActual().id === lugar.id) pintar(mod, lugar);
    } else {
      await aux;
      if (lugarActual().id === lugar.id) pintar(cache, lugar);
    }
  } catch (e) {
    console.error(e);
    const cache = memoria[lugar.id];
    $('#hora-local').textContent = cache ? 'Sin conexión: mostrando la última previsión guardada.' : 'No se pudo cargar la previsión. Comprueba la conexión y vuelve a intentarlo.';
  } finally {
    cargando = false;
  }
}

function irA(i) {
  estado.actual = (i + estado.lugares.length) % estado.lugares.length;
  guardar();
  cargar();
}

// ---------------------------------------------------------------- hojas

function abrirHoja(id) {
  const h = document.getElementById(id);
  h.hidden = false;
  requestAnimationFrame(() => h.classList.add('abierta'));
}
function cerrarHoja(h) {
  h.classList.remove('abierta');
  setTimeout(() => { h.hidden = true; }, 220);
}
document.querySelectorAll('.hoja').forEach((h) => h.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => cerrarHoja(h))));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.hoja.abierta').forEach(cerrarHoja); });

// ---------------------------------------------------------------- lugares

function provinciaDe(texto) {
  let t = normalizar(texto).replace(/^provincia de /, '').replace(/^provincia /, '');
  for (const parte of [t, ...t.split(/\s*[\/-]\s*/)]) {
    if (PROVINCIAS[parte]) return parte;
    if (ALIAS_PROVINCIA[parte]) return ALIAS_PROVINCIA[parte];
  }
  return null;
}

async function datosAdministrativos(lat, lon) {
  try {
    const d = await json(`${NOMINATIM}/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=es&lat=${lat}&lon=${lon}`);
    const a = d.address || {};
    const pais = (a.country_code || '').toLowerCase();
    const prov = provinciaDe(a.province || a.state_district || a.county || '') || provinciaDe(a.state || '');
    const nombre = a.city || a.town || a.village || a.municipality || a.hamlet || d.name || '';
    return { pais, provincia: prov, nombre, region: a.state || a.country || '' };
  } catch (e) { return { pais: '', provincia: null, nombre: '', region: '' }; }
}

async function buscarLugares(q) {
  const res = [];
  try {
    const d = await json(`${API_GEO}?name=${encodeURIComponent(q)}&count=8&language=es`);
    for (const r of d.results || []) res.push({ nombre: r.name, region: [r.admin2 || r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude, pais: (r.country_code || '').toLowerCase(), prov: r.admin2 || '', poblacion: r.population || null });
  } catch (e) { /* se intenta con OpenStreetMap */ }
  if (res.length < 2) {
    try {
      const d = await json(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=es&featureType=settlement&q=${encodeURIComponent(q)}`);
      for (const r of d) {
        const a = r.address || {};
        const nombre = a.city || a.town || a.village || a.municipality || r.name;
        if (res.some((x) => Math.abs(x.lat - r.lat) < 0.02 && Math.abs(x.lon - r.lon) < 0.02)) continue;
        res.push({ nombre, region: [a.province || a.county || a.state, a.country].filter(Boolean).join(', '), lat: +r.lat, lon: +r.lon, pais: (a.country_code || '').toLowerCase(), prov: a.province || a.county || '',
          poblacion: a.city ? 100000 : a.town ? 10000 : a.village ? 1500 : null });
      }
    } catch (e) { /* sin resultados */ }
  }
  return res;
}

async function nuevoLugar(r, gps = false) {
  let provincia = r.pais === 'es' ? provinciaDe(r.prov) : null;
  let nombre = r.nombre, region = r.region, pais = r.pais;
  if (gps || (r.pais === 'es' && !provincia) || !pais) {
    const adm = await datosAdministrativos(r.lat, r.lon);
    provincia = provincia || adm.provincia; pais = pais || adm.pais;
    if (!nombre) nombre = adm.nombre || 'Mi ubicación';
    if (!region) region = adm.region;
  }
  const zonas = pais === 'es' && provincia ? PROVINCIAS[provincia].zonas.filter((z) => +z.slice(2) < 840) : [];
  return { id: 'l' + Date.now().toString(36), nombre, region, lat: +(+r.lat).toFixed(4), lon: +(+r.lon).toFixed(4), elev: null,
    provincia, zonas, pais, estacion: null, gps, avisos: false, poblacion: r.poblacion ?? null };
}

function pintarMisLugares() {
  $('#mis-lugares').innerHTML = estado.lugares.map((l, i) => {
    const prov = l.provincia ? PROVINCIAS[l.provincia] : null;
    const opciones = prov ? prov.zonas.filter((z) => +z.slice(2) < 840).map((z) =>
      `<label class="zona"><input type="checkbox" data-zona="${z}" ${l.zonas.includes(z) ? 'checked' : ''}> ${esc(ZONAS[z] || z)}</label>`).join('') : '';
    return `<li class="mi-lugar" data-i="${i}">
      <div class="mi-lugar-cab">
        <div><b>${esc(l.nombre)}</b>${l.gps ? ' <small>ubicación</small>' : ''}<br><small>${esc(l.region || '')}</small></div>
        <div class="acciones">
          <button class="boton-mini" data-accion="subir" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
          <button class="boton-mini" data-accion="bajar" ${i === estado.lugares.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
          <button class="boton-mini peligro" data-accion="borrar" ${estado.lugares.length === 1 ? 'disabled' : ''} aria-label="Quitar">✕</button>
        </div>
      </div>
      ${prov ? `<details class="zonas"><summary>Zonas de aviso de ${esc(prov.nombre)}</summary>${opciones}</details>` : '<p class="texto-suave">Sin avisos oficiales: solo hay avisos de AEMET para lugares de España.</p>'}
      <label class="interruptor"><input type="checkbox" data-accion="push" ${l.avisos ? 'checked' : ''} ${prov ? '' : 'disabled'}> Avisarme al móvil de avisos naranja y rojo</label>
    </li>`;
  }).join('');
  $('#mis-lugares').querySelectorAll('.mi-lugar').forEach((li) => {
    const i = +li.dataset.i, l = estado.lugares[i];
    li.querySelectorAll('[data-accion]').forEach((b) => b.addEventListener(b.type === 'checkbox' ? 'change' : 'click', () => {
      const a = b.dataset.accion;
      if (a === 'subir' && i > 0) [estado.lugares[i - 1], estado.lugares[i]] = [estado.lugares[i], estado.lugares[i - 1]];
      if (a === 'bajar' && i < estado.lugares.length - 1) [estado.lugares[i + 1], estado.lugares[i]] = [estado.lugares[i], estado.lugares[i + 1]];
      if (a === 'borrar') { estado.lugares.splice(i, 1); estado.actual = 0; }
      if (a === 'push') { l.avisos = b.checked; marcarCodigoDesfasado(); }
      guardar(); pintarMisLugares(); pintarPuntos();
    }));
    li.querySelectorAll('[data-zona]').forEach((c) => c.addEventListener('change', () => {
      const z = c.dataset.zona;
      l.zonas = c.checked ? [...new Set([...l.zonas, z])] : l.zonas.filter((x) => x !== z);
      guardar(); marcarCodigoDesfasado();
    }));
  });
}

let temporizador;
$('#buscar').addEventListener('input', (e) => {
  clearTimeout(temporizador);
  const q = e.target.value.trim();
  if (q.length < 2) { $('#resultados').innerHTML = ''; return; }
  temporizador = setTimeout(async () => {
    const res = await buscarLugares(q);
    $('#resultados').innerHTML = res.length ? res.map((r, i) => `<li><button data-i="${i}"><b>${esc(r.nombre)}</b><small>${esc(r.region)}</small></button></li>`).join('') : '<li class="texto-suave">Sin resultados. Prueba con otro nombre.</li>';
    $('#resultados').querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
      const l = await nuevoLugar(res[+b.dataset.i]);
      estado.lugares.push(l); estado.actual = estado.lugares.length - 1; guardar();
      $('#buscar').value = ''; $('#resultados').innerHTML = '';
      pintarMisLugares(); cargar();
    }));
  }, 350);
});

function posicion() {
  return new Promise((ok, mal) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => ok(p.coords), mal, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }) : mal(new Error('sin GPS')));
}
async function refrescarGPS(lugar) {
  try {
    const c = await posicion();
    if (distanciaKm(c.latitude, c.longitude, lugar.lat, lugar.lon) > 2) {
      const n = await nuevoLugar({ lat: c.latitude, lon: c.longitude }, true);
      Object.assign(lugar, { ...n, id: lugar.id, avisos: lugar.avisos });
      guardar();
    }
  } catch (e) { /* se queda con la última posición */ }
}
$('#btn-ubicacion').addEventListener('click', async () => {
  const msg = $('#ubicacion-msg');
  msg.hidden = false; msg.textContent = 'Buscando tu ubicación…';
  try {
    const c = await posicion();
    if (estado.lugares.some((l) => l.gps)) estado.lugares = estado.lugares.filter((l) => !l.gps);
    const l = await nuevoLugar({ lat: c.latitude, lon: c.longitude }, true);
    estado.lugares.push(l); estado.actual = estado.lugares.length - 1; guardar();
    msg.hidden = true; pintarMisLugares(); cargar();
  } catch (e) {
    msg.textContent = 'No se pudo obtener la ubicación. Revisa que Petricor tenga permiso de localización en Ajustes del iPhone.';
  }
});

// ---------------------------------------------------------------- avisos al móvil

const b64u = {
  de: (s) => { const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); },
  a: (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
};

function zonasAvisos() {
  return [...new Set(estado.lugares.filter((l) => l.avisos).flatMap((l) => l.zonas))];
}
function marcarCodigoDesfasado() {
  const p = leerLS('petricor.push');
  if (p && JSON.stringify(p.zonas) !== JSON.stringify(zonasAvisos())) { p.desfasado = true; guardarLS('petricor.push', p); }
}

function esIPhone() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function instalada() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

function pintarPush() {
  const cont = $('#push-cuerpo');
  const p = leerLS('petricor.push');
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || (esIPhone() && !instalada())) {
    cont.innerHTML = `<p class="texto-suave">Para recibir avisos con la app cerrada, primero instala Petricor: en Safari toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>. Ábrela desde ese icono y vuelve aquí.</p>`;
    return;
  }
  const zonas = zonasAvisos();
  const nombres = zonas.map((z) => ZONAS[z] || z);
  let html = `<p class="texto-suave">Te avisaré de los avisos naranja y rojo de AEMET en: <b>${nombres.length ? esc(nombres.join(', ')) : 'ninguna zona'}</b>. Elige las zonas en Lugares.</p>`;
  if (p && p.codigo && !p.desfasado) {
    html += `<p>Avisos preparados en este iPhone. Si aún no lo has hecho, guarda este código en GitHub:</p>`;
  } else if (p && p.desfasado) {
    html += `<p>Has cambiado tus zonas: genera el código otra vez y sustitúyelo en GitHub.</p>`;
  }
  html += `<button class="boton-ancho" id="btn-push">${p && p.codigo ? 'Generar el código otra vez' : 'Activar avisos en este iPhone'}</button>`;
  if (p && p.codigo) {
    html += `<textarea id="codigo-push" readonly rows="4" aria-label="Código de avisos">${esc(p.codigo)}</textarea>
      <button class="boton-ancho" id="btn-copiar">Copiar código</button>
      <ol class="pasos">
        <li>Abre <b>github.com/${esc(REPO.owner)}/${esc(REPO.repo)}</b> → <b>Settings</b> → <b>Secrets and variables</b> → <b>Actions</b>.</li>
        <li>Pulsa <b>New repository secret</b>. Si este móvil ya tenía código, edita su secreto en vez de crear otro.</li>
        <li>Nombre: <b>PUSH_CONFIG</b> para el primer móvil, <b>PUSH_CONFIG_2</b> para el segundo y <b>PUSH_CONFIG_3</b> para el tercero. Valor: pega el código.</li>
        <li>En unos 15 minutos te llegará una notificación de confirmación.</li>
      </ol>`;
  }
  html += '<p class="aviso-texto" id="push-msg" hidden></p>';
  cont.innerHTML = html;
  $('#btn-push').addEventListener('click', activarPush);
  const bc = $('#btn-copiar');
  if (bc) bc.addEventListener('click', async () => {
    const ta = $('#codigo-push');
    try { await navigator.clipboard.writeText(ta.value); bc.textContent = 'Copiado'; }
    catch (e) { ta.focus(); ta.select(); bc.textContent = 'Selecciona y copia el texto'; }
  });
}

async function activarPush() {
  const msg = () => $('#push-msg');
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { msg().hidden = false; msg().textContent = 'Sin permiso para notificaciones. Actívalo en Ajustes del iPhone → Notificaciones → Petricor.'; return; }
    const reg = await navigator.serviceWorker.ready;
    let claves = leerLS('petricor.vapid');
    if (!claves) {
      const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const pub = b64u.a(await crypto.subtle.exportKey('raw', par.publicKey));
      const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
      claves = { pub, d: jwk.d };
      guardarLS('petricor.vapid', claves);
    }
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const actual = sub.options && sub.options.applicationServerKey ? b64u.a(sub.options.applicationServerKey) : null;
      if (actual && actual !== claves.pub) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u.de(claves.pub) });
    const zonas = zonasAvisos();
    const cfg = { v: 1, sub: sub.toJSON(), vapid: { d: claves.d }, zonas, nivel: 3, sitio: location.origin + location.pathname };
    const codigo = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
    guardarLS('petricor.push', { codigo, zonas, desfasado: false });
    pintarPush();
  } catch (e) {
    console.error(e);
    msg().hidden = false; msg().textContent = 'No se pudo activar: ' + (e.message || e);
  }
}

// ---------------------------------------------------------------- ajustes

let ultimoCtx = null;
function pintarTonos() {
  $('#tonos').innerHTML = TONOS.map((t) => `<button role="radio" aria-checked="${estado.tono === t.id}" data-t="${t.id}">${t.nombre}</button>`).join('');
  // Qué hace cada tono y cómo resumiría hoy el tiempo del lugar que estás viendo
  $('#tonos-info').innerHTML = TONOS.map((t) => `<li class="${estado.tono === t.id ? 'activo' : ''}"><b>${t.nombre}.</b> ${esc(t.desc)}${ultimoCtx ? `<span class="ejemplo">Hoy: «${esc(frase(ultimoCtx, t.id))}»</span>` : ''}</li>`).join('');
  $('#tonos').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    estado.tono = b.dataset.t; guardar(); pintarTonos();
    const lugar = lugarActual(); if (memoria[lugar.id]) pintar(memoria[lugar.id], lugar);
  }));
}

$('#btn-lugares').addEventListener('click', () => { pintarMisLugares(); abrirHoja('hoja-lugares'); setTimeout(() => $('#buscar').focus(), 250); });
$('#btn-ajustes').addEventListener('click', () => { pintarTonos(); pintarPush(); abrirHoja('hoja-ajustes'); });
$('#btn-recargar').addEventListener('click', () => { cerrarHoja($('#hoja-ajustes')); cargar(true); });

// Deslizar entre lugares sobre la cabecera
(() => {
  const hero = $('#hero');
  let x0 = null, y0 = null;
  hero.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && estado.lugares.length > 1) irA(estado.actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const c = memoria[lugarActual().id];
    if (!c || Date.now() - c.actualizado > 15 * 60000) cargar();
  }
});

// ---------------------------------------------------------------- arranque

cielo = new Cielo($('#cielo'));
cielo.arrancar();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
cargar();
setInterval(() => { const c = memoria[lugarActual().id]; if (c) pintar(c, lugarActual()); }, 60000);
