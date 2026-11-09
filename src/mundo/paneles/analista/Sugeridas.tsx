import { SUGERIDAS, type Sugerida } from "@/lib/analista/sugeridas";

/** Las 6 preguntas sugeridas. Son las mismas con y sin IA. */
export default function Sugeridas({ onElegir, deshabilitado = false }: { onElegir: (s: Sugerida) => void; deshabilitado?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-bold text-[#475569]">Preguntas sugeridas</span>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3" aria-label="Preguntas sugeridas">
        {SUGERIDAS.map((s) => (
          <li key={s.texto}>
            <button
              type="button"
              onClick={() => onElegir(s)}
              disabled={deshabilitado}
              className="w-full rounded-xl border border-[#E3EAF3] bg-white px-3 py-2.5 text-left text-[13px] font-semibold leading-snug text-[#1E3A5F] hover:border-[#2563EB] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {s.texto}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
