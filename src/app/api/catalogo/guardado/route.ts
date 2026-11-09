import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado } from "@/lib/catalogo";
import { aFila } from "@/lib/frescura";

/** Última auditoría guardada por el pipeline (respaldo si MEData no responde). Se prerenderiza. */
export async function GET() {
  return Response.json({ ok: true, guardado: true, resumen, conjuntos: (catalogo as ConjuntoAuditado[]).map(aFila) });
}
