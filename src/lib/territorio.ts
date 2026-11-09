/** División territorial de Medellín y del Valle de Aburrá (códigos oficiales de comuna y corregimiento). */

export interface Comuna {
  codigo: string; // "01".."16" comunas, "50".."90" corregimientos
  nombre: string;
  tipo: "comuna" | "corregimiento";
}

export const COMUNAS_MEDELLIN: Comuna[] = [
  { codigo: "01", nombre: "Popular", tipo: "comuna" },
  { codigo: "02", nombre: "Santa Cruz", tipo: "comuna" },
  { codigo: "03", nombre: "Manrique", tipo: "comuna" },
  { codigo: "04", nombre: "Aranjuez", tipo: "comuna" },
  { codigo: "05", nombre: "Castilla", tipo: "comuna" },
  { codigo: "06", nombre: "Doce de Octubre", tipo: "comuna" },
  { codigo: "07", nombre: "Robledo", tipo: "comuna" },
  { codigo: "08", nombre: "Villa Hermosa", tipo: "comuna" },
  { codigo: "09", nombre: "Buenos Aires", tipo: "comuna" },
  { codigo: "10", nombre: "La Candelaria", tipo: "comuna" },
  { codigo: "11", nombre: "Laureles-Estadio", tipo: "comuna" },
  { codigo: "12", nombre: "La América", tipo: "comuna" },
  { codigo: "13", nombre: "San Javier", tipo: "comuna" },
  { codigo: "14", nombre: "El Poblado", tipo: "comuna" },
  { codigo: "15", nombre: "Guayabal", tipo: "comuna" },
  { codigo: "16", nombre: "Belén", tipo: "comuna" },
  { codigo: "50", nombre: "Palmitas", tipo: "corregimiento" },
  { codigo: "60", nombre: "San Cristóbal", tipo: "corregimiento" },
  { codigo: "70", nombre: "Altavista", tipo: "corregimiento" },
  { codigo: "80", nombre: "San Antonio de Prado", tipo: "corregimiento" },
  { codigo: "90", nombre: "Santa Elena", tipo: "corregimiento" },
];

export const MUNICIPIOS_AMVA = [
  "Medellín",
  "Bello",
  "Itagüí",
  "Envigado",
  "Sabaneta",
  "La Estrella",
  "Caldas",
  "Copacabana",
  "Girardota",
  "Barbosa",
] as const;
export type MunicipioAMVA = (typeof MUNICIPIOS_AMVA)[number];

/** "5", "05", "5.0", "05 - Castilla" → "05". Devuelve null si no es un código conocido. */
export function normalizarCodigoComuna(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const m = /^\s*(\d{1,2})(?:\.0+)?\b/.exec(String(v));
  if (!m) return null;
  const codigo = m[1]!.padStart(2, "0");
  return COMUNAS_MEDELLIN.some((c) => c.codigo === codigo) ? codigo : null;
}

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function comunaPorNombre(nombre: string): Comuna | null {
  const n = sinTildes(nombre);
  return COMUNAS_MEDELLIN.find((c) => sinTildes(c.nombre) === n) ?? null;
}

export function comunaPorCodigo(codigo: string | null): Comuna | null {
  return COMUNAS_MEDELLIN.find((c) => c.codigo === codigo) ?? null;
}

/** Centro aproximado de Medellín para proyecciones locales (La Alpujarra). */
export const CENTRO_MEDELLIN = { lat: 6.2442, lng: -75.5736 };
