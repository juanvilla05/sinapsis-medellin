import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CamaraPulso, FuenteCamara } from "@/pulso/tipos";
import {
  FUENTES_CAMARAS,
  SIATA_CAPAS_CAMARAS,
  SIMM_LISTADOS,
  normalizarSiata,
  normalizarSimm,
  type SnapshotCamaras,
} from "./camaras-fuentes";
import copiaGuardada from "./fixtures/camaras.json";

/**
 * Cámaras públicas en vivo de Medellín y el Valle de Aburrá: circuito cerrado de la Secretaría de Movilidad (SIMM)
 * y cámaras de SIATA. Solo se guarda el listado (nombre, lugar y enlace a la última foto): las imágenes las pide
 * el navegador de cada persona directamente a la fuente y PULSO no almacena ninguna.
 *
 * `obtenerCamaras()` nunca lanza: si una fuente no responde, sus cámaras salen de la copia guardada del listado
 * (`src/lib/fixtures/camaras.json`) y la respuesta lo dice en `guardado` y `aviso`.
 */

const SIATA_URL = "https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga";
const TIEMPO_LISTADO_MS = 8_000;
const TIEMPO_FOTO_MS = 6_000;
/** Una foto de SIATA con más de esto sin renovarse ya no es "en vivo" y se descarta. */
const MAX_EDAD_FOTO_MS = 45 * 60_000;

async function consultarListadoSimm(url: string): Promise<CamaraPulso[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_LISTADO_MS) });
  if (!res.ok) throw new Error(`SIMM → HTTP ${res.status}`);
  // cuando la consulta falla, ArcGIS responde 200 con {"error": …}: normalizarSimm lo rechaza por su forma
  const camaras = normalizarSimm(await res.json());
  if (camaras.length === 0) throw new Error("SIMM → listado sin cámaras");
  return camaras;
}

/** Prueba los servicios que publican la capa, en orden, y se queda con el primero que entregue el listado. */
async function consultarSimm(): Promise<CamaraPulso[]> {
  let ultimo: unknown = new Error("SIMM → sin servicios configurados");
  for (const url of SIMM_LISTADOS) {
    try {
      return await consultarListadoSimm(url);
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo;
}

async function consultarCapaSiata(id: string): Promise<unknown> {
  const res = await fetch(SIATA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_capa: id }).toString(),
    signal: AbortSignal.timeout(TIEMPO_LISTADO_MS),
  });
  if (!res.ok) throw new Error(`SIATA ${id} → HTTP ${res.status}`);
  // igual que en el aire: el Content-Type dice text/html y el cuerpo empieza con saltos de línea
  return JSON.parse((await res.text()).trim());
}

/** true si la foto existe, es una imagen y se renovó hace poco (SIATA sí publica bien Last-Modified). */
async function fotoVigente(url: string, ahora: number): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(TIEMPO_FOTO_MS) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return false;
    const modificada = Date.parse(res.headers.get("last-modified") ?? "");
    return Number.isNaN(modificada) || ahora - modificada <= MAX_EDAD_FOTO_MS;
  } catch {
    return false;
  }
}

async function consultarSiata(): Promise<CamaraPulso[]> {
  const respuestas = await Promise.allSettled(SIATA_CAPAS_CAMARAS.map((c) => consultarCapaSiata(c.id)));
  const capas = SIATA_CAPAS_CAMARAS.flatMap((c, k) => {
    const r = respuestas[k]!;
    return r.status === "fulfilled" ? [{ tipo: c.tipo, crudo: r.value }] : [];
  });
  if (capas.length === 0) throw new Error("SIATA → ninguna capa de cámaras respondió");
  const camaras = normalizarSiata(capas);
  const ahora = Date.now();
  const vigentes = await Promise.all(
    camaras.map(async (c) => {
      const ok = await Promise.all(c.fotos.map((f) => fotoVigente(f, ahora)));
      return { ...c, fotos: c.fotos.filter((_, k) => ok[k]) };
    }),
  );
  const conFoto = vigentes.filter((c) => c.fotos.length > 0);
  if (conFoto.length === 0) throw new Error("SIATA → ninguna cámara con foto reciente");
  return conFoto;
}

const guardadas = copiaGuardada.camaras as CamaraPulso[];

/** Listado de cámaras con foto. Cacheado 30 min; si alguna fuente falla se reintenta a los 5 min. */
export async function obtenerCamaras(): Promise<SnapshotCamaras> {
  "use cache";
  cacheTag("camaras");
  const consultado = new Date().toISOString();
  const [simm, siata] = await Promise.allSettled([consultarSimm(), consultarSiata()]);

  const caidas: string[] = [];
  const de = (r: PromiseSettledResult<CamaraPulso[]>, fuente: FuenteCamara, rotulo: string) => {
    if (r.status === "fulfilled") return r.value;
    // el detalle técnico se queda en el log del servidor
    console.error(`[camaras] ${rotulo}`, r.reason);
    caidas.push(rotulo);
    return guardadas.filter((c) => c.fuente === fuente);
  };
  const camaras = [...de(simm, "simm", "la Secretaría de Movilidad"), ...de(siata, "siata", "SIATA")];

  cacheLife(caidas.length > 0 ? { stale: 60, revalidate: 300, expire: 3600 } : { stale: 300, revalidate: 1800, expire: 86400 });
  return {
    ok: true,
    consultado,
    guardado: caidas.length > 0,
    capturado: caidas.length > 0 ? copiaGuardada.capturado : null,
    aviso: caidas.length > 0 ? `No respondió ${caidas.join(" ni ")}: sus cámaras salen del listado guardado.` : null,
    camaras,
    fuentes: (["simm", "siata"] as const).map((f) => ({ ...FUENTES_CAMARAS[f], camaras: camaras.filter((c) => c.fuente === f).length })),
  };
}
