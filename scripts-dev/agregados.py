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
demás tablas, cualquier conteo entre 1 y 4 se escribe como null. El 0 nunca se escribe en las
tablas (las combinaciones sin casos simplemente no aparecen).

Supresión complementaria (secundaria): un null aislado dentro de un grupo cuyo total se conoce
(los sub-conteos de una celda suman su `n`; las filas de una comuna suman lo mismo en las dos tablas
de incidentes; las modalidades de hurto de una comuna-año suman el total del consolidado 303) se
recuperaría exacto por diferencia. Por eso, cuando en un grupo queda exactamente un null, se anula
también el menor valor publicado > 0 del grupo (`supresion_complementaria`). En víctimas, heridos y
muertos suman `n`: si uno queda en null se anula también el otro (celdas y tabla por comuna).

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


def supresion_complementaria(elementos: list, leer, anular) -> int:
    """
    Supresión secundaria dentro de un grupo cuyo total es conocido o derivable: si exactamente un
    elemento quedó en null, su valor se recuperaría como total − Σ publicados, así que se anula también
    el menor valor publicado > 0 del grupo (con dos nulls solo se conoce su suma, nunca cada uno).
    `leer(e)` devuelve el conteo publicado del elemento (int o None) y `anular(e)` lo pone en null.
    Devuelve cuántos elementos se anularon (0 o 1).
    """
    nulos = [e for e in elementos if leer(e) is None]
    if len(nulos) != 1:
        return 0
    candidatos = [e for e in elementos if leer(e) is not None and leer(e) > 0]
    if not candidatos:
        return 0
    anular(min(candidatos, key=leer))
    return 1


def complementar_subconteos(registro: dict, campos: tuple[str, ...]) -> int:
    """Aplica `supresion_complementaria` a los sub-conteos `campos` de un dict que suman su total publicado."""
    return supresion_complementaria(list(campos), lambda k: registro[k], lambda k: registro.__setitem__(k, None))


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


