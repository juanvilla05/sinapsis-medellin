"use client";

export interface OpcionChip<T extends string> {
  clave: T;
  texto: string;
  /** conteo que acompaña al texto */
  n?: number;
  /** color de la categoría; activa el modo coloreado del chip */
  color?: string;
  /** fondo del chip inactivo cuando lleva color */
  fondo?: string;
  /** tono oscuro: texto del chip inactivo y fondo del activo (contraste AA con blanco) */
  tinta?: string;
  deshabilitado?: boolean;
}

/** Grupo de chips excluyentes (aria-pressed). Fondo blanco asumido. */
export default function Chips<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  opciones: OpcionChip<T>[];
  valor: T;
  onChange: (clave: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={etiqueta}>
      {opciones.map((o) => {
        const activo = o.clave === valor;
        const estilo = activo
          ? // la tinta (tono oscuro) garantiza ≥ 4,5:1 con texto blanco; `color` solo no llega en Buena/Aceptable
            { background: o.tinta ?? o.color ?? "#1E3A5F", color: "#fff" }
          : o.color
            ? { background: o.fondo ?? "#F1F5F9", color: o.tinta ?? "#475569" }
            : { background: "#F1F5F9", color: "#475569" };
        return (
          <button
            key={o.clave}
            type="button"
            onClick={() => onChange(o.clave)}
            aria-pressed={activo}
            disabled={o.deshabilitado}
            className="rounded-full px-2.5 py-1 text-xs font-semibold transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={estilo}
          >
            {o.texto}
            {o.n !== undefined ? <span className="ml-1 font-mono opacity-80">{o.n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
