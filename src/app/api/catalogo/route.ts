import { auditarCatalogo } from "@/lib/catalogo";
import { aFila } from "@/lib/frescura";

/** Auditoría del catálogo de MEData en vivo (se ejecuta en cada consulta). */
export async function GET() {
  try {
    const { conjuntos, resumen } = await auditarCatalogo(new Date());
    return Response.json({ ok: true, resumen, conjuntos: conjuntos.map(aFila) });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
