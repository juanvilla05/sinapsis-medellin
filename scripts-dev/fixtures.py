#!/usr/bin/env python3
"""
Captura de los fixtures de respaldo de la Sala de Monitoreo (src/lib/monitoreo/fixtures/).
Solo biblioteca estándar. Cada captura guarda URL exacta, fecha/hora (America/Bogota) y la
licencia tal como la declara la fuente en sus metadatos; si la fuente no la declara: "no declarada".

  · comunas.geojson      capa comunas_y_corregimientos (ArcGIS Online, cuenta DAGRD de la Alcaldía),
                         23 features → se quitan SN01/SN02 → 21, verificadas contra los códigos oficiales.
  · policia-anio.json    datos.gov.co ha6j-pa2r (Policía Nacional) agregado por año para Medellín (SoQL), tal cual responde.
  · consolidado-303.csv  MEData 1-027-23-000303, bytes tal cual; consolidado-303.json = sus filas (espejo importable).
  · indice.json          metadatos de las tres capturas (lo lee src/lib/monitoreo/fuentes.ts).

Uso: python3 scripts-dev/fixtures.py [--salida src/lib/monitoreo/fixtures]
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import sys
import urllib.request
from zoneinfo import ZoneInfo

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA_DEFECTO = os.path.join(RAIZ, "src", "lib", "monitoreo", "fixtures")

COMUNAS = {f"{n:02d}" for n in range(1, 17)} | {"50", "60", "70", "80", "90"}

URL_COMUNAS = (
    "https://services1.arcgis.com/FZVaYraI7sEGQ6rF/arcgis/rest/services/comunas_y_corregimientos/FeatureServer/0/query"
    "?where=1%3D1&outFields=codigo,nombre&outSR=4326&maxAllowableOffset=0.0003&f=geojson"
)
URL_COMUNAS_ITEM = "https://www.arcgis.com/sharing/rest/content/items/ef54074c904c4db897b2c4959747b23c?f=pjson"
URL_COMUNAS_PAGINA = "https://geomedellin-m-medellin.opendata.arcgis.com/datasets/M-Medellin::comunas-y-corregimientos"

URL_POLICIA = (
    "https://www.datos.gov.co/resource/ha6j-pa2r.json"
    "?$select=substring(fecha_hecho,7,4)%20as%20anio,count(*)%20as%20n,sum(cantidad::number)%20as%20victimas"
    "&$where=codigo_dane=%2705001000%27&$group=anio&$order=anio"
)
URL_POLICIA_META = "https://www.datos.gov.co/api/views/ha6j-pa2r.json"
URL_POLICIA_PAGINA = "https://www.datos.gov.co/d/ha6j-pa2r"

ID_CONSOLIDADO = "1-027-23-000303"
URL_CONSOLIDADO = (
    "https://medata.app.medellin.gov.co/sites/default/files/distribution/1-027-23-000303/"
    "consolidado_cantidad_casos_criminalidad_en_comunas_por_anio.csv"
)
URL_CONSOLIDADO_META = f"https://medata.app.medellin.gov.co/api/1/metastore/schemas/dataset/items/{ID_CONSOLIDADO}"
URL_CONSOLIDADO_PAGINA = f"https://medata.app.medellin.gov.co/dataset/{ID_CONSOLIDADO}"


def ahora_bogota() -> str:
    return dt.datetime.now(ZoneInfo("America/Bogota")).isoformat(timespec="seconds")


def bajar(url: str) -> bytes:
    peticion = urllib.request.Request(url, headers={"User-Agent": "SINAPSIS-Medellin/fixtures.py (python-urllib)"})
    with urllib.request.urlopen(peticion, timeout=90) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status} en {url}")
        return resp.read()


def bajar_json(url: str):
    return json.loads(bajar(url).decode("utf-8"))


def guardar_json(ruta: str, datos, compacto=True) -> int:
    with open(ruta, "w", encoding="utf-8") as f:
        if compacto:
            json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return os.path.getsize(ruta)


def capturar_comunas(salida: str) -> dict:
    print("== comunas (ArcGIS Online, DAGRD)")
    capturado = ahora_bogota()
    geo = bajar_json(URL_COMUNAS)
    total = len(geo["features"])
    features = []
    for f in geo["features"]:
        codigo = str(f["properties"].get("codigo", "")).strip()
        if codigo not in COMUNAS:
            print(f"  descartada feature con código {codigo!r}")
            continue
        features.append({"type": "Feature", "properties": {"codigo": codigo, "nombre": str(f["properties"].get("nombre", "")).strip()}, "geometry": f["geometry"]})
    codigos = {f["properties"]["codigo"] for f in features}
    if codigos != COMUNAS:
        raise SystemExit(f"códigos del GeoJSON no coinciden con los oficiales: faltan {sorted(COMUNAS - codigos)}, sobran {sorted(codigos - COMUNAS)}")
    features.sort(key=lambda f: f["properties"]["codigo"])
    coleccion = {"type": "FeatureCollection", "features": features}
    bytes_ = guardar_json(os.path.join(salida, "comunas.geojson"), coleccion)
    licencia = "no declarada"
    try:
        item = bajar_json(URL_COMUNAS_ITEM)
        texto = (item.get("licenseInfo") or "").strip()
        licencia = texto or "no declarada"
        propietario = item.get("owner")
    except Exception as e:  # noqa: BLE001 — el metadato es opcional
        print(f"  aviso: no se pudo leer el ítem de ArcGIS ({e.__class__.__name__})")
        propietario = None
    print(f"  {total} features → {len(features)} · {bytes_:,} bytes · licencia: {licencia}")
    return {
        "archivo": "comunas.geojson",
        "nombre": "Comunas y corregimientos de Medellín (capa comunas_y_corregimientos)",
        "publicador": "Alcaldía de Medellín · DAGRD (ArcGIS Online, acceso público)",
        "url": URL_COMUNAS,
        "pagina": URL_COMUNAS_PAGINA,
        "item": URL_COMUNAS_ITEM,
        "propietarioItem": propietario,
        "capturado": capturado,
        "licencia": licencia,
        "featuresOrigen": total,
        "features": len(features),
        "nota": "geometría simplificada en origen con maxAllowableOffset=0.0003; SN01/SN02 (polígonos sin nombre) eliminados",
    }


def capturar_policia(salida: str) -> dict:
    print("== Policía Nacional (datos.gov.co ha6j-pa2r)")
    capturado = ahora_bogota()
    filas = bajar_json(URL_POLICIA)
    if not isinstance(filas, list) or not filas or not {"anio", "n", "victimas"} <= set(filas[0]):
        raise SystemExit(f"respuesta SoQL inesperada: {str(filas)[:200]}")
    bytes_ = guardar_json(os.path.join(salida, "policia-anio.json"), filas, compacto=False)
    licencia = "no declarada"
    atribucion = None
    actualizado = None
    try:
        meta = bajar_json(URL_POLICIA_META)
        lic = meta.get("license") or {}
        if lic.get("name"):
            licencia = f"{lic['name']} ({meta.get('licenseId', '')}) — {lic.get('termsLink', '')}".strip()
        atribucion = meta.get("attribution")
        if meta.get("rowsUpdatedAt"):
            actualizado = dt.datetime.fromtimestamp(meta["rowsUpdatedAt"], ZoneInfo("America/Bogota")).isoformat(timespec="seconds")
    except Exception as e:  # noqa: BLE001
        print(f"  aviso: no se pudo leer el metadato de datos.gov.co ({e.__class__.__name__})")
    print(f"  {len(filas)} filas ({filas[0]['anio']}–{filas[-1]['anio']}) · {bytes_:,} bytes · licencia: {licencia}")
    return {
        "archivo": "policia-anio.json",
        "nombre": "Homicidios en accidente de tránsito — Policía Nacional (ha6j-pa2r), filtrado a Medellín (codigo_dane = 05001000) y agregado por año",
        "publicador": atribucion or "Policía Nacional de Colombia (datos.gov.co)",
        "url": URL_POLICIA,
        "pagina": URL_POLICIA_PAGINA,
        "capturado": capturado,
        "licencia": licencia,
        "filasActualizadasFuente": actualizado,
        "filas": len(filas),
        "nota": "la serie crece con cada carga de la Policía; el último año es parcial. anio sale de substring(fecha_hecho,7,4) porque fecha_hecho es texto DD/MM/AAAA",
    }


def capturar_consolidado(salida: str) -> dict:
    print(f"== MEData {ID_CONSOLIDADO} (consolidado criminalidad por comuna y año)")
    capturado = ahora_bogota()
    crudo = bajar(URL_CONSOLIDADO)
    with open(os.path.join(salida, "consolidado-303.csv"), "wb") as f:
        f.write(crudo)
    lector = csv.reader(io.StringIO(crudo.decode("utf-8-sig")))
    encabezado = next(lector)
    filas = [fila for fila in lector if len(fila) == len(encabezado)]
    bytes_ = guardar_json(os.path.join(salida, "consolidado-303.json"), {"encabezado": encabezado, "filas": filas})
    licencia = "no declarada"
    modificado = None
    try:
        meta = bajar_json(URL_CONSOLIDADO_META)
        licencia = meta.get("license") or "no declarada"
        modificado = meta.get("modified")
    except Exception as e:  # noqa: BLE001
        print(f"  aviso: no se pudo leer el metadato DKAN ({e.__class__.__name__})")
    print(f"  {len(crudo):,} bytes CSV · {len(filas)} filas · espejo JSON {bytes_:,} bytes · licencia: {licencia}")
    return {
        "archivo": "consolidado-303.csv",
        "espejo": "consolidado-303.json",
        "nombre": "Consolidado cantidad de casos criminalidad en comunas por año",
        "id": ID_CONSOLIDADO,
        "publicador": "MEData · Alcaldía de Medellín (SISC)",
        "url": URL_CONSOLIDADO,
        "pagina": URL_CONSOLIDADO_PAGINA,
        "capturado": capturado,
        "licencia": licencia,
        "modificadoPortal": modificado,
        "encabezado": encabezado,
        "filas": len(filas),
        "nota": "Codigo_comuna llega como '10' y '10.0' (y 'SIN DATO'): se normaliza en src/lib/monitoreo/fuentes.ts",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--salida", default=SALIDA_DEFECTO)
    p.add_argument("--solo", choices=["comunas", "policia", "consolidado"], action="append")
    args = p.parse_args()
    os.makedirs(args.salida, exist_ok=True)
    ruta_indice = os.path.join(args.salida, "indice.json")
    indice = {}
    if os.path.exists(ruta_indice):
        with open(ruta_indice, encoding="utf-8") as f:
            indice = json.load(f)
    capturas = {"comunas": capturar_comunas, "policia": capturar_policia, "consolidado": capturar_consolidado}
    for clave in args.solo or list(capturas):
        indice[clave] = capturas[clave](args.salida)
    guardar_json(ruta_indice, indice, compacto=False)
    print(f"\níndice escrito en {ruta_indice}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
