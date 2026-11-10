/**
 * Traduce el resultado de una herramienta del Analista en eventos del bus de PULSO (mover el mapa)
 * y en un resumen corto para leer en voz alta en modo directo.
 * Solo usa datos que vienen en la respuesta: nunca inventa coordenadas ni cifras.
 * Las salidas llegan como `unknown` (chat o modo directo), así que todo se valida por forma.
 */
import { CATEGORIAS, type ClaveCategoria } from "@/lib/ica";
import type { CapaPulso, EventoPulso, PuntoNombrado, RutaPulso } from "../tipos";

type Objeto = Record<string, unknown>;

const esObjeto = (x: unknown): x is Objeto => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x : null);

/** Datos de una respuesta ok:true; null si la herramienta falló o la forma no es la esperada. */
function datosOk(respuesta: unknown): { datos: Objeto; citas: Objeto[] } | null {
  if (!esObjeto(respuesta) || respuesta.ok !== true || !esObjeto(respuesta.datos)) return null;
  const citas = Array.isArray(respuesta.citas) ? respuesta.citas.filter(esObjeto) : [];
  return { datos: respuesta.datos, citas };
}

interface ComunaRanking {
  codigo: string;
  nombre: string;
  valor: number | null;
  porcentaje: number | null;
}

function leerComuna(x: unknown): ComunaRanking | null {
  if (!esObjeto(x)) return null;
  const codigo = str(x.codigo);
  if (!codigo) return null;
  return { codigo, nombre: str(x.nombre) ?? codigo, valor: num(x.valor), porcentaje: num(x.porcentaje) };
}

/** La comuna pedida, o la primera del ranking con valor publicado (el ranking ya viene ordenado de mayor a menor). */
function comunaDelRanking(ranking: Objeto): ComunaRanking | null {
  const pedida = leerComuna(ranking.comuna);
  if (pedida) return pedida;
  const lista = Array.isArray(ranking.comunas) ? ranking.comunas : [];
  for (const c of lista) {
    const leida = leerComuna(c);
    if (leida && leida.valor !== null) return leida;
  }
  return null;
}

interface Estacion {
  codigo: number;
  nombre: string;
  pm25: number | null;
  categoria: string | null;
}

function leerEstacion(x: unknown): Estacion | null {
  if (!esObjeto(x)) return null;
  const codigo = num(x.codigo);
  if (codigo === null) return null;
  return { codigo, nombre: str(x.sitio) ?? str(x.nombre) ?? `estación ${codigo}`, pm25: num(x.pm25), categoria: str(x.categoria) };
}

/** Estación con más PM2.5: `resumen.peor` o, si no viene, la primera de `estaciones` (ordenadas de mayor a menor). */
function peorEstacion(datos: Objeto): Estacion | null {
  const peor = esObjeto(datos.resumen) ? leerEstacion(datos.resumen.peor) : null;
  if (peor) return peor;
  const lista = Array.isArray(datos.estaciones) ? datos.estaciones : [];
  return leerEstacion(lista[0]);
}

const esPunto = (x: unknown): x is PuntoNombrado => esObjeto(x) && typeof x.nombre === "string" && num(x.lat) !== null && num(x.lng) !== null;
const esRuta = (x: unknown): x is RutaPulso => esObjeto(x) && typeof x.id === "string" && Array.isArray(x.puntos);

/** Capa de seguridad vial según la descripción del ranking ("Víctimas en incidentes viales…" o "Incidentes viales…"). */
function capaVial(ranking: Objeto): CapaPulso {
  const d = (str(ranking.descripcion) ?? "").toLowerCase();
  return d.startsWith("víctimas") || d.startsWith("victimas") ? "victimas" : "incidentes";
}

