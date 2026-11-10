import { SUGERIDAS, type Sugerida } from "@/lib/analista/sugeridas";

/** Herramientas cuya sugerida se destaca junto a las propias de PulsoBot (comparación por texto: la herramienta llega desde otra rama). */
const DESTACADAS_FLOTANTE = ["planearRuta"];

function Lista({
  items,
  onElegir,
  deshabilitado,
  oscuro,
  etiqueta,
  columnas,
}: {
  items: Sugerida[];
  onElegir: (s: Sugerida) => void;
  deshabilitado: boolean;
  oscuro: boolean;
  etiqueta: string;
  columnas: boolean;
}) {
  return (
    <ul className={`m-0 grid list-none gap-2 p-0 ${columnas ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`} aria-label={etiqueta}>
      {items.map((s) => (
        <li key={s.texto}>
          <button
            type="button"
            onClick={() => onElegir(s)}
            disabled={deshabilitado}
            className={
              oscuro
                ? "w-full rounded-xl border border-tinta/15 bg-tinta/[0.06] px-3 py-2.5 text-left text-[13px] font-semibold leading-snug text-tinta hover:border-[#60A5FA] hover:bg-tinta/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA] disabled:cursor-not-allowed disabled:opacity-60"
                : "w-full rounded-xl border border-[#E3EAF3] bg-white px-3 py-2.5 text-left text-[13px] font-semibold leading-snug text-[#1E3A5F] hover:border-[#2563EB] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {s.texto}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Las 6 preguntas sugeridas. Son las mismas con y sin IA.
 * Con `extra` (PulsoBot) se muestran primero esas preguntas y las del Analista quedan plegadas en "Más preguntas".
 */
export default function Sugeridas({
  onElegir,
  deshabilitado = false,
  extra,
  oscuro = false,
  plegadas = false,
}: {
  onElegir: (s: Sugerida) => void;
  deshabilitado?: boolean;
  /** preguntas propias de quien monta el panel (p. ej. PulsoBot); se muestran primero */
  extra?: Sugerida[];
  /** variante para fondos oscuros */
  oscuro?: boolean;
  /** con `extra`: también pliega las preguntas propias (cuando ya hay conversación) */
  plegadas?: boolean;
}) {
  const titulo = oscuro ? "text-[12px] font-bold text-tinta/70" : "text-[12px] font-bold text-[#475569]";

  if (!extra || extra.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <span className={titulo}>Preguntas sugeridas</span>
        <Lista items={SUGERIDAS} onElegir={onElegir} deshabilitado={deshabilitado} oscuro={oscuro} etiqueta="Preguntas sugeridas" columnas />
      </div>
    );
  }

  const destacadas = SUGERIDAS.filter((s) => DESTACADAS_FLOTANTE.includes(s.herramienta as string));
  const propias = [...destacadas, ...extra.filter((e) => !destacadas.some((d) => d.texto === e.texto))];
  const resto = SUGERIDAS.filter((s) => !propias.some((p) => p.texto === s.texto));
  const resumen = `cursor-pointer select-none rounded-lg py-1 ${titulo} ${oscuro ? "hover:text-tinta focus-visible:outline-[#60A5FA]" : "hover:text-[#1E3A5F] focus-visible:outline-[#2563EB]"} focus-visible:outline-2 focus-visible:outline-offset-2`;

  return (
    <div className="flex flex-col gap-3">
      {plegadas ? (
        <details>
          <summary className={resumen}>Preguntas para el mapa</summary>
          <div className="mt-2">
            <Lista items={propias} onElegir={onElegir} deshabilitado={deshabilitado} oscuro={oscuro} etiqueta="Preguntas para el mapa" columnas={false} />
          </div>
        </details>
      ) : (
        <div className="flex flex-col gap-2">
          <span className={titulo}>Para empezar</span>
          <Lista items={propias} onElegir={onElegir} deshabilitado={deshabilitado} oscuro={oscuro} etiqueta="Preguntas para el mapa" columnas={false} />
        </div>
      )}
      {resto.length > 0 && (
        <details>
          <summary className={resumen}>Más preguntas sobre los datos abiertos</summary>
          <div className="mt-2">
            <Lista items={resto} onElegir={onElegir} deshabilitado={deshabilitado} oscuro={oscuro} etiqueta="Más preguntas sugeridas" columnas={false} />
          </div>
        </details>
      )}
    </div>
  );
}
