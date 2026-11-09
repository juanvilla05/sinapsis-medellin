"use client";

import { useState } from "react";

/**
 * Muestra un archivo oficial de marca (logo o escudo) desde /public/marca.
 * Si el archivo todavía no existe, deja un espacio reservado con el nombre.
 */
export default function MarcaOficial({ src, alt, etiqueta }: { src: string; alt: string; etiqueta: string }) {
  const [falla, setFalla] = useState(false);
  if (falla) {
    return (
      <span
        title={`Falta el archivo ${src}`}
        className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-dashed border-white/30 px-2 font-mono text-[10px] leading-tight text-white/50"
      >
        {etiqueta}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- archivos locales de tamaño variable puestos por el equipo
  return <img src={src} alt={alt} className="h-11 w-auto object-contain" onError={() => setFalla(true)} />;
}
