/**
 * Logo de PulsoBot: una cabeza de robot con antena, y por boca la línea de un pulso.
 * `estado` anima el halo: escuchando (verde), hablando (azul) o pensando (ámbar). Con movimiento reducido no hay animación.
 */
export type EstadoBot = "reposo" | "escuchando" | "pensando" | "hablando";

const HALO: Record<EstadoBot, string> = {
  reposo: "bg-[#38BDF8]/35",
  escuchando: "bg-[#22C55E]/55",
  pensando: "bg-[#FBBF24]/50",
  hablando: "bg-[#60A5FA]/60",
};

export default function LogoPulsoBot({ tam = "h-12 w-12", estado = "reposo", latido = true }: { tam?: string; estado?: EstadoBot; latido?: boolean }) {
  const activo = estado !== "reposo";
  return (
    <span className={`relative flex flex-none items-center justify-center ${tam}`} aria-hidden="true">
      {(latido || activo) && (
        <span
          className={`absolute inset-0 animate-ping rounded-[32%] motion-reduce:hidden ${HALO[estado]}`}
          style={{ animationDuration: activo ? "1.2s" : "2.6s" }}
        />
      )}
      <span className="absolute inset-0 rounded-[32%] bg-[linear-gradient(145deg,#38BDF8,#2563EB_55%,#1E3A8A)] shadow-[0_6px_20px_rgba(37,99,235,.45)]" />
      <svg viewBox="0 0 48 48" className="relative h-[76%] w-[76%]" fill="none">
        {/* antena */}
        <path d="M24 9.5V5.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="24" cy="4.4" r="2.6" fill={estado === "escuchando" ? "#4ADE80" : estado === "pensando" ? "#FCD34D" : "#fff"} />
        {/* orejas */}
        <rect x="3.5" y="20" width="4.5" height="11" rx="2.25" fill="#fff" fillOpacity=".85" />
        <rect x="40" y="20" width="4.5" height="11" rx="2.25" fill="#fff" fillOpacity=".85" />
        {/* cabeza */}
        <rect x="8.5" y="10" width="31" height="30" rx="9.5" fill="#fff" />
        {/* ojos */}
        <circle cx="18.2" cy="21.5" r="3.3" fill="#1E3A8A" />
        <circle cx="29.8" cy="21.5" r="3.3" fill="#1E3A8A" />
        <circle cx="19.2" cy="20.4" r="1.05" fill="#fff" />
        <circle cx="30.8" cy="20.4" r="1.05" fill="#fff" />
        {/* boca: el pulso */}
        <path
          d="M14.5 32h4.2l2-4.2 3.3 7.4 2.6-5.2 1.3 2h5.6"
          stroke="#2563EB"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={estado === "hablando" ? "motion-safe:animate-pulse" : ""}
        />
      </svg>
    </span>
  );
}
