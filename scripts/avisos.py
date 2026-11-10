"""Cada 15 minutos: avisos oficiales de AEMET (vía MeteoAlarm), observación actual de Jaén
y envío de notificaciones al móvil para avisos naranja o rojo."""
import base64
import datetime as dt
import hashlib
import json
import os
from zoneinfo import ZoneInfo

import comun

MADRID = ZoneInfo("Europe/Madrid")
TIPOS = {1: "viento", 2: "nieve y hielo", 3: "tormentas", 4: "niebla", 5: "temperaturas máximas",
         6: "temperaturas mínimas", 7: "fenómenos costeros", 8: "incendios", 9: "aludes", 10: "lluvias",
         12: "inundaciones", 13: "lluvias e inundaciones"}
NIVELES = {2: "amarillo", 3: "naranja", 4: "rojo"}


def num(valor):
    try:
        return int(str(valor).split(";")[0].strip())
    except ValueError:
        return 0


def actualizar_avisos(ahora):
    r = comun.obtener("https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain", timeout=90)
    lista = []
    vistos = set()
    for w in r.json().get("warnings", []):
        alerta = w.get("alert", {})
        if alerta.get("msgType") == "Cancel":
            continue
        for info in alerta.get("info", []):
            if not info.get("language", "").startswith("es"):
                continue
            params = {p.get("valueName"): p.get("value") for p in info.get("parameter", [])}
            nivel = num(params.get("awareness_level", "1"))
            if nivel < 2:
                continue
            fin = dt.datetime.fromisoformat(info["expires"])
            if fin < ahora:
                continue
            tipo = num(params.get("awareness_type", "0"))
            for area in info.get("area", []):
                zona = next((g.get("value") for g in area.get("geocode", []) if g.get("valueName") == "EMMA_ID"), None)
                if not zona:
                    continue
                clave = (zona, tipo, nivel, info.get("onset"), info.get("expires"))
                if clave in vistos:
                    continue
                vistos.add(clave)
                lista.append({
                    "zona": zona, "nombre": area.get("areaDesc", ""), "nivel": nivel, "tipo": tipo,
                    "fenomeno": TIPOS.get(tipo, "otros fenómenos"), "inicio": info.get("onset"),
                    "fin": info.get("expires"), "titular": info.get("headline", ""),
                    "descripcion": info.get("description", ""), "instruccion": info.get("instruction", "")
                })
    lista.sort(key=lambda a: (a["zona"], a["inicio"] or ""))
    anterior = comun.leer_json("avisos.json", {})
    if anterior.get("avisos") != lista:
        comun.escribir_json("avisos.json", {"generado": ahora.isoformat(timespec="minutes"),
                                            "fuente": "AEMET vía MeteoAlarm (CC BY 4.0)", "avisos": lista})
    return lista


def actualizar_observacion(ahora):
    obs = comun.leer_json("obs_jaen.json", {})
    try:
        ultima = dt.datetime.fromisoformat(obs.get("consultado", "2000-01-01T00:00+00:00"))
    except ValueError:
        ultima = dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc)
    if ahora - ultima < dt.timedelta(minutes=50):
        return
    recs = comun.descargar_synop(ahora - dt.timedelta(hours=4), ahora)
    validos = [(t, d) for t, d in recs.items() if d.get("T") is not None]
    if not validos:
        return
    t, d = max(validos)
    hr = None
    if d.get("Td") is not None:
        a, b = 17.625, 243.04
        import math
        hr = round(100 * math.exp(a * d["Td"] / (b + d["Td"]) - a * d["T"] / (b + d["T"])))
    comun.escribir_json("obs_jaen.json", {
        "consultado": ahora.isoformat(timespec="minutes"), "hora": t.isoformat(timespec="minutes"),
        "estacion": comun.ESTACION, "temperatura": d.get("T"), "rocio": d.get("Td"), "humedad": hr,
        "viento": d.get("viento"), "racha": d.get("racha"), "direccion": d.get("dir"),
        "presion": d.get("P"), "ww": d.get("ww")
    })


def fecha_corta(iso):
    t = dt.datetime.fromisoformat(iso).astimezone(MADRID)
    dias = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
    return f"{dias[t.weekday()]} {t.day}, {t:%H:%M}"


