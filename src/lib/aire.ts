/**
 * Tipos y cálculos puros del aire (SIATA) compartidos entre servidor y cliente.
 * Sin `server-only`: la Sala de Monitoreo los usa para resumir las estaciones filtradas en el navegador
 * con exactamente la misma regla que el servidor. Ninguna cifra vive aquí: todo sale de `obtenerAire()`.
 */
import { calcularICA, type ClaveCategoria, ORDEN_CATEGORIAS } from "./ica";

export type CapaSiata = "poeca" | "trafico";

export interface EstacionSiata {
  /** `Codigo` de SIATA (clave de deduplicación entre capas) */
  codigo: number;
  /** `metadato.name` tal como lo publica SIATA */
  nombre: string;
  /** último segmento del nombre ("I.E. Pedro Octavio Amado"), si existe */
  sitio: string;
  /** municipio normalizado (ver `resolverMunicipio` en siata.ts) */
  municipio: string;
  enMedellin: boolean;
  /** comuna o corregimiento de Medellín cuando el nombre de la estación lo dice */
  comuna: string | null;
  lat: number;
  lng: number;
  /** concentración de PM2.5 en µg/m³ (`ICA_PM25_Valor`); null si centinela (-9999 / ND) */
  pm25: number | null;
  /** índice calculado con la Resolución 2254/2017; null si no hay lectura */
  ica: number | null;
  /** categoría oficial que publica SIATA (`ICA_PM25_Descripcion`) */
  categoria: ClaveCategoria;
  /** categoría derivada del índice calculado, para auditar discrepancias */
  categoriaCalculada: ClaveCategoria;
  /** ISO con zona -05:00 */
  actualizado: string;
  /** minutos entre `actualizado` y el momento de la consulta */
  minutosDesde: number;
  /** más de 60 minutos sin actualizar */
  obsoleta: boolean;
  capa: CapaSiata;
  tipoEstacion: string | null;
  enlace: string | null;
}

export type EstacionResumen = Pick<EstacionSiata, "codigo" | "nombre" | "sitio" | "municipio" | "pm25" | "ica" | "categoria">;

export interface ResumenAire {
  total: number;
  estacionesValidas: number;
  sinDato: number;
  /** promedio simple de PM2.5 de las estaciones válidas, 1 decimal */
  promedioPm25: number | null;
  /** ICA del promedio de PM2.5 */
  promedioIca: number | null;
  /** estación con la concentración más alta (sin calificar el lugar) */
  peor: EstacionResumen | null;
  /** estación con la concentración más baja */
  mejor: EstacionResumen | null;
  porCategoria: Record<ClaveCategoria, number>;
}

export interface FuenteSiata {
  nombre: "SIATA";
  entidad: string;
  url: string;
  capas: string[];
  licencia: "no declarada";
}

export interface SnapshotSiataOk {
  ok: true;
  /** true cuando SIATA no respondió y se sirve la copia guardada de src/lib/fixtures */
  guardado: boolean;
  /** momento de la consulta (ISO UTC) */
  consultado: string;
  /** fecha de captura de la copia guardada (solo si guardado) */
  capturado: string | null;
  /** motivo por el que se usó la copia guardada */
  aviso: string | null;
  /** última `fecha_ultima_actualizacion` entre todas las estaciones */
  lectura: string | null;
  fuente: FuenteSiata;
  estaciones: EstacionSiata[];
  resumen: {
    total: number;
    medellin: ResumenAire;
    areaMetropolitana: ResumenAire;
  };
}

export interface SnapshotSiataError {
  ok: false;
  consultado: string;
  error: string;
}

export type SnapshotSiata = SnapshotSiataOk | SnapshotSiataError;

const aResumen = (e: EstacionSiata): EstacionResumen => ({
  codigo: e.codigo,
  nombre: e.nombre,
  sitio: e.sitio,
  municipio: e.municipio,
  pm25: e.pm25,
  ica: e.ica,
  categoria: e.categoria,
});

/** Resume un conjunto de estaciones. Las estaciones sin lectura cuentan en `sinDato` y nunca entran al promedio. */
export function resumirEstaciones(estaciones: EstacionSiata[]): ResumenAire {
  const porCategoria = Object.fromEntries(ORDEN_CATEGORIAS.map((c) => [c, 0])) as Record<ClaveCategoria, number>;
  for (const e of estaciones) porCategoria[e.categoria] += 1;
  const validas = estaciones.filter((e): e is EstacionSiata & { pm25: number } => e.pm25 !== null);
  if (validas.length === 0) {
    return {
      total: estaciones.length,
      estacionesValidas: 0,
      sinDato: estaciones.length,
      promedioPm25: null,
      promedioIca: null,
      peor: null,
      mejor: null,
      porCategoria,
    };
  }
  const suma = validas.reduce((s, e) => s + e.pm25, 0);
  const promedioPm25 = Math.round((suma / validas.length) * 10) / 10;
  let peor = validas[0]!;
  let mejor = validas[0]!;
  for (const e of validas) {
    if (e.pm25 > peor.pm25) peor = e;
    if (e.pm25 < mejor.pm25) mejor = e;
  }
  return {
    total: estaciones.length,
    estacionesValidas: validas.length,
    sinDato: estaciones.length - validas.length,
    promedioPm25,
    promedioIca: calcularICA(promedioPm25),
    peor: aResumen(peor),
    mejor: aResumen(mejor),
    porCategoria,
  };
}
