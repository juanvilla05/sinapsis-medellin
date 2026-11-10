"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { IdArea } from "@/mundo/areas";
import type { DatosMundo } from "@/mundo/datos";
import { COLOR_GLOBO, type EstadoVisibleAgente, type IdAgente } from "@/mundo/agentes";
import { miles } from "@/mundo/areas";
import { SALAS } from "./OficinaIso";
import { LOOKS } from "./Persona";
import type { Oficina3D as API } from "./escena3d";

const NOMBRES: Record<IdArea | "guia", string> = {
  reloj: "Relojero",
  lab: "Científica de datos",
  ventanilla: "Ventanilla",
  analista: "PulsoBot",
  monitoreo: "Operadora",
  guia: "Recepción",
};

/** Maqueta 3D de la oficina: se gira con el mouse o el dedo; tocar un despacho abre su herramienta. */
export default function Oficina3D({
  agentes,
  datos,
  onAbrir,
  enfocado,
  onFallo,
}: {
  agentes: Record<IdAgente, EstadoVisibleAgente>;
  datos: DatosMundo;
  onAbrir(id: IdArea): void;
  enfocado: IdArea | null;
  onFallo(): void;
}) {
  const montaje = useRef<HTMLDivElement>(null);
  const api = useRef<API | null>(null);
  const [listo, setListo] = useState(false);
  const router = useRouter();
  // las funciones viven en refs para no reconstruir la maqueta en cada render
  const abrirRef = useRef(onAbrir);
  const falloRef = useRef(onFallo);
  useEffect(() => {
    abrirRef.current = onAbrir;
    falloRef.current = onFallo;
  }, [onAbrir, onFallo]);
  const datosRef = useRef(datos);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { crearOficina3D } = await import("./escena3d");
        if (cancelado || !montaje.current) return;
        const d = datosRef.current;
        api.current = crearOficina3D(montaje.current, {
          salas: SALAS,
          looks: LOOKS,
          estados: [
            { k: "al-dia", valor: d.porEstado["al-dia"], color: "#16A34A" },
            { k: "atrasado", valor: d.porEstado.atrasado, color: "#D97706" },
            { k: "critico", valor: d.porEstado.critico, color: "#DC2626" },
            { k: "sin-periodicidad", valor: d.porEstado["sin-periodicidad"], color: "#94A3B8" },
          ],
          totalConjuntos: miles(d.totalConjuntos),
          reducido: matchMedia("(prefers-reduced-motion: reduce)").matches,
          onAbrir: (id) => abrirRef.current(id),
          onSalida: () => router.push("/"),
        });
        setListo(true);
      } catch (e) {
        console.error(e);
        if (!cancelado) falloRef.current();
      }
    })();
    return () => {
      cancelado = true;
      api.current?.dispose();
      api.current = null;
    };
  }, [router]);

  // etiquetas con la cifra y el color del estado de cada agente
  useEffect(() => {
    if (!listo) return;
    api.current?.setEtiquetas(
      (Object.keys(NOMBRES) as (IdArea | "guia")[]).map((id) => {
        const info = agentes[id as IdAgente];
        return { id, nombre: NOMBRES[id], cifra: info?.cifra ?? "", color: info ? COLOR_GLOBO[info.estado] : "#475569", late: info?.estado === "te-necesita" };
      }),
    );
  }, [listo, agentes]);

  useEffect(() => {
    if (listo) api.current?.resaltar(enfocado);
  }, [listo, enfocado]);

  return (
    <div className="maqueta-3d relative">
      <div
        ref={montaje}
        className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]"
        role="application"
        aria-label="Maqueta 3D de la oficina de la Agencia de datos. Arrastra para girarla; toca un despacho para abrir su herramienta. Las fichas del equipo, más abajo, ofrecen lo mismo con teclado."
      />
      {!listo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="animate-pulse rounded-xl border border-[#E3EAF3] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1E3A5F]">Armando la maqueta…</span>
        </div>
      )}
      {listo && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#0B1220]/75 px-3 py-1 text-[11.5px] font-semibold text-white">
          <span className="sm:hidden">Arrastra para girar</span>
          <span className="hidden sm:inline">Arrastra para girar · rueda o pellizco para acercar</span>
        </span>
      )}
    </div>
  );
}
