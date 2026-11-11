"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { decimal, miles } from "@/mundo/areas";
import { EJES_ARANA, type CalorAbandono, type FlujoCatalogo, type PerfilSecretaria, type Visuales } from "@/lib/visuales";
import { mezclar } from "./persona";

/** Progreso 0 → 1 (1,5 s, ease-out cúbico) que arranca cuando el bloque entra en pantalla. Movimiento reducido: 1 directo. */
export function useEntrada<T extends Element>(): [RefObject<T | null>, number, () => void] {
  const ref = useRef<T>(null);
  // arranca en 1: sin JavaScript o antes de verse, la cifra que aparece es la real (nunca un 0 suelto)
  const [p, setP] = useState(1);
  const raf = useRef(0);
  const visto = useRef(false);
  const correr = useRef(() => {});
  useEffect(() => {
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    correr.current = () => {
      cancelAnimationFrame(raf.current);
      if (quieto) return setP(1);
      const t0 = performance.now();
      const paso = (n: number) => {
        const t = Math.max(0, Math.min(1, (n - t0) / 1500));
        setP(1 - Math.pow(1 - t, 3));
        if (t < 1) raf.current = requestAnimationFrame(paso);
      };
      // sin setP(0) previo: si el navegador no pinta (pestaña oculta), queda la cifra real
      raf.current = requestAnimationFrame(paso);
    };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      correr.current();
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting) && !visto.current) {
          visto.current = true;
          correr.current();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);
  return [ref, p, () => correr.current()];
}

const tarjeta = "flex min-w-0 flex-col gap-4 rounded-[22px] border border-[var(--borde)] bg-[var(--sup)] p-[clamp(18px,3vw,30px)]";
const lectura = "flex min-h-[44px] items-center gap-2.5 rounded-xl bg-[var(--sup2)] px-3.5 py-2.5 text-[14px] text-[var(--tinta)]";

/* ───────── flujo del catálogo ───────── */

type IdNodo = "cat" | "prom" | "nod" | "aldia" | "atr" | "cri" | "prop" | "sin";
type Sel = { t: "n"; id: IdNodo } | { t: "l"; i: number } | null;

