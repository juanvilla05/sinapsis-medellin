import type { Metadata } from "next";
import { notFound } from "next/navigation";
import catalogo from "@/data/catalogo.json";
import resumen from "@/data/resumen-catalogo.json";
import type { ConjuntoAuditado, EstadoFrescura, ResumenCatalogo } from "@/lib/catalogo";
import { informeSecretaria, resumenesSecretarias, slug } from "@/lib/informes";
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

function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="flex flex-col gap-3 border-b-2 border-[#0B1220] pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.14em] text-[#0B1220]">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#34D399]" /> PULSO · AGENCIA DE DATOS
        </p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-[#0B1220]">{titulo}</h1>
        <p className="mt-1 text-[14px] text-[#475569]">{subtitulo}</p>
      </div>
      <div className="text-[11.5px] text-[#475569] sm:text-right">
        <p>Catálogo de MEData</p>
        <p className="font-semibold text-[#0F172A]">corte del {fechaColombia(R.generado)}</p>
      </div>
    </header>
  );
}

function Pie() {
  return (
    <footer className="mt-8 border-t border-[#CBD5E1] pt-3 text-[10.5px] leading-relaxed text-[#64748B]">
      <p>
        Fuente: catálogo público de MEData, Alcaldía de Medellín (https://medata.app.medellin.gov.co). Frescura: un conjunto está al día si no han pasado más de 1,5 veces su periodicidad
        declarada, atrasado hasta 3 veces y crítico por encima. Propuestas: reglas deterministas de la Ventanilla de Apertura. Solo metadatos públicos, sin datos personales.
      </p>
      <p className="mt-1">
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
        <Encabezado titulo="Informe general de calidad de los datos abiertos" subtitulo={`${miles(R.totalConjuntos)} conjuntos de ${miles(filas.length)} secretarías y entidades publicadoras`} />
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
  return (
    <main className="informe mx-auto max-w-[860px] bg-white px-4 py-6 text-[#0F172A] sm:px-8 sm:py-8">
      <BotonImprimir />
      <Encabezado titulo={`Informe de calidad de datos · ${r.publicador}`} subtitulo={`${miles(r.total)} conjuntos publicados en MEData`} />

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: r.pctAtrasados == null ? "sin dato" : `${decimal(r.pctAtrasados)} %`, t: `atrasado (${miles(r.atrasados)} de ${miles(r.evaluables)} con periodicidad)`, c: "#B91C1C" },
          { v: miles(r.porEstado.critico), t: "en estado crítico", c: "#B91C1C" },
          { v: miles(r.propuestas), t: "con propuesta de mejora", c: "#6D28D9" },
          { v: miles(r.alta), t: "de prioridad alta", c: "#B45309" },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-[#E2E8F0] p-3">
            <p className="font-mono text-[24px] font-semibold" style={{ color: k.c }}>
              {k.v}
            </p>
            <p className="text-[11.5px] leading-snug text-[#475569]">{k.t}</p>
          </div>
        ))}
      </section>
      <section className="mt-5">
        <BarraEstados porEstado={r.porEstado} total={r.total} />
        <p className="mt-2 text-[12px] text-[#475569]">
          Sin diccionario: {miles(r.sinDiccionario)} · solo tablero: {miles(r.soloTablero)} · fecha en formato no estándar: {miles(r.fechaIrregular)}.
        </p>
      </section>

      <h2 className="mt-8 text-[16px] font-extrabold">Sus conjuntos</h2>
      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-[11.5px]">
        <thead>
          <tr className="border-b border-[#0B1220] text-left">
            <th className="py-1.5 pr-2">Conjunto</th>
            <th className="py-1.5 pr-2">Periodicidad</th>
            <th className="py-1.5 pr-2">Última modificación</th>
            <th className="py-1.5 text-right">Estado</th>
          </tr>
        </thead>
        <tbody>
          {inf.conjuntos.map((c) => (
            <tr key={c.id} className="border-b border-[#E2E8F0] align-top">
              <td className="py-1.5 pr-2">{c.titulo}</td>
              <td className="py-1.5 pr-2">{c.periodicidad}</td>
              <td className="py-1.5 pr-2 font-mono">{c.modificado ?? "sin dato"}</td>
              <td className="py-1.5 text-right font-semibold" style={{ color: EST[c.estado].c }}>
                {EST[c.estado].t}
                {c.vecesAtraso != null && c.estado !== "al-dia" ? ` ×${decimal(c.vecesAtraso)}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {inf.propuestas.length > 0 && (
        <>
          <h2 className="mt-8 text-[16px] font-extrabold">Propuestas de la Agencia</h2>
          <ol className="mt-2 flex flex-col gap-3">
            {inf.propuestas.map((p, i) => (
              <li key={p.id} className="informe-bloque rounded-xl border border-[#E2E8F0] p-3">
                <p className="flex items-start justify-between gap-3 text-[13px] font-bold">
                  <span>
                    {i + 1}. {p.titulo}
                  </span>
                  <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: PRIORIDADES[p.prioridad].fondo, color: PRIORIDADES[p.prioridad].color }}>
                    {PRIORIDADES[p.prioridad].texto}
                  </span>
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {p.hallazgos.map((h) => (
                    <li key={h.tipo} className="text-[12px] leading-snug">
                      <span className="font-bold" style={{ color: TIPOS[h.tipo].color }}>
                        {TIPOS[h.tipo].largo}.
                      </span>{" "}
                      {h.problema} <span className="font-semibold">→ {h.propuesta}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mt-6 text-[11px] text-[#64748B]">Informe para: {r.publicador} · identificador: {slug(r.publicador)}</p>
      <Pie />
    </main>
  );
}
