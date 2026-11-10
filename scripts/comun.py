"""Utilidades compartidas por las tareas automáticas de Petricor."""
import datetime as dt
import json
import os
import time

import requests

ESTACION = {"id": "08417", "nombre": "Jaén (AEMET)", "lat": 37.7833, "lon": -3.80, "elev": 582}
DATOS = os.environ.get("PETRICOR_DATOS", "datos")
UA = {"User-Agent": "Petricor/1.0 (web personal del tiempo; github.com/rayayrodriguez/petricor)"}


def leer_json(nombre, defecto):
    ruta = os.path.join(DATOS, nombre)
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return defecto


def escribir_json(nombre, datos):
    os.makedirs(DATOS, exist_ok=True)
    ruta = os.path.join(DATOS, nombre)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))


def obtener(url, intentos=3, timeout=60, **kw):
    ultimo = None
    for i in range(intentos):
        try:
            r = requests.get(url, headers=UA, timeout=timeout, **kw)
            if r.status_code == 200:
                return r
            ultimo = f"HTTP {r.status_code}: {r.text[:200]}"
        except requests.RequestException as e:
            ultimo = str(e)
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"No se pudo descargar {url.split('?')[0]}: {ultimo}")


# ---------- Observaciones SYNOP (Ogimet) ----------

def _t(g):
    v = g[2:5]
    if "/" in v:
        return None
    x = int(v) / 10.0
    return -x if g[1] == "1" else x


def _rr(g):
    v = g[1:4]
    if "/" in v:
        return None
    v = int(v)
    if v == 990:
        return 0.05
    if v >= 991:
        return (v - 990) / 10.0
    return float(v)


def parsear_synop(texto, estacion=ESTACION["id"]):
    """Devuelve {datetime_utc: {campos}} a partir del texto de Ogimet getsynop."""
    recs = {}
    for linea in texto.splitlines():
        p = linea.strip().split(",")
        if len(p) < 7 or p[0] != estacion:
            continue
        try:
            t = dt.datetime(int(p[1]), int(p[2]), int(p[3]), int(p[4]), int(p[5]), tzinfo=dt.timezone.utc)
        except ValueError:
            continue
        rep = p[6].replace("==", "").split()
        if "NIL" in rep or estacion not in rep:
            continue
        g = rep[rep.index(estacion) + 1:]
        if len(g) < 2:
            continue
        d = {}
        iw = "1"
        if "AAXX" in rep and rep.index("AAXX") + 1 < len(rep):
            iw = rep[rep.index("AAXX") + 1][-1]
        factor = 1.852 if iw in "34" else 3.6  # nudos o m/s a km/h
        nddff = g[1]
        if len(nddff) == 5 and "/" not in nddff[1:]:
            d["dir"] = int(nddff[1:3]) * 10
            d["viento"] = round(int(nddff[3:5]) * factor)
        sec = 1
        for x in g[2:]:
            if x == "333":
                sec = 3
                continue
            if x == "555":
                break
            if len(x) != 5:
                continue
            if sec == 1:
                if x[0] == "1" and "T" not in d:
                    d["T"] = _t(x)
                elif x[0] == "2" and "Td" not in d and x[1] in "01":
                    d["Td"] = _t(x)
                elif x[0] == "4" and "P" not in d and "/" not in x[1:]:
                    v = int(x[1:]) / 10.0
                    d["P"] = v + 1000 if v < 100 else v
                elif x[0] == "6" and "R6" not in d:
                    d["R6"] = (_rr(x), x[4])
                elif x[0] == "7" and "ww" not in d and "/" not in x[1:3]:
                    d["ww"] = int(x[1:3])
            elif sec == 3:
                if x[0] == "1" and "Tx" not in d:
                    d["Tx"] = _t(x)
                elif x[0] == "2" and "Tn" not in d:
                    d["Tn"] = _t(x)
                elif x[0] == "7" and "R24" not in d:
                    v = x[1:5]
                    d["R24"] = None if "/" in v else (0.05 if v == "9999" else int(v) / 10.0)
                elif x[0] == "9" and x[1:3] == "10" and "racha" not in d and "/" not in x[3:]:
                    d["racha"] = round(int(x[3:]) * factor)
        recs[t] = d
    return recs


def descargar_synop(desde, hasta, estacion=ESTACION["id"]):
    """Descarga en tramos de 15 días para no castigar a Ogimet."""
    recs = {}
    a = desde
    while a <= hasta:
        b = min(a + dt.timedelta(days=15) - dt.timedelta(minutes=1), hasta)
        url = (f"https://www.ogimet.com/cgi-bin/getsynop?block={estacion}"
               f"&begin={a:%Y%m%d%H%M}&end={b:%Y%m%d%H%M}")
        texto = obtener(url, timeout=90).text
        if not texto.startswith(estacion):
            raise RuntimeError("Ogimet no devolvió datos SYNOP")
        recs.update(parsear_synop(texto, estacion))
        a = b + dt.timedelta(minutes=1)
        if a <= hasta:
            time.sleep(12)
    return recs


def diarios(recs, dia):
    """Máxima (06-18 UTC), mínima (18 UTC del día anterior a 06 UTC) y lluvia (06 UTC a 06 UTC del día siguiente)."""
    t06 = dt.datetime(dia.year, dia.month, dia.day, 6, tzinfo=dt.timezone.utc)
    t18 = t06 + dt.timedelta(hours=12)
    t06n = t06 + dt.timedelta(days=1)
    r18, r06, r06n = recs.get(t18, {}), recs.get(t06, {}), recs.get(t06n, {})
    p = None
    a, b = r18.get("R6"), r06n.get("R6")
    if a and b and a[1] == "2" and b[1] == "2" and a[0] is not None and b[0] is not None:
        p = round(a[0] + b[0], 2)
    elif r06n.get("R24") is not None:
        p = r06n["R24"]
    return {"tx": r18.get("Tx"), "tn": r06.get("Tn"), "p": p}