def tabla(contador: collections.Counter, claves: tuple[str, ...], grupo=None) -> tuple[list, dict]:
    """
    Filas {clave…, n} con n = null cuando 1 ≤ n < UMBRAL.
    `grupo(fila)` define los grupos cuyo total es conocible desde otra tabla o fuente (p. ej. la comuna,
    o la pareja comuna-año): en cada grupo con exactamente un null se anula además la fila publicada más
    pequeña (supresión complementaria), y se cuenta en `secundarias` (incluidas en `filasSuprimidas`).
    """
    filas = []
    for k, n in sorted(contador.items(), key=lambda kv: kv[0]):
        fila = dict(zip(claves, k))
        fila["n"] = suprimir(n)
        filas.append(fila)
    secundarias = 0
    if grupo is not None:
        grupos: dict = collections.defaultdict(list)
        for fila in filas:
            grupos[grupo(fila)].append(fila)
        for miembros in grupos.values():
            secundarias += supresion_complementaria(miembros, lambda f: f["n"], lambda f: f.__setitem__("n", None))
    suprimidas = sum(f["n"] is None for f in filas)
    return filas, {"filasTotales": len(filas), "filasSuprimidas": suprimidas, "secundarias": secundarias}


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
    # Las dos tablas suman (casi) lo mismo por comuna, así que un null aislado en una se recupera restando
    # la otra: supresión complementaria por comuna en ambas.
    por_comuna = lambda f: f["c"]  # noqa: E731
    t1, sup1 = tabla(comuna_anio_grav, ("c", "a", "g"), grupo=por_comuna)
    t2, sup2 = tabla(comuna_hora, ("c", "h"), grupo=por_comuna)

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
                "supresión complementaria por comuna: si una comuna queda con un solo null en una tabla, se anula también su fila publicada más pequeña en esa tabla (supresion.*.secundarias), porque ambas tablas suman lo mismo por comuna",
            ],
            "campos": {"c": "código de comuna", "a": "año", "g": "gravedad del incidente", "h": "hora local 0–23", "n": "incidentes (null = suprimido: 1–4 o complementario)"},
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

    # Rejilla: las condiciones suman `n` y heridos + muertos = n. En cada grupo, si queda exactamente un
    # sub-conteo en null se anula además el menor publicado > 0 (supresión complementaria); si no, el null
    # se recuperaba por diferencia (p. ej. muertos = n − heridos).
    campos_condicion = tuple(CONDICIONES)
    celdas = []
    sec_rej = 0
    for (i, j), c in sorted(rejilla.items()):
        if c["n"] < UMBRAL:
            continue
        celda_pub = {"i": i, "j": j, "n": c["n"], **{k: suprimir(c[k]) for k in campos_condicion}, "heridos": suprimir(c["heridos"]), "muertos": suprimir(c["muertos"])}
        sec_rej += complementar_subconteos(celda_pub, campos_condicion)
        sec_rej += complementar_subconteos(celda_pub, ("heridos", "muertos"))
        celdas.append(celda_pub)
    sup_rej = {"celdasTotales": len(rejilla), "celdasSuprimidas": len(rejilla) - len(celdas), "secundarias": sec_rej}

    # Tabla comuna×año×condición: heridos + muertos = n. Si `n` está publicado y exactamente uno de los dos
    # queda en null, se anula también el otro (de lo contrario muertos = n − heridos, exacto).
    t1 = []
    sup1 = sec1 = 0
    for (comuna, anio, cond), c in sorted(comuna_anio_cond.items()):
        fila = {"c": comuna, "a": anio, "cond": cond, "n": suprimir(c["n"]), "heridos": suprimir(c["heridos"]), "muertos": suprimir(c["muertos"])}
        sup1 += fila["n"] is None
        if fila["n"] is not None:
            sec1 += complementar_subconteos(fila, ("heridos", "muertos"))
        t1.append(fila)
    sup_t1 = {"filasTotales": len(t1), "filasSuprimidas": sup1, "secundarias": sec1}
    t2, sup2 = tabla(muertos_anio, ("a",))

    b1 = escribir_json(
        os.path.join(salida, "rejilla-victimas.json"),
        {
            **base,
            "resolucion": bloque_rejilla(),
            "supresion": sup_rej,
            "condiciones": CONDICIONES,
            "notas": [
                "supresión complementaria: si en una celda queda exactamente una condición en null se anula también la menor publicada > 0; si heridos o muertos queda en null se anula el otro (heridos + muertos = n). Contadas en supresion.secundarias",
            ],
            "campos": {"n": "víctimas", "peaton|motociclista|ciclista|otro": "víctimas por condición (null = suprimido: 1–4 o complementario)", "heridos|muertos": "víctimas por gravedad (null = suprimido: 1–4 o complementario)"},
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
            "supresion": {"comunaAnioCondicion": sup_t1, "muertosPorAnio": sup2},
            "comunaAnioCondicion": t1,
            "muertosPorAnio": t2,
        },
    )
    return {
        "filasLeidas": filas,
        "filasVacias": vacias,
        "conCoordenadas": con_coord,
        "rejilla": sup_rej,
        "tablas": {"comunaAnioCondicion": sup_t1, "muertosPorAnio": sup2},
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
    # El consolidado 303 (fixture del repo) publica el total de hurto a persona por comuna-año, así que un null
    # aislado entre las modalidades se recuperaba por diferencia: supresión complementaria por (comuna, año).
    t1, sup1 = tabla(comuna_anio_mod, ("c", "a", "m"), grupo=lambda f: (f["c"], f["a"]))
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
                "supresión complementaria por comuna-año: si queda una sola modalidad en null se anula también la menor publicada > 0 (supresion.comunaAnioModalidad.secundarias), porque el consolidado 303 publica el total",
            ],
            "modalidades": MODALIDADES,
            "campos": {"c": "código de comuna", "a": "año", "m": "modalidad agrupada", "d": "día de la semana", "h": "hora", "n": "hurtos (null = suprimido: 1–4 o complementario)"},
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
