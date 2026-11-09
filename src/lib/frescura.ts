import type { ConjuntoAuditado, EstadoFrescura } from "./catalogo";

export interface FilaFrescura {
  id: string;
  titulo: string;
  publicador: string;
  tema: string;
  periodicidad: string;
  modificado: string | null;
  diasSinActualizar: number | null;
  vecesAtraso: number | null;
  estado: EstadoFrescura;
  problemas: string[];
}

export function aFila(c: ConjuntoAuditado): FilaFrescura {
  return {
    id: c.id,
    titulo: c.titulo,
    publicador: c.publicador,
    tema: c.temas[0] ?? "Sin tema",
    periodicidad: c.periodicidad,
    modificado: c.modificado,
    diasSinActualizar: c.diasSinActualizar,
    vecesAtraso: c.vecesAtraso,
    estado: c.estado,
    problemas: c.problemasMetadato,
  };
}

export const ESTADOS: Record<EstadoFrescura, { texto: string; color: string }> = {
  "al-dia": { texto: "Al día", color: "var(--al-dia)" },
  atrasado: { texto: "Atrasado", color: "var(--atrasado)" },
  critico: { texto: "Crítico", color: "var(--critico)" },
  "sin-periodicidad": { texto: "Sin periodicidad", color: "#94a3b8" },
  "sin-fecha": { texto: "Sin fecha", color: "#64748b" },
};
