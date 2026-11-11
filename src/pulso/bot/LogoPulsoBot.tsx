import { useId } from "react";

/**
 * Logo de PulsoBot: el mismo orbe azul con visor y ojos verdes que el Analista de la oficina de la Agencia
 * (botSvg en src/agencia/persona.ts), para que sea un solo personaje en toda la plataforma.
 * `estado` cambia el halo y el color de los ojos: escuchando (verde), pensando (ámbar) o hablando (azul).
 * Con movimiento reducido no hay halo ni parpadeo.
 */
export type EstadoBot = "reposo" | "escuchando" | "pensando" | "hablando";

const HALO: Record<EstadoBot, string> = {
  reposo: "bg-[#38BDF8]/35",
  escuchando: "bg-[#22C55E]/55",
  pensando: "bg-[#FBBF24]/50",
  hablando: "bg-[#60A5FA]/60",
};

const OJOS: Record<EstadoBot, string> = {
  reposo: "#34D399",
  escuchando: "#4ADE80",
  pensando: "#FCD34D",
  hablando: "#7DD3FC",
};

export default function LogoPulsoBot({ tam = "h-12 w-12", estado = "reposo", latido = true }: { tam?: string; estado?: EstadoBot; latido?: boolean }) {
  const activo = estado !== "reposo";
  const grad = `pulsobot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ojos = `pulsobot-parpadeo ${estado === "hablando" ? "motion-safe:animate-pulse" : ""}`;
  return (
    <span className={`relative flex flex-none items-center justify-center ${tam}`} aria-hidden="true">
      {(latido || activo) && (
        <span
          className={`absolute inset-0 animate-ping rounded-full motion-reduce:hidden ${HALO[estado]}`}
          style={{ animationDuration: activo ? "1.2s" : "2.6s" }}
        />
      )}
      <svg viewBox="-14 -14 28 28" className="relative h-full w-full drop-shadow-[0_6px_14px_rgba(37,99,235,.45)]">
        <defs>
          <radialGradient id={grad} cx=".35" cy=".3">
            <stop offset="0" stopColor="#93C5FD" />
            <stop offset=".6" stopColor="#2563EB" />
            <stop offset="1" stopColor="#1E3A8A" />
          </radialGradient>
        </defs>
        <circle r="13" fill={`url(#${grad})`} />
        <circle r="13" fill="none" stroke="#93C5FD" strokeOpacity=".6" />
        {/* visor */}
        <ellipse cx="0" cy="1" rx="8.4" ry="5.6" fill="#0B1220" />
        {/* ojos */}
        <rect x="-5" y="-.4" width="3" height="3.6" rx="1.5" fill={OJOS[estado]} className={ojos} />
        <rect x="2" y="-.4" width="3" height="3.6" rx="1.5" fill={OJOS[estado]} className={ojos} />
        {/* brillo */}
        <circle cx="-4.5" cy="-7" r="2.2" fill="#FFFFFF" opacity=".55" />
      </svg>
    </span>
  );
}
