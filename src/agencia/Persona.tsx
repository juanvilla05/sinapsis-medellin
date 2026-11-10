/** Personaje 2D de la oficina, dibujado por partes en SVG. El ancla (0, 0) son los pies. */

export interface Look {
  piel: string;
  pelo: string;
  peinado: "corto" | "largo" | "bob" | "mono" | "rizos" | "canas";
  traje: string;
  camisa: string;
  corbata?: string;
  pantalon?: string;
  falda?: boolean;
  bata?: boolean;
  gafas?: boolean;
  diadema?: boolean;
}

/** Apariencias (las mismas paletas del diseño original de cada agente). */
export const LOOKS: Record<string, Look> = {
  guia: { piel: "#A8714E", pelo: "#22160F", peinado: "largo", traje: "#1E3A5F", camisa: "#F7F5F0", falda: true },
  reloj: { piel: "#E3BB9A", pelo: "#BDB8B0", peinado: "canas", traje: "#3A3C42", camisa: "#F7F5F0", corbata: "#B45309", gafas: true },
  lab: { piel: "#6E4430", pelo: "#16100D", peinado: "rizos", traje: "#1E2A44", camisa: "#9FB6DA", bata: true, gafas: true },
  ventanilla: { piel: "#C48A62", pelo: "#1A1310", peinado: "corto", traje: "#6D28D9", camisa: "#F7F5F0", corbata: "#1E2A44" },
  analista: { piel: "#EFCDB0", pelo: "#6A3720", peinado: "bob", traje: "#1D4ED8", camisa: "#E0ECFF", diadema: true, falda: true },
  monitoreo: { piel: "#5A3826", pelo: "#120D0A", peinado: "mono", traje: "#065F46", camisa: "#D1FAE5", corbata: "#0B1220" },
};

const TINTA = "#1E293B";

function Pelo({ look, atras }: { look: Look; atras: boolean }) {
  const c = look.pelo;
  if (atras) {
    if (look.peinado === "largo") return <path d="M-8.4,-42 Q-9.5,-30 -7,-25 L7,-25 Q9.5,-30 8.4,-42 Z" fill={c} />;
    if (look.peinado === "bob") return <path d="M-8.6,-42 Q-9.6,-35 -7.4,-33 L7.4,-33 Q9.6,-35 8.6,-42 Z" fill={c} />;
    if (look.peinado === "mono") return <circle cx={0} cy={-50} r={3.8} fill={c} />;
    return null;
  }
  if (look.peinado === "rizos")
    return (
      <g fill={c}>
        {[-6, -3, 0, 3, 6].map((x, i) => (
          <circle key={i} cx={x} cy={-46 + Math.abs(x) * 0.35} r={3.4} />
        ))}
        <circle cx={-7.4} cy={-41.5} r={2.6} />
        <circle cx={7.4} cy={-41.5} r={2.6} />
      </g>
    );
  // casquete con un mechón al frente
  return (
    <path
      d={
        look.peinado === "corto" || look.peinado === "canas"
          ? "M-7.9,-40.5 Q-8.2,-48.6 0,-48.6 Q8.2,-48.6 7.9,-40.5 Q6,-44.4 0.5,-44.6 Q-5,-44.2 -7.9,-40.5 Z"
          : "M-8.3,-39 Q-8.8,-48.8 0,-48.8 Q8.8,-48.8 8.3,-39 Q7.2,-43.6 2.5,-44.6 Q-2,-42.2 -8.3,-39 Z"
      }
      fill={c}
    />
  );
}

export default function Persona({ look, saluda = false }: { look: Look; saluda?: boolean }) {
  const pantalon = look.pantalon ?? (look.falda ? look.piel : "#1F2937");
  return (
    <g>
      <ellipse cx={0} cy={0} rx={9.5} ry={3.6} fill="#0F172A" opacity={0.14} />
      {/* piernas y zapatos */}
      <rect x={-5.2} y={-15} width={4.2} height={14} rx={1.8} fill={pantalon} />
      <rect x={1} y={-15} width={4.2} height={14} rx={1.8} fill={pantalon} />
      <rect x={-6} y={-2.4} width={5} height={2.6} rx={1.2} fill={TINTA} />
      <rect x={1} y={-2.4} width={5} height={2.6} rx={1.2} fill={TINTA} />
      {look.falda && <path d="M-8.6,-18 L8.6,-18 L10,-9 L-10,-9 Z" fill={look.traje} />}
      <Pelo look={look} atras />
      {/* torso */}
      <rect x={-9} y={-32} width={18} height={17} rx={6} fill={look.bata ? "#F8FAFC" : look.traje} stroke={look.bata ? "#CBD5E1" : "none"} strokeWidth={0.8} />
      {look.bata && <rect x={-5.5} y={-31.5} width={11} height={14} rx={3} fill={look.traje} />}
      <path d="M-3.6,-32 L3.6,-32 L0,-25 Z" fill={look.camisa} />
      {look.corbata && <path d="M0,-29.6 L-1.6,-23 L0,-20.4 L1.6,-23 Z" fill={look.corbata} />}
      {/* brazos */}
      <rect x={-12.4} y={-30.5} width={4.2} height={13.5} rx={2.1} fill={look.bata ? "#F8FAFC" : look.traje} />
      <circle cx={-10.3} cy={-16.4} r={2.2} fill={look.piel} />
      {saluda ? (
        <g className="agente-saluda">
          <rect x={8.2} y={-44} width={4.2} height={13.5} rx={2.1} fill={look.bata ? "#F8FAFC" : look.traje} />
          <circle cx={10.3} cy={-45} r={2.3} fill={look.piel} />
        </g>
      ) : (
        <>
          <rect x={8.2} y={-30.5} width={4.2} height={13.5} rx={2.1} fill={look.bata ? "#F8FAFC" : look.traje} />
          <circle cx={10.3} cy={-16.4} r={2.2} fill={look.piel} />
        </>
      )}
      {/* cuello y cabeza */}
      <rect x={-2.2} y={-35} width={4.4} height={4} fill={look.piel} />
      <circle cx={0} cy={-40.5} r={7.8} fill={look.piel} />
      <circle cx={-2.8} cy={-40.4} r={0.95} fill={TINTA} />
      <circle cx={2.8} cy={-40.4} r={0.95} fill={TINTA} />
      <path d="M-2.2,-37 Q0,-35.4 2.2,-37" stroke={TINTA} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      <circle cx={-4.6} cy={-37.8} r={1.3} fill="#F87171" opacity={0.25} />
      <circle cx={4.6} cy={-37.8} r={1.3} fill="#F87171" opacity={0.25} />
      <Pelo look={look} atras={false} />
      {look.gafas && (
        <g stroke={TINTA} strokeWidth={0.8} fill="none">
          <circle cx={-2.9} cy={-40.4} r={2.3} />
          <circle cx={2.9} cy={-40.4} r={2.3} />
          <path d="M-0.6,-40.6 L0.6,-40.6" />
        </g>
      )}
      {look.diadema && (
        <g>
          <path d="M-8.6,-40 Q-8.6,-50.5 0,-50.5 Q8.6,-50.5 8.6,-40" stroke={TINTA} strokeWidth={1.4} fill="none" />
          <rect x={-10.2} y={-42.6} width={3} height={5.4} rx={1.4} fill={TINTA} />
          <path d="M-8.8,-38 Q-7,-34 -3.4,-34.6" stroke={TINTA} strokeWidth={0.9} fill="none" />
        </g>
      )}
    </g>
  );
}
