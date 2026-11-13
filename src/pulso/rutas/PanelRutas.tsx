"use client";

import { useEffect, useRef, useState } from "react";
import type { Cita, Respuesta } from "@/lib/analista/herramientas";
import type { DatosRuta } from "@/lib/rutas/planear";
import { emitir, escuchar } from "../bus";
import type { PuntoNombrado, RutaPulso } from "../tipos";
import CamarasRuta from "./CamarasRuta";
import CampoLugar, { type ValorLugar } from "./CampoLugar";
import { EJEMPLOS_RUTA, MODOS_RUTA, NOMBRE_MODO, PESOS_PUNTAJE, dentroDelValle, type ModoRuta } from "./constantes";
import { fechaCorta } from "./fechas";
import TarjetaRuta from "./TarjetaRuta";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "cargando" }
  | { tipo: "error"; texto: string }
  | { tipo: "vacio"; texto: string }
  | { tipo: "sin-clave" }
  | { tipo: "ok"; origen: PuntoNombrado; destino: PuntoNombrado; rutas: RutaPulso[]; citas: Cita[]; nota?: string; desdeBot: boolean };

/** Último resultado, para que el panel lo recupere al volver a abrirse (el bus solo recuerda el evento). */
let memoria: { estado: Extract<Estado, { tipo: "ok" }>; origen: string; destino: string; modo: ModoRuta } | null = null;

const ICONO_ORIGEN = <span className="block h-2.5 w-2.5 rounded-full border-2 border-[#34D399]" />;
const ICONO_DESTINO = (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#F87171]" fill="currentColor">
    <path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5Zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
  </svg>
);

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]";

