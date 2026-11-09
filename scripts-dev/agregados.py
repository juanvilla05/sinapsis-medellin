#!/usr/bin/env python3
"""
Agregados de la Sala de Monitoreo de SINAPSIS — solo biblioteca estándar de Python 3.

Descarga desde la fuente (MEData, Alcaldía de Medellín) los CSV crudos de
  · Incidentes viales                (1-023-25-000094)
  · Víctimas en incidentes viales    (1-023-25-000360)
  · Hurto a persona                  (1-027-23-000011)
a una carpeta caché (por defecto `.cache-datos/`, ignorada por git) y calcula ÚNICAMENTE
agregados; ninguna fila individual sale de este script.

Regla de supresión (umbral 5): en las rejillas, las celdas con n < 5 se eliminan; en todas las
demás tablas, cualquier conteo entre 1 y 4 se escribe como null. El 0 nunca se escribe (las
combinaciones sin casos simplemente no aparecen).

Rejilla: celdas cuadradas en grados sobre WGS84, resolución fija RESOLUCION_GRADOS = 0.00225°
  i = floor(lat / 0.00225),  j = floor(lng / 0.00225)
  → lado ≈ 250 m en latitud (0.00225 × 111 320 m) y ≈ 249 m en longitud a 6,25° N.
  Centro de la celda: lat = (i + 0,5) × 0.00225,  lng = (j + 0,5) × 0.00225.

Uso:
  python3 scripts-dev/agregados.py                 # descarga lo que falte y genera los JSON
  python3 scripts-dev/agregados.py --cache /ruta   # otra carpeta caché
  python3 scripts-dev/agregados.py --solo hurto    # un solo conjunto
Salida: src/lib/monitoreo/datos/*.json (compactos, con cabecera de fuente y supresión).
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import json
import math
import os
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA_DEFECTO = os.path.join(RAIZ, "src", "lib", "monitoreo", "datos")
CACHE_DEFECTO = os.path.join(RAIZ, ".cache-datos")

HOST = "https://medata.app.medellin.gov.co"
URL_DISTRIBUCION = HOST + "/sites/default/files/distribution/{id}/{archivo}"
URL_METADATO = HOST + "/api/1/metastore/schemas/dataset/items/{id}"
URL_CONJUNTO = HOST + "/dataset/{id}"

RESOLUCION_GRADOS = 0.00225
UMBRAL = 5
# Caja de Medellín y su entorno inmediato: coordenadas fuera de ella se consideran inválidas.
BBOX = {"latMin": 5.9, "latMax": 6.6, "lngMin": -76.0, "lngMax": -75.0}

COMUNAS = {f"{n:02d}" for n in range(1, 17)} | {"50", "60", "70", "80", "90"}

FUENTES = {
    "incidentes": {"id": "1-023-25-000094", "nombre": "Incidentes viales", "archivo": "incidentes_viales.csv"},
    "victimas": {"id": "1-023-25-000360", "nombre": "Víctimas en Incidentes viales", "archivo": "Mede_Victimas_inci.csv"},
    "hurto": {"id": "1-027-23-000011", "nombre": "Hurto a persona", "archivo": "hurto_a_persona.csv"},
}

# Condición de la víctima → cuatro grupos (la grafía de la fuente varía en mayúsculas).
CONDICIONES = {
    "peaton": ["Peatón"],
    "motociclista": ["Motociclista", "Acompañante de Motocicleta"],
    "ciclista": ["Ciclista"],
    "otro": ["Pasajero", "Conductor", "Acompañante"],
}

# Modalidades de hurto agrupadas para reducir la supresión (las no listadas van a "Otra").
MODALIDADES = {
    "Atraco": ["Atraco"],
    "Descuido": ["Descuido"],
    "Cosquilleo": ["Cosquilleo"],
    "Raponazo": ["Raponazo"],
    "Engaño": ["Engaño"],
    "Escopolamina": ["Escopolamina"],
    "Halado": ["Halado"],
    "Rompimiento": ["Rompimiento cerradura", "Rompimiento cerraduta", "Rompimiento de ventana"],
    "Sin dato": ["Sin dato"],
}

csv.field_size_limit(10**8)


# ───────────────────────── utilidades ─────────────────────────


def ahora_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def descargar(url: str, destino: str) -> None:
    """Descarga `url` a `destino` siguiendo redirecciones (urllib las sigue por defecto)."""
    peticion = urllib.request.Request(url, headers={"User-Agent": "SINAPSIS-Medellin/agregados.py (python-urllib)"})
    with urllib.request.urlopen(peticion, timeout=120) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status} al descargar {url}")
        total = resp.headers.get("Content-Length")
        print(f"  descargando {url}" + (f" ({int(total) / 1e6:.1f} MB)" if total else ""), flush=True)
        fd, temporal = tempfile.mkstemp(dir=os.path.dirname(destino), suffix=".parte")
        with os.fdopen(fd, "wb") as f:
            shutil.copyfileobj(resp, f, 1 << 20)
        os.replace(temporal, destino)


def asegurar_csv(clave: str, cache: str) -> str:
    f = FUENTES[clave]
    ruta = os.path.join(cache, f["archivo"])
    if os.path.exists(ruta) and os.path.getsize(ruta) > 0:
        print(f"  usando caché {ruta} ({os.path.getsize(ruta) / 1e6:.1f} MB)")
    else:
        descargar(URL_DISTRIBUCION.format(id=f["id"], archivo=f["archivo"]), ruta)
    return ruta


def metadato(clave: str, cache: str) -> dict:
    """Metadato DKAN del conjunto (licencia, modificado). Si no hay red, se usa la caché o valores 'no declarada'."""
    f = FUENTES[clave]
    ruta = os.path.join(cache, f"{f['id']}.metadato.json")
    datos = None
    try:
        descargar(URL_METADATO.format(id=f["id"]), ruta)
    except (urllib.error.URLError, RuntimeError, OSError) as e:
        print(f"  aviso: no se pudo leer el metadato de {f['id']} ({e.__class__.__name__}); se usa la caché si existe")
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as g:
            datos = json.load(g)
    return {
        "licencia": (datos or {}).get("license") or "no declarada",
        "modificadoPortal": (datos or {}).get("modified"),
        "periodicidadDeclarada": (datos or {}).get("accrualPeriodicity"),
    }


def normalizar_comuna(valor: str | None) -> str | None:
    """'5', '05', '5.0', '04 - Aranjuez' → '05'/'04'. 'Sin Inf', 'SD', 'SIN DATO', 'AU', 'In' → None."""
    if not valor:
        return None
    m = re.match(r"^\s*(\d{1,2})(?:\.0+)?(?:\b|$)", valor)
    if not m:
        return None
    codigo = m.group(1).zfill(2)
    return codigo if codigo in COMUNAS else None


def flotante(valor: str) -> float | None:
    try:
        return float(valor.strip().replace(",", "."))
    except (ValueError, AttributeError):
        return None


def coordenada_valida(lat: float | None, lng: float | None) -> bool:
    return (
        lat is not None
        and lng is not None
        and BBOX["latMin"] < lat < BBOX["latMax"]
        and BBOX["lngMin"] < lng < BBOX["lngMax"]
    )


def celda(lat: float, lng: float) -> tuple[int, int]:
    return (math.floor(lat / RESOLUCION_GRADOS), math.floor(lng / RESOLUCION_GRADOS))


def suprimir(n: int) -> int | None:
    """Conteo publicable: null si 1 ≤ n < UMBRAL."""
    return None if 0 < n < UMBRAL else n


def invertir(grupos: dict[str, list[str]]) -> dict[str, str]:
    return {v.casefold(): k for k, vs in grupos.items() for v in vs}


MAPA_CONDICION = invertir(CONDICIONES)
MAPA_MODALIDAD = invertir(MODALIDADES)


def leer_csv(ruta: str):
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        lector = csv.reader(f)
        encabezado = next(lector)
        idx = {c.strip(): i for i, c in enumerate(encabezado)}
        for fila in lector:
            if len(fila) != len(encabezado):
                continue
            yield fila, idx


def escribir_json(ruta: str, contenido: dict) -> int:
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(contenido, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    return os.path.getsize(ruta)


def cabecera(clave: str, meta: dict, filas: int, con_coordenadas: int, fecha_corte: str | None, periodo: tuple) -> dict:
    f = FUENTES[clave]
    return {
        "generado": ahora_iso(),
        "fuente": {
            "nombre": f["nombre"],
            "id": f["id"],
            "url": URL_CONJUNTO.format(id=f["id"]),
            "archivo": URL_DISTRIBUCION.format(id=f["id"], archivo=f["archivo"]),
            "publicador": "MEData · Alcaldía de Medellín",
            "licencia": meta["licencia"],
            "modificadoPortal": meta["modificadoPortal"],
            "fechaCorte": fecha_corte,
            "periodo": {"desde": periodo[0], "hasta": periodo[1]},
            "filasLeidas": filas,
            "filasConCoordenadas": con_coordenadas,
        },
        "umbralSupresion": UMBRAL,
    }


def bloque_rejilla() -> dict:
    return {
        "grados": RESOLUCION_GRADOS,
        "metrosAprox": 250,
        "descripcion": "i = floor(lat/0.00225), j = floor(lng/0.00225) sobre WGS84; centro = ((i+0.5)·res, (j+0.5)·res)",
    }


def rejilla_simple(contador: collections.Counter) -> tuple[list, dict]:
    """Celdas {i,j,n} con n ≥ UMBRAL; las demás se eliminan."""
    celdas = [{"i": i, "j": j, "n": n} for (i, j), n in sorted(contador.items()) if n >= UMBRAL]
    return celdas, {"celdasTotales": len(contador), "celdasSuprimidas": len(contador) - len(celdas)}


def tabla(contador: collections.Counter, claves: tuple[str, ...]) -> tuple[list, dict]:
    """Filas {clave…, n} con n = null cuando 1 ≤ n < UMBRAL."""
    filas = []
    suprimidas = 0
    for k, n in sorted(contador.items(), key=lambda kv: kv[0]):
        fila = dict(zip(claves, k))
        fila["n"] = suprimir(n)
        suprimidas += fila["n"] is None
        filas.append(fila)
    return filas, {"filasTotales": len(filas), "filasSuprimidas": suprimidas}


# ───────────────────────── incidentes ─────────────────────────


def procesar_incidentes(ruta: str, meta: dict, salida: str) -> dict:
    rejilla = collections.Counter()
    comuna_anio_grav = collections.Counter()
    comuna_hora = collections.Counter()
    filas = con_coord = sin_comuna = 0
    fecha_min = fecha_max = None

    for fila, idx in leer_csv(ruta):
        filas += 1
        m = re.match(r"\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]", fila[idx["LOCATION"]])
        if m:
            lng, lat = float(m.group(1)), float(m.group(2))
            if coordenada_valida(lat, lng):
                con_coord += 1
                rejilla[celda(lat, lng)] += 1
        anio_txt = re.sub(r"\D", "", fila[idx["AÑO"]])  # '2019\r' → '2019'
        gravedad = fila[idx["GRAVEDAD_ACCIDENTE"]].replace("\\xF1", "ñ").strip()
        comuna = normalizar_comuna(fila[idx["NUMCOMUNA"]])
        hm = re.search(r"\s(\d{1,2}):\d{2}", fila[idx["FECHA_ACCIDENTE"]])  # hora local
        fecha_iso = fila[idx["FECHA_ACCIDENTES"]][:10]
        if re.match(r"\d{4}-\d{2}-\d{2}", fecha_iso):
            fecha_min = fecha_iso if fecha_min is None or fecha_iso < fecha_min else fecha_min
            fecha_max = fecha_iso if fecha_max is None or fecha_iso > fecha_max else fecha_max
        if comuna is None:
            sin_comuna += 1
            continue
        if len(anio_txt) == 4 and gravedad:
            comuna_anio_grav[(comuna, int(anio_txt), gravedad)] += 1
        if hm:
            comuna_hora[(comuna, int(hm.group(1)))] += 1

    base = cabecera("incidentes", meta, filas, con_coord, fecha_max, (fecha_min, fecha_max))
    celdas, sup_rej = rejilla_simple(rejilla)
    t1, sup1 = tabla(comuna_anio_grav, ("c", "a", "g"))
    t2, sup2 = tabla(comuna_hora, ("c", "h"))

    b1 = escribir_json(
        os.path.join(salida, "rejilla-incidentes.json"),
        {**base, "resolucion": bloque_rejilla(), "supresion": sup_rej, "campos": {"i": "fila (lat)", "j": "columna (lng)", "n": "incidentes"}, "celdas": celdas},
    )
    b2 = escribir_json(
        os.path.join(salida, "incidentes-comuna.json"),
        {
            **base,
            "notas": [
                "NUMCOMUNA normalizado a dos dígitos ('5', '5.0' → '05'); 'Sin Inf', 'AU', 'In', 'SN' y '0' excluidos",
                f"filas sin comuna válida excluidas de las tablas por comuna: {sin_comuna}",
                "hora tomada de FECHA_ACCIDENTE (hora local); gravedad 'Solo da\\xF1os' corregida a 'Solo daños'",
            ],
            "campos": {"c": "código de comuna", "a": "año", "g": "gravedad del incidente", "h": "hora local 0–23", "n": "incidentes (null = 1–4 suprimido)"},
            "supresion": {"comunaAnioGravedad": sup1, "comunaHora": sup2},
            "comunaAnioGravedad": t1,
            "comunaHora": t2,
        },
    )
    return {
        "filasLeidas": filas,
        "conCoordenadas": con_coord,
        "rejilla": sup_rej,
        "tablas": {"comunaAnioGravedad": sup1, "comunaHora": sup2},
        "bytes": b1 + b2,
        "fechaCorte": fecha_max,
    }


# ───────────────────────── víctimas ─────────────────────────


def procesar_victimas(ruta: str, meta: dict, salida: str) -> dict:
    rejilla: dict[tuple[int, int], collections.Counter] = collections.defaultdict(collections.Counter)
    comuna_anio_cond: dict[tuple, collections.Counter] = collections.defaultdict(collections.Counter)
    muertos_anio = collections.Counter()
    filas = con_coord = sin_comuna = vacias = 0
    fecha_min = fecha_max = None

    for fila, idx in leer_csv(ruta):
        anio_txt = fila[idx["Año"]].strip()
        if not anio_txt:  # ~800 k filas vacías de relleno al final del archivo
            vacias += 1
            continue
        filas += 1
        gravedad = fila[idx["Gravedad_victima"]].strip()
        es_muerto = gravedad == "Muertos"
        condicion = MAPA_CONDICION.get(fila[idx["Condicion"]].strip().casefold(), "otro")
        comuna = normalizar_comuna(fila[idx["Comuna"]])
        lat, lng = flotante(fila[idx["Latitud"]]), flotante(fila[idx["Longitud"]])
        try:
            fecha = dt.datetime.strptime(fila[idx["Fecha_incidente"]].strip(), "%d/%m/%Y").date().isoformat()
            fecha_min = fecha if fecha_min is None or fecha < fecha_min else fecha_min
            fecha_max = fecha if fecha_max is None or fecha > fecha_max else fecha_max
        except ValueError:
            pass
        if coordenada_valida(lat, lng):
            con_coord += 1
            c = rejilla[celda(lat, lng)]
            c["n"] += 1
            c[condicion] += 1
            c["muertos" if es_muerto else "heridos"] += 1
        if anio_txt.isdigit():
            anio = int(anio_txt)
            if es_muerto:
                muertos_anio[(anio,)] += 1
            if comuna is None:
                sin_comuna += 1
            else:
                k = comuna_anio_cond[(comuna, anio, condicion)]
                k["n"] += 1
                k["muertos" if es_muerto else "heridos"] += 1

    base = cabecera("victimas", meta, filas, con_coord, fecha_max, (fecha_min, fecha_max))
    base["fuente"]["filasVaciasOmitidas"] = vacias

    celdas = []
    for (i, j), c in sorted(rejilla.items()):
        if c["n"] < UMBRAL:
            continue
        celdas.append(
            {
                "i": i,
                "j": j,
                "n": c["n"],
                "peaton": suprimir(c["peaton"]),
                "motociclista": suprimir(c["motociclista"]),
                "ciclista": suprimir(c["ciclista"]),
                "otro": suprimir(c["otro"]),
                "heridos": suprimir(c["heridos"]),
                "muertos": suprimir(c["muertos"]),
            }
        )
    sup_rej = {"celdasTotales": len(rejilla), "celdasSuprimidas": len(rejilla) - len(celdas)}

    t1 = []
    sup1 = 0
    for (comuna, anio, cond), c in sorted(comuna_anio_cond.items()):
        n = suprimir(c["n"])
        sup1 += n is None
        t1.append({"c": comuna, "a": anio, "cond": cond, "n": n, "heridos": suprimir(c["heridos"]), "muertos": suprimir(c["muertos"])})
    t2, sup2 = tabla(muertos_anio, ("a",))

    b1 = escribir_json(
        os.path.join(salida, "rejilla-victimas.json"),
        {
            **base,
            "resolucion": bloque_rejilla(),
            "supresion": sup_rej,
            "condiciones": CONDICIONES,
            "campos": {"n": "víctimas", "peaton|motociclista|ciclista|otro": "víctimas por condición (null = 1–4)", "heridos|muertos": "víctimas por gravedad (null = 1–4)"},
            "celdas": celdas,
        },
    )
    b2 = escribir_json(
        os.path.join(salida, "victimas-comuna.json"),
        {
            **base,
            "notas": [
                "Comuna '04 - Aranjuez' normalizada a '04'; 'Sin Inf' excluido",
                f"filas sin comuna válida excluidas de comunaAnioCondicion: {sin_comuna}",
                "muertosPorAnio cuenta filas con Gravedad_victima = 'Muertos' (serie MEData; el último año puede ser parcial)",
            ],
            "condiciones": CONDICIONES,
            "campos": {"c": "código de comuna", "a": "año", "cond": "condición agrupada", "n": "víctimas (null = 1–4)", "heridos|muertos": "por gravedad (null = 1–4)"},
            "supresion": {"comunaAnioCondicion": {"filasTotales": len(t1), "filasSuprimidas": sup1}, "muertosPorAnio": sup2},
            "comunaAnioCondicion": t1,
            "muertosPorAnio": t2,
        },
    )
    return {
        "filasLeidas": filas,
        "filasVacias": vacias,
        "conCoordenadas": con_coord,
        "rejilla": sup_rej,
        "tablas": {"comunaAnioCondicion": {"filasTotales": len(t1), "filasSuprimidas": sup1}, "muertosPorAnio": sup2},
        "bytes": b1 + b2,
        "fechaCorte": fecha_max,
    }


# ───────────────────────── hurto a persona ─────────────────────────


def procesar_hurto(ruta: str, meta: dict, salida: str) -> dict:
    rejilla = collections.Counter()
    comuna_anio_mod = collections.Counter()
    dia_hora = collections.Counter()
    filas = con_coord = sin_comuna = 0
    fecha_min = fecha_max = None

    for fila, idx in leer_csv(ruta):
        filas += 1
        fecha_txt = fila[idx["fecha_hecho"]].strip()
        fecha = fecha_txt[:10]
        if re.match(r"\d{4}-\d{2}-\d{2}", fecha):
            fecha_min = fecha if fecha_min is None or fecha < fecha_min else fecha_min
            fecha_max = fecha if fecha_max is None or fecha > fecha_max else fecha_max
        lat, lng = flotante(fila[idx["latitud"]]), flotante(fila[idx["longitud"]])
        if coordenada_valida(lat, lng):
            con_coord += 1
            rejilla[celda(lat, lng)] += 1
        hm = re.match(r"\d{4}-\d{2}-\d{2}T(\d{2}):", fecha_txt)
        hora = int(hm.group(1)) if hm else None
        try:
            dia = dt.date.fromisoformat(fecha).weekday()  # 0 = lunes
        except ValueError:
            dia = None
        if hora is not None and dia is not None:
            dia_hora[(dia, hora)] += 1
        comuna = normalizar_comuna(fila[idx["codigo_comuna"]])
        if comuna is None:
            sin_comuna += 1
            continue
        if fecha[:4].isdigit():
            modalidad = MAPA_MODALIDAD.get(fila[idx["modalidad"]].strip().casefold(), "Otra")
            comuna_anio_mod[(comuna, int(fecha[:4]), modalidad)] += 1

    base = cabecera("hurto", meta, filas, con_coord, fecha_max, (fecha_min, fecha_max))
    celdas, sup_rej = rejilla_simple(rejilla)
    t1, sup1 = tabla(comuna_anio_mod, ("c", "a", "m"))
    t2, sup2 = tabla(dia_hora, ("d", "h"))

    b1 = escribir_json(
        os.path.join(salida, "rejilla-hurto.json"),
        {**base, "resolucion": bloque_rejilla(), "supresion": sup_rej, "campos": {"i": "fila (lat)", "j": "columna (lng)", "n": "hurtos a persona"}, "celdas": celdas},
    )
    b2 = escribir_json(
        os.path.join(salida, "hurto-comuna.json"),
        {
            **base,
            "notas": [
                "codigo_comuna normalizado a dos dígitos; 'SIN DATO' excluido",
                f"filas sin comuna válida excluidas de comunaAnioModalidad: {sin_comuna}",
                "modalidades agrupadas según `modalidades`; las no listadas van a 'Otra'",
                "diaSemanaHora: d = 0 lunes … 6 domingo (ISO), h = hora local 0–23 de fecha_hecho",
            ],
            "modalidades": MODALIDADES,
            "campos": {"c": "código de comuna", "a": "año", "m": "modalidad agrupada", "d": "día de la semana", "h": "hora", "n": "hurtos (null = 1–4)"},
            "supresion": {"comunaAnioModalidad": sup1, "diaSemanaHora": sup2},
            "comunaAnioModalidad": t1,
            "diaSemanaHora": t2,
        },
    )
    return {
        "filasLeidas": filas,
        "conCoordenadas": con_coord,
        "rejilla": sup_rej,
        "tablas": {"comunaAnioModalidad": sup1, "diaSemanaHora": sup2},
        "bytes": b1 + b2,
        "fechaCorte": fecha_max,
    }


PROCESADORES = {"incidentes": procesar_incidentes, "victimas": procesar_victimas, "hurto": procesar_hurto}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--cache", default=CACHE_DEFECTO, help="carpeta caché de los CSV crudos (por defecto .cache-datos/)")
    p.add_argument("--salida", default=SALIDA_DEFECTO, help="carpeta de los JSON agregados")
    p.add_argument("--solo", choices=sorted(FUENTES), action="append", help="procesar solo este conjunto (repetible)")
    args = p.parse_args()

    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(args.salida, exist_ok=True)
    claves = args.solo or list(FUENTES)
    resumen = {}
    for clave in claves:
        print(f"\n== {FUENTES[clave]['nombre']} ({FUENTES[clave]['id']})")
        try:
            ruta = asegurar_csv(clave, args.cache)
        except (urllib.error.URLError, RuntimeError, OSError) as e:
            print(f"  ERROR: no se pudo obtener el CSV: {e}", file=sys.stderr)
            return 1
        meta = metadato(clave, args.cache)
        r = PROCESADORES[clave](ruta, meta, args.salida)
        resumen[clave] = r
        pct = 100 * r["conCoordenadas"] / r["filasLeidas"] if r["filasLeidas"] else 0
        print(f"  filas leídas: {r['filasLeidas']:,}" + (f" (+{r['filasVacias']:,} vacías omitidas)" if r.get("filasVacias") else ""))
        print(f"  con coordenadas válidas: {r['conCoordenadas']:,} ({pct:.1f} %) · corte: {r['fechaCorte']} · licencia: {meta['licencia']}")
        print(f"  rejilla 250 m: {r['rejilla']['celdasTotales']:,} celdas, {r['rejilla']['celdasSuprimidas']:,} suprimidas (n<{UMBRAL})")
        for nombre, s in r["tablas"].items():
            print(f"  tabla {nombre}: {s['filasTotales']:,} filas, {s['filasSuprimidas']:,} con n=null")
        print(f"  bytes escritos: {r['bytes']:,}")

    print("\nRESUMEN JSON:", json.dumps(resumen, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
