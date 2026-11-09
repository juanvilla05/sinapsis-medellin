import "server-only";

/**
 * Capacidades opcionales según las variables de entorno.
 * Leer SOLO en route handlers (dinámicos): una página prerenderizada hornearía el valor en el build.
 */
export function capacidades() {
  const clave = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ?? "";
  return {
    ia: clave.length > 0,
    modelo: process.env.ANALISTA_MODELO?.trim() || "gemini-2.5-flash",
  };
}
