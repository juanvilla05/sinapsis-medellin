"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface Sugerencia {
  placeId: string;
  principal: string;
  secundario: string;
}

/** Lo que el panel envía a /api/rutas por cada extremo del viaje. */
export type ValorLugar = string | { lat: number; lng: number; nombre: string } | { placeId: string; nombre: string; sesion?: string };

type EstadoBusqueda = "quieto" | "buscando" | "listo" | "vacio" | "error" | "sin-clave";

const nuevaSesion = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined);

/**
 * Campo de lugar con autocompletado (Google Places vía /api/rutas/lugares, restringido al Valle de Aburrá).
 * Patrón combobox de la WAI-ARIA: flechas para recorrer, Enter para elegir, Escape para cerrar.
 */
export default function CampoLugar({
  etiqueta,
  marcador,
  texto,
  onTexto,
  onElegir,
  icono,
}: {
  etiqueta: string;
  marcador: string;
  texto: string;
  onTexto: (t: string) => void;
  onElegir: (v: ValorLugar, texto: string) => void;
  icono: React.ReactNode;
}) {
  const id = useId();
  const idLista = `${id}-lista`;
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [activa, setActiva] = useState(-1);
  const [estado, setEstado] = useState<EstadoBusqueda>("quieto");
  const sesion = useRef<string | undefined>(undefined);
  const contenedor = useRef<HTMLDivElement>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const peticion = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(temporizador.current);
      peticion.current?.abort();
    },
    [],
  );

  /** Busca con 250 ms de espera desde la última tecla; solo cuando la persona escribe. */
  function buscar(valor: string) {
    window.clearTimeout(temporizador.current);
    peticion.current?.abort();
    const q = valor.trim();
    if (q.length < 2) {
      setSugerencias([]);
      setEstado("quieto");
      return;
    }
    const ctrl = new AbortController();
    peticion.current = ctrl;
    setEstado("buscando");
    temporizador.current = window.setTimeout(async () => {
      try {
        sesion.current ??= nuevaSesion();
        const params = new URLSearchParams({ q });
        if (sesion.current) params.set("sesion", sesion.current);
        const res = await fetch(`/api/rutas/lugares?${params}`, { signal: ctrl.signal });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; motivo?: string; sugerencias?: Sugerencia[] } | null;
        if (ctrl.signal.aborted) return;
        if (!j || !j.ok) {
          setSugerencias([]);
          setEstado(j?.motivo === "sin-clave" ? "sin-clave" : "error");
          return;
        }
        const lista = j.sugerencias ?? [];
        setSugerencias(lista);
        setActiva(-1);
        setEstado(lista.length ? "listo" : "vacio");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSugerencias([]);
        setEstado("error");
      }
    }, 250);
  }

  // Cierra al hacer clic fuera
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, []);

  function elegir(s: Sugerencia) {
    const nombre = s.principal;
    onElegir({ placeId: s.placeId, nombre, sesion: sesion.current }, nombre);
    sesion.current = undefined; // la sesión de Places termina con los detalles del lugar
    window.clearTimeout(temporizador.current);
    peticion.current?.abort();
    setAbierto(false);
    setSugerencias([]);
    setEstado("quieto");
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      if (sugerencias.length) setActiva((a) => (a + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (sugerencias.length) setActiva((a) => (a <= 0 ? sugerencias.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (abierto && activa >= 0 && sugerencias[activa]) {
        e.preventDefault();
        elegir(sugerencias[activa]);
      }
    } else if (e.key === "Escape") {
      if (abierto) {
        e.preventDefault();
        e.stopPropagation();
        setAbierto(false);
      }
    }
  }

  const mostrarLista = abierto && texto.trim().length >= 2 && estado !== "quieto";
  const mensaje =
    estado === "buscando" && sugerencias.length === 0
      ? "Buscando lugares…"
      : estado === "vacio"
        ? "No encontré lugares con ese nombre en el Valle de Aburrá."
        : estado === "sin-clave"
          ? "La búsqueda de lugares necesita la clave de Google. Puedes escribir el nombre y calcular igual."
          : estado === "error"
            ? "No pude buscar lugares ahora. Escribe el nombre completo y calcula la ruta."
            : null;

  return (
    <div ref={contenedor} className="relative">
      <label htmlFor={`${id}-campo`} className="sr-only">
        {etiqueta}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-tinta/15 bg-tinta/[0.06] px-3 focus-within:border-[#60A5FA] focus-within:ring-2 focus-within:ring-[#60A5FA]/40">
        <span aria-hidden="true" className="shrink-0">
          {icono}
        </span>
        <input
          id={`${id}-campo`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls={idLista}
          aria-activedescendant={mostrarLista && activa >= 0 ? `${id}-op-${activa}` : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={marcador}
          value={texto}
          onChange={(e) => {
            onTexto(e.target.value);
            buscar(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => sugerencias.length > 0 && setAbierto(true)}
          onKeyDown={teclado}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-tinta placeholder:text-tinta/45 focus:outline-none"
        />
      </div>
      {mostrarLista && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={`Sugerencias para ${etiqueta.toLowerCase()}`}
          className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-tinta/15 bg-[#111A2E] p-1 shadow-2xl shadow-black/50"
        >
          {sugerencias.map((s, i) => (
            <li
              key={s.placeId}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === activa}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => elegir(s)}
              onPointerEnter={() => setActiva(i)}
              className={`cursor-pointer rounded-lg px-3 py-2 ${i === activa ? "bg-[#2563EB]/35" : ""}`}
            >
              <span className="block truncate text-[13.5px] font-semibold text-tinta">{s.principal}</span>
              {s.secundario && <span className="block truncate text-[11.5px] text-tinta/60">{s.secundario}</span>}
            </li>
          ))}
          {mensaje && (
            <li role="presentation" className="px-3 py-2 text-[12.5px] text-tinta/65" aria-live="polite">
              {mensaje}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