function Flujo({ flujo, oscuro, movil }: { flujo: FlujoCatalogo; oscuro: boolean; movil: boolean }) {
  const [ref, p, reanimar] = useEntrada<HTMLElement>();
  const [sk, setSk] = useState<Sel>(null);
  const [vistaElegida, setVista] = useState<"flujo" | "barras" | null>(null);
  const vista = vistaElegida ?? (movil ? "barras" : "flujo");
  const k = 0.58;
  const X = [0, 236, 472, 708];
  const est = Object.fromEntries(flujo.estados.map((e) => [e.estado, e])) as Record<"al-dia" | "atrasado" | "critico", FlujoCatalogo["estados"][number]>;
  const N: Record<IdNodo, { c: number; v: number; l: string; col: string; x: number; y: number; h: number }> = {} as never;
  const def: [IdNodo, number, number, string, string][] = [
    ["cat", 0, flujo.total, "Catálogo de MEData", oscuro ? "#CBD5E1" : "#0F172A"],
    ["prom", 1, flujo.conPeriodicidad, "Prometen una periodicidad", "#2563EB"],
    ["nod", 1, flujo.sinPeriodicidad, "No dicen cada cuánto", "#94A3B8"],
    ["aldia", 2, est["al-dia"].n, "Al día", "#16A34A"],
    ["atr", 2, est.atrasado.n, "Atrasados", "#D97706"],
    ["cri", 2, est.critico.n, "Críticos", "#DC2626"],
    ["prop", 3, flujo.propuestas, "Con propuesta de mejora", "#2563EB"],
    ["sin", 3, flujo.sinPropuesta, "Sin problemas", "#16A34A"],
  ];
  // columnas apiladas con los mismos márgenes del diseño
  const inicio = [22, 6, 0, 18];
  const hueco = [0, 30, 25, 18];
  const cursor = [...inicio];
  for (const [id, c, v, l, col] of def) {
    N[id] = { c, v, l, col, x: X[c], y: cursor[c], h: v * k };
    cursor[c] += v * k + hueco[c];
  }
  const L: [IdNodo, IdNodo, number][] = (
    [
      ["cat", "prom", flujo.conPeriodicidad],
      ["cat", "nod", flujo.sinPeriodicidad],
      ["prom", "aldia", est["al-dia"].n],
      ["prom", "atr", est.atrasado.n],
      ["prom", "cri", est.critico.n],
      ["aldia", "prop", est["al-dia"].conPropuesta],
      ["aldia", "sin", est["al-dia"].n - est["al-dia"].conPropuesta],
      ["atr", "prop", est.atrasado.conPropuesta],
      ["atr", "sin", est.atrasado.n - est.atrasado.conPropuesta],
      ["cri", "prop", est.critico.conPropuesta],
      ["cri", "sin", est.critico.n - est.critico.conPropuesta],
      ["nod", "prop", flujo.sinPeriodicidadConPropuesta],
      ["nod", "sin", flujo.sinPeriodicidad - flujo.sinPeriodicidadConPropuesta],
    ] as [IdNodo, IdNodo, number][]
  ).filter((l) => l[2] > 0);
  const so: Record<string, number> = {};
  const to: Record<string, number> = {};
  const rel = new Set<number>();
  if (sk?.t === "n") {
    const up = (id: IdNodo) =>
      L.forEach((l, i) => {
        if (l[1] === id) {
          rel.add(i);
          up(l[0]);
        }
      });
    const dn = (id: IdNodo) =>
      L.forEach((l, i) => {
        if (l[0] === id) {
          rel.add(i);
          dn(l[1]);
        }
      });
    up(sk.id);
    dn(sk.id);
  }
  const colCat = oscuro ? "#CBD5E1" : "#0F172A";
  const links = L.map((l, i) => {
    const a = N[l[0]], b = N[l[1]], h = l[2] * k;
    const y0 = a.y + (so[l[0]] ?? 0), y1 = b.y + (to[l[1]] ?? 0);
    so[l[0]] = (so[l[0]] ?? 0) + h;
    to[l[1]] = (to[l[1]] ?? 0) + h;
    const x0 = a.x + 12, x1 = b.x, xm = (x0 + x1) / 2;
    const d = `M${x0} ${y0} C${xm} ${y0} ${xm} ${y1} ${x1} ${y1} L${x1} ${y1 + h} C${xm} ${y1 + h} ${xm} ${y0 + h} ${x0} ${y0 + h} Z`;
    const act = !sk ? null : sk.t === "l" ? sk.i === i : rel.has(i);
    return { d, col: b.col === "#2563EB" && a.col !== colCat ? a.col : b.col, op: act === null ? 0.34 : act ? 0.72 : 0.07 };
  });
  let txt = "Pasa el puntero o toca una caja para seguir su camino.";
  let col = "#94A3B8";
  if (sk?.t === "l") {
    const l = L[sk.i];
    txt = `${N[l[0]].l} → ${N[l[1]].l}: ${miles(l[2])} conjuntos`;
    col = N[l[1]].col;
  }
  if (sk?.t === "n") {
    const n = N[sk.id];
    txt = `${n.l}: ${miles(n.v)} conjuntos · ${decimal((n.v / flujo.total) * 100)} % del catálogo`;
    col = n.col;
  }
  const halo = { paintOrder: "stroke" as const, stroke: "var(--sup)", strokeWidth: "5px", strokeLinejoin: "round" as const };
  const seg = (id: IdNodo, v: number, c: string, etq: string) => ({ id, flex: Math.max(0.001, v * p), c, etq: v > 30 ? etq : "", tip: etq, op: sk?.t === "n" && sk.id !== id ? 0.35 : 1 });
  const barras = [
    { t: "Catálogo de MEData", total: flujo.total, seg: [seg("prom", flujo.conPeriodicidad, "#2563EB", `${miles(flujo.conPeriodicidad)} prometen una periodicidad`), seg("nod", flujo.sinPeriodicidad, "#94A3B8", `${miles(flujo.sinPeriodicidad)} no dicen cada cuánto`)] },
    { t: "Prometen una periodicidad", total: flujo.conPeriodicidad, seg: [seg("aldia", est["al-dia"].n, "#16A34A", `${est["al-dia"].n} al día`), seg("atr", est.atrasado.n, "#D97706", `${est.atrasado.n} atrasados`), seg("cri", est.critico.n, "#DC2626", `${est.critico.n} críticos`)] },
    { t: "Ventanilla de Apertura", total: flujo.total, seg: [seg("prop", flujo.propuestas, "#2563EB", `${miles(flujo.propuestas)} con propuesta de mejora`), seg("sin", flujo.sinPropuesta, "#16A34A", `${flujo.sinPropuesta} sin problemas`)] },
  ];
  const boton = (activo: boolean) => `min-h-[38px] rounded-[9px] px-3.5 text-[13px] font-semibold ${activo ? "bg-[var(--sup)] text-[var(--tinta)] shadow-sm" : "text-[var(--tinta2)]"}`;
  return (
    <article ref={ref} className={tarjeta}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <h3 className="text-[19px] font-bold">Por dónde pasan los {miles(flujo.total)} conjuntos</h3>
          <p className="text-[14px] leading-relaxed text-[var(--tinta2)] [text-wrap:pretty]">
            Del catálogo crudo a la propuesta: cuántos prometen actualizarse, cuántos cumplen y cuántos terminan en la Ventanilla con algo por mejorar. Pasa el puntero o toca una caja para seguir su camino.
          </p>
        </div>
        <div role="group" aria-label="Tipo de vista" className="flex gap-1 rounded-xl bg-[var(--sup2)] p-1">
          <button
            aria-pressed={vista === "flujo"}
            onClick={() => {
              setVista("flujo");
              reanimar();
            }}
            className={boton(vista === "flujo")}
          >
            Flujo
          </button>
          <button
            aria-pressed={vista === "barras"}
            onClick={() => {
              setVista("barras");
              reanimar();
            }}
            className={boton(vista === "barras")}
          >
            Barras
          </button>
        </div>
      </div>
      <div aria-live="polite" className={lectura}>
        <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: col }} aria-hidden="true" />
        <span>{txt}</span>
      </div>
      {vista === "flujo" ? (
        <svg viewBox="-4 -24 880 336" role="img" aria-label="Diagrama de flujo del catálogo de MEData" className="block h-auto w-full" onMouseLeave={() => setSk(null)}>
          <defs>
            <clipPath id="flujo-revela">
              <rect x={-4} y={-30} width={Math.round(884 * p)} height={360} />
            </clipPath>
          </defs>
          <g clipPath="url(#flujo-revela)">
            {links.map((l, i) => (
              <path key={i} d={l.d} fill={l.col} fillOpacity={l.op} className="cursor-pointer transition-[fill-opacity] duration-200" onMouseEnter={() => setSk({ t: "l", i })} onClick={() => setSk({ t: "l", i })} />
            ))}
          </g>
          {(Object.keys(N) as IdNodo[]).map((id) => {
            const n = N[id];
            return (
              <g key={id} className="cursor-pointer" onMouseEnter={() => setSk({ t: "n", id })} onClick={() => setSk({ t: "n", id })}>
                <rect x={n.x} y={n.y} width={12} height={Math.max(3, n.h)} rx={3} fill={n.col} />
              </g>
            );
          })}
          <g pointerEvents="none">
            {(Object.keys(N) as IdNodo[]).map((id) => {
              const n = N[id];
              const chico = n.h < 30;
              return (
                <g key={id}>
                  <text x={n.x + 20} y={n.y + n.h / 2 - 2} fill="var(--tinta)" style={{ ...halo, fontFamily: "var(--font-jetbrains), monospace", fontSize: 17, fontWeight: 700 }}>
                    {miles(Math.round(n.v * p))}
                  </text>
                  <text x={n.x + 20} y={n.y + n.h / 2 + (chico ? 13 : 14)} fill="var(--tinta2)" style={{ ...halo, fontSize: 12.5, fontWeight: 500 }}>
                    {n.l}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      ) : (
        <div className="flex flex-col gap-[18px]">
          {barras.map((b) => (
            <div key={b.t} className="flex flex-col gap-2">
              <div className="flex justify-between gap-2.5 text-[13.5px]">
                <span className="font-semibold">{b.t}</span>
                <span className="font-mono text-[var(--tinta2)]">{miles(b.total)}</span>
              </div>
              <div className="flex h-[34px] gap-[3px]">
                {b.seg.map((g) => (
                  <div
                    key={g.id}
                    title={g.tip}
                    onMouseEnter={() => setSk({ t: "n", id: g.id })}
                    onClick={() => setSk({ t: "n", id: g.id })}
                    className="flex min-w-[4px] cursor-pointer items-center overflow-hidden rounded-md px-2 font-mono text-[12.5px] font-bold text-white transition-[flex,opacity] duration-[900ms]"
                    style={{ flex: g.flex, background: g.c, opacity: g.op }}
                  >
                    <span className="truncate">{g.etq}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--tinta2)]">
                {b.seg.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: g.c }} aria-hidden="true" />
                    {g.tip}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[12px] text-[var(--tinta2)]">Fuente: catálogo de MEData y reglas de la Ventanilla (src/lib/ventanilla.ts).</p>
    </article>
  );
}

/* ───────── mapa de calor ───────── */

function Calor({ calor, oscuro }: { calor: CalorAbandono; oscuro: boolean }) {
  const [ref, p] = useEntrada<HTMLElement>();
  const [cel, setCel] = useState<{ r: number; c: number } | null>(null);
  const c0 = oscuro ? "#1B2E4C" : "#DBEAFE";
  const c1 = oscuro ? "#93C5FD" : "#1E3A8A";
  const ultimo = calor.anios[calor.anios.length - 1];
  const enUltimo = calor.totalesAnio[calor.totalesAnio.length - 1] ?? 0;
  const cols = `minmax(92px,1.5fr) repeat(${calor.anios.length},minmax(0,1fr))`;
  const info = cel ? calor.filas[cel.r] : null;
  return (
    <article ref={ref} className={tarjeta}>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[19px] font-bold">Mapa de calor del abandono</h3>
        <p className="text-[14px] leading-relaxed text-[var(--tinta2)] [text-wrap:pretty]">
          Año de la última actualización de cada conjunto, por secretaría. En {ultimo} solo se actualizaron <strong className="text-[var(--tinta)]">{miles(enUltimo)}</strong> de los conjuntos del catálogo.
        </p>
      </div>
      <div aria-live="polite" className={`${lectura} text-[13.5px]`}>
        {info && cel ? `${info.publicador} · ${calor.anios[cel.c]}: ${miles(info.porAnio[cel.c])} ${info.porAnio[cel.c] === 1 ? "conjunto" : "conjuntos"} con su última actualización ese año.` : "Pasa el puntero o toca una celda para leerla."}
      </div>
      <div role="table" aria-label="Conjuntos por secretaría y año de última actualización" className="flex flex-col gap-[3px]" onMouseLeave={() => setCel(null)}>
        <div role="row" className="grid gap-[3px] font-mono text-[11px] text-[var(--tinta2)]" style={{ gridTemplateColumns: cols }}>
          <span role="columnheader" className="px-1">
            Secretaría
          </span>
          {calor.anios.map((a) => (
            <span
              key={a}
              role="columnheader"
              className="rounded-md py-1 text-center"
              style={a === ultimo ? { fontWeight: 700, color: oscuro ? "#6EE7B7" : "#047857", background: oscuro ? "rgba(52,211,153,.14)" : "#D1FAE5" } : { fontWeight: 500 }}
            >
              {a}
            </span>
          ))}
        </div>
        {calor.filas.map((f, ri) => (
          <div key={f.publicador} role="row" className="grid gap-[3px] transition-opacity" style={{ gridTemplateColumns: cols, opacity: cel && cel.r !== ri ? 0.5 : 1 }}>
            <span role="rowheader" className="flex min-w-0 items-center px-1 text-[12px] leading-tight [overflow-wrap:anywhere]">
              {f.publicador}
            </span>
            {f.porAnio.map((v, ci) => {
              const t = Math.sqrt(v / calor.max);
              const rev = Math.max(0, Math.min(1, p * 1.8 - ci * 0.1 - ri * 0.03));
              const on = cel?.r === ri && cel?.c === ci;
              return (
                <span
                  key={ci}
                  role="cell"
                  aria-label={`${f.publicador}, ${calor.anios[ci]}: ${v} conjuntos`}
                  onMouseEnter={() => setCel({ r: ri, c: ci })}
                  onClick={() => setCel({ r: ri, c: ci })}
                  className="flex h-[30px] cursor-pointer items-center justify-center rounded-md font-mono text-[11.5px] font-semibold transition-[opacity,transform,box-shadow] duration-300"
                  style={{
                    background: v ? mezclar(c0, c1, t) : "var(--sup2)",
                    color: v ? (t > 0.45 ? (oscuro ? "#0B1220" : "#FFFFFF") : oscuro ? "#E2E8F0" : "#1E3A8A") : "var(--tinta2)",
                    opacity: rev,
                    transform: `scale(${on ? 1.12 : 0.85 + 0.15 * rev})`,
                    boxShadow: on ? "0 0 0 2px #2563EB" : "none",
                  }}
                >
                  {v ? v : "·"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-[var(--tinta2)]">
        menos
        <span className="h-2 w-[120px] rounded" style={{ background: `linear-gradient(90deg,${c0},${c1})` }} aria-hidden="true" />
        más conjuntos
      </div>
      <p className="text-[12px] text-[var(--tinta2)]">Fuente: campo «modified» del catálogo de MEData. Las {calor.filas.length} secretarías con más conjuntos.</p>
    </article>
  );
}

/* ───────── araña ───────── */

function Arana({ perfiles, oscuro }: { perfiles: PerfilSecretaria[]; oscuro: boolean }) {
  const [ref, p] = useEntrada<HTMLElement>();
  const pa = perfiles[0];
  const pb = perfiles.find((x) => x.publicador === "Planeación") ?? perfiles[1];
  const [verA, setVerA] = useState(true);
  const [verB, setVerB] = useState(true);
  const [eje, setEje] = useState<number | null>(null);
  if (!pa || !pb) return null;
  const R = 100;
  const ang = (i: number) => ((-90 + i * 72) * Math.PI) / 180;
  const pt = (i: number, v: number) => [Math.cos(ang(i)) * R * (v / 100), Math.sin(ang(i)) * R * (v / 100)];
  const s = (q: number[]) => q.map((n) => n.toFixed(1)).join(",");
  const val = (x: PerfilSecretaria) => EJES_ARANA.map((e) => x.valores[e.k] ?? 0);
  const A = val(pa), B = val(pb);
  const poly = (arr: number[]) => arr.map((v, i) => s(pt(i, Math.max(2, v * p)))).join(" ");
  const fmt = (x: PerfilSecretaria, k: (typeof EJES_ARANA)[number]["k"]) => {
    const v = x.valores[k];
    return v == null ? "sin dato" : `${decimal(v, v % 1 ? 1 : 0)} %`;
  };
  const chip = (activo: boolean, color: string, fondo: string) => ({ borderColor: color, background: activo ? fondo : "transparent" });
  return (
    <article ref={ref} className={tarjeta}>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[19px] font-bold">Araña de calidad: compara dos secretarías</h3>
        <p className="text-[14px] leading-relaxed text-[var(--tinta2)]">Cinco señales de un dato abierto sano. Más área = mejor publicado.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          aria-pressed={verA}
          onClick={() => setVerA(!verA || !verB)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold"
          style={chip(verA, "#2563EB", oscuro ? "rgba(37,99,235,.18)" : "#EFF6FF")}
        >
          <span className="h-[9px] w-[9px] rounded-full bg-[#2563EB]" aria-hidden="true" />
          {pa.publicador} · {pa.total} conjuntos
        </button>
        <button
          aria-pressed={verB}
          onClick={() => setVerB(!verB || !verA)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold"
          style={chip(verB, "#C2410C", oscuro ? "rgba(194,65,12,.18)" : "#FFF7ED")}
        >
          <span className="h-[9px] w-[9px] rounded-full bg-[#C2410C]" aria-hidden="true" />
          {pb.publicador} · {pb.total} conjuntos
        </button>
      </div>
      <svg viewBox="-240 -142 480 278" role="img" aria-label={`Araña de calidad ${pa.publicador} y ${pb.publicador}`} className="block h-auto w-full max-w-[520px] self-center" onMouseLeave={() => setEje(null)}>
        {[25, 50, 75, 100].map((v) => (
          <polygon key={v} points={EJES_ARANA.map((_, i) => s(pt(i, v))).join(" ")} fill="none" stroke="var(--borde)" strokeWidth={1} />
        ))}
        {EJES_ARANA.map((e, i) => {
          const q = pt(i, 100);
          return (
            <g key={e.k} className="cursor-pointer" onMouseEnter={() => setEje(i)} onClick={() => setEje(i)}>
              <line x1={0} y1={0} x2={q[0].toFixed(1)} y2={q[1].toFixed(1)} stroke={eje === i ? "#2563EB" : "var(--borde)"} strokeWidth={eje === i ? 2 : 1} />
            </g>
          );
        })}
        <g pointerEvents="none">
          {EJES_ARANA.map((e, i) => {
            const q = pt(i, 122);
            const cx = Math.cos(ang(i));
            return (
              <text key={e.k} x={q[0].toFixed(1)} y={(q[1] + 4).toFixed(1)} textAnchor={Math.abs(cx) < 0.2 ? "middle" : cx > 0 ? "start" : "end"} fill="var(--tinta)" style={{ fontSize: 11, fontWeight: eje === i ? 700 : 500 }}>
                {e.t}
              </text>
            );
          })}
        </g>
        {verB && <polygon points={poly(B)} fill="#C2410C" fillOpacity={0.14} stroke="#C2410C" strokeWidth={2} strokeLinejoin="round" />}
        {verA && <polygon points={poly(A)} fill="#2563EB" fillOpacity={0.16} stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" />}
        {verA && A.map((v, i) => { const q = pt(i, Math.max(2, v * p)); return <circle key={`a${i}`} cx={q[0].toFixed(1)} cy={q[1].toFixed(1)} r={eje === i ? 5 : 3.2} fill="#2563EB" stroke="var(--sup)" strokeWidth={1.5} />; })}
        {verB && B.map((v, i) => { const q = pt(i, Math.max(2, v * p)); return <circle key={`b${i}`} cx={q[0].toFixed(1)} cy={q[1].toFixed(1)} r={eje === i ? 5 : 3.2} fill="#C2410C" stroke="var(--sup)" strokeWidth={1.5} />; })}
      </svg>
      <div role="table" className="flex flex-col border-t border-[var(--borde)] text-[13px]">
        <div role="row" className="grid grid-cols-[1fr_80px_92px] gap-2 px-1.5 py-2 font-mono text-[11px] text-[var(--tinta2)]">
          <span role="columnheader">Señal</span>
          <span role="columnheader" className="text-right text-[#2563EB]">
            {pa.publicador}
          </span>
          <span role="columnheader" className="truncate text-right text-[#C2410C]">
            {pb.publicador}
          </span>
        </div>
        {EJES_ARANA.map((e, i) => (
          <div key={e.k} role="row" onMouseEnter={() => setEje(i)} className="grid grid-cols-[1fr_80px_92px] gap-2 rounded-lg px-1.5 py-2 transition-colors" style={{ background: eje === i ? (oscuro ? "#142339" : "#EFF6FF") : "transparent" }}>
            <span role="cell">{e.t}</span>
            <span role="cell" className="text-right font-mono font-semibold">
              {fmt(pa, e.k)}
            </span>
            <span role="cell" className="text-right font-mono font-semibold">
              {fmt(pb, e.k)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[var(--tinta2)]">
        Fuente: catálogo de MEData · {pa.total} y {pb.total} conjuntos · secretarías con 5 conjuntos o más.
      </p>
    </article>
  );
}

export default function VisualesAgencia({ visuales, oscuro, movil }: { visuales: Visuales; oscuro: boolean; movil: boolean }) {
  return (
    <section aria-labelledby="titulo-problema" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="titulo-problema" className="text-[clamp(26px,3.4vw,36px)] font-extrabold tracking-[-0.02em]">
          Cómo se ve el problema
        </h2>
        <p className="text-[15.5px] text-[var(--tinta2)]">Tres lecturas del mismo catálogo, para entenderlo de un vistazo.</p>
      </div>
      <Flujo flujo={visuales.flujo} oscuro={oscuro} movil={movil} />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr))]">
        <Calor calor={visuales.calor} oscuro={oscuro} />
        <Arana perfiles={visuales.perfiles} oscuro={oscuro} />
      </div>
    </section>
  );
}
