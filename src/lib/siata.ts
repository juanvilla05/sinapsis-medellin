import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import fixture602 from "./fixtures/siata-602.json";
import fixture603 from "./fixtures/siata-603.json";
import { calcularICA, categoriaDesdeSiata, categoriaICA, esCentinela } from "./ica";
import { COMUNAS_MEDELLIN, MUNICIPIOS_AMVA } from "./territorio";
import { resumirEstaciones, type CapaSiata, type EstacionSiata, type FuenteSiata, type SnapshotSiata, type SnapshotSiataOk } from "./aire";

export type { CapaSiata, EstacionSiata, EstacionResumen, ResumenAire, SnapshotSiata, SnapshotSiataOk, SnapshotSiataError } from "./aire";

/**
 * SIATA — Sistema de Alerta Temprana de Medellín y el Valle de Aburrá (Área Metropolitana del Valle de Aburrá).
 * Última lectura de PM2.5 por estación, capas 602 (POECA, 20 estaciones) y 603 (NO POECA / tráfico, 3) del visor.
 *
 * Endpoint público, sin autenticación ni CORS: se consulta SOLO desde el servidor (`server-only`).
 * Porte quirúrgico de `pulso-medellin/lib/data/siata.ts`; los schemas zod se copian tal cual.
 *
 * Particularidades del servicio que motivan el código defensivo:
 *  - El `Content-Type` miente (dice text/html) y el cuerpo empieza con saltos de línea → `res.text()` + `trim()`.
 *  - Todos los números vienen como texto ("22.0", "-75.5972061").
 *  - `ICA_PM25_Valor` es la CONCENTRACIÓN de PM2.5 en µg/m³, no el índice; `ICA_PM25_Descripcion` es la categoría oficial.
 *  - Centinela `-9999` / `ND` = sin dato (estación #87 Bello en la captura) → `pm25: null`, nunca se promedia.
 *  - Estaciones con prefijo `_OFF-` están fuera de servicio → se descartan.
 *  - El campo `Municipio` no es fiable (#28 dice "Medellin" pero la estación está en Itagüí; #38 trae "Itag&#252í") →
 *    `resolverMunicipio` normaliza entidades HTML y tildes y deja que el nombre oficial de la estación prevalezca.
 *
 * `obtenerAire()` nunca lanza: si SIATA no responde, devuelve la copia guardada de `src/lib/fixtures` con `guardado: true`.
 */

const SIATA_URL_OFICIAL = "https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga";
/** POECA: 20 estaciones de calidad del aire del AMVA. */
const CAPA_POECA = "C_00000000000000000000602";
/** NO POECA: 3 estaciones de tráfico/industriales con PM2.5. */
const CAPA_TRAFICO = "C_00000000000000000000603";
/** Fecha de la captura de los fixtures (ver src/lib/fixtures/README.md). */
const FECHA_CAPTURA_FIXTURE = "2026-11-09T01:05:00-05:00";
const TIEMPO_MAXIMO_MS = 8_000;

export const FUENTE_SIATA: FuenteSiata = {
  nombre: "SIATA",
  entidad: "SIATA – Área Metropolitana del Valle de Aburrá (capas 602/603 del visor)",
  url: SIATA_URL_OFICIAL,
  capas: [CAPA_POECA, CAPA_TRAFICO],
  licencia: "no declarada",
};

// ──────────────────────────────────────────────────────────────────────
// Schemas zod (copiados de PULSO sin cambios)
// ──────────────────────────────────────────────────────────────────────

const ValorAlfanumericoSchema = z.object({
  valor_alfanumerico: z.string().optional(),
});

const DescripcionSchema = z
  .object({
    Codigo: ValorAlfanumericoSchema.optional(),
    Municipio: ValorAlfanumericoSchema.optional(),
    Latitud: ValorAlfanumericoSchema.optional(),
    Longitud: ValorAlfanumericoSchema.optional(),
    ICA_PM25_Valor: ValorAlfanumericoSchema.optional(),
    ICA_PM25_Descripcion: ValorAlfanumericoSchema.optional(),
    fecha_ultima_actualizacion: ValorAlfanumericoSchema.optional(),
  })
  .passthrough();

const MetadatoSchema = z
  .object({
    name: ValorAlfanumericoSchema.optional(),
  })
  .passthrough();

const AtributosSchema = z.object({
  descripcion: DescripcionSchema.optional(),
  metadato: MetadatoSchema.optional(),
});

const FeatureSchema = z.object({
  geometry_text: z.string().optional(),
  atributos: AtributosSchema.optional(),
});

const SiataResponseSchema = z.object({
  nombre: z.string().optional(),
  feature_vector: z.array(FeatureSchema).optional(),
});

type SiataResponse = z.infer<typeof SiataResponseSchema>;
type SiataFeature = z.infer<typeof FeatureSchema>;

// ──────────────────────────────────────────────────────────────────────
// Ayudantes puros
// ──────────────────────────────────────────────────────────────────────

