/**
 * Cámaras públicas de Medellín: normalización de las dos fuentes. Aquí no hay red ni caché (eso vive en
 * camaras.ts), para poder probarlo con `npx tsx --test src/lib/camaras-fuentes.test.ts`.
 *
 * SIMM · Secretaría de Movilidad (circuito cerrado de televisión). Capa `CCTV_Movilidad` del servidor de mapas
 * de la Alcaldía. Particularidades vistas el 13 de noviembre de 2026:
 *  - `link_foto` viene en http y con `/simm/` en minúscula (tres redirecciones): se reescribe a https y `/SIMM/`.
 *  - 8 cámaras no traen enlace y 3 apuntan a `imagen.jpg`, que no existe. El servidor sí publica 10 de esas
 *    fotos: se identificaron por el rótulo impreso en cada imagen (`FOTOS_SIN_ENLACE`). Conquistadores queda fuera.
 *  - `localizacion` trae saltos de línea y nombres repetidos.
 *  - La foto es un JPG de 1280×720 que se renueva cada minuto; la hora exacta va impresa en la imagen
 *    (la cabecera Last-Modified del servidor está unos 9 minutos atrasada).
 *
 * SIATA · capas de cámaras del visor (mismo servicio que el aire). Cada punto trae una o varias fotos en
 * `siata.gov.co/ultimasFotosCamaras/`. Hay fotos repetidas entre capas y varias que ya no se actualizan:
 * camaras.ts consulta la fecha de cada una y descarta las viejas.
 */
import { z } from "zod";
import { URL_FUENTE } from "../pulso/camaras/constantes";
import type { CamaraPulso, FuenteCamara, TipoCamara } from "../pulso/tipos";

export interface FuenteCamaras {
  clave: FuenteCamara;
  nombre: string;
  detalle: string;
  url: string;
  licencia: "no declarada";
  /** cámaras de esta fuente en la respuesta */
  camaras: number;
}

export interface SnapshotCamaras {
  ok: true;
  /** momento de la consulta (ISO UTC) */
  consultado: string;
  /** true si alguna fuente no respondió y sus cámaras salen de la copia guardada */
  guardado: boolean;
  /** fecha de la copia guardada (solo si guardado) */
  capturado: string | null;
  aviso: string | null;
  camaras: CamaraPulso[];
  fuentes: FuenteCamaras[];
}

export const FUENTES_CAMARAS: Record<FuenteCamara, Omit<FuenteCamaras, "camaras">> = {
  simm: {
    clave: "simm",
    nombre: "SIMM · Secretaría de Movilidad de Medellín",
    detalle: "Circuito cerrado de televisión (capa CCTV_Movilidad del servidor de mapas de la Alcaldía)",
    url: URL_FUENTE.simm,
    licencia: "no declarada",
  },
  siata: {
    clave: "siata",
    nombre: "SIATA · Área Metropolitana del Valle de Aburrá",
    detalle: "Capas de cámaras del visor: deprimidos, nivel, color, capa límite y panorámicas",
    url: URL_FUENTE.siata,
    licencia: "no declarada",
  },
};

/** Caja del Valle de Aburrá: lo que caiga fuera es una coordenada mal digitada. */
const enElValle = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && lat > 5.9 && lat < 6.6 && lng > -76 && lng < -75;

/** Clave para comparar nombres: sin tildes, sin signos y en minúscula. */
export const claveNombre = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ───────────────────────── SIMM ───────────────────────── */

const CONSULTA_SIMM = "/query?where=1%3D1&outFields=direccion,localizacion,link_foto,latitud,longitud&returnGeometry=false&f=json";
const SERVIDOR_MAPAS = "https://www.medellin.gov.co/servidormapas/rest/services";

/**
 * La misma capa `CCTV_Movilidad` está publicada en dos servicios del servidor de mapas. Se consultan en este orden:
 * el 13 de noviembre de 2026 el de transporte respondió "Failed to execute query" durante un rato mientras el de
 * seguridad seguía entregando el listado completo.
 */
export const SIMM_LISTADOS = [
  `${SERVIDOR_MAPAS}/transporte/VC_Infraest_Gestion_Transito/MapServer/2${CONSULTA_SIMM}`,
  `${SERVIDOR_MAPAS}/seguridad_defensa/VM_Policia_MAP5/MapServer/7${CONSULTA_SIMM}`,
];

export const fotoSimm = (n: number) => `https://www.medellin.gov.co/SIMM/camaras-cctv/imagen${n}.jpg`;

/**
 * Cámaras del listado sin enlace válido → número de su foto en el servidor del SIMM.
 * Leído del rótulo impreso en cada imagen ("CCTV-Puente Guayaquil · Cr 50 x Cl 30") el 13 de noviembre de 2026.
 */
export const FOTOS_SIN_ENLACE: Record<string, number> = {
  "regional tierragro": 2,
  "puente san juan": 11,
  "puente guayaquil": 16,
  "av regional paralela tricentenario qda minitas": 18,
  "estaciom cisneros": 19,
  guayabal: 24,
  blanquizal: 29,
  "la central": 31,
  "puente madre laura": 44,
  "avenida paralela": 82,
};

