// Resúmenes con personalidad. Tres tonos: neutro, socarrón y jaenero.
// Cada situación tiene varias frases; se elige una fija por día para que no cambie al recargar.

const F = {
  aviso_rojo: {
    neutro: ['Aviso rojo de AEMET. Evita desplazamientos y sigue las indicaciones oficiales.'],
    socarron: ['Aviso rojo. Hoy el plan es no tener plan.', 'Aviso rojo. Ni se te ocurra hacerte el valiente.'],
    jaenero: ['Aviso rojo, chiquillo. Hoy de casa no sale ni el gato.', 'Aviso rojo. Quietecito en casa, que esto va en serio.']
  },
  aviso_naranja: {
    neutro: ['Aviso naranja de AEMET en la zona. Conviene estar pendiente.'],
    socarron: ['Aviso naranja. El cielo viene con ganas de protagonismo.', 'Aviso naranja. No es día de improvisar.'],
    jaenero: ['Aviso naranja. Hoy hay que andar con ojo.', 'Aviso naranja, que no es cosa de broma. Atento al cielo.']
  },
  tormenta: {
    neutro: ['Posibles tormentas. Atención a la tarde.', 'Ambiente tormentoso: chubascos fuertes y rayos posibles.'],
    socarron: ['Huele a tormenta. Y no lo digo por decir: lo dicen los datos.', 'Tormentas posibles. Desenchufa lo que quieras conservar.'],
    jaenero: ['Se está poniendo el cielo de tormenta. Recoge lo del patio.', 'Hoy truena, seguro que sí. Recoge la ropa tendida.']
  },
  lluvia_ya: {
    neutro: ['Lluvia en las próximas horas.', 'Va a llover enseguida.'],
    socarron: ['Paraguas. No es una sugerencia.', 'Va a llover en nada. Tu peinado ya lo sabe.'],
    jaenero: ['Que viene el agua. Coge el paraguas, que luego te pones como una sopa.', 'Ahora mismo empieza a caer. Ni se te ocurra tender.']
  },
  lluvia_hoy: {
    neutro: ['Lluvia probable a lo largo del día.', 'Día con lluvia. Mejor salir preparado.'],
    socarron: ['Hoy llueve. Los charcos ya están haciendo cola.', 'Día pasado por agua. El paraguas por fin sirve para algo.'],
    jaenero: ['Hoy cae agua. Bendita sea, que el campo la pide.', 'Día de agua. El olivar lo agradece; tú, menos.']
  },
  lluvia_aceituna: {
    neutro: ['Lluvia prevista: mal día para la recogida de aceituna.'],
    socarron: ['Llueve en plena campaña. La aceituna hoy se queda en el árbol.'],
    jaenero: ['Con esta agua hoy no se varea. Día de cuadrilla en casa.', 'Llueve en plena campaña. Hoy la aceituna, mañana.']
  },
  nieve: {
    neutro: ['Nieve prevista. Precaución en carretera.'],
    socarron: ['Nieve. Todo el mundo va a salir a hacer la misma foto.'],
    jaenero: ['¡Nieve! Jabalcuz con gorro blanco y media ciudad mirando por la ventana.', 'Nieve a la vista. Cadenas y paciencia si vas por la sierra.']
  },
  niebla: {
    neutro: ['Niebla. Visibilidad reducida en carretera.'],
    socarron: ['Niebla. Hoy el paisaje viene en modo misterio.'],
    jaenero: ['Niebla cerrada. Hoy no se ve ni el castillo.', 'Niebla en el valle. Despacito por la carretera.']
  },
  calor_extremo: {
    neutro: ['Calor extremo. Evita el sol en las horas centrales y bebe agua.'],
    socarron: ['{tmax} grados. El asfalto está pensando en derretirse.', 'Calor de horno. Literal: podrías dorar algo en el coche.'],
    jaenero: ['¡Qué calor más gorda! {tmax} grados. Persianas abajo y botijo a mano.', 'Hoy el Paseo de la Estación arde. Siesta obligatoria.']
  },
  calor: {
    neutro: ['Tarde calurosa. Hidrátate y busca sombra.'],
    socarron: ['Calor. El ventilador hoy pide horas extra.', 'Tarde de chicharras. Y de sudar sin moverte.'],
    jaenero: ['Hace calor del bueno. Fresquito solo a la sombra.', 'Calor de Jaén, sin más. A la sombra, que se está mejor.']
  },
  helada: {
    neutro: ['Helada de madrugada. Cuidado con el hielo a primera hora.'],
    socarron: ['Helada. El parabrisas te va a odiar mañana.', 'Bajo cero. Las bufandas vuelven a estar de moda.'],
    jaenero: ['Helada. Una rasca que pela; abrígate bien.', 'Esta noche hiela. Mañana el campo amanece blanco.']
  },
  frio: {
    neutro: ['Día frío. Abrigo recomendable.'],
    socarron: ['Frío. Ese que hace que la cama tenga un poder especial.', 'Hace frío. El jersey gordo sale del armario.'],
    jaenero: ['Hace un frío que pela. Brasero y mesa camilla.', 'Día de frío. Chaquetón y pa la calle.']
  },
  viento: {
    neutro: ['Rachas de viento fuertes. Asegura lo que tengas suelto.'],
    socarron: ['Viento con ganas. Los paraguas hoy son de usar y tirar.', 'Rachas fuertes. Hoy peinarse es inútil.'],
    jaenero: ['Hoy sopla que da gusto... o que da miedo. Recoge las macetas.', 'Viento fuerte. Ojo con lo que tengas en el patio.']
  },
  cambio_frio: {
    neutro: ['Mañana bajan las temperaturas unos {delta} grados.'],
    socarron: ['Mañana {delta} grados menos. Disfruta hoy, que dura poco.'],
    jaenero: ['Mañana refresca: {delta} grados menos. Saca la chaquetilla.']
  },
  cambio_calor: {
    neutro: ['Mañana suben las temperaturas unos {delta} grados.'],
    socarron: ['Mañana {delta} grados más. El abrigo, a descansar.'],
    jaenero: ['Mañana se arrecala: {delta} grados más.']
  },
  aceituna_seco: {
    neutro: ['Día seco: buen día para la recogida de aceituna.'],
    socarron: ['Seco y sin sobresaltos. La aceituna no se recoge sola.'],
    jaenero: ['Día güeno pa la aceituna. ¡A varear!', 'Seco y templado: hoy la cuadrilla cunde.']
  },
  despejado_dia: {
    neutro: ['Cielo despejado.', 'Día soleado y estable.'],
    socarron: ['Sol. Sin trampa ni cartón.', 'Despejado. El cielo hoy no tiene nada que decir.'],
    jaenero: ['Día de sol, como Dios manda.', 'Cielo limpio. Hoy el castillo se ve desde lejos.']
  },
  despejado_noche: {
    neutro: ['Noche despejada.'],
    socarron: ['Noche despejada. Las estrellas, de guardia.'],
    jaenero: ['Noche raspada. Mira pa arriba, que se ven las estrellas.']
  },
  nubes: {
    neutro: ['Intervalos de nubes y claros.', 'Cielo cubierto, sin lluvia a la vista.'],
    socarron: ['Nublado. El sol se ha tomado el día libre.', 'Nubes por aquí y por allá. Nada que contar.'],
    jaenero: ['Cielo panza burro, pero sin agua.', 'Nubladillo. Ni frío ni calor: día de andar.']
  }
};

