"use client";

import { useEffect, useState } from "react";

/**
 * Minuto actual como número entero; avanza solo mientras la pestaña está a la vista.
 * Se añade a la URL de la foto para que el navegador pida la más reciente (las fuentes la renuevan cada minuto).
 */
export function useMinuto() {
  const [minuto, setMinuto] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!document.hidden) setMinuto(Math.floor(Date.now() / 60_000));
    }, 20_000);
    return () => window.clearInterval(t);
  }, []);
  return minuto;
}

/**
 * Última foto de una cámara pública. El navegador la pide directo a la fuente (Secretaría de Movilidad o SIATA):
 * no pasa por PULSO ni se guarda. Si la fuente no la entrega, lo dice en vez de dejar un hueco.
 */
export function FotoCamara({
  foto,
  alt,
  minuto,
  completa = false,
  className = "",
}: {
  foto: string;
  alt: string;
  minuto: number;
  /** muestra la imagen entera (panorámicas y ojo de pez) en lugar de recortarla a 16:9 */
  completa?: boolean;
  className?: string;
}) {
  const url = `${foto}?t=${minuto}`;
  const [fallida, setFallida] = useState<string | null>(null);
  return (
    <span className={`relative block aspect-video overflow-hidden bg-[#0B1220] ${className}`}>
      {fallida === url ? (
        <span role="img" aria-label={`${alt}: sin imagen en este momento`} className="grid h-full w-full place-items-center px-3 text-center text-[12px] leading-snug text-white/75">
          Sin imagen en este momento
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- foto externa que cambia cada minuto; se pide directo a la fuente, sin pasar por PULSO
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFallida(url)}
          className={`h-full w-full ${completa ? "object-contain" : "object-cover"}`}
        />
      )}
    </span>
  );
}
