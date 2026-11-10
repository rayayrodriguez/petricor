// Iconos del tiempo dibujados a mano en SVG (trazo fino, coherente en toda la app).

const SOL = '#ffd27a', AGUA = '#9fd3ff', RAYO = '#ffe27a', LUNA = '#f3efe2';

const nube = (dx = 0, dy = 0, relleno = 'rgba(255,255,255,.14)') =>
  `<path transform="translate(${dx} ${dy})" d="M9.5 24h13.2a5.3 5.3 0 0 0 .6-10.56A7.3 7.3 0 0 0 9.4 12.6 5.7 5.7 0 0 0 9.5 24z" fill="${relleno}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`;

const sol = (cx = 16, cy = 16, r = 5, rayos = true) => {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SOL}" stroke="${SOL}" stroke-width="1.2"/>`;
  if (rayos) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, r1 = r + 2.6, r2 = r + 5;
      s += `<line x1="${(cx + r1 * Math.cos(a)).toFixed(2)}" y1="${(cy + r1 * Math.sin(a)).toFixed(2)}" x2="${(cx + r2 * Math.cos(a)).toFixed(2)}" y2="${(cy + r2 * Math.sin(a)).toFixed(2)}" stroke="${SOL}" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }
  return s;
};

const luna = (dx = 0, dy = 0, esc = 1) =>
  `<path transform="translate(${dx} ${dy}) scale(${esc})" d="M20.5 19.6A8 8 0 0 1 12.4 7.5a8 8 0 1 0 8.1 12.1z" fill="${LUNA}" stroke="${LUNA}" stroke-width="1" stroke-linejoin="round"/>`;

const gotas = (n, largo = 3.4) => {
  const xs = n === 2 ? [13, 19] : n === 3 ? [11.5, 16, 20.5] : [10, 14, 18, 22];
  return xs.map((x) => `<line x1="${x}" y1="26.5" x2="${x - 1.6}" y2="${26.5 + largo}" stroke="${AGUA}" stroke-width="1.6" stroke-linecap="round"/>`).join('');
};

const puntos = () => [12, 16, 20].map((x) => `<circle cx="${x - 1}" cy="28.4" r="1" fill="${AGUA}"/>`).join('');

const copos = () => [11.5, 16.5, 21.5].map((x) =>
  `<g stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"><line x1="${x}" y1="25.8" x2="${x}" y2="30.2"/><line x1="${x - 2}" y1="27" x2="${x + 2}" y2="29"/><line x1="${x - 2}" y1="29" x2="${x + 2}" y2="27"/></g>`).join('');

const rayo = () => `<path d="M17.2 22.6l-3 5h3.2l-1.6 4.2 4.8-6h-3.3l1.8-3.2z" fill="${RAYO}" stroke="${RAYO}" stroke-width=".6" stroke-linejoin="round"/>`;

const niebla = () => [12, 16.5, 21, 25.5].map((y, i) =>
  `<line x1="${6 + (i % 2) * 2}" y1="${y}" x2="${26 - (i % 2) * 2}" y2="${y}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="${1 - i * 0.12}"/>`).join('');

// Clasificación de códigos WMO
export function tipoCodigo(c) {
  if (c == null) return 'nubes';
  if (c === 0) return 'despejado';
  if (c === 1) return 'pocas_nubes';
  if (c === 2) return 'nubes';
  if (c === 3) return 'cubierto';
  if (c === 45 || c === 48) return 'niebla';
  if (c >= 51 && c <= 57) return 'llovizna';
  if (c === 65 || c === 67 || c === 82) return 'lluvia_fuerte';
  if ((c >= 61 && c <= 66) || c === 80 || c === 81) return 'lluvia';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'nieve';
  if (c >= 95) return 'tormenta';
  return 'nubes';
}

export function textoCodigo(c) {
  const t = {
    0: 'Despejado', 1: 'Casi despejado', 2: 'Intervalos nubosos', 3: 'Cubierto', 45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna débil', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada intensa',
    61: 'Lluvia débil', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
    71: 'Nieve débil', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granizo menudo', 80: 'Chubascos débiles', 81: 'Chubascos',
    82: 'Chubascos fuertes', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve fuertes', 95: 'Tormenta',
    96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte'
  };
  return t[c] || 'Variable';
}

export function icono(codigo, esDia = true, tam = 32) {
  const tipo = tipoCodigo(codigo);
  let cuerpo = '';
  switch (tipo) {
    case 'despejado': cuerpo = esDia ? sol(16, 16, 5.5) : luna(0, 0, 1); break;
    case 'pocas_nubes': cuerpo = (esDia ? sol(11.5, 11, 4.2) : luna(-4, -4, 0.85)) + nube(2, 3); break;
    case 'nubes': cuerpo = (esDia ? sol(10.5, 10, 3.8, true) : luna(-5, -5, 0.8)) + nube(1.5, 2); break;
    case 'cubierto': cuerpo = nube(-3, -1, 'rgba(255,255,255,.08)') + nube(1.5, 2.5); break;
    case 'niebla': cuerpo = niebla(); break;
    case 'llovizna': cuerpo = nube(0, -2) + puntos(); break;
    case 'lluvia': cuerpo = nube(0, -2) + gotas(3); break;
    case 'lluvia_fuerte': cuerpo = nube(0, -2, 'rgba(255,255,255,.08)') + gotas(4, 4.2); break;
    case 'nieve': cuerpo = nube(0, -2) + copos(); break;
    case 'tormenta': cuerpo = nube(0, -3, 'rgba(255,255,255,.08)') + rayo(); break;
    default: cuerpo = nube(0, 0);
  }
  return `<svg class="ico" viewBox="0 0 32 32" width="${tam}" height="${tam}" aria-hidden="true">${cuerpo}</svg>`;
}

export function gota(tam = 12) {
  return `<svg viewBox="0 0 12 12" width="${tam}" height="${tam}" aria-hidden="true"><path d="M6 1.2C4.4 3.6 2.8 5.5 2.8 7.4A3.2 3.2 0 0 0 9.2 7.4C9.2 5.5 7.6 3.6 6 1.2z" fill="${AGUA}"/></svg>`;
}

export function flecha(grados, tam = 14) {
  // La flecha apunta hacia donde va el viento (de donde viene + 180)
  return `<svg viewBox="0 0 14 14" width="${tam}" height="${tam}" aria-hidden="true" style="transform:rotate(${(grados + 180) % 360}deg)"><path d="M7 1.5l3.2 8.5L7 8.2 3.8 10z" fill="currentColor"/></svg>`;
}
