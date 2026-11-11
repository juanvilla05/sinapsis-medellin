import type { Metadata } from "next";
import { notFound } from "next/navigation";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado, EstadoFrescura, ResumenCatalogo } from "@/lib/catalogo";
import { informeSecretaria, resumenesSecretarias } from "@/lib/informes";
import { PRIORIDADES, TIPOS } from "@/lib/ventanilla";
import { decimal, fechaColombia, miles } from "@/mundo/areas";
import { MARCA } from "@/lib/marca";
import BotonImprimir from "./BotonImprimir";

const conjuntos = catalogo as ConjuntoAuditado[];
const R = resumen as ResumenCatalogo;

export function generateStaticParams() {
  return [{ secretaria: "general" }, ...resumenesSecretarias(conjuntos).map((r) => ({ secretaria: r.slug }))];
}

export async function generateMetadata({ params }: { params: Promise<{ secretaria: string }> }): Promise<Metadata> {
  const { secretaria } = await params;
  if (secretaria === "general") return { title: "Informe general de la Agencia" };
  const inf = informeSecretaria(conjuntos, secretaria);
  return { title: inf ? `Informe · ${inf.resumen.publicador}` : "Informe" };
}

const EST: Record<EstadoFrescura, { t: string; c: string }> = {
  critico: { t: "Crítico", c: "#B91C1C" },
  atrasado: { t: "Atrasado", c: "#B45309" },
  "al-dia": { t: "Al día", c: "#15803D" },
  "sin-periodicidad": { t: "Sin periodicidad", c: "#475569" },
  "sin-fecha": { t: "Sin fecha", c: "#475569" },
};

function Encabezado({ titulo, subtitulo, antetitulo = "INFORME DE FRESCURA POR SECRETARÍA" }: { titulo: string; subtitulo: string; antetitulo?: string }) {
  return (
    <header className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#0B1220] pb-3.5">
        <p className="flex items-center gap-2">
          <span className="inline-block h-[9px] w-[9px] rounded-full bg-[#34D399]" aria-hidden="true" />
          <span className="font-extrabold tracking-[0.08em]">PULSO</span>
          <span className="text-[12px] text-[#475569]">Agencia de datos · 06 Comunicaciones</span>
        </p>
        <span className="font-mono text-[11.5px] text-[#475569]">{fechaColombia(R.generado)}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11.5px] font-bold tracking-[0.14em] text-[#C2410C]">{antetitulo}</span>
        <h1 className="text-[clamp(28px,5vw,37px)] font-extrabold leading-[1.05] tracking-[-0.02em]">{titulo}</h1>
        <p className="max-w-[560px] text-[14.5px] text-[#475569]">{subtitulo}</p>
      </div>
    </header>
  );
}

