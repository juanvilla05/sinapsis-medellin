"use client";

import type { EventoPulso } from "./tipos";

/**
 * Bus de eventos de PULSO: el mapa, el planificador de rutas y PulsoBot se hablan sin conocerse.
 *   emitir({ tipo: "volar", lat, lng })        → el mapa vuela ahí
 *   emitir({ tipo: "rutas", rutas, ... })      → el mapa dibuja y anima las rutas
 *   emitir({ tipo: "preguntar", texto })       → PulsoBot se abre y pregunta
 * El último evento de cada tipo se recuerda para quien se suscriba tarde (p. ej. el mapa que carga después).
 */
type Oyente = (e: EventoPulso) => void;

const oyentes = new Set<Oyente>();
const ultimos = new Map<EventoPulso["tipo"], EventoPulso>();

export function emitir(e: EventoPulso) {
  ultimos.set(e.tipo, e);
  if (e.tipo === "limpiar-rutas") ultimos.delete("rutas");
  for (const o of [...oyentes]) o(e);
}

/** Suscribe; devuelve la función para desuscribirse. Con `repetir`, recibe de inmediato el último evento de esos tipos. */
export function escuchar(o: Oyente, repetir: EventoPulso["tipo"][] = []) {
  oyentes.add(o);
  for (const t of repetir) {
    const e = ultimos.get(t);
    if (e) o(e);
  }
  return () => {
    oyentes.delete(o);
  };
}