export default function PanelRutas({ onCerrar }: { onCerrar: () => void }) {
  const [textoOrigen, setTextoOrigen] = useState(memoria?.origen ?? "");
  const [textoDestino, setTextoDestino] = useState(memoria?.destino ?? "");
  const [origen, setOrigen] = useState<ValorLugar | null>(memoria ? { ...memoria.estado.origen } : null);
  const [destino, setDestino] = useState<ValorLugar | null>(memoria ? { ...memoria.estado.destino } : null);
  const [modo, setModo] = useState<ModoRuta>(memoria?.modo ?? "DRIVE");
  const [estado, setEstado] = useState<Estado>(memoria?.estado ?? { tipo: "inicial" });
  const [elegida, setElegida] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const propias = useRef<RutaPulso[] | null>(memoria?.estado.rutas ?? null);
  const peticion = useRef<AbortController | null>(null);

  // Rutas que llegan por el bus (p. ej. pedidas a PulsoBot) y la ruta elegida en el mapa
  useEffect(
    () =>
      escuchar(
        (e) => {
          if (e.tipo === "rutas") {
            if (e.rutas === propias.current) {
              setElegida(e.elegida ?? e.rutas.find((r) => r.recomendada)?.id ?? null);
              return;
            }
            propias.current = e.rutas;
            setTextoOrigen(e.origen.nombre);
            setTextoDestino(e.destino.nombre);
            setOrigen({ ...e.origen });
            setDestino({ ...e.destino });
            const modoEvento = e.rutas[0]?.modo;
            if (modoEvento && modoEvento !== "TRANSIT") setModo(modoEvento);
            setEstado({ tipo: "ok", origen: e.origen, destino: e.destino, rutas: e.rutas, citas: [], desdeBot: true });
            setElegida(e.elegida ?? e.rutas.find((r) => r.recomendada)?.id ?? null);
          } else if (e.tipo === "elegir-ruta") {
            setElegida(e.id);
          } else if (e.tipo === "limpiar-rutas") {
            propias.current = null;
            memoria = null;
            setEstado({ tipo: "inicial" });
            setElegida(null);
          }
        },
        ["rutas", "elegir-ruta"],
      ),
    [],
  );

  useEffect(() => () => peticion.current?.abort(), []);

  async function calcular(o: ValorLugar | null = origen ?? textoOrigen.trim(), d: ValorLugar | null = destino ?? textoDestino.trim(), m: ModoRuta = modo) {
    setAviso(null);
    if (!o || (typeof o === "string" && o.length < 2) || !d || (typeof d === "string" && d.length < 2)) {
      setAviso("Escribe un origen y un destino para calcular la ruta.");
      return;
    }
    peticion.current?.abort();
    const ctrl = new AbortController();
    peticion.current = ctrl;
    setEstado({ tipo: "cargando" });
    try {
      const res = await fetch("/api/rutas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen: o, destino: d, modo: m }),
        signal: ctrl.signal,
      });
      const j = (await res.json().catch(() => null)) as Respuesta<DatosRuta> | null;
      if (!j) {
        setEstado({ tipo: "error", texto: "No se pudieron calcular las rutas en este momento. Intenta de nuevo." });
        return;
      }
      if (!j.ok) {
        if (j.motivo === "sin-clave") setEstado({ tipo: "sin-clave" });
        else if (j.motivo === "sin-datos") setEstado({ tipo: "vacio", texto: j.detalle });
        else setEstado({ tipo: "error", texto: j.detalle });
        return;
      }
      const { datos } = j;
      if (datos.rutas.length === 0) {
        setEstado({ tipo: "vacio", texto: "Google no devolvió alternativas para este trayecto. Prueba con otro modo." });
        return;
      }
      const ok: Extract<Estado, { tipo: "ok" }> = {
        tipo: "ok",
        origen: datos.origen,
        destino: datos.destino,
        rutas: datos.rutas,
        citas: j.citas,
        nota: j.nota,
        desdeBot: false,
      };
      const recomendada = datos.rutas.find((r) => r.recomendada)?.id ?? datos.rutas[0]!.id;
      propias.current = datos.rutas;
      memoria = { estado: ok, origen: datos.origen.nombre, destino: datos.destino.nombre, modo: m };
      setTextoOrigen(datos.origen.nombre);
      setTextoDestino(datos.destino.nombre);
      setOrigen({ lat: datos.origen.lat, lng: datos.origen.lng, nombre: datos.origen.nombre });
      setDestino({ lat: datos.destino.lat, lng: datos.destino.lng, nombre: datos.destino.nombre });
      setEstado(ok);
      setElegida(recomendada);
      emitir({ tipo: "rutas", rutas: datos.rutas, origen: datos.origen, destino: datos.destino, elegida: recomendada });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setEstado({ tipo: "error", texto: "No hay conexión con el servidor de PULSO. Revisa tu internet e intenta de nuevo." });
    }
  }

  function intercambiar() {
    setTextoOrigen(textoDestino);
    setTextoDestino(textoOrigen);
    setOrigen(destino);
    setDestino(origen);
  }

  function usarUbicacion() {
    setAviso(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAviso("Este navegador no permite usar tu ubicación.");
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocalizando(false);
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        if (!dentroDelValle(lat, lng)) {
          setAviso("Tu ubicación está fuera del Valle de Aburrá; escribe un punto de partida en el área metropolitana.");
          return;
        }
        setTextoOrigen("Mi ubicación");
        setOrigen({ lat, lng, nombre: "Mi ubicación" });
      },
      (err) => {
        setLocalizando(false);
        setAviso(
          err.code === err.PERMISSION_DENIED
            ? "No tenemos permiso para usar tu ubicación. Puedes escribir el punto de partida."
            : "No pudimos obtener tu ubicación. Escribe el punto de partida.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function limpiar() {
    peticion.current?.abort();
    propias.current = null;
    memoria = null;
    setEstado({ tipo: "inicial" });
    setElegida(null);
    setTextoOrigen("");
    setTextoDestino("");
    setOrigen(null);
    setDestino(null);
    setAviso(null);
    emitir({ tipo: "limpiar-rutas" });
  }

  function elegirRuta(id: string) {
    setElegida(id);
    emitir({ tipo: "elegir-ruta", id });
  }

  function preguntar(o: PuntoNombrado, d: PuntoNombrado) {
    emitir({ tipo: "preguntar", texto: `¿Cómo está el aire y cuántos incidentes viales se han reportado en la ruta de ${o.nombre} a ${d.nombre}?` });
  }

  const cargando = estado.tipo === "cargando";
  const lecturaSiata = estado.tipo === "ok" ? estado.citas.find((c) => c.conjunto.startsWith("SIATA"))?.fechaCorte : null;
  const corteMedata = estado.tipo === "ok" ? estado.citas.find((c) => c.id === "1-023-25-000094")?.fechaCorte : null;

  return (
    <div className="flex flex-col gap-3 p-4 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">Rutas inteligentes</h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-tinta/65">Compara cada alternativa por aire (SIATA en vivo) e incidentes viales reportados (MEData).</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className={`shrink-0 rounded-full p-2 text-tinta/70 hover:bg-tinta/10 hover:text-tinta ${foco}`}
          aria-label="Cerrar rutas"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void calcular();
        }}
      >
        <div className="relative flex flex-col gap-2 pr-11">
          <CampoLugar
            etiqueta="Origen"
            marcador="¿Desde dónde sales?"
            texto={textoOrigen}
            onTexto={(t) => {
              setTextoOrigen(t);
              setOrigen(null);
            }}
            onElegir={(v, t) => {
              setTextoOrigen(t);
              setOrigen(v);
            }}
            icono={ICONO_ORIGEN}
          />
          <CampoLugar
            etiqueta="Destino"
            marcador="¿A dónde vas?"
            texto={textoDestino}
            onTexto={(t) => {
              setTextoDestino(t);
              setDestino(null);
            }}
            onElegir={(v, t) => {
              setTextoDestino(t);
              setDestino(v);
            }}
            icono={ICONO_DESTINO}
          />
          <button
            type="button"
            onClick={intercambiar}
            aria-label="Intercambiar origen y destino"
            title="Intercambiar origen y destino"
            className={`absolute right-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-tinta/15 bg-tinta/[0.06] text-tinta/80 hover:bg-tinta/15 ${foco}`}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 2v12M5 14l-3-3M5 14l3-3M11 14V2M11 2L8 5M11 2l3 3" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={usarUbicacion}
          disabled={localizando}
          className={`self-start rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-[#93C5FD] hover:bg-tinta/10 disabled:opacity-60 ${foco}`}
        >
          {localizando ? "Buscando tu ubicación…" : "◎ Usar mi ubicación"}
        </button>

        <div role="radiogroup" aria-label="Modo de viaje" className="flex flex-wrap gap-1.5">
          {MODOS_RUTA.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors motion-reduce:transition-none ${foco} ${
                modo === m ? "border-[#2563EB] bg-[#2563EB] text-tinta" : "border-tinta/15 text-tinta/80 hover:bg-tinta/10"
              }`}
            >
              {NOMBRE_MODO[m]}
            </button>
          ))}
        </div>

        {aviso && (
          <p role="alert" className="m-0 rounded-xl bg-[#FBBF24]/10 px-3 py-2 text-[12.5px] text-[#FDE68A]">
            {aviso}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className={`rounded-xl bg-[#2563EB] px-4 py-2.5 text-[14px] font-bold text-tinta hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-70 ${foco}`}
        >
          {cargando ? "Calculando…" : "Calcular rutas"}
        </button>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-tinta/50">Prueba un ejemplo</span>
        <div className="flex flex-wrap gap-1.5">
          {EJEMPLOS_RUTA.map((ej) => (
            <button
              key={ej.corto}
              type="button"
              disabled={cargando}
              onClick={() => {
                setTextoOrigen(ej.origen.replace(/, Medellín$/, ""));
                setTextoDestino(ej.destino.replace(/, Medellín$/, ""));
                setOrigen(ej.origen);
                setDestino(ej.destino);
                void calcular(ej.origen, ej.destino, modo);
              }}
              className={`rounded-full border border-tinta/15 bg-tinta/[0.04] px-2.5 py-1 text-[12px] text-tinta/85 hover:bg-tinta/10 disabled:opacity-60 ${foco}`}
            >
              {ej.corto}
            </button>
          ))}
        </div>
      </div>

      <section aria-live="polite" aria-busy={cargando} className="flex flex-col gap-2.5">
        {estado.tipo === "inicial" && (
          <p className="m-0 rounded-2xl border border-dashed border-tinta/15 px-3 py-4 text-center text-[13px] text-tinta/60">
            Elige origen y destino, o prueba un ejemplo. PULSO dibujará las alternativas en el mapa.
          </p>
        )}

        {estado.tipo === "cargando" && (
          <>
            <p className="m-0 text-[12.5px] text-tinta/70">Calculando rutas con Google y cruzándolas con SIATA y MEData…</p>
            {[0, 1].map((k) => (
              <div key={k} className="h-[118px] animate-pulse rounded-2xl bg-tinta/[0.06] motion-reduce:animate-none" aria-hidden="true" />
            ))}
          </>
        )}

        {estado.tipo === "error" && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-3 text-[13px] text-[#FECACA]">
            <span>{estado.texto}</span>
            <button type="button" onClick={() => void calcular()} className={`self-start rounded-full bg-tinta/10 px-3 py-1 text-[12.5px] font-semibold text-tinta hover:bg-tinta/20 ${foco}`}>
              Reintentar
            </button>
          </div>
        )}

        {estado.tipo === "vacio" && <p className="m-0 rounded-2xl border border-tinta/15 bg-tinta/[0.04] px-3 py-3 text-[13px] text-tinta/80">{estado.texto}</p>}

        {estado.tipo === "sin-clave" && (
          <p className="m-0 rounded-2xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 px-3 py-3 text-[13px] text-[#FDE68A]">
            Las rutas necesitan la clave de Google en esta instalación; el mapa y los datos siguen funcionando.
          </p>
        )}

        {estado.tipo === "ok" && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="min-w-0 break-words text-[13px] font-semibold text-tinta">
                {estado.origen.nombre} → {estado.destino.nombre}
              </span>
              <span className="text-[11.5px] text-tinta/55">
                {estado.rutas.length === 1 ? "1 alternativa" : `${estado.rutas.length} alternativas`}
                {estado.desdeBot ? " · pedidas a PulsoBot" : ""}
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {estado.rutas.map((r) => (
                <li key={r.id}>
                  <TarjetaRuta ruta={r} elegida={elegida === r.id} onElegir={() => elegirRuta(r.id)} />
                  {elegida === r.id && r.camaras && r.camaras.length > 0 && <CamarasRuta key={r.id} camaras={r.camaras} />}
                </li>
              ))}
            </ul>
            {estado.rutas.length === 1 && (
              <p className="m-0 text-[12px] text-tinta/60">Google solo devolvió una ruta para este modo, así que no hay con qué compararla.</p>
            )}
            <p className="m-0 text-[11.5px] leading-snug text-tinta/60">
              Puntaje 0–100: {Math.round(PESOS_PUNTAJE.aire * 100)} % aire (PM2.5 estimado por distancia a las estaciones SIATA),{" "}
              {Math.round(PESOS_PUNTAJE.siniestralidad * 100)} % incidentes viales históricos a menos de 150 m (MEData, no es tráfico actual) y{" "}
              {Math.round(PESOS_PUNTAJE.tiempo * 100)} % tiempo (Google), comparado entre alternativas.
            </p>
            <p className="m-0 text-[11.5px] leading-snug text-tinta/50">
              Fuentes: SIATA{lecturaSiata ? `, lectura del ${fechaCorta(lecturaSiata)}` : " (última lectura)"} · MEData Incidentes viales 1-023-25-000094 (CC BY-SA 4.0)
              {corteMedata ? `, corte ${fechaCorta(corteMedata)}` : ""} · Google Routes solo para trazado y tiempos.
            </p>
            {estado.nota && /copia guardada/i.test(estado.nota) && (
              <p className="m-0 rounded-xl bg-[#FBBF24]/10 px-3 py-2 text-[12px] text-[#FDE68A]">SIATA no respondió: el aire se estimó con la copia guardada.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => preguntar(estado.origen, estado.destino)}
                className={`rounded-xl border border-[#60A5FA]/40 bg-[#2563EB]/15 px-3 py-2 text-[12.5px] font-semibold text-[#BFDBFE] hover:bg-[#2563EB]/30 ${foco}`}
              >
                Pregúntale a PULSO por esta ruta
              </button>
              <button type="button" onClick={limpiar} className={`rounded-xl px-3 py-2 text-[12.5px] font-semibold text-tinta/70 hover:bg-tinta/10 ${foco}`}>
                Limpiar
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
