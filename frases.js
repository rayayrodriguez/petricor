// Resúmenes con personalidad. Tres tonos: neutro, socarrón y jaenero.
// Cada situación tiene varias frases; se elige una fija por día para que no cambie al recargar.

const F = {
  aviso_rojo: {
    neutro: ['Aviso rojo de AEMET. Evita desplazamientos y sigue las indicaciones oficiales.'],
    socarron: ['Aviso rojo. Hoy el plan es no tener plan.', 'Aviso rojo. Ni se te ocurra hacerte el valiente.'],
    jaenero: ['Aviso rojo de AEMET. Contíconeso: hoy no se sale si no hace falta.', '¡La irgen! Aviso rojo. Hoy de casa no se mueve nadie, ea.']
  },
  aviso_naranja: {
    neutro: ['Aviso naranja de AEMET en la zona. Conviene estar pendiente.'],
    socarron: ['Aviso naranja. El cielo viene con ganas de protagonismo.', 'Aviso naranja. No es día de improvisar.'],
    jaenero: ['Aviso naranja de AEMET. Contíconeso: hoy hay que andar con ojo.', 'Aviso naranja. No es pa tomárselo a broma, ea.']
  },
  tormenta: {
    neutro: ['Posibles tormentas. Atención a la tarde.', 'Ambiente tormentoso: chubascos fuertes y rayos posibles.'],
    socarron: ['Huele a tormenta. Y no lo digo por decir: lo dicen los datos.', 'Tormentas posibles. Desenchufa lo que quieras conservar.'],
    jaenero: ['@Tormenta a la vista. Cuando Jabalcuz tiene montera, o llueve o truena.', 'Hoy hay tormenta. Recoge lo del patio y desenchufa la tele, ea.']
  },
  lluvia_ya: {
    neutro: ['Lluvia en las próximas horas.', 'Va a llover enseguida.'],
    socarron: ['Paraguas. No es una sugerencia.', 'Va a llover en nada. Tu peinado ya lo sabe.'],
    jaenero: ['Empieza a llover en nada. Coge el paraguas o te calas.', 'Agua en un rato. ¡Cucha, que hoy no se tiende!']
  },
  lluvia_hoy: {
    neutro: ['Lluvia probable a lo largo del día.', 'Día con lluvia. Mejor salir preparado.'],
    socarron: ['Hoy llueve. Los charcos ya están haciendo cola.', 'Día pasado por agua. El paraguas por fin sirve para algo.'],
    jaenero: ['Hoy caen unos {mm} litros. Agüita pa los olivos.', 'Día de agua, con un {prob} % de probabilidad. Sin paraguas te calas.']
  },
  llovizna: {
    neutro: ['Puede caer algo de llovizna, poca cosa.'],
    socarron: ['Cuatro gotas. Ni para lavar el coche.', 'Llovizna de las que no mojan, pero molestan.'],
    jaenero: ['Fanfurriña: cuatro gotas que no llegan a nada.', 'Puede caer una fanfurriña, poca cosa. El paraguas, por si acaso.']
  },
  lluvia_aceituna: {
    neutro: ['Lluvia prevista: mal día para la recogida de aceituna.'],
    socarron: ['Llueve en plena campaña. La aceituna hoy se queda en el árbol.'],
    jaenero: ['Llueve en plena campaña: hoy no se coge aceituna. Agua y luna, tiempo de aceitunas.', 'Con esta agua hoy no se varea. Tópaná: la cuadrilla, mañana.']
  },
  nieve: {
    neutro: ['Nieve prevista. Precaución en carretera.'],
    socarron: ['Nieve. Todo el mundo va a salir a hacer la misma foto.'],
    jaenero: ['¡La irgen, nieve! Cuidado en la carretera.', '@¡Nieve! Jabalcuz con gorro blanco y media ciudad mirando por la ventana.']
  },
  niebla: {
    neutro: ['Niebla. Visibilidad reducida en carretera.'],
    socarron: ['Niebla. Hoy el paisaje viene en modo misterio.'],
    jaenero: ['@Niebla cerrada. Hoy no se ve ni el castillo.', 'Niebla cerrada. Por la carretera, despacio y con las luces puestas.']
  },
  calor_extremo: {
    neutro: ['Calor extremo: {tmax} grados. Evita el sol en las horas centrales y bebe agua.'],
    socarron: ['{tmax} grados. El asfalto está pensando en derretirse.', 'Calor de horno. Literal: podrías dorar algo en el coche.'],
    jaenero: ['Tostanera: {tmax} grados. Persianas abajo y nada de sol a mediodía.', '¡Qué flama! {tmax} grados. Agua fresquita y a la sombra.']
  },
  calor: {
    neutro: ['Tarde calurosa. Hidrátate y busca sombra.'],
    socarron: ['Calor. El ventilador hoy pide horas extra.', 'Tarde de chicharras. Y de sudar sin moverte.'],
    jaenero: ['Hace flama: {tmax} grados por la tarde. Busca un chambao.', '@Calor de Jaén: {tmax} grados. A la sombra se está mejor, ea.']
  },
  helada: {
    neutro: ['Helada de madrugada: mínima de {tmin} grados. Cuidado con el hielo a primera hora.'],
    socarron: ['Helada. El parabrisas te va a odiar mañana.', 'Bajo cero. Las bufandas vuelven a estar de moda.'],
    jaenero: ['Helada: {tmin} grados al amanecer. Vas a salir arrecío; abrígate bien.', 'Esta noche baja a {tmin} grados. Año heladero, año aceitero.']
  },
  frio: {
    neutro: ['Día frío. Abrigo recomendable.'],
    socarron: ['Frío. Ese que hace que la cama tenga un poder especial.', 'Hace frío. El jersey gordo sale del armario.'],
    jaenero: ['Hace más frío que lavando rábanos: máxima de {tmax} grados.', 'Día pa estar arrecío: no pasa de {tmax} grados. Brasero y mesa camilla.']
  },
  viento: {
    neutro: ['Rachas de viento de hasta {racha} km/h. Asegura lo que tengas suelto.'],
    socarron: ['Viento con ganas. Los paraguas hoy son de usar y tirar.', 'Rachas fuertes. Hoy peinarse es inútil.'],
    jaenero: ['Airazo: rachas de hasta {racha} km/h. Recoge las macetas del patio.', 'Hoy hace airazo, con rachas de {racha} km/h. Ojo con lo que tengas suelto.']
  },
  cambio_frio: {
    neutro: ['Mañana bajan las temperaturas unos {delta} grados.'],
    socarron: ['Mañana {delta} grados menos. Disfruta hoy, que dura poco.'],
    jaenero: ['Mañana refresca: {delta} grados menos. Saca la chaquetilla, ea.']
  },
  cambio_calor: {
    neutro: ['Mañana suben las temperaturas unos {delta} grados.'],
    socarron: ['Mañana {delta} grados más. El abrigo, a descansar.'],
    jaenero: ['Mañana sube la cosa: {delta} grados más. La rebeca, a descansar.']
  },
  aceituna_seco: {
    neutro: ['Día seco: buen día para la recogida de aceituna.'],
    socarron: ['Seco y sin sobresaltos. La aceituna no se recoge sola.'],
    jaenero: ['Día seco: buen día pa la aceituna. ¡A varear!', 'Seco y templado: hoy la cuadrilla cunde, ea.']
  },
  despejado_dia: {
    neutro: ['Cielo despejado.', 'Día soleado y estable.'],
    socarron: ['Sol. Sin trampa ni cartón.', 'Despejado. El cielo hoy no tiene nada que decir.'],
    jaenero: ['Sol y cielo limpio. Día pa salir, ea.', '@Cielo limpio: hoy el castillo se ve desde lejos.']
  },
  despejado_noche: {
    neutro: ['Noche despejada.'],
    socarron: ['Noche despejada. Las estrellas, de guardia.'],
    jaenero: ['Noche despejada: mira parriba, que se ven las estrellas.']
  },
  nubes: {
    neutro: ['Intervalos de nubes y claros.', 'Cielo cubierto, sin lluvia a la vista.'],
    socarron: ['Nublado. El sol se ha tomado el día libre.', 'Nubes por aquí y por allá. Nada que contar.'],
    jaenero: ['Nubladillo y sin agua. Ni frío ni calor: día de andar.', 'Cielo tapado pero seco. El paraguas, en casa.']
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
  if (ctx.probHoy >= 50 && ctx.mmHoy >= 0.2) return 'llovizna';
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

// Las frases que empiezan por @ citan sitios de Jaén capital: solo salen si el lugar está en la provincia
export function frase(ctx, tono = 'neutro') {
  const sit = elegirSituacion(ctx);
  let lista = (F[sit] && (F[sit][tono] || F[sit].neutro)) || F.nubes.neutro;
  const validas = lista.filter((x) => !x.startsWith('@') || ctx.enJaen);
  if (validas.length) lista = validas;
  const elegida = lista[hashDia(ctx.fecha + sit + tono) % lista.length].replace(/^@/, '');
  const mm = ctx.mmHoy || 0;
  return elegida
    .replace('{tmax}', Math.round(ctx.tmax))
    .replace('{tmin}', Math.round(ctx.tmin))
    .replace('{racha}', Math.round(ctx.rachaMax || 0))
    .replace('{mm}', mm < 10 ? String(Math.round(mm * 10) / 10).replace('.', ',') : Math.round(mm))
    .replace('{prob}', Math.round(ctx.probHoy || 0))
    .replace('{delta}', Math.abs(Math.round(ctx.deltaManana)));
}

export const TONOS = [
  { id: 'neutro', nombre: 'Neutro', desc: 'Directo y sin adornos: lo que importa del día, nada más.' },
  { id: 'socarron', nombre: 'Socarrón', desc: 'El mismo dato, con un punto de ironía.' },
  { id: 'jaenero', nombre: 'Jaenero', desc: 'Con palabras y dichos de Jaén: airazo, arrecío, flama, fanfurriña, ¡ea!' }
];
