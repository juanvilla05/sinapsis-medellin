"use client";

/**
 * Voz de PulsoBot.
 *  - Escuchar: reconocimiento de voz del navegador (Web Speech API); el audio lo procesa el propio navegador.
 *  - Hablar: voz humana de ElevenLabs a través de /api/voz (solo se envía el texto de la respuesta). Si no hay clave,
 *    se agotó la cuota o falla la red, se usa la mejor voz en español que tenga el navegador.
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
  "not-allowed": "Para conversar por voz, permite el micrófono en tu navegador y vuelve a intentar.",
  "service-not-allowed": "Tu navegador no permite usar el micrófono en esta página. Escríbeme tu pregunta.",
  "no-speech": "No alcancé a escucharte. Toca el micrófono e intenta de nuevo.",
  "audio-capture": "No encontré un micrófono disponible. Escríbeme tu pregunta.",
  network: "El reconocimiento de voz de tu navegador no está disponible ahora. Escríbeme tu pregunta.",
};

/**
 * Dictado: `parcial` es el texto mientras hablas; al terminar llama `onFinal` con la frase completa.
 * Si la escucha termina sin frase (silencio, permiso negado…) llama `onSinVoz` con el código del navegador.
 */
export function useDictado(onFinal: (texto: string) => void, onSinVoz?: (codigo: string | null) => void) {
  const soportado = useSoporte(() => constructorReconocedor() !== null);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const onFinalRef = useRef(onFinal);
  const onSinVozRef = useRef(onSinVoz);
  useEffect(() => {
    onFinalRef.current = onFinal;
    onSinVozRef.current = onSinVoz;
  }, [onFinal, onSinVoz]);

  const detener = useCallback(() => rec.current?.stop(), []);
  /** corta la escucha sin enviar lo dicho ni avisar silencio */
  const cancelar = useCallback(() => rec.current?.abort(), []);

  const iniciar = useCallback(() => {
    const Ctor = constructorReconocedor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "es-CO";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let final = "";
    let codigoError: string | null = null;
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
      codigoError = e.error;
      // el silencio no es un error cuando hay conversación: quien escucha decide si reintenta
      if (e.error !== "aborted" && !(e.error === "no-speech" && onSinVozRef.current))
        setError(MENSAJES_ERROR[e.error] ?? "No se pudo usar el dictado. Escribe tu pregunta.");
    };
    r.onend = () => {
      rec.current = null;
      setEscuchando(false);
      setParcial("");
      if (final) onFinalRef.current(final);
      else if (codigoError !== "aborted") onSinVozRef.current?.(codigoError);
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

  return { soportado, escuchando, parcial, error, iniciar, detener, cancelar, limpiarError: () => setError(null) };
}

/** Texto apto para leer en voz alta: sin marcas de formato ni enlaces, con unidades dichas en palabras. */
function paraVoz(texto: string) {
  const limpio = texto
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]/g, "")
    .replace(/µg\/m³|µg\/m3|ug\/m3/gi, " microgramos por metro cúbico")
    .replace(/PM2[.,]5/gi, "PM 2.5")
    .replace(/\bICA\b/g, "índice de calidad del aire")
    .replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2") // 14.195 → 14195: se lee como número, no como "catorce punto…"
    .replace(/\s+/g, " ")
    .trim();
  if (limpio.length <= MAX_VOZ) return limpio;
  const corte = limpio.slice(0, MAX_VOZ);
  const punto = corte.lastIndexOf(". ");
  return punto > 200 ? corte.slice(0, punto + 1) : corte;
}
/** una respuesta hablada no debe pasar de ~35 segundos */
const MAX_VOZ = 560;

/** Mejor voz en español del navegador: primero latinoamericanas y las "naturales"; al final cualquier español. */
function vozDelNavegador(): SpeechSynthesisVoice | null {
  const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  if (voces.length === 0) return null;
  const puntaje = (v: SpeechSynthesisVoice) => {
    const l = v.lang.toLowerCase();
    const n = v.name.toLowerCase();
    let p = 0;
    if (l === "es-co") p += 6;
    else if (l === "es-mx" || l === "es-us" || l === "es-419") p += 5;
    else if (l !== "es-es") p += 3;
    if (/natural|neural|premium|enhanced|mejorad/.test(n)) p += 4;
    if (/google/.test(n)) p += 3;
    if (/paulina|m[oó]nica|soledad|jimena|angelica|ang[eé]lica|salom[eé]|dalia/.test(n)) p += 2;
    if (!v.localService) p += 1;
    return p;
  };
  return [...voces].sort((a, b) => puntaje(b) - puntaje(a))[0] ?? null;
}

