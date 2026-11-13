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
# Con el tono jaenero, una frase delante del texto oficial de AEMET, que se manda siempre completo
CONSEJO_JAENERO = {
    1: "Airazo: recoge las macetas del patio y lo que tengas suelto.",
    2: "¡La irgen, nieve! Cuidado en la carretera.",
    3: "Tormenta: recoge lo del patio y desenchufa la tele.",
    4: "Niebla cerrada: por la carretera, despacio y con luces.",
    5: "Tostanera: persianas abajo y nada de sol a mediodía.",
    6: "Frío pa quedarse arrecío: abrígate bien.",
    7: "Mala mar: lejos de la orilla.",
    8: "Riesgo de incendio: nada de fuego en el campo.",
    10: "Agua en cantidad: sin paraguas te calas.",
    12: "Riesgo de inundaciones: ojo con cauces y bajos.",
    13: "Agua en cantidad: ojo con cauces y bajos.",
}


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


SECRETOS = ["PUSH_CONFIG", "PUSH_CONFIG_2", "PUSH_CONFIG_3"]


def leer_codigo(bruto):
    cfg = json.loads(base64.b64decode(bruto + "=" * (-len(bruto) % 4)).decode("utf-8"))
    assert cfg["sub"]["endpoint"] and cfg["vapid"]["d"]
    return cfg


def notificar_dispositivo(nombre, bruto, est, avisos, ahora):
    """Un móvil = un secreto. Cada uno guarda sus propios avisos enviados."""
    est.setdefault("enviados", {})

    def marcar(texto):
        if est.get("estado") != texto:
            est["estado"] = texto
            est["comprobado"] = ahora.isoformat(timespec="minutes")

    try:
        cfg = leer_codigo(bruto)
    except Exception:
        marcar("código no válido: vuelve a copiarlo desde la app")
        return
    huella = hashlib.sha256(bruto.encode()).hexdigest()[:16]
    if est.get("config") != huella:
        try:
            texto = ("Avisos activados en este móvil. Si hay aviso naranja o rojo en tus zonas, te escribo, ea."
                     if cfg.get("tono") == "jaenero" else
                     "Avisos activados en este móvil. Te escribiré si hay aviso naranja o rojo en tus zonas.")
            enviar(cfg, "Petricor", texto, "activado")
        except Exception as e:
            codigo = getattr(getattr(e, "response", None), "status_code", "")
            marcar(f"error al enviar la confirmación: {type(e).__name__} {codigo}".strip())
            return
        est["config"] = huella
        est["zonas"] = sorted(cfg.get("zonas", []))
        # Si el código es de otro móvil, ese móvil no ha recibido nada todavía
        equipo = hashlib.sha256(cfg["sub"]["endpoint"].encode()).hexdigest()[:16]
        if est.get("equipo") and est["equipo"] != equipo:
            est["enviados"] = {}
        est["equipo"] = equipo
    marcar("ok")
    zonas = set(cfg.get("zonas", []))
    minimo = int(cfg.get("nivel", 3))
    # Un mismo aviso suele afectar a varias zonas a la vez: se manda una sola notificación
    grupos = {}
    for a in avisos:
        if a["zona"] not in zonas or a["nivel"] < minimo:
            continue
        g = grupos.setdefault((a["tipo"], a["nivel"], a["inicio"], a["fin"]), {**a, "nombres": [], "claves_zona": []})
        g["nombres"].append(a["nombre"])
        g["claves_zona"].append(hashlib.sha256(f'{a["zona"]}|{a["tipo"]}|{a["nivel"]}|{a["inicio"]}'.encode()).hexdigest()[:16])
    for g in grupos.values():
        clave = hashlib.sha256(f'{g["tipo"]}|{g["nivel"]}|{g["inicio"]}|{g["fin"]}'.encode()).hexdigest()[:16]
        if clave in est["enviados"] or any(k in est["enviados"] for k in g["claves_zona"]):
            continue
        titulo = f'Aviso {NIVELES.get(g["nivel"], "")} por {g["fenomeno"]}'
        cuerpo = f'{" y ".join(g["nombres"])}. {fecha_corta(g["inicio"])} a {fecha_corta(g["fin"])}. {g["descripcion"]}'.strip()
        if cfg.get("tono") == "jaenero":
            if g["nivel"] >= 4:
                titulo = "¡La irgen! " + titulo
            consejo = CONSEJO_JAENERO.get(g["tipo"])
            if g["nivel"] >= 4:
                consejo = "Contíconeso: hoy no se sale si no hace falta. " + (consejo or "")
            if consejo:
                cuerpo = f"{consejo.strip()} {cuerpo}"

        try:
            enviar(cfg, titulo, cuerpo[:420], clave)
            est["enviados"][clave] = ahora.isoformat(timespec="minutes")
        except Exception as e:
            print(f"{nombre}: no se pudo enviar la notificación:", type(e).__name__, str(e)[:200])
    limite = ahora - dt.timedelta(days=10)
    for k in [k for k, v in est["enviados"].items() if dt.datetime.fromisoformat(v) < limite]:
        del est["enviados"][k]


