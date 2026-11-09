import Link from "next/link";
import EscenaAlpujarra from "@/components/EscenaAlpujarra";
import { DESPACHOS } from "@/lib/despachos";
import { MARCA } from "@/lib/marca";
import resumen from "@/data/resumen-catalogo.json";

const nf = new Intl.NumberFormat("es-CO");

export default function Inicio() {
  const atrasados = resumen.porEstado.atrasado + resumen.porEstado.critico;
  const fechaCorte = new Date(resumen.generado).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });

  return (
    <>
      {/* Escena principal */}
      <section className="relative overflow-hidden">
        <div className="relative max-h-[78vh] overflow-hidden">
          <EscenaAlpujarra />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--noche)] to-transparent" />
        </div>
        <div className="pointer-events-none absolute left-0 top-0 hidden p-5 md:block">
          <div className="pointer-events-auto max-w-sm rounded-2xl bg-[var(--noche)]/80 px-5 py-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--verde)]">La Alpujarra · Medellín</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Los datos de Medellín, limpios y conectados.</h1>
            <p className="mt-2 text-xs text-white/60">Toca un punto luminoso del edificio para entrar a un despacho.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pt-4 md:hidden">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--verde)]">La Alpujarra · Medellín</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Los datos de Medellín, limpios y conectados.</h1>
        <p className="mt-2 text-sm text-white/70">{MARCA.lema}</p>
      </section>

      {/* Hallazgo principal */}
      <section className="mx-auto mt-6 max-w-7xl px-4 md:-mt-10">
        <div className="tarjeta relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--atrasado)]">Diagnóstico en vivo de MEData</p>
            <p className="mt-3 text-5xl font-extrabold text-white sm:text-6xl">
              {nf.format(resumen.pctAtrasados)}%
            </p>
            <p className="mt-2 max-w-xl text-lg text-white/80">
              de los conjuntos de MEData con periodicidad declarada lleva más de 1,5 veces ese plazo sin actualizarse:{" "}
              <strong className="text-white">
                {nf.format(atrasados)} de {nf.format(resumen.evaluables)}
              </strong>
              .
            </p>
            <p className="mt-3 text-xs text-white/50">
              Fuente: catálogo público de MEData ({nf.format(resumen.totalConjuntos)} conjuntos), consultado el {fechaCorte}. Se mide
              con la fecha de modificación que publica el propio portal.
            </p>
            <Link
              href="/frescura"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--verde)] px-5 py-2.5 text-sm font-bold text-[#062014] transition hover:brightness-110"
            >
              Ver el Reloj de Frescura →
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-3 self-center">
            {[
              { v: resumen.porEstado.critico, t: "conjuntos en estado crítico (más de 3 veces su plazo)", c: "var(--critico)" },
              { v: resumen.fechasIrregulares, t: "publican la fecha en formato no estándar (DD-MM-AAAA)", c: "var(--atrasado)" },
              { v: resumen.soloTablero, t: "solo muestran un tablero, sin datos descargables", c: "#a78bfa" },
              { v: resumen.porEstado["al-dia"], t: "conjuntos al día", c: "var(--al-dia)" },
            ].map((k) => (
              <div key={k.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="sr-only">{k.t}</dt>
                <dd>
                  <span className="block text-3xl font-extrabold" style={{ color: k.c }}>
                    {nf.format(k.v)}
                  </span>
                  <span className="mt-1 block text-xs text-white/65">{k.t}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Despachos */}
      <section className="mx-auto max-w-7xl px-4 py-14" aria-labelledby="despachos-titulo">
        <h2 id="despachos-titulo" className="text-2xl font-extrabold text-white">
          Los despachos de {MARCA.nombre}
        </h2>
        <p className="mt-1 text-sm text-white/60">Cada despacho es una herramienta que trabaja con los datos reales de MEData.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DESPACHOS.map((d) => (
            <Link key={d.id} href={d.listo ? d.ruta : "/"} className="tarjeta group p-5 transition hover:-translate-y-1 hover:border-white/25">
              <span className="block h-2.5 w-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 14px ${d.color}` }} />
              <h3 className="mt-3 font-bold text-white">{d.nombre}</h3>
              <p className="mt-2 text-sm text-white/65">{d.descripcion}</p>
              <span className="mt-3 inline-block text-sm font-semibold" style={{ color: d.color }}>
                Entrar →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
