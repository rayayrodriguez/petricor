"""Dice si hay que recalcular las correcciones: GitHub no siempre lanza la tarea diaria programada.
Sale con 0 si toca (más de 20 horas sin recalcular y más de 3 horas desde el último intento)."""
import datetime as dt
import sys

import comun

ahora = dt.datetime.now(dt.timezone.utc)
hecho = comun.leer_json("correcciones.json", {}).get("actualizado")
intento = comun.leer_json("intentos.json", {}).get("correcciones")
viejo = not hecho or ahora - dt.datetime.fromisoformat(hecho) > dt.timedelta(hours=20)
reciente = intento and ahora - dt.datetime.fromisoformat(intento) < dt.timedelta(hours=3)
if viejo and not reciente:
    intentos = comun.leer_json("intentos.json", {})
    intentos["correcciones"] = ahora.isoformat(timespec="minutes")
    comun.escribir_json("intentos.json", intentos)
    sys.exit(0)
sys.exit(1)
