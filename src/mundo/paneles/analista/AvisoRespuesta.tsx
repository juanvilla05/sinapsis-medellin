import type { MotivoFallo } from "@/lib/analista/herramientas";

export type MotivoAviso = MotivoFallo | "limite" | "ia-caida";

const ESTILO: Record<MotivoAviso, { titulo: string; color: string; bg: string; borde: string; icono: string }> = {
  "sin-datos": { titulo: "Sin datos para esa consulta", color: "#475569", bg: "#F1F5F9", borde: "#E3EAF3", icono: "○" },
  "en-preparacion": { titulo: "Fuente en preparación", color: "#B45309", bg: "#FFFBEB", borde: "#FDE68A", icono: "◔" },
  error: { titulo: "La fuente no respondió", color: "#B91C1C", bg: "#FEF2F2", borde: "#FECACA", icono: "!" },
  "sin-clave": { titulo: "IA no configurada en esta instalación", color: "#1E3A5F", bg: "#EFF6FF", borde: "#BFDBFE", icono: "i" },
  limite: { titulo: "Límite de consultas alcanzado", color: "#B45309", bg: "#FFFBEB", borde: "#FDE68A", icono: "◔" },
  "ia-caida": { titulo: "La IA no respondió", color: "#B91C1C", bg: "#FEF2F2", borde: "#FECACA", icono: "!" },
};

/** Aviso para respuestas ok:false, límites de uso y caída de la IA. Textos propios, nunca mensajes internos. */
export default function AvisoRespuesta({
  motivo,
  detalle,
  onReintentar,
  onDirecto,
  compacto = false,
  titulo,
}: {
  motivo: MotivoAviso;
  detalle: string;
  onReintentar?: () => void;
  onDirecto?: () => void;
  compacto?: boolean;
  /** título propio en lugar del del motivo (p. ej. PulsoBot sin IA) */
  titulo?: string;
}) {
  const e = ESTILO[motivo];
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-2xl border ${compacto ? "px-3 py-2.5" : "p-4"}`}
      style={{ background: e.bg, borderColor: e.borde }}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full font-mono text-[13px] font-bold text-tinta"
        style={{ background: e.color }}
      >
        {e.icono}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13.5px] font-bold" style={{ color: e.color }}>
          {titulo ?? e.titulo}
        </span>
        <p className="m-0 text-[13px] leading-snug text-[#0F172A]">{detalle}</p>
        {(onReintentar || onDirecto) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {onReintentar && (
              <button
                type="button"
                onClick={onReintentar}
                className="rounded-[9px] border border-[#E3EAF3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#1E3A5F] hover:border-[#2563EB]"
              >
                Reintentar
              </button>
            )}
            {onDirecto && (
              <button
                type="button"
                onClick={onDirecto}
                className="rounded-[9px] bg-[#2563EB] px-3 py-1.5 text-[12.5px] font-bold text-tinta hover:bg-[#1D4FD7]"
              >
                Ver en modo directo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