def notificar(avisos, ahora):
    estado = comun.leer_json("push_estado.json", {})
    antes = json.dumps(estado, sort_keys=True)
    dispositivos = estado.setdefault("dispositivos", {})
    # Formato antiguo, de un solo móvil: pasa entero al primer secreto para no repetir avisos ya enviados
    if any(k in estado for k in ("config", "enviados", "zonas")):
        primero = dispositivos.setdefault("PUSH_CONFIG", {})
        for k in ("config", "zonas", "enviados"):
            if k in estado:
                primero.setdefault(k, estado.pop(k))
        if "estado" in estado:
            primero.setdefault("estado", estado["estado"])
            primero.setdefault("comprobado", estado.get("comprobado"))

    activos = []
    for nombre in SECRETOS:
        bruto = os.environ.get(nombre, "").strip()
        if bruto:
            activos.append(nombre)
            notificar_dispositivo(nombre, bruto, dispositivos.setdefault(nombre, {}), avisos, ahora)
        elif nombre in dispositivos:
            # Secreto quitado: se conserva lo enviado por si vuelve a ponerse, sin repetir avisos
            d = dispositivos[nombre]
            if d.get("estado") != "sin código":
                d["estado"] = "sin código"
                d["comprobado"] = ahora.isoformat(timespec="minutes")
            limite = ahora - dt.timedelta(days=10)
            for k in [k for k, v in d.get("enviados", {}).items() if dt.datetime.fromisoformat(v) < limite]:
                del d["enviados"][k]

    # Resumen sin datos privados para poder comprobarlo desde fuera
    if not activos:
        resumen = "sin código: falta el secreto PUSH_CONFIG"
    else:
        fallos = [f"{n}: {dispositivos[n]['estado']}" for n in activos if dispositivos[n].get("estado") != "ok"]
        resumen = "ok" if not fallos else "; ".join(fallos)
    if estado.get("estado") != resumen:
        estado["estado"] = resumen
        estado["comprobado"] = ahora.isoformat(timespec="minutes")
    estado["moviles"] = len(activos)
    if json.dumps(estado, sort_keys=True) != antes:
        comun.escribir_json("push_estado.json", estado)


# ---------------------------------------------------------------- historial de aciertos

MARGEN = 2.0  # °C: dentro de este error, la temperatura cuenta como acertada


def verificar(ahora):
    """Pone al lado de cada previsión guardada lo que midió la estación de AEMET en Jaén."""
    ver = comun.leer_json("verificacion.json", None)
    if not ver:
        return
    hoy = ahora.astimezone(MADRID).date()
    listos = []
    for clave, e in ver["dias"].items():
        if e.get("obs") is not None:
            continue
        dia = dt.date.fromisoformat(clave)
        # La lluvia del día llega en el parte de las 06 UTC del día siguiente
        if dia < hoy and ahora >= dt.datetime(dia.year, dia.month, dia.day, tzinfo=dt.timezone.utc) + dt.timedelta(hours=32):
            listos.append(dia)
    if listos:
        ultimo = ver.get("ultimo_intento")
        if not ultimo or ahora - dt.datetime.fromisoformat(ultimo) >= dt.timedelta(hours=1):
            ver["ultimo_intento"] = ahora.isoformat(timespec="minutes")
            desde = dt.datetime.combine(min(listos) - dt.timedelta(days=1), dt.time(0), dt.timezone.utc)
            try:
                recs = comun.descargar_synop(desde, ahora)
            except Exception as e:
                print("Observaciones para el historial no descargadas:", e)
                recs = None
            if recs is not None:
                for dia in listos:
                    o = comun.diarios(recs, dia)
                    e = ver["dias"][dia.isoformat()]
                    if o["tx"] is not None and o["tn"] is not None:
                        e["obs"] = {"tmax": o["tx"], "tmin": o["tn"], "mm": o["p"]}
                    elif (hoy - dia).days > 6:
                        e["obs"] = {"sin_dato": True}
    # Solo se escribe lo que cambia, para no llenar el repositorio de cambios vacíos
    if ver != comun.leer_json("verificacion.json", None):
        comun.escribir_json("verificacion.json", ver)
    nuevo = resumen(ver, ahora)
    viejo = comun.leer_json("aciertos.json", {})
    if {k: v for k, v in nuevo.items() if k != "actualizado"} != {k: v for k, v in viejo.items() if k != "actualizado"}:
        comun.escribir_json("aciertos.json", nuevo)


