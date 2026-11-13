// Cálculo de la previsión de Petricor. Sin nada de la pantalla: lo usan la app y, en GitHub,
// el guardado diario de lo que se pronosticó para comprobar después cuánto acierta.
import { tipoCodigo } from './iconos.js';
import { alturaSol, solDia } from './astro.js';

export const API = 'https://api.open-meteo.com/v1/forecast';
export const API_ENS = 'https://ensemble-api.open-meteo.com/v1/ensemble';
export const API_AIRE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export const MODELOS = ['dwd_icon_global_native', 'ecmwf_ifs', 'ncep_gfs_global', 'meteofrance_arpege_europe',
  'ukmo_global_deterministic_10km', 'cmc_gem_gdps', 'dwd_icon_eu_native', 'ecmwf_ifs025'];
export const ESTACION = { id: '08417', nombre: 'Jaén (AEMET)', lat: 37.7833, lon: -3.80, elev: 582 };
export const CORRECCIONES_INICIALES = {
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

export const media = (a) => { const v = a.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const max = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.max(...v) : null; };
export const min = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.min(...v) : null; };
export const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function distanciaKm(a, b, c, d) {
  const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const formateadores = {};
export function fmt(tz, opts) {
  const k = tz + JSON.stringify(opts);
  if (!formateadores[k]) formateadores[k] = new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...opts });
  return formateadores[k];
}
export function partes(ms, tz) {
  const p = {};
  for (const x of fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(ms)) p[x.type] = x.value;
  return { dia: `${p.year}-${p.month}-${p.day}`, h: +p.hour, m: +p.minute, sem: p.weekday.replace('.', '') };
}

export async function json(url, { timeout = 20000 } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export function modeloTemp(corr) { return MODELOS.includes(corr?.temperatura?.modelo) ? corr.temperatura.modelo : 'dwd_icon_global_native'; }
export function modeloLluvia(corr) { return MODELOS.includes(corr?.lluvia?.modelo) ? corr.lluvia.modelo : 'ecmwf_ifs'; }

export function conCorreccion(lugar) {
  return lugar.estacion === ESTACION.id || distanciaKm(lugar.lat, lugar.lon, ESTACION.lat, ESTACION.lon) <= 8;
}

function url(base, lugar, params) {
  const q = new URLSearchParams({ latitude: lugar.lat, longitude: lugar.lon, timezone: 'auto', timeformat: 'unixtime', ...params });
  if (lugar.elev != null && lugar.estacion && base !== API_AIRE) q.set('elevation', lugar.elev);
  return `${base}?${q.toString()}`;
}

export async function descargar(lugar, corr) {
  const mt = modeloTemp(corr), ml = modeloLluvia(corr);
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

export function procesar(bruto, lugar, corr = CORRECCIONES_INICIALES) {
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
  const cP = usarCorr ? (corr?.temperatura?.correccion || { tmax: 0, tmin: 0 }) : { tmax: 0, tmin: 0 };
  const cC = usarCorr ? (corr?.consenso?.correccion || { tmax: 0, tmin: 0 }) : { tmax: 0, tmin: 0 };
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

export function rango(c) {
  const t = tipoCodigo(c);
  return { despejado: 0, pocas_nubes: 1, nubes: 2, cubierto: 3, niebla: 4, llovizna: 5, nieve: 7, lluvia: 6, lluvia_fuerte: 8, tormenta: 9 }[t] ?? 2;
}
export function codigoDia(lista) {
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
