"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { TemaPulso } from "./tipos";

/** Tema visual de PULSO (oscuro por defecto). Lo fija PulsoEnVivo; lo leen el mapa y sus leyendas. */
export const ContextoTema = createContext<TemaPulso>("oscuro");
export const useTema = () => useContext(ContextoTema);

/* ───────── tema elegido, recordado en este navegador ───────── */
const CLAVE = "pulso-tema";
const oyentes = new Set<() => void>();
/** respaldo en memoria cuando el almacenamiento no está disponible (modo privado) */
let enMemoria: TemaPulso = "oscuro";

function leer(): TemaPulso {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return v === "claro" || v === "oscuro" ? v : enMemoria;
  } catch {
    return enMemoria;
  }
}

export function guardarTema(tema: TemaPulso) {
  enMemoria = tema;
  try {
    window.localStorage.setItem(CLAVE, tema);
  } catch {
    // sin almacenamiento el cambio vale solo para esta visita
  }
  for (const o of [...oyentes]) o();
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

/** Tema guardado; en el servidor y en el primer render siempre "oscuro" para que la hidratación coincida. */
export const useTemaGuardado = () => useSyncExternalStore<TemaPulso>(suscribir, leer, () => "oscuro");