/** Eventos del bus que muestran en el mapa el resultado de una herramienta. Vacío si no hay nada que mostrar. */
export function accionesMapa(herramienta: string, respuesta: unknown): EventoPulso[] {
  const r = datosOk(respuesta);
  if (!r) return [];
  const { datos } = r;

  switch (herramienta) {
    case "consultarAire": {
      const peor = peorEstacion(datos);
      if (!peor) return [];
      return [
        { tipo: "capa", capa: "aire", visible: true },
        { tipo: "estacion", codigo: peor.codigo },
      ];
    }
    case "consultarSeguridadVial":
    case "consultarHurtoComuna": {
      // muertes-anio no trae ranking por comuna: no hay nada que ubicar en el mapa.
      if (!esObjeto(datos.ranking)) return [];
      const capa: CapaPulso = herramienta === "consultarHurtoComuna" ? "hurto" : capaVial(datos.ranking);
      const comuna = comunaDelRanking(datos.ranking);
      const eventos: EventoPulso[] = [{ tipo: "capa", capa, visible: true }];
      if (comuna) eventos.push({ tipo: "comuna", codigo: comuna.codigo });
      return eventos;
    }
    case "planearRuta": {
      if (!Array.isArray(datos.rutas)) return [];
      const rutas = datos.rutas.filter(esRuta);
      if (rutas.length === 0 || !esPunto(datos.origen) || !esPunto(datos.destino)) return [];
      const elegida = rutas.find((x) => x.recomendada)?.id;
      return [{ tipo: "rutas", rutas, origen: datos.origen, destino: datos.destino, ...(elegida ? { elegida } : {}) }];
    }
    case "controlarApp": {
      const capas: CapaPulso[] = ["aire", "incidentes", "victimas", "hurto", "comunas"];
      switch (str(datos.accion)) {
        case "capa": {
          const capa = capas.find((c) => c === datos.capa);
          return capa ? [{ tipo: "capa", capa, visible: datos.visible !== false }] : [];
        }
        case "tema":
          return datos.tema === "claro" || datos.tema === "oscuro" ? [{ tipo: "tema", tema: datos.tema }] : [];
        case "recorrido":
          return [{ tipo: "recorrido", activo: datos.activo !== false }];
        case "vista-inicial":
          return [{ tipo: "comuna", codigo: null }, { tipo: "vista-inicial" }];
        case "abrir-rutas":
          return [{ tipo: "panel", panel: "rutas" }];
        case "limpiar-rutas":
          return [{ tipo: "limpiar-rutas" }];
        case "ir-a": {
          const ruta = str(datos.ruta);
          return ruta && ruta.startsWith("/") ? [{ tipo: "navegar", ruta }] : [];
        }
        default:
          return [];
      }
    }
    default:
      return [];
  }
}

/** ¿La acción deja algo nuevo a la vista en el mapa? (para avisar "te lo muestro en el mapa") */
export const mueveElMapa = (eventos: EventoPulso[]) => eventos.some((e) => ["capa", "comuna", "estacion", "rutas", "vista-inicial", "recorrido"].includes(e.tipo));

/* ───────────── Resumen para voz (modo directo) ───────────── */

const fmt = (n: number, dec = 0) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(n);

function fuente(citas: Objeto[]): string {
  const c = str(citas[0]?.conjunto);
  return c ? ` Fuente: ${c}.` : "";
}

function nombreCategoria(clave: string | null): string | null {
  if (!clave || !(clave in CATEGORIAS)) return null;
  return CATEGORIAS[clave as ClaveCategoria].texto.toLowerCase();
}