def origen(url):
    """Apple exige que el campo 'sub' sea un correo mailto: o un origen https sin ruta."""
    from urllib.parse import urlparse
    u = urlparse(url or "")
    return f"https://{u.netloc}" if u.scheme == "https" and u.netloc else "https://github.com"


def enviar(cfg, titulo, cuerpo, etiqueta):
    from cryptography.hazmat.primitives.asymmetric import ec
    from py_vapid import Vapid
    from pywebpush import webpush

    d = cfg["vapid"]["d"]
    clave = ec.derive_private_key(int.from_bytes(base64.urlsafe_b64decode(d + "=" * (-len(d) % 4)), "big"), ec.SECP256R1())
    vapid = Vapid(private_key=clave)
    webpush(subscription_info=cfg["sub"],
            data=json.dumps({"title": titulo, "body": cuerpo, "tag": etiqueta, "url": cfg.get("sitio", "./")}, ensure_ascii=False),
            vapid_private_key=vapid,
            vapid_claims={"sub": origen(cfg.get("sitio"))},
            ttl=6 * 3600)


def notificar(avisos, ahora):
    bruto = os.environ.get("PUSH_CONFIG", "").strip()
    estado = comun.leer_json("push_estado.json", {"enviados": {}, "config": ""})
    estado.setdefault("enviados", {})

    def marcar(texto):
        # Deja constancia del estado (sin datos privados) para poder comprobarlo desde fuera
        if estado.get("estado") != texto:
            estado["estado"] = texto
            estado["comprobado"] = ahora.isoformat(timespec="minutes")
            comun.escribir_json("push_estado.json", estado)

    if not bruto:
        marcar("sin código: falta el secreto PUSH_CONFIG")
        return
    try:
        cfg = json.loads(base64.b64decode(bruto + "=" * (-len(bruto) % 4)).decode("utf-8"))
        assert cfg["sub"]["endpoint"] and cfg["vapid"]["d"]
    except Exception:
        marcar("código no válido: vuelve a copiarlo desde la app")
        return
    huella = hashlib.sha256(bruto.encode()).hexdigest()[:16]
    cambios = False
    if estado.get("config") != huella:
        try:
            enviar(cfg, "Petricor", "Avisos activados. Te escribiré si hay aviso naranja o rojo en tus zonas.", "activado")
        except Exception as e:
            codigo = getattr(getattr(e, "response", None), "status_code", "")
            marcar(f"error al enviar la confirmación: {type(e).__name__} {codigo}".strip())
            return
        estado["config"] = huella
        estado["zonas"] = sorted(cfg.get("zonas", []))
        cambios = True
    marcar("ok")
    zonas = set(cfg.get("zonas", []))
    minimo = int(cfg.get("nivel", 3))
    for a in avisos:
        if a["zona"] not in zonas or a["nivel"] < minimo:
            continue
        clave = hashlib.sha256(f'{a["zona"]}|{a["tipo"]}|{a["nivel"]}|{a["inicio"]}'.encode()).hexdigest()[:16]
        if clave in estado["enviados"]:
            continue
        titulo = f'Aviso {NIVELES.get(a["nivel"], "")} por {a["fenomeno"]}'
        cuerpo = f'{a["nombre"]}. {fecha_corta(a["inicio"])} a {fecha_corta(a["fin"])}. {a["descripcion"]}'.strip()
        try:
            enviar(cfg, titulo, cuerpo[:300], clave)
            estado["enviados"][clave] = ahora.isoformat(timespec="minutes")
            cambios = True
        except Exception as e:
            print("No se pudo enviar la notificación:", type(e).__name__, str(e)[:200])
    limite = ahora - dt.timedelta(days=10)
    viejos = [k for k, v in estado["enviados"].items() if dt.datetime.fromisoformat(v) < limite]
    for k in viejos:
        del estado["enviados"][k]
        cambios = True
    if cambios:
        comun.escribir_json("push_estado.json", estado)


def main():
    ahora = dt.datetime.now(dt.timezone.utc)
    avisos = []
    try:
        avisos = actualizar_avisos(ahora)
        print(f"Avisos activos en España: {len(avisos)}")
    except Exception as e:
        print("Avisos no actualizados:", e)
    try:
        actualizar_observacion(ahora)
    except Exception as e:
        print("Observación no actualizada:", e)
    notificar(avisos, ahora)


if __name__ == "__main__":
    main()
