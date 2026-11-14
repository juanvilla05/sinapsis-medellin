/**
 * Busca una cámara por el nombre del lugar o por su dirección ("Puente Guayaquil", "la terminal del norte",
 * "carrera 50 con calle 25"). Archivo puro, sin red: lo usa PulsoBot y se prueba con
 * `npx tsx --test src/lib/camaras-buscar.test.ts`.
 */
import type { CamaraPulso } from "../pulso/tipos";

export interface BusquedaCamara {
  /** la cámara que mejor coincide; null si ninguna se parece lo suficiente */
  camara: CamaraPulso | null;
  /** hasta tres cámaras parecidas, para proponerlas cuando no hay coincidencia clara */
  parecidas: CamaraPulso[];
}

/** Palabras que no distinguen una cámara de otra. */
const VACIAS = new Set(["la", "el", "los", "las", "de", "del", "en", "con", "x", "y", "a", "al", "por", "sobre", "camara", "camaras", "medellin", "sentido", "frente"]);
/** La dirección viene abreviada en las fuentes ("Cr 50 Cl 25"): se lleva todo a la misma forma. */
const ABREVIATURAS: Record<string, string> = {
  carrera: "cr",
  cra: "cr",
  kr: "cr",
  calle: "cl",
  cll: "cl",
  avenida: "av",
  transversal: "tv",
  diagonal: "dg",
  circular: "cq",
  autopista: "autopista",
  aut: "autopista",
  kilometro: "km",
  quebrada: "qda",
  urbanizacion: "urb",
  interseccion: "intersec",
  centro: "cent",
};

const plano = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function palabras(t: string): string[] {
  return plano(t)
    .split(" ")
    .filter((p) => p && !VACIAS.has(p))
    .map((p) => ABREVIATURAS[p] ?? p);
}

/** Dos palabras coinciden si son iguales o si una larga empieza por la otra ("buleria" y "bulerias"). */
const coincide = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Puntaje de un texto de la cámara (nombre o dirección) frente a lo pedido: 0 si no se parece. */
function puntuar(pedido: string[], texto: string[]): number {
  if (texto.length === 0) return 0;
  const halladas = pedido.filter((p) => texto.some((t) => coincide(p, t)));
  if (halladas.length === 0) return 0;
  const sobrantes = texto.length - halladas.length;
  if (halladas.length === pedido.length) {
    // todo lo pedido está: gana el texto con menos palabras de más ("Aguacatala" antes que "Virgen Aguacatala")
    return sobrantes <= 0 ? 100 : 80 - Math.min(sobrantes, 10);
  }
  // coincidencia parcial: sirve si cubre la mayoría de lo pedido con alguna palabra que no sea un número suelto
  const cobertura = halladas.length / pedido.length;
  const conPeso = halladas.some((p) => p.length >= 4);
  return conPeso ? Math.round(cobertura * 50) : 0;
}

const MINIMO = 30;

export function buscarCamara(camaras: CamaraPulso[], texto: string): BusquedaCamara {
  const pedido = palabras(texto);
  if (pedido.length === 0) return { camara: null, parecidas: [] };
  const literal = plano(texto);
  const puntuadas = camaras
    .map((c) => {
      // "La Iguaná" e "Iguana" son dos cámaras: si lo pedido es el nombre tal cual, esa va primero
      const porNombre = puntuar(pedido, palabras(c.nombre)) + (plano(c.nombre) === literal ? 10 : 0);
      // la dirección pesa un poco menos: quien nombra un lugar casi siempre dice el nombre
      const porDireccion = c.direccion ? puntuar(pedido, palabras(c.direccion)) - 5 : 0;
      return { c, p: Math.max(porNombre, porDireccion) };
    })
    .filter((x) => x.p > 0)
    // en empate, primero las de vía (lo que casi siempre se busca) y luego el nombre más corto
    .sort((a, b) => b.p - a.p || Number(b.c.tipo === "via") - Number(a.c.tipo === "via") || a.c.nombre.length - b.c.nombre.length);
  const mejor = puntuadas[0];
  if (mejor && mejor.p >= MINIMO) return { camara: mejor.c, parecidas: puntuadas.slice(1, 4).map((x) => x.c) };
  return { camara: null, parecidas: puntuadas.slice(0, 3).map((x) => x.c) };
}