const SimmSchema = z.object({
  features: z.array(
    z.object({
      attributes: z.object({
        direccion: z.string().nullish(),
        localizacion: z.string().nullish(),
        link_foto: z.string().nullish(),
        latitud: z.number().nullish(),
        longitud: z.number().nullish(),
      }),
    }),
  ),
});

/** Listado crudo de ArcGIS → cámaras con foto. Lanza si la respuesta no tiene la forma esperada. */
export function normalizarSimm(crudo: unknown): CamaraPulso[] {
  const { features } = SimmSchema.parse(crudo);
  const vistas = new Set<number>();
  const camaras: CamaraPulso[] = [];
  for (const { attributes: a } of features) {
    const original = (a.localizacion ?? "").split(/\r?\n/)[0]?.trim() ?? "";
    if (!original || a.latitud == null || a.longitud == null || !enElValle(a.latitud, a.longitud)) continue;
    const enlace = /imagen(\d+)\.jpg/i.exec(a.link_foto ?? "");
    const n = enlace ? Number(enlace[1]) : FOTOS_SIN_ENLACE[claveNombre(original)];
    if (!n || vistas.has(n)) continue;
    vistas.add(n);
    camaras.push({
      id: `simm-${n}`,
      fuente: "simm",
      tipo: "via",
      nombre: original.replace(/\bEstaciom\b/, "Estación"),
      direccion: a.direccion?.trim() || null,
      lat: a.latitud,
      lng: a.longitud,
      fotos: [fotoSimm(n)],
    });
  }
  return camaras;
}

/* ───────────────────────── SIATA ───────────────────────── */

const idCapa = (n: number) => `C_${String(n).padStart(23, "0")}`;

/** En este orden: una foto repetida entre capas se queda en la primera que la trae. */
export const SIATA_CAPAS_CAMARAS: { id: string; tipo: TipoCamara; rotulo: string }[] = [
  { id: idCapa(1071), tipo: "via", rotulo: "Cámaras deprimidos" },
  { id: idCapa(1072), tipo: "agua", rotulo: "Cámaras color" },
  { id: idCapa(1069), tipo: "agua", rotulo: "Cámaras nivel" },
  { id: idCapa(1073), tipo: "panoramica", rotulo: "Cámaras capa límite" },
  { id: idCapa(299), tipo: "panoramica", rotulo: "Cámaras" },
];

const SiataCapaSchema = z.object({
  feature_vector: z.array(z.object({ geometry_text: z.string(), atributos: z.unknown().optional() }).passthrough()),
});

const RE_FOTO_SIATA = /https?:\/\/siata\.gov\.co\/ultimasFotosCamaras\/(ultimacam_[A-Za-z0-9_.-]+?\.jpg)/g;

/** "Camara Deprimido Los Musicos CCTV" → "Deprimido Los Musicos"; "Camara - Nivel picacha" → "Picacha". */
export function nombreSiata(crudo: string): string {
  const n = crudo
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^c[aá]mara\s*-?\s*/i, "")
    .replace(/\s*CCTV$/i, "")
    .replace(/^(color|nivel)\s+/i, "")
    .trim();
  return n ? n[0]!.toUpperCase() + n.slice(1) : crudo.trim();
}

function nombreDeFeature(atributos: unknown): string {
  const nombre = (atributos as { metadato?: { name?: { valor_alfanumerico?: unknown } } } | null)?.metadato?.name?.valor_alfanumerico;
  return typeof nombre === "string" ? nombre : "";
}

/** Capas crudas del visor de SIATA (en el orden de SIATA_CAPAS_CAMARAS) → cámaras con sus fotos, sin repetir ninguna. */
export function normalizarSiata(capas: { tipo: TipoCamara; crudo: unknown }[]): CamaraPulso[] {
  const fotosVistas = new Set<string>();
  const ids = new Set<string>();
  const camaras: CamaraPulso[] = [];
  for (const { tipo, crudo } of capas) {
    const { feature_vector } = SiataCapaSchema.parse(crudo);
    for (const f of feature_vector) {
      let lng: unknown;
      let lat: unknown;
      try {
        [lng, lat] = (JSON.parse(f.geometry_text) as { coordinates?: unknown[] }).coordinates ?? [];
      } catch {
        continue;
      }
      if (typeof lat !== "number" || typeof lng !== "number" || !enElValle(lat, lng)) continue;
      const fotos: string[] = [];
      for (const m of JSON.stringify(f).matchAll(RE_FOTO_SIATA)) {
        const archivo = m[1]!;
        if (fotosVistas.has(archivo)) continue;
        fotosVistas.add(archivo);
        fotos.push(`https://siata.gov.co/ultimasFotosCamaras/${archivo}`);
      }
      const nombre = nombreSiata(nombreDeFeature(f.atributos));
      if (fotos.length === 0 || !nombre) continue;
      const id = `siata-${fotos[0]!.replace(/^.*ultimacam_/, "").replace(/\.jpg$/, "").toLowerCase()}`;
      if (ids.has(id)) continue;
      ids.add(id);
      camaras.push({ id, fuente: "siata", tipo, nombre, direccion: null, lat, lng, fotos });
    }
  }
  return camaras;
}