export function parsearNumeroSiata(s: unknown): number | null {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "Itag&#252í" → "Itagüí" (SIATA mezcla entidades HTML con texto plano). */
export function decodificarEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

const clave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function municipioOficial(texto: string): string | null {
  const k = clave(texto);
  if (!k) return null;
  const exacto = MUNICIPIOS_AMVA.find((m) => clave(m) === k);
  if (exacto) return exacto;
  // "Medellín Almacén General EPM" → Medellín
  return MUNICIPIOS_AMVA.find((m) => k.startsWith(clave(m) + " ")) ?? null;
}

/** Segmentos del nombre oficial "Estación #N - <Municipio>[, <Comuna>] - <Sitio>". */
function segmentos(nombre: string): string[] {
  return nombre
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Municipio normalizado. Base: `descripcion.Municipio` (entidades HTML decodificadas, tildes normalizadas).
 * Si el nombre oficial de la estación declara otro municipio del AMVA en su segundo segmento, prevalece el nombre
 * (caso #28: el campo dice "Medellin" y la estación es "Itagüí - Casa de Justicia Itagüí").
 * Es normalización de metadato, no un dato nuevo.
 */
export function resolverMunicipio(nombre: string, campoMunicipio: string | undefined): string {
  const campo = decodificarEntidades(campoMunicipio ?? "").trim();
  const delCampo = municipioOficial(campo);
  const partes = segmentos(nombre);
  const delNombre = partes.length >= 2 ? municipioOficial(partes[1]!.split(",")[0]!) : null;
  return delNombre ?? delCampo ?? (campo || "Sin municipio");
}

/** Comuna o corregimiento de Medellín cuando el nombre lo menciona ("Medellín, Altavista - …", "… Barrio el Poblado"). */
export function resolverComuna(nombre: string, municipio: string): string | null {
  if (municipio !== "Medellín") return null;
  const partes = segmentos(nombre);
  const trasComa = partes[1]?.split(",")[1]?.trim();
  const compacta = (s: string) => clave(s).replace(/\s/g, "");
  if (trasComa) {
    const c = COMUNAS_MEDELLIN.find((x) => compacta(x.nombre) === compacta(trasComa));
    if (c) return c.nombre;
  }
  const resto = compacta(partes.slice(2).join(" "));
  if (!resto) return null;
  return COMUNAS_MEDELLIN.find((x) => resto.includes(compacta(x.nombre)))?.nombre ?? null;
}

/** "2026-11-09 01:05:00" (hora de Colombia) → "2026-11-09T01:05:00-05:00". */
export function fechaSiataAIso(s: string | undefined): string | null {
  if (!s) return null;
  const iso = `${s.trim()}`.replace(" ", "T") + "-05:00";
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function geometriaALatLng(geometryText: string | undefined): { lat: number; lng: number } | null {
  if (!geometryText) return null;
  try {
    const geom: unknown = JSON.parse(geometryText);
    if (geom && typeof geom === "object" && "coordinates" in geom && Array.isArray((geom as { coordinates: unknown }).coordinates)) {
      const coords = (geom as { coordinates: unknown[] }).coordinates;
      const lng = parsearNumeroSiata(coords[0]);
      const lat = parsearNumeroSiata(coords[1]);
      if (lng !== null && lat !== null) return { lat, lng };
    }
  } catch {
    // se usa Latitud/Longitud de la descripción
  }
  return null;
}

const texto = (v: { valor_alfanumerico?: string } | undefined): string | undefined => v?.valor_alfanumerico?.trim() || undefined;

/** Convierte una feature cruda de SIATA en estación; null si está fuera de servicio o no tiene lo mínimo. */
export function normalizarEstacion(feature: SiataFeature, capa: CapaSiata, consultadoMs: number): EstacionSiata | null {
  const desc = feature.atributos?.descripcion;
  const meta = feature.atributos?.metadato;
  const nombreCrudo = (meta?.name?.valor_alfanumerico ?? "").trim();
  if (nombreCrudo.startsWith("_OFF-")) return null;

  const codigo = parsearNumeroSiata(texto(desc?.Codigo));
  if (codigo === null) return null;

  const posicion = geometriaALatLng(feature.geometry_text) ?? {
    lat: parsearNumeroSiata(texto(desc?.Latitud)),
    lng: parsearNumeroSiata(texto(desc?.Longitud)),
  };
  if (posicion.lat === null || posicion.lng === null) return null;

  const nombre = decodificarEntidades(nombreCrudo) || `Estación #${codigo}`;
  const municipio = resolverMunicipio(nombre, texto(desc?.Municipio));
  const partes = segmentos(nombre);
  const sitio = partes.length >= 3 ? partes[partes.length - 1]! : (partes[1] ?? "");

  const crudo = parsearNumeroSiata(texto(desc?.ICA_PM25_Valor));
  const descripcionIca = texto(desc?.ICA_PM25_Descripcion) ?? "";
  const pm25 = esCentinela(crudo) ? null : crudo;
  const ica = calcularICA(pm25);
  const categoriaCalculada = categoriaICA(ica).clave;
  const categoriaOficial = categoriaDesdeSiata(descripcionIca);
  const categoria = pm25 === null ? "sin-dato" : categoriaOficial === "sin-dato" ? categoriaCalculada : categoriaOficial;

  const actualizado = fechaSiataAIso(texto(desc?.fecha_ultima_actualizacion)) ?? new Date(consultadoMs).toISOString();
  const minutosDesde = Math.max(0, Math.round((consultadoMs - Date.parse(actualizado)) / 60_000));

  const extra = desc as Record<string, { valor_alfanumerico?: string } | undefined> | undefined;
  return {
    codigo,
    nombre,
    sitio,
    municipio,
    enMedellin: municipio === "Medellín",
    comuna: resolverComuna(nombre, municipio),
    lat: posicion.lat,
    lng: posicion.lng,
    pm25,
    ica,
    categoria,
    categoriaCalculada,
    actualizado,
    minutosDesde,
    obsoleta: minutosDesde > 60,
    capa,
    tipoEstacion: texto(extra?.tipo_estacion) ?? null,
    enlace: texto(extra?.link_micrositio) ?? null,
  };
}

/** Une las dos capas, descarta fuera de servicio y deduplica por `Codigo` (no por nombre). */
export function construirEstaciones(poeca: SiataResponse, trafico: SiataResponse, consultadoMs: number): EstacionSiata[] {
  const vistos = new Set<number>();
  const salida: EstacionSiata[] = [];
  const capas: [SiataResponse, CapaSiata][] = [
    [poeca, "poeca"],
    [trafico, "trafico"],
  ];
  for (const [respuesta, capa] of capas) {
    for (const f of respuesta.feature_vector ?? []) {
      const e = normalizarEstacion(f, capa, consultadoMs);
      if (!e || vistos.has(e.codigo)) continue;
      vistos.add(e.codigo);
      salida.push(e);
    }
  }
  return salida.sort((a, b) => a.codigo - b.codigo);
}

function construirSnapshot(
  poeca: SiataResponse,
  trafico: SiataResponse,
  consultado: string,
  respaldo: { capturado: string; aviso: string } | null,
): SnapshotSiataOk {
  const estaciones = construirEstaciones(poeca, trafico, Date.parse(consultado));
  const lectura = estaciones.reduce<string | null>((max, e) => (!max || e.actualizado > max ? e.actualizado : max), null);
  return {
    ok: true,
    guardado: respaldo !== null,
    consultado,
    capturado: respaldo?.capturado ?? null,
    aviso: respaldo?.aviso ?? null,
    lectura,
    fuente: FUENTE_SIATA,
    estaciones,
    resumen: {
      total: estaciones.length,
      medellin: resumirEstaciones(estaciones.filter((e) => e.enMedellin)),
      areaMetropolitana: resumirEstaciones(estaciones),
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Red
// ──────────────────────────────────────────────────────────────────────

/** URL del servicio; `SIATA_URL` solo existe para pruebas de degradación (apuntar a una URL rota). */
const urlSiata = () => process.env.SIATA_URL?.trim() || SIATA_URL_OFICIAL;

async function consultarCapa(idCapa: string): Promise<SiataResponse> {
  const res = await fetch(urlSiata(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_capa: idCapa }).toString(),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!res.ok) throw new Error(`SIATA ${idCapa} → HTTP ${res.status}`);
  const cuerpo = await res.text();
  const crudo: unknown = JSON.parse(cuerpo.trim());
  const parsed = SiataResponseSchema.parse(crudo);
  if (!parsed.feature_vector?.length) throw new Error(`SIATA ${idCapa} → feature_vector vacío`);
  return parsed;
}

function leerFixtures(): [SiataResponse, SiataResponse] {
  return [SiataResponseSchema.parse(fixture602), SiataResponseSchema.parse(fixture603)];
}

/**
 * Última lectura de aire del Valle de Aburrá. Cacheada 5 min (SIATA publica cada ~5 min); nunca lanza:
 * si SIATA falla responde con la copia guardada (`guardado: true`) y se reintenta en 1 min.
 */
export async function obtenerAire(): Promise<SnapshotSiata> {
  "use cache";
  cacheTag("siata");
  const consultado = new Date().toISOString();
  try {
    const [poeca, trafico] = await Promise.all([consultarCapa(CAPA_POECA), consultarCapa(CAPA_TRAFICO)]);
    cacheLife({ stale: 60, revalidate: 300, expire: 900 });
    return construirSnapshot(poeca, trafico, consultado, null);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    // la copia guardada se reintenta pronto; `expire` ≥ 5 min mantiene la ruta prerenderizable
    cacheLife({ stale: 30, revalidate: 60, expire: 600 });
    try {
      const [poeca, trafico] = leerFixtures();
      return construirSnapshot(poeca, trafico, consultado, {
        capturado: FECHA_CAPTURA_FIXTURE,
        aviso: `SIATA no respondió (${motivo}). Se muestra la copia guardada.`,
      });
    } catch (e2) {
      return { ok: false, consultado, error: `SIATA no respondió (${motivo}) y la copia guardada no se pudo leer (${String(e2)})` };
    }
  }
}