def _lluvia_prevista(p):
    return (p["prob"] >= 50) if p.get("prob") is not None else (p.get("mm") or 0) >= 1


def _estadisticas(filas):
    n = len(filas)
    if not n:
        return {"n": 0}
    def temp(campo, bruto):
        err = [p[campo] - o[campo] for p, o in filas if p.get(campo) is not None and o.get(campo) is not None]
        errb = [p[bruto] - o[campo] for p, o in filas if p.get(bruto) is not None and o.get(campo) is not None]
        if not err:
            return None
        return {"aciertos": round(100 * sum(abs(x) <= MARGEN for x in err) / len(err)),
                "error": round(sum(abs(x) for x in err) / len(err), 1),
                "sesgo": round(sum(err) / len(err), 1),
                "error_sin_corregir": round(sum(abs(x) for x in errb) / len(errb), 1) if errb else None}
    con_lluvia = [(p, o) for p, o in filas if o.get("mm") is not None]
    ll = None
    if con_lluvia:
        prev = [_lluvia_prevista(p) for p, o in con_lluvia]
        obs = [o["mm"] >= 1 for p, o in con_lluvia]
        ll = {"aciertos": round(100 * sum(a == b for a, b in zip(prev, obs)) / len(obs)), "n": len(obs),
              "dias_lluvia": sum(obs), "lluvia_avisada": sum(a and b for a, b in zip(prev, obs)),
              "falsas_alarmas": sum(a and not b for a, b in zip(prev, obs))}
    completos = [(p, o) for p, o in filas if o.get("mm") is not None and p.get("tmax") is not None and p.get("tmin") is not None]
    todo = round(100 * sum(abs(p["tmax"] - o["tmax"]) <= MARGEN and abs(p["tmin"] - o["tmin"]) <= MARGEN and
                           _lluvia_prevista(p) == (o["mm"] >= 1) for p, o in completos) / len(completos)) if completos else None
    return {"n": n, "tmax": temp("tmax", "tmaxBruto"), "tmin": temp("tmin", "tminBruto"), "lluvia": ll, "dia_completo": todo}


def resumen(ver, ahora):
    filas = []
    for clave, e in sorted(ver["dias"].items()):
        o = e.get("obs")
        if not o or o.get("sin_dato"):
            continue
        for plazo, p in e["prev"].items():
            filas.append((clave, int(plazo), p, o))
    por_plazo = {str(k): _estadisticas([(p, o) for d, pl, p, o in filas if pl == k]) for k in (1, 2, 3, 4, 5)}
    meses = sorted({d[:7] for d, *_ in filas})
    por_mes = [{"mes": m, **{str(k): _estadisticas([(p, o) for d, pl, p, o in filas if pl == k and d.startswith(m)]) for k in (1, 3)}}
               for m in meses]
    ultimos = []
    for d, pl, p, o in filas:
        if pl != 1:
            continue
        ultimos.append({"dia": d, "prev": {k: p.get(k) for k in ("tmax", "tmin", "prob", "mm")}, "obs": o,
                        "ok": {"tmax": abs(p["tmax"] - o["tmax"]) <= MARGEN, "tmin": abs(p["tmin"] - o["tmin"]) <= MARGEN,
                               "lluvia": None if o.get("mm") is None else _lluvia_prevista(p) == (o["mm"] >= 1)}})
    comprobados = sorted({d for d, *_ in filas})
    return {"actualizado": ahora.isoformat(timespec="minutes"), "estacion": ver.get("estacion"), "empieza": ver.get("empieza"),
            "criterio": ver.get("criterio"), "margen": MARGEN, "dias_comprobados": len(comprobados),
            "primero": comprobados[0] if comprobados else None, "ultimo": comprobados[-1] if comprobados else None,
            "por_plazo": por_plazo, "por_mes": por_mes, "ultimos": ultimos[-14:][::-1]}


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
    try:
        verificar(ahora)
    except Exception as e:
        print("Historial de aciertos no actualizado:", e)


if __name__ == "__main__":
    main()