function hashDia(clave) {
  let h = 2166136261;
  for (const c of clave) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// ctx: datos ya calculados del lugar para hoy.
export function elegirSituacion(ctx) {
  if (ctx.avisoNivel >= 4) return 'aviso_rojo';
  if (ctx.avisoNivel >= 3) return 'aviso_naranja';
  if (ctx.tormenta === 'alto' || (ctx.tormenta === 'moderado' && ctx.probHoy >= 40)) return 'tormenta';
  if (ctx.lluviaPronto) return 'lluvia_ya';
  if (ctx.nieveHoy) return 'nieve';
  if (ctx.probHoy >= 55 && ctx.mmHoy >= 1) return ctx.campanaAceituna ? 'lluvia_aceituna' : 'lluvia_hoy';
  if (ctx.niebla) return 'niebla';
  if (ctx.tmax >= 38) return 'calor_extremo';
  if (ctx.tmax >= 32) return 'calor';
  if (ctx.tmin <= 0) return 'helada';
  if (ctx.tmax <= 10) return 'frio';
  if (ctx.rachaMax >= 60) return 'viento';
  if (ctx.deltaManana <= -5) return 'cambio_frio';
  if (ctx.deltaManana >= 5) return 'cambio_calor';
  if (ctx.campanaAceituna && ctx.probHoy < 20 && ctx.esDia) return 'aceituna_seco';
  if (ctx.nubes < 30) return ctx.esDia ? 'despejado_dia' : 'despejado_noche';
  return 'nubes';
}

export function frase(ctx, tono = 'neutro') {
  const sit = elegirSituacion(ctx);
  const lista = (F[sit] && (F[sit][tono] || F[sit].neutro)) || F.nubes.neutro;
  const elegida = lista[hashDia(ctx.fecha + sit + tono) % lista.length];
  return elegida
    .replace('{tmax}', Math.round(ctx.tmax))
    .replace('{delta}', Math.abs(Math.round(ctx.deltaManana)));
}

export const TONOS = [
  { id: 'neutro', nombre: 'Neutro' },
  { id: 'socarron', nombre: 'Socarrón' },
  { id: 'jaenero', nombre: 'Jaenero' }
];
