import catalogo from "@/data/catalogo.json";
import type { ConjuntoAuditado } from "@/lib/catalogo";
import { analizarEnVivo } from "@/lib/laboratorio";

export const maxDuration = 60;

/** Recibe { id } de un conjunto de MEData, lo descarga en vivo y lo limpia. */
export async function POST(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  const conjunto = (catalogo as ConjuntoAuditado[]).find((c) => c.id === id);
  if (!conjunto) return Response.json({ ok: false, error: "Conjunto no encontrado en el catálogo" }, { status: 404 });
  if (!conjunto.csvUrl)
    return Response.json({ ok: false, error: "Este conjunto no publica un archivo CSV descargable" }, { status: 422 });
  // Solo se permite descargar desde el dominio de MEData
  if (!conjunto.csvUrl.startsWith("https://medata.app.medellin.gov.co/"))
    return Response.json({ ok: false, error: "URL fuera de MEData" }, { status: 400 });

  try {
    const informe = await analizarEnVivo(conjunto.csvUrl);
    return Response.json({
      ok: true,
      conjunto: { id: conjunto.id, titulo: conjunto.titulo, publicador: conjunto.publicador, periodicidad: conjunto.periodicidad },
      informe,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
