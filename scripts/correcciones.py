"""Cada día: compara lo que previeron los modelos con lo que midió la estación de AEMET en Jaén,
elige el modelo que mejor acierta y recalcula las correcciones locales que aplica la web."""
import datetime as dt
import statistics as st

import comun

MODELOS = ["dwd_icon_global_native", "ecmwf_ifs", "ncep_gfs_global", "meteofrance_arpege_europe",
           "ukmo_global_deterministic_10km", "cmc_gem_gdps", "dwd_icon_eu_native", "ecmwf_ifs025"]
POR_DEFECTO = {"temperatura": "dwd_icon_global_native", "lluvia": "ecmwf_ifs"}
INICIAL = {"d1": {"tmax": 0.4, "tmin": 1.3}, "d3": {"tmax": 0.8, "tmin": 1.7}}  # prueba del 10-nov-2026
VENTANA = 45          # días para temperatura
VENTANA_LLUVIA = 120  # días para lluvia (hay pocos días de lluvia)
MIN_DIAS = 20


def utc(dia, hora):
    return int(dt.datetime(dia.year, dia.month, dia.day, hora, tzinfo=dt.timezone.utc).timestamp())


def series_modelo(hourly, variable):
    """Separa las series por modelo: claves como temperature_2m_previous_day1_<modelo>."""
    out = {}
    for clave, valores in hourly.items():
        if clave == variable and len(MODELOS) == 1:
            out[MODELOS[0]] = valores
        elif clave.startswith(variable + "_"):
            modelo = clave[len(variable) + 1:]
            if modelo in MODELOS:
                out[modelo] = valores
    return out


def agregados(tiempos, valores, dia):
    def ventana(a, b, inc_a=True):
        return [v for t, v in zip(tiempos, valores) if v is not None and (a <= t if inc_a else a < t) and t <= b]
    vx = ventana(utc(dia, 6), utc(dia, 18))
    vn = ventana(utc(dia - dt.timedelta(days=1), 18), utc(dia, 6))
    vp = ventana(utc(dia, 6), utc(dia + dt.timedelta(days=1), 6), inc_a=False)
    return {
        "tx": round(max(vx), 2) if len(vx) >= 10 else None,
        "tn": round(min(vn), 2) if len(vn) >= 10 else None,
        "p": round(sum(vp), 2) if len(vp) >= 20 else None,
    }


def previsiones(dias_atras):
    e = comun.ESTACION
    url = ("https://previous-runs-api.open-meteo.com/v1/forecast"
           f"?latitude={e['lat']}&longitude={e['lon']}&elevation={e['elev']}"
           "&hourly=temperature_2m_previous_day1,temperature_2m_previous_day3,precipitation_previous_day1"
           f"&models={','.join(MODELOS)}&past_days={dias_atras}&forecast_days=1&timezone=GMT&timeformat=unixtime")
    h = comun.obtener(url, timeout=120).json()["hourly"]
    t = h["time"]
    return t, {
        "d1": series_modelo(h, "temperature_2m_previous_day1"),
        "d3": series_modelo(h, "temperature_2m_previous_day3"),
        "p1": series_modelo(h, "precipitation_previous_day1"),
    }


def consenso(series, n):
    out = []
    for i in range(n):
        vals = [s[i] for s in series.values() if s[i] is not None]
        out.append(sum(vals) / len(vals) if len(vals) >= 3 else None)
    return out


def media_recortada(e):
    e = sorted(e)
    k = int(len(e) * 0.1)
    e = e[k:len(e) - k] if len(e) > 10 else e
    return sum(e) / len(e)


def evaluar(historial, clave, modelo, dias):
    ex, en = [], []
    for d in dias:
        reg = historial.get(d, {})
        o, f = reg.get("obs", {}), reg.get(clave, {}).get(modelo, {})
        if o.get("tx") is not None and f.get("tx") is not None:
            ex.append(f["tx"] - o["tx"])
        if o.get("tn") is not None and f.get("tn") is not None:
            en.append(f["tn"] - o["tn"])
    if len(ex) < 5 or len(en) < 5:
        return None
    bx, bn = media_recortada(ex), media_recortada(en)
    return {
        "n": min(len(ex), len(en)),
        "correccion": {"tmax": round(-bx, 1), "tmin": round(-bn, 1)},
        "error_bruto": {"tmax": round(st.mean(abs(x) for x in ex), 2), "tmin": round(st.mean(abs(x) for x in en), 2)},
        "error_corregido": {"tmax": round(st.mean(abs(x - bx) for x in ex), 2), "tmin": round(st.mean(abs(x - bn) for x in en), 2)},
    }


def suavizar(res, inicial):
    """Con pocos días, mezcla la corrección calculada con la inicial."""
    peso = min(1.0, res["n"] / MIN_DIAS)
    for k in ("tmax", "tmin"):
        res["correccion"][k] = round(max(-4, min(4, peso * res["correccion"][k] + (1 - peso) * inicial[k])), 1)
    return res


