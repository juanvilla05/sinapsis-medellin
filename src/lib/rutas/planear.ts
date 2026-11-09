import "server-only";

import type { Cita, Respuesta } from "@/lib/analista/herramientas";
import { cargarRejillaIncidentes } from "@/lib/monitoreo/cargar";
import { obtenerAire } from "@/lib/siata";
import { esFechaSoloDia, fechaColombia } from "@/mundo/areas";
import { dentroDelValle, MODO_EN_FRASE, type ModoRuta } from "@/pulso/rutas/constantes";
import type { PuntoNombrado, RutaPulso } from "@/pulso/tipos";
import { buscarLugarPorTexto, calcularRutas, detallesLugar, type MotivoGoogle, type RutaCruda } from "./google";
import { haversine } from "./polilinea";
import { puntuarRutas, type EstacionPm25, type RejillaIndexada } from "./puntuar";

/**
 * planearRuta: de A a B por Medellín comparando las alternativas de Google Routes por aire (SIATA en vivo)
 * y siniestralidad histórica (MEData). La usan POST /api/rutas y la herramienta `planearRuta` del Analista.
 * Nunca lanza; los fallos vuelven con texto propio en español.
 */

/** Un extremo del viaje: texto libre, coordenadas (p. ej. "Usar mi ubicación") o una sugerencia de Places. */
export type EntradaLugar = string | { lat: number; lng: number; nombre?: string } | { placeId: string; nombre?: string; sesion?: string };

export interface EntradaPlanear {
  origen: EntradaLugar;
  destino: EntradaLugar;
  modo?: ModoRuta;
}

export interface DatosRuta {
  origen: PuntoNombrado;
  destino: PuntoNombrado;
  modo: ModoRuta;
  /** de la mejor a la peor según el puntaje; la primera es la recomendada */
  rutas: RutaPulso[];
  /** última fecha_ultima_actualizacion de SIATA (ISO) */
  lecturaSiata: string | null;
  /** true si SIATA no respondió y se usó la copia guardada */
  guardado: boolean;
  estacionesSiata: number;
  /** fecha de corte del conjunto de incidentes viales de MEData */
  corteIncidentes: string | null;
}

/* ───────────── utilidades ───────────── */

function horaBogota(d = new Date()) {
  const b = new Date(d.getTime() - 5 * 3600_000);
  return `${String(b.getUTCHours()).padStart(2, "0")}:${String(b.getUTCMinutes()).padStart(2, "0")}`;
}

function fechaLegible(iso: string) {
  return esFechaSoloDia(iso) ? fechaColombia(iso) : `${fechaColombia(iso)}, ${horaBogota(new Date(iso))}`;
}

const TEXTO_SIN_CLAVE = "Las rutas necesitan la clave de Google en esta instalación; el mapa y los datos siguen funcionando.";

type Fallo = Extract<Respuesta<never>, { ok: false }>;

function falloLugar(motivo: MotivoGoogle, rotulo: string): Fallo {
  switch (motivo) {
    case "sin-clave":
      return { ok: false, motivo: "sin-clave", detalle: TEXTO_SIN_CLAVE };
    case "sin-resultados":
      return { ok: false, motivo: "sin-datos", detalle: `No encontré “${rotulo}” en el Valle de Aburrá. Prueba con otro nombre o con una dirección.` };
    case "fuera-del-valle":
      return { ok: false, motivo: "sin-datos", detalle: `“${rotulo}” queda fuera del Valle de Aburrá; PULSO solo calcula rutas dentro del área metropolitana.` };
    default:
      return { ok: false, motivo: "error", detalle: `Google no respondió al buscar “${rotulo}” a las ${horaBogota()}. Intenta de nuevo en un momento.` };
  }
}

async function resolverLugar(e: EntradaLugar, papel: "origen" | "destino"): Promise<{ ok: true; punto: PuntoNombrado } | Fallo> {
  if (typeof e === "string") {
    const r = await buscarLugarPorTexto(e);
    return r.ok ? { ok: true, punto: r.datos } : falloLugar(r.motivo, e);
  }
  if ("placeId" in e) {
    const r = await detallesLugar(e.placeId, e.sesion);
    if (!r.ok) return falloLugar(r.motivo, e.nombre ?? `el ${papel}`);
    return { ok: true, punto: { ...r.datos, nombre: e.nombre?.trim() || r.datos.nombre } };
  }
  const nombre = e.nombre?.trim() || (papel === "origen" ? "Punto de partida" : "Punto de llegada");
  if (!dentroDelValle(e.lat, e.lng)) return falloLugar("fuera-del-valle", nombre);
  return { ok: true, punto: { nombre, lat: e.lat, lng: e.lng } };
}

/* ───────────── memoria corta de geometrías de Google (no de datos) ───────────── */

const memoriaRutas = new Map<string, { hasta: number; rutas: RutaCruda[] }>();
const VIGENCIA_MS = 2 * 60_000;

async function rutasDeGoogle(o: PuntoNombrado, d: PuntoNombrado, modo: ModoRuta) {
  const r5 = (n: number) => n.toFixed(5);
  const clave = `${r5(o.lat)},${r5(o.lng)}|${r5(d.lat)},${r5(d.lng)}|${modo}`;
  const ahora = Date.now();
  const hit = memoriaRutas.get(clave);
  if (hit && hit.hasta > ahora) return { ok: true as const, datos: hit.rutas };
  const r = await calcularRutas(o, d, modo);
  if (r.ok) {
    if (memoriaRutas.size >= 200) {
      for (const [k, v] of memoriaRutas) if (v.hasta <= ahora || memoriaRutas.size >= 200) memoriaRutas.delete(k);
    }
    memoriaRutas.set(clave, { hasta: ahora + VIGENCIA_MS, rutas: r.datos });
  }
  return r;
}