function Pie() {
  return (
    <footer className="mt-8 flex flex-col gap-1 border-t-2 border-[#0B1220] pt-3 text-[10.5px] leading-relaxed text-[#475569]">
      <p>
        Fuente: catálogo público de MEData, Alcaldía de Medellín (https://medata.app.medellin.gov.co). Frescura: un conjunto está al día si no han pasado más de 1,5 veces su periodicidad
        declarada, atrasado hasta 3 veces y crítico por encima. Propuestas: reglas deterministas de la Ventanilla de Apertura. Solo metadatos públicos, sin datos personales.
      </p>
      <p>
        {MARCA.nombre} · {MARCA.evento} · {MARCA.aviso}
      </p>
    </footer>
  );
}

function BarraEstados({ porEstado, total }: { porEstado: Record<EstadoFrescura, number>; total: number }) {
  const orden: EstadoFrescura[] = ["critico", "atrasado", "al-dia", "sin-periodicidad"];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-md">
        {orden.map((e) => (porEstado[e] ? <div key={e} style={{ width: `${(porEstado[e] / total) * 100}%`, background: EST[e].c }} /> : null))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#334155]">
        {orden.map((e) => (
          <span key={e} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: EST[e].c }} /> {EST[e].t}: <strong>{miles(porEstado[e])}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function Informe({ params }: { params: Promise<{ secretaria: string }> }) {
  const { secretaria } = await params;

  if (secretaria === "general") {
    const filas = resumenesSecretarias(conjuntos);
    const props = filas.reduce((a, f) => a + f.propuestas, 0);
    return (
      <main className="informe mx-auto max-w-[860px] bg-white px-4 py-6 text-[#0F172A] sm:px-8 sm:py-8">
        <BotonImprimir />
        <Encabezado antetitulo="INFORME GENERAL DE FRESCURA" titulo="Informe general de calidad de los datos abiertos" subtitulo={`${miles(R.totalConjuntos)} conjuntos de ${miles(filas.length)} secretarías y entidades publicadoras`} />
        <section className="mt-6 grid items-center gap-3 sm:grid-cols-[auto_1fr] sm:gap-6">
          <p className="font-mono text-[56px] font-semibold leading-none text-[#B91C1C]">{decimal(R.pctAtrasados)} %</p>
          <p className="text-[15px] leading-relaxed">
            de los conjuntos que declaran una periodicidad está atrasado: <strong>{miles(R.porEstado.atrasado + R.porEstado.critico)} de {miles(R.evaluables)}</strong>. La Agencia
            propone mejoras para <strong>{miles(props)}</strong> conjuntos.
          </p>
        </section>
        <section className="mt-5">
          <BarraEstados porEstado={R.porEstado} total={R.totalConjuntos} />
        </section>
        <h2 className="mt-8 text-[16px] font-extrabold">Secretarías y entidades</h2>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[#0B1220] text-left">
              <th className="py-1.5">Publicador</th>
              <th className="py-1.5 text-right">Conjuntos</th>
              <th className="py-1.5 text-right">Atrasados</th>
              <th className="py-1.5 text-right">% atrasado</th>
              <th className="py-1.5 text-right">Con propuesta</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.slug} className="border-b border-[#E2E8F0]">
                <td className="py-1.5">{f.publicador}</td>
                <td className="py-1.5 text-right font-mono">{miles(f.total)}</td>
                <td className="py-1.5 text-right font-mono">{miles(f.atrasados)}</td>
                <td className="py-1.5 text-right font-mono">{f.pctAtrasados == null ? "sin dato" : `${decimal(f.pctAtrasados)} %`}</td>
                <td className="py-1.5 text-right font-mono">{miles(f.propuestas)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="mt-2 text-[11px] text-[#64748B]">«sin dato»: la entidad no tiene conjuntos con periodicidad comparable.</p>
        <Pie />
      </main>
    );
  }

  const inf = informeSecretaria(conjuntos, secretaria);
  if (!inf) notFound();
  const r = inf.resumen;
  const pct = (n: number) => `${decimal((n / Math.max(1, r.total)) * 100, 0)} %`;
  const sinPer = r.porEstado["sin-periodicidad"] + r.porEstado["sin-fecha"];
  const hallazgo =
    r.evaluables === 0
      ? `Ninguno de los conjuntos de ${r.publicador} declara cada cuánto se actualiza: no se puede medir su frescura (sin dato).`
      : sinPer === 0 && r.porEstado["al-dia"] === 0
        ? `Todos los conjuntos de ${r.publicador} declaran periodicidad y ninguno está al día.`
        : `${miles(r.atrasados)} de ${miles(r.evaluables)} conjuntos con periodicidad declarada están atrasados${sinPer ? `; ${miles(sinPer)} no dicen cada cuánto se actualizan` : ""}.`;
  const orden = [...inf.conjuntos].sort((a, b) => (b.vecesAtraso ?? -1) - (a.vecesAtraso ?? -1));
  const celda = "border-b border-[#E3EAF3] px-1.5 py-[5px]";
  const cab = "border-b-[1.5px] border-[#0F172A] px-1.5 py-1.5 font-bold";
  return (
    <main className="informe mx-auto flex max-w-[860px] flex-col gap-[22px] bg-white px-4 py-6 text-[14px] leading-normal text-[#0F172A] sm:px-8 sm:py-8">
      <BotonImprimir />
      <Encabezado titulo={r.publicador} subtitulo="Qué tan al día están sus conjuntos en MEData, según la periodicidad que declara cada uno y su última modificación en el catálogo." />

      <section className="informe-bloque grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { v: miles(r.total), t: "conjuntos publicados", c: "#0F172A" },
          { v: miles(r.porEstado.critico), t: "críticos: más de 3 veces su plazo", c: "#DC2626" },
          { v: miles(r.porEstado.atrasado), t: "atrasados: entre 1,5 y 3 veces", c: "#D97706" },
          { v: miles(r.porEstado["al-dia"]), t: "al día", c: "#16A34A" },
        ].map((k) => (
          <div key={k.t} className="flex flex-col gap-0.5 rounded-[10px] border border-[#E3EAF3] p-3">
            <span className="font-mono text-[26px] font-bold" style={{ color: k.c }}>
              {k.v}
            </span>
            <span className="text-[11.5px] text-[#475569]">{k.t}</span>
          </div>
        ))}
      </section>

      <section className="informe-bloque flex flex-col gap-2.5 rounded-xl bg-[#FFF4ED] px-[18px] py-4">
        <span className="font-bold">{hallazgo}</span>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]" aria-hidden="true">
          {(["critico", "atrasado", "al-dia", "sin-periodicidad"] as EstadoFrescura[]).map((e) =>
            r.porEstado[e] ? <span key={e} style={{ flex: r.porEstado[e], background: e === "critico" ? "#DC2626" : e === "atrasado" ? "#D97706" : e === "al-dia" ? "#16A34A" : "#94A3B8" }} /> : null,
          )}
        </div>
        <span className="text-[12px] text-[#475569]">
          Con diccionario: {pct(r.total - r.sinDiccionario)} · Datos descargables: {pct(r.total - r.soloTablero)} · Fecha en formato estándar: {pct(r.total - r.fechaIrregular)}. En el catálogo completo, el{" "}
          {decimal(R.pctAtrasados)} % de los conjuntos con periodicidad declarada está atrasado ({miles(R.porEstado.atrasado + R.porEstado.critico)} de {miles(R.evaluables)}).
        </span>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-extrabold">Estado de cada conjunto</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-[11.5px]">
            <thead className="[display:table-header-group]">
              <tr className="text-left font-mono text-[10px] tracking-[0.06em] text-[#475569]">
                <th className={`${cab} pl-0`}>CONJUNTO</th>
                <th className={cab}>PERIODICIDAD</th>
                <th className={cab}>ÚLTIMA MODIFICACIÓN</th>
                <th className={`${cab} text-right`}>DÍAS</th>
                <th className={`${cab} text-right`}>VECES SU PLAZO</th>
                <th className={`${cab} pr-0`}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {orden.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className={`${celda} pl-0 font-semibold`}>{c.titulo}</td>
                  <td className={`${celda} text-[#475569]`}>{c.periodicidad || "sin dato"}</td>
                  <td className={`${celda} font-mono`}>{c.modificado ? fechaColombia(c.modificado) : "sin dato"}</td>
                  <td className={`${celda} text-right font-mono`}>{c.diasSinActualizar == null ? "—" : miles(c.diasSinActualizar)}</td>
                  <td className={`${celda} text-right font-mono font-bold`} style={{ color: EST[c.estado].c }}>
                    {c.vecesAtraso == null ? "—" : `×${decimal(c.vecesAtraso)}`}
                  </td>
                  <td className={`${celda} pr-0`}>
                    <span className="inline-flex items-center gap-[5px] font-semibold" style={{ color: EST[c.estado].c }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: EST[c.estado].c }} aria-hidden="true" />
                      {EST[c.estado].t}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {inf.propuestas.length > 0 && (
        <section className="flex flex-col gap-2.5 [break-before:page]">
          <h2 className="text-[18px] font-extrabold">Propuestas de la Ventanilla de Apertura</h2>
          <p className="text-[12.5px] text-[#475569]">Una propuesta por conjunto, con su prioridad. El CSV con todas las propuestas se descarga desde la Agencia.</p>
          <ol className="flex flex-col">
            {inf.propuestas.map((p) => (
              <li key={p.id} className="informe-bloque grid grid-cols-[62px_1fr] gap-3 border-t border-[#E3EAF3] py-[9px]">
                <span className="self-start rounded-[5px] px-1.5 py-[3px] text-center font-mono text-[10px] font-bold tracking-[0.06em]" style={{ background: PRIORIDADES[p.prioridad].fondo, color: PRIORIDADES[p.prioridad].color }}>
                  {p.prioridad.toUpperCase()}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12.5px] font-bold">{p.titulo}</span>
                  {p.hallazgos.map((h) => (
                    <span key={h.tipo} className="text-[12px] text-[#334155]">
                      <span className="font-semibold" style={{ color: TIPOS[h.tipo].color }}>
                        {TIPOS[h.tipo].corto}:
                      </span>{" "}
                      {h.propuesta}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <Pie />
    </main>
  );
}
