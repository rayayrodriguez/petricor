# Petricor

Web personal del tiempo para Jaén y otros lugares. Se instala en el iPhone como una app.

## Qué hace

- **Temperatura:** hoy y mañana, con el modelo que mejor acierta en Jaén, ICON al empezar. Desde pasado mañana, la media de varios modelos.
- **Corrección local:** se aplica cerca de la estación de AEMET en Jaén y se recalcula sola cada mañana.
- **Lluvia:** con ECMWF 9 km. La probabilidad sale de los 51 escenarios del conjunto de ECMWF.
- **Avisos oficiales de AEMET:** vía MeteoAlarm, más un indicador propio de riesgo de tormenta.
- **Notificaciones al iPhone:** para avisos naranja y rojo, aunque la app esté cerrada.
- **Fondo animado:** cambia según el tiempo y la hora.
- **Detalle diario:** viento, humedad, presión, UV, sol, luna, calidad del aire y polen.

## Cómo funciona

| Parte | Dónde |
|---|---|
| Web | `index.html`, `app.js` y módulos. Se publica con GitHub Pages desde la rama `main`. |
| Avisos y observación, cada 15 min | `.github/workflows/avisos.yml` → `scripts/avisos.py` |
| Correcciones, cada mañana | `.github/workflows/correcciones.yml` → `scripts/correcciones.py` |
| Datos generados | rama `datos`, que la web lee directamente |

## Puesta en marcha

1. **Publicar la web:** *Settings → Pages → Build and deployment*. Elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.
2. **Instalar en el iPhone:** abre la web en Safari, pulsa *Compartir* y luego *Añadir a pantalla de inicio*.
3. **Activar notificaciones:**
   1. Abre la app desde el icono y ve a *Ajustes → Activar avisos en este iPhone*.
   2. Copia el código.
   3. En GitHub, ve a *Settings → Secrets and variables → Actions → New repository secret* y crea uno llamado `PUSH_CONFIG` con ese código.

## Fuentes y licencias

- Previsión: Open-Meteo, CC BY 4.0, con modelos de DWD, ECMWF, NOAA, Météo-France, Met Office y ECCC. Uso personal sin publicidad, dentro del plan gratuito no comercial.
- Avisos: AEMET a través de MeteoAlarm, CC BY 4.0.
- Observaciones: estación de AEMET de Jaén (08417), vía Ogimet.
- Polen y calidad del aire: Copernicus CAMS.
