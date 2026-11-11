"use client";

import AvatarAgente from "./AvatarAgente";
import { AGENTES_OPC, EDITABLES, type AspectoAgente, type CambiosAgentes, type IdEditable } from "./persona";

export const PISOS: Record<IdEditable | "analista", string> = {
  reloj: "#FEF7E6",
  lab: "#E9FAF6",
  ventanilla: "#F3F0FE",
  analista: "#EDF4FF",
  monitoreo: "#EAF8F1",
  comunicaciones: "#FFF4ED",
};

type Clave = keyof Omit<AspectoAgente, "nombre">;

/** Editor de agentes: tono de piel, peinado, ropa y accesorios. Guarda solo lo que difiere del aspecto predeterminado. */
export default function EditorAgentes({
  aspectos,
  cambios,
  guardar,
  elegido,
  setElegido,
  oscuro,
}: {
  aspectos: Record<IdEditable, AspectoAgente>;
  cambios: CambiosAgentes;
  guardar(c: CambiosAgentes): void;
  elegido: IdEditable;
  setElegido(id: IdEditable): void;
  oscuro: boolean;
}) {
  const cur = aspectos[elegido];
  const poner = <K extends Clave>(k: K, v: AspectoAgente[K]) => guardar({ ...cambios, [elegido]: { ...(cambios[elegido] ?? {}), [k]: v } });
  const anillo = (a: boolean) => (a ? "0 0 0 3px rgba(37,99,235,.35)" : "none");
  const colores = (k: "piel" | "pelo" | "color" | "camisa" | "corbata" | "colorInferior", t: string) => (
    <div role="group" aria-label={t} className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--tinta2)]">{t}</span>
      <div className="flex flex-wrap gap-2">
        {(AGENTES_OPC[k] as (string | null)[]).map((c) => {
          const a = cur[k] === c;
          const nombre = c === null ? "ninguna" : c === "auto" ? "automático" : c;
          return (
            <button
              key={String(c)}
              aria-pressed={a}
              aria-label={`${t.toLowerCase()}: ${nombre}`}
              title={nombre}
              onClick={() => poner(k, c as never)}
              className="h-11 min-w-[44px] rounded-full border-2 text-[13px] font-semibold text-[var(--tinta2)] transition-[box-shadow,transform] hover:-translate-y-px motion-reduce:hover:translate-y-0"
              style={{ background: c && c !== "auto" ? c : "var(--sup2)", borderColor: a ? "#2563EB" : "var(--borde2)", boxShadow: anillo(a) }}
            >
              {c === null ? "—" : c === "auto" ? "auto" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
  const textos = <K extends "peinado" | "ropa" | "inferior">(k: K, t: string) => (
    <div role="group" aria-label={t} className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--tinta2)]">{t}</span>
      <div className="flex flex-wrap gap-2">
        {(AGENTES_OPC[k] as [AspectoAgente[K], string][]).map(([v, nombre]) => {
          const a = cur[k] === v;
          return (
            <button
              key={String(v)}
              aria-pressed={a}
              onClick={() => poner(k, v)}
              className="h-11 rounded-full border-2 px-3.5 text-[13px] font-semibold"
              style={{ background: a ? "#2563EB" : "var(--sup)", color: a ? "#FFFFFF" : "var(--tinta)", borderColor: a ? "#2563EB" : "var(--borde)" }}
            >
              {nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
  const restablecerUno = () => {
    const o = { ...cambios };
    delete o[elegido];
    guardar(o);
  };
  return (
    <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
      <div className="flex flex-col gap-3.5">
        <div role="tablist" aria-label="Agente" className="flex flex-wrap gap-1.5">
          {EDITABLES.map((id) => {
            const a = id === elegido;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={a}
                onClick={() => setElegido(id)}
                className="flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] py-0 pl-1 pr-3 text-[13px] font-semibold"
                style={{ background: a ? (oscuro ? "#142339" : "#EFF6FF") : "var(--sup)", borderColor: a ? "#2563EB" : "var(--borde)" }}
              >
                <span className="h-[34px] w-[34px] overflow-hidden rounded-full">
                  <AvatarAgente id={id} aspectos={aspectos} fondo={PISOS[id]} />
                </span>
                {aspectos[id].nombre}
              </button>
            );
          })}
        </div>
        <div className="h-[360px] overflow-hidden rounded-[20px] border border-[var(--borde)]" style={{ background: PISOS[elegido] }}>
          <AvatarAgente id={elegido} aspectos={aspectos} fondo={PISOS[elegido]} entero />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={restablecerUno} className="min-h-[44px] rounded-xl border border-[var(--borde)] bg-[var(--sup)] px-4 text-[13px] font-semibold hover:border-[#2563EB]">
            Restablecer este agente
          </button>
          <button onClick={() => guardar({})} className="min-h-[44px] rounded-xl border border-[var(--borde)] px-4 text-[13px] font-semibold text-[var(--tinta2)] hover:border-[#2563EB]">
            Restablecer todos
          </button>
        </div>
        <p className="text-[12.5px] text-[var(--tinta2)]">Los cambios se ven al instante en la oficina y en las fichas del equipo, y se guardan en este navegador.</p>
      </div>
      <div className="flex flex-col gap-[18px] rounded-[20px] border border-[var(--borde)] bg-[var(--sup)] p-[18px]">
        {colores("piel", "TONO DE PIEL")}
        {textos("peinado", "PEINADO")}
        {colores("pelo", "COLOR DE PELO")}
        {textos("ropa", "ROPA")}
        {colores("color", "COLOR DE LA ROPA")}
        {colores("camisa", "CAMISA")}
        {colores("corbata", "CORBATA")}
        {textos("inferior", "PRENDA INFERIOR")}
        {colores("colorInferior", "COLOR DE PANTALÓN O FALDA")}
        <div role="group" aria-label="Accesorios" className="flex flex-col gap-2">
          <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--tinta2)]">ACCESORIOS</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["gafas", "Gafas"],
                ["diadema", "Diadema con micrófono"],
                ["carnet", "Carnet"],
              ] as const
            ).map(([k, t]) => {
              const a = !!cur[k];
              return (
                <button
                  key={k}
                  aria-pressed={a}
                  onClick={() => poner(k, !a)}
                  className="h-11 rounded-full border-2 px-3.5 text-[13px] font-semibold"
                  style={{ background: a ? "#2563EB" : "var(--sup)", color: a ? "#FFFFFF" : "var(--tinta)", borderColor: a ? "#2563EB" : "var(--borde)" }}
                >
                  {a ? "✓ " : ""}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
