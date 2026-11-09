import type { RespuestaFaq } from "@/lib/analista/faq";
import type { Cita, DatosBusqueda, DatosFrescura, DatosLimpieza, Respuesta as RespuestaHerramienta } from "@/lib/analista/herramientas";
import { NOMBRES_HERRAMIENTAS, type NombreHerramienta } from "@/lib/analista/sugeridas";
import type { EstadoFrescura } from "@/lib/catalogo";
import { decimal, esFechaSoloDia, fechaColombia, miles } from "../../areas";

const EST: Record<EstadoFrescura, { t: string; bg: string; fg: string }> = {
  critico: { t: "Crítico", bg: "#FEF2F2", fg: "#B91C1C" },
  atrasado: { t: "Atrasado", bg: "#FFFBEB", fg: "#B45309" },
  "al-dia": { t: "Al día", bg: "#F0FDF4", fg: "#15803D" },
  "sin-periodicidad": { t: "Sin periodicidad", bg: "#F1F5F9", fg: "#475569" },
  "sin-fecha": { t: "Sin fecha", bg: "#F1F5F9", fg: "#475569" },
};

/** "8 de noviembre de 2026, 11:20 p. m." en hora de Colombia (UTC-5). Una fecha solo-día ("2023-08-16") se muestra sin hora. */
export function fechaHoraColombia(iso: string) {
  if (esFechaSoloDia(iso)) return fechaColombia(iso);
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fechaColombia(iso)}, ${h12}:${mm} ${h < 12 ? "a. m." : "p. m."}`;
}

function Chip({ estado }: { estado: EstadoFrescura }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: EST[estado].bg, color: EST[estado].fg }}>
      {EST[estado].t}
    </span>
  );
}

function CifraGrande({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-mono text-[34px] font-semibold leading-none tracking-tight text-[#1E3A5F] sm:text-[40px]">{valor}</span>
      <span className="max-w-[46ch] text-[14px] leading-snug text-[#0F172A]">{texto}</span>
    </div>
  );
}

function TablaConjuntos({ conjuntos }: { conjuntos: DatosFrescura["conjuntos"] }) {
  if (conjuntos.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E3EAF3]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[12.5px]">
        <thead className="bg-[#F4F7FB] text-[11px] font-bold tracking-wide text-[#475569]">
          <tr>
            <th className="px-3 py-2 font-bold">CONJUNTO</th>
            <th className="px-3 py-2 font-bold">SECRETARÍA</th>
            <th className="px-3 py-2 font-bold">ÚLTIMA ACT.</th>
            <th className="px-3 py-2 font-bold">ESTADO</th>
          </tr>
        </thead>
        <tbody>
          {conjuntos.map((c) => (
            <tr key={c.id} className="border-t border-[#E3EAF3]">
              <td className="max-w-[280px] px-3 py-2">
                <a href={c.url} target="_blank" rel="noreferrer" className="line-clamp-2 font-semibold text-[#0F172A] hover:text-[#2563EB]" title={c.titulo}>
                  {c.titulo}
                </a>
              </td>
              <td className="px-3 py-2 text-[#475569]">{c.publicador}</td>
              <td className="px-3 py-2 font-mono text-[11.5px] text-[#475569]">{c.modificado ?? "—"}</td>
              <td className="px-3 py-2">
                <Chip estado={c.estado} />
                {c.vecesAtraso !== null && c.estado !== "al-dia" && (
                  <span className="ml-1 font-mono text-[11px] text-[#475569]">×{c.vecesAtraso >= 10 ? miles(c.vecesAtraso) : decimal(c.vecesAtraso)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CuerpoFrescura({ d }: { d: DatosFrescura }) {
  const s = d.secretaria;
  const max = Math.max(1, ...(d.secretarias ?? []).map((p) => p.atrasados));
  return (
    <div className="flex flex-col gap-3.5">
      {s ? (
        <CifraGrande
          valor={`${miles(s.atrasados)} de ${miles(s.total)}`}
          texto={`conjuntos de ${s.publicador} están atrasados o críticos (${miles(s.pct)} %). ${miles(s.alDia)} al día y ${miles(s.sinPeriodicidad)} sin periodicidad comparable.`}
        />
      ) : (
        <CifraGrande
          valor={`${decimal(d.resumen.pct)} %`}
          texto={`${miles(d.resumen.atrasados)} de ${miles(d.resumen.evaluables)} conjuntos con periodicidad comparable están atrasados; ${miles(d.resumen.alDia)} están al día.`}
        />
      )}
      {d.secretarias && d.secretarias.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-[#1E3A5F]">Secretarías con más conjuntos atrasados</span>
          {d.secretarias.map((p) => (
            <div key={p.publicador} className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)_72px] items-center gap-2.5">
              <span className="truncate text-[13px] text-[#0F172A]">{p.publicador}</span>
              <div className="h-2.5 overflow-hidden rounded bg-[#F4F7FB]">
                <div className="h-full rounded bg-[#D97706]" style={{ width: `${(p.atrasados / max) * 100}%` }} />
              </div>
              <span className="text-right font-mono text-[12.5px] text-[#0F172A]">
                {miles(p.atrasados)}/{miles(p.total)}
              </span>
            </div>
          ))}
        </div>
      )}
      {d.conjuntos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[#475569]">
            {d.totalCoincidencias > d.conjuntos.length
              ? `${miles(d.conjuntos.length)} de ${miles(d.totalCoincidencias)} conjuntos, los más atrasados primero`
              : `${miles(d.conjuntos.length)} conjuntos, los más atrasados primero`}
          </span>
          <TablaConjuntos conjuntos={d.conjuntos} />
        </div>
      )}
    </div>
  );
}

function CuerpoBusqueda({ d }: { d: DatosBusqueda }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[14px] text-[#0F172A]">
        {miles(d.totalCoincidencias)} conjuntos coinciden con “{d.texto}”. Los más relevantes:
      </span>
      <ul className="flex flex-col gap-2">
        {d.conjuntos.map((c) => (
          <li key={c.id} className="rounded-xl border border-[#E3EAF3] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-[#0F172A] hover:text-[#2563EB]">
                {c.titulo}
              </a>
              <Chip estado={c.estado} />
            </div>
            <div className="mt-1 font-mono text-[11.5px] text-[#475569]">
              {c.id} · {c.publicador} · {c.periodicidad.toLowerCase()} · últ. act. {c.modificado ?? "—"} · {c.tieneCsv ? "con CSV" : "sin CSV"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CuerpoLimpieza({ d }: { d: DatosLimpieza }) {
  return (
    <div className="flex flex-col gap-3.5">
      <CifraGrande
        valor={`${miles(d.antes.puntaje)} → ${miles(d.despues.puntaje)}`}
        texto={`puntaje de calidad de “${d.titulo}” antes y después de la limpieza (de 100). ${miles(d.antes.filas)} filas leídas, ${decimal(d.antes.pctCeldasVacias)} % de celdas vacías, ${miles(d.antes.filasVacias)} filas vacías y ${miles(d.antes.filasDuplicadas)} duplicadas.`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-xl border border-[#E3EAF3] px-3 py-2.5">
          <span className="text-xs font-bold text-[#475569]">Reglas aplicadas</span>
          {d.cambios.length === 0 && <span className="text-[12.5px] text-[#64748B]">No hizo falta aplicar reglas.</span>}
          {d.cambios.map((c) => (
            <div key={c.regla} className="flex justify-between gap-2 text-[12.5px]">
              <span className="text-[#0F172A]">{c.descripcion}</span>
              <span className="font-mono font-semibold text-[#16A34A]">{miles(c.afectadas)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl border border-[#E3EAF3] px-3 py-2.5">
          <span className="text-xs font-bold text-[#475569]">Bitácora</span>
          {d.bitacora.map((b, i) => (
            <div key={i} className="flex gap-2 text-[12.5px] leading-snug text-[#0F172A]">
              <span className="font-mono text-[#2563EB]">{String(i + 1).padStart(2, "0")}</span>
              <span>
                {b.detalle} <span className="text-[#64748B]">({miles(b.ms)} ms)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <span className="font-mono text-[11.5px] text-[#475569]">
        Codificación {d.codificacion} · {decimal(d.bytesLeidos / 1048576)} MB leídos{d.esMuestra ? " (inicio y final del archivo)" : " (archivo completo)"}
        {d.filasEstimadasArchivo !== null ? ` · ≈ ${miles(d.filasEstimadasArchivo)} filas en el archivo` : ""}
      </span>
    </div>
  );
}

function CuerpoFaq({ d }: { d: RespuestaFaq }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold text-[#1E3A5F]">{d.titulo}</span>
      {d.parrafos.map((p, i) => (
        <p key={i} className="m-0 text-[13.5px] leading-relaxed text-[#0F172A]">
          {p}
        </p>
      ))}
    </div>
  );
}

function CuerpoGenerico({ datos }: { datos: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-[#E3EAF3] bg-[#F4F7FB] p-3 font-mono text-[11.5px] text-[#0F172A]">
      {JSON.stringify(datos, null, 2)}
    </pre>
  );
}

export function Citas({ citas }: { citas: Cita[] }) {
  if (citas.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 border-t border-[#E3EAF3] pt-2.5">
      {citas.map((c, i) => (
        <li key={i} className="font-mono text-[11.5px] leading-snug text-[#475569]">
          Fuente:{" "}
          <a href={c.url} target="_blank" rel="noreferrer" className="text-[#1E3A5F] underline decoration-[#C9D6E8] hover:text-[#2563EB]">
            {c.conjunto}
          </a>
          {c.id ? ` (${c.id})` : ""}
          {c.campo ? ` · campo: ${c.campo}` : ""} · licencia: {c.licencia} · corte:{" "}
          {c.fechaCorte ? fechaHoraColombia(c.fechaCorte) : "no declarada"}
        </li>
      ))}
    </ul>
  );
}

/** Respuesta estructurada de una herramienta (ok:true): cifra grande, detalle y citas. */
export default function Respuesta({
  herramienta,
  respuesta,
}: {
  herramienta: NombreHerramienta;
  respuesta: Extract<RespuestaHerramienta<unknown>, { ok: true }>;
}) {
  const d = respuesta.datos;
  let cuerpo: React.ReactNode;
  switch (herramienta) {
    case "consultarFrescura":
      cuerpo = <CuerpoFrescura d={d as DatosFrescura} />;
      break;
    case "buscarConjunto":
      cuerpo = <CuerpoBusqueda d={d as DatosBusqueda} />;
      break;
    case "limpiarConjunto":
      cuerpo = <CuerpoLimpieza d={d as DatosLimpieza} />;
      break;
    case "explicarFuentes":
      cuerpo = <CuerpoFaq d={d as RespuestaFaq} />;
      break;
    default:
      cuerpo = <CuerpoGenerico datos={d} />;
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E3EAF3] bg-white p-4">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#475569]">{NOMBRES_HERRAMIENTAS[herramienta]}</span>
      {cuerpo}
      {respuesta.nota && <p className="m-0 text-[12px] leading-snug text-[#475569]">{respuesta.nota}</p>}
      <Citas citas={respuesta.citas} />
    </div>
  );
}