/**
 * Lectura en voz alta. `leer(texto, forzar)` habla si la lectura está activada o si se fuerza (modo conversación).
 * `onFin` se llama cuando una respuesta termina de sonar por sí sola (no cuando se la calla).
 */
export function useLectura(onFin?: () => void) {
  const soportada = useSoporte(() => typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window));
  const [activa, setActivaEstado] = useState(false);
  const [hablando, setHablando] = useState(false);
  const activaRef = useRef(false);
  const hablandoRef = useRef(false);
  const turno = useRef(0); // cada lectura nueva invalida las anteriores
  const audio = useRef<HTMLAudioElement | null>(null);
  const urlAudio = useRef<string | null>(null);
  const vozServidor = useRef<boolean | null>(null); // null = aún no se sabe si /api/voz tiene clave
  const onFinRef = useRef(onFin);
  useEffect(() => {
    onFinRef.current = onFin;
  }, [onFin]);

  const marcar = useCallback((v: boolean) => {
    hablandoRef.current = v;
    setHablando(v);
  }, []);

  const soltarAudio = useCallback(() => {
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
    }
    if (urlAudio.current) {
      URL.revokeObjectURL(urlAudio.current);
      urlAudio.current = null;
    }
  }, []);

  const callar = useCallback(() => {
    turno.current += 1;
    soltarAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    marcar(false);
  }, [marcar, soltarAudio]);

  const setActiva = useCallback(
    (v: boolean) => {
      activaRef.current = v;
      setActivaEstado(v);
      if (!v) callar();
    },
    [callar],
  );

  const leer = useCallback(
    (texto: string, forzar = false) => {
      if (typeof window === "undefined" || (!activaRef.current && !forzar)) return;
      const frase = paraVoz(texto);
      if (!frase) {
        // nada que decir: en conversación se avisa igual para que vuelva a escuchar
        if (forzar) onFinRef.current?.();
        return;
      }
      callar();
      const mio = ++turno.current;
      const vigente = () => turno.current === mio;
      const terminar = () => {
        if (!vigente()) return;
        soltarAudio();
        marcar(false);
        onFinRef.current?.();
      };
      marcar(true);

      const conNavegador = () => {
        if (!vigente()) return;
        if (!("speechSynthesis" in window)) return terminar();
        const u = new SpeechSynthesisUtterance(frase);
        const voz = vozDelNavegador();
        u.lang = voz?.lang ?? "es-CO";
        if (voz) u.voice = voz;
        u.rate = 1.03;
        u.pitch = 1;
        u.onend = terminar;
        u.onerror = terminar;
        window.speechSynthesis.speak(u);
      };

      if (vozServidor.current === false) return conNavegador();
      fetch("/api/voz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: frase }) })
        .then(async (r) => {
          if (!vigente()) return;
          if (!r.ok || !(r.headers.get("content-type") ?? "").includes("audio")) {
            // sin clave o sin cuota: no se vuelve a intentar en esta visita
            const j = (await r.json().catch(() => null)) as { motivo?: string } | null;
            if (j?.motivo === "sin-clave" || j?.motivo === "cuota") vozServidor.current = false;
            return conNavegador();
          }
          const blob = await r.blob();
          if (!vigente()) return;
          vozServidor.current = true;
          const a = audio.current ?? (audio.current = new Audio());
          urlAudio.current = URL.createObjectURL(blob);
          a.src = urlAudio.current;
          a.onended = terminar;
          a.onerror = () => {
            soltarAudio();
            conNavegador();
          };
          await a.play().catch(() => {
            soltarAudio();
            conNavegador();
          });
        })
        .catch(() => conNavegador());
    },
    [callar, marcar, soltarAudio],
  );

  useEffect(
    () => () => {
      turno.current += 1;
      soltarAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [soltarAudio],
  );

  return { soportada, activa, setActiva, hablando, hablandoRef, leer, callar };
}