/* ───────────── rejilla de incidentes indexada (una vez por proceso) ───────────── */

let rejillaIndexada: { valor: RejillaIndexada | null; corte: string | null; url: string | null } | undefined;

function indexarRejilla() {
  if (rejillaIndexada) return rejillaIndexada;
  const r = cargarRejillaIncidentes();
  rejillaIndexada = r
    ? {
        valor: { grados: r.resolucion.grados, celdas: new Map(r.celdas.map((c) => [`${c.i},${c.j}`, c.n])) },
        corte: r.fuente.fechaCorte,
        url: r.fuente.url,
      }
    : { valor: null, corte: null, url: null };
  return rejillaIndexada;
}

/* ───────────── planearRuta ───────────── */

export async function planearRuta(entrada: EntradaPlanear): Promise<Respuesta<DatosRuta>> {
  const modo: ModoRuta = entrada.modo ?? "DRIVE";
  const [o, d] = await Promise.all([resolverLugar(entrada.origen, "origen"), resolverLugar(entrada.destino, "destino")]);
  if (!o.ok) return o;
  if (!d.ok) return d;
  if (haversine(o.punto, d.punto) < 50) {
    return { ok: false, motivo: "sin-datos", detalle: "El origen y el destino son el mismo lugar. Elige un destino distinto." };
  }

  const [google, aire] = await Promise.all([rutasDeGoogle(o.punto, d.punto, modo), obtenerAire()]);
  if (!google.ok) {
    if (google.motivo === "sin-clave") return { ok: false, motivo: "sin-clave", detalle: TEXTO_SIN_CLAVE };
    if (google.motivo === "sin-resultados")
      return { ok: false, motivo: "sin-datos", detalle: `Google no tiene rutas ${MODO_EN_FRASE[modo]} para este trayecto. Prueba con otro modo.` };
    return { ok: false, motivo: "error", detalle: `Google no respondió al calcular las rutas a las ${horaBogota()}. Intenta de nuevo en un momento.` };
  }

  // Estaciones SIATA válidas: lectura numérica (sin centinela). En vivo se descartan además las que llevan
  // más de 60 min sin actualizar, salvo que no quede ninguna; con la copia guardada se usan todas las que tengan lectura.
  let estaciones: EstacionPm25[] = [];
  if (aire.ok) {
    const conLectura = aire.estaciones.filter((e) => e.pm25 !== null);
    const recientes = aire.guardado ? conLectura : conLectura.filter((e) => !e.obsoleta);
    estaciones = (recientes.length > 0 ? recientes : conLectura).map((e) => ({ lat: e.lat, lng: e.lng, pm25: e.pm25 as number }));
  }

  const rejilla = indexarRejilla();
  const rutas = puntuarRutas(google.datos, modo, estaciones, rejilla.valor);
  const consultado = new Date().toISOString();

  const citas: Cita[] = [];
  if (aire.ok) {
    citas.push({
      conjunto: "SIATA · red de calidad del aire (PM2.5)",
      campo: `PM2.5 µg/m³ por estación (${estaciones.length} estaciones válidas), estimado por distancia inversa sobre la ruta`,
      url: aire.fuente.url,
      licencia: aire.fuente.licencia,
      fechaCorte: aire.lectura ?? aire.consultado,
    });
  }
  if (rejilla.valor) {
    citas.push({
      conjunto: "Incidentes viales",
      id: "1-023-25-000094",
      campo: "rejilla de 250 m, celdas con 5 o más incidentes, a menos de 150 m de la ruta",
      url: rejilla.url ?? "https://medata.app.medellin.gov.co/dataset/1-023-25-000094",
      licencia: "CC BY-SA 4.0",
      fechaCorte: rejilla.corte,
    });
  }
  citas.push({
    conjunto: "Google Routes (solo geometría y tiempos)",
    campo: "trazado, distancia y duración de cada alternativa",
    url: "https://developers.google.com/maps/documentation/routes",
    licencia: "Términos de Google Maps Platform",
    fechaCorte: consultado,
  });

  const nota = [
    aire.ok && aire.lectura
      ? `PM2.5 estimado con ${estaciones.length} estaciones de SIATA (${aire.guardado ? "copia guardada, lectura" : "última lectura"}: ${fechaLegible(aire.lectura)}, hora de Colombia).`
      : "SIATA no tiene lecturas válidas ahora: el puntaje no incluye el aire.",
    aire.ok && aire.guardado ? (aire.aviso ?? "SIATA no respondió; se usa la copia guardada.") : null,
    rejilla.valor
      ? `Los incidentes son históricos (MEData, hasta ${rejilla.corte ? fechaLegible(rejilla.corte) : "el corte del conjunto"}), no tráfico actual; solo cubren Medellín.`
      : "La rejilla de incidentes viales está en preparación: el puntaje no incluye la siniestralidad.",
    "Puntaje 0–100: 45 % aire, 35 % incidentes históricos y 20 % tiempo, comparado entre las alternativas.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    datos: {
      origen: o.punto,
      destino: d.punto,
      modo,
      rutas,
      lecturaSiata: aire.ok ? aire.lectura : null,
      guardado: aire.ok ? aire.guardado : false,
      estacionesSiata: estaciones.length,
      corteIncidentes: rejilla.corte,
    },
    citas,
    nota,
  };
}