def lluvia(historial, modelo, dias, umbral=1.0):
    a = f = fa = n = 0
    for d in dias:
        reg = historial.get(d, {})
        o, p = reg.get("obs", {}).get("p"), reg.get("d1", {}).get(modelo, {}).get("p")
        if o is None or p is None:
            continue
        n += 1
        if o >= umbral and p >= umbral:
            a += 1
        elif o >= umbral:
            f += 1
        elif p >= umbral:
            fa += 1
    csi = a / (a + f + fa) if (a + f + fa) else None
    return {"n": n, "dias_lluvia": a + f, "acertados": a, "falsas_alarmas": fa, "csi": None if csi is None else round(csi, 2)}


def main():
    hoy = dt.datetime.now(dt.timezone.utc).date()
    datos = comun.leer_json("historial.json", {"dias": {}})
    historial = datos["dias"]
    faltan = [hoy - dt.timedelta(days=i) for i in range(1, 61) if (hoy - dt.timedelta(days=i)).isoformat() not in historial]
    atras = 60 if len(faltan) > 5 else 4

    # 1. Observaciones
    desde = dt.datetime.combine(hoy - dt.timedelta(days=atras + 1), dt.time(0), dt.timezone.utc)
    hasta = dt.datetime.combine(hoy, dt.time(7), dt.timezone.utc)
    recs = comun.descargar_synop(desde, hasta)

    # 2. Previsiones guardadas por Open-Meteo
    tiempos, ser = previsiones(atras + 2)
    n = len(tiempos)
    ser["d1"]["consenso"] = consenso(ser["d1"], n)
    ser["d3"]["consenso"] = consenso(ser["d3"], n)

    for i in range(1, atras + 1):
        dia = hoy - dt.timedelta(days=i)
        obs = comun.diarios(recs, dia)
        reg = historial.get(dia.isoformat(), {})
        reg["obs"] = {k: v for k, v in obs.items() if v is not None} or reg.get("obs", {})
        for clave, fuente in (("d1", "d1"), ("d3", "d3")):
            reg.setdefault(clave, {})
            for modelo, valores in ser[fuente].items():
                ag = agregados(tiempos, valores, dia)
                if clave == "d1" and modelo in ser["p1"]:
                    ag["p"] = agregados(tiempos, ser["p1"][modelo], dia)["p"]
                else:
                    ag.pop("p", None)
                ag = {k: v for k, v in ag.items() if v is not None}
                if ag:
                    reg[clave][modelo] = ag
        historial[dia.isoformat()] = reg

    # Mantener un año como mucho
    limite = (hoy - dt.timedelta(days=400)).isoformat()
    for d in [d for d in historial if d < limite]:
        del historial[d]
    comun.escribir_json("historial.json", {"estacion": comun.ESTACION, "dias": historial})

    # 3. Evaluación y elección de modelos
    dias_t = sorted(historial)[-VENTANA:]
    dias_p = sorted(historial)[-VENTANA_LLUVIA:]
    anterior = comun.leer_json("correcciones.json", {})
    ranking = []
    for m in MODELOS + ["consenso"]:
        r = evaluar(historial, "d1", m, dias_t)
        if r:
            ranking.append({"modelo": m, "n": r["n"],
                            "error": round((r["error_corregido"]["tmax"] + r["error_corregido"]["tmin"]) / 2, 2),
                            "error_bruto": round((r["error_bruto"]["tmax"] + r["error_bruto"]["tmin"]) / 2, 2)})
    ranking.sort(key=lambda x: x["error"])

    actual = anterior.get("temperatura", {}).get("modelo", POR_DEFECTO["temperatura"])
    elegido = actual
    candidatos = [r for r in ranking if r["modelo"] != "consenso" and r["n"] >= MIN_DIAS]
    if candidatos:
        mejor = candidatos[0]
        actual_r = next((r for r in candidatos if r["modelo"] == actual), None)
        if actual_r is None or mejor["error"] < actual_r["error"] - 0.08:
            elegido = mejor["modelo"]

    temp = evaluar(historial, "d1", elegido, dias_t)
    temp = suavizar(temp, INICIAL["d1"]) if temp else {"n": 0, "correccion": dict(INICIAL["d1"])}
    cons = evaluar(historial, "d3", "consenso", dias_t)
    cons = suavizar(cons, INICIAL["d3"]) if cons else {"n": 0, "correccion": dict(INICIAL["d3"])}

    lluvia_actual = anterior.get("lluvia", {}).get("modelo", POR_DEFECTO["lluvia"])
    evals = {m: lluvia(historial, m, dias_p) for m in MODELOS}
    lluvia_elegido = lluvia_actual
    con_datos = {m: v for m, v in evals.items() if v["csi"] is not None and v["dias_lluvia"] >= 8}
    if con_datos:
        mejor = max(con_datos, key=lambda m: con_datos[m]["csi"])
        base = con_datos.get(lluvia_actual, {"csi": -1})
        if con_datos[mejor]["csi"] > base["csi"] + 0.05:
            lluvia_elegido = mejor

    comun.escribir_json("correcciones.json", {
        "actualizado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "estacion": comun.ESTACION,
        "ventana_dias": VENTANA,
        "temperatura": {"modelo": elegido, **temp},
        "consenso": cons,
        "lluvia": {"modelo": lluvia_elegido, **evals.get(lluvia_elegido, {})},
        "ranking": ranking,
    })
    print("Modelo de temperatura:", elegido, temp["correccion"], "| lluvia:", lluvia_elegido)


if __name__ == "__main__":
    main()
