import type { Sugerida } from "@/lib/analista/sugeridas";

/**
 * Preguntas propias de PulsoBot, pensadas para el mapa. Con IA el modelo elige la herramienta;
 * sin IA se ejecuta en modo directo la indicada aquí (las mismas herramientas del Analista).
 */
export const SUGERIDAS_BOT: Sugerida[] = [
  { texto: "¿Cómo está el aire en Medellín ahora?", herramienta: "consultarAire", args: { ambito: "medellin" } },
  { texto: "Muéstrame Medellín por comunas", herramienta: "controlarApp", args: { accion: "vista", vista: "comunas" } },
  { texto: "¿Qué comunas tienen más incidentes viales?", herramienta: "consultarSeguridadVial", args: { tema: "incidentes" } },
  {
    texto: "¿Cuántas muertes viales hubo en 2023 según MEData y la Policía?",
    herramienta: "consultarSeguridadVial",
    args: { tema: "muertes-anio", anio: 2023 },
  },
];
