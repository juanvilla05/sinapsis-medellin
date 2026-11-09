"use client";

/**
 * Voz de PulsoBot con la Web Speech API del navegador: sin claves y sin enviar audio a terceros por nuestra cuenta
 * (el dictado lo procesa el propio navegador). Si el navegador no lo soporta, el control no se muestra.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* Tipos mínimos: SpeechRecognition no viene en lib.dom de TypeScript. */
interface ResultadoVoz {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: { readonly transcript: string };
}
interface EventoResultadoVoz {
  readonly results: { readonly length: number; [i: number]: ResultadoVoz };
}
interface EventoErrorVoz {
  readonly error: string;
}
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: EventoResultadoVoz) => void) | null;
  onerror: ((e: EventoErrorVoz) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocedor = new () => Reconocedor;

function constructorReconocedor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const sinSuscripcion = () => () => {};
/** true solo en el cliente y si el navegador lo soporta (en el servidor y en la hidratación, false). */
const useSoporte = (prueba: () => boolean) => useSyncExternalStore(sinSuscripcion, prueba, () => false);

const MENSAJES_ERROR: Record<string, string> = {
  "not-allowed": "Para dictar, permite el uso del micrófono en tu navegador.",
  "service-not-allowed": "Tu navegador no permite el dictado en esta página. Escribe tu pregunta.",
  "no-speech": "No alcancé a escucharte. Toca el micrófono e intenta de nuevo.",
  "audio-capture": "No encontré un micrófono disponible. Escribe tu pregunta.",
  network: "El dictado de tu navegador no está disponible ahora. Escribe tu pregunta.",
};

/** Dictado: `parcial` es el texto mientras hablas; al terminar llama `onFinal` con la frase completa. */
export function useDictado(onFinal: (texto: string) => void) {
  const soportado = useSoporte(() => constructorReconocedor() !== null);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const detener = useCallback(() => rec.current?.stop(), []);

  const iniciar = useCallback(() => {
    const Ctor = constructorReconocedor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "es-CO";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let final = "";
    r.onresult = (e) => {
      let texto = "";
      let esFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) esFinal = true;
      }
      setParcial(texto);
      if (esFinal) final = texto.trim();
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setError(MENSAJES_ERROR[e.error] ?? "No se pudo usar el dictado. Escribe tu pregunta.");
    };
    r.onend = () => {
      rec.current = null;
      setEscuchando(false);
      setParcial("");
      if (final) onFinalRef.current(final);
    };
    rec.current = r;
    setError(null);
    setParcial("");
    try {
      r.start();
      setEscuchando(true);
    } catch {
      rec.current = null;
      setError("No se pudo iniciar el dictado. Escribe tu pregunta.");
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { soportado, escuchando, parcial, error, iniciar, detener, limpiarError: () => setError(null) };
}

/** Texto apto para leer en voz alta: sin marcas de formato ni enlaces, con unidades dichas en palabras. */
function paraVoz(texto: string) {
  const limpio = texto
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]/g, "")
    .replace(/µg\/m³|µg\/m3|ug\/m3/gi, " microgramos por metro cúbico")
    .replace(/PM2[.,]5/gi, "PM 2.5")
    .replace(/\s+/g, " ")
    .trim();
  if (limpio.length <= 900) return limpio;
  const corte = limpio.slice(0, 900);
  const punto = corte.lastIndexOf(". ");
  return punto > 300 ? corte.slice(0, punto + 1) : corte;
}

/** Lectura en voz alta (speechSynthesis) en español de Colombia o, si no hay, cualquier voz en español. */
export function useLectura() {
  const soportada = useSoporte(() => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
  const [activa, setActivaEstado] = useState(false);
  const [hablando, setHablando] = useState(false);
  const activaRef = useRef(false);

  const callar = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setHablando(false);
  }, []);

  const setActiva = useCallback(
    (v: boolean) => {
      activaRef.current = v;
      setActivaEstado(v);
      if (!v) callar();
    },
    [callar],
  );

  const leer = useCallback((texto: string) => {
    if (!activaRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const frase = paraVoz(texto);
    if (!frase) return;
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(frase);
    const voces = s.getVoices();
    const voz = voces.find((v) => v.lang.toLowerCase() === "es-co") ?? voces.find((v) => v.lang.toLowerCase().startsWith("es"));
    u.lang = voz?.lang ?? "es-CO";
    if (voz) u.voice = voz;
    u.onstart = () => setHablando(true);
    u.onend = () => setHablando(false);
    u.onerror = () => setHablando(false);
    s.speak(u);
  }, []);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return { soportada, activa, setActiva, hablando, leer, callar };
}
