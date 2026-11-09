/**
 * Preguntas sugeridas del Analista. Son IDÉNTICAS con y sin clave de IA:
 * con IA el modelo decide la herramienta; sin IA se ejecuta la indicada aquí en modo directo.
 * Este archivo no importa nada de servidor: lo usan el panel (cliente) y las rutas.
 */
export type NombreHerramienta =
  | "consultarFrescura"
  | "buscarConjunto"
  | "consultarAire"
  | "consultarSeguridadVial"
  | "consultarHurtoComuna"
  | "limpiarConjunto"
  | "explicarFuentes";

export interface Sugerida {
  texto: string;
  herramienta: NombreHerramienta;
  args: Record<string, unknown>;
}

export const SUGERIDAS: Sugerida[] = [
  { texto: "¿Qué secretaría tiene más conjuntos atrasados?", herramienta: "consultarFrescura", args: { limite: 5 } },
  { texto: "¿Cuántos conjuntos de Movilidad están al día?", herramienta: "consultarFrescura", args: { secretaria: "Movilidad" } },
  { texto: "¿Qué estación de Medellín tiene peor aire ahora?", herramienta: "consultarAire", args: { ambito: "medellin" } },
  {
    texto: "¿En qué comunas hay más víctimas motociclistas en incidentes viales?",
    herramienta: "consultarSeguridadVial",
    args: { tema: "victimas", condicion: "motociclista" },
  },
  {
    texto: "¿Cuántas muertes viales hubo en 2023 según MEData y según la Policía?",
    herramienta: "consultarSeguridadVial",
    args: { tema: "muertes-anio", anio: 2023 },
  },
  { texto: "¿De dónde salen los datos de SINAPSIS?", herramienta: "explicarFuentes", args: { tema: "fuentes" } },
];

/** Nombre legible del despacho/fuente que consulta cada herramienta (para la UI). */
export const NOMBRES_HERRAMIENTAS: Record<NombreHerramienta, string> = {
  consultarFrescura: "Reloj de Frescura (catálogo MEData)",
  buscarConjunto: "Catálogo MEData",
  consultarAire: "SIATA · calidad del aire",
  consultarSeguridadVial: "Seguridad vial (MEData y Policía)",
  consultarHurtoComuna: "Hurto a persona por comuna (MEData)",
  limpiarConjunto: "Laboratorio de Limpieza",
  explicarFuentes: "Fuentes y método",
};

export const NOMBRES_HERRAMIENTAS_LISTA = Object.keys(NOMBRES_HERRAMIENTAS) as NombreHerramienta[];
