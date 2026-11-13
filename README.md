# Petricor

Web personal del tiempo para Jaén y otros lugares. Se instala en el iPhone como una app.

## Qué hace

- **Temperatura:** hoy y mañana, con el modelo que mejor acierta en Jaén, ICON al empezar. Desde pasado mañana, la media de varios modelos.
- **Corrección local:** se aplica cerca de la estación de AEMET en Jaén y se recalcula sola cada mañana.
- **Lluvia:** con ECMWF 9 km. La probabilidad sale de los 51 escenarios del conjunto de ECMWF.
- **Avisos oficiales de AEMET:** vía MeteoAlarm, más un indicador propio de riesgo de tormenta.
- **Notificaciones al iPhone:** para avisos naranja y rojo, aunque la app esté cerrada.
- **Fondo animado:** el color y la luz siguen la altura real del sol, y de noche se ven las estrellas, la luna y los planetas que hay sobre el lugar a esa hora.
- **Detalle diario:** viento, humedad, presión, UV, sol, luna, calidad del aire y polen.
- **Historial de aciertos:** cada mañana a las 9 se guarda la previsión para Jaén de los cinco días siguientes y, cuando llegan los datos de la estación de AEMET, se compara. Vive en la rama `datos` (`verificacion.json` y `aciertos.json`), así que no depende del móvil.

## Cómo funciona

| Parte | Dónde |
|---|---|
| Web | `index.html`, `app.js` y módulos. Se publica con GitHub Pages desde la rama `main`. |
| Avisos y observación, cada 15 min | `.github/workflows/avisos.yml` → `scripts/avisos.py` |
| Correcciones, cada mañana | `.github/workflows/correcciones.yml` → `scripts/correcciones.py` |
| Previsión guardada para el historial | `scripts/prevision_diaria.mjs`, con el mismo cálculo que la app (`prevision.js`) |
| Datos generados | rama `datos`, que la web lee directamente |

## Puesta en marcha

1. **Publicar la web:** *Settings → Pages → Build and deployment*. Elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.
2. **Instalar en el iPhone:** abre la web en Safari, pulsa *Compartir* y luego *Añadir a pantalla de inicio*.
3. **Activar notificaciones:**
   1. Abre la app desde el icono y ve a *Ajustes → Activar avisos en este iPhone*.
   2. Copia el código.
   3. En GitHub, ve a *Settings → Secrets and variables → Actions → New repository secret* y crea uno llamado `PUSH_CONFIG` con ese código.
   4. Para otro móvil, repite los pasos en ese móvil y guarda su código como `PUSH_CONFIG_2`. Para un tercero, usa `PUSH_CONFIG_3`. Cada móvil tiene su propio código.

## Fuentes y licencias

- Previsión: Open-Meteo, CC BY 4.0, con modelos de DWD, ECMWF, NOAA, Météo-France, Met Office y ECCC. Uso personal sin publicidad, dentro del plan gratuito no comercial.
- Avisos: AEMET a través de MeteoAlarm, CC BY 4.0.
- Observaciones: estación de AEMET de Jaén (08417), vía Ogimet.
- Polen y calidad del aire: Copernicus CAMS.
- Estrellas: catálogo Hipparcos en la versión de d3-celestial (Olaf Frohn, BSD-3). Planetas con los elementos orbitales de Paul Schlyter.