/** Resumen corto y hablado de una respuesta en modo directo, solo con cifras de la respuesta. */
export function resumenParaVoz(herramienta: string, respuesta: unknown): string | null {
  const r = datosOk(respuesta);
  if (!r) return null;
  const { datos, citas } = r;

  if (herramienta === "controlarApp") return str(datos.texto);

  if (herramienta === "explicarFuentes" && Array.isArray(datos.parrafos)) {
    const p = datos.parrafos.filter((x): x is string => typeof x === "string");
    return p.slice(0, 2).join(" ") || null;
  }

  if (herramienta === "consultarFrescura") {
    const s = esObjeto(datos.secretaria) ? datos.secretaria : null;
    if (s && num(s.atrasados) !== null && num(s.total) !== null)
      return `En ${str(s.publicador) ?? "esa secretaría"}, ${fmt(num(s.atrasados)!)} de ${fmt(num(s.total)!)} conjuntos de datos están atrasados.${fuente(citas)}`;
    const res = esObjeto(datos.resumen) ? datos.resumen : null;
    const primera = Array.isArray(datos.secretarias) ? datos.secretarias.filter(esObjeto)[0] : undefined;
    if (res && num(res.atrasados) !== null && num(res.evaluables) !== null) {
      const cola = primera && str(primera.publicador) ? ` La secretaría con más conjuntos atrasados es ${str(primera.publicador)}.` : "";
      return `De ${fmt(num(res.evaluables)!)} conjuntos de MEData con periodicidad declarada, ${fmt(num(res.atrasados)!)} están atrasados.${cola}`;
    }
  }

  if (herramienta === "consultarAire") {
    const peor = peorEstacion(datos);
    const ambito = str(datos.ambito) ?? "Medellín";
    const promedio = esObjeto(datos.resumen) ? num(datos.resumen.promedioPm25) : null;
    const partes: string[] = [];
    if (promedio !== null) partes.push(`En ${ambito}, el promedio de PM 2.5 es ${fmt(promedio, 1)} microgramos por metro cúbico.`);
    if (peor && peor.pm25 !== null) {
      const cat = nombreCategoria(peor.categoria);
      partes.push(`La estación con la concentración más alta es ${peor.nombre}, con ${fmt(peor.pm25, 1)}${cat ? `, categoría ${cat}` : ""}.`);
    }
    return partes.length ? partes.join(" ") + fuente(citas) : null;
  }

  if ((herramienta === "consultarSeguridadVial" || herramienta === "consultarHurtoComuna") && esObjeto(datos.ranking)) {
    const ranking = datos.ranking;
    const c = comunaDelRanking(ranking);
    const desc = str(ranking.descripcion) ?? "Casos reportados";
    if (!c || c.valor === null) return `${desc}: sin casos publicados para ese filtro.${fuente(citas)}`;
    const pedida = !!leerComuna(ranking.comuna);
    const pct = c.porcentaje !== null ? `, el ${fmt(c.porcentaje, 1)} por ciento de la ciudad` : "";
    return pedida
      ? `${desc}: en ${c.nombre} hay ${fmt(c.valor)} casos reportados${pct}.${fuente(citas)}`
      : `${desc}: ${c.nombre} es la comuna con más casos reportados, ${fmt(c.valor)}${pct}.${fuente(citas)}`;
  }

  if (herramienta === "consultarSeguridadVial" && Array.isArray(datos.filas)) {
    const filas = datos.filas.filter(esObjeto);
    const u = filas[filas.length - 1];
    const anio = u ? num(u.anio) : null;
    if (!u || anio === null) return null;
    const medata = num(u.medata);
    const policia = num(u.policia);
    if (medata !== null && policia !== null)
      return `En ${anio}, MEData reporta ${fmt(medata)} muertes en incidentes viales en Medellín y la Policía Nacional ${fmt(policia)}.`;
    if (policia !== null) return `En ${anio}, la Policía Nacional reporta ${fmt(policia)} muertes en incidentes viales en Medellín. MEData no publica ese año.`;
    if (medata !== null) return `En ${anio}, MEData reporta ${fmt(medata)} muertes en incidentes viales en Medellín.`;
    return null;
  }

  if (herramienta === "planearRuta" && Array.isArray(datos.rutas)) {
    const rec = datos.rutas.filter(esRuta).find((x) => x.recomendada);
    if (!rec) return null;
    const min = num(rec.duracionS);
    const km = num(rec.distanciaM);
    return `Te recomiendo ${rec.etiqueta}${min !== null ? `: unos ${fmt(Math.round(min / 60))} minutos` : ""}${km !== null ? `, ${fmt(km / 1000, 1)} kilómetros` : ""}. La ves resaltada en el mapa.`;
  }

  const c = str(citas[0]?.conjunto);
  return c ? `Listo. La respuesta está en pantalla, con su fuente: ${c}.` : null;
}
