import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado } from "@/lib/catalogo";
import { construirPropuestas, resumirVentanilla } from "@/lib/ventanilla";

/** Propuestas de la Ventanilla de Apertura, calculadas del último catálogo guardado por el pipeline. Se prerenderiza. */
export async function GET() {
  const conjuntos = catalogo as ConjuntoAuditado[];
  const propuestas = construirPropuestas(conjuntos);
  return Response.json({ ok: true, generado: resumen.generado, resumen: resumirVentanilla(conjuntos, propuestas), propuestas });
}
